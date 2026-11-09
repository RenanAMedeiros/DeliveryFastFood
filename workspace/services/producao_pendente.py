from datetime import timedelta

from django.utils import timezone

from customauth.models import Carteira
from workspace.constants import (
    DATA_INICIO_PRODUCAO,
    JANELA_RETROATIVA_DIAS,
)
from workspace.models import ProducaoCarteira


def obter_producao_pendente(data_inicio=None, data_fim=None):
    """
    Retorna as carteiras que não possuem produção registrada
    nas datas úteis dentro do período informado.

    Sem `data_inicio`/`data_fim`, usa a janela padrão retroativa
    (JANELA_RETROATIVA_DIAS) a partir de hoje — mesmo comportamento
    de sempre. Quando o usuário informa um período pela tela (filtro
    de data início/fim), ele é respeitado, sempre limitado a
    DATA_INICIO_PRODUCAO (não há produção registrada antes disso) e
    a hoje (não faz sentido consultar o futuro).

    Esta função é utilizada tanto pela página HTML quanto pela
    task responsável pelo envio do e-mail.
    """

    agora = timezone.localtime()
    hoje = timezone.localdate()

    periodo_personalizado = bool(data_inicio or data_fim)

    data_fim_efetiva = min(data_fim, hoje) if data_fim else hoje

    if data_inicio:
        data_inicio_efetiva = max(DATA_INICIO_PRODUCAO, data_inicio)
    else:
        limite_retroativo = hoje - timedelta(
            days=JANELA_RETROATIVA_DIAS
        )

        data_inicio_efetiva = max(
            DATA_INICIO_PRODUCAO,
            limite_retroativo,
        )

    if data_inicio_efetiva > data_fim_efetiva:
        data_inicio_efetiva = data_fim_efetiva

    datas_uteis = []
    data_atual = data_inicio_efetiva

    while data_atual <= data_fim_efetiva:
        if data_atual.weekday() < 5:
            datas_uteis.append(data_atual)

        data_atual += timedelta(days=1)

    if not datas_uteis:
        return {
            "agora": agora,
            "hoje": hoje,
            "data_inicio": data_inicio_efetiva,
            "data_fim": data_fim_efetiva,
            "janela_retroativa_dias": JANELA_RETROATIVA_DIAS,
            "periodo_personalizado": periodo_personalizado,
            "carteiras": [],
            "total_carteiras": 0,
            "total_datas_pendentes": 0,
            "maior_pendencia": 0,
        }

    carteiras = list(
        Carteira.objects
        .all()
        .only("id", "nome")
        .order_by("nome")
    )

    producoes_enviadas = set(
        ProducaoCarteira.objects.filter(
            data_producao__in=datas_uteis
        ).values_list(
            "carteira_id",
            "data_producao",
        )
    )

    carteiras_pendentes = []

    for carteira in carteiras:
        datas_faltando = sorted(
            data
            for data in datas_uteis
            if (
                carteira.pk,
                data,
            ) not in producoes_enviadas
        )

        if not datas_faltando:
            continue

        carteiras_pendentes.append({
            "id": carteira.pk,
            "nome": carteira.nome,
            "qtd_pendente": len(datas_faltando),
            "datas_pendentes": datas_faltando,
            "primeira_data_pendente": datas_faltando[0],
            "ultima_data_pendente": datas_faltando[-1],
        })

    total_datas_pendentes = sum(
        item["qtd_pendente"]
        for item in carteiras_pendentes
    )

    maior_pendencia = max(
        (
            item["qtd_pendente"]
            for item in carteiras_pendentes
        ),
        default=0,
    )

    return {
        "agora": agora,
        "hoje": hoje,
        "data_inicio": data_inicio_efetiva,
        "data_fim": data_fim_efetiva,
        "janela_retroativa_dias": JANELA_RETROATIVA_DIAS,
        "periodo_personalizado": periodo_personalizado,
        "carteiras": carteiras_pendentes,
        "total_carteiras": len(carteiras_pendentes),
        "total_datas_pendentes": total_datas_pendentes,
        "maior_pendencia": maior_pendencia,
    }