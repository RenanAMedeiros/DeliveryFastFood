from django.db import migrations, models


def migrar_papeis_existentes(apps, schema_editor):
    ProjetoMembro = apps.get_model("workspace", "ProjetoMembro")

    for vinculo in ProjetoMembro.objects.select_related("projeto").iterator():
        e_stakeholder = vinculo.papel == "stakeholder"
        e_responsavel = (
            vinculo.ativo
            and not e_stakeholder
            and vinculo.pessoa_id != vinculo.projeto.owner_id
        )
        ProjetoMembro.objects.filter(pk=vinculo.pk).update(
            e_stakeholder=e_stakeholder,
            e_responsavel=e_responsavel,
        )


class Migration(migrations.Migration):

    dependencies = [
        ("workspace", "0030_reativar_status_automatico_homologacao"),
    ]

    operations = [
        migrations.AddField(
            model_name="projetomembro",
            name="e_responsavel",
            field=models.BooleanField(
                db_index=True,
                default=False,
                help_text="A pessoa atua como responsável/líder neste projeto.",
            ),
        ),
        migrations.AddField(
            model_name="projetomembro",
            name="e_stakeholder",
            field=models.BooleanField(
                db_index=True,
                default=False,
                help_text="A pessoa atua como Stakeholder neste projeto.",
            ),
        ),
        migrations.RunPython(
            migrar_papeis_existentes,
            migrations.RunPython.noop,
        ),
    ]
