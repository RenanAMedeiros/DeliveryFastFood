import html
import json
import logging
import re
import unicodedata
from datetime import datetime
from typing import Any, Iterable

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.urls import reverse
from django.utils import timezone

from customauth.models import Cliente, Empresa, Empresa_filtro
from workspace.models import (
    Projeto,
    ProjetoMembro,
    ProjetoPessoa,
    ProjetoStatus,
    ProjetoTarefa,
    ProjetoTarefaChecklist,
    ProjetoTarefaStatus,
    ProjetoTifluxLink,
)
from workspace.services.projeto_participantes_service import (
    definir_participantes_projeto,
    definir_stakeholder_projeto,
    stakeholder_do_projeto,
)
from workspace.services.projeto_apontamento_service import obter_resumo_apontamentos


LOGGER = logging.getLogger(__name__)


def _texto(valor: Any) -> str:
    texto = str(valor or "").strip()
    return "" if texto.lower() == "não informado" else texto


def _campo_ticket(ticket: dict[str, Any], *nomes: str) -> Any:
    """Lê campos padrão ou personalizados do TiFlux sem depender da grafia da chave."""
    for nome in nomes:
        if nome in ticket and ticket.get(nome) not in (None, ""):
            return ticket.get(nome)
    chaves = {_normalizar(chave): chave for chave in ticket}
    for nome in nomes:
        chave_real = chaves.get(_normalizar(nome))
        if chave_real is not None and ticket.get(chave_real) not in (None, ""):
            return ticket.get(chave_real)
    return None


def _projeto_possui_campo(nome: str) -> bool:
    try:
        Projeto._meta.get_field(nome)
        return True
    except Exception:
        return False


def _descricao_texto(valor: Any) -> str:
    """Garante que description seja salvo no Projeto somente como texto."""
    texto = _texto(valor)
    if not texto:
        return ""

    texto = html.unescape(texto).replace("\xa0", " ")
    texto = re.sub(r"(?is)<(script|style)\b[^>]*>.*?</\1>", " ", texto)
    texto = re.sub(r"(?i)<br\s*/?>", "\n", texto)
    texto = re.sub(r"(?i)<li\b[^>]*>", "- ", texto)
    texto = re.sub(
        r"(?i)</(?:p|div|li|ul|ol|h[1-6]|tr|table|section|article)\s*>",
        "\n",
        texto,
    )
    texto = re.sub(r"<[^>]+>", " ", texto)

    linhas = []
    for linha in texto.splitlines():
        linha_limpa = re.sub(r"[ \t]+", " ", linha).strip()
        if linha_limpa:
            linhas.append(linha_limpa)

    return "\n".join(linhas).strip()


def _normalizar(valor: Any) -> str:
    return "".join(
        caractere
        for caractere in unicodedata.normalize("NFD", _texto(valor)).lower()
        if unicodedata.category(caractere) != "Mn"
    )


def _booleano(valor: Any) -> bool:
    if isinstance(valor, bool):
        return valor
    if valor is None:
        return False
    return _normalizar(valor) in {"1", "true", "sim", "yes", "y", "fechado", "closed"}



_EMAIL_TIFLUX_RE = re.compile(r"[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}", re.IGNORECASE)


def _emails_tiflux(valor: Any) -> list[str]:
    """Extrai e-mails de strings, JSON, listas ou objetos retornados pelo TiFlux."""
    encontrados: list[str] = []

    def visitar(item: Any) -> None:
        if item in (None, ""):
            return
        if isinstance(item, dict):
            chaves_prioritarias = (
                "email", "mail", "address", "user_email", "follower_email",
                "responsible_email", "requestor_email",
            )
            houve = False
            for chave in chaves_prioritarias:
                if item.get(chave):
                    visitar(item.get(chave))
                    houve = True
            if not houve:
                for subvalor in item.values():
                    visitar(subvalor)
            return
        if isinstance(item, (list, tuple, set)):
            for subvalor in item:
                visitar(subvalor)
            return

        texto = str(item or "").strip()
        if not texto:
            return
        if texto[:1] in {"[", "{"}:
            try:
                visitar(json.loads(texto))
                return
            except (TypeError, ValueError, json.JSONDecodeError):
                pass
        encontrados.extend(_EMAIL_TIFLUX_RE.findall(texto))

    visitar(valor)
    resultado = []
    vistos = set()
    for email in encontrados:
        normalizado = email.strip().lower()
        if normalizado and normalizado not in vistos:
            vistos.add(normalizado)
            resultado.append(normalizado)
    return resultado


