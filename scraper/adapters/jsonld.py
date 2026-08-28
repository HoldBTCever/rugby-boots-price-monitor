"""Adaptador genérico pra lojas que expõem schema.org Product/Offer via
JSON-LD (Shopify com tema antigo, Magento, sites com JSON-LD direto no
HTML) -- usado tanto por lojas Shopify quanto por lojas oficiais de marca
(Canterbury, Gilbert)."""
from __future__ import annotations

import json
import time
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from .. import config
from .common import fetch


def extract_jsonld_products(html: str, page_url: str) -> list[dict]:
    """Procura blocos <script type="application/ld+json"> com schema.org
    Product/Offer -- a forma mais estável de extrair preço, pois não
    depende de classes CSS que mudam a cada redesign."""
    soup = BeautifulSoup(html, "lxml")
    results = []

    def _walk(node):
        if isinstance(node, dict):
            types = node.get("@type")
            types = [types] if isinstance(types, str) else (types or [])
            if "Product" in types:
                name = node.get("name")
                offers = node.get("offers")
                offer_list = offers if isinstance(offers, list) else [offers] if offers else []
                for offer in offer_list:
                    if not isinstance(offer, dict):
                        continue
                    price = offer.get("price") or offer.get("lowPrice")
                    currency = offer.get("priceCurrency")
                    if name and price and currency:
                        try:
                            price_val = float(str(price).replace(",", ""))
                        except ValueError:
                            continue
                        results.append({
                            "title": name.strip(),
                            "price": price_val,
                            "currency": currency,
                            "url": node.get("url") or page_url,
                        })
            for value in node.values():
                _walk(value)
        elif isinstance(node, list):
            for item in node:
                _walk(item)

    for tag in soup.find_all("script", {"type": "application/ld+json"}):
        try:
            data = json.loads(tag.string or "")
        except (json.JSONDecodeError, TypeError):
            continue
        _walk(data)

    return results


def discover_links(html: str, base_url: str, pattern: str, limit: int) -> list[str]:
    soup = BeautifulSoup(html, "lxml")
    seen, links = set(), []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if pattern in href:
            full = urljoin(base_url, href.split("?")[0])
            if full not in seen:
                seen.add(full)
                links.append(full)
        if len(links) >= limit:
            break
    return links


def scrape_jsonld_site(site: dict) -> list[dict]:
    """Para lojas Shopify/Magento/etc. que expõem schema.org Product:
    tenta primeiro extrair JSON-LD direto da página de listagem; se não
    houver, visita cada página de produto individualmente."""
    listings: list[dict] = []
    for listing_url in site["listing_urls"]:
        html = fetch(listing_url)
        if not html:
            continue

        found = extract_jsonld_products(html, listing_url)
        if found:
            listings.extend(found)
            continue

        product_links = discover_links(
            html, site["base_url"], site["product_link_pattern"], config.MAX_PRODUCTS_PER_SITE
        )
        for link in product_links:
            time.sleep(config.REQUEST_DELAY_SECONDS)
            product_html = fetch(link)
            if not product_html:
                continue
            listings.extend(extract_jsonld_products(product_html, link))

    return listings
