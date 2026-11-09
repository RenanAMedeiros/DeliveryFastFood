"""Bases de login (multi-cliente) do Workspace.

Cada cliente entra pela própria URL — /login/<slug>/ — e o usuário só
autentica pela base do Cliente vinculado a ele (CustomUser.cliente).

Fica em módulo próprio, e não em views.py, porque tanto as views quanto
o form de reset de senha precisam desses helpers.
"""
from customauth.models import Cliente

# Base usada quando o usuário não tem Cliente configurado (CustomUser.cliente).
# A migration 0017 tornou a DNR o cliente padrão do sistema, então quem não
# estiver vinculado a nenhum cliente é tratado como usuário da base DNR.
CLIENTE_PADRAO = 'dnr'

# Catálogo mínimo das bases de login. É usado APENAS quando não há nenhum
# Cliente cadastrado em CustomAuth > Clientes (banco vazio, ambiente novo).
# Havendo cadastro, a lista do login vem só do banco — do contrário um cliente
# renomeado/removido no admin continuaria aparecendo no seletor por causa
# daqui, oferecendo uma base em que ninguém consegue autenticar.
BASES_LOGIN_PADRAO = (
    ('dnr', 'DNR Teleserviços'),
    ('qore-tecnologia', 'Qore Tecnologia'),
)


def bases_login():
    """Bases exibidas no seletor de empresa do login.

    Vem dos Clientes cadastrados no admin: uma base nova aparece no login
    apenas cadastrando o Cliente com o slug correto, e some ao ser removida,
    sem alteração de código.
    """
    bases = {
        slug: nome
        for slug, nome in Cliente.objects.order_by('nome').values_list('slug', 'nome')
        if slug
    }

    if not bases:
        bases = dict(BASES_LOGIN_PADRAO)

    return [
        {'slug': slug, 'nome': nome}
        for slug, nome in sorted(bases.items(), key=lambda item: item[1].lower())
    ]


def base_do_usuario(user):
    """Slug da base à qual o usuário pertence."""
    if user.cliente_id and user.cliente.slug:
        return user.cliente.slug
    return CLIENTE_PADRAO


def base_login_valida(slug):
    """Devolve o slug apenas se ele for uma base de login existente.

    Evita montar um link /login/<slug>/ para um Cliente cujo slug não
    corresponde a nenhuma base — nesse caso é melhor cair na tela de
    seleção do que num erro de base inexistente.
    """
    if not slug:
        return None
    if slug in {base['slug'] for base in bases_login()}:
        return slug
    return None
