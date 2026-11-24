/* Esquema (baseado no feature service real) e gerador de dados fictícios.
   Usado enquanto o serviço não tem registos. */
(function (global) {
  'use strict';

  const T = { s: 'esriFieldTypeString', i: 'esriFieldTypeInteger', d: 'esriFieldTypeDouble', dt: 'esriFieldTypeDate', oid: 'esriFieldTypeOID', gid: 'esriFieldTypeGlobalID', guid: 'esriFieldTypeGUID' };
  const SN = ['Sim', 'Não'];
  const dom = (codes) => codes ? { type: 'codedValue', codedValues: codes.map(c => Array.isArray(c) ? { code: c[0], name: c[1] } : { code: c, name: String(c).replace(/_/g, ' ') }) } : null;
  const f = (name, t, alias, codes) => ({ name, type: T[t], alias: alias || name, domain: dom(codes) });
  const base = (child) => [f('objectid', 'oid', 'ObjectID'), f('globalid', 'gid', 'GlobalID')].concat(child ? [f('parentglobalid', 'guid', 'ParentGlobalID')] : []);
  const desag = (p, totLabel) => [f(p + '_h', 'i', 'Homens (+35)'), f(p + '_m', 'i', 'Mulheres (+35)'), f(p + '_jh', 'i', 'Jovens homens (≤35)'), f(p + '_jm', 'i', 'Jovens mulheres (≤35)'), f(p + '_tot', 'i', totLabel || 'Total')];

  const PROV = [['Cidade de Maputo', 'Maputo Cidade'], ['Maputo', 'Maputo província'], ['Gaza', 'Gaza'], ['Inhambane', 'Inhambane'], ['Sofala', 'Sofala'], ['Manica', 'Manica'], ['Tete', 'Tete'], ['Zambezia', 'Zambézia'], ['Nampula', 'Nampula'], ['Niassa', 'Niassa'], ['Cabo delgado', 'Cabo Delgado']];
  const CULT = ['Arroz', 'Feijão_Boer', 'Feijão_Nhemba', 'Feijão_Vulgar', 'Gergelim', 'Amendoim', 'Girassol', 'Mapira', 'Mandioca', 'Milho', 'Soja', 'Tomate', 'Batata_doce', 'Cebola', 'Couve', 'Repolho'];

  const SCHEMA = [
    {
      id: 0, name: 'diario_extensionista_dinae', type: 'Feature Layer', geometryType: 'esriGeometryPoint', parentId: null,
      fields: base(false).concat([
        f('provincia', 's', 'Província', PROV), f('distrito', 's', 'Distrito'), f('posto', 's', 'Posto administrativo'), f('localidade', 's', 'Localidade'), f('comunidade', 's', 'Comunidade'),
        f('nome_extensionista', 's', 'Nome do extensionista'), f('codigo_instituicao', 's', 'Código / instituição'),
        f('data_actividade', 'dt', 'Data da actividade'), f('tempo_horas', 'd', 'Tempo gasto (horas)'),
        f('modulos', 's', 'Grupos de dados reportados'), f('n_modulos', 'i', 'Número de grupos'),
        f('a1_visita', 's', 'Realizou visita de campo?', SN), f('a1_n', 'i', 'Nº de visitas'),
        f('a1_objectivo', 's', 'Objectivo principal da visita', [['assistencia_tecnica', 'Assistência técnica'], ['monitoria', 'Monitoria'], ['diagnostico', 'Diagnóstico'], ['demonstracao', 'Demonstração'], ['outro', 'Outro']]),
        f('a2_assistiu', 's', 'Assistiu produtores?', SN)].concat(desag('a2', 'Produtores assistidos'), [
        f('a2_def', 'i', 'Pessoas com deficiência assistidas'), f('a2_novos', 'i', 'Produtores novos assistidos'),
        f('a3_reuniao', 's', 'Reunião com comunidade?', SN), f('a3_tot', 'i', 'Participantes na reunião'),
        f('a4_area', 'd', 'Área das machambas acompanhadas (ha)'),
        f('i1_surto', 's', 'Observou surto de praga/doença?', SN), f('i1_praga', 's', 'Praga ou doença'), f('i1_cultura', 's', 'Cultura afectada', CULT), f('i1_area', 'd', 'Área afectada (ha)'),
        f('i2_info', 's', 'Alertas do tempo e clima?', SN), f('i2_tot', 'i', 'Produtores com alertas climáticos'),
        f('b3_realizou', 's', 'Realizou evento?', SN), f('b3_tipo', 's', 'Tipo de evento', [['dia_campo', 'Dia de campo'], ['demo_metodo', 'Demonstração de método'], ['feira', 'Feira']]), f('b3_tot', 'i', 'Participantes no evento'),
        f('b4_cultura', 's', 'Cultura (rendimento CDR)', CULT), f('b4_cdr', 'd', 'Rendimento no CDR (kg/ha)'), f('b4_habitual', 'd', 'Rendimento prática habitual (kg/ha)'),
        f('c_temas', 's', 'Temas de formação')], desag('c1', 'Formados em SAN/nutrição'), desag('c6', 'Formados em pragas'), desag('c7', 'Formados em compostagem'), [
        f('c7_composteiras', 'i', 'Produtores com composteira'),
        f('d1_formou', 's', 'Formou nova OP?', SN), f('d6_apoiou', 's', 'Apoiou grupo de poupança?', SN), f('d6_tot', 'i', 'Membros de grupos de poupança'), f('d6_valor', 'd', 'Valor poupado (MZN)'),
        f('e1_venda', 's', 'Produtores comercializaram?', SN), f('e1_tot', 'i', 'Produtores que venderam'), f('e1_produto', 's', 'Produto vendido'), f('e1_quantidade', 'd', 'Quantidade vendida'),
        f('e1_unidade', 's', 'Unidade', [['Kg', 'Kg'], ['Sacos_de_50kg', 'Sacos de 50kg'], ['Tonelada', 'Tonelada'], ['Latas', 'Latas'], ['Outra', 'Outra']]), f('e1_preco', 'd', 'Preço (MZN/unidade)'),
        f('f1_adopcao', 's', 'Adopção de tecnologias?', SN), f('f1_tot', 'i', 'Produtores que adoptaram tecnologias'), f('f2_area', 'd', 'Área com tecnologias (ha)'),
        f('g1_demo', 's', 'Demonstração culinária?', SN), f('g1_tot', 'i', 'Participantes demo culinária'), f('g2_familias', 'i', 'Famílias com horta nutritiva'),
        f('h2_recebeu', 's', 'Recebeu reclamação?', SN), f('h3_risco', 's', 'Identificou risco ambiental/social?', SN),
        f('k1_constrangimentos', 's', 'Principais constrangimentos'), f('k1_sucesso', 's', 'História de sucesso'),
        f('CreationDate', 'dt', 'Data de criação'), f('Creator', 's', 'Criado por')
      ]))
    },
    {
      id: 1, name: 'rep_r1_produtor', type: 'Feature Layer', geometryType: 'esriGeometryPoint', parentId: 0,
      fields: base(true).concat([f('r1_nuipa', 's', 'NUIPA do produtor'), f('r1_nascimento', 'dt', 'Data de nascimento')], desag('r1_agr', 'Membros do agregado'), [
        f('r1_area_sequeiro', 'd', 'Área em sequeiro (ha)'), f('r1_area_irrigada', 'd', 'Área irrigada (ha)'), f('r1_area_explorada', 'd', 'Área total explorada (ha)'),
        f('r1_culturas', 's', 'Culturas principais'), f('r1_n_culturas', 'i', 'Nº de culturas'), f('r1_pecuario', 's', 'Possui efectivo pecuário?', SN),
        f('r1_bov_tot', 'i', 'Total de bovinos'), f('r1_cap_tot', 'i', 'Total de caprinos'), f('r1_ovi_tot', 'i', 'Total de ovinos'), f('r1_sui_tot', 'i', 'Total de suínos'), f('r1_galinhas', 'i', 'Número de galinhas')])
    },
    {
      id: 2, name: 'rep_r3_pace', type: 'Feature Layer', geometryType: 'esriGeometryPoint', parentId: 0,
      fields: base(true).concat([f('r3_nome', 's', 'Nome do produtor'), f('r3_tipo', 's', 'Tipo de produtor', ['PACE', 'PAC'])], desag('r3'), [
        f('r3_actividades', 's', 'Actividades realizadas'), f('r3_data', 'dt', 'Data de monitoria'), f('r3_desafios', 's', 'Principais desafios')])
    },
    {
      id: 3, name: 'rep_r4_semente', type: 'Feature Layer', geometryType: 'esriGeometryPoint', parentId: 0,
      fields: base(true).concat([f('r4_nome', 's', 'Nome do produtor'), f('r4_sexo', 's', 'Sexo', ['Masculino', 'Feminino']), f('r4_tipo', 's', 'Tipo de produtor', ['PACE', 'PAC']), f('r4_culturas', 's', 'Culturas principais'), f('r4_n_culturas', 'i', 'Nº de culturas')])
    },
    {
      id: 4, name: 'rep_b1_cdr', type: 'Table', parentId: 0,
      fields: base(true).concat([f('b1_comunidade', 's', 'Comunidade do CDR'), f('b1_anfitriao', 's', 'Produtor anfitrião'), f('b1_cultura_tec', 's', 'Cultura/tecnologia demonstrada'), f('b1_area', 'd', 'Área do CDR (ha)')], desag('b1', 'Participantes no CDR'), [f('b1_def', 'i', 'Pessoas com deficiência')])
    },
    {
      id: 5, name: 'rep_b2_cdr', type: 'Table', parentId: 0,
      fields: base(true).concat([f('b2_cdr', 's', 'CDR (comunidade e anfitrião)'), f('b2_estagio', 's', 'Estágio actual', [['instalacao', 'Instalação'], ['crescimento', 'Crescimento'], ['colheita', 'Colheita'], ['concluido', 'Concluído']])])
    },
    {
      id: 6, name: 'rep_h2_reclamacao', type: 'Table', parentId: 0,
      fields: base(true).concat([f('h2_assunto', 's', 'Assunto da reclamação'), f('h2_estado', 's', 'Estado', [['resolvida', 'Resolvida'], ['encaminhada', 'Encaminhada'], ['pendente', 'Pendente']]), f('h2_dias', 'i', 'Tempo de resposta (dias)')])
    },
    {
      id: 7, name: 'rep_r1_cultura', type: 'Table', parentId: 1,
      fields: base(true).concat([f('r1_cultura', 's', 'Cultura', CULT), f('r1_cult_area', 'd', 'Área da cultura (ha)'), f('r1_cult_sistema', 's', 'Sistema de produção', ['Sequeiro', 'Irrigado', 'Misto'])])
    },
    {
      id: 8, name: 'rep_r2_op', type: 'Table', parentId: 0,
      fields: base(true).concat([f('r2_nome', 's', 'Nome da organização'), f('r2_tipo', 's', 'Tipo de organização', ['Associação', 'Cooperativa', 'Grupo de produtores', 'Forum', 'outro']), f('r2_comunidade', 's', 'Povoado'), f('r2_ano', 'i', 'Ano de início')], desag('r2', 'Total de membros'), [
        f('r2_estado', 's', 'Estado de funcionamento', ['Activa', 'Parcialmente activa', 'Inactiva', 'Suspensa', 'Em constituição']),
        f('r2_estagio', 's', 'Estágio', [['formacao', 'Em formação'], ['em_legalizacao', 'Em legalização'], ['legalizada', 'Legalizada']]), f('r2_vul', 'i', 'Membros vulneráveis')])
    },
    {
      id: 9, name: 'rep_r4_cultura', type: 'Table', parentId: 3,
      fields: base(true).concat([f('r4_cultura', 's', 'Cultura', CULT), f('r4_variedade', 's', 'Variedade'), f('r4_quantidade', 'd', 'Quantidade produzida'), f('r4_unidade', 's', 'Unidade', ['Kg', 'Sacos de 50kg', 'Tonelada', 'Latas', 'Outra']), f('r4_area', 'd', 'Área de produção (ha)'),
        f('r4_destino', 's', 'Destino da produção', ['Venda Local', 'Mercado nacional', 'Semente', 'Consumo próprio', 'Outro']), f('r4_data', 'dt', 'Data de monitoria')])
    }
  ];

  /* ---------- gerador ---------- */
  const GEO = {
    'Cidade de Maputo': [-25.95, 32.58, 0.05, ['KaMpfumo', 'KaMaxakeni', 'KaMubukwana', 'KaTembe']],
    'Maputo': [-25.4, 32.45, 0.5, ['Boane', 'Marracuene', 'Moamba', 'Manhiça', 'Namaacha']],
    'Gaza': [-23.9, 33.1, 0.9, ['Chókwè', 'Xai-Xai', 'Guijá', 'Chibuto', 'Bilene']],
    'Inhambane': [-23.6, 34.9, 0.6, ['Inharrime', 'Massinga', 'Homoíne', 'Zavala', 'Morrumbene']],
    'Sofala': [-19.2, 34.5, 0.8, ['Nhamatanda', 'Búzi', 'Gorongosa', 'Dondo', 'Caia']],
    'Manica': [-19.0, 33.3, 0.7, ['Sussundenga', 'Manica', 'Gondola', 'Bárue', 'Mossurize']],
    'Tete': [-15.8, 33.4, 1.0, ['Angónia', 'Moatize', 'Tsangano', 'Macanga', 'Cahora-Bassa']],
    'Zambezia': [-16.9, 37.0, 0.9, ['Gurué', 'Alto Molócuè', 'Mocuba', 'Namacurra', 'Ile']],
    'Nampula': [-15.1, 39.2, 0.9, ['Ribáuè', 'Malema', 'Monapo', 'Meconta', 'Mogovolas']],
    'Niassa': [-13.3, 36.0, 1.0, ['Lichinga', 'Cuamba', 'Mandimba', 'Sanga', 'Majune']],
    'Cabo delgado': [-12.9, 39.5, 0.8, ['Montepuez', 'Balama', 'Chiúre', 'Ancuabe', 'Namuno']]
  };
  const NOMES = ['Ana', 'João', 'Maria', 'Carlos', 'Fátima', 'Armando', 'Lurdes', 'Paulo', 'Celeste', 'Alberto', 'Rosa', 'Tomás', 'Joana', 'Ernesto', 'Graça', 'Fernando', 'Isabel', 'Sérgio', 'Helena', 'Amade'];
  const APEL = ['Macuácua', 'Chissano', 'Mondlane', 'Cossa', 'Nhantumbo', 'Mussa', 'Langa', 'Sitoe', 'Bila', 'Tembe', 'Machava', 'Muianga', 'Zandamela', 'Massingue', 'Ussene'];
  const PRAGAS = ['Lagarta do funil do milho', 'Gafanhoto', 'Míldio', 'Afídios', 'Mosca branca', 'Podridão do colmo'];
  const CONSTR = ['Falta de transporte', 'Chuvas irregulares', 'Falta de sementes melhoradas', 'Acesso limitado ao mercado', 'Falta de material de demonstração', 'Rede telefónica fraca'];
  const MODS = ['A_visitas', 'B_cdr', 'C_formacao', 'D_op', 'E_mercado', 'F_tecnologias', 'G_nutricao', 'H_salvaguardas', 'I_alertas'];

  function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

  function generate(opts) {
    const o = Object.assign({ seed: 42, count: 400, months: 12 }, opts || {});
    const r = rng(o.seed);
    const ri = (a, b) => Math.floor(a + r() * (b - a + 1));
    const rf = (a, b, d) => +(a + r() * (b - a)).toFixed(d == null ? 1 : d);
    const pick = (arr) => arr[Math.floor(r() * arr.length)];
    const yn = (p) => (r() < p ? 'Sim' : 'Não');
    const gid = () => '{' + 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const v = Math.floor(r() * 16); return (c === 'x' ? v : (v & 3 | 8)).toString(16); }).toUpperCase() + '}';
    const pessoa = () => pick(NOMES) + ' ' + pick(APEL);
    const split = (tot) => { const h = ri(0, tot), m = ri(0, tot - h), jh = ri(0, tot - h - m); return [h, m, jh, tot - h - m - jh]; };
    const putDes = (rec, p, tot) => { const s = split(tot); rec[p + '_h'] = s[0]; rec[p + '_m'] = s[1]; rec[p + '_jh'] = s[2]; rec[p + '_jm'] = s[3]; rec[p + '_tot'] = tot; };

    const now = Date.now(), span = o.months * 30 * 864e5;
    const provW = ['Nampula', 'Nampula', 'Zambezia', 'Zambezia', 'Tete', 'Manica', 'Sofala', 'Gaza', 'Inhambane', 'Maputo', 'Niassa', 'Cabo delgado', 'Cidade de Maputo'];
    const extens = {}; Object.keys(GEO).forEach(p => { extens[p] = Array.from({ length: 4 }, pessoa); });

    const T = {}; SCHEMA.forEach(l => { T[l.id] = []; });
    const oid = {}; SCHEMA.forEach(l => { oid[l.id] = 1; });
    const geo = (g) => ({ x: +(g[1] + (r() - 0.5) * 2 * g[2]).toFixed(5), y: +(g[0] + (r() - 0.5) * 2 * g[2]).toFixed(5) });
    const child = (lid, parent, attrs, geomFrom) => {
      const a = Object.assign({ objectid: oid[lid]++, globalid: gid(), parentglobalid: parent.attributes.globalid }, attrs);
      const feat = { attributes: a };
      if (geomFrom) feat.geometry = { x: geomFrom.x + (r() - 0.5) * 0.02, y: geomFrom.y + (r() - 0.5) * 0.02 };
      T[lid].push(feat); return feat;
    };

    for (let n = 0; n < o.count; n++) {
      const prov = pick(provW), g = GEO[prov];
      const dt = now - Math.pow(r(), 0.8) * span;
      const a = {
        objectid: oid[0]++, globalid: gid(), provincia: prov, distrito: pick(g[3]), posto: 'Sede', localidade: 'Localidade ' + ri(1, 6), comunidade: 'Comunidade ' + ri(1, 25),
        nome_extensionista: pick(extens[prov]), codigo_instituicao: 'DINAE-' + ri(100, 999), data_actividade: Math.round(dt), tempo_horas: rf(2, 9),
        a1_visita: yn(0.85), a2_assistiu: yn(0.8), a3_reuniao: yn(0.4), i1_surto: yn(0.18), i2_info: yn(0.35), b3_realizou: yn(0.25),
        d1_formou: yn(0.08), d6_apoiou: yn(0.2), e1_venda: yn(0.3), f1_adopcao: yn(0.45), g1_demo: yn(0.15), h2_recebeu: yn(0.1), h3_risco: yn(0.08),
        k1_constrangimentos: pick(CONSTR), CreationDate: Math.round(dt + 36e5), Creator: 'extensionista_' + ri(1, 40)
      };
      const mods = MODS.filter(() => r() < 0.35); a.modulos = mods.join(','); a.n_modulos = mods.length;
      if (a.a1_visita === 'Sim') { a.a1_n = ri(1, 6); a.a1_objectivo = pick(['assistencia_tecnica', 'assistencia_tecnica', 'monitoria', 'diagnostico', 'demonstracao', 'outro']); a.a4_area = rf(0.5, 25); }
      if (a.a2_assistiu === 'Sim') { putDes(a, 'a2', ri(3, 45)); a.a2_def = ri(0, 2); a.a2_novos = ri(0, Math.floor(a.a2_tot / 2)); }
      if (a.a3_reuniao === 'Sim') a.a3_tot = ri(8, 60);
      if (a.i1_surto === 'Sim') { a.i1_praga = pick(PRAGAS); a.i1_cultura = pick(CULT); a.i1_area = rf(0.2, 12); }
      if (a.i2_info === 'Sim') a.i2_tot = ri(5, 80);
      if (a.b3_realizou === 'Sim') { a.b3_tipo = pick(['dia_campo', 'dia_campo', 'demo_metodo', 'feira']); a.b3_tot = ri(10, 120); }
      if (r() < 0.3) { a.b4_cultura = pick(['Milho', 'Feijão_Nhemba', 'Arroz', 'Soja', 'Amendoim']); a.b4_habitual = rf(500, 1400, 0); a.b4_cdr = Math.round(a.b4_habitual * rf(1.2, 2.4)); }
      if (r() < 0.4) { a.c_temas = 'SAN,pragas'; putDes(a, 'c1', ri(5, 40)); }
      if (r() < 0.3) putDes(a, 'c6', ri(5, 35));
      if (r() < 0.25) { putDes(a, 'c7', ri(5, 30)); a.c7_composteiras = ri(0, 10); }
      if (a.d6_apoiou === 'Sim') { a.d6_tot = ri(10, 30); a.d6_valor = ri(2, 60) * 500; }
      if (a.e1_venda === 'Sim') { a.e1_tot = ri(2, 25); a.e1_produto = pick(['Milho', 'Feijão', 'Gergelim', 'Tomate', 'Amendoim']); a.e1_unidade = pick(['Kg', 'Sacos_de_50kg']); a.e1_quantidade = ri(20, 900); a.e1_preco = a.e1_unidade === 'Kg' ? ri(15, 80) : ri(900, 2800); }
      if (a.f1_adopcao === 'Sim') { a.f1_tot = ri(2, 30); a.f2_area = rf(0.5, 20); }
      if (a.g1_demo === 'Sim') a.g1_tot = ri(8, 40);
      if (r() < 0.3) a.g2_familias = ri(1, 15);
      if (r() < 0.06) a.k1_sucesso = 'Produtores aumentaram rendimento com sementes melhoradas';

      const root = { attributes: a, geometry: geo(g) };
      T[0].push(root);

      const nProd = r() < 0.35 ? ri(1, 4) : 0;
      for (let k = 0; k < nProd; k++) {
        const area = rf(0.5, 6), irr = r() < 0.3 ? rf(0, area / 2) : 0;
        const pc = r() < 0.55 ? 'Sim' : 'Não';
        const prodAttrs = { r1_nuipa: 'NUIPA' + ri(100000, 999999), r1_nascimento: Date.UTC(ri(1955, 2003), ri(0, 11), ri(1, 28)), r1_area_explorada: area, r1_area_irrigada: irr, r1_area_sequeiro: +(area - irr).toFixed(1), r1_pecuario: pc };
        putDes(prodAttrs, 'r1_agr', ri(2, 10));
        if (pc === 'Sim') { prodAttrs.r1_bov_tot = ri(0, 8); prodAttrs.r1_cap_tot = ri(0, 15); prodAttrs.r1_ovi_tot = ri(0, 6); prodAttrs.r1_sui_tot = ri(0, 5); prodAttrs.r1_galinhas = ri(0, 40); }
        const cults = CULT.filter(() => r() < 0.15).slice(0, 4); if (!cults.length) cults.push(pick(CULT));
        prodAttrs.r1_culturas = cults.join(','); prodAttrs.r1_n_culturas = cults.length;
        const p = child(1, root, prodAttrs, root.geometry);
        cults.forEach(c => child(7, p, { r1_cultura: c, r1_cult_area: rf(0.2, area), r1_cult_sistema: pick(['Sequeiro', 'Sequeiro', 'Irrigado', 'Misto']) }));
      }
      if (r() < 0.15) for (let k = 0, n2 = ri(1, 3); k < n2; k++) {
        const at = { r3_nome: pessoa(), r3_tipo: pick(['PACE', 'PAC']), r3_actividades: pick(['Produção de semente', 'Multiplicação de rama', 'Venda de insumos']), r3_data: Math.round(dt), r3_desafios: pick(CONSTR) };
        putDes(at, 'r3', ri(2, 12)); child(2, root, at, root.geometry);
      }
      if (r() < 0.15) for (let k = 0, n2 = ri(1, 2); k < n2; k++) {
        const cults = [pick(CULT), pick(CULT)].filter((v, i, s) => s.indexOf(v) === i);
        const s = child(3, root, { r4_nome: pessoa(), r4_sexo: pick(['Masculino', 'Feminino']), r4_tipo: pick(['PACE', 'PAC']), r4_culturas: cults.join(','), r4_n_culturas: cults.length }, root.geometry);
        cults.forEach(c => child(9, s, { r4_cultura: c, r4_variedade: 'Var. ' + ri(1, 9), r4_quantidade: ri(50, 3000), r4_unidade: 'Kg', r4_area: rf(0.2, 3), r4_destino: pick(['Venda Local', 'Mercado nacional', 'Semente', 'Consumo próprio']), r4_data: Math.round(dt) }));
      }
      if (r() < 0.12) { const at = { b1_comunidade: a.comunidade, b1_anfitriao: pessoa(), b1_cultura_tec: pick(['Milho + feijão consociado', 'Agricultura de conservação', 'Variedade melhorada de arroz', 'Rega gota-a-gota']), b1_area: rf(0.05, 0.5, 2), b1_def: ri(0, 2) }; putDes(at, 'b1', ri(5, 40)); child(4, root, at); }
      if (r() < 0.2) child(5, root, { b2_cdr: a.comunidade + ' / ' + pessoa(), b2_estagio: pick(['instalacao', 'crescimento', 'crescimento', 'colheita', 'concluido']) });
      if (a.h2_recebeu === 'Sim') child(6, root, { h2_assunto: pick(['Distribuição de insumos', 'Conflito de terra', 'Atraso de pagamentos', 'Acesso à água']), h2_estado: pick(['resolvida', 'resolvida', 'encaminhada', 'pendente']), h2_dias: ri(1, 30) });
      if (r() < 0.1) { const at = { r2_nome: 'Associação ' + pick(['Esperança', 'Unidos', 'Futuro', 'Nova Vida', 'Progresso']) + ' ' + ri(1, 99), r2_tipo: pick(['Associação', 'Associação', 'Cooperativa', 'Grupo de produtores']), r2_comunidade: a.comunidade, r2_ano: ri(2005, 2026), r2_estado: pick(['Activa', 'Activa', 'Parcialmente activa', 'Inactiva', 'Em constituição']), r2_estagio: pick(['formacao', 'em_legalizacao', 'legalizada']), r2_vul: ri(0, 8) }; putDes(at, 'r2', ri(10, 80)); child(8, root, at); }
    }
    return T;
  }

  global.MockData = { SCHEMA, generate };
})(window);
