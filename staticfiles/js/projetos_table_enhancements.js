(function () {
    "use strict";

    /*
     * WORKSPACE | PROJETOS
     * Enhancement NÃO intrusivo da tabela do portfólio.
     *
     * O projetos.js principal permanece intocado.
     * Esta camada trabalha somente sobre o DOM já renderizado.
     */

    const head = document.getElementById("projetosTableHead");
    const body = document.getElementById("projetosTableBody");
    const table = head ? head.closest("table") : null;

    if (!head || !body || !table) return;

    let applying = false;
    let scheduled = false;

    const WIDTHS_STORAGE_KEY = "workspace.projetos.table.columnWidths.v1";
    const columnWidths = loadWidths();
    const projectBootstrap = readProjectBootstrap();

    function normalize(value) {
        return String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "");
    }

    function text(node) {
        return String(node?.textContent || "")
            .replace(/\s+/g, " ")
            .trim();
    }

    function escapeText(value) {
        return String(value == null ? "" : value);
    }

    function readProjectBootstrap() {
        const source = document.getElementById("projetosInitialBootstrap");
        const map = new Map();
        if (!source) return map;

        try {
            const items = JSON.parse(source.textContent || "[]");
            if (!Array.isArray(items)) return map;
            items.forEach((item) => {
                const id = Number(item?.id || 0);
                if (id) map.set(id, item);
            });
        } catch (error) {
            // O bootstrap é somente apoio visual.
        }
        return map;
    }

    function loadWidths() {
        try {
            const raw = window.localStorage.getItem(WIDTHS_STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : {};
            return parsed && typeof parsed === "object" ? parsed : {};
        } catch (error) {
            return {};
        }
    }

    function saveWidths() {
        try {
            window.localStorage.setItem(
                WIDTHS_STORAGE_KEY,
                JSON.stringify(columnWidths)
            );
        } catch (error) {
            // Persistência de largura é opcional.
        }
    }

    function formatDate(value) {
        if (!value) return "—";
        const raw = String(value);
        const iso = raw.slice(0, 10);

        if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
            const [year, month, day] = iso.split("-");
            return `${day}/${month}/${year}`;
        }

        return raw;
    }

    function originalHeaderKey(th) {
        if (!th) return "";
        if (th.dataset.listColumn) return th.dataset.listColumn;
        if (th.dataset.enhancementColumn) return th.dataset.enhancementColumn;

        const label = normalize(text(th.querySelector("button") || th));
        const aliases = {
            projeto: "project",
            tipo: "type",
            referencia: "reference",
            cliente: "client",
            empresa: "company",
            owner: "owner",
            stakeholder: "stakeholder",
            responsavel: "responsible",
            grupo: "group",
            periodo: "period",
            status: "status",
            saude: "health",
            progresso: "progress",
            prioridade: "priority",
        };
        return aliases[label] || "";
    }

    function findHeader(key) {
        return Array.from(head.children).find(
            (th) => originalHeaderKey(th) === key
        ) || null;
    }

    function createAddonHeader(key, label) {
        const th = document.createElement("th");
        th.className = "projetos-enhancement-column";
        th.dataset.enhancementColumn = key;
        th.setAttribute("aria-label", label);

        const span = document.createElement("span");
        span.className = "projetos-enhancement-column__label";
        span.textContent = label;
        th.appendChild(span);

        return th;
    }

    function insertAfter(reference, node) {
        if (!reference || !reference.parentNode) return;
        reference.parentNode.insertBefore(node, reference.nextSibling);
    }

    function ensureAddonHeaders() {
        const projectHeader = findHeader("project");
        const periodHeader = findHeader("period");

        let codeHeader = head.querySelector('[data-enhancement-column="code"]');
        if (projectHeader && !codeHeader) {
            codeHeader = createAddonHeader("code", "Código");
            insertAfter(projectHeader, codeHeader);
        } else if (!projectHeader && codeHeader) {
            codeHeader.remove();
        }

        let goLiveHeader = head.querySelector('[data-enhancement-column="golive"]');
        if (periodHeader && !goLiveHeader) {
            goLiveHeader = createAddonHeader("golive", "Go Live");
            insertAfter(periodHeader, goLiveHeader);
        } else if (!periodHeader && goLiveHeader) {
            goLiveHeader.remove();
        }
    }

    function findCell(row, key) {
        const direct = row.querySelector(`[data-column="${key}"]`);
        if (direct) return direct;

        const originalHeaders = Array.from(head.children).filter(
            (th) => !th.dataset.enhancementColumn
        );
        const index = originalHeaders.findIndex(
            (th) => originalHeaderKey(th) === key
        );

        if (index < 0) return null;

        const originalCells = Array.from(row.children).filter(
            (td) => !td.dataset.enhancementCell
        );

        return originalCells[index] || null;
    }

    function findProjectData(row) {
        const id = Number(row.dataset.projectId || 0);
        return id ? (projectBootstrap.get(id) || null) : null;
    }

    function deriveCode(row) {
        const projectCell = findCell(row, "project");
        const project = findProjectData(row);

        return (
            text(projectCell?.querySelector("small"))
            || escapeText(project?.codigo)
            || "—"
        );
    }

    function hideCodeInsideProject(row) {
        const projectCell = findCell(row, "project");
        const small = projectCell?.querySelector("small");
        if (!small) return;
        small.classList.add("projetos-project-code-moved");
        small.setAttribute("aria-hidden", "true");
    }

    function deriveGoLive(row) {
        const project = findProjectData(row);

        const explicit = (
            project?.data_golive
            || project?.data_go_live
            || project?.golive
            || project?.data_entrega
            || project?.data_fim_prevista
            || ""
        );

        if (explicit) return formatDate(explicit);

        const period = text(findCell(row, "period"));
        if (period.includes("→")) {
            return period.split("→").pop().trim() || "—";
        }

        return "—";
    }

    function ensureAddonCell(row, key, afterKey, value) {
        const reference = findCell(row, afterKey);
        if (!reference) {
            row.querySelector(`[data-enhancement-cell="${key}"]`)?.remove();
            return;
        }

        let cell = row.querySelector(`[data-enhancement-cell="${key}"]`);
        if (!cell) {
            cell = document.createElement("td");
            cell.dataset.enhancementCell = key;
            cell.className = `projetos-enhancement-cell projetos-enhancement-cell--${key}`;
            insertAfter(reference, cell);
        }

        cell.textContent = value || "—";
        cell.title = value || "—";
    }

    function statusKeyFromText(value) {
        const key = normalize(value);
        const aliases = {
            em_execucao: "em_andamento",
            em_andamento: "em_andamento",
            homologacao: "homologacao",
            rascunho: "rascunho",
            planejado: "planejado",
            aguardando: "aguardando",
            encerramento: "encerramento",
            encerrado: "encerramento",
            concluido: "concluido",
            cancelado: "cancelado",
        };
        return aliases[key] || key;
    }

    function enhanceStatusAndHealth(row) {
        const statusCell = findCell(row, "status");
        const healthCell = findCell(row, "health");

        const statusPill = statusCell?.querySelector(".projetos-pill");
        if (statusPill) {
            statusPill.classList.add("projetos-pill--status-enhanced");
            statusPill.dataset.statusEnhanced = statusKeyFromText(
                text(statusPill)
            );
        }

        const healthPill = healthCell?.querySelector(".projetos-pill");
        if (healthPill) {
            healthPill.classList.add("projetos-pill--health-enhanced");

            if (!healthPill.dataset.situacao) {
                healthPill.dataset.situacao = normalize(text(healthPill));
            }
        }
    }

    function cellValue(row, key) {
        if (key === "code") {
            return text(row.querySelector('[data-enhancement-cell="code"]'));
        }

        if (key === "golive") {
            return text(row.querySelector('[data-enhancement-cell="golive"]'));
        }

        const cell = findCell(row, key);
        return text(cell) || "—";
    }

    function applyRowTooltip(row) {
        const projectCell = findCell(row, "project");
        const projectName = text(projectCell?.querySelector("strong"))
            || text(projectCell)
            || "—";

        const summary = [
            `Projeto: ${projectName}`,
            `Código: ${cellValue(row, "code")}`,
            `Cliente: ${cellValue(row, "client")}`,
            `Owner: ${cellValue(row, "owner")}`,
            `Status: ${cellValue(row, "status")}`,
            `Saúde: ${cellValue(row, "health")}`,
            `Go Live: ${cellValue(row, "golive")}`,
            `Progresso: ${cellValue(row, "progress")}`,
        ].join(" • ");

        row.title = summary;
        row.dataset.projectSummary = summary;
    }

    function applyNoWrapTitles(row) {
        [
            "project",
            "type",
            "reference",
            "client",
            "company",
            "owner",
            "stakeholder",
            "responsible",
            "group",
            "period",
            "status",
            "health",
            "progress",
            "priority",
        ].forEach((key) => {
            const cell = findCell(row, key);
            if (!cell) return;
            cell.classList.add("projetos-table-cell-nowrap");

            const value = text(cell);
            if (value && !cell.title) cell.title = value;
        });
    }

    function enhanceRow(row) {
        if (!row || row.nodeType !== 1) return;

        hideCodeInsideProject(row);
        ensureAddonCell(row, "code", "project", deriveCode(row));
        ensureAddonCell(row, "golive", "period", deriveGoLive(row));

        applyNoWrapTitles(row);
        enhanceStatusAndHealth(row);
        applyRowTooltip(row);
    }

    function columnSelector(key) {
        if (key === "code" || key === "golive") {
            return {
                header: `[data-enhancement-column="${key}"]`,
                cell: `[data-enhancement-cell="${key}"]`,
            };
        }

        return {
            header: `[data-list-column="${key}"]`,
            cell: `[data-column="${key}"]`,
        };
    }

    function applyWidth(key, width) {
        const safe = Math.max(90, Math.round(Number(width) || 0));
        if (!safe) return;

        columnWidths[key] = safe;
        const selector = columnSelector(key);

        table.querySelectorAll(selector.header).forEach((cell) => {
            cell.style.width = `${safe}px`;
            cell.style.minWidth = `${safe}px`;
            cell.style.maxWidth = `${safe}px`;
        });

        table.querySelectorAll(selector.cell).forEach((cell) => {
            cell.style.width = `${safe}px`;
            cell.style.minWidth = `${safe}px`;
            cell.style.maxWidth = `${safe}px`;
        });
    }

    function restoreWidths() {
        Object.entries(columnWidths).forEach(([key, width]) => {
            applyWidth(key, width);
        });
    }

    function bindResize(th) {
        if (!th || th.querySelector(":scope > .projetos-enhancement-resizer")) {
            return;
        }

        const key = originalHeaderKey(th);
        if (!key) return;

        const handle = document.createElement("span");
        handle.className = "projetos-enhancement-resizer";
        handle.dataset.resizeColumn = key;
        handle.setAttribute("aria-hidden", "true");
        handle.draggable = false;

        handle.addEventListener("mousedown", (event) => {
            event.preventDefault();
            event.stopPropagation();

            const startX = event.clientX;
            const startWidth = th.getBoundingClientRect().width;

            const move = (moveEvent) => {
                applyWidth(
                    key,
                    startWidth + (moveEvent.clientX - startX)
                );
            };

            const up = () => {
                document.removeEventListener("mousemove", move);
                document.removeEventListener("mouseup", up);
                document.body.classList.remove(
                    "is-resizing-projetos-table"
                );
                saveWidths();
            };

            document.body.classList.add("is-resizing-projetos-table");
            document.addEventListener("mousemove", move);
            document.addEventListener("mouseup", up);
        });

        handle.addEventListener("dragstart", (event) => {
            event.preventDefault();
            event.stopPropagation();
        });

        th.appendChild(handle);
    }

    function bindResizers() {
        Array.from(head.children).forEach(bindResize);
        restoreWidths();
    }

    function applyAll() {
        if (applying) return;
        applying = true;

        try {
            ensureAddonHeaders();

            Array.from(body.querySelectorAll("tr[data-project-id]"))
                .forEach(enhanceRow);

            bindResizers();
        } finally {
            applying = false;
        }
    }

    function scheduleApply() {
        if (scheduled) return;
        scheduled = true;

        window.requestAnimationFrame(() => {
            scheduled = false;
            applyAll();
        });
    }

    const observer = new MutationObserver(scheduleApply);

    observer.observe(head, {
        childList: true,
        subtree: true,
    });

    observer.observe(body, {
        childList: true,
        subtree: true,
    });

    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) scheduleApply();
    });

    window.addEventListener("load", scheduleApply);

    scheduleApply();
})();