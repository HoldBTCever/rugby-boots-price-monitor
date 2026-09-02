// Funções de renderização (banner, stats, gráfico, tabelas, comparador,
// histórico/favoritos) -- todas leem o idioma atual via i18n.ts.
"use strict";

import {
  t, trVersion, trUpper, pickLocalized,
  fmtPct, fmtDate, fmtBlockAxis, fmtBlockFull, cssVar, compareStrings,
  getCurrentLang,
} from "./i18n.js";
import { fmtMoney, getCurrentCurrency, setCurrentCurrency, availableCurrencies } from "./currency.js";
import type { Summary, Alerts, Model, Watchlist, Deal, SourcesData, FxRates } from "./types.js";

let chartInstance: any = null;
const activeCharts: Record<string, any[]> = {}; // containerId -> Chart[] (Histórico e Favoritos usam a mesma renderWatchlist)

// Zoom (roda do mouse/pinça) + pan (arrastar) via chartjs-plugin-zoom
// (carregado por <script> no index.html, como o próprio Chart.js) --
// mesma configuração pros dois lugares que desenham linha de preço
// (renderChart do Painel e renderWatchlist do Histórico/Favoritos).
// Duplo clique reseta pro zoom original em qualquer gráfico, sem
// precisar de um botão visível em cada card (seriam muitos botões
// pequenos repetidos na grade do Histórico/Favoritos).
function zoomPluginOptions(): object {
  return {
    pan: { enabled: true, mode: "x" },
    zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: "x" },
  };
}

function attachDblClickReset(canvas: HTMLCanvasElement, chart: any): void {
  canvas.addEventListener("dblclick", () => chart.resetZoom());
}

// URL compartilhável/favoritável de um modelo específico -- usada tanto
// pro hash da página (deep link, ver applyHashModel em main.ts) quanto
// pro botão compartilhar/copiar link. Preserva origin+pathname reais
// (funciona tanto local quanto no subcaminho do GitHub Pages) e troca só
// o hash, nunca cria entrada nova no histórico do navegador (replaceState),
// senão cada troca de modelo no seletor viraria um passo de "voltar".
export function modelUrl(key: string): string {
  return `${location.origin}${location.pathname}${location.search}#modelo=${encodeURIComponent(key)}`;
}
export function updateModelHash(key: string): void {
  history.replaceState(null, "", modelUrl(key));
}
export function modelKeyFromHash(): string | null {
  const m = /^#modelo=(.+)$/.exec(location.hash);
  return m ? decodeURIComponent(m[1]) : null;
}

// Marcador pessoal (★) na tabela do Painel -- deliberadamente NÃO chamado
// de "favorito" pra não confundir com a aba Favoritos (lista curada vinda
// do backend, scraper/favorites.json). Isto aqui é só um bloco de notas
// local no navegador de quem está olhando, pra achar de novo um modelo de
// interesse sem repetir a busca.
const STARRED_KEY = "rbpm-starred";

