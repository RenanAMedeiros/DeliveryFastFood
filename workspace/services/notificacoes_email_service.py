"""
Service de e-mails para notificações de Produção e Metas do Workspace.

Objetivo
--------
Centralizar somente o CANAL DE E-MAIL das notificações do Workspace.

IMPORTANTE:
- Este service NÃO decide quem deve receber.
- As regras de destinatários permanecem no fluxo que já controla as
  notificações do sistema (remetente, superintendente e diretoria).
- O service recebe os destinatários já validados e envia um e-mail
  individual para cada pessoa, evitando expor endereços entre usuários.
- O SMTP utilizado é o já configurado no settings.py por meio de
  DEFAULT_FROM_EMAIL / EMAIL_BACKEND.
- Falha de e-mail não deve desfazer um envio de Produção ou Meta.
  Para isso, use `agendar_email_notificacao_solicitacao()` dentro do
  fluxo transacional.
"""

from __future__ import annotations

import logging
from email.utils import parseaddr
from functools import partial
from html import escape
from typing import Any, Iterable

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.mail import EmailMultiAlternatives
from django.core.validators import validate_email
from django.db import transaction
from django.template.loader import render_to_string


logger = logging.getLogger(__name__)


# ============================================================
# EVENTOS SUPORTADOS
# ============================================================

EVENTO_PRODUCAO_REALIZADA = "producao_realizada"
EVENTO_NOVA_PRODUCAO = "nova_producao"
EVENTO_META_REALIZADA = "meta_realizada"
EVENTO_NOVA_META = "nova_meta"


EVENTOS_EMAIL = {
    EVENTO_PRODUCAO_REALIZADA: {
        "categoria": "PRODUÇÃO",
        "assunto": "Envio de produção realizado | Workspace",
        "titulo": "Envio de produção realizado",
        "mensagem": (
            "Seu envio de produção foi registrado com sucesso no Workspace."
        ),
        "icone": "✓",
        "icone_fundo": "#DCFCE7",
        "icone_cor": "#15803D",
        "botao": "Visualizar envio",
    },
    EVENTO_NOVA_PRODUCAO: {
        "categoria": "PRODUÇÃO",
        "assunto": "Novo envio de produção | Workspace",
        "titulo": "Novo envio de produção",
        "mensagem": (
            "Um novo envio de produção está disponível para consulta "
            "no Workspace."
        ),
        "icone": "+",
        "icone_fundo": "#DBEAFE",
        "icone_cor": "#1D4ED8",
        "botao": "Acessar Meus Envios",
    },
    EVENTO_META_REALIZADA: {
        "categoria": "METAS",
        "assunto": "Envio de metas realizado | Workspace",
        "titulo": "Envio de metas realizado",
        "mensagem": (
            "Seu envio de metas foi registrado com sucesso no Workspace."
        ),
        "icone": "✓",
        "icone_fundo": "#DCFCE7",
        "icone_cor": "#15803D",
        "botao": "Visualizar envio",
    },
    EVENTO_NOVA_META: {
        "categoria": "METAS",
        "assunto": "Novo envio de metas | Workspace",
        "titulo": "Novo envio de metas",
        "mensagem": (
            "Um novo envio de metas está disponível para consulta "
            "no Workspace."
        ),
        "icone": "+",
        "icone_fundo": "#DBEAFE",
        "icone_cor": "#1D4ED8",
        "botao": "Acessar Meus Envios",
    },
}


# ============================================================
# HELPERS
# ============================================================


def _texto(valor: Any) -> str:
    if valor is None:
        return ""
    return str(valor).strip()


def _nome_usuario(usuario: Any) -> str:
    if usuario is None:
        return ""

    nome = _texto(getattr(usuario, "nome", ""))
    if nome:
        return nome

    get_full_name = getattr(usuario, "get_full_name", None)
    if callable(get_full_name):
        nome_completo = _texto(get_full_name())
        if nome_completo:
            return nome_completo

    first_name = _texto(getattr(usuario, "first_name", ""))
    last_name = _texto(getattr(usuario, "last_name", ""))
    nome_completo = " ".join(
        parte for parte in (first_name, last_name) if parte
    ).strip()

    if nome_completo:
        return nome_completo

    return _texto(getattr(usuario, "username", ""))


