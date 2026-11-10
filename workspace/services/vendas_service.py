"""Regras de negocio da operacao de vendas: comandas, uniao de pedidos e financeiro."""

from datetime import timedelta
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import Prefetch
from django.utils import timezone

from workspace.models import (
    ClientePedido,
    Comanda,
    ConfiguracaoLoja,
    HistoricoPedido,
    ItemPedido,
    Pedido,
    nome_mesa,
)


class ErroOperacao(Exception):
    """Erro de regra de negocio que deve ser exibido ao usuario."""


def valor_decimal(valor):
    texto = str(valor or "").strip().replace("R$", "").replace(" ", "")
    if not texto:
        return Decimal("0.00")
    if "," in texto:
        texto = texto.replace(".", "").replace(",", ".")
    try:
        return Decimal(texto).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError):
        return Decimal("0.00")


def proximo_codigo_pedido():
    ano = timezone.localdate().year
    ultimo_id = Pedido.objects.order_by("-id").values_list("id", flat=True).first() or 0
    return f"PED-{ano}-{ultimo_id + 1:05d}"


def registrar_historico(pedido, status_anterior, status_novo, descricao, usuario=None):
    HistoricoPedido.objects.create(
        pedido=pedido,
        status_anterior=status_anterior or "",
        status_novo=status_novo or "",
        descricao=descricao,
        usuario=usuario,
    )


# ---------------------------------------------------------------------------
# Mesas e comandas
# ---------------------------------------------------------------------------

def pedidos_da_comanda_queryset():
    return (
        Pedido.objects
        .select_related("cliente")
        .prefetch_related(Prefetch("itens", queryset=ItemPedido.objects.select_related("produto")))
        .order_by("criado_em")
    )


def comandas_abertas():
    return (
        Comanda.objects
        .filter(status=Comanda.STATUS_ABERTA)
        .prefetch_related(Prefetch("pedidos", queryset=pedidos_da_comanda_queryset()))
    )


def comandas_abertas_por_mesa():
    return {comanda.mesa_numero: comanda for comanda in comandas_abertas()}


def comanda_aberta_da_mesa(mesa_numero):
    return comandas_abertas().filter(mesa_numero=mesa_numero).first()


def cliente_da_mesa(mesa_numero):
    cliente, _ = ClientePedido.objects.get_or_create(nome=nome_mesa(mesa_numero))
    return cliente


def validar_mesa(mesa_numero, configuracao=None):
    configuracao = configuracao or ConfiguracaoLoja.obter()
    try:
        numero = int(mesa_numero)
    except (TypeError, ValueError):
        raise ErroOperacao("Selecione uma mesa valida.")
    if numero < 1 or numero > configuracao.quantidade_mesas:
        raise ErroOperacao(f"A mesa informada nao existe. A loja possui {configuracao.quantidade_mesas} mesa(s).")
    return numero


def obter_ou_abrir_comanda(mesa_numero, usuario=None):
    comanda = comanda_aberta_da_mesa(mesa_numero)
    if comanda is None:
        comanda = Comanda.objects.create(mesa_numero=mesa_numero, aberta_por=usuario)
    return comanda


def mapa_do_salao(configuracao=None):
    """Lista de mesas com a comanda aberta (quando houver) para montar o mapa."""
    configuracao = configuracao or ConfiguracaoLoja.obter()
    abertas = comandas_abertas_por_mesa()
    mesas = []
    for numero in configuracao.numeros_mesas:
        comanda = abertas.get(numero)
        mesas.append({
            "numero": numero,
            "nome": nome_mesa(numero),
            "comanda": comanda,
            "ocupada": comanda is not None,
            "total": comanda.total if comanda else Decimal("0.00"),
        })
    return mesas


def mesas_livres(configuracao=None, excluir=None):
    configuracao = configuracao or ConfiguracaoLoja.obter()
    ocupadas = set(comandas_abertas().values_list("mesa_numero", flat=True))
    return [
        {"numero": numero, "nome": nome_mesa(numero)}
        for numero in configuracao.numeros_mesas
        if numero not in ocupadas and numero != excluir
    ]


@transaction.atomic
def transferir_comanda(comanda, mesa_destino, usuario=None):
    if not comanda.aberta:
        raise ErroOperacao("Esta comanda ja foi fechada.")

    destino = validar_mesa(mesa_destino)
    if destino == comanda.mesa_numero:
        raise ErroOperacao("Escolha uma mesa diferente da atual.")
    if comanda_aberta_da_mesa(destino) is not None:
        raise ErroOperacao(f"A {nome_mesa(destino)} ja esta ocupada.")

    origem = comanda.mesa_numero
    cliente_origem = ClientePedido.objects.filter(nome=nome_mesa(origem)).first()
    cliente_destino = cliente_da_mesa(destino)

    comanda.mesa_numero = destino
    comanda.save(update_fields=["mesa_numero"])

    for pedido in comanda.pedidos.all():
        campos = ["mesa_numero", "atualizado_em"]
        pedido.mesa_numero = destino
        if cliente_origem and pedido.cliente_id == cliente_origem.id:
            pedido.cliente = cliente_destino
            campos.append("cliente")
        pedido.save(update_fields=campos)
        registrar_historico(
            pedido,
            pedido.status,
            pedido.status,
            f"Comanda transferida da {nome_mesa(origem)} para {nome_mesa(destino)}",
            usuario,
        )
    return comanda


