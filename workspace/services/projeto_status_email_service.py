from __future__ import annotations

import base64
import binascii
import logging
from io import BytesIO
from typing import Any, Iterable

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.html import strip_tags
from openpyxl import Workbook
from openpyxl.styles import Font

from workspace.models import (
    Projeto,
    ProjetoHistorico,
    ProjetoHistoricoAcao,
    ProjetoHistoricoEntidade,
    ProjetoTarefaStatus,
)
from workspace.services.projeto_participantes_service import stakeholder_do_projeto
from workspace.services.projeto_cslog_service import (
    calcular_media_horas_cslog_dia,
    calcular_metricas_horas_qore,
    status_fornecedor_calculado,
)
from workspace.services.regras_service import calcular_saude_projeto, resumo_fluxo_projeto


LOGGER = logging.getLogger(__name__)
MAX_GANTT_BYTES = 8 * 1024 * 1024


def _texto(valor: Any) -> str:
    return str(valor or "").strip()


def _data_br(valor) -> str:
    return valor.strftime("%d/%m/%Y") if valor else "—"


def _nome_pessoa(pessoa) -> str:
    if not pessoa:
        return "—"
    return _texto(getattr(pessoa, "nome", "")) or _texto(pessoa)


def _numero_tiflux(projeto: Projeto) -> str:
    """Retorna o número do ticket TiFlux vinculado ao projeto, com fallback na referência."""
    try:
        for link in projeto.tickets_tiflux.all():
            numero = _texto(getattr(link, "ticket_number", ""))
            if numero:
                return numero
    except Exception:
        pass
    return _texto(getattr(projeto, "referencia", ""))


def _seguidores_tiflux(projeto: Projeto) -> list[str]:
    seguidores: list[str] = []
    try:
        for link in projeto.tickets_tiflux.all():
            seguidores.extend(
                normalizar_emails(getattr(link, "followers_emails_tiflux", []) or [])
            )
    except Exception:
        pass
    return normalizar_emails(seguidores)


def _responsaveis_projeto(projeto: Projeto) -> list[str]:
    nomes: list[str] = []
    vistos: set[str] = set()
    try:
        vinculos = projeto.vinculos_membros.select_related("pessoa").filter(
            ativo=True,
            e_responsavel=True,
            pessoa__ativo=True,
        )
        for vinculo in vinculos:
            nome = _nome_pessoa(vinculo.pessoa)
            chave = nome.casefold()
            if nome != "—" and chave not in vistos:
                vistos.add(chave)
                nomes.append(nome)
    except Exception:
        pass

    if not nomes and getattr(projeto, "responsavel", None):
        usuario = projeto.responsavel
        nome = (
            _texto(getattr(usuario, "nome", ""))
            or _texto(getattr(usuario, "get_full_name", lambda: "")())
            or _texto(getattr(usuario, "username", ""))
        )
        if nome:
            nomes.append(nome)

    if not nomes and getattr(projeto, "owner", None):
        nome = _nome_pessoa(projeto.owner)
        if nome != "—":
            nomes.append(nome)
    return nomes


def _dias_vencidos(data, hoje) -> int:
    if not data or data >= hoje:
        return 0
    return (hoje - data).days


def _resumo_apontamento(projeto: Projeto) -> dict[str, Any]:
    try:
        links = list(projeto.tickets_tiflux.all())
    except Exception:
        links = []
    segundos = sum(int(getattr(link, "apontamento_segundos_tiflux", 0) or 0) for link in links)
    horas = round(segundos / 3600, 2)
    metricas = calcular_metricas_horas_qore(projeto, horas_apontadas=horas)
    planejado = float(metricas.get("horas_planejadas") or 0)
    consumo = round(horas * 100 / planejado, 1) if planejado > 0 else None
    desvio = round(horas - planejado, 2) if planejado > 0 else None
    return {
        "horas": horas,
        "janela_util_horas": metricas.get("janela_util_horas"),
        "planejado_horas": planejado if planejado > 0 else None,
        "consumo_percentual": consumo,
        "desvio_horas": desvio,
        "media_planejada_dia": metricas.get("media_planejada_dia"),
        "media_apontada_dia": metricas.get("media_apontada_dia"),
        "dias_planejados": metricas.get("dias_planejados"),
        "dias_decorridos": metricas.get("dias_decorridos"),
    }


