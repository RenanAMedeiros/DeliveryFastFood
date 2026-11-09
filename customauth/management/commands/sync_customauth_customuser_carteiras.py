from django.core.management.base import BaseCommand
from django.db import connections, transaction, IntegrityError

class Command(BaseCommand):
    help = "Sincroniza os dados da tabela customauth_customuser_carteiras do SQLite para o MySQL (PROD), ignorando usuários inexistentes."

    def handle(self, *args, **kwargs):
        self.stdout.write("Iniciando sincronização de customauth_customuser_carteiras...")

        sqlite_conn = connections['default']
        mysql_conn = connections['mysql']

        try:
            with sqlite_conn.cursor() as sqlite_cursor, mysql_conn.cursor() as mysql_cursor:
                # Buscar todos os customuser_id válidos no MySQL
                mysql_cursor.execute("SELECT id FROM customauth_customuser;")
                valid_customuser_ids = {row[0] for row in mysql_cursor.fetchall()}  # Conjunto de IDs válidos

                # Buscar os dados do SQLite
                sqlite_cursor.execute("SELECT * FROM customauth_customuser_carteiras;")
                rows = sqlite_cursor.fetchall()
                column_names = [desc[0] for desc in sqlite_cursor.description]

                if not rows:
                    self.stdout.write("Nenhum dado encontrado no SQLite. Sincronização finalizada.")
                    return

                # Filtrar apenas os registros com customuser_id válidos
                valid_rows = []
                skipped_count = 0

                for row in rows:
                    customuser_id = row[column_names.index("customuser_id")]
                    if customuser_id in valid_customuser_ids:
                        valid_rows.append(row)
                    else:
                        skipped_count += 1

                if skipped_count > 0:
                    self.stdout.write(self.style.WARNING(f"{skipped_count} registros ignorados devido a usuários inexistentes."))

                if not valid_rows:
                    self.stdout.write("Nenhum registro válido encontrado para sincronizar.")
                    return

                # Construir a query de inserção
                placeholders = ", ".join(["%s"] * len(column_names))
                columns = ", ".join(column_names)
                insert_query = f"INSERT INTO customauth_customuser_carteiras ({columns}) VALUES ({placeholders})"

                try:
                    # Apagar os dados no MySQL antes de sincronizar
                    self.stdout.write("Apagando dados antigos da tabela no MySQL...")
                    with transaction.atomic(using='mysql'):
                        mysql_cursor.execute("SET FOREIGN_KEY_CHECKS = 0;")
                        mysql_cursor.execute("TRUNCATE TABLE customauth_customuser_carteiras;")
                        mysql_cursor.execute("SET FOREIGN_KEY_CHECKS = 1;")

                    # Inserir apenas os registros válidos
                    self.stdout.write(f"Inserindo {len(valid_rows)} registros válidos no MySQL...")
                    with transaction.atomic(using='mysql'):
                        mysql_cursor.executemany(insert_query, valid_rows)

                    self.stdout.write(self.style.SUCCESS(f"{len(valid_rows)} registros sincronizados com sucesso!"))

                except IntegrityError as e:
                    self.stderr.write(self.style.ERROR(f"Erro ao inserir os dados: {e}"))

        except Exception as e:
            self.stderr.write(self.style.ERROR(f"Erro na sincronização: {e}"))

        finally:
            sqlite_conn.close()
            mysql_conn.close()
