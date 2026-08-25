"""Extrai marca, modelo e versão de um título de produto em texto livre."""
from __future__ import annotations

import json
import re

from . import config

_catalog = json.loads(config.CATALOG_CONFIG.read_text(encoding="utf-8"))
_BRANDS = _catalog["brands"]
_NOISE = {w.lower() for w in _catalog["noise_words"]}
_VERSION_TOKENS = {w.lower() for w in _catalog["version_tokens"]}

_YEAR_RE = re.compile(r"\b(19|20)\d{2}\b")
_SIZE_RE = re.compile(r"\b(size|talla|tamanho|tam|号)?\s*\d{1,2}([.,]\d)?\s*(us|uk|eu|jp)?\b", re.IGNORECASE)

# Palavras que indicam que o produto É uma chuteira/bota.
_BOOT_WORDS = ["boot", "cleat", "chuteira", "botin", "botín", "bota", "spike"]
# Palavras que indicam acessório/vestuário/equipamento -- não é chuteira,
# mesmo que apareça na mesma coleção ou busca da loja.
_NON_BOOT_WORDS = [
    "jersey", "shirt", "camisa", "camiseta", "ball", "bola", "pelota",
    "sock", "socks", "meia", "meiao", "meião", "glove", "luva",
    "mouthguard", "protetor bucal", "protector bucal", "headguard",
    "capacete", "short", "calcao", "calção", "bermuda", "legging",
    "cone", "pump", "bomba", "tackle bag", "scrum bag", "training bib",
    "colete", "whistle", "apito", "polish", "shoelace", "shoelaces",
    "cadarco", "cadarço", "insole", "palmilha", "backpack", "mochila",
    "bag", "bolsa", "towel", "toalha", "cap", "beanie", "gorro",
    "gift card", "gift voucher", "e-gift", "vale-presente", "tarjeta de regalo",
]


_FIRM_GROUND_RE = re.compile(r"\bfg\b|firm\s*ground", re.IGNORECASE)
_JUNIOR_RE = re.compile(r"\bjunior\b|\bjuniors\b|\bkids?\b|\byouth\b", re.IGNORECASE)


def is_firm_ground(text: str) -> bool:
    """True quando o texto (título + pista extra) indica solado Firm
    Ground -- "FG" isolado (com limite de palavra, pra não confundir com
    sigla dentro de outra palavra) ou "Firm Ground" por extenso."""
    return bool(_FIRM_GROUND_RE.search(text))


def is_junior(text: str) -> bool:
    """True quando o texto indica chuteira infantil/juvenil (Junior,
    Kids, Youth)."""
    return bool(_JUNIOR_RE.search(text))


def is_rugby_boot(title: str, extra: str = "") -> bool:
    """True quando o título (+ pista extra, ex: product_type da Shopify)
    parece ser de uma chuteira de rugby, e não de outro produto (bola,
    camisa, acessório) que tenha aparecido junto na coleção/busca de uma
    loja.

    Muitas lojas Shopify (ex: World Rugby Shop) não repetem "boot" no
    título -- só marca + modelo + cor (ex: "adidas Kakari SG - Core
    Black/Zero Metallic/Silver Metallic") -- e contam com a categoria do
    produto para dizer o que é. `extra` carrega essa categoria
    (`product_type`) quando disponível, como sinal adicional além do
    título."""
    t = f"{title} {extra}".lower()
    if any(word in t for word in _NON_BOOT_WORDS):
        return False
    return any(word in t for word in _BOOT_WORDS)


def normalize_title(title: str) -> dict:
    """Retorna {brand, model, version} a partir de um título de produto.

    Heurística best-effort: encontra a primeira marca conhecida no texto,
    remove ruído (tamanhos, gênero, palavras genéricas) do restante e usa
    as primeiras palavras significativas como "modelo", com tokens de
    versão conhecidos (ano, Elite/Pro/Team, V1/V2...) destacados à parte.
    """
    clean = title.strip()
    lower = clean.lower()

    brand = next((b for b in _BRANDS if b.lower() in lower), None)

    working = clean
    if brand:
        working = re.sub(re.escape(brand), "", working, flags=re.IGNORECASE)

    working = _SIZE_RE.sub(" ", working)

    words = [w for w in re.split(r"[\s\-/]+", working) if w]
    version_parts = []
    model_parts = []
    for w in words:
        wl = w.lower().strip(",.()[]")
        if not wl or wl in _NOISE:
            continue
        if wl in _VERSION_TOKENS or _YEAR_RE.fullmatch(wl):
            version_parts.append(w)
        else:
            model_parts.append(w)

    model = " ".join(model_parts[:4]).strip() or "Modelo não identificado"
    version = " ".join(version_parts).strip() or "Padrão"

    return {
        "brand": brand or "Outra marca",
        "model": model,
        "version": version,
    }


def group_key(brand: str, model: str, version: str) -> str:
    return f"{brand}|{model}|{version}".lower()
