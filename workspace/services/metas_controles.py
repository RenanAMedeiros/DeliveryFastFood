"""Dados do Dashboard de Produção e Metas.

Fontes permitidas neste dashboard:
1. Query operacional baseada em dbo.workspace_producaocarteira e nos joins
   definidos pelo dashboard.
2. dbo.workspace_calendarioutil como única dimensão oficial de tempo.

Não existe leitura de Excel, CSV, DE/PARA ou fallback de calendário.
"""

from __future__ import annotations

from collections import OrderedDict
from datetime import date, datetime
from decimal import Decimal

from django.db import connection
from django.utils import timezone


SQL_PRODUCAO = r"""
SELECT
    wp.id,
    wp.data_producao,
    wp.criado_em,
    wp.atualizado_em,
    wp.quantidade_base,
    wp.valor_carteira,
    wp.entrega_amigavel,
    wp.producao_realizada,
    wp.pagamento,
    wp.valor_ho,

    cc.id AS carteira_id,
    cc.nome AS nome_carteira,
    cc.tipo AS tipo_carteira,
    cc.producao AS producao_carteira,
    cc.atuacao_carteira AS atuacao_carteira,

    CASE
        WHEN cc.digital = 1 THEN 'Sim'
        WHEN cc.digital = 0 THEN 'Não'
        ELSE 'Não informado'
    END AS carteira_digital,

    cc.empresa_id AS empresa_id,
    emp.nome AS nome_empresa,

    meta.competencia AS competencia_meta,
    meta.valor_meta AS valor_meta,

    coord.nome AS nome_coordenador,
    ger.nome AS nome_gerente,
    sup.nome AS nome_superintendente,
    dir.nome AS nome_diretor

FROM dbo.workspace_producaocarteira AS wp

INNER JOIN dbo.customauth_carteira AS cc
    ON wp.carteira_id = cc.id

LEFT JOIN dbo.customauth_empresa_filtro AS emp
    ON cc.empresa_id = emp.id

LEFT JOIN dbo.workspace_metacarteiramensal AS meta
    ON meta.carteira_id = cc.id
   AND YEAR(meta.competencia) = YEAR(wp.data_producao)
   AND MONTH(meta.competencia) = MONTH(wp.data_producao)

LEFT JOIN dbo.customauth_customuser AS coord
    ON cc.coordenador_id = coord.id

LEFT JOIN dbo.customauth_customuser AS ger
    ON cc.gerente_id = ger.id

LEFT JOIN dbo.customauth_customuser AS sup
    ON cc.superintendente_id = sup.id

LEFT JOIN dbo.customauth_customuser AS dir
    ON cc.diretor_id = dir.id

ORDER BY
    wp.data_producao,
    wp.id;
"""


SQL_CALENDARIO_MES = r"""
SELECT
    cal.data,
    cal.data_chave,
    cal.competencia,
    cal.ano,
    cal.semestre,
    cal.semestre_nome,
    cal.semestre_ano,
    cal.trimestre,
    cal.trimestre_nome,
    cal.trimestre_ano,
    cal.mes_numero,
    cal.mes_nome,
    cal.mes_abreviado,
    cal.mes_ano,
    cal.ano_mes,
    cal.ano_mes_numero,
    cal.dia_mes,
    cal.dia_ano,
    cal.data_formatada,
    cal.dia_semana_numero,
    cal.dia_semana_nome,
    cal.dia_semana_abreviado,
    cal.semana_ano,
    cal.semana_mes,
    cal.primeiro_dia_mes,
    cal.ultimo_dia_mes,
    cal.total_dias_mes,
    cal.fim_semana,
    cal.feriado,
    cal.dia_util,
    cal.tipo_dia,
    cal.descricao,
    cal.abrangencia,
    cal.uf,
    cal.municipio,
    cal.observacao
FROM dbo.workspace_calendarioutil AS cal
WHERE cal.ano_mes_numero BETWEEN %s AND %s
ORDER BY cal.data;
"""


SQL_MES_DA_DATA = r"""
SELECT TOP 1 ano_mes_numero
FROM dbo.workspace_calendarioutil
WHERE data = %s;
"""


class DashboardMetasErro(RuntimeError):
    pass


def _buscar_dicts(sql, parametros=None):
    with connection.cursor() as cursor:
        cursor.execute(sql, parametros or [])
        colunas = [col[0] for col in cursor.description]
        return [dict(zip(colunas, row)) for row in cursor.fetchall()]


def _buscar_valor(sql, parametros=None):
    with connection.cursor() as cursor:
        cursor.execute(sql, parametros or [])
        row = cursor.fetchone()
        return row[0] if row else None