function loadStarred(): Set<string> {
  try {
    const raw = localStorage.getItem(STARRED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch (e) {
    return new Set();
  }
}

function saveStarred(starred: Set<string>): void {
  try { localStorage.setItem(STARRED_KEY, JSON.stringify([...starred])); } catch (e) {}
}

// Mini-gráfico de tendência (SVG puro, sem Chart.js) pros cards de
// "oferta encontrada hoje" -- usa o histórico diário já presente no
// modelo, sem pedir nada novo ao backend. Evita instanciar um Chart.js
// por card (seriam até 5+ instâncias só pra um traço decorativo) e
// funciona mesmo se a CDN do Chart.js falhar (não depende dela).
function sparklineSvg(values: number[]): string {
  if (values.length < 2) return "";
  const width = 64;
  const height = 22;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return `<svg class="sparkline" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-hidden="true">
    <polyline points="${points}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />
  </svg>`;
}

// Deal (alerts.json) e Model (daily_summary.json) vêm dos mesmos grupos
// de scraper/aggregate.py (mesma string bruta de brand/model/version) --
// comparação exata já é suficiente pra achar o histórico do modelo.
function findModelForDeal(models: Model[], d: Deal): Model | undefined {
  return models.find((m) => m.brand === d.brand && m.model === d.model && m.version === d.version);
}

// Placeholder animado enquanto os 4 arquivos de dados ainda estão sendo
// buscados -- antes disso, #bannerSlot/#statsSlot/#mainContent ficavam
// literalmente em branco, só com o texto "Carregando dados..." na linha
// de meta acima. Só é chamado quando ainda não há dado nenhum (main.ts
// não chama de novo na troca de idioma, pra não piscar).
export function renderSkeleton(): void {
  const block = (width: string, height: string) =>
    `<div class="skeleton-block" style="width:${width}; height:${height}"></div>`;

  (document.getElementById("bannerSlot") as HTMLElement).innerHTML = `
    <div class="card">${block("60%", "20px")}${block("90%", "14px")}</div>`;

  (document.getElementById("statsSlot") as HTMLElement).innerHTML = Array.from({ length: 4 }).map(() => `
    <div class="stat-tile">${block("70%", "12px")}${block("50%", "24px")}</div>`).join("");

  (document.getElementById("mainContent") as HTMLElement).innerHTML = `
    <div class="card">${block("40%", "18px")}${block("100%", "260px")}</div>
    <div class="card">${block("40%", "18px")}${block("100%", "40px")}${block("100%", "300px")}</div>`;
}

export function renderBanner(summary: Summary, alerts: Alerts, thresholdText: string): void {
  const slot = document.getElementById("bannerSlot") as HTMLElement;
  const deals = alerts.deals || [];

  if (summary.totals.models_tracked === 0) {
    slot.innerHTML = `
      <div class="banner">
        <h2><span class="dot" aria-hidden="true" style="background:var(--status-warning)"></span> ${t("banner_none_title")}</h2>
        <p>${t("banner_none_body")}</p>
      </div>`;
    return;
  }

  if (deals.length === 0) {
    slot.innerHTML = `
      <div class="banner good">
        <h2><span class="dot" aria-hidden="true"></span> ${t("banner_no_deals_title")}</h2>
        <p>${t("banner_no_deals_body", { threshold: thresholdText })}</p>
      </div>`;
    return;
  }

  const items = deals.map((d) => {
    const model = findModelForDeal(summary.models, d);
    const spark = model ? sparklineSvg(model.history.map((h) => h.avg_price_usd)) : "";
    return `
    <li class="deal-item">
      <span>${d.brand} ${d.model} <em style="color:var(--text-muted); font-style:normal">${trVersion(d.version)}</em>
        — <a href="${d.url}" target="_blank" rel="noopener">${d.site_name}</a>
        <span style="color:var(--text-muted)">(${d.region})</span></span>
      ${spark ? `<span class="deal-sparkline" style="color:var(--status-critical)">${spark}</span>` : ""}
      <span class="deal-pct">${fmtPct(d.discount_pct)} ${t("deal_below")} · ${fmtMoney(d.deal_price_usd)} <span style="color:var(--text-muted); font-weight:400">${t("deal_vs_avg")} ${fmtMoney(d.avg_price_usd)}</span></span>
    </li>`;
  }).join("");

  slot.innerHTML = `
    <div class="banner critical">
      <h2><span class="dot" aria-hidden="true"></span> ${t(deals.length === 1 ? "deals_found_singular" : "deals_found_plural", { n: deals.length })}</h2>
      <p>${t("banner_deals_body", { threshold: thresholdText })}</p>
      <ul class="deal-list">${items}</ul>
    </div>`;
}

export function renderStats(summary: Summary): void {
  const tt = summary.totals;
  const tiles: Array<[string, number]> = [
    [t("stat_models"), tt.models_tracked],
    [t("stat_sources"), tt.sources],
    [t("stat_deals_today"), tt.deals_today],
    [t("stat_observations"), tt.observations],
  ];
  (document.getElementById("statsSlot") as HTMLElement).innerHTML = tiles.map(([label, value]) => `
    <div class="stat-tile">
      <div class="label">${label}</div>
      <div class="value">${value.toLocaleString(getCurrentLang())}</div>
    </div>`).join("");
}

export function renderChart(models: Model[], selectedKey: string | undefined): void {
  const model = models.find((m) => m.key === selectedKey) || models[0];
  if (!model) return;
  window.__rbpmSelectedKey = model.key;
  updateModelHash(model.key);

  const container = document.querySelector(".chart-container") as HTMLElement | null;
  if (typeof Chart === "undefined") {
    if (container) {
      container.style.height = "auto";
      container.innerHTML = `<p style="color:var(--text-muted); padding:20px 0">${t("chart_lib_error")}</p>`;
    }
    return;
  }
  const canvas = document.getElementById("priceChart") as HTMLCanvasElement | null;
  if (!canvas) return;

  const labels = model.history.map((h) => fmtDate(h.date));
  const avgData = model.history.map((h) => h.avg_price_usd);
  const minData = model.history.map((h) => h.min_price_usd);

  const ctx = canvas.getContext("2d");
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
          callbacks: { label: (item: any) => `${item.dataset.label}: ${fmtMoney(item.parsed.y)}` },
        },
        zoom: zoomPluginOptions(),
      },
      scales: {
        x: { grid: { color: cssVar("--gridline") }, ticks: { color: cssVar("--text-muted") } },
        y: {
          grid: { color: cssVar("--gridline") },
          ticks: { color: cssVar("--text-muted"), callback: (v: number) => fmtMoney(v) },
        },
      },
    },
  });
  attachDblClickReset(canvas, chartInstance);

  window.__rbpmChart = chartInstance;
}

// Cabeçalho clicável de coluna ordenável -- alterna entre asc/desc quando
// já é a coluna ativa (aria-sort reflete o estado real pra leitor de
// tela), ou vai pro sentido padrão dessa coluna na primeira vez (preço/
// desconto começam do "maior" primeiro, nome começa A-Z). O <select>
// #sortBy (mesmo valor, ver renderMain) continua a fonte única da
// verdade -- clicar aqui só muda o valor dele e dispara o mesmo refresh,
// pra quem prefere teclado/dropdown não perder nenhuma opção.
function sortableHeader(label: string, ascValue: string, descValue: string, defaultValue: string, currentSort: string, extraClass = ""): string {
  const isActive = currentSort === ascValue || currentSort === descValue;
  const ariaSort = currentSort === ascValue ? "ascending" : currentSort === descValue ? "descending" : "none";
  const nextValue = currentSort === defaultValue ? (defaultValue === ascValue ? descValue : ascValue) : defaultValue;
  const arrow = currentSort === ascValue ? " ▲" : currentSort === descValue ? " ▼" : "";
  return `<th class="${extraClass} sortable-th" aria-sort="${ariaSort}">` +
    `<button type="button" class="sort-th-btn${isActive ? " active" : ""}" data-sort-next="${nextValue}">${label}${arrow}</button></th>`;
}

export function renderTableRows(models: Model[], starred: Set<string>, currentSort: string): string {
  const rows = models.map((m) => {
    const isStarred = starred.has(m.key);
    return `
    <tr>
      <td data-label="${t("label_star_col")}"><button type="button" class="star-btn${isStarred ? " starred" : ""}" data-star-key="${m.key}" aria-label="${t(isStarred ? "label_unstar" : "label_star")}" aria-pressed="${isStarred}">${isStarred ? "★" : "☆"}</button></td>
      <td data-label="${t("th_brand")}">${m.brand}</td>
      <td data-label="${t("th_model")}"><button type="button" class="row-model-link" data-model-key="${m.key}" aria-label="${t("label_view_chart", { model: `${m.brand} ${m.model}` })}">${m.model}</button></td>
      <td data-label="${t("th_version")}">${trVersion(m.version)}</td>
      <td class="num" data-label="${t("th_avg_usd")}">${fmtMoney(m.avg_price_usd)}</td>
      <td class="num" data-label="${t("th_min_today")}">${fmtMoney(m.latest_min_price_usd)}</td>
      <td class="num" data-label="${t("th_variation")}">${fmtPct(m.discount_pct)}</td>
      <td data-label="${t("th_min_source")}">${m.latest_min_site ? `<a href="${m.latest_min_url}" target="_blank" rel="noopener" style="color:var(--series-1); text-decoration:none">${m.latest_min_site}</a>` : "—"}</td>
      <td data-label="${t("th_status")}">${m.is_deal ? `<span class="badge deal">${t("badge_deal")}</span>` : ""}</td>
    </tr>`;
  }).join("");

  return `
    <div class="table-scroll">
      <table class="responsive-table">
        <thead>
          <tr>
            <th scope="col"></th>
            ${sortableHeader(t("th_brand"), "name", "name_desc", "name", currentSort)}
            <th scope="col">${t("th_model")}</th>
            <th scope="col">${t("th_version")}</th>
            ${sortableHeader(t("th_avg_usd"), "avg_asc", "avg_desc", "avg_desc", currentSort, "num")}
            ${sortableHeader(t("th_min_today"), "min_asc", "min_desc", "min_desc", currentSort, "num")}
            ${sortableHeader(t("th_variation"), "discount_asc", "discount", "discount", currentSort, "num")}
            <th scope="col">${t("th_min_source")}</th><th scope="col"></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

export interface PainelFilters {
  brand: string;
  version: string;
  sort: string;
  search?: string;
  starredOnly?: boolean;
}

// Marca/versão selecionadas ("" = todas) + busca por texto (marca/modelo/
// versão) + critério de ordenação -- pedido do usuário: poder ver só "as
// elites" ou só "adidas", buscar direto em vez de rolar os 127 modelos, e
// ordenar por variação/preço médio, não só por nome.
export function applyPainelFilters(models: Model[], filters: PainelFilters, starred: Set<string>): Model[] {
  let out = models;
  if (filters.brand) out = out.filter((m) => m.brand === filters.brand);
  if (filters.version) out = out.filter((m) => m.version === filters.version);
  if (filters.search) {
    const q = filters.search.trim().toLowerCase();
    if (q) out = out.filter((m) => `${m.brand} ${m.model} ${trVersion(m.version)}`.toLowerCase().includes(q));
  }
  if (filters.starredOnly) out = out.filter((m) => starred.has(m.key));

  const byName = (a: Model, b: Model) =>
    compareStrings(a.brand, b.brand) || compareStrings(a.model, b.model) || compareStrings(a.version, b.version);
  const sorted = [...out];
  // Cabeçalho de coluna clicável (renderTableRows/sortableHeader) e o
  // <select> #sortBy escrevem no mesmo `filters.sort` -- um só lugar
  // decide a ordenação de verdade, os dois controles só mudam esse valor.
  if (filters.sort === "discount") {
    sorted.sort((a, b) => (b.discount_pct ?? -Infinity) - (a.discount_pct ?? -Infinity) || byName(a, b));
  } else if (filters.sort === "discount_asc") {
    sorted.sort((a, b) => (a.discount_pct ?? Infinity) - (b.discount_pct ?? Infinity) || byName(a, b));
  } else if (filters.sort === "avg_desc") {
    sorted.sort((a, b) => (b.avg_price_usd ?? -Infinity) - (a.avg_price_usd ?? -Infinity) || byName(a, b));
  } else if (filters.sort === "avg_asc") {
    sorted.sort((a, b) => (a.avg_price_usd ?? Infinity) - (b.avg_price_usd ?? Infinity) || byName(a, b));
  } else if (filters.sort === "min_desc") {
    sorted.sort((a, b) => (b.latest_min_price_usd ?? -Infinity) - (a.latest_min_price_usd ?? -Infinity) || byName(a, b));
  } else if (filters.sort === "min_asc") {
    sorted.sort((a, b) => (a.latest_min_price_usd ?? Infinity) - (b.latest_min_price_usd ?? Infinity) || byName(a, b));
  } else if (filters.sort === "name_desc") {
    sorted.sort((a, b) => -byName(a, b));
  } else {
    sorted.sort(byName);
  }
  return sorted;
}

// 127 modelos numa tabela só viravam ~37.000px de rolagem no mobile (cada
// linha vira um cartão empilhado abaixo de 720px, ver styles.css) -- 25
// por página deixa isso administrável sem esconder nada, só espalhado.
const PAGE_SIZE = 25;

function paginate<T>(items: T[], page: number): T[] {
  const start = (page - 1) * PAGE_SIZE;
  return items.slice(start, start + PAGE_SIZE);
}

function renderPagination(totalItems: number, page: number): string {
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  if (totalPages <= 1) return "";
  return `
    <div class="pagination">
      <button type="button" id="pagePrev" ${page <= 1 ? "disabled" : ""}>← ${t("pagination_prev")}</button>
      <span class="watchlist-meta">${t("pagination_page", { page, total: totalPages })}</span>
      <button type="button" id="pageNext" ${page >= totalPages ? "disabled" : ""}>${t("pagination_next")} →</button>
    </div>`;
}

export function renderMain(summary: Summary): void {
  const models = summary.models;
  window.__rbpmModels = models;

  if (models.length === 0) {
    (document.getElementById("mainContent") as HTMLElement).innerHTML = `
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

  (document.getElementById("mainContent") as HTMLElement).innerHTML = `
    <div class="card">
      <div class="card-title-row">
        <h2>${t("main_chart_title")}</h2>
        <div class="chart-actions">
          <button type="button" id="resetZoomBtn" class="icon-btn" title="${t("action_reset_zoom")}" aria-label="${t("action_reset_zoom")}">⤢</button>
          <button type="button" id="shareModelBtn" class="icon-btn" title="${t("action_share")}" aria-label="${t("action_share")}">🔗</button>
        </div>
      </div>
      <p class="watchlist-meta" id="shareFeedback" role="status" aria-live="polite"></p>
      <div class="chart-controls">
        <label for="modelSelect">${t("label_model")}</label>
        <select id="modelSelect"></select>
      </div>
      <p class="watchlist-meta">${t("hint_zoom_pan")}</p>
      <div class="chart-container"><canvas id="priceChart" role="img" aria-label="${t("main_chart_title")}"></canvas></div>
    </div>
    <div class="card">
      <h2>${t("main_table_title")}</h2>
      <div class="chart-controls table-controls">
        <label for="filterSearch">${t("label_search")}</label>
        <input type="search" id="filterSearch" placeholder="${t("search_placeholder")}" />
        <label for="filterBrand">${t("label_brand")}</label>
        <select id="filterBrand"><option value="">${t("option_all_brands")}</option>${brandOptions}</select>
        <label for="filterVersion">${t("label_version")}</label>
        <select id="filterVersion"><option value="">${t("option_all_versions")}</option>${versionOptions}</select>
        <label for="sortBy">${t("label_sort_by")}</label>
        <select id="sortBy">
          <option value="name">${t("sort_name")}</option>
          <option value="name_desc">${t("sort_name_desc")}</option>
          <option value="discount">${t("sort_discount")}</option>
          <option value="discount_asc">${t("sort_discount_asc")}</option>
          <option value="avg_desc">${t("sort_avg_desc")}</option>
          <option value="avg_asc">${t("sort_avg_asc")}</option>
          <option value="min_desc">${t("sort_min_desc")}</option>
          <option value="min_asc">${t("sort_min_asc")}</option>
        </select>
        <label class="checkbox-label"><input type="checkbox" id="filterStarredOnly" /> ${t("label_starred_only")}</label>
        <label class="checkbox-label"><input type="checkbox" id="compactMode" /> ${t("label_compact_mode")}</label>
      </div>
      <p class="watchlist-meta" id="tableCount" role="status" aria-live="polite"></p>
      <div id="modelsTableSlot"></div>
      <div id="tablePagination"></div>
    </div>`;

  const modelSelectEl = document.getElementById("modelSelect") as HTMLSelectElement;
  const filterSearchEl = document.getElementById("filterSearch") as HTMLInputElement;
  const filterBrandEl = document.getElementById("filterBrand") as HTMLSelectElement;
  const filterVersionEl = document.getElementById("filterVersion") as HTMLSelectElement;
  const sortByEl = document.getElementById("sortBy") as HTMLSelectElement;
  const filterStarredOnlyEl = document.getElementById("filterStarredOnly") as HTMLInputElement;
  const compactModeEl = document.getElementById("compactMode") as HTMLInputElement;
  const tableSlot = document.getElementById("modelsTableSlot") as HTMLElement;
  const tableCount = document.getElementById("tableCount") as HTMLElement;
  const paginationSlot = document.getElementById("tablePagination") as HTMLElement;
  const shareFeedback = document.getElementById("shareFeedback") as HTMLElement;

  let currentPage = 1;
  const starred = loadStarred();

  // Modo compacto (menos preenchimento/fonte menor por linha) é uma
  // preferência pessoal salva no navegador -- classe fica no contêiner
  // #modelsTableSlot em vez de dentro de renderTableRows porque só ele
  // sobrevive entre um refresh() e outro (o innerHTML de dentro é
  // recriado a cada filtro/ordenação/página).
  try {
    compactModeEl.checked = localStorage.getItem("rbpm-compact") === "1";
  } catch (e) {}
  tableSlot.classList.toggle("table-compact", compactModeEl.checked);

  function refresh(): void {
    const visible = applyPainelFilters(models, {
      brand: filterBrandEl.value, version: filterVersionEl.value, sort: sortByEl.value,
      search: filterSearchEl.value, starredOnly: filterStarredOnlyEl.checked,
    }, starred);

    tableCount.textContent = t(visible.length === 1 ? "models_count_singular" : "models_count_plural", {
      visible: visible.length, total: models.length,
    });

    const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;
    const pageItems = paginate(visible, currentPage);

    tableSlot.innerHTML = pageItems.length
      ? renderTableRows(pageItems, starred, sortByEl.value)
      : `<p class="watchlist-empty">${t("no_match_filter")}</p>`;
    paginationSlot.innerHTML = renderPagination(visible.length, currentPage);
    document.getElementById("pagePrev")?.addEventListener("click", () => { currentPage--; refresh(); });
    document.getElementById("pageNext")?.addEventListener("click", () => { currentPage++; refresh(); });
    tableSlot.querySelectorAll<HTMLButtonElement>(".star-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.starKey as string;
        if (starred.has(key)) starred.delete(key); else starred.add(key);
        saveStarred(starred);
        refresh();
      });
    });
    // Cabeçalho de coluna clicável -- só muda o valor do <select> #sortBy
    // e reaproveita o mesmo caminho de refresh, pra ordenação por
    // teclado/dropdown e por clique no cabeçalho nunca desincronizarem.
    tableSlot.querySelectorAll<HTMLButtonElement>(".sort-th-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        sortByEl.value = btn.dataset.sortNext as string;
        refreshFromFilterChange();
      });
    });
    // Nome do modelo na tabela também seleciona no gráfico acima (deep
    // link por modelo) -- mesmo efeito de escolher no <select>, só que
    // sem precisar rolar até lá primeiro.
    tableSlot.querySelectorAll<HTMLButtonElement>(".row-model-link").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.modelKey as string;
        if (modelSelectEl.querySelector(`option[value="${CSS.escape(key)}"]`)) {
          modelSelectEl.value = key;
        }
        renderChart(models, key);
        document.querySelector(".chart-container")?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });

    if (visible.length === 0) {
      modelSelectEl.innerHTML = `<option value="">${t("no_match_filter_option")}</option>`;
      modelSelectEl.disabled = true;
      return; // deixa o último gráfico renderizado como estava, sem forçar troca
    }
    modelSelectEl.disabled = false;

    // O seletor do gráfico oferece TODOS os modelos que batem no filtro,
    // não só os da página atual -- paginação é só pra tabela, o gráfico
    // continua livre pra qualquer modelo filtrado.
    const prevSelected = modelSelectEl.value;
    modelSelectEl.innerHTML = visible.map((m) =>
      `<option value="${m.key}">${m.brand} ${m.model} — ${trVersion(m.version)}${m.is_deal ? " 🔻" : ""}</option>`
    ).join("");
    // Na primeira renderização, um link compartilhado (#modelo=...) tem
    // prioridade sobre "primeira oferta"/"primeiro da lista" -- é assim
    // que abrir um link direto de modelo cai exatamente nele.
    const hashKey = modelKeyFromHash();
    const fromHash = hashKey ? visible.find((m) => m.key === hashKey) : undefined;
    const nextSelected = fromHash || visible.find((m) => m.key === prevSelected) || visible.find((m) => m.is_deal) || visible[0];
    modelSelectEl.value = nextSelected.key;
    renderChart(models, nextSelected.key);
  }

  function refreshFromFilterChange(): void {
    currentPage = 1; // qualquer mudança de busca/filtro/ordenação volta pra página 1
    refresh();
  }

  modelSelectEl.addEventListener("change", (e) => renderChart(models, (e.target as HTMLSelectElement).value));
  filterSearchEl.addEventListener("input", refreshFromFilterChange);
  filterBrandEl.addEventListener("change", refreshFromFilterChange);
  filterVersionEl.addEventListener("change", refreshFromFilterChange);
  sortByEl.addEventListener("change", refreshFromFilterChange);
  filterStarredOnlyEl.addEventListener("change", refreshFromFilterChange);
  compactModeEl.addEventListener("change", () => {
    tableSlot.classList.toggle("table-compact", compactModeEl.checked);
    try { localStorage.setItem("rbpm-compact", compactModeEl.checked ? "1" : "0"); } catch (e) {}
  });

  document.getElementById("resetZoomBtn")?.addEventListener("click", () => window.__rbpmChart?.resetZoom());
  document.getElementById("shareModelBtn")?.addEventListener("click", async () => {
    const key = window.__rbpmSelectedKey;
    if (!key) return;
    const url = modelUrl(key);
    const model = models.find((m) => m.key === key);
    const shareTitle = model ? `${model.brand} ${model.model} — ${trVersion(model.version)}` : t("site_title");
    if (navigator.share) {
      try {
        await navigator.share({ title: shareTitle, url });
        return;
      } catch (e) {
        return; // usuário cancelou o share nativo -- não cai pro clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      shareFeedback.textContent = t("share_copied");
      setTimeout(() => { shareFeedback.textContent = ""; }, 3000);
    } catch (e) {
      shareFeedback.textContent = url; // clipboard indisponível -- mostra o link pra copiar manualmente
    }
  });

  refresh();
}

export interface CompareRow {
  label: string;
  get: (m: Model) => string;
  numeric?: (m: Model) => number | null;
}

export function getCompareRows(): CompareRow[] {
  return [
    { label: t("th_brand"), get: (m) => m.brand },
    { label: t("th_model"), get: (m) => m.model },
    { label: t("th_version"), get: (m) => trVersion(m.version) },
    { label: t("row_avg_price"), get: (m) => fmtMoney(m.avg_price_usd), numeric: (m) => m.avg_price_usd },
    { label: t("row_min_today"), get: (m) => fmtMoney(m.latest_min_price_usd), numeric: (m) => m.latest_min_price_usd },
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

export function renderCompareTable(models: Model[], keyA: string, keyB: string): void {
  const a = models.find((m) => m.key === keyA);
  const b = models.find((m) => m.key === keyB);
  const slot = document.getElementById("compareTableSlot");
  if (!slot) return;
  if (!a || !b) { slot.innerHTML = ""; return; }

  const rows = getCompareRows().map((row) => {
    let diffCell = "";
    // Qual lado é mais barato nesta linha (pra pintar a célula de verde
    // -- leitura instantânea sem precisar ler a coluna "Diferença").
    let cheaperSide: "a" | "b" | null = null;
    if (row.numeric) {
      const va = row.numeric(a);
      const vb = row.numeric(b);
      if (va != null && vb != null) {
        const diff = vb - va;
        const pct = va !== 0 ? Math.abs(diff / va) : null;
        const arrow = diff === 0 ? "" : (diff < 0 ? t("b_cheaper") : t("a_cheaper"));
        diffCell = diff === 0
          ? t("no_difference")
          : `${fmtMoney(Math.abs(diff))}${pct != null ? " (" + fmtPct(pct) + ")" : ""} — ${arrow}`;
        if (diff < 0) cheaperSide = "b";
        else if (diff > 0) cheaperSide = "a";
      }
    } else if (a.key !== b.key) {
      const va = row.get(a).replace(/<[^>]+>/g, "");
      const vb = row.get(b).replace(/<[^>]+>/g, "");
      diffCell = va === vb ? t("equal") : t("different");
    }
    return `
      <tr>
        <td data-label="${t("th_attribute")}">${row.label}</td>
        <td data-label="${t("th_boot_a")}" class="${cheaperSide === "a" ? "cheaper" : ""}">${row.get(a)}</td>
        <td data-label="${t("th_boot_b")}" class="${cheaperSide === "b" ? "cheaper" : ""}">${row.get(b)}</td>
        <td data-label="${t("th_difference")}">${diffCell}</td>
      </tr>`;
  }).join("");

  const sources = [
    a.spec_source ? t("compare_source_a", { source: a.spec_source }) : null,
    b.spec_source ? t("compare_source_b", { source: b.spec_source }) : null,
  ].filter((s): s is string => Boolean(s));
  const sourceNote = sources.length
    ? `<p class="watchlist-meta" style="margin-top:10px">${sources.join(" · ")}</p>`
    : "";

  slot.innerHTML = `
    <div class="table-scroll">
      <table class="responsive-table">
        <thead><tr><th scope="col">${t("th_attribute")}</th><th scope="col">${t("th_boot_a")}</th><th scope="col">${t("th_boot_b")}</th><th scope="col">${t("th_difference")}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    ${sourceNote}`;
}

export function renderCompare(models: Model[]): void {
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

  // Um <select> nativo com 127+ modelos é ruim de navegar -- input com
  // <datalist> dá busca por texto nativa do navegador (digita "kakari" e
  // filtra) sem precisar de nenhuma biblioteca. brand+model+version já é
  // única por construção (aggregate.py agrupa por essa chave), então o
  // rótulo exibido também é único -- o mapa abaixo nunca colide.
  const byLabel = new Map<string, Model>();
  const labelOf = (m: Model) => `${m.brand} ${m.model} — ${trVersion(m.version)}`;
  const optionsHtml = models.map((m) => {
    byLabel.set(labelOf(m), m);
    return `<option value="${labelOf(m)}"></option>`;
  }).join("");

  slot.innerHTML = `
    <div class="card">
      <h2>${t("compare_title")}</h2>
      <p class="watchlist-meta">${t("compare_intro")}</p>
      <datalist id="compareOptions">${optionsHtml}</datalist>
      <div class="chart-controls">
        <label for="compareInputA">${t("label_boot_a")}</label>
        <input type="search" id="compareInputA" list="compareOptions" autocomplete="off" />
        <label for="compareInputB">${t("label_boot_b")}</label>
        <input type="search" id="compareInputB" list="compareOptions" autocomplete="off" />
      </div>
      <div id="compareTableSlot"></div>
    </div>`;

  const inputA = document.getElementById("compareInputA") as HTMLInputElement;
  const inputB = document.getElementById("compareInputB") as HTMLInputElement;
  const defaultA = models[0];
  const defaultB = models.find((m) => m.key !== defaultA.key) || defaultA;
  inputA.value = labelOf(defaultA);
  inputB.value = labelOf(defaultB);

  const rerender = () => {
    const a = byLabel.get(inputA.value);
    const b = byLabel.get(inputB.value);
    // Só re-renderiza quando os dois campos batem num modelo de verdade
    // -- enquanto a pessoa ainda tá digitando/filtrando, deixa a última
    // comparação válida na tela em vez de piscar vazio.
    if (a && b) renderCompareTable(models, a.key, b.key);
  };
  inputA.addEventListener("input", rerender);
  inputB.addEventListener("input", rerender);
  rerender();
}

// Serve tanto a aba "Histórico" (scraper/watchlist.json) quanto "Favoritos"
// (scraper/favorites.json) -- mesmo formato de dados, só muda o contêiner
// e o prefixo do id de cada canvas (pra não colidir entre as duas abas).
export function renderWatchlist(watchlist: Watchlist, containerId: string, chartPrefix: string): void {
  if (containerId === "watchlistContent") window.__rbpmWatchlist = watchlist;
  else window.__rbpmFavorites = watchlist;

  (activeCharts[containerId] || []).forEach((c) => c.destroy());
  activeCharts[containerId] = [];

  const lang = getCurrentLang();
  const blockLabel = watchlist.latest_block ? `#${watchlist.latest_block.toLocaleString(lang)}` : "—";
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
        <td data-label="${t("th_block")}">${l && l.block_height ? "#" + l.block_height.toLocaleString(lang) : "—"}</td>
        <td data-label="${t("th_datetime")}">${l ? fmtBlockFull(l.timestamp) : "—"}</td>
        <td class="num" data-label="${t("th_avg")}">${l ? fmtMoney(l.avg_price_usd) : "—"}</td>
        <td class="num" data-label="${t("th_max")}">${l ? fmtMoney(l.max_price_usd) : "—"}${l && l.max_site ? `<br><a href="${l.max_url}" target="_blank" rel="noopener" style="color:var(--series-1); text-decoration:none; font-size:0.78rem">${l.max_site}</a>` : ""}</td>
        <td class="num" data-label="${t("th_min")}">${l ? fmtMoney(l.min_price_usd) : "—"}${l && l.min_site ? `<br><a href="${l.min_url}" target="_blank" rel="noopener" style="color:var(--series-1); text-decoration:none; font-size:0.78rem">${l.min_site}</a>` : ""}</td>
      </tr>`;
    }).join("");

    return `
      <div class="card watchlist-card">
        <h2>${m.label}</h2>
        <div class="chart-container"><canvas id="${chartPrefix}${idx}"></canvas></div>
        <div class="table-scroll">
          <table class="version-table responsive-table">
            <thead><tr><th scope="col">${t("th_version")}</th><th scope="col">${t("th_block")}</th><th scope="col">${t("th_datetime")}</th><th scope="col" class="num">${t("th_avg")}</th><th scope="col" class="num">${t("th_max")}</th><th scope="col" class="num">${t("th_min")}</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  });

  (document.getElementById(containerId) as HTMLElement).innerHTML = header + `<div class="watchlist-grid">${cards.join("")}</div>`;

  models.forEach((m, idx) => {
    if (!m.versions.length) return;
    const canvas = document.getElementById(`${chartPrefix}${idx}`) as HTMLCanvasElement | null;
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
            callbacks: { label: (item: any) => `${item.dataset.label}: ${fmtMoney(item.parsed.y)}` },
          },
          zoom: zoomPluginOptions(),
        },
        scales: {
          x: { grid: { color: cssVar("--gridline") }, ticks: { color: cssVar("--text-muted") } },
          y: {
            grid: { color: cssVar("--gridline") },
            ticks: { color: cssVar("--text-muted"), callback: (v: number) => fmtMoney(v) },
          },
        },
      },
    });
    attachDblClickReset(canvas, chart);
    activeCharts[containerId].push(chart);
  });
}

// Aba "Fontes": lista as lojas configuradas em scraper/sites.json (nome,
// região, moeda, link direto pra loja) -- pedido do usuário pra saber de
// onde os preços vêm. "active" (calculado em aggregate.py, mesmo
// critério do stat "Fuentes activas") mostra se essa loja de fato
// contribuiu algum preço nos últimos 90 dias -- algumas ficam cadastradas
// mas sem retornar nada (bloqueio anti-bot, catálogo mudou, etc.), então
// declarar isso evita "por que essa loja não aparece nos preços?".
export function renderSources(data: SourcesData): void {
  const slot = document.getElementById("sourcesContent");
  if (!slot) return;

  const sites = [...data.sites].sort((a, b) =>
    Number(b.active) - Number(a.active) || compareStrings(a.name, b.name));

  const rows = sites.map((s) => {
    let statusHtml: string;
    if (s.disabled) {
      const reason = s.disabled_reason_key ? t(s.disabled_reason_key) : "";
      statusHtml = `<span class="badge disabled">${t("source_disabled")}</span>${reason ? `<p class="source-reason">${reason}</p>` : ""}`;
    } else if (s.active) {
      statusHtml = `<span class="badge active">${t("source_active")}</span>`;
    } else {
      statusHtml = `<span class="badge inactive">${t("source_inactive")}</span>`;
    }
    return `
    <tr>
      <td data-label="${t("th_source_name")}">
        <a href="${s.base_url}" target="_blank" rel="noopener" style="color:var(--series-1); text-decoration:none; font-weight:600">${s.name}</a>
      </td>
      <td data-label="${t("th_source_region")}">${s.region}</td>
      <td data-label="${t("th_source_currency")}">${s.currency}</td>
      <td data-label="${t("th_source_status")}">${statusHtml}</td>
    </tr>`;
  }).join("");

  slot.innerHTML = `
    <div class="card">
      <h2>${t("sources_title")}</h2>
      <p class="watchlist-meta">${t("sources_intro")}</p>
      <div class="table-scroll">
        <table class="responsive-table">
          <thead>
            <tr>
              <th scope="col">${t("th_source_name")}</th><th scope="col">${t("th_source_region")}</th>
              <th scope="col">${t("th_source_currency")}</th><th scope="col">${t("th_source_status")}</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}
