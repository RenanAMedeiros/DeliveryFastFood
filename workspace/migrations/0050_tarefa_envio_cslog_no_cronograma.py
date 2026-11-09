from django.db import migrations
from django.db.models import Max
from django.utils import timezone


TAREFA_NOME = "Preparar e enviar demanda para CSLOG"
TAREFA_DESCRICAO = (
    "Marco operacional de passagem QORE → CSLOG. A data final desta tarefa "
    "representa a data esperada para abrir/enviar a demanda ao fornecedor."
)
SUBTAREFAS = (
    "Consolidar requisitos levantados com o cliente",
    "Validar escopo e premissas com o cliente",
    "Organizar documentação, evidências e critérios de aceite",
    "Abrir/registrar a demanda na CSLOG",
    "Confirmar referência CSLOG e envio completo ao fornecedor",
)


def criar_tarefas_cslog(apps, schema_editor):
    Projeto = apps.get_model("workspace", "Projeto")
    Etapa = apps.get_model("workspace", "ProjetoEtapa")
    Tarefa = apps.get_model("workspace", "ProjetoTarefa")
    Checklist = apps.get_model("workspace", "ProjetoTarefaChecklist")

    projetos = Projeto.objects.exclude(cslog="").exclude(
        status__in=["concluido", "cancelado"]
    )

    for projeto in projetos.iterator():
        if Tarefa.objects.filter(
            projeto_id=projeto.id,
            ativo=True,
            nome__iexact=TAREFA_NOME,
        ).exists():
            continue

        etapas = list(
            Etapa.objects.filter(
                projeto_id=projeto.id,
                ativo=True,
                fase_pai_id__isnull=True,
            ).order_by("ordem", "id")
        )
        if not etapas:
            continue
        planejamento = [e for e in etapas if str(e.momento or "") == "planejamento"]
        etapa = planejamento[-1] if planejamento else etapas[0]
        maior_ordem = (
            Tarefa.objects.filter(
                projeto_id=projeto.id,
                etapa_id=etapa.id,
                ativo=True,
            ).aggregate(valor=Max("ordem")).get("valor")
            or 0
        )

        status = "concluida" if projeto.cslog_ticket_aberto_em else "nao_iniciada"
        progresso = 100 if projeto.cslog_ticket_aberto_em else 0
        tarefa = Tarefa.objects.create(
            projeto_id=projeto.id,
            etapa_id=etapa.id,
            nome=TAREFA_NOME,
            descricao=TAREFA_DESCRICAO,
            tipo="tarefa",
            categoria="planejamento",
            status=status,
            prioridade=projeto.prioridade or "media",
            ordem=int(maior_ordem) + 1,
            data_inicio=etapa.data_inicio,
            data_fim_prevista=etapa.data_fim_prevista,
            data_conclusao=projeto.cslog_ticket_aberto_em,
            progresso=progresso,
            peso=1,
            obrigatoria=True,
            ativo=True,
        )
        agora = timezone.now()
        for ordem, descricao in enumerate(SUBTAREFAS, start=1):
            Checklist.objects.create(
                tarefa_id=tarefa.id,
                descricao=descricao,
                ordem=ordem,
                herdar_responsavel_tarefa=True,
                data_inicio=tarefa.data_inicio,
                data_fim_prevista=tarefa.data_fim_prevista,
                ativo=True,
                concluido=bool(projeto.cslog_ticket_aberto_em),
                concluido_em=agora if projeto.cslog_ticket_aberto_em else None,
            )


def noop_reverse(apps, schema_editor):
    # Não remove tarefas já utilizadas no cronograma ao fazer rollback.
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("workspace", "0049_funil_prazos_cslog"),
    ]

    operations = [
        migrations.RunPython(criar_tarefas_cslog, noop_reverse),
    ]
