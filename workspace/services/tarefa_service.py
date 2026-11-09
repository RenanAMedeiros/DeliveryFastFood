from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from workspace.models import (
    ProjetoHistorico,
    ProjetoHistoricoAcao,
    ProjetoHistoricoEntidade,
    ProjetoTarefa,
    ProjetoTarefaChecklist,
    ProjetoTarefaDependencia,
    ProjetoTarefaResponsavel,
    ProjetoTarefaStatus,
    ProjetoTarefaTipo,
)
from workspace.services.regras_service import recalcular_projeto


STATUS_VALIDOS = {valor for valor, _ in ProjetoTarefaStatus.choices}
_NAO_INFORMADO = object()


def _normalizar_progresso(valor):
    progresso = Decimal(str(valor or 0))
    if progresso < 0:
        progresso = Decimal("0.00")
    if progresso > 100:
        progresso = Decimal("100.00")
    return progresso.quantize(Decimal("0.01"))


@transaction.atomic
def criar_tarefa(
    *,
    projeto,
    nome,
    usuario,
    etapa=None,
    descricao="",
    tipo=ProjetoTarefaTipo.TAREFA,
    categoria=None,
    prioridade=None,
    responsavel=None,
    responsaveis_pessoas=None,
    data_inicio=None,
    data_fim_prevista=None,
    peso=Decimal("1.00"),
    obrigatoria=True,
    ordem=1,
):
    nome = str(nome or "").strip()
    if not nome:
        raise ValueError("Informe o nome da tarefa.")

    if etapa is not None and etapa.projeto_id != projeto.id:
        raise ValueError("A fase/sprint informada pertence a outro projeto.")

    tarefa = ProjetoTarefa(
        projeto=projeto,
        etapa=etapa,
        nome=nome,
        descricao=str(descricao or "").strip(),
        tipo=tipo or ProjetoTarefaTipo.TAREFA,
        responsavel=responsavel,
        data_inicio=data_inicio,
        data_fim_prevista=data_fim_prevista,
        peso=peso or Decimal("1.00"),
        obrigatoria=bool(obrigatoria),
        ordem=max(1, int(ordem or 1)),
        criado_por=usuario,
        atualizado_por=usuario,
    )

    if categoria:
        tarefa.categoria = categoria
    if prioridade:
        tarefa.prioridade = prioridade

    if tarefa.tipo == ProjetoTarefaTipo.MARCO and tarefa.data_inicio:
        tarefa.data_fim_prevista = tarefa.data_inicio

    tarefa.full_clean()
    tarefa.save()

    pessoas = list(responsaveis_pessoas or [])
    for indice, pessoa in enumerate(pessoas):
        ProjetoTarefaResponsavel.objects.update_or_create(
            tarefa=tarefa,
            pessoa=pessoa,
            defaults={
                "principal": indice == 0,
                "ativo": True,
                "atribuido_por": usuario,
            },
        )

    # Compatibilidade: se a primeira pessoa possui acesso ao Workspace,
    # mantém também o campo legado responsavel.
    if pessoas and getattr(pessoas[0], "usuario_id", None):
        tarefa.responsavel = pessoas[0].usuario
        tarefa.save(update_fields=["responsavel", "atualizado_em"])

    ProjetoHistorico.objects.create(
        projeto=projeto,
        entidade=ProjetoHistoricoEntidade.TAREFA,
        entidade_id=tarefa.id,
        acao=ProjetoHistoricoAcao.CRIACAO,
        descricao=f'Tarefa "{tarefa.nome}" criada.',
        dados_novos={
            "tarefa_id": tarefa.id,
            "nome": tarefa.nome,
            "status": tarefa.status,
            "etapa_id": tarefa.etapa_id,
        },
        usuario=usuario,
    )

    recalcular_projeto(projeto, usuario=usuario)
    return tarefa


