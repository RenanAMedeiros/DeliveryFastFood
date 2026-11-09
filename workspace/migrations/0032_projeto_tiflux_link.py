from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("workspace", "0031_projetomembro_papeis_acumulaveis"),
    ]

    operations = [
        migrations.CreateModel(
            name="ProjetoTifluxLink",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("ticket_number", models.CharField(db_index=True, max_length=50, unique=True)),
                ("ticket_title", models.CharField(blank=True, default="", max_length=500)),
                ("desk_name", models.CharField(blank=True, default="", max_length=150)),
                ("categoria", models.CharField(blank=True, default="", max_length=150)),
                ("nome_projeto_tiflux", models.CharField(blank=True, default="", max_length=255)),
                ("cliente_nome_tiflux", models.CharField(blank=True, default="", max_length=255)),
                ("empresa_nome_tiflux", models.CharField(blank=True, default="", max_length=255)),
                ("solicitante_nome_tiflux", models.CharField(blank=True, default="", max_length=255)),
                ("responsavel_nome_tiflux", models.CharField(blank=True, default="", max_length=255)),
                ("criado_automaticamente", models.BooleanField(default=True)),
                ("ultima_sincronizacao_em", models.DateTimeField(auto_now=True)),
                ("criado_em", models.DateTimeField(auto_now_add=True)),
                ("projeto", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="tickets_tiflux", to="workspace.projeto")),
            ],
            options={
                "verbose_name": "Vínculo de projeto com TiFlux",
                "verbose_name_plural": "Vínculos de projetos com TiFlux",
                "db_table": "workspace_projetotifluxlink",
                "ordering": ["-ultima_sincronizacao_em", "-id"],
            },
        ),
        migrations.AddIndex(
            model_name="projetotifluxlink",
            index=models.Index(fields=["projeto", "ticket_number"], name="idx_proj_tiflux_ticket"),
        ),
    ]
