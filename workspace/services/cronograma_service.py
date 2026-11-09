from datetime import timedelta
from decimal import Decimal

from django.db import transaction

from workspace.models import (
    CalendarioUtil,
    Projeto,
    ProjetoCronogramaEtapaModelo,
    ProjetoCronogramaModelo,
    ProjetoCronogramaSubtarefaModelo,
    ProjetoCronogramaTarefaModelo,
    ProjetoEtapa,
    ProjetoEtapaTipo,
    ProjetoHistorico,
    ProjetoHistoricoAcao,
    ProjetoHistoricoEntidade,
    ProjetoMetodologia,
    ProjetoMomento,
    ProjetoTarefa,
    ProjetoTarefaCategoria,
    ProjetoTarefaChecklist,
    ProjetoTarefaStatus,
    ProjetoTarefaTipo,
)
from workspace.services.projeto_cronograma_modelos_data import (
    MODELOS_CRONOGRAMA_PADRAO,
)


# ============================================================
# CRONOGRAMA — REGRAS DE DATA EXISTENTES
# ============================================================
# Nesta etapa, mantemos as funções atuais de dia útil.
# A parametrização de duração/prazo por tarefa/sprint será feita
# na próxima etapa, antes do dashboard detalhado.
# ============================================================


def _dias_uteis_calendario(data_base, quantidade):
    return list(
        CalendarioUtil.objects.filter(
            data__gte=data_base,
            dia_util=True,
        )
        .order_by("data")
        .values_list("data", flat=True)[:quantidade]
    )


def _proximo_dia_util_fallback(data_base):
    data = data_base
    while data.weekday() >= 5:
        data += timedelta(days=1)
    return data


def somar_dias_uteis(data_base, quantidade):
    """
    Soma dias úteis a partir de uma data livre.

    Usa o CalendarioUtil sempre que existir informação para o dia (inclusive
    feriados) e, fora da cobertura cadastrada, continua por segunda a sexta.
    """

    if data_base is None:
        return None

    quantidade = max(0, int(quantidade or 0))
    janela_fim = data_base + timedelta(days=max(3700, (quantidade + 1) * 2))
    mapa = _mapa_calendario_util(data_base, janela_fim)

    data = data_base
    while not _data_e_util(data, mapa):
        data += timedelta(days=1)

    avancados = 0
    while avancados < quantidade:
        data += timedelta(days=1)
        if _data_e_util(data, mapa):
            avancados += 1

    return data


def calcular_fim_por_duracao(data_inicio, duracao_dias_uteis):
    if not data_inicio:
        return None
    duracao = max(1, int(duracao_dias_uteis or 1))
    return somar_dias_uteis(data_inicio, duracao - 1)


def _mapa_calendario_util(data_inicio, data_fim):
    """Retorna {data: dia_util} para o trecho coberto pelo calendário corporativo."""

    if not data_inicio or not data_fim or data_fim < data_inicio:
        return {}

    return {
        data: bool(dia_util)
        for data, dia_util in CalendarioUtil.objects.filter(
            data__gte=data_inicio,
            data__lte=data_fim,
        ).values_list("data", "dia_util")
    }


def _data_e_util(data, mapa_calendario=None):
    """Usa o calendário corporativo quando houver linha; fora dele, usa seg-sex."""

    if data is None:
        return False
    mapa_calendario = mapa_calendario or {}
    if data in mapa_calendario:
        return bool(mapa_calendario[data])
    return data.weekday() < 5


def _dias_uteis_intervalo(data_inicio, data_fim):
    """Lista dias úteis inclusivos, tolerando datas fora da cobertura cadastrada."""

    if not data_inicio or not data_fim or data_fim < data_inicio:
        return []

    mapa = _mapa_calendario_util(data_inicio, data_fim)
    datas = []
    atual = data_inicio
    while atual <= data_fim:
        if _data_e_util(atual, mapa):
            datas.append(atual)
        atual += timedelta(days=1)
    return datas


def dias_uteis_planejamento(data_inicio, quantidade):
    """
    Retorna os dias úteis usados no planejamento.

    A data de início é livre: pode ser anterior/posterior à data atualmente
    gravada e também pode cair fora da cobertura do CalendarioUtil. Quando a
    data existir no calendário corporativo, feriados e dias não úteis são
    respeitados. Fora da cobertura cadastrada, o cálculo continua por seg-sex
    para não bloquear o replanejamento do cronograma.
    """

    if not data_inicio:
        raise ValueError("Informe a data de início do projeto.")

    try:
        quantidade = int(quantidade)
    except (TypeError, ValueError):
        raise ValueError("Informe uma quantidade válida de dias úteis.")

    if quantidade < 1:
        raise ValueError("A duração do projeto deve ter ao menos 1 dia útil.")
    if quantidade > 2600:
        raise ValueError("A duração do projeto não pode ultrapassar 2.600 dias úteis.")

    # Consulta uma janela ampla de uma vez para respeitar feriados existentes
    # sem obrigar que todo o período esteja previamente cadastrado. 2.600 dias
    # úteis cabem com folga em ~3.700 dias corridos.
    janela_fim = data_inicio + timedelta(days=max(3700, quantidade * 2))
    mapa = _mapa_calendario_util(data_inicio, janela_fim)

    datas = []
    atual = data_inicio
    limite_seguranca = data_inicio + timedelta(days=max(5000, quantidade * 3))

    while len(datas) < quantidade and atual <= limite_seguranca:
        if _data_e_util(atual, mapa):
            datas.append(atual)
        atual += timedelta(days=1)

    if len(datas) != quantidade:
        raise ValueError(
            "Não foi possível calcular a duração informada em dias úteis."
        )

    return datas


