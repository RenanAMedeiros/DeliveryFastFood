import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from customauth.models import CustomUser


class Command(BaseCommand):
    help = (
        'Restaura o hash de senha original dos colaboradores a partir de um '
        'arquivo JSON gerado por backup_senhas_colaboradores.'
    )

    def add_arguments(self, parser):
        parser.add_argument('arquivo', type=str, help='Caminho do arquivo JSON de backup.')
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Apenas mostra quantos usuários seriam restaurados, sem alterar nada.',
        )

    def handle(self, *args, **options):
        path = Path(options['arquivo'])
        if not path.exists():
            raise CommandError(f'Arquivo não encontrado: {path}')

        dados = json.loads(path.read_text(encoding='utf-8'))

        if options['dry_run']:
            self.stdout.write(self.style.WARNING(
                f'[DRY-RUN] {len(dados)} usuário(s) teriam a senha restaurada a partir de "{path}".'
            ))
            return

        restaurados = 0
        nao_encontrados = []
        for item in dados:
            atualizados = CustomUser.objects.filter(id=item['id'], username=item['username']).update(
                password=item['password']
            )
            if atualizados:
                restaurados += 1
            else:
                nao_encontrados.append(item['username'])

        self.stdout.write(self.style.SUCCESS(f'Senha restaurada para {restaurados} usuário(s).'))
        if nao_encontrados:
            self.stdout.write(self.style.WARNING(
                f'{len(nao_encontrados)} usuário(s) do backup não foram encontrados (podem ter sido removidos): '
                + ', '.join(nao_encontrados)
            ))