def _go_live_vigente(projeto: Projeto):
    tem_cslog = bool(_texto(getattr(projeto, "cslog", "")))
    qore = getattr(projeto, "data_go_live_prevista", None)
    if not tem_cslog:
        return qore, "QORE"
    fornecedor = getattr(projeto, "cslog_data_entrega_prevista", None)
    if fornecedor and qore:
        return qore, "CSLOG + folga QORE"
    if qore:
        return qore, "QORE preliminar"
    return None, "Aguardando CSLOG"


def _analise_gerencial(projeto: Projeto, snapshot: dict[str, Any]) -> list[str]:
    """Leitura executiva curta: onde estamos, dependência externa e próximo movimento."""
    progresso = float(snapshot.get("progresso") or 0)
    esperado = float(snapshot.get("progresso_esperado") or 0)
    etapa = snapshot.get("etapa_atual") or "—"
    momento = snapshot.get("momento") or "—"
    status = snapshot.get("status") or "—"
    atrasadas = snapshot.get("tarefas_atrasadas") or []
    proximas = snapshot.get("proximas_tarefas") or []

    linhas: list[str] = [
        f"Estamos em {etapa}, no momento {momento}, com {progresso:.0f}% do projeto concluído. "
        f"O status atual é {status}."
    ]

    if snapshot.get("tem_cslog"):
        status_cslog = snapshot.get("cslog_status") or "—"
        ticket = snapshot.get("cslog_ticket_aberto") or "—"
        escopo = snapshot.get("cslog_escopo_fechado") or "—"
        orcamento = snapshot.get("cslog_orcamento_recebido") or "—"
        inicio = snapshot.get("cslog_data_inicio") or "—"
        entrega = snapshot.get("cslog_entrega_prevista") or "—"
        horas = snapshot.get("cslog_horas_tecnicas")
        prazo = snapshot.get("cslog_prazo_dias_uteis")
        media = snapshot.get("cslog_media_horas_dia")

        if snapshot.get("cslog_entrega_real") not in {None, "", "—"}:
            linhas.append(
                f"Na CSLOG, a demanda foi aberta em {ticket}, o escopo foi fechado em {escopo}, "
                f"o orçamento foi recebido em {orcamento} e a execução iniciou em {inicio}. "
                f"A entrega real foi registrada em {snapshot.get('cslog_entrega_real')}."
            )
        elif inicio != "—":
            detalhe = []
            if horas is not None:
                detalhe.append(f"{float(horas):g} HTs")
            if prazo:
                detalhe.append(f"{int(prazo)} dias úteis")
            if media is not None:
                detalhe.append(f"média de {float(media):g}h/dia")
            complemento = f" ({', '.join(detalhe)})" if detalhe else ""
            linhas.append(
                f"Na CSLOG, o ticket foi aberto em {ticket}, o escopo foi fechado em {escopo} e o orçamento foi recebido em {orcamento}. "
                f"A contagem do prazo começou em {inicio}{complemento}, com entrega prevista para {entrega}. "
                f"Situação do fornecedor: {status_cslog}."
            )
        elif orcamento != "—":
            linhas.append(
                f"Na CSLOG, o ticket foi aberto em {ticket}, o escopo foi fechado em {escopo} e o orçamento foi recebido em {orcamento}. "
                f"Já existe uma previsão calculada de entrega em {entrega}, mas a contagem contratada ainda aguarda a data real de início do fornecedor."
            )
        elif escopo != "—":
            linhas.append(
                f"Na CSLOG, o ticket foi aberto em {ticket} e o escopo foi fechado em {escopo}. "
                "O próximo marco é o recebimento do orçamento, HTs e prazo para formar a previsão de entrega."
            )
        elif ticket != "—":
            linhas.append(
                f"A demanda já foi aberta na CSLOG em {ticket}. O fornecedor está no ciclo de análise/fechamento do escopo."
            )

        linhas.append(
            f"Com a referência atual do fornecedor, o cronograma QORE está posicionado para homologação em "
            f"{snapshot.get('homologacao_prevista') or '—'}, Go Live em {snapshot.get('go_live_previsto') or '—'} "
            f"e conclusão em {snapshot.get('conclusao_prevista') or '—'}."
        )
    else:
        linhas.append(
            f"O cronograma QORE segue com homologação prevista para {snapshot.get('homologacao_prevista') or '—'}, "
            f"Go Live em {snapshot.get('go_live_previsto') or '—'} e conclusão em {snapshot.get('conclusao_prevista') or '—'}."
        )

    if esperado > 0 and abs(esperado - progresso) >= 15:
        diferenca = esperado - progresso
        if diferenca > 0:
            linhas.append(
                f"O avanço realizado está {diferenca:.0f} p.p. abaixo do esperado ({progresso:.0f}% realizado x {esperado:.0f}% esperado)."
            )
        else:
            linhas.append(
                f"O avanço realizado está {abs(diferenca):.0f} p.p. acima do esperado ({progresso:.0f}% realizado x {esperado:.0f}% esperado)."
            )

    if proximas:
        proxima = proximas[0]
        prazo_txt = proxima.get("data_fim_prevista") or "—"
        responsavel = proxima.get("responsavel") or "—"
        linhas.append(
            f"Próximo movimento: {proxima.get('nome') or '—'} ({proxima.get('etapa') or '—'}), "
            f"previsto para {prazo_txt}, responsável {responsavel}."
        )

    if atrasadas:
        linhas.append(
            f"Há {len(atrasadas)} tarefa(s) aberta(s) com prazo vencido; os itens selecionados estão detalhados em Pontos de atenção."
        )

    apontamento = snapshot.get("apontamento") or {}
    if apontamento.get("planejado_horas"):
        horas = float(apontamento.get("horas") or 0)
        planejado = float(apontamento.get("planejado_horas") or 0)
        consumo = float(apontamento.get("consumo_percentual") or 0)
        linhas.append(
            f"Esforço QORE: {horas:.1f}h apontadas de {planejado:.1f}h planejadas ({consumo:.0f}% consumido)."
        )

    return linhas


