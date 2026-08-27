(function () {
  "use strict";

  const fmtUSD = (v) => v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "USD" });
  const fmtPct = (v) => v == null ? "—" : (v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%";
  const fmtDate = (iso) => iso ? new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "—";
  const fmtAsuncion = (iso, opts) => iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Asuncion", ...opts }) : "—";
  const fmtBlockAxis = (iso) => fmtAsuncion(iso, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const fmtBlockFull = (iso) => fmtAsuncion(iso, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " (ASU)";
  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const compareStrings = (a, b) => (a || "").localeCompare(b || "", "pt-BR", { sensitivity: "base", numeric: true });
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

  function renderBanner(summary, alerts) {
    const slot = document.getElementById("bannerSlot");
    const deals = alerts.deals || [];

    if (summary.totals.models_tracked === 0) {
      slot.innerHTML = `
        <div class="banner">
          <h2><span class="dot" style="background:var(--status-warning)"></span> Nenhuma chuteira confirmada ainda</h2>
          <p>A coleta já roda sozinha todo dia (e a cada ajuste no código) — sem precisar de nenhuma ação
          manual. Ainda assim nenhuma loja conectada devolveu um produto reconhecido como chuteira de rugby
          na última execução, então o painel fica vazio de propósito em vez de mostrar algo errado.</p>
        </div>`;
      return;
    }

    if (deals.length === 0) {
      slot.innerHTML = `
        <div class="banner good">
          <h2><span class="dot"></span> Nenhuma oferta abaixo do limiar hoje</h2>
          <p>Nenhum modelo está ${document.getElementById("thresholdLabel").textContent} ou mais barato que sua média histórica no momento.</p>
        </div>`;
      return;
    }

    const items = deals.map((d) => `
      <li class="deal-item">
        <span>${d.brand} ${d.model} <em style="color:var(--text-muted); font-style:normal">${d.version}</em>
          — <a href="${d.url}" target="_blank" rel="noopener">${d.site_name}</a>
          <span style="color:var(--text-muted)">(${d.region})</span></span>
        <span class="deal-pct">${fmtPct(d.discount_pct)} abaixo · ${fmtUSD(d.deal_price_usd)} <span style="color:var(--text-muted); font-weight:400">vs média ${fmtUSD(d.avg_price_usd)}</span></span>
      </li>`).join("");

    slot.innerHTML = `
      <div class="banner critical">
        <h2><span class="dot"></span> ${deals.length} oferta${deals.length > 1 ? "s" : ""} encontrada${deals.length > 1 ? "s" : ""} hoje</h2>
        <p>Chuteiras com preço ${document.getElementById("thresholdLabel").textContent} ou mais abaixo da média histórica do modelo.</p>
        <ul class="deal-list">${items}</ul>
      </div>`;
  }

  function renderStats(summary) {
    const t = summary.totals;
    const tiles = [
      ["Modelos monitorados", t.models_tracked],
      ["Fontes ativas", t.sources],
      ["Ofertas hoje", t.deals_today],
      ["Observações totais", t.observations],
    ];
    document.getElementById("statsSlot").innerHTML = tiles.map(([label, value]) => `
      <div class="stat-tile">
        <div class="label">${label}</div>
        <div class="value">${value.toLocaleString("pt-BR")}</div>
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
        container.innerHTML = `<p style="color:var(--text-muted); padding:20px 0">
          Não foi possível carregar a biblioteca de gráficos (Chart.js via CDN). Verifique a conexão
          com a internet — o restante do painel continua funcionando normalmente.</p>`;
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
            label: "Preço médio",
            data: avgData,
            borderColor: cssVar("--series-1"),
            backgroundColor: cssVar("--series-1"),
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 5,
            tension: 0.25,
          },
          {
            label: "Menor preço do dia",
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

  function renderTable(models) {
    const rows = models.map((m) => `
      <tr>
        <td data-label="Marca">${m.brand}</td>
        <td data-label="Modelo">${m.model}</td>
        <td data-label="Versão">${m.version}</td>
        <td class="num" data-label="Média (USD)">${fmtUSD(m.avg_price_usd)}</td>
        <td class="num" data-label="Menor hoje">${fmtUSD(m.latest_min_price_usd)}</td>
        <td class="num" data-label="Variação">${fmtPct(m.discount_pct)}</td>
        <td data-label="Fonte do menor preço">${m.latest_min_site ? `<a href="${m.latest_min_url}" target="_blank" rel="noopener" style="color:var(--series-1); text-decoration:none">${m.latest_min_site}</a>` : "—"}</td>
        <td data-label="Status">${m.is_deal ? '<span class="badge deal">Oferta</span>' : ""}</td>
      </tr>`).join("");

    return `
      <div class="card">
        <h2>Todos os modelos monitorados</h2>
        <div class="table-scroll">
          <table class="responsive-table">
            <thead>
              <tr>
                <th>Marca</th><th>Modelo</th><th>Versão</th>
                <th class="num">Média (USD)</th><th class="num">Menor hoje</th>
                <th class="num">Variação</th><th>Fonte do menor preço</th><th></th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  }

  function renderMain(summary) {
    const models = summary.models;
    window.__rbpmModels = models;

    if (models.length === 0) {
      document.getElementById("mainContent").innerHTML = `
        <div class="card empty-state">
          <div class="icon">🏉</div>
          <h2>Nenhum histórico de preços ainda</h2>
          <p>A coleta roda sozinha todo dia — assim que uma loja conectada devolver uma chuteira de rugby
          de verdade, os gráficos e a tabela aparecem aqui automaticamente, sem precisar de nenhuma ação.</p>
        </div>`;
      return;
    }

    const options = models.map((m) =>
      `<option value="${m.key}">${m.brand} ${m.model} — ${m.version}${m.is_deal ? " 🔻" : ""}</option>`
    ).join("");

    const preselect = models.find((m) => m.is_deal) || models[0];

    document.getElementById("mainContent").innerHTML = `
      <div class="card">
        <h2>Histórico de preço médio</h2>
        <div class="chart-controls">
          <label for="modelSelect">Modelo:</label>
          <select id="modelSelect">${options}</select>
        </div>
        <div class="chart-container"><canvas id="priceChart"></canvas></div>
      </div>
      ${renderTable(models)}`;

    document.getElementById("modelSelect").value = preselect.key;
    document.getElementById("modelSelect").addEventListener("change", (e) => renderChart(models, e.target.value));
    renderChart(models, preselect.key);
  }

  const COMPARE_ROWS = [
    { label: "Marca", get: (m) => m.brand },
    { label: "Modelo", get: (m) => m.model },
    { label: "Versão", get: (m) => m.version },
    { label: "Preço médio (USD)", get: (m) => fmtUSD(m.avg_price_usd), numeric: (m) => m.avg_price_usd },
    { label: "Menor preço hoje", get: (m) => fmtUSD(m.latest_min_price_usd), numeric: (m) => m.latest_min_price_usd },
    {
      label: "Fonte do menor preço",
      get: (m) => m.latest_min_site
        ? `<a href="${m.latest_min_url}" target="_blank" rel="noopener" style="color:var(--series-1); text-decoration:none">${m.latest_min_site}</a>`
        : "—",
    },
    { label: "Solado", get: (m) => m.ground_type || "Não informado" },
    { label: "Cabedal", get: (m) => m.upper_material || "Não informado" },
    { label: "Travas", get: (m) => m.stud_type || "Não informado" },
    { label: "Encaixe (largura)", get: (m) => m.width_fit || "Não informado" },
  ];

  function renderCompareTable(models, keyA, keyB) {
    const a = models.find((m) => m.key === keyA);
    const b = models.find((m) => m.key === keyB);
    const slot = document.getElementById("compareTableSlot");
    if (!slot) return;
    if (!a || !b) { slot.innerHTML = ""; return; }

    const rows = COMPARE_ROWS.map((row) => {
      let diffCell = "";
      if (row.numeric) {
        const va = row.numeric(a);
        const vb = row.numeric(b);
        if (va != null && vb != null) {
          const diff = vb - va;
          const pct = va !== 0 ? Math.abs(diff / va) : null;
          const arrow = diff === 0 ? "" : (diff < 0 ? "B mais barata" : "A mais barata");
          diffCell = diff === 0
            ? "sem diferença"
            : `${fmtUSD(Math.abs(diff))}${pct != null ? " (" + fmtPct(pct) + ")" : ""} — ${arrow}`;
        }
      } else if (a.key !== b.key) {
        const va = row.get(a).replace(/<[^>]+>/g, "");
        const vb = row.get(b).replace(/<[^>]+>/g, "");
        diffCell = va === vb ? "igual" : "diferente";
      }
      return `
        <tr>
          <td data-label="Atributo">${row.label}</td>
          <td data-label="Chuteira A">${row.get(a)}</td>
          <td data-label="Chuteira B">${row.get(b)}</td>
          <td data-label="Diferença">${diffCell}</td>
        </tr>`;
    }).join("");

    const sources = [
      a.spec_source ? `Chuteira A (cabedal/travas/encaixe): ${a.spec_source}` : null,
      b.spec_source ? `Chuteira B (cabedal/travas/encaixe): ${b.spec_source}` : null,
    ].filter(Boolean);
    const sourceNote = sources.length
      ? `<p class="watchlist-meta" style="margin-top:10px">Fonte dos dados de cabedal/travas/encaixe pesquisados manualmente — ${sources.join(" · ")}.</p>`
      : "";

    slot.innerHTML = `
      <div class="table-scroll">
        <table class="responsive-table">
          <thead><tr><th>Atributo</th><th>Chuteira A</th><th>Chuteira B</th><th>Diferença</th></tr></thead>
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
          <h2>Ainda não há chuteiras suficientes pra comparar</h2>
          <p>Assim que pelo menos 2 modelos forem confirmados, o comparador aparece aqui.</p>
        </div>`;
      return;
    }

    const options = models.map((m) =>
      `<option value="${m.key}">${m.brand} ${m.model} — ${m.version}</option>`
    ).join("");

    slot.innerHTML = `
      <div class="card">
        <h2>Comparar chuteiras</h2>
        <p class="watchlist-meta">Preço, solado, cabedal, travas e encaixe (largura) lado a lado. Pra um grupo
          curado de modelos, cabedal/travas/encaixe vêm de pesquisa manual (ficha técnica da marca ou loja,
          fonte sempre citada abaixo da tabela); nos demais, só o que a própria loja menciona no título do
          produto — sem inventar dado quando a fonte não informa.</p>
        <div class="chart-controls">
          <label for="compareSelectA">Chuteira A:</label>
          <select id="compareSelectA">${options}</select>
          <label for="compareSelectB">Chuteira B:</label>
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

    const blockLabel = watchlist.latest_block ? `#${watchlist.latest_block.toLocaleString("pt-BR")}` : "—";
    const header = `<p class="watchlist-meta">Último bloco processado: <strong>${blockLabel}</strong> · a coleta atualiza a cada bloco novo minerado</p>`;

    const models = [...(watchlist.models || [])].sort((a, b) => compareStrings(a.label, b.label));
    const cards = models.map((m, idx) => {
      if (!m.versions.length) {
        return `
          <div class="card watchlist-card">
            <h2>${m.label}</h2>
            <p class="watchlist-empty">Ainda não encontrado em nenhuma loja monitorada.</p>
          </div>`;
      }

      const rows = m.versions.map((v, i) => {
        const l = v.latest;
        return `
        <tr>
          <td data-label="Versão"><span class="version-swatch" style="background:var(--cat-${(i % 8) + 1})"></span>${v.version}</td>
          <td data-label="Bloco">${l && l.block_height ? "#" + l.block_height.toLocaleString("pt-BR") : "—"}</td>
          <td data-label="Data/hora">${l ? fmtBlockFull(l.timestamp) : "—"}</td>
          <td class="num" data-label="Média">${l ? fmtUSD(l.avg_price_usd) : "—"}</td>
          <td class="num" data-label="Maior">${l ? fmtUSD(l.max_price_usd) : "—"}${l && l.max_site ? `<br><a href="${l.max_url}" target="_blank" rel="noopener" style="color:var(--series-1); text-decoration:none; font-size:0.78rem">${l.max_site}</a>` : ""}</td>
          <td class="num" data-label="Menor">${l ? fmtUSD(l.min_price_usd) : "—"}${l && l.min_site ? `<br><a href="${l.min_url}" target="_blank" rel="noopener" style="color:var(--series-1); text-decoration:none; font-size:0.78rem">${l.min_site}</a>` : ""}</td>
        </tr>`;
      }).join("");

      return `
        <div class="card watchlist-card">
          <h2>${m.label}</h2>
          <div class="chart-container"><canvas id="${chartPrefix}${idx}"></canvas></div>
          <div class="table-scroll">
            <table class="version-table responsive-table">
              <thead><tr><th>Versão</th><th>Bloco</th><th>Data/hora</th><th class="num">Média</th><th class="num">Maior</th><th class="num">Menor</th></tr></thead>
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
          label: v.version,
          data: allTimestamps.map((t) => byTimestamp[t] ?? null),
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

  async function main() {
    try {
      const [summaryRes, alertsRes] = await Promise.all([
        fetch("data/daily_summary.json", { cache: "no-store" }),
        fetch("data/alerts.json", { cache: "no-store" }),
      ]);
      const summary = await summaryRes.json();
      const alerts = await alertsRes.json();
      summary.models = sortModels(summary.models);

      document.getElementById("thresholdLabel").textContent = fmtPct(summary.threshold_pct);
      document.getElementById("lastUpdated").textContent = summary.generated_at
        ? `Última coleta: ${new Date(summary.generated_at).toLocaleString("pt-BR")} · janela de média: ${summary.window_days} dias`
        : "Ainda sem coleta registrada";

      renderBanner(summary, alerts);
      renderStats(summary);
      renderMain(summary);
      renderCompare(summary.models);
    } catch (err) {
      document.getElementById("mainContent").innerHTML = `
        <div class="card empty-state">
          <div class="icon">⚠️</div>
          <h2>Não foi possível carregar os dados</h2>
          <p>${err.message}</p>
        </div>`;
    }

    try {
      const watchlistRes = await fetch("data/watchlist.json", { cache: "no-store" });
      const watchlist = await watchlistRes.json();
      renderWatchlist(watchlist, "watchlistContent", "wlChart");
    } catch (err) {
      document.getElementById("watchlistContent").innerHTML = `
        <div class="card empty-state">
          <div class="icon">⚠️</div>
          <h2>Não foi possível carregar o histórico</h2>
          <p>${err.message}</p>
        </div>`;
    }

    try {
      const favoritesRes = await fetch("data/favorites.json", { cache: "no-store" });
      const favorites = await favoritesRes.json();
      renderWatchlist(favorites, "favoritesContent", "favChart");
    } catch (err) {
      document.getElementById("favoritesContent").innerHTML = `
        <div class="card empty-state">
          <div class="icon">⚠️</div>
          <h2>Não foi possível carregar os favoritos</h2>
          <p>${err.message}</p>
        </div>`;
    }
  }

  main();
})();
