from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("workspace", "0034_projeto_cslog"),
    ]

    operations = [
        migrations.AddField(
            model_name="projeto",
            name="categoria",
            field=models.CharField(
                blank=True,
                db_index=True,
                default="",
                help_text="Categoria recebida do TiFlux ou informada manualmente.",
                max_length=150,
            ),
        ),
        migrations.AddField(
            model_name="projeto",
            name="empresa_nome",
            field=models.CharField(
                blank=True,
                db_index=True,
                default="",
                help_text="Nome da empresa recebido do TiFlux ou informado manualmente.",
                max_length=255,
            ),
        ),
        migrations.AddField(
            model_name="projeto",
            name="data_abertura",
            field=models.DateField(
                blank=True,
                db_index=True,
                help_text="Data em que o projeto foi aberto/cadastrado.",
                null=True,
            ),
        ),
        migrations.AlterField(
            model_name="projeto",
            name="status",
            field=models.CharField(
                choices=[
                    ("rascunho", "Rascunho"),
                    ("planejado", "Planejado"),
                    ("em_andamento", "Em andamento"),
                    ("aguardando", "Aguardando"),
                    ("pausado", "Pausado"),
                    ("homologacao", "Homologação"),
                    ("encerramento", "Encerramento"),
                    ("concluido", "Concluído"),
                    ("cancelado", "Cancelado"),
                ],
                db_index=True,
                default="rascunho",
                max_length=20,
            ),
        ),
    ]
