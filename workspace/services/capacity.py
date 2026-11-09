from decimal import Decimal, InvalidOperation
from io import BytesIO
import re
import unicodedata

from django.contrib.auth import get_user_model
from django.db import transaction
from openpyxl import load_workbook

from customauth.models import Carteira
from workspace.models import Capacity


def normalizar_texto(valor):
    texto = ' '.join(str(valor or '').split()).casefold()
    return ''.join(
        caractere
        for caractere in unicodedata.normalize('NFKD', texto)
        if not unicodedata.combining(caractere)
    )


def converter_decimal_capacity(valor, *, linha, coluna):
    if valor in (None, ''):
        return Decimal('0.00')
    if isinstance(valor, (int, float, Decimal)):
        return Decimal(str(valor)).quantize(Decimal('0.01'))

    texto = str(valor).strip().replace('R$', '').replace(' ', '')
    if texto in {'', '-', '–', '—'}:
        return Decimal('0.00')
    if ',' in texto and '.' in texto:
        texto = texto.replace('.', '').replace(',', '.')
    elif ',' in texto:
        texto = texto.replace(',', '.')
    texto = re.sub(r'[^0-9.-]', '', texto)

    try:
        return Decimal(texto).quantize(Decimal('0.01'))
    except InvalidOperation as exc:
        raise ValueError(
            f'Valor inválido na linha {linha}, coluna {coluna}: {valor!r}.'
        ) from exc


def _encontrar_cabecalho(planilha):
    for numero_linha, valores in enumerate(
        planilha.iter_rows(min_row=1, max_row=20, max_col=20, values_only=True),
        start=1,
    ):
        cabecalhos = [normalizar_texto(valor) for valor in valores]
        if (
            any('carteira' in item for item in cabecalhos)
            and any('budget' in item and 'saldo' not in item for item in cabecalhos)
            and any('sup' in item or 'responsavel' in item for item in cabecalhos)
        ):
            return numero_linha, valores, cabecalhos
    raise ValueError('Não foi possível identificar o cabeçalho da planilha.')


def _indice_coluna(cabecalhos, teste):
    return next(
        (indice for indice, cabecalho in enumerate(cabecalhos) if teste(cabecalho)),
        None,
    )


def ler_planilha_capacity(arquivo):
    conteudo = arquivo.read()
    try:
        workbook = load_workbook(BytesIO(conteudo), read_only=True, data_only=True)
    except Exception as exc:
        raise ValueError('O arquivo enviado não é uma planilha XLSX válida.') from exc

    try:
        planilha = workbook[workbook.sheetnames[0]]
        linha_cabecalho, _, cabecalhos = _encontrar_cabecalho(planilha)
        responsavel_idx = _indice_coluna(
            cabecalhos,
            lambda item: 'sup' in item or 'responsavel' in item,
        )
        carteira_idx = _indice_coluna(cabecalhos, lambda item: 'carteira' in item)
        budget_idx = _indice_coluna(
            cabecalhos,
            lambda item: 'budget' in item and 'saldo' not in item,
        )
        gordura_idx = _indice_coluna(
            cabecalhos,
            lambda item: 'gordura' in item and 'saldo' not in item,
        )
        saldo_idx = _indice_coluna(
            cabecalhos,
            lambda item: 'saldo' in item and 'gordura' not in item,
        )
        atual_idx = None
        if gordura_idx is not None and saldo_idx is not None:
            candidatos = range(gordura_idx + 1, saldo_idx)
            atual_idx = next(iter(candidatos), None)
        if atual_idx is None:
            atual_idx = _indice_coluna(
                cabecalhos,
                lambda item: 'atual' in item or 'realizado' in item,
            )

        obrigatorias = {
            'responsável': responsavel_idx,
            'carteira': carteira_idx,
            'budget': budget_idx,
            'capacity atual': atual_idx,
        }
        ausentes = [nome for nome, indice in obrigatorias.items() if indice is None]
        if ausentes:
            raise ValueError('Colunas obrigatórias ausentes: ' + ', '.join(ausentes) + '.')

        registros = []
        vistos = {}
        ultima_coluna = max(
            indice
            for indice in (responsavel_idx, carteira_idx, budget_idx, gordura_idx, atual_idx)
            if indice is not None
        ) + 1
        for numero_linha, valores in enumerate(
            planilha.iter_rows(
                min_row=linha_cabecalho + 1,
                max_col=ultima_coluna,
                values_only=True,
            ),
            start=linha_cabecalho + 1,
        ):
            carteira = ' '.join(str(valores[carteira_idx] or '').split())
            if not carteira or normalizar_texto(carteira).startswith('total'):
                continue
            chave = normalizar_texto(carteira)
            registro = {
                'linha': numero_linha,
                'responsavel': ' '.join(str(valores[responsavel_idx] or '').split()),
                'carteira': carteira,
                'budget': converter_decimal_capacity(
                    valores[budget_idx],
                    linha=numero_linha,
                    coluna='Budget aprovado pela diretoria',
                ),
                'gordura': converter_decimal_capacity(
                    valores[gordura_idx] if gordura_idx is not None else 0,
                    linha=numero_linha,
                    coluna='Gordura',
                ),
                'budget_atual': converter_decimal_capacity(
                    valores[atual_idx], linha=numero_linha, coluna='Budget atual'
                ),
            }

            if chave in vistos:
                anterior = vistos[chave]
                if normalizar_texto(anterior['responsavel']) != normalizar_texto(registro['responsavel']):
                    raise ValueError(
                        f'Carteira repetida com responsáveis diferentes: {carteira} '
                        f'(linha {numero_linha}).'
                    )
                for campo in ('budget', 'gordura', 'budget_atual'):
                    anterior[campo] += registro[campo]
                continue

            vistos[chave] = registro
            registros.append(registro)
        if not registros:
            raise ValueError('A planilha não contém nenhuma carteira válida.')
        return registros
    finally:
        workbook.close()


