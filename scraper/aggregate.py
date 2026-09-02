#!/usr/bin/env python3
"""Lê data/price_history.csv e gera os arquivos consumidos pelo site:

- data/daily_summary.json: média histórica e série temporal por modelo/versão
- data/alerts.json: chuteiras cujo menor preço de hoje está a
  DEAL_THRESHOLD_PCT (ou mais) abaixo da média histórica do modelo
- data/watchlist.json: histórico de preço médio diário para a lista fixa
  de modelos em scraper/watchlist.json (aba "Histórico" do site)
- data/favorites.json: mesma ideia, mas pra lista curada pelo usuário em
  scraper/favorites.json (aba "Favoritos" do site)

O CSV é a fonte de verdade committada no git; as agregações pesadas
(média por modelo, série por data, contagem de solado/cabedal/trava) rodam
num SQLite em memória construído a partir dele a cada execução (ver
scraper/db.py) em vez de laço Python manual. A lista curada da watchlist/
favoritos (scraper/watchlist.py) continua casando contra o título bruto em
Python -- é pequena o bastante (uma dúzia de entradas) pra não valer a
complexidade de virar SQL.

Uso: python -m scraper.aggregate
"""
from __future__ import annotations

import csv
import json
import shutil
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

from . import config, db, watchlist as wl


def _read_rows() -> list[dict]:
    if not config.PRICE_HISTORY_CSV.exists():
        return []
    with config.PRICE_HISTORY_CSV.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def _load_model_specs() -> list[dict]:
    if not config.MODEL_SPECS_CONFIG.exists():
        return []
    return json.loads(config.MODEL_SPECS_CONFIG.read_text(encoding="utf-8"))


def _build_fx_rates() -> dict:
    """Cotação do dia (USD -> outras moedas) pro seletor de moeda de
    exibição do site -- reaproveita o cache que scraper/fx.py já grava em
    data/fx_cache.json a cada raspagem (nunca busca de novo aqui). Só
    repassa as moedas em config.DISPLAY_CURRENCIES; se o cache ainda não
    existir (primeira execução) ou faltar alguma moeda, o site cai de
    volta pra USD nessa opção (ver currency.ts)."""
    if not config.FX_CACHE_JSON.exists():
        return {"date": None, "rates": {}}
    cache = json.loads(config.FX_CACHE_JSON.read_text(encoding="utf-8"))
    all_rates = cache.get("rates") or {}
    rates = {c: all_rates[c] for c in config.DISPLAY_CURRENCIES if c in all_rates}
    return {"date": cache.get("date"), "rates": rates}


