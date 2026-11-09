from django.db import migrations


def set_diretor_default(apps, schema_editor):
    Carteira = apps.get_model('customauth', 'Carteira')
    Carteira.objects.filter(diretor__isnull=True).update(diretor_id=10)


class Migration(migrations.Migration):

    dependencies = [
        ('customauth', '0013_carteira_diretor_historicocarteira_diretor'),
    ]

    operations = [
        migrations.RunPython(set_diretor_default, migrations.RunPython.noop),
    ]