def _email_tiflux(valor: Any) -> str:
    emails = _emails_tiflux(valor)
    return emails[0] if emails else ""


def ticket_elegivel_para_projeto(ticket: dict[str, Any]) -> tuple[bool, str]:
    if _normalizar(ticket.get("desk_name")) != "projetos":
        return False, "Mesa diferente de Projetos"

    if _booleano(ticket.get("is_closed")) or _booleano(ticket.get("fechado")):
        return False, "Ticket fechado"

    if not _texto(ticket.get("ticket_number") or ticket.get("ticket")):
        return False, "Ticket sem número"

    return True, "Elegível"


def _dados_link(ticket: dict[str, Any]) -> dict[str, Any]:
    return {
        "ticket_title": _texto(_campo_ticket(ticket, "title")),
        "desk_name": _texto(_campo_ticket(ticket, "desk_name")),
        "categoria": _texto(_campo_ticket(ticket, "Categoria-Categoria", "categoria")),
        "nome_projeto_tiflux": _texto(_campo_ticket(ticket, "Nome projeto", "nome_projeto")),
        "cliente_nome_tiflux": _texto(_campo_ticket(ticket, "client_name")),
        "empresa_nome_tiflux": _texto(_campo_ticket(ticket, "Empresa-Empresa", "empresa")),
        "solicitante_nome_tiflux": _texto(
            _campo_ticket(ticket, "requestor_name_original", "requestor_name")
        ),
        "responsavel_nome_tiflux": _texto(_campo_ticket(ticket, "responsible_name")),
        "requestor_email_tiflux": _email_tiflux(_campo_ticket(
            ticket,
            "requestor_email",
            "requester_email",
            "solicitante_email",
        )),
        "responsible_email_tiflux": _email_tiflux(_campo_ticket(
            ticket,
            "responsible_email",
            "responsavel_email",
        )),
        "followers_emails_tiflux": _emails_tiflux(_campo_ticket(
            ticket,
            "followers",
            "followers_email",
            "followers_emails",
            "seguidores",
        )),
        "ticket_cslog_tiflux": _texto(_campo_ticket(
            ticket,
            "Sistemas-Ticket CSLOG-NÃO PREENCHER",
            "ticket_cslog",
        ))[:120],
        "servico_completo_tiflux": _texto(_campo_ticket(
            ticket,
            "Servico_Completo",
            "servico_completo",
        )),
    }


def _data_ticket(valor: Any):
    texto = _texto(valor).replace("Z", "+00:00")
    if not texto:
        return None
    try:
        return datetime.fromisoformat(texto).date()
    except ValueError:
        for formato in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%d/%m/%Y %H:%M:%S", "%d/%m/%Y"):
            try:
                return datetime.strptime(texto, formato).date()
            except ValueError:
                continue
    return None


def _resolver_cadastro_por_nome(modelo, nome: str):
    nome = _texto(nome)
    if not nome:
        return None
    exatos = list(modelo.objects.filter(nome__iexact=nome)[:2])
    if len(exatos) == 1:
        return exatos[0]
    if len(exatos) > 1:
        return None
    normalizado = _normalizar(nome)
    encontrados = [
        item for item in modelo.objects.all().only("id", "nome")
        if _normalizar(item.nome) == normalizado
    ]
    return encontrados[0] if len(encontrados) == 1 else None


