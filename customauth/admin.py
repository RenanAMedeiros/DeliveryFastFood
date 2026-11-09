from django.contrib import admin ,messages
from datetime import date
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import CustomUser, Empresa, Empresa_filtro, Unidade , Carteira ,HistoricoCarteira, Cliente, LogoParceiro
from .forms import CustomUserCreationForm, CustomUserChangeForm , CarteiraAdminForm, EmpresaAdminForm
from django.core.exceptions import ValidationError
from django.urls import reverse_lazy
from django.utils.html import format_html
from hijack.contrib.admin import HijackUserAdminMixin
from unfold.admin import ModelAdmin as UnfoldModelAdmin, TabularInline

SENHA_PADRAO_RESET = 'Trocarsenha@@5966'
CLIENTE_PROTEGIDO_RESET = 'QORE TECNOLOGIA'


def resetar_senha_colaboradores(modeladmin, request, queryset):
    """Reseta a senha para SENHA_PADRAO_RESET dos usuários selecionados,
    preservando automaticamente staff/superusuário e o cliente QORE TECNOLOGIA
    mesmo que estejam marcados na seleção.
    """
    protegidos = queryset.filter(
        cliente__nome__iexact=CLIENTE_PROTEGIDO_RESET
    ) | queryset.filter(is_staff=True) | queryset.filter(is_superuser=True)
    ids_protegidos = set(protegidos.values_list('id', flat=True))

    afetados = queryset.exclude(id__in=ids_protegidos)
    total = afetados.count()

    for user in afetados:
        user.set_password(SENHA_PADRAO_RESET)
        user.save(update_fields=['password'])

    ignorados = len(ids_protegidos)
    modeladmin.message_user(
        request,
        f'Senha resetada para {total} usuário(s). '
        f'{ignorados} ignorado(s) por serem staff/superusuário ou do cliente {CLIENTE_PROTEGIDO_RESET}.',
        level=messages.SUCCESS,
    )


resetar_senha_colaboradores.short_description = (
    f'Resetar senha ({SENHA_PADRAO_RESET}) — protege {CLIENTE_PROTEGIDO_RESET} e staff'
)

class StatusColaboradorFilter(admin.SimpleListFilter):
    """Por padrão a listagem mostra apenas colaboradores ativos.

    Os inativos só aparecem em dois casos: quando o suporte faz uma busca
    (campo `q`) ou quando escolhe explicitamente uma das opções do filtro.
    """

    title = 'situação'
    parameter_name = 'situacao'

    OPCOES = (
        (None, 'Somente ativos (padrão)'),
        ('inativos', 'Somente inativos'),
        ('todos', 'Ativos e inativos'),
    )

    def lookups(self, request, model_admin):
        return [
            (valor, label)
            for valor, label in self.OPCOES
            if valor is not None
        ]

    def choices(self, changelist):
        for valor, label in self.OPCOES:
            if valor is None:
                query_string = changelist.get_query_string(
                    remove=[self.parameter_name]
                )
            else:
                query_string = changelist.get_query_string(
                    {self.parameter_name: valor}
                )

            yield {
                'selected': self.value() == valor,
                'query_string': query_string,
                'display': label,
            }

    def queryset(self, request, queryset):
        valor = self.value()

        if valor == 'todos':
            return queryset

        if valor == 'inativos':
            return queryset.filter(is_active=False)

        # Nada escolhido: a busca alcança todo mundo, a listagem "limpa" não.
        if request.GET.get('q'):
            return queryset

        return queryset.filter(is_active=True)


