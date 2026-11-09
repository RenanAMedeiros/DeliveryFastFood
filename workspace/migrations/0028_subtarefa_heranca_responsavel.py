from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("workspace", "0027_subtarefa_responsavel_e_datas"),
    ]

    operations = [
        migrations.AddField(
            model_name="projetotarefachecklist",
            name="herdar_responsavel_tarefa",
            field=models.BooleanField(
                default=True,
                help_text="Quando ativo, usa dinamicamente o responsável principal da tarefa.",
            ),
        ),
    ]
