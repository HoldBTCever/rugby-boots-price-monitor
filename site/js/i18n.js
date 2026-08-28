// Tradução (pt-BR/es-PY/en-US), formatação com Intl e helpers de
// ordenação/localização -- tudo que depende do idioma atual da página.
"use strict";

export const LANGS = ["pt-BR", "es-PY", "en-US"];
const LANG_KEY = "rbpm-lang";
const DEFAULT_LANG = "es-PY";

function loadStoredLang() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved && LANGS.includes(saved)) return saved;
  } catch (e) { /* localStorage indisponível: segue no idioma padrão */ }
  return DEFAULT_LANG;
}

// Estado interno do módulo -- exportado só via getter/setter pra manter
// um único ponto de mutação (setCurrentLang), que também persiste no
// localStorage. Módulos que importam currentLang() sempre leem o valor
// atual, nunca uma cópia presa no momento do import.
let currentLang = loadStoredLang();
export function getCurrentLang() {
  return currentLang;
}
export function setCurrentLang(lang) {
  currentLang = lang;
  try { localStorage.setItem(LANG_KEY, currentLang); } catch (e) {}
}

export const I18N = {
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

export function t(key, vars) {
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
export const trVersion = (v) => (ENUM_VERSION_KEYS[v] ? t(ENUM_VERSION_KEYS[v]) : v);
export const trUpper = (v) => (v && ENUM_UPPER_KEYS[v] ? t(ENUM_UPPER_KEYS[v]) : v);

// Cabedal/travas/encaixe de um grupo curado (scraper/model_specs.json)
// vêm como {"pt-BR":..., "es-PY":..., "en-US":...} -- escolhe o idioma
// atual (com fallback pt-BR). Quando não é curado (extraído do título
// automaticamente), o valor já é uma string simples -- passa direto.
export const pickLocalized = (v) => (v && typeof v === "object" ? (v[currentLang] || v["pt-BR"]) : v);

export function applyStaticTranslations() {
  document.title = t("page_title");
  document.documentElement.lang = currentLang;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.innerHTML = t(el.getAttribute("data-i18n"));
  });
}

export const fmtUSD = (v) => v == null ? "—" : v.toLocaleString(currentLang, { style: "currency", currency: "USD" });
export const fmtPct = (v) => v == null ? "—" : (v * 100).toLocaleString(currentLang, { maximumFractionDigits: 1 }) + "%";
export const fmtDate = (iso) => iso ? new Date(iso + "T00:00:00").toLocaleDateString(currentLang, { day: "2-digit", month: "short" }) : "—";
export const fmtAsuncion = (iso, opts) => iso ? new Date(iso).toLocaleString(currentLang, { timeZone: "America/Asuncion", ...opts }) : "—";
export const fmtBlockAxis = (iso) => fmtAsuncion(iso, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
export const fmtBlockFull = (iso) => fmtAsuncion(iso, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " (ASU)";
export const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
export const compareStrings = (a, b) => (a || "").localeCompare(b || "", currentLang, { sensitivity: "base", numeric: true });
// Ordena marca -> modelo -> versão, sempre alfabético (nunca a ordem de
// primeira aparição no CSV, que é o que aggregate.py produz por padrão).
export const sortModels = (models) => [...models].sort((a, b) =>
  compareStrings(a.brand, b.brand) || compareStrings(a.model, b.model) || compareStrings(a.version, b.version));