def _projeto_existente_por_nome(nome: str):
    nome = _texto(nome)
    if not nome:
        return None, False
    exatos = list(Projeto.objects.filter(ativo=True, nome__iexact=nome)[:2])
    if len(exatos) == 1:
        return exatos[0], False
    if len(exatos) > 1:
        return None, True
    normalizado = _normalizar(nome)
    encontrados = [
        projeto for projeto in Projeto.objects.filter(ativo=True).only("id", "nome")
        if _normalizar(projeto.nome) == normalizado
    ]
    if len(encontrados) == 1:
        return encontrados[0], False
    return None, len(encontrados) > 1


def _projeto_existente_para_vinculo(ticket_number: str, nome: str):
    """Prioriza o número TiFlux para reaproveitar um pré-cadastro em Rascunho.

    O nome continua como fallback para projetos pré-cadastrados antes de o número
    do ticket estar disponível. Um número de ticket exato é uma chave mais segura
    que o nome e evita a criação duplicada quando a integração chega depois.
    """
    ticket_number = _texto(ticket_number)
    if ticket_number:
        referencias = {
            ticket_number,
            f"Ticket TiFlux #{ticket_number}",
            f"Ticket TiFlux {ticket_number}",
        }
        encontrados = list(
            Projeto.objects.filter(ativo=True, referencia__in=referencias).order_by("id")[:3]
        )
        if len(encontrados) == 1:
            return encontrados[0], False
        if len(encontrados) > 1:
            return None, True
    return _projeto_existente_por_nome(nome)


def _dados_relacionados(ticket: dict[str, Any]) -> dict[str, Any]:
    cliente_nome = _texto(_campo_ticket(ticket, "client_name"))
    empresa_nome = _texto(_campo_ticket(ticket, "Empresa-Empresa", "empresa"))
    relacionados = {
        "data_abertura": _data_ticket(_campo_ticket(ticket, "created_at", "data_criacao")),
        "descricao": _descricao_texto(_campo_ticket(ticket, "description")),
        "cslog": _texto(_campo_ticket(
            ticket,
            "Sistemas-Ticket CSLOG-NÃO PREENCHER",
            "ticket_cslog",
        ))[:120],
        "categoria": _texto(_campo_ticket(ticket, "Categoria-Categoria", "categoria"))[:150],
        "empresa_nome": empresa_nome[:255],
        "cliente_nome": cliente_nome[:255],
        "cliente": _resolver_cadastro_por_nome(Cliente, cliente_nome),
        "empresa_filtro": _resolver_cadastro_por_nome(Empresa_filtro, empresa_nome),
        "empresa": _resolver_cadastro_por_nome(Empresa, empresa_nome),
    }
    if _projeto_possui_campo("mesa"):
        relacionados["mesa"] = _texto(_campo_ticket(ticket, "desk_name"))[:150]
    if _projeto_possui_campo("servico_completo"):
        relacionados["servico_completo"] = _texto(_campo_ticket(
            ticket,
            "Servico_Completo",
            "servico_completo",
        ))[:255]
    return relacionados


