// Funções de renderização (banner, stats, gráfico, tabelas, comparador,
// histórico/favoritos) -- todas leem o idioma atual via i18n.ts.
"use strict";

import {
  t, trVersion, trUpper, pickLocalized,
  fmtUSD, fmtPct, fmtDate, fmtBlockAxis, fmtBlockFull, cssVar, compareStrings,
  getCurrentLang,
} from "./i18n.js";
import type { Summary, Alerts, Model, Watchlist } from "./types.js";

let chartInstance: any = null;
const activeCharts: Record<string, any[]> = {}; // containerId -> Chart[] (Histórico e Favoritos usam a mesma renderWatchlist)

export function renderBanner(summary: Summary, alerts: Alerts, thresholdText: string): void {
  const slot = document.getElementById("bannerSlot") as HTMLElement;
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
          callbacks: { label: (item: any) => `${item.dataset.label}: ${fmtUSD(item.parsed.y)}` },
        },
      },
      scales: {
        x: { grid: { color: cssVar("--gridline") }, ticks: { color: cssVar("--text-muted") } },
        y: {
          grid: { color: cssVar("--gridline") },
          ticks: { color: cssVar("--text-muted"), callback: (v: number) => fmtUSD(v) },
        },
      },
    },
  });

  window.__rbpmChart = chartInstance;
}

export function renderTableRows(models: Model[]): string {
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

export interface PainelFilters {
  brand: string;
  version: string;
  sort: string;
  search?: string;
}

// Marca/versão selecionadas ("" = todas) + busca por texto (marca/modelo/
// versão) + critério de ordenação -- pedido do usuário: poder ver só "as
// elites" ou só "adidas", buscar direto em vez de rolar os 127 modelos, e
// ordenar por variação/preço médio, não só por nome.
export function applyPainelFilters(models: Model[], filters: PainelFilters): Model[] {
  let out = models;
  if (filters.brand) out = out.filter((m) => m.brand === filters.brand);
  if (filters.version) out = out.filter((m) => m.version === filters.version);
  if (filters.search) {
    const q = filters.search.trim().toLowerCase();
    if (q) out = out.filter((m) => `${m.brand} ${m.model} ${trVersion(m.version)}`.toLowerCase().includes(q));
  }

  const byName = (a: Model, b: Model) =>
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
      <h2>${t("main_chart_title")}</h2>
      <div class="chart-controls">
        <label for="modelSelect">${t("label_model")}</label>
        <select id="modelSelect"></select>
      </div>
      <div class="chart-container"><canvas id="priceChart"></canvas></div>
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
          <option value="discount">${t("sort_discount")}</option>
          <option value="avg_desc">${t("sort_avg_desc")}</option>
          <option value="avg_asc">${t("sort_avg_asc")}</option>
        </select>
      </div>
      <p class="watchlist-meta" id="tableCount"></p>
      <div id="modelsTableSlot"></div>
      <div id="tablePagination"></div>
    </div>`;

  const modelSelectEl = document.getElementById("modelSelect") as HTMLSelectElement;
  const filterSearchEl = document.getElementById("filterSearch") as HTMLInputElement;
  const filterBrandEl = document.getElementById("filterBrand") as HTMLSelectElement;
  const filterVersionEl = document.getElementById("filterVersion") as HTMLSelectElement;
  const sortByEl = document.getElementById("sortBy") as HTMLSelectElement;
  const tableSlot = document.getElementById("modelsTableSlot") as HTMLElement;
  const tableCount = document.getElementById("tableCount") as HTMLElement;
  const paginationSlot = document.getElementById("tablePagination") as HTMLElement;

  let currentPage = 1;

  function refresh(): void {
    const visible = applyPainelFilters(models, {
      brand: filterBrandEl.value, version: filterVersionEl.value, sort: sortByEl.value,
      search: filterSearchEl.value,
    });

    tableCount.textContent = t(visible.length === 1 ? "models_count_singular" : "models_count_plural", {
      visible: visible.length, total: models.length,
    });

    const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;
    const pageItems = paginate(visible, currentPage);

    tableSlot.innerHTML = pageItems.length
      ? renderTableRows(pageItems)
      : `<p class="watchlist-empty">${t("no_match_filter")}</p>`;
    paginationSlot.innerHTML = renderPagination(visible.length, currentPage);
    document.getElementById("pagePrev")?.addEventListener("click", () => { currentPage--; refresh(); });
    document.getElementById("pageNext")?.addEventListener("click", () => { currentPage++; refresh(); });

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
    const nextSelected = visible.find((m) => m.key === prevSelected) || visible.find((m) => m.is_deal) || visible[0];
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
          : `${fmtUSD(Math.abs(diff))}${pct != null ? " (" + fmtPct(pct) + ")" : ""} — ${arrow}`;
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
        <thead><tr><th>${t("th_attribute")}</th><th>${t("th_boot_a")}</th><th>${t("th_boot_b")}</th><th>${t("th_difference")}</th></tr></thead>
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
            callbacks: { label: (item: any) => `${item.dataset.label}: ${fmtUSD(item.parsed.y)}` },
          },
        },
        scales: {
          x: { grid: { color: cssVar("--gridline") }, ticks: { color: cssVar("--text-muted") } },
          y: {
            grid: { color: cssVar("--gridline") },
            ticks: { color: cssVar("--text-muted"), callback: (v: number) => fmtUSD(v) },
          },
        },
      },
    });
    activeCharts[containerId].push(chart);
  });
}
