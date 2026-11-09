from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


LIDERES = {
    "Renan Medeiros": {
        "area": "Desenvolvimento",
        "membros": ["Arthur Costa", "Renan Balbino", "Gabriel Torrecilla"],
    },
    "Emanuela Silva": {
        "area": "Processos",
        "membros": [
            "Caio Siqueira",
            "Fernanda Lisboa",
            "Danilo Mendonça",
            "Tamiris Marques",
            "Eduarda Oliveira",
        ],
    },
    "Gustavo Rodrigo": {
        "area": "Business Intelligence",
        "membros": ["Rodrigo Sanches"],
    },
}


def carregar_hierarquia_inicial(apps, schema_editor):
    Relacao = apps.get_model("workspace", "StatusReportLiderEquipe")
    for lider, configuracao in LIDERES.items():
        nomes = [lider, *configuracao["membros"]]
        for nome in nomes:
            Relacao.objects.get_or_create(
                lider_nome=lider,
                membro_nome=nome,
                defaults={
                    "area": configuracao["area"],
                    "ativo": True,
                },
            )


def remover_hierarquia_inicial(apps, schema_editor):
    Relacao = apps.get_model("workspace", "StatusReportLiderEquipe")
    Relacao.objects.filter(lider_nome__in=LIDERES.keys()).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("workspace", "0040_projeto_referencias_urls"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="StatusReportLiderEquipe",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("lider_nome", models.CharField(db_index=True, max_length=255)),
                ("area", models.CharField(db_index=True, max_length=180)),
                ("membro_nome", models.CharField(db_index=True, max_length=255)),
                ("ativo", models.BooleanField(db_index=True, default=True)),
                ("criado_em", models.DateTimeField(auto_now_add=True)),
                ("atualizado_em", models.DateTimeField(auto_now=True)),
            ],
            options={
                "db_table": "workspace_status_report_lider_equipe",
                "ordering": ["lider_nome", "membro_nome"],
            },
        ),
        migrations.CreateModel(
            name="StatusReportDiario",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("data_referencia", models.DateField(db_index=True)),
                ("lider_nome", models.CharField(db_index=True, max_length=255)),
                ("area", models.CharField(blank=True, default="", max_length=180)),
                ("ontem", models.TextField(blank=True, default="")),
                ("hoje", models.TextField(blank=True, default="")),
                ("bloqueio", models.TextField(blank=True, default="")),
                ("prioridade_critica", models.TextField(blank=True, default="")),
                ("impacto", models.TextField(blank=True, default="")),
                ("plano_recuperacao", models.TextField(blank=True, default="")),
                ("decisao_necessaria", models.TextField(blank=True, default="")),
                ("decisor", models.CharField(blank=True, default="", max_length=255)),
                ("prazo_decisao", models.DateField(blank=True, null=True)),
                ("evidencia_url", models.URLField(blank=True, default="", max_length=1000)),
                ("farol", models.CharField(choices=[("verde", "Verde"), ("amarelo", "Amarelo"), ("vermelho", "Vermelho")], db_index=True, default="verde", max_length=12)),
                ("criado_em", models.DateTimeField(auto_now_add=True)),
                ("atualizado_em", models.DateTimeField(auto_now=True)),
                ("preenchido_por", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="status_reports_diarios_preenchidos", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "db_table": "workspace_status_report_diario",
                "ordering": ["-data_referencia", "lider_nome"],
            },
        ),
        migrations.AddConstraint(
            model_name="statusreportliderequipe",
            constraint=models.UniqueConstraint(fields=("lider_nome", "membro_nome"), name="uq_status_report_lider_membro"),
        ),
        migrations.AddConstraint(
            model_name="statusreportdiario",
            constraint=models.UniqueConstraint(fields=("data_referencia", "lider_nome"), name="uq_status_report_data_lider"),
        ),
        migrations.AddIndex(
            model_name="statusreportdiario",
            index=models.Index(fields=["data_referencia", "farol"], name="idx_status_report_data_farol"),
        ),
        migrations.RunPython(carregar_hierarquia_inicial, remover_hierarquia_inicial),
    ]
