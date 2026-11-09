from __future__ import annotations

import re
import unicodedata
from collections import Counter, defaultdict
from datetime import date, datetime
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_date
from openpyxl import load_workbook

from customauth.models import Carteira
from workspace.models import (
    HistoricoMetaCarteiraMensal,
    MetaCarteiraMensal,
    ProducaoCarteira,
)


PLANILHA_PRODUCOES = "Planilha1"
PLANILHA_METAS = "Planilha2"
INICIO_PADRAO = date(2026, 1, 1)
FIM_PADRAO = date(2026, 4, 30)

COLUNAS_PRODUCOES = {
    "DATA",
    "CARTEIRA",
    "VALOR PRODUZIDO",
    "VALOR PAGO",
    "VALOR HO",
    "VALOR ENTREGA AMIGAVEL",
    "QUANTIDADE BASE",
    "VALOR CARTEIRA",
}
COLUNAS_METAS = {"DATA", "CARTEIRA", "VALOR META"}
TRACOS_QUE_REPRESENTAM_ZERO = frozenset("-‐‑‒–—−")


def normalizar_texto(valor) -> str:
    texto = unicodedata.normalize("NFKD", str(valor or ""))
    texto = texto.encode("ascii", "ignore").decode("ascii").casefold()
    return re.sub(r"[^a-z0-9]+", " ", texto).strip()


def converter_data(valor, *, linha: int, planilha: str) -> date:
    if isinstance(valor, datetime):
        return valor.date()
    if isinstance(valor, date):
        return valor
    if isinstance(valor, str):
        texto = valor.strip()
        data_convertida = parse_date(texto)
        if data_convertida:
            return data_convertida
        for formato in ("%d/%m/%Y", "%d/%m/%y"):
            try:
                return datetime.strptime(texto, formato).date()
            except ValueError:
                pass
    raise ValueError(
        f"{planilha}, linha {linha}: data invalida ({valor!r})."
    )


def converter_decimal(valor, *, linha: int, coluna: str, planilha: str) -> Decimal:
    if valor is None or (isinstance(valor, str) and not valor.strip()):
        return Decimal("0.00")

    if isinstance(valor, str):
        texto = re.sub(r"\s+", "", valor.strip().replace("R$", ""))
        if texto and set(texto) <= TRACOS_QUE_REPRESENTAM_ZERO:
            return Decimal("0.00")
        if "," in texto:
            texto = texto.replace(".", "").replace(",", ".")
    else:
        texto = str(valor)

    try:
        return Decimal(texto).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    except (InvalidOperation, ValueError, TypeError) as exc:
        raise ValueError(
            f"{planilha}, linha {linha}: valor invalido em {coluna} ({valor!r})."
        ) from exc


class Command(BaseCommand):
    help = (
        "Importa producoes da Planilha1 e metas da Planilha2. Por seguranca, "
        "executa somente uma simulacao ate que --confirmar seja informado."
    )

    def add_arguments(self, parser):
        parser.add_argument("arquivo", help="Caminho do arquivo .xlsx")
        parser.add_argument(
            "--inicio",
            default=INICIO_PADRAO.isoformat(),
            help="Data inicial inclusiva (AAAA-MM-DD). Padrao: 2026-01-01.",
        )
        parser.add_argument(
            "--fim",
            default=FIM_PADRAO.isoformat(),
            help="Data final inclusiva (AAAA-MM-DD). Padrao: 2026-04-30.",
        )
        parser.add_argument(
            "--confirmar",
            action="store_true",
            help="Grava os registros no banco. Sem esta opcao nada e alterado.",
        )
        parser.add_argument(
            "--usuario",
            help="Username do usuario que ficara registrado como autor da importacao.",
        )

    def handle(self, *args, **options):
        arquivo = Path(options["arquivo"]).expanduser().resolve()
        if not arquivo.is_file():
            raise CommandError(f"Arquivo nao encontrado: {arquivo}")
        if arquivo.suffix.casefold() != ".xlsx":
            raise CommandError("O arquivo deve estar no formato .xlsx.")

        inicio = parse_date(options["inicio"])
        fim = parse_date(options["fim"])
        if not inicio or not fim:
            raise CommandError("--inicio e --fim devem usar o formato AAAA-MM-DD.")
        if inicio > fim:
            raise CommandError("A data inicial nao pode ser posterior a data final.")

        usuario = self._obter_usuario(options.get("usuario"))
        confirmar = options["confirmar"]

        with arquivo.open("rb") as fluxo_arquivo:
            try:
                workbook = load_workbook(
                    fluxo_arquivo,
                    read_only=True,
                    data_only=True,
                )
            except Exception as exc:
                raise CommandError(f"Nao foi possivel abrir o Excel: {exc}") from exc

            try:
                self._validar_planilhas(workbook)
                mapa_carteiras = self._mapa_carteiras()
                resultado_producoes = self._ler_producoes(
                    workbook[PLANILHA_PRODUCOES],
                    mapa_carteiras,
                    inicio,
                    fim,
                    usuario,
                )
                resultado_metas = self._ler_metas(
                    workbook[PLANILHA_METAS],
                    mapa_carteiras,
                    inicio,
                    fim,
                    usuario,
                )
            finally:
                workbook.close()

        self._mostrar_resumo(
            arquivo,
            inicio,
            fim,
            resultado_producoes,
            resultado_metas,
            confirmar,
        )

        erros = resultado_producoes["erros"] + resultado_metas["erros"]
        if erros:
            self.stderr.write(self.style.ERROR("Erros encontrados:"))
            for erro in erros[:20]:
                self.stderr.write(f"  - {erro}")
            if len(erros) > 20:
                self.stderr.write(f"  ... e mais {len(erros) - 20} erro(s).")
            raise CommandError(
                "A importacao foi cancelada porque existem linhas invalidas. "
                "Corrija o arquivo e execute novamente."
            )

        if not confirmar:
            self.stdout.write("")
            self.stdout.write(
                self.style.WARNING("SIMULACAO: nenhum registro foi gravado no banco.")
            )
            self.stdout.write(
                "Confira o resumo e repita o comando acrescentando --confirmar."
            )
            return

        with transaction.atomic():
            producoes = resultado_producoes["novos"]
            if producoes:
                ProducaoCarteira.objects.bulk_create(producoes, batch_size=500)

            producoes_atualizadas = resultado_producoes["atualizados"]
            if producoes_atualizadas:
                agora = timezone.now()
                for producao in producoes_atualizadas:
                    producao.atualizado_em = agora
                campos_atualizados = [
                    "producao_realizada",
                    "pagamento",
                    "valor_ho",
                    "entrega_amigavel",
                    "quantidade_base",
                    "valor_carteira",
                    "atualizado_em",
                ]
                if usuario:
                    campos_atualizados.append("alterado_por")
                ProducaoCarteira.objects.bulk_update(
                    producoes_atualizadas,
                    campos_atualizados,
                    batch_size=500,
                )

            for meta in resultado_metas["novos"]:
                meta.save()
                HistoricoMetaCarteiraMensal.objects.create(
                    meta=meta,
                    carteira=meta.carteira,
                    competencia=meta.competencia,
                    valor_anterior=None,
                    valor_novo=meta.valor_meta,
                    acao="CRIACAO",
                    alterado_por=usuario,
                    descricao="Meta criada pela importacao do historico em Excel.",
                )

            for meta, valor_anterior in resultado_metas["atualizados"]:
                campos_atualizados = ["valor_meta", "atualizado_em"]
                if usuario:
                    campos_atualizados.append("alterado_por")
                meta.save(update_fields=campos_atualizados)
                HistoricoMetaCarteiraMensal.objects.create(
                    meta=meta,
                    carteira=meta.carteira,
                    competencia=meta.competencia,
                    valor_anterior=valor_anterior,
                    valor_novo=meta.valor_meta,
                    acao="ALTERACAO",
                    alterado_por=usuario,
                    descricao="Meta atualizada pela importacao do historico em Excel.",
                )

        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(
                "Importacao concluida: "
                f"{len(resultado_producoes['novos'])} producao(oes) inserida(s), "
                f"{len(resultado_producoes['atualizados'])} atualizada(s); "
                f"{len(resultado_metas['novos'])} meta(s) inserida(s), "
                f"{len(resultado_metas['atualizados'])} atualizada(s)."
            )
        )

    def _obter_usuario(self, username):
        if not username:
            return None
        try:
            return get_user_model().objects.get(username=username)
        except get_user_model().DoesNotExist as exc:
            raise CommandError(f"Usuario nao encontrado: {username}") from exc

    def _validar_planilhas(self, workbook):
        faltantes = {
            PLANILHA_PRODUCOES,
            PLANILHA_METAS,
        } - set(workbook.sheetnames)
        if faltantes:
            raise CommandError(
                "Planilha(s) obrigatoria(s) ausente(s): " + ", ".join(sorted(faltantes))
            )

        self._mapa_colunas(workbook[PLANILHA_PRODUCOES], COLUNAS_PRODUCOES)
        self._mapa_colunas(workbook[PLANILHA_METAS], COLUNAS_METAS)

    def _mapa_colunas(self, worksheet, obrigatorias):
        primeira_linha = next(worksheet.iter_rows(min_row=1, max_row=1, values_only=True))
        mapa = {
            normalizar_texto(valor).upper(): indice
            for indice, valor in enumerate(primeira_linha)
            if valor is not None
        }
        obrigatorias_normalizadas = {
            normalizar_texto(coluna).upper() for coluna in obrigatorias
        }
        faltantes = obrigatorias_normalizadas - set(mapa)
        if faltantes:
            raise CommandError(
                f"{worksheet.title}: coluna(s) obrigatoria(s) ausente(s): "
                + ", ".join(sorted(faltantes))
            )
        return mapa

    def _mapa_carteiras(self):
        mapa = defaultdict(list)
        for carteira in Carteira.objects.all().order_by("id"):
            mapa[normalizar_texto(carteira.nome)].append(carteira)
        return mapa

    @staticmethod
    def _resolver_carteira(nome, mapa_carteiras):
        encontradas = mapa_carteiras.get(normalizar_texto(nome), [])
        if len(encontradas) == 1:
            return encontradas[0], None
        if not encontradas:
            return None, "nao encontrada"
        return None, "cadastro ambiguo"

    def _novo_resultado(self):
        return {
            "novos": [],
            "atualizados": [],
            "inalterados": 0,
            "duplicados_arquivo": 0,
            "fora_periodo": 0,
            "ignoradas": Counter(),
            "erros": [],
        }

    def _ler_producoes(self, worksheet, mapa_carteiras, inicio, fim, usuario):
        colunas = self._mapa_colunas(worksheet, COLUNAS_PRODUCOES)
        resultado = self._novo_resultado()
        existentes = {
            (producao.carteira_id, producao.data_producao): producao
            for producao in ProducaoCarteira.objects.filter(
                data_producao__range=(inicio, fim)
            )
        }
        chaves_arquivo = set()

        for numero_linha, linha in enumerate(
            worksheet.iter_rows(min_row=2, values_only=True), start=2
        ):
            if not any(valor is not None for valor in linha):
                continue
            try:
                data_producao = converter_data(
                    linha[colunas["DATA"]],
                    linha=numero_linha,
                    planilha=worksheet.title,
                )
                nome = str(linha[colunas["CARTEIRA"]] or "").strip()
                if not nome:
                    raise ValueError(
                        f"{worksheet.title}, linha {numero_linha}: carteira vazia."
                    )
                if not inicio <= data_producao <= fim:
                    resultado["fora_periodo"] += 1
                    continue

                carteira, motivo = self._resolver_carteira(nome, mapa_carteiras)
                if not carteira:
                    resultado["ignoradas"][(nome, motivo)] += 1
                    continue

                chave = (carteira.pk, data_producao)
                if chave in chaves_arquivo:
                    resultado["duplicados_arquivo"] += 1
                    continue

                valores = {
                    "producao_realizada": converter_decimal(
                        linha[colunas["VALOR PRODUZIDO"]],
                        linha=numero_linha,
                        coluna="VALOR PRODUZIDO",
                        planilha=worksheet.title,
                    ),
                    "pagamento": converter_decimal(
                        linha[colunas["VALOR PAGO"]],
                        linha=numero_linha,
                        coluna="VALOR PAGO",
                        planilha=worksheet.title,
                    ),
                    "valor_ho": converter_decimal(
                        linha[colunas["VALOR HO"]],
                        linha=numero_linha,
                        coluna="VALOR HO",
                        planilha=worksheet.title,
                    ),
                    "entrega_amigavel": converter_decimal(
                        linha[colunas["VALOR ENTREGA AMIGAVEL"]],
                        linha=numero_linha,
                        coluna="VALOR ENTREGA AMIGAVEL",
                        planilha=worksheet.title,
                    ),
                    "quantidade_base": converter_decimal(
                        linha[colunas["QUANTIDADE BASE"]],
                        linha=numero_linha,
                        coluna="QUANTIDADE BASE",
                        planilha=worksheet.title,
                    ),
                    "valor_carteira": converter_decimal(
                        linha[colunas["VALOR CARTEIRA"]],
                        linha=numero_linha,
                        coluna="VALOR CARTEIRA",
                        planilha=worksheet.title,
                    ),
                }

                producao_existente = existentes.get(chave)
                if producao_existente:
                    if all(
                        getattr(producao_existente, campo) == valor
                        for campo, valor in valores.items()
                    ):
                        resultado["inalterados"] += 1
                    else:
                        for campo, valor in valores.items():
                            setattr(producao_existente, campo, valor)
                        if usuario:
                            producao_existente.alterado_por = usuario
                        resultado["atualizados"].append(producao_existente)
                else:
                    resultado["novos"].append(
                        ProducaoCarteira(
                            carteira=carteira,
                            data_producao=data_producao,
                            criado_por=usuario,
                            alterado_por=usuario,
                            **valores,
                        )
                    )
                chaves_arquivo.add(chave)
            except ValueError as exc:
                resultado["erros"].append(str(exc))

        return resultado

    def _ler_metas(self, worksheet, mapa_carteiras, inicio, fim, usuario):
        colunas = self._mapa_colunas(worksheet, COLUNAS_METAS)
        resultado = self._novo_resultado()
        competencia_inicio = date(inicio.year, inicio.month, 1)
        competencia_fim = date(fim.year, fim.month, 1)
        existentes = {
            (meta.carteira_id, meta.competencia): meta
            for meta in MetaCarteiraMensal.objects.filter(
                competencia__range=(competencia_inicio, competencia_fim)
            )
        }
        chaves_arquivo = set()

        for numero_linha, linha in enumerate(
            worksheet.iter_rows(min_row=2, values_only=True), start=2
        ):
            if not any(valor is not None for valor in linha):
                continue
            try:
                data_meta = converter_data(
                    linha[colunas["DATA"]],
                    linha=numero_linha,
                    planilha=worksheet.title,
                )
                competencia = date(data_meta.year, data_meta.month, 1)
                nome = str(linha[colunas["CARTEIRA"]] or "").strip()
                if not nome:
                    raise ValueError(
                        f"{worksheet.title}, linha {numero_linha}: carteira vazia."
                    )
                if not competencia_inicio <= competencia <= competencia_fim:
                    resultado["fora_periodo"] += 1
                    continue

                carteira, motivo = self._resolver_carteira(nome, mapa_carteiras)
                if not carteira:
                    resultado["ignoradas"][(nome, motivo)] += 1
                    continue

                chave = (carteira.pk, competencia)
                if chave in chaves_arquivo:
                    resultado["duplicados_arquivo"] += 1
                    continue

                valor_meta = converter_decimal(
                    linha[colunas["VALOR META"]],
                    linha=numero_linha,
                    coluna="VALOR META",
                    planilha=worksheet.title,
                )

                meta_existente = existentes.get(chave)
                if meta_existente:
                    if meta_existente.valor_meta == valor_meta:
                        resultado["inalterados"] += 1
                    else:
                        valor_anterior = meta_existente.valor_meta
                        meta_existente.valor_meta = valor_meta
                        if usuario:
                            meta_existente.alterado_por = usuario
                        resultado["atualizados"].append(
                            (meta_existente, valor_anterior)
                        )
                else:
                    resultado["novos"].append(
                        MetaCarteiraMensal(
                            carteira=carteira,
                            competencia=competencia,
                            valor_meta=valor_meta,
                            criado_por=usuario,
                            alterado_por=usuario,
                        )
                    )
                chaves_arquivo.add(chave)
            except ValueError as exc:
                resultado["erros"].append(str(exc))

        return resultado

    def _mostrar_resumo(
        self,
        arquivo,
        inicio,
        fim,
        producoes,
        metas,
        confirmar,
    ):
        self.stdout.write(self.style.MIGRATE_HEADING("Importacao de historico"))
        self.stdout.write(f"Arquivo: {arquivo}")
        self.stdout.write(f"Periodo: {inicio:%d/%m/%Y} a {fim:%d/%m/%Y}")
        self.stdout.write(f"Modo: {'GRAVACAO' if confirmar else 'SIMULACAO'}")
        self.stdout.write("")
        self._mostrar_resultado("Producoes", producoes)
        self._mostrar_resultado("Metas", metas)

    def _mostrar_resultado(self, titulo, resultado):
        self.stdout.write(self.style.MIGRATE_LABEL(titulo))
        self.stdout.write(f"  Aptas para inserir: {len(resultado['novos'])}")
        self.stdout.write(f"  Aptas para atualizar: {len(resultado['atualizados'])}")
        self.stdout.write(f"  Ja identicas no banco: {resultado['inalterados']}")
        self.stdout.write(
            f"  Duplicadas no arquivo: {resultado['duplicados_arquivo']}"
        )
        self.stdout.write(f"  Fora do periodo: {resultado['fora_periodo']}")
        self.stdout.write(f"  Linhas invalidas: {len(resultado['erros'])}")
        total_ignoradas = sum(resultado["ignoradas"].values())
        self.stdout.write(f"  Carteiras ignoradas: {total_ignoradas}")
        for (nome, motivo), quantidade in sorted(resultado["ignoradas"].items()):
            self.stdout.write(f"    - {nome}: {quantidade} ({motivo})")
