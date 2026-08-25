# Monitor de Preços — Chuteiras de Rugby

Coleta preços de chuteiras de rugby em lojas de várias regiões a cada
**bloco novo minerado no Bitcoin** (~10 em 10 minutos), calcula a média
histórica por modelo/versão, publica um site com o histórico em gráfico
e destaca qualquer chuteira **39,5% ou mais abaixo** da sua média.

## Como funciona

```
scraper/bitcoin.py     -> consulta a altura do bloco atual na mempool.space
scraper/scrape.py      -> só roda de verdade se o bloco mudou desde a última coleta;
                           visita cada loja configurada, extrai produtos e preços,
                           converte para USD e adiciona uma linha em data/price_history.csv
                           (com o bloco e o timestamp em America/Asuncion)
scraper/aggregate.py   -> calcula a média móvel (90 dias) por modelo/versão,
                           gera data/daily_summary.json, data/alerts.json e
                           data/watchlist.json (lista fixa de modelos, aba "Histórico",
                           agrupado por bloco)
site/                  -> painel estático (HTML/CSS/JS + Chart.js) que lê esses JSONs
.github/workflows/     -> faz polling a cada 5 min e publica o site no GitHub Pages
```

Nenhum dado é inventado: o repositório é publicado com o histórico vazio e o
próprio painel mostra um aviso "ainda sem coleta" até a primeira execução do
workflow rodar de verdade contra as lojas.

## Lojas monitoradas

| Região | Loja | Adaptador |
|---|---|---|
| EUA | World Rugby Shop, Rugby Imports | `/products.json` (catálogo Shopify) |
| Europa (Reino Unido) | Lovell Rugby, Gilbert Rugby, Absolute Rugby, JustRugby, Rugby Heaven | `/products.json` (catálogo Shopify) |
| Europa (Reino Unido) | Canterbury, Pro:Direct Rugby, Rugbystore.co.uk, Kitlocker | JSON-LD |
| Europa (Espanha) | TradeInn | JSON-LD |
| Japão | Mizuno Japan, Rugby Goods (Rugby Online Japan) | HTML da categoria / JSON-LD |
| Argentina | MercadoLibre Argentina (busca "botines de rugby"), Durban Rugby, Rugbier Store | HTML da busca / JSON-LD |
| Paraguai | MercadoLibre Paraguay (busca "botines de rugby") | HTML da busca |

A Rakuten Ichiba foi removida por falta de confiabilidade dos dados
extraídos. A Decathlon foi removida por bloqueio anti-bot ativo (HTTP
403 confirmado nos logs) — não faz sentido continuar tentando nem
contornar o bloqueio. A Lovell Rugby migrou de domínio (`lovellrugby.co.uk`
→ `lovellsports.com`), o que explica por que ficou muda por um tempo.

Canterbury USA (`canterburyusa.com`) não entrou como fonte separada:
é operada pela própria World Rugby Shop (mesmo grupo, catálogo
essencialmente idêntico) — adicioná-la contaria a mesma loja duas vezes
na média de preço. Duas lojas de indumentária argentina pesquisadas
(Webb Ellis Shop, Rugby Shop) não entraram porque não foi possível
confirmar que vendem chuteira (parecem só roupa/acessório).

Algumas fontes novas (Canterbury, Pro:Direct Rugby, Rugbystore.co.uk,
Kitlocker, Rugby Goods) usam `generic_jsonld` com o padrão de link de
produto ainda não 100% confirmado — podem devolver 0 resultados até o
padrão real ser validado nos logs do Actions; isso é preferível a
inventar dado.

Adicione, remova ou ajuste lojas em `scraper/sites.json` — cada entrada
define região, moeda, URL(s) de listagem e qual adaptador usar
(`scraper/adapters.py`). Sites que expõem dados estruturados schema.org
(`shopify_jsonld` / `generic_jsonld`) são os mais estáveis, pois não
dependem de classes CSS que mudam a cada redesign.

Sites com `"supports_search": true` (hoje: World Rugby Shop, Rugby
Imports, Lovell Rugby, Gilbert Rugby, Absolute Rugby, JustRugby, Rugby
Heaven — todas Shopify confirmado) também recebem uma **busca ativa**
por cada item da
`scraper/watchlist.json`, via API nativa de busca do Shopify
(`/search/suggest.json`) — não depende só do item aparecer sozinho na
varredura geral do catálogo. Se uma loja não vende aquele modelo
específico, a busca não vai achar nada, e é isso mesmo: mais confiável
do que inventar um resultado.

Toda listagem passa por `normalize.is_rugby_boot()` antes de entrar no
histórico: produtos cujo título bate com palavras de bola, camisa,
acessório etc. (mesmo vindos da coleção/busca "certa" de uma loja) são
descartados, para o site só mostrar chuteiras de fato.

Exceção: `"trust_category": true` numa entrada de `sites.json` marca uma
`listing_url` confirmada manualmente como categoria dedicada só a
chuteira (ex: Durban Rugby e Rugbier Store `/rugby/botines/`) — nesse
caso pula o filtro por palavra-chave, porque um título sem "chuteira"/
"botin" explícito ainda pode ser chuteira de verdade (mesmo problema que
travava os Kakari da World Rugby Shop antes do fix de `product_type`).
Use só quando tiver certeza de que a página é 100% chuteira.

## Filtro de tamanho (US 9–12)

Só entram no histórico chuteiras disponíveis em algum tamanho entre
**US 9 e US 12** (masculino) — configurável em `config.MIN_US_SIZE` /
`config.MAX_US_SIZE`. Isso só é possível com precisão nas lojas Shopify
(World Rugby Shop, Rugby Imports, Lovell Rugby, Gilbert Rugby, Absolute
Rugby, JustRugby, Rugby Heaven), porque a Shopify expõe o tamanho de
cada variante do produto; o preço salvo é o menor entre as variantes
disponíveis dentro da faixa, e um produto sem nenhum tamanho ali é
descartado inteiro. Lojas do Reino Unido numeram no padrão britânico —
convertido para americano somando 1 (aproximação padrão UK→US
masculino: UK 7 = US 8, UK 11 = US 12).

As demais fontes (MercadoLibre, JSON-LD genérico como Canterbury/
Pro:Direct/Rugbystore/Kitlocker/Rugby Goods/Durban Rugby/Rugbier Store/
TradeInn, Mizuno Japan) não expõem tamanho por variante nos dados que os
adaptadores capturam hoje — continuam contribuindo sem esse filtro,
porque descartá-las por completo derrubaria fontes que já encontraram
itens reais da watchlist (ex: MercadoLibre Argentina achou a Mizuno
Waitangi e a Canterbury Stampede). Se isso não for aceitável, ou se
quiser que essas fontes também sejam restritas a US 9–12 assim que eu
conseguir extrair tamanho delas, é só pedir.

## Filtros de solado e faixa etária

`normalize.is_firm_ground()` e `normalize.is_junior()` (aplicados em
`scrape.py`, para toda listagem de toda loja, independente do
adaptador) descartam:

- **Firm Ground**: título ou categoria contendo "FG" (como palavra
  isolada) ou "Firm Ground" por extenso. Chuteira Soft Ground (SG),
  Artificial Ground (AG) etc. não é afetada.
- **Infantil/juvenil**: título ou categoria contendo "Junior", "Kids"
  ou "Youth".

Essas duas checagens são independentes do filtro de tamanho (US 9–12) e
valem pra toda fonte, inclusive as que não têm dado de tamanho por
variante.

**Quando o título não denuncia:** alguns produtos são infantis sem
dizer "kids"/"junior" em lugar nenhum do título (ex: "Canterbury Speed
Rugby Boot" na Lovell Sports — só o breadcrumb do site, "ALL KIDS
PRODUCTS", revela isso). Pra esses casos, `"kids_collection_url"` numa
entrada de `sites.json` (hoje só Lovell Rugby,
`/collections/kids-rugby-boots`) aponta pra coleção infantil dedicada
da própria loja — o scraper busca os handles de produto dessa coleção
uma vez por execução e exclui qualquer produto com esse handle, onde
quer que apareça (catálogo geral ou busca ativa), independente do que
o título diz. Se o mesmo problema aparecer em outra loja, é só achar a
coleção "kids" real dela e adicionar o mesmo campo.

## Como o preço é normalizado

`scraper/normalize.py` extrai marca, modelo e versão do título de cada
produto usando uma lista de marcas conhecidas (`scraper/catalog.json`) e
remove ruído (tamanho, cor, gênero). É uma heurística — ajuste
`catalog.json` se notar produtos agrupados incorretamente.

Tipo de solado (SG/FG/AG/HG) é tratado como ruído, não como parte da
versão — "Canterbury Stampede Team SG" e "Canterbury Stampede Team"
caem no mesmo grupo/média, em vez de virarem "Team" e "Team SG"
separados (mesma lógica pra "Elite" vs "Elite SG"). Faz sentido porque
chuteira Firm Ground já é excluída à parte (seção acima), então o
solado que sobra não é uma distinção que valha a pena separar no
agrupamento.

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

## Aba "Histórico" (lista fixa de modelos, por bloco)

Além do painel principal (todos os modelos encontrados), o site tem uma
aba **Histórico** com uma lista fixa de modelos específicos —
independente do que a coleta encontrar no resto do catálogo. Cada vez
que um bloco novo é processado, fica registrado ali: **bloco** (da
mempool.space), **data/hora** (fuso `America/Asuncion`), **preço
médio**, **maior preço** (+ site) e **menor preço** (+ site) — uma
linha de histórico por bloco, uma linha no gráfico por versão.

Editável em `scraper/watchlist.json`:

```json
{ "label": "Canterbury Stampede", "match": ["canterbury", "stampede"] }
```

`match` são palavras-chave (sem acento/pontuação) que precisam **todas**
aparecer no título bruto do produto — não no modelo/versão já
normalizados, que são só uma heurística. Cada versão encontrada
(Team/Elite/Pro/...) vira uma linha separada no gráfico do card. O tipo
de solado (SG/FG/AG/HG) não conta como versão à parte — "Team" e
"Team SG" caem no mesmo grupo (ver "Como o preço é normalizado" abaixo).

## Rodar localmente

```bash
pip install -r requirements.txt
python -m scraper.scrape       # coleta se o bloco do Bitcoin mudou desde a última vez
python -m scraper.aggregate    # recalcula médias, alertas e o histórico por bloco
python -m http.server 8000 --directory site   # abre em localhost:8000
```

## Automação por bloco (GitHub Actions)

O workflow `.github/workflows/daily-price-check.yml` faz *polling* a
cada 5 minutos (o mínimo que o GitHub Actions permite) só pra checar a
altura do bloco atual do Bitcoin. `scrape.py` compara com o último
bloco registrado em `data/price_history.csv`:

- **bloco igual** → não bate nas lojas, não gera commit, não republica
  o site (o job termina em poucos segundos);
- **bloco novo** (o caso comum, já que blocos saem a cada ~10 min) →
  raspa as lojas de verdade, recalcula tudo, commita e publica.

Também roda a cada push que muda `scraper/`, `site/` (exceto
`site/data/`, gerado pelo próprio workflow) ou o workflow em si — útil
pra validar uma correção sem esperar o próximo bloco — e manualmente em
**Actions → daily-price-check → Run workflow**.

**Uma configuração manual única, feita pelo dono do repositório:** em
Settings → Pages, defina Source = "GitHub Actions" (uma vez só; depois
disso o deploy é sempre automático). Como este repositório já nasce com
o workflow no branch padrão (`main`), o polling funciona sem nenhum
outro passo.

**Isso significa bater nas lojas de varejo a cada ~10 minutos, o dia
inteiro** (antes era 1x/dia) — bem mais agressivo. O GitHub Actions em
si não cobra por isso (repositório público tem minutos ilimitados), mas
é uma frequência real de requisições contra sites de terceiros; se
algum deles começar a bloquear/limitar o bot por causa disso, o
sintoma vai aparecer como HTTP 403/429 nos logs do job "scrape".

**Raspagem em paralelo:** `scraper/scrape.py` raspa até
`config.SCRAPE_WORKERS` (6) lojas ao mesmo tempo, cada uma numa
thread — como são domínios diferentes, isso não sobrecarrega nenhum
site individual (o intervalo educado entre requisições ao *mesmo*
site continua valendo dentro de cada adaptador). Isso existe porque a
raspagem sequencial (uma loja de cada vez) passou a levar mais tempo
que o intervalo médio entre blocos do Bitcoin (~10 min) conforme o
número de lojas cresceu -- sem paralelismo, a atualização do site
ficaria permanentemente atrasada em relação aos blocos reais.

## Limitações conhecidas

- Raspagem de HTML quebra quando a loja muda o layout — o workflow
  continua rodando mesmo se um site falhar (erro só daquele site fica
  registrado em `data/last_run.json`), mas vale revisar `sites.json`
  periodicamente.
- Sites que só carregam preços via JavaScript (sem HTML estático nem
  JSON-LD) não são suportados pelos adaptadores atuais.
- A normalização marca/modelo/versão é best-effort; produtos com títulos
  muito genéricos podem cair em "Modelo não identificado".
- `data/price_history.csv` cresce um pouco a cada bloco novo (~144
  blocos/dia em média) e nunca é podado automaticamente. Com o tempo
  isso pode virar um arquivo grande — não é um problema agora, mas vale
  considerar uma rotina de arquivamento/compactação se crescer demais.
- O gatilho `schedule` do GitHub Actions não garante pontualidade exata
  (pode atrasar minutos em picos de carga da plataforma), então "a cada
  bloco" na prática é "no polling de 5 em 5 min seguinte ao bloco".
