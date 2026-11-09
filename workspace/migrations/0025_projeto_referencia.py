from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("workspace", "0024_projeto_cliente_projeto_empresa_filtro_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="projeto",
            name="referencia",
            field=models.TextField(
                blank=True,
                default="",
                help_text=(
                    "Referências externas relacionadas ao projeto, como tickets, "
                    "chamados, IDs de integrações ou links. Pode conter mais de "
                    "uma referência."
                ),
            ),
        ),
    ]
