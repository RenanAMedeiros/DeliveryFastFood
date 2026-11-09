from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def preencher_nomes_snapshot(apps, schema_editor):
    Capacity = apps.get_model('workspace', 'Capacity')
    for capacity in Capacity.objects.select_related(
        'carteira',
        'supervisor_operacional',
    ).iterator():
        usuario = capacity.supervisor_operacional
        nome_completo = f'{usuario.first_name} {usuario.last_name}'.strip()
        capacity.carteira_nome = capacity.carteira.nome
        capacity.responsavel_nome = (
            usuario.nome
            or nome_completo
            or usuario.username
        )
        capacity.save(update_fields=('carteira_nome', 'responsavel_nome'))


class Migration(migrations.Migration):

    dependencies = [
        ('workspace', '0012_alter_capacity_budget_labels'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='capacity',
            name='carteira_nome',
            field=models.CharField(default='', max_length=150, verbose_name='Carteira'),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='capacity',
            name='responsavel_nome',
            field=models.CharField(default='', max_length=150, verbose_name='Responsável'),
            preserve_default=False,
        ),
        migrations.RunPython(preencher_nomes_snapshot, migrations.RunPython.noop),
        migrations.RemoveConstraint(
            model_name='capacity',
            name='uniq_capacity_carteira_competencia',
        ),
        migrations.AlterField(
            model_name='capacity',
            name='carteira',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='capacities',
                to='customauth.carteira',
                verbose_name='Vínculo da carteira',
            ),
        ),
        migrations.AlterField(
            model_name='capacity',
            name='supervisor_operacional',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='capacities_como_supervisor_operacional',
                to=settings.AUTH_USER_MODEL,
                verbose_name='Vínculo do responsável',
            ),
        ),
        migrations.AlterModelOptions(
            name='capacity',
            options={
                'ordering': ('-competencia', 'carteira_nome'),
                'verbose_name': 'Capacity',
                'verbose_name_plural': 'Capacity',
            },
        ),
        migrations.AddConstraint(
            model_name='capacity',
            constraint=models.UniqueConstraint(
                fields=('carteira_nome', 'competencia'),
                name='uniq_capacity_nome_carteira_competencia',
            ),
        ),
    ]
