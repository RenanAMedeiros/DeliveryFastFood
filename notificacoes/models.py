from django.conf import settings
from django.db import models
from django.utils import timezone


class NotificacaoQuerySet(models.QuerySet):
    def nao_lidas(self):
        return self.filter(is_read=False)

    def do_usuario(self, usuario):
        return self.filter(usuario=usuario)


class Notificacao(models.Model):
    TIPO_GERAL = 'geral'
    TIPO_CAPACITY = 'capacity'
    TIPO_MURAL = 'mural'
    TIPO_DOCUMENTACAO = 'documentacao'
    TIPO_CHOICES = (
        (TIPO_GERAL, 'Geral'),
        (TIPO_CAPACITY, 'Capacity'),
        (TIPO_MURAL, 'Mural'),
        (TIPO_DOCUMENTACAO, 'Documentação'),
    )

    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notificacoes',
        verbose_name='Destinatário',
    )
    titulo = models.CharField(
        'Título',
        max_length=120,
        default='Nova notificação',
    )
    mensagem = models.TextField('Mensagem')
    tipo = models.CharField(
        'Tipo',
        max_length=20,
        choices=TIPO_CHOICES,
        default=TIPO_GERAL,
    )
    link = models.CharField(
        'Link de destino',
        max_length=500,
        blank=True,
        help_text='Aceita caminhos internos, como /mural/, ou uma URL completa.',
    )
    is_read = models.BooleanField('Lida', default=False)
    lido_em = models.DateTimeField('Lida em', null=True, blank=True)
    created_at = models.DateTimeField('Criada em', auto_now_add=True)
    criado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name='notificacoes_criadas',
        verbose_name='Criada por',
        null=True,
        blank=True,
    )

    objects = NotificacaoQuerySet.as_manager()

    class Meta:
        verbose_name = 'Notificação'
        verbose_name_plural = 'Notificações'
        ordering = ('-created_at',)
        indexes = [
            models.Index(
                fields=('usuario', 'is_read', '-created_at'),
                name='notif_user_read_created_idx',
            ),
        ]

    def __str__(self):
        return f'{self.titulo} — {self.usuario}'

    def marcar_como_lida(self):
        if self.is_read:
            return

        self.is_read = True
        self.lido_em = timezone.now()
        self.save(update_fields=('is_read', 'lido_em'))

    def marcar_como_nao_lida(self):
        if not self.is_read and self.lido_em is None:
            return

        self.is_read = False
        self.lido_em = None
        self.save(update_fields=('is_read', 'lido_em'))

    def save(self, *args, **kwargs):
        if self.is_read and self.lido_em is None:
            self.lido_em = timezone.now()
        elif not self.is_read:
            self.lido_em = None

        if kwargs.get('update_fields') is not None:
            kwargs['update_fields'] = set(kwargs['update_fields']) | {'lido_em'}

        super().save(*args, **kwargs)
