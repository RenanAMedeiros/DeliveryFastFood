import json
from datetime import date
from decimal import Decimal

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db.models import Count, Prefetch, Q
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
from django.utils.dateparse import parse_date
from django.views.decorators.http import require_POST

from workspace.models import (
    ClientePedido,
    Comanda,
    ConfiguracaoLoja,
    ItemPedido,
    Pedido,
    ProdutoPedido,
    nome_mesa,
)
from workspace.services import vendas_service as vendas
from workspace.services.vendas_service import ErroOperacao


def _data(valor):
    texto = str(valor or "").strip()
    if not texto:
        return None
    return parse_date(texto)


def _inteiro(valor, padrao=0, minimo=None):
    try:
        numero = int(str(valor or "").strip() or padrao)
    except (TypeError, ValueError):
        numero = padrao
    if minimo is not None:
        numero = max(numero, minimo)
    return numero


# ---------------------------------------------------------------------------
# Pedidos
# ---------------------------------------------------------------------------

@login_required
def pedidos(request):
    busca = str(request.GET.get("q") or "").strip()
    status = str(request.GET.get("status") or "").strip()
    data_inicial = _data(request.GET.get("data_inicial"))
    data_final = _data(request.GET.get("data_final"))

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
    if data_inicial:
        pedidos_qs = pedidos_qs.filter(data_pedido__gte=data_inicial)
    if data_final:
        pedidos_qs = pedidos_qs.filter(data_pedido__lte=data_final)

    pedidos_lista = list(pedidos_qs[:200])
    abertos = sum(1 for pedido in pedidos_lista if pedido.aberto)
    resumo = {
        "total": len(pedidos_lista),
        "abertos": abertos,
        "fechados": len(pedidos_lista) - abertos,
    }

    periodo_inicial, periodo_final = vendas.periodo_padrao()
    financeiro = vendas.resumo_financeiro(data_inicial or periodo_inicial, data_final or periodo_final)

    return render(
        request,
        "workspace/pedidos.html",
        {
            "pedidos": pedidos_lista,
            "resumo": resumo,
            "financeiro": financeiro,
            "status_choices": Pedido.STATUS_CHOICES,
            "status_atual": status,
            "busca": busca,
            "data_inicial": data_inicial,
            "data_final": data_final,
        },
    )


@login_required
def pedidos_unir(request):
    if request.method == "POST":
        ids = request.POST.getlist("pedido")
        principal_id = _inteiro(request.POST.get("principal"))
        pedidos_selecionados = vendas.pedidos_para_uniao(ids)
        principal = next((pedido for pedido in pedidos_selecionados if pedido.id == principal_id), None)

        if principal is None:
            messages.error(request, "Escolha o pedido que recebera os itens.")
        else:
            try:
                vendas.unir_pedidos(principal, pedidos_selecionados, request.user)
            except ErroOperacao as erro:
                messages.error(request, str(erro))
            else:
                messages.success(
                    request,
                    f"{len(pedidos_selecionados) - 1} pedido(s) unido(s) ao {principal.codigo}.",
                )
                return redirect("pedido_detalhe", pedido_id=principal.id)
        return redirect(f"{request.path}?{'&'.join(f'pedido={valor}' for valor in ids)}")

    pedidos_selecionados = vendas.pedidos_para_uniao(request.GET.getlist("pedido"))
    erro = None
    try:
        vendas.validar_uniao(pedidos_selecionados)
    except ErroOperacao as excecao:
        erro = str(excecao)

    clientes = sorted({pedido.cliente.nome for pedido in pedidos_selecionados})
    return render(
        request,
        "workspace/pedidos_unir.html",
        {
            "pedidos": pedidos_selecionados,
            "erro": erro,
            "clientes": clientes,
            "principal_sugerido": pedidos_selecionados[0].id if pedidos_selecionados else None,
        },
    )


