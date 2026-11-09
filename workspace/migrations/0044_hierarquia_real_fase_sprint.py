# CORRIGIDO 2026-08-27: depende da migration 0043 ..._and_more.
from decimal import Decimal

from django.db import migrations, models
import django.db.models.deletion


def _texto(valor):
    return str(valor or "").strip()


def _eh_rotulo_fase(valor):
    return _texto(valor).lower().startswith("fase ")


def _fase_label(etapa, indice):
    descricao = _texto(getattr(etapa, "descricao", ""))
    if _eh_rotulo_fase(descricao):
        return descricao
    nome = _texto(getattr(etapa, "nome", ""))
    if _eh_rotulo_fase(nome):
        return nome
    return f"Fase {indice}"


def _converter_modelos(apps, schema_editor):
    Modelo = apps.get_model("workspace", "ProjetoCronogramaModelo")
    EtapaModelo = apps.get_model("workspace", "ProjetoCronogramaEtapaModelo")

    for modelo in Modelo.objects.all().order_by("id"):
        metodologia = _texto(modelo.metodologia).lower()
        etapas = list(EtapaModelo.objects.filter(modelo_id=modelo.id).order_by("ordem", "id"))

        if metodologia == "agil":
            modelo.hierarquia = "Sprint → Tarefa → Subtarefa"
            modelo.save(update_fields=["hierarquia"])
            for indice, etapa in enumerate(etapas, 1):
                etapa.tipo = "sprint"
                etapa.fase_pai_id = None
                if _eh_rotulo_fase(etapa.descricao):
                    etapa.descricao = ""
                etapa.ordem = indice
                etapa.save(update_fields=["tipo", "fase_pai", "descricao", "ordem"])
            continue

        if metodologia == "waterfall":
            modelo.hierarquia = "Fase → Tarefa → Subtarefa"
            modelo.save(update_fields=["hierarquia"])
            for indice, etapa in enumerate(etapas, 1):
                etapa.tipo = "fase"
                etapa.fase_pai_id = None
                if _eh_rotulo_fase(etapa.descricao):
                    etapa.nome = etapa.descricao
                    etapa.descricao = ""
                elif not _eh_rotulo_fase(etapa.nome):
                    etapa.nome = f"Fase {indice} — {etapa.nome}"
                etapa.ordem = indice
                etapa.save(update_fields=["tipo", "fase_pai", "nome", "descricao", "ordem"])
            continue

        if metodologia != "hibrida" or not etapas:
            continue

        modelo.hierarquia = "Fase → Sprint → Tarefa → Subtarefa"
        modelo.save(update_fields=["hierarquia"])

        # Afasta as ordens existentes para liberar a restrição (modelo, ordem)
        # enquanto as Fases-pai são criadas.
        for indice, etapa in enumerate(etapas, 1):
            etapa.ordem = 1000 + indice
            etapa.fase_pai_id = None
            etapa.tipo = "sprint"
            etapa.save(update_fields=["ordem", "fase_pai", "tipo"])

        grupos = []
        mapa = {}
        for indice, etapa in enumerate(etapas, 1):
            label = _fase_label(etapa, indice)
            if label not in mapa:
                mapa[label] = []
                grupos.append((label, mapa[label]))
            mapa[label].append(etapa)

        ordem_global = 1
        for fase_indice, (label, sprints) in enumerate(grupos, 1):
            offsets = [int(item.offset_inicio_dias_uteis or 0) for item in sprints]
            finais = [
                int(item.offset_inicio_dias_uteis or 0) + max(1, int(item.duracao_dias_uteis or 1))
                for item in sprints
            ]
            inicio = min(offsets) if offsets else 0
            fim = max(finais) if finais else inicio + 1
            fase = EtapaModelo.objects.create(
                modelo_id=modelo.id,
                fase_pai_id=None,
                nome=label or f"Fase {fase_indice}",
                descricao="",
                tipo="fase",
                ordem=ordem_global,
                offset_inicio_dias_uteis=inicio,
                duracao_dias_uteis=max(1, fim - inicio),
            )
            ordem_global += 1
            for sprint in sprints:
                sprint.fase_pai_id = fase.id
                sprint.descricao = ""
                sprint.ordem = ordem_global
                sprint.save(update_fields=["fase_pai", "descricao", "ordem"])
                ordem_global += 1


def _tarefas_ativas_da_etapa(Tarefa, etapa_id):
    return Tarefa.objects.filter(etapa_id=etapa_id, ativo=True).exclude(status="cancelada")


