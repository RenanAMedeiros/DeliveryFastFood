(function () {
    "use strict";

    document.addEventListener("DOMContentLoaded", function () {
        const select =
            document.getElementById("automaticWalletSelect");

        const status =
            document.getElementById("automaticWalletStatus");

        const fields = {
            meta: document.getElementById("metaField"),
            tipo: document.getElementById("tipoField"),
            producao: document.getElementById("producaoField"),
            superintendente:
                document.getElementById("superintendenteField"),
            gerente: document.getElementById("gerenteField"),
            coordenador:
                document.getElementById("coordenadorField")
        };

        const dataNode =
            document.getElementById("productionAutomaticData");

        const auditFields = {
            sentBy: document.getElementById("detailSentByValue"),
            start: document.getElementById("detailStartValue"),
            end: document.getElementById("detailEndValue"),
            updated: document.getElementById("detailUpdatedValue")
        };

        let automaticData = [];

        if (dataNode) {
            try {
                automaticData =
                    JSON.parse(dataNode.textContent || "[]");
            } catch (error) {
                automaticData = [];
            }
        }

        function showAutomatic(index) {
            const item =
                automaticData[Number(index)] ||
                automaticData[0];

            if (!item) {
                return;
            }

            Object.keys(fields).forEach(function (key) {
                if (fields[key]) {
                    fields[key].value =
                        item[key] ||
                        "Não cadastrado";
                }
            });

            if (status) {
                status.innerHTML = "";

                const strong =
                    document.createElement("strong");

                strong.textContent =
                    `${item.empresa_nome} — ${item.carteira_nome}`;

                status.appendChild(strong);
                status.appendChild(
                    document.createTextNode(
                        "Informações automáticas da carteira selecionada."
                    )
                );
            }
        }

        if (select) {
            select.addEventListener("change", function () {
                showAutomatic(this.value);
            });

            if (select.options.length) {
                showAutomatic(select.value || "0");
            }
        }


        function setAuditValue(element, value) {
            if (!element) {
                return;
            }

            const normalized = String(value || "").trim();

            if (!normalized || normalized === "-") {
                element.textContent = "Não informado";
                element.classList.add("is-empty");
                return;
            }

            element.textContent = normalized;
            element.classList.remove("is-empty");
        }

        window.addEventListener(
            "message",
            function (event) {
                if (
                    !event.data ||
                    event.data.type !==
                        "qore-production-send-audit"
                ) {
                    return;
                }

                setAuditValue(
                    auditFields.sentBy,
                    event.data.sentBy
                );
                setAuditValue(
                    auditFields.start,
                    event.data.start
                );
                setAuditValue(
                    auditFields.end,
                    event.data.end
                );
                setAuditValue(
                    auditFields.updated,
                    event.data.updated
                );
            }
        );

        function showWorkspaceLoading(title, description) {
            if (
                typeof window.showWorkspaceLoading !== "function"
            ) {
                return;
            }

            window.showWorkspaceLoading(
                title,
                description
            );
        }

        function closeDetail() {
            if (window.parent !== window) {
                window.parent.postMessage(
                    {
                        type: "qore-close-production-detail"
                    },
                    "*"
                );
                return;
            }

            showWorkspaceLoading(
                "Carregando histórico",
                "Retornando aos envios de produção..."
            );

            window.location.href =
                "/meus_envios_producao/";
        }

        const backButton =
            document.getElementById("detailBackButton");

        const closeButton =
            document.getElementById("closeDetailButton");

        if (backButton) {
            backButton.addEventListener(
                "click",
                closeDetail
            );
        }

        if (closeButton) {
            closeButton.addEventListener(
                "click",
                closeDetail
            );
        }
    });
})();
