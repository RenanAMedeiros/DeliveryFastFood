from django.db import migrations


def reativar_e_recalcular_homologacao(apps, schema_editor):
    Projeto = apps.get_model("workspace", "Projeto")
    ProjetoTarefa = apps.get_model("workspace", "ProjetoTarefa")

    projetos = Projeto.objects.filter(
        ativo=True,
        status="homologacao",
        status_automatico=False,
    )

    for projeto in projetos.iterator():
        tarefas = (
            ProjetoTarefa.objects.filter(projeto_id=projeto.id, ativo=True)
            .exclude(status="cancelada")
            .select_related("etapa")
        )

        maior_sprint_iniciada = 0
        iniciou = False
        for tarefa in tarefas:
            tarefa_iniciada = (
                tarefa.status not in ["backlog", "nao_iniciada"]
                or float(tarefa.progresso or 0) > 0
            )
            if not tarefa_iniciada:
                continue

            iniciou = True
            if tarefa.etapa_id:
                maior_sprint_iniciada = max(
                    maior_sprint_iniciada,
                    int(tarefa.etapa.ordem or 0),
                )

        if maior_sprint_iniciada >= 5:
            novo_status = "encerramento"
        elif maior_sprint_iniciada >= 4:
            novo_status = "homologacao"
        elif iniciou:
            novo_status = "em_andamento"
        else:
            novo_status = "rascunho"

        Projeto.objects.filter(pk=projeto.pk).update(
            status=novo_status,
            status_automatico=True,
        )


class Migration(migrations.Migration):

    dependencies = [
        ("workspace", "0029_projeto_status_encerramento"),
    ]

    operations = [
        migrations.RunPython(
            reativar_e_recalcular_homologacao,
            migrations.RunPython.noop,
        ),
    ]
