from django.urls import reverse_lazy
from django.utils.translation import gettext_lazy as _


def _static(path):
    from django.templatetags.static import static

    return lambda request: static(path)


def environment_callback(request):
    host = request.get_host().lower()
    if "localhost" in host or host.startswith("127.0.0.1"):
        return [_("Ambiente local"), "info"]
    return None


UNFOLD = {
    "SITE_TITLE": "Controle de Pedidos",
    "SITE_HEADER": "Controle de Pedidos",
    "SITE_SUBHEADER": "Painel administrativo",
    "SITE_SYMBOL": "shopping_cart",
    "SITE_URL": "/",
    "SITE_FAVICONS": [
        {
            "rel": "icon",
            "href": _static("favicon.ico"),
            "type": "image/x-icon",
        },
    ],
    "SHOW_HISTORY": True,
    "SHOW_VIEW_ON_SITE": False,
    "SHOW_BACK_BUTTON": True,
    "BORDER_RADIUS": "8px",
    "ENVIRONMENT": "setup.unfold_config.environment_callback",
    "STYLES": [_static("css/unfold_workspace.css")],
    "COLORS": {
        "primary": {
            "50": "#eff6ff",
            "100": "#dbeafe",
            "200": "#bfdbfe",
            "300": "#93c5fd",
            "400": "#60a5fa",
            "500": "#3b82f6",
            "600": "#2563eb",
            "700": "#1d4ed8",
            "800": "#1e40af",
            "900": "#101c44",
            "950": "#071124",
        },
    },
    "ACCOUNT": {
        "navigation": [
            {
                "title": _("Voltar ao sistema"),
                "icon": "logout",
                "link": "/",
            },
            {
                "title": _("Alterar minha senha"),
                "icon": "lock_reset",
                "link": reverse_lazy("admin:password_change"),
            },
        ],
    },
    "SIDEBAR": {
        "show_search": True,
        "show_all_applications": True,
        "navigation": [
            {
                "title": _("Pedidos"),
                "separator": True,
                "collapsible": False,
                "items": [
                    {
                        "title": _("Pedidos"),
                        "icon": "receipt_long",
                        "link": reverse_lazy("admin:workspace_pedido_changelist"),
                    },
                    {
                        "title": _("Clientes"),
                        "icon": "person",
                        "link": reverse_lazy("admin:workspace_clientepedido_changelist"),
                    },
                    {
                        "title": _("Produtos/servicos"),
                        "icon": "inventory_2",
                        "link": reverse_lazy("admin:workspace_produtopedido_changelist"),
                    },
                    {
                        "title": _("Historico"),
                        "icon": "history",
                        "link": reverse_lazy("admin:workspace_historicopedido_changelist"),
                    },
                ],
            },
            {
                "title": _("Usuarios"),
                "separator": True,
                "collapsible": False,
                "items": [
                    {
                        "title": _("Usuarios"),
                        "icon": "group",
                        "link": reverse_lazy("admin:customauth_customuser_changelist"),
                    },
                    {
                        "title": _("Bases de acesso"),
                        "icon": "business",
                        "link": reverse_lazy("admin:customauth_cliente_changelist"),
                    },
                ],
            },
        ],
    },
}
