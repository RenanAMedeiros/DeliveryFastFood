import shutil
from pathlib import Path

from django.conf import settings
from django.db import migrations

# (nome, caminho relativo em static/, ordem)
LOGOS_SEED = [
    ('DNR', 'imagens/dnr3.png', 10),
    ('Nunes', 'imagens/nunes.png', 20),
    ('PowerDNA', 'imagens/PowerDNA.png', 30),
    ('Banco do Brasil', 'imagens/logo-bb-2.png', 40),
    ('BM', 'imagens/logo-BM.png', 50),
]

# Diretórios de static onde os arquivos podem estar (raiz do projeto e app workspace).
STATIC_SOURCES = [
    settings.BASE_DIR / 'static',
    settings.BASE_DIR / 'workspace' / 'static',
]


def seed_logos(apps, schema_editor):
    LogoParceiro = apps.get_model('customauth', 'LogoParceiro')

    destino_dir = Path(settings.MEDIA_ROOT) / 'logos_parceiros'
    destino_dir.mkdir(parents=True, exist_ok=True)

    for nome, caminho_relativo, ordem in LOGOS_SEED:
        if LogoParceiro.objects.filter(nome=nome).exists():
            continue

        origem = None
        for base in STATIC_SOURCES:
            candidato = base / caminho_relativo
            if candidato.exists():
                origem = candidato
                break

        if origem is None:
            # Arquivo não encontrado: pula em vez de quebrar a migração.
            continue

        destino = destino_dir / origem.name
        if not destino.exists():
            shutil.copyfile(origem, destino)

        LogoParceiro.objects.create(
            nome=nome,
            imagem=f'logos_parceiros/{origem.name}',
            ordem=ordem,
        )


def remove_logos(apps, schema_editor):
    LogoParceiro = apps.get_model('customauth', 'LogoParceiro')
    LogoParceiro.objects.filter(nome__in=[nome for nome, _, _ in LOGOS_SEED]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('customauth', '0022_logoparceiro_customuser_acesso_solicitacoes_and_more'),
    ]

    operations = [
        migrations.RunPython(seed_logos, remove_logos),
    ]
