(function () {
    "use strict";

    var dashboard =
        document.getElementById("capacityDashboard");

    if (!dashboard) {
        return;
    }

    var state = {
        rows: [],
        filteredRows: [],
        timeline: [],
        actualHeader: "Atual",
        charts: {},
        hierarchyOpen: false,
        hierarchyExpanded: false,
        tableExpanded: false,
        quickStatus: "",
        sort: {
            field: "balanceWithFat",
            direction: "asc"
        }
    };

    var elements = {
        refreshButton:
            document.getElementById("capacityRefreshButton"),

        importToggle:
            document.getElementById("capacityImportToggle"),

        importForm:
            document.getElementById("capacityImportForm"),

        sourceStatus:
            document.getElementById("capacitySourceStatus"),

        sourceStatusText:
            document.getElementById("capacitySourceStatusText"),

        loading:
            document.getElementById("capacityLoading"),

        alert:
            document.getElementById("capacityAlert"),

        alertTitle:
            document.getElementById("capacityAlertTitle"),

        alertText:
            document.getElementById("capacityAlertText"),

        clearFilters:
            document.getElementById("capacityClearFilters"),

        filterCompetence:
            document.getElementById("capacityFilterCompetence"),

        filterSupervisor:
            document.getElementById("capacityFilterSupervisor"),

        filterManager:
            document.getElementById("capacityFilterManager"),

        filterLeader:
            document.getElementById("capacityFilterLeader"),

        filterMode:
            document.getElementById("capacityFilterMode"),

        filterPortfolio:
            document.getElementById("capacityFilterPortfolio"),

        filterStatus:
            document.getElementById("capacityFilterStatus"),

        actualLabel:
            document.getElementById("capacityKpiActualLabel"),

        actualColumnTitle:
            document.getElementById("capacityActualColumnTitle"),

        kpiBudget:
            document.getElementById("capacityKpiBudget"),

        kpiActual:
            document.getElementById("capacityKpiActual"),

        kpiBalance:
            document.getElementById("capacityKpiBalance"),

        kpiBalanceWithFat:
            document.getElementById("capacityKpiBalanceWithFat"),

        kpiUtilization:
            document.getElementById("capacityKpiUtilization"),

        kpiAttention:
            document.getElementById("capacityKpiAttention"),

        kpiCritical:
            document.getElementById("capacityKpiCritical"),

        kpiBalanced:
            document.getElementById("capacityKpiBalanced"),

        kpiAvailable:
            document.getElementById("capacityKpiAvailable"),

        criticalCards:
            document.getElementById("capacityCriticalCards"),

        insights:
            document.getElementById("capacityInsights"),

        hierarchy:
            document.getElementById("capacityHierarchy"),

        expandHierarchy:
            document.getElementById("capacityExpandHierarchy"),

        hierarchyPanel:
            document.getElementById("capacityHierarchyPanel"),

        hierarchyExpandButton:
            document.getElementById("capacityHierarchyExpandButton"),

        tablePanel:
            document.getElementById("capacityTablePanel"),

        tableExpandButton:
            document.getElementById("capacityTableExpandButton"),

        tableBody:
            document.getElementById("capacityTableBody"),

        tableCounter:
            document.getElementById("capacityTableCounter"),

        kpiCards:
            Array.from(document.querySelectorAll("[data-capacity-kpi]")),

        healthCards:
            Array.from(document.querySelectorAll("[data-capacity-health]")),

        decisionPanel:
            document.getElementById("capacityDecisionPanel"),

        decisionTitle:
            document.getElementById("capacityDecisionTitle"),

        decisionText:
            document.getElementById("capacityDecisionText"),

        decisionMetrics:
            document.getElementById("capacityDecisionMetrics"),

        decisionRecommendation:
            document.getElementById("capacityDecisionRecommendation"),

        decisionClose:
            document.getElementById("capacityDecisionClose"),

        sortButtons:
            Array.from(
                document.querySelectorAll(
                    "[data-sort]"
                )
            )
    };

    var chartColors = {
        blue: "#2563eb",
        cyan: "#38bdf8",
        green: "#12b76a",
        amber: "#f79009",
        red: "#d92d20",
        purple: "#7a5af8",
        navy: "#102757",
        gray: "#98a2b3"
    };

    function normalizeText(value) {
        return String(value == null ? "" : value)
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[\r\n\t]+/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();
    }

    function cleanText(value) {
        return String(value == null ? "" : value)
            .replace(/[\r\n\t]+/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function toNumber(value) {
        if (typeof value === "number" && Number.isFinite(value)) {
            return value;
        }

        var text =
            String(value == null ? "" : value)
                .trim()
                .replace(/\s/g, "");

        if (!text) {
            return 0;
        }

        if (
            text.indexOf(",") !== -1 &&
            text.indexOf(".") !== -1
        ) {
            text =
                text.replace(/\./g, "")
                    .replace(",", ".");
        } else if (text.indexOf(",") !== -1) {
            text = text.replace(",", ".");
        }

        text = text.replace(/[^\d.-]/g, "");

        var parsed = Number(text);

        return Number.isFinite(parsed)
            ? parsed
            : 0;
    }

    function formatNumber(value, digits) {
        return Number(value || 0).toLocaleString(
            "pt-BR",
            {
                minimumFractionDigits: digits || 0,
                maximumFractionDigits: digits || 0
            }
        );
    }

    function formatPercent(value) {
        return Number(value || 0).toLocaleString(
            "pt-BR",
            {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1
            }
        ) + "%";
    }

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function sum(rows, field) {
        return rows.reduce(
            function (total, row) {
                return total + Number(row[field] || 0);
            },
            0
        );
    }

    function uniqueSorted(rows, field) {
        return Array.from(
            new Set(
                rows
                    .map(function (row) {
                        return cleanText(row[field]);
                    })
                    .filter(Boolean)
            )
        ).sort(function (a, b) {
            return a.localeCompare(
                b,
                "pt-BR",
                {
                    sensitivity: "base"
                }
            );
        });
    }

    function groupBy(rows, field) {
        return rows.reduce(
            function (groups, row) {
                var key =
                    cleanText(row[field]) ||
                    "Não informado";

                if (!groups[key]) {
                    groups[key] = [];
                }

                groups[key].push(row);

                return groups;
            },
            {}
        );
    }

    function aggregateRows(rows) {
        var budget = sum(rows, "budget");
        var fat = sum(rows, "fat");
        var actual = sum(rows, "actual");
        var balance = budget - actual;
        var balanceWithFat =
            budget + fat - actual;

        return {
            budget: budget,
            fat: fat,
            actual: actual,
            balance: balance,
            balanceWithFat: balanceWithFat,
            utilization:
                budget > 0
                    ? actual / budget * 100
                    : 0
        };
    }

    function getStatus(row) {
        var utilization =
            row.budget > 0
                ? row.actual / row.budget * 100
                : 0;

        if (row.balanceWithFat < 0) {
            return {
                key: "critical",
                label: "Acima da capacidade"
            };
        }

        if (
            utilization >= 95 ||
            row.balanceWithFat <= 2
        ) {
            return {
                key: "attention",
                label: "Atenção"
            };
        }

        if (
            utilization < 85 &&
            row.balanceWithFat > 2
        ) {
            return {
                key: "available",
                label: "Capacidade disponível"
            };
        }

        return {
            key: "balanced",
            label: "Equilibrada"
        };
    }

    function detectHeaderRow(matrix) {
        var bestIndex = 0;
        var bestScore = -1;

        matrix
            .slice(0, 20)
            .forEach(function (row, index) {
                var normalized =
                    row.map(normalizeText);

                var score = 0;

                [
                    "sup",
                    "gerente",
                    "gestor",
                    "carteira",
                    "budget",
                    "gordura",
                    "saldo"
                ].forEach(function (term) {
                    if (
                        normalized.some(
                            function (cell) {
                                return cell.indexOf(term) !== -1;
                            }
                        )
                    ) {
                        score += 1;
                    }
                });

                if (score > bestScore) {
                    bestScore = score;
                    bestIndex = index;
                }
            });

        return bestIndex;
    }

    function findColumn(headers, test) {
        for (
            var index = 0;
            index < headers.length;
            index += 1
        ) {
            if (test(headers[index], index)) {
                return index;
            }
        }

        return -1;
    }

    function mapColumns(rawHeaders) {
        var headers =
            rawHeaders.map(function (value) {
                return normalizeText(value);
            });

        var supervisorIndex =
            findColumn(
                headers,
                function (header) {
                    return (
                        header.indexOf("sup.oper") !== -1 ||
                        header.indexOf("sup oper") !== -1 ||
                        header.indexOf("supervis") !== -1
                    );
                }
            );

        var managerIndex =
            findColumn(
                headers,
                function (header) {
                    return header.indexOf("gerente") !== -1;
                }
            );

        var leaderIndex =
            findColumn(
                headers,
                function (header) {
                    return header.indexOf("gestor") !== -1;
                }
            );

        var portfolioIndex =
            findColumn(
                headers,
                function (header) {
                    return header.indexOf("carteira") !== -1;
                }
            );

        var budgetIndex =
            findColumn(
                headers,
                function (header) {
                    return (
                        header.indexOf("budget") !== -1 &&
                        header.indexOf("saldo") === -1
                    );
                }
            );

        var fatIndex =
            findColumn(
                headers,
                function (header) {
                    return (
                        header.indexOf("gordura") !== -1 &&
                        header.indexOf("saldo") === -1
                    );
                }
            );

        var balanceWithFatIndex =
            findColumn(
                headers,
                function (header) {
                    return (
                        header.indexOf("saldo") !== -1 &&
                        header.indexOf("gordura") !== -1
                    );
                }
            );

        var balanceIndex =
            findColumn(
                headers,
                function (header) {
                    return (
                        header.indexOf("saldo") !== -1 &&
                        header.indexOf("gordura") === -1
                    );
                }
            );

        /*
         * Prioriza explicitamente a coluna Modalidade.
         * O fallback para a coluna vazia anterior à Carteira é usado
         * somente para versões antigas da planilha.
         */
        var modeIndex =
            findColumn(
                headers,
                function (header) {
                    return (
                        header.indexOf("modalidade") !== -1 ||
                        header.indexOf("segmento") !== -1 ||
                        header === "tipo"
                    );
                }
            );

        if (
            modeIndex === -1 &&
            portfolioIndex > 0 &&
            !cleanText(rawHeaders[portfolioIndex - 1])
        ) {
            modeIndex = portfolioIndex - 1;
        }

        var actualIndex = -1;

        if (
            fatIndex !== -1 &&
            balanceIndex !== -1
        ) {
            for (
                var index = fatIndex + 1;
                index < balanceIndex;
                index += 1
            ) {
                if (
                    index !== balanceWithFatIndex &&
                    headers[index].indexOf("saldo") === -1
                ) {
                    actualIndex = index;
                    break;
                }
            }
        }

        if (actualIndex === -1) {
            actualIndex =
                findColumn(
                    headers,
                    function (header) {
                        return (
                            /^\d{1,2}[\/-][a-z]{3}/i.test(
                                cleanText(header)
                            ) ||
                            header.indexOf("atual") !== -1 ||
                            header.indexOf("realizado") !== -1
                        );
                    }
                );
        }

        return {
            supervisor: supervisorIndex,
            manager: managerIndex,
            leader: leaderIndex,
            mode: modeIndex,
            portfolio: portfolioIndex,
            budget: budgetIndex,
            fat: fatIndex,
            actual: actualIndex,
            balance: balanceIndex,
            balanceWithFat: balanceWithFatIndex
        };
    }

    function validateColumns(columns) {
        var required = [
            "portfolio",
            "budget",
            "actual"
        ];

        var missing =
            required.filter(function (field) {
                return columns[field] === -1;
            });

        if (missing.length) {
            throw new Error(
                "Não foi possível identificar as colunas " +
                "Carteira, Budget e posição atual. " +
                "Revise o cabeçalho da primeira aba do Excel."
            );
        }
    }

    function buildRows(matrix, headerIndex) {
        var rawHeaders =
            matrix[headerIndex] || [];

        var columns =
            mapColumns(rawHeaders);

        validateColumns(columns);

        state.actualHeader =
            cleanText(rawHeaders[columns.actual]) ||
            "Atual";

        return matrix
            .slice(headerIndex + 1)
            .map(function (sourceRow) {
                var portfolio =
                    cleanText(sourceRow[columns.portfolio]);

                if (!portfolio) {
                    return null;
                }

                if (
                    normalizeText(portfolio)
                        .indexOf("total") === 0
                ) {
                    return null;
                }

                var supervisor =
                    columns.supervisor !== -1
                        ? cleanText(
                            sourceRow[columns.supervisor]
                        )
                        : "";

                var manager =
                    columns.manager !== -1
                        ? cleanText(
                            sourceRow[columns.manager]
                        )
                        : "";

                var leader =
                    columns.leader !== -1
                        ? cleanText(
                            sourceRow[columns.leader]
                        )
                        : "";

                var mode =
                    columns.mode !== -1
                        ? cleanText(
                            sourceRow[columns.mode]
                        )
                        : "";

                var area =
                    normalizeText(supervisor) === "cesar"
                        ? "Jurídico"
                        : "Operação";

                /*
                 * César representa toda a estrutura jurídica.
                 * Caso a modalidade esteja vazia nessa estrutura,
                 * ela é identificada como Jurídico.
                 */
                if (!mode && area === "Jurídico") {
                    mode = "Jurídico";
                }

                var budget =
                    toNumber(sourceRow[columns.budget]);

                var fat =
                    columns.fat !== -1
                        ? toNumber(sourceRow[columns.fat])
                        : 0;

                var actual =
                    toNumber(sourceRow[columns.actual]);

                var balance =
                    budget - actual;

                var balanceWithFat =
                    budget + fat - actual;

                var row = {
                    supervisor: supervisor,
                    manager: manager,
                    leader: leader,
                    mode: mode,
                    area: area,
                    portfolio: portfolio,
                    budget: budget,
                    fat: fat,
                    actual: actual,
                    balance: balance,
                    balanceWithFat: balanceWithFat,
                    utilization:
                        budget > 0
                            ? actual / budget * 100
                            : 0
                };

                row.status = getStatus(row);

                return row;
            })
            .filter(Boolean);
    }

    function buildApiRows(rows) {
        return (rows || []).map(function (sourceRow) {
            var row = {
                id: sourceRow.id,
                supervisor: cleanText(sourceRow.supervisor),
                manager: cleanText(sourceRow.manager),
                leader: cleanText(sourceRow.leader),
                mode: cleanText(sourceRow.mode),
                area: cleanText(sourceRow.area) || "Operação",
                portfolio: cleanText(sourceRow.portfolio),
                budget: toNumber(sourceRow.budget),
                fat: toNumber(sourceRow.fat),
                actual: toNumber(sourceRow.actual),
                balance: toNumber(sourceRow.balance),
                balanceWithFat: toNumber(sourceRow.balanceWithFat)
            };

            row.utilization = row.budget > 0
                ? row.actual / row.budget * 100
                : 0;
            row.status = getStatus(row);
            return row;
        });
    }

    function buildTimeline(items) {
        return (items || []).map(function (item) {
            return {
                competence: item.competencia,
                label: item.label,
                budget: toNumber(item.budget),
                fat: toNumber(item.fat),
                actual: toNumber(item.actual),
                balance: toNumber(item.balance),
                balanceWithFat: toNumber(item.balanceWithFat)
            };
        });
    }

    function setLoading(isLoading) {
        elements.loading.hidden = !isLoading;

        elements.refreshButton.classList.toggle(
            "is-loading",
            isLoading
        );

        elements.refreshButton.disabled =
            isLoading;
    }

    function showAlert(title, message, type) {
        elements.alertTitle.textContent = title;
        elements.alertText.textContent = message;
        elements.alert.classList.toggle("is-success", type === "success");
        elements.alert.hidden = false;
    }

    function hideAlert() {
        elements.alert.hidden = true;
    }

    function updateSourceStatus(type, text) {
        elements.sourceStatus.classList.remove(
            "is-ready",
            "is-error"
        );

        if (type) {
            elements.sourceStatus.classList.add(
                "is-" + type
            );
        }

        elements.sourceStatusText.textContent = text;
    }

    function populateSelect(select, values) {
        var currentValue = select.value;

        while (select.options.length > 1) {
            select.remove(1);
        }

        values.forEach(function (value) {
            var option =
                document.createElement("option");

            option.value = value;
            option.textContent = value;

            select.appendChild(option);
        });

        if (
            values.indexOf(currentValue) !== -1
        ) {
            select.value = currentValue;
        }
    }

    function populateFilters() {
        populateSelect(
            elements.filterSupervisor,
            uniqueSorted(state.rows, "supervisor")
        );

        populateSelect(
            elements.filterManager,
            uniqueSorted(state.rows, "manager")
        );

        populateSelect(
            elements.filterLeader,
            uniqueSorted(state.rows, "leader")
        );

        populateSelect(
            elements.filterMode,
            uniqueSorted(state.rows, "mode")
        );

        populateSelect(
            elements.filterPortfolio,
            uniqueSorted(state.rows, "portfolio")
        );
    }

    function populateCompetences(competences, selected) {
        elements.filterCompetence.innerHTML = "";

        (competences || []).forEach(function (competence) {
            var option = document.createElement("option");
            option.value = competence.value;
            option.textContent = competence.label;
            elements.filterCompetence.appendChild(option);
        });

        if (
            selected &&
            !Array.from(elements.filterCompetence.options).some(
                function (option) {
                    return option.value === selected;
                }
            )
        ) {
            var emptyOption = document.createElement("option");
            emptyOption.value = selected;
            emptyOption.textContent = selected.slice(5, 7) + "/" + selected.slice(0, 4);
            elements.filterCompetence.appendChild(emptyOption);
        }

        elements.filterCompetence.value = selected || "";
        elements.filterCompetence.disabled = !elements.filterCompetence.options.length;
    }

    function applyFilters() {
        var filters = {
            supervisor:
                elements.filterSupervisor.value,

            manager:
                elements.filterManager.value,

            leader:
                elements.filterLeader.value,

            mode:
                elements.filterMode.value,

            portfolio:
                elements.filterPortfolio.value,

            status:
                state.quickStatus || elements.filterStatus.value
        };

        state.filteredRows =
            state.rows.filter(function (row) {
                var matchesStatus =
                    !filters.status ||
                    (
                        filters.status === "risk"
                            ? (
                                row.status.key === "attention" ||
                                row.status.key === "critical"
                            )
                            : row.status.key === filters.status
                    );

                return (
                    (!filters.supervisor ||
                        row.supervisor === filters.supervisor) &&

                    (!filters.manager ||
                        row.manager === filters.manager) &&

                    (!filters.leader ||
                        row.leader === filters.leader) &&

                    (!filters.mode ||
                        row.mode === filters.mode) &&

                    (!filters.portfolio ||
                        row.portfolio === filters.portfolio) &&

                    matchesStatus
                );
            });

        renderAll();
        updateHealthActiveState();
    }

    function getDecisionMetrics(rows) {
        var totals = aggregateRows(rows);
        var criticalRows = rows.filter(function (row) {
            return row.status.key === "critical";
        });
        var attentionRows = rows.filter(function (row) {
            return row.status.key === "attention";
        });
        var availableRows = rows.filter(function (row) {
            return row.status.key === "available";
        });
        var margin = sum(rows, "fat");
        var criticalDeficit = criticalRows.reduce(function (total, row) {
            return total + Math.max(0, -row.balanceWithFat);
        }, 0);
        var availablePool = availableRows.reduce(function (total, row) {
            return total + Math.max(0, row.balanceWithFat);
        }, 0);
        var overApproved = rows.reduce(function (total, row) {
            return total + Math.max(0, row.actual - row.budget);
        }, 0);
        var supervisorGroups = groupBy(rows, "supervisor");
        var supervisorRanking = Object.keys(supervisorGroups).map(function (name) {
            var metrics = aggregateRows(supervisorGroups[name]);
            return {
                name: name,
                actual: metrics.actual,
                utilization: metrics.utilization,
                balanceWithFat: metrics.balanceWithFat
            };
        }).sort(function (a, b) {
            return b.utilization - a.utilization;
        });

        return {
            totals: totals,
            margin: margin,
            criticalRows: criticalRows,
            attentionRows: attentionRows,
            availableRows: availableRows,
            criticalDeficit: criticalDeficit,
            availablePool: availablePool,
            overApproved: overApproved,
            topSupervisor: supervisorRanking.length ? supervisorRanking[0] : null
        };
    }

    function setKpiTooltip(key, html) {
        var tooltip = document.querySelector('[data-kpi-tooltip="' + key + '"]');
        if (tooltip) {
            tooltip.innerHTML = html;
        }
    }

    function decisionMetricHtml(label, value, tone) {
        return (
            '<div class="capacity-decision-metric ' + escapeHtml(tone || "") + '">' +
                '<span>' + escapeHtml(label) + '</span>' +
                '<strong>' + escapeHtml(value) + '</strong>' +
            '</div>'
        );
    }

    function renderDecisionAnalysis(type) {
        if (!elements.decisionPanel) {
            return;
        }

        var metrics = getDecisionMetrics(state.filteredRows);
        var totals = metrics.totals;
        var gapToFull = Math.max(0, 100 - totals.utilization);
        var title = "Análise operacional";
        var text = "";
        var recommendation = "";
        var cards = [];

        if (type === "budget") {
            title = "Leitura do Budget aprovado";
            text = "O budget aprovado representa a capacidade planejada da seleção atual. A leitura mais importante é verificar se a folga global está bem distribuída entre as carteiras.";
            cards = [
                decisionMetricHtml("Budget aprovado", formatNumber(totals.budget)),
                decisionMetricHtml("Budget atual", formatNumber(totals.actual)),
                decisionMetricHtml("Utilização", formatPercent(totals.utilization)),
                decisionMetricHtml("Carteiras críticas", formatNumber(metrics.criticalRows.length), metrics.criticalRows.length ? "is-danger" : "is-success")
            ];
            recommendation = metrics.criticalRows.length && totals.balance > 0
                ? "Há saldo no consolidado, mas existem carteiras críticas. Antes de ampliar o budget total, avalie redistribuição interna entre estruturas com folga e estruturas pressionadas."
                : (totals.balance <= 0
                    ? "A capacidade global já atingiu ou superou o aprovado. Priorize revisão de dimensionamento e validação de necessidade de aumento de budget."
                    : "O consolidado ainda possui folga. Monitore concentração por supervisão para evitar que o saldo global esconda déficits locais.");
        } else if (type === "actual") {
            title = "Leitura do Budget atual";
            text = "A posição atual mostra quanto da capacidade aprovada já está ocupada e onde o consumo está concentrado.";
            cards = [
                decisionMetricHtml("Posição atual", formatNumber(totals.actual)),
                decisionMetricHtml("% do aprovado", formatPercent(totals.utilization)),
                decisionMetricHtml("Saldo restante", formatNumber(totals.balance), totals.balance < 0 ? "is-danger" : "is-success"),
                decisionMetricHtml("Em risco", formatNumber(metrics.attentionRows.length + metrics.criticalRows.length), metrics.criticalRows.length ? "is-warning" : "")
            ];
            recommendation = metrics.topSupervisor
                ? "A supervisão com maior utilização é " + metrics.topSupervisor.name + " (" + formatPercent(metrics.topSupervisor.utilization) + "). Use o gráfico por supervisão para validar se o crescimento está concentrado e se há espaço para rebalanceamento."
                : "Compare a utilização entre supervisões e carteiras antes de aprovar novas alocações.";
        } else if (type === "balance") {
            title = "Leitura do Saldo disponível";
            text = "Saldo positivo no consolidado não significa que todas as operações possuem espaço. O principal diagnóstico é comparar a folga disponível com o déficit das carteiras críticas.";
            cards = [
                decisionMetricHtml("Saldo global", formatNumber(totals.balance), totals.balance < 0 ? "is-danger" : "is-success"),
                decisionMetricHtml("Folga redistribuível", formatNumber(metrics.availablePool), "is-success"),
                decisionMetricHtml("Déficit crítico", formatNumber(metrics.criticalDeficit), metrics.criticalDeficit ? "is-danger" : "is-success"),
                decisionMetricHtml("Carteiras com folga", formatNumber(metrics.availableRows.length))
            ];
            recommendation = metrics.criticalDeficit > 0 && metrics.availablePool >= metrics.criticalDeficit
                ? "Existe folga suficiente nas carteiras disponíveis para cobrir o déficit crítico em termos consolidados. Avalie viabilidade operacional de redistribuição antes de solicitar aumento de capacity."
                : (metrics.criticalDeficit > 0
                    ? "A folga mapeada não cobre integralmente o déficit crítico. Avalie redistribuição possível e, para o residual, revisão de budget ou dimensionamento."
                    : "Não há déficit crítico na seleção. Use o saldo para antecipar crescimento e evitar concentração de capacidade ociosa.");
        } else if (type === "margin") {
            title = "O que é a Margem operacional?";
            text = "Margem operacional é a reserva adicional cadastrada para absorver oscilações de capacidade. O cálculo exibido é: Budget aprovado + Margem operacional − Budget atual.";
            cards = [
                decisionMetricHtml("Margem cadastrada", formatNumber(metrics.margin)),
                decisionMetricHtml("Acima do aprovado", formatNumber(metrics.overApproved), metrics.overApproved ? "is-warning" : ""),
                decisionMetricHtml("Saldo com margem", formatNumber(totals.balanceWithFat), totals.balanceWithFat < 0 ? "is-danger" : "is-success"),
                decisionMetricHtml("Críticas mesmo com margem", formatNumber(metrics.criticalRows.length), metrics.criticalRows.length ? "is-danger" : "is-success")
            ];
            recommendation = metrics.criticalRows.length
                ? "Existem carteiras que já consumiram o budget e a margem operacional. Essas carteiras devem ser priorizadas na revisão de alocação ou no redimensionamento."
                : "A margem ainda absorve as oscilações da seleção atual. Evite tratá-la como capacidade permanente: use-a como tolerância e acompanhe consumo recorrente acima do budget aprovado.";
        } else {
            title = "Leitura da Utilização geral";
            text = "A utilização mostra o percentual do budget aprovado já ocupado. Quanto mais próxima de 100%, menor a capacidade de absorver crescimento sem redistribuição ou revisão de dimensionamento.";
            cards = [
                decisionMetricHtml("Utilização", formatPercent(totals.utilization), totals.utilization >= 95 ? "is-warning" : ""),
                decisionMetricHtml("Até 100%", formatPercent(gapToFull)),
                decisionMetricHtml("Requerem atenção", formatNumber(metrics.attentionRows.length + metrics.criticalRows.length), metrics.criticalRows.length ? "is-warning" : ""),
                decisionMetricHtml("Acima da capacidade", formatNumber(metrics.criticalRows.length), metrics.criticalRows.length ? "is-danger" : "is-success")
            ];
            recommendation = totals.utilization >= 95
                ? "A utilização consolidada está em faixa de atenção. Priorize as carteiras críticas e valide redistribuição antes de novas entradas ou expansão de operação."
                : (metrics.criticalRows.length
                    ? "A utilização global ainda possui folga, mas existem déficits locais. O risco está na distribuição, não necessariamente no volume total de budget."
                    : "A utilização permanece administrável. Acompanhe tendência mensal e supervisões que se aproximam de 95% para agir antes da saturação.");
        }

        elements.decisionTitle.textContent = title;
        elements.decisionText.textContent = text;
        elements.decisionMetrics.innerHTML = cards.join("");
        elements.decisionRecommendation.textContent = recommendation;
        elements.decisionPanel.hidden = false;
        elements.decisionPanel.scrollIntoView({behavior: "smooth", block: "nearest"});
    }

    function updateHealthActiveState() {
        elements.healthCards.forEach(function (card) {
            var key = card.getAttribute("data-capacity-health");
            card.classList.toggle("is-active", Boolean(state.quickStatus) && key === state.quickStatus);
        });
    }

    function focusHealthStatus(status) {
        state.quickStatus = status;
        elements.filterStatus.value = status === "risk" ? "" : status;
        applyFilters();
        if (elements.tablePanel) {
            elements.tablePanel.scrollIntoView({behavior: "smooth", block: "start"});
        }
    }

    function renderKpis() {
        var totals =
            aggregateRows(state.filteredRows);

        var attention =
            state.filteredRows.filter(function (row) {
                return (
                    row.status.key === "attention" ||
                    row.status.key === "critical"
                );
            }).length;

        var critical =
            state.filteredRows.filter(function (row) {
                return row.status.key === "critical";
            }).length;

        var balanced =
            state.filteredRows.filter(function (row) {
                return row.status.key === "balanced";
            }).length;

        var available =
            state.filteredRows.filter(function (row) {
                return row.status.key === "available";
            }).length;

        elements.kpiBudget.textContent =
            formatNumber(totals.budget);

        elements.kpiActual.textContent =
            formatNumber(totals.actual);

        elements.kpiBalance.textContent =
            formatNumber(totals.balance);

        elements.kpiBalance.classList.toggle(
            "capacity-negative",
            totals.balance < 0
        );

        elements.kpiBalance.classList.toggle(
            "capacity-positive",
            totals.balance > 0
        );

        elements.kpiBalanceWithFat.textContent =
            formatNumber(totals.balanceWithFat);

        elements.kpiBalanceWithFat.classList.toggle(
            "capacity-negative",
            totals.balanceWithFat < 0
        );

        elements.kpiBalanceWithFat.classList.toggle(
            "capacity-positive",
            totals.balanceWithFat > 0
        );

        elements.kpiUtilization.textContent =
            formatPercent(totals.utilization);

        elements.kpiAttention.textContent =
            formatNumber(attention);

        elements.kpiCritical.textContent =
            formatNumber(critical);

        if (elements.kpiBalanced) {
            elements.kpiBalanced.textContent =
                formatNumber(balanced);
        }

        if (elements.kpiAvailable) {
            elements.kpiAvailable.textContent =
                formatNumber(available);
        }

        var decision = getDecisionMetrics(state.filteredRows);
        var totalsForTooltip = decision.totals;
        var riskCount = decision.attentionRows.length + decision.criticalRows.length;

        setKpiTooltip(
            "budget",
            "<strong>Leitura rápida</strong>" +
            "<span>Atual: " + escapeHtml(formatNumber(totalsForTooltip.actual)) + "</span>" +
            "<span>Utilização: " + escapeHtml(formatPercent(totalsForTooltip.utilization)) + "</span>" +
            "<span>Margem operacional: " + escapeHtml(formatNumber(decision.margin)) + "</span>" +
            "<em>Clique para diagnóstico e recomendação.</em>"
        );

        setKpiTooltip(
            "actual",
            "<strong>Consumo do capacity</strong>" +
            "<span>Saldo: " + escapeHtml(formatNumber(totalsForTooltip.balance)) + "</span>" +
            "<span>Em risco: " + escapeHtml(formatNumber(riskCount)) + " carteiras</span>" +
            "<span>Críticas: " + escapeHtml(formatNumber(decision.criticalRows.length)) + "</span>" +
            "<em>Clique para identificar concentração.</em>"
        );

        setKpiTooltip(
            "balance",
            "<strong>Folga x pressão</strong>" +
            "<span>Folga redistribuível: " + escapeHtml(formatNumber(decision.availablePool)) + "</span>" +
            "<span>Déficit crítico: " + escapeHtml(formatNumber(decision.criticalDeficit)) + "</span>" +
            "<span>Saldo com margem: " + escapeHtml(formatNumber(totalsForTooltip.balanceWithFat)) + "</span>" +
            "<em>Clique para avaliar redistribuição.</em>"
        );

        setKpiTooltip(
            "utilization",
            "<strong>Faixa operacional</strong>" +
            "<span>Disponível: &lt; 85%</span>" +
            "<span>Equilibrada: 85% a 94,9%</span>" +
            "<span>Atenção: ≥ 95% ou margem ≤ 2</span>" +
            "<em>Clique para leitura da utilização.</em>"
        );

        elements.actualLabel.textContent =
            "Budget atual (" + state.actualHeader + ")";

        elements.actualColumnTitle.textContent =
            "Budget atual (" + state.actualHeader + ")";
    }

    function destroyChart(name) {
        if (state.charts[name]) {
            state.charts[name].destroy();
            state.charts[name] = null;
        }
    }

    function chartFontColor() {
        return document.documentElement
            .getAttribute("data-theme") === "dark"
            ? "#aebbd2"
            : "#667085";
    }

    function chartGridColor() {
        return document.documentElement
            .getAttribute("data-theme") === "dark"
            ? "rgba(174, 187, 210, 0.10)"
            : "rgba(102, 112, 133, 0.10)";
    }

    function baseChartOptions() {
        return {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 420
            },
            plugins: {
                legend: {
                    labels: {
                        color: chartFontColor(),
                        boxWidth: 10,
                        boxHeight: 10,
                        font: {
                            family: "Inter",
                            size: 9,
                            weight: "700"
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            var label =
                                context.dataset.label
                                    ? context.dataset.label + ": "
                                    : "";

                            return (
                                label +
                                formatNumber(context.raw, 1)
                            );
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: chartFontColor(),
                        font: {
                            family: "Inter",
                            size: 8,
                            weight: "600"
                        }
                    },
                    grid: {
                        display: false
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: chartFontColor(),
                        font: {
                            family: "Inter",
                            size: 8,
                            weight: "600"
                        }
                    },
                    grid: {
                        color: chartGridColor()
                    }
                }
            }
        };
    }

    function renderBudgetChart() {
        destroyChart("budget");

        var groups =
            groupBy(
                state.filteredRows,
                "supervisor"
            );

        var labels =
            Object.keys(groups).sort(function (a, b) {
                return a.localeCompare(
                    b,
                    "pt-BR",
                    {
                        sensitivity: "base"
                    }
                );
            });

        var budgetData =
            labels.map(function (label) {
                return sum(groups[label], "budget");
            });

        var actualData =
            labels.map(function (label) {
                return sum(groups[label], "actual");
            });

        var options =
            baseChartOptions();

        options.indexAxis = "y";
        options.plugins.legend.position = "bottom";
        options.scales.x.beginAtZero = true;
        options.scales.y.grid.display = false;
        options.scales.y.ticks.autoSkip = false;
        options.plugins.tooltip.callbacks.afterBody = function (items) {
            if (!items.length) { return []; }
            var label = labels[items[0].dataIndex];
            var rows = groups[label] || [];
            var metrics = aggregateRows(rows);
            var critical = rows.filter(function (row) { return row.status.key === "critical"; }).length;
            var attention = rows.filter(function (row) { return row.status.key === "attention"; }).length;
            return [
                "Utilização: " + formatPercent(metrics.utilization),
                "Saldo: " + formatNumber(metrics.balance),
                "Margem: " + formatNumber(sum(rows, "fat")),
                "Saldo c/ margem: " + formatNumber(metrics.balanceWithFat),
                "Carteiras: " + formatNumber(rows.length),
                "Atenção / críticas: " + formatNumber(attention) + " / " + formatNumber(critical),
                "Clique para filtrar esta supervisão"
            ];
        };
        options.onClick = function (_, active) {
            if (!active.length) { return; }
            var label = labels[active[0].index];
            if (Array.from(elements.filterSupervisor.options).some(function (option) { return option.value === label; })) {
                elements.filterSupervisor.value = label;
                state.quickStatus = "";
                applyFilters();
            }
        };
        options.onHover = function (event, active) {
            event.native.target.style.cursor = active.length ? "pointer" : "default";
        };

        state.charts.budget =
            new Chart(
                document.getElementById(
                    "capacityBudgetChart"
                ),
                {
                    type: "bar",
                    data: {
                        labels: labels,
                        datasets: [
                            {
                                label: "Budget aprovado",
                                data: budgetData,
                                backgroundColor:
                                    chartColors.blue,
                                borderRadius: 5,
                                barThickness: 9
                            },
                            {
                                label: "Budget atual - " + state.actualHeader,
                                data: actualData,
                                backgroundColor:
                                    chartColors.cyan,
                                borderRadius: 5,
                                barThickness: 9
                            }
                        ]
                    },
                    options: options
                }
            );
    }

    function renderStatusChart() {
        destroyChart("status");

        var order = [
            {
                key: "critical",
                label: "Acima",
                color: chartColors.red
            },
            {
                key: "attention",
                label: "Atenção",
                color: chartColors.amber
            },
            {
                key: "balanced",
                label: "Equilibrada",
                color: chartColors.blue
            },
            {
                key: "available",
                label: "Disponível",
                color: chartColors.green
            }
        ];

        var data =
            order.map(function (item) {
                return state.filteredRows.filter(
                    function (row) {
                        return row.status.key === item.key;
                    }
                ).length;
            });

        state.charts.status =
            new Chart(
                document.getElementById(
                    "capacityStatusChart"
                ),
                {
                    type: "doughnut",
                    data: {
                        labels:
                            order.map(function (item) {
                                return item.label;
                            }),
                        datasets: [
                            {
                                data: data,
                                backgroundColor:
                                    order.map(function (item) {
                                        return item.color;
                                    }),
                                borderWidth: 0,
                                hoverOffset: 6
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: "66%",
                        plugins: {
                            legend: {
                                position: "bottom",
                                labels: {
                                    color: chartFontColor(),
                                    boxWidth: 10,
                                    boxHeight: 10,
                                    font: {
                                        family: "Inter",
                                        size: 8,
                                        weight: "700"
                                    }
                                }
                            },
                            tooltip: {
                                callbacks: {
                                    label: function (context) {
                                        var total = data.reduce(function (sumValue, value) { return sumValue + value; }, 0);
                                        var percent = total > 0 ? context.raw / total * 100 : 0;
                                        return context.label + ": " + formatNumber(context.raw) + " (" + formatPercent(percent) + ")";
                                    },
                                    afterLabel: function () {
                                        return "Clique para filtrar";
                                    }
                                }
                            }
                        },
                        onClick: function (_, active) {
                            if (!active.length) { return; }
                            var status = order[active[0].index].key;
                            state.quickStatus = "";
                            elements.filterStatus.value = status;
                            applyFilters();
                        },
                        onHover: function (event, active) {
                            event.native.target.style.cursor = active.length ? "pointer" : "default";
                        }
                    }
                }
            );
    }

    function renderModeChart() {
        destroyChart("mode");

        var rowsWithMode =
            state.filteredRows.filter(
                function (row) {
                    return Boolean(cleanText(row.mode));
                }
            );

        var groups =
            groupBy(
                rowsWithMode,
                "mode"
            );

        var labels =
            Object.keys(groups)
                .sort(function (a, b) {
                    var utilizationA =
                        aggregateRows(groups[a])
                            .utilization;

                    var utilizationB =
                        aggregateRows(groups[b])
                            .utilization;

                    return utilizationB - utilizationA;
                });

        var data =
            labels.map(function (label) {
                return aggregateRows(
                    groups[label]
                ).utilization;
            });

        var options =
            baseChartOptions();

        options.indexAxis = "y";
        options.plugins.legend.display = false;
        options.scales.x.beginAtZero = true;
        options.scales.x.suggestedMax = 110;
        options.scales.x.ticks.callback =
            function (value) {
                return value + "%";
            };
        options.scales.y.grid.display = false;
        options.scales.y.ticks.autoSkip = false;
        options.plugins.tooltip.callbacks.label =
            function (context) {
                return (
                    "Utilização: " +
                    formatPercent(context.raw)
                );
            };
        options.plugins.tooltip.callbacks.afterBody = function (items) {
            if (!items.length) { return []; }
            var label = labels[items[0].dataIndex];
            var rows = groups[label] || [];
            var metrics = aggregateRows(rows);
            return [
                "Budget: " + formatNumber(metrics.budget),
                "Atual: " + formatNumber(metrics.actual),
                "Saldo: " + formatNumber(metrics.balance),
                "Saldo c/ margem: " + formatNumber(metrics.balanceWithFat),
                "Carteiras: " + formatNumber(rows.length),
                "Clique para filtrar esta modalidade"
            ];
        };
        options.onClick = function (_, active) {
            if (!active.length) { return; }
            var label = labels[active[0].index];
            if (Array.from(elements.filterMode.options).some(function (option) { return option.value === label; })) {
                elements.filterMode.value = label;
                state.quickStatus = "";
                applyFilters();
            }
        };
        options.onHover = function (event, active) {
            event.native.target.style.cursor = active.length ? "pointer" : "default";
        };

        state.charts.mode =
            new Chart(
                document.getElementById(
                    "capacityModeChart"
                ),
                {
                    type: "bar",
                    data: {
                        labels: labels,
                        datasets: [
                            {
                                label: "Utilização",
                                data: data,
                                backgroundColor:
                                    labels.map(
                                        function (_, index) {
                                            var palette = [
                                                chartColors.blue,
                                                chartColors.cyan,
                                                chartColors.purple,
                                                chartColors.green
                                            ];

                                            return palette[
                                                index %
                                                palette.length
                                            ];
                                        }
                                    ),
                                borderRadius: 7,
                                barThickness: 18
                            }
                        ]
                    },
                    options: options
                }
            );
    }

    function renderAreaChart() {
        destroyChart("area");

        var groups =
            groupBy(
                state.filteredRows,
                "area"
            );

        var labels = [
            "Operação",
            "Jurídico"
        ].filter(function (label) {
            return Boolean(groups[label]);
        });

        var budgetData =
            labels.map(function (label) {
                return sum(groups[label], "budget");
            });

        var actualData =
            labels.map(function (label) {
                return sum(groups[label], "actual");
            });

        var options =
            baseChartOptions();

        options.plugins.legend.position = "bottom";
        options.scales.x.grid.display = false;
        options.scales.y.beginAtZero = true;
        options.plugins.tooltip.callbacks.afterBody = function (items) {
            if (!items.length) { return []; }
            var label = labels[items[0].dataIndex];
            var rows = groups[label] || [];
            var metrics = aggregateRows(rows);
            return [
                "Utilização: " + formatPercent(metrics.utilization),
                "Saldo: " + formatNumber(metrics.balance),
                "Margem: " + formatNumber(sum(rows, "fat")),
                "Saldo c/ margem: " + formatNumber(metrics.balanceWithFat),
                "Carteiras: " + formatNumber(rows.length)
            ];
        };

        state.charts.area =
            new Chart(
                document.getElementById(
                    "capacityAreaChart"
                ),
                {
                    type: "bar",
                    data: {
                        labels: labels,
                        datasets: [
                            {
                                label: "Budget aprovado",
                                data: budgetData,
                                backgroundColor:
                                    chartColors.blue,
                                borderRadius: 6,
                                barThickness: 24
                            },
                            {
                                label: "Budget atual - " + state.actualHeader,
                                data: actualData,
                                backgroundColor:
                                    chartColors.purple,
                                borderRadius: 6,
                                barThickness: 24
                            }
                        ]
                    },
                    options: options
                }
            );
    }

    function renderBalanceChart() {
        destroyChart("balance");

        var rows =
            state.filteredRows
                .slice()
                .sort(function (a, b) {
                    return (
                        a.balanceWithFat -
                        b.balanceWithFat
                    );
                })
                .slice(0, 8);

        var values =
            rows.map(function (row) {
                return row.balanceWithFat;
            });

        var minValue =
            values.length
                ? Math.min.apply(null, values)
                : 0;

        var maxValue =
            values.length
                ? Math.max.apply(null, values)
                : 0;

        /*
         * Cria uma escala com contexto mínimo.
         * Assim, saldos de -1 não ocupam toda a largura do card.
         */
        var scaleMin =
            Math.min(
                -5,
                Math.floor(minValue * 1.4)
            );

        var scaleMax =
            Math.max(
                5,
                Math.ceil(maxValue * 1.15)
            );

        var options =
            baseChartOptions();

        options.indexAxis = "y";
        options.plugins.legend.display = false;
        options.scales.x.beginAtZero = false;
        options.scales.x.min = scaleMin;
        options.scales.x.max = scaleMax;
        options.scales.y.grid.display = false;
        options.scales.y.ticks.autoSkip = false;
        options.plugins.tooltip.callbacks.label = function (context) {
            var row = rows[context.dataIndex];
            return "Saldo c/ margem: " + formatNumber(row.balanceWithFat);
        };
        options.plugins.tooltip.callbacks.afterBody = function (items) {
            if (!items.length) { return []; }
            var row = rows[items[0].dataIndex];
            return [
                "Budget: " + formatNumber(row.budget),
                "Atual: " + formatNumber(row.actual),
                "Margem: " + formatNumber(row.fat),
                "Saldo sem margem: " + formatNumber(row.balance),
                "Utilização: " + formatPercent(row.utilization),
                "Situação: " + row.status.label,
                "Clique para abrir a carteira"
            ];
        };
        options.onClick = function (_, active) {
            if (!active.length) { return; }
            var row = rows[active[0].index];
            if (Array.from(elements.filterPortfolio.options).some(function (option) { return option.value === row.portfolio; })) {
                elements.filterPortfolio.value = row.portfolio;
                state.quickStatus = "";
                applyFilters();
            }
        };
        options.onHover = function (event, active) {
            event.native.target.style.cursor = active.length ? "pointer" : "default";
        };

        state.charts.balance =
            new Chart(
                document.getElementById(
                    "capacityBalanceChart"
                ),
                {
                    type: "bar",
                    data: {
                        labels:
                            rows.map(function (row) {
                                return row.portfolio;
                            }),
                        datasets: [
                            {
                                label: "Saldo com margem",
                                data: values,
                                backgroundColor:
                                    rows.map(function (row) {
                                        return row.balanceWithFat < 0
                                            ? chartColors.red
                                            : (
                                                row.balanceWithFat <= 2
                                                    ? chartColors.amber
                                                    : chartColors.green
                                            );
                                    }),
                                borderRadius: 6,
                                barThickness: 11
                            }
                        ]
                    },
                    options: options
                }
            );
    }

    function insightIcon(type) {
        if (type === "critical") {
            return (
                '<svg viewBox="0 0 24 24" aria-hidden="true">' +
                    '<path d="M12 4v10M12 18v.1M5.5 20h13a2 2 0 0 0 1.7-3L13.7 5.5a2 2 0 0 0-3.4 0L3.8 17a2 2 0 0 0 1.7 3Z" ' +
                    'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path>' +
                "</svg>"
            );
        }

        if (type === "warning") {
            return (
                '<svg viewBox="0 0 24 24" aria-hidden="true">' +
                    '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.8"></circle>' +
                    '<path d="M12 8v5M12 16.5v.1" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"></path>' +
                "</svg>"
            );
        }

        if (type === "success") {
            return (
                '<svg viewBox="0 0 24 24" aria-hidden="true">' +
                    '<path d="M5 12.5 9.2 17 19 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>' +
                "</svg>"
            );
        }

        return (
            '<svg viewBox="0 0 24 24" aria-hidden="true">' +
                '<path d="M5 19V9M12 19V5M19 19v-7" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"></path>' +
            "</svg>"
        );
    }

    function renderInsights() {
        var rows = state.filteredRows;
        var metrics = getDecisionMetrics(rows);
        var totals = metrics.totals;
        var criticalRows = metrics.criticalRows.slice().sort(function (a, b) {
            return a.balanceWithFat - b.balanceWithFat;
        });
        var availableRows = metrics.availableRows.slice().sort(function (a, b) {
            return b.balanceWithFat - a.balanceWithFat;
        });

        var mainTitle = "A operação permanece dentro do capacity planejado";
        var mainText = "A utilização consolidada é de " + formatPercent(totals.utilization) + ". Acompanhe a distribuição da folga para evitar saturação localizada.";
        var highlightLabel = "Principal ponto de atenção";
        var highlightValue = "Nenhuma carteira crítica";
        var actionText = "Manter monitoramento preventivo";

        if (criticalRows.length && totals.balance > 0) {
            var worst = criticalRows[0];
            mainTitle = "Há saldo global, mas a capacidade está mal distribuída";
            mainText = "O consolidado ainda possui " + formatNumber(totals.balance) + " posições de saldo, porém " + formatNumber(criticalRows.length) + " carteira(s) já ultrapassaram a capacidade considerando a margem operacional.";
            highlightValue = worst.portfolio + " — " + formatPercent(worst.utilization) + " | saldo c/ margem " + formatNumber(worst.balanceWithFat);
            actionText = metrics.availablePool >= metrics.criticalDeficit
                ? "Avaliar redistribuição interna antes de aumentar o budget"
                : "Redistribuir o possível e revisar o residual de budget";
        } else if (criticalRows.length) {
            var worstCritical = criticalRows[0];
            mainTitle = "A capacidade consolidada está pressionada";
            mainText = "Além de existirem carteiras acima da capacidade, o saldo global já está em " + formatNumber(totals.balance) + ". O cenário exige priorização de dimensionamento.";
            highlightValue = worstCritical.portfolio + " — déficit de " + formatNumber(Math.abs(worstCritical.balanceWithFat)) + " posições com margem";
            actionText = "Revisar dimensionamento e necessidade de ampliação do budget";
        } else if (totals.utilization >= 95) {
            mainTitle = "A operação está próxima do limite do budget";
            mainText = "A utilização chegou a " + formatPercent(totals.utilization) + ", com apenas " + formatNumber(totals.balance) + " posições de saldo aprovado. Mesmo sem carteiras críticas, a folga para crescimento é reduzida.";
            highlightLabel = "Faixa de atenção";
            highlightValue = formatNumber(metrics.attentionRows.length) + " carteira(s) exigem acompanhamento";
            actionText = "Antecipar redistribuição antes de novas entradas";
        }

        var secondary = [];

        if (metrics.availablePool > 0) {
            secondary.push({
                type: "success",
                title: "Folga potencial para redistribuição",
                text: formatNumber(metrics.availablePool) + " posições estão em carteiras classificadas com capacidade disponível."
            });
        }

        if (metrics.topSupervisor) {
            secondary.push({
                type: metrics.topSupervisor.utilization >= 95 ? "warning" : "info",
                title: "Supervisão mais pressionada",
                text: metrics.topSupervisor.name + " está em " + formatPercent(metrics.topSupervisor.utilization) + " de utilização."
            });
        }

        secondary.push({
            type: metrics.overApproved > 0 ? "warning" : "success",
            title: "Uso da margem operacional",
            text: metrics.overApproved > 0
                ? formatNumber(metrics.overApproved) + " posições já operam acima do budget aprovado e dependem de margem em alguma carteira."
                : "Nenhuma posição da seleção ultrapassa o budget aprovado."
        });

        elements.insights.innerHTML =
            '<div class="capacity-insight-hero">' +
                '<div class="capacity-insight-hero-label">' +
                    '<span class="capacity-insight-hero-icon">✦</span>' +
                    '<span>INSIGHT AUTOMÁTICO</span>' +
                '</div>' +
                '<h3>' + escapeHtml(mainTitle) + '</h3>' +
                '<p>' + escapeHtml(mainText) + '</p>' +
                '<div class="capacity-insight-highlight">' +
                    '<span>' + escapeHtml(highlightLabel) + '</span>' +
                    '<strong>' + escapeHtml(highlightValue) + '</strong>' +
                '</div>' +
                '<button type="button" class="capacity-insight-action" data-insight-action="utilization">' +
                    escapeHtml(actionText) + ' →' +
                '</button>' +
            '</div>' +
            '<div class="capacity-insight-secondary-grid">' +
                secondary.slice(0, 3).map(function (insight) {
                    return (
                        '<article class="capacity-insight-mini is-' + escapeHtml(insight.type) + '">' +
                            '<span class="capacity-insight-mini-icon">' + insightIcon(insight.type) + '</span>' +
                            '<div><strong>' + escapeHtml(insight.title) + '</strong><p>' + escapeHtml(insight.text) + '</p></div>' +
                        '</article>'
                    );
                }).join("") +
            '</div>';
    }

    function hierarchyMetric(label, value) {
        return (
            '<span class="capacity-hierarchy-metric">' +
                "<strong>" +
                    escapeHtml(formatNumber(value)) +
                "</strong>" +
                escapeHtml(label) +
            "</span>"
        );
    }

    function hierarchyDetails(
        label,
        rows,
        childrenHtml,
        level,
        extraClass
    ) {
        var metrics = aggregateRows(rows);

        return (
            '<details data-level="' +
                escapeHtml(level || "item") +
            '">' +
                "<summary>" +
                    '<span class="capacity-hierarchy-name ' +
                        escapeHtml(extraClass || "") +
                    '">' +
                        escapeHtml(label) +
                    "</span>" +
                    '<span class="capacity-hierarchy-metrics">' +
                        hierarchyMetric(
                            "Budget aprovado",
                            metrics.budget
                        ) +
                        hierarchyMetric(
                            "Budget atual",
                            metrics.actual
                        ) +
                        hierarchyMetric(
                            "Saldo",
                            metrics.balanceWithFat
                        ) +
                    "</span>" +
                "</summary>" +
                (
                    childrenHtml || ""
                ) +
            "</details>"
        );
    }

    function renderHierarchy() {
        var areaGroups =
            groupBy(
                state.filteredRows,
                "area"
            );

        var areaOrder = [
            "Operação",
            "Jurídico"
        ];

        var html =
            areaOrder
                .filter(function (area) {
                    return Boolean(areaGroups[area]);
                })
                .map(function (area) {
                    var supervisorGroups =
                        groupBy(
                            areaGroups[area],
                            "supervisor"
                        );

                    var supervisorHtml =
                        Object.keys(supervisorGroups)
                            .sort(function (a, b) {
                                return a.localeCompare(
                                    b,
                                    "pt-BR",
                                    {
                                        sensitivity: "base"
                                    }
                                );
                            })
                            .map(function (supervisor) {
                                var portfolioGroups =
                                    groupBy(
                                        supervisorGroups[supervisor],
                                        "portfolio"
                                    );

                                var portfolioHtml =
                                    Object.keys(portfolioGroups)
                                        .sort(function (a, b) {
                                            return a.localeCompare(
                                                b,
                                                "pt-BR",
                                                {
                                                    sensitivity: "base"
                                                }
                                            );
                                        })
                                        .map(function (portfolio) {
                                            var portfolioRows =
                                                portfolioGroups[portfolio];

                                            var managerGroups =
                                                groupBy(
                                                    portfolioRows.filter(
                                                        function (row) {
                                                            return Boolean(
                                                                cleanText(
                                                                    row.manager
                                                                )
                                                            );
                                                        }
                                                    ),
                                                    "manager"
                                                );

                                            var managerHtml =
                                                Object.keys(managerGroups)
                                                    .sort(function (a, b) {
                                                        return a.localeCompare(
                                                            b,
                                                            "pt-BR",
                                                            {
                                                                sensitivity:
                                                                    "base"
                                                            }
                                                        );
                                                    })
                                                    .map(function (manager) {
                                                        var managerRows =
                                                            managerGroups[
                                                                manager
                                                            ];

                                                        var leaders =
                                                            uniqueSorted(
                                                                managerRows,
                                                                "leader"
                                                            );

                                                        var leaderHtml =
                                                            leaders.map(
                                                                function (
                                                                    leader
                                                                ) {
                                                                    var leaderRows =
                                                                        managerRows.filter(
                                                                            function (
                                                                                row
                                                                            ) {
                                                                                return (
                                                                                    row.leader ===
                                                                                    leader
                                                                                );
                                                                            }
                                                                        );

                                                                    return hierarchyDetails(
                                                                        leader,
                                                                        leaderRows,
                                                                        "",
                                                                        "leader",
                                                                        ""
                                                                    );
                                                                }
                                                            ).join("");

                                                        return hierarchyDetails(
                                                            manager,
                                                            managerRows,
                                                            leaderHtml,
                                                            "manager",
                                                            ""
                                                        );
                                                    })
                                                    .join("");

                                            return hierarchyDetails(
                                                portfolio,
                                                portfolioRows,
                                                managerHtml,
                                                "portfolio",
                                                ""
                                            );
                                        })
                                        .join("");

                                return hierarchyDetails(
                                    supervisor,
                                    supervisorGroups[supervisor],
                                    portfolioHtml,
                                    "supervisor",
                                    ""
                                );
                            })
                            .join("");

                    return hierarchyDetails(
                        area,
                        areaGroups[area],
                        supervisorHtml,
                        "area",
                        "capacity-hierarchy-area-label " +
                        (
                            area === "Jurídico"
                                ? "is-legal"
                                : ""
                        )
                    );
                })
                .join("");

        elements.hierarchy.innerHTML =
            html ||
            '<div class="capacity-empty-state">' +
                "Nenhuma estrutura encontrada para os filtros selecionados." +
            "</div>";

        if (state.hierarchyOpen) {
            elements.hierarchy
                .querySelectorAll("details")
                .forEach(function (detail) {
                    detail.open = true;
                });
        }
    }

    function compareRows(a, b, field) {
        if (field === "status") {
            var priority = {
                critical: 0,
                attention: 1,
                balanced: 2,
                available: 3
            };

            return (
                priority[a.status.key] -
                priority[b.status.key]
            );
        }

        var numericFields = [
            "budget",
            "fat",
            "actual",
            "balance",
            "balanceWithFat",
            "utilization"
        ];

        if (numericFields.indexOf(field) !== -1) {
            return (
                Number(a[field] || 0) -
                Number(b[field] || 0)
            );
        }

        return cleanText(a[field]).localeCompare(
            cleanText(b[field]),
            "pt-BR",
            {
                sensitivity: "base"
            }
        );
    }

    function sortTableRows(rows) {
        return rows
            .slice()
            .sort(function (a, b) {
                var result =
                    compareRows(
                        a,
                        b,
                        state.sort.field
                    );

                if (result === 0) {
                    result =
                        a.portfolio.localeCompare(
                            b.portfolio,
                            "pt-BR",
                            {
                                sensitivity: "base"
                            }
                        );
                }

                return state.sort.direction === "asc"
                    ? result
                    : -result;
            });
    }

    function updateSortIndicators() {
        elements.sortButtons.forEach(
            function (button) {
                var active =
                    button.dataset.sort ===
                    state.sort.field;

                button.classList.toggle(
                    "is-active",
                    active
                );

                var indicator =
                    button.querySelector(
                        ".capacity-sort-indicator"
                    );

                if (!indicator) {
                    return;
                }

                indicator.textContent =
                    active
                        ? (
                            state.sort.direction === "asc"
                                ? "↑"
                                : "↓"
                        )
                        : "↕";
            }
        );
    }

    function renderTable() {
        var rows =
            sortTableRows(
                state.filteredRows
            );

        updateSortIndicators();

        elements.tableCounter.textContent =
            rows.length +
            (
                rows.length === 1
                    ? " registro"
                    : " registros"
            );

        if (!rows.length) {
            elements.tableBody.innerHTML =
                '<tr><td colspan="12" class="capacity-empty-state">' +
                    "Nenhum registro encontrado para os filtros selecionados." +
                "</td></tr>";

            return;
        }

        elements.tableBody.innerHTML =
            rows.map(function (row) {
                var width =
                    Math.min(
                        Math.max(row.utilization, 0),
                        100
                    );

                var barClass =
                    row.status.key === "critical"
                        ? "is-critical"
                        : (
                            row.status.key === "attention"
                                ? "is-warning"
                                : ""
                        );

                var balanceClass =
                    row.balance < 0
                        ? "capacity-negative"
                        : (
                            row.balance > 0
                                ? "capacity-positive"
                                : ""
                        );

                var balanceFatClass =
                    row.balanceWithFat < 0
                        ? "capacity-negative"
                        : (
                            row.balanceWithFat > 0
                                ? "capacity-positive"
                                : ""
                        );

                return (
                    "<tr>" +
                        "<td>" +
                            escapeHtml(
                                row.supervisor || "—"
                            ) +
                        "</td>" +
                        "<td>" +
                            escapeHtml(
                                row.manager || "—"
                            ) +
                        "</td>" +
                        "<td>" +
                            escapeHtml(
                                row.leader || "—"
                            ) +
                        "</td>" +
                        "<td>" +
                            escapeHtml(
                                row.mode || "—"
                            ) +
                        "</td>" +
                        "<td>" +
                            escapeHtml(row.portfolio) +
                        "</td>" +
                        '<td class="capacity-number">' +
                            escapeHtml(
                                formatNumber(row.budget)
                            ) +
                        "</td>" +
                        '<td class="capacity-number">' +
                            escapeHtml(
                                formatNumber(row.fat)
                            ) +
                        "</td>" +
                        '<td class="capacity-number">' +
                            escapeHtml(
                                formatNumber(row.actual)
                            ) +
                        "</td>" +
                        '<td class="capacity-number ' +
                            balanceClass +
                        '">' +
                            escapeHtml(
                                formatNumber(row.balance)
                            ) +
                        "</td>" +
                        '<td class="capacity-number ' +
                            balanceFatClass +
                        '">' +
                            escapeHtml(
                                formatNumber(
                                    row.balanceWithFat
                                )
                            ) +
                        "</td>" +
                        '<td class="capacity-utilization-cell">' +
                            '<div class="capacity-utilization-bar ' +
                                barClass +
                            '">' +
                                '<span style="width:' +
                                    width +
                                '%"></span>' +
                            "</div>" +
                            '<span class="capacity-utilization-label">' +
                                escapeHtml(
                                    formatPercent(
                                        row.utilization
                                    )
                                ) +
                            "</span>" +
                        "</td>" +
                        "<td>" +
                            '<span class="capacity-status is-' +
                                row.status.key +
                            '">' +
                                escapeHtml(
                                    row.status.label
                                ) +
                            "</span>" +
                        "</td>" +
                    "</tr>"
                );
            }).join("");
    }

    function renderPriorityCards() {
        if (!elements.criticalCards) {
            return;
        }

        var priority = {
            critical: 0,
            attention: 1,
            balanced: 2,
            available: 3
        };

        var rows = state.filteredRows
            .slice()
            .sort(function (a, b) {
                var statusDiff =
                    priority[a.status.key] -
                    priority[b.status.key];

                if (statusDiff !== 0) {
                    return statusDiff;
                }

                if (a.balanceWithFat !== b.balanceWithFat) {
                    return a.balanceWithFat - b.balanceWithFat;
                }

                return b.utilization - a.utilization;
            })
            .slice(0, 3);

        if (!rows.length) {
            elements.criticalCards.innerHTML =
                '<div class="capacity-critical-empty">' +
                    'Nenhuma carteira encontrada para os filtros selecionados.' +
                '</div>';
            return;
        }

        elements.criticalCards.innerHTML =
            rows.map(function (row) {
                var cardClass =
                    row.status.key === "critical"
                        ? "is-critical"
                        : (
                            row.status.key === "attention"
                                ? "is-attention"
                                : "is-balanced"
                        );

                var supervisor =
                    cleanText(row.supervisor) ||
                    "Supervisão não informada";

                var balanceClass =
                    row.balanceWithFat < 0
                        ? " capacity-negative"
                        : (
                            row.balanceWithFat > 0
                                ? " capacity-positive"
                                : ""
                        );

                return (
                    '<article role="button" tabindex="0" data-capacity-portfolio="' + escapeHtml(row.portfolio) + '" class="capacity-critical-card ' +
                        cardClass +
                    '">' +
                        '<div class="capacity-critical-card-top">' +
                            '<span class="capacity-critical-badge">' +
                                escapeHtml(row.status.label) +
                            '</span>' +
                            '<strong class="capacity-critical-utilization">' +
                                escapeHtml(formatPercent(row.utilization)) +
                            '</strong>' +
                        '</div>' +
                        '<h3 title="' +
                            escapeHtml(row.portfolio) +
                        '">' +
                            escapeHtml(row.portfolio) +
                        '</h3>' +
                        '<p title="' +
                            escapeHtml(supervisor) +
                        '">' +
                            escapeHtml(supervisor) +
                        '</p>' +
                        '<div class="capacity-critical-card-numbers">' +
                            '<div>' +
                                '<span>Aprovado</span>' +
                                '<strong>' +
                                    escapeHtml(formatNumber(row.budget)) +
                                '</strong>' +
                            '</div>' +
                            '<div>' +
                                '<span>Atual</span>' +
                                '<strong>' +
                                    escapeHtml(formatNumber(row.actual)) +
                                '</strong>' +
                            '</div>' +
                            '<div>' +
                                '<span>Saldo c/ margem</span>' +
                                '<strong class="' +
                                    balanceClass.trim() +
                                '">' +
                                    escapeHtml(
                                        formatNumber(row.balanceWithFat)
                                    ) +
                                '</strong>' +
                            '</div>' +
                        '</div>' +
                    '</article>'
                );
            }).join("");
    }

    function renderTimelineChart() {
        destroyChart("timeline");

        var options = baseChartOptions();
        options.plugins.legend.position = "bottom";
        options.interaction = {
            mode: "index",
            intersect: false
        };
        options.plugins.tooltip.callbacks.afterBody = function (items) {
            if (!items.length) { return []; }
            var index = items[0].dataIndex;
            var item = state.timeline[index];
            var utilization = item.budget > 0 ? item.actual / item.budget * 100 : 0;
            var previous = index > 0 ? state.timeline[index - 1] : null;
            var previousUtilization = previous && previous.budget > 0 ? previous.actual / previous.budget * 100 : 0;
            var delta = previous ? utilization - previousUtilization : null;
            var lines = [
                "Utilização: " + formatPercent(utilization),
                "Saldo sem margem: " + formatNumber(item.balance),
                "Saldo c/ margem: " + formatNumber(item.balanceWithFat)
            ];
            if (delta !== null) {
                lines.push("Variação vs mês anterior: " + (delta >= 0 ? "+" : "") + formatPercent(delta));
                lines.push(delta > 0 ? "Tendência: maior pressão de capacity" : (delta < 0 ? "Tendência: alívio de capacity" : "Tendência: estável"));
            }
            return lines;
        };

        state.charts.timeline = new Chart(
            document.getElementById("capacityTimelineChart"),
            {
                type: "line",
                data: {
                    labels: state.timeline.map(function (item) {
                        return item.label;
                    }),
                    datasets: [
                        {
                            label: "Budget aprovado pela diretoria",
                            data: state.timeline.map(function (item) {
                                return item.budget;
                            }),
                            borderColor: chartColors.blue,
                            backgroundColor: "rgba(37, 99, 235, 0.10)",
                            borderWidth: 2,
                            pointRadius: 3,
                            tension: 0.25
                        },
                        {
                            label: "Budget atual",
                            data: state.timeline.map(function (item) {
                                return item.actual;
                            }),
                            borderColor: chartColors.cyan,
                            backgroundColor: "rgba(56, 189, 248, 0.10)",
                            borderWidth: 2,
                            pointRadius: 3,
                            tension: 0.25
                        },
                        {
                            label: "Saldo com margem",
                            data: state.timeline.map(function (item) {
                                return item.balanceWithFat;
                            }),
                            borderColor: chartColors.green,
                            backgroundColor: "rgba(18, 183, 106, 0.10)",
                            borderWidth: 2,
                            pointRadius: 3,
                            tension: 0.25
                        }
                    ]
                },
                options: options
            }
        );
    }

    function renderCharts() {
        renderTimelineChart();
        renderBudgetChart();
        renderStatusChart();
        renderModeChart();
        renderAreaChart();
        renderBalanceChart();
    }

    function renderAll() {
        renderKpis();
        renderCharts();
        renderInsights();
        renderPriorityCards();
        renderHierarchy();
        renderTable();
    }

    async function loadDashboard(forceRefresh, requestedCompetence) {
        hideAlert();
        setLoading(true);

        updateSourceStatus(
            "",
            "Carregando competência..."
        );

        try {
            if (typeof Chart === "undefined") {
                throw new Error(
                    "A biblioteca chart.umd.min.js não foi encontrada em static/js."
                );
            }

            var apiUrl =
                dashboard.getAttribute(
                    "data-api-url"
                );

            if (!apiUrl) {
                throw new Error(
                    "O endereço da API de capacity não foi informado."
                );
            }

            var competence = requestedCompetence || elements.filterCompetence.value;
            var separator =
                apiUrl.indexOf("?") === -1
                    ? "?"
                    : "&";

            var requestUrl =
                apiUrl +
                separator +
                (competence
                    ? "competencia=" + encodeURIComponent(competence) + "&"
                    : "") +
                "cache=" +
                (
                    forceRefresh
                        ? Date.now()
                        : "initial"
                );

            var response =
                await fetch(
                    requestUrl,
                    {
                        method: "GET",
                        cache: "no-store",
                        credentials: "same-origin"
                    }
                );

            if (!response.ok) {
                var errorPayload = await response.json().catch(function () {
                    return {};
                });
                throw new Error(
                    errorPayload.mensagem ||
                    "Não foi possível consultar os dados de capacity."
                );
            }

            var payload = await response.json();
            var rows = buildApiRows(payload.rows);

            state.rows = rows;
            state.filteredRows = rows.slice();
            state.timeline = buildTimeline(payload.timeline);
            state.actualHeader = payload.competencia_label || "Atual";

            populateCompetences(payload.competencias, payload.competencia);
            populateFilters();
            applyFilters();

            if (!rows.length) {
                showAlert(
                    "Competência sem registros",
                    "Ainda não existe capacity cadastrado para " +
                    (payload.competencia_label || "o período selecionado") + "."
                );
            }

            var updatedAt = payload.atualizado_em
                ? new Intl.DateTimeFormat(
                    "pt-BR",
                    {
                        dateStyle: "short",
                        timeStyle: "short"
                    }
                ).format(new Date(payload.atualizado_em))
                : null;

            updateSourceStatus(
                "ready",
                updatedAt
                    ? "Atualizado em " + updatedAt
                    : "Sem dados em " + payload.competencia_label
            );
        } catch (error) {
            console.error(
                "Erro no dashboard de capacity:",
                error
            );

            updateSourceStatus(
                "error",
                "Falha ao carregar a base"
            );

            showAlert(
                "Não foi possível carregar o dashboard",
                error.message ||
                "Ocorreu um erro ao consultar o capacity."
            );
        } finally {
            setLoading(false);
        }
    }

    elements.filterCompetence.addEventListener(
        "change",
        function () {
            loadDashboard(false);
        }
    );

    if (elements.importToggle && elements.importForm) {
        elements.importToggle.addEventListener("click", function () {
            var willOpen = elements.importForm.hidden;
            elements.importForm.hidden = !willOpen;
            elements.importToggle.setAttribute("aria-expanded", String(willOpen));

            if (willOpen) {
                var monthInput = elements.importForm.querySelector('[name="competencia"]');
                if (!monthInput.value) {
                    monthInput.value = elements.filterCompetence.value ||
                        new Date().toISOString().slice(0, 7);
                }
            }
        });

        elements.importForm.addEventListener("submit", async function (event) {
            event.preventDefault();
            hideAlert();

            var submitButton = elements.importForm.querySelector('[type="submit"]');
            submitButton.disabled = true;

            try {
                var response = await fetch(
                    dashboard.getAttribute("data-import-url"),
                    {
                        method: "POST",
                        credentials: "same-origin",
                        body: new FormData(elements.importForm)
                    }
                );
                var payload = await response.json();
                if (!response.ok || !payload.ok) {
                    throw new Error(payload.mensagem || "Não foi possível importar a planilha.");
                }

                await loadDashboard(true, payload.competencia);
                showAlert("Importação concluída", payload.mensagem, "success");
                elements.importForm.hidden = true;
                elements.importToggle.setAttribute("aria-expanded", "false");
                elements.importForm.querySelector('[name="arquivo"]').value = "";
            } catch (error) {
                showAlert(
                    "Não foi possível importar o capacity",
                    error.message || "Revise a planilha e tente novamente."
                );
            } finally {
                submitButton.disabled = false;
            }
        });
    }

    [
        elements.filterSupervisor,
        elements.filterManager,
        elements.filterLeader,
        elements.filterMode,
        elements.filterPortfolio
    ].forEach(function (select) {
        select.addEventListener(
            "change",
            function () {
                state.quickStatus = "";
                applyFilters();
            }
        );
    });

    elements.filterStatus.addEventListener("change", function () {
        state.quickStatus = "";
        applyFilters();
    });

    elements.kpiCards.forEach(function (card) {
        function activate() {
            renderDecisionAnalysis(card.getAttribute("data-capacity-kpi"));
        }
        card.addEventListener("click", activate);
        card.addEventListener("keydown", function (event) {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                activate();
            }
        });
    });

    elements.healthCards.forEach(function (card) {
        function activate() {
            var status = card.getAttribute("data-capacity-health");
            if (status === "margin") {
                renderDecisionAnalysis("margin");
                return;
            }
            focusHealthStatus(status);
        }
        card.addEventListener("click", activate);
        card.addEventListener("keydown", function (event) {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                activate();
            }
        });
    });

    if (elements.decisionClose) {
        elements.decisionClose.addEventListener("click", function () {
            elements.decisionPanel.hidden = true;
        });
    }

    if (elements.insights) {
        elements.insights.addEventListener("click", function (event) {
            var action = event.target.closest("[data-insight-action]");
            if (action) {
                renderDecisionAnalysis(action.getAttribute("data-insight-action"));
            }
        });
    }

    if (elements.criticalCards) {
        elements.criticalCards.addEventListener("click", function (event) {
            var card = event.target.closest("[data-capacity-portfolio]");
            if (!card) { return; }
            var portfolio = card.getAttribute("data-capacity-portfolio");
            if (Array.from(elements.filterPortfolio.options).some(function (option) { return option.value === portfolio; })) {
                elements.filterPortfolio.value = portfolio;
                state.quickStatus = "";
                applyFilters();
                elements.tablePanel.scrollIntoView({behavior: "smooth", block: "start"});
            }
        });
        elements.criticalCards.addEventListener("keydown", function (event) {
            if (event.key !== "Enter" && event.key !== " ") { return; }
            var card = event.target.closest("[data-capacity-portfolio]");
            if (card) {
                event.preventDefault();
                card.click();
            }
        });
    }

    elements.clearFilters.addEventListener(
        "click",
        function () {
            elements.filterSupervisor.value = "";
            elements.filterManager.value = "";
            elements.filterLeader.value = "";
            elements.filterMode.value = "";
            elements.filterPortfolio.value = "";
            elements.filterStatus.value = "";
            state.quickStatus = "";

            applyFilters();
        }
    );

    elements.refreshButton.addEventListener(
        "click",
        function () {
            loadDashboard(true);
        }
    );

    elements.expandHierarchy.addEventListener(
        "click",
        function () {
            state.hierarchyOpen =
                !state.hierarchyOpen;

            elements.expandHierarchy.classList.toggle(
                "is-open",
                state.hierarchyOpen
            );

            var label =
                elements.expandHierarchy
                    .querySelector("span");

            label.textContent =
                state.hierarchyOpen
                    ? "Recolher estrutura"
                    : "Abrir estrutura";

            elements.hierarchy
                .querySelectorAll("details")
                .forEach(function (detail) {
                    detail.open =
                        state.hierarchyOpen;
                });
        }
    );

    elements.sortButtons.forEach(
        function (button) {
            button.addEventListener(
                "click",
                function () {
                    var field =
                        button.dataset.sort;

                    if (state.sort.field === field) {
                        state.sort.direction =
                            state.sort.direction === "asc"
                                ? "desc"
                                : "asc";
                    } else {
                        state.sort.field = field;
                        state.sort.direction =
                            [
                                "budget",
                                "fat",
                                "actual",
                                "balance",
                                "balanceWithFat",
                                "utilization"
                            ].indexOf(field) !== -1
                                ? "desc"
                                : "asc";
                    }

                    renderTable();
                }
            );
        }
    );

    function setExpandedPanel(
        panel,
        button,
        expanded,
        expandedLabel,
        collapsedLabel
    ) {
        panel.classList.toggle(
            "is-expanded",
            expanded
        );

        button.setAttribute(
            "aria-pressed",
            String(expanded)
        );

        var label =
            button.querySelector("span");

        if (label) {
            label.textContent =
                expanded
                    ? expandedLabel
                    : collapsedLabel;
        }

        document.body.classList.toggle(
            "capacity-panel-expanded",
            state.hierarchyExpanded ||
            state.tableExpanded
        );
    }

    elements.hierarchyExpandButton.addEventListener(
        "click",
        function () {
            state.hierarchyExpanded =
                !state.hierarchyExpanded;

            if (state.hierarchyExpanded) {
                state.tableExpanded = false;

                setExpandedPanel(
                    elements.tablePanel,
                    elements.tableExpandButton,
                    false,
                    "Reduzir tabela",
                    "Expandir tabela"
                );
            }

            setExpandedPanel(
                elements.hierarchyPanel,
                elements.hierarchyExpandButton,
                state.hierarchyExpanded,
                "Reduzir estrutura",
                "Expandir estrutura"
            );
        }
    );

    elements.tableExpandButton.addEventListener(
        "click",
        function () {
            state.tableExpanded =
                !state.tableExpanded;

            if (state.tableExpanded) {
                state.hierarchyExpanded = false;

                setExpandedPanel(
                    elements.hierarchyPanel,
                    elements.hierarchyExpandButton,
                    false,
                    "Reduzir estrutura",
                    "Expandir estrutura"
                );
            }

            setExpandedPanel(
                elements.tablePanel,
                elements.tableExpandButton,
                state.tableExpanded,
                "Reduzir tabela",
                "Expandir tabela"
            );
        }
    );

    document.addEventListener(
        "keydown",
        function (event) {
            if (event.key !== "Escape") {
                return;
            }

            if (state.hierarchyExpanded) {
                state.hierarchyExpanded = false;

                setExpandedPanel(
                    elements.hierarchyPanel,
                    elements.hierarchyExpandButton,
                    false,
                    "Reduzir estrutura",
                    "Expandir estrutura"
                );
            }

            if (state.tableExpanded) {
                state.tableExpanded = false;

                setExpandedPanel(
                    elements.tablePanel,
                    elements.tableExpandButton,
                    false,
                    "Reduzir tabela",
                    "Expandir tabela"
                );
            }
        }
    );

    var themeObserver =
        new MutationObserver(function () {
            if (state.filteredRows.length) {
                renderCharts();
            }
        });

    themeObserver.observe(
        document.documentElement,
        {
            attributes: true,
            attributeFilter: ["data-theme"]
        }
    );

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            function () {
                loadDashboard(false);
            }
        );
    } else {
        loadDashboard(false);
    }
})();
