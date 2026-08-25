"""Altura do bloco mais recente da blockchain do Bitcoin (via mempool.space).

Usado como "relógio" da coleta: só rasparmos as lojas de novo quando um
bloco novo for minerado, em vez de rodar num horário fixo do dia.
"""
from __future__ import annotations

import logging

import requests

from . import config

log = logging.getLogger("scraper.bitcoin")


def get_latest_block_height() -> int | None:
    try:
        resp = requests.get(config.BITCOIN_BLOCK_API_URL, timeout=config.REQUEST_TIMEOUT_SECONDS)
        resp.raise_for_status()
        return int(resp.text.strip())
    except (requests.RequestException, ValueError) as exc:
        log.warning("Falha ao consultar altura do bloco em %s: %s", config.BITCOIN_BLOCK_API_URL, exc)
        return None
