from __future__ import annotations

from datetime import timedelta

from django.db import transaction
from django.db.models import Max
from django.utils import timezone

from workspace.models import (
    CalendarioUtil,
    Projeto,
    ProjetoHistorico,
    ProjetoHistoricoAcao,
    ProjetoHistoricoEntidade,
    ProjetoMomento,
    ProjetoStatus,
    ProjetoTarefa,
    ProjetoTarefaCategoria,
    ProjetoTarefaChecklist,
    ProjetoTarefaStatus,
    ProjetoTarefaTipo,
)
from workspace.services.cronograma_service import somar_dias_uteis


TAREFA_ENVIO_CSLOG_NOME = "Preparar e enviar demanda para CSLOG"
TAREFA_ENVIO_CSLOG_DESCRICAO = (
    "Marco operacional de passagem QORE → CSLOG. A data final desta tarefa "
    "representa a data esperada para abrir/enviar a demanda ao fornecedor."
)
SUBTAREFAS_ENVIO_CSLOG = (
    "Consolidar requisitos levantados com o cliente",
    "Validar escopo e premissas com o cliente",
    "Organizar documentação, evidências e critérios de aceite",
    "Abrir/registrar a demanda na CSLOG",
    "Confirmar referência CSLOG e envio completo ao fornecedor",
)


def tarefa_e_envio_cslog(tarefa: ProjetoTarefa | None) -> bool:
    return bool(
        tarefa
        and str(getattr(tarefa, "nome", "") or "").strip().casefold()
        == TAREFA_ENVIO_CSLOG_NOME.casefold()
    )


def obter_tarefa_envio_cslog(projeto: Projeto) -> ProjetoTarefa | None:
    return (
        ProjetoTarefa.objects
        .filter(
            projeto=projeto,
            ativo=True,
            nome__iexact=TAREFA_ENVIO_CSLOG_NOME,
        )
        .select_related("etapa")
        .prefetch_related("checklist")
        .order_by("id")
        .first()
    )


def _etapa_planejamento_destino(projeto: Projeto):
    etapas = list(
        projeto.etapas
        .filter(ativo=True, fase_pai__isnull=True)
        .order_by("ordem", "id")
    )
    if not etapas:
        return None

    planejamento = [
        etapa
        for etapa in etapas
        if str(getattr(etapa, "momento", "") or "") == ProjetoMomento.PLANEJAMENTO
    ]
    if planejamento:
        return planejamento[-1]
    return etapas[0]


def _concluir_pela_data_real(tarefa: ProjetoTarefa, projeto: Projeto, usuario=None) -> bool:
    data_real = getattr(projeto, "cslog_ticket_aberto_em", None)
    if not data_real:
        return False

    alterou = False
    if tarefa.status != ProjetoTarefaStatus.CONCLUIDA:
        tarefa.status = ProjetoTarefaStatus.CONCLUIDA
        alterou = True
    if float(tarefa.progresso or 0) != 100:
        tarefa.progresso = 100
        alterou = True
    if tarefa.data_conclusao != data_real:
        tarefa.data_conclusao = data_real
        alterou = True
    if alterou:
        tarefa.atualizado_por = usuario
        tarefa.save(update_fields=[
            "status",
            "progresso",
            "data_conclusao",
            "atualizado_por",
            "atualizado_em",
        ])

    agora = timezone.now()
    for item in tarefa.checklist.filter(ativo=True):
        campos = []
        if not item.concluido:
            item.concluido = True
            campos.append("concluido")
        if item.concluido_em is None:
            item.concluido_em = agora
            campos.append("concluido_em")
        if usuario is not None and item.concluido_por_id != getattr(usuario, "pk", None):
            item.concluido_por = usuario
            campos.append("concluido_por")
        if campos:
            item.save(update_fields=[*campos, "atualizado_em"])
    return alterou


