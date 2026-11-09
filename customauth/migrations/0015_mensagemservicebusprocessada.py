from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('customauth', '0014_carteira_diretor_default_10'),
    ]

    operations = [
        migrations.CreateModel(
            name='MensagemServiceBusProcessada',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('message_id', models.CharField(db_index=True, max_length=255, unique=True)),
                ('tipo', models.CharField(max_length=100)),
                ('processado_em', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'verbose_name': 'Mensagem Service Bus Processada',
                'verbose_name_plural': 'Mensagens Service Bus Processadas',
            },
        ),
    ]
