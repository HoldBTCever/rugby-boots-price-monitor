"""Suíte de regressão pra scraper/db.py -- a camada SQLite em memória que
scraper/aggregate.py passou a usar pra rodar as agregações (média/série
por data) via SQL em vez de laço Python manual, mantendo
data/price_history.csv como fonte de verdade committada.

Cobre especificamente o bug real achado durante a migração: sem ORDER BY
explícito pelo rowid da primeira ocorrência de cada grupo, a ordem dos
grupos no dict final de aggregate.py ficava arbitrária -- quebrava o
desempate do sort estável de `models` quando duas versões do mesmo
brand+model empatam em discount_pct (a chave de sort não inclui version)."""
from scraper import db


def _row(brand, model, version, price_usd, date="2026-01-01", **extra):
    base = {
        "block_height": "1", "timestamp": f"{date}T00:00:00", "date": date,
        "site_id": "x", "site_name": "Loja X", "region": "Test",
        "brand": brand, "model": model, "version": version,
        "title": f"{brand} {model} {version}", "price_local": str(price_usd),
        "currency": "USD", "price_usd": str(price_usd), "url": "https://example.com/p",
        "ground_type": "", "upper_material": "", "stud_type": "",
    }
    base.update(extra)
    return base


def test_group_key_agrupa_marca_modelo_versao_ignorando_maiusculas():
    rows = [_row("Adidas", "Kakari", "Elite", 100), _row("adidas", "kakari", "elite", 200)]
    conn = db.build(rows)
    n = conn.execute("SELECT COUNT(DISTINCT group_key) FROM price_history").fetchone()[0]
    assert n == 1


def test_primeira_linha_de_cada_grupo_respeita_ordem_de_insercao_do_csv():
    """Duas versões do mesmo modelo (Kaizen 1.0 e 2.0) precisam sair na
    mesma ordem em que apareceram pela primeira vez no CSV -- é essa ordem
    que decide a posição relativa delas no JSON final quando empatam no
    sort de `models` (mesmo discount_pct, mesma brand, mesmo model)."""
    rows = [
        _row("Gilbert", "Kaizen", "1.0", 100),
        _row("Gilbert", "Kaizen", "2.0", 200),
        _row("Gilbert", "Kaizen", "1.0", 110),  # segunda ocorrência do 1.0, não deve reordenar
    ]
    conn = db.build(rows)
    result = conn.execute(
        """
        SELECT ph.group_key FROM price_history ph
        JOIN (
            SELECT group_key, MIN(rowid) AS first_rowid FROM price_history GROUP BY group_key
        ) f ON ph.rowid = f.first_rowid
        ORDER BY f.first_rowid
        """
    ).fetchall()
    assert [r["group_key"] for r in result] == ["gilbert|kaizen|1.0", "gilbert|kaizen|2.0"]


def test_colunas_preservam_valor_como_texto_igual_csv_dictreader():
    """price_usd (e as demais colunas) voltam como string, não float --
    precisa bater com o que csv.DictReader devolvia antes, já que o
    resto de aggregate.py faz float(row["price_usd"]) explicitamente em
    vários lugares (ex: _build_watchlist)."""
    rows = [_row("Canterbury", "Stampede", "Pro", 149.99)]
    conn = db.build(rows)
    row = conn.execute("SELECT * FROM price_history").fetchone()
    assert isinstance(row["price_usd"], str)
    assert row["price_usd"] == "149.99"


def test_soma_dividida_por_contagem_bate_com_media_simples():
    rows = [_row("Oxen", "Raptor", "Pro", p) for p in (10.0, 20.0, 30.0)]
    conn = db.build(rows)
    total, n = conn.execute(
        "SELECT SUM(CAST(price_usd AS REAL)), COUNT(*) FROM price_history"
    ).fetchone()
    assert round(total / n, 2) == 20.0
