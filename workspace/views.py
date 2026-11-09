from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db.models import Count, Prefetch, Q
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
from django.views.decorators.http import require_POST

from workspace.models import ClientePedido, HistoricoPedido, ItemPedido, Pedido, ProdutoPedido


def _valor_decimal(valor):
    texto = str(valor or "").strip().replace("R$", "").replace(".", "").replace(",", ".")
    try:
        return texto and round(float(texto), 2) or 0
    except ValueError:
        return 0


def _proximo_codigo_pedido():
    ano = timezone.localdate().year
    ultimo_id = Pedido.objects.order_by("-id").values_list("id", flat=True).first() or 0
    return f"PED-{ano}-{ultimo_id + 1:05d}"


@login_required
def pedidos(request):
    busca = str(request.GET.get("q") or "").strip()
    status = str(request.GET.get("status") or "").strip()

    pedidos_qs = (
        Pedido.objects
        .select_related("cliente", "responsavel")
        .prefetch_related("itens")
    )

    if busca:
        pedidos_qs = pedidos_qs.filter(
            Q(codigo__icontains=busca)
            | Q(cliente__nome__icontains=busca)
            | Q(itens__produto__nome__icontains=busca)
        ).distinct()

    if status:
        pedidos_qs = pedidos_qs.filter(status=status)

    pedidos_lista = list(pedidos_qs[:200])
    resumo = {
        "total": len(pedidos_lista),
        "abertos": sum(1 for item in pedidos_lista if item.status == Pedido.STATUS_ABERTO),
        "separacao": sum(1 for item in pedidos_lista if item.status == Pedido.STATUS_EM_SEPARACAO),
        "prontos": sum(1 for item in pedidos_lista if item.status == Pedido.STATUS_PRONTO),
        "entrega": sum(1 for item in pedidos_lista if item.status == Pedido.STATUS_EM_ENTREGA),
        "atrasados": sum(1 for item in pedidos_lista if item.atrasado),
    }

    return render(
        request,
        "workspace/pedidos.html",
        {
            "pedidos": pedidos_lista,
            "resumo": resumo,
            "status_choices": Pedido.STATUS_CHOICES,
            "status_atual": status,
            "busca": busca,
        },
    )


