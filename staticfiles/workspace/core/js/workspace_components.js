(function () {
    "use strict";

    const WorkspaceUI = window.WorkspaceUI = window.WorkspaceUI || {};
    const instances = new WeakMap();
    const openInstances = new Set();

    function text(value) {
        return String(value == null ? "" : value);
    }

    function normalized(value) {
        return text(value)
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLocaleLowerCase("pt-BR");
    }

    function selectedOptions(select) {
        return Array.from(select.options).filter((option) => option.selected && !option.disabled && option.value !== "");
    }

    function close(instance) {
        if (!instance || instance.menu.hidden) return;
        instance.menu.hidden = true;
        instance.root.classList.remove("is-open");
        instance.trigger.setAttribute("aria-expanded", "false");
        openInstances.delete(instance);
    }

    function closeOthers(except) {
        Array.from(openInstances).forEach((instance) => {
            if (instance !== except) close(instance);
        });
    }

    function alignMenu(instance) {
        instance.root.classList.remove("is-align-right");
        const rect = instance.root.getBoundingClientRect();
        const menuWidth = Math.max(rect.width, 250);
        if (rect.left + menuWidth > window.innerWidth - 12) {
            instance.root.classList.add("is-align-right");
        }
    }

    function updateSummary(instance) {
        const selected = selectedOptions(instance.select);
        const placeholder = instance.select.dataset.placeholder || "Todos";
        instance.root.classList.toggle("has-selection", selected.length > 0);

        if (!selected.length) {
            instance.summary.textContent = placeholder;
            instance.count.hidden = true;
            instance.count.textContent = "";
            return;
        }

        instance.summary.textContent = selected[0].textContent || selected[0].value;
        if (selected.length > 1) {
            instance.count.textContent = `+${selected.length - 1}`;
            instance.count.hidden = false;
        } else {
            instance.count.hidden = true;
            instance.count.textContent = "";
        }
    }

    function applyOptionSelection(instance, option, checked) {
        option.selected = Boolean(checked);
        updateSummary(instance);
        renderOptions(instance);
        instance.select.dispatchEvent(new Event("change", { bubbles: true }));
    }

    function renderOptions(instance) {
        const query = normalized(instance.search.value.trim());
        const options = Array.from(instance.select.options).filter((option) => option.value !== "" && !option.disabled);
        instance.options.innerHTML = "";

        let visible = 0;
        options.forEach((option) => {
            const labelText = option.textContent || option.value;
            if (query && !normalized(labelText).includes(query)) return;
            visible += 1;

            const row = document.createElement("label");
            row.className = "ws-multiselect__option";

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = option.selected;
            checkbox.tabIndex = 0;
            checkbox.addEventListener("change", () => applyOptionSelection(instance, option, checkbox.checked));

            const label = document.createElement("span");
            label.className = "ws-multiselect__option-label";
            label.textContent = labelText;

            row.appendChild(checkbox);
            row.appendChild(label);
            instance.options.appendChild(row);
        });

        if (!visible) {
            const empty = document.createElement("div");
            empty.className = "ws-multiselect__empty";
            empty.textContent = "Nenhuma opção encontrada.";
            instance.options.appendChild(empty);
        }
    }

    function refresh(select) {
        const instance = instances.get(select);
        if (!instance) return enhance(select);
        updateSummary(instance);
        renderOptions(instance);
        return instance;
    }

    function selectVisibleOptions(instance, checked) {
        const query = normalized(instance.search.value.trim());
        Array.from(instance.select.options).forEach((option) => {
            if (!option.value || option.disabled) return;
            const labelText = option.textContent || option.value;
            if (!query || normalized(labelText).includes(query)) option.selected = Boolean(checked);
        });
        updateSummary(instance);
        renderOptions(instance);
        instance.select.dispatchEvent(new Event("change", { bubbles: true }));
    }

    function enhance(select) {
        if (!(select instanceof HTMLSelectElement) || !select.multiple) return null;
        if (instances.has(select)) return instances.get(select);

        const root = document.createElement("div");
        root.className = "ws-multiselect";
        select.parentNode.insertBefore(root, select);
        root.appendChild(select);

        select.classList.add("ws-multiselect__native");
        select.hidden = true;

        const trigger = document.createElement("button");
        trigger.type = "button";
        trigger.className = "ws-multiselect__trigger";
        trigger.setAttribute("aria-haspopup", "listbox");
        trigger.setAttribute("aria-expanded", "false");

        const summary = document.createElement("span");
        summary.className = "ws-multiselect__summary";
        const count = document.createElement("small");
        count.className = "ws-multiselect__count";
        count.hidden = true;
        const chevron = document.createElement("i");
        chevron.className = "fa fa-chevron-down ws-multiselect__chevron";
        chevron.setAttribute("aria-hidden", "true");
        trigger.append(summary, count, chevron);

        const menu = document.createElement("div");
        menu.className = "ws-multiselect__menu";
        menu.hidden = true;

        const searchWrap = document.createElement("div");
        searchWrap.className = "ws-multiselect__search-wrap";
        const search = document.createElement("input");
        search.type = "search";
        search.className = "ws-multiselect__search";
        search.placeholder = "Buscar...";
        search.setAttribute("aria-label", "Buscar opções");
        searchWrap.append(search);

        const quickActions = document.createElement("div");
        quickActions.className = "ws-multiselect__quick-actions";
        const selectAll = document.createElement("button");
        selectAll.type = "button";
        selectAll.textContent = "Selecionar todos";
        const clear = document.createElement("button");
        clear.type = "button";
        clear.textContent = "Limpar";
        quickActions.append(selectAll, clear);

        const options = document.createElement("div");
        options.className = "ws-multiselect__options";
        options.setAttribute("role", "listbox");
        options.setAttribute("aria-multiselectable", "true");

        menu.append(searchWrap, quickActions, options);
        root.prepend(trigger, menu);

        const instance = { select, root, trigger, summary, count, menu, search, options };
        instances.set(select, instance);

        trigger.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            const willOpen = menu.hidden;
            closeOthers(instance);
            menu.hidden = !willOpen;
            root.classList.toggle("is-open", willOpen);
            trigger.setAttribute("aria-expanded", willOpen ? "true" : "false");
            if (willOpen) {
                openInstances.add(instance);
                alignMenu(instance);
                renderOptions(instance);
                window.requestAnimationFrame(() => search.focus({ preventScroll: true }));
            } else {
                openInstances.delete(instance);
            }
        });

        menu.addEventListener("click", (event) => event.stopPropagation());
        search.addEventListener("input", () => renderOptions(instance));
        selectAll.addEventListener("click", () => selectVisibleOptions(instance, true));
        clear.addEventListener("click", () => selectVisibleOptions(instance, false));
        select.addEventListener("change", () => {
            updateSummary(instance);
            renderOptions(instance);
        });

        const optionObserver = new MutationObserver(() => refresh(select));
        optionObserver.observe(select, { childList: true, subtree: true });

        updateSummary(instance);
        renderOptions(instance);
        return instance;
    }

    function init(root) {
        const scope = root && root.querySelectorAll ? root : document;
        scope.querySelectorAll("select[data-ws-multiselect][multiple]").forEach(enhance);
    }

    document.addEventListener("click", () => closeOthers(null));
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeOthers(null);
    });

    const boot = () => {
        init(document);
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (!(node instanceof Element)) return;
                    if (node.matches?.("select[data-ws-multiselect][multiple]")) enhance(node);
                    init(node);
                });
            });
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot, { once: true });
    } else {
        boot();
    }

    WorkspaceUI.enhanceMultiselect = enhance;
    WorkspaceUI.refreshMultiselect = refresh;
    WorkspaceUI.refreshMultiselects = init;
})();
