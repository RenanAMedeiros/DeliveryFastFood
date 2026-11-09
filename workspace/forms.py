from django import forms
from django.contrib.auth.forms import UserCreationForm, UserChangeForm
from customauth.models import CustomUser,Carteira
from django.core.exceptions import ValidationError
from datetime import date
from django.utils import timezone
from workspace.models import Capacity, MetaCarteiraMensal
from django.forms.models import construct_instance


class CapacityAdminForm(forms.ModelForm):
    competencia = forms.DateField(
        label='Mês/Ano do capacity',
        input_formats=['%Y-%m', '%Y-%m-%d'],
        widget=forms.DateInput(
            format='%Y-%m',
            attrs={'type': 'month'},
        ),
    )

    class Meta:
        model = Capacity
        fields = '__all__'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if not self.instance.pk:
            self.fields['supervisor_operacional'].required = True
            self.fields['carteira'].required = True

    def clean(self):
        cleaned_data = super().clean()
        responsavel = cleaned_data.get('supervisor_operacional')
        carteira = cleaned_data.get('carteira')
        competencia = cleaned_data.get('competencia')

        if responsavel and not self.instance.responsavel_nome:
            self.instance.responsavel_nome = (
                responsavel.nome
                or responsavel.get_full_name()
                or responsavel.username
            )
        if carteira and not self.instance.carteira_nome:
            self.instance.carteira_nome = carteira.nome

        if carteira and competencia:
            existente = Capacity.objects.filter(
                carteira_nome__iexact=carteira.nome,
                competencia=date(competencia.year, competencia.month, 1),
            )
            if self.instance.pk:
                existente = existente.exclude(pk=self.instance.pk)
            if existente.exists():
                self.add_error(
                    'carteira',
                    'Já existe um capacity desta carteira para a competência selecionada.',
                )

        return cleaned_data

    def clean_competencia(self):
        competencia = self.cleaned_data['competencia']
        return date(competencia.year, competencia.month, 1)


class MetaCarteiraMensalAdminForm(forms.ModelForm):
    competencia = forms.DateField(
        label='Mês/Ano',
        input_formats=['%Y-%m', '%Y-%m-%d'],
        widget=forms.DateInput(
            format='%Y-%m',
            attrs={'type': 'month'}
        )
    )

    existing_instance = None

    class Meta:
        model = MetaCarteiraMensal
        fields = '__all__'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        # desliga a checagem duplicada do model durante a validação do form
        self.instance._skip_duplicate_check = True
        self._validate_unique = False

    def validate_unique(self):
        # o admin vai decidir se cria ou se atualiza o já existente
        return

    def clean(self):
        cleaned_data = super().clean()

        carteira = cleaned_data.get('carteira')
        competencia = cleaned_data.get('competencia')

        if competencia:
            competencia = date(competencia.year, competencia.month, 1)
            cleaned_data['competencia'] = competencia
            self.instance.competencia = competencia

        if carteira and competencia:
            qs = MetaCarteiraMensal.objects.filter(
                carteira=carteira,
                competencia=competencia
            )

            if self.instance.pk:
                qs = qs.exclude(pk=self.instance.pk)

            self.existing_instance = qs.first()

        return cleaned_data

    def _post_clean(self):
        """
        Impede o ModelForm de barrar o UniqueConstraint durante form.is_valid().
        Assim a duplicidade é tratada no admin com tela de confirmação.
        """
        opts = self._meta

        self.instance = construct_instance(
            self,
            self.instance,
            opts.fields,
            opts.exclude
        )

        exclude = self._get_validation_exclusions()

        try:
            self.instance.full_clean(
                exclude=exclude,
                validate_unique=False,
                validate_constraints=False,
            )
        except ValidationError as e:
            self._update_errors(e)