@transaction.atomic
def garantir_tarefa_envio_cslog(projeto: Projeto, usuario=None) -> ProjetoTarefa | None:
    """
    Garante a tarefa de passagem QORE → CSLOG somente em projetos com referência CSLOG.

    A tarefa nasce na última etapa de Planejamento. Sua data final representa a
    data esperada de acionamento do fornecedor. Quando cslog_ticket_aberto_em é
    informado, a tarefa e suas subtarefas são concluídas automaticamente usando
    essa data como realização real.
    """
    if not str(getattr(projeto, "cslog", "") or "").strip():
        return None

    tarefa = obter_tarefa_envio_cslog(projeto)
    if tarefa is None and projeto.status in {ProjetoStatus.CONCLUIDO, ProjetoStatus.CANCELADO}:
        return None

    etapa = _etapa_planejamento_destino(projeto)
    if tarefa is None and etapa is None:
        return None

    if tarefa is None:
        maior_ordem = (
            ProjetoTarefa.objects
            .filter(projeto=projeto, etapa=etapa, ativo=True)
            .aggregate(valor=Max("ordem"))
            .get("valor")
            or 0
        )
        tarefa = ProjetoTarefa.objects.create(
            projeto=projeto,
            etapa=etapa,
            nome=TAREFA_ENVIO_CSLOG_NOME,
            descricao=TAREFA_ENVIO_CSLOG_DESCRICAO,
            tipo=ProjetoTarefaTipo.TAREFA,
            categoria=ProjetoTarefaCategoria.PLANEJAMENTO,
            status=ProjetoTarefaStatus.NAO_INICIADA,
            prioridade=getattr(projeto, "prioridade", "media"),
            ordem=int(maior_ordem) + 1,
            data_inicio=getattr(etapa, "data_inicio", None),
            data_fim_prevista=getattr(etapa, "data_fim_prevista", None),
            progresso=0,
            peso=1,
            obrigatoria=True,
            criado_por=usuario,
            atualizado_por=usuario,
        )

    existentes = {
        str(item.descricao or "").strip().casefold(): item
        for item in tarefa.checklist.filter(ativo=True)
    }
    for ordem, descricao in enumerate(SUBTAREFAS_ENVIO_CSLOG, start=1):
        if descricao.casefold() in existentes:
            continue
        ProjetoTarefaChecklist.objects.create(
            tarefa=tarefa,
            descricao=descricao,
            ordem=ordem,
            herdar_responsavel_tarefa=True,
            data_inicio=tarefa.data_inicio,
            data_fim_prevista=tarefa.data_fim_prevista,
            criado_por=usuario,
        )

    _concluir_pela_data_real(tarefa, projeto, usuario=usuario)
    if projeto.status not in {ProjetoStatus.CONCLUIDO, ProjetoStatus.CANCELADO}:
        from workspace.services.regras_service import recalcular_projeto
        recalcular_projeto(projeto, usuario=usuario)
    return tarefa


@transaction.atomic
def sincronizar_ticket_aberto_por_tarefa(tarefa: ProjetoTarefa, usuario=None) -> Projeto | None:
    """Ao concluir a tarefa especial, registra a data real de abertura da CSLOG."""
    if not tarefa_e_envio_cslog(tarefa):
        return None

    projeto = Projeto.objects.select_for_update().get(pk=tarefa.projeto_id)
    if not str(projeto.cslog or "").strip():
        return projeto

    if tarefa.status == ProjetoTarefaStatus.CONCLUIDA and not projeto.cslog_ticket_aberto_em:
        projeto.cslog_ticket_aberto_em = tarefa.data_conclusao or timezone.localdate()
        projeto.save(update_fields=["cslog_ticket_aberto_em", "atualizado_em"])

    garantir_tarefa_envio_cslog(projeto, usuario=usuario)
    return projeto


# ============================================================
# REPLANEJAMENTO AUTOMÁTICO PELO PRAZO CSLOG
# ============================================================


def _mapa_calendario(inicio, fim):
    if not inicio or not fim:
        return {}
    menor, maior = sorted((inicio, fim))
    return {
        data: bool(dia_util)
        for data, dia_util in CalendarioUtil.objects.filter(
            data__gte=menor,
            data__lte=maior,
        ).values_list("data", "dia_util")
    }


def _e_dia_util(data, mapa=None):
    if data is None:
        return False
    mapa = mapa or {}
    if data in mapa:
        return bool(mapa[data])
    return data.weekday() < 5


