"""
Service do Dashboard de Projetos - Microsoft Planner / Microsoft Graph.

Responsabilidades:
- autenticar no Microsoft Graph via client_credentials;
- descobrir todos os Microsoft 365 Groups;
- descobrir todos os Planner Plans desses grupos;
- carregar buckets e tarefas;
- resolver nomes dos responsáveis;
- consolidar indicadores de projeto;
- classificar projeto como Ativo / Concluído / Sem tarefas;
- classificar saúde do projeto;
- gerar payload pronto para a view/template;
- usar cache do Django para evitar milhares de chamadas ao Graph a cada page load.

Permissões de Application necessárias no Azure/Entra ID:
- Group.Read.All
- User.Read.All
- Tasks.Read.All

Todas precisam de Admin Consent.
"""

from __future__ import annotations

import copy
import os
import re
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Any

import requests
from django.core.cache import cache
from django.db import OperationalError, ProgrammingError
from workspace.models import ProjetoResponsavelManual
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from zoneinfo import ZoneInfo


GRAPH_V1 = "https://graph.microsoft.com/v1.0"

GRAPH_CLIENT_ID = (
    os.getenv("GRAPH_APPLICATION_CLIENT_ID", "").strip()
    or os.getenv("GRAPH_CLIENT_ID", "").strip()
)

GRAPH_TENANT_ID = os.getenv(
    "GRAPH_TENANT_ID",
    "",
).strip()

GRAPH_CLIENT_SECRET = (
    os.getenv("GRAPH_APPLICATION_SECRET_VALUE", "").strip()
    or os.getenv("GRAPH_CLIENT_SECRET", "").strip()
)

GRAPH_TIMEOUT = int(
    os.getenv(
        "GRAPH_TIMEOUT",
        "30",
    )
)

LOCAL_TIMEZONE_NAME = os.getenv(
    "LOCAL_TIMEZONE",
    "America/Sao_Paulo",
).strip()

LOCAL_TIMEZONE = ZoneInfo(
    LOCAL_TIMEZONE_NAME
)

CACHE_SECONDS = int(
    os.getenv(
        "DASHBOARD_PROJETOS_CACHE_SECONDS",
        "1800",
    )
)

CACHE_KEY = "workspace:dashboard_projetos:v8:pmo:sprint-order-hotfix"


# ============================================================
# HTTP / GRAPH
# ============================================================


def _criar_session() -> requests.Session:
    session = requests.Session()

    retry = Retry(
        total=5,
        connect=5,
        read=5,
        status=5,
        backoff_factor=1,
        status_forcelist=[
            429,
            500,
            502,
            503,
            504,
        ],
        allowed_methods=frozenset(
            ["GET", "POST"]
        ),
        respect_retry_after_header=True,
    )

    adapter = HTTPAdapter(
        max_retries=retry
    )

    session.mount(
        "https://",
        adapter,
    )

    return session


SESSION = _criar_session()


def _validar_configuracao() -> None:
    faltantes = []

    if not GRAPH_CLIENT_ID:
        faltantes.append(
            "GRAPH_APPLICATION_CLIENT_ID ou GRAPH_CLIENT_ID"
        )

    if not GRAPH_TENANT_ID:
        faltantes.append(
            "GRAPH_TENANT_ID"
        )

    if not GRAPH_CLIENT_SECRET:
        faltantes.append(
            "GRAPH_APPLICATION_SECRET_VALUE ou GRAPH_CLIENT_SECRET"
        )

    if faltantes:
        raise RuntimeError(
            "Configuração Microsoft Graph incompleta. "
            "Variáveis ausentes: "
            + ", ".join(
                faltantes
            )
        )


def _obter_token() -> str:
    _validar_configuracao()

    url = (
        "https://login.microsoftonline.com/"
        f"{GRAPH_TENANT_ID}/oauth2/v2.0/token"
    )

    response = SESSION.post(
        url,
        data={
            "client_id": GRAPH_CLIENT_ID,
            "client_secret": GRAPH_CLIENT_SECRET,
            "scope": (
                "https://graph.microsoft.com/.default"
            ),
            "grant_type": "client_credentials",
        },
        timeout=GRAPH_TIMEOUT,
    )

    if response.status_code != 200:
        raise RuntimeError(
            "Erro ao obter token Microsoft Graph. "
            f"HTTP {response.status_code}: "
            f"{response.text}"
        )

    return response.json()[
        "access_token"
    ]


def _headers(
    token: str,
) -> dict[str, str]:
    return {
        "Authorization": (
            f"Bearer {token}"
        ),
        "Accept": "application/json",
    }


def _graph_get(
    token: str,
    url: str,
    aceitar_erro: bool = False,
) -> dict[str, Any] | None:
    response = SESSION.get(
        url,
        headers=_headers(
            token
        ),
        timeout=GRAPH_TIMEOUT,
    )

    if response.status_code == 200:
        return response.json()

    if aceitar_erro:
        return None

    raise RuntimeError(
        f"Microsoft Graph HTTP "
        f"{response.status_code}: "
        f"{response.text}"
    )


def _graph_list(
    token: str,
    url: str,
) -> list[dict[str, Any]]:
    resultado = []
    proxima_url = url

    while proxima_url:
        dados = _graph_get(
            token,
            proxima_url,
        ) or {}

        resultado.extend(
            dados.get(
                "value",
                [],
            )
        )

        proxima_url = dados.get(
            "@odata.nextLink"
        )

    return resultado


# ============================================================
# DATAS
# ============================================================


def _parse_datetime(
    valor: str | None,
) -> datetime | None:
    if not valor:
        return None

    try:
        dt = datetime.fromisoformat(
            valor.replace(
                "Z",
                "+00:00",
            )
        )

        if dt.tzinfo is None:
            dt = dt.replace(
                tzinfo=timezone.utc
            )

        return dt

    except Exception:
        return None


