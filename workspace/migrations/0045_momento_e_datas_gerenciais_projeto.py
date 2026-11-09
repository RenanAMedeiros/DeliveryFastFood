from django.db import migrations, models


MOMENTO_PLANEJAMENTO = "planejamento"
MOMENTO_EXECUCAO = "execucao"
MOMENTO_HOMOLOGACAO = "homologacao"
MOMENTO_ENCERRAMENTO = "encerramento"


def _texto(valor):
    return str(valor or "").strip().casefold()


def _momento_por_texto(nome, descricao=""):
    texto = f"{_texto(nome)} {_texto(descricao)}"
    grupos = [
        (
            MOMENTO_ENCERRAMENTO,
            (
                "encerramento",
                "implantação",
                "implantacao",
                "go-live",
                "go live",
                "produção",
                "producao",
                "deploy",
                "handover",
                "pós-go-live",
                "pos-go-live",
            ),
        ),
        (
            MOMENTO_HOMOLOGACAO,
            (
                "homologação",
                "homologacao",
                "validação",
                "validacao",
                "monitoramento e controle",
                "qa",
                "testes finais",
                "aceite",
            ),
        ),
        (
            MOMENTO_EXECUCAO,
            (
                "execução",
                "execucao",
                "construção",
                "construcao",
                "desenvolvimento",
                "implementação",
                "implementacao",
                "automação",
                "automacao",
                "configuração",
                "configuracao",
            ),
        ),
        (
            MOMENTO_PLANEJAMENTO,
            (
                "planejamento",
                "descoberta",
                "discovery",
                "iniciação",
                "iniciacao",
                "abertura",
                "levantamento",
            ),
        ),
    ]
    for momento, palavras in grupos:
        if any(palavra in texto for palavra in palavras):
            return momento
    return ""


def _momento_por_posicao(indice, total):
    """Fallback seguro para modelos legados que seguem a sequência macro padrão."""
    if total <= 1:
        return MOMENTO_EXECUCAO
    if total == 2:
        return MOMENTO_PLANEJAMENTO if indice == 1 else MOMENTO_ENCERRAMENTO
    if total == 3:
        return (
            MOMENTO_PLANEJAMENTO
            if indice == 1
            else MOMENTO_HOMOLOGACAO
            if indice == 2
            else MOMENTO_ENCERRAMENTO
        )
    if total == 4:
        return {
            1: MOMENTO_PLANEJAMENTO,
            2: MOMENTO_EXECUCAO,
            3: MOMENTO_HOMOLOGACAO,
            4: MOMENTO_ENCERRAMENTO,
        }.get(indice, MOMENTO_EXECUCAO)

    # Catálogo padrão atual possui 5 etapas executoras:
    # 1-2 planejamento, 3 execução, 4 homologação, 5 encerramento.
    if indice <= 2:
        return MOMENTO_PLANEJAMENTO
    if indice == total:
        return MOMENTO_ENCERRAMENTO
    if indice == total - 1:
        return MOMENTO_HOMOLOGACAO
    return MOMENTO_EXECUCAO


def _classificar_raizes(raizes):
    total = len(raizes)
    resultado = {}
    for indice, etapa in enumerate(raizes, 1):
        momento = _momento_por_texto(etapa.nome, etapa.descricao)
        if not momento:
            momento = _momento_por_posicao(indice, total)
        resultado[etapa.id] = momento
    return resultado


def _atualizar_etapas_modelo(apps):
    Modelo = apps.get_model("workspace", "ProjetoCronogramaModelo")
    Etapa = apps.get_model("workspace", "ProjetoCronogramaEtapaModelo")

    for modelo in Modelo.objects.all().iterator():
        etapas = list(
            Etapa.objects.filter(modelo_id=modelo.id).order_by("ordem", "id")
        )
        if not etapas:
            continue

        raizes = [etapa for etapa in etapas if not etapa.fase_pai_id]
        por_raiz = _classificar_raizes(raizes)

        for etapa in etapas:
            if etapa.fase_pai_id:
                momento = por_raiz.get(etapa.fase_pai_id)
                if not momento:
                    pai = next((item for item in etapas if item.id == etapa.fase_pai_id), None)
                    momento = _momento_por_texto(
                        getattr(pai, "nome", ""),
                        getattr(pai, "descricao", ""),
                    ) or _momento_por_texto(etapa.nome, etapa.descricao)
                momento = momento or MOMENTO_EXECUCAO
            else:
                momento = por_raiz.get(etapa.id, MOMENTO_EXECUCAO)

            Etapa.objects.filter(pk=etapa.pk).update(momento=momento)


def _atualizar_etapas_projeto(apps):
    Projeto = apps.get_model("workspace", "Projeto")
    Etapa = apps.get_model("workspace", "ProjetoEtapa")

    for projeto in Projeto.objects.all().iterator():
        etapas = list(
            Etapa.objects.filter(projeto_id=projeto.id, ativo=True).order_by("ordem", "id")
        )
        if not etapas:
            continue

        raizes = [etapa for etapa in etapas if not etapa.fase_pai_id]
        por_raiz = _classificar_raizes(raizes)
        por_id = {etapa.id: etapa for etapa in etapas}

        for etapa in etapas:
            if etapa.fase_pai_id:
                pai = por_id.get(etapa.fase_pai_id)
                momento = por_raiz.get(etapa.fase_pai_id)
                if not momento and pai:
                    momento = _momento_por_texto(pai.nome, pai.descricao)
                momento = momento or _momento_por_texto(etapa.nome, etapa.descricao)
                momento = momento or MOMENTO_EXECUCAO
            else:
                momento = por_raiz.get(etapa.id, MOMENTO_EXECUCAO)

            Etapa.objects.filter(pk=etapa.pk).update(momento=momento)
            etapa.momento = momento

        homologacoes = [
            etapa.data_inicio
            for etapa in etapas
            if etapa.momento == MOMENTO_HOMOLOGACAO and etapa.data_inicio
        ]
        encerramentos = [
            etapa.data_inicio
            for etapa in etapas
            if etapa.momento == MOMENTO_ENCERRAMENTO and etapa.data_inicio
        ]
        atualizacoes = {}
        if not projeto.data_homologacao_prevista and homologacoes:
            atualizacoes["data_homologacao_prevista"] = min(homologacoes)
        if not projeto.data_go_live_prevista and encerramentos:
            atualizacoes["data_go_live_prevista"] = min(encerramentos)
        if atualizacoes:
            Projeto.objects.filter(pk=projeto.pk).update(**atualizacoes)


def forwards(apps, schema_editor):
    _atualizar_etapas_modelo(apps)
    _atualizar_etapas_projeto(apps)


class Migration(migrations.Migration):
    dependencies = [
        ("workspace", "0044_hierarquia_real_fase_sprint"),
    ]

    operations = [
        migrations.AddField(
            model_name="projetocronogramaetapamodelo",
            name="momento",
            field=models.CharField(
                choices=[
                    ("planejamento", "Planejamento"),
                    ("execucao", "Execução"),
                    ("homologacao", "Homologação"),
                    ("encerramento", "Encerramento"),
                ],
                db_index=True,
                default="planejamento",
                help_text="Momento gerencial do projeto representado por esta Fase/Sprint.",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="projetoetapa",
            name="momento",
            field=models.CharField(
                choices=[
                    ("planejamento", "Planejamento"),
                    ("execucao", "Execução"),
                    ("homologacao", "Homologação"),
                    ("encerramento", "Encerramento"),
                ],
                db_index=True,
                default="planejamento",
                help_text="Momento gerencial do projeto representado por esta Fase/Sprint.",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="projeto",
            name="data_homologacao_prevista",
            field=models.DateField(
                blank=True,
                db_index=True,
                help_text="Data prevista para entrada do projeto em homologação.",
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="projeto",
            name="data_go_live_prevista",
            field=models.DateField(
                blank=True,
                db_index=True,
                help_text="Data prevista de entrega / Go Live do projeto.",
                null=True,
            ),
        ),
        migrations.RunPython(forwards, migrations.RunPython.noop),
    ]
