import os
from datetime import date, datetime, timedelta
from decimal import Decimal
from pathlib import Path

from django.conf import settings
from django.db import IntegrityError, connections, transaction
from django.utils import timezone


DB_FECHAMENTO = "default"
TABELA_FECHAMENTO = "workspace_financeiro_fechamento_competencia"

STATUS_DISPONIVEL = "DISPONIVEL"
STATUS_FECHADO = "FECHADO"

_TABELA_VALIDADA = False


def _vendor():
    connection = connections[
        DB_FECHAMENTO
    ]

    vendor = (
        getattr(
            connection,
            "vendor",
            "",
        )
        or ""
    ).lower()

    engine = (
        connection.settings_dict
        .get(
            "ENGINE",
            "",
        )
        .lower()
    )

    return vendor, engine


def _garantir_tabela():
    global _TABELA_VALIDADA

    if _TABELA_VALIDADA:
        return

    vendor, engine = _vendor()

    with connections[
        DB_FECHAMENTO
    ].cursor() as cursor:

        if (
            vendor in {
                "microsoft",
                "mssql",
            }
            or "mssql" in engine
            or "sql_server" in engine
        ):
            cursor.execute(
                f"""
                IF OBJECT_ID(
                    N'{TABELA_FECHAMENTO}',
                    N'U'
                ) IS NULL
                BEGIN
                    CREATE TABLE {TABELA_FECHAMENTO} (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        competencia VARCHAR(7) NOT NULL UNIQUE,
                        data_inicial DATE NOT NULL,
                        data_final DATE NOT NULL,
                        status VARCHAR(20) NOT NULL,
                        disponivel_em DATETIME2 NOT NULL,
                        quantidade INT NULL,
                        valor_total DECIMAL(18,2) NULL,
                        arquivo_excel VARCHAR(500) NULL,
                        arquivo_pdf VARCHAR(500) NULL,
                        fechado_em DATETIME2 NULL,
                        fechado_por_id VARCHAR(64) NULL,
                        fechado_por VARCHAR(255) NULL,
                        atualizado_em DATETIME2 NULL,
                        atualizado_por_id VARCHAR(64) NULL,
                        atualizado_por VARCHAR(255) NULL
                    );
                END
                """
            )

        elif vendor == "sqlite":
            cursor.execute(
                f"""
                CREATE TABLE IF NOT EXISTS {TABELA_FECHAMENTO} (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    competencia VARCHAR(7) NOT NULL UNIQUE,
                    data_inicial DATE NOT NULL,
                    data_final DATE NOT NULL,
                    status VARCHAR(20) NOT NULL,
                    disponivel_em DATETIME NOT NULL,
                    quantidade INTEGER NULL,
                    valor_total DECIMAL(18,2) NULL,
                    arquivo_excel VARCHAR(500) NULL,
                    arquivo_pdf VARCHAR(500) NULL,
                    fechado_em DATETIME NULL,
                    fechado_por_id VARCHAR(64) NULL,
                    fechado_por VARCHAR(255) NULL,
                    atualizado_em DATETIME NULL,
                    atualizado_por_id VARCHAR(64) NULL,
                    atualizado_por VARCHAR(255) NULL
                )
                """
            )

        elif vendor == "mysql":
            cursor.execute(
                f"""
                CREATE TABLE IF NOT EXISTS {TABELA_FECHAMENTO} (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    competencia VARCHAR(7) NOT NULL UNIQUE,
                    data_inicial DATE NOT NULL,
                    data_final DATE NOT NULL,
                    status VARCHAR(20) NOT NULL,
                    disponivel_em DATETIME NOT NULL,
                    quantidade INT NULL,
                    valor_total DECIMAL(18,2) NULL,
                    arquivo_excel VARCHAR(500) NULL,
                    arquivo_pdf VARCHAR(500) NULL,
                    fechado_em DATETIME NULL,
                    fechado_por_id VARCHAR(64) NULL,
                    fechado_por VARCHAR(255) NULL,
                    atualizado_em DATETIME NULL,
                    atualizado_por_id VARCHAR(64) NULL,
                    atualizado_por VARCHAR(255) NULL
                )
                """
            )

        else:
            cursor.execute(
                f"""
                CREATE TABLE IF NOT EXISTS {TABELA_FECHAMENTO} (
                    id BIGSERIAL PRIMARY KEY,
                    competencia VARCHAR(7) NOT NULL UNIQUE,
                    data_inicial DATE NOT NULL,
                    data_final DATE NOT NULL,
                    status VARCHAR(20) NOT NULL,
                    disponivel_em TIMESTAMP NOT NULL,
                    quantidade INTEGER NULL,
                    valor_total NUMERIC(18,2) NULL,
                    arquivo_excel VARCHAR(500) NULL,
                    arquivo_pdf VARCHAR(500) NULL,
                    fechado_em TIMESTAMP NULL,
                    fechado_por_id VARCHAR(64) NULL,
                    fechado_por VARCHAR(255) NULL,
                    atualizado_em TIMESTAMP NULL,
                    atualizado_por_id VARCHAR(64) NULL,
                    atualizado_por VARCHAR(255) NULL
                )
                """
            )

    _TABELA_VALIDADA = True


