from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("workspace", "0037_cronogramas_5_tipos_3_metodologias"),
    ]

    operations = [
        migrations.AlterField(
            model_name="projetocronogramamodelo",
            name="tipo_projeto_codigo",
            field=models.SlugField(
                blank=True,
                db_index=True,
                default="",
                help_text=(
                    "Agrupa as variações Ágil, Híbrida e Waterfall "
                    "do mesmo tipo de projeto."
                ),
                max_length=80,
            ),
        ),
        migrations.AlterField(
            model_name="projetocronogramamodelo",
            name="esperada",
            field=models.BooleanField(
                db_index=True,
                default=False,
                help_text=(
                    "Indica a metodologia recomendada para o tipo, "
                    "sem impedir outras escolhas."
                ),
            ),
        ),
    ]
