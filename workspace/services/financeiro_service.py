import html
import json
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timedelta
from decimal import Decimal
from urllib.parse import unquote_plus

import pandas as pd
from django.core.cache import cache
from django.db import close_old_connections, connections


# ============================================================
# CONFIGURAÇÕES
# ============================================================

DB_AUXILIAR = "processamento_auxiliar"
DB_GERAL = "processamento"
DB_C6 = "processamento_c6"
DB_SANTANDER = "processamento_santander"

CLASSE_RG_AUTOMOVEL = "RGdoAutomovelAPIDadosBemService"
STATUS_FINANCEIRO = "200"

VALOR_DADOS_ESTADUAIS = Decimal("2.15")
VALOR_GRAVAME = Decimal("4.70")
VALOR_PRECIFICADOR = Decimal("1.45")
VALOR_RPA_MENSALIDADE = Decimal("850.50")

CACHE_PREFIX = "financeiro:v3"
CACHE_TIMEOUT_MES_ATUAL = 60
CACHE_TIMEOUT_PERIODO_FECHADO = 900

COLUNAS_FINAIS = [
    "ID_CONTR",
    "NOME_EMPRESA",
    "NOME_CARTEIRA",
    "DATA_CLASSE",
    "CLASSE",
    "METODO",
    "PROCESSADO",
    "STATUS_RETORNO",
    "ENTRADA",
    "EXCEPTION",
    "STACKTRACE",
]

COLUNAS_INTERNAS = [
    *COLUNAS_FINAIS,
    "ENVIO",
]


# ============================================================
# DATAS
# ============================================================

def _normalizar_data(valor):
    if isinstance(valor, datetime):
        return valor.date()

    if isinstance(valor, date):
        return valor

    if isinstance(valor, str):
        return datetime.strptime(
            valor.strip(),
            "%Y-%m-%d",
        ).date()

    raise ValueError(
        "Data inválida para consulta financeira."
    )


def _preparar_periodo(
    data_inicial,
    data_final,
):
    inicio = _normalizar_data(
        data_inicial
    )

    fim = _normalizar_data(
        data_final
    )

    if fim < inicio:
        raise ValueError(
            "A data final não pode ser menor "
            "que a data inicial."
        )

    fim_exclusivo = (
        fim + timedelta(days=1)
    )

    return (
        inicio,
        fim,
        fim_exclusivo,
    )


# ============================================================
# BANCO
# ============================================================

def _fetchall_dict(
    alias,
    sql,
    params=None,
):
    params = params or []

    with connections[alias].cursor() as cursor:
        cursor.execute(
            sql,
            params,
        )

        colunas = [
            coluna[0]
            for coluna
            in cursor.description
        ]

        return [
            dict(
                zip(
                    colunas,
                    linha,
                )
            )
            for linha
            in cursor.fetchall()
        ]


# ============================================================
# ENTRADA
# ============================================================

def _limpar_valor(valor):
    if valor is None:
        return None

    texto = str(valor).strip()

    valores_invalidos = {
        "",
        "null",
        "none",
        "undefined",
        "nil",
    }

    if texto.lower() in valores_invalidos:
        return None

    return texto


def _buscar_chave_json(
    objeto,
    chaves,
):
    if isinstance(objeto, dict):

        for chave, valor in objeto.items():

            if (
                str(chave).strip().lower()
                in chaves
            ):
                valor_limpo = (
                    _limpar_valor(valor)
                )

                if valor_limpo:
                    return valor_limpo

            encontrado = _buscar_chave_json(
                valor,
                chaves,
            )

            if encontrado:
                return encontrado

    elif isinstance(objeto, list):

        for item in objeto:

            encontrado = _buscar_chave_json(
                item,
                chaves,
            )

            if encontrado:
                return encontrado

    return None


