from django.urls import path

from workspace import views


urlpatterns = [
    path("pedidos/", views.pedidos, name="pedidos"),
    path("pedidos/novo/", views.pedido_novo, name="pedido_novo"),
    path("pedidos/<int:pedido_id>/", views.pedido_detalhe, name="pedido_detalhe"),
    path("pedidos/<int:pedido_id>/status/", views.pedido_atualizar_status, name="pedido_atualizar_status"),
    path("cozinha/", views.cozinha, name="cozinha"),
    path("delivery/", views.delivery, name="delivery"),
    path("clientes/", views.clientes, name="clientes"),
    path("produtos/", views.produtos, name="produtos"),
    path("produtos/novo/", views.produto_novo, name="produto_novo"),
]