@login_required
def pedido_novo(request):
    if request.method == "POST":
        cliente_nome = str(request.POST.get("cliente_nome") or "").strip()
        produto_ids = request.POST.getlist("produto_id")
        produto_nomes = request.POST.getlist("produto_nome")
        categorias = request.POST.getlist("categoria")
        skus = request.POST.getlist("sku")
        quantidades = request.POST.getlist("quantidade")
        valores_unitarios = request.POST.getlist("valor_unitario")
        descontos = request.POST.getlist("desconto")
        item_observacoes = request.POST.getlist("item_observacoes")

        if not cliente_nome:
            messages.error(request, "Informe o cliente para criar o pedido.")
            return redirect("pedido_novo")

        itens_postados = []
        total_linhas = max(len(produto_ids), len(produto_nomes), len(quantidades), 1)
        for indice in range(total_linhas):
            produto_id = str(produto_ids[indice] if indice < len(produto_ids) else "").strip()
            produto_nome = str(produto_nomes[indice] if indice < len(produto_nomes) else "").strip()

            if not produto_id and not produto_nome:
                continue

            itens_postados.append({
                "produto_id": produto_id,
                "produto_nome": produto_nome,
                "categoria": categorias[indice] if indice < len(categorias) else ProdutoPedido.CATEGORIA_OUTROS,
                "sku": skus[indice] if indice < len(skus) else "",
                "quantidade": quantidades[indice] if indice < len(quantidades) else "1",
                "valor_unitario": valores_unitarios[indice] if indice < len(valores_unitarios) else "0",
                "desconto": descontos[indice] if indice < len(descontos) else "0",
                "observacoes": item_observacoes[indice] if indice < len(item_observacoes) else "",
            })

        if not itens_postados:
            messages.error(request, "Informe pelo menos um item para criar o pedido.")
            return redirect("pedido_novo")

        cliente, _ = ClientePedido.objects.get_or_create(
            nome=cliente_nome,
            defaults={
                "tipo_pessoa": request.POST.get("tipo_pessoa") or ClientePedido.TIPO_PESSOA_FISICA,
                "documento": str(request.POST.get("documento") or "").strip(),
                "email": str(request.POST.get("email") or "").strip(),
                "telefone": str(request.POST.get("telefone") or "").strip(),
            },
        )

        pedido = Pedido.objects.create(
            codigo=str(request.POST.get("codigo") or "").strip() or _proximo_codigo_pedido(),
            codigo_externo=str(request.POST.get("codigo_externo") or "").strip(),
            canal=request.POST.get("canal") or Pedido.CANAL_IFOOD,
            cliente=cliente,
            status=request.POST.get("status") or Pedido.STATUS_ABERTO,
            prioridade=request.POST.get("prioridade") or Pedido.PRIORIDADE_NORMAL,
            previsao_entrega=request.POST.get("previsao_entrega") or None,
            observacoes=str(request.POST.get("observacoes") or "").strip(),
            endereco_entrega=str(request.POST.get("endereco_entrega") or "").strip(),
            taxa_entrega=_valor_decimal(request.POST.get("taxa_entrega")),
            desconto_pedido=_valor_decimal(request.POST.get("desconto_pedido")),
            forma_pagamento=request.POST.get("forma_pagamento") or Pedido.FORMA_PIX,
            valor_recebido=_valor_decimal(request.POST.get("valor_recebido")),
            entregador=str(request.POST.get("entregador") or "").strip(),
            responsavel=request.user,
            criado_por=request.user,
        )

        for item in itens_postados:
            if item["produto_id"]:
                produto = get_object_or_404(ProdutoPedido, id=item["produto_id"])
            else:
                produto, _ = ProdutoPedido.objects.get_or_create(
                    nome=item["produto_nome"],
                    defaults={
                        "sku": str(item["sku"] or "").strip(),
                        "categoria": item["categoria"] or ProdutoPedido.CATEGORIA_OUTROS,
                        "preco_unitario": _valor_decimal(item["valor_unitario"]),
                    },
                )

            try:
                quantidade = max(int(item["quantidade"] or 1), 1)
            except (TypeError, ValueError):
                quantidade = 1

            valor_unitario = _valor_decimal(item["valor_unitario"]) or produto.preco_unitario

            ItemPedido.objects.create(
                pedido=pedido,
                produto=produto,
                quantidade=quantidade,
                valor_unitario=valor_unitario,
                desconto=_valor_decimal(item["desconto"]),
                observacoes=str(item["observacoes"] or "").strip(),
            )

        HistoricoPedido.objects.create(
            pedido=pedido,
            status_novo=pedido.status,
            descricao="Pedido criado",
            usuario=request.user,
        )
        messages.success(request, "Pedido criado com sucesso.")
        return redirect("pedido_detalhe", pedido_id=pedido.id)

    return render(
        request,
        "workspace/pedido_form.html",
        {
            "codigo_sugerido": _proximo_codigo_pedido(),
            "status_choices": Pedido.STATUS_CHOICES,
            "prioridade_choices": Pedido.PRIORIDADE_CHOICES,
            "canal_choices": Pedido.CANAL_CHOICES,
            "forma_pagamento_choices": Pedido.FORMA_PAGAMENTO_CHOICES,
            "categoria_choices": ProdutoPedido.CATEGORIA_CHOICES,
            "tipo_pessoa_choices": ClientePedido.TIPO_PESSOA_CHOICES,
            "produtos": ProdutoPedido.objects.filter(ativo=True),
        },
    )


@login_required
def pedido_detalhe(request, pedido_id):
    pedido = get_object_or_404(
        Pedido.objects.select_related("cliente", "responsavel").prefetch_related(
            Prefetch("itens", queryset=ItemPedido.objects.select_related("produto")),
            "historico",
        ),
        id=pedido_id,
    )
    return render(request, "workspace/pedido_detalhe.html", {"pedido": pedido, "status_choices": Pedido.STATUS_CHOICES})