def _iso_local(
    valor: str | None,
) -> str | None:
    dt = _parse_datetime(
        valor
    )

    if not dt:
        return None

    return (
        dt.astimezone(
            LOCAL_TIMEZONE
        )
        .isoformat()
    )


def _agora() -> datetime:
    return datetime.now(
        LOCAL_TIMEZONE
    )


# ============================================================
# CACHE DE USUÁRIOS
# ============================================================


class CacheUsuarios:
    def __init__(
        self,
        token: str,
    ):
        self.token = token
        self.cache: dict[
            str,
            dict[str, Any],
        ] = {}

    def obter(
        self,
        user_id: str | None,
    ) -> dict[str, Any]:
        if not user_id:
            return {
                "id": "",
                "displayName": "",
                "mail": "",
                "userPrincipalName": "",
                "jobTitle": "",
                "department": "",
            }

        if user_id in self.cache:
            return self.cache[
                user_id
            ]

        select = (
            "id,"
            "displayName,"
            "mail,"
            "userPrincipalName,"
            "jobTitle,"
            "department"
        )

        url = (
            f"{GRAPH_V1}/users/"
            f"{user_id}"
            f"?$select={select}"
        )

        dados = _graph_get(
            self.token,
            url,
            aceitar_erro=True,
        )

        if not dados:
            dados = {
                "id": user_id,
                "displayName": "",
                "mail": "",
                "userPrincipalName": "",
                "jobTitle": "",
                "department": "",
            }

        self.cache[
            user_id
        ] = dados

        return dados


# ============================================================
# PLANNER
# ============================================================


def _obter_grupos(
    token: str,
) -> list[dict[str, Any]]:
    url = (
        f"{GRAPH_V1}/groups"
        "?$filter=groupTypes/any(c:c eq 'Unified')"
        "&$select=id,displayName,mail,mailNickname,groupTypes"
        "&$top=999"
    )

    return _graph_list(
        token,
        url,
    )


def _obter_planos_grupo(
    token: str,
    group_id: str,
) -> list[dict[str, Any]]:
    url = (
        f"{GRAPH_V1}/groups/"
        f"{group_id}/planner/plans"
    )

    try:
        return _graph_list(
            token,
            url,
        )
    except Exception:
        # Um grupo com erro não derruba o portfólio inteiro.
        return []


def _obter_buckets(
    token: str,
    plan_id: str,
) -> list[dict[str, Any]]:
    return _graph_list(
        token,
        (
            f"{GRAPH_V1}/planner/"
            f"plans/{plan_id}/buckets"
        ),
    )


def _obter_detalhes_plano(
    token: str,
    plan_id: str,
) -> dict[str, Any]:
    """Detalhes do plano: inclui categoryDescriptions (rótulos do Planner)."""
    return (
        _graph_get(
            token,
            f"{GRAPH_V1}/planner/plans/{plan_id}/details",
        )
        or {}
    )


def _obter_tarefas(
    token: str,
    plan_id: str,
) -> list[dict[str, Any]]:
    return _graph_list(
        token,
        (
            f"{GRAPH_V1}/planner/"
            f"plans/{plan_id}/tasks"
        ),
    )


# ============================================================
# REGRAS DE NEGÓCIO DO DASHBOARD
# ============================================================


SPRINT_REGEX = re.compile(r"^\s*SPRINT\s*0*(\d+)\b", re.IGNORECASE)
GOLIVE_REGEX = re.compile(r"^\s*GO[ -]?LIVE\b", re.IGNORECASE)


def _mapa_rotulos_plano(detalhes_plano: dict[str, Any]) -> dict[str, str]:
    descriptions = detalhes_plano.get("categoryDescriptions") or {}
    return {
        str(chave): str(nome).strip()
        for chave, nome in descriptions.items()
        if nome and str(nome).strip()
    }


def _rotulos_tarefa(tarefa: dict[str, Any], mapa_rotulos: dict[str, str]) -> list[str]:
    applied = tarefa.get("appliedCategories") or {}
    retorno = []
    for categoria, aplicado in applied.items():
        if not aplicado:
            continue
        nome = mapa_rotulos.get(str(categoria), "").strip()
        if nome and nome not in retorno:
            retorno.append(nome)
    return retorno


def _sprint_rotulo_oficial(
    rotulos: list[str],
) -> dict[str, Any]:
    """
    Identifica Sprint SOMENTE pelo rótulo aplicado no Planner.

    Essa função não usa título nem bucket como fallback porque, para
    o Dashboard, a tarefa rotulada SPRINT N é o marco oficial da Sprint.
    """
    encontrados = []

    for rotulo in rotulos:
        match = SPRINT_REGEX.search(
            str(rotulo)
        )

        if not match:
            continue

        encontrados.append({
            "numero": int(match.group(1)),
            "nome": str(rotulo).strip(),
        })

    if not encontrados:
        return {
            "numero": None,
            "nome": "",
        }

    encontrados.sort(
        key=lambda item: (
            item["numero"],
            item["nome"].lower(),
        )
    )

    return encontrados[0]


def _tarefa_e_golive(rotulos: list[str]) -> bool:
    return any(
        GOLIVE_REGEX.search(
            str(rotulo)
        )
        for rotulo in rotulos
    )


def _dias_uteis_entre(inicio: datetime | None, fim: datetime | None) -> int:
    # Segunda a sexta, inclusivo. Não desconta feriados porque o Planner não os fornece.
    if not inicio or not fim:
        return 0
    inicio = inicio.astimezone(LOCAL_TIMEZONE)
    fim = fim.astimezone(LOCAL_TIMEZONE)
    if fim < inicio:
        inicio, fim = fim, inicio
    atual, final = inicio.date(), fim.date()
    total = 0
    while atual <= final:
        if atual.weekday() < 5:
            total += 1
        atual += timedelta(days=1)
    return total


