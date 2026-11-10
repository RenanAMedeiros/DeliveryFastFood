from django.urls import path

from workspace import views


urlpatterns = [
    path("pedidos/", views.pedidos, name="pedidos"),
    path("pedidos/novo/", views.pedido_novo, name="pedido_novo"),
    path("pedidos/unir/", views.pedidos_unir, name="pedidos_unir"),
    path("pedidos/<int:pedido_id>/", views.pedido_detalhe, name="pedido_detalhe"),
    path("pedidos/<int:pedido_id>/status/", views.pedido_atualizar_status, name="pedido_atualizar_status"),
    path("salao/", views.salao, name="salao"),
    path("salao/mesa/<int:mesa_numero>/", views.salao_mesa, name="salao_mesa"),
    path("salao/mesa/<int:mesa_numero>/transferir/", views.salao_mesa_transferir, name="salao_mesa_transferir"),
    path("salao/mesa/<int:mesa_numero>/fechar/", views.salao_mesa_fechar, name="salao_mesa_fechar"),
    path("cozinha/", views.cozinha, name="cozinha"),
    path("delivery/", views.delivery, name="delivery"),
    path("clientes/", views.clientes, name="clientes"),
    path("produtos/", views.produtos, name="produtos"),
    path("produtos/novo/", views.produto_novo, name="produto_novo"),
    path("produtos/<int:produto_id>/editar/", views.produto_editar, name="produto_editar"),
    path("configuracoes/", views.configuracoes, name="configuracoes"),
]