def normalizar_emails(valores: Any) -> list[str]:
    """Aceita string com vírgula/; ou iteráveis e devolve e-mails válidos sem duplicar."""
    fila: list[str] = []
    if isinstance(valores, str):
        texto = valores.replace("\n", ";").replace(",", ";")
        fila.extend(item.strip() for item in texto.split(";") if item.strip())
    elif isinstance(valores, Iterable):
        for valor in valores:
            if isinstance(valor, str):
                fila.extend(normalizar_emails(valor))
    elif valores:
        fila.append(str(valores))

    resultado: list[str] = []
    vistos: set[str] = set()
    for email in fila:
        normalizado = _texto(email).lower()
        if not normalizado or normalizado in vistos:
            continue
        try:
            validate_email(normalizado)
        except ValidationError:
            continue
        vistos.add(normalizado)
        resultado.append(normalizado)
    return resultado


def destinatarios_sugeridos(projeto: Projeto) -> dict[str, list[str]]:
    para: list[str] = []
    cc: list[str] = []
    seguidores: list[str] = []
    for link in projeto.tickets_tiflux.all():
        para.extend(normalizar_emails(getattr(link, "requestor_email_tiflux", "")))
        cc.extend(normalizar_emails(getattr(link, "responsible_email_tiflux", "")))
        seguidores.extend(normalizar_emails(getattr(link, "followers_emails_tiflux", []) or []))

    para = normalizar_emails(para)
    cc = [email for email in normalizar_emails(cc) if email not in set(para)]
    seguidores = [
        email
        for email in normalizar_emails(seguidores)
        if email not in set(para) and email not in set(cc)
    ]
    if not para and cc:
        para = [cc.pop(0)]
    return {"para": para, "cc": cc, "seguidores": seguidores}


def _responsaveis_tarefa(tarefa) -> str:
    nomes = []
    try:
        nomes = [
            _nome_pessoa(vinculo.pessoa)
            for vinculo in tarefa.vinculos_responsaveis.all()
            if getattr(vinculo, "ativo", False) and getattr(vinculo, "pessoa", None)
        ]
    except Exception:
        nomes = []
    if not nomes and getattr(tarefa, "responsavel", None):
        usuario = tarefa.responsavel
        nomes = [
            _texto(getattr(usuario, "nome", ""))
            or _texto(getattr(usuario, "get_full_name", lambda: "")())
            or _texto(getattr(usuario, "username", ""))
        ]
    return ", ".join(item for item in nomes if item) or "—"


def _tarefas_ordenadas(projeto: Projeto):
    return list(
        projeto.tarefas.filter(ativo=True)
        .select_related("etapa", "responsavel")
        .prefetch_related("checklist", "vinculos_responsaveis__pessoa")
        .order_by("etapa__ordem", "ordem", "id")
    )


