(function () {
    "use strict";

    const COLORS = {
        navy: "#001D39",
        blue: "#0A4174",
        steel: "#49769F",
        teal: "#4E8EA2",
        aqua: "#6EA2B3",
        sky: "#7BBDE8",
        pale: "#BDD8E9",
        success: "#24866A",
        warning: "#C58B22",
        danger: "#C95B62",
    };

    const METRICS = {
        valor_base: { label: "Valor Base", kind: "currency", icon: "fa-database", color: COLORS.navy },
        quantidade_base: { label: "Quantidade Base", kind: "number", icon: "fa-list-ol", color: COLORS.steel },
        produzido: { label: "Total Produzido", kind: "currency", icon: "fa-industry", color: COLORS.blue },
        pago: { label: "Total Pago", kind: "currency", icon: "fa-money", color: COLORS.teal },
        meta: { label: "Meta", kind: "currency", icon: "fa-bullseye", color: COLORS.sky },
        ho: { label: "Total HO", kind: "currency", icon: "fa-line-chart", color: COLORS.steel },
        entrega: { label: "Entrega Amigável", kind: "currency", icon: "fa-handshake-o", color: COLORS.aqua },
        quebra: { label: "Quebra", kind: "currency", icon: "fa-exchange", color: COLORS.warning },
        producao_base_pct: { label: "% Produção / Base", kind: "percent", icon: "fa-percent", color: COLORS.steel },
        eficiencia: { label: "% Eficiência", kind: "percent", icon: "fa-bolt", color: COLORS.teal },
        quebra_pct: { label: "% Quebra", kind: "percent", icon: "fa-chain-broken", color: COLORS.warning },
        atingimento_pago: { label: "% Pago / Meta", kind: "percent", icon: "fa-check-circle-o", color: COLORS.aqua },
        icm: { label: "% ICM (HO / Meta)", kind: "percent", icon: "fa-tachometer", color: COLORS.blue },
    };

    const state = {
        raw: null,
        records: [],
        metas: [],
        filteredRecords: [],
        filteredMetas: [],
        charts: {},
        metricFocus: "pago",
        matrixMetric: "pago",
        dailyMetric: "produzido",
        expandedCompanies: new Set(),
        allExpanded: false,
        loading: false,
        loadingProgress: 0,
        loadingProgressTimer: null,
        loadingHideTimer: null,
        defaultDateStart: "",
        defaultDateEnd: "",
        filters: {
            dateStart: "",
            dateEnd: "",
            month: "",
            company: "",
            wallet: "",
            digital: "",
            walletType: "",
            productionType: "",
            superintendent: "",
            coordinator: "",
        },
        analytic: {
            page: 1,
            pageSize: 25,
            search: "",
            sortKey: "data",
            sortDirection: "desc",
        },
    };

    const el = {};
    const byId = function (id) { return document.getElementById(id); };

    function cacheElements() {
        el.form = byId("metasFilters");
        el.url = el.form ? el.form.dataset.url : "";
        el.refresh = byId("metasRefreshButton");
        el.clear = byId("metasClearButton");
        el.updated = byId("metasUpdatedAt");
        el.dataSource = byId("metasDataSource");
        el.loading = byId("metasLoading");
        el.loadingTitle = byId("metasLoadingTitle");
        el.loadingDescription = byId("metasLoadingDescription");
        el.loadingProgressText = byId("metasLoadingProgressText");
        el.loadingProgressBar = byId("metasLoadingProgressBar");
        el.toast = byId("metasToast");

        el.dateStart = byId("metasDateStart");
        el.dateEnd = byId("metasDateEnd");
        el.monthQuick = byId("metasMonthQuick");
        el.company = byId("metasCompany");
        el.wallet = byId("metasWallet");
        el.digital = byId("metasDigital");
        el.walletType = byId("metasWalletType");
        el.productionType = byId("metasProductionType");
        el.superintendent = byId("metasSuperintendent");
        el.coordinator = byId("metasCoordinator");
        el.activeFilters = byId("metasActiveFilters");

        el.kpis = byId("metasKpiGrid");
        el.metricSwitch = byId("metasMetricSwitch");
        el.focusMetricLabel = byId("metasFocusMetricLabel");

        el.missingMetaCount = byId("metasMissingMetaCount");
        el.missingMetaSummary = byId("metasMissingMetaSummary");
        el.missingMetaBody = byId("metasMissingMetaBody");

        el.dailyMonth = byId("metasDailyMonth");
        el.dailyIndicator = byId("metasDailyIndicator");
        el.dailyTitle = byId("metasDailyTitle");
        el.dailyChartTitle = byId("metasDailyChartTitle");
        el.dailyBody = byId("metasDailyBody");

        el.companyRanking = byId("metasCompanyRanking");
        el.walletRanking = byId("metasWalletRanking");
        el.superintendentRanking = byId("metasSuperintendentRanking");
        el.coordinatorRanking = byId("metasCoordinatorRanking");

        el.matrixIndicator = byId("metasMatrixIndicator");
        el.expandMatrix = byId("metasExpandMatrix");
        el.matrixHead = byId("metasMatrixHead");
        el.matrixBody = byId("metasMatrixBody");
        el.matrixFoot = byId("metasMatrixFoot");

        el.analysisStrip = byId("metasAnalysisStrip");
        el.analyticSearch = byId("metasAnalyticSearch");
        el.analyticPageSize = byId("metasAnalyticPageSize");
        el.analyticBody = byId("metasAnalyticBody");
        el.analyticCount = byId("metasAnalyticCount");
        el.analyticPagination = byId("metasAnalyticPagination");

        el.themeButton = byId("metasThemeButton");
        el.themeIcon = byId("metasThemeIcon");
        el.themeText = byId("metasThemeText");
    }

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function normalize(value) {
        return String(value == null ? "" : value)
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/\s+/g, " ")
            .trim()
            .toUpperCase();
    }

    function num(value) {
        const result = Number(value || 0);
        return Number.isFinite(result) ? result : 0;
    }

    function currency(value) {
        return new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(num(value));
    }

    function axisCurrency(value) {
        return "R$ " + new Intl.NumberFormat("pt-BR", {
            maximumFractionDigits: 0,
        }).format(num(value));
    }

    function numberFormat(value, decimals) {
        return new Intl.NumberFormat("pt-BR", {
            minimumFractionDigits: decimals || 0,
            maximumFractionDigits: decimals || 0,
        }).format(num(value));
    }

    function percent(value) {
        return numberFormat(value, 2) + "%";
    }

    function formatMetric(value, metric) {
        const definition = METRICS[metric] || METRICS.pago;
        if (definition.kind === "percent") return percent(value);
        if (definition.kind === "number") return numberFormat(value, 0);
        return currency(value);
    }

    function parseIsoDate(value) {
        if (!value) return null;
        const parts = value.split("-").map(Number);
        if (parts.length !== 3) return null;
        return new Date(parts[0], parts[1] - 1, parts[2]);
    }

    function monthFromDate(value) {
        return value ? value.slice(0, 7) : "";
    }

    function monthLabel(month) {
        if (!month) return "";
        const found = state.raw && state.raw.opcoes && state.raw.opcoes.meses
            ? state.raw.opcoes.meses.find(function (item) { return item.chave === month; })
            : null;
        return found ? found.rotulo : month;
    }

    function lastDayOfMonth(month) {
        const parts = month.split("-").map(Number);
        const date = new Date(parts[0], parts[1], 0);
        return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
    }

    function setSelectOptions(select, values, placeholder, selected) {
        if (!select) return;
        let html = placeholder != null
            ? '<option value="">' + escapeHtml(placeholder) + "</option>"
            : "";

        values.forEach(function (item) {
            const value = typeof item === "object" ? item.chave : item;
            const label = typeof item === "object" ? item.rotulo : item;
            html += '<option value="' + escapeHtml(value) + '">' + escapeHtml(label) + "</option>";
        });

        select.innerHTML = html;
        if (Array.from(select.options).some(function (option) { return option.value === String(selected || ""); })) {
            select.value = selected || "";
        }
    }

    function updateLoadingProgress(value) {
        const progress = Math.max(0, Math.min(100, Math.round(num(value))));
        state.loadingProgress = progress;
        if (el.loadingProgressText) el.loadingProgressText.textContent = progress + "%";
        if (el.loadingProgressBar) {
            el.loadingProgressBar.style.width = progress + "%";
            const parent = el.loadingProgressBar.closest('[role="progressbar"]');
            if (parent) parent.setAttribute("aria-valuenow", String(progress));
        }
    }

    function startLoadingProgress() {
        if (state.loadingProgressTimer) window.clearInterval(state.loadingProgressTimer);
        if (state.loadingHideTimer) window.clearTimeout(state.loadingHideTimer);
        updateLoadingProgress(5);
        state.loadingProgressTimer = window.setInterval(function () {
            if (!state.loading) return;
            let next = state.loadingProgress;
            if (next < 35) next += 4;
            else if (next < 65) next += 3;
            else if (next < 83) next += 2;
            else if (next < 93) next += 1;
            updateLoadingProgress(Math.min(next, 93));
        }, 170);
    }

    function showLoading(show, source) {
        state.loading = show;
        if (!el.loading) return;

        if (show) {
            const refresh = source === "refresh";
            if (el.loadingTitle) {
                el.loadingTitle.textContent = refresh
                    ? "Atualizando Dashboard Executivo"
                    : "Carregando Dashboard Executivo";
            }
            if (el.loadingDescription) {
                el.loadingDescription.textContent = refresh
                    ? "Consultando novamente os dados do Workspace..."
                    : "Consultando os dados do Workspace...";
            }
            if (el.refresh) el.refresh.disabled = true;
            el.loading.classList.add("is-visible");
            el.loading.setAttribute("aria-hidden", "false");
            startLoadingProgress();
            return;
        }

        if (state.loadingProgressTimer) {
            window.clearInterval(state.loadingProgressTimer);
            state.loadingProgressTimer = null;
        }
        updateLoadingProgress(100);
        if (el.refresh) el.refresh.disabled = false;
        state.loadingHideTimer = window.setTimeout(function () {
            el.loading.classList.remove("is-visible");
            el.loading.setAttribute("aria-hidden", "true");
            updateLoadingProgress(0);
        }, 180);
    }

    function toast(message) {
        if (!el.toast) return;
        el.toast.textContent = message;
        el.toast.classList.add("is-visible");
        window.clearTimeout(el.toast._timer);
        el.toast._timer = window.setTimeout(function () {
            el.toast.classList.remove("is-visible");
        }, 3200);
    }

    async function fetchData() {
        const separator = el.url.includes("?") ? "&" : "?";
        const url = el.url + separator + "dados=1&_=" + Date.now();
        const response = await fetch(url, {
            headers: { "X-Requested-With": "XMLHttpRequest" },
            credentials: "same-origin",
            cache: "no-store",
        });
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
            throw new Error("A view dashboard_metas não retornou JSON.");
        }
        const data = await response.json();
        if (!response.ok || data.erro) {
            throw new Error((data.mensagem || "Erro ao carregar os dados.") + (data.detalhe ? " " + data.detalhe : ""));
        }
        return data;
    }

    function currentThemeColors() {
        const dark = document.documentElement.getAttribute("data-theme") === "dark";
        return {
            text: dark ? "#DDECF4" : "#38536C",
            muted: dark ? "#9BB6C8" : "#71869A",
            grid: dark ? "rgba(189,216,233,.12)" : "rgba(73,118,159,.13)",
            tooltipBg: dark ? COLORS.navy : "#FFFFFF",
            tooltipText: dark ? "#FFFFFF" : COLORS.navy,
        };
    }

    function destroyChart(key) {
        if (state.charts[key]) {
            state.charts[key].destroy();
            delete state.charts[key];
        }
    }

    function tooltipLabel(context, metric) {
        const value = context.parsed && typeof context.parsed.y === "number"
            ? context.parsed.y
            : context.parsed && typeof context.parsed.x === "number"
                ? context.parsed.x
                : context.raw;
        return (context.dataset.label ? context.dataset.label + ": " : "") + formatMetric(value, metric);
    }

    function chartBaseOptions(extra) {
        const theme = currentThemeColors();
        const base = {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "nearest", intersect: true },
            animation: { duration: 420 },
            plugins: {
                legend: {
                    position: "bottom",
                    labels: {
                        color: theme.text,
                        boxWidth: 11,
                        boxHeight: 11,
                        usePointStyle: true,
                        pointStyle: "rectRounded",
                        font: { size: 9, weight: 700 },
                        padding: 14,
                    },
                },
                tooltip: {
                    backgroundColor: theme.tooltipBg,
                    titleColor: theme.tooltipText,
                    bodyColor: theme.tooltipText,
                    borderColor: COLORS.sky,
                    borderWidth: 1,
                    padding: 10,
                    displayColors: true,
                    callbacks: {},
                },
            },
            scales: {
                x: {
                    ticks: { color: theme.muted, font: { size: 8, weight: 600 } },
                    grid: { display: false },
                    border: { color: theme.grid },
                },
                y: {
                    beginAtZero: true,
                    ticks: { color: theme.muted, font: { size: 8, weight: 600 } },
                    grid: { color: theme.grid },
                    border: { display: false },
                },
            },
        };
        return Object.assign(base, extra || {});
    }

    function syncFiltersFromControls() {
        state.filters.dateStart = el.dateStart.value || "";
        state.filters.dateEnd = el.dateEnd.value || "";
        state.filters.month = el.monthQuick.value || "";
        state.filters.company = el.company.value || "";
        state.filters.wallet = el.wallet.value || "";
        state.filters.digital = el.digital.value || "";
        state.filters.walletType = el.walletType.value || "";
        state.filters.productionType = el.productionType.value || "";
        state.filters.superintendent = el.superintendent.value || "";
        state.filters.coordinator = el.coordinator.value || "";
    }

    function setControlValue(key, value) {
        const map = {
            dateStart: el.dateStart,
            dateEnd: el.dateEnd,
            month: el.monthQuick,
            company: el.company,
            wallet: el.wallet,
            digital: el.digital,
            walletType: el.walletType,
            productionType: el.productionType,
            superintendent: el.superintendent,
            coordinator: el.coordinator,
        };
        const target = map[key];
        if (target) target.value = value || "";
        state.filters[key] = value || "";
    }

    function fieldEquals(value, expected) {
        return !expected || normalize(value) === normalize(expected);
    }

    function recordMatches(record) {
        const f = state.filters;
        if (f.dateStart && record.data < f.dateStart) return false;
        if (f.dateEnd && record.data > f.dateEnd) return false;
        if (!fieldEquals(record.empresa, f.company)) return false;
        if (!fieldEquals(record.carteira, f.wallet)) return false;
        if (!fieldEquals(record.digital, f.digital)) return false;
        if (!fieldEquals(record.tipo_carteira, f.walletType)) return false;
        if (!fieldEquals(record.producao_carteira, f.productionType)) return false;
        if (!fieldEquals(record.superintendente, f.superintendent)) return false;
        if (!fieldEquals(record.coordenador, f.coordinator)) return false;
        return true;
    }

    function metaMatches(meta) {
        const f = state.filters;
        const startMonth = monthFromDate(f.dateStart);
        const endMonth = monthFromDate(f.dateEnd);
        if (startMonth && meta.mes < startMonth) return false;
        if (endMonth && meta.mes > endMonth) return false;
        if (!fieldEquals(meta.empresa, f.company)) return false;
        if (!fieldEquals(meta.carteira, f.wallet)) return false;
        if (!fieldEquals(meta.digital, f.digital)) return false;
        if (!fieldEquals(meta.tipo_carteira, f.walletType)) return false;
        if (!fieldEquals(meta.producao_carteira, f.productionType)) return false;
        if (!fieldEquals(meta.superintendente, f.superintendent)) return false;
        if (!fieldEquals(meta.coordenador, f.coordinator)) return false;
        return true;
    }

    function aggregate(records, metas) {
        const result = {
            valor_base: 0,
            quantidade_base: 0,
            produzido: 0,
            pago: 0,
            pago_elegivel: 0,
            entrega: 0,
            ho: 0,
            meta: 0,
            quebra: 0,
            producao_base_pct: 0,
            eficiencia: 0,
            quebra_pct: 0,
            atingimento_pago: 0,
            icm: 0,
            empresas: 0,
            carteiras: 0,
            carteiras_ia: 0,
            pago_ia: 0,
        };

        const companies = new Set();
        const wallets = new Set();
        const iaWallets = new Set();

        records.forEach(function (item) {
            result.valor_base += num(item.valor_base);
            result.quantidade_base += num(item.quantidade_base);
            result.produzido += num(item.produzido);
            result.pago += num(item.pago);
            result.pago_elegivel += num(item.pago_elegivel);
            result.entrega += num(item.entrega);
            result.ho += num(item.ho);
            if (item.empresa) companies.add(item.empresa);
            if (item.carteira) wallets.add(item.carteira);
            if (item.ia) {
                iaWallets.add(item.carteira);
                result.pago_ia += num(item.pago);
            }
        });

        metas.forEach(function (item) {
            result.meta += num(item.meta);
            if (item.empresa) companies.add(item.empresa);
            if (item.carteira) wallets.add(item.carteira);
        });

        result.quebra = result.produzido - result.pago_elegivel;
        result.producao_base_pct = result.valor_base ? (result.produzido / result.valor_base) * 100 : 0;
        result.eficiencia = result.produzido ? (result.pago_elegivel / result.produzido) * 100 : 0;
        result.quebra_pct = result.produzido ? (result.quebra / result.produzido) * 100 : 0;
        result.atingimento_pago = result.meta ? (result.pago_elegivel / result.meta) * 100 : 0;
        result.icm = result.meta ? (result.ho / result.meta) * 100 : 0;
        result.empresas = companies.size;
        result.carteiras = wallets.size;
        result.carteiras_ia = iaWallets.size;
        return result;
    }

    function metricValue(metric, records, metas) {
        return aggregate(records, metas)[metric] || 0;
    }

    function filterByField(items, field, value) {
        return items.filter(function (item) { return fieldEquals(item[field], value); });
    }

    function groupByDimension(field, records, metas) {
        const names = new Set();
        records.forEach(function (item) { if (item[field]) names.add(item[field]); });
        metas.forEach(function (item) { if (item[field]) names.add(item[field]); });

        return Array.from(names).map(function (name) {
            const rec = filterByField(records, field, name);
            const met = filterByField(metas, field, name);
            return Object.assign({ nome: name }, aggregate(rec, met));
        });
    }

    function monthsInScope() {
        const set = new Set();
        state.filteredRecords.forEach(function (item) { set.add(item.mes); });
        state.filteredMetas.forEach(function (item) { set.add(item.mes); });
        return Array.from(set).sort();
    }

    function monthlySeries() {
        return monthsInScope().map(function (month) {
            const records = state.filteredRecords.filter(function (item) { return item.mes === month; });
            const metas = state.filteredMetas.filter(function (item) { return item.mes === month; });
            return Object.assign({ mes: month, rotulo: monthLabel(month) }, aggregate(records, metas));
        });
    }

    function metaMap() {
        const map = new Map();
        state.filteredMetas.forEach(function (item) {
            map.set(normalize(item.carteira) + "|" + item.mes, num(item.meta));
        });
        return map;
    }

    function missingMetaRows() {
        const map = new Map();
        const metas = metaMap();
        state.filteredRecords.forEach(function (record) {
            if (record.ia) return;
            const key = normalize(record.carteira) + "|" + record.mes;
            if (metas.has(key) && metas.get(key) > 0) return;
            if (!map.has(key)) {
                map.set(key, {
                    mes: record.mes,
                    competencia: monthLabel(record.mes),
                    empresa: record.empresa,
                    carteira: record.carteira,
                    superintendente: record.superintendente,
                    coordenador: record.coordenador,
                });
            }
        });
        return Array.from(map.values()).sort(function (a, b) {
            return a.mes.localeCompare(b.mes) || normalize(a.empresa).localeCompare(normalize(b.empresa)) || normalize(a.carteira).localeCompare(normalize(b.carteira));
        });
    }

    function applyFilter(key, value, scrollTarget) {
        setControlValue(key, value);
        if (key === "month" && value) {
            setControlValue("dateStart", value + "-01");
            setControlValue("dateEnd", lastDayOfMonth(value));
        }
        state.analytic.page = 1;
        applyLocalFilters();
        if (scrollTarget) {
            const target = byId(scrollTarget);
            if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }

    function applyDateFilter(date) {
        setControlValue("dateStart", date);
        setControlValue("dateEnd", date);
        setControlValue("month", "");
        state.analytic.page = 1;
        applyLocalFilters();
    }

    function renderActiveFilters() {
        const items = [];
        const f = state.filters;
        if (f.month) {
            items.push(["month", "Mês", monthLabel(f.month)]);
        } else {
            if (f.dateStart && f.dateStart !== state.defaultDateStart) items.push(["dateStart", "De", f.dateStart.split("-").reverse().join("/")]);
            if (f.dateEnd && f.dateEnd !== state.defaultDateEnd) items.push(["dateEnd", "Até", f.dateEnd.split("-").reverse().join("/")]);
        }
        if (f.company) items.push(["company", "Empresa", f.company]);
        if (f.wallet) items.push(["wallet", "Carteira", f.wallet]);
        if (f.digital) items.push(["digital", "Digital", f.digital]);
        if (f.walletType) items.push(["walletType", "Tipo", f.walletType]);
        if (f.productionType) items.push(["productionType", "Produção", f.productionType]);
        if (f.superintendent) items.push(["superintendent", "Superint.", f.superintendent]);
        if (f.coordinator) items.push(["coordinator", "Coord.", f.coordinator]);

        if (!items.length) {
            el.activeFilters.innerHTML = '<span class="metas-active-filter-empty">Sem filtros adicionais. Exibindo todo o período carregado.</span>';
            return;
        }

        el.activeFilters.innerHTML = items.map(function (item) {
            return '<button type="button" class="metas-filter-chip" data-remove-filter="' + escapeHtml(item[0]) + '">' +
                escapeHtml(item[1]) + ': ' + escapeHtml(item[2]) + ' <i class="fa fa-times" aria-hidden="true"></i></button>';
        }).join("");
    }

    function renderKpis(metrics) {
        const cards = [
            ["valor_base", "Valor Base", metrics.valor_base, "Base elegível; IA não compõe"],
            ["quantidade_base", "Quantidade Base", metrics.quantidade_base, "Quantidade elegível; IA não compõe"],
            ["produzido", "Produzido", metrics.produzido, "Produção das carteiras não-IA"],
            ["pago", "Total Pago", metrics.pago, "Inclui pagamentos das carteiras IA"],
            ["quebra", "Quebra", metrics.quebra, "Produzido - Pago elegível"],
            ["eficiencia", "Eficiência", metrics.eficiencia, "Pago elegível / Produzido"],
            ["quebra_pct", "% Quebra", metrics.quebra_pct, "Quebra / Produzido"],
            ["producao_base_pct", "% Produção / Base", metrics.producao_base_pct, "Produzido / Valor Base"],
            ["meta", "Meta", metrics.meta, "Soma única por carteira e competência, sem IA"],
            ["atingimento_pago", "Pago / Meta", metrics.atingimento_pago, "Pagamento elegível sobre a meta"],
            ["ho", "Total HO", metrics.ho, "Somente carteiras não-IA"],
            ["icm", "ICM", metrics.icm, "HO / Meta"],
            ["entrega", "Entrega Amigável", metrics.entrega, "Somente carteiras não-IA"],
        ];

        el.kpis.innerHTML = cards.map(function (item) {
            const metric = item[0];
            const definition = METRICS[metric];
            const active = state.metricFocus === metric ? " is-active" : "";
            return '<article class="metas-kpi-card is-clickable' + active + '" data-kpi-metric="' + metric + '" style="--card-accent:' + definition.color + '">' +
                '<div class="metas-kpi-top"><span class="metas-kpi-label">' + escapeHtml(item[1]) + '</span>' +
                '<span class="metas-kpi-icon"><i class="fa ' + definition.icon + '" aria-hidden="true"></i></span></div>' +
                '<strong class="metas-kpi-value">' + escapeHtml(formatMetric(item[2], metric)) + '</strong>' +
                '<div class="metas-kpi-foot">' + escapeHtml(item[3]) + '</div>' +
                '</article>';
        }).join("");
    }

    function renderMonthlyChart() {
        destroyChart("monthly");
        const canvas = byId("metasMonthlyChart");
        if (!canvas || !window.Chart) return;
        const series = monthlySeries();
        const theme = currentThemeColors();
        const months = series.map(function (item) { return item.rotulo; });

        const options = chartBaseOptions({
            onClick: function (_event, elements) {
                if (!elements.length) return;
                const month = series[elements[0].index].mes;
                applyFilter("month", month, "metasExecutiveSection");
            },
        });
        options.scales.y.ticks.callback = axisCurrency;
        options.plugins.tooltip.callbacks.label = function (context) {
            return tooltipLabel(context, "pago");
        };
        options.plugins.legend.onClick = function (_event, legendItem) {
            const metricMap = {
                "Produzido": "produzido",
                "Pago": "pago",
                "Meta": "meta",
                "HO": "ho",
            };
            if (metricMap[legendItem.text]) {
                setMetricFocus(metricMap[legendItem.text]);
            }
        };

        state.charts.monthly = new Chart(canvas, {
            type: "bar",
            data: {
                labels: months,
                datasets: [
                    { label: "Produzido", data: series.map(function (i) { return i.produzido; }), backgroundColor: COLORS.blue, borderRadius: 6, maxBarThickness: 28 },
                    { label: "Pago", data: series.map(function (i) { return i.pago; }), backgroundColor: COLORS.teal, borderRadius: 6, maxBarThickness: 28 },
                    { label: "Meta", type: "line", data: series.map(function (i) { return i.meta; }), borderColor: COLORS.sky, backgroundColor: COLORS.sky, borderWidth: 3, pointRadius: 4, pointHoverRadius: 6, tension: .28 },
                    { label: "HO", type: "line", data: series.map(function (i) { return i.ho; }), borderColor: COLORS.steel, backgroundColor: COLORS.steel, borderWidth: 2, pointRadius: 3, pointHoverRadius: 5, tension: .28 },
                ],
            },
            options: options,
        });
    }

    function renderCompanyIcmChart() {
        destroyChart("companyIcm");
        const canvas = byId("metasCompanyIcmChart");
        if (!canvas || !window.Chart) return;
        const rows = groupByDimension("empresa", state.filteredRecords, state.filteredMetas)
            .filter(function (item) { return item.meta > 0; })
            .sort(function (a, b) { return b.icm - a.icm; })
            .slice(0, 14);

        const options = chartBaseOptions({
            indexAxis: "y",
            onClick: function (_event, elements) {
                if (!elements.length) return;
                applyFilter("company", rows[elements[0].index].nome, "metasExecutiveSection");
            },
        });
        options.scales.x.ticks.callback = function (value) { return value + "%"; };
        options.scales.y.ticks.autoSkip = false;
        options.plugins.legend.display = false;
        options.plugins.tooltip.callbacks.label = function (context) { return "ICM: " + percent(context.raw); };

        state.charts.companyIcm = new Chart(canvas, {
            type: "bar",
            data: {
                labels: rows.map(function (item) { return item.nome; }),
                datasets: [{
                    data: rows.map(function (item) { return item.icm; }),
                    backgroundColor: rows.map(function (item) {
                        return item.icm >= 100 ? COLORS.teal : item.icm >= 80 ? COLORS.sky : COLORS.steel;
                    }),
                    borderRadius: 7,
                    maxBarThickness: 23,
                }],
            },
            options: options,
        });
    }

    function renderMissingMeta() {
        const rows = missingMetaRows();
        const walletCount = new Set(rows.map(function (item) { return item.carteira; })).size;
        el.missingMetaCount.textContent = numberFormat(walletCount);
        el.missingMetaSummary.innerHTML = '<strong>' + numberFormat(walletCount) + '</strong>' +
            '<p>carteira(s) não-IA possuem produção no período sem meta válida em pelo menos uma competência. Total de ocorrências: <b>' + numberFormat(rows.length) + '</b>.</p>';

        el.missingMetaBody.innerHTML = rows.slice(0, 120).map(function (item) {
            return '<tr data-clickable="true" data-filter-wallet="' + escapeHtml(item.carteira) + '">' +
                '<td>' + escapeHtml(item.competencia) + '</td>' +
                '<td>' + escapeHtml(item.empresa) + '</td>' +
                '<td>' + escapeHtml(item.carteira) + '</td>' +
                '<td>' + escapeHtml(item.superintendente) + '</td>' +
                '<td>' + escapeHtml(item.coordenador) + '</td>' +
                '</tr>';
        }).join("") || '<tr><td colspan="5" class="metas-empty">Nenhuma carteira sem meta no recorte atual.</td></tr>';
    }

    function calendarForMonth(month) {
        return state.raw && state.raw.calendario ? state.raw.calendario[month] : null;
    }

    function dailyRows() {
        const available = monthsInScope();
        let month = el.dailyMonth.value;
        if (!available.includes(month)) month = available.length ? available[available.length - 1] : "";
        if (month && el.dailyMonth.value !== month) el.dailyMonth.value = month;
        if (!month) return { month: "", rows: [], meta: 0 };

        const records = state.filteredRecords.filter(function (item) { return item.mes === month; });
        const metas = state.filteredMetas.filter(function (item) { return item.mes === month; });
        const metaTotal = metas.reduce(function (sum, item) { return sum + num(item.meta); }, 0);
        const calendar = calendarForMonth(month) || { total_dias_uteis: 0, dias: [] };
        const dateMap = new Map();

        calendar.dias.forEach(function (item) {
            if (state.filters.dateStart && item.data < state.filters.dateStart) return;
            if (state.filters.dateEnd && item.data > state.filters.dateEnd) return;
            dateMap.set(item.data, { data: item.data, dia_util: item.dia_util });
        });
        records.forEach(function (item) {
            if (!dateMap.has(item.data)) dateMap.set(item.data, { data: item.data, dia_util: item.dia_util });
        });

        let acumulado = 0;
        let pagoAcumulado = 0;
        let pagoElegivelAcumulado = 0;
        let hoAcumulado = 0;
        let produzidoAcumulado = 0;
        const totalDias = calendar.total_dias_uteis || (records[0] ? records[0].total_dias_uteis : 0);

        const rows = Array.from(dateMap.values()).sort(function (a, b) { return a.data.localeCompare(b.data); }).map(function (day) {
            const dayRecords = records.filter(function (item) { return item.data === day.data; });
            const selectedValue = dayRecords.reduce(function (sum, item) { return sum + num(item[state.dailyMetric]); }, 0);
            const pagoDia = dayRecords.reduce(function (sum, item) { return sum + num(item.pago); }, 0);
            const pagoElegivelDia = dayRecords.reduce(function (sum, item) { return sum + num(item.pago_elegivel); }, 0);
            const hoDia = dayRecords.reduce(function (sum, item) { return sum + num(item.ho); }, 0);
            const produzidoDia = dayRecords.reduce(function (sum, item) { return sum + num(item.produzido); }, 0);

            acumulado += selectedValue;
            pagoAcumulado += pagoDia;
            pagoElegivelAcumulado += pagoElegivelDia;
            hoAcumulado += hoDia;
            produzidoAcumulado += produzidoDia;

            const expectedMeta = totalDias ? metaTotal * (day.dia_util / totalDias) : 0;
            const icm = metaTotal ? (hoAcumulado / metaTotal) * 100 : 0;
            const pagoMeta = metaTotal ? (pagoElegivelAcumulado / metaTotal) * 100 : 0;
            const eficiencia = produzidoAcumulado ? (pagoElegivelAcumulado / produzidoAcumulado) * 100 : 0;

            return {
                data: day.data,
                dia_util: day.dia_util,
                total_dias_uteis: totalDias,
                valor_diario: selectedValue,
                valor_acumulado: acumulado,
                meta_esperada: expectedMeta,
                pago_acumulado: pagoAcumulado,
                pago_elegivel_acumulado: pagoElegivelAcumulado,
                ho_acumulado: hoAcumulado,
                produzido_acumulado: produzidoAcumulado,
                icm: icm,
                atingimento_pago: pagoMeta,
                eficiencia: eficiencia,
            };
        });

        return { month: month, rows: rows, meta: metaTotal };
    }

    function renderDaily() {
        destroyChart("daily");
        const data = dailyRows();
        const definition = METRICS[state.dailyMetric] || METRICS.produzido;
        el.dailyTitle.textContent = data.month ? "Detalhamento • " + monthLabel(data.month) : "Detalhamento";
        el.dailyChartTitle.textContent = definition.label + " diário e acumulado";

        el.dailyBody.innerHTML = data.rows.map(function (item) {
            return '<tr data-clickable="true" data-filter-date="' + item.data + '">' +
                '<td>' + numberFormat(item.dia_util) + ' de ' + numberFormat(item.total_dias_uteis) + '</td>' +
                '<td>' + escapeHtml(item.data.split("-").reverse().join("/")) + '</td>' +
                '<td class="is-number">' + formatMetric(item.valor_diario, state.dailyMetric) + '</td>' +
                '<td class="is-number">' + formatMetric(item.valor_acumulado, state.dailyMetric) + '</td>' +
                '<td class="is-number">' + currency(item.meta_esperada) + '</td>' +
                '<td class="is-number">' + currency(item.pago_acumulado) + '</td>' +
                '<td class="is-number">' + currency(item.ho_acumulado) + '</td>' +
                '<td>' + icmBadge(item.icm) + '</td>' +
                '</tr>';
        }).join("") || '<tr><td colspan="8" class="metas-empty">Sem dados diários para o recorte.</td></tr>';

        const canvas = byId("metasDailyChart");
        if (!canvas || !window.Chart || !data.rows.length) return;
        const options = chartBaseOptions({
            onClick: function (_event, elements) {
                if (!elements.length) return;
                applyDateFilter(data.rows[elements[0].index].data);
            },
        });
        options.scales.y.ticks.callback = axisCurrency;
        options.plugins.tooltip.callbacks.label = function (context) {
            const metric = context.dataset.metric || state.dailyMetric;
            return tooltipLabel(context, metric);
        };

        const datasets = [
            {
                label: definition.label + " diário",
                metric: state.dailyMetric,
                type: "bar",
                data: data.rows.map(function (i) { return i.valor_diario; }),
                backgroundColor: COLORS.teal,
                borderRadius: 5,
                maxBarThickness: 20,
            },
            {
                label: "Acumulado",
                metric: state.dailyMetric,
                type: "line",
                data: data.rows.map(function (i) { return i.valor_acumulado; }),
                borderColor: COLORS.blue,
                backgroundColor: COLORS.blue,
                borderWidth: 2.5,
                pointRadius: 2,
                tension: .25,
            },
        ];

        if (["pago", "ho"].includes(state.dailyMetric)) {
            datasets.push({
                label: "Meta esperada até o dia",
                metric: "meta",
                type: "line",
                data: data.rows.map(function (i) { return i.meta_esperada; }),
                borderColor: COLORS.sky,
                backgroundColor: COLORS.sky,
                borderDash: [5, 5],
                borderWidth: 2,
                pointRadius: 0,
                tension: .2,
            });
        }

        state.charts.daily = new Chart(canvas, {
            type: "bar",
            data: {
                labels: data.rows.map(function (i) { return i.data.slice(8, 10) + "/" + i.data.slice(5, 7); }),
                datasets: datasets,
            },
            options: options,
        });
    }

    function renderSegmentChart(key, canvasId, field, filterKey) {
        destroyChart(key);
        const canvas = byId(canvasId);
        if (!canvas || !window.Chart) return;
        const rows = groupByDimension(field, state.filteredRecords, state.filteredMetas)
            .filter(function (item) { return item.nome && item.nome !== "Não informado"; })
            .sort(function (a, b) { return num(b[state.metricFocus]) - num(a[state.metricFocus]); });
        if (!rows.length) return;

        const values = rows.map(function (item) { return num(item[state.metricFocus]); });
        const colors = [COLORS.navy, COLORS.blue, COLORS.steel, COLORS.teal, COLORS.aqua, COLORS.sky, COLORS.pale];
        const chartType = rows.length <= 5 ? "doughnut" : "bar";
        let options;

        if (chartType === "doughnut") {
            const theme = currentThemeColors();
            options = {
                responsive: true,
                maintainAspectRatio: false,
                cutout: "66%",
                animation: { duration: 420 },
                onClick: function (_event, elements) {
                    if (!elements.length) return;
                    applyFilter(filterKey, rows[elements[0].index].nome, "metasExecutiveSection");
                },
                plugins: {
                    legend: {
                        position: "bottom",
                        labels: { color: theme.text, usePointStyle: true, pointStyle: "circle", font: { size: 8, weight: 700 } },
                        onClick: function (_event, legendItem) {
                            const row = rows[legendItem.index];
                            if (row) applyFilter(filterKey, row.nome, "metasExecutiveSection");
                        },
                    },
                    tooltip: {
                        backgroundColor: theme.tooltipBg,
                        titleColor: theme.tooltipText,
                        bodyColor: theme.tooltipText,
                        callbacks: { label: function (context) { return context.label + ": " + formatMetric(context.raw, state.metricFocus); } },
                    },
                },
            };
        } else {
            options = chartBaseOptions({
                indexAxis: "y",
                onClick: function (_event, elements) {
                    if (!elements.length) return;
                    applyFilter(filterKey, rows[elements[0].index].nome, "metasExecutiveSection");
                },
            });
            options.plugins.legend.display = false;
            options.plugins.tooltip.callbacks.label = function (context) { return formatMetric(context.raw, state.metricFocus); };
            if (METRICS[state.metricFocus].kind === "percent") {
                options.scales.x.ticks.callback = function (value) { return value + "%"; };
            } else if (METRICS[state.metricFocus].kind === "currency") {
                options.scales.x.ticks.callback = axisCurrency;
            }
        }

        state.charts[key] = new Chart(canvas, {
            type: chartType,
            data: {
                labels: rows.map(function (item) { return item.nome; }),
                datasets: [{
                    label: METRICS[state.metricFocus].label,
                    data: values,
                    backgroundColor: rows.map(function (_item, index) { return colors[index % colors.length]; }),
                    borderColor: chartType === "doughnut" ? "rgba(255,255,255,.7)" : undefined,
                    borderWidth: chartType === "doughnut" ? 2 : 0,
                    borderRadius: chartType === "bar" ? 6 : 0,
                }],
            },
            options: options,
        });
    }

    function icmBadge(value) {
        const cls = value >= 100 ? "is-good" : value >= 80 ? "is-mid" : "is-bad";
        return '<span class="metas-status-badge ' + cls + '">' + percent(value) + "</span>";
    }

    function rankings() {
        const company = groupByDimension("empresa", state.filteredRecords, state.filteredMetas)
            .sort(function (a, b) { return b.icm - a.icm; });
        const wallet = groupByDimension("carteira", state.filteredRecords, state.filteredMetas)
            .sort(function (a, b) { return b.icm - a.icm; });
        const superintendent = groupByDimension("superintendente", state.filteredRecords, state.filteredMetas)
            .sort(function (a, b) { return b.icm - a.icm; });
        const coordinator = groupByDimension("coordenador", state.filteredRecords, state.filteredMetas)
            .sort(function (a, b) { return b.icm - a.icm; });
        return { company: company, wallet: wallet, superintendent: superintendent, coordinator: coordinator };
    }

    function renderRankings() {
        const data = rankings();
        el.companyRanking.innerHTML = data.company.map(function (item, index) {
            return '<tr data-clickable="true" data-filter-company="' + escapeHtml(item.nome) + '">' +
                '<td>' + (index + 1) + '</td><td><strong>' + escapeHtml(item.nome) + '</strong></td>' +
                '<td class="is-number">' + currency(item.meta) + '</td>' +
                '<td class="is-number">' + currency(item.pago) + '</td>' +
                '<td>' + percent(item.atingimento_pago) + '</td>' +
                '<td class="is-number">' + currency(item.ho) + '</td>' +
                '<td>' + icmBadge(item.icm) + '</td>' +
                '<td>' + percent(item.eficiencia) + '</td></tr>';
        }).join("") || '<tr><td colspan="8" class="metas-empty">Sem resultados.</td></tr>';

        el.walletRanking.innerHTML = data.wallet.slice(0, 120).map(function (item, index) {
            return '<tr data-clickable="true" data-filter-wallet="' + escapeHtml(item.nome) + '">' +
                '<td>' + (index + 1) + '</td><td><strong>' + escapeHtml(item.nome) + '</strong></td>' +
                '<td class="is-number">' + currency(item.meta) + '</td>' +
                '<td class="is-number">' + currency(item.pago) + '</td>' +
                '<td>' + icmBadge(item.icm) + '</td></tr>';
        }).join("") || '<tr><td colspan="5" class="metas-empty">Sem resultados.</td></tr>';

        function smallRows(rows, filterAttribute) {
            return rows.slice(0, 80).map(function (item, index) {
                return '<tr data-clickable="true" ' + filterAttribute + '="' + escapeHtml(item.nome) + '">' +
                    '<td>' + (index + 1) + '</td><td>' + escapeHtml(item.nome) + '</td><td>' + icmBadge(item.icm) + '</td></tr>';
            }).join("") || '<tr><td colspan="3" class="metas-empty">Sem resultados.</td></tr>';
        }

        el.superintendentRanking.innerHTML = smallRows(data.superintendent, "data-filter-superintendent");
        el.coordinatorRanking.innerHTML = smallRows(data.coordinator, "data-filter-coordinator");

        renderRankingChart(data.wallet);
    }

    function renderRankingChart(walletRows) {
        destroyChart("ranking");
        const canvas = byId("metasRankingChart");
        if (!canvas || !window.Chart) return;
        const metric = state.metricFocus;
        const rows = walletRows.slice().sort(function (a, b) {
            return num(b[metric]) - num(a[metric]);
        }).slice(0, 10);

        const options = chartBaseOptions({
            indexAxis: "y",
            onClick: function (_event, elements) {
                if (!elements.length) return;
                applyFilter("wallet", rows[elements[0].index].nome, "metasExecutiveSection");
            },
        });
        options.plugins.legend.display = false;
        options.plugins.tooltip.callbacks.label = function (context) { return formatMetric(context.raw, metric); };
        if (METRICS[metric].kind === "currency") options.scales.x.ticks.callback = axisCurrency;
        if (METRICS[metric].kind === "percent") options.scales.x.ticks.callback = function (value) { return value + "%"; };

        state.charts.ranking = new Chart(canvas, {
            type: "bar",
            data: {
                labels: rows.map(function (item) { return item.nome; }),
                datasets: [{
                    data: rows.map(function (item) { return num(item[metric]); }),
                    backgroundColor: rows.map(function (_item, index) {
                        return [COLORS.navy, COLORS.blue, COLORS.steel, COLORS.teal, COLORS.aqua, COLORS.sky][index % 6];
                    }),
                    borderRadius: 6,
                    maxBarThickness: 22,
                }],
            },
            options: options,
        });
    }

    function buildMatrix() {
        const months = monthsInScope();
        const companies = new Set();
        state.filteredRecords.forEach(function (item) { if (item.empresa) companies.add(item.empresa); });
        state.filteredMetas.forEach(function (item) { if (item.empresa) companies.add(item.empresa); });

        const lines = Array.from(companies).sort(function (a, b) { return normalize(a).localeCompare(normalize(b)); }).map(function (company) {
            const companyRecords = filterByField(state.filteredRecords, "empresa", company);
            const companyMetas = filterByField(state.filteredMetas, "empresa", company);
            const wallets = new Set();
            companyRecords.forEach(function (item) { if (item.carteira) wallets.add(item.carteira); });
            companyMetas.forEach(function (item) { if (item.carteira) wallets.add(item.carteira); });

            const companyValues = {};
            months.forEach(function (month) {
                companyValues[month] = metricValue(
                    state.matrixMetric,
                    companyRecords.filter(function (i) { return i.mes === month; }),
                    companyMetas.filter(function (i) { return i.mes === month; })
                );
            });

            const children = Array.from(wallets).sort(function (a, b) { return normalize(a).localeCompare(normalize(b)); }).map(function (wallet) {
                const rec = filterByField(companyRecords, "carteira", wallet);
                const met = filterByField(companyMetas, "carteira", wallet);
                const values = {};
                months.forEach(function (month) {
                    values[month] = metricValue(
                        state.matrixMetric,
                        rec.filter(function (i) { return i.mes === month; }),
                        met.filter(function (i) { return i.mes === month; })
                    );
                });
                return {
                    empresa: company,
                    carteira: wallet,
                    values: values,
                    total: metricValue(state.matrixMetric, rec, met),
                };
            });

            return {
                empresa: company,
                values: companyValues,
                total: metricValue(state.matrixMetric, companyRecords, companyMetas),
                children: children,
            };
        });
        return { months: months, lines: lines };
    }

    function renderMatrix() {
        const matrix = buildMatrix();
        el.matrixHead.innerHTML = '<tr><th>Empresa / Carteira</th>' + matrix.months.map(function (month) {
            return '<th class="is-number">' + escapeHtml(monthLabel(month)) + '</th>';
        }).join("") + '<th class="is-number">Total</th></tr>';

        const rows = [];
        matrix.lines.forEach(function (company) {
            const expanded = state.expandedCompanies.has(company.empresa);
            rows.push('<tr class="is-company-row"><td><button type="button" class="metas-matrix-toggle" data-toggle-company="' + escapeHtml(company.empresa) + '"><i class="fa ' + (expanded ? "fa-minus-square-o" : "fa-plus-square-o") + '"></i></button> <button type="button" class="metas-link-button" data-filter-company="' + escapeHtml(company.empresa) + '">' + escapeHtml(company.empresa) + '</button></td>' +
                matrix.months.map(function (month) { return '<td class="is-number">' + formatMetric(company.values[month], state.matrixMetric) + '</td>'; }).join("") +
                '<td class="is-number"><strong>' + formatMetric(company.total, state.matrixMetric) + '</strong></td></tr>');

            if (expanded) {
                company.children.forEach(function (wallet) {
                    rows.push('<tr class="is-wallet-row" data-clickable="true" data-filter-wallet="' + escapeHtml(wallet.carteira) + '"><td>↳ ' + escapeHtml(wallet.carteira) + '</td>' +
                        matrix.months.map(function (month) { return '<td class="is-number">' + formatMetric(wallet.values[month], state.matrixMetric) + '</td>'; }).join("") +
                        '<td class="is-number">' + formatMetric(wallet.total, state.matrixMetric) + '</td></tr>');
                });
            }
        });
        el.matrixBody.innerHTML = rows.join("") || '<tr><td class="metas-empty">Sem dados para a matriz.</td></tr>';

        const totals = {};
        matrix.months.forEach(function (month) {
            totals[month] = metricValue(
                state.matrixMetric,
                state.filteredRecords.filter(function (i) { return i.mes === month; }),
                state.filteredMetas.filter(function (i) { return i.mes === month; })
            );
        });
        const total = metricValue(state.matrixMetric, state.filteredRecords, state.filteredMetas);
        el.matrixFoot.innerHTML = '<tr><td>Total geral</td>' + matrix.months.map(function (month) {
            return '<td class="is-number">' + formatMetric(totals[month], state.matrixMetric) + '</td>';
        }).join("") + '<td class="is-number">' + formatMetric(total, state.matrixMetric) + '</td></tr>';
    }

    function analyticMetaFor(record) {
        const key = normalize(record.carteira) + "|" + record.mes;
        if (!state._metaLookup) {
            state._metaLookup = new Map();
            state.metas.forEach(function (item) {
                state._metaLookup.set(normalize(item.carteira) + "|" + item.mes, num(item.meta));
            });
        }
        return record.ia ? 0 : (state._metaLookup.get(key) || 0);
    }

    function renderAnalysisStrip(metrics) {
        const daily = dailyRows();
        const last = daily.rows.length ? daily.rows[daily.rows.length - 1] : null;
        const missing = missingMetaRows();
        const cards = [
            ["Dia útil do último registro", last ? numberFormat(last.dia_util) + " de " + numberFormat(last.total_dias_uteis) : "—"],
            ["Empresas no recorte", numberFormat(metrics.empresas)],
            ["Carteiras no recorte", numberFormat(metrics.carteiras)],
            ["Carteiras IA", numberFormat(metrics.carteiras_ia)],
            ["Pago por IA", currency(metrics.pago_ia)],
            ["Ocorrências sem meta", numberFormat(missing.length)],
        ];
        el.analysisStrip.innerHTML = cards.map(function (item) {
            return '<article class="metas-analysis-mini"><span>' + escapeHtml(item[0]) + '</span><strong>' + escapeHtml(item[1]) + '</strong></article>';
        }).join("");
    }

    function analyticRowsForRender() {
        const search = normalize(state.analytic.search);
        let rows = state.filteredRecords.slice();
        if (search) {
            rows = rows.filter(function (item) {
                return [item.empresa, item.carteira, item.superintendente, item.coordenador, item.tipo_carteira, item.producao_carteira]
                    .some(function (value) { return normalize(value).includes(search); });
            });
        }

        const key = state.analytic.sortKey;
        const direction = state.analytic.sortDirection === "asc" ? 1 : -1;
        rows.sort(function (a, b) {
            let av = key === "meta" ? analyticMetaFor(a) : key === "icm" ? (analyticMetaFor(a) ? (num(a.ho) / analyticMetaFor(a)) * 100 : 0) : a[key];
            let bv = key === "meta" ? analyticMetaFor(b) : key === "icm" ? (analyticMetaFor(b) ? (num(b.ho) / analyticMetaFor(b)) * 100 : 0) : b[key];
            if (typeof av === "number" || typeof bv === "number") return (num(av) - num(bv)) * direction;
            return String(av || "").localeCompare(String(bv || ""), "pt-BR") * direction;
        });
        return rows;
    }

    function renderAnalytic() {
        const rows = analyticRowsForRender();
        const pageSize = state.analytic.pageSize;
        const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
        state.analytic.page = Math.min(state.analytic.page, totalPages);
        const start = (state.analytic.page - 1) * pageSize;
        const pageRows = rows.slice(start, start + pageSize);

        el.analyticBody.innerHTML = pageRows.map(function (item) {
            const meta = analyticMetaFor(item);
            const icm = meta ? (num(item.ho) / meta) * 100 : 0;
            return '<tr data-clickable="true" data-filter-wallet="' + escapeHtml(item.carteira) + '">' +
                '<td>' + escapeHtml(item.data.split("-").reverse().join("/")) + '</td>' +
                '<td>' + numberFormat(item.dia_util) + ' / ' + numberFormat(item.total_dias_uteis) + '</td>' +
                '<td>' + escapeHtml(item.empresa) + '</td>' +
                '<td><strong>' + escapeHtml(item.carteira) + '</strong></td>' +
                '<td>' + escapeHtml(item.digital) + '</td>' +
                '<td>' + escapeHtml(item.tipo_carteira) + '</td>' +
                '<td>' + escapeHtml(item.producao_carteira) + '</td>' +
                '<td class="is-number">' + currency(item.valor_base) + '</td>' +
                '<td class="is-number">' + currency(item.produzido) + '</td>' +
                '<td class="is-number">' + currency(item.pago) + '</td>' +
                '<td class="is-number">' + currency(item.ho) + '</td>' +
                '<td class="is-number">' + currency(item.entrega) + '</td>' +
                '<td class="is-number">' + currency(meta) + '</td>' +
                '<td>' + icmBadge(icm) + '</td></tr>';
        }).join("") || '<tr><td colspan="14" class="metas-empty">Nenhum registro encontrado.</td></tr>';

        el.analyticCount.textContent = rows.length
            ? numberFormat(start + 1) + "–" + numberFormat(Math.min(start + pageSize, rows.length)) + " de " + numberFormat(rows.length) + " registros"
            : "0 registros";

        renderPagination(totalPages);
    }

    function renderPagination(totalPages) {
        const current = state.analytic.page;
        const buttons = [];
        buttons.push('<button type="button" data-page="' + (current - 1) + '" ' + (current <= 1 ? "disabled" : "") + '><i class="fa fa-angle-left"></i></button>');

        const start = Math.max(1, current - 2);
        const end = Math.min(totalPages, current + 2);
        if (start > 1) buttons.push('<button type="button" data-page="1">1</button>');
        if (start > 2) buttons.push('<button type="button" disabled>…</button>');
        for (let page = start; page <= end; page += 1) {
            buttons.push('<button type="button" class="' + (page === current ? "is-active" : "") + '" data-page="' + page + '">' + page + '</button>');
        }
        if (end < totalPages - 1) buttons.push('<button type="button" disabled>…</button>');
        if (end < totalPages) buttons.push('<button type="button" data-page="' + totalPages + '">' + totalPages + '</button>');
        buttons.push('<button type="button" data-page="' + (current + 1) + '" ' + (current >= totalPages ? "disabled" : "") + '><i class="fa fa-angle-right"></i></button>');
        el.analyticPagination.innerHTML = buttons.join("");
    }

    function renderEverything() {
        const metrics = aggregate(state.filteredRecords, state.filteredMetas);
        renderActiveFilters();
        renderKpis(metrics);
        el.focusMetricLabel.textContent = METRICS[state.metricFocus].label;
        renderMonthlyChart();
        renderCompanyIcmChart();
        renderMissingMeta();
        renderDaily();
        renderSegmentChart("digital", "metasDigitalChart", "digital", "digital");
        renderSegmentChart("walletType", "metasWalletTypeChart", "tipo_carteira", "walletType");
        renderSegmentChart("productionType", "metasProductionTypeChart", "producao_carteira", "productionType");
        renderRankings();
        renderMatrix();
        renderAnalysisStrip(metrics);
        renderAnalytic();
    }

    function applyLocalFilters() {
        syncFiltersFromControls();
        state.filteredRecords = state.records.filter(recordMatches);
        state.filteredMetas = state.metas.filter(metaMatches);
        state._metaLookup = null;
        renderEverything();
    }

    function populateControls(data, preserve) {
        const options = data.opcoes || {};
        const old = preserve ? Object.assign({}, state.filters) : null;

        setSelectOptions(el.monthQuick, options.meses || [], "Todos", old ? old.month : "");
        setSelectOptions(el.company, options.empresas || [], "Todas", old ? old.company : "");
        setSelectOptions(el.wallet, options.carteiras || [], "Todas", old ? old.wallet : "");
        setSelectOptions(el.digital, options.digitais || [], "Digital + Humana", old ? old.digital : "");
        setSelectOptions(el.walletType, options.tipos_carteira || [], "Todos", old ? old.walletType : "");
        setSelectOptions(el.productionType, options.producoes_carteira || [], "Todas", old ? old.productionType : "");
        setSelectOptions(el.superintendent, options.superintendentes || [], "Todos", old ? old.superintendent : "");
        setSelectOptions(el.coordinator, options.coordenadores || [], "Todos", old ? old.coordinator : "");
        setSelectOptions(el.dailyMonth, options.meses || [], null, el.dailyMonth.value || (options.meses && options.meses.length ? options.meses[options.meses.length - 1].chave : ""));

        const matrixOptions = Object.keys(METRICS).map(function (key) { return { chave: key, rotulo: METRICS[key].label }; });
        setSelectOptions(el.matrixIndicator, matrixOptions, null, state.matrixMetric);

        state.defaultDateStart = options.data_min || "";
        state.defaultDateEnd = options.data_max || "";
        el.dateStart.min = options.data_min || "";
        el.dateStart.max = options.data_max || "";
        el.dateEnd.min = options.data_min || "";
        el.dateEnd.max = options.data_max || "";

        if (old && old.dateStart) el.dateStart.value = old.dateStart;
        else el.dateStart.value = state.defaultDateStart;
        if (old && old.dateEnd) el.dateEnd.value = old.dateEnd;
        else el.dateEnd.value = state.defaultDateEnd;

        syncFiltersFromControls();
    }

    function setSnapshot(data, preserveFilters) {
        state.raw = data;
        state.records = Array.isArray(data.registros) ? data.registros : [];
        state.metas = Array.isArray(data.metas) ? data.metas : [];
        state._metaLookup = null;
        if (el.dataSource) el.dataSource.textContent = data.fonte || "Banco de dados Workspace";
        if (el.updated) el.updated.textContent = (data.atualizado_em || "—") + " • consulta " + (data.gerado_em || "—");
        populateControls(data, preserveFilters);
        state.filteredRecords = state.records.filter(recordMatches);
        state.filteredMetas = state.metas.filter(metaMatches);
        renderEverything();
    }

    async function loadData(source) {
        if (state.loading) return;
        showLoading(true, source);
        try {
            const data = await fetchData();
            setSnapshot(data, source === "refresh" && !!state.raw);
        } catch (error) {
            console.error("Dashboard Metas:", error);
            toast(error.message || "Erro ao carregar o dashboard.");
        } finally {
            showLoading(false, source);
        }
    }

    function clearFilters() {
        setControlValue("dateStart", state.defaultDateStart);
        setControlValue("dateEnd", state.defaultDateEnd);
        ["month", "company", "wallet", "digital", "walletType", "productionType", "superintendent", "coordinator"].forEach(function (key) {
            setControlValue(key, "");
        });
        state.analytic.page = 1;
        applyLocalFilters();
    }

    function setMetricFocus(metric) {
        if (!METRICS[metric]) return;
        state.metricFocus = metric;
        document.querySelectorAll("#metasMetricSwitch [data-metric]").forEach(function (button) {
            button.classList.toggle("is-active", button.dataset.metric === metric);
        });
        renderKpis(aggregate(state.filteredRecords, state.filteredMetas));
        el.focusMetricLabel.textContent = METRICS[metric].label;
        renderSegmentChart("digital", "metasDigitalChart", "digital", "digital");
        renderSegmentChart("walletType", "metasWalletTypeChart", "tipo_carteira", "walletType");
        renderSegmentChart("productionType", "metasProductionTypeChart", "producao_carteira", "productionType");
        renderRankings();
    }

    function csvEscape(value) {
        return '"' + String(value == null ? "" : value).replace(/"/g, '""') + '"';
    }

    function downloadCsv(filename, rows) {
        const content = "\ufeff" + rows.map(function (row) { return row.map(csvEscape).join(";"); }).join("\n");
        const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    function exportSection(section) {
        if (section === "missing-meta") {
            const rows = [["Competência", "Empresa", "Carteira", "Superintendente", "Coordenador"]];
            missingMetaRows().forEach(function (item) { rows.push([item.competencia, item.empresa, item.carteira, item.superintendente, item.coordenador]); });
            downloadCsv("carteiras_sem_meta.csv", rows);
            return;
        }

        if (section === "daily") {
            const data = dailyRows();
            const rows = [["Dia útil", "Total dias úteis", "Data", "Valor diário", "Acumulado", "Meta esperada", "Pago acumulado", "HO acumulado", "ICM %", "Pago/Meta %", "Eficiência %"]];
            data.rows.forEach(function (item) {
                rows.push([item.dia_util, item.total_dias_uteis, item.data, item.valor_diario, item.valor_acumulado, item.meta_esperada, item.pago_acumulado, item.ho_acumulado, item.icm, item.atingimento_pago, item.eficiencia]);
            });
            downloadCsv("evolucao_diaria.csv", rows);
            return;
        }

        if (section === "matrix") {
            const matrix = buildMatrix();
            const rows = [["Empresa", "Carteira"].concat(matrix.months.map(monthLabel), ["Total"])];
            matrix.lines.forEach(function (company) {
                rows.push([company.empresa, ""].concat(matrix.months.map(function (m) { return company.values[m]; }), [company.total]));
                company.children.forEach(function (wallet) {
                    rows.push([wallet.empresa, wallet.carteira].concat(matrix.months.map(function (m) { return wallet.values[m]; }), [wallet.total]));
                });
            });
            downloadCsv("matriz_mensal.csv", rows);
            return;
        }

        if (section === "analytic") {
            const rows = [["Data", "Dia útil", "Empresa", "Carteira", "Digital", "Tipo carteira", "Produção carteira", "Valor base", "Quantidade base", "Produzido", "Pago", "Pago elegível", "HO", "Entrega", "Meta", "Superintendente", "Coordenador"]];
            analyticRowsForRender().forEach(function (item) {
                rows.push([item.data, item.dia_util + "/" + item.total_dias_uteis, item.empresa, item.carteira, item.digital, item.tipo_carteira, item.producao_carteira, item.valor_base, item.quantidade_base, item.produzido, item.pago, item.pago_elegivel, item.ho, item.entrega, analyticMetaFor(item), item.superintendente, item.coordenador]);
            });
            downloadCsv("analitico_metas_controles.csv", rows);
        }
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute("data-theme", theme);
        document.body.setAttribute("data-theme", theme);
        const dark = theme === "dark";
        if (el.themeIcon) el.themeIcon.className = "fa " + (dark ? "fa-sun-o" : "fa-moon-o");
        if (el.themeText) el.themeText.textContent = dark ? "Modo claro" : "Modo escuro";
        window.localStorage.setItem("taskflow-theme", theme);
        if (state.raw) renderEverything();
    }

    function bindFilterEvents() {
        [el.dateStart, el.dateEnd, el.company, el.wallet, el.digital, el.walletType, el.productionType, el.superintendent, el.coordinator].forEach(function (control) {
            control.addEventListener("change", function () {
                if (control === el.dateStart || control === el.dateEnd) el.monthQuick.value = "";
                state.analytic.page = 1;
                applyLocalFilters();
            });
        });

        el.monthQuick.addEventListener("change", function () {
            const month = el.monthQuick.value;
            if (month) {
                el.dateStart.value = month + "-01";
                el.dateEnd.value = lastDayOfMonth(month);
            } else {
                el.dateStart.value = state.defaultDateStart;
                el.dateEnd.value = state.defaultDateEnd;
            }
            state.analytic.page = 1;
            applyLocalFilters();
        });
    }

    function bindDelegatedClicks() {
        document.addEventListener("click", function (event) {
            const remove = event.target.closest("[data-remove-filter]");
            if (remove) {
                const key = remove.dataset.removeFilter;
                if (key === "month") {
                    setControlValue("month", "");
                    setControlValue("dateStart", state.defaultDateStart);
                    setControlValue("dateEnd", state.defaultDateEnd);
                } else if (key === "dateStart") {
                    setControlValue(key, state.defaultDateStart);
                } else if (key === "dateEnd") {
                    setControlValue(key, state.defaultDateEnd);
                } else {
                    setControlValue(key, "");
                }
                state.analytic.page = 1;
                applyLocalFilters();
                return;
            }

            const kpi = event.target.closest("[data-kpi-metric]");
            if (kpi) {
                setMetricFocus(kpi.dataset.kpiMetric);
                return;
            }

            const metric = event.target.closest("#metasMetricSwitch [data-metric]");
            if (metric) {
                setMetricFocus(metric.dataset.metric);
                return;
            }

            const company = event.target.closest("[data-filter-company]");
            if (company) {
                applyFilter("company", company.dataset.filterCompany, "metasExecutiveSection");
                return;
            }

            const wallet = event.target.closest("[data-filter-wallet]");
            if (wallet) {
                applyFilter("wallet", wallet.dataset.filterWallet, "metasExecutiveSection");
                return;
            }

            const sup = event.target.closest("[data-filter-superintendent]");
            if (sup) {
                applyFilter("superintendent", sup.dataset.filterSuperintendent, "metasExecutiveSection");
                return;
            }

            const coord = event.target.closest("[data-filter-coordinator]");
            if (coord) {
                applyFilter("coordinator", coord.dataset.filterCoordinator, "metasExecutiveSection");
                return;
            }

            const date = event.target.closest("[data-filter-date]");
            if (date) {
                applyDateFilter(date.dataset.filterDate);
                return;
            }

            const toggle = event.target.closest("[data-toggle-company]");
            if (toggle) {
                const name = toggle.dataset.toggleCompany;
                if (state.expandedCompanies.has(name)) state.expandedCompanies.delete(name);
                else state.expandedCompanies.add(name);
                renderMatrix();
                return;
            }

            const page = event.target.closest("[data-page]");
            if (page && !page.disabled) {
                state.analytic.page = Number(page.dataset.page) || 1;
                renderAnalytic();
                return;
            }

            const jump = event.target.closest("[data-jump]");
            if (jump) {
                const target = byId(jump.dataset.jump);
                if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        });
    }

    function bindEvents() {
        el.refresh.addEventListener("click", function () { loadData("refresh"); });
        el.clear.addEventListener("click", clearFilters);
        bindFilterEvents();
        bindDelegatedClicks();

        el.dailyMonth.addEventListener("change", renderDaily);
        el.dailyIndicator.addEventListener("change", function () {
            state.dailyMetric = el.dailyIndicator.value || "produzido";
            renderDaily();
        });

        el.matrixIndicator.addEventListener("change", function () {
            state.matrixMetric = el.matrixIndicator.value || "pago";
            renderMatrix();
        });

        el.expandMatrix.addEventListener("click", function () {
            state.allExpanded = !state.allExpanded;
            state.expandedCompanies.clear();
            if (state.allExpanded) {
                const companies = new Set();
                state.filteredRecords.forEach(function (item) { companies.add(item.empresa); });
                state.filteredMetas.forEach(function (item) { companies.add(item.empresa); });
                companies.forEach(function (name) { state.expandedCompanies.add(name); });
            }
            el.expandMatrix.innerHTML = '<i class="fa ' + (state.allExpanded ? "fa-minus-square-o" : "fa-plus-square-o") + '"></i> ' + (state.allExpanded ? "Recolher" : "Expandir");
            renderMatrix();
        });

        document.querySelectorAll("[data-export]").forEach(function (button) {
            button.addEventListener("click", function () { exportSection(button.dataset.export); });
        });

        el.analyticSearch.addEventListener("input", function () {
            state.analytic.search = el.analyticSearch.value || "";
            state.analytic.page = 1;
            renderAnalytic();
        });

        el.analyticPageSize.addEventListener("change", function () {
            state.analytic.pageSize = Number(el.analyticPageSize.value) || 25;
            state.analytic.page = 1;
            renderAnalytic();
        });

        document.querySelectorAll(".metas-analytic-table th[data-sort]").forEach(function (head) {
            head.addEventListener("click", function () {
                const key = head.dataset.sort;
                if (state.analytic.sortKey === key) {
                    state.analytic.sortDirection = state.analytic.sortDirection === "asc" ? "desc" : "asc";
                } else {
                    state.analytic.sortKey = key;
                    state.analytic.sortDirection = "asc";
                }
                renderAnalytic();
            });
        });

        el.themeButton.addEventListener("click", function () {
            const current = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
            applyTheme(current === "dark" ? "light" : "dark");
        });
    }

    function init() {
        cacheElements();
        if (!el.form) return;
        const storedTheme = window.localStorage.getItem("taskflow-theme");
        applyTheme(storedTheme === "dark" ? "dark" : "light");
        bindEvents();
        loadData("initial");
    }

    document.addEventListener("DOMContentLoaded", init);
})();
