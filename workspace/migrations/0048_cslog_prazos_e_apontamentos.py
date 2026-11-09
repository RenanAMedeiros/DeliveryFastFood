from django.db import migrations, models
import django.core.validators
from decimal import Decimal


class Migration(migrations.Migration):

    dependencies = [
        ("workspace", "0047_projetotifluxlink_emails_status"),
    ]

    operations = [
        migrations.AddField(
            model_name="projeto",
            name="cslog_status_fornecedor",
            field=models.CharField(
                choices=[
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
        migrations.AddField(
            model_name="projeto",
            name="cslog_orcamento_recebido_em",
            field=models.DateField(blank=True, help_text="Data em que o orçamento/prazo da CSLOG foi recebido.", null=True),
        ),
        migrations.AddField(
            model_name="projeto",
            name="cslog_orcamento_valor",
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text="Valor do orçamento informado pela CSLOG.",
                max_digits=14,
                null=True,
                validators=[django.core.validators.MinValueValidator(Decimal("0.00"))],
            ),
        ),
        migrations.AddField(
            model_name="projeto",
            name="cslog_horas_tecnicas",
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text="Quantidade de horas técnicas (HTs) informada pela CSLOG.",
                max_digits=10,
                null=True,
                validators=[django.core.validators.MinValueValidator(Decimal("0.00"))],
            ),
        ),
        migrations.AddField(
            model_name="projeto",
            name="cslog_prazo_dias_uteis",
            field=models.PositiveIntegerField(blank=True, help_text="Prazo em dias úteis informado pela CSLOG.", null=True),
        ),
        migrations.AddField(
            model_name="projeto",
            name="cslog_data_inicio",
            field=models.DateField(blank=True, help_text="Data efetiva/confirmada de início da execução pela CSLOG.", null=True),
        ),
        migrations.AddField(
            model_name="projeto",
            name="cslog_data_entrega_prevista",
            field=models.DateField(
                blank=True,
                db_index=True,
                help_text="Data final/Go Live confirmada pela CSLOG. Prevalece como referência vigente quando informada.",
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="projeto",
            name="cslog_data_entrega_real",
            field=models.DateField(blank=True, help_text="Data em que a CSLOG efetivamente entregou o trabalho.", null=True),
        ),
        migrations.AddField(
            model_name="projeto",
            name="data_go_live_cliente",
            field=models.DateField(
                blank=True,
                help_text="Data de Go Live efetivamente comunicada ao cliente. Se preenchida, prevalece sobre a data CSLOG.",
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="projeto",
            name="horas_planejadas",
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text="Horas internas QORE planejadas para o projeto. Comparadas com os apontamentos reais do TiFlux.",
                max_digits=10,
                null=True,
                validators=[django.core.validators.MinValueValidator(Decimal("0.00"))],
            ),
        ),
        migrations.AddField(
            model_name="projetotifluxlink",
            name="apontamento_segundos_tiflux",
            field=models.BigIntegerField(default=0, help_text="Tempo total apontado no ticket, em segundos, conforme ticket_appointments_latest."),
        ),
        migrations.AddField(
            model_name="projetotifluxlink",
            name="apontamento_quantidade_tiflux",
            field=models.PositiveIntegerField(default=0, help_text="Quantidade de registros de apontamento encontrados no ticket."),
        ),
        migrations.AddField(
            model_name="projetotifluxlink",
            name="apontamento_ultimo_em_tiflux",
            field=models.DateTimeField(blank=True, help_text="Data/hora do último apontamento encontrado para o ticket.", null=True),
        ),
        migrations.AddField(
            model_name="projetotifluxlink",
            name="apontamento_por_usuario_tiflux",
            field=models.JSONField(blank=True, default=dict, help_text="Tempo apontado por analista, em segundos, para análise gerencial do projeto."),
        ),
    ]