def _resolver_usuario(nome_informado, usuarios):
    procurado = normalizar_texto(nome_informado)
    if not procurado:
        return None

    candidatos_exatos = []
    candidatos_prefixo = []
    for usuario in usuarios:
        nomes = {
            normalizar_texto(usuario.username),
            normalizar_texto(usuario.nome),
            normalizar_texto(usuario.get_full_name()),
        }
        nomes.discard('')
        if procurado in nomes:
            candidatos_exatos.append(usuario)
        elif any(nome.startswith(procurado + ' ') for nome in nomes):
            candidatos_prefixo.append(usuario)

    if len(candidatos_exatos) == 1:
        return candidatos_exatos[0]
    if not candidatos_exatos and len(candidatos_prefixo) == 1:
        return candidatos_prefixo[0]
    return None


@transaction.atomic
def importar_capacity_mensal(arquivo, competencia):
    registros = ler_planilha_capacity(arquivo)
    carteiras = {}
    for carteira in Carteira.objects.all():
        carteiras.setdefault(normalizar_texto(carteira.nome), []).append(carteira)
    usuarios = list(get_user_model().objects.filter(is_active=True))
    carteiras_nao_vinculadas = set()
    responsaveis_nao_vinculados = set()

    criados = 0
    atualizados = 0
    for registro in registros:
        candidatas_carteira = carteiras.get(normalizar_texto(registro['carteira']), [])
        carteira = candidatas_carteira[0] if len(candidatas_carteira) == 1 else None
        responsavel = _resolver_usuario(registro['responsavel'], usuarios)
        if carteira is None:
            carteiras_nao_vinculadas.add(registro['carteira'])
        if responsavel is None:
            responsaveis_nao_vinculados.add(registro['responsavel'])

        _, criado = Capacity.objects.update_or_create(
            carteira_nome=registro['carteira'],
            competencia=competencia,
            defaults={
                'carteira': carteira,
                'responsavel_nome': registro['responsavel'],
                'supervisor_operacional': responsavel,
                'budget': registro['budget'],
                'gordura': registro['gordura'],
                'budget_atual': registro['budget_atual'],
            },
        )
        criados += int(criado)
        atualizados += int(not criado)

    return {
        'criados': criados,
        'atualizados': atualizados,
        'total': len(registros),
        'carteiras_nao_vinculadas': sorted(carteiras_nao_vinculadas),
        'responsaveis_nao_vinculados': sorted(responsaveis_nao_vinculados),
    }
