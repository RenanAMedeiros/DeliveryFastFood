(function () {
    "use strict";

    const COLUMNS = [
        { key: "ticket_number", label: "Ticket", type: "text", help: "Número identificador do ticket no TiFlux. Passe o mouse sobre o ticket para visualizar os apontamentos vinculados." },
        { key: "title", label: "Título", type: "text", help: "Título original informado no ticket." },
        { key: "soma_horas_apontadas", label: "Horas Apontadas", type: "duration", help: "Soma de todos os apontamentos do ticket, calculada pela diferença em minutos entre beginning e ending e exibida em HH:MM." },
        { key: "description", label: "Descrição", type: "text", help: "Descrição do TiFlux convertida para texto limpo. Esta coluna fica oculta por padrão e pode ser habilitada no seletor de colunas." },
        { key: "created_at", label: "Criação", type: "date", help: "Data e hora originais de criação do ticket." },
        { key: "data_criacao_calculada", label: "Data criação", type: "date_only", help: "Somente a data de created_at, equivalente à coluna DATA_CRIACAO do cálculo." },
        { key: "faixa_hora_criacao", label: "Faixa hora criação", type: "shift", help: "Classifica a criação: segunda a sexta, 08:00–11:59 = Manhã; 12:00–17:59 = Tarde; demais horários = Fora do Expediente." },
        { key: "solved_in_time", label: "Fechamento / solução", type: "date", help: "Data e hora de solução retornada por solved_in_time." },
        { key: "data_fechamento2", label: "Data fechamento", type: "date_only", help: "Somente a data de solved_in_time, equivalente à DATA_FECHAMENTO2." },
        { key: "dias_aberto", label: "Dias aberto", type: "number", unit: "dias", help: "Dias entre DATA_CRIACAO e DATA_FECHAMENTO2; enquanto não houver fechamento, calcula até hoje." },
        { key: "dias_aberto_ou_resolvido", label: "Dias aberto ou resolvido", type: "number", unit: "dias", help: "Dias entre a criação e a solução quando o ticket está fechado; caso contrário, até o momento atual." },
        { key: "faixa_dias_aberto", label: "Faixa dias aberto", type: "band", help: "Agrupa o tempo em 0-2, 3-5, 6-10, 11-20 ou +20 dias." },
        { key: "attend_expiration", label: "Prazo atendimento", type: "date", help: "Data e hora limite para o primeiro atendimento." },
        { key: "prazo_real_primeiro_atendimento_minutos", label: "Prazo real 1º atendimento", type: "number", unit: "min", help: "Minutos úteis entre criação e prazo de atendimento, contando apenas segunda a sexta das 08:00 às 18:00." },
        { key: "solve_expiration", label: "Prazo solução", type: "date", help: "Data e hora limite de solução do ticket." },
        { key: "data_solucao", label: "Data solução SLA", type: "date_only", help: "Data derivada de solve_expiration e utilizada na comparação do status de SLA." },
        { key: "prazo_real_solucao_minutos", label: "Prazo real solução", type: "number", unit: "min", help: "Minutos úteis entre criação e prazo de solução, contando apenas segunda a sexta das 08:00 às 18:00." },
        { key: "status_sla", label: "Status SLA", type: "sla", help: "Aberto: compara hoje com a data limite de solução. Fechado: compara a data de fechamento com a data limite de solução." },
        { key: "origem_ticket", label: "Origem ticket", type: "origin", help: "METADADOS quando Ticket CSLOG começa com #; CSLOG quando há valor preenchido; QORE quando o campo está vazio." },
        { key: "updated_at", label: "Atualização", type: "date", help: "Última atualização registrada no ticket." },
        { key: "attend_sla_solution", label: "SLA atendimento", type: "text", help: "Valor de SLA de atendimento retornado pela fonte TiFlux." },
        { key: "attend_first_sla_attendance", label: "1º atendimento no SLA", type: "text", help: "Indicador da fonte sobre o primeiro atendimento dentro do SLA." },
        { key: "last_answer_type", label: "Última resposta", type: "text", help: "Tipo da última resposta registrada no ticket." },
        { key: "desk_name", label: "Mesa", type: "text", help: "Mesa responsável pelo ticket no TiFlux." },
        { key: "requestor_name", label: "Solicitante", type: "text", help: "Solicitante tratado para a visão operacional do dashboard." },
        { key: "requestor_email", label: "E-mail solicitante", type: "text", help: "E-mail do solicitante retornado pelo campo requestor_email do TiFlux." },
        { key: "client_name", label: "Cliente", type: "text", help: "Cliente relacionado ao ticket." },
        { key: "responsible_name", label: "Responsável", type: "text", help: "Responsável atual pelo ticket." },
        { key: "responsible_email", label: "E-mail responsável", type: "text", help: "E-mail do responsável atual retornado pelo campo responsible_email do TiFlux." },
        { key: "followers", label: "Seguidores", type: "text", help: "Seguidores do ticket retornados pelo campo followers do TiFlux." },
        { key: "stage_name", label: "Estágio", type: "text", help: "Estágio atual do fluxo do ticket." },
        { key: "services_catalogs_item_name", label: "Item catálogo", type: "text", help: "Item do catálogo de serviços relacionado ao ticket." },
        { key: "services_catalogs_area_name", label: "Área catálogo", type: "text", help: "Área do catálogo de serviços." },
        { key: "servico_completo", label: "Serviço Completo", type: "text", help: "Combinação da Área catálogo com o Item catálogo no formato Área > Item." },
        { key: "services_catalog_name", label: "Catálogo", type: "text", help: "Catálogo de serviços do ticket." },
        { key: "ticket_cslog", label: "Ticket CSLOG", type: "text", help: "Conteúdo do campo Sistemas-Ticket CSLOG-NÃO PREENCHER utilizado também para classificar a origem do ticket." },
        { key: "categoria", label: "Categoria", type: "text", help: "Categoria registrada no ticket." },
        { key: "empresa", label: "Empresa", type: "text", help: "Empresa relacionada ao ticket." },
        { key: "nome_projeto", label: "Nome projeto", type: "text", help: "Nome do projeto informado no TiFlux para integração com o módulo Projetos." },
        { key: "projeto_cadastrado", label: "Projeto cadastrado", type: "project_boolean", help: "Indica se o ticket já está vinculado a um projeto do Workspace." },
        { key: "projeto_codigo", label: "Código projeto", type: "text", help: "Código do projeto vinculado no Workspace." },
        { key: "projeto_status_nome", label: "Status projeto", type: "text", help: "Status atual do projeto vinculado." },
        { key: "projeto_integracao_motivo", label: "Integração", type: "text", help: "Resultado ou motivo da integração automática entre o ticket e Projetos." },
        { key: "projeto_url", label: "Ação projeto", type: "project_link", help: "Atalho para abrir o projeto vinculado quando disponível." },
        { key: "is_closed", label: "Situação", type: "boolean", help: "Situação operacional do ticket: Aberto ou Fechado." },
    ];

    const PAGE_SIZE = 25;
    const CLOSED_ONLY_COLUMNS = new Set(["solved_in_time", "data_fechamento2"]);
    const elements = {};
    let sourceTickets = [];
    let globalFiltered = [];
    let tableFiltered = [];
    let activeView = "open";
    let summaryFilter = null;
    let currentPage = 1;
    let sortKey = "created_at";
    let sortDirection = "desc";
    let columnOrder = loadArray("tickets-column-order", COLUMNS.map(c => c.key));
    let hiddenColumns = new Set(loadArray("tickets-hidden-columns", []));
    const DESCRIPTION_DEFAULT_HIDDEN_KEY = "tickets-description-default-hidden-v2";
    let columnFilters = {};
    let toastTimer = null;
    let draggedKey = null;
    let renderedRows = [];
    let smartTooltipTarget = null;
    const STATUS_REPORT_LEADERS = [
        { name: "Emanuela Soares da Silva", area: "Processos", aliases: ["Emanuela Silva"], members: ["Danilo Araujo Mendonça", "Tamiris Marques de Araujo", "Fernanda Lisboa", "Caio Siqueira"] },
        { name: "Renan Medeiros", area: "Desenvolvimento", members: ["Gabriel Torrecilla", "Arthur Costa", "Felipe Alexandrino", "Eduarda Nascimento Oliveira", "Renan Balbino"] },
        { name: "Gustavo Dantas", area: "Business Intelligence", aliases: ["Gustavo Rodrigo", "Gustavo Rodrigues"], members: ["Rodrigo Sanches"] },
    ];
    const STATUS_DECISION_OPTIONS = [
        "Felipe Alexandrino",
        "Leonardo Queiroz",
        "Equipe Técnica",
        "Cliente Contratante",
        "Fornecedor",
        "Felipe / Leonardo",
        "Líderes",
        "Felipe / Líderes",
        "Líderes / Equipe Técnica",
        "Líderes / Leonardo / Equipe Técnica",
        "Felipe / Leonardo / Líderes",
        "Felipe / Leonardo / Líderes / Equipe Técnica",
    ];
    const STATUS_IMPACT_OPTIONS = ["Cliente Contratante", "SLA", "Diretoria", "Equipe", "Todos"];
    const STATUS_ACTION_RESPONSIBLE_OPTIONS = [
        "Felipe Alexandrino",
        "Emanuela Soares da Silva",
        "Danilo Araujo Mendonça",
        "Tamiris Marques de Araujo",
        "Fernanda Lisboa",
        "Caio Siqueira",
        "Renan Medeiros",
        "Gabriel Torrecilla",
        "Arthur Costa",
        "Eduarda Nascimento Oliveira",
        "Renan Balbino",
        "Gustavo Dantas",
        "Rodrigo Sanches",
    ];
    let ticketsSourceUpdatedAt = "";
    let ticketsLatestAt = "";
    let statusReportTickets = [];
    let statusReportTicketsDate = "";
    let statusReportLoaded = false;
    let statusReportPayload = null;
    let statusReportView = "summary";
    let statusDecisionFilter = { status: "open", decisor: "all", leader: "all", search: "" };
    let statusDecisionSearchTimer = null;

    document.addEventListener("DOMContentLoaded", init);

    function init() {
        mapElements();
        applyDescriptionDefaultVisibility();
        sanitizeColumnState();
        moveAnalyticFiltersToGlobal();
        elements.dateEnd.value = isoToday();
        initTheme();
        bindEvents();
        renderColumnsMenu();
        renderTableHead();
        switchSection("#tickets-section-overview", false);
        loadData(false);
    }

    function mapElements() {
        const ids = [
            "ticketsFilters", "ticketsDateStart", "ticketsDateEnd",
            "ticketsClearButton", "ticketsRefreshButton", "ticketsThemeButton",
            "ticketsThemeIcon", "ticketsThemeText", "ticketsLoading",
            "ticketsStatus", "ticketsToast", "ticketsUpdatedAt",
            "ticketsPeriodStatus", "ticketsPeriodBadge", "ticketsTotal",
            "ticketsStartKpi", "ticketsEndKpi", "ticketsLatestKpi",
            "ticketsOpenKpi", "ticketsClosedKpi", "ticketsResponsibleKpi",
            "ticketsCompanyKpi", "ticketsClientKpi",
            "ticketsSearch", "ticketsDeskFilter", "ticketsClientFilter",
            "ticketsResponsibleFilter", "ticketsStageFilter", "ticketsStatusFilter",
            "ticketsCategoryFilter", "ticketsCompanyFilter", "ticketsCatalogFilter",
            "ticketsProjectFilter", "ticketsDaysBandFilter",
            "ticketsCreationShiftFilter", "ticketsOriginFilter",
            "ticketsExportCsv", "ticketsTableExpand", "ticketsTableCard",
            "ticketsActiveFilters", "ticketsTableHead", "ticketsTableBody",
            "ticketsTableCount", "ticketsPagination", "ticketsOpenTab",
            "ticketsClosedTab", "ticketsOpenTabCount", "ticketsClosedTabCount",
            "ticketsFiltersToggle", "ticketsFiltersBody", "ticketsFiltersToggleText",
            "ticketsFiltersToggleIcon", "ticketsAnalyticToggle", "ticketsAnalyticBody",
            "ticketsColumnsButton", "ticketsColumnsMenu", "ticketsDeskRanking",
            "ticketsResponsibleRanking", "ticketsCompanyRanking", "ticketsClientRanking",
            "ticketsSummaryTotal", "ticketsSummaryOpen", "ticketsSummaryClosed",
            "ticketsSummaryResponsible", "ticketsSummaryCompany", "ticketsSummaryClient",
            "ticketsSummaryProject",
            "ticketsAttendAll", "ticketsAttendOverdue", "ticketsAttendToday",
            "ticketsAttendTomorrow", "ticketsSolveAll", "ticketsSolveOverdue",
            "ticketsSolveToday", "ticketsSolveTomorrow", "ticketsSmartTooltip",
            "ticketsStatusReportSection", "ticketsStatusReportContent",
            "ticketsStatusReportDate", "ticketsStatusReportLeader",
            "ticketsStatusReportSituation", "ticketsStatusReportRefresh",
            "ticketsStatusReportUpdated",
        ];
        ids.forEach(id => elements[toCamel(id.replace(/^tickets/, "")) || "form"] = document.getElementById(id));
        elements.form = document.getElementById("ticketsFilters");
        elements.dateStart = document.getElementById("ticketsDateStart");
        elements.dateEnd = document.getElementById("ticketsDateEnd");
    }

    function toCamel(value) {
        if (!value) return "";
        return value.charAt(0).toLowerCase() + value.slice(1);
    }

    function bindEvents() {
        elements.form.addEventListener("submit", event => {
            event.preventDefault();
            loadData(false);
        });
        elements.clearButton.addEventListener("click", clearAllFilters);
        elements.refreshButton.addEventListener("click", () => loadData(true));
        elements.themeButton.addEventListener("click", toggleTheme);
        elements.filtersToggle.addEventListener("click", () => togglePanel(
            elements.filtersBody, elements.filtersToggle,
            elements.filtersToggleText, elements.filtersToggleIcon
        ));
        elements.analyticToggle.addEventListener("click", () => togglePanel(
            elements.analyticBody, elements.analyticToggle,
            elements.analyticToggle.querySelector("span"), null
        ));
        elements.openTab.addEventListener("click", () => setView("open"));
        elements.closedTab.addEventListener("click", () => setView("closed"));
        document.querySelectorAll("[data-summary-filter]").forEach(card => {
            const activate = () => setSummaryFilter(card.dataset.summaryFilter);
            card.addEventListener("click", activate);
            card.addEventListener("keydown", event => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    activate();
                }
            });
        });
        elements.search.addEventListener("input", resetAndApply);
        [
            elements.deskFilter, elements.clientFilter, elements.responsibleFilter,
            elements.stageFilter, elements.statusFilter, elements.categoryFilter,
            elements.companyFilter, elements.catalogFilter, elements.projectFilter,
            elements.daysBandFilter, elements.creationShiftFilter, elements.originFilter,
        ].filter(Boolean).forEach(element => element.addEventListener("change", resetAndApply));
        elements.exportCsv.addEventListener("click", exportCsv);
        elements.tableExpand?.addEventListener("click", toggleTableExpand);
        elements.columnsButton.addEventListener("click", toggleColumnsMenu);
        document.addEventListener("click", event => {
            if (!event.target.closest(".tickets-columns-menu-wrap")) {
                elements.columnsMenu.hidden = true;
                elements.columnsButton.setAttribute("aria-expanded", "false");
            }
        });
        bindSectionNavigation();
        bindStatusReport();
        bindSmartTableTooltip();
        document.addEventListener("keydown", event => {
            if (event.key === "Escape" && elements.tableCard?.classList.contains("is-expanded")) {
                setTableExpanded(false);
            }
        });
    }

    async function loadData(forceRefresh) {
        const start = elements.dateStart.value;
        const end = elements.dateEnd.value;
        if (!start || !end || start > end) {
            showToast("Informe um período válido.", true);
            return;
        }
        const params = new URLSearchParams({ dados: "1", data_inicial: start, data_final: end });
        if (forceRefresh) params.set("refresh", "1");
        showLoading(true);
        setStatus("", false, true);
        try {
            const response = await fetch(`${elements.form.dataset.url}?${params}`, {
                headers: { "X-Requested-With": "XMLHttpRequest", "Accept": "application/json" },
                cache: "no-store",
            });
            const payload = await response.json();
            if (!response.ok || !payload.sucesso) {
                throw new Error(payload.erro || payload.mensagem || "Falha ao carregar tickets.");
            }
            sourceTickets = Array.isArray(payload.tickets) ? payload.tickets.slice() : [];
            renderMetadata(payload);
            populateGlobalFilters();
            activeView = "open";
            summaryFilter = null;
            updateTabState();
            currentPage = 1;
            applyFilters();
            if (statusReportLoaded) renderStatusReport();
            if (payload.aviso) setStatus(payload.aviso, false, false);
            showToast(forceRefresh ? "Dados atualizados com sucesso." : "Dashboard carregado.");
        } catch (error) {
            console.error(error);
            setStatus(error.message, true, false);
            showToast(error.message, true);
            sourceTickets = [];
            applyFilters();
        } finally {
            showLoading(false);
        }
    }

    function renderMetadata(payload) {
        const start = payload.data_inicial || elements.dateStart.value;
        const end = payload.data_final || elements.dateEnd.value;
        elements.startKpi.textContent = formatDate(start);
        elements.endKpi.textContent = formatDate(end);
        elements.latestKpi.textContent = formatDateTime(payload.ultima_data_encontrada);
        ticketsSourceUpdatedAt = payload.atualizado_em || "";
        ticketsLatestAt = payload.ultima_data_encontrada || "";
        elements.updatedAt.textContent = formatDateTime(payload.atualizado_em);
        const period = `${formatDate(start)} até ${formatDate(end)}`;
        elements.periodStatus.textContent = period;
        elements.periodBadge.textContent = period;
        elements.dateStart.value = start;
        elements.dateEnd.value = end;
    }

    function populateGlobalFilters() {
        fillSelect(elements.deskFilter, uniqueValues("desk_name"), "Todas");
        fillSelect(elements.clientFilter, uniqueValues("client_name"), "Todos");
        fillSelect(elements.responsibleFilter, uniqueValues("responsible_name"), "Todos");
        fillSelect(elements.stageFilter, uniqueValues("stage_name"), "Todos");
        fillSelect(elements.statusFilter, uniqueValues("status"), "Todos");
        fillSelect(elements.categoryFilter, uniqueValues("categoria"), "Todas");
        fillSelect(elements.companyFilter, uniqueValues("empresa"), "Todas");
        fillSelect(elements.catalogFilter, uniqueValues("services_catalog_name"), "Todos");
        fillSelect(elements.daysBandFilter, uniqueValues("faixa_dias_aberto"), "Todas");
        fillSelect(elements.creationShiftFilter, uniqueValues("faixa_hora_criacao"), "Todas");
        fillSelect(elements.originFilter, uniqueValues("origem_ticket"), "Todas");
    }

    function applyFilters() {
        const term = normalize(elements.search.value);
        globalFiltered = sourceTickets.filter(ticket => {
            if (elements.deskFilter.value && ticket.desk_name !== elements.deskFilter.value) return false;
            if (elements.clientFilter.value && ticket.client_name !== elements.clientFilter.value) return false;
            if (elements.responsibleFilter.value && ticket.responsible_name !== elements.responsibleFilter.value) return false;
            if (elements.stageFilter.value && ticket.stage_name !== elements.stageFilter.value) return false;
            if (elements.statusFilter.value && ticket.status !== elements.statusFilter.value) return false;
            if (elements.categoryFilter.value && ticket.categoria !== elements.categoryFilter.value) return false;
            if (elements.companyFilter.value && ticket.empresa !== elements.companyFilter.value) return false;
            if (elements.catalogFilter.value && ticket.services_catalog_name !== elements.catalogFilter.value) return false;
            if (elements.projectFilter.value && ticket.projeto_integracao_status !== elements.projectFilter.value) return false;
            if (elements.daysBandFilter.value && ticket.faixa_dias_aberto !== elements.daysBandFilter.value) return false;
            if (elements.creationShiftFilter.value && ticket.faixa_hora_criacao !== elements.creationShiftFilter.value) return false;
            if (elements.originFilter.value && ticket.origem_ticket !== elements.originFilter.value) return false;
            if (term && !normalize(COLUMNS.map(column => valueFor(ticket, column)).join(" ")).includes(term)) return false;
            return true;
        });

        const openTickets = globalFiltered.filter(ticket => !isClosed(ticket));
        const closedTickets = globalFiltered.filter(isClosed);
        let viewTickets = activeView === "closed"
            ? closedTickets
            : activeView === "all" ? globalFiltered : openTickets;
        viewTickets = viewTickets.filter(matchesSummaryFilter);

        tableFiltered = viewTickets.filter(ticket => {
            return Object.entries(columnFilters).every(([key, value]) => {
                if (!value) return true;
                const column = columnByKey(key);
                return normalize(valueFor(ticket, column)).includes(normalize(value));
            });
        });
        sortTickets();
        renderKpis(openTickets, closedTickets);
        renderSummaryFilterState();
        renderRankings();
        renderActiveFilters();
        renderTable();
        renderPagination();
    }

    function renderKpis(openTickets, closedTickets) {
        elements.total.textContent = number(globalFiltered.length);
        elements.openKpi.textContent = number(openTickets.length);
        elements.closedKpi.textContent = number(closedTickets.length);
        elements.responsibleKpi.textContent = number(distinct(globalFiltered, "responsible_name"));
        elements.companyKpi.textContent = number(distinct(globalFiltered, "empresa"));
        elements.clientKpi.textContent = number(distinct(globalFiltered, "client_name"));
        elements.openTabCount.textContent = number(openTickets.length);
        elements.closedTabCount.textContent = number(closedTickets.length);

        elements.summaryTotal.textContent = number(globalFiltered.length);
        elements.summaryOpen.textContent = number(openTickets.length);
        elements.summaryClosed.textContent = number(closedTickets.length);
        elements.summaryResponsible.textContent = number(distinct(globalFiltered, "responsible_name"));
        elements.summaryCompany.textContent = number(distinct(globalFiltered, "empresa"));
        elements.summaryClient.textContent = number(distinct(globalFiltered, "client_name"));
        elements.summaryProject.textContent = number(distinctProjects(globalFiltered));

        const attend = deadlineSummary(openTickets, "attend_expiration");
        const solve = deadlineSummary(openTickets, "solve_expiration");
        elements.attendAll.textContent = number(attend.all);
        elements.attendOverdue.textContent = number(attend.overdue);
        elements.attendToday.textContent = number(attend.today);
        elements.attendTomorrow.textContent = number(attend.tomorrow);
        elements.solveAll.textContent = number(solve.all);
        elements.solveOverdue.textContent = number(solve.overdue);
        elements.solveToday.textContent = number(solve.today);
        elements.solveTomorrow.textContent = number(solve.tomorrow);
    }

    function deadlineSummary(items, key) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const afterTomorrow = new Date(tomorrow);
        afterTomorrow.setDate(afterTomorrow.getDate() + 1);
        const result = { all: 0, overdue: 0, today: 0, tomorrow: 0 };

        items.forEach(ticket => {
            const date = parseDate(ticket[key]);
            if (!date) return;
            date.setHours(0, 0, 0, 0);
            result.all += 1;
            if (date < today) result.overdue += 1;
            else if (date < tomorrow) result.today += 1;
            else if (date < afterTomorrow) result.tomorrow += 1;
        });
        return result;
    }

    function renderRankings() {
        renderRanking(elements.deskRanking, "desk_name");
        renderRanking(elements.responsibleRanking, "responsible_name");
        renderRanking(elements.companyRanking, "empresa");
        renderRanking(elements.clientRanking, "client_name");
    }

    function renderRanking(container, key) {
        const counts = new Map();
        globalFiltered.forEach(ticket => {
            const label = cleanDisplayValue(ticket[key]);
            if (!label) return;
            counts.set(label, (counts.get(label) || 0) + 1);
        });
        const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
        const max = rows.length ? rows[0][1] : 1;
        container.innerHTML = rows.length ? rows.map(([label, count], index) => `
            <button type="button" class="tickets-ranking-row" data-value="${escapeHtml(label)}">
                <span>${index + 1}</span><div><strong>${escapeHtml(label)}</strong><i><b style="width:${Math.max(4, count / max * 100)}%"></b></i></div><em>${number(count)}</em>
            </button>`).join("") : `<div class="metas-empty">Sem dados para o recorte.</div>`;
    }

    function renderTableHead() {
        const visible = visibleColumns();
        elements.tableHead.innerHTML = `
            <tr class="tickets-column-title-row">
                ${visible.map(column => `
                    <th draggable="true" data-key="${column.key}" data-smart-tooltip="header">
                        <button type="button" class="tickets-sort-button" data-sort="${column.key}">
                            <span>${escapeHtml(column.label)}</span>
                            <i class="fa ${sortIcon(column.key)}"></i>
                        </button>
                    </th>`).join("")}
            </tr>`;
        elements.tableHead.querySelectorAll("[data-sort]").forEach(button => {
            button.addEventListener("click", () => setSort(button.dataset.sort));
        });
        bindColumnDrag();
    }

    function renderTable() {
        const columns = visibleColumns();
        const size = PAGE_SIZE;
        const start = (currentPage - 1) * size;
        const rows = tableFiltered.slice(start, start + size);
        renderedRows = rows;
        hideSmartTooltip();
        if (!rows.length) {
            elements.tableBody.innerHTML = `<tr><td colspan="${Math.max(1, columns.length)}" class="tickets-table-empty">Nenhum ticket ${activeView === "open" ? "aberto" : "fechado"} encontrado.</td></tr>`;
            elements.tableCount.textContent = "0 registros";
            return;
        }
        elements.tableBody.innerHTML = rows.map((ticket, rowIndex) => `<tr data-row-index="${rowIndex}">${columns.map(column => renderCell(ticket, column, rowIndex)).join("")}</tr>`).join("");
        elements.tableCount.textContent = `${number(start + 1)}–${number(Math.min(start + size, tableFiltered.length))} de ${number(tableFiltered.length)} registros`;
    }

    function renderCell(ticket, column, rowIndex) {
        const attrs = `data-key="${column.key}" data-row-index="${rowIndex}" data-smart-tooltip="cell"`;
        if (column.key === "ticket_number") {
            const ticketValue = valueFor(ticket, column);
            return `<td ${attrs}><strong class="tickets-ticket-number">${ticketValue ? `#${escapeHtml(ticketValue)}` : ""}</strong></td>`;
        }
        if (column.type === "project_boolean") {
            const linked = Boolean(ticket.projeto_cadastrado);
            return `<td ${attrs}><span class="tickets-state ${linked ? "is-open" : "is-closed"}"><i></i>${linked ? "Sim" : "Não"}</span></td>`;
        }
        if (column.type === "project_link") {
            return ticket.projeto_url
                ? `<td ${attrs}><a class="tickets-project-link" href="${escapeHtml(ticket.projeto_url)}"><i class="fa fa-external-link"></i>Abrir projeto</a></td>`
                : ticket.projeto_integracao_status === "pendente"
                    ? `<td ${attrs}><span class="tickets-project-pending">Aguardando sincronização</span></td>`
                    : `<td ${attrs}></td>`;
        }
        if (column.key === "is_closed") {
            const closed = isClosed(ticket);
            return `<td ${attrs}><span class="tickets-state ${closed ? "is-closed" : "is-open"}"><i></i>${closed ? "Fechado" : "Aberto"}</span></td>`;
        }

        const value = valueFor(ticket, column);
        if (column.type === "sla") {
            if (!value) return `<td ${attrs}></td>`;
            const state = normalize(value).replace(/\s+/g, "-");
            return `<td ${attrs}><span class="tickets-sla tickets-sla--${state}"><i></i>${escapeHtml(value)}</span></td>`;
        }
        if (column.type === "origin") {
            if (!value) return `<td ${attrs}></td>`;
            return `<td ${attrs}><span class="tickets-origin tickets-origin--${normalize(value)}">${escapeHtml(value)}</span></td>`;
        }
        if (column.type === "band" || column.type === "shift") {
            if (!value) return `<td ${attrs}></td>`;
            return `<td ${attrs}><span class="tickets-classification">${escapeHtml(value)}</span></td>`;
        }
        if (column.type === "duration") {
            const display = valueFor(ticket, column) || "00:00";
            return `<td ${attrs} class="tickets-cell-number"><span class="tickets-metric">${escapeHtml(display)}</span></td>`;
        }
        if (column.type === "number") {
            const raw = ticket[column.key];
            if (raw === null || raw === undefined || raw === "") return `<td ${attrs}></td>`;
            const display = column.unit === "min"
                ? formatDurationMinutes(raw)
                : column.unit === "dias"
                    ? `${number(raw)} dias`
                    : number(raw);
            return `<td ${attrs} class="tickets-cell-number"><span class="tickets-metric">${escapeHtml(display)}</span></td>`;
        }
        const longText = column.key === "description" || column.key === "title";
        return `<td ${attrs}><span class="tickets-cell-text ${longText ? "is-long" : ""}">${escapeHtml(value)}</span></td>`;
    }

    function valueFor(ticket, column) {
        if (!column) return "";
        const value = ticket[column.key];
        if (column.type === "date") return formatDateTimeTable(value);
        if (column.type === "date_only") return formatDateTable(value);
        if (column.type === "boolean") return isClosed(ticket) ? "Fechado" : "Aberto";
        if (column.type === "project_boolean") return ticket.projeto_cadastrado ? "Sim" : "Não";
        if (column.type === "project_link") return String(ticket.projeto_url || "");
        if (column.type === "duration") return cleanDisplayValue(value) || "00:00";
        if (column.type === "number" && column.unit === "min") {
            return value === null || value === undefined || value === "" ? "" : formatDurationMinutes(value);
        }
        return cleanDisplayValue(value);
    }

    function bindSmartTableTooltip() {
        const table = document.querySelector(".tickets-table");
        if (!table || !elements.smartTooltip) return;

        table.addEventListener("mouseover", event => {
            const target = event.target.closest("[data-smart-tooltip]");
            if (!target || !table.contains(target) || target === smartTooltipTarget) return;
            showSmartTooltip(target);
        });
        table.addEventListener("mousemove", event => {
            if (smartTooltipTarget) positionSmartTooltip(event.clientX, event.clientY);
        });
        table.addEventListener("mouseout", event => {
            const target = event.target.closest("[data-smart-tooltip]");
            if (!target || target !== smartTooltipTarget) return;
            if (event.relatedTarget && target.contains(event.relatedTarget)) return;
            if (event.relatedTarget && elements.smartTooltip?.contains(event.relatedTarget)) return;
            hideSmartTooltip();
        });
        table.addEventListener("focusin", event => {
            const target = event.target.closest("[data-smart-tooltip]");
            if (target) showSmartTooltip(target, true);
        });
        table.addEventListener("focusout", () => hideSmartTooltip());
        elements.smartTooltip.addEventListener("mouseleave", () => hideSmartTooltip());
        window.addEventListener("scroll", hideSmartTooltip, true);
        window.addEventListener("resize", hideSmartTooltip);
    }

    function showSmartTooltip(target, fromKeyboard = false) {
        const key = target.dataset.key;
        const column = columnByKey(key);
        if (!column) return;

        let value = column.label;
        let detail = column.help || "Campo da base analítica de tickets.";
        if (target.dataset.smartTooltip === "cell") {
            const rowIndex = Number(target.dataset.rowIndex);
            const ticket = renderedRows[rowIndex];
            if (!ticket) return;
            if (column.key === "ticket_number") {
                showAppointmentsTooltip(ticket);
                smartTooltipTarget = target;
                if (fromKeyboard) {
                    const rect = target.getBoundingClientRect();
                    positionSmartTooltip(rect.left + rect.width / 2, rect.bottom + 8);
                }
                return;
            }
            value = valueFor(ticket, column);
            detail = intelligentCellDetail(ticket, column);
        }

        resetSmartTooltipInlineStyle();
        elements.smartTooltip.innerHTML = `
            <strong>${escapeHtml(column.label)}</strong>
            <span>${escapeHtml(value)}</span>
            <p>${escapeHtml(detail)}</p>`;
        elements.smartTooltip.classList.add("is-visible");
        elements.smartTooltip.setAttribute("aria-hidden", "false");
        smartTooltipTarget = target;

        if (fromKeyboard) {
            const rect = target.getBoundingClientRect();
            positionSmartTooltip(rect.left + rect.width / 2, rect.bottom + 8);
        }
    }

    function resetSmartTooltipInlineStyle() {
        if (!elements.smartTooltip) return;
        elements.smartTooltip.style.width = "";
        elements.smartTooltip.style.maxWidth = "";
        elements.smartTooltip.style.maxHeight = "";
        elements.smartTooltip.style.overflow = "";
        elements.smartTooltip.style.pointerEvents = "";
        elements.smartTooltip.style.padding = "";
    }

    function showAppointmentsTooltip(ticket) {
        const appointments = Array.isArray(ticket.apontamentos) ? ticket.apontamentos : [];
        const total = cleanDisplayValue(ticket.soma_horas_apontadas) || "00:00";
        const ticketNumber = cleanDisplayValue(ticket.ticket_number || ticket.ticket);
        const title = cleanDisplayValue(ticket.title);

        elements.smartTooltip.style.width = "min(900px, calc(100vw - 24px))";
        elements.smartTooltip.style.maxWidth = "min(900px, calc(100vw - 24px))";
        elements.smartTooltip.style.maxHeight = "70vh";
        elements.smartTooltip.style.overflow = "auto";
        elements.smartTooltip.style.pointerEvents = "auto";
        elements.smartTooltip.style.padding = "0";

        const header = `
            <div style="padding:12px 14px 10px;border-bottom:1px solid rgba(148,163,184,.35);">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
                    <div>
                        <strong style="display:block;font-size:15px;line-height:1.2;">Apontamentos · #${escapeHtml(ticketNumber)}</strong>
                        <span style="display:block;margin-top:3px;font-size:12px;opacity:.78;">${escapeHtml(title)}</span>
                    </div>
                    <div style="display:flex;gap:14px;align-items:center;white-space:nowrap;">
                        <span style="font-size:12px;opacity:.78;">${number(appointments.length)} lançamento(s)</span>
                        <strong style="font-size:16px;">Total ${escapeHtml(total)}</strong>
                    </div>
                </div>
            </div>`;

        if (!appointments.length) {
            elements.smartTooltip.innerHTML = `${header}<div style="padding:18px 14px;font-size:13px;">Nenhum apontamento encontrado para este ticket.</div>`;
            elements.smartTooltip.classList.add("is-visible");
            elements.smartTooltip.setAttribute("aria-hidden", "false");
            return;
        }

        const rows = appointments.map(item => `
            <tr>
                <td style="padding:8px 9px;border-bottom:1px solid rgba(148,163,184,.22);vertical-align:top;min-width:185px;">${escapeHtml(cleanDisplayValue(item.catalogo) || "—")}</td>
                <td style="padding:8px 9px;border-bottom:1px solid rgba(148,163,184,.22);vertical-align:top;min-width:135px;">${escapeHtml(cleanDisplayValue(item.apontador) || "—")}</td>
                <td style="padding:8px 9px;border-bottom:1px solid rgba(148,163,184,.22);vertical-align:top;white-space:nowrap;">${escapeHtml(formatDateTimeTable(item.beginning) || "—")}</td>
                <td style="padding:8px 9px;border-bottom:1px solid rgba(148,163,184,.22);vertical-align:top;white-space:nowrap;">${escapeHtml(formatDateTimeTable(item.ending) || "—")}</td>
                <td style="padding:8px 9px;border-bottom:1px solid rgba(148,163,184,.22);vertical-align:top;text-align:center;white-space:nowrap;font-weight:700;">${escapeHtml(cleanDisplayValue(item.duracao) || "00:00")}</td>
                <td style="padding:8px 9px;border-bottom:1px solid rgba(148,163,184,.22);vertical-align:top;min-width:190px;white-space:normal;">${escapeHtml(cleanDisplayValue(item.descricao) || "—")}</td>
            </tr>`).join("");

        elements.smartTooltip.innerHTML = `${header}
            <div style="overflow:auto;max-height:calc(70vh - 70px);">
                <table style="width:100%;border-collapse:collapse;font-size:11px;line-height:1.25;">
                    <thead style="position:sticky;top:0;z-index:1;">
                        <tr>
                            <th style="padding:8px 9px;text-align:left;white-space:nowrap;">Nome Catálogo</th>
                            <th style="padding:8px 9px;text-align:left;white-space:nowrap;">Nome do Apontador</th>
                            <th style="padding:8px 9px;text-align:left;white-space:nowrap;">Início</th>
                            <th style="padding:8px 9px;text-align:left;white-space:nowrap;">Fim</th>
                            <th style="padding:8px 9px;text-align:center;white-space:nowrap;">Horas</th>
                            <th style="padding:8px 9px;text-align:left;white-space:nowrap;">Descrição</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`;
        elements.smartTooltip.classList.add("is-visible");
        elements.smartTooltip.setAttribute("aria-hidden", "false");
    }

    function hideSmartTooltip() {
        if (!elements.smartTooltip) return;
        elements.smartTooltip.classList.remove("is-visible");
        elements.smartTooltip.setAttribute("aria-hidden", "true");
        resetSmartTooltipInlineStyle();
        smartTooltipTarget = null;
    }

    function positionSmartTooltip(x, y) {
        const tooltip = elements.smartTooltip;
        if (!tooltip || !tooltip.classList.contains("is-visible")) return;
        const gap = 14;
        const rect = tooltip.getBoundingClientRect();
        let left = x + gap;
        let top = y + gap;
        if (left + rect.width > window.innerWidth - 12) left = Math.max(12, x - rect.width - gap);
        if (top + rect.height > window.innerHeight - 12) top = Math.max(12, y - rect.height - gap);
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
    }

    function intelligentCellDetail(ticket, column) {
        const key = column.key;
        if (key === "soma_horas_apontadas") {
            const quantidade = Number(ticket.quantidade_apontamentos || (Array.isArray(ticket.apontamentos) ? ticket.apontamentos.length : 0));
            return `Total de ${valueFor(ticket, column)} em ${quantidade} apontamento(s). Cada lançamento usa DATEDIFF(beginning, ending, MINUTE) e a soma é exibida em HH:MM.`;
        }
        if (key === "prazo_real_primeiro_atendimento_minutos" || key === "prazo_real_solucao_minutos") {
            const rawMinutes = ticket[key];
            const minutes = rawMinutes === null || rawMinutes === undefined || rawMinutes === "" ? NaN : Number(rawMinutes);
            const formatted = Number.isFinite(minutes) ? formatBusinessMinutes(minutes) : "sem cálculo disponível";
            const destination = key === "prazo_real_primeiro_atendimento_minutos" ? "prazo de atendimento" : "prazo de solução";
            return `Tempo útil entre a criação e o ${destination}: ${formatted}. Conta somente segunda a sexta, das 08:00 às 18:00.`;
        }
        if (key === "status_sla") {
            if (!ticket.data_solucao) return "Sem prazo de solução válido: seguindo a regra DAX informada, o resultado fica Em Atraso.";
            if (ticket.data_fechamento2) {
                return `Ticket fechado: compara o fechamento em ${formatDate(ticket.data_fechamento2)} com o prazo de solução em ${formatDate(ticket.data_solucao)}.`;
            }
            return `Ticket aberto: compara a data de hoje com o prazo de solução em ${formatDate(ticket.data_solucao)}.`;
        }
        if (key === "origem_ticket") {
            if (ticket.origem_ticket === "METADADOS") return "Classificado como METADADOS porque o campo Ticket CSLOG começa com # e possui conteúdo após o caractere.";
            if (ticket.origem_ticket === "CSLOG") return "Classificado como CSLOG porque o campo Ticket CSLOG está preenchido e não começa com #.";
            return "Classificado como QORE porque o campo Ticket CSLOG está vazio.";
        }
        if (key === "dias_aberto") {
            return ticket.data_fechamento2
                ? `Diferença em dias entre ${formatDate(ticket.data_criacao_calculada)} e o fechamento em ${formatDate(ticket.data_fechamento2)}.`
                : `Ticket ainda sem fechamento: diferença entre ${formatDate(ticket.data_criacao_calculada)} e hoje.`;
        }
        if (key === "dias_aberto_ou_resolvido") {
            return isClosed(ticket) && ticket.solved_in_time
                ? `Ticket fechado: contabiliza da criação até solved_in_time (${formatDateTime(ticket.solved_in_time)}).`
                : "Ticket aberto ou sem solved_in_time: contabiliza da criação até o momento atual.";
        }
        if (key === "faixa_hora_criacao") {
            return "Expediente considerado: segunda a sexta, 08:00–17:59. Antes de 12:00 = manhã; a partir de 12:00 = tarde.";
        }
        if (key === "faixa_dias_aberto") {
            return `Faixa calculada a partir de ${ticket.dias_aberto_ou_resolvido ?? ""} dias aberto/resolvido.`;
        }
        if (key === "description") return "Texto limpo da descrição do TiFlux. Tags HTML são removidas antes de exibir e antes de enviar ao módulo Projetos.";
        if (key === "data_criacao_calculada") return `Derivada de created_at (${formatDateTime(ticket.created_at)}), descartando a hora.`;
        if (key === "data_fechamento2") return ticket.solved_in_time ? `Derivada de solved_in_time (${formatDateTime(ticket.solved_in_time)}), descartando a hora.` : "Sem solved_in_time; DATA_FECHAMENTO2 permanece vazia.";
        if (key === "data_solucao") return ticket.solve_expiration ? `Derivada do prazo de solução (${formatDateTime(ticket.solve_expiration)}), descartando a hora.` : "Sem prazo de solução válido.";
        if (column.type === "date") return `${column.help} Valor completo: ${valueFor(ticket, column)}.`;
        return column.help || "Campo da base analítica de tickets.";
    }

    function formatBusinessMinutes(value) {
        const minutes = Math.max(0, Number(value || 0));
        const hours = Math.floor(minutes / 60);
        const rest = minutes % 60;
        if (!hours) return `${rest} min úteis`;
        if (!rest) return `${hours}h úteis`;
        return `${hours}h ${rest}min úteis`;
    }


    function setView(view) {
        activeView = view;
        summaryFilter = null;
        currentPage = 1;
        updateTabState();
        ensureAvailableColumnState();
        renderColumnsMenu();
        renderTableHead();
        applyFilters();
    }

    function updateTabState() {
        elements.openTab.classList.toggle("is-active", activeView === "open");
        elements.closedTab.classList.toggle("is-active", activeView === "closed");
    }

    function setSummaryFilter(filter) {
        const repeated = summaryFilter === filter;
        summaryFilter = repeated ? null : filter;
        if (repeated) activeView = "open";
        else if (filter === "closed") activeView = "closed";
        else if (filter === "open" || filter.startsWith("attend-") || filter.startsWith("solve-")) activeView = "open";
        else activeView = "all";
        currentPage = 1;
        updateTabState();
        ensureAvailableColumnState();
        renderColumnsMenu();
        renderTableHead();
        applyFilters();
        document.getElementById("ticketsBaseSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function matchesSummaryFilter(ticket) {
        if (!summaryFilter || summaryFilter === "all" || summaryFilter === "open" || summaryFilter === "closed") return true;
        if (summaryFilter === "has-responsible") return hasMeaningfulValue(ticket.responsible_name);
        if (summaryFilter === "has-company") return hasMeaningfulValue(ticket.empresa);
        if (summaryFilter === "has-client") return hasMeaningfulValue(ticket.client_name);
        if (summaryFilter === "has-project") return Boolean(ticket.projeto_cadastrado || ticket.projeto_id || cleanDisplayValue(ticket.projeto_codigo));

        const parts = summaryFilter.split("-");
        const key = parts[0] === "attend" ? "attend_expiration" : "solve_expiration";
        const bucket = parts.slice(1).join("-");
        return deadlineBucket(ticket[key]) === bucket || (bucket === "all" && deadlineBucket(ticket[key]) !== "none");
    }

    function deadlineBucket(value) {
        const date = parseDate(value);
        if (!date) return "none";
        date.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const afterTomorrow = new Date(tomorrow);
        afterTomorrow.setDate(afterTomorrow.getDate() + 1);
        if (date < today) return "overdue";
        if (date < tomorrow) return "today";
        if (date < afterTomorrow) return "tomorrow";
        return "future";
    }

    function renderSummaryFilterState() {
        document.querySelectorAll("[data-summary-filter]").forEach(card => {
            const active = card.dataset.summaryFilter === summaryFilter;
            card.classList.toggle("is-active", active);
            card.setAttribute("aria-pressed", String(active));
        });
    }

    function setSort(key) {
        if (sortKey === key) sortDirection = sortDirection === "asc" ? "desc" : "asc";
        else { sortKey = key; sortDirection = "asc"; }
        currentPage = 1;
        renderTableHead();
        applyFilters();
    }

    function sortTickets() {
        const column = columnByKey(sortKey);
        tableFiltered.sort((a, b) => {
            let av = a[sortKey];
            let bv = b[sortKey];
            if (column && (column.type === "date" || column.type === "date_only")) { av = Date.parse(av) || 0; bv = Date.parse(bv) || 0; }
            else if (column && column.type === "duration") { av = Number(a.horas_apontadas_minutos ?? 0); bv = Number(b.horas_apontadas_minutos ?? 0); }
            else if (column && column.type === "number") { av = Number(av ?? 0); bv = Number(bv ?? 0); }
            else if (column && column.type === "boolean") { av = isClosed(a) ? 1 : 0; bv = isClosed(b) ? 1 : 0; }
            else { av = normalize(av); bv = normalize(bv); }
            const result = av < bv ? -1 : av > bv ? 1 : 0;
            return sortDirection === "asc" ? result : -result;
        });
    }

    function sortIcon(key) {
        if (sortKey !== key) return "fa-sort";
        return sortDirection === "asc" ? "fa-sort-asc" : "fa-sort-desc";
    }

    function renderColumnsMenu() {
        const available = columnOrder
            .map(columnByKey)
            .filter(Boolean)
            .filter(column => isColumnAvailable(column.key));
        elements.columnsMenu.innerHTML = available.map(column => (
            `<label><input type="checkbox" data-column-visible="${column.key}" ${hiddenColumns.has(column.key) ? "" : "checked"}><span>${escapeHtml(column.label)}</span></label>`
        )).join("");
        elements.columnsMenu.querySelectorAll("[data-column-visible]").forEach(input => {
            input.addEventListener("change", () => {
                const visibleCount = visibleColumns().length;
                if (!input.checked && visibleCount <= 1) {
                    input.checked = true;
                    showToast("Mantenha pelo menos uma coluna visível.", true);
                    return;
                }
                if (input.checked) hiddenColumns.delete(input.dataset.columnVisible);
                else hiddenColumns.add(input.dataset.columnVisible);
                saveColumnState();
                renderTableHead();
                renderTable();
                renderColumnsMenu();
            });
        });
    }

    function toggleColumnsMenu() {
        elements.columnsMenu.hidden = !elements.columnsMenu.hidden;
        elements.columnsButton.setAttribute("aria-expanded", String(!elements.columnsMenu.hidden));
    }

    function bindColumnDrag() {
        elements.tableHead.querySelectorAll("th[draggable=true]").forEach(th => {
            th.addEventListener("dragstart", () => { draggedKey = th.dataset.key; th.classList.add("is-dragging"); });
            th.addEventListener("dragend", () => { draggedKey = null; th.classList.remove("is-dragging"); });
            th.addEventListener("dragover", event => event.preventDefault());
            th.addEventListener("drop", event => {
                event.preventDefault();
                const targetKey = th.dataset.key;
                if (!draggedKey || draggedKey === targetKey) return;
                const from = columnOrder.indexOf(draggedKey);
                const to = columnOrder.indexOf(targetKey);
                columnOrder.splice(from, 1);
                columnOrder.splice(to, 0, draggedKey);
                saveColumnState();
                renderColumnsMenu();
                renderTableHead();
                renderTable();
            });
        });
    }

    function exportCsv() {
        if (!tableFiltered.length) { showToast("Não existem tickets para exportar.", true); return; }
        const columns = visibleColumns();
        const rows = [columns.map(column => column.label), ...tableFiltered.map(ticket => columns.map(column => valueFor(ticket, column)))];
        const csv = rows.map(row => row.map(csvCell).join(";")).join("\r\n");
        const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        const viewName = activeView === "open" ? "abertos" : activeView === "closed" ? "fechados" : "todos";
        link.download = `tickets_${viewName}_${elements.dateStart.value}_${elements.dateEnd.value}.csv`;
        document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
        showToast(`Tickets ${viewName} exportados.`);
    }

    function renderPagination() {
        const size = PAGE_SIZE;
        const total = Math.max(1, Math.ceil(tableFiltered.length / size));
        if (currentPage > total) currentPage = total;
        if (total <= 1) { elements.pagination.innerHTML = ""; return; }
        const pages = pageList(currentPage, total);
        elements.pagination.innerHTML = `<button data-page="${currentPage - 1}" ${currentPage === 1 ? "disabled" : ""}><i class="fa fa-angle-left"></i></button>${pages.map(page => page === "..." ? "<span>…</span>" : `<button data-page="${page}" class="${page === currentPage ? "is-active" : ""}">${page}</button>`).join("")}<button data-page="${currentPage + 1}" ${currentPage === total ? "disabled" : ""}><i class="fa fa-angle-right"></i></button>`;
        elements.pagination.querySelectorAll("button[data-page]").forEach(button => button.addEventListener("click", () => {
            const page = Number(button.dataset.page);
            if (page < 1 || page > total) return;
            currentPage = page; renderTable(); renderPagination();
        }));
    }

    function renderActiveFilters() {
        const chips = [];
        if (elements.search.value.trim()) chips.push(`Pesquisa: ${elements.search.value.trim()}`);
        [["Mesa", elements.deskFilter], ["Cliente", elements.clientFilter], ["Responsável", elements.responsibleFilter], ["Estágio", elements.stageFilter], ["Status", elements.statusFilter], ["Categoria", elements.categoryFilter], ["Empresa", elements.companyFilter], ["Catálogo", elements.catalogFilter], ["Projeto Workspace", elements.projectFilter], ["Faixa dias aberto", elements.daysBandFilter], ["Faixa hora criação", elements.creationShiftFilter], ["Origem ticket", elements.originFilter]].forEach(([label, select]) => {
            if (select.value) chips.push(`${label}: ${select.options[select.selectedIndex].textContent}`);
        });
        Object.entries(columnFilters).forEach(([key, value]) => { if (value) chips.push(`${columnByKey(key).label}: ${value}`); });
        elements.activeFilters.innerHTML = chips.map(chip => `<span><i class="fa fa-filter"></i>${escapeHtml(chip)}</span>`).join("");
    }

    function clearAllFilters() {
        elements.dateStart.value = "2025-01-01";
        elements.dateEnd.value = isoToday();
        elements.search.value = "";
        [
            elements.deskFilter, elements.clientFilter, elements.responsibleFilter,
            elements.stageFilter, elements.statusFilter, elements.categoryFilter,
            elements.companyFilter, elements.catalogFilter, elements.projectFilter,
            elements.daysBandFilter, elements.creationShiftFilter, elements.originFilter,
        ].filter(Boolean).forEach(select => select.value = "");
        columnFilters = {};
        summaryFilter = null;
        activeView = "open";
        currentPage = 1;
        updateTabState();
        renderColumnsMenu();
        renderTableHead();
        loadData(false);
    }

    function togglePanel(body, button, text, icon) {
        const collapsed = !body.hidden;
        body.hidden = collapsed;
        button.setAttribute("aria-expanded", String(!collapsed));
        if (text) text.textContent = collapsed ? "Exibir filtros" : "Recolher";
        if (icon) icon.className = collapsed ? "fa fa-chevron-down" : "fa fa-chevron-up";
    }

    function bindSectionNavigation() {
        document.querySelectorAll(".tickets-section-nav-slot a[href^='#']").forEach(link => {
            link.addEventListener("click", event => {
                event.preventDefault();
                switchSection(link.getAttribute("href"), true);
            });
        });
    }

    function switchSection(target, scroll) {
        const allowed = ["#tickets-section-overview", "#tickets-section-dashboards", "#ticketsStatusReportSection"];
        const selected = allowed.includes(target) ? target : allowed[0];
        const dashboardSelected = selected === "#tickets-section-dashboards";
        const statusReportSelected = selected === "#ticketsStatusReportSection";
        document.querySelector("#tickets-section-overview").hidden = dashboardSelected || statusReportSelected;
        document.querySelector("#ticketsBaseSection").hidden = dashboardSelected || statusReportSelected;
        document.querySelector("#tickets-section-dashboards").hidden = !dashboardSelected;
        document.querySelector("#ticketsStatusReportSection").hidden = !statusReportSelected;
        document.querySelectorAll(".tickets-section-nav-slot .metas-section-nav-item").forEach(link => {
            link.classList.toggle("is-active", link.getAttribute("href") === selected);
        });
        if (statusReportSelected && !statusReportLoaded) loadStatusReport();
        if (scroll) document.querySelector(selected)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function moveAnalyticFiltersToGlobal() {
        if (elements.filtersBody && elements.analyticBody) {
            elements.filtersBody.appendChild(elements.analyticBody);
        }
    }

    function initTheme() {
        const saved = localStorage.getItem("workspace-dashboard-theme");
        if (saved === "dark" || saved === "light") document.documentElement.setAttribute("data-theme", saved);
        updateThemeButton();
    }
    function toggleTheme() {
        const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", next);
        localStorage.setItem("workspace-dashboard-theme", next);
        updateThemeButton();
    }
    function updateThemeButton() {
        const dark = document.documentElement.getAttribute("data-theme") === "dark";
        elements.themeIcon.className = dark ? "fa fa-sun-o" : "fa fa-moon-o";
        elements.themeText.textContent = dark ? "Modo claro" : "Modo escuro";
    }

    function showLoading(show) {
        elements.loading.classList.toggle("is-visible", Boolean(show));
        elements.loading.setAttribute("aria-hidden", show ? "false" : "true");
        elements.refreshButton.disabled = Boolean(show);
    }
    function setStatus(message, error, hide) {
        elements.status.hidden = Boolean(hide) || !message;
        elements.status.textContent = message || "";
        elements.status.classList.toggle("is-error", Boolean(error));
    }
    function showToast(message, error) {
        clearTimeout(toastTimer);
        elements.toast.textContent = message;
        elements.toast.classList.toggle("is-error", Boolean(error));
        elements.toast.classList.add("is-visible");
        toastTimer = setTimeout(() => elements.toast.classList.remove("is-visible"), 3200);
    }

    function resetAndApply() { currentPage = 1; applyFilters(); }
    function isClosed(ticket) { return Boolean(ticket.is_closed ?? ticket.fechado); }
    function columnByKey(key) { return COLUMNS.find(column => column.key === key); }
    function isColumnAvailable(key) {
        return !CLOSED_ONLY_COLUMNS.has(key) || activeView === "closed";
    }
    function visibleColumns() {
        return columnOrder
            .filter(key => !hiddenColumns.has(key) && isColumnAvailable(key))
            .map(columnByKey)
            .filter(Boolean);
    }
    function ensureAvailableColumnState() {
        Object.keys(columnFilters).forEach(key => {
            if (!isColumnAvailable(key)) delete columnFilters[key];
        });
        if (!isColumnAvailable(sortKey)) {
            sortKey = "created_at";
            sortDirection = "desc";
        }
    }
    function hasMeaningfulValue(value) {
        return Boolean(cleanDisplayValue(value));
    }
    function cleanDisplayValue(value) {
        if (value === null || value === undefined) return "";
        const text = String(value).trim();
        if (!text) return "";
        const normalized = normalize(text);
        if (normalized === "nao informado" || text === "—" || normalized === "null" || normalized === "none") return "";
        return text;
    }
    function uniqueValues(key) {
        const values = new Map();
        sourceTickets.forEach(ticket => {
            const label = cleanDisplayValue(ticket[key]);
            if (!label) return;
            const normalized = normalize(label);
            if (!values.has(normalized)) values.set(normalized, label);
        });
        return [...values.values()].sort(localeSort);
    }
    function distinct(items, key) {
        return new Set(
            items
                .map(item => cleanDisplayValue(item[key]))
                .filter(Boolean)
                .map(normalize)
        ).size;
    }
    function distinctProjects(items) {
        const keys = new Set();
        items.forEach(ticket => {
            if (!(ticket.projeto_cadastrado || ticket.projeto_id || cleanDisplayValue(ticket.projeto_codigo))) return;
            const key = cleanDisplayValue(ticket.projeto_id)
                || normalize(cleanDisplayValue(ticket.projeto_codigo))
                || normalize(cleanDisplayValue(ticket.nome_projeto));
            if (key) keys.add(String(key));
        });
        return keys.size;
    }
    function fillSelect(select, values, label) {
        if (!select) return;
        const selected = select.value;
        select.innerHTML = `<option value="">${label}</option>${values.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}`;
        if (values.includes(selected)) select.value = selected;
    }
    function formatDurationMinutes(value) {
        const minutes = Math.max(0, Math.round(Number(value || 0)));
        const hours = Math.floor(minutes / 60);
        const rest = minutes % 60;
        return `${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
    }
    function formatDateTable(value) {
        const date = parseDate(value);
        return date ? date.toLocaleDateString("pt-BR") : "";
    }
    function formatDateTimeTable(value) {
        const date = parseDate(value);
        return date ? date.toLocaleString("pt-BR", {
            day: "2-digit", month: "2-digit", year: "numeric",
            hour: "2-digit", minute: "2-digit", second: "2-digit",
        }) : "";
    }
    function toggleTableExpand() {
        setTableExpanded(!elements.tableCard?.classList.contains("is-expanded"));
    }
    function setTableExpanded(expanded) {
        if (!elements.tableCard || !elements.tableExpand) return;
        const section = elements.tableCard.closest("#ticketsBaseSection");
        elements.tableCard.classList.toggle("is-expanded", Boolean(expanded));
        section?.classList.toggle("is-table-expanded", Boolean(expanded));
        document.body.classList.toggle("tickets-table-expanded", Boolean(expanded));
        const icon = elements.tableExpand.querySelector("i");
        const label = elements.tableExpand.querySelector("span");
        if (icon) icon.className = expanded ? "fa fa-compress" : "fa fa-expand";
        if (label) label.textContent = expanded ? "Recolher tabela" : "Expandir tabela";
        elements.tableExpand.setAttribute("aria-pressed", String(Boolean(expanded)));
        hideSmartTooltip();
    }

    function bindStatusReport() {
        if (!elements.statusReportSection) return;
        const decisionTab = elements.statusReportSection.querySelector('[data-status-view="decisions"]');
        if (decisionTab) decisionTab.innerHTML = '<i class="fa fa-gavel"></i> Acompanhamento';
        elements.statusReportDate.value = isoToday();
        elements.statusReportRefresh?.addEventListener("click", () => loadStatusReport(true));
        elements.statusReportDate?.addEventListener("change", () => loadStatusReport(true));
        elements.statusReportLeader?.addEventListener("change", renderStatusReport);
        elements.statusReportSituation?.addEventListener("change", renderStatusReport);
        elements.statusReportSection.querySelectorAll("[data-status-view]").forEach(button => {
            button.addEventListener("click", () => {
                statusReportView = button.dataset.statusView || "summary";
                elements.statusReportSection.querySelectorAll("[data-status-view]").forEach(item => {
                    item.classList.toggle("is-active", item === button);
                });
                renderStatusReport();
            });
        });
        elements.statusReportContent?.addEventListener("submit", saveStatusReportPrework);
        elements.statusReportContent?.addEventListener("change", event => {
            updateStatusReportAction(event);
            handleTreatmentSelectionChange(event);
            handleTreatmentFieldChange(event);
            handlePreworkConditionalFields(event);
            handleDecisionTrackingChange(event);
            handleDecisionFilters(event);
        });
        elements.statusReportContent?.addEventListener("input", event => {
            handleTreatmentSearchInput(event);
            handleDecisionFilters(event);
        });
        elements.statusReportContent?.addEventListener("click", event => {
            if (handleTreatmentClick(event)) return;
            const button = event.target.closest("[data-open-leader]");
            if (!button) return;
            statusReportView = "leaders";
            elements.statusReportLeader.value = button.dataset.openLeader;
            elements.statusReportSection.querySelectorAll("[data-status-view]").forEach(item => {
                item.classList.toggle("is-active", item.dataset.statusView === "leaders");
            });
            renderStatusReport();
        });
    }

    async function loadStatusTicketSnapshot(force = false) {
        const date = elements.statusReportDate?.value || isoToday();
        if (!force && statusReportTicketsDate === date && statusReportTickets.length) return;
        const params = new URLSearchParams({ dados: "1", data_inicial: "2025-01-01", data_final: date });
        if (force) params.set("refresh", "1");
        const response = await fetch(`${elements.form.dataset.url}?${params}`, {
            headers: { "X-Requested-With": "XMLHttpRequest", "Accept": "application/json" },
            cache: "no-store",
        });
        const payload = await response.json();
        if (!response.ok || !payload.sucesso) throw new Error(payload.erro || payload.mensagem || "Não foi possível atualizar a base de tickets do Status Report.");
        statusReportTickets = Array.isArray(payload.tickets) ? payload.tickets.slice() : [];
        statusReportTicketsDate = date;
        ticketsSourceUpdatedAt = payload.atualizado_em || ticketsSourceUpdatedAt;
        ticketsLatestAt = payload.ultima_data_encontrada || ticketsLatestAt;
    }

    async function loadStatusReport(force = false) {
        if (!elements.statusReportSection || (statusReportLoaded && !force && statusReportTicketsDate === (elements.statusReportDate.value || isoToday()))) return;
        const url = elements.statusReportSection.dataset.url;
        const date = elements.statusReportDate.value || isoToday();
        elements.statusReportContent.innerHTML = `<div class="tickets-status-report__empty"><i class="fa fa-circle-o-notch fa-spin"></i><span>Consolidando Tickets e Projetos registrados...</span></div>`;
        try {
            await loadStatusTicketSnapshot(force);
            const response = await fetch(`${url}?data=${encodeURIComponent(date)}`, {
                headers: { "X-Requested-With": "XMLHttpRequest", "Accept": "application/json" },
                cache: "no-store",
            });
            const payload = await response.json();
            if (!response.ok || !payload.sucesso) throw new Error(payload.erro || "Não foi possível carregar o Status Report.");
            statusReportPayload = payload;
            statusReportLoaded = true;
            populateStatusReportLeaders(payload.lideres || STATUS_REPORT_LEADERS);
            const sourceInfo = ticketsSourceUpdatedAt ? ` · TiFlux ${formatDateTime(ticketsSourceUpdatedAt)}` : "";
            elements.statusReportUpdated.textContent = `Status ${formatDateTime(payload.gerado_em)}${sourceInfo}`;
            elements.statusReportUpdated.title = ticketsLatestAt ? `Último ticket encontrado na fonte: ${formatDateTime(ticketsLatestAt)}` : "";
            renderStatusReport();
        } catch (error) {
            console.error(error);
            elements.statusReportContent.innerHTML = `<div class="tickets-status-report__empty is-error"><i class="fa fa-exclamation-triangle"></i><span>${escapeHtml(error.message)}</span></div>`;
            showToast(error.message, true);
        }
    }

    function populateStatusReportLeaders(leaders) {
        const selected = elements.statusReportLeader.value || "all";
        elements.statusReportLeader.innerHTML = `<option value="all">Consolidado das lideranças</option>${leaders.map(leader => `<option value="${escapeHtml(leader.nome || leader.name)}">${escapeHtml(leader.nome || leader.name)} · ${escapeHtml(leader.area)}</option>`).join("")}<option value="unassigned">Não atribuídas</option>`;
        if ([...elements.statusReportLeader.options].some(option => option.value === selected)) {
            elements.statusReportLeader.value = selected;
        }
    }

    function statusReportLeaders() {
        const apiLeaders = statusReportPayload?.lideres;
        return (Array.isArray(apiLeaders) && apiLeaders.length ? apiLeaders : STATUS_REPORT_LEADERS).map(leader => ({
            name: leader.nome || leader.name,
            area: leader.area,
            members: leader.membros || leader.members || [],
            aliases: leader.aliases || [],
        }));
    }

    function leaderForTicket(ticket) {
        const responsible = normalize(ticket.responsible_name || ticket.responsavel);
        if (!responsible) return null;
        return statusReportLeaders().find(leader => {
            const names = [leader.name, ...(leader.aliases || []), ...(leader.members || [])];
            return names.some(name => normalize(name) === responsible);
        }) || null;
    }

    function ticketStatusReportData() {
        const date = elements.statusReportDate.value || isoToday();
        const leaders = statusReportLeaders();
        const byLeader = Object.fromEntries(leaders.map(leader => [leader.name, []]));
        const unassigned = [];
        const ticketSource = statusReportTickets.length ? statusReportTickets : sourceTickets;
        ticketSource.forEach(ticket => {
            const leader = leaderForTicket(ticket);
            if (leader) byLeader[leader.name].push(ticket);
            else unassigned.push(ticket);
        });
        return { date, leaders, byLeader, unassigned };
    }

    function dateOnly(value) {
        const parsed = parseDate(value);
        if (!parsed) return "";
        const adjusted = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000);
        return adjusted.toISOString().slice(0, 10);
    }

    function daysBetweenIso(later, earlier) {
        if (!later || !earlier) return 0;
        const a = new Date(`${later}T12:00:00`);
        const b = new Date(`${earlier}T12:00:00`);
        if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
        return Math.max(0, Math.round((a - b) / 86400000));
    }

    function ticketActiveOnDate(ticket, date) {
        const created = dateOnly(ticket.created_at || ticket.data_criacao);
        if (!created || created > date) return false;
        const solved = dateOnly(ticket.solved_in_time || ticket.data_fechamento2);
        if (solved) return solved > date;
        return !(ticket.is_closed || ticket.fechado);
    }

    function ticketDueContext(ticket, date = elements.statusReportDate?.value || isoToday()) {
        const due = dateOnly(ticket.solve_expiration);
        if (!due) return { due: "", overdueDays: 0, dueToday: false, label: "Sem prazo de solução", detail: "Prazo de solução não informado" };
        const overdueDays = due < date ? daysBetweenIso(date, due) : 0;
        const dueToday = due === date;
        const label = overdueDays ? `Vencido há ${overdueDays} dia${overdueDays === 1 ? "" : "s"}` : dueToday ? "Vence hoje" : `Vence em ${formatDate(due)}`;
        const detail = `Prazo de solução: ${formatDate(due)}${overdueDays ? ` · ${overdueDays} dia${overdueDays === 1 ? "" : "s"} vencido` : dueToday ? " · vence hoje" : ""}`;
        return { due, overdueDays, dueToday, label, detail };
    }

    function ticketMetrics(tickets, date) {
        const createdThroughDate = tickets.filter(ticket => {
            const created = dateOnly(ticket.created_at || ticket.data_criacao);
            return created && created <= date;
        });
        const opened = tickets.filter(ticket => ticketActiveOnDate(ticket, date));
        const closedToday = tickets.filter(ticket => dateOnly(ticket.solved_in_time || ticket.data_fechamento2) === date);
        const createdToday = tickets.filter(ticket => dateOnly(ticket.created_at || ticket.data_criacao) === date);
        const overdue = opened.filter(ticket => {
            const due = dateOnly(ticket.solve_expiration);
            return due ? due < date : normalize(ticket.status_sla).includes("venc");
        });
        const dueToday = opened.filter(ticket => dateOnly(ticket.solve_expiration) === date);
        const projects = new Set(createdThroughDate.map(ticket => ticket.projeto_codigo || ticket.nome_projeto).filter(Boolean));
        const balance = createdToday.length - closedToday.length;
        const flowRatio = createdToday.length ? Math.round((closedToday.length / createdToday.length) * 100) : null;
        const health = overdue.length ? "red" : dueToday.length ? "yellow" : "green";
        return {
            total: createdThroughDate.length,
            open: opened.length,
            closed: createdThroughDate.length - opened.length,
            overdue: overdue.length,
            dueToday: dueToday.length,
            createdToday: createdToday.length,
            closedToday: closedToday.length,
            balance,
            flowRatio,
            projects: projects.size,
            health,
        };
    }

    function leaderProjects(leaderName) {
        return statusReportPayload?.projetos_por_lider?.[leaderName] || [];
    }

    function projectMetrics(projects) {
        const uniqueProjects = new Map();
        projects.forEach(project => {
            const key = String(project?.id ?? project?.codigo ?? project?.nome ?? "");
            if (key && !uniqueProjects.has(key)) uniqueProjects.set(key, project);
        });
        const projectList = [...uniqueProjects.values()];
        const overdueKeys = new Set();
        let legacyOverdueTasks = 0;
        let hasTechnicalKeys = false;
        projectList.forEach(project => {
            const keys = Array.isArray(project?.tarefas_atrasadas_chaves) ? project.tarefas_atrasadas_chaves.filter(Boolean) : [];
            if (keys.length) {
                hasTechnicalKeys = true;
                keys.forEach(key => overdueKeys.add(String(key)));
            } else {
                legacyOverdueTasks += Number(project?.tarefas_atrasadas || 0);
            }
        });
        const overdueTasks = hasTechnicalKeys ? overdueKeys.size + legacyOverdueTasks : legacyOverdueTasks;
        const risk = projectList.filter(project => /atras|risco|critic/.test(normalize(project.situacao))).length;
        const attention = projectList.filter(project => /atenc/.test(normalize(project.situacao))).length;
        return { total: projectList.length, overdueTasks, overdueKeys: [...overdueKeys], risk, attention };
    }

    function leaderFarol(ticketMetric, projectMetric, daily) {
        if (daily?.farol && !daily.rascunho) return daily.farol === "vermelho" ? "red" : daily.farol === "amarelo" ? "yellow" : "green";
        if (ticketMetric.overdue || projectMetric.risk || projectMetric.overdueTasks) return "red";
        if (ticketMetric.dueToday || projectMetric.attention) return "yellow";
        return "green";
    }

    function renderStatusReport() {
        if (!statusReportPayload || !elements.statusReportContent) return;
        if (statusReportView === "leaders") return renderStatusReportLeaders();
        if (statusReportView === "daily") return renderStatusReportDaily();
        if (statusReportView === "decisions") return renderStatusReportDecisions();
        renderStatusReportSummary();
    }

    function statusReportRows() {
        const data = ticketStatusReportData();
        const daily = statusReportPayload.diarios || {};
        const rows = data.leaders.map(leader => {
            const ticketMetric = ticketMetrics(data.byLeader[leader.name] || [], data.date);
            const projects = leaderProjects(leader.name);
            const projectMetric = projectMetrics(projects);
            return { leader, tickets: data.byLeader[leader.name] || [], ticketMetric, projects, projectMetric, daily: daily[leader.name] || null, health: leaderFarol(ticketMetric, projectMetric, daily[leader.name]) };
        });
        const unassignedProjects = statusReportPayload.projetos_nao_atribuidos || [];
        const unassignedTicketMetric = ticketMetrics(data.unassigned, data.date);
        rows.push({
            leader: { name: "Não atribuídas", area: "Revisar vínculos", members: [] },
            tickets: data.unassigned,
            ticketMetric: unassignedTicketMetric,
            projects: unassignedProjects,
            projectMetric: projectMetrics(unassignedProjects),
            daily: null,
            health: unassignedTicketMetric.open || unassignedProjects.length ? "yellow" : "green",
            unassigned: true,
        });
        const leaderFilter = elements.statusReportLeader.value || "all";
        const situation = elements.statusReportSituation.value || "all";
        return rows.filter(row => {
            if (leaderFilter === "unassigned" && !row.unassigned) return false;
            if (leaderFilter !== "all" && leaderFilter !== "unassigned" && row.leader.name !== leaderFilter) return false;
            if (situation === "unassigned" && !row.unassigned) return false;
            if (["red", "yellow", "green"].includes(situation) && row.health !== situation) return false;
            return true;
        });
    }

    function dailyDecisionCount(daily) {
        if (!daily || daily.rascunho) return 0;
        const itemDecisions = (daily.itens_selecionados || []).filter(item => Boolean(item.precisa_decisao)).length;
        return itemDecisions + (daily.decisao_necessaria ? 1 : 0);
    }

    function renderStatusReportSummary() {
        const rows = statusReportRows();
        const uniqueProjectIds = new Set();
        const uniqueOverdueTaskKeys = new Set();
        let legacyOverdueTasks = 0;
        const totals = rows.reduce((acc, row) => {
            acc.open += row.ticketMetric.open;
            acc.overdue += row.ticketMetric.overdue;
            acc.created += row.ticketMetric.createdToday;
            acc.closed += row.ticketMetric.closedToday;
            row.projects.forEach(project => {
                const projectKey = String(project?.id ?? project?.codigo ?? project?.nome ?? "");
                if (projectKey) uniqueProjectIds.add(projectKey);
            });
            if (Array.isArray(row.projectMetric.overdueKeys) && row.projectMetric.overdueKeys.length) {
                row.projectMetric.overdueKeys.forEach(key => uniqueOverdueTaskKeys.add(String(key)));
            } else {
                legacyOverdueTasks += row.projectMetric.overdueTasks;
            }
            acc.decisions += dailyDecisionCount(row.daily);
            acc.pending += !row.unassigned && (!row.daily || row.daily.rascunho) ? 1 : 0;
            return acc;
        }, { open: 0, overdue: 0, created: 0, closed: 0, projects: 0, tasks: 0, decisions: 0, pending: 0 });
        totals.projects = uniqueProjectIds.size;
        totals.tasks = uniqueOverdueTaskKeys.size + legacyOverdueTasks;
        const isFullConsolidated = (elements.statusReportLeader.value || "all") === "all"
            && (elements.statusReportSituation.value || "all") === "all";
        const backendConsolidated = statusReportPayload?.resumo_consolidado || {};
        if (isFullConsolidated) {
            if (Number.isFinite(Number(backendConsolidated.projetos_em_curso))) {
                totals.projects = Number(backendConsolidated.projetos_em_curso);
            }
            if (Number.isFinite(Number(backendConsolidated.tarefas_atrasadas))) {
                totals.tasks = Number(backendConsolidated.tarefas_atrasadas);
            }
        }
        const balance = totals.created - totals.closed;
        const ratio = totals.created ? Math.round((totals.closed / totals.created) * 100) : null;
        elements.statusReportContent.innerHTML = `
            <div class="tickets-status-report__kpis">
                ${statusKpi("fa-folder-open", "Tickets abertos", totals.open, "blue", "Backlog aberto na data de referência, considerando criação e solução do ticket.")}
                ${statusKpi("fa-exclamation-triangle", "Tickets vencidos", totals.overdue, "red", "Tickets que estavam abertos na data e com solve_expiration anterior à data de referência.")}
                ${statusKpi("fa-plus-circle", "Entradas no dia", totals.created, "navy", "Entrada = created_at na data de referência.")}
                ${statusKpi("fa-check-circle", "Saídas no dia", totals.closed, "green", "Saída = solved_in_time na data de referência.")}
                ${statusKpi("fa-exchange", "Saldo do fluxo", balance > 0 ? `+${balance}` : balance, balance > 0 ? "orange" : "green", "Entradas menos saídas. Positivo aumenta backlog; negativo reduz backlog.")}
                ${statusKpi("fa-percent", "Saída / entrada", ratio === null ? "—" : `${ratio}%`, ratio !== null && ratio >= 100 ? "green" : "orange", "Índice simples de throughput: saídas do dia divididas pelas entradas do dia.")}
                ${statusKpi("fa-briefcase", "Projetos em curso", totals.projects, "blue")}
                ${statusKpi("fa-calendar-times-o", "Tarefas atrasadas", totals.tasks, "red")}
                ${statusKpi("fa-gavel", "Decisões", totals.decisions, "orange")}
                ${statusKpi("fa-pencil-square-o", "Preworks pendentes", totals.pending, "orange")}
            </div>
            <div class="tickets-status-report__leader-grid">${rows.map(renderLeaderSummaryCard).join("")}</div>`;
    }

    function statusKpi(icon, label, value, color, help = "") {
        return `<article class="tickets-status-report__kpi is-${color}" ${help ? `title="${escapeHtml(help)}"` : ""}><i class="fa ${icon}"></i><span>${escapeHtml(label)}</span><strong>${typeof value === "number" ? number(value) : escapeHtml(value)}</strong></article>`;
    }

    function farolLabel(health) {
        return health === "red" ? "Risco" : health === "yellow" ? "Atenção" : "No prazo";
    }

    function renderLeaderSummaryCard(row) {
        const teamSize = new Set([row.leader.name, ...(row.leader.members || [])].filter(Boolean).map(normalize)).size;
        const memberText = row.unassigned ? "Sem correspondência na matriz" : `${teamSize} integrante(s)`;
        return `<article class="tickets-status-report__leader-card is-${row.health}">
            <header><div><span>${escapeHtml(row.leader.area)}</span><h3>${escapeHtml(row.leader.name)}</h3><small>${escapeHtml(memberText)}</small></div><b class="tickets-status-report__farol is-${row.health}">${farolLabel(row.health)}</b></header>
            <div class="tickets-status-report__leader-metrics">
                <span><small>Tickets abertos</small><strong>${number(row.ticketMetric.open)}</strong></span>
                <span><small>Vencidos</small><strong>${number(row.ticketMetric.overdue)}</strong></span>
                <span><small>Projetos</small><strong>${number(row.projectMetric.total)}</strong></span>
                <span><small>Tarefas atrasadas</small><strong>${number(row.projectMetric.overdueTasks)}</strong></span>
            </div>
            <footer><span><i class="fa ${row.daily && !row.daily.rascunho ? "fa-check-circle" : row.daily?.rascunho ? "fa-pencil" : "fa-clock-o"}"></i>${row.daily && !row.daily.rascunho ? "Prework preenchido" : row.daily?.rascunho ? "Rascunho salvo" : row.unassigned ? "Vínculo pendente" : "Prework pendente"}</span><button type="button" data-open-leader="${escapeHtml(row.leader.name)}">Detalhar</button></footer>
        </article>`;
    }

    function renderStatusReportLeaders() {
        const rows = statusReportRows();
        elements.statusReportContent.innerHTML = `<div class="tickets-status-report__leader-details">${rows.map(row => {
            const projects = row.projects.map(project => `<li><span><strong>${escapeHtml(project.codigo || "Sem código")}</strong>${escapeHtml(project.nome)}</span><b>${number(project.progresso)}%</b></li>`).join("");
            const referenceDate = elements.statusReportDate.value || isoToday();
            const tickets = row.tickets.filter(ticket => ticketActiveOnDate(ticket, referenceDate)).map(ticket => `<li><span class="tickets-status-report__ticket-inline"><strong>#${escapeHtml(ticket.ticket_number || ticket.ticket)}</strong><em>—</em>${escapeHtml(ticket.title || "Sem título")}</span><b>${escapeHtml(ticket.responsible_name || "Sem responsável")}</b></li>`).join("");
            return `<article class="tickets-status-report__detail-card is-${row.health}"><header><div><span>${escapeHtml(row.leader.area)}</span><h3>${escapeHtml(row.leader.name)}</h3></div><b class="tickets-status-report__farol is-${row.health}">${farolLabel(row.health)}</b></header><div class="tickets-status-report__detail-columns"><section><h4>Projetos em curso</h4><ul>${projects || "<li class='is-empty'>Nenhum projeto relacionado.</li>"}</ul></section><section><h4>Tickets abertos</h4><ul>${tickets || "<li class='is-empty'>Nenhum ticket relacionado.</li>"}</ul></section></div></article>`;
        }).join("")}</div>`;
    }

    function renderStatusReportDaily() {
        const rows = statusReportRows().filter(row => !row.unassigned);
        const theme = statusReportPayload.tema || {};
        const referenceDate = elements.statusReportDate.value || isoToday();
        elements.statusReportContent.innerHTML = `<section class="tickets-status-report__theme theme-${escapeHtml(theme.codigo || "consulta")}">
            <div><span>${escapeHtml(theme.dia || "Dia")}</span><h3>${escapeHtml(theme.titulo || "Prework")}</h3><p>${escapeHtml(theme.objetivo || "")}</p></div>
            <aside>${theme.duracao ? `<i class="fa fa-clock-o"></i><b>${number(theme.duracao)} min</b><small>Prework até a véspera, 22h</small>` : `<i class="fa fa-eye"></i><b>Somente consulta</b><small>Sem novo prework obrigatório</small>`}</aside>
        </section>
        <div class="tickets-status-report__daily">${rows.map(row => {
            const daily = row.daily || {};
            const snapshot = daily.snapshot_metricas || {};
            const insights = buildLeaderInsights(row, theme.codigo);
            const exceptions = statusReportExceptions(row, theme.codigo);
            const selectedKeys = new Set((daily.itens_selecionados || []).map(treatmentKey));
            const ratio = row.ticketMetric.flowRatio;
            const balance = row.ticketMetric.balance;
            return `<form class="tickets-status-report__prework is-${row.health}" data-prework-leader="${escapeHtml(row.leader.name)}">
                <header><div><span>${escapeHtml(row.leader.area)}</span><h3>${escapeHtml(row.leader.name)}</h3><small>${row.leader.members.length + 1} pessoas, incluindo a liderança · referência ${formatDate(referenceDate)}</small></div><div class="tickets-status-report__dual-light"><span>Sistema <b class="tickets-status-report__farol is-${row.health}">${farolLabel(row.health)}</b></span><label>Líder<select name="farol"><option value="verde" ${daily.farol === "verde" ? "selected" : ""}>No prazo</option><option value="amarelo" ${daily.farol === "amarelo" ? "selected" : ""}>Atenção</option><option value="vermelho" ${daily.farol === "vermelho" ? "selected" : ""}>Risco</option></select></label></div></header>
                <div class="tickets-status-report__automatic">
                    <span title="Backlog aberto na data de referência"><small>Abertos</small><b>${row.ticketMetric.open}</b></span>
                    <span title="Entrada = created_at em ${formatDate(referenceDate)}"><small>Entradas</small><b>${row.ticketMetric.createdToday}</b></span>
                    <span title="Saída = solved_in_time em ${formatDate(referenceDate)}"><small>Saídas</small><b>${row.ticketMetric.closedToday}</b></span>
                    <span title="Entradas menos saídas"><small>Saldo</small><b class="${balance > 0 ? "is-bad" : balance < 0 ? "is-good" : ""}">${balance > 0 ? "+" : ""}${balance}</b></span>
                    <span title="Saídas divididas pelas entradas do dia"><small>Saída / entrada</small><b>${ratio === null ? "—" : `${ratio}%`}</b></span>
                    <span title="Tickets abertos e vencidos na data"><small>Vencidos</small><b>${row.ticketMetric.overdue}</b></span>
                    <span><small>Projetos</small><b>${row.projectMetric.total}</b></span>
                    <span><small>Tarefas atrasadas</small><b>${row.projectMetric.overdueTasks}</b></span>
                </div>
                ${theme.codigo === "operacao" ? renderOperationalSlaRead(row) : ""}
                ${renderTeamWorkload(row)}
                <section class="tickets-status-report__analysis"><div><h4><i class="fa fa-lightbulb-o"></i> Leitura automática</h4><ul>${insights.map(item => `<li class="is-${item.level}"><b>${escapeHtml(item.label)}</b><span>${escapeHtml(item.text)}</span></li>`).join("")}</ul></div><div><h4><i class="fa fa-crosshairs"></i> Exceções para o prework</h4><div class="tickets-status-report__exceptions">${exceptions.map(item => renderExceptionItem(item, selectedKeys.has(treatmentKey(item)))).join("") || "<p>Nenhuma exceção encontrada para este tema.</p>"}</div></div></section>
                ${renderTreatmentSection(row, daily.itens_selecionados || [])}
                <div class="tickets-status-report__form-grid">
                    ${preworkField("ontem", "Ontem", daily.ontem, "Entregas e fatos relevantes", true)}
                    ${preworkField("hoje", "Hoje", daily.hoje, "Foco e entregas do dia", true)}
                    ${preworkBlockField(snapshot.bloqueio_status || (daily.bloqueio ? "sim" : "nao"), daily.bloqueio)}
                    ${preworkField("prioridade_critica", "Prioridade crítica", daily.prioridade_critica, "Principal prioridade da liderança", true)}
                    ${preworkImpactField(snapshot.impacto_tipo || "", daily.impacto)}
                    ${preworkField("plano_recuperacao", "Plano macro de recuperação", daily.plano_recuperacao, "Ação macro, responsável e prazo", true)}
                    ${preworkField("contexto_tema", themeFieldLabel(theme.codigo), daily.contexto_tema, themeFieldPlaceholder(theme.codigo), true)}
                    ${renderMacroDecisionFields(daily, snapshot)}
                    <label class="is-wide"><span>Evidência <small>obrigatória para atenção/risco</small></span><input type="url" name="evidencia_url" value="${escapeHtml(daily.evidencia_url || "")}" placeholder="https://..."></label>
                </div>
                <footer><span>${daily.atualizado_em ? `${daily.rascunho ? "Rascunho atualizado" : "Atualizado"} em ${formatDateTime(daily.atualizado_em)}` : "Ainda não preenchido"}</span><div class="tickets-status-report__save-actions"><button type="submit" data-save-mode="rascunho" class="metas-button" formnovalidate><i class="fa fa-file-text-o"></i> Salvar rascunho</button><button type="submit" data-save-mode="final" class="metas-button metas-button-primary"><i class="fa fa-save"></i> Salvar prework</button></div></footer>
            </form>`;
        }).join("") || `<div class="tickets-status-report__empty"><span>Nenhuma liderança encontrada para o filtro atual.</span></div>`}</div>${renderNextSteps(rows)}`;
    }

    function renderExceptionItem(item, checked) {
        const deadline = item.prazo_sla ? `<small class="tickets-status-report__exception-deadline ${Number(item.dias_vencido || 0) > 0 ? "is-overdue" : ""}" title="${escapeHtml(item.prazo_detalhe || item.motivo || "")}"><b>${escapeHtml(item.motivo)}</b><span>${escapeHtml(item.prazo_detalhe || "")}</span></small>` : `<small class="tickets-status-report__exception-deadline"><b>${escapeHtml(item.motivo)}</b></small>`;
        return `<label title="${escapeHtml(item.prazo_detalhe || item.motivo || "")}"><input type="checkbox" name="item_selecionado" value="${escapeHtml(JSON.stringify(item))}" ${checked ? "checked" : ""}><span class="tickets-status-report__exception-title"><b>${escapeHtml(item.referencia)}</b><em>—</em><strong>${escapeHtml(item.titulo)}</strong></span>${deadline}</label>`;
    }

    function decisionOptionsHtml(selected = "", allowEmpty = false) {
        const current = String(selected || "");
        const options = [...STATUS_DECISION_OPTIONS];
        if (current && !options.includes(current)) options.push(current);
        return `${allowEmpty ? `<option value="">Selecione quem decide</option>` : ""}${options.map(option => `<option value="${escapeHtml(option)}" ${option === current ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}`;
    }

    function impactOptionsHtml(selected = "", allowEmpty = true) {
        const current = String(selected || "");
        const options = [...STATUS_IMPACT_OPTIONS];
        if (current && !options.includes(current)) options.push(current);
        return `${allowEmpty ? `<option value="">Selecione o impacto</option>` : ""}${options.map(option => `<option value="${escapeHtml(option)}" ${option === current ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}`;
    }

    function returnedDecisionStatus(status = "", result = "", returnedBy = "", updatedAt = "") {
        const current = String(status || "").trim();
        if (!current) return "";
        const labels = {
            pendente: "Pendente",
            em_andamento: "Em análise",
            concluido: "Decidida",
            cancelado: "Cancelada",
        };
        const icons = {
            pendente: "fa-clock-o",
            em_andamento: "fa-search",
            concluido: "fa-check-circle",
            cancelado: "fa-ban",
        };
        const detail = String(result || "").trim()
            ? ` · Retorno: ${escapeHtml(result)}`
            : "";
        const audit = returnedBy || updatedAt
            ? ` · Atualizado${returnedBy ? ` por ${escapeHtml(returnedBy)}` : ""}${updatedAt ? ` em ${formatDateTime(updatedAt)}` : ""}`
            : "";
        return `<div class="tickets-status-report__decision-dependency ${current !== "concluido" ? "is-blocking" : ""}"><i class="fa ${icons[current] || "fa-info-circle"}"></i><span><b>Status da decisão: ${escapeHtml(labels[current] || current)}</b>${detail}${audit}</span></div>`;
    }

    function renderMacroDecisionFields(daily = {}, snapshot = {}) {
        const inferred = daily.decisao_necessaria ? "sim" : "nao";
        const needsDecision = String(snapshot.precisa_decisao_macro || inferred).toLowerCase() === "sim" ? "sim" : "nao";
        const visible = needsDecision === "sim";
        const returned = returnedDecisionStatus(
            snapshot._decisao_macro_status,
            snapshot._decisao_macro_resultado,
            snapshot._decisao_macro_retorno_por,
            snapshot._decisao_macro_atualizado_em
        );
        return `<label><span>Precisa de decisão macro? <b class="tickets-required-mark">*</b></span><select name="precisa_decisao_macro" required><option value="nao" ${!visible ? "selected" : ""}>Não</option><option value="sim" ${visible ? "selected" : ""}>Sim</option></select></label>
            <div class="tickets-status-report__macro-decision is-wide" data-macro-decision-wrap ${visible ? "" : "hidden"}>
                <label class="is-span-2"><span>O que precisa ser decidido? <b class="tickets-required-mark">*</b></span><textarea name="decisao_necessaria" rows="2" placeholder="Descreva objetivamente a decisão necessária" ${visible ? "required" : ""}>${escapeHtml(daily.decisao_necessaria || "")}</textarea></label>
                <label><span>Quem decide? <b class="tickets-required-mark">*</b></span><select name="decisor" ${visible ? "required" : ""}>${decisionOptionsHtml(daily.decisor || "", true)}</select></label>
                <label><span>Decidir até <b class="tickets-required-mark">*</b></span><input type="date" name="prazo_decisao" value="${escapeHtml(daily.prazo_decisao || "")}" ${visible ? "required" : ""}></label>
                ${returned}
            </div>`;
    }

    function preworkBlockField(status, detail) {
        const current = status === "sim" ? "sim" : "nao";
        return `<label class="tickets-status-report__compound-field"><span>Bloqueio macro <b class="tickets-required-mark">*</b></span><select name="bloqueio_status" required><option value="nao" ${current === "nao" ? "selected" : ""}>Não</option><option value="sim" ${current === "sim" ? "selected" : ""}>Sim</option></select><textarea name="bloqueio" rows="2" ${current === "sim" ? "required" : ""} placeholder="${current === "sim" ? "Descreva a dependência ou impedimento *" : "Sem bloqueio: detalhe opcional"}">${escapeHtml(detail || "")}</textarea></label>`;
    }

    function preworkImpactField(type, detail) {
        return `<label class="tickets-status-report__compound-field"><span>Impacto macro <b class="tickets-required-mark">*</b></span><select name="impacto_tipo" required>${impactOptionsHtml(type, true)}</select><textarea name="impacto" rows="2" placeholder="Descreva o impacto consolidado da operação" required>${escapeHtml(detail || "")}</textarea></label>`;
    }

    function themeFieldLabel(code) {
        return ({ estrategia: "Leitura macro: prioridades, capacidade e riscos", operacao: "Leitura macro da operação", projetos: "Leitura macro: desvio, dependência e recuperação", fechamento: "Leitura macro: entrega, eficiência e Diretoria" })[code] || "Contexto macro do tema";
    }
    function themeFieldPlaceholder(code) {
        return ({ estrategia: "Top 3 da semana, ausências, sobrecarga e dependências", operacao: "Explique o padrão da operação: concentração de fila, categoria, origem QORE/CSLOG, processo, capacidade ou ferramenta. O que justifica os números acima?", projetos: "Causa do desvio, homologação, escopo e ação macro para recuperar", fechamento: "Resultado entregue, pendência, recorrência e próximo foco" })[code] || "Registre a leitura macro da liderança";
    }
    function meaningfulTicketValue(value) {
        const text = String(value || "").trim();
        if (!text) return "";
        const normalized = normalize(text);
        if (["nao informado", "não informado", "n/a", "na", "null", "none", "-"].includes(normalized)) return "";
        return text;
    }

    function ticketCategoryLabel(ticket) {
        return meaningfulTicketValue(ticket?.categoria)
            || meaningfulTicketValue(ticket?.services_catalogs_item_name)
            || meaningfulTicketValue(ticket?.services_catalog_name)
            || meaningfulTicketValue(ticket?.services_catalogs_area_name)
            || "Sem categoria";
    }

    function ticketDemandOrigin(ticket) {
        const cslogReference = meaningfulTicketValue(ticket?.ticket_cslog);
        if (cslogReference) return "CSLOG";
        const haystack = normalize([
            ticket?.empresa,
            ticket?.desk_name,
            ticket?.services_catalogs_area_name,
            ticket?.services_catalog_name,
            ticket?.services_catalogs_item_name,
            ticket?.categoria,
            ticket?.title,
        ].filter(Boolean).join(" "));
        if (haystack.includes("cslog")) return "CSLOG";
        if (haystack.includes("qore")) return "QORE";
        return "Não identificado";
    }

    function ticketStageLabel(ticket) {
        return meaningfulTicketValue(ticket?.stage_name) || "Sem estágio";
    }

    function ticketFirstAttendanceSlaState(ticket) {
        const value = normalize(ticket?.attend_first_sla_attendance);
        if (!value || value === "nao informado") return null;
        if (["sim", "true", "1", "yes"].includes(value) || /dentro|atendid.*sla|no sla/.test(value)) return true;
        if (["nao", "false", "0", "no"].includes(value) || /fora|venc|viol|nao atend/.test(value)) return false;
        return null;
    }

    function groupedTicketCount(tickets, resolver) {
        const groups = new Map();
        tickets.forEach(ticket => {
            const key = resolver(ticket) || "Não identificado";
            groups.set(key, (groups.get(key) || 0) + 1);
        });
        return [...groups.entries()]
            .map(([label, total]) => ({ label, total }))
            .sort((a, b) => b.total - a.total || String(a.label).localeCompare(String(b.label)));
    }

    function topGroupText(tickets, resolver) {
        const group = groupedTicketCount(tickets, resolver)[0];
        return group ? `${group.label} (${group.total})` : "—";
    }

    function averageOverdueDays(tickets, date) {
        const values = tickets.map(ticket => ticketDueContext(ticket, date).overdueDays).filter(value => value > 0);
        if (!values.length) return 0;
        return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
    }

    function operationalSlaSnapshot(row) {
        const date = elements.statusReportDate.value || isoToday();
        const openTickets = row.tickets.filter(ticket => ticketActiveOnDate(ticket, date));
        const overdueTickets = openTickets.filter(ticket => ticketDueContext(ticket, date).overdueDays > 0);
        const dueTodayTickets = openTickets.filter(ticket => ticketDueContext(ticket, date).dueToday);
        const overdueRate = openTickets.length ? Math.round((overdueTickets.length / openTickets.length) * 100) : 0;
        const firstAttendanceMeasured = openTickets.map(ticket => ticketFirstAttendanceSlaState(ticket)).filter(value => value !== null);
        const firstAttendanceBreached = firstAttendanceMeasured.filter(value => value === false).length;
        const firstAttendanceBreachedRate = firstAttendanceMeasured.length ? Math.round((firstAttendanceBreached / firstAttendanceMeasured.length) * 100) : 0;
        const avgOverdue = averageOverdueDays(overdueTickets, date);
        const oldest = overdueTickets.slice().sort((a, b) => ticketDueContext(b, date).overdueDays - ticketDueContext(a, date).overdueDays)[0] || null;
        const categoriesOpen = groupedTicketCount(openTickets, ticketCategoryLabel);
        const categoriesOverdue = groupedTicketCount(overdueTickets, ticketCategoryLabel);
        const originsOpen = groupedTicketCount(openTickets, ticketDemandOrigin);
        const originsOverdue = groupedTicketCount(overdueTickets, ticketDemandOrigin);
        const stagesOverdue = groupedTicketCount(overdueTickets, ticketStageLabel);
        const people = workloadByResponsible(row).map(person => {
            const open = person.openTickets;
            const overdue = open.filter(ticket => ticketDueContext(ticket, date).overdueDays > 0);
            const rate = open.length ? Math.round((overdue.length / open.length) * 100) : 0;
            return {
                ...person,
                overdueTickets: overdue,
                overdueRate: rate,
                avgOverdueDays: averageOverdueDays(overdue, date),
                topCategory: topGroupText(overdue.length ? overdue : open, ticketCategoryLabel),
                topOrigin: topGroupText(overdue.length ? overdue : open, ticketDemandOrigin),
            };
        }).sort((a, b) => b.overdue - a.overdue || b.overdueRate - a.overdueRate || b.open - a.open || a.name.localeCompare(b.name));
        return {
            date, openTickets, overdueTickets, dueTodayTickets, overdueRate,
            firstAttendanceMeasured: firstAttendanceMeasured.length, firstAttendanceBreached, firstAttendanceBreachedRate,
            avgOverdue, oldest, categoriesOpen, categoriesOverdue, originsOpen, originsOverdue, stagesOverdue, people,
        };
    }

    function operationalOriginSummary(groups) {
        if (!groups.length) return "Sem dados";
        return groups.slice(0, 3).map(item => `${item.label}: ${item.total}`).join(" · ");
    }

    function renderOperationalSlaRead(row) {
        const snapshot = operationalSlaSnapshot(row);
        const worst = snapshot.people.find(person => person.open > 0) || null;
        const oldestDue = snapshot.oldest ? ticketDueContext(snapshot.oldest, snapshot.date) : null;
        const topCategory = snapshot.categoriesOverdue[0] || snapshot.categoriesOpen[0] || null;
        const topStage = snapshot.stagesOverdue[0] || null;
        const ranking = snapshot.people.filter(person => person.open > 0).slice(0, 6);
        const evidenceText = worst && worst.overdue
            ? `${worst.name} concentra ${worst.overdue} vencido(s) de ${worst.open} aberto(s) (${worst.overdueRate}%). Entre os vencidos, a maior concentração é ${worst.topCategory}; origem/ambiente: ${worst.topOrigin}. Isso é um indício para investigação, não uma causa automática.`
            : "Não há concentração de vencidos suficiente para sugerir uma hipótese automática. Use a leitura macro para registrar capacidade, processo ou ferramenta quando houver contexto operacional.";
        return `<section class="tickets-status-report__sla-read">
            <header><div><span>Leitura de terça</span><h4>Operação, fluxo e SLA</h4><p>Leitura somente consultiva para justificar a reunião. O sistema mostra concentração e evidências; a causa continua sendo validada pela liderança.</p></div><small>Referência ${formatDate(snapshot.date)}</small></header>
            <div class="tickets-status-report__sla-kpis">
                <article><small>Abertos</small><strong>${snapshot.openTickets.length}</strong><span>fila na data</span></article>
                <article class="${snapshot.overdueTickets.length ? "is-risk" : "is-ok"}"><small>SLA vencido</small><strong>${snapshot.overdueTickets.length}</strong><span>${snapshot.overdueRate}% dos abertos</span></article>
                <article class="${snapshot.dueTodayTickets.length ? "is-attention" : ""}"><small>Vence hoje</small><strong>${snapshot.dueTodayTickets.length}</strong><span>pressão imediata</span></article>
                <article class="${snapshot.firstAttendanceBreached ? "is-attention" : ""}"><small>1º atendimento fora SLA</small><strong>${snapshot.firstAttendanceMeasured ? snapshot.firstAttendanceBreached : "—"}</strong><span>${snapshot.firstAttendanceMeasured ? `${snapshot.firstAttendanceBreachedRate}% de ${snapshot.firstAttendanceMeasured} medidos` : "sem medição reconhecida"}</span></article>
                <article><small>Média de atraso</small><strong>${snapshot.avgOverdue || 0}d</strong><span>entre vencidos</span></article>
                <article><small>Categoria crítica</small><strong>${escapeHtml(topCategory?.label || "—")}</strong><span>${topCategory ? `${topCategory.total} ticket(s)` : "sem concentração"}</span></article>
                <article><small>Estágio dos vencidos</small><strong>${escapeHtml(topStage?.label || "—")}</strong><span>${topStage ? `${topStage.total} ticket(s)` : "sem estágio dominante"}</span></article>
            </div>
            <div class="tickets-status-report__sla-context">
                <article><span>Origem / ambiente dos abertos</span><strong>${escapeHtml(operationalOriginSummary(snapshot.originsOpen))}</strong></article>
                <article><span>Origem / ambiente dos vencidos</span><strong>${escapeHtml(operationalOriginSummary(snapshot.originsOverdue))}</strong></article>
                <article><span>Maior atraso individual</span><strong>${snapshot.oldest ? `${escapeHtml(`#${snapshot.oldest.ticket_number || snapshot.oldest.ticket || ""}`)} · ${oldestDue.overdueDays} dia(s) · ${escapeHtml(snapshot.oldest.responsible_name || "Sem responsável")}` : "Nenhum ticket vencido"}</strong></article>
            </div>
            <div class="tickets-status-report__sla-ranking">
                <div class="tickets-status-report__sla-ranking-head"><div><span>Quem mais estoura prazo</span><h5>Ranking por responsável</h5></div><small>Categoria e origem ajudam a formular a pergunta “por quê?”.</small></div>
                <div class="tickets-status-report__sla-ranking-table">
                    <div class="is-head"><span>Responsável</span><span>Abertos</span><span>Vencidos</span><span>% vencido</span><span>Média atraso</span><span>Categoria predominante</span><span>Origem/ambiente</span></div>
                    ${ranking.map(person => `<div class="${person.overdueRate >= 50 && person.overdue ? "is-risk" : ""}"><span><strong>${escapeHtml(person.name)}</strong></span><span>${person.open}</span><span>${person.overdue}</span><span>${person.open ? `${person.overdueRate}%` : "—"}</span><span>${person.avgOverdueDays ? `${person.avgOverdueDays}d` : "—"}</span><span title="${escapeHtml(person.topCategory)}">${escapeHtml(person.topCategory)}</span><span title="${escapeHtml(person.topOrigin)}">${escapeHtml(person.topOrigin)}</span></div>`).join("") || `<p>Nenhum responsável com tickets abertos.</p>`}
                </div>
            </div>
            <div class="tickets-status-report__sla-hypothesis"><i class="fa fa-search"></i><div><span>Hipótese para validar na reunião</span><p>${escapeHtml(evidenceText)}</p></div></div>
        </section>`;
    }

    function buildLeaderInsights(row, code) {
        const out = [];
        const m = row.ticketMetric, p = row.projectMetric;
        const referenceDate = elements.statusReportDate.value || isoToday();
        if (m.overdue) out.push({ level: "critical", label: "SLA", text: `${m.overdue} ticket(s) vencido(s) de ${m.open} aberto(s) (${m.open ? Math.round((m.overdue/m.open)*100) : 0}% da fila).` });
        if (m.balance > 0) out.push({ level: "attention", label: "Fluxo", text: `O backlog cresceu ${m.balance}: entraram ${m.createdToday} e saíram ${m.closedToday}.` });
        if (m.balance < 0) out.push({ level: "ok", label: "Fluxo", text: `O backlog reduziu ${Math.abs(m.balance)}: entraram ${m.createdToday} e saíram ${m.closedToday}.` });
        if (code === "operacao") {
            const snapshot = operationalSlaSnapshot(row);
            const worst = snapshot.people.find(person => person.overdue > 0);
            if (worst) out.push({ level: "opportunity", label: "Pessoa", text: `${worst.name} tem ${worst.overdue}/${worst.open} vencido(s) (${worst.overdueRate}%), média ${worst.avgOverdueDays || 0} dia(s) de atraso.` });
            const category = snapshot.categoriesOverdue[0];
            if (category) out.push({ level: "opportunity", label: "Categoria", text: `${category.label} concentra ${category.total} ticket(s) vencido(s).` });
            if (snapshot.originsOverdue.length) out.push({ level: "opportunity", label: "Origem", text: `Vencidos por origem/ambiente: ${operationalOriginSummary(snapshot.originsOverdue)}.` });
        }
        if (p.overdueTasks) out.push({ level: "critical", label: "Projetos", text: `${p.overdueTasks} tarefa(s) atrasada(s) em ${p.total} projeto(s) em curso.` });
        if (code === "projetos") row.projects.filter(pj => Number(pj.progresso_esperado||0) > Number(pj.progresso||0)).slice(0,2).forEach(pj => out.push({ level: "attention", label: "Desvio", text: `${pj.nome}: ${number(pj.progresso)}% realizado versus ${number(pj.progresso_esperado)}% esperado.` }));
        if (!out.length) out.push({ level: "ok", label: "Em dia", text: `Nenhuma exceção automática relevante foi encontrada em ${formatDate(referenceDate)}.` });
        return out.slice(0, 7);
    }

    function statusReportExceptions(row, code) {
        const referenceDate = elements.statusReportDate.value || isoToday();
        const tickets = row.tickets
            .filter(t => ticketActiveOnDate(t, referenceDate))
            .filter(t => {
                const due = dateOnly(t.solve_expiration);
                return due ? due <= referenceDate : normalize(t.status_sla).includes("venc");
            })
            .sort((a, b) => ticketDueContext(b, referenceDate).overdueDays - ticketDueContext(a, referenceDate).overdueDays)
            .slice(0, 12)
            .map(t => {
                const due = ticketDueContext(t, referenceDate);
                return treatmentItemFromTicket(t, due.overdueDays ? "Prazo vencido" : due.dueToday ? "Prazo atingido" : "SLA vencido", referenceDate);
            });
        const projects = row.projects.filter(p => Number(p.tarefas_atrasadas||0)>0 || Number(p.progresso_esperado||0)>Number(p.progresso||0)).slice(0,8).map(p => ({ tipo:"projeto", id:String(p.id), referencia:p.codigo||`Projeto ${p.id}`, titulo:p.nome, motivo:p.tarefas_atrasadas?`${p.tarefas_atrasadas} tarefa(s) atrasada(s)`:"Progresso abaixo do esperado", responsavel:"", url:p.url||p.projeto_url||"" }));
        return code === "projetos" ? projects : code === "operacao" ? tickets : [...projects, ...tickets].slice(0, 12);
    }

    function treatmentKey(item) {
        return `${String(item?.tipo || "ticket")}:${String(item?.id || "")}`;
    }

    function ticketOriginalUrl(ticket) {
        return String(ticket?.ticket_url || ticket?.tiflux_url || ticket?.original_url || ticket?.public_url || ticket?.url || ticket?.link || "").trim();
    }

    function treatmentItemFromTicket(ticket, motivo = "Selecionado manualmente", referenceDate = elements.statusReportDate?.value || isoToday()) {
        const id = String(ticket?.ticket_number || ticket?.ticket || "").trim();
        const due = ticketDueContext(ticket, referenceDate);
        return {
            tipo: "ticket",
            id,
            referencia: id ? `#${id}` : "Ticket",
            titulo: ticket?.title || "Sem título",
            motivo,
            responsavel: ticket?.responsible_name || "Sem responsável",
            url: ticketOriginalUrl(ticket),
            prazo_sla: due.due,
            dias_vencido: due.overdueDays,
            prazo_detalhe: due.detail,
        };
    }

    function workloadByResponsible(row) {
        const referenceDate = elements.statusReportDate.value || isoToday();
        const roster = [...new Set([row.leader.name, ...(row.leader.members || [])].filter(Boolean))];
        const groups = new Map(roster.map(name => [name, []]));
        row.tickets.forEach(ticket => {
            const name = ticket.responsible_name || ticket.responsavel || "Sem responsável";
            if (!groups.has(name)) groups.set(name, []);
            groups.get(name).push(ticket);
        });
        return [...groups.entries()].map(([name, tickets]) => {
            const metric = ticketMetrics(tickets, referenceDate);
            const openTickets = tickets.filter(ticket => ticketActiveOnDate(ticket, referenceDate)).sort((a, b) => {
                const aDue = ticketDueContext(a, referenceDate);
                const bDue = ticketDueContext(b, referenceDate);
                if (aDue.overdueDays !== bDue.overdueDays) return bDue.overdueDays - aDue.overdueDays;
                return String(a.ticket_number || a.ticket || "").localeCompare(String(b.ticket_number || b.ticket || ""));
            });
            return { name, tickets, openTickets, open: metric.open, overdue: metric.overdue, created: metric.createdToday, closed: metric.closedToday, balance: metric.balance };
        }).sort((a, b) => b.open - a.open || b.overdue - a.overdue || a.name.localeCompare(b.name));
    }

    function renderTeamWorkload(row) {
        const people = workloadByResponsible(row);
        const activePeople = people.filter(item => item.open > 0);
        const totalOpen = activePeople.reduce((sum, item) => sum + item.open, 0);
        const average = activePeople.length ? totalOpen / activePeople.length : 0;
        const highest = activePeople[0];
        return `<section class="tickets-status-report__workload" data-workload-section>
            <header><div><span>Distribuição da fila</span><h4>Carga por pessoa</h4><p>${highest ? `Média ${average.toFixed(1).replace(".", ",")} aberto(s) por pessoa com fila · maior carga: ${escapeHtml(highest.name)} (${highest.open})` : "Nenhum ticket aberto na data de referência."}</p></div><small>Clique em uma pessoa para ver exatamente quais tickets compõem o total.</small></header>
            <div class="tickets-status-report__workload-grid">${people.map(person => renderWorkloadPerson(person, average)).join("")}</div>
        </section>`;
    }

    function renderWorkloadPerson(person, average) {
        const overloaded = average > 0 && person.open > average * 1.25 && person.open >= 5;
        const key = normalize(person.name).replace(/[^a-z0-9]+/g, "-") || "sem-responsavel";
        const ticketRows = person.openTickets.map(ticket => {
            const item = treatmentItemFromTicket(ticket);
            const due = ticketDueContext(ticket);
            return `<article class="tickets-status-report__workload-ticket"><div class="tickets-status-report__workload-ticket-main"><span class="tickets-status-report__ticket-inline"><b>${escapeHtml(item.referencia)}</b><em>—</em><strong>${escapeHtml(item.titulo)}</strong></span><small>${due.detail ? escapeHtml(due.detail) : "Sem prazo de solução"}</small></div><div class="tickets-status-report__workload-ticket-actions"><span class="tickets-status-report__sla-chip ${due.overdueDays ? "is-overdue" : due.dueToday ? "is-today" : ""}" title="${escapeHtml(due.detail)}">${escapeHtml(due.label)}</span><button type="button" data-workload-add='${escapeHtml(JSON.stringify(item))}'><i class="fa fa-plus"></i> Tratar</button><button type="button" data-open-original-ticket="${escapeHtml(item.id)}" title="Abrir ticket"><i class="fa fa-external-link"></i></button></div></article>`;
        }).join("");
        return `<article class="tickets-status-report__workload-person ${overloaded ? "is-overloaded" : ""}" data-workload-person="${escapeHtml(key)}"><button type="button" data-workload-toggle aria-expanded="false"><div><strong>${escapeHtml(person.name)}</strong>${overloaded ? `<small><i class="fa fa-exclamation-circle"></i> concentração</small>` : ""}</div><span><b>${person.open}</b><small>Abertos</small></span><span><b>${person.overdue}</b><small>Vencidos</small></span><span><b>${person.created}</b><small>Entradas</small></span><span><b>${person.closed}</b><small>Saídas</small></span><i class="fa fa-chevron-down"></i></button><div class="tickets-status-report__workload-details" hidden>${ticketRows || `<p>Nenhum ticket aberto para ${escapeHtml(person.name)}.</p>`}</div></article>`;
    }

    function renderTreatmentSection(row, selectedItems) {
        const items = Array.isArray(selectedItems) ? selectedItems : [];
        return `<section class="tickets-status-report__treatment" data-treatment-section>
            <header>
                <div><span>Tratamento</span><h4>Itens selecionados para tratamento <b data-treatment-count>${items.length}</b></h4><p>Marque uma exceção ou adicione qualquer ticket aberto. Cada item mantém causa, impacto, ação, responsável, prazo e decisão separados.</p></div>
                <div class="tickets-status-report__treatment-search"><div><i class="fa fa-search"></i><input type="search" data-treatment-search placeholder="Adicionar outro ticket: número, título ou responsável" autocomplete="off"><div class="tickets-status-report__treatment-results" data-treatment-results hidden></div></div></div>
            </header>
            <div class="tickets-status-report__treatment-list" data-treatment-list>${items.map(item => renderTreatmentCard(item, row)).join("") || renderTreatmentEmpty()}</div>
        </section>`;
    }

    function renderTreatmentEmpty() {
        return `<div class="tickets-status-report__treatment-empty" data-treatment-empty><i class="fa fa-hand-pointer-o"></i><span>Marque uma exceção acima, abra a carga por pessoa ou pesquise qualquer ticket aberto para iniciar o tratamento.</span></div>`;
    }

    function responsibleActionControl(row, selected = "", itemId = "") {
        const allPeople = statusReportLeaders().flatMap(leader => [leader.name, ...(leader.members || [])]);
        const options = [...new Set([...STATUS_ACTION_RESPONSIBLE_OPTIONS, ...allPeople, row?.leader?.name, ...(row?.leader?.members || []), selected].filter(Boolean))]
            .sort((a, b) => String(a).localeCompare(String(b), "pt-BR"));
        return `<select data-treatment-field="responsavel_acao" required><option value="">Selecione o responsável</option>${options.map(name => `<option value="${escapeHtml(name)}" ${name === selected ? "selected" : ""}>${escapeHtml(name)}</option>`).join("")}</select>`;
    }

    function renderTreatmentCard(item, row = null) {
        const safe = {
            tipo: item?.tipo || "ticket", id: String(item?.id || ""), referencia: item?.referencia || "Item", titulo: item?.titulo || "Sem título",
            motivo: item?.motivo || item?.situacao || "Selecionado para tratamento", responsavel: item?.responsavel || "Sem responsável", url: item?.url || "",
            prazo_sla: item?.prazo_sla || "", dias_vencido: Number(item?.dias_vencido || 0), prazo_detalhe: item?.prazo_detalhe || "",
            causa_atraso: item?.causa_atraso || "", impacto_tipo: item?.impacto_tipo || "", impacto: item?.impacto || "", acao_necessaria: item?.acao_necessaria || "", responsavel_acao: item?.responsavel_acao || "",
            prazo: item?.prazo || "", precisa_decisao: item?.precisa_decisao === true || String(item?.precisa_decisao).toLowerCase() === "sim" ? "sim" : "nao",
            decisao_necessaria: item?.decisao_necessaria || "", decisor: item?.decisor || "", prazo_decisao: item?.prazo_decisao || "",
            acao_depende_decisao: item?.acao_depende_decisao === true || String(item?.acao_depende_decisao).toLowerCase() === "sim" ? "sim" : "nao",
            decisao_status: item?.decisao_status || "", resultado_decisao: item?.resultado_decisao || "",
            decisao_retorno_por: item?.decisao_retorno_por || "", decisao_atualizado_em: item?.decisao_atualizado_em || "",
            decisao_concluido_em: item?.decisao_concluido_em || "",
        };
        const key = treatmentKey(safe);
        const decisionVisible = safe.precisa_decisao === "sim";
        const originalAction = safe.url
            ? `<a href="${escapeHtml(safe.url)}" target="_blank" rel="noopener noreferrer" title="Abrir ticket original"><i class="fa fa-external-link"></i><span>Abrir original</span></a>`
            : safe.tipo === "ticket" ? `<button type="button" data-open-original-ticket="${escapeHtml(safe.id)}" title="O link original não veio na carga; localizar este ticket no dashboard"><i class="fa fa-external-link"></i><span>Localizar ticket</span></button>` : "";
        const slaLine = safe.prazo_sla ? `<span class="tickets-status-report__treatment-sla ${safe.dias_vencido ? "is-overdue" : ""}" title="${escapeHtml(safe.prazo_detalhe)}"><i class="fa fa-clock-o"></i><strong>${escapeHtml(safe.prazo_detalhe || `Prazo: ${formatDate(safe.prazo_sla)}`)}</strong></span>` : "";
        const returned = returnedDecisionStatus(
            safe.decisao_status,
            safe.resultado_decisao,
            safe.decisao_retorno_por,
            safe.decisao_atualizado_em
        );
        return `<article class="tickets-status-report__treatment-card" data-treatment-card data-item-key="${escapeHtml(key)}" data-item-base="${escapeHtml(JSON.stringify({ tipo:safe.tipo,id:safe.id,referencia:safe.referencia,titulo:safe.titulo,motivo:safe.motivo,responsavel:safe.responsavel,url:safe.url,prazo_sla:safe.prazo_sla,dias_vencido:safe.dias_vencido,prazo_detalhe:safe.prazo_detalhe,decisao_status:safe.decisao_status,resultado_decisao:safe.resultado_decisao,decisao_retorno_por:safe.decisao_retorno_por,decisao_atualizado_em:safe.decisao_atualizado_em,decisao_concluido_em:safe.decisao_concluido_em }))}">
            <header>
                <button type="button" class="tickets-status-report__treatment-toggle" data-treatment-toggle aria-expanded="true"><i class="fa fa-chevron-down"></i></button>
                <div><small>${escapeHtml(safe.tipo === "ticket" ? "Ticket selecionado" : "Projeto selecionado")}</small><h5 class="tickets-status-report__ticket-inline"><b>${escapeHtml(safe.referencia)}</b><em>—</em><strong>${escapeHtml(safe.titulo)}</strong></h5><p><span><i class="fa fa-user"></i> Responsável atual: <strong>${escapeHtml(safe.responsavel)}</strong></span><span><i class="fa fa-warning"></i> Situação: <strong>${escapeHtml(safe.motivo)}</strong></span>${slaLine}</p></div>
                <div class="tickets-status-report__treatment-card-actions">${originalAction}<button type="button" data-treatment-remove title="Remover do tratamento"><i class="fa fa-trash-o"></i><span>Remover</span></button></div>
            </header>
            <div class="tickets-status-report__treatment-body" data-treatment-body>
                <label class="is-wide"><span>Causa desta demanda <b class="tickets-required-mark">*</b></span><textarea rows="2" data-treatment-field="causa_atraso" placeholder="O que originou o desvio deste ticket?" required>${escapeHtml(safe.causa_atraso)}</textarea></label>
                <label><span>Tipo de impacto <b class="tickets-required-mark">*</b></span><select data-treatment-field="impacto_tipo" required>${impactOptionsHtml(safe.impacto_tipo, true)}</select></label>
                <label class="is-span-2"><span>Impacto desta demanda <b class="tickets-required-mark">*</b></span><textarea rows="2" data-treatment-field="impacto" placeholder="Qual o impacto concreto deste ticket para cliente, SLA, Diretoria ou equipe?" required>${escapeHtml(safe.impacto)}</textarea></label>
                <label class="is-wide"><span>Ação para este ticket <b class="tickets-required-mark">*</b></span><textarea rows="2" data-treatment-field="acao_necessaria" placeholder="O que precisa ser feito especificamente para resolver este ticket?" required>${escapeHtml(safe.acao_necessaria)}</textarea></label>
                <label><span>Responsável pela ação <b class="tickets-required-mark">*</b></span>${responsibleActionControl(row, safe.responsavel_acao, safe.id)}</label>
                <label><span>Entrega prevista da ação <b class="tickets-required-mark">*</b></span><input type="date" data-treatment-field="prazo" value="${escapeHtml(safe.prazo)}" required></label>
                <label><span>Precisa de decisão? <b class="tickets-required-mark">*</b></span><select data-treatment-field="precisa_decisao" required><option value="nao" ${!decisionVisible ? "selected" : ""}>Não</option><option value="sim" ${decisionVisible ? "selected" : ""}>Sim</option></select></label>
                <div class="tickets-status-report__treatment-decision is-wide" data-treatment-decision-wrap ${decisionVisible ? "" : "hidden"}>
                    <label class="is-span-2"><span>O que precisa ser decidido? <b class="tickets-required-mark">*</b></span><textarea rows="2" data-treatment-field="decisao_necessaria" placeholder="Descreva a decisão que precisa acontecer para este ticket avançar" ${decisionVisible ? "required" : ""}>${escapeHtml(safe.decisao_necessaria)}</textarea></label>
                    <label><span>Quem decide? <b class="tickets-required-mark">*</b></span><select data-treatment-field="decisor" ${decisionVisible ? "required" : ""}>${decisionOptionsHtml(safe.decisor, true)}</select></label>
                    <label><span>Decidir até <b class="tickets-required-mark">*</b></span><input type="date" data-treatment-field="prazo_decisao" value="${escapeHtml(safe.prazo_decisao)}" ${decisionVisible ? "required" : ""}></label>
                    <label><span>A ação depende desta decisão? <b class="tickets-required-mark">*</b></span><select data-treatment-field="acao_depende_decisao" ${decisionVisible ? "required" : ""}><option value="nao" ${safe.acao_depende_decisao === "nao" ? "selected" : ""}>Não</option><option value="sim" ${safe.acao_depende_decisao === "sim" ? "selected" : ""}>Sim</option></select></label>
                    ${returned}
                </div>
            </div>
        </article>`;
    }

    function treatmentRowForForm(form) {
        const leaderName = form?.dataset?.preworkLeader || "";
        return statusReportRows().find(item => item.leader.name === leaderName) || null;
    }

    function updateTreatmentCount(form) {
        const section = form?.querySelector("[data-treatment-section]");
        if (!section) return;
        const count = section.querySelectorAll("[data-treatment-card]").length;
        const counter = section.querySelector("[data-treatment-count]");
        if (counter) counter.textContent = String(count);
        const list = section.querySelector("[data-treatment-list]");
        const empty = list?.querySelector("[data-treatment-empty]");
        if (!count && !empty) list.insertAdjacentHTML("beforeend", renderTreatmentEmpty());
        if (count && empty) empty.remove();
    }

    function findSavedTreatmentItem(form, key) {
        const row = treatmentRowForForm(form);
        return (row?.daily?.itens_selecionados || []).find(item => treatmentKey(item) === key) || null;
    }

    function addTreatmentItem(form, item) {
        const list = form?.querySelector("[data-treatment-list]");
        if (!list || !item?.id) return;
        const key = treatmentKey(item);
        if (list.querySelector(`[data-item-key="${cssEscape(key)}"]`)) return;
        const saved = findSavedTreatmentItem(form, key);
        list.querySelector("[data-treatment-empty]")?.remove();
        const row = treatmentRowForForm(form);
        list.insertAdjacentHTML("beforeend", renderTreatmentCard(saved ? { ...item, ...saved } : item, row));
        const checkbox = [...form.querySelectorAll('[name="item_selecionado"]')].find(input => {
            try { return treatmentKey(JSON.parse(input.value)) === key; } catch (_) { return false; }
        });
        if (checkbox) checkbox.checked = true;
        updateTreatmentCount(form);
    }

    function removeTreatmentItem(form, key) {
        const card = [...(form?.querySelectorAll("[data-treatment-card]") || [])].find(item => item.dataset.itemKey === key);
        card?.remove();
        const checkbox = [...(form?.querySelectorAll('[name="item_selecionado"]') || [])].find(input => {
            try { return treatmentKey(JSON.parse(input.value)) === key; } catch (_) { return false; }
        });
        if (checkbox) checkbox.checked = false;
        updateTreatmentCount(form);
    }

    function cssEscape(value) {
        if (window.CSS?.escape) return window.CSS.escape(String(value));
        return String(value).replace(/(["\\])/g, "\\$1");
    }

    function handleTreatmentSelectionChange(event) {
        const checkbox = event.target.closest('[name="item_selecionado"]');
        if (!checkbox) return;
        const form = checkbox.closest("[data-prework-leader]");
        try {
            const item = JSON.parse(checkbox.value);
            if (checkbox.checked) addTreatmentItem(form, item);
            else removeTreatmentItem(form, treatmentKey(item));
        } catch (_) {}
    }

    function handleTreatmentSearchInput(event) {
        const input = event.target.closest("[data-treatment-search]");
        if (!input) return;
        const form = input.closest("[data-prework-leader]");
        const results = form?.querySelector("[data-treatment-results]");
        const row = treatmentRowForForm(form);
        if (!results || !row) return;
        const term = normalize(input.value);
        if (!term) { results.hidden = true; results.innerHTML = ""; return; }
        const referenceDate = elements.statusReportDate.value || isoToday();
        const selected = new Set([...(form.querySelectorAll("[data-treatment-card]"))].map(card => card.dataset.itemKey));
        const ticketSource = statusReportTickets.length ? statusReportTickets : sourceTickets;
        const matches = ticketSource.filter(ticket => ticketActiveOnDate(ticket, referenceDate)).filter(ticket => {
            const id = String(ticket.ticket_number || ticket.ticket || "");
            const haystack = normalize([id, ticket.title, ticket.responsible_name, ticket.client_name, ticket.empresa, ticket.desk_name].join(" "));
            return haystack.includes(term) && !selected.has(`ticket:${id}`);
        }).slice(0, 12);
        results.innerHTML = matches.map(ticket => {
            const item = treatmentItemFromTicket(ticket, "Selecionado manualmente", referenceDate);
            const ownerLeader = leaderForTicket(ticket)?.name || "Fora da matriz";
            const due = ticketDueContext(ticket, referenceDate);
            return `<button type="button" data-treatment-search-add="${escapeHtml(JSON.stringify(item))}"><b>${escapeHtml(item.referencia)}</b><span>${escapeHtml(item.titulo)}</span><small>${escapeHtml(item.responsavel)} · ${escapeHtml(ownerLeader)} · ${escapeHtml(due.label)}</small></button>`;
        }).join("") || `<p>Nenhum ticket aberto encontrado na carga completa.</p>`;
        results.hidden = false;
    }

    function locateTicketInDashboard(id) {
        const ticket = [...statusReportTickets, ...sourceTickets].find(item => String(item.ticket_number || item.ticket || "") === String(id || ""));
        if (!ticket) return showToast("Ticket não encontrado na carga atual.", true);
        const url = ticketOriginalUrl(ticket);
        if (url) { window.open(url, "_blank", "noopener,noreferrer"); return; }
        switchSection("#tickets-section-overview", false);
        if (elements.search) elements.search.value = String(id || "");
        activeView = isClosed(ticket) ? "closed" : "open";
        summaryFilter = null;
        currentPage = 1;
        updateTabState();
        applyFilters();
        document.querySelector("#ticketsBaseSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
        showToast("O link original não veio na carga. Exibindo o ticket na tabela do Workspace.");
    }

    function handleTreatmentFieldChange(event) {
        const field = event.target.closest('[data-treatment-field="precisa_decisao"]');
        if (!field) return;
        const card = field.closest("[data-treatment-card]");
        const decisionWrap = card?.querySelector("[data-treatment-decision-wrap]");
        if (!decisionWrap) return;
        const needsDecision = field.value === "sim";
        decisionWrap.hidden = !needsDecision;
        decisionWrap.querySelectorAll("[data-treatment-field]").forEach(input => {
            input.required = needsDecision;
            if (!needsDecision) {
                if (input.tagName === "SELECT") input.value = input.dataset.treatmentField === "acao_depende_decisao" ? "nao" : "";
                else input.value = "";
            }
        });
    }

    function handlePreworkConditionalFields(event) {
        const bloqueioStatus = event.target.closest('[name="bloqueio_status"]');
        if (bloqueioStatus) {
            const wrapper = bloqueioStatus.closest("label");
            const detail = wrapper?.querySelector('[name="bloqueio"]');
            if (detail) {
                detail.required = bloqueioStatus.value === "sim";
                detail.placeholder = bloqueioStatus.value === "sim" ? "Descreva a dependência ou impedimento *" : "Sem bloqueio: detalhe opcional";
            }
        }
        const macroDecision = event.target.closest('[name="precisa_decisao_macro"]');
        if (macroDecision) {
            const form = macroDecision.closest("[data-prework-leader]");
            const wrap = form?.querySelector("[data-macro-decision-wrap]");
            if (!wrap) return;
            const needsDecision = macroDecision.value === "sim";
            wrap.hidden = !needsDecision;
            wrap.querySelectorAll('textarea, select, input').forEach(input => {
                input.required = needsDecision;
                if (!needsDecision) input.value = "";
            });
        }
    }

    function handleDecisionTrackingChange(event) {
        const status = event.target.closest('[data-decision-status]');
        if (!status) return;
        const form = status.closest('[data-decision-form]');
        const result = form?.querySelector('[name="resultado_decisao"]');
        if (!result) return;
        const decided = status.value === "concluido";
        result.required = decided;
        result.placeholder = decided ? "Registre objetivamente o que foi decidido *" : "Resultado da decisão (preencher quando decidida)";
    }

    function handleDecisionFilters(event) {
        const field = event.target.closest('[data-decision-filter]');
        if (!field) return;
        const key = field.dataset.decisionFilter;
        if (!key) return;
        statusDecisionFilter[key] = String(field.value || "").trim();
        if (key === "search" && event.type === "input") {
            window.clearTimeout(statusDecisionSearchTimer);
            statusDecisionSearchTimer = window.setTimeout(() => {
                renderStatusReportDecisions();
                const search = elements.statusReportContent?.querySelector('[data-decision-filter="search"]');
                if (search) {
                    search.focus();
                    const end = search.value.length;
                    try { search.setSelectionRange(end, end); } catch (_) {}
                }
            }, 220);
            return;
        }
        renderStatusReportDecisions();
    }

    function handleTreatmentClick(event) {
        const decisionKpi = event.target.closest("[data-decision-kpi]");
        if (decisionKpi) {
            statusDecisionFilter.status = decisionKpi.dataset.decisionKpi || "open";
            renderStatusReportDecisions();
            return true;
        }
        const workloadToggle = event.target.closest("[data-workload-toggle]");
        if (workloadToggle) {
            const person = workloadToggle.closest("[data-workload-person]");
            const detail = person?.querySelector(".tickets-status-report__workload-details");
            const expanded = workloadToggle.getAttribute("aria-expanded") === "true";
            workloadToggle.setAttribute("aria-expanded", String(!expanded));
            workloadToggle.querySelector(":scope > i")?.classList.toggle("fa-chevron-up", !expanded);
            workloadToggle.querySelector(":scope > i")?.classList.toggle("fa-chevron-down", expanded);
            if (detail) detail.hidden = expanded;
            return true;
        }
        const workloadAdd = event.target.closest("[data-workload-add]");
        if (workloadAdd) {
            const form = workloadAdd.closest("[data-prework-leader]");
            try { addTreatmentItem(form, JSON.parse(workloadAdd.dataset.workloadAdd)); } catch (_) {}
            form?.querySelector("[data-treatment-section]")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
            return true;
        }
        const addButton = event.target.closest("[data-treatment-search-add]");
        if (addButton) {
            const form = addButton.closest("[data-prework-leader]");
            try { addTreatmentItem(form, JSON.parse(addButton.dataset.treatmentSearchAdd)); } catch (_) {}
            const input = form?.querySelector("[data-treatment-search]");
            const results = form?.querySelector("[data-treatment-results]");
            if (input) input.value = "";
            if (results) { results.hidden = true; results.innerHTML = ""; }
            return true;
        }
        const removeButton = event.target.closest("[data-treatment-remove]");
        if (removeButton) {
            const form = removeButton.closest("[data-prework-leader]");
            const card = removeButton.closest("[data-treatment-card]");
            if (card) removeTreatmentItem(form, card.dataset.itemKey);
            return true;
        }
        const toggleButton = event.target.closest("[data-treatment-toggle]");
        if (toggleButton) {
            const card = toggleButton.closest("[data-treatment-card]");
            const body = card?.querySelector("[data-treatment-body]");
            const expanded = toggleButton.getAttribute("aria-expanded") !== "false";
            toggleButton.setAttribute("aria-expanded", String(!expanded));
            toggleButton.querySelector("i").className = expanded ? "fa fa-chevron-right" : "fa fa-chevron-down";
            if (body) body.hidden = expanded;
            card?.classList.toggle("is-collapsed", expanded);
            return true;
        }
        const originalButton = event.target.closest("[data-open-original-ticket]");
        if (originalButton) { locateTicketInDashboard(originalButton.dataset.openOriginalTicket); return true; }
        return false;
    }

    function serializeTreatmentItems(form) {
        return [...form.querySelectorAll("[data-treatment-card]")].map(card => {
            let base = {};
            try { base = JSON.parse(card.dataset.itemBase || "{}"); } catch (_) {}
            card.querySelectorAll("[data-treatment-field]").forEach(field => { base[field.dataset.treatmentField] = String(field.value || "").trim(); });
            base.precisa_decisao = base.precisa_decisao === "sim";
            return base;
        });
    }
    function renderNextSteps(rows) {
        const actions = statusReportPayload.proximos_passos || [];
        return `<section class="tickets-status-report__next"><header><div><span>Compromissos</span><h3>Próximos passos</h3><p>Sem responsável, prazo e medida de sucesso, não é um próximo passo.</p></div></header><form data-next-step-form><select name="lider_nome" required><option value="">Liderança</option>${rows.map(r=>`<option>${escapeHtml(r.leader.name)}</option>`).join("")}</select><input name="acao" placeholder="Ação" required><input name="responsavel" placeholder="Responsável" required><input type="date" name="prazo" required><input name="medida_sucesso" placeholder="Medida de sucesso" required><button class="metas-button metas-button-primary">Adicionar</button></form><div class="tickets-status-report__next-list">${actions.map(a=>`<article class="${a.vencido?'is-overdue':''}"><div><small>${escapeHtml(a.lider_nome)} · ${formatDate(a.prazo)}</small><b>${escapeHtml(a.acao)}</b><span>${escapeHtml(a.responsavel)} · Sucesso: ${escapeHtml(a.medida_sucesso)}</span></div><select data-action-id="${a.id}"><option value="pendente" ${a.status==='pendente'?'selected':''}>Pendente</option><option value="em_andamento" ${a.status==='em_andamento'?'selected':''}>Em andamento</option><option value="concluido" ${a.status==='concluido'?'selected':''}>Concluído</option><option value="cancelado">Cancelado</option></select></article>`).join("") || "<p>Nenhum próximo passo registrado.</p>"}</div></section>`;
    }

    function requiredLabel(label, required = false) {
        return `${escapeHtml(label)}${required ? ` <b class="tickets-required-mark">*</b>` : ""}`;
    }

    function preworkField(name, label, value, placeholder, required = false) {
        return `<label><span>${requiredLabel(label, required)}</span><textarea name="${name}" rows="2" placeholder="${escapeHtml(placeholder)}" ${required ? "required" : ""}>${escapeHtml(value || "")}</textarea></label>`;
    }

    function decisionSituation(item) {
        if (item.status === "concluido") return { key: "decided", label: "Decidida", cls: "is-decided" };
        if (item.status === "cancelado") return { key: "cancelled", label: "Cancelada", cls: "is-cancelled" };
        if (item.vencida) return { key: "overdue", label: `Vencida${item.dias_atraso ? ` há ${item.dias_atraso} dia(s)` : ""}`, cls: "is-overdue" };
        if (item.vence_hoje) return { key: "today", label: "Vence hoje", cls: "is-today" };
        if (item.status === "em_andamento") return { key: "analysis", label: "Em análise", cls: "is-analysis" };
        return { key: "pending", label: "Pendente", cls: "is-pending" };
    }

    function decisionMatchesFilter(item) {
        const status = statusDecisionFilter.status || "open";
        if (status === "open" && ["concluido", "cancelado"].includes(item.status)) return false;
        if (status === "overdue" && !item.vencida) return false;
        if (status === "today" && !item.vence_hoje) return false;
        if (status === "decided" && item.status !== "concluido") return false;
        if (status === "analysis" && item.status !== "em_andamento") return false;
        if (status === "pending" && item.status !== "pendente") return false;
        if (status === "blocked" && !item.acao_depende_decisao) return false;
        if (status === "cancelled" && item.status !== "cancelado") return false;
        if (statusDecisionFilter.decisor !== "all" && item.decisor !== statusDecisionFilter.decisor) return false;
        if (statusDecisionFilter.leader !== "all" && item.lider_nome !== statusDecisionFilter.leader) return false;
        const search = normalize(statusDecisionFilter.search || "");
        if (search) {
            const haystack = normalize([
                item.decisao, item.referencia, item.titulo, item.lider_nome,
                item.decisor, item.responsavel_acao, item.responsavel_item,
                item.solicitante, item.acao_necessaria, item.resultado_decisao,
            ].join(" "));
            if (!haystack.includes(search)) return false;
        }
        return true;
    }

    function renderStatusReportDecisions() {
        const all = Array.isArray(statusReportPayload?.decisoes_acompanhamento) ? statusReportPayload.decisoes_acompanhamento : [];
        const summary = statusReportPayload?.resumo_decisoes || {};
        const filtered = all.filter(decisionMatchesFilter);
        const decisores = [...new Set(all.map(item => item.decisor).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
        const lideres = [...new Set(all.map(item => item.lider_nome).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
        const managerLabel = statusReportPayload?.visao_gerencial ? "Visão gerencial" : "Acompanhamento de decisões";
        const referenceDate = statusReportPayload?.data_acompanhamento || isoToday();
        elements.statusReportContent.innerHTML = `<section class="tickets-status-report__decision-manager">
            <header class="tickets-status-report__decision-manager-head">
                <div>
                    <span>${escapeHtml(managerLabel)}</span>
                    <h3>Acompanhamento de decisões</h3>
                    <p>Fila permanente de tudo que foi enviado para decisão nos preworks. A data do diário não limita esta tela: a solicitação permanece aqui até a conclusão e depois fica disponível no histórico.</p>
                </div>
                <aside title="Situação calculada em ${escapeHtml(formatDate(referenceDate))}">
                    <i class="fa fa-gavel"></i>
                    <strong>${number(summary.abertas || 0)}</strong>
                    <small>aguardando decisão</small>
                </aside>
            </header>
            <div class="tickets-status-report__decision-kpis">
                <button type="button" data-decision-kpi="open" class="${statusDecisionFilter.status === "open" ? "is-active" : ""}"><small>Pendentes</small><b>${number(summary.abertas || 0)}</b><span>Aguardando decisão</span></button>
                <button type="button" data-decision-kpi="overdue" class="is-risk ${statusDecisionFilter.status === "overdue" ? "is-active" : ""}"><small>Vencidas</small><b>${number(summary.vencidas || 0)}</b><span>Prazo de decisão estourado</span></button>
                <button type="button" data-decision-kpi="today" class="${statusDecisionFilter.status === "today" ? "is-active" : ""}"><small>Vencem hoje</small><b>${number(summary.vencem_hoje || 0)}</b><span>Precisam de retorno hoje</span></button>
                <button type="button" data-decision-kpi="analysis" class="${statusDecisionFilter.status === "analysis" ? "is-active" : ""}"><small>Em análise</small><b>${number(summary.em_analise || 0)}</b><span>Decisor já está atuando</span></button>
                <button type="button" data-decision-kpi="blocked" class="${statusDecisionFilter.status === "blocked" ? "is-active" : ""}"><small>Ações bloqueadas</small><b>${number(summary.acoes_bloqueadas || 0)}</b><span>Execução depende da decisão</span></button>
                <button type="button" data-decision-kpi="decided" class="${statusDecisionFilter.status === "decided" ? "is-active" : ""}"><small>Decididas</small><b>${number(summary.decididas || 0)}</b><span>Com resultado registrado</span></button>
            </div>
            <div class="tickets-status-report__decision-filters">
                <label><span>Situação</span><select data-decision-filter="status"><option value="all" ${statusDecisionFilter.status==='all'?'selected':''}>Todas</option><option value="open" ${statusDecisionFilter.status==='open'?'selected':''}>Pendentes + em análise</option><option value="overdue" ${statusDecisionFilter.status==='overdue'?'selected':''}>Vencidas</option><option value="today" ${statusDecisionFilter.status==='today'?'selected':''}>Vencem hoje</option><option value="pending" ${statusDecisionFilter.status==='pending'?'selected':''}>Pendentes</option><option value="analysis" ${statusDecisionFilter.status==='analysis'?'selected':''}>Em análise</option><option value="blocked" ${statusDecisionFilter.status==='blocked'?'selected':''}>Ações bloqueadas</option><option value="decided" ${statusDecisionFilter.status==='decided'?'selected':''}>Decididas</option><option value="cancelled" ${statusDecisionFilter.status==='cancelled'?'selected':''}>Canceladas</option></select></label>
                <label><span>Decisor</span><select data-decision-filter="decisor"><option value="all">Todos</option>${decisores.map(v=>`<option value="${escapeHtml(v)}" ${statusDecisionFilter.decisor===v?'selected':''}>${escapeHtml(v)}</option>`).join('')}</select></label>
                <label><span>Liderança solicitante</span><select data-decision-filter="leader"><option value="all">Todas</option>${lideres.map(v=>`<option value="${escapeHtml(v)}" ${statusDecisionFilter.leader===v?'selected':''}>${escapeHtml(v)}</option>`).join('')}</select></label>
                <label class="is-search"><span>Pesquisar</span><div><i class="fa fa-search"></i><input type="search" data-decision-filter="search" value="${escapeHtml(statusDecisionFilter.search || '')}" placeholder="Solicitante, ticket, decisão, ação..."></div></label>
            </div>
            <div class="tickets-status-report__decision-list">${filtered.map(renderDecisionTrackingCard).join('') || `<div class="tickets-status-report__empty"><i class="fa fa-check-circle"></i><span>Nenhuma decisão encontrada para os filtros selecionados.</span></div>`}</div>
        </section>`;
    }

    function renderDecisionTrackingCard(item) {
        const situation = decisionSituation(item);
        const actionText = String(item.acao_necessaria || "").trim();
        const actionOwner = String(item.responsavel_acao || "").trim();
        const actionDeadline = formatDate(item.prazo_acao) || "sem data";
        const dependency = item.acao_depende_decisao
            ? `<div class="tickets-status-report__decision-dependency is-blocking"><i class="fa fa-pause-circle"></i><span><b>Ação bloqueada por esta decisão</b>${actionText ? `${escapeHtml(actionText)} · ` : ""}Responsável: ${escapeHtml(actionOwner || "não informado")} · entrega ${escapeHtml(actionDeadline)}</span></div>`
            : (actionText || actionOwner)
                ? `<div class="tickets-status-report__decision-dependency"><i class="fa fa-link"></i><span><b>Ação relacionada</b>${actionText ? `${escapeHtml(actionText)} · ` : ""}Responsável: ${escapeHtml(actionOwner || "não informado")} · entrega ${escapeHtml(actionDeadline)}</span></div>`
                : "";
        const resultRequired = item.status === "concluido";
        const originLabel = item.origem_tipo === "decisao_macro"
            ? "Decisão macro"
            : (item.tipo_item === "projeto" ? "Projeto" : item.tipo_item === "tarefa" ? "Tarefa" : "Ticket");
        const requester = item.solicitante || item.lider_nome || "Não informado";
        const requestedAt = formatDateTime(item.solicitado_em) || formatDate(item.data_reuniao);
        const itemOwner = item.responsavel_item
            ? `<span><i class="fa fa-user"></i> Responsável da origem: <strong>${escapeHtml(item.responsavel_item)}</strong></span>`
            : "";
        const returnInfo = item.retorno_atualizado_em
            ? `<footer><i class="fa ${item.status === "concluido" ? "fa-check-circle" : "fa-reply"}"></i> Último retorno ${item.retorno_por ? `por ${escapeHtml(item.retorno_por)} ` : ""}em ${formatDateTime(item.retorno_atualizado_em)}${item.status === "concluido" ? " · resultado devolvido ao prework de origem" : " · status devolvido ao prework de origem"}</footer>`
            : "";

        return `<form class="tickets-status-report__decision-card ${situation.cls}" data-decision-form>
            <input type="hidden" name="origem_tipo" value="${escapeHtml(item.origem_tipo)}">
            <input type="hidden" name="origem_referencia" value="${escapeHtml(item.origem_referencia)}">
            <input type="hidden" name="data_reuniao" value="${escapeHtml(item.data_reuniao)}">
            <input type="hidden" name="lider_nome" value="${escapeHtml(item.lider_nome)}">
            <input type="hidden" name="decisao" value="${escapeHtml(item.decisao)}">
            <input type="hidden" name="decisor" value="${escapeHtml(item.decisor)}">
            <input type="hidden" name="prazo" value="${escapeHtml(item.prazo_decisao || '')}">
            <header>
                <span class="tickets-status-report__decision-status ${situation.cls}">${escapeHtml(situation.label)}</span>
                <div>
                    <small>Solicitado por <strong>${escapeHtml(requester)}</strong> em ${escapeHtml(requestedAt)} · Diário ${escapeHtml(formatDate(item.data_reuniao))} · ${escapeHtml(item.lider_nome)} / ${escapeHtml(item.area || "")}</small>
                    <span>${escapeHtml(originLabel)} · ${escapeHtml(item.referencia || "Sem referência")}</span>
                    <h4>${escapeHtml(item.decisao || "Decisão não descrita")}</h4>
                    ${item.titulo ? `<p><strong>Origem:</strong> ${escapeHtml(item.titulo)}</p>` : ""}
                    ${item.impacto ? `<p><strong>Impacto:</strong> ${escapeHtml(item.impacto)}</p>` : ""}
                    ${itemOwner}
                </div>
                <aside>
                    <small>Decisor</small>
                    <strong>${escapeHtml(item.decisor || "Não informado")}</strong>
                    <small>Decidir até</small>
                    <strong class="${item.vencida ? "is-overdue" : ""}">${formatDate(item.prazo_decisao) || "Não informado"}</strong>
                </aside>
            </header>
            ${dependency}
            <div class="tickets-status-report__decision-update">
                <label><span>Status</span><select name="status" data-decision-status><option value="pendente" ${item.status==='pendente'?'selected':''}>Pendente</option><option value="em_andamento" ${item.status==='em_andamento'?'selected':''}>Em análise</option><option value="concluido" ${item.status==='concluido'?'selected':''}>Decidida</option><option value="cancelado" ${item.status==='cancelado'?'selected':''}>Cancelada</option></select></label>
                <label class="is-result"><span>Retorno / resultado para o solicitante ${resultRequired ? '<b class="tickets-required-mark">*</b>' : ''}</span><textarea name="resultado_decisao" rows="2" ${resultRequired ? 'required' : ''} placeholder="${resultRequired ? 'Registre objetivamente o que foi decidido para devolver ao solicitante *' : 'Use este campo para registrar o retorno; ao concluir, o resultado é obrigatório.'}">${escapeHtml(item.resultado_decisao || '')}</textarea></label>
                <button type="submit" class="metas-button metas-button-primary"><i class="fa fa-reply"></i> Salvar retorno</button>
            </div>
            ${returnInfo}
        </form>`;
    }

    async function saveStatusReportPrework(event) {
        const decisionForm = event.target.closest("[data-decision-form]");
        if (decisionForm) {
            event.preventDefault();
            if (!decisionForm.checkValidity()) {
                decisionForm.reportValidity();
                return showToast("Registre o resultado antes de marcar a decisão como decidida.", true);
            }
            const data = Object.fromEntries(new FormData(decisionForm).entries());
            data.acao_api = "atualizar_decisao";
            data.data_referencia = statusReportPayload?.data_acompanhamento || isoToday();
            return postStatusReport(data, "Decisão atualizada.");
        }
        const nextStep = event.target.closest("[data-next-step-form]");
        if (nextStep) {
            event.preventDefault();
            const data = Object.fromEntries(new FormData(nextStep).entries());
            data.acao_api = "criar_proximo_passo";
            data.data_referencia = elements.statusReportDate.value || isoToday();
            return postStatusReport(data, "Próximo passo registrado.");
        }
        const form = event.target.closest("[data-prework-leader]");
        if (!form) return;
        event.preventDefault();
        const button = event.submitter || form.querySelector('[data-save-mode="final"]');
        const submitButtons = [...form.querySelectorAll("button[type=submit]")];
        const saveMode = button?.dataset?.saveMode || "final";
        if (saveMode === "final" && !form.checkValidity()) {
            form.reportValidity();
            showToast("Preencha os campos obrigatórios marcados com * antes de salvar o prework.", true);
            return;
        }
        const data = Object.fromEntries(new FormData(form).entries());
        delete data.item_selecionado;
        const uiSnapshot = {
            bloqueio_status: data.bloqueio_status || "nao",
            impacto_tipo: data.impacto_tipo || "",
            precisa_decisao_macro: data.precisa_decisao_macro || "nao",
        };
        data.lider_nome = form.dataset.preworkLeader;
        data.data_referencia = elements.statusReportDate.value || isoToday();
        data.modo_salvamento = saveMode;
        data.itens_selecionados = serializeTreatmentItems(form);
        const row = statusReportRows().find(item => item.leader.name === data.lider_nome);
        data.snapshot_metricas = row ? {
            ...uiSnapshot,
            tickets_abertos: row.ticketMetric.open,
            tickets_vencidos: row.ticketMetric.overdue,
            entradas: row.ticketMetric.createdToday,
            saidas: row.ticketMetric.closedToday,
            concluidos: row.ticketMetric.closedToday,
            saldo_fluxo: row.ticketMetric.balance,
            indice_saida_entrada: row.ticketMetric.flowRatio,
            projetos: row.projectMetric.total,
            tarefas_atrasadas: row.projectMetric.overdueTasks,
            farol_sistema: row.health,
            fonte_tickets_atualizada_em: ticketsSourceUpdatedAt,
            ultima_data_ticket: ticketsLatestAt,
        } : uiSnapshot;
        submitButtons.forEach(item => item.disabled = true);
        try {
            const response = await fetch(elements.statusReportSection.dataset.url, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Accept": "application/json", "X-CSRFToken": csrfToken() },
                body: JSON.stringify(data),
            });
            const payload = await response.json();
            if (!response.ok || !payload.sucesso) throw new Error(payload.erro || "Não foi possível salvar o prework.");
            showToast(payload.mensagem || (data.modo_salvamento === "rascunho" ? "Rascunho salvo com sucesso." : "Prework salvo com sucesso."));
            await loadStatusReport(true);
        } catch (error) {
            showToast(error.message, true);
        } finally {
            submitButtons.forEach(item => item.disabled = false);
        }
    }

    async function postStatusReport(data, fallbackMessage) {
        try {
            const response = await fetch(elements.statusReportSection.dataset.url, { method:"POST", headers:{"Content-Type":"application/json","Accept":"application/json","X-CSRFToken":csrfToken()}, body:JSON.stringify(data) });
            const payload = await response.json();
            if (!response.ok || !payload.sucesso) throw new Error(payload.erro || "Não foi possível concluir a operação.");
            showToast(payload.mensagem || fallbackMessage);
            await loadStatusReport(true);
        } catch (error) { showToast(error.message, true); }
    }

    async function updateStatusReportAction(event) {
        const select = event.target.closest("[data-action-id]");
        if (!select) return;
        await postStatusReport({ acao_api:"atualizar_proximo_passo", id:select.dataset.actionId, status:select.value, data_referencia:elements.statusReportDate.value || isoToday() }, "Próximo passo atualizado.");
    }

    function csrfToken() {
        const item = document.cookie.split(";").map(value => value.trim()).find(value => value.startsWith("csrftoken="));
        return item ? decodeURIComponent(item.slice("csrftoken=".length)) : "";
    }

    function applyDescriptionDefaultVisibility() {
        try {
            if (localStorage.getItem(DESCRIPTION_DEFAULT_HIDDEN_KEY) === "1") return;
            hiddenColumns.add("description");
            localStorage.setItem("tickets-hidden-columns", JSON.stringify([...hiddenColumns]));
            localStorage.setItem(DESCRIPTION_DEFAULT_HIDDEN_KEY, "1");
        } catch (_) {
            hiddenColumns.add("description");
        }
    }
    function sanitizeColumnState() {
        const valid = COLUMNS.map(c => c.key);
        const seen = new Set();
        const order = columnOrder.filter(key => valid.includes(key) && !seen.has(key) && seen.add(key));
        valid.forEach((key, canonicalIndex) => {
            if (order.includes(key)) return;
            const next = valid.slice(canonicalIndex + 1).find(candidate => order.includes(candidate));
            if (next) {
                order.splice(order.indexOf(next), 0, key);
                return;
            }
            const previous = valid.slice(0, canonicalIndex).reverse().find(candidate => order.includes(candidate));
            if (previous) order.splice(order.indexOf(previous) + 1, 0, key);
            else order.push(key);
        });
        columnOrder = order;
        hiddenColumns = new Set([...hiddenColumns].filter(key => valid.includes(key)));
    }
    function saveColumnState() { localStorage.setItem("tickets-column-order", JSON.stringify(columnOrder)); localStorage.setItem("tickets-hidden-columns", JSON.stringify([...hiddenColumns])); }
    function loadArray(key, fallback) { try { const value = JSON.parse(localStorage.getItem(key)); return Array.isArray(value) ? value : fallback; } catch (_) { return fallback; } }
    function pageList(current, total) { if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1); if (current <= 4) return [1,2,3,4,5,"...",total]; if (current >= total - 3) return [1,"...",total-4,total-3,total-2,total-1,total]; return [1,"...",current-1,current,current+1,"...",total]; }
    function csvCell(value) { return `"${String(value ?? "").replace(/"/g, '""')}"`; }
    function number(value) { return Number(value || 0).toLocaleString("pt-BR"); }
    function normalize(value) { return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim(); }
    function localeSort(a, b) { return a.localeCompare(b, "pt-BR", { sensitivity: "base" }); }
    function isoToday() { const now = new Date(); return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0,10); }
    function formatDate(value) { const date = parseDate(value); return date ? date.toLocaleDateString("pt-BR") : ""; }
    function formatDateTime(value) { const date = parseDate(value); return date ? date.toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit", second:"2-digit" }) : ""; }
    function parseDate(value) { if (!value) return null; const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value); return Number.isNaN(date.getTime()) ? null : date; }
    function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"})[char]); }
})();
