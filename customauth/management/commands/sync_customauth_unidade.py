from django.core.management.base import BaseCommand
from django.db import connections, transaction, IntegrityError

class Command(BaseCommand):
    help = "Sincroniza os dados da tabela customauth_unidade do SQLite para o MySQL (PROD)."

    def handle(self, *args, **kwargs):
        self.stdout.write("Iniciando sincronização de customauth_unidade...")

        sqlite_conn = connections['default']
        mysql_conn = connections['mysql']

        try:
            with sqlite_conn.cursor() as sqlite_cursor, mysql_conn.cursor() as mysql_cursor:
                # Buscar os dados do SQLite
                sqlite_cursor.execute("SELECT * FROM customauth_unidade;")
                rows = sqlite_cursor.fetchall()
                column_names = [desc[0] for desc in sqlite_cursor.description]  # Obter nomes das colunas

                if not rows:
                    self.stdout.write("Nenhum dado encontrado no SQLite. Sincronização finalizada.")
                    return

                # Construir a query de inserção
                placeholders = ", ".join(["%s"] * len(column_names))
                columns = ", ".join(column_names)
                insert_query = f"INSERT INTO customauth_unidade ({columns}) VALUES ({placeholders})"

                try:
                    # Apagar os dados no MySQL antes de sincronizar
                    self.stdout.write("Apagando dados antigos da tabela no MySQL...")
                    with transaction.atomic(using='mysql'):
                        mysql_cursor.execute("SET FOREIGN_KEY_CHECKS = 0;")  # Desativar chaves estrangeiras
                        mysql_cursor.execute("TRUNCATE TABLE customauth_unidade;")  # Apagar e resetar índice
                        mysql_cursor.execute("SET FOREIGN_KEY_CHECKS = 1;")  # Reativar chaves estrangeiras

                    # Inserir os novos dados
                    self.stdout.write(f"Inserindo {len(rows)} registros no MySQL...")
                    with transaction.atomic(using='mysql'):
                        mysql_cursor.executemany(insert_query, rows)

                    self.stdout.write(self.style.SUCCESS(f"{len(rows)} registros sincronizados com sucesso!"))

                except IntegrityError as e:
                    self.stderr.write(self.style.ERROR(f"Erro de chave primária ao inserir os dados: {e}"))

        except Exception as e:
            self.stderr.write(self.style.ERROR(f"Erro na sincronização: {e}"))

        finally:
            sqlite_conn.close()
            mysql_conn.close()

