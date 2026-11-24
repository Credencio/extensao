/* Exportações: relatório geral em PDF, dados em Excel (brutos e analisados) e imagem estática de mapas */
(function (global) {
  'use strict';
  const DS = global.DataStore, W = global.Widgets;
  const E = {};

  /* ---------- utilitários ---------- */
  function loadImg(src, timeout) {
    return new Promise((resolve) => {
      const img = new Image(); img.crossOrigin = 'anonymous';
      const t = setTimeout(() => resolve(null), timeout || 6000);
      img.onload = () => { clearTimeout(t); resolve(img); };
      img.onerror = () => { clearTimeout(t); resolve(null); };
      img.src = src;
    });
  }
  async function rasterize(src, maxW) {
    const img = await loadImg(src, 6000); if (!img) return null;
    const w = img.naturalWidth || 300, h = img.naturalHeight || 300;
    const k = Math.min(1, (maxW || 1200) / w);
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    try { return { url: c.toDataURL('image/png'), w: c.width, h: c.height }; } catch (e) { return null; }
  }
  const dataUrlBytes = (u) => Uint8Array.from(atob(u.split(',')[1]), c => c.charCodeAt(0));
  const hexRgb = (hex) => { const h = (hex || '#1F5C45').replace('#', ''); const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
  function filtersText() {
    const F = DS.filters || {}, root = DS.rootId, out = [];
    Object.keys(F).forEach(k => { if (!k.startsWith('__') && F[k] && F[k].length) out.push(DS.fieldLabel(root, k) + ': ' + F[k].map(v => DS.display(root, k, v)).join(', ')); });
    if (F.__from) out.push('De: ' + U.fmtDate(F.__from));
    if (F.__to) out.push('Até: ' + U.fmtDate(F.__to));
    return out;
  }
  function progress(msg) {
    let p = document.getElementById('export-progress');
    if (!msg) { if (p) p.remove(); return; }
    if (!p) { p = document.createElement('div'); p.id = 'export-progress'; p.innerHTML = '<div><div class="spinner"></div><span></span></div>'; document.body.appendChild(p); }
    p.querySelector('span').textContent = msg;
  }
  const nextFrame = () => new Promise(r => setTimeout(r, 30));
  const visibleTabs = (cfg) => (cfg.tabs || []).filter(t => t.visible !== false);
  const visibleWidgets = (tab) => (tab.widgets || []).filter(w => !w.hidden);

  /* ---------- mapa estático (PNG) ---------- */
  const TS = 256;
  const lon2x = (lon, z) => (lon + 180) / 360 * TS * Math.pow(2, z);
  const lat2y = (lat, z) => { const s = Math.sin(lat * Math.PI / 180); return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * TS * Math.pow(2, z); };

  E.staticMap = async function (w, Wd, Hd) {
    Wd = Wd || 1200; Hd = Hd || 750;
    const P = W.mapPoints(w);
    const pts = P.rows.map(r => r._geom || r._geomInherited);
    let z = 5, cx, cy;
    if (pts.length) {
      const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
      const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
      for (z = 12; z > 2; z--) { if (lon2x(maxX, z) - lon2x(minX, z) < Wd - 160 && lat2y(minY, z) - lat2y(maxY, z) < Hd - 160) break; }
      cx = (lon2x(minX, z) + lon2x(maxX, z)) / 2; cy = (lat2y(minY, z) + lat2y(maxY, z)) / 2;
    } else { cx = lon2x(35.5, z); cy = lat2y(-18.5, z); }
    const x0 = cx - Wd / 2, y0 = cy - Hd / 2;
    const bm = W.BASEMAPS[W.basemapKey(w.basemap)];
    const c = document.createElement('canvas'); c.width = Wd; c.height = Hd;
    const g = c.getContext('2d');

    async function drawTiles(url) {
      const jobs = [];
      const n = Math.pow(2, z);
      for (let tx = Math.floor(x0 / TS); tx <= Math.floor((x0 + Wd) / TS); tx++) {
        for (let ty = Math.floor(y0 / TS); ty <= Math.floor((y0 + Hd) / TS); ty++) {
          if (ty < 0 || ty >= n) continue;
          const wx = ((tx % n) + n) % n;
          const src = url.replace('{z}', z).replace('{x}', wx).replace('{y}', ty).replace('{s}', 'a');
          jobs.push(loadImg(src, 7000).then(img => { if (img) g.drawImage(img, tx * TS - x0, ty * TS - y0); }));
        }
      }
      await Promise.all(jobs);
    }
    function drawOverlay() {
      pts.forEach((p, i) => {
        const k = w.colorBy ? String(DS.val(P.rows[i], w.colorBy) ?? '') : '';
        const x = lon2x(p.x, z) - x0, y = lat2y(p.y, z) - y0;
        g.beginPath(); g.arc(x, y, Wd / 150, 0, Math.PI * 2);
        g.fillStyle = P.colors[k]; g.globalAlpha = 0.92; g.fill(); g.globalAlpha = 1;
        g.lineWidth = Wd / 600; g.strokeStyle = '#fff'; g.stroke();
      });
      const fs = Math.round(Wd / 62);
      if (w.colorBy && P.keys.length) {
        g.font = fs + 'px Arial, sans-serif';
        const items = P.keys.map(k => (DS.display(w.layer, w.colorBy, k) || '(vazio)') + ' (' + P.counts.get(k) + ')');
        const bw = Math.max(...items.map(t => g.measureText(t).width)) + fs * 3, lh = fs * 1.5, bh = items.length * lh + fs * 1.2;
        const bx = fs, by = Hd - bh - fs;
        g.fillStyle = 'rgba(255,255,255,.93)'; g.fillRect(bx, by, bw, bh);
        items.forEach((t, i) => {
          g.fillStyle = P.colors[P.keys[i]]; g.fillRect(bx + fs * 0.7, by + fs * 0.6 + i * lh + fs * 0.15, fs * 0.9, fs * 0.9);
          g.fillStyle = '#222'; g.fillText(t, bx + fs * 2.1, by + fs * 0.6 + i * lh + fs * 0.95);
        });
      }
      g.font = Math.round(fs * 0.75) + 'px Arial, sans-serif'; g.fillStyle = 'rgba(255,255,255,.8)';
      const at = bm.attr; const aw = g.measureText(at).width + 12;
      g.fillRect(Wd - aw, Hd - fs * 1.2, aw, fs * 1.2); g.fillStyle = '#333'; g.fillText(at, Wd - aw + 6, Hd - fs * 0.35);
    }
    g.fillStyle = '#E9ECEA'; g.fillRect(0, 0, Wd, Hd);
    await drawTiles(bm.base);
    if (bm.ref) await drawTiles(bm.ref);
    drawOverlay();
    try { return c.toDataURL('image/png'); }
    catch (e) { // fundo bloqueado pelo navegador (CORS): gera sem fundo
      g.fillStyle = '#E9ECEA'; g.fillRect(0, 0, Wd, Hd); drawOverlay(); return c.toDataURL('image/png');
    }
  };

  /* ---------- gráfico fora do ecrã (para PDF) ---------- */
  let holder = null;
  async function chartImage(w, cssW, cssH) {
    if (!global.Chart) return null;
    const d = W.chartData(w); if (!d.labels.length) return null;
    if (!holder) { holder = document.createElement('div'); holder.style.cssText = 'position:fixed;left:-10000px;top:0;width:2000px;height:2000px;overflow:hidden;'; document.body.appendChild(holder); }
    const cv = document.createElement('canvas'); cv.width = cssW; cv.height = cssH; cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
    holder.appendChild(cv);
    const cfg = W.chartConfig(w, d, true);
    cfg.plugins = [{ id: 'bg', beforeDraw: (ch) => { const x = ch.ctx; x.save(); x.fillStyle = '#fff'; x.fillRect(0, 0, ch.width, ch.height); x.restore(); } }];
    const ch = new Chart(cv, cfg);
    await nextFrame();
    let url = null; try { url = ch.toBase64Image('image/png', 1); } catch (e) { /* */ }
    ch.destroy(); cv.remove();
    return url;
  }

  /* =================== EXCEL =================== */
  E.excel = async function (mode, cfg) {
    progress('A preparar ficheiro Excel…'); await nextFrame();
    try {
      const sheets = [];
      const f = filtersText();
      sheets.push({ name: 'Info', header: false, rows: [
        [cfg.site.title || 'Dashboard'], ['Exportado em', new Date().toLocaleString('pt-PT')],
        ['Fonte dos dados', DS.source === 'mock' ? 'Dados fictícios (demonstração)' : 'ArcGIS Online — ' + (cfg.dataSource || {}).serviceUrl],
        ['Filtros aplicados', f.length ? f.join(' | ') : 'Nenhum (todos os registos)'],
        ['Conteúdo', mode === 'raw' ? 'Dados brutos (uma folha por tabela)' : mode === 'analysed' ? 'Dados analisados (indicadores, gráficos e tabelas do dashboard)' : 'Dados analisados + dados brutos'],
        [], ['Relações', 'As tabelas-filhas ligam-se à tabela-mãe pela coluna parentglobalid = globalid da tabela-mãe.']
      ] });

      if (mode !== 'raw') {
        const kpis = [['Aba', 'Indicador', 'Valor', 'Cálculo', 'Campo', 'Fonte (tabela)']];
        visibleTabs(cfg).forEach(t => visibleWidgets(t).forEach(w => {
          if (w.type === 'kpi' && DS.layers[w.layer]) kpis.push([t.title, w.title || '', +(+W.kpiValue(w) || 0).toFixed(4), W.AGGS[w.agg || 'count'], w.field ? DS.fieldLabel(w.layer, w.field) : '', DS.layers[w.layer].label]);
        }));
        sheets.push({ name: 'Indicadores', rows: kpis });
        visibleTabs(cfg).forEach(t => visibleWidgets(t).forEach(w => {
          if ((w.type === 'chart' || w.type === 'table' || w.type === 'map') && DS.layers[w.layer]) {
            const td = W.tableData(w);
            sheets.push({ name: (w.type === 'chart' ? '' : w.type === 'map' ? 'Mapa - ' : 'Tab - ') + (w.title || t.title), rows: [td.columns].concat(td.rows) });
          }
        }));
      }
      if (mode !== 'analysed') {
        Object.values(DS.layers).sort((a, b) => a.id - b.id).forEach(l => {
          const fields = l.fields.filter(fd => !/^Shape__/i.test(fd.name));
          const geo = l.rows.some(r => r._geom);
          const head = fields.map(fd => fd.name).concat(geo ? ['x (longitude)', 'y (latitude)'] : []);
          const dateCols = fields.map((fd, i) => fd.type === 'esriFieldTypeDate' ? i : -1).filter(i => i >= 0);
          const rows = DS.rows(l.id).map(r => fields.map(fd => r[fd.name] == null ? '' : r[fd.name]).concat(geo ? [r._geom ? r._geom.x : '', r._geom ? r._geom.y : ''] : []));
          sheets.push({ name: l.label || l.name, rows: [head].concat(rows), dateCols });
        });
        // dicionário de campos
        const dict = [['Tabela', 'Campo', 'Descrição (alias)', 'Tipo', 'Valores possíveis']];
        Object.values(DS.layers).sort((a, b) => a.id - b.id).forEach(l => l.fields.forEach(fd => dict.push([l.name, fd.name, fd.alias || '', (fd.type || '').replace('esriFieldType', ''), fd.domain && fd.domain.codedValues ? fd.domain.codedValues.map(c => c.code + '=' + c.name).join('; ') : ''])));
        sheets.push({ name: 'Dicionário de campos', rows: dict });
      }
      progress('A gerar .xlsx…'); await nextFrame();
      const blob = await XLSX_LITE.build(sheets);
      U.download('dados-' + (mode === 'raw' ? 'brutos' : mode === 'analysed' ? 'analisados' : 'completos') + '-' + U.stamp() + '.xlsx', blob);
    } catch (e) { console.error(e); U.toast('Erro ao exportar Excel: ' + e.message, 'err'); }
    finally { progress(null); }
  };

  /* =================== RELATÓRIO PDF =================== */
  E.pdfReport = async function (cfg) {
    if (!global.PDFLib) return U.toast('Biblioteca PDF indisponível', 'err');
    const { PDFDocument, StandardFonts, rgb } = PDFLib;
    progress('A preparar relatório…'); await nextFrame();
    try {
      const doc = await PDFDocument.create();
      doc.setTitle(cfg.site.title || 'Relatório'); doc.setCreator('Dashboard'); doc.setCreationDate(new Date());
      const F = await doc.embedFont(StandardFonts.Helvetica), FB = await doc.embedFont(StandardFonts.HelveticaBold);
      const PW = 595.28, PH = 841.89, M = 40, CW = PW - 2 * M, BOTTOM = 50;
      const prim = rgb.apply(null, hexRgb(cfg.site.primaryColor)), acc = rgb.apply(null, hexRgb(cfg.site.accentColor || '#E0A526'));
      const ink = rgb(0.11, 0.14, 0.13), muted = rgb(0.4, 0.44, 0.42), line = rgb(0.88, 0.87, 0.83);

      // texto compatível com as fontes PDF padrão (remove emojis e símbolos não suportados)
      const okCache = {};
      const REPL = { '≤': '<=', '≥': '>=', '→': '->', '←': '<-', '↑': '', '⇈': '', '✓': 'v', '✗': 'x', ' ': ' ', ' ': ' ' };
      const clean = (s) => Array.from(String(s == null ? '' : s)).map(ch => {
        if (REPL[ch] != null) return REPL[ch];
        if (okCache[ch] == null) { try { F.widthOfTextAtSize(ch, 10); okCache[ch] = true; } catch (e) { okCache[ch] = false; } }
        return okCache[ch] ? ch : '';
      }).join('').replace(/\s+/g, ' ').trim();
      const wrap = (text, font, size, maxW) => {
        const words = clean(text).split(' '); const lines = []; let cur = '';
        words.forEach(wd => { const t = cur ? cur + ' ' + wd : wd; if (font.widthOfTextAtSize(t, size) > maxW && cur) { lines.push(cur); cur = wd; } else cur = t; });
        if (cur) lines.push(cur); return lines;
      };
      const fit = (text, font, size, maxW) => { let t = clean(text); if (font.widthOfTextAtSize(t, size) <= maxW) return t; while (t.length > 1 && font.widthOfTextAtSize(t + '…', size) > maxW) t = t.slice(0, -1); return t + '…'; };

      let page, y;
      const newPage = () => {
        page = doc.addPage([PW, PH]); y = PH - M;
        page.drawRectangle({ x: 0, y: PH - 6, width: PW, height: 6, color: prim });
        page.drawText(fit(cfg.site.title || '', F, 8, CW - 100), { x: M, y: PH - 24, size: 8, font: F, color: muted });
        y = PH - 44;
      };
      const ensure = (h) => { if (y - h < BOTTOM) newPage(); };
      const text = (s, o) => {
        const size = o.size || 10, font = o.bold ? FB : F, maxW = o.width || CW, x = o.x || M, lh = size * 1.35;
        wrap(s, font, size, maxW).forEach(l => { ensure(lh); page.drawText(l, { x, y: y - size, size, font, color: o.color || ink }); y -= lh; });
      };
      const embedPng = async (url) => { try { return await doc.embedPng(dataUrlBytes(url)); } catch (e) { return null; } };

      /* --- capa --- */
      page = doc.addPage([PW, PH]);
      page.drawRectangle({ x: 0, y: PH - 230, width: PW, height: 230, color: prim });
      page.drawRectangle({ x: M, y: PH - 236, width: 80, height: 6, color: acc });
      let tx = M;
      if (cfg.site.logo) { const r = await rasterize(cfg.site.logo, 240); const im = r && await embedPng(r.url); if (im) { const s = 64 / Math.max(im.width, im.height); page.drawImage(im, { x: M, y: PH - 120, width: im.width * s, height: im.height * s }); tx = M; } }
      y = PH - 140;
      wrap(cfg.site.title || 'Relatório', FB, 24, CW).forEach(l => { page.drawText(l, { x: tx, y, size: 24, font: FB, color: rgb(1, 1, 1) }); y -= 30; });
      wrap(cfg.site.subtitle || '', F, 11, CW).forEach(l => { page.drawText(l, { x: tx, y: y + 6, size: 11, font: F, color: rgb(0.9, 0.95, 0.92) }); y -= 15; });
      y = PH - 270;
      text('Relatório geral', { size: 16, bold: true });
      y -= 4;
      const meta = [['Gerado em', new Date().toLocaleString('pt-PT')], ['Fonte dos dados', DS.source === 'mock' ? 'Dados fictícios (demonstração)' : 'ArcGIS Online (Survey123)'], ['Filtros aplicados', filtersText().join(' | ') || 'Nenhum — todos os registos']];
      meta.forEach(([k, v]) => { ensure(16); page.drawText(clean(k), { x: M, y: y - 10, size: 10, font: FB, color: muted }); const ls = wrap(v, F, 10, CW - 120); ls.forEach((l, i) => page.drawText(l, { x: M + 120, y: y - 10 - i * 13, size: 10, font: F, color: ink })); y -= 13 * ls.length + 6; });
      y -= 10;
      text('Registos por tabela', { size: 12, bold: true }); y -= 2;
      Object.values(DS.layers).sort((a, b) => a.id - b.id).forEach((l, i) => {
        ensure(16);
        if (i % 2 === 0) page.drawRectangle({ x: M, y: y - 14, width: CW, height: 16, color: rgb(0.965, 0.96, 0.94) });
        page.drawText(fit(l.label, F, 9.5, CW - 90), { x: M + 6, y: y - 10, size: 9.5, font: F, color: ink });
        const n = U.fmtNumber(DS.rows(l.id).length, 0); page.drawText(clean(n), { x: M + CW - 6 - F.widthOfTextAtSize(clean(n), 9.5), y: y - 10, size: 9.5, font: FB, color: ink });
        y -= 16;
      });
      y -= 12;
      text('Conteúdo: ' + visibleTabs(cfg).map(t => t.title).join(' · '), { size: 9.5, color: muted });

      /* --- secções (uma por aba) --- */
      const tabs = visibleTabs(cfg);
      for (let ti = 0; ti < tabs.length; ti++) {
        const tab = tabs[ti];
        progress('A gerar relatório: ' + tab.title + ' (' + (ti + 1) + '/' + tabs.length + ')'); await nextFrame();
        newPage();
        page.drawRectangle({ x: M, y: y - 22, width: 5, height: 22, color: acc });
        page.drawText(fit(tab.title, FB, 17, CW - 20), { x: M + 14, y: y - 18, size: 17, font: FB, color: ink }); y -= 34;
        if (tab.description) { const d = document.createElement('div'); d.innerHTML = U.sanitizeHtml(tab.description); text(d.textContent, { size: 9.5, color: muted }); y -= 4; }

        const ws = visibleWidgets(tab);
        let i = 0;
        while (i < ws.length) {
          const w = ws[i];
          if (w.type === 'kpi') { // grelha de indicadores (até 4 por linha)
            const group = []; while (i < ws.length && ws[i].type === 'kpi') group.push(ws[i++]);
            for (let k = 0; k < group.length; k += 4) {
              const rowW = group.slice(k, k + 4), gap = 8, bw = (CW - gap * (rowW.length - 1)) / rowW.length, bh = 54;
              ensure(bh + 8);
              rowW.forEach((kw, j) => {
                const x = M + j * (bw + gap);
                page.drawRectangle({ x, y: y - bh, width: bw, height: bh, color: rgb(0.975, 0.97, 0.955), borderColor: line, borderWidth: 0.8 });
                page.drawRectangle({ x, y: y - bh, width: 3, height: bh, color: kw.color ? rgb.apply(null, hexRgb(kw.color)) : prim });
                const v = DS.layers[kw.layer] ? W.kpiText(kw, W.kpiValue(kw)) : '—';
                page.drawText(fit(v, FB, 17, bw - 16), { x: x + 10, y: y - 25, size: 17, font: FB, color: kw.color ? rgb.apply(null, hexRgb(kw.color)) : prim });
                wrap(kw.title || '', F, 8, bw - 16).slice(0, 2).forEach((l, n) => page.drawText(l, { x: x + 10, y: y - 37 - n * 9.5, size: 8, font: F, color: muted }));
              });
              y -= bh + 10;
            }
            continue;
          }
          if (w.type === 'text') {
            const tpl = document.createElement('template'); tpl.innerHTML = U.sanitizeHtml(w.html || '');
            if (w.title) text(w.title, { size: 12, bold: true });
            Array.from(tpl.content.childNodes).forEach(n => {
              const tag = (n.nodeName || '').toLowerCase();
              if (/^h[1-3]$/.test(tag)) { y -= 2; text(n.textContent, { size: tag === 'h3' ? 11.5 : 13.5, bold: true }); }
              else if (tag === 'ul' || tag === 'ol') Array.from(n.querySelectorAll('li')).forEach((li, k) => text((tag === 'ol' ? (k + 1) + '. ' : '• ') + li.textContent, { size: 10, x: M + 10, width: CW - 10 }));
              else if (n.textContent && n.textContent.trim()) text(n.textContent, { size: 10 });
              if (n.nodeType === 1 || (n.textContent || '').trim()) y -= 3;
            });
            y -= 8; i++; continue;
          }
          // gráficos, mapas e imagens: lado a lado quando ambos ocupam metade ou menos
          const isVisual = (x) => x && (x.type === 'chart' || x.type === 'map' || x.type === 'image');
          const half = (x) => isVisual(x) && (+x.width || 12) <= 6;
          if (isVisual(w)) {
            const pair = half(w) && half(ws[i + 1]) ? [w, ws[i + 1]] : [w];
            const gap = 14, bw = pair.length === 2 ? (CW - gap) / 2 : CW;
            const items = [];
            for (const pw of pair) {
              let url = null, ar = 0.56;
              if (pw.type === 'chart' && DS.layers[pw.layer]) { const round = pw.chartType === 'pie' || pw.chartType === 'doughnut'; ar = round ? 0.62 : (pair.length === 2 ? 0.72 : 0.5); const px = Math.round(bw * 1.6); url = await chartImage(pw, px, Math.round(px * ar)); }
              else if (pw.type === 'map' && DS.layers[pw.layer]) { ar = 0.62; url = await E.staticMap(pw, 1400, Math.round(1400 * ar)); }
              else if (pw.type === 'image' && pw.src) { const r = await rasterize(pw.src, 1400); if (r) { url = r.url; ar = Math.min(0.75, r.h / r.w); } }
              items.push({ w: pw, img: url ? await embedPng(url) : null, ar });
            }
            const titleH = Math.max(...items.map(it => (it.w.title ? 16 : 0) + (it.w.subtitle ? 11 : 0)));
            const imgH = Math.max(...items.map(it => bw * it.ar));
            ensure(titleH + imgH + 14);
            items.forEach((it, j) => {
              const x = M + j * (bw + gap); let yy = y;
              if (it.w.title) { page.drawText(fit(it.w.title, FB, 10.5, bw), { x, y: yy - 11, size: 10.5, font: FB, color: ink }); yy -= 16; }
              if (it.w.subtitle) { page.drawText(fit(it.w.subtitle, F, 8, bw), { x, y: yy - 8, size: 8, font: F, color: muted }); yy -= 11; }
              yy = y - titleH;
              if (it.img) page.drawImage(it.img, { x, y: yy - bw * it.ar, width: bw, height: bw * it.ar });
              else { page.drawRectangle({ x, y: yy - 40, width: bw, height: 40, borderColor: line, borderWidth: 0.8 }); page.drawText('Sem dados para os filtros seleccionados', { x: x + 10, y: yy - 24, size: 9, font: F, color: muted }); }
            });
            y -= titleH + imgH + 16; i += pair.length; continue;
          }
          if (w.type === 'table' && DS.layers[w.layer]) {
            const td = W.tableData(w);
            const maxCols = 6, maxRows = 18;
            const cols = td.columns.slice(0, maxCols), rows = td.rows.slice(0, maxRows);
            const cw = CW / cols.length, fs = 7.5, rh = 14;
            ensure(16 + rh * 3);
            if (w.title) text(w.title, { size: 10.5, bold: true });
            const header = () => { ensure(rh); page.drawRectangle({ x: M, y: y - rh, width: CW, height: rh, color: prim }); cols.forEach((c, k) => page.drawText(fit(c, FB, fs, cw - 6), { x: M + k * cw + 3, y: y - rh + 4.5, size: fs, font: FB, color: rgb(1, 1, 1) })); y -= rh; };
            header();
            rows.forEach((r, n) => {
              if (y - rh < BOTTOM) { newPage(); header(); }
              if (n % 2) page.drawRectangle({ x: M, y: y - rh, width: CW, height: rh, color: rgb(0.97, 0.965, 0.95) });
              cols.forEach((c, k) => { const v = r[k]; const s = typeof v === 'number' ? U.fmtNumber(v) : (v == null ? '' : String(v)); const t = fit(s, F, fs, cw - 6); page.drawText(t, { x: typeof v === 'number' ? M + (k + 1) * cw - 3 - F.widthOfTextAtSize(t, fs) : M + k * cw + 3, y: y - rh + 4.5, size: fs, font: F, color: ink }); });
              y -= rh;
            });
            const note = 'A mostrar ' + rows.length + ' de ' + U.fmtNumber(td.rows.length, 0) + ' registos' + (td.columns.length > maxCols ? ' e ' + maxCols + ' de ' + td.columns.length + ' colunas' : '') + '. Lista completa na exportação Excel.';
            y -= 2; text(note, { size: 7.5, color: muted }); y -= 10; i++; continue;
          }
          i++; // iframes e outros não entram no PDF
        }
      }

      /* --- rodapés e numeração --- */
      const pages = doc.getPages();
      pages.forEach((p, n) => {
        p.drawLine({ start: { x: M, y: 34 }, end: { x: PW - M, y: 34 }, thickness: 0.5, color: line });
        const ft = document.createElement('div'); ft.innerHTML = U.sanitizeHtml(cfg.site.footerText || '');
        p.drawText(fit(ft.textContent, F, 7.5, CW - 80), { x: M, y: 22, size: 7.5, font: F, color: muted });
        const pn = 'Página ' + (n + 1) + ' de ' + pages.length;
        p.drawText(pn, { x: PW - M - F.widthOfTextAtSize(pn, 7.5), y: 22, size: 7.5, font: F, color: muted });
      });

      progress('A guardar PDF…'); await nextFrame();
      const bytes = await doc.save();
      U.download('relatorio-' + U.stamp() + '.pdf', new Blob([bytes], { type: 'application/pdf' }));
    } catch (e) { console.error(e); U.toast('Erro ao gerar o PDF: ' + e.message, 'err'); }
    finally { progress(null); }
  };

  global.Exporter = E;
})(window);
