from django.core.management.base import BaseCommand
from customauth.models import CustomUser  # Importe seu modelo de usuário personalizado

class Command(BaseCommand):
    help = 'Create a new user'


    def add_arguments(self, parser):
        parser.add_argument('username', type=str, help='Username of the user')
        parser.add_argument('email', type=str, help='Email of the user')
        parser.add_argument('password', type=str, help='Password of the user')
        parser.add_argument('nome', type=str, help='Nome of the user')  # Adiciona o campo nome


    def handle(self, *args, **kwargs):
        username = kwargs['username']
        email = kwargs['email']
        password = kwargs['password']
        nome = kwargs['nome']  # Recebe o campo nome

        if CustomUser.objects.filter(username=username).exists():
            self.stdout.write(self.style.ERROR('Username already exists'))
        else:
            CustomUser.objects.create_user(username=username, email=email, password=password, nome=nome)  # Define o campo nome
            self.stdout.write(self.style.SUCCESS(f'User {username} created successfully'))