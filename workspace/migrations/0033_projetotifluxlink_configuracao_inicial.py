from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("workspace", "0032_projeto_tiflux_link"),
    ]

    operations = [
        migrations.AddField(
            model_name="projetotifluxlink",
            name="configuracao_inicial_aplicada",
            field=models.BooleanField(
                db_index=True,
                default=False,
                help_text=(
                    "Indica que os valores iniciais da integração já foram "
                    "aplicados. Edições posteriores feitas no módulo Projetos "
                    "não são sobrescritas."
                ),
            ),
        ),
    ]