def _buscar_por_regex(
    texto,
):
    padroes = [
        r'pstrPlaca\s*=\s*["\']?([^"\'&,;\s}<]+)',
        r'pstrChassi\s*=\s*["\']?([^"\'&,;\s}<]+)',
        r'["\']?pstrPlaca["\']?\s*:\s*["\']?([^"\'&,;\s}<]+)',
        r'["\']?pstrChassi["\']?\s*:\s*["\']?([^"\'&,;\s}<]+)',
    ]

    encontrados = []

    for padrao in padroes:

        match = re.search(
            padrao,
            texto,
            flags=re.IGNORECASE,
        )

        if match:

            valor = _limpar_valor(
                match.group(1)
            )

            if (
                valor
                and valor not in encontrados
            ):
                encontrados.append(
                    valor
                )

    if encontrados:
        return " | ".join(
            encontrados
        )

    return None


def _extrair_entrada(valor_envio):
    valor = _limpar_valor(
        valor_envio
    )

    if not valor:
        return None

    texto = html.unescape(
        valor
    )

    try:
        texto_decodificado = (
            unquote_plus(
                texto
            )
        )
    except Exception:
        texto_decodificado = texto

    chaves_placa = {
        "pstrplaca",
        "placa",
    }

    chaves_chassi = {
        "pstrchassi",
        "chassi",
    }

    placa = None
    chassi = None

    candidatos = [
        texto,
        texto_decodificado,
        (
            texto_decodificado
            .replace('\\"', '"')
            .replace("\\'", "'")
        ),
    ]

    for candidato in candidatos:

        try:

            objeto = json.loads(
                candidato
            )

            if not placa:
                placa = _buscar_chave_json(
                    objeto,
                    chaves_placa,
                )

            if not chassi:
                chassi = _buscar_chave_json(
                    objeto,
                    chaves_chassi,
                )

        except Exception:
            pass

        if placa and chassi:
            break

    if not placa or not chassi:

        encontrado_regex = (
            _buscar_por_regex(
                texto_decodificado
            )
        )

        if encontrado_regex:
            return encontrado_regex

    entradas = []

    if placa:
        entradas.append(
            placa
        )

    if chassi:
        entradas.append(
            chassi
        )

    return " | ".join(
        entradas
    )


# ============================================================
# BASE GERAL
# ============================================================

def _consultar_logs_auxiliar(
    data_inicial,
    data_final_exclusiva,
):
    sql = """
        SELECT
            LCW.ID_CONTR,
            LCW.DATA AS DATA_CLASSE,
            LCW.CLASSE,
            LCW.METODO,
            LCW.STATUS_RETORNO,
            LCW.ENVIO,
            LCW.EXCEPTION
        FROM LOG_COM_WS LCW
        WHERE
            LCW.CLASSE = %s
            AND LCW.DATA >= %s
            AND LCW.DATA < %s
        ;
    """

    return _fetchall_dict(
        DB_AUXILIAR,
        sql,
        [
            CLASSE_RG_AUTOMOVEL,
            data_inicial,
            data_final_exclusiva,
        ],
    )


def _consultar_contratos_geral(
    ids_contr,
):
    ids = list(
        dict.fromkeys(
            [
                item
                for item
                in ids_contr
                if item is not None
            ]
        )
    )

    if not ids:
        return []

    registros = []

    tamanho_lote = 1000

    for inicio in range(
        0,
        len(ids),
        tamanho_lote,
    ):
        lote = ids[
            inicio:
            inicio + tamanho_lote
        ]

        placeholders = ",".join(
            ["%s"] * len(lote)
        )

        sql = f"""
            SELECT
                C.ID_CONTR,
                E.NOME AS NOME_EMPRESA,
                K.NOME AS NOME_CARTEIRA
            FROM CONTRATO C
            LEFT JOIN CARTEIRA K
                ON C.ID_CARTEIRA = K.ID_CARTEIRA
            LEFT JOIN EMPRESA E
                ON K.ID_EMPRESA = E.ID_EMPRESA
            WHERE C.ID_CONTR IN ({placeholders});
        """

        registros.extend(
            _fetchall_dict(
                DB_GERAL,
                sql,
                lote,
            )
        )

    return registros


