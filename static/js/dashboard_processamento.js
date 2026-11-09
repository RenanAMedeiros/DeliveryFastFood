(function () {
    "use strict";

    const STORAGE_KEYS = {
        theme: "workspace-qore-processing-theme",
        columnOrder: "workspace-qore-processing-column-order",
        columnWidths: "workspace-qore-processing-column-widths",
    };

    const DEFAULT_COLUMNS = [
        "data",
        "arquivo",
        "id_imp_arquivo",
        "protocolo",
        "banco",
        "carteira",
        "tipo",
        "quantidade_linhas",
        "tempo",
        "tempo_teste",
        "layout_ok",
        "num_instancia",
        "qtde_instancia",
        "conjunto",
        "velocidade",
        "status",
        "funcionario",
        "erro",
    ];

    const state = {
        charts: {},
        registros: [],
        registrosTabela: [],
        paginaAtual: 1,
        porPagina: 25,
        filtrosColunas: {},
        ordenacao: {
            chave: "data",
            direcao: "desc",
        },
        ordemColunas: loadStoredColumnOrder(),
        largurasColunas: loadStoredColumnWidths(),
        colunaArrastada: null,
        fixedSeries: [],
        lastFilteredData: null,
        lastFixedData: null,
        tableServerInfo: {
            registrosExibidos: 0,
            totalRegistros: 0,
        },
        filterTimer: null,
        columnFilterTimer: null,
        requestController: null,
        loadingCount: 0,
        insightStatusGroup: "",
        theme: "light",
        baseRecords: [],
        baseResponse: null,
    };

    const elements = {};

    function byId(id) {
        return document.getElementById(id);
    }

    function firstDefined() {
        for (let index = 0; index < arguments.length; index += 1) {
            const value = arguments[index];

            if (value !== undefined && value !== null) {
                return value;
            }
        }

        return undefined;
    }

    function cacheElements() {
        elements.form = byId("processingFilters");
        elements.dataInicio = byId("processingStartDate");
        elements.dataFim = byId("processingEndDate");
        elements.banco = byId("processingBank");
        elements.carteira = byId("processingWallet");
        elements.tipo = byId("processingType");
        elements.status = byId("processingStatus");
        elements.funcionario = byId("processingEmployee");
        elements.busca = byId("processingSearch");
        elements.refresh = byId("processingRefreshButton");
        elements.clear = byId("processingClearButton");
        elements.toast = byId("processingToast");
        elements.updated = byId("processingUpdatedAt");
        elements.table = byId("processingTable");
        elements.tableCard = byId("processingTableCard");
        elements.tableWrap = byId("processingTableWrap");
        elements.tableHead = byId("processingTableHead");
        elements.tableBody = byId("processingTableBody");
        elements.tableColgroup = byId("processingTableColgroup");
        elements.tableInfo = byId("processingTableInfo");
        elements.paginationLabel = byId("processingPaginationLabel");
        elements.prevPage = byId("processingPrevPage");
        elements.nextPage = byId("processingNextPage");
        elements.clearColumnFilters = byId("processingClearColumnFilters");
        elements.resetColumns = byId("processingResetColumns");
        elements.expandTable = byId("processingExpandTable");
        elements.expandTableIcon = byId("processingExpandTableIcon");
        elements.expandTableText = byId("processingExpandTableText");
        elements.statusSummary = byId("processingStatusSummary");
        elements.insights = byId("processingInsights");
        elements.detailDialog = byId("processingDetailDialog");
        elements.detailBody = byId("processingDetailBody");
        elements.detailTitle = byId("processingDetailTitle");
        elements.detailSubtitle = byId("processingDetailSubtitle");
        elements.themeButton = byId("processingThemeButton");
        elements.themeIcon = byId("processingThemeIcon");
        elements.themeText = byId("processingThemeText");
    }

    function safeJsonParse(value, fallback) {
        try {
            return JSON.parse(value);
        } catch (error) {
            return fallback;
        }
    }

    function loadStoredColumnOrder() {
        const stored = safeJsonParse(
            window.localStorage.getItem(STORAGE_KEYS.columnOrder),
            null
        );

        if (!Array.isArray(stored)) {
            return DEFAULT_COLUMNS.slice();
        }

        const valid = stored.filter(function (key) {
            return DEFAULT_COLUMNS.includes(key);
        });

        DEFAULT_COLUMNS.forEach(function (key) {
            if (!valid.includes(key)) {
                valid.push(key);
            }
        });

        return valid;
    }

    function loadStoredColumnWidths() {
        const stored = safeJsonParse(
            window.localStorage.getItem(STORAGE_KEYS.columnWidths),
            {}
        );

        return stored && typeof stored === "object" ? stored : {};
    }

    function saveColumnPreferences() {
        window.localStorage.setItem(
            STORAGE_KEYS.columnOrder,
            JSON.stringify(state.ordemColunas)
        );

        window.localStorage.setItem(
            STORAGE_KEYS.columnWidths,
            JSON.stringify(state.largurasColunas)
        );
    }

    function formatNumber(value, maximumFractionDigits) {
        return new Intl.NumberFormat("pt-BR", {
            maximumFractionDigits:
                maximumFractionDigits == null
                    ? 0
                    : maximumFractionDigits,
        }).format(Number(value || 0));
    }

    function compactNumber(value) {
        return new Intl.NumberFormat("pt-BR", {
            notation: "compact",
            compactDisplay: "short",
            maximumFractionDigits: 1,
        }).format(Number(value || 0));
    }

    function formatSeconds(value) {
        const numericValue = Number(value || 0);

        if (numericValue > 0 && numericValue < 1) {
            return numericValue.toFixed(2) + "s";
        }

        const total = Math.max(0, Math.round(numericValue));
        const days = Math.floor(total / 86400);
        const hours = Math.floor((total % 86400) / 3600);
        const minutes = Math.floor((total % 3600) / 60);
        const seconds = total % 60;

        if (days) {
            return days + "d " + String(hours).padStart(2, "0") + "h";
        }

        if (hours) {
            return (
                String(hours).padStart(2, "0") +
                "h " +
                String(minutes).padStart(2, "0") +
                "m"
            );
        }

        if (minutes) {
            return (
                String(minutes).padStart(2, "0") +
                "m " +
                String(seconds).padStart(2, "0") +
                "s"
            );
        }

        return seconds + "s";
    }

    function formatDateLabel(value) {
        if (!value || value === "Sem data") {
            return value || "Sem data";
        }

        const parts = String(value).slice(0, 10).split("-");

        if (parts.length !== 3) {
            return value;
        }

        return parts[2] + "/" + parts[1];
    }

    function localDateInputValue(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");

        return year + "-" + month + "-" + day;
    }

    function setTodayPeriod() {
        const today = localDateInputValue(new Date());
        elements.dataInicio.value = today;
        elements.dataFim.value = today;
    }

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function normalizeText(value) {
        return String(value == null ? "" : value)
            .trim()
            .toLocaleLowerCase("pt-BR");
    }

    function normalizeBoolean(value) {
        if (value === undefined || value === null || value === "") {
            return null;
        }

        if (typeof value === "boolean") {
            return value;
        }

        if (typeof value === "number") {
            return value !== 0;
        }

        const normalized = normalizeText(value);

        if (["1", "true", "sim", "s", "ok", "válido", "valido"].includes(normalized)) {
            return true;
        }

        if (["0", "false", "não", "nao", "n", "pendente", "inválido", "invalido"].includes(normalized)) {
            return false;
        }

        return null;
    }

    function ensureLoadingOverlay() {
        let overlay = byId("workspaceLoadingOverlay");

        if (overlay) {
            return overlay;
        }

        overlay = document.createElement("div");
        overlay.id = "workspaceLoadingOverlay";
        overlay.className = "workspace-loading-overlay";
        overlay.setAttribute("aria-hidden", "true");
        overlay.innerHTML =
            '<div class="workspace-loading-card" role="status" aria-live="polite">' +
                '<div class="workspace-loading-logo" aria-hidden="true">' +
                    '<div class="workspace-loading-bars">' +
                        "<span></span><span></span><span></span>" +
                    "</div>" +
                "</div>" +
                '<strong id="workspaceLoadingTitle">Carregando dashboard</strong>' +
                '<p id="workspaceLoadingDescription">Consultando os dados de processamento.</p>' +
                '<div class="workspace-loading-line" aria-hidden="true"><span></span></div>' +
            "</div>";

        document.body.appendChild(overlay);

        return overlay;
    }

    function showLoading(show, title, description) {
        const overlay = ensureLoadingOverlay();
        const overlayTitle = byId("workspaceLoadingTitle");
        const overlayDescription = byId("workspaceLoadingDescription");

        if (show) {
            state.loadingCount += 1;
        } else {
            state.loadingCount = Math.max(0, state.loadingCount - 1);
        }

        const visible = state.loadingCount > 0;

        if (overlayTitle && title) {
            overlayTitle.textContent = title;
        }

        if (overlayDescription && description) {
            overlayDescription.textContent = description;
        }

        overlay.classList.toggle("is-visible", visible);
        overlay.setAttribute("aria-hidden", String(!visible));

        if (elements.refresh) {
            elements.refresh.classList.toggle("is-loading", visible);
            elements.refresh.disabled = visible;
        }
    }

    let toastTimer = null;

    function showToast(message, isError) {
        window.clearTimeout(toastTimer);

        elements.toast.className =
            "processing-toast is-visible" +
            (isError ? " is-error" : "");

        elements.toast.innerHTML =
            '<i class="fa ' +
            (isError ? "fa-exclamation-circle" : "fa-check-circle") +
            '" aria-hidden="true"></i>' +
            "<span>" +
            escapeHtml(message) +
            "</span>";

        toastTimer = window.setTimeout(function () {
            elements.toast.classList.remove("is-visible");
        }, 4500);
    }

    function getParams() {
        const params = new URLSearchParams();
        const values = {
            data_inicio: elements.dataInicio.value,
            data_fim: elements.dataFim.value,
            banco: elements.banco.value,
            carteira: elements.carteira.value,
            tipo: elements.tipo.value,
            status: elements.status.value,
            funcionario: elements.funcionario.value,
            busca: elements.busca.value.trim(),
        };

        Object.keys(values).forEach(function (key) {
            if (values[key]) {
                params.set(key, values[key]);
            }
        });

        if (state.insightStatusGroup) {
            params.set(
                "grupo_status",
                state.insightStatusGroup
            );
        }

        return params;
    }

    function fillSelect(select, values, placeholder) {
        const previous = select.value;
        const options = [
            '<option value="">' + escapeHtml(placeholder) + "</option>",
        ];

        (values || []).forEach(function (value) {
            options.push(
                '<option value="' +
                    escapeHtml(value) +
                    '">' +
                    escapeHtml(value) +
                "</option>"
            );
        });

        select.innerHTML = options.join("");

        if (
            Array.from(select.options).some(function (option) {
                return option.value === previous;
            })
        ) {
            select.value = previous;
        }
    }

    function ensureSelectOption(select, value) {
        if (!value) {
            return;
        }

        const exists = Array.from(select.options).some(function (option) {
            return option.value === value;
        });

        if (!exists) {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = value;
            select.appendChild(option);
        }
    }

    function updateFilterOptions(data) {
        const options = data.opcoes_filtros || {};

        fillSelect(elements.banco, options.bancos, "Todos os bancos");
        fillSelect(elements.carteira, options.carteiras, "Todas as carteiras");
        fillSelect(elements.tipo, options.tipos, "Todos os tipos");
        fillSelect(elements.status, options.status, "Todos os status");
        fillSelect(
            elements.funcionario,
            options.funcionarios,
            "Todos os funcionários"
        );
    }

    function updateMetrics(metrics) {
        metrics = metrics || {};

        byId("metricFiles").textContent = formatNumber(metrics.arquivos);
        byId("metricLines").textContent = compactNumber(metrics.linhas);
        byId("metricTotalTime").textContent =
            metrics.tempo_total_formatado ||
            formatSeconds(metrics.tempo_total_segundos);
        byId("metricAverageTime").textContent =
            metrics.tempo_medio_formatado ||
            formatSeconds(metrics.tempo_medio_segundos);
        byId("metricSuccess").textContent =
            formatNumber(metrics.taxa_sucesso, 1) + "%";
        byId("metricErrors").textContent = formatNumber(metrics.erros);

        byId("metricFilesNote").textContent =
            formatNumber(metrics.processando) + " em processamento";
        byId("metricLinesNote").textContent =
            formatNumber(metrics.velocidade_linhas_minuto, 0) +
            " linhas/min";
        byId("metricTotalTimeNote").textContent =
            formatNumber(metrics.finalizados) + " finalizados";
        byId("metricAverageTimeNote").textContent =
            "Média do período filtrado";
        byId("metricSuccessNote").textContent =
            formatNumber(metrics.finalizados) +
            " processamentos concluídos";
        byId("metricErrorsNote").textContent = metrics.erros
            ? "Requer análise operacional"
            : "Nenhum erro identificado";
    }

    function chartColors() {
        const dark = state.theme === "dark";

        return {
            blue: dark ? "#60a5fa" : "#2563eb",
            green: dark ? "#34d399" : "#12a66a",
            purple: dark ? "#a78bfa" : "#7c5ce8",
            orange: dark ? "#fbbf24" : "#e89b16",
            red: dark ? "#fb7185" : "#e14747",
            cyan: dark ? "#22d3ee" : "#0891b2",
            gray: dark ? "#94a3b8" : "#94a3b8",
            grid: dark
                ? "rgba(148, 163, 184, 0.16)"
                : "rgba(15, 39, 77, 0.08)",
            text: dark ? "#b8c5d9" : "#6f7d94",
            surface: dark ? "#111c2f" : "#ffffff",
        };
    }

    function statusColor(status) {
        const colors = chartColors();
        const normalized = normalizeText(status);

        if (normalized === "finalizado") {
            return colors.green;
        }

        if (normalized.indexOf("erro") === 0) {
            return colors.red;
        }

        if (normalized === "processando") {
            return colors.orange;
        }

        return colors.gray;
    }

    function destroyChart(name) {
        if (state.charts[name]) {
            state.charts[name].destroy();
            delete state.charts[name];
        }
    }

    function commonScales() {
        const colors = chartColors();

        return {
            x: {
                grid: {
                    display: false,
                },
                border: {
                    display: false,
                },
                ticks: {
                    color: colors.text,
                    font: {
                        size: 11,
                        weight: "600",
                    },
                },
            },
            y: {
                beginAtZero: true,
                grid: {
                    color: colors.grid,
                },
                border: {
                    display: false,
                },
                ticks: {
                    color: colors.text,
                    font: {
                        size: 10,
                    },
                },
            },
        };
    }

    function pointerOnHover(event, chartElements) {
        event.native.target.style.cursor = chartElements.length
            ? "pointer"
            : "default";
    }

    function applyDateFromSeries(series, index) {
        const item = series[index];

        if (!item || !item.data) {
            return;
        }

        const date = String(item.data).slice(0, 10);
        elements.dataInicio.value = date;
        elements.dataFim.value = date;

        applyLocalDashboardFilters();
    }

    function applySelectChartFilter(select, value) {
        if (!value) {
            return;
        }

        if (select === elements.status) {
            state.insightStatusGroup = "";
        }

        ensureSelectOption(select, value);
        select.value = value;

        applyLocalDashboardFilters();
    }

    function renderTrendChart(series) {
        destroyChart("trend");

        const canvas = byId("processingTrendChart");
        const colors = chartColors();
        const labels = series.map(function (item) {
            return formatDateLabel(item.data);
        });

        state.charts.trend = new Chart(canvas, {
            data: {
                labels: labels,
                datasets: [
                    {
                        type: "bar",
                        label: "Arquivos",
                        data: series.map(function (item) {
                            return item.arquivos;
                        }),
                        backgroundColor: "rgba(37, 99, 235, 0.82)",
                        hoverBackgroundColor: colors.blue,
                        borderRadius: 6,
                        yAxisID: "y",
                    },
                    {
                        type: "line",
                        label: "Linhas",
                        data: series.map(function (item) {
                            return item.linhas;
                        }),
                        borderColor: colors.green,
                        backgroundColor: colors.green,
                        pointRadius: 3,
                        pointHoverRadius: 6,
                        borderWidth: 2.2,
                        tension: 0.34,
                        yAxisID: "y1",
                    },
                    {
                        type: "line",
                        label: "Tempo médio",
                        data: series.map(function (item) {
                            return item.tempo_medio_segundos;
                        }),
                        borderColor: colors.purple,
                        backgroundColor: colors.purple,
                        pointRadius: 3,
                        pointHoverRadius: 6,
                        borderWidth: 2.2,
                        tension: 0.34,
                        yAxisID: "y2",
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: "index",
                    intersect: false,
                },
                onHover: pointerOnHover,
                onClick: function (event, activeElements) {
                    if (!activeElements.length) {
                        return;
                    }

                    applyDateFromSeries(
                        series,
                        activeElements[0].index
                    );
                },
                plugins: {
                    legend: {
                        position: "top",
                        align: "start",
                        labels: {
                            usePointStyle: true,
                            boxWidth: 8,
                            color: colors.text,
                            font: {
                                size: 10,
                                weight: "600",
                            },
                        },
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                if (context.dataset.label === "Linhas") {
                                    return (
                                        " Linhas: " +
                                        formatNumber(context.raw)
                                    );
                                }

                                if (context.dataset.label === "Tempo médio") {
                                    return (
                                        " Tempo médio: " +
                                        formatSeconds(context.raw)
                                    );
                                }

                                return (
                                    " Arquivos: " +
                                    formatNumber(context.raw)
                                );
                            },
                        },
                    },
                },
                scales: {
                    x: commonScales().x,
                    y: {
                        ...commonScales().y,
                        position: "left",
                        title: {
                            display: true,
                            text: "Arquivos",
                            color: colors.text,
                            font: {
                                size: 9,
                            },
                        },
                    },
                    y1: {
                        beginAtZero: true,
                        position: "right",
                        grid: {
                            display: false,
                        },
                        border: {
                            display: false,
                        },
                        ticks: {
                            color: colors.text,
                            font: {
                                size: 9,
                            },
                            callback: compactNumber,
                        },
                    },
                    y2: {
                        display: false,
                        beginAtZero: true,
                    },
                },
            },
        });

        byId("processingTrendEmpty").classList.toggle(
            "is-visible",
            !series.length
        );
    }

    function renderStatusChart(items) {
        destroyChart("status");

        const colors = chartColors();

        state.charts.status = new Chart(byId("processingStatusChart"), {
            type: "doughnut",
            data: {
                labels: items.map(function (item) {
                    return item.status;
                }),
                datasets: [
                    {
                        data: items.map(function (item) {
                            return item.quantidade;
                        }),
                        backgroundColor: items.map(function (item) {
                            return statusColor(item.status);
                        }),
                        borderColor: colors.surface,
                        borderWidth: 3,
                        hoverOffset: 8,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: "68%",
                onHover: pointerOnHover,
                onClick: function (event, activeElements) {
                    if (!activeElements.length) {
                        return;
                    }

                    const item = items[activeElements[0].index];
                    applySelectChartFilter(elements.status, item.status);
                },
                plugins: {
                    legend: {
                        display: false,
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                return (
                                    " " +
                                    context.label +
                                    ": " +
                                    formatNumber(context.raw)
                                );
                            },
                        },
                    },
                },
            },
        });

        elements.statusSummary.innerHTML =
            items
                .map(function (item) {
                    return (
                        '<button type="button" class="processing-status-item" data-status-filter="' +
                        escapeHtml(item.status) +
                        '">' +
                            '<span class="processing-status-label">' +
                                '<span class="processing-status-dot" style="--status-color:' +
                                statusColor(item.status) +
                                '"></span>' +
                                "<span>" +
                                escapeHtml(item.status) +
                                "</span>" +
                            "</span>" +
                            '<span class="processing-status-number">' +
                            formatNumber(item.quantidade) +
                            " · " +
                            formatNumber(item.percentual, 1) +
                            "%</span>" +
                        "</button>"
                    );
                })
                .join("") ||
            '<div class="processing-table-empty">Sem status no período.</div>';

        elements.statusSummary
            .querySelectorAll("[data-status-filter]")
            .forEach(function (button) {
                button.addEventListener("click", function () {
                    applySelectChartFilter(
                        elements.status,
                        button.getAttribute("data-status-filter")
                    );
                });
            });

        byId("processingStatusEmpty").classList.toggle(
            "is-visible",
            !items.length
        );
    }

    function renderErrorsChart(items) {
        destroyChart("errors");

        const colors = chartColors();

        state.charts.errors = new Chart(byId("processingErrorsChart"), {
            type: "bar",
            data: {
                labels: items.map(function (item) {
                    return item.motivo;
                }),
                datasets: [
                    {
                        label: "Erros",
                        data: items.map(function (item) {
                            return item.quantidade;
                        }),
                        backgroundColor: "rgba(225, 71, 71, 0.85)",
                        hoverBackgroundColor: colors.red,
                        borderRadius: 6,
                        barThickness: 15,
                    },
                ],
            },
            options: {
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,
                onHover: pointerOnHover,
                onClick: function (event, activeElements) {
                    if (!activeElements.length) {
                        return;
                    }

                    const item = items[activeElements[0].index];
                    elements.busca.value = item.motivo;

                    applyLocalDashboardFilters();
                },
                plugins: {
                    legend: {
                        display: false,
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                return (
                                    " " +
                                    formatNumber(context.raw) +
                                    " ocorrência(s)"
                                );
                            },
                        },
                    },
                },
                scales: {
                    x: commonScales().y,
                    y: {
                        grid: {
                            display: false,
                        },
                        border: {
                            display: false,
                        },
                        ticks: {
                            color: colors.text,
                            font: {
                                size: 10,
                            },
                            callback: function (value) {
                                const text = this.getLabelForValue(value);
                                return text.length > 34
                                    ? text.slice(0, 34) + "…"
                                    : text;
                            },
                        },
                    },
                },
            },
        });

        byId("processingErrorsEmpty").classList.toggle(
            "is-visible",
            !items.length
        );
    }

    function renderBanksChart(items) {
        destroyChart("banks");

        const colors = chartColors();

        state.charts.banks = new Chart(byId("processingBanksChart"), {
            type: "bar",
            data: {
                labels: items.map(function (item) {
                    return item.nome;
                }),
                datasets: [
                    {
                        label: "Linhas",
                        data: items.map(function (item) {
                            return item.linhas;
                        }),
                        backgroundColor: "rgba(37, 99, 235, 0.82)",
                        hoverBackgroundColor: colors.blue,
                        borderRadius: 7,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                onHover: pointerOnHover,
                onClick: function (event, activeElements) {
                    if (!activeElements.length) {
                        return;
                    }

                    const item = items[activeElements[0].index];
                    applySelectChartFilter(elements.banco, item.nome);
                },
                plugins: {
                    legend: {
                        display: false,
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const item = items[context.dataIndex];
                                return [
                                    " Linhas: " + formatNumber(context.raw),
                                    " Arquivos: " + formatNumber(item.arquivos),
                                ];
                            },
                        },
                    },
                },
                scales: commonScales(),
            },
        });

        byId("processingBanksEmpty").classList.toggle(
            "is-visible",
            !items.length
        );
    }

    function renderAverageChart(series) {
        destroyChart("average");

        const colors = chartColors();

        state.charts.average = new Chart(byId("processingAverageChart"), {
            type: "line",
            data: {
                labels: series.map(function (item) {
                    return formatDateLabel(item.data);
                }),
                datasets: [
                    {
                        label: "Tempo médio",
                        data: series.map(function (item) {
                            return item.tempo_medio_segundos;
                        }),
                        borderColor: colors.purple,
                        backgroundColor:
                            state.theme === "dark"
                                ? "rgba(167, 139, 250, 0.16)"
                                : "rgba(124, 92, 232, 0.13)",
                        fill: true,
                        tension: 0.36,
                        pointRadius: 3.5,
                        pointHoverRadius: 7,
                        pointBackgroundColor: colors.surface,
                        pointBorderColor: colors.purple,
                        pointBorderWidth: 2,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                onHover: pointerOnHover,
                onClick: function (event, activeElements) {
                    if (!activeElements.length) {
                        return;
                    }

                    applyDateFromSeries(
                        series,
                        activeElements[0].index
                    );
                },
                plugins: {
                    legend: {
                        display: false,
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                return (
                                    " Tempo médio: " +
                                    formatSeconds(context.raw)
                                );
                            },
                        },
                    },
                },
                scales: {
                    x: commonScales().x,
                    y: {
                        ...commonScales().y,
                        ticks: {
                            color: colors.text,
                            font: {
                                size: 10,
                            },
                            callback: formatSeconds,
                        },
                    },
                },
            },
        });

        byId("processingAverageEmpty").classList.toggle(
            "is-visible",
            !series.length
        );
    }

    function renderEmployeesChart(items) {
        destroyChart("employees");

        const colors = chartColors();

        state.charts.employees = new Chart(
            byId("processingEmployeesChart"),
            {
                type: "bar",
                data: {
                    labels: items.map(function (item) {
                        return item.nome;
                    }),
                    datasets: [
                        {
                            label: "Arquivos",
                            data: items.map(function (item) {
                                return item.arquivos;
                            }),
                            backgroundColor: "rgba(8, 145, 178, 0.82)",
                            hoverBackgroundColor: colors.cyan,
                            borderRadius: 7,
                        },
                    ],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    onHover: pointerOnHover,
                    onClick: function (event, activeElements) {
                        if (!activeElements.length) {
                            return;
                        }

                        const item = items[activeElements[0].index];
                        applySelectChartFilter(
                            elements.funcionario,
                            item.nome
                        );
                    },
                    plugins: {
                        legend: {
                            display: false,
                        },
                        tooltip: {
                            callbacks: {
                                afterLabel: function (context) {
                                    const item = items[context.dataIndex];
                                    return (
                                        "Linhas: " +
                                        formatNumber(item.linhas) +
                                        "\nTempo médio: " +
                                        formatSeconds(
                                            item.tempo_medio_segundos
                                        )
                                    );
                                },
                            },
                        },
                    },
                    scales: commonScales(),
                },
            }
        );

        byId("processingEmployeesEmpty").classList.toggle(
            "is-visible",
            !items.length
        );
    }

    function renderFixedCharts(data) {
        const series = (data && data.serie_temporal) || [];
        state.fixedSeries = series;
        state.lastFixedData = data || null;

        renderTrendChart(series);
        renderAverageChart(series);
    }

    function renderFilteredCharts(data) {
        renderStatusChart(data.status || []);
        renderErrorsChart(data.motivos_erro || []);
        renderBanksChart(data.ranking_bancos || []);
        renderEmployeesChart(data.ranking_funcionarios || []);
    }

    function rerenderChartsForTheme() {
        if (state.fixedSeries.length || state.lastFixedData) {
            renderTrendChart(state.fixedSeries);
            renderAverageChart(state.fixedSeries);
        }

        if (state.lastFilteredData) {
            renderFilteredCharts(state.lastFilteredData);
        }
    }

    function insightFilterIsActive(item) {
        const field = String(item.filtro_campo || "");
        const value = String(item.filtro_valor || "");

        if (!field || !value) {
            return false;
        }

        if (field === "grupo_status") {
            return state.insightStatusGroup === value;
        }

        if (field === "banco") {
            return elements.banco.value === value;
        }

        if (field === "carteira") {
            return elements.carteira.value === value;
        }

        if (field === "status") {
            return elements.status.value === value;
        }

        return false;
    }

    function applyInsightFilter(item) {
        const field = String(item.filtro_campo || "");
        const value = String(item.filtro_valor || "");

        if (!item.clicavel || !field || !value) {
            return;
        }

        const active = insightFilterIsActive(item);

        if (field === "grupo_status") {
            state.insightStatusGroup = active ? "" : value;
            elements.status.value = "";
        } else if (field === "banco") {
            ensureSelectOption(elements.banco, value);
            elements.banco.value = active ? "" : value;
        } else if (field === "carteira") {
            ensureSelectOption(elements.carteira, value);
            elements.carteira.value = active ? "" : value;
        } else if (field === "status") {
            state.insightStatusGroup = "";
            ensureSelectOption(elements.status, value);
            elements.status.value = active ? "" : value;
        } else {
            return;
        }

        applyLocalDashboardFilters();
    }

    function renderInsights(items) {
        elements.insights.innerHTML = (items || [])
            .map(function (item, index) {
                const clickable = Boolean(
                    item.clicavel &&
                    item.filtro_campo &&
                    item.filtro_valor
                );
                const active = clickable && insightFilterIsActive(item);

                return (
                    '<article class="processing-insight-card' +
                    (clickable ? " is-clickable" : "") +
                    (active ? " is-active" : "") +
                    '" data-tone="' +
                    escapeHtml(item.tom || "primary") +
                    '" data-insight-index="' +
                    index +
                    '"' +
                    (clickable
                        ? ' role="button" tabindex="0" aria-pressed="' +
                          String(active) +
                          '" title="Clique para aplicar ou remover este filtro"'
                        : "") +
                    '>' +
                        '<span class="processing-insight-icon">' +
                            '<i class="fa ' +
                            escapeHtml(item.icone || "fa-info-circle") +
                            '" aria-hidden="true"></i>' +
                        "</span>" +
                        "<div>" +
                            "<strong>" +
                            escapeHtml(item.titulo) +
                            "</strong>" +
                            "<span>" +
                            escapeHtml(item.valor) +
                            "</span>" +
                            '<small title="' +
                            escapeHtml(item.detalhe) +
                            '">' +
                            escapeHtml(item.detalhe) +
                            "</small>" +
                        "</div>" +
                        (clickable
                            ? '<i class="fa fa-filter processing-insight-filter-icon" aria-hidden="true"></i>'
                            : "") +
                    "</article>"
                );
            })
            .join("");

        elements.insights
            .querySelectorAll(".processing-insight-card.is-clickable")
            .forEach(function (card) {
                const index = Number(
                    card.getAttribute("data-insight-index")
                );
                const item = items[index];

                card.addEventListener("click", function () {
                    applyInsightFilter(item);
                });

                card.addEventListener("keydown", function (event) {
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        applyInsightFilter(item);
                    }
                });
            });
    }

    function statusBadgeClass(status) {
        const normalized = normalizeText(status);

        if (normalized === "finalizado") {
            return "is-success";
        }

        if (normalized.indexOf("erro") === 0) {
            return "is-danger";
        }

        if (normalized === "processando") {
            return "is-warning";
        }

        return "";
    }

    function isFinalized(status) {
        return normalizeText(status) === "finalizado";
    }

    function isErrorStatus(status) {
        return normalizeText(status).indexOf("erro") === 0;
    }

    function isProcessing(status) {
        return normalizeText(status) === "processando";
    }

    function normalizeRecord(item, index) {
        const normalized = Object.assign({}, item);

        normalized.id = firstDefined(item.id, item.ID_IMP_ARQUIVO, 0);
        normalized.id_imp_arquivo = Number(
            firstDefined(
                item.id_imp_arquivo,
                item.ID_IMP_ARQUIVO,
                0
            ) || 0
        );
        normalized.data = firstDefined(item.data, item.DATA_IMPORTACAO, "");
        normalized.data_exibicao = firstDefined(
            item.data_exibicao,
            item.DATA_EXIBICAO,
            normalized.data,
            "-"
        );
        normalized.nome_arquivo = firstDefined(
            item.nome_arquivo,
            item.NOME_ARQUIVO,
            "-"
        );
        normalized.banco = firstDefined(item.banco, item.BANCO, "-");
        normalized.id_empresa = firstDefined(
            item.id_empresa,
            item.ID_EMPRESA,
            0
        );
        normalized.carteira = firstDefined(
            item.carteira,
            item.CARTEIRA,
            "-"
        );
        normalized.tipo = firstDefined(item.tipo, item.TIPO, "-");
        normalized.status = firstDefined(
            item.status,
            item.STATUS,
            "Desconhecido"
        );
        normalized.funcionario = firstDefined(
            item.funcionario,
            item.FUNCIONARIO,
            "-"
        );
        normalized.protocolo = firstDefined(
            item.protocolo,
            item.PROTOCOLO,
            "-"
        );
        normalized.quantidade_linhas = Number(
            firstDefined(
                item.quantidade_linhas,
                item.QTDE_LINHAS,
                0
            ) || 0
        );
        normalized.tempo_segundos = Number(
            firstDefined(item.tempo_segundos, item.TEMPO, 0) || 0
        );
        normalized.tempo_formatado = firstDefined(
            item.tempo_formatado,
            formatSeconds(normalized.tempo_segundos)
        );
        normalized.tempo_informado = Boolean(
            firstDefined(
                item.tempo_informado,
                item.TEMPO_INFORMADO,
                true
            )
        );
        normalized.tempo_teste_segundos = Number(
            firstDefined(
                item.tempo_teste_segundos,
                item.TEMPO_TESTE,
                0
            ) || 0
        );
        normalized.tempo_teste_formatado = firstDefined(
            item.tempo_teste_formatado,
            formatSeconds(normalized.tempo_teste_segundos)
        );
        normalized.layout_ok = firstDefined(
            item.layout_ok,
            item.LAYOUT_OK,
            ""
        );
        normalized.num_instancia = firstDefined(
            item.num_instancia,
            item.NUM_INSTANCIA,
            ""
        );
        normalized.qtde_instancia = Number(
            firstDefined(
                item.qtde_instancia,
                item.QTDE_INSTANCIA,
                0
            ) || 0
        );
        normalized.velocidade_linhas_minuto = Number(
            firstDefined(
                item.velocidade_linhas_minuto,
                item.VELOCIDADE_LINHAS_MINUTO,
                0
            ) || 0
        );
        normalized.versao_cslog = firstDefined(
            item.versao_cslog,
            item.VERSAO_CSLOG,
            "-"
        );
        normalized.erro = firstDefined(item.erro, item.ERRO, "");
        normalized.origem_processamento = firstDefined(
            item.origem_processamento,
            item.ORIGEM_PROCESSAMENTO,
            ""
        );
        normalized.alias_processamento = firstDefined(
            item.alias_processamento,
            item.ALIAS_PROCESSAMENTO,
            ""
        );
        normalized.banco_fisico_processamento = firstDefined(
            item.banco_fisico_processamento,
            item.BANCO_FISICO_PROCESSAMENTO,
            ""
        );

        normalized._rowKey = [
            normalized.alias_processamento || normalized.origem_processamento,
            normalized.id,
            index,
        ].join("::");

        return normalized;
    }

    function meaningfulValue(value) {
        const text = String(value == null ? "" : value).trim();
        return text && text !== "-" ? text : "";
    }

    function instanceGroupKey(item) {
        const hasInstance =
            meaningfulValue(item.num_instancia) !== "" ||
            Number(item.qtde_instancia || 0) > 1;

        if (!hasInstance) {
            return "single::" + item._rowKey;
        }

        const protocol = meaningfulValue(item.protocolo);
        const file = meaningfulValue(item.nome_arquivo);
        const day = String(item.data || "").slice(0, 10);

        return [
            item.alias_processamento || item.origem_processamento,
            item.banco,
            item.carteira,
            item.tipo,
            protocol || file,
            day,
        ].join("::");
    }

    function buildInstanceGroups(records) {
        const groups = new Map();

        records.forEach(function (item) {
            const key = instanceGroupKey(item);

            if (!groups.has(key)) {
                groups.set(key, []);
            }

            groups.get(key).push(item);
        });

        groups.forEach(function (items, key) {
            const instanceMap = new Map();
            let maxInstance = -1;
            let informedQuantity = 0;

            items.forEach(function (item, index) {
                const rawInstance = meaningfulValue(item.num_instancia);
                const numericInstance = Number(rawInstance);
                const instanceKey = rawInstance !== ""
                    ? rawInstance
                    : "row-" + index;

                if (!instanceMap.has(instanceKey)) {
                    instanceMap.set(instanceKey, []);
                }

                instanceMap.get(instanceKey).push(item);

                if (
                    rawInstance !== "" &&
                    Number.isFinite(numericInstance)
                ) {
                    maxInstance = Math.max(maxInstance, numericInstance);
                }

                informedQuantity = Math.max(
                    informedQuantity,
                    Number(item.qtde_instancia || 0)
                );
            });

            const expected = Math.max(
                informedQuantity,
                maxInstance + 1,
                instanceMap.size
            );

            let finalized = 0;
            let errors = 0;
            let processing = 0;

            instanceMap.forEach(function (instanceRows) {
                if (
                    instanceRows.some(function (row) {
                        return isFinalized(row.status);
                    })
                ) {
                    finalized += 1;
                    return;
                }

                if (
                    instanceRows.some(function (row) {
                        return isErrorStatus(row.status);
                    })
                ) {
                    errors += 1;
                    return;
                }

                if (
                    instanceRows.some(function (row) {
                        return isProcessing(row.status);
                    })
                ) {
                    processing += 1;
                }
            });

            const isMultiple =
                expected > 1 ||
                items.length > 1 ||
                maxInstance > 0;
            const complete = isMultiple && expected > 0 && finalized >= expected;

            let label = "Individual";
            let tone = "neutral";

            if (isMultiple && complete) {
                label = "Concluído";
                tone = "success";
            } else if (isMultiple && errors) {
                label =
                    finalized +
                    "/" +
                    expected +
                    " concluídas · erro";
                tone = "danger";
            } else if (isMultiple && processing) {
                label =
                    finalized +
                    "/" +
                    expected +
                    " concluídas";
                tone = "warning";
            } else if (isMultiple) {
                label = finalized + "/" + expected + " concluídas";
                tone = finalized ? "warning" : "neutral";
            } else if (items.length === 1 && isFinalized(items[0].status)) {
                label = "Concluído";
                tone = "success";
            } else if (items.length === 1 && isErrorStatus(items[0].status)) {
                label = "Com erro";
                tone = "danger";
            } else if (items.length === 1 && isProcessing(items[0].status)) {
                label = "Em processamento";
                tone = "warning";
            }

            const groupInfo = {
                key: key,
                expected: expected,
                finalized: finalized,
                errors: errors,
                processing: processing,
                complete: complete,
                isMultiple: isMultiple,
                label: label,
                tone: tone,
            };

            items.forEach(function (item) {
                item._instanceGroup = groupInfo;
            });
        });

        return records;
    }

    function prepareRecords(records) {
        const normalized = (records || []).map(normalizeRecord);
        return buildInstanceGroups(normalized);
    }

    function renderStatusBadge(item) {
        return (
            '<span class="processing-status-badge ' +
            statusBadgeClass(item.status) +
            '">' +
            escapeHtml(item.status) +
            "</span>"
        );
    }

    function renderLayoutBadge(item) {
        const value = normalizeBoolean(item.layout_ok);

        if (value === true) {
            return (
                '<span class="processing-layout-badge is-ok">' +
                '<i class="fa fa-check" aria-hidden="true"></i> OK' +
                "</span>"
            );
        }

        if (value === false) {
            return (
                '<span class="processing-layout-badge is-not-ok">' +
                '<i class="fa fa-times" aria-hidden="true"></i> Não' +
                "</span>"
            );
        }

        return '<span class="processing-layout-badge">—</span>';
    }

    function renderInstanceBadge(item) {
        const group = item._instanceGroup || {};
        const number = meaningfulValue(item.num_instancia);

        if (!group.isMultiple && number === "") {
            return '<span class="processing-instance-badge">—</span>';
        }

        const shownNumber = number === "" ? "—" : number;
        const total = group.expected || item.qtde_instancia || "—";

        return (
            '<span class="processing-instance-badge is-multiple" title="Índice da instância / total esperado">' +
            '<i class="fa fa-clone" aria-hidden="true"></i>' +
            escapeHtml(shownNumber) +
            " / " +
            escapeHtml(total) +
            "</span>"
        );
    }

    function renderGroupBadge(item) {
        const group = item._instanceGroup || {
            label: "Individual",
            tone: "neutral",
        };

        return (
            '<span class="processing-group-badge is-' +
            escapeHtml(group.tone) +
            '">' +
            escapeHtml(group.label) +
            "</span>"
        );
    }

    const COLUMN_DEFINITIONS = {
        data: {
            label: "Data / hora",
            width: 154,
            value: function (item) {
                return item.data || item.data_exibicao;
            },
            search: function (item) {
                return item.data_exibicao;
            },
            render: function (item) {
                return escapeHtml(item.data_exibicao);
            },
        },
        arquivo: {
            label: "Arquivo",
            width: 310,
            value: function (item) {
                return item.nome_arquivo;
            },
            search: function (item) {
                return [item.nome_arquivo, item.id, item.protocolo].join(" ");
            },
            render: function (item) {
                return (
                    '<div class="processing-file-cell">' +
                        '<strong title="' +
                        escapeHtml(item.nome_arquivo) +
                        '">' +
                        escapeHtml(item.nome_arquivo) +
                        "</strong>" +
                        "<small>ID " +
                        escapeHtml(item.id) +
                        " · Protocolo " +
                        escapeHtml(item.protocolo) +
                        "</small>" +
                    "</div>"
                );
            },
        },
        id_imp_arquivo: {
            label: "ID importação",
            width: 135,
            numeric: true,
            value: function (item) {
                return item.id_imp_arquivo;
            },
            render: function (item) {
                return formatNumber(item.id_imp_arquivo);
            },
        },
        protocolo: {
            label: "Protocolo",
            width: 185,
            value: function (item) {
                return item.protocolo;
            },
            render: function (item) {
                return escapeHtml(item.protocolo || "—");
            },
        },
        banco: {
            label: "Banco",
            width: 150,
            value: function (item) {
                return item.banco;
            },
            render: function (item) {
                return escapeHtml(item.banco);
            },
        },
        carteira: {
            label: "Carteira",
            width: 135,
            value: function (item) {
                return item.carteira;
            },
            render: function (item) {
                return escapeHtml(item.carteira);
            },
        },
        tipo: {
            label: "Tipo",
            width: 115,
            value: function (item) {
                return item.tipo;
            },
            render: function (item) {
                return escapeHtml(item.tipo);
            },
        },
        quantidade_linhas: {
            label: "Linhas",
            width: 120,
            numeric: true,
            value: function (item) {
                return item.quantidade_linhas;
            },
            render: function (item) {
                return formatNumber(item.quantidade_linhas);
            },
        },
        tempo: {
            label: "Tempo",
            width: 110,
            numeric: true,
            value: function (item) {
                return item.tempo_segundos;
            },
            search: function (item) {
                return item.tempo_formatado;
            },
            render: function (item) {
                return escapeHtml(item.tempo_formatado);
            },
        },
        tempo_teste: {
            label: "Tempo teste",
            width: 120,
            numeric: true,
            value: function (item) {
                return item.tempo_teste_segundos;
            },
            search: function (item) {
                return item.tempo_teste_formatado;
            },
            render: function (item) {
                return escapeHtml(item.tempo_teste_formatado);
            },
        },
        layout_ok: {
            label: "Layout OK",
            width: 110,
            value: function (item) {
                return normalizeBoolean(item.layout_ok) === true ? 1 : 0;
            },
            search: function (item) {
                const value = normalizeBoolean(item.layout_ok);
                return value === true
                    ? "ok sim"
                    : value === false
                        ? "não nao"
                        : "";
            },
            render: renderLayoutBadge,
        },
        num_instancia: {
            label: "Instância",
            width: 130,
            numeric: true,
            value: function (item) {
                const value = Number(item.num_instancia);
                return Number.isFinite(value) ? value : -1;
            },
            search: function (item) {
                return [
                    item.num_instancia,
                    item._instanceGroup && item._instanceGroup.expected,
                ].join(" ");
            },
            render: renderInstanceBadge,
        },
        qtde_instancia: {
            label: "Qtd. instâncias",
            width: 135,
            numeric: true,
            value: function (item) {
                return (
                    (item._instanceGroup && item._instanceGroup.expected) ||
                    item.qtde_instancia ||
                    0
                );
            },
            render: function (item) {
                const total =
                    (item._instanceGroup && item._instanceGroup.expected) ||
                    item.qtde_instancia ||
                    0;
                return total ? formatNumber(total) : "—";
            },
        },
        conjunto: {
            label: "Situação do conjunto",
            width: 180,
            value: function (item) {
                return item._instanceGroup
                    ? item._instanceGroup.label
                    : "Individual";
            },
            render: renderGroupBadge,
        },
        velocidade: {
            label: "Velocidade",
            width: 135,
            numeric: true,
            value: function (item) {
                return item.velocidade_linhas_minuto;
            },
            render: function (item) {
                return (
                    formatNumber(item.velocidade_linhas_minuto, 0) +
                    "/min"
                );
            },
        },
        status: {
            label: "Status",
            width: 130,
            value: function (item) {
                return item.status;
            },
            render: renderStatusBadge,
        },
        funcionario: {
            label: "Funcionário",
            width: 230,
            value: function (item) {
                return item.funcionario;
            },
            render: function (item) {
                return escapeHtml(item.funcionario);
            },
        },
        erro: {
            label: "Erro / observação",
            width: 330,
            value: function (item) {
                return item.erro || "Sem erro";
            },
            render: function (item) {
                const errorText = item.erro || "Sem erro";
                const displayed =
                    errorText.length > 90
                        ? errorText.slice(0, 90) + "…"
                        : errorText;

                return (
                    '<span title="' +
                    escapeHtml(errorText) +
                    '">' +
                    escapeHtml(displayed) +
                    "</span>"
                );
            },
        },
    };

    function columnDefinition(key) {
        return COLUMN_DEFINITIONS[key];
    }

    function renderColgroup() {
        elements.tableColgroup.innerHTML = state.ordemColunas
            .map(function (key) {
                const definition = columnDefinition(key);
                const width =
                    Number(state.largurasColunas[key]) ||
                    Number(definition.width) ||
                    120;

                return (
                    '<col data-column="' +
                    escapeHtml(key) +
                    '" style="width:' +
                    width +
                    'px">'
                );
            })
            .join("");
    }

    function sortIndicator(key) {
        if (state.ordenacao.chave !== key) {
            return '<i class="fa fa-sort processing-sort-icon" aria-hidden="true"></i>';
        }

        return (
            '<i class="fa ' +
            (state.ordenacao.direcao === "asc"
                ? "fa-sort-asc"
                : "fa-sort-desc") +
            ' processing-sort-icon is-active" aria-hidden="true"></i>'
        );
    }

    function renderTableHead() {
        renderColgroup();

        const headerCells = state.ordemColunas
            .map(function (key) {
                const definition = columnDefinition(key);

                return (
                    '<th class="processing-column-header" ' +
                    'data-column="' +
                    escapeHtml(key) +
                    '" draggable="true" scope="col">' +
                        '<button type="button" class="processing-column-sort" data-sort-column="' +
                        escapeHtml(key) +
                        '">' +
                            '<span class="processing-column-grip" title="Arraste para mudar a posição">' +
                                '<i class="fa fa-ellipsis-v" aria-hidden="true"></i>' +
                            "</span>" +
                            '<span class="processing-column-title">' +
                            escapeHtml(definition.label) +
                            "</span>" +
                            sortIndicator(key) +
                        "</button>" +
                        '<span class="processing-column-resizer" data-resize-column="' +
                        escapeHtml(key) +
                        '" title="Arraste para alterar a largura"></span>' +
                    "</th>"
                );
            })
            .join("");

        const filterCells = state.ordemColunas
            .map(function (key) {
                const definition = columnDefinition(key);
                const value = state.filtrosColunas[key] || "";

                return (
                    '<th class="processing-column-search-cell" data-column="' +
                    escapeHtml(key) +
                    '">' +
                        '<div class="processing-column-search-wrap">' +
                            '<i class="fa fa-search" aria-hidden="true"></i>' +
                            '<input type="search" class="processing-column-filter" ' +
                            'data-filter-column="' +
                            escapeHtml(key) +
                            '" value="' +
                            escapeHtml(value) +
                            '" placeholder="Pesquisar ' +
                            escapeHtml(definition.label.toLocaleLowerCase("pt-BR")) +
                            '" autocomplete="off">' +
                        "</div>" +
                    "</th>"
                );
            })
            .join("");

        elements.tableHead.innerHTML =
            '<tr class="processing-table-header-row">' +
            headerCells +
            "</tr>" +
            '<tr class="processing-table-filter-row">' +
            filterCells +
            "</tr>";

        bindTableHeaderEvents();
    }

    function bindTableHeaderEvents() {
        elements.tableHead
            .querySelectorAll("[data-sort-column]")
            .forEach(function (button) {
                button.addEventListener("click", function () {
                    const key = button.getAttribute("data-sort-column");

                    if (state.ordenacao.chave === key) {
                        state.ordenacao.direcao =
                            state.ordenacao.direcao === "asc"
                                ? "desc"
                                : "asc";
                    } else {
                        state.ordenacao.chave = key;
                        state.ordenacao.direcao = "asc";
                    }

                    state.paginaAtual = 1;
                    renderTableHead();
                    applyTableOperations();
                });
            });

        elements.tableHead
            .querySelectorAll("[data-filter-column]")
            .forEach(function (input) {
                input.addEventListener("input", function () {
                    const key = input.getAttribute("data-filter-column");
                    state.filtrosColunas[key] = input.value;

                    window.clearTimeout(state.columnFilterTimer);
                    state.columnFilterTimer = window.setTimeout(function () {
                        state.paginaAtual = 1;
                        applyTableOperations();
                    }, 180);
                });

                input.addEventListener("click", function (event) {
                    event.stopPropagation();
                });
            });

        elements.tableHead
            .querySelectorAll(".processing-column-header")
            .forEach(function (header) {
                header.addEventListener("dragstart", function (event) {
                    state.colunaArrastada = header.getAttribute("data-column");
                    header.classList.add("is-dragging");
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData(
                        "text/plain",
                        state.colunaArrastada
                    );
                });

                header.addEventListener("dragend", function () {
                    header.classList.remove("is-dragging");
                    state.colunaArrastada = null;

                    elements.tableHead
                        .querySelectorAll(".is-drag-target")
                        .forEach(function (target) {
                            target.classList.remove("is-drag-target");
                        });
                });

                header.addEventListener("dragover", function (event) {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    header.classList.add("is-drag-target");
                });

                header.addEventListener("dragleave", function () {
                    header.classList.remove("is-drag-target");
                });

                header.addEventListener("drop", function (event) {
                    event.preventDefault();
                    header.classList.remove("is-drag-target");

                    const source =
                        state.colunaArrastada ||
                        event.dataTransfer.getData("text/plain");
                    const target = header.getAttribute("data-column");

                    if (!source || !target || source === target) {
                        return;
                    }

                    const sourceIndex = state.ordemColunas.indexOf(source);
                    const targetIndex = state.ordemColunas.indexOf(target);

                    if (sourceIndex < 0 || targetIndex < 0) {
                        return;
                    }

                    state.ordemColunas.splice(sourceIndex, 1);
                    state.ordemColunas.splice(targetIndex, 0, source);
                    saveColumnPreferences();
                    renderTableHead();
                    renderTable();
                });
            });

        elements.tableHead
            .querySelectorAll("[data-resize-column]")
            .forEach(function (resizer) {
                resizer.addEventListener("mousedown", function (event) {
                    event.preventDefault();
                    event.stopPropagation();

                    const key = resizer.getAttribute("data-resize-column");
                    const header = resizer.closest("th");
                    const startX = event.clientX;
                    const startWidth = header.getBoundingClientRect().width;

                    document.body.classList.add("processing-is-resizing");

                    function onMove(moveEvent) {
                        const width = Math.min(
                            720,
                            Math.max(
                                86,
                                startWidth + moveEvent.clientX - startX
                            )
                        );

                        state.largurasColunas[key] = Math.round(width);

                        const col = elements.tableColgroup.querySelector(
                            'col[data-column="' + CSS.escape(key) + '"]'
                        );

                        if (col) {
                            col.style.width = width + "px";
                        }
                    }

                    function onEnd() {
                        document.removeEventListener("mousemove", onMove);
                        document.removeEventListener("mouseup", onEnd);
                        document.body.classList.remove("processing-is-resizing");
                        saveColumnPreferences();
                    }

                    document.addEventListener("mousemove", onMove);
                    document.addEventListener("mouseup", onEnd);
                });
            });
    }

    function columnSearchValue(item, key) {
        const definition = columnDefinition(key);

        if (definition.search) {
            return definition.search(item);
        }

        return definition.value(item);
    }

    function compareValues(left, right, numeric) {
        if (numeric) {
            return Number(left || 0) - Number(right || 0);
        }

        return String(left == null ? "" : left).localeCompare(
            String(right == null ? "" : right),
            "pt-BR",
            {
                numeric: true,
                sensitivity: "base",
            }
        );
    }

    function applyTableOperations() {
        const activeFilters = Object.keys(state.filtrosColunas).filter(
            function (key) {
                return normalizeText(state.filtrosColunas[key]) !== "";
            }
        );

        let records = state.registros.filter(function (item) {
            return activeFilters.every(function (key) {
                const filter = normalizeText(state.filtrosColunas[key]);
                const value = normalizeText(columnSearchValue(item, key));
                return value.includes(filter);
            });
        });

        const sortKey = state.ordenacao.chave;
        const sortDefinition = columnDefinition(sortKey);
        const direction = state.ordenacao.direcao === "asc" ? 1 : -1;

        records = records.slice().sort(function (left, right) {
            const comparison = compareValues(
                sortDefinition.value(left),
                sortDefinition.value(right),
                sortDefinition.numeric
            );

            if (comparison !== 0) {
                return comparison * direction;
            }

            return Number(right.id || 0) - Number(left.id || 0);
        });

        state.registrosTabela = records;
        renderTable();
        renderTableInfo();
    }

    function rowHtml(item) {
        const group = item._instanceGroup || {};
        const rowClasses = ["processing-data-row"];

        if (group.isMultiple) {
            rowClasses.push("is-multi-instance");
        }

        if (group.complete) {
            rowClasses.push("is-instance-complete");
        }

        const cells = state.ordemColunas
            .map(function (key) {
                const definition = columnDefinition(key);
                return (
                    '<td data-column="' +
                    escapeHtml(key) +
                    '">' +
                    definition.render(item) +
                    "</td>"
                );
            })
            .join("");

        return (
            '<tr class="' +
            rowClasses.join(" ") +
            '" data-row-key="' +
            escapeHtml(item._rowKey) +
            '" data-instance-group="' +
            escapeHtml(group.key || "") +
            '" tabindex="0" aria-label="Abrir detalhes do arquivo ' +
            escapeHtml(item.nome_arquivo) +
            '">' +
            cells +
            "</tr>"
        );
    }

    function renderTable() {
        const total = state.registrosTabela.length;
        const totalPages = Math.max(
            1,
            Math.ceil(total / state.porPagina)
        );

        if (state.paginaAtual > totalPages) {
            state.paginaAtual = totalPages;
        }

        const start = (state.paginaAtual - 1) * state.porPagina;
        const pageItems = state.registrosTabela.slice(
            start,
            start + state.porPagina
        );

        elements.tableBody.innerHTML = pageItems.length
            ? pageItems.map(rowHtml).join("")
            : '<tr><td colspan="' +
              state.ordemColunas.length +
              '" class="processing-table-empty">' +
              "Nenhum processamento localizado para os filtros selecionados." +
              "</td></tr>";

        elements.paginationLabel.innerHTML =
            "Página <strong>" +
            state.paginaAtual +
            "</strong> de <strong>" +
            totalPages +
            "</strong>";

        elements.prevPage.disabled = state.paginaAtual <= 1;
        elements.nextPage.disabled = state.paginaAtual >= totalPages;

        elements.tableBody
            .querySelectorAll("tr[data-row-key]")
            .forEach(function (row) {
                function open() {
                    const rowKey = row.getAttribute("data-row-key");
                    const item = state.registros.find(function (record) {
                        return record._rowKey === rowKey;
                    });

                    if (item) {
                        openDetails(item);
                    }
                }

                row.addEventListener("click", open);
                row.addEventListener("keydown", function (event) {
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        open();
                    }
                });
            });
    }

    function renderTableInfo() {
        const visible = state.registrosTabela.length;
        const loaded = state.registros.length;
        const totalServer = state.tableServerInfo.totalRegistros;
        const hasColumnFilters = Object.keys(state.filtrosColunas).some(
            function (key) {
                return normalizeText(state.filtrosColunas[key]) !== "";
            }
        );

        let text =
            "Exibindo <strong>" +
            formatNumber(visible) +
            "</strong> registro(s) na tabela";

        if (hasColumnFilters) {
            text +=
                " após a pesquisa nas colunas, de <strong>" +
                formatNumber(loaded) +
                "</strong> carregado(s)";
        }

        text += ".";

        if (totalServer > loaded) {
            text +=
                " O servidor retornou os " +
                formatNumber(loaded) +
                " registros mais recentes de " +
                formatNumber(totalServer) +
                ".";
        }

        elements.tableInfo.innerHTML = text;
    }

    function detailItem(label, value, wide) {
        return (
            '<div class="processing-detail-item' +
            (wide ? " is-wide" : "") +
            '">' +
                "<span>" +
                escapeHtml(label) +
                "</span>" +
                "<strong>" +
                escapeHtml(
                    value === undefined || value === null || value === ""
                        ? "—"
                        : value
                ) +
                "</strong>" +
            "</div>"
        );
    }

    function layoutDescription(value) {
        const normalized = normalizeBoolean(value);

        if (normalized === true) {
            return "OK";
        }

        if (normalized === false) {
            return "Não aprovado";
        }

        return "Não informado";
    }

    function openDetails(item) {
        const group = item._instanceGroup || {};
        const instanceIndex = meaningfulValue(item.num_instancia) || "—";
        const expected = group.expected || item.qtde_instancia || "—";

        elements.detailTitle.textContent = item.nome_arquivo;
        elements.detailSubtitle.textContent =
            "Processamento #" +
            item.id +
            " · " +
            item.status +
            (group.isMultiple ? " · Arquivo dividido em instâncias" : "");

        elements.detailBody.innerHTML =
            '<div class="processing-detail-grid">' +
                detailItem("Data da importação", item.data_exibicao) +
                detailItem(
                    "ID da importação",
                    formatNumber(item.id_imp_arquivo)
                ) +
                detailItem(
                    "Banco / Empresa",
                    item.banco + " (#" + item.id_empresa + ")"
                ) +
                detailItem("Carteira", item.carteira) +
                detailItem("Tipo", item.tipo) +
                detailItem("Funcionário", item.funcionario) +
                detailItem("Status da ocorrência", item.status) +
                detailItem(
                    "Situação do arquivo completo",
                    group.label || "Individual"
                ) +
                detailItem(
                    "Progresso das instâncias",
                    group.isMultiple
                        ? group.finalized + " de " + expected + " concluídas"
                        : "Arquivo individual"
                ) +
                detailItem("Índice da instância", instanceIndex) +
                detailItem("Quantidade de instâncias", expected) +
                detailItem("Layout OK", layoutDescription(item.layout_ok)) +
                detailItem(
                    "Quantidade de linhas",
                    formatNumber(item.quantidade_linhas)
                ) +
                detailItem("Tempo", item.tempo_formatado) +
                detailItem("Tempo de teste", item.tempo_teste_formatado) +
                detailItem(
                    "Velocidade",
                    formatNumber(item.velocidade_linhas_minuto, 0) +
                        " linhas/min"
                ) +
                detailItem("Versão CSLog", item.versao_cslog) +
                detailItem(
                    "Origem do processamento",
                    item.origem_processamento ||
                        item.banco_fisico_processamento ||
                        "—"
                ) +
                detailItem("Protocolo", item.protocolo, true) +
                detailItem(
                    "Erro / observação",
                    item.erro || "Nenhum erro informado",
                    true
                ) +
            "</div>";

        if (
            typeof elements.detailDialog.showModal === "function" &&
            !elements.detailDialog.open
        ) {
            elements.detailDialog.showModal();
        } else {
            elements.detailDialog.setAttribute("open", "open");
        }
    }

    function closeDetails() {
        if (
            typeof elements.detailDialog.close === "function" &&
            elements.detailDialog.open
        ) {
            elements.detailDialog.close();
        } else {
            elements.detailDialog.removeAttribute("open");
        }
    }

    async function fetchDashboardData(params, signal) {
        const query = params && params.toString()
            ? "?" + params.toString()
            : "";
        const url = elements.form.dataset.url + query;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "X-Requested-With": "XMLHttpRequest",
            },
            credentials: "same-origin",
            cache: "no-store",
            signal: signal,
        });

        const data = await response.json();

        if (!response.ok || data.erro) {
            throw new Error(
                data.mensagem ||
                    "Não foi possível carregar o dashboard."
            );
        }

        return data;
    }


    function recordMatchesCurrentFilters(item) {
        const recordDate = String(item.data || "").slice(0, 10);
        const startDate = elements.dataInicio.value;
        const endDate = elements.dataFim.value;

        if (startDate && (!recordDate || recordDate < startDate)) {
            return false;
        }

        if (endDate && (!recordDate || recordDate > endDate)) {
            return false;
        }

        const exactFilters = [
            [item.banco, elements.banco.value],
            [item.carteira, elements.carteira.value],
            [item.tipo, elements.tipo.value],
            [item.status, elements.status.value],
            [item.funcionario, elements.funcionario.value],
        ];

        for (let index = 0; index < exactFilters.length; index += 1) {
            const recordValue = normalizeText(exactFilters[index][0]);
            const filterValue = normalizeText(exactFilters[index][1]);

            if (filterValue && recordValue !== filterValue) {
                return false;
            }
        }

        const normalizedStatus = normalizeText(item.status);

        if (
            state.insightStatusGroup === "erro" &&
            normalizedStatus.indexOf("erro") !== 0
        ) {
            return false;
        }

        if (
            state.insightStatusGroup === "processando" &&
            normalizedStatus !== "processando"
        ) {
            return false;
        }

        const search = normalizeText(elements.busca.value.trim());

        if (search) {
            const searchable = normalizeText(
                [
                    item.nome_arquivo,
                    item.id_imp_arquivo,
                    item.protocolo,
                    item.banco,
                    item.carteira,
                    item.tipo,
                    item.status,
                    item.funcionario,
                    item.erro,
                    item.num_instancia,
                    item.qtde_instancia,
                    item.origem_processamento,
                    item.alias_processamento,
                    item.banco_fisico_processamento,
                ].join(" ")
            );

            if (searchable.indexOf(search) === -1) {
                return false;
            }
        }

        return true;
    }

    function localMapIncrement(map, key, amount) {
        map.set(key, Number(map.get(key) || 0) + Number(amount || 0));
    }

    function buildLocalDashboardData() {
        const filteredRecords = state.baseRecords.filter(
            recordMatchesCurrentFilters
        );

        let totalLines = 0;
        let totalTime = 0;
        let validTimeCount = 0;
        let finalized = 0;
        let processing = 0;
        let errors = 0;

        const statuses = new Map();
        const errorReasons = new Map();
        const bankData = new Map();
        const employeeData = new Map();
        const dailyData = new Map();
        const processingWallets = new Set();

        filteredRecords.forEach(function (item) {
            const lines = Number(item.quantidade_linhas || 0);
            const time = Math.max(0, Number(item.tempo_segundos || 0));
            const status = String(item.status || "Desconhecido");
            const normalizedStatus = normalizeText(status);
            const bank = String(item.banco || "Sem banco");
            const employee = String(item.funcionario || "Sem funcionário");
            const date = String(item.data || "").slice(0, 10);

            totalLines += lines;

            if (item.tempo_informado) {
                totalTime += time;
                validTimeCount += 1;
            }

            localMapIncrement(statuses, status, 1);

            if (normalizedStatus === "finalizado") {
                finalized += 1;
            } else if (normalizedStatus === "processando") {
                processing += 1;
                processingWallets.add(
                    [
                        item.alias_processamento || "processamento",
                        item.id_empresa || 0,
                        normalizeText(bank),
                        normalizeText(item.carteira || "Sem carteira"),
                    ].join("::")
                );
            } else if (normalizedStatus.indexOf("erro") === 0) {
                errors += 1;
                let reason = String(item.erro || "")
                    .replace(/\s+/g, " ")
                    .trim();

                if (!reason) {
                    reason = status;
                }

                if (reason.length > 90) {
                    reason = reason.slice(0, 87) + "...";
                }

                localMapIncrement(errorReasons, reason, 1);
            }

            if (!bankData.has(bank)) {
                bankData.set(bank, {
                    arquivos: 0,
                    linhas: 0,
                });
            }

            bankData.get(bank).arquivos += 1;
            bankData.get(bank).linhas += lines;

            if (!employeeData.has(employee)) {
                employeeData.set(employee, {
                    arquivos: 0,
                    linhas: 0,
                    tempo_total: 0,
                    quantidade_tempos: 0,
                });
            }

            const employeeItem = employeeData.get(employee);
            employeeItem.arquivos += 1;
            employeeItem.linhas += lines;

            if (item.tempo_informado) {
                employeeItem.tempo_total += time;
                employeeItem.quantidade_tempos += 1;
            }

            if (date) {
                if (!dailyData.has(date)) {
                    dailyData.set(date, {
                        arquivos: 0,
                        linhas: 0,
                        tempo_total: 0,
                        quantidade_tempos: 0,
                    });
                }

                const dayItem = dailyData.get(date);
                dayItem.arquivos += 1;
                dayItem.linhas += lines;

                if (item.tempo_informado) {
                    dayItem.tempo_total += time;
                    dayItem.quantidade_tempos += 1;
                }
            }
        });

        const totalFiles = filteredRecords.length;
        const averageTime = validTimeCount
            ? totalTime / validTimeCount
            : 0;
        const successRate = totalFiles
            ? (finalized / totalFiles) * 100
            : 0;
        const speed = totalTime > 0
            ? totalLines / (totalTime / 60)
            : 0;

        const temporalSeries = Array.from(dailyData.entries())
            .sort(function (a, b) {
                return a[0].localeCompare(b[0]);
            })
            .map(function (entry) {
                const item = entry[1];

                return {
                    data: entry[0],
                    arquivos: item.arquivos,
                    linhas: item.linhas,
                    tempo_medio_segundos: item.quantidade_tempos
                        ? item.tempo_total / item.quantidade_tempos
                        : 0,
                };
            });

        const statusItems = Array.from(statuses.entries())
            .sort(function (a, b) {
                return b[1] - a[1];
            })
            .map(function (entry) {
                return {
                    status: entry[0],
                    quantidade: entry[1],
                    percentual: totalFiles
                        ? (entry[1] / totalFiles) * 100
                        : 0,
                };
            });

        const errorItems = Array.from(errorReasons.entries())
            .sort(function (a, b) {
                return b[1] - a[1];
            })
            .slice(0, 8)
            .map(function (entry) {
                return {
                    motivo: entry[0],
                    quantidade: entry[1],
                };
            });

        const bankItems = Array.from(bankData.entries())
            .map(function (entry) {
                return {
                    nome: entry[0],
                    arquivos: entry[1].arquivos,
                    linhas: entry[1].linhas,
                };
            })
            .sort(function (a, b) {
                return b.linhas - a.linhas || b.arquivos - a.arquivos;
            })
            .slice(0, 8);

        const employeeItems = Array.from(employeeData.entries())
            .map(function (entry) {
                const item = entry[1];

                return {
                    nome: entry[0],
                    arquivos: item.arquivos,
                    linhas: item.linhas,
                    tempo_medio_segundos: item.quantidade_tempos
                        ? item.tempo_total / item.quantidade_tempos
                        : 0,
                };
            })
            .sort(function (a, b) {
                return b.arquivos - a.arquivos || b.linhas - a.linhas;
            })
            .slice(0, 10);

        const biggestBank = bankItems.length ? bankItems[0] : null;
        const activeProcessingCount = processingWallets.size;

        const insights = [
            {
                tom: "primary",
                icone: "fa-file-text-o",
                titulo: "Processamentos",
                valor: formatNumber(totalFiles),
                detalhe: "Quantidade de arquivos no período filtrado.",
            },
            {
                tom: "success",
                icone: "fa-check-circle",
                titulo: "Taxa de sucesso",
                valor: formatNumber(successRate, 1) + "%",
                detalhe:
                    formatNumber(finalized) +
                    " processamentos finalizados.",
            },
            {
                tom: errors ? "danger" : "success",
                icone: errors
                    ? "fa-exclamation-triangle"
                    : "fa-shield",
                titulo: "Ocorrências com erro",
                valor: formatNumber(errors),
                detalhe: errors
                    ? "Processamentos que exigem análise operacional."
                    : "Nenhum erro identificado.",
                clicavel: true,
                filtro_campo: "grupo_status",
                filtro_valor: "erro",
            },
            {
                tom: "warning",
                icone: "fa-spinner",
                titulo: "Em processamento",
                valor: formatNumber(activeProcessingCount),
                detalhe:
                    "Carteiras/empresas com processamento ativo. " +
                    "As instâncias do mesmo conjunto contam uma única vez.",
                clicavel: true,
                filtro_campo: "grupo_status",
                filtro_valor: "processando",
            },
            {
                tom: "warning",
                icone: "fa-database",
                titulo: "Maior volume",
                valor: biggestBank ? biggestBank.nome : "Sem dados",
                detalhe: biggestBank
                    ? formatNumber(biggestBank.linhas) +
                      " linhas processadas."
                    : "Nenhum banco disponível.",
                clicavel: Boolean(biggestBank),
                filtro_campo: "banco",
                filtro_valor: biggestBank ? biggestBank.nome : "",
            },
        ];

        return {
            erro: false,
            opcoes_filtros:
                (state.baseResponse && state.baseResponse.opcoes_filtros) || {},
            metricas: {
                arquivos: totalFiles,
                linhas: totalLines,
                tempo_total_segundos: totalTime,
                tempo_total_formatado: formatSeconds(totalTime),
                tempo_medio_segundos: averageTime,
                tempo_medio_formatado: formatSeconds(averageTime),
                taxa_sucesso: successRate,
                erros: errors,
                processando: processing,
                carteiras_em_processamento: activeProcessingCount,
                finalizados: finalized,
                velocidade_linhas_minuto: speed,
            },
            serie_temporal: temporalSeries,
            status: statusItems,
            motivos_erro: errorItems,
            ranking_bancos: bankItems,
            ranking_funcionarios: employeeItems,
            insights: insights,
            registros: filteredRecords.slice(0, 500),
            registros_exibidos: Math.min(filteredRecords.length, 500),
            total_registros: filteredRecords.length,
            atualizado_em:
                (state.baseResponse && state.baseResponse.atualizado_em) || "—",
        };
    }

    function applyLocalDashboardFilters() {
        if (!state.baseResponse) {
            return;
        }

        updateDashboardFromFilteredData(
            buildLocalDashboardData()
        );
    }

    function updateDashboardFromFilteredData(data) {
        state.lastFilteredData = data;
        updateFilterOptions(data);
        updateMetrics(data.metricas || {});
        renderFilteredCharts(data);
        renderInsights(data.insights || []);

        state.registros = prepareRecords(data.registros || []);
        state.paginaAtual = 1;
        state.tableServerInfo = {
            registrosExibidos: Number(data.registros_exibidos || 0),
            totalRegistros: Number(data.total_registros || 0),
        };

        applyTableOperations();
        elements.updated.textContent = data.atualizado_em || "—";
    }

    async function loadDashboard(options) {
        options = options || {};
        const notify = Boolean(options.notify);

        if (state.requestController) {
            state.requestController.abort();
        }

        state.requestController = new AbortController();
        const signal = state.requestController.signal;

        showLoading(
            true,
            "Carregando processamento",
            "Consultando os dados e atualizando os indicadores."
        );

        try {
            /*
             * O servidor é consultado somente ao abrir/recarregar
             * a página ou ao clicar no botão Atualizar dados.
             */
            const data = await fetchDashboardData(
                new URLSearchParams(),
                signal
            );

            state.baseResponse = data;
            state.baseRecords = prepareRecords(
                data.registros_base || data.registros || []
            );

            updateFilterOptions(data);
            renderFixedCharts(data);
            applyLocalDashboardFilters();

            if (notify) {
                showToast("Dashboard atualizado com sucesso.", false);
            }
        } catch (error) {
            if (error.name === "AbortError") {
                return;
            }

            console.error(error);
            showToast(
                error.message || "Erro ao atualizar o dashboard.",
                true
            );
        } finally {
            showLoading(false);
        }
    }

    function scheduleDashboardLoad(delay) {
        window.clearTimeout(state.filterTimer);

        state.filterTimer = window.setTimeout(function () {
            applyLocalDashboardFilters();
        }, delay == null ? 220 : delay);
    }

    function clearFilters() {
        elements.banco.value = "";
        elements.carteira.value = "";
        elements.tipo.value = "";
        elements.status.value = "";
        elements.funcionario.value = "";
        elements.busca.value = "";
        state.insightStatusGroup = "";
        setTodayPeriod();

        applyLocalDashboardFilters();
    }

    function clearColumnFilters() {
        state.filtrosColunas = {};
        state.paginaAtual = 1;
        renderTableHead();
        applyTableOperations();
    }

    function resetColumns() {
        state.ordemColunas = DEFAULT_COLUMNS.slice();
        state.largurasColunas = {};
        state.filtrosColunas = {};
        state.ordenacao = {
            chave: "data",
            direcao: "desc",
        };
        state.paginaAtual = 1;

        saveColumnPreferences();
        renderTableHead();
        applyTableOperations();
        showToast("Colunas restauradas para o padrão.", false);
    }

    function toggleTableExpanded(force) {
        const shouldExpand =
            typeof force === "boolean"
                ? force
                : !elements.tableCard.classList.contains("is-expanded");

        elements.tableCard.classList.toggle("is-expanded", shouldExpand);
        document.body.classList.toggle(
            "processing-table-expanded",
            shouldExpand
        );
        elements.expandTable.setAttribute(
            "aria-expanded",
            String(shouldExpand)
        );
        elements.expandTable.setAttribute(
            "title",
            shouldExpand ? "Fechar visão expandida" : "Expandir tabela"
        );
        elements.expandTableIcon.className =
            "fa " +
            (shouldExpand ? "fa-compress" : "fa-expand");
        elements.expandTableText.textContent = shouldExpand
            ? "Fechar expansão"
            : "Expandir tabela";

        window.setTimeout(function () {
            Object.keys(state.charts).forEach(function (name) {
                if (state.charts[name]) {
                    state.charts[name].resize();
                }
            });
        }, 220);
    }

    function getInitialTheme() {
        const saved = window.localStorage.getItem(STORAGE_KEYS.theme);

        if (saved === "dark" || saved === "light") {
            return saved;
        }

        const htmlTheme = document.documentElement.getAttribute("data-theme");

        if (htmlTheme === "dark" || htmlTheme === "light") {
            return htmlTheme;
        }

        return window.matchMedia &&
            window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light";
    }

    function applyTheme(theme, rerender) {
        state.theme = theme === "dark" ? "dark" : "light";

        document.documentElement.setAttribute("data-theme", state.theme);
        document.body.setAttribute("data-theme", state.theme);
        window.localStorage.setItem(STORAGE_KEYS.theme, state.theme);

        if (elements.themeIcon && elements.themeText) {
            const dark = state.theme === "dark";
            elements.themeIcon.className = dark
                ? "fa fa-sun-o"
                : "fa fa-moon-o";
            elements.themeText.textContent = dark
                ? "Modo claro"
                : "Modo escuro";
            elements.themeButton.setAttribute(
                "title",
                dark ? "Ativar modo claro" : "Ativar modo escuro"
            );
        }

        if (rerender !== false) {
            rerenderChartsForTheme();
        }
    }

    function bindEvents() {
        elements.form.addEventListener("submit", function (event) {
            event.preventDefault();

            applyLocalDashboardFilters();
        });

        [
            elements.dataInicio,
            elements.dataFim,
            elements.banco,
            elements.carteira,
            elements.tipo,
            elements.status,
            elements.funcionario,
        ].forEach(function (field) {
            field.addEventListener("change", function () {
                if (field === elements.status) {
                    state.insightStatusGroup = "";
                }

                scheduleDashboardLoad(120);
            });
        });

        elements.busca.addEventListener("input", function () {
            scheduleDashboardLoad(420);
        });

        elements.refresh.addEventListener("click", function () {
            loadDashboard({
                notify: true,
            });
        });

        elements.clear.addEventListener("click", clearFilters);
        elements.clearColumnFilters.addEventListener(
            "click",
            clearColumnFilters
        );
        elements.resetColumns.addEventListener("click", resetColumns);
        elements.expandTable.addEventListener("click", function () {
            toggleTableExpanded();
        });

        elements.prevPage.addEventListener("click", function () {
            if (state.paginaAtual > 1) {
                state.paginaAtual -= 1;
                renderTable();
                elements.tableWrap.scrollTop = 0;
            }
        });

        elements.nextPage.addEventListener("click", function () {
            const totalPages = Math.max(
                1,
                Math.ceil(
                    state.registrosTabela.length / state.porPagina
                )
            );

            if (state.paginaAtual < totalPages) {
                state.paginaAtual += 1;
                renderTable();
                elements.tableWrap.scrollTop = 0;
            }
        });

        byId("processingDetailClose").addEventListener(
            "click",
            closeDetails
        );

        elements.detailDialog.addEventListener("click", function (event) {
            const rect = elements.detailDialog.getBoundingClientRect();
            const outside =
                event.clientX < rect.left ||
                event.clientX > rect.right ||
                event.clientY < rect.top ||
                event.clientY > rect.bottom;

            if (outside) {
                closeDetails();
            }
        });

        elements.themeButton.addEventListener("click", function () {
            applyTheme(state.theme === "dark" ? "light" : "dark");
        });

        document.addEventListener("keydown", function (event) {
            if (
                event.key === "Escape" &&
                elements.tableCard.classList.contains("is-expanded") &&
                !elements.detailDialog.open
            ) {
                toggleTableExpanded(false);
            }
        });

        window.addEventListener("pageshow", function (event) {
            /*
             * Em uma abertura normal ou após F5/refresh, o carregamento
             * já é iniciado por initialize() e permanece visível até a
             * consulta terminar. Quando a página volta pelo cache do
             * navegador (bfcache), refazemos a consulta e mostramos o
             * mesmo carregamento novamente.
             */
            if (event.persisted) {
                state.loadingCount = 0;

                loadDashboard({
                    notify: false,
                });
            }
        });
    }

    function configureChartDefaults() {
        if (!window.Chart) {
            showToast(
                "A biblioteca de gráficos não foi carregada.",
                true
            );
            return false;
        }

        Chart.defaults.font.family = "Inter, Arial, sans-serif";
        Chart.defaults.font.size = 11;
        Chart.defaults.animation.duration = 450;

        return true;
    }

    function initialize() {
        cacheElements();
        applyTheme(getInitialTheme(), false);
        setTodayPeriod();
        renderTableHead();
        bindEvents();

        if (configureChartDefaults()) {
            loadDashboard({
                notify: false,
            });
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize);
    } else {
        initialize();
    }
})();
