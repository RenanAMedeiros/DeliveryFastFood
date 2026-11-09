from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q

from workspace.models import (
    Projeto,
    ProjetoGrupoTrabalho,
    ProjetoGrupoTrabalhoMembro,
    ProjetoHistorico,
    ProjetoHistoricoAcao,
    ProjetoHistoricoEntidade,
    ProjetoMembro,
    ProjetoMembroPapel,
    ProjetoPessoa,
    ProjetoTarefaResponsavel,
)


def nome_usuario(usuario):
    """Nome curto oficial do módulo: primeiro + último nome do CustomUser."""
    if not usuario:
        return ""

    primeiro = str(getattr(usuario, "first_name", "") or "").strip()
    ultimo = str(getattr(usuario, "last_name", "") or "").strip()
    nome_curto = " ".join(parte for parte in (primeiro, ultimo) if parte).strip()
    if nome_curto:
        return nome_curto

    nome = str(getattr(usuario, "nome", "") or "").strip()
    if nome:
        partes = nome.split()
        if len(partes) > 1:
            return f"{partes[0].capitalize()} {partes[-1].capitalize()}"
        return partes[0].capitalize()

    get_full_name = getattr(usuario, "get_full_name", None)
    if callable(get_full_name):
        nome = str(get_full_name() or "").strip()
        if nome:
            partes = nome.split()
            return " ".join([partes[0], partes[-1]]) if len(partes) > 1 else partes[0]

    return (
        str(getattr(usuario, "username", "") or "").strip()
        or str(getattr(usuario, "email", "") or "").strip()
        or f"Usuário #{getattr(usuario, 'pk', '-')}"
    )


@transaction.atomic
def garantir_pessoa_usuario(usuario, alterado_por=None):
    """Garante um ProjetoPessoa para um usuário que possui acesso ao Workspace."""

    if not usuario or not getattr(usuario, "pk", None):
        return None

    defaults = {
        "nome": nome_usuario(usuario),
        "email": str(getattr(usuario, "email", "") or "").strip(),
        "ativo": bool(getattr(usuario, "is_active", True)),
        "atualizado_por": alterado_por,
    }

    pessoa, criada = ProjetoPessoa.objects.get_or_create(
        usuario=usuario,
        defaults={
            **defaults,
            "criado_por": alterado_por,
        },
    )

    campos = []
    for campo in ("nome", "email", "ativo"):
        valor = defaults[campo]
        if getattr(pessoa, campo) != valor:
            setattr(pessoa, campo, valor)
            campos.append(campo)

    if alterado_por and pessoa.atualizado_por_id != alterado_por.id:
        pessoa.atualizado_por = alterado_por
        campos.append("atualizado_por")

    if campos and not criada:
        campos.append("atualizado_em")
        pessoa.save(update_fields=campos)

    return pessoa


def grupos_padrao_choices():
    User = get_user_model()
    enum = getattr(User, "ProjetosGrupo", None)
    return list(getattr(enum, "choices", []) or [])


def usuarios_owner_queryset():
    User = get_user_model()
    return User.objects.filter(
        is_active=True,
        projetos_owner=True,
    ).order_by("first_name", "last_name", "nome", "username", "id")


def usuarios_responsaveis_queryset():
    User = get_user_model()
    return User.objects.filter(is_active=True).order_by(
        "first_name", "last_name", "nome", "username", "id"
    )


