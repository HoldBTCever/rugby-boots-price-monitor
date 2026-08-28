"""Adaptador pra lojas Shopify via /products.json (catálogo inteiro
paginado) + busca ativa da watchlist via /search/suggest.json -- inclui o
filtro de tamanho US 9-12 (só faz sentido pra Shopify, que expõe variante
com tamanho/disponibilidade estruturados; JSON-LD genérico não tem isso,
ver adapters/jsonld.py)."""
from __future__ import annotations

import json
import logging
import re
import time
from urllib.parse import quote

from .. import config
from .common import fetch

log = logging.getLogger("scraper.adapters")

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


# Cache por execução (handle -> preço já filtrado por tamanho, ou None se
# nenhuma variante caiu na faixa) preenchido pela varredura geral do
# catálogo (scrape_shopify_products_json) e reaproveitado pela busca ativa
# da watchlist (search_shopify). Existe porque o endpoint de detalhe do
# produto (/products/<handle>.json) pode devolver disponibilidade de
# variante desatualizada/diferente do catálogo geral (/products.json) no
# mesmo instante -- confirmado com dado real: no bloco 964445 a varredura
# geral da Rugbystuff calculou preço=None pro Kakari RS SG Black/Grey (só
# UK13 disponível, fora de US 9-12), mas a busca pela watchlist "Kakari
# Z.1"/"Kakari Z.2" (que bate no MESMO produto) fez sua própria consulta a
# /products/<handle>.json minutos depois e recebeu variantes que pareciam
# disponíveis, reintroduzindo o produto filtrado. Reaproveitar o veredito
# já calculado pra esse handle nesta mesma execução evita a consulta
# redundante (e potencialmente inconsistente) e garante que os dois
# caminhos concordem.
_shopify_price_cache: dict[str, dict[str, float | None]] = {}


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
    price_cache = _shopify_price_cache.setdefault(site["id"], {})
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
                if handle:
                    price_cache[handle] = price
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
    3 primeiros já são os mais prováveis de bater com a watchlist).

    Se a varredura geral do catálogo (scrape_shopify_products_json) já
    avaliou esse handle nesta mesma execução, reaproveita o preço/veredito
    dela em vez de consultar /products/<handle>.json de novo -- os dois
    endpoints podem divergir na disponibilidade de variante no mesmo
    instante (confirmado com dado real, ver comentário de
    _shopify_price_cache), e o catálogo geral é a fonte mais confiável por
    varrer o produto uma vez só, direto do /products.json paginado."""
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
    price_cache = _shopify_price_cache.get(site["id"], {})
    listings = []
    for p in products:
        title = (p.get("title") or "").strip()
        handle = p.get("handle")
        if not (title and handle):
            continue

        if handle in price_cache:
            price = price_cache[handle]
        else:
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

        # URL limpa (sem os parâmetros de rastreio _pos/_psq/_psid da busca
        # Shopify) -- além de ser o link mais apresentável, garante que duas
        # consultas da watchlist que batem no mesmo produto (ex: "Kakari
        # Z.1" e "Kakari Z.2" ambas achando o Kakari RS SG) produzam a
        # MESMA url, pra a deduplicação por (site, url) em scrape.py de
        # fato funcionar.
        listings.append({
            "title": title,
            "price": price,
            "currency": site["currency"],
            "url": f"{site['base_url']}/products/{handle}",
        })
    return listings
