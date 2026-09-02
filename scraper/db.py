"""Carrega data/price_history.csv num SQLite em memória, só pra rodar as
agregações pesadas (média por modelo, série por data, contagem de
solado/cabedal/trava) via SQL em vez de laço Python manual.

O CSV continua sendo a fonte de verdade committada no git -- é texto puro,
então dois runs concorrentes do scraper (ex: o scrape normal e o empurrão
do agendador) resolvem conflito de merge linha a linha sozinhos, sem
precisar de lock nem de ferramenta binária. Este banco é reconstruído do
zero a cada execução de scraper/aggregate.py, só existe em memória
(":memory:") e nunca é salvo em disco nem commitado -- é puramente uma
camada de consulta por cima do CSV já lido.

scraper/aggregate.py é o único consumidor.
"""
from __future__ import annotations

import sqlite3

from .normalize import group_key

CSV_FIELDS = [
    "block_height", "timestamp", "date", "site_id", "site_name", "region",
    "brand", "model", "version", "title", "price_local", "currency",
    "price_usd", "url", "ground_type", "upper_material", "stud_type",
]

# Todas as colunas são TEXT (sem afinidade numérica) de propósito: preserva
# os valores exatamente como o csv.DictReader os devolveria (string, ""
# pra campo vazio) quando lidos de volta via `dict(row)`. As agregações
# numéricas (AVG/MIN/etc.) fazem CAST(... AS REAL) explícito na própria
# consulta, então não dependem da coluna ter afinidade REAL.
_SCHEMA = f"""
CREATE TABLE price_history (
    {", ".join(f"{field} TEXT" for field in CSV_FIELDS)},
    group_key TEXT
);
CREATE INDEX idx_price_history_date ON price_history(date);
CREATE INDEX idx_price_history_group_key ON price_history(group_key);
"""


def build(rows: list[dict]) -> sqlite3.Connection:
    """Cria o banco em memória e insere `rows` (a mesma lista de dict que
    csv.DictReader produz a partir de data/price_history.csv) na ordem
    recebida -- o rowid implícito do SQLite acompanha essa ordem, usado
    depois pra achar "a primeira linha de cada grupo" (MIN(rowid)) e pra
    manter o desempate do Counter.most_common() idêntico ao do código
    anterior, que também iterava rows nessa mesma ordem."""
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.executescript(_SCHEMA)

    columns = ", ".join(CSV_FIELDS + ["group_key"])
    placeholders = ", ".join(f":{field}" for field in CSV_FIELDS + ["group_key"])
    conn.executemany(
        f"INSERT INTO price_history ({columns}) VALUES ({placeholders})",
        (
            {
                **{field: row.get(field, "") for field in CSV_FIELDS},
                "group_key": group_key(row.get("brand", ""), row.get("model", ""), row.get("version", "")),
            }
            for row in rows
        ),
    )
    conn.commit()
    return conn