def _diferenca_dias_uteis(inicio, fim):
    """Dias úteis transcorridos entre as datas, sem contar o dia inicial."""
    if not inicio or not fim or inicio == fim:
        return 0
    direcao = 1 if fim > inicio else -1
    mapa = _mapa_calendario(inicio, fim)
    atual = inicio
    total = 0
    while atual != fim:
        atual += timedelta(days=direcao)
        if _e_dia_util(atual, mapa):
            total += direcao
    return total


def _mover_dias_uteis(data, quantidade):
    if not data or not quantidade:
        return data
    quantidade = int(quantidade)
    if quantidade > 0:
        return somar_dias_uteis(data, quantidade)

    faltam = abs(quantidade)
    janela_inicio = data - timedelta(days=max(3700, faltam * 3))
    mapa = _mapa_calendario(janela_inicio, data)
    atual = data
    while faltam > 0:
        atual -= timedelta(days=1)
        if _e_dia_util(atual, mapa):
            faltam -= 1
    return atual


def _dias_uteis_inclusivos(inicio, fim):
    if not inicio or not fim or fim < inicio:
        return None
    mapa = _mapa_calendario(inicio, fim)
    atual = inicio
    total = 0
    while atual <= fim:
        if _e_dia_util(atual, mapa):
            total += 1
        atual += timedelta(days=1)
    return total



HORAS_UTEIS_QORE_POR_DIA = 10


def calcular_media_horas_cslog_dia(projeto: Projeto):
    """Retorna a média contratada de HTs por dia útil da CSLOG."""
    horas = getattr(projeto, "cslog_horas_tecnicas", None)
    prazo = int(getattr(projeto, "cslog_prazo_dias_uteis", 0) or 0)
    if horas is None or prazo <= 0:
        return None
    try:
        return round(float(horas) / prazo, 2)
    except (TypeError, ValueError, ZeroDivisionError):
        return None


def status_fornecedor_calculado(projeto: Projeto, hoje=None):
    """
    Deriva o status da CSLOG pelas datas do funil.
    O campo legado cslog_status_fornecedor permanece apenas por compatibilidade,
    mas não precisa mais ser editado na interface.
    """
    if not str(getattr(projeto, "cslog", "") or "").strip():
        return "", ""
    hoje = hoje or timezone.localdate()
    entrega_real = getattr(projeto, "cslog_data_entrega_real", None)
    entrega_prevista = getattr(projeto, "cslog_data_entrega_prevista", None)
    inicio = getattr(projeto, "cslog_data_inicio", None)
    orcamento = getattr(projeto, "cslog_orcamento_recebido_em", None)
    escopo = getattr(projeto, "cslog_escopo_fechado_em", None)
    ticket = getattr(projeto, "cslog_ticket_aberto_em", None)

    if entrega_real:
        return "entregue", "Entregue"
    if inicio:
        if entrega_prevista and hoje > entrega_prevista:
            return "em_atraso", "Em atraso"
        return "em_execucao", "Em execução"
    if orcamento:
        return "aguardando_inicio", "Aguardando início"
    if escopo:
        return "aguardando_orcamento", "Aguardando orçamento"
    if ticket:
        return "escopo_em_analise", "Escopo em análise"
    return "aguardando_abertura", "Aguardando abertura CSLOG"


