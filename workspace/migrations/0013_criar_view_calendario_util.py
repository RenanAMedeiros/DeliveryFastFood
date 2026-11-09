from django.db import migrations


# ============================================================
# VIEW OFICIAL DO CALENDÁRIO ÚTIL
#
# Fonte:
# dbo.workspace_calendarioutil
#
# A VIEW irá calcular dinamicamente:
#
# - numero_dia_util
# - numero_dia_util_referencia
# - total_dias_uteis_mes
# - dias_uteis_restantes
# - percentual_dias_uteis_decorridos
# - percentual_dias_uteis_restantes
# - dia_util_exibicao
# - dia_util_referencia_exibicao
# - primeiro_dia_util_mes
# - ultimo_dia_util_mes
#
# Exemplo:
#
# 07/08/2026
# numero_dia_util = 5
# total_dias_uteis_mes = 21
# dia_util_exibicao = "5 de 21"
#
# ============================================================


VIEW_SQL = r"""
CREATE OR ALTER VIEW dbo.vw_workspace_calendarioutil
AS

WITH Base AS
(
    SELECT
        C.*,

        /* =====================================================
           NÚMERO ACUMULADO DE DIAS ÚTEIS ATÉ A DATA
        ===================================================== */

        SUM(
            CASE
                WHEN C.dia_util = 1 THEN 1
                ELSE 0
            END
        ) OVER (
            PARTITION BY
                C.ano,
                C.mes_numero
            ORDER BY
                C.data
            ROWS BETWEEN
                UNBOUNDED PRECEDING
                AND CURRENT ROW
        ) AS du_acumulado_calculo,


        /* =====================================================
           TOTAL DE DIAS ÚTEIS DO MÊS
        ===================================================== */

        SUM(
            CASE
                WHEN C.dia_util = 1 THEN 1
                ELSE 0
            END
        ) OVER (
            PARTITION BY
                C.ano,
                C.mes_numero
        ) AS total_du_mes_calculo,


        /* =====================================================
           PRIMEIRO DIA ÚTIL DO MÊS
        ===================================================== */

        MIN(
            CASE
                WHEN C.dia_util = 1
                    THEN C.data
                ELSE NULL
            END
        ) OVER (
            PARTITION BY
                C.ano,
                C.mes_numero
        ) AS primeiro_du_mes_calculo,


        /* =====================================================
           ÚLTIMO DIA ÚTIL DO MÊS
        ===================================================== */

        MAX(
            CASE
                WHEN C.dia_util = 1
                    THEN C.data
                ELSE NULL
            END
        ) OVER (
            PARTITION BY
                C.ano,
                C.mes_numero
        ) AS ultimo_du_mes_calculo


    FROM dbo.workspace_calendarioutil AS C
)


SELECT

    /* =========================================================
       DADOS ORIGINAIS DO CALENDÁRIO
    ========================================================= */

    id,

    data,

    data_chave,

    competencia,

    ano,

    semestre,
    semestre_nome,
    semestre_ano,

    trimestre,
    trimestre_nome,
    trimestre_ano,

    mes_numero,
    mes_nome,
    mes_abreviado,
    mes_ano,
    ano_mes,
    ano_mes_numero,

    dia_mes,

    dia_numero,

    dia_ano,

    data_formatada,

    dia_semana_numero,
    dia_semana_nome,
    dia_semana_abreviado,

    semana_ano,
    semana_mes,

    primeiro_dia_mes,
    ultimo_dia_mes,
    total_dias_mes,

    fim_semana,
    feriado,
    dia_util,
    tipo_dia,

    descricao,
    abrangencia,
    uf,
    municipio,
    observacao,

    criado_em,
    atualizado_em,


    /* =========================================================
       NÚMERO DO DIA ÚTIL

       Somente dias úteis recebem número.

       Exemplo:

       03/08 = 1
       04/08 = 2
       05/08 = 3
       06/08 = 4
       07/08 = 5

       Sábado/domingo/feriado = NULL
    ========================================================= */

    CASE
        WHEN dia_util = 1
            THEN du_acumulado_calculo
        ELSE NULL
    END AS numero_dia_util,


    /* =========================================================
       DIA ÚTIL DE REFERÊNCIA

       Esse campo continua com o último DU conhecido,
       mesmo se a data for sábado/domingo/feriado.

       Exemplo:

       07/08 sexta   = 5
       08/08 sábado  = 5
       09/08 domingo = 5
       10/08 segunda = 6
    ========================================================= */

    du_acumulado_calculo
        AS numero_dia_util_referencia,


    /* =========================================================
       TOTAL DE DIAS ÚTEIS DO MÊS
    ========================================================= */

    total_du_mes_calculo
        AS total_dias_uteis_mes,


    /* =========================================================
       DIAS ÚTEIS RESTANTES
    ========================================================= */

    total_du_mes_calculo
        - du_acumulado_calculo
        AS dias_uteis_restantes,


    /* =========================================================
       PERCENTUAL DOS DIAS ÚTEIS DECORRIDOS

       Exemplo:
       5 / 21 = 23,81%
    ========================================================= */

    CAST(
        (
            du_acumulado_calculo * 100.0
        )
        /
        NULLIF(
            total_du_mes_calculo,
            0
        )
        AS DECIMAL(8,2)
    ) AS percentual_dias_uteis_decorridos,


    /* =========================================================
       PERCENTUAL DOS DIAS ÚTEIS RESTANTES
    ========================================================= */

    CAST(
        (
            (
                total_du_mes_calculo
                - du_acumulado_calculo
            ) * 100.0
        )
        /
        NULLIF(
            total_du_mes_calculo,
            0
        )
        AS DECIMAL(8,2)
    ) AS percentual_dias_uteis_restantes,


    /* =========================================================
       EXIBIÇÃO DO DIA ÚTIL

       Exemplo:
       "5 de 21"

       Em dias não úteis fica NULL.
    ========================================================= */

    CASE
        WHEN dia_util = 1
        THEN
            CONCAT(
                CAST(
                    du_acumulado_calculo
                    AS VARCHAR(3)
                ),
                ' de ',
                CAST(
                    total_du_mes_calculo
                    AS VARCHAR(3)
                )
            )

        ELSE NULL
    END AS dia_util_exibicao,


    /* =========================================================
       EXIBIÇÃO DE REFERÊNCIA

       Continua disponível mesmo em sábado/domingo/feriado.

       Exemplo:
       sábado depois do 5º DU -> "5 de 21"
    ========================================================= */

    CONCAT(
        CAST(
            du_acumulado_calculo
            AS VARCHAR(3)
        ),
        ' de ',
        CAST(
            total_du_mes_calculo
            AS VARCHAR(3)
        )
    ) AS dia_util_referencia_exibicao,


    /* =========================================================
       PRIMEIRO DIA ÚTIL DO MÊS
    ========================================================= */

    primeiro_du_mes_calculo
        AS primeiro_dia_util_mes,


    /* =========================================================
       ÚLTIMO DIA ÚTIL DO MÊS
    ========================================================= */

    ultimo_du_mes_calculo
        AS ultimo_dia_util_mes


FROM Base;
"""


# ============================================================
# REVERSÃO DA MIGRATION
#
# Caso algum dia seja feito:
#
# python manage.py migrate workspace 0012
#
# a VIEW será removida.
# ============================================================

DROP_VIEW_SQL = r"""
IF OBJECT_ID(
    'dbo.vw_workspace_calendarioutil',
    'V'
) IS NOT NULL
BEGIN
    DROP VIEW dbo.vw_workspace_calendarioutil;
END;
"""


class Migration(migrations.Migration):

    dependencies = [
        ('workspace', '0012_calendarioutil_dia_numero'),
    ]

    operations = [
        migrations.RunSQL(
            sql=VIEW_SQL,
            reverse_sql=DROP_VIEW_SQL,
        ),
    ]