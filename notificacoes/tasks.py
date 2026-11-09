from celery import shared_task
from django.contrib.auth import get_user_model

from .services import criar_notificacao as criar_notificacao_service


@shared_task
def criar_notificacao(
    usuario_id,
    mensagem,
    titulo='Nova notificação',
    tipo='geral',
    link='',
):
    """Versão assíncrona do serviço de criação de notificações."""
    usuario = get_user_model().objects.get(pk=usuario_id)
    notificacao = criar_notificacao_service(
        usuario=usuario,
        titulo=titulo,
        mensagem=mensagem,
        tipo=tipo,
        link=link,
    )
    return notificacao.pk
