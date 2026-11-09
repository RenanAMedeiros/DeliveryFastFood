from django.db import transaction
from django.shortcuts import get_object_or_404

from workspace.models import (
    Projeto,
    ProjetoHistorico,
    ProjetoHistoricoAcao,
    ProjetoHistoricoEntidade,
    ProjetoPessoa,
    ProjetoPrioridade,
    ProjetoStatus,
)
from workspace.services.cronograma_service import (
    aplicar_cronograma_modelo,
    planejar_cronograma_modelo,
    recalcular_datas_cronograma_existente,
)
from workspace.services.projeto_participantes_service import (
    definir_participantes_projeto,
    definir_stakeholder_projeto,
    replicar_responsavel_padrao_tarefas,
)
from workspace.services.regras_service import (
    recalcular_projeto,
    tarefa_totalmente_concluida,
)


@transaction.atomic
def criar_projeto(
    *,
    nome,
    usuario,
    data_inicio=None,
    data_abertura=None,
    data_fim_prevista=None,
    data_homologacao_prevista=None,
    data_go_live_prevista=None,
    data_conclusao=None,
    descricao="",
    referencia="",
    referencia_url="",
    cslog="",
    cslog_url="",
    categoria="",
    mesa="",
    servico_completo="",
    empresa_nome="",
    cliente_nome="",
    cliente=None,
    empresa_filtro=None,
    empresa=None,
    carteira=None,
    responsavel=None,
    owner=None,
    stakeholder=None,
    grupo_ids=None,
    envolvido_ids=None,
    prioridade=ProjetoPrioridade.MEDIA,
    metodologia=None,
    cronograma_modelo=None,
    duracao_dias_uteis=None,
    status=ProjetoStatus.RASCUNHO,
    aplicar_cronograma=True,
    equipe=None,
):
    nome = str(nome or "").strip()
    if not nome:
        raise ValueError("Informe o nome do projeto.")

    # Compatibilidade: chamadas antigas que enviam apenas ``responsavel``
    # continuam funcionando e o vínculo será convertido para Owner pela view/
    # serviço de participantes quando possível.
    if owner and not isinstance(owner, ProjetoPessoa):
        raise ValueError("Owner inválido.")

    responsavel_legado = responsavel
    if owner and owner.usuario_id:
        responsavel_legado = owner.usuario

    planejamento = None
    if aplicar_cronograma and duracao_dias_uteis and data_inicio and cronograma_modelo:
        planejamento = planejar_cronograma_modelo(
            data_inicio,
            duracao_dias_uteis,
            cronograma_modelo,
        )
        data_fim_prevista = planejamento["data_fim_prevista"]
        if not data_homologacao_prevista:
            data_homologacao_prevista = planejamento.get("data_homologacao_prevista")
        if not data_go_live_prevista:
            data_go_live_prevista = planejamento.get("data_go_live_prevista")

    projeto = Projeto(
        nome=nome,
        descricao=str(descricao or "").strip(),
        referencia=str(referencia or "").strip(),
        referencia_url=str(referencia_url or "").strip(),
        cslog=str(cslog or "").strip(),
        cslog_url=str(cslog_url or "").strip(),
        categoria=str(categoria or "").strip(),
        mesa=str(mesa or "").strip(),
        servico_completo=str(servico_completo or "").strip(),
        empresa_nome=str(empresa_nome or "").strip(),
        cliente_nome=str(cliente_nome or (getattr(cliente, "nome", "") if cliente else "") or "").strip(),
        cliente=cliente,
        empresa_filtro=empresa_filtro,
        empresa=empresa,
        carteira=carteira,
        responsavel=responsavel_legado,
        owner=owner,
        prioridade=prioridade or ProjetoPrioridade.MEDIA,
        status=status or ProjetoStatus.RASCUNHO,
        status_automatico=(status or ProjetoStatus.RASCUNHO) != ProjetoStatus.RASCUNHO,
        cronograma_modelo=cronograma_modelo,
        data_inicio=data_inicio,
        data_abertura=data_abertura,
        data_fim_prevista=data_fim_prevista,
        data_homologacao_prevista=data_homologacao_prevista,
        data_go_live_prevista=data_go_live_prevista,
        data_conclusao=data_conclusao,
        criado_por=usuario,
        atualizado_por=usuario,
    )

    if metodologia:
        projeto.metodologia = metodologia

    projeto.full_clean()
    projeto.save()

    if equipe:
        projeto.equipe.set(equipe)

    definir_participantes_projeto(
        projeto,
        owner=owner,
        grupo_ids=grupo_ids,
        envolvido_ids=envolvido_ids,
        usuario=usuario,
    )
    definir_stakeholder_projeto(
        projeto,
        stakeholder=stakeholder,
        usuario=usuario,
    )

    ProjetoHistorico.objects.create(
        projeto=projeto,
        entidade=ProjetoHistoricoEntidade.PROJETO,
        entidade_id=projeto.id,
        acao=ProjetoHistoricoAcao.CRIACAO,
        descricao=(
            "Projeto pré-cadastrado no Workspace como Rascunho."
            if not aplicar_cronograma or (status or ProjetoStatus.RASCUNHO) == ProjetoStatus.RASCUNHO
            else "Projeto criado no Workspace."
        ),
        dados_novos={
            "codigo": projeto.codigo,
            "nome": projeto.nome,
            "referencia": projeto.referencia,
            "referencia_url": projeto.referencia_url,
            "cslog": projeto.cslog,
            "cslog_url": projeto.cslog_url,
            "categoria": projeto.categoria,
            "mesa": projeto.mesa,
            "servico_completo": projeto.servico_completo,
            "status": projeto.status,
            "cronograma_modelo_id": projeto.cronograma_modelo_id,
            "prioridade": projeto.prioridade,
            "cliente_nome": projeto.cliente_nome,
            "cliente_id": projeto.cliente_id,
            "empresa_filtro_id": projeto.empresa_filtro_id,
            "empresa_id": projeto.empresa_id,
            "owner_id": projeto.owner_id,
            "stakeholder_id": stakeholder.id if stakeholder else None,
            "grupos_trabalho": list(
                projeto.grupos_trabalho.values_list("id", flat=True)
            ),
            "data_inicio": projeto.data_inicio.isoformat() if projeto.data_inicio else None,
            "data_fim_prevista": (
                projeto.data_fim_prevista.isoformat()
                if projeto.data_fim_prevista
                else None
            ),
            "data_homologacao_prevista": (
                projeto.data_homologacao_prevista.isoformat()
                if projeto.data_homologacao_prevista
                else None
            ),
            "data_go_live_prevista": (
                projeto.data_go_live_prevista.isoformat()
                if projeto.data_go_live_prevista
                else None
            ),
            "data_conclusao": (
                projeto.data_conclusao.isoformat()
                if projeto.data_conclusao
                else None
            ),
            "duracao_dias_uteis": (
                planejamento["duracao_dias_uteis"]
                if planejamento
                else None
            ),
        },
        usuario=usuario,
    )

    if aplicar_cronograma and cronograma_modelo and projeto.status != ProjetoStatus.RASCUNHO:
        aplicar_cronograma_modelo(
            projeto,
            cronograma_modelo,
            usuario=usuario,
            substituir=False,
            ajustar_data_fim=(
                bool(duracao_dias_uteis)
                or not bool(data_fim_prevista)
            ),
            duracao_projeto_dias_uteis=duracao_dias_uteis,
        )
        responsavel_padrao_id = next(
            (int(x) for x in (envolvido_ids or []) if str(x).isdigit()),
            None,
        )
        replicar_responsavel_padrao_tarefas(
            projeto,
            responsavel_novo=responsavel_padrao_id,
            usuario=usuario,
        )

    recalcular_projeto(projeto, usuario=usuario)
    return projeto