def _build_sources(active_names: set[str]) -> list[dict]:
    """Lista pública das lojas monitoradas (aba "Fontes" do site) -- os
    mesmos campos não-sensíveis de scraper/sites.json (nome, região, país,
    moeda, link da loja), mais "active": se essa loja contribuiu algum
    preço dentro da janela de 90 dias (mesmo critério de "Fuentes activas"
    no card de estatísticas, pra não ter dois números diferentes pra a
    mesma ideia). "disabled"/"disabled_reason_key" passam direto de
    sites.json -- loja desativada deliberadamente (ex: prodirectrugby,
    JSON-LD genérico sem dado de tamanho por variante, não dá pra filtrar
    US 9-12) continua listada, mas com o motivo em vez de simplesmente
    não aparecer."""
    if not config.SITES_CONFIG.exists():
        return []
    sites = json.loads(config.SITES_CONFIG.read_text(encoding="utf-8"))
    return [
        {
            "id": s["id"],
            "name": s["name"],
            "region": s["region"],
            "country": s.get("country"),
            "currency": s["currency"],
            "base_url": s["base_url"],
            "active": s["name"] in active_names,
            "disabled": bool(s.get("disabled")),
            "disabled_reason_key": s.get("disabled_reason_key"),
        }
        for s in sites
    ]


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

    # Carrega o histórico num SQLite em memória (scraper/db.py) e faz as
    # agregações pesadas (média/contagem/série por data) via SQL em vez de
    # laço Python manual -- o CSV continua sendo a fonte de verdade
    # committada, este banco é só uma camada de consulta descartável.
    # price_usd != '' cobre o `except ValueError: continue` do código
    # anterior pra linha sem preço; um price_usd presente mas não-numérico
    # (nunca aconteceu nos dados reais) viraria 0.0 aqui em vez de
    # descartado, já que CAST(...AS REAL) do SQLite não lança erro.
    conn = db.build(rows)
    price_filter = "date >= :cutoff AND price_usd != ''"

    # SUM(...)/COUNT(*) em vez de AVG(...): dão o mesmo resultado matemático,
    # mas em ~1 a cada 3 mil pontos do histórico por data (só ali, nunca no
    # avg_price_usd principal do modelo, que bateu idêntico na validação) o
    # último centavo pode divergir por 1 do que o Python calculava somando
    # em loop -- SQLite soma com compensação de erro (mais preciso), o
    # Python antigo somava ingenuamente; nos dois casos o valor real cai bem
    # em cima de um limite tipo X.945, então round(...,2) desempata pro lado
    # diferente dependendo de qual algoritmo de soma foi usado. Confirmado
    # manualmente (não é bug de agrupamento nem de filtro): não vale a pena
    # replicar a imprecisão antiga só pra bater byte a byte com o antes.

    latest_date = conn.execute(
        f"SELECT MAX(date) FROM price_history WHERE {price_filter}", {"cutoff": cutoff}
    ).fetchone()[0]

    # brand/model/version de exibição vêm da PRIMEIRA linha de cada grupo
    # na ordem original do CSV (MIN(rowid) -- o rowid implícito acompanha
    # a ordem de inserção) -- reproduz o dict.setdefault() do código
    # anterior, que só definia esses campos na primeira ocorrência do grupo.
    groups: dict[str, dict] = {}
    for sql_row in conn.execute(
        f"""
        SELECT ph.group_key, ph.brand, ph.model, ph.version
        FROM price_history ph
        JOIN (
            SELECT group_key, MIN(rowid) AS first_rowid
            FROM price_history WHERE {price_filter} GROUP BY group_key
        ) first_of_group ON ph.rowid = first_of_group.first_rowid
        ORDER BY first_of_group.first_rowid
        """,
        {"cutoff": cutoff},
    ):
        key = sql_row["group_key"]
        groups[key] = {
            "key": key, "brand": sql_row["brand"], "model": sql_row["model"], "version": sql_row["version"],
            "prices_n": 0, "avg_price": 0.0, "sources": [], "latest": [],
            "ground_types": Counter(), "upper_materials": Counter(), "stud_types": Counter(),
        }

    for sql_row in conn.execute(
        f"""
        SELECT group_key, SUM(CAST(price_usd AS REAL)) / COUNT(*) AS avg_price,
               COUNT(*) AS n, GROUP_CONCAT(DISTINCT site_name) AS sources
        FROM price_history WHERE {price_filter} GROUP BY group_key
        """,
        {"cutoff": cutoff},
    ):
        g = groups[sql_row["group_key"]]
        g["avg_price"] = sql_row["avg_price"]
        g["prices_n"] = sql_row["n"]
        g["sources"] = sorted(sql_row["sources"].split(",")) if sql_row["sources"] else []

    by_date: dict[str, list[dict]] = defaultdict(list)
    for sql_row in conn.execute(
        f"""
        SELECT group_key, date, SUM(CAST(price_usd AS REAL)) / COUNT(*) AS avg_price,
               MIN(CAST(price_usd AS REAL)) AS min_price
        FROM price_history WHERE {price_filter} GROUP BY group_key, date ORDER BY group_key, date
        """,
        {"cutoff": cutoff},
    ):
        by_date[sql_row["group_key"]].append({
            "date": sql_row["date"],
            "avg_price_usd": round(sql_row["avg_price"], 2),
            "min_price_usd": round(sql_row["min_price"], 2),
        })

    # ORDER BY rowid preserva a mesma ordem de iteração do código anterior
    # (for row in rows:), pra o desempate de Counter.most_common() em caso
    # de empate entre dois solados/cabedais com a mesma contagem não mudar.
    for sql_row in conn.execute(
        f"SELECT group_key, ground_type, upper_material, stud_type FROM price_history WHERE {price_filter} ORDER BY rowid",
        {"cutoff": cutoff},
    ):
        g = groups[sql_row["group_key"]]
        if sql_row["ground_type"]:
            g["ground_types"][sql_row["ground_type"]] += 1
        if sql_row["upper_material"]:
            g["upper_materials"][sql_row["upper_material"]] += 1
        if sql_row["stud_type"]:
            g["stud_types"][sql_row["stud_type"]] += 1

    if latest_date:
        for sql_row in conn.execute("SELECT * FROM price_history WHERE date = :latest_date", {"latest_date": latest_date}):
            g = groups.get(sql_row["group_key"])
            if g is not None:
                g["latest"].append(dict(sql_row))

    models = []
    deals = []

    for key, g in groups.items():
        n = g["prices_n"]
        avg_price = round(g["avg_price"], 2)
        history = by_date[key]

        entry = {
            "key": key, "brand": g["brand"], "model": g["model"], "version": g["version"],
            "avg_price_usd": avg_price, "n_observations": n,
            "sources": g["sources"], "history": history,
            "latest_date": latest_date, "latest_min_price_usd": None,
            "latest_min_site": None, "latest_min_region": None, "latest_min_url": None,
            "discount_pct": None, "is_deal": False,
            "ground_type": g["ground_types"].most_common(1)[0][0] if g["ground_types"] else None,
            "upper_material": g["upper_materials"].most_common(1)[0][0] if g["upper_materials"] else None,
            "stud_type": g["stud_types"].most_common(1)[0][0] if g["stud_types"] else None,
            "width_fit": None,
            "spec_source": None,
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
    sources_out = {
        "generated_at": now.isoformat(),
        "sites": _build_sources(set(all_sources)),
    }
    fx_rates_out = _build_fx_rates()

    config.DATA_DIR.mkdir(parents=True, exist_ok=True)
    config.DAILY_SUMMARY_JSON.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
    config.ALERTS_JSON.write_text(json.dumps(alerts, indent=2, ensure_ascii=False), encoding="utf-8")
    config.WATCHLIST_JSON.write_text(json.dumps(watchlist_out, indent=2, ensure_ascii=False), encoding="utf-8")
    config.FAVORITES_JSON.write_text(json.dumps(favorites_out, indent=2, ensure_ascii=False), encoding="utf-8")
    config.SOURCES_JSON.write_text(json.dumps(sources_out, indent=2, ensure_ascii=False), encoding="utf-8")
    config.FX_RATES_JSON.write_text(json.dumps(fx_rates_out, indent=2, ensure_ascii=False), encoding="utf-8")

    config.SITE_DATA_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copy(config.DAILY_SUMMARY_JSON, config.SITE_DATA_DIR / "daily_summary.json")
    shutil.copy(config.ALERTS_JSON, config.SITE_DATA_DIR / "alerts.json")
    shutil.copy(config.WATCHLIST_JSON, config.SITE_DATA_DIR / "watchlist.json")
    shutil.copy(config.FAVORITES_JSON, config.SITE_DATA_DIR / "favorites.json")
    shutil.copy(config.SOURCES_JSON, config.SITE_DATA_DIR / "sources.json")
    shutil.copy(config.FX_RATES_JSON, config.SITE_DATA_DIR / "fx_rates.json")

    found = sum(1 for m in watchlist_out["models"] if m["versions"])
    found_fav = sum(1 for m in favorites_out["models"] if m["versions"])
    print(f"{len(models)} modelos, {len(deals)} ofertas (>= {config.DEAL_THRESHOLD_PCT:.1%} abaixo da média), "
          f"{found}/{len(watchlist_out['models'])} itens da watchlist encontrados, "
          f"{found_fav}/{len(favorites_out['models'])} favoritos encontrados")


if __name__ == "__main__":
    run()
