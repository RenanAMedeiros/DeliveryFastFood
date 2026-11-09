from django.contrib import admin
from django.utils import timezone
from unfold.admin import ModelAdmin as UnfoldModelAdmin

from .models import Notificacao


@admin.register(Notificacao)
class NotificacaoAdmin(UnfoldModelAdmin):
    list_display = (
        'titulo',
        'usuario',
        'tipo',
        'is_read',
        'created_at',
        'lido_em',
        'criado_por',
    )
    list_filter = ('is_read', 'tipo', 'created_at')
    list_editable = ('is_read',)
    search_fields = (
        'titulo',
        'mensagem',
        'usuario__username',
        'usuario__nome',
        'usuario__email',
    )
    autocomplete_fields = ('usuario',)
    readonly_fields = ('criado_por', 'created_at', 'lido_em')
    date_hierarchy = 'created_at'
    ordering = ('-created_at',)
    actions = ('marcar_como_lidas', 'marcar_como_nao_lidas')
    fieldsets = (
        ('Destinatário', {
            'fields': ('usuario',),
        }),
        ('Conteúdo', {
            'fields': ('titulo', 'mensagem', 'tipo', 'link'),
        }),
        ('Estado', {
            'fields': ('is_read', 'lido_em'),
        }),
        ('Controle', {
            'fields': ('criado_por', 'created_at'),
            'classes': ('collapse',),
        }),
    )

    @admin.action(description='Marcar notificações selecionadas como lidas')
    def marcar_como_lidas(self, request, queryset):
        queryset.update(is_read=True, lido_em=timezone.now())

    @admin.action(description='Marcar notificações selecionadas como não lidas')
    def marcar_como_nao_lidas(self, request, queryset):
        queryset.update(is_read=False, lido_em=None)

    def save_model(self, request, obj, form, change):
        if not change and not obj.criado_por:
            obj.criado_por = request.user
        super().save_model(request, obj, form, change)