def obter_projeto_completo(projeto_id):
    return get_object_or_404(
        Projeto.objects.select_related(
            "cliente",
            "empresa_filtro",
            "empresa",
            "empresa__cliente",
            "carteira",
            "responsavel",
            "owner",
            "owner__usuario",
            "cronograma_modelo",
            "criado_por",
            "atualizado_por",
        ).prefetch_related(
            "equipe",
            "grupos_trabalho",
            "vinculos_membros__pessoa",
            "vinculos_membros__pessoa__usuario",
            "etapas__responsavel",
            "etapas__fase_pai",
            "etapas__sprints",
            "etapas__tarefas__responsavel",
            "etapas__tarefas__responsaveis_pessoas",
            "etapas__tarefas__vinculos_responsaveis__pessoa",
            "etapas__tarefas__vinculos_responsaveis__pessoa__usuario",
            "etapas__tarefas__checklist",
            "etapas__tarefas__checklist__responsavel_pessoa",
            "etapas__tarefas__checklist__responsavel_pessoa__usuario",
            "historico__usuario",
        ),
        pk=projeto_id,
        ativo=True,
    )


@transaction.atomic
def atualizar_status_manual(projeto, status, usuario=None):
    status_validos = {valor for valor, _ in ProjetoStatus.choices}
    if status not in status_validos:
        raise ValueError("Status de projeto inválido.")

    anterior = projeto.status
    projeto.status = status
    projeto.status_automatico = status not in {
        ProjetoStatus.AGUARDANDO,
        ProjetoStatus.PAUSADO,
        ProjetoStatus.CANCELADO,
    }
    projeto.atualizado_por = usuario
    projeto.save(
        update_fields=[
            "status",
            "status_automatico",
            "atualizado_por",
            "atualizado_em",
        ]
    )

    ProjetoHistorico.objects.create(
        projeto=projeto,
        entidade=ProjetoHistoricoEntidade.PROJETO,
        entidade_id=projeto.id,
        acao=ProjetoHistoricoAcao.STATUS,
        descricao="Status do projeto alterado manualmente.",
        dados_anteriores={"status": anterior},
        dados_novos={"status": status},
        usuario=usuario,
    )

    recalcular_projeto(projeto, usuario=usuario)
    return projeto