@transaction.atomic
def garantir_grupos_padrao(alterado_por=None):
    """
    Garante os grupos padronizados definidos no CustomUser e sincroniza a
    associação dos usuários ao ProjetoGrupoTrabalho correspondente.
    """
    grupos = {}
    for codigo, nome in grupos_padrao_choices():
        # O nome do grupo não possui constraint UNIQUE no legado. Pode haver
        # mais de um registro com o mesmo nome criado por versões anteriores.
        # ``get_or_create`` levantaria MultipleObjectsReturned e impediria o
        # carregamento de Cliente/Empresa/Owner/Responsável no modal.
        # Mantemos todos os registros existentes e reutilizamos o mais antigo.
        grupo = (
            ProjetoGrupoTrabalho.objects
            .filter(nome__iexact=nome)
            .order_by("id")
            .first()
        )
        if grupo is None:
            grupo = ProjetoGrupoTrabalho.objects.create(
                nome=nome,
                descricao=f"Grupo padronizado do módulo Projetos ({codigo}).",
                ativo=True,
                criado_por=alterado_por,
                atualizado_por=alterado_por,
            )
        alterados = []
        if not grupo.ativo:
            grupo.ativo = True
            alterados.append("ativo")
        if alterado_por and grupo.atualizado_por_id != getattr(alterado_por, "id", None):
            grupo.atualizado_por = alterado_por
            alterados.append("atualizado_por")
        if alterados:
            alterados.append("atualizado_em")
            grupo.save(update_fields=alterados)
        grupos[codigo] = grupo

    grupos_ids = [grupo.id for grupo in grupos.values()]
    for usuario in usuarios_responsaveis_queryset():
        pessoa = garantir_pessoa_usuario(usuario, alterado_por=alterado_por)
        codigo_grupo = str(getattr(usuario, "projetos_grupo", "") or "")
        grupo = grupos.get(codigo_grupo)

        # O campo do CustomUser representa um único grupo oficial. Ao trocar
        # a seleção no Admin, desativamos apenas os vínculos dos grupos
        # padronizados anteriores, preservando grupos legados não oficiais.
        vinculos_padrao = ProjetoGrupoTrabalhoMembro.objects.filter(
            pessoa=pessoa,
            grupo_id__in=grupos_ids,
        )
        if grupo:
            vinculos_padrao.exclude(grupo=grupo).update(ativo=False)
            ProjetoGrupoTrabalhoMembro.objects.update_or_create(
                grupo=grupo,
                pessoa=pessoa,
                defaults={
                    "ativo": True,
                    "adicionado_por": alterado_por,
                },
            )
        else:
            vinculos_padrao.update(ativo=False)

    return list(grupos.values())


@transaction.atomic
def sincronizar_usuarios_workspace(alterado_por=None):
    """Cria/atualiza pessoas para todos os usuários ativos do Workspace."""

    pessoas = []
    for usuario in usuarios_responsaveis_queryset():
        pessoas.append(
            garantir_pessoa_usuario(
                usuario,
                alterado_por=alterado_por,
            )
        )
    garantir_grupos_padrao(alterado_por=alterado_por)
    return pessoas


@transaction.atomic
def criar_pessoa_externa(*, nome, email="", cargo="", usuario_criador=None):
    nome = str(nome or "").strip()
    if not nome:
        raise ValueError("Informe o nome da pessoa.")

    email = str(email or "").strip()
    cargo = str(cargo or "").strip()

    pessoa = None
    if email:
        pessoa = (
            ProjetoPessoa.objects
            .filter(usuario__isnull=True, email__iexact=email, ativo=True)
            .first()
        )

    if pessoa:
        pessoa.nome = nome
        pessoa.cargo = cargo
        pessoa.atualizado_por = usuario_criador
        pessoa.save(
            update_fields=[
                "nome",
                "cargo",
                "atualizado_por",
                "atualizado_em",
            ]
        )
        return pessoa

    return ProjetoPessoa.objects.create(
        nome=nome,
        email=email,
        cargo=cargo,
        ativo=True,
        criado_por=usuario_criador,
        atualizado_por=usuario_criador,
    )


