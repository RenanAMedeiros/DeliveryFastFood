from .models import Notificacao


def criar_notificacao(
    *,
    usuario,
    mensagem,
    titulo='Nova notificação',
    tipo=Notificacao.TIPO_GERAL,
    link='',
    criado_por=None,
):
    """Cria uma notificação para um usuário do sistema."""
    return Notificacao.objects.create(
        usuario=usuario,
        titulo=titulo,
        mensagem=mensagem,
        tipo=tipo,
        link=link,
        criado_por=criado_por,
    )


def notificar_usuarios(
    *,
    usuarios,
    mensagem,
    titulo='Nova notificação',
    tipo=Notificacao.TIPO_GERAL,
    link='',
    criado_por=None,
):
    """Cria a mesma notificação para vários usuários."""
    notificacoes = [
        Notificacao(
            usuario=usuario,
            titulo=titulo,
            mensagem=mensagem,
            tipo=tipo,
            link=link,
            criado_por=criado_por,
        )
        for usuario in usuarios
    ]
    return Notificacao.objects.bulk_create(notificacoes)