def _processar_base_geral(
    registros_logs,
    registros_contratos,
):
    if not registros_logs:
        return pd.DataFrame(
            columns=COLUNAS_INTERNAS
        )

    df_logs = pd.DataFrame(
        registros_logs
    )

    if registros_contratos:
        df_contratos = pd.DataFrame(
            registros_contratos
        )

        df = df_logs.merge(
            df_contratos,
            how="left",
            on="ID_CONTR",
        )
    else:
        df = df_logs.copy()
        df["NOME_EMPRESA"] = None
        df["NOME_CARTEIRA"] = None

    # ENTRADA deixa de ser extraída aqui. A operação de JSON/regex
    # é relativamente cara e agora só acontece nas linhas exibidas
    # ou quando um documento completo é realmente solicitado.
    return _normalizar_dataframe(
        df
    )

def _executar_base_geral(
    data_inicial,
    data_final_exclusiva,
):
    registros_logs = (
        _consultar_logs_auxiliar(
            data_inicial,
            data_final_exclusiva,
        )
    )

    if not registros_logs:
        return pd.DataFrame(
            columns=COLUNAS_FINAIS
        )

    ids_contr = [
        registro.get(
            "ID_CONTR"
        )
        for registro
        in registros_logs
        if registro.get(
            "ID_CONTR"
        ) is not None
    ]

    registros_contratos = (
        _consultar_contratos_geral(
            ids_contr
        )
    )

    return _processar_base_geral(
        registros_logs,
        registros_contratos,
    )


# ============================================================
# C6 / SANTANDER
# ============================================================

def _consultar_banco_direto(
    alias,
    data_inicial,
    data_final_exclusiva,
):
    sql = """
        SELECT
            LCW.ID_CONTR,
            E.NOME AS NOME_EMPRESA,
            K.NOME AS NOME_CARTEIRA,
            LCW.DATA AS DATA_CLASSE,
            LCW.CLASSE,
            LCW.METODO,
            LCW.STATUS_RETORNO,
            LCW.ENVIO,
            LCW.EXCEPTION
        FROM LOG_COM_WS LCW
        LEFT JOIN CONTRATO C
            ON LCW.ID_CONTR = C.ID_CONTR
        LEFT JOIN CARTEIRA K
            ON C.ID_CARTEIRA = K.ID_CARTEIRA
        LEFT JOIN EMPRESA E
            ON K.ID_EMPRESA = E.ID_EMPRESA
        WHERE
            LCW.CLASSE = %s
            AND LCW.DATA >= %s
            AND LCW.DATA < %s
        ;
    """

    return _fetchall_dict(
        alias,
        sql,
        [
            CLASSE_RG_AUTOMOVEL,
            data_inicial,
            data_final_exclusiva,
        ],
    )


def _processar_banco_direto(
    registros,
):
    if not registros:
        return pd.DataFrame(
            columns=COLUNAS_INTERNAS
        )

    df = pd.DataFrame(
        registros
    )

    # ENTRADA é extraída somente na serialização da página atual.
    return _normalizar_dataframe(
        df
    )

def _executar_c6(
    data_inicial,
    data_final_exclusiva,
):
    registros = (
        _consultar_banco_direto(
            DB_C6,
            data_inicial,
            data_final_exclusiva,
        )
    )

    return _processar_banco_direto(
        registros
    )


def _executar_santander(
    data_inicial,
    data_final_exclusiva,
):
    registros = (
        _consultar_banco_direto(
            DB_SANTANDER,
            data_inicial,
            data_final_exclusiva,
        )
    )

    return _processar_banco_direto(
        registros
    )


# ============================================================
# NORMALIZAÇÃO
# ============================================================

def _normalizar_dataframe(
    df,
):
    if (
        df is None
        or df.empty
    ):
        return pd.DataFrame(
            columns=COLUNAS_INTERNAS
        )

    df = df.copy()

    for coluna in COLUNAS_INTERNAS:
        if coluna not in df.columns:
            df[coluna] = None

    df = df[
        COLUNAS_INTERNAS
    ]

    if "DATA_CLASSE" in df.columns:
        df["DATA_CLASSE"] = pd.to_datetime(
            df["DATA_CLASSE"],
            errors="coerce",
        )

    if (
        "STATUS_RETORNO" in df.columns
        and "EXCEPTION" in df.columns
    ):
        mascara_status_200 = _mascara_status_200(
            df["STATUS_RETORNO"]
        )
        df.loc[
            mascara_status_200,
            "EXCEPTION",
        ] = "OK"

    return df


