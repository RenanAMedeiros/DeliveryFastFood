import datetime

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('workspace', '0010_capacity'),
    ]

    operations = [
        migrations.AddField(
            model_name='capacity',
            name='competencia',
            field=models.DateField(
                default=datetime.date(2026, 7, 1),
                help_text='A competência é sempre armazenada no primeiro dia do mês.',
                verbose_name='Mês/Ano do capacity',
            ),
            preserve_default=False,
        ),
        migrations.AlterField(
            model_name='capacity',
            name='carteira',
            field=models.ForeignKey(
                on_delete=models.PROTECT,
                related_name='capacities',
                to='customauth.carteira',
                verbose_name='Carteira',
            ),
        ),
        migrations.AlterModelOptions(
            name='capacity',
            options={
                'ordering': ('-competencia', 'carteira__nome'),
                'verbose_name': 'Capacity',
                'verbose_name_plural': 'Capacity',
            },
        ),
        migrations.AddConstraint(
            model_name='capacity',
            constraint=models.UniqueConstraint(
                fields=('carteira', 'competencia'),
                name='uniq_capacity_carteira_competencia',
            ),
        ),
    ]
