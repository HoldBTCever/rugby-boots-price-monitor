// Formatos dos arquivos gerados por scraper/aggregate.py (site/data/*.json)
// e do dicionário de tradução (site/i18n/*.json) -- só o suficiente pra
// pegar erro de chave/campo errado em tempo de build, sem tentar
// modelar cada detalhe.

export type Lang = "pt-BR" | "es-PY" | "en-US";

export type I18nDict = Record<string, string>;

// Cabedal/travas/encaixe de um modelo curado (scraper/model_specs.json)
// vêm como {"pt-BR":..., "es-PY":..., "en-US":...}; o resto (extraído do
// título automaticamente) já é uma string simples.
export type LocalizedText = string | Partial<Record<Lang, string>>;

export interface HistoryPoint {
  date: string;
  avg_price_usd: number;
  min_price_usd: number;
}

export interface Model {
  key: string;
  brand: string;
  model: string;
  version: string;
  avg_price_usd: number;
  n_observations: number;
  sources: string[];
  history: HistoryPoint[];
  latest_date: string;
  latest_min_price_usd: number | null;
  latest_min_site: string | null;
  latest_min_region: string | null;
  latest_min_url: string | null;
  discount_pct: number | null;
  is_deal: boolean;
  ground_type: string | null;
  upper_material: LocalizedText | null;
  stud_type: LocalizedText | null;
  width_fit: LocalizedText | null;
  spec_source: string | null;
}

export interface Summary {
  generated_at: string | null;
  threshold_pct: number;
  window_days: number;
  latest_date: string | null;
  totals: {
    models_tracked: number;
    sources: number;
    deals_today: number;
    observations: number;
  };
  sources: string[];
  models: Model[];
}

export interface Deal {
  brand: string;
  model: string;
  version: string;
  avg_price_usd: number;
  deal_price_usd: number;
  discount_pct: number;
  site_name: string;
  region: string;
  url: string;
  date: string;
}

export interface Alerts {
  generated_at: string | null;
  threshold_pct: number;
  date: string | null;
  deals: Deal[];
}

export interface WatchlistBlock {
  block_height: number | null;
  timestamp: string;
  avg_price_usd: number;
  max_price_usd: number;
  max_site: string | null;
  max_url: string | null;
  min_price_usd: number;
  min_site: string | null;
  min_url: string | null;
}

export interface WatchlistVersion {
  version: string;
  avg_price_usd: number;
  n_observations: number;
  history: WatchlistBlock[];
  latest: WatchlistBlock | null;
}

export interface WatchlistModel {
  label: string;
  versions: WatchlistVersion[];
}

export interface Watchlist {
  generated_at: string | null;
  window_days: number;
  latest_date: string | null;
  latest_block: number | null;
  models: WatchlistModel[];
}

export interface Source {
  id: string;
  name: string;
  region: string;
  country: string | null;
  currency: string;
  base_url: string;
  active: boolean;
  disabled: boolean;
  disabled_reason_key: string | null;
}

export interface SourcesData {
  generated_at: string | null;
  sites: Source[];
}

// Cotação do dia (USD -> outras moedas), gerada por
// scraper.aggregate._build_fx_rates() a partir do cache de scraper/fx.py.
// "rates" pode vir sem alguma moeda (ex: primeira execução sem cache
// ainda) -- currency.ts cai de volta pra USD nesse caso.
export interface FxRates {
  date: string | null;
  rates: Partial<Record<string, number>>;
}