def _itens_postados(request):
    produto_ids = request.POST.getlist("produto_id")
    quantidades = request.POST.getlist("quantidade")
    observacoes = request.POST.getlist("item_observacoes")
    itens = []
    for indice, produto_id in enumerate(produto_ids):
        produto_id = _inteiro(produto_id)
        if not produto_id:
            continue
        itens.append({
            "produto_id": produto_id,
            "quantidade": _inteiro(quantidades[indice] if indice < len(quantidades) else 1, 1, 1),
            "observacoes": str(observacoes[indice] if indice < len(observacoes) else "").strip()[:255],
        })
    return itens


def _contexto_nova_venda(request, configuracao, tipo, mesa_numero, dados=None, itens=None):
    produtos = list(ProdutoPedido.objects.filter(ativo=True).order_by("nome"))
    catalogo = [
        {
            "id": produto.id,
            "nome": produto.nome,
            "preco": float(produto.preco_unitario),
            "grupo": produto.grupo,
            "categoria": produto.get_categoria_display(),
            "foto": produto.foto.url if produto.foto else "",
        }
        for produto in produtos
    ]
    return {
        "configuracao": configuracao,
        "mesas": vendas.mapa_do_salao(configuracao),
        "tipo": tipo,
        "mesa_numero": mesa_numero,
        "produtos": produtos,
        "catalogo_json": json.dumps(catalogo),
        "carrinho_json": json.dumps(itens or []),
        "dados": dados or {},
        "forma_pagamento_choices": Pedido.FORMA_PAGAMENTO_CHOICES,
    }


@login_required
def pedido_novo(request):
    configuracao = ConfiguracaoLoja.obter()

    if request.method == "POST":
        tipo = "delivery" if request.POST.get("tipo") == "delivery" else "salao"
        mesa_param = request.POST.get("mesa_numero")
        itens = _itens_postados(request)
        dados = {
            chave: str(request.POST.get(chave) or "").strip()
            for chave in (
                "cliente_nome", "telefone", "endereco_entrega", "observacoes", "taxa_entrega",
                "desconto_pedido", "forma_pagamento", "valor_recebido", "entregador", "previsao_entrega",
            )
        }

        def responder_erro(mensagem):
            messages.error(request, mensagem)
            contexto = _contexto_nova_venda(request, configuracao, tipo, _inteiro(mesa_param), dados, itens)
            return render(request, "workspace/pedido_form.html", contexto)

        if not itens:
            return responder_erro("Adicione pelo menos um item ao pedido.")

        mesa_numero = None
        if tipo == "salao":
            try:
                mesa_numero = vendas.validar_mesa(mesa_param, configuracao)
            except ErroOperacao as erro:
                return responder_erro(str(erro))
            cliente = vendas.cliente_da_mesa(mesa_numero)
            canal = Pedido.CANAL_BALCAO
        else:
            if not dados["cliente_nome"]:
                return responder_erro("Informe o nome do cliente para a entrega.")
            if not dados["endereco_entrega"]:
                return responder_erro("Informe o endereco de entrega.")
            cliente, criado = ClientePedido.objects.get_or_create(
                nome=dados["cliente_nome"],
                defaults={"telefone": dados["telefone"], "endereco": dados["endereco_entrega"]},
            )
            if not criado:
                atualizar = []
                if dados["telefone"] and cliente.telefone != dados["telefone"]:
                    cliente.telefone = dados["telefone"]
                    atualizar.append("telefone")
                if cliente.endereco != dados["endereco_entrega"]:
                    cliente.endereco = dados["endereco_entrega"]
                    atualizar.append("endereco")
                if atualizar:
                    cliente.save(update_fields=atualizar + ["atualizado_em"])
            canal = Pedido.CANAL_DELIVERY

        produtos = {
            produto.id: produto
            for produto in ProdutoPedido.objects.filter(id__in=[item["produto_id"] for item in itens])
        }
        if len(produtos) != len({item["produto_id"] for item in itens}):
            return responder_erro("Um dos itens selecionados nao existe mais no cardapio.")

        comanda = vendas.obter_ou_abrir_comanda(mesa_numero, request.user) if mesa_numero else None
        forma_pagamento = dados["forma_pagamento"] if dados["forma_pagamento"] in dict(Pedido.FORMA_PAGAMENTO_CHOICES) else Pedido.FORMA_PIX

        pedido = Pedido.objects.create(
            codigo=vendas.proximo_codigo_pedido(),
            canal=canal,
            cliente=cliente,
            status=Pedido.STATUS_ABERTO,
            previsao_entrega=_data(dados["previsao_entrega"]),
            observacoes=dados["observacoes"],
            endereco_entrega=dados["endereco_entrega"] if tipo == "delivery" else "",
            taxa_entrega=vendas.valor_decimal(dados["taxa_entrega"]) if tipo == "delivery" else Decimal("0.00"),
            desconto_pedido=vendas.valor_decimal(dados["desconto_pedido"]),
            forma_pagamento=forma_pagamento,
            valor_recebido=vendas.valor_decimal(dados["valor_recebido"]),
            entregador=dados["entregador"] if tipo == "delivery" else "",
            mesa_numero=mesa_numero,
            comanda=comanda,
            responsavel=request.user,
            criado_por=request.user,
        )
        for item in itens:
            produto = produtos[item["produto_id"]]
            ItemPedido.objects.create(
                pedido=pedido,
                produto=produto,
                quantidade=item["quantidade"],
                valor_unitario=produto.preco_unitario,
                observacoes=item["observacoes"],
            )
        vendas.registrar_historico(pedido, "", pedido.status, "Pedido criado", request.user)

        messages.success(request, f"Pedido {pedido.codigo} criado com sucesso.")
        if mesa_numero:
            return redirect("salao_mesa", mesa_numero=mesa_numero)
        return redirect("pedido_detalhe", pedido_id=pedido.id)

    tipo = "delivery" if request.GET.get("tipo") == "delivery" else "salao"
    mesa_numero = _inteiro(request.GET.get("mesa"))
    if mesa_numero and not (1 <= mesa_numero <= configuracao.quantidade_mesas):
        mesa_numero = 0
    return render(request, "workspace/pedido_form.html", _contexto_nova_venda(request, configuracao, tipo, mesa_numero))


