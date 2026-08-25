"""Adaptadores de raspagem por site/plataforma.

Cada adaptador recebe a config de um site (de sites.json) e devolve uma
lista de listagens brutas: [{title, price, currency, url}, ...].

Erros em um produto ou em um site nunca devem derrubar a execução inteira
-- cada função captura suas próprias exceções e loga um aviso, retornando
o que conseguiu extrair até ali.
"""
from __future__ import annotations

import json
import logging
import re
import time
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from . import config

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


_ML_RUGBY_BRANDS = ["gilbert", "canterbury", "mizuno", "oxen", "kakari", "ccc"]


def scrape_mercadolibre(site: dict) -> list[dict]:
    """A busca "botines-de-rugby" do MercadoLibre devolve muita chuteira de
    futebol/futsal junto (Puma Ultra Match, ASICS Lethal Flash etc.) --
    times argentinos usam o mesmo termo pra tudo. Só aceita o resultado
    se o título disser "rugby" explicitamente ou for de uma marca
    conhecida por chuteira de rugby (mesma lista que já usamos pra
    normalizar marca/modelo)."""
    listings: list[dict] = []
    for listing_url in site["listing_urls"]:
        html = fetch(listing_url)
        if not html:
            continue
        soup = BeautifulSoup(html, "lxml")

        cards = (
            soup.select("li.ui-search-layout__item")
            or soup.select("div.ui-search-result__wrapper")
            or soup.select("div.poly-card")
            or soup.select("li.poly-card")
        )
        for card in cards[: config.MAX_PRODUCTS_PER_SITE]:
            link_tag = card.select_one(
                "a.ui-search-link, a.ui-search-item__group__element, a.poly-component__title"
            )
            title_tag = card.select_one(
                "h2.ui-search-item__title, .poly-component__title, h3.poly-component__title-wrapper"
            )
            price_tag = card.select_one("span.andes-money-amount__fraction")
            if not (link_tag and price_tag):
                continue
            title = (title_tag or link_tag).get_text(strip=True)
            title_lower = title.lower()
            if "rugby" not in title_lower and not any(b in title_lower for b in _ML_RUGBY_BRANDS):
                continue
            price = parse_price_text(price_tag.get_text(strip=True))
            href = link_tag.get("href")
            if title and price and href:
                listings.append({
                    "title": title, "price": price, "currency": site["currency"], "url": href,
                })
    return listings


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
        # loga o tamanho do HTML e uma amostra de hrefs reais pra descobrir
        # se o fetch está trazendo a página certa e qual é o padrão de link
        # de verdade, em vez de continuar adivinhando "goods-detail".
        log.info(
            "Mizuno Japan: HTML com %d chars, %d links no total, %d batem goods-detail/goods-id. "
            "Amostra de hrefs: %s",
            len(html), len(all_anchors), len(anchors),
            [a["href"] for a in all_anchors[:15]],
        )
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


def scrape_shopify_products_json(site: dict) -> list[dict]:
    """Lojas Shopify expõem o catálogo inteiro em /products.json -- não
    depende de adivinhar o slug certo de uma coleção nem de visitar
    página por página atrás de JSON-LD. Pagina o catálogo inteiro (250
    produtos por página, o máximo que a Shopify permite) até a última
    página -- não para em MAX_PRODUCTS_PER_SITE bruto, porque nada
    garante que as primeiras páginas do catálogo tenham chuteiras (podem
    vir cheias de camisas/bolas antes); quem decide o que é chuteira é o
    filtro is_rugby_boot() em scrape.py, depois de já ter tudo em mãos."""
    listings: list[dict] = []
    page_size = 250
    for products_url in site["listing_urls"]:
        page = 1
        while page <= 12:  # até 3 mil produtos por listing_url -- as coleções
                            # específicas de sites.json cobrem o essencial rápido;
                            # isto é só um teto de segurança para o catálogo geral
            html = fetch(f"{products_url}?limit={page_size}&page={page}")
            if not html:
                break
            try:
                data = json.loads(html)
            except json.JSONDecodeError:
                log.warning("%s não devolveu JSON válido em /products.json", site["name"])
                break

            products = data.get("products") or []
            if not products:
                break

            for product in products:
                title = (product.get("title") or "").strip()
                handle = product.get("handle")
                variants = product.get("variants") or []
                prices = [
                    float(v["price"]) for v in variants
                    if v.get("price") and v.get("available", True)
                ] or [float(v["price"]) for v in variants if v.get("price")]
                if not (title and handle and prices):
                    continue
                # product_type é a categoria que a própria loja atribuiu ao
                # produto -- muitos títulos Shopify não repetem "boot" (só
                # marca + modelo + cor), então isso vira um sinal extra pro
                # filtro is_rugby_boot() em normalize.py.
                category_hint = (product.get("product_type") or "").strip()
                tags = product.get("tags") or []
                if isinstance(tags, list):
                    category_hint = f"{category_hint} {' '.join(tags)}".strip()
                listings.append({
                    "title": title,
                    "price": min(prices),
                    "currency": site["currency"],
                    "url": f"{site['base_url']}/products/{handle}",
                    "category_hint": category_hint,
                })

            if len(products) < page_size:
                break  # última página do catálogo
            page += 1
            time.sleep(config.REQUEST_DELAY_SECONDS)
    return listings


def search_shopify(site: dict, query: str) -> list[dict]:
    """Busca ativa por um termo específico via API nativa de busca
    preditiva do Shopify (`/search/suggest.json`) -- recurso da
    plataforma disponível em qualquer tema, não depende de layout.
    Usado para procurar de verdade os itens da watchlist em vez de só
    esperar que apareçam no catálogo geral."""
    from urllib.parse import quote

    url = (
        f"{site['base_url']}/search/suggest.json"
        f"?q={quote(query)}&resources[type]=product&resources[limit]=10"
    )
    html = fetch(url)
    if not html:
        return []
    try:
        data = json.loads(html)
    except json.JSONDecodeError:
        log.warning("%s não devolveu JSON válido na busca por %r", site["name"], query)
        return []

    products = data.get("resources", {}).get("results", {}).get("products") or []
    listings = []
    for p in products:
        title = (p.get("title") or "").strip()
        handle = p.get("handle")
        price_text = p.get("price_min") or p.get("price") or ""
        price = parse_price_text(str(price_text)) if price_text else None
        if title and handle and price:
            listings.append({
                "title": title,
                "price": price,
                "currency": site["currency"],
                "url": urljoin(site["base_url"], p["url"]) if p.get("url") else f"{site['base_url']}/products/{handle}",
            })
    return listings


ADAPTERS = {
    "shopify_jsonld": scrape_jsonld_site,
    "generic_jsonld": scrape_jsonld_site,
    "mercadolibre_search": scrape_mercadolibre,
    "shopify_products_json": scrape_shopify_products_json,
    "mizuno_jp": scrape_mizuno_jp,
}