def _tarefa_dentro_periodo_sprint(
    tarefa: dict[str, Any],
    inicio: datetime | None,
    fim: datetime | None,
) -> bool:
    """Retorna True quando a tarefa pertence ao intervalo do marco da Sprint."""
    if not inicio or not fim:
        return False

    if fim < inicio:
        inicio, fim = fim, inicio

    tarefa_inicio = (
        _parse_datetime(tarefa.get("inicio_planejado"))
        or _parse_datetime(tarefa.get("inicio"))
    )
    tarefa_fim = _parse_datetime(tarefa.get("prazo"))

    # Regra preferencial: início e vencimento inteiramente dentro do bloco.
    if tarefa_inicio and tarefa_fim:
        return inicio <= tarefa_inicio <= fim and inicio <= tarefa_fim <= fim

    # Fallback para tarefas com apenas uma das datas preenchidas.
    if tarefa_fim:
        return inicio <= tarefa_fim <= fim

    if tarefa_inicio:
        return inicio <= tarefa_inicio <= fim

    return False


def _escolher_marco_sprint(
    candidatos: list[dict[str, Any]],
    numero: int,
) -> dict[str, Any]:
    """
    Em caso de mais de uma tarefa com o mesmo rótulo SPRINT N,
    prioriza a que também inicia o título com SPRINT N.
    """
    regex_titulo = re.compile(
        rf"^\s*SPRINT\s*0*{numero}\b",
        re.IGNORECASE,
    )

    return sorted(
        candidatos,
        key=lambda tarefa: (
            0 if regex_titulo.search(tarefa.get("titulo", "")) else 1,
            _parse_datetime(tarefa.get("inicio_planejado"))
            or _parse_datetime(tarefa.get("inicio"))
            or datetime.max.replace(tzinfo=timezone.utc),
            _parse_datetime(tarefa.get("prazo"))
            or datetime.max.replace(tzinfo=timezone.utc),
            tarefa.get("titulo", "").lower(),
        ),
    )[0]


def _ordem_tarefa_planner(
    tarefa: dict[str, Any],
) -> tuple[Any, ...]:
    """
    Ordenação nativa do Planner.

    orderHint é usado quando disponível. A ordem de coleta da API
    é mantida como fallback para não reordenar tarefas arbitrariamente.
    """
    order_hint = str(
        tarefa.get("ordem_planner")
        or ""
    ).strip()

    ordem_coleta = int(
        tarefa.get("ordem_coleta")
        or 0
    )

    if order_hint:
        return (
            0,
            order_hint,
            ordem_coleta,
        )

    return (
        1,
        ordem_coleta,
        "",
    )


def _dias_vencimento_sprint(
    prazo: datetime | None,
    concluida_em: datetime | None,
    concluida: bool,
    agora: datetime,
) -> tuple[int | None, int | None]:
    """
    Retorna dias corridos:
    - dias_para_vencer
    - dias_em_atraso

    Para Sprint concluída, atraso representa o atraso histórico entre
    a data de vencimento e a conclusão efetiva, quando existir.
    """
    if not prazo:
        return None, None

    prazo_dia = prazo.astimezone(
        LOCAL_TIMEZONE
    ).date()

    hoje = agora.astimezone(
        LOCAL_TIMEZONE
    ).date()

    if concluida:
        if concluida_em:
            conclusao_dia = concluida_em.astimezone(
                LOCAL_TIMEZONE
            ).date()

            atraso_historico = max(
                (
                    conclusao_dia
                    - prazo_dia
                ).days,
                0,
            )

            return 0, atraso_historico

        return 0, 0

    diferenca = (
        prazo_dia
        - hoje
    ).days

    if diferenca >= 0:
        return diferenca, 0

    return 0, abs(diferenca)


def _montar_sprints(
    tarefas: list[dict[str, Any]],
    agora: datetime,
) -> list[dict[str, Any]]:
    """
    Agrupa tarefas pela ORDEM DO PLANNER.

    Regra:
    - a tarefa com rótulo SPRINT N é o marco que inicia o bloco;
    - as tarefas seguintes pertencem àquela Sprint;
    - o próximo marco encerra o bloco anterior e inicia o próximo;
    - datas NÃO são usadas para inferir a Sprint.

    Isso é necessário porque diferentes Sprints podem ter exatamente
    as mesmas datas de início/vencimento.
    """
    tarefas_ordenadas = sorted(
        tarefas,
        key=_ordem_tarefa_planner,
    )

    candidatos_por_numero: dict[int, list[dict[str, Any]]] = {}

    for tarefa in tarefas_ordenadas:
        numero = tarefa.get(
            "sprint_rotulo_numero"
        )

        if numero is None:
            continue

        candidatos_por_numero.setdefault(
            int(numero),
            [],
        ).append(tarefa)

    if not candidatos_por_numero:
        return []

    marcos: list[tuple[int, dict[str, Any]]] = []

    for numero in sorted(
        candidatos_por_numero
    ):
        candidatos = sorted(
            candidatos_por_numero[numero],
            key=_ordem_tarefa_planner,
        )

        marco = _escolher_marco_sprint(
            candidatos,
            numero,
        )

        marco["sprint_marco"] = True
        marco["sprint_numero"] = numero
        marco["sprint"] = (
            marco.get("sprint_rotulo")
            or f"SPRINT {numero}"
        )

        marcos.append(
            (
                numero,
                marco,
            )
        )

    marco_por_id = {
        marco.get("id"): numero
        for numero, marco in marcos
        if marco.get("id")
    }

    membros_por_numero: dict[int, list[dict[str, Any]]] = {
        numero: []
        for numero, _ in marcos
    }

    sprint_atual: int | None = None

    for tarefa in tarefas_ordenadas:
        tarefa_id = tarefa.get(
            "id",
            "",
        )

        # Somente o marco oficial abre um novo bloco.
        if tarefa_id in marco_por_id:
            sprint_atual = marco_por_id[
                tarefa_id
            ]
            continue

        if sprint_atual is None:
            tarefa["sprint_numero"] = None
            tarefa["sprint"] = "Sem Sprint"
            continue

        tarefa["sprint_numero"] = sprint_atual
        tarefa["sprint"] = (
            next(
                (
                    marco.get("sprint")
                    for numero, marco in marcos
                    if numero == sprint_atual
                ),
                f"SPRINT {sprint_atual}",
            )
        )

        membros_por_numero[
            sprint_atual
        ].append(tarefa)

    resultado = []

    for numero, marco in marcos:
        nome = (
            marco.get("sprint_rotulo")
            or f"SPRINT {numero}"
        )

        data_inicio = (
            _parse_datetime(
                marco.get(
                    "inicio_planejado"
                )
            )
            or _parse_datetime(
                marco.get(
                    "inicio"
                )
            )
        )

        data_fim = _parse_datetime(
            marco.get(
                "prazo"
            )
        )

        concluida_em = _parse_datetime(
            marco.get(
                "concluida_em"
            )
        )

        membros = membros_por_numero.get(
            numero,
            [],
        )

        membros.sort(
            key=_ordem_tarefa_planner
        )

        total_membros = len(
            membros
        )

        membros_concluidos = sum(
            1
            for tarefa in membros
            if tarefa.get(
                "concluida"
            )
        )

        membros_atrasados = sum(
            1
            for tarefa in membros
            if tarefa.get(
                "atrasada"
            )
        )

        responsaveis = sorted({
            responsavel
            for tarefa in membros
            for responsavel in tarefa.get(
                "responsaveis_nomes",
                [],
            )
            if responsavel
        })

        dias_para_vencer, dias_em_atraso = (
            _dias_vencimento_sprint(
                data_fim,
                concluida_em,
                bool(
                    marco.get(
                        "concluida"
                    )
                ),
                agora,
            )
        )

        resultado.append({
            "numero": numero,
            "nome": nome,

            "marco_id": marco.get(
                "id",
                "",
            ),
            "marco_titulo": marco.get(
                "titulo",
                "",
            ),
            "data_inicio": (
                data_inicio.isoformat()
                if data_inicio
                else None
            ),
            "data_conclusao": (
                data_fim.isoformat()
                if data_fim
                else None
            ),
            "concluida_em": marco.get(
                "concluida_em"
            ),
            "dias_uteis": _dias_uteis_entre(
                data_inicio,
                data_fim,
            ),
            "dias_para_vencer": dias_para_vencer,
            "dias_em_atraso": dias_em_atraso,
            "progresso": int(
                marco.get(
                    "percentual"
                )
                or 0
            ),
            "status": marco.get(
                "status",
                "",
            ),
            "marco_concluido": bool(
                marco.get(
                    "concluida"
                )
            ),
            "marco_atrasado": bool(
                marco.get(
                    "atrasada"
                )
            ),

            # Mantido para Cronograma e Gantt.
            "quantidade_tarefas": total_membros,
            "tarefas_concluidas": membros_concluidos,
            "tarefas_atrasadas": membros_atrasados,
            "responsaveis": responsaveis,
            "tarefas_ids": [
                tarefa.get(
                    "id",
                    "",
                )
                for tarefa in membros
                if tarefa.get(
                    "id"
                )
            ],
        })

    return resultado



def _prioridade_texto(
    valor: Any,
) -> str:
    try:
        prioridade = int(
            valor
        )
    except Exception:
        return ""

    if prioridade <= 1:
        return "Urgente"

    if prioridade <= 4:
        return "Importante"

    if prioridade <= 7:
        return "Média"

    return "Baixa"


def _responsaveis_tarefa(
    tarefa: dict[str, Any],
    usuarios: CacheUsuarios,
) -> list[dict[str, Any]]:
    resultado = []

    assignments = (
        tarefa.get(
            "assignments"
        )
        or {}
    )

    for user_id in assignments.keys():
        usuario = usuarios.obter(
            user_id
        )

        resultado.append({
            "id": user_id,
            "origem": "Planner",
            "manual": False,
            "nome": usuario.get(
                "displayName",
                "",
            ),
            "email": (
                usuario.get(
                    "mail"
                )
                or usuario.get(
                    "userPrincipalName"
                )
                or ""
            ),
            "cargo": usuario.get(
                "jobTitle",
                "",
            ),
            "departamento": usuario.get(
                "department",
                "",
            ),
        })

    return resultado