def _mascara_status_200(serie):
    if serie is None:
        return pd.Series(dtype=bool)

    texto = (
        serie
        .fillna("")
        .astype(str)
        .str.strip()
        .str.replace(
            r"\.0$",
            "",
            regex=True,
        )
    )

    return texto.eq(
        STATUS_FINANCEIRO
    )

def _eh_status_200(
    valor,
):
    if valor is None:
        return False

    texto = str(
        valor
    ).strip()

    if texto.endswith(
        ".0"
    ):
        texto = texto[:-2]

    return (
        texto
        == STATUS_FINANCEIRO
    )


# ============================================================
# FINANCEIRO
# ============================================================

def _classificar_metodo(
    metodo,
):
    texto = (
        str(
            metodo or ""
        )
        .strip()
        .lower()
    )

    if (
        "binestadual"
        in texto
    ):
        return "binestadual"

    if (
        "gravame"
        in texto
    ):
        return "gravame"

    if (
        "precificador"
        in texto
    ):
        return "precificador"

    return None


def _quantidade_competencias(
    data_inicial,
    data_final,
):
    ano = (
        data_inicial.year
    )

    mes = (
        data_inicial.month
    )

    quantidade = 0

    while (
        ano < data_final.year
        or (
            ano
            == data_final.year
            and mes
            <= data_final.month
        )
    ):
        quantidade += 1

        mes += 1

        if mes == 13:
            mes = 1
            ano += 1

    return quantidade


def _calcular_financeiro(
    df_status_200,
    data_inicial,
    data_final,
):
    quantidades = {
        "binestadual": 0,
        "gravame": 0,
        "precificador": 0,
    }

    if (
        df_status_200 is not None
        and not df_status_200.empty
    ):
        metodos = (
            df_status_200["METODO"]
            .fillna("")
            .astype(str)
            .str.strip()
            .str.lower()
        )

        quantidades["binestadual"] = int(
            metodos.str.contains(
                "binestadual",
                regex=False,
            ).sum()
        )
        quantidades["gravame"] = int(
            metodos.str.contains(
                "gravame",
                regex=False,
            ).sum()
        )
        quantidades["precificador"] = int(
            metodos.str.contains(
                "precificador",
                regex=False,
            ).sum()
        )

    quantidade_rpa = _quantidade_competencias(
        data_inicial,
        data_final,
    )

    itens = [
        {
            "chave": "binestadual",
            "servico": "Dados Estaduais",
            "metodo": "binestadual",
            "tipo": "utilizacao",
            "quantidade": quantidades["binestadual"],
            "valor_unitario": VALOR_DADOS_ESTADUAIS,
        },
        {
            "chave": "gravame",
            "servico": "Gravame",
            "metodo": "gravame",
            "tipo": "utilizacao",
            "quantidade": quantidades["gravame"],
            "valor_unitario": VALOR_GRAVAME,
        },
        {
            "chave": "precificador",
            "servico": "Precificar FIPE",
            "metodo": "precificador",
            "tipo": "utilizacao",
            "quantidade": quantidades["precificador"],
            "valor_unitario": VALOR_PRECIFICADOR,
        },
        {
            "chave": "rpa",
            "servico": "RPA Consultas Lote",
            "metodo": "mensalidade",
            "tipo": "mensalidade",
            "quantidade": quantidade_rpa,
            "valor_unitario": VALOR_RPA_MENSALIDADE,
        },
    ]

    total = Decimal("0.00")

    for item in itens:
        valor_total = (
            Decimal(
                str(item["quantidade"])
            )
            * item["valor_unitario"]
        )
        item["valor_total"] = valor_total
        total += valor_total

    return {
        "servicos": itens,
        "total": total,
    }



# ============================================================
# SERIALIZAÇÃO
# ============================================================

