from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("workspace", "0046_remover_hibrida_migrar_para_agil"),
    ]

    operations = [
        migrations.AddField(
            model_name="projetotifluxlink",
            name="requestor_email_tiflux",
            field=models.EmailField(
                blank=True,
                default="",
                help_text="E-mail do solicitante recebido do TiFlux para comunicações do projeto.",
                max_length=254,
            ),
        ),
        migrations.AddField(
            model_name="projetotifluxlink",
            name="responsible_email_tiflux",
            field=models.EmailField(
                blank=True,
                default="",
                help_text="E-mail do responsável recebido do TiFlux para comunicações do projeto.",
                max_length=254,
            ),
        ),
        migrations.AddField(
            model_name="projetotifluxlink",
            name="followers_emails_tiflux",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text="Lista de e-mails dos followers/seguidores recebidos do TiFlux.",
            ),
        ),
    ]
