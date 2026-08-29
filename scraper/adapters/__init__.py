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
tamanho US 9-12). Este __init__ reexporta a API pública igual antes --
nenhum outro módulo do projeto precisou mudar import.

mizuno.py (scraping dedicado do HTML da jpn.mizuno.com, sem JSON-LD nem
API pública) foi removido junto com a loja Mizuno Japan em sites.json --
o adaptador nunca conseguiu achar link de produto de verdade na página
(só menu/navegação), sempre devolvendo 0 chuteiras.
"""
from __future__ import annotations

from .common import fetch, parse_price_text
from .jsonld import discover_links, extract_jsonld_products, scrape_jsonld_site
from .shopify import (
    fetch_shopify_collection_handles,
    scrape_shopify_products_json,
    search_shopify,
)

ADAPTERS = {
    "shopify_jsonld": scrape_jsonld_site,
    "generic_jsonld": scrape_jsonld_site,
    "shopify_products_json": scrape_shopify_products_json,
}

__all__ = [
    "ADAPTERS",
    "fetch",
    "parse_price_text",
    "extract_jsonld_products",
    "discover_links",
    "scrape_jsonld_site",
    "fetch_shopify_collection_handles",
    "scrape_shopify_products_json",
    "search_shopify",
]
