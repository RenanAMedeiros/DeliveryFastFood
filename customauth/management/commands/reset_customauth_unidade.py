from django.core.management.base import BaseCommand
from django.db import connections

class Command(BaseCommand):
    help = "Apaga todos os dados da tabela customauth_unidade e reinicia o índice no MySQL."

    def handle(self, *args, **kwargs):
        self.stdout.write("Resetando a tabela customauth_unidade...")

        try:
            with connections['mysql'].cursor() as cursor:
                cursor.execute("SET FOREIGN_KEY_CHECKS = 0;")  # Desativar chaves estrangeiras
                cursor.execute("TRUNCATE TABLE customauth_unidade;")  # Apagar e resetar índice
                cursor.execute("SET FOREIGN_KEY_CHECKS = 1;")  # Reativar chaves estrangeiras

            self.stdout.write(self.style.SUCCESS("Tabela customauth_unidade resetada com sucesso!"))

        except Exception as e:
            self.stderr.write(self.style.ERROR(f"Erro ao resetar a tabela: {e}"))