def _sincronizar_estado_ticket(link: ProjetoTifluxLink, ticket: dict[str, Any]) -> None:
    """Atualiza o projeto conforme o ciclo de vida do ticket no TiFlux."""
    projeto = link.projeto
    hoje = timezone.localdate()
    desk = _normalizar(ticket.get("desk_name"))
    estado_texto = " ".join(
        _normalizar(ticket.get(campo))
        for campo in ("stage_name", "status", "status_name", "last_answer_type")
    )
    fechado = (
        _booleano(ticket.get("is_closed"))
        or _booleano(ticket.get("fechado"))
        or "encerr" in estado_texto
        or "conclu" in estado_texto
        or "fechad" in estado_texto
        or "cancel" in estado_texto
    )

    # Projetos terminados permanecem terminados: a integração nunca reabre nem
    # recalcula o cronograma. Porém os dados INFORMATIVOS do TiFlux continuam
    # sincronizáveis (ex.: Serviço completo, CSLOG e metadados do vínculo).
    projeto_finalizado = projeto.status in {
        ProjetoStatus.CONCLUIDO,
        ProjetoStatus.CANCELADO,
    }

    campos_projeto = []

    if not projeto_finalizado and fechado:
        ProjetoTarefa.objects.filter(projeto=projeto, ativo=True).exclude(
            status=ProjetoTarefaStatus.CONCLUIDA
        ).update(status=ProjetoTarefaStatus.CANCELADA, atualizado_em=timezone.now())
        projeto.status = ProjetoStatus.CANCELADO
        projeto.status_automatico = False
        projeto.data_conclusao = projeto.data_conclusao or hoje
        campos_projeto.extend(["status", "status_automatico", "data_conclusao"])
    elif not projeto_finalizado and desk == "congelado":
        if projeto.status != ProjetoStatus.PAUSADO:
            projeto.status = ProjetoStatus.PAUSADO
            projeto.status_automatico = False
            campos_projeto.extend(["status", "status_automatico"])
    elif not projeto_finalizado and desk != "projetos":
        # Fora das mesas controladas, preserva integralmente o projeto interno.
        return
    elif not projeto_finalizado and projeto.status == ProjetoStatus.PAUSADO:
        # Ao retornar de Congelado para Projetos, retoma o ciclo. Se já houve
        # execução no cronograma, volta para Em andamento; caso contrário,
        # retorna para Rascunho.
        possui_execucao = ProjetoTarefa.objects.filter(
            projeto=projeto,
            ativo=True,
        ).filter(
            Q(status__in=[
                ProjetoTarefaStatus.EM_ANDAMENTO,
                ProjetoTarefaStatus.CONCLUIDA,
            ]) | Q(progresso__gt=0)
        ).exists()
        projeto.status = (
            ProjetoStatus.EM_ANDAMENTO
            if possui_execucao
            else ProjetoStatus.RASCUNHO
        )
        projeto.status_automatico = possui_execucao
        campos_projeto.extend(["status", "status_automatico"])

    relacionados = _dados_relacionados(ticket)

    if projeto_finalizado:
        # Em projetos encerrados só atualizamos campos de origem da integração.
        # Status, tarefas, cronograma, datas gerenciais e participantes ficam
        # congelados exatamente como estavam no encerramento.
        campos_integracao_finalizado = []
        if _projeto_possui_campo("servico_completo"):
            servico_completo = relacionados.get("servico_completo") or ""
            if servico_completo and projeto.servico_completo != servico_completo:
                projeto.servico_completo = servico_completo
                campos_integracao_finalizado.append("servico_completo")
        if _projeto_possui_campo("mesa"):
            mesa = relacionados.get("mesa") or ""
            if mesa and projeto.mesa != mesa:
                projeto.mesa = mesa
                campos_integracao_finalizado.append("mesa")
        cslog = relacionados.get("cslog") or ""
        if cslog and projeto.cslog != cslog:
            projeto.cslog = cslog
            campos_integracao_finalizado.append("cslog")
        if campos_integracao_finalizado:
            projeto.save(update_fields=[
                *dict.fromkeys(campos_integracao_finalizado),
                "atualizado_em",
            ])

        dados_link = _dados_link(ticket)
        campos_link = []
        for campo, valor in dados_link.items():
            if getattr(link, campo) != valor:
                setattr(link, campo, valor)
                campos_link.append(campo)
        link.save(update_fields=[*campos_link, "ultima_sincronizacao_em"])
        return

    # Corrige descrições eventualmente gravadas pela versão anterior com HTML.
    # A limpeza preserva o conteúdo textual e apenas remove a marcação.
    descricao_atual = _texto(projeto.descricao)
    descricao_atual_limpa = _descricao_texto(descricao_atual)
    if descricao_atual and descricao_atual_limpa != descricao_atual:
        projeto.descricao = descricao_atual_limpa
        campos_projeto.append("descricao")

    # Campos originados no TiFlux continuam atualizados enquanto o projeto
    # estiver aberto, sem sobrescrever participantes e demais edições manuais.
    if not fechado and desk == "projetos":
        ticket_number = _texto(ticket.get("ticket_number") or ticket.get("ticket"))
        referencias_automaticas_antigas = {
            "",
            f"Ticket TiFlux #{ticket_number}",
            f"Ticket TiFlux {ticket_number}",
        }
        if ticket_number and projeto.referencia != ticket_number:
            projeto.referencia = ticket_number
            campos_projeto.append("referencia")

        nome_projeto = _texto(_campo_ticket(ticket, "Nome projeto", "nome_projeto", "title"))
        if nome_projeto and projeto.nome != nome_projeto[:255]:
            projeto.nome = nome_projeto[:255]
            campos_projeto.append("nome")

        campos_texto_tiflux = ["categoria", "cliente_nome", "empresa_nome"]
        if _projeto_possui_campo("mesa"):
            campos_texto_tiflux.append("mesa")
        if _projeto_possui_campo("servico_completo"):
            campos_texto_tiflux.append("servico_completo")
        for campo in campos_texto_tiflux:
            valor = relacionados.get(campo) or ""
            if valor and getattr(projeto, campo) != valor:
                setattr(projeto, campo, valor)
                campos_projeto.append(campo)

        # O ticket é a fonte oficial dos dados cadastrais do projeto.
        descricao_tiflux = relacionados.get("descricao") or ""
        if descricao_tiflux and _texto(projeto.descricao) != descricao_tiflux:
            projeto.descricao = descricao_tiflux
            if "descricao" not in campos_projeto:
                campos_projeto.append("descricao")

        if relacionados.get("data_abertura") and projeto.data_abertura != relacionados["data_abertura"]:
            projeto.data_abertura = relacionados["data_abertura"]
            campos_projeto.append("data_abertura")
            if (
                projeto.data_inicio == relacionados["data_abertura"]
                and not projeto.etapas.exists()
                and not projeto.tarefas.exists()
            ):
                projeto.data_inicio = None
                projeto.data_fim_prevista = None
                campos_projeto.extend(["data_inicio", "data_fim_prevista"])
        if relacionados.get("cslog") and projeto.cslog != relacionados["cslog"]:
            projeto.cslog = relacionados["cslog"]
            campos_projeto.append("cslog")
        for campo in ("cliente", "empresa_filtro", "empresa"):
            valor = relacionados.get(campo)
            if valor and not getattr(projeto, f"{campo}_id", None):
                setattr(projeto, campo, valor)
                campos_projeto.append(campo)

    if campos_projeto:
        projeto.save(update_fields=[*dict.fromkeys(campos_projeto), "atualizado_em"])

    if not fechado and desk == "projetos":
        _sincronizar_participantes_tiflux(projeto, ticket)

    dados_link = _dados_link(ticket)
    campos_link = []
    for campo, valor in dados_link.items():
        if getattr(link, campo) != valor:
            setattr(link, campo, valor)
            campos_link.append(campo)
    # Registra toda consulta bem-sucedida, inclusive quando os dados não mudaram.
    link.save(update_fields=[*campos_link, "ultima_sincronizacao_em"])


