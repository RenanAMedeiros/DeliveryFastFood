import math
from datetime import (
    date,
    datetime,
    time,
    timedelta,
)
from decimal import Decimal

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django.utils.dateparse import (
    parse_datetime,
)

from workspace.models import (
    FinanceiroCacheRegistro,
    FinanceiroSincronizacao,
)

from workspace.services.financeiro_api_client import (
    extrair_financeiro_api,
)


# ============================================================
# CONFIGURAÇÕES FINANCEIRAS
# ============================================================

STATUS_FINANCEIRO = "200"

VALOR_DADOS_ESTADUAIS = Decimal(
    "2.15"
)

VALOR_GRAVAME = Decimal(
    "4.70"
)

VALOR_PRECIFICADOR = Decimal(
    "1.45"
)

VALOR_RPA_MENSALIDADE = Decimal(
    "850.50"
)


# ============================================================
# DATAS
# ============================================================


def _validar_periodo(
    data_inicial,
    data_final,
):
    if not isinstance(
        data_inicial,
        date,
    ):
        raise ValueError(
            "data_inicial inválida."
        )

    if not isinstance(
        data_final,
        date,
    ):
        raise ValueError(
            "data_final inválida."
        )

    if data_final < data_inicial:
        raise ValueError(
            "A data final não pode ser menor "
            "que a data inicial."
        )


def _datetime_aware(
    valor,
):
    """
    Converte o DATA_CLASSE recebido da API
    para datetime compatível com o Django.
    """

    if valor is None:
        return None

    if isinstance(
        valor,
        datetime,
    ):
        resultado = valor

    else:
        resultado = parse_datetime(
            str(valor)
        )

    if resultado is None:
        raise ValueError(
            f"DATA_CLASSE inválida: {valor}"
        )

    if timezone.is_naive(
        resultado
    ):
        resultado = (
            timezone.make_aware(
                resultado,
                timezone.get_current_timezone(),
            )
        )

    return resultado

def _inicio_periodo(
    data_inicial,
):
    resultado = datetime.combine(
        data_inicial,
        time.min,
    )

    return timezone.make_aware(
        resultado,
        timezone.get_current_timezone(),
    )


def _fim_exclusivo_periodo(
    data_final,
):
    resultado = datetime.combine(
        data_final
        + timedelta(days=1),
        time.min,
    )

    return timezone.make_aware(
        resultado,
        timezone.get_current_timezone(),
    )


# ============================================================
# NORMALIZAÇÃO
# ============================================================


def _texto(
    valor,
    *,
    limite=None,
):
    if valor is None:
        return None

    if isinstance(
        valor,
        (
            bytes,
            bytearray,
            memoryview,
        ),
    ):
        try:
            resultado = bytes(
                valor
            ).decode(
                "utf-8",
                errors="replace",
            ).strip()
        except Exception:
            resultado = str(
                valor
            ).strip()
    else:
        resultado = str(
            valor
        ).strip()

    if resultado in {
        "b''",
        'b""',
    }:
        return None

    if not resultado:
        return None

    if limite:
        resultado = resultado[
            :limite
        ]

    return resultado


def _inteiro(
    valor,
):
    if valor in (
        None,
        "",
    ):
        return None

    try:
        return int(
            valor
        )
    except (
        TypeError,
        ValueError,
    ):
        return None


def _montar_registro_cache(
    registro,
):
    """
    Converte um registro da Financeiro API
    para FinanceiroCacheRegistro.

    ENVIO não é aceito nem armazenado.
    """

    if not isinstance(
        registro,
        dict,
    ):
        raise ValueError(
            "Registro inválido recebido "
            "da Financeiro API."
        )

    data_classe = (
        _datetime_aware(
            registro.get(
                "DATA_CLASSE"
            )
        )
    )

    origem = _texto(
        registro.get(
            "ORIGEM"
        ),
        limite=30,
    )

    if origem not in {
        "base_geral",
        "c6",
        "santander",
    }:
        raise ValueError(
            f"Origem financeira inválida: "
            f"{origem}"
        )

    return FinanceiroCacheRegistro(
        chave_integracao=_texto(
            registro.get(
                "CHAVE_INTEGRACAO"
            ),
            limite=64,
        ),

        origem=origem,

        id_contr=_inteiro(
            registro.get(
                "ID_CONTR"
            )
        ),

        nome_empresa=_texto(
            registro.get(
                "NOME_EMPRESA"
            ),
            limite=255,
        ),

        nome_carteira=_texto(
            registro.get(
                "NOME_CARTEIRA"
            ),
            limite=255,
        ),

        data_classe=(
            data_classe
        ),

        classe=_texto(
            registro.get(
                "CLASSE"
            ),
            limite=255,
        ),

        metodo=_texto(
            registro.get(
                "METODO"
            ),
            limite=100,
        ),

        processado=_texto(
            registro.get(
                "PROCESSADO"
            ),
            limite=100,
        ),

        status_retorno=_texto(
            registro.get(
                "STATUS_RETORNO"
            ),
            limite=50,
        ),

        entrada=_texto(
            registro.get(
                "ENTRADA"
            )
        ),

        exception=_texto(
            registro.get(
                "EXCEPTION"
            )
        ),

        stacktrace=_texto(
            registro.get(
                "STACKTRACE"
            )
        ),
    )


