from __future__ import annotations

from collections import defaultdict
from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils.dateparse import parse_date

from customauth.models import Carteira
from workspace.models import HistoricoMetaCarteiraMensal, MetaCarteiraMensal


ZERO = Decimal("0.00")


def converter_competencia(valor: str) -> date:
    texto = str(valor or "").strip()
    if len(texto) == 7:
        texto = f"{texto}-01"

    competencia = parse_date(texto)
    if not competencia:
        raise CommandError(
            "A competencia deve usar o formato AAAA-MM ou AAAA-MM-DD."
        )

    return date(competencia.year, competencia.month, 1)


class Command(BaseCommand):
    help = (
        "Preenche metas ausentes ou iguais a zero em uma competencia copiando "
        "a meta anterior valida da carteira ou, quando ela nao existir, a "
        "proxima. Executa em simulacao ate que --confirmar seja informado."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "competencia",
            help="Mes que sera preenchido, no formato AAAA-MM.",
        )
        parser.add_argument(
            "--confirmar",
            action="store_true",
            help="Grava as metas no banco. Sem esta opcao nada e alterado.",
        )
        parser.add_argument(
            "--usuario",
            help="Username registrado como autor das metas criadas ou alteradas.",
        )

    def handle(self, *args, **options):
        competencia = converter_competencia(options["competencia"])
        usuario = self._obter_usuario(options.get("usuario"))
        confirmar = options["confirmar"]

        metas_por_carteira = defaultdict(list)
        for meta in (
            MetaCarteiraMensal.objects.select_related("carteira")
            .only("id", "carteira_id", "competencia", "valor_meta")
            .order_by("carteira_id", "competencia")
        ):
            metas_por_carteira[meta.carteira_id].append(meta)

        existentes = 0
        sem_referencia = []
        preenchimentos = []

        for carteira in Carteira.objects.all().order_by("nome", "id"):
            metas = metas_por_carteira.get(carteira.pk, [])
            meta_destino = next(
                (meta for meta in metas if meta.competencia == competencia),
                None,
            )

            if meta_destino and meta_destino.valor_meta != ZERO:
                existentes += 1
                continue

            anteriores = [
                meta
                for meta in metas
                if meta.competencia < competencia and meta.valor_meta != ZERO
            ]
            if anteriores:
                preenchimentos.append(
                    (carteira, meta_destino, anteriores[-1], "anterior")
                )
                continue

            proximas = [
                meta
                for meta in metas
                if meta.competencia > competencia and meta.valor_meta != ZERO
            ]
            if proximas:
                preenchimentos.append(
                    (carteira, meta_destino, proximas[0], "proxima")
                )
                continue

            sem_referencia.append(carteira)

        anteriores = sum(
            1 for _, _, _, origem in preenchimentos if origem == "anterior"
        )
        proximas = len(preenchimentos) - anteriores
        metas_a_criar = sum(
            1 for _, meta_destino, _, _ in preenchimentos if meta_destino is None
        )
        metas_a_atualizar = len(preenchimentos) - metas_a_criar

        self.stdout.write(self.style.MIGRATE_HEADING("Preenchimento de metas ausentes"))
        self.stdout.write(f"Competencia: {competencia:%m/%Y}")
        self.stdout.write(f"Modo: {'GRAVACAO' if confirmar else 'SIMULACAO'}")
        self.stdout.write(f"Metas ja existentes: {existentes}")
        self.stdout.write(f"Metas ausentes a criar: {metas_a_criar}")
        self.stdout.write(f"Metas em zero a atualizar: {metas_a_atualizar}")
        self.stdout.write(f"Aptas usando meta anterior: {anteriores}")
        self.stdout.write(f"Aptas usando proxima meta: {proximas}")
        self.stdout.write(f"Carteiras sem referencia: {len(sem_referencia)}")

        for carteira, meta_destino, referencia, origem in preenchimentos:
            acao = "atualizar 0,00" if meta_destino else "criar"
            self.stdout.write(
                f"  - {carteira.nome}: {acao} com {referencia.valor_meta} "
                f"(meta {origem} de {referencia.competencia:%m/%Y})"
            )

        if sem_referencia:
            self.stdout.write(self.style.WARNING("Sem nenhuma meta para copiar:"))
            for carteira in sem_referencia:
                self.stdout.write(f"  - {carteira.nome}")

        if not confirmar:
            self.stdout.write("")
            self.stdout.write(
                self.style.WARNING("SIMULACAO: nenhuma meta foi gravada no banco.")
            )
            self.stdout.write(
                "Confira o resumo e repita o comando acrescentando --confirmar."
            )
            return

        criadas = 0
        atualizadas = 0
        with transaction.atomic():
            for carteira, _, referencia, origem in preenchimentos:
                meta = (
                    MetaCarteiraMensal.objects.select_for_update()
                    .filter(carteira=carteira, competencia=competencia)
                    .first()
                )

                if meta and meta.valor_meta != ZERO:
                    continue

                if meta:
                    valor_anterior = meta.valor_meta
                    meta.valor_meta = referencia.valor_meta
                    campos_atualizados = ["valor_meta", "atualizado_em"]
                    if usuario:
                        meta.alterado_por = usuario
                        campos_atualizados.append("alterado_por")
                    meta.save(update_fields=campos_atualizados)
                    acao = "ALTERACAO"
                    atualizadas += 1
                else:
                    valor_anterior = None
                    meta = MetaCarteiraMensal.objects.create(
                        carteira=carteira,
                        competencia=competencia,
                        valor_meta=referencia.valor_meta,
                        criado_por=usuario,
                        alterado_por=usuario,
                    )
                    acao = "CRIACAO"
                    criadas += 1

                HistoricoMetaCarteiraMensal.objects.create(
                    meta=meta,
                    carteira=carteira,
                    competencia=competencia,
                    valor_anterior=valor_anterior,
                    valor_novo=meta.valor_meta,
                    acao=acao,
                    alterado_por=usuario,
                    descricao=(
                        f"Meta preenchida automaticamente usando a meta {origem} "
                        f"da competencia {referencia.competencia:%m/%Y}."
                    ),
                )
        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(
                f"Preenchimento concluido: {criadas} meta(s) criada(s) e "
                f"{atualizadas} meta(s) atualizada(s) para {competencia:%m/%Y}."
            )
        )

    @staticmethod
    def _obter_usuario(username):
        if not username:
            return None

        try:
            return get_user_model().objects.get(username=username)
        except get_user_model().DoesNotExist as exc:
            raise CommandError(f"Usuario nao encontrado: {username}") from exc
