import csv
import html
import json
import re
import logging
import sys
import threading
import urllib.request
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from typing import Any

from django.conf import settings
from django.utils import timezone as django_timezone


TICKETS_URL = (
    "https://uploads-tiflux.s3.sa-east-1.amazonaws.com/"
    "dw/fafbafb914e9f15b63d39d4577721ef019af2cfb20b31f9320f21c0b01c6c17c/"
    "9e053bf1118e5413ca7bf881664737ce26a24bab2d373ae7594d5f4ceebf0f6c/"
    "4717/tickets_latest.csv"
)

APONTAMENTOS_URL = (
    "https://uploads-tiflux.s3.sa-east-1.amazonaws.com/"
    "dw/fafbafb914e9f15b63d39d4577721ef019af2cfb20b31f9320f21c0b01c6c17c/"
    "9e053bf1118e5413ca7bf881664737ce26a24bab2d373ae7594d5f4ceebf0f6c/"
    "4717/ticket_appointments_latest.csv"
)


MESAS_PERMITIDAS = {
    "Sistemas",
    "Desenvolvimento",
    "Processos",
    "Projetos",
    "Processamento",
    "Integrações",
    "Congelado",
    "Acessos",
    "Business Intelligence",
}


SOLICITANTES_SISTEMAS = {
    "Arthur Costa",
    "Caio Siqueira",
    "Danilo Araujo Mendonça",
    "Eduarda Nascimento Oliveira",
    "Fernanda Lisboa",
    "Felipe Alexandrino",
    "Guilherme Trindade Ferreira",
    "Gustavo Dantas",
    "Renan Medeiros",
    "Rodrigo Sanches",
    "Gabriel Torrecilla",
}


DATA_INICIAL_HISTORICO = date(2025, 1, 1)
TEMPO_CACHE_HORAS = 6
TIMEOUT_DOWNLOAD_SEGUNDOS = 180

# Alterar esta versão invalida automaticamente caches antigos.
CACHE_SCHEMA_VERSION = 7

CACHE_DIRECTORY = (
    Path(settings.BASE_DIR)
    / "workspace"
    / "cache"
    / "tickets"
)

CACHE_FILE = CACHE_DIRECTORY / "tickets_cache.json"
_CACHE_LOCK = threading.Lock()
LOGGER = logging.getLogger(__name__)


def _aumentar_limite_csv() -> None:
    limite = sys.maxsize

    while True:
        try:
            csv.field_size_limit(limite)
            break
        except OverflowError:
            limite = limite // 10


def _normalizar_texto(valor: Any) -> str:
    if valor is None:
        return ""

    return str(valor).strip()


def _valor_ou_nao_informado(valor: Any) -> str:
    return _normalizar_texto(valor) or "Não informado"


def _html_para_texto(valor: Any) -> str:
    """Converte o HTML do description do TiFlux em texto legível."""
    texto = _normalizar_texto(valor)
    if not texto:
        return ""

    # O CSV pode trazer entidades HTML; decodifica antes de remover as tags.
    texto = html.unescape(texto).replace("\xa0", " ")

    # Remove conteúdos que não devem fazer parte da descrição textual.
    texto = re.sub(
        r"(?is)<(script|style)\b[^>]*>.*?</\1>",
        " ",
        texto,
    )

    # Preserva a estrutura sem manter marcação HTML.
    texto = re.sub(r"(?i)<br\s*/?>", "\n", texto)
    texto = re.sub(r"(?i)<li\b[^>]*>", "- ", texto)
    texto = re.sub(
        r"(?i)</(?:p|div|li|ul|ol|h[1-6]|tr|table|section|article)\s*>",
        "\n",
        texto,
    )
    texto = re.sub(r"<[^>]+>", " ", texto)

    linhas = []
    for linha in texto.splitlines():
        linha_limpa = re.sub(r"[ \t]+", " ", linha).strip()
        if linha_limpa:
            linhas.append(linha_limpa)

    return "\n".join(linhas).strip()


