// Funções de renderização (banner, stats, gráfico, tabelas, comparador,
// histórico/favoritos) -- todas leem o idioma atual via i18n.js.
"use strict";

import {
  t, trVersion, trUpper, pickLocalized,
  fmtUSD, fmtPct, fmtDate, fmtBlockAxis, fmtBlockFull, cssVar, compareStrings,
  getCurrentLang,
} from "./i18n.js";

let chartInstance = null;
const activeCharts = {}; // containerId -> Chart[] (Histórico e Favoritos usam a mesma renderWatchlist)

export function renderBanner(summary, alerts, thresholdText) {
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

export function renderStats(summary) {
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
      <div class="value">${value.toLocaleString(getCurrentLang())}</div>
    </div>`).join("");
}

export function renderChart(models, selectedKey) {
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

export function renderTableRows(models) {
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
export function applyPainelFilters(models, filters) {
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

export function renderMain(summary) {
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

export function getCompareRows() {
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

export function renderCompareTable(models, keyA, keyB) {
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

export function renderCompare(models) {
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
export function renderWatchlist(watchlist, containerId, chartPrefix) {
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