def _normalizar_destinatarios(destinatarios: Any) -> list[dict[str, str]]:
    if destinatarios is None:
        return []

    if isinstance(destinatarios, str) or hasattr(destinatarios, "email"):
        itens: Iterable[Any] = [destinatarios]
    else:
        try:
            itens = list(destinatarios)
        except TypeError:
            itens = [destinatarios]

    resultado: list[dict[str, str]] = []
    emails_vistos: set[str] = set()

    for item in itens:
        nome = ""
        email = ""

        if isinstance(item, str):
            nome_parseado, email_parseado = parseaddr(item)
            nome = _texto(nome_parseado)
            email = _texto(email_parseado or item)
        else:
            email = _texto(getattr(item, "email", ""))
            nome = _nome_usuario(item)

        if not email:
            continue

        try:
            validate_email(email)
        except ValidationError:
            logger.warning(
                "E-mail inválido ignorado no fluxo de notificações: %s",
                email,
            )
            continue

        email_chave = email.lower()
        if email_chave in emails_vistos:
            continue

        emails_vistos.add(email_chave)
        resultado.append({"email": email, "nome": nome})

    return resultado


def _normalizar_detalhes(
    detalhes: dict[str, Any] | None,
) -> list[tuple[str, str]]:
    if not detalhes:
        return []

    linhas: list[tuple[str, str]] = []

    for rotulo, valor in detalhes.items():
        rotulo_texto = _texto(rotulo)
        valor_texto = _texto(valor)

        if not rotulo_texto or not valor_texto:
            continue

        linhas.append((rotulo_texto, valor_texto))

    return linhas


def _montar_mensagem_evento(
    *,
    evento: str,
    mensagem: str | None,
    enviado_por: str | None,
) -> str:
    configuracao = EVENTOS_EMAIL[evento]

    if mensagem:
        return _texto(mensagem)

    if (
        evento in {EVENTO_NOVA_PRODUCAO, EVENTO_NOVA_META}
        and _texto(enviado_por)
    ):
        tipo = "produção" if evento == EVENTO_NOVA_PRODUCAO else "metas"
        return (
            f"{_texto(enviado_por)} realizou um novo envio de {tipo}. "
            "As informações já estão disponíveis para consulta no Workspace."
        )

    return configuracao["mensagem"]


def _montar_texto_puro(
    *,
    nome_destinatario: str,
    titulo: str,
    mensagem: str,
    detalhes: list[tuple[str, str]],
    link_url: str,
) -> str:
    linhas = [
        f"Olá, {nome_destinatario}." if nome_destinatario else "Olá.",
        "",
        titulo,
        "",
        mensagem,
    ]

    if detalhes:
        linhas.extend(["", "Detalhes:"])
        for rotulo, valor in detalhes:
            linhas.append(f"- {rotulo}: {valor}")

    if link_url:
        linhas.extend(["", "Acesse o Workspace:", link_url])

    linhas.extend([
        "",
        "Mensagem automática enviada pelo Workspace.",
        "Por favor, não responda este e-mail.",
    ])

    return "\n".join(linhas)


def _montar_html(
    *,
    nome_destinatario: str,
    categoria: str,
    titulo: str,
    mensagem: str,
    detalhes: list[tuple[str, str]],
    link_url: str,
    texto_botao: str,
    icone: str,
    icone_fundo: str,
    icone_cor: str,
) -> str:
    """
    Renderiza o template visual padrão do Workspace.

    A regra de negócio, destinatários, SMTP e conteúdo continuam
    sendo definidos pelo mesmo service. Aqui alteramos somente a
    apresentação do e-mail.
    """
    return render_to_string(
        "workspace/emails/notificacao_workspace.html",
        {
            "nome_destinatario": nome_destinatario,
            "categoria": categoria,
            "titulo": titulo,
            "mensagem": mensagem,
            "detalhes": detalhes,
            "link_url": link_url,
            "texto_botao": texto_botao,
            "icone": icone,
            "icone_fundo": icone_fundo,
            "icone_cor": icone_cor,
        },
    )


# ============================================================
# ENVIO PRINCIPAL
# ============================================================


