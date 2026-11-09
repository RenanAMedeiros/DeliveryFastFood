from django.urls import path

from .views import (
    listar_notificacoes,
    marcar_notificacao_como_lida,
    marcar_notificacoes_como_lidas,
    obter_notificacoes,
)


urlpatterns = [
    path(
        'notificacoes/',
        listar_notificacoes,
        name='listar_notificacoes',
    ),
    path(
        'notificacoes/obter/',
        obter_notificacoes,
        name='obter_notificacoes',
    ),
    path(
        'notificacoes/marcar_lidas/',
        marcar_notificacoes_como_lidas,
        name='marcar_notificacoes_como_lidas',
    ),
    path(
        'notificacoes/<int:notificacao_id>/marcar_lida/',
        marcar_notificacao_como_lida,
        name='marcar_notificacao_como_lida',
    ),
]
