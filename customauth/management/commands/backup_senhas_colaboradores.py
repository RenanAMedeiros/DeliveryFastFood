import json
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone

from customauth.models import CustomUser

CLIENTE_PROTEGIDO = 'QORE TECNOLOGIA'


class Command(BaseCommand):
    help = (
        'Faz backup do hash de senha atual de todos os colaboradores '
        '(mesmo público-alvo do reset_senha_colaboradores) em um arquivo JSON, '
        'para permitir restauração posterior com restaurar_senha_colaboradores.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--output',
            type=str,
            default=None,
            help='Caminho do arquivo JSON de saída. Padrão: backup_senhas_<timestamp>.json',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Apenas mostra quantos usuários entrariam no backup, sem gerar o arquivo.',
        )

    def handle(self, *args, **options):
        protegidos = Q(cliente__nome__iexact=CLIENTE_PROTEGIDO) | Q(is_staff=True) | Q(is_superuser=True)
        queryset = CustomUser.objects.exclude(protegidos)

        if options['dry_run']:
            total = queryset.count()
            self.stdout.write(self.style.WARNING(f'[DRY-RUN] {total} usuário(s) entrariam no backup:'))
            for user in queryset.order_by('username'):
                self.stdout.write(f'  - {user.username} ({user.email})')
            return

        dados = [
            {'id': user.id, 'username': user.username, 'password': user.password}
            for user in queryset
        ]

        output = options['output']
        if not output:
            ts = timezone.now().strftime('%Y%m%d_%H%M%S')
            output = f'backup_senhas_{ts}.json'

        path = Path(output)
        path.write_text(json.dumps(dados, ensure_ascii=False, indent=2), encoding='utf-8')

        self.stdout.write(self.style.SUCCESS(
            f'Backup de {len(dados)} senha(s) salvo em "{path.resolve()}". '
            'Guarde este arquivo em local seguro — ele contém hashes de senha.'
        ))