def _preencher_campos_vazios(projeto: Projeto, ticket: dict[str, Any]) -> None:
    relacionados = _dados_relacionados(ticket)
    alterados = []
    for campo, valor in relacionados.items():
        campo_id = f"{campo}_id" if campo in {"cliente", "empresa_filtro", "empresa"} else campo
        atual = getattr(projeto, campo_id, None)
        valor_comparacao = getattr(valor, "id", None) if campo in {"cliente", "empresa_filtro", "empresa"} else valor
        if atual or not valor_comparacao:
            continue
        setattr(projeto, campo, valor)
        alterados.append(campo)
    if alterados:
        projeto.save(update_fields=[*alterados, "atualizado_em"])


def _resolver_pessoa(nome: str, *, criar_externa: bool = False, cargo: str = ""):
    nome = _texto(nome)
    if not nome:
        return None
    normalizado = _normalizar(nome)
    candidatas = [
        pessoa
        for pessoa in ProjetoPessoa.objects.filter(ativo=True).select_related("usuario")
        if _normalizar(pessoa.nome) == normalizado
    ]
    internas = [pessoa for pessoa in candidatas if pessoa.usuario_id]
    if len(internas) == 1:
        return internas[0]
    if len(internas) > 1:
        return None
    if len(candidatas) == 1:
        return candidatas[0]
    if len(candidatas) > 1 or not criar_externa:
        return None
    return ProjetoPessoa.objects.create(
        nome=nome[:255],
        cargo=(cargo or "Importado do TiFlux")[:180],
        ativo=True,
    )