def _faixa_proporcional(total_dias, indice, total_itens):
    """Divide um período em faixas ordenadas, permitindo sobreposição curta."""

    inicio = (indice * total_dias) // total_itens
    fim_exclusivo = ((indice + 1) * total_dias + total_itens - 1) // total_itens
    fim = max(inicio, fim_exclusivo - 1)
    limite = total_dias - 1
    return min(inicio, limite), min(fim, limite)


def _datas_momentos_planejamento(etapas):
    homologacoes = [
        item.get("data_inicio")
        for item in etapas
        if item.get("momento") == ProjetoMomento.HOMOLOGACAO and item.get("data_inicio")
    ]
    encerramentos = [
        item.get("data_inicio")
        for item in etapas
        if item.get("momento") == ProjetoMomento.ENCERRAMENTO and item.get("data_inicio")
    ]
    return {
        "data_homologacao_prevista": min(homologacoes) if homologacoes else None,
        "data_go_live_prevista": min(encerramentos) if encerramentos else None,
    }


def datas_referencia_cronograma_projeto(projeto):
    etapas = list(
        projeto.etapas.filter(ativo=True)
        .select_related("fase_pai")
        .order_by("ordem", "id")
    )
    homologacoes = [
        etapa.data_inicio
        for etapa in etapas
        if etapa.momento == ProjetoMomento.HOMOLOGACAO and etapa.data_inicio
    ]
    encerramentos = [
        etapa.data_inicio
        for etapa in etapas
        if etapa.momento == ProjetoMomento.ENCERRAMENTO and etapa.data_inicio
    ]
    return {
        "data_homologacao_cronograma": min(homologacoes) if homologacoes else None,
        "data_go_live_cronograma": min(encerramentos) if encerramentos else None,
    }


def planejar_cronograma_modelo(data_inicio, duracao_dias_uteis, modelo=None):
    """
    Calcula o cronograma respeitando a hierarquia real da metodologia.

    - Ágil: Sprint → Tarefa → Subtarefa
    - Waterfall: Fase → Tarefa → Subtarefa

    O suporte a vínculo pai/filho permanece apenas para compatibilidade histórica;
    os novos cronogramas trabalham com um único nível executor: Sprint ou Fase.
    """
    dias = dias_uteis_planejamento(data_inicio, duracao_dias_uteis)
    planejamento = {
        "data_inicio_solicitada": data_inicio,
        "data_inicio_efetiva": dias[0],
        "data_fim_prevista": dias[-1],
        "duracao_dias_uteis": len(dias),
        "etapas": [],
    }
    if not modelo:
        return planejamento

    etapas = list(
        modelo.etapas.select_related("fase_pai")
        .prefetch_related("tarefas")
        .order_by("ordem", "id")
    )
    if not etapas:
        return planejamento

    filhos_por_pai = {}
    tarefas_por_etapa = {}
    for etapa in etapas:
        filhos_por_pai.setdefault(etapa.fase_pai_id, []).append(etapa)
        tarefas_por_etapa[etapa.id] = list(etapa.tarefas.order_by("ordem", "id"))

    # Apenas etapas de execução recebem uma fração direta da duração.
    # Vínculos pai/filho legados são consolidados sem interferir nos novos modelos.
    executoras = [
        etapa for etapa in etapas
        if tarefas_por_etapa.get(etapa.id) or not filhos_por_pai.get(etapa.id)
    ]
    if not executoras:
        executoras = etapas[:]

    planejadas = {}
    for indice_etapa, etapa in enumerate(executoras):
        inicio_idx, fim_idx = _faixa_proporcional(
            len(dias), indice_etapa, len(executoras)
        )
        dias_etapa = dias[inicio_idx : fim_idx + 1] or [dias[inicio_idx]]
        tarefas = tarefas_por_etapa.get(etapa.id, [])
        tarefas_planejadas = []

        for indice_tarefa, tarefa in enumerate(tarefas):
            tarefa_inicio_idx, tarefa_fim_idx = _faixa_proporcional(
                len(dias_etapa), indice_tarefa, len(tarefas)
            )
            data_inicio_tarefa = dias_etapa[tarefa_inicio_idx]
            data_fim_tarefa = dias_etapa[tarefa_fim_idx]
            if tarefa.tipo == ProjetoTarefaTipo.MARCO:
                data_fim_tarefa = data_inicio_tarefa
            tarefas_planejadas.append({
                "modelo_id": tarefa.id,
                "nome": tarefa.nome,
                "ordem": tarefa.ordem,
                "data_inicio": data_inicio_tarefa,
                "data_fim_prevista": data_fim_tarefa,
            })

        planejadas[etapa.id] = {
            "modelo_id": etapa.id,
            "fase_pai_modelo_id": etapa.fase_pai_id,
            "nome": etapa.nome,
            "descricao": etapa.descricao or "",
            "tipo": etapa.tipo,
            "tipo_nome": etapa.get_tipo_display(),
            "momento": etapa.momento,
            "momento_nome": etapa.get_momento_display(),
            "ordem": etapa.ordem,
            "data_inicio": dias_etapa[0],
            "data_fim_prevista": dias_etapa[-1],
            "tarefas": tarefas_planejadas,
        }

    # Consolida os agrupadores de baixo para cima. Hoje há apenas Fase→Sprint,
    # mas o algoritmo evita acoplamento a uma quantidade fixa de Sprints.
    for etapa in reversed(etapas):
        if etapa.id in planejadas:
            continue
        filhos = [planejadas.get(item.id) for item in filhos_por_pai.get(etapa.id, [])]
        filhos = [item for item in filhos if item]
        if filhos:
            inicio = min(item["data_inicio"] for item in filhos)
            fim = max(item["data_fim_prevista"] for item in filhos)
        else:
            inicio = somar_dias_uteis(data_inicio, etapa.offset_inicio_dias_uteis)
            fim = calcular_fim_por_duracao(inicio, etapa.duracao_dias_uteis)
        planejadas[etapa.id] = {
            "modelo_id": etapa.id,
            "fase_pai_modelo_id": etapa.fase_pai_id,
            "nome": etapa.nome,
            "descricao": etapa.descricao or "",
            "tipo": etapa.tipo,
            "tipo_nome": etapa.get_tipo_display(),
            "momento": etapa.momento,
            "momento_nome": etapa.get_momento_display(),
            "ordem": etapa.ordem,
            "data_inicio": inicio,
            "data_fim_prevista": fim,
            "tarefas": [],
        }

    planejamento["etapas"] = [planejadas[etapa.id] for etapa in etapas if etapa.id in planejadas]
    planejamento.update(_datas_momentos_planejamento(planejamento["etapas"]))
    return planejamento

