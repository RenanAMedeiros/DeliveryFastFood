from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from workspace.models import (
    CalendarioUtil,
    Projeto,
    ProjetoEtapa,
    ProjetoEtapaTipo,
    ProjetoMomento,
    ProjetoSituacao,
    ProjetoStatus,
    ProjetoTarefa,
    ProjetoTarefaCategoria,
    ProjetoTarefaStatus,
)


ZERO = Decimal("0.00")
CEM = Decimal("100.00")


def _percentual(valor):
    valor = max(ZERO, min(CEM, Decimal(valor or 0)))
    return valor.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def contar_dias_uteis(data_inicio, data_fim):
    if not data_inicio or not data_fim or data_fim < data_inicio:
        return 0

    quantidade = CalendarioUtil.objects.filter(
        data__gte=data_inicio,
        data__lte=data_fim,
        dia_util=True,
    ).count()

    if quantidade:
        return quantidade

    total = 0
    atual = data_inicio
    while atual <= data_fim:
        if atual.weekday() < 5:
            total += 1
        atual = date.fromordinal(atual.toordinal() + 1)
    return total


def calcular_progresso_tarefas(tarefas):
    tarefas = list(tarefas)
    tarefas_validas = [
        tarefa
        for tarefa in tarefas
        if tarefa.ativo and tarefa.status != ProjetoTarefaStatus.CANCELADA
    ]

    if not tarefas_validas:
        return ZERO

    concluidas = sum(
        1
        for tarefa in tarefas_validas
        if tarefa.status == ProjetoTarefaStatus.CONCLUIDA
    )
    return _percentual(
        Decimal(concluidas) * CEM / Decimal(len(tarefas_validas))
    )


def calcular_progresso_etapa(tarefas):
    """Progresso operacional da Sprint, incluindo avanço parcial das tarefas."""
    validas = [
        tarefa for tarefa in tarefas
        if tarefa.ativo and tarefa.status != ProjetoTarefaStatus.CANCELADA
    ]
    if not validas:
        return ZERO
    total = sum((Decimal(tarefa.progresso or 0) for tarefa in validas), ZERO)
    return _percentual(total / Decimal(len(validas)))




def tarefa_totalmente_concluida(tarefa):
    """
    Uma tarefa só é considerada concluída para fechamento da Sprint quando
    seu status está concluído e todas as subtarefas ativas estão concluídas.
    """
    if not tarefa.ativo or tarefa.status == ProjetoTarefaStatus.CANCELADA:
        return True
    if tarefa.status != ProjetoTarefaStatus.CONCLUIDA:
        return False

    try:
        itens = [item for item in tarefa.checklist.all() if getattr(item, "ativo", True)]
    except Exception:
        itens = []

    return all(bool(item.concluido) for item in itens)


def status_etapa_calculado(etapa, tarefas=None):
    """Status derivado da execução direta ou das Sprints filhas da Fase."""
    tarefas = list(tarefas if tarefas is not None else etapa.tarefas.all())
    validas = [
        tarefa for tarefa in tarefas
        if tarefa.ativo and tarefa.status != ProjetoTarefaStatus.CANCELADA
    ]

    # Compatibilidade histórica: quando existir um agrupador pai sem tarefas diretas,
    # seu status é consolidado a partir das etapas filhas.
    try:
        sprints = [item for item in etapa.sprints.all() if item.ativo]
    except Exception:
        sprints = []
    if sprints and not validas:
        status_filhos = [status_etapa_calculado(item)[0] for item in sprints]
        if status_filhos and all(status == "concluida" for status in status_filhos):
            return "concluida", "Concluída"
        if any(status in {"em_andamento", "concluida"} for status in status_filhos):
            return "em_andamento", "Em andamento"
        return "nao_iniciada", "Não iniciada"

    obrigatorias = [tarefa for tarefa in validas if tarefa.obrigatoria]
    if obrigatorias and all(tarefa_totalmente_concluida(tarefa) for tarefa in obrigatorias):
        return "concluida", "Concluída"

    iniciada = any(
        tarefa.status not in {ProjetoTarefaStatus.BACKLOG, ProjetoTarefaStatus.NAO_INICIADA}
        or Decimal(tarefa.progresso or 0) > ZERO
        for tarefa in validas
    )
    if iniciada:
        return "em_andamento", "Em andamento"
    return "nao_iniciada", "Não iniciada"