@transaction.atomic
def atualizar_projeto(
    projeto,
    *,
    usuario,
    nome=None,
    descricao=None,
    referencia=None,
    cslog=None,
    categoria=None,
    empresa_nome=None,
    cliente=None,
    empresa_filtro=None,
    owner=None,
    stakeholder=None,
    grupo_ids=None,
    responsavel_ids=None,
    data_inicio=None,
    data_abertura=None,
    data_fim_prevista=None,
    data_homologacao_prevista=None,
    data_go_live_prevista=None,
    data_conclusao=None,
    prioridade=None,
    metodologia=None,
    recalcular_cronograma=False,
    substituir_cronograma=False,
    cronograma_modelo=None,
    duracao_dias_uteis=None,
    status=None,
):
    """Atualiza os dados gerenciais do projeto sem recriar sua estrutura."""
    responsavel_padrao_anterior_id = (
        projeto.vinculos_membros
        .filter(ativo=True)
        .exclude(papel="stakeholder")
        .exclude(pessoa_id=projeto.owner_id)
        .order_by("id")
        .values_list("pessoa_id", flat=True)
        .first()
    )
    anterior = {
        "nome": projeto.nome,
        "referencia": projeto.referencia,
        "cliente_id": projeto.cliente_id,
        "empresa_filtro_id": projeto.empresa_filtro_id,
        "owner_id": projeto.owner_id,
        "stakeholder_id": (
            projeto.vinculos_membros.filter(
                ativo=True, papel="stakeholder"
            ).values_list("pessoa_id", flat=True).first()
        ),
        "grupo_ids": list(projeto.grupos_trabalho.values_list("id", flat=True)),
        "responsavel_ids": list(
            projeto.vinculos_membros.filter(ativo=True).values_list("pessoa_id", flat=True)
        ),
        "data_inicio": projeto.data_inicio.isoformat() if projeto.data_inicio else None,
        "data_fim_prevista": projeto.data_fim_prevista.isoformat() if projeto.data_fim_prevista else None,
        "data_homologacao_prevista": projeto.data_homologacao_prevista.isoformat() if projeto.data_homologacao_prevista else None,
        "data_go_live_prevista": projeto.data_go_live_prevista.isoformat() if projeto.data_go_live_prevista else None,
        "data_conclusao": projeto.data_conclusao.isoformat() if projeto.data_conclusao else None,
    }

    if nome is not None:
        nome = str(nome or "").strip()
        if not nome:
            raise ValueError("Informe o nome do projeto.")
        projeto.nome = nome
    if descricao is not None:
        projeto.descricao = str(descricao or "").strip()
    if referencia is not None:
        projeto.referencia = str(referencia or "").strip()
    if cslog is not None:
        projeto.cslog = str(cslog or "").strip()
    if categoria is not None:
        projeto.categoria = str(categoria or "").strip()
    if empresa_nome is not None:
        projeto.empresa_nome = str(empresa_nome or "").strip()

    if projeto.owner_id and owner is None:
        raise ValueError("O Owner do projeto não pode ser removido.")

    projeto.cliente = cliente
    projeto.cliente_nome = str(getattr(cliente, "nome", "") or "").strip() if cliente else ""
    projeto.empresa_filtro = empresa_filtro
    # A partir da Etapa 4.1, customauth_empresa_filtro é a fonte oficial.
    # O campo legado permanece no model, mas não participa de novos cadastros/edições.
    projeto.empresa = None
    projeto.data_inicio = data_inicio
    projeto.data_abertura = data_abertura
    projeto.data_fim_prevista = data_fim_prevista
    projeto.data_homologacao_prevista = data_homologacao_prevista
    projeto.data_go_live_prevista = data_go_live_prevista
    projeto.data_conclusao = data_conclusao

    modelo_anterior_id = projeto.cronograma_modelo_id
    if cronograma_modelo is not None and cronograma_modelo.id != modelo_anterior_id:
        if (projeto.etapas.exists() or projeto.tarefas.exists()) and not substituir_cronograma:
            raise ValueError(
                "Confirme a substituição para trocar a metodologia de um projeto que já possui cronograma."
            )
        projeto.cronograma_modelo = cronograma_modelo

    status_alvo = status if status is not None else projeto.status
    if duracao_dias_uteis and status_alvo != ProjetoStatus.RASCUNHO:
        if not projeto.cronograma_modelo_id:
            raise ValueError("Selecione o tipo do projeto para calcular o cronograma.")
        planejamento = planejar_cronograma_modelo(
            projeto.data_inicio,
            duracao_dias_uteis,
            projeto.cronograma_modelo,
        )
        projeto.data_fim_prevista = planejamento["data_fim_prevista"]
        if not projeto.data_homologacao_prevista:
            projeto.data_homologacao_prevista = planejamento.get("data_homologacao_prevista")
        if not projeto.data_go_live_prevista:
            projeto.data_go_live_prevista = planejamento.get("data_go_live_prevista")
        recalcular_cronograma = True

    if prioridade is not None:
        projeto.prioridade = prioridade
    if metodologia is not None:
        projeto.metodologia = metodologia

    if status is not None:
        status_validos = {
            ProjetoStatus.RASCUNHO,
            ProjetoStatus.EM_ANDAMENTO,
            ProjetoStatus.AGUARDANDO,
            ProjetoStatus.PAUSADO,
            ProjetoStatus.HOMOLOGACAO,
            ProjetoStatus.ENCERRAMENTO,
            ProjetoStatus.CONCLUIDO,
            ProjetoStatus.CANCELADO,
        }
        if status not in status_validos:
            raise ValueError("Status de projeto inválido.")
        if status == ProjetoStatus.CONCLUIDO:
            obrigatorias = list(
                projeto.tarefas.filter(
                    ativo=True,
                    obrigatoria=True,
                ).exclude(status="cancelada").prefetch_related("checklist")
            )
            if not obrigatorias or not all(
                tarefa_totalmente_concluida(tarefa)
                for tarefa in obrigatorias
            ):
                raise ValueError(
                    "O projeto só pode ser concluído quando todas as tarefas e subtarefas obrigatórias estiverem concluídas."
                )
        projeto.status = status
        projeto.status_automatico = status not in {
            ProjetoStatus.RASCUNHO,
            ProjetoStatus.AGUARDANDO,
            ProjetoStatus.PAUSADO,
            ProjetoStatus.CANCELADO,
        }

    # Rascunho é apenas pré-cadastro: guarda metodologia, tipo e datas,
    # mas não cria Fases/Sprints/Tarefas antes da revisão e ativação.
    if projeto.status == ProjetoStatus.RASCUNHO:
        recalcular_cronograma = False
    elif (
        not projeto.etapas.exists()
        and not projeto.tarefas.exists()
        and projeto.cronograma_modelo_id
        and projeto.data_inicio
        and projeto.status in {
            ProjetoStatus.EM_ANDAMENTO,
            ProjetoStatus.HOMOLOGACAO,
            ProjetoStatus.ENCERRAMENTO,
        }
    ):
        recalcular_cronograma = True

    projeto.atualizado_por = usuario
    projeto.full_clean()
    projeto.save()

    participantes_ids = responsavel_ids
    if participantes_ids is None:
        participantes_ids = list(
            projeto.vinculos_membros
            .filter(ativo=True)
            .exclude(papel="stakeholder")
            .values_list("pessoa_id", flat=True)
        )

    definir_participantes_projeto(
        projeto,
        owner=owner,
        grupo_ids=grupo_ids or [],
        envolvido_ids=participantes_ids,
        usuario=usuario,
    )
    definir_stakeholder_projeto(
        projeto,
        stakeholder=stakeholder,
        usuario=usuario,
    )

    responsavel_padrao_novo_id = (
        responsavel_padrao_anterior_id
        if responsavel_ids is None
        else next(
            (int(x) for x in (responsavel_ids or []) if str(x).isdigit()),
            None,
        )
    )
    replicar_responsavel_padrao_tarefas(
        projeto,
        responsavel_anterior=responsavel_padrao_anterior_id,
        responsavel_novo=responsavel_padrao_novo_id,
        usuario=usuario,
    )

    if recalcular_cronograma and projeto.cronograma_modelo_id:
        if projeto.etapas.exists() or projeto.tarefas.exists():
            if substituir_cronograma:
                aplicar_cronograma_modelo(
                    projeto,
                    projeto.cronograma_modelo,
                    usuario=usuario,
                    substituir=True,
                    ajustar_data_fim=True,
                    duracao_projeto_dias_uteis=duracao_dias_uteis,
                )
            else:
                recalcular_datas_cronograma_existente(
                    projeto,
                    usuario=usuario,
                    ajustar_data_fim=bool(duracao_dias_uteis),
                    duracao_projeto_dias_uteis=duracao_dias_uteis,
                )
        else:
            aplicar_cronograma_modelo(
                projeto,
                projeto.cronograma_modelo,
                usuario=usuario,
                substituir=False,
                ajustar_data_fim=True,
                duracao_projeto_dias_uteis=duracao_dias_uteis,
            )

    ProjetoHistorico.objects.create(
        projeto=projeto,
        entidade=ProjetoHistoricoEntidade.PROJETO,
        entidade_id=projeto.id,
        acao=ProjetoHistoricoAcao.ALTERACAO,
        descricao=(
            "Projeto atualizado e cronograma recalculado."
            if recalcular_cronograma
            else "Dados do projeto atualizados."
        ),
        dados_anteriores=anterior,
        dados_novos={
            "nome": projeto.nome,
            "referencia": projeto.referencia,
            "cliente_id": projeto.cliente_id,
            "empresa_filtro_id": projeto.empresa_filtro_id,
            "owner_id": projeto.owner_id,
            "stakeholder_id": stakeholder.id if stakeholder else None,
            "grupo_ids": list(projeto.grupos_trabalho.values_list("id", flat=True)),
            "responsavel_ids": list(
                projeto.vinculos_membros.filter(ativo=True).values_list("pessoa_id", flat=True)
            ),
            "data_inicio": projeto.data_inicio.isoformat() if projeto.data_inicio else None,
            "data_fim_prevista": projeto.data_fim_prevista.isoformat() if projeto.data_fim_prevista else None,
            "data_homologacao_prevista": projeto.data_homologacao_prevista.isoformat() if projeto.data_homologacao_prevista else None,
            "data_go_live_prevista": projeto.data_go_live_prevista.isoformat() if projeto.data_go_live_prevista else None,
            "data_conclusao": projeto.data_conclusao.isoformat() if projeto.data_conclusao else None,
            "cronograma_modelo_id": projeto.cronograma_modelo_id,
            "duracao_dias_uteis": duracao_dias_uteis,
            "status": projeto.status,
            "status_automatico": projeto.status_automatico,
        },
        usuario=usuario,
    )

    recalcular_projeto(projeto, usuario=usuario)
    return projeto