@transaction.atomic
def atualizar_dados_tarefa(
    tarefa,
    *,
    usuario=None,
    responsavel_pessoa=_NAO_INFORMADO,
    data_inicio=_NAO_INFORMADO,
    data_fim_prevista=_NAO_INFORMADO,
):
    """Atualiza responsável e período próprios da tarefa sem afetar o Owner."""
    data_inicio_anterior = tarefa.data_inicio
    anterior = {
        "responsavel_pessoa_id": (
            tarefa.vinculos_responsaveis
            .filter(ativo=True)
            .order_by("-principal", "id")
            .values_list("pessoa_id", flat=True)
            .first()
        ),
        "data_inicio": tarefa.data_inicio.isoformat() if tarefa.data_inicio else None,
        "data_fim_prevista": (
            tarefa.data_fim_prevista.isoformat()
            if tarefa.data_fim_prevista
            else None
        ),
    }

    if data_inicio is not _NAO_INFORMADO:
        tarefa.data_inicio = data_inicio
    if data_fim_prevista is not _NAO_INFORMADO:
        tarefa.data_fim_prevista = data_fim_prevista

    if tarefa.tipo == ProjetoTarefaTipo.MARCO and tarefa.data_inicio:
        tarefa.data_fim_prevista = tarefa.data_inicio

    tarefa.atualizado_por = usuario
    tarefa.full_clean()
    tarefa.save(
        update_fields=[
            "data_inicio",
            "data_fim_prevista",
            "atualizado_por",
            "atualizado_em",
        ]
    )
    sincronizar_datas_subtarefas(tarefa, data_inicio_anterior=data_inicio_anterior)

    if responsavel_pessoa is not _NAO_INFORMADO:
        ProjetoTarefaResponsavel.objects.filter(tarefa=tarefa).update(
            ativo=False,
            principal=False,
        )

        usuario_legado = None
        if responsavel_pessoa is not None:
            if not getattr(responsavel_pessoa, "ativo", False):
                raise ValueError("Responsável da tarefa inválido.")

            ProjetoTarefaResponsavel.objects.update_or_create(
                tarefa=tarefa,
                pessoa=responsavel_pessoa,
                defaults={
                    "principal": True,
                    "ativo": True,
                    "atribuido_por": usuario,
                },
            )

            if getattr(responsavel_pessoa, "usuario_id", None):
                pessoa_usuario = responsavel_pessoa.usuario
                if getattr(pessoa_usuario, "is_active", True):
                    usuario_legado = pessoa_usuario

        if tarefa.responsavel_id != getattr(usuario_legado, "id", None):
            tarefa.responsavel = usuario_legado
            tarefa.save(update_fields=["responsavel", "atualizado_em"])

    novo_responsavel_id = (
        tarefa.vinculos_responsaveis
        .filter(ativo=True)
        .order_by("-principal", "id")
        .values_list("pessoa_id", flat=True)
        .first()
    )

    novos = {
        "responsavel_pessoa_id": novo_responsavel_id,
        "data_inicio": tarefa.data_inicio.isoformat() if tarefa.data_inicio else None,
        "data_fim_prevista": (
            tarefa.data_fim_prevista.isoformat()
            if tarefa.data_fim_prevista
            else None
        ),
    }

    if anterior != novos:
        ProjetoHistorico.objects.create(
            projeto=tarefa.projeto,
            entidade=ProjetoHistoricoEntidade.TAREFA,
            entidade_id=tarefa.id,
            acao=ProjetoHistoricoAcao.ALTERACAO,
            descricao=f'Planejamento da tarefa "{tarefa.nome}" atualizado.',
            dados_anteriores=anterior,
            dados_novos=novos,
            usuario=usuario,
        )

    recalcular_projeto(tarefa.projeto, usuario=usuario)
    return tarefa


