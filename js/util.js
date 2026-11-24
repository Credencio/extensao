/* Utilitários partilhados (dashboard e gestão) */
(function (global) {
  'use strict';

  const U = {};

  U.$ = (sel, root) => (root || document).querySelector(sel);
  U.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  U.uid = (prefix) => (prefix || 'id') + '_' + Math.random().toString(36).slice(2, 9);

  U.guid = function () {
    if (global.crypto && crypto.randomUUID) return '{' + crypto.randomUUID().toUpperCase() + '}';
    return '{' + 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    }).toUpperCase() + '}';
  };

  U.normGuid = (g) => (g == null ? '' : String(g).replace(/[{}]/g, '').toLowerCase());

  U.clone = (o) => JSON.parse(JSON.stringify(o));

  U.esc = function (s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  };

  /* Remove scripts e handlers inline de HTML editado na gestão */
  U.sanitizeHtml = function (html) {
    const tpl = document.createElement('template');
    tpl.innerHTML = html || '';
    tpl.content.querySelectorAll('script,style[data-unsafe],object,embed').forEach(n => n.remove());
    tpl.content.querySelectorAll('*').forEach(el => {
      Array.from(el.attributes).forEach(a => {
        const n = a.name.toLowerCase();
        const v = (a.value || '').trim().toLowerCase();
        if (n.startsWith('on')) el.removeAttribute(a.name);
        if ((n === 'href' || n === 'src') && v.startsWith('javascript:')) el.removeAttribute(a.name);
      });
    });
    return tpl.innerHTML;
  };

  U.fmtNumber = function (v, decimals) {
    if (v == null || isNaN(v)) return '—';
    const d = decimals == null ? (Math.abs(v) < 10 && v % 1 !== 0 ? 1 : 0) : decimals;
    return Number(v).toLocaleString('pt-PT', { minimumFractionDigits: d, maximumFractionDigits: d });
  };

  U.fmtDate = function (v, withTime) {
    if (v == null || v === '') return '';
    const d = new Date(v);
    if (isNaN(d)) return String(v);
    const opts = { day: '2-digit', month: '2-digit', year: 'numeric' };
    if (withTime) { opts.hour = '2-digit'; opts.minute = '2-digit'; }
    return d.toLocaleDateString('pt-PT', opts);
  };

  U.monthKey = (v) => { const d = new Date(v); return isNaN(d) ? null : d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
  U.monthLabel = (k) => {
    const [y, m] = k.split('-');
    const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return nomes[+m - 1] + ' ' + y.slice(2);
  };

  U.debounce = function (fn, ms) {
    let t; return function () { clearTimeout(t); const a = arguments, self = this; t = setTimeout(() => fn.apply(self, a), ms || 250); };
  };

  U.sha256 = async function (text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  };

  U.download = function (filename, content, mime) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime || 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  U.stamp = function () {
    const d = new Date(), p = n => String(n).padStart(2, '0');
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());
  };

  U.toCSV = function (rows, columns) {
    const cols = columns || Array.from(rows.reduce((s, r) => { Object.keys(r).forEach(k => { if (!k.startsWith('_')) s.add(k); }); return s; }, new Set()));
    const q = v => { if (v == null) return ''; const s = String(v); return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    return '﻿' + [cols.join(',')].concat(rows.map(r => cols.map(c => q(r[c])).join(','))).join('\n');
  };

  U.toast = function (msg, type) {
    let box = document.getElementById('toasts');
    if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
    const t = document.createElement('div');
    t.className = 'toast ' + (type || 'ok');
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3500);
  };

  /* Redimensiona imagem carregada e devolve dataURL (para não pesar no config) */
  U.readImage = function (file, maxSize) {
    return new Promise((resolve, reject) => {
      if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
        const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file); return;
      }
      const img = new Image();
      img.onload = () => {
        const max = maxSize || 1600;
        let { width: w, height: h } = img;
        if (w > max || h > max) { const k = max / Math.max(w, h); w = Math.round(w * k); h = Math.round(h * k); }
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        const png = file.type === 'image/png';
        resolve(c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.85));
        URL.revokeObjectURL(img.src);
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  };

  U.palette = ['#2E7D5B', '#E0A526', '#3A6EA5', '#C8553D', '#7B5EA7', '#4BA3A3', '#8C6D46', '#D17FA8', '#6B8E23', '#5C6B7A', '#F28C28', '#1F4E79'];

  global.U = U;
})(window);