# ============================================================
# CONTROLE DA SINCRONIZAÇÃO
# ============================================================


def _obter_controle():
    controle, _ = (
        FinanceiroSincronizacao
        .objects
        .get_or_create(
            chave="financeiro"
        )
    )

    return controle


def _serializar_controle(
    controle,
):
    return {
        "status": (
            controle.status
        ),

        "origem_execucao": (
            controle.origem_execucao
        ),

        "data_inicial": (
            controle.data_inicial.isoformat()
            if controle.data_inicial
            else None
        ),

        "data_final": (
            controle.data_final.isoformat()
            if controle.data_final
            else None
        ),

        "iniciado_em": (
            controle.iniciado_em.isoformat()
            if controle.iniciado_em
            else None
        ),

        "finalizado_em": (
            controle.finalizado_em.isoformat()
            if controle.finalizado_em
            else None
        ),

        "ultima_sincronizacao_sucesso": (
            controle
            .ultima_sincronizacao_sucesso
            .isoformat()
            if (
                controle
                .ultima_sincronizacao_sucesso
            )
            else None
        ),

        "registros_recebidos": (
            controle.registros_recebidos
        ),

        "registros_gravados": (
            controle.registros_gravados
        ),

        "registros_removidos_periodo": (
            controle
            .registros_removidos_periodo
        ),

        "base_geral": (
            controle.base_geral
        ),

        "base_c6": (
            controle.base_c6
        ),

        "base_santander": (
            controle.base_santander
        ),

        "duracao_api_ms": (
            controle.duracao_api_ms
        ),

        "duracao_total_ms": (
            controle.duracao_total_ms
        ),

        "mensagem": (
            controle.mensagem
        ),
    }


# ============================================================
# SINCRONIZAÇÃO FULL
# ============================================================


