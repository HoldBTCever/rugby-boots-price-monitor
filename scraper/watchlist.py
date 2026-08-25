"""Lista fixa de modelos acompanhados na aba "Histórico" do site.

Casa contra o título bruto do produto (não contra marca/modelo já
normalizados) porque a normalização é uma heurística com espaço pra
erro -- pra uma lista curada e pequena como esta, procurar as palavras-
chave direto no título original é mais confiável.
"""
from __future__ import annotations

import json
import re

from . import config

_FOLD_RE = re.compile(r"[^a-z0-9]+")


def _fold(text: str) -> str:
    return _FOLD_RE.sub("", text.lower())


def load_watchlist() -> list[dict]:
    return json.loads(config.WATCHLIST_CONFIG.read_text(encoding="utf-8"))


def matches(title: str, keywords: list[str]) -> bool:
    folded_title = _fold(title)
    return all(_fold(kw) in folded_title for kw in keywords)