def calcular_progresso_esperado(projeto: Projeto, hoje=None):
    hoje = hoje or timezone.localdate()

    if not projeto.data_inicio or not projeto.data_fim_prevista:
        return ZERO

    if hoje < projeto.data_inicio:
        return ZERO

    if hoje >= projeto.data_fim_prevista:
        return CEM

    total = contar_dias_uteis(projeto.data_inicio, projeto.data_fim_prevista)
    decorrido = contar_dias_uteis(projeto.data_inicio, hoje)

    if total <= 0:
        return ZERO

    return _percentual(Decimal(decorrido) * CEM / Decimal(total))


MOMENTO_ORDEM = {
    ProjetoMomento.PLANEJAMENTO: 1,
    ProjetoMomento.EXECUCAO: 2,
    ProjetoMomento.HOMOLOGACAO: 3,
    ProjetoMomento.ENCERRAMENTO: 4,
}


def etapas_executoras_projeto(projeto: Projeto, etapas=None):
    if etapas is None:
        etapas = list(
            ProjetoEtapa.objects.filter(projeto=projeto, ativo=True)
            .select_related("fase_pai")
            .prefetch_related("tarefas__checklist", "sprints")
            .order_by("ordem", "id")
        )
    else:
        etapas = [etapa for etapa in etapas if etapa.ativo]

    executoras = []
    for etapa in etapas:
        tarefas = [tarefa for tarefa in etapa.tarefas.all() if tarefa.ativo]
        try:
            filhos = [item for item in etapa.sprints.all() if item.ativo]
        except Exception:
            filhos = []
        if tarefas or not filhos:
            executoras.append(etapa)
    return sorted(executoras, key=lambda item: (item.ordem, item.id))


def resumo_fluxo_projeto(projeto: Projeto, etapas=None):
    executoras = etapas_executoras_projeto(projeto, etapas=etapas)
    marcos = []
    for etapa in executoras:
        tarefas = [tarefa for tarefa in etapa.tarefas.all() if tarefa.ativo]
        status, status_nome = status_etapa_calculado(etapa, tarefas)
        marcos.append({
            "etapa": etapa,
            "status": status,
            "status_nome": status_nome,
            "concluido": status == "concluida",
            "iniciado": status != "nao_iniciada" or Decimal(etapa.progresso or 0) > ZERO,
        })

    # A etapa gerencial atual é sempre a PRIMEIRA etapa obrigatória ainda não
    # concluída na ordem do cronograma. Isso impede o projeto de avançar para
    # Homologação/Encerramento apenas porque uma etapa posterior já foi iniciada
    # ou porque sua data de início chegou.
    pendentes = [item for item in marcos if not item["concluido"]]
    atual = (
        min(pendentes, key=lambda item: (item["etapa"].ordem, item["etapa"].id))
        if pendentes
        else (marcos[-1] if marcos else None)
    )

    etapa_atual = atual["etapa"] if atual else None
    fase_atual = None
    sprint_atual = None
    if etapa_atual:
        if etapa_atual.tipo == ProjetoEtapaTipo.SPRINT:
            sprint_atual = etapa_atual
            fase_atual = etapa_atual.fase_pai if etapa_atual.fase_pai_id else None
        elif etapa_atual.tipo == ProjetoEtapaTipo.FASE:
            fase_atual = etapa_atual

    homologacoes = [
        etapa.data_inicio for etapa in executoras
        if etapa.momento == ProjetoMomento.HOMOLOGACAO and etapa.data_inicio
    ]
    encerramentos = [
        etapa.data_inicio for etapa in executoras
        if etapa.momento == ProjetoMomento.ENCERRAMENTO and etapa.data_inicio
    ]

    momento = etapa_atual.momento if etapa_atual else ProjetoMomento.PLANEJAMENTO
    momento_nome = dict(ProjetoMomento.choices).get(momento, "Planejamento")
    return {
        "momento": momento,
        "momento_nome": momento_nome,
        "etapa_atual": etapa_atual,
        "fase_atual": fase_atual,
        "sprint_atual": sprint_atual,
        "marcos_total": len(marcos),
        "marcos_concluidos": sum(1 for item in marcos if item["concluido"]),
        "marco_atual": atual,
        "marcos": marcos,
        "data_homologacao_cronograma": min(homologacoes) if homologacoes else None,
        "data_go_live_cronograma": min(encerramentos) if encerramentos else None,
    }


def calcular_status_automatico(projeto: Projeto, tarefas, hoje=None):
    hoje = hoje or timezone.localdate()
    tarefas = list(tarefas)
    validas = [t for t in tarefas if t.ativo and t.status != ProjetoTarefaStatus.CANCELADA]
    obrigatorias = [t for t in validas if t.obrigatoria]

    # Aguardando/Pausado/Cancelado são exceções gerenciais explícitas.
    if projeto.status in {
        ProjetoStatus.AGUARDANDO,
        ProjetoStatus.PAUSADO,
        ProjetoStatus.CANCELADO,
    }:
        return projeto.status

    if obrigatorias and all(tarefa_totalmente_concluida(t) for t in obrigatorias):
        return ProjetoStatus.CONCLUIDO

    tarefas_iniciadas = [
        t for t in validas
        if t.status in {
            ProjetoTarefaStatus.EM_ANDAMENTO,
            ProjetoTarefaStatus.AGUARDANDO,
            ProjetoTarefaStatus.BLOQUEADA,
            ProjetoTarefaStatus.CONCLUIDA,
        }
        or Decimal(t.progresso or 0) > ZERO
    ]

    fluxo = resumo_fluxo_projeto(projeto)
    momento = fluxo["momento"]

    if not tarefas_iniciadas:
        # Se o usuário ativou o projeto, mantenha-o Em andamento mesmo antes
        # do primeiro apontamento. Um projeto nunca avança para Homologação ou
        # Encerramento apenas pelo número/nome da etapa.
        if projeto.status in {
            ProjetoStatus.EM_ANDAMENTO,
            ProjetoStatus.HOMOLOGACAO,
            ProjetoStatus.ENCERRAMENTO,
        }:
            return ProjetoStatus.EM_ANDAMENTO
        return ProjetoStatus.RASCUNHO

    if momento == ProjetoMomento.ENCERRAMENTO:
        return ProjetoStatus.ENCERRAMENTO
    if momento == ProjetoMomento.HOMOLOGACAO:
        return ProjetoStatus.HOMOLOGACAO
    return ProjetoStatus.EM_ANDAMENTO

