document.addEventListener('DOMContentLoaded', function () {
    const cards = [...document.querySelectorAll('.db-card')],
        search = document.getElementById('dbSearch'),
        count = document.getElementById('dbCount'),
        empty = document.getElementById('dbEmpty'),
        viewer = document.getElementById('dbViewer'),
        frame = document.getElementById('dbFrame'),
        loading = document.getElementById('dbLoading'),
        title = document.getElementById('dbViewTitle'),
        desc = document.getElementById('dbViewDescription'),
        icon = document.getElementById('dbViewIcon'),
        company = document.getElementById('dbCompany'),
        area = document.getElementById('dbArea'),
        owner = document.getElementById('dbOwner'),
        reload = document.getElementById('dbReload'),
        external = document.getElementById('dbExternal'),
        expand = document.getElementById('dbExpand'),
        expandIcon = document.getElementById('dbExpandIcon'),
        expandLabel = document.getElementById('dbExpandLabel');

    let active = null;

    const norm = v => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

    function tag(el, v) {
        const s = el.querySelector('span'), x = String(v || '').trim();
        el.hidden = !x;
        if (s) s.textContent = x;
    }

    /*
     * Liberação por carteira: os links de dashboards (Empresa.link_bi)
     * vinculados ao usuário logado (CustomAuth > CustomUser > carteiras)
     * são embutidos pelo template via json_script. Cards cujo data-src
     * não estiver nessa lista não aparecem na listagem.
     */
    const linksLiberadosEl = document.getElementById('linksLiberados');
    let linksLiberados = [];
    try {
        linksLiberados = linksLiberadosEl ? JSON.parse(linksLiberadosEl.textContent) : [];
    } catch (e) {
        linksLiberados = [];
    }

    const cardsLiberados = cards.filter(function (card) {
        const src = card.dataset.src || '';

        /*
         * Só cards vinculados a uma Empresa (link do Power BI) entram na
         * verificação de carteira. Painéis internos (ex.: rotas do próprio
         * Workspace) não têm carteira associada e ficam sempre acessíveis.
         */
        if (!src.startsWith('https://app.powerbi.com')) return true;
        if (linksLiberados.includes(src)) return true;

        card.closest('li').remove();
        return false;
    });
    cards.length = 0;
    cards.push(...cardsLiberados);
    count.textContent = cards.length;

    function open(card) {
        if (!card) return;

        cards.forEach(c => {
            const a = c === card;
            c.classList.toggle('active', a);
            c.setAttribute('aria-pressed', String(a));
        });

        active = card;
        title.textContent = card.dataset.title;
        desc.textContent = card.dataset.description;
        icon.innerHTML = '<i class="' + card.dataset.icon + '" aria-hidden="true"></i>';
        tag(company, card.dataset.company);
        tag(area, card.dataset.area);
        tag(owner, card.dataset.owner);
        external.href = card.dataset.src;
        loading.classList.remove('hidden');
        frame.src = card.dataset.src;
    }

    cards.forEach(c => c.addEventListener('click', () => open(c)));

    search.addEventListener('input', () => {
        const q = norm(search.value);
        let n = 0, first = null;

        cards.forEach(c => {
            const ok = !q || norm([c.dataset.title, c.dataset.description, c.dataset.company, c.dataset.area, c.dataset.owner].join(' ')).includes(q);
            c.closest('li').hidden = !ok;
            if (ok) {
                n++;
                if (!first) first = c;
            }
        });

        count.textContent = n;
        empty.classList.toggle('show', n === 0);
        if (first && (!active || active.closest('li').hidden)) open(first);
    });

    frame.addEventListener('load', () => {
        if (frame.src && frame.src !== 'about:blank') setTimeout(() => loading.classList.add('hidden'), 250);
    });

    reload.addEventListener('click', () => {
        if (!active) return;
        const src = active.dataset.src;
        loading.classList.remove('hidden');
        frame.src = 'about:blank';
        setTimeout(() => frame.src = src, 80);
    });

    expand.addEventListener('click', () => {
        const e = !viewer.classList.contains('expanded');
        viewer.classList.toggle('expanded', e);
        document.body.classList.toggle('db-expanded', e);
        expand.setAttribute('aria-pressed', String(e));
        expandIcon.className = e ? 'fa fa-compress' : 'fa fa-expand';
        expandLabel.textContent = e ? 'Reduzir' : 'Expandir';
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && viewer.classList.contains('expanded')) expand.click();
    });

    const primeiroLiberado = cards[0];

    if (primeiroLiberado) {
        open(primeiroLiberado);
    } else {
        loading.classList.add('hidden');
        title.textContent = 'Nenhum dashboard liberado';
        desc.textContent = 'Solicite a liberação de uma carteira para visualizar os indicadores.';
    }
});