def calcular_metricas_horas_qore(projeto: Projeto, horas_apontadas=0, hoje=None):
    """
    Separa janela de calendário, esforço planejado e esforço realizado da QORE.

    Regras:
    - janela útil do projeto = dias úteis do cronograma x 10h (08h às 18h);
      ela representa disponibilidade de calendário, NÃO esforço humano planejado;
    - horas planejadas de esforço = estimativa gerencial registrada no projeto;
    - média planejada = horas planejadas de esforço / dias úteis do cronograma;
    - horas apontadas = integração do TiFlux;
    - média apontada = horas apontadas / dias úteis efetivamente decorridos.
    """
    hoje = hoje or timezone.localdate()
    inicio = getattr(projeto, "data_inicio", None) or getattr(projeto, "data_abertura", None)
    entrega = getattr(projeto, "data_go_live_prevista", None) or getattr(projeto, "data_fim_prevista", None)

    dias_planejados = _dias_uteis_inclusivos(inicio, entrega) if inicio and entrega else None
    janela_util_horas = (
        float(dias_planejados * HORAS_UTEIS_QORE_POR_DIA)
        if dias_planejados is not None
        else None
    )

    horas_planejadas_raw = getattr(projeto, "horas_planejadas", None)
    try:
        horas_planejadas = (
            max(0.0, float(horas_planejadas_raw))
            if horas_planejadas_raw is not None
            else None
        )
    except (TypeError, ValueError):
        horas_planejadas = None

    media_planejada = (
        round(horas_planejadas / dias_planejados, 2)
        if horas_planejadas is not None and dias_planejados
        else None
    )

    fim_real = getattr(projeto, "data_conclusao", None) or hoje
    dias_decorridos = _dias_uteis_inclusivos(inicio, fim_real) if inicio and fim_real and fim_real >= inicio else None
    try:
        horas_real = max(0.0, float(horas_apontadas or 0))
    except (TypeError, ValueError):
        horas_real = 0.0
    media_apontada = (
        round(horas_real / dias_decorridos, 2)
        if dias_decorridos
        else None
    )
    return {
        "dias_planejados": dias_planejados,
        "janela_util_horas": janela_util_horas,
        "horas_planejadas": horas_planejadas,
        "media_planejada_dia": media_planejada,
        "dias_decorridos": dias_decorridos,
        "horas_apontadas": round(horas_real, 2),
        "media_apontada_dia": media_apontada,
    }


def _deve_replanejar_tarefa(tarefa: ProjetoTarefa) -> bool:
    if tarefa_e_envio_cslog(tarefa):
        return False
    if tarefa.status in {ProjetoTarefaStatus.CONCLUIDA, ProjetoTarefaStatus.CANCELADA}:
        return False
    etapa = getattr(tarefa, "etapa", None)
    if etapa is not None and etapa.momento == ProjetoMomento.PLANEJAMENTO:
        return False
    return True


