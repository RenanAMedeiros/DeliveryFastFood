from django.db import migrations

# (nome, caminho relativo em static/)
CAMINHOS_ESTATICOS = {
    'DNR': 'imagens/dnr3.png',
    'Nunes': 'imagens/nunes.png',
    'PowerDNA': 'imagens/PowerDNA.png',
    'Banco do Brasil': 'imagens/logo-bb-2.png',
    'BM': 'imagens/logo-BM.png',
}


def set_caminhos_estaticos(apps, schema_editor):
    LogoParceiro = apps.get_model('customauth', 'LogoParceiro')

    for nome, caminho in CAMINHOS_ESTATICOS.items():
        LogoParceiro.objects.filter(nome=nome).update(caminho_estatico=caminho)


def limpar_caminhos_estaticos(apps, schema_editor):
    LogoParceiro = apps.get_model('customauth', 'LogoParceiro')
    LogoParceiro.objects.filter(nome__in=CAMINHOS_ESTATICOS.keys()).update(
        caminho_estatico=''
    )


class Migration(migrations.Migration):

    dependencies = [
        ('customauth', '0024_logoparceiro_caminho_estatico_and_more'),
    ]

    operations = [
        migrations.RunPython(set_caminhos_estaticos, limpar_caminhos_estaticos),
    ]
