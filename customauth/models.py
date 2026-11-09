from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.db import models
from django.conf import settings
from django.templatetags.static import static

def validate_cpf(value):
    if len(value) != 11:
        raise ValidationError('CPF deve ter 11 dígitos')
    if not value.isdigit():
        raise ValidationError('CPF deve conter apenas dígitos')
    if len(set(value)) == 1:
        raise ValidationError('CPF inválido')
    cpf = [int(digit) for digit in value]
    cpf = cpf[:9]
    while len(cpf) < 11:
        r = sum([(len(cpf) + 1 - i) * v for i, v in enumerate(cpf)]) % 11
        if r > 1:
            f = 11 - r
        else:
            f = 0
        cpf.append(f)
    if cpf != [int(digit) for digit in value]:
        raise ValidationError('CPF inválido')

def validate_cnpj(value):
    if len(value) != 14:
        raise ValidationError('CNPJ deve ter 14 dígitos')
    if not value.isdigit():
        raise ValidationError('CNPJ deve conter apenas dígitos')
    cnpj = [int(digit) for digit in value]
    validate = cnpj[:12]
    s = sum([((i % 8) + 2) * v for i, v in enumerate(reversed(validate))])
    d = s % 11
    if d < 2:
        d = 0
    else:
        d = 11 - d
    validate.append(d)
    s = sum([((i % 8) + 2) * v for i, v in enumerate(reversed(validate))])
    d = s % 11
    if d < 2:
        d = 0
    else:
        d = 11 - d
    validate.append(d)
    if validate != [int(digit) for digit in value]:
        raise ValidationError('CNPJ inválido')

class Unidade(models.Model):
    nome = models.CharField(max_length=255)

    def __str__(self):
        return self.nome

class LogoParceiro(models.Model):
    """Catálogo de logos de parceiros que podem ser exibidos na navbar.

    Cada Cliente escolhe, entre os logos cadastrados aqui, quais devem
    aparecer para os usuários vinculados a ele.
    """
    nome = models.CharField(max_length=100)
    imagem = models.ImageField(
        upload_to='logos_parceiros/',
        blank=True,
        null=True,
        help_text='Upload direto (fica em media/). Use apenas se o logo não '
                   'existir em static/imagens — o servidor local não serve '
                   'media/ com DEBUG=False.',
    )
    caminho_estatico = models.CharField(
        'Caminho em static/',
        max_length=255,
        blank=True,
        help_text='Caminho relativo dentro de static/, ex: imagens/dnr3.png. '
                   'Se preenchido, tem prioridade sobre o upload acima.',
    )
    ordem = models.PositiveSmallIntegerField(
        default=0,
        help_text='Define a ordem de exibição na navbar (menor primeiro).',
    )

    class Meta:
        verbose_name = 'Logo de parceiro'
        verbose_name_plural = 'Logos de parceiros'
        ordering = ['ordem', 'nome']

    def __str__(self):
        return self.nome

    def get_url(self):
        """Retorna a URL do logo, priorizando o caminho em static/ (mais
        confiável em ambiente local, onde media/ pode não ser servido)."""
        if self.caminho_estatico:
            return static(self.caminho_estatico)
        if self.imagem:
            return self.imagem.url
        return ''


class Cliente(models.Model):
    nome = models.CharField(max_length=255)
    slug = models.SlugField(max_length=100, unique=True)
    logos = models.ManyToManyField(
        LogoParceiro,
        blank=True,
        related_name='clientes',
        verbose_name='Logos exibidos na navbar',
    )

    class Meta:
        verbose_name = 'Cliente'
        verbose_name_plural = 'Clientes'

    def __str__(self):
        return self.nome