def _usuario_dados(usuario):
    usuario_id = getattr(
        usuario,
        "pk",
        None,
    )

    try:
        nome = (
            usuario.get_full_name()
            or ""
        ).strip()
    except Exception:
        nome = ""

    nome = (
        nome
        or getattr(
            usuario,
            "username",
            "",
        )
        or str(usuario)
    )

    return (
        str(usuario_id)
        if usuario_id is not None
        else None,
        nome,
    )


def _periodo_mes_anterior(hoje):
    primeiro_dia_atual = hoje.replace(
        day=1
    )

    data_final = (
        primeiro_dia_atual
        - timedelta(days=1)
    )

    data_inicial = data_final.replace(
        day=1
    )

    competencia = data_inicial.strftime(
        "%Y-%m"
    )

    return (
        competencia,
        data_inicial,
        data_final,
    )


def _linha_para_dict(linha):
    if not linha:
        return None

    colunas = [
        "id",
        "competencia_slug",
        "data_inicial",
        "data_final",
        "status",
        "disponivel_em",
        "quantidade",
        "valor_total",
        "arquivo_excel",
        "arquivo_pdf",
        "fechado_em",
        "fechado_por_id",
        "fechado_por",
        "atualizado_em",
        "atualizado_por_id",
        "atualizado_por",
    ]

    item = dict(
        zip(
            colunas,
            linha,
        )
    )

    data_inicial = item.get(
        "data_inicial"
    )

    if (
        isinstance(
            data_inicial,
            str,
        )
        and data_inicial
    ):
        data_inicial = date.fromisoformat(
            data_inicial[:10]
        )
        item[
            "data_inicial"
        ] = data_inicial

    data_final = item.get(
        "data_final"
    )

    if (
        isinstance(
            data_final,
            str,
        )
        and data_final
    ):
        data_final = date.fromisoformat(
            data_final[:10]
        )
        item[
            "data_final"
        ] = data_final

    if data_inicial:
        item[
            "competencia"
        ] = data_inicial.strftime(
            "%m/%Y"
        )
    else:
        item[
            "competencia"
        ] = item[
            "competencia_slug"
        ]

    item[
        "disponivel"
    ] = (
        item.get("status")
        == STATUS_DISPONIVEL
    )

    item[
        "fechado"
    ] = (
        item.get("status")
        == STATUS_FECHADO
    )

    if item.get("valor_total") is None:
        item["valor_total"] = Decimal("0.00")

    return item


def _select_base():
    return f"""
        SELECT
            id,
            competencia,
            data_inicial,
            data_final,
            status,
            disponivel_em,
            quantidade,
            valor_total,
            arquivo_excel,
            arquivo_pdf,
            fechado_em,
            fechado_por_id,
            fechado_por,
            atualizado_em,
            atualizado_por_id,
            atualizado_por
        FROM {TABELA_FECHAMENTO}
    """


def garantir_competencia_disponivel(hoje=None):
    _garantir_tabela()

    hoje = hoje or timezone.localdate()

    (
        competencia,
        data_inicial,
        data_final,
    ) = _periodo_mes_anterior(
        hoje
    )

    existente = obter_competencia(
        competencia
    )

    if existente:
        return existente

    disponivel_em = timezone.now()

    try:
        with transaction.atomic(
            using=DB_FECHAMENTO
        ):
            with connections[
                DB_FECHAMENTO
            ].cursor() as cursor:
                cursor.execute(
                    f"""
                    INSERT INTO {TABELA_FECHAMENTO} (
                        competencia,
                        data_inicial,
                        data_final,
                        status,
                        disponivel_em
                    )
                    VALUES (
                        %s,
                        %s,
                        %s,
                        %s,
                        %s
                    )
                    """,
                    [
                        competencia,
                        data_inicial,
                        data_final,
                        STATUS_DISPONIVEL,
                        disponivel_em,
                    ],
                )
    except IntegrityError:
        # Outra requisição pode ter criado a mesma competência
        # simultaneamente no primeiro acesso do mês.
        pass

    return obter_competencia(
        competencia
    )


