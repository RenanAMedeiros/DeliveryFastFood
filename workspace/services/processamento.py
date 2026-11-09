import json
import socket
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings


class ProcessamentoAPIError(RuntimeError):
    """
    Erro de comunicação ou resposta inválida da Workspace Integration API.
    """
    pass


def _config():
    """
    O Processamento reutiliza a mesma API, URL e token já configurados
    para o Financeiro V2.

    Não é necessário criar novas variáveis no settings.py.
    """

    if not getattr(settings, "FINANCEIRO_API_ENABLED", True):
        raise ProcessamentoAPIError(
            "A integração com a API de Processamento está desativada neste ambiente."
        )

    base_url = (
        getattr(
            settings,
            "FINANCEIRO_API_URL",
            "",
        )
        or ""
    ).strip().rstrip("/")

    token = (
        getattr(
            settings,
            "FINANCEIRO_API_TOKEN",
            "",
        )
        or ""
    ).strip()

    timeout = int(
        getattr(
            settings,
            "FINANCEIRO_API_TIMEOUT",
            300,
        )
        or 300
    )

    if not base_url:
        raise ProcessamentoAPIError(
            "FINANCEIRO_API_URL não configurada."
        )

    if not token:
        raise ProcessamentoAPIError(
            "FINANCEIRO_API_TOKEN não configurado."
        )

    return (
        base_url,
        token,
        timeout,
    )


def _request(
    method,
    path,
):
    (
        base_url,
        token,
        timeout,
    ) = _config()

    req = Request(
        f"{base_url}{path}",
        method=method,
        headers={
            "Authorization": (
                f"Bearer {token}"
            ),
            "Accept": (
                "application/json"
            ),
        },
    )

    try:
        with urlopen(
            req,
            timeout=timeout,
        ) as response:
            conteudo = (
                response
                .read()
                .decode(
                    "utf-8"
                )
            )

            return json.loads(
                conteudo
            )

    except HTTPError as exc:
        detalhe = (
            exc
            .read()
            .decode(
                "utf-8",
                errors="replace",
            )
        )

        raise ProcessamentoAPIError(
            "Workspace Integration API respondeu "
            f"HTTP {exc.code}: {detalhe}"
        ) from exc

    except (
        socket.timeout,
        TimeoutError,
    ) as exc:
        raise ProcessamentoAPIError(
            "Tempo limite excedido ao consultar "
            "a API de Processamento."
        ) from exc

    except URLError as exc:
        raise ProcessamentoAPIError(
            "Não foi possível acessar a "
            "Workspace Integration API: "
            f"{exc.reason}"
        ) from exc

    except json.JSONDecodeError as exc:
        raise ProcessamentoAPIError(
            "A API de Processamento retornou "
            "uma resposta JSON inválida."
        ) from exc


def buscar_processamentos():
    """
    Consulta os processamentos pela Workspace Integration API.

    Regras:
    - não existe cache/sincronização no Workspace;
    - a query é executada em tempo real quando esta função é chamada;
    - a tela chama esta função apenas:
        1. ao abrir/recarregar o dashboard;
        2. ao clicar em "Atualizar dados";
    - filtros, busca, gráficos e paginação permanecem locais no JavaScript.
    """

    resposta = _request(
        "GET",
        "/api/v1/processamento/consultar",
    )

    if not isinstance(
        resposta,
        dict,
    ):
        raise ProcessamentoAPIError(
            "Resposta inesperada da API de Processamento."
        )

    if not resposta.get(
        "sucesso",
        False,
    ):
        erros = (
            resposta.get(
                "erros"
            )
            or []
        )

        detalhe = ""

        if erros:
            detalhe = (
                erros[0].get(
                    "erro"
                )
                if isinstance(
                    erros[0],
                    dict,
                )
                else str(
                    erros[0]
                )
            )

        raise ProcessamentoAPIError(
            detalhe
            or (
                "A API de Processamento não conseguiu "
                "consultar as bases."
            )
        )

    registros = (
        resposta.get(
            "registros"
        )
        or []
    )

    if not isinstance(
        registros,
        list,
    ):
        raise ProcessamentoAPIError(
            "A API de Processamento retornou "
            "registros em formato inválido."
        )

    return registros