@login_required
def pedido_detalhe(request, pedido_id):
    pedido = get_object_or_404(
        Pedido.objects.select_related("cliente", "responsavel", "comanda", "unido_em").prefetch_related(
            Prefetch("itens", queryset=ItemPedido.objects.select_related("produto")),
            "historico__usuario",
            "pedidos_unidos",
        ),
        id=pedido_id,
    )
    return render(
        request,
        "workspace/pedido_detalhe.html",
        {"pedido": pedido, "status_choices": Pedido.STATUS_CHOICES},
    )


@login_required
@require_POST
def pedido_atualizar_status(request, pedido_id):
    pedido = get_object_or_404(Pedido, id=pedido_id)
    status_anterior = pedido.status
    status_novo = request.POST.get("status")
    destino = request.POST.get("next") or ""

    if status_novo not in dict(Pedido.STATUS_CHOICES):
        messages.error(request, "Status invalido.")
    elif status_novo != status_anterior:
        pedido.status = status_novo
        pedido.save(update_fields=["status", "atualizado_em"])
        vendas.registrar_historico(pedido, status_anterior, status_novo, "Status atualizado", request.user)
        messages.success(request, f"{pedido.codigo}: {pedido.get_status_display()}.")

    if destino.startswith("/"):
        return redirect(destino)
    return redirect("pedido_detalhe", pedido_id=pedido.id)


# ---------------------------------------------------------------------------
# Salao / mesas
# ---------------------------------------------------------------------------

@login_required
def salao(request):
    configuracao = ConfiguracaoLoja.obter()
    mesas = vendas.mapa_do_salao(configuracao)
    historico = (
        Comanda.objects
        .filter(status=Comanda.STATUS_FECHADA)
        .select_related("fechada_por")
        .order_by("-fechada_em")[:100]
    )
    return render(
        request,
        "workspace/salao.html",
        {
            "configuracao": configuracao,
            "mesas": mesas,
            "ocupadas": sum(1 for mesa in mesas if mesa["ocupada"]),
            "historico": historico,
        },
    )


