/* Dashboard público */
(function () {
  'use strict';
  const DS = window.DataStore;
  const DRAFT_KEY = 'dash_draft_config';
  const params = new URLSearchParams(location.search);
  const PREVIEW = params.has('preview');

  let CFG = null, instances = [], activeTab = null, refreshTimer = null, lastDataKey = null;

  async function loadConfig() {
    if (PREVIEW) {
      try { const d = localStorage.getItem(DRAFT_KEY); if (d) return JSON.parse(d); } catch (e) { /* */ }
    }
    try {
      const r = await fetch('config.json?v=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) {
      // sem servidor (file://) ou falha de rede: usa a cópia embutida em js/config-default.js
      if (window.EMBEDDED_CONFIG) { console.warn('[config] a usar cópia embutida:', e.message); return JSON.parse(JSON.stringify(window.EMBEDDED_CONFIG)); }
      const d = localStorage.getItem(DRAFT_KEY);
      if (d) return JSON.parse(d);
      throw e;
    }
  }

  function applyTheme(s) {
    const root = document.documentElement.style;
    root.setProperty('--primary', s.primaryColor || '#1F5C45');
    root.setProperty('--accent', s.accentColor || '#E0A526');
    root.setProperty('--bg', s.background || '#F4F1EA');
    document.title = s.title || 'Dashboard';
    if (s.favicon) { let l = document.querySelector('link[rel=icon]'); if (!l) { l = document.createElement('link'); l.rel = 'icon'; document.head.appendChild(l); } l.href = s.favicon; }
  }

  function header() {
    const s = CFG.site;
    U.$('#brand').innerHTML = (s.logo ? '<img src="' + U.esc(s.logo) + '" alt="">' : '') + '<div><h1>' + U.esc(s.title || '') + '</h1>' + (s.subtitle ? '<p>' + U.esc(s.subtitle) + '</p>' : '') + '</div>';
    badge();
    U.$('#footer-text').innerHTML = U.sanitizeHtml(s.footerText || '');
  }

  function badge() {
    const b = U.$('#data-badge');
    if (!CFG.site.showDataBadge) { b.hidden = true; return; }
    b.hidden = false;
    const t = DS.loadedAt ? DS.loadedAt.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : '';
    b.className = 'badge ' + (DS.source === 'mock' ? 'mock' : 'live');
    b.innerHTML = DS.source === 'mock' ? '● Dados fictícios (demonstração)' : '● ArcGIS Online · actualizado ' + t;
    b.title = DS.errors.length ? DS.errors.join('\n') : '';
  }

  function visibleTabs() { return (CFG.tabs || []).filter(t => t.visible !== false); }

  function nav() {
    const tabs = visibleTabs();
    U.$('#tabs').innerHTML = tabs.map(t => '<a href="#' + U.esc(t.id) + '" data-tab="' + U.esc(t.id) + '">' + (t.icon ? '<span class="ti">' + U.esc(t.icon) + '</span>' : '') + U.esc(t.title) + '</a>').join('');
  }

  /* ---------- filtros ---------- */
  function filters() {
    const bar = U.$('#filters');
    const fc = CFG.filters || {};
    if (!CFG.site.showFilters || !DS.layers[DS.rootId]) { bar.hidden = true; return; }
    bar.hidden = false;
    const fields = (fc.fields || []).filter(f => DS.layers[DS.rootId].fieldMap[f.field]);
    bar.innerHTML = fields.map(f => '<label><span>' + U.esc(f.label || DS.fieldLabel(DS.rootId, f.field)) + '</span><select data-f="' + U.esc(f.field) + '"></select></label>').join('') +
      (fc.dateField && DS.layers[DS.rootId].fieldMap[fc.dateField] ? '<label><span>De</span><input type="date" data-d="from"></label><label><span>Até</span><input type="date" data-d="to"></label>' : '') +
      '<button class="btn-ghost" id="f-clear">Limpar filtros</button>';
    DS.filters.__dateField = fc.dateField;
    fillSelects();
    U.$$('select', bar).forEach(s => s.addEventListener('change', () => { DS.filters[s.dataset.f] = s.value ? [s.value] : []; fillSelects(); refreshWidgets(); }));
    U.$$('input[type=date]', bar).forEach(i => i.addEventListener('change', () => { DS.filters[i.dataset.d === 'from' ? '__from' : '__to'] = i.value ? new Date(i.value + 'T00:00:00').getTime() : null; refreshWidgets(); }));
    U.$('#f-clear').addEventListener('click', () => { Object.keys(DS.filters).forEach(k => { if (k !== '__dateField') delete DS.filters[k]; }); U.$$('input[type=date]', bar).forEach(i => { i.value = ''; }); fillSelects(); refreshWidgets(); });
  }

  // opções dependentes: cada lista mostra apenas valores compatíveis com os outros filtros
  function fillSelects() {
    const root = DS.layers[DS.rootId];
    U.$$('#filters select').forEach(sel => {
      const f = sel.dataset.f;
      const others = Object.assign({}, DS.filters); delete others[f];
      const saved = DS.filters; DS.filters = others;
      const rows = DS.rows(DS.rootId);
      DS.filters = saved;
      const vals = Array.from(new Set(rows.map(r => r[f]).filter(v => v != null && v !== '').map(String))).sort((a, b) => a.localeCompare(b, 'pt'));
      const cur = (DS.filters[f] || [])[0] || '';
      sel.innerHTML = '<option value="">Todos</option>' + vals.map(v => '<option value="' + U.esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + U.esc(DS.display(root.id, f, v)) + '</option>').join('');
    });
  }

  /* ---------- abas e widgets ---------- */
  function destroy() { instances.forEach(i => { try { i.destroy && i.destroy(); } catch (e) { /* */ } }); instances = []; }

  function showTab(id) {
    const tabs = visibleTabs();
    const tab = tabs.find(t => t.id === id) || tabs[0];
    if (!tab) { U.$('#content').innerHTML = '<div class="w-empty big">Nenhuma aba configurada. Entre na área de gestão para criar conteúdo.</div>'; return; }
    activeTab = tab.id;
    U.$$('#tabs a').forEach(a => a.classList.toggle('active', a.dataset.tab === tab.id));
    destroy();
    const grid = U.$('#content');
    grid.innerHTML = '';
    if (tab.description) { const d = document.createElement('div'); d.className = 'tab-desc'; d.innerHTML = U.sanitizeHtml(tab.description); grid.appendChild(d); }
    (tab.widgets || []).forEach(w => {
      if (w.hidden) return;
      const cell = document.createElement('section');
      cell.style.gridColumn = 'span ' + Math.min(12, Math.max(1, +w.width || 12));
      cell.dataset.wid = w.id;
      grid.appendChild(cell);
      instances.push(Widgets.render(cell, w));
    });
    if (!(tab.widgets || []).length) grid.innerHTML += '<div class="w-empty big">Esta aba ainda não tem conteúdo.</div>';
  }

  function refreshWidgets() { instances.forEach(i => i.update && i.update()); }

  async function reloadData() {
    U.$('#btn-refresh').classList.add('spin');
    try { await DS.load(CFG); badge(); fillSelects(); refreshWidgets(); }
    finally { U.$('#btn-refresh').classList.remove('spin'); }
  }

  async function boot() {
    try {
      CFG = await loadConfig();
    } catch (e) {
      U.$('#content').innerHTML = '<div class="w-empty big">Não foi possível carregar a configuração (config.json).<br>' + U.esc(e.message) + '</div>';
      return;
    }
    applyTheme(CFG.site || {});
    header(); nav();
    const key = JSON.stringify([CFG.dataSource, CFG.layers]);
    if (key !== lastDataKey || !DS.loadedAt) {
      U.$('#content').innerHTML = '<div class="loading"><div class="spinner"></div>A carregar dados…</div>';
      await DS.load(CFG);
      lastDataKey = key;
    }
    badge(); filters();
    showTab(decodeURIComponent(location.hash.slice(1)));
    if (PREVIEW) document.body.classList.add('preview');
    const mins = +(CFG.dataSource || {}).refreshMinutes;
    clearInterval(refreshTimer);
    if (mins > 0) refreshTimer = setInterval(reloadData, mins * 60000);
  }

  window.addEventListener('hashchange', () => showTab(decodeURIComponent(location.hash.slice(1))));
  window.addEventListener('message', (e) => { if ((e.origin === location.origin || location.protocol === 'file:') && e.data && e.data.type === 'dash:reload') boot(); });
  document.addEventListener('DOMContentLoaded', () => {
    U.$('#btn-refresh').addEventListener('click', reloadData);
    U.$('#btn-pdf').addEventListener('click', () => Exporter.pdfReport(CFG));
    const xm = U.$('#xl-menu');
    U.$('#btn-xlsx').addEventListener('click', (e) => { e.stopPropagation(); xm.hidden = !xm.hidden; });
    document.addEventListener('click', (e) => { if (!xm.contains(e.target)) xm.hidden = true; });
    U.$$('#xl-menu [data-x]').forEach(b => b.addEventListener('click', () => { xm.hidden = true; Exporter.excel(b.dataset.x, CFG); }));
    boot();
  });
})();