def _converter_data(valor: Any) -> datetime | None:
    texto = _normalizar_texto(valor)

    if not texto:
        return None

    texto = texto.replace("Z", "+00:00")

    formatos = (
        "%Y-%m-%d %H:%M:%S.%f",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
        "%d/%m/%Y %H:%M:%S",
        "%d/%m/%Y",
    )

    try:
        data_convertida = datetime.fromisoformat(texto)

        if data_convertida.tzinfo is not None:
            data_convertida = data_convertida.astimezone(
                timezone.utc
            ).replace(tzinfo=None)

        return data_convertida
    except ValueError:
        pass

    for formato in formatos:
        try:
            return datetime.strptime(texto, formato)
        except ValueError:
            continue

    return None


def _data_iso(valor: Any) -> str:
    data_convertida = _converter_data(valor)

    if data_convertida is None:
        return ""

    return data_convertida.isoformat()


def _agora_local_naive() -> datetime:
    agora = django_timezone.now()
    if django_timezone.is_aware(agora):
        agora = django_timezone.localtime(agora)
    return agora.replace(tzinfo=None)


def _dias_aberto_ou_resolvido(
    data_criacao: Any,
    fechado: bool,
    solved_in_time: Any,
    agora: datetime | None = None,
) -> int | None:
    """Equivalente ao DATEDIFF(DataCriacao, DataFim, DAY) do dashboard."""
    inicio = _converter_data(data_criacao)
    if inicio is None:
        return None

    fim = None
    if fechado:
        fim = _converter_data(solved_in_time)

    if fim is None:
        fim = agora or datetime.utcnow()

    # DATEDIFF(..., DAY) trabalha com a passagem de limites de dia.
    return (fim.date() - inicio.date()).days


def _faixa_dias_aberto(dias: int | None) -> str:
    if dias is None:
        return "Sem data"
    if dias <= 2:
        return "0-2 dias"
    if dias <= 5:
        return "3-5 dias"
    if dias <= 10:
        return "6-10 dias"
    if dias <= 20:
        return "11-20 dias"
    return "+20 dias"


def _faixa_hora_criacao(data_criacao: Any) -> str:
    data = _converter_data(data_criacao)
    if data is None:
        return "Sem data"

    # Python: segunda=0 ... domingo=6.
    if data.weekday() > 4:
        return "Fora do Expediente"
    if data.hour < 8 or data.hour >= 18:
        return "Fora do Expediente"
    if data.hour < 12:
        return "Manhã Expediente"
    return "Tarde Expediente"


def _data_sem_hora_iso(valor: Any) -> str:
    data = _converter_data(valor)
    return data.date().isoformat() if data is not None else ""


