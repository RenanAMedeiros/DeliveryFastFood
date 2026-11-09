from datetime import date, datetime
from decimal import Decimal
from io import BytesIO
from pathlib import Path
from zoneinfo import ZoneInfo

from django.conf import settings
from django.contrib.staticfiles import finders
from openpyxl import Workbook
from openpyxl.styles import Font
from openpyxl.utils import get_column_letter
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas


CLIENTE_FINANCEIRO = "Nunes Romero Advogados"
FUSO_BRASILIA = ZoneInfo("America/Sao_Paulo")


def _decimal(valor):
    if isinstance(valor, Decimal):
        return valor

    try:
        return Decimal(str(valor or "0"))
    except Exception:
        return Decimal("0.00")


def _brl(valor):
    numero = _decimal(valor)

    texto = f"{numero:,.2f}"
    texto = (
        texto
        .replace(",", "X")
        .replace(".", ",")
        .replace("X", ".")
    )

    return f"R$ {texto}"


def _numero_inteiro(valor):
    try:
        numero = int(valor or 0)
    except Exception:
        numero = 0

    return f"{numero:,}".replace(",", ".")


def _usuario_nome(usuario):
    if usuario is None:
        return "-"

    try:
        nome = (usuario.get_full_name() or "").strip()
    except Exception:
        nome = ""

    return (
        nome
        or getattr(usuario, "username", "")
        or str(usuario)
        or "-"
    )


def _normalizar_datetime(valor):
    """
    Normaliza datas/horários para o fuso de Brasília.

    - datetime com timezone: converte para America/Sao_Paulo;
    - datetime sem timezone: considera que o horário informado
      já representa Brasília;
    - valor vazio: usa o horário atual de Brasília.
    """
    if isinstance(valor, datetime):
        if valor.tzinfo is None:
            return valor.replace(
                tzinfo=FUSO_BRASILIA
            )

        return valor.astimezone(
            FUSO_BRASILIA
        )

    return datetime.now(
        FUSO_BRASILIA
    )


def _resolver_logo(logo_path=None):
    if logo_path:
        caminho = Path(logo_path)
        if caminho.exists():
            return caminho

    encontrado = finders.find(
        "imagens/logo documentos.png"
    )

    if isinstance(encontrado, (list, tuple)):
        encontrado = encontrado[0] if encontrado else None

    if encontrado:
        caminho = Path(encontrado)
        if caminho.exists():
            return caminho

    caminho_fallback = (
        Path(settings.BASE_DIR)
        / "workspace"
        / "static"
        / "imagens"
        / "logo documentos.png"
    )

    if caminho_fallback.exists():
        return caminho_fallback

    return None


def gerar_excel_financeiro(resultado):
    registros = resultado.get(
        "registros_status_200",
        [],
    )

    colunas_exportacao = [
        ("ID Contrato", "ID_CONTR"),
        ("Empresa", "NOME_EMPRESA"),
        ("Carteira", "NOME_CARTEIRA"),
        ("Data", "DATA_CLASSE"),
        ("Método", "METODO"),
        ("Entrada", "ENTRADA"),
        ("Status", "STATUS_RETORNO"),
        ("Exception", "EXCEPTION"),
    ]

    workbook = Workbook()
    worksheet = workbook.active
    worksheet.title = "Consultas 200"

    worksheet.append(
        [
            titulo
            for titulo, _
            in colunas_exportacao
        ]
    )

    for cell in worksheet[1]:
        cell.font = Font(
            bold=True
        )

    for registro in registros:
        worksheet.append(
            [
                registro.get(campo)
                for _, campo
                in colunas_exportacao
            ]
        )

    worksheet.freeze_panes = "A2"
    worksheet.auto_filter.ref = worksheet.dimensions

    for linha in range(
        2,
        worksheet.max_row + 1,
    ):
        worksheet.cell(
            row=linha,
            column=4,
        ).number_format = (
            "dd/mm/yyyy hh:mm:ss"
        )

    larguras = {
        1: 16,
        2: 28,
        3: 28,
        4: 20,
        5: 22,
        6: 28,
        7: 12,
        8: 55,
    }

    for indice, largura in larguras.items():
        worksheet.column_dimensions[
            get_column_letter(indice)
        ].width = largura

    buffer = BytesIO()
    workbook.save(buffer)
    buffer.seek(0)

    return buffer.getvalue()


