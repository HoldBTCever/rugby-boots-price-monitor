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
# Só remove um número quando vem com uma palavra de tamanho do lado (prefixo
# "size"/"tamanho"/... ou sufixo "us"/"uk"/"eu"/"jp") -- exigir os dois
# opcionais ao mesmo tempo (como era antes) apagava qualquer número solto de
# 1-2 dígitos sem contexto nenhum, o que comia números de versão de verdade
# ("Phoenix 2.0" virava "Phoenix", "RS-15" virava "RS", "Neo 4" virava "Neo").
_SIZE_RE = re.compile(
    r"\b(?:size|talla|tamanho|tam|号)\s*\d{1,2}(?:[.,]\d)?\b"
    r"|\b\d{1,2}(?:[.,]\d)?\s*(?:us|uk|eu|jp)\b",
    re.IGNORECASE,
)

# Muitas lojas (ex: World Rugby Shop, Rugbystuff) põem a cor no final do
# título depois de um hífen: "adidas Kakari Elite SG Rugby Boots - Team
# Royal Blue". Sem isso, "Team" (nome de cor da adidas, tipo "Team Royal
# Blue"/"Team Solar Orange") é lido como o token de versão "Team" -- uma
# chuteira "Elite" vira "Elite Team" por engano -- e palavras da cor
# ("Royal", "Solar", "Galaxy"...) viram parte do "modelo" por não
# estarem na lista de ruído. Só a última parte depois do hífen é
# descartada (exige que comece com letra, não dígito, pra não cortar
# sufixo numérico tipo "-15"/"X-15").
_COLORWAY_SUFFIX_RE = re.compile(r"\s*-\s*[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ/ ]*$")

# Mesmo problema, mas sem hífen algum: o feed products.json da Shopify
# costuma trazer o título sem separador nenhum antes da cor (o hífen que
# aparece na página é só formatação do tema) -- ex: "Adidas Kakari Elite
# SG Rugby Boots Team Royal Blue". "Team" da adidas sempre vem seguido
# de uma cor (talvez com um adjetivo no meio: "Team Solar Orange"); a
# versão "Team" de verdade (Canterbury Stampede Team, Speed Falcon Team)
# nunca é seguida de cor. Remove só quando bate esse padrão específico.
_COLOR_WORDS = [
    "black", "white", "red", "blue", "gold", "silver", "navy", "green",
    "yellow", "orange", "purple", "grey", "gray", "pink", "multi",
    "preto", "branco", "vermelho", "azul", "dourado", "prata", "verde",
    "amarelo", "laranja", "roxo", "cinza", "rosa",
    "negro", "blanco", "rojo", "amarillo", "gris", "morado",
]
_ADIDAS_TEAM_COLOR_RE = re.compile(
    r"\bteam\s+(?:[A-Za-zÀ-ÿ]+\s+)?(?:" + "|".join(_COLOR_WORDS) + r")\b",
    re.IGNORECASE,
)

# O nome oficial da adidas pra essa linha é "adizero RS15" (confirmado via
# news.adidas.com) -- mas cada loja escreve diferente: "RS15", "RS 15",
# "RS-15", com ou sem "Adizero" na frente. Sem isso, o mesmo produto virava
# vários grupos diferentes ("Adizero RS15" x "RS 15" x "Rs15"...). Canoniza
# pra "Adizero RS15" sempre, ANTES de separar em palavras.
_RS15_CANON_RE = re.compile(r"\b(?:adizero\s+)?rs[\s-]?15\b", re.IGNORECASE)

# "Solar Turbo" é nome de cor da adidas (sempre aparece grudado numa cor de
# verdade, ex: "Solar Turbo Pink") -- não é um tier real como "Elite"/"Pro",
# mas como não começa com "Team" o _ADIDAS_TEAM_COLOR_RE acima não pega.
_ADIDAS_SOLAR_TURBO_RE = re.compile(r"\bsolar\s+turbo\b", re.IGNORECASE)

# Alguns feeds (Rugby Goods/Japão) trazem o código interno da loja colado
# no fim do título (ex: ".../JP8792", ".../IH2756") -- não é parte do nome
# do produto, é SKU. Só descarta palavras que são só isso: 1-3 letras
# seguidas de 4-6 dígitos (não bate em "RS15"/"8S"/"V1"/"X9", que são
# tokens de modelo/versão de verdade).
_SKU_CODE_RE = re.compile(r"^[A-Za-z]{1,3}\d{4,6}$")

# Palavras que indicam que o produto É uma chuteira/bota.
_BOOT_WORDS = ["boot", "cleat", "chuteira", "botin", "botín", "bota", "spike", "ブーツ", "スパイク"]
# Palavras que indicam acessório/vestuário/equipamento -- não é chuteira,
# mesmo que apareça na mesma coleção ou busca da loja. Necessário mesmo
# quando o site já filtra por categoria (trust_category em sites.json,
# ex: Rugby Goods/Japão): a própria busca "boots" da loja japonesa incluiu
# um chaveiro ("...ブーツキーリング") junto com chuteiras de verdade.
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
    "キーリング", "キーホルダー", "ジャージ", "ボール", "ソックス", "靴下", "グローブ",
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
    ("Couro canguru", re.compile(r"kangaroo|canguru|カンガルー", re.IGNORECASE)),
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
    if is_explicitly_non_boot(t):
        return False
    return any(word in t for word in _BOOT_WORDS)


def is_explicitly_non_boot(text: str) -> bool:
    """True quando o texto menciona explicitamente um item que não é
    chuteira (bola, camisa, acessório...). Usado tanto por is_rugby_boot()
    quanto isoladamente em scrape.py para sites com trust_category=true:
    confiar que a coleção/busca da loja é só de chuteiras não deveria
    deixar passar um item claramente não-chuteira que tenha vazado pra lá
    por engano (ex: um chaveiro na busca "boots" da Rugby Goods/Japão)."""
    return any(word in text.lower() for word in _NON_BOOT_WORDS)


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

    working = _COLORWAY_SUFFIX_RE.sub("", working)
    working = _ADIDAS_TEAM_COLOR_RE.sub("", working)
    working = _ADIDAS_SOLAR_TURBO_RE.sub("", working)
    working = _RS15_CANON_RE.sub("Adizero RS15", working)
    working = _SIZE_RE.sub(" ", working)

    words = [w for w in re.split(r"[\s\-/]+", working) if w]
    version_parts = []
    model_parts = []
    for w in words:
        wl = w.lower().strip(",.()[]")
        if not wl or wl in _NOISE or _SKU_CODE_RE.match(w.strip(",.()[]")):
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
