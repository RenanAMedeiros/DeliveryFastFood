from django.db import migrations, models


def preencher_baseline_cslog(apps, schema_editor):
    Projeto = apps.get_model("workspace", "Projeto")
    for projeto in Projeto.objects.exclude(cslog="").iterator():
        alterados = []
        if projeto.cslog_baseline_data_homologacao is None and projeto.data_homologacao_prevista:
            projeto.cslog_baseline_data_homologacao = projeto.data_homologacao_prevista
            alterados.append("cslog_baseline_data_homologacao")
        if projeto.cslog_baseline_data_go_live is None and projeto.data_go_live_prevista:
            projeto.cslog_baseline_data_go_live = projeto.data_go_live_prevista
            alterados.append("cslog_baseline_data_go_live")
        if projeto.cslog_baseline_data_fim is None and projeto.data_fim_prevista:
            projeto.cslog_baseline_data_fim = projeto.data_fim_prevista
            alterados.append("cslog_baseline_data_fim")
        if alterados:
            projeto.save(update_fields=alterados)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("workspace", "0050_tarefa_envio_cslog_no_cronograma"),
    ]

    operations = [
        migrations.AddField(
            model_name="projeto",
            name="cslog_folga_qore_dias_uteis",
            field=models.PositiveSmallIntegerField(
                choices=[(1, "1 dia útil"), (2, "2 dias úteis")],
                default=2,
                help_text=(
                    "Folga operacional QORE após a entrega prevista da CSLOG para validação, "
                    "homologação final e Go Live."
                ),
            ),
        ),
        migrations.AddField(
            model_name="projeto",
            name="cslog_baseline_data_homologacao",
            field=models.DateField(
                blank=True,
                null=True,
                help_text="Snapshot da homologação QORE antes do primeiro replanejamento automático pela CSLOG.",
            ),
        ),
        migrations.AddField(
            model_name="projeto",
            name="cslog_baseline_data_go_live",
            field=models.DateField(
                blank=True,
                null=True,
                help_text="Snapshot do Go Live QORE antes do primeiro replanejamento automático pela CSLOG.",
            ),
        ),
        migrations.AddField(
            model_name="projeto",
            name="cslog_baseline_data_fim",
            field=models.DateField(
                blank=True,
                null=True,
                help_text="Snapshot da conclusão prevista QORE antes do primeiro replanejamento automático pela CSLOG.",
            ),
        ),
        migrations.AlterField(
            model_name="projeto",
            name="cslog_data_entrega_prevista",
            field=models.DateField(
                blank=True,
                db_index=True,
                null=True,
                help_text=(
                    "Data de entrega da CSLOG calculada automaticamente pelo prazo em dias úteis. "
                    "Antes do início usa a data do orçamento como base; após o início usa a data real de início."
                ),
            ),
        ),
        migrations.RunPython(preencher_baseline_cslog, noop_reverse),
    ]
