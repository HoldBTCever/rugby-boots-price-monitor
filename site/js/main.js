// Ponto de entrada: tema, seletor de idioma, abas, busca de dados e
// orquestração das funções de renderização (render.js).
"use strict";

import { getCurrentLang, setCurrentLang, applyStaticTranslations, t, fmtPct, sortModels } from "./i18n.js";
import { renderBanner, renderStats, renderChart, renderMain, renderCompare, renderWatchlist } from "./render.js";

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
langSelect.value = getCurrentLang();
langSelect.addEventListener("change", () => {
  setCurrentLang(langSelect.value);
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
      ? t("last_updated", { date: new Date(state.summary.generated_at).toLocaleString(getCurrentLang()), days: state.summary.window_days })
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