def serializar_planejamento_cronograma(planejamento):
    def data_iso(valor):
        return valor.isoformat() if valor else None

    etapas = []
    for etapa in planejamento.get("etapas", []):
        etapas.append({
            **{
                chave: valor
                for chave, valor in etapa.items()
                if chave not in {"data_inicio", "data_fim_prevista", "tarefas"}
            },
            "data_inicio": data_iso(etapa.get("data_inicio")),
            "data_fim_prevista": data_iso(etapa.get("data_fim_prevista")),
            "tarefas": [
                {
                    **{
                        chave: valor
                        for chave, valor in tarefa.items()
                        if chave not in {"data_inicio", "data_fim_prevista"}
                    },
                    "data_inicio": data_iso(tarefa.get("data_inicio")),
                    "data_fim_prevista": data_iso(tarefa.get("data_fim_prevista")),
                }
                for tarefa in etapa.get("tarefas", [])
            ],
        })

    return {
        "data_inicio_solicitada": data_iso(planejamento["data_inicio_solicitada"]),
        "data_inicio_efetiva": data_iso(planejamento["data_inicio_efetiva"]),
        "data_fim_prevista": data_iso(planejamento["data_fim_prevista"]),
        "data_homologacao_prevista": data_iso(planejamento.get("data_homologacao_prevista")),
        "data_go_live_prevista": data_iso(planejamento.get("data_go_live_prevista")),
        "duracao_dias_uteis": planejamento["duracao_dias_uteis"],
        "etapas": etapas,
    }

# ============================================================
# MODELOS PADRÃO — 5 TIPOS DE PROJETO
# ============================================================


def _definicao_por_codigo(codigo):
    for definicao in MODELOS_CRONOGRAMA_PADRAO:
        if definicao["codigo"] == codigo:
            return definicao
    return None


def _etapas_modelo_estao_corretas(modelo, definicao):
    etapas = list(modelo.etapas.order_by("ordem", "id"))

    if len(etapas) != 5:
        return False

    esperadas = definicao["etapas"]
    if len(esperadas) != 5:
        return False

    for etapa, etapa_def in zip(etapas, esperadas):
        if (
            etapa.ordem != etapa_def["ordem"]
            or etapa.nome != etapa_def["nome"]
            or etapa.descricao != etapa_def["descricao"]
            or etapa.tipo != ProjetoEtapaTipo.SPRINT
        ):
            return False

    return True


def _criar_cinco_sprints(modelo, definicao):
    """
    Cria somente a estrutura macro das cinco Sprints.

    Os offsets/durações permanecem técnicos/provisórios nesta etapa.
    A regra definitiva de prazo será implementada na próxima etapa.
    """

    for etapa_def in definicao["etapas"]:
        ProjetoCronogramaEtapaModelo.objects.create(
            modelo=modelo,
            nome=etapa_def["nome"],
            descricao=etapa_def["descricao"],
            tipo=ProjetoEtapaTipo.SPRINT,
            ordem=etapa_def["ordem"],
            offset_inicio_dias_uteis=max(0, etapa_def["ordem"] - 1),
            duracao_dias_uteis=1,
        )


def _popular_tarefas_e_subtarefas(modelo, definicao):
    """
    Popula o template a partir do Excel.

    Importante:
    - categoria/duração/peso não existem no Excel;
    - nesta etapa são usados os defaults técnicos já existentes;
    - a próxima etapa definirá cálculos de prazo/dias;
    - depois que o modelo já possuir tarefas, esta função não é chamada
      automaticamente por garantir_cronogramas_padrao(), preservando
      alterações manuais do modelo.
    """

    etapas_por_ordem = {
        etapa.ordem: etapa
        for etapa in modelo.etapas.order_by("ordem", "id")
    }

    for etapa_def in definicao["etapas"]:
        etapa = etapas_por_ordem[etapa_def["ordem"]]

        for tarefa_def in etapa_def["tarefas"]:
            tarefa = ProjetoCronogramaTarefaModelo.objects.create(
                etapa=etapa,
                nome=tarefa_def["nome"],
                descricao="",
                tipo=ProjetoTarefaTipo.TAREFA,
                categoria=ProjetoTarefaCategoria.OUTRO,
                ordem=tarefa_def["ordem"],
                offset_inicio_dias_uteis=0,
                duracao_dias_uteis=1,
                peso=Decimal("1.00"),
                obrigatoria=True,
            )

            ProjetoCronogramaSubtarefaModelo.objects.bulk_create(
                [
                    ProjetoCronogramaSubtarefaModelo(
                        tarefa=tarefa,
                        descricao=subtarefa_def["descricao"],
                        ordem=subtarefa_def["ordem"],
                        obrigatoria=True,
                    )
                    for subtarefa_def in tarefa_def["subtarefas"]
                ]
            )


