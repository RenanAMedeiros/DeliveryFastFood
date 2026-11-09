from __future__ import annotations

import csv
import sys
import urllib.request
from collections import defaultdict
from datetime import datetime
from typing import Any, Iterable

from django.utils import timezone

try:
    from workspace.services.service_tickets import APONTAMENTOS_URL
except Exception:
    APONTAMENTOS_URL = (
        "https://uploads-tiflux.s3.sa-east-1.amazonaws.com/"
        "dw/fafbafb914e9f15b63d39d4577721ef019af2cfb20b31f9320f21c0b01c6c17c/"
        "9e053bf1118e5413ca7bf881664737ce26a24bab2d373ae7594d5f4ceebf0f6c/"
        "4717/ticket_appointments_latest.csv"
    )

TIMEOUT_SEGUNDOS = 180


def _texto(valor: Any) -> str:
    return str(valor or "").strip()


def _segundos(valor: Any) -> int:
    texto = _texto(valor).replace(",", ".")
    if not texto:
        return 0
    try:
        return max(0, int(round(float(texto))))
    except (TypeError, ValueError):
        return 0


def _data_hora(valor: Any):
    texto = _texto(valor)
    if not texto:
        return None
    texto = texto.replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(texto)
    except ValueError:
        dt = None
        for formato in (
            "%Y-%m-%d %H:%M:%S.%f",
            "%Y-%m-%d %H:%M:%S",
            "%d/%m/%Y %H:%M:%S",
            "%Y-%m-%d",
            "%d/%m/%Y",
        ):
            try:
                dt = datetime.strptime(texto, formato)
                break
            except ValueError:
                continue
    if dt is None:
        return None
    if timezone.is_naive(dt):
        try:
            dt = timezone.make_aware(dt, timezone.get_current_timezone())
        except Exception:
            return dt
    return dt


def obter_resumo_apontamentos(ticket_numbers: Iterable[Any]) -> dict[str, dict[str, Any]]:
    """Baixa a base de apontamentos uma vez e agrega somente os tickets solicitados."""
    numeros = {_texto(numero) for numero in ticket_numbers if _texto(numero)}
    if not numeros:
        return {}

    limite = sys.maxsize
    while True:
        try:
            csv.field_size_limit(limite)
            break
        except OverflowError:
            limite //= 10

    request = urllib.request.Request(
        APONTAMENTOS_URL,
        headers={"User-Agent": "Workspace-Projetos/1.0", "Accept": "text/csv,*/*"},
    )
    resumo: dict[str, dict[str, Any]] = {
        numero: {
            "segundos": 0,
            "quantidade": 0,
            "ultimo_em": None,
            "por_usuario": defaultdict(int),
        }
        for numero in numeros
    }

    with urllib.request.urlopen(request, timeout=TIMEOUT_SEGUNDOS) as resposta:
        linhas = (linha.decode("utf-8-sig", errors="replace") for linha in resposta)
        leitor = csv.DictReader(linhas, delimiter="\t")
        for linha in leitor:
            numero = _texto(linha.get("ticket_number") or linha.get("ticket") or linha.get("id"))
            if numero not in numeros:
                continue
            item = resumo[numero]
            duracao = _segundos(linha.get("duration"))
            item["segundos"] += duracao
            item["quantidade"] += 1
            usuario = _texto(
                linha.get("appointment_user_name")
                or linha.get("user_name")
                or linha.get("responsible_name")
            ) or "Sem usuário"
            item["por_usuario"][usuario] += duracao
            momento = _data_hora(linha.get("beginning") or linha.get("created_at"))
            if momento and (item["ultimo_em"] is None or momento > item["ultimo_em"]):
                item["ultimo_em"] = momento

    saida: dict[str, dict[str, Any]] = {}
    for numero, item in resumo.items():
        saida[numero] = {
            "segundos": int(item["segundos"]),
            "quantidade": int(item["quantidade"]),
            "ultimo_em": item["ultimo_em"],
            "por_usuario": dict(sorted(item["por_usuario"].items(), key=lambda par: (-par[1], par[0]))),
        }
    return saida