@login_required
@require_POST
def pedido_atualizar_status(request, pedido_id):
    pedido = get_object_or_404(Pedido, id=pedido_id)
    status_anterior = pedido.status
    status_novo = request.POST.get("status")

    if status_novo not in dict(Pedido.STATUS_CHOICES):
        messages.error(request, "Status invalido.")
        return redirect("pedido_detalhe", pedido_id=pedido.id)

    pedido.status = status_novo
    pedido.save(update_fields=["status", "atualizado_em"])
    HistoricoPedido.objects.create(
        pedido=pedido,
        status_anterior=status_anterior,
        status_novo=status_novo,
        descricao="Status atualizado",
        usuario=request.user,
    )
    messages.success(request, "Status atualizado.")
    return redirect("pedido_detalhe", pedido_id=pedido.id)


@login_required
def cozinha(request):
    pedidos_preparo = (
        Pedido.objects
        .select_related("cliente")
        .prefetch_related(Prefetch("itens", queryset=ItemPedido.objects.select_related("produto")))
        .filter(status__in=[Pedido.STATUS_ABERTO, Pedido.STATUS_EM_SEPARACAO, Pedido.STATUS_PRONTO])
        .order_by("criado_em")
    )
    return render(request, "workspace/cozinha.html", {"pedidos": pedidos_preparo})


@login_required
def delivery(request):
    pedidos_delivery = (
        Pedido.objects
        .select_related("cliente")
        .prefetch_related(Prefetch("itens", queryset=ItemPedido.objects.select_related("produto")))
        .filter(
            Q(canal__in=[Pedido.CANAL_DELIVERY, Pedido.CANAL_IFOOD, Pedido.CANAL_WHATSAPP])
            | Q(endereco_entrega__gt="")
        )
        .exclude(status__in=[Pedido.STATUS_ENTREGUE, Pedido.STATUS_CANCELADO])
        .order_by("criado_em")
    )
    return render(request, "workspace/delivery.html", {"pedidos": pedidos_delivery})


@login_required
def clientes(request):
    busca = str(request.GET.get("q") or "").strip()
    clientes_qs = ClientePedido.objects.annotate(total_pedidos=Count("pedidos"))
    if busca:
        clientes_qs = clientes_qs.filter(Q(nome__icontains=busca) | Q(documento__icontains=busca))
    return render(request, "workspace/clientes.html", {"clientes": clientes_qs[:200], "busca": busca})


@login_required
def produtos(request):
    busca = str(request.GET.get("q") or "").strip()
    categoria = str(request.GET.get("categoria") or "").strip()
    produtos_qs = ProdutoPedido.objects.all()

    if busca:
        produtos_qs = produtos_qs.filter(Q(nome__icontains=busca) | Q(sku__icontains=busca))

    if categoria:
        produtos_qs = produtos_qs.filter(categoria=categoria)

    return render(
        request,
        "workspace/produtos.html",
        {
            "produtos": produtos_qs[:200],
            "busca": busca,
            "categoria_atual": categoria,
            "categoria_choices": ProdutoPedido.CATEGORIA_CHOICES,
        },
    )


@login_required
def produto_novo(request):
    if request.method == "POST":
        nome = str(request.POST.get("nome") or "").strip()
        if not nome:
            messages.error(request, "Informe o nome do item de venda.")
            return redirect("produto_novo")

        ProdutoPedido.objects.create(
            nome=nome,
            sku=str(request.POST.get("sku") or "").strip(),
            categoria=request.POST.get("categoria") or ProdutoPedido.CATEGORIA_OUTROS,
            descricao=str(request.POST.get("descricao") or "").strip(),
            foto=request.FILES.get("foto"),
            preco_unitario=_valor_decimal(request.POST.get("preco_unitario")),
            tempo_preparo_minutos=int(request.POST.get("tempo_preparo_minutos") or 0),
            ativo=bool(request.POST.get("ativo")),
        )
        messages.success(request, "Item de venda cadastrado com sucesso.")
        return redirect("produtos")

    return render(
        request,
        "workspace/produto_form.html",
        {"categoria_choices": ProdutoPedido.CATEGORIA_CHOICES},
    )
