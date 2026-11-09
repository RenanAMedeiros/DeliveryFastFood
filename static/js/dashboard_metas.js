(function () {
    "use strict";

    const COLORS = {
        navy: "#001d39",
        blue: "#0a4174",
        blue2: "#175c96",
        sky: "#7bbde8",
        teal: "#4e8ea2",
        green: "#24866a",
        red: "#c95b62",
        amber: "#c58b22"
    };

    const METRICS = {
        producao_realizada: { label: "Total produzido", kind: "currency", icon: "fa-industry" },
        pagamento: { label: "Total pago", kind: "currency", icon: "fa-money" },
        entrega_amigavel: { label: "Entrega amigável", kind: "currency", icon: "fa-handshake-o" },
        meta: { label: "Meta", kind: "currency", icon: "fa-bullseye" },
        valor_ho: { label: "Total HO", kind: "currency", icon: "fa-line-chart" },
        icm: { label: "ICM", kind: "percent", icon: "fa-tachometer" },
        qtde_carteiras: { label: "Qtde carteiras", kind: "number", icon: "fa-briefcase" }
    };

    const state = {
        raw: null,
        records: [],
        metas: [],
        filteredRecords: [],
        filteredMetas: [],
        filters: {
            dateStart: "",
            dateEnd: "",
            tipo_carteira: "",
            producao_carteira: "",
            digital: "",
            empresa: "",
            carteira: "",
            atuacao_carteira: "",
            superintendente: "",
            gerente: "",
            coordenador: ""
        },
        charts: {},
        expandedCompanies: new Set(),
        allExpanded: false,
        expandedRankingCompanies: new Set(),
        allRankingCompaniesExpanded: false,
        analytic: { page: 1, pageSize: 25, search: "" },
        daily: {
            fullTable: false,
            chartMode: "pace"
        },
        periodUserSelected: false,
        loading: false
    };

    const el = {};
    const byId = (id) => document.getElementById(id);

    function cacheElements() {
        el.form = byId("metasFilters");
        el.url = el.form ? el.form.dataset.url : "";
        el.refresh = byId("metasRefreshButton");
        el.theme = byId("metasThemeButton");
        el.themeIcon = byId("metasThemeIcon");
        el.themeText = byId("metasThemeText");
        el.status = byId("metasStatus");
        el.dataSource = byId("metasDataSource");
        el.updated = byId("metasUpdatedAt");
        el.dateStart = byId("metasDateStart");
        el.dateEnd = byId("metasDateEnd");
        el.periodStatus = byId("metasPeriodStatus");
        el.monthButtons = byId("metasMonthButtons");
        el.advancedToggle = byId("metasAdvancedToggle");
        el.advanced = byId("metasAdvancedFilters");
        el.clear = byId("metasClearButton");
        el.walletTypeBlocks = byId("metasWalletTypeBlocks");
        el.productionTypeBlocks = byId("metasProductionTypeBlocks");
        el.digitalBlocks = byId("metasDigitalBlocks");
        el.company = byId("metasCompany");
        el.wallet = byId("metasWallet");
        el.actuation = byId("metasActuation");
        el.superintendent = byId("metasSuperintendent");
        el.manager = byId("metasManager");
        el.coordinator = byId("metasCoordinator");
        el.activeFilters = byId("metasActiveFilters");
        el.walletTypeDonut = byId("metasWalletTypeDonut");
        el.walletTypeCenter = byId("metasWalletTypeCenter");
        el.walletTypeLegend = byId("metasWalletTypeLegend");
        el.productionTypeDonut = byId("metasProductionTypeDonut");
        el.productionTypeCenter = byId("metasProductionTypeCenter");
        el.productionTypeLegend = byId("metasProductionTypeLegend");
        el.digitalDonut = byId("metasDigitalDonut");
        el.digitalCenter = byId("metasDigitalCenter");
        el.digitalLegend = byId("metasDigitalLegend");
        el.actuationDonut = byId("metasActuationDonut");
        el.actuationCenter = byId("metasActuationCenter");
        el.actuationLegend = byId("metasActuationLegend");
        el.kpis = byId("metasKpiGrid");
        el.insights = byId("metasInsightGrid");
        el.monthlyComparisonHead = byId("metasMonthlyComparisonHead");
        el.monthlyComparisonBody = byId("metasMonthlyComparisonBody");
        el.analysisGuide = byId("metasAnalysisGuide");
        el.analysisGuideToggle = byId("metasAnalysisGuideToggle");
        el.analysisGuideDetails = byId("metasAnalysisGuideDetails");
        el.monthlyChart = byId("metasMonthlyChart");
        el.icmChart = byId("metasIcmChart");
        el.dailyMonth = byId("metasDailyMonth");
        el.dailyMetric = byId("metasDailyMetric");
        el.dailySummary = byId("metasDailySummary");
        el.dailyChart = byId("metasDailyChart");
        el.dailyBody = byId("metasDailyBody");
        el.dailyDuBadge = byId("metasDailyDuBadge");
        el.dailyCommandCard = byId("metasDailyCommandCard");
        el.dailyStatus = byId("metasDailyStatus");
        el.dailyStatusDetail = byId("metasDailyStatusDetail");
        el.dailyNarrative = byId("metasDailyNarrative");
        el.dailyCommandKpis = byId("metasDailyCommandKpis");
        el.dailySignals = byId("metasDailySignals");
        el.dailyDiagnosis = byId("metasDailyDiagnosis");
        el.dailyChartFooter = byId("metasDailyChartFooter");
        el.dailyTableToggle = byId("metasDailyTableToggle");
        el.duHead = byId("metasDuComparisonHead");
        el.duBody = byId("metasDuComparisonBody");
        el.duMetric = byId("metasDuMetric");
        el.duMetricStatus = byId("metasDuMetricStatus");
        el.duTooltip = byId("metasDuTooltip");
        el.supRanking = byId("metasSuperintendentRanking");
        el.managerRanking = byId("metasManagerRanking");
        el.coordRanking = byId("metasCoordinatorRanking");
        el.companyWalletRanking = byId("metasCompanyWalletRanking");
        el.companyWalletRankingSummary = byId("metasCompanyWalletRankingSummary");
        el.companyWalletExpandAll = byId("metasCompanyWalletExpandAll");
        el.matrixMetric = byId("metasMatrixMetric");
        el.expandCompanies = byId("metasExpandCompanies");
        el.matrixHead = byId("metasMatrixHead");
        el.matrixBody = byId("metasMatrixBody");
        el.analyticSearch = byId("metasAnalyticSearch");
        el.analyticPageSize = byId("metasAnalyticPageSize");
        el.analyticBody = byId("metasAnalyticBody");
        el.analyticCount = byId("metasAnalyticCount");
        el.analyticPagination = byId("metasAnalyticPagination");
        el.exportCsv = byId("metasExportCsv");
        el.loading = byId("metasLoading");
        el.toast = byId("metasToast");
    }

    function text(node, value) {
        if (node) node.textContent = value == null ? "" : String(value);
    }

    function html(node, value) {
        if (node) node.innerHTML = value == null ? "" : String(value);
    }

    function value(node, newValue) {
        if (node) node.value = newValue == null ? "" : String(newValue);
    }

    function num(valueToParse) {
        const n = Number(valueToParse == null ? 0 : valueToParse);
        return Number.isFinite(n) ? n : 0;
    }

    function normalize(valueToNormalize) {
        return String(valueToNormalize == null ? "" : valueToNormalize)
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/\s+/g, " ")
            .trim()
            .toUpperCase();
    }

    function digitalProfileLabel(valueToDisplay) {
        const normalized = normalize(valueToDisplay);

        if (
            normalized === "NAO" ||
            normalized === "0" ||
            normalized === "FALSE" ||
            normalized === "OPERACIONAL"
        ) {
            return "OPERACIONAL";
        }

        if (
            normalized === "SIM" ||
            normalized === "1" ||
            normalized === "TRUE" ||
            normalized === "IA"
        ) {
            return "IA";
        }

        return String(
            valueToDisplay == null ||
            valueToDisplay === ""
                ? "Não informado"
                : valueToDisplay
        );
    }

    function dimensionDisplayLabel(key, rawValue) {
        if (key === "digital") {
            return digitalProfileLabel(rawValue);
        }

        return String(
            rawValue == null ||
            rawValue === ""
                ? "Não informado"
                : rawValue
        );
    }

    function operationalDigitalValue() {
        const options =
            state.raw &&
            state.raw.opcoes &&
            Array.isArray(state.raw.opcoes.digitais)
                ? state.raw.opcoes.digitais
                : [];

        return (
            options.find(
                (item) =>
                    digitalProfileLabel(item) ===
                    "OPERACIONAL"
            ) || ""
        );
    }

    function defaultMonthRange() {
        const current = monthInfo(
            currentMonthKey()
        );

        if (current) {
            return {
                start: current.primeiro_dia,
                end: monthEffectiveEnd(current)
            };
        }

        const months = calendarMonths();
        const fallback = months.length
            ? months[months.length - 1]
            : null;

        if (fallback) {
            return {
                start: fallback.primeiro_dia,
                end: monthEffectiveEnd(fallback)
            };
        }

        return {
            start: periodStart(),
            end: periodEnd()
        };
    }

    function applyDashboardDefaults() {
        state.filters.dateStart =
            periodStart();

        state.filters.dateEnd =
            periodEnd();

        state.periodUserSelected = false;

        state.filters.tipo_carteira = "";
        state.filters.producao_carteira = "";
        state.filters.digital =
            operationalDigitalValue();
        state.filters.empresa = "";
        state.filters.carteira = "";
        state.filters.atuacao_carteira = "";
        state.filters.superintendente = "";
        state.filters.gerente = "";
        state.filters.coordenador = "";
    }

    function currentFocusRange() {
        if (state.periodUserSelected) {
            return {
                start: state.filters.dateStart,
                end: state.filters.dateEnd
            };
        }

        return defaultMonthRange();
    }

    function currentFocusRecordMatches(item) {
        if (!matchesDimensions(item)) {
            return false;
        }

        const range = currentFocusRange();

        if (
            range.start &&
            item.data < range.start
        ) {
            return false;
        }

        if (
            range.end &&
            item.data > range.end
        ) {
            return false;
        }

        return true;
    }

    function currentFocusMetaMatches(item) {
        if (!matchesDimensions(item)) {
            return false;
        }

        const month = monthInfo(item.mes);
        if (!month) return false;

        const range = currentFocusRange();

        if (
            range.start &&
            month.ultimo_dia < range.start
        ) {
            return false;
        }

        if (
            range.end &&
            month.primeiro_dia > range.end
        ) {
            return false;
        }

        return true;
    }

    function currentFocusRecords() {
        return state.records.filter(
            currentFocusRecordMatches
        );
    }

    function currentFocusMetas() {
        return state.metas.filter(
            currentFocusMetaMatches
        );
    }

    function currentFocusMonthLabel() {
        const range = currentFocusRange();

        const months = calendarMonths().filter(
            (month) => {
                if (
                    range.start &&
                    month.ultimo_dia < range.start
                ) {
                    return false;
                }

                if (
                    range.end &&
                    month.primeiro_dia > range.end
                ) {
                    return false;
                }

                return true;
            }
        );

        if (months.length === 1) {
            return months[0].rotulo;
        }

        if (months.length > 1) {
            return (
                months[0].rotulo +
                " → " +
                months[months.length - 1].rotulo
            );
        }

        return "Período atual";
    }

    function escapeHtml(valueToEscape) {
        return String(valueToEscape == null ? "" : valueToEscape)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function currency(n) {
        return new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(num(n));
    }

    function compactCurrency(n) {
        const absolute = Math.abs(num(n));
        const sign = num(n) < 0 ? "-" : "";
        if (absolute >= 1e9) return sign + "R$ " + (absolute / 1e9).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + " bi";
        if (absolute >= 1e6) return sign + "R$ " + (absolute / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + " mi";
        if (absolute >= 1e3) return sign + "R$ " + (absolute / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " mil";
        return currency(n);
    }

    function numberFormat(n, decimals) {
        return new Intl.NumberFormat("pt-BR", {
            minimumFractionDigits: decimals || 0,
            maximumFractionDigits: decimals || 0
        }).format(num(n));
    }

    function percent(n) {
        return numberFormat(n, 2) + "%";
    }

    function formatDateBr(iso) {
        const parts = String(iso || "").split("-");
        return parts.length === 3 ? parts[2] + "/" + parts[1] + "/" + parts[0] : (iso || "—");
    }

    function formatMetric(n, metric) {
        const def = METRICS[metric] || METRICS.producao_realizada;
        if (def.kind === "percent") return percent(n);
        if (def.kind === "number") return numberFormat(n, 0);
        return currency(n);
    }

    function showStatus(message, isError) {
        if (!el.status) return;
        if (!message) {
            el.status.hidden = true;
            el.status.classList.remove("is-error");
            text(el.status, "");
            return;
        }
        text(el.status, message);
        el.status.classList.toggle("is-error", Boolean(isError));
        el.status.hidden = false;
    }

    function toast(message, isError) {
        if (!el.toast) return;
        text(el.toast, message);
        el.toast.classList.toggle("is-error", Boolean(isError));
        el.toast.classList.add("is-visible");
        window.clearTimeout(toast.timer);
        toast.timer = window.setTimeout(() => el.toast && el.toast.classList.remove("is-visible"), 3200);
    }

    function showLoading(show) {
        state.loading = Boolean(show);
        if (el.loading) {
            el.loading.classList.toggle("is-visible", state.loading);
            el.loading.setAttribute("aria-hidden", state.loading ? "false" : "true");
        }
        if (el.refresh) el.refresh.disabled = state.loading;
    }

    function calendarMonths() {
        return state.raw && state.raw.calendario && Array.isArray(state.raw.calendario.meses)
            ? state.raw.calendario.meses
            : [];
    }

    function monthInfo(key) {
        return calendarMonths().find((item) => item.chave === key) || null;
    }

    function monthLabel(key) {
        const info = monthInfo(key);
        return info ? info.rotulo : key || "—";
    }

    function todayIso() {
        return state.raw && state.raw.hoje ? String(state.raw.hoje.data || "") : "";
    }

    function currentMonthKey() {
        return state.raw && state.raw.hoje ? String(state.raw.hoje.ano_mes || "") : "";
    }

    function periodStart() {
        return state.raw && state.raw.periodo ? String(state.raw.periodo.data_inicio || "") : "";
    }

    function periodEnd() {
        return state.raw && state.raw.periodo ? String(state.raw.periodo.data_fim || "") : "";
    }

    function monthEffectiveEnd(month) {
        const end = periodEnd();
        return end && end < month.ultimo_dia && end >= month.primeiro_dia ? end : month.ultimo_dia;
    }

    function monthsInScope() {
        return calendarMonths().filter((month) => {
            if (state.filters.dateStart && month.ultimo_dia < state.filters.dateStart) return false;
            if (state.filters.dateEnd && month.primeiro_dia > state.filters.dateEnd) return false;
            return true;
        });
    }

    function dimensionMatch(item, key, field) {
        const selected = state.filters[key];
        if (!selected) return true;
        return normalize(item[field]) === normalize(selected);
    }

    function matchesDimensions(item) {
        return dimensionMatch(item, "tipo_carteira", "tipo_carteira")
            && dimensionMatch(item, "producao_carteira", "producao_carteira")
            && dimensionMatch(item, "digital", "digital")
            && dimensionMatch(item, "empresa", "empresa")
            && dimensionMatch(item, "carteira", "carteira")
            && dimensionMatch(item, "atuacao_carteira", "atuacao_carteira")
            && dimensionMatch(item, "superintendente", "superintendente")
            && dimensionMatch(item, "gerente", "gerente")
            && dimensionMatch(item, "coordenador", "coordenador");
    }

    function recordMatches(item) {
        if (!matchesDimensions(item)) return false;
        if (state.filters.dateStart && item.data < state.filters.dateStart) return false;
        if (state.filters.dateEnd && item.data > state.filters.dateEnd) return false;
        return true;
    }

    function metaMatches(item) {
        if (!matchesDimensions(item)) return false;
        const month = monthInfo(item.mes);
        if (!month) return false;
        if (state.filters.dateStart && month.ultimo_dia < state.filters.dateStart) return false;
        if (state.filters.dateEnd && month.primeiro_dia > state.filters.dateEnd) return false;
        return true;
    }

    function matchesDimensionsExcept(
        item,
        excludedKey
    ) {
        const dimensions = [
            ["tipo_carteira", "tipo_carteira"],
            ["producao_carteira", "producao_carteira"],
            ["digital", "digital"],
            ["empresa", "empresa"],
            ["carteira", "carteira"],
            ["atuacao_carteira", "atuacao_carteira"],
            ["superintendente", "superintendente"],
            ["gerente", "gerente"],
            ["coordenador", "coordenador"]
        ];

        return dimensions.every(
            ([key, field]) =>
                key === excludedKey ||
                dimensionMatch(
                    item,
                    key,
                    field
                )
        );
    }

    function compositionRecordMatches(
        item,
        excludedKey
    ) {
        if (
            !matchesDimensionsExcept(
                item,
                excludedKey
            )
        ) {
            return false;
        }

        const range = currentFocusRange();

        if (
            range.start &&
            item.data < range.start
        ) {
            return false;
        }

        if (
            range.end &&
            item.data > range.end
        ) {
            return false;
        }

        return true;
    }

    function compositionMetaMatches(
        item,
        excludedKey
    ) {
        if (
            !matchesDimensionsExcept(
                item,
                excludedKey
            )
        ) {
            return false;
        }

        const month = monthInfo(item.mes);
        if (!month) return false;

        const range = currentFocusRange();

        if (
            range.start &&
            month.ultimo_dia <
                range.start
        ) {
            return false;
        }

        if (
            range.end &&
            month.primeiro_dia >
                range.end
        ) {
            return false;
        }

        return true;
    }

    function compositionScopedRecords(
        excludedKey
    ) {
        return state.records.filter(
            (item) =>
                compositionRecordMatches(
                    item,
                    excludedKey
                )
        );
    }

    function compositionScopedMetas(
        excludedKey
    ) {
        return state.metas.filter(
            (item) =>
                compositionMetaMatches(
                    item,
                    excludedKey
                )
        );
    }

    function dimensionUniverseRecords() {
        return state.records.filter(matchesDimensions);
    }

    function dimensionUniverseMetas() {
        return state.metas.filter(matchesDimensions);
    }

    function aggregate(records, metas) {
        const walletIds = new Set();
        records.forEach((item) => walletIds.add(String(item.carteira_id)));
        metas.forEach((item) => walletIds.add(String(item.carteira_id)));

        const result = {
            quantidade_base: 0,
            valor_carteira: 0,
            producao_realizada: 0,
            pagamento: 0,
            entrega_amigavel: 0,
            valor_ho: 0,
            meta: 0,
            qtde_carteiras: walletIds.size,
            icm: 0
        };

        records.forEach((item) => {
            result.quantidade_base += num(item.quantidade_base);
            result.valor_carteira += num(item.valor_carteira);
            result.producao_realizada += num(item.producao_realizada);
            result.pagamento += num(item.pagamento);
            result.entrega_amigavel += num(item.entrega_amigavel);
            result.valor_ho += num(item.valor_ho);
        });
        metas.forEach((item) => { result.meta += num(item.meta); });
        result.icm = result.meta > 0 ? (result.valor_ho / result.meta) * 100 : 0;
        return result;
    }

    function monthlySeries() {
        return monthsInScope().map((month) => {
            const records = state.filteredRecords.filter((item) => item.mes === month.chave);
            const metas = state.filteredMetas.filter((item) => item.mes === month.chave);
            return Object.assign({ mes: month.chave, rotulo: month.rotulo }, aggregate(records, metas));
        });
    }

    function populateSelect(control, items, placeholder) {
        if (!control) return;
        const current = control.value;
        const options = ['<option value="">' + escapeHtml(placeholder) + '</option>'];
        (items || []).forEach((item) => options.push('<option value="' + escapeHtml(item) + '">' + escapeHtml(item) + '</option>'));
        html(control, options.join(""));
        if ((items || []).includes(current)) value(control, current);
    }

    function distinctWalletCount(
        key,
        field,
        fieldValue
    ) {
        const ids = new Set();

        const addMatching = (items) => {
            items.forEach((item) => {
                if (
                    !fieldValue ||
                    normalize(item[field]) ===
                        normalize(fieldValue)
                ) {
                    ids.add(
                        String(item.carteira_id)
                    );
                }
            });
        };

        addMatching(
            compositionScopedRecords(key)
        );

        addMatching(
            compositionScopedMetas(key)
        );

        return ids.size;
    }

    function renderChoiceBlocks(
        container,
        key,
        field,
        items,
        allLabel
    ) {
        if (!container) return;

        const selected =
            state.filters[key] || "";

        const rows = [];

        rows.push(
            '<button type="button" class="metas-choice' +
                (!selected ? ' is-active' : '') +
                '" data-dimension-key="' +
                key +
                '" data-dimension-value="">' +
                '<span class="metas-choice-check"><i class="fa ' +
                    (!selected ? 'fa-check' : 'fa-circle-o') +
                '"></i></span>' +
                '<span><strong>' +
                    escapeHtml(allLabel) +
                '</strong><small>' +
                    numberFormat(
                        distinctWalletCount(
                            key,
                            field,
                            ""
                        )
                    ) +
                    ' carteiras</small></span>' +
            '</button>'
        );

        (items || []).forEach((item) => {
            const active =
                normalize(selected) ===
                normalize(item);

            rows.push(
                '<button type="button" class="metas-choice' +
                    (active ? ' is-active' : '') +
                    '" data-dimension-key="' +
                    key +
                    '" data-dimension-value="' +
                    escapeHtml(item) +
                    '">' +
                    '<span class="metas-choice-check"><i class="fa ' +
                        (active ? 'fa-check' : 'fa-circle-o') +
                    '"></i></span>' +
                    '<span><strong>' +
                        escapeHtml(
                            dimensionDisplayLabel(
                                key,
                                item
                            )
                        ) +
                    '</strong><small>' +
                        numberFormat(
                            distinctWalletCount(
                                key,
                                field,
                                item
                            )
                        ) +
                        ' carteiras</small></span>' +
                '</button>'
            );
        });

        html(
            container,
            rows.join("")
        );
    }

    function renderDimensionBlocks() {
        const options = state.raw && state.raw.opcoes ? state.raw.opcoes : {};
        renderChoiceBlocks(el.walletTypeBlocks, "tipo_carteira", "tipo_carteira", options.tipos_carteira || [], "Todos");
        renderChoiceBlocks(el.productionTypeBlocks, "producao_carteira", "producao_carteira", options.producoes_carteira || [], "Todas");
        renderChoiceBlocks(el.digitalBlocks, "digital", "digital", options.digitais || [], "Todos");
    }

    function populateControls(preserve) {
        const options = state.raw.opcoes || {};
        const old = preserve ? Object.assign({}, state.filters) : null;

        populateSelect(el.company, options.empresas || [], "Todas");
        populateSelect(el.wallet, options.carteiras || [], "Todas");

        const expectedActuations = [
            "Massivo",
            "Educacional",
            "Garantia",
            "Juridico"
        ];

        const actuationOptions = Array.from(
            new Set(
                expectedActuations.concat(
                    options.atuacoes_carteira || []
                )
            )
        );

        populateSelect(
            el.actuation,
            actuationOptions,
            "Todas"
        );

        populateSelect(el.superintendent, options.superintendentes || [], "Todos");
        populateSelect(el.manager, options.gerentes || [], "Todos");
        populateSelect(el.coordinator, options.coordenadores || [], "Todos");

        if (!preserve) {
            applyDashboardDefaults();
        } else if (old) {
            state.filters = Object.assign(
                state.filters,
                old
            );
        }

        value(el.dateStart, state.filters.dateStart);
        value(el.dateEnd, state.filters.dateEnd);
        if (el.dateStart) { el.dateStart.min = periodStart(); el.dateStart.max = periodEnd(); }
        if (el.dateEnd) { el.dateEnd.min = periodStart(); el.dateEnd.max = periodEnd(); }

        value(el.company, state.filters.empresa);
        value(el.wallet, state.filters.carteira);
        value(el.actuation, state.filters.atuacao_carteira);
        value(el.superintendent, state.filters.superintendente);
        value(el.manager, state.filters.gerente);
        value(el.coordinator, state.filters.coordenador);

        renderMonthButtons();
        renderDimensionBlocks();
        populateDailyMonths();
    }

    function renderMonthButtons() {
        if (!el.monthButtons) return;
        const rows = ['<button type="button" class="metas-month-pill" data-period-all="1"><i class="fa fa-calendar"></i> Todos</button>'];
        calendarMonths().forEach((month) => {
            rows.push('<button type="button" class="metas-month-pill" data-month="' + escapeHtml(month.chave) + '">' + escapeHtml(month.rotulo) + '</button>');
        });
        html(el.monthButtons, rows.join(""));
        syncMonthButtons();
    }

    function syncMonthButtons() {
        if (!el.monthButtons) return;
        const allButton = el.monthButtons.querySelector("[data-period-all]");
        if (allButton) allButton.classList.toggle("is-active", state.filters.dateStart === periodStart() && state.filters.dateEnd === periodEnd());

        el.monthButtons.querySelectorAll("[data-month]").forEach((button) => {
            const month = monthInfo(button.dataset.month);
            if (!month) return;
            const effectiveEnd = monthEffectiveEnd(month);
            button.classList.toggle("is-active", state.filters.dateStart === month.primeiro_dia && state.filters.dateEnd === effectiveEnd);
        });
    }

    function applyMonth(monthKey) {
        const month = monthInfo(monthKey);
        if (!month) return;

        const effectiveEnd =
            monthEffectiveEnd(month);

        const alreadySelected =
            state.periodUserSelected &&
            state.filters.dateStart ===
                month.primeiro_dia &&
            state.filters.dateEnd ===
                effectiveEnd;

        if (alreadySelected) {
            state.filters.dateStart =
                periodStart();

            state.filters.dateEnd =
                periodEnd();

            state.periodUserSelected =
                false;
        } else {
            state.filters.dateStart =
                month.primeiro_dia;

            state.filters.dateEnd =
                effectiveEnd;

            state.periodUserSelected =
                true;
        }

        value(
            el.dateStart,
            state.filters.dateStart
        );

        value(
            el.dateEnd,
            state.filters.dateEnd
        );

        applyFilters(false);
    }

    function readAdvancedControls() {
        state.filters.dateStart = el.dateStart ? el.dateStart.value : state.filters.dateStart;
        state.filters.dateEnd = el.dateEnd ? el.dateEnd.value : state.filters.dateEnd;
        state.filters.empresa = el.company ? el.company.value : "";
        state.filters.carteira = el.wallet ? el.wallet.value : "";
        state.filters.atuacao_carteira = el.actuation ? el.actuation.value : "";
        state.filters.superintendente = el.superintendent ? el.superintendent.value : "";
        state.filters.gerente = el.manager ? el.manager.value : "";
        state.filters.coordenador = el.coordinator ? el.coordinator.value : "";
    }

    function applyFilters(readControls) {
        if (readControls !== false) readAdvancedControls();
        state.filteredRecords = state.records.filter(recordMatches);
        state.filteredMetas = state.metas.filter(metaMatches);
        state.analytic.page = 1;
        syncMonthButtons();
        renderDimensionBlocks();
        renderPeriodStatus();
        renderActiveFilters();
        populateDailyMonths(true);
        renderAll();
    }

    function renderPeriodStatus() {
        if (!el.periodStatus) return;

        if (!state.periodUserSelected) {
            text(
                el.periodStatus,
                "Comparativos: todos os meses"
            );
            return;
        }

        const months = monthsInScope();

        if (months.length === 1) {
            text(
                el.periodStatus,
                "Período selecionado: " +
                    months[0].rotulo
            );
        } else if (months.length > 1) {
            text(
                el.periodStatus,
                "Período selecionado: " +
                    months[0].rotulo +
                    " → " +
                    months[
                        months.length - 1
                    ].rotulo
            );
        } else {
            text(
                el.periodStatus,
                "Intervalo personalizado"
            );
        }
    }

    function renderActiveFilters() {
        if (!el.activeFilters) return;
        const labels = {
            tipo_carteira: "Tipo",
            producao_carteira: "Produção carteira",
            digital: "Perfil",
            empresa: "Empresa",
            carteira: "Carteira",
            atuacao_carteira: "Atuação",
            superintendente: "Superintendente",
            gerente: "Gerente",
            coordenador: "Coordenador"
        };
        const rows = [];
        Object.keys(labels).forEach((key) => {
            if (state.filters[key]) {
                const shownValue =
                    dimensionDisplayLabel(
                        key,
                        state.filters[key]
                    );

                rows.push(
                    '<button type="button" class="metas-filter-chip" data-clear-filter="' +
                    key +
                    '">' +
                    escapeHtml(
                        labels[key] +
                        ': ' +
                        shownValue
                    ) +
                    ' <i class="fa fa-times"></i></button>'
                );
            }
        });
        html(el.activeFilters, rows.join(""));
    }

    function monthlyComparisonRows() {
        return monthlySeries().map((row) => {
            const produzido = num(row.producao_realizada);
            const pago = num(row.pagamento);
            const quebra = produzido - pago;
            const eficiencia = produzido !== 0
                ? (pago / produzido) * 100
                : 0;
            const quebraPercentual = produzido !== 0
                ? (quebra / produzido) * 100
                : 0;
            const meta = num(row.meta);
            const ho = num(row.valor_ho);
            const icm = meta !== 0
                ? (ho / meta) * 100
                : 0;

            return {
                mes: row.mes,
                rotulo: row.rotulo,
                quantidade_base: num(row.quantidade_base),
                valor_carteira: num(row.valor_carteira),
                pagamento: pago,
                quebra,
                eficiencia,
                quebra_percentual: quebraPercentual,
                meta,
                valor_ho: ho,
                icm,
                entrega_amigavel: num(row.entrega_amigavel)
            };
        });
    }

    function monthlyAbsoluteVariation(currentValue, previousValue) {
        const current = num(currentValue);
        const previous = num(previousValue);

        if (previous === 0) {
            return {
                available: false,
                value: null,
                label: "M/M —"
            };
        }

        const variation = ((current - previous) / Math.abs(previous)) * 100;

        return {
            available: true,
            value: variation,
            label: "M/M " + (variation > 0 ? "+" : "") + percent(variation)
        };
    }

    function monthlyPointVariation(currentValue, previousValue) {
        const current = num(currentValue);
        const previous = num(previousValue);
        const variation = current - previous;

        return {
            available: true,
            value: variation,
            label: "M/M " +
                (variation > 0 ? "+" : "") +
                numberFormat(variation, 2) +
                " p.p."
        };
    }

    function monthlyComparisonFormat(valueToFormat, type) {
        if (type === "currency") return currency(valueToFormat);
        if (type === "percent") return percent(valueToFormat);
        return numberFormat(valueToFormat, 0);
    }

    function monthlyAnalysisClass(variation, direction) {
        if (!variation || !variation.available || variation.value === null) {
            return "";
        }

        const value = num(variation.value);

        if (value === 0) {
            return "is-flat";
        }

        // Para Quebra e Quebra %, reduzir é favorável.
        if (direction === "lower") {
            return value < 0 ? "is-positive" : "is-negative";
        }

        // Para os demais indicadores, crescimento é tratado como positivo
        // e redução como negativa, seguindo o padrão visual do comparativo.
        return value > 0 ? "is-positive" : "is-negative";
    }

    function monthlyAnalysisText(definition, row, previousRow, variation) {
        const currentFormatted = monthlyComparisonFormat(
            row[definition.field],
            definition.type
        );

        if (!previousRow) {
            return (
                definition.formula +
                " | " +
                monthLabel(row.mes) +
                ": " +
                currentFormatted +
                " | Primeiro mês do período, sem comparação M/M."
            );
        }

        const previousFormatted = monthlyComparisonFormat(
            previousRow[definition.field],
            definition.type
        );

        let leitura = "Sem variação.";

        if (!variation.available) {
            leitura = (
                "O mês anterior é zero; a variação percentual M/M não é calculada."
            );
        } else if (variation.value > 0) {
            leitura = definition.direction === "lower"
                ? "Aumento desfavorável para este indicador."
                : "Crescimento em relação ao mês anterior.";
        } else if (variation.value < 0) {
            leitura = definition.direction === "lower"
                ? "Redução favorável para este indicador."
                : "Redução em relação ao mês anterior.";
        }

        return (
            definition.formula +
            " | Atual: " +
            currentFormatted +
            " | " +
            monthLabel(previousRow.mes) +
            ": " +
            previousFormatted +
            " | " +
            variation.label +
            " | " +
            leitura
        );
    }

    function monthlyComparisonStats(rows, field) {
        const values = (rows || [])
            .map((row) => num(row[field]))
            .filter((value) => Number.isFinite(value));

        if (!values.length) {
            return { min: 0, max: 0, avg: 0 };
        }

        return {
            min: Math.min.apply(null, values),
            max: Math.max.apply(null, values),
            avg: values.reduce((sum, value) => sum + value, 0) / values.length
        };
    }

    function monthlyTooltipTone(className) {
        if (className === "is-positive") return "best";
        if (className === "is-negative") return "low";
        return "neutral";
    }

    function monthlyTooltipStatus(className, variation, definition) {
        if (!variation || !variation.available) {
            return "Sem base M/M para comparação";
        }
        if (num(variation.value) === 0) {
            return "Estável em relação ao mês anterior";
        }
        if (className === "is-positive") {
            return definition.direction === "lower"
                ? "Evolução favorável: redução do indicador"
                : "Evolução favorável no mês";
        }
        if (className === "is-negative") {
            return definition.direction === "lower"
                ? "Ponto de atenção: aumento do indicador"
                : "Ponto de atenção: redução no mês";
        }
        return "Leitura intermediária";
    }

    function monthlyTooltipContent(definition, row, previousRow, variation, className, stats) {
        const currentValue = num(row[definition.field]);
        const currentFormatted = monthlyComparisonFormat(currentValue, definition.type);
        const previousFormatted = previousRow
            ? monthlyComparisonFormat(previousRow[definition.field], definition.type)
            : "—";
        const averageFormatted = monthlyComparisonFormat(stats.avg, definition.type);
        const minFormatted = monthlyComparisonFormat(stats.min, definition.type);
        const maxFormatted = monthlyComparisonFormat(stats.max, definition.type);

        const deltaAverage = currentValue - stats.avg;
        let deltaAverageFormatted = "";

        if (definition.type === "currency") {
            deltaAverageFormatted = signedCurrency(deltaAverage);
        } else if (definition.type === "percent") {
            deltaAverageFormatted =
                (deltaAverage > 0 ? "+" : "") +
                numberFormat(deltaAverage, 2) +
                " p.p.";
        } else {
            deltaAverageFormatted =
                (deltaAverage > 0 ? "+" : "") +
                numberFormat(deltaAverage, 0);
        }

        const tone = monthlyTooltipTone(className);
        const status = monthlyTooltipStatus(className, variation, definition);

        return '' +
            '<div class="metas-du-tooltip-head">' +
                '<span>' + escapeHtml(row.rotulo) + '</span>' +
                '<strong>' + escapeHtml(definition.label) + '</strong>' +
            '</div>' +
            '<div class="metas-du-tooltip-value">' + escapeHtml(currentFormatted) + '</div>' +
            '<div class="metas-du-tooltip-badge is-' + tone + '">' +
                escapeHtml(status) +
            '</div>' +
            '<div class="metas-du-tooltip-grid">' +
                '<span><small>Mês anterior</small><strong>' + escapeHtml(previousFormatted) + '</strong></span>' +
                '<span><small>Variação M/M</small><strong>' +
                    escapeHtml(variation && variation.label ? variation.label : "M/M —") +
                '</strong></span>' +
                '<span><small>Média do período</small><strong>' + escapeHtml(averageFormatted) + '</strong></span>' +
                '<span><small>Dif. da média</small><strong>' + escapeHtml(deltaAverageFormatted) + '</strong></span>' +
            '</div>' +
            '<div class="metas-du-tooltip-range">Faixa no período: <strong>' +
                escapeHtml(minFormatted) +
                '</strong> → <strong>' +
                escapeHtml(maxFormatted) +
                '</strong></div>' +
            '<p class="metas-du-tooltip-note"><strong>Regra:</strong> ' +
                escapeHtml(definition.formula) +
            '</p>';
    }

    function monthlyComparisonCell(row, previousRow, definition, stats) {
        const currentValue = num(row[definition.field]);

        let variation = {
            available: false,
            value: null,
            label: "M/M —"
        };

        if (previousRow) {
            variation = definition.variation === "points"
                ? monthlyPointVariation(
                    currentValue,
                    previousRow[definition.field]
                )
                : monthlyAbsoluteVariation(
                    currentValue,
                    previousRow[definition.field]
                );
        }

        const className = monthlyAnalysisClass(
            variation,
            definition.direction
        );

        const tooltip = monthlyTooltipContent(
            definition,
            row,
            previousRow,
            variation,
            className,
            stats
        );

        return '' +
            '<td class="metas-monthly-value-cell ' +
                className +
                '" data-du-tip="' +
                duTooltipAttribute(tooltip) +
                '">' +
                '<strong>' +
                    monthlyComparisonFormat(
                        currentValue,
                        definition.type
                    ) +
                '</strong>' +
                '<small>' +
                    escapeHtml(variation.label) +
                '</small>' +
            '</td>';
    }

    function renderMonthlyComparison() {
        if (!el.monthlyComparisonHead || !el.monthlyComparisonBody) {
            return;
        }

        const rows = monthlyComparisonRows();

        html(
            el.monthlyComparisonHead,
            '<tr>' +
                '<th class="metas-monthly-indicator-head">Indicador</th>' +
                rows.map((row) =>
                    '<th class="metas-monthly-month-head">' +
                        escapeHtml(row.rotulo) +
                    '</th>'
                ).join("") +
            '</tr>'
        );

        const definitions = [
            {
                label: "Total Qtde Base",
                field: "quantidade_base",
                type: "number",
                variation: "percent",
                direction: "higher",
                formula: "Soma de quantidade_base"
            },
            {
                label: "Total Valor da Carteira",
                field: "valor_carteira",
                type: "currency",
                variation: "percent",
                direction: "higher",
                formula: "Soma de valor_carteira"
            },
            {
                label: "Total Pago",
                field: "pagamento",
                type: "currency",
                variation: "percent",
                direction: "higher",
                formula: "Soma de pagamento"
            },
            {
                label: "Quebra",
                field: "quebra",
                type: "currency",
                variation: "percent",
                direction: "lower",
                formula: "Produção realizada − Total Pago"
            },
            {
                label: "Eficiência %",
                field: "eficiencia",
                type: "percent",
                variation: "points",
                direction: "higher",
                formula: "Total Pago ÷ Produção realizada × 100"
            },
            {
                label: "Quebra %",
                field: "quebra_percentual",
                type: "percent",
                variation: "points",
                direction: "lower",
                formula: "Quebra ÷ Produção realizada × 100"
            },
            {
                label: "Meta",
                field: "meta",
                type: "currency",
                variation: "percent",
                direction: "higher",
                formula: "Soma única da meta por carteira e competência"
            },
            {
                label: "Total HO",
                field: "valor_ho",
                type: "currency",
                variation: "percent",
                direction: "higher",
                formula: "Soma de valor_ho"
            },
            {
                label: "ICM %",
                field: "icm",
                type: "percent",
                variation: "points",
                direction: "higher",
                formula: "Total HO ÷ Meta × 100"
            },
            {
                label: "Entrega Amigável",
                field: "entrega_amigavel",
                type: "currency",
                variation: "percent",
                direction: "higher",
                formula: "Soma de entrega_amigavel"
            }
        ];

        html(
            el.monthlyComparisonBody,
            definitions.map((definition) => {
                let cells = "";
                const stats = monthlyComparisonStats(rows, definition.field);

                rows.forEach((row, index) => {
                    const previousRow = index > 0
                        ? rows[index - 1]
                        : null;

                    cells += monthlyComparisonCell(
                        row,
                        previousRow,
                        definition,
                        stats
                    );
                });

                return '' +
                    '<tr>' +
                        '<td class="metas-monthly-indicator-cell" title="' +
                            escapeHtml(definition.formula) +
                            '">' +
                            '<strong>' +
                                escapeHtml(definition.label) +
                            '</strong>' +
                            '<small>' +
                                escapeHtml(definition.formula) +
                            '</small>' +
                        '</td>' +
                        cells +
                    '</tr>';
            }).join("") ||
            '<tr><td class="metas-empty">Sem meses no recorte.</td></tr>'
        );
    }

    function compositionPalette(index) {
        const palette = [
            COLORS.blue,
            COLORS.teal,
            COLORS.sky,
            COLORS.green,
            COLORS.amber,
            COLORS.blue2,
            COLORS.red,
            "#7567a8",
            "#5a7d6b",
            "#9b6b4b"
        ];

        return palette[
            index % palette.length
        ];
    }

    function compositionDimensionValues(
        key,
        field,
        configuredItems
    ) {
        const scopedRecords =
            compositionScopedRecords(key);

        const scopedMetas =
            compositionScopedMetas(key);

        const values = new Set(
            (configuredItems || [])
                .filter(Boolean)
        );

        scopedRecords.forEach((item) => {
            if (item[field]) {
                values.add(item[field]);
            }
        });

        scopedMetas.forEach((item) => {
            if (item[field]) {
                values.add(item[field]);
            }
        });

        return Array.from(values);
    }

    function compositionBreakdown(
        key,
        field,
        configuredItems
    ) {
        const scopedRecords =
            compositionScopedRecords(key);

        const scopedMetas =
            compositionScopedMetas(key);

        return compositionDimensionValues(
            key,
            field,
            configuredItems
        )
            .map((rawValue) => {
                const records =
                    scopedRecords.filter(
                        (item) =>
                            normalize(item[field]) ===
                            normalize(rawValue)
                    );

                const metas =
                    scopedMetas.filter(
                        (item) =>
                            normalize(item[field]) ===
                            normalize(rawValue)
                    );

                return Object.assign(
                    {
                        rawValue,
                        label:
                            dimensionDisplayLabel(
                                key,
                                rawValue
                            )
                    },
                    aggregate(records, metas)
                );
            })
            .filter((row) =>
                row.qtde_carteiras > 0 ||
                row.producao_realizada !== 0 ||
                row.pagamento !== 0 ||
                row.valor_ho !== 0 ||
                row.meta !== 0
            )
            .sort((a, b) =>
                b.qtde_carteiras -
                    a.qtde_carteiras ||
                normalize(a.label).localeCompare(
                    normalize(b.label)
                )
            );
    }

    function compositionLegendHtml(
        rows,
        key
    ) {
        if (!rows.length) {
            return (
                '<div class="metas-empty">' +
                    'Sem dados no recorte.' +
                '</div>'
            );
        }

        return rows.map((row, index) => {
            const active =
                normalize(state.filters[key]) ===
                normalize(row.rawValue);

            return (
                '<button type="button" ' +
                    'class="metas-composition-legend-row' +
                    (active ? ' is-active' : '') +
                    '" data-dimension-key="' +
                    key +
                    '" data-dimension-value="' +
                    escapeHtml(row.rawValue) +
                    '">' +
                    '<i class="metas-composition-dot" ' +
                        'style="background:' +
                        compositionPalette(index) +
                        '"></i>' +
                    '<span class="metas-composition-legend-copy">' +
                        '<strong>' +
                            escapeHtml(row.label) +
                        '</strong>' +
                        '<small>' +
                            numberFormat(
                                row.qtde_carteiras
                            ) +
                            ' carteira' +
                            (
                                row.qtde_carteiras === 1
                                    ? ''
                                    : 's'
                            ) +
                        '</small>' +
                        '<em>' +
                            'Prod. ' +
                            compactCurrency(
                                row.producao_realizada
                            ) +
                            ' • Pago ' +
                            compactCurrency(
                                row.pagamento
                            ) +
                            ' • HO ' +
                            compactCurrency(
                                row.valor_ho
                            ) +
                        '</em>' +
                    '</span>' +
                '</button>'
            );
        }).join("");
    }

    function actuationGroupName(rawValue) {
        const normalized =
            normalize(rawValue);

        if (
            normalized === "MASSIVO" ||
            normalized === "EDUCACIONAL"
        ) {
            return "Massivo + Educacional";
        }

        if (
            normalized === "GARANTIA" ||
            normalized === "JURIDICO"
        ) {
            return "Garantia + Jurídico";
        }

        return "Outras atuações";
    }

    function actuationGroupTotals(rows) {
        const groups = {
            volume: {
                label: "Massivo + Educacional",
                qtde_carteiras: 0,
                producao_realizada: 0,
                pagamento: 0,
                valor_ho: 0
            },
            specialized: {
                label: "Garantia + Jurídico",
                qtde_carteiras: 0,
                producao_realizada: 0,
                pagamento: 0,
                valor_ho: 0
            },
            others: {
                label: "Outras atuações",
                qtde_carteiras: 0,
                producao_realizada: 0,
                pagamento: 0,
                valor_ho: 0
            }
        };

        (rows || []).forEach((row) => {
            const groupName =
                actuationGroupName(
                    row.rawValue
                );

            let bucket = groups.others;

            if (
                groupName ===
                "Massivo + Educacional"
            ) {
                bucket = groups.volume;
            } else if (
                groupName ===
                "Garantia + Jurídico"
            ) {
                bucket = groups.specialized;
            }

            bucket.qtde_carteiras +=
                num(row.qtde_carteiras);

            bucket.producao_realizada +=
                num(row.producao_realizada);

            bucket.pagamento +=
                num(row.pagamento);

            bucket.valor_ho +=
                num(row.valor_ho);
        });

        return groups;
    }


    function actuationTooltipLines(
        row,
        rows
    ) {
        const groups =
            actuationGroupTotals(rows);

        const totalWallets =
            (rows || []).reduce(
                (sum, item) =>
                    sum +
                    num(item.qtde_carteiras),
                0
            );

        const share =
            totalWallets > 0
                ? (
                    num(row.qtde_carteiras) /
                    totalWallets
                ) * 100
                : 0;

        const groupName =
            actuationGroupName(
                row.rawValue
            );

        let group =
            groups.others;

        if (
            groupName ===
            "Massivo + Educacional"
        ) {
            group = groups.volume;
        } else if (
            groupName ===
            "Garantia + Jurídico"
        ) {
            group = groups.specialized;
        }

        return [
            row.label +
                ": " +
                numberFormat(
                    row.qtde_carteiras
                ) +
                " carteira" +
                (
                    row.qtde_carteiras === 1
                        ? ""
                        : "s"
                ),
            "Participação: " +
                percent(share),
            "Grupo: " +
                groupName,
            "Produção: " +
                currency(
                    row.producao_realizada
                ),
            "Pagamento: " +
                currency(
                    row.pagamento
                ),
            "HO: " +
                currency(
                    row.valor_ho
                ),
            group.label +
                ": " +
                numberFormat(
                    group.qtde_carteiras
                ) +
                " carteiras | HO " +
                compactCurrency(
                    group.valor_ho
                ),
            "Massivo + Educacional x Garantia + Jurídico: " +
                numberFormat(
                    groups.volume
                        .qtde_carteiras
                ) +
                " x " +
                numberFormat(
                    groups.specialized
                        .qtde_carteiras
                )
        ];
    }

    function renderCompositionChart(
        chartKey,
        canvas,
        center,
        legend,
        dimensionKey,
        rows
    ) {
        destroyChart(chartKey);

        const totalWallets =
            rows.reduce(
                (sum, row) =>
                    sum +
                    num(row.qtde_carteiras),
                0
            );

        html(
            center,
            '<strong>' +
                numberFormat(totalWallets) +
            '</strong>' +
            '<span>carteiras</span>'
        );

        html(
            legend,
            compositionLegendHtml(
                rows,
                dimensionKey
            )
        );

        if (
            !canvas ||
            !window.Chart ||
            !rows.length
        ) {
            return;
        }

        const activeValue =
            state.filters[dimensionKey];

        const colors = rows.map(
            (_, index) =>
                compositionPalette(index)
        );

        const offsets = rows.map(
            (row) =>
                activeValue &&
                normalize(activeValue) ===
                    normalize(row.rawValue)
                    ? 7
                    : 0
        );

        state.charts[chartKey] =
            new Chart(
                canvas,
                {
                    type: "doughnut",
                    data: {
                        labels: rows.map(
                            (row) => row.label
                        ),
                        datasets: [{
                            data: rows.map(
                                (row) =>
                                    row.qtde_carteiras
                            ),
                            backgroundColor: colors,
                            borderColor:
                                document.documentElement
                                    .dataset.theme ===
                                "dark"
                                    ? "#18273d"
                                    : "#ffffff",
                            borderWidth: 2,
                            hoverOffset: 7,
                            offset: offsets
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: "70%",
                        plugins: {
                            legend: {
                                display: false
                            },
                            tooltip: {
                                callbacks: {
                                    label: (ctx) => {
                                        const row =
                                            rows[
                                                ctx.dataIndex
                                            ];

                                        if (
                                            dimensionKey ===
                                            "atuacao_carteira"
                                        ) {
                                            return (
                                                actuationTooltipLines(
                                                    row,
                                                    rows
                                                )
                                            );
                                        }

                                        return [
                                            row.label +
                                                ": " +
                                                numberFormat(
                                                    row.qtde_carteiras
                                                ) +
                                                " carteira" +
                                                (
                                                    row.qtde_carteiras ===
                                                    1
                                                        ? ""
                                                        : "s"
                                                ),
                                            "Produção: " +
                                                currency(
                                                    row.producao_realizada
                                                ),
                                            "Pagamento: " +
                                                currency(
                                                    row.pagamento
                                                ),
                                            "HO: " +
                                                currency(
                                                    row.valor_ho
                                                )
                                        ];
                                    }
                                }
                            }
                        },
                        onClick: (_, points) => {
                            if (
                                !points ||
                                !points.length
                            ) {
                                return;
                            }

                            const selected =
                                rows[
                                    points[0].index
                                ];

                            if (!selected) return;

                            state.filters[
                                dimensionKey
                            ] =
                                normalize(
                                    state.filters[
                                        dimensionKey
                                    ]
                                ) ===
                                normalize(
                                    selected.rawValue
                                )
                                    ? ""
                                    : selected.rawValue;

                            applyFilters(false);
                        }
                    }
                }
            );
    }

    function renderCompositionVisuals() {
        const options =
            state.raw &&
            state.raw.opcoes
                ? state.raw.opcoes
                : {};

        const walletTypes =
            compositionBreakdown(
                "tipo_carteira",
                "tipo_carteira",
                options.tipos_carteira || []
            );

        const productionTypes =
            compositionBreakdown(
                "producao_carteira",
                "producao_carteira",
                options.producoes_carteira || []
            );

        const digitalProfiles =
            compositionBreakdown(
                "digital",
                "digital",
                options.digitais || []
            );

        const expectedActuations = [
            "Massivo",
            "Educacional",
            "Garantia",
            "Juridico"
        ];

        const actuationProfiles =
            compositionBreakdown(
                "atuacao_carteira",
                "atuacao_carteira",
                expectedActuations.concat(
                    options.atuacoes_carteira ||
                    []
                )
            );

        renderCompositionChart(
            "walletTypeDonut",
            el.walletTypeDonut,
            el.walletTypeCenter,
            el.walletTypeLegend,
            "tipo_carteira",
            walletTypes
        );

        renderCompositionChart(
            "productionTypeDonut",
            el.productionTypeDonut,
            el.productionTypeCenter,
            el.productionTypeLegend,
            "producao_carteira",
            productionTypes
        );

        renderCompositionChart(
            "digitalDonut",
            el.digitalDonut,
            el.digitalCenter,
            el.digitalLegend,
            "digital",
            digitalProfiles
        );

        renderCompositionChart(
            "actuationDonut",
            el.actuationDonut,
            el.actuationCenter,
            el.actuationLegend,
            "atuacao_carteira",
            actuationProfiles
        );

    }

    function kpiFocusMonthContext() {
        const range =
            currentFocusRange();

        const focusMonths =
            calendarMonths().filter(
                (month) => {
                    if (
                        range.start &&
                        month.ultimo_dia <
                            range.start
                    ) {
                        return false;
                    }

                    if (
                        range.end &&
                        month.primeiro_dia >
                            range.end
                    ) {
                        return false;
                    }

                    return true;
                }
            );

        if (focusMonths.length !== 1) {
            return null;
        }

        const currentMonth =
            focusMonths[0];

        const allMonths =
            calendarMonths();

        const currentIndex =
            allMonths.findIndex(
                (month) =>
                    month.chave ===
                    currentMonth.chave
            );

        const previousMonth =
            currentIndex > 0
                ? allMonths[
                    currentIndex - 1
                ]
                : null;

        if (!previousMonth) {
            return {
                currentMonth,
                previousMonth: null,
                previousMetrics: null
            };
        }

        const previousRecords =
            state.records.filter(
                (item) =>
                    matchesDimensions(item) &&
                    item.mes ===
                        previousMonth.chave
            );

        const previousMetas =
            state.metas.filter(
                (item) =>
                    matchesDimensions(item) &&
                    item.mes ===
                        previousMonth.chave
            );

        return {
            currentMonth,
            previousMonth,
            previousMetrics:
                aggregate(
                    previousRecords,
                    previousMetas
                )
        };
    }

    function kpiVariation(
        metric,
        currentValue,
        context
    ) {
        if (
            !context ||
            !context.previousMonth ||
            !context.previousMetrics
        ) {
            return {
                available: false,
                direction: "neutral",
                label: "M/M —",
                delta: 0,
                percentValue: null,
                previousValue: null
            };
        }

        const previousValue =
            num(
                context.previousMetrics[
                    metric
                ]
            );

        const current =
            num(currentValue);

        const delta =
            current - previousValue;

        if (
            metric === "icm" &&
            num(
                context.previousMetrics.meta
            ) <= 0
        ) {
            return {
                available: false,
                direction: "neutral",
                label: "M/M —",
                delta,
                percentValue: null,
                previousValue
            };
        }

        if (metric === "icm") {
            return {
                available: true,
                direction:
                    delta > 0
                        ? "positive"
                        : (
                            delta < 0
                                ? "negative"
                                : "neutral"
                        ),
                label:
                    (
                        delta > 0
                            ? "+"
                            : ""
                    ) +
                    numberFormat(
                        delta,
                        2
                    ) +
                    " p.p.",
                delta,
                percentValue: null,
                previousValue
            };
        }

        const percentValue =
            previousValue !== 0
                ? (
                    delta /
                    Math.abs(previousValue)
                ) * 100
                : null;

        let label = "M/M —";

        if (previousValue === 0) {
            if (current > 0) {
                label = "Novo movimento";
            } else if (current === 0) {
                label = "0,00%";
            }
        } else {
            label =
                (
                    percentValue > 0
                        ? "+"
                        : ""
                ) +
                percent(
                    percentValue
                );
        }

        return {
            available:
                previousValue !== 0 ||
                current === 0,
            direction:
                delta > 0
                    ? "positive"
                    : (
                        delta < 0
                            ? "negative"
                            : "neutral"
                    ),
            label,
            delta,
            percentValue,
            previousValue
        };
    }

    function kpiVariationClass(
        variation
    ) {
        if (
            variation.direction ===
            "positive"
        ) {
            return "is-positive";
        }

        if (
            variation.direction ===
            "negative"
        ) {
            return "is-negative";
        }

        return "is-neutral";
    }

    function kpiDifferenceLabel(
        metric,
        delta
    ) {
        if (metric === "icm") {
            return (
                (delta > 0 ? "+" : "") +
                numberFormat(
                    delta,
                    2
                ) +
                " p.p."
            );
        }

        if (
            METRICS[metric] &&
            METRICS[metric].kind ===
            "currency"
        ) {
            return signedCurrency(delta);
        }

        return (
            (delta > 0 ? "+" : "") +
            numberFormat(
                delta,
                0
            )
        );
    }

    function kpiIntelligentReading(
        metric,
        variation
    ) {
        if (
            !variation ||
            variation.previousValue == null
        ) {
            return (
                "Não existe mês anterior disponível no calendário para esta comparação."
            );
        }

        if (
            metric === "meta"
        ) {
            if (
                variation.direction ===
                "positive"
            ) {
                return (
                    "A Meta aumentou em relação ao mês anterior. " +
                    "Isso representa aumento de volume e não, isoladamente, melhora de performance."
                );
            }

            if (
                variation.direction ===
                "negative"
            ) {
                return (
                    "A Meta reduziu em relação ao mês anterior. " +
                    "Isso representa redução de volume e não, isoladamente, piora de performance."
                );
            }

            return (
                "A Meta permaneceu estável em relação ao mês anterior."
            );
        }

        if (
            metric ===
            "qtde_carteiras"
        ) {
            return (
                variation.direction ===
                "positive"
                    ? "A quantidade de carteiras aumentou no recorte. É uma variação de volume, não necessariamente de desempenho."
                    : (
                        variation.direction ===
                        "negative"
                            ? "A quantidade de carteiras reduziu no recorte. É uma variação de volume, não necessariamente de desempenho."
                            : "A quantidade de carteiras permaneceu estável."
                    )
            );
        }

        if (
            variation.direction ===
            "positive"
        ) {
            return (
                "O indicador evoluiu acima do mês anterior no mesmo recorte de filtros."
            );
        }

        if (
            variation.direction ===
            "negative"
        ) {
            return (
                "O indicador ficou abaixo do mês anterior no mesmo recorte de filtros e merece acompanhamento."
            );
        }

        return (
            "O indicador permaneceu estável em relação ao mês anterior."
        );
    }

    function kpiTooltipContent(
        metric,
        label,
        currentValue,
        context,
        variation
    ) {
        const currentMonthLabel =
            context &&
            context.currentMonth
                ? context.currentMonth.rotulo
                : currentFocusMonthLabel();

        const previousMonthLabel =
            context &&
            context.previousMonth
                ? context.previousMonth.rotulo
                : "—";

        const previousFormatted =
            variation.previousValue == null
                ? "—"
                : formatMetric(
                    variation.previousValue,
                    metric
                );

        const currentFormatted =
            formatMetric(
                currentValue,
                metric
            );

        const badgeTone =
            variation.direction ===
            "positive"
                ? "is-best"
                : (
                    variation.direction ===
                    "negative"
                        ? "is-low"
                        : "is-neutral"
                );

        const badgeLabel =
            variation.direction ===
            "positive"
                ? "Variação positiva"
                : (
                    variation.direction ===
                    "negative"
                        ? "Variação negativa"
                        : (
                            variation.previousValue ==
                            null
                                ? "Sem base M/M"
                                : "Estável"
                        )
                );

        return '' +
            '<div class="metas-du-tooltip-head">' +
                '<span>' +
                    escapeHtml(
                        currentMonthLabel
                    ) +
                '</span>' +
                '<strong>' +
                    escapeHtml(label) +
                '</strong>' +
            '</div>' +
            '<div class="metas-du-tooltip-value">' +
                escapeHtml(
                    currentFormatted
                ) +
            '</div>' +
            '<div class="metas-du-tooltip-badge ' +
                badgeTone +
                '">' +
                escapeHtml(
                    badgeLabel
                ) +
            '</div>' +
            '<div class="metas-du-tooltip-grid">' +
                '<span><small>Mês anterior</small><strong>' +
                    escapeHtml(
                        previousMonthLabel
                    ) +
                '</strong></span>' +
                '<span><small>Valor anterior</small><strong>' +
                    escapeHtml(
                        previousFormatted
                    ) +
                '</strong></span>' +
                '<span><small>Variação M/M</small><strong>' +
                    escapeHtml(
                        variation.label
                    ) +
                '</strong></span>' +
                '<span><small>Diferença</small><strong>' +
                    escapeHtml(
                        kpiDifferenceLabel(
                            metric,
                            variation.delta
                        )
                    ) +
                '</strong></span>' +
            '</div>' +
            '<p class="metas-du-tooltip-note">' +
                escapeHtml(
                    kpiIntelligentReading(
                        metric,
                        variation
                    )
                ) +
            '</p>';
    }

    function renderKpis() {
        if (!el.kpis) return;

        const metrics = aggregate(
            currentFocusRecords(),
            currentFocusMetas()
        );

        const focusLabel =
            currentFocusMonthLabel();

        const context =
            kpiFocusMonthContext();

        const cards = [
            ["producao_realizada", "Produção realizada", metrics.producao_realizada, focusLabel + " • Total produzido"],
            ["pagamento", "Pagamento", metrics.pagamento, focusLabel + " • Pagamento informado"],
            ["entrega_amigavel", "Entrega amigável", metrics.entrega_amigavel, focusLabel + " • Entrega acumulada"],
            ["meta", "Meta", metrics.meta, focusLabel + " • Única por carteira e competência"],
            ["valor_ho", "Total HO", metrics.valor_ho, focusLabel + " • Base do ICM"],
            ["icm", "ICM", metrics.icm, metrics.meta ? focusLabel + " • HO / Meta" : focusLabel + " • Sem meta"],
            ["qtde_carteiras", "Qtde carteiras", metrics.qtde_carteiras, focusLabel + " • Carteiras com dado"]
        ];

        html(
            el.kpis,
            cards.map((item) => {
                const metric =
                    item[0];

                const def =
                    METRICS[metric];

                /*
                 * Valores dos KPIs agora são exibidos de forma aberta,
                 * sem abreviação em mi/bi.
                 */
                const display =
                    formatMetric(
                        item[2],
                        metric
                    );

                const variation =
                    kpiVariation(
                        metric,
                        item[2],
                        context
                    );

                const variationClass =
                    kpiVariationClass(
                        variation
                    );

                const variationIcon =
                    variation.direction ===
                    "positive"
                        ? "fa-arrow-up"
                        : (
                            variation.direction ===
                            "negative"
                                ? "fa-arrow-down"
                                : "fa-minus"
                        );

                const tooltip =
                    kpiTooltipContent(
                        metric,
                        item[1],
                        item[2],
                        context,
                        variation
                    );

                return (
                    '<article class="metas-kpi ' +
                        variationClass +
                        '" data-du-tip="' +
                        duTooltipAttribute(
                            tooltip
                        ) +
                        '">' +
                        '<div class="metas-kpi-top">' +
                            '<span>' +
                                escapeHtml(
                                    item[1]
                                ) +
                            '</span>' +
                            '<i class="fa ' +
                                def.icon +
                            '"></i>' +
                        '</div>' +
                        '<strong class="metas-kpi-full-value">' +
                            escapeHtml(
                                display
                            ) +
                        '</strong>' +
                        '<div class="metas-kpi-variation ' +
                            variationClass +
                            '">' +
                            '<i class="fa ' +
                                variationIcon +
                            '"></i>' +
                            '<span>' +
                                escapeHtml(
                                    variation.label
                                ) +
                            '</span>' +
                            '<small>vs mês anterior</small>' +
                        '</div>' +
                        '<small class="metas-kpi-caption">' +
                            escapeHtml(
                                item[3]
                            ) +
                        '</small>' +
                    '</article>'
                );
            }).join("")
        );
    }

    function currentDuForMonth(monthKey) {
        const month = monthInfo(monthKey);
        if (!month) return 0;
        const current = currentMonthKey();
        if (!current || monthKey < current) return num(month.total_dias_uteis);
        if (monthKey > current) return 0;
        return (month.dias_uteis || []).reduce((max, day) => day.data <= todayIso() ? Math.max(max, num(day.dia_util_numero)) : max, 0);
    }

    function renderInsights() {
        if (!el.insights) return;
        const series = monthlySeries();
        const latest = series.length ? series[series.length - 1] : null;
        const previous = series.length > 1 ? series[series.length - 2] : null;
        const latestMonth = latest ? monthInfo(latest.mes) : null;
        const gap = latest ? Math.max(num(latest.meta) - num(latest.valor_ho), 0) : 0;
        const best = series.filter((row) => row.meta > 0).sort((a, b) => b.icm - a.icm)[0] || null;
        const currentDu = latest ? currentDuForMonth(latest.mes) : 0;
        const totalDu = latestMonth ? num(latestMonth.total_dias_uteis) : 0;
        const delta = latest && previous && previous.producao_realizada
            ? ((latest.producao_realizada - previous.producao_realizada) / Math.abs(previous.producao_realizada)) * 100
            : null;

        const cards = [
            ["fa-bullseye", gap > 0 ? "Gap para meta: " + compactCurrency(gap) : "Meta atingida no último mês", latest ? monthLabel(latest.mes) + " • ICM " + percent(latest.icm) : "Sem competência"],
            ["fa-calendar-check-o", latestMonth ? currentDu + "º D.U. de " + totalDu : "D.U. indisponível", totalDu ? percent((currentDu / totalDu) * 100) + " dos dias úteis da competência" : ""],
            ["fa-trophy", best ? "Melhor ICM: " + monthLabel(best.mes) : "Sem mês com meta", best ? percent(best.icm) + " • HO " + compactCurrency(best.valor_ho) : ""],
            ["fa-exchange", delta == null ? "M/M indisponível" : "Produção M/M " + (delta >= 0 ? "+" : "") + percent(delta), latest && previous ? monthLabel(previous.mes) + " → " + monthLabel(latest.mes) : "São necessários dois meses"]
        ];
        html(el.insights, cards.map((item) => '<article class="metas-insight"><i class="fa ' + item[0] + '"></i><strong>' + escapeHtml(item[1]) + '</strong><p>' + escapeHtml(item[2]) + '</p></article>').join(""));
    }

    function destroyChart(key) {
        if (state.charts[key]) {
            state.charts[key].destroy();
            delete state.charts[key];
        }
    }

    function chartOptions() {
        return {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: "index" },
            plugins: { legend: { labels: { boxWidth: 8, usePointStyle: true, font: { size: 9 } } } },
            scales: {
                x: { grid: { display: false }, ticks: { font: { size: 8 } } },
                y: { beginAtZero: true, ticks: { font: { size: 8 } } }
            }
        };
    }

    function renderMonthlyCharts() {
        const rows = monthlySeries();
        if (!window.Chart) return;

        destroyChart("monthly");
        if (el.monthlyChart) {
            const options = chartOptions();
            options.onClick = function (_, points) {
                if (points && points.length && rows[points[0].index]) applyMonth(rows[points[0].index].mes);
            };
            options.plugins.tooltip = { callbacks: { label: (ctx) => ctx.dataset.label + ": " + currency(ctx.raw) } };
            options.scales.y.ticks.callback = (n) => compactCurrency(n).replace("R$ ", "");
            state.charts.monthly = new Chart(el.monthlyChart, {
                type: "bar",
                data: {
                    labels: rows.map((row) => row.rotulo),
                    datasets: [
                        { label: "Produção", data: rows.map((row) => row.producao_realizada), backgroundColor: COLORS.blue },
                        { label: "Pagamento", data: rows.map((row) => row.pagamento), backgroundColor: COLORS.teal },
                        { label: "HO", data: rows.map((row) => row.valor_ho), backgroundColor: COLORS.sky },
                        { label: "Meta", data: rows.map((row) => row.meta), type: "line", borderColor: COLORS.amber, backgroundColor: COLORS.amber, tension: .25, borderWidth: 2, pointRadius: 3 }
                    ]
                },
                options
            });
        }

        destroyChart("icm");
        if (el.icmChart) {
            const options = chartOptions();
            options.plugins.legend.display = false;
            options.plugins.tooltip = { callbacks: { label: (ctx) => "ICM: " + percent(ctx.raw) } };
            options.scales.y.ticks.callback = (n) => n + "%";
            state.charts.icm = new Chart(el.icmChart, {
                type: "line",
                data: { labels: rows.map((row) => row.rotulo), datasets: [{ label: "ICM", data: rows.map((row) => row.icm), borderColor: COLORS.blue2, backgroundColor: "rgba(23,92,150,.10)", fill: true, tension: .3, borderWidth: 2, pointRadius: 3 }] },
                options
            });
        }
    }

    function populateDailyMonths(preserve) {
        if (!el.dailyMonth) return;
        const old = preserve ? el.dailyMonth.value : "";
        const months = monthsInScope();
        const current = currentMonthKey();
        const fallback = months.some((month) => month.chave === current) ? current : (months.length ? months[months.length - 1].chave : "");
        html(el.dailyMonth, months.map((month) => '<option value="' + escapeHtml(month.chave) + '">' + escapeHtml(month.rotulo) + '</option>').join(""));
        value(el.dailyMonth, old && months.some((month) => month.chave === old) ? old : fallback);
    }

    function dayAvailable(monthKey, day) {
        if (state.filters.dateStart && day.data < state.filters.dateStart) return false;
        if (state.filters.dateEnd && day.data > state.filters.dateEnd) return false;
        const current = currentMonthKey();
        if (!current) return true;
        if (monthKey < current) return true;
        if (monthKey > current) return false;
        return !todayIso() || day.data <= todayIso();
    }

    function businessDaySeries(monthKey, metric) {
        const month = monthInfo(monthKey);
        if (!month) return { rows: [], meta: 0 };
        const records = state.filteredRecords.filter((item) => item.mes === monthKey);
        const metas = state.filteredMetas.filter((item) => item.mes === monthKey);
        const meta = metas.reduce((sum, item) => sum + num(item.meta), 0);
        const byDate = new Map();
        records.forEach((item) => {
            if (!byDate.has(item.data)) byDate.set(item.data, []);
            byDate.get(item.data).push(item);
        });

        let accumulated = 0;
        let hoAccumulated = 0;
        const rows = (month.dias_uteis || []).map((day) => {
            const available = dayAvailable(monthKey, day);
            if (!available) return { dia_util: num(day.dia_util_numero), data: day.data, available: false, valor_diario: null, valor_acumulado: null, ho_acumulado: null, meta, icm: null };
            const dayRecords = byDate.get(day.data) || [];
            const daily = dayRecords.reduce((sum, item) => sum + num(item[metric]), 0);
            const hoDaily = dayRecords.reduce((sum, item) => sum + num(item.valor_ho), 0);
            accumulated += daily;
            hoAccumulated += hoDaily;
            return { dia_util: num(day.dia_util_numero), data: day.data, available: true, valor_diario: daily, valor_acumulado: accumulated, ho_acumulado: hoAccumulated, meta, icm: meta > 0 ? (hoAccumulated / meta) * 100 : 0 };
        });
        return { rows, meta };
    }

    function dailyOperationsSeries(monthKey) {
        const month = monthInfo(monthKey);

        if (!month) {
            return {
                rows: [],
                availableRows: [],
                latest: null,
                previous: null,
                meta: 0,
                totalDu: 0,
                month: null
            };
        }

        const records = state.filteredRecords.filter(
            (item) => item.mes === monthKey
        );

        const metas = state.filteredMetas.filter(
            (item) => item.mes === monthKey
        );

        const meta = metas.reduce(
            (sum, item) => sum + num(item.meta),
            0
        );

        const totalDu = num(month.total_dias_uteis);
        const byDate = new Map();

        records.forEach((item) => {
            if (!byDate.has(item.data)) {
                byDate.set(item.data, []);
            }

            byDate.get(item.data).push(item);
        });

        let producaoAcumulada = 0;
        let pagamentoAcumulado = 0;
        let hoAcumulado = 0;

        const rows = (month.dias_uteis || []).map((day) => {
            const du = num(day.dia_util_numero);
            const available = dayAvailable(monthKey, day);

            if (!available) {
                return {
                    dia_util: du,
                    data: day.data,
                    available: false,
                    producao_diaria: null,
                    pagamento_diario: null,
                    eficiencia: null,
                    quebra: null,
                    quebra_percentual: null,
                    ho_diario: null,
                    producao_acumulada: null,
                    pagamento_acumulado: null,
                    ho_acumulado: null,
                    meta,
                    icm: null,
                    gap: null,
                    gap_percentual: null,
                    meta_esperada_du: null,
                    desvio_trajetoria: null
                };
            }

            const dayRecords = byDate.get(day.data) || [];

            const producao = dayRecords.reduce(
                (sum, item) =>
                    sum + num(item.producao_realizada),
                0
            );

            const pagamento = dayRecords.reduce(
                (sum, item) =>
                    sum + num(item.pagamento),
                0
            );

            const ho = dayRecords.reduce(
                (sum, item) =>
                    sum + num(item.valor_ho),
                0
            );

            const quebra = producao - pagamento;

            const eficiencia = producao !== 0
                ? (pagamento / producao) * 100
                : null;

            const quebraPercentual = producao !== 0
                ? (quebra / producao) * 100
                : null;

            producaoAcumulada += producao;
            pagamentoAcumulado += pagamento;
            hoAcumulado += ho;

            const icm = meta > 0
                ? (hoAcumulado / meta) * 100
                : 0;

            const gap = meta > 0
                ? Math.max(meta - hoAcumulado, 0)
                : 0;

            const gapPercentual = meta > 0
                ? (gap / meta) * 100
                : 0;

            const metaEsperadaDu = (
                meta > 0 &&
                totalDu > 0
            )
                ? meta * (du / totalDu)
                : 0;

            return {
                dia_util: du,
                data: day.data,
                available: true,
                producao_diaria: producao,
                pagamento_diario: pagamento,
                eficiencia,
                quebra,
                quebra_percentual: quebraPercentual,
                ho_diario: ho,
                producao_acumulada: producaoAcumulada,
                pagamento_acumulado: pagamentoAcumulado,
                ho_acumulado: hoAcumulado,
                meta,
                icm,
                gap,
                gap_percentual: gapPercentual,
                meta_esperada_du: metaEsperadaDu,
                desvio_trajetoria:
                    hoAcumulado - metaEsperadaDu
            };
        });

        const availableRows = rows.filter(
            (row) => row.available
        );

        return {
            rows,
            availableRows,
            latest: availableRows.length
                ? availableRows[availableRows.length - 1]
                : null,
            previous: availableRows.length > 1
                ? availableRows[availableRows.length - 2]
                : null,
            meta,
            totalDu,
            month
        };
    }

    function dailyPercentChange(currentValue, previousValue) {
        const current = num(currentValue);
        const previous = num(previousValue);

        if (previous === 0) {
            if (current === 0) return 0;
            return null;
        }

        return (
            (current - previous) /
            Math.abs(previous)
        ) * 100;
    }

    function dailyPointChange(currentValue, previousValue) {
        if (
            currentValue == null ||
            previousValue == null
        ) {
            return null;
        }

        return (
            Number(currentValue) -
            Number(previousValue)
        );
    }

    function dailyTrend(
        currentValue,
        previousValue,
        lowerIsBetter,
        kind
    ) {
        let delta = null;

        if (kind === "points") {
            delta = dailyPointChange(
                currentValue,
                previousValue
            );
        } else {
            delta = dailyPercentChange(
                currentValue,
                previousValue
            );
        }

        if (delta == null) {
            return {
                className: "is-neutral",
                icon: "fa-minus",
                label: "Sem base no D.U. anterior"
            };
        }

        if (delta === 0) {
            return {
                className: "is-neutral",
                icon: "fa-minus",
                label: kind === "points"
                    ? "0,00 p.p. vs D.U. anterior"
                    : "0,00% vs D.U. anterior"
            };
        }

        const favorable = lowerIsBetter
            ? delta < 0
            : delta > 0;

        const label = kind === "points"
            ? (
                (delta > 0 ? "+" : "") +
                numberFormat(delta, 2) +
                " p.p. vs D.U. anterior"
            )
            : (
                (delta > 0 ? "+" : "") +
                percent(delta) +
                " vs D.U. anterior"
            );

        return {
            className: favorable
                ? "is-positive"
                : "is-negative",
            icon: delta > 0
                ? "fa-arrow-up"
                : "fa-arrow-down",
            label
        };
    }

    function dailyBoardSummary(series) {
        const latest = series.latest;
        const previous = series.previous;
        const totalDu = series.totalDu;
        const meta = series.meta;

        if (!latest) {
            return {
                latest: null,
                previous,
                currentDu: 0,
                totalDu,
                remainingDu: totalDu,
                meta,
                gap: meta,
                gapPercent: meta > 0 ? 100 : 0,
                averageHo: 0,
                requiredHo: 0,
                projectedHo: 0,
                projectedIcm: 0,
                projectedGap: meta,
                accelerationNeeded: null,
                paceCoverage: 0,
                statusClass: "is-neutral",
                statusLabel: "SEM DADOS NO PERÍODO",
                statusDetail: "Não há D.U. disponível no recorte."
            };
        }

        const currentDu = num(latest.dia_util);
        const remainingDu = Math.max(
            totalDu - currentDu,
            0
        );

        const gap = meta > 0
            ? Math.max(
                meta - num(latest.ho_acumulado),
                0
            )
            : 0;

        const gapPercent = meta > 0
            ? (gap / meta) * 100
            : 0;

        const averageHo = currentDu > 0
            ? num(latest.ho_acumulado) / currentDu
            : 0;

        const requiredHo = (
            gap > 0 &&
            remainingDu > 0
        )
            ? gap / remainingDu
            : 0;

        const projectedHo = currentDu > 0
            ? (
                num(latest.ho_acumulado) +
                averageHo * remainingDu
            )
            : num(latest.ho_acumulado);

        const projectedIcm = meta > 0
            ? (projectedHo / meta) * 100
            : 0;

        const projectedGap = meta > 0
            ? Math.max(meta - projectedHo, 0)
            : 0;

        const accelerationNeeded = (
            requiredHo > 0 &&
            averageHo > 0 &&
            requiredHo > averageHo
        )
            ? (
                (
                    requiredHo /
                    averageHo
                ) - 1
            ) * 100
            : 0;

        const paceCoverage = requiredHo > 0
            ? (
                averageHo /
                requiredHo
            ) * 100
            : (
                gap <= 0
                    ? 100
                    : 0
            );

        let statusClass = "is-neutral";
        let statusLabel = "SEM META NO RECORTE";
        let statusDetail =
            "A projeção depende de uma meta mensal disponível.";

        if (meta > 0) {
            if (gap <= 0) {
                statusClass = "is-good";
                statusLabel = "META ATINGIDA";
                statusDetail =
                    "O HO acumulado já alcançou a meta do mês.";
            } else if (remainingDu <= 0) {
                statusClass = "is-bad";
                statusLabel =
                    "MÊS ENCERRADO ABAIXO DA META";
                statusDetail =
                    "Não há D.U. restante para recuperação.";
            } else if (averageHo >= requiredHo) {
                statusClass = "is-good";
                statusLabel =
                    "NO RITMO PARA ATINGIR";
                statusDetail =
                    "A média atual de HO cobre o ritmo necessário.";
            } else if (
                num(latest.ho_diario) >= requiredHo
            ) {
                statusClass = "is-warn";
                statusLabel = "EM RECUPERAÇÃO";
                statusDetail =
                    "O D.U. atual reage, mas o acumulado ainda está abaixo do ritmo.";
            } else {
                statusClass = "is-bad";
                statusLabel =
                    "ABAIXO DO RITMO NECESSÁRIO";
                statusDetail =
                    "A média atual de HO não cobre o ritmo exigido pelos D.U.s restantes.";
            }
        }

        return {
            latest,
            previous,
            currentDu,
            totalDu,
            remainingDu,
            meta,
            gap,
            gapPercent,
            averageHo,
            requiredHo,
            projectedHo,
            projectedIcm,
            projectedGap,
            accelerationNeeded,
            paceCoverage,
            statusClass,
            statusLabel,
            statusDetail
        };
    }

    function dailyNarrative(summary) {
        if (!summary.latest) {
            return "Sem D.U. disponível para gerar a leitura operacional.";
        }

        if (summary.meta <= 0) {
            return (
                "O mês possui movimento operacional, mas não há meta disponível no recorte. " +
                "Produção, pagamento, eficiência, quebra e HO continuam sendo acompanhados, porém ICM, gap e projeção de meta ficam sem referência."
            );
        }

        const latest = summary.latest;

        if (summary.gap <= 0) {
            const surplus = Math.max(
                num(latest.ho_acumulado) -
                summary.meta,
                0
            );

            return (
                "No " +
                summary.currentDu +
                "º D.U. de " +
                summary.totalDu +
                ", o ICM está em " +
                percent(latest.icm) +
                " e a meta já foi atingida. " +
                (
                    surplus > 0
                        ? "O HO acumulado supera a meta em " +
                          compactCurrency(surplus) +
                          "."
                        : "O HO acumulado alcançou exatamente o valor da meta."
                )
            );
        }

        if (summary.remainingDu <= 0) {
            return (
                "O mês encerrou com ICM de " +
                percent(latest.icm) +
                ". O saldo não atingido foi de " +
                compactCurrency(summary.gap) +
                ", equivalente a " +
                percent(summary.gapPercent) +
                " da meta."
            );
        }

        let paceText = "";

        if (summary.averageHo > 0) {
            if (summary.averageHo >= summary.requiredHo) {
                paceText = (
                    "A média atual de " +
                    compactCurrency(summary.averageHo) +
                    " por D.U. é suficiente para o ritmo necessário de " +
                    compactCurrency(summary.requiredHo) +
                    "."
                );
            } else {
                paceText = (
                    "Para atingir 100%, os próximos " +
                    summary.remainingDu +
                    " D.U.s precisam entregar em média " +
                    compactCurrency(summary.requiredHo) +
                    " de HO por dia, exigindo aceleração de " +
                    percent(summary.accelerationNeeded) +
                    " sobre a média atual."
                );
            }
        } else {
            paceText = (
                "Ainda não há média positiva de HO para sustentar uma projeção de atingimento."
            );
        }

        return (
            "No " +
            summary.currentDu +
            "º D.U. de " +
            summary.totalDu +
            ", o ICM está em " +
            percent(latest.icm) +
            ". Faltam " +
            compactCurrency(summary.gap) +
            " (" +
            percent(summary.gapPercent) +
            ") para a meta. Mantendo o ritmo atual, a projeção é " +
            compactCurrency(summary.projectedHo) +
            " de HO, ou " +
            percent(summary.projectedIcm) +
            " de ICM. " +
            paceText
        );
    }

    function dailyDiagnosis(summary) {
        const latest = summary.latest;
        const previous = summary.previous;

        if (!latest) {
            return {
                className: "is-neutral",
                title: "Sem diagnóstico",
                text: "Não há D.U. disponível para comparar."
            };
        }

        if (!previous) {
            return {
                className: "is-neutral",
                title: "Primeiro D.U. disponível",
                text: "Ainda não existe um D.U. anterior no recorte para avaliar evolução."
            };
        }

        const productionChange = dailyPercentChange(
            latest.producao_diaria,
            previous.producao_diaria
        );

        const paymentChange = dailyPercentChange(
            latest.pagamento_diario,
            previous.pagamento_diario
        );

        const efficiencyChange = dailyPointChange(
            latest.eficiencia,
            previous.eficiencia
        );

        const breakChange = dailyPercentChange(
            latest.quebra,
            previous.quebra
        );

        if (
            summary.meta > 0 &&
            summary.requiredHo > 0 &&
            num(latest.ho_diario) < summary.requiredHo
        ) {
            if (
                efficiencyChange != null &&
                efficiencyChange < 0 &&
                (
                    productionChange == null ||
                    productionChange >= 0
                )
            ) {
                return {
                    className: "is-bad",
                    title: "Conversão em pagamento é o principal ponto de atenção",
                    text: (
                        "A produção não recuou, mas a eficiência caiu " +
                        numberFormat(
                            Math.abs(efficiencyChange),
                            2
                        ) +
                        " p.p. frente ao D.U. anterior. O HO do dia está " +
                        compactCurrency(
                            summary.requiredHo -
                            num(latest.ho_diario)
                        ) +
                        " abaixo do ritmo necessário."
                    )
                };
            }

            if (
                breakChange != null &&
                breakChange > 0
            ) {
                return {
                    className: "is-bad",
                    title: "Quebra aumentou e pressiona o atingimento",
                    text: (
                        "A quebra cresceu " +
                        percent(breakChange) +
                        " frente ao D.U. anterior. O HO diário também está abaixo do necessário para fechar a meta."
                    )
                };
            }

            if (
                productionChange != null &&
                productionChange < 0 &&
                paymentChange != null &&
                paymentChange < 0
            ) {
                return {
                    className: "is-bad",
                    title: "Produção e pagamento recuaram no mesmo D.U.",
                    text: (
                        "A produção caiu " +
                        percent(Math.abs(productionChange)) +
                        " e o pagamento caiu " +
                        percent(Math.abs(paymentChange)) +
                        " frente ao D.U. anterior. O ritmo de HO precisa acelerar."
                    )
                };
            }

            return {
                className: "is-bad",
                title: "Geração de HO está abaixo do necessário",
                text: (
                    "O HO do D.U. foi " +
                    compactCurrency(latest.ho_diario) +
                    ", enquanto o ritmo necessário para os próximos D.U.s é " +
                    compactCurrency(summary.requiredHo) +
                    "."
                )
            };
        }

        if (
            summary.meta > 0 &&
            summary.averageHo < summary.requiredHo &&
            num(latest.ho_diario) >= summary.requiredHo
        ) {
            return {
                className: "is-warn",
                title: "O D.U. atual reagiu, mas o acumulado ainda exige atenção",
                text: (
                    "Hoje o HO superou o ritmo diário necessário. Para recuperar o acumulado, essa entrega precisa ser sustentada nos próximos D.U.s."
                )
            };
        }

        if (
            efficiencyChange != null &&
            efficiencyChange > 0 &&
            (
                breakChange == null ||
                breakChange <= 0
            )
        ) {
            return {
                className: "is-good",
                title: "Conversão melhorou no D.U. atual",
                text: (
                    "A eficiência avançou " +
                    numberFormat(
                        efficiencyChange,
                        2
                    ) +
                    " p.p. e a quebra não piorou frente ao D.U. anterior."
                )
            };
        }

        if (
            summary.meta > 0 &&
            summary.averageHo >= summary.requiredHo
        ) {
            return {
                className: "is-good",
                title: "Operação compatível com o ritmo da meta",
                text: (
                    "A média de HO por D.U. está acima do necessário para os dias restantes. O foco é preservar eficiência e controlar a quebra."
                )
            };
        }

        return {
            className: "is-neutral",
            title: "Operação estável no último D.U.",
            text: "Não foi identificado um desvio dominante entre produção, pagamento, eficiência, quebra e HO."
        };
    }

    function dailySignalCard(
        label,
        valueLabel,
        trend,
        icon,
        hint
    ) {
        return (
            '<article class="metas-daily-signal ' +
                trend.className +
                '">' +
                '<div class="metas-daily-signal-top">' +
                    '<span>' +
                        escapeHtml(label) +
                    '</span>' +
                    '<i class="fa ' +
                        icon +
                        '"></i>' +
                '</div>' +
                '<strong>' +
                    escapeHtml(valueLabel) +
                '</strong>' +
                '<small class="metas-daily-trend">' +
                    '<i class="fa ' +
                        trend.icon +
                        '"></i> ' +
                    escapeHtml(trend.label) +
                '</small>' +
                '<em>' +
                    escapeHtml(hint) +
                '</em>' +
            '</article>'
        );
    }

    function renderDailyCommand(series, summary) {
        const latest = summary.latest;
        const previous = summary.previous;

        if (el.dailyCommandCard) {
            el.dailyCommandCard.classList.remove(
                "is-good",
                "is-warn",
                "is-bad",
                "is-neutral"
            );
            el.dailyCommandCard.classList.add(
                summary.statusClass
            );
        }

        text(
            el.dailyStatus,
            summary.statusLabel
        );

        text(
            el.dailyStatusDetail,
            summary.statusDetail
        );

        text(
            el.dailyDuBadge,
            summary.latest
                ? (
                    "D.U. " +
                    summary.currentDu +
                    " de " +
                    summary.totalDu
                )
                : "D.U. —"
        );

        text(
            el.dailyNarrative,
            dailyNarrative(summary)
        );

        const kpis = [
            {
                label: "ICM Atual",
                value: latest && summary.meta > 0
                    ? percent(latest.icm)
                    : "—",
                detail: summary.meta > 0
                    ? (
                        "HO " +
                        compactCurrency(
                            latest
                                ? latest.ho_acumulado
                                : 0
                        ) +
                        " / Meta " +
                        compactCurrency(summary.meta)
                    )
                    : "Sem meta disponível",
                icon: "fa-tachometer",
                tone: summary.statusClass
            },
            {
                label: "Falta para Meta",
                value: summary.meta > 0
                    ? compactCurrency(summary.gap)
                    : "—",
                detail: summary.meta > 0
                    ? percent(summary.gapPercent) +
                      " ainda não atingido"
                    : "Sem referência de meta",
                icon: "fa-bullseye",
                tone: summary.gap <= 0 &&
                      summary.meta > 0
                    ? "is-good"
                    : "is-bad"
            },
            {
                label: "Ritmo Necessário",
                value: (
                    summary.meta > 0 &&
                    summary.remainingDu > 0 &&
                    summary.gap > 0
                )
                    ? compactCurrency(
                        summary.requiredHo
                    ) + " / D.U."
                    : (
                        summary.gap <= 0 &&
                        summary.meta > 0
                            ? "Meta atingida"
                            : "—"
                    ),
                detail: summary.remainingDu +
                    " D.U. restante" +
                    (
                        summary.remainingDu === 1
                            ? ""
                            : "s"
                    ),
                icon: "fa-bolt",
                tone: summary.statusClass
            },
            {
                label: "Projeção de Fechamento",
                value: summary.meta > 0
                    ? percent(summary.projectedIcm)
                    : "—",
                detail: summary.meta > 0
                    ? compactCurrency(
                        summary.projectedHo
                    ) + " de HO projetado"
                    : "Sem meta para projetar",
                icon: "fa-line-chart",
                tone: summary.projectedIcm >= 100
                    ? "is-good"
                    : (
                        summary.meta > 0
                            ? "is-bad"
                            : "is-neutral"
                    )
            }
        ];

        html(
            el.dailyCommandKpis,
            kpis.map((item) =>
                '<article class="metas-daily-command-kpi ' +
                    item.tone +
                    '">' +
                    '<div><span>' +
                        escapeHtml(item.label) +
                    '</span><i class="fa ' +
                        item.icon +
                        '"></i></div>' +
                    '<strong>' +
                        escapeHtml(item.value) +
                    '</strong>' +
                    '<small>' +
                        escapeHtml(item.detail) +
                    '</small>' +
                '</article>'
            ).join("")
        );

        if (!latest) {
            html(
                el.dailySignals,
                '<div class="metas-empty">Sem D.U. disponível.</div>'
            );
            return;
        }

        const productionTrend = dailyTrend(
            latest.producao_diaria,
            previous
                ? previous.producao_diaria
                : null,
            false,
            "percent"
        );

        const paymentTrend = dailyTrend(
            latest.pagamento_diario,
            previous
                ? previous.pagamento_diario
                : null,
            false,
            "percent"
        );

        const efficiencyTrend = dailyTrend(
            latest.eficiencia,
            previous
                ? previous.eficiencia
                : null,
            false,
            "points"
        );

        const breakTrend = dailyTrend(
            latest.quebra,
            previous
                ? previous.quebra
                : null,
            true,
            "percent"
        );

        const hoTrend = dailyTrend(
            latest.ho_diario,
            previous
                ? previous.ho_diario
                : null,
            false,
            "percent"
        );

        const icmTrend = dailyTrend(
            latest.icm,
            previous
                ? previous.icm
                : null,
            false,
            "points"
        );

        html(
            el.dailySignals,
            [
                dailySignalCard(
                    "Produzido no D.U.",
                    compactCurrency(
                        latest.producao_diaria
                    ),
                    productionTrend,
                    "fa-industry",
                    "Entrada operacional do dia"
                ),
                dailySignalCard(
                    "Pago no D.U.",
                    compactCurrency(
                        latest.pagamento_diario
                    ),
                    paymentTrend,
                    "fa-money",
                    "Conversão financeira do dia"
                ),
                dailySignalCard(
                    "Eficiência",
                    latest.eficiencia == null
                        ? "—"
                        : percent(latest.eficiencia),
                    efficiencyTrend,
                    "fa-percent",
                    "Pago ÷ Produção"
                ),
                dailySignalCard(
                    "Quebra",
                    compactCurrency(
                        latest.quebra
                    ),
                    breakTrend,
                    "fa-filter",
                    "Produção − Pago"
                ),
                dailySignalCard(
                    "HO no D.U.",
                    compactCurrency(
                        latest.ho_diario
                    ),
                    hoTrend,
                    "fa-line-chart",
                    summary.requiredHo > 0
                        ? (
                            "Necessário: " +
                            compactCurrency(
                                summary.requiredHo
                            )
                        )
                        : "HO que reduz o gap"
                ),
                dailySignalCard(
                    "ICM",
                    summary.meta > 0
                        ? percent(latest.icm)
                        : "—",
                    icmTrend,
                    "fa-tachometer",
                    summary.meta > 0
                        ? (
                            "Gap: " +
                            compactCurrency(
                                summary.gap
                            )
                        )
                        : "Sem meta no recorte"
                )
            ].join("")
        );

        const diagnosis = dailyDiagnosis(summary);

        if (el.dailyDiagnosis) {
            el.dailyDiagnosis.classList.remove(
                "is-good",
                "is-warn",
                "is-bad",
                "is-neutral"
            );

            el.dailyDiagnosis.classList.add(
                diagnosis.className
            );

            html(
                el.dailyDiagnosis,
                '<div class="metas-daily-diagnosis-icon">' +
                    '<i class="fa fa-stethoscope" aria-hidden="true"></i>' +
                '</div>' +
                '<div>' +
                    '<span>Diagnóstico operacional</span>' +
                    '<strong>' +
                        escapeHtml(diagnosis.title) +
                    '</strong>' +
                    '<p>' +
                        escapeHtml(diagnosis.text) +
                    '</p>' +
                '</div>'
            );
        }
    }

    function renderDailyChart(series, summary) {
        destroyChart("daily");

        if (!el.dailyChart || !window.Chart) {
            return;
        }

        const labels = series.rows.map(
            (row) => "DU " + row.dia_util
        );

        const options = chartOptions();

        options.scales.y.ticks.callback = (n) =>
            compactCurrency(n).replace("R$ ", "");

        options.plugins.tooltip = {
            callbacks: {
                label: (ctx) =>
                    ctx.dataset.label +
                    ": " +
                    currency(ctx.raw)
            }
        };

        let datasets = [];

        if (state.daily.chartMode === "flow") {
            datasets = [
                {
                    label: "Produção",
                    data: series.rows.map(
                        (row) =>
                            row.available
                                ? row.producao_diaria
                                : null
                    ),
                    borderColor: COLORS.blue,
                    backgroundColor: COLORS.blue,
                    tension: .28,
                    pointRadius: 2.5,
                    borderWidth: 2
                },
                {
                    label: "Pagamento",
                    data: series.rows.map(
                        (row) =>
                            row.available
                                ? row.pagamento_diario
                                : null
                    ),
                    borderColor: COLORS.teal,
                    backgroundColor: COLORS.teal,
                    tension: .28,
                    pointRadius: 2.5,
                    borderWidth: 2
                },
                {
                    label: "HO",
                    data: series.rows.map(
                        (row) =>
                            row.available
                                ? row.ho_diario
                                : null
                    ),
                    borderColor: COLORS.sky,
                    backgroundColor: COLORS.sky,
                    tension: .28,
                    pointRadius: 2.5,
                    borderWidth: 2
                },
                {
                    label: "Quebra",
                    data: series.rows.map(
                        (row) =>
                            row.available
                                ? row.quebra
                                : null
                    ),
                    borderColor: COLORS.red,
                    backgroundColor: COLORS.red,
                    borderDash: [5, 4],
                    tension: .25,
                    pointRadius: 1.5,
                    borderWidth: 1.5
                }
            ];

            if (el.dailyChartFooter) {
                html(
                    el.dailyChartFooter,
                    '<span><i class="is-production"></i> Produção</span>' +
                    '<span><i class="is-payment"></i> Pagamento</span>' +
                    '<span><i class="is-ho"></i> HO</span>' +
                    '<span><i class="is-break"></i> Quebra</span>'
                );
            }
        } else {
            const latest = summary.latest;
            const latestDu = latest
                ? summary.currentDu
                : 0;

            const projectionColor =
                summary.projectedIcm >= 100
                    ? COLORS.green
                    : COLORS.red;

            const actualData = series.rows.map(
                (row) =>
                    row.available
                        ? row.ho_acumulado
                        : null
            );

            const targetData = series.rows.map(
                (row) =>
                    series.meta > 0 &&
                    series.totalDu > 0
                        ? (
                            series.meta *
                            (
                                row.dia_util /
                                series.totalDu
                            )
                        )
                        : null
            );

            const projectionData = series.rows.map(
                (row) => {
                    if (
                        !latest ||
                        row.dia_util < latestDu
                    ) {
                        return null;
                    }

                    if (row.dia_util === latestDu) {
                        return latest.ho_acumulado;
                    }

                    return (
                        latest.ho_acumulado +
                        summary.averageHo *
                        (
                            row.dia_util -
                            latestDu
                        )
                    );
                }
            );

            datasets = [
                {
                    label: "HO acumulado",
                    data: actualData,
                    borderColor: COLORS.blue,
                    backgroundColor: "rgba(10,65,116,.10)",
                    fill: true,
                    tension: .28,
                    pointRadius: 2.5,
                    borderWidth: 2.5
                },
                {
                    label: "Trajetória necessária",
                    data: targetData,
                    borderColor: COLORS.amber,
                    backgroundColor: COLORS.amber,
                    borderDash: [6, 5],
                    tension: 0,
                    pointRadius: 0,
                    borderWidth: 1.8
                },
                {
                    label: "Projeção",
                    data: projectionData,
                    borderColor: projectionColor,
                    backgroundColor: projectionColor,
                    borderDash: [3, 4],
                    tension: .20,
                    pointRadius: 1.8,
                    borderWidth: 2
                }
            ];

            if (el.dailyChartFooter) {
                html(
                    el.dailyChartFooter,
                    '<span><i class="is-actual"></i> HO acumulado</span>' +
                    '<span><i class="is-target"></i> Trajetória necessária</span>' +
                    '<span><i class="is-projection ' +
                        (
                            summary.projectedIcm >= 100
                                ? 'is-good'
                                : 'is-bad'
                        ) +
                        '"></i> Projeção ' +
                        (
                            series.meta > 0
                                ? percent(
                                    summary.projectedIcm
                                )
                                : '—'
                        ) +
                    '</span>'
                );
            }
        }

        state.charts.daily = new Chart(
            el.dailyChart,
            {
                type: "line",
                data: {
                    labels,
                    datasets
                },
                options
            }
        );

        document
            .querySelectorAll(
                "[data-daily-chart-mode]"
            )
            .forEach((button) => {
                button.classList.toggle(
                    "is-active",
                    button.dataset.dailyChartMode ===
                        state.daily.chartMode
                );
            });
    }

    function dailyTableTrendClass(
        currentValue,
        previousValue,
        lowerIsBetter,
        kind
    ) {
        if (previousValue == null) {
            return "";
        }

        let delta = null;

        if (kind === "points") {
            delta = dailyPointChange(
                currentValue,
                previousValue
            );
        } else {
            delta = dailyPercentChange(
                currentValue,
                previousValue
            );
        }

        if (
            delta == null ||
            delta === 0
        ) {
            return "";
        }

        const favorable = lowerIsBetter
            ? delta < 0
            : delta > 0;

        return favorable
            ? " is-day-positive"
            : " is-day-negative";
    }

    function dailyTableDelta(
        currentValue,
        previousValue,
        kind
    ) {
        if (previousValue == null) {
            return "—";
        }

        if (kind === "points") {
            const delta = dailyPointChange(
                currentValue,
                previousValue
            );

            if (delta == null) return "—";

            return (
                (delta > 0 ? "+" : "") +
                numberFormat(delta, 2) +
                " p.p."
            );
        }

        const delta = dailyPercentChange(
            currentValue,
            previousValue
        );

        if (delta == null) {
            return "s/base";
        }

        return (
            (delta > 0 ? "+" : "") +
            percent(delta)
        );
    }

    function dailyTableCell(
        valueLabel,
        currentValue,
        previousValue,
        lowerIsBetter,
        kind
    ) {
        const className = dailyTableTrendClass(
            currentValue,
            previousValue,
            lowerIsBetter,
            kind
        );

        return (
            '<td class="metas-daily-value-cell' +
                className +
                '">' +
                '<strong>' +
                    escapeHtml(valueLabel) +
                '</strong>' +
                '<small>' +
                    escapeHtml(
                        dailyTableDelta(
                            currentValue,
                            previousValue,
                            kind
                        )
                    ) +
                '</small>' +
            '</td>'
        );
    }

    function renderDailyTable(series, summary) {
        if (!el.dailyBody) return;

        let rows = state.daily.fullTable
            ? series.rows.slice()
            : series.availableRows.slice(-10);

        const latestData = summary.latest
            ? summary.latest.data
            : "";

        html(
            el.dailyBody,
            rows.map((row, index) => {
                if (!row.available) {
                    return (
                        '<tr class="is-future">' +
                            '<td>' + row.dia_util + '</td>' +
                            '<td>' + formatDateBr(row.data) + '</td>' +
                            '<td>—</td><td>—</td><td>—</td><td>—</td>' +
                            '<td>—</td><td>—</td><td>—</td><td>—</td>' +
                            '<td><span class="metas-daily-row-status is-neutral">Futuro</span></td>' +
                        '</tr>'
                    );
                }

                const globalIndex = series.availableRows.findIndex(
                    (item) => item.data === row.data
                );

                const previous = globalIndex > 0
                    ? series.availableRows[globalIndex - 1]
                    : null;

                let statusClass = "is-neutral";
                let statusLabel = "Sem meta";

                if (series.meta > 0) {
                    if (row.gap <= 0) {
                        statusClass = "is-good";
                        statusLabel = "Meta atingida";
                    } else if (
                        row.desvio_trajetoria >= 0
                    ) {
                        statusClass = "is-good";
                        statusLabel = "No ritmo";
                    } else {
                        statusClass = "is-bad";
                        statusLabel = "Abaixo";
                    }
                }

                return (
                    '<tr class="' +
                        (
                            row.data === latestData
                                ? 'is-current-du'
                                : ''
                        ) +
                        '">' +
                        '<td><strong>DU ' +
                            row.dia_util +
                        '</strong></td>' +
                        '<td>' +
                            formatDateBr(row.data) +
                        '</td>' +
                        dailyTableCell(
                            compactCurrency(
                                row.producao_diaria
                            ),
                            row.producao_diaria,
                            previous
                                ? previous.producao_diaria
                                : null,
                            false,
                            "percent"
                        ) +
                        dailyTableCell(
                            compactCurrency(
                                row.pagamento_diario
                            ),
                            row.pagamento_diario,
                            previous
                                ? previous.pagamento_diario
                                : null,
                            false,
                            "percent"
                        ) +
                        dailyTableCell(
                            row.eficiencia == null
                                ? "—"
                                : percent(
                                    row.eficiencia
                                ),
                            row.eficiencia,
                            previous
                                ? previous.eficiencia
                                : null,
                            false,
                            "points"
                        ) +
                        dailyTableCell(
                            compactCurrency(
                                row.quebra
                            ),
                            row.quebra,
                            previous
                                ? previous.quebra
                                : null,
                            true,
                            "percent"
                        ) +
                        dailyTableCell(
                            compactCurrency(
                                row.ho_diario
                            ),
                            row.ho_diario,
                            previous
                                ? previous.ho_diario
                                : null,
                            false,
                            "percent"
                        ) +
                        '<td class="metas-daily-accum-cell"><strong>' +
                            escapeHtml(
                                compactCurrency(
                                    row.ho_acumulado
                                )
                            ) +
                        '</strong><small>acumulado</small></td>' +
                        '<td class="metas-daily-icm-cell"><strong>' +
                            (
                                series.meta > 0
                                    ? escapeHtml(
                                        percent(row.icm)
                                    )
                                    : "—"
                            ) +
                        '</strong><small>' +
                            (
                                series.meta > 0
                                    ? "ICM"
                                    : "sem meta"
                            ) +
                        '</small></td>' +
                        '<td class="metas-daily-gap-cell"><strong>' +
                            (
                                series.meta > 0
                                    ? escapeHtml(
                                        compactCurrency(
                                            row.gap
                                        )
                                    )
                                    : "—"
                            ) +
                        '</strong><small>' +
                            (
                                series.meta > 0
                                    ? escapeHtml(
                                        percent(
                                            row.gap_percentual
                                        )
                                    ) + " falta"
                                    : "sem meta"
                            ) +
                        '</small></td>' +
                        '<td><span class="metas-daily-row-status ' +
                            statusClass +
                            '">' +
                            escapeHtml(statusLabel) +
                        '</span></td>' +
                    '</tr>'
                );
            }).join("") ||
            '<tr><td colspan="11" class="metas-empty">Sem D.U. no período.</td></tr>'
        );

        text(
            el.dailyTableToggle,
            state.daily.fullTable
                ? "Ver últimos 10 D.U.s"
                : "Ver mês completo"
        );
    }

    function renderDaily() {
        if (!el.dailyMonth || !el.dailyBody) return;

        const monthKey = el.dailyMonth.value;
        const series = dailyOperationsSeries(
            monthKey
        );

        const summary = dailyBoardSummary(series);

        text(
            el.dailySummary,
            series.month
                ? (
                    monthLabel(monthKey) +
                    " • " +
                    (
                        summary.latest
                            ? summary.currentDu +
                              "º D.U. de " +
                              summary.totalDu
                            : "sem D.U. disponível"
                    ) +
                    (
                        summary.meta > 0
                            ? " • Meta " +
                              compactCurrency(
                                  summary.meta
                              )
                            : ""
                    )
                )
                : "—"
        );

        renderDailyCommand(
            series,
            summary
        );

        renderDailyChart(
            series,
            summary
        );

        renderDailyTable(
            series,
            summary
        );
    }

    function duComparisonMetric() {
        return el.duMetric && el.duMetric.value
            ? el.duMetric.value
            : "producao_realizada";
    }

    function duComparisonMetricLabel(metric) {
        const def = METRICS[metric] || METRICS.producao_realizada;
        return def.label || "Indicador";
    }

    function duStats(values) {
        const valid = (values || [])
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value));

        if (!valid.length) {
            return {
                count: 0,
                min: null,
                max: null,
                avg: null,
                allEqual: false
            };
        }

        const min = Math.min.apply(null, valid);
        const max = Math.max.apply(null, valid);
        const avg = valid.reduce((sum, value) => sum + value, 0) / valid.length;

        return {
            count: valid.length,
            min,
            max,
            avg,
            allEqual: min === max
        };
    }

    function duClassification(valueToClassify, stats) {
        const value = num(valueToClassify);

        if (!stats || !stats.count) {
            return { className: "", label: "Sem comparação", tone: "neutral" };
        }

        // Um único mês não é suficiente para classificar maior/menor.
        if (stats.count === 1) {
            return { className: "", label: "Sem outro mês disponível para comparação", tone: "neutral" };
        }

        // Se todos os meses têm o mesmo valor positivo, não existe melhor/pior.
        // Se todos são zero, mantemos vermelho porque representa ausência de valor no D.U.
        if (stats.allEqual) {
            if (value === 0) {
                return { className: "is-low", label: "Todos os meses estão zerados neste D.U.", tone: "low" };
            }
            return { className: "", label: "Mesmo valor em todos os meses", tone: "neutral" };
        }

        if (value === stats.min) {
            return { className: "is-low", label: "Menor valor entre os meses neste D.U.", tone: "low" };
        }

        if (value === stats.max) {
            return { className: "is-best", label: "Maior valor entre os meses neste D.U.", tone: "best" };
        }

        return { className: "", label: "Valor intermediário neste D.U.", tone: "neutral" };
    }

    function signedCurrency(valueToFormat) {
        const value = num(valueToFormat);
        if (value === 0) return currency(0);
        return (value > 0 ? "+" : "−") + currency(Math.abs(value));
    }

    function signedPercent(valueToFormat) {
        const value = num(valueToFormat);
        if (value === 0) return "0,00%";
        return (value > 0 ? "+" : "−") + percent(Math.abs(value));
    }

    function duTooltipContent(month, du, kindLabel, metric, valueToExplain, stats, classification) {
        const value = num(valueToExplain);
        const average = stats && stats.avg != null ? num(stats.avg) : 0;
        const delta = value - average;
        const deltaPercent = average !== 0 ? (delta / Math.abs(average)) * 100 : 0;
        const minValue = stats && stats.min != null ? stats.min : value;
        const maxValue = stats && stats.max != null ? stats.max : value;
        const toneClass = classification && classification.tone
            ? " is-" + classification.tone
            : " is-neutral";

        return '' +
            '<div class="metas-du-tooltip-head">' +
                '<span>DU ' + du + ' • ' + escapeHtml(month.rotulo) + '</span>' +
                '<strong>' + escapeHtml(duComparisonMetricLabel(metric)) + '</strong>' +
            '</div>' +
            '<div class="metas-du-tooltip-value">' + currency(value) + '</div>' +
            '<div class="metas-du-tooltip-badge' + toneClass + '">' + escapeHtml(classification.label) + '</div>' +
            '<div class="metas-du-tooltip-grid">' +
                '<span><small>Leitura</small><strong>' + escapeHtml(kindLabel) + '</strong></span>' +
                '<span><small>Média no DU</small><strong>' + currency(average) + '</strong></span>' +
                '<span><small>Dif. da média</small><strong>' + signedCurrency(delta) + '</strong></span>' +
                '<span><small>Variação</small><strong>' + (average !== 0 ? signedPercent(deltaPercent) : '—') + '</strong></span>' +
            '</div>' +
            '<div class="metas-du-tooltip-range">Faixa entre meses: <strong>' + currency(minValue) + '</strong> → <strong>' + currency(maxValue) + '</strong></div>';
    }

    function duFutureTooltipContent(month, du, metric) {
        return '' +
            '<div class="metas-du-tooltip-head">' +
                '<span>DU ' + du + ' • ' + escapeHtml(month.rotulo) + '</span>' +
                '<strong>' + escapeHtml(duComparisonMetricLabel(metric)) + '</strong>' +
            '</div>' +
            '<div class="metas-du-tooltip-badge is-neutral">D.U. futuro / ainda não disponível</div>' +
            '<p class="metas-du-tooltip-note">Este valor não participa da classificação de maior ou menor do D.U.</p>';
    }

    function duTooltipAttribute(content) {
        return encodeURIComponent(String(content || ""));
    }

    function hideDuTooltip() {
        if (!el.duTooltip) return;
        el.duTooltip.classList.remove("is-visible");
        el.duTooltip.setAttribute("aria-hidden", "true");
    }

    function positionDuTooltip(event) {
        if (!el.duTooltip || !el.duTooltip.classList.contains("is-visible")) return;

        const margin = 14;
        const rect = el.duTooltip.getBoundingClientRect();
        let left = event.clientX + 16;
        let top = event.clientY + 16;

        if (left + rect.width + margin > window.innerWidth) {
            left = event.clientX - rect.width - 16;
        }

        if (top + rect.height + margin > window.innerHeight) {
            top = event.clientY - rect.height - 16;
        }

        left = Math.max(margin, left);
        top = Math.max(margin, top);

        el.duTooltip.style.left = left + "px";
        el.duTooltip.style.top = top + "px";
    }

    function showDuTooltip(cell, event) {
        if (!el.duTooltip || !cell || !cell.dataset.duTip) return;

        try {
            html(el.duTooltip, decodeURIComponent(cell.dataset.duTip));
        } catch (_) {
            text(el.duTooltip, "Comparação indisponível.");
        }

        el.duTooltip.classList.add("is-visible");
        el.duTooltip.setAttribute("aria-hidden", "false");
        positionDuTooltip(event);
    }

    function renderDuComparison() {
        if (!el.duHead || !el.duBody) return;

        const months = monthsInScope();
        const metric = duComparisonMetric();
        const metricLabel = duComparisonMetricLabel(metric);
        const series = {};

        text(el.duMetricStatus, "Indicador: " + metricLabel);

        months.forEach((month) => {
            series[month.chave] = businessDaySeries(month.chave, metric);
        });

        const maxDu = months.reduce(
            (max, month) => Math.max(max, num(month.total_dias_uteis)),
            0
        );

        html(
            el.duHead,
            '<tr class="metas-du-month-row">' +
                '<th rowspan="2" class="metas-du-sticky-head">D.U.</th>' +
                months.map((month) =>
                    '<th colspan="2" class="metas-du-month-head">' +
                        '<span>' + escapeHtml(month.rotulo) + '</span>' +
                    '</th>'
                ).join("") +
            '</tr>' +
            '<tr class="metas-du-subhead-row">' +
                months.map(() =>
                    '<th class="metas-du-subhead">Valor diário</th>' +
                    '<th class="metas-du-subhead">Acumulado</th>'
                ).join("") +
            '</tr>'
        );

        const body = [];

        for (let du = 1; du <= maxDu; du += 1) {
            const rows = months.map((month) =>
                series[month.chave].rows.find((row) => row.dia_util === du) || null
            );

            // A comparação é feita SEMPRE no mesmo D.U. entre os meses.
            // Diário e acumulado possuem classificações independentes.
            const dailyStats = duStats(
                rows
                    .filter((row) => row && row.available)
                    .map((row) => row.valor_diario)
            );

            const accumulatedStats = duStats(
                rows
                    .filter((row) => row && row.available)
                    .map((row) => row.valor_acumulado)
            );

            let rowHtml = '<tr><td class="metas-du-index">' + du + '</td>';

            rows.forEach((row, index) => {
                const month = months[index];

                if (!row || !row.available) {
                    const futureTip = duFutureTooltipContent(month, du, metric);
                    rowHtml +=
                        '<td class="metas-du-cell is-future" data-du-tip="' + duTooltipAttribute(futureTip) + '">—</td>' +
                        '<td class="metas-du-cell is-future" data-du-tip="' + duTooltipAttribute(futureTip) + '">—</td>';
                    return;
                }

                const daily = num(row.valor_diario);
                const accumulated = num(row.valor_acumulado);
                const dailyClass = duClassification(daily, dailyStats);
                const accumulatedClass = duClassification(accumulated, accumulatedStats);

                const dailyTip = duTooltipContent(
                    month,
                    du,
                    "Valor diário",
                    metric,
                    daily,
                    dailyStats,
                    dailyClass
                );

                const accumulatedTip = duTooltipContent(
                    month,
                    du,
                    "Valor acumulado",
                    metric,
                    accumulated,
                    accumulatedStats,
                    accumulatedClass
                );

                rowHtml +=
                    '<td class="metas-du-cell ' + dailyClass.className + '" data-du-tip="' + duTooltipAttribute(dailyTip) + '">' +
                        currency(daily) +
                    '</td>' +
                    '<td class="metas-du-cell ' + accumulatedClass.className + '" data-du-tip="' + duTooltipAttribute(accumulatedTip) + '">' +
                        currency(accumulated) +
                    '</td>';
            });

            rowHtml += '</tr>';
            body.push(rowHtml);
        }

        html(
            el.duBody,
            body.join("") || '<tr><td class="metas-empty">Sem meses no recorte.</td></tr>'
        );
    }

    function groupRanking(field) {
        const scopeRecords =
            currentFocusRecords();

        const scopeMetas =
            currentFocusMetas();

        const names = new Set();

        scopeRecords.forEach((item) => {
            if (
                item[field] &&
                item[field] !== "Não informado"
            ) {
                names.add(item[field]);
            }
        });

        scopeMetas.forEach((item) => {
            if (
                item[field] &&
                item[field] !== "Não informado"
            ) {
                names.add(item[field]);
            }
        });

        return Array.from(names)
            .map((name) => {
                const records =
                    scopeRecords.filter(
                        (item) =>
                            normalize(item[field]) ===
                            normalize(name)
                    );

                const metas =
                    scopeMetas.filter(
                        (item) =>
                            normalize(item[field]) ===
                            normalize(name)
                    );

                return Object.assign(
                    { name },
                    aggregate(records, metas)
                );
            })
            .sort(
                (a, b) =>
                    b.icm - a.icm ||
                    b.valor_ho - a.valor_ho ||
                    normalize(a.name)
                        .localeCompare(
                            normalize(b.name)
                        )
            );
    }

    function renderRanking(container, field, filterKey) {
        if (!container) return;

        const rows = groupRanking(field).slice(0, 15);

        html(
            container,
            rows.map((row, index) => {
                const progress = Math.max(
                    0,
                    Math.min(row.icm, 100)
                );

                const tone =
                    row.meta <= 0
                        ? "is-no-meta"
                        : (
                            row.icm >= 100
                                ? "is-achieved"
                                : (
                                    row.icm >= 90
                                        ? "is-close"
                                        : "is-risk"
                                )
                        );

                return (
                    '<button type="button" class="metas-ranking-row ' +
                        tone +
                        '" data-ranking-key="' +
                        filterKey +
                        '" data-ranking-value="' +
                        escapeHtml(row.name) +
                        '">' +
                        '<span class="metas-rank-number">' +
                            (index + 1) +
                        '</span>' +
                        '<span class="metas-rank-user-icon">' +
                            '<i class="fa fa-user" aria-hidden="true"></i>' +
                        '</span>' +
                        '<span class="metas-rank-copy">' +
                            '<strong>' +
                                escapeHtml(row.name) +
                            '</strong>' +
                            '<small>Meta ' +
                                compactCurrency(row.meta) +
                                ' • HO ' +
                                compactCurrency(row.valor_ho) +
                            '</small>' +
                            '<i><b style="width:' +
                                progress +
                                '%"></b></i>' +
                        '</span>' +
                        '<span class="metas-rank-icm">' +
                            percent(row.icm) +
                        '</span>' +
                    '</button>'
                );
            }).join("") ||
            '<div class="metas-empty">Sem dados de liderança.</div>'
        );
    }

    function companyWalletRankingTone(icm, meta) {
        if (num(meta) <= 0) {
            return {
                className: "is-no-meta",
                label: "Sem meta"
            };
        }

        if (num(icm) >= 100) {
            return {
                className: "is-achieved",
                label: "Meta atingida"
            };
        }

        if (num(icm) >= 90) {
            return {
                className: "is-close",
                label: "Próximo da meta"
            };
        }

        return {
            className: "is-risk",
            label: "Abaixo de 90%"
        };
    }

    function companyWalletRankingTooltip(
        entityType,
        entityName,
        companyName,
        aggregateRow,
        rank
    ) {
        const meta = num(aggregateRow.meta);
        const ho = num(aggregateRow.valor_ho);
        const icm = num(aggregateRow.icm);

        const gap = meta > 0
            ? Math.max(meta - ho, 0)
            : 0;

        const surplus = meta > 0
            ? Math.max(ho - meta, 0)
            : 0;

        const tone = companyWalletRankingTone(
            icm,
            meta
        );

        let reading = "";

        if (meta <= 0) {
            reading =
                "Não há meta disponível no recorte para calcular um ranking de atingimento.";
        } else if (icm >= 100) {
            reading =
                "A meta foi atingida" +
                (
                    surplus > 0
                        ? " e o HO supera a meta em " +
                          compactCurrency(surplus) +
                          "."
                        : "."
                );
        } else {
            reading =
                "Faltam " +
                compactCurrency(gap) +
                " para atingir 100% da meta.";
        }

        return '' +
            '<div class="metas-du-tooltip-head">' +
                '<span>' +
                    escapeHtml(entityType) +
                '</span>' +
                '<strong>' +
                    escapeHtml(entityName) +
                '</strong>' +
            '</div>' +
            '<div class="metas-du-tooltip-value">' +
                (
                    meta > 0
                        ? escapeHtml(percent(icm))
                        : "Sem meta"
                ) +
            '</div>' +
            '<div class="metas-du-tooltip-badge ' +
                (
                    tone.className === "is-achieved"
                        ? "is-best"
                        : (
                            tone.className === "is-risk"
                                ? "is-low"
                                : "is-neutral"
                        )
                ) +
                '">' +
                escapeHtml(
                    rank
                        ? "#" + rank + " no ranking de ICM"
                        : tone.label
                ) +
            '</div>' +
            '<div class="metas-du-tooltip-grid">' +
                '<span><small>Meta</small><strong>' +
                    escapeHtml(currency(meta)) +
                '</strong></span>' +
                '<span><small>Total HO</small><strong>' +
                    escapeHtml(currency(ho)) +
                '</strong></span>' +
                '<span><small>ICM Geral</small><strong>' +
                    (
                        meta > 0
                            ? escapeHtml(percent(icm))
                            : "—"
                    ) +
                '</strong></span>' +
                '<span><small>Gap / Superávit</small><strong>' +
                    (
                        meta <= 0
                            ? "—"
                            : (
                                gap > 0
                                    ? escapeHtml(
                                        compactCurrency(gap)
                                    ) + " falta"
                                    : escapeHtml(
                                        compactCurrency(surplus)
                                    ) + " acima"
                            )
                    ) +
                '</strong></span>' +
            '</div>' +
            (
                companyName
                    ? '<div class="metas-du-tooltip-range">Empresa: <strong>' +
                      escapeHtml(companyName) +
                      '</strong></div>'
                    : ''
            ) +
            '<p class="metas-du-tooltip-note">' +
                escapeHtml(reading) +
            '</p>';
    }

    function companyWalletRankingData() {
        const companyNames = new Set();

        const scopeRecords =
            currentFocusRecords();

        const scopeMetas =
            currentFocusMetas();

        scopeRecords.forEach((item) => {
            if (item.empresa) {
                companyNames.add(item.empresa);
            }
        });

        scopeMetas.forEach((item) => {
            if (item.empresa) {
                companyNames.add(item.empresa);
            }
        });

        const companies = Array.from(companyNames)
            .filter(Boolean)
            .map((company) => {
                const records = scopeRecords.filter(
                    (item) =>
                        normalize(item.empresa) ===
                        normalize(company)
                );

                const metas = scopeMetas.filter(
                    (item) =>
                        normalize(item.empresa) ===
                        normalize(company)
                );

                const total = aggregate(records, metas);

                const walletNames = new Set();

                records.forEach((item) => {
                    if (item.carteira) {
                        walletNames.add(item.carteira);
                    }
                });

                metas.forEach((item) => {
                    if (item.carteira) {
                        walletNames.add(item.carteira);
                    }
                });

                const wallets = Array.from(walletNames)
                    .filter(Boolean)
                    .map((wallet) => {
                        const walletRecords = records.filter(
                            (item) =>
                                normalize(item.carteira) ===
                                normalize(wallet)
                        );

                        const walletMetas = metas.filter(
                            (item) =>
                                normalize(item.carteira) ===
                                normalize(wallet)
                        );

                        return Object.assign(
                            {
                                name: wallet,
                                company
                            },
                            aggregate(
                                walletRecords,
                                walletMetas
                            )
                        );
                    });

                return Object.assign(
                    {
                        name: company,
                        wallets
                    },
                    total
                );
            });

        const sortRows = (a, b) => {
            const aHasMeta = num(a.meta) > 0 ? 1 : 0;
            const bHasMeta = num(b.meta) > 0 ? 1 : 0;

            if (aHasMeta !== bHasMeta) {
                return bHasMeta - aHasMeta;
            }

            return (
                num(b.icm) - num(a.icm) ||
                num(b.valor_ho) - num(a.valor_ho) ||
                normalize(a.name).localeCompare(
                    normalize(b.name)
                )
            );
        };

        companies.sort(sortRows);

        let companyRank = 0;

        companies.forEach((company) => {
            if (num(company.meta) > 0) {
                companyRank += 1;
                company.rank = companyRank;
            } else {
                company.rank = null;
            }

            company.wallets.sort(sortRows);
        });

        const allWallets = companies
            .flatMap((company) =>
                company.wallets.map((wallet) =>
                    Object.assign({}, wallet)
                )
            )
            .sort(sortRows);

        let walletRank = 0;

        allWallets.forEach((wallet) => {
            if (num(wallet.meta) > 0) {
                walletRank += 1;
                wallet.globalRank = walletRank;
            } else {
                wallet.globalRank = null;
            }
        });

        const walletRankMap = new Map(
            allWallets.map((wallet) => [
                normalize(
                    wallet.company +
                    "||" +
                    wallet.name
                ),
                wallet.globalRank
            ])
        );

        companies.forEach((company) => {
            company.wallets.forEach((wallet) => {
                wallet.globalRank =
                    walletRankMap.get(
                        normalize(
                            wallet.company +
                            "||" +
                            wallet.name
                        )
                    ) || null;
            });
        });

        return {
            companies,
            allWallets
        };
    }

    function companyWalletRankingProgress(
        icm,
        meta
    ) {
        if (num(meta) <= 0) return 0;

        return Math.max(
            0,
            Math.min(num(icm), 100)
        );
    }

    function companyWalletRankingRow(
        row,
        entityType,
        rank,
        open,
        walletCount
    ) {
        const tone = companyWalletRankingTone(
            row.icm,
            row.meta
        );

        const progress = companyWalletRankingProgress(
            row.icm,
            row.meta
        );

        const tooltip = companyWalletRankingTooltip(
            entityType === "company"
                ? "Empresa"
                : "Carteira",
            row.name,
            entityType === "wallet"
                ? row.company
                : "",
            row,
            rank
        );

        const rankLabel = rank
            ? "#" + rank
            : "—";

        const toggle = entityType === "company"
            ? (
                '<button type="button" ' +
                    'class="metas-company-wallet-ranking-toggle" ' +
                    'data-company-wallet-ranking-toggle="' +
                    escapeHtml(row.name) +
                    '" aria-label="' +
                    (
                        open
                            ? "Recolher "
                            : "Expandir "
                    ) +
                    escapeHtml(row.name) +
                    '">' +
                    '<i class="fa ' +
                        (
                            open
                                ? "fa-chevron-down"
                                : "fa-chevron-right"
                        ) +
                    '"></i>' +
                '</button>'
            )
            : '<span class="metas-company-wallet-ranking-branch">↳</span>';

        return (
            '<div class="metas-company-wallet-ranking-row ' +
                (
                    entityType === "company"
                        ? "is-company "
                        : "is-wallet "
                ) +
                tone.className +
                '" data-du-tip="' +
                duTooltipAttribute(tooltip) +
                '">' +
                '<span class="metas-company-wallet-rank">' +
                    escapeHtml(rankLabel) +
                '</span>' +
                '<div class="metas-company-wallet-entity">' +
                    toggle +
                    '<div>' +
                        '<strong>' +
                            escapeHtml(row.name) +
                        '</strong>' +
                        '<small>' +
                            (
                                entityType === "company"
                                    ? (
                                        walletCount +
                                        " carteira" +
                                        (
                                            walletCount === 1
                                                ? ""
                                                : "s"
                                        )
                                    )
                                    : escapeHtml(
                                        row.company
                                    )
                            ) +
                        '</small>' +
                        '<i class="metas-company-wallet-progress">' +
                            '<b style="width:' +
                                progress +
                                '%"></b>' +
                        '</i>' +
                    '</div>' +
                '</div>' +
                '<span class="metas-company-wallet-value">' +
                    '<strong>' +
                        compactCurrency(row.meta) +
                    '</strong>' +
                    '<small>Meta</small>' +
                '</span>' +
                '<span class="metas-company-wallet-value">' +
                    '<strong>' +
                        compactCurrency(row.valor_ho) +
                    '</strong>' +
                    '<small>Total HO</small>' +
                '</span>' +
                '<span class="metas-company-wallet-icm">' +
                    '<strong>' +
                        (
                            num(row.meta) > 0
                                ? percent(row.icm)
                                : "—"
                        ) +
                    '</strong>' +
                    '<small>' +
                        escapeHtml(tone.label) +
                    '</small>' +
                '</span>' +
            '</div>'
        );
    }

    function renderCompanyWalletRanking() {
        if (!el.companyWalletRanking) return;

        const data = companyWalletRankingData();
        const companies = data.companies;
        const allWallets = data.allWallets;

        const companiesWithMeta = companies.filter(
            (row) => num(row.meta) > 0
        );

        const walletsWithMeta = allWallets.filter(
            (row) => num(row.meta) > 0
        );

        const achievedCompanies = companiesWithMeta.filter(
            (row) => num(row.icm) >= 100
        ).length;

        const achievedWallets = walletsWithMeta.filter(
            (row) => num(row.icm) >= 100
        ).length;

        const topCompany = companiesWithMeta[0] || null;
        const topWallet = walletsWithMeta[0] || null;

        html(
            el.companyWalletRankingSummary,
            '<article>' +
                '<span>Top Empresa</span>' +
                '<strong>' +
                    (
                        topCompany
                            ? escapeHtml(topCompany.name)
                            : "—"
                    ) +
                '</strong>' +
                '<small>' +
                    (
                        topCompany
                            ? percent(topCompany.icm)
                            : "Sem ranking"
                    ) +
                '</small>' +
            '</article>' +
            '<article>' +
                '<span>Top Carteira</span>' +
                '<strong>' +
                    (
                        topWallet
                            ? escapeHtml(topWallet.name)
                            : "—"
                    ) +
                '</strong>' +
                '<small>' +
                    (
                        topWallet
                            ? (
                                escapeHtml(topWallet.company) +
                                " • " +
                                percent(topWallet.icm)
                            )
                            : "Sem ranking"
                    ) +
                '</small>' +
            '</article>' +
            '<article>' +
                '<span>Empresas ≥ 100%</span>' +
                '<strong>' +
                    achievedCompanies +
                    '/' +
                    companiesWithMeta.length +
                '</strong>' +
                '<small>Meta atingida</small>' +
            '</article>' +
            '<article>' +
                '<span>Carteiras ≥ 100%</span>' +
                '<strong>' +
                    achievedWallets +
                    '/' +
                    walletsWithMeta.length +
                '</strong>' +
                '<small>Meta atingida</small>' +
            '</article>'
        );

        const rows = [];

        companies.forEach((company) => {
            const open =
                state.expandedRankingCompanies.has(
                    company.name
                );

            rows.push(
                companyWalletRankingRow(
                    company,
                    "company",
                    company.rank,
                    open,
                    company.wallets.length
                )
            );

            if (open) {
                company.wallets.forEach((wallet) => {
                    rows.push(
                        companyWalletRankingRow(
                            wallet,
                            "wallet",
                            wallet.globalRank,
                            false,
                            0
                        )
                    );
                });
            }
        });

        html(
            el.companyWalletRanking,
            rows.join("") ||
                '<div class="metas-empty">Sem empresas/carteiras no recorte.</div>'
        );

        text(
            el.companyWalletExpandAll,
            state.allRankingCompaniesExpanded
                ? "Recolher empresas"
                : "Expandir empresas"
        );
    }

    function renderRankings() {
        renderRanking(el.supRanking, "superintendente", "superintendente");
        renderRanking(el.managerRanking, "gerente", "gerente");
        renderRanking(el.coordRanking, "coordenador", "coordenador");
        renderCompanyWalletRanking();
    }

    function matrixMetricDirection(metric) {
        if (metric === "meta") return "volume";
        return "performance";
    }

    function matrixVariation(currentValue, previousValue, metric) {
        const current = num(currentValue);
        const previous = num(previousValue);
        const direction = matrixMetricDirection(metric);

        if (current === previous) {
            return {
                className: "",
                tone: "neutral",
                status: "Sem variação",
                delta: 0,
                percent: previous !== 0 ? 0 : null
            };
        }

        const delta = current - previous;
        const percentValue = previous !== 0
            ? (delta / Math.abs(previous)) * 100
            : null;

        if (direction === "volume") {
            return {
                className: delta > 0
                    ? "is-matrix-volume-up"
                    : "is-matrix-volume-down",
                tone: delta > 0 ? "volume-up" : "volume-down",
                status: delta > 0
                    ? "Aumento de volume"
                    : "Redução de volume",
                delta,
                percent: percentValue
            };
        }

        return {
            className: delta > 0
                ? "is-matrix-favorable"
                : "is-matrix-attention",
            tone: delta > 0 ? "best" : "low",
            status: delta > 0
                ? "Evolução favorável"
                : "Ponto de atenção",
            delta,
            percent: percentValue
        };
    }

    function matrixMetricLabel(metric) {
        const labels = {
            producao_realizada: "Produção",
            pagamento: "Total pago",
            entrega_amigavel: "Entrega amigável",
            meta: "Meta",
            valor_ho: "Total HO",
            icm: "ICM"
        };
        return labels[metric] || metric;
    }

    function matrixDeltaLabel(variation, metric) {
        if (!variation) return "—";

        if (metric === "icm") {
            const value = num(variation.delta);
            return (
                (value > 0 ? "+" : "") +
                numberFormat(value, 2) +
                " p.p."
            );
        }

        if (variation.percent === null) {
            return "M/M —";
        }

        return (
            (variation.percent > 0 ? "+" : "") +
            percent(variation.percent)
        );
    }

    function matrixAbsoluteDelta(value, metric) {
        if (metric === "icm") {
            return (
                (value > 0 ? "+" : "") +
                numberFormat(value, 2) +
                " p.p."
            );
        }

        if (
            metric === "producao_realizada" ||
            metric === "pagamento" ||
            metric === "entrega_amigavel" ||
            metric === "meta" ||
            metric === "valor_ho"
        ) {
            return signedCurrency(value);
        }

        return (
            (value > 0 ? "+" : "") +
            numberFormat(value, 2)
        );
    }

    function matrixTooltipContent(
        entityLabel,
        month,
        previousMonth,
        currentValue,
        previousValue,
        metric,
        variation
    ) {
        const formattedCurrent = formatMetric(
            currentValue,
            metric
        );

        const formattedPrevious = formatMetric(
            previousValue,
            metric
        );

        const variationLabel = matrixDeltaLabel(
            variation,
            metric
        );

        const deltaFormatted = matrixAbsoluteDelta(
            variation.delta,
            metric
        );

        const toneClass = variation.tone === "volume-up"
            ? " is-volume-up"
            : (
                variation.tone === "volume-down"
                    ? " is-volume-down"
                    : " is-" + variation.tone
            );

        let note = variation.status + ".";

        if (metric === "meta") {
            if (variation.delta > 0) {
                note = "A meta aumentou em relação ao mês anterior. Isso representa aumento de volume, não melhora de performance.";
            } else if (variation.delta < 0) {
                note = "A meta reduziu em relação ao mês anterior. Isso representa redução de volume, não piora de performance.";
            } else {
                note = "A meta permaneceu estável em relação ao mês anterior.";
            }
        } else if (
            variation.percent === null &&
            metric !== "icm"
        ) {
            note += " O mês anterior é zero; por isso a variação percentual M/M não é calculada.";
        }

        return '' +
            '<div class="metas-du-tooltip-head">' +
                '<span>' +
                    escapeHtml(month.rotulo) +
                '</span>' +
                '<strong>' +
                    escapeHtml(entityLabel) +
                '</strong>' +
            '</div>' +
            '<div class="metas-du-tooltip-value">' +
                escapeHtml(formattedCurrent) +
            '</div>' +
            '<div class="metas-du-tooltip-badge' +
                toneClass +
                '">' +
                escapeHtml(variation.status) +
            '</div>' +
            '<div class="metas-du-tooltip-grid">' +
                '<span><small>Indicador</small><strong>' +
                    escapeHtml(matrixMetricLabel(metric)) +
                '</strong></span>' +
                '<span><small>Mês anterior</small><strong>' +
                    escapeHtml(
                        previousMonth
                            ? previousMonth.rotulo
                            : "—"
                    ) +
                '</strong></span>' +
                '<span><small>Valor anterior</small><strong>' +
                    escapeHtml(formattedPrevious) +
                '</strong></span>' +
                '<span><small>Variação</small><strong>' +
                    escapeHtml(variationLabel) +
                '</strong></span>' +
            '</div>' +
            '<div class="metas-du-tooltip-range">' +
                'Diferença absoluta: <strong>' +
                    escapeHtml(deltaFormatted) +
                '</strong>' +
            '</div>' +
            '<p class="metas-du-tooltip-note">' +
                escapeHtml(note) +
            '</p>';
    }

    function matrixCellHtml(
        entityLabel,
        months,
        index,
        currentValue,
        previousValue,
        metric
    ) {
        if (index === 0) {
            return (
                '<td class="metas-matrix-value-cell">' +
                    '<span class="metas-matrix-value-main">' +
                        formatMetric(currentValue, metric) +
                    '</span>' +
                    '<small class="metas-matrix-value-variation">M/M —</small>' +
                '</td>'
            );
        }

        const variation = matrixVariation(
            currentValue,
            previousValue,
            metric
        );

        const tooltip = matrixTooltipContent(
            entityLabel,
            months[index],
            months[index - 1],
            currentValue,
            previousValue,
            metric,
            variation
        );

        return (
            '<td class="metas-matrix-value-cell ' +
                variation.className +
                '" data-du-tip="' +
                duTooltipAttribute(tooltip) +
                '">' +
                '<span class="metas-matrix-value-main">' +
                    formatMetric(currentValue, metric) +
                '</span>' +
                '<small class="metas-matrix-value-variation">' +
                    escapeHtml(
                        matrixDeltaLabel(
                            variation,
                            metric
                        )
                    ) +
                '</small>' +
            '</td>'
        );
    }

    function renderMatrix() {
        if (!el.matrixHead || !el.matrixBody) return;

        const months = monthsInScope();
        const metric = el.matrixMetric
            ? el.matrixMetric.value
            : "producao_realizada";

        const universeRecords = dimensionUniverseRecords();
        const universeMetas = dimensionUniverseMetas();

        const companies = new Set();
        universeRecords.forEach((item) => {
            if (item.empresa) companies.add(item.empresa);
        });
        universeMetas.forEach((item) => {
            if (item.empresa) companies.add(item.empresa);
        });

        const companyList = Array.from(companies)
            .filter(Boolean)
            .sort((a, b) =>
                normalize(a).localeCompare(normalize(b))
            );

        html(
            el.matrixHead,
            '<tr>' +
                '<th class="metas-matrix-name-head">' +
                    '<span>Empresa / Carteira</span>' +
                '</th>' +
                months.map((month) =>
                    '<th class="metas-matrix-month-head">' +
                        '<span>' +
                            escapeHtml(month.rotulo) +
                        '</span>' +
                    '</th>'
                ).join("") +
                '<th class="metas-matrix-total-head">' +
                    '<span>Total</span>' +
                '</th>' +
            '</tr>'
        );

        const rows = [];

        companyList.forEach((company) => {
            const open = state.expandedCompanies.has(company);

            const records = state.filteredRecords.filter(
                (item) =>
                    normalize(item.empresa) === normalize(company)
            );

            const metas = state.filteredMetas.filter(
                (item) =>
                    normalize(item.empresa) === normalize(company)
            );

            const companyTotal = aggregate(records, metas);

            const companyMonthAggregates = months.map((month) =>
                aggregate(
                    records.filter(
                        (item) =>
                            item.mes === month.chave
                    ),
                    metas.filter(
                        (item) =>
                            item.mes === month.chave
                    )
                )
            );

            rows.push(
                '<tr class="metas-matrix-company">' +
                    '<td>' +
                        '<button type="button" ' +
                            'class="metas-company-toggle" ' +
                            'data-company-toggle="' +
                            escapeHtml(company) +
                            '">' +
                            '<i class="fa ' +
                                (open
                                    ? 'fa-chevron-down'
                                    : 'fa-chevron-right') +
                            '"></i>' +
                            escapeHtml(company) +
                        '</button>' +
                    '</td>' +
                    companyMonthAggregates.map(
                        (monthAggregate, index) => {
                            const currentValue =
                                monthAggregate[metric];

                            const previousValue = index > 0
                                ? companyMonthAggregates[
                                    index - 1
                                ][metric]
                                : 0;

                            return matrixCellHtml(
                                company,
                                months,
                                index,
                                currentValue,
                                previousValue,
                                metric
                            );
                        }
                    ).join("") +
                    '<td class="metas-matrix-total-cell">' +
                        formatMetric(
                            companyTotal[metric],
                            metric
                        ) +
                    '</td>' +
                '</tr>'
            );

            if (open) {
                const walletNames = new Set();

                universeRecords
                    .filter(
                        (item) =>
                            normalize(item.empresa) ===
                            normalize(company)
                    )
                    .forEach((item) => {
                        if (item.carteira) {
                            walletNames.add(item.carteira);
                        }
                    });

                universeMetas
                    .filter(
                        (item) =>
                            normalize(item.empresa) ===
                            normalize(company)
                    )
                    .forEach((item) => {
                        if (item.carteira) {
                            walletNames.add(item.carteira);
                        }
                    });

                Array.from(walletNames)
                    .sort((a, b) =>
                        normalize(a).localeCompare(normalize(b))
                    )
                    .forEach((wallet) => {
                        const walletRecords = records.filter(
                            (item) =>
                                normalize(item.carteira) ===
                                normalize(wallet)
                        );

                        const walletMetas = metas.filter(
                            (item) =>
                                normalize(item.carteira) ===
                                normalize(wallet)
                        );

                        const walletTotal = aggregate(
                            walletRecords,
                            walletMetas
                        );

                        const walletMonthAggregates = months.map(
                            (month) =>
                                aggregate(
                                    walletRecords.filter(
                                        (item) =>
                                            item.mes ===
                                            month.chave
                                    ),
                                    walletMetas.filter(
                                        (item) =>
                                            item.mes ===
                                            month.chave
                                    )
                                )
                        );

                        const walletLabel =
                            company + " • " + wallet;

                        rows.push(
                            '<tr class="metas-matrix-wallet">' +
                                '<td>↳ ' +
                                    escapeHtml(wallet) +
                                '</td>' +
                                walletMonthAggregates.map(
                                    (monthAggregate, index) => {
                                        const currentValue =
                                            monthAggregate[metric];

                                        const previousValue =
                                            index > 0
                                                ? walletMonthAggregates[
                                                    index - 1
                                                ][metric]
                                                : 0;

                                        return matrixCellHtml(
                                            walletLabel,
                                            months,
                                            index,
                                            currentValue,
                                            previousValue,
                                            metric
                                        );
                                    }
                                ).join("") +
                                '<td class="metas-matrix-total-cell metas-matrix-wallet-total">' +
                                    formatMetric(
                                        walletTotal[metric],
                                        metric
                                    ) +
                                '</td>' +
                            '</tr>'
                        );
                    });
            }
        });

        html(
            el.matrixBody,
            rows.join("") ||
                '<tr><td class="metas-empty">Sem empresa/carteira no recorte.</td></tr>'
        );
    }

    function metaLookup() {
        const map = new Map();
        state.filteredMetas.forEach((item) => map.set(String(item.carteira_id) + '|' + item.mes, num(item.meta)));
        return map;
    }

    function analyticRows() {
        const search = normalize(state.analytic.search);
        let rows = state.filteredRecords;
        if (search) {
            rows = rows.filter((item) => normalize([item.empresa, item.carteira, item.tipo_carteira, item.producao_carteira, item.atuacao_carteira, digitalProfileLabel(item.digital), item.superintendente, item.gerente, item.coordenador].join(' ')).includes(search));
        }
        return rows.slice().sort((a, b) => String(b.data).localeCompare(String(a.data)) || num(b.id) - num(a.id));
    }

    function renderAnalytic() {
        if (!el.analyticBody) return;
        const all = analyticRows();
        const pages = Math.max(1, Math.ceil(all.length / state.analytic.pageSize));
        state.analytic.page = Math.min(state.analytic.page, pages);
        const start = (state.analytic.page - 1) * state.analytic.pageSize;
        const rows = all.slice(start, start + state.analytic.pageSize);
        const metas = metaLookup();

        html(el.analyticBody, rows.map((item) => {
            const meta = metas.get(String(item.carteira_id) + '|' + item.mes) || 0;
            return '<tr><td>' + formatDateBr(item.data) + '</td>' +
                '<td>' + (item.dia_util_numero == null ? '—' : item.dia_util_numero + '/' + item.total_dias_uteis_mes) + '</td>' +
                '<td>' + escapeHtml(item.empresa) + '</td><td>' + escapeHtml(item.carteira) + '</td><td>' + escapeHtml(item.tipo_carteira) + '</td>' +
                '<td>' + escapeHtml(item.producao_carteira) + '</td><td>' + escapeHtml(item.atuacao_carteira) + '</td><td>' + escapeHtml(digitalProfileLabel(item.digital)) + '</td>' +
                '<td>' + currency(item.producao_realizada) + '</td><td>' + currency(item.pagamento) + '</td><td>' + currency(item.valor_ho) + '</td><td>' + currency(item.entrega_amigavel) + '</td>' +
                '<td>' + (item.competencia_meta ? formatDateBr(item.competencia_meta) : '—') + '</td><td>' + currency(meta) + '</td>' +
                '<td>' + escapeHtml(item.superintendente) + '</td><td>' + escapeHtml(item.gerente) + '</td><td>' + escapeHtml(item.coordenador) + '</td></tr>';
        }).join("") || '<tr><td colspan="17" class="metas-empty">Nenhum registro encontrado.</td></tr>');
        text(el.analyticCount, numberFormat(all.length) + ' registros');
        renderPagination(pages);
    }

    function renderPagination(pages) {
        if (!el.analyticPagination) return;
        const current = state.analytic.page;
        const buttons = [];
        buttons.push('<button type="button" data-page="' + Math.max(1, current - 1) + '">‹</button>');
        const start = Math.max(1, current - 2);
        const end = Math.min(pages, start + 4);
        for (let p = start; p <= end; p += 1) buttons.push('<button type="button" class="' + (p === current ? 'is-active' : '') + '" data-page="' + p + '">' + p + '</button>');
        buttons.push('<button type="button" data-page="' + Math.min(pages, current + 1) + '">›</button>');
        html(el.analyticPagination, buttons.join(""));
    }

    function exportCsv() {
        const metas = metaLookup();
        const rows = [["Data produção", "D.U.", "Total D.U. mês", "Empresa", "Carteira", "Tipo carteira", "Produção carteira", "Atuação", "Digital", "Quantidade base", "Valor carteira", "Produção realizada", "Pagamento", "HO", "Entrega amigável", "Competência meta", "Meta", "Superintendente", "Gerente", "Coordenador", "Diretor"]];
        analyticRows().forEach((item) => rows.push([item.data, item.dia_util_numero || "", item.total_dias_uteis_mes, item.empresa, item.carteira, item.tipo_carteira, item.producao_carteira, item.atuacao_carteira, digitalProfileLabel(item.digital), item.quantidade_base, item.valor_carteira, item.producao_realizada, item.pagamento, item.valor_ho, item.entrega_amigavel, item.competencia_meta, metas.get(String(item.carteira_id) + '|' + item.mes) || 0, item.superintendente, item.gerente, item.coordenador, item.diretor]));
        const csv = '\ufeff' + rows.map((row) => row.map((cell) => '"' + String(cell == null ? '' : cell).replace(/"/g, '""') + '"').join(';')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'dashboard_producao_metas.csv';
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    function renderAll() {
        renderCompositionVisuals();
        renderKpis();
        renderMonthlyComparison();
        renderInsights();
        renderMonthlyCharts();
        renderDaily();
        renderDuComparison();
        renderRankings();
        renderMatrix();
        renderAnalytic();
    }

    function clearFilter(key) {
        if (Object.prototype.hasOwnProperty.call(state.filters, key)) state.filters[key] = "";
        const map = { empresa: el.company, carteira: el.wallet, atuacao_carteira: el.actuation, superintendente: el.superintendent, gerente: el.manager, coordenador: el.coordinator };
        if (map[key]) value(map[key], "");
        applyFilters(false);
    }

    function clearAll() {
        applyDashboardDefaults();

        value(
            el.dateStart,
            state.filters.dateStart
        );
        value(
            el.dateEnd,
            state.filters.dateEnd
        );

        [
            el.company,
            el.wallet,
            el.actuation,
            el.superintendent,
            el.manager,
            el.coordinator
        ].forEach(
            (control) =>
                value(control, "")
        );

        state.analytic.search = "";
        value(el.analyticSearch, "");

        applyFilters(false);
    }

    function setSnapshot(data, preserve) {
        if (!data || typeof data !== 'object' || data.erro) throw new Error(data && data.mensagem ? data.mensagem : 'Resposta inválida do dashboard.');
        state.raw = data;
        state.records = Array.isArray(data.registros) ? data.registros : [];
        state.metas = Array.isArray(data.metas) ? data.metas : [];
        text(el.dataSource, 'Banco Workspace Qore');
        text(el.updated, data.atualizado_em || '—');
        populateControls(Boolean(preserve));
        applyFilters(false);
        showStatus('', false);
    }

    async function loadData(source) {
        if (state.loading || !el.url) return;
        showLoading(true);
        showStatus('', false);
        try {
            const url = new URL(el.url, window.location.origin);
            url.searchParams.set('dados', '1');
            url.searchParams.set('_', String(Date.now()));
            const response = await fetch(url.toString(), { headers: { 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'same-origin', cache: 'no-store' });
            const contentType = response.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) throw new Error('A view dashboard_metas não retornou JSON.');
            const data = await response.json();
            if (!response.ok || data.erro) throw new Error(data.detalhe || data.mensagem || 'Erro ao consultar o dashboard.');
            setSnapshot(data, source === 'refresh');
            if (source === 'refresh') toast('Dados atualizados com sucesso.');
        } catch (error) {
            console.error('Dashboard Produção e Metas:', error);
            const message = error && error.message ? error.message : 'Erro ao carregar o dashboard.';
            showStatus(message, true);
            toast(message, true);
        } finally {
            showLoading(false);
        }
    }

    function toggleTheme() {
        const root = document.documentElement;
        root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
        try { localStorage.setItem('metas-theme', root.dataset.theme); } catch (_) {}
        syncTheme();
    }

    function syncTheme() {
        const dark = document.documentElement.dataset.theme === 'dark';
        if (el.themeIcon) el.themeIcon.className = 'fa ' + (dark ? 'fa-sun-o' : 'fa-moon-o');
        text(el.themeText, dark ? 'Modo claro' : 'Modo escuro');
    }

    function initTheme() {
        try {
            const saved = localStorage.getItem('metas-theme');
            if (saved === 'dark' || saved === 'light') document.documentElement.dataset.theme = saved;
        } catch (_) {}
        syncTheme();
    }

    function toggleAnalysisGuide() {
        if (!el.analysisGuideToggle || !el.analysisGuideDetails) return;

        const open = el.analysisGuideDetails.hidden;
        el.analysisGuideDetails.hidden = !open;
        el.analysisGuideToggle.setAttribute("aria-expanded", open ? "true" : "false");

        if (el.analysisGuide) {
            el.analysisGuide.classList.toggle("is-open", open);
        }

        const label = el.analysisGuideToggle.querySelector("span");
        const icon = el.analysisGuideToggle.querySelector("i");

        if (label) {
            label.textContent = open ? "Ocultar explicação" : "Entenda os indicadores";
        }

        if (icon) {
            icon.className = "fa " + (open ? "fa-chevron-up" : "fa-chevron-down");
        }
    }

    function initSectionNavigation() {
        const nav = byId("metasSectionNav");
        const slot = byId("metasSectionNavSlot");

        if (!nav || !slot) return;

        const shell =
            nav.closest(".metas-shell");

        const items = Array.from(
            nav.querySelectorAll(
                "[data-section-nav]"
            )
        );

        if (!items.length) return;

        const sections = items
            .map((item) => {
                const section =
                    byId(
                        item.dataset.sectionNav
                    );

                return section
                    ? {
                        item,
                        section
                    }
                    : null;
            })
            .filter(Boolean);

        let forcedDock = false;
        let naturalSlotTop = 0;
        let navTopOffset = 8;
        let scrollRaf = 0;

        const setActive = (sectionId) => {
            items.forEach((item) => {
                item.classList.toggle(
                    "is-active",
                    item.dataset.sectionNav ===
                        sectionId
                );
            });
        };

        /*
         * Detecta a barra principal do Workspace (navbar/topbar)
         * e mantém a navegação interna logo abaixo dela.
         *
         * Assim funciona tanto quando a navbar do projeto é fixed
         * quanto sticky, sem depender de um nome específico.
         */
        const detectWorkspaceTopOffset = () => {
            let fixedTopBottom = 0;

            const candidates =
                document.querySelectorAll(
                    [
                        "header",
                        "nav",
                        "[class*='navbar']",
                        "[class*='topbar']",
                        "[class*='top-bar']",
                        "[class*='main-header']",
                        "[class*='site-header']"
                    ].join(",")
                );

            candidates.forEach((candidate) => {
                if (
                    candidate === nav ||
                    candidate.contains(nav) ||
                    nav.contains(candidate)
                ) {
                    return;
                }

                const style =
                    window.getComputedStyle(
                        candidate
                    );

                if (
                    style.position !== "fixed" &&
                    style.position !== "sticky"
                ) {
                    return;
                }

                const rect =
                    candidate
                        .getBoundingClientRect();

                if (
                    rect.height <= 0 ||
                    rect.height > 130 ||
                    rect.width <
                        window.innerWidth * .55 ||
                    rect.top > 12 ||
                    rect.bottom <= 0
                ) {
                    return;
                }

                fixedTopBottom =
                    Math.max(
                        fixedTopBottom,
                        rect.bottom
                    );
            });

            navTopOffset =
                Math.max(
                    8,
                    Math.round(
                        fixedTopBottom
                    ) + 8
                );

            nav.style.setProperty(
                "--metas-nav-top",
                navTopOffset + "px"
            );
        };

        const measureNaturalSlot = () => {
            naturalSlotTop =
                slot.getBoundingClientRect()
                    .top +
                window.scrollY;
        };

        const applyDockGeometry = () => {
            if (!shell) return;

            const shellRect =
                shell.getBoundingClientRect();

            nav.style.left =
                Math.max(
                    shellRect.left,
                    0
                ) + "px";

            nav.style.width =
                shellRect.width + "px";
        };

        const dockNav = () => {
            nav.classList.add(
                "is-docked"
            );

            applyDockGeometry();
        };

        const undockNav = () => {
            nav.classList.remove(
                "is-docked"
            );

            nav.style.left = "";
            nav.style.width = "";
        };

        const navVisibleBottom = () => {
            if (
                nav.classList.contains(
                    "is-docked"
                )
            ) {
                return (
                    navTopOffset +
                    nav.getBoundingClientRect()
                        .height
                );
            }

            return nav
                .getBoundingClientRect()
                .bottom;
        };

        const updateActiveSection = () => {
            if (!sections.length) return;

            const threshold =
                navVisibleBottom() + 18;

            let active =
                sections[0].section;

            sections.forEach(({ section }) => {
                const rect =
                    section
                        .getBoundingClientRect();

                if (
                    rect.top <= threshold
                ) {
                    active = section;
                }
            });

            if (active && active.id) {
                setActive(active.id);
            }
        };

        const syncDockedNav = () => {
            detectWorkspaceTopOffset();

            const slotRect =
                slot.getBoundingClientRect();

            /*
             * Ao voltar para o topo natural da barra,
             * ela pode voltar ao fluxo normal.
             */
            if (
                window.scrollY <=
                Math.max(
                    naturalSlotTop -
                    navTopOffset -
                    2,
                    0
                )
            ) {
                forcedDock = false;
            }

            const shouldDock =
                forcedDock ||
                slotRect.top <=
                    navTopOffset;

            if (shouldDock) {
                dockNav();
            } else {
                undockNav();
            }

            updateActiveSection();
        };

        const scrollToSection = (
            sectionId
        ) => {
            const section =
                byId(sectionId);

            if (!section) return;

            setActive(sectionId);

            /*
             * VISÃO GERAL é o único item que volta para o estado
             * inicial completo do dashboard:
             * Hero + barra na posição natural + início da página.
             *
             * Ou seja, ao clicar em Visão Geral a barra deixa de
             * ficar congelada e retorna para baixo do hero, como
             * quando o dashboard é aberto pela primeira vez.
             */
            if (
                sectionId ===
                "metas-section-overview"
            ) {
                forcedDock = false;

                detectWorkspaceTopOffset();

                const shellTop =
                    shell
                        ? (
                            shell
                                .getBoundingClientRect()
                                .top +
                            window.scrollY
                        )
                        : 0;

                /*
                 * Desconta somente a navbar principal do Workspace.
                 * A navegação interna voltará ao fluxo natural.
                 */
                const workspaceHeaderHeight =
                    Math.max(
                        navTopOffset - 8,
                        0
                    );

                const targetTop =
                    Math.max(
                        shellTop -
                        workspaceHeaderHeight -
                        8,
                        0
                    );

                window.scrollTo({
                    top: targetTop,
                    behavior: "smooth"
                });

                /*
                 * Durante a subida, a própria rotina de scroll mantém
                 * a barra fixa apenas enquanto necessário e a recolhe
                 * automaticamente quando o slot natural volta à tela.
                 */
                try {
                    window.history.replaceState(
                        null,
                        "",
                        "#" + sectionId
                    );
                } catch (_) {}

                return;
            }

            /*
             * Demais seções:
             * congela imediatamente a barra antes do scroll e
             * posiciona a seção exatamente logo abaixo dela.
             */
            forcedDock = true;

            detectWorkspaceTopOffset();
            dockNav();

            window.requestAnimationFrame(
                () => {
                    const navHeight =
                        nav.getBoundingClientRect()
                            .height;

                    const targetTop =
                        section
                            .getBoundingClientRect()
                            .top +
                        window.scrollY -
                        navTopOffset -
                        navHeight -
                        12;

                    window.scrollTo({
                        top: Math.max(
                            targetTop,
                            0
                        ),
                        behavior: "smooth"
                    });
                }
            );

            try {
                window.history.replaceState(
                    null,
                    "",
                    "#" + sectionId
                );
            } catch (_) {}
        };

        items.forEach((item) => {
            item.addEventListener(
                "click",
                (event) => {
                    const sectionId =
                        item.dataset.sectionNav;

                    if (
                        !sectionId ||
                        !byId(sectionId)
                    ) {
                        return;
                    }

                    event.preventDefault();

                    scrollToSection(
                        sectionId
                    );
                }
            );
        });

        const onScroll = () => {
            if (scrollRaf) return;

            scrollRaf =
                window.requestAnimationFrame(
                    () => {
                        scrollRaf = 0;
                        syncDockedNav();
                    }
                );
        };

        const onResize = () => {
            detectWorkspaceTopOffset();
            measureNaturalSlot();
            syncDockedNav();
        };

        detectWorkspaceTopOffset();
        measureNaturalSlot();
        syncDockedNav();

        window.addEventListener(
            "scroll",
            onScroll,
            { passive: true }
        );

        window.addEventListener(
            "resize",
            onResize
        );

        /*
         * Se a página abrir com uma âncora válida,
         * aplica a mesma regra de posicionamento.
         */
        const hashSection =
            window.location.hash
                ? window.location.hash
                    .replace("#", "")
                : "";

        if (
            hashSection &&
            byId(hashSection)
        ) {
            window.setTimeout(
                () => {
                    scrollToSection(
                        hashSection
                    );
                },
                120
            );
        }
    }

    function bindEvents() {
        [el.dateStart, el.dateEnd, el.company, el.wallet, el.actuation, el.superintendent, el.manager, el.coordinator].forEach((control) => control && control.addEventListener('change', () => applyFilters(true)));
        if (el.refresh) el.refresh.addEventListener('click', () => loadData('refresh'));
        if (el.analysisGuideToggle) el.analysisGuideToggle.addEventListener('click', toggleAnalysisGuide);
        if (el.clear) el.clear.addEventListener('click', clearAll);
        if (el.theme) el.theme.addEventListener('click', toggleTheme);
        if (el.advancedToggle) el.advancedToggle.addEventListener('click', () => {
            if (!el.advanced) return;
            el.advanced.hidden = !el.advanced.hidden;
            el.advancedToggle.classList.toggle('is-active', !el.advanced.hidden);
        });
        if (el.dailyMonth) el.dailyMonth.addEventListener('change', () => {
            state.daily.fullTable = false;
            renderDaily();
        });

        if (el.dailyMetric) el.dailyMetric.addEventListener('change', renderDaily);

        if (el.dailyTableToggle) el.dailyTableToggle.addEventListener('click', () => {
            state.daily.fullTable = !state.daily.fullTable;
            renderDaily();
        });
        if (el.duMetric) el.duMetric.addEventListener('change', renderDuComparison);
        if (el.matrixMetric) el.matrixMetric.addEventListener('change', renderMatrix);
        if (el.expandCompanies) el.expandCompanies.addEventListener('click', () => {
            const companies = new Set();
            dimensionUniverseRecords().forEach((item) => item.empresa && companies.add(item.empresa));
            dimensionUniverseMetas().forEach((item) => item.empresa && companies.add(item.empresa));
            if (state.allExpanded) state.expandedCompanies.clear();
            else companies.forEach((company) => state.expandedCompanies.add(company));
            state.allExpanded = !state.allExpanded;
            text(el.expandCompanies, state.allExpanded ? 'Recolher todas' : 'Expandir todas');
            renderMatrix();
        });
        if (el.companyWalletExpandAll) {
            el.companyWalletExpandAll.addEventListener(
                'click',
                () => {
                    const companies =
                        companyWalletRankingData()
                            .companies
                            .map((item) => item.name);

                    if (
                        state.allRankingCompaniesExpanded
                    ) {
                        state.expandedRankingCompanies.clear();
                    } else {
                        companies.forEach((company) => {
                            state.expandedRankingCompanies.add(
                                company
                            );
                        });
                    }

                    state.allRankingCompaniesExpanded =
                        !state.allRankingCompaniesExpanded;

                    renderCompanyWalletRanking();
                }
            );
        }
        if (el.analyticSearch) el.analyticSearch.addEventListener('input', () => { state.analytic.search = el.analyticSearch.value || ''; state.analytic.page = 1; renderAnalytic(); });
        if (el.analyticPageSize) el.analyticPageSize.addEventListener('change', () => { state.analytic.pageSize = Number(el.analyticPageSize.value || 25); state.analytic.page = 1; renderAnalytic(); });
        if (el.exportCsv) el.exportCsv.addEventListener('click', exportCsv);

        document.addEventListener('mouseover', (event) => {
            const cell = event.target.closest('[data-du-tip]');
            if (cell) showDuTooltip(cell, event);
        });

        document.addEventListener('mousemove', (event) => {
            if (el.duTooltip && el.duTooltip.classList.contains('is-visible')) {
                positionDuTooltip(event);
            }
        });

        document.addEventListener('mouseout', (event) => {
            const cell = event.target.closest('[data-du-tip]');
            if (!cell) return;
            const related = event.relatedTarget;
            if (!related || !cell.contains(related)) hideDuTooltip();
        });

        document.addEventListener('click', (event) => {
            const dailyChartMode = event.target.closest('[data-daily-chart-mode]');
            if (dailyChartMode) {
                state.daily.chartMode =
                    dailyChartMode.dataset.dailyChartMode === 'flow'
                        ? 'flow'
                        : 'pace';
                renderDaily();
                return;
            }

            const allPeriod = event.target.closest('[data-period-all]');
            if (allPeriod) {
                state.filters.dateStart =
                    periodStart();

                state.filters.dateEnd =
                    periodEnd();

                state.periodUserSelected =
                    false;

                value(
                    el.dateStart,
                    state.filters.dateStart
                );

                value(
                    el.dateEnd,
                    state.filters.dateEnd
                );

                applyFilters(false);
                return;
            }

            const month = event.target.closest('[data-month]');
            if (month) { applyMonth(month.dataset.month); return; }

            const dimension = event.target.closest('[data-dimension-key]');
            if (dimension) {
                const key = dimension.dataset.dimensionKey;
                const newValue = dimension.dataset.dimensionValue || '';
                state.filters[key] = normalize(state.filters[key]) === normalize(newValue) ? '' : newValue;
                applyFilters(false);
                return;
            }

            const clear = event.target.closest('[data-clear-filter]');
            if (clear) { clearFilter(clear.dataset.clearFilter); return; }

            const ranking = event.target.closest('[data-ranking-key]');
            if (ranking) {
                const key = ranking.dataset.rankingKey;
                const selected = ranking.dataset.rankingValue || '';
                state.filters[key] = normalize(state.filters[key]) === normalize(selected) ? '' : selected;
                const map = { superintendente: el.superintendent, gerente: el.manager, coordenador: el.coordinator };
                if (map[key]) value(map[key], state.filters[key]);
                applyFilters(false);
                return;
            }

            const companyRanking = event.target.closest(
                '[data-company-wallet-ranking-toggle]'
            );

            if (companyRanking) {
                const name =
                    companyRanking.dataset
                        .companyWalletRankingToggle;

                if (
                    state.expandedRankingCompanies.has(
                        name
                    )
                ) {
                    state.expandedRankingCompanies.delete(
                        name
                    );
                } else {
                    state.expandedRankingCompanies.add(
                        name
                    );
                }

                state.allRankingCompaniesExpanded = false;

                text(
                    el.companyWalletExpandAll,
                    'Expandir empresas'
                );

                renderCompanyWalletRanking();
                return;
            }

            const company = event.target.closest('[data-company-toggle]');
            if (company) {
                const name = company.dataset.companyToggle;
                if (state.expandedCompanies.has(name)) state.expandedCompanies.delete(name);
                else state.expandedCompanies.add(name);
                state.allExpanded = false;
                text(el.expandCompanies, 'Expandir todas');
                renderMatrix();
                return;
            }

            const page = event.target.closest('[data-page]');
            if (page) {
                state.analytic.page = Number(page.dataset.page || 1);
                renderAnalytic();
            }
        });
    }

    function init() {
        cacheElements();
        const required = ['form', 'dateStart', 'dateEnd', 'monthButtons', 'kpis', 'dailyBody', 'duHead', 'duBody', 'matrixHead', 'matrixBody', 'analyticBody'];
        const missing = required.filter((key) => !el[key]);
        if (missing.length) {
            console.error('Dashboard Produção e Metas - elementos HTML ausentes:', missing);
            showStatus('Estrutura HTML incompleta: ' + missing.join(', '), true);
            return;
        }
        initTheme();
        initSectionNavigation();

        if (
            el.analysisGuide &&
            el.analysisGuideToggle &&
            el.analysisGuideDetails
        ) {
            el.analysisGuideDetails.hidden = false;
            el.analysisGuide.classList.add(
                "is-open"
            );
            el.analysisGuideToggle.setAttribute(
                "aria-expanded",
                "true"
            );

            const guideLabel =
                el.analysisGuideToggle
                    .querySelector("span");

            const guideIcon =
                el.analysisGuideToggle
                    .querySelector("i");

            if (guideLabel) {
                guideLabel.textContent =
                    "Ocultar explicação";
            }

            if (guideIcon) {
                guideIcon.className =
                    "fa fa-chevron-up";
            }
        }

        if (el.matrixMetric) {
            el.matrixMetric.value = "producao_realizada";
        }

        bindEvents();
        loadData('initial');
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
}());