def _converter_projetos(apps, schema_editor):
    Projeto = apps.get_model("workspace", "Projeto")
    Etapa = apps.get_model("workspace", "ProjetoEtapa")
    Tarefa = apps.get_model("workspace", "ProjetoTarefa")
    EtapaModelo = apps.get_model("workspace", "ProjetoCronogramaEtapaModelo")

    for projeto in Projeto.objects.filter(ativo=True).order_by("id"):
        metodologia = _texto(projeto.metodologia).lower()
        etapas = list(Etapa.objects.filter(projeto_id=projeto.id, ativo=True).order_by("ordem", "id"))
        if not etapas:
            continue

        if metodologia == "agil":
            for indice, etapa in enumerate(etapas, 1):
                etapa.tipo = "sprint"
                etapa.fase_pai_id = None
                if _eh_rotulo_fase(etapa.descricao):
                    etapa.descricao = ""
                etapa.ordem = indice
                etapa.save(update_fields=["tipo", "fase_pai", "descricao", "ordem"])
            continue

        if metodologia == "waterfall":
            for indice, etapa in enumerate(etapas, 1):
                etapa.tipo = "fase"
                etapa.fase_pai_id = None
                if _eh_rotulo_fase(etapa.descricao):
                    etapa.nome = etapa.descricao
                    etapa.descricao = ""
                elif not _eh_rotulo_fase(etapa.nome):
                    etapa.nome = f"Fase {indice} — {etapa.nome}"
                etapa.ordem = indice
                etapa.save(update_fields=["tipo", "fase_pai", "nome", "descricao", "ordem"])
            continue

        if metodologia != "hibrida":
            continue

        # Mantém Fases reais já existentes. Apenas Sprints planas que carregam
        # o rótulo de Fase em descricao são agrupadas sob uma Fase-pai.
        sprints_planas = [
            etapa for etapa in etapas
            if etapa.tipo == "sprint" and not etapa.fase_pai_id
        ]
        if not sprints_planas:
            continue

        fase_template_por_sprint = {}
        if getattr(projeto, "cronograma_modelo_id", None):
            for etapa_modelo in EtapaModelo.objects.filter(
                modelo_id=projeto.cronograma_modelo_id,
                tipo="sprint",
                fase_pai_id__isnull=False,
            ).select_related("fase_pai"):
                fase_template_por_sprint[_texto(etapa_modelo.nome).casefold()] = _texto(etapa_modelo.fase_pai.nome)

        grupos = []
        mapa = {}
        for indice, sprint in enumerate(sprints_planas, 1):
            label = _fase_label(sprint, indice)
            if not _eh_rotulo_fase(getattr(sprint, "descricao", "")):
                label = fase_template_por_sprint.get(_texto(sprint.nome).casefold(), label)
            if label not in mapa:
                mapa[label] = []
                grupos.append((label, mapa[label]))
            mapa[label].append(sprint)

        novos_pais = []
        for fase_indice, (label, sprints) in enumerate(grupos, 1):
            datas_inicio = [item.data_inicio for item in sprints if item.data_inicio]
            datas_fim = [item.data_fim_prevista for item in sprints if item.data_fim_prevista]
            progressos = [Decimal(item.progresso or 0) for item in sprints]
            todas_concluidas = bool(sprints) and all(
                Decimal(item.progresso or 0) >= Decimal("100") or item.data_conclusao
                for item in sprints
            )
            conclusoes = [item.data_conclusao for item in sprints if item.data_conclusao]
            fase = Etapa.objects.create(
                projeto_id=projeto.id,
                fase_pai_id=None,
                nome=label or f"Fase {fase_indice}",
                descricao="",
                tipo="fase",
                ordem=10000 + fase_indice,
                responsavel_id=None,
                data_inicio=min(datas_inicio) if datas_inicio else None,
                data_fim_prevista=max(datas_fim) if datas_fim else None,
                data_conclusao=max(conclusoes) if todas_concluidas and conclusoes else None,
                progresso=(sum(progressos, Decimal("0")) / Decimal(len(progressos))) if progressos else Decimal("0"),
                ativo=True,
                criado_por_id=getattr(projeto, "criado_por_id", None),
                atualizado_por_id=getattr(projeto, "atualizado_por_id", None),
            )
            novos_pais.append((fase, sprints))
            for sprint in sprints:
                sprint.fase_pai_id = fase.id
                if _eh_rotulo_fase(sprint.descricao):
                    sprint.descricao = ""
                sprint.save(update_fields=["fase_pai", "descricao"])

        # Reordena em pré-ordem: Fase, suas Sprints. Qualquer etapa que não
        # entrou no agrupamento permanece ao final, sem perda de informação.
        ordem = 1
        agrupados = {s.id for _, itens in novos_pais for s in itens}
        for fase, sprints in novos_pais:
            fase.ordem = ordem
            fase.save(update_fields=["ordem"])
            ordem += 1
            for sprint in sprints:
                sprint.ordem = ordem
                sprint.save(update_fields=["ordem"])
                ordem += 1
        for etapa in etapas:
            if etapa.id in agrupados:
                continue
            etapa.ordem = ordem
            etapa.save(update_fields=["ordem"])
            ordem += 1


def forwards(apps, schema_editor):
    _converter_modelos(apps, schema_editor)
    _converter_projetos(apps, schema_editor)


class Migration(migrations.Migration):
    dependencies = [
        ("workspace", "0043_projeto_mesa_projeto_servico_completo_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="projetocronogramaetapamodelo",
            name="fase_pai",
            field=models.ForeignKey(
                blank=True,
                help_text="Na metodologia Híbrida, vincula a Sprint à Fase que a contém.",
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="sprints",
                to="workspace.projetocronogramaetapamodelo",
            ),
        ),
        migrations.AddField(
            model_name="projetoetapa",
            name="fase_pai",
            field=models.ForeignKey(
                blank=True,
                help_text="Na metodologia Híbrida, vincula a Sprint à Fase que a contém.",
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="sprints",
                to="workspace.projetoetapa",
            ),
        ),
        migrations.RunPython(forwards, migrations.RunPython.noop),
    ]