@login_required
def salao_mesa(request, mesa_numero):
    configuracao = ConfiguracaoLoja.obter()
    comanda = vendas.comanda_aberta_da_mesa(mesa_numero)
    if comanda is None:
        if 1 <= mesa_numero <= configuracao.quantidade_mesas:
            messages.info(request, f"A {nome_mesa(mesa_numero)} esta livre. Abra um pedido para iniciar a comanda.")
            return redirect(f"/pedidos/novo/?tipo=salao&mesa={mesa_numero}")
        messages.error(request, "Mesa nao encontrada.")
        return redirect("salao")

    return render(
        request,
        "workspace/salao_mesa.html",
        {
            "comanda": comanda,
            "pedidos": comanda.pedidos.all(),
            "mesas_livres": vendas.mesas_livres(configuracao, excluir=comanda.mesa_numero),
            "forma_pagamento_choices": Pedido.FORMA_PAGAMENTO_CHOICES,
        },
    )


@login_required
@require_POST
def salao_mesa_transferir(request, mesa_numero):
    comanda = vendas.comanda_aberta_da_mesa(mesa_numero)
    if comanda is None:
        messages.error(request, "Esta mesa nao possui comanda aberta.")
        return redirect("salao")
    try:
        vendas.transferir_comanda(comanda, request.POST.get("mesa_destino"), request.user)
    except ErroOperacao as erro:
        messages.error(request, str(erro))
        return redirect("salao_mesa", mesa_numero=mesa_numero)
    messages.success(request, f"Comanda transferida para a {comanda.mesa_nome}.")
    return redirect("salao_mesa", mesa_numero=comanda.mesa_numero)


@login_required
@require_POST
def salao_mesa_fechar(request, mesa_numero):
    comanda = vendas.comanda_aberta_da_mesa(mesa_numero)
    if comanda is None:
        messages.error(request, "Esta mesa nao possui comanda aberta.")
        return redirect("salao")
    try:
        vendas.fechar_comanda(comanda, request.POST.get("forma_pagamento"), request.user)
    except ErroOperacao as erro:
        messages.error(request, str(erro))
        return redirect("salao_mesa", mesa_numero=mesa_numero)
    messages.success(request, f"{comanda.mesa_nome} liberada. Pagamento de R$ {comanda.total_pago:.2f} registrado.")
    return redirect("salao")


# ---------------------------------------------------------------------------
# Operacao: cozinha e delivery
# ---------------------------------------------------------------------------

def _acao_cozinha(pedido):
    if pedido.status == Pedido.STATUS_ABERTO:
        return {"status": Pedido.STATUS_EM_SEPARACAO, "rotulo": "Iniciar preparo", "classe": "btn-primary"}
    if pedido.status == Pedido.STATUS_EM_SEPARACAO:
        return {"status": Pedido.STATUS_PRONTO, "rotulo": "Pedido pronto", "classe": "btn-primary"}
    if pedido.e_salao:
        return {"status": Pedido.STATUS_ENTREGUE, "rotulo": "Enviado para a mesa", "classe": "btn-success"}
    if pedido.e_entrega:
        return {"status": Pedido.STATUS_EM_ENTREGA, "rotulo": "Saiu para entrega", "classe": "btn-success"}
    return {"status": Pedido.STATUS_ENTREGUE, "rotulo": "Entregue ao cliente", "classe": "btn-success"}


def _acao_delivery(pedido):
    if pedido.status == Pedido.STATUS_PRONTO:
        return {"status": Pedido.STATUS_EM_ENTREGA, "rotulo": "Saiu para entrega", "classe": "btn-primary"}
    if pedido.status == Pedido.STATUS_EM_ENTREGA:
        return {"status": Pedido.STATUS_ENTREGUE, "rotulo": "Marcar entregue", "classe": "btn-success"}
    return {"status": Pedido.STATUS_PRONTO, "rotulo": "Marcar pronto", "classe": "btn-secondary"}


