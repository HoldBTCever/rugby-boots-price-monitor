#!/usr/bin/env python3
"""Roda a coleta: consulta cada site configurado, normaliza os produtos
encontrados e adiciona uma linha por listagem em data/price_history.csv.

Dispara a cada bloco novo minerado no Bitcoin (consultado via mempool.space)
-- o workflow do GitHub Actions faz polling frequente, mas este script só
de fato rasparmos as lojas quando a altura do bloco muda desde a última
coleta registrada, pra não bater nos sites de varejo à toa entre um bloco
e outro.

Uso: python -m scraper.scrape
"""
from __future__ import annotations

import csv
import json
import logging
import time
from datetime import datetime, timezone

from . import adapters, bitcoin, config, fx, normalize
from . import watchlist as wl
from .adapters import ADAPTERS

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("scraper.scrape")

CSV_FIELDS = [
    "block_height", "timestamp", "date", "site_id", "site_name", "region",
    "brand", "model", "version", "title", "price_local", "currency",
    "price_usd", "url",
]


def _last_recorded_block() -> int | None:
    if not config.PRICE_HISTORY_CSV.exists():
        return None
    last_block = None
    with config.PRICE_HISTORY_CSV.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            raw = row.get("block_height")
            if raw:
                try:
                    last_block = int(raw)
                except ValueError:
                    continue
    return last_block


def _append_listings(new_rows, listings, rates, *, block_height, timestamp, today, site) -> int:
    # "trust_category": true em sites.json marca uma listing_url que é uma
    # categoria dedicada só a chuteira (confirmado manualmente, não
    # adivinhado) -- pula o filtro por palavra-chave, que rejeitaria um
    # título sem "chuteira"/"botin" explícito mesmo sendo chuteira de
    # verdade (mesmo bug que travava os Kakari da World Rugby Shop).
    trust_category = site.get("trust_category", False)
    count = 0
    for item in listings:
        if not trust_category and not normalize.is_rugby_boot(item["title"], item.get("category_hint", "")):
            continue
        price_usd = fx.to_usd(item["price"], item["currency"], rates)
        if price_usd is None:
            continue
        info = normalize.normalize_title(item["title"])
        new_rows.append({
            "block_height": block_height if block_height is not None else "",
            "timestamp": timestamp,
            "date": today,
            "site_id": site["id"],
            "site_name": site["name"],
            "region": site["region"],
            "brand": info["brand"],
            "model": info["model"],
            "version": info["version"],
            "title": item["title"],
            "price_local": item["price"],
            "currency": item["currency"],
            "price_usd": price_usd,
            "url": item["url"],
        })
        count += 1
    return count


def run() -> dict:
    now = datetime.now(config.TIMEZONE)
    today = now.date().isoformat()
    timestamp = now.isoformat()

    block_height = bitcoin.get_latest_block_height()
    last_block = _last_recorded_block()

    run_log = {
        "date": today, "timestamp": timestamp, "block_height": block_height,
        "generated_at": datetime.now(timezone.utc).isoformat(), "sites": [],
    }

    if block_height is not None and block_height == last_block:
        log.info("Bloco %s sem mudança desde a última coleta -- pulando.", block_height)
        run_log.update(skipped=True, total_listings=0)
        config.DATA_DIR.mkdir(parents=True, exist_ok=True)
        config.SCRAPE_LOG_JSON.write_text(json.dumps(run_log, indent=2, ensure_ascii=False), encoding="utf-8")
        return run_log

    if block_height is None:
        log.warning("Não consegui a altura do bloco atual -- coletando mesmo assim.")

    sites = json.loads(config.SITES_CONFIG.read_text(encoding="utf-8"))
    rates = fx.get_usd_rates()

    config.DATA_DIR.mkdir(parents=True, exist_ok=True)
    file_exists = config.PRICE_HISTORY_CSV.exists()

    new_rows = []

    for i, site in enumerate(sites):
        adapter = ADAPTERS.get(site["adapter"])
        site_entry = {"id": site["id"], "name": site["name"], "region": site["region"]}
        if not adapter:
            site_entry.update(status="error", error=f"adaptador desconhecido: {site['adapter']}", count=0)
            run_log["sites"].append(site_entry)
            continue

        if i > 0:
            time.sleep(config.REQUEST_DELAY_SECONDS)

        try:
            listings = adapter(site)
        except Exception as exc:  # nunca deixa um site derrubar os outros
            log.exception("Falha ao raspar %s", site["name"])
            site_entry.update(status="error", error=str(exc), count=0)
            run_log["sites"].append(site_entry)
            continue

        raw_count = len(listings)
        sample = [(item["title"], item.get("category_hint", "")) for item in listings[:5]]
        log.info("%s: %d itens brutos antes do filtro. Exemplos (título, category_hint): %s",
                  site["name"], raw_count, sample)

        count = _append_listings(new_rows, listings, rates, block_height=block_height,
                                  timestamp=timestamp, today=today, site=site)

        site_entry.update(status="ok" if count else "empty", count=count, raw_count=raw_count)
        run_log["sites"].append(site_entry)
        log.info("%s: %d listagens", site["name"], count)

    # Busca ativa pelos itens da watchlist nos sites que suportam busca --
    # em vez de só depender de aparecer no catálogo geral (scraper/watchlist.py
    # explica por que o casamento usa o título bruto do resultado da busca).
    search_sites = [s for s in sites if s.get("supports_search")]
    if search_sites:
        entries = wl.load_watchlist()
        search_found = 0
        for site in search_sites:
            for entry in entries:
                time.sleep(config.REQUEST_DELAY_SECONDS)
                try:
                    listings = adapters.search_shopify(site, entry["label"])
                except Exception as exc:
                    log.warning("Busca por %r em %s falhou: %s", entry["label"], site["name"], exc)
                    continue
                count = _append_listings(new_rows, listings, rates, block_height=block_height,
                                          timestamp=timestamp, today=today, site=site)
                if count:
                    search_found += count
                    log.info("Busca por %r em %s: %d chuteira(s)", entry["label"], site["name"], count)
        run_log["watchlist_search_found"] = search_found

    # a busca ativa pode achar de novo um produto que a varredura geral já
    # pegou -- deduplica por (site, url) mantendo a primeira ocorrência
    seen = set()
    deduped_rows = []
    for row in new_rows:
        key = (row["site_id"], row["url"])
        if key in seen:
            continue
        seen.add(key)
        deduped_rows.append(row)
    new_rows = deduped_rows

    with config.PRICE_HISTORY_CSV.open("a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        if not file_exists:
            writer.writeheader()
        writer.writerows(new_rows)

    run_log["total_listings"] = len(new_rows)
    config.SCRAPE_LOG_JSON.write_text(json.dumps(run_log, indent=2, ensure_ascii=False), encoding="utf-8")
    log.info("Total: %d listagens novas no bloco %s (%s)", len(new_rows), block_height, timestamp)
    return run_log


if __name__ == "__main__":
    run()
