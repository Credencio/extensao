/* Área de gestão: edição de abas, widgets, textos, imagens, fonte de dados, filtros, backup e publicação */
(function () {
  'use strict';
  const DS = window.DataStore, W = window.Widgets;
  const K = { draft: 'dash_draft_config', snaps: 'dash_snapshots', auth: 'dash_admin_auth', token: 'dash_gh_token' };

  let PUB = null, CFG = null, section = 'conteudo', selTab = null, lastUndoAt = 0, lastSaved = null;
  const undo = [];

  /* ---------- helpers DOM ---------- */
  function h(tag, attrs) {
    const el = document.createElement(tag);
    const a = attrs || {};
    for (const k in a) {
      const v = a[k];
      if (v == null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = !!v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (let i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, c) { if (c == null || c === false) return; if (Array.isArray(c)) c.forEach(x => add(el, x)); else el.appendChild(c instanceof Node ? c : document.createTextNode(String(c))); }
  const card = (title, help, ...kids) => h('div', { class: 'card' }, title ? h('h3', { text: title }) : null, help ? h('p', { class: 'help', html: help }) : null, kids);
  const row = (...kids) => h('div', { class: 'row' }, kids);

  function fld(label, input, help) { return h('div', { class: 'fld' }, label ? h('label', { text: label }) : null, input, help ? h('div', { class: 'help', html: help }) : null); }
  function tInput(obj, key, opts) {
    const o = opts || {};
    const i = h(o.multiline ? 'textarea' : 'input', { type: o.multiline ? null : (o.type || 'text'), placeholder: o.placeholder, value: obj[key] == null ? '' : obj[key] });
    i.addEventListener(o.type === 'number' || o.type === 'date' ? 'change' : 'input', () => { const v = o.type === 'number' ? (i.value === '' ? null : +i.value) : i.value; (o.set || ((x) => { obj[key] = x; }))(v); o.onChange && o.onChange(v); });
    return i;
  }
  function sel(options, value, onChange, opts) {
    const s = h('select', { class: (opts && opts.class) || null });
    options.forEach(op => {
      if (op && op.group) { const g = h('optgroup', { label: op.group }); op.items.forEach(it => g.appendChild(h('option', { value: it[0], text: it[1] }))); s.appendChild(g); }
      else s.appendChild(h('option', { value: op[0], text: op[1] }));
    });
    s.value = value == null ? '' : String(value);
    s.addEventListener('change', () => onChange(s.value));
    return s;
  }
  function chk(label, obj, key, onChange, invert) {
    const i = h('input', { type: 'checkbox', checked: invert ? !obj[key] : !!obj[key] });
    i.addEventListener('change', () => { obj[key] = invert ? !i.checked : i.checked; onChange && onChange(); });
    return h('label', { class: 'chk' }, i, label);
  }
  function colorIn(obj, key, def, onChange) {
    const c = h('input', { type: 'color', value: obj[key] || def || '#1F5C45' });
    const t = h('input', { type: 'text', value: obj[key] || '', placeholder: def || '', style: { maxWidth: '110px' } });
    c.addEventListener('input', () => { obj[key] = c.value; t.value = c.value; onChange && onChange(); });
    t.addEventListener('change', () => { obj[key] = t.value || null; if (t.value) c.value = t.value; onChange && onChange(); });
    return h('div', { class: 'inline' }, c, t);
  }

  /* opções de campos agrupadas (camada, pai, raiz) */
  function fieldOpts(layerId, filter, emptyLabel) {
    const opts = DS.fieldOptions(layerId, filter);
    const groups = {};
    opts.forEach(o => { (groups[o.group] = groups[o.group] || []).push([o.key, o.label + '  ·  ' + o.key.replace(/^(parent|root):/, '')]); });
    const out = emptyLabel !== false ? [['', emptyLabel || '— nenhum —']] : [];
    Object.keys(groups).forEach(g => out.push({ group: g, items: groups[g] }));
    return out;
  }
  const numericF = fd => DS.isNumericType(fd.type);
  function layerOpts(filter) {
    return Object.values(DS.layers).filter(l => !filter || filter(l)).map(l => [String(l.id), l.label + ' — ' + l.rows.length + ' reg.' + (l.parentId != null ? ' (filha de ' + (DS.layers[l.parentId] || {}).label + ')' : '')]);
  }

  /* ---------- estado / rascunho ---------- */
  function strip(c) { const x = U.clone(c); delete x.updatedAt; return JSON.stringify(x); }
  function isDirty() { return PUB && strip(CFG) !== strip(PUB); }

  function saveDraft() {
    try { localStorage.setItem(K.draft, JSON.stringify(CFG)); }
    catch (e) { U.toast('Rascunho demasiado grande para o navegador (imagens?). Publique ou use imagens mais pequenas.', 'err'); }
    draftState();
    reloadPreview();
  }
  function draftState() {
    const el = U.$('#draft-state');
    if (isDirty()) { el.className = 'draft-state dirty'; el.innerHTML = '● Alterações por publicar<br><a href="#" id="discard">Descartar rascunho</a>'; U.$('#discard').onclick = (e) => { e.preventDefault(); discard(); }; }
    else { el.className = 'draft-state'; el.textContent = '✓ Igual à versão publicada'; }
  }
  function change(fn, rerender) {
    const now = Date.now();
    // guarda o estado anterior (lastSaved), porque alguns campos alteram o objecto antes de chamar change()
    if (now - lastUndoAt > 1200 && lastSaved) { undo.push(lastSaved); if (undo.length > 60) undo.shift(); }
    lastUndoAt = now;
    fn && fn();
    saveDraft();
    lastSaved = JSON.stringify(CFG);
    if (rerender !== false) render();
  }
  function doUndo() {
    if (!undo.length) return U.toast('Nada para desfazer', 'warn');
    CFG = JSON.parse(undo.pop()); lastUndoAt = 0; saveDraft(); lastSaved = JSON.stringify(CFG); render(); U.toast('Alteração desfeita');
  }
  function discard() {
    if (!confirm('Descartar todas as alterações não publicadas e voltar à versão publicada?')) return;
    snapshot('Antes de descartar rascunho');
    change(() => { CFG = U.clone(PUB); });
  }

  const reloadPreview = U.debounce(() => {
    const f = U.$('#pv-frame');
    if (!f || U.$('#app').classList.contains('no-preview')) return;
    try { f.contentWindow.postMessage({ type: 'dash:reload' }, location.origin === 'null' ? '*' : location.origin); } catch (e) { /* */ }
  }, 500);
  function previewTo(tabId) {
    const f = U.$('#pv-frame'); const want = 'index.html?preview=1#' + encodeURIComponent(tabId || '');
    if (!f.getAttribute('src')) f.src = want;
    else { try { f.contentWindow.location.hash = encodeURIComponent(tabId || ''); } catch (e) { f.src = want; } }
  }

  /* ---------- pontos de restauro locais ---------- */
  function snaps() { try { return JSON.parse(localStorage.getItem(K.snaps) || '[]'); } catch (e) { return []; } }
  function snapshot(label) {
    const list = snaps();
    list.unshift({ at: new Date().toISOString(), label: label || 'Ponto de restauro', cfg: CFG });
    while (list.length > 15) list.pop();
    for (;;) {
      try { localStorage.setItem(K.snaps, JSON.stringify(list)); break; }
      catch (e) { if (list.length <= 1) { U.toast('Sem espaço para guardar o ponto de restauro local. Descarregue um backup.', 'warn'); break; } list.pop(); }
    }
  }

  /* ---------- modal ---------- */
  function modal(title, body, buttons) {
    U.$('#modal-title').textContent = title;
    const b = U.$('#modal-body'); b.innerHTML = ''; add(b, body);
    const f = U.$('#modal-foot'); f.innerHTML = '';
    (buttons || []).forEach(bt => f.appendChild(h('button', { class: 'btn ' + (bt.cls || ''), text: bt.label, onclick: bt.onClick })));
    U.$('#modal').hidden = false;
  }
  function closeModal() { U.$('#modal').hidden = true; U.$('#modal-body').innerHTML = ''; }

  /* ---------- navegação ---------- */
  const TITLES = { conteudo: 'Abas e conteúdo', aparencia: 'Aparência e textos', dados: 'Fonte de dados', filtros: 'Filtros', backup: 'Backup e restauro', publicar: 'Publicar no GitHub Pages', seguranca: 'Segurança' };
  function render() {
    U.$('#sec-title').textContent = TITLES[section];
    U.$$('#side-nav a').forEach(a => a.classList.toggle('active', a.dataset.sec === section));
    const body = U.$('#sec-body'); const st = U.$('.editor').scrollTop;
    body.innerHTML = '';
    ({ conteudo: secConteudo, aparencia: secAparencia, dados: secDados, filtros: secFiltros, backup: secBackup, publicar: secPublicar, seguranca: secSeguranca })[section](body);
    U.$('.editor').scrollTop = st;
    draftState();
  }

  /* =================== ABAS E CONTEÚDO =================== */
  function slug(s) { return (s || 'aba').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'aba'; }
  function uniqueTabId(base) { let id = slug(base), n = 2; while (CFG.tabs.some(t => t.id === id)) id = slug(base) + '-' + n++; return id; }

  function dragList(container, items, onMove) {
    let from = null;
    U.$$('[data-idx]', container).forEach(el => {
      el.draggable = true;
      el.addEventListener('dragstart', e => { from = +el.dataset.idx; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(from)); });
      el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('drag-over'); });
      el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
      el.addEventListener('drop', e => { e.preventDefault(); el.classList.remove('drag-over'); const to = +el.dataset.idx; if (from != null && from !== to) onMove(from, to); from = null; });
    });
  }
  const move = (arr, a, b) => { const [x] = arr.splice(a, 1); arr.splice(b, 0, x); };

  function secConteudo(body) {
    if (!CFG.tabs) CFG.tabs = [];
    if (!selTab || !CFG.tabs.find(t => t.id === selTab)) selTab = CFG.tabs[0] && CFG.tabs[0].id;

    const list = h('div', { class: 'tab-list' });
    CFG.tabs.forEach((t, i) => {
      list.appendChild(h('div', { class: 'tab-item' + (t.id === selTab ? ' sel' : '') + (t.visible === false ? ' hidden-tab' : ''), 'data-idx': i, onclick: () => { selTab = t.id; render(); previewTo(t.id); } },
        h('span', { class: 'drag', text: '⋮⋮' }), h('span', { text: t.icon || '•' }), h('span', { class: 't-name', text: t.title || '(sem título)' }),
        h('span', { class: 'pill', text: (t.widgets || []).length + ' widgets' }),
        h('button', { class: 'ibtn', title: 'Subir', text: '↑', onclick: e => { e.stopPropagation(); if (i) change(() => move(CFG.tabs, i, i - 1)); } }),
        h('button', { class: 'ibtn', title: 'Descer', text: '↓', onclick: e => { e.stopPropagation(); if (i < CFG.tabs.length - 1) change(() => move(CFG.tabs, i, i + 1)); } }),
        h('button', { class: 'ibtn', title: t.visible === false ? 'Mostrar' : 'Ocultar', text: t.visible === false ? '🙈' : '👁', onclick: e => { e.stopPropagation(); change(() => { t.visible = t.visible === false; }); } }),
        h('button', { class: 'ibtn', title: 'Duplicar', text: '⧉', onclick: e => { e.stopPropagation(); change(() => { const c = U.clone(t); c.id = uniqueTabId(t.title + '-copia'); c.title = t.title + ' (cópia)'; c.widgets.forEach(w => { w.id = U.uid('w'); }); CFG.tabs.splice(i + 1, 0, c); selTab = c.id; }); } }),
        h('button', { class: 'ibtn', title: 'Eliminar aba', text: '🗑', onclick: e => { e.stopPropagation(); if (confirm('Eliminar a aba "' + t.title + '" e todo o seu conteúdo?')) change(() => { CFG.tabs.splice(i, 1); }); } })
      ));
    });
    dragList(list, CFG.tabs, (a, b) => change(() => move(CFG.tabs, a, b)));

    body.appendChild(card('Abas', 'Arraste para reordenar. Clique numa aba para editar o seu conteúdo. Abas ocultas não aparecem no dashboard.', list,
      h('button', { class: 'btn primary', text: '+ Nova aba', onclick: newTab })));

    const tab = CFG.tabs.find(t => t.id === selTab);
    if (!tab) return;
    if (!tab.widgets) tab.widgets = [];

    const idIn = h('input', { type: 'text', value: tab.id });
    idIn.addEventListener('change', () => { const v = slug(idIn.value); if (v !== tab.id && CFG.tabs.some(t => t.id === v)) { U.toast('Já existe uma aba com esse identificador', 'err'); idIn.value = tab.id; return; } change(() => { tab.id = v; selTab = v; }); });
    body.appendChild(card('Definições da aba', null,
      row(fld('Título', tInput(tab, 'title', { onChange: () => change(null, false) })), fld('Ícone (emoji)', tInput(tab, 'icon', { onChange: () => change(null, false) })), fld('Identificador (endereço #)', idIn)),
      fld('Descrição no topo da aba (opcional, aceita HTML)', tInput(tab, 'description', { multiline: true, onChange: () => change(null, false) })),
      (() => { const vis = h('input', { type: 'checkbox', checked: tab.visible !== false }); vis.onchange = () => change(() => { tab.visible = vis.checked; }); return h('label', { class: 'chk' }, vis, 'Aba visível no dashboard'); })()
    ));

    const wl = h('div', { class: 'w-list' });
    tab.widgets.forEach((w, i) => {
      const T = W.TYPES[w.type] || { icon: '?', label: w.type };
      const meta = w.type === 'kpi' || w.type === 'chart' || w.type === 'table' || w.type === 'map' ? ((DS.layers[w.layer] || {}).label || 'camada ' + w.layer) + (w.type === 'chart' ? ' · ' + (W.CHART_TYPES[w.chartType] || '') : '') : '';
      wl.appendChild(h('div', { class: 'w-item' + (w.hidden ? ' is-hidden' : ''), 'data-idx': i, style: { gridColumn: 'span ' + (+w.width || 12) }, ondblclick: () => editWidget(tab, w) },
        h('div', { class: 'w-t', text: T.icon + ' ' + (w.title || (w.type === 'text' ? (w.html || '').replace(/<[^>]+>/g, ' ').trim().slice(0, 40) || 'Texto' : T.label)) }),
        h('div', { class: 'w-m', text: T.label + ' · largura ' + (w.width || 12) + '/12' + (meta ? ' · ' + meta : '') }),
        h('div', { class: 'w-a' },
          h('button', { class: 'ibtn', title: 'Editar', text: '✏️', onclick: () => editWidget(tab, w) }),
          h('button', { class: 'ibtn', title: 'Mover para trás', text: '←', onclick: () => { if (i) change(() => move(tab.widgets, i, i - 1)); } }),
          h('button', { class: 'ibtn', title: 'Mover para a frente', text: '→', onclick: () => { if (i < tab.widgets.length - 1) change(() => move(tab.widgets, i, i + 1)); } }),
          h('button', { class: 'ibtn', title: 'Duplicar', text: '⧉', onclick: () => change(() => { const c = U.clone(w); c.id = U.uid('w'); tab.widgets.splice(i + 1, 0, c); }) }),
          h('button', { class: 'ibtn', title: 'Mover para outra aba', text: '⇄', onclick: () => moveWidget(tab, i) }),
          h('button', { class: 'ibtn', title: w.hidden ? 'Mostrar' : 'Ocultar', text: w.hidden ? '🙈' : '👁', onclick: () => change(() => { w.hidden = !w.hidden; }) }),
          h('button', { class: 'ibtn', title: 'Eliminar', text: '🗑', onclick: () => { if (confirm('Eliminar este widget?')) change(() => tab.widgets.splice(i, 1)); } })
        )));
    });
    dragList(wl, tab.widgets, (a, b) => change(() => move(tab.widgets, a, b)));
    body.appendChild(card('Conteúdo da aba "' + (tab.title || '') + '"', 'Cada bloco é um widget (texto, imagem, indicador, gráfico, tabela, mapa). Arraste para reordenar, duplo clique para editar. A largura é em 12 colunas.',
      wl, h('div', { style: { marginTop: '12px' } }, h('button', { class: 'btn primary', text: '+ Adicionar widget', onclick: () => pickType(tab) }))));
  }

  function newTab() {
    const title = prompt('Nome da nova aba:', 'Nova aba'); if (!title) return;
    change(() => { const t = { id: uniqueTabId(title), title, icon: '📄', visible: true, widgets: [] }; CFG.tabs.push(t); selTab = t.id; });
    previewTo(selTab);
  }

  function moveWidget(tab, i) {
    const others = CFG.tabs.filter(t => t !== tab);
    if (!others.length) return U.toast('Não há outras abas', 'warn');
    const s = sel(others.map(t => [t.id, (t.icon || '') + ' ' + t.title]), others[0].id, () => {});
    modal('Mover widget para outra aba', fld('Aba de destino', s), [
      { label: 'Cancelar', onClick: closeModal },
      { label: 'Mover', cls: 'primary', onClick: () => { change(() => { const [w] = tab.widgets.splice(i, 1); CFG.tabs.find(t => t.id === s.value).widgets.push(w); }); closeModal(); } }
    ]);
  }

  function defaults(type) {
    const firstLayer = Object.keys(DS.layers)[0] != null ? +Object.keys(DS.layers)[0] : 0;
    const base = { id: U.uid('w'), type, width: 6, title: '' };
    switch (type) {
      case 'text': return Object.assign(base, { width: 12, html: '<p>Escreva aqui o seu texto…</p>' });
      case 'image': return Object.assign(base, { src: '', caption: '', height: 240, fit: 'cover' });
      case 'embed': return Object.assign(base, { url: '', height: 400, width: 12 });
      case 'kpi': return Object.assign(base, { width: 3, title: 'Novo indicador', layer: DS.rootId, agg: 'count', icon: '📌' });
      case 'chart': return Object.assign(base, { title: 'Novo gráfico', layer: DS.rootId, chartType: 'bar', groupBy: '', height: 300, series: [{ label: 'Registos', agg: 'count' }], sort: 'value-desc' });
      case 'table': return Object.assign(base, { width: 12, title: 'Nova tabela', layer: firstLayer, columns: DS.fieldOptions(firstLayer).slice(0, 5).map(f => f.key), pageSize: 10 });
      case 'map': return Object.assign(base, { title: 'Novo mapa', layer: DS.rootId, height: 380, basemap: 'gray', popupFields: [] });
    }
    return base;
  }

  function pickType(tab) {
    const g = h('div', { class: 'type-grid' });
    Object.keys(W.TYPES).forEach(t => g.appendChild(h('button', { onclick: () => { closeModal(); editWidget(tab, defaults(t), true); } }, h('span', { text: W.TYPES[t].icon }), W.TYPES[t].label)));
    modal('Que tipo de widget quer adicionar?', g, [{ label: 'Cancelar', onClick: closeModal }]);
  }

  /* ---------- editor de widget ---------- */
  function editWidget(tab, original, isNew) {
    const w = U.clone(original);
    const formBox = h('div');
    const pv = h('section', { class: 'mini-preview', style: { marginTop: '14px' } });
    let pvInst = null;
    const refresh = U.debounce(() => { if (pvInst && pvInst.destroy) pvInst.destroy(); pv.innerHTML = ''; pvInst = W.render(pv, w); }, 250);
    function rebuild() { formBox.innerHTML = ''; buildForm(formBox, w, rebuild, refresh); refresh(); }
    rebuild();
    modal((isNew ? 'Novo widget: ' : 'Editar: ') + W.TYPES[w.type].label,
      [formBox, h('div', { class: 'help', style: { marginTop: '16px', fontWeight: 600 }, text: 'Pré-visualização' }), pv],
      [{ label: 'Cancelar', onClick: () => { if (pvInst && pvInst.destroy) pvInst.destroy(); closeModal(); } },
       { label: isNew ? 'Adicionar' : 'Guardar', cls: 'primary', onClick: () => {
         if (pvInst && pvInst.destroy) pvInst.destroy();
         change(() => { if (isNew) tab.widgets.push(w); else { const i = tab.widgets.indexOf(original); tab.widgets[i] = w; } });
         closeModal(); U.toast(isNew ? 'Widget adicionado' : 'Widget guardado');
       } }]);
  }

  function buildForm(box, w, rebuild, refresh) {
    const upd = () => refresh();
    const common = row(
      fld('Título', tInput(w, 'title', { onChange: upd })),
      fld('Largura', sel([[3, '¼ (3 col.)'], [4, '⅓ (4 col.)'], [5, '5 col.'], [6, '½ (6 col.)'], [7, '7 col.'], [8, '⅔ (8 col.)'], [9, '¾ (9 col.)'], [12, 'Largura total (12)']], w.width || 12, v => { w.width = +v; upd(); }))
    );
    box.appendChild(common);
    if (w.type !== 'text') box.appendChild(fld('Subtítulo / descrição curta', tInput(w, 'subtitle', { onChange: upd })));

    const needsLayer = ['kpi', 'chart', 'table', 'map'].includes(w.type);
    if (needsLayer) {
      box.appendChild(fld('Fonte de dados (tabela/camada)', sel(layerOpts(w.type === 'map' ? l => l.geometryType || l.parentId != null : null), w.layer, v => { w.layer = +v; if (w.type === 'table') w.columns = DS.fieldOptions(+v).slice(0, 5).map(f => f.key); w.where = []; if (w.series) w.series.forEach(s => { s.field = ''; }); w.groupBy = ''; rebuild(); }),
        'As tabelas-filhas ligam-se à tabela-mãe por <code>parentglobalid → globalid</code>; pode usar campos do pai (↑) e da raiz (⇈).'));
    }

    switch (w.type) {
      case 'text': {
        box.appendChild(fld('Estilo do bloco', sel([['', 'Cartão branco'], ['highlight', 'Destaque'], ['plain', 'Sem moldura'], ['dark', 'Fundo escuro']], w.style || '', v => { w.style = v || undefined; upd(); })));
        box.appendChild(fld('Conteúdo', richEditor(w, 'html', upd)));
        break;
      }
      case 'image': {
        box.appendChild(fld('Imagem', imagePicker(w, 'src', upd)));
        box.appendChild(row(fld('Altura (px)', tInput(w, 'height', { type: 'number', onChange: upd })), fld('Ajuste', sel([['cover', 'Preencher (cortar)'], ['contain', 'Mostrar inteira']], w.fit || 'cover', v => { w.fit = v; upd(); }))));
        box.appendChild(row(fld('Legenda', tInput(w, 'caption', { onChange: upd })), fld('Texto alternativo', tInput(w, 'alt', { onChange: upd }))));
        box.appendChild(fld('Ligação ao clicar (opcional)', tInput(w, 'link', { type: 'url', placeholder: 'https://…', onChange: upd })));
        break;
      }
      case 'embed': {
        box.appendChild(fld('Endereço (URL) a incorporar', tInput(w, 'url', { type: 'url', placeholder: 'https://… (ex.: mapa web, vídeo, Power BI, ArcGIS Dashboard)', onChange: upd })));
        box.appendChild(fld('Altura (px)', tInput(w, 'height', { type: 'number', onChange: upd })));
        break;
      }
      case 'kpi': {
        box.appendChild(row(
          fld('Cálculo', sel(Object.entries(W.AGGS), w.agg || 'count', v => { w.agg = v; rebuild(); })),
          w.agg && w.agg !== 'count' ? fld('Campo', sel(fieldOpts(w.layer, w.agg === 'distinct' ? null : numericF), w.field, v => { w.field = v; upd(); })) : null));
        box.appendChild(row(fld('Ícone (emoji)', tInput(w, 'icon', { onChange: upd })), fld('Prefixo', tInput(w, 'prefix', { onChange: upd })), fld('Sufixo', tInput(w, 'suffix', { placeholder: 'ex.: " ha"', onChange: upd })), fld('Casas decimais', tInput(w, 'decimals', { type: 'number', onChange: upd }))));
        box.appendChild(fld('Cor', colorIn(w, 'color', CFG.site.primaryColor, upd)));
        box.appendChild(fld('Condições (filtrar registos)', whereEditor(w, upd)));
        break;
      }
      case 'chart': {
        box.appendChild(row(
          fld('Tipo de gráfico', sel(Object.entries(W.CHART_TYPES), w.chartType || 'bar', v => { w.chartType = v; upd(); })),
          fld('Altura (px)', tInput(w, 'height', { type: 'number', onChange: upd }))));
        box.appendChild(row(
          fld('Agrupar por (categorias)', sel(fieldOpts(w.layer, null, '— sem agrupamento (cada série é uma categoria) —'), w.groupBy, v => { w.groupBy = v; rebuild(); })),
          w.groupBy && DS.isDate(w.layer, w.groupBy) ? fld('Período', sel([['month', 'Mês'], ['year', 'Ano'], ['day', 'Dia']], w.dateBin || 'month', v => { w.dateBin = v; upd(); })) : null));
        if (w.groupBy) {
          box.appendChild(row(
            fld('Ordenar', sel([['value-desc', 'Maior valor primeiro'], ['value-asc', 'Menor valor primeiro'], ['label', 'Alfabética / cronológica'], ['none', 'Sem ordenação']], w.sort || 'value-desc', v => { w.sort = v; upd(); })),
            fld('Máx. de categorias (resto = "Outros")', tInput(w, 'limit', { type: 'number', placeholder: 'todas', onChange: upd }))));
          box.appendChild(chk('Separar valores múltiplos (ex.: "Milho,Feijão" conta em ambas)', Object.assign(w, { splitMulti: w.splitMulti !== false }), 'splitMulti', upd));
        }
        box.appendChild(fld('Séries (o que medir)', seriesEditor(w, upd), w.groupBy ? 'Várias séries = barras agrupadas/empilhadas ou várias linhas.' : 'Sem agrupamento, cada série torna-se uma barra/fatia (ex.: Homens, Mulheres, Jovens).'));
        const lg = h('input', { type: 'checkbox', checked: w.showLegend !== false && (w.showLegend || ['pie', 'doughnut'].includes(w.chartType) || (w.series || []).length > 1) });
        lg.onchange = () => { w.showLegend = lg.checked; upd(); };
        box.appendChild(h('label', { class: 'chk' }, lg, 'Mostrar legenda'));
        box.appendChild(fld('Condições (filtrar registos)', whereEditor(w, upd)));
        break;
      }
      case 'table': {
        box.appendChild(fld('Colunas', columnsEditor(w, 'columns', upd)));
        box.appendChild(row(fld('Linhas por página', tInput(w, 'pageSize', { type: 'number', onChange: upd })),
          fld('Ordenar por', sel(fieldOpts(w.layer, null, '— ordem original —'), w.sortBy, v => { w.sortBy = v; upd(); })),
          fld('Direcção', sel([['asc', 'Ascendente'], ['desc', 'Descendente']], w.sortDir || 'asc', v => { w.sortDir = v; upd(); }))));
        box.appendChild(fld('Condições (filtrar registos)', whereEditor(w, upd)));
        break;
      }
      case 'map': {
        box.appendChild(row(fld('Mapa base inicial (o visitante pode mudar, incl. satélite)', sel(Object.keys(W.BASEMAPS).map(k => [k, W.BASEMAPS[k].label]), W.basemapKey(w.basemap), v => { w.basemap = v; upd(); })), fld('Altura (px)', tInput(w, 'height', { type: 'number', onChange: upd }))));
        box.appendChild(fld('Colorir pontos por', sel(fieldOpts(w.layer, null, '— cor única —'), w.colorBy, v => { w.colorBy = v; upd(); })));
        box.appendChild(fld('Campos na janela ao clicar num ponto', columnsEditor(w, 'popupFields', upd)));
        box.appendChild(fld('Condições (filtrar registos)', whereEditor(w, upd), 'Registos de tabelas sem geometria usam a localização do diário-mãe.'));
        break;
      }
    }
    box.appendChild(h('label', { class: 'chk' }, (() => { const i = h('input', { type: 'checkbox', checked: !!w.hidden }); i.onchange = () => { w.hidden = i.checked; }; return i; })(), 'Ocultar este widget (mantém a configuração)'));
  }

  function whereEditor(w, onChange) {
    if (!w.where) w.where = [];
    const box = h('div');
    function draw() {
      box.innerHTML = '';
      const list = h('div', { class: 'sub-list' });
      w.where.forEach((c, i) => {
        const dl = 'dl_' + U.uid('x');
        const vals = c.field ? DS.distinct(w.layer, c.field).slice(0, 200) : [];
        const valIn = h('input', { type: 'text', class: 'mini', value: c.value == null ? '' : c.value, list: dl, placeholder: 'valor' });
        valIn.oninput = () => { c.value = valIn.value; onChange(); };
        list.appendChild(h('div', { class: 'sub-row' },
          sel(fieldOpts(w.layer, null, '— campo —'), c.field, v => { c.field = v; draw(); onChange(); }, { class: 'mini' }),
          sel([['=', 'igual a'], ['!=', 'diferente de'], ['>', 'maior que'], ['>=', 'maior ou igual'], ['<', 'menor que'], ['<=', 'menor ou igual'], ['contains', 'contém'], ['notempty', 'preenchido'], ['empty', 'vazio']], c.op || '=', v => { c.op = v; draw(); onChange(); }, { class: 'mini' }),
          ['empty', 'notempty'].includes(c.op) ? h('span') : valIn,
          h('datalist', { id: dl }, vals.map(v => h('option', { value: v }))),
          h('button', { class: 'ibtn', text: '✕', onclick: () => { w.where.splice(i, 1); draw(); onChange(); } })));
      });
      box.appendChild(list);
      box.appendChild(h('button', { class: 'btn', text: '+ Condição', onclick: () => { w.where.push({ field: '', op: '=', value: '' }); draw(); } }));
    }
    draw();
    return box;
  }

  function seriesEditor(w, onChange) {
    if (!w.series || !w.series.length) w.series = [{ label: 'Registos', agg: 'count' }];
    const box = h('div');
    function draw() {
      box.innerHTML = '';
      const list = h('div', { class: 'sub-list' });
      w.series.forEach((s, i) => {
        const lab = h('input', { type: 'text', class: 'mini', value: s.label || '', placeholder: 'Nome da série' });
        lab.oninput = () => { s.label = lab.value; onChange(); };
        const col = h('input', { type: 'color', value: s.color || U.palette[i % U.palette.length] });
        col.oninput = () => { s.color = col.value; onChange(); };
        list.appendChild(h('div', { class: 'sub-row' }, lab,
          sel(Object.entries(W.AGGS), s.agg || 'count', v => { s.agg = v; draw(); onChange(); }, { class: 'mini' }),
          s.agg && s.agg !== 'count' ? sel(fieldOpts(w.layer, s.agg === 'distinct' ? null : numericF, '— campo —'), s.field, v => { s.field = v; if (!s.label || s.label === 'Registos') { s.label = DS.fieldLabel(w.layer, v); lab.value = s.label; } onChange(); }, { class: 'mini' }) : h('span', { class: 'help', text: 'conta registos' }),
          col,
          h('button', { class: 'ibtn', text: '✕', title: 'Remover série', onclick: () => { if (w.series.length > 1) { w.series.splice(i, 1); draw(); onChange(); } } })));
      });
      box.appendChild(list);
      box.appendChild(h('button', { class: 'btn', text: '+ Série', onclick: () => { w.series.push({ label: '', agg: 'sum', field: '' }); draw(); } }));
    }
    draw();
    return box;
  }

  function columnsEditor(w, key, onChange) {
    if (!w[key]) w[key] = [];
    const box = h('div');
    function draw() {
      box.innerHTML = '';
      const list = h('div', { class: 'sub-list' });
      w[key].forEach((c, i) => list.appendChild(h('div', { class: 'sub-row' },
        h('span', { text: DS.fieldLabel(w.layer, c) + '  ', style: { flex: '3' } }), h('code', { text: c }),
        h('button', { class: 'ibtn', text: '↑', onclick: () => { if (i) { move(w[key], i, i - 1); draw(); onChange(); } } }),
        h('button', { class: 'ibtn', text: '↓', onclick: () => { if (i < w[key].length - 1) { move(w[key], i, i + 1); draw(); onChange(); } } }),
        h('button', { class: 'ibtn', text: '✕', onclick: () => { w[key].splice(i, 1); draw(); onChange(); } }))));
      box.appendChild(list);
      box.appendChild(sel(fieldOpts(w.layer, null, '+ adicionar campo…'), '', v => { if (v && !w[key].includes(v)) { w[key].push(v); draw(); onChange(); } }));
    }
    draw();
    return box;
  }

  function imagePicker(obj, key, onChange, maxSize) {
    const img = h('img', { src: obj[key] || '', alt: '' });
    const url = h('input', { type: 'text', value: obj[key] && !String(obj[key]).startsWith('data:') ? obj[key] : '', placeholder: 'URL ou caminho (ex.: assets/foto.jpg)' });
    url.oninput = () => { obj[key] = url.value; img.src = url.value; onChange(); };
    const file = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
    file.onchange = async () => {
      const f = file.files[0]; if (!f) return;
      try { obj[key] = await U.readImage(f, maxSize || 1600); img.src = obj[key]; url.value = ''; onChange(); U.toast('Imagem carregada (' + Math.round(obj[key].length / 1024) + ' KB)'); }
      catch (e) { U.toast('Não foi possível ler a imagem', 'err'); }
    };
    return h('div', null, h('div', { class: 'img-pick' }, img, h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 } },
      h('div', { style: { display: 'flex', gap: '6px' } }, h('button', { class: 'btn', text: '⬆ Carregar ficheiro', onclick: () => file.click() }), h('button', { class: 'btn danger', text: 'Remover', onclick: () => { obj[key] = ''; img.src = ''; url.value = ''; onChange(); } })),
      url)), file);
  }

  function richEditor(obj, key, onChange) {
    const area = h('div', { class: 'rt-area rich', contenteditable: 'true', html: U.sanitizeHtml(obj[key] || '') });
    const code = h('textarea', { style: { display: 'none', minHeight: '200px', width: '100%' } });
    let codeMode = false;
    const sync = () => { obj[key] = codeMode ? code.value : area.innerHTML; onChange(); };
    area.addEventListener('input', sync);
    code.addEventListener('input', sync);
    const cmd = (c, v) => () => { area.focus(); document.execCommand(c, false, v); sync(); };
    const imgIn = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
    imgIn.onchange = async () => { const f = imgIn.files[0]; if (!f) return; const d = await U.readImage(f, 1200); area.focus(); document.execCommand('insertImage', false, d); sync(); };
    const tb = h('div', { class: 'rt-toolbar' },
      h('button', { type: 'button', html: '<b>B</b>', title: 'Negrito', onclick: cmd('bold') }),
      h('button', { type: 'button', html: '<i>I</i>', title: 'Itálico', onclick: cmd('italic') }),
      h('button', { type: 'button', html: '<u>U</u>', title: 'Sublinhado', onclick: cmd('underline') }),
      h('button', { type: 'button', text: 'T1', title: 'Título', onclick: cmd('formatBlock', 'H2') }),
      h('button', { type: 'button', text: 'T2', title: 'Subtítulo', onclick: cmd('formatBlock', 'H3') }),
      h('button', { type: 'button', text: '¶', title: 'Parágrafo', onclick: cmd('formatBlock', 'P') }),
      h('button', { type: 'button', text: '• Lista', onclick: cmd('insertUnorderedList') }),
      h('button', { type: 'button', text: '1. Lista', onclick: cmd('insertOrderedList') }),
      h('button', { type: 'button', text: '⟸', title: 'Alinhar à esquerda', onclick: cmd('justifyLeft') }),
      h('button', { type: 'button', text: '⟺', title: 'Centrar', onclick: cmd('justifyCenter') }),
      h('button', { type: 'button', text: '🔗', title: 'Ligação', onclick: () => { const u = prompt('Endereço da ligação:', 'https://'); if (u) cmd('createLink', u)(); } }),
      h('button', { type: 'button', text: '🖼', title: 'Inserir imagem', onclick: () => imgIn.click() }),
      h('button', { type: 'button', text: '🎨', title: 'Cor do texto', onclick: () => { const c = prompt('Cor (ex.: #1F5C45):', CFG.site.primaryColor); if (c) cmd('foreColor', c)(); } }),
      h('button', { type: 'button', text: '⌫', title: 'Limpar formatação', onclick: cmd('removeFormat') }),
      h('button', { type: 'button', text: '</> HTML', title: 'Editar código HTML', onclick: () => {
        codeMode = !codeMode;
        if (codeMode) { code.value = area.innerHTML; code.style.display = ''; area.style.display = 'none'; }
        else { area.innerHTML = U.sanitizeHtml(code.value); code.style.display = 'none'; area.style.display = ''; }
        sync();
      } }), imgIn);
    return h('div', null, tb, area, code);
  }

  /* =================== APARÊNCIA =================== */
  function secAparencia(body) {
    const s = CFG.site; const c = () => change(null, false);
    body.appendChild(card('Cabeçalho', null,
      fld('Título do site', tInput(s, 'title', { onChange: c })),
      fld('Subtítulo', tInput(s, 'subtitle', { onChange: c })),
      fld('Logótipo', imagePicker(s, 'logo', c, 400)),
      fld('Ícone do separador do navegador (favicon)', imagePicker(s, 'favicon', c, 128))));
    body.appendChild(card('Cores', 'As cores aplicam-se ao cabeçalho, indicadores e realces.',
      row(fld('Cor principal', colorIn(s, 'primaryColor', '#1F5C45', c)), fld('Cor de destaque', colorIn(s, 'accentColor', '#E0A526', c)), fld('Fundo da página', colorIn(s, 'background', '#F4F1EA', c)))));
    body.appendChild(card('Rodapé e opções', null,
      fld('Texto do rodapé (aceita HTML)', tInput(s, 'footerText', { multiline: true, onChange: c })),
      chk('Mostrar barra de filtros', s, 'showFilters', c),
      chk('Mostrar indicação da fonte de dados (fictícios / ArcGIS)', s, 'showDataBadge', c)));
  }

  /* =================== FONTE DE DADOS =================== */
  function secDados(body) {
    const d = CFG.dataSource; const c = () => change(null, false);
    body.appendChild(card('Ligação ao ArcGIS Online', 'O dashboard lê todas as camadas e tabelas do feature service e liga-as automaticamente pelas relações <code>globalid → parentglobalid</code>.',
      fld('Modo', sel([['auto', 'Automático — usa o ArcGIS e, se estiver vazio, dados fictícios'], ['arcgis', 'Apenas ArcGIS Online'], ['mock', 'Apenas dados fictícios (demonstração)']], d.mode || 'auto', v => { d.mode = v; c(); })),
      fld('URL do Feature Service', tInput(d, 'serviceUrl', { type: 'url', onChange: c })),
      fld('Token ArcGIS (opcional)', tInput(d, 'token', { onChange: c }), '⚠️ Só para serviços privados. O token fica visível no <code>config.json</code> público — prefira partilhar a vista (view) como pública.'),
      row(fld('Actualização automática (minutos, 0 = desligada)', tInput(d, 'refreshMinutes', { type: 'number', onChange: c })),
        fld('Nº de diários fictícios', tInput(d, 'mockCount', { type: 'number', onChange: c })),
        fld('Semente aleatória (fictícios)', tInput(d, 'mockSeed', { type: 'number', onChange: c }))),
      h('button', { class: 'btn primary', text: '⟳ Testar ligação e recarregar dados', onclick: async (e) => {
        e.target.disabled = true; e.target.textContent = 'A carregar…';
        try { await DS.load(CFG); U.toast(DS.source === 'arcgis' ? 'Ligado ao ArcGIS: ' + DS.layers[DS.rootId].rows.length + ' diários' : (DS.errors.length ? 'Erro no ArcGIS — a usar dados fictícios' : 'Serviço vazio — a usar dados fictícios'), DS.errors.length ? 'warn' : 'ok'); }
        finally { render(); reloadPreview(); }
      } })));

    const status = DS.source === 'arcgis' ? h('span', { class: 'pill ok', text: 'A usar dados do ArcGIS Online' }) : h('span', { class: 'pill warn', text: 'A usar dados fictícios' });
    const tb = h('table', { class: 'list-table' }, h('thead', null, h('tr', null, ['ID', 'Nome no serviço', 'Nome a mostrar', 'Tabela-mãe', 'Registos'].map(t => h('th', { text: t })))));
    const tbody = h('tbody');
    if (!CFG.layers) CFG.layers = {};
    Object.values(DS.layers).sort((a, b) => a.id - b.id).forEach(l => {
      const lc = CFG.layers[l.id] = CFG.layers[l.id] || {};
      const lab = h('input', { type: 'text', class: 'mini', value: lc.label || l.name });
      lab.onchange = () => change(() => { lc.label = lab.value; l.label = lab.value; }, false);
      tbody.appendChild(h('tr', null, h('td', { text: l.id }), h('td', null, h('code', { text: l.name })), h('td', null, lab),
        h('td', { text: l.parentId != null ? (DS.layers[l.parentId] || {}).name : '— (raiz)' }), h('td', { text: U.fmtNumber(l.rows.length, 0) })));
    });
    tb.appendChild(tbody);
    body.appendChild(card('Tabelas e relações', null, h('p', null, status, DS.errors.length ? h('span', { class: 'help', text: '  ' + DS.errors[0] }) : null), tb, h('h3', { text: 'Hierarquia', style: { marginTop: '14px' } }), h('div', { class: 'tree', text: tree() })));
  }
  function tree() {
    const kids = id => Object.values(DS.layers).filter(l => l.parentId === id);
    const line = (l, pre) => pre + l.label + '  [' + l.name + ', ' + l.rows.length + ']\n' + kids(l.id).map(k => line(k, pre.replace(/[├└]─ /g, '│  ').replace(/└/g, ' ') + '└─ ')).join('');
    return Object.values(DS.layers).filter(l => l.parentId == null).map(r => line(r, '')).join('');
  }

  /* =================== FILTROS =================== */
  function secFiltros(body) {
    const f = CFG.filters = CFG.filters || { fields: [] };
    const root = DS.rootId;
    const dateOpts = [['', '— sem filtro de datas —']].concat(DS.fieldOptions(root, fd => fd.type === 'esriFieldTypeDate').filter(o => !o.key.includes(':')).map(o => [o.key, o.label]));
    const list = h('div', { class: 'sub-list' });
    (f.fields || []).forEach((x, i) => {
      const lab = h('input', { type: 'text', class: 'mini', value: x.label || '', placeholder: 'Rótulo' });
      lab.oninput = () => { x.label = lab.value; change(null, false); };
      list.appendChild(h('div', { class: 'sub-row' },
        sel(DS.fieldOptions(root).filter(o => !o.key.includes(':')).map(o => [o.key, o.label]), x.field, v => change(() => { x.field = v; x.label = DS.fieldLabel(root, v); })), lab,
        h('button', { class: 'ibtn', text: '↑', onclick: () => { if (i) change(() => move(f.fields, i, i - 1)); } }),
        h('button', { class: 'ibtn', text: '✕', onclick: () => change(() => f.fields.splice(i, 1)) })));
    });
    body.appendChild(card('Filtros globais', 'Os filtros aplicam-se à tabela-mãe (' + U.esc((DS.layers[root] || {}).label) + ') e propagam-se automaticamente a todas as tabelas relacionadas.',
      chk('Mostrar a barra de filtros no dashboard', CFG.site, 'showFilters', () => change(null, false)),
      fld('Campo de data (filtro "De / Até")', sel(dateOpts, f.dateField, v => change(() => { f.dateField = v; }, false))),
      fld('Listas de selecção', h('div', null, list, h('button', { class: 'btn', text: '+ Filtro', onclick: () => change(() => { f.fields = f.fields || []; f.fields.push({ field: 'provincia', label: 'Província' }); }) })))));
  }

  /* =================== BACKUP =================== */
  function secBackup(body) {
    body.appendChild(card('Criar backup', 'Guarde cópias da configuração do site (abas, textos, imagens, gráficos) e, opcionalmente, dos dados.',
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', text: '⬇ Configuração (.json)', onclick: () => U.download('backup-config-' + U.stamp() + '.json', JSON.stringify(CFG, null, 2)) }),
        h('button', { class: 'btn primary', text: '⬇ Backup completo (.zip)', onclick: fullBackup }),
        h('button', { class: 'btn', text: '📌 Criar ponto de restauro local', onclick: () => { const l = prompt('Descrição do ponto de restauro:', 'Ponto de restauro manual'); if (l != null) { snapshot(l); render(); U.toast('Ponto de restauro criado'); } } })),
      h('p', { class: 'help', html: 'O backup completo inclui <code>config.json</code>, as imagens do site e os dados actuais de todas as tabelas (CSV e JSON).' })));

    const file = h('input', { type: 'file', accept: '.json,.zip', style: { display: 'none' } });
    file.onchange = async () => { const f = file.files[0]; if (f) await restoreFile(f); file.value = ''; };
    body.appendChild(card('Restaurar', 'Carregue um ficheiro de backup (.json ou .zip). A versão actual é guardada antes num ponto de restauro.',
      h('button', { class: 'btn', text: '⬆ Restaurar de ficheiro…', onclick: () => file.click() }), file));

    const list = snaps();
    const tb = h('table', { class: 'list-table' }, h('tbody', null, list.length ? list.map((s, i) => h('tr', null,
      h('td', { text: new Date(s.at).toLocaleString('pt-PT') }), h('td', { text: s.label }),
      h('td', null, h('button', { class: 'btn', text: 'Restaurar', onclick: () => { if (confirm('Restaurar esta versão? (a actual fica guardada)')) { snapshot('Antes de restaurar ponto local'); change(() => { CFG = U.clone(s.cfg); }); U.toast('Versão restaurada — publique para aplicar no site'); } } }),
        ' ', h('button', { class: 'btn', text: '⬇', title: 'Descarregar', onclick: () => U.download('ponto-restauro-' + i + '.json', JSON.stringify(s.cfg, null, 2)) }),
        ' ', h('button', { class: 'btn danger', text: '🗑', onclick: () => { const l = snaps(); l.splice(i, 1); localStorage.setItem(K.snaps, JSON.stringify(l)); render(); } })))) : h('tr', null, h('td', { class: 'help', text: 'Ainda não há pontos de restauro neste navegador.' }))));
    body.appendChild(card('Pontos de restauro neste navegador', 'São criados automaticamente antes de publicar, restaurar ou descartar. Ficam apenas neste navegador (máx. 15).', tb));

    const ghBox = h('div', null, h('p', { class: 'help', text: 'Configure o GitHub em "Publicar" para ver aqui os backups guardados no repositório (pasta /backups).' }));
    body.appendChild(card('Backups no GitHub', null, ghBox));
    const gh = ghClient(true);
    if (gh) {
      ghBox.innerHTML = '';
      ghBox.appendChild(h('div', { class: 'row' },
        h('button', { class: 'btn', text: '⬆ Guardar backup agora no GitHub', onclick: async () => { try { const p = await gh.saveBackup(CFG); U.toast('Backup guardado: ' + p); render(); } catch (e) { U.toast(e.message, 'err'); } } }),
        h('button', { class: 'btn', text: '⟳ Listar backups', onclick: async () => {
          try {
            const files = await gh.backups();
            const t = h('table', { class: 'list-table' }, h('tbody', null, files.length ? files.map(f => h('tr', null, h('td', null, h('code', { text: f.name })),
              h('td', null, h('button', { class: 'btn', text: 'Restaurar', onclick: async () => { if (!confirm('Restaurar ' + f.name + '?')) return; try { const c = await gh.readJSON(f.path); snapshot('Antes de restaurar ' + f.name); change(() => { CFG = c; }); U.toast('Restaurado — publique para aplicar'); } catch (e) { U.toast(e.message, 'err'); } } })))) : h('tr', null, h('td', { class: 'help', text: 'Sem backups em /backups.' }))));
            const old = ghBox.querySelector('table'); if (old) old.remove(); ghBox.appendChild(t);
          } catch (e) { U.toast(e.message, 'err'); }
        } })));
    }
  }

  async function fullBackup() {
    if (!window.JSZip) return U.toast('JSZip indisponível', 'err');
    const zip = new JSZip();
    zip.file('config.json', JSON.stringify(CFG, null, 2));
    const assets = Array.from(new Set((JSON.stringify(CFG).match(/assets\/[A-Za-z0-9_\-./]+\.(png|jpe?g|gif|svg|webp)/g) || [])));
    for (const a of assets) { try { const r = await fetch(a); if (r.ok) zip.file(a, await r.blob()); } catch (e) { /* */ } }
    const dados = {};
    Object.values(DS.layers).forEach(l => {
      const rows = l.rows.map(r => { const o = {}; Object.keys(r).forEach(k => { if (!k.startsWith('_')) o[k] = r[k]; }); if (r._geom) { o.x = r._geom.x; o.y = r._geom.y; } return o; });
      dados[l.name] = rows;
      zip.file('dados/' + l.id + '_' + l.name + '.csv', U.toCSV(rows));
    });
    zip.file('dados/dados.json', JSON.stringify({ fonte: DS.source, exportadoEm: new Date().toISOString(), tabelas: dados }));
    zip.file('LEIA-ME.txt', 'Backup do dashboard (' + new Date().toLocaleString('pt-PT') + ')\n\n- config.json: configuração completa do site. Para restaurar: Gestão > Backup > Restaurar de ficheiro (pode usar este .zip directamente), ou substitua o config.json no repositório.\n- assets/: imagens usadas pelo site.\n- dados/: dados de todas as tabelas no momento do backup (fonte: ' + (DS.source === 'mock' ? 'dados fictícios' : 'ArcGIS Online') + ').\n');
    const blob = await zip.generateAsync({ type: 'blob' });
    U.download('backup-dashboard-' + U.stamp() + '.zip', blob);
  }

  async function restoreFile(f) {
    try {
      let cfg;
      if (/\.zip$/i.test(f.name)) {
        const zip = await JSZip.loadAsync(f);
        const cf = zip.file('config.json'); if (!cf) throw new Error('O .zip não contém config.json');
        cfg = JSON.parse(await cf.async('string'));
        // imagens do zip que não existem no site são embutidas para não se perderem
        const txt = JSON.stringify(cfg); let out = txt;
        for (const p of Object.keys(zip.files).filter(n => n.startsWith('assets/') && !zip.files[n].dir)) {
          if (!txt.includes(p)) continue;
          const exists = await fetch(p, { method: 'HEAD' }).then(r => r.ok).catch(() => false);
          if (!exists) { const ext = p.split('.').pop().replace('jpg', 'jpeg').replace('svg', 'svg+xml'); out = out.split('"' + p + '"').join('"data:image/' + ext + ';base64,' + await zip.file(p).async('base64') + '"'); }
        }
        cfg = JSON.parse(out);
      } else cfg = JSON.parse(await f.text());
      if (!cfg.tabs || !cfg.site) throw new Error('Ficheiro não parece ser uma configuração do dashboard');
      if (!confirm('Restaurar a configuração de "' + f.name + '"? A versão actual será guardada num ponto de restauro.')) return;
      snapshot('Antes de restaurar ' + f.name);
      change(() => { CFG = cfg; });
      U.toast('Configuração restaurada — reveja e publique');
    } catch (e) { U.toast('Erro ao restaurar: ' + e.message, 'err'); }
  }

  /* =================== PUBLICAR =================== */
  function getToken() { return sessionStorage.getItem(K.token) || localStorage.getItem(K.token) || ''; }
  function ghClient(silent) {
    const g = CFG.github || {}; const t = getToken();
    if (!g.owner || !g.repo || !t) { if (!silent) U.toast('Configure o repositório e o token do GitHub primeiro', 'warn'); return null; }
    return new GitHubPublisher(g, t);
  }

  function secPublicar(body) {
    const g = CFG.github = CFG.github || { owner: '', repo: '', branch: 'main', path: 'config.json' };
    const c = () => change(null, false);
    if (!g.owner && /github\.io$/.test(location.hostname)) { g.owner = location.hostname.split('.')[0]; g.repo = location.pathname.split('/').filter(Boolean)[0] || (g.owner + '.github.io'); }
    const tok = h('input', { type: 'password', value: getToken(), placeholder: 'github_pat_…', autocomplete: 'off' });
    const rem = h('input', { type: 'checkbox', checked: !!localStorage.getItem(K.token) });
    const saveTok = () => { sessionStorage.setItem(K.token, tok.value); if (rem.checked) localStorage.setItem(K.token, tok.value); else localStorage.removeItem(K.token); };
    tok.onchange = saveTok; rem.onchange = saveTok;

    body.appendChild(card('Repositório GitHub', 'As alterações feitas aqui ficam num <b>rascunho</b> neste navegador. Ao publicar, o ficheiro <code>config.json</code> do repositório é actualizado e o GitHub Pages mostra a nova versão em 1–2 minutos.',
      row(fld('Utilizador / organização', tInput(g, 'owner', { onChange: c })), fld('Repositório', tInput(g, 'repo', { onChange: c }))),
      row(fld('Ramo (branch)', tInput(g, 'branch', { onChange: c })), fld('Ficheiro de configuração', tInput(g, 'path', { onChange: c }))),
      fld('Token de acesso pessoal (fine-grained)', tok, 'Crie em GitHub → Settings → Developer settings → Fine-grained tokens, só para este repositório, com permissão <b>Contents: Read and write</b>. O token nunca é gravado no config.json.'),
      h('label', { class: 'chk' }, rem, 'Lembrar o token neste navegador'),
      h('button', { class: 'btn', text: 'Testar ligação', onclick: async () => { const gh = ghClient(); if (!gh) return; try { const r = await gh.test(); U.toast('Ligação OK: ' + r.full_name); } catch (e) { U.toast(e.message, 'err'); } } })));

    const log = h('div', { class: 'log', text: '' }); log.hidden = true;
    const bk = h('input', { type: 'checkbox', checked: true });
    const msg = h('input', { type: 'text', value: 'Actualização do dashboard via gestão' });
    body.appendChild(card('Publicar alterações', isDirty() ? '<span class="pill warn">Há alterações por publicar</span>' : '<span class="pill ok">Sem alterações por publicar</span>',
      fld('Mensagem da alteração (commit)', msg),
      h('label', { class: 'chk' }, bk, 'Guardar cópia da versão anterior em /backups antes de publicar'),
      h('button', { class: 'btn primary', text: '🚀 Publicar agora', onclick: () => publish(log, bk.checked, msg.value) }), log));

    body.appendChild(card('Alternativa manual', 'Sem token? Descarregue o <code>config.json</code> e substitua-o no repositório (GitHub → Add file → Upload files).',
      h('button', { class: 'btn', text: '⬇ Descarregar config.json', onclick: () => U.download('config.json', JSON.stringify(Object.assign({}, CFG, { updatedAt: new Date().toISOString() }), null, 2)) })));
  }

  async function publish(logEl, backup, message) {
    const gh = ghClient(); if (!gh) { section = 'publicar'; render(); return; }
    const L = (t) => { if (logEl) { logEl.hidden = false; logEl.textContent += t + '\n'; } };
    try {
      snapshot('Antes de publicar');
      const clean = await gh.publish(CFG, { backup, message, log: L });
      PUB = U.clone(clean); CFG = U.clone(clean); saveDraft();
      L('✓ Publicado. O GitHub Pages actualiza em 1–2 minutos.');
      U.toast('Publicado com sucesso');
      if (!logEl) render();
    } catch (e) { L('✗ ' + e.message); U.toast(e.message, 'err'); }
  }

  /* =================== SEGURANÇA =================== */
  function secSeguranca(body) {
    const cur = h('input', { type: 'password', autocomplete: 'current-password' }), n1 = h('input', { type: 'password', autocomplete: 'new-password' }), n2 = h('input', { type: 'password', autocomplete: 'new-password' });
    body.appendChild(card('Alterar palavra-passe de gestão', 'A nova palavra-passe só passa a valer no site depois de <b>publicar</b>.',
      fld('Palavra-passe actual', cur), row(fld('Nova palavra-passe', n1), fld('Repetir nova palavra-passe', n2)),
      h('button', { class: 'btn primary', text: 'Alterar', onclick: async () => {
        if (await U.sha256(cur.value) !== (CFG.admin || {}).passwordHash) return U.toast('Palavra-passe actual incorrecta', 'err');
        if (n1.value.length < 8) return U.toast('Use pelo menos 8 caracteres', 'err');
        if (n1.value !== n2.value) return U.toast('As palavras-passe não coincidem', 'err');
        const hsh = await U.sha256(n1.value);
        change(() => { CFG.admin = CFG.admin || {}; CFG.admin.passwordHash = hsh; });
        sessionStorage.setItem(K.auth, hsh);
        U.toast('Palavra-passe alterada — publique para aplicar');
      } })));
    body.appendChild(card('Como funciona a segurança', null, h('div', { class: 'help', html:
      '<p>O GitHub Pages só serve ficheiros estáticos, por isso a palavra-passe de gestão apenas esconde o editor — não é uma protecção forte.</p>' +
      '<p>A protecção real está na <b>publicação</b>: só quem tem um token do GitHub com permissão de escrita no repositório consegue alterar o site público. Qualquer outra pessoa que abra a gestão só altera um rascunho no seu próprio navegador.</p>' +
      '<p>Boas práticas: use tokens <i>fine-grained</i> limitados a este repositório, com validade curta, e não marque "Lembrar o token" em computadores partilhados.</p>' }),
      h('button', { class: 'btn danger', text: 'Esquecer token guardado neste navegador', onclick: () => { localStorage.removeItem(K.token); sessionStorage.removeItem(K.token); U.toast('Token removido'); } })));
  }

  /* =================== ARRANQUE =================== */
  async function loadPublished() {
    try { const r = await fetch('config.json?v=' + Date.now(), { cache: 'no-store' }); if (r.ok) return await r.json(); } catch (e) { /* */ }
    return window.EMBEDDED_CONFIG ? U.clone(window.EMBEDDED_CONFIG) : null;
  }

  async function start() {
    PUB = await loadPublished();
    let draft = null; try { draft = JSON.parse(localStorage.getItem(K.draft) || 'null'); } catch (e) { /* */ }
    if (!PUB && !draft) { document.body.innerHTML = '<p style="padding:40px">Não foi possível carregar config.json.</p>'; return; }
    if (!PUB) PUB = U.clone(draft);
    // rascunho antigo de uma versão já ultrapassada pelo publicado?
    if (draft && PUB.updatedAt && draft.updatedAt && draft.updatedAt < PUB.updatedAt && strip(draft) !== strip(PUB)) {
      if (!confirm('Existe um rascunho local mais antigo do que a versão publicada. Continuar com o rascunho? (Cancelar = usar a versão publicada; o rascunho fica num ponto de restauro)')) { CFG = draft; snapshot('Rascunho antigo'); draft = null; }
    }
    CFG = U.clone(draft || PUB);

    const hash = (PUB.admin || {}).passwordHash || (CFG.admin || {}).passwordHash;
    if (sessionStorage.getItem(K.auth) && (sessionStorage.getItem(K.auth) === hash || sessionStorage.getItem(K.auth) === (CFG.admin || {}).passwordHash)) return open();
    U.$('#login').hidden = false;
    U.$('#login-pass').focus();
    U.$('#login-form').onsubmit = async (e) => {
      e.preventDefault();
      const v = await U.sha256(U.$('#login-pass').value);
      if (v === hash) { sessionStorage.setItem(K.auth, v); U.$('#login').hidden = true; open(); }
      else { U.toast('Palavra-passe incorrecta', 'err'); U.$('#login-pass').select(); }
    };
  }

  async function open() {
    U.$('#app').hidden = false;
    document.documentElement.style.setProperty('--primary', CFG.site.primaryColor || '#1F5C45');
    U.$('#sec-body').innerHTML = '<div class="loading"><div class="spinner"></div>A carregar estrutura dos dados…</div>';
    await DS.load(CFG);
    localStorage.setItem(K.draft, JSON.stringify(CFG));
    lastSaved = JSON.stringify(CFG);
    if (localStorage.getItem('dash_hide_preview') === '1') U.$('#app').classList.add('no-preview');
    render();
    previewTo(selTab);

    U.$$('#side-nav a').forEach(a => a.addEventListener('click', () => { section = a.dataset.sec; render(); }));
    U.$('#btn-undo').onclick = doUndo;
    U.$('#btn-toggle-preview').onclick = () => { const a = U.$('#app'); a.classList.toggle('no-preview'); localStorage.setItem('dash_hide_preview', a.classList.contains('no-preview') ? '1' : '0'); if (!a.classList.contains('no-preview')) reloadPreview(); };
    U.$('#btn-publish-quick').onclick = () => { if (ghClient(true)) { if (confirm('Publicar as alterações no site?')) publish(null, true); } else { section = 'publicar'; render(); U.toast('Configure o GitHub para publicar', 'warn'); } };
    U.$('#pv-reload').onclick = () => { U.$('#pv-frame').contentWindow.location.reload(); };
    U.$('#modal-close').onclick = closeModal;
    U.$('#logout').onclick = (e) => { e.preventDefault(); sessionStorage.removeItem(K.auth); location.reload(); };
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !/INPUT|TEXTAREA/.test(document.activeElement.tagName) && !document.activeElement.isContentEditable) { e.preventDefault(); doUndo(); }
      if (e.key === 'Escape' && !U.$('#modal').hidden) closeModal();
    });
    window.addEventListener('beforeunload', () => { localStorage.setItem(K.draft, JSON.stringify(CFG)); });
  }

  document.addEventListener('DOMContentLoaded', start);
})();
