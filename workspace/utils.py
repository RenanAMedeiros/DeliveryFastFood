# users/utils.py
from django.db import transaction
from .models import ProtocoloSequence

def get_next_protocolo():
    with transaction.atomic():
        sequence = ProtocoloSequence.objects.select_for_update().first()
        if not sequence:
            sequence = ProtocoloSequence.objects.create(last_value=0)
        sequence.last_value += 1
        sequence.save()
        return sequence.last_value