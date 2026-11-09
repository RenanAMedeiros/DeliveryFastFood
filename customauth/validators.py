import re
from django.core.exceptions import ValidationError
from django.utils.translation import gettext as _

class CustomPasswordValidator:
    def validate(self, password, user=None):
        if not re.search(r'[A-Z]', password):
            raise ValidationError(
                _("A senha deve conter pelo menos uma letra maiúscula."),
                code='password_no_upper',
            )
        if not re.search(r'[@$!%*?&]', password):
            raise ValidationError(
                _("A senha deve conter pelo menos um caractere especial: @$!%*?&"),
                code='password_no_special',
            )

    def get_help_text(self):
        return _(
            "A senha deve conter pelo menos uma letra maiúscula e um caractere especial: @$!%*?&"
        )