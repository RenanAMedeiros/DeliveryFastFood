import django
from django.core.management.base import BaseCommand
from django.db import connections, transaction
from django.apps import apps
from customauth.models import CustomUser, Empresa, Unidade

class Command(BaseCommand):
    help = "Migra os dados da tabela customauth_customuser_unidade do SQLite para o MySQL"

    def handle(self, *args, **kwargs):
        # Conectar aos bancos
        sqlite_conn = connections['default']  # SQLite
        mysql_conn = connections['mysql']  # MySQL

        self.stdout.write(self.style.SUCCESS("Iniciando a migração da tabela customauth_customuser_unidade..."))

        # Pegando o modelo correto
        CustomUserUnidade = apps.get_model("customauth", "CustomUserUnidade")
        CustomUser = apps.get_model("customauth", "CustomUser")
        Unidade = apps.get_model("customauth", "Unidade")

        # Criar dicionários para mapear IDs antigos para novos
        id_mapping_users = {user.id: user.pk for user in CustomUser.objects.using('mysql').all()}
        id_mapping_unidades = {unidade.id: unidade.pk for unidade in Unidade.objects.using('mysql').all()}

        # Truncar a tabela no MySQL para evitar duplicação
        with mysql_conn.cursor() as cursor:
            cursor.execute("SET FOREIGN_KEY_CHECKS = 0;")
            cursor.execute("TRUNCATE TABLE customauth_customuser_unidade;")
            cursor.execute("SET FOREIGN_KEY_CHECKS = 1;")

        # Buscar os dados no SQLite
        unidades_sqlite = CustomUserUnidade.objects.using('default').all()

        for unidade in unidades_sqlite:
            try:
                old_user_id = unidade.user_id
                old_unidade_id = unidade.unidade_id

                # Mapear IDs antigos para os novos
                new_user_id = id_mapping_users.get(old_user_id)
                new_unidade_id = id_mapping_unidades.get(old_unidade_id)

                if not new_user_id or not new_unidade_id:
                    self.stderr.write(self.style.WARNING(f"Pulando unidade {unidade.id}: usuário ou unidade não encontrados no MySQL"))
                    continue

                unidade.pk = None  # Resetar chave primária para evitar conflitos
                unidade.user_id = new_user_id  # Atualizar FK de usuário
                unidade.unidade_id = new_unidade_id  # Atualizar FK de unidade
                unidade.save(using='mysql')  # Salvar no MySQL
            except Exception as e:
                self.stderr.write(self.style.ERROR(f"Erro ao migrar unidade {unidade.id}: {e}"))

        self.stdout.write(self.style.SUCCESS("Migração da tabela customauth_customuser_unidade concluída com sucesso! 🎉"))
