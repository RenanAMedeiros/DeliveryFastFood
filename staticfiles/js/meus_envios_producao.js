/* QORE meus_envios_producao v2.16.0 — UI Core + scroll horizontal sincronizado + regras existentes preservadas */
(function () {
    "use strict";

    document.addEventListener("DOMContentLoaded", function () {
        const body = document.body;

        const panel =
            document.getElementById(
                "productionDetailPanel"
            );

        const detailBackdrop =
            document.getElementById(
                "productionDetailBackdrop"
            );

        const closeButton =
            document.getElementById(
                "productionDetailClose"
            );

        const frame =
            document.getElementById(
                "productionDetailFrame"
            );

        const loading =
            document.getElementById(
                "productionDetailLoading"
            );

        const workspaceHeader =
            document.querySelector(
                ".workspace-header"
            );

        const tableWrapper =
            document.querySelector(
                ".qore-history-table-wrapper"
            );


        const tableHorizontalScroll =
            document.getElementById(
                "historyTableHorizontalScroll"
            );

        const tableHorizontalScrollSpacer =
            document.getElementById(
                "historyTableHorizontalScrollSpacer"
            );

        const rows = Array.from(
            document.querySelectorAll(
                ".qore-history-row-clickable"
            )
        );

        const filters = {
            dateStart:
                document.getElementById(
                    "historyFilterDateStart"
                ),
            dateEnd:
                document.getElementById(
                    "historyFilterDateEnd"
                ),
            superintendent:
                document.getElementById(
                    "historyFilterSuperintendent"
                ),
            sender:
                document.getElementById(
                    "historyFilterSender"
                ),
            type:
                document.getElementById(
                    "historyFilterType"
                ),
            wallet:
                document.getElementById(
                    "historyFilterWallet"
                )
        };

        const clearFiltersButton =
            document.getElementById(
                "historyClearFilters"
            );

        const newRequestButton =
            document.getElementById(
                "historyNewRequestButton"
            );

        const backToProductionButton =
            document.querySelector(
                ".qore-page-back"
            );

        const visibleCount =
            document.getElementById(
                "historyVisibleCount"
            );

        const filterEmpty =
            document.getElementById(
                "historyFilterEmpty"
            );

        const cards = {
            totalEnvios:
                document.getElementById(
                    "historyCardTotalEnvios"
                ),
            ultimaProducao:
                document.getElementById(
                    "historyCardUltimaProducao"
                ),
            totalProducao:
                document.getElementById(
                    "historyCardTotalProducao"
                ),
            totalPagamento:
                document.getElementById(
                    "historyCardTotalPagamento"
                )
        };

        const walletHoverCard =
            document.getElementById(
                "historyWalletHoverCard"
            );


        const monthlySendBars =
            document.getElementById(
                "historyMonthlySendBars"
            );

        const monthlySendCaption =
            document.getElementById(
                "historyMonthlySendCaption"
            );

        const monthlyLastDay =
            document.getElementById(
                "historyMonthlyLastDay"
            );

        const pagination = {
            root:
                document.getElementById(
                    "historyPagination"
                ),
            summary:
                document.getElementById(
                    "historyPaginationSummary"
                ),
            numbers:
                document.getElementById(
                    "historyPageNumbers"
                ),
            previous:
                document.getElementById(
                    "historyPagePrevious"
                ),
            next:
                document.getElementById(
                    "historyPageNext"
                )
        };

        const PAGE_SIZE = 20;

        let activeRow = null;
        let currentPage = 1;
        let filteredRows = [];

        function showGlobalLoading(title, description) {
            if (
                typeof window.showWorkspaceLoading !==
                "function"
            ) {
                return;
            }

            window.showWorkspaceLoading(
                title || "Carregando informações",
                description ||
                    "Aguarde enquanto preparamos os dados..."
            );
        }

        function normalizeText(value) {
            return String(value || "")
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toLowerCase()
                .trim();
        }

        function parseDecimal(value) {
            const parsed =
                Number.parseFloat(
                    String(value || "0")
                        .replace(",", ".")
                );

            return Number.isFinite(parsed)
                ? parsed
                : 0;
        }

        function formatCurrency(value) {
            return new Intl.NumberFormat(
                "pt-BR",
                {
                    style: "currency",
                    currency: "BRL"
                }
            ).format(value || 0);
        }

        function formatDateBr(isoDate) {
            if (!isoDate) {
                return "-";
            }

            const parts =
                String(isoDate).split("-");

            if (parts.length !== 3) {
                return isoDate;
            }

            return (
                `${parts[2]}/` +
                `${parts[1]}/` +
                `${parts[0]}`
            );
        }

        function renderMonthlySendActivity() {
            if (!monthlySendBars) {
                return;
            }

            const card =
                monthlySendBars.closest(
                    ".qore-history-summary-card--tooltip"
                );

            const monthRef =
                String(
                    card?.dataset?.currentMonth || ""
                ).trim();

            const match =
                monthRef.match(/^(\d{2})\/(\d{4})$/);

            if (!match) {
                monthlySendBars.innerHTML = "";

                if (monthlySendCaption) {
                    monthlySendCaption.textContent =
                        "Sem referência mensal";
                }

                return;
            }

            const month = Number(match[1]);
            const year = Number(match[2]);
            const daysInMonth =
                new Date(year, month, 0).getDate();

            const counts =
                Array.from(
                    { length: daysInMonth },
                    function () {
                        return 0;
                    }
                );

            rows.forEach(function (row) {
                const isoDate =
                    String(
                        row.dataset.date || ""
                    );

                const parts =
                    isoDate.split("-");

                if (parts.length !== 3) {
                    return;
                }

                const rowYear =
                    Number(parts[0]);
                const rowMonth =
                    Number(parts[1]);
                const rowDay =
                    Number(parts[2]);

                if (
                    rowYear !== year ||
                    rowMonth !== month ||
                    rowDay < 1 ||
                    rowDay > daysInMonth
                ) {
                    return;
                }

                counts[rowDay - 1] += 1;
            });

            const maxCount =
                Math.max(1, ...counts);

            const activeDays =
                counts.filter(function (count) {
                    return count > 0;
                }).length;

            const peakCount =
                Math.max(0, ...counts);

            const peakDayIndex =
                peakCount > 0
                    ? counts.indexOf(peakCount)
                    : -1;

            monthlySendBars.innerHTML = "";
            monthlySendBars.style.setProperty(
                "--qore-month-days",
                String(daysInMonth)
            );

            counts.forEach(function (count, index) {
                const bar =
                    document.createElement("span");

                const height =
                    count > 0
                        ? Math.max(
                            16,
                            Math.round(
                                (count / maxCount) * 100
                            )
                        )
                        : 7;

                bar.className =
                    "qore-history-monthly-bar";

                if (count > 0) {
                    bar.classList.add("is-active");
                }

                bar.style.setProperty(
                    "--qore-month-bar-height",
                    `${height}%`
                );

                bar.setAttribute(
                    "aria-label",
                    `Dia ${index + 1}: ${count} ${
                        count === 1
                            ? "envio"
                            : "envios"
                    }`
                );

                bar.title =
                    `Dia ${index + 1}: ${count} ${
                        count === 1
                            ? "envio"
                            : "envios"
                    }`;

                monthlySendBars.appendChild(bar);
            });

            if (monthlyLastDay) {
                monthlyLastDay.textContent =
                    String(daysInMonth);
            }

            if (monthlySendCaption) {
                if (!activeDays) {
                    monthlySendCaption.textContent =
                        "Nenhum dia com envio";
                } else {
                    monthlySendCaption.textContent =
                        `${activeDays} ${
                            activeDays === 1
                                ? "dia ativo"
                                : "dias ativos"
                        } • pico dia ${peakDayIndex + 1}: ${peakCount}`;
                }
            }
        }

        function detailUrlWithEmbed(url) {
            if (!url) {
                return "";
            }

            return url.includes("?")
                ? `${url}&embed=1`
                : `${url}?embed=1`;
        }

        function updateNavbarOffset() {
            const headerHeight =
                workspaceHeader
                    ? Math.ceil(
                        workspaceHeader
                            .getBoundingClientRect()
                            .height
                    )
                    : 0;

            document.documentElement
                .style
                .setProperty(
                    "--qore-history-navbar-height",
                    `${headerHeight}px`
                );
        }


        function updateTableHorizontalScroll() {
            if (
                !tableWrapper ||
                !tableHorizontalScroll ||
                !tableHorizontalScrollSpacer
            ) {
                return;
            }

            const table =
                tableWrapper.querySelector(
                    ".qore-history-table"
                );

            if (!table) {
                tableHorizontalScroll.hidden = true;
                return;
            }

            const scrollWidth =
                Math.max(
                    table.scrollWidth,
                    tableWrapper.scrollWidth
                );

            const clientWidth =
                tableWrapper.clientWidth;

            tableHorizontalScrollSpacer.style.width =
                `${scrollWidth}px`;

            const needsHorizontalScroll =
                scrollWidth > clientWidth + 2;

            tableHorizontalScroll.hidden =
                !needsHorizontalScroll;

            if (!needsHorizontalScroll) {
                tableWrapper.scrollLeft = 0;
                tableHorizontalScroll.scrollLeft = 0;
                return;
            }

            if (
                Math.abs(
                    tableHorizontalScroll.scrollLeft -
                    tableWrapper.scrollLeft
                ) > 1
            ) {
                tableHorizontalScroll.scrollLeft =
                    tableWrapper.scrollLeft;
            }
        }

        function syncTableFromHorizontalBar() {
            if (
                !tableWrapper ||
                !tableHorizontalScroll
            ) {
                return;
            }

            if (
                Math.abs(
                    tableWrapper.scrollLeft -
                    tableHorizontalScroll.scrollLeft
                ) > 1
            ) {
                tableWrapper.scrollLeft =
                    tableHorizontalScroll.scrollLeft;
            }
        }

        function syncHorizontalBarFromTable() {
            if (
                !tableWrapper ||
                !tableHorizontalScroll
            ) {
                return;
            }

            if (
                Math.abs(
                    tableHorizontalScroll.scrollLeft -
                    tableWrapper.scrollLeft
                ) > 1
            ) {
                tableHorizontalScroll.scrollLeft =
                    tableWrapper.scrollLeft;
            }
        }

        function setSelectedRow(row) {
            rows.forEach(function (candidate) {
                candidate.classList.toggle(
                    "is-selected",
                    candidate === row
                );
            });

            activeRow = row;
        }

        function sendProductionAuditToFrame(row) {
            if (
                !row ||
                !frame ||
                !frame.contentWindow ||
                row.dataset.type !== "envio-producao"
            ) {
                return;
            }

            frame.contentWindow.postMessage(
                {
                    type: "qore-production-send-audit",
                    sentBy: row.dataset.senderName || "-",
                    start: row.dataset.startDatetime || "-",
                    end: row.dataset.endDatetime || "-",
                    updated: row.dataset.updatedDatetime || "-"
                },
                "*"
            );
        }

        function openPanel(row) {
            const url =
                row?.dataset?.detailUrl;

            if (!url || !panel || !frame) {
                return;
            }

            updateNavbarOffset();
            setSelectedRow(row);

            /*
             * O detalhe é exibido sobre o histórico, em um overlay central.
             * A lista permanece intacta por baixo e não sofre redimensionamento.
             */
            body.classList.remove(
                "qore-detail-open",
                "qore-detail-meta",
                "qore-detail-production"
            );

            loading?.classList.remove(
                "is-hidden"
            );

            frame.classList.remove(
                "is-ready"
            );

            frame.src =
                detailUrlWithEmbed(url);

            requestAnimationFrame(
                function () {
                    panel.classList.add(
                        "is-open"
                    );

                    panel.setAttribute(
                        "aria-hidden",
                        "false"
                    );

                    body.classList.add(
                        "qore-detail-overlay-open"
                    );

                    detailBackdrop?.classList.add(
                        "is-visible"
                    );

                    detailBackdrop?.setAttribute(
                        "aria-hidden",
                        "false"
                    );
                }
            );
        }

        function closePanel() {
            if (!panel || !frame) {
                return;
            }

            panel.classList.remove(
                "is-open"
            );

            panel.setAttribute(
                "aria-hidden",
                "true"
            );

            body.classList.remove(
                "qore-detail-open",
                "qore-detail-meta",
                "qore-detail-production",
                "qore-detail-overlay-open"
            );

            detailBackdrop?.classList.remove(
                "is-visible"
            );

            detailBackdrop?.setAttribute(
                "aria-hidden",
                "true"
            );

            rows.forEach(function (row) {
                row.classList.remove(
                    "is-selected"
                );
            });

            activeRow = null;

            window.setTimeout(
                function () {
                    if (
                        !panel.classList.contains(
                            "is-open"
                        )
                    ) {
                        frame.src = "about:blank";

                        frame.classList.remove(
                            "is-ready"
                        );

                        loading?.classList.remove(
                            "is-hidden"
                        );
                    }
                },
                300
            );
        }

        function rowMatchesFilters(row) {
            const date =
                row.dataset.date || "";

            const superintendents =
                String(
                    row.dataset.superintendent || ""
                )
                    .split("|")
                    .map(function (value) {
                        return value.trim();
                    })
                    .filter(Boolean);

            const sender =
                row.dataset.sender || "";

            const type =
                row.dataset.type || "";

            const wallets =
                normalizeText(
                    row.dataset.walletsSearch
                );

            const dateStart =
                filters.dateStart?.value || "";

            const dateEnd =
                filters.dateEnd?.value || "";

            const selectedSuperintendent =
                filters.superintendent?.value || "";

            const selectedSender =
                filters.sender?.value || "";

            const selectedType =
                filters.type?.value || "";

            const walletSearch =
                normalizeText(
                    filters.wallet?.value
                );

            if (
                dateStart &&
                date < dateStart
            ) {
                return false;
            }

            if (
                dateEnd &&
                date > dateEnd
            ) {
                return false;
            }

            if (
                selectedSuperintendent &&
                !superintendents.includes(
                    selectedSuperintendent
                )
            ) {
                return false;
            }

            if (
                selectedSender &&
                sender !== selectedSender
            ) {
                return false;
            }

            if (
                selectedType &&
                type !== selectedType
            ) {
                return false;
            }

            if (
                walletSearch &&
                !wallets.includes(
                    walletSearch
                )
            ) {
                return false;
            }

            return true;
        }

        function updateCards(visibleRows) {
            /*
             * Total de Envios, Total Produção e Total Pagamento são
             * indicadores fixos do MÊS ATUAL calculados no backend.
             * Os filtros da tabela não alteram esses três cards.
             *
             * A Última Produção continua reagindo aos filtros para
             * manter contexto durante a navegação no histórico.
             */
            const totalFiltrados = visibleRows.length;
            let latestDate = "";

            visibleRows.forEach(function (row) {
                const date = row.dataset.date || "";

                if (
                    !latestDate ||
                    date > latestDate
                ) {
                    latestDate = date;
                }
            });

            if (cards.ultimaProducao) {
                cards.ultimaProducao.textContent =
                    latestDate
                        ? formatDateBr(latestDate)
                        : "-";
            }

            if (visibleCount) {
                visibleCount.textContent =
                    `${totalFiltrados} ${
                        totalFiltrados === 1
                            ? "registro"
                            : "registros"
                    }`;
            }
        }

        function getTotalPages() {
            return Math.max(
                1,
                Math.ceil(
                    filteredRows.length /
                    PAGE_SIZE
                )
            );
        }

        function getVisiblePageNumbers(
            current,
            total
        ) {
            if (total <= 7) {
                return Array.from(
                    { length: total },
                    function (_, index) {
                        return index + 1;
                    }
                );
            }

            const result = [1];

            const start =
                Math.max(
                    2,
                    current - 1
                );

            const end =
                Math.min(
                    total - 1,
                    current + 1
                );

            if (start > 2) {
                result.push("...");
            }

            for (
                let page = start;
                page <= end;
                page += 1
            ) {
                result.push(page);
            }

            if (end < total - 1) {
                result.push("...");
            }

            result.push(total);

            return result;
        }

        function createPageButton(page) {
            const button =
                document.createElement(
                    "button"
                );

            button.type = "button";

            button.className =
                "qore-history-page-button";

            button.textContent =
                String(page);

            button.setAttribute(
                "aria-label",
                `Ir para a página ${page}`
            );

            if (page === currentPage) {
                button.classList.add(
                    "is-active"
                );

                button.setAttribute(
                    "aria-current",
                    "page"
                );
            }

            button.addEventListener(
                "click",
                function () {
                    goToPage(page);
                }
            );

            return button;
        }

        function renderPaginationControls() {
            if (!pagination.root) {
                return;
            }

            const total =
                filteredRows.length;

            const totalPages =
                getTotalPages();

            pagination.root.hidden =
                total === 0;

            if (total === 0) {
                return;
            }

            const firstIndex =
                (currentPage - 1) *
                PAGE_SIZE;

            const start =
                firstIndex + 1;

            const end =
                Math.min(
                    firstIndex + PAGE_SIZE,
                    total
                );

            if (pagination.summary) {
                pagination.summary.textContent =
                    `Mostrando ${start}–${end} de ${total}`;
            }

            if (pagination.previous) {
                pagination.previous.disabled =
                    currentPage <= 1;
            }

            if (pagination.next) {
                pagination.next.disabled =
                    currentPage >= totalPages;
            }

            if (!pagination.numbers) {
                return;
            }

            pagination.numbers.innerHTML =
                "";

            getVisiblePageNumbers(
                currentPage,
                totalPages
            ).forEach(
                function (page) {
                    if (page === "...") {
                        const ellipsis =
                            document.createElement(
                                "span"
                            );

                        ellipsis.className =
                            "qore-history-page-ellipsis";

                        ellipsis.textContent =
                            "…";

                        pagination.numbers
                            .appendChild(
                                ellipsis
                            );

                        return;
                    }

                    pagination.numbers
                        .appendChild(
                            createPageButton(
                                page
                            )
                        );
                }
            );
        }

        function renderCurrentPage() {
            const totalPages =
                getTotalPages();

            if (currentPage > totalPages) {
                currentPage =
                    totalPages;
            }

            if (currentPage < 1) {
                currentPage = 1;
            }

            rows.forEach(function (row) {
                row.hidden = true;
            });

            if (
                filteredRows.length === 0
            ) {
                if (filterEmpty) {
                    filterEmpty.hidden =
                        false;
                }

                renderPaginationControls();

                return;
            }

            if (filterEmpty) {
                filterEmpty.hidden = true;
            }

            const start =
                (currentPage - 1) *
                PAGE_SIZE;

            const end =
                start + PAGE_SIZE;

            filteredRows
                .slice(start, end)
                .forEach(
                    function (row) {
                        row.hidden = false;
                    }
                );

            renderPaginationControls();

            /*
               Ao trocar de página, volta o scroll
               somente da tabela para o topo.
            */
            if (tableWrapper) {
                tableWrapper.scrollTop = 0;
            }
        }

        function goToPage(page) {
            const totalPages =
                getTotalPages();

            const target =
                Math.min(
                    Math.max(
                        Number(page) || 1,
                        1
                    ),
                    totalPages
                );

            if (target === currentPage) {
                return;
            }

            currentPage = target;

            hideWalletTooltip();
            renderCurrentPage();

            if (
                activeRow &&
                activeRow.hidden
            ) {
                closePanel();
            }
        }

        function applyFilters() {
            filteredRows =
                rows.filter(
                    rowMatchesFilters
                );

            /*
               Cards consideram TODOS os registros
               filtrados, não apenas a página atual.
            */
            updateCards(filteredRows);

            currentPage = 1;

            renderCurrentPage();

            if (
                activeRow &&
                !filteredRows.includes(
                    activeRow
                )
            ) {
                closePanel();
            }

            hideWalletTooltip();
        }

        function clearFilters() {
            Object.values(filters)
                .forEach(function (field) {
                    if (field) {
                        field.value = "";
                    }
                });

            applyFilters();
        }

        function positionWalletTooltip(
            badge
        ) {
            if (!walletHoverCard) {
                return;
            }

            const rect =
                badge.getBoundingClientRect();

            const tooltipRect =
                walletHoverCard
                    .getBoundingClientRect();

            const gap = 8;

            let left = rect.left;

            if (
                left + tooltipRect.width >
                window.innerWidth - 12
            ) {
                left =
                    window.innerWidth -
                    tooltipRect.width -
                    12;
            }

            left = Math.max(
                12,
                left
            );

            let top =
                rect.bottom + gap;

            if (
                top + tooltipRect.height >
                window.innerHeight - 12
            ) {
                top =
                    rect.top -
                    tooltipRect.height -
                    gap;
            }

            walletHoverCard.style.left =
                `${left}px`;

            walletHoverCard.style.top =
                `${Math.max(12, top)}px`;
        }

        function showWalletTooltip(
            badge
        ) {
            if (!walletHoverCard) {
                return;
            }

            const text =
                badge.dataset.wallets || "";

            if (!text.trim()) {
                return;
            }

            walletHoverCard.textContent =
                text;

            walletHoverCard.classList.add(
                "is-visible"
            );

            walletHoverCard.setAttribute(
                "aria-hidden",
                "false"
            );

            positionWalletTooltip(
                badge
            );
        }

        function hideWalletTooltip() {
            if (!walletHoverCard) {
                return;
            }

            walletHoverCard.classList.remove(
                "is-visible"
            );

            walletHoverCard.setAttribute(
                "aria-hidden",
                "true"
            );
        }

        rows.forEach(function (row) {
            row.addEventListener(
                "click",
                function (event) {
                    if (
                        event.target.closest(
                            "a, button, .qore-history-wallet-badge"
                        )
                    ) {
                        return;
                    }

                    openPanel(row);
                }
            );

            row.addEventListener(
                "keydown",
                function (event) {
                    if (
                        event.key !== "Enter" &&
                        event.key !== " "
                    ) {
                        return;
                    }

                    event.preventDefault();
                    openPanel(row);
                }
            );
        });

        document
            .querySelectorAll(
                ".qore-history-wallet-badge[data-wallets]"
            )
            .forEach(function (badge) {
                badge.addEventListener(
                    "mouseenter",
                    function () {
                        showWalletTooltip(
                            badge
                        );
                    }
                );

                badge.addEventListener(
                    "mouseleave",
                    hideWalletTooltip
                );

                badge.addEventListener(
                    "focus",
                    function () {
                        showWalletTooltip(
                            badge
                        );
                    }
                );

                badge.addEventListener(
                    "blur",
                    hideWalletTooltip
                );
            });

        tableHorizontalScroll
            ?.addEventListener(
                "scroll",
                syncTableFromHorizontalBar,
                {
                    passive: true
                }
            );

        tableWrapper
            ?.addEventListener(
                "scroll",
                syncHorizontalBarFromTable,
                {
                    passive: true
                }
            );

        if (
            typeof ResizeObserver === "function" &&
            tableWrapper
        ) {
            const tableResizeObserver =
                new ResizeObserver(
                    function () {
                        updateTableHorizontalScroll();
                    }
                );

            tableResizeObserver.observe(
                tableWrapper
            );

            const historyTable =
                tableWrapper.querySelector(
                    ".qore-history-table"
                );

            if (historyTable) {
                tableResizeObserver.observe(
                    historyTable
                );
            }
        }

        Object.values(filters)
            .forEach(function (field) {
                if (!field) {
                    return;
                }

                field.addEventListener(
                    field.tagName === "INPUT"
                        ? "input"
                        : "change",
                    applyFilters
                );
            });

        clearFiltersButton
            ?.addEventListener(
                "click",
                clearFilters
            );

        newRequestButton
            ?.addEventListener(
                "click",
                function (event) {
                    event.preventDefault();
                    event.stopPropagation();

                    /*
                     * O modal já é carregado pela navbar através de
                     * _nova_solicitacao_modal.html. Reutilizamos a mesma
                     * função global para garantir exatamente o mesmo fluxo.
                     * Como a ação é apenas visual/local, não utilizamos
                     * overlay de carregamento.
                     */
                    if (
                        typeof window
                            .openTaskflowRequestModal ===
                            "function"
                    ) {
                        window
                            .openTaskflowRequestModal();
                    }
                }
            );

        backToProductionButton
            ?.addEventListener(
                "click",
                function (event) {
                    if (
                        event.defaultPrevented ||
                        event.ctrlKey ||
                        event.metaKey ||
                        event.shiftKey ||
                        event.altKey ||
                        this.target === "_blank"
                    ) {
                        return;
                    }

                    showGlobalLoading(
                        "Carregando envio de produção",
                        "Preparando o formulário e as informações disponíveis..."
                    );
                }
            );

        pagination.previous
            ?.addEventListener(
                "click",
                function () {
                    goToPage(
                        currentPage - 1
                    );
                }
            );

        pagination.next
            ?.addEventListener(
                "click",
                function () {
                    goToPage(
                        currentPage + 1
                    );
                }
            );

        frame?.addEventListener(
            "load",
            function () {
                if (
                    frame.src ===
                    "about:blank"
                ) {
                    return;
                }

                loading?.classList.add(
                    "is-hidden"
                );

                frame.classList.add(
                    "is-ready"
                );

                sendProductionAuditToFrame(
                    activeRow
                );
            }
        );

        closeButton
            ?.addEventListener(
                "click",
                closePanel
            );

        detailBackdrop
            ?.addEventListener(
                "click",
                closePanel
            );

        document.addEventListener(
            "keydown",
            function (event) {
                if (
                    event.key === "Escape" &&
                    panel?.classList.contains(
                        "is-open"
                    )
                ) {
                    closePanel();
                }
            }
        );

        window.addEventListener(
            "resize",
            function () {
                updateNavbarOffset();
                updateTableHorizontalScroll();
                hideWalletTooltip();
            }
        );

        window.addEventListener(
            "scroll",
            hideWalletTooltip,
            true
        );

        window.addEventListener(
            "message",
            function (event) {
                if (!event.data) {
                    return;
                }

                if (
                    frame &&
                    event.source !== frame.contentWindow
                ) {
                    return;
                }

                if (
                    event.data.type ===
                        "qore-close-production-detail"
                ) {
                    closePanel();
                    return;
                }

            }
        );

        /*
         * Se a página for restaurada pelo histórico/cache do navegador,
         * força uma nova leitura do backend para refletir exclusões feitas
         * diretamente no banco antes de retornar para Meus Envios.
         */
        window.addEventListener(
            "pageshow",
            function (event) {
                const navigationEntries =
                    typeof performance.getEntriesByType === "function"
                        ? performance.getEntriesByType("navigation")
                        : [];

                const navigationType =
                    navigationEntries.length
                        ? navigationEntries[0].type
                        : "";

                if (
                    event.persisted ||
                    navigationType === "back_forward"
                ) {
                    showGlobalLoading(
                        "Atualizando histórico",
                        "Sincronizando os envios mais recentes com o Workspace..."
                    );

                    window.requestAnimationFrame(
                        function () {
                            window.location.reload();
                        }
                    );
                }
            }
        );

        updateNavbarOffset();
        renderMonthlySendActivity();
        applyFilters();

        window.requestAnimationFrame(
            updateTableHorizontalScroll
        );
    });
})();