def _popular_somente_subtarefas_ausentes(modelo, definicao):
    """
    Compatibilidade para um template que eventualmente já possua as 25
    tarefas, mas ainda não tenha a nova tabela de subtarefas-modelo.

    Só preenche subtarefas quando encontra a tarefa padrão pelo mesmo número
    de Sprint + ordem + nome e essa tarefa ainda não possui subtarefas.
    Não recria tarefa removida manualmente e não remove tarefa adicionada.
    """

    etapas_por_ordem = {
        etapa.ordem: etapa
        for etapa in modelo.etapas.order_by("ordem", "id")
    }

    for etapa_def in definicao["etapas"]:
        etapa = etapas_por_ordem.get(etapa_def["ordem"])
        if not etapa:
            continue

        tarefas_por_ordem = {
            tarefa.ordem: tarefa
            for tarefa in etapa.tarefas.order_by("ordem", "id")
        }

        for tarefa_def in etapa_def["tarefas"]:
            tarefa = tarefas_por_ordem.get(tarefa_def["ordem"])
            if not tarefa or tarefa.nome != tarefa_def["nome"]:
                continue
            if tarefa.subtarefas.exists():
                continue

            ProjetoCronogramaSubtarefaModelo.objects.bulk_create(
                [
                    ProjetoCronogramaSubtarefaModelo(
                        tarefa=tarefa,
                        descricao=subtarefa_def["descricao"],
                        ordem=subtarefa_def["ordem"],
                        obrigatoria=True,
                    )
                    for subtarefa_def in tarefa_def["subtarefas"]
                ]
            )


@transaction.atomic
def garantir_cronogramas_padrao(recriar=False):
    """
    Retorna o catálogo sistêmico vigente sem achatar a metodologia.

    O catálogo vigente trabalha com 5 tipos × 2 metodologias: Ágil e Waterfall.
    Os modelos são versionados por migration e não são recriados a cada abertura
    da tela, preservando customizações e histórico.

    O parâmetro ``recriar`` é mantido por compatibilidade, mas não destrói o
    catálogo versionado. Para alterar os templates sistêmicos use migration ou
    a administração própria dos modelos.
    """
    catalogo = list(
        ProjetoCronogramaModelo.objects
        .filter(ativo=True, sistema=True, metodologia__in=[ProjetoMetodologia.AGIL, ProjetoMetodologia.WATERFALL])
        .order_by("tipo_projeto_codigo", "metodologia", "nome", "id")
    )
    if catalogo:
        return catalogo

    # Compatibilidade para uma base muito antiga que ainda não executou as
    # migrations de catálogo: cria os modelos legados uma única vez.
    modelos = []
    for definicao in MODELOS_CRONOGRAMA_PADRAO:
        modelo, _ = ProjetoCronogramaModelo.objects.get_or_create(
            codigo=definicao["codigo"],
            defaults={
                "nome": definicao["nome"],
                "descricao": "",
                "metodologia": ProjetoMetodologia.AGIL,
                "ativo": True,
                "sistema": True,
                "hierarquia": "Sprint → Tarefa → Subtarefa",
            },
        )
        if not modelo.etapas.exists():
            _criar_cinco_sprints(modelo, definicao)
            _popular_tarefas_e_subtarefas(modelo, definicao)
        modelos.append(modelo)
    return modelos

@transaction.atomic
def recriar_cronogramas_padrao():
    """
    Compatibilidade com chamadas legadas.

    Com o catálogo versionado por migrations, esta chamada apenas garante e
    retorna os modelos ativos; não achata nem recria a hierarquia Fase/Sprint.
    """
    return garantir_cronogramas_padrao(recriar=True)


# ============================================================
# CUSTOMIZAÇÃO DOS TEMPLATES
# ============================================================


@transaction.atomic
def adicionar_tarefa_modelo(
    modelo,
    *,
    sprint_ordem,
    nome,
    subtarefas=None,
    descricao="",
    tipo=ProjetoTarefaTipo.TAREFA,
    categoria=ProjetoTarefaCategoria.OUTRO,
    duracao_dias_uteis=1,
    peso=Decimal("1.00"),
    obrigatoria=True,
):
    """
    Inclui uma tarefa SOMENTE no modelo selecionado.

    Projetos já criados a partir deste modelo permanecem inalterados.
    A tarefa é acrescentada no final da Sprint informada.
    """

    nome = str(nome or "").strip()
    if not nome:
        raise ValueError("Informe o nome da tarefa-modelo.")

    etapa = ProjetoCronogramaEtapaModelo.objects.filter(
        modelo=modelo,
        ordem=int(sprint_ordem),
    ).first()

    if not etapa:
        raise ValueError("Sprint do modelo não encontrada.")

    ultima_ordem = (
        ProjetoCronogramaTarefaModelo.objects
        .filter(etapa=etapa)
        .order_by("-ordem")
        .values_list("ordem", flat=True)
        .first()
        or 0
    )

    tarefa = ProjetoCronogramaTarefaModelo.objects.create(
        etapa=etapa,
        nome=nome,
        descricao=str(descricao or "").strip(),
        tipo=tipo,
        categoria=categoria,
        ordem=ultima_ordem + 1,
        offset_inicio_dias_uteis=0,
        duracao_dias_uteis=max(1, int(duracao_dias_uteis or 1)),
        peso=Decimal(str(peso or "1.00")),
        obrigatoria=bool(obrigatoria),
    )

    for descricao_subtarefa in subtarefas or []:
        adicionar_subtarefa_modelo(
            tarefa,
            descricao=descricao_subtarefa,
            obrigatoria=True,
        )

    return tarefa