def calcular_saude_projeto(projeto, tarefas=None, progresso=None, progresso_esperado=None, hoje=None):
    """Retorna (situação interna, rótulo de saúde, motivo objetivo)."""
    hoje = hoje or timezone.localdate()
    if tarefas is None:
        tarefas = ProjetoTarefa.objects.filter(projeto=projeto, ativo=True)
    validas = [
        tarefa for tarefa in tarefas
        if tarefa.ativo and tarefa.status != ProjetoTarefaStatus.CANCELADA
    ]

    if projeto.status in {ProjetoStatus.RASCUNHO, ProjetoStatus.PLANEJADO}:
        return ProjetoSituacao.NO_PRAZO, "Normal", "Projeto ainda não iniciado."
    if projeto.status in {ProjetoStatus.CONCLUIDO, ProjetoStatus.CANCELADO}:
        return ProjetoSituacao.NO_PRAZO, "Normal", "Projeto encerrado."

    bloqueadas = [t for t in validas if t.status == ProjetoTarefaStatus.BLOQUEADA]
    aguardando = [t for t in validas if t.status == ProjetoTarefaStatus.AGUARDANDO]
    atrasadas = [
        t for t in validas
        if t.status != ProjetoTarefaStatus.CONCLUIDA
        and t.data_fim_prevista
        and t.data_fim_prevista < hoje
    ]
    marcos_atrasados = [
        t for t in atrasadas
        if getattr(t, "tipo", "") == "marco"
    ]
    progresso = Decimal(progresso if progresso is not None else projeto.progresso or 0)
    esperado = Decimal(
        progresso_esperado
        if progresso_esperado is not None
        else projeto.progresso_esperado or 0
    )
    diferenca = esperado - progresso
    prazo_projeto_atrasado = bool(
        projeto.data_fim_prevista
        and projeto.data_fim_prevista < hoje
        and progresso < CEM
    )

    partes = []
    if bloqueadas:
        partes.append(f"{len(bloqueadas)} tarefa(s) bloqueada(s)")
    if marcos_atrasados:
        partes.append(f"{len(marcos_atrasados)} marco(s) atrasado(s)")
    if atrasadas:
        partes.append(f"{len(atrasadas)} tarefa(s) atrasada(s)")
    if aguardando:
        partes.append(f"{len(aguardando)} tarefa(s) aguardando")

    if bloqueadas or marcos_atrasados or prazo_projeto_atrasado or diferenca >= Decimal("30.00"):
        if prazo_projeto_atrasado:
            partes.append("prazo final vencido")
        if diferenca >= Decimal("30.00"):
            partes.append("progresso muito abaixo do esperado")
        return ProjetoSituacao.EM_RISCO, "Crítico", ", ".join(dict.fromkeys(partes)) or "Risco relevante para a entrega."

    if atrasadas or aguardando or diferenca >= Decimal("15.00"):
        if diferenca >= Decimal("15.00"):
            partes.append("progresso abaixo do esperado")
        return ProjetoSituacao.ATENCAO, "Atenção", ", ".join(dict.fromkeys(partes))

    return ProjetoSituacao.NO_PRAZO, "Normal", "Sem riscos relevantes."


def calcular_situacao_automatica(projeto: Projeto, progresso, progresso_esperado, hoje=None, tarefas=None):
    situacao, _, _ = calcular_saude_projeto(
        projeto,
        tarefas=tarefas,
        progresso=progresso,
        progresso_esperado=progresso_esperado,
        hoje=hoje,
    )
    return situacao


