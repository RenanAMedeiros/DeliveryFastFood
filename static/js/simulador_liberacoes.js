(function () {
    "use strict";

    var form = document.getElementById("accessSimulatorForm");
    var search = document.getElementById("collaboratorSearch");
    var select = document.getElementById("collaboratorSelect");
    var feedback = document.getElementById("filterFeedback");
    var toggleDetails = document.getElementById("toggleDashboardDetails");

    function normalize(value) {
        return String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();
    }

    function filterCollaborators() {
        if (!search || !select) {
            return;
        }

        var term = normalize(search.value);
        var visible = 0;

        Array.prototype.forEach.call(select.options, function (option, index) {
            if (index === 0) {
                return;
            }

            var matches = !term || normalize(option.dataset.search).includes(term);
            option.hidden = !matches;
            option.disabled = !matches;

            if (matches) {
                visible += 1;
            }
        });

        if (select.selectedOptions.length && select.selectedOptions[0].disabled) {
            select.value = "";
        }

        if (feedback) {
            if (!term) {
                feedback.textContent = "";
            } else if (visible === 1) {
                feedback.textContent = "1 colaborador encontrado.";
            } else {
                feedback.textContent = visible + " colaboradores encontrados.";
            }
        }
    }

    if (search) {
        search.addEventListener("input", filterCollaborators);
    }

    if (form && select) {
        form.addEventListener("submit", function (event) {
            if (!select.value) {
                event.preventDefault();
                select.setCustomValidity("Selecione um colaborador para executar a simulação.");
                select.reportValidity();
                return;
            }

            select.setCustomValidity("");
        });

        select.addEventListener("change", function () {
            select.setCustomValidity("");
        });
    }

    if (toggleDetails) {
        toggleDetails.addEventListener("click", function () {
            var cards = document.querySelectorAll(".access-dashboard-card");
            var shouldOpen = toggleDetails.getAttribute("aria-pressed") !== "true";

            Array.prototype.forEach.call(cards, function (card) {
                card.open = shouldOpen;
            });

            toggleDetails.setAttribute("aria-pressed", String(shouldOpen));
            toggleDetails.querySelector("span").textContent = shouldOpen
                ? "Recolher detalhes"
                : "Expandir detalhes";
        });
    }

    var macroSearch = document.getElementById("macroBiSearch");
    var macroRole = document.getElementById("macroRoleFilter");
    var macroCategory = document.getElementById("macroCategoryFilter");
    var macroAssignment = document.getElementById("macroAssignmentFilter");
    var macroLink = document.getElementById("macroLinkFilter");
    var macroClear = document.getElementById("macroClearFilters");
    var macroCount = document.getElementById("macroResultCount");
    var macroNoResults = document.getElementById("macroNoResults");
    var macroInventory = document.getElementById("macroBiInventory");
    var macroCards = document.querySelectorAll(".macro-bi-card");

    function applyMacroFilters() {
        if (!macroCards.length) {
            return;
        }

        var term = normalize(macroSearch && macroSearch.value);
        var role = macroRole ? macroRole.value : "";
        var category = macroCategory ? macroCategory.value : "";
        var assignment = macroAssignment ? macroAssignment.value : "";
        var link = macroLink ? macroLink.value : "";
        var visible = 0;

        Array.prototype.forEach.call(macroCards, function (card) {
            var matchesSearch = !term || normalize(card.dataset.search).includes(term);
            var matchesRole = !role || card.dataset.roles.includes("|" + role + "|");
            var matchesCategory = !category || card.dataset.category === category;
            var matchesAssignment = !assignment || card.dataset.assignment === assignment;
            var matchesLink = !link || card.dataset.link === link;
            var show = matchesSearch
                && matchesRole
                && matchesCategory
                && matchesAssignment
                && matchesLink;

            card.hidden = !show;
            if (show) {
                visible += 1;
            }
        });

        if (macroCount) {
            macroCount.textContent = visible === 1
                ? "1 registro"
                : visible + " registros";
        }

        if (macroNoResults) {
            macroNoResults.hidden = visible !== 0;
        }
    }

    [macroSearch, macroRole, macroCategory, macroAssignment, macroLink]
        .filter(Boolean)
        .forEach(function (field) {
            field.addEventListener(
                field.tagName === "INPUT" ? "input" : "change",
                applyMacroFilters
            );
        });

    if (macroClear) {
        macroClear.addEventListener("click", function () {
            [macroSearch, macroRole, macroCategory, macroAssignment, macroLink]
                .filter(Boolean)
                .forEach(function (field) {
                    field.value = "";
                });
            applyMacroFilters();
            if (macroSearch) {
                macroSearch.focus();
            }
        });
    }

    document.querySelectorAll(".macro-dashboard-filter").forEach(function (button) {
        button.addEventListener("click", function () {
            if (!macroCategory) {
                return;
            }
            macroCategory.value = button.dataset.filterCategory || "";
            applyMacroFilters();
            macroInventory && macroInventory.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    });
})();
