from django.contrib.auth import authenticate, login as auth_login, logout
from django.contrib.auth import views as auth_views
from django.contrib.auth.decorators import login_required
from django.contrib.sessions.models import Session
from django.shortcuts import redirect, render
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.views.decorators.http import require_http_methods

from workspace.models import ClientePedido, Pedido, ProdutoPedido


SESSAO_INICIO_LOGIN = "inicio_login"
MAX_SESSOES_ADMIN = 3


def _usuario_com_limite_admin(user):
    return bool(user and (user.role == "admin" or user.is_staff or user.is_superuser))


def _inicio_da_sessao(session, session_data):
    inicio = parse_datetime(session_data.get(SESSAO_INICIO_LOGIN, "") or "")
    return inicio or session.expire_date


def _sessoes_ativas_do_usuario(user):
    sessoes = []
    for session in Session.objects.filter(expire_date__gte=timezone.now()):
        session_data = session.get_decoded()
        if session_data.get("_auth_user_id") == str(user.id):
            sessoes.append((session, session_data))
    return sessoes


def _encerrar_sessoes_excedentes(user, current_session_key, max_sessoes):
    sessoes_antigas = sorted(
        (
            (session, session_data)
            for session, session_data in _sessoes_ativas_do_usuario(user)
            if session.session_key != current_session_key
        ),
        key=lambda item: _inicio_da_sessao(item[0], item[1]),
    )
    excedentes = len(sessoes_antigas) - max(max_sessoes - 1, 0)
    if excedentes <= 0:
        return

    for session, _session_data in sessoes_antigas[:excedentes]:
        session.delete()


def login(request, client=None):
    if request.user.is_authenticated:
        return redirect("home")

    error_message = None

    if request.method == "POST":
        username = request.POST.get("usuario")
        password = request.POST.get("senha")
        user = authenticate(request, username=username, password=password)

        if user is not None:
            auth_login(request, user)
            request.session[SESSAO_INICIO_LOGIN] = timezone.now().isoformat()
            current_session_key = request.session.session_key

            if _usuario_com_limite_admin(user):
                _encerrar_sessoes_excedentes(user, current_session_key, MAX_SESSOES_ADMIN)
            else:
                _encerrar_sessoes_excedentes(user, current_session_key, 1)

            return redirect("home")

        error_message = "Usuario ou senha invalidos."

    return render(request, "workspace/login.html", {"error_message": error_message})


def esqueci_minha_senha(request):
    return render(request, "registration/esqueci_minha_senha.html")


class ResetSenhaConfirmView(auth_views.PasswordResetConfirmView):
    pass


class ResetSenhaCompleteView(auth_views.PasswordResetCompleteView):
    pass


@login_required
def home(request):
    pedidos_qs = Pedido.objects.select_related("cliente").prefetch_related("itens")
    pedidos_lista = list(pedidos_qs)
    pedidos_abertos = [
        pedido for pedido in pedidos_lista
        if pedido.status not in {Pedido.STATUS_ENTREGUE, Pedido.STATUS_CANCELADO}
    ]
    pedidos_recentes = pedidos_lista[:5]
    valor_em_aberto = sum((pedido.total for pedido in pedidos_abertos), 0)

    return render(request, "workspace/home.html", {
        "total_pedidos": len(pedidos_lista),
        "pedidos_abertos": len(pedidos_abertos),
        "pedidos_atrasados": sum(1 for pedido in pedidos_lista if pedido.atrasado),
        "pedidos_faturados": sum(1 for pedido in pedidos_lista if pedido.status == Pedido.STATUS_FATURADO),
        "pedidos_enviados": sum(1 for pedido in pedidos_lista if pedido.status == Pedido.STATUS_ENVIADO),
        "total_clientes": ClientePedido.objects.count(),
        "total_produtos": ProdutoPedido.objects.count(),
        "valor_em_aberto": valor_em_aberto,
        "pedidos_recentes": pedidos_recentes,
    })


@login_required
def reset_senha_logado(request):
    return render(request, "registration/password_change_workspace.html")


@require_http_methods(["GET", "POST"])
def request_logout(request):
    logout(request)
    return redirect("login")
