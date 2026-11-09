from django.contrib import admin
from unfold.admin import ModelAdmin as UnfoldModelAdmin, TabularInline

from workspace.models import ClientePedido, HistoricoPedido, ItemPedido, Pedido, ProdutoPedido


@admin.register(ClientePedido)
class ClientePedidoAdmin(UnfoldModelAdmin):
    list_display = ("nome", "tipo_pessoa", "documento", "email", "telefone", "ativo")
    list_filter = ("tipo_pessoa", "ativo")
    search_fields = ("nome", "documento", "email", "telefone")


@admin.register(ProdutoPedido)
class ProdutoPedidoAdmin(UnfoldModelAdmin):
    list_display = ("nome", "categoria", "sku", "preco_unitario", "tempo_preparo_minutos", "ativo")
    list_filter = ("categoria", "ativo")
    search_fields = ("nome", "sku", "descricao")


class ItemPedidoInline(TabularInline):
    model = ItemPedido
    extra = 1
    autocomplete_fields = ("produto",)
    readonly_fields = ("subtotal",)


class HistoricoPedidoInline(TabularInline):
    model = HistoricoPedido
    extra = 0
    can_delete = False
    readonly_fields = ("status_anterior", "status_novo", "descricao", "usuario", "criado_em")

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Pedido)
class PedidoAdmin(UnfoldModelAdmin):
    list_display = (
        "codigo",
        "canal",
        "codigo_externo",
        "cliente",
        "status",
        "prioridade",
        "data_pedido",
        "previsao_entrega",
        "forma_pagamento",
        "responsavel",
        "total",
    )
    list_filter = ("canal", "status", "forma_pagamento", "prioridade", "data_pedido", "previsao_entrega")
    search_fields = ("codigo", "codigo_externo", "cliente__nome", "cliente__documento", "observacoes")
    autocomplete_fields = ("cliente", "responsavel")
    readonly_fields = ("criado_por", "criado_em", "atualizado_em", "total")
    date_hierarchy = "data_pedido"
    inlines = [ItemPedidoInline, HistoricoPedidoInline]

    def save_model(self, request, obj, form, change):
        status_anterior = ""
        if change:
            status_anterior = Pedido.objects.filter(pk=obj.pk).values_list("status", flat=True).first() or ""
        elif not obj.criado_por:
            obj.criado_por = request.user

        super().save_model(request, obj, form, change)

        if not change or status_anterior != obj.status:
            HistoricoPedido.objects.create(
                pedido=obj,
                status_anterior=status_anterior,
                status_novo=obj.status,
                descricao="Alteracao feita pelo admin" if change else "Pedido criado pelo admin",
                usuario=request.user,
            )


@admin.register(HistoricoPedido)
class HistoricoPedidoAdmin(UnfoldModelAdmin):
    list_display = ("pedido", "status_anterior", "status_novo", "usuario", "criado_em")
    list_filter = ("status_novo", "criado_em")
    search_fields = ("pedido__codigo", "pedido__cliente__nome", "descricao")
    readonly_fields = ("pedido", "status_anterior", "status_novo", "descricao", "usuario", "criado_em")

    def has_add_permission(self, request):
        return False
