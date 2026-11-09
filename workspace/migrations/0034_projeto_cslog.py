from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("workspace", "0033_projetotifluxlink_configuracao_inicial"),
    ]

    operations = [
        migrations.AddField(
            model_name="projeto",
            name="cslog",
            field=models.CharField(
                blank=True,
                db_index=True,
                default="",
                help_text="Identificador CSLOG relacionado ao projeto.",
                max_length=120,
            ),
        ),
        migrations.AddField(
            model_name="projetotifluxlink",
            name="ticket_cslog_tiflux",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
        migrations.AddField(
            model_name="projetotifluxlink",
            name="ajuste_v4_aplicado",
            field=models.BooleanField(
                db_index=True,
                default=False,
                help_text=(
                    "Indica que CSLOG e limpeza inicial da descrição já foram aplicados."
                ),
            ),
        ),
    ]
