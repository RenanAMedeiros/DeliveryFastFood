import json
import logging
import os
import signal
from threading import Event
from typing import Any

from azure.servicebus import (
    AutoLockRenewer,
    ServiceBusClient,
    ServiceBusReceiveMode,
)
from azure.servicebus.exceptions import (
    MessageLockLostError,
    ServiceBusError,
)
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import DatabaseError, close_old_connections, transaction

from customauth.models import MensagemServiceBusProcessada

logger = logging.getLogger(__name__)
User = get_user_model()


class PayloadInvalidoError(Exception):
    pass


class Command(BaseCommand):
    help = "Consome continuamente a fila de criação de usuários do Azure Service Bus."

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.stop_event = Event()
        self.connection_string = os.getenv("AZURE_SERVICEBUS_CONNECTION_STRING")
        self.queue_name = os.getenv("AZURE_SERVICEBUS_QUEUE_USUARIOS", "criacao-usuarios")

    def handle(self, *args, **options):
        if not self.connection_string:
            raise RuntimeError("AZURE_SERVICEBUS_CONNECTION_STRING não configurada.")
        if not self.queue_name:
            raise RuntimeError("AZURE_SERVICEBUS_QUEUE_USUARIOS não configurada.")

        signal.signal(signal.SIGTERM, self._solicitar_parada)
        signal.signal(signal.SIGINT, self._solicitar_parada)

        self.stdout.write(self.style.SUCCESS("Consumer de usuários iniciado."))
        self.stdout.write(f"Fila monitorada: {self.queue_name}")

        tempo_reconexao = 2

        while not self.stop_event.is_set():
            try:
                self._consumir_fila()
                tempo_reconexao = 2
            except ServiceBusError as erro:
                logger.exception("Erro de comunicação com o Service Bus.")
                self.stderr.write(self.style.ERROR(f"Service Bus desconectado: {erro}"))
                self.stop_event.wait(tempo_reconexao)
                tempo_reconexao = min(tempo_reconexao * 2, 60)
            except Exception as erro:
                logger.exception("Erro inesperado no consumer.")
                self.stderr.write(self.style.ERROR(f"Erro inesperado: {erro}"))
                self.stop_event.wait(tempo_reconexao)
                tempo_reconexao = min(tempo_reconexao * 2, 60)

        self.stdout.write(self.style.WARNING("Consumer de usuários finalizado."))

    def _solicitar_parada(self, signum, frame):
        self.stdout.write(self.style.WARNING(f"Sinal {signum} recebido. Encerrando..."))
        self.stop_event.set()

    def _consumir_fila(self):
        lock_renewer = AutoLockRenewer(max_lock_renewal_duration=300, max_workers=4)

        try:
            client = ServiceBusClient.from_connection_string(
                conn_str=self.connection_string,
                retry_total=10,
                retry_backoff_factor=1,
                retry_backoff_max=60,
                retry_mode="exponential",
            )

            with client:
                receiver = client.get_queue_receiver(
                    queue_name=self.queue_name,
                    receive_mode=ServiceBusReceiveMode.PEEK_LOCK,
                    prefetch_count=0,
                    auto_lock_renewer=lock_renewer,
                    client_identifier="consumer-criacao-usuarios",
                    socket_timeout=30,
                )

                with receiver:
                    self.stdout.write(self.style.SUCCESS("Conectado. Aguardando mensagens..."))

                    while not self.stop_event.is_set():
                        messages = receiver.receive_messages(max_message_count=5, max_wait_time=20)

                        if not messages:
                            continue

                        for message in messages:
                            if self.stop_event.is_set():
                                break
                            self._processar_mensagem(receiver, message)
        finally:
            lock_renewer.close(wait=True)

    def _processar_mensagem(self, receiver, message):
        message_id = str(message.message_id or message.sequence_number)

        try:
            payload = self._converter_para_json(message)
            self.stdout.write(f"Mensagem recebida: {message_id}")

            resultado = self._criar_usuario(message_id, payload)
            receiver.complete_message(message)

            self.stdout.write(self.style.SUCCESS(f"Concluída {message_id}: {resultado}"))

        except PayloadInvalidoError as erro:
            logger.warning("Mensagem inválida %s: %s", message_id, erro)
            self._dead_letter(receiver, message, "PayloadInvalido", str(erro))

        except DatabaseError as erro:
            logger.exception("Erro de banco na mensagem %s.", message_id)
            self._abandonar(receiver, message, erro)

        except MessageLockLostError:
            logger.warning("Lock perdido para %s. Será reentregue.", message_id)

        except ServiceBusError:
            raise

        except Exception as erro:
            logger.exception("Erro inesperado na mensagem %s.", message_id)
            delivery_count = int(getattr(message, "delivery_count", 0) or 0)
            if delivery_count >= 5:
                self._dead_letter(receiver, message, "LimiteDeTentativas", str(erro))
            else:
                self._abandonar(receiver, message, erro)

    @staticmethod
    def _converter_para_json(message) -> dict[str, Any]:
        body = message.body

        if isinstance(body, str):
            texto = body
        elif isinstance(body, (bytes, bytearray)):
            texto = bytes(body).decode("utf-8")
        else:
            partes = []
            for parte in body:
                partes.append(parte.encode("utf-8") if isinstance(parte, str) else bytes(parte))
            texto = b"".join(partes).decode("utf-8")

        try:
            payload = json.loads(texto)
        except json.JSONDecodeError as erro:
            raise PayloadInvalidoError(f"JSON inválido: {erro}") from erro

        if not isinstance(payload, dict):
            raise PayloadInvalidoError("O conteúdo da mensagem deve ser um objeto JSON.")

        return payload

    @staticmethod
    @transaction.atomic
    def _criar_usuario(message_id: str, payload: dict[str, Any]) -> str:
        close_old_connections()

        if MensagemServiceBusProcessada.objects.select_for_update().filter(message_id=message_id).exists():
            return "mensagem já processada anteriormente"

        tipo = str(payload.get("tipo", "")).strip().upper()

        if tipo != "CRIAR_USUARIO":
            raise PayloadInvalidoError(f"Tipo não suportado: {tipo!r}")

        dados = payload.get("dados")

        if not isinstance(dados, dict):
            raise PayloadInvalidoError("Campo 'dados' ausente ou inválido.")

        username = str(dados.get("username", "")).strip()
        email = str(dados.get("email", "")).strip().lower()
        first_name = str(dados.get("first_name", "")).strip()
        last_name = str(dados.get("last_name", "")).strip()
        role = str(dados.get("role", "user")).strip()

        if not username:
            raise PayloadInvalidoError("Campo 'username' é obrigatório.")
        if not email:
            raise PayloadInvalidoError("Campo 'email' é obrigatório.")

        usuario, criado = User.objects.get_or_create(
            email=email,
            defaults={
                "username": username,
                "first_name": first_name,
                "last_name": last_name,
                "role": role,
                "is_active": True,
            },
        )

        if criado:
            usuario.set_unusable_password()
            usuario.save(update_fields=["password"])

        MensagemServiceBusProcessada.objects.create(message_id=message_id, tipo=tipo)

        return f"usuário {'criado' if criado else 'já existente'}: {email}"

    @staticmethod
    def _abandonar(receiver, message, erro: Exception):
        try:
            receiver.abandon_message(message)
            logger.warning("Mensagem abandonada e devolvida à fila: %s", erro)
        except MessageLockLostError:
            logger.warning("Não foi possível abandonar: lock expirado.")

    @staticmethod
    def _dead_letter(receiver, message, reason: str, description: str):
        try:
            receiver.dead_letter_message(
                message,
                reason=reason[:100],
                error_description=description[:4096],
            )
            logger.error("Mensagem enviada para Dead Letter. Motivo: %s", reason)
        except MessageLockLostError:
            logger.warning("Não foi possível enviar para Dead Letter: lock expirado.")
