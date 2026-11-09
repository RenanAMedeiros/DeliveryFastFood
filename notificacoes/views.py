from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.utils import timezone
from django.utils.timesince import timesince
from django.views.decorators.http import require_GET, require_POST

from .models import Notificacao


def _serializar_notificacao(notificacao):
    return {
        'id': notificacao.id,
        'titulo': notificacao.titulo,
        'mensagem': notificacao.mensagem,
        'tipo': notificacao.tipo,
        'link': notificacao.link or '',
        'lida': notificacao.is_read,
        'created_at': timezone.localtime(notificacao.created_at).strftime(
            '%d/%m/%Y %H:%M'
        ),
        'tempo_decorrido': f'{timesince(notificacao.created_at)} atrás',
    }


def _notificacoes_nao_lidas(request):
    return (
        Notificacao.objects
        .do_usuario(request.user)
        .nao_lidas()
        .order_by('-created_at')
    )


@login_required
@require_GET
def obter_notificacoes(request):
    notificacoes = _notificacoes_nao_lidas(request)[:50]
    dados = [_serializar_notificacao(item) for item in notificacoes]
    return JsonResponse({
        'notificacoes': dados,
        'nao_lidas': len(dados),
    })


@login_required
@require_GET
def listar_notificacoes(request):
    return obter_notificacoes(request)


@login_required
@require_POST
def marcar_notificacoes_como_lidas(request):
    total = _notificacoes_nao_lidas(request).update(
        is_read=True,
        lido_em=timezone.now(),
    )
    return JsonResponse({'status': 'success', 'atualizadas': total})


@login_required
@require_POST
def marcar_notificacao_como_lida(request, notificacao_id):
    atualizadas = (
        Notificacao.objects
        .do_usuario(request.user)
        .filter(pk=notificacao_id, is_read=False)
        .update(is_read=True, lido_em=timezone.now())
    )

    if not atualizadas:
        existe = (
            Notificacao.objects
            .do_usuario(request.user)
            .filter(pk=notificacao_id)
            .exists()
        )
        if existe:
            return JsonResponse({'status': 'success', 'atualizadas': 0})
        return JsonResponse(
            {'status': 'error', 'message': 'Notificação não encontrada.'},
            status=404,
        )

    return JsonResponse({'status': 'success', 'atualizadas': atualizadas})
