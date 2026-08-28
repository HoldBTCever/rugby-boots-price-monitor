"""Utilitários de raspagem compartilhados por mais de uma família de
adaptador (fetch HTTP e parsing de preço em texto livre)."""
from __future__ import annotations

import logging
import re

import requests

from .. import config

log = logging.getLogger("scraper.adapters")

_PRICE_RE = re.compile(r"[\d][\d.,]*\d|\d")


def fetch(url: str, extra_headers: dict | None = None) -> str | None:
    headers = {**config.HTTP_HEADERS, **extra_headers} if extra_headers else config.HTTP_HEADERS
    try:
        resp = requests.get(url, headers=headers, timeout=config.REQUEST_TIMEOUT_SECONDS)
        if resp.status_code != 200:
            log.warning("GET %s -> HTTP %s", url, resp.status_code)
            return None
        return resp.text
    except requests.RequestException as exc:
        log.warning("Falha ao buscar %s: %s", url, exc)
        return None


def parse_price_text(text: str) -> float | None:
    """Converte um texto de preço em número, lidando com separadores
    de milhar/decimal que variam por local (1,234.56 vs 1.234,56)."""
    match = _PRICE_RE.search(text.replace("\xa0", " "))
    if not match:
        return None
    raw = match.group(0)

    if "," in raw and "." in raw:
        if raw.rfind(",") > raw.rfind("."):
            raw = raw.replace(".", "").replace(",", ".")
        else:
            raw = raw.replace(",", "")
    elif "," in raw:
        tail = raw.split(",")[-1]
        raw = raw.replace(",", ".") if len(tail) == 2 else raw.replace(",", "")
    elif "." in raw:
        # "." isolado só é separador decimal quando sobram exatamente 2
        # dígitos depois dele (centavos) -- ninguém escreve preço com 1 ou
        # 3+ casas decimais. Qualquer outra contagem é separador de milhar
        # (comum em ARS/PYG/JPY: "249.999" = 249999, não 249,999). Vale
        # pra qualquer moeda, não só as que a gente já sabia que usam "."
        # como milhar -- é assim que descobrimos o bug real do ARS, que
        # não estava nessa lista antes e gerava preços 1000x menores.
        tail = raw.split(".")[-1]
        if len(tail) != 2:
            raw = raw.replace(".", "")

    try:
        return float(raw)
    except ValueError:
        return None
