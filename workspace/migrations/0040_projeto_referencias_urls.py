from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("workspace", "0039_realinha_rotulos_etapas_aplicadas"),
    ]

    operations = [
        migrations.AddField(
            model_name="projeto",
            name="referencia_url",
            field=models.URLField(blank=True, default="", max_length=1000),
        ),
        migrations.AddField(
            model_name="projeto",
            name="cslog_url",
            field=models.URLField(blank=True, default="", max_length=1000),
        ),
    ]
