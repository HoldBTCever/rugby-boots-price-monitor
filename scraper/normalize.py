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


_GROUND_TYPE_PATTERNS = [
    ("Soft Ground", re.compile(r"\bsg\b|soft\s*ground", re.IGNORECASE)),
    ("Artificial Ground", re.compile(r"\bag\b|artificial\s*ground", re.IGNORECASE)),
    ("Hard Ground", re.compile(r"\bhg\b|hard\s*ground", re.IGNORECASE)),
    ("Firm Ground", re.compile(r"\bfg\b|firm\s*ground", re.IGNORECASE)),
]

# Cabedal (material do upper) e travas (tipo/composição das travas) quase
# nunca aparecem no título -- a maioria das lojas só põe marca/modelo/cor.
# Só preenche quando o texto menciona explicitamente uma dessas palavras;
# quando não bate em nada, fica None (o site mostra "não informado" em vez
# de inventar um material/trava que a fonte não confirmou).
_UPPER_MATERIAL_PATTERNS = [
    ("Couro canguru", re.compile(r"kangaroo|canguru", re.IGNORECASE)),
    ("Couro", re.compile(r"\bleather\b|\bcouro\b|\bcuero\b", re.IGNORECASE)),
    ("Sintético", re.compile(r"\bsynthetic\b|sint[ée]tico", re.IGNORECASE)),
    ("Mesh/Knit", re.compile(r"\bmesh\b|\bknit\b", re.IGNORECASE)),
]
_STUD_MATERIAL_PATTERNS = [
    ("Alumínio", re.compile(r"aluminium|aluminum|alum[ií]nio", re.IGNORECASE)),
    ("Rosqueável", re.compile(r"screw-?in", re.IGNORECASE)),
    ("Moldadas", re.compile(r"moulded|moldadas?|moldeado", re.IGNORECASE)),
]
_STUD_COUNT_RE = re.compile(r"\b(\d{1,2})\s*(stud|studs|tapon|tapones|trava|travas)\b", re.IGNORECASE)


def extract_ground_type(text: str) -> str | None:
    """Tipo de solado (Soft/Artificial/Hard/Firm Ground) a partir do
    título -- é o que a maioria das lojas realmente informa (SG/FG/AG/HG
    ou o nome por extenso)."""
    for label, pattern in _GROUND_TYPE_PATTERNS:
        if pattern.search(text):
            return label
    return None


def extract_upper_material(text: str) -> str | None:
    """Material do cabedal, só quando o título menciona explicitamente
    (cobertura baixa -- a maioria das lojas não informa isso no título)."""
    for label, pattern in _UPPER_MATERIAL_PATTERNS:
        if pattern.search(text):
            return label
    return None


def extract_stud_type(text: str) -> str | None:
    """Tipo/material das travas e, se mencionado, a quantidade -- só
    quando o título traz essa informação explicitamente (cobertura baixa)."""
    material = next((label for label, pattern in _STUD_MATERIAL_PATTERNS if pattern.search(text)), None)
    count_match = _STUD_COUNT_RE.search(text)
    count = count_match.group(1) if count_match else None
    if material and count:
        return f"{count} travas ({material})"
    if material:
        return material
    if count:
        return f"{count} travas"
    return None


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
