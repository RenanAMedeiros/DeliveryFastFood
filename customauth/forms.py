from django import forms
from django.contrib.auth.forms import UserCreationForm, UserChangeForm, PasswordResetForm
from .models import CustomUser, Carteira, Empresa
from .bases import base_do_usuario, base_login_valida
from django.core.exceptions import ValidationError
from django.utils.safestring import mark_safe
from django.utils.html import escape
from datetime import date
from django.utils import timezone


class DatalistTextInput(forms.TextInput):
    """Input de texto livre com sugestões via <datalist> HTML5.

    Permite digitar qualquer valor (não restringe como um <select>), mas
    sugere as opções já conhecidas — reduz erro de digitação sem perder a
    flexibilidade de criar categorias novas sem alteração de código.
    """

    def __init__(self, datalist_id, options=(), attrs=None):
        self.datalist_id = datalist_id
        self.options = options
        final_attrs = {'list': datalist_id, 'autocomplete': 'off'}
        if attrs:
            final_attrs.update(attrs)
        super().__init__(attrs=final_attrs)

    def render(self, name, value, attrs=None, renderer=None):
        input_html = super().render(name, value, attrs, renderer)
        options_html = ''.join(
            f'<option value="{escape(opt)}">' for opt in self.options
        )
        return mark_safe(
            f'{input_html}<datalist id="{self.datalist_id}">{options_html}</datalist>'
        )


def opcoes_categoria_dashboard():
    """Sugestões pro campo categoria_dashboard: enum conhecido + valores já
    usados no banco. Calculado na hora (não na importação do módulo) pra
    sempre refletir carteiras cadastradas depois do último restart."""
    conhecidas = [c[0] for c in Empresa.CategoriaDashboard.choices]
    usadas = list(
        Empresa.objects
        .exclude(categoria_dashboard='')
        .values_list('categoria_dashboard', flat=True)
        .distinct()
    )
    return sorted(set(conhecidas) | set(usadas))

class CustomUserCreationForm(UserCreationForm):
    class Meta:
        model = CustomUser
        fields = ('username', 'email', 'nome', 'cpf', 'cnpj', 'empresa', 'cliente', 'carteiras', 'supervisor', 'projetos_owner', 'projetos_grupo', 'acesso_projetos')

class CustomUserChangeForm(UserChangeForm):
    class Meta:
        model = CustomUser
        fields = ('username', 'email', 'nome', 'cpf', 'cnpj', 'empresa', 'cliente', 'carteiras', 'supervisor', 'projetos_owner', 'projetos_grupo', 'acesso_projetos', 'is_active', 'is_staff', 'is_superuser')

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # O tema Unfold renderiza help_text sem o filtro `|safe`, então o
        # link "<a href=...>esse form</a>" que o Django gera pro campo de
        # senha aparece escapado (texto literal) em vez de clicável. Marcar
        # como safe aqui contorna isso sem precisar alterar o pacote unfold.
        password = self.fields.get('password')
        if password:
            password.help_text = mark_safe(password.help_text)

class CustomPasswordResetForm(PasswordResetForm):
    """Reset de senha para usuários ativos, inclusive os sem senha utilizável.
 
    Usuários provisionados pela fila do Service Bus nascem com
    set_unusable_password(); o get_users() padrão do Django os descarta e o
    e-mail nunca é enviado. Para eles o reset é justamente o caminho de definir
    a primeira senha.
    """
 
    def get_users(self, email):
        return CustomUser._default_manager.filter(
            email__iexact=email,
            is_active=True,
        )

    def send_mail(self, subject_template_name, email_template_name, context,
                  from_email, to_email, html_email_template_name=None):
        """Disponibiliza a base do destinatário no template do e-mail.

        Como o e-mail é montado por usuário, o template consegue linkar o
        login da base dele (/login/<slug>/) em vez da tela de seleção.
        """
        context = dict(context)
        context['base_slug'] = base_login_valida(
            base_do_usuario(context['user'])
        )

        super().send_mail(
            subject_template_name,
            email_template_name,
            context,
            from_email,
            to_email,
            html_email_template_name=html_email_template_name,
        )



class EmpresaAdminForm(forms.ModelForm):
    class Meta:
        model = Empresa
        fields = '__all__'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        campo = self.fields['categoria_dashboard']
        # Preserva as classes CSS que o Unfold injeta no widget original
        # (formfield_for_dbfield), pra não perder o estilo do admin.
        campo.widget = DatalistTextInput(
            'categoria_dashboard_opcoes',
            options=opcoes_categoria_dashboard(),
            attrs=campo.widget.attrs,
        )


class CarteiraAdminForm(forms.ModelForm):
    confirmar_nova_alteracao_mes_atual = forms.BooleanField(
        required=False,
        label='Confirmo que desejo registrar uma nova alteração neste mesmo mês'
    )
    


    class Meta:
        model = Carteira
        fields = '__all__'

    def clean(self):
        cleaned_data = super().clean()

        if not self.instance.pk:
            return cleaned_data

        novo_diretor = cleaned_data.get('diretor')
        novo_superintendente = cleaned_data.get('superintendente')
        novo_gerente = cleaned_data.get('gerente')
        novo_coordenador = cleaned_data.get('coordenador')
        confirmar = cleaned_data.get('confirmar_nova_alteracao_mes_atual')

        ultimo_historico = self.instance.historicos.order_by('-criado_em').first()
        if not ultimo_historico:
            return cleaned_data

        agora = timezone.localtime()
        mesmo_mes = (
            ultimo_historico.criado_em.month == agora.month
            and ultimo_historico.criado_em.year == agora.year
        )

        houve_mudanca = (
            ultimo_historico.diretor_id != (novo_diretor.id if novo_diretor else None)
            or ultimo_historico.superintendente_id != (novo_superintendente.id if novo_superintendente else None)
            or ultimo_historico.gerente_id != (novo_gerente.id if novo_gerente else None)
            or ultimo_historico.coordenador_id != (novo_coordenador.id if novo_coordenador else None)
        )

        if mesmo_mes and houve_mudanca and not confirmar:
            raise ValidationError(
                'Já existe uma alteração registrada para esta carteira no mês atual. '
                'Marque a confirmação para criar um novo histórico sem substituir o anterior.'
            )

        return cleaned_data