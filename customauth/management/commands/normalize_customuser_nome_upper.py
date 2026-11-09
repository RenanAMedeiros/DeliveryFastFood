from django.core.management.base import BaseCommand
from django.db.models.functions import Upper

from customauth.models import CustomUser


class Command(BaseCommand):
    help = "Padroniza o campo nome de CustomUser para maiusculas."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Mostra quantos usuarios seriam atualizados sem salvar no banco.",
        )

    def handle(self, *args, **options):
        queryset = CustomUser.objects.exclude(nome__isnull=True).exclude(nome="")
        total = queryset.count()

        if options["dry_run"]:
            self.stdout.write(
                self.style.WARNING(
                    f"Dry-run: {total} usuario(s) seriam normalizados para maiusculas."
                )
            )
            return

        updated = queryset.update(nome=Upper("nome"))
        self.stdout.write(
            self.style.SUCCESS(
                f"Padronizacao concluida: {updated} de {total} usuario(s) atualizados."
            )
        )
