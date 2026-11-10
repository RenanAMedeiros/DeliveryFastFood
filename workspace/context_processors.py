from django.contrib.staticfiles import finders


LOGO_LOJA_PATH = "imagens/logo_loja.png"


def loja(request):
    """Dados globais da loja para o layout: nome e logo (quando existir)."""
    from workspace.models import ConfiguracaoLoja

    nome = "Shinchan"
    try:
        nome = ConfiguracaoLoja.obter().nome_loja or nome
    except Exception:  # banco ainda nao migrado
        pass

    return {
        "loja_nome": nome,
        "loja_logo": LOGO_LOJA_PATH if finders.find(LOGO_LOJA_PATH) else "",
    }
