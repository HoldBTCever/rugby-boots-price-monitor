"""Suíte de regressão pra scraper/aggregate.py -- por enquanto só
_build_fx_rates(), a função nova que expõe a cotação do dia (já
cacheada por scraper/fx.py em data/fx_cache.json) pro seletor de moeda
de exibição do site."""
import json

from scraper import aggregate, config


def test_build_fx_rates_filtra_so_as_moedas_configuradas(tmp_path, monkeypatch):
    cache_path = tmp_path / "fx_cache.json"
    cache_path.write_text(json.dumps({
        "date": "2026-09-02",
        "rates": {"USD": 1.0, "BRL": 5.42, "EUR": 0.92, "CAD": 1.36, "CHF": 0.88},
    }), encoding="utf-8")
    monkeypatch.setattr(config, "FX_CACHE_JSON", cache_path)
    monkeypatch.setattr(config, "DISPLAY_CURRENCIES", ["USD", "BRL", "EUR", "JPY"])

    result = aggregate._build_fx_rates()

    assert result["date"] == "2026-09-02"
    assert result["rates"] == {"USD": 1.0, "BRL": 5.42, "EUR": 0.92}
    assert "CAD" not in result["rates"] and "CHF" not in result["rates"]


def test_build_fx_rates_sem_cache_devolve_vazio(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "FX_CACHE_JSON", tmp_path / "nao-existe.json")
    result = aggregate._build_fx_rates()
    assert result == {"date": None, "rates": {}}