def _sincronizar_participantes_tiflux(projeto: Projeto, ticket: dict[str, Any]) -> None:
    """Mantém Líder e Stakeholder alinhados ao ticket, preservando Owner e grupos."""
    responsavel = _resolver_pessoa(
        _texto(_campo_ticket(ticket, "responsible_name")),
        criar_externa=True,
    )
    if responsavel:
        definir_participantes_projeto(
            projeto,
            owner=projeto.owner or _owner_padrao(),
            grupo_ids=list(projeto.grupos_trabalho.values_list("id", flat=True)),
            envolvido_ids=[responsavel.id],
            usuario=None,
        )

    solicitante = _resolver_pessoa(
        _texto(_campo_ticket(ticket, "requestor_name_original", "requestor_name")),
        criar_externa=True,
    )
    if solicitante:
        atual = stakeholder_do_projeto(projeto)
        if atual is None or atual.id != solicitante.id:
            definir_stakeholder_projeto(
                projeto,
                stakeholder=solicitante,
                usuario=None,
            )


def _owner_padrao():
    nome = "Felipe Alexandrino"
    candidatos = [
        pessoa
        for pessoa in (
            ProjetoPessoa.objects
            .filter(
                ativo=True,
                usuario__is_active=True,
                usuario__projetos_owner=True,
            )
            .select_related("usuario")
        )
        if _normalizar(pessoa.nome) == _normalizar(nome)
    ]
    if len(candidatos) != 1:
        raise ValueError(
            "Não foi possível localizar Felipe Alexandrino como Owner habilitado. "
            "Verifique projetos_owner no CustomUser."
        )
    return candidatos[0]


def _aplicar_configuracao_inicial(link: ProjetoTifluxLink, ticket: dict[str, Any]) -> None:
    if not link.ajuste_v4_aplicado:
        projeto = link.projeto
        alterados = []
        cslog = _texto(_campo_ticket(
            ticket,
            "Sistemas-Ticket CSLOG-NÃO PREENCHER",
            "ticket_cslog",
        ))[:120]
        if not projeto.cslog and cslog:
            projeto.cslog = cslog
            alterados.append("cslog")
        if (
            link.criado_automaticamente
            and projeto.descricao
            and projeto.descricao.strip() == _texto(link.ticket_title)
        ):
            projeto.descricao = _descricao_texto(_campo_ticket(ticket, "description"))
            alterados.append("descricao")
        if alterados:
            projeto.save(update_fields=[*alterados, "atualizado_em"])
        link.ticket_cslog_tiflux = cslog
        link.ajuste_v4_aplicado = True
        link.save(update_fields=[
            "ticket_cslog_tiflux",
            "ajuste_v4_aplicado",
            "ultima_sincronizacao_em",
        ])

    if link.configuracao_inicial_aplicada:
        return

    projeto = link.projeto
    _preencher_campos_vazios(projeto, ticket)

    owner = projeto.owner or _owner_padrao()
    responsaveis_ids = list(
        ProjetoMembro.objects.filter(
            projeto=projeto,
            ativo=True,
            e_responsavel=True,
        ).values_list("pessoa_id", flat=True)
    )
    if not responsaveis_ids:
        responsavel = _resolver_pessoa(
            _texto(_campo_ticket(ticket, "responsible_name")),
            criar_externa=True,
            cargo="",
        )
        if responsavel:
            responsaveis_ids = [responsavel.id]

    definir_participantes_projeto(
        projeto,
        owner=owner,
        grupo_ids=list(projeto.grupos_trabalho.values_list("id", flat=True)),
        envolvido_ids=responsaveis_ids,
        usuario=None,
    )

    stakeholder = stakeholder_do_projeto(projeto)
    if stakeholder is None:
        stakeholder = _resolver_pessoa(
            _texto(
                _campo_ticket(ticket, "requestor_name_original", "requestor_name")
            ),
            criar_externa=True,
            cargo="",
        )
        definir_stakeholder_projeto(
            projeto,
            stakeholder=stakeholder,
            usuario=None,
        )

    link.configuracao_inicial_aplicada = True
    link.save(update_fields=["configuracao_inicial_aplicada", "ultima_sincronizacao_em"])


