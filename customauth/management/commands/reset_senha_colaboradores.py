from django.core.management.base import BaseCommand
from django.db.models import Q

from customauth.models import CustomUser

SENHA_PADRAO = 'Trocarsenha@@5966'
CLIENTE_PROTEGIDO = 'QORE TECNOLOGIA'


class Command(BaseCommand):
    help = (
        'Reseta a senha de todos os colaboradores para uma senha padrão, '
        f'exceto os vinculados ao cliente "{CLIENTE_PROTEGIDO}" e usuários '
        'staff/superusuário (que também ficam protegidos).'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--password',
            type=str,
            default=SENHA_PADRAO,
            help=f'Senha a ser aplicada (padrão: {SENHA_PADRAO}).',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Apenas lista quantos usuários seriam afetados, sem alterar nada.',
        )

    def handle(self, *args, **options):
        password = options['password']
        dry_run = options['dry_run']

        protegidos = Q(cliente__nome__iexact=CLIENTE_PROTEGIDO) | Q(is_staff=True) | Q(is_superuser=True)
        queryset = CustomUser.objects.exclude(protegidos)

        total = queryset.count()

        if dry_run:
            self.stdout.write(self.style.WARNING(f'[DRY-RUN] {total} usuário(s) teriam a senha resetada:'))
            for user in queryset.order_by('username'):
                self.stdout.write(f'  - {user.username} ({user.email})')
            return

        atualizados = 0
        for user in queryset:
            user.set_password(password)
            user.save(update_fields=['password'])
            atualizados += 1

        self.stdout.write(self.style.SUCCESS(
            f'Senha resetada para {atualizados} colaborador(es). '
            f'Usuários do cliente "{CLIENTE_PROTEGIDO}", staff e superusuários foram preservados.'
        ))
