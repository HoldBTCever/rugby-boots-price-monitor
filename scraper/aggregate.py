#!/usr/bin/env python3
"""Lê data/price_history.csv e gera os arquivos consumidos pelo site:

- data/daily_summary.json: média histórica e série temporal por modelo/versão
- data/alerts.json: chuteiras cujo menor preço de hoje está a
  DEAL_THRESHOLD_PCT (ou mais) abaixo da média histórica do modelo
- data/watchlist.json: histórico de preço médio diário para a lista fixa
  de modelos em scraper/watchlist.json (aba "Histórico" do site)
- data/favorites.json: mesma ideia, mas pra lista curada pelo usuário em
  scraper/favorites.json (aba "Favoritos" do site)

Uso: python -m scraper.aggregate
"""
from __future__ import annotations

import csv
import json
import re
import shutil
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

from . import config, watchlist as wl
from .normalize import group_key


def _read_rows() -> list[dict]:
    if not config.PRICE_HISTORY_CSV.exists():
        return []
    with config.PRICE_HISTORY_CSV.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def _load_model_specs() -> list[dict]:
    if not config.MODEL_SPECS_CONFIG.exists():
        return []
    return json.loads(config.MODEL_SPECS_CONFIG.read_text(encoding="utf-8"))


def _find_curated_spec(specs: list[dict], brand: str, model: str, version: str) -> dict | None:
    """Cabedal/travas/largura pesquisados manualmente (fonte real, não
    extraído do título) pra um punhado de modelos conhecidos -- veja
    scraper/model_specs.json. Usa o mesmo esquema de match por palavra-
    chave da watchlist (scraper/watchlist.py), contra marca+modelo+versão
    já normalizados. A primeira entrada que bater vence, por isso as mais
    específicas (ex: "Stampede Elite") vêm antes das genéricas."""
    text = f"{brand} {model} {version}"
    for spec in specs:
        if wl.matches(text, spec["match"]):
            return spec
    return None


def _is_rs15_or_morelia_iv(brand: str, model: str, version: str) -> bool:
    """Grupos extras sempre incluídos na aba Comparar além dos favoritos --
    pedido do usuário: "adidas rs15" (todas as grafias/variantes -- RS15,
    RS-15, RS 15, Antoine Dupont Adizero RS15...) e "morelia iv" (a geração
    4 da Mizuno Morelia Neo -- lojas gravam ora "IV" por extenso, ora só o
    dígito "4")."""
    text = f"{brand} {model} {version}"
    folded = re.sub(r"[^a-z0-9]+", "", text.lower())
    if "rs15" in folded:
        return True
    return "morelia" in text.lower() and bool(re.search(r"\b(iv|4)\b", text, re.IGNORECASE))


def _build_watchlist(rows: list[dict], cutoff: str, entries: list[dict]) -> list[dict]:
    """Agrupa por versão (dentro de cada item da lista) e depois por
    bloco do Bitcoin -- cada bloco novo minerado é um ponto no histórico.
    Casa contra o título bruto do produto -- veja scraper/watchlist.py.
    Linhas antigas (de antes do rastreio por bloco) usam o timestamp como
    chave de agrupamento no lugar do bloco. `entries` é a lista curada
    (scraper/watchlist.json pra aba "Histórico", scraper/favorites.json
    pra aba "Favoritos") -- mesmo formato [{label, match}], mesma função
    serve as duas."""
    result = []
    for entry in entries:
        version_blocks: dict[str, dict[str, dict]] = defaultdict(dict)

        for row in rows:
            if row["date"] < cutoff or not wl.matches(row["title"], entry["match"]):
                continue
            try:
                float(row["price_usd"])
            except (KeyError, ValueError):
                continue

            version = row["version"] or "Padrão"
            block_key = row.get("block_height") or row.get("timestamp") or row["date"]
            blk = version_blocks[version].setdefault(block_key, {
                "block_height": row.get("block_height") or None,
                "timestamp": row.get("timestamp") or row["date"],
                "rows": [],
            })
            blk["rows"].append(row)

        versions_out = []
        for version, blocks in version_blocks.items():
            history = []
            for blk in blocks.values():
                blk_rows = blk["rows"]
                cheapest = min(blk_rows, key=lambda r: float(r["price_usd"]))
                priciest = max(blk_rows, key=lambda r: float(r["price_usd"]))
                prices = [float(r["price_usd"]) for r in blk_rows]
                history.append({
                    "block_height": int(blk["block_height"]) if blk["block_height"] else None,
                    "timestamp": blk["timestamp"],
                    "avg_price_usd": round(sum(prices) / len(prices), 2),
                    "max_price_usd": round(float(priciest["price_usd"]), 2),
                    "max_site": priciest["site_name"],
                    "max_url": priciest["url"],
                    "min_price_usd": round(float(cheapest["price_usd"]), 2),
                    "min_site": cheapest["site_name"],
                    "min_url": cheapest["url"],
                })
            history.sort(key=lambda h: (h["block_height"] is None, h["block_height"], h["timestamp"]))

            all_prices = [float(r["price_usd"]) for blk in blocks.values() for r in blk["rows"]]
            versions_out.append({
                "version": version,
                "avg_price_usd": round(sum(all_prices) / len(all_prices), 2),
                "n_observations": len(all_prices),
                "history": history,
                "latest": history[-1] if history else None,
            })

        versions_out.sort(key=lambda v: v["version"])
        result.append({"label": entry["label"], "versions": versions_out})

    return result


def run() -> None:
    rows = _read_rows()
    model_specs = _load_model_specs()
    favorites_entries = json.loads(config.FAVORITES_CONFIG.read_text(encoding="utf-8")) if config.FAVORITES_CONFIG.exists() else []
    now = datetime.now(timezone.utc)
    cutoff = (now - timedelta(days=config.AVERAGE_WINDOW_DAYS)).date().isoformat()

    groups: dict[str, dict] = {}
    by_date: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
    latest_date = None

    for row in rows:
        try:
            price_usd = float(row["price_usd"])
        except (KeyError, ValueError):
            continue
        if row["date"] < cutoff:
            continue

        key = group_key(row["brand"], row["model"], row["version"])
        g = groups.setdefault(key, {
            "key": key, "brand": row["brand"], "model": row["model"], "version": row["version"],
            "prices": [], "sources": set(), "latest": [],
            "ground_types": Counter(), "upper_materials": Counter(), "stud_types": Counter(),
        })
        g["prices"].append(price_usd)
        g["sources"].add(row["site_name"])
        by_date[key][row["date"]].append(price_usd)
        if row.get("ground_type"):
            g["ground_types"][row["ground_type"]] += 1
        if row.get("upper_material"):
            g["upper_materials"][row["upper_material"]] += 1
        if row.get("stud_type"):
            g["stud_types"][row["stud_type"]] += 1

        if latest_date is None or row["date"] > latest_date:
            latest_date = row["date"]

    if latest_date:
        for row in rows:
            if row["date"] != latest_date:
                continue
            key = group_key(row["brand"], row["model"], row["version"])
            if key in groups:
                groups[key]["latest"].append(row)

    models = []
    deals = []

    for key, g in groups.items():
        n = len(g["prices"])
        avg_price = round(sum(g["prices"]) / n, 2)

        history = [
            {"date": d, "avg_price_usd": round(sum(vals) / len(vals), 2), "min_price_usd": round(min(vals), 2)}
            for d, vals in sorted(by_date[key].items())
        ]

        entry = {
            "key": key, "brand": g["brand"], "model": g["model"], "version": g["version"],
            "avg_price_usd": avg_price, "n_observations": n,
            "sources": sorted(g["sources"]), "history": history,
            "latest_date": latest_date, "latest_min_price_usd": None,
            "latest_min_site": None, "latest_min_region": None, "latest_min_url": None,
            "discount_pct": None, "is_deal": False,
            "ground_type": g["ground_types"].most_common(1)[0][0] if g["ground_types"] else None,
            "upper_material": g["upper_materials"].most_common(1)[0][0] if g["upper_materials"] else None,
            "stud_type": g["stud_types"].most_common(1)[0][0] if g["stud_types"] else None,
            "width_fit": None,
            "spec_source": None,
            # A aba Comparar só oferece favoritos + as famílias "RS15" e
            # "Morelia IV" (pedido do usuário) -- não os 166+ modelos
            # crus da varredura geral, difícil de navegar numa lista tão
            # grande. Calculado uma vez aqui em vez de replicar a lógica
            # de match no front-end.
            "in_comparar": (
                any(wl.matches(f"{g['brand']} {g['model']} {g['version']}", fav["match"]) for fav in favorites_entries)
                or _is_rs15_or_morelia_iv(g["brand"], g["model"], g["version"])
            ),
        }

        # Cabedal/travas/largura pesquisados manualmente (fonte real) têm
        # prioridade sobre o que foi extraído automaticamente do título --
        # cobrem só um punhado de modelos conhecidos (scraper/model_specs.json).
        curated = _find_curated_spec(model_specs, g["brand"], g["model"], g["version"])
        if curated:
            if curated.get("upper_material"):
                entry["upper_material"] = curated["upper_material"]
            if curated.get("stud_type"):
                entry["stud_type"] = curated["stud_type"]
            if curated.get("width_fit"):
                entry["width_fit"] = curated["width_fit"]
            entry["spec_source"] = curated.get("source")

        if g["latest"]:
            cheapest = min(g["latest"], key=lambda r: float(r["price_usd"]))
            latest_min = float(cheapest["price_usd"])
            entry.update(
                latest_min_price_usd=round(latest_min, 2),
                latest_min_site=cheapest["site_name"],
                latest_min_region=cheapest["region"],
                latest_min_url=cheapest["url"],
            )
            if avg_price > 0:
                discount = round((avg_price - latest_min) / avg_price, 4)
                entry["discount_pct"] = discount
                if discount >= config.DEAL_THRESHOLD_PCT and n >= config.MIN_OBSERVATIONS_FOR_ALERT:
                    entry["is_deal"] = True
                    deals.append({
                        "brand": g["brand"], "model": g["model"], "version": g["version"],
                        "avg_price_usd": avg_price, "deal_price_usd": round(latest_min, 2),
                        "discount_pct": discount, "site_name": cheapest["site_name"],
                        "region": cheapest["region"], "url": cheapest["url"], "date": latest_date,
                    })

        models.append(entry)

    models.sort(key=lambda m: (-(m["discount_pct"] or -1), m["brand"], m["model"]))
    deals.sort(key=lambda d: -d["discount_pct"])

    all_sources = sorted({s for g in groups.values() for s in g["sources"]})
    summary = {
        "generated_at": now.isoformat(),
        "threshold_pct": config.DEAL_THRESHOLD_PCT,
        "window_days": config.AVERAGE_WINDOW_DAYS,
        "latest_date": latest_date,
        "totals": {
            "models_tracked": len(models),
            "sources": len(all_sources),
            "deals_today": len(deals),
            "observations": len(rows),
        },
        "sources": all_sources,
        "models": models,
    }
    alerts = {
        "generated_at": now.isoformat(),
        "threshold_pct": config.DEAL_THRESHOLD_PCT,
        "date": latest_date,
        "deals": deals,
    }
    latest_block = None
    for row in rows:
        raw = row.get("block_height")
        if raw:
            try:
                latest_block = max(latest_block or 0, int(raw))
            except ValueError:
                pass

    watchlist_out = {
        "generated_at": now.isoformat(),
        "window_days": config.AVERAGE_WINDOW_DAYS,
        "latest_date": latest_date,
        "latest_block": latest_block,
        "models": _build_watchlist(rows, cutoff, wl.load_watchlist()),
    }
    favorites_out = {
        "generated_at": now.isoformat(),
        "window_days": config.AVERAGE_WINDOW_DAYS,
        "latest_date": latest_date,
        "latest_block": latest_block,
        "models": _build_watchlist(rows, cutoff, favorites_entries),
    }

    config.DATA_DIR.mkdir(parents=True, exist_ok=True)
    config.DAILY_SUMMARY_JSON.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
    config.ALERTS_JSON.write_text(json.dumps(alerts, indent=2, ensure_ascii=False), encoding="utf-8")
    config.WATCHLIST_JSON.write_text(json.dumps(watchlist_out, indent=2, ensure_ascii=False), encoding="utf-8")
    config.FAVORITES_JSON.write_text(json.dumps(favorites_out, indent=2, ensure_ascii=False), encoding="utf-8")

    config.SITE_DATA_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copy(config.DAILY_SUMMARY_JSON, config.SITE_DATA_DIR / "daily_summary.json")
    shutil.copy(config.ALERTS_JSON, config.SITE_DATA_DIR / "alerts.json")
    shutil.copy(config.WATCHLIST_JSON, config.SITE_DATA_DIR / "watchlist.json")
    shutil.copy(config.FAVORITES_JSON, config.SITE_DATA_DIR / "favorites.json")

    found = sum(1 for m in watchlist_out["models"] if m["versions"])
    found_fav = sum(1 for m in favorites_out["models"] if m["versions"])
    print(f"{len(models)} modelos, {len(deals)} ofertas (>= {config.DEAL_THRESHOLD_PCT:.1%} abaixo da média), "
          f"{found}/{len(watchlist_out['models'])} itens da watchlist encontrados, "
          f"{found_fav}/{len(favorites_out['models'])} favoritos encontrados")


if __name__ == "__main__":
    run()