@transaction.atomic
def criar_grupo_trabalho(
    *,
    nome,
    descricao="",
    lider=None,
    membro_ids=None,
    usuario_criador=None,
):
    nome = str(nome or "").strip()
    if not nome:
        raise ValueError("Informe o nome do grupo de trabalho.")

    grupo = ProjetoGrupoTrabalho.objects.filter(nome__iexact=nome).first()
    criado = grupo is None

    if criado:
        grupo = ProjetoGrupoTrabalho.objects.create(
            nome=nome,
            descricao=str(descricao or "").strip(),
            lider=lider,
            ativo=True,
            criado_por=usuario_criador,
            atualizado_por=usuario_criador,
        )
    else:
        if not grupo.ativo:
            grupo.ativo = True
        grupo.descricao = str(descricao or grupo.descricao or "").strip()
        if lider:
            grupo.lider = lider
        grupo.atualizado_por = usuario_criador
        grupo.save()

    for pessoa in ProjetoPessoa.objects.filter(
        id__in=[int(x) for x in (membro_ids or []) if str(x).isdigit()],
        ativo=True,
    ):
        ProjetoGrupoTrabalhoMembro.objects.update_or_create(
            grupo=grupo,
            pessoa=pessoa,
            defaults={
                "ativo": True,
                "adicionado_por": usuario_criador,
            },
        )

    if lider:
        ProjetoGrupoTrabalhoMembro.objects.update_or_create(
            grupo=grupo,
            pessoa=lider,
            defaults={
                "ativo": True,
                "adicionado_por": usuario_criador,
            },
        )

    return grupo


@transaction.atomic
def sincronizar_responsaveis_tarefas_projeto(projeto, usuario=None):
    """
    Reconcilia apenas os vínculos de responsável que JÁ existem nas tarefas.

    Regra atual do módulo: Owner do projeto NÃO é executor automático das
    tarefas. Esta função permanece por compatibilidade com chamadas antigas,
    mas nunca propaga Owner/membros do projeto para todas as tarefas.
    """
    for tarefa in projeto.tarefas.filter(ativo=True).select_related("responsavel"):
        vinculos = list(
            ProjetoTarefaResponsavel.objects
            .filter(tarefa=tarefa, ativo=True, pessoa__ativo=True)
            .select_related("pessoa", "pessoa__usuario")
            .order_by("-principal", "id")
        )

        # Migração lógica e não destrutiva do campo legado: quando uma tarefa
        # antiga possui CustomUser mas ainda não possui ProjetoPessoa vinculado,
        # criamos somente o vínculo daquela própria pessoa.
        if not vinculos and tarefa.responsavel_id:
            pessoa = garantir_pessoa_usuario(
                tarefa.responsavel,
                alterado_por=usuario,
            )
            if pessoa:
                vinculo, _ = ProjetoTarefaResponsavel.objects.update_or_create(
                    tarefa=tarefa,
                    pessoa=pessoa,
                    defaults={
                        "principal": True,
                        "ativo": True,
                        "atribuido_por": usuario,
                    },
                )
                vinculos = [vinculo]

        # Garante no máximo um principal sem alterar a lista de pessoas.
        principal = vinculos[0] if vinculos else None
        if principal:
            ProjetoTarefaResponsavel.objects.filter(
                tarefa=tarefa,
                ativo=True,
            ).exclude(pk=principal.pk).update(principal=False)
            if not principal.principal:
                principal.principal = True
                principal.save(update_fields=["principal"])

        usuario_legado = None
        if principal and principal.pessoa.usuario_id:
            if getattr(principal.pessoa.usuario, "is_active", True):
                usuario_legado = principal.pessoa.usuario

        novo_id = getattr(usuario_legado, "id", None)
        if tarefa.responsavel_id != novo_id:
            tarefa.responsavel = usuario_legado
            tarefa.atualizado_por = usuario
            tarefa.save(
                update_fields=[
                    "responsavel",
                    "atualizado_por",
                    "atualizado_em",
                ]
            )

    return projeto