@transaction.atomic
def recalcular_etapas(projeto: Projeto):
    etapas = list(
        ProjetoEtapa.objects.filter(projeto=projeto, ativo=True)
        .select_related("fase_pai")
        .prefetch_related("tarefas__checklist", "sprints__tarefas__checklist")
        .order_by("ordem", "id")
    )

    hoje = timezone.localdate()

    # Primeiro recalcula as etapas executoras (Sprint no Ágil/Híbrido e Fase
    # no Waterfall) a partir das próprias tarefas.
    for etapa in etapas:
        tarefas = [tarefa for tarefa in etapa.tarefas.all() if tarefa.ativo]
        filhos = [item for item in etapa.sprints.all() if item.ativo]
        if filhos and not tarefas:
            continue

        progresso = calcular_progresso_etapa(tarefas)
        validas = [tarefa for tarefa in tarefas if tarefa.status != ProjetoTarefaStatus.CANCELADA]
        obrigatorias = [tarefa for tarefa in validas if tarefa.obrigatoria]
        concluida = bool(obrigatorias) and all(tarefa_totalmente_concluida(tarefa) for tarefa in obrigatorias)

        data_conclusao = etapa.data_conclusao
        if concluida and not data_conclusao:
            datas = [tarefa.data_conclusao for tarefa in validas if tarefa.data_conclusao]
            data_conclusao = max(datas) if datas else hoje
        elif not concluida:
            data_conclusao = None

        campos = {}
        if Decimal(etapa.progresso or 0) != progresso:
            campos["progresso"] = progresso
            etapa.progresso = progresso
        if etapa.data_conclusao != data_conclusao:
            campos["data_conclusao"] = data_conclusao
            etapa.data_conclusao = data_conclusao
        if campos:
            ProjetoEtapa.objects.filter(pk=etapa.pk).update(**campos)

    # Depois consolida agrupadores pai legados. O peso usa a quantidade de
    # tarefas ativas de cada Sprint para que uma Sprint pequena não tenha o
    # mesmo impacto de uma Sprint muito maior.
    for etapa in reversed(etapas):
        filhos = [item for item in etapa.sprints.all() if item.ativo]
        if not filhos:
            continue

        pesos = []
        total_peso = Decimal("0")
        progresso_somado = Decimal("0")
        todos_concluidos = True
        conclusoes = []
        for filho in filhos:
            tarefas_filho = [
                tarefa for tarefa in filho.tarefas.all()
                if tarefa.ativo and tarefa.status != ProjetoTarefaStatus.CANCELADA
            ]
            peso = Decimal(max(1, len(tarefas_filho)))
            total_peso += peso
            progresso_somado += Decimal(filho.progresso or 0) * peso
            status_filho, _ = status_etapa_calculado(filho, tarefas_filho)
            if status_filho != "concluida":
                todos_concluidos = False
            if filho.data_conclusao:
                conclusoes.append(filho.data_conclusao)

        progresso = _percentual(progresso_somado / total_peso) if total_peso else ZERO
        data_conclusao = max(conclusoes) if todos_concluidos and conclusoes else None
        campos = {}
        if Decimal(etapa.progresso or 0) != progresso:
            campos["progresso"] = progresso
            etapa.progresso = progresso
        if etapa.data_conclusao != data_conclusao:
            campos["data_conclusao"] = data_conclusao
            etapa.data_conclusao = data_conclusao
        if campos:
            ProjetoEtapa.objects.filter(pk=etapa.pk).update(**campos)

    return etapas

@transaction.atomic
def recalcular_projeto(projeto: Projeto, usuario=None, salvar=True):
    tarefas = list(
        ProjetoTarefa.objects.filter(
            projeto=projeto,
            ativo=True,
        ).select_related("etapa", "responsavel").prefetch_related("checklist")
    )

    recalcular_etapas(projeto)

    progresso = calcular_progresso_tarefas(tarefas)
    esperado = calcular_progresso_esperado(projeto)

    novo_status = projeto.status
    if projeto.status_automatico:
        novo_status = calcular_status_automatico(projeto, tarefas)

    data_conclusao = projeto.data_conclusao
    if novo_status == ProjetoStatus.CONCLUIDO and not data_conclusao:
        data_conclusao = timezone.localdate()
    elif novo_status != ProjetoStatus.CONCLUIDO and projeto.status == ProjetoStatus.CONCLUIDO:
        data_conclusao = None

    projeto.status = novo_status
    projeto.progresso = progresso
    projeto.progresso_esperado = esperado
    projeto.data_conclusao = data_conclusao

    if projeto.situacao_automatica:
        projeto.situacao = calcular_situacao_automatica(
            projeto,
            progresso,
            esperado,
            tarefas=tarefas,
        )

    if usuario is not None:
        projeto.atualizado_por = usuario

    if salvar:
        projeto.save(
            update_fields=[
                "status",
                "situacao",
                "progresso",
                "progresso_esperado",
                "data_conclusao",
                "atualizado_por",
                "atualizado_em",
            ]
        )

    return projeto


def projetos_com_prazo_critico():
    hoje = timezone.localdate()
    return Projeto.objects.filter(ativo=True).filter(
        Q(situacao__in=[ProjetoSituacao.EM_RISCO, ProjetoSituacao.ATRASADO])
        | Q(data_fim_prevista__lt=hoje, progresso__lt=CEM)
    )
