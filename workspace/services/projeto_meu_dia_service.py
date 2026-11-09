from django.db.models import Q
from django.utils import timezone

from workspace.models import (
    ProjetoTarefa,
    ProjetoTarefaStatus,
    ProjetoTarefaTipo,
)
from workspace.services.projeto_participantes_service import pessoa_do_usuario


_STATUS_FECHADOS = {
    ProjetoTarefaStatus.CONCLUIDA,
    ProjetoTarefaStatus.CANCELADA,
}


def _base_tarefas_usuario(usuario):
    pessoa = pessoa_do_usuario(usuario)

    filtro = Q(responsavel=usuario)
    if pessoa:
        filtro |= Q(
            vinculos_responsaveis__pessoa=pessoa,
            vinculos_responsaveis__ativo=True,
        )
        filtro |= Q(
            checklist__responsavel_pessoa=pessoa,
            checklist__ativo=True,
            checklist__concluido=False,
        )

    return (
        ProjetoTarefa.objects
        .filter(ativo=True, projeto__ativo=True)
        .exclude(status__in=_STATUS_FECHADOS)
        .filter(filtro)
        .select_related(
            "projeto",
            "projeto__owner",
            "etapa",
            "responsavel",
        )
        .prefetch_related("responsaveis_pessoas")
        .distinct()
    )


def _tarefa_dict(tarefa, hoje):
    dias_atraso = 0
    if tarefa.data_fim_prevista and tarefa.data_fim_prevista < hoje:
        dias_atraso = (hoje - tarefa.data_fim_prevista).days

    return {
        "id": tarefa.id,
        "nome": tarefa.nome,
        "tipo": tarefa.tipo,
        "tipo_nome": tarefa.get_tipo_display(),
        "status": tarefa.status,
        "status_nome": tarefa.get_status_display(),
        "prioridade": tarefa.prioridade,
        "prioridade_nome": tarefa.get_prioridade_display(),
        "data_inicio": tarefa.data_inicio.isoformat() if tarefa.data_inicio else None,
        "data_fim_prevista": (
            tarefa.data_fim_prevista.isoformat()
            if tarefa.data_fim_prevista
            else None
        ),
        "dias_atraso": dias_atraso,
        "projeto": {
            "id": tarefa.projeto_id,
            "codigo": tarefa.projeto.codigo,
            "nome": tarefa.projeto.nome,
        },
        "etapa": (
            {
                "id": tarefa.etapa_id,
                "nome": tarefa.etapa.nome,
                "descricao": tarefa.etapa.descricao,
            }
            if tarefa.etapa_id
            else None
        ),
    }


def obter_meu_dia(usuario):
    hoje = timezone.localdate()
    base = _base_tarefas_usuario(usuario)

    vencem_hoje = list(base.filter(data_fim_prevista=hoje).order_by("prioridade", "id"))
    atrasadas = list(base.filter(data_fim_prevista__lt=hoje).order_by("data_fim_prevista", "id"))
    iniciam_hoje = list(base.filter(data_inicio=hoje).order_by("prioridade", "id"))
    marcos_hoje = list(
        base.filter(tipo=ProjetoTarefaTipo.MARCO)
        .filter(Q(data_inicio=hoje) | Q(data_fim_prevista=hoje))
        .order_by("id")
    )

    pessoa = pessoa_do_usuario(usuario)
    owner_atencao = []
    if pessoa:
        owner_tasks = (
            ProjetoTarefa.objects
            .filter(
                ativo=True,
                projeto__ativo=True,
                projeto__owner=pessoa,
            )
            .exclude(status__in=_STATUS_FECHADOS)
            .filter(
                Q(status=ProjetoTarefaStatus.BLOQUEADA)
                | Q(data_fim_prevista__lt=hoje)
            )
            .select_related("projeto", "etapa")
            .order_by("data_fim_prevista", "id")[:80]
        )
        owner_atencao = [_tarefa_dict(item, hoje) for item in owner_tasks]

    return {
        "data": hoje.isoformat(),
        "resumo": {
            "vencem_hoje": len(vencem_hoje),
            "atrasadas": len(atrasadas),
            "iniciam_hoje": len(iniciam_hoje),
            "marcos_hoje": len(marcos_hoje),
            "owner_atencao": len(owner_atencao),
        },
        "vencem_hoje": [_tarefa_dict(item, hoje) for item in vencem_hoje],
        "atrasadas": [_tarefa_dict(item, hoje) for item in atrasadas],
        "iniciam_hoje": [_tarefa_dict(item, hoje) for item in iniciam_hoje],
        "marcos_hoje": [_tarefa_dict(item, hoje) for item in marcos_hoje],
        "owner_atencao": owner_atencao,
    }
