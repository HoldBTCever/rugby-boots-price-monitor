// Moeda de exibição -- os dados sempre vêm em USD (price_usd, gerado por
// scraper/aggregate.py); este módulo só converte na hora de mostrar,
// usando a cotação do dia em data/fx_rates.json. Mesmo padrão getter/
// setter de i18n.ts (getCurrentLang/setCurrentLang): um único ponto de
// mutação que persiste no localStorage, e módulos que chamam
// getCurrentCurrency() sempre leem o valor atual, nunca uma cópia presa
// no momento do import.
"use strict";

import type { FxRates } from "./types.js";
import { getCurrentLang } from "./i18n.js";

const CURRENCY_KEY = "rbpm-currency";
const DEFAULT_CURRENCY = "USD";

let rates: Partial<Record<string, number>> = {};
export function setFxRates(fx: FxRates | null | undefined): void {
  rates = (fx && fx.rates) || {};
}

// Só oferece no seletor as moedas que a cotação do dia realmente trouxe
// (USD sempre disponível, é a moeda nativa dos dados -- não depende da
// API de câmbio ter respondido).
export function availableCurrencies(): string[] {
  return [DEFAULT_CURRENCY, ...Object.keys(rates).filter((c) => c !== DEFAULT_CURRENCY).sort()];
}

function loadStoredCurrency(): string {
  try {
    const saved = localStorage.getItem(CURRENCY_KEY);
    if (saved) return saved;
  } catch (e) { /* localStorage indisponível: segue na moeda padrão */ }
  return DEFAULT_CURRENCY;
}

let currentCurrency: string = loadStoredCurrency();
export function getCurrentCurrency(): string {
  // Se a moeda salva não veio na cotação de hoje (ex: API fora do ar),
  // cai pra USD em vez de mostrar um valor não convertido com o símbolo
  // errado.
  return currentCurrency === DEFAULT_CURRENCY || rates[currentCurrency] ? currentCurrency : DEFAULT_CURRENCY;
}
export function setCurrentCurrency(currency: string): void {
  currentCurrency = currency;
  try { localStorage.setItem(CURRENCY_KEY, currency); } catch (e) {}
}

// price_usd -> moeda atual: rates[x] é "quantas unidades de x valem 1
// USD" (mesmo formato que scraper/fx.py usa internamente).
export function convertFromUsd(usdValue: number): number {
  const currency = getCurrentCurrency();
  if (currency === DEFAULT_CURRENCY) return usdValue;
  const rate = rates[currency];
  return rate ? usdValue * rate : usdValue;
}

export function fmtMoney(usdValue: number | null | undefined): string {
  if (usdValue == null) return "—";
  const currency = getCurrentCurrency();
  const converted = convertFromUsd(usdValue);
  try {
    return converted.toLocaleString(getCurrentLang(), { style: "currency", currency });
  } catch (e) {
    // Intl.NumberFormat lança se o código de moeda não for ISO 4217
    // válido -- nunca deve acontecer (currency vem de DISPLAY_CURRENCIES
    // no backend), mas não vale derrubar a página por isso.
    return converted.toFixed(2) + " " + currency;
  }
}
