/* Publicação no GitHub (API de conteúdos) — grava config.json, imagens e backups no repositório */
(function (global) {
  'use strict';
  const API = 'https://api.github.com';

  function b64FromBytes(bytes) {
    let s = ''; const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    return btoa(s);
  }
  const b64FromText = (t) => b64FromBytes(new TextEncoder().encode(t));
  const textFromB64 = (b) => new TextDecoder().decode(Uint8Array.from(atob(b.replace(/\n/g, '')), c => c.charCodeAt(0)));

  function GH(settings, token) {
    this.s = settings; this.token = token;
  }
  GH.prototype.req = async function (method, path, body) {
    const res = await fetch(API + path, {
      method,
      headers: Object.assign({ Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, this.token ? { Authorization: 'Bearer ' + this.token } : {}, body ? { 'Content-Type': 'application/json' } : {}),
      body: body ? JSON.stringify(body) : undefined
    });
    if (res.status === 404 && method === 'GET') return null;
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error('GitHub ' + res.status + ': ' + (j.message || res.statusText));
    return j;
  };
  GH.prototype.repoPath = function (p) { return '/repos/' + encodeURIComponent(this.s.owner) + '/' + encodeURIComponent(this.s.repo) + '/contents/' + p.split('/').map(encodeURIComponent).join('/'); };
  GH.prototype.test = async function () {
    const r = await this.req('GET', '/repos/' + encodeURIComponent(this.s.owner) + '/' + encodeURIComponent(this.s.repo));
    if (!r) throw new Error('Repositório não encontrado (verifique o nome e o token).');
    if (r.permissions && !r.permissions.push) throw new Error('O token não tem permissão de escrita neste repositório.');
    return r;
  };
  GH.prototype.get = async function (path) {
    return this.req('GET', this.repoPath(path) + '?ref=' + encodeURIComponent(this.s.branch || 'main') + '&t=' + Date.now());
  };
  GH.prototype.put = async function (path, b64, message) {
    const cur = await this.get(path);
    const body = { message, content: b64, branch: this.s.branch || 'main' };
    if (cur && cur.sha) body.sha = cur.sha;
    return this.req('PUT', this.repoPath(path), body);
  };
  GH.prototype.list = async function (dir) { const r = await this.get(dir); return Array.isArray(r) ? r : []; };

  /* Extrai imagens embutidas (data:) para ficheiros no repositório e substitui por caminhos relativos */
  async function externalizeImages(gh, cfg, log) {
    const json = JSON.stringify(cfg);
    const re = /data:image\/(png|jpe?g|gif|svg\+xml|webp);base64,[A-Za-z0-9+/=]+/g;
    const found = Array.from(new Set(json.match(re) || []));
    let out = json;
    for (const uri of found) {
      const ext = uri.slice(11, uri.indexOf(';')).replace('svg+xml', 'svg').replace('jpeg', 'jpg');
      const hash = (await U.sha256(uri)).slice(0, 16);
      const path = 'assets/uploads/' + hash + '.' + ext;
      const exists = await gh.get(path);
      if (!exists) { log && log('A enviar imagem ' + path); await gh.put(path, uri.slice(uri.indexOf(',') + 1), 'Imagem carregada via gestão'); }
      out = out.split(uri).join(path);
    }
    return JSON.parse(out);
  }

  GH.prototype.publish = async function (cfg, opts) {
    const o = opts || {}; const log = o.log || (() => {});
    log('A verificar repositório…'); await this.test();
    const clean = await externalizeImages(this, cfg, log);
    clean.updatedAt = new Date().toISOString();
    const text = JSON.stringify(clean, null, 2);
    if (o.backup) {
      const cur = await this.get(this.s.path || 'config.json');
      if (cur && cur.content) { log('A guardar backup da versão anterior…'); await this.put('backups/config-' + U.stamp() + '.json', cur.content.replace(/\n/g, ''), 'Backup automático antes de publicar'); }
    }
    log('A publicar ' + (this.s.path || 'config.json') + '…');
    await this.put(this.s.path || 'config.json', b64FromText(text), o.message || 'Actualização do dashboard via gestão');
    log('A actualizar cópia embutida js/config-default.js…');
    await this.put('js/config-default.js', b64FromText('/* Cópia embutida do config.json (usada quando o site é aberto sem servidor). Actualizada automaticamente ao publicar. */\nwindow.EMBEDDED_CONFIG = ' + text + ';\n'), 'Actualizar cópia embutida da configuração');
    return clean;
  };

  GH.prototype.backups = async function () { return (await this.list('backups')).filter(f => f.name.endsWith('.json')).sort((a, b) => b.name.localeCompare(a.name)); };
  GH.prototype.readJSON = async function (path) { const f = await this.get(path); if (!f) throw new Error('Ficheiro não encontrado: ' + path); return JSON.parse(textFromB64(f.content)); };
  GH.prototype.saveBackup = async function (cfg) { const p = 'backups/config-' + U.stamp() + '.json'; await this.put(p, b64FromText(JSON.stringify(cfg, null, 2)), 'Backup manual via gestão'); return p; };

  global.GitHubPublisher = GH;
})(window);
