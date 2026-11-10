"""Cadastra o cardapio inicial da loja (itens que ainda nao existem)."""

from decimal import Decimal

from django.core.management.base import BaseCommand

from workspace.models import ProdutoPedido


CARDAPIO = [
    ("Adicional de fruta para caldo de cana", "outros", "2.00", "Adicional de fruta para acompanhar o caldo de cana."),
    ("Caldo de cana - 1 litro", "bebida", "25.00", "Caldo de cana de 1 litro. Adicional de fruta vendido separadamente."),
    ("Caldo de cana - 500 ml", "bebida", "15.00", "Caldo de cana de 500 ml. Adicional de fruta vendido separadamente."),
    ("Cerveja Amstel", "bebida", "6.00", "Bebida do cardapio Shinchan."),
    ("Cerveja Original", "bebida", "6.00", "Bebida do cardapio Shinchan."),
    ("Cerveja Skol", "bebida", "6.00", "Bebida do cardapio Shinchan."),
    ("Coca-Cola", "bebida", "8.00", "Bebida do cardapio Shinchan."),
    ("Fanta laranja", "bebida", "8.00", "Bebida do cardapio Shinchan."),
    ("Fanta uva", "bebida", "8.00", "Bebida do cardapio Shinchan."),
    ("Hot roll de salmão - 8 peças", "lanche", "20.00", "Hot roll de salmão empanado, 8 peças."),
    ("Onigiri - Atum", "lanche", "18.00", "Bolinho de arroz japonês recheado com atum."),
    ("Onigiri - Camarão", "lanche", "18.00", "Bolinho de arroz japonês recheado com camarão."),
    ("Onigiri - Frango", "lanche", "18.00", "Bolinho de arroz japonês recheado com frango."),
    ("Onigiri - Porco", "lanche", "18.00", "Bolinho de arroz japonês recheado com porco."),
    ("Onigiri - Salmão", "lanche", "18.00", "Bolinho de arroz japonês recheado com salmão."),
]


class Command(BaseCommand):
    help = "Cadastra o cardapio inicial da loja sem duplicar itens existentes."

    def handle(self, *args, **options):
        criados = 0
        for nome, categoria, preco, descricao in CARDAPIO:
            _, criado = ProdutoPedido.objects.get_or_create(
                nome=nome,
                defaults={
                    "categoria": categoria,
                    "preco_unitario": Decimal(preco),
                    "descricao": descricao,
                    "ativo": True,
                },
            )
            criados += int(criado)
        self.stdout.write(self.style.SUCCESS(f"{criados} item(ns) criado(s); {len(CARDAPIO) - criados} ja existiam."))
