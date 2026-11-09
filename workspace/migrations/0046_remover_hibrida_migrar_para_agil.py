from django.db import migrations, models
import django.db.models.deletion


AGIL = "agil"
HIBRIDA = "hibrida"
SPRINT = "sprint"
FASE = "fase"


def _modelo_tem_tarefas(TarefaModelo, etapa_id):
    return TarefaModelo.objects.filter(etapa_id=etapa_id).exists()


def _achatar_modelo_hibrido(EtapaModelo, TarefaModelo, modelo_id):
    """Converte um template Híbrido customizado em Sprint → Tarefa → Subtarefa."""
    etapas = list(
        EtapaModelo.objects.filter(modelo_id=modelo_id).order_by("ordem", "id")
    )
    if not etapas:
        return

    sprints = [etapa for etapa in etapas if etapa.tipo == SPRINT]
    if sprints:
        manter = []
        remover_ids = []
        for etapa in etapas:
            if etapa.tipo == SPRINT:
                manter.append(etapa)
            elif _modelo_tem_tarefas(TarefaModelo, etapa.id):
                # Segurança para customizações: uma Fase com tarefas diretas não é perdida.
                manter.append(etapa)
            else:
                remover_ids.append(etapa.id)
    else:
        # Base muito antiga / customizada sem Sprints: cada Fase vira uma Sprint.
        manter = etapas
        remover_ids = []

    # Primeiro solta todos os vínculos e joga as ordens para uma faixa temporária,
    # evitando colisão com a unique constraint (modelo, ordem).
    for indice, etapa in enumerate(manter, 1):
        EtapaModelo.objects.filter(pk=etapa.pk).update(
            fase_pai_id=None,
            tipo=SPRINT,
            ordem=10000 + indice,
        )

    # Só depois de soltar os filhos removemos os agrupadores de Fase sem tarefas.
    if remover_ids:
        EtapaModelo.objects.filter(pk__in=remover_ids).delete()

    for indice, etapa in enumerate(manter, 1):
        EtapaModelo.objects.filter(pk=etapa.pk).update(ordem=indice)


def _achatar_projeto_hibrido(Etapa, Tarefa, projeto_id):
    """Preserva toda execução e transforma o cronograma real em Sprints planas."""
    etapas = list(
        Etapa.objects.filter(projeto_id=projeto_id, ativo=True).order_by("ordem", "id")
    )
    if not etapas:
        return

    sprints = [etapa for etapa in etapas if etapa.tipo == SPRINT]
    if sprints:
        manter = []
        desativar = []
        for etapa in etapas:
            tem_tarefas = Tarefa.objects.filter(etapa_id=etapa.id, ativo=True).exists()
            if etapa.tipo == SPRINT or tem_tarefas:
                manter.append(etapa)
            else:
                desativar.append(etapa)
    else:
        # Segurança para estruturas legadas ainda sem Sprints.
        manter = etapas
        desativar = []

    for indice, etapa in enumerate(manter, 1):
        Etapa.objects.filter(pk=etapa.pk).update(
            fase_pai_id=None,
            tipo=SPRINT,
            ordem=indice,
        )

    if desativar:
        Etapa.objects.filter(pk__in=[etapa.id for etapa in desativar]).update(
            ativo=False,
            fase_pai_id=None,
        )



def _etapa_concluida(Tarefa, Checklist, etapa):
    tarefas = list(
        Tarefa.objects.filter(etapa_id=etapa.id, ativo=True)
        .exclude(status="cancelada")
        .order_by("ordem", "id")
    )
    obrigatorias = [tarefa for tarefa in tarefas if tarefa.obrigatoria]
    avaliadas = obrigatorias or tarefas
    if not avaliadas:
        return float(etapa.progresso or 0) >= 100

    for tarefa in avaliadas:
        if tarefa.status != "concluida":
            return False
        if Checklist.objects.filter(
            tarefa_id=tarefa.id,
            ativo=True,
            concluido=False,
        ).exists():
            return False
    return True


def _status_automatico_convertido(Etapa, Tarefa, Checklist, projeto):
    if not getattr(projeto, "status_automatico", True):
        return projeto.status
    if projeto.status in {"aguardando", "pausado", "cancelado", "rascunho"}:
        return projeto.status

    etapas = list(
        Etapa.objects.filter(projeto_id=projeto.id, ativo=True)
        .order_by("ordem", "id")
    )
    if not etapas:
        return projeto.status

    primeira_pendente = next(
        (etapa for etapa in etapas if not _etapa_concluida(Tarefa, Checklist, etapa)),
        None,
    )
    if primeira_pendente is None:
        return "concluido"
    if primeira_pendente.momento == "homologacao":
        return "homologacao"
    if primeira_pendente.momento == "encerramento":
        return "encerramento"
    return "em_andamento"

def forwards(apps, schema_editor):
    Projeto = apps.get_model("workspace", "Projeto")
    Modelo = apps.get_model("workspace", "ProjetoCronogramaModelo")
    EtapaModelo = apps.get_model("workspace", "ProjetoCronogramaEtapaModelo")
    TarefaModelo = apps.get_model("workspace", "ProjetoCronogramaTarefaModelo")
    Etapa = apps.get_model("workspace", "ProjetoEtapa")
    Tarefa = apps.get_model("workspace", "ProjetoTarefa")
    Checklist = apps.get_model("workspace", "ProjetoTarefaChecklist")

    legados = list(
        Modelo.objects.filter(metodologia=HIBRIDA).order_by("id")
    )
    substitutos = {}

    for legado in legados:
        substituto = None
        if legado.tipo_projeto_codigo:
            substituto = (
                Modelo.objects.filter(
                    tipo_projeto_codigo=legado.tipo_projeto_codigo,
                    metodologia=AGIL,
                    ativo=True,
                )
                .exclude(pk=legado.pk)
                .order_by("-sistema", "id")
                .first()
            )

        # Os cinco modelos Híbridos sistêmicos têm equivalente Ágil com as mesmas
        # Sprints/tarefas. Mantemos o registro legado apenas inativo para histórico.
        if legado.sistema and substituto:
            if legado.esperada and not substituto.esperada:
                Modelo.objects.filter(pk=substituto.pk).update(esperada=True)
            substitutos[legado.pk] = substituto.pk
            Modelo.objects.filter(pk=legado.pk).update(
                metodologia=AGIL,
                ativo=False,
                esperada=False,
                hierarquia="LEGADO — substituído por Sprint → Tarefa → Subtarefa",
            )
            continue

        # Templates Híbridos customizados continuam utilizáveis, mas são achatados
        # e passam a ser Ágeis para não descartar customizações do usuário.
        _achatar_modelo_hibrido(EtapaModelo, TarefaModelo, legado.pk)
        Modelo.objects.filter(pk=legado.pk).update(
            metodologia=AGIL,
            hierarquia="Sprint → Tarefa → Subtarefa",
        )
        substitutos[legado.pk] = legado.pk

    projetos_hibridos = list(
        Projeto.objects.filter(metodologia=HIBRIDA).order_by("id")
    )
    for projeto in projetos_hibridos:
        _achatar_projeto_hibrido(Etapa, Tarefa, projeto.pk)

        novo_modelo_id = substitutos.get(projeto.cronograma_modelo_id)
        if not novo_modelo_id and projeto.cronograma_modelo_id:
            atual = Modelo.objects.filter(pk=projeto.cronograma_modelo_id).first()
            if atual and atual.tipo_projeto_codigo:
                equivalente = (
                    Modelo.objects.filter(
                        tipo_projeto_codigo=atual.tipo_projeto_codigo,
                        metodologia=AGIL,
                        ativo=True,
                    )
                    .exclude(pk=atual.pk)
                    .order_by("-sistema", "id")
                    .first()
                )
                if equivalente:
                    novo_modelo_id = equivalente.pk

        atualizacoes = {
            "metodologia": AGIL,
            "status": _status_automatico_convertido(Etapa, Tarefa, Checklist, projeto),
        }
        if novo_modelo_id:
            atualizacoes["cronograma_modelo_id"] = novo_modelo_id
        Projeto.objects.filter(pk=projeto.pk).update(**atualizacoes)

    # Segurança final: nenhum projeto permanece Híbrido.
    Projeto.objects.filter(metodologia=HIBRIDA).update(metodologia=AGIL)


class Migration(migrations.Migration):
    dependencies = [
        ("workspace", "0045_momento_e_datas_gerenciais_projeto"),
    ]

    operations = [
        migrations.RunPython(forwards, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="projetocronogramaetapamodelo",
            name="fase_pai",
            field=models.ForeignKey(
                blank=True,
                help_text="Vínculo hierárquico legado mantido apenas para compatibilidade histórica.",
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="sprints",
                to="workspace.projetocronogramaetapamodelo",
            ),
        ),
        migrations.AlterField(
            model_name="projetoetapa",
            name="fase_pai",
            field=models.ForeignKey(
                blank=True,
                help_text="Vínculo hierárquico legado mantido apenas para compatibilidade histórica.",
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="sprints",
                to="workspace.projetoetapa",
            ),
        ),
        migrations.AlterField(
            model_name="projetocronogramamodelo",
            name="tipo_projeto_codigo",
            field=models.SlugField(
                blank=True,
                db_index=True,
                default="",
                help_text="Agrupa as variações Ágil e Waterfall do mesmo tipo de projeto.",
                max_length=80,
            ),
        ),
        migrations.AlterField(
            model_name="projetocronogramamodelo",
            name="metodologia",
            field=models.CharField(
                choices=[("agil", "Ágil"), ("waterfall", "Waterfall")],
                default="agil",
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name="projeto",
            name="metodologia",
            field=models.CharField(
                choices=[("agil", "Ágil"), ("waterfall", "Waterfall")],
                default="agil",
                max_length=20,
            ),
        ),
    ]
