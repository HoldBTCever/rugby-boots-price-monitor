"""Adaptadores de raspagem por site/plataforma.

Cada adaptador recebe a config de um site (de sites.json) e devolve uma
lista de listagens brutas: [{title, price, currency, url}, ...].

Erros em um produto ou em um site nunca devem derrubar a execução inteira
-- cada função captura suas próprias exceções e loga um aviso, retornando
o que conseguiu extrair até ali.

Dividido em submódulos por família de loja (era um único arquivo de ~480
linhas): common.py (fetch/parse de preço, usado por todos), jsonld.py
(schema.org Product genérico -- Shopify tema antigo, Canterbury, Gilbert),
shopify.py (/products.json + busca ativa da watchlist, com filtro de
tamanho US 9-12), mizuno.py (scraping dedicado do HTML da jpn.mizuno.com,
sem JSON-LD nem API pública). Este __init__ reexporta a API pública igual
antes -- nenhum outro módulo do projeto precisou mudar import.
"""
from __future__ import annotations

from .common import fetch, parse_price_text
from .jsonld import discover_links, extract_jsonld_products, scrape_jsonld_site
from .mizuno import scrape_mizuno_jp
from .shopify import (
    fetch_shopify_collection_handles,
    scrape_shopify_products_json,
    search_shopify,
)

ADAPTERS = {
    "shopify_jsonld": scrape_jsonld_site,
    "generic_jsonld": scrape_jsonld_site,
    "shopify_products_json": scrape_shopify_products_json,
    "mizuno_jp": scrape_mizuno_jp,
}

__all__ = [
    "ADAPTERS",
    "fetch",
    "parse_price_text",
    "extract_jsonld_products",
    "discover_links",
    "scrape_jsonld_site",
    "scrape_mizuno_jp",
    "fetch_shopify_collection_handles",
    "scrape_shopify_products_json",
    "search_shopify",
]
