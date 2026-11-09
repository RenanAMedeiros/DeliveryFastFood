import json
import socket
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from django.conf import settings


class FinanceiroAPIError(RuntimeError):
    pass


def _api_executa_localmente(base_url):
    """Indica quando a API pertence ao mesmo processo/host do Workspace."""

    hostname = (
        urlparse(base_url).hostname
        or ""
    ).strip().lower()

    return hostname in {
        "127.0.0.1",
        "localhost",
        "::1",
    }


def _extrair_em_processo(
    *,
    data_inicial,
    data_final,
):
    """Executa o serviço da Financeiro API sem depender do transporte HTTP."""

    from financeiro_api.app.services.financeiro_service import (
        extrair_financeiro,
    )

    return extrair_financeiro(
        modo="full",
        data_inicial=data_inicial,
        data_final=data_final,
        desde=None,
        ate=None,
    )


def _config():
    if not getattr(settings, "FINANCEIRO_API_ENABLED", True):
        raise FinanceiroAPIError(
            "A integração com a Financeiro API está desativada neste ambiente."
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
        raise FinanceiroAPIError(
            "FINANCEIRO_API_URL não configurada."
        )

    if not token:
        raise FinanceiroAPIError(
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
    payload=None,
):
    (
        base_url,
        token,
        timeout,
    ) = _config()

    body = None

    if payload is not None:
        body = json.dumps(
            payload,
            ensure_ascii=False,
        ).encode(
            "utf-8"
        )

    req = Request(
        f"{base_url}{path}",
        data=body,
        method=method,
        headers={
            "Authorization": (
                f"Bearer {token}"
            ),
            "Content-Type": (
                "application/json"
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
            return json.loads(
                response
                .read()
                .decode(
                    "utf-8"
                )
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

        raise FinanceiroAPIError(
            f"Financeiro API respondeu "
            f"HTTP {exc.code}: {detalhe}"
        ) from exc

    except (
        socket.timeout,
        TimeoutError,
    ) as exc:
        raise FinanceiroAPIError(
            "Tempo limite excedido ao consultar "
            "a Financeiro API."
        ) from exc

    except URLError as exc:
        raise FinanceiroAPIError(
            "Não foi possível acessar a "
            f"Financeiro API: {exc.reason}"
        ) from exc


def verificar_financeiro_api():
    return _request(
        "GET",
        "/health",
    )


def verificar_conexoes_financeiro_api():
    return _request(
        "GET",
        "/api/v1/financeiro/conexoes",
    )


def extrair_financeiro_api(
    *,
    data_inicial,
    data_final,
):
    """
    A integração do Workspace utiliza somente FULL.
    Não existe sincronização incremental neste fluxo.
    """

    base_url, _, _ = _config()

    if _api_executa_localmente(base_url):
        return _extrair_em_processo(
            data_inicial=data_inicial,
            data_final=data_final,
        )

    return _request(
        "POST",
        "/api/v1/financeiro/extrair",
        {
            "modo": "full",
            "data_inicial": (
                data_inicial.isoformat()
            ),
            "data_final": (
                data_final.isoformat()
            ),
        },
    )