@transaction.atomic
def remover_tarefa_modelo(tarefa_modelo):
    """
    Remove a tarefa apenas do TEMPLATE.

    Como cada projeto recebe uma cópia independente, projetos existentes não
    perdem a tarefa que já foi criada anteriormente.
    """
    tarefa_modelo.delete()


@transaction.atomic
def adicionar_subtarefa_modelo(
    tarefa_modelo,
    *,
    descricao,
    obrigatoria=True,
):
    """Inclui uma subtarefa no final da tarefa-modelo informada."""

    descricao = str(descricao or "").strip()
    if not descricao:
        raise ValueError("Informe a descrição da subtarefa-modelo.")

    ultima_ordem = (
        ProjetoCronogramaSubtarefaModelo.objects
        .filter(tarefa=tarefa_modelo)
        .order_by("-ordem")
        .values_list("ordem", flat=True)
        .first()
        or 0
    )

    return ProjetoCronogramaSubtarefaModelo.objects.create(
        tarefa=tarefa_modelo,
        descricao=descricao,
        ordem=ultima_ordem + 1,
        obrigatoria=bool(obrigatoria),
    )


@transaction.atomic
def remover_subtarefa_modelo(subtarefa_modelo):
    """
    Remove a subtarefa somente do TEMPLATE, sem alterar projetos existentes.
    """
    subtarefa_modelo.delete()


# ============================================================
# APLICAÇÃO DO MODELO NO PROJETO
# ============================================================


