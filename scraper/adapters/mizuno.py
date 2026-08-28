"""Adaptador dedicado pra jpn.mizuno.com -- não expõe JSON-LD nem API
pública documentada, então varre o HTML renderizado por ajax na unha."""
from __future__ import annotations

import logging
import re
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from .. import config
from .common import fetch, parse_price_text
from .jsonld import extract_jsonld_products

log = logging.getLogger("scraper.adapters")


def scrape_mizuno_jp(site: dict) -> list[dict]:
    """jpn.mizuno.com não expõe JSON-LD nem API pública conhecida. A
    página de categoria é carregada via ajax (view=ajax_new), então
    manda X-Requested-With como um navegador mandaria. Varre links de
    produto (goods-detail/goods-id no href) e usa o preço em ienes mais
    próximo de cada link como heurística, na falta de algo mais estável."""
    listings: list[dict] = []
    extra_headers = {"X-Requested-With": "XMLHttpRequest", "Referer": site["base_url"] + "/"}
    for listing_url in site["listing_urls"]:
        html = fetch(listing_url, extra_headers=extra_headers)
        if not html:
            log.info("Mizuno Japan: fetch devolveu vazio/None pra %s", listing_url)
            continue

        found = extract_jsonld_products(html, listing_url)
        if found:
            listings.extend(found)
            continue

        soup = BeautifulSoup(html, "lxml")
        all_anchors = soup.find_all("a", href=True)
        anchors = [
            a for a in all_anchors
            if "goods-detail" in a["href"] or "goods-id" in a["href"]
        ]
        # diagnóstico temporário: a página confirmadamente tem chuteiras (o
        # usuário mandou o link direto), mas o adaptador sempre voltou 0 --
        # o primeiro round de diagnóstico (commit anterior) mostrou que o
        # fetch traz HTML de verdade (219KB, 755 links), só que os
        # primeiros 15 hrefs são todos menu/navegação, não produto. Agora
        # busca "goods" em QUALQUER lugar do href (não só goods-detail/
        # goods-id) pra achar o padrão real de link de produto, se existir
        # nessa resposta.
        goods_like = [a["href"] for a in all_anchors if "goods" in a["href"].lower()]
        log.info(
            "Mizuno Japan: HTML com %d chars, %d links no total, %d batem goods-detail/goods-id, "
            "%d contêm 'goods' em qualquer lugar. Amostra 'goods': %s",
            len(html), len(all_anchors), len(anchors), len(goods_like), goods_like[:20],
        )
        if not goods_like:
            log.info("Mizuno Japan: nenhum href com 'goods' -- amostra geral: %s",
                      [a["href"] for a in all_anchors[15:35]])
        seen_urls = set()
        for a in anchors:
            href = urljoin(site["base_url"], a["href"].split("?")[0])
            if href in seen_urls:
                continue

            title = a.get_text(strip=True)
            price = None
            scope = a.find_parent(["li", "div"])
            for _ in range(4):
                if not scope:
                    break
                text = scope.get_text(" ", strip=True)
                yen_match = re.search(r"[¥￥]\s*([\d,]{3,})|([\d,]{3,})\s*円", text)
                if yen_match:
                    price = parse_price_text(yen_match.group(1) or yen_match.group(2))
                if (not title or len(title) < 4) and len(text) >= 4:
                    title = text[:80]
                if price:
                    break
                scope = scope.find_parent(["li", "div"])

            if title and price:
                seen_urls.add(href)
                listings.append({"title": title, "price": price, "currency": "JPY", "url": href})
            if len(listings) >= config.MAX_PRODUCTS_PER_SITE:
                break
    return listings