def obter_competencia(competencia):
    _garantir_tabela()

    with connections[
        DB_FECHAMENTO
    ].cursor() as cursor:
        cursor.execute(
            _select_base()
            + " WHERE competencia = %s",
            [competencia],
        )

        return _linha_para_dict(
            cursor.fetchone()
        )


def listar_competencias(limite=36):
    _garantir_tabela()

    with connections[
        DB_FECHAMENTO
    ].cursor() as cursor:
        cursor.execute(
            _select_base()
            + " ORDER BY data_inicial DESC"
        )

        linhas = cursor.fetchall()

    return [
        _linha_para_dict(linha)
        for linha in linhas[:limite]
    ]


def registrar_fechamento(
    competencia,
    quantidade,
    valor_total,
    arquivo_excel,
    arquivo_pdf,
    usuario,
    fechado_em=None,
):
    _garantir_tabela()

    registro = obter_competencia(
        competencia
    )

    if not registro:
        raise ValueError(
            "Competência não encontrada para fechamento."
        )

    if registro.get("fechado"):
        return registro

    fechado_em = (
        fechado_em
        or timezone.now()
    )

    usuario_id, usuario_nome = (
        _usuario_dados(usuario)
    )

    with transaction.atomic(
        using=DB_FECHAMENTO
    ):
        with connections[
            DB_FECHAMENTO
        ].cursor() as cursor:
            cursor.execute(
                f"""
                UPDATE {TABELA_FECHAMENTO}
                SET
                    status = %s,
                    quantidade = %s,
                    valor_total = %s,
                    arquivo_excel = %s,
                    arquivo_pdf = %s,
                    fechado_em = %s,
                    fechado_por_id = %s,
                    fechado_por = %s,
                    atualizado_em = NULL,
                    atualizado_por_id = NULL,
                    atualizado_por = NULL
                WHERE competencia = %s
                """,
                [
                    STATUS_FECHADO,
                    int(quantidade or 0),
                    Decimal(
                        str(
                            valor_total
                            or "0.00"
                        )
                    ),
                    arquivo_excel,
                    arquivo_pdf,
                    fechado_em,
                    usuario_id,
                    usuario_nome,
                    competencia,
                ],
            )

    return obter_competencia(
        competencia
    )


def registrar_atualizacao(
    competencia,
    quantidade,
    valor_total,
    arquivo_excel,
    arquivo_pdf,
    usuario,
    atualizado_em=None,
):
    _garantir_tabela()

    registro = obter_competencia(
        competencia
    )

    if not registro:
        raise ValueError(
            "Competência não encontrada."
        )

    if not registro.get("fechado"):
        raise ValueError(
            "Somente competências fechadas podem ser atualizadas."
        )

    atualizado_em = (
        atualizado_em
        or timezone.now()
    )

    usuario_id, usuario_nome = (
        _usuario_dados(usuario)
    )

    with transaction.atomic(
        using=DB_FECHAMENTO
    ):
        with connections[
            DB_FECHAMENTO
        ].cursor() as cursor:
            cursor.execute(
                f"""
                UPDATE {TABELA_FECHAMENTO}
                SET
                    quantidade = %s,
                    valor_total = %s,
                    arquivo_excel = %s,
                    arquivo_pdf = %s,
                    atualizado_em = %s,
                    atualizado_por_id = %s,
                    atualizado_por = %s
                WHERE competencia = %s
                """,
                [
                    int(quantidade or 0),
                    Decimal(
                        str(
                            valor_total
                            or "0.00"
                        )
                    ),
                    arquivo_excel,
                    arquivo_pdf,
                    atualizado_em,
                    usuario_id,
                    usuario_nome,
                    competencia,
                ],
            )

    return obter_competencia(
        competencia
    )


def _media_root():
    configurado = getattr(
        settings,
        "MEDIA_ROOT",
        None,
    )

    if configurado:
        return Path(configurado)

    return (
        Path(settings.BASE_DIR)
        / "media"
    )


def salvar_arquivo_fechamento(
    competencia,
    nome_arquivo,
    conteudo,
):
    root = _media_root()

    destino_dir = (
        root
        / "financeiro"
        / "fechamentos"
        / competencia
    )

    destino_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    destino = (
        destino_dir
        / nome_arquivo
    )

    destino.write_bytes(
        conteudo
    )

    return str(
        destino.relative_to(root)
    ).replace(
        "\\",
        "/",
    )


def caminho_arquivo_fechamento(
    caminho_relativo,
):
    if not caminho_relativo:
        return None

    root = _media_root().resolve()

    candidato = (
        root
        / caminho_relativo
    ).resolve()

    try:
        comum = Path(
            os.path.commonpath(
                [
                    str(root),
                    str(candidato),
                ]
            )
        )
    except Exception:
        return None

    if comum != root:
        return None

    if not candidato.exists():
        return None

    return candidato