def _montar_tarefa(
    tarefa: dict[str, Any],
    mapa_buckets: dict[str, str],
    mapa_rotulos: dict[str, str],
    usuarios: CacheUsuarios,
    agora: datetime,
) -> dict[str, Any]:
    percentual = int(
        tarefa.get(
            "percentComplete"
        )
        or 0
    )

    due_dt = _parse_datetime(
        tarefa.get(
            "dueDateTime"
        )
    )

    concluida = (
        percentual >= 100
    )

    atrasada = bool(
        not concluida
        and due_dt
        and due_dt.astimezone(
            LOCAL_TIMEZONE
        ) < agora
    )

    if concluida:
        status = "Concluída"
    elif atrasada:
        status = "Atrasada"
    elif percentual > 0:
        status = "Em andamento"
    else:
        status = "Não iniciada"

    responsaveis = (
        _responsaveis_tarefa(
            tarefa,
            usuarios,
        )
    )

    bucket_nome = mapa_buckets.get(tarefa.get("bucketId", ""), "Sem bucket")
    rotulos = _rotulos_tarefa(tarefa, mapa_rotulos)
    sprint_rotulo = _sprint_rotulo_oficial(
        rotulos
    )
    eh_golive = _tarefa_e_golive(
        rotulos
    )

    return {
        "id": tarefa.get(
            "id",
            "",
        ),
        "titulo": tarefa.get(
            "title",
            "",
        ),
        "bucket_id": tarefa.get(
            "bucketId",
            "",
        ),
        "bucket": bucket_nome,
        "rotulos": rotulos,
        "ordem_planner": str(tarefa.get("orderHint") or ""),
        "sprint_rotulo_numero": sprint_rotulo.get("numero"),
        "sprint_rotulo": sprint_rotulo.get("nome"),
        "sprint_marco": False,
        "sprint_numero": sprint_rotulo.get("numero"),
        "sprint": sprint_rotulo.get("nome") or "Sem Sprint",
        "golive": eh_golive,
        "percentual": percentual,
        "status": status,
        "concluida": concluida,
        "atrasada": atrasada,
        "prioridade": _prioridade_texto(
            tarefa.get(
                "priority"
            )
        ),
        "prioridade_valor": tarefa.get(
            "priority"
        ),
        "inicio_planejado": _iso_local(tarefa.get("startDateTime")),
        "inicio": _iso_local(
            tarefa.get("startDateTime") or tarefa.get("createdDateTime")
        ),
        "prazo": _iso_local(
            tarefa.get(
                "dueDateTime"
            )
        ),
        "concluida_em": _iso_local(
            tarefa.get(
                "completedDateTime"
            )
        ),
        "criada_em": _iso_local(
            tarefa.get(
                "createdDateTime"
            )
        ),
        "responsaveis": responsaveis,
        "responsaveis_nomes": [
            item.get(
                "nome"
            )
            for item in responsaveis
            if item.get(
                "nome"
            )
        ],
        "quantidade_checklist": int(
            tarefa.get(
                "checklistItemCount"
            )
            or 0
        ),
        "checklist_pendente": int(
            tarefa.get(
                "activeChecklistItemCount"
            )
            or 0
        ),
        "tem_descricao": bool(
            tarefa.get(
                "hasDescription"
            )
        ),
    }



def _carregar_responsaveis_manuais() -> dict[str, dict[Any, list[dict[str, Any]]]]:
    """
    Carrega os responsáveis complementares do Workspace.

    IMPORTANTE:
    a camada PMO é complementar e nunca pode impedir o Dashboard de
    Projetos de carregar os dados do Microsoft Graph. Enquanto a migration
    da tabela de responsáveis manuais ainda não tiver sido aplicada,
    retornamos mapas vazios e seguimos normalmente com os dados do Planner.
    """
    projeto: dict[str, list[dict[str, Any]]] = {}
    sprint: dict[tuple[str, int], list[dict[str, Any]]] = {}
    tarefa: dict[tuple[str, str], list[dict[str, Any]]] = {}

    try:
        queryset = (
            ProjetoResponsavelManual.objects
            .filter(ativo=True)
            .order_by("plan_id", "escopo", "sprint_numero", "task_id", "nome")
        )

        for item in queryset:
            payload = item.as_dashboard_dict()

            if (
                item.escopo == ProjetoResponsavelManual.Escopo.TAREFA
                and item.task_id
            ):
                tarefa.setdefault(
                    (item.plan_id, item.task_id),
                    [],
                ).append(payload)

            elif (
                item.escopo == ProjetoResponsavelManual.Escopo.SPRINT
                and item.sprint_numero
            ):
                sprint.setdefault(
                    (item.plan_id, int(item.sprint_numero)),
                    [],
                ).append(payload)

            else:
                projeto.setdefault(
                    item.plan_id,
                    [],
                ).append(payload)

    except (OperationalError, ProgrammingError):
        # A tabela PMO pode ainda não existir antes da migration.
        # Isso NÃO deve derrubar os dados do Microsoft Planner.
        pass

    return {
        "projeto": projeto,
        "sprint": sprint,
        "tarefa": tarefa,
    }


def _nomes_responsaveis(responsaveis: list[dict[str, Any]]) -> list[str]:
    nomes = []
    vistos = set()
    for item in responsaveis:
        nome = (item.get("nome") or "").strip()
        if not nome:
            continue
        chave = nome.casefold()
        if chave in vistos:
            continue
        vistos.add(chave)
        nomes.append(nome)
    return nomes


