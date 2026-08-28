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
_SIZE_RE = re.compile(r"(\d{1,2}(?:\.5)?)")


def _parse_us_size(variant: dict, site: dict, title: str = "") -> float | None:
    """Extrai o tamanho (americano) de uma variante Shopify. O texto do
    tamanho (option1/title, ex: "8.5", "US 9", "UK 8") varia por loja --
    pega o primeiro número. Lojas do Reino Unido (GBP) numeram no padrão
    britânico: a maioria das marcas (Canterbury, Gilbert, Mizuno, Oxen...)
    segue a conversão padrão de calçado esportivo UK->US masculino (soma
    1: UK 7 = US 8, UK 10 = US 11), mas a adidas é uma exceção conhecida
    -- a própria tabela oficial da adidas usa meio tamanho de diferença
    (UK 8 = US 8.5, não US 9). Sem esse ajuste, uma chuteira adidas de UK
    8 (a única disponível de verdade) era lida como "US 9" e entrava no
    filtro de tamanho, quando o equivalente americano real (8.5) fica
    fora da faixa -- foi o que o usuário reportou na Kakari Elite Black
    da Rugbystuff (confirmado: variante disponível era só UK 8/UK 13,
    nenhuma de fato dentro de US 9-12)."""
    raw = str(variant.get("option1") or variant.get("title") or "")
    match = _SIZE_RE.search(raw)
    if not match:
        return None
    try:
        size = float(match.group(1))
    except ValueError:
        return None
    if site.get("currency") == "GBP":
        size += 0.5 if "adidas" in title.lower() else 1.0
    return size


def _min_price_in_size_range(variants: list[dict], site: dict, title: str = "") -> float | None:
    """Menor preço entre as variantes disponíveis cujo tamanho (convertido
    pra americano) cai dentro de [config.MIN_US_SIZE, config.MAX_US_SIZE].
    Devolve None se nenhuma variante disponível estiver na faixa -- nesse
    caso o produto inteiro é descartado, não "preço de outro tamanho"."""
    candidates = []
    for v in variants:
        if not v.get("price") or not v.get("available", True):
            continue
        size = _parse_us_size(v, site, title)
        if size is None:
            continue
        if config.MIN_US_SIZE <= size <= config.MAX_US_SIZE:
            candidates.append(float(v["price"]))
    return min(candidates) if candidates else None


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


def fetch_shopify_collection_handles(collection_products_url: str) -> set[str]:
    """Busca todos os handles de produto de uma coleção Shopify (paginado).
    Usado como lista de exclusão: algumas lojas (ex: Lovell Sports) têm
    uma coleção "kids" separada onde o título do produto sozinho não diz
    "kids"/"junior" (ex: "Canterbury Speed Rugby Boot" é infantil lá,
    mas o nome não denuncia) -- então checar a categoria/palavra-chave
    no título não pega. Sabendo o handle de cada produto dessa coleção,
    dá pra excluir esses produtos onde quer que apareçam depois."""
    handles: set[str] = set()
    page = 1
    page_size = 250
    while page <= 12:
        html = fetch(f"{collection_products_url}?limit={page_size}&page={page}")
        if not html:
            break
        try:
            data = json.loads(html)
        except json.JSONDecodeError:
            break
        products = data.get("products") or []
        if not products:
            break
        for product in products:
            handle = product.get("handle")
            if handle:
                handles.add(handle)
        if len(products) < page_size:
            break
        page += 1
        time.sleep(config.REQUEST_DELAY_SECONDS)
    return handles


def scrape_shopify_products_json(site: dict) -> list[dict]:
    """Lojas Shopify expõem o catálogo inteiro em /products.json -- não
    depende de adivinhar o slug certo de uma coleção nem de visitar
    página por página atrás de JSON-LD. Pagina o catálogo inteiro (250
    produtos por página, o máximo que a Shopify permite) até a última
    página -- não para em MAX_PRODUCTS_PER_SITE bruto, porque nada
    garante que as primeiras páginas do catálogo tenham chuteiras (podem
    vir cheias de camisas/bolas antes); quem decide o que é chuteira é o
    filtro is_rugby_boot() em scrape.py, depois de já ter tudo em mãos.
    O preço de cada produto é o menor entre as variantes disponíveis
    dentro da faixa de tamanho US 8-11 (_min_price_in_size_range) --
    produto sem nenhum tamanho disponível nessa faixa não entra."""
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
                price = _min_price_in_size_range(variants, site, title)
                if handle == "adidas-kakari-rs-sg-rugby-boots-black-grey" and site["id"] == "rugbystuff":
                    # diagnóstico temporário: usuário reportou que a loja de
                    # verdade só tem UK13 em estoque desse produto (fora da
                    # faixa US 9-12 mesmo com o ajuste +0.5 da adidas), mas
                    # ele continua aparecendo com preço no site -- loga a
                    # variante bruta pra achar a causa real (available
                    # errado, parsing de tamanho, ou option1/title em
                    # formato inesperado) em vez de adivinhar.
                    log.info(
                        "Diagnóstico Kakari RS SG Black/Grey (Rugbystuff): preço calculado=%s. Variantes: %s",
                        price,
                        [(v.get("option1"), v.get("title"), v.get("price"), v.get("available")) for v in variants],
                    )
                if not (title and handle and price):
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
                    "price": price,
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
    esperar que apareçam no catálogo geral.

    O /search/suggest.json só devolve um price_min estimado, sem detalhe
    de variante/tamanho -- pra aplicar o mesmo filtro de tamanho do
    catálogo geral, busca o /products/<handle>.json completo de cada
    resultado. limit=3 (não 10) pra não multiplicar demais o número de
    requisições por consulta (Shopify já ordena por relevância, então os
    3 primeiros já são os mais prováveis de bater com a watchlist)."""
    from urllib.parse import quote

    url = (
        f"{site['base_url']}/search/suggest.json"
        f"?q={quote(query)}&resources[type]=product&resources[limit]=3"
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
        if not (title and handle):
            continue

        time.sleep(config.REQUEST_DELAY_SECONDS)
        detail_html = fetch(f"{site['base_url']}/products/{handle}.json")
        if not detail_html:
            continue
        try:
            variants = (json.loads(detail_html).get("product") or {}).get("variants") or []
        except json.JSONDecodeError:
            continue
        price = _min_price_in_size_range(variants, site, title)
        if not price:
            continue

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
    "shopify_products_json": scrape_shopify_products_json,
    "mizuno_jp": scrape_mizuno_jp,
}