def _tarefas_atrasadas(projeto: Projeto, tarefas=None) -> list[dict[str, Any]]:
    hoje = timezone.localdate()
    tarefas = tarefas if tarefas is not None else _tarefas_ordenadas(projeto)
    saida = []
    for tarefa in tarefas:
        if tarefa.status in {ProjetoTarefaStatus.CONCLUIDA, ProjetoTarefaStatus.CANCELADA}:
            continue
        if not tarefa.data_fim_prevista or tarefa.data_fim_prevista >= hoje:
            continue
        saida.append({
            "id": tarefa.id,
            "nome": tarefa.nome,
            "etapa": tarefa.etapa.nome if tarefa.etapa_id else "Sem etapa",
            "responsavel": _responsaveis_tarefa(tarefa),
            "data_fim_prevista": _data_br(tarefa.data_fim_prevista),
            "dias_atraso": (hoje - tarefa.data_fim_prevista).days,
            "status": tarefa.get_status_display(),
            "progresso": float(tarefa.progresso or 0),
        })
    return saida


def _proximas_tarefas(projeto: Projeto, tarefas=None, limite=5) -> list[dict[str, Any]]:
    tarefas = tarefas if tarefas is not None else _tarefas_ordenadas(projeto)
    saida = []
    for tarefa in tarefas:
        if tarefa.status in {ProjetoTarefaStatus.CONCLUIDA, ProjetoTarefaStatus.CANCELADA}:
            continue
        saida.append({
            "nome": tarefa.nome,
            "etapa": tarefa.etapa.nome if tarefa.etapa_id else "Sem etapa",
            "responsavel": _responsaveis_tarefa(tarefa),
            "data_fim_prevista": _data_br(tarefa.data_fim_prevista),
            "status": tarefa.get_status_display(),
        })
        if len(saida) >= limite:
            break
    return saida


def _timeline_cslog(projeto: Projeto, snapshot: dict[str, Any]) -> list[dict[str, str]]:
    if not snapshot.get("tem_cslog"):
        return []
    eventos: list[dict[str, str]] = []

    def add(rotulo: str, valor, detalhe: str = ""):
        if valor and valor != "—":
            eventos.append({"rotulo": rotulo, "data": valor, "detalhe": detalhe})

    add("Ticket CSLOG aberto", snapshot.get("cslog_ticket_aberto"), "Entrada da demanda no fornecedor")
    add("Escopo CSLOG fechado", snapshot.get("cslog_escopo_fechado"), "Escopo técnico fechado pelo fornecedor")
    detalhe_orcamento = []
    if snapshot.get("cslog_horas_tecnicas") is not None:
        detalhe_orcamento.append(f"{float(snapshot['cslog_horas_tecnicas']):g} HTs")
    if snapshot.get("cslog_prazo_dias_uteis"):
        detalhe_orcamento.append(f"{int(snapshot['cslog_prazo_dias_uteis'])} dias úteis")
    if snapshot.get("cslog_media_horas_dia") is not None:
        detalhe_orcamento.append(f"{float(snapshot['cslog_media_horas_dia']):g}h/dia")
    add("Orçamento recebido", snapshot.get("cslog_orcamento_recebido"), " · ".join(detalhe_orcamento))
    add("Início da contagem CSLOG", snapshot.get("cslog_data_inicio"), "A partir daqui começa o prazo contratado")
    add("Entrega CSLOG prevista", snapshot.get("cslog_entrega_prevista"), snapshot.get("cslog_status") or "")
    add("Entrega CSLOG real", snapshot.get("cslog_entrega_real"), "Entrega efetivamente registrada")
    add("Homologação QORE", snapshot.get("homologacao_prevista"), "Marco QORE após o fornecedor")
    add("Go Live QORE", snapshot.get("go_live_previsto"), snapshot.get("go_live_origem") or "")
    return eventos


