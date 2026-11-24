/* Cópia embutida do config.json (usada quando o site é aberto sem servidor, ex.: file://). Actualizada automaticamente ao publicar pela gestão. */
window.EMBEDDED_CONFIG = {
 "version": 1,
 "updatedAt": null,
 "site": {
  "title": "Diário do Extensionista",
  "subtitle": "Painel de monitoria das actividades de extensão agrária — DINAE",
  "logo": "assets/logo.svg",
  "favicon": "assets/logo.svg",
  "primaryColor": "#1F5C45",
  "accentColor": "#E0A526",
  "background": "#F4F1EA",
  "footerText": "Direcção Nacional de Extensão Agrária · Dados recolhidos via Survey123 / ArcGIS Online",
  "showFilters": true,
  "showDataBadge": true
 },
 "admin": {
  "passwordHash": "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9"
 },
 "dataSource": {
  "mode": "auto",
  "serviceUrl": "https://services8.arcgis.com/Yb7xytb4Ff2eEN6Y/arcgis/rest/services/survey123_f82cdff7d97f4fec9cadca2276932eca_results/FeatureServer",
  "token": "",
  "refreshMinutes": 15,
  "mockSeed": 42,
  "mockCount": 400
 },
 "layers": {
  "0": {
   "label": "Diários"
  },
  "1": {
   "label": "Produtores (R1)"
  },
  "2": {
   "label": "PACE (R3)"
  },
  "3": {
   "label": "Produtores de semente (R4)"
  },
  "4": {
   "label": "CDR estabelecidos (B1)"
  },
  "5": {
   "label": "CDR acompanhados (B2)"
  },
  "6": {
   "label": "Reclamações (H2)"
  },
  "7": {
   "label": "Culturas do produtor (R1)"
  },
  "8": {
   "label": "Organizações de produtores (R2)"
  },
  "9": {
   "label": "Culturas de semente (R4)"
  }
 },
 "filters": {
  "dateField": "data_actividade",
  "fields": [
   {
    "field": "provincia",
    "label": "Província"
   },
   {
    "field": "distrito",
    "label": "Distrito"
   },
   {
    "field": "nome_extensionista",
    "label": "Extensionista"
   }
  ]
 },
 "github": {
  "owner": "",
  "repo": "",
  "branch": "main",
  "path": "config.json"
 },
 "tabs": [
  {
   "id": "visao",
   "title": "Visão geral",
   "icon": "📊",
   "visible": true,
   "widgets": [
    {
     "id": "w_intro",
     "type": "text",
     "width": 12,
     "title": "",
     "html": "<h2>Bem-vindo ao painel do Diário do Extensionista</h2><p>Este painel apresenta, em tempo quase real, os resultados reportados pelos extensionistas através do formulário Survey123. Use os filtros acima para ver os dados por província, distrito, extensionista ou período.</p>",
     "style": "highlight"
    },
    {
     "id": "w_k1",
     "type": "kpi",
     "width": 3,
     "title": "Diários submetidos",
     "layer": 0,
     "agg": "count",
     "icon": "📝"
    },
    {
     "id": "w_k2",
     "type": "kpi",
     "width": 3,
     "title": "Produtores assistidos",
     "layer": 0,
     "agg": "sum",
     "field": "a2_tot",
     "icon": "👩🏾‍🌾"
    },
    {
     "id": "w_k3",
     "type": "kpi",
     "width": 3,
     "title": "Área acompanhada",
     "layer": 0,
     "agg": "sum",
     "field": "a4_area",
     "suffix": " ha",
     "decimals": 0,
     "icon": "🌱"
    },
    {
     "id": "w_k4",
     "type": "kpi",
     "width": 3,
     "title": "Extensionistas activos",
     "layer": 0,
     "agg": "distinct",
     "field": "nome_extensionista",
     "icon": "🧑🏾‍💼"
    },
    {
     "id": "w_c1",
     "type": "chart",
     "width": 8,
     "height": 300,
     "title": "Actividades reportadas por mês",
     "layer": 0,
     "chartType": "area",
     "groupBy": "data_actividade",
     "dateBin": "month",
     "sort": "label",
     "series": [
      {
       "label": "Diários",
       "agg": "count"
      },
      {
       "label": "Visitas de campo",
       "agg": "sum",
       "field": "a1_n"
      }
     ]
    },
    {
     "id": "w_c2",
     "type": "chart",
     "width": 4,
     "height": 300,
     "title": "Objectivo principal das visitas",
     "layer": 0,
     "chartType": "doughnut",
     "groupBy": "a1_objectivo",
     "sort": "value-desc",
     "series": [
      {
       "label": "Visitas",
       "agg": "count"
      }
     ]
    },
    {
     "id": "w_c3",
     "type": "chart",
     "width": 6,
     "height": 340,
     "title": "Produtores assistidos por província e grupo",
     "layer": 0,
     "chartType": "hstacked",
     "groupBy": "provincia",
     "sort": "value-desc",
     "series": [
      {
       "label": "Homens",
       "agg": "sum",
       "field": "a2_h"
      },
      {
       "label": "Mulheres",
       "agg": "sum",
       "field": "a2_m"
      },
      {
       "label": "Jovens homens",
       "agg": "sum",
       "field": "a2_jh"
      },
      {
       "label": "Jovens mulheres",
       "agg": "sum",
       "field": "a2_jm"
      }
     ]
    },
    {
     "id": "w_map",
     "type": "map",
     "width": 6,
     "height": 340,
     "title": "Localização das actividades",
     "layer": 0,
     "colorBy": "provincia",
     "popupFields": [
      "nome_extensionista",
      "data_actividade",
      "distrito",
      "a2_tot"
     ],
     "basemap": "gray"
    }
   ]
  },
  {
   "id": "produtores",
   "title": "Produtores",
   "icon": "🌾",
   "visible": true,
   "widgets": [
    {
     "id": "w_p1",
     "type": "kpi",
     "width": 3,
     "title": "Produtores registados",
     "layer": 1,
     "agg": "count",
     "icon": "🧾"
    },
    {
     "id": "w_p2",
     "type": "kpi",
     "width": 3,
     "title": "Membros dos agregados",
     "layer": 1,
     "agg": "sum",
     "field": "r1_agr_tot",
     "icon": "🏠"
    },
    {
     "id": "w_p3",
     "type": "kpi",
     "width": 3,
     "title": "Área total explorada",
     "layer": 1,
     "agg": "sum",
     "field": "r1_area_explorada",
     "suffix": " ha",
     "decimals": 1,
     "icon": "🗺️"
    },
    {
     "id": "w_p4",
     "type": "kpi",
     "width": 3,
     "title": "Com efectivo pecuário",
     "layer": 1,
     "agg": "count",
     "where": [
      {
       "field": "r1_pecuario",
       "op": "=",
       "value": "Sim"
      }
     ],
     "icon": "🐄"
    },
    {
     "id": "w_p5",
     "type": "chart",
     "width": 7,
     "height": 320,
     "title": "Área por cultura (ha)",
     "subtitle": "Soma da área declarada por cultura nos registos de produtores",
     "layer": 7,
     "chartType": "hbar",
     "groupBy": "r1_cultura",
     "sort": "value-desc",
     "limit": 12,
     "series": [
      {
       "label": "Área (ha)",
       "agg": "sum",
       "field": "r1_cult_area"
      }
     ]
    },
    {
     "id": "w_p6",
     "type": "chart",
     "width": 5,
     "height": 320,
     "title": "Sistema de produção",
     "layer": 7,
     "chartType": "pie",
     "groupBy": "r1_cult_sistema",
     "series": [
      {
       "label": "Culturas",
       "agg": "count"
      }
     ]
    },
    {
     "id": "w_p7",
     "type": "chart",
     "width": 6,
     "height": 300,
     "title": "Produtores registados por província",
     "layer": 1,
     "chartType": "bar",
     "groupBy": "parent:provincia",
     "sort": "value-desc",
     "series": [
      {
       "label": "Produtores",
       "agg": "count"
      }
     ]
    },
    {
     "id": "w_p8",
     "type": "chart",
     "width": 6,
     "height": 300,
     "title": "Efectivo pecuário",
     "layer": 1,
     "chartType": "bar",
     "series": [
      {
       "label": "Bovinos",
       "agg": "sum",
       "field": "r1_bov_tot"
      },
      {
       "label": "Caprinos",
       "agg": "sum",
       "field": "r1_cap_tot"
      },
      {
       "label": "Ovinos",
       "agg": "sum",
       "field": "r1_ovi_tot"
      },
      {
       "label": "Suínos",
       "agg": "sum",
       "field": "r1_sui_tot"
      }
     ]
    },
    {
     "id": "w_p9",
     "type": "table",
     "width": 12,
     "title": "Lista de produtores",
     "layer": 1,
     "columns": [
      "r1_nuipa",
      "parent:provincia",
      "parent:distrito",
      "parent:nome_extensionista",
      "r1_agr_tot",
      "r1_area_explorada",
      "r1_culturas",
      "r1_pecuario"
     ],
     "pageSize": 10
    }
   ]
  },
  {
   "id": "formacao",
   "title": "Formação e eventos",
   "icon": "🎓",
   "visible": true,
   "widgets": [
    {
     "id": "w_f1",
     "type": "kpi",
     "width": 3,
     "title": "Formados em SAN / nutrição",
     "layer": 0,
     "agg": "sum",
     "field": "c1_tot",
     "icon": "🥗"
    },
    {
     "id": "w_f2",
     "type": "kpi",
     "width": 3,
     "title": "Formados em pragas e doenças",
     "layer": 0,
     "agg": "sum",
     "field": "c6_tot",
     "icon": "🐛"
    },
    {
     "id": "w_f3",
     "type": "kpi",
     "width": 3,
     "title": "Participantes em eventos",
     "layer": 0,
     "agg": "sum",
     "field": "b3_tot",
     "icon": "🎪"
    },
    {
     "id": "w_f4",
     "type": "kpi",
     "width": 3,
     "title": "CDR estabelecidos",
     "layer": 4,
     "agg": "count",
     "icon": "🧪"
    },
    {
     "id": "w_f5",
     "type": "chart",
     "width": 6,
     "height": 300,
     "title": "Participantes por tipo de evento",
     "layer": 0,
     "chartType": "bar",
     "groupBy": "b3_tipo",
     "series": [
      {
       "label": "Participantes",
       "agg": "sum",
       "field": "b3_tot"
      }
     ]
    },
    {
     "id": "w_f6",
     "type": "chart",
     "width": 6,
     "height": 300,
     "title": "Rendimento médio: CDR vs prática habitual (kg/ha)",
     "layer": 0,
     "chartType": "bar",
     "groupBy": "b4_cultura",
     "series": [
      {
       "label": "CDR",
       "agg": "avg",
       "field": "b4_cdr"
      },
      {
       "label": "Prática habitual",
       "agg": "avg",
       "field": "b4_habitual"
      }
     ]
    },
    {
     "id": "w_f7",
     "type": "chart",
     "width": 5,
     "height": 300,
     "title": "Estágio dos CDR acompanhados",
     "layer": 5,
     "chartType": "doughnut",
     "groupBy": "b2_estagio",
     "series": [
      {
       "label": "CDR",
       "agg": "count"
      }
     ]
    },
    {
     "id": "w_f8",
     "type": "table",
     "width": 7,
     "title": "CDR estabelecidos",
     "layer": 4,
     "columns": [
      "b1_comunidade",
      "b1_anfitriao",
      "b1_cultura_tec",
      "b1_area",
      "b1_tot",
      "parent:provincia"
     ],
     "pageSize": 8
    }
   ]
  },
  {
   "id": "organizacoes",
   "title": "Organizações e mercado",
   "icon": "🤝",
   "visible": true,
   "widgets": [
    {
     "id": "w_o1",
     "type": "kpi",
     "width": 4,
     "title": "Organizações registadas",
     "layer": 8,
     "agg": "count",
     "icon": "🏛️"
    },
    {
     "id": "w_o2",
     "type": "kpi",
     "width": 4,
     "title": "Membros das organizações",
     "layer": 8,
     "agg": "sum",
     "field": "r2_tot",
     "icon": "👥"
    },
    {
     "id": "w_o3",
     "type": "kpi",
     "width": 4,
     "title": "Valor poupado em grupos (MZN)",
     "layer": 0,
     "agg": "sum",
     "field": "d6_valor",
     "icon": "💰"
    },
    {
     "id": "w_o4",
     "type": "chart",
     "width": 6,
     "height": 300,
     "title": "Estado de funcionamento das organizações",
     "layer": 8,
     "chartType": "doughnut",
     "groupBy": "r2_estado",
     "series": [
      {
       "label": "Organizações",
       "agg": "count"
      }
     ]
    },
    {
     "id": "w_o5",
     "type": "chart",
     "width": 6,
     "height": 300,
     "title": "Produtores que comercializaram, por produto",
     "layer": 0,
     "chartType": "bar",
     "groupBy": "e1_produto",
     "sort": "value-desc",
     "series": [
      {
       "label": "Produtores",
       "agg": "sum",
       "field": "e1_tot"
      }
     ]
    },
    {
     "id": "w_o6",
     "type": "table",
     "width": 12,
     "title": "Organizações de produtores",
     "layer": 8,
     "columns": [
      "r2_nome",
      "r2_tipo",
      "r2_comunidade",
      "parent:provincia",
      "r2_tot",
      "r2_estado",
      "r2_estagio"
     ],
     "pageSize": 10
    }
   ]
  },
  {
   "id": "salvaguardas",
   "title": "Salvaguardas",
   "icon": "🛡️",
   "visible": true,
   "widgets": [
    {
     "id": "w_s1",
     "type": "kpi",
     "width": 4,
     "title": "Reclamações recebidas",
     "layer": 6,
     "agg": "count",
     "icon": "📣"
    },
    {
     "id": "w_s2",
     "type": "kpi",
     "width": 4,
     "title": "Tempo médio de resposta",
     "layer": 6,
     "agg": "avg",
     "field": "h2_dias",
     "suffix": " dias",
     "decimals": 1,
     "icon": "⏱️"
    },
    {
     "id": "w_s3",
     "type": "kpi",
     "width": 4,
     "title": "Surtos de pragas observados",
     "layer": 0,
     "agg": "count",
     "where": [
      {
       "field": "i1_surto",
       "op": "=",
       "value": "Sim"
      }
     ],
     "icon": "⚠️"
    },
    {
     "id": "w_s4",
     "type": "chart",
     "width": 5,
     "height": 300,
     "title": "Estado das reclamações",
     "layer": 6,
     "chartType": "pie",
     "groupBy": "h2_estado",
     "series": [
      {
       "label": "Reclamações",
       "agg": "count"
      }
     ]
    },
    {
     "id": "w_s5",
     "type": "chart",
     "width": 7,
     "height": 300,
     "title": "Pragas e doenças reportadas",
     "layer": 0,
     "chartType": "hbar",
     "groupBy": "i1_praga",
     "sort": "value-desc",
     "series": [
      {
       "label": "Ocorrências",
       "agg": "count"
      }
     ]
    },
    {
     "id": "w_s6",
     "type": "table",
     "width": 12,
     "title": "Reclamações",
     "layer": 6,
     "columns": [
      "h2_assunto",
      "h2_estado",
      "h2_dias",
      "parent:provincia",
      "parent:distrito",
      "parent:data_actividade"
     ],
     "pageSize": 10
    }
   ]
  },
  {
   "id": "sobre",
   "title": "Sobre",
   "icon": "ℹ️",
   "visible": true,
   "widgets": [
    {
     "id": "w_ab1",
     "type": "text",
     "width": 7,
     "title": "Sobre esta plataforma",
     "html": "<p>O <b>Diário do Extensionista</b> é a ferramenta de registo diário das actividades dos extensionistas. Cada submissão pode incluir registos de produtores, organizações, CDR, reclamações e outros, que ficam ligados ao diário de origem.</p><p>Os dados são actualizados automaticamente a partir do ArcGIS Online.</p><ul><li>Fonte: Survey123 / ArcGIS Online</li><li>Actualização: automática</li></ul>"
    },
    {
     "id": "w_ab2",
     "type": "image",
     "width": 5,
     "title": "",
     "src": "assets/logo.svg",
     "caption": "Substitua esta imagem na área de gestão",
     "height": 220,
     "fit": "contain"
    }
   ]
  }
 ]
};