@transaction.atomic
def aplicar_cronograma_modelo(
    projeto: Projeto,
    modelo: ProjetoCronogramaModelo,
    usuario=None,
    substituir=False,
    ajustar_data_fim=True,
    duracao_projeto_dias_uteis=None,
):
    """Gera a hierarquia real de Fases/Sprints, tarefas e subtarefas."""
    if not projeto.data_inicio:
        raise ValueError("O projeto precisa de uma data de início para aplicar um cronograma.")

    if projeto.etapas.exists() or projeto.tarefas.exists():
        if not substituir:
            raise ValueError("O projeto já possui cronograma. Use substituir=True para recriá-lo.")
        projeto.tarefas.all().delete()
        projeto.etapas.all().delete()

    planejamento = None
    etapas_planejadas = {}
    if duracao_projeto_dias_uteis:
        planejamento = planejar_cronograma_modelo(
            projeto.data_inicio,
            duracao_projeto_dias_uteis,
            modelo,
        )
        etapas_planejadas = {item["modelo_id"]: item for item in planejamento["etapas"]}

    maior_data_fim = projeto.data_inicio
    etapas_modelo = list(
        modelo.etapas.select_related("fase_pai")
        .prefetch_related("tarefas__subtarefas")
        .order_by("ordem", "id")
    )
    etapas_criadas = {}

    # 1º passe: cria Fases e Sprints. O vínculo pai é aplicado no 2º passe para
    # também funcionar caso algum template customizado esteja fora de pré-ordem.
    for etapa_modelo in etapas_modelo:
        etapa_planejada = etapas_planejadas.get(etapa_modelo.id)
        if etapa_planejada:
            inicio_etapa = etapa_planejada["data_inicio"]
            fim_etapa = etapa_planejada["data_fim_prevista"]
        else:
            inicio_etapa = somar_dias_uteis(projeto.data_inicio, etapa_modelo.offset_inicio_dias_uteis)
            fim_etapa = calcular_fim_por_duracao(inicio_etapa, etapa_modelo.duracao_dias_uteis)

        etapa = ProjetoEtapa.objects.create(
            projeto=projeto,
            nome=etapa_modelo.nome,
            descricao=etapa_modelo.descricao,
            tipo=etapa_modelo.tipo,
            momento=etapa_modelo.momento,
            ordem=etapa_modelo.ordem,
            data_inicio=inicio_etapa,
            data_fim_prevista=fim_etapa,
            criado_por=usuario,
            atualizado_por=usuario,
        )
        etapas_criadas[etapa_modelo.id] = etapa
        if fim_etapa and fim_etapa > maior_data_fim:
            maior_data_fim = fim_etapa

    for etapa_modelo in etapas_modelo:
        if etapa_modelo.fase_pai_id:
            etapa = etapas_criadas[etapa_modelo.id]
            etapa.fase_pai = etapas_criadas.get(etapa_modelo.fase_pai_id)
            etapa.save(update_fields=["fase_pai", "atualizado_em"])

    # Tarefas permanecem somente na etapa executora: Sprint no Ágil ou Fase no Waterfall.
    for etapa_modelo in etapas_modelo:
        etapa = etapas_criadas[etapa_modelo.id]
        etapa_planejada = etapas_planejadas.get(etapa_modelo.id)
        tarefas_planejadas = {
            item["modelo_id"]: item
            for item in (etapa_planejada or {}).get("tarefas", [])
        }
        for tarefa_modelo in etapa_modelo.tarefas.order_by("ordem", "id"):
            tarefa_planejada = tarefas_planejadas.get(tarefa_modelo.id)
            if tarefa_planejada:
                inicio_tarefa = tarefa_planejada["data_inicio"]
                fim_tarefa = tarefa_planejada["data_fim_prevista"]
            else:
                inicio_tarefa = somar_dias_uteis(etapa.data_inicio, tarefa_modelo.offset_inicio_dias_uteis)
                fim_tarefa = calcular_fim_por_duracao(inicio_tarefa, tarefa_modelo.duracao_dias_uteis)
            if tarefa_modelo.tipo == ProjetoTarefaTipo.MARCO:
                fim_tarefa = inicio_tarefa

            tarefa = ProjetoTarefa.objects.create(
                projeto=projeto,
                etapa=etapa,
                nome=tarefa_modelo.nome,
                descricao=tarefa_modelo.descricao,
                tipo=tarefa_modelo.tipo,
                categoria=tarefa_modelo.categoria,
                status=ProjetoTarefaStatus.BACKLOG,
                ordem=tarefa_modelo.ordem,
                data_inicio=inicio_tarefa,
                data_fim_prevista=fim_tarefa,
                progresso=Decimal("0.00"),
                peso=tarefa_modelo.peso,
                obrigatoria=tarefa_modelo.obrigatoria,
                criado_por=usuario,
                atualizado_por=usuario,
            )
            ProjetoTarefaChecklist.objects.bulk_create([
                ProjetoTarefaChecklist(
                    tarefa=tarefa,
                    descricao=subtarefa_modelo.descricao,
                    ordem=subtarefa_modelo.ordem,
                    data_inicio=inicio_tarefa,
                    data_fim_prevista=fim_tarefa,
                    concluido=False,
                    criado_por=usuario,
                )
                for subtarefa_modelo in tarefa_modelo.subtarefas.order_by("ordem", "id")
            ])
            if fim_tarefa and fim_tarefa > maior_data_fim:
                maior_data_fim = fim_tarefa

    projeto.cronograma_modelo = modelo
    projeto.metodologia = modelo.metodologia
    projeto.atualizado_por = usuario
    campos = ["cronograma_modelo", "metodologia", "atualizado_por", "atualizado_em"]
    if ajustar_data_fim or planejamento:
        projeto.data_fim_prevista = planejamento["data_fim_prevista"] if planejamento else maior_data_fim
        campos.append("data_fim_prevista")

    referencias = datas_referencia_cronograma_projeto(projeto)
    if not projeto.data_homologacao_prevista and referencias["data_homologacao_cronograma"]:
        projeto.data_homologacao_prevista = referencias["data_homologacao_cronograma"]
        campos.append("data_homologacao_prevista")
    if not projeto.data_go_live_prevista and referencias["data_go_live_cronograma"]:
        projeto.data_go_live_prevista = referencias["data_go_live_cronograma"]
        campos.append("data_go_live_prevista")
    projeto.save(update_fields=list(dict.fromkeys(campos)))

    ProjetoHistorico.objects.create(
        projeto=projeto,
        entidade=ProjetoHistoricoEntidade.CRONOGRAMA,
        entidade_id=modelo.id,
        acao=ProjetoHistoricoAcao.CRONOGRAMA,
        descricao=f'Cronograma padrão "{modelo.nome}" aplicado ao projeto.',
        dados_novos={
            "cronograma_modelo_id": modelo.id,
            "cronograma_modelo": modelo.nome,
            "metodologia": modelo.metodologia,
            "hierarquia": modelo.hierarquia,
            "quantidade_fases": projeto.etapas.filter(tipo=ProjetoEtapaTipo.FASE, ativo=True).count(),
            "quantidade_sprints": projeto.etapas.filter(tipo=ProjetoEtapaTipo.SPRINT, ativo=True).count(),
            "quantidade_tarefas": projeto.tarefas.filter(ativo=True).count(),
            "quantidade_subtarefas": ProjetoTarefaChecklist.objects.filter(tarefa__projeto=projeto, tarefa__ativo=True).count(),
            "data_fim_prevista": projeto.data_fim_prevista.isoformat() if projeto.data_fim_prevista else None,
            "data_homologacao_prevista": projeto.data_homologacao_prevista.isoformat() if projeto.data_homologacao_prevista else None,
            "data_go_live_prevista": projeto.data_go_live_prevista.isoformat() if projeto.data_go_live_prevista else None,
            "duracao_dias_uteis": planejamento["duracao_dias_uteis"] if planejamento else None,
        },
        usuario=usuario,
    )
    return projeto

# ============================================================
# RECÁLCULO DE DATAS DO CRONOGRAMA EXISTENTE — ETAPA 4.1
# ============================================================


def _indice_inicio_no_bloco(datas_uteis, data_alvo):
    if not datas_uteis:
        return 0
    if not data_alvo:
        return 0
    for indice, data in enumerate(datas_uteis):
        if data >= data_alvo:
            return indice
    return len(datas_uteis) - 1


