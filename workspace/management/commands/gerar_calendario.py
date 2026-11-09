from datetime import date, timedelta
import calendar

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from workspace.models import CalendarioUtil


# ============================================================
# MESES
# ============================================================

MESES = {
    1: ("Janeiro", "Jan"),
    2: ("Fevereiro", "Fev"),
    3: ("Março", "Mar"),
    4: ("Abril", "Abr"),
    5: ("Maio", "Mai"),
    6: ("Junho", "Jun"),
    7: ("Julho", "Jul"),
    8: ("Agosto", "Ago"),
    9: ("Setembro", "Set"),
    10: ("Outubro", "Out"),
    11: ("Novembro", "Nov"),
    12: ("Dezembro", "Dez"),
}


# ============================================================
# DIAS DA SEMANA
#
# Segunda = 1
# Terça   = 2
# Quarta  = 3
# Quinta  = 4
# Sexta   = 5
# Sábado  = 6
# Domingo = 7
# ============================================================

DIAS_SEMANA = {
    1: ("Segunda-feira", "Seg"),
    2: ("Terça-feira", "Ter"),
    3: ("Quarta-feira", "Qua"),
    4: ("Quinta-feira", "Qui"),
    5: ("Sexta-feira", "Sex"),
    6: ("Sábado", "Sáb"),
    7: ("Domingo", "Dom"),
}