def _minutos_expediente(inicio: Any, fim: Any) -> int | None:
    """Minutos úteis entre duas datas: seg-sex, das 08:00 às 18:00."""
    data_inicio = _converter_data(inicio)
    data_fim = _converter_data(fim)

    if data_inicio is None or data_fim is None or data_fim < data_inicio:
        return None

    total = 0
    dia = data_inicio.date()
    ultimo_dia = data_fim.date()

    while dia <= ultimo_dia:
        if dia.weekday() <= 4:
            inicio_dia = datetime.combine(dia, time(8, 0, 0))
            fim_dia = datetime.combine(dia, time(18, 0, 0))
            inicio_considerado = max(data_inicio, inicio_dia)
            fim_considerado = min(data_fim, fim_dia)

            if fim_considerado > inicio_considerado:
                # DAX DATEDIFF(..., MINUTE) conta limites de minuto atravessados.
                inicio_minuto = inicio_considerado.replace(second=0, microsecond=0)
                fim_minuto = fim_considerado.replace(second=0, microsecond=0)
                total += max(
                    0,
                    int((fim_minuto - inicio_minuto).total_seconds() // 60),
                )

        dia = date.fromordinal(dia.toordinal() + 1)

    return total


def _origem_ticket(ticket_cslog: Any) -> str:
    texto = _normalizar_texto(ticket_cslog)
    if texto.lower() == "não informado":
        texto = ""
    texto = texto.strip()

    if texto.startswith("#") and len(texto) > 1:
        return "METADADOS"
    if texto:
        return "CSLOG"
    return "QORE"


def _dias_aberto(data_criacao: Any, data_fechamento: Any, hoje: date | None = None) -> int | None:
    inicio = _converter_data(data_criacao)
    if inicio is None:
        return None

    fim = _converter_data(data_fechamento)
    data_fim = fim.date() if fim is not None else (hoje or date.today())
    return (data_fim - inicio.date()).days


def _status_sla(data_fechamento: Any, data_solucao: Any, hoje: date | None = None) -> str:
    prazo = _converter_data(data_solucao)
    if prazo is None:
        # Mantém o comportamento do DAX informado: comparação com BLANK()
        # não atende a condição de "Em Dia".
        return "Em Atraso"

    fechamento = _converter_data(data_fechamento)
    referencia = fechamento.date() if fechamento is not None else (hoje or date.today())
    return "Em Dia" if referencia <= prazo.date() else "Em Atraso"


def _aplicar_campos_calculados(
    ticket: dict[str, Any],
    agora: datetime | None = None,
) -> dict[str, Any]:
    agora = agora or _agora_local_naive()
    hoje = agora.date()
    criacao = ticket.get("created_at") or ticket.get("data_criacao")
    fechamento = ticket.get("solved_in_time")
    prazo_atendimento = ticket.get("attend_expiration")
    prazo_solucao = ticket.get("solve_expiration")

    dias = _dias_aberto_ou_resolvido(
        criacao,
        bool(ticket.get("is_closed") or ticket.get("fechado")),
        fechamento,
        agora=agora,
    )

    # Medidas já existentes.
    ticket["dias_aberto_ou_resolvido"] = dias
    ticket["faixa_dias_aberto"] = _faixa_dias_aberto(dias)
    ticket["faixa_hora_criacao"] = _faixa_hora_criacao(criacao)

    # Equivalentes às colunas calculadas utilizadas no Power BI.
    ticket["prazo_real_primeiro_atendimento_minutos"] = _minutos_expediente(
        criacao,
        prazo_atendimento,
    )
    ticket["prazo_real_solucao_minutos"] = _minutos_expediente(
        criacao,
        prazo_solucao,
    )
    ticket["origem_ticket"] = _origem_ticket(ticket.get("ticket_cslog"))
    ticket["data_criacao_calculada"] = _data_sem_hora_iso(criacao)
    ticket["data_fechamento2"] = _data_sem_hora_iso(fechamento)
    ticket["data_solucao"] = _data_sem_hora_iso(prazo_solucao)
    ticket["dias_aberto"] = _dias_aberto(criacao, fechamento, hoje=hoje)
    ticket["status_sla"] = _status_sla(fechamento, prazo_solucao, hoje=hoje)

    return ticket


def _tratar_solicitante(nome: Any) -> str:
    nome_normalizado = _normalizar_texto(nome)

    if nome_normalizado in SOLICITANTES_SISTEMAS:
        return "Sistemas"

    return nome_normalizado or "Não informado"


def _cache_valido(cache: dict[str, Any]) -> bool:
    if cache.get("cache_schema_version") != CACHE_SCHEMA_VERSION:
        return False

    atualizado_em = _converter_data(cache.get("atualizado_em"))

    if atualizado_em is None:
        return False

    limite = datetime.utcnow() - timedelta(hours=TEMPO_CACHE_HORAS)

    return atualizado_em >= limite


def _ler_cache() -> dict[str, Any] | None:
    if not CACHE_FILE.exists():
        return None

    try:
        with CACHE_FILE.open("r", encoding="utf-8") as arquivo:
            return json.load(arquivo)
    except (
        OSError,
        json.JSONDecodeError,
        TypeError,
        ValueError,
    ):
        return None


def _salvar_cache(dados: dict[str, Any]) -> None:
    CACHE_DIRECTORY.mkdir(parents=True, exist_ok=True)

    arquivo_temporario = CACHE_FILE.with_suffix(".tmp")

    with arquivo_temporario.open("w", encoding="utf-8") as arquivo:
        json.dump(
            dados,
            arquivo,
            ensure_ascii=False,
            indent=2,
        )

    arquivo_temporario.replace(CACHE_FILE)


def _montar_ticket(linha: dict[str, Any], data_criacao: datetime) -> dict[str, Any]:
    ticket_numero = (
        _normalizar_texto(linha.get("ticket_number"))
        or _normalizar_texto(linha.get("id"))
    )

    solicitante_original = _valor_ou_nao_informado(linha.get("requestor_name"))
    solicitante = _tratar_solicitante(linha.get("requestor_name"))

    # Campos adicionais disponibilizados pelo tickets_latest.csv.
    requestor_email = _normalizar_texto(linha.get("requestor_email"))
    responsible_email = _normalizar_texto(linha.get("responsible_email"))
    followers = _normalizar_texto(linha.get("followers"))

    # Equivalente a:
    # tickets_latest[services_catalogs_area_name] & " > " &
    # tickets_latest[services_catalogs_item_name]
    servico_area = _normalizar_texto(linha.get("services_catalogs_area_name"))
    servico_item = _normalizar_texto(linha.get("services_catalogs_item_name"))
    # Campo consumido pelo módulo Projetos. Evita valores artificiais como
    # " > " quando uma das partes estiver vazia.
    servico_completo = " > ".join(
        parte for parte in (servico_area, servico_item) if parte
    )

    fechado = _normalizar_texto(linha.get("is_closed")).lower() in {
        "true",
        "1",
        "sim",
        "yes",
    }

    ticket = {
        # Colunas solicitadas do tickets_latest.csv.
        "title": _valor_ou_nao_informado(linha.get("title")),
        "description": _html_para_texto(linha.get("description")) or "Não informado",
        "solve_expiration": _data_iso(linha.get("solve_expiration")),
        "attend_sla_solution": _valor_ou_nao_informado(
            linha.get("attend_sla_solution")
        ),
        "requestor_name": solicitante,
        # Preserva o nome real para a integração com Stakeholder do projeto.
        "requestor_name_original": solicitante_original,
        "requestor_email": requestor_email,
        "created_at": _data_iso(linha.get("created_at")) or data_criacao.isoformat(),
        "updated_at": _data_iso(linha.get("updated_at")),
        "solved_in_time": _data_iso(linha.get("solved_in_time")),
        "is_closed": fechado,
        "ticket_number": ticket_numero,
        "attend_expiration": _data_iso(linha.get("attend_expiration")),
        "attend_first_sla_attendance": _valor_ou_nao_informado(
            linha.get("attend_first_sla_attendance")
        ),
        "last_answer_type": _valor_ou_nao_informado(
            linha.get("last_answer_type")
        ),
        "desk_name": _valor_ou_nao_informado(linha.get("desk_name")),
        "stage_name": _valor_ou_nao_informado(linha.get("stage_name")),
        "client_name": _valor_ou_nao_informado(linha.get("client_name")),
        "responsible_name": _valor_ou_nao_informado(
            linha.get("responsible_name")
        ),
        "responsible_email": responsible_email,
        "followers": followers,
        "services_catalogs_item_name": _valor_ou_nao_informado(
            linha.get("services_catalogs_item_name")
        ),
        "services_catalogs_area_name": _valor_ou_nao_informado(
            linha.get("services_catalogs_area_name")
        ),
        # Mantém os dois nomes para compatibilidade entre dashboard e Projetos.
        "Servico_Completo": servico_completo,
        "servico_completo": servico_completo,
        "services_catalog_name": _valor_ou_nao_informado(
            linha.get("services_catalog_name")
        ),
        "ticket_cslog": _valor_ou_nao_informado(
            linha.get("Sistemas-Ticket CSLOG-NÃO PREENCHER")
        ),
        "categoria": _valor_ou_nao_informado(
            linha.get("Categoria-Categoria")
        ),
        "empresa": _valor_ou_nao_informado(
            linha.get("Empresa-Empresa")
        ),
        "nome_projeto": _valor_ou_nao_informado(
            linha.get("Nome projeto-Nome projeto")
        ),

        # Chaves compatíveis com a versão anterior do dashboard.
        "ticket": ticket_numero,
        "data_criacao": data_criacao.isoformat(),
        "mesa": _valor_ou_nao_informado(linha.get("desk_name")),
        "solicitante": solicitante,
        "cliente": _valor_ou_nao_informado(linha.get("client_name")),
        "responsavel": _valor_ou_nao_informado(
            linha.get("responsible_name")
        ),
        "estagio": _valor_ou_nao_informado(linha.get("stage_name")),
        "status": _valor_ou_nao_informado(linha.get("status_name")),
        "fechado": fechado,
    }

    return _aplicar_campos_calculados(ticket)


def _baixar_e_processar_tickets() -> dict[str, Any]:
    _aumentar_limite_csv()

    requisicao = urllib.request.Request(
        TICKETS_URL,
        headers={
            "User-Agent": "Workspace-Tickets-Dashboard/2.0",
            "Accept": "text/csv,application/octet-stream,*/*",
        },
    )

    tickets: list[dict[str, Any]] = []
    tickets_encontrados: set[str] = set()
    total_linhas_fonte = 0
    menor_data: datetime | None = None
    maior_data: datetime | None = None

    with urllib.request.urlopen(
        requisicao,
        timeout=TIMEOUT_DOWNLOAD_SEGUNDOS,
    ) as resposta:
        linhas = (
            linha.decode("utf-8-sig", errors="replace")
            for linha in resposta
        )

        leitor = csv.DictReader(linhas, delimiter="\t")

        for linha in leitor:
            total_linhas_fonte += 1

            mesa = _normalizar_texto(linha.get("desk_name"))

            if mesa not in MESAS_PERMITIDAS:
                continue

            data_criacao = (
                _converter_data(linha.get("new_created_date"))
                or _converter_data(linha.get("created_at"))
            )

            if data_criacao is None:
                continue

            if data_criacao.date() < DATA_INICIAL_HISTORICO:
                continue

            ticket_numero = (
                _normalizar_texto(linha.get("ticket_number"))
                or _normalizar_texto(linha.get("id"))
            )

            if not ticket_numero or ticket_numero in tickets_encontrados:
                continue

            tickets_encontrados.add(ticket_numero)

            if menor_data is None or data_criacao < menor_data:
                menor_data = data_criacao

            if maior_data is None or data_criacao > maior_data:
                maior_data = data_criacao

            tickets.append(_montar_ticket(linha, data_criacao))

    return {
        "sucesso": True,
        "cache_preservado": False,
        "cache_schema_version": CACHE_SCHEMA_VERSION,
        "atualizado_em": datetime.utcnow().isoformat(),
        "data_inicial_historico": DATA_INICIAL_HISTORICO.isoformat(),
        "primeira_data_encontrada": (
            menor_data.isoformat() if menor_data else None
        ),
        "ultima_data_encontrada": (
            maior_data.isoformat() if maior_data else None
        ),
        "total_linhas_fonte": total_linhas_fonte,
        "total_tickets": len(tickets),
        "tickets": tickets,
    }


def obter_dados_tickets(
    forcar_atualizacao: bool = False,
) -> dict[str, Any]:
    cache = _ler_cache()

    if not forcar_atualizacao and cache and _cache_valido(cache):
        cache["origem_dados"] = "cache"
        return cache

    with _CACHE_LOCK:
        cache = _ler_cache()

        if not forcar_atualizacao and cache and _cache_valido(cache):
            cache["origem_dados"] = "cache"
            return cache

        try:
            dados = _baixar_e_processar_tickets()
            dados["origem_dados"] = "fonte"
            _salvar_cache(dados)
            return dados

        except Exception as erro:
            cache_anterior = _ler_cache()

            # Cache anterior só é reutilizado se já possuir o schema novo.
            if (
                cache_anterior
                and cache_anterior.get("cache_schema_version")
                == CACHE_SCHEMA_VERSION
            ):
                cache_anterior["sucesso"] = True
                cache_anterior["cache_preservado"] = True
                cache_anterior["origem_dados"] = "cache_preservado"
                cache_anterior["aviso"] = (
                    "Não foi possível atualizar a fonte. "
                    "O último cache disponível foi mantido."
                )
                cache_anterior["erro_atualizacao"] = str(erro)
                return cache_anterior

            return {
                "sucesso": False,
                "cache_preservado": False,
                "origem_dados": "indisponivel",
                "total_tickets": 0,
                "tickets": [],
                "erro": str(erro),
            }


def obter_resumo_tickets(
    data_inicial: date | None = None,
    data_final: date | None = None,
    forcar_atualizacao: bool = False,
) -> dict[str, Any]:
    if data_inicial is None:
        data_inicial = DATA_INICIAL_HISTORICO

    if data_final is None:
        data_final = date.today()

    if data_inicial > data_final:
        return {
            "sucesso": False,
            "total_tickets": 0,
            "erro": "A data inicial não pode ser maior que a data final.",
        }

    dados = obter_dados_tickets(
        forcar_atualizacao=forcar_atualizacao
    )

    if not dados.get("sucesso"):
        return {
            **dados,
            "data_inicial": data_inicial.isoformat(),
            "data_final": data_final.isoformat(),
        }

    # Campos baseados em NOW() são recalculados a cada consulta, inclusive
    # quando os dados brutos vierem do cache de 6 horas.
    agora_calculo = _agora_local_naive()
    for ticket in dados.get("tickets", []):
        _aplicar_campos_calculados(ticket, agora=agora_calculo)

    integracao_projetos = {
        "disponivel": True,
        "projetos_criados": 0,
        "tickets_vinculados": 0,
        "erros": 0,
    }
    try:
        from workspace.services.projeto_tiflux_service import (
            sincronizar_tickets_com_projetos,
        )

        resumo_integracao = sincronizar_tickets_com_projetos(
            dados.get("tickets", []),
            criar_rascunhos=getattr(
                settings,
                "TIFLUX_AUTO_CRIAR_PROJETOS",
                True,
            ),
        )
        integracao_projetos.update(resumo_integracao)
    except Exception as erro:
        # O dashboard continua funcionando durante a implantação anterior ao migrate.
        LOGGER.exception("Integração entre tickets TiFlux e projetos indisponível")
        integracao_projetos.update({
            "disponivel": False,
            "erro": str(erro) if settings.DEBUG else "",
        })

    tickets_periodo = []

    for ticket in dados.get("tickets", []):
        data_criacao = _converter_data(ticket.get("data_criacao"))

        if data_criacao is None:
            continue

        if data_inicial <= data_criacao.date() <= data_final:
            tickets_periodo.append(ticket)

    return {
        "sucesso": True,
        "cache_preservado": dados.get("cache_preservado", False),
        "origem_dados": dados.get("origem_dados"),
        "atualizado_em": dados.get("atualizado_em"),
        "ultima_data_encontrada": dados.get("ultima_data_encontrada"),
        "data_inicial": data_inicial.isoformat(),
        "data_final": data_final.isoformat(),
        "total_tickets": len(tickets_periodo),
        "tickets": tickets_periodo,
        "integracao_projetos": integracao_projetos,
        "aviso": dados.get("aviso"),
    }