def gerar_pdf_financeiro(
    resultado,
    competencia_label,
    data_inicial,
    data_final,
    usuario=None,
    gerado_em=None,
    fechado=False,
    fechado_por=None,
    fechado_em=None,
    atualizado_por=None,
    atualizado_em=None,
    logo_path=None,
):
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.utils import ImageReader
        from reportlab.pdfgen import canvas
    except ImportError as erro:
        raise RuntimeError(
            "A biblioteca reportlab é necessária "
            "para gerar a capa financeira em PDF."
        ) from erro

    gerado_em = _normalizar_datetime(
        gerado_em
    )

    data_inicial = (
        data_inicial
        if isinstance(data_inicial, date)
        else date.fromisoformat(str(data_inicial))
    )

    data_final = (
        data_final
        if isinstance(data_final, date)
        else date.fromisoformat(str(data_final))
    )

    servicos = resultado.get(
        "servicos",
        [],
    )

    servicos_utilizacao = [
        item
        for item in servicos
        if item.get("tipo") == "utilizacao"
    ]

    rpa = next(
        (
            item
            for item in servicos
            if item.get("chave") == "rpa"
        ),
        None,
    )

    quantidade_total = sum(
        int(item.get("quantidade") or 0)
        for item in servicos_utilizacao
    )

    subtotal_consultas = sum(
        _decimal(item.get("valor_total"))
        for item in servicos_utilizacao
    )

    valor_rpa = (
        _decimal(rpa.get("valor_total"))
        if rpa
        else Decimal("0.00")
    )

    total = _decimal(
        resultado.get("total_financeiro")
    )

    acrescimo_desconto = Decimal("0.00")

    buffer = BytesIO()
    largura_pagina, altura_pagina = A4

    pdf = canvas.Canvas(
        buffer,
        pagesize=A4,
    )

    navy = colors.HexColor("#082A4A")
    blue = colors.HexColor("#1746A2")
    cyan = colors.HexColor("#49B9F2")
    light = colors.HexColor("#F5F8FC")
    border = colors.HexColor("#DCE4EE")
    text = colors.HexColor("#172033")
    muted = colors.HexColor("#6F7787")
    green = colors.HexColor("#198754")
    amber = colors.HexColor("#A86D00")

    pdf.setFillColor(colors.white)
    pdf.rect(
        0,
        0,
        largura_pagina,
        altura_pagina,
        stroke=0,
        fill=1,
    )

    # ========================================================
    # CABEÇALHO
    # ========================================================

    altura_header = 145

    pdf.setFillColor(navy)
    pdf.rect(
        0,
        altura_pagina - altura_header,
        largura_pagina,
        altura_header,
        stroke=0,
        fill=1,
    )

    pdf.setFillColor(cyan)
    pdf.rect(
        0,
        altura_pagina - altura_header,
        8,
        altura_header,
        stroke=0,
        fill=1,
    )

    caminho_logo = _resolver_logo(
        logo_path
    )

    if caminho_logo:
        try:
            pdf.drawImage(
                ImageReader(str(caminho_logo)),
                38,
                altura_pagina - 76,
                width=112,
                height=32,
                preserveAspectRatio=True,
                mask="auto",
            )
        except Exception:
            caminho_logo = None

    if not caminho_logo:
        pdf.setFillColor(colors.white)
        pdf.setFont(
            "Helvetica-Bold",
            22,
        )
        pdf.drawString(
            38,
            altura_pagina - 67,
            "QORE",
        )

    pdf.setFillColor(colors.white)
    pdf.setFont(
        "Helvetica-Bold",
        21,
    )
    pdf.drawString(
        38,
        altura_pagina - 108,
        "Detalhamento Financeiro",
    )

    pdf.setFont(
        "Helvetica",
        10.5,
    )
    pdf.setFillColor(
        colors.HexColor("#D8E8F6")
    )
    pdf.drawString(
        38,
        altura_pagina - 126,
        CLIENTE_FINANCEIRO,
    )

    badge_largura = 122
    badge_x = (
        largura_pagina
        - badge_largura
        - 38
    )
    badge_y = altura_pagina - 76

    pdf.setFillColor(
        colors.HexColor("#123D64")
    )
    pdf.roundRect(
        badge_x,
        badge_y,
        badge_largura,
        30,
        8,
        stroke=0,
        fill=1,
    )

    pdf.setFillColor(cyan)
    pdf.setFont(
        "Helvetica-Bold",
        8.5,
    )
    pdf.drawCentredString(
        badge_x + badge_largura / 2,
        badge_y + 18,
        "COMPETÊNCIA",
    )

    pdf.setFillColor(colors.white)
    pdf.setFont(
        "Helvetica-Bold",
        11.5,
    )
    pdf.drawCentredString(
        badge_x + badge_largura / 2,
        badge_y + 7,
        competencia_label,
    )

    # ========================================================
    # INFORMAÇÕES
    # ========================================================

    y = (
        altura_pagina
        - altura_header
        - 26
    )

    pdf.setFillColor(text)
    pdf.setFont(
        "Helvetica-Bold",
        11,
    )
    pdf.drawString(
        38,
        y,
        "Período de referência",
    )

    pdf.setFont(
        "Helvetica",
        9,
    )
    pdf.setFillColor(muted)
    pdf.drawString(
        38,
        y - 16,
        (
            data_inicial.strftime("%d/%m/%Y")
            + " a "
            + data_final.strftime("%d/%m/%Y")
        ),
    )

    pdf.setFillColor(text)
    pdf.setFont(
        "Helvetica-Bold",
        11,
    )
    pdf.drawString(
        250,
        y,
        "Gerado em",
    )

    pdf.setFont(
        "Helvetica",
        9,
    )
    pdf.setFillColor(muted)
    pdf.drawString(
        250,
        y - 16,
        gerado_em.strftime("%d/%m/%Y %H:%M"),
    )

    pdf.setFillColor(text)
    pdf.setFont(
        "Helvetica-Bold",
        11,
    )
    pdf.drawString(
        390,
        y,
        "Status",
    )

    status_texto = (
        "FECHADO"
        if fechado
        else "PRÉVIA"
    )

    status_cor = (
        green
        if fechado
        else amber
    )

    status_fundo = (
        colors.HexColor("#E8F6EE")
        if fechado
        else colors.HexColor("#FFF5DB")
    )

    pdf.setFillColor(status_fundo)
    pdf.roundRect(
        390,
        y - 19,
        126,
        18,
        7,
        stroke=0,
        fill=1,
    )

    pdf.setFillColor(status_cor)
    pdf.setFont(
        "Helvetica-Bold",
        7.5,
    )
    pdf.drawCentredString(
        453,
        y - 13,
        status_texto,
    )

    # ========================================================
    # CARDS
    # ========================================================

    card_y = y - 78
    card_h = 56
    gap = 10
    card_w = (
        largura_pagina
        - 76
        - gap * 2
    ) / 3

    cards = [
        (
            "Consultas válidas",
            _numero_inteiro(
                quantidade_total
            ),
        ),
        (
            "Subtotal consultas",
            _brl(
                subtotal_consultas
            ),
        ),
        (
            "Total do fechamento",
            _brl(total),
        ),
    ]

    for indice, (rotulo, valor) in enumerate(cards):
        x = (
            38
            + indice * (card_w + gap)
        )

        pdf.setFillColor(light)
        pdf.setStrokeColor(border)
        pdf.roundRect(
            x,
            card_y,
            card_w,
            card_h,
            10,
            stroke=1,
            fill=1,
        )

        pdf.setFillColor(muted)
        pdf.setFont(
            "Helvetica",
            8.5,
        )
        pdf.drawString(
            x + 12,
            card_y + 37,
            rotulo,
        )

        pdf.setFillColor(
            blue
            if indice < 2
            else navy
        )
        pdf.setFont(
            "Helvetica-Bold",
            15 if indice < 2 else 16,
        )
        pdf.drawString(
            x + 12,
            card_y + 17,
            valor,
        )

    # ========================================================
    # TABELA
    # ========================================================

    tabela_top = card_y - 34

    pdf.setFillColor(text)
    pdf.setFont(
        "Helvetica-Bold",
        12,
    )
    pdf.drawString(
        38,
        tabela_top,
        "Composição do fechamento",
    )

    tabela_x = 38
    tabela_y = tabela_top - 28
    tabela_w = largura_pagina - 76
    linha_h = 26

    pdf.setFillColor(
        colors.HexColor("#EAF0F6")
    )
    pdf.roundRect(
        tabela_x,
        tabela_y,
        tabela_w,
        linha_h,
        6,
        stroke=0,
        fill=1,
    )

    colunas = [
        0,
        240,
        330,
        410,
        tabela_w,
    ]

    headers = [
        "Consulta",
        "Quantidade",
        "Valor unitário",
        "Subtotal",
    ]

    pdf.setFillColor(text)
    pdf.setFont(
        "Helvetica-Bold",
        8.5,
    )

    for indice, header in enumerate(headers):
        x1 = tabela_x + colunas[indice]
        x2 = tabela_x + colunas[indice + 1]

        if indice == 0:
            pdf.drawString(
                x1 + 10,
                tabela_y + 9,
                header,
            )
        else:
            pdf.drawCentredString(
                (x1 + x2) / 2,
                tabela_y + 9,
                header,
            )

    atual_y = tabela_y - linha_h

    for item in servicos_utilizacao:
        nome = str(
            item.get("servico") or "-"
        ).upper()
        quantidade = int(
            item.get("quantidade") or 0
        )
        unitario = _decimal(
            item.get("valor_unitario")
        )
        subtotal = _decimal(
            item.get("valor_total")
        )

        pdf.setStrokeColor(border)
        pdf.line(
            tabela_x,
            atual_y,
            tabela_x + tabela_w,
            atual_y,
        )

        pdf.setFillColor(text)
        pdf.setFont(
            "Helvetica",
            9,
        )
        pdf.drawString(
            tabela_x + 10,
            atual_y + 8,
            nome,
        )
        pdf.drawRightString(
            tabela_x + colunas[2] - 10,
            atual_y + 8,
            _numero_inteiro(quantidade),
        )
        pdf.drawRightString(
            tabela_x + colunas[3] - 10,
            atual_y + 8,
            _brl(unitario),
        )
        pdf.drawRightString(
            tabela_x + tabela_w - 10,
            atual_y + 8,
            _brl(subtotal),
        )

        atual_y -= linha_h

    pdf.setFillColor(
        colors.HexColor("#F8FAFC")
    )
    pdf.rect(
        tabela_x,
        atual_y,
        tabela_w,
        linha_h,
        stroke=0,
        fill=1,
    )

    pdf.setFillColor(text)
    pdf.setFont(
        "Helvetica-Bold",
        9,
    )
    pdf.drawString(
        tabela_x + 10,
        atual_y + 8,
        "Subtotal das consultas",
    )
    pdf.drawRightString(
        tabela_x + colunas[2] - 10,
        atual_y + 8,
        _numero_inteiro(
            quantidade_total
        ),
    )
    pdf.drawRightString(
        tabela_x + tabela_w - 10,
        atual_y + 8,
        _brl(
            subtotal_consultas
        ),
    )

    # Espaço adicional entre o subtotal e o bloco RPA
    # para impedir qualquer sobreposição visual.
    atual_y -= linha_h + 30

    # ========================================================
    # RPA / AJUSTES
    # ========================================================

    pdf.setFillColor(light)
    pdf.setStrokeColor(border)
    pdf.roundRect(
        tabela_x,
        atual_y,
        tabela_w,
        46,
        8,
        stroke=1,
        fill=1,
    )

    pdf.setFillColor(text)
    pdf.setFont(
        "Helvetica-Bold",
        9,
    )
    pdf.drawString(
        tabela_x + 12,
        atual_y + 29,
        "RPA CONSULTAS LOTE",
    )

    pdf.setFont(
        "Helvetica",
        8,
    )
    pdf.setFillColor(muted)
    pdf.drawString(
        tabela_x + 12,
        atual_y + 16,
        "Mensalidade",
    )

    pdf.setFillColor(blue)
    pdf.setFont(
        "Helvetica-Bold",
        11,
    )
    pdf.drawRightString(
        tabela_x + tabela_w - 12,
        atual_y + 23,
        _brl(valor_rpa),
    )

    atual_y -= 58

    pdf.setFillColor(muted)
    pdf.setFont(
        "Helvetica",
        8.5,
    )
    pdf.drawString(
        tabela_x,
        atual_y + 8,
        "Acréscimo/Desconto",
    )
    pdf.drawRightString(
        tabela_x + tabela_w,
        atual_y + 8,
        _brl(acrescimo_desconto),
    )

    # ========================================================
    # TOTAL
    # ========================================================

    total_y = atual_y - 58

    pdf.setFillColor(navy)
    pdf.roundRect(
        tabela_x,
        total_y,
        tabela_w,
        52,
        10,
        stroke=0,
        fill=1,
    )

    pdf.setFillColor(
        colors.HexColor("#D8E8F6")
    )
    pdf.setFont(
        "Helvetica-Bold",
        8.5,
    )
    pdf.drawString(
        tabela_x + 14,
        total_y + 31,
        "TOTAL DO FECHAMENTO",
    )

    pdf.setFillColor(colors.white)
    pdf.setFont(
        "Helvetica-Bold",
        20,
    )
    pdf.drawRightString(
        tabela_x + tabela_w - 14,
        total_y + 17,
        _brl(total),
    )

    # ========================================================
    # AUDITORIA
    # ========================================================

    auditoria_y = total_y - 58

    pdf.setStrokeColor(border)
    pdf.line(
        tabela_x,
        auditoria_y + 28,
        tabela_x + tabela_w,
        auditoria_y + 28,
    )

    pdf.setFillColor(muted)
    pdf.setFont(
        "Helvetica",
        7.8,
    )

    if fechado:
        nome_fechamento = (
            fechado_por
            or _usuario_nome(usuario)
        )

        data_fechamento = (
            _normalizar_datetime(
                fechado_em
            )
            if isinstance(
                fechado_em,
                datetime,
            )
            else gerado_em
        )

        pdf.drawString(
            tabela_x,
            auditoria_y + 12,
            "Fechado por: "
            + nome_fechamento,
        )

        pdf.drawRightString(
            tabela_x + tabela_w,
            auditoria_y + 12,
            "Fechado em: "
            + data_fechamento.strftime(
                "%d/%m/%Y %H:%M"
            ),
        )

        if (
            atualizado_por
            and isinstance(
                atualizado_em,
                datetime,
            )
        ):
            atualizado_em_brasilia = (
                _normalizar_datetime(
                    atualizado_em
                )
            )

            pdf.setFillColor(muted)
            pdf.setFont(
                "Helvetica",
                7.8,
            )
            pdf.drawString(
                tabela_x,
                auditoria_y - 1,
                "Atualizado por: "
                + atualizado_por,
            )
            pdf.drawRightString(
                tabela_x + tabela_w,
                auditoria_y - 1,
                "Atualizado em: "
                + atualizado_em_brasilia.strftime(
                    "%d/%m/%Y %H:%M"
                ),
            )

            nota_y = auditoria_y - 16
        else:
            nota_y = auditoria_y - 4

    else:
        pdf.drawString(
            tabela_x,
            auditoria_y + 12,
            "Gerado por: "
            + _usuario_nome(usuario),
        )

        pdf.drawRightString(
            tabela_x + tabela_w,
            auditoria_y + 12,
            "Documento em prévia",
        )

        nota_y = auditoria_y - 4

    pdf.setFillColor(
        colors.HexColor("#98A4B5")
    )
    pdf.drawString(
        tabela_x,
        nota_y,
        (
            "Documento gerado automaticamente "
            "pelo Workspace Qore."
        ),
    )

    pdf.showPage()
    pdf.save()

    buffer.seek(0)

    return buffer.getvalue()