def _iso_data(valor):
    if valor is None:
        return None
    if isinstance(valor, datetime):
        valor = valor.date()
    if isinstance(valor, date):
        return valor.isoformat()
    texto = str(valor).strip()
    return texto[:10] if texto else None


def _iso_datetime(valor):
    if valor is None:
        return None
    if isinstance(valor, datetime):
        return valor.isoformat(timespec="seconds")
    return str(valor)


def _numero(valor):
    if valor is None:
        return 0.0
    if isinstance(valor, Decimal):
        return float(valor)
    try:
        return float(valor)
    except (TypeError, ValueError):
        return 0.0


def _inteiro(valor):
    if valor is None:
        return None
    try:
        return int(valor)
    except (TypeError, ValueError):
        return None


def _texto(valor, padrao="Não informado"):
    if valor is None:
        return padrao
    texto = str(valor).strip()
    return texto or padrao


def _lista_unica(registros, campo):
    valores = {
        _texto(item.get(campo))
        for item in registros
        if _texto(item.get(campo)) != "Não informado"
    }
    return sorted(valores, key=lambda x: x.casefold())


def _mes_numero_da_data(data_ref):
    valor = _buscar_valor(SQL_MES_DA_DATA, [data_ref])
    if valor is None:
        raise DashboardMetasErro(
            f"A data {data_ref.isoformat()} não existe em dbo.workspace_calendarioutil."
        )
    return int(valor)


def _montar_calendario(linhas, data_inicio, data_fim, hoje):
    """
    Monta a dimensão temporal exclusivamente a partir de
    dbo.workspace_calendarioutil.

    IMPORTANTE:
    O schema atual não possui as colunas dia_util_numero e
    total_dias_uteis_mes. Portanto, esses dois atributos são derivados
    SOMENTE das linhas oficiais do calendário:

    - dia_util_numero:
      contagem sequencial dos registros onde dia_util = 1 dentro do mês.

    - total_dias_uteis_mes:
      quantidade total de registros onde dia_util = 1 dentro do mês.

    Não existe cálculo por segunda/sexta no Python ou JavaScript.
    A única regra utilizada é o próprio campo cal.dia_util.
    """
    if not linhas:
        raise DashboardMetasErro(
            "Nenhuma linha de calendário foi encontrada para o período do dashboard."
        )

    # ------------------------------------------------------------
    # 1. Agrupa as linhas por competência/mês.
    # ------------------------------------------------------------
    linhas_por_mes = OrderedDict()

    for linha in linhas:
        chave = _texto(linha.get("ano_mes"), "")
        if not chave:
            raise DashboardMetasErro(
                "Foi encontrada linha em dbo.workspace_calendarioutil sem ano_mes."
            )

        linhas_por_mes.setdefault(chave, []).append(linha)

    # ------------------------------------------------------------
    # 2. Calcula D.U. e total de D.U. usando SOMENTE cal.dia_util.
    # ------------------------------------------------------------
    du_por_data = {}
    total_du_por_mes = {}

    for chave, linhas_mes in linhas_por_mes.items():
        contador_du = 0

        for linha in linhas_mes:
            data_iso = _iso_data(linha.get("data"))

            if bool(linha.get("dia_util")):
                contador_du += 1
                du_por_data[data_iso] = contador_du
            else:
                du_por_data[data_iso] = None

        total_du_por_mes[chave] = contador_du

    # ------------------------------------------------------------
    # 3. Constrói os objetos consumidos pelo dashboard.
    # ------------------------------------------------------------
    datas = []
    por_data = {}
    meses = OrderedDict()

    for linha in linhas:
        data_iso = _iso_data(linha["data"])
        chave = _texto(linha.get("ano_mes"), "")
        total_dias_uteis_mes = total_du_por_mes.get(chave, 0)
        dia_util_numero = du_por_data.get(data_iso)

        item = {
            "data": data_iso,
            "data_chave": _inteiro(linha.get("data_chave")),
            "competencia": _iso_data(linha.get("competencia")),
            "ano": _inteiro(linha.get("ano")),
            "semestre": _inteiro(linha.get("semestre")),
            "semestre_nome": _texto(linha.get("semestre_nome"), ""),
            "semestre_ano": _texto(linha.get("semestre_ano"), ""),
            "trimestre": _inteiro(linha.get("trimestre")),
            "trimestre_nome": _texto(linha.get("trimestre_nome"), ""),
            "trimestre_ano": _texto(linha.get("trimestre_ano"), ""),
            "mes_numero": _inteiro(linha.get("mes_numero")),
            "mes_nome": _texto(linha.get("mes_nome"), ""),
            "mes_abreviado": _texto(linha.get("mes_abreviado"), ""),
            "mes_ano": _texto(linha.get("mes_ano"), ""),
            "ano_mes": chave,
            "ano_mes_numero": _inteiro(linha.get("ano_mes_numero")),
            "dia_mes": _inteiro(linha.get("dia_mes")),
            "dia_ano": _inteiro(linha.get("dia_ano")),
            "data_formatada": _texto(linha.get("data_formatada"), ""),
            "dia_semana_numero": _inteiro(linha.get("dia_semana_numero")),
            "dia_semana_nome": _texto(linha.get("dia_semana_nome"), ""),
            "dia_semana_abreviado": _texto(
                linha.get("dia_semana_abreviado"),
                "",
            ),
            "semana_ano": _inteiro(linha.get("semana_ano")),
            "semana_mes": _inteiro(linha.get("semana_mes")),
            "primeiro_dia_mes": _iso_data(linha.get("primeiro_dia_mes")),
            "ultimo_dia_mes": _iso_data(linha.get("ultimo_dia_mes")),
            "total_dias_mes": _inteiro(linha.get("total_dias_mes")) or 0,
            "fim_semana": bool(linha.get("fim_semana")),
            "feriado": bool(linha.get("feriado")),
            "dia_util": bool(linha.get("dia_util")),
            "tipo_dia": _texto(linha.get("tipo_dia"), ""),
            "descricao": _texto(linha.get("descricao"), ""),
            "abrangencia": _texto(linha.get("abrangencia"), ""),
            "uf": _texto(linha.get("uf"), ""),
            "municipio": _texto(linha.get("municipio"), ""),
            "observacao": _texto(linha.get("observacao"), ""),

            # Campos derivados exclusivamente da tabela calendário.
            "dia_util_numero": dia_util_numero,
            "total_dias_uteis_mes": total_dias_uteis_mes,
        }

        datas.append(item)
        por_data[data_iso] = item

        if chave not in meses:
            meses[chave] = {
                "chave": chave,
                "rotulo": item["mes_ano"] or chave,
                "ano": item["ano"],
                "mes_numero": item["mes_numero"],
                "ano_mes_numero": item["ano_mes_numero"],
                "primeiro_dia": (
                    item["primeiro_dia_mes"]
                    or data_iso
                ),
                "ultimo_dia": (
                    item["ultimo_dia_mes"]
                    or data_iso
                ),
                "total_dias_mes": item["total_dias_mes"],
                "total_dias_uteis": total_dias_uteis_mes,
                "dias_uteis": [],
            }

        if item["dia_util"] and dia_util_numero is not None:
            meses[chave]["dias_uteis"].append(
                {
                    "data": data_iso,
                    "dia_util_numero": dia_util_numero,
                    "dia_mes": item["dia_mes"],
                    "dia_semana_nome": item["dia_semana_nome"],
                }
            )

    hoje_iso = hoje.isoformat()
    hoje_cal = por_data.get(hoje_iso)

    return {
        "datas": datas,
        "por_data": por_data,
        "meses": list(meses.values()),
        "data_min": data_inicio.isoformat(),
        "data_max": data_fim.isoformat(),
        "hoje": hoje_cal,
    }


