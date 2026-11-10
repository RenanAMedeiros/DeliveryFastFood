from decimal import Decimal, InvalidOperation

from django import template

from workspace.models import Pedido


register = template.Library()


STATUS_CLASSES = {
    Pedido.STATUS_RASCUNHO: "badge-muted",
    Pedido.STATUS_AGUARDANDO_PAGAMENTO: "badge-warning",
    Pedido.STATUS_ABERTO: "badge-info",
    Pedido.STATUS_EM_SEPARACAO: "badge-warning",
    Pedido.STATUS_PRONTO: "badge-success",
    Pedido.STATUS_EM_ENTREGA: "badge-info",
    Pedido.STATUS_ENTREGUE: "badge-muted",
    Pedido.STATUS_CANCELADO: "badge-danger",
}


@register.filter
def moeda(valor):
    """Formata um numero como moeda brasileira: R$ 1.234,56."""
    try:
        numero = Decimal(str(valor or 0)).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError):
        return "R$ 0,00"
    negativo = numero < 0
    inteiro, centavos = f"{abs(numero):.2f}".split(".")
    grupos = []
    while inteiro:
        grupos.insert(0, inteiro[-3:])
        inteiro = inteiro[:-3]
    texto = f"R$ {'.'.join(grupos)},{centavos}"
    return f"-{texto}" if negativo else texto


@register.filter
def status_classe(status):
    return STATUS_CLASSES.get(status, "badge-muted")


@register.simple_tag(takes_context=True)
def ativo_em(context, *nomes):
    """Retorna 'is-active' quando a rota atual pertence a um dos nomes informados."""
    request = context.get("request")
    resolver = getattr(request, "resolver_match", None)
    if resolver and resolver.url_name in nomes:
        return "is-active"
    return ""
