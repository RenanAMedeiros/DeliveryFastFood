from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("workspace", "0041_status_report_lideres_diario"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(model_name="statusreportdiario", name="tema_dia", field=models.CharField(blank=True, default="", max_length=40)),
        migrations.AddField(model_name="statusreportdiario", name="contexto_tema", field=models.TextField(blank=True, default="")),
        migrations.AddField(model_name="statusreportdiario", name="itens_selecionados_json", field=models.TextField(blank=True, default="[]")),
        migrations.AddField(model_name="statusreportdiario", name="snapshot_metricas_json", field=models.TextField(blank=True, default="{}")),
        migrations.AddField(model_name="statusreportdiario", name="entregue_em", field=models.DateTimeField(blank=True, null=True)),
        migrations.CreateModel(
            name="StatusReportProximoPasso",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("data_reuniao", models.DateField(db_index=True)),
                ("lider_nome", models.CharField(db_index=True, max_length=255)),
                ("origem_tipo", models.CharField(blank=True, default="prework", max_length=30)),
                ("origem_referencia", models.CharField(blank=True, default="", max_length=255)),
                ("acao", models.TextField()),
                ("responsavel", models.CharField(max_length=255)),
                ("prazo", models.DateField(db_index=True)),
                ("medida_sucesso", models.TextField()),
                ("status", models.CharField(choices=[("pendente", "Pendente"), ("em_andamento", "Em andamento"), ("concluido", "Concluído"), ("cancelado", "Cancelado")], db_index=True, default="pendente", max_length=20)),
                ("concluido_em", models.DateTimeField(blank=True, null=True)),
                ("criado_em", models.DateTimeField(auto_now_add=True)),
                ("atualizado_em", models.DateTimeField(auto_now=True)),
                ("criado_por", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="status_report_proximos_passos_criados", to=settings.AUTH_USER_MODEL)),
            ],
            options={"db_table": "workspace_status_report_proximo_passo", "ordering": ["status", "prazo", "lider_nome"]},
        ),
        migrations.AddIndex(model_name="statusreportproximopasso", index=models.Index(fields=["data_reuniao", "status"], name="idx_sr_acao_data_status")),
        migrations.AddIndex(model_name="statusreportproximopasso", index=models.Index(fields=["prazo", "status"], name="idx_sr_acao_prazo_status")),
    ]