def montar_snapshot(projeto: Projeto, *, incluir_atrasos: bool = True) -> dict[str, Any]:
    tarefas = _tarefas_ordenadas(projeto)
    try:
        stakeholder = stakeholder_do_projeto(projeto)
    except Exception:
        stakeholder = None

    try:
        fluxo = resumo_fluxo_projeto(projeto)
    except Exception:
        fluxo = {}
    etapa_atual = fluxo.get("etapa_atual")
    if etapa_atual is None:
        etapas = [item for item in projeto.etapas.filter(ativo=True).order_by("ordem", "id")]
        for etapa in etapas:
            if float(etapa.progresso or 0) < 100:
                etapa_atual = etapa
                break
        etapa_atual = etapa_atual or (etapas[-1] if etapas else None)

    try:
        _, saude_nome, saude_motivo = calcular_saude_projeto(
            projeto,
            tarefas=tarefas,
            progresso=projeto.progresso,
            progresso_esperado=projeto.progresso_esperado,
        )
    except Exception:
        saude_nome = projeto.get_situacao_display()
        saude_motivo = ""

    responsaveis = _responsaveis_projeto(projeto)
    data_abertura = projeto.data_abertura or (timezone.localtime(projeto.criado_em).date() if projeto.criado_em else None)
    tem_cslog = bool(_texto(getattr(projeto, "cslog", "")))
    go_live_vigente, go_live_origem = _go_live_vigente(projeto)
    apontamento = _resumo_apontamento(projeto)
    snapshot = {
        "codigo": projeto.codigo or f"PRJ-{projeto.id}",
        "ticket_tiflux": _numero_tiflux(projeto),
        "nome": projeto.nome,
        "status": projeto.get_status_display(),
        "saude": saude_nome,
        "saude_motivo": saude_motivo,
        "progresso": float(projeto.progresso or 0),
        "progresso_esperado": float(projeto.progresso_esperado or 0),
        "momento": (
            fluxo.get("momento_nome")
            or (etapa_atual.get_momento_display() if etapa_atual and getattr(etapa_atual, "momento", None) else "—")
        ),
        "metodologia": projeto.get_metodologia_display(),
        "etapa_atual": etapa_atual.nome if etapa_atual else "—",
        "owner": _nome_pessoa(getattr(projeto, "owner", None)),
        "stakeholder": _nome_pessoa(stakeholder),
        "responsaveis": responsaveis,
        "responsaveis_texto": ", ".join(responsaveis) or "—",
        "cliente": _texto(getattr(getattr(projeto, "cliente", None), "nome", "")) or _texto(getattr(projeto, "cliente_nome", "")) or "—",
        "empresa": _texto(getattr(projeto, "empresa_nome", "")) or "—",
        "data_abertura": _data_br(data_abertura),
        "data_inicio": _data_br(projeto.data_inicio),
        "homologacao_prevista": _data_br(getattr(projeto, "data_homologacao_prevista", None)),
        "go_live_previsto": _data_br(go_live_vigente) if go_live_vigente else ("Aguardando confirmação CSLOG" if tem_cslog else "—"),
        "go_live_origem": go_live_origem,
        "go_live_qore_preliminar": _data_br(
            getattr(projeto, "cslog_baseline_data_go_live", None)
            or getattr(projeto, "data_go_live_prevista", None)
        ),
        "conclusao_prevista": _data_br(projeto.data_fim_prevista),
        "tem_cslog": tem_cslog,
        "cslog_referencia": _texto(getattr(projeto, "cslog", "")) if tem_cslog else "",
        "cslog_status": status_fornecedor_calculado(projeto)[1] if tem_cslog else "",
        "cslog_ticket_aberto": _data_br(getattr(projeto, "cslog_ticket_aberto_em", None)) if tem_cslog else "—",
        "cslog_escopo_fechado": _data_br(getattr(projeto, "cslog_escopo_fechado_em", None)) if tem_cslog else "—",
        "cslog_orcamento_recebido": _data_br(getattr(projeto, "cslog_orcamento_recebido_em", None)) if tem_cslog else "—",
        "cslog_orcamento_valor": float(projeto.cslog_orcamento_valor) if tem_cslog and getattr(projeto, "cslog_orcamento_valor", None) is not None else None,
        "cslog_horas_tecnicas": float(projeto.cslog_horas_tecnicas) if tem_cslog and getattr(projeto, "cslog_horas_tecnicas", None) is not None else None,
        "cslog_media_horas_dia": calcular_media_horas_cslog_dia(projeto) if tem_cslog else None,
        "cslog_prazo_dias_uteis": int(projeto.cslog_prazo_dias_uteis) if tem_cslog and getattr(projeto, "cslog_prazo_dias_uteis", None) is not None else None,
        "cslog_data_inicio": _data_br(getattr(projeto, "cslog_data_inicio", None)) if tem_cslog else "—",
        "cslog_entrega_prevista": _data_br(getattr(projeto, "cslog_data_entrega_prevista", None)) if tem_cslog else "—",
        "cslog_entrega_real": _data_br(getattr(projeto, "cslog_data_entrega_real", None)) if tem_cslog else "—",
        "apontamento": apontamento,
        "tarefas_atrasadas": _tarefas_atrasadas(projeto, tarefas) if incluir_atrasos else [],
        "proximas_tarefas": _proximas_tarefas(projeto, tarefas),
        "gerado_em": timezone.localtime().strftime("%d/%m/%Y %H:%M"),
    }
    snapshot["timeline_cslog"] = _timeline_cslog(projeto, snapshot)
    snapshot["analise"] = _analise_gerencial(projeto, snapshot)
    return snapshot