@transaction.atomic
def fechar_comanda(comanda, forma_pagamento, usuario=None):
    if not comanda.aberta:
        raise ErroOperacao("Esta comanda ja foi fechada.")
    if forma_pagamento not in dict(Pedido.FORMA_PAGAMENTO_CHOICES):
        raise ErroOperacao("Selecione uma forma de pagamento valida.")

    total = comanda.total
    agora = timezone.now()

    for pedido in comanda.pedidos.all():
        if pedido.status == Pedido.STATUS_CANCELADO:
            continue
        status_anterior = pedido.status
        pedido.forma_pagamento = forma_pagamento
        pedido.valor_recebido = pedido.total
        pedido.pago = True
        if pedido.status != Pedido.STATUS_ENTREGUE:
            pedido.status = Pedido.STATUS_ENTREGUE
        pedido.save(update_fields=["forma_pagamento", "valor_recebido", "pago", "status", "atualizado_em"])
        registrar_historico(
            pedido,
            status_anterior,
            pedido.status,
            f"Pagamento da comanda registrado ({dict(Pedido.FORMA_PAGAMENTO_CHOICES)[forma_pagamento]})",
            usuario,
        )

    comanda.status = Comanda.STATUS_FECHADA
    comanda.fechada_em = agora
    comanda.forma_pagamento = forma_pagamento
    comanda.total_pago = total
    comanda.fechada_por = usuario
    comanda.save(update_fields=["status", "fechada_em", "forma_pagamento", "total_pago", "fechada_por"])
    return comanda


# ---------------------------------------------------------------------------
# Uniao de pedidos
# ---------------------------------------------------------------------------

def pedidos_para_uniao(ids):
    numeros = []
    for valor in ids:
        try:
            numeros.append(int(valor))
        except (TypeError, ValueError):
            continue
    return list(
        Pedido.objects
        .filter(id__in=numeros)
        .select_related("cliente")
        .prefetch_related("itens")
        .order_by("-id")
    )


def validar_uniao(pedidos):
    if len(pedidos) < 2:
        raise ErroOperacao("Selecione pelo menos dois pedidos para unir.")
    for pedido in pedidos:
        if pedido.status == Pedido.STATUS_CANCELADO:
            raise ErroOperacao(f"O pedido {pedido.codigo} esta cancelado e nao pode ser unido.")
        if pedido.unido_em_id:
            raise ErroOperacao(f"O pedido {pedido.codigo} ja foi unido a outro pedido.")
        if pedido.pago:
            raise ErroOperacao(f"O pedido {pedido.codigo} ja foi pago e nao pode ser unido.")


@transaction.atomic
def unir_pedidos(principal, pedidos, usuario=None):
    validar_uniao(pedidos)
    if principal not in pedidos:
        raise ErroOperacao("O pedido principal precisa estar entre os pedidos selecionados.")

    secundarios = [pedido for pedido in pedidos if pedido.id != principal.id]
    for pedido in secundarios:
        for item in pedido.itens.all():
            ItemPedido.objects.create(
                pedido=principal,
                produto=item.produto,
                quantidade=item.quantidade,
                valor_unitario=item.valor_unitario,
                desconto=item.desconto,
                observacoes=item.observacoes,
            )
        principal.taxa_entrega += pedido.taxa_entrega
        principal.desconto_pedido += pedido.desconto_pedido
        principal.valor_recebido += pedido.valor_recebido
        if pedido.observacoes:
            principal.observacoes = "\n".join(
                texto for texto in [principal.observacoes, f"[{pedido.codigo}] {pedido.observacoes}"] if texto
            )

        status_anterior = pedido.status
        pedido.status = Pedido.STATUS_CANCELADO
        pedido.unido_em = principal
        pedido.save(update_fields=["status", "unido_em", "atualizado_em"])
        registrar_historico(pedido, status_anterior, pedido.status, f"Unido ao pedido {principal.codigo}", usuario)
        registrar_historico(
            principal,
            principal.status,
            principal.status,
            f"Recebeu os itens do pedido {pedido.codigo}",
            usuario,
        )

    principal.save(update_fields=["taxa_entrega", "desconto_pedido", "valor_recebido", "observacoes", "atualizado_em"])
    return principal


# ---------------------------------------------------------------------------
# Financeiro
# ---------------------------------------------------------------------------

def resumo_financeiro(data_inicial, data_final):
    """Faturamento do periodo (pedidos nao cancelados), media diaria e projecao."""
    if data_final < data_inicial:
        data_inicial, data_final = data_final, data_inicial

    pedidos = (
        Pedido.objects
        .filter(data_pedido__gte=data_inicial, data_pedido__lte=data_final)
        .exclude(status=Pedido.STATUS_CANCELADO)
        .prefetch_related("itens")
    )
    valor = sum((pedido.total for pedido in pedidos), Decimal("0.00"))
    quantidade = len(pedidos)
    dias = max((data_final - data_inicial).days + 1, 1)
    media = (valor / dias).quantize(Decimal("0.01"))
    return {
        "data_inicial": data_inicial,
        "data_final": data_final,
        "valor_faturado": valor,
        "pedidos_faturados": quantidade,
        "media_por_dia": media,
        "projecao_7_dias": (media * 7).quantize(Decimal("0.01")),
        "dias": dias,
    }


def periodo_padrao():
    hoje = timezone.localdate()
    return hoje, hoje


def ultimos_dias(quantidade):
    hoje = timezone.localdate()
    return hoje - timedelta(days=quantidade - 1), hoje