def _mesclar_responsaveis(
    planner: list[dict[str, Any]],
    manuais: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    retorno = []
    vistos = set()

    for item in [*(planner or []), *(manuais or [])]:
        chave = (
            (item.get("email") or "").strip().casefold(),
            (item.get("nome") or "").strip().casefold(),
            item.get("papel") or "",
            item.get("origem") or "",
        )
        if chave in vistos:
            continue
        vistos.add(chave)
        retorno.append(item)

    return retorno


def _classificar_saude(
    status_projeto: str,
    total_abertas: int,
    total_atrasadas: int,
    proximos_7_dias: int,
) -> str:
    if status_projeto == "Concluído":
        return "Concluído"

    if status_projeto == "Sem tarefas":
        return "Sem tarefas"

    taxa_atraso = (
        total_atrasadas
        / total_abertas
        if total_abertas
        else 0
    )

    if (
        total_atrasadas >= 5
        or taxa_atraso >= 0.25
    ):
        return "Crítico"

    if (
        total_atrasadas > 0
        or proximos_7_dias > 0
    ):
        return "Atenção"

    return "Saudável"


def _montar_projeto(
    plano: dict[str, Any],
    grupo: dict[str, Any],
    tarefas_raw: list[dict[str, Any]],
    buckets_raw: list[dict[str, Any]],
    detalhes_plano: dict[str, Any],
    usuarios: CacheUsuarios,
    agora: datetime,
) -> dict[str, Any]:
    mapa_buckets = {
        bucket.get(
            "id",
            "",
        ): bucket.get(
            "name",
            "Sem bucket",
        )
        for bucket in buckets_raw
    }

    mapa_rotulos = _mapa_rotulos_plano(detalhes_plano)

    tarefas = []

    for ordem_coleta, tarefa_raw in enumerate(
        tarefas_raw
    ):
        tarefa = _montar_tarefa(
            tarefa_raw,
            mapa_buckets,
            mapa_rotulos,
            usuarios,
            agora,
        )

        tarefa["ordem_coleta"] = ordem_coleta

        tarefas.append(
            tarefa
        )

    plan_id = plano.get("id", "")

    total = len(
        tarefas
    )

    concluidas = sum(
        1
        for tarefa in tarefas
        if tarefa[
            "concluida"
        ]
    )

    abertas = (
        total
        - concluidas
    )

    atrasadas = sum(
        1
        for tarefa in tarefas
        if tarefa[
            "atrasada"
        ]
    )

    if total == 0:
        status = "Sem tarefas"
    elif concluidas == total:
        status = "Concluído"
    else:
        status = "Ativo"

    progresso_medio = (
        round(
            sum(
                tarefa[
                    "percentual"
                ]
                for tarefa in tarefas
            )
            / total,
            2,
        )
        if total
        else 0
    )

    limite_7_dias = (
        agora
        + timedelta(
            days=7
        )
    )

    proximos_7_dias = 0

    for tarefa in tarefas:
        if tarefa[
            "concluida"
        ]:
            continue

        prazo = _parse_datetime(
            tarefa.get(
                "prazo"
            )
        )

        if (
            prazo
            and agora <= prazo <= limite_7_dias
        ):
            proximos_7_dias += 1

    saude = _classificar_saude(
        status,
        abertas,
        atrasadas,
        proximos_7_dias,
    )

    responsaveis = sorted({
        nome
        for tarefa in tarefas
        for nome in tarefa.get("responsaveis_nomes", [])
        if nome
    })

    prazos_abertos = []

    for tarefa in tarefas:
        if tarefa[
            "concluida"
        ]:
            continue

        prazo = _parse_datetime(
            tarefa.get(
                "prazo"
            )
        )

        if prazo:
            prazos_abertos.append(
                prazo
            )

    proximo_vencimento = (
        min(
            (
                prazo
                for prazo
                in prazos_abertos
                if prazo >= agora
            ),
            default=None,
        )
    )

    datas_inicio = [
        _parse_datetime(
            tarefa.get(
                "inicio"
            )
        )
        for tarefa in tarefas
    ]

    datas_inicio = [
        data
        for data in datas_inicio
        if data
    ]

    datas_prazo = [
        _parse_datetime(
            tarefa.get(
                "prazo"
            )
        )
        for tarefa in tarefas
    ]

    datas_prazo = [
        data
        for data in datas_prazo
        if data
    ]

    tarefas_sem_responsavel = sum(
        1
        for tarefa in tarefas
        if not tarefa.get(
            "responsaveis"
        )
    )

    tarefas_sem_prazo = sum(
        1
        for tarefa in tarefas
        if not tarefa.get(
            "prazo"
        )
    )

    tarefas_golive = [
        tarefa
        for tarefa in tarefas
        if tarefa.get(
            "golive"
        )
    ]

    # O Go-live planejado é o VENCIMENTO da tarefa rotulada Golive.
    # Não usamos data de início como fallback porque o usuário definiu
    # esse vencimento como a data real prevista de entrada em produção.
    datas_golive = [
        _parse_datetime(
            tarefa.get(
                "prazo"
            )
        )
        for tarefa in tarefas_golive
    ]

    datas_golive = [
        data
        for data in datas_golive
        if data
    ]

    # Se houver mais de um marco Go-live, a entrega final do projeto
    # é considerada a data mais tardia entre os marcos rotulados.
    golive_planejado = (
        max(
            datas_golive
        )
        if datas_golive
        else None
    )

    dias_para_golive = (
        (
            golive_planejado.date()
            - agora.date()
        ).days
        if golive_planejado
        else None
    )

    if not golive_planejado:
        golive_status = "Sem Go-live"
    elif status == "Concluído":
        golive_status = "Projeto concluído"
    elif dias_para_golive is not None and dias_para_golive < 0:
        golive_status = "Go-live estourado"
    elif dias_para_golive is not None and dias_para_golive <= 30:
        golive_status = "Go-live próximo"
    else:
        golive_status = "Planejado"

    # Identifica os marcos e distribui as tarefas seguindo a
    # sequência nativa do Planner.
    sprints = _montar_sprints(
        tarefas,
        agora,
    )

    tarefas.sort(
        key=lambda tarefa: (
            tarefa.get("sprint_numero")
            if tarefa.get("sprint_numero") is not None
            else 9999,
            _ordem_tarefa_planner(
                tarefa
            ),
        )
    )

    return {
        "id": plano.get(
            "id",
            "",
        ),
        "nome": plano.get(
            "title",
            "",
        ),
        "grupo": {
            "id": grupo.get(
                "id",
                "",
            ),
            "nome": grupo.get(
                "displayName",
                "",
            ),
            "email": grupo.get(
                "mail",
                "",
            ),
        },
        "criado_em": _iso_local(
            plano.get(
                "createdDateTime"
            )
        ),
        "status": status,
        "saude": saude,
        "progresso_medio": progresso_medio,
        "quantidade_tarefas": total,
        "tarefas_concluidas": concluidas,
        "tarefas_abertas": abertas,
        "tarefas_atrasadas": atrasadas,
        "tarefas_proximos_7_dias": (
            proximos_7_dias
        ),
        "tarefas_sem_responsavel": (
            tarefas_sem_responsavel
        ),
        "tarefas_sem_prazo": (
            tarefas_sem_prazo
        ),
        "responsaveis": responsaveis,
        "inicio_projeto": (
            min(
                datas_inicio
            ).isoformat()
            if datas_inicio
            else None
        ),
        "fim_planejado": (
            max(
                datas_prazo
            ).isoformat()
            if datas_prazo
            else None
        ),
        "proximo_vencimento": (
            proximo_vencimento.isoformat()
            if proximo_vencimento
            else None
        ),
        "golive_planejado": (
            golive_planejado.isoformat()
            if golive_planejado
            else None
        ),
        "dias_para_golive": dias_para_golive,
        "golive_status": golive_status,
        "tarefas_golive": [
            {
                "id": tarefa.get("id", ""),
                "titulo": tarefa.get("titulo", ""),
                "prazo": tarefa.get("prazo"),
                "sprint": tarefa.get("sprint"),
                "sprint_numero": tarefa.get("sprint_numero"),
            }
            for tarefa in tarefas_golive
        ],
        "sprints": sprints,
        "quantidade_sprints": len(sprints),
        "tarefas_sem_sprint": sum(
            1
            for tarefa in tarefas
            if tarefa.get("sprint_numero") is None
            and not tarefa.get("golive")
        ),
        "tarefas": tarefas,
    }


# ============================================================
# RESUMO / INSIGHTS
# ============================================================


def _montar_resumo(
    projetos: list[dict[str, Any]],
) -> dict[str, Any]:
    total_projetos = len(
        projetos
    )

    projetos_ativos = sum(
        1
        for projeto in projetos
        if projeto[
            "status"
        ] == "Ativo"
    )

    projetos_concluidos = sum(
        1
        for projeto in projetos
        if projeto[
            "status"
        ] == "Concluído"
    )

    projetos_sem_tarefas = sum(
        1
        for projeto in projetos
        if projeto[
            "status"
        ] == "Sem tarefas"
    )

    total_tarefas = sum(
        projeto[
            "quantidade_tarefas"
        ]
        for projeto in projetos
    )

    tarefas_concluidas = sum(
        projeto[
            "tarefas_concluidas"
        ]
        for projeto in projetos
    )

    tarefas_abertas = sum(
        projeto[
            "tarefas_abertas"
        ]
        for projeto in projetos
    )

    tarefas_atrasadas = sum(
        projeto[
            "tarefas_atrasadas"
        ]
        for projeto in projetos
    )

    progresso_medio = (
        round(
            sum(
                projeto[
                    "progresso_medio"
                ]
                for projeto in projetos
            )
            / total_projetos,
            2,
        )
        if total_projetos
        else 0
    )

    saude = Counter(
        projeto[
            "saude"
        ]
        for projeto in projetos
    )

    criticos = sorted(
        (
            projeto
            for projeto in projetos
            if projeto[
                "status"
            ] == "Ativo"
        ),
        key=lambda item: (
            item[
                "tarefas_atrasadas"
            ],
            -item[
                "progresso_medio"
            ],
        ),
        reverse=True,
    )[:10]

    return {
        "total_projetos": total_projetos,
        "projetos_ativos": projetos_ativos,
        "projetos_concluidos": projetos_concluidos,
        "projetos_sem_tarefas": projetos_sem_tarefas,
        "total_tarefas": total_tarefas,
        "tarefas_concluidas": tarefas_concluidas,
        "tarefas_abertas": tarefas_abertas,
        "tarefas_atrasadas": tarefas_atrasadas,
        "progresso_medio_projetos": progresso_medio,
        "saude": dict(
            saude
        ),
        "projetos_criticos": [
            {
                "id": projeto[
                    "id"
                ],
                "nome": projeto[
                    "nome"
                ],
                "saude": projeto[
                    "saude"
                ],
                "progresso_medio": projeto[
                    "progresso_medio"
                ],
                "tarefas_atrasadas": projeto[
                    "tarefas_atrasadas"
                ],
                "tarefas_abertas": projeto[
                    "tarefas_abertas"
                ],
            }
            for projeto in criticos
        ],
    }


def _montar_payload() -> dict[str, Any]:
    token = _obter_token()

    agora = _agora()

    usuarios = CacheUsuarios(
        token
    )

    grupos = _obter_grupos(
        token
    )

    projetos = []

    planos_vistos = set()

    for grupo in grupos:
        group_id = grupo.get(
            "id",
            "",
        )

        if not group_id:
            continue

        planos = _obter_planos_grupo(
            token,
            group_id,
        )

        for plano in planos:
            plan_id = plano.get("id", "")
            plan_title = (plano.get("title", "") or "").strip()

            # O Graph devolve todos os planos do grupo; o filtro de negócio
            # é aplicado aqui antes de buscar tasks/buckets/details.
            if not plan_title.upper().startswith("BACKLOG"):
                continue

            if not plan_id or plan_id in planos_vistos:
                continue

            planos_vistos.add(plan_id)

            try:
                detalhes_plano = _obter_detalhes_plano(token, plan_id)
                buckets = _obter_buckets(token, plan_id)
                tarefas = _obter_tarefas(token, plan_id)

                projeto = _montar_projeto(
                    plano,
                    grupo,
                    tarefas,
                    buckets,
                    detalhes_plano,
                    usuarios,
                    agora,
                )

                projetos.append(
                    projeto
                )

            except Exception as erro:
                projetos.append({
                    "id": plan_id,
                    "nome": plano.get(
                        "title",
                        "",
                    ),
                    "grupo": {
                        "id": group_id,
                        "nome": grupo.get(
                            "displayName",
                            "",
                        ),
                        "email": grupo.get(
                            "mail",
                            "",
                        ),
                    },
                    "criado_em": _iso_local(
                        plano.get(
                            "createdDateTime"
                        )
                    ),
                    "status": "Erro",
                    "saude": "Erro",
                    "progresso_medio": 0,
                    "quantidade_tarefas": 0,
                    "tarefas_concluidas": 0,
                    "tarefas_abertas": 0,
                    "tarefas_atrasadas": 0,
                    "tarefas_proximos_7_dias": 0,
                    "tarefas_sem_responsavel": 0,
                    "tarefas_sem_prazo": 0,
                    "responsaveis": [],
                    "inicio_projeto": None,
                    "fim_planejado": None,
                    "proximo_vencimento": None,
                    "tarefas": [],
                    "erro": str(
                        erro
                    ),
                })

    projetos.sort(
        key=lambda item: (
            item.get(
                "nome",
                "",
            ).lower()
        )
    )

    projetos_ativos = [p for p in projetos if p.get("status") == "Ativo"]
    projetos_concluidos = [p for p in projetos if p.get("status") == "Concluído"]
    projetos_sem_tarefas = [p for p in projetos if p.get("status") == "Sem tarefas"]

    resumo = _montar_resumo(projetos)
    resumo["backlogs_ativos"] = len(projetos_ativos)
    resumo["backlogs_concluidos"] = len(projetos_concluidos)
    resumo["backlogs_sem_tarefas"] = len(projetos_sem_tarefas)

    return {
        "metadata": {
            "gerado_em": agora.isoformat(),
            "timezone": LOCAL_TIMEZONE_NAME,
            "cache_seconds": CACHE_SECONDS,
            "fonte": "Microsoft Graph / Planner",
            "filtro_plano": "Nome iniciado por BACKLOG",
            "regra_sprint": "O marco SPRINT N inicia o bloco; as tarefas seguintes pertencem à Sprint até o próximo marco, respeitando a ordem do Planner.",
        },
        "resumo": resumo,
        "projetos": projetos_ativos,
        "projetos_concluidos": projetos_concluidos,
        "projetos_sem_tarefas": projetos_sem_tarefas,
    }



def _aplicar_responsaveis_manuais_payload(
    payload_base: dict[str, Any],
) -> dict[str, Any]:
    """
    Sobrepõe os responsáveis do Workspace no snapshot do Planner.

    O snapshot Graph continua em cache. Responsáveis manuais são lidos
    diretamente do banco a cada chamada, então uma inclusão/remoção não
    exige nova sincronização completa com o Microsoft Graph.
    """
    payload = copy.deepcopy(payload_base)
    mapas = _carregar_responsaveis_manuais()

    listas = [
        payload.get("projetos") or [],
        payload.get("projetos_concluidos") or [],
        payload.get("projetos_sem_tarefas") or [],
    ]

    for projetos in listas:
        for projeto in projetos:
            plan_id = projeto.get("id", "")
            projeto_manuais = mapas["projeto"].get(plan_id, [])
            todos_manuais = [*projeto_manuais]

            for tarefa in projeto.get("tarefas") or []:
                manuais = mapas["tarefa"].get(
                    (plan_id, tarefa.get("id", "")),
                    [],
                )
                tarefa["responsaveis_manuais"] = manuais
                tarefa["responsaveis"] = _mesclar_responsaveis(
                    tarefa.get("responsaveis") or [],
                    manuais,
                )
                tarefa["responsaveis_nomes"] = _nomes_responsaveis(
                    tarefa["responsaveis"]
                )
                todos_manuais.extend(manuais)

            for sprint in projeto.get("sprints") or []:
                numero = sprint.get("numero")
                manuais = mapas["sprint"].get(
                    (plan_id, int(numero))
                    if numero is not None
                    else (plan_id, -1),
                    [],
                )
                sprint["responsaveis_manuais"] = manuais
                sprint["responsaveis"] = sorted(set([
                    *(sprint.get("responsaveis") or []),
                    *_nomes_responsaveis(manuais),
                ]))
                todos_manuais.extend(manuais)

            projeto["responsaveis_manuais"] = projeto_manuais
            projeto["responsaveis_manuais_todos"] = todos_manuais
            projeto["responsaveis"] = sorted(set([
                *(projeto.get("responsaveis") or []),
                *_nomes_responsaveis(todos_manuais),
            ]))

            projeto["tarefas_sem_responsavel"] = sum(
                1
                for tarefa in projeto.get("tarefas") or []
                if not tarefa.get("responsaveis")
            )

    return payload


# ============================================================
# API PÚBLICA DO SERVICE
# ============================================================


def obter_dashboard_projetos(
    force_refresh: bool = False,
) -> dict[str, Any]:
    """
    Retorna o dashboard consolidado.

    O cache guarda somente o snapshot do Planner/Graph. Os responsáveis
    manuais do Workspace são aplicados depois do cache.
    """
    payload_base = None

    if not force_refresh:
        payload_base = cache.get(CACHE_KEY)

    if payload_base is None:
        payload_base = _montar_payload()
        cache.set(
            CACHE_KEY,
            payload_base,
            timeout=CACHE_SECONDS,
        )

    return _aplicar_responsaveis_manuais_payload(
        payload_base
    )


def limpar_cache_dashboard_projetos() -> None:
    cache.delete(
        CACHE_KEY
    )