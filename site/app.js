(function () {
  "use strict";

  // ---- i18n ----
  const LANGS = ["pt-BR", "es-PY", "en-US"];
  const LANG_KEY = "rbpm-lang";

  function loadStoredLang() {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved && LANGS.includes(saved)) return saved;
    } catch (e) { /* localStorage indisponível: segue no idioma padrão */ }
    return "pt-BR";
  }
  let currentLang = loadStoredLang();

  const I18N = {
    "pt-BR": {
      page_title: "Monitor de Preços — Chuteiras de Rugby",
      site_title: "Monitor de Preços — Chuteiras de Rugby",
      site_subtitle: "Coleta diária em lojas dos EUA, Reino Unido/Europa, Japão, Argentina e Paraguai",
      loading_data: "Carregando dados…",
      theme_toggle_label: "Tema",
      tab_painel: "Painel",
      tab_historico: "Histórico",
      tab_comparar: "Comparar",
      tab_favoritos: "Favoritos ⭐",
      footer_p1: 'Preços convertidos para USD no dia da coleta. Uma chuteira é destacada como oferta quando seu menor preço encontrado fica <strong>{threshold}</strong> ou mais abaixo da média histórica do mesmo modelo/versão. Isto é uma ferramenta informativa — confirme sempre o preço final na loja.',
      footer_source_link: "Código-fonte no GitHub",
      banner_none_title: "Nenhuma chuteira confirmada ainda",
      banner_none_body: "A coleta já roda sozinha todo dia (e a cada ajuste no código) — sem precisar de nenhuma ação manual. Ainda assim nenhuma loja conectada devolveu um produto reconhecido como chuteira de rugby na última execução, então o painel fica vazio de propósito em vez de mostrar algo errado.",
      banner_no_deals_title: "Nenhuma oferta abaixo do limiar hoje",
      banner_no_deals_body: "Nenhum modelo está {threshold} ou mais barato que sua média histórica no momento.",
      deal_below: "abaixo",
      deal_vs_avg: "vs média",
      deals_found_singular: "{n} oferta encontrada hoje",
      deals_found_plural: "{n} ofertas encontradas hoje",
      banner_deals_body: "Chuteiras com preço {threshold} ou mais abaixo da média histórica do modelo.",
      stat_models: "Modelos monitorados",
      stat_sources: "Fontes ativas",
      stat_deals_today: "Ofertas hoje",
      stat_observations: "Observações totais",
      chart_lib_error: "Não foi possível carregar a biblioteca de gráficos (Chart.js via CDN). Verifique a conexão com a internet — o restante do painel continua funcionando normalmente.",
      chart_avg_label: "Preço médio",
      chart_min_label: "Menor preço do dia",
      th_brand: "Marca",
      th_model: "Modelo",
      th_version: "Versão",
      th_avg_usd: "Média (USD)",
      th_min_today: "Menor hoje",
      th_variation: "Variação",
      th_min_source: "Fonte do menor preço",
      th_status: "Status",
      badge_deal: "Oferta",
      empty_no_history_title: "Nenhum histórico de preços ainda",
      empty_no_history_body: "A coleta roda sozinha todo dia — assim que uma loja conectada devolver uma chuteira de rugby de verdade, os gráficos e a tabela aparecem aqui automaticamente, sem precisar de nenhuma ação.",
      main_chart_title: "Histórico de preço médio",
      label_model: "Modelo:",
      main_table_title: "Todos os modelos monitorados",
      label_brand: "Marca:",
      option_all_brands: "Todas as marcas",
      label_version: "Versão:",
      option_all_versions: "Todas as versões",
      label_sort_by: "Ordenar por:",
      sort_name: "Nome (A-Z)",
      sort_discount: "Maior variação primeiro",
      sort_avg_desc: "Maior preço médio",
      sort_avg_asc: "Menor preço médio",
      models_count_singular: "{visible} de {total} modelo",
      models_count_plural: "{visible} de {total} modelos",
      no_match_filter: "Nenhum modelo bate com esse filtro.",
      no_match_filter_option: "Nenhum modelo bate com esse filtro",
      row_avg_price: "Preço médio (USD)",
      row_min_today: "Menor preço hoje",
      row_ground_type: "Solado",
      row_upper_material: "Cabedal",
      row_stud_type: "Travas",
      row_width_fit: "Encaixe (largura)",
      not_informed: "Não informado",
      b_cheaper: "B mais barata",
      a_cheaper: "A mais barata",
      no_difference: "sem diferença",
      equal: "igual",
      different: "diferente",
      th_attribute: "Atributo",
      th_boot_a: "Chuteira A",
      th_boot_b: "Chuteira B",
      th_difference: "Diferença",
      compare_source_note: "Fonte dos dados de cabedal/travas/encaixe pesquisados manualmente — {sources}.",
      compare_source_a: "Chuteira A (cabedal/travas/encaixe): {source}",
      compare_source_b: "Chuteira B (cabedal/travas/encaixe): {source}",
      empty_compare_title: "Ainda não há chuteiras suficientes pra comparar",
      empty_compare_body: "Assim que pelo menos 2 modelos forem confirmados, o comparador aparece aqui.",
      compare_title: "Comparar chuteiras",
      compare_intro: "Preço, solado, cabedal, travas e encaixe (largura) lado a lado. Pra um grupo curado de modelos, cabedal/travas/encaixe vêm de pesquisa manual (ficha técnica da marca ou loja, fonte sempre citada abaixo da tabela); nos demais, só o que a própria loja menciona no título do produto — sem inventar dado quando a fonte não informa.",
      label_boot_a: "Chuteira A:",
      label_boot_b: "Chuteira B:",
      watchlist_header: "Último bloco processado: {block} · a coleta atualiza a cada bloco novo minerado",
      watchlist_not_found: "Ainda não encontrado em nenhuma loja monitorada.",
      th_block: "Bloco",
      th_datetime: "Data/hora",
      th_avg: "Média",
      th_max: "Maior",
      th_min: "Menor",
      last_updated: "Última coleta: {date} · janela de média: {days} dias",
      no_collection_yet: "Ainda sem coleta registrada",
      error_load_data: "Não foi possível carregar os dados",
      error_load_history: "Não foi possível carregar o histórico",
      error_load_favorites: "Não foi possível carregar os favoritos",
      enum_version_padrao: "Padrão",
      enum_upper_kangaroo: "Couro canguru",
      enum_upper_leather: "Couro",
      enum_upper_synthetic: "Sintético",
    },
    "es-PY": {
      page_title: "Monitor de Precios — Botines de Rugby",
      site_title: "Monitor de Precios — Botines de Rugby",
      site_subtitle: "Recolección diaria en tiendas de EE. UU., Reino Unido/Europa, Japón, Argentina y Paraguay",
      loading_data: "Cargando datos…",
      theme_toggle_label: "Tema",
      tab_painel: "Panel",
      tab_historico: "Histórico",
      tab_comparar: "Comparar",
      tab_favoritos: "Favoritos ⭐",
      footer_p1: 'Los precios se convierten a USD el día de la recolección. Un botín se destaca como oferta cuando su menor precio encontrado está <strong>{threshold}</strong> o más por debajo del promedio histórico del mismo modelo/versión. Esta es una herramienta informativa — confirmá siempre el precio final en la tienda.',
      footer_source_link: "Código fuente en GitHub",
      banner_none_title: "Todavía no hay ningún botín confirmado",
      banner_none_body: "La recolección ya funciona sola todos los días (y con cada ajuste en el código) — sin necesitar ninguna acción manual. Aun así, ninguna tienda conectada devolvió un producto reconocido como botín de rugby en la última ejecución, así que el panel queda vacío a propósito en vez de mostrar algo incorrecto.",
      banner_no_deals_title: "Ninguna oferta por debajo del umbral hoy",
      banner_no_deals_body: "Ningún modelo está {threshold} o más barato que su promedio histórico en este momento.",
      deal_below: "por debajo",
      deal_vs_avg: "vs. promedio",
      deals_found_singular: "{n} oferta encontrada hoy",
      deals_found_plural: "{n} ofertas encontradas hoy",
      banner_deals_body: "Botines con precio {threshold} o más por debajo del promedio histórico del modelo.",
      stat_models: "Modelos monitoreados",
      stat_sources: "Fuentes activas",
      stat_deals_today: "Ofertas hoy",
      stat_observations: "Observaciones totales",
      chart_lib_error: "No se pudo cargar la biblioteca de gráficos (Chart.js vía CDN). Revisá tu conexión a internet — el resto del panel sigue funcionando normalmente.",
      chart_avg_label: "Precio promedio",
      chart_min_label: "Menor precio del día",
      th_brand: "Marca",
      th_model: "Modelo",
      th_version: "Versión",
      th_avg_usd: "Promedio (USD)",
      th_min_today: "Menor hoy",
      th_variation: "Variación",
      th_min_source: "Fuente del menor precio",
      th_status: "Estado",
      badge_deal: "Oferta",
      empty_no_history_title: "Todavía no hay historial de precios",
      empty_no_history_body: "La recolección funciona sola todos los días — en cuanto una tienda conectada devuelva un botín de rugby real, los gráficos y la tabla aparecen acá automáticamente, sin necesitar ninguna acción.",
      main_chart_title: "Historial de precio promedio",
      label_model: "Modelo:",
      main_table_title: "Todos los modelos monitoreados",
      label_brand: "Marca:",
      option_all_brands: "Todas las marcas",
      label_version: "Versión:",
      option_all_versions: "Todas las versiones",
      label_sort_by: "Ordenar por:",
      sort_name: "Nombre (A-Z)",
      sort_discount: "Mayor variación primero",
      sort_avg_desc: "Mayor precio promedio",
      sort_avg_asc: "Menor precio promedio",
      models_count_singular: "{visible} de {total} modelo",
      models_count_plural: "{visible} de {total} modelos",
      no_match_filter: "Ningún modelo coincide con ese filtro.",
      no_match_filter_option: "Ningún modelo coincide con ese filtro",
      row_avg_price: "Precio promedio (USD)",
      row_min_today: "Menor precio hoy",
      row_ground_type: "Tipo de terreno",
      row_upper_material: "Material superior",
      row_stud_type: "Tapones",
      row_width_fit: "Calce (ancho)",
      not_informed: "No informado",
      b_cheaper: "B más barata",
      a_cheaper: "A más barata",
      no_difference: "sin diferencia",
      equal: "igual",
      different: "diferente",
      th_attribute: "Atributo",
      th_boot_a: "Botín A",
      th_boot_b: "Botín B",
      th_difference: "Diferencia",
      compare_source_note: "Fuente de los datos de cabedal/tapones/calce investigados manualmente — {sources}.",
      compare_source_a: "Botín A (material superior/tapones/calce): {source}",
      compare_source_b: "Botín B (material superior/tapones/calce): {source}",
      empty_compare_title: "Todavía no hay suficientes botines para comparar",
      empty_compare_body: "En cuanto se confirmen al menos 2 modelos, el comparador aparece acá.",
      compare_title: "Comparar botines",
      compare_intro: "Precio, tipo de terreno, material superior, tapones y calce (ancho) lado a lado. Para un grupo curado de modelos, el material superior/tapones/calce vienen de investigación manual (ficha técnica de la marca o tienda, fuente siempre citada debajo de la tabla); en el resto, solo lo que la propia tienda menciona en el título del producto — sin inventar datos cuando la fuente no informa.",
      label_boot_a: "Botín A:",
      label_boot_b: "Botín B:",
      watchlist_header: "Último bloque procesado: {block} · la recolección se actualiza con cada bloque nuevo minado",
      watchlist_not_found: "Todavía no encontrado en ninguna tienda monitoreada.",
      th_block: "Bloque",
      th_datetime: "Fecha/hora",
      th_avg: "Promedio",
      th_max: "Mayor",
      th_min: "Menor",
      last_updated: "Última recolección: {date} · ventana de promedio: {days} días",
      no_collection_yet: "Todavía sin recolección registrada",
      error_load_data: "No se pudieron cargar los datos",
      error_load_history: "No se pudo cargar el historial",
      error_load_favorites: "No se pudieron cargar los favoritos",
      enum_version_padrao: "Estándar",
      enum_upper_kangaroo: "Cuero de canguro",
      enum_upper_leather: "Cuero",
      enum_upper_synthetic: "Sintético",
    },
    "en-US": {
      page_title: "Price Monitor — Rugby Boots",
      site_title: "Price Monitor — Rugby Boots",
      site_subtitle: "Daily collection across stores in the US, UK/Europe, Japan, Argentina, and Paraguay",
      loading_data: "Loading data…",
      theme_toggle_label: "Theme",
      tab_painel: "Dashboard",
      tab_historico: "History",
      tab_comparar: "Compare",
      tab_favoritos: "Favorites ⭐",
      footer_p1: "Prices are converted to USD on the day they're collected. A boot is flagged as a deal when its lowest found price is <strong>{threshold}</strong> or more below the historical average for that same model/version. This is an informational tool — always confirm the final price at the store.",
      footer_source_link: "Source code on GitHub",
      banner_none_title: "No boots confirmed yet",
      banner_none_body: "Collection already runs on its own every day (and after every code change) — no manual action needed. Even so, no connected store returned a product recognized as a rugby boot in the last run, so the dashboard stays empty on purpose instead of showing something wrong.",
      banner_no_deals_title: "No deals below the threshold today",
      banner_no_deals_body: "No model is currently {threshold} or more cheaper than its historical average.",
      deal_below: "below",
      deal_vs_avg: "vs average",
      deals_found_singular: "{n} deal found today",
      deals_found_plural: "{n} deals found today",
      banner_deals_body: "Boots priced {threshold} or more below the model's historical average.",
      stat_models: "Models tracked",
      stat_sources: "Active sources",
      stat_deals_today: "Deals today",
      stat_observations: "Total observations",
      chart_lib_error: "Couldn't load the charting library (Chart.js via CDN). Check your internet connection — the rest of the dashboard keeps working normally.",
      chart_avg_label: "Average price",
      chart_min_label: "Lowest price of the day",
      th_brand: "Brand",
      th_model: "Model",
      th_version: "Version",
      th_avg_usd: "Average (USD)",
      th_min_today: "Lowest today",
      th_variation: "Change",
      th_min_source: "Lowest price source",
      th_status: "Status",
      badge_deal: "Deal",
      empty_no_history_title: "No price history yet",
      empty_no_history_body: "Collection runs on its own every day — as soon as a connected store returns a real rugby boot, the charts and table appear here automatically, no action needed.",
      main_chart_title: "Average price history",
      label_model: "Model:",
      main_table_title: "All tracked models",
      label_brand: "Brand:",
      option_all_brands: "All brands",
      label_version: "Version:",
      option_all_versions: "All versions",
      label_sort_by: "Sort by:",
      sort_name: "Name (A-Z)",
      sort_discount: "Biggest discount first",
      sort_avg_desc: "Highest average price",
      sort_avg_asc: "Lowest average price",
      models_count_singular: "{visible} of {total} model",
      models_count_plural: "{visible} of {total} models",
      no_match_filter: "No model matches that filter.",
      no_match_filter_option: "No model matches that filter",
      row_avg_price: "Average price (USD)",
      row_min_today: "Lowest price today",
      row_ground_type: "Ground type",
      row_upper_material: "Upper material",
      row_stud_type: "Studs",
      row_width_fit: "Fit (width)",
      not_informed: "Not provided",
      b_cheaper: "B is cheaper",
      a_cheaper: "A is cheaper",
      no_difference: "no difference",
      equal: "same",
      different: "different",
      th_attribute: "Attribute",
      th_boot_a: "Boot A",
      th_boot_b: "Boot B",
      th_difference: "Difference",
      compare_source_note: "Source for the manually researched upper material/studs/fit data — {sources}.",
      compare_source_a: "Boot A (upper/studs/fit): {source}",
      compare_source_b: "Boot B (upper/studs/fit): {source}",
      empty_compare_title: "Not enough boots to compare yet",
      empty_compare_body: "As soon as at least 2 models are confirmed, the comparison tool appears here.",
      compare_title: "Compare boots",
      compare_intro: "Price, ground type, upper material, studs, and fit (width) side by side. For a curated group of models, upper/studs/fit come from manual research (the brand's or store's spec sheet, source always cited below the table); for the rest, only what the store itself mentions in the product title — never inventing data when the source doesn't say.",
      label_boot_a: "Boot A:",
      label_boot_b: "Boot B:",
      watchlist_header: "Last block processed: {block} · collection updates with every newly mined block",
      watchlist_not_found: "Not found in any monitored store yet.",
      th_block: "Block",
      th_datetime: "Date/time",
      th_avg: "Average",
      th_max: "Highest",
      th_min: "Lowest",
      last_updated: "Last collection: {date} · average window: {days} days",
      no_collection_yet: "No collection recorded yet",
      error_load_data: "Couldn't load the data",
      error_load_history: "Couldn't load the history",
      error_load_favorites: "Couldn't load the favorites",
      enum_version_padrao: "Standard",
      enum_upper_kangaroo: "Kangaroo leather",
      enum_upper_leather: "Leather",
      enum_upper_synthetic: "Synthetic",
    },
  };

  function t(key, vars) {
    const dict = I18N[currentLang] || I18N["pt-BR"];
    let str = dict[key] ?? I18N["pt-BR"][key] ?? key;
    if (vars) {
      for (const k of Object.keys(vars)) str = str.replaceAll(`{${k}}`, vars[k]);
    }
    return str;
  }

  // Valores fixos que o backend grava sempre em português (poucos, um
  // conjunto fechado) -- traduz só a exibição, nunca o dado gravado (a
  // comparação/agrupamento continua usando o texto original).
  const ENUM_VERSION_KEYS = { "Padrão": "enum_version_padrao" };
  const ENUM_UPPER_KEYS = {
    "Couro canguru": "enum_upper_kangaroo",
    "Couro": "enum_upper_leather",
    "Sintético": "enum_upper_synthetic",
  };
  const trVersion = (v) => (ENUM_VERSION_KEYS[v] ? t(ENUM_VERSION_KEYS[v]) : v);
  const trUpper = (v) => (v && ENUM_UPPER_KEYS[v] ? t(ENUM_UPPER_KEYS[v]) : v);

  // Cabedal/travas/encaixe de um grupo curado (scraper/model_specs.json)
  // vêm como {"pt-BR":..., "es-PY":..., "en-US":...} -- escolhe o idioma
  // atual (com fallback pt-BR). Quando não é curado (extraído do título
  // automaticamente), o valor já é uma string simples -- passa direto.
  const pickLocalized = (v) => (v && typeof v === "object" ? (v[currentLang] || v["pt-BR"]) : v);

  function applyStaticTranslations() {
    document.title = t("page_title");
    document.documentElement.lang = currentLang;
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      el.innerHTML = t(el.getAttribute("data-i18n"));
    });
  }

  const fmtUSD = (v) => v == null ? "—" : v.toLocaleString(currentLang, { style: "currency", currency: "USD" });
  const fmtPct = (v) => v == null ? "—" : (v * 100).toLocaleString(currentLang, { maximumFractionDigits: 1 }) + "%";
  const fmtDate = (iso) => iso ? new Date(iso + "T00:00:00").toLocaleDateString(currentLang, { day: "2-digit", month: "short" }) : "—";
  const fmtAsuncion = (iso, opts) => iso ? new Date(iso).toLocaleString(currentLang, { timeZone: "America/Asuncion", ...opts }) : "—";
  const fmtBlockAxis = (iso) => fmtAsuncion(iso, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const fmtBlockFull = (iso) => fmtAsuncion(iso, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " (ASU)";
  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const compareStrings = (a, b) => (a || "").localeCompare(b || "", currentLang, { sensitivity: "base", numeric: true });
  // Ordena marca -> modelo -> versão, sempre alfabético (nunca a ordem de
  // primeira aparição no CSV, que é o que aggregate.py produz por padrão).
  const sortModels = (models) => [...models].sort((a, b) =>
    compareStrings(a.brand, b.brand) || compareStrings(a.model, b.model) || compareStrings(a.version, b.version));

  // ---- tema ----
  const themeToggle = document.getElementById("themeToggle");
  function applyStoredTheme() {
    try {
      const saved = localStorage.getItem("rbpm-theme");
      if (saved) document.documentElement.setAttribute("data-theme", saved);
    } catch (e) { /* localStorage indisponível: segue no tema do sistema */ }
  }
  applyStoredTheme();
  themeToggle.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") ||
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("rbpm-theme", next); } catch (e) {}
    if (window.__rbpmChart) renderChart(window.__rbpmModels, window.__rbpmSelectedKey);
    if (window.__rbpmWatchlist) renderWatchlist(window.__rbpmWatchlist, "watchlistContent", "wlChart");
    if (window.__rbpmFavorites) renderWatchlist(window.__rbpmFavorites, "favoritesContent", "favChart");
  });

  // ---- idioma ----
  const langSelect = document.getElementById("langSelect");
  langSelect.value = currentLang;
  langSelect.addEventListener("change", () => {
    currentLang = langSelect.value;
    try { localStorage.setItem(LANG_KEY, currentLang); } catch (e) {}
    main();
  });

  // ---- abas ----
  const TAB_NAMES = ["painel", "historico", "comparar", "favoritos"];
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      TAB_NAMES.forEach((name) => {
        document.getElementById(`tab-${name}`).hidden = btn.dataset.tab !== name;
      });

      // Chart.js mede o contêiner na criação; se o gráfico foi criado dentro
      // de uma aba escondida (hidden), ele fica preso no tamanho padrão
      // 300x150. Ao exibir a aba, força um resize em cada gráfico visível.
      const panel = document.getElementById(`tab-${btn.dataset.tab}`);
      if (panel && typeof Chart !== "undefined") {
        panel.querySelectorAll("canvas").forEach((c) => {
          const chart = Chart.getChart(c);
          if (chart) chart.resize();
        });
      }
    });
  });

  let chartInstance = null;
  const activeCharts = {}; // containerId -> Chart[] (Histórico e Favoritos usam a mesma renderWatchlist)

  function renderBanner(summary, alerts, thresholdText) {
    const slot = document.getElementById("bannerSlot");
    const deals = alerts.deals || [];

    if (summary.totals.models_tracked === 0) {
      slot.innerHTML = `
        <div class="banner">
          <h2><span class="dot" style="background:var(--status-warning)"></span> ${t("banner_none_title")}</h2>
          <p>${t("banner_none_body")}</p>
        </div>`;
      return;
    }

    if (deals.length === 0) {
      slot.innerHTML = `
        <div class="banner good">
          <h2><span class="dot"></span> ${t("banner_no_deals_title")}</h2>
          <p>${t("banner_no_deals_body", { threshold: thresholdText })}</p>
        </div>`;
      return;
    }

    const items = deals.map((d) => `
      <li class="deal-item">
        <span>${d.brand} ${d.model} <em style="color:var(--text-muted); font-style:normal">${trVersion(d.version)}</em>
          — <a href="${d.url}" target="_blank" rel="noopener">${d.site_name}</a>
          <span style="color:var(--text-muted)">(${d.region})</span></span>
        <span class="deal-pct">${fmtPct(d.discount_pct)} ${t("deal_below")} · ${fmtUSD(d.deal_price_usd)} <span style="color:var(--text-muted); font-weight:400">${t("deal_vs_avg")} ${fmtUSD(d.avg_price_usd)}</span></span>
      </li>`).join("");

    slot.innerHTML = `
      <div class="banner critical">
        <h2><span class="dot"></span> ${t(deals.length === 1 ? "deals_found_singular" : "deals_found_plural", { n: deals.length })}</h2>
        <p>${t("banner_deals_body", { threshold: thresholdText })}</p>
        <ul class="deal-list">${items}</ul>
      </div>`;
  }

  function renderStats(summary) {
    const tt = summary.totals;
    const tiles = [
      [t("stat_models"), tt.models_tracked],
      [t("stat_sources"), tt.sources],
      [t("stat_deals_today"), tt.deals_today],
      [t("stat_observations"), tt.observations],
    ];
    document.getElementById("statsSlot").innerHTML = tiles.map(([label, value]) => `
      <div class="stat-tile">
        <div class="label">${label}</div>
        <div class="value">${value.toLocaleString(currentLang)}</div>
      </div>`).join("");
  }

  function renderChart(models, selectedKey) {
    const model = models.find((m) => m.key === selectedKey) || models[0];
    if (!model) return;
    window.__rbpmSelectedKey = model.key;

    const container = document.querySelector(".chart-container");
    if (typeof Chart === "undefined") {
      if (container) {
        container.style.height = "auto";
        container.innerHTML = `<p style="color:var(--text-muted); padding:20px 0">${t("chart_lib_error")}</p>`;
      }
      return;
    }
    if (!document.getElementById("priceChart")) return;

    const labels = model.history.map((h) => fmtDate(h.date));
    const avgData = model.history.map((h) => h.avg_price_usd);
    const minData = model.history.map((h) => h.min_price_usd);

    const ctx = document.getElementById("priceChart").getContext("2d");
    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: t("chart_avg_label"),
            data: avgData,
            borderColor: cssVar("--series-1"),
            backgroundColor: cssVar("--series-1"),
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 5,
            tension: 0.25,
          },
          {
            label: t("chart_min_label"),
            data: minData,
            borderColor: cssVar("--series-2"),
            backgroundColor: cssVar("--series-2"),
            borderWidth: 2,
            borderDash: [4, 3],
            pointRadius: 3,
            pointHoverRadius: 5,
            tension: 0.25,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            position: "top",
            align: "start",
            labels: { color: cssVar("--text-secondary"), usePointStyle: true, boxWidth: 8 },
          },
          tooltip: {
            backgroundColor: cssVar("--surface-1"),
            titleColor: cssVar("--text-primary"),
            bodyColor: cssVar("--text-secondary"),
            borderColor: cssVar("--border"),
            borderWidth: 1,
            callbacks: { label: (item) => `${item.dataset.label}: ${fmtUSD(item.parsed.y)}` },
          },
        },
        scales: {
          x: { grid: { color: cssVar("--gridline") }, ticks: { color: cssVar("--text-muted") } },
          y: {
            grid: { color: cssVar("--gridline") },
            ticks: { color: cssVar("--text-muted"), callback: (v) => fmtUSD(v) },
          },
        },
      },
    });

    window.__rbpmChart = chartInstance;
  }

  function renderTableRows(models) {
    const rows = models.map((m) => `
      <tr>
        <td data-label="${t("th_brand")}">${m.brand}</td>
        <td data-label="${t("th_model")}">${m.model}</td>
        <td data-label="${t("th_version")}">${trVersion(m.version)}</td>
        <td class="num" data-label="${t("th_avg_usd")}">${fmtUSD(m.avg_price_usd)}</td>
        <td class="num" data-label="${t("th_min_today")}">${fmtUSD(m.latest_min_price_usd)}</td>
        <td class="num" data-label="${t("th_variation")}">${fmtPct(m.discount_pct)}</td>
        <td data-label="${t("th_min_source")}">${m.latest_min_site ? `<a href="${m.latest_min_url}" target="_blank" rel="noopener" style="color:var(--series-1); text-decoration:none">${m.latest_min_site}</a>` : "—"}</td>
        <td data-label="${t("th_status")}">${m.is_deal ? `<span class="badge deal">${t("badge_deal")}</span>` : ""}</td>
      </tr>`).join("");

    return `
      <div class="table-scroll">
        <table class="responsive-table">
          <thead>
            <tr>
              <th>${t("th_brand")}</th><th>${t("th_model")}</th><th>${t("th_version")}</th>
              <th class="num">${t("th_avg_usd")}</th><th class="num">${t("th_min_today")}</th>
              <th class="num">${t("th_variation")}</th><th>${t("th_min_source")}</th><th></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  // Marca/versão selecionadas ("" = todas) + critério de ordenação --
  // pedido do usuário: poder ver só "as elites" ou só "adidas", e ordenar
  // por variação/preço médio, não só por nome.
  function applyPainelFilters(models, filters) {
    let out = models;
    if (filters.brand) out = out.filter((m) => m.brand === filters.brand);
    if (filters.version) out = out.filter((m) => m.version === filters.version);

    const byName = (a, b) =>
      compareStrings(a.brand, b.brand) || compareStrings(a.model, b.model) || compareStrings(a.version, b.version);
    const sorted = [...out];
    if (filters.sort === "discount") {
      sorted.sort((a, b) => (b.discount_pct ?? -Infinity) - (a.discount_pct ?? -Infinity) || byName(a, b));
    } else if (filters.sort === "avg_desc") {
      sorted.sort((a, b) => (b.avg_price_usd ?? -Infinity) - (a.avg_price_usd ?? -Infinity) || byName(a, b));
    } else if (filters.sort === "avg_asc") {
      sorted.sort((a, b) => (a.avg_price_usd ?? Infinity) - (b.avg_price_usd ?? Infinity) || byName(a, b));
    } else {
      sorted.sort(byName);
    }
    return sorted;
  }

  function renderMain(summary) {
    const models = summary.models;
    window.__rbpmModels = models;

    if (models.length === 0) {
      document.getElementById("mainContent").innerHTML = `
        <div class="card empty-state">
          <div class="icon">🏉</div>
          <h2>${t("empty_no_history_title")}</h2>
          <p>${t("empty_no_history_body")}</p>
        </div>`;
      return;
    }

    const brands = [...new Set(models.map((m) => m.brand))].sort(compareStrings);
    const versions = [...new Set(models.map((m) => m.version))].sort(compareStrings);
    const brandOptions = brands.map((b) => `<option value="${b}">${b}</option>`).join("");
    const versionOptions = versions.map((v) => `<option value="${v}">${trVersion(v)}</option>`).join("");

    document.getElementById("mainContent").innerHTML = `
      <div class="card">
        <h2>${t("main_chart_title")}</h2>
        <div class="chart-controls">
          <label for="modelSelect">${t("label_model")}</label>
          <select id="modelSelect"></select>
        </div>
        <div class="chart-container"><canvas id="priceChart"></canvas></div>
      </div>
      <div class="card">
        <h2>${t("main_table_title")}</h2>
        <div class="chart-controls">
          <label for="filterBrand">${t("label_brand")}</label>
          <select id="filterBrand"><option value="">${t("option_all_brands")}</option>${brandOptions}</select>
          <label for="filterVersion">${t("label_version")}</label>
          <select id="filterVersion"><option value="">${t("option_all_versions")}</option>${versionOptions}</select>
          <label for="sortBy">${t("label_sort_by")}</label>
          <select id="sortBy">
            <option value="name">${t("sort_name")}</option>
            <option value="discount">${t("sort_discount")}</option>
            <option value="avg_desc">${t("sort_avg_desc")}</option>
            <option value="avg_asc">${t("sort_avg_asc")}</option>
          </select>
        </div>
        <p class="watchlist-meta" id="tableCount"></p>
        <div id="modelsTableSlot"></div>
      </div>`;

    const modelSelectEl = document.getElementById("modelSelect");
    const filterBrandEl = document.getElementById("filterBrand");
    const filterVersionEl = document.getElementById("filterVersion");
    const sortByEl = document.getElementById("sortBy");
    const tableSlot = document.getElementById("modelsTableSlot");
    const tableCount = document.getElementById("tableCount");

    function refresh() {
      const visible = applyPainelFilters(models, {
        brand: filterBrandEl.value, version: filterVersionEl.value, sort: sortByEl.value,
      });

      tableCount.textContent = t(visible.length === 1 ? "models_count_singular" : "models_count_plural", {
        visible: visible.length, total: models.length,
      });
      tableSlot.innerHTML = visible.length
        ? renderTableRows(visible)
        : `<p class="watchlist-empty">${t("no_match_filter")}</p>`;

      if (visible.length === 0) {
        modelSelectEl.innerHTML = `<option value="">${t("no_match_filter_option")}</option>`;
        modelSelectEl.disabled = true;
        return; // deixa o último gráfico renderizado como estava, sem forçar troca
      }
      modelSelectEl.disabled = false;

      const prevSelected = modelSelectEl.value;
      modelSelectEl.innerHTML = visible.map((m) =>
        `<option value="${m.key}">${m.brand} ${m.model} — ${trVersion(m.version)}${m.is_deal ? " 🔻" : ""}</option>`
      ).join("");
      const nextSelected = visible.find((m) => m.key === prevSelected) || visible.find((m) => m.is_deal) || visible[0];
      modelSelectEl.value = nextSelected.key;
      renderChart(models, nextSelected.key);
    }

    modelSelectEl.addEventListener("change", (e) => renderChart(models, e.target.value));
    filterBrandEl.addEventListener("change", refresh);
    filterVersionEl.addEventListener("change", refresh);
    sortByEl.addEventListener("change", refresh);

    refresh();
  }

  function getCompareRows() {
    return [
      { label: t("th_brand"), get: (m) => m.brand },
      { label: t("th_model"), get: (m) => m.model },
      { label: t("th_version"), get: (m) => trVersion(m.version) },
      { label: t("row_avg_price"), get: (m) => fmtUSD(m.avg_price_usd), numeric: (m) => m.avg_price_usd },
      { label: t("row_min_today"), get: (m) => fmtUSD(m.latest_min_price_usd), numeric: (m) => m.latest_min_price_usd },
      {
        label: t("th_min_source"),
        get: (m) => m.latest_min_site
          ? `<a href="${m.latest_min_url}" target="_blank" rel="noopener" style="color:var(--series-1); text-decoration:none">${m.latest_min_site}</a>`
          : "—",
      },
      { label: t("row_ground_type"), get: (m) => m.ground_type || t("not_informed") },
      { label: t("row_upper_material"), get: (m) => trUpper(pickLocalized(m.upper_material)) || t("not_informed") },
      { label: t("row_stud_type"), get: (m) => pickLocalized(m.stud_type) || t("not_informed") },
      { label: t("row_width_fit"), get: (m) => pickLocalized(m.width_fit) || t("not_informed") },
    ];
  }

  function renderCompareTable(models, keyA, keyB) {
    const a = models.find((m) => m.key === keyA);
    const b = models.find((m) => m.key === keyB);
    const slot = document.getElementById("compareTableSlot");
    if (!slot) return;
    if (!a || !b) { slot.innerHTML = ""; return; }

    const rows = getCompareRows().map((row) => {
      let diffCell = "";
      if (row.numeric) {
        const va = row.numeric(a);
        const vb = row.numeric(b);
        if (va != null && vb != null) {
          const diff = vb - va;
          const pct = va !== 0 ? Math.abs(diff / va) : null;
          const arrow = diff === 0 ? "" : (diff < 0 ? t("b_cheaper") : t("a_cheaper"));
          diffCell = diff === 0
            ? t("no_difference")
            : `${fmtUSD(Math.abs(diff))}${pct != null ? " (" + fmtPct(pct) + ")" : ""} — ${arrow}`;
        }
      } else if (a.key !== b.key) {
        const va = row.get(a).replace(/<[^>]+>/g, "");
        const vb = row.get(b).replace(/<[^>]+>/g, "");
        diffCell = va === vb ? t("equal") : t("different");
      }
      return `
        <tr>
          <td data-label="${t("th_attribute")}">${row.label}</td>
          <td data-label="${t("th_boot_a")}">${row.get(a)}</td>
          <td data-label="${t("th_boot_b")}">${row.get(b)}</td>
          <td data-label="${t("th_difference")}">${diffCell}</td>
        </tr>`;
    }).join("");

    const sources = [
      a.spec_source ? t("compare_source_a", { source: a.spec_source }) : null,
      b.spec_source ? t("compare_source_b", { source: b.spec_source }) : null,
    ].filter(Boolean);
    const sourceNote = sources.length
      ? `<p class="watchlist-meta" style="margin-top:10px">${sources.join(" · ")}</p>`
      : "";

    slot.innerHTML = `
      <div class="table-scroll">
        <table class="responsive-table">
          <thead><tr><th>${t("th_attribute")}</th><th>${t("th_boot_a")}</th><th>${t("th_boot_b")}</th><th>${t("th_difference")}</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      ${sourceNote}`;
  }

  function renderCompare(models) {
    const slot = document.getElementById("compareContent");
    if (!slot) return;

    if (!models || models.length < 2) {
      slot.innerHTML = `
        <div class="card empty-state">
          <div class="icon">🏉</div>
          <h2>${t("empty_compare_title")}</h2>
          <p>${t("empty_compare_body")}</p>
        </div>`;
      return;
    }

    const options = models.map((m) =>
      `<option value="${m.key}">${m.brand} ${m.model} — ${trVersion(m.version)}</option>`
    ).join("");

    slot.innerHTML = `
      <div class="card">
        <h2>${t("compare_title")}</h2>
        <p class="watchlist-meta">${t("compare_intro")}</p>
        <div class="chart-controls">
          <label for="compareSelectA">${t("label_boot_a")}</label>
          <select id="compareSelectA">${options}</select>
          <label for="compareSelectB">${t("label_boot_b")}</label>
          <select id="compareSelectB">${options}</select>
        </div>
        <div id="compareTableSlot"></div>
      </div>`;

    const selA = document.getElementById("compareSelectA");
    const selB = document.getElementById("compareSelectB");
    selA.value = models[0].key;
    selB.value = (models.find((m) => m.key !== models[0].key) || models[0]).key;
    const rerender = () => renderCompareTable(models, selA.value, selB.value);
    selA.addEventListener("change", rerender);
    selB.addEventListener("change", rerender);
    rerender();
  }

  // Serve tanto a aba "Histórico" (scraper/watchlist.json) quanto "Favoritos"
  // (scraper/favorites.json) -- mesmo formato de dados, só muda o contêiner
  // e o prefixo do id de cada canvas (pra não colidir entre as duas abas).
  function renderWatchlist(watchlist, containerId, chartPrefix) {
    if (containerId === "watchlistContent") window.__rbpmWatchlist = watchlist;
    else window.__rbpmFavorites = watchlist;

    (activeCharts[containerId] || []).forEach((c) => c.destroy());
    activeCharts[containerId] = [];

    const blockLabel = watchlist.latest_block ? `#${watchlist.latest_block.toLocaleString(currentLang)}` : "—";
    const header = `<p class="watchlist-meta">${t("watchlist_header", { block: `<strong>${blockLabel}</strong>` })}</p>`;

    const models = [...(watchlist.models || [])].sort((a, b) => compareStrings(a.label, b.label));
    const cards = models.map((m, idx) => {
      if (!m.versions.length) {
        return `
          <div class="card watchlist-card">
            <h2>${m.label}</h2>
            <p class="watchlist-empty">${t("watchlist_not_found")}</p>
          </div>`;
      }

      const rows = m.versions.map((v, i) => {
        const l = v.latest;
        return `
        <tr>
          <td data-label="${t("th_version")}"><span class="version-swatch" style="background:var(--cat-${(i % 8) + 1})"></span>${trVersion(v.version)}</td>
          <td data-label="${t("th_block")}">${l && l.block_height ? "#" + l.block_height.toLocaleString(currentLang) : "—"}</td>
          <td data-label="${t("th_datetime")}">${l ? fmtBlockFull(l.timestamp) : "—"}</td>
          <td class="num" data-label="${t("th_avg")}">${l ? fmtUSD(l.avg_price_usd) : "—"}</td>
          <td class="num" data-label="${t("th_max")}">${l ? fmtUSD(l.max_price_usd) : "—"}${l && l.max_site ? `<br><a href="${l.max_url}" target="_blank" rel="noopener" style="color:var(--series-1); text-decoration:none; font-size:0.78rem">${l.max_site}</a>` : ""}</td>
          <td class="num" data-label="${t("th_min")}">${l ? fmtUSD(l.min_price_usd) : "—"}${l && l.min_site ? `<br><a href="${l.min_url}" target="_blank" rel="noopener" style="color:var(--series-1); text-decoration:none; font-size:0.78rem">${l.min_site}</a>` : ""}</td>
        </tr>`;
      }).join("");

      return `
        <div class="card watchlist-card">
          <h2>${m.label}</h2>
          <div class="chart-container"><canvas id="${chartPrefix}${idx}"></canvas></div>
          <div class="table-scroll">
            <table class="version-table responsive-table">
              <thead><tr><th>${t("th_version")}</th><th>${t("th_block")}</th><th>${t("th_datetime")}</th><th class="num">${t("th_avg")}</th><th class="num">${t("th_max")}</th><th class="num">${t("th_min")}</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>`;
    });

    document.getElementById(containerId).innerHTML = header + `<div class="watchlist-grid">${cards.join("")}</div>`;

    models.forEach((m, idx) => {
      if (!m.versions.length) return;
      const canvas = document.getElementById(`${chartPrefix}${idx}`);
      if (!canvas || typeof Chart === "undefined") return;

      const allTimestamps = [...new Set(m.versions.flatMap((v) => v.history.map((h) => h.timestamp)))].sort();
      const labels = allTimestamps.map(fmtBlockAxis);

      const datasets = m.versions.map((v, i) => {
        const byTimestamp = Object.fromEntries(v.history.map((h) => [h.timestamp, h.avg_price_usd]));
        const color = cssVar(`--cat-${(i % 8) + 1}`);
        return {
          label: trVersion(v.version),
          data: allTimestamps.map((ts) => byTimestamp[ts] ?? null),
          borderColor: color,
          backgroundColor: color,
          borderWidth: 2,
          pointRadius: 2,
          pointHoverRadius: 4,
          spanGaps: true,
          tension: 0.25,
        };
      });

      const chart = new Chart(canvas.getContext("2d"), {
        type: "line",
        data: { labels, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: {
              position: "top", align: "start",
              labels: { color: cssVar("--text-secondary"), usePointStyle: true, boxWidth: 8 },
            },
            tooltip: {
              backgroundColor: cssVar("--surface-1"),
              titleColor: cssVar("--text-primary"),
              bodyColor: cssVar("--text-secondary"),
              borderColor: cssVar("--border"),
              borderWidth: 1,
              callbacks: { label: (item) => `${item.dataset.label}: ${fmtUSD(item.parsed.y)}` },
            },
          },
          scales: {
            x: { grid: { color: cssVar("--gridline") }, ticks: { color: cssVar("--text-muted") } },
            y: {
              grid: { color: cssVar("--gridline") },
              ticks: { color: cssVar("--text-muted"), callback: (v) => fmtUSD(v) },
            },
          },
        },
      });
      activeCharts[containerId].push(chart);
    });
  }

  // Busca os 4 arquivos de dados só uma vez (state.loaded); troca de idioma
  // chama main() de novo, mas só re-renderiza em cima do que já foi
  // buscado, sem round-trip novo à rede.
  const state = { loaded: false, summary: null, alerts: null, watchlist: null, favorites: null, errors: {} };

  async function main() {
    applyStaticTranslations();
    document.getElementById("lastUpdated").textContent = t("loading_data");

    if (!state.loaded) {
      try {
        const [summaryRes, alertsRes] = await Promise.all([
          fetch("data/daily_summary.json", { cache: "no-store" }),
          fetch("data/alerts.json", { cache: "no-store" }),
        ]);
        state.summary = await summaryRes.json();
        state.alerts = await alertsRes.json();
        state.summary.models = sortModels(state.summary.models);
      } catch (err) {
        state.errors.main = err;
      }

      try {
        const watchlistRes = await fetch("data/watchlist.json", { cache: "no-store" });
        state.watchlist = await watchlistRes.json();
      } catch (err) {
        state.errors.watchlist = err;
      }

      try {
        const favoritesRes = await fetch("data/favorites.json", { cache: "no-store" });
        state.favorites = await favoritesRes.json();
      } catch (err) {
        state.errors.favorites = err;
      }

      state.loaded = true;
    }

    if (state.errors.main || !state.summary) {
      document.getElementById("lastUpdated").textContent = t("no_collection_yet");
      document.getElementById("mainContent").innerHTML = `
        <div class="card empty-state">
          <div class="icon">⚠️</div>
          <h2>${t("error_load_data")}</h2>
          <p>${state.errors.main ? state.errors.main.message : ""}</p>
        </div>`;
    } else {
      const thresholdText = fmtPct(state.summary.threshold_pct);
      document.getElementById("footerIntro").innerHTML = t("footer_p1", { threshold: `<strong>${thresholdText}</strong>` });
      document.getElementById("lastUpdated").textContent = state.summary.generated_at
        ? t("last_updated", { date: new Date(state.summary.generated_at).toLocaleString(currentLang), days: state.summary.window_days })
        : t("no_collection_yet");

      renderBanner(state.summary, state.alerts, thresholdText);
      renderStats(state.summary);
      renderMain(state.summary);
      // Comparar só oferece favoritos + as famílias RS15/Morelia IV
      // (in_comparar calculado em aggregate.py) -- não os 166+ modelos
      // crus da varredura geral, difícil de navegar numa lista tão grande.
      renderCompare(state.summary.models.filter((m) => m.in_comparar));
    }

    if (state.errors.watchlist || !state.watchlist) {
      document.getElementById("watchlistContent").innerHTML = `
        <div class="card empty-state">
          <div class="icon">⚠️</div>
          <h2>${t("error_load_history")}</h2>
          <p>${state.errors.watchlist ? state.errors.watchlist.message : ""}</p>
        </div>`;
    } else {
      renderWatchlist(state.watchlist, "watchlistContent", "wlChart");
    }

    if (state.errors.favorites || !state.favorites) {
      document.getElementById("favoritesContent").innerHTML = `
        <div class="card empty-state">
          <div class="icon">⚠️</div>
          <h2>${t("error_load_favorites")}</h2>
          <p>${state.errors.favorites ? state.errors.favorites.message : ""}</p>
        </div>`;
    } else {
      renderWatchlist(state.favorites, "favoritesContent", "favChart");
    }
  }

  main();
})();