@login_required
def cozinha(request):
    pedidos_preparo = (
        Pedido.objects
        .select_related("cliente")
        .prefetch_related(Prefetch("itens", queryset=ItemPedido.objects.select_related("produto")))
        .filter(status__in=[Pedido.STATUS_ABERTO, Pedido.STATUS_EM_SEPARACAO, Pedido.STATUS_PRONTO])
        .order_by("criado_em")
    )
    cards = [{"pedido": pedido, "acao": _acao_cozinha(pedido)} for pedido in pedidos_preparo]
    return render(request, "workspace/cozinha.html", {"cards": cards})


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
    cards = [{"pedido": pedido, "acao": _acao_delivery(pedido)} for pedido in pedidos_delivery]
    return render(request, "workspace/delivery.html", {"cards": cards})


# ---------------------------------------------------------------------------
# Cadastros
# ---------------------------------------------------------------------------

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


def _salvar_produto(request, produto):
    nome = str(request.POST.get("nome") or "").strip()
    if not nome:
        messages.error(request, "Informe o nome do item de venda.")
        return False

    produto.nome = nome
    produto.sku = str(request.POST.get("sku") or "").strip()
    produto.categoria = request.POST.get("categoria") or ProdutoPedido.CATEGORIA_OUTROS
    produto.descricao = str(request.POST.get("descricao") or "").strip()
    produto.preco_unitario = vendas.valor_decimal(request.POST.get("preco_unitario"))
    produto.tempo_preparo_minutos = _inteiro(request.POST.get("tempo_preparo_minutos"), 0, 0)
    produto.ativo = bool(request.POST.get("ativo"))

    if request.POST.get("remover_foto") and produto.foto:
        produto.foto.delete(save=False)
        produto.foto = None
    if request.FILES.get("foto"):
        produto.foto = request.FILES["foto"]

    produto.save()
    return True


@login_required
def produto_novo(request):
    if request.method == "POST":
        produto = ProdutoPedido()
        if _salvar_produto(request, produto):
            messages.success(request, "Item de venda cadastrado com sucesso.")
            return redirect("produtos")

    return render(
        request,
        "workspace/produto_form.html",
        {"produto": None, "categoria_choices": ProdutoPedido.CATEGORIA_CHOICES},
    )


@login_required
def produto_editar(request, produto_id):
    produto = get_object_or_404(ProdutoPedido, id=produto_id)
    if request.method == "POST":
        if _salvar_produto(request, produto):
            messages.success(request, "Item de venda atualizado com sucesso.")
            return redirect("produtos")

    return render(
        request,
        "workspace/produto_form.html",
        {"produto": produto, "categoria_choices": ProdutoPedido.CATEGORIA_CHOICES},
    )


# ---------------------------------------------------------------------------
# Configuracoes
# ---------------------------------------------------------------------------

@login_required
def configuracoes(request):
    configuracao = ConfiguracaoLoja.obter()

    if request.method == "POST":
        quantidade = _inteiro(request.POST.get("quantidade_mesas"), configuracao.quantidade_mesas)
        if quantidade < ConfiguracaoLoja.MIN_MESAS or quantidade > ConfiguracaoLoja.MAX_MESAS:
            messages.error(
                request,
                f"A quantidade de mesas deve ficar entre {ConfiguracaoLoja.MIN_MESAS} e {ConfiguracaoLoja.MAX_MESAS}.",
            )
        else:
            maior_ocupada = max(vendas.comandas_abertas().values_list("mesa_numero", flat=True), default=0)
            if quantidade < maior_ocupada:
                messages.error(
                    request,
                    f"A {nome_mesa(maior_ocupada)} esta em uso. Feche ou transfira a comanda antes de reduzir as mesas.",
                )
            else:
                configuracao.quantidade_mesas = quantidade
                configuracao.save(update_fields=["quantidade_mesas", "atualizado_em"])
                messages.success(request, f"Configuracao salva: {quantidade} mesa(s).")
                return redirect("configuracoes")

    return render(
        request,
        "workspace/configuracoes.html",
        {
            "configuracao": configuracao,
            "min_mesas": ConfiguracaoLoja.MIN_MESAS,
            "max_mesas": ConfiguracaoLoja.MAX_MESAS,
        },
    )