def enviar_email_notificacao_solicitacao(
    *,
    evento: str,
    destinatarios: Any,
    enviado_por: str | None = None,
    detalhes: dict[str, Any] | None = None,
    link_url: str | None = None,
    assunto: str | None = None,
    titulo: str | None = None,
    mensagem: str | None = None,
    texto_botao: str | None = None,
    fail_silently: bool = True,
) -> dict[str, Any]:
    """
    Envia um e-mail individual para cada destinatário.

    `destinatarios` pode ser usuário, e-mail ou coleção de usuários/e-mails.
    `link_url` deve ser preferencialmente absoluto, criado com
    `request.build_absolute_uri(...)`.
    """
    if evento not in EVENTOS_EMAIL:
        raise ValueError(f"Evento de e-mail não suportado: {evento!r}.")

    configuracao = EVENTOS_EMAIL[evento]
    destinatarios_normalizados = _normalizar_destinatarios(destinatarios)

    if not destinatarios_normalizados:
        mensagem_erro = (
            "Nenhum destinatário com e-mail válido foi informado "
            "para a notificação."
        )
        logger.warning(mensagem_erro)

        if not fail_silently:
            raise ValueError(mensagem_erro)

        return {
            "ok": False,
            "enviados": [],
            "falhas": [{"email": "", "erro": mensagem_erro}],
        }

    assunto_final = _texto(assunto or configuracao["assunto"])
    titulo_final = _texto(titulo or configuracao["titulo"])
    mensagem_final = _montar_mensagem_evento(
        evento=evento,
        mensagem=mensagem,
        enviado_por=enviado_por,
    )
    texto_botao_final = _texto(texto_botao or configuracao["botao"])
    link_final = _texto(link_url)
    detalhes_normalizados = _normalizar_detalhes(detalhes)

    remetente = _texto(
        getattr(settings, "DEFAULT_FROM_EMAIL", "")
        or getattr(settings, "EMAIL_HOST_USER", "")
    )

    if not remetente:
        raise ValueError(
            "DEFAULT_FROM_EMAIL/EMAIL_HOST_USER não está configurado."
        )

    enviados: list[str] = []
    falhas: list[dict[str, str]] = []

    for destinatario in destinatarios_normalizados:
        email_destinatario = destinatario["email"]
        nome_destinatario = destinatario["nome"]

        texto_puro = _montar_texto_puro(
            nome_destinatario=nome_destinatario,
            titulo=titulo_final,
            mensagem=mensagem_final,
            detalhes=detalhes_normalizados,
            link_url=link_final,
        )

        html = _montar_html(
            nome_destinatario=nome_destinatario,
            categoria=configuracao["categoria"],
            titulo=titulo_final,
            mensagem=mensagem_final,
            detalhes=detalhes_normalizados,
            link_url=link_final,
            texto_botao=texto_botao_final,
            icone=configuracao["icone"],
            icone_fundo=configuracao["icone_fundo"],
            icone_cor=configuracao["icone_cor"],
        )

        try:
            email = EmailMultiAlternatives(
                subject=assunto_final,
                body=texto_puro,
                from_email=remetente,
                to=[email_destinatario],
            )
            email.attach_alternative(html, "text/html")
            email.send(fail_silently=False)

            enviados.append(email_destinatario)
            logger.info(
                "E-mail de notificação enviado. evento=%s destinatario=%s",
                evento,
                email_destinatario,
            )

        except Exception as erro:
            logger.exception(
                "Falha ao enviar e-mail de notificação. "
                "evento=%s destinatario=%s",
                evento,
                email_destinatario,
            )

            falhas.append({
                "email": email_destinatario,
                "erro": f"{erro.__class__.__name__}: {erro}",
            })

            if not fail_silently:
                raise

    return {
        "ok": bool(enviados) and not falhas,
        "enviados": enviados,
        "falhas": falhas,
    }


# ============================================================
# USO SEGURO APÓS COMMIT
# ============================================================


def agendar_email_notificacao_solicitacao(**kwargs: Any) -> None:
    """
    Executa o envio somente depois do commit da transação atual.

    Fora de `transaction.atomic()`, o Django executa o callback
    imediatamente.
    """
    kwargs.setdefault("fail_silently", True)

    transaction.on_commit(
        partial(
            enviar_email_notificacao_solicitacao,
            **kwargs,
        )
    )