def montar_dashboard_metas(_filtros=None, *args, **kwargs):
    """Retorna o snapshot completo usado pelo JavaScript do dashboard.

    O parâmetro opcional existe apenas por compatibilidade com views antigas
    que ainda chamam montar_dashboard_metas(filtros). Nenhum filtro recebido
    aqui é usado: o dashboard carrega o snapshot completo e filtra no JS.
    """
    linhas_producao = _buscar_dicts(SQL_PRODUCAO)
    hoje = timezone.localdate()

    datas_fato = [
        linha["data_producao"].date()
        if isinstance(linha.get("data_producao"), datetime)
        else linha.get("data_producao")
        for linha in linhas_producao
        if linha.get("data_producao") is not None
    ]
    datas_fato = [d for d in datas_fato if isinstance(d, date)]

    if datas_fato:
        data_inicio_fato = min(datas_fato)
        data_fim_fato = max(datas_fato)
        data_fim = max(data_fim_fato, hoje)
    else:
        data_inicio_fato = hoje
        data_fim = hoje

    mes_inicio = _mes_numero_da_data(data_inicio_fato)
    mes_fim = _mes_numero_da_data(data_fim)

    linhas_calendario = _buscar_dicts(SQL_CALENDARIO_MES, [mes_inicio, mes_fim])
    calendario = _montar_calendario(
        linhas_calendario,
        data_inicio=data_inicio_fato,
        data_fim=data_fim,
        hoje=hoje,
    )
    calendario_por_data = calendario.pop("por_data")

    registros = []
    metas_map = OrderedDict()
    datas_sem_calendario = set()

    for linha in linhas_producao:
        data_iso = _iso_data(linha.get("data_producao"))
        cal = calendario_por_data.get(data_iso)
        if cal is None:
            datas_sem_calendario.add(data_iso or "NULL")
            continue

        registro = {
            "id": _inteiro(linha.get("id")),
            "data": data_iso,
            "data_producao": data_iso,
            "criado_em": _iso_datetime(linha.get("criado_em")),
            "atualizado_em": _iso_datetime(linha.get("atualizado_em")),
            "quantidade_base": _numero(linha.get("quantidade_base")),
            "valor_carteira": _numero(linha.get("valor_carteira")),
            "entrega_amigavel": _numero(linha.get("entrega_amigavel")),
            "producao_realizada": _numero(linha.get("producao_realizada")),
            "pagamento": _numero(linha.get("pagamento")),
            "valor_ho": _numero(linha.get("valor_ho")),
            "carteira_id": _inteiro(linha.get("carteira_id")),
            "carteira": _texto(linha.get("nome_carteira")),
            "tipo_carteira": _texto(linha.get("tipo_carteira")),
            "producao_carteira": _texto(linha.get("producao_carteira")),
            "atuacao_carteira": _texto(linha.get("atuacao_carteira")),
            "digital": _texto(linha.get("carteira_digital")),
            "empresa_id": _inteiro(linha.get("empresa_id")),
            "empresa": _texto(linha.get("nome_empresa")),
            "competencia_meta": _iso_data(linha.get("competencia_meta")),
            "valor_meta": _numero(linha.get("valor_meta")),
            "coordenador": _texto(linha.get("nome_coordenador")),
            "gerente": _texto(linha.get("nome_gerente")),
            "superintendente": _texto(linha.get("nome_superintendente")),
            "diretor": _texto(linha.get("nome_diretor")),
            "ano": cal["ano"],
            "mes_numero": cal["mes_numero"],
            "mes_nome": cal["mes_nome"],
            "mes_ano": cal["mes_ano"],
            "mes": cal["ano_mes"],
            "ano_mes_numero": cal["ano_mes_numero"],
            "dia_mes": cal["dia_mes"],
            "dia_semana_nome": cal["dia_semana_nome"],
            "dia_util": cal["dia_util"],
            "dia_util_numero": cal["dia_util_numero"],
            "total_dias_uteis_mes": cal["total_dias_uteis_mes"],
        }
        registros.append(registro)

        if registro["competencia_meta"]:
            chave_meta = (registro["carteira_id"], registro["competencia_meta"])
            if chave_meta not in metas_map:
                metas_map[chave_meta] = {
                    "carteira_id": registro["carteira_id"],
                    "carteira": registro["carteira"],
                    "empresa_id": registro["empresa_id"],
                    "empresa": registro["empresa"],
                    "tipo_carteira": registro["tipo_carteira"],
                    "producao_carteira": registro["producao_carteira"],
                    "atuacao_carteira": registro["atuacao_carteira"],
                    "digital": registro["digital"],
                    "superintendente": registro["superintendente"],
                    "gerente": registro["gerente"],
                    "coordenador": registro["coordenador"],
                    "diretor": registro["diretor"],
                    "competencia": registro["competencia_meta"],
                    "mes": registro["mes"],
                    "mes_ano": registro["mes_ano"],
                    "meta": registro["valor_meta"],
                }

    if datas_sem_calendario:
        amostra = ", ".join(sorted(datas_sem_calendario)[:10])
        raise DashboardMetasErro(
            "Existem datas de produção sem correspondência em "
            f"dbo.workspace_calendarioutil: {amostra}"
        )

    atualizado_em = timezone.localtime().strftime("%d/%m/%Y %H:%M:%S")

    return {
        "erro": False,
        "fonte": "Banco Workspace • query operacional + calendário oficial",
        "atualizado_em": atualizado_em,
        "periodo": {
            "data_inicio": data_inicio_fato.isoformat(),
            "data_fim": data_fim.isoformat(),
        },
        "hoje": calendario.get("hoje") or {},
        "calendario": {
            "data_min": calendario["data_min"],
            "data_max": calendario["data_max"],
            "meses": calendario["meses"],
            "datas": calendario["datas"],
        },
        "opcoes": {
            "tipos_carteira": _lista_unica(registros, "tipo_carteira"),
            "producoes_carteira": _lista_unica(registros, "producao_carteira"),
            "digitais": _lista_unica(registros, "digital"),
            "empresas": _lista_unica(registros, "empresa"),
            "carteiras": _lista_unica(registros, "carteira"),
            "atuacoes_carteira": _lista_unica(registros, "atuacao_carteira"),
            "superintendentes": _lista_unica(registros, "superintendente"),
            "gerentes": _lista_unica(registros, "gerente"),
            "coordenadores": _lista_unica(registros, "coordenador"),
        },
        "registros": registros,
        "metas": list(metas_map.values()),
    }