@transaction.atomic
def replicar_responsavel_padrao_tarefas(
    projeto,
    *,
    responsavel_anterior=None,
    responsavel_novo=None,
    usuario=None,
):
    """
    Replica o responsável padrão nas tarefas ainda não personalizadas.

    Tarefas sem responsável ou ainda ligadas ao responsável padrão anterior
    acompanham a alteração do projeto. Uma atribuição manual diferente é
    preservada, permitindo vários analistas no mesmo cronograma.
    """
    anterior_id = getattr(responsavel_anterior, "id", responsavel_anterior)
    novo_id = getattr(responsavel_novo, "id", responsavel_novo)
    alteradas = 0

    tarefas = projeto.tarefas.filter(ativo=True).prefetch_related(
        "vinculos_responsaveis__pessoa",
    )
    for tarefa in tarefas:
        principal = next(
            (
                vinculo for vinculo in tarefa.vinculos_responsaveis.all()
                if vinculo.ativo and vinculo.principal
            ),
            None,
        )
        if principal is None:
            principal = next(
                (v for v in tarefa.vinculos_responsaveis.all() if v.ativo),
                None,
            )
        atual_id = principal.pessoa_id if principal else None

        if atual_id is not None and atual_id != anterior_id:
            continue
        if atual_id == novo_id:
            continue

        ProjetoTarefaResponsavel.objects.filter(tarefa=tarefa).update(
            ativo=False,
            principal=False,
        )

        pessoa_nova = None
        if novo_id:
            pessoa_nova = ProjetoPessoa.objects.filter(pk=novo_id, ativo=True).first()
            if not pessoa_nova:
                raise ValueError("Responsável padrão do projeto inválido.")
            ProjetoTarefaResponsavel.objects.update_or_create(
                tarefa=tarefa,
                pessoa=pessoa_nova,
                defaults={
                    "principal": True,
                    "ativo": True,
                    "atribuido_por": usuario,
                },
            )

        usuario_legado = (
            pessoa_nova.usuario
            if pessoa_nova and pessoa_nova.usuario_id
            and getattr(pessoa_nova.usuario, "is_active", True)
            else None
        )
        tarefa.responsavel = usuario_legado
        tarefa.atualizado_por = usuario
        tarefa.save(update_fields=["responsavel", "atualizado_por", "atualizado_em"])

        ProjetoHistorico.objects.create(
            projeto=projeto,
            entidade=ProjetoHistoricoEntidade.TAREFA,
            entidade_id=tarefa.id,
            acao=ProjetoHistoricoAcao.RESPONSAVEL,
            descricao=f'Responsável padrão replicado para a tarefa "{tarefa.nome}".',
            dados_anteriores={"responsavel_pessoa_id": atual_id},
            dados_novos={"responsavel_pessoa_id": novo_id},
            usuario=usuario,
        )
        alteradas += 1

    return alteradas


def stakeholder_do_projeto(projeto):
    """Retorna o Stakeholder ativo do projeto (interno ou externo)."""
    vinculo = (
        projeto.vinculos_membros
        .filter(
            ativo=True,
            pessoa__ativo=True,
            e_stakeholder=True,
        )
        .select_related("pessoa", "pessoa__usuario")
        .order_by("id")
        .first()
    )
    return vinculo.pessoa if vinculo else None