def _criar_vinculo(ticket: dict[str, Any]) -> tuple[ProjetoTifluxLink, bool]:
    ticket_number = _texto(ticket.get("ticket_number") or ticket.get("ticket"))
    link_existente = (
        ProjetoTifluxLink.objects
        .select_related("projeto")
        .filter(ticket_number=ticket_number)
        .first()
    )
    if link_existente:
        _sincronizar_estado_ticket(link_existente, ticket)
        _aplicar_configuracao_inicial(link_existente, ticket)
        return link_existente, False

    nome_informado = _texto(_campo_ticket(ticket, "Nome projeto", "nome_projeto"))
    nome = (
        nome_informado
        or _texto(_campo_ticket(ticket, "title"))
        or f"Projeto TiFlux #{ticket_number}"
    )
    referencia = ticket_number
    projeto_existente, ambiguo = _projeto_existente_para_vinculo(
        ticket_number,
        nome_informado,
    )
    if ambiguo:
        raise ValueError(
            f"Há mais de um projeto ativo compatível com o ticket TiFlux {ticket_number} / '{nome}'. "
            "O vínculo deve ser realizado manualmente."
        )

    try:
        with transaction.atomic():
            projeto_criado = projeto_existente is None
            if projeto_criado:
                relacionados = _dados_relacionados(ticket)
                projeto = Projeto.objects.create(
                    nome=nome[:255],
                    referencia=referencia,
                    status=ProjetoStatus.RASCUNHO,
                    status_automatico=False,
                    ativo=True,
                    **relacionados,
                )
            else:
                projeto = projeto_existente
                _preencher_campos_vazios(projeto, ticket)

            link = ProjetoTifluxLink.objects.create(
                projeto=projeto,
                ticket_number=ticket_number,
                criado_automaticamente=projeto_criado,
                **_dados_link(ticket),
            )
            _aplicar_configuracao_inicial(link, ticket)
            _sincronizar_estado_ticket(link, ticket)
            return link, projeto_criado
    except IntegrityError:
        link = (
            ProjetoTifluxLink.objects
            .select_related("projeto")
            .filter(ticket_number=ticket_number)
            .first()
        )
        if link is None:
            # Só recupera uma criação concorrente do mesmo vínculo.
            # Outros erros de INSERT mantêm o traceback original.
            raise
        _aplicar_configuracao_inicial(link, ticket)
        _sincronizar_estado_ticket(link, ticket)
        return link, False


