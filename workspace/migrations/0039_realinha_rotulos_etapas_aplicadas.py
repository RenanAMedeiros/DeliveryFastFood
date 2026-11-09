from django.db import migrations


def realinhar_rotulos(apps, schema_editor):
    Projeto = apps.get_model("workspace", "Projeto")
    ProjetoEtapa = apps.get_model("workspace", "ProjetoEtapa")
    EtapaModelo = apps.get_model("workspace", "ProjetoCronogramaEtapaModelo")

    projetos = (
        Projeto.objects
        .exclude(cronograma_modelo_id__isnull=True)
        .values_list("id", "cronograma_modelo_id")
    )

    for projeto_id, modelo_id in projetos.iterator():
        modelos_por_ordem = {
            etapa.ordem: etapa
            for etapa in EtapaModelo.objects.filter(modelo_id=modelo_id).order_by("ordem", "id")
        }
        if not modelos_por_ordem:
            continue

        for etapa in ProjetoEtapa.objects.filter(projeto_id=projeto_id, ativo=True).iterator():
            origem = modelos_por_ordem.get(etapa.ordem)
            if not origem:
                continue
            alterados = []
            for campo in ("nome", "descricao", "tipo"):
                valor = getattr(origem, campo)
                if getattr(etapa, campo) != valor:
                    setattr(etapa, campo, valor)
                    alterados.append(campo)
            if alterados:
                etapa.save(update_fields=alterados)


class Migration(migrations.Migration):
    dependencies = [
        ("workspace", "0038_alinhar_estado_cronograma_modelo"),
    ]

    operations = [
        migrations.RunPython(realinhar_rotulos, migrations.RunPython.noop),
    ]
