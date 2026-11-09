(function () {
    "use strict";

    // Versão correspondente ao cache-busting do template: 5.63.0.

    const root = document.getElementById("projetosApp");
    if (!root) return;

    const state = {
        projetos: [],
        modelos: [],
        clientes: [],
        empresas: [],
        pessoas: [],
        owners: [],
        responsaveis: [],
        grupos: [],
        meuDia: null,
        scope: "todos",
        view: "lista",
        busca: "",
        status: "",
        dataCampo: "",
        dataDe: "",
        dataAte: "",
        projetoAberto: null,
        ganttProjectId: null,
        ganttProject: null,
        ganttScale: "month",
        ganttRender: null,
        ganttExpandedStages: new Set(),
        ganttExpandedTasks: new Set(),
        ganttShowSubtasks: false,
        ganttMine: false,
        ganttOverdue: false,
        chartStages: [],
        chartFilters: { granularity: "month", event: "created", item: "project", situation: "all" },
        kanbanTasks: [],
        kanbanProjectId: null,
        kanbanStageId: null,
        kanbanExecutorId: null,
        kanbanMine: false,
        kanbanOverdue: false,
        kanbanMode: "board",
        kanbanColumnOrder: ["backlog", "em_andamento", "aguardando", "bloqueada", "concluida"],
        kanbanCompletedCollapsed: false,
        portfolioSelectedProjectId: null,
        smartFilters: {
            responsible: [], owner: [], stakeholder: [], department: [], group: [], origin: [], company: [], client: [],
            type: [], moment: [], health: [], priority: [], deadline: [],
        },
        listColumnOrder: ["project", "type", "methodology", "category", "service", "client", "company", "reference", "cslog", "stakeholder", "responsible", "owner", "group", "opening", "period", "__homologation", "__golive", "status", "moment", "milestones", "health", "priority", "progress"],
        selectedProjectIds: new Set(),
        listHiddenColumns: [],
        listColumnFilters: {},
        listSortKey: "health",
        listSortDirection: "desc",
        renderedListProjects: [],
        loadingCount: 0,
        externalPersonTarget: null,
        previewRequestId: 0,
        editorPreviewRequestId: 0,
        responsiblePeopleCache: new Map(),
        favoriteProjectIds: new Set(),
    };

    // Hierarquia gerencial alinhada ao dashboard_tickets / Status Report.
    // Importante: Owner não entra no departamento do projeto, pois é um papel gerencial
    // e poderia classificar todos os projetos no mesmo departamento.
    const PROJECT_DEPARTMENT_HIERARCHY = [
        { department: "Processos", people: ["Emanuela Soares da Silva", "Danilo Araujo Mendonça", "Tamiris Marques de Araujo", "Fernanda Lisboa", "Caio Siqueira"] },
        { department: "Desenvolvimento", people: ["Renan Medeiros", "Gabriel Torrecilla", "Arthur Costa", "Felipe Alexandrino", "Eduarda Nascimento Oliveira", "Renan Balbino"] },
        { department: "Business Intelligence", people: ["Gustavo Dantas", "Rodrigo Sanches"] },
    ];

    const PROJECT_PERSON_ALIASES = {
        "danilo mendonca": "danilo araujo mendonca",
        "tamiris marques": "tamiris marques de araujo",
        "emanuela silva": "emanuela soares da silva",
        "eduarda oliveira": "eduarda nascimento oliveira",
        "gustavo rodrigo": "gustavo dantas",
        "gustavo rodrigues": "gustavo dantas",
    };

    try {
        const savedOrder = JSON.parse(window.localStorage.getItem("projetosKanbanColumnOrder") || "[]");
        const validColumns = ["backlog", "em_andamento", "aguardando", "bloqueada", "concluida"];
        if (Array.isArray(savedOrder) && savedOrder.length === validColumns.length && validColumns.every((key) => savedOrder.includes(key))) state.kanbanColumnOrder = savedOrder;
        state.kanbanCompletedCollapsed = window.localStorage.getItem("projetosKanbanCompletedCollapsed") === "1";
    } catch (error) {
        // Preferências locais inválidas não impedem a abertura do Kanban.
    }

    const api = {
        projetos: root.dataset.apiProjetos,
        exportarExcel: root.dataset.apiExportarExcel,
        ganttDatas: root.dataset.apiGanttDatas,
        tarefas: root.dataset.apiTarefas,
        tarefaSubtarefas: root.dataset.apiTarefaSubtarefas,
        subtarefas: root.dataset.apiSubtarefas,
        cronogramas: root.dataset.apiCronogramas,
        cronogramaPrevia: root.dataset.apiCronogramaPrevia,
        contexto: root.dataset.apiContexto,
        pessoas: root.dataset.apiPessoas,
        grupos: root.dataset.apiGrupos,
        meuDia: root.dataset.apiMeuDia,
        usuarios: root.dataset.apiUsuarios,
    };

    const userId = Number(root.dataset.userId || 0);
    const currentUserName = String(root.dataset.userName || "").trim();

    const methodologyGuide = {
        agil: {
            label: "Ágil",
            description: "Organizado em ciclos curtos, com entregas incrementais. Use Sprints para executar, revisar e adaptar o trabalho ao longo do projeto.",
            structure: "Sprint → Tarefa → Subtarefa",
            tracking: "Backlog, Sprints, progresso e entregas.",
        },
        waterfall: {
            label: "Waterfall",
            description: "Organizado em Fases sequenciais, com escopo mais estável, dependências claras e aprovações entre etapas.",
            structure: "Fase → Tarefa → Subtarefa",
            tracking: "Fases, dependências, marcos e caminho crítico.",
        },
    };

    function methodologyGuideHtml(value, compact = false) {
        const guide = methodologyGuide[value] || methodologyGuide.agil;
        return `<div class="projetos-methodology-guide__icon"><i class="fa fa-route" aria-hidden="true"></i></div>
            <div class="projetos-methodology-guide__content">
                <strong>${escapeHtml(guide.label)} · ${escapeHtml(guide.structure)}</strong>
                <span>${escapeHtml(guide.description)}</span>
                ${compact ? "" : `<small><b>Acompanhar:</b> ${escapeHtml(guide.tracking)}</small>`}
            </div>`;
    }

    function renderCreateMethodologyGuide() {
        const guide = document.getElementById("projetoMetodologiaGuia");
        const methodology = document.getElementById("projetoMetodologia")?.value || "agil";
        if (guide) guide.innerHTML = methodologyGuideHtml(methodology);
    }


    function flattenProjectStages(stages) {
        const result = [];
        const visit = (stage, parent = null, depth = 0) => {
            if (!stage) return;
            stage.__parentStage = parent;
            stage.__depth = depth;
            result.push(stage);
            (stage.sprints || []).forEach((child) => visit(child, stage, depth + 1));
        };
        (stages || []).forEach((stage) => visit(stage));
        return result;
    }

    function collectStageTasks(stage) {
        const tasks = [...(stage?.tarefas || [])];
        (stage?.sprints || []).forEach((child) => tasks.push(...collectStageTasks(child)));
        return tasks;
    }

    function findProjectStage(project, stageId) {
        return flattenProjectStages(project?.etapas || []).find(
            (stage) => Number(stage.id) === Number(stageId)
        ) || null;
    }

    function nestPlannedStages(stages) {
        const items = new Map();
        (stages || []).forEach((stage) => items.set(Number(stage.modelo_id), { ...stage, sprints: [] }));
        const roots = [];
        items.forEach((stage) => {
            const parentId = Number(stage.fase_pai_modelo_id || 0);
            if (parentId && items.has(parentId)) items.get(parentId).sprints.push(stage);
            else roots.push(stage);
        });
        return roots.sort((a, b) => Number(a.ordem || 0) - Number(b.ordem || 0));
    }

    let methodologyGuideTarget = "create";

    function methodologyRecommendation() {
        const scores = { agil: 0, waterfall: 0 };
        document.querySelectorAll('#projetosMethodologyGuide [data-methodology-question]').forEach((field) => {
            const value = field.value;
            if (!value) return;
            const yes = value === "sim";
            const key = field.dataset.methodologyQuestion;
            if (key === "scope") {
                if (yes) scores.agil += 3; else scores.waterfall += 2;
            } else if (key === "partial") {
                if (yes) scores.agil += 3; else scores.waterfall += 1;
            } else if (key === "approvals") {
                if (yes) scores.waterfall += 3; else scores.agil += 1;
            } else if (key === "sequence") {
                if (yes) scores.waterfall += 3; else scores.agil += 2;
            }
        });
        return scores.waterfall > scores.agil ? "waterfall" : "agil";
    }

    function refreshMethodologyRecommendation() {
        const box = document.getElementById("projetosMethodologyRecommendation");
        if (!box) return;
        const answered = Array.from(document.querySelectorAll('#projetosMethodologyGuide [data-methodology-question]'))
            .filter((field) => field.value).length;
        if (!answered) {
            box.innerHTML = `<strong>Responda às perguntas</strong><span>O sistema sugere uma metodologia, mas a decisão continua sendo do analista.</span>`;
            box.dataset.recommendation = "";
            return;
        }
        const value = methodologyRecommendation();
        const guide = methodologyGuide[value];
        box.dataset.recommendation = value;
        box.innerHTML = `<strong>Recomendação: ${escapeHtml(guide.label)}</strong><span>${escapeHtml(guide.structure)} · ${escapeHtml(guide.description)}</span>`;
    }

    function openMethodologyGuide(target = "create") {
        methodologyGuideTarget = target;
        const backdrop = document.getElementById("projetosMethodologyBackdrop");
        if (!backdrop) return;
        backdrop.hidden = false;
        backdrop.classList.add("is-open");
        backdrop.setAttribute("aria-hidden", "false");
        refreshMethodologyRecommendation();
    }

    function closeMethodologyGuide() {
        const backdrop = document.getElementById("projetosMethodologyBackdrop");
        if (!backdrop) return;
        backdrop.classList.remove("is-open");
        backdrop.setAttribute("aria-hidden", "true");
        backdrop.hidden = true;
    }

    function applyRecommendedMethodology(value) {
        const methodology = value || document.getElementById("projetosMethodologyRecommendation")?.dataset.recommendation;
        if (!methodology) return;
        if (methodologyGuideTarget === "editor") {
            const field = el.drawerBody?.querySelector('[data-project-field="metodologia"]');
            if (field) {
                field.value = methodology;
                field.dispatchEvent(new Event("change", { bubbles: true }));
            }
        } else {
            const field = document.getElementById("projetoMetodologia");
            if (field) {
                field.value = methodology;
                filterCreateModelsByMethodology();
                renderCreateMethodologyGuide();
                scheduleTemplatePreview();
            }
        }
        closeMethodologyGuide();
    }

    const listColumns = {
        project: { label: "Projeto" },
        type: { label: "Tipo" },
        methodology: { label: "Metodologia" },
        reference: { label: "Referência" },
        cslog: { label: "CSLOG" },
        category: { label: "Categoria" },
        service: { label: "Serviço completo" },
        client: { label: "Cliente" },
        company: { label: "Empresa" },
        owner: { label: "Owner" },
        stakeholder: { label: "Stakeholder" },
        responsible: { label: "Responsável" },
        group: { label: "Grupo" },
        opening: { label: "Data de abertura" },
        period: { label: "Período" },
        __homologation: { label: "Homologação" },
        __golive: { label: "Go Live" },
        status: { label: "Status" },
        moment: { label: "Momento atual" },
        milestones: { label: "Marcos" },
        health: { label: "Saúde" },
        progress: { label: "Progresso" },
        priority: { label: "Prioridade" },
    };

    const el = {
        novoButton: document.getElementById("projetosNovoButton"),
        busca: document.getElementById("projetosBusca"),
        statusFiltro: document.getElementById("projetosStatusFiltro"),
        smartFilterToggle: document.getElementById("projetosSmartFilterToggle"),
        smartFilterCount: document.getElementById("projetosSmartFilterCount"),
        smartFilters: document.getElementById("projetosSmartFilters"),
        smartFilterReset: document.getElementById("projetosSmartFilterReset"),
        dataCampo: document.getElementById("projetosDataCampo"),
        dataDe: document.getElementById("projetosDataDe"),
        dataAte: document.getElementById("projetosDataAte"),
        ganttProject: document.getElementById("projetosGanttProject"),
        ganttScale: document.getElementById("projetosGanttScale"),
        ganttMine: document.getElementById("projetosGanttMine"),
        ganttOverdue: document.getElementById("projetosGanttOverdue"),
        ganttShell: document.getElementById("projetosGanttShell"),
        ganttToggleStages: document.getElementById("projetosGanttToggleStages"),
        ganttToggleSubtasks: document.getElementById("projetosGanttToggleSubtasks"),
        ganttFullscreen: document.getElementById("projetosGanttFullscreen"),
        ganttExport: document.getElementById("projetosGanttExport"),
        ganttExportExcel: document.getElementById("projetosGanttExportExcel"),
        ganttSendStatus: document.getElementById("projetosGanttSendStatus"),
        tableBody: document.getElementById("projetosTableBody"),
        tableFoot: document.getElementById("projetosTableFoot"),
        tableTotal: document.getElementById("projetosTableTotal"),
        tableHead: document.getElementById("projetosTableHead"),
        tableWrap: document.getElementById("projetosTableWrap"),
        listView: document.getElementById("projetosListaView"),
        portfolioArea: document.getElementById("projetosPortfolioArea"),
        columnsToggle: document.getElementById("projetosColumnsToggle"),
        columnsMenu: document.getElementById("projetosColumnsMenu"),
        exportExcel: document.getElementById("projetosExportExcel"),
        listFullscreen: document.getElementById("projetosListFullscreen"),
        deleteSelected: document.getElementById("projetosDeleteSelected"),
        confirmBackdrop: document.getElementById("projetosConfirmBackdrop"),
        confirmTitle: document.getElementById("projetosConfirmTitle"),
        confirmMessage: document.getElementById("projetosConfirmMessage"),
        confirmCancel: document.getElementById("projetosConfirmCancel"),
        confirmAccept: document.getElementById("projetosConfirmAccept"),
        timeline: document.getElementById("projetosTimeline"),
        kanban: document.getElementById("projetosKanban"),
        charts: document.getElementById("projetosCharts"),
        empty: document.getElementById("projetosEmpty"),
        countBadge: document.getElementById("projetosCountBadge"),
        modalBackdrop: document.getElementById("projetosModalBackdrop"),
        modalClose: document.getElementById("projetosModalClose"),
        cancelarButton: document.getElementById("projetosCancelarButton"),
        form: document.getElementById("projetosNovoForm"),
        criarSubmit: document.getElementById("projetosCriarSubmit"),
        templatePreview: document.getElementById("projetosTemplatePreview"),
        drawer: document.getElementById("projetosDrawer"),
        drawerBackdrop: document.getElementById("projetosDrawerBackdrop"),
        drawerClose: document.getElementById("projetosDrawerClose"),
        drawerCodigo: document.getElementById("projetosDrawerCodigo"),
        drawerTitulo: document.getElementById("projetosDrawerTitulo"),
        drawerFavorite: document.getElementById("projetosDrawerFavorite"),
        drawerBadges: document.getElementById("projetosDrawerBadges"),
        drawerProgress: document.getElementById("projetosDrawerProgress"),
        drawerBody: document.getElementById("projetosDrawerBody"),
        toast: document.getElementById("projetosToast"),
        statusEmailBackdrop: document.getElementById("projetosStatusEmailBackdrop"),
        statusEmailForm: document.getElementById("projetosStatusEmailForm"),
        statusEmailClose: document.getElementById("projetosStatusEmailClose"),
        statusEmailCancel: document.getElementById("projetosStatusEmailCancel"),
        statusEmailSend: document.getElementById("projetosStatusEmailSend"),
        statusEmailPara: document.getElementById("projetosStatusEmailPara"),
        statusEmailCc: document.getElementById("projetosStatusEmailCc"),
        statusEmailAssunto: document.getElementById("projetosStatusEmailAssunto"),
        statusEmailObservacao: document.getElementById("projetosStatusEmailObservacao"),
        statusEmailAnexarGantt: document.getElementById("projetosStatusEmailAnexarGantt"),
        statusEmailAnexarExcel: document.getElementById("projetosStatusEmailAnexarExcel"),
        statusEmailAtrasos: document.getElementById("projetosStatusEmailAtrasos"),
        statusEmailPreview: document.getElementById("projetosStatusEmailPreview"),
        loading: document.getElementById("projetosLoading"),
        cronograma: document.getElementById("projetoCronograma"),
        dataInicioProjeto: document.getElementById("projetoDataInicio"),
        dataAberturaProjeto: document.getElementById("projetoDataAbertura"),
        duracaoDiasUteis: document.getElementById("projetoDuracaoDiasUteis"),
        dataFimProjeto: document.getElementById("projetoDataFim"),
        dataHomologacaoProjeto: document.getElementById("projetoDataHomologacao"),
        dataGoLiveProjeto: document.getElementById("projetoDataGoLive"),
        cliente: document.getElementById("projetoCliente"),
        empresa: document.getElementById("projetoEmpresa"),
        owner: document.getElementById("projetoOwner"),
        grupos: document.getElementById("projetoGrupos"),
        stakeholder: document.getElementById("projetoStakeholder"),
        responsavelProjeto: document.getElementById("projetoResponsavel"),
        portfolioArea: document.getElementById("projetosPortfolioArea"),
        meuDiaArea: document.getElementById("projetosMeuDiaArea"),
        meuDiaListas: document.getElementById("projetosMeuDiaListas"),
        railFavorites: document.getElementById("projetosRailFavorites"),
        railFavoritesCount: document.getElementById("projetosRailFavoritesCount"),
        panelTitle: document.getElementById("projetosPanelTitle"),
        panelDescription: document.getElementById("projetosPanelDescription"),
        pessoaModalBackdrop: document.getElementById("projetosPessoaModalBackdrop"),
        pessoaModalClose: document.getElementById("projetosPessoaModalClose"),
        pessoaForm: document.getElementById("projetosPessoaForm"),
        pessoaNome: document.getElementById("projetosPessoaNome"),
        pessoaEmail: document.getElementById("projetosPessoaEmail"),
        pessoaCargo: document.getElementById("projetosPessoaCargo"),
        pessoaCancelar: document.getElementById("projetosPessoaCancelar"),
        pessoaSalvar: document.getElementById("projetosPessoaSalvar"),
        pessoaInline: document.getElementById("projetosExternalPersonInline"),
        pessoaInlineNome: document.getElementById("projetosPessoaInlineNome"),
        pessoaInlineEmail: document.getElementById("projetosPessoaInlineEmail"),
        pessoaInlineCargo: document.getElementById("projetosPessoaInlineCargo"),
        pessoaInlineCancelar: document.getElementById("projetosPessoaInlineCancelar"),
        pessoaInlineSalvar: document.getElementById("projetosPessoaInlineSalvar"),
    };

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function getCookie(name) {
        const parts = document.cookie ? document.cookie.split(";") : [];
        for (const part of parts) {
            const item = part.trim();
            if (item.startsWith(name + "=")) {
                return decodeURIComponent(item.substring(name.length + 1));
            }
        }
        return "";
    }

    function setLoading(active) {
        state.loadingCount += active ? 1 : -1;
        if (state.loadingCount < 0) state.loadingCount = 0;
        // O feedback visual de carregamento pertence à navbar global.
        // O overlay local foi removido para evitar dois loadings simultâneos.
        if (!el.loading) return;
        const visible = state.loadingCount > 0;
        el.loading.classList.toggle("is-open", visible);
        el.loading.setAttribute("aria-hidden", visible ? "false" : "true");
    }

    async function request(url, options) {
        const config = Object.assign({
            headers: {
                "X-Requested-With": "XMLHttpRequest",
            },
        }, options || {});

        config.headers = Object.assign({}, config.headers || {});
        if (config.method && config.method !== "GET") {
            config.headers["Content-Type"] = "application/json";
            config.headers["X-CSRFToken"] = getCookie("csrftoken");
        }

        const response = await fetch(url, config);
        let payload = {};
        try {
            payload = await response.json();
        } catch (error) {
            payload = {};
        }

        if (!response.ok) {
            throw new Error(payload.mensagem || "Não foi possível concluir a operação.");
        }
        return payload;
    }

    function toast(message, error) {
        el.toast.textContent = message || "Operação concluída.";
        el.toast.classList.toggle("is-error", Boolean(error));
        el.toast.classList.add("is-open");
        window.clearTimeout(toast.timer);
        toast.timer = window.setTimeout(() => el.toast.classList.remove("is-open"), 3200);
    }

    function confirmWorkspace({ title, message, confirmLabel = "Confirmar" }) {
        return new Promise((resolve) => {
            if (!el.confirmBackdrop || !el.confirmAccept || !el.confirmCancel) {
                resolve(false);
                return;
            }

            el.confirmTitle.textContent = title || "Confirmar ação";
            el.confirmMessage.textContent = message || "Deseja continuar?";
            el.confirmAccept.textContent = confirmLabel;
            el.confirmBackdrop.hidden = false;
            el.confirmBackdrop.classList.add("is-open");
            document.body.classList.add("projetos-confirm-open");

            let finished = false;
            const finish = (accepted) => {
                if (finished) return;
                finished = true;
                el.confirmBackdrop.classList.remove("is-open");
                el.confirmBackdrop.hidden = true;
                document.body.classList.remove("projetos-confirm-open");
                el.confirmAccept.onclick = null;
                el.confirmCancel.onclick = null;
                el.confirmBackdrop.onclick = null;
                resolve(Boolean(accepted));
            };

            el.confirmAccept.onclick = () => finish(true);
            el.confirmCancel.onclick = () => finish(false);
            el.confirmBackdrop.onclick = (event) => {
                if (event.target === el.confirmBackdrop) finish(false);
            };
            window.setTimeout(() => el.confirmAccept.focus(), 20);
        });
    }

    function formatDate(value) {
        if (!value) return "—";
        const date = new Date(value + (value.length === 10 ? "T12:00:00" : ""));
        if (Number.isNaN(date.getTime())) return "—";
        return new Intl.DateTimeFormat("pt-BR").format(date);
    }

    function formatTableDate(value) {
        return value ? formatDate(value).replace("—", "") : "";
    }

    function formatHours(value) {
        const number = Number(value);
        if (!Number.isFinite(number)) return "—";
        return `${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: number % 1 ? 1 : 0, maximumFractionDigits: 2 }).format(number)}h`;
    }

    function formatBusinessDays(value, empty = "—") {
        if (value === null || value === undefined || value === "") return empty;
        const number = Number(value);
        if (!Number.isFinite(number)) return empty;
        const absolute = Math.abs(number);
        return `${number < 0 ? "-" : ""}${absolute} dia${absolute === 1 ? " útil" : "s úteis"}`;
    }

    function formatMoney(value) {
        const number = Number(value);
        if (!Number.isFinite(number)) return "—";
        return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(number);
    }

    function formatDateTime(value) {
        if (!value) return "—";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "—";
        return new Intl.DateTimeFormat("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        }).format(date);
    }

    function initials(name) {
        const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
        if (!parts.length) return "?";
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    function personLabel(person) {
        if (!person) return "Não definido";
        return person.nome;
    }

    function personChipHtml(person, fallback) {
        if (!person) return `<span class="projetos-person-empty">${escapeHtml(fallback || "Não definido")}</span>`;
        return `
            <div class="projetos-person projetos-person--compact">
                <span class="projetos-avatar">${escapeHtml(initials(person.nome))}</span>
                <span class="projetos-person__copy">
                    <strong>${escapeHtml(person.nome)}</strong>
                </span>
            </div>`;
    }

    function progressHtml(value) {
        const progress = Math.max(0, Math.min(100, Number(value || 0)));
        return `
            <div class="projetos-progress">
                <div class="projetos-progress__track">
                    <div class="projetos-progress__bar" style="width:${progress}%"></div>
                </div>
                <small>${progress.toFixed(0)}%</small>
            </div>`;
    }

    function uniqueFilterOptions(items) {
        const unique = [];
        items.filter((item) => item && item.value !== "" && item.label).forEach((item) => {
            if (!unique.some((entry) => String(entry.value) === String(item.value))) unique.push(item);
        });
        return unique.sort((a, b) => String(a.label).localeCompare(String(b.label), "pt-BR"));
    }

    function integrationValue(project, normalizedKey, ...sourceKeys) {
        const direct = project?.[normalizedKey];
        if (direct !== undefined && direct !== null && String(direct).trim() !== "") return direct;
        for (const key of sourceKeys) {
            const value = project?.[key];
            if (value !== undefined && value !== null && String(value).trim() !== "") return value;
        }
        return "";
    }

    function projectClientName(project) {
        return integrationValue(project, "cliente_nome", "client_name") || project?.cliente?.nome || "";
    }

    function projectCompanyName(project) {
        return integrationValue(project, "empresa_nome", "Empresa-Empresa", "empresa") || project?.empresa?.nome || "";
    }

    function projectCategoryName(project) {
        return integrationValue(project, "categoria", "Categoria-Categoria") || "";
    }

    function projectServiceName(project) {
        return integrationValue(project, "servico_completo", "Servico_Completo") || "";
    }

    function projectOriginInfo(project) {
        const cslogReference = integrationValue(
            project,
            "cslog",
            "Sistemas-Ticket CSLOG-NÃO PREENCHER",
            "ticket_cslog",
        );
        const hasCslog = Boolean(
            project?.tem_cslog
            || String(cslogReference || "").trim()
            || project?.cslog_status_fornecedor_nome
            || project?.cslog_data_ticket_aberto
            || project?.cslog_data_abertura_ticket
        );
        return hasCslog
            ? { key: "cslog", label: "CSLOG" }
            : { key: "qore", label: "QORE" };
    }

    function smartFilterValues(value) {
        if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
        if (value == null || value === "") return [];
        return [String(value)];
    }

    function smartFilterMatches(selectedValues, candidate) {
        const selected = smartFilterValues(selectedValues);
        if (!selected.length) return true;
        return selected.includes(String(candidate == null ? "" : candidate));
    }

    function smartFilterMatchesAny(selectedValues, candidates) {
        const selected = smartFilterValues(selectedValues);
        if (!selected.length) return true;
        const normalizedCandidates = (Array.isArray(candidates) ? candidates : [candidates])
            .map((item) => String(item == null ? "" : item));
        return normalizedCandidates.some((candidate) => selected.includes(candidate));
    }

    function renderSmartFilterOptions() {
        if (!el.smartFilters) return;
        const optionSets = {
            responsible: uniqueFilterOptions(state.projetos.flatMap((project) => projectResponsiblePeople(project).map((person) => ({ value: person.id || person.nome, label: personLabel(person) })))),
            owner: uniqueFilterOptions(state.projetos.map((project) => project.owner && ({ value: project.owner.id, label: personLabel(project.owner) }))),
            stakeholder: uniqueFilterOptions(state.projetos.map((project) => project.stakeholder && ({ value: project.stakeholder.id, label: personLabel(project.stakeholder) }))),
            department: PROJECT_DEPARTMENT_HIERARCHY.map((item) => ({ value: item.department, label: item.department })),
            group: uniqueFilterOptions(state.projetos.flatMap((project) => (project.grupos || []).map((group) => ({ value: group.id, label: group.nome })))),
            origin: [
                { value: "qore", label: "QORE" },
                { value: "cslog", label: "CSLOG" },
            ],
            company: uniqueFilterOptions(state.projetos.map((project) => ({ value: project.empresa?.id || projectCompanyName(project), label: projectCompanyName(project) }))),
            client: uniqueFilterOptions(state.projetos.map((project) => ({ value: project.cliente?.id || projectClientName(project), label: projectClientName(project) }))),
            type: uniqueFilterOptions(state.projetos.map((project) => ({ value: project.tipo_projeto, label: project.tipo_projeto }))),
            moment: uniqueFilterOptions(state.projetos.map((project) => ({ value: project.momento_atual, label: project.momento_atual_nome }))),
            health: uniqueFilterOptions(state.projetos.map((project) => ({ value: project.situacao, label: project.situacao_nome || project.saude_nome }))),
            priority: [
                { value: "baixa", label: "Baixa" },
                { value: "media", label: "Média" },
                { value: "alta", label: "Alta" },
                { value: "critica", label: "Crítica" },
            ],
            deadline: [
                { value: "em_atraso", label: "Em atraso" },
                { value: "no_prazo", label: "No prazo" },
                { value: "sem_prazo", label: "Sem prazo" },
            ],
        };

        Object.entries(optionSets).forEach(([key, options]) => {
            const select = el.smartFilters.querySelector(`[data-smart-filter="${key}"]`);
            if (!select) return;
            const selected = new Set(smartFilterValues(state.smartFilters[key]));
            select.innerHTML = options
                .filter((item) => item && item.value !== undefined && item.value !== null && String(item.value).trim() !== "")
                .map((item) => {
                    const value = String(item.value);
                    return `<option value="${escapeHtml(value)}"${selected.has(value) ? " selected" : ""}>${escapeHtml(item.label)}</option>`;
                })
                .join("");
            Array.from(select.options).forEach((option) => { option.selected = selected.has(String(option.value)); });
            window.WorkspaceUI?.refreshMultiselect?.(select);
        });

        const count = Object.values(state.smartFilters).filter((value) => smartFilterValues(value).length > 0).length;
        if (el.smartFilterCount) {
            el.smartFilterCount.textContent = count;
            el.smartFilterCount.hidden = count === 0;
        }
        el.smartFilterToggle?.classList.toggle("has-active-filters", count > 0);
    }

    function meuDiaProjectIds() {
        // Meu Dia é uma visão de PROJETOS baseada exclusivamente na Entrega / Go Live de hoje.
        // Tarefas e subtarefas permanecem no Kanban e não influenciam este contador/filtro.
        const ids = new Set();
        const todayDay = dateOnlyDayNumber(ganttDateKey(new Date()));
        if (todayDay == null) return ids;

        state.projetos.forEach((project) => {
            if (!projectIsOpenForRail(project)) return;
            const projectId = Number(project?.id || 0);
            const goLiveDay = dateOnlyDayNumber(projectGoLiveValue(project));
            if (projectId > 0 && goLiveDay === todayDay) ids.add(projectId);
        });
        return ids;
    }

    function projectIsOpenForRail(project) {
        const statusKey = projectTableKey(project?.status || project?.status_nome || "");
        const progress = Number(project?.progresso || 0);
        if (progress >= 100) return false;
        return !["concluido", "cancelado", "encerrado", "encerramento", "fechado"].includes(statusKey);
    }

    function projectDeliveryInfo(project) {
        const dueDate = String(projectGoLiveValue(project) || "").trim();
        if (!dueDate || !projectIsOpenForRail(project)) {
            return { overdue: false, attention: false, daysRemaining: null, dueDate };
        }
        const dueDay = dateOnlyDayNumber(dueDate);
        const todayDay = dateOnlyDayNumber(ganttDateKey(new Date()));
        const daysRemaining = dueDay != null && todayDay != null ? dueDay - todayDay : null;
        return {
            overdue: daysRemaining != null && daysRemaining < 0,
            attention: daysRemaining != null && daysRemaining >= 0 && daysRemaining <= PROJECT_ATTENTION_DAYS,
            daysRemaining,
            dueDate,
        };
    }

    function projectIsCritical(project) {
        return projectDeliveryInfo(project).overdue;
    }

    function projectNeedsAttention(project) {
        return projectDeliveryInfo(project).attention;
    }

    function filteredProjects() {
        const search = state.busca.trim().toLocaleLowerCase("pt-BR");
        const meuDiaIds = state.scope === "meu_dia" ? meuDiaProjectIds() : null;
        return state.projetos.filter((project) => {
            if (state.status) {
                if (state.status === "__atrasado") {
                    if (!projectDeadlineInfo(project).overdue) return false;
                } else if (project.status !== state.status) {
                    return false;
                }
            }

            const filters = state.smartFilters;
            if (!smartFilterMatches(filters.owner, project.owner?.id || "")) return false;
            if (!smartFilterMatches(filters.stakeholder, project.stakeholder?.id || "")) return false;
            if (!smartFilterMatchesAny(filters.responsible, projectResponsiblePeople(project).map((person) => person.id || person.nome))) return false;
            if (!smartFilterMatchesAny(filters.department, projectDepartments(project))) return false;
            if (!smartFilterMatches(filters.deadline, projectDeadlineInfo(project).key)) return false;
            if (!smartFilterMatches(filters.origin, projectOriginInfo(project).key)) return false;
            if (!smartFilterMatches(filters.client, project.cliente?.id || projectClientName(project))) return false;
            if (!smartFilterMatches(filters.company, project.empresa?.id || projectCompanyName(project))) return false;
            if (!smartFilterMatchesAny(filters.group, (project.grupos || []).map((group) => group.id))) return false;
            if (!smartFilterMatches(filters.priority, project.prioridade)) return false;
            if (!smartFilterMatches(filters.health, project.situacao)) return false;
            if (!smartFilterMatches(filters.type, project.tipo_projeto)) return false;
            if (!smartFilterMatches(filters.moment, project.momento_atual)) return false;

            if (state.scope === "meu_dia" && !meuDiaIds?.has(Number(project.id))) return false;
            if (state.scope === "meus" && !projectLeaderMatchesCurrentUser(project)) return false;
            if (state.scope === "criticos" && !projectIsCritical(project)) return false;
            if (state.scope === "atencao" && !projectNeedsAttention(project)) return false;

            if (state.dataCampo) {
                const fieldMap = {
                    abertura: "data_abertura",
                    inicio: "data_inicio",
                    homologacao: "data_homologacao_prevista",
                    golive: "data_go_live_prevista",
                    prazo: "data_fim_prevista",
                    conclusao: "data_conclusao",
                };
                const value = project[fieldMap[state.dataCampo]] || "";
                if (state.dataDe && (!value || value < state.dataDe)) return false;
                if (state.dataAte && (!value || value > state.dataAte)) return false;
            }

            if (search) {
                const haystack = [
                    project.codigo,
                    project.nome,
                    project.referencia || "",
                    project.cslog || "",
                    projectOriginInfo(project).label,
                    projectCategoryName(project),
                    projectServiceName(project),
                    projectClientName(project),
                    projectCompanyName(project),
                    project.owner ? project.owner.nome : "",
                    project.stakeholder ? project.stakeholder.nome : "",
                    projectResponsiblePeople(project).map(personLabel).join(", ") || project.responsavel_nomes || "",
                    project.grupo_nomes || "",
                    project.momento_atual_nome || "",
                    project.etapa_atual?.nome || "",
                    project.fase_atual?.nome || "",
                    project.sprint_atual?.nome || "",
                ].join(" ").toLocaleLowerCase("pt-BR");
                if (!haystack.includes(search)) return false;
            }
            return true;
        });
    }

    function updateCounters() {
        const active = state.projetos.filter((p) => !["rascunho", "planejado", "cancelado"].includes(p.status));
        const andamento = active.filter((p) => ["em_andamento", "aguardando", "homologacao", "encerramento"].includes(p.status));
        const criticalProjects = state.projetos.filter(projectIsCritical);
        const meus = state.projetos.filter(projectLeaderMatchesCurrentUser);
        const attention = state.projetos.filter(projectNeedsAttention);
        const meuDiaIds = meuDiaProjectIds();
        const avg = active.length ? active.reduce((acc, p) => acc + Number(p.progresso || 0), 0) / active.length : 0;

        const setKpi = (id, value) => {
            const card = document.getElementById(id);
            const target = card ? card.querySelector(".ws-kpi-card__value") : null;
            if (target) target.textContent = value;
        };
        const setText = (id, value) => {
            const node = document.getElementById(id);
            if (node) node.textContent = value;
        };

        setKpi("projetosKpiAtivos", active.length);
        setKpi("projetosKpiAndamento", andamento.length);
        setKpi("projetosKpiCriticos", criticalProjects.length);
        setKpi("projetosKpiProgresso", `${avg.toFixed(0)}%`);

        setText("projetosRailTodos", state.projetos.length);
        setText("projetosRailMeus", meus.length);
        setText("projetosRailCriticos", criticalProjects.length);
        setText("projetosRailAtencao", attention.length);
        setText("projetosRailMeuDia", meuDiaIds.size);
        renderFavoriteProjects();
    }

    function responsiblePeopleHtml(people) {
        const valid = (people || []).filter(Boolean);
        if (!valid.length) return `<span class="projetos-person-empty">Sem responsável</span>`;
        return `<div class="projetos-table-people">
            <span class="projetos-table-people__avatars">${valid.slice(0, 3).map((person) => `<span class="projetos-avatar" title="${escapeHtml(person.nome)}">${escapeHtml(initials(person.nome))}</span>`).join("")}${valid.length > 3 ? `<span class="projetos-avatar is-more">+${valid.length - 3}</span>` : ""}</span>
            <span>${escapeHtml(valid.map(personLabel).join(", "))}</span>
        </div>`;
    }

    function projectResponsiblePeople(project) {
        const projectId = Number(project?.id || 0);
        if (projectId && state.responsiblePeopleCache.has(projectId)) return state.responsiblePeopleCache.get(projectId);
        const people = [];
        const seenPeople = new Set();

        const addPerson = (person) => {
            if (!person || typeof person !== "object" || !person.nome) return;
            const key = person.id
                ? `id:${Number(person.id)}`
                : `nome:${String(person.nome).trim().toLocaleLowerCase("pt-BR")}`;
            if (seenPeople.has(key)) return;
            seenPeople.add(key);
            people.push(person);
        };

        const addTask = (task) => {
            if (!task) return;
            (task.responsaveis || []).forEach(addPerson);
            addPerson(task.responsavel_principal);
            addPerson(task.responsavel);
            (task.checklist || task.subtarefas || []).forEach((subtask) => {
                addPerson(subtask.responsavel_especifico);
                addPerson(subtask.responsavel);
                addPerson(subtask.executor);
            });
        };

        (project.responsaveis || []).forEach(addPerson);
        addPerson(project.responsavel_principal);
        addPerson(project.responsavel);
        flattenProjectStages(project.etapas || []).forEach((stage) => (stage.tarefas || []).forEach(addTask));
        (project.tarefas_sem_etapa || []).forEach(addTask);

        (state.kanbanTasks || [])
            .filter((task) => Number(task.projeto?.id || task.projeto_id) === Number(project.id))
            .forEach(addTask);

        if (projectId) state.responsiblePeopleCache.set(projectId, people);
        return people;
    }

    function normalizeProjectPersonName(value) {
        const normalized = String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLocaleLowerCase("pt-BR")
            .replace(/\s+/g, " ")
            .trim();
        return PROJECT_PERSON_ALIASES[normalized] || normalized;
    }

    function projectDepartments(project) {
        const people = new Set();
        projectResponsiblePeople(project).forEach((person) => {
            const name = normalizeProjectPersonName(person?.nome);
            if (name) people.add(name);
        });
        String(project?.responsavel_nomes || "")
            .split(/[;,|]/)
            .map(normalizeProjectPersonName)
            .filter(Boolean)
            .forEach((name) => people.add(name));

        return PROJECT_DEPARTMENT_HIERARCHY
            .filter((item) => item.people.some((name) => people.has(normalizeProjectPersonName(name))))
            .map((item) => item.department);
    }

    const PROJECT_ATTENTION_DAYS = 7;

    function dateOnlyDayNumber(value) {
        const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!match) return null;
        return Math.floor(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86400000);
    }

    function projectDeadlineInfo(project) {
        const status = String(project?.status || "").toLocaleLowerCase("pt-BR");
        const progress = Number(project?.progresso || 0);
        const closed = ["concluido", "cancelado", "encerrado"].includes(status) || progress >= 100;
        const dueDate = String(project?.data_fim_prevista || "").trim();
        if (!dueDate) return { key: "sem_prazo", label: "Sem prazo", overdue: false, attention: false, daysRemaining: null };

        const dueDay = dateOnlyDayNumber(dueDate);
        const todayDay = dateOnlyDayNumber(ganttDateKey(new Date()));
        const daysRemaining = dueDay != null && todayDay != null ? dueDay - todayDay : null;

        if (!closed && daysRemaining != null && daysRemaining < 0) {
            const daysLate = Math.abs(daysRemaining);
            return {
                key: "em_atraso",
                label: daysLate === 1 ? "1 dia de atraso" : `${daysLate} dias de atraso`,
                overdue: true,
                attention: false,
                daysRemaining,
            };
        }
        if (!closed && daysRemaining != null && daysRemaining <= PROJECT_ATTENTION_DAYS) {
            return {
                key: "atencao",
                label: daysRemaining === 0 ? "Vence hoje" : (daysRemaining === 1 ? "Vence amanhã" : `Vence em ${daysRemaining} dias`),
                overdue: false,
                attention: true,
                daysRemaining,
            };
        }
        return { key: "no_prazo", label: "No prazo", overdue: false, attention: false, daysRemaining };
    }

    function projectDeadlineBadgeHtml(project) {
        const info = projectDeadlineInfo(project);
        const date = formatDate(project?.data_fim_prevista) || "Sem prazo";
        const suffix = info.key === "em_atraso" || info.key === "atencao" ? ` · ${info.label}` : "";
        return `<span class="projetos-pill projetos-pill--deadline" data-deadline="${escapeHtml(info.key)}" title="Prazo previsto do projeto">Prazo: ${escapeHtml(date)}${escapeHtml(suffix)}</span>`;
    }

    function projectMethodologyName(project) {
        const explicit = String(project?.metodologia_nome || "").trim();
        if (explicit) return explicit;
        const key = String(project?.metodologia || project?.cronograma_modelo?.metodologia || "").trim().toLowerCase();
        return ({ agil: "Ágil", waterfall: "Waterfall" })[key] || "";
    }

    function listColumnValue(project, key) {
        const values = {
            project: integrationValue(project, "nome", "Nome projeto", "nome_projeto", "title") || "",
            type: project.tipo_projeto || project.cronograma_modelo?.nome || "",
            methodology: projectMethodologyName(project),
            reference: integrationValue(project, "referencia", "ticket_number") || "",
            cslog: integrationValue(project, "cslog", "Sistemas-Ticket CSLOG-NÃO PREENCHER", "ticket_cslog") || "",
            category: projectCategoryName(project),
            service: projectServiceName(project),
            client: projectClientName(project),
            company: projectCompanyName(project),
            owner: project.owner?.nome || "",
            stakeholder: project.stakeholder?.nome || "",
            responsible: projectResponsiblePeople(project).map(personLabel).join(", ") || project.responsavel_nomes || "",
            group: project.grupo_nomes || "",
            opening: project.data_abertura || "",
            period: project.data_inicio || "",
            __homologation: projectHomologationValue(project) || "",
            __golive: projectGoLiveValue(project) || "",
            status: project.status_nome || "",
            moment: project.momento_atual_nome || "",
            milestones: `${Number(project.marcos_concluidos || 0)}/${Number(project.marcos_total || 0)}`,
            health: project.situacao_nome || project.saude_nome || "",
            progress: Number(project.progresso || 0),
            priority: ({ baixa: 1, media: 2, alta: 3, critica: 4 })[project.prioridade] || 0,
        };
        return values[key];
    }

    function listColumnExportValue(project, key) {
        if (key === "project") return `${project.codigo || ""} - ${project.nome || ""}`;
        if (key === "period") return `${formatDate(project.data_inicio)} → ${formatDate(project.data_fim_prevista)}`;
        if (key === "__homologation") return formatTableDate(projectHomologationValue(project));
        if (key === "__golive") return formatTableDate(projectGoLiveValue(project));
        if (key === "progress") return `${Number(project.progresso || 0).toFixed(0)}%`;
        if (key === "priority") return project.prioridade_nome || "";
        return String(listColumnValue(project, key) || "");
    }

    const PORTFOLIO_COLUMN_FILTER_EMPTY = "__workspace_empty__";
    let portfolioColumnFilterPopover = null;

    function portfolioColumnFilterValue(project, key) {
        let value = "";
        if (key === "__homologation") value = formatTableDate(projectHomologationValue(project));
        else if (key === "__golive") value = formatTableDate(projectGoLiveValue(project));
        else if (key === "opening") value = formatTableDate(project.data_abertura);
        else if (key === "period") value = listColumnExportValue(project, "period");
        else if (key === "project") value = listColumnExportValue(project, "project");
        else if (key === "priority") value = project.prioridade_nome || "";
        else if (key === "progress") value = `${Number(project.progresso || 0).toFixed(0)}%`;
        else value = String(listColumnValue(project, key) ?? "");
        const normalized = String(value || "").trim();
        return normalized || PORTFOLIO_COLUMN_FILTER_EMPTY;
    }

    function portfolioColumnFilterLabel(value) {
        return value === PORTFOLIO_COLUMN_FILTER_EMPTY ? "(Vazio)" : value;
    }

    function portfolioColumnFilterOptions(key) {
        const counts = new Map();
        filteredProjects()
            .filter((project) => projectMatchesPortfolioColumnFilters(project, key))
            .forEach((project) => {
                const value = portfolioColumnFilterValue(project, key);
                counts.set(value, (counts.get(value) || 0) + 1);
            });
        return Array.from(counts.entries())
            .map(([value, count]) => ({ value, label: portfolioColumnFilterLabel(value), count }))
            .sort((a, b) => a.label.localeCompare(b.label, "pt-BR", { numeric: true, sensitivity: "base" }));
    }

    function projectMatchesPortfolioColumnFilters(project, exceptKey = "") {
        return Object.entries(state.listColumnFilters).every(([key, selected]) => {
            if (key === exceptKey || !Array.isArray(selected)) return true;
            return selected.includes(portfolioColumnFilterValue(project, key));
        });
    }

    function hasPortfolioColumnFilter(key) {
        return Array.isArray(state.listColumnFilters[key]);
    }

    function closePortfolioColumnFilter() {
        if (!portfolioColumnFilterPopover) return;
        portfolioColumnFilterPopover.hidden = true;
        portfolioColumnFilterPopover.dataset.columnFilterKey = "";
    }

    function ensurePortfolioColumnFilterPopover() {
        if (portfolioColumnFilterPopover) return portfolioColumnFilterPopover;
        const popover = document.createElement("div");
        popover.className = "projetos-column-filter-popover";
        popover.hidden = true;
        popover.setAttribute("role", "dialog");
        popover.setAttribute("aria-label", "Filtro da coluna");
        document.body.appendChild(popover);
        portfolioColumnFilterPopover = popover;
        return popover;
    }

    function positionPortfolioColumnFilter(anchor) {
        const popover = portfolioColumnFilterPopover;
        if (!popover || !anchor || popover.hidden) return;
        const rect = anchor.getBoundingClientRect();
        const gutter = 8;
        const width = popover.offsetWidth || 300;
        const height = popover.offsetHeight || 360;
        let left = Math.min(rect.left, window.innerWidth - width - gutter);
        left = Math.max(gutter, left);
        let top = rect.bottom + 6;
        if (top + height > window.innerHeight - gutter) top = Math.max(gutter, rect.top - height - 6);
        popover.style.left = `${Math.round(left)}px`;
        popover.style.top = `${Math.round(top)}px`;
    }

    function applyPortfolioColumnFilterLive(key, values) {
        const normalized = Array.from(new Set((values || []).map((value) => String(value))));
        if (normalized.length) state.listColumnFilters[key] = normalized;
        else delete state.listColumnFilters[key];
        renderList(filteredProjects());
    }

    function openPortfolioColumnFilter(key, anchor) {
        const popover = ensurePortfolioColumnFilterPopover();
        const options = portfolioColumnFilterOptions(key);
        const active = state.listColumnFilters[key];
        // Sem filtro ativo, a abertura começa limpa: nenhuma opção pré-selecionada.
        // Se o usuário estiver reabrindo um filtro existente, preservamos apenas
        // as escolhas que ele já fez para que a edição continue previsível.
        const selected = new Set(Array.isArray(active) ? active : []);
        const label = portfolioColumnLabel(key);

        popover.dataset.columnFilterKey = key;
        popover.innerHTML = `
            <div class="projetos-column-filter-popover__header">
                <div><small>Filtrar coluna</small><strong>${escapeHtml(label)}</strong></div>
                <button type="button" class="projetos-column-filter-popover__close" data-column-filter-close aria-label="Fechar filtro"><i class="fa fa-times"></i></button>
            </div>
            <div class="projetos-column-filter-popover__search">
                <i class="fa fa-search"></i>
                <input type="search" class="ws-form-control" data-column-filter-search placeholder="Digite para filtrar automaticamente..." autocomplete="off">
            </div>
            <div class="projetos-column-filter-popover__quick">
                <span>Selecione valores ou apenas digite.</span>
                <button type="button" data-column-filter-remove>Limpar filtro</button>
            </div>
            <div class="projetos-column-filter-popover__options" data-column-filter-options>
                ${options.length ? options.map((item) => `
                    <label class="projetos-column-filter-option" data-column-filter-option data-filter-value="${escapeHtml(item.value)}" data-search-value="${escapeHtml(item.label.toLocaleLowerCase("pt-BR"))}">
                        <input type="checkbox" value="${escapeHtml(item.value)}" ${selected.has(item.value) ? "checked" : ""}>
                        <span title="${escapeHtml(item.label)}">${escapeHtml(item.label)}</span>
                        <small>${item.count}</small>
                    </label>`).join("") : `<div class="projetos-column-filter-popover__empty">Sem valores disponíveis.</div>`}
            </div>`;
        popover.hidden = false;
        positionPortfolioColumnFilter(anchor);

        const search = popover.querySelector("[data-column-filter-search]");
        const optionRows = () => Array.from(popover.querySelectorAll("[data-column-filter-option]"));
        const checkedValues = () => optionRows()
            .map((row) => row.querySelector('input[type="checkbox"]'))
            .filter((input) => input?.checked)
            .map((input) => input.value);

        search?.addEventListener("input", () => {
            const query = search.value.trim().toLocaleLowerCase("pt-BR");
            const rows = optionRows();
            rows.forEach((row) => {
                row.hidden = Boolean(query) && !String(row.dataset.searchValue || "").includes(query);
            });

            if (query) {
                // Busca é o próprio filtro: não exige checkbox nem botão Aplicar.
                // Desmarcamos as escolhas manuais para deixar claro qual modo está ativo.
                rows.forEach((row) => {
                    const input = row.querySelector('input[type="checkbox"]');
                    if (input) input.checked = false;
                });
                const matches = rows
                    .filter((row) => !row.hidden)
                    .map((row) => row.dataset.filterValue || "");
                state.listColumnFilters[key] = Array.from(new Set(matches));
                renderList(filteredProjects());
            } else {
                const checked = checkedValues();
                applyPortfolioColumnFilterLive(key, checked);
            }
        });

        optionRows().forEach((row) => {
            const input = row.querySelector('input[type="checkbox"]');
            input?.addEventListener("change", () => {
                // Ao selecionar manualmente, saímos do modo busca e aplicamos na hora.
                if (search) search.value = "";
                optionRows().forEach((item) => { item.hidden = false; });
                applyPortfolioColumnFilterLive(key, checkedValues());
            });
        });

        popover.querySelector("[data-column-filter-close]")?.addEventListener("click", closePortfolioColumnFilter);
        popover.querySelector("[data-column-filter-remove]")?.addEventListener("click", () => {
            delete state.listColumnFilters[key];
            optionRows().forEach((row) => {
                row.hidden = false;
                const input = row.querySelector('input[type="checkbox"]');
                if (input) input.checked = false;
            });
            if (search) search.value = "";
            renderList(filteredProjects());
            search?.focus({ preventScroll: true });
        });
        window.requestAnimationFrame(() => search?.focus({ preventScroll: true }));
    }

    function projectTableKey(value) {
        return String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "");
    }

    function projectHomologationValue(project) {
        return project?.data_homologacao_prevista || project?.data_homologacao_cronograma || "";
    }

    function projectGoLiveValue(project) {
        if (project?.tem_cslog) return project?.data_go_live_vigente || "";
        return project?.data_go_live_vigente || project?.data_go_live_prevista || project?.data_go_live_cronograma || "";
    }

    function projectManagementTaskTarget(project, kind) {
        const rows = [];
        flattenProjectStages(project?.etapas || []).forEach((stage, stageIndex) => {
            (stage.tarefas || []).forEach((task, taskIndex) => {
                rows.push({ stage, task, stageIndex, taskIndex });
            });
        });
        (project?.tarefas_sem_etapa || []).forEach((task, taskIndex) => {
            rows.push({ stage: null, task, stageIndex: Number.MAX_SAFE_INTEGER, taskIndex });
        });
        if (!rows.length) return null;

        let targetDate = "";
        let preferredMoment = "";
        let dateEdge = "start";
        if (kind === "homologacao") {
            targetDate = projectHomologationValue(project);
            preferredMoment = "homologacao";
        } else if (kind === "golive") {
            targetDate = projectGoLiveValue(project);
            preferredMoment = "encerramento";
        } else if (kind === "conclusao") {
            targetDate = project?.data_fim_prevista || "";
            dateEdge = "end";
        }

        let candidates = preferredMoment
            ? rows.filter((item) => String(item.stage?.momento || "") === preferredMoment)
            : rows;
        if (!candidates.length) candidates = rows;

        const dayNumber = (value) => {
            if (!value) return null;
            const parsed = Date.parse(`${String(value).slice(0, 10)}T00:00:00`);
            return Number.isNaN(parsed) ? null : parsed;
        };
        const targetDay = dayNumber(targetDate);

        if (targetDay === null) {
            if (dateEdge === "end") {
                return [...candidates].sort((a, b) => {
                    const aEnd = dayNumber(a.task.data_fim_prevista) ?? -Infinity;
                    const bEnd = dayNumber(b.task.data_fim_prevista) ?? -Infinity;
                    return bEnd - aEnd || b.stageIndex - a.stageIndex || b.taskIndex - a.taskIndex;
                })[0] || null;
            }
            return candidates[0] || null;
        }

        const scored = candidates.map((item) => {
            const start = dayNumber(item.task.data_inicio);
            const end = dayNumber(item.task.data_fim_prevista);
            const inside = start !== null && end !== null && targetDay >= start && targetDay <= end;
            const edge = dateEdge === "end" ? end : start;
            const fallbackEdge = edge ?? (dateEdge === "end" ? start : end);
            const distance = fallbackEdge === null ? Number.MAX_SAFE_INTEGER : Math.abs(fallbackEdge - targetDay);
            return { ...item, score: (inside ? -1 : 0) * 10 ** 15 + distance };
        });
        scored.sort((a, b) => a.score - b.score || a.stageIndex - b.stageIndex || a.taskIndex - b.taskIndex);
        return scored[0] || null;
    }

    function managementTargetAttrs(kind, target) {
        if (!target?.task?.id) return "";
        const label = target.task.nome || "tarefa relacionada";
        return `class="projetos-management-target" data-management-target="${kind}" data-target-task-id="${Number(target.task.id)}" data-target-stage-id="${Number(target.stage?.id || 0)}" role="button" tabindex="0" title="Ir para: ${escapeHtml(label)}"`;
    }

    function projectTableSummary(project) {
        return [
            `Projeto: ${project?.nome || "—"}`,
            `Código: ${project?.codigo || "—"}`,
            `Cliente: ${projectClientName(project) || "—"}`,
            `Owner: ${project?.owner?.nome || "—"}`,
            `Status: ${project?.status_nome || "—"}`,
            `Momento: ${project?.momento_atual_nome || "—"}`,
            `Marcos: ${Number(project?.marcos_concluidos || 0)}/${Number(project?.marcos_total || 0)}`,
            `Saúde: ${project?.situacao_nome || project?.saude_nome || "—"}`,
            `Homologação: ${formatDate(projectHomologationValue(project))}`,
            `Go Live: ${formatDate(projectGoLiveValue(project))}`,
            `Progresso: ${Number(project?.progresso || 0).toFixed(0)}%`,
        ].join(" • ");
    }

    function projectTableTooltipHtml(project) {
        const progress = Math.max(0, Math.min(100, Number(project?.progresso || 0)));
        return `<div class="projetos-table-tooltip__top"><strong>${escapeHtml(project?.nome || "Projeto")}</strong><span>${escapeHtml(project?.codigo || "")}</span></div>
            <div class="projetos-table-tooltip__badges"><span>${escapeHtml(project?.status_nome || "Sem status")}</span><span>${escapeHtml(project?.momento_atual_nome || "Momento não informado")}</span><span>${escapeHtml(project?.situacao_nome || project?.saude_nome || "Saúde não informada")}</span></div>
            <div class="projetos-table-tooltip__grid"><span><small>Fase / Sprint atual</small><b>${escapeHtml(project?.sprint_atual?.nome || project?.fase_atual?.nome || project?.etapa_atual?.nome || "—")}</b></span><span><small>Marcos</small><b>${Number(project?.marcos_concluidos || 0)}/${Number(project?.marcos_total || 0)}</b></span><span><small>Homologação</small><b>${escapeHtml(formatDate(projectHomologationValue(project)) || "—")}</b></span><span><small>Go Live</small><b>${escapeHtml(formatDate(projectGoLiveValue(project)) || "—")}</b></span><span><small>Conclusão prevista</small><b>${escapeHtml(formatDate(project?.data_fim_prevista) || "—")}</b></span></div>
            <div class="projetos-table-tooltip__progress"><span><b>Progresso</b><small>${progress.toFixed(0)}%</small></span><i><em style="width:${progress}%"></em></i></div>`;
    }

    function bindPortfolioTableTooltip() {
        if (!el.tableWrap || el.tableWrap.dataset.tooltipBound === "1") return;
        el.tableWrap.dataset.tooltipBound = "1";
        const tooltip = document.createElement("div");
        tooltip.className = "projetos-table-tooltip";
        tooltip.setAttribute("role", "tooltip");
        document.body.appendChild(tooltip);
        const position = (event) => {
            const margin = 14;
            const width = tooltip.offsetWidth;
            const height = tooltip.offsetHeight;
            tooltip.style.left = `${Math.max(8, Math.min(window.innerWidth - width - 8, event.clientX + margin))}px`;
            tooltip.style.top = `${Math.max(8, Math.min(window.innerHeight - height - 8, event.clientY + margin))}px`;
        };
        el.tableWrap.addEventListener("mouseover", (event) => {
            const row = event.target.closest?.("tr[data-project-id]");
            if (!row) return;
            const project = state.projetos.find((item) => Number(item.id) === Number(row.dataset.projectId));
            if (!project) return;
            tooltip.innerHTML = projectTableTooltipHtml(project);
            tooltip.classList.add("is-visible");
            position(event);
        });
        el.tableWrap.addEventListener("mousemove", (event) => {
            if (tooltip.classList.contains("is-visible")) position(event);
        });
        el.tableWrap.addEventListener("mouseout", (event) => {
            if (!event.relatedTarget || !el.tableWrap.contains(event.relatedTarget)) tooltip.classList.remove("is-visible");
            else if (!event.relatedTarget.closest?.("tr[data-project-id]")) tooltip.classList.remove("is-visible");
        });
    }

    function expandPortfolioColumns(columns) {
        // Todas as colunas visíveis são agora de primeira classe no portfólio.
        // Período, Homologação e Go Live podem ser ordenados, ocultados e movidos
        // de forma independente pelo usuário.
        return [...columns];
    }

    function portfolioColumnLabel(key) {
        if (key === "__code") return "Código";
        if (key === "__homologation") return "Homologação";
        if (key === "__golive") return "Go Live";
        return listColumns[key]?.label || "";
    }

    function loadPortfolioColumnWidths() {
        try {
            // v6 começa limpo: larguras antigas muito grandes não devem contaminar
            // o novo ajuste automático ao conteúdo. A partir daqui, apenas uma
            // alteração manual do usuário fica persistida.
            const raw = localStorage.getItem(`workspace.projetos.columnWidths.v6.${userId || "local"}`)
                || localStorage.getItem("workspace.projetos.columnWidths.v6")
                || "{}";
            return JSON.parse(raw) || {};
        } catch (error) {
            return {};
        }
    }

    function portfolioPreferenceKey(name, version) {
        return `workspace.projetos.${name}.${version}.${userId || "local"}`;
    }

    function loadPortfolioColumnOrder() {
        try {
            const currentKey = portfolioPreferenceKey("columnOrder", "v5");
            const raw = localStorage.getItem(currentKey)
                || localStorage.getItem(`workspace.projetos.columnOrder.v4.${userId || "local"}`)
                || localStorage.getItem(`workspace.projetos.columnOrder.v3.${userId || "local"}`)
                || localStorage.getItem("workspace.projetos.columnOrder.v4")
                || "[]";
            const saved = JSON.parse(raw);
            const valid = Array.isArray(saved)
                ? saved.filter((key) => Object.prototype.hasOwnProperty.call(listColumns, key))
                : [];
            if (!valid.length) return [...state.listColumnOrder];

            const normalized = [...valid];
            state.listColumnOrder.forEach((key, defaultIndex) => {
                if (normalized.includes(key)) return;
                let insertAt = normalized.length;
                for (let previous = defaultIndex - 1; previous >= 0; previous -= 1) {
                    const previousKey = state.listColumnOrder[previous];
                    const previousIndex = normalized.indexOf(previousKey);
                    if (previousIndex >= 0) {
                        insertAt = previousIndex + 1;
                        break;
                    }
                }
                normalized.splice(insertAt, 0, key);
            });

            // Migra preferências antigas para uma chave estável por usuário.
            localStorage.setItem(currentKey, JSON.stringify(normalized));
            return normalized;
        } catch (error) {
            return [...state.listColumnOrder];
        }
    }

    function savePortfolioColumnOrder() {
        try {
            localStorage.setItem(
                portfolioPreferenceKey("columnOrder", "v5"),
                JSON.stringify(state.listColumnOrder),
            );
        } catch (error) {
            // Persistência local não deve impedir o uso da tabela.
        }
    }

    function movePortfolioColumn(fromKey, toKey) {
        if (!fromKey || !toKey || fromKey === toKey) return false;
        const order = [...state.listColumnOrder];
        const from = order.indexOf(fromKey);
        const to = order.indexOf(toKey);
        if (from < 0 || to < 0) return false;
        order.splice(to, 0, order.splice(from, 1)[0]);
        state.listColumnOrder = order;
        savePortfolioColumnOrder();
        return true;
    }

    function savePortfolioColumnWidths(widths) {
        try {
            const value = JSON.stringify(widths || {});
            localStorage.setItem(`workspace.projetos.columnWidths.v6.${userId || "local"}`, value);
            localStorage.setItem("workspace.projetos.columnWidths.v6", value);
        } catch (error) {
            // Persistência é opcional.
        }
    }

    function loadPortfolioDisplayPreferences() {
        try {
            const currentKey = portfolioPreferenceKey("display", "v3");
            const raw = localStorage.getItem(currentKey)
                || localStorage.getItem(`workspace.projetos.display.v2.${userId || "local"}`)
                || localStorage.getItem(`workspace.projetos.display.v1.${userId || "local"}`)
                || localStorage.getItem("workspace.projetos.display.v2")
                || "{}";
            const data = JSON.parse(raw);
            const validHidden = Array.isArray(data.hiddenColumns)
                ? data.hiddenColumns.filter((key) => Object.prototype.hasOwnProperty.call(listColumns, key))
                : [];
            state.listHiddenColumns = [...new Set(validHidden)];
            if (Object.prototype.hasOwnProperty.call(listColumns, data.sortKey)) {
                state.listSortKey = data.sortKey;
            }
            if (["asc", "desc"].includes(data.sortDirection)) {
                state.listSortDirection = data.sortDirection;
            }

            // Migra a preferência para a chave atual por usuário. Depois disso,
            // uma coluna só volta a aparecer quando o próprio usuário a marcar.
            localStorage.setItem(currentKey, JSON.stringify({
                hiddenColumns: state.listHiddenColumns,
                sortKey: state.listSortKey,
                sortDirection: state.listSortDirection,
            }));
        } catch (error) {
            state.listHiddenColumns = [];
        }
    }

    function savePortfolioDisplayPreferences() {
        try {
            localStorage.setItem(
                portfolioPreferenceKey("display", "v3"),
                JSON.stringify({
                    hiddenColumns: state.listHiddenColumns,
                    sortKey: state.listSortKey,
                    sortDirection: state.listSortDirection,
                }),
            );
        } catch (error) {
            // Persistência local não deve impedir o uso da tabela.
        }
    }

    function portfolioColumnMinimumWidth(key) {
        if (key === "project") return 120;
        if (["opening", "__homologation", "__golive"].includes(key)) return 86;
        if (key === "period") return 142;
        if (["progress", "priority", "health", "status"].includes(key)) return 76;
        return 58;
    }

    function portfolioColumnMaximumWidth(key) {
        // Sem teto artificial: por padrão cada coluna acompanha o maior dado
        // efetivamente exibido nela. Se o usuário quiser outra largura, o
        // redimensionamento manual continua prevalecendo e fica salvo.
        return Number.POSITIVE_INFINITY;
    }

    function applyPortfolioColumnWidth(key, width) {
        const minimum = portfolioColumnMinimumWidth(key);
        const maximum = portfolioColumnMaximumWidth(key);
        const safeWidth = Math.min(maximum, Math.max(minimum, Math.round(Number(width) || 0)));
        if (!key || !safeWidth) return;

        const selector = key.startsWith("__")
            ? `[data-extra-column="${key}"], [data-column="${key}"]`
            : `[data-list-column="${key}"], [data-column="${key}"]`;

        document.querySelectorAll(`#projetosTableWrap ${selector}`).forEach((cell) => {
            cell.style.width = `${safeWidth}px`;
            cell.style.minWidth = `${safeWidth}px`;
            cell.style.maxWidth = `${safeWidth}px`;
        });
    }

    function portfolioColumnDisplayValues(key) {
        if (key === "__code") return state.renderedListProjects.map((item) => item.codigo || "");
        if (key === "__homologation") return state.renderedListProjects.map((item) => formatTableDate(projectHomologationValue(item)));
        if (key === "__golive") return state.renderedListProjects.map((item) => formatTableDate(projectGoLiveValue(item)));
        if (key === "period") {
            return state.renderedListProjects.map((item) => (
                item.data_inicio || item.data_fim_prevista
                    ? `${formatTableDate(item.data_inicio)}${item.data_inicio && item.data_fim_prevista ? " → " : ""}${formatTableDate(item.data_fim_prevista)}`
                    : ""
            ));
        }
        if (key === "progress") return state.renderedListProjects.map((item) => `${Number(item.progresso || 0).toFixed(0)}%`);
        if (key === "priority") return state.renderedListProjects.map((item) => item.prioridade_nome || "");
        return state.renderedListProjects.map((item) => String(listColumnValue(item, key) || ""));
    }

    function portfolioInitialColumnWidth(key) {
        const values = portfolioColumnDisplayValues(key);
        const longest = [portfolioColumnLabel(key), ...values].reduce(
            (max, value) => Math.max(max, String(value || "").length),
            0,
        );
        const minimum = portfolioColumnMinimumWidth(key);
        const maximum = portfolioColumnMaximumWidth(key);
        // 6.6px aproxima a fonte de 11.5px da tabela; 30px cobre padding,
        // indicador de ordenação e resizer sem criar folga visual excessiva.
        return Math.min(maximum, Math.max(minimum, (longest * 6.6) + 30));
    }

    function portfolioMeasuredColumnWidth(key) {
        const selector = key.startsWith("__")
            ? `[data-extra-column="${key}"], [data-column="${key}"]`
            : `[data-list-column="${key}"], [data-column="${key}"]`;
        const cells = Array.from(el.tableWrap?.querySelectorAll(selector) || []);
        const minimum = portfolioColumnMinimumWidth(key);
        const maximum = portfolioColumnMaximumWidth(key);
        const measured = cells.reduce((max, cell) => Math.max(max, cell.scrollWidth + 2), minimum);
        return Math.min(maximum, Math.max(minimum, measured));
    }

    function bindPortfolioColumnResize() {
        const widths = loadPortfolioColumnWidths();
        const renderedKeys = [];

        el.tableHead?.querySelectorAll("th").forEach((header) => {
            if (header.querySelector(":scope > .projetos-column-resizer")) return;

            const key = header.dataset.listColumn || header.dataset.extraColumn;
            if (!key) return;
            renderedKeys.push(key);

            // Se o usuário já redimensionou, respeitamos exatamente a preferência.
            // Caso contrário, a coluna nasce no tamanho do maior conteúdo visível.
            const width = Number(widths[key]) || portfolioInitialColumnWidth(key);
            applyPortfolioColumnWidth(key, width);

            const handle = document.createElement("span");
            handle.className = "projetos-column-resizer";
            handle.setAttribute("aria-hidden", "true");
            handle.title = "Arraste para redimensionar ou dê duplo clique para ajustar ao conteúdo";
            handle.draggable = false;

            handle.addEventListener("dragstart", (event) => {
                event.preventDefault();
                event.stopPropagation();
            });

            handle.addEventListener("dblclick", (event) => {
                event.preventDefault();
                event.stopPropagation();
                // Duplo clique volta a coluna para o ajuste automático atual.
                delete widths[key];
                const fittedWidth = Math.max(portfolioInitialColumnWidth(key), portfolioMeasuredColumnWidth(key));
                applyPortfolioColumnWidth(key, fittedWidth);
                savePortfolioColumnWidths(widths);
                toast(`Coluna ${portfolioColumnLabel(key)} ajustada ao conteúdo.`);
            });

            handle.addEventListener("mousedown", (event) => {
                event.preventDefault();
                event.stopPropagation();

                const startX = event.clientX;
                const startWidth = header.getBoundingClientRect().width;

                const onMove = (moveEvent) => {
                    const nextWidth = Math.max(portfolioColumnMinimumWidth(key), startWidth + (moveEvent.clientX - startX));
                    widths[key] = Math.round(nextWidth);
                    applyPortfolioColumnWidth(key, nextWidth);
                };

                const onUp = () => {
                    document.removeEventListener("mousemove", onMove);
                    document.removeEventListener("mouseup", onUp);
                    document.body.classList.remove("is-resizing-projetos-columns");
                    savePortfolioColumnWidths(widths);
                };

                document.body.classList.add("is-resizing-projetos-columns");
                document.addEventListener("mousemove", onMove);
                document.addEventListener("mouseup", onUp);
            });

            header.appendChild(handle);
        });

        window.requestAnimationFrame(() => {
            renderedKeys.forEach((key) => {
                // Largura manual nunca é alterada automaticamente.
                if (Number(widths[key])) return;
                const fittedWidth = Math.max(portfolioInitialColumnWidth(key), portfolioMeasuredColumnWidth(key));
                applyPortfolioColumnWidth(key, fittedWidth);
            });
        });
    }

    function listColumnHtml(project, key) {
        const responsible = projectResponsiblePeople(project);
        const statusKey = projectTableKey(project.status_nome || project.status || "");
        const healthKey = projectTableKey(project.situacao_nome || project.saude_nome || project.situacao || "");

        const html = {
            project: `<td class="projetos-project-cell" data-column="project"><strong>${escapeHtml(integrationValue(project, "nome", "Nome projeto", "nome_projeto", "title") || "")}</strong><small>${escapeHtml(project.codigo || "")}</small></td>`,
            __code: `<td class="projetos-code-cell" data-column="__code"><span title="${escapeHtml(project.codigo || "")}">${escapeHtml(project.codigo || "")}</span></td>`,
            type: `<td data-column="type"><span class="projetos-type-cell" title="${escapeHtml(project.tipo_projeto || project.cronograma_modelo?.nome || "Sem modelo")}">${escapeHtml(project.tipo_projeto || project.cronograma_modelo?.nome || "Sem modelo")}</span></td>`,
            methodology: `<td data-column="methodology"><span class="projetos-methodology-cell" data-methodology-key="${escapeHtml(projectTableKey(project.metodologia || projectMethodologyName(project)))}" title="${escapeHtml(projectMethodologyName(project))}">${escapeHtml(projectMethodologyName(project))}</span></td>`,
            reference: `<td data-column="reference"><span class="projetos-reference-cell" title="${escapeHtml(listColumnValue(project, "reference"))}">${escapeHtml(listColumnValue(project, "reference"))}</span></td>`,
            cslog: `<td data-column="cslog"><span class="projetos-reference-cell" title="${escapeHtml(listColumnValue(project, "cslog"))}">${escapeHtml(listColumnValue(project, "cslog"))}</span></td>`,
            category: `<td data-column="category"><span class="projetos-pill projetos-pill--category" data-category-key="${escapeHtml(projectTableKey(projectCategoryName(project)))}" title="${escapeHtml(projectCategoryName(project))}">${escapeHtml(projectCategoryName(project))}</span></td>`,
            service: `<td data-column="service"><span class="projetos-table-cell-text" title="${escapeHtml(projectServiceName(project))}">${escapeHtml(projectServiceName(project))}</span></td>`,
            client: `<td data-column="client"><span class="projetos-table-cell-text" title="${escapeHtml(projectClientName(project))}">${escapeHtml(projectClientName(project))}</span></td>`,
            company: `<td data-column="company"><span class="projetos-table-cell-text" title="${escapeHtml(projectCompanyName(project))}">${escapeHtml(projectCompanyName(project))}</span></td>`,
            owner: `<td data-column="owner">${personChipHtml(project.owner, "Sem Owner")}</td>`,
            stakeholder: `<td data-column="stakeholder">${personChipHtml(project.stakeholder, "Sem Stakeholder")}</td>`,
            responsible: `<td data-column="responsible">${responsiblePeopleHtml(responsible)}</td>`,
            group: `<td data-column="group"><span class="projetos-group-cell" title="${escapeHtml(project.grupo_nomes || "")}">${escapeHtml(project.grupo_nomes || "")}</span></td>`,
            opening: `<td data-column="opening"><span class="projetos-period-cell">${formatTableDate(project.data_abertura)}</span></td>`,
            period: `<td data-column="period"><span class="projetos-period-cell">${project.data_inicio || project.data_fim_prevista ? `${formatTableDate(project.data_inicio)}${project.data_inicio && project.data_fim_prevista ? " → " : ""}${formatTableDate(project.data_fim_prevista)}` : ""}</span></td>`,
            __homologation: `<td class="projetos-homologation-cell" data-column="__homologation"><span>${formatTableDate(projectHomologationValue(project))}</span></td>`,
            __golive: `<td class="projetos-golive-cell" data-column="__golive"><span>${formatTableDate(projectGoLiveValue(project))}</span></td>`,
            status: `<td data-column="status"><span class="projetos-pill projetos-pill--status" data-status-key="${escapeHtml(statusKey)}">${escapeHtml(project.status_nome || "")}</span></td>`,
            moment: `<td data-column="moment"><span class="projetos-pill projetos-pill--moment" data-moment-key="${escapeHtml(projectTableKey(project.momento_atual || ""))}">${escapeHtml(project.momento_atual_nome || "")}</span></td>`,
            milestones: `<td data-column="milestones"><span class="projetos-milestones-cell"><b>${Number(project.marcos_concluidos || 0)}/${Number(project.marcos_total || 0)}</b><small>${escapeHtml(project.marco_atual?.nome || project.etapa_atual?.nome || "")}</small></span></td>`,
            health: `<td data-column="health"><span class="projetos-pill projetos-pill--health" data-health-key="${escapeHtml(healthKey)}" data-situacao="${escapeHtml(project.situacao || "")}">${escapeHtml(project.situacao_nome || project.saude_nome || "")}</span></td>`,
            progress: `<td data-column="progress">${progressHtml(project.progresso)}</td>`,
            priority: `<td data-column="priority"><span class="projetos-priority" data-prioridade="${escapeHtml(project.prioridade)}">${escapeHtml(project.prioridade_nome)}</span></td>`,
        };
        return html[key] || "";
    }

    function renderListColumnMenu() {
        if (!el.columnsMenu) return;
        const previousScrollTop = el.columnsMenu.scrollTop;
        const wasOpen = !el.columnsMenu.hidden;

        el.columnsMenu.innerHTML = state.listColumnOrder.map((key) => `
            <div class="projetos-columns-menu__item" draggable="true" data-column-menu-item="${key}">
                <button type="button" class="projetos-columns-menu__drag" tabindex="-1" aria-label="Arraste para mover ${escapeHtml(listColumns[key].label)}" title="Arraste para reorganizar"><i class="fa fa-bars"></i></button>
                <label><input type="checkbox" data-column-visible="${key}" ${state.listHiddenColumns.includes(key) ? "" : "checked"}> <span>${escapeHtml(listColumns[key].label)}</span></label>
            </div>`).join("");

        if (wasOpen) {
            el.columnsMenu.hidden = false;
            el.columnsMenu.scrollTop = previousScrollTop;
        }

        el.columnsMenu.querySelectorAll("[data-column-visible]").forEach((checkbox) => {
            checkbox.addEventListener("click", (event) => event.stopPropagation());
            checkbox.addEventListener("change", () => {
                const key = checkbox.dataset.columnVisible;
                if (checkbox.checked) {
                    state.listHiddenColumns = state.listHiddenColumns.filter((item) => item !== key);
                } else if (state.listColumnOrder.length - state.listHiddenColumns.length > 1) {
                    state.listHiddenColumns = [...new Set([...state.listHiddenColumns, key])];
                } else {
                    checkbox.checked = true;
                    return;
                }
                savePortfolioDisplayPreferences();
                renderList(filteredProjects());
            });
        });

        el.columnsMenu.querySelectorAll("[data-column-menu-item]").forEach((item) => {
            item.addEventListener("dragstart", (event) => {
                if (event.target.closest?.("input, label")) {
                    event.preventDefault();
                    return;
                }
                const key = item.dataset.columnMenuItem;
                event.dataTransfer.setData("text/plain", key);
                event.dataTransfer.effectAllowed = "move";
                item.classList.add("is-dragging");
            });
            item.addEventListener("dragover", (event) => {
                event.preventDefault();
                event.stopPropagation();
                const rect = item.getBoundingClientRect();
                const after = event.clientY > rect.top + (rect.height / 2);
                item.classList.toggle("is-drag-over-before", !after);
                item.classList.toggle("is-drag-over-after", after);
                event.dataTransfer.dropEffect = "move";
            });
            item.addEventListener("dragleave", () => {
                item.classList.remove("is-drag-over-before", "is-drag-over-after");
            });
            item.addEventListener("dragend", () => {
                el.columnsMenu?.querySelectorAll(".is-dragging, .is-drag-over-before, .is-drag-over-after").forEach((row) => {
                    row.classList.remove("is-dragging", "is-drag-over-before", "is-drag-over-after");
                });
            });
            item.addEventListener("drop", (event) => {
                event.preventDefault();
                event.stopPropagation();
                const fromKey = event.dataTransfer.getData("text/plain");
                const toKey = item.dataset.columnMenuItem;
                if (!fromKey || !toKey || fromKey === toKey) return;

                const rect = item.getBoundingClientRect();
                const insertAfter = event.clientY > rect.top + (rect.height / 2);
                const order = state.listColumnOrder.filter((key) => key !== fromKey);
                let targetIndex = order.indexOf(toKey);
                if (targetIndex < 0) return;
                if (insertAfter) targetIndex += 1;
                order.splice(targetIndex, 0, fromKey);
                state.listColumnOrder = order;
                savePortfolioColumnOrder();
                renderList(filteredProjects());
            });
        });
    }

    function renderList(projects) {
        const direction = state.listSortDirection === "desc" ? -1 : 1;
        const columnFilteredProjects = projects.filter((project) => projectMatchesPortfolioColumnFilters(project));
        const sorted = [...columnFilteredProjects].sort((a, b) => {
            const left = listColumnValue(a, state.listSortKey);
            const right = listColumnValue(b, state.listSortKey);
            let comparison;
            if (state.listSortKey === "health") {
                const weights = { critico: 5, critica: 5, atrasado: 4, em_risco: 3, risco: 3, atencao: 2, normal: 1, no_prazo: 1 };
                comparison = ((weights[projectTableKey(a.situacao || a.situacao_nome || a.saude_nome)] || 0)
                    - (weights[projectTableKey(b.situacao || b.situacao_nome || b.saude_nome)] || 0)) * direction;
            } else if (typeof left === "number" && typeof right === "number") {
                comparison = (left - right) * direction;
            } else {
                comparison = String(left || "").localeCompare(String(right || ""), "pt-BR", { numeric: true, sensitivity: "base" }) * direction;
            }
            if (comparison !== 0) return comparison;
            const dueComparison = String(a.data_fim_prevista || "9999-12-31").localeCompare(String(b.data_fim_prevista || "9999-12-31"));
            if (dueComparison !== 0) return dueComparison;
            return Number(a.progresso || 0) - Number(b.progresso || 0);
        });

        state.renderedListProjects = sorted;
        if (state.view === "lista") {
            if (el.countBadge) el.countBadge.textContent = `${sorted.length} ${sorted.length === 1 ? "projeto" : "projetos"}`;
            if (el.empty) el.empty.hidden = sorted.length > 0;
        }

        const visibleColumns = state.listColumnOrder.filter((key) => !state.listHiddenColumns.includes(key));
        const renderedColumns = expandPortfolioColumns(visibleColumns);

        if (el.tableHead) {
            el.tableHead.innerHTML = `<th class="projetos-select-column"><input type="checkbox" data-select-all-projects aria-label="Selecionar todos os projetos visíveis"></th>` + renderedColumns.map((key) => {
                const active = state.listSortKey === key;
                const icon = active ? (state.listSortDirection === "asc" ? "fa-sort-asc" : "fa-sort-desc") : "fa-sort";
                const filtered = hasPortfolioColumnFilter(key);
                const label = portfolioColumnLabel(key);
                const extraAttr = key.startsWith("__") ? ` data-extra-column="${key}"` : "";

                return `<th draggable="true" data-list-column="${key}"${extraAttr}><div class="projetos-table-head-control"><button type="button" data-list-sort="${key}"><span>${escapeHtml(label)}</span> <i class="fa ${icon}"></i></button><button type="button" class="projetos-table-filter-button${filtered ? " is-active" : ""}" data-column-filter="${key}" aria-label="Filtrar ${escapeHtml(label)}" title="Filtrar coluna"><i class="fa fa-filter"></i></button></div></th>`;
            }).join("");
        }

        el.tableBody.innerHTML = sorted.map((project) => (
            `<tr class="${Number(state.portfolioSelectedProjectId) === Number(project.id) ? "is-project-selected" : ""}" data-project-id="${project.id}" data-row-summary><td class="projetos-select-column"><input type="checkbox" data-select-project="${project.id}" ${state.selectedProjectIds.has(Number(project.id)) ? "checked" : ""} aria-label="Selecionar ${escapeHtml(project.nome || "projeto")}"></td>${renderedColumns.map((key) => listColumnHtml(project, key)).join("")}</tr>`
        )).join("");
        if (el.tableTotal) {
            el.tableTotal.innerHTML = `<strong>Total de projetos:</strong> <span>${sorted.length}</span>`;
        } else if (el.tableFoot) {
            el.tableFoot.innerHTML = `<tr><td class="projetos-table-total" colspan="${renderedColumns.length + 1}"><strong>Total de projetos:</strong> <span>${sorted.length}</span></td></tr>`;
        }

        const selectAll = el.tableHead?.querySelector("[data-select-all-projects]");
        if (selectAll) {
            selectAll.checked = Boolean(sorted.length) && sorted.every((item) => state.selectedProjectIds.has(Number(item.id)));
            selectAll.indeterminate = !selectAll.checked && sorted.some((item) => state.selectedProjectIds.has(Number(item.id)));
            selectAll.addEventListener("change", () => {
                sorted.forEach((item) => {
                    if (selectAll.checked) state.selectedProjectIds.add(Number(item.id));
                    else state.selectedProjectIds.delete(Number(item.id));
                });
                renderList(filteredProjects());
            });
        }
        el.tableBody.querySelectorAll("[data-select-project]").forEach((checkbox) => {
            checkbox.addEventListener("change", () => {
                const id = Number(checkbox.dataset.selectProject || 0);
                if (checkbox.checked) state.selectedProjectIds.add(id);
                else state.selectedProjectIds.delete(id);
                syncDeleteSelectedButton();
            });
        });
        syncDeleteSelectedButton();

        el.tableHead?.querySelectorAll("[data-list-sort]").forEach((button) => {
            button.addEventListener("click", () => {
                const key = button.dataset.listSort;

                if (state.listSortKey === key) {
                    state.listSortDirection = state.listSortDirection === "asc" ? "desc" : "asc";
                } else {
                    state.listSortKey = key;
                    state.listSortDirection = key === "progress" || key === "priority" ? "desc" : "asc";
                }

                savePortfolioDisplayPreferences();
                renderList(filteredProjects());
            });
        });

        el.tableHead?.querySelectorAll("[data-column-filter]").forEach((button) => {
            button.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
                openPortfolioColumnFilter(button.dataset.columnFilter, button);
            });
            button.addEventListener("mousedown", (event) => event.stopPropagation());
        });

        el.tableHead?.querySelectorAll("[data-list-column]").forEach((header) => {
            header.addEventListener("dragstart", (event) => {
                if (event.target.closest?.(".projetos-column-resizer, button, input, select, textarea, label")) {
                    event.preventDefault();
                    return;
                }

                event.dataTransfer.setData("text/plain", header.dataset.listColumn);
                event.dataTransfer.effectAllowed = "move";
                header.classList.add("is-dragging");
            });

            header.addEventListener("dragover", (event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                header.classList.add("is-drag-over");
            });
            header.addEventListener("dragleave", () => header.classList.remove("is-drag-over"));
            header.addEventListener("dragend", () => {
                el.tableHead?.querySelectorAll(".is-dragging, .is-drag-over").forEach((item) => {
                    item.classList.remove("is-dragging", "is-drag-over");
                });
            });

            header.addEventListener("drop", (event) => {
                event.preventDefault();

                const fromKey = event.dataTransfer.getData("text/plain");
                const toKey = header.dataset.listColumn;

                if (!fromKey || fromKey === toKey) return;

                header.classList.remove("is-drag-over");
                if (movePortfolioColumn(fromKey, toKey)) renderList(filteredProjects());
            });
        });

        bindPortfolioColumnResize();
        renderListColumnMenu();
    }

    function syncDeleteSelectedButton() {
        if (!el.deleteSelected) return;
        const total = state.selectedProjectIds.size;
        el.deleteSelected.hidden = total === 0;
        el.deleteSelected.innerHTML = `<i class="fa fa-trash"></i> Apagar selecionados (${total})`;
    }

    async function deleteSelectedProjects() {
        const ids = Array.from(state.selectedProjectIds);
        if (!ids.length) return;
        const singular = ids.length === 1;
        const confirmed = await confirmWorkspace({
            title: singular ? "Apagar projeto selecionado?" : "Apagar projetos selecionados?",
            message: singular
                ? "Este projeto será removido somente desta tela e do portfólio. O ticket, o histórico e o vínculo com o TiFlux serão preservados."
                : `${ids.length} projetos serão removidos somente desta tela e do portfólio. Os tickets, os históricos e os vínculos com o TiFlux serão preservados.`,
            confirmLabel: singular ? "Apagar projeto" : "Apagar projetos",
        });
        if (!confirmed) return;
        setLoading(true);
        try {
            for (const id of ids) {
                await request(`${api.projetos}${id}/`, { method: "DELETE" });
            }
            state.selectedProjectIds.clear();
            await loadProjects(true);
            toast(singular
                ? "Projeto apagado desta tela e removido do portfólio."
                : `${ids.length} projetos apagados desta tela e removidos do portfólio.`);
        } catch (error) {
            toast(error.message, true);
        } finally {
            setLoading(false);
            syncDeleteSelectedButton();
        }
    }

    function handlePortfolioTableClick(event) {
        const row = event.target.closest ? event.target.closest("tr[data-project-id]") : null;
        if (!row || !el.tableBody?.contains(row)) return;
        if (event.target.closest && event.target.closest("a, button, input, select, textarea, label")) return;

        const projectId = Number(row.dataset.projectId || 0);
        if (!projectId) return;
        state.portfolioSelectedProjectId = projectId;
        state.ganttProjectId = projectId;
        state.kanbanProjectId = projectId;

        const prefetched = state.projetos.find((item) => Number(item.id) === projectId) || null;
        openProject(projectId, prefetched);
    }

    async function exportProjectsExcel() {
        const projects = state.renderedListProjects || [];
        if (!projects.length) {
            toast("Não há projetos visíveis para exportar.", true);
            return;
        }
        const columns = state.listColumnOrder.filter((key) => !state.listHiddenColumns.includes(key) && !key.startsWith("__"));
        setLoading(true);
        try {
            const response = await fetch(api.exportarExcel, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": getCookie("csrftoken"),
                    "X-Requested-With": "XMLHttpRequest",
                },
                body: JSON.stringify({
                    projeto_ids: projects.map((project) => project.id),
                    colunas: columns,
                }),
            });
            if (!response.ok) throw new Error("Não foi possível exportar a tabela.");
            const blob = await response.blob();
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = "portfolio-projetos.xlsx";
            link.click();
            window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
            toast("Tabela exportada para Excel.");
        } catch (error) {
            toast(error.message, true);
        } finally {
            setLoading(false);
        }
    }

    function syncListFullscreenButton(expanded) {
        if (!el.listFullscreen) return;
        el.listFullscreen.innerHTML = expanded
            ? `<i class="fa fa-compress"></i> Sair da expansão`
            : `<i class="fa fa-expand"></i> Expandir`;
    }

    async function toggleListFullscreen() {
        const target = el.portfolioArea || el.listView;
        if (!target) return;
        try {
            if (document.fullscreenElement === target) await document.exitFullscreen();
            else if (target.requestFullscreen) await target.requestFullscreen();
            else target.classList.toggle("is-table-presentation");
        } catch (error) {
            target.classList.toggle("is-table-presentation");
        }
        syncListFullscreenButton(document.fullscreenElement === target || target.classList.contains("is-table-presentation"));
    }

    function parseIsoDate(value) {
        if (!value) return null;
        const date = new Date(`${value}T12:00:00`);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    function dayDiff(start, end) {
        const a = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
        const b = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
        return Math.round((b - a) / 86400000);
    }

    function ganttDateKey(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    function ganttProgressColor(progress) {
        const value = Number(progress || 0);
        if (value <= 0) return "#94a3b8";
        if (value < 35) return "#ef4444";
        if (value < 75) return "#f59e0b";
        if (value < 100) return "#2563eb";
        return "#16a34a";
    }

    function ganttSituation(row) {
        const progress = Number(row.progress || 0);
        if (progress >= 100 || String(row.status || "").toLowerCase().includes("conclu")) return "completed";
        if (row.overdue) return "overdue";
        if (progress <= 0) return "not-started";
        const end = parseIsoDate(row.end);
        const today = parseIsoDate(ganttDateKey(new Date()));
        if (end && today && dayDiff(today, end) >= 0 && dayDiff(today, end) <= 5) return "due-soon";
        return "on-track";
    }

    function ganttSituationLabel(situation) {
        return ({
            "not-started": "Não iniciado",
            "on-track": "Em dia",
            "due-soon": "Próximo do vencimento",
            overdue: "Em atraso",
            completed: "Concluído",
        })[situation] || "Em dia";
    }

    function ganttBusinessDays(startValue, endValue, calendarByDate) {
        const start = parseIsoDate(startValue);
        const end = parseIsoDate(endValue);
        if (!start || !end || end < start) return 0;
        let count = 0;
        const cursor = new Date(start.getTime());
        while (cursor <= end) {
            const info = calendarByDate.get(ganttDateKey(cursor));
            const useful = info ? Boolean(info.dia_util) : cursor.getDay() !== 0 && cursor.getDay() !== 6;
            if (useful) count += 1;
            cursor.setDate(cursor.getDate() + 1);
        }
        return count;
    }

    function ganttShiftDate(value, days) {
        const date = parseIsoDate(value);
        if (!date) return value;
        date.setDate(date.getDate() + days);
        return ganttDateKey(date);
    }

    function ganttEndpoint(type, id) {
        return String(api.ganttDatas || "").replace("/item/0/", `/${type}/${id}/`);
    }

    function ganttPeopleHtml(people, compact) {
        const unique = [];
        (people || []).filter(Boolean).forEach((person) => {
            if (!unique.some((item) => String(item.id) === String(person.id) && item.nome === person.nome)) unique.push(person);
        });
        if (!unique.length) return "";
        return `<span class="projetos-gantt__people ${compact ? "is-compact" : ""}">${unique.slice(0, 4).map((person) => `
            <span class="projetos-gantt__avatar ${person.externo ? "is-external" : ""}" data-gantt-tooltip="${escapeHtml(personLabel(person))}">${escapeHtml(initials(person.nome))}</span>
        `).join("")}${unique.length > 4 ? `<span class="projetos-gantt__avatar is-more" data-gantt-tooltip="${escapeHtml(unique.slice(4).map(personLabel).join("\n"))}">+${unique.length - 4}</span>` : ""}</span>`;
    }

    function ganttCalendarTooltip(day, info) {
        const dateLabel = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(day);
        if (!info) return `${dateLabel}\nSem registro na tabela CalendarioUtil`;
        const type = info.feriado ? "Feriado" : info.dia_util ? "Dia útil" : info.fim_semana ? "Fim de semana" : (info.tipo_dia || "Dia não útil");
        const useful = info.dia_util_numero && info.total_dias_uteis_mes
            ? `\n${info.dia_util_numero}º dia útil de ${info.total_dias_uteis_mes}`
            : "";
        const description = info.descricao ? `\n${info.descricao}` : "";
        return `${dateLabel}\n${type}${useful}${description}`;
    }

    function ganttRange(datedRows, scale) {
        const starts = datedRows.map((row) => parseIsoDate(row.start)).filter(Boolean);
        const ends = datedRows.map((row) => parseIsoDate(row.end)).filter(Boolean);
        const minDate = new Date(Math.min(...starts.map((date) => date.getTime())));
        const maxDate = new Date(Math.max(...ends.map((date) => date.getTime())));
        if (scale === "week") {
            const mondayOffset = (minDate.getDay() + 6) % 7;
            minDate.setDate(minDate.getDate() - mondayOffset);
            maxDate.setDate(maxDate.getDate() + (7 - ((maxDate.getDay() + 6) % 7) - 1));
        } else if (scale === "month") {
            minDate.setDate(1);
            maxDate.setMonth(maxDate.getMonth() + 1, 0);
        } else {
            minDate.setMonth(0, 1);
            maxDate.setMonth(11, 31);
        }
        return { minDate, maxDate };
    }

    function ganttAxisHtml(days, dayWidth, scale, calendarByDate) {
        const groups = [];
        days.forEach((day) => {
            const info = calendarByDate.get(ganttDateKey(day));
            let key;
            let label;
            if (scale === "week") {
                key = `${day.getFullYear()}-${info?.semana_ano || Math.ceil((day.getDate() + 6) / 7)}`;
                label = `Semana ${info?.semana_ano || ""} · ${day.getFullYear()}`;
            } else {
                key = `${day.getFullYear()}-${day.getMonth()}`;
                label = new Intl.DateTimeFormat("pt-BR", { month: scale === "year" ? "short" : "long", year: "numeric" }).format(day);
            }
            const last = groups[groups.length - 1];
            if (last && last.key === key) last.count += 1;
            else groups.push({ key, label, count: 1 });
        });
        const periods = groups.map((group) => `<span style="width:${group.count * dayWidth}px">${escapeHtml(group.label)}</span>`).join("");
        const ticks = scale === "year" ? "" : days.map((day) => {
            const info = calendarByDate.get(ganttDateKey(day));
            const nonWorking = info ? !info.dia_util : day.getDay() === 0 || day.getDay() === 6;
            const holiday = Boolean(info?.feriado);
            const label = scale === "week"
                ? `${new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(day).replace(".", "")} ${String(day.getDate()).padStart(2, "0")}`
                : String(day.getDate()).padStart(2, "0");
            return `<span class="projetos-gantt__day ${nonWorking ? "is-nonworking" : ""} ${holiday ? "is-holiday" : ""}" style="width:${dayWidth}px" data-gantt-tooltip="${escapeHtml(ganttCalendarTooltip(day, info))}">${label}</span>`;
        }).join("");
        return `<div class="projetos-gantt__periods">${periods}</div>${ticks ? `<div class="projetos-gantt__ticks">${ticks}</div>` : ""}`;
    }

    function bindGanttTooltips() {
        if (!el.ganttShell || el.ganttShell.dataset.tooltipBound === "1") return;
        el.ganttShell.dataset.tooltipBound = "1";

        // O tooltip precisa ser descendente do elemento colocado em Fullscreen nativo.
        // Elementos anexados ao document.body ficam fora da árvore de fullscreen e não
        // são renderizados pelo navegador enquanto o Gantt está expandido.
        const tooltip = document.createElement("div");
        tooltip.className = "projetos-gantt-tooltip";
        tooltip.setAttribute("role", "tooltip");
        el.ganttShell.appendChild(tooltip);

        let current = null;
        const move = (event) => {
            if (!current) return;
            const margin = 14;
            const width = tooltip.offsetWidth;
            const height = tooltip.offsetHeight;
            const maxLeft = Math.max(8, window.innerWidth - width - 8);
            const maxTop = Math.max(8, window.innerHeight - height - 8);
            tooltip.style.left = `${Math.max(8, Math.min(maxLeft, event.clientX + margin))}px`;
            tooltip.style.top = `${Math.max(8, Math.min(maxTop, event.clientY + margin))}px`;
        };
        el.ganttShell.addEventListener("mouseover", (event) => {
            const target = event.target.closest?.("[data-gantt-tooltip]");
            if (!target || !el.ganttShell.contains(target)) return;
            current = target;
            tooltip.textContent = target.dataset.ganttTooltip || "";
            tooltip.classList.add("is-visible");
            move(event);
        });
        el.ganttShell.addEventListener("mousemove", move);
        el.ganttShell.addEventListener("mouseout", (event) => {
            if (!current || current.contains(event.relatedTarget)) return;
            current = null;
            tooltip.classList.remove("is-visible");
        });
        document.addEventListener("fullscreenchange", () => {
            current = null;
            tooltip.classList.remove("is-visible");
        });
    }

    function ganttSupplierTimelineHtml(row, dayWidth, calendarByDate) {
        const visualStart = parseIsoDate(row.start);
        const visualEnd = parseIsoDate(row.end);
        if (!visualStart || !visualEnd) return "";

        const totalPixels = Math.max(dayWidth, (dayDiff(visualStart, visualEnd) + 1) * dayWidth);
        const clampDate = (value) => {
            const parsed = parseIsoDate(value);
            if (!parsed) return null;
            if (parsed < visualStart) return new Date(visualStart.getTime());
            if (parsed > visualEnd) return new Date(visualEnd.getTime());
            return parsed;
        };
        const xFor = (value, center = false) => {
            const parsed = clampDate(value);
            if (!parsed) return null;
            const raw = dayDiff(visualStart, parsed) * dayWidth + (center ? dayWidth / 2 : 0);
            return Math.max(0, Math.min(totalPixels, raw));
        };
        const segments = [];
        const addSegment = (fromValue, toValue, className, label, description) => {
            const from = clampDate(fromValue);
            const to = clampDate(toValue);
            if (!from || !to || to < from) return;
            const left = xFor(ganttDateKey(from));
            const right = Math.max(left + Math.max(4, dayWidth * .45), xFor(ganttDateKey(to), true));
            const width = Math.max(4, Math.min(totalPixels - left, right - left));
            const usefulDays = ganttBusinessDays(ganttDateKey(from), ganttDateKey(to), calendarByDate);
            const tooltip = [
                label,
                `${formatDate(ganttDateKey(from))} → ${formatDate(ganttDateKey(to))}`,
                usefulDays ? `${usefulDays} dia(s) útil(eis)` : "",
                description,
            ].filter(Boolean).join("\n");
            const labelHtml = width >= Math.max(54, (String(label).length * 5) + 14) ? `<i>${escapeHtml(label)}</i>` : "";
            segments.push(`<span class="projetos-gantt__supplier-segment ${className}" style="left:${left}px;width:${width}px" data-gantt-tooltip="${escapeHtml(tooltip)}">${labelHtml}</span>`);
        };

        const ticket = row.ticketOpen || row.start;
        const scope = row.scopeClosed || row.budgetReceived || row.contractStart || row.promisedEnd;
        const budget = row.budgetReceived || row.contractStart || row.promisedEnd;
        const contractStart = row.contractStart || "";
        const promised = row.promisedEnd || row.end;
        const actual = row.actualEnd || "";
        const todayKey = ganttDateKey(new Date());

        addSegment(ticket, scope, "is-scope", "Escopo", "Da abertura do ticket CSLOG até o fechamento do escopo do fornecedor.");
        if (row.scopeClosed && budget) addSegment(row.scopeClosed, budget, "is-budget", "Orçamento", "Tempo entre o escopo fechado e o recebimento do orçamento/prazo.");
        if (row.budgetReceived && contractStart) addSegment(row.budgetReceived, contractStart, "is-waiting", "Espera início", "Período após o orçamento até a CSLOG efetivamente iniciar o desenvolvimento.");
        if (contractStart && promised) {
            addSegment(contractStart, promised, "is-execution", "Prazo contratado", `${row.contractDays || 0} dias úteis${row.technicalHours != null ? ` · ${formatHours(row.technicalHours)} HTs` : ""}`);
        } else if (row.budgetReceived && promised) {
            addSegment(row.budgetReceived, promised, "is-provisional", "Previsão", "Previsão provisória calculada pelo orçamento; a contagem real ainda não iniciou.");
        }

        const overrunEnd = actual || (row.overdue ? todayKey : "");
        if (promised && overrunEnd) {
            const promisedDate = parseIsoDate(promised);
            const overrunDate = parseIsoDate(overrunEnd);
            if (promisedDate && overrunDate && overrunDate > promisedDate) {
                addSegment(promised, overrunEnd, "is-overrun", "Além do prazo", actual ? "Entrega ocorreu após a data prometida." : "Prazo prometido vencido e entrega real ainda não registrada.");
            }
        }

        const markers = [];
        const addMarker = (value, label, kind = "", lane = "top") => {
            if (!value) return;
            const left = xFor(value, true);
            if (left === null) return;
            const formatted = formatDate(value);
            markers.push(`<span class="projetos-gantt__supplier-marker ${kind ? `is-${kind}` : ""} is-label-${lane}" style="left:${left}px" data-gantt-tooltip="${escapeHtml(`${label} · ${formatted}`)}"><b><span>${escapeHtml(label)}</span><small>${escapeHtml(formatted)}</small></b></span>`);
        };
        addMarker(row.ticketOpen, "Ticket", "ticket", "top");
        addMarker(row.scopeClosed, "Escopo", "scope", "bottom");
        addMarker(row.budgetReceived, "Orçamento", "budget", "top");
        addMarker(row.contractStart, "Início da contagem", "count-start", "bottom");
        addMarker(row.promisedEnd, "Entrega prevista", "promised", "top");
        addMarker(row.actualEnd, "Entrega real", "actual", "bottom");

        return `<span class="projetos-gantt__supplier-segments">${segments.join("")}</span>${markers.join("")}`;
    }

    function renderGanttProject(project) {
        if (!project) {
            state.ganttRender = null;
            if (el.ganttExport) el.ganttExport.disabled = true;
            if (el.ganttExportExcel) el.ganttExportExcel.disabled = true;
            if (el.ganttSendStatus) el.ganttSendStatus.disabled = true;
            if (el.ganttToggleStages) el.ganttToggleStages.disabled = true;
            if (el.ganttToggleSubtasks) el.ganttToggleSubtasks.disabled = true;
            el.timeline.innerHTML = `<div class="projetos-empty projetos-gantt__closed"><span class="projetos-empty__icon"><i class="fa fa-tasks"></i></span><strong>Gantt fechado</strong><p>Selecione acima o projeto que deseja apresentar.</p></div>`;
            return;
        }

        const rows = [{ type: "project", itemId: project.id, id: `project-${project.id}`, label: project.nome, start: project.data_inicio, end: project.data_fim_prevista, progress: Number(project.progresso || 0), meta: project.owner ? `Owner: ${personLabel(project.owner)}` : "Sem Owner", people: project.owner ? [project.owner] : [], status: project.status_nome, overdue: project.situacao === "atrasado", depth: 0 }];

        const addTaskRows = (task, stage, depth) => {
            const taskPeople = (task.responsaveis || (task.responsavel_principal ? [task.responsavel_principal] : [])).filter(Boolean);
            const taskMeta = [
                task.e_envio_cslog ? "Passagem QORE → CSLOG" : "",
                task.responsavel_principal ? `Responsável: ${personLabel(task.responsavel_principal)}` : "Sem responsável",
            ].filter(Boolean).join(" · ");
            rows.push({
                type: "task",
                itemId: task.id,
                id: `task-${task.id}`,
                stageId: stage?.id || null,
                label: task.nome,
                start: task.data_inicio,
                end: task.data_fim_prevista,
                progress: Number(task.progresso || 0),
                status: task.status_nome,
                meta: taskMeta,
                people: taskPeople,
                overdue: Boolean(task.atrasada),
                depth,
                isCslogTransition: Boolean(task.e_envio_cslog),
                expandable: (task.checklist || []).length > 0,
            });

            (task.checklist || []).forEach((subtask) => {
                const subtaskPerson = subtask.responsavel || null;
                const ownDates = Boolean(subtask.data_inicio || subtask.data_fim_prevista);
                rows.push({
                    type: "subtask",
                    itemId: subtask.id,
                    id: `subtask-${subtask.id}`,
                    stageId: stage?.id || null,
                    parentTaskId: task.id,
                    label: subtask.descricao || "Subtarefa",
                    start: subtask.data_inicio || task.data_inicio,
                    end: subtask.data_fim_prevista || task.data_fim_prevista,
                    progress: subtask.concluido ? 100 : 0,
                    status: subtask.concluido ? "Concluída" : "Pendente",
                    meta: [
                        subtaskPerson ? `Responsável: ${personLabel(subtaskPerson)}` : "Sem responsável",
                        ownDates ? "" : "Período herdado da tarefa",
                    ].filter(Boolean).join(" · "),
                    people: subtaskPerson ? [subtaskPerson] : [],
                    overdue: Boolean(subtask.atrasada),
                    depth: depth + 1,
                    isCslogTransition: Boolean(task.e_envio_cslog),
                });
            });
        };

        const addStage = (stage, depth = 0) => {
            const stageNameParts = String(stage.nome || "Etapa").split(/\s+—\s+/).filter(Boolean);
            const stageTitle = stageNameParts.shift() || "Etapa";
            const stageDetails = [...new Set([stage.tipo_nome, stageNameParts.join(" — "), String(stage.descricao || "").trim()].filter(Boolean))].join(" · ");
            const hasTaskContent = (stage.tarefas || []).length > 0;
            rows.push({ type: "stage", itemId: stage.id, id: `stage-${stage.id}`, stageId: stage.id, label: stageTitle, start: stage.data_inicio, end: stage.data_fim_prevista, progress: Number(stage.progresso || 0), meta: stageDetails, status: stage.status_nome, people: stage.responsavel ? [stage.responsavel] : [], overdue: Boolean(stage.atrasada), depth, expandable: hasTaskContent, stageType: stage.tipo });
            (stage.tarefas || []).forEach((task) => addTaskRows(task, stage, depth + 1));
            (stage.sprints || []).forEach((child) => addStage(child, depth + 1));
        };
        (project.etapas || []).forEach((stage) => addStage(stage));

        // Projetos com referência CSLOG exibem uma única faixa visual do fornecedor.
        // A barra começa na abertura do ticket CSLOG (quando disponível), mostra as
        // etapas intermediárias por cor e marca explicitamente o início real da
        // contagem do prazo contratado.
        if (project.tem_cslog) {
            const ticketOpen = project.cslog_ticket_aberto_em || "";
            const scopeClosed = project.cslog_escopo_fechado_em || "";
            const budgetReceived = project.cslog_orcamento_recebido_em || "";
            const contractStart = project.cslog_data_inicio || "";
            const promisedEnd = project.cslog_data_entrega_prevista || "";
            const actualEnd = project.cslog_data_entrega_real || "";
            const supplierStatus = project.cslog_status_fornecedor_nome || "Aguardando definição";
            const todayKey = ganttDateKey(new Date());

            const visualStart = ticketOpen || scopeClosed || budgetReceived || contractStart || promisedEnd;
            const promisedDate = parseIsoDate(promisedEnd);
            const actualDate = parseIsoDate(actualEnd);
            const todayDate = parseIsoDate(todayKey);
            const supplierOverdue = Boolean(
                promisedDate
                && !actualEnd
                && todayDate
                && promisedDate < todayDate
            );
            let visualEnd = promisedEnd || actualEnd || contractStart || budgetReceived || visualStart;
            if (actualDate && promisedDate && actualDate > promisedDate) visualEnd = actualEnd;
            else if (supplierOverdue) visualEnd = todayKey;
            else if (actualEnd) visualEnd = actualEnd;

            const supplierMeta = [
                ticketOpen ? `Ticket ${formatDate(ticketOpen)}` : "",
                scopeClosed ? `Escopo ${formatDate(scopeClosed)}` : "",
                budgetReceived ? `Orçamento ${formatDate(budgetReceived)}` : "",
                contractStart ? `Início contagem ${formatDate(contractStart)}` : "Aguardando início da contagem",
                project.cslog_horas_tecnicas !== null && project.cslog_horas_tecnicas !== undefined && project.cslog_horas_tecnicas !== ""
                    ? `${formatHours(project.cslog_horas_tecnicas)} HTs${project.cslog_media_horas_dia != null ? ` · ${formatHours(project.cslog_media_horas_dia)}/dia` : ""}`
                    : "",
                project.cslog_prazo_dias_uteis ? `${project.cslog_prazo_dias_uteis} dias úteis` : "",
                promisedEnd ? `Entrega ${formatDate(promisedEnd)}` : "",
            ].filter(Boolean).join(" · ");

            if (visualStart && visualEnd) {
                rows.push({
                    type: "supplier",
                    itemId: project.id,
                    id: `supplier-${project.id}`,
                    label: "CSLOG · Dependência externa",
                    start: visualStart,
                    end: visualEnd,
                    progress: actualEnd ? 100 : 0,
                    meta: supplierMeta || "Prazo do fornecedor ainda não confirmado",
                    status: supplierStatus,
                    people: [],
                    overdue: supplierOverdue,
                    depth: 0,
                    supplier: true,
                    ticketOpen,
                    scopeClosed,
                    budgetReceived,
                    contractStart,
                    promisedEnd,
                    actualEnd,
                    contractDays: Number(project.cslog_prazo_dias_uteis || 0),
                    technicalHours: project.cslog_horas_tecnicas,
                });
                // Mantém a dependência externa logo abaixo do Projeto, antes das etapas QORE.
                rows.splice(1, 0, rows.pop());
            }
        }

        const ganttTaskFilterActive = state.ganttMine || state.ganttOverdue;
        const ganttTaskMatches = (row) => {
            if (row.type !== "task") return false;
            const people = Array.isArray(row.people) ? row.people.filter(Boolean) : [];
            const mineMatches = !state.ganttMine || people.some((person) => Number(person?.usuario_id || person?.id || 0) === userId);
            const overdueMatches = !state.ganttOverdue || Boolean(row.overdue);
            return mineMatches && overdueMatches;
        };
        const matchingTaskIds = new Set(rows.filter(ganttTaskMatches).map((row) => Number(row.itemId)));
        const matchingStageIds = new Set(
            rows
                .filter((row) => row.type === "task" && matchingTaskIds.has(Number(row.itemId)) && row.stageId)
                .map((row) => String(row.stageId)),
        );
        const ganttRows = ganttTaskFilterActive
            ? rows.filter((row) => {
                if (row.type === "project" || row.type === "supplier") return true;
                if (row.type === "stage") return matchingStageIds.has(String(row.stageId));
                if (row.type === "task") return matchingTaskIds.has(Number(row.itemId));
                if (row.type === "subtask") return matchingTaskIds.has(Number(row.parentTaskId));
                return false;
            })
            : rows;

        const datedRows = ganttRows.filter((row) => row.start && row.end);
        syncGanttStagesButton(project);
        syncGanttSubtasksButton(project);
        if (!datedRows.length) { el.timeline.innerHTML = `<div class="projetos-empty"><strong>Sem datas para o Gantt</strong><p>Informe datas próprias nas tarefas ou no projeto.</p></div>`; return; }
        const scale = state.ganttScale || "month";
        const { minDate, maxDate } = ganttRange(datedRows, scale);
        const totalDays = Math.max(1, dayDiff(minDate, maxDate) + 1);
        const dayWidth = scale === "week" ? 44 : scale === "month" ? 22 : 5;
        const trackWidth = totalDays * dayWidth;
        const days = [];
        for (let i = 0; i < totalDays; i += 1) { const d = new Date(minDate.getTime()); d.setDate(minDate.getDate() + i); days.push(d); }
        const calendarByDate = new Map((project.calendario || []).map((item) => [item.data, item]));
        const axis = ganttAxisHtml(days, dayWidth, scale, calendarByDate);
        const today = parseIsoDate(ganttDateKey(new Date()));
        const todayOffset = today && today >= minDate && today <= maxDate ? (dayDiff(minDate, today) * dayWidth) + (dayWidth / 2) : null;
        const calendarGrid = days.map((day) => { const info = calendarByDate.get(ganttDateKey(day)); const nonWorking = info ? !info.dia_util : day.getDay() === 0 || day.getDay() === 6; return `<span class="${nonWorking ? "is-nonworking" : ""} ${info?.feriado ? "is-holiday" : ""}" style="width:${dayWidth}px"></span>`; }).join("");

        const body = ganttRows.map((row) => {
            const startDate = parseIsoDate(row.start); const endDate = parseIsoDate(row.end); const hasDates = startDate && endDate;
            const left = hasDates ? Math.max(0, dayDiff(minDate, startDate) * dayWidth) : 0;
            const width = hasDates ? Math.max(dayWidth, (dayDiff(startDate, endDate) + 1) * dayWidth) : 0;
            const stageAttr = row.stageId ? `data-gantt-stage-row="${row.stageId}"` : "";
            const labelClass = row.type === "stage"
                ? "is-stage"
                : row.type === "task"
                    ? "is-task"
                    : row.type === "subtask"
                        ? "is-subtask"
                        : row.type === "supplier"
                            ? "is-supplier"
                            : "is-project";
            const expanded = row.type === "stage" && state.ganttExpandedStages.has(String(row.stageId));
            const taskExpanded = row.type === "task" && (state.ganttShowSubtasks || state.ganttExpandedTasks.has(String(row.itemId)));
            const stageIsExpanded = !row.stageId || state.ganttExpandedStages.has(String(row.stageId));
            const taskVisible = row.type === "subtask"
                ? stageIsExpanded && (state.ganttShowSubtasks || state.ganttExpandedTasks.has(String(row.parentTaskId)))
                : row.type === "task"
                    ? stageIsExpanded
                    : true;
            const toggle = row.type === "stage" && row.expandable
                ? `<button type="button" class="projetos-gantt__toggle ${expanded ? "" : "is-collapsed"}" data-gantt-stage-toggle="${row.stageId}" aria-expanded="${expanded ? "true" : "false"}" aria-label="Abrir ou recolher tarefas"><i class="fa ${expanded ? "fa-chevron-down" : "fa-chevron-right"}"></i></button>`
                : row.type === "task" && row.expandable
                    ? `<button type="button" class="projetos-gantt__toggle projetos-gantt__toggle--task ${taskExpanded ? "" : "is-collapsed"}" data-gantt-task-toggle="${row.itemId}" aria-expanded="${taskExpanded ? "true" : "false"}" aria-label="${taskExpanded ? "Recolher" : "Exibir"} subtarefas de ${escapeHtml(row.label)}"><i class="fa ${taskExpanded ? "fa-chevron-down" : "fa-chevron-right"}"></i></button>`
                    : `<span class="projetos-gantt__toggle-spacer"></span>`;
            const secondLine = row.type === "supplier"
                ? [row.meta, row.status].filter(Boolean).join(" · ")
                : [row.meta, row.status, `${formatDate(row.start)} → ${formatDate(row.end)}`].filter(Boolean).join(" · ");
            const situation = ganttSituation(row); const businessDays = ganttBusinessDays(row.start, row.end, calendarByDate); const calendarDays = hasDates ? dayDiff(startDate, endDate) + 1 : 0;
            const tooltip = row.type === "supplier"
                ? [
                    row.label,
                    row.status,
                    row.ticketOpen ? `Ticket aberto: ${formatDate(row.ticketOpen)}` : "",
                    row.scopeClosed ? `Escopo fechado: ${formatDate(row.scopeClosed)}` : "",
                    row.budgetReceived ? `Orçamento recebido: ${formatDate(row.budgetReceived)}` : "",
                    row.contractStart ? `Início da contagem: ${formatDate(row.contractStart)}` : "Aguardando início da contagem",
                    row.contractDays ? `Prazo contratado: ${row.contractDays} dias úteis` : "",
                    row.technicalHours != null ? `Horas técnicas: ${formatHours(row.technicalHours)} HTs` : "",
                    row.promisedEnd ? `Entrega prevista: ${formatDate(row.promisedEnd)}` : "",
                    row.actualEnd ? `Entrega realizada: ${formatDate(row.actualEnd)}` : "",
                    row.overdue ? "Prazo da CSLOG ultrapassado." : "",
                ].filter(Boolean).join("\n")
                : [
                    row.label,
                    ganttSituationLabel(situation),
                    `${formatDate(row.start)} → ${formatDate(row.end)}`,
                    `${businessDays} dia(s) útil(eis) · ${calendarDays} dia(s) corrido(s)`,
                    `${row.progress.toFixed(0)}% concluído`,
                    row.people?.length ? `Responsáveis: ${row.people.map(personLabel).join(", ")}` : "Sem responsável",
                    row.type === "subtask" ? "Edite a subtarefa pelo cronograma do projeto." : "Arraste para reagendar",
                ].filter(Boolean).join("\n");
            const progressColor = ganttProgressColor(row.progress);
            const draggable = ["project", "stage", "task"].includes(row.type);
            const draggableAttrs = draggable ? `data-gantt-item-id="${row.itemId}"` : "";
            const rowExtraClass = row.isCslogTransition ? "is-cslog-transition" : "";
            const standardBarContent = `<span>${row.progress.toFixed(0)}%</span>`;
            const supplierBarContent = row.type === "supplier" ? ganttSupplierTimelineHtml(row, dayWidth, calendarByDate) : "";
            const peopleCount = Array.isArray(row.people) ? row.people.filter(Boolean).length : 0;
            const peopleWidth = peopleCount ? Math.min(92, 24 + (Math.min(peopleCount, 5) - 1) * 17) : 0;
            const peopleLeft = peopleCount
                ? (left + width + peopleWidth + 8 <= trackWidth ? left + width + 6 : Math.max(2, left - peopleWidth - 6))
                : 0;
            const timelinePeople = row.type !== "supplier" && peopleCount
                ? `<span class="projetos-gantt__bar-people" data-gantt-people-for="${row.id}" style="left:${peopleLeft}px">${ganttPeopleHtml(row.people, true)}</span>`
                : "";
            const shortBarClass = row.type !== "supplier" && width < 38 ? "is-short" : "";
            return `<div class="projetos-gantt__row ${labelClass} ${row.stageType ? `is-${row.stageType}` : ""} ${rowExtraClass} ${row.overdue ? "is-overdue" : ""}" ${stageAttr} data-gantt-row-type="${row.type}" data-gantt-depth="${Number(row.depth || 0)}" ${row.parentTaskId ? `data-gantt-parent-task="${row.parentTaskId}"` : ""} ${taskVisible ? "" : "hidden"}><div class="projetos-gantt__label" style="--gantt-depth:${Number(row.depth || 0)}">${toggle}<span><strong>${escapeHtml(row.label)}</strong><small>${escapeHtml(secondLine)}</small></span>${ganttPeopleHtml(row.people, true)}</div><div class="projetos-gantt__track" style="width:${trackWidth}px;--day-width:${dayWidth}px"><div class="projetos-gantt__calendar-grid">${calendarGrid}</div>${todayOffset !== null ? `<span class="projetos-gantt__today-line" style="left:${todayOffset}px" data-gantt-tooltip="Hoje · ${formatDate(ganttDateKey(today))}"></span>` : ""}${hasDates ? `<div class="projetos-gantt__bar ${row.type === "supplier" ? "is-supplier is-supplier-timeline" : ""} ${row.overdue ? "is-overdue" : ""} ${shortBarClass}" data-gantt-type="${row.type}" ${draggableAttrs} data-gantt-row-id="${row.id}" data-gantt-start="${row.start}" data-gantt-end="${row.end}" data-gantt-situation="${situation}" data-gantt-tooltip="${escapeHtml(tooltip)}" style="left:${left}px;width:${width}px;--progress:${Math.max(0, Math.min(100, row.progress))}%;--progress-color:${progressColor}">${row.type === "supplier" ? supplierBarContent : standardBarContent}</div>${timelinePeople}` : ""}</div></div>`;
        }).join("");
        el.timeline.innerHTML = `<div class="projetos-gantt__viewport"><div class="projetos-gantt__axis-row"><div class="projetos-gantt__axis-label"><strong>${escapeHtml(project.nome)}</strong><small>${formatDate(project.data_inicio)} → ${formatDate(project.data_fim_prevista)}</small></div><div class="projetos-gantt__axis" style="width:${trackWidth}px">${axis}${todayOffset !== null ? `<span class="projetos-gantt__today-marker" style="left:${todayOffset}px" data-gantt-tooltip="Hoje · ${formatDate(ganttDateKey(today))}"><b>Hoje</b></span>` : ""}</div></div>${body}</div>`;
        state.ganttRender = { project, rows: ganttRows, minDate, maxDate, totalDays, dayWidth, trackWidth, scale };
        if (el.ganttExport) el.ganttExport.disabled = false;
        if (el.ganttExportExcel) el.ganttExportExcel.disabled = false;
        if (el.ganttSendStatus) el.ganttSendStatus.disabled = false;
        syncGanttStagesButton(project); bindGanttTooltips();
        el.timeline.querySelectorAll("[data-gantt-stage-toggle]").forEach((button) => button.addEventListener("click", () => {
            const stageId = String(button.dataset.ganttStageToggle || "");
            const collapsed = button.classList.toggle("is-collapsed");
            button.setAttribute("aria-expanded", collapsed ? "false" : "true");
            if (collapsed) state.ganttExpandedStages.delete(stageId); else state.ganttExpandedStages.add(stageId);
            button.querySelector("i")?.classList.toggle("fa-chevron-down", !collapsed);
            button.querySelector("i")?.classList.toggle("fa-chevron-right", collapsed);
            el.timeline.querySelectorAll(`[data-gantt-stage-row="${stageId}"][data-gantt-row-type="task"]`).forEach((child) => { child.hidden = collapsed; });
            el.timeline.querySelectorAll(`[data-gantt-stage-row="${stageId}"][data-gantt-row-type="subtask"]`).forEach((child) => {
                const taskId = String(child.dataset.ganttParentTask || "");
                child.hidden = collapsed || !(state.ganttShowSubtasks || state.ganttExpandedTasks.has(taskId));
            });
            syncGanttStagesButton(project);
        }));
        el.timeline.querySelectorAll("[data-gantt-task-toggle]").forEach((button) => button.addEventListener("click", () => {
            const taskId = String(button.dataset.ganttTaskToggle || "");
            if (state.ganttShowSubtasks) {
                const allTaskIds = rows.filter((item) => item.type === "task" && item.expandable).map((item) => String(item.itemId));
                state.ganttShowSubtasks = false;
                state.ganttExpandedTasks = new Set(allTaskIds.filter((id) => id !== taskId));
            } else if (state.ganttExpandedTasks.has(taskId)) {
                state.ganttExpandedTasks.delete(taskId);
            } else {
                state.ganttExpandedTasks.add(taskId);
            }
            renderGanttProject(project);
        }));
        syncGanttSubtasksButton(project);
        bindGanttInteractions();
    }

    async function loadGanttProject(projectId) {
        if (!projectId) return;
        if (Number(projectId) !== Number(state.ganttProjectId)) {
            state.ganttExpandedStages.clear();
            state.ganttExpandedTasks.clear();
            state.ganttShowSubtasks = false;
        }
        state.ganttProjectId = Number(projectId);
        el.timeline.innerHTML = `<div class="projetos-empty"><span class="projetos-loading__spinner"></span><p>Carregando Gantt...</p></div>`;
        try {
            const data = await request(`${api.projetos}${projectId}/`);
            if (Number(projectId) !== Number(state.ganttProjectId)) return;
            state.ganttProject = data.projeto;
            renderGanttProject(state.ganttProject);
        } catch (error) {
            toast(error.message, true);
            el.timeline.innerHTML = `<div class="projetos-empty"><strong>Não foi possível carregar o Gantt.</strong></div>`;
        }
    }

    function renderTimeline(projects) {
        if (!el.ganttProject) return;
        projects = (projects || []).filter((project) => !["rascunho", "concluido", "cancelado"].includes(String(project.status || "").toLowerCase()));
        const current = Number(state.ganttProjectId || 0);
        el.ganttProject.innerHTML = projects.length
            ? `<option value="">Selecione um projeto para abrir o Gantt</option>` + projects.map((project) => `<option value="${project.id}">${escapeHtml(project.codigo)} · ${escapeHtml(project.nome)}</option>`).join("")
            : `<option value="">Nenhum projeto</option>`;

        if (!projects.length) {
            state.ganttProjectId = null;
            state.ganttProject = null;
            renderGanttProject(null);
            return;
        }

        const exists = current && projects.some((project) => Number(project.id) === current);
        const selectedId = exists ? current : null;
        state.ganttProjectId = selectedId;
        el.ganttProject.value = selectedId ? String(selectedId) : "";

        if (!selectedId) {
            state.ganttProject = null;
            renderGanttProject(null);
            return;
        }

        if (state.ganttProject && Number(state.ganttProject.id) === selectedId) {
            renderGanttProject(state.ganttProject);
            return;
        }

        if (state.view === "timeline") {
            loadGanttProject(selectedId);
        } else {
            el.timeline.innerHTML = `<div class="projetos-empty"><strong>Gantt pronto</strong><p>Abra a visualização Gantt para carregar o projeto selecionado.</p></div>`;
        }
    }

    function syncGanttStagesButton(project = state.ganttProject) {
        if (!el.ganttToggleStages) return;
        const stageIds = flattenProjectStages(project?.etapas || []).filter((stage) => (stage.tarefas || []).length).map((stage) => String(stage.id));
        const allExpanded = stageIds.length > 0 && stageIds.every((id) => state.ganttExpandedStages.has(id));
        el.ganttToggleStages.disabled = !stageIds.length;
        el.ganttToggleStages.innerHTML = allExpanded
            ? `<i class="fa fa-angle-double-up"></i><span>Recolher etapas</span>`
            : `<i class="fa fa-angle-double-down"></i><span>Expandir etapas</span>`;
        el.ganttToggleStages.setAttribute("aria-label", allExpanded ? "Recolher todas as Sprints e fases" : "Expandir todas as Sprints e fases");
        el.ganttToggleStages.dataset.ganttTooltip = allExpanded ? "Recolher todas as Sprints e fases" : "Expandir todas as Sprints e fases";
    }

    function toggleAllGanttStages() {
        const project = state.ganttProject;
        if (!project) return;
        const stageIds = flattenProjectStages(project.etapas || []).filter((stage) => (stage.tarefas || []).length).map((stage) => String(stage.id));
        const allExpanded = stageIds.length > 0 && stageIds.every((id) => state.ganttExpandedStages.has(id));
        stageIds.forEach((id) => {
            if (allExpanded) state.ganttExpandedStages.delete(id);
            else state.ganttExpandedStages.add(id);
        });
        renderGanttProject(project);
    }

    function syncGanttSubtasksButton(project = state.ganttProject) {
        if (!el.ganttToggleSubtasks) return;
        const tasks = flattenProjectStages(project?.etapas || []).flatMap((stage) => stage.tarefas || []);
        const hasSubtasks = tasks.some((task) => (task.checklist || []).length > 0);
        el.ganttToggleSubtasks.disabled = !hasSubtasks;
        el.ganttToggleSubtasks.classList.toggle("is-active", state.ganttShowSubtasks);
        el.ganttToggleSubtasks.innerHTML = state.ganttShowSubtasks
            ? `<i class="fa fa-list-ul"></i><span>Ocultar subtarefas</span>`
            : `<i class="fa fa-list-ul"></i><span>Exibir subtarefas</span>`;
        const label = state.ganttShowSubtasks ? "Ocultar todas as subtarefas" : "Exibir subtarefas das etapas abertas";
        el.ganttToggleSubtasks.setAttribute("aria-label", label);
        el.ganttToggleSubtasks.dataset.ganttTooltip = label;
    }

    function toggleAllGanttSubtasks() {
        const project = state.ganttProject;
        if (!project) return;
        state.ganttShowSubtasks = !state.ganttShowSubtasks;
        state.ganttExpandedTasks.clear();
        renderGanttProject(project);
    }

    function truncateCanvasText(context, text, maxWidth) {
        const value = String(text || "");
        if (context.measureText(value).width <= maxWidth) return value;
        let shortened = value;
        while (shortened.length > 1 && context.measureText(`${shortened}…`).width > maxWidth) shortened = shortened.slice(0, -1);
        return `${shortened}…`;
    }


    function ganttExportRowHeight(row, defaultHeight = 52) {
        return row?.type === "supplier" ? 86 : defaultHeight;
    }

    function drawCanvasWrappedText(context, text, x, y, maxWidth, lineHeight = 12, maxLines = 3) {
        const words = String(text || "").split(/\s+/).filter(Boolean);
        if (!words.length) return 0;
        const lines = [];
        let line = "";
        words.forEach((word) => {
            const candidate = line ? `${line} ${word}` : word;
            if (line && context.measureText(candidate).width > maxWidth) {
                lines.push(line);
                line = word;
            } else {
                line = candidate;
            }
        });
        if (line) lines.push(line);
        const visible = lines.slice(0, maxLines);
        if (lines.length > maxLines && visible.length) {
            visible[visible.length - 1] = truncateCanvasText(context, `${visible[visible.length - 1]}…`, maxWidth);
        }
        visible.forEach((value, index) => context.fillText(value, x, y + (index * lineHeight)));
        return visible.length;
    }

    function drawGanttSupplierTimelineCanvas(context, row, options) {
        const { y, labelWidth, rowHeight, dayWidth, model } = options;
        const visualStart = parseIsoDate(row.start);
        const visualEnd = parseIsoDate(row.end);
        if (!visualStart || !visualEnd) return;

        context.fillStyle = "#fffaf0";
        context.fillRect(0, y, labelWidth, rowHeight);
        context.fillStyle = row.overdue ? "#dc2626" : "#f59e0b";
        context.fillRect(0, y, 3, rowHeight);

        context.fillStyle = "#92400e";
        context.font = "700 12px Arial";
        context.fillText(truncateCanvasText(context, row.label || "CSLOG · Dependência externa", labelWidth - 36), 16, y + 20);
        context.fillStyle = "#9a6700";
        context.font = "9px Arial";
        drawCanvasWrappedText(context, row.meta || "Prazo do fornecedor ainda não confirmado", 16, y + 38, labelWidth - 32, 12, 3);

        const clampDate = (value) => {
            const parsed = parseIsoDate(value);
            if (!parsed) return null;
            if (parsed < visualStart) return new Date(visualStart.getTime());
            if (parsed > visualEnd) return new Date(visualEnd.getTime());
            return parsed;
        };
        const xFor = (value, center = false) => {
            const parsed = clampDate(value);
            if (!parsed) return null;
            return labelWidth + (dayDiff(model.minDate, parsed) * dayWidth) + (center ? dayWidth / 2 : 0);
        };

        const barY = y + 30;
        const barHeight = 26;
        const barStartX = xFor(row.start);
        const barEndX = xFor(row.end, true);
        const barWidth = Math.max(4, barEndX - barStartX);
        context.fillStyle = "#e2e8f0";
        context.beginPath();
        context.roundRect(barStartX, barY, barWidth, barHeight, 13);
        context.fill();

        const segments = [];
        const addSegment = (fromValue, toValue, color, label) => {
            const from = clampDate(fromValue);
            const to = clampDate(toValue);
            if (!from || !to || to < from) return;
            const left = xFor(ganttDateKey(from));
            const right = Math.max(left + Math.max(4, dayWidth * .45), xFor(ganttDateKey(to), true));
            const width = Math.max(4, Math.min((barStartX + barWidth) - left, right - left));
            segments.push({ left, width, color, label, labelOffset: Math.min(22, Math.max(18, dayWidth * .28)) });
        };

        const ticket = row.ticketOpen || row.start;
        const scope = row.scopeClosed || row.budgetReceived || row.contractStart || row.promisedEnd;
        const budget = row.budgetReceived || row.contractStart || row.promisedEnd;
        const contractStart = row.contractStart || "";
        const promised = row.promisedEnd || row.end;
        const actual = row.actualEnd || "";
        const todayKey = ganttDateKey(new Date());

        addSegment(ticket, scope, "#eab308", "Escopo");
        if (row.scopeClosed && budget) addSegment(row.scopeClosed, budget, "#f59e0b", "Orçamento");
        if (row.budgetReceived && contractStart) addSegment(row.budgetReceived, contractStart, "#8b5cf6", "Espera início");
        if (contractStart && promised) addSegment(contractStart, promised, "#2563eb", "Prazo contratado");
        else if (row.budgetReceived && promised) addSegment(row.budgetReceived, promised, "#64748b", "Previsão");
        const overrunEnd = actual || (row.overdue ? todayKey : "");
        if (promised && overrunEnd) {
            const promisedDate = parseIsoDate(promised);
            const overrunDate = parseIsoDate(overrunEnd);
            if (promisedDate && overrunDate && overrunDate > promisedDate) addSegment(promised, overrunEnd, "#dc2626", "Além do prazo");
        }

        context.save();
        context.beginPath();
        context.roundRect(barStartX, barY, barWidth, barHeight, 13);
        context.clip();
        segments.forEach((segment) => {
            context.fillStyle = segment.color;
            context.fillRect(segment.left, barY, segment.width, barHeight);
            if (segment.width >= Math.max(64, (segment.label.length * 5.2) + 24)) {
                /* Reserva espaço após o marco inicial para a linha vertical
                   não atravessar o texto no PNG. */
                const labelX = segment.left + segment.labelOffset;
                const labelMaxWidth = Math.max(18, segment.width - segment.labelOffset - 6);
                context.fillStyle = "#ffffff";
                context.font = "700 9px Arial";
                context.fillText(truncateCanvasText(context, segment.label, labelMaxWidth), labelX, barY + 17);
            }
        });
        context.restore();

        const markerSpecs = [
            [row.ticketOpen, "Ticket", "#ca8a04", "top", false],
            [row.scopeClosed, "Escopo", "#eab308", "bottom", false],
            [row.budgetReceived, "Orçamento", "#f59e0b", "top", false],
            [row.contractStart, "Início da contagem", "#0f172a", "bottom", true],
            [row.promisedEnd, "Entrega prevista", "#2563eb", "top", false],
            [row.actualEnd, "Entrega real", "#16a34a", "bottom", false],
        ];

        markerSpecs.forEach(([value, label, color, lane, countStart]) => {
            if (!value) return;
            const markerX = xFor(value, true);
            if (markerX === null) return;
            const centerY = barY + (barHeight / 2);
            context.strokeStyle = countStart ? "#0f172a" : "#475569";
            context.lineWidth = countStart ? 3 : 2;
            context.beginPath();
            context.moveTo(markerX, y + 20);
            context.lineTo(markerX, y + 66);
            context.stroke();
            context.fillStyle = color;
            context.strokeStyle = "#ffffff";
            context.lineWidth = 2;
            context.beginPath();
            context.arc(markerX, centerY, countStart ? 5 : 4, 0, Math.PI * 2);
            context.fill();
            context.stroke();
            context.lineWidth = 1;

            const formatted = formatDate(value);
            context.font = "700 8px Arial";
            const labelWidthPx = Math.min(128, Math.max(54, Math.max(context.measureText(label).width, context.measureText(formatted).width) + 16));
            const cardHeight = 24;
            let cardX = markerX - (labelWidthPx / 2);
            if (countStart) cardX = markerX - labelWidthPx - 9;
            cardX = Math.max(labelWidth + 2, Math.min(canvasSafeRight(options.canvasWidth, labelWidthPx), cardX));
            const cardY = lane === "top" ? y + 3 : y + rowHeight - cardHeight - 3;

            context.fillStyle = countStart ? "#0f172a" : "rgba(255,255,255,.98)";
            context.strokeStyle = countStart ? "#0f172a" : "#cbd5e1";
            context.beginPath();
            context.roundRect(cardX, cardY, labelWidthPx, cardHeight, 5);
            context.fill();
            context.stroke();
            context.textAlign = "center";
            context.fillStyle = countStart ? "#ffffff" : "#334155";
            context.font = "700 8px Arial";
            context.fillText(truncateCanvasText(context, label, labelWidthPx - 8), cardX + (labelWidthPx / 2), cardY + 10);
            context.fillStyle = countStart ? "#dbeafe" : "#64748b";
            context.font = "7px Arial";
            context.fillText(formatted, cardX + (labelWidthPx / 2), cardY + 20);
            context.textAlign = "left";
        });
    }

    function canvasSafeRight(canvasWidth, elementWidth) {
        return Math.max(0, canvasWidth - elementWidth - 3);
    }

    function visibleGanttRows() {
        const model = state.ganttRender;
        if (!model || !el.timeline) return [];
        return model.rows.filter((row) => {
            const selector = `.projetos-gantt__bar[data-gantt-row-id="${row.id}"]`;
            const bar = el.timeline.querySelector(selector);
            return Boolean(bar && !bar.closest(".projetos-gantt__row")?.hidden);
        });
    }

    function bindGanttInteractions() {
        const viewport = el.timeline?.querySelector(".projetos-gantt__viewport");
        if (!viewport) return;

        let pan = null;
        viewport.addEventListener("pointerdown", (event) => {
            if (event.button !== 0 || event.target.closest(".projetos-gantt__bar, button, [data-gantt-tooltip]")) return;
            pan = {
                x: event.clientX,
                y: event.clientY,
                scrollLeft: viewport.scrollLeft,
                scrollTop: viewport.scrollTop,
            };
            viewport.classList.add("is-panning");
            viewport.setPointerCapture?.(event.pointerId);
            event.preventDefault();
        });
        viewport.addEventListener("pointermove", (event) => {
            if (!pan) return;
            viewport.scrollLeft = pan.scrollLeft - (event.clientX - pan.x);
            viewport.scrollTop = pan.scrollTop - (event.clientY - pan.y);
            event.preventDefault();
        });
        const stopPan = () => { pan = null; viewport.classList.remove("is-panning"); };
        viewport.addEventListener("pointerup", stopPan);
        viewport.addEventListener("pointercancel", stopPan);

        viewport.querySelectorAll(".projetos-gantt__bar[data-gantt-item-id]").forEach((bar) => {
            bar.addEventListener("pointerdown", (event) => {
                if (event.button !== 0 || bar.classList.contains("is-saving")) return;
                event.preventDefault();
                event.stopPropagation();
                const originalLeft = Number.parseFloat(bar.style.left || "0") || 0;
                const drag = { x: event.clientX, originalLeft, days: 0 };
                bar.classList.add("is-dragging");
                bar.setPointerCapture?.(event.pointerId);

                const move = (moveEvent) => {
                    const pixels = moveEvent.clientX - drag.x;
                    drag.days = Math.round(pixels / state.ganttRender.dayWidth);
                    bar.style.left = `${Math.max(0, originalLeft + (drag.days * state.ganttRender.dayWidth))}px`;
                };
                const finish = async () => {
                    bar.removeEventListener("pointermove", move);
                    bar.removeEventListener("pointerup", finish);
                    bar.removeEventListener("pointercancel", cancel);
                    bar.classList.remove("is-dragging");
                    if (!drag.days) { bar.style.left = `${originalLeft}px`; return; }
                    const start = ganttShiftDate(bar.dataset.ganttStart, drag.days);
                    const end = ganttShiftDate(bar.dataset.ganttEnd, drag.days);
                    bar.classList.add("is-saving");
                    try {
                        const data = await request(ganttEndpoint(bar.dataset.ganttType, bar.dataset.ganttItemId), {
                            method: "PATCH",
                            body: JSON.stringify({ data_inicio: start, data_fim_prevista: end }),
                        });
                        state.ganttProject = data.projeto;
                        const item = state.projetos.find((project) => Number(project.id) === Number(data.projeto.id));
                        if (item) Object.assign(item, data.projeto);
                        renderGanttProject(state.ganttProject);
                        toast(data.mensagem || "Cronograma atualizado.");
                    } catch (error) {
                        bar.style.left = `${originalLeft}px`;
                        bar.classList.remove("is-saving");
                        toast(error.message, true);
                    }
                };
                const cancel = () => {
                    bar.style.left = `${originalLeft}px`;
                    bar.classList.remove("is-dragging");
                    bar.removeEventListener("pointermove", move);
                    bar.removeEventListener("pointerup", finish);
                    bar.removeEventListener("pointercancel", cancel);
                };
                bar.addEventListener("pointermove", move);
                bar.addEventListener("pointerup", finish);
                bar.addEventListener("pointercancel", cancel);
            });
        });
    }

    async function exportGanttExcel() {
        const model = state.ganttRender;
        if (!model) { toast("Selecione um projeto antes de exportar.", true); return; }
        const rows = visibleGanttRows();
        setLoading(true);
        try {
            const response = await fetch(api.exportarExcel, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": getCookie("csrftoken"),
                    "X-Requested-With": "XMLHttpRequest",
                },
                body: JSON.stringify({
                    modo: "gantt",
                    projeto_id: model.project.id,
                    linhas: rows.map((row) => ({ tipo: row.type, id: row.itemId })),
                }),
            });
            if (!response.ok) throw new Error("Não foi possível exportar o Gantt.");
            const blob = await response.blob();
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `gantt-${String(model.project.codigo || model.project.id).toLowerCase()}.xlsx`;
            link.click();
            window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
            toast("Gantt exportado para Excel.");
        } catch (error) {
            toast(error.message, true);
        } finally {
            setLoading(false);
        }
    }


    function buildGanttEmailImageDataUrl() {
        const model = state.ganttRender;
        if (!model) throw new Error("Selecione um projeto antes de gerar o Gantt.");

        const rows = visibleGanttRows().length ? visibleGanttRows() : (model.rows || []);
        const labelWidth = 340;
        const defaultRowHeight = 44;
        const axisHeight = 62;
        const canvasWidth = Math.min(2800, Math.max(1200, labelWidth + model.trackWidth));
        const scaleX = Math.max(.16, (canvasWidth - labelWidth) / Math.max(1, model.trackWidth));
        const dayWidth = model.dayWidth * scaleX;
        const rowsHeight = rows.reduce((total, row) => total + ganttExportRowHeight(row, defaultRowHeight), 0);
        const canvasHeight = 58 + axisHeight + rowsHeight + 24;
        const canvas = document.createElement("canvas");
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Não foi possível preparar a imagem do Gantt.");

        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvasWidth, canvasHeight);
        context.fillStyle = "#0f172a";
        context.font = "700 18px Arial";
        context.fillText(`Status Report · ${model.project.codigo} · ${model.project.nome}`, 18, 26);
        context.fillStyle = "#64748b";
        context.font = "11px Arial";
        context.fillText(`${formatDate(ganttDateKey(model.minDate))} → ${formatDate(ganttDateKey(model.maxDate))} · ${Number(model.project.progresso || 0).toFixed(0)}% concluído`, 18, 45);

        const top = 58;
        context.fillStyle = "#f8fafc";
        context.fillRect(0, top, canvasWidth, axisHeight);
        context.strokeStyle = "#dce3ec";
        context.beginPath();
        context.moveTo(labelWidth, top);
        context.lineTo(labelWidth, canvasHeight);
        context.stroke();

        for (let index = 0; index < model.totalDays; index += 1) {
            const day = new Date(model.minDate.getTime());
            day.setDate(model.minDate.getDate() + index);
            const x = labelWidth + (index * dayWidth);
            if (day.getDay() === 0 || day.getDay() === 6) {
                context.fillStyle = "#f5f7fa";
                context.fillRect(x, top, Math.max(1, dayWidth), canvasHeight - top);
            }
            if (dayWidth >= 10) {
                context.strokeStyle = "#eef2f7";
                context.beginPath();
                context.moveTo(x, top);
                context.lineTo(x, canvasHeight);
                context.stroke();
            }
            if (day.getDate() === 1 || index === 0) {
                context.fillStyle = "#334155";
                context.font = "700 10px Arial";
                context.fillText(new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric" }).format(day), x + 4, top + 21);
            }
        }

        let y = top + axisHeight;
        rows.forEach((row) => {
            const rowHeight = ganttExportRowHeight(row, defaultRowHeight);
            if (row.type === "supplier") {
                drawGanttSupplierTimelineCanvas(context, row, { y, labelWidth, rowHeight, dayWidth, model, canvasWidth });
                context.strokeStyle = "#e5eaf1";
                context.beginPath();
                context.moveTo(0, y + rowHeight);
                context.lineTo(canvasWidth, y + rowHeight);
                context.stroke();
                y += rowHeight;
                return;
            }

            context.fillStyle = row.type === "task" ? "#ffffff" : "#f9fbfd";
            context.fillRect(0, y, canvasWidth, rowHeight);
            context.strokeStyle = "#e5eaf1";
            context.beginPath();
            context.moveTo(0, y + rowHeight);
            context.lineTo(canvasWidth, y + rowHeight);
            context.stroke();
            const indent = 14 + (Number(row.depth || 0) * 14);
            context.fillStyle = row.overdue ? "#b42318" : "#172033";
            context.font = `${row.type === "task" ? "600" : "700"} 11px Arial`;
            context.fillText(truncateCanvasText(context, row.label, labelWidth - indent - 12), indent, y + 18);
            context.fillStyle = "#667085";
            context.font = "9px Arial";
            context.fillText(truncateCanvasText(context, `${row.status || ""} · ${formatDate(row.start)} → ${formatDate(row.end)}`, labelWidth - indent - 12), indent, y + 34);
            const rowStart = parseIsoDate(row.start);
            const rowEnd = parseIsoDate(row.end);
            if (rowStart && rowEnd) {
                const x = labelWidth + (dayDiff(model.minDate, rowStart) * dayWidth);
                const width = Math.max(4, (dayDiff(rowStart, rowEnd) + 1) * dayWidth);
                const progress = Math.max(0, Math.min(100, Number(row.progress || 0)));
                context.fillStyle = "#e2e8f0";
                context.beginPath();
                context.roundRect(x, y + 10, width, 24, 10);
                context.fill();
                context.fillStyle = row.overdue ? "#dc2626" : ganttProgressColor(progress);
                context.beginPath();
                context.roundRect(x, y + 10, Math.max(2, width * progress / 100), 24, 10);
                context.fill();
                if (width >= 42) {
                    context.fillStyle = "#ffffff";
                    context.font = "700 9px Arial";
                    context.fillText(`${progress.toFixed(0)}%`, x + 6, y + 26);
                }
            }
            y += rowHeight;
        });

        return canvas.toDataURL("image/jpeg", 0.82);
    }

    function statusEmailDefaultSubject(project) {
        const date = new Intl.DateTimeFormat("pt-BR").format(new Date());
        const ticket = String(project.ticket_tiflux || project.referencia || "TiFlux").trim() || "TiFlux";
        return `Status Report | ${ticket} | ${project.nome} | ${date}`;
    }

    function statusEmailNormalize(value) {
        return String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim()
            .toLowerCase();
    }

    function statusEmailHealthIcon(value) {
        const health = statusEmailNormalize(value);
        if (health.includes("critic") || health.includes("risco") || health.includes("atras")) return "🔴";
        if (health.includes("atenc")) return "🟠";
        return "🟢";
    }

    function statusEmailUniqueAddresses(values) {
        const result = [];
        const seen = new Set();
        (values || []).forEach((value) => {
            String(value || "").split(/[;,\n]+/).forEach((item) => {
                const email = item.trim().toLowerCase();
                if (!email || seen.has(email)) return;
                seen.add(email);
                result.push(email);
            });
        });
        return result;
    }

    function statusEmailCurrentReading(project, atrasadas, etapa) {
        const progresso = Number(project.progresso || 0);
        const esperado = Number(project.progresso_esperado || 0);
        const diferencaEsperada = esperado > 0 ? esperado - progresso : 0;
        const saude = project.situacao_nome || project.saude_nome || "—";
        const motivoSaude = String(project.saude_motivo || "").trim().replace(/\.$/, "");
        const saudeNormalizada = statusEmailNormalize(saude);
        const etapaTexto = String(etapa || "Não definida").trim();
        const etapaMatch = etapaTexto.match(/^(Sprint\s+\d+)\s*[—–-]\s*(.+)$/i);
        const etapaGerencial = etapaMatch ? `${etapaMatch[1]} (${etapaMatch[2]})` : etapaTexto;
        const homologacao = formatDate(project.data_homologacao_prevista);
        const goLiveValor = projectGoLiveValue(project);
        const goLive = project.tem_cslog && !goLiveValor ? "aguardando confirmação da CSLOG" : formatDate(goLiveValor);
        const conclusao = formatDate(project.data_fim_prevista);
        const hoje = parseIsoDate(ganttDateKey(new Date()));
        const homologacaoData = parseIsoDate(project.data_homologacao_prevista);
        const goLiveData = parseIsoDate(goLiveValor);
        const conclusaoData = parseIsoDate(project.data_fim_prevista);
        const homologacaoVencida = Boolean(hoje && homologacaoData && homologacaoData < hoje);
        const goLiveVencido = Boolean(hoje && goLiveData && goLiveData < hoje);
        const conclusaoVencida = Boolean(hoje && conclusaoData && conclusaoData < hoje);

        const abertas = (project.etapas || [])
            .flatMap((stage) => collectStageTasks(stage).map((task) => ({ task, stage })))
            .filter(({ task }) => !["concluida", "cancelada"].includes(String(task.status || "").toLowerCase()));

        let cslogEmAtraso = false;
        let entregaCslog = "—";
        let statusCslog = "";
        if (project.tem_cslog) {
            entregaCslog = formatDate(project.cslog_data_entrega_prevista);
            statusCslog = project.cslog_status_fornecedor_nome || "Aguardando atualização";
            const statusCslogNormalizado = statusEmailNormalize(statusCslog);
            const prazoCslog = parseIsoDate(project.cslog_data_entrega_prevista);
            cslogEmAtraso = ["atras", "venc", "critic", "risco"].some((token) => statusCslogNormalizado.includes(token))
                || Boolean(prazoCslog && hoje && prazoCslog < hoje && !project.cslog_data_entrega_real);
        }

        let leitura = "";

        if (project.tem_cslog && cslogEmAtraso) {
            const estadoSaude = saudeNormalizada.includes("critic")
                ? "Está crítico"
                : (saudeNormalizada.includes("atenc") ? "Está em atenção" : "Há risco para a entrega");
            leitura = `Projeto em ${etapaGerencial}, com Go Live previsto para ${goLive}. ${estadoSaude} porque a entrega da CSLOG está em atraso (prazo era ${entregaCslog}) e impacta diretamente a homologação (${homologacao}) e o Go Live (${goLive}) — esse desvio pressiona toda a reta final.`;
        } else {
            leitura = `Projeto em ${etapaGerencial}, com ${progresso.toFixed(0)}% concluído`;
            if (diferencaEsperada >= 15) {
                leitura += `, mas o avanço está ${diferencaEsperada.toFixed(0)} p.p. abaixo do esperado (${progresso.toFixed(0)}% realizado x ${esperado.toFixed(0)}% esperado).`;
            } else {
                leitura += `, com Go Live previsto para ${goLive}.`;
            }

            if (project.tem_cslog) {
                leitura += ` A dependência CSLOG está ${String(statusCslog || "em acompanhamento").toLowerCase()}, com entrega prevista para ${entregaCslog}; esse marco antecede diretamente a homologação (${homologacao}) e o Go Live (${goLive}).`;
            }

            const marcosVencidos = [];
            if (homologacaoVencida) marcosVencidos.push(`a homologação prevista para ${homologacao}`);
            if (goLiveVencido) marcosVencidos.push(`o Go Live de ${goLive}`);
            if (marcosVencidos.length === 2) {
                leitura += ` ${marcosVencidos[0].charAt(0).toUpperCase()}${marcosVencidos[0].slice(1)} e ${marcosVencidos[1]} já passaram`;
            } else if (marcosVencidos.length === 1) {
                leitura += ` ${marcosVencidos[0].charAt(0).toUpperCase()}${marcosVencidos[0].slice(1)} já passou`;
            }

            if (marcosVencidos.length && atrasadas > 0) {
                leitura += atrasadas === 1
                    ? ", enquanto ainda existe 1 tarefa vencida"
                    : `, enquanto ainda existem ${atrasadas} tarefas vencidas`;
                leitura += conclusaoVencida
                    ? `; a conclusão prevista para ${conclusao} também já venceu e o cronograma precisa ser revalidado.`
                    : `; com a conclusão prevista para ${conclusao}, essa combinação reduz a margem para absorver novos desvios e coloca a data final sob pressão.`;
            } else if (marcosVencidos.length) {
                leitura += conclusaoVencida
                    ? `; a conclusão prevista para ${conclusao} também já venceu e precisa ser revalidada.`
                    : `; a conclusão permanece prevista para ${conclusao} e deve ser protegida.`;
            } else if (atrasadas > 0) {
                leitura += atrasadas === 1
                    ? " Há 1 tarefa vencida que precisa de atenção imediata para não pressionar a data de conclusão."
                    : ` Há ${atrasadas} tarefas vencidas que precisam de atenção imediata para não pressionar a data de conclusão.`;
            } else if (motivoSaude && !saudeNormalizada.includes("normal") && statusEmailNormalize(motivoSaude) !== "sem riscos relevantes") {
                leitura += ` A saúde está ${saude.toLowerCase()} porque ${motivoSaude.charAt(0).toLowerCase()}${motivoSaude.slice(1)}.`;
            }
        }

        if (project.tem_cslog && cslogEmAtraso && atrasadas > 0) {
            leitura += atrasadas === 1
                ? " Há 1 tarefa vencida que precisa de atenção imediata para não pressionar ainda mais a data de conclusão."
                : ` Há ${atrasadas} tarefas vencidas que precisam de atenção imediata para não pressionar ainda mais a data de conclusão.`;
        }
        if (project.tem_cslog && cslogEmAtraso && diferencaEsperada >= 15) {
            leitura += ` O avanço também está ${diferencaEsperada.toFixed(0)} p.p. abaixo do esperado (${progresso.toFixed(0)}% realizado x ${esperado.toFixed(0)}% esperado).`;
        }

        let proximoPasso = "Próximo passo: confirmar o próximo marco do cronograma e manter a data de entrega protegida.";
        if (abertas.length) {
            const proxima = abertas[0];
            const nome = proxima.task.nome || "próxima atividade QORE";
            const prazoProxima = parseIsoDate(proxima.task.data_fim_prevista);
            const prazoVencido = Boolean(hoje && prazoProxima && prazoProxima < hoje);

            if (project.tem_cslog && cslogEmAtraso) {
                proximoPasso = `Próximo passo: ${nome}, com avanço condicionado à recuperação ou reconfirmação da entrega da CSLOG nas próximas 24–48h.`;
            } else if (prazoVencido || atrasadas > 0) {
                proximoPasso = `Próximo passo: concentrar a atuação em ${nome}, regularizar os itens vencidos e revalidar a data de conclusão do projeto.`;
            } else {
                const prazo = proxima.task.data_fim_prevista ? ` até ${formatDate(proxima.task.data_fim_prevista)}` : "";
                proximoPasso = `Próximo passo: avançar ${nome}${prazo}, protegendo o próximo marco do cronograma.`;
            }
        } else if (project.tem_cslog && cslogEmAtraso) {
            proximoPasso = "Próximo passo: recuperar ou reconfirmar a entrega da CSLOG nas próximas 24–48h e revalidar o impacto sobre homologação e Go Live.";
        }

        return [leitura, proximoPasso];
    }

    function statusEmailGeneratedAnalysis(project) {
        const etapa = project?.sprint_atual?.nome || project?.fase_atual?.nome || project?.etapa_atual?.nome || "Não definida";
        const atrasadas = (project?.etapas || [])
            .flatMap((stage) => collectStageTasks(stage))
            .filter((task) => task.atrasada && task.status !== "concluida")
            .length;
        return statusEmailCurrentReading(project, atrasadas, etapa).join("\n\n");
    }

    function statusEmailTimelinePreview(project) {
        if (!project.tem_cslog) return "";
        const eventos = [
            ["Ticket aberto", project.cslog_ticket_aberto_em],
            ["Escopo fechado", project.cslog_escopo_fechado_em],
            ["Orçamento", project.cslog_orcamento_recebido_em],
            ["Início da contagem", project.cslog_data_inicio],
            ["Entrega CSLOG", project.cslog_data_entrega_prevista],
            ["Homologação QORE", project.data_homologacao_prevista],
            ["Go Live QORE", projectGoLiveValue(project)],
        ].filter(([, value]) => value);
        if (!eventos.length) return "";
        return `
            <div class="projetos-status-email__timeline-preview">
                <span>Timeline QORE × CSLOG</span>
                <div class="projetos-status-email__timeline-items">
                    ${eventos.map(([label, value]) => `<div><small>${escapeHtml(label)}</small><strong>${escapeHtml(formatDate(value))}</strong></div>`).join("")}
                </div>
            </div>
        `;
    }

    function statusEmailPreviewHtml(project) {
        const etapa = project.sprint_atual?.nome || project.fase_atual?.nome || project.etapa_atual?.nome || "Não definida";
        const sugeridos = project.status_email_sugerido || {};
        const seguidores = statusEmailUniqueAddresses(sugeridos.seguidores || []);
        const atrasadas = (project.etapas || []).flatMap((stage) => collectStageTasks(stage)).filter((task) => task.atrasada && task.status !== "concluida").length;
        const responsaveis = project.responsavel_nomes || project.responsavel?.nome || project.owner?.nome || "—";
        const saude = project.situacao_nome || project.saude_nome || "—";
        const status = project.status_nome || "—";
        const ccAtual = statusEmailUniqueAddresses([String(el.statusEmailCc?.value || "")]);
        const ccFollowers = ccAtual.filter((email) => seguidores.includes(email)).length;
        return `
            <div class="projetos-status-email__preview-head">
                <span>Prévia do Status Report</span>
                <strong>${escapeHtml(project.codigo || "")} · TiFlux ${escapeHtml(project.ticket_tiflux || project.referencia || "—")}</strong>
            </div>
            <div class="projetos-status-email__executive-headline">
                <strong>${escapeHtml(project.codigo || "")} · ${escapeHtml(project.nome || "")} — ${escapeHtml(status)} (${Number(project.progresso || 0).toFixed(0)}%) · ${statusEmailHealthIcon(saude)} ${escapeHtml(saude)}</strong>
                <span>Leitura executiva do snapshot que será enviado.</span>
            </div>
            <div class="projetos-status-email__preview-grid">
                <div><span>Status</span><strong>${escapeHtml(status)}</strong></div>
                <div><span>Saúde</span><strong>${escapeHtml(saude)}</strong></div>
                <div><span>Progresso</span><strong>${Number(project.progresso || 0).toFixed(0)}%</strong></div>
                <div><span>Etapa atual</span><strong>${escapeHtml(etapa)}</strong></div>
                <div><span>Homologação</span><strong>${escapeHtml(formatDate(project.data_homologacao_prevista))}</strong></div>
                <div><span>Go Live</span><strong>${escapeHtml(project.tem_cslog && !projectGoLiveValue(project) ? "Aguardando CSLOG" : formatDate(projectGoLiveValue(project)))}</strong></div>
                <div><span>Conclusão</span><strong>${escapeHtml(formatDate(project.data_fim_prevista))}</strong></div>
                <div><span>Responsável(is)</span><strong>${escapeHtml(responsaveis)}</strong></div>
                ${project.tem_cslog ? `<div><span>CSLOG</span><strong>${escapeHtml(project.cslog_status_fornecedor_nome || "—")}</strong></div><div><span>Entrega CSLOG</span><strong>${escapeHtml(formatDate(project.cslog_data_entrega_prevista))}</strong></div>` : ""}
            </div>
            ${statusEmailTimelinePreview(project)}
            <p class="projetos-status-email__recipients-preview"><i class="fa fa-envelope"></i> Cc atual: ${ccAtual.length} endereço(s) · sistemas@treo.com.br incluído na sugestão inicial${seguidores.length ? ` · ${ccFollowers}/${seguidores.length} follower(s) do TiFlux presentes no Cc` : " · nenhum follower com e-mail identificado"}.</p>
            ${!(sugeridos.para || []).length ? `<p class="projetos-status-email__warning"><i class="fa fa-info-circle"></i> Este projeto ainda não possui requestor_email armazenado para o Stakeholder. Informe o destinatário manualmente ou sincronize o TiFlux novamente.</p>` : ""}
        `;
    }

    async function openStatusEmailModal() {
        const project = state.ganttProject || state.ganttRender?.project;
        if (!project || !el.statusEmailBackdrop) {
            toast("Selecione um projeto no Gantt antes de enviar o Status Report.", true);
            return;
        }
        // Um modal fora do elemento em Fullscreen nativo fica invisível no navegador.
        // Sai apenas do Fullscreen do Gantt e mantém o projeto/zoom/expansões intactos.
        if (document.fullscreenElement) {
            try {
                await document.exitFullscreen();
            } catch (error) {
                // A apresentação CSS continua funcional mesmo se o navegador negar a saída.
            }
        }
        const sugeridos = project.status_email_sugerido || { para: [], cc: [], seguidores: [] };
        const seguidores = statusEmailUniqueAddresses(sugeridos.seguidores || []);
        const ccInicial = statusEmailUniqueAddresses(["sistemas@treo.com.br", ...seguidores]);
        el.statusEmailPara.value = statusEmailUniqueAddresses(sugeridos.para || []).join("; ");
        el.statusEmailCc.value = ccInicial.join("; ");
        el.statusEmailAssunto.value = statusEmailDefaultSubject(project);
        el.statusEmailObservacao.value = statusEmailGeneratedAnalysis(project);
        el.statusEmailAnexarGantt.checked = true;
        el.statusEmailAnexarExcel.checked = true;
        el.statusEmailAtrasos.checked = true;
        el.statusEmailPreview.innerHTML = statusEmailPreviewHtml(project);
        el.statusEmailBackdrop.hidden = false;
        el.statusEmailBackdrop.classList.add("is-open");
        el.statusEmailBackdrop.setAttribute("aria-hidden", "false");
        window.setTimeout(() => el.statusEmailPara?.focus(), 20);
    }

    function closeStatusEmailModal() {
        if (!el.statusEmailBackdrop) return;
        el.statusEmailBackdrop.classList.remove("is-open");
        el.statusEmailBackdrop.setAttribute("aria-hidden", "true");
        el.statusEmailBackdrop.hidden = true;
    }

    async function sendStatusEmail(event) {
        event?.preventDefault();
        const project = state.ganttProject || state.ganttRender?.project;
        if (!project) return;
        const para = String(el.statusEmailPara?.value || "").trim();
        const assunto = String(el.statusEmailAssunto?.value || "").trim();
        if (!para) {
            toast("Informe ao menos um destinatário em Para.", true);
            el.statusEmailPara?.focus();
            return;
        }
        if (!assunto) {
            toast("Informe o assunto do Status Report.", true);
            el.statusEmailAssunto?.focus();
            return;
        }

        el.statusEmailSend.disabled = true;
        setLoading(true);
        try {
            let ganttDataUrl = "";
            if (el.statusEmailAnexarGantt?.checked) {
                ganttDataUrl = buildGanttEmailImageDataUrl();
            }
            const data = await request(`${api.projetos}${project.id}/`, {
                method: "POST",
                body: JSON.stringify({
                    acao: "enviar_status_email",
                    para,
                    cc: String(el.statusEmailCc?.value || "").trim(),
                    assunto,
                    observacao: String(el.statusEmailObservacao?.value || "").trim(),
                    incluir_atrasos: Boolean(el.statusEmailAtrasos?.checked),
                    incluir_seguidores: false,
                    anexar_gantt: Boolean(el.statusEmailAnexarGantt?.checked),
                    anexar_excel: Boolean(el.statusEmailAnexarExcel?.checked),
                    gantt_data_url: ganttDataUrl,
                }),
            });
            if (data.projeto) {
                state.ganttProject = data.projeto;
                state.ganttRender.project = data.projeto;
                const portfolio = state.projetos.find((item) => Number(item.id) === Number(data.projeto.id));
                if (portfolio) Object.assign(portfolio, data.projeto);
            }
            closeStatusEmailModal();
            toast(data.mensagem || "Status Report enviado com sucesso.");
        } catch (error) {
            toast(error.message || "Não foi possível enviar o Status Report.", true);
        } finally {
            el.statusEmailSend.disabled = false;
            setLoading(false);
        }
    }

    function exportGanttPng() {
        const model = state.ganttRender;
        if (!model) {
            toast("Selecione um projeto antes de exportar.", true);
            return;
        }

        const labelWidth = 360;
        const axisHeight = 72;
        const defaultRowHeight = 52;
        const rawWidth = labelWidth + model.trackWidth;
        const canvasWidth = Math.min(12000, Math.max(1400, rawWidth));
        const scaleX = (canvasWidth - labelWidth) / model.trackWidth;
        const exportedRows = visibleGanttRows();
        const rowsHeight = exportedRows.reduce((total, row) => total + ganttExportRowHeight(row, defaultRowHeight), 0);
        const canvasHeight = axisHeight + rowsHeight + 54;
        const canvas = document.createElement("canvas");
        const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
        canvas.width = Math.round(canvasWidth * pixelRatio);
        canvas.height = Math.round(canvasHeight * pixelRatio);
        const context = canvas.getContext("2d");
        context.scale(pixelRatio, pixelRatio);
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvasWidth, canvasHeight);

        context.fillStyle = "#0f172a";
        context.font = "700 18px Arial";
        context.fillText(`Gantt · ${model.project.codigo} · ${model.project.nome}`, 18, 27);
        context.fillStyle = "#64748b";
        context.font = "12px Arial";
        context.fillText(`${formatDate(ganttDateKey(model.minDate))} a ${formatDate(ganttDateKey(model.maxDate))} · Gerado em ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date())}`, 18, 47);

        const top = 54;
        context.fillStyle = "#f8fafc";
        context.fillRect(0, top, canvasWidth, axisHeight);
        context.strokeStyle = "#e2e8f0";
        context.beginPath();
        context.moveTo(labelWidth, top);
        context.lineTo(labelWidth, canvasHeight);
        context.stroke();

        const days = [];
        for (let index = 0; index < model.totalDays; index += 1) {
            const date = new Date(model.minDate.getTime());
            date.setDate(model.minDate.getDate() + index);
            days.push(date);
        }
        const exportedDayWidth = model.dayWidth * scaleX;
        days.forEach((day, index) => {
            const x = labelWidth + (index * exportedDayWidth);
            if (day.getDay() === 0 || day.getDay() === 6) {
                context.fillStyle = "#f1f5f9";
                context.fillRect(x, top, exportedDayWidth, canvasHeight - top);
            }
            context.strokeStyle = "#eef2f7";
            context.beginPath();
            context.moveTo(x, top);
            context.lineTo(x, canvasHeight);
            context.stroke();
            if (model.scale !== "year" && exportedDayWidth >= 10) {
                context.fillStyle = "#64748b";
                context.font = `${exportedDayWidth >= 24 ? 10 : 8}px Arial`;
                context.fillText(String(day.getDate()).padStart(2, "0"), x + 2, top + 58);
            }
            if (day.getDate() === 1 || index === 0) {
                context.fillStyle = "#334155";
                context.font = "700 11px Arial";
                context.fillText(new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric" }).format(day), x + 4, top + 22);
            }
        });

        const today = parseIsoDate(ganttDateKey(new Date()));
        if (today >= model.minDate && today <= model.maxDate) {
            const todayX = labelWidth + (dayDiff(model.minDate, today) * exportedDayWidth) + (exportedDayWidth / 2);
            context.strokeStyle = "#ef4444";
            context.lineWidth = 2;
            context.beginPath();
            context.moveTo(todayX, top);
            context.lineTo(todayX, canvasHeight - 16);
            context.stroke();
            context.fillStyle = "#ef4444";
            context.font = "700 10px Arial";
            context.fillText("HOJE", todayX + 4, top + 40);
            context.lineWidth = 1;
        }

        let y = top + axisHeight;
        exportedRows.forEach((row) => {
            const rowHeight = ganttExportRowHeight(row, defaultRowHeight);
            if (row.type === "supplier") {
                drawGanttSupplierTimelineCanvas(context, row, { y, labelWidth, rowHeight, dayWidth: exportedDayWidth, model, canvasWidth });
                context.strokeStyle = "#e2e8f0";
                context.beginPath();
                context.moveTo(0, y + rowHeight);
                context.lineTo(canvasWidth, y + rowHeight);
                context.stroke();
                y += rowHeight;
                return;
            }

            context.fillStyle = row.type === "task" ? "#ffffff" : "#f8fafc";
            context.fillRect(0, y, canvasWidth, rowHeight);
            context.strokeStyle = "#e2e8f0";
            context.beginPath();
            context.moveTo(0, y + rowHeight);
            context.lineTo(canvasWidth, y + rowHeight);
            context.stroke();
            context.fillStyle = row.overdue ? "#b91c1c" : "#172033";
            context.font = `${row.type === "task" ? "600" : "700"} 12px Arial`;
            const indent = row.type === "task" ? 34 : 16;
            context.fillText(truncateCanvasText(context, row.label, labelWidth - indent - 90), indent, y + 21);
            context.fillStyle = "#64748b";
            context.font = "10px Arial";
            context.fillText(truncateCanvasText(context, `${row.status || ""} · ${formatDate(row.start)} → ${formatDate(row.end)}`, labelWidth - indent - 18), indent, y + 39);

            (row.people || []).slice(0, 3).forEach((person, personIndex) => {
                const avatarX = labelWidth - 22 - (personIndex * 24);
                context.beginPath();
                context.fillStyle = person.externo ? "#7c3aed" : "#0f63dc";
                context.arc(avatarX, y + 22, 10, 0, Math.PI * 2);
                context.fill();
                context.fillStyle = "#ffffff";
                context.font = "700 7px Arial";
                context.textAlign = "center";
                context.fillText(initials(person.nome), avatarX, y + 24.5);
                context.textAlign = "left";
            });

            const startDate = parseIsoDate(row.start);
            const endDate = parseIsoDate(row.end);
            if (startDate && endDate) {
                const barX = labelWidth + (dayDiff(model.minDate, startDate) * exportedDayWidth);
                const barWidth = Math.max(4, (dayDiff(startDate, endDate) + 1) * exportedDayWidth);
                const radius = 13;
                const progressWidth = barWidth * Math.max(0, Math.min(100, row.progress)) / 100;
                context.save();
                context.beginPath();
                context.roundRect(barX, y + 13, barWidth, 26, radius);
                context.clip();
                context.fillStyle = "#e2e8f0";
                context.fillRect(barX, y + 13, barWidth, 26);
                if (row.type === "project") {
                    const gradient = context.createLinearGradient(barX, 0, barX + Math.max(progressWidth, 1), 0);
                    gradient.addColorStop(0, "#0f63dc");
                    gradient.addColorStop(.52, "#6366f1");
                    gradient.addColorStop(1, "#0ea5e9");
                    context.fillStyle = gradient;
                } else {
                    const situationColors = { "not-started": "#94a3b8", "on-track": "#2563eb", "due-soon": "#f59e0b", overdue: "#dc2626", completed: "#16a34a" };
                    context.fillStyle = situationColors[ganttSituation(row)] || ganttProgressColor(row.progress);
                }
                context.fillRect(barX, y + 13, progressWidth, 26);
                context.restore();
                context.fillStyle = "#ffffff";
                context.font = "700 10px Arial";
                context.fillText(`${Number(row.progress || 0).toFixed(0)}%`, barX + 6, y + 30);
            }
            y += rowHeight;
        });

        canvas.toBlob((blob) => {
            if (!blob) {
                toast("Não foi possível gerar a imagem.", true);
                return;
            }
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `gantt-${String(model.project.codigo || model.project.id).toLowerCase()}.png`;
            link.click();
            window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
            toast("Imagem do Gantt exportada com a timeline completa, incluindo dependências externas CSLOG.");
        }, "image/png");
    }

    async function toggleGanttFullscreen() {
        if (!el.ganttShell) return;
        try {
            if (document.fullscreenElement) {
                await document.exitFullscreen();
            } else if (el.ganttShell.requestFullscreen) {
                await el.ganttShell.requestFullscreen();
            } else {
                el.ganttShell.classList.toggle("is-presentation");
                syncGanttFullscreenButton(el.ganttShell.classList.contains("is-presentation"));
            }
        } catch (error) {
            el.ganttShell.classList.toggle("is-presentation");
            syncGanttFullscreenButton(el.ganttShell.classList.contains("is-presentation"));
        }
    }

    function syncGanttFullscreenButton(expanded) {
        if (!el.ganttFullscreen) return;
        el.ganttFullscreen.innerHTML = expanded
            ? `<i class="fa fa-compress"></i><span>Sair da tela cheia</span>`
            : `<i class="fa fa-expand"></i><span>Tela cheia</span>`;
        el.ganttFullscreen.setAttribute("aria-label", expanded ? "Sair da tela cheia" : "Expandir Gantt");
    }

    function kanbanTaskPeople(task) {
        const people = Array.isArray(task.responsaveis) && task.responsaveis.length
            ? task.responsaveis
            : (task.responsavel_principal ? [task.responsavel_principal] : []);
        return people.filter(Boolean);
    }

    function kanbanPeopleHtml(task) {
        const people = kanbanTaskPeople(task);
        if (!people.length) return `<span class="projetos-kanban-card__unassigned">Sem executor</span>`;
        return `
            <div class="projetos-kanban-card__executors" aria-label="Executores">
                <span class="projetos-kanban-card__avatars">
                    ${people.slice(0, 4).map((person) => `<span class="projetos-kanban-card__avatar ${person.externo ? "is-external" : ""}" title="${escapeHtml(personLabel(person))}">${escapeHtml(initials(person.nome))}</span>`).join("")}
                    ${people.length > 4 ? `<span class="projetos-kanban-card__avatar is-more">+${people.length - 4}</span>` : ""}
                </span>
                <span>${escapeHtml(people.length === 1 ? personLabel(people[0]) : `${people.length} executores`)}</span>
            </div>`;
    }

    function kanbanTaskStatusOptions(selected) {
        return [
            ["backlog", "Backlog"],
            ["em_andamento", "Em andamento"],
            ["aguardando", "Aguardando"],
            ["bloqueada", "Bloqueada"],
            ["concluida", "Concluída"],
        ].map(([value, label]) => `<option value="${value}" ${selected === value || (selected === "nao_iniciada" && value === "backlog") ? "selected" : ""}>${label}</option>`).join("");
    }

    function kanbanStageMatrix(stage) {
        if (!stage) return { title: "Sem Sprint/Fase", details: [] };
        const nameParts = String(stage.nome || "Sprint/Fase").split(/\s+—\s+/).map((item) => item.trim()).filter(Boolean);
        const title = nameParts.shift() || "Sprint/Fase";
        const details = [...new Set([stage.tipo_nome, stage.fase_pai?.nome, ...nameParts, ...String(stage.descricao || "").split(/\s+—\s+/)].map((item) => String(item || "").trim()).filter(Boolean).filter((item) => item !== title))];
        return { title, details };
    }

    function kanbanStageMatrixHtml(stage, compact = false) {
        const matrix = kanbanStageMatrix(stage);
        return `<span class="projetos-kanban-stage-matrix ${compact ? "is-compact" : ""}"><strong>${escapeHtml(matrix.title)}</strong>${matrix.details.map((detail) => `<small>${escapeHtml(detail)}</small>`).join("")}</span>`;
    }

    function kanbanTaskCard(task) {
        const checklistTotal = Number(task.subtarefas_total || 0);
        const completed = Number(task.subtarefas_concluidas || 0);
        return `
            <article class="projetos-kanban-card ${overdueInfo(task).late ? "is-overdue" : ""}" draggable="true" data-kanban-task-id="${task.id}" data-project-id="${task.projeto.id}">
                <div class="projetos-kanban-card__top">
                    <span class="projetos-kanban-card__code">${escapeHtml(task.projeto.codigo)}</span>
                    ${task.atrasada ? `<span class="projetos-kanban-card__late"><i class="fa fa-clock-o"></i>${Number(task.dias_atraso || 0)}d</span>` : ""}
                </div>
                ${kanbanStageMatrixHtml(task.etapa, true)}
                <h4>${escapeHtml(task.nome)}</h4>
                <small class="projetos-kanban-card__project">${escapeHtml(task.projeto.nome)}</small>
                ${progressHtml(task.progresso)}
                <div class="projetos-kanban-card__facts">
                    <span><i class="fa fa-calendar"></i>${formatDate(task.data_inicio)} → ${formatDate(task.data_fim_prevista)}</span>
                    <span><i class="fa fa-check-square-o"></i>${completed}/${checklistTotal} subtarefas</span>
                </div>
                ${task.status === "bloqueada" && task.motivo_bloqueio ? `<div class="projetos-kanban-card__block"><i class="fa fa-ban"></i>${escapeHtml(task.motivo_bloqueio)}</div>` : ""}
                <div class="projetos-kanban-card__footer">
                    ${kanbanPeopleHtml(task)}
                    <select class="projetos-kanban-card__status" data-kanban-status="${task.id}" aria-label="Status de ${escapeHtml(task.nome)}">
                        ${kanbanTaskStatusOptions(task.status)}
                    </select>
                </div>
            </article>`;
    }

    function filteredKanbanTasks(projects) {
        const visibleProjects = new Set(projects.map((project) => Number(project.id)));
        return state.kanbanTasks.filter((task) => {
            if (!task.projeto || !visibleProjects.has(Number(task.projeto.id))) return false;
            if (state.kanbanProjectId && Number(task.projeto.id) !== Number(state.kanbanProjectId)) return false;
            if (state.kanbanStageId && Number(task.etapa?.ordem || 0) !== Number(state.kanbanStageId)) return false;
            const people = kanbanTaskPeople(task);
            if (state.kanbanExecutorId && !people.some((person) => Number(person.id) === Number(state.kanbanExecutorId))) return false;
            if (state.kanbanMine && !people.some((person) => Number(person.usuario_id || person.id) === userId)) return false;
            if (state.kanbanOverdue && !task.atrasada) return false;
            return task.status !== "cancelada";
        });
    }

    function kanbanTaskListHtml(tasks) {
        return `
            <div class="projetos-kanban-list-wrap">
                <table class="projetos-kanban-list">
                    <thead><tr><th>Projeto</th><th>Etapa</th><th>Tarefa</th><th>Executores</th><th>Período</th><th>Subtarefas</th><th>Progresso</th><th>Status</th></tr></thead>
                    <tbody>
                        ${tasks.map((task) => {
                            const people = kanbanTaskPeople(task);
                            return `<tr class="${overdueInfo(task).late ? "is-overdue" : ""}" data-kanban-task-id="${task.id}" data-project-id="${task.projeto.id}">
                                <td><strong>${escapeHtml(task.projeto.codigo)}</strong><small>${escapeHtml(task.projeto.nome)}</small></td>
                                <td>${kanbanStageMatrixHtml(task.etapa)}</td>
                                <td><strong>${escapeHtml(task.nome)}</strong>${task.atrasada ? `<small class="is-late">${Number(task.dias_atraso || 0)} dias de atraso</small>` : ""}</td>
                                <td>${kanbanPeopleHtml(task)}</td>
                                <td>${formatDate(task.data_inicio)} → ${formatDate(task.data_fim_prevista)}</td>
                                <td>${Number(task.subtarefas_concluidas || 0)}/${Number(task.subtarefas_total || 0)}</td>
                                <td>${progressHtml(task.progresso)}</td>
                                <td><select class="projetos-kanban-card__status" data-kanban-status="${task.id}" aria-label="Status de ${escapeHtml(task.nome)}">${kanbanTaskStatusOptions(task.status)}</select></td>
                            </tr>`;
                        }).join("") || `<tr><td colspan="8" class="projetos-kanban-list__empty">Nenhuma tarefa encontrada.</td></tr>`}
                    </tbody>
                </table>
            </div>`;
    }

    function renderKanban(projects) {
        const columnCatalog = [
            { key: "backlog", title: "Backlog", statuses: ["backlog", "nao_iniciada"] },
            { key: "em_andamento", title: "Em andamento", statuses: ["em_andamento"] },
            { key: "aguardando", title: "Aguardando", statuses: ["aguardando"] },
            { key: "bloqueada", title: "Bloqueada", statuses: ["bloqueada"] },
            { key: "concluida", title: "Concluída", statuses: ["concluida"] },
        ];
        const columns = state.kanbanColumnOrder.map((key) => columnCatalog.find((column) => column.key === key)).filter(Boolean);
        if (state.kanbanProjectId && !projects.some((project) => Number(project.id) === Number(state.kanbanProjectId))) {
            state.kanbanProjectId = null;
            state.kanbanStageId = null;
        }
        const availableTasks = state.kanbanTasks.filter((task) => projects.some((project) => Number(project.id) === Number(task.projeto?.id)));
        const projectOptions = projects.map((project) => `<option value="${project.id}" ${Number(state.kanbanProjectId) === Number(project.id) ? "selected" : ""}>${escapeHtml(project.codigo)} · ${escapeHtml(project.nome)}</option>`).join("");
        const stages = [];
        availableTasks.forEach((task) => {
            if (task.etapa && !stages.some((stage) => Number(stage.ordem) === Number(task.etapa.ordem))) stages.push(task.etapa);
        });
        const people = [];
        availableTasks.forEach((task) => kanbanTaskPeople(task).forEach((person) => {
            if (!people.some((item) => Number(item.id) === Number(person.id))) people.push(person);
        }));
        if (state.kanbanStageId && !stages.some((stage) => Number(stage.ordem) === Number(state.kanbanStageId))) state.kanbanStageId = null;
        if (state.kanbanExecutorId && !people.some((person) => Number(person.id) === Number(state.kanbanExecutorId))) state.kanbanExecutorId = null;
        const tasks = filteredKanbanTasks(projects);

        el.kanban.innerHTML = `
            <div class="projetos-kanban-toolbar">
                <div class="projetos-kanban-toolbar__copy">
                    <strong>Quadro de execução</strong>
                    <span>${tasks.length} ${tasks.length === 1 ? "tarefa" : "tarefas"} visíveis</span>
                </div>
                <select class="ws-form-control" data-kanban-filter="project" aria-label="Filtrar por projeto">
                    <option value="">Todos os projetos</option>${projectOptions}
                </select>
                <select class="ws-form-control" data-kanban-filter="stage" aria-label="Filtrar por etapa">
                    <option value="">Todas as etapas</option>${stages.sort((a, b) => Number(a.ordem) - Number(b.ordem)).map((stage) => `<option value="${stage.ordem}" ${Number(state.kanbanStageId) === Number(stage.ordem) ? "selected" : ""}>${escapeHtml(kanbanStageMatrix(stage).title)}</option>`).join("")}
                </select>
                <select class="ws-form-control" data-kanban-filter="executor" aria-label="Filtrar por executor">
                    <option value="">Todos os executores</option>${people.sort((a, b) => a.nome.localeCompare(b.nome)).map((person) => `<option value="${person.id}" ${Number(state.kanbanExecutorId) === Number(person.id) ? "selected" : ""}>${escapeHtml(personLabel(person))}</option>`).join("")}
                </select>
                <label class="projetos-kanban-toggle"><input type="checkbox" data-kanban-filter="mine" ${state.kanbanMine ? "checked" : ""}> Minhas tarefas</label>
                <label class="projetos-kanban-toggle"><input type="checkbox" data-kanban-filter="overdue" ${state.kanbanOverdue ? "checked" : ""}> Atrasadas</label>
                <div class="projetos-kanban-mode" role="group" aria-label="Formato do Kanban">
                    <button type="button" class="${state.kanbanMode === "board" ? "is-active" : ""}" data-kanban-mode="board"><i class="fa fa-columns"></i> Quadro</button>
                    <button type="button" class="${state.kanbanMode === "list" ? "is-active" : ""}" data-kanban-mode="list"><i class="fa fa-list"></i> Lista</button>
                </div>
            </div>
            ${state.kanbanMode === "list" ? kanbanTaskListHtml(tasks) : `<div class="projetos-kanban__board">
                ${columns.map((column) => {
                    const items = tasks.filter((task) => column.statuses.includes(task.status));
                    return `
                        <section class="projetos-kanban__column ${column.key === "concluida" && state.kanbanCompletedCollapsed ? "is-collapsed" : ""}" data-kanban-column="${column.key}">
                            <header class="projetos-kanban__header" draggable="true" data-kanban-column-drag="${column.key}" title="Arraste para reorganizar a coluna">
                                <i class="fa fa-arrows projetos-kanban__column-handle" aria-hidden="true"></i>
                                <strong>${column.title}</strong><span>${items.length}</span>
                                ${column.key === "concluida" ? `<button type="button" class="projetos-kanban__collapse" data-kanban-collapse-completed aria-label="${state.kanbanCompletedCollapsed ? "Expandir" : "Recolher"} coluna Concluída"><i class="fa ${state.kanbanCompletedCollapsed ? "fa-angle-double-left" : "fa-angle-double-right"}"></i></button>` : ""}
                            </header>
                            <div class="projetos-kanban__body" data-kanban-drop="${column.key}">
                                ${items.map(kanbanTaskCard).join("") || `<div class="projetos-kanban__empty-column">Arraste uma tarefa para cá</div>`}
                            </div>
                        </section>`;
                }).join("")}
            </div>`}`;

        bindKanbanEvents(projects);
    }

    function bindKanbanEvents(projects) {
        el.kanban.querySelector("[data-kanban-collapse-completed]")?.addEventListener("click", (event) => {
            event.stopPropagation();
            state.kanbanCompletedCollapsed = !state.kanbanCompletedCollapsed;
            window.localStorage.setItem("projetosKanbanCompletedCollapsed", state.kanbanCompletedCollapsed ? "1" : "0");
            renderKanban(projects);
        });

        let draggedColumn = "";
        el.kanban.querySelectorAll("[data-kanban-column-drag]").forEach((header) => {
            header.addEventListener("dragstart", (event) => {
                draggedColumn = header.dataset.kanbanColumnDrag;
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("application/x-projetos-kanban-column", draggedColumn);
                header.closest(".projetos-kanban__column")?.classList.add("is-column-dragging");
            });
            header.addEventListener("dragend", () => {
                draggedColumn = "";
                el.kanban.querySelectorAll(".is-column-dragging, .is-column-drag-over").forEach((node) => node.classList.remove("is-column-dragging", "is-column-drag-over"));
            });
        });
        el.kanban.querySelectorAll("[data-kanban-column]").forEach((column) => {
            column.addEventListener("dragover", (event) => {
                if (!draggedColumn) return;
                event.preventDefault();
                column.classList.add("is-column-drag-over");
            });
            column.addEventListener("dragleave", () => column.classList.remove("is-column-drag-over"));
            column.addEventListener("drop", (event) => {
                if (!draggedColumn) return;
                event.preventDefault();
                const target = column.dataset.kanbanColumn;
                if (target && target !== draggedColumn) {
                    const order = state.kanbanColumnOrder.filter((key) => key !== draggedColumn);
                    order.splice(order.indexOf(target), 0, draggedColumn);
                    state.kanbanColumnOrder = order;
                    window.localStorage.setItem("projetosKanbanColumnOrder", JSON.stringify(order));
                    renderKanban(projects);
                }
            });
        });

        el.kanban.querySelectorAll("[data-kanban-mode]").forEach((button) => {
            button.addEventListener("click", () => {
                state.kanbanMode = button.dataset.kanbanMode || "board";
                renderKanban(projects);
            });
        });
        el.kanban.querySelectorAll("[data-kanban-filter]").forEach((field) => {
            field.addEventListener("change", () => {
                const filter = field.dataset.kanbanFilter;
                if (filter === "project") {
                    state.kanbanProjectId = Number(field.value || 0) || null;
                    state.kanbanStageId = null;
                } else if (filter === "stage") state.kanbanStageId = Number(field.value || 0) || null;
                else if (filter === "executor") state.kanbanExecutorId = Number(field.value || 0) || null;
                else if (filter === "mine") state.kanbanMine = field.checked;
                else if (filter === "overdue") state.kanbanOverdue = field.checked;
                renderKanban(projects);
            });
        });

        el.kanban.querySelectorAll("[data-kanban-task-id]").forEach((card) => {
            card.addEventListener("click", (event) => {
                if (event.target.closest("select, button, input, label")) return;
                const task = state.kanbanTasks.find((item) => Number(item.id) === Number(card.dataset.kanbanTaskId));
                openProject(Number(card.dataset.projectId), null, {
                    stageId: task?.etapa?.id || null,
                    taskId: task?.id || null,
                });
            });
            card.addEventListener("dragstart", (event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", card.dataset.kanbanTaskId);
                card.classList.add("is-dragging");
            });
            card.addEventListener("dragend", () => {
                card.classList.remove("is-dragging");
                el.kanban.querySelectorAll(".is-drag-over").forEach((node) => node.classList.remove("is-drag-over"));
            });
        });

        el.kanban.querySelectorAll("[data-kanban-drop]").forEach((dropzone) => {
            dropzone.addEventListener("dragover", (event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                dropzone.classList.add("is-drag-over");
            });
            dropzone.addEventListener("dragleave", () => dropzone.classList.remove("is-drag-over"));
            dropzone.addEventListener("drop", (event) => {
                event.preventDefault();
                dropzone.classList.remove("is-drag-over");
                moveKanbanTask(Number(event.dataTransfer.getData("text/plain")), dropzone.dataset.kanbanDrop);
            });
        });

        el.kanban.querySelectorAll("[data-kanban-status]").forEach((select) => {
            select.addEventListener("change", () => moveKanbanTask(Number(select.dataset.kanbanStatus), select.value));
        });
    }

    async function moveKanbanTask(taskId, status) {
        const task = state.kanbanTasks.find((item) => Number(item.id) === Number(taskId));
        if (!task || !status || task.status === status || (task.status === "nao_iniciada" && status === "backlog")) return;
        const payload = { status };
        if (status === "bloqueada") {
            const reason = window.prompt("Informe o problema ou impedimento que bloqueia esta tarefa:", task.motivo_bloqueio || "");
            if (!String(reason || "").trim()) {
                toast("Para bloquear a tarefa, informe o impedimento.", true);
                renderKanban(filteredProjects());
                return;
            }
            payload.motivo_bloqueio = String(reason).trim();
        }

        setLoading(true);
        try {
            const data = await request(taskApiUrl(taskId), {
                method: "PATCH",
                body: JSON.stringify(payload),
            });
            if (data.projeto) {
                if (state.projetoAberto && Number(state.projetoAberto.id) === Number(data.projeto.id)) renderProjectDetail(data.projeto);
                if (Number(state.ganttProjectId) === Number(data.projeto.id)) state.ganttProject = data.projeto;
            }
            await loadProjects(true);
            await loadMeuDia(true);
            toast(`${task.nome}: status atualizado e cronograma sincronizado.`);
        } catch (error) {
            renderKanban(filteredProjects());
            toast(error.message, true);
        } finally {
            setLoading(false);
        }
    }

    const chartColors = ["#1672f3", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2", "#64748b", "#db2777", "#65a30d", "#ea580c"];

    function chartCount(items, valueResolver) {
        const counts = new Map();
        items.forEach((item) => {
            const values = valueResolver(item);
            (Array.isArray(values) ? values : [values]).filter(Boolean).forEach((value) => {
                const label = String(value).trim() || "Não definido";
                counts.set(label, (counts.get(label) || 0) + 1);
            });
        });
        return [...counts.entries()]
            .map(([label, value]) => ({ label, value }))
            .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "pt-BR"));
    }

    function chartCard(title, subtitle, content, extraClass) {
        return `<section class="projetos-chart-card ${extraClass || ""}">
            <header><div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(subtitle)}</small></div></header>
            <div class="projetos-chart-card__body">${content}</div>
        </section>`;
    }

    function chartBars(data, emptyText) {
        if (!data.length) return `<div class="projetos-chart-empty">${escapeHtml(emptyText || "Sem dados para exibir.")}</div>`;
        const max = Math.max(...data.map((item) => item.value), 1);
        return `<div class="projetos-chart-bars">${data.slice(0, 10).map((item, index) => `
            <div class="projetos-chart-bar" title="${escapeHtml(`${item.label}: ${item.value}`)}">
                <div class="projetos-chart-bar__label"><span>${escapeHtml(item.label)}</span><b>${item.value}</b></div>
                <div class="projetos-chart-bar__track"><i style="width:${Math.max(3, (item.value / max) * 100)}%;--chart-color:${chartColors[index % chartColors.length]}"></i></div>
            </div>`).join("")}</div>`;
    }

    function chartDonut(data, centerLabel) {
        if (!data.length) return `<div class="projetos-chart-empty">Sem dados para exibir.</div>`;
        const total = data.reduce((sum, item) => sum + item.value, 0) || 1;
        let cursor = 0;
        const stops = data.map((item, index) => {
            const start = cursor;
            cursor += (item.value / total) * 100;
            return `${chartColors[index % chartColors.length]} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
        }).join(", ");
        return `<div class="projetos-chart-donut-wrap">
            <div class="projetos-chart-donut" style="background:conic-gradient(${stops})"><span><b>${total}</b><small>${escapeHtml(centerLabel || "projetos")}</small></span></div>
            <div class="projetos-chart-legend">${data.map((item, index) => `<div title="${escapeHtml(`${item.label}: ${item.value}`)}"><i style="background:${chartColors[index % chartColors.length]}"></i><span>${escapeHtml(item.label)}</span><b>${item.value}</b></div>`).join("")}</div>
        </div>`;
    }

    function chartSeries(periods, counts) {
        return periods.map((period) => ({ label: period.label, value: counts.get(period.key) || 0 }));
    }

    function chartLine(data) {
        if (!data.length) return `<div class="projetos-chart-empty">Sem datas de cadastro para exibir.</div>`;
        const width = 760;
        const height = 230;
        const padding = { top: 20, right: 18, bottom: 42, left: 38 };
        const innerWidth = width - padding.left - padding.right;
        const innerHeight = height - padding.top - padding.bottom;
        const max = Math.max(1, ...data.map((item) => item.value));
        const x = (index) => padding.left + (data.length === 1 ? innerWidth / 2 : (index / (data.length - 1)) * innerWidth);
        const y = (value) => padding.top + innerHeight - ((value / max) * innerHeight);
        const points = data.map((item, index) => `${x(index)},${y(item.value)}`).join(" ");
        const labelStep = Math.max(1, Math.ceil(data.length / 7));
        const grid = [0, .25, .5, .75, 1].map((ratio) => {
            const gy = padding.top + (innerHeight * ratio);
            const value = Math.round(max * (1 - ratio));
            return `<line x1="${padding.left}" y1="${gy}" x2="${width - padding.right}" y2="${gy}"></line><text x="${padding.left - 7}" y="${gy + 4}" text-anchor="end">${value}</text>`;
        }).join("");
        return `<div class="projetos-chart-line-wrap"><svg class="projetos-chart-line" viewBox="0 0 ${width} ${height}" role="img" aria-label="Evolução de entrada de projetos">
            <g class="projetos-chart-line__grid">${grid}</g>
            <polyline class="projetos-chart-line__area" points="${padding.left},${padding.top + innerHeight} ${points} ${width - padding.right},${padding.top + innerHeight}"></polyline>
            <polyline class="projetos-chart-line__stroke" points="${points}"></polyline>
            ${data.map((item, index) => `<g class="projetos-chart-line__point"><circle cx="${x(index)}" cy="${y(item.value)}" r="4"><title>${escapeHtml(`${item.label}: ${item.value}`)}</title></circle>${index % labelStep === 0 || index === data.length - 1 ? `<text x="${x(index)}" y="${height - 14}" text-anchor="middle">${escapeHtml(item.label)}</text>` : ""}</g>`).join("")}
        </svg></div>`;
    }

    function chartItemSituation(item) {
        if (item.completed) return "completed";
        if (item.overdue) return "overdue";
        return "in-progress";
    }

    function chartTimelineItems(projects) {
        const visibleIds = new Set(projects.map((project) => Number(project.id)));
        const today = ganttDateKey(new Date());
        const projectItems = projects.map((project) => ({
            type: "project",
            projectId: Number(project.id),
            created: project.criado_em,
            start: project.data_inicio,
            due: project.data_fim_prevista,
            completedAt: project.data_conclusao,
            completed: project.status === "concluido" || Number(project.progresso || 0) >= 100,
            overdue: project.situacao === "atrasado" || Boolean(project.data_fim_prevista && project.data_fim_prevista < today && project.status !== "concluido"),
        }));
        const stageItems = (state.chartStages || []).filter((stage) => visibleIds.has(Number(stage.projeto_id))).map((stage) => ({
            type: "stage",
            projectId: Number(stage.projeto_id),
            created: stage.criado_em,
            start: stage.data_inicio,
            due: stage.data_fim_prevista,
            completedAt: stage.data_conclusao,
            completed: stage.status === "concluida" || Number(stage.progresso || 0) >= 100,
            overdue: Boolean(stage.atrasada),
        }));
        const taskItems = [];
        const subtaskItems = [];
        (state.kanbanTasks || []).filter((task) => visibleIds.has(Number(task.projeto?.id))).forEach((task) => {
            taskItems.push({
                type: "task",
                projectId: Number(task.projeto?.id),
                created: task.criado_em,
                start: task.data_inicio,
                due: task.data_fim_prevista,
                completedAt: task.data_conclusao,
                completed: task.status === "concluida" || Number(task.progresso || 0) >= 100,
                overdue: Boolean(task.atrasada),
            });
            (task.subtarefas || []).forEach((subtask) => subtaskItems.push({
                type: "subtask",
                projectId: Number(task.projeto?.id),
                created: subtask.criado_em,
                start: subtask.data_inicio,
                due: subtask.data_fim_prevista,
                completedAt: subtask.concluido_em,
                completed: Boolean(subtask.concluido),
                overdue: Boolean(subtask.atrasada),
            }));
        });
        return { project: projectItems, stage: stageItems, task: taskItems, subtask: subtaskItems };
    }

    function chartEntryData(projects) {
        const filters = state.chartFilters;
        const itemsByType = chartTimelineItems(projects);
        const dateField = ({ created: "created", start: "start", completed: "completedAt", due: "due" })[filters.event] || "created";
        const items = (itemsByType[filters.item] || []).filter((item) => (
            filters.situation === "all" || chartItemSituation(item) === filters.situation
        ));
        const counts = new Map();
        const validDates = [];
        items.forEach((item) => {
            const raw = String(item[dateField] || "").slice(0, 10);
            if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return;
            validDates.push(raw);
            const key = filters.granularity === "month" ? raw.slice(0, 7) : raw;
            counts.set(key, (counts.get(key) || 0) + 1);
        });
        validDates.sort();
        const anchor = parseIsoDate(validDates[validDates.length - 1] || ganttDateKey(new Date()));
        const periods = [];
        if (filters.granularity === "month") {
            const cursor = new Date(anchor.getFullYear(), anchor.getMonth() - 11, 1, 12);
            for (let index = 0; index < 12; index += 1) {
                const date = new Date(cursor.getFullYear(), cursor.getMonth() + index, 1, 12);
                periods.push({ key: ganttDateKey(date).slice(0, 7), label: new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" }).format(date).replace(" de ", "/") });
            }
        } else {
            for (let offset = 29; offset >= 0; offset -= 1) {
                const date = new Date(anchor.getTime());
                date.setDate(anchor.getDate() - offset);
                periods.push({ key: ganttDateKey(date), label: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(date) });
            }
        }
        return { data: chartSeries(periods, counts), total: validDates.length };
    }

    function chartFilterOption(value, label, selected) {
        return `<option value="${value}" ${value === selected ? "selected" : ""}>${escapeHtml(label)}</option>`;
    }

    function chartTimelineCard(entries) {
        const filters = state.chartFilters;
        const eventLabels = { created: "cadastros", start: "inícios", completed: "conclusões", due: "vencimentos" };
        const itemLabels = { project: "projetos", stage: "etapas", task: "tarefas", subtask: "subtarefas" };
        const situationLabels = { all: "todas as situações", completed: "concluídos", "in-progress": "em andamento", overdue: "em atraso" };
        return `<section class="projetos-chart-card is-full projetos-chart-timeline">
            <header class="projetos-chart-timeline__header">
                <div><strong>Evolução do cronograma</strong><small>${entries.total} ${eventLabels[filters.event]} de ${itemLabels[filters.item]} · ${situationLabels[filters.situation]}</small></div>
                <div class="projetos-chart-filters">
                    <label><span>Período</span><select data-chart-filter="granularity">${chartFilterOption("month", "Por mês", filters.granularity)}${chartFilterOption("day", "Por dia", filters.granularity)}</select></label>
                    <label><span>Evento</span><select data-chart-filter="event">${chartFilterOption("created", "Cadastro", filters.event)}${chartFilterOption("start", "Data de início", filters.event)}${chartFilterOption("completed", "Conclusão", filters.event)}${chartFilterOption("due", "Vencimento", filters.event)}</select></label>
                    <label><span>Item</span><select data-chart-filter="item">${chartFilterOption("project", "Projetos", filters.item)}${chartFilterOption("stage", "Etapas", filters.item)}${chartFilterOption("task", "Tarefas", filters.item)}${chartFilterOption("subtask", "Subtarefas", filters.item)}</select></label>
                    <label><span>Situação</span><select data-chart-filter="situation">${chartFilterOption("all", "Todos", filters.situation)}${chartFilterOption("completed", "Concluído", filters.situation)}${chartFilterOption("in-progress", "Em andamento", filters.situation)}${chartFilterOption("overdue", "Em atraso", filters.situation)}</select></label>
                </div>
            </header>
            <div class="projetos-chart-card__body">${chartLine(entries.data)}</div>
        </section>`;
    }

    function renderCharts(projects) {
        if (!el.charts) return;
        const total = projects.length;
        const active = projects.filter((project) => !["rascunho", "cancelado", "concluido"].includes(project.status)).length;
        const risk = projects.filter((project) => ["em_risco", "atrasado", "atencao"].includes(project.situacao)).length;
        const average = total ? projects.reduce((sum, project) => sum + Number(project.progresso || 0), 0) / total : 0;
        const statuses = chartCount(projects, (project) => project.status_nome || project.status || "Não definido");
        const companies = chartCount(projects, (project) => project.empresa?.nome || "Não definida");
        const stakeholders = chartCount(projects, (project) => project.stakeholder?.nome || "Não definido");
        const responsibles = chartCount(projects, (project) => (project.responsaveis || []).length ? project.responsaveis.map((person) => person.nome) : ["Não definido"]);
        const health = chartCount(projects, (project) => project.situacao_nome || project.saude_nome || project.situacao || "Não definida");
        const entries = chartEntryData(projects);

        el.charts.innerHTML = `<div class="projetos-charts-summary">
            <article><span>Total de projetos</span><strong>${total}</strong><small>Portfólio filtrado</small></article>
            <article><span>Projetos ativos</span><strong>${active}</strong><small>Em execução</small></article>
            <article class="is-risk"><span>Com risco/atenção</span><strong>${risk}</strong><small>Exigem acompanhamento</small></article>
            <article><span>Progresso médio</span><strong>${average.toFixed(0)}%</strong><small>Média dos projetos</small></article>
        </div>
        <div class="projetos-charts-grid">
            ${chartCard("Projetos por status", "Distribuição do portfólio filtrado", chartDonut(statuses, "projetos"))}
            ${chartCard("Risco e saúde", "Situação atual dos projetos", chartDonut(health, "projetos"))}
            ${chartCard("Projetos por empresa", "Ranking das dez maiores concentrações", chartBars(companies), "is-ranking")}
            ${chartCard("Projetos por stakeholder", "Quantidade vinculada a cada stakeholder", chartBars(stakeholders), "is-ranking")}
            ${chartCard("Projetos por responsável", "Um projeto pode contar para mais de um responsável", chartBars(responsibles), "is-ranking")}
            ${chartTimelineCard(entries)}
        </div>`;
    }

    function taskIsCompleted(task) {
        return ["concluida", "concluido", "cancelada", "cancelado"].includes(String(task?.status || "").toLowerCase()) || Number(task?.progresso || 0) >= 100;
    }

    function subtaskIsCompleted(subtask) {
        return Boolean(subtask?.concluido) || ["concluida", "concluido", "cancelada", "cancelado"].includes(String(subtask?.status || "").toLowerCase()) || Number(subtask?.progresso || 0) >= 100;
    }

    function operationalPeopleHtml(people) {
        const valid = (people || []).filter((person) => person && person.nome);
        if (!valid.length) return `<span class="projetos-kanban-card__unassigned">Sem executor</span>`;
        return `<div class="projetos-kanban-card__executors"><span class="projetos-kanban-card__avatars">${valid.slice(0, 4).map((person) => `<span class="projetos-kanban-card__avatar ${person.externo ? "is-external" : ""}" title="${escapeHtml(personLabel(person))}">${escapeHtml(initials(person.nome))}</span>`).join("")}${valid.length > 4 ? `<span class="projetos-kanban-card__avatar is-more">+${valid.length - 4}</span>` : ""}</span><span>${escapeHtml(valid.length === 1 ? personLabel(valid[0]) : `${valid.length} executores`)}</span></div>`;
    }

    function criticalOperationalItems() {
        const today = dateOnlyDayNumber(ganttDateKey(new Date()));
        const items = [];
        (state.kanbanTasks || []).forEach((task) => {
            const due = dateOnlyDayNumber(task.data_fim_prevista);
            const taskLate = !taskIsCompleted(task) && due != null && today != null && due < today;
            if (taskLate) {
                items.push({
                    project: task.projeto || {}, stage: task.etapa || null, taskId: Number(task.id || 0),
                    type: "Tarefa", name: task.nome || "Tarefa", people: kanbanTaskPeople(task),
                    start: task.data_inicio, due: task.data_fim_prevista, progress: Number(task.progresso || 0),
                    status: task.status_nome || task.status || "Pendente", lateDays: Number(task.dias_atraso || Math.max(1, today - due)),
                });
            }
            (task.subtarefas || task.checklist || []).forEach((subtask) => {
                const subDue = dateOnlyDayNumber(subtask.data_fim_prevista || subtask.prazo);
                const subLate = !subtaskIsCompleted(subtask) && subDue != null && today != null && subDue < today;
                if (!subLate) return;
                const people = [subtask.responsavel_especifico, subtask.responsavel, subtask.executor].filter(Boolean);
                items.push({
                    project: task.projeto || {}, stage: task.etapa || null, taskId: Number(task.id || 0), subtaskId: Number(subtask.id || 0),
                    type: "Subtarefa", name: subtask.nome || subtask.descricao || "Subtarefa", people,
                    start: subtask.data_inicio || task.data_inicio, due: subtask.data_fim_prevista || subtask.prazo,
                    progress: subtaskIsCompleted(subtask) ? 100 : Number(subtask.progresso || 0),
                    status: subtask.status_nome || (subtask.concluido ? "Concluída" : "Pendente"), lateDays: Math.max(1, today - subDue),
                });
            });
        });
        return items.sort((a, b) => Number(b.lateDays || 0) - Number(a.lateDays || 0) || String(a.due || "").localeCompare(String(b.due || "")));
    }

    function meuDiaOperationalItems() {
        if (!state.meuDia) return [];
        const buckets = [
            ["vencem_hoje", "Vence hoje"],
            ["atrasadas", "Atrasada"],
            ["iniciam_hoje", "Inicia hoje"],
            ["marcos_hoje", "Marco hoje"],
        ];
        const result = [];
        const seen = new Set();
        buckets.forEach(([key, reason]) => {
            (state.meuDia[key] || []).forEach((item) => {
                const project = item.projeto || state.projetos.find((p) => Number(p.id) === Number(item.projeto_id)) || {};
                const itemTypeKey = String(item.tipo || item.tipo_nome || "").toLowerCase();
                const taskId = Number(item.tarefa_id || ((!item.subtarefa_id && itemTypeKey.includes("tarefa")) ? item.id : 0) || 0);
                const sourceTask = state.kanbanTasks.find((task) => Number(task.id) === taskId) || null;
                const type = item.tipo_nome || item.tipo || (item.subtarefa_id ? "Subtarefa" : (taskId ? "Tarefa" : "Projeto"));
                const identity = `${Number(project.id || item.projeto_id || 0)}:${String(type).toLowerCase()}:${Number(item.subtarefa_id || item.id || 0)}`;
                if (seen.has(identity)) return;
                seen.add(identity);
                const people = Array.isArray(item.responsaveis) ? item.responsaveis : [item.responsavel_especifico, item.responsavel, item.executor].filter(Boolean);
                result.push({
                    project,
                    stage: item.etapa || sourceTask?.etapa || null,
                    taskId: taskId || Number(sourceTask?.id || 0),
                    subtaskId: Number(item.subtarefa_id || 0),
                    type,
                    name: item.nome || item.descricao || sourceTask?.nome || "Item do dia",
                    people: people.length ? people : (sourceTask ? kanbanTaskPeople(sourceTask) : []),
                    start: item.data_inicio || sourceTask?.data_inicio || "",
                    due: item.data_fim_prevista || item.prazo || sourceTask?.data_fim_prevista || "",
                    progress: Number(item.progresso ?? sourceTask?.progresso ?? 0),
                    status: item.status_nome || reason,
                    reason,
                    lateDays: Number(item.dias_atraso || 0),
                });
            });
        });
        return result;
    }

    function operationalListHtml(items, emptyText) {
        return `<div class="projetos-kanban-list-wrap projetos-operational-list-wrap">
            <table class="projetos-kanban-list projetos-operational-list">
                <thead><tr><th>Projeto</th><th>Etapa</th><th>Item</th><th>Tipo</th><th>Responsáveis</th><th>Período</th><th>Progresso</th><th>Situação</th></tr></thead>
                <tbody>${items.map((item) => {
                    const project = item.project || {};
                    const late = Number(item.lateDays || 0) > 0;
                    return `<tr class="${late ? "is-overdue" : ""}" data-operational-project-id="${Number(project.id || 0)}" data-operational-task-id="${Number(item.taskId || 0)}">
                        <td><strong>${escapeHtml(project.codigo || "—")}</strong><small>${escapeHtml(project.nome || "Projeto")}</small></td>
                        <td>${item.stage ? kanbanStageMatrixHtml(item.stage) : `<span class="projetos-kanban-stage-matrix"><strong>—</strong></span>`}</td>
                        <td><strong>${escapeHtml(item.name || "—")}</strong>${late ? `<small class="is-late">${Number(item.lateDays || 0)} ${Number(item.lateDays || 0) === 1 ? "dia" : "dias"} de atraso</small>` : (item.reason ? `<small>${escapeHtml(item.reason)}</small>` : "")}</td>
                        <td><span class="projetos-operational-type">${escapeHtml(item.type || "Item")}</span></td>
                        <td>${operationalPeopleHtml(item.people)}</td>
                        <td>${escapeHtml(formatDate(item.start) || "—")} → ${escapeHtml(formatDate(item.due) || "—")}</td>
                        <td>${progressHtml(item.progress)}</td>
                        <td><span class="projetos-pill ${late ? "projetos-pill--operational-late" : "projetos-pill--status"}">${escapeHtml(item.status || (late ? "Atrasada" : "Pendente"))}</span></td>
                    </tr>`;
                }).join("") || `<tr><td colspan="8" class="projetos-kanban-list__empty">${escapeHtml(emptyText)}</td></tr>`}</tbody>
            </table>
        </div>`;
    }

    function bindOperationalListRows() {
        el.meuDiaListas?.querySelectorAll("[data-operational-project-id]").forEach((row) => {
            row.addEventListener("click", () => {
                const projectId = Number(row.dataset.operationalProjectId || 0);
                const taskId = Number(row.dataset.operationalTaskId || 0);
                if (projectId) openProject(projectId, null, taskId ? { taskId } : null);
            });
        });
    }

    function renderOperationalScope(scope) {
        const summary = el.meuDiaArea?.querySelector(".projetos-meu-dia__summary");
        if (summary) summary.hidden = true;
        el.meuDiaArea?.classList.add("is-operational-list");
        const items = scope === "criticos" ? criticalOperationalItems() : meuDiaOperationalItems();
        el.meuDiaListas.innerHTML = operationalListHtml(items, scope === "criticos" ? "Nenhuma tarefa ou subtarefa atrasada." : "Nenhuma tarefa ou subtarefa para o seu dia.");
        bindOperationalListRows();
        return items;
    }

    function render() {
        // O rail é exclusivamente uma navegação de PROJETOS.
        // Meu Dia usa a API apenas para descobrir quais projetos têm ação hoje;
        // tarefas e subtarefas continuam sendo tratadas no Kanban.
        if (el.portfolioArea) {
            el.portfolioArea.hidden = false;
            el.portfolioArea.style.removeProperty("display");
        }
        if (el.meuDiaArea) {
            el.meuDiaArea.hidden = true;
            el.meuDiaArea.style.display = "none";
            el.meuDiaArea.classList.remove("is-operational-list");
        }

        const titles = {
            todos: ["Portfólio de Projetos", "Todos os projetos do portfólio. Abra um projeto para acessar o detalhamento."],
            meu_dia: ["Meu Dia", "Projetos com Entrega / Go Live prevista para hoje."],
            meus: ["Meus Projetos", "Projetos em que você é o líder / responsável principal."],
            criticos: ["Críticos", "Projetos com Entrega / Go Live vencida e ainda em status operacional aberto."],
            atencao: ["Atenção", `Projetos com Entrega / Go Live prevista para os próximos ${PROJECT_ATTENTION_DAYS} dias.`],
        };
        const copy = titles[state.scope] || titles.todos;
        renderSmartFilterOptions();
        const projects = filteredProjects();

        if (state.view === "kanban") {
            const visibleProjectIds = new Set(projects.map((project) => Number(project.id)));
            const taskCount = state.kanbanTasks.filter((task) => visibleProjectIds.has(Number(task.projeto?.id)) && task.status !== "cancelada").length;
            el.panelTitle.textContent = "Kanban de Tarefas";
            el.panelDescription.textContent = "Execução por status. Cada movimento sincroniza tarefa, Sprint, cronograma e projeto.";
            el.countBadge.textContent = `${taskCount} ${taskCount === 1 ? "tarefa" : "tarefas"}`;
        } else if (state.view === "graficos") {
            el.panelTitle.textContent = "Gráficos do Portfólio";
            el.panelDescription.textContent = "Indicadores e distribuições atualizados pelos mesmos filtros da gestão de projetos.";
            el.countBadge.textContent = `${projects.length} ${projects.length === 1 ? "projeto analisado" : "projetos analisados"}`;
        } else {
            el.panelTitle.textContent = copy[0];
            el.panelDescription.textContent = copy[1];
            el.countBadge.textContent = `${projects.length} ${projects.length === 1 ? "projeto" : "projetos"}`;
        }
        if (el.empty) {
            const emptyTitle = el.empty.querySelector("strong");
            const emptyText = el.empty.querySelector("p");
            if (state.scope === "meu_dia") {
                if (emptyTitle) emptyTitle.textContent = "Nenhum Go Live para hoje";
                if (emptyText) emptyText.textContent = "Não há projetos com Entrega / Go Live prevista para hoje.";
            } else {
                if (emptyTitle) emptyTitle.textContent = "Nenhum projeto encontrado";
                if (emptyText) emptyText.textContent = "Altere os filtros ou selecione outra visão para continuar.";
            }
            el.empty.hidden = projects.length > 0;
        }

        renderList(projects);
        renderTimeline(projects);
        renderKanban(projects);
        renderCharts(projects);
        updateCounters();

        document.querySelectorAll("[data-view-panel]").forEach((panel) => {
            panel.classList.toggle("is-active", panel.dataset.viewPanel === state.view);
        });
        document.querySelectorAll(".projetos-view-switch__button").forEach((button) => {
            button.classList.toggle("is-active", button.dataset.view === state.view);
        });
    }

    function daySection(title, items, icon, emptyText) {
        return `
            <section class="projetos-day-section">
                <header class="projetos-day-section__header">
                    <span><i class="fa ${icon}"></i></span>
                    <div>
                        <strong>${escapeHtml(title)}</strong>
                        <small>${items.length} ${items.length === 1 ? "item" : "itens"}</small>
                    </div>
                </header>
                <div class="projetos-day-section__body">
                    ${items.length ? items.map((item) => `
                        <button type="button" class="projetos-day-item" data-day-project-id="${item.projeto.id}">
                            <span class="projetos-day-item__status"></span>
                            <span class="projetos-day-item__copy">
                                <strong>${escapeHtml(item.nome)}</strong>
                                <small>
                                    ${escapeHtml(item.projeto.nome)}
                                    ${item.etapa ? ` · ${escapeHtml(item.etapa.nome)}${item.etapa.descricao ? ` — ${escapeHtml(item.etapa.descricao)}` : ""}` : ""}
                                </small>
                            </span>
                            <span class="projetos-day-item__meta">
                                ${item.dias_atraso ? `<strong>${item.dias_atraso}d atraso</strong>` : `<strong>${formatDate(item.data_fim_prevista || item.data_inicio)}</strong>`}
                                <small>${escapeHtml(item.status_nome || "")}</small>
                            </span>
                        </button>`).join("") : `<div class="projetos-day-empty">${escapeHtml(emptyText)}</div>`}
                </div>
            </section>`;
    }

    function renderMeuDia() {
        if (!state.meuDia) {
            el.meuDiaListas.innerHTML = `<div class="projetos-day-empty">Carregando sua agenda...</div>`;
            return;
        }

        const resumo = state.meuDia.resumo || {};
        document.getElementById("projetosDiaVenceHoje").textContent = resumo.vencem_hoje || 0;
        document.getElementById("projetosDiaAtrasadas").textContent = resumo.atrasadas || 0;
        document.getElementById("projetosDiaIniciamHoje").textContent = resumo.iniciam_hoje || 0;
        document.getElementById("projetosDiaMarcosHoje").textContent = resumo.marcos_hoje || 0;

        const blocks = [
            daySection("Vence hoje", state.meuDia.vencem_hoje || [], "fa-calendar", "Nenhuma tarefa vencendo hoje."),
            daySection("Atrasadas", state.meuDia.atrasadas || [], "fa-clock", "Nenhuma tarefa atrasada."),
            daySection("Iniciam hoje", state.meuDia.iniciam_hoje || [], "fa-play-circle", "Nenhuma tarefa iniciando hoje."),
            daySection("Marcos / entregas de hoje", state.meuDia.marcos_hoje || [], "fa-flag-checkered", "Nenhum marco para hoje."),
        ];

        if ((state.meuDia.owner_atencao || []).length) {
            blocks.push(
                daySection(
                    "Atenção como Owner",
                    state.meuDia.owner_atencao || [],
                    "fa-exclamation-circle",
                    "Nenhuma atenção de Owner."
                )
            );
        }

        el.meuDiaListas.innerHTML = blocks.join("");
        el.meuDiaListas.querySelectorAll("[data-day-project-id]").forEach((node) => {
            node.addEventListener("click", () => openProject(Number(node.dataset.dayProjectId)));
        });
    }

    async function loadMeuDia(silent) {
        if (!silent) setLoading(true);
        try {
            state.meuDia = await request(api.meuDia);
            render();
        } catch (error) {
            toast(error.message, true);
        } finally {
            if (!silent) setLoading(false);
        }
    }

    function hydrateInitialProjects() {
        const node = document.getElementById("projetosInitialBootstrap");
        if (!node) return;
        try {
            const projetos = JSON.parse(node.textContent || "[]");
            if (Array.isArray(projetos) && projetos.length) {
                state.projetos = projetos;
            }
        } catch (error) {
            // A API segue sendo a fonte principal; bootstrap é apenas fallback.
        }
    }

    async function loadProjects(silent) {
        if (!silent) setLoading(true);
        try {
            const data = await request(api.projetos);
            const recebidos = Array.isArray(data.projetos) ? data.projetos : [];

            // Proteção para projetos já cadastrados: o bootstrap renderizado
            // pelo Django é um fallback real do portfólio. Se uma atualização
            // assíncrona retornar vazio por falha de compatibilidade, não
            // apagamos da tela uma lista inicial que já veio do banco.
            if (recebidos.length || state.projetos.length === 0) {
                state.projetos = recebidos;
            }
            if (Array.isArray(data.tarefas_kanban)) {
                state.kanbanTasks = data.tarefas_kanban;
            }
            if (Array.isArray(data.etapas_graficos)) {
                state.chartStages = data.etapas_graficos;
            }
            state.responsiblePeopleCache.clear();
            render();
        } catch (error) {
            // Em caso de falha da API, mantém os projetos recebidos no HTML.
            render();
            toast(error.message, true);
        } finally {
            if (!silent) setLoading(false);
        }
    }

    async function loadSupportData() {
        // Catálogos e cronogramas são independentes. Se um endpoint falhar,
        // o outro continua preenchendo a tela (principalmente Cliente/Empresa).
        const [modelsResult, contextResult] = await Promise.allSettled([
            request(api.cronogramas),
            request(api.contexto),
        ]);

        if (modelsResult.status === "fulfilled") {
            state.modelos = modelsResult.value.modelos || [];
        } else {
            state.modelos = [];
            toast("Não foi possível carregar os cronogramas padrão.", true);
        }

        if (contextResult.status === "fulfilled") {
            applyContext(contextResult.value || {});
        } else {
            toast("Não foi possível carregar Cliente, Empresa, Owner, Stakeholder, pessoas e Grupo.", true);
        }

        fillSupportFields();
    }

    function selectedValues(select) {
        if (!select) return [];
        return Array.from(select.selectedOptions || []).map((option) => Number(option.value)).filter(Boolean);
    }

    function applyContext(context) {
        state.clientes = context.clientes || [];
        state.empresas = context.empresas || [];
        state.pessoas = context.pessoas || [];
        state.owners = context.owners || [];
        state.responsaveis = context.responsaveis || [];
        state.grupos = context.grupos || [];
        fillSupportFields();
    }

    function fillSupportFields() {
        const previous = {
            cliente: el.cliente?.value || "",
            empresa: el.empresa?.value || "",
            owner: el.owner?.value || "",
            stakeholder: el.stakeholder?.value || "",
            responsavelProjeto: el.responsavelProjeto?.value || "",
            grupo: el.grupos?.value || "",
            cronograma: el.cronograma?.value || "",
        };

        if (el.cliente) {
            el.cliente.innerHTML = `<option value="">Selecione o cliente</option>` + state.clientes.map((cliente) => (
                `<option value="${cliente.id}">${escapeHtml(cliente.nome)}</option>`
            )).join("");
            if (Array.from(el.cliente.options).some((item) => item.value === previous.cliente)) {
                el.cliente.value = previous.cliente;
            }
        }

        fillEmpresas(previous.empresa);

        if (el.owner) {
            el.owner.innerHTML = `<option value="">Selecione o Owner</option>` + state.owners.map((pessoa) => {
                const grupo = pessoa.grupo_nome ? ` · ${escapeHtml(pessoa.grupo_nome)}` : "";
                return `<option value="${pessoa.id}" data-grupo-nome="${escapeHtml(pessoa.grupo_nome || "")}">${escapeHtml(pessoa.nome)}${grupo}</option>`;
            }).join("");
            if (Array.from(el.owner.options).some((item) => item.value === previous.owner)) {
                el.owner.value = previous.owner;
            } else if (!previous.owner) {
                const felipe = state.owners.find((pessoa) => (
                    String(pessoa.nome || "")
                        .normalize("NFD")
                        .replace(/[\u0300-\u036f]/g, "")
                        .trim()
                        .toLowerCase() === "felipe alexandrino"
                ));
                if (felipe) el.owner.value = String(felipe.id);
            }
        }

        if (el.stakeholder) {
            el.stakeholder.innerHTML = `<option value="">Sem Stakeholder definido</option>` + state.pessoas.map((pessoa) => (
                `<option value="${pessoa.id}">${escapeHtml(personLabel(pessoa))}</option>`
            )).join("");
            if (Array.from(el.stakeholder.options).some((item) => item.value === previous.stakeholder)) {
                el.stakeholder.value = previous.stakeholder;
            }
        }

        if (el.responsavelProjeto) {
            el.responsavelProjeto.innerHTML = `<option value="">Sem responsável definido</option>` + state.responsaveis.map((pessoa) => {
                const grupo = pessoa.grupo_nome ? ` · ${escapeHtml(pessoa.grupo_nome)}` : "";
                return `<option value="${pessoa.id}" data-grupo-nome="${escapeHtml(pessoa.grupo_nome || "")}">${escapeHtml(pessoa.nome)}${grupo}</option>`;
            }).join("");
            if (Array.from(el.responsavelProjeto.options).some((item) => item.value === previous.responsavelProjeto)) {
                el.responsavelProjeto.value = previous.responsavelProjeto;
            }
        }

        if (el.grupos) {
            el.grupos.innerHTML = `<option value="">Selecione o grupo</option>` + state.grupos.map((grupo) => (
                `<option value="${grupo.id}">${escapeHtml(grupo.nome)}</option>`
            )).join("");
            if (Array.from(el.grupos.options).some((item) => item.value === previous.grupo)) {
                el.grupos.value = previous.grupo;
            }
        }

        if (el.cronograma) {
            const metodologiaAtual = document.getElementById("projetoMetodologia")?.value || "agil";
            el.cronograma.innerHTML = `<option value="">Selecione o tipo</option>` + state.modelos
                .filter((model) => !model.metodologia || model.metodologia === metodologiaAtual)
                .map((model) => (
                `<option value="${model.id}">${escapeHtml(model.nome)}${model.esperada ? " · Recomendada" : ""} (${model.quantidade_etapas} etapas)</option>`
                )).join("");
            if (Array.from(el.cronograma.options).some((item) => item.value === previous.cronograma)) {
                el.cronograma.value = previous.cronograma;
            }
        }
        scheduleTemplatePreview();
    }

    function fillEmpresas(preserveValue) {
        if (!el.empresa) return;
        const previous = preserveValue == null ? "" : String(preserveValue);
        el.empresa.innerHTML = `<option value="">Selecione a empresa</option>` + state.empresas.map((empresa) => (
            `<option value="${empresa.id}">${escapeHtml(empresa.nome)}</option>`
        )).join("");
        if (previous && Array.from(el.empresa.options).some((item) => item.value === previous)) {
            el.empresa.value = previous;
        }
    }

    function filterCreateModelsByMethodology(preserveValue = "") {
        if (!el.cronograma) return;
        const metodologia = document.getElementById("projetoMetodologia")?.value || "agil";
        const atual = String(preserveValue || el.cronograma.value || "");
        const compativeis = state.modelos.filter(
            (modelo) => !modelo.metodologia || modelo.metodologia === metodologia
        );
        el.cronograma.innerHTML = `<option value="">Selecione o tipo</option>` + compativeis.map((modelo) => (
            `<option value="${modelo.id}">${escapeHtml(modelo.nome)}${modelo.esperada ? " · Recomendada" : ""} (${modelo.quantidade_etapas} etapas)</option>`
        )).join("");
        if (compativeis.some((modelo) => String(modelo.id) === atual)) {
            el.cronograma.value = atual;
        }
        renderCreateMethodologyGuide();
        scheduleTemplatePreview();
    }

    function applyOwnerGroup(selectOwner, selectGroup) {
        if (!selectOwner || !selectGroup) return;
        const option = selectOwner.options[selectOwner.selectedIndex];
        const groupName = option ? String(option.dataset.grupoNome || "").trim() : "";
        if (!groupName) return;
        const groupOption = Array.from(selectGroup.options).find((item) => item.textContent.trim() === groupName);
        if (groupOption) selectGroup.value = groupOption.value;
    }

    async function refreshContext() {
        const context = await request(api.contexto);
        applyContext(context || {});
    }

    function openModal() {
        if (!el.modalBackdrop) return;

        setInlineExternalPersonVisible(false);

        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, "0");
        const dd = String(today.getDate()).padStart(2, "0");
        const dataAbertura = document.getElementById("projetoDataAbertura");
        if (dataAbertura && !dataAbertura.value) {
            dataAbertura.value = `${yyyy}-${mm}-${dd}`;
        }
        if (el.owner && !el.owner.value) {
            const defaultOwner = state.owners.find((pessoa) => (
                String(pessoa.nome || "")
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .trim()
                    .toLowerCase() === "felipe alexandrino"
            ));
            if (defaultOwner) {
                el.owner.value = String(defaultOwner.id);
                applyOwnerGroup(el.owner, el.grupos);
            }
        }

        el.modalBackdrop.classList.add("is-open");
        el.modalBackdrop.setAttribute("aria-hidden", "false");
        // Fallback explícito para não depender de regras de display do modal
        // compartilhado do Core. Mantém o overlay centralizado mesmo se houver
        // precedência/carga diferente entre workspace_core.css e projetos.css.
        el.modalBackdrop.style.setProperty("display", "flex", "important");
        el.modalBackdrop.style.alignItems = "center";
        el.modalBackdrop.style.justifyContent = "center";
        document.body.style.overflow = "hidden";

        const nome = document.getElementById("projetoNome");
        if (nome) window.setTimeout(() => nome.focus(), 20);
        scheduleTemplatePreview();
        // No pré-cadastro o guia fica disponível sob demanda pelo botão Entenda.
        // O projeto ainda não efetiva cronograma enquanto permanecer Rascunho.
    }

    function closeModal() {
        if (!el.modalBackdrop) return;
        closeMethodologyGuide();
        el.modalBackdrop.classList.remove("is-open");
        el.modalBackdrop.setAttribute("aria-hidden", "true");
        el.modalBackdrop.style.removeProperty("display");
        el.modalBackdrop.style.removeProperty("align-items");
        el.modalBackdrop.style.removeProperty("justify-content");
        document.body.style.overflow = "";
        setInlineExternalPersonVisible(false);
        el.form?.reset();
        const prioridade = document.getElementById("projetoPrioridade");
        const metodologia = document.getElementById("projetoMetodologia");
        if (prioridade) prioridade.value = "media";
        if (metodologia) metodologia.value = "agil";
        filterCreateModelsByMethodology();
        if (el.templatePreview) {
            el.templatePreview.hidden = true;
            el.templatePreview.innerHTML = "";
        }
    }

    let templatePreviewTimer = null;

    function scheduleTemplatePreview() {
        window.clearTimeout(templatePreviewTimer);
        templatePreviewTimer = window.setTimeout(renderTemplatePreview, 250);
    }

    async function renderTemplatePreview() {
        const id = Number(el.cronograma.value || 0);
        const model = state.modelos.find((item) => Number(item.id) === id);
        const dataInicio = el.dataInicioProjeto?.value || "";
        const duracao = Number(el.duracaoDiasUteis?.value || 0);

        if (!dataInicio || !duracao || !api.cronogramaPrevia) {
            el.templatePreview.hidden = true;
            el.templatePreview.innerHTML = "";
            if (el.dataFimProjeto) el.dataFimProjeto.value = "";
            if (el.dataHomologacaoProjeto) el.dataHomologacaoProjeto.value = "";
            if (el.dataGoLiveProjeto) el.dataGoLiveProjeto.value = "";
            return;
        }

        el.templatePreview.hidden = false;
        el.templatePreview.innerHTML = `
            <div class="projetos-template-preview__header">
                <strong>Calculando cronograma...</strong>
                <span><i class="fa fa-spinner fa-spin" aria-hidden="true"></i></span>
            </div>
        `;

        const requestId = ++state.previewRequestId;
        const params = new URLSearchParams({
            data_inicio: dataInicio,
            duracao_dias_uteis: String(duracao),
            metodologia: document.getElementById("projetoMetodologia")?.value || "agil",
        });
        if (model) params.set("cronograma_modelo_id", String(model.id));

        try {
            const data = await request(`${api.cronogramaPrevia}?${params.toString()}`);
            if (requestId !== state.previewRequestId) return;
            const planejamento = data.planejamento || {};
            if (el.dataFimProjeto) el.dataFimProjeto.value = planejamento.data_fim_prevista || "";
            if (el.dataHomologacaoProjeto) el.dataHomologacaoProjeto.value = planejamento.data_homologacao_prevista || "";
            if (el.dataGoLiveProjeto) el.dataGoLiveProjeto.value = planejamento.data_go_live_prevista || "";
            const inicioAjustado = planejamento.data_inicio_efetiva
                && planejamento.data_inicio_efetiva !== planejamento.data_inicio_solicitada;
            el.templatePreview.innerHTML = `
                <div class="projetos-template-preview__header">
                    <strong>${escapeHtml(model ? model.nome : "Planejamento do projeto")}</strong>
                    <span>${Number(planejamento.duracao_dias_uteis || 0)} dias úteis • ${formatDate(planejamento.data_inicio_efetiva)} → ${formatDate(planejamento.data_fim_prevista)}</span>
                </div>
                ${inicioAjustado ? `
                    <div class="projetos-template-preview__notice">
                        <i class="fa fa-info-circle" aria-hidden="true"></i>
                        A data informada não é útil; o cronograma começa em ${formatDate(planejamento.data_inicio_efetiva)}.
                    </div>` : ""}
                ${model ? `
                    <div class="projetos-template-preview__schedule">
                        ${(() => {
                            const renderPreviewStage = (stage, depth = 0) => `
                                <section class="projetos-template-preview__stage ${depth ? "is-child" : ""}" data-stage-type="${escapeHtml(stage.tipo || "")}">
                                    <div>
                                        <small>${escapeHtml(stage.tipo_nome || (stage.tipo === "sprint" ? "Sprint" : "Fase"))} · ${escapeHtml(stage.momento_nome || "Planejamento")}</small>
                                        <strong>${escapeHtml(stage.nome)}</strong>
                                        <span>${formatDate(stage.data_inicio)} → ${formatDate(stage.data_fim_prevista)}</span>
                                    </div>
                                    ${(stage.tarefas || []).length ? `<div class="projetos-template-preview__tasks">
                                        ${(stage.tarefas || []).map((task) => `<span title="${escapeHtml(task.nome)}">${escapeHtml(task.nome)} · ${formatDate(task.data_inicio)} → ${formatDate(task.data_fim_prevista)}</span>`).join("")}
                                    </div>` : ""}
                                    ${(stage.sprints || []).length ? `<div class="projetos-template-preview__children">${stage.sprints.map((child) => renderPreviewStage(child, depth + 1)).join("")}</div>` : ""}
                                </section>`;
                            return nestPlannedStages(planejamento.etapas || []).map((stage) => renderPreviewStage(stage)).join("");
                        })()}
                    </div>` : `
                    <div class="projetos-template-preview__notice">
                        Selecione um cronograma padrão para visualizar a estrutura da metodologia e a distribuição das tarefas.
                    </div>`}
            `;
        } catch (error) {
            if (requestId !== state.previewRequestId) return;
            if (el.dataFimProjeto) el.dataFimProjeto.value = "";
            if (el.dataHomologacaoProjeto) el.dataHomologacaoProjeto.value = "";
            if (el.dataGoLiveProjeto) el.dataGoLiveProjeto.value = "";
            el.templatePreview.innerHTML = `
                <div class="projetos-template-preview__error">
                    <i class="fa fa-exclamation-circle" aria-hidden="true"></i>
                    <span>${escapeHtml(error.message || "Não foi possível calcular o cronograma.")}</span>
                </div>`;
        }
    }

    async function createProject(event) {
        event.preventDefault();

        const byId = (id) => document.getElementById(id);
        const nome = byId("projetoNome")?.value.trim() || "";
        if (!nome) {
            toast("Informe o nome do projeto.", true);
            byId("projetoNome")?.focus();
            return;
        }
        if (!el.owner?.value) {
            toast("Selecione o Owner do projeto.", true);
            el.owner?.focus();
            return;
        }

        const clienteSelecionado = state.clientes.find((item) => Number(item.id) === Number(el.cliente?.value || 0));
        const empresaSelecionada = state.empresas.find((item) => Number(item.id) === Number(el.empresa?.value || 0));
        const referenciaUrlRaw = byId("projetoReferenciaUrl")?.value.trim() || "";
        const cslogUrlRaw = byId("projetoCslogUrl")?.value.trim() || "";
        const referenciaUrl = externalReferenceUrl(referenciaUrlRaw);
        const cslogUrl = externalReferenceUrl(cslogUrlRaw);
        if (referenciaUrlRaw && !referenciaUrl) {
            toast("Informe uma URL válida para a referência TiFlux.", true);
            byId("projetoReferenciaUrl")?.focus();
            return;
        }
        if (cslogUrlRaw && !cslogUrl) {
            toast("Informe uma URL válida para a referência CSLOG.", true);
            byId("projetoCslogUrl")?.focus();
            return;
        }

        const payload = {
            nome,
            referencia: byId("projetoReferencia")?.value.trim() || "",
            referencia_url: referenciaUrl,
            cslog: byId("projetoCslog")?.value.trim() || "",
            cslog_url: cslogUrl,
            categoria: byId("projetoCategoria")?.value.trim() || "",
            mesa: byId("projetoMesa")?.value.trim() || "",
            servico_completo: byId("projetoServicoCompleto")?.value.trim() || "",
            cliente_id: el.cliente?.value || null,
            cliente_nome: clienteSelecionado ? clienteSelecionado.nome : "",
            empresa_id: el.empresa?.value || null,
            empresa_nome: empresaSelecionada ? empresaSelecionada.nome : "",
            owner_id: el.owner.value,
            grupo_ids: selectedValues(el.grupos),
            stakeholder_id: el.stakeholder?.value || null,
            responsavel_ids: el.responsavelProjeto?.value ? [Number(el.responsavelProjeto.value)] : [],
            data_abertura: byId("projetoDataAbertura")?.value || null,
            data_inicio: byId("projetoDataInicio")?.value || null,
            duracao_dias_uteis: Number(el.duracaoDiasUteis?.value || 0) || null,
            data_fim_prevista: byId("projetoDataFim")?.value || null,
            data_homologacao_prevista: byId("projetoDataHomologacao")?.value || null,
            data_go_live_prevista: byId("projetoDataGoLive")?.value || null,
            data_conclusao: byId("projetoDataConclusao")?.value || null,
            prioridade: byId("projetoPrioridade")?.value || "media",
            metodologia: byId("projetoMetodologia")?.value || "agil",
            cronograma_modelo_id: el.cronograma?.value || null,
            status: "rascunho",
            pre_cadastro: true,
            descricao: byId("projetoDescricao")?.value.trim() || "",
        };

        el.criarSubmit.disabled = true;
        setLoading(true);
        try {
            const data = await request(api.projetos, {
                method: "POST",
                body: JSON.stringify(payload),
            });
            closeModal();
            toast(data.mensagem || "Pré-cadastro salvo como Rascunho.");
            await loadProjects(true);
            if (data.projeto && data.projeto.id) {
                await openProject(Number(data.projeto.id), data.projeto, { section: "dados" });
            }
        } catch (error) {
            toast(error.message, true);
        } finally {
            el.criarSubmit.disabled = false;
            setLoading(false);
        }
    }

    function taskStatusOptions(current) {
        const options = [
            ["backlog", "Backlog"],
            ["em_andamento", "Em andamento"],
            ["aguardando", "Aguardando"],
            ["bloqueada", "Bloqueado"],
            ["concluida", "Concluída"],
            ["cancelada", "Cancelada"],
        ];
        return options.map(([value, label]) => (
            `<option value="${value}" ${value === current ? "selected" : ""}>${label}</option>`
        )).join("");
    }

    function subtaskResponsibleOptions(item, taskResponsible) {
        const specific = item.responsavel_especifico || null;
        const inherited = !specific && !item.sem_responsavel && item.responsavel_herdado !== false;
        const inheritedLabel = taskResponsible
            ? `Herdar líder da tarefa (${personLabel(taskResponsible)})`
            : "Herdar responsável da tarefa";
        return `<option value="" ${inherited ? "selected" : ""}>${escapeHtml(inheritedLabel)}</option>`
            + `<option value="__none" ${item.sem_responsavel ? "selected" : ""}>Sem executor</option>`
            + state.pessoas.map((pessoa) => (
            `<option value="${pessoa.id}" ${specific && Number(specific.id) === Number(pessoa.id) ? "selected" : ""}>${escapeHtml(personLabel(pessoa))}</option>`
        )).join("");
    }

    function effectiveSubtaskResponsible(item, taskResponsible) {
        if (item.responsavel) return item.responsavel;
        if (item.responsavel_especifico) return item.responsavel_especifico;
        if (item.sem_responsavel || item.responsavel_herdado === false) return null;
        return taskResponsible || null;
    }

    function overdueInfo(item) {
        if (!item) return { late: false, days: 0, completedLate: false };

        const toUtcDay = (value) => {
            if (!value) return null;
            const raw = String(value).slice(0, 10);
            const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (!match) return null;
            return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
        };

        const due = toUtcDay(item.data_fim_prevista);
        const completed = item.status === "concluida" || item.concluido === true;
        const completion = toUtcDay(item.data_conclusao || item.concluido_em);

        // Histórico: depois de concluída, a quantidade de dias de atraso fica
        // congelada na data real de conclusão, em vez de continuar crescendo.
        if (completed && due !== null && completion !== null && completion > due) {
            return {
                late: true,
                days: Math.max(1, Math.round((completion - due) / 86400000)),
                completedLate: true,
            };
        }

        if (item.atrasada) {
            return {
                late: true,
                days: Math.max(0, Number(item.dias_atraso || 0)),
                completedLate: false,
            };
        }

        return { late: false, days: 0, completedLate: false };
    }

    function overdueBadge(item) {
        const info = overdueInfo(item);
        if (!info.late) return "";

        const atraso = info.days === 1 ? "1 dia de atraso" : `${info.days} dias de atraso`;
        const texto = info.completedLate ? `Concluída com ${atraso}` : atraso;
        return `<span class="projetos-overdue-badge"><i class="fa fa-exclamation-triangle"></i> ${texto}</span>`;
    }

    function projectLeaderPerson(project) {
        if (!project || typeof project !== "object") return null;
        const direct = project.responsavel_principal
            || project.responsavel_lider
            || project.lider_responsavel
            || project.responsavel_pessoa
            || project.responsavel_projeto
            || project.responsavel
            || project.lider
            || null;
        if (direct && typeof direct === "object" && direct.nome) return direct;

        const directId = Number(
            project.responsavel_pessoa_id
            || project.responsavel_projeto_id
            || project.responsavel_id
            || project.lider_id
            || 0
        );
        if (directId) {
            const catalogPerson = state.pessoas.find((person) => Number(person.id) === directId);
            if (catalogPerson) return catalogPerson;
        }

        const projectPeople = Array.isArray(project.responsaveis) ? project.responsaveis : [];
        return projectPeople.find((person) => person && person.nome) || null;
    }

    function projectLeaderMatchesCurrentUser(project) {
        if (!project) return false;
        if (project.meu_projeto_lider === true || project.sou_lider === true) return true;
        const leader = projectLeaderPerson(project);
        if (!leader) return false;

        const linkedUserId = Number(leader.usuario_id || leader.user_id || leader.usuario?.id || 0);
        if (userId && linkedUserId && linkedUserId === userId) return true;

        const leaderName = normalizeProjectPersonName(leader.nome || "");
        const userName = normalizeProjectPersonName(currentUserName);
        if (leaderName && userName && leaderName === userName) return true;

        // Compatibilidade com cadastros antigos em que o id da pessoa coincidia
        // diretamente com o id do usuário do Workspace.
        const legacyId = Number(leader.id || 0);
        return Boolean(userId && legacyId && legacyId === userId);
    }

    function favoriteStorageKey() {
        return `workspace.projetos.favorites.v1.${userId || "local"}`;
    }

    function loadFavoriteProjectIds() {
        try {
            const value = JSON.parse(window.localStorage.getItem(favoriteStorageKey()) || "[]");
            return new Set((Array.isArray(value) ? value : []).map(Number).filter((id) => Number.isInteger(id) && id > 0));
        } catch (error) {
            return new Set();
        }
    }

    function saveFavoriteProjectIds() {
        try {
            window.localStorage.setItem(favoriteStorageKey(), JSON.stringify(Array.from(state.favoriteProjectIds)));
        } catch (error) {
            // Favoritos locais são opcionais e nunca bloqueiam o módulo.
        }
    }

    function isFavoriteProject(projectId) {
        return state.favoriteProjectIds.has(Number(projectId));
    }

    function updateDrawerFavorite(projectId) {
        if (!el.drawerFavorite) return;
        const favorite = isFavoriteProject(projectId);
        el.drawerFavorite.classList.toggle("is-favorite", favorite);
        el.drawerFavorite.setAttribute("aria-pressed", favorite ? "true" : "false");
        el.drawerFavorite.setAttribute("aria-label", favorite ? "Desfavoritar projeto" : "Favoritar projeto");
        el.drawerFavorite.title = favorite ? "Desfavoritar projeto" : "Favoritar projeto";
        const icon = el.drawerFavorite.querySelector("i");
        if (icon) icon.className = "fa fa-star-o";
    }

    function renderFavoriteProjects() {
        if (!el.railFavorites) return;
        const favorites = Array.from(state.favoriteProjectIds)
            .map((id) => state.projetos.find((project) => Number(project.id) === Number(id)))
            .filter(Boolean);
        if (el.railFavoritesCount) el.railFavoritesCount.textContent = favorites.length;
        el.railFavorites.innerHTML = favorites.length
            ? favorites.map((project) => `
                <div class="projetos-rail__favorite-item" data-favorite-project-id="${Number(project.id)}" role="button" tabindex="0" title="Abrir ${escapeHtml(project.nome || project.codigo || "projeto")}">
                    <button type="button" class="projetos-rail__favorite-star is-favorite" data-unfavorite-project-id="${Number(project.id)}" aria-label="Desfavoritar ${escapeHtml(project.nome || "projeto")}" title="Desfavoritar">
                        <i class="fa fa-star" aria-hidden="true"></i>
                    </button>
                    <span class="projetos-rail__favorite-copy">
                        <strong>${escapeHtml(project.codigo || "Projeto")}</strong>
                        <small>${escapeHtml(project.nome || "")}</small>
                    </span>
                </div>`).join("")
            : `<span class="projetos-rail__favorites-empty">Nenhum projeto fixado.</span>`;

        el.railFavorites.querySelectorAll("[data-unfavorite-project-id]").forEach((button) => {
            button.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
                toggleFavoriteProject(Number(button.dataset.unfavoriteProjectId));
            });
        });
        el.railFavorites.querySelectorAll("[data-favorite-project-id]").forEach((item) => {
            const open = () => openProject(Number(item.dataset.favoriteProjectId));
            item.addEventListener("click", (event) => {
                if (event.target.closest?.("[data-unfavorite-project-id]")) return;
                open();
            });
            item.addEventListener("keydown", (event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    open();
                }
            });
        });
    }

    function toggleFavoriteProject(projectId) {
        const id = Number(projectId || 0);
        if (!id) return;
        if (state.favoriteProjectIds.has(id)) state.favoriteProjectIds.delete(id);
        else state.favoriteProjectIds.add(id);
        saveFavoriteProjectIds();
        renderFavoriteProjects();
        updateDrawerFavorite(id);
    }

    function renderTask(task, project, expanded = true) {
        const liderProjeto = projectLeaderPerson(project);
        const responsavel = task.responsavel_principal || task.responsavel || liderProjeto || null;
        const subtarefas = task.checklist || [];
        const pessoasDisponiveis = [...state.pessoas];
        if (responsavel && responsavel.id && !pessoasDisponiveis.some((pessoa) => Number(pessoa.id) === Number(responsavel.id))) {
            pessoasDisponiveis.unshift(responsavel);
        }
        const responsavelOptions = pessoasDisponiveis.map((pessoa) => (
            `<option value="${pessoa.id}" ${responsavel && Number(responsavel.id) === Number(pessoa.id) ? "selected" : ""}>${escapeHtml(personLabel(pessoa))}</option>`
        )).join("");
        const concluidaComPendencia = task.status === "concluida" && Number(task.subtarefas_pendentes || 0) > 0;

        return `
            <article class="projetos-task-row projetos-task-card ${expanded ? "is-open" : ""} ${overdueInfo(task).late ? "is-overdue" : ""}" data-task-id="${task.id}">
                <div class="projetos-task-row__top">
                    <button type="button" class="projetos-task-card__toggle" data-task-toggle="${task.id}" aria-expanded="${expanded ? "true" : "false"}" aria-label="Abrir ou recolher tarefa">
                    <span class="projetos-task-row__main">
                        <strong>${escapeHtml(task.nome)}</strong>
                        ${task.e_envio_cslog ? `<span class="projetos-task-cslog-badge">QORE → CSLOG</span>` : ""}
                        ${overdueBadge(task)}
                        <span class="projetos-task-row__meta">
                            <span>${escapeHtml(task.categoria_nome)}</span>
                            <span>${responsavel ? escapeHtml(personLabel(responsavel)) : "Sem responsável"}</span>
                            <span>${formatDate(task.data_inicio)} → ${formatDate(task.data_fim_prevista)}</span>
                            ${task.status === "bloqueada" && task.motivo_bloqueio ? `<span title="${escapeHtml(task.motivo_bloqueio)}">Impedimento: ${escapeHtml(task.motivo_bloqueio)}</span>` : ""}
                        </span>
                    </span>
                    </button>
                    <select class="projetos-task-status" data-task-status="${task.id}" data-previous-status="${escapeHtml(task.status || "backlog")}" data-block-reason="${escapeHtml(task.motivo_bloqueio || "")}" aria-label="Status da tarefa">
                        ${taskStatusOptions(task.status)}
                    </select>
                    <div class="projetos-task-progress">
                        <input type="range" min="0" max="100" step="5" value="${Number(task.progresso || 0)}" data-task-progress="${task.id}" aria-label="Progresso da tarefa">
                        <span data-task-progress-label="${task.id}">${Number(task.progresso || 0).toFixed(0)}%</span>
                    </div>
                    <div class="projetos-task-row__actions">
                        <button
                            type="button"
                            class="ws-button ws-button--primary ws-button--sm projetos-task-complete"
                            data-task-complete="${task.id}"
                            title="${task.status === "concluida" ? "Reabrir esta tarefa e todas as subtarefas" : "Concluir somente esta tarefa"}"
                            aria-label="${task.status === "concluida" ? "Reabrir esta tarefa e todas as subtarefas" : "Concluir somente esta tarefa"}"
                            data-task-action="${task.status === "concluida" ? "reopen" : "complete"}"
                        >
                            <i class="fa ${task.status === "concluida" ? "fa-undo" : "fa-check"}" aria-hidden="true"></i>
                        </button>
                        <button type="button" class="projetos-task-card__chevron" data-task-toggle="${task.id}" aria-expanded="${expanded ? "true" : "false"}" aria-label="Abrir ou recolher tarefa"><i class="fa fa-chevron-down"></i></button>
                    </div>
                </div>

                <div class="projetos-task-card__body">
                ${task.e_envio_cslog ? `<div class="projetos-task-cslog-note"><i class="fa fa-external-link" aria-hidden="true"></i><span><strong>Passagem QORE → CSLOG.</strong> O fim desta tarefa é a data esperada para enviar o escopo ao fornecedor.${project.cslog_ticket_aberto_em ? ` Abertura real registrada em ${formatDate(project.cslog_ticket_aberto_em)}.` : ""}</span></div>` : ""}
                <div class="projetos-task-execution">
                    <label class="projetos-task-field projetos-task-field--responsavel">
                        <span>Líder / responsável da tarefa</span>
                        <div class="projetos-task-person-line">
                            <select class="ws-form-control" data-task-responsavel="${task.id}" data-inherited-responsible="${task.responsavel_principal || task.responsavel ? "0" : "1"}">
                                <option value="">Sem responsável</option>
                                ${responsavelOptions}
                            </select>
                            <button type="button" class="projetos-inline-action projetos-inline-action--icon" data-external-inline-toggle="task:${task.id}" title="Adicionar responsável externo" aria-label="Adicionar responsável externo">
                                <i class="fa fa-user-plus" aria-hidden="true"></i>
                            </button>
                        </div>
                        ${responsavel && responsavel.externo ? `<small class="projetos-person-type"><i class="fa fa-info-circle"></i> Responsável externo${responsavel.contexto ? ` · ${escapeHtml(responsavel.contexto)}` : ""}</small>` : ""}
                    </label>
                    <div class="projetos-external-executor projetos-external-executor--subtask" data-external-inline-panel="task:${task.id}" hidden>
                        <label><span>Nome do executor externo</span><input class="ws-form-control" type="text" data-external-name="task:${task.id}" autocomplete="off"></label>
                        <button type="button" class="projetos-external-email-toggle" data-external-email-toggle="task:${task.id}" title="Incluir e-mail" aria-label="Incluir e-mail"><i class="fa fa-envelope"></i></button>
                        <label class="projetos-external-executor__email" data-external-email-field="task:${task.id}" hidden><span>E-mail</span><input class="ws-form-control" type="email" data-external-email="task:${task.id}" autocomplete="off"></label>
                        <button type="button" class="ws-button ws-button--primary ws-button--sm" data-external-save="task:${task.id}">Adicionar</button>
                    </div>
                    <label class="projetos-task-field">
                        <span>Início</span>
                        <input class="ws-form-control" type="date" data-task-start="${task.id}" value="${escapeHtml(task.data_inicio || "")}">
                    </label>
                    <label class="projetos-task-field">
                        <span>Fim</span>
                        <input class="ws-form-control" type="date" data-task-end="${task.id}" value="${escapeHtml(task.data_fim_prevista || "")}">
                    </label>
                    <div class="projetos-task-autosave" data-task-autosave-status="${task.id}" role="status" aria-live="polite">
                        <i class="fa fa-check-circle" aria-hidden="true"></i>
                        <span>Alterações salvas automaticamente</span>
                    </div>
                    <button type="button" class="projetos-subtask-inherit-all" data-task-apply-subtasks="${task.id}" title="Aplicar o líder desta tarefa a todas as subtarefas">
                        <i class="fa fa-level-down" aria-hidden="true"></i> Aplicar às subtarefas
                    </button>
                </div>
                ${concluidaComPendencia ? `<div class="projetos-task-warning"><i class="fa fa-exclamation-triangle"></i> Existem subtarefas pendentes. A etapa não será concluída enquanto houver pendências.</div>` : ""}

                <div class="projetos-subtasks">
                    <div class="projetos-subtasks__header">
                        <strong>Subtarefas</strong>
                        <span class="projetos-subtasks__executor-heading">Executor</span>
                        <span class="projetos-subtasks__count">${subtarefas.filter((item) => item.concluido).length}/${subtarefas.length} concluídas</span>
                    </div>
                    <div class="projetos-subtasks__list">
                        ${subtarefas.length ? subtarefas.map((item) => `
                            <div class="projetos-subtask-row ${overdueInfo(item).late ? "is-overdue" : ""}" data-subtask-row="${item.id}">
                                <label class="projetos-subtask-check">
                                    <input type="checkbox" data-subtask-toggle="${item.id}" ${item.concluido ? "checked" : ""}>
                                    <span class="projetos-subtask-text ${item.concluido ? "is-done" : ""}">${escapeHtml(item.descricao)}</span>
                                    ${overdueBadge(item)}
                                </label>
                                <span class="projetos-subtask-date ${item.concluido_em ? "is-visible" : ""}">
                                    ${item.concluido_em ? `Concluída em ${formatDateTime(item.concluido_em)}` : ""}
                                </span>
                                <label class="projetos-subtask-field projetos-subtask-field--person">
                                    <span>Executor</span>
                                    <div class="projetos-subtask-person-line">
                                        <button type="button" class="projetos-subtask-assignee" data-subtask-assignee-toggle="${item.id}" title="${escapeHtml(effectiveSubtaskResponsible(item, responsavel) ? personLabel(effectiveSubtaskResponsible(item, responsavel)) : "Sem executor")}">
                                            <span class="projetos-avatar projetos-avatar--subtask" data-subtask-avatar="${item.id}">${escapeHtml(effectiveSubtaskResponsible(item, responsavel) ? initials(effectiveSubtaskResponsible(item, responsavel).nome) : "—")}</span>
                                        </button>
                                        <select class="ws-form-control projetos-subtask-assignee-select" data-subtask-responsavel="${item.id}" aria-label="Executor da subtarefa" hidden>
                                            ${subtaskResponsibleOptions(item, responsavel)}
                                        </select>
                                        <button type="button" class="projetos-inline-action projetos-inline-action--icon" data-external-inline-toggle="subtask:${item.id}" title="Adicionar executor externo" aria-label="Adicionar executor externo">
                                            <i class="fa fa-user-plus" aria-hidden="true"></i>
                                        </button>
                                    </div>
                                </label>
                                <label class="projetos-subtask-field">
                                    <span>Início</span>
                                    <input class="ws-form-control" type="date" data-subtask-start="${item.id}" value="${escapeHtml(item.data_inicio || task.data_inicio || "")}" min="${escapeHtml(task.data_inicio || "")}" max="${escapeHtml(task.data_fim_prevista || "")}">
                                </label>
                                <label class="projetos-subtask-field">
                                    <span>Fim</span>
                                    <input class="ws-form-control" type="date" data-subtask-end="${item.id}" value="${escapeHtml(item.data_fim_prevista || task.data_fim_prevista || "")}" min="${escapeHtml(task.data_inicio || "")}" max="${escapeHtml(task.data_fim_prevista || "")}">
                                </label>
                                <div class="projetos-subtask-actions">
                                    <button type="button" class="projetos-icon-action projetos-icon-action--danger" data-subtask-remove="${item.id}" title="Remover subtarefa"><i class="fa fa-trash"></i></button>
                                </div>
                                <div class="projetos-external-executor projetos-external-executor--subtask" data-external-inline-panel="subtask:${item.id}" hidden>
                                    <label><span>Nome do executor externo</span><input class="ws-form-control" type="text" data-external-name="subtask:${item.id}" autocomplete="off"></label>
                                    <button type="button" class="projetos-external-email-toggle" data-external-email-toggle="subtask:${item.id}" title="Incluir e-mail" aria-label="Incluir e-mail"><i class="fa fa-envelope"></i></button>
                                    <label class="projetos-external-executor__email" data-external-email-field="subtask:${item.id}" hidden><span>E-mail</span><input class="ws-form-control" type="email" data-external-email="subtask:${item.id}" autocomplete="off"></label>
                                    <button type="button" class="ws-button ws-button--primary ws-button--sm" data-external-save="subtask:${item.id}">Adicionar</button>
                                </div>
                            </div>`).join("") : `<div class="projetos-subtasks__empty">Nenhuma subtarefa.</div>`}
                    </div>
                </div>
                </div>
            </article>`;
    }

    function optionsHtml(items, currentId, emptyLabel) {
        const current = Number(currentId || 0);
        return `${emptyLabel ? `<option value="">${escapeHtml(emptyLabel)}</option>` : ""}${items.map((item) => (
            `<option value="${item.id}" ${Number(item.id) === current ? "selected" : ""}>${escapeHtml(item.nome)}</option>`
        )).join("")}`;
    }

    function externalReferenceUrl(value) {
        const raw = String(value || "").trim();
        if (!raw) return "";
        if (/^https?:\/\/[^\s]+$/i.test(raw)) return raw;
        if (/^(www\.)?[^\s]+\.[a-z]{2,}(\/[^\s]*)?$/i.test(raw)) return `https://${raw}`;
        return "";
    }

    let referenceUrlAutosaveTimer = null;
    let referenceUrlAutosaveInFlight = false;
    let referenceUrlAutosavePending = false;

    async function autosaveProjectReferenceUrls(notifyInvalid) {
        const project = state.projetoAberto;
        if (!project) return;
        if (referenceUrlAutosaveInFlight) {
            referenceUrlAutosavePending = true;
            return;
        }
        const referenciaField = el.drawerBody.querySelector('[data-project-url-field="referencia"]');
        const cslogField = el.drawerBody.querySelector('[data-project-url-field="cslog"]');
        if (!referenciaField || !cslogField) return;

        const referenciaRaw = referenciaField.value.trim();
        const cslogRaw = cslogField.value.trim();
        const referenciaUrl = externalReferenceUrl(referenciaRaw);
        const cslogUrl = externalReferenceUrl(cslogRaw);
        if ((referenciaRaw && !referenciaUrl) || (cslogRaw && !cslogUrl)) {
            if (notifyInvalid) {
                toast("Informe uma URL válida iniciando com http:// ou https://.", true);
            }
            return;
        }

        referenciaField.value = referenciaUrl;
        cslogField.value = cslogUrl;
        referenceUrlAutosaveInFlight = true;
        try {
            const data = await request(`${api.projetos}${project.id}/`, {
                method: "PATCH",
                body: JSON.stringify({
                    salvar_urls_referencia: true,
                    referencia_url: referenciaUrl,
                    cslog_url: cslogUrl,
                }),
            });
            project.referencia_url = data.referencia_url || "";
            project.cslog_url = data.cslog_url || "";
            toast(data.mensagem || "Links de referência salvos.");
        } catch (error) {
            toast(`Não foi possível salvar os links: ${error.message}`, true);
        } finally {
            referenceUrlAutosaveInFlight = false;
            if (referenceUrlAutosavePending) {
                referenceUrlAutosavePending = false;
                autosaveProjectReferenceUrls(false);
            }
        }
    }

    function scheduleReferenceUrlAutosave(immediate, notifyInvalid) {
        if (referenceUrlAutosaveTimer) {
            window.clearTimeout(referenceUrlAutosaveTimer);
            referenceUrlAutosaveTimer = null;
        }
        if (immediate) {
            autosaveProjectReferenceUrls(Boolean(notifyInvalid));
            return;
        }
        referenceUrlAutosaveTimer = window.setTimeout(() => {
            referenceUrlAutosaveTimer = null;
            autosaveProjectReferenceUrls(false);
        }, 900);
    }

    function projectEditorHtml(project, expanded) {
        const companyId = project.empresa && project.empresa.origem === "customauth_empresa_filtro" ? project.empresa.id : null;
        const clientId = project.cliente ? project.cliente.id : null;
        const groupId = project.grupos && project.grupos.length ? project.grupos[0].id : null;
        const clientEmptyLabel = projectClientName(project)
            ? projectClientName(project)
            : "Selecione o cliente";
        const companyCurrentName = projectCompanyName(project);
        const companyEmptyLabel = companyCurrentName
            ? companyCurrentName
            : "Selecione a empresa";
        const defaultOwner = state.owners.find((item) => (
            String(item.nome || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() === "felipe alexandrino"
        ));
        const selectedOwnerId = project.owner ? Number(project.owner.id) : Number(defaultOwner?.id || 0);
        const ownerItems = [...state.owners];
        if (project.owner && !ownerItems.some((item) => Number(item.id) === Number(project.owner.id))) {
            ownerItems.push(project.owner);
        }
        const ownerOptions = ownerItems.map((item) => (
            `<option value="${item.id}" data-grupo-nome="${escapeHtml(item.grupo_nome || "")}" ${selectedOwnerId === Number(item.id) ? "selected" : ""}>${escapeHtml(item.nome)}${item.grupo_nome ? ` · ${escapeHtml(item.grupo_nome)}` : ""}</option>`
        )).join("");
        const stakeholderOptions = state.pessoas.map((item) => (
            `<option value="${item.id}" ${project.stakeholder && Number(project.stakeholder.id) === Number(item.id) ? "selected" : ""}>${escapeHtml(personLabel(item))}</option>`
        )).join("");
        const selectedResponsibleId = project.responsaveis && project.responsaveis.length
            ? Number(project.responsaveis[0].id)
            : null;
        const responsibleItems = [...state.responsaveis];
        (project.responsaveis || []).forEach((person) => {
            if (!responsibleItems.some((item) => Number(item.id) === Number(person.id))) responsibleItems.push(person);
        });
        const responsibleOptions = responsibleItems.map((item) => (
            `<option value="${item.id}" data-grupo-nome="${escapeHtml(item.grupo_nome || "")}" ${Number(item.id) === selectedResponsibleId ? "selected" : ""}>${escapeHtml(item.nome)}${item.grupo_nome ? ` · ${escapeHtml(item.grupo_nome)}` : ""}</option>`
        )).join("");
        const modelId = project.cronograma_modelo ? Number(project.cronograma_modelo.id) : null;
        const methodology = project.metodologia || "agil";
        const modelOptions = state.modelos
            .filter((item) => !item.metodologia || item.metodologia === methodology || Number(item.id) === modelId)
            .map((item) => (
            `<option value="${item.id}" ${Number(item.id) === modelId ? "selected" : ""}>${escapeHtml(item.nome)}${item.esperada ? " · Recomendada" : ""}</option>`
            )).join("");
        const hasSchedule = (project.etapas || []).length > 0 || (project.tarefas_sem_etapa || []).length > 0;
        const cslogForecastActive = Boolean(
            project.tem_cslog
            && project.cslog_prazo_dias_uteis
            && (project.cslog_orcamento_recebido_em || project.cslog_data_inicio)
            && project.cslog_data_entrega_prevista
        );
        const cslogCalculatedAttr = cslogForecastActive ? "readonly" : "";
        const cslogDeliveryLabel = project.cslog_previsao_origem === "inicio"
            ? "Entrega CSLOG prevista"
            : "Entrega CSLOG estimada";
        const cslogDeliveryHelp = project.cslog_previsao_origem === "inicio"
            ? "Calculada pela data real de início + prazo CSLOG em dias úteis."
            : "Previsão provisória calculada pelo orçamento + prazo CSLOG. Será recalculada quando o início real for informado.";

        return `
            <section class="projetos-detail-editor ${expanded ? "is-open" : ""}">
                <button
                    type="button"
                    class="projetos-detail-editor__toggle"
                    data-project-editor-toggle
                    aria-expanded="${expanded ? "true" : "false"}"
                    aria-controls="projetosProjectEditorContent"
                >
                    <div>
                        <h3>Dados do projeto</h3>
                        <span data-project-editor-hint>${expanded ? "Ocultar campos de edição" : "Expandir campos de edição"}</span>
                        ${project.integrado_tiflux ? `<small class="projetos-integration-state is-linked"><i class="fa fa-link"></i> Integrado ao TiFlux${project.ticket_tiflux ? ` · ${escapeHtml(project.ticket_tiflux)}` : ""}</small>` : `<small class="projetos-integration-state is-pending"><i class="fa fa-clock-o"></i> Aguardando integração TiFlux</small>`}
                    </div>
                    <i class="fa fa-chevron-down" aria-hidden="true"></i>
                </button>
                <div class="projetos-detail-editor__content" id="projetosProjectEditorContent" ${expanded ? "" : "hidden"}>
                    <div class="projetos-detail-form-grid">
                    <label class="projetos-detail-field projetos-detail-field--span-2">
                        <span>Projeto</span>
                        <input class="ws-form-control" type="text" data-project-field="nome" value="${escapeHtml(project.nome || "")}">
                    </label>
                    <div class="projetos-detail-field projetos-detail-field--span-2">
                        <span>Referência TiFlux</span>
                        <span class="projetos-field-with-action">
                            <input class="ws-form-control" type="text" data-project-field="referencia" value="${escapeHtml(project.referencia || "")}" placeholder="Referência TiFlux">
                            <button type="button" class="projetos-field-link" data-project-external-link="referencia" title="Exibir URL da referência" aria-label="Exibir URL da referência"><i class="fa fa-link" aria-hidden="true"></i></button>
                        </span>
                        <span class="projetos-reference-url" data-project-url-panel="referencia" ${project.referencia_url ? "" : "hidden"}>
                            <input class="ws-form-control" type="url" maxlength="1000" data-project-url-field="referencia" value="${escapeHtml(project.referencia_url || "")}" placeholder="https://endereco-da-referencia">
                            <button type="button" class="projetos-reference-url__open" data-project-url-open="referencia" title="Abrir referência em outra aba" aria-label="Abrir referência em outra aba" ${project.referencia_url ? "" : "hidden"}><i class="fa fa-external-link" aria-hidden="true"></i></button>
                        </span>
                    </div>
                    <div class="projetos-detail-field projetos-detail-field--span-2">
                        <span>Referência CSLOG</span>
                        <span class="projetos-field-with-action">
                            <input class="ws-form-control" type="text" maxlength="120" data-project-field="cslog" value="${escapeHtml(project.cslog || "")}" placeholder="Referência CSLOG">
                            <button type="button" class="projetos-field-link" data-project-external-link="cslog" title="Exibir URL da referência" aria-label="Exibir URL da referência"><i class="fa fa-link" aria-hidden="true"></i></button>
                        </span>
                        <span class="projetos-reference-url" data-project-url-panel="cslog" ${project.cslog_url ? "" : "hidden"}>
                            <input class="ws-form-control" type="url" maxlength="1000" data-project-url-field="cslog" value="${escapeHtml(project.cslog_url || "")}" placeholder="https://endereco-da-referencia">
                            <button type="button" class="projetos-reference-url__open" data-project-url-open="cslog" title="Abrir referência em outra aba" aria-label="Abrir referência em outra aba" ${project.cslog_url ? "" : "hidden"}><i class="fa fa-external-link" aria-hidden="true"></i></button>
                        </span>
                    </div>
                    <label class="projetos-detail-field projetos-detail-field--span-2">
                        <span>Mesa</span>
                        <input class="ws-form-control" type="text" value="${escapeHtml(project.mesa || project.desk_name || project.tiflux_desk_name || "")}" placeholder="Mesa recebida do TiFlux" readonly>
                    </label>
                    <label class="projetos-detail-field projetos-detail-field--span-2">
                        <span>Categoria</span>
                        <input class="ws-form-control" type="text" maxlength="150" data-project-field="categoria" value="${escapeHtml(project.categoria || "")}" placeholder="Categoria do projeto">
                    </label>
                    <label class="projetos-detail-field projetos-detail-field--span-4">
                        <span>Serviço completo</span>
                        <input class="ws-form-control" type="text" readonly value="${escapeHtml(projectServiceName(project))}" placeholder="Serviço recebido do TiFlux">
                    </label>
                    <label class="projetos-detail-field projetos-detail-field--span-2">
                        <span>Grupo</span>
                        <select class="ws-form-control" data-project-field="grupo_id">${optionsHtml(state.grupos, groupId, "Selecione")}</select>
                    </label>
                    <label class="projetos-detail-field projetos-detail-field--span-2">
                        <span>Cliente</span>
                        <select class="ws-form-control" data-project-field="cliente_id">${optionsHtml(state.clientes, clientId, clientEmptyLabel)}</select>
                    </label>
                    <label class="projetos-detail-field projetos-detail-field--span-2">
                        <span>Empresa</span>
                        <select class="ws-form-control" data-project-field="empresa_id">${optionsHtml(state.empresas, companyId, companyEmptyLabel)}</select>
                    </label>
                    <label class="projetos-detail-field projetos-detail-field--span-2">
                        <span>Owner</span>
                        <select class="ws-form-control" data-project-field="owner_id">${project.owner ? "" : `<option value="">Selecione o Owner</option>`}${ownerOptions}</select>
                    </label>
                    <label class="projetos-detail-field projetos-detail-field--span-2">
                        <span class="projetos-field-label-row">
                            <span>Stakeholder</span>
                            <button type="button" class="projetos-inline-action projetos-inline-action--icon" data-external-inline-toggle="stakeholder:${project.id}" title="Adicionar Stakeholder externo" aria-label="Adicionar Stakeholder externo"><i class="fa fa-user-plus" aria-hidden="true"></i></button>
                        </span>
                        <select class="ws-form-control" data-project-field="stakeholder_id"><option value="">Sem Stakeholder</option>${stakeholderOptions}</select>
                    </label>
                    <label class="projetos-detail-field projetos-detail-field--span-2">
                        <span>Líder do projeto</span>
                        <select class="ws-form-control" data-project-field="responsavel_ids"><option value="">Sem responsável</option>${responsibleOptions}</select>
                        <small class="projetos-detail-field__help">Coordena a execução das fases/Sprints e pode delegar tarefas e subtarefas para outros analistas.</small>
                    </label>
                    <div class="projetos-external-executor projetos-external-executor--subtask projetos-detail-field--span-6" data-external-inline-panel="stakeholder:${project.id}" hidden>
                        <label><span>Nome do Stakeholder externo</span><input class="ws-form-control" type="text" data-external-name="stakeholder:${project.id}" autocomplete="off"></label>
                        <button type="button" class="projetos-external-email-toggle" data-external-email-toggle="stakeholder:${project.id}" title="Incluir e-mail" aria-label="Incluir e-mail"><i class="fa fa-envelope"></i></button>
                        <label class="projetos-external-executor__email" data-external-email-field="stakeholder:${project.id}" hidden><span>E-mail</span><input class="ws-form-control" type="email" data-external-email="stakeholder:${project.id}" autocomplete="off"></label>
                        <button type="button" class="ws-button ws-button--primary ws-button--sm" data-external-save="stakeholder:${project.id}">Adicionar</button>
                    </div>
                    <label class="projetos-detail-field projetos-detail-field--span-2">
                        <span class="projetos-field-label-row"><span>Metodologia</span><button type="button" class="projetos-methodology-help" data-methodology-help="editor"><i class="fa fa-circle-question"></i> Entenda</button></span>
                        <select class="ws-form-control" data-project-field="metodologia">
                            ${[["agil","Ágil"],["waterfall","Waterfall"]].map(([value,label]) => `<option value="${value}" ${methodology === value ? "selected" : ""}>${label}</option>`).join("")}
                        </select>
                    </label>
                    <label class="projetos-detail-field projetos-detail-field--span-2">
                        <span>Tipo do projeto / Cronograma</span>
                        <select class="ws-form-control" data-project-field="cronograma_modelo_id">
                            <option value="">Selecione o tipo</option>${modelOptions}
                        </select>
                    </label>
                    <label class="projetos-detail-field projetos-detail-field--span-2">
                        <span>Prioridade</span>
                        <select class="ws-form-control" data-project-field="prioridade">
                            ${[["baixa","Baixa"],["media","Média"],["alta","Alta"],["critica","Crítica"]].map(([value,label]) => `<option value="${value}" ${project.prioridade === value ? "selected" : ""}>${label}</option>`).join("")}
                        </select>
                    </label>
                    <div class="projetos-methodology-guide projetos-methodology-guide--compact projetos-detail-field--span-6" data-project-methodology-guide>
                        ${methodologyGuideHtml(methodology, true)}
                    </div>
                    <label class="projetos-detail-field">
                        <span>Data de abertura do projeto</span>
                        <input class="ws-form-control" type="date" data-project-field="data_abertura" value="${escapeHtml(project.data_abertura || "")}">
                    </label>
                    <label class="projetos-detail-field">
                        <span>Data de início do cronograma</span>
                        <input class="ws-form-control" type="date" data-project-field="data_inicio" value="${escapeHtml(project.data_inicio || "")}">
                    </label>
                    <label class="projetos-detail-field">
                        <span>Duração (dias úteis)</span>
                        <input class="ws-form-control" type="number" min="1" max="2600" step="1" data-project-field="duracao_dias_uteis" value="${Number(project.duracao_dias_uteis || 15)}" ${cslogCalculatedAttr}>
                        ${cslogForecastActive ? `<small class="projetos-detail-field__help">Recalculada automaticamente pelo prazo CSLOG vigente.</small>` : ""}
                    </label>
                    <label class="projetos-detail-field">
                        <span>Janela útil do projeto</span>
                        <input class="ws-form-control" type="text" value="${formatHours(project.apontamento?.janela_util_horas)}" readonly>
                        <small class="projetos-detail-field__help">Referência de calendário: ${project.apontamento?.dias_planejados ?? "—"} dia(s) útil(eis) × 10h (08h às 18h). Não representa esforço humano.</small>
                    </label>
                    <label class="projetos-detail-field">
                        <span>Horas planejadas de esforço QORE</span>
                        <input class="ws-form-control" type="number" min="0" step="0.25" data-project-field="horas_planejadas" value="${project.apontamento?.planejado_horas ?? ""}" placeholder="Ex.: 50">
                        <small class="projetos-detail-field__help">Estimativa real de esforço da equipe QORE para este projeto.</small>
                    </label>
                    <label class="projetos-detail-field">
                        <span>Horas apontadas QORE</span>
                        <input class="ws-form-control" type="text" value="${formatHours(project.apontamento?.horas || 0)}" readonly>
                        <small class="projetos-detail-field__help">Retorno automático dos apontamentos do TiFlux.</small>
                    </label>
                    <label class="projetos-detail-field">
                        <span>Média planejada de esforço QORE / dia</span>
                        <input class="ws-form-control" type="text" value="${project.apontamento?.media_planejada_dia != null ? `${formatHours(project.apontamento.media_planejada_dia)}/dia` : "—"}" readonly>
                        <small class="projetos-detail-field__help">Horas planejadas de esforço ÷ dias úteis do cronograma.</small>
                    </label>
                    <label class="projetos-detail-field">
                        <span>Média apontada QORE / dia</span>
                        <input class="ws-form-control" type="text" value="${project.apontamento?.media_apontada_dia != null ? `${formatHours(project.apontamento.media_apontada_dia)}/dia` : "—"}" readonly>
                        <small class="projetos-detail-field__help">${project.apontamento?.dias_decorridos ?? "—"} dia(s) útil(eis) decorridos.</small>
                    </label>
                    <label class="projetos-detail-field">
                        <span>Homologação prevista</span>
                        <input class="ws-form-control" type="date" data-project-field="data_homologacao_prevista" value="${escapeHtml(project.data_homologacao_prevista || "")}" ${cslogCalculatedAttr}>
                    </label>
                    <label class="projetos-detail-field">
                        <span>Entrega / Go Live prevista</span>
                        <input class="ws-form-control" type="date" data-project-field="data_go_live_prevista" value="${escapeHtml(project.data_go_live_prevista || "")}" ${cslogCalculatedAttr}>
                    </label>
                    <label class="projetos-detail-field">
                        <span>Conclusão prevista</span>
                        <input class="ws-form-control" type="date" data-project-field="data_fim_prevista" value="${escapeHtml(project.data_fim_prevista || "")}" ${cslogCalculatedAttr}>
                    </label>
                    <label class="projetos-detail-field">
                        <span>Data de conclusão real</span>
                        <input class="ws-form-control" type="date" data-project-field="data_conclusao" value="${escapeHtml(project.data_conclusao || "")}">
                    </label>
                    <label class="projetos-detail-field">
                        <span>Status do projeto</span>
                        <select class="ws-form-control" data-project-field="status">
                            ${[["rascunho","Rascunho"],["em_andamento","Em andamento"],["aguardando","Aguardando"],["pausado","Pausado"],["homologacao","Homologação"],["encerramento","Encerramento"],["concluido","Concluído"],["cancelado","Cancelado"]].map(([value,label]) => `<option value="${value}" ${project.status === value ? "selected" : ""} ${value === "rascunho" && hasSchedule ? "disabled" : ""}>${label}</option>`).join("")}
                        </select>
                    </label>
                    ${project.tem_cslog ? `
                    <div class="projetos-cslog-editor-title projetos-detail-field--span-6">
                        <strong><i class="fa fa-handshake-o" aria-hidden="true"></i> Dependência externa · CSLOG</strong>
                        <span>Orçamento + prazo geram uma previsão provisória. Quando o início CSLOG for informado, o prazo passa a contar dessa data e o cronograma QORE é recalculado automaticamente.</span>
                    </div>
                    <label class="projetos-detail-field">
                        <span>Ticket aberto na CSLOG</span>
                        <input class="ws-form-control" type="date" data-project-field="cslog_ticket_aberto_em" value="${escapeHtml(project.cslog_ticket_aberto_em || "")}">
                        <small class="projetos-detail-field__help">Marca quando a QORE concluiu a etapa inicial e acionou o fornecedor.</small>
                    </label>
                    <label class="projetos-detail-field">
                        <span>Escopo CSLOG fechado em</span>
                        <input class="ws-form-control" type="date" data-project-field="cslog_escopo_fechado_em" value="${escapeHtml(project.cslog_escopo_fechado_em || "")}">
                    </label>
                    <label class="projetos-detail-field">
                        <span>Orçamento recebido em</span>
                        <input class="ws-form-control" type="date" data-project-field="cslog_orcamento_recebido_em" value="${escapeHtml(project.cslog_orcamento_recebido_em || "")}">
                    </label>
                    <label class="projetos-detail-field">
                        <span>Valor do orçamento</span>
                        <input class="ws-form-control" type="number" min="0" step="0.01" data-project-field="cslog_orcamento_valor" value="${project.cslog_orcamento_valor ?? ""}" placeholder="0,00">
                    </label>
                    <label class="projetos-detail-field">
                        <span>Horas técnicas CSLOG (HTs)</span>
                        <input class="ws-form-control" type="number" min="0" step="0.25" data-project-field="cslog_horas_tecnicas" value="${project.cslog_horas_tecnicas ?? ""}" placeholder="Ex.: 56">
                    </label>
                    <label class="projetos-detail-field">
                        <span>Prazo CSLOG (dias úteis)</span>
                        <input class="ws-form-control" type="number" min="1" step="1" data-project-field="cslog_prazo_dias_uteis" value="${project.cslog_prazo_dias_uteis ?? ""}" placeholder="Ex.: 15">
                        <small class="projetos-detail-field__help">Com a data do orçamento, este prazo já gera a primeira previsão.</small>
                    </label>
                    <label class="projetos-detail-field">
                        <span>Média técnica CSLOG / dia</span>
                        <input class="ws-form-control" type="text" value="${project.cslog_media_horas_dia != null ? `${formatHours(project.cslog_media_horas_dia)}/dia` : "—"}" readonly>
                        <small class="projetos-detail-field__help">HTs contratadas ÷ prazo CSLOG em dias úteis.</small>
                    </label>
                    <label class="projetos-detail-field">
                        <span>Início CSLOG</span>
                        <input class="ws-form-control" type="date" data-project-field="cslog_data_inicio" value="${escapeHtml(project.cslog_data_inicio || "")}">
                        <small class="projetos-detail-field__help">Quando informado, substitui o orçamento como base da contagem do prazo.</small>
                    </label>
                    <label class="projetos-detail-field">
                        <span>${cslogDeliveryLabel}</span>
                        <input class="ws-form-control" type="date" data-project-field="cslog_data_entrega_prevista" value="${escapeHtml(project.cslog_data_entrega_prevista || "")}" readonly>
                        <small class="projetos-detail-field__help">${escapeHtml(cslogDeliveryHelp)}</small>
                    </label>
                    <label class="projetos-detail-field">
                        <span>Folga QORE após CSLOG</span>
                        <select class="ws-form-control" data-project-field="cslog_folga_qore_dias_uteis">
                            <option value="1" ${Number(project.cslog_folga_qore_dias_uteis || 2) === 1 ? "selected" : ""}>1 dia útil</option>
                            <option value="2" ${Number(project.cslog_folga_qore_dias_uteis || 2) === 2 ? "selected" : ""}>2 dias úteis</option>
                        </select>
                        <small class="projetos-detail-field__help">Fôlego para validação final, homologação e Go Live QORE.</small>
                    </label>
                    <label class="projetos-detail-field">
                        <span>Entrega real CSLOG</span>
                        <input class="ws-form-control" type="date" data-project-field="cslog_data_entrega_real" value="${escapeHtml(project.cslog_data_entrega_real || "")}">
                    </label>

                    ` : ""}
                    <label class="projetos-detail-field projetos-detail-field--span-6">
                        <span>Descrição</span>
                        <textarea class="ws-form-control" rows="3" data-project-field="descricao">${escapeHtml(project.descricao || "")}</textarea>
                    </label>
                    </div>
                    <div class="projetos-detail-editor__actions">
                        <button type="button" class="ws-button ws-button--primary ws-button--sm" data-project-save="${project.id}">
                            <i class="fa fa-save"></i> Salvar alterações
                        </button>
                    </div>
                </div>
            </section>`;
    }

    function stageActionsHtml(stage, project) {
        const completed = stage.status === "concluida";
        const typeName = stage.tipo_nome || (stage.tipo === "sprint" ? "Sprint" : "Fase");
        return `
            <div class="projetos-stage-actions">
                <button type="button" class="ws-button ${completed ? "ws-button--secondary" : "ws-button--primary"} ws-button--sm" data-stage-complete="${stage.id}" data-stage-action="${completed ? "reopen" : "complete"}">
                    <i class="fa ${completed ? "fa-undo" : "fa-check-double"}" aria-hidden="true"></i> ${completed ? `Reabrir ${escapeHtml(typeName)}` : `Concluir ${escapeHtml(typeName)}`}
                </button>
            </div>`;
    }

    function renderProjectDetail(project) {
        const editorExpanded = el.drawerBody.querySelector("[data-project-editor-toggle]")?.getAttribute("aria-expanded") === "true";
        const renderedStages = Array.from(el.drawerBody.querySelectorAll(".projetos-stage[data-stage-id]"));
        const hadStageState = renderedStages.length > 0;
        const openStageIds = new Set(renderedStages.filter((item) => item.classList.contains("is-open")).map((item) => Number(item.dataset.stageId || 0)));
        const renderedTasks = Array.from(el.drawerBody.querySelectorAll(".projetos-task-card[data-task-id]"));
        const hadTaskState = renderedTasks.length > 0;
        const collapsedTaskIds = new Set(renderedTasks.filter((item) => !item.classList.contains("is-open")).map((item) => Number(item.dataset.taskId || 0)));
        if (Number(state.projetoAberto?.id || 0) !== Number(project.id || 0)) projectEditorCalculationSource = "duracao";
        state.projetoAberto = project;
        el.drawerCodigo.textContent = project.codigo || "PROJETO";
        el.drawerTitulo.textContent = project.nome || "Projeto";
        updateDrawerFavorite(project.id);
        if (el.drawerBadges) {
            el.drawerBadges.innerHTML = `<span class="projetos-pill projetos-pill--status">${escapeHtml(project.status_nome || "Rascunho")}</span><span class="projetos-pill" data-situacao="${escapeHtml(project.situacao || "no_prazo")}" title="${escapeHtml(project.saude_motivo || "")}">Saúde: ${escapeHtml(project.saude_nome || project.situacao_nome || "Normal")}</span>${projectDeadlineBadgeHtml(project)}`;
        }
        if (el.drawerProgress) {
            el.drawerProgress.innerHTML = `<span><strong>Progresso ${Number(project.progresso || 0).toFixed(0)}%</strong><small>Esperado ${Number(project.progresso_esperado || 0).toFixed(0)}%</small></span>${progressHtml(project.progresso)}`;
        }

        const stages = project.etapas || [];
        const flatStages = flattenProjectStages(stages);
        const totalTasks = flatStages.reduce((acc, stage) => acc + (stage.tarefas || []).length, 0) + (project.tarefas_sem_etapa || []).length;
        const phaseCount = flatStages.filter((stage) => stage.tipo === "fase").length;
        const sprintCount = flatStages.filter((stage) => stage.tipo === "sprint").length;
        const defaultOpenIds = new Set();
        const markFirstIncomplete = (items) => {
            const first = (items || []).find((item) => item.status !== "concluida");
            if (!first) return;
            defaultOpenIds.add(Number(first.id));
            if ((first.sprints || []).length) markFirstIncomplete(first.sprints);
        };
        markFirstIncomplete(stages);

        const renderStageCard = (stage, depth = 0) => {
            const completed = stage.status === "concluida";
            const shouldOpen = hadStageState ? openStageIds.has(Number(stage.id)) : defaultOpenIds.has(Number(stage.id));
            const children = stage.sprints || [];
            const directTasks = stage.tarefas || [];
            const totalStageTasks = collectStageTasks(stage).length;
            return `
                <article class="projetos-stage ${depth ? "projetos-stage--child" : ""} ${stage.tipo === "fase" ? "projetos-stage--phase" : "projetos-stage--sprint"} ${shouldOpen ? "is-open" : ""} ${overdueInfo(stage).late ? "is-overdue" : ""}" data-stage-id="${stage.id}" data-stage-status="${escapeHtml(stage.status || "")}" data-stage-depth="${depth}">
                    <div class="projetos-stage__header">
                        <button type="button" class="projetos-stage__summary" data-stage-toggle="${stage.id}" aria-expanded="${shouldOpen ? "true" : "false"}">
                            <i class="fa ${stage.tipo === "sprint" ? "fa-bolt" : "fa-layer-group"}"></i>
                            <span class="projetos-stage__identity">
                                <span class="projetos-stage__eyebrow">${escapeHtml(stage.tipo_nome || (stage.tipo === "sprint" ? "Sprint" : "Fase"))} · ${escapeHtml(stage.momento_nome || "Planejamento")}</span>
                                <strong>${escapeHtml(stage.nome)}</strong>
                                ${overdueBadge(stage)}
                                <small>${formatDate(stage.data_inicio)} → ${formatDate(stage.data_fim_prevista)} · ${totalStageTasks} tarefas${children.length ? ` · ${children.length} Sprints` : ""}</small>
                            </span>
                        </button>
                        ${stageActionsHtml(stage, project)}
                        <span class="projetos-stage__status" style="--stage-progress: ${Math.max(0, Math.min(100, Number(stage.progresso || 0)))}%">
                            <span class="projetos-stage__status-pill" data-status="${escapeHtml(stage.status || "")}">${escapeHtml(stage.status_nome || "Não iniciada")}</span>
                            <small>${Number(stage.progresso || 0).toFixed(0)}%</small>
                            <button type="button" class="projetos-stage__chevron" data-stage-toggle="${stage.id}" aria-expanded="${shouldOpen ? "true" : "false"}" aria-label="Abrir ou recolher ${escapeHtml(stage.tipo_nome || "etapa")}"><i class="fa fa-chevron-down"></i></button>
                        </span>
                    </div>
                    <div class="projetos-stage__body">
                        ${directTasks.map((task) => renderTask(task, project, !hadTaskState || !collapsedTaskIds.has(Number(task.id)))).join("")}
                        ${children.length ? `<div class="projetos-stage__children">${children.map((child) => renderStageCard(child, depth + 1)).join("")}</div>` : ""}
                        ${!directTasks.length && !children.length ? `<div class="projetos-task-row__meta">Nenhuma tarefa nesta etapa.</div>` : ""}
                    </div>
                </article>`;
        };

        const hierarchyText = project.metodologia === "waterfall"
            ? "Fase → Tarefa → Subtarefa"
            : "Sprint → Tarefa → Subtarefa";
        const currentStageLabel = project.metodologia === "waterfall" ? "Fase atual" : "Sprint atual";
        const currentStageName = project.metodologia === "waterfall"
            ? (project.fase_atual?.nome || project.etapa_atual?.nome || "—")
            : (project.sprint_atual?.nome || project.etapa_atual?.nome || "—");
        const structureCountText = project.metodologia === "waterfall"
            ? `${phaseCount} fases`
            : `${sprintCount} sprints`;
        const homologationTarget = projectManagementTaskTarget(project, "homologacao");
        const goLiveTarget = projectManagementTaskTarget(project, "golive");
        const conclusionTarget = projectManagementTaskTarget(project, "conclusao");
        const cslogSendTaskId = Number(project.cslog_funil?.tarefa_envio_cslog_id || 0);
        const cslogSendStageId = Number(project.cslog_funil?.tarefa_envio_cslog_etapa_id || 0);
        const cslogSendTargetAttrs = cslogSendTaskId
            ? `data-management-target="cslog-envio" data-target-task-id="${cslogSendTaskId}" data-target-stage-id="${cslogSendStageId}" role="button" tabindex="0" title="Ir para a tarefa de envio à CSLOG"`
            : "";

        el.drawerBody.innerHTML = `
            ${project.__detail_warning ? `<div class="projetos-detail-warning"><i class="fa fa-exclamation-triangle"></i><span>${escapeHtml(project.__detail_warning)}</span></div>` : ""}
            <div class="projetos-drawer-save-state is-saved" data-drawer-save-state role="status" aria-live="polite"><i class="fa fa-check-circle" aria-hidden="true"></i><span>Alterações salvas automaticamente</span></div>
            <section class="projetos-management-summary">
                <div class="projetos-management-summary__head"><div><strong>Visão gerencial</strong><span>Status global, momento do cronograma e compromissos de entrega.</span></div><span class="projetos-pill projetos-pill--moment" data-moment-key="${escapeHtml(projectTableKey(project.momento_atual || ""))}">${escapeHtml(project.momento_atual_nome || "Planejamento")}</span></div>
                <div class="projetos-management-summary__grid">
                    <div><small>Status global</small><strong>${escapeHtml(project.status_nome || "Rascunho")}</strong></div>
                    <div><small>Momento atual</small><strong>${escapeHtml(project.momento_atual_nome || "Planejamento")}</strong></div>
                    <div><small>${escapeHtml(currentStageLabel)}</small><strong>${escapeHtml(currentStageName)}</strong></div>
                    <div><small>Marcos</small><strong>${Number(project.marcos_concluidos || 0)} de ${Number(project.marcos_total || 0)}</strong><span>${escapeHtml(project.marco_atual?.nome || "Sem marco atual")}</span></div>
                    <div class="projetos-management-hours" data-hours-status="${escapeHtml(project.apontamento?.status || "sem_planejamento")}"><small>Apontamento QORE</small><strong>${formatHours(project.apontamento?.horas || 0)}${project.apontamento?.planejado_horas ? ` / ${formatHours(project.apontamento.planejado_horas)}` : ""}</strong><span>${escapeHtml(project.apontamento?.status_nome || "Sem horas planejadas")}${project.apontamento?.consumo_percentual != null ? ` · ${Number(project.apontamento.consumo_percentual).toFixed(0)}% consumido` : ""}${project.apontamento?.media_apontada_dia != null ? ` · média ${formatHours(project.apontamento.media_apontada_dia)}/dia` : ""}</span></div>
                    <div ${managementTargetAttrs("homologacao", homologationTarget)}><small>Homologação prevista</small><strong>${formatDate(projectHomologationValue(project)) || "—"}</strong>${homologationTarget?.task?.nome ? `<span>Ir para ${escapeHtml(homologationTarget.task.nome)}</span>` : ""}</div>
                    <div ${managementTargetAttrs("golive", goLiveTarget)}><small>${project.tem_cslog ? "Go Live vigente" : "Entrega / Go Live"}</small><strong>${project.tem_cslog && !projectGoLiveValue(project) ? "Aguardando CSLOG" : (formatDate(projectGoLiveValue(project)) || "—")}</strong><span>${project.tem_cslog ? escapeHtml(project.data_go_live_origem || "Aguardando CSLOG") : (goLiveTarget?.task?.nome ? `Ir para ${escapeHtml(goLiveTarget.task.nome)}` : "")}</span></div>
                    <div ${managementTargetAttrs("conclusao", conclusionTarget)}><small>Conclusão prevista</small><strong>${formatDate(project.data_fim_prevista) || "—"}</strong>${conclusionTarget?.task?.nome ? `<span>Ir para ${escapeHtml(conclusionTarget.task.nome)}</span>` : ""}</div>
                </div>
            </section>
            ${project.tem_cslog ? `
            <section class="projetos-cslog-summary">
                <div class="projetos-cslog-summary__head">
                    <div><strong>Dependência externa · CSLOG</strong><span>Funil de prazo do fornecedor: da abertura do ticket até a entrega, sem misturar o tempo da QORE.</span></div>
                    <span class="projetos-cslog-summary__status">${escapeHtml(project.cslog_status_fornecedor_nome || "Aguardando orçamento")}</span>
                </div>
                <div class="projetos-cslog-timeline">
                    <div class="projetos-cslog-timeline__step is-qore-target ${project.cslog_funil?.envio_qore_status === "atrasado" ? "is-late" : project.cslog_ticket_aberto_em ? "is-done" : ""}" ${cslogSendTargetAttrs}>
                        <small>Envio previsto QORE</small>
                        <strong>${formatDate(project.cslog_funil?.envio_previsto_cslog) || "—"}</strong>
                        <span>${escapeHtml(project.cslog_funil?.envio_qore_status_nome || "Data esperada definida pela tarefa do cronograma")}${cslogSendTaskId ? " · Ir para tarefa" : ""}</span>
                    </div>
                    <div class="projetos-cslog-timeline__step ${project.cslog_ticket_aberto_em ? "is-done" : ""}">
                        <small>Ticket CSLOG aberto</small>
                        <strong>${formatDate(project.cslog_ticket_aberto_em) || "—"}</strong>
                        <span>${project.cslog_funil?.qore_ate_abertura_cslog_dias_uteis != null ? `${formatBusinessDays(project.cslog_funil.qore_ate_abertura_cslog_dias_uteis)} desde a abertura QORE` : "Informe a abertura do ticket CSLOG"}</span>
                    </div>
                    <div class="projetos-cslog-timeline__step">
                        <small>Escopo CSLOG fechado</small>
                        <strong>${formatDate(project.cslog_escopo_fechado_em) || "—"}</strong>
                        <span>${project.cslog_funil?.fechamento_escopo_dias_uteis != null ? formatBusinessDays(project.cslog_funil.fechamento_escopo_dias_uteis) : "Aguardando fechamento"}</span>
                    </div>
                    <div class="projetos-cslog-timeline__step">
                        <small>Orçamento recebido</small>
                        <strong>${formatDate(project.cslog_orcamento_recebido_em) || "—"}</strong>
                        <span>${project.cslog_funil?.ate_orcamento_dias_uteis != null ? `${formatBusinessDays(project.cslog_funil.ate_orcamento_dias_uteis)} após o escopo` : "Aguardando orçamento"}</span>
                    </div>
                    <div class="projetos-cslog-timeline__step">
                        <small>Início CSLOG</small>
                        <strong>${formatDate(project.cslog_data_inicio) || "—"}</strong>
                        <span>${project.cslog_funil?.espera_inicio_dias_uteis != null ? `${formatBusinessDays(project.cslog_funil.espera_inicio_dias_uteis)} após orçamento` : "Aguardando início"}</span>
                    </div>
                    <div class="projetos-cslog-timeline__step is-target">
                        <small>${project.cslog_funil?.previsao_origem === "inicio" ? "Entrega prevista" : "Entrega estimada"}</small>
                        <strong>${formatDate(project.cslog_data_entrega_prevista) || "—"}</strong>
                        <span>${project.cslog_funil?.previsao_origem_nome || "Aguardando prazo CSLOG"}</span>
                    </div>
                    <div class="projetos-cslog-timeline__step ${project.cslog_funil?.desempenho === "atrasado" ? "is-late" : project.cslog_data_entrega_real ? "is-done" : ""}">
                        <small>Entrega / encerramento real</small>
                        <strong>${formatDate(project.cslog_data_entrega_real) || "—"}</strong>
                        <span>${escapeHtml(project.cslog_funil?.desempenho_nome || "Aguardando entrega")}</span>
                    </div>
                </div>
                <div class="projetos-cslog-summary__grid projetos-cslog-summary__grid--metrics">
                    <div><small>Desvio do envio QORE</small><strong class="${Number(project.cslog_funil?.desvio_envio_qore_dias_uteis || 0) > 0 ? "is-negative" : "is-positive"}">${project.cslog_funil?.desvio_envio_qore_dias_uteis != null ? formatBusinessDays(project.cslog_funil.desvio_envio_qore_dias_uteis) : "—"}</strong><span>Previsto no cronograma × ticket aberto</span></div>
                    <div><small>Tempo QORE até abrir CSLOG</small><strong>${formatBusinessDays(project.cslog_funil?.qore_ate_abertura_cslog_dias_uteis)}</strong><span>Da abertura do projeto ao acionamento do fornecedor</span></div>
                    <div><small>CSLOG para fechar escopo</small><strong>${formatBusinessDays(project.cslog_funil?.fechamento_escopo_dias_uteis)}</strong><span>Ticket aberto → escopo fechado</span></div>
                    <div><small>Escopo → orçamento</small><strong>${formatBusinessDays(project.cslog_funil?.ate_orcamento_dias_uteis)}</strong><span>Tempo até receber prazo/HTs/valor</span></div>
                    <div><small>Orçamento → início</small><strong>${formatBusinessDays(project.cslog_funil?.espera_inicio_dias_uteis)}</strong><span>Espera até o desenvolvimento começar</span></div>
                    <div><small>Prazo contratado CSLOG</small><strong>${formatBusinessDays(project.cslog_funil?.prazo_contratado_dias_uteis)}</strong><span>${project.cslog_horas_tecnicas != null ? `${formatHours(project.cslog_horas_tecnicas)} HTs${project.cslog_media_horas_dia != null ? ` · média ${formatHours(project.cslog_media_horas_dia)}/dia` : ""}` : "HTs não informadas"}</span></div>
                    <div><small>Execução CSLOG</small><strong>${project.cslog_data_entrega_real ? formatBusinessDays(project.cslog_funil?.execucao_real_dias_uteis) : escapeHtml(project.cslog_funil?.desempenho_nome || "Aguardando")}</strong><span>${project.cslog_data_entrega_real ? "Início → entrega real" : `Prazo até ${formatDate(project.cslog_data_entrega_prevista) || "—"}`}</span></div>
                    <div><small>Tempo decorrido no fornecedor</small><strong>${formatBusinessDays(project.cslog_funil?.tempo_total_fornecedor_dias_uteis)}</strong><span>Abertura CSLOG → ${project.cslog_data_entrega_real ? "entrega real" : "hoje"}</span></div>
                    <div><small>Desvio do fornecedor</small><strong class="${Number(project.cslog_funil?.desvio_entrega_dias_uteis || 0) > 0 ? "is-negative" : "is-positive"}">${project.cslog_funil?.desvio_entrega_dias_uteis != null ? formatBusinessDays(project.cslog_funil.desvio_entrega_dias_uteis) : "—"}</strong><span>${escapeHtml(project.cslog_funil?.desempenho_nome || "Sem comparação disponível")}</span></div>
                    <div><small>Baseline QORE × plano vigente</small><strong>${formatDate(project.data_go_live_qore_preliminar) || "—"} → ${formatDate(project.data_go_live_prevista) || "—"}</strong><span>${project.cslog_desvio_go_live_dias_uteis != null ? `${formatBusinessDays(project.cslog_desvio_go_live_dias_uteis)} de replanejamento` : "Aguardando retorno CSLOG"}</span></div>
                    <div><small>Previsão do cronograma</small><strong>${escapeHtml(project.cslog_funil?.previsao_origem_nome || "Aguardando prazo")}</strong><span>${project.cslog_data_entrega_prevista ? `CSLOG ${formatDate(project.cslog_data_entrega_prevista)} + ${Number(project.cslog_folga_qore_dias_uteis || 2)} dia(s) QORE` : "Sem previsão calculada"}</span></div>
                </div>
            </section>
            ` : ""}
            ${projectEditorHtml(project, editorExpanded)}
            <section class="projetos-detail-section">
                <div class="projetos-detail-section__title">
                    <h3>Cronograma</h3>
                    <span>${escapeHtml(project.metodologia_nome || "Metodologia")} · ${escapeHtml(hierarchyText)} · ${phaseCount} fases · ${sprintCount} sprints · ${totalTasks} tarefas</span>
                </div>
                <div id="projetosStages">${stages.map((stage) => renderStageCard(stage)).join("")}
                    ${(project.tarefas_sem_etapa || []).length ? `<article class="projetos-stage"><button type="button" class="projetos-stage__header" data-stage-toggle="sem-etapa" aria-expanded="false"><span><i class="fa fa-list-check"></i><strong>Tarefas sem etapa</strong></span><i class="fa fa-chevron-down projetos-stage__chevron"></i></button><div class="projetos-stage__body">${project.tarefas_sem_etapa.map((task) => renderTask(task, project, !hadTaskState || !collapsedTaskIds.has(Number(task.id)))).join("")}</div></article>` : ""}
                </div>
            </section>
            ${project.historico && project.historico.length ? `<section class="projetos-detail-section projetos-history-section" data-history-section><div class="projetos-detail-section__title"><div><h3>Atividade recente</h3><span>Últimos registros</span></div><button type="button" class="projetos-history-toggle" data-history-toggle aria-expanded="false" title="Expandir atividade recente" aria-label="Expandir atividade recente"><i class="fa fa-chevron-down" aria-hidden="true"></i></button></div><div class="projetos-history" data-history-body hidden>${project.historico.slice(0, 8).map((item) => `<div class="projetos-history__item"><strong>${escapeHtml(item.descricao || item.acao_nome)}</strong><small>${escapeHtml(item.usuario ? item.usuario.nome : "Sistema")} • ${formatDateTime(item.criado_em)}</small></div>`).join("")}</div></section>` : ""}
        `;
        bindDetailEvents();
        restoreDrawerPersistence(project.id);
    }

    function setDrawerSaveState(kind, message) {
        const status = el.drawerBody.querySelector("[data-drawer-save-state]");
        if (!status) return;
        status.classList.remove("is-saving", "is-saved", "is-error");
        status.classList.add(`is-${kind}`);
        const icon = status.querySelector("i");
        if (icon) {
            icon.className = kind === "saving"
                ? "fa fa-spinner fa-spin"
                : kind === "error"
                    ? "fa fa-exclamation-circle"
                    : "fa fa-check-circle";
        }
        const text = status.querySelector("span");
        if (text) text.textContent = message;
    }

    function stageApiUrl(stageId) {
        return `${api.projetos}etapas/${stageId}/`;
    }

    async function refreshProjectDetailInline() {
        if (!state.projetoAberto) return;
        try {
            const data = await request(`${api.projetos}${state.projetoAberto.id}/`);
            if (data.projeto) renderProjectDetail(data.projeto);
        } catch (error) {
            setDrawerSaveState("error", error.message);
        }
    }

    async function updateStage(stageId, payload, button) {
        if (button) button.disabled = true;
        setDrawerSaveState("saving", "Atualizando etapa...");
        try {
            const data = await request(stageApiUrl(stageId), {
                method: "PATCH",
                body: JSON.stringify(payload),
            });
            if (data.projeto) renderProjectDetail(data.projeto);
            await loadProjects(true);
            setDrawerSaveState("saved", data.mensagem || "Etapa atualizada.");
            return true;
        } catch (error) {
            setDrawerSaveState("error", error.message);
            if (button) button.disabled = false;
            return false;
        }
    }

    function bindDetailEvents() {
        const editorToggle = el.drawerBody.querySelector("[data-project-editor-toggle]");
        editorToggle?.addEventListener("click", () => {
            const editor = editorToggle.closest(".projetos-detail-editor");
            const content = el.drawerBody.querySelector("#projetosProjectEditorContent");
            const hint = editorToggle.querySelector("[data-project-editor-hint]");
            const expanded = editorToggle.getAttribute("aria-expanded") !== "true";
            editorToggle.setAttribute("aria-expanded", String(expanded));
            editor?.classList.toggle("is-open", expanded);
            if (content) content.hidden = !expanded;
            if (hint) hint.textContent = expanded ? "Ocultar campos de edição" : "Expandir campos de edição";
        });

        el.drawerBody.querySelectorAll("[data-management-target]").forEach((card) => {
            const activate = () => {
                const taskId = Number(card.dataset.targetTaskId || 0);
                if (!taskId) return;
                focusDrawerTask({
                    taskId,
                    stageId: Number(card.dataset.targetStageId || 0) || null,
                });
                captureDrawerPersistence();
            };
            card.addEventListener("click", activate);
            card.addEventListener("keydown", (event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                activate();
            });
        });

        const historyToggle = el.drawerBody.querySelector("[data-history-toggle]");
        historyToggle?.addEventListener("click", () => {
            const section = historyToggle.closest("[data-history-section]");
            const history = section?.querySelector("[data-history-body]");
            if (!history) return;
            const expanded = historyToggle.getAttribute("aria-expanded") !== "true";
            historyToggle.setAttribute("aria-expanded", String(expanded));
            historyToggle.setAttribute("title", expanded ? "Recolher atividade recente" : "Expandir atividade recente");
            historyToggle.setAttribute("aria-label", expanded ? "Recolher atividade recente" : "Expandir atividade recente");
            history.hidden = !expanded;
            section?.classList.toggle("is-open", expanded);
        });

        el.drawerBody.querySelectorAll("[data-methodology-help]").forEach((button) => {
            button.addEventListener("click", () => openMethodologyGuide("editor"));
        });

        el.drawerBody.querySelectorAll("[data-stage-toggle]").forEach((button) => {
            button.addEventListener("click", () => {
                const stage = button.closest(".projetos-stage");
                const expanded = !stage.classList.contains("is-open");
                stage.classList.toggle("is-open", expanded);
                const stageId = button.dataset.stageToggle;
                stage.querySelectorAll(`[data-stage-toggle="${stageId}"]`).forEach((toggle) => {
                    toggle.setAttribute("aria-expanded", String(expanded));
                });
            });
        });

        el.drawerBody.querySelectorAll("[data-task-toggle]").forEach((button) => {
            button.addEventListener("click", (event) => {
                event.preventDefault();
                const taskId = Number(button.dataset.taskToggle || 0);
                const card = el.drawerBody.querySelector(`.projetos-task-card[data-task-id="${taskId}"]`);
                if (!card) return;
                const expanded = !card.classList.contains("is-open");
                card.classList.toggle("is-open", expanded);
                card.querySelectorAll(`[data-task-toggle="${taskId}"]`).forEach((toggle) => {
                    toggle.setAttribute("aria-expanded", String(expanded));
                });
            });
        });

        el.drawerBody.querySelectorAll("[data-external-inline-toggle]").forEach((button) => {
            button.addEventListener("click", () => {
                const target = button.dataset.externalInlineToggle;
                const panel = el.drawerBody.querySelector(`[data-external-inline-panel="${target}"]`);
                if (!panel) return;
                panel.hidden = !panel.hidden;
                if (!panel.hidden) panel.querySelector("[data-external-name]")?.focus();
            });
        });

        el.drawerBody.querySelectorAll("[data-external-email-toggle]").forEach((button) => {
            button.addEventListener("click", () => {
                const target = button.dataset.externalEmailToggle;
                const field = el.drawerBody.querySelector(`[data-external-email-field="${target}"]`);
                if (!field) return;
                field.hidden = !field.hidden;
                if (!field.hidden) field.querySelector("input")?.focus();
            });
        });

        el.drawerBody.querySelectorAll("[data-external-save]").forEach((button) => {
            button.addEventListener("click", async () => {
                const target = button.dataset.externalSave || "";
                const nome = el.drawerBody.querySelector(`[data-external-name="${target}"]`)?.value.trim() || "";
                const email = el.drawerBody.querySelector(`[data-external-email="${target}"]`)?.value.trim() || "";
                if (!nome) {
                    toast("Informe o nome do executor externo.", true);
                    el.drawerBody.querySelector(`[data-external-name="${target}"]`)?.focus();
                    return;
                }
                button.disabled = true;
                try {
                    const data = await request(api.pessoas, {
                        method: "POST",
                        body: JSON.stringify({ nome, email, cargo: "Executor externo" }),
                    });
                    const pessoa = data.pessoa;
                    if (!pessoa?.id) throw new Error("A pessoa externa não foi retornada pela API.");
                    if (!state.pessoas.some((item) => Number(item.id) === Number(pessoa.id))) state.pessoas.push(pessoa);
                    if (target.startsWith("task:")) {
                        await updateTask(Number(target.split(":")[1] || 0), { responsavel_pessoa_id: Number(pessoa.id) });
                    } else if (target.startsWith("subtask:")) {
                        await updateSubtask(Number(target.split(":")[1] || 0), {
                            responsavel_pessoa_id: Number(pessoa.id),
                            herdar_responsavel: false,
                        });
                    } else if (target.startsWith("stakeholder:")) {
                        const select = el.drawerBody.querySelector('[data-project-field="stakeholder_id"]');
                        if (select) {
                            select.innerHTML = `<option value="">Sem Stakeholder</option>` + state.pessoas.map((item) => `<option value="${item.id}">${escapeHtml(personLabel(item))}</option>`).join("");
                            select.value = String(pessoa.id);
                        }
                    }
                    toast(target.startsWith("stakeholder:") ? "Stakeholder externo incluído e selecionado." : "Executor externo incluído com sucesso.");
                    refreshContext().catch(() => {});
                } catch (error) {
                    toast(error.message, true);
                    button.disabled = false;
                }
            });
        });

        el.drawerBody.querySelectorAll("[data-stage-replicate]").forEach((button) => {
            button.addEventListener("click", async () => {
                const stageId = Number(button.dataset.stageReplicate || 0);
                const select = el.drawerBody.querySelector(`[data-stage-responsible="${stageId}"]`);
                if (!select?.value) {
                    setDrawerSaveState("error", "Selecione o responsável que será replicado.");
                    select?.focus();
                    return;
                }
                await updateStage(stageId, {
                    acao: "replicar_responsavel",
                    responsavel_pessoa_id: Number(select.value),
                    incluir_subtarefas: Boolean(
                        el.drawerBody.querySelector(`[data-stage-include-subtasks="${stageId}"]`)?.checked
                    ),
                }, button);
            });
        });

        el.drawerBody.querySelectorAll("[data-stage-complete]").forEach((button) => {
            button.addEventListener("click", async (event) => {
                event.preventDefault();
                event.stopPropagation();
                const stageId = Number(button.dataset.stageComplete || 0);
                if (!stageId || button.disabled) return;
                const stage = findProjectStage(state.projetoAberto, stageId);
                const nomeEtapa = stage?.nome || "esta etapa";
                const tipoEtapa = stage?.tipo_nome || "Etapa";
                const tarefas = collectStageTasks(stage).filter((item) => item.status !== "cancelada");
                const pending = tarefas.reduce((total, tarefa) => total + (tarefa.checklist || []).filter((item) => !item.concluido).length, 0);
                const reabrirEtapa = button.dataset.stageAction === "reopen" || stage?.status === "concluida";
                const confirmado = await confirmWorkspace({
                    title: `${reabrirEtapa ? "Reabrir" : "Concluir"} ${tipoEtapa} ${nomeEtapa}?`,
                    message: reabrirEtapa
                        ? `As ${tarefas.length} tarefas desta ${tipoEtapa.toLowerCase()} serão reabertas e o progresso será recalculado.`
                        : `As ${tarefas.length} tarefas ativas e ${pending} subtarefas pendentes desta ${tipoEtapa.toLowerCase()} serão concluídas.`,
                    confirmLabel: reabrirEtapa ? `Reabrir ${tipoEtapa}` : `Concluir ${tipoEtapa}`,
                });
                if (!confirmado) return;
                const ok = await updateStage(stageId, { acao: reabrirEtapa ? "reabrir" : "concluir" }, button);
                if (ok) toast(`${tipoEtapa} ${reabrirEtapa ? "reaberta" : "concluída"} com sucesso.`);
            });
        });

        el.drawerBody.querySelectorAll("[data-task-complete]").forEach((button) => {
            button.addEventListener("click", async (event) => {
                event.preventDefault();
                event.stopPropagation();

                const taskId = Number(button.dataset.taskComplete || 0);
                if (!taskId || button.disabled) return;

                const stages = flattenProjectStages(state.projetoAberto?.etapas || []);
                let stage = null;
                let task = null;

                for (const itemStage of stages) {
                    const encontrada = (itemStage.tarefas || []).find(
                        (item) => Number(item.id) === taskId
                    );
                    if (encontrada) {
                        stage = itemStage;
                        task = encontrada;
                        break;
                    }
                }

                if (!task) {
                    task = (state.projetoAberto?.tarefas_sem_etapa || []).find(
                        (item) => Number(item.id) === taskId
                    ) || null;
                }

                if (!task) {
                    toast("Não foi possível localizar a tarefa selecionada.", true);
                    return;
                }

                const reabrirTarefa = button.dataset.taskAction === "reopen" || task.status === "concluida";
                if (reabrirTarefa) {
                    const subtarefasConcluidas = (task.checklist || []).filter(
                        (item) => item.ativo !== false && item.concluido
                    );
                    const nomeTarefa = task.nome || "esta tarefa";
                    const confirmado = await confirmWorkspace({
                        title: `Reabrir tarefa — ${nomeTarefa}?`,
                        message: `A tarefa e suas ${subtarefasConcluidas.length} subtarefas concluídas serão reabertas. O progresso desta tarefa voltará para 0%.`,
                        confirmLabel: "Reabrir tarefa e subtarefas",
                    });
                    if (!confirmado) return;
                    button.disabled = true;
                    setDrawerSaveState("saving", `Reabrindo ${nomeTarefa}...`);
                    try {
                        for (const subtarefa of subtarefasConcluidas) {
                            await request(subtaskApiUrl(subtarefa.id), {
                                method: "PATCH",
                                body: JSON.stringify({ concluido: false }),
                            });
                        }
                        const data = await request(taskApiUrl(taskId), {
                            method: "PATCH",
                            body: JSON.stringify({ status: "backlog", progresso: 0 }),
                        });
                        if (data?.projeto) renderProjectDetail(data.projeto);
                        else await refreshProjectDetailInline();
                        await loadProjects(true);
                        setDrawerSaveState("saved", `Tarefa ${nomeTarefa} reaberta.`);
                        toast(`Tarefa ${nomeTarefa} e suas subtarefas foram reabertas.`);
                    } catch (error) {
                        await refreshProjectDetailInline();
                        setDrawerSaveState("error", error.message);
                        toast(error.message, true);
                    }
                    return;
                }

                const subtarefasPendentes = (task.checklist || []).filter(
                    (item) => item.ativo !== false && !item.concluido
                );
                const nomeTarefa = task.nome || "esta tarefa";
                const nomeEtapa = stage?.nome || "a etapa";
                const quantidade = subtarefasPendentes.length;

                const confirmado = await confirmWorkspace({
                    title: `Concluir tarefa — ${nomeTarefa}?`,
                    message: quantidade
                        ? `As ${quantidade} subtarefas pendentes desta tarefa serão marcadas como concluídas e a tarefa ficará em 100%. Somente esta tarefa será concluída; as demais tarefas de ${nomeEtapa} não serão alteradas.`
                        : `Esta tarefa será marcada como concluída em 100%. Somente esta tarefa será concluída; as demais tarefas de ${nomeEtapa} não serão alteradas.`,
                    confirmLabel: "Concluir tarefa",
                });
                if (!confirmado) return;

                button.disabled = true;
                setDrawerSaveState("saving", `Concluindo ${nomeTarefa}...`);

                try {
                    let data = null;

                    for (const subtarefa of subtarefasPendentes) {
                        data = await request(subtaskApiUrl(subtarefa.id), {
                            method: "PATCH",
                            body: JSON.stringify({ concluido: true }),
                        });
                    }

                    data = await request(taskApiUrl(taskId), {
                        method: "PATCH",
                        body: JSON.stringify({
                            status: "concluida",
                            progresso: 100,
                        }),
                    });

                    if (data?.projeto) renderProjectDetail(data.projeto);
                    await loadProjects(true);
                    setDrawerSaveState("saved", `Tarefa ${nomeTarefa} concluída.`);
                    toast(`Tarefa ${nomeTarefa} concluída. As demais tarefas de ${nomeEtapa} permanecem inalteradas.`);
                } catch (error) {
                    await refreshProjectDetailInline();
                    setDrawerSaveState("error", error.message);
                    toast(error.message, true);
                    button.disabled = false;
                }
            });
        });

        el.drawerBody.querySelectorAll("[data-task-status]").forEach((select) => {
            select.addEventListener("change", async () => {
                const payload = { status: select.value };
                if (select.value === "bloqueada") {
                    const motivo = window.prompt(
                        "Informe o problema ou impedimento que bloqueia esta tarefa:",
                        select.dataset.blockReason || ""
                    );
                    if (!String(motivo || "").trim()) {
                        select.value = select.dataset.previousStatus || "backlog";
                        toast("Para bloquear a tarefa, informe o impedimento.", true);
                        return;
                    }
                    payload.motivo_bloqueio = String(motivo).trim();
                }
                await updateTask(Number(select.dataset.taskStatus), payload);
            });
        });

        el.drawerBody.querySelectorAll("[data-task-progress]").forEach((input) => {
            const label = el.drawerBody.querySelector(`[data-task-progress-label="${input.dataset.taskProgress}"]`);
            input.addEventListener("input", () => {
                if (label) label.textContent = `${Number(input.value).toFixed(0)}%`;
            });
            input.addEventListener("change", async () => {
                await updateTask(Number(input.dataset.taskProgress), { progresso: Number(input.value) });
            });
        });

        el.drawerBody.querySelectorAll("[data-task-responsavel], [data-task-start], [data-task-end]").forEach((field) => {
            field.addEventListener("change", () => {
                const taskId = Number(
                    field.dataset.taskResponsavel
                    || field.dataset.taskStart
                    || field.dataset.taskEnd
                    || 0
                );
                if (taskId) autosaveTaskPlanning(taskId);
            });
        });

        el.drawerBody.querySelectorAll("[data-task-apply-subtasks]").forEach((button) => {
            button.addEventListener("click", async () => {
                const taskId = Number(button.dataset.taskApplySubtasks || 0);
                if (!taskId) return;
                button.disabled = true;
                await updateTask(taskId, { aplicar_responsavel_subtarefas: true });
            });
        });

        const projectOwner = el.drawerBody.querySelector('[data-project-field="owner_id"]');
        const projectGroup = el.drawerBody.querySelector('[data-project-field="grupo_id"]');
        projectOwner?.addEventListener("change", () => applyOwnerGroup(projectOwner, projectGroup));

        el.drawerBody.querySelectorAll("[data-project-external-link]").forEach((button) => {
            const key = button.dataset.projectExternalLink;
            const panel = el.drawerBody.querySelector(`[data-project-url-panel="${key}"]`);
            const field = el.drawerBody.querySelector(`[data-project-url-field="${key}"]`);
            const openButton = el.drawerBody.querySelector(`[data-project-url-open="${key}"]`);
            const sync = () => {
                const enabled = Boolean(externalReferenceUrl(field?.value));
                button.classList.toggle("is-ready", enabled);
                if (openButton) openButton.hidden = !enabled;
            };
            field?.addEventListener("input", () => {
                sync();
                scheduleReferenceUrlAutosave(false, false);
            });
            field?.addEventListener("change", () => {
                scheduleReferenceUrlAutosave(true, true);
            });
            button.addEventListener("click", () => {
                if (!panel) return;
                panel.hidden = !panel.hidden;
                if (!panel.hidden) field?.focus();
            });
            openButton?.addEventListener("click", () => {
                const url = externalReferenceUrl(field?.value);
                if (!url) {
                    toast("Informe uma URL válida para abrir a referência.", true);
                    field?.focus();
                    return;
                }
                window.open(url, "_blank", "noopener,noreferrer");
            });
            sync();
        });

        const projectMethodology = el.drawerBody.querySelector('[data-project-field="metodologia"]');
        const projectModel = el.drawerBody.querySelector('[data-project-field="cronograma_modelo_id"]');
        projectMethodology?.addEventListener("change", () => {
            if (!projectModel || projectModel.disabled) return;
            const metodologia = projectMethodology.value || "agil";
            const atual = projectModel.value;
            const modeloAtual = state.modelos.find((modelo) => String(modelo.id) === String(atual));
            const compativeis = state.modelos.filter(
                (modelo) => !modelo.metodologia || modelo.metodologia === metodologia
            );
            projectModel.innerHTML = `<option value="">Selecione o tipo</option>` + compativeis.map((modelo) => (
                `<option value="${modelo.id}">${escapeHtml(modelo.nome)}${modelo.esperada ? " · Recomendada" : ""}</option>`
            )).join("");
            const correspondente = compativeis.find((modelo) => (
                modeloAtual
                && modelo.tipo_projeto_codigo
                && modelo.tipo_projeto_codigo === modeloAtual.tipo_projeto_codigo
            ));
            if (correspondente) {
                projectModel.value = String(correspondente.id);
            } else if (compativeis.some((modelo) => String(modelo.id) === String(atual))) {
                projectModel.value = String(atual);
            }
            const guide = el.drawerBody.querySelector("[data-project-methodology-guide]");
            if (guide) guide.innerHTML = methodologyGuideHtml(metodologia, true);
            scheduleProjectEditorPreview();
        });

        const durationField = el.drawerBody.querySelector('[data-project-field="duracao_dias_uteis"]');
        const dueDateField = el.drawerBody.querySelector('[data-project-field="data_fim_prevista"]');
        const editorScheduleFields = ["data_inicio", "cronograma_modelo_id", "metodologia", "responsavel_ids", "status"]
            .map((name) => el.drawerBody.querySelector(`[data-project-field="${name}"]`))
            .filter(Boolean);
        editorScheduleFields.forEach((field) => field.addEventListener("change", scheduleProjectEditorPreview));
        editorScheduleFields.forEach((field) => field.addEventListener("input", scheduleProjectEditorPreview));
        durationField?.addEventListener("input", () => {
            projectEditorCalculationSource = "duracao";
            scheduleProjectEditorPreview();
        });
        durationField?.addEventListener("change", () => {
            projectEditorCalculationSource = "duracao";
            scheduleProjectEditorPreview();
        });
        dueDateField?.addEventListener("input", () => {
            projectEditorCalculationSource = "prazo";
            scheduleProjectEditorPreview();
        });
        dueDateField?.addEventListener("change", () => {
            projectEditorCalculationSource = "prazo";
            scheduleProjectEditorPreview();
        });

        el.drawerBody.querySelector("[data-project-save]")?.addEventListener("click", saveProjectDetail);

        el.drawerBody.querySelectorAll("[data-subtask-toggle]").forEach((checkbox) => {
            checkbox.addEventListener("change", () => updateSubtask(Number(checkbox.dataset.subtaskToggle), { concluido: checkbox.checked }));
        });
        el.drawerBody.querySelectorAll("[data-subtask-assignee-toggle]").forEach((button) => {
            button.addEventListener("click", () => {
                const subtaskId = Number(button.dataset.subtaskAssigneeToggle || 0);
                const select = el.drawerBody.querySelector(`[data-subtask-responsavel="${subtaskId}"]`);
                if (!select) return;
                button.hidden = true;
                select.hidden = false;
                select.focus();
            });
        });
        el.drawerBody.querySelectorAll('[data-external-person-target^="subtask:"]').forEach((button) => {
            button.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
                openExternalPersonModal(button.dataset.externalPersonTarget);
            });
        });
        el.drawerBody.querySelectorAll("[data-subtask-responsavel], [data-subtask-start], [data-subtask-end]").forEach((field) => {
            field.addEventListener("change", () => {
                const subtaskId = Number(
                    field.dataset.subtaskResponsavel
                    || field.dataset.subtaskStart
                    || field.dataset.subtaskEnd
                    || 0
                );
                if (!subtaskId) return;
                const responsavel = el.drawerBody.querySelector(`[data-subtask-responsavel="${subtaskId}"]`);
                const inicio = el.drawerBody.querySelector(`[data-subtask-start="${subtaskId}"]`);
                const fim = el.drawerBody.querySelector(`[data-subtask-end="${subtaskId}"]`);
                const executorValue = responsavel?.value || "";
                updateSubtask(subtaskId, {
                    responsavel_pessoa_id: /^\d+$/.test(executorValue) ? Number(executorValue) : null,
                    herdar_responsavel: executorValue === "",
                    data_inicio: inicio?.value || null,
                    data_fim_prevista: fim?.value || null,
                });
            });
        });
        el.drawerBody.querySelectorAll("[data-subtask-responsavel]").forEach((select) => {
            select.addEventListener("blur", () => {
                window.setTimeout(() => {
                    if (select.hidden || !select.isConnected) return;
                    select.hidden = true;
                    const button = el.drawerBody.querySelector(`[data-subtask-assignee-toggle="${select.dataset.subtaskResponsavel}"]`);
                    if (button) button.hidden = false;
                }, 120);
            });
        });
        el.drawerBody.querySelectorAll("[data-subtask-remove]").forEach((button) => {
            button.addEventListener("click", () => removeSubtask(Number(button.dataset.subtaskRemove)));
        });
    }

    function taskApiUrl(taskId) {
        return api.tarefas.replace(/0\/?$/, `${taskId}/`);
    }

    function taskSubtasksApiUrl(taskId) {
        return api.tarefaSubtarefas.replace(/0\/?$/, `${taskId}/`);
    }

    function subtaskApiUrl(subtaskId) {
        return api.subtarefas.replace(/0\/?$/, `${subtaskId}/`);
    }

    function setTaskAutosaveStatus(taskId, status, message) {
        const indicator = el.drawerBody.querySelector(`[data-task-autosave-status="${taskId}"]`);
        if (!indicator) return;
        indicator.classList.remove("is-saving", "is-saved", "is-error");
        indicator.classList.add(`is-${status}`);
        const icon = indicator.querySelector("i");
        const text = indicator.querySelector("span");
        if (icon) {
            icon.className = status === "saving"
                ? "fa fa-spinner fa-spin"
                : status === "error"
                    ? "fa fa-exclamation-circle"
                    : "fa fa-check-circle";
        }
        if (text) text.textContent = message;
    }

    async function autosaveTaskPlanning(taskId) {
        const responsavel = el.drawerBody.querySelector(`[data-task-responsavel="${taskId}"]`);
        const inicio = el.drawerBody.querySelector(`[data-task-start="${taskId}"]`);
        const fim = el.drawerBody.querySelector(`[data-task-end="${taskId}"]`);
        setTaskAutosaveStatus(taskId, "saving", "Salvando alterações...");
        const saved = await updateTask(taskId, {
            responsavel_pessoa_id: responsavel?.value || null,
            data_inicio: inicio?.value || null,
            data_fim_prevista: fim?.value || null,
        });
        setTaskAutosaveStatus(
            taskId,
            saved ? "saved" : "error",
            saved ? "Alterações salvas automaticamente" : "Não foi possível salvar"
        );
    }

    let projectEditorPreviewTimer = null;
    let projectEditorCalculationSource = "duracao";

    function scheduleProjectEditorPreview() {
        window.clearTimeout(projectEditorPreviewTimer);
        projectEditorPreviewTimer = window.setTimeout(renderProjectEditorPreview, 250);
    }

    async function renderProjectEditorPreview() {
        const getField = (name) => el.drawerBody.querySelector(`[data-project-field="${name}"]`);
        const dataInicio = getField("data_inicio")?.value || "";
        const duracao = Number(getField("duracao_dias_uteis")?.value || 0);
        const modeloId = Number(getField("cronograma_modelo_id")?.value || state.projetoAberto?.cronograma_modelo?.id || 0);
        const statusProjeto = getField("status")?.value || state.projetoAberto?.status || "rascunho";
        const prazo = getField("data_fim_prevista");
        const calcularPorPrazo = projectEditorCalculationSource === "prazo" && Boolean(prazo?.value);
        if (!modeloId) {
            return;
        }

        if (!dataInicio || (!calcularPorPrazo && duracao < 1) || !api.cronogramaPrevia) {
            return;
        }

        const requestId = ++state.editorPreviewRequestId;
        const params = new URLSearchParams({
            data_inicio: dataInicio,
            cronograma_modelo_id: String(modeloId),
            metodologia: getField("metodologia")?.value || "agil",
            calcular_por: calcularPorPrazo ? "prazo" : "duracao",
        });
        if (calcularPorPrazo) {
            params.set("data_fim_prevista", prazo.value);
        } else {
            params.set("duracao_dias_uteis", String(duracao));
        }

        try {
            const data = await request(`${api.cronogramaPrevia}?${params.toString()}`);
            if (requestId !== state.editorPreviewRequestId) return;
            const planejamento = data.planejamento || {};
            if (calcularPorPrazo) {
                const durationInput = getField("duracao_dias_uteis");
                if (durationInput) durationInput.value = Number(planejamento.duracao_dias_uteis || 0);
                toast(`Duração calculada: ${Number(planejamento.duracao_dias_uteis || 0)} dias úteis.`);
            } else {
                if (prazo) prazo.value = planejamento.data_fim_prevista || "";
                const homologacao = getField("data_homologacao_prevista");
                const goLive = getField("data_go_live_prevista");
                if (homologacao) homologacao.value = planejamento.data_homologacao_prevista || homologacao.value || "";
                if (goLive) goLive.value = planejamento.data_go_live_prevista || goLive.value || "";
                toast(statusProjeto === "em_andamento"
                    ? `Cronograma calculado: ${formatDate(planejamento.data_inicio_efetiva)} → ${formatDate(planejamento.data_fim_prevista)}.`
                    : `Conclusão prevista calculada: ${formatDate(planejamento.data_fim_prevista)}. O cronograma será iniciado quando o projeto entrar Em andamento.`);
            }
        } catch (error) {
            if (requestId !== state.editorPreviewRequestId) return;
            toast(`Não foi possível calcular o prazo: ${error.message}`, true);
        }
    }

    async function saveProjectDetail() {
        const project = state.projetoAberto;
        if (!project) return;

        const getField = (name) => el.drawerBody.querySelector(`[data-project-field="${name}"]`);
        const grupoId = getField("grupo_id")?.value || null;
        const ownerId = getField("owner_id")?.value || null;
        const empresaSelecionada = state.empresas.find(
            (item) => Number(item.id) === Number(getField("empresa_id")?.value || 0)
        );
        if (project.owner && !ownerId) {
            toast("O Owner do projeto não pode ser removido.", true);
            getField("owner_id")?.focus();
            return;
        }
        const referenciaUrlField = el.drawerBody.querySelector('[data-project-url-field="referencia"]');
        const cslogUrlField = el.drawerBody.querySelector('[data-project-url-field="cslog"]');
        const referenciaUrlRaw = referenciaUrlField?.value.trim() || "";
        const cslogUrlRaw = cslogUrlField?.value.trim() || "";
        const referenciaUrl = externalReferenceUrl(referenciaUrlRaw);
        const cslogUrl = externalReferenceUrl(cslogUrlRaw);
        if (referenciaUrlRaw && !referenciaUrl) {
            toast("Informe uma URL válida para a referência TiFlux.", true);
            referenciaUrlField?.focus();
            return;
        }
        if (cslogUrlRaw && !cslogUrl) {
            toast("Informe uma URL válida para a referência CSLOG.", true);
            cslogUrlField?.focus();
            return;
        }
        const payload = {
            nome: getField("nome")?.value.trim() || "",
            referencia: getField("referencia")?.value.trim() || "",
            referencia_url: referenciaUrl,
            cslog: getField("cslog")?.value.trim() || "",
            cslog_url: cslogUrl,
            categoria: getField("categoria")?.value.trim() || "",
            empresa_nome: empresaSelecionada?.nome || project.empresa_nome || project.empresa?.nome || "",
            descricao: getField("descricao")?.value.trim() || "",
            cliente_id: getField("cliente_id") ? (getField("cliente_id").value || null) : (project.cliente?.id || null),
            empresa_id: getField("empresa_id") ? (getField("empresa_id").value || null) : (project.empresa?.id || null),
            owner_id: ownerId,
            stakeholder_id: getField("stakeholder_id")?.value || null,
            responsavel_ids: getField("responsavel_ids")?.value ? [Number(getField("responsavel_ids").value)] : [],
            grupo_ids: grupoId ? [Number(grupoId)] : [],
            data_abertura: getField("data_abertura")?.value || null,
            data_inicio: getField("data_inicio")?.value || null,
            duracao_dias_uteis: getField("data_inicio")?.value
                ? Number(getField("duracao_dias_uteis")?.value || 0)
                : 0,
            horas_planejadas: getField("horas_planejadas")?.value || null,
            data_fim_prevista: getField("data_fim_prevista")?.value || null,
            data_homologacao_prevista: getField("data_homologacao_prevista")?.value || null,
            data_go_live_prevista: getField("data_go_live_prevista")?.value || null,
            data_conclusao: getField("data_conclusao")?.value || null,
            prioridade: getField("prioridade")?.value || project.prioridade,
            metodologia: getField("metodologia")?.value || project.metodologia,
            status: getField("status")?.value || project.status,
            cronograma_modelo_id: getField("cronograma_modelo_id")?.value || (project.cronograma_modelo && project.cronograma_modelo.id) || null,
            ...(project.tem_cslog ? {
                cslog_ticket_aberto_em: getField("cslog_ticket_aberto_em")?.value || null,
                cslog_escopo_fechado_em: getField("cslog_escopo_fechado_em")?.value || null,
                cslog_orcamento_recebido_em: getField("cslog_orcamento_recebido_em")?.value || null,
                cslog_orcamento_valor: getField("cslog_orcamento_valor")?.value || null,
                cslog_horas_tecnicas: getField("cslog_horas_tecnicas")?.value || null,
                cslog_prazo_dias_uteis: getField("cslog_prazo_dias_uteis")?.value || null,
                cslog_data_inicio: getField("cslog_data_inicio")?.value || null,
                cslog_folga_qore_dias_uteis: Number(getField("cslog_folga_qore_dias_uteis")?.value || project.cslog_folga_qore_dias_uteis || 2),
                cslog_data_entrega_real: getField("cslog_data_entrega_real")?.value || null,
            } : {}),
            recalcular_cronograma: false,
        };

        const hasSchedule = (project.etapas || []).length > 0
            || (project.tarefas_sem_etapa || []).length > 0;
        const coreScheduleChanged = (
            String(payload.data_inicio || "") !== String(project.data_inicio || "")
            || Number(payload.duracao_dias_uteis || 0) !== Number(project.duracao_dias_uteis || 0)
            || Number(payload.cronograma_modelo_id || 0) !== Number(project.cronograma_modelo?.id || 0)
            || String(payload.metodologia || "") !== String(project.metodologia || "")
            || (!hasSchedule && payload.status === "em_andamento")
        );
        payload.recalcular_cronograma = Boolean(
            payload.status !== "rascunho"
            && payload.data_inicio
            && payload.cronograma_modelo_id
            && coreScheduleChanged
        );
        if (hasSchedule && payload.status === "rascunho") {
            toast("Um projeto com cronograma efetivado não pode voltar para Rascunho.", true);
            getField("status")?.focus();
            return;
        }

        if (payload.status === "em_andamento" && !payload.responsavel_ids.length) {
            toast("Selecione o Responsável/Líder antes de iniciar o cronograma.", true);
            getField("responsavel_ids")?.focus();
            return;
        }
        if (payload.status === "em_andamento" && !payload.data_inicio) {
            toast("Informe a data de início antes de efetivar o cronograma.", true);
            getField("data_inicio")?.focus();
            return;
        }

        const modeloAnteriorId = Number(project.cronograma_modelo?.id || 0);
        const modeloNovoId = Number(payload.cronograma_modelo_id || 0);
        if (hasSchedule && modeloAnteriorId && modeloNovoId !== modeloAnteriorId) {
            const confirmado = await confirmWorkspace({
                title: "Alterar metodologia e cronograma?",
                message: "O cronograma atual será substituído pelo modelo selecionado. Fases/Sprints, tarefas, subtarefas e progresso atuais serão substituídos; o histórico do projeto será preservado.",
                confirmLabel: "Substituir cronograma",
            });
            if (!confirmado) return;
            payload.substituir_cronograma = true;
        }

        setLoading(true);
        try {
            const data = await request(`${api.projetos}${project.id}/`, {
                method: "PATCH",
                body: JSON.stringify(payload),
            });
            if (data.projeto) {
                renderProjectDetail(data.projeto);
                if (Number(state.ganttProjectId) === Number(data.projeto.id)) {
                    state.ganttProject = data.projeto;
                }
            }
            await loadProjects(true);
            toast(data.mensagem || "Projeto atualizado.");
        } catch (error) {
            toast(error.message, true);
        } finally {
            setLoading(false);
        }
    }

    async function addSubtask(taskId) {
        const input = el.drawerBody.querySelector(`[data-subtask-new="${taskId}"]`);
        const descricao = input ? input.value.trim() : "";
        if (!descricao) {
            setDrawerSaveState("error", "Informe a descrição da subtarefa.");
            input?.focus();
            return;
        }

        setDrawerSaveState("saving", "Adicionando subtarefa...");
        try {
            const data = await request(taskSubtasksApiUrl(taskId), {
                method: "POST",
                body: JSON.stringify({ descricao }),
            });
            if (data.projeto) renderProjectDetail(data.projeto);
            setDrawerSaveState("saved", data.mensagem || "Subtarefa adicionada.");
        } catch (error) {
            setDrawerSaveState("error", error.message);
        }
    }

    async function updateSubtask(subtaskId, payload) {
        if (Object.prototype.hasOwnProperty.call(payload, "descricao") && !payload.descricao) {
            setDrawerSaveState("error", "Informe a descrição da subtarefa.");
            return;
        }
        setDrawerSaveState("saving", "Salvando subtarefa...");
        try {
            const data = await request(subtaskApiUrl(subtaskId), {
                method: "PATCH",
                body: JSON.stringify(payload),
            });
            if (data.projeto) renderProjectDetail(data.projeto);
            await loadProjects(true);
            setDrawerSaveState("saved", data.mensagem || "Subtarefa atualizada.");
        } catch (error) {
            const checkbox = el.drawerBody.querySelector(`[data-subtask-toggle="${subtaskId}"]`);
            if (checkbox && Object.prototype.hasOwnProperty.call(payload, "concluido")) {
                checkbox.checked = !Boolean(payload.concluido);
            }
            setDrawerSaveState("error", error.message);
        }
    }

    async function removeSubtask(subtaskId) {
        const confirmed = await confirmWorkspace({
            title: "Remover subtarefa?",
            message: "A subtarefa será removida da execução, mas o histórico será preservado.",
            confirmLabel: "Remover subtarefa",
        });
        if (!confirmed) return;
        setDrawerSaveState("saving", "Removendo subtarefa...");
        try {
            const data = await request(subtaskApiUrl(subtaskId), { method: "DELETE" });
            if (data.projeto) renderProjectDetail(data.projeto);
            await loadProjects(true);
            setDrawerSaveState("saved", data.mensagem || "Subtarefa removida.");
            toast(data.mensagem || "Subtarefa removida.");
        } catch (error) {
            setDrawerSaveState("error", error.message);
            toast(error.message, true);
        }
    }

    async function updateTask(taskId, payload) {
        setDrawerSaveState("saving", "Salvando tarefa...");
        try {
            const data = await request(taskApiUrl(taskId), {
                method: "PATCH",
                body: JSON.stringify(payload),
            });
            if (data.projeto) renderProjectDetail(data.projeto);
            await loadProjects(true);
            setDrawerSaveState("saved", data.mensagem || "Tarefa atualizada.");
            return true;
        } catch (error) {
            await refreshProjectDetailInline();
            setDrawerSaveState("error", error.message);
            return false;
        }
    }

    function expandProjectDataSection() {
        const toggle = el.drawerBody.querySelector("[data-project-editor-toggle]");
        if (!toggle) return;

        const editor = toggle.closest(".projetos-detail-editor");
        const content = el.drawerBody.querySelector("#projetosProjectEditorContent");
        const hint = toggle.querySelector("[data-project-editor-hint]");

        toggle.setAttribute("aria-expanded", "true");
        editor?.classList.add("is-open");
        if (content) content.hidden = false;
        if (hint) hint.textContent = "Ocultar campos de edição";

        window.setTimeout(() => {
            editor?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 40);
    }

    function focusDrawerTask(focus) {
        if (!focus) return;
        if (focus.section === "dados") {
            expandProjectDataSection();
            return;
        }
        if (!focus.taskId) return;
        const task = el.drawerBody.querySelector(`[data-task-id="${Number(focus.taskId)}"]`);
        if (!task) return;

        let stage = focus.stageId
            ? el.drawerBody.querySelector(`[data-stage-id="${Number(focus.stageId)}"]`)
            : task.closest(".projetos-stage[data-stage-id]");
        while (stage) {
            stage.classList.add("is-open");
            const stageId = Number(stage.dataset.stageId || 0);
            stage.querySelectorAll(`:scope > .projetos-stage__header [data-stage-toggle="${stageId}"]`).forEach((button) => {
                button.setAttribute("aria-expanded", "true");
            });
            stage = stage.parentElement?.closest(".projetos-stage[data-stage-id]") || null;
        }

        task.classList.add("is-open", "is-focused");
        task.querySelectorAll(`[data-task-toggle="${Number(focus.taskId)}"]`).forEach((button) => {
            button.setAttribute("aria-expanded", "true");
        });
        captureDrawerPersistence();
        window.setTimeout(() => task.scrollIntoView({ behavior: "smooth", block: "center" }), 40);
        window.setTimeout(() => task.classList.remove("is-focused"), 3200);
    }

    function drawerPersistenceKey() {
        return `workspace.projetos.drawer.v1.${userId || "local"}`;
    }

    function readDrawerPersistence() {
        try {
            const raw = window.localStorage.getItem(drawerPersistenceKey());
            if (!raw) return null;
            const value = JSON.parse(raw);
            const projectId = Number(value?.projectId || 0);
            if (!Number.isInteger(projectId) || projectId <= 0) return null;
            return {
                projectId,
                scrollTop: Math.max(0, Number(value?.scrollTop || 0)),
                editorExpanded: Boolean(value?.editorExpanded),
                openStageIds: Array.isArray(value?.openStageIds) ? value.openStageIds.map(Number).filter(Number.isFinite) : [],
                openTaskIds: Array.isArray(value?.openTaskIds) ? value.openTaskIds.map(Number).filter(Number.isFinite) : [],
            };
        } catch (error) {
            return null;
        }
    }

    function captureDrawerPersistence(projectIdOverride = null) {
        const projectId = Number(projectIdOverride || state.projetoAberto?.id || 0);
        if (!projectId || !el.drawer?.classList.contains("is-open")) return;
        try {
            const payload = {
                projectId,
                scrollTop: Math.max(0, Number(el.drawerBody?.scrollTop || 0)),
                editorExpanded: el.drawerBody?.querySelector("[data-project-editor-toggle]")?.getAttribute("aria-expanded") === "true",
                openStageIds: Array.from(el.drawerBody?.querySelectorAll(".projetos-stage[data-stage-id].is-open") || [])
                    .map((item) => Number(item.dataset.stageId || 0)).filter(Boolean),
                openTaskIds: Array.from(el.drawerBody?.querySelectorAll(".projetos-task-card[data-task-id].is-open") || [])
                    .map((item) => Number(item.dataset.taskId || 0)).filter(Boolean),
            };
            window.localStorage.setItem(drawerPersistenceKey(), JSON.stringify(payload));
        } catch (error) {
            // Persistência do drawer é opcional e nunca pode bloquear a tela.
        }
    }

    function clearDrawerPersistence() {
        try {
            window.localStorage.removeItem(drawerPersistenceKey());
        } catch (error) {
            // Persistência é opcional.
        }
    }

    function restoreDrawerPersistence(projectId) {
        const saved = readDrawerPersistence();
        if (!saved || Number(saved.projectId) !== Number(projectId)) return false;

        const editorToggle = el.drawerBody?.querySelector("[data-project-editor-toggle]");
        const editor = editorToggle?.closest(".projetos-detail-editor");
        const editorContent = el.drawerBody?.querySelector("#projetosProjectEditorContent");
        const editorHint = editorToggle?.querySelector("[data-project-editor-hint]");
        if (editorToggle) {
            editorToggle.setAttribute("aria-expanded", String(saved.editorExpanded));
            editor?.classList.toggle("is-open", saved.editorExpanded);
            if (editorContent) editorContent.hidden = !saved.editorExpanded;
            if (editorHint) editorHint.textContent = saved.editorExpanded ? "Ocultar campos de edição" : "Expandir campos de edição";
        }

        const openStages = new Set(saved.openStageIds);
        el.drawerBody?.querySelectorAll(".projetos-stage[data-stage-id]").forEach((stage) => {
            const open = openStages.has(Number(stage.dataset.stageId || 0));
            stage.classList.toggle("is-open", open);
            stage.querySelectorAll(":scope > .projetos-stage__header [data-stage-toggle]").forEach((button) => button.setAttribute("aria-expanded", String(open)));
        });

        const openTasks = new Set(saved.openTaskIds);
        el.drawerBody?.querySelectorAll(".projetos-task-card[data-task-id]").forEach((task) => {
            const open = openTasks.has(Number(task.dataset.taskId || 0));
            task.classList.toggle("is-open", open);
            task.querySelectorAll("[data-task-toggle]").forEach((button) => button.setAttribute("aria-expanded", String(open)));
        });

        window.requestAnimationFrame(() => {
            if (el.drawerBody) el.drawerBody.scrollTop = saved.scrollTop;
        });
        return true;
    }

    function projectIdFromUrl() {
        const params = new URLSearchParams(window.location.search);
        const projectId = Number(params.get("projeto_id") || 0);
        return Number.isInteger(projectId) && projectId > 0 ? projectId : null;
    }

    async function openProject(projectId, prefetched, focus) {
        const savedDrawer = readDrawerPersistence();
        const restoreSavedPosition = !focus && Number(savedDrawer?.projectId || 0) === Number(projectId);
        el.drawer.classList.add("is-open");
        el.drawerBackdrop.classList.add("is-open");
        el.drawer.setAttribute("aria-hidden", "false");
        el.drawerBackdrop.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
        el.drawerCodigo.textContent = "PROJETO";
        el.drawerTitulo.textContent = prefetched ? prefetched.nome : "Carregando...";
        updateDrawerFavorite(projectId);
        el.drawerBody.innerHTML = `<div class="projetos-empty"><span class="projetos-loading__spinner"></span><p>Carregando projeto...</p></div>`;

        try {
            const data = prefetched && prefetched.etapas ? { projeto: prefetched } : await request(`${api.projetos}${projectId}/`);
            renderProjectDetail(data.projeto);
            if (restoreSavedPosition) restoreDrawerPersistence(projectId);
            else focusDrawerTask(focus);
            captureDrawerPersistence(projectId);
        } catch (error) {
            toast(error.message, true);
            const fallback = prefetched || state.projetos.find((item) => Number(item.id) === Number(projectId));
            if (fallback) {
                renderProjectDetail({
                    ...fallback,
                    etapas: fallback.etapas || [],
                    tarefas_sem_etapa: fallback.tarefas_sem_etapa || [],
                    __detail_warning: "O resumo do projeto foi aberto, mas o detalhamento do cronograma não pôde ser carregado. Você ainda pode revisar e salvar os dados principais.",
                });
                if (restoreSavedPosition) restoreDrawerPersistence(projectId);
                else focusDrawerTask(focus);
                captureDrawerPersistence(projectId);
            } else {
                el.drawerBody.innerHTML = `<div class="projetos-empty"><strong>Não foi possível abrir o projeto.</strong><p>${escapeHtml(error.message || "Erro ao carregar detalhes.")}</p></div>`;
            }
        }
    }

    function closeDrawer() {
        clearDrawerPersistence();
        el.drawer.classList.remove("is-open");
        el.drawerBackdrop.classList.remove("is-open");
        el.drawer.setAttribute("aria-hidden", "true");
        el.drawerBackdrop.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
        state.projetoAberto = null;
    }

    function setInlineExternalPersonVisible(visible) {
        if (!el.pessoaInline) return;
        const button = document.querySelector('[data-external-person-inline="stakeholder-create"]');
        el.pessoaInline.hidden = !visible;
        if (button) button.setAttribute("aria-expanded", visible ? "true" : "false");
        if (visible) {
            const emailField = document.querySelector('[data-external-email-field="stakeholder-create"]');
            if (emailField) emailField.hidden = true;
            window.setTimeout(() => el.pessoaInlineNome?.focus(), 20);
        } else {
            if (el.pessoaInlineNome) el.pessoaInlineNome.value = "";
            if (el.pessoaInlineEmail) el.pessoaInlineEmail.value = "";
            if (el.pessoaInlineCargo) el.pessoaInlineCargo.value = "Stakeholder externo";
        }
    }

    async function saveInlineExternalPerson() {
        const nome = el.pessoaInlineNome?.value.trim() || "";
        const email = el.pessoaInlineEmail?.value.trim() || "";
        const cargo = el.pessoaInlineCargo?.value.trim() || "";

        if (!nome) {
            toast("Informe o nome da pessoa externa.", true);
            el.pessoaInlineNome?.focus();
            return;
        }

        if (el.pessoaInlineSalvar) el.pessoaInlineSalvar.disabled = true;
        try {
            const data = await request(api.pessoas, {
                method: "POST",
                body: JSON.stringify({ nome, email, cargo }),
            });
            await refreshContext();
            const pessoa = data.pessoa;
            if (pessoa && el.stakeholder) {
                fillSupportFields();
                el.stakeholder.value = String(pessoa.id);
            }
            setInlineExternalPersonVisible(false);
            toast(data.mensagem || "Pessoa externa adicionada e selecionada.");
        } catch (error) {
            toast(error.message, true);
        } finally {
            if (el.pessoaInlineSalvar) el.pessoaInlineSalvar.disabled = false;
        }
    }

    function openExternalPersonModal(target) {
        if (!el.pessoaModalBackdrop) return;
        state.externalPersonTarget = target || "stakeholder-create";
        el.pessoaModalBackdrop.dataset.externalPersonTarget = state.externalPersonTarget;
        el.pessoaForm?.reset();
        const modalTitle = document.getElementById("projetosPessoaModalTitle");
        if (modalTitle) {
            modalTitle.textContent = String(state.externalPersonTarget).startsWith("subtask:")
                ? "Adicionar executor externo"
                : "Cadastrar pessoa";
        }
        el.pessoaModalBackdrop.classList.add("is-open");
        el.pessoaModalBackdrop.setAttribute("aria-hidden", "false");
        el.pessoaModalBackdrop.style.setProperty("display", "flex", "important");
        document.body.style.overflow = "hidden";
        window.setTimeout(() => el.pessoaNome?.focus(), 20);
    }

    function closeExternalPersonModal() {
        if (!el.pessoaModalBackdrop) return;
        el.pessoaModalBackdrop.classList.remove("is-open");
        el.pessoaModalBackdrop.setAttribute("aria-hidden", "true");
        el.pessoaModalBackdrop.style.removeProperty("display");
        state.externalPersonTarget = null;
        delete el.pessoaModalBackdrop.dataset.externalPersonTarget;
        if (!el.modalBackdrop?.classList.contains("is-open") && !el.drawer?.classList.contains("is-open")) {
            document.body.style.overflow = "";
        }
    }

    async function saveExternalPerson(event) {
        event?.preventDefault();
        const nome = el.pessoaNome?.value.trim() || "";
        const email = el.pessoaEmail?.value.trim() || "";
        const cargo = el.pessoaCargo?.value.trim() || "";

        if (!nome) {
            toast("Informe o nome da pessoa.", true);
            el.pessoaNome?.focus();
            return;
        }

        if (el.pessoaSalvar) el.pessoaSalvar.disabled = true;
        try {
            const target = state.externalPersonTarget
                || el.pessoaModalBackdrop?.dataset.externalPersonTarget
                || "stakeholder-create";
            const data = await request(api.pessoas, {
                method: "POST",
                body: JSON.stringify({ nome, email, cargo }),
            });
            const pessoa = data.pessoa;
            if (pessoa && !state.pessoas.some((item) => Number(item.id) === Number(pessoa.id))) {
                state.pessoas.push(pessoa);
                state.pessoas.sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"));
            }
            if (pessoa) {
                if (target === "stakeholder-create" && el.stakeholder) {
                    fillSupportFields();
                    el.stakeholder.value = String(pessoa.id);
                } else if (target === "stakeholder-edit") {
                    const select = el.drawerBody.querySelector('[data-project-field="stakeholder_id"]');
                    if (select) {
                        select.innerHTML = `<option value="">Sem Stakeholder</option>` + state.pessoas.map((item) => `<option value="${item.id}">${escapeHtml(personLabel(item))}</option>`).join("");
                        select.value = String(pessoa.id);
                    }
                } else if (String(target || "").startsWith("task:")) {
                    const taskId = Number(String(target).split(":")[1] || 0);
                    const select = el.drawerBody.querySelector(`[data-task-responsavel="${taskId}"]`);
                    if (select) {
                        select.innerHTML = `<option value="">Sem responsável</option>` + state.pessoas.map((item) => `<option value="${item.id}">${escapeHtml(personLabel(item))}</option>`).join("");
                        select.value = String(pessoa.id);
                        select.dispatchEvent(new Event("change", { bubbles: true }));
                    }
                } else if (String(target || "").startsWith("subtask:")) {
                    const subtaskId = Number(String(target).split(":")[1] || 0);
                    if (subtaskId) {
                        await updateSubtask(subtaskId, {
                            responsavel_pessoa_id: Number(pessoa.id),
                            herdar_responsavel: false,
                        });
                    }
                }
            }
            closeExternalPersonModal();
            toast(data.mensagem || "Pessoa externa adicionada.");
            refreshContext().catch(() => {});
        } catch (error) {
            toast(error.message, true);
        } finally {
            if (el.pessoaSalvar) el.pessoaSalvar.disabled = false;
        }
    }

    function bindEvents() {
        // Listener direto + delegação de segurança. A delegação garante a
        // abertura mesmo se o botão for re-renderizado/substituído pelo layout.
        el.novoButton?.addEventListener("click", openModal);
        document.addEventListener("click", (event) => {
            const newProject = event.target.closest ? event.target.closest("#projetosNovoButton") : null;
            if (newProject) {
                event.preventDefault();
                openModal();
                return;
            }

            const inlineExternal = event.target.closest ? event.target.closest("[data-external-person-inline]") : null;
            if (inlineExternal) {
                event.preventDefault();
                event.stopPropagation();
                setInlineExternalPersonVisible(el.pessoaInline?.hidden !== false);
                return;
            }

            const inlineEmail = event.target.closest ? event.target.closest('[data-external-email-toggle="stakeholder-create"]') : null;
            if (inlineEmail) {
                event.preventDefault();
                const field = document.querySelector('[data-external-email-field="stakeholder-create"]');
                if (field) {
                    field.hidden = !field.hidden;
                    if (!field.hidden) field.querySelector("input")?.focus();
                }
                return;
            }

            const external = event.target.closest ? event.target.closest("[data-external-person-target]") : null;
            if (external) {
                event.preventDefault();
                event.stopPropagation();
                openExternalPersonModal(external.dataset.externalPersonTarget);
            }
        });

        el.modalClose?.addEventListener("click", closeModal);
        el.cancelarButton?.addEventListener("click", closeModal);
        el.modalBackdrop?.addEventListener("click", (event) => {
            if (event.target === el.modalBackdrop) closeModal();
        });
        el.form?.addEventListener("submit", createProject);
        el.cronograma?.addEventListener("change", scheduleTemplatePreview);
        const createMethodology = document.getElementById("projetoMetodologia");
        createMethodology?.addEventListener("focus", () => openMethodologyGuide("create"), { once: true });
        createMethodology?.addEventListener("change", () => {
            filterCreateModelsByMethodology();
            renderCreateMethodologyGuide();
            scheduleTemplatePreview();
        });
        document.getElementById("projetoMetodologiaAjuda")?.addEventListener("click", () => openMethodologyGuide("create"));
        document.getElementById("projetosMethodologyClose")?.addEventListener("click", closeMethodologyGuide);
        document.getElementById("projetosMethodologyCancel")?.addEventListener("click", closeMethodologyGuide);
        document.getElementById("projetosMethodologyApply")?.addEventListener("click", () => applyRecommendedMethodology());
        document.querySelectorAll('#projetosMethodologyGuide [data-methodology-question]').forEach((field) => field.addEventListener("change", refreshMethodologyRecommendation));
        document.querySelectorAll('#projetosMethodologyGuide [data-methodology-use]').forEach((button) => button.addEventListener("click", () => applyRecommendedMethodology(button.dataset.methodologyUse)));
        document.getElementById("projetosMethodologyBackdrop")?.addEventListener("click", (event) => { if (event.target.id === "projetosMethodologyBackdrop") closeMethodologyGuide(); });
        el.dataInicioProjeto?.addEventListener("change", scheduleTemplatePreview);
        el.duracaoDiasUteis?.addEventListener("input", scheduleTemplatePreview);
        el.cliente?.addEventListener("change", fillEmpresas);
        el.owner?.addEventListener("change", () => applyOwnerGroup(el.owner, el.grupos));

        el.pessoaForm?.addEventListener("submit", saveExternalPerson);
        el.pessoaModalClose?.addEventListener("click", closeExternalPersonModal);
        el.pessoaCancelar?.addEventListener("click", closeExternalPersonModal);
        el.pessoaModalBackdrop?.addEventListener("click", (event) => {
            if (event.target === el.pessoaModalBackdrop) closeExternalPersonModal();
        });
        el.pessoaInlineCancelar?.addEventListener("click", () => setInlineExternalPersonVisible(false));
        el.pessoaInlineSalvar?.addEventListener("click", saveInlineExternalPerson);

        el.tableBody?.addEventListener("click", handlePortfolioTableClick);
        bindPortfolioTableTooltip();
        el.columnsToggle?.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (el.columnsMenu) el.columnsMenu.hidden = !el.columnsMenu.hidden;
        });
        el.columnsMenu?.addEventListener("click", (event) => {
            event.stopPropagation();
        });
        document.addEventListener("click", (event) => {
            if (!el.columnsMenu || el.columnsMenu.hidden) return;
            const path = typeof event.composedPath === "function" ? event.composedPath() : [];
            const clickedToggle = path.includes(el.columnsToggle) || el.columnsToggle?.contains?.(event.target);
            const clickedMenu = path.includes(el.columnsMenu) || el.columnsMenu.contains(event.target);
            if (clickedToggle || clickedMenu) return;
            el.columnsMenu.hidden = true;
        }, { capture: true });

        document.addEventListener("click", (event) => {
            if (!portfolioColumnFilterPopover || portfolioColumnFilterPopover.hidden) return;
            const path = typeof event.composedPath === "function" ? event.composedPath() : [];
            const clickedPopover = path.includes(portfolioColumnFilterPopover) || portfolioColumnFilterPopover.contains(event.target);
            const clickedFilterButton = Boolean(event.target.closest?.("[data-column-filter]"));
            if (clickedPopover || clickedFilterButton) return;
            closePortfolioColumnFilter();
        }, { capture: true });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") closePortfolioColumnFilter();
        });
        el.exportExcel?.addEventListener("click", exportProjectsExcel);
        el.deleteSelected?.addEventListener("click", deleteSelectedProjects);
        el.listFullscreen?.addEventListener("click", toggleListFullscreen);
        el.charts?.addEventListener("change", (event) => {
            const field = event.target.closest?.("[data-chart-filter]");
            if (!field) return;
            state.chartFilters[field.dataset.chartFilter] = field.value;
            renderCharts(filteredProjects());
        });

        el.busca?.addEventListener("input", () => {
            state.busca = el.busca.value;
            render();
        });
        el.statusFiltro?.addEventListener("change", () => {
            state.status = el.statusFiltro.value;
            render();
        });
        el.smartFilterToggle?.addEventListener("click", () => {
            const willOpen = Boolean(el.smartFilters?.hidden);
            if (el.smartFilters) el.smartFilters.hidden = !willOpen;
            el.smartFilterToggle.setAttribute("aria-expanded", willOpen ? "true" : "false");
        });
        el.smartFilters?.querySelectorAll("[data-smart-filter]").forEach((field) => {
            field.addEventListener("change", () => {
                state.smartFilters[field.dataset.smartFilter] = Array.from(field.selectedOptions)
                    .map((option) => String(option.value || ""))
                    .filter(Boolean);
                render();
            });
        });
        el.smartFilterReset?.addEventListener("click", () => {
            Object.keys(state.smartFilters).forEach((key) => { state.smartFilters[key] = []; });
            state.status = "";
            if (el.statusFiltro) el.statusFiltro.value = "";
            render();
        });
        el.dataCampo?.addEventListener("change", () => {
            state.dataCampo = el.dataCampo.value;
            render();
        });
        el.dataDe?.addEventListener("change", () => {
            state.dataDe = el.dataDe.value;
            render();
        });
        el.dataAte?.addEventListener("change", () => {
            state.dataAte = el.dataAte.value;
            render();
        });
        el.ganttProject?.addEventListener("change", () => {
            state.ganttExpandedStages.clear();
            state.ganttExpandedTasks.clear();
            state.ganttShowSubtasks = false;
            state.ganttProjectId = Number(el.ganttProject.value || 0) || null;
            state.ganttProject = null;
            if (state.ganttProjectId) loadGanttProject(state.ganttProjectId);
            else renderGanttProject(null);
        });
        el.ganttScale?.addEventListener("change", () => {
            state.ganttScale = el.ganttScale.value || "month";
            if (state.ganttProject) renderGanttProject(state.ganttProject);
        });
        el.ganttMine?.addEventListener("change", () => {
            state.ganttMine = Boolean(el.ganttMine.checked);
            if (state.ganttProject) renderGanttProject(state.ganttProject);
        });
        el.ganttOverdue?.addEventListener("change", () => {
            state.ganttOverdue = Boolean(el.ganttOverdue.checked);
            if (state.ganttProject) renderGanttProject(state.ganttProject);
        });
        el.ganttToggleStages?.addEventListener("click", toggleAllGanttStages);
        el.ganttToggleSubtasks?.addEventListener("click", toggleAllGanttSubtasks);
        el.ganttFullscreen?.addEventListener("click", toggleGanttFullscreen);
        el.ganttExport?.addEventListener("click", exportGanttPng);
        el.ganttExportExcel?.addEventListener("click", exportGanttExcel);
        el.ganttSendStatus?.addEventListener("click", openStatusEmailModal);
        el.statusEmailClose?.addEventListener("click", closeStatusEmailModal);
        el.statusEmailCancel?.addEventListener("click", closeStatusEmailModal);
        el.statusEmailForm?.addEventListener("submit", sendStatusEmail);
        [el.statusEmailPara, el.statusEmailCc].forEach((field) => field?.addEventListener("input", () => {
            const project = state.ganttProject || state.ganttRender?.project;
            if (project && el.statusEmailPreview) el.statusEmailPreview.innerHTML = statusEmailPreviewHtml(project);
        }));
        document.addEventListener("fullscreenchange", () => {
            const expanded = document.fullscreenElement === el.ganttShell;
            syncGanttFullscreenButton(expanded);
            syncListFullscreenButton(document.fullscreenElement === (el.portfolioArea || el.listView));
        });

        document.querySelectorAll(".projetos-view-switch__button").forEach((button) => {
            button.addEventListener("click", () => {
                const nextView = button.dataset.view;
                const selectedId = Number(state.portfolioSelectedProjectId || 0) || null;
                if (selectedId) {
                    state.ganttProjectId = selectedId;
                    state.kanbanProjectId = selectedId;
                }
                state.view = nextView;
                render();
                if (nextView === "timeline" && selectedId) loadGanttProject(selectedId);
            });
        });

        document.querySelectorAll(".projetos-rail__item[data-scope]").forEach((button) => {
            button.addEventListener("click", () => {
                state.scope = button.dataset.scope;
                document.querySelectorAll(".projetos-rail__item[data-scope]").forEach((item) => {
                    item.classList.toggle("is-active", item === button);
                });
                if (state.scope === "meu_dia" && !state.meuDia) loadMeuDia();
                else render();
            });
        });

        el.drawerFavorite?.addEventListener("click", () => {
            if (state.projetoAberto?.id) toggleFavoriteProject(state.projetoAberto.id);
        });
        el.drawerClose?.addEventListener("click", closeDrawer);
        // O drawer é persistente: clicar fora nunca fecha. O fechamento é exclusivo do botão X.
        let drawerSaveFrame = 0;
        const scheduleDrawerPersistence = () => {
            if (drawerSaveFrame) window.cancelAnimationFrame(drawerSaveFrame);
            drawerSaveFrame = window.requestAnimationFrame(() => {
                drawerSaveFrame = 0;
                captureDrawerPersistence();
            });
        };
        el.drawerBody?.addEventListener("scroll", scheduleDrawerPersistence, { passive: true });
        el.drawerBody?.addEventListener("click", () => window.setTimeout(scheduleDrawerPersistence, 0));
        window.addEventListener("beforeunload", captureDrawerPersistence);

        document.addEventListener("keydown", (event) => {
            if (event.key !== "Escape") return;
            if (document.getElementById("projetosMethodologyBackdrop")?.classList.contains("is-open")) {
                closeMethodologyGuide();
                return;
            }
            if (el.confirmBackdrop?.classList.contains("is-open")) {
                el.confirmCancel?.click();
                return;
            }
            if (el.ganttShell?.classList.contains("is-presentation")) {
                el.ganttShell.classList.remove("is-presentation");
                syncGanttFullscreenButton(false);
                return;
            }
            if ((el.portfolioArea || el.listView)?.classList.contains("is-table-presentation")) {
                (el.portfolioArea || el.listView).classList.remove("is-table-presentation");
                syncListFullscreenButton(false);
                return;
            }
            if (el.pessoaInline && !el.pessoaInline.hidden) {
                setInlineExternalPersonVisible(false);
                return;
            }
            if (el.pessoaModalBackdrop?.classList.contains("is-open")) {
                closeExternalPersonModal();
                return;
            }
            if (el.modalBackdrop?.classList.contains("is-open")) {
                closeModal();
                return;
            }
            // Escape não fecha o drawer do projeto. Use exclusivamente o botão X.
        });
    }

    window.projetosOpenProject = openProject;

    async function init() {
        state.favoriteProjectIds = loadFavoriteProjectIds();
        state.listColumnOrder = loadPortfolioColumnOrder();
        loadPortfolioDisplayPreferences();
        bindEvents();
        bindGanttTooltips();
        hydrateInitialProjects();
        render();

        const linkedProjectId = projectIdFromUrl();
        const persistedDrawer = readDrawerPersistence();

        setLoading(true);
        try {
            await Promise.all([loadProjects(true), loadSupportData(), loadMeuDia(true)]);
        } finally {
            setLoading(false);
        }

        // Acesso vindo de Tickets/integrações: a URL já informa ?projeto_id=ID.
        // Nesse cenário abrimos o drawer automaticamente e priorizamos os
        // Dados do projeto para conferência, sem alterar o comportamento normal
        // de abertura pelo portfólio, Gantt, Kanban ou Meu Dia.
        if (linkedProjectId) {
            await openProject(linkedProjectId, null, { section: "dados" });
        } else if (persistedDrawer?.projectId) {
            await openProject(persistedDrawer.projectId, null, null);
        }
    }

    init();
})();
