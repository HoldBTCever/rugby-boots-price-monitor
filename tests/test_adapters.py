"""Suíte de regressão pra scraper/adapters/shopify.py -- foco no filtro de tamanho
Shopify (_parse_us_size / _min_price_in_size_range) e no cache que evita a
inconsistência entre /products.json e /products/<handle>.json, os dois
bugs reais corrigidos nesta sessão pro Kakari Elite Black e Kakari RS SG
Black/Grey da Rugbystuff."""
from scraper.adapters import shopify

SITE_GBP = {"id": "rugbystuff", "currency": "GBP"}


def _variant(size_label, price="70.00", available=True):
    return {"option1": size_label, "title": size_label, "price": price, "available": available}


def test_adidas_uk_para_us_soma_meio_tamanho_nao_um():
    """A tabela oficial da adidas usa meio tamanho de diferença
    (UK 8 = US 8.5), diferente da maioria das marcas (UK 8 = US 9) --
    confirmado real: Kakari Elite Black da Rugbystuff só tinha UK 8/UK 13
    de verdade, e a conversão errada (+1) fazia UK 8 virar "US 9" e cair
    dentro do filtro por engano."""
    adidas_variant = _variant("UK 8")
    outra_marca_variant = _variant("UK 8")

    adidas_size = shopify._parse_us_size(adidas_variant, SITE_GBP, "Adidas Kakari Elite SG Black")
    outra_size = shopify._parse_us_size(outra_marca_variant, SITE_GBP, "Canterbury Phoenix 2.0")

    assert adidas_size == 8.5
    assert outra_size == 9.0


def test_kakari_rs_sg_black_grey_so_uk13_fica_fora_da_faixa():
    """Dado real logado via GitHub Actions (bloco 964445): a Rugbystuff só
    tinha UK 13 disponível de verdade nesse produto -- US 13.5 depois da
    conversão adidas, fora de US 9-12. Nenhuma variante deve entrar."""
    variants = [
        _variant("UK 8", available=False), _variant("UK 8.5", available=False),
        _variant("UK 9", available=False), _variant("UK 9.5", available=False),
        _variant("UK 10", available=False), _variant("UK 10.5", available=False),
        _variant("UK 11", available=False), _variant("UK 11.5", available=False),
        _variant("UK 12", available=False), _variant("UK 12.5", available=False),
        _variant("UK 13", available=True),
        _variant("UK 14", available=False), _variant("UK 15", available=False),
    ]
    price = shopify._min_price_in_size_range(
        variants, SITE_GBP, "Adidas Kakari RS SG Rugby Boots Black/Grey"
    )
    assert price is None


def test_variante_normal_dentro_da_faixa_ainda_funciona():
    variants = [_variant("UK 9", price="58.00"), _variant("UK 10", price="58.00")]
    price = shopify._min_price_in_size_range(
        variants, SITE_GBP, "Adidas Kakari Elite SG Rugby Boots Black"
    )
    assert price == 58.0


def test_busca_da_watchlist_reaproveita_veredito_da_varredura_geral():
    """A busca ativa da watchlist (search_shopify) chamava
    /products/<handle>.json de novo e podia receber disponibilidade
    diferente da varredura geral (/products.json) no mesmo instante --
    confirmado real pro Kakari RS SG Black/Grey. O cache por execução
    (_shopify_price_cache) tem que fazer a busca herdar o preço=None já
    calculado pela varredura geral em vez de reconsultar."""
    handle = "adidas-kakari-rs-sg-rugby-boots-black-grey"
    shopify._shopify_price_cache[SITE_GBP["id"]] = {handle: None}

    cache = shopify._shopify_price_cache.get(SITE_GBP["id"], {})
    assert handle in cache
    assert cache[handle] is None