def _normalizar_valor_registro(
    valor,
):
    if valor is None:
        return None

    try:

        if pd.isna(
            valor
        ):
            return None

    except Exception:
        pass

    if isinstance(
        valor,
        pd.Timestamp,
    ):

        if pd.isna(
            valor
        ):
            return None

        return valor.to_pydatetime()

    if hasattr(
        valor,
        "item",
    ):

        try:
            return valor.item()

        except Exception:
            pass

    return valor


def _dataframe_para_registros(
    df,
    extrair_entrada=True,
):
    if (
        df is None
        or df.empty
    ):
        return []

    registros = []

    for origem in df.to_dict(
        orient="records"
    ):
        registro = {}

        if extrair_entrada:
            registro["ENTRADA"] = _extrair_entrada(
                origem.get("ENVIO")
            )

        for coluna in COLUNAS_FINAIS:
            if (
                coluna == "ENTRADA"
                and extrair_entrada
            ):
                continue

            registro[coluna] = _normalizar_valor_registro(
                origem.get(coluna)
            )

        registros.append(
            registro
        )

    return registros


def _cache_key(
    inicio,
    fim,
):
    return (
        f"{CACHE_PREFIX}:"
        f"{inicio.strftime('%Y%m%d')}:"
        f"{fim.strftime('%Y%m%d')}"
    )


def _cache_timeout(
    fim,
):
    hoje = date.today()
    primeiro_dia_mes_atual = hoje.replace(
        day=1
    )

    if fim >= primeiro_dia_mes_atual:
        return CACHE_TIMEOUT_MES_ATUAL

    return CACHE_TIMEOUT_PERIODO_FECHADO


def _executar_rotina_isolada(
    chave,
    nome,
    rotina,
    inicio,
    fim_exclusivo,
):
    # Conexões Django são thread-local. Garantimos que cada worker
    # comece e termine com conexões próprias e saudáveis.
    close_old_connections()

    try:
        df = rotina(
            inicio,
            fim_exclusivo,
        )

        return (
            chave,
            nome,
            _normalizar_dataframe(df),
            None,
        )
    except Exception as erro:
        return (
            chave,
            nome,
            pd.DataFrame(
                columns=COLUNAS_INTERNAS
            ),
            erro,
        )
    finally:
        close_old_connections()


def _montar_snapshot(
    inicio,
    fim,
    fim_exclusivo,
):
    erros = []
    resultados = {}

    rotinas = [
        (
            "base_geral",
            "Base Geral",
            _executar_base_geral,
        ),
        (
            "c6",
            "C6",
            _executar_c6,
        ),
        (
            "santander",
            "Santander",
            _executar_santander,
        ),
    ]

    # As bases são independentes: executá-las em paralelo reduz o
    # tempo total para algo próximo da base mais lenta, em vez da soma.
    with ThreadPoolExecutor(
        max_workers=len(rotinas),
        thread_name_prefix="financeiro",
    ) as executor:
        futuros = [
            executor.submit(
                _executar_rotina_isolada,
                chave,
                nome,
                rotina,
                inicio,
                fim_exclusivo,
            )
            for chave, nome, rotina in rotinas
        ]

        for futuro in as_completed(
            futuros
        ):
            (
                chave,
                nome,
                df,
                erro,
            ) = futuro.result()

            resultados[chave] = df

            if erro is not None:
                erros.append(
                    {
                        "base": nome,
                        "erro": str(erro),
                    }
                )

    for chave, _, _ in rotinas:
        resultados.setdefault(
            chave,
            pd.DataFrame(
                columns=COLUNAS_INTERNAS
            ),
        )

    resumo_bases = {
        chave: len(
            resultados[chave]
        )
        for chave, _, _ in rotinas
    }

    dataframes = [
        resultados[chave]
        for chave, _, _ in rotinas
        if not resultados[chave].empty
    ]

    if dataframes:
        consolidado = pd.concat(
            dataframes,
            ignore_index=True,
        )

        consolidado = (
            consolidado
            .sort_values(
                by="DATA_CLASSE",
                ascending=True,
                na_position="last",
                kind="stable",
            )
            .reset_index(
                drop=True
            )
        )
    else:
        consolidado = pd.DataFrame(
            columns=COLUNAS_INTERNAS
        )

    if consolidado.empty:
        mascara_200 = pd.Series(
            False,
            index=consolidado.index,
            dtype=bool,
        )
    else:
        mascara_200 = _mascara_status_200(
            consolidado["STATUS_RETORNO"]
        )

    df_status_200 = consolidado[
        mascara_200
    ].copy()

    df_erros = consolidado[
        ~mascara_200
    ].copy()

    financeiro = _calcular_financeiro(
        df_status_200,
        inicio,
        fim,
    )

    return {
        "resumo_bases": resumo_bases,
        "erros": erros,
        "consolidado": consolidado,
        "df_status_200": df_status_200,
        "df_erros": df_erros,
        "financeiro": financeiro,
        "total_registros": int(
            len(consolidado)
        ),
        "total_status_200": int(
            len(df_status_200)
        ),
        "total_outros_status": int(
            len(df_erros)
        ),
    }


