from django.db import migrations, models


def marcar_carteiras_digitais(apps, schema_editor):
    Carteira = apps.get_model("customauth", "Carteira")
    banco = schema_editor.connection.alias
    ids_digitais = []

    for carteira in Carteira.objects.using(banco).only("pk", "nome").iterator():
        nome = (carteira.nome or "").upper()
        if "- IA" in nome or "-IA" in nome:
            ids_digitais.append(carteira.pk)

    if ids_digitais:
        Carteira.objects.using(banco).filter(pk__in=ids_digitais).update(digital=True)


class Migration(migrations.Migration):
    dependencies = [
        ("customauth", "0019_empresa_dashboard"),
    ]

    operations = [
        migrations.AddField(
            model_name="carteira",
            name="digital",
            field=models.BooleanField(default=False, verbose_name="Digital"),
        ),
        migrations.RunPython(
            marcar_carteiras_digitais,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
