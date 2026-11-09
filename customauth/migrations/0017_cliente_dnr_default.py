from django.db import migrations


def criar_cliente_dnr(apps, schema_editor):
    Cliente = apps.get_model('customauth', 'Cliente')
    Empresa = apps.get_model('customauth', 'Empresa')

    cliente_dnr, _ = Cliente.objects.get_or_create(
        slug='dnr',
        defaults={'nome': 'DNR'},
    )

    Empresa.objects.filter(cliente__isnull=True).update(cliente=cliente_dnr)


def reverter(apps, schema_editor):
    Cliente = apps.get_model('customauth', 'Cliente')
    Empresa = apps.get_model('customauth', 'Empresa')

    Empresa.objects.filter(cliente__slug='dnr').update(cliente=None)
    Cliente.objects.filter(slug='dnr').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('customauth', '0016_cliente'),
    ]

    operations = [
        migrations.RunPython(criar_cliente_dnr, reverter),
    ]