def sincronizar_tickets_com_projetos(
    tickets: Iterable[dict[str, Any]],
    criar_rascunhos: bool = True,
) -> dict[str, Any]:
    tickets = list(tickets)
    numeros = [
        _texto(ticket.get("ticket_number") or ticket.get("ticket"))
        for ticket in tickets
    ]
    links = {
        item.ticket_number: item
        for item in (
            ProjetoTifluxLink.objects
            .select_related("projeto")
            .filter(ticket_number__in=[numero for numero in numeros if numero])
        )
    }
    criados = 0
    existentes_vinculados = 0
    erros = 0
    elegiveis = 0

    if criar_rascunhos:
        for ticket in tickets:
            numero = _texto(ticket.get("ticket_number") or ticket.get("ticket"))
            elegivel, _ = ticket_elegivel_para_projeto(ticket)
            if elegivel:
                elegiveis += 1
            if numero in links:
                try:
                    _sincronizar_estado_ticket(links[numero], ticket)
                    projeto_vinculado = links[numero].projeto
                    ticket_aberto_na_mesa_projetos = (
                        _normalizar(ticket.get("desk_name")) == "projetos"
                        and not _booleano(ticket.get("is_closed"))
                        and not _booleano(ticket.get("fechado"))
                        and projeto_vinculado.status not in {
                            ProjetoStatus.CONCLUIDO,
                            ProjetoStatus.CANCELADO,
                        }
                    )
                    if ticket_aberto_na_mesa_projetos:
                        _aplicar_configuracao_inicial(links[numero], ticket)
                except Exception:
                    erros += 1
                    LOGGER.exception(
                        "Erro ao aplicar configuração inicial do ticket TiFlux %s",
                        numero,
                    )
                continue
            if not elegivel or not numero:
                continue
            try:
                link, projeto_criado = _criar_vinculo(ticket)
                links[numero] = link
                if projeto_criado:
                    criados += 1
                else:
                    existentes_vinculados += 1
            except Exception:
                erros += 1
                LOGGER.exception("Erro ao criar projeto para o ticket TiFlux %s", numero)

    if not criar_rascunhos:
        elegiveis = sum(
            1 for ticket in tickets
            if ticket_elegivel_para_projeto(ticket)[0]
        )

    # Atualiza o esforço real do projeto a partir da mesma integração TiFlux.
    # A base ticket_appointments_latest é baixada uma única vez por sincronização
    # e agregada apenas para os tickets que já possuem vínculo com Projetos.
    apontamentos_atualizados = 0
    erro_apontamentos = ""
    try:
        resumo_apontamentos = obter_resumo_apontamentos(links.keys())
        for numero, resumo in resumo_apontamentos.items():
            link = links.get(numero)
            if not link:
                continue
            alterados = []
            valores = {
                "apontamento_segundos_tiflux": int(resumo.get("segundos") or 0),
                "apontamento_quantidade_tiflux": int(resumo.get("quantidade") or 0),
                "apontamento_ultimo_em_tiflux": resumo.get("ultimo_em"),
                "apontamento_por_usuario_tiflux": resumo.get("por_usuario") or {},
            }
            for campo, valor in valores.items():
                if getattr(link, campo) != valor:
                    setattr(link, campo, valor)
                    alterados.append(campo)
            if alterados:
                link.save(update_fields=[*alterados, "ultima_sincronizacao_em"])
            apontamentos_atualizados += 1
    except Exception as erro:
        erro_apontamentos = str(erro)
        LOGGER.exception("Falha ao sincronizar apontamentos dos projetos TiFlux.")

    for ticket in tickets:
        numero = _texto(ticket.get("ticket_number") or ticket.get("ticket"))
        link = links.get(numero)
        elegivel, motivo = ticket_elegivel_para_projeto(ticket)
        if link:
            projeto = link.projeto
            ticket.update({
                "projeto_cadastrado": True,
                "projeto_integracao_status": "cadastrado",
                "projeto_integracao_motivo": "Projeto vinculado",
                "projeto_id": projeto.id,
                "projeto_codigo": projeto.codigo or f"PRJ-{projeto.id}",
                "projeto_nome_workspace": projeto.nome,
                "projeto_status": projeto.status,
                "projeto_status_nome": projeto.get_status_display(),
                "projeto_url": f"{reverse('projetos')}?projeto_id={projeto.id}",
            })
        else:
            ticket.update({
                "projeto_cadastrado": False,
                "projeto_integracao_status": "pendente" if elegivel else "nao_elegivel",
                "projeto_integracao_motivo": motivo,
                "projeto_id": None,
                "projeto_codigo": "",
                "projeto_nome_workspace": "",
                "projeto_status": "",
                "projeto_status_nome": "",
                "projeto_url": "",
            })

    return {
        "total_analisados": len(tickets),
        "tickets_elegiveis": elegiveis,
        "projetos_criados": criados,
        "projetos_existentes_vinculados": existentes_vinculados,
        "tickets_vinculados": sum(1 for ticket in tickets if ticket.get("projeto_cadastrado")),
        "apontamentos_atualizados": apontamentos_atualizados,
        "erro_apontamentos": erro_apontamentos,
        "erros": erros,
    }
