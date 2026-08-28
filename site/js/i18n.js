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

let I18N = null;
let i18nLoadPromise = null;

// O dicionário de tradução mora em i18n/<lang>.json (fora do JS) pra
// facilitar editar/revisar tradução sem mexer em código -- carregado uma
// vez só (memoizado em i18nLoadPromise), antes de qualquer chamada a
// t()/applyStaticTranslations(). main.js aguarda essa promise no início
// de main() antes de renderizar qualquer coisa.
export function loadI18n() {
  if (!i18nLoadPromise) {
    i18nLoadPromise = Promise.all(
      LANGS.map((lang) =>
        fetch(`i18n/${lang}.json`, { cache: "no-store" })
          .then((r) => r.json())
          .then((data) => [lang, data])
      )
    ).then((entries) => {
      I18N = Object.fromEntries(entries);
    });
  }
  return i18nLoadPromise;
}

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