class Empresa(models.Model):
    class CategoriaDashboard(models.TextChoices):
        """Categorias conhecidas, usadas no código (decorators/views) e como
        referência de digitação no admin. O campo `categoria_dashboard` NÃO
        restringe a esses valores — é texto livre — para permitir liberar
        um item novo do menu (ex: um dropdown do Monitoramento) sem precisar
        de alteração de código/migration: basta digitar aqui o mesmo texto
        usado no `{% if 'categoria' in dashboards_liberados %}` do template.
        """
        GERENCIAL = 'gerencial', 'Dashboard Gerencial'
        ACOMPANHAMENTO = 'acompanhamento', 'Dashboard de Acompanhamento'
        OPERACIONAL = 'operacional', 'Dashboard Operacional'
        METAS_CONTROLES = 'metas_controles', 'Dashboard de Metas e Controles'
        CAPACITY = 'capacity', 'Dashboard de Capacity'
        PRODUCAO_PENDENTE = 'producao_pendente', 'Conferência de Envios Diários'
        PROCESSAMENTO = 'processamento', 'Processamento'

    nome = models.CharField(max_length=255)
    razao_social = models.CharField(max_length=255)
    cnpj = models.CharField(max_length=14, validators=[validate_cnpj])
    unidades = models.ManyToManyField(Unidade, related_name='empresas')
    link_bi = models.URLField(
        'link do BI',
        max_length=2048,
        blank=True,
    )
    categoria_dashboard = models.CharField(
        'categoria do dashboard',
        max_length=30,
        blank=True,
        help_text=(
            'Texto livre — precisa ser IDÊNTICO ao usado no template '
            '(ex: "processamento", "capacity"). Veja Empresa.CategoriaDashboard '
            'no código para as categorias já existentes. Erro de digitação '
            'aqui faz a liberação simplesmente não funcionar, sem aviso.'
        ),
    )
    cliente = models.ForeignKey(
        Cliente,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='empresas'
    )

    def __str__(self):
        return self.nome

class Empresa_filtro(models.Model):
    nome = models.CharField(max_length=255)

    def __str__(self):
        return self.nome

class CustomUser(AbstractUser):
    ROLE_CHOICES = [
        ('lider', 'Líder'),
        ('admin', 'Admin'),
        ('gestor', 'Gestor'),
        ('head', 'Head'),
        ('diretoria', 'Diretoria'),
        ('rh', 'RH'),
        ('user', 'Usuario'),
        ('socio', 'Socio')
    ]

    class ProjetosGrupo(models.TextChoices):
        SISTEMAS = 'sistemas', 'Sistemas'
        INFRAESTRUTURA = 'infraestrutura', 'Infraestrutura'
        CONTROL = 'control', 'Control'
        SI = 'si', 'SI'
        DNR = 'dnr', 'DNR'
        DEALERS = 'dealers', 'Dealers'
        EXTERNO = 'externo', 'Externo'
    nome = models.CharField(max_length=100, default='')
    cpf = models.CharField(max_length=11, validators=[validate_cpf], blank=True, null=True)
    cnpj = models.CharField(max_length=14, validators=[validate_cnpj], blank=True, null=True)
    empresa = models.CharField(max_length=100, blank=True, null=True)  # Empresa onde a pessoa trabalha
    carteiras = models.ManyToManyField(Empresa, blank=True, related_name='usuarios')  # Relação com carteiras
    supervisor = models.CharField(max_length=100, blank=True, null=True)
    unidades = models.ManyToManyField(Unidade, blank=True, related_name='usuarios')
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='user')
    acesso_solicitacoes = models.BooleanField(
        'Acesso a Tarefas e Solicitações',
        default=False,
        help_text='Libera o menu "Abrir solicitação" e "Meus Envios" na navbar.',
    )
    acesso_importacoes = models.BooleanField(
        'Acesso a Importações',
        default=False,
        help_text='Libera o menu "Upload de Arquivos" (Importações) na navbar.',
    )
    acesso_projetos = models.BooleanField(
        'Acesso a Projetos',
        default=False,
        db_index=True,
        help_text='Libera o menu "Projetos" (Gestão de Projetos) na navbar.',
    )
    projetos_owner = models.BooleanField(
        'Pode ser Owner de Projetos',
        default=False,
        db_index=True,
        help_text='Quando marcado, o usuário aparece na seleção de Owner do módulo Projetos.',
    )
    projetos_grupo = models.CharField(
        'Grupo de Projetos',
        max_length=30,
        choices=ProjetosGrupo.choices,
        blank=True,
        default='',
        db_index=True,
        help_text='Grupo/área padrão utilizado pelo módulo Projetos.',
    )
    cliente = models.ForeignKey(
        Cliente,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='usuarios_cliente'
    )

    def tem_acesso_dashboard(self, categoria):
        """Verifica se o usuário possui alguma carteira (Empresa) liberada
        para a categoria de dashboard informada.

        A liberação é feita atribuindo, no CustomUser (admin > carteiras),
        empresas cuja `categoria_dashboard` corresponda ao dashboard desejado.
        """
        return self.carteiras.filter(categoria_dashboard=categoria).exists()

    def categorias_dashboard_liberadas(self):
        """Retorna o conjunto de categorias de dashboard que o usuário
        pode visualizar, com base nas carteiras (Empresa) vinculadas."""
        return set(
            self.carteiras.exclude(categoria_dashboard='')
            .values_list('categoria_dashboard', flat=True)
        )

    def save(self, *args, **kwargs):
        if self.nome:
            self.nome = " ".join(self.nome.split()).upper()
            partes_do_nome = self.nome.split()
            self.first_name = partes_do_nome[0].capitalize()  # Primeiro nome com a primeira letra maiúscula
            self.last_name = partes_do_nome[-1].capitalize()  # Último nome com a primeira letra maiúscula
        
        super(CustomUser, self).save(*args, **kwargs)

    class Meta:
        verbose_name = 'User'
        verbose_name_plural = 'Users'