def _obter_snapshot(
    inicio,
    fim,
    fim_exclusivo,
    usar_cache=True,
    forcar_atualizacao=False,
):
    chave_cache = _cache_key(
        inicio,
        fim,
    )

    if (
        usar_cache
        and not forcar_atualizacao
    ):
        try:
            snapshot = cache.get(
                chave_cache
            )
            if snapshot is not None:
                return snapshot
        except Exception:
            pass

    snapshot = _montar_snapshot(
        inicio,
        fim,
        fim_exclusivo,
    )

    if usar_cache:
        try:
            cache.set(
                chave_cache,
                snapshot,
                timeout=_cache_timeout(fim),
            )
        except Exception:
            pass

    return snapshot


def _aplicar_busca(
    df,
    busca,
):
    termo = str(
        busca or ""
    ).strip()

    if not termo or df.empty:
        return df

    mascara = pd.Series(
        False,
        index=df.index,
        dtype=bool,
    )

    colunas_busca = [
        "ID_CONTR",
        "NOME_EMPRESA",
        "NOME_CARTEIRA",
        "METODO",
        "STATUS_RETORNO",
        "EXCEPTION",
        # ENVIO contém placa/chassi em formato bruto e permite
        # pesquisar a entrada sem extrair JSON/regex em todas as linhas.
        "ENVIO",
    ]

    for coluna in colunas_busca:
        if coluna not in df.columns:
            continue

        mascara = mascara | (
            df[coluna]
            .fillna("")
            .astype(str)
            .str.contains(
                termo,
                case=False,
                regex=False,
            )
        )

    if "DATA_CLASSE" in df.columns:
        datas_busca = (
            pd.to_datetime(
                df["DATA_CLASSE"],
                errors="coerce",
            )
            .dt.strftime(
                "%d/%m/%Y %H:%M:%S"
            )
            .fillna("")
        )
        mascara = mascara | (
            datas_busca.str.contains(
                termo,
                case=False,
                regex=False,
            )
        )

    return df[
        mascara
    ].copy()


def _ordenar_dataframe_tela(
    df,
    ordenar_por,
    direcao,
):
    if df.empty:
        return df

    colunas_permitidas = {
        "ID_CONTR",
        "NOME_EMPRESA",
        "NOME_CARTEIRA",
        "DATA_CLASSE",
        "METODO",
        "ENVIO",
        "STATUS_RETORNO",
        "EXCEPTION",
    }

    coluna = (
        ordenar_por
        if ordenar_por in colunas_permitidas
        else "DATA_CLASSE"
    )

    ascendente = str(
        direcao or "asc"
    ).lower() != "desc"

    ordenado = df.copy()

    if coluna in {
        "ID_CONTR",
        "STATUS_RETORNO",
    }:
        ordenado["_FINANCEIRO_SORT"] = pd.to_numeric(
            ordenado[coluna],
            errors="coerce",
        )
    elif coluna == "DATA_CLASSE":
        ordenado["_FINANCEIRO_SORT"] = pd.to_datetime(
            ordenado[coluna],
            errors="coerce",
        )
    else:
        ordenado["_FINANCEIRO_SORT"] = (
            ordenado[coluna]
            .fillna("")
            .astype(str)
            .str.lower()
        )

    ordenado = ordenado.sort_values(
        by="_FINANCEIRO_SORT",
        ascending=ascendente,
        na_position="last",
        kind="stable",
    )

    return ordenado.drop(
        columns=["_FINANCEIRO_SORT"]
    )