def _excel_status(projeto: Projeto, snapshot: dict[str, Any]) -> bytes:
    workbook = Workbook()
    resumo = workbook.active
    resumo.title = "Resumo"
    resumo.append(["Status Report do Projeto", snapshot["codigo"]])
    resumo["A1"].font = Font(bold=True)
    resumo.append(["Ticket TiFlux", snapshot.get("ticket_tiflux") or "—"])
    resumo.append(["Projeto", snapshot["nome"]])
    resumo.append(["Status", snapshot["status"]])
    resumo.append(["Saúde", snapshot["saude"]])
    resumo.append(["Progresso", snapshot["progresso"] / 100])
    resumo["B6"].number_format = "0%"
    resumo.append(["Esperado", snapshot["progresso_esperado"] / 100])
    resumo["B7"].number_format = "0%"
    resumo.append(["Momento", snapshot["momento"]])
    resumo.append(["Etapa atual", snapshot["etapa_atual"]])
    resumo.append(["Metodologia", snapshot["metodologia"]])
    resumo.append(["Cliente", snapshot["cliente"]])
    resumo.append(["Empresa", snapshot["empresa"]])
    resumo.append(["Owner", snapshot["owner"]])
    resumo.append(["Stakeholder", snapshot["stakeholder"]])
    resumo.append(["Responsável(is) / líder(es)", snapshot["responsaveis_texto"]])
    resumo.append(["Data de abertura", snapshot["data_abertura"]])
    resumo.append(["Início do cronograma", snapshot["data_inicio"]])
    resumo.append(["Homologação prevista", snapshot["homologacao_prevista"]])
    resumo.append(["Go Live vigente", snapshot["go_live_previsto"]])
    resumo.append(["Origem do Go Live", snapshot.get("go_live_origem") or "—"])
    resumo.append(["Go Live preliminar QORE", snapshot.get("go_live_qore_preliminar") or "—"])
    resumo.append(["Conclusão prevista", snapshot["conclusao_prevista"]])
    resumo.append(["Janela útil do projeto (h)", snapshot.get("apontamento", {}).get("janela_util_horas") or "—"])
    resumo.append(["Horas planejadas de esforço QORE", snapshot.get("apontamento", {}).get("planejado_horas") or "—"])
    resumo.append(["Apontamento real QORE (h)", snapshot.get("apontamento", {}).get("horas") or 0])
    resumo.append(["Média planejada de esforço QORE (h/dia)", snapshot.get("apontamento", {}).get("media_planejada_dia") or "—"])
    resumo.append(["Média apontada QORE (h/dia)", snapshot.get("apontamento", {}).get("media_apontada_dia") or "—"])
    resumo.append(["Consumo das horas planejadas (%)", snapshot.get("apontamento", {}).get("consumo_percentual") or "—"])
    if snapshot.get("tem_cslog"):
        resumo.append(["Referência CSLOG", snapshot.get("cslog_referencia") or "—"])
        resumo.append(["Status CSLOG", snapshot.get("cslog_status") or "—"])
        resumo.append(["Ticket aberto na CSLOG", snapshot.get("cslog_ticket_aberto") or "—"])
        resumo.append(["Escopo CSLOG fechado", snapshot.get("cslog_escopo_fechado") or "—"])
        resumo.append(["Orçamento recebido CSLOG", snapshot.get("cslog_orcamento_recebido") or "—"])
        resumo.append(["Horas técnicas CSLOG", snapshot.get("cslog_horas_tecnicas") or "—"])
        resumo.append(["Média técnica CSLOG (h/dia)", snapshot.get("cslog_media_horas_dia") or "—"])
        resumo.append(["Prazo CSLOG (dias úteis)", snapshot.get("cslog_prazo_dias_uteis") or "—"])
        resumo.append(["Início CSLOG", snapshot.get("cslog_data_inicio") or "—"])
        resumo.append(["Entrega confirmada CSLOG", snapshot.get("cslog_entrega_prevista") or "—"])
    resumo.append(["Análise gerencial", " ".join(snapshot.get("analise") or [])])
    resumo.column_dimensions["A"].width = 30
    resumo.column_dimensions["B"].width = 62

    cronograma = workbook.create_sheet("Cronograma")
    cronograma.append([
        "Tipo", "Etapa", "Item", "Responsável", "Início", "Fim previsto",
        "Status", "Progresso", "Subtarefas concluídas", "Subtarefas total",
    ])
    for cell in cronograma[1]:
        cell.font = Font(bold=True)
    for etapa in projeto.etapas.filter(ativo=True).order_by("ordem", "id"):
        cronograma.append([
            etapa.get_tipo_display(), etapa.nome, "", "",
            _data_br(etapa.data_inicio), _data_br(etapa.data_fim_prevista),
            "Concluída" if float(etapa.progresso or 0) >= 100 else "Em andamento",
            float(etapa.progresso or 0) / 100, "", "",
        ])
        cronograma.cell(cronograma.max_row, 8).number_format = "0%"
        for tarefa in etapa.tarefas.filter(ativo=True).prefetch_related("checklist", "vinculos_responsaveis__pessoa").order_by("ordem", "id"):
            checklist = [item for item in tarefa.checklist.all() if item.ativo]
            cronograma.append([
                "Tarefa", etapa.nome, tarefa.nome, _responsaveis_tarefa(tarefa),
                _data_br(tarefa.data_inicio), _data_br(tarefa.data_fim_prevista),
                tarefa.get_status_display(), float(tarefa.progresso or 0) / 100,
                sum(1 for item in checklist if item.concluido), len(checklist),
            ])
            cronograma.cell(cronograma.max_row, 8).number_format = "0%"
            for item in checklist:
                responsavel = _nome_pessoa(item.responsavel_pessoa) if item.responsavel_pessoa_id else "Herdado da tarefa"
                cronograma.append([
                    "Subtarefa", etapa.nome, item.descricao, responsavel,
                    _data_br(item.data_inicio), _data_br(item.data_fim_prevista),
                    "Concluída" if item.concluido else "Pendente",
                    1 if item.concluido else 0, "", "",
                ])
                cronograma.cell(cronograma.max_row, 8).number_format = "0%"

    for column in cronograma.columns:
        letter = column[0].column_letter
        cronograma.column_dimensions[letter].width = min(
            55,
            max(12, max(len(str(cell.value or "")) for cell in column) + 2),
        )
    cronograma.freeze_panes = "A2"
    cronograma.auto_filter.ref = cronograma.dimensions

    if snapshot.get("tarefas_atrasadas"):
        atrasos = workbook.create_sheet("Tarefas atrasadas")
        atrasos.append(["Etapa", "Tarefa", "Responsável", "Prazo", "Dias de atraso", "Status", "Progresso"])
        for cell in atrasos[1]:
            cell.font = Font(bold=True)
        for item in snapshot["tarefas_atrasadas"]:
            atrasos.append([
                item["etapa"], item["nome"], item["responsavel"],
                item["data_fim_prevista"], item["dias_atraso"], item["status"],
                item["progresso"] / 100,
            ])
            atrasos.cell(atrasos.max_row, 7).number_format = "0%"
        for column in atrasos.columns:
            letter = column[0].column_letter
            atrasos.column_dimensions[letter].width = min(55, max(12, max(len(str(c.value or "")) for c in column) + 2))

    output = BytesIO()
    workbook.save(output)
    return output.getvalue()