# Configuração do Django Admin para o modelo CustomUser
class CustomUserAdmin(HijackUserAdminMixin, BaseUserAdmin, UnfoldModelAdmin):
    # Após impersonar, cai na home do Workspace ('/' não tem rota no projeto).
    hijack_success_url = reverse_lazy('home')

    add_form = CustomUserCreationForm
    form = CustomUserChangeForm
    model = CustomUser
    list_display = ['username', 'email', 'nome', 'role', 'cliente', 'projetos_grupo', 'projetos_owner', 'acesso_solicitacoes', 'acesso_importacoes', 'acesso_projetos', 'is_staff', 'is_active']
    list_filter = [StatusColaboradorFilter, 'is_staff', 'cliente', 'projetos_grupo', 'projetos_owner', 'acesso_solicitacoes', 'acesso_importacoes', 'acesso_projetos']
    filter_horizontal = ('carteiras', 'unidades',)  # Mantém o widget de seleção horizontal para carteiras e unidades

    fieldsets = (
        (None, {'fields': ('username', 'password')}),
        ('Personal info', {'fields': ('email','role', 'nome', 'cpf', 'cnpj', 'empresa', 'cliente', 'carteiras', 'supervisor', 'unidades')}),
        ('Permissões de módulos', {'fields': ('acesso_solicitacoes', 'acesso_importacoes', 'acesso_projetos')}),
        ('Projetos', {'fields': ('projetos_owner', 'projetos_grupo')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Important dates', {'fields': ('last_login', 'date_joined')}),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('username', 'email', 'role', 'nome', 'cpf', 'cnpj', 'empresa', 'cliente', 'carteiras', 'supervisor', 'unidades', 'projetos_owner', 'projetos_grupo', 'acesso_solicitacoes', 'acesso_importacoes', 'acesso_projetos', 'password1', 'password2', 'is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions'),
        }),
    )

    def formfield_for_manytomany(self, db_field, request, **kwargs):
        if db_field.name == 'carteiras' and request._obj_ is not None:
            # Filtra as carteiras para mostrar apenas as associadas às unidades do usuário
            unidades = request._obj_.unidades.all()
            kwargs["queryset"] = Empresa.objects.filter(unidades__in=unidades).distinct()
        return super().formfield_for_manytomany(db_field, request, **kwargs)

    search_fields = ('username', 'email', 'nome')
    ordering = ('username',)
    actions = [resetar_senha_colaboradores]

    def get_form(self, request, obj=None, **kwargs):
        # Guarda o objeto sendo editado para usá-lo em formfield_for_manytomany
        request._obj_ = obj
        return super(CustomUserAdmin, self).get_form(request, obj, **kwargs)

    # ── Acesso restrito a superusuário ────────────────────────────────────
    # A listagem de colaboradores (e, junto com ela, o botão de personificar
    # que o HijackUserAdminMixin injeta na última coluna) fica só para
    # superusuário. Sem isto bastaria marcar alguém como staff e conceder a
    # permission 'view_customuser' para essa pessoa enxergar a base inteira
    # de usuários. O botão de personificar em si já era superusers_only por
    # causa do HIJACK_PERMISSION_CHECK; aqui a listagem passa a seguir a
    # mesma regra, em vez de depender de o admin não distribuir a permission.
    #
    # has_module_permission também esconde o item no menu lateral do Unfold —
    # os demais modelos do app (Empresa, Cliente, Carteira...) continuam
    # visíveis normalmente para quem tiver permissão neles.

    def has_module_permission(self, request):
        return request.user.is_superuser

    def has_view_permission(self, request, obj=None):
        return request.user.is_superuser

    def has_add_permission(self, request):
        return request.user.is_superuser

    def has_change_permission(self, request, obj=None):
        return request.user.is_superuser

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser

# Configuração do Django Admin para o modelo Empresa
class EmpresaAdmin(UnfoldModelAdmin):
    model = Empresa
    form = EmpresaAdminForm
    list_display = [
        'nome',
        'razao_social',
        'cnpj',
        'categoria_dashboard',
        'link_bi',
        'cliente',
    ]
    list_filter = ['cliente', 'categoria_dashboard']
    search_fields = ['nome', 'cnpj', 'link_bi']
    filter_horizontal = ('unidades',)  # Mantém o widget de seleção horizontal para unidades


