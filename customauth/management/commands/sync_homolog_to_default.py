import os
from tempfile import NamedTemporaryFile

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import connections

DEFAULT_EXCLUDES = ["contenttypes", "auth.Permission"]


class Command(BaseCommand):
    help = (
        "Copia os dados de um banco para outro usando dumpdata/loaddata. "
        "Padrao: source=homolog e target=default."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--source",
            default="homolog",
            help="Alias de origem em DATABASES (padrao: homolog).",
        )
        parser.add_argument(
            "--target",
            default="default",
            help="Alias de destino em DATABASES (padrao: default).",
        )
        parser.add_argument(
            "--flush-target",
            action="store_true",
            help="Limpa todas as tabelas do banco de destino antes de importar.",
        )
        parser.add_argument(
            "--yes",
            action="store_true",
            help="Confirma operacoes destrutivas (ex.: --flush-target).",
        )
        parser.add_argument(
            "--exclude",
            action="append",
            default=[],
            metavar="APP_OR_MODEL",
            help=(
                "Exclui app/model do dump (ex.: --exclude sessions "
                "ou --exclude auth.Permission). Pode repetir."
            ),
        )
        parser.add_argument(
            "--keep-fixture",
            action="store_true",
            help="Mantem o arquivo JSON temporario apos a execucao.",
        )

    def _ensure_alias(self, alias):
        if alias not in settings.DATABASES:
            raise CommandError(f"Alias de banco '{alias}' nao encontrado em DATABASES.")

    def _ensure_connection(self, alias):
        try:
            connections[alias].ensure_connection()
        except Exception as exc:
            raise CommandError(
                f"Nao foi possivel conectar no banco '{alias}': {exc}"
            ) from exc

    def handle(self, *args, **options):
        source = options["source"]
        target = options["target"]
        flush_target = options["flush_target"]
        confirmed = options["yes"]
        user_excludes = options["exclude"]
        excludes = list(dict.fromkeys(DEFAULT_EXCLUDES + user_excludes))
        keep_fixture = options["keep_fixture"]
        verbosity = options["verbosity"]

        self._ensure_alias(source)
        self._ensure_alias(target)

        if source == target:
            raise CommandError("Source e target nao podem ser iguais.")

        if flush_target and not confirmed:
            raise CommandError(
                "Use --yes junto com --flush-target para confirmar a limpeza do destino."
            )

        self.stdout.write(
            self.style.WARNING(
                f"Iniciando copia de dados: source='{source}' -> target='{target}'"
            )
        )
        self.stdout.write(
            self.style.WARNING(
                f"Itens excluidos do dump: {', '.join(excludes)}"
            )
        )

        self._ensure_connection(source)
        self._ensure_connection(target)

        base_tmp_dir = os.path.join(settings.BASE_DIR, "tmp")
        os.makedirs(base_tmp_dir, exist_ok=True)

        tmp_file = NamedTemporaryFile(
            mode="w",
            suffix=".json",
            prefix=f"dbsync_{source}_to_{target}_",
            dir=base_tmp_dir,
            delete=False,
            encoding="utf-8",
        )
        fixture_path = tmp_file.name
        tmp_file.close()

        try:
            self.stdout.write("Gerando fixture da origem...")
            with open(fixture_path, "w", encoding="utf-8") as fixture:
                call_command(
                    "dumpdata",
                    database=source,
                    format="json",
                    indent=2,
                    all=True,
                    exclude=excludes,
                    stdout=fixture,
                    verbosity=verbosity,
                )

            if flush_target:
                self.stdout.write(
                    self.style.WARNING(
                        f"Limpando banco de destino '{target}' (flush)..."
                    )
                )
                call_command(
                    "flush",
                    database=target,
                    interactive=False,
                    verbosity=verbosity,
                )

            self.stdout.write("Importando fixture no destino...")
            call_command(
                "loaddata",
                fixture_path,
                database=target,
                verbosity=verbosity,
            )

            self.stdout.write(
                self.style.SUCCESS(
                    f"Sincronizacao concluida com sucesso: '{source}' -> '{target}'."
                )
            )
            if keep_fixture:
                self.stdout.write(self.style.SUCCESS(f"Fixture mantido em: {fixture_path}"))

        finally:
            if (not keep_fixture) and os.path.exists(fixture_path):
                os.remove(fixture_path)
