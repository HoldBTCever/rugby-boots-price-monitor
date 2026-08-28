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
| Europa (Reino Unido) | Lovell Rugby, Gilbert Rugby, Absolute Rugby, JustRugby, Rugby Heaven, Rugbystuff | `/products.json` (catálogo Shopify) |
| Europa (Reino Unido) | Canterbury, Pro:Direct Rugby, Rugbystore.co.uk, Kitlocker, M&M Direct | JSON-LD |
| Europa (Espanha) | TradeInn | JSON-LD |
| Japão | Mizuno Japan, Rugby Goods (Rugby Online Japan) | HTML da categoria / JSON-LD |
| Argentina | Durban Rugby, Rugbier Store | JSON-LD |

A Rakuten Ichiba foi removida por falta de confiabilidade dos dados
extraídos. A Decathlon foi removida por bloqueio anti-bot ativo (HTTP
403 confirmado nos logs) — não faz sentido continuar tentando nem
contornar o bloqueio. A MercadoLibre Argentina e a MercadoLibre Paraguay
também foram removidas pelo mesmo motivo: confirmado via log de
diagnóstico que a busca "botines-de-rugby" volta uma página de bloqueio
(mesmo HTML de 52.622 caracteres para os dois países, com indício de
captcha/verificação, não resultado de busca de verdade) desde o reset de
histórico — não é seletor desatualizado, é bloqueio ativo. A Lovell Rugby
migrou de domínio (`lovellrugby.co.uk` → `lovellsports.com`), o que
explica por que ficou muda por um tempo.

Canterbury USA (`canterburyusa.com`) não entrou como fonte separada:
é operada pela própria World Rugby Shop (mesmo grupo, catálogo
essencialmente idêntico) — adicioná-la contaria a mesma loja duas vezes
na média de preço. Duas lojas de indumentária argentina pesquisadas
(Webb Ellis Shop, Rugby Shop) não entraram porque não foi possível
confirmar que vendem chuteira (parecem só roupa/acessório).

A Sports Direct (sportsdirect.com) também não entrou, apesar de ter uma
categoria de chuteira de rugby confirmada e real: a pesquisa achou
várias empresas de scraping-as-a-service anunciando especificamente
rotação de IP e bypass de CAPTCHA para raspar esse domínio — mesmo
indício de bloqueio anti-bot ativo que já tirou a Decathlon e a
MercadoLibre da lista, só que descoberto antes de tentar em vez de
depois.

Algumas fontes JSON-LD (Canterbury, Pro:Direct Rugby, Rugbystore.co.uk,
Kitlocker, Rugby Goods, M&M Direct) usam `generic_jsonld` com o padrão
de link de produto ainda não 100% confirmado — podem devolver 0
resultados até o padrão real ser validado nos logs do Actions; isso é
preferível a inventar dado.

Adicione, remova ou ajuste lojas em `scraper/sites.json` — cada entrada
define região, moeda, URL(s) de listagem e qual adaptador usar
(`scraper/adapters.py`). Sites que expõem dados estruturados schema.org
(`shopify_jsonld` / `generic_jsonld`) são os mais estáveis, pois não
dependem de classes CSS que mudam a cada redesign.

Sites com `"supports_search": true` (hoje: World Rugby Shop, Rugby
Imports, Lovell Rugby, Gilbert Rugby, Absolute Rugby, JustRugby, Rugby
Heaven, Rugbystuff — todas Shopify confirmado) também recebem uma **busca ativa**
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

A exclusão por palavra de não-chuteira (bola, camisa, chaveiro, gift
card...) continua valendo mesmo com `trust_category: true` — confirmar
que a URL é uma categoria de chuteiras não garante que TODO item ali
seja chuteira de verdade. Dois casos reais encontrados: a busca "boots"
da Rugby Goods (Japão) devolveu um chaveiro de chuteira
("...ブーツキーリング") junto com chuteiras de verdade, e a coleção de
chuteiras da Pro:Direct Rugby vinha devolvendo só "Gift Card" desde
sempre — nenhuma linha real de chuteira nunca veio de lá (todas as
linhas gravadas até agora eram gift card; removidas de
`price_history.csv`, e a fonte só volta a aparecer se um dia devolver
uma chuteira de verdade). A Rugby Goods também ganhou
`trust_category: true`: a maioria dos títulos lá segue o padrão "marca +
modelo + cor + SKU" sem nenhuma palavra de chuteira (nem "boot" nem os
equivalentes em katakana ブーツ/スパイク aparecem em toda listagem) —
mesmo problema do Kakari da World Rugby Shop, mas sem um `product_type`
pra usar como pista extra (o JSON-LD dessa loja não expõe categoria).

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
masculino: UK 7 = US 8, UK 11 = US 12), **exceto produtos adidas**, que
somam apenas 0,5 (UK 8 = US 8.5, não US 9 — conversão oficial da própria
adidas, diferente do padrão genérico usado pelo resto do catálogo).

Bug real encontrado por isso: a Kakari Elite Black da Rugbystuff
aparecia no site com preço mesmo sem nenhum tamanho disponível de
verdade entre US 9–12 na loja (usuário reportou com link real). O
diagnóstico mostrou que a única variante disponível na faixa era UK 8 —
que a conversão genérica (+1) lia como "US 9" (dentro do filtro), mas
o tamanho americano real da adidas pra UK 8 é 8.5 (fora do filtro).
Corrigido em `_parse_us_size()`/`_min_price_in_size_range()`
(`scraper/adapters.py`), que agora recebem o título do produto pra
aplicar a conversão certa por marca. Como o histórico não guarda a
lista de variantes de cada dia (só o preço final já calculado), não dá
pra recalcular retroativamente quais linhas antigas de produtos adidas
em lojas GBP foram afetadas — o fix vale a partir da próxima raspagem.

As demais fontes (JSON-LD genérico como Canterbury/Pro:Direct/Rugbystore/
Kitlocker/Rugby Goods/Durban Rugby/Rugbier Store/TradeInn, Mizuno Japan)
não expõem tamanho por variante nos dados que os adaptadores capturam
hoje — continuam contribuindo sem esse filtro, porque descartá-las por
completo derrubaria fontes que já encontraram itens reais da watchlist
(ex: TradeInn e Rugby Heaven acharam a Mizuno Waitangi e a Canterbury
Stampede). Se isso não for aceitável, ou se quiser que essas fontes
também sejam restritas a US 9–12 assim que eu conseguir extrair tamanho
delas, é só pedir.

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

**Duas correções de agrupamento (usuário reportou com prints reais o
mesmo modelo aparecendo duas vezes):**

1. Quando uma loja escreve o tipo de solado por extenso ("Soft Ground",
   "Artificial Ground") em vez da sigla ("SG", "AG"), as palavras
   sobravam no campo "modelo" — "adidas Kakari RS SG..." e "adidas
   Kakari RS Adults Soft Ground..." viravam "Kakari RS" e "Kakari RS
   Adults Soft", dois grupos em vez de um. `catalog.json` ganhou
   "adults"/"soft"/"hard"/"firm"/"artificial"/"ground" na lista de
   ruído.