@transaction.atomic
def definir_stakeholder_projeto(projeto, stakeholder=None, usuario=None):
    """
    Mantém um único Stakeholder/Cliente responsável ativo por projeto.

    ProjetoPessoa já suporta pessoas sem login, portanto o mesmo relacionamento
    atende usuários do Workspace, clientes, fornecedores e parceiros externos.
    """
    atuais = ProjetoMembro.objects.filter(
        projeto=projeto,
        e_stakeholder=True,
    )

    if stakeholder is None:
        for vinculo in atuais:
            vinculo.e_stakeholder = False
            if not vinculo.e_responsavel:
                vinculo.ativo = False
            elif vinculo.papel == ProjetoMembroPapel.STAKEHOLDER:
                vinculo.papel = ProjetoMembroPapel.MEMBRO
            vinculo.save(update_fields=["e_stakeholder", "papel", "ativo"])
        return None

    if not isinstance(stakeholder, ProjetoPessoa) or not stakeholder.ativo:
        raise ValueError("Stakeholder inválido.")

    for vinculo_atual in atuais.exclude(pessoa=stakeholder):
        vinculo_atual.e_stakeholder = False
        if not vinculo_atual.e_responsavel:
            vinculo_atual.ativo = False
        elif vinculo_atual.papel == ProjetoMembroPapel.STAKEHOLDER:
            vinculo_atual.papel = ProjetoMembroPapel.MEMBRO
        vinculo_atual.save(update_fields=["e_stakeholder", "papel", "ativo"])

    vinculo = ProjetoMembro.objects.filter(
        projeto=projeto,
        pessoa=stakeholder,
    ).first()
    if vinculo:
        vinculo.e_stakeholder = True
        vinculo.ativo = True
        vinculo.adicionado_por = usuario
        vinculo.save(update_fields=["e_stakeholder", "ativo", "adicionado_por"])
    else:
        vinculo = ProjetoMembro.objects.create(
            projeto=projeto,
            pessoa=stakeholder,
            papel=ProjetoMembroPapel.STAKEHOLDER,
            e_stakeholder=True,
            ativo=True,
            adicionado_por=usuario,
        )
    return vinculo


@transaction.atomic
def definir_participantes_projeto(
    projeto,
    *,
    owner=None,
    grupo_ids=None,
    envolvido_ids=None,
    usuario=None,
):
    """
    Atualiza Owner, grupos e participantes gerais do projeto.

    Os participantes aqui NÃO são propagados como responsáveis das tarefas.
    Cada tarefa possui sua própria atribuição em ProjetoTarefaResponsavel.
    """

    projeto.owner = owner
    projeto.atualizado_por = usuario

    # Compatibilidade com o campo antigo: se o Owner possui login, o usuário
    # continua preenchido. Caso contrário, o legado fica nulo.
    projeto.responsavel = owner.usuario if owner and owner.usuario_id else None
    projeto.save(
        update_fields=[
            "owner",
            "responsavel",
            "atualizado_por",
            "atualizado_em",
        ]
    )

    grupos = ProjetoGrupoTrabalho.objects.filter(
        id__in=[int(x) for x in (grupo_ids or []) if str(x).isdigit()],
        ativo=True,
    )
    projeto.grupos_trabalho.set(grupos)

    responsaveis_ids = {
        int(x) for x in (envolvido_ids or []) if str(x).isdigit()
    }
    ids = set(responsaveis_ids)
    if owner:
        ids.add(owner.id)

    # Uma mesma pessoa pode acumular Owner, Stakeholder e Responsável. O vínculo
    # continua único; os dois booleanos registram os papéis simultâneos.
    for vinculo in ProjetoMembro.objects.filter(projeto=projeto):
        vinculo.e_responsavel = vinculo.pessoa_id in responsaveis_ids
        vinculo.ativo = bool(
            vinculo.e_stakeholder
            or vinculo.e_responsavel
            or vinculo.pessoa_id in ids
        )
        vinculo.save(update_fields=["e_responsavel", "ativo"])

    for pessoa in ProjetoPessoa.objects.filter(id__in=ids, ativo=True):
        existente = ProjetoMembro.objects.filter(
            projeto=projeto,
            pessoa=pessoa,
        ).first()
        if existente:
            existente.e_responsavel = pessoa.id in responsaveis_ids
            existente.ativo = True
            existente.adicionado_por = usuario
            existente.save(update_fields=["e_responsavel", "ativo", "adicionado_por"])
        else:
            ProjetoMembro.objects.create(
                projeto=projeto,
                pessoa=pessoa,
                papel=ProjetoMembroPapel.MEMBRO,
                e_responsavel=pessoa.id in responsaveis_ids,
                ativo=True,
                adicionado_por=usuario,
            )

    # Campo legado de equipe continua sincronizado somente com quem possui login.
    usuarios = [
        pessoa.usuario
        for pessoa in ProjetoPessoa.objects.filter(id__in=ids, usuario__isnull=False)
        if pessoa.usuario
    ]
    projeto.equipe.set(usuarios)

    # Apenas reconcilia vínculos legados já existentes; não atribui Owner às tarefas.
    sincronizar_responsaveis_tarefas_projeto(projeto, usuario=usuario)

    return projeto


