from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("workspace", "0048_cslog_prazos_e_apontamentos"),
    ]

    operations = [
        migrations.AddField(
            model_name="projeto",
            name="cslog_ticket_aberto_em",
            field=models.DateField(
                blank=True,
                null=True,
                help_text=(
                    "Data em que a QORE abriu/acionou a demanda na CSLOG. "
                    "Permite medir o tempo entre a abertura do projeto e o acionamento do fornecedor."
                ),
            ),
        ),
        migrations.AddField(
            model_name="projeto",
            name="cslog_escopo_fechado_em",
            field=models.DateField(
                blank=True,
                null=True,
                help_text="Data em que a CSLOG concluiu a análise e fechou o escopo recebido da QORE.",
            ),
        ),
        migrations.AlterField(
            model_name="projeto",
            name="cslog_status_fornecedor",
            field=models.CharField(
                choices=[
                    ("ticket_aberto", "Ticket aberto"),
                    ("escopo_em_analise", "Escopo em análise"),
                    ("escopo_fechado", "Escopo fechado"),
                    ("aguardando_orcamento", "Aguardando orçamento"),
                    ("orcamento_recebido", "Orçamento recebido"),
                    ("aguardando_aprovacao", "Aguardando aprovação"),
                    ("aprovado", "Aprovado"),
                    ("em_execucao", "Em execução"),
                    ("entregue", "Entregue"),
                    ("homologando", "Homologando"),
                    ("concluido", "Concluído"),
                    ("cancelado", "Cancelado"),
                ],
                db_index=True,
                default="aguardando_orcamento",
                help_text="Status da dependência externa CSLOG. Usado somente quando há Referência CSLOG.",
                max_length=30,
            ),
        ),
    ]