class Command(BaseCommand):
    help = (
        "Gera o calendário oficial do Workspace. "
        "Por padrão, cria as datas de 01/01/2026 até 31/12/2035."
    )

    # ========================================================
    # ARGUMENTOS
    # ========================================================

    def add_arguments(self, parser):
        parser.add_argument(
            "--inicio",
            type=str,
            default="2026-01-01",
            help="Data inicial no formato AAAA-MM-DD.",
        )

        parser.add_argument(
            "--fim",
            type=str,
            default="2035-12-31",
            help="Data final no formato AAAA-MM-DD.",
        )

    # ========================================================
    # APOIO - COMPETÊNCIAS / DIAS ÚTEIS
    # ========================================================

    @staticmethod
    def _competencias_do_periodo(data_inicial, data_final):
        """Retorna o primeiro dia de cada mês tocado pelo período."""
        competencia_atual = date(
            data_inicial.year,
            data_inicial.month,
            1,
        )

        competencia_final = date(
            data_final.year,
            data_final.month,
            1,
        )

        while competencia_atual <= competencia_final:
            yield competencia_atual

            if competencia_atual.month == 12:
                competencia_atual = date(
                    competencia_atual.year + 1,
                    1,
                    1,
                )
            else:
                competencia_atual = date(
                    competencia_atual.year,
                    competencia_atual.month + 1,
                    1,
                )

    def _recalcular_dias_uteis(
        self,
        data_inicial,
        data_final,
    ):
        """
        Recalcula, mês a mês, os campos derivados de dia útil.

        Regras:
        - sábado e domingo nunca são dias úteis;
        - feriado nunca é dia útil;
        - em dias úteis, dia_util_numero é sequencial dentro do mês;
        - em dias não úteis, dia_util_numero fica NULL;
        - total_dias_uteis_mes é repetido em todas as linhas do mês;
        - respeita dias úteis já desativados manualmente em dias de semana.

        O recálculo é feito para o mês inteiro, mesmo quando --inicio ou
        --fim apontarem para um dia no meio do mês.
        """
        total_registros_atualizados = 0
        total_competencias = 0

        for competencia in self._competencias_do_periodo(
            data_inicial,
            data_final,
        ):
            ultimo_dia_numero = calendar.monthrange(
                competencia.year,
                competencia.month,
            )[1]

            ultimo_dia_mes = date(
                competencia.year,
                competencia.month,
                ultimo_dia_numero,
            )

            registros_mes = list(
                CalendarioUtil.objects.filter(
                    data__range=(
                        competencia,
                        ultimo_dia_mes,
                    )
                ).order_by(
                    "data"
                )
            )

            if not registros_mes:
                continue

            registros_por_data = {
                registro.data: registro
                for registro in registros_mes
            }

            sequencia_dia_util = {}
            contador_dias_uteis = 0
            data_cursor = competencia

            while data_cursor <= ultimo_dia_mes:
                registro = registros_por_data.get(
                    data_cursor
                )

                fim_semana = (
                    data_cursor.isoweekday() in (6, 7)
                )

                if registro is None:
                    # Caso o comando tenha sido executado para um
                    # intervalo parcial, considera como útil um dia
                    # de semana ainda não gravado. Como não existe
                    # registro, não há feriado/exceção cadastrada.
                    eh_dia_util = not fim_semana

                else:
                    registro.fim_semana = fim_semana

                    # Fim de semana e feriado prevalecem sobre
                    # qualquer valor anterior de dia_util.
                    if fim_semana or registro.feriado:
                        registro.dia_util = False
                        eh_dia_util = False
                    else:
                        # Em dias de semana não feriados, respeita
                        # eventuais exceções já registradas como
                        # dia_util=False.
                        eh_dia_util = bool(
                            registro.dia_util
                        )

                if eh_dia_util:
                    contador_dias_uteis += 1
                    sequencia_dia_util[data_cursor] = (
                        contador_dias_uteis
                    )
                else:
                    sequencia_dia_util[data_cursor] = None

                data_cursor += timedelta(days=1)

            total_dias_uteis_mes = (
                contador_dias_uteis
            )

            for registro in registros_mes:
                registro.dia_util_numero = (
                    sequencia_dia_util.get(
                        registro.data
                    )
                )

                registro.total_dias_uteis_mes = (
                    total_dias_uteis_mes
                )

            CalendarioUtil.objects.bulk_update(
                registros_mes,
                fields=[
                    "fim_semana",
                    "dia_util",
                    "dia_util_numero",
                    "total_dias_uteis_mes",
                ],
                batch_size=1000,
            )

            total_registros_atualizados += len(
                registros_mes
            )
            total_competencias += 1

        return (
            total_registros_atualizados,
            total_competencias,
        )

    # ========================================================
    # EXECUÇÃO PRINCIPAL
    # ========================================================

    def handle(self, *args, **options):
        try:
            data_inicial = date.fromisoformat(
                options["inicio"]
            )

            data_final = date.fromisoformat(
                options["fim"]
            )

        except (ValueError, TypeError):
            raise CommandError(
                "As datas devem estar no formato AAAA-MM-DD."
            )

        if data_inicial > data_final:
            raise CommandError(
                "A data inicial não pode ser maior "
                "que a data final."
            )

        self.stdout.write("")

        self.stdout.write(
            self.style.WARNING(
                "============================================"
            )
        )

        self.stdout.write(
            self.style.WARNING(
                " GERANDO CALENDÁRIO OFICIAL DO WORKSPACE"
            )
        )

        self.stdout.write(
            self.style.WARNING(
                "============================================"
            )
        )

        self.stdout.write(
            f"Início: {data_inicial.strftime('%d/%m/%Y')}"
        )

        self.stdout.write(
            f"Fim:    {data_final.strftime('%d/%m/%Y')}"
        )

        self.stdout.write("")

        # ====================================================
        # LOCALIZA DATAS QUE JÁ EXISTEM
        # ====================================================

        datas_existentes = set(
            CalendarioUtil.objects.filter(
                data__range=(
                    data_inicial,
                    data_final,
                )
            ).values_list(
                "data",
                flat=True,
            )
        )

        registros = []

        data_atual = data_inicial

        # ====================================================
        # PERCORRE DIA POR DIA
        # ====================================================

        while data_atual <= data_final:
            # Se a data já existe, não duplica.
            if data_atual in datas_existentes:
                data_atual += timedelta(days=1)
                continue

            ano = data_atual.year
            mes = data_atual.month
            dia = data_atual.day

            # ================================================
            # MÊS
            # ================================================

            mes_nome, mes_abreviado = MESES[mes]

            competencia = date(
                ano,
                mes,
                1,
            )

            ultimo_dia_numero = calendar.monthrange(
                ano,
                mes,
            )[1]

            ultimo_dia_mes = date(
                ano,
                mes,
                ultimo_dia_numero,
            )

            # ================================================
            # SEMESTRE
            # ================================================

            semestre = (
                1
                if mes <= 6
                else 2
            )

            semestre_nome = (
                "1º Semestre"
                if semestre == 1
                else "2º Semestre"
            )

            semestre_ano = (
                f"S{semestre}/{ano}"
            )

            # ================================================
            # TRIMESTRE
            # ================================================

            trimestre = (
                ((mes - 1) // 3) + 1
            )

            trimestre_nome = (
                f"{trimestre}º Trimestre"
            )

            trimestre_ano = (
                f"T{trimestre}/{ano}"
            )

            # ================================================
            # DIA DA SEMANA
            # ================================================

            dia_semana_numero = (
                data_atual.isoweekday()
            )

            (
                dia_semana_nome,
                dia_semana_abreviado,
            ) = DIAS_SEMANA[
                dia_semana_numero
            ]

            # ================================================
            # FIM DE SEMANA
            # ================================================

            fim_semana = (
                dia_semana_numero in (6, 7)
            )

            # ================================================
            # DIA ÚTIL INICIAL
            #
            # Nesta primeira geração:
            #
            # Segunda a sexta = útil
            # Sábado/domingo  = não útil
            #
            # Feriados serão tratados depois.
            # ================================================

            dia_util = not fim_semana

            if fim_semana:
                tipo_dia = "FIM_SEMANA"
            else:
                tipo_dia = "UTIL"

            # ================================================
            # SEMANA DO ANO
            # ================================================

            semana_ano = (
                data_atual.isocalendar().week
            )

            # ================================================
            # SEMANA DO MÊS
            # ================================================

            semana_mes = (
                ((dia - 1) // 7) + 1
            )

            # ================================================
            # DIA DO ANO
            #
            # 01/01 = 1
            # 31/12 = 365 ou 366
            # ================================================

            dia_ano = int(
                data_atual.strftime("%j")
            )

            # ================================================
            # DATA CHAVE
            #
            # Exemplo:
            # 07/08/2026 -> 20260807
            # ================================================

            data_chave = int(
                data_atual.strftime("%Y%m%d")
            )

            # ================================================
            # ANO / MÊS
            #
            # Exemplo:
            # Agosto/2026 -> 202608
            # ================================================

            ano_mes_numero = (
                ano * 100 + mes
            )

            # ================================================
            # CRIA O OBJETO
            # ================================================

            registro = CalendarioUtil(
                # --------------------------------------------
                # DATA
                # --------------------------------------------

                data=data_atual,

                data_chave=data_chave,

                competencia=competencia,

                # --------------------------------------------
                # ANO
                # --------------------------------------------

                ano=ano,

                # --------------------------------------------
                # SEMESTRE
                # --------------------------------------------

                semestre=semestre,

                semestre_nome=(
                    semestre_nome
                ),

                semestre_ano=(
                    semestre_ano
                ),

                # --------------------------------------------
                # TRIMESTRE
                # --------------------------------------------

                trimestre=trimestre,

                trimestre_nome=(
                    trimestre_nome
                ),

                trimestre_ano=(
                    trimestre_ano
                ),

                # --------------------------------------------
                # MÊS
                # --------------------------------------------

                mes_numero=mes,

                mes_nome=(
                    mes_nome
                ),

                mes_abreviado=(
                    mes_abreviado
                ),

                mes_ano=(
                    f"{mes_abreviado}/{ano}"
                ),

                ano_mes=(
                    f"{ano}-{mes:02d}"
                ),

                ano_mes_numero=(
                    ano_mes_numero
                ),

                # --------------------------------------------
                # DIA
                #
                # dia_mes representa o dia corrido do mês.
                # Exemplo: 11/08/2026 -> 11.
                #
                # dia_util_numero é calculado depois, mês a mês,
                # considerando apenas os dias efetivamente úteis.
                # --------------------------------------------

                dia_mes=dia,

                dia_ano=dia_ano,

                data_formatada=(
                    data_atual.strftime(
                        "%d/%m/%Y"
                    )
                ),

                # --------------------------------------------
                # DIA DA SEMANA
                # --------------------------------------------

                dia_semana_numero=(
                    dia_semana_numero
                ),

                dia_semana_nome=(
                    dia_semana_nome
                ),

                dia_semana_abreviado=(
                    dia_semana_abreviado
                ),

                # --------------------------------------------
                # SEMANA
                # --------------------------------------------

                semana_ano=(
                    semana_ano
                ),

                semana_mes=(
                    semana_mes
                ),

                # --------------------------------------------
                # INFORMAÇÕES DO MÊS
                # --------------------------------------------

                primeiro_dia_mes=(
                    competencia
                ),

                ultimo_dia_mes=(
                    ultimo_dia_mes
                ),

                total_dias_mes=(
                    ultimo_dia_numero
                ),

                # --------------------------------------------
                # CLASSIFICAÇÃO
                # --------------------------------------------

                fim_semana=(
                    fim_semana
                ),

                feriado=False,

                dia_util=(
                    dia_util
                ),

                # O sequencial e o total do mês são preenchidos
                # no recálculo executado após a criação/atualização.
                dia_util_numero=None,

                total_dias_uteis_mes=None,

                tipo_dia=(
                    tipo_dia
                ),

                # --------------------------------------------
                # FERIADO / EXCEÇÕES
                # --------------------------------------------

                descricao=None,

                abrangencia="EMPRESA",

                uf=None,

                municipio=None,

                observacao=None,
            )

            registros.append(
                registro
            )

            data_atual += timedelta(days=1)

        # ====================================================
        # GRAVA NOVAS DATAS E RECALCULA DIAS ÚTEIS
        # ====================================================
        #
        # IMPORTANTE:
        # Mesmo quando nenhuma data nova for criada, o comando
        # continua e recalcula os registros existentes. Isso é
        # necessário para corrigir/backfill de dia_util_numero e
        # total_dias_uteis_mes.
        # ====================================================

        if not registros:
            self.stdout.write(
                self.style.WARNING(
                    "Todas as datas do período solicitado "
                    "já existem."
                )
            )

            self.stdout.write(
                self.style.WARNING(
                    "Nenhum novo registro será criado, mas os "
                    "dias úteis serão recalculados."
                )
            )

        try:
            with transaction.atomic():
                if registros:
                    CalendarioUtil.objects.bulk_create(
                        registros,
                        batch_size=1000,
                    )

                (
                    total_registros_recalculados,
                    total_competencias_recalculadas,
                ) = self._recalcular_dias_uteis(
                    data_inicial,
                    data_final,
                )

        except Exception as exc:
            raise CommandError(
                f"Erro ao gravar/recalcular calendário: {exc}"
            )

        # ====================================================
        # RESULTADO
        # ====================================================

        total = (
            CalendarioUtil.objects.count()
        )

        primeira_data = (
            CalendarioUtil.objects
            .order_by("data")
            .values_list(
                "data",
                flat=True,
            )
            .first()
        )

        ultima_data = (
            CalendarioUtil.objects
            .order_by("-data")
            .values_list(
                "data",
                flat=True,
            )
            .first()
        )

        total_uteis = (
            CalendarioUtil.objects.filter(
                dia_util=True
            ).count()
        )

        total_nao_uteis = (
            CalendarioUtil.objects.filter(
                dia_util=False
            ).count()
        )

        # ====================================================
        # EXIBE RESULTADO
        # ====================================================

        self.stdout.write("")

        self.stdout.write(
            self.style.SUCCESS(
                "============================================"
            )
        )

        self.stdout.write(
            self.style.SUCCESS(
                " CALENDÁRIO GERADO COM SUCESSO"
            )
        )

        self.stdout.write(
            self.style.SUCCESS(
                "============================================"
            )
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"Novas datas criadas: "
                f"{len(registros)}"
            )
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"Registros com DU recalculado: "
                f"{total_registros_recalculados}"
            )
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"Competências recalculadas: "
                f"{total_competencias_recalculadas}"
            )
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"Total na tabela: "
                f"{total}"
            )
        )

        if primeira_data:
            self.stdout.write(
                f"Primeira data: "
                f"{primeira_data.strftime('%d/%m/%Y')}"
            )

        if ultima_data:
            self.stdout.write(
                f"Última data:   "
                f"{ultima_data.strftime('%d/%m/%Y')}"
            )

        self.stdout.write(
            f"Dias úteis iniciais: "
            f"{total_uteis}"
        )

        self.stdout.write(
            f"Dias não úteis iniciais: "
            f"{total_nao_uteis}"
        )

        self.stdout.write("")

        self.stdout.write(
            self.style.WARNING(
                "IMPORTANTE:"
            )
        )

        self.stdout.write(
            "Nesta etapa apenas sábados e domingos "
            "foram classificados como não úteis."
        )

        self.stdout.write(
            "Os feriados serão cadastrados "
            "na próxima etapa."
        )

        self.stdout.write("")