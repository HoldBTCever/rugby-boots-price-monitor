# Monitor de Preços — Chuteiras de Rugby

Coleta diária de preços de chuteiras de rugby em lojas de várias regiões,
calcula a média histórica por modelo/versão, publica um site com o
histórico em gráfico e destaca qualquer chuteira **39,5% ou mais abaixo**
da sua média.

## Como funciona

```
scraper/scrape.py      -> visita cada loja configurada, extrai produtos e preços,
                           converte para USD e adiciona uma linha em data/price_history.csv
scraper/aggregate.py   -> calcula a média móvel (90 dias) por modelo/versão,
                           gera data/daily_summary.json e data/alerts.json
site/                  -> painel estático (HTML/CSS/JS + Chart.js) que lê esses JSONs
.github/workflows/     -> roda os dois scripts todo dia e publica o site no GitHub Pages
```

Nenhum dado é inventado: o repositório é publicado com o histórico vazio e o
próprio painel mostra um aviso "ainda sem coleta" até a primeira execução do
workflow rodar de verdade contra as lojas.

## Lojas monitoradas

| Região | Loja | Adaptador |
|---|---|---|
| EUA | World Rugby Shop, Rugby Imports | JSON-LD (schema.org Product) |
| Europa (Reino Unido / França) | Lovell Rugby, Decathlon | JSON-LD |
| Argentina | MercadoLibre Argentina (busca "botines de rugby") | HTML da busca |
| Paraguai | MercadoLibre Paraguay (busca "botines de rugby") | HTML da busca |

Sem fonte para o Japão no momento — a Rakuten Ichiba foi removida por falta
de confiabilidade dos dados extraídos. Se quiser, dá pra adicionar outro
site japonês depois (ex.: loja oficial de uma marca) em `scraper/sites.json`.

Adicione, remova ou ajuste lojas em `scraper/sites.json` — cada entrada
define região, moeda, URL(s) de listagem e qual adaptador usar
(`scraper/adapters.py`). Sites que expõem dados estruturados schema.org
(`shopify_jsonld` / `generic_jsonld`) são os mais estáveis, pois não
dependem de classes CSS que mudam a cada redesign.

Toda listagem passa por `normalize.is_rugby_boot()` antes de entrar no
histórico: produtos cujo título bate com palavras de bola, camisa,
acessório etc. (mesmo vindos da coleção/busca "certa" de uma loja) são
descartados, para o site só mostrar chuteiras de fato.

## Como o preço é normalizado

`scraper/normalize.py` extrai marca, modelo e versão do título de cada
produto usando uma lista de marcas conhecidas (`scraper/catalog.json`) e
remove ruído (tamanho, cor, gênero). É uma heurística — ajuste
`catalog.json` se notar produtos agrupados incorretamente.

Preços são convertidos para USD com as taxas de
[open.er-api.com](https://open.er-api.com) (cache de 1 dia em
`data/fx_cache.json`).

## O alerta de oferta

Em `scraper/config.py`:

```python
DEAL_THRESHOLD_PCT = 0.395          # 39,5%
AVERAGE_WINDOW_DAYS = 90            # janela da média histórica
MIN_OBSERVATIONS_FOR_ALERT = 2      # mínimo de observações para confiar na média
```

Um modelo/versão vira "oferta" quando o menor preço encontrado no dia está
`>= 39,5%` abaixo da média dos últimos 90 dias daquele mesmo modelo/versão,
desde que já existam pelo menos 2 observações históricas (evita alertar
com base em um único preço).

## Rodar localmente

```bash
pip install -r requirements.txt
python -m scraper.scrape       # coleta os preços de hoje
python -m scraper.aggregate    # recalcula médias e alertas
python -m http.server 8000 --directory site   # abre em localhost:8000
```

## Automação diária (GitHub Actions)

O workflow `.github/workflows/daily-price-check.yml` roda sozinho, sem
precisar clicar em nada, em três situações:

1. todo dia às 09:00 UTC (`schedule`);
2. a cada push que muda `scraper/`, `site/` (exceto `site/data/`, que é
   gerado pelo próprio workflow) ou o workflow em si — útil pra validar
   uma correção do scraper sem precisar disparar manualmente;
3. manualmente também é possível, em **Actions → daily-price-check →
   Run workflow**, se quiser forçar uma coleta fora do horário.

Em cada execução: roda `scrape.py` + `aggregate.py`, faz commit dos
JSONs/CSV atualizados de volta no branch padrão e publica `site/`
(já com os dados novos) no GitHub Pages.

**Uma configuração manual única, feita pelo dono do repositório:** em
Settings → Pages, defina Source = "GitHub Actions" (uma vez só; depois
disso o deploy é sempre automático). Como este repositório já nasce com
o workflow no branch padrão (`main`), o `schedule` diário funciona sem
nenhum outro passo.

## Limitações conhecidas

- Raspagem de HTML quebra quando a loja muda o layout — o workflow
  continua rodando mesmo se um site falhar (erro só daquele site fica
  registrado em `data/last_run.json`), mas vale revisar `sites.json`
  periodicamente.
- Sites que só carregam preços via JavaScript (sem HTML estático nem
  JSON-LD) não são suportados pelos adaptadores atuais.
- A normalização marca/modelo/versão é best-effort; produtos com títulos
  muito genéricos podem cair em "Modelo não identificado".
