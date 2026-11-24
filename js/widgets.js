/* Widgets do dashboard: texto, imagem, indicador (KPI), gráfico, tabela, mapa e incorporação.
   Gráficos, mapas e tabelas têm barra de ferramentas: expandir, descarregar e ver dados. */
(function (global) {
  'use strict';
  const DS = global.DataStore;

  const W = {};
  W.TYPES = {
    text: { label: 'Texto', icon: '📝' },
    image: { label: 'Imagem', icon: '🖼️' },
    kpi: { label: 'Indicador (KPI)', icon: '🔢' },
    chart: { label: 'Gráfico', icon: '📊' },
    table: { label: 'Tabela', icon: '📋' },
    map: { label: 'Mapa', icon: '🗺️' },
    embed: { label: 'Incorporar (iframe)', icon: '🔗' }
  };
  W.CHART_TYPES = { bar: 'Barras verticais', hbar: 'Barras horizontais', stacked: 'Barras empilhadas', hstacked: 'Barras horizontais empilhadas', line: 'Linha', area: 'Área', pie: 'Circular (pizza)', doughnut: 'Anel (doughnut)' };
  W.AGGS = { count: 'Contagem de registos', sum: 'Soma', avg: 'Média', min: 'Mínimo', max: 'Máximo', distinct: 'Nº de valores distintos' };

  const ICON = {
    expand: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/></svg>',
    download: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
    data: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 6h6M14 6h6M4 12h6M14 12h6M4 18h6M14 18h6"/></svg>',
    close: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };

  /* ---------- moldura ---------- */
  function frame(el, w, inner, withTools) {
    el.innerHTML = '';
    el.className = 'widget w-' + w.type + (w.style ? ' style-' + w.style : '') + (w._expanded ? ' is-expanded' : '');
    const tools = withTools && !w._noTools;
    if (w.title || w.subtitle || tools) {
      const h = document.createElement('div'); h.className = 'w-head';
      h.innerHTML = '<div class="w-titles">' + (w.title ? '<h3>' + U.esc(w.title) + '</h3>' : '') + (w.subtitle ? '<p class="w-sub">' + U.esc(w.subtitle) + '</p>' : '') + '</div>';
      if (tools) {
        const tb = document.createElement('div'); tb.className = 'w-tools';
        if (!w._expanded) tb.appendChild(toolBtn('expand', 'Expandir', () => W.expand(w)));
        tb.appendChild(toolBtn('download', 'Descarregar', (e) => downloadMenu(e.currentTarget, w, el)));
        if (w.type !== 'table') tb.appendChild(toolBtn('data', 'Ver dados', () => W.showData(w)));
        h.appendChild(tb);
      }
      el.appendChild(h);
    }
    const body = document.createElement('div'); body.className = 'w-body';
    if (inner) body.innerHTML = inner;
    el.appendChild(body);
    return body;
  }
  function toolBtn(icon, title, fn) {
    const b = document.createElement('button');
    b.className = 'tool-btn'; b.type = 'button'; b.title = title; b.setAttribute('aria-label', title);
    b.innerHTML = ICON[icon];
    b.addEventListener('click', fn);
    return b;
  }

  function noLayer(body, w) {
    if (w.layer == null || !DS.layers[w.layer]) { body.innerHTML = '<div class="w-empty">Fonte de dados não encontrada (camada ' + U.esc(w.layer) + ').</div>'; return true; }
    return false;
  }

  /* ---------- modal partilhado ---------- */
  let modalCleanup = null;
  function openModal(title, buildBody, actions) {
    closeModal();
    const m = document.createElement('div');
    m.className = 'wmodal';
    m.innerHTML = '<div class="wmodal-card"><div class="wmodal-head"><h3></h3><div class="wmodal-actions"></div><button class="tool-btn" data-close title="Fechar">' + ICON.close + '</button></div><div class="wmodal-body"></div></div>';
    m.querySelector('h3').textContent = title || '';
    const act = m.querySelector('.wmodal-actions');
    (actions || []).forEach(a => { const b = document.createElement('button'); b.className = 'btn-sm'; b.textContent = a.label; b.onclick = a.onClick; act.appendChild(b); });
    document.body.appendChild(m);
    document.body.classList.add('modal-open');
    m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('[data-close]')) closeModal(); });
    const onKey = (e) => { if (e.key === 'Escape') closeModal(); };
    document.addEventListener('keydown', onKey);
    const cleanup = buildBody(m.querySelector('.wmodal-body'));
    modalCleanup = () => { document.removeEventListener('keydown', onKey); try { cleanup && cleanup(); } catch (e) { /* */ } m.remove(); document.body.classList.remove('modal-open'); };
  }
  function closeModal() { if (modalCleanup) { const c = modalCleanup; modalCleanup = null; c(); } }
  W.closeModal = closeModal;

  W.expand = function (w) {
    const big = Object.assign({}, w, { _expanded: true, title: '', subtitle: '', height: Math.max(320, Math.round(window.innerHeight * 0.72)), pageSize: Math.max(+w.pageSize || 10, 20) });
    openModal(w.title || W.TYPES[w.type].label, (body) => {
      const cell = document.createElement('section'); body.appendChild(cell);
      const inst = W.render(cell, big);
      setTimeout(() => inst.resize && inst.resize(), 60);
      return () => inst.destroy && inst.destroy();
    });
  };

  W.showData = function (w) {
    const t = W.tableData(w);
    openModal('Dados: ' + (w.title || W.TYPES[w.type].label), (body) => {
      const max = 1000;
      body.innerHTML = '<p class="w-sub">' + U.fmtNumber(t.rows.length, 0) + ' linhas' + (t.rows.length > max ? ' (a mostrar as primeiras ' + max + '; descarregue para ver todas)' : '') + (t.note ? ' · ' + U.esc(t.note) : '') + '</p>' +
        '<div class="tbl-wrap"><table><thead><tr>' + t.columns.map((c, i) => '<th' + (t.rows.length && typeof t.rows[0][i] === 'number' ? ' class="num"' : '') + '>' + U.esc(c) + '</th>').join('') + '</tr></thead><tbody>' +
        t.rows.slice(0, max).map(r => '<tr>' + r.map(v => '<td' + (typeof v === 'number' ? ' class="num"' : '') + '>' + U.esc(typeof v === 'number' ? U.fmtNumber(v) : v) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
    }, [{ label: '⬇ CSV', onClick: () => W.download(w, 'csv') }, { label: '⬇ Excel', onClick: () => W.download(w, 'xlsx') }]);
  };

  /* dados tabulares de um widget (para ver/descarregar) */
  W.tableData = function (w) {
    if (w.type === 'chart') {
      const d = W.chartData(w);
      const first = w.groupBy ? DS.fieldLabel(w.layer, w.groupBy) : 'Indicador';
      if (d.perCategory) return { columns: [first, 'Valor'], rows: d.labels.map((l, i) => [l, d.datasets[0].data[i]]) };
      return { columns: [first].concat(d.datasets.map(s => s.label)), rows: d.labels.map((l, i) => [l].concat(d.datasets.map(s => s.data[i]))) };
    }
    if (w.type === 'kpi') {
      const rows = DS.rows(w.layer, w.where);
      return { columns: ['Indicador', 'Valor'], rows: [[w.title || '', DS.aggregate(rows, w.agg || 'count', w.field)]] };
    }
    const cols = W.columnsOf(w);
    const rows = DS.rows(w.layer, w.where);
    const out = rows.map(r => {
      const line = cols.map(c => { const v = DS.val(r, c); return typeof v === 'number' && !DS.isDate(w.layer, c) ? v : DS.display(w.layer, c, v); });
      if (w.type === 'map') { const g = r._geom || r._geomInherited; line.push(g ? g.y : '', g ? g.x : ''); }
      return line;
    });
    const heads = cols.map(c => DS.fieldLabel(w.layer, c));
    if (w.type === 'map') heads.push('Latitude', 'Longitude');
    return { columns: heads, rows: out };
  };
  W.columnsOf = function (w) {
    const list = w.type === 'map' ? [w.colorBy].concat(w.popupFields || []) : (w.columns || []);
    const cols = list.filter((c, i, a) => c && a.indexOf(c) === i);
    return cols.length ? cols : DS.fieldOptions(w.layer).slice(0, 6).map(f => f.key);
  };

  W.download = async function (w, fmt, el) {
    const name = (w.title || W.TYPES[w.type].label || 'dados').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '_').replace(/^_|_$/g, '') || 'dados';
    if (fmt === 'png') {
      let url = null;
      if (w.type === 'chart') { const c = el && el.querySelector('canvas'); url = c ? W.canvasWithTitle(c, w.title, w.subtitle) : null; }
      if (w.type === 'map' && global.Exporter) { try { url = await Exporter.staticMap(w, 1600, 1000); } catch (e) { console.warn(e); } }
      if (!url) return U.toast('Não foi possível gerar a imagem', 'err');
      const a = document.createElement('a'); a.href = url; a.download = name + '.png'; document.body.appendChild(a); a.click(); a.remove();
      return;
    }
    const t = W.tableData(w);
    if (fmt === 'csv') {
      const objs = t.rows.map(r => { const o = {}; t.columns.forEach((c, i) => { o[c] = r[i]; }); return o; });
      return U.download(name + '.csv', U.toCSV(objs, t.columns), 'text/csv;charset=utf-8');
    }
    if (fmt === 'xlsx') {
      if (!global.XLSX_LITE) return U.toast('Exportação Excel indisponível', 'err');
      const blob = await XLSX_LITE.build([{ name: w.title || 'Dados', rows: [t.columns].concat(t.rows) }]);
      return U.download(name + '.xlsx', blob);
    }
  };

  /* copia o canvas para um fundo branco com título (para PNG) */
  W.canvasWithTitle = function (src, title, subtitle) {
    const pad = 28, th = title ? 44 : 0, sh = subtitle ? 24 : 0;
    const c = document.createElement('canvas');
    c.width = src.width + pad * 2; c.height = src.height + pad * 2 + th + sh;
    const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    const k = src.width / (src.clientWidth || src.width);
    if (title) { x.fillStyle = '#1D2421'; x.font = '600 ' + Math.round(20 * k) + 'px Inter, Arial, sans-serif'; x.fillText(title, pad, pad + 22 * k); }
    if (subtitle) { x.fillStyle = '#66706B'; x.font = Math.round(13 * k) + 'px Inter, Arial, sans-serif'; x.fillText(subtitle, pad, pad + th + 10 * k); }
    x.drawImage(src, pad, pad + th + sh);
    return c.toDataURL('image/png');
  };

  let openMenu = null;
  function downloadMenu(btn, w, el) {
    if (openMenu) { openMenu.remove(); openMenu = null; return; }
    const m = document.createElement('div'); m.className = 'dl-menu';
    const opts = [];
    if (w.type === 'chart' || w.type === 'map') opts.push(['png', 'Imagem (PNG)']);
    opts.push(['csv', 'Dados (CSV)'], ['xlsx', 'Dados (Excel)']);
    opts.forEach(([f, l]) => { const b = document.createElement('button'); b.textContent = l; b.onclick = () => { m.remove(); openMenu = null; W.download(w, f, el); }; m.appendChild(b); });
    const r = btn.getBoundingClientRect();
    m.style.top = (r.bottom + window.scrollY + 4) + 'px';
    m.style.left = Math.max(8, r.right + window.scrollX - 170) + 'px';
    document.body.appendChild(m); openMenu = m;
    setTimeout(() => document.addEventListener('click', function off(e) { if (!m.contains(e.target)) { m.remove(); if (openMenu === m) openMenu = null; document.removeEventListener('click', off); } }), 0);
  }

  /* ---------- texto / imagem / iframe ---------- */
  function text(el, w) { frame(el, w, '<div class="rich">' + U.sanitizeHtml(w.html || '') + '</div>'); return {}; }

  function image(el, w) {
    const img = w.src ? '<img src="' + U.esc(w.src) + '" alt="' + U.esc(w.alt || w.caption || '') + '" style="height:' + (+w.height || 240) + 'px;object-fit:' + (w.fit || 'cover') + '">' : '<div class="w-empty">Sem imagem</div>';
    frame(el, w, (w.link ? '<a href="' + U.esc(w.link) + '" target="_blank" rel="noopener">' + img + '</a>' : img) + (w.caption ? '<p class="caption">' + U.esc(w.caption) + '</p>' : ''));
    return {};
  }

  function embed(el, w) {
    frame(el, w, w.url ? '<iframe src="' + U.esc(w.url) + '" style="height:' + (+w.height || 400) + 'px" loading="lazy" allowfullscreen></iframe>' : '<div class="w-empty">Indique o endereço (URL) a incorporar</div>');
    return {};
  }

  /* ---------- KPI ---------- */
  W.kpiValue = function (w) { return DS.aggregate(DS.rows(w.layer, w.where), w.agg || 'count', w.field); };
  W.kpiText = function (w, v) { return (w.prefix || '') + U.fmtNumber(v, w.decimals != null && w.decimals !== '' ? +w.decimals : (w.agg === 'avg' ? 1 : 0)) + (w.suffix || ''); };
  function kpi(el, w) {
    const body = frame(el, Object.assign({}, w, { title: '', subtitle: '' }));
    el.style.setProperty('--kpi-color', w.color || 'var(--primary)');
    function update() {
      if (noLayer(body, w)) return;
      const v = W.kpiValue(w);
      body.innerHTML =
        (w.icon ? '<div class="kpi-icon">' + U.esc(w.icon) + '</div>' : '') +
        '<div class="kpi-main"><div class="kpi-value">' + U.esc(w.prefix || '') + U.fmtNumber(v, w.decimals != null && w.decimals !== '' ? +w.decimals : (w.agg === 'avg' ? 1 : 0)) + '<span class="kpi-suffix">' + U.esc(w.suffix || '') + '</span></div>' +
        '<div class="kpi-title">' + U.esc(w.title || '') + '</div>' + (w.subtitle ? '<div class="kpi-sub">' + U.esc(w.subtitle) + '</div>' : '') + '</div>';
    }
    update();
    return { update };
  }

  /* ---------- gráfico ---------- */
  W.chartData = function (w) {
    const rows = DS.rows(w.layer, w.where);
    const series = (w.series && w.series.length) ? w.series : [{ label: 'Registos', agg: 'count' }];
    if (!w.groupBy) {
      return { labels: series.map(s => s.label || DS.fieldLabel(w.layer, s.field)), datasets: [{ label: w.title || 'Valor', data: series.map(s => { const v = DS.aggregate(rows, s.agg, s.field); return v == null ? null : +(+v).toFixed(2); }), colors: series.map((s, i) => s.color || U.palette[i % U.palette.length]) }], perCategory: true };
    }
    const g = DS.group(rows, w.layer, w.groupBy, { dateBin: w.dateBin, splitMulti: w.splitMulti !== false });
    let keys = Array.from(g.map.keys());
    const first = series[0];
    const val = (k, s) => DS.aggregate(g.map.get(k), s.agg, s.field);
    if (g.isDate || w.sort === 'label') keys.sort((a, b) => a.localeCompare(b, 'pt', { numeric: true }));
    else if (w.sort === 'value-asc') keys.sort((a, b) => (val(a, first) || 0) - (val(b, first) || 0));
    else if (w.sort !== 'none') keys.sort((a, b) => (val(b, first) || 0) - (val(a, first) || 0));
    let others = null;
    if (w.limit && keys.length > +w.limit) {
      const rest = keys.slice(+w.limit); keys = keys.slice(0, +w.limit);
      if (series.every(s => s.agg === 'count' || s.agg === 'sum' || !s.agg)) {
        const restRows = [].concat.apply([], rest.map(k => g.map.get(k)));
        others = series.map(s => DS.aggregate(restRows, s.agg, s.field));
      }
    }
    const labels = keys.map(k => DS.labelForGroup(w.layer, w.groupBy, k, g.isDate, w.dateBin));
    if (others) labels.push('Outros');
    const datasets = series.map((s, i) => {
      const data = keys.map(k => { const v = val(k, s); return v == null ? null : +(+v).toFixed(2); });
      if (others) data.push(others[i]);
      return { label: s.label || DS.fieldLabel(w.layer, s.field) || W.AGGS[s.agg], data, color: s.color || U.palette[i % U.palette.length] };
    });
    return { labels, datasets };
  };

  /* configuração Chart.js (usada no ecrã e no relatório PDF) */
  W.chartConfig = function (w, d, exportMode) {
    const t = w.chartType || 'bar';
    const round = t === 'pie' || t === 'doughnut';
    const horiz = t === 'hbar' || t === 'hstacked';
    const stacked = t === 'stacked' || t === 'hstacked';
    const kind = round ? t : (t === 'line' || t === 'area') ? 'line' : 'bar';
    const ds = d.datasets.map((s) => {
      const perCat = round || d.perCategory;
      const cols = s.colors || (perCat ? d.labels.map((_, j) => U.palette[j % U.palette.length]) : s.color);
      return {
        label: s.label, data: s.data, backgroundColor: kind === 'line' ? hexA(s.color, t === 'area' ? 0.18 : 0) : cols,
        borderColor: kind === 'line' ? s.color : (round ? '#fff' : cols), borderWidth: kind === 'line' ? 2.5 : (round ? 2 : 0),
        fill: t === 'area', tension: 0.3, pointRadius: kind === 'line' ? 3 : 0, borderRadius: kind === 'bar' ? 4 : 0, maxBarThickness: 46
      };
    });
    const fmt = v => U.fmtNumber(v);
    const opts = {
      responsive: !exportMode, maintainAspectRatio: false, indexAxis: horiz ? 'y' : 'x',
      animation: exportMode ? false : { duration: 400 }, devicePixelRatio: exportMode ? 2 : undefined,
      plugins: {
        legend: { display: w.showLegend != null ? !!w.showLegend : (round || ds.length > 1), position: round ? 'right' : 'top', labels: { boxWidth: 12, usePointStyle: true } },
        tooltip: { callbacks: { label: c => ' ' + (c.dataset.label ? c.dataset.label + ': ' : '') + fmt(c.parsed && typeof c.parsed === 'object' ? (horiz ? c.parsed.x : c.parsed.y) : c.parsed) } }
      },
      scales: round ? {} : {
        x: horiz ? { stacked, beginAtZero: true, ticks: { callback: fmt } } : { stacked, grid: { display: false }, ticks: { maxRotation: 45, autoSkip: true } },
        y: horiz ? { stacked, grid: { display: false }, ticks: { autoSkip: false } } : { stacked, beginAtZero: true, ticks: { callback: fmt } }
      }
    };
    return { type: kind, data: { labels: d.labels, datasets: ds }, options: opts };
  };

  function chart(el, w) {
    const body = frame(el, w, null, true);
    let inst = null;
    function update() {
      if (noLayer(body, w)) return;
      if (!global.Chart) { body.innerHTML = '<div class="w-empty">Biblioteca de gráficos indisponível (sem internet?)</div>'; return; }
      const d = W.chartData(w);
      if (!d.labels.length) { if (inst) { inst.destroy(); inst = null; } body.innerHTML = '<div class="w-empty">Sem dados para os filtros seleccionados</div>'; return; }
      const cfg = W.chartConfig(w, d);
      let canvas = body.querySelector('canvas');
      if (!canvas) { body.innerHTML = '<div class="chart-box" style="height:' + (+w.height || 300) + 'px"><canvas></canvas></div>'; canvas = body.querySelector('canvas'); }
      if (inst && inst.config.type === cfg.type) { inst.data.labels = cfg.data.labels; inst.data.datasets = cfg.data.datasets; inst.options = cfg.options; inst.update(); }
      else { if (inst) inst.destroy(); inst = new Chart(canvas, cfg); }
    }
    update();
    return { update, resize: () => inst && inst.resize && inst.resize(), destroy: () => inst && inst.destroy() };
  }

  function hexA(hex, a) {
    if (!hex || hex[0] !== '#') return hex;
    const h = hex.length === 4 ? hex.replace(/#(.)(.)(.)/, '#$1$1$2$2$3$3') : hex;
    const n = parseInt(h.slice(1), 16);
    return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  /* ---------- tabela ---------- */
  function table(el, w) {
    const body = frame(el, w, null, true);
    const st = { page: 0, sort: w.sortBy || null, dir: w.sortDir || 'asc', q: '' };
    body.innerHTML = '<div class="tbl-tools"><input type="search" placeholder="Pesquisar…"><span class="tbl-count"></span></div><div class="tbl-wrap"></div><div class="tbl-pager"></div>';
    const wrap = U.$('.tbl-wrap', body), pager = U.$('.tbl-pager', body), cnt = U.$('.tbl-count', body);
    U.$('input', body).addEventListener('input', U.debounce(e => { st.q = e.target.value.toLowerCase(); st.page = 0; update(); }, 200));
    function update() {
      if (noLayer(wrap, w)) return;
      const cols = W.columnsOf(w);
      let rows = DS.rows(w.layer, w.where);
      if (st.q) rows = rows.filter(r => cols.some(c => String(DS.display(w.layer, c, DS.val(r, c))).toLowerCase().includes(st.q)));
      if (st.sort) {
        const s = st.sort, k = st.dir === 'desc' ? -1 : 1;
        rows = rows.slice().sort((a, b) => { const x = DS.val(a, s), y = DS.val(b, s); if (x == null) return 1; if (y == null) return -1; return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'pt')) * k; });
      }
      const ps = +w.pageSize || 10, pages = Math.max(1, Math.ceil(rows.length / ps));
      if (st.page >= pages) st.page = pages - 1;
      const slice = rows.slice(st.page * ps, st.page * ps + ps);
      cnt.textContent = U.fmtNumber(rows.length, 0) + ' registos';
      wrap.innerHTML = '<table><thead><tr>' + cols.map(c => '<th data-k="' + U.esc(c) + '">' + U.esc(DS.fieldLabel(w.layer, c)) + (st.sort === c ? (st.dir === 'asc' ? ' ▲' : ' ▼') : '') + '</th>').join('') + '</tr></thead><tbody>' +
        (slice.length ? slice.map(r => '<tr>' + cols.map(c => { const v = DS.val(r, c); return '<td' + (typeof v === 'number' && !DS.isDate(w.layer, c) ? ' class="num"' : '') + '>' + U.esc(DS.display(w.layer, c, v)) + '</td>'; }).join('') + '</tr>').join('') : '<tr><td colspan="' + cols.length + '" class="w-empty">Sem registos</td></tr>') +
        '</tbody></table>';
      U.$$('th', wrap).forEach(th => th.addEventListener('click', () => { const k = th.dataset.k; if (st.sort === k) st.dir = st.dir === 'asc' ? 'desc' : 'asc'; else { st.sort = k; st.dir = 'asc'; } update(); }));
      pager.innerHTML = pages > 1 ? '<button class="btn-sm" data-p="-1"' + (st.page ? '' : ' disabled') + '>‹</button><span>Página ' + (st.page + 1) + ' de ' + pages + '</span><button class="btn-sm" data-p="1"' + (st.page < pages - 1 ? '' : ' disabled') + '>›</button>' : '';
      U.$$('[data-p]', pager).forEach(b => b.addEventListener('click', () => { st.page += +b.dataset.p; update(); }));
    }
    update();
    return { update };
  }

  /* ---------- mapa (fundos Esri, legenda com contagens, satélite) ---------- */
  const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/';
  const ATTR = 'Esri, HERE, Garmin, © OpenStreetMap';
  W.BASEMAPS = {
    gray: { label: 'Cinza claro (Esri)', base: ESRI + 'Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', ref: ESRI + 'Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}', attr: ATTR },
    satellite: { label: 'Imagem de satélite (Esri)', base: ESRI + 'World_Imagery/MapServer/tile/{z}/{y}/{x}', ref: ESRI + 'Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', attr: 'Esri, Maxar, Earthstar Geographics' },
    streets: { label: 'Ruas (Esri)', base: ESRI + 'World_Street_Map/MapServer/tile/{z}/{y}/{x}', attr: ATTR },
    topo: { label: 'Topográfico (Esri)', base: ESRI + 'World_Topo_Map/MapServer/tile/{z}/{y}/{x}', attr: ATTR },
    dark: { label: 'Cinza escuro (Esri)', base: ESRI + 'Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', ref: ESRI + 'Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', attr: ATTR },
    osm: { label: 'OpenStreetMap', base: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attr: '© OpenStreetMap' }
  };
  W.basemapKey = k => (k === 'light' || !W.BASEMAPS[k]) ? 'gray' : k;

  /* pontos e categorias (partilhado com a exportação de imagem/PDF) */
  W.mapPoints = function (w) {
    const rows = DS.rows(w.layer, w.where).filter(r => r._geom || r._geomInherited);
    const counts = new Map();
    rows.forEach(r => { const k = w.colorBy ? String(DS.val(r, w.colorBy) ?? '') : ''; counts.set(k, (counts.get(k) || 0) + 1); });
    const keys = Array.from(counts.keys()).sort((a, b) => (a === '') - (b === '') || a.localeCompare(b, 'pt'));
    const colors = {};
    const fixed = w.colors || {};
    keys.forEach((k, i) => { colors[k] = fixed[k] || (w.colorBy ? U.palette[i % U.palette.length] : (w.color || '#2E7D5B')); });
    return { rows, keys, counts, colors };
  };

  function map(el, w) {
    const body = frame(el, Object.assign({ subtitle: w._expanded ? '' : (w.subtitle || 'Clique num ponto para ver detalhes') }, w), null, true);
    if (!global.L) { body.innerHTML = '<div class="w-empty">Biblioteca de mapas indisponível (sem internet?)</div>'; return {}; }
    body.innerHTML = '<div class="map-box" style="height:' + (+w.height || 380) + 'px"></div>';
    const box = U.$('.map-box', body);
    const m = L.map(box, { scrollWheelZoom: !!w._expanded, zoomControl: true }).setView([-18.5, 35.5], 5);
    m.createPane('refLabels'); m.getPane('refLabels').style.zIndex = 350; m.getPane('refLabels').style.pointerEvents = 'none';
    const layers = {};
    Object.keys(W.BASEMAPS).forEach(k => {
      const b = W.BASEMAPS[k];
      const base = L.tileLayer(b.base, { attribution: b.attr, maxZoom: 19, crossOrigin: true });
      layers[b.label] = b.ref ? L.layerGroup([base, L.tileLayer(b.ref, { maxZoom: 19, pane: 'refLabels', crossOrigin: true })]) : base;
    });
    const startKey = W.basemapKey(w.basemap);
    layers[W.BASEMAPS[startKey].label].addTo(m);
    L.control.layers(layers, null, { position: 'topright', collapsed: true }).addTo(m);
    L.control.scale({ imperial: false, position: 'bottomright' }).addTo(m);
    const group = L.featureGroup().addTo(m);
    const hidden = new Set();
    let legendCtl = null, fitted = false;

    function update() {
      group.clearLayers();
      if (!DS.layers[w.layer]) return;
      const P = W.mapPoints(w);
      const pf = (w.popupFields && w.popupFields.length) ? w.popupFields : DS.fieldOptions(w.layer).slice(0, 4).map(f => f.key);
      P.rows.forEach(r => {
        const k = w.colorBy ? String(DS.val(r, w.colorBy) ?? '') : '';
        if (hidden.has(k)) return;
        const g = r._geom || r._geomInherited;
        const mk = L.circleMarker([g.y, g.x], { radius: 7, color: '#fff', weight: 1.5, fillColor: P.colors[k], fillOpacity: 0.92 });
        const head = w.colorBy ? '<div class="pop-head"><i style="background:' + P.colors[k] + '"></i>' + U.esc(DS.display(w.layer, w.colorBy, k) || '(vazio)') + '</div>' : '';
        mk.bindPopup('<div class="pop">' + head + pf.map(f => '<div><b>' + U.esc(DS.fieldLabel(w.layer, f)) + ':</b> ' + U.esc(DS.display(w.layer, f, DS.val(r, f)) || '—') + '</div>').join('') + '<a href="#" class="pop-zoom">Aproximar aqui ›</a></div>');
        mk.on('popupopen', (e) => { const a = e.popup.getElement().querySelector('.pop-zoom'); if (a) a.onclick = (ev) => { ev.preventDefault(); m.setView([g.y, g.x], 13); }; });
        group.addLayer(mk);
      });
      // legenda com contagens (clicar para ocultar/mostrar categoria)
      if (legendCtl) legendCtl.remove();
      legendCtl = L.control({ position: 'bottomleft' });
      legendCtl.onAdd = () => {
        const d = L.DomUtil.create('div', 'map-legend-box');
        L.DomEvent.disableClickPropagation(d); L.DomEvent.disableScrollPropagation(d);
        if (w.colorBy) {
          d.innerHTML = '<div class="lg-title">' + U.esc(DS.fieldLabel(w.layer, w.colorBy)) + '</div>' + P.keys.map(k => '<div class="lg-item' + (hidden.has(k) ? ' off' : '') + '" data-k="' + U.esc(k) + '"><i style="background:' + P.colors[k] + '"></i>' + U.esc(DS.display(w.layer, w.colorBy, k) || '(vazio)') + ' <span>(' + P.counts.get(k) + ')</span></div>').join('');
          d.querySelectorAll('.lg-item').forEach(it => it.addEventListener('click', () => { const k = it.dataset.k; if (hidden.has(k)) hidden.delete(k); else hidden.add(k); update(); }));
        } else d.innerHTML = '<div class="lg-item"><i style="background:' + P.colors[''] + '"></i>' + U.esc((DS.layers[w.layer] || {}).label || 'Registos') + ' <span>(' + P.rows.length + ')</span></div>';
        return d;
      };
      legendCtl.addTo(m);
      if (group.getLayers().length && (!fitted || !hidden.size)) { try { m.fitBounds(group.getBounds(), { padding: [30, 30], maxZoom: 10 }); fitted = true; } catch (e) { /* */ } }
      setTimeout(() => m.invalidateSize(), 50);
    }
    update();
    return { update, resize: () => { m.invalidateSize(); if (group.getLayers().length) m.fitBounds(group.getBounds(), { padding: [30, 30], maxZoom: 10 }); }, destroy: () => m.remove() };
  }

  const R = { text, image, embed, kpi, chart, table, map };
  W.render = function (el, w) {
    try { return (R[w.type] || text)(el, w) || {}; }
    catch (e) { console.error(e); el.innerHTML = '<div class="w-empty">Erro no widget: ' + U.esc(e.message) + '</div>'; return {}; }
  };

  global.Widgets = W;
})(window);