@transaction.atomic
def sincronizar_projetos_legados(usuario_execucao=None):
    """
    Converte vínculos antigos de responsável/equipe em Owner/envolvidos.
    É idempotente e não remove nenhum dado legado.
    """

    projetos = (
        Projeto.objects
        .filter(ativo=True)
        .select_related("responsavel", "owner")
        .prefetch_related("equipe")
    )

    for projeto in projetos:
        if not projeto.owner_id and projeto.responsavel_id:
            pessoa = garantir_pessoa_usuario(
                projeto.responsavel,
                alterado_por=usuario_execucao,
            )
            projeto.owner = pessoa
            projeto.save(update_fields=["owner", "atualizado_em"])

        for membro_usuario in projeto.equipe.all():
            pessoa = garantir_pessoa_usuario(
                membro_usuario,
                alterado_por=usuario_execucao,
            )
            if pessoa:
                ProjetoMembro.objects.update_or_create(
                    projeto=projeto,
                    pessoa=pessoa,
                    defaults={
                        "papel": ProjetoMembroPapel.MEMBRO,
                        "e_responsavel": pessoa.id != projeto.owner_id,
                        "ativo": True,
                        "adicionado_por": usuario_execucao,
                    },
                )

    return True


def pessoa_do_usuario(usuario):
    if not usuario or not getattr(usuario, "pk", None):
        return None
    return ProjetoPessoa.objects.filter(usuario=usuario, ativo=True).first()


def projeto_e_meu(projeto, pessoa, usuario=None):
    if pessoa:
        if projeto.owner_id == pessoa.id:
            return True
        if projeto.vinculos_membros.filter(pessoa=pessoa, ativo=True).exists():
            return True
        if projeto.tarefas.filter(
            vinculos_responsaveis__pessoa=pessoa,
            vinculos_responsaveis__ativo=True,
            ativo=True,
        ).exists():
            return True
        if projeto.tarefas.filter(
            checklist__responsavel_pessoa=pessoa,
            checklist__ativo=True,
            ativo=True,
        ).exists():
            return True

    if usuario:
        if projeto.responsavel_id == usuario.id:
            return True
        if projeto.equipe.filter(pk=usuario.id).exists():
            return True
        if projeto.tarefas.filter(responsavel=usuario, ativo=True).exists():
            return True

    return False


def projeto_e_do_meu_grupo(projeto, pessoa):
    if not pessoa:
        return False

    meus_grupos = ProjetoGrupoTrabalhoMembro.objects.filter(
        pessoa=pessoa,
        ativo=True,
        grupo__ativo=True,
    ).values_list("grupo_id", flat=True)

    return projeto.grupos_trabalho.filter(id__in=meus_grupos, ativo=True).exists()


def pessoas_queryset():
    return (
        ProjetoPessoa.objects
        .filter(ativo=True)
        .select_related("usuario")
        .order_by("nome", "id")
    )


def grupos_queryset():
    return (
        ProjetoGrupoTrabalho.objects
        .filter(ativo=True)
        .select_related("lider", "lider__usuario")
        .prefetch_related("vinculos_membros__pessoa", "vinculos_membros__pessoa__usuario")
        .order_by("nome", "id")
    )
