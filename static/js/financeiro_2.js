(function () {
    "use strict";

    const PAGE_SIZE = 20;
    const SEARCH_DELAY = 350;

    const form = document.getElementById("financeiroFilterForm");
    const dataInicial = document.getElementById("financeiroDataInicial");
    const dataFinal = document.getElementById("financeiroDataFinal");
    const periodoSelecionado = document.getElementById("financeiroPeriodoSelecionado");
    const competenciaExibicao = document.getElementById("financeiroCompetenciaExibicao");
    const periodoDescricao = document.getElementById("financeiroPeriodoDescricao");
    const consultarButton = document.getElementById("financeiroConsultarButton");

    const ultimaSincronizacao =
        document.getElementById("financeiroUltimaSincronizacao");
    const ultimaSincronizacaoData =
        document.getElementById("financeiroUltimaSincronizacaoData");
    const ultimaSincronizacaoOrigem =
        document.getElementById("financeiroUltimaSincronizacaoOrigem");

    const consultaErro = document.getElementById("financeiroConsultaErro");
    const consultaErroTexto = document.getElementById("financeiroConsultaErroTexto");

    const totalRegistros = document.getElementById("financeiroTotalRegistros");
    const totalStatus200 = document.getElementById("financeiroTotalStatus200");
    const totalOutrosStatus = document.getElementById("financeiroTotalOutrosStatus");
    const totalFinanceiro = document.getElementById("financeiroTotalFinanceiro");
    const totalPeriodo = document.getElementById("financeiroTotalPeriodo");

    const baseGeral = document.getElementById("financeiroBaseGeral");
    const baseC6 = document.getElementById("financeiroBaseC6");
    const baseSantander = document.getElementById("financeiroBaseSantander");
    const errosBases = document.getElementById("financeiroErrosBases");

    const servicosBody = document.getElementById("financeiroServicosBody");

    const analiticoTitulo = document.getElementById("financeiroAnaliticoTitulo");
    const analiticoDescricao = document.getElementById("financeiroAnaliticoDescricao");
    const analiticoSearch = document.getElementById("financeiroAnaliticoSearch");
    const alternarRetornos = document.getElementById("financeiroAlternarRetornos");
    const alternarRetornosTexto = document.getElementById("financeiroAlternarRetornosTexto");
    const alternarRetornosQuantidade = document.getElementById("financeiroAlternarRetornosQuantidade");
    const analiticoBody = document.getElementById("financeiroAnaliticoBody");
    const analiticoContador = document.getElementById("financeiroAnaliticoContador");
    const analiticoPaginacao = document.getElementById("financeiroAnaliticoPaginacao");
    const sortButtons = Array.from(document.querySelectorAll(".financeiro-sort-button"));

    const sortColumns = {
        0: "ID_CONTR",
        1: "NOME_EMPRESA",
        2: "NOME_CARTEIRA",
        3: "DATA_CLASSE",
        4: "METODO",
        5: "ENTRADA",
        6: "STATUS_RETORNO",
        7: "EXCEPTION"
    };

    const state = {
        grupo: "success",
        pagina: 1,
        busca: "",
        ordenarPor: "DATA_CLASSE",
        direcao: "desc",
        totalStatus200: 0,
        totalErros: 0,
        controller: null,
        requestId: 0,
        searchTimer: null,
        cargaInicialIniciada: false
    };

    function formatarData(valor) {
        if (!valor) {
            return "";
        }

        const partes = valor.split("-");
        if (partes.length !== 3) {
            return valor;
        }

        return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }

    function formatarDataHora(valor) {
        if (!valor) {
            return "-";
        }

        const data = new Date(valor);
        if (Number.isNaN(data.getTime())) {
            return String(valor);
        }

        return new Intl.DateTimeFormat("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        }).format(data);
    }

    function formatarUltimaSincronizacao(valor) {
        if (!valor) {
            return "-";
        }

        const data = new Date(valor);

        if (Number.isNaN(data.getTime())) {
            return String(valor);
        }

        return new Intl.DateTimeFormat(
            "pt-BR",
            {
                timeZone: "America/Sao_Paulo",
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit"
            }
        ).format(data);
    }

    function rotuloOrigemSincronizacao(origem) {
        const valor =
            String(origem || "")
                .trim()
                .toLowerCase();

        if (valor === "agendamento") {
            return "Automática";
        }

        if (
            valor === "filtro_data" ||
            valor === "acesso"
        ) {
            return "Manual";
        }

        return "";
    }

    function atualizarUltimaSincronizacao(dados) {
        if (
            !ultimaSincronizacao ||
            !ultimaSincronizacaoData
        ) {
            return;
        }

        const sincronizacao =
            dados?.sincronizacao || {};

        const dataHora =
            sincronizacao
                .ultima_sincronizacao_sucesso ||
            sincronizacao
                .finalizado_em ||
            null;

        ultimaSincronizacaoData.textContent =
            formatarUltimaSincronizacao(
                dataHora
            );

        const origem =
            rotuloOrigemSincronizacao(
                sincronizacao
                    .origem_execucao
            );

        if (ultimaSincronizacaoOrigem) {
            if (origem) {
                ultimaSincronizacaoOrigem.textContent =
                    origem;

                ultimaSincronizacaoOrigem.hidden =
                    false;
            } else {
                ultimaSincronizacaoOrigem.textContent =
                    "";

                ultimaSincronizacaoOrigem.hidden =
                    true;
            }
        }

        ultimaSincronizacao.title =
            dataHora
                ? (
                    "Última sincronização concluída com sucesso em " +
                    formatarUltimaSincronizacao(
                        dataHora
                    ) +
                    (
                        origem
                            ? " - " + origem
                            : ""
                    )
                )
                : "Ainda não há sincronização concluída.";
    }

    function formatarInteiro(valor) {
        return new Intl.NumberFormat("pt-BR", {
            maximumFractionDigits: 0
        }).format(Number(valor || 0));
    }

    function formatarMoeda(valor) {
        return new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL"
        }).format(Number(valor || 0));
    }

    function textoSeguro(valor, fallback) {
        if (valor === null || valor === undefined || valor === "") {
            return fallback || "-";
        }

        const texto = String(valor).trim();

        if (
            texto === "b''" ||
            texto === 'b""'
        ) {
            return fallback || "-";
        }

        return texto;
    }

    function atualizarPeriodoVisual() {
        if (!periodoSelecionado) {
            return;
        }

        const inicio = dataInicial?.value || "";
        const fim = dataFinal?.value || "";

        if (inicio && fim) {
            periodoSelecionado.textContent = `${formatarData(inicio)} até ${formatarData(fim)}`;
        } else if (inicio) {
            periodoSelecionado.textContent = `A partir de ${formatarData(inicio)}`;
        } else if (fim) {
            periodoSelecionado.textContent = `Até ${formatarData(fim)}`;
        } else {
            periodoSelecionado.textContent = "Selecione as datas";
        }
    }

    function mostrarLoadingWorkspace(titulo, descricao) {
        if (typeof window.showWorkspaceLoading !== "function") {
            return;
        }

        /*
         * O Financeiro não cria mais estrutura, percentual ou animação
         * próprios. O componente global da navbar é a única fonte visual
         * de carregamento para toda a página.
         *
         * reset=true inicia uma nova etapa de progresso para a consulta
         * AJAX, evitando herdar o percentual da navegação que trouxe o
         * usuário até o Financeiro.
         */
        window.showWorkspaceLoading(
            titulo || "Carregando financeiro",
            descricao || "Consultando informações financeiras...",
            {
                reset: true,
                startProgress: 6
            }
        );
    }

    function ocultarLoadingWorkspace() {
        if (typeof window.hideWorkspaceLoading === "function") {
            window.hideWorkspaceLoading();
        }
    }

    function definirCarregando(ativo, titulo, descricao) {
        if (ativo) {
            mostrarLoadingWorkspace(
                titulo || "Carregando financeiro",
                descricao || "Consultando informações financeiras..."
            );
        } else {
            ocultarLoadingWorkspace();
        }

        if (consultarButton) {
            consultarButton.disabled = ativo;
            consultarButton.classList.toggle("is-loading", ativo);
        }
    }

    function finalizarCarregamento(requestId) {
        if (requestId !== state.requestId) {
            return;
        }

        /*
         * O componente global conclui o percentual em 100% e respeita
         * o tempo mínimo de exibição antes de ocultar o overlay.
         */
        definirCarregando(false);
    }

    function esconderErro() {
        if (consultaErro) {
            consultaErro.hidden = true;
        }
        if (consultaErroTexto) {
            consultaErroTexto.textContent = "";
        }
    }

    function mostrarErro(mensagem) {
        if (consultaErro) {
            consultaErro.hidden = false;
        }
        if (consultaErroTexto) {
            consultaErroTexto.textContent = mensagem || "Erro inesperado ao consultar os dados financeiros.";
        }
    }

    function renderizarErrosBases(erros) {
        if (!errosBases) {
            return;
        }

        errosBases.innerHTML = "";

        if (!Array.isArray(erros) || erros.length === 0) {
            errosBases.hidden = true;
            return;
        }

        errosBases.hidden = false;

        erros.forEach(function (erro) {
            const bloco = document.createElement("div");
            bloco.className = "financeiro-empty-state financeiro-base-error-item";

            const icon = document.createElement("span");
            icon.className = "financeiro-empty-icon";
            icon.innerHTML = '<i class="fa fa-exclamation-triangle" aria-hidden="true"></i>';

            const conteudo = document.createElement("div");
            const titulo = document.createElement("strong");
            const detalhe = document.createElement("p");

            titulo.textContent = textoSeguro(erro.base, "Base");
            detalhe.textContent = textoSeguro(erro.erro, "Falha ao consultar a base.");

            conteudo.appendChild(titulo);
            conteudo.appendChild(detalhe);
            bloco.appendChild(icon);
            bloco.appendChild(conteudo);
            errosBases.appendChild(bloco);
        });
    }

    function iconeServico(chave) {
        if (chave === "gravame") {
            return "fa-car";
        }
        if (chave === "precificador") {
            return "fa-line-chart";
        }
        if (chave === "rpa") {
            return "fa-cogs";
        }
        return "fa-map";
    }

    function renderizarServicos(servicos) {
        if (!servicosBody) {
            return;
        }

        servicosBody.innerHTML = "";

        if (!Array.isArray(servicos) || servicos.length === 0) {
            servicosBody.innerHTML = '<tr class="financeiro-table-empty-row"><td colspan="5">Nenhum dado financeiro disponível no período.</td></tr>';
            return;
        }

        servicos.forEach(function (item) {
            const tr = document.createElement("tr");

            const tdServico = document.createElement("td");
            const cell = document.createElement("div");
            cell.className = "financeiro-service-cell";

            const icon = document.createElement("span");
            icon.className = "financeiro-service-icon";
            icon.innerHTML = `<i class="fa ${iconeServico(item.chave)}" aria-hidden="true"></i>`;

            const info = document.createElement("div");
            const strong = document.createElement("strong");
            const small = document.createElement("small");
            strong.textContent = textoSeguro(item.servico);
            small.textContent = item.tipo === "mensalidade" ? "Mensalidade" : "Consulta por utilização";
            info.appendChild(strong);
            info.appendChild(small);
            cell.appendChild(icon);
            cell.appendChild(info);
            tdServico.appendChild(cell);

            const tdMetodo = document.createElement("td");
            const metodo = document.createElement("span");
            metodo.className = `financeiro-method${item.tipo === "mensalidade" ? " is-monthly" : ""}`;
            metodo.textContent = textoSeguro(item.metodo, "mensalidade");
            tdMetodo.appendChild(metodo);

            const tdQuantidade = document.createElement("td");
            tdQuantidade.className = "is-center";
            tdQuantidade.textContent = formatarInteiro(item.quantidade);

            const tdUnitario = document.createElement("td");
            tdUnitario.className = "is-right";
            tdUnitario.textContent = formatarMoeda(item.valor_unitario);

            const tdTotal = document.createElement("td");
            tdTotal.className = "is-right";
            const total = document.createElement("strong");
            total.textContent = formatarMoeda(item.valor_total);
            tdTotal.appendChild(total);

            tr.appendChild(tdServico);
            tr.appendChild(tdMetodo);
            tr.appendChild(tdQuantidade);
            tr.appendChild(tdUnitario);
            tr.appendChild(tdTotal);
            servicosBody.appendChild(tr);
        });
    }

    function criarCelula(valor, classe) {
        const td = document.createElement("td");
        if (classe) {
            td.className = classe;
        }
        td.textContent = textoSeguro(valor);
        return td;
    }

    function renderizarRegistros(registros) {
        if (!analiticoBody) {
            return;
        }

        analiticoBody.innerHTML = "";

        if (!Array.isArray(registros) || registros.length === 0) {
            analiticoBody.innerHTML = '<tr class="financeiro-table-empty-row"><td colspan="8">Nenhum registro encontrado para os filtros informados.</td></tr>';
            return;
        }

        registros.forEach(function (registro) {
            const tr = document.createElement("tr");
            tr.dataset.financeiroRow = "";
            tr.dataset.statusGroup = state.grupo;

            tr.appendChild(criarCelula(registro.ID_CONTR));
            tr.appendChild(criarCelula(registro.NOME_EMPRESA));
            tr.appendChild(criarCelula(registro.NOME_CARTEIRA));
            tr.appendChild(criarCelula(formatarDataHora(registro.DATA_CLASSE)));

            const tdMetodo = document.createElement("td");
            const metodo = document.createElement("span");
            metodo.className = "financeiro-method";
            metodo.textContent = textoSeguro(registro.METODO);
            tdMetodo.appendChild(metodo);
            tr.appendChild(tdMetodo);

            tr.appendChild(criarCelula(registro.ENTRADA));

            const tdStatus = criarCelula(registro.STATUS_RETORNO, "is-center");
            const statusStrong = document.createElement("strong");
            statusStrong.textContent = textoSeguro(registro.STATUS_RETORNO);
            tdStatus.textContent = "";
            tdStatus.appendChild(statusStrong);
            tr.appendChild(tdStatus);

            const tdException = document.createElement("td");
            tdException.className = "financeiro-exception-cell";
            const exception = document.createElement("span");
            const erro = state.grupo === "error";
            exception.className = `financeiro-exception-status ${erro ? "is-error" : "is-ok"}`;
            exception.title = textoSeguro(registro.EXCEPTION, erro ? "Sem EXCEPTION retornado" : "OK");
            exception.innerHTML = `<i class="fa ${erro ? "fa-exclamation-circle" : "fa-check"}" aria-hidden="true"></i>`;
            exception.appendChild(document.createTextNode(` ${textoSeguro(registro.EXCEPTION, erro ? "-" : "OK")}`));
            tdException.appendChild(exception);
            tr.appendChild(tdException);

            analiticoBody.appendChild(tr);
        });
    }

    function criarBotaoPagina(label, pagina, options) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.disabled = Boolean(options?.disabled);
        if (options?.active) {
            button.classList.add("is-active");
        }
        button.addEventListener("click", function () {
            if (button.disabled || pagina === state.pagina) {
                return;
            }
            state.pagina = pagina;
            carregarDados();
        });
        return button;
    }

    function renderizarPaginacao(paginacao) {
        if (!analiticoPaginacao) {
            return;
        }

        analiticoPaginacao.innerHTML = "";

        const atual = Number(paginacao?.pagina || 1);
        const total = Number(paginacao?.total_paginas || 1);

        analiticoPaginacao.appendChild(
            criarBotaoPagina("‹", Math.max(1, atual - 1), { disabled: atual <= 1 })
        );

        const paginas = new Set([1, total]);
        for (let p = atual - 2; p <= atual + 2; p += 1) {
            if (p >= 1 && p <= total) {
                paginas.add(p);
            }
        }

        let anterior = null;
        Array.from(paginas).sort(function (a, b) { return a - b; }).forEach(function (pagina) {
            if (anterior !== null && pagina - anterior > 1) {
                const reticencias = document.createElement("span");
                reticencias.className = "financeiro-pagination-ellipsis";
                reticencias.textContent = "…";
                analiticoPaginacao.appendChild(reticencias);
            }

            analiticoPaginacao.appendChild(
                criarBotaoPagina(String(pagina), pagina, { active: pagina === atual })
            );
            anterior = pagina;
        });

        analiticoPaginacao.appendChild(
            criarBotaoPagina("›", Math.min(total, atual + 1), { disabled: atual >= total })
        );
    }

    function atualizarOrdenacaoVisual() {
        sortButtons.forEach(function (button) {
            const index = Number(button.dataset.sortIndex);
            const coluna = sortColumns[index];
            const ativo = coluna === state.ordenarPor;
            const icon = button.querySelector("i");

            button.classList.toggle("is-active", ativo);

            if (icon) {
                icon.className = ativo
                    ? `fa ${state.direcao === "asc" ? "fa-sort-asc" : "fa-sort-desc"}`
                    : "fa fa-sort";
            }
        });
    }

    function atualizarToggle() {
        if (!alternarRetornos) {
            return;
        }

        const mostrandoErros = state.grupo === "error";
        alternarRetornos.dataset.mode = state.grupo;
        alternarRetornos.classList.toggle("is-showing-errors", mostrandoErros);

        if (alternarRetornosTexto) {
            alternarRetornosTexto.textContent = mostrandoErros ? "Ver válidos" : "Ver erros";
        }
        if (alternarRetornosQuantidade) {
            alternarRetornosQuantidade.textContent = formatarInteiro(
                mostrandoErros ? state.totalStatus200 : state.totalErros
            );
        }
        if (analiticoTitulo) {
            analiticoTitulo.textContent = mostrandoErros ? "Retornos com erro" : "Retornos válidos";
        }
        if (analiticoDescricao) {
            analiticoDescricao.textContent = mostrandoErros
                ? `Registros com STATUS_RETORNO diferente de 200. A tabela exibe ${PAGE_SIZE} linhas por página.`
                : `Registros com STATUS_RETORNO = 200. A tabela exibe ${PAGE_SIZE} linhas por página.`;
        }
    }

    function renderizarResumo(dados) {
        state.totalStatus200 = Number(dados.total_status_200 || 0);
        state.totalErros = Number(dados.total_outros_status || 0);

        if (totalRegistros) totalRegistros.textContent = formatarInteiro(dados.total_registros);
        if (totalStatus200) totalStatus200.textContent = formatarInteiro(dados.total_status_200);
        if (totalOutrosStatus) totalOutrosStatus.textContent = formatarInteiro(dados.total_outros_status);
        if (totalFinanceiro) totalFinanceiro.textContent = formatarMoeda(dados.total_financeiro);
        if (totalPeriodo) totalPeriodo.textContent = formatarMoeda(dados.total_financeiro);

        const resumo = dados.resumo_bases || {};
        if (baseGeral) baseGeral.textContent = formatarInteiro(resumo.base_geral);
        if (baseC6) baseC6.textContent = formatarInteiro(resumo.c6);
        if (baseSantander) baseSantander.textContent = formatarInteiro(resumo.santander);

        if (competenciaExibicao) competenciaExibicao.textContent = textoSeguro(dados.competencia_exibicao, "-");
        if (periodoDescricao) periodoDescricao.textContent = textoSeguro(dados.periodo_descricao, "Período consultado");

        atualizarUltimaSincronizacao(
            dados
        );

        renderizarErrosBases(dados.erros || []);
        renderizarServicos(dados.servicos || []);
        atualizarToggle();
    }

    function atualizarContador(paginacao) {
        if (!analiticoContador) {
            return;
        }

        const total = Number(paginacao?.total_filtrado || 0);
        const pagina = Number(paginacao?.pagina || 1);
        const tamanho = Number(paginacao?.tamanho_pagina || PAGE_SIZE);

        if (total === 0) {
            analiticoContador.textContent = "0 registros";
            return;
        }

        const inicio = ((pagina - 1) * tamanho) + 1;
        const fim = Math.min(pagina * tamanho, total);
        analiticoContador.textContent = `${formatarInteiro(inicio)}–${formatarInteiro(fim)} de ${formatarInteiro(total)} registros`;
    }

    function atualizarUrlDatas() {
        if (!window.history || !window.history.replaceState) {
            return;
        }

        const url = new URL(window.location.href);
        url.search = "";
        if (dataInicial?.value) url.searchParams.set("data_inicial", dataInicial.value);
        if (dataFinal?.value) url.searchParams.set("data_final", dataFinal.value);
        window.history.replaceState({}, "", url.toString());
    }

    async function carregarDados(options) {
        const sincronizar = Boolean(options?.sincronizar);
        const origemSincronizacao = options?.origem || "acesso";

        if (!dataInicial?.value || !dataFinal?.value) {
            mostrarErro("Informe a data inicial e a data final.");
            return;
        }

        if (dataFinal.value < dataInicial.value) {
            mostrarErro("A data final não pode ser menor que a data inicial.");
            return;
        }

        state.requestId += 1;
        const requestId = state.requestId;

        if (state.controller) {
            state.controller.abort();
        }
        state.controller = new AbortController();

        esconderErro();

        /*
         * Cache-first:
         * abrir a tela, Ver erros, busca, ordenação e paginação
         * são consultas rápidas ao Workspace e não exibem overlay.
         *
         * O loading global fica reservado apenas para uma
         * sincronização real do período pela Financeiro API.
         */
        if (sincronizar) {
            definirCarregando(
                true,
                "Atualizando financeiro",
                "Consultando as bases e atualizando os dados financeiros..."
            );
        }

        atualizarPeriodoVisual();

        const url = new URL(window.location.href);
        url.search = "";
        url.searchParams.set("dados", "1");
        url.searchParams.set("data_inicial", dataInicial.value);
        url.searchParams.set("data_final", dataFinal.value);
        url.searchParams.set("grupo", state.grupo);
        url.searchParams.set("pagina", String(state.pagina));
        url.searchParams.set("tamanho_pagina", String(PAGE_SIZE));
        url.searchParams.set("busca", state.busca);
        url.searchParams.set("ordenar_por", state.ordenarPor);
        url.searchParams.set("direcao", state.direcao);
        if (sincronizar) {
            url.searchParams.set("sincronizar", "1");
            url.searchParams.set("origem", origemSincronizacao);
            url.searchParams.set("acao_dados", "consultar_periodo");
        }

        try {
            const response = await fetch(url.toString(), {
                method: "GET",
                credentials: "same-origin",
                headers: {
                    "X-Requested-With": "XMLHttpRequest",
                    "Accept": "application/json"
                },
                signal: state.controller.signal
            });

            const dados = await response.json().catch(function () {
                return {};
            });

            if (requestId !== state.requestId) {
                return;
            }

            if (!response.ok || dados.erro_consulta || dados.erro_periodo) {
                throw new Error(
                    dados.erro_consulta || dados.erro_periodo || "Não foi possível carregar os dados financeiros."
                );
            }

            renderizarResumo(dados);
            renderizarRegistros(dados.registros_pagina || []);
            renderizarPaginacao(dados.paginacao || {});
            atualizarContador(dados.paginacao || {});
            atualizarOrdenacaoVisual();

            if (
                dados.sincronizacao
                && dados.sincronizacao.sucesso === false
            ) {
                const mensagemSincronizacao =
                    dados.sincronizacao.mensagem
                    || "Não foi possível atualizar as bases financeiras.";

                mostrarErro(
                    `${mensagemSincronizacao} Os dados exibidos permanecem sendo os últimos dados válidos do cache.`
                );
            }

        } catch (erro) {
            if (erro?.name === "AbortError") {
                return;
            }

            if (requestId === state.requestId) {
                mostrarErro(erro?.message || "Erro inesperado ao carregar os dados.");
                if (analiticoBody) {
                    analiticoBody.innerHTML = '<tr class="financeiro-table-empty-row"><td colspan="8">Não foi possível carregar os registros.</td></tr>';
                }
            }
        } finally {
            if (
                sincronizar &&
                requestId === state.requestId
            ) {
                finalizarCarregamento(requestId);
            }
        }
    }

    dataInicial?.addEventListener("change", function () {
        atualizarPeriodoVisual();
    });

    dataFinal?.addEventListener("change", function () {
        atualizarPeriodoVisual();
    });

    form?.addEventListener("submit", function (event) {
        event.preventDefault();
        state.pagina = 1;
        state.busca = "";
        state.grupo = "success";
        state.ordenarPor = "DATA_CLASSE";
        state.direcao = "desc";
        if (analiticoSearch) {
            analiticoSearch.value = "";
        }
        atualizarUrlDatas();

        // O clique explícito em Consultar sempre solicita um FULL exato do
        // período visível, mesmo quando as datas permanecem iguais.
        carregarDados({
            sincronizar: true,
            origem: "filtro_data"
        });
    });

    analiticoSearch?.addEventListener("input", function () {
        window.clearTimeout(state.searchTimer);
        state.searchTimer = window.setTimeout(function () {
            state.busca = analiticoSearch.value.trim();
            state.pagina = 1;
            carregarDados();
        }, SEARCH_DELAY);
    });

    alternarRetornos?.addEventListener("click", function () {
        state.grupo = state.grupo === "success" ? "error" : "success";
        state.pagina = 1;
        atualizarToggle();
        carregarDados();
    });

    sortButtons.forEach(function (button) {
        button.addEventListener("click", function () {
            const index = Number(button.dataset.sortIndex);
            const coluna = sortColumns[index];
            if (!coluna) {
                return;
            }

            if (state.ordenarPor === coluna) {
                state.direcao = state.direcao === "asc" ? "desc" : "asc";
            } else {
                state.ordenarPor = coluna;
                state.direcao =
                    coluna === "DATA_CLASSE"
                        ? "desc"
                        : "asc";
            }

            state.pagina = 1;
            atualizarOrdenacaoVisual();
            carregarDados();
        });
    });

    function iniciarCargaInicial() {
        if (state.cargaInicialIniciada) {
            return;
        }

        state.cargaInicialIniciada = true;

        /*
         * A primeira consulta começa somente depois que o ciclo
         * de pageshow do navbar terminou. O navbar usa esse evento
         * para limpar loaders de navegação; iniciar antes fazia o
         * loading financeiro ser ocultado enquanto o fetch ainda
         * estava consultando as bases.
         */
        window.setTimeout(function () {
            // Abertura/F5: somente cache do Workspace.
            // A Financeiro API é chamada apenas pelo botão Consultar
            // (filtro) ou pelos fluxos backend de agendamento/fechamento.
            carregarDados();
        }, 0);
    }

    window.addEventListener("pageshow", function () {
        iniciarCargaInicial();
    });

    atualizarPeriodoVisual();
    atualizarToggle();
    atualizarOrdenacaoVisual();

    /*
     * Fallback para cenários em que o script seja carregado
     * dinamicamente após o pageshow já ter ocorrido.
     */
    if (document.readyState === "complete") {
        iniciarCargaInicial();
    }
})();
