from django.db import migrations, models
from decimal import Decimal


class Migration(migrations.Migration):

    dependencies = [
        ('workspace', '0011_capacity_competencia'),
    ]

    operations = [
        migrations.AlterField(
            model_name='capacity',
            name='budget',
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal('0.00'),
                max_digits=14,
                verbose_name='Budget aprovado pela diretoria',
            ),
        ),
        migrations.AlterField(
            model_name='capacity',
            name='budget_atual',
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal('0.00'),
                max_digits=14,
                verbose_name='Budget atual',
            ),
        ),
    ]