2. `_SIZE_RE` (o regex que apaga menção a tamanho do título) exigia os
   dois lados opcionais ao mesmo tempo (prefixo tipo "size"/"tamanho" E
   sufixo tipo "us"/"uk") — na prática isso apagava **qualquer** número
   solto de 1-2 dígitos, sem contexto nenhum. "Antoine Dupont Adizero
   RS15" e "Antoine Dupont Adults Adizero RS15" perdiam o "RS15" de
   jeitos diferentes (um pelo corte de 4 palavras já cheio de "Adults",
   o bug #1; o outro nem chegava a ter esse problema). Mas o mesmo
   regex também comia números de versão de verdade em outros produtos —
   "Phoenix 2.0" virava "Phoenix", "RS-15" virava "RS", "Neo 4" virava
   "Neo". Agora só apaga o número quando vem com uma palavra de tamanho
   do lado (ver comentário em `normalize.py`).
3. Usuário notou "adidas RS15" ainda duplicado depois das duas correções
   acima — algumas lojas chamam de "Adizero RS15", outras só "RS15"/
   "RS 15"/"RS-15", sem prefixo. Pesquisei o nome oficial da adidas
   ([news.adidas.com](https://news.adidas.com/rugby/adidas-revamps-its-rugby-boot-portfolio-with-the-launch-of-the-adizero-rs15---built-for-multi-direct/s/5c574b4a-38f8-4dd5-8dfd-32ecee7e1d2a)):
   é "adizero RS15", com tiers reais **Pro** (elite/seleções), **Elite**,
   **Ultimate** e a versão padrão, mais a linha feminina **Avaglide**.
   `_RS15_CANON_RE` em `normalize.py` canoniza qualquer grafia
   ("RS15"/"RS 15"/"RS-15", com ou sem "Adizero") pra "Adizero RS15"
   antes de separar em palavras; "ultimate" entrou em `version_tokens`
   (era lido como parte do modelo, não da versão); "Solar Turbo" (nome
   de cor da adidas, tipo "Team Royal Blue") passou a ser removido como
   as demais cores. 17 grupos diferentes de "RS15" viraram 9 (os 4
   tiers principais, antes espalhados em até 5 grafias cada, agora uma
   linha só; a linha "Antoine Dupont" — edição de jogador, produto
   realmente diferente — continua separada de propósito).

De quebra, um pequeno código de SKU interno de loja que vazava no fim de
alguns títulos japoneses (ex: ".../JP8792", ".../IH2756") também passou
a ser descartado (`_SKU_CODE_RE`) — não é nome de produto.

Depois de cada correção, `price_history.csv` inteiro é reprocessado
(recalculando marca/modelo/versão a partir do `title` já gravado, sem
raspar de novo) com o script de migração usado pontualmente pra isso —
não faz parte do pipeline normal, que só processa linhas novas.

## Ordenar e filtrar (aba Painel)

A tabela "Todos os modelos monitorados" (e o dropdown "Modelo" do
gráfico acima dela, que segue o mesmo filtro) tem três controles:

- **Marca** e **Versão**: restringe a lista só à marca/versão escolhida
  (ex: só "adidas", só "Elite") — as opções são geradas a partir dos
  modelos realmente presentes, nunca uma lista fixa.
- **Ordenar por**: Nome (A-Z, padrão), Maior variação primeiro (mesma
  coluna "Variação" da tabela — quem está mais abaixo da própria média
  histórica aparece primeiro), Maior/Menor preço médio.

Tudo client-side (`app.js`), sem round-trip nenhum — os três filtros
combinam entre si (ex: só "Mizuno" + "Elite", ordenado por preço).

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

Os modelos da Oxen e da Gilbert usam os nomes reais confirmados por
pesquisa (Oxen: Mtsck, Raptor, Viper, Meta X; Gilbert: Kaizen 1.0, 2.0 e
X 3.1 Pace) — as entradas antigas "Oxen Stallion SG" e "Gilbert Kaizen
1.1" nunca encontravam nada porque esses modelos não existem de
verdade em nenhuma loja.

## Solado, cabedal e travas (aba "Comparar")

Além de marca/modelo/versão, `scraper/normalize.py` tenta extrair três
atributos a mais do título de cada produto:

- **Solado** (`ground_type`): Soft/Artificial/Hard/Firm Ground — a
  maioria das lojas informa isso no título (SG/FG/AG/HG ou por
  extenso), então a cobertura é boa.
- **Cabedal** (`upper_material`) e **travas** (`stud_type`): só
  preenchido quando o título menciona explicitamente (ex: "Kangaroo
  Leather", "6 Stud", "Aluminium Studs") — a maioria das lojas não
  informa isso, então a cobertura é baixa por natureza dos dados, não
  por limitação do código. Quando a fonte não diz, o campo fica vazio
  e o site mostra "Não informado" em vez de inventar um valor.

Esses três campos ficam gravados por linha em `price_history.csv` e
agregados por modelo/versão (valor mais frequente) em
`daily_summary.json`. A aba **Comparar** deixa escolher duas chuteiras
lado a lado, mostrando marca/modelo/versão, preço médio, menor preço de
hoje (+ fonte), solado, cabedal, travas e encaixe (largura) — com a
diferença de preço em US$ e % calculada automaticamente.

A pedido do usuário, a lista de opções do Comparar não é mais o
catálogo inteiro (100+ modelos, difícil de navegar) — só os favoritos
(`scraper/favorites.json`) mais as famílias **RS15** e **Morelia IV**
completas (todas as versões/grafias — "RS15", "RS-15", "RS 15", "Neo
IV", "Neo 4"), mesmo quando uma variante específica não está entre os
12 favoritos. Calculado uma vez em `aggregate._is_rs15_or_morelia_iv()`
+ o mesmo casamento por palavra-chave dos favoritos, gravado como
`in_comparar` em cada modelo de `daily_summary.json`.

**Dados curados (`scraper/model_specs.json`):** pra um punhado de
modelos conhecidos (hoje: os 12 da watchlist), cabedal/travas/encaixe
vêm de pesquisa manual — ficha técnica oficial da marca ou descrição
detalhada de loja, não do título raspado — porque a maioria dos títulos
não menciona isso. Cada entrada casa por palavra-chave contra
marca+modelo+versão (mesmo esquema de `scraper/watchlist.py`) e tem
prioridade sobre o que foi extraído automaticamente do título; a fonte
de cada dado aparece embaixo da tabela na aba Comparar. Quando a
pesquisa não confirma um campo específico pra um modelo (ex: largura do
Oxen Meta X, que só achei pra coleção Oxen em geral, não pro modelo
exato), o campo fica `null` em vez de herdar um valor genérico da marca.

## Lista curada pessoal (aba "Favoritos")

`scraper/favorites.json` é uma segunda lista fixa, no mesmo formato de
`scraper/watchlist.json` (`{label, match}`, casado por palavra-chave
contra o título bruto via `scraper/watchlist.py`) e agregada pela mesma
função (`aggregate._build_watchlist()`, parametrizada pela lista) —
só que com os 12 modelos que o usuário pediu especificamente, em vez da
lista da aba "Histórico". Gera `data/favorites.json` (mesmo esquema de
`data/watchlist.json`: por versão, por bloco) e a aba **Favoritos** no
site reusa o mesmo componente visual (gráfico + tabela por versão) da
aba Histórico, só apontando pro arquivo diferente.

Uma correção feita ao montar a lista: o usuário pediu "Oxen Metasock"
(depois esclarecido como "Oxen Metashock") — nenhuma loja escreve o
nome por extenso assim; a única grafia real encontrada no catálogo
raspado é "OXEN Mtsck" (ex: "OXEN Mtsck 6 Stud Lace Up Rugby Boots"),
confirmado pelo usuário como o mesmo produto. A entrada mostra o
rótulo "Oxen Metashock", mas casa pela palavra-chave "mtsck" (a grafia
real usada nas lojas).

Cobertura real hoje: 9 dos 12 modelos já aparecem no catálogo raspado.
Os 3 que não aparecem ainda (Asics Lethal Tigreor, Asics Lethal
Testimonial, Mizuno Morelia Neo IV Beta Japan) são modelos reais, mas
nenhuma loja monitorada até agora devolveu uma chuteira com esse nome
-- a entrada fica pronta pra aparecer sozinha assim que alguma loja
estocar, mostrando "ainda não encontrado" em vez de inventar um preço.

(Esta aba substituiu a antiga aba "MiJ", removida a pedido do usuário
-- junto foi removido o campo `mij_kangaroo` de `price_history.csv` e
`daily_summary.json` e a função `normalize.is_mij_kangaroo()`.)

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

### Atraso do agendador do GitHub Actions (limitação conhecida da plataforma)

O `schedule` do GitHub Actions é "melhor esforço", sem SLA -- a própria
documentação do GitHub admite atraso ou descarte de execuções agendadas
em horários de pico, e pico significa justamente os minutos redondos
(:00, :05, :10...), porque é onde a maioria dos cron jobs de todo o
GitHub cai ao mesmo tempo. Já aconteceu nesta sessão de ficar horas sem
nenhum run, sem nenhum erro visível -- o agendador simplesmente não
disparou, e depois voltou sozinho.

Duas mitigações:

1. **Cron deslocado** (`1-56/5 * * * *` em vez de `*/5 * * * *`):
   mesma frequência, só fora do minuto redondo mais concorrido. Reduz a
   chance de atraso longo, mas não é garantia.
2. **Backup do agendador** (`scraper/.heartbeat`): uma sessão externa
   dedicada (fora do GitHub Actions) confere periodicamente há quanto
   tempo não roda nenhum job. Se passar de ~30 min sem nenhum run --
   sinal de que o agendador nativo travou --, ela atualiza a data nesse
   arquivo e dá push. Como `scraper/**` já está nos `paths` do trigger
   `push` do workflow (seção acima), isso força um run novo sem
   depender do cron travado. `scraper/.heartbeat` não é lido por nenhum
   código do scraper -- existe só pra isso.

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
