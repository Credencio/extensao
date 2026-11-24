# Dashboard — Diário do Extensionista (ArcGIS Online + GitHub Pages)

Plataforma estática (HTML + JavaScript, sem servidor e sem compilação) que apresenta os resultados do
feature service Survey123 do ArcGIS Online, com área de gestão para editar tudo sem mexer em código.

## Publicar no GitHub Pages

1. Crie um repositório no GitHub (ex.: `dashboard-dinae`) e carregue **todo o conteúdo desta pasta** para a raiz
   (incluindo o ficheiro `.nojekyll`).
2. No repositório: **Settings → Pages → Build and deployment → Source: Deploy from a branch**,
   escolha o ramo `main` e a pasta `/ (root)`. Guarde.
3. Após 1–2 minutos o site fica disponível em `https://<utilizador>.github.io/<repositório>/`.
4. A gestão está em `https://<utilizador>.github.io/<repositório>/admin.html`
   (palavra-passe inicial: **admin123** — altere-a logo em *Segurança*).

## Permitir que a gestão publique alterações

A gestão guarda as alterações num rascunho no navegador. Para as publicar directamente no site:

1. GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. *Repository access*: apenas este repositório. *Permissions → Contents*: **Read and write**.
3. Na gestão → **Publicar**: indique utilizador, repositório, ramo (`main`) e o token. Clique **Publicar agora**.

O token nunca é gravado no `config.json`; fica só no navegador de quem publica.
Sem token, use *Descarregar config.json* e substitua o ficheiro no repositório manualmente.

## Exportações (no dashboard)

- **Relatório PDF** (botão no topo): capa com fonte de dados, filtros aplicados e nº de registos por tabela,
  seguida de uma secção por aba com indicadores, gráficos, mapas, textos, imagens e tabelas. Respeita os filtros activos.
- **Excel** (botão no topo):
  - *Dados analisados*: folha de indicadores + uma folha por gráfico, tabela e mapa, tal como aparecem no dashboard;
  - *Dados brutos*: uma folha por tabela do feature service (com `globalid`/`parentglobalid` e coordenadas) + dicionário de campos;
  - *Tudo*: as duas coisas no mesmo ficheiro.
- Cada gráfico, mapa e tabela tem ainda os botões **Expandir**, **Descarregar** (PNG, CSV, Excel) e **Ver dados**.
- O mapa usa fundos Esri (cinza claro por omissão) e o botão de camadas permite mudar para **imagem de satélite**,
  ruas, topográfico, cinza escuro ou OpenStreetMap. A legenda mostra contagens e permite ocultar categorias com um clique.

## O que se pode fazer na gestão

| Secção | Funções |
|---|---|
| Abas e conteúdo | Criar, renomear, ocultar, duplicar, reordenar (arrastar) e eliminar abas. Adicionar/editar/mover widgets: texto rico, imagem, indicador (KPI), gráfico (barras, linha, área, pizza, anel, empilhado), tabela, mapa, iframe. |
| Aparência e textos | Título, subtítulo, logótipo, favicon, cores, rodapé. |
| Fonte de dados | URL do feature service, modo (automático / ArcGIS / fictícios), actualização automática, nomes das tabelas, hierarquia das relações. |
| Filtros | Filtros globais (província, distrito, extensionista, datas…) — aplicam-se à tabela-mãe e propagam-se às tabelas-filhas. |
| Backup e restauro | Exportar configuração (.json), backup completo (.zip com configuração, imagens e dados em CSV/JSON), pontos de restauro locais, backups no GitHub (pasta `/backups`), restaurar a partir de ficheiro. |
| Publicar | Envia `config.json` e imagens carregadas para o repositório (com backup automático da versão anterior). |
| Segurança | Alterar a palavra-passe de gestão. |

Há ainda **Desfazer** (Ctrl+Z) e **pré-visualização ao vivo** do rascunho.

## Dados e relações

- O modo **Automático** lê o feature service; enquanto este não tiver registos, mostra **dados fictícios**
  (com a mesma estrutura de campos) e um aviso amarelo "Dados fictícios". Quando os primeiros formulários
  forem submetidos, o dashboard passa sozinho a usar os dados reais.
- Todas as camadas e tabelas são lidas e ligadas por `parentglobalid → globalid`:

```
diario_extensionista_dinae (0)
├─ rep_r1_produtor (1) ── rep_r1_cultura (7)
├─ rep_r3_pace (2)
├─ rep_r4_semente (3) ── rep_r4_cultura (9)
├─ rep_b1_cdr (4)
├─ rep_b2_cdr (5)
├─ rep_h2_reclamacao (6)
└─ rep_r2_op (8)
```

- Nos widgets de uma tabela-filha pode usar campos do pai (`↑`, ex.: província do diário) e da raiz (`⇈`).
- Valores de listas (domínios) são mostrados com os nomes legíveis; respostas de escolha múltipla
  ("Milho,Feijão") podem ser contadas separadamente nos gráficos.
- O serviço tem de estar partilhado como **público** (ou use um token, que ficará visível no `config.json`).

## Estrutura

```
index.html        dashboard público
admin.html        área de gestão
config.json       toda a configuração (abas, widgets, textos, imagens, cores, fonte de dados)
css/              estilos
js/data.js        leitura do ArcGIS, relações, filtros e agregações
js/mock.js        esquema do serviço e gerador de dados fictícios
js/widgets.js     texto, imagem, KPI, gráfico (Chart.js), tabela, mapa (Leaflet), iframe
js/app.js         dashboard
js/admin.js       gestão
js/github.js      publicação via API do GitHub
assets/           imagens (as carregadas na gestão vão para assets/uploads/)
```

## Notas de segurança

O GitHub Pages só serve ficheiros estáticos: a palavra-passe de gestão apenas esconde o editor.
A protecção real é o token do GitHub — sem ele ninguém consegue alterar o site público.
