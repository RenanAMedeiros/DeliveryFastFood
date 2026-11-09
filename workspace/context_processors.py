def dashboards_liberados(request):
    """Disponibiliza no template o conjunto de categorias de dashboard
    que o usuário logado pode visualizar, com base nas carteiras (Empresa)
    vinculadas a ele na CustomAuth > CustomUser.

    Usado para exibir/ocultar os itens do menu "Meus dashboards" no navbar.
    """
    user = getattr(request, 'user', None)

    if not user or not user.is_authenticated:
        return {'dashboards_liberados': set()}

    return {'dashboards_liberados': user.categorias_dashboard_liberadas()}


def logos_navbar(request):
    """Disponibiliza no template os logos de parceiros a exibir na navbar.

    Cada Cliente (CustomAuth > Clientes) escolhe, entre o catálogo de
    LogoParceiro, quais logos aparecem para os usuários vinculados a ele
    (CustomUser.cliente). Se o usuário não tiver um cliente configurado,
    ou o cliente não tiver logos escolhidos, retorna None e o template
    usa a listagem padrão (DNR, Nunes, PowerDNA, BB, BM).
    """
    user = getattr(request, 'user', None)

    if not user or not user.is_authenticated or not user.cliente_id:
        return {'logos_navbar': None}

    logos = list(user.cliente.logos.all())
    return {'logos_navbar': logos or None}
