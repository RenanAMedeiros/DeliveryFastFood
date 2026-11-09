from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.urls import reverse
from django.utils import timezone


class ClientePedido(models.Model):
    TIPO_PESSOA_FISICA = "fisica"
    TIPO_PESSOA_JURIDICA = "juridica"
    TIPO_PESSOA_CHOICES = [
        (TIPO_PESSOA_FISICA, "Pessoa fisica"),
        (TIPO_PESSOA_JURIDICA, "Pessoa juridica"),
    ]

    nome = models.CharField(max_length=180, db_index=True)
    tipo_pessoa = models.CharField(max_length=20, choices=TIPO_PESSOA_CHOICES, default=TIPO_PESSOA_FISICA)
    documento = models.CharField(max_length=20, blank=True, default="", db_index=True)
    email = models.EmailField(blank=True, default="")
    telefone = models.CharField(max_length=30, blank=True, default="")
    endereco = models.CharField(max_length=255, blank=True, default="")
    ativo = models.BooleanField(default=True, db_index=True)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Cliente"
        verbose_name_plural = "Clientes"
        ordering = ["nome"]

    def __str__(self):
        return self.nome


class ProdutoPedido(models.Model):
    CATEGORIA_LANCHE = "lanche"
    CATEGORIA_BEBIDA = "bebida"
    CATEGORIA_SOBREMESA = "sobremesa"
    CATEGORIA_COMBO = "combo"
    CATEGORIA_OUTROS = "outros"
    CATEGORIA_CHOICES = [
        (CATEGORIA_LANCHE, "Lanche"),
        (CATEGORIA_BEBIDA, "Bebida"),
        (CATEGORIA_SOBREMESA, "Sobremesa"),
        (CATEGORIA_COMBO, "Combo"),
        (CATEGORIA_OUTROS, "Outros"),
    ]

    nome = models.CharField(max_length=180, db_index=True)
    sku = models.CharField("SKU/codigo", max_length=50, blank=True, default="", db_index=True)
    categoria = models.CharField(max_length=30, choices=CATEGORIA_CHOICES, default=CATEGORIA_OUTROS, db_index=True)
    descricao = models.TextField(blank=True, default="")
    foto = models.ImageField(upload_to="produtos/", blank=True, null=True)
    preco_unitario = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    tempo_preparo_minutos = models.PositiveIntegerField(default=0)
    ativo = models.BooleanField(default=True, db_index=True)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Produto/servico"
        verbose_name_plural = "Produtos/servicos"
        ordering = ["nome"]

    def __str__(self):
        return self.nome