def _indice_fim_no_bloco(datas_uteis, data_alvo):
    if not datas_uteis:
        return 0
    if not data_alvo:
        return len(datas_uteis) - 1
    for indice in range(len(datas_uteis) - 1, -1, -1):
        if datas_uteis[indice] <= data_alvo:
            return indice
    return 0


def _mapear_indice_proporcional(indice_origem, total_origem, total_destino):
    """Converte uma posição do bloco antigo para a posição equivalente no novo."""

    if total_destino <= 1:
        return 0
    if total_origem <= 1:
        return 0
    proporcao = max(0, min(total_origem - 1, indice_origem)) / (total_origem - 1)
    return max(0, min(total_destino - 1, round(proporcao * (total_destino - 1))))


def _reposicionar_subtarefas_no_novo_bloco(
    tarefa,
    *,
    data_inicio_anterior=None,
    data_fim_anterior=None,
):
    """
    Reposiciona somente as datas planejadas das subtarefas.

    Responsável, conclusão, observações e demais dados executados permanecem
    intactos. Quando a subtarefa já possuía um intervalo próprio, sua posição
    relativa dentro da tarefa é preservada usando dias úteis.
    """

    itens = list(tarefa.checklist.filter(ativo=True).order_by("ordem", "id"))
    if not itens:
        return 0

    novo_inicio = tarefa.data_inicio
    novo_fim = tarefa.data_fim_prevista
    if not novo_inicio or not novo_fim:
        return 0

    dias_novos = _dias_uteis_intervalo(novo_inicio, novo_fim)
    if not dias_novos:
        dias_novos = [novo_inicio]

    dias_antigos = _dias_uteis_intervalo(data_inicio_anterior, data_fim_anterior)
    atualizadas = 0

    for item in itens:
        if dias_antigos:
            inicio_referencia = item.data_inicio or data_inicio_anterior
            fim_referencia = item.data_fim_prevista or data_fim_anterior

            indice_inicio_antigo = _indice_inicio_no_bloco(
                dias_antigos,
                inicio_referencia,
            )
            indice_fim_antigo = _indice_fim_no_bloco(
                dias_antigos,
                fim_referencia,
            )
            if indice_fim_antigo < indice_inicio_antigo:
                indice_fim_antigo = indice_inicio_antigo

            indice_inicio_novo = _mapear_indice_proporcional(
                indice_inicio_antigo,
                len(dias_antigos),
                len(dias_novos),
            )
            indice_fim_novo = _mapear_indice_proporcional(
                indice_fim_antigo,
                len(dias_antigos),
                len(dias_novos),
            )
            if indice_fim_novo < indice_inicio_novo:
                indice_fim_novo = indice_inicio_novo

            inicio = dias_novos[indice_inicio_novo]
            fim = dias_novos[indice_fim_novo]
        else:
            # Subtarefas antigas sem bloco de referência acompanham a tarefa.
            inicio = novo_inicio
            fim = novo_fim

        if item.data_inicio == inicio and item.data_fim_prevista == fim:
            continue

        item.data_inicio = inicio
        item.data_fim_prevista = fim
        item.full_clean()
        item.save(update_fields=[
            "data_inicio",
            "data_fim_prevista",
            "atualizado_em",
        ])
        atualizadas += 1

    return atualizadas