def sincronizar_financeiro_periodo(
    *,
    data_inicial,
    data_final,
    origem_execucao="acesso",
):
    """
    Faz FULL do período informado.

    REGRA FUNDAMENTAL:

    Se a API falhar ou alguma base retornar erro,
    o cache atual NÃO é apagado.

    Somente depois de receber um FULL completo
    e válido fazemos a substituição do período.
    """

    _validar_periodo(
        data_inicial,
        data_final,
    )

    origens_validas = {
        "agendamento",
        "acesso",
        "filtro_data",
    }

    if (
        origem_execucao
        not in origens_validas
    ):
        origem_execucao = (
            "acesso"
        )

    controle = (
        _obter_controle()
    )

    inicio_total = (
        timezone.now()
    )

    # ========================================================
    # MARCA INÍCIO
    # ========================================================

    controle.status = (
        FinanceiroSincronizacao
        .STATUS_EM_ANDAMENTO
    )

    controle.origem_execucao = (
        origem_execucao
    )

    controle.data_inicial = (
        data_inicial
    )

    controle.data_final = (
        data_final
    )

    controle.iniciado_em = (
        inicio_total
    )

    controle.finalizado_em = None

    controle.registros_recebidos = 0
    controle.registros_gravados = 0
    controle.registros_removidos_periodo = 0

    controle.base_geral = 0
    controle.base_c6 = 0
    controle.base_santander = 0

    controle.duracao_api_ms = 0
    controle.duracao_total_ms = 0

    controle.mensagem = (
        "Sincronização iniciada."
    )

    controle.save()

    # ========================================================
    # CHAMA API
    # ========================================================

    try:
        retorno = (
            extrair_financeiro_api(
                data_inicial=data_inicial,
                data_final=data_final,
            )
        )

    except Exception as erro:

        finalizado = (
            timezone.now()
        )

        controle.status = (
            FinanceiroSincronizacao
            .STATUS_ERRO
        )

        controle.finalizado_em = (
            finalizado
        )

        controle.duracao_total_ms = int(
            (
                finalizado
                - inicio_total
            ).total_seconds()
            * 1000
        )

        controle.mensagem = (
            f"{type(erro).__name__}: "
            f"{erro}"
        )

        controle.save()

        return {
            "sucesso": False,
            "cache_preservado": True,
            **_serializar_controle(
                controle
            ),
        }

    # ========================================================
    # VALIDA RETORNO
    # ========================================================

    resumo_bases = (
        retorno.get(
            "resumo_bases"
        )
        or {}
    )

    erros_api = (
        retorno.get(
            "erros"
        )
        or []
    )

    registros = (
        retorno.get(
            "registros"
        )
        or []
    )

    controle.registros_recebidos = (
        len(registros)
    )

    controle.base_geral = int(
        resumo_bases.get(
            "base_geral",
            0,
        )
        or 0
    )

    controle.base_c6 = int(
        resumo_bases.get(
            "c6",
            0,
        )
        or 0
    )

    controle.base_santander = int(
        resumo_bases.get(
            "santander",
            0,
        )
        or 0
    )

    controle.duracao_api_ms = int(
        retorno.get(
            "duracao_ms",
            0,
        )
        or 0
    )

    # ========================================================
    # NÃO SUBSTITUI CACHE SE O FULL ESTIVER INCOMPLETO
    # ========================================================

    if (
        not retorno.get(
            "sucesso",
            False,
        )
        or retorno.get(
            "parcial",
            False,
        )
        or erros_api
    ):
        finalizado = (
            timezone.now()
        )

        controle.status = (
            FinanceiroSincronizacao
            .STATUS_PARCIAL
        )

        controle.finalizado_em = (
            finalizado
        )

        controle.duracao_total_ms = int(
            (
                finalizado
                - inicio_total
            ).total_seconds()
            * 1000
        )

        controle.mensagem = (
            "A Financeiro API retornou uma "
            "extração parcial. O cache anterior "
            "foi preservado."
        )

        controle.save()

        return {
            "sucesso": False,
            "parcial": True,
            "cache_preservado": True,
            "erros": erros_api,
            **_serializar_controle(
                controle
            ),
        }

    # ========================================================
    # PREPARA TODOS OS REGISTROS ANTES DE APAGAR O CACHE
    # ========================================================

    try:
        objetos = [
            _montar_registro_cache(
                registro
            )
            for registro
            in registros
        ]

    except Exception as erro:

        finalizado = (
            timezone.now()
        )

        controle.status = (
            FinanceiroSincronizacao
            .STATUS_ERRO
        )

        controle.finalizado_em = (
            finalizado
        )

        controle.duracao_total_ms = int(
            (
                finalizado
                - inicio_total
            ).total_seconds()
            * 1000
        )

        controle.mensagem = (
            "Falha ao preparar dados para "
            "o cache: "
            f"{type(erro).__name__}: "
            f"{erro}"
        )

        controle.save()

        return {
            "sucesso": False,
            "cache_preservado": True,
            **_serializar_controle(
                controle
            ),
        }

    # ========================================================
    # SUBSTITUI SOMENTE O PERÍODO
    # ========================================================

    inicio_periodo = (
        _inicio_periodo(
            data_inicial
        )
    )

    fim_exclusivo = (
        _fim_exclusivo_periodo(
            data_final
        )
    )

    try:

        with transaction.atomic():

            queryset_periodo = (
                FinanceiroCacheRegistro
                .objects
                .filter(
                    data_classe__gte=(
                        inicio_periodo
                    ),
                    data_classe__lt=(
                        fim_exclusivo
                    ),
                )
            )

            removidos = (
                queryset_periodo.count()
            )

            queryset_periodo.delete()

            if objetos:
                (
                    FinanceiroCacheRegistro
                    .objects
                    .bulk_create(
                        objetos,
                        batch_size=1000,
                    )
                )

    except Exception as erro:

        finalizado = (
            timezone.now()
        )

        controle.status = (
            FinanceiroSincronizacao
            .STATUS_ERRO
        )

        controle.finalizado_em = (
            finalizado
        )

        controle.duracao_total_ms = int(
            (
                finalizado
                - inicio_total
            ).total_seconds()
            * 1000
        )

        controle.mensagem = (
            "Falha ao atualizar o cache. "
            "A transação foi revertida: "
            f"{type(erro).__name__}: "
            f"{erro}"
        )

        controle.save()

        return {
            "sucesso": False,
            "cache_preservado": True,
            **_serializar_controle(
                controle
            ),
        }

    # ========================================================
    # SUCESSO
    # ========================================================

    finalizado = (
        timezone.now()
    )

    controle.status = (
        FinanceiroSincronizacao
        .STATUS_SUCESSO
    )

    controle.finalizado_em = (
        finalizado
    )

    controle.ultima_sincronizacao_sucesso = (
        finalizado
    )

    controle.registros_gravados = (
        len(objetos)
    )

    controle.registros_removidos_periodo = (
        removidos
    )

    controle.duracao_total_ms = int(
        (
            finalizado
            - inicio_total
        ).total_seconds()
        * 1000
    )

    controle.mensagem = (
        "Sincronização concluída "
        "com sucesso."
    )

    controle.save()

    return {
        "sucesso": True,
        "cache_preservado": False,
        **_serializar_controle(
            controle
        ),
    }


# ============================================================
# FINANCEIRO
# ============================================================


def _quantidade_competencias(
    data_inicial,
    data_final,
):
    ano = data_inicial.year
    mes = data_inicial.month

    quantidade = 0

    while (
        ano < data_final.year
        or (
            ano == data_final.year
            and mes <= data_final.month
        )
    ):
        quantidade += 1

        mes += 1

        if mes > 12:
            mes = 1
            ano += 1

    return quantidade


def _calcular_financeiro_cache(
    queryset_status_200,
    data_inicial,
    data_final,
):
    metodos = list(
        queryset_status_200
        .values_list(
            "metodo",
            flat=True,
        )
    )

    quantidades = {
        "binestadual": 0,
        "gravame": 0,
        "precificador": 0,
    }

    for metodo in metodos:

        texto = (
            str(
                metodo
                or ""
            )
            .strip()
            .lower()
        )

        if "binestadual" in texto:
            quantidades[
                "binestadual"
            ] += 1

        if "gravame" in texto:
            quantidades[
                "gravame"
            ] += 1

        if "precificador" in texto:
            quantidades[
                "precificador"
            ] += 1

    quantidade_rpa = (
        _quantidade_competencias(
            data_inicial,
            data_final,
        )
    )

    itens = [
        {
            "chave": (
                "binestadual"
            ),
            "servico": (
                "Dados Estaduais"
            ),
            "metodo": (
                "binestadual"
            ),
            "tipo": (
                "utilizacao"
            ),
            "quantidade": (
                quantidades[
                    "binestadual"
                ]
            ),
            "valor_unitario": (
                VALOR_DADOS_ESTADUAIS
            ),
        },
        {
            "chave": (
                "gravame"
            ),
            "servico": (
                "Gravame"
            ),
            "metodo": (
                "gravame"
            ),
            "tipo": (
                "utilizacao"
            ),
            "quantidade": (
                quantidades[
                    "gravame"
                ]
            ),
            "valor_unitario": (
                VALOR_GRAVAME
            ),
        },
        {
            "chave": (
                "precificador"
            ),
            "servico": (
                "Precificar FIPE"
            ),
            "metodo": (
                "precificador"
            ),
            "tipo": (
                "utilizacao"
            ),
            "quantidade": (
                quantidades[
                    "precificador"
                ]
            ),
            "valor_unitario": (
                VALOR_PRECIFICADOR
            ),
        },
        {
            "chave": (
                "rpa"
            ),
            "servico": (
                "RPA Consultas Lote"
            ),
            "metodo": (
                "mensalidade"
            ),
            "tipo": (
                "mensalidade"
            ),
            "quantidade": (
                quantidade_rpa
            ),
            "valor_unitario": (
                VALOR_RPA_MENSALIDADE
            ),
        },
    ]

    total = Decimal(
        "0.00"
    )

    for item in itens:

        valor_total = (
            Decimal(
                str(
                    item[
                        "quantidade"
                    ]
                )
            )
            * item[
                "valor_unitario"
            ]
        )

        item[
            "valor_total"
        ] = valor_total

        total += (
            valor_total
        )

    return {
        "servicos": itens,
        "total": total,
    }