def consultar_financeiro(
    data_inicial,
    data_final,
    *,
    incluir_todos_registros=True,
    pagina=1,
    tamanho_pagina=20,
    grupo_status="success",
    busca="",
    ordenar_por="DATA_CLASSE",
    direcao="asc",
    usar_cache=True,
    forcar_atualizacao=False,
):
    (
        inicio,
        fim,
        fim_exclusivo,
    ) = _preparar_periodo(
        data_inicial,
        data_final,
    )

    snapshot = _obter_snapshot(
        inicio,
        fim,
        fim_exclusivo,
        usar_cache=usar_cache,
        forcar_atualizacao=(
            forcar_atualizacao
        ),
    )

    financeiro = snapshot[
        "financeiro"
    ]

    resultado = {
        "sucesso": (
            len(snapshot["erros"]) < 3
        ),
        "data_inicial": inicio.strftime(
            "%Y-%m-%d"
        ),
        "data_final": fim.strftime(
            "%Y-%m-%d"
        ),
        "resumo_bases": snapshot[
            "resumo_bases"
        ],
        "erros": snapshot[
            "erros"
        ],
        "total_registros": snapshot[
            "total_registros"
        ],
        "total_status_200": snapshot[
            "total_status_200"
        ],
        "total_outros_status": snapshot[
            "total_outros_status"
        ],
        "financeiro": financeiro,
        "servicos": financeiro[
            "servicos"
        ],
        "total_financeiro": financeiro[
            "total"
        ],
    }

    if incluir_todos_registros:
        resultado["registros_status_200"] = (
            _dataframe_para_registros(
                snapshot[
                    "df_status_200"
                ]
            )
        )
        resultado["registros_erros"] = (
            _dataframe_para_registros(
                snapshot[
                    "df_erros"
                ]
            )
        )
        # Mantido apenas por compatibilidade; evita terceira
        # serialização completa desnecessária do consolidado.
        resultado["registros"] = []
        return resultado

    grupo = (
        "error"
        if str(grupo_status).lower()
        == "error"
        else "success"
    )

    if grupo == "error":
        df_tela = snapshot[
            "df_erros"
        ].copy()
    else:
        df_tela = snapshot[
            "df_status_200"
        ].copy()

    df_tela = _aplicar_busca(
        df_tela,
        busca,
    )

    df_tela = _ordenar_dataframe_tela(
        df_tela,
        ordenar_por,
        direcao,
    )

    try:
        tamanho = int(
            tamanho_pagina
        )
    except (TypeError, ValueError):
        tamanho = 20

    tamanho = max(
        1,
        min(tamanho, 100),
    )

    total_filtrado = int(
        len(df_tela)
    )

    total_paginas = max(
        1,
        (
            total_filtrado
            + tamanho
            - 1
        ) // tamanho,
    )

    try:
        pagina_atual = int(
            pagina
        )
    except (TypeError, ValueError):
        pagina_atual = 1

    pagina_atual = max(
        1,
        min(
            pagina_atual,
            total_paginas,
        ),
    )

    inicio_indice = (
        pagina_atual - 1
    ) * tamanho

    fim_indice = (
        inicio_indice
        + tamanho
    )

    df_pagina = df_tela.iloc[
        inicio_indice:fim_indice
    ].copy()

    resultado["grupo_status"] = grupo
    resultado["registros_pagina"] = (
        _dataframe_para_registros(
            df_pagina
        )
    )
    resultado["paginacao"] = {
        "pagina": pagina_atual,
        "tamanho_pagina": tamanho,
        "total_filtrado": total_filtrado,
        "total_paginas": total_paginas,
        "tem_anterior": pagina_atual > 1,
        "tem_proxima": (
            pagina_atual < total_paginas
        ),
    }

    return resultado