@transaction.atomic
def atualizar_status_tarefa(tarefa, status, usuario=None, progresso=None, motivo_bloqueio=None):
    if status not in STATUS_VALIDOS:
        raise ValueError("Status de tarefa inválido.")

    anterior = {
        "status": tarefa.status,
        "progresso": str(tarefa.progresso),
        "data_conclusao": tarefa.data_conclusao.isoformat() if tarefa.data_conclusao else None,
        "motivo_bloqueio": tarefa.motivo_bloqueio,
    }

    if status == ProjetoTarefaStatus.CONCLUIDA:
        pendentes = tarefa.checklist.filter(
            ativo=True,
            concluido=False,
        ).exists()
        if pendentes:
            raise ValueError(
                "Conclua todas as subtarefas antes de concluir a tarefa."
            )
    if status == ProjetoTarefaStatus.BLOQUEADA:
        motivo_validado = (
            str(motivo_bloqueio).strip()
            if motivo_bloqueio is not None
            else str(tarefa.motivo_bloqueio or "").strip()
        )
        if not motivo_validado:
            raise ValueError("Informe o impedimento que está bloqueando a tarefa.")

    tarefa.status = status

    if progresso is not None:
        tarefa.progresso = _normalizar_progresso(progresso)

    if status == ProjetoTarefaStatus.CONCLUIDA:
        tarefa.progresso = Decimal("100.00")
        tarefa.data_conclusao = tarefa.data_conclusao or timezone.localdate()
        tarefa.motivo_bloqueio = ""
    elif status in {
        ProjetoTarefaStatus.BACKLOG,
        ProjetoTarefaStatus.NAO_INICIADA,
    }:
        if progresso is None:
            tarefa.progresso = Decimal("0.00")
        tarefa.data_conclusao = None
        tarefa.motivo_bloqueio = ""
    elif status == ProjetoTarefaStatus.BLOQUEADA:
        tarefa.data_conclusao = None
        tarefa.motivo_bloqueio = motivo_validado
    else:
        tarefa.data_conclusao = None
        if status != ProjetoTarefaStatus.BLOQUEADA:
            tarefa.motivo_bloqueio = ""

    tarefa.atualizado_por = usuario
    tarefa.full_clean()
    tarefa.save(
        update_fields=[
            "status",
            "progresso",
            "data_conclusao",
            "motivo_bloqueio",
            "atualizado_por",
            "atualizado_em",
        ]
    )

    ProjetoHistorico.objects.create(
        projeto=tarefa.projeto,
        entidade=ProjetoHistoricoEntidade.TAREFA,
        entidade_id=tarefa.id,
        acao=(
            ProjetoHistoricoAcao.CONCLUSAO
            if status == ProjetoTarefaStatus.CONCLUIDA
            else ProjetoHistoricoAcao.STATUS
        ),
        descricao=f'Status da tarefa "{tarefa.nome}" alterado para {tarefa.get_status_display()}.',
        dados_anteriores=anterior,
        dados_novos={
            "status": tarefa.status,
            "progresso": str(tarefa.progresso),
            "data_conclusao": tarefa.data_conclusao.isoformat() if tarefa.data_conclusao else None,
            "motivo_bloqueio": tarefa.motivo_bloqueio,
        },
        usuario=usuario,
    )

    recalcular_projeto(tarefa.projeto, usuario=usuario)
    return tarefa


@transaction.atomic
def atualizar_progresso_tarefa(tarefa, progresso, usuario=None):
    progresso = _normalizar_progresso(progresso)

    status = tarefa.status
    if progresso >= Decimal("100.00"):
        status = ProjetoTarefaStatus.CONCLUIDA
    elif progresso > Decimal("0.00") and status in {
        ProjetoTarefaStatus.BACKLOG,
        ProjetoTarefaStatus.NAO_INICIADA,
    }:
        status = ProjetoTarefaStatus.EM_ANDAMENTO

    return atualizar_status_tarefa(
        tarefa,
        status,
        usuario=usuario,
        progresso=progresso,
    )


@transaction.atomic
def adicionar_dependencia(tarefa, depende_de, usuario=None):
    dependencia = ProjetoTarefaDependencia(
        tarefa=tarefa,
        depende_de=depende_de,
        criada_por=usuario,
    )
    dependencia.full_clean()
    dependencia.save()

    ProjetoHistorico.objects.create(
        projeto=tarefa.projeto,
        entidade=ProjetoHistoricoEntidade.DEPENDENCIA,
        entidade_id=dependencia.id,
        acao=ProjetoHistoricoAcao.CRIACAO,
        descricao=f'Criada dependência: "{tarefa.nome}" depende de "{depende_de.nome}".',
        dados_novos={
            "tarefa_id": tarefa.id,
            "depende_de_id": depende_de.id,
        },
        usuario=usuario,
    )

    return dependencia