def _deslocar_saldo_cronograma(projeto: Projeto, *, delta_dias_uteis: int, usuario=None):
    """
    Desloca somente o saldo futuro do cronograma.

    Planejamento já ocorrido permanece intacto. Fases/Sprints e tarefas de
    Execução, Homologação e Encerramento acompanham a nova data final. Itens já
    concluídos preservam integralmente suas datas; itens em andamento preservam
    o início e movem apenas o final.
    """
    if not delta_dias_uteis:
        return {"etapas": 0, "tarefas": 0, "subtarefas": 0}

    etapas_alteradas = 0
    tarefas_alteradas = 0
    subtarefas_alteradas = 0

    etapas = list(
        projeto.etapas.filter(ativo=True).order_by("ordem", "id")
    )
    for etapa in etapas:
        if etapa.momento == ProjetoMomento.PLANEJAMENTO:
            continue
        if etapa.data_conclusao or float(etapa.progresso or 0) >= 100:
            continue
        inicio_novo = etapa.data_inicio
        fim_novo = etapa.data_fim_prevista
        if float(etapa.progresso or 0) <= 0 and inicio_novo:
            inicio_novo = _mover_dias_uteis(inicio_novo, delta_dias_uteis)
        if fim_novo:
            fim_novo = _mover_dias_uteis(fim_novo, delta_dias_uteis)
        if inicio_novo and fim_novo and fim_novo < inicio_novo:
            fim_novo = inicio_novo
        if inicio_novo != etapa.data_inicio or fim_novo != etapa.data_fim_prevista:
            etapa.data_inicio = inicio_novo
            etapa.data_fim_prevista = fim_novo
            etapa.atualizado_por = usuario
            etapa.save(update_fields=[
                "data_inicio",
                "data_fim_prevista",
                "atualizado_por",
                "atualizado_em",
            ])
            etapas_alteradas += 1

    tarefas = list(
        ProjetoTarefa.objects
        .filter(projeto=projeto, ativo=True)
        .select_related("etapa")
        .prefetch_related("checklist")
        .order_by("etapa__ordem", "ordem", "id")
    )
    for tarefa in tarefas:
        if not _deve_replanejar_tarefa(tarefa):
            continue

        em_andamento = (
            tarefa.status == ProjetoTarefaStatus.EM_ANDAMENTO
            or float(tarefa.progresso or 0) > 0
        )
        inicio_novo = tarefa.data_inicio
        fim_novo = tarefa.data_fim_prevista
        if not em_andamento and inicio_novo:
            inicio_novo = _mover_dias_uteis(inicio_novo, delta_dias_uteis)
        if fim_novo:
            fim_novo = _mover_dias_uteis(fim_novo, delta_dias_uteis)
        if inicio_novo and fim_novo and fim_novo < inicio_novo:
            fim_novo = inicio_novo

        if inicio_novo != tarefa.data_inicio or fim_novo != tarefa.data_fim_prevista:
            tarefa.data_inicio = inicio_novo
            tarefa.data_fim_prevista = fim_novo
            tarefa.atualizado_por = usuario
            tarefa.save(update_fields=[
                "data_inicio",
                "data_fim_prevista",
                "atualizado_por",
                "atualizado_em",
            ])
            tarefas_alteradas += 1

        for item in tarefa.checklist.filter(ativo=True):
            if item.concluido:
                continue
            item_inicio = item.data_inicio
            item_fim = item.data_fim_prevista
            if not em_andamento and item_inicio:
                item_inicio = _mover_dias_uteis(item_inicio, delta_dias_uteis)
            if item_fim:
                item_fim = _mover_dias_uteis(item_fim, delta_dias_uteis)
            if item_inicio and item_fim and item_fim < item_inicio:
                item_fim = item_inicio
            if item_inicio != item.data_inicio or item_fim != item.data_fim_prevista:
                item.data_inicio = item_inicio
                item.data_fim_prevista = item_fim
                item.save(update_fields=["data_inicio", "data_fim_prevista", "atualizado_em"])
                subtarefas_alteradas += 1

    return {
        "etapas": etapas_alteradas,
        "tarefas": tarefas_alteradas,
        "subtarefas": subtarefas_alteradas,
    }




def _alinhar_momentos_finais(projeto: Projeto, *, homologacao_qore, go_live_qore, usuario=None):
    """Garante que Homologação e Encerramento não ocorram antes da entrega CSLOG."""
    etapas_alteradas = 0
    tarefas_alteradas = 0
    subtarefas_alteradas = 0

    for etapa in projeto.etapas.filter(ativo=True).order_by("ordem", "id"):
        if etapa.data_conclusao or float(etapa.progresso or 0) >= 100:
            continue
        if etapa.momento not in {ProjetoMomento.HOMOLOGACAO, ProjetoMomento.ENCERRAMENTO}:
            continue

        if etapa.momento == ProjetoMomento.HOMOLOGACAO:
            inicio_alvo = homologacao_qore
            fim_alvo = go_live_qore
        else:
            inicio_alvo = go_live_qore
            fim_alvo = go_live_qore

        etapa_inicio = etapa.data_inicio if float(etapa.progresso or 0) > 0 else inicio_alvo
        etapa_fim = fim_alvo
        if etapa_inicio and etapa_fim and etapa_fim < etapa_inicio:
            etapa_inicio = inicio_alvo
        if etapa.data_inicio != etapa_inicio or etapa.data_fim_prevista != etapa_fim:
            etapa.data_inicio = etapa_inicio
            etapa.data_fim_prevista = etapa_fim
            etapa.atualizado_por = usuario
            etapa.save(update_fields=[
                "data_inicio", "data_fim_prevista", "atualizado_por", "atualizado_em"
            ])
            etapas_alteradas += 1

        for tarefa in ProjetoTarefa.objects.filter(
            projeto=projeto, etapa=etapa, ativo=True
        ).prefetch_related("checklist"):
            if tarefa.status in {ProjetoTarefaStatus.CONCLUIDA, ProjetoTarefaStatus.CANCELADA}:
                continue
            em_andamento = tarefa.status == ProjetoTarefaStatus.EM_ANDAMENTO or float(tarefa.progresso or 0) > 0
            tarefa_inicio = tarefa.data_inicio if em_andamento else inicio_alvo
            tarefa_fim = fim_alvo
            if tarefa.tipo == ProjetoTarefaTipo.MARCO:
                tarefa_inicio = fim_alvo
                tarefa_fim = fim_alvo
            if tarefa_inicio and tarefa_fim and tarefa_fim < tarefa_inicio:
                tarefa_inicio = inicio_alvo
            if tarefa.data_inicio != tarefa_inicio or tarefa.data_fim_prevista != tarefa_fim:
                tarefa.data_inicio = tarefa_inicio
                tarefa.data_fim_prevista = tarefa_fim
                tarefa.atualizado_por = usuario
                tarefa.save(update_fields=[
                    "data_inicio", "data_fim_prevista", "atualizado_por", "atualizado_em"
                ])
                tarefas_alteradas += 1

            for item in tarefa.checklist.filter(ativo=True, concluido=False):
                item_inicio = item.data_inicio if em_andamento else tarefa_inicio
                item_fim = tarefa_fim
                if item_inicio and item_fim and item_fim < item_inicio:
                    item_inicio = tarefa_inicio
                if item.data_inicio != item_inicio or item.data_fim_prevista != item_fim:
                    item.data_inicio = item_inicio
                    item.data_fim_prevista = item_fim
                    item.save(update_fields=["data_inicio", "data_fim_prevista", "atualizado_em"])
                    subtarefas_alteradas += 1

    return {
        "etapas": etapas_alteradas,
        "tarefas": tarefas_alteradas,
        "subtarefas": subtarefas_alteradas,
    }


