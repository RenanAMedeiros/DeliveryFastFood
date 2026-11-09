from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from .models import Notificacao
from .services import criar_notificacao


class NotificacaoTests(TestCase):
    databases = {'default'}

    def setUp(self):
        self.usuario = get_user_model().objects.create_user(
            username='usuario_notificacao',
            password='SenhaForte123!',
            nome='Usuário Notificação',
        )
        self.client.force_login(self.usuario)

    def test_criar_listar_e_marcar_como_lida(self):
        notificacao = criar_notificacao(
            usuario=self.usuario,
            titulo='Capacity atualizado',
            mensagem='O Budget Atual foi atualizado.',
            tipo=Notificacao.TIPO_CAPACITY,
            link='/',
        )

        response = self.client.get(reverse('obter_notificacoes'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['nao_lidas'], 1)

        response = self.client.post(
            reverse(
                'marcar_notificacao_como_lida',
                kwargs={'notificacao_id': notificacao.pk},
            )
        )
        self.assertEqual(response.status_code, 200)

        notificacao.refresh_from_db()
        self.assertTrue(notificacao.is_read)
        self.assertIsNotNone(notificacao.lido_em)