class Pedido(models.Model):
    CANAL_BALCAO = "balcao"
    CANAL_RETIRADA = "retirada"
    CANAL_DELIVERY = "delivery"
    CANAL_WHATSAPP = "whatsapp"
    CANAL_IFOOD = "ifood"
    CANAL_TELEFONE = "telefone"
    CANAL_CHOICES = [
        (CANAL_BALCAO, "Balcao"),
        (CANAL_RETIRADA, "Retirada"),
        (CANAL_DELIVERY, "Delivery"),
        (CANAL_WHATSAPP, "WhatsApp"),
        (CANAL_IFOOD, "iFood"),
        (CANAL_TELEFONE, "Telefone"),
    ]

    STATUS_RASCUNHO = "rascunho"
    STATUS_AGUARDANDO_PAGAMENTO = "aguardando_pagamento"
    STATUS_ABERTO = "novo"
    STATUS_EM_SEPARACAO = "em_preparo"
    STATUS_PRONTO = "pronto"
    STATUS_EM_ENTREGA = "em_entrega"
    STATUS_FATURADO = STATUS_PRONTO
    STATUS_ENVIADO = STATUS_EM_ENTREGA
    STATUS_ENTREGUE = "entregue"
    STATUS_CANCELADO = "cancelado"
    STATUS_CHOICES = [
        (STATUS_RASCUNHO, "Rascunho"),
        (STATUS_AGUARDANDO_PAGAMENTO, "Aguardando pagamento"),
        (STATUS_ABERTO, "Novo"),
        (STATUS_EM_SEPARACAO, "Em preparo"),
        (STATUS_PRONTO, "Pronto"),
        (STATUS_EM_ENTREGA, "Saiu para entrega"),
        (STATUS_ENTREGUE, "Entregue"),
        (STATUS_CANCELADO, "Cancelado"),
    ]

    FORMA_PIX = "pix"
    FORMA_DINHEIRO = "dinheiro"
    FORMA_DEBITO = "debito"
    FORMA_CREDITO = "credito"
    FORMA_OUTRO = "outro"
    FORMA_PAGAMENTO_CHOICES = [
        (FORMA_PIX, "Pix"),
        (FORMA_DINHEIRO, "Dinheiro"),
        (FORMA_DEBITO, "Debito"),
        (FORMA_CREDITO, "Credito"),
        (FORMA_OUTRO, "Outro"),
    ]

    PRIORIDADE_BAIXA = "baixa"
    PRIORIDADE_NORMAL = "normal"
    PRIORIDADE_ALTA = "alta"
    PRIORIDADE_URGENTE = "urgente"
    PRIORIDADE_CHOICES = [
        (PRIORIDADE_BAIXA, "Baixa"),
        (PRIORIDADE_NORMAL, "Normal"),
        (PRIORIDADE_ALTA, "Alta"),
        (PRIORIDADE_URGENTE, "Urgente"),
    ]

    codigo = models.CharField(max_length=30, unique=True, db_index=True)
    codigo_externo = models.CharField("Codigo iFood/app", max_length=80, blank=True, default="", db_index=True)
    canal = models.CharField(max_length=20, choices=CANAL_CHOICES, default=CANAL_IFOOD, db_index=True)
    cliente = models.ForeignKey(ClientePedido, on_delete=models.PROTECT, related_name="pedidos")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_ABERTO, db_index=True)
    prioridade = models.CharField(max_length=20, choices=PRIORIDADE_CHOICES, default=PRIORIDADE_NORMAL, db_index=True)
    data_pedido = models.DateField(default=timezone.localdate, db_index=True)
    previsao_entrega = models.DateField(null=True, blank=True, db_index=True)
    responsavel = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pedidos_responsaveis",
    )
    observacoes = models.TextField(blank=True, default="")
    endereco_entrega = models.CharField(max_length=255, blank=True, default="")
    taxa_entrega = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    desconto_pedido = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    forma_pagamento = models.CharField(max_length=20, choices=FORMA_PAGAMENTO_CHOICES, default=FORMA_PIX, db_index=True)
    valor_recebido = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    entregador = models.CharField(max_length=120, blank=True, default="")
    criado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pedidos_criados",
    )
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Pedido"
        verbose_name_plural = "Pedidos"
        ordering = ["-data_pedido", "-id"]
        indexes = [
            models.Index(fields=["status", "previsao_entrega"], name="idx_pedido_status_prazo"),
            models.Index(fields=["cliente", "data_pedido"], name="idx_pedido_cliente_data"),
        ]

    @property
    def subtotal(self):
        return sum((item.subtotal for item in self.itens.all()), Decimal("0.00"))

    @property
    def total(self):
        return max(self.subtotal + self.taxa_entrega - self.desconto_pedido, Decimal("0.00"))

    @property
    def troco(self):
        if self.forma_pagamento != self.FORMA_DINHEIRO:
            return Decimal("0.00")
        return max(self.valor_recebido - self.total, Decimal("0.00"))

    @property
    def atrasado(self):
        return (
            self.status not in {self.STATUS_ENTREGUE, self.STATUS_CANCELADO}
            and self.previsao_entrega
            and self.previsao_entrega < timezone.localdate()
        )

    def get_absolute_url(self):
        return reverse("pedido_detalhe", kwargs={"pedido_id": self.id})

    def __str__(self):
        return f"{self.codigo} - {self.cliente}"


class ItemPedido(models.Model):
    pedido = models.ForeignKey(Pedido, on_delete=models.CASCADE, related_name="itens")
    produto = models.ForeignKey(ProdutoPedido, on_delete=models.PROTECT, related_name="itens_pedido")
    quantidade = models.PositiveIntegerField(default=1)
    valor_unitario = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    desconto = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    observacoes = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        verbose_name = "Item do pedido"
        verbose_name_plural = "Itens do pedido"
        ordering = ["id"]

    @property
    def subtotal(self):
        return max((self.valor_unitario * self.quantidade) - self.desconto, Decimal("0.00"))

    def clean(self):
        if self.desconto < 0:
            raise ValidationError({"desconto": "O desconto nao pode ser negativo."})
        if self.valor_unitario < 0:
            raise ValidationError({"valor_unitario": "O valor unitario nao pode ser negativo."})

    def save(self, *args, **kwargs):
        if self.produto_id and not self.valor_unitario:
            self.valor_unitario = self.produto.preco_unitario
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.pedido.codigo} - {self.produto.nome}"


class HistoricoPedido(models.Model):
    pedido = models.ForeignKey(Pedido, on_delete=models.CASCADE, related_name="historico")
    status_anterior = models.CharField(max_length=20, blank=True, default="")
    status_novo = models.CharField(max_length=20, blank=True, default="")
    descricao = models.CharField(max_length=255, blank=True, default="")
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="historicos_pedidos",
    )
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Historico do pedido"
        verbose_name_plural = "Historico dos pedidos"
        ordering = ["-criado_em"]

    def __str__(self):
        return f"{self.pedido.codigo} - {self.status_novo}"