class Carteira(models.Model):
    TIPO_VALIDACAO = [
        ('HO', 'HO - VARIAVEL'),
        ('PA', 'PA - FIXA'),
    ]

    TIPO_PRODUCAO = [
        ('CASH', 'CASH'),
        ('RISCO', 'RISCO'),
        ('NUMERO', 'NUMERO'),
    ]

    ATUACAO_CARTEIRA = [
        ('MASSIVO', 'Massivo'),
        ('JURIDICO', 'Jurídico'),
        ('VEICULO', 'Veículo'),
        ('GARANTIA', 'Garantia'),
        ('EDUCACIONAL', 'Educacional'),
        ('OUTROS', 'Outros'),

    ]

    nome = models.CharField(max_length=150)
    empresa = models.ForeignKey(
        Empresa_filtro,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='carteiras'
    )

    tipo = models.CharField(
        max_length=2,
        choices=TIPO_VALIDACAO,
        blank=True,
        null=True
    )

    producao = models.CharField(
        max_length=6,
        choices=TIPO_PRODUCAO,
        blank=True,
        null=True
    )

    atuacao_carteira = models.CharField(
        max_length=15,
        choices=ATUACAO_CARTEIRA,
        blank=True,
        null=True,
        verbose_name='Atuação da Carteira'
    )

    digital = models.BooleanField(
        default=False,
        verbose_name='Digital'
    )

    diretor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='carteiras_como_diretor'
    )
    superintendente = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='carteiras_como_superintendente'
    )
    gerente = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='carteiras_como_gerente'
    )
    coordenador = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='carteiras_como_coordenador'
    )

    def __str__(self):
        return self.nome
    
class MensagemServiceBusProcessada(models.Model):
    message_id = models.CharField(max_length=255, unique=True, db_index=True)
    tipo = models.CharField(max_length=100)
    processado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Mensagem Service Bus Processada'
        verbose_name_plural = 'Mensagens Service Bus Processadas'

    def __str__(self):
        return f'{self.tipo} - {self.message_id}'


class HistoricoCarteira(models.Model):
    carteira = models.ForeignKey(
        'Carteira',
        on_delete=models.CASCADE,
        related_name='historicos'
    )

    diretor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='historico_carteira_diretor'
    )
    superintendente = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='historico_carteira_superintendente'
    )
    gerente = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='historico_carteira_gerente'
    )
    coordenador = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='historico_carteira_coordenador'
    )

    alterado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='historico_carteira_alterado_por'
    )

    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Histórico da carteira'
        verbose_name_plural = 'Históricos da carteira'
        ordering = ['-criado_em']

    def __str__(self):
        return f'{self.carteira.nome} - {self.criado_em.strftime("%d/%m/%Y %H:%M:%S")}'