@transaction.atomic
def sincronizar_tarefa_com_checklist(tarefa, usuario=None):
    """Sincroniza status/progresso da tarefa com suas subtarefas ativas."""
    itens = list(tarefa.checklist.filter(ativo=True))
    if not itens or tarefa.status == ProjetoTarefaStatus.CANCELADA:
        recalcular_projeto(tarefa.projeto, usuario=usuario)
        return tarefa

    concluidas = sum(1 for item in itens if item.concluido)
    progresso = _normalizar_progresso(
        Decimal(concluidas) * Decimal("100.00") / Decimal(len(itens))
    )

    if concluidas == len(itens):
        status = ProjetoTarefaStatus.CONCLUIDA
    elif tarefa.status == ProjetoTarefaStatus.CONCLUIDA or (
        concluidas > 0
        and tarefa.status in {
            ProjetoTarefaStatus.BACKLOG,
            ProjetoTarefaStatus.NAO_INICIADA,
        }
    ):
        status = ProjetoTarefaStatus.EM_ANDAMENTO
    else:
        status = tarefa.status

    if (
        status == tarefa.status
        and _normalizar_progresso(tarefa.progresso) == progresso
    ):
        recalcular_projeto(tarefa.projeto, usuario=usuario)
        return tarefa

    return atualizar_status_tarefa(
        tarefa,
        status,
        usuario=usuario,
        progresso=progresso,
        motivo_bloqueio=tarefa.motivo_bloqueio,
    )


@transaction.atomic
def criar_item_checklist(
    tarefa,
    descricao,
    usuario=None,
    ordem=None,
    responsavel_pessoa=None,
    data_inicio=None,
    data_fim_prevista=None,
    herdar_responsavel=True,
):
    descricao = str(descricao or "").strip()
    if not descricao:
        raise ValueError("Informe a descrição da subtarefa.")

    if ordem is None:
        ultima_ordem = (
            ProjetoTarefaChecklist.objects
            .filter(tarefa=tarefa, ativo=True)
            .order_by("-ordem")
            .values_list("ordem", flat=True)
            .first()
            or 0
        )
        ordem = ultima_ordem + 1

    if responsavel_pessoa is not None and not getattr(responsavel_pessoa, "ativo", False):
        raise ValueError("Executor da subtarefa inválido.")

    item = ProjetoTarefaChecklist(
        tarefa=tarefa,
        descricao=descricao,
        ordem=max(1, int(ordem or 1)),
        responsavel_pessoa=responsavel_pessoa,
        herdar_responsavel_tarefa=bool(herdar_responsavel),
        data_inicio=data_inicio if data_inicio is not None else tarefa.data_inicio,
        data_fim_prevista=(
            data_fim_prevista
            if data_fim_prevista is not None
            else tarefa.data_fim_prevista
        ),
        ativo=True,
        criado_por=usuario,
    )
    item.full_clean()
    item.save()

    ProjetoHistorico.objects.create(
        projeto=tarefa.projeto,
        entidade=ProjetoHistoricoEntidade.CHECKLIST,
        entidade_id=item.id,
        acao=ProjetoHistoricoAcao.CRIACAO,
        descricao=f'Subtarefa adicionada à tarefa "{tarefa.nome}".',
        dados_novos={
            "checklist_id": item.id,
            "descricao": item.descricao,
            "responsavel_pessoa_id": item.responsavel_pessoa_id,
            "herdar_responsavel_tarefa": item.herdar_responsavel_tarefa,
            "data_inicio": item.data_inicio.isoformat() if item.data_inicio else None,
            "data_fim_prevista": (
                item.data_fim_prevista.isoformat() if item.data_fim_prevista else None
            ),
        },
        usuario=usuario,
    )

    sincronizar_tarefa_com_checklist(tarefa, usuario=usuario)
    return item


@transaction.atomic
def definir_item_checklist(item, concluido, usuario=None):
    concluido = bool(concluido)
    anterior = item.concluido

    item.concluido = concluido
    item.concluido_por = usuario if concluido else None
    item.concluido_em = timezone.now() if concluido else None
    item.save(
        update_fields=[
            "concluido",
            "concluido_por",
            "concluido_em",
            "atualizado_em",
        ]
    )

    if anterior != concluido:
        ProjetoHistorico.objects.create(
            projeto=item.tarefa.projeto,
            entidade=ProjetoHistoricoEntidade.CHECKLIST,
            entidade_id=item.id,
            acao=ProjetoHistoricoAcao.ALTERACAO,
            descricao=(
                f'Checklist "{item.descricao}" concluído.'
                if concluido
                else f'Checklist "{item.descricao}" reaberto.'
            ),
            dados_anteriores={"concluido": anterior},
            dados_novos={"concluido": concluido},
            usuario=usuario,
        )

    sincronizar_tarefa_com_checklist(item.tarefa, usuario=usuario)
    return item


@transaction.atomic
def atualizar_item_checklist(
    item,
    *,
    descricao=None,
    concluido=None,
    responsavel_pessoa=_NAO_INFORMADO,
    herdar_responsavel=_NAO_INFORMADO,
    data_inicio=_NAO_INFORMADO,
    data_fim_prevista=_NAO_INFORMADO,
    usuario=None,
):
    if not item.ativo:
        raise ValueError("A subtarefa foi removida e não pode ser alterada.")

    anterior = {
        "descricao": item.descricao,
        "concluido": bool(item.concluido),
        "responsavel_pessoa_id": item.responsavel_pessoa_id,
        "herdar_responsavel_tarefa": item.herdar_responsavel_tarefa,
        "data_inicio": item.data_inicio.isoformat() if item.data_inicio else None,
        "data_fim_prevista": (
            item.data_fim_prevista.isoformat() if item.data_fim_prevista else None
        ),
    }
    campos = []

    if descricao is not None:
        descricao = str(descricao or "").strip()
        if not descricao:
            raise ValueError("Informe a descrição da subtarefa.")
        if descricao != item.descricao:
            item.descricao = descricao
            campos.append("descricao")

    if concluido is not None:
        concluido = bool(concluido)
        if concluido != item.concluido:
            item.concluido = concluido
            item.concluido_por = usuario if concluido else None
            item.concluido_em = timezone.now() if concluido else None
            campos.extend(["concluido", "concluido_por", "concluido_em"])

    if responsavel_pessoa is not _NAO_INFORMADO:
        if responsavel_pessoa is not None and not getattr(responsavel_pessoa, "ativo", False):
            raise ValueError("Executor da subtarefa inválido.")
        if item.responsavel_pessoa_id != getattr(responsavel_pessoa, "id", None):
            item.responsavel_pessoa = responsavel_pessoa
            campos.append("responsavel_pessoa")

    if herdar_responsavel is not _NAO_INFORMADO:
        herdar_responsavel = bool(herdar_responsavel)
        if item.herdar_responsavel_tarefa != herdar_responsavel:
            item.herdar_responsavel_tarefa = herdar_responsavel
            campos.append("herdar_responsavel_tarefa")

    if data_inicio is not _NAO_INFORMADO and item.data_inicio != data_inicio:
        item.data_inicio = data_inicio
        campos.append("data_inicio")
    if data_fim_prevista is not _NAO_INFORMADO and item.data_fim_prevista != data_fim_prevista:
        item.data_fim_prevista = data_fim_prevista
        campos.append("data_fim_prevista")

    if campos:
        item.full_clean()
        campos.append("atualizado_em")
        item.save(update_fields=list(dict.fromkeys(campos)))
        ProjetoHistorico.objects.create(
            projeto=item.tarefa.projeto,
            entidade=ProjetoHistoricoEntidade.CHECKLIST,
            entidade_id=item.id,
            acao=ProjetoHistoricoAcao.ALTERACAO,
            descricao=f'Subtarefa "{item.descricao}" atualizada.',
            dados_anteriores=anterior,
            dados_novos={
                "descricao": item.descricao,
                "concluido": bool(item.concluido),
                "responsavel_pessoa_id": item.responsavel_pessoa_id,
                "herdar_responsavel_tarefa": item.herdar_responsavel_tarefa,
                "data_inicio": item.data_inicio.isoformat() if item.data_inicio else None,
                "data_fim_prevista": (
                    item.data_fim_prevista.isoformat()
                    if item.data_fim_prevista
                    else None
                ),
            },
            usuario=usuario,
        )

        sincronizar_tarefa_com_checklist(item.tarefa, usuario=usuario)

    return item


