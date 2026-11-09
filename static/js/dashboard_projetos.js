/*
 * Dashboard de Projetos | Workspace Qore
 *
 * Fonte de dados:
 *   GET /dashboard_projetos/?dados=1
 *       -> dashboard_projetos view
 *       -> dashboard_projetos_service.py
 *       -> Microsoft Graph / Planner
 *
 * O dashboard_metas NÃO participa da regra de dados deste arquivo.
 */

(() => {
    "use strict";

    const PAGE_SIZE = 20;
    const BASE_LIMIT = 500;

    let metadata = {};
    let resumo = {};
    let projects = [];
    let filteredProjects = [];
    let selectedProjectId = null;
    let currentPage = 1;

    const els = {};

    document.addEventListener("DOMContentLoaded", init);

    async function init() {
        cacheElements();
        initTheme();
        initSectionNavigation();
        bindEvents();

        await loadDashboardData(false);
    }

    function cacheElements() {
        [
            "projetosUpdatedAt",
            "projetosStatus",
            "projetosThemeButton",
            "projetosThemeIcon",
            "projetosThemeText",
            "projetosRefreshButton",
            "projetosLoading",

            "projetosSearch",
            "projetosStatusFilter",
            "projetosHealthFilter",
            "projetosGroupFilter",
            "projetosResponsibleFilter",
            "projetosClearButton",
            "projetosActiveFilters",

            "projetosKpiTotal",
            "projetosKpiTotalSub",
            "projetosKpiActive",
            "projetosKpiDone",
            "projetosKpiOpen",
            "projetosKpiOpenSub",
            "projetosKpiOverdue",
            "projetosKpiOverdueSub",
            "projetosKpiProgress",

            "projetosHealthDonut",
            "projetosHealthTotal",
            "projetosHealthLegend",
            "projetosCriticalBody",
            "projetosProgressDistribution",
            "projetosWorkload",
            "projetosQuality",

            "projetosInsightGrid",
            "projetosExecutiveNarrative",
            "projetosDeadlineList",
            "projetosRiskRanking",

            "projetosSort",
            "projetosProjectGrid",
            "projetosProjectPagerInfo",
            "projetosPrevPage",
            "projetosNextPage",

            "projetosGanttProject",
            "projetosGanttChart",

            "projetosStatusName",
            "projetosStatusMeta",
            "projetosStatusProgress",
            "projetosStatusHealth",
            "projetosStatusTotal",
            "projetosStatusDone",
            "projetosStatusOverdue",
            "projetosStatusNext",
            "projetosStatusHeadline",
            "projetosStatusNarrative",
            "projetosAlertList",
            "projetosStatusTaskBody",

            "projetosBaseBody",
            "projetosBaseInfo",
        ].forEach((id) => {
            els[id] = document.getElementById(id);
        });
    }

    function bindEvents() {
        [
            els.projetosSearch,
            els.projetosStatusFilter,
            els.projetosHealthFilter,
            els.projetosGroupFilter,
            els.projetosResponsibleFilter,
        ].forEach((control) => {
            if (!control) return;

            control.addEventListener(
                control.tagName === "INPUT" ? "input" : "change",
                applyFilters
            );
        });

        els.projetosClearButton?.addEventListener(
            "click",
            clearFilters
        );

        els.projetosThemeButton?.addEventListener(
            "click",
            toggleTheme
        );

        els.projetosRefreshButton?.addEventListener(
            "click",
            async () => {
                await loadDashboardData(true);
            }
        );

        els.projetosSort?.addEventListener(
            "change",
            renderProjectGrid
        );

        els.projetosPrevPage?.addEventListener(
            "click",
            () => {
                currentPage -= 1;
                renderProjectGrid();
            }
        );

        els.projetosNextPage?.addEventListener(
            "click",
            () => {
                currentPage += 1;
                renderProjectGrid();
            }
        );

        els.projetosGanttProject?.addEventListener(
            "change",
            (event) => {
                selectProject(event.target.value, false);
            }
        );
    }

    async function loadDashboardData(forceRefresh = false) {
        const root = document.getElementById("projetosDashboard");
        const baseUrl = root?.dataset.url || window.location.pathname;

        const params = new URLSearchParams();
        params.set("dados", "1");

        if (forceRefresh) {
            params.set("refresh", "1");
        }

        const separator = baseUrl.includes("?") ? "&" : "?";
        const url = `${baseUrl}${separator}${params.toString()}`;

        showLoading(true);
        setApiStatus(
            forceRefresh
                ? "Atualizando dados diretamente no Microsoft Planner..."
                : "Carregando dados do portfólio...",
            "loading"
        );

        try {
            const response = await fetch(
                url,
                {
                    method: "GET",
                    credentials: "same-origin",
                    headers: {
                        "Accept": "application/json",
                        "X-Requested-With": "XMLHttpRequest",
                    },
                    cache: "no-store",
                }
            );

            let payload = {};

            try {
                payload = await response.json();
            } catch (jsonError) {
                throw new Error(
                    `A view respondeu HTTP ${response.status}, `
                    + "mas o conteúdo não era um JSON válido."
                );
            }

            if (!response.ok || payload.erro) {
                throw new Error(
                    payload.detalhe
                    || payload.mensagem
                    || `Erro HTTP ${response.status}`
                );
            }

            metadata = payload.metadata || {};
            resumo = payload.resumo || {};
            projects = (payload.projetos || []).map(normalizeProject);

            selectedProjectId = (
                projects.find(
                    (project) => (
                        project.status === "Ativo"
                        && project.total > 0
                    )
                )
                || projects.find(
                    (project) => project.total > 0
                )
                || projects[0]
                || null
            )?.id || null;

            populateFilters();
            populateProjectSelector();
            renderUpdatedAt();
            applyFilters();

            setApiStatus(
                `${number(projects.length)} projetos carregados do Microsoft Planner.`,
                "success",
                true
            );

            console.info(
                "[Dashboard Projetos] Payload carregado:",
                {
                    metadata,
                    resumo,
                    projetos: projects.length,
                    tarefas: projects.reduce(
                        (acc, project) => acc + project.total,
                        0
                    ),
                }
            );

        } catch (error) {
            console.error(
                "[Dashboard Projetos] Erro ao carregar API:",
                error
            );

            projects = [];
            filteredProjects = [];
            selectedProjectId = null;

            applyFilters();

            setApiStatus(
                `Não foi possível carregar os dados: ${error.message}`,
                "error"
            );

        } finally {
            showLoading(false);
        }
    }


    function setApiStatus(message, type = "loading", autoHide = false) {
        if (!els.projetosStatus) {
            return;
        }

        els.projetosStatus.hidden = false;
        els.projetosStatus.classList.remove(
            "is-error",
            "is-success"
        );

        if (type === "error") {
            els.projetosStatus.classList.add("is-error");
        } else if (type === "success") {
            els.projetosStatus.classList.add("is-success");
        }

        els.projetosStatus.textContent = message;

        if (autoHide) {
            window.clearTimeout(
                window.__projetosStatusTimer
            );

            window.__projetosStatusTimer = window.setTimeout(
                () => {
                    if (els.projetosStatus) {
                        els.projetosStatus.hidden = true;
                    }
                },
                4500
            );
        }
    }


    function normalizeProject(project) {
        const tasks = (project.tarefas || []).map((task) => ({
            id: task.id || "",
            title: task.titulo || "Sem título",
            bucket: task.bucket || "Sem bucket",
            progress: Number(task.percentual || 0),
            status: task.status || "",
            done: Boolean(task.concluida),
            overdue: Boolean(task.atrasada),
            priority: task.prioridade || "",
            start: parseDate(task.inicio),
            due: parseDate(task.prazo),
            completed: parseDate(task.concluida_em),
            created: parseDate(task.criada_em),
            responsibles: (task.responsaveis || [])
                .map((item) => item.nome)
                .filter(Boolean),
            hasDescription: Boolean(task.tem_descricao),
        }));

        return {
            id: project.id || "",
            name: project.nome || "Projeto sem nome",
            group: project.grupo?.nome || "Sem grupo",
            groupEmail: project.grupo?.email || "",
            status: project.status || "",
            health: project.saude || "",
            progress: Number(project.progresso_medio || 0),

            total: Number(project.quantidade_tarefas || 0),
            done: Number(project.tarefas_concluidas || 0),
            open: Number(project.tarefas_abertas || 0),
            overdue: Number(project.tarefas_atrasadas || 0),
            next7: Number(project.tarefas_proximos_7_dias || 0),
            unassigned: Number(project.tarefas_sem_responsavel || 0),
            undated: Number(project.tarefas_sem_prazo || 0),

            responsibles: project.responsaveis || [],

            created: parseDate(project.criado_em),
            start: parseDate(project.inicio_projeto),
            plannedEnd: parseDate(project.fim_planejado),
            nextDeadline: parseDate(project.proximo_vencimento),

            tasks,
            error: project.erro || "",
        };
    }

    function applyFilters() {
        const search = (
            els.projetosSearch?.value || ""
        ).trim().toLocaleLowerCase("pt-BR");

        const status = els.projetosStatusFilter?.value || "";
        const health = els.projetosHealthFilter?.value || "";
        const group = els.projetosGroupFilter?.value || "";
        const responsible = els.projetosResponsibleFilter?.value || "";

        filteredProjects = projects.filter((project) => {
            const haystack = [
                project.name,
                project.group,
                ...project.responsibles,
                ...project.tasks.slice(0, 80).map((task) => task.title),
            ]
                .join(" ")
                .toLocaleLowerCase("pt-BR");

            return (
                (!search || haystack.includes(search))
                && (!status || project.status === status)
                && (!health || project.health === health)
                && (!group || project.group === group)
                && (
                    !responsible
                    || project.responsibles.includes(responsible)
                )
            );
        });

        currentPage = 1;

        renderActiveFilters();
        renderAll();
    }

    function renderAll() {
        renderKpis();
        renderHealth();
        renderCritical();
        renderProgressDistribution();
        renderWorkload();
        renderQuality();
        renderInsights();
        renderDeadlines();
        renderRiskRanking();
        renderProjectGrid();
        renderGantt();
        renderStatus();
        renderBase();
    }

    function renderKpis() {
        const totalProjects = filteredProjects.length;

        const active = filteredProjects.filter(
            (project) => project.status === "Ativo"
        ).length;

        const done = filteredProjects.filter(
            (project) => project.status === "Concluído"
        ).length;

        const totalTasks = sum(
            filteredProjects,
            "total"
        );

        const open = sum(
            filteredProjects,
            "open"
        );

        const overdue = sum(
            filteredProjects,
            "overdue"
        );

        const averageProgress = totalProjects
            ? Math.round(
                filteredProjects.reduce(
                    (acc, project) => acc + project.progress,
                    0
                ) / totalProjects
            )
            : 0;

        setText("projetosKpiTotal", number(totalProjects));
        setText("projetosKpiActive", number(active));
        setText("projetosKpiDone", number(done));
        setText("projetosKpiOpen", number(open));
        setText("projetosKpiOverdue", number(overdue));
        setText("projetosKpiProgress", `${averageProgress}%`);

        setText(
            "projetosKpiTotalSub",
            `${number(totalTasks)} tarefas na seleção`
        );

        setText(
            "projetosKpiOpenSub",
            totalTasks
                ? `${Math.round(open / totalTasks * 100)}% do total`
                : "Sem tarefas"
        );

        setText(
            "projetosKpiOverdueSub",
            open
                ? `${Math.round(overdue / open * 100)}% das tarefas abertas`
                : "Sem tarefas abertas"
        );
    }

    function renderHealth() {
        const categories = [
            ["Saudável", "#24866a"],
            ["Atenção", "#c58b22"],
            ["Crítico", "#c95b62"],
            ["Concluído", "#175c96"],
            ["Sem tarefas", "#a7b7c7"],
        ];

        const total = Math.max(filteredProjects.length, 1);

        const counts = categories.map(
            ([name]) => filteredProjects.filter(
                (project) => project.health === name
            ).length
        );

        let cursor = 0;
        const gradient = [];

        categories.forEach(([name, color], index) => {
            const start = cursor;
            cursor += counts[index] / total * 100;

            gradient.push(
                `${color} ${start}% ${cursor}%`
            );
        });

        if (els.projetosHealthDonut) {
            els.projetosHealthDonut.style.background = (
                `conic-gradient(${gradient.join(",")})`
            );
        }

        setText(
            "projetosHealthTotal",
            number(filteredProjects.length)
        );

        if (els.projetosHealthLegend) {
            els.projetosHealthLegend.innerHTML = categories
                .map(([name, color], index) => `
                    <div class="projetos-health-legend-row">
                        <i style="background:${color}"></i>
                        <span>${escapeHtml(name)}</span>
                        <strong>${number(counts[index])}</strong>
                    </div>
                `)
                .join("");
        }
    }

    function renderCritical() {
        const critical = [...filteredProjects]
            .filter((project) => project.status === "Ativo")
            .sort((a, b) => (
                b.overdue - a.overdue
                || a.progress - b.progress
            ))
            .slice(0, 9);

        if (!els.projetosCriticalBody) return;

        if (!critical.length) {
            els.projetosCriticalBody.innerHTML = emptyRow(
                4,
                "Nenhum projeto ativo no recorte."
            );
            return;
        }

        els.projetosCriticalBody.innerHTML = critical
            .map((project) => `
                <tr>
                    <td>
                        <button
                            type="button"
                            class="projetos-project-link"
                            data-project-id="${escapeHtml(project.id)}"
                        >
                            ${escapeHtml(project.name)}
                        </button>
                    </td>
                    <td>${miniProgress(project.progress)}</td>
                    <td class="${project.overdue ? "is-low" : ""}">
                        ${number(project.overdue)}
                    </td>
                    <td>${healthBadge(project.health)}</td>
                </tr>
            `)
            .join("");

        bindProjectButtons();
    }

    function renderProgressDistribution() {
        const bands = [
            ["0–24%", 0, 24],
            ["25–49%", 25, 49],
            ["50–74%", 50, 74],
            ["75–99%", 75, 99],
            ["100%", 100, 100],
        ];

        const values = bands.map(([, min, max]) => {
            return filteredProjects.filter(
                (project) => (
                    project.progress >= min
                    && project.progress <= max
                )
            ).length;
        });

        renderProgressRows(
            els.projetosProgressDistribution,
            bands.map(([label], index) => ({
                label,
                value: values[index],
                display: number(values[index]),
            }))
        );
    }

    function renderWorkload() {
        const counts = {};

        filteredProjects.forEach((project) => {
            project.tasks.forEach((task) => {
                if (task.done) return;

                task.responsibles.forEach((name) => {
                    counts[name] = (counts[name] || 0) + 1;
                });
            });
        });

        const items = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6)
            .map(([label, value]) => ({
                label,
                value,
                display: number(value),
            }));

        renderProgressRows(
            els.projetosWorkload,
            items,
            "Sem atribuições no recorte."
        );
    }

    function renderQuality() {
        const tasks = allTasks();

        const total = Math.max(tasks.length, 1);

        const values = [
            ["Com prazo", tasks.filter((task) => validDate(task.due)).length],
            ["Com início", tasks.filter((task) => validDate(task.start)).length],
            ["Com responsável", tasks.filter((task) => task.responsibles.length).length],
            ["Com descrição", tasks.filter((task) => task.hasDescription).length],
        ];

        renderProgressRows(
            els.projetosQuality,
            values.map(([label, value]) => ({
                label,
                value,
                display: `${Math.round(value / total * 100)}%`,
                percent: value / total * 100,
            }))
        );
    }

    function renderInsights() {
        const critical = filteredProjects.filter(
            (project) => project.health === "Crítico"
        ).length;

        const active = filteredProjects.filter(
            (project) => project.status === "Ativo"
        ).length;

        const overdue = sum(filteredProjects, "overdue");
        const unassigned = sum(filteredProjects, "unassigned");
        const undated = sum(filteredProjects, "undated");
        const next7 = sum(filteredProjects, "next7");

        const insights = [
            {
                icon: "fa-exclamation-triangle",
                title: "Pressão de prazo",
                text: overdue
                    ? `${number(overdue)} tarefas abertas já ultrapassaram o prazo.`
                    : "Nenhuma tarefa vencida no recorte.",
                className: overdue ? "is-critical" : "is-good",
            },
            {
                icon: "fa-heartbeat",
                title: "Saúde do portfólio",
                text: active
                    ? `${number(critical)} de ${number(active)} projetos ativos estão classificados como críticos.`
                    : "Não há projetos ativos no recorte.",
                className: critical ? "is-warning" : "is-good",
            },
            {
                icon: "fa-user-times",
                title: "Responsabilidade",
                text: unassigned
                    ? `${number(unassigned)} tarefas estão sem responsável definido.`
                    : "Todas as tarefas possuem responsável.",
                className: unassigned ? "is-warning" : "is-good",
            },
            {
                icon: "fa-calendar-times-o",
                title: "Planejamento",
                text: undated
                    ? `${number(undated)} tarefas não possuem prazo de conclusão.`
                    : `${number(next7)} tarefas vencem nos próximos 7 dias.`,
                className: undated ? "is-warning" : "is-good",
            },
        ];

        if (els.projetosInsightGrid) {
            els.projetosInsightGrid.innerHTML = insights
                .map((item) => `
                    <article class="projetos-ui-insight projetos-insight-card ${item.className}">
                        <i class="fa ${item.icon}" aria-hidden="true"></i>
                        <strong>${escapeHtml(item.title)}</strong>
                        <p>${escapeHtml(item.text)}</p>
                    </article>
                `)
                .join("");
        }

        renderExecutiveNarrative();
    }

    function renderExecutiveNarrative() {
        if (!els.projetosExecutiveNarrative) return;

        if (!filteredProjects.length) {
            els.projetosExecutiveNarrative.textContent = (
                "Nenhum projeto corresponde aos filtros atuais."
            );
            return;
        }

        const active = filteredProjects.filter(
            (project) => project.status === "Ativo"
        );

        const done = filteredProjects.filter(
            (project) => project.status === "Concluído"
        );

        const overdue = sum(filteredProjects, "overdue");

        const critical = filteredProjects.filter(
            (project) => project.health === "Crítico"
        );

        const worst = [...filteredProjects]
            .sort((a, b) => (
                b.overdue - a.overdue
                || a.progress - b.progress
            ))[0];

        let text = (
            `O recorte atual contém ${number(filteredProjects.length)} projetos, `
            + `sendo ${number(active.length)} ativos e ${number(done.length)} concluídos. `
        );

        if (overdue) {
            text += (
                `Existem ${number(overdue)} tarefas vencidas e `
                + `${number(critical.length)} projetos em situação crítica. `
            );
        } else {
            text += "Não existem tarefas vencidas neste recorte. ";
        }

        if (worst?.overdue) {
            text += (
                `A maior concentração de risco está em “${worst.name}”, `
                + `com ${number(worst.overdue)} tarefas atrasadas `
                + `e ${Math.round(worst.progress)}% de progresso médio.`
            );
        }

        els.projetosExecutiveNarrative.textContent = text;
    }

    function renderDeadlines() {
        const items = [];

        filteredProjects.forEach((project) => {
            project.tasks.forEach((task) => {
                if (
                    task.done
                    || !validDate(task.due)
                    || task.due < new Date()
                ) {
                    return;
                }

                items.push({
                    project,
                    task,
                });
            });
        });

        items.sort(
            (a, b) => a.task.due - b.task.due
        );

        const top = items.slice(0, 8);

        if (!els.projetosDeadlineList) return;

        if (!top.length) {
            els.projetosDeadlineList.innerHTML = emptyDiv(
                "Sem vencimentos futuros no recorte."
            );
            return;
        }

        els.projetosDeadlineList.innerHTML = top
            .map(({ project, task }) => {
                const days = Math.max(
                    0,
                    Math.ceil(
                        (
                            task.due.getTime()
                            - Date.now()
                        )
                        / 86400000
                    )
                );

                return `
                    <div class="projetos-deadline">
                        <div class="projetos-deadline-date">
                            <strong>${String(task.due.getDate()).padStart(2, "0")}</strong>
                            <span>${month(task.due)}</span>
                        </div>

                        <div class="projetos-deadline-copy">
                            <strong>${escapeHtml(task.title)}</strong>
                            <span>
                                ${escapeHtml(project.name)}
                                ·
                                ${escapeHtml(
                                    task.responsibles.join(", ")
                                    || "Sem responsável"
                                )}
                            </span>
                        </div>

                        <span class="projetos-day-pill ${days <= 7 ? "is-near" : ""}">
                            ${days === 0 ? "Hoje" : `${days}d`}
                        </span>
                    </div>
                `;
            })
            .join("");
    }

    function renderRiskRanking() {
        const ranking = [...filteredProjects]
            .filter((project) => project.status === "Ativo")
            .sort((a, b) => (
                b.overdue - a.overdue
                || a.progress - b.progress
            ))
            .slice(0, 8);

        if (!els.projetosRiskRanking) return;

        if (!ranking.length) {
            els.projetosRiskRanking.innerHTML = emptyDiv(
                "Nenhum projeto ativo no recorte."
            );
            return;
        }

        els.projetosRiskRanking.innerHTML = ranking
            .map((project, index) => `
                <button
                    type="button"
                    class="projetos-risk-row projetos-project-link"
                    data-project-id="${escapeHtml(project.id)}"
                >
                    <span class="projetos-risk-rank">
                        ${index + 1}
                    </span>

                    <span class="projetos-risk-copy">
                        <strong>${escapeHtml(project.name)}</strong>
                        <span>
                            ${Math.round(project.progress)}% concluído
                            · ${number(project.open)} abertas
                        </span>
                    </span>

                    <strong class="projetos-risk-value">
                        ${number(project.overdue)}
                    </strong>
                </button>
            `)
            .join("");

        bindProjectButtons();
    }

    function renderProjectGrid() {
        if (!els.projetosProjectGrid) return;

        const sorted = sortProjects(filteredProjects);

        const pages = Math.max(
            1,
            Math.ceil(sorted.length / PAGE_SIZE)
        );

        currentPage = clamp(
            currentPage,
            1,
            pages
        );

        const start = (
            currentPage - 1
        ) * PAGE_SIZE;

        const pageItems = sorted.slice(
            start,
            start + PAGE_SIZE
        );

        if (!pageItems.length) {
            els.projetosProjectGrid.innerHTML = emptyDiv(
                "Nenhum projeto encontrado."
            );
        } else {
            els.projetosProjectGrid.innerHTML = pageItems
                .map((project) => `
                    <article
                        class="projetos-project-card"
                        data-project-id="${escapeHtml(project.id)}"
                    >
                        <div class="projetos-project-card-head">
                            <div>
                                <h3 title="${escapeHtml(project.name)}">
                                    ${escapeHtml(project.name)}
                                </h3>
                                <span class="projetos-project-group">
                                    ${escapeHtml(project.group)}
                                </span>
                            </div>

                            ${healthBadge(project.health)}
                        </div>

                        <div class="projetos-project-stats">
                            <div class="projetos-project-stat">
                                <strong>${number(project.total)}</strong>
                                <span>Tarefas</span>
                            </div>

                            <div class="projetos-project-stat">
                                <strong>${number(project.done)}</strong>
                                <span>Concluídas</span>
                            </div>

                            <div class="projetos-project-stat">
                                <strong class="${project.overdue ? "is-low" : ""}">
                                    ${number(project.overdue)}
                                </strong>
                                <span>Atrasadas</span>
                            </div>
                        </div>

                        <div class="projetos-project-progress">
                            <div class="projetos-project-progress-head">
                                <span>Progresso</span>
                                <strong>${Math.round(project.progress)}%</strong>
                            </div>

                            <div class="projetos-progress-track">
                                <div
                                    class="projetos-progress-fill"
                                    style="width:${clamp(project.progress, 0, 100)}%"
                                ></div>
                            </div>
                        </div>
                    </article>
                `)
                .join("");
        }

        setText(
            "projetosProjectPagerInfo",
            `${number(sorted.length)} projetos · página ${currentPage} de ${pages}`
        );

        if (els.projetosPrevPage) {
            els.projetosPrevPage.disabled = currentPage <= 1;
        }

        if (els.projetosNextPage) {
            els.projetosNextPage.disabled = currentPage >= pages;
        }

        bindProjectCards();
    }

    function renderGantt() {
        if (!els.projetosGanttChart) return;

        const project = projects.find(
            (item) => item.id === selectedProjectId
        );

        if (!project || !project.tasks.length) {
            els.projetosGanttChart.innerHTML = emptyDiv(
                "Projeto sem tarefas."
            );
            return;
        }

        const tasks = project.tasks
            .filter(
                (task) => validDate(task.start) || validDate(task.due)
            )
            .sort((a, b) => {
                return (
                    (
                        a.start
                        || a.due
                        || a.created
                    )
                    -
                    (
                        b.start
                        || b.due
                        || b.created
                    )
                );
            });

        if (!tasks.length) {
            els.projetosGanttChart.innerHTML = emptyDiv(
                "As tarefas deste projeto não possuem datas válidas para o Gantt."
            );
            return;
        }

        const dates = [];

        tasks.forEach((task) => {
            [
                task.start,
                task.due,
                task.completed,
            ].forEach((date) => {
                if (validDate(date)) dates.push(date);
            });
        });

        let minDate = new Date(
            Math.min(
                ...dates.map((date) => date.getTime())
            )
        );

        let maxDate = new Date(
            Math.max(
                ...dates.map((date) => date.getTime())
            )
        );

        if (
            maxDate.getTime()
            - minDate.getTime()
            < 30 * 86400000
        ) {
            maxDate = new Date(
                minDate.getTime()
                + 30 * 86400000
            );
        }

        const span = Math.max(
            maxDate.getTime() - minDate.getTime(),
            86400000
        );

        const position = (date) => clamp(
            (
                date.getTime()
                - minDate.getTime()
            )
            / span
            * 100,
            0,
            100
        );

        const months = [];

        let cursor = new Date(
            minDate.getFullYear(),
            minDate.getMonth(),
            1
        );

        while (
            cursor <= maxDate
            && months.length < 36
        ) {
            const next = new Date(
                cursor.getFullYear(),
                cursor.getMonth() + 1,
                1
            );

            months.push({
                date: new Date(cursor),
                left: position(cursor),
                width: position(next) - position(cursor),
            });

            cursor = next;
        }

        const today = new Date();

        const todayPercent = (
            today >= minDate
            && today <= maxDate
        )
            ? position(today)
            : null;

        let html = `
            <div class="projetos-gantt-head">
                <div class="projetos-gantt-name">
                    Tarefa
                </div>

                <div class="projetos-gantt-axis">
                    ${months.map((item) => `
                        <div
                            class="projetos-gantt-month"
                            style="
                                left:${item.left}%;
                                width:${Math.max(item.width, 4)}%;
                            "
                        >
                            ${month(item.date)}
                            /
                            ${String(item.date.getFullYear()).slice(-2)}
                        </div>
                    `).join("")}

                    ${todayPercent !== null
                        ? `
                            <div
                                class="projetos-gantt-today"
                                style="left:${todayPercent}%"
                            ></div>
                        `
                        : ""
                    }
                </div>
            </div>
        `;

        html += tasks
            .map((task) => {
                let start = task.start || task.created || task.due;
                let end = (
                    task.due
                    || task.completed
                    || new Date(start.getTime() + 86400000)
                );

                if (end < start) {
                    [start, end] = [end, start];
                }

                const left = position(start);
                const width = Math.max(
                    position(end) - left,
                    .8
                );

                const barClass = task.done
                    ? "is-done"
                    : task.overdue
                        ? "is-overdue"
                        : "";

                return `
                    <div class="projetos-gantt-row">
                        <div class="projetos-gantt-name">
                            <div class="projetos-gantt-task-title">
                                ${escapeHtml(task.title)}
                            </div>

                            <div class="projetos-gantt-task-meta">
                                ${escapeHtml(task.bucket)}
                                ·
                                ${escapeHtml(
                                    task.responsibles.join(", ")
                                    || "Sem responsável"
                                )}
                            </div>
                        </div>

                        <div class="projetos-gantt-track">
                            ${todayPercent !== null
                                ? `
                                    <div
                                        class="projetos-gantt-today"
                                        style="left:${todayPercent}%"
                                    ></div>
                                `
                                : ""
                            }

                            <div
                                class="projetos-gantt-bar ${barClass}"
                                style="
                                    left:${left}%;
                                    width:${width}%;
                                "
                                title="${date(start)} → ${date(end)}"
                            >
                                <span>
                                    ${Math.round(task.progress)}%
                                </span>
                            </div>
                        </div>
                    </div>
                `;
            })
            .join("");

        els.projetosGanttChart.innerHTML = html;
    }

    function renderStatus() {
        const project = (
            projects.find(
                (item) => item.id === selectedProjectId
            )
            || projects[0]
        );

        if (!project) return;

        setText("projetosStatusName", project.name);

        setText(
            "projetosStatusMeta",
            `${project.group} · ${project.status} · `
            + (
                project.responsibles
                    .slice(0, 5)
                    .join(", ")
                || "Sem responsável definido"
            )
        );

        setText(
            "projetosStatusProgress",
            `${Math.round(project.progress)}%`
        );

        if (els.projetosStatusHealth) {
            els.projetosStatusHealth.className = (
                `projetos-health-pill ${healthClass(project.health)}`
            );

            els.projetosStatusHealth.textContent = project.health || "—";
        }

        setText("projetosStatusTotal", number(project.total));
        setText("projetosStatusDone", number(project.done));
        setText("projetosStatusOverdue", number(project.overdue));

        setText(
            "projetosStatusNext",
            validDate(project.nextDeadline)
                ? date(project.nextDeadline)
                : "—"
        );

        let headline = "Execução dentro do esperado";

        if (project.status === "Concluído") {
            headline = "Projeto concluído";
        } else if (project.health === "Crítico") {
            headline = "Ação executiva recomendada";
        } else if (project.health === "Atenção") {
            headline = "Projeto requer acompanhamento";
        } else if (project.status === "Sem tarefas") {
            headline = "Projeto sem tarefas";
        }

        setText(
            "projetosStatusHeadline",
            headline
        );

        let narrative;

        if (project.status === "Sem tarefas") {
            narrative = (
                "O plano não possui tarefas e, por isso, não é tratado "
                + "automaticamente como concluído."
            );
        } else if (project.status === "Concluído") {
            narrative = (
                `Todas as ${number(project.total)} tarefas estão concluídas. `
                + `O projeto é considerado encerrado, com `
                + `${Math.round(project.progress)}% de progresso médio.`
            );
        } else {
            const openPercent = project.total
                ? Math.round(project.open / project.total * 100)
                : 0;

            narrative = (
                `O projeto possui ${number(project.open)} tarefas abertas `
                + `(${openPercent}% do total), `
                + `${number(project.overdue)} em atraso e `
                + `${Math.round(project.progress)}% de progresso médio. `
            );

            if (validDate(project.nextDeadline)) {
                narrative += (
                    `O próximo vencimento está previsto para `
                    + `${date(project.nextDeadline)}.`
                );
            } else {
                narrative += (
                    "Não há próximo vencimento futuro identificado."
                );
            }
        }

        setText(
            "projetosStatusNarrative",
            narrative
        );

        renderAlerts(project);
        renderStatusTasks(project);
    }

    function renderAlerts(project) {
        const alerts = [];

        if (project.overdue) {
            alerts.push([
                "Prazo",
                `${number(project.overdue)} tarefa(s) vencida(s) ainda não concluída(s).`,
                "fa-clock-o",
            ]);
        }

        if (project.unassigned) {
            alerts.push([
                "Responsável",
                `${number(project.unassigned)} tarefa(s) sem responsável atribuído.`,
                "fa-user-times",
            ]);
        }

        if (project.undated) {
            alerts.push([
                "Planejamento",
                `${number(project.undated)} tarefa(s) sem prazo de conclusão.`,
                "fa-calendar-times-o",
            ]);
        }

        if (project.error) {
            alerts.push([
                "Integração",
                project.error,
                "fa-plug",
            ]);
        }

        if (!alerts.length) {
            alerts.push([
                "Sem alerta",
                "Nenhum risco estrutural detectado pelas regras automáticas atuais.",
                "fa-check",
            ]);
        }

        if (!els.projetosAlertList) return;

        els.projetosAlertList.innerHTML = alerts
            .map(([title, text, icon]) => `
                <div class="projetos-alert">
                    <span class="projetos-alert-icon">
                        <i class="fa ${icon}" aria-hidden="true"></i>
                    </span>

                    <div>
                        <strong>${escapeHtml(title)}</strong>
                        <p>${escapeHtml(text)}</p>
                    </div>
                </div>
            `)
            .join("");
    }

    function renderStatusTasks(project) {
        if (!els.projetosStatusTaskBody) return;

        const tasks = [...project.tasks]
            .sort((a, b) => (
                Number(b.overdue)
                - Number(a.overdue)
                || a.progress
                - b.progress
            ));

        if (!tasks.length) {
            els.projetosStatusTaskBody.innerHTML = emptyRow(
                6,
                "Projeto sem tarefas."
            );
            return;
        }

        els.projetosStatusTaskBody.innerHTML = tasks
            .map((task) => `
                <tr>
                    <td>${escapeHtml(task.title)}</td>
                    <td>${escapeHtml(task.bucket)}</td>
                    <td>
                        ${escapeHtml(
                            task.responsibles.join(", ")
                            || "—"
                        )}
                    </td>
                    <td>
                        ${validDate(task.due) ? date(task.due) : "—"}
                    </td>
                    <td>${miniProgress(task.progress)}</td>
                    <td>${taskBadge(task)}</td>
                </tr>
            `)
            .join("");
    }

    function renderBase() {
        if (!els.projetosBaseBody) return;

        const rows = [];

        filteredProjects.forEach((project) => {
            project.tasks.forEach((task) => {
                rows.push({
                    project,
                    task,
                });
            });
        });

        rows.sort((a, b) => {
            return (
                String(a.project.name).localeCompare(
                    String(b.project.name),
                    "pt-BR"
                )
                || Number(b.task.overdue) - Number(a.task.overdue)
            );
        });

        const visible = rows.slice(0, BASE_LIMIT);

        if (!visible.length) {
            els.projetosBaseBody.innerHTML = emptyRow(
                9,
                "Nenhuma tarefa encontrada."
            );
        } else {
            els.projetosBaseBody.innerHTML = visible
                .map(({ project, task }) => `
                    <tr>
                        <td>${escapeHtml(project.name)}</td>
                        <td>${escapeHtml(project.group)}</td>
                        <td>${escapeHtml(task.title)}</td>
                        <td>${escapeHtml(task.bucket)}</td>
                        <td>
                            ${escapeHtml(
                                task.responsibles.join(", ")
                                || "—"
                            )}
                        </td>
                        <td>${validDate(task.start) ? date(task.start) : "—"}</td>
                        <td>${validDate(task.due) ? date(task.due) : "—"}</td>
                        <td>${Math.round(task.progress)}%</td>
                        <td>${taskBadge(task)}</td>
                    </tr>
                `)
                .join("");
        }

        setText(
            "projetosBaseInfo",
            rows.length > BASE_LIMIT
                ? `Exibindo ${number(BASE_LIMIT)} de ${number(rows.length)} tarefas do recorte`
                : `${number(rows.length)} tarefas no recorte`
        );
    }

    function selectProject(projectId, scrollToStatus = true) {
        if (!projectId) return;

        selectedProjectId = projectId;

        if (els.projetosGanttProject) {
            els.projetosGanttProject.value = projectId;
        }

        renderGantt();
        renderStatus();

        if (scrollToStatus) {
            document
                .getElementById("projetos-section-status")
                ?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                });
        }
    }

    function bindProjectButtons() {
        document
            .querySelectorAll("button[data-project-id]")
            .forEach((button) => {
                button.addEventListener(
                    "click",
                    () => selectProject(
                        button.dataset.projectId
                    )
                );
            });
    }

    function bindProjectCards() {
        document
            .querySelectorAll(".projetos-project-card[data-project-id]")
            .forEach((card) => {
                card.addEventListener(
                    "click",
                    () => selectProject(
                        card.dataset.projectId
                    )
                );
            });
    }

    function populateFilters() {
        fillSelect(
            els.projetosGroupFilter,
            unique(
                projects.map((project) => project.group)
            ).sort(localeSort),
            "Todos"
        );

        fillSelect(
            els.projetosResponsibleFilter,
            unique(
                projects.flatMap(
                    (project) => project.responsibles
                )
            ).sort(localeSort),
            "Todos"
        );
    }

    function populateProjectSelector() {
        if (!els.projetosGanttProject) return;

        const items = projects
            .filter((project) => project.total > 0)
            .sort((a, b) => localeSort(a.name, b.name));

        els.projetosGanttProject.innerHTML = items
            .map((project) => `
                <option value="${escapeHtml(project.id)}">
                    ${escapeHtml(project.name)}
                </option>
            `)
            .join("");

        if (
            selectedProjectId
            && items.some(
                (project) => project.id === selectedProjectId
            )
        ) {
            els.projetosGanttProject.value = selectedProjectId;
        }
    }

    function renderActiveFilters() {
        if (!els.projetosActiveFilters) return;

        const chips = [];

        const values = [
            ["Busca", els.projetosSearch?.value],
            ["Status", els.projetosStatusFilter?.value],
            ["Saúde", els.projetosHealthFilter?.value],
            ["Grupo", els.projetosGroupFilter?.value],
            ["Responsável", els.projetosResponsibleFilter?.value],
        ];

        values.forEach(([label, value]) => {
            if (!value) return;

            chips.push(
                `<span class="projetos-ui-filter-chip">${escapeHtml(label)}: ${escapeHtml(value)}</span>`
            );
        });

        els.projetosActiveFilters.innerHTML = chips.join("");
    }

    function clearFilters() {
        if (els.projetosSearch) els.projetosSearch.value = "";
        if (els.projetosStatusFilter) els.projetosStatusFilter.value = "";
        if (els.projetosHealthFilter) els.projetosHealthFilter.value = "";
        if (els.projetosGroupFilter) els.projetosGroupFilter.value = "";
        if (els.projetosResponsibleFilter) els.projetosResponsibleFilter.value = "";

        applyFilters();
    }

    function renderProgressRows(element, items, emptyText = "Sem dados.") {
        if (!element) return;

        if (!items.length) {
            element.innerHTML = emptyDiv(emptyText);
            return;
        }

        const maxValue = Math.max(
            1,
            ...items.map((item) => item.value)
        );

        element.innerHTML = items
            .map((item) => {
                const percent = item.percent ?? (
                    item.value / maxValue * 100
                );

                return `
                    <div class="projetos-progress-row">
                        <span title="${escapeHtml(item.label)}">
                            ${escapeHtml(item.label)}
                        </span>

                        <div class="projetos-progress-track">
                            <div
                                class="projetos-progress-fill"
                                style="width:${clamp(percent, 0, 100)}%"
                            ></div>
                        </div>

                        <strong>${escapeHtml(item.display)}</strong>
                    </div>
                `;
            })
            .join("");
    }

    function sortProjects(items) {
        const mode = els.projetosSort?.value || "risk";
        const sorted = [...items];

        if (mode === "progressAsc") {
            return sorted.sort(
                (a, b) => a.progress - b.progress
            );
        }

        if (mode === "progressDesc") {
            return sorted.sort(
                (a, b) => b.progress - a.progress
            );
        }

        if (mode === "name") {
            return sorted.sort(
                (a, b) => localeSort(a.name, b.name)
            );
        }

        return sorted.sort((a, b) => (
            b.overdue - a.overdue
            || healthWeight(b.health) - healthWeight(a.health)
            || a.progress - b.progress
        ));
    }

    function healthWeight(health) {
        return {
            "Crítico": 6,
            "Atenção": 5,
            "Saudável": 4,
            "Concluído": 3,
            "Sem tarefas": 2,
            "Erro": 7,
        }[health] || 0;
    }

    function healthBadge(health) {
        return `
            <span class="projetos-health-badge ${healthClass(health)}">
                ${escapeHtml(health || "—")}
            </span>
        `;
    }

    function healthClass(health) {
        return {
            "Saudável": "is-health-good",
            "Atenção": "is-health-warning",
            "Crítico": "is-health-critical",
            "Concluído": "is-health-done",
            "Sem tarefas": "is-health-neutral",
            "Erro": "is-health-critical",
        }[health] || "is-health-neutral";
    }

    function taskBadge(task) {
        const status = task.status || (
            task.done
                ? "Concluída"
                : task.overdue
                    ? "Atrasada"
                    : task.progress > 0
                        ? "Em andamento"
                        : "Não iniciada"
        );

        let cls = "is-health-neutral";

        if (status === "Concluída") {
            cls = "is-health-good";
        } else if (status === "Atrasada") {
            cls = "is-health-critical";
        } else if (status === "Em andamento") {
            cls = "is-health-done";
        }

        return `
            <span class="projetos-task-badge ${cls}">
                ${escapeHtml(status)}
            </span>
        `;
    }

    function miniProgress(value) {
        const progress = clamp(
            Number(value || 0),
            0,
            100
        );

        return `
            <div class="projetos-mini-progress">
                <div class="projetos-mini-progress-track">
                    <div
                        class="projetos-mini-progress-fill"
                        style="width:${progress}%"
                    ></div>
                </div>
                <strong>${Math.round(progress)}%</strong>
            </div>
        `;
    }

    function initSectionNavigation() {
        const nav = document.getElementById("projetosSectionNav");
        const slot = document.getElementById("projetosSectionNavSlot");

        if (!nav || !slot) return;

        const links = [
            ...nav.querySelectorAll("[data-section-nav]")
        ];

        const sections = links
            .map((link) => {
                return document.getElementById(
                    link.dataset.sectionNav
                );
            })
            .filter(Boolean);

        links.forEach((link) => {
            link.addEventListener("click", (event) => {
                const section = document.getElementById(
                    link.dataset.sectionNav
                );

                if (!section) return;

                event.preventDefault();

                section.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                });
            });
        });

        const updateDock = () => {
            const slotRect = slot.getBoundingClientRect();

            if (slotRect.top <= 8) {
                nav.classList.add("is-docked");

                const shell = slot.closest(".projetos-ui-shell");

                if (shell) {
                    const rect = shell.getBoundingClientRect();

                    nav.style.left = `${rect.left}px`;
                    nav.style.width = `${rect.width}px`;
                }
            } else {
                nav.classList.remove("is-docked");
                nav.style.left = "";
                nav.style.width = "";
            }
        };

        const updateActive = () => {
            const marker = 120;

            let current = sections[0]?.id;

            sections.forEach((section) => {
                const rect = section.getBoundingClientRect();

                if (rect.top <= marker) {
                    current = section.id;
                }
            });

            links.forEach((link) => {
                link.classList.toggle(
                    "is-active",
                    link.dataset.sectionNav === current
                );
            });
        };

        window.addEventListener(
            "scroll",
            () => {
                updateDock();
                updateActive();
            },
            { passive: true }
        );

        window.addEventListener(
            "resize",
            updateDock
        );

        updateDock();
        updateActive();
    }

    function initTheme() {
        const saved = localStorage.getItem(
            "workspace-dashboard-theme"
        );

        if (saved === "dark" || saved === "light") {
            document.documentElement.setAttribute(
                "data-theme",
                saved
            );
        }

        updateThemeButton();
    }

    function toggleTheme() {
        const current = (
            document.documentElement.getAttribute("data-theme")
            || "light"
        );

        const next = current === "dark"
            ? "light"
            : "dark";

        document.documentElement.setAttribute(
            "data-theme",
            next
        );

        localStorage.setItem(
            "workspace-dashboard-theme",
            next
        );

        updateThemeButton();
    }

    function updateThemeButton() {
        const dark = (
            document.documentElement.getAttribute("data-theme")
            === "dark"
        );

        if (els.projetosThemeIcon) {
            els.projetosThemeIcon.className = dark
                ? "fa fa-sun-o"
                : "fa fa-moon-o";
        }

        setText(
            "projetosThemeText",
            dark
                ? "Modo claro"
                : "Modo escuro"
        );
    }

    function showLoading(show) {
        if (!els.projetosLoading) return;

        els.projetosLoading.classList.toggle(
            "is-visible",
            Boolean(show)
        );
    }

    function renderUpdatedAt() {
        const value = parseDate(
            metadata.gerado_em
        );

        setText(
            "projetosUpdatedAt",
            validDate(value)
                ? dateTime(value)
                : "—"
        );
    }

    function fillSelect(element, items, allLabel) {
        if (!element) return;

        element.innerHTML = `
            <option value="">${escapeHtml(allLabel)}</option>
            ${items.map((item) => `
                <option value="${escapeHtml(item)}">
                    ${escapeHtml(item)}
                </option>
            `).join("")}
        `;
    }

    function allTasks() {
        return filteredProjects.flatMap(
            (project) => project.tasks
        );
    }

    function sum(items, field) {
        return items.reduce(
            (acc, item) => (
                acc + Number(item[field] || 0)
            ),
            0
        );
    }

    function readJson(id, fallback) {
        const element = document.getElementById(id);

        if (!element) return fallback;

        try {
            return JSON.parse(element.textContent);
        } catch (error) {
            console.error(
                `Falha ao ler ${id}`,
                error
            );

            return fallback;
        }
    }

    function parseDate(value) {
        if (!value) return null;

        const parsed = new Date(value);

        return Number.isNaN(
            parsed.getTime()
        )
            ? null
            : parsed;
    }

    function validDate(value) {
        return (
            value instanceof Date
            && !Number.isNaN(value.getTime())
            && value.getFullYear() >= 2000
            && value.getFullYear() <= 2100
        );
    }

    function date(value) {
        if (!validDate(value)) return "—";

        return value.toLocaleDateString(
            "pt-BR",
            {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
            }
        );
    }

    function dateTime(value) {
        if (!validDate(value)) return "—";

        return value.toLocaleString(
            "pt-BR",
            {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
            }
        );
    }

    function month(value) {
        return value
            .toLocaleDateString(
                "pt-BR",
                { month: "short" }
            )
            .replace(".", "")
            .toUpperCase();
    }

    function number(value) {
        return Number(value || 0)
            .toLocaleString("pt-BR");
    }

    function unique(items) {
        return [
            ...new Set(
                items.filter(Boolean)
            ),
        ];
    }

    function localeSort(a, b) {
        return String(a || "").localeCompare(
            String(b || ""),
            "pt-BR",
            { sensitivity: "base" }
        );
    }

    function clamp(value, min, max) {
        return Math.max(
            min,
            Math.min(max, value)
        );
    }

    function setText(id, value) {
        if (els[id]) {
            els[id].textContent = value;
        }
    }

    function emptyRow(columns, text) {
        return `
            <tr>
                <td
                    colspan="${columns}"
                    class="projetos-empty"
                >
                    ${escapeHtml(text)}
                </td>
            </tr>
        `;
    }

    function emptyDiv(text) {
        return `
            <div class="projetos-empty">
                ${escapeHtml(text)}
            </div>
        `;
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(
                /[&<>"']/g,
                (char) => ({
                    "&": "&amp;",
                    "<": "&lt;",
                    ">": "&gt;",
                    '"': "&quot;",
                    "'": "&#039;",
                })[char]
            );
    }
})();