@transaction.atomic
def recalcular_datas_cronograma_existente(
    projeto: Projeto,
    *,
    usuario=None,
    ajustar_data_fim=False,
    duracao_projeto_dias_uteis=None,
):
    """
    Recalcula o cronograma inteiro a partir da data de início atualmente
    informada no projeto.

    Regras:
    - a nova data de início é livre, inclusive para replanejamento retroativo;
    - o cálculo respeita dias úteis/feriados existentes no CalendarioUtil;
    - fora da cobertura do calendário, continua por segunda a sexta;
    - Sprints, tarefas e subtarefas têm suas datas planejadas reposicionadas;
    - estrutura, responsáveis, status, progresso e conclusões não são recriados;
    - datas reais de conclusão não são alteradas.
    """
    if not projeto.data_inicio:
        raise ValueError("Informe a data de início antes de recalcular o cronograma.")
    if not projeto.cronograma_modelo_id:
        raise ValueError("Este projeto não possui um cronograma padrão associado.")

    modelo = (
        ProjetoCronogramaModelo.objects
        .prefetch_related("etapas__tarefas", "etapas__fase_pai")
        .get(pk=projeto.cronograma_modelo_id)
    )

    planejamento = None
    etapas_planejadas = {}
    if duracao_projeto_dias_uteis:
        planejamento = planejar_cronograma_modelo(
            projeto.data_inicio,
            duracao_projeto_dias_uteis,
            modelo,
        )
        etapas_planejadas = {
            item["modelo_id"]: item
            for item in planejamento["etapas"]
        }

    etapas_projeto = {
        etapa.ordem: etapa
        for etapa in projeto.etapas.filter(ativo=True).order_by("ordem", "id")
    }
    maior_data_fim = projeto.data_inicio
    etapas_atualizadas = 0
    tarefas_atualizadas = 0
    subtarefas_atualizadas = 0

    for etapa_modelo in modelo.etapas.order_by("ordem", "id"):
        etapa = etapas_projeto.get(etapa_modelo.ordem)
        if not etapa:
            continue

        etapa_planejada = etapas_planejadas.get(etapa_modelo.id)
        if etapa_planejada:
            inicio_etapa = etapa_planejada["data_inicio"]
            fim_etapa = etapa_planejada["data_fim_prevista"]
        else:
            inicio_etapa = somar_dias_uteis(
                projeto.data_inicio,
                etapa_modelo.offset_inicio_dias_uteis,
            )
            fim_etapa = calcular_fim_por_duracao(
                inicio_etapa,
                etapa_modelo.duracao_dias_uteis,
            )

        etapa_alterada = (
            etapa.data_inicio != inicio_etapa
            or etapa.data_fim_prevista != fim_etapa
            or etapa.momento != etapa_modelo.momento
        )
        if etapa_alterada:
            etapa.data_inicio = inicio_etapa
            etapa.data_fim_prevista = fim_etapa
            etapa.momento = etapa_modelo.momento
            etapa.atualizado_por = usuario
            etapa.full_clean()
            etapa.save(update_fields=[
                "data_inicio",
                "data_fim_prevista",
                "momento",
                "atualizado_por",
                "atualizado_em",
            ])
            etapas_atualizadas += 1

        if fim_etapa and fim_etapa > maior_data_fim:
            maior_data_fim = fim_etapa

        tarefas_projeto = {
            tarefa.ordem: tarefa
            for tarefa in etapa.tarefas.filter(ativo=True).order_by("ordem", "id")
        }
        tarefas_planejadas = {
            item["modelo_id"]: item
            for item in (etapa_planejada or {}).get("tarefas", [])
        }

        for tarefa_modelo in etapa_modelo.tarefas.order_by("ordem", "id"):
            tarefa = tarefas_projeto.get(tarefa_modelo.ordem)
            if not tarefa:
                continue

            tarefa_planejada = tarefas_planejadas.get(tarefa_modelo.id)
            if tarefa_planejada:
                inicio_tarefa = tarefa_planejada["data_inicio"]
                fim_tarefa = tarefa_planejada["data_fim_prevista"]
            else:
                inicio_tarefa = somar_dias_uteis(
                    inicio_etapa,
                    tarefa_modelo.offset_inicio_dias_uteis,
                )
                fim_tarefa = calcular_fim_por_duracao(
                    inicio_tarefa,
                    tarefa_modelo.duracao_dias_uteis,
                )

            if tarefa_modelo.tipo == ProjetoTarefaTipo.MARCO:
                fim_tarefa = inicio_tarefa

            data_inicio_anterior = tarefa.data_inicio
            data_fim_anterior = tarefa.data_fim_prevista

            if (
                tarefa.data_inicio != inicio_tarefa
                or tarefa.data_fim_prevista != fim_tarefa
            ):
                tarefa.data_inicio = inicio_tarefa
                tarefa.data_fim_prevista = fim_tarefa
                tarefa.atualizado_por = usuario
                tarefa.full_clean()
                tarefa.save(update_fields=[
                    "data_inicio",
                    "data_fim_prevista",
                    "atualizado_por",
                    "atualizado_em",
                ])
                tarefas_atualizadas += 1

            subtarefas_atualizadas += _reposicionar_subtarefas_no_novo_bloco(
                tarefa,
                data_inicio_anterior=data_inicio_anterior,
                data_fim_anterior=data_fim_anterior,
            )

            if fim_tarefa and fim_tarefa > maior_data_fim:
                maior_data_fim = fim_tarefa

    if ajustar_data_fim or planejamento:
        projeto.data_fim_prevista = (
            planejamento["data_fim_prevista"]
            if planejamento
            else maior_data_fim
        )

    referencias = datas_referencia_cronograma_projeto(projeto)
    projeto.atualizado_por = usuario
    campos = ["atualizado_por", "atualizado_em"]
    if ajustar_data_fim or planejamento:
        campos.append("data_fim_prevista")
    if not projeto.data_homologacao_prevista and referencias["data_homologacao_cronograma"]:
        projeto.data_homologacao_prevista = referencias["data_homologacao_cronograma"]
        campos.append("data_homologacao_prevista")
    if not projeto.data_go_live_prevista and referencias["data_go_live_cronograma"]:
        projeto.data_go_live_prevista = referencias["data_go_live_cronograma"]
        campos.append("data_go_live_prevista")
    projeto.full_clean()
    projeto.save(update_fields=list(dict.fromkeys(campos)))

    ProjetoHistorico.objects.create(
        projeto=projeto,
        entidade=ProjetoHistoricoEntidade.CRONOGRAMA,
        entidade_id=modelo.id,
        acao=ProjetoHistoricoAcao.ALTERACAO,
        descricao="Datas do cronograma recalculadas a partir da nova data de início.",
        dados_novos={
            "data_inicio_solicitada": projeto.data_inicio.isoformat(),
            "data_inicio_efetiva": (
                planejamento["data_inicio_efetiva"].isoformat()
                if planejamento
                else projeto.data_inicio.isoformat()
            ),
            "data_fim_prevista": (
                projeto.data_fim_prevista.isoformat()
                if projeto.data_fim_prevista
                else None
            ),
            "data_homologacao_prevista": projeto.data_homologacao_prevista.isoformat() if projeto.data_homologacao_prevista else None,
            "data_go_live_prevista": projeto.data_go_live_prevista.isoformat() if projeto.data_go_live_prevista else None,
            "etapas_atualizadas": etapas_atualizadas,
            "tarefas_atualizadas": tarefas_atualizadas,
            "subtarefas_atualizadas": subtarefas_atualizadas,
            "duracao_dias_uteis": (
                planejamento["duracao_dias_uteis"]
                if planejamento
                else None
            ),
        },
        usuario=usuario,
    )

    return projeto