@transaction.atomic
def aplicar_responsavel_tarefa_nas_subtarefas(tarefa, usuario=None):
    """Faz todas as subtarefas ativas voltarem a herdar o líder da tarefa."""
    quantidade = tarefa.checklist.filter(ativo=True).update(
        responsavel_pessoa=None,
        herdar_responsavel_tarefa=True,
        atualizado_em=timezone.now(),
    )
    if quantidade:
        ProjetoHistorico.objects.create(
            projeto=tarefa.projeto,
            entidade=ProjetoHistoricoEntidade.CHECKLIST,
            entidade_id=tarefa.id,
            acao=ProjetoHistoricoAcao.RESPONSAVEL,
            descricao=f'Líder da tarefa "{tarefa.nome}" aplicado às subtarefas.',
            dados_novos={"subtarefas_atualizadas": quantidade, "herdar": True},
            usuario=usuario,
        )
    return quantidade


def sincronizar_datas_subtarefas(tarefa, data_inicio_anterior=None):
    """Mantém toda subtarefa dentro do novo bloco de datas da tarefa/Sprint."""
    deslocamento = None
    if data_inicio_anterior and tarefa.data_inicio:
        deslocamento = tarefa.data_inicio - data_inicio_anterior

    for item in tarefa.checklist.filter(ativo=True):
        inicio = item.data_inicio or tarefa.data_inicio
        fim = item.data_fim_prevista or tarefa.data_fim_prevista
        if deslocamento:
            inicio = inicio + deslocamento if inicio else inicio
            fim = fim + deslocamento if fim else fim

        if tarefa.data_inicio:
            inicio = max(inicio, tarefa.data_inicio) if inicio else tarefa.data_inicio
            fim = max(fim, tarefa.data_inicio) if fim else tarefa.data_inicio
        if tarefa.data_fim_prevista:
            inicio = min(inicio, tarefa.data_fim_prevista) if inicio else tarefa.data_fim_prevista
            fim = min(fim, tarefa.data_fim_prevista) if fim else tarefa.data_fim_prevista
        if inicio and fim and fim < inicio:
            fim = inicio

        if item.data_inicio != inicio or item.data_fim_prevista != fim:
            item.data_inicio = inicio
            item.data_fim_prevista = fim
            item.full_clean()
            item.save(update_fields=["data_inicio", "data_fim_prevista", "atualizado_em"])


@transaction.atomic
def remover_item_checklist(item, usuario=None):
    if not item.ativo:
        return item

    item.ativo = False
    item.save(update_fields=["ativo", "atualizado_em"])
    ProjetoHistorico.objects.create(
        projeto=item.tarefa.projeto,
        entidade=ProjetoHistoricoEntidade.CHECKLIST,
        entidade_id=item.id,
        acao=ProjetoHistoricoAcao.ALTERACAO,
        descricao=f'Subtarefa "{item.descricao}" removida da execução.',
        dados_anteriores={"ativo": True, "descricao": item.descricao},
        dados_novos={"ativo": False, "descricao": item.descricao},
        usuario=usuario,
    )
    sincronizar_tarefa_com_checklist(item.tarefa, usuario=usuario)
    return item


def _tarefas_etapa_incluindo_sprints(etapa):
    """Retorna tarefas diretas ou, na Fase híbrida, tarefas das Sprints filhas."""
    diretas = list(
        etapa.tarefas.filter(ativo=True)
        .exclude(status=ProjetoTarefaStatus.CANCELADA)
        .prefetch_related("checklist")
    )
    if diretas:
        return diretas

    try:
        filhos = etapa.sprints.filter(ativo=True).order_by("ordem", "id")
    except Exception:
        filhos = []
    tarefas = []
    for sprint in filhos:
        tarefas.extend(list(
            sprint.tarefas.filter(ativo=True)
            .exclude(status=ProjetoTarefaStatus.CANCELADA)
            .prefetch_related("checklist")
        ))
    return tarefas


@transaction.atomic
def concluir_etapa_completa(etapa, usuario=None):
    """Conclui tarefas/subtarefas da Sprint ou de toda a Fase híbrida."""
    tarefas = _tarefas_etapa_incluindo_sprints(etapa)
    tipo_nome = etapa.get_tipo_display()
    if not tarefas:
        raise ValueError(f"A {tipo_nome} não possui tarefas ativas para concluir.")

    agora = timezone.now()
    for tarefa in tarefas:
        tarefa.checklist.filter(ativo=True, concluido=False).update(
            concluido=True,
            concluido_por=usuario,
            concluido_em=agora,
            atualizado_em=agora,
        )
        atualizar_status_tarefa(
            tarefa,
            ProjetoTarefaStatus.CONCLUIDA,
            usuario=usuario,
            progresso=Decimal("100.00"),
        )

    ProjetoHistorico.objects.create(
        projeto=etapa.projeto,
        entidade=ProjetoHistoricoEntidade.ETAPA,
        entidade_id=etapa.id,
        acao=ProjetoHistoricoAcao.CONCLUSAO,
        descricao=f'{tipo_nome} "{etapa.nome}" concluída em lote.',
        dados_novos={"tarefas_concluidas": len(tarefas), "tipo_etapa": etapa.tipo},
        usuario=usuario,
    )
    recalcular_projeto(etapa.projeto, usuario=usuario)
    return etapa

@transaction.atomic
def reabrir_etapa_completa(etapa, usuario=None):
    """Reabre em lote a Sprint ou todas as Sprints contidas em uma Fase híbrida."""
    tarefas = _tarefas_etapa_incluindo_sprints(etapa)
    tipo_nome = etapa.get_tipo_display()
    if not tarefas:
        raise ValueError(f"A {tipo_nome} não possui tarefas ativas para reabrir.")

    agora = timezone.now()
    for tarefa in tarefas:
        tarefa.checklist.filter(ativo=True).update(
            concluido=False,
            concluido_por=None,
            concluido_em=None,
            atualizado_em=agora,
        )
        atualizar_status_tarefa(
            tarefa,
            ProjetoTarefaStatus.EM_ANDAMENTO,
            usuario=usuario,
            progresso=Decimal("0.00"),
        )

    ProjetoHistorico.objects.create(
        projeto=etapa.projeto,
        entidade=ProjetoHistoricoEntidade.ETAPA,
        entidade_id=etapa.id,
        acao=ProjetoHistoricoAcao.REABERTURA,
        descricao=f'{tipo_nome} "{etapa.nome}" reaberta em lote.',
        dados_novos={"tarefas_reabertas": len(tarefas), "tipo_etapa": etapa.tipo},
        usuario=usuario,
    )
    recalcular_projeto(etapa.projeto, usuario=usuario)
    return etapa


@transaction.atomic
def replicar_responsavel_etapa(etapa, pessoa, usuario=None, incluir_subtarefas=False):
    """Atribui uma pessoa às tarefas da etapa ou às Sprints da Fase híbrida."""
    tipo_nome = etapa.get_tipo_display()
    if not pessoa or not pessoa.ativo:
        raise ValueError(f"Selecione um responsável válido para a {tipo_nome}.")

    tarefas = _tarefas_etapa_incluindo_sprints(etapa)
    if not tarefas:
        raise ValueError(f"A {tipo_nome} não possui tarefas ativas.")

    for tarefa in tarefas:
        atualizar_dados_tarefa(tarefa, responsavel_pessoa=pessoa, usuario=usuario)
        if incluir_subtarefas:
            tarefa.checklist.filter(ativo=True).update(
                responsavel_pessoa=pessoa,
                herdar_responsavel_tarefa=False,
                atualizado_em=timezone.now(),
            )

    usuario_legado = (
        pessoa.usuario
        if pessoa.usuario_id and getattr(pessoa.usuario, "is_active", True)
        else None
    )
    etapa.responsavel = usuario_legado
    etapa.atualizado_por = usuario
    etapa.save(update_fields=["responsavel", "atualizado_por", "atualizado_em"])

    ProjetoHistorico.objects.create(
        projeto=etapa.projeto,
        entidade=ProjetoHistoricoEntidade.ETAPA,
        entidade_id=etapa.id,
        acao=ProjetoHistoricoAcao.RESPONSAVEL,
        descricao=f'Responsável replicado em todas as tarefas da {tipo_nome} "{etapa.nome}".',
        dados_novos={
            "responsavel_pessoa_id": pessoa.id,
            "tarefas_atualizadas": len(tarefas),
            "subtarefas_incluidas": bool(incluir_subtarefas),
            "tipo_etapa": etapa.tipo,
        },
        usuario=usuario,
    )
    recalcular_projeto(etapa.projeto, usuario=usuario)
    return etapa