def _snapshot_baseline(projeto: Projeto):
    alterados = []
    if projeto.cslog_baseline_data_homologacao is None and projeto.data_homologacao_prevista:
        projeto.cslog_baseline_data_homologacao = projeto.data_homologacao_prevista
        alterados.append("cslog_baseline_data_homologacao")
    if projeto.cslog_baseline_data_go_live is None and projeto.data_go_live_prevista:
        projeto.cslog_baseline_data_go_live = projeto.data_go_live_prevista
        alterados.append("cslog_baseline_data_go_live")
    if projeto.cslog_baseline_data_fim is None and projeto.data_fim_prevista:
        projeto.cslog_baseline_data_fim = projeto.data_fim_prevista
        alterados.append("cslog_baseline_data_fim")
    if alterados:
        projeto.save(update_fields=[*alterados, "atualizado_em"])


def _iso(data):
    return data.isoformat() if data else None


@transaction.atomic
def recalcular_planejamento_por_cslog(projeto: Projeto, usuario=None) -> dict:
    """
    Recalcula automaticamente o saldo do cronograma em dois momentos:

    1) orçamento recebido + prazo: gera previsão PROVISÓRIA usando a data do
       orçamento como base;
    2) início CSLOG informado: recalcula novamente usando a data real de início,
       que passa a ser a âncora vigente do prazo contratado.

    A entrega CSLOG é calculada como base + prazo em dias úteis. O Go Live QORE
    ocorre 1 ou 2 dias úteis depois, conforme a folga configurada (padrão 2).
    """
    projeto = Projeto.objects.select_for_update().get(pk=projeto.pk)
    if not str(projeto.cslog or "").strip():
        return {"recalculado": False, "motivo": "Projeto sem referência CSLOG."}

    prazo = int(projeto.cslog_prazo_dias_uteis or 0)
    base = projeto.cslog_data_inicio or projeto.cslog_orcamento_recebido_em
    origem = "inicio" if projeto.cslog_data_inicio else "orcamento"
    if not base or prazo < 1:
        return {
            "recalculado": False,
            "motivo": "Aguardando orçamento/prazo CSLOG.",
            "origem": "",
        }

    folga = int(projeto.cslog_folga_qore_dias_uteis or 2)
    folga = 1 if folga <= 1 else 2
    entrega_cslog = somar_dias_uteis(base, prazo)
    homologacao_qore = somar_dias_uteis(entrega_cslog, 1)
    go_live_qore = somar_dias_uteis(entrega_cslog, folga)
    conclusao_qore = go_live_qore

    anterior = {
        "data_homologacao_prevista": _iso(projeto.data_homologacao_prevista),
        "data_go_live_prevista": _iso(projeto.data_go_live_prevista),
        "data_fim_prevista": _iso(projeto.data_fim_prevista),
        "cslog_data_entrega_prevista": _iso(projeto.cslog_data_entrega_prevista),
        "cslog_data_inicio": _iso(projeto.cslog_data_inicio),
        "cslog_orcamento_recebido_em": _iso(projeto.cslog_orcamento_recebido_em),
        "cslog_prazo_dias_uteis": prazo,
    }

    _snapshot_baseline(projeto)
    projeto.refresh_from_db()
    fim_anterior = projeto.data_fim_prevista
    delta = (
        _diferenca_dias_uteis(fim_anterior, conclusao_qore)
        if fim_anterior
        else 0
    )

    deslocamento = {"etapas": 0, "tarefas": 0, "subtarefas": 0}
    if projeto.status not in {ProjetoStatus.CONCLUIDO, ProjetoStatus.CANCELADO}:
        deslocamento = _deslocar_saldo_cronograma(
            projeto,
            delta_dias_uteis=delta,
            usuario=usuario,
        )
        finais = _alinhar_momentos_finais(
            projeto,
            homologacao_qore=homologacao_qore,
            go_live_qore=go_live_qore,
            usuario=usuario,
        )
        deslocamento = {
            chave: int(deslocamento.get(chave, 0)) + int(finais.get(chave, 0))
            for chave in {"etapas", "tarefas", "subtarefas"}
        }

    campos = []
    novos_valores = {
        "cslog_data_entrega_prevista": entrega_cslog,
        "data_homologacao_prevista": homologacao_qore,
        "data_go_live_prevista": go_live_qore,
        "data_fim_prevista": conclusao_qore,
    }
    for campo, valor in novos_valores.items():
        if getattr(projeto, campo) != valor:
            setattr(projeto, campo, valor)
            campos.append(campo)

    if campos:
        projeto.atualizado_por = usuario
        projeto.save(update_fields=[*campos, "atualizado_por", "atualizado_em"])

    duracao = _dias_uteis_inclusivos(projeto.data_inicio, conclusao_qore)
    alterou = bool(campos or any(deslocamento.values()))
    if alterou:
        ProjetoHistorico.objects.create(
            projeto=projeto,
            entidade=ProjetoHistoricoEntidade.CRONOGRAMA,
            entidade_id=projeto.id,
            acao=ProjetoHistoricoAcao.CRONOGRAMA,
            descricao=(
                "Cronograma replanejado pela data real de início CSLOG."
                if origem == "inicio"
                else "Previsão provisória recalculada pelo orçamento/prazo CSLOG."
            ),
            dados_anteriores=anterior,
            dados_novos={
                "origem_previsao": origem,
                "base_calculo": _iso(base),
                "prazo_cslog_dias_uteis": prazo,
                "entrega_cslog": _iso(entrega_cslog),
                "folga_qore_dias_uteis": folga,
                "homologacao_qore": _iso(homologacao_qore),
                "go_live_qore": _iso(go_live_qore),
                "conclusao_qore": _iso(conclusao_qore),
                "duracao_total_qore_dias_uteis": duracao,
                "delta_replanejamento_dias_uteis": delta,
                "itens_replanejados": deslocamento,
            },
            usuario=usuario,
        )

    if projeto.status not in {ProjetoStatus.CONCLUIDO, ProjetoStatus.CANCELADO}:
        from workspace.services.regras_service import recalcular_projeto
        recalcular_projeto(projeto, usuario=usuario)

    return {
        "recalculado": alterou,
        "origem": origem,
        "base_calculo": base,
        "entrega_cslog": entrega_cslog,
        "folga_qore_dias_uteis": folga,
        "homologacao_qore": homologacao_qore,
        "go_live_qore": go_live_qore,
        "conclusao_qore": conclusao_qore,
        "duracao_total_qore_dias_uteis": duracao,
        "delta_replanejamento_dias_uteis": delta,
        "itens_replanejados": deslocamento,
    }