def _decodificar_gantt(data_url: str) -> tuple[bytes, str] | None:
    texto = _texto(data_url)
    if not texto:
        return None
    if "," not in texto or not texto.startswith("data:image/"):
        raise ValueError("Imagem do Gantt inválida.")
    cabecalho, conteudo = texto.split(",", 1)
    mime = cabecalho.split(";", 1)[0].replace("data:", "")
    if mime not in {"image/jpeg", "image/png"}:
        raise ValueError("Formato da imagem do Gantt não suportado.")
    try:
        dados = base64.b64decode(conteudo, validate=True)
    except (ValueError, binascii.Error) as erro:
        raise ValueError("Imagem do Gantt inválida.") from erro
    if len(dados) > MAX_GANTT_BYTES:
        raise ValueError("A imagem do Gantt excede o limite de 8 MB.")
    extensao = "jpg" if mime == "image/jpeg" else "png"
    return dados, extensao


def enviar_status_projeto(
    projeto: Projeto,
    *,
    usuario,
    para: Any,
    cc: Any = None,
    assunto: str = "",
    observacao: str = "",
    incluir_atrasos: bool = True,
    incluir_seguidores: bool = True,
    anexar_gantt: bool = True,
    anexar_excel: bool = True,
    gantt_data_url: str = "",
    projeto_url: str = "",
) -> dict[str, Any]:
    destinatarios = normalizar_emails(para)
    copias = [email for email in normalizar_emails(cc) if email not in set(destinatarios)]
    seguidores_incluidos: list[str] = []
    if incluir_seguidores:
        existentes = set(destinatarios) | set(copias)
        seguidores_incluidos = [email for email in _seguidores_tiflux(projeto) if email not in existentes]
        copias.extend(seguidores_incluidos)
    if not destinatarios:
        raise ValueError("Informe ao menos um destinatário válido em Para.")

    snapshot = montar_snapshot(projeto, incluir_atrasos=incluir_atrasos)
    data_assunto = timezone.localdate().strftime("%d/%m/%Y")
    referencia_assunto = snapshot.get("ticket_tiflux") or "TiFlux"
    assunto_final = _texto(assunto) or f"Status Report | {referencia_assunto} | {snapshot['nome']} | {data_assunto}"
    observacao = _texto(observacao)

    contexto = {
        "projeto": projeto,
        "snapshot": snapshot,
        "observacao": observacao,
        "projeto_url": projeto_url,
        "enviado_por": (
            _texto(getattr(usuario, "nome", ""))
            or _texto(getattr(usuario, "get_full_name", lambda: "")())
            or _texto(getattr(usuario, "username", ""))
            or "Workspace"
        ),
    }
    html = render_to_string("workspace/emails/projeto_status_report.html", contexto)
    texto_puro = strip_tags(html)
    remetente = getattr(settings, "DEFAULT_FROM_EMAIL", None) or "workspace@treo.com.br"
    reply_to = normalizar_emails(getattr(usuario, "email", ""))

    email = EmailMultiAlternatives(
        subject=assunto_final,
        body=texto_puro,
        from_email=remetente,
        to=destinatarios,
        cc=copias,
        reply_to=reply_to,
    )
    email.attach_alternative(html, "text/html")

    anexos = []
    codigo_arquivo = snapshot["codigo"].lower().replace("/", "-")
    if anexar_excel:
        nome_excel = f"status-report-{codigo_arquivo}.xlsx"
        email.attach(
            nome_excel,
            _excel_status(projeto, snapshot),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        anexos.append(nome_excel)

    if anexar_gantt:
        imagem = _decodificar_gantt(gantt_data_url)
        if not imagem:
            raise ValueError("Não foi possível gerar a imagem do Gantt para o envio.")
        dados_imagem, extensao = imagem
        nome_imagem = f"gantt-{codigo_arquivo}.{extensao}"
        email.attach(nome_imagem, dados_imagem, f"image/{'jpeg' if extensao == 'jpg' else 'png'}")
        anexos.append(nome_imagem)

    try:
        email.send(fail_silently=False)
    except Exception as erro:
        LOGGER.exception("Falha ao enviar Status Report do projeto %s", projeto.pk)
        raise ValueError(
            "Não foi possível enviar o Status Report pelo serviço de e-mail do Workspace."
        ) from erro

    ProjetoHistorico.objects.create(
        projeto=projeto,
        entidade=ProjetoHistoricoEntidade.PROJETO,
        entidade_id=projeto.id,
        acao=ProjetoHistoricoAcao.ALTERACAO,
        descricao=f"Status Report enviado para {', '.join(destinatarios)}.",
        dados_novos={
            "tipo": "status_report_email",
            "para": destinatarios,
            "cc": copias,
            "incluir_seguidores": bool(incluir_seguidores),
            "seguidores_incluidos": seguidores_incluidos,
            "assunto": assunto_final,
            "observacao": observacao,
            "anexos": anexos,
            "snapshot": snapshot,
        },
        usuario=usuario,
    )

    LOGGER.info(
        "Status Report de projeto enviado. projeto=%s para=%s cc=%s",
        projeto.pk,
        destinatarios,
        copias,
    )
    return {
        "sucesso": True,
        "mensagem": "Status Report enviado com sucesso.",
        "para": destinatarios,
        "cc": copias,
        "seguidores_incluidos": seguidores_incluidos,
        "anexos": anexos,
    }