class ClienteAdmin(UnfoldModelAdmin):
    model = Cliente
    list_display = ['nome', 'slug']
    search_fields = ['nome', 'slug']
    prepopulated_fields = {'slug': ('nome',)}
    filter_horizontal = ('logos',)  # Seleciona quais logos aparecem na navbar para este cliente


class LogoParceiroAdmin(UnfoldModelAdmin):
    model = LogoParceiro
    list_display = ['nome', 'ordem', 'caminho_estatico', 'preview']
    search_fields = ['nome', 'caminho_estatico']
    ordering = ['ordem', 'nome']
    fields = ['nome', 'caminho_estatico', 'imagem', 'ordem']

    def preview(self, obj):
        url = obj.get_url()
        if not url:
            return '—'
        return format_html(
            '<img src="{}" style="height:28px;width:auto;">',
            url,
        )
    preview.short_description = 'Prévia'



class EmpresaFiltroAdmin(UnfoldModelAdmin):
    model = Empresa_filtro
    list_display = ['nome']
    search_fields = ['nome']


class HistoricoCarteiraInline(TabularInline):
    model = HistoricoCarteira
    extra = 0
    can_delete = False
    readonly_fields = (
        'diretor',
        'superintendente',
        'gerente',
        'coordenador',
        'alterado_por',
        'criado_em',
    )
    autocomplete_fields = ('superintendente', 'gerente', 'coordenador', 'alterado_por')

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Carteira)
class CarteiraAdmin(UnfoldModelAdmin):
    form = CarteiraAdminForm

    list_display = ['nome', 'empresa', 'tipo', 'producao', 'atuacao_carteira', 'digital', 'diretor', 'superintendente', 'gerente', 'coordenador']
    search_fields = ['nome']
    list_filter = ['empresa', 'tipo', 'producao', 'atuacao_carteira', 'digital']
    autocomplete_fields = ['diretor', 'superintendente', 'gerente', 'coordenador']
    inlines = [HistoricoCarteiraInline]

    fieldsets = (
        ('Dados da Carteira', {
            'fields': ('nome', 'empresa', 'tipo', 'producao', 'atuacao_carteira', 'digital')
        }),
        ('Responsáveis Atuais', {
            'fields': (
                'diretor',
                'superintendente',
                'gerente',
                'coordenador',
                'confirmar_nova_alteracao_mes_atual',
            )
        }),
    )

    def get_changeform_initial_data(self, request):
        return {'diretor': 10}

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)

        ultimo_historico = obj.historicos.order_by('-criado_em').first()

        if not ultimo_historico:
            HistoricoCarteira.objects.create(
                carteira=obj,
                diretor=obj.diretor,
                superintendente=obj.superintendente,
                gerente=obj.gerente,
                coordenador=obj.coordenador,
                alterado_por=request.user,
            )
            return

        houve_mudanca = (
            ultimo_historico.diretor_id != obj.diretor_id
            or ultimo_historico.superintendente_id != obj.superintendente_id
            or ultimo_historico.gerente_id != obj.gerente_id
            or ultimo_historico.coordenador_id != obj.coordenador_id
        )

        if houve_mudanca:
            HistoricoCarteira.objects.create(
                carteira=obj,
                diretor=obj.diretor,
                superintendente=obj.superintendente,
                gerente=obj.gerente,
                coordenador=obj.coordenador,
                alterado_por=request.user,
            )

            self.message_user(
                request,
                'Novo histórico criado com sucesso. O registro anterior foi preservado.',
                level=messages.SUCCESS
            )


# Registro dos modelos no admin
admin.site.register(CustomUser, CustomUserAdmin)
admin.site.register(Empresa, EmpresaAdmin)
admin.site.register(Empresa_filtro, EmpresaFiltroAdmin)
admin.site.register(Unidade, UnfoldModelAdmin)
admin.site.register(Cliente, ClienteAdmin)
admin.site.register(LogoParceiro, LogoParceiroAdmin)


