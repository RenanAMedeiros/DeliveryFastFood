from pathlib import Path

from django.apps import apps
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import connections, transaction


class Command(BaseCommand):
    help = (
        "Sincroniza dados do SQLite para o banco default (destino), copiando: "
        "customauth.Carteira, workspace.MetaCarteiraMensal, "
        "workspace.HistoricoMetaCarteiraMensal e workspace.ProducaoCarteira."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--source",
            default="sqlite",
            help=(
                "Alias da origem em DATABASES. "
                "Se nao existir, sera criado como SQLite com --sqlite-path."
            ),
        )
        parser.add_argument(
            "--target",
            default="default",
            help="Alias do banco de destino (padrao: default).",
        )
        parser.add_argument(
            "--sqlite-path",
            default=str(Path(settings.BASE_DIR) / "db.sqlite3"),
            help="Caminho do arquivo SQLite quando o alias --source nao existir.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Simula a sincronizacao sem gravar no banco de destino.",
        )

    def _ensure_connection(self, alias):
        try:
            connections[alias].ensure_connection()
        except Exception as exc:
            raise CommandError(
                f"Nao foi possivel conectar no banco '{alias}': {exc}"
            ) from exc

    def _resolve_source_alias(self, source_alias, sqlite_path):
        if source_alias in settings.DATABASES:
            return source_alias

        sqlite_file = Path(sqlite_path).expanduser().resolve()
        if not sqlite_file.exists():
            raise CommandError(
                f"Arquivo SQLite nao encontrado em '{sqlite_file}'. "
                "Informe um caminho valido com --sqlite-path."
            )

        db_conf = {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": str(sqlite_file),
            "ATOMIC_REQUESTS": False,
            "AUTOCOMMIT": True,
            "CONN_MAX_AGE": 0,
            "CONN_HEALTH_CHECKS": False,
            "OPTIONS": {},
            "TIME_ZONE": None,
            "USER": "",
            "PASSWORD": "",
            "HOST": "",
            "PORT": "",
            "TEST": {
                "CHARSET": None,
                "COLLATION": None,
                "MIGRATE": True,
                "MIRROR": None,
                "NAME": None,
            },
        }
        settings.DATABASES[source_alias] = db_conf
        connections.databases[source_alias] = db_conf
        return source_alias

    def _copy_model(self, model, source_alias, target_alias, fk_cache):
        created = 0
        updated = 0
        skipped = 0

        source_qs = model.objects.using(source_alias).all().order_by("pk")
        target_manager = model.objects.using(target_alias)

        fk_fields = [
            f for f in model._meta.concrete_fields if f.is_relation and f.many_to_one
        ]

        for source_obj in source_qs.iterator():
            defaults = {}
            can_copy = True

            for field in model._meta.concrete_fields:
                if field.primary_key:
                    continue

                value = getattr(source_obj, field.attname)

                if field in fk_fields and value is not None:
                    related_model = field.remote_field.model
                    existing_pks = fk_cache.get(related_model)
                    if existing_pks is None:
                        existing_pks = set(
                            related_model.objects.using(target_alias).values_list(
                                "pk", flat=True
                            )
                        )
                        fk_cache[related_model] = existing_pks

                    if value not in existing_pks:
                        if field.null:
                            self.stdout.write(
                                self.style.WARNING(
                                    f"{model._meta.label}#{source_obj.pk}: "
                                    f"FK '{field.name}'={value} nao existe no destino. "
                                    "Gravando como NULL."
                                )
                            )
                            value = None
                        else:
                            self.stdout.write(
                                self.style.WARNING(
                                    f"{model._meta.label}#{source_obj.pk}: "
                                    f"FK obrigatoria '{field.name}'={value} ausente no destino. "
                                    "Registro ignorado."
                                )
                            )
                            can_copy = False
                            break

                defaults[field.attname] = value

            if not can_copy:
                skipped += 1
                continue

            _, was_created = target_manager.update_or_create(
                pk=source_obj.pk,
                defaults=defaults,
            )
            if was_created:
                created += 1
            else:
                updated += 1

        return created, updated, skipped

    def handle(self, *args, **options):
        source = options["source"]
        target = options["target"]
        sqlite_path = options["sqlite_path"]
        dry_run = options["dry_run"]

        source = self._resolve_source_alias(source, sqlite_path)

        if target not in settings.DATABASES:
            raise CommandError(f"Alias de destino '{target}' nao encontrado em DATABASES.")
        if source == target:
            raise CommandError("Source e target nao podem ser iguais.")

        self._ensure_connection(source)
        self._ensure_connection(target)

        models_order = [
            apps.get_model("customauth", "Carteira"),
            apps.get_model("workspace", "MetaCarteiraMensal"),
            apps.get_model("workspace", "HistoricoMetaCarteiraMensal"),
            apps.get_model("workspace", "ProducaoCarteira"),
        ]

        self.stdout.write(
            self.style.WARNING(
                f"Sincronizando de '{source}' para '{target}' "
                f"{'(DRY-RUN)' if dry_run else ''}"
            )
        )

        fk_cache = {}
        totals = {"created": 0, "updated": 0, "skipped": 0}

        with transaction.atomic(using=target):
            for model in models_order:
                self.stdout.write(f"Processando {model._meta.label}...")
                created, updated, skipped = self._copy_model(
                    model=model,
                    source_alias=source,
                    target_alias=target,
                    fk_cache=fk_cache,
                )
                totals["created"] += created
                totals["updated"] += updated
                totals["skipped"] += skipped
                self.stdout.write(
                    self.style.SUCCESS(
                        f"{model._meta.label}: criados={created}, "
                        f"atualizados={updated}, ignorados={skipped}"
                    )
                )

            if dry_run:
                transaction.set_rollback(True, using=target)
                self.stdout.write(self.style.WARNING("Dry-run finalizado. Nada foi gravado."))

        self.stdout.write(
            self.style.SUCCESS(
                "Sincronizacao concluida. "
                f"Total criados={totals['created']}, "
                f"atualizados={totals['updated']}, "
                f"ignorados={totals['skipped']}."
            )
        )
