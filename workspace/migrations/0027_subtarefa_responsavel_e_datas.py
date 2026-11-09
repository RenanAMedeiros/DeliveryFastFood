from django.db import migrations, models
import django.db.models.deletion


def preencher_periodo_subtarefas(apps, schema_editor):
    Subtarefa = apps.get_model("workspace", "ProjetoTarefaChecklist")
    for subtarefa in Subtarefa.objects.select_related("tarefa").iterator():
        tarefa = subtarefa.tarefa
        subtarefa.data_inicio = tarefa.data_inicio
        subtarefa.data_fim_prevista = tarefa.data_fim_prevista
        subtarefa.save(update_fields=["data_inicio", "data_fim_prevista"])


class Migration(migrations.Migration):

    dependencies = [
        ("workspace", "0026_alinhar_status_tarefas"),
    ]

    operations = [
        migrations.AddField(
            model_name="projetotarefachecklist",
            name="data_fim_prevista",
            field=models.DateField(blank=True, db_index=True, null=True),
        ),
        migrations.AddField(
            model_name="projetotarefachecklist",
            name="data_inicio",
            field=models.DateField(blank=True, db_index=True, null=True),
        ),
        migrations.AddField(
            model_name="projetotarefachecklist",
            name="responsavel_pessoa",
            field=models.ForeignKey(
                blank=True,
                help_text="Executor específico. Vazio significa herdar o responsável da tarefa.",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="subtarefas_projetos",
                to="workspace.projetopessoa",
            ),
        ),
        migrations.RunPython(preencher_periodo_subtarefas, migrations.RunPython.noop),
    ]
