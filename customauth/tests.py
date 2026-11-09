from importlib import import_module
from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import patch

from django.apps import apps
from django.core.exceptions import ValidationError
from django.db import connection
from django.test import SimpleTestCase, TestCase
from django.utils import timezone

from . import views
from .models import Carteira, Empresa


class EmpresaDashboardTest(SimpleTestCase):
    def test_aceita_link_e_categoria_de_dashboard_validos(self):
        empresa = Empresa(
            nome='Empresa teste',
            razao_social='Empresa Teste Ltda.',
            cnpj='11222333000181',
            link_bi='https://app.powerbi.com/view?r=exemplo',
            categoria_dashboard=Empresa.CategoriaDashboard.GERENCIAL,
        )

        empresa.full_clean(exclude=['unidades', 'cliente'])

    def test_rejeita_link_de_bi_invalido(self):
        empresa = Empresa(
            nome='Empresa teste',
            razao_social='Empresa Teste Ltda.',
            cnpj='11222333000181',
            link_bi='link-invalido',
            categoria_dashboard=Empresa.CategoriaDashboard.OPERACIONAL,
        )

        with self.assertRaises(ValidationError) as context:
            empresa.full_clean(exclude=['unidades', 'cliente'])

        self.assertIn('link_bi', context.exception.message_dict)

    def test_rejeita_categoria_de_dashboard_invalida(self):
        empresa = Empresa(
            nome='Empresa teste',
            razao_social='Empresa Teste Ltda.',
            cnpj='11222333000181',
            categoria_dashboard='categoria-invalida',
        )

        with self.assertRaises(ValidationError) as context:
            empresa.full_clean(exclude=['unidades', 'cliente'])

        self.assertIn('categoria_dashboard', context.exception.message_dict)


class CarteiraDigitalMigrationTest(TestCase):
    def test_marca_como_digitais_nomes_com_hifen_antes_de_ia(self):
        Carteira.objects.bulk_create([
            Carteira(nome='CARTEIRA ALFA - IA'),
            Carteira(nome='CARTEIRA BETA-IA'),
            Carteira(nome='Carteira gama - ia'),
            Carteira(nome='CARTEIRA CONVENCIONAL'),
            Carteira(nome='CARTEIRA DIGITAL MANUAL', digital=True),
        ])

        migration = import_module('customauth.migrations.0020_carteira_digital')
        migration.marcar_carteiras_digitais(
            apps,
            SimpleNamespace(connection=connection),
        )

        digitais_por_nome = dict(
            Carteira.objects.values_list('nome', 'digital')
        )
        self.assertTrue(digitais_por_nome['CARTEIRA ALFA - IA'])
        self.assertTrue(digitais_por_nome['CARTEIRA BETA-IA'])
        self.assertTrue(digitais_por_nome['Carteira gama - ia'])
        self.assertFalse(digitais_por_nome['CARTEIRA CONVENCIONAL'])
        self.assertTrue(digitais_por_nome['CARTEIRA DIGITAL MANUAL'])


class LimiteSessoesAdminTest(SimpleTestCase):
    def test_login_admin_derruba_apenas_sessao_mais_antiga_ao_passar_de_tres(self):
        agora = timezone.now()
        sessoes = [
            (
                SimpleNamespace(
                    session_key='sessao-1',
                    expire_date=agora,
                    delete=lambda: apagadas.append('sessao-1'),
                ),
                {views.SESSAO_INICIO_LOGIN: (agora - timedelta(minutes=30)).isoformat()},
            ),
            (
                SimpleNamespace(
                    session_key='sessao-2',
                    expire_date=agora,
                    delete=lambda: apagadas.append('sessao-2'),
                ),
                {views.SESSAO_INICIO_LOGIN: (agora - timedelta(minutes=20)).isoformat()},
            ),
            (
                SimpleNamespace(
                    session_key='sessao-3',
                    expire_date=agora,
                    delete=lambda: apagadas.append('sessao-3'),
                ),
                {views.SESSAO_INICIO_LOGIN: (agora - timedelta(minutes=10)).isoformat()},
            ),
        ]
        apagadas = []

        with patch.object(views, '_sessoes_ativas_do_usuario', return_value=sessoes):
            views._encerrar_sessoes_excedentes(
                SimpleNamespace(id=1),
                'sessao-nova-ainda-nao-salva',
                views.MAX_SESSOES_ADMIN,
            )

        self.assertEqual(apagadas, ['sessao-1'])
