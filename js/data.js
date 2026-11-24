/* Camada de dados: carrega o feature service do ArcGIS Online (ou dados fictícios),
   liga as tabelas por globalid -> parentglobalid e oferece filtros e agregações. */
(function (global) {
  'use strict';

  const DS = {
    source: null,       // 'arcgis' | 'mock'
    layers: {},         // id -> { id, name, label, type, geometryType, parentId, fields, fieldMap, rows, index }
    rootId: 0,
    loadedAt: null,
    filters: {},        // { campoRaiz: [valores] , __from, __to }
    errors: []
  };

  /* ---------- ArcGIS REST ---------- */
  async function getJSON(url, params, token) {
    const p = new URLSearchParams(Object.assign({ f: 'json' }, params || {}));
    if (token) p.set('token', token);
    const res = await fetch(url + (url.includes('?') ? '&' : '?') + p.toString());
    if (!res.ok) throw new Error('HTTP ' + res.status + ' em ' + url);
    const j = await res.json();
    if (j.error) throw new Error((j.error.message || 'Erro ArcGIS') + ' (' + url + ')');
    return j;
  }

  async function queryAll(layerUrl, maxRec, isLayer, token) {
    const out = []; let offset = 0; const page = Math.min(maxRec || 1000, 2000);
    for (let guard = 0; guard < 500; guard++) {
      const j = await getJSON(layerUrl + '/query', {
        where: '1=1', outFields: '*', returnGeometry: isLayer ? 'true' : 'false', outSR: '4326',
        resultOffset: offset, resultRecordCount: page, orderByFields: 'objectid'
      }, token);
      const feats = j.features || [];
      out.push.apply(out, feats);
      if (!j.exceededTransferLimit && feats.length < page) break;
      if (!feats.length) break;
      offset += feats.length;
    }
    return out;
  }

  async function loadArcGIS(ds) {
    const url = ds.serviceUrl.replace(/\/+$/, '');
    const token = ds.token || '';
    const info = await getJSON(url, null, token);
    const list = (info.layers || []).map(l => Object.assign({}, l, { _kind: 'Feature Layer' }))
      .concat((info.tables || []).map(t => Object.assign({}, t, { _kind: 'Table' })));
    const defs = await Promise.all(list.map(l => getJSON(url + '/' + l.id, null, token)));
    const schema = defs.map((d, i) => {
      let parentId = null;
      (d.relationships || []).forEach(r => {
        if (/Destination/i.test(r.role) && /parentglobalid/i.test(r.keyField || '')) parentId = r.relatedTableId;
      });
      return { id: d.id, name: d.name, type: list[i]._kind, geometryType: d.geometryType, parentId, fields: d.fields || [], maxRecordCount: d.maxRecordCount };
    });
    const data = {};
    await Promise.all(schema.map(async l => {
      data[l.id] = await queryAll(url + '/' + l.id, l.maxRecordCount, l.type === 'Feature Layer', token);
    }));
    return { schema, data };
  }

  /* ---------- montagem ---------- */
  function build(schema, data, cfgLayers) {
    DS.layers = {};
    schema.forEach(l => {
      const cfg = (cfgLayers || {})[l.id] || {};
      const parentId = cfg.parentId != null && cfg.parentId !== '' ? +cfg.parentId : l.parentId;
      const fieldMap = {}; l.fields.forEach(fd => { fieldMap[fd.name] = fd; });
      const rows = (data[l.id] || []).map(ft => {
        const r = Object.assign({}, ft.attributes);
        if (ft.geometry && ft.geometry.x != null) r._geom = { x: ft.geometry.x, y: ft.geometry.y };
        r._layer = l.id;
        return r;
      });
      const gidField = (l.fields.find(fd => fd.type === 'esriFieldTypeGlobalID') || { name: 'globalid' }).name;
      const index = {}; rows.forEach(r => { index[U.normGuid(r[gidField])] = r; });
      DS.layers[l.id] = { id: l.id, name: l.name, label: cfg.label || l.name, type: l.type, geometryType: l.geometryType, parentId: parentId == null ? null : parentId, fields: l.fields, fieldMap, rows, index };
    });
    const roots = Object.values(DS.layers).filter(l => l.parentId == null);
    DS.rootId = roots.length ? (roots.find(l => l.type === 'Feature Layer') || roots[0]).id : 0;

    Object.values(DS.layers).forEach(l => {
      if (l.parentId == null) return;
      const parent = DS.layers[l.parentId]; if (!parent) return;
      const pgField = (Object.keys(l.fieldMap).find(k => k.toLowerCase() === 'parentglobalid')) || 'parentglobalid';
      l.rows.forEach(r => {
        const p = parent.index[U.normGuid(r[pgField])];
        if (p) { r._parent = p; (p._children = p._children || {}); (p._children[l.id] = p._children[l.id] || []).push(r); }
      });
    });
    Object.values(DS.layers).forEach(l => l.rows.forEach(r => {
      let x = r, guard = 0; while (x._parent && guard++ < 10) x = x._parent;
      r._root = x;
      if (!r._geom && x._geom) r._geomInherited = x._geom;
    }));
  }

  DS.load = async function (config) {
    const ds = config.dataSource || {};
    DS.errors = [];
    let schema, data, source = 'mock';
    if (ds.mode === 'arcgis' || ds.mode === 'auto') {
      try {
        const res = await loadArcGIS(ds);
        const total = res.data[res.schema.find(l => l.parentId == null)?.id ?? 0]?.length || 0;
        if (total > 0 || ds.mode === 'arcgis') { schema = res.schema; data = res.data; source = 'arcgis'; }
      } catch (e) {
        DS.errors.push(e.message);
        console.warn('[dados] Falha ao ler ArcGIS:', e);
        if (ds.mode === 'arcgis') { schema = []; data = {}; source = 'arcgis'; }
      }
    }
    if (!schema) {
      schema = MockData.SCHEMA;
      data = MockData.generate({ seed: ds.mockSeed || 42, count: ds.mockCount || 400 });
      source = 'mock';
    }
    build(schema, data, config.layers);
    DS.source = source;
    DS.loadedAt = new Date();
    return DS;
  };

  /* ---------- acesso a campos (com campos do pai/raiz) ---------- */
  // chaves: "campo", "parent:campo", "root:campo"
  function resolve(row, key) {
    if (!key) return { row, field: key };
    const i = key.indexOf(':');
    if (i < 0) return { row, field: key };
    const pre = key.slice(0, i), field = key.slice(i + 1);
    if (pre === 'parent') return { row: row._parent, field };
    if (pre === 'root') return { row: row._root, field };
    return { row, field: key };
  }
  DS.val = function (row, key) { const r = resolve(row, key); return r.row ? r.row[r.field] : undefined; };

  DS.fieldDef = function (layerId, key) {
    const l = DS.layers[layerId]; if (!l || !key) return null;
    const i = key.indexOf(':');
    if (i < 0) return l.fieldMap[key] || null;
    const pre = key.slice(0, i), f = key.slice(i + 1);
    const target = pre === 'parent' ? DS.layers[l.parentId] : DS.layers[DS.rootId];
    return target ? target.fieldMap[f] || null : null;
  };

  DS.fieldLabel = function (layerId, key) { const d = DS.fieldDef(layerId, key); return d ? (d.alias || d.name) : (key || ''); };

  DS.isDate = (layerId, key) => { const d = DS.fieldDef(layerId, key); return !!d && d.type === 'esriFieldTypeDate'; };

  DS.display = function (layerId, key, v) {
    if (v == null || v === '') return '';
    const d = DS.fieldDef(layerId, key);
    if (d && d.type === 'esriFieldTypeDate') return U.fmtDate(v);
    if (d && d.domain && d.domain.codedValues) {
      const parts = String(v).split(',');
      return parts.map(p => { const c = d.domain.codedValues.find(cv => String(cv.code) === p.trim()); return c ? c.name : p.replace(/_/g, ' '); }).join(', ');
    }
    if (typeof v === 'number') return U.fmtNumber(v);
    return String(v).replace(/_/g, ' ').replace(/,(?=\S)/g, ', ');
  };

  /* lista de campos disponíveis para uma camada (incluindo pai e raiz) */
  DS.fieldOptions = function (layerId, filterFn) {
    const l = DS.layers[layerId]; if (!l) return [];
    const ok = fd => !/^(objectid|globalid|parentglobalid|Shape__|Editor|EditDate)/i.test(fd.name) && (!filterFn || filterFn(fd));
    const out = l.fields.filter(ok).map(fd => ({ key: fd.name, label: fd.alias || fd.name, type: fd.type, group: l.label }));
    if (l.parentId != null && DS.layers[l.parentId]) {
      const p = DS.layers[l.parentId];
      p.fields.filter(ok).forEach(fd => out.push({ key: 'parent:' + fd.name, label: '↑ ' + (fd.alias || fd.name), type: fd.type, group: 'Pai: ' + p.label }));
      if (p.parentId != null && DS.layers[DS.rootId] && DS.rootId !== p.id) {
        const rt = DS.layers[DS.rootId];
        rt.fields.filter(ok).forEach(fd => out.push({ key: 'root:' + fd.name, label: '⇈ ' + (fd.alias || fd.name), type: fd.type, group: 'Raiz: ' + rt.label }));
      }
    }
    return out;
  };

  DS.isNumericType = t => /Integer|Double|Single|SmallInteger|OID|BigInteger/.test(t || '');

  /* ---------- filtros ---------- */
  function passWhere(row, layerId, conds) {
    return (conds || []).every(c => {
      if (!c || !c.field) return true;
      const v = DS.val(row, c.field);
      const t = c.value;
      switch (c.op) {
        case '=': return String(v) === String(t);
        case '!=': return String(v) !== String(t);
        case '>': return +v > +t;
        case '>=': return +v >= +t;
        case '<': return +v < +t;
        case '<=': return +v <= +t;
        case 'contains': return v != null && String(v).toLowerCase().includes(String(t).toLowerCase());
        case 'empty': return v == null || v === '';
        case 'notempty': return v != null && v !== '';
        default: return true;
      }
    });
  }

  function passGlobal(row, layerId) {
    const root = row._root || row;
    const F = DS.filters;
    for (const k in F) {
      if (k.startsWith('__')) continue;
      const vals = F[k]; if (!vals || !vals.length) continue;
      if (!vals.includes(String(root[k]))) return false;
    }
    if (F.__dateField && (F.__from || F.__to)) {
      const d = root[F.__dateField];
      if (d == null) return false;
      if (F.__from && d < F.__from) return false;
      if (F.__to && d > F.__to + 864e5 - 1) return false;
    }
    return true;
  }

  DS.rows = function (layerId, where, ignoreGlobal) {
    const l = DS.layers[layerId]; if (!l) return [];
    return l.rows.filter(r => (ignoreGlobal || passGlobal(r, layerId)) && passWhere(r, layerId, where));
  };

  DS.distinct = function (layerId, key) {
    const s = new Set(); (DS.layers[layerId]?.rows || []).forEach(r => { const v = DS.val(r, key); if (v != null && v !== '') s.add(String(v)); });
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'pt'));
  };

  /* ---------- agregações ---------- */
  DS.aggregate = function (rows, agg, key) {
    if (agg === 'count' || !agg) return rows.length;
    if (agg === 'distinct') return new Set(rows.map(r => DS.val(r, key)).filter(v => v != null && v !== '')).size;
    const nums = rows.map(r => DS.val(r, key)).filter(v => v != null && v !== '' && !isNaN(v)).map(Number);
    if (!nums.length) return agg === 'sum' ? 0 : null;
    if (agg === 'sum') return nums.reduce((a, b) => a + b, 0);
    if (agg === 'avg') return nums.reduce((a, b) => a + b, 0) / nums.length;
    if (agg === 'min') return Math.min.apply(null, nums);
    if (agg === 'max') return Math.max.apply(null, nums);
    return rows.length;
  };

  DS.group = function (rows, layerId, key, opts) {
    const o = opts || {};
    const m = new Map();
    const isDate = DS.isDate(layerId, key);
    rows.forEach(r => {
      let v = DS.val(r, key);
      if (v == null || v === '') { if (o.skipEmpty !== false) return; v = '(vazio)'; }
      let keys;
      if (isDate) {
        const d = new Date(v);
        keys = [o.dateBin === 'year' ? String(d.getFullYear()) : o.dateBin === 'day' ? d.toISOString().slice(0, 10) : U.monthKey(v)];
      } else if (o.splitMulti && typeof v === 'string' && v.includes(',')) {
        keys = v.split(',').map(s => s.trim()).filter(Boolean);
      } else keys = [String(v)];
      keys.forEach(k => { if (!m.has(k)) m.set(k, []); m.get(k).push(r); });
    });
    return { map: m, isDate };
  };

  DS.labelForGroup = function (layerId, key, k, isDate, dateBin) {
    if (isDate) return (!dateBin || dateBin === 'month') ? U.monthLabel(k) : k;
    return DS.display(layerId, key, k) || k;
  };

  global.DataStore = DS;
})(window);
