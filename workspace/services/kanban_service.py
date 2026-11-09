from collections import OrderedDict

from workspace.models import (
    Projeto,
    ProjetoStatus,
    ProjetoTarefa,
    ProjetoTarefaStatus,
)


COLUNAS_PROJETOS = OrderedDict(
    [
        ("rascunho", {"titulo": "Rascunho", "status": {ProjetoStatus.RASCUNHO, ProjetoStatus.PLANEJADO}}),
        ("em_andamento", {"titulo": "Em andamento", "status": {ProjetoStatus.EM_ANDAMENTO}}),
        ("aguardando", {"titulo": "Aguardando", "status": {ProjetoStatus.AGUARDANDO}}),
        ("homologacao", {"titulo": "Homologação", "status": {ProjetoStatus.HOMOLOGACAO}}),
        ("encerramento", {"titulo": "Encerramento", "status": {ProjetoStatus.ENCERRAMENTO}}),
        ("concluido", {"titulo": "Concluído", "status": {ProjetoStatus.CONCLUIDO}}),
    ]
)


COLUNAS_TAREFAS = OrderedDict(
    [
        ("backlog", {"titulo": "Backlog", "status": {ProjetoTarefaStatus.BACKLOG, ProjetoTarefaStatus.NAO_INICIADA}}),
        ("em_andamento", {"titulo": "Em andamento", "status": {ProjetoTarefaStatus.EM_ANDAMENTO}}),
        ("aguardando", {"titulo": "Aguardando", "status": {ProjetoTarefaStatus.AGUARDANDO}}),
        ("bloqueada", {"titulo": "Bloqueado", "status": {ProjetoTarefaStatus.BLOQUEADA}}),
        ("concluida", {"titulo": "Concluída", "status": {ProjetoTarefaStatus.CONCLUIDA}}),
    ]
)


def montar_kanban_projetos(queryset=None):
    queryset = queryset or Projeto.objects.filter(ativo=True)
    projetos = list(
        queryset.exclude(status=ProjetoStatus.CANCELADO)
        .select_related("responsavel", "empresa", "carteira")
        .order_by("data_fim_prevista", "nome")
    )

    colunas = []
    for chave, configuracao in COLUNAS_PROJETOS.items():
        itens = [p for p in projetos if p.status in configuracao["status"]]
        colunas.append(
            {
                "chave": chave,
                "titulo": configuracao["titulo"],
                "quantidade": len(itens),
                "itens": itens,
            }
        )
    return colunas


def montar_kanban_tarefas(projeto):
    tarefas = list(
        ProjetoTarefa.objects.filter(
            projeto=projeto,
            ativo=True,
        )
        .exclude(status=ProjetoTarefaStatus.CANCELADA)
        .select_related("etapa", "responsavel")
        .order_by("data_fim_prevista", "ordem", "nome")
    )

    colunas = []
    for chave, configuracao in COLUNAS_TAREFAS.items():
        itens = [t for t in tarefas if t.status in configuracao["status"]]
        colunas.append(
            {
                "chave": chave,
                "titulo": configuracao["titulo"],
                "quantidade": len(itens),
                "itens": itens,
            }
        )
    return colunas