# ============================================================
# SERIALIZAÇÃO DOS REGISTROS
# ============================================================


def _registro_para_dict(
    registro,
):
    return {
        "ID_CONTR": (
            registro.id_contr
        ),

        "NOME_EMPRESA": (
            registro.nome_empresa
        ),

        "NOME_CARTEIRA": (
            registro.nome_carteira
        ),

        "DATA_CLASSE": (
            registro.data_classe.isoformat()
            if registro.data_classe
            else None
        ),

        "CLASSE": (
            registro.classe
        ),

        "METODO": (
            registro.metodo
        ),

        "PROCESSADO": (
            registro.processado
        ),

        "STATUS_RETORNO": (
            registro.status_retorno
        ),

        "ENTRADA": (
            registro.entrada
        ),

        "EXCEPTION": (
            _texto(
                registro.exception
            )
        ),

        "STACKTRACE": (
            _texto(
                registro.stacktrace
            )
        ),

        "ORIGEM": (
            registro.origem
        ),

        "CHAVE_INTEGRACAO": (
            registro.chave_integracao
        ),
    }


# ============================================================
# CONSULTA DO CACHE
# ============================================================


def consultar_financeiro_cache(
    *,
    data_inicial,
    data_final,
    incluir_todos_registros=False,
    grupo_status="success",
    busca="",
    ordenar_por="DATA_CLASSE",
    direcao="desc",
    pagina=1,
    tamanho_pagina=20,
):
    """
    Consulta exclusivamente o banco do Workspace.

    Esta função NÃO chama a Financeiro API.

    Quando incluir_todos_registros=True, devolve também:
    - registros_status_200
    - registros_erros
    - registros (mantido vazio por compatibilidade)

    Esse formato mantém compatibilidade com os serviços de
    Excel/PDF e fechamento já utilizados pelo Financeiro.
    """

    _validar_periodo(
        data_inicial,
        data_final,
    )

    inicio_periodo = (
        _inicio_periodo(
            data_inicial
        )
    )

    fim_exclusivo = (
        _fim_exclusivo_periodo(
            data_final
        )
    )

    base = (
        FinanceiroCacheRegistro
        .objects
        .filter(
            data_classe__gte=(
                inicio_periodo
            ),
            data_classe__lt=(
                fim_exclusivo
            ),
        )
    )

    # ========================================================
    # TOTAIS
    # ========================================================

    total_registros = (
        base.count()
    )

    status_200 = (
        base.filter(
            status_retorno=(
                STATUS_FINANCEIRO
            )
        )
    )

    erros = (
        base.exclude(
            status_retorno=(
                STATUS_FINANCEIRO
            )
        )
    )

    total_status_200 = (
        status_200.count()
    )

    total_outros_status = (
        total_registros
        - total_status_200
    )

    resumo_bases = {
        "base_geral": (
            base
            .filter(
                origem="base_geral"
            )
            .count()
        ),

        "c6": (
            base
            .filter(
                origem="c6"
            )
            .count()
        ),

        "santander": (
            base
            .filter(
                origem="santander"
            )
            .count()
        ),
    }

    # ========================================================
    # VALORES
    # ========================================================

    financeiro = (
        _calcular_financeiro_cache(
            status_200,
            data_inicial,
            data_final,
        )
    )

    controle_sincronizacao = (
        _obter_controle()
    )

    resultado = {
        "sucesso": True,

        # Informativo para a tela.
        # Não dispara sincronização: apenas lê o controle já salvo.
        "sincronizacao": (
            _serializar_controle(
                controle_sincronizacao
            )
        ),

        "data_inicial": (
            data_inicial
            .isoformat()
        ),

        "data_final": (
            data_final
            .isoformat()
        ),

        "resumo_bases": (
            resumo_bases
        ),

        "erros": [],

        "total_registros": (
            total_registros
        ),

        "total_status_200": (
            total_status_200
        ),

        "total_outros_status": (
            total_outros_status
        ),

        "financeiro": (
            financeiro
        ),

        "servicos": (
            financeiro[
                "servicos"
            ]
        ),

        "total_financeiro": (
            financeiro[
                "total"
            ]
        ),
    }

    # ========================================================
    # SNAPSHOT COMPLETO - DOCUMENTOS / FECHAMENTO
    # ========================================================

    if incluir_todos_registros:
        resultado[
            "registros_status_200"
        ] = [
            _registro_para_dict(
                registro
            )
            for registro
            in status_200.order_by(
                "data_classe",
                "id",
            )
        ]

        resultado[
            "registros_erros"
        ] = [
            _registro_para_dict(
                registro
            )
            for registro
            in erros.order_by(
                "data_classe",
                "id",
            )
        ]

        # Mantido por compatibilidade com o Financeiro V1.
        resultado[
            "registros"
        ] = []

        return resultado

    # ========================================================
    # SUCCESS / ERROR
    # ========================================================

    grupo = (
        "error"
        if str(
            grupo_status
        ).lower() == "error"
        else "success"
    )

    if grupo == "error":
        tela = erros

    else:
        tela = status_200

    # ========================================================
    # BUSCA
    # ========================================================

    busca = (
        str(
            busca
            or ""
        ).strip()
    )

    if busca:

        filtro_busca = (
            Q(
                nome_empresa__icontains=(
                    busca
                )
            )
            |
            Q(
                nome_carteira__icontains=(
                    busca
                )
            )
            |
            Q(
                classe__icontains=(
                    busca
                )
            )
            |
            Q(
                metodo__icontains=(
                    busca
                )
            )
            |
            Q(
                status_retorno__icontains=(
                    busca
                )
            )
            |
            Q(
                entrada__icontains=(
                    busca
                )
            )
            |
            Q(
                exception__icontains=(
                    busca
                )
            )
        )

        if busca.isdigit():
            filtro_busca = (
                filtro_busca
                |
                Q(
                    id_contr=int(
                        busca
                    )
                )
            )

        tela = tela.filter(
            filtro_busca
        )

    # ========================================================
    # ORDENAÇÃO
    # ========================================================

    campos_ordenacao = {
        "ID_CONTR": (
            "id_contr"
        ),

        "NOME_EMPRESA": (
            "nome_empresa"
        ),

        "NOME_CARTEIRA": (
            "nome_carteira"
        ),

        "DATA_CLASSE": (
            "data_classe"
        ),

        "CLASSE": (
            "classe"
        ),

        "METODO": (
            "metodo"
        ),

        "PROCESSADO": (
            "processado"
        ),

        "STATUS_RETORNO": (
            "status_retorno"
        ),

        "ENTRADA": (
            "entrada"
        ),

        "EXCEPTION": (
            "exception"
        ),

        "ORIGEM": (
            "origem"
        ),
    }

    campo = campos_ordenacao.get(
        str(
            ordenar_por
            or ""
        ).upper(),
        "data_classe",
    )

    direcao = (
        str(
            direcao
            or ""
        )
        .strip()
        .lower()
    )

    if direcao == "desc":
        campo = (
            f"-{campo}"
        )

    tela = tela.order_by(
        campo,
        "id",
    )

    # ========================================================
    # PAGINAÇÃO
    # ========================================================

    try:
        tamanho = int(
            tamanho_pagina
        )
    except (
        TypeError,
        ValueError,
    ):
        tamanho = 20

    tamanho = max(
        1,
        min(
            tamanho,
            100,
        ),
    )

    total_filtrado = (
        tela.count()
    )

    total_paginas = max(
        1,
        math.ceil(
            total_filtrado
            / tamanho
        )
        if total_filtrado
        else 1,
    )

    try:
        pagina_atual = int(
            pagina
        )
    except (
        TypeError,
        ValueError,
    ):
        pagina_atual = 1

    pagina_atual = max(
        1,
        min(
            pagina_atual,
            total_paginas,
        ),
    )

    inicio_indice = (
        (
            pagina_atual
            - 1
        )
        * tamanho
    )

    fim_indice = (
        inicio_indice
        + tamanho
    )

    registros_pagina = [
        _registro_para_dict(
            registro
        )
        for registro
        in tela[
            inicio_indice:
            fim_indice
        ]
    ]

    resultado[
        "grupo_status"
    ] = grupo

    resultado[
        "registros_pagina"
    ] = registros_pagina

    resultado[
        "paginacao"
    ] = {
        "pagina": (
            pagina_atual
        ),

        "tamanho_pagina": (
            tamanho
        ),

        "total_filtrado": (
            total_filtrado
        ),

        "total_paginas": (
            total_paginas
        ),

        "tem_anterior": (
            pagina_atual > 1
        ),

        "tem_proxima": (
            pagina_atual
            < total_paginas
        ),
    }

    return resultado
