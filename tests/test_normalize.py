"""Suíte de regressão pra scraper/normalize.py.

Cada caso aqui é um título REAL que já apareceu em data/price_history.csv
(ou uma variação mínima do mesmo padrão) e que já causou um bug corrigido
ao longo do desenvolvimento -- não são casos inventados. O objetivo é
travar esses comportamentos: uma mudança futura em normalize.py que quebre
algum destes casos deve falhar o teste, não só aparecer meses depois como
"duplicata estranha" reportada pelo usuário no site publicado.
"""
from scraper import normalize


def test_rs15_canonicalization_variants_convergem():
    """"RS15"/"RS-15"/"RS 15" com ou sem "Adizero" na frente têm que virar
    o mesmo grupo -- senão a mesma bota vira 3-4 modelos "diferentes" só
    por causa de formatação do título entre lojas."""
    titles = [
        "adidas Adizero RS15 Pro SG Rugby Boots White/Red",
        "adidas RS-15 Pro Soft Ground Rugby Boots",
        "adidas RS 15 Pro Rugby Boots",
    ]
    results = [normalize.normalize_title(t) for t in titles]
    assert {r["model"] for r in results} == {"Adizero RS15"}
    assert {r["version"] for r in results} == {"Pro"}


def test_rs15_abreviado_sem_rs_kakari_bare():
    """A Lovell Rugby chega a abreviar até o "RS": "adidas 15 Pro Adults
    Soft Ground Rugby Boots" tem que cair no mesmo grupo Adizero RS15, não
    virar um modelo "15" isolado."""
    result = normalize.normalize_title("adidas 15 Pro Adults Soft Ground Rugby Boots")
    assert result == {"brand": "adidas", "model": "Adizero RS15", "version": "Pro"}


def test_avaglide_e_avaglide_rise_nao_se_confundem_com_rs15_puro():
    base = normalize.normalize_title("Adidas Adults Adizero RS15 Rise Soft Ground Rugby Boots")
    avaglide = normalize.normalize_title("adidas Womens Rs15 Avaglide Soft Ground Rugby Boots")
    avaglide_rise = normalize.normalize_title("Adidas Womens RS15 Avaglide Rise Soft Ground Rugby Boots")
    assert base["model"] == "Adizero RS15 Rise"
    assert avaglide["model"] == "Adizero RS15 Avaglide"
    assert avaglide_rise["model"] == "Adizero RS15 Avaglide Rise"
    # são 3 variantes REALMENTE diferentes da linha RS15 -- não devem colapsar num só grupo
    assert len({base["model"], avaglide["model"], avaglide_rise["model"]}) == 3


def test_html_entity_nao_vaza_pro_modelo():
    """Rugbystore.co.uk manda o título com "&#8211;" (entidade HTML do
    traço-meio) sem decodificar. Sem html.unescape() + o traço-meio
    reconhecido em _COLORWAY_SUFFIX_RE, "&#8211;" ou "–" sobra como uma
    "palavra significativa" e ocupa um dos 4 slots do nome do modelo."""
    r1 = normalize.normalize_title(
        "adidas Antoine Dupont Adults Adizero RS15 Pro Soft Ground Boots &#8211; White/Red"
    )
    assert r1 == {"brand": "adidas", "model": "Antoine Dupont Adizero RS15", "version": "Pro"}

    r2 = normalize.normalize_title(
        "Adidas Womens RS15 Avaglide Soft Ground Rugby Boots &#8211; Ice Blue"
    )
    assert r2["model"] == "Adizero RS15 Avaglide"
    assert "&#8211;" not in r2["model"] and "–" not in r2["model"]


def test_colorway_dois_termos_nao_vaza_pro_modelo():
    """Cor de duas palavras (ex: "Jet Black", "Solar Turbo Pink") onde só
    a cor "pura" (Black/Pink) tava na lista de ruído -- o modificador
    ("Jet"/"Solar Turbo") vazava pro campo modelo."""
    cases = {
        "Canterbury Speed Falcon 2.0 Team FG Rugby Boots Jet Black": "Speed Falcon 2.0",
        "Canterbury Speed Falcon 2.0 Elite FG Rugby Boots Blanc De Blanc White": "Speed Falcon 2.0",
        "Adidas Adults Adizero RS15 Ultimate Soft Ground Rugby Boots &#8211; Solar Turbo": "Adizero RS15",
        "Mizuno Kids Monarcida Neo III Select All Ground Rugby Boots &#8211; Bright Black": "Monarcida Neo III Select",
    }
    for title, expected_model in cases.items():
        result = normalize.normalize_title(title)
        assert result["model"] == expected_model, f"{title!r} -> {result!r}"


def test_adidas_team_e_cor_nao_viram_versao_nem_modelo():
    """"Team Royal Blue"/"Team Solar Orange" são nome de cor da adidas, não
    a versão "Team" de verdade (que existe pra Canterbury, sem cor atrás)."""
    result = normalize.normalize_title("adidas Kakari Elite SG Rugby Boots Team Royal Blue")
    assert result == {"brand": "adidas", "model": "Kakari", "version": "Elite"}

    team_de_verdade = normalize.normalize_title("Canterbury Speed Falcon 2.0 Team FG Rugby Boots Jet Black")
    assert team_de_verdade["version"] == "Team"


def test_default_brand_para_lojas_oficiais_de_marca_unica():
    """canterbury.com e gilbertrugby.com têm produtos cujo título não
    menciona a marca (ex: "Adult Unisex Phoenix 2.0 Elite Soft Ground
    Boots White - 6") -- o próprio domínio garante a marca via
    default_brand (sites.json), não dá pra depender do texto."""
    canterbury = normalize.normalize_title(
        "Adult Unisex Phoenix 2.0 Elite Soft Ground Boots White - 6", default_brand="Canterbury"
    )
    assert canterbury == {"brand": "Canterbury", "model": "Phoenix 2.0", "version": "Elite"}

    gilbert = normalize.normalize_title("Icon Players 2.0 8S Boots - Senior", default_brand="Gilbert")
    assert gilbert["brand"] == "Gilbert"
    assert gilbert["model"] == "Icon Players 2.0 8S"

    # sem default_brand, o mesmo título não tem marca nenhuma pra achar
    sem_default = normalize.normalize_title("Adult Unisex Phoenix 2.0 Elite Soft Ground Boots White - 6")
    assert sem_default["brand"] == "Outra marca"


def test_canterbury_sufixo_de_tamanho_no_titulo_oficial():
    """O JSON-LD da canterbury.com sempre grava "- 6" no final do título
    (tamanho da variante padrão da página) -- não é parte do nome."""
    result = normalize.normalize_title(
        "Adult Unisex Phoenix 2.0 Elite Soft Ground Boots White - 6", default_brand="Canterbury"
    )
    assert result["model"] == "Phoenix 2.0"
    assert "6" not in result["model"].split()


def test_ruido_adult_unisex_ccc_nao_vaza_pro_modelo():
    result = normalize.normalize_title(
        "Adult Unisex Phoenix 2.0 Elite Soft Ground Boots White - 6", default_brand="Canterbury"
    )
    for junk in ("Adult", "Unisex", "CCC"):
        assert junk not in result["model"].split()


def test_tradeinn_typo_stamped_groundbreak():
    """Erro de digitação confirmado da própria TradeInn (51 linhas no
    catálogo): "Stamped" em vez de "Stampede"."""
    result = normalize.normalize_title("Canterbury Stamped Groundbreak Elite SG rugby boots")
    assert result["model"] == "Stampede Groundbreak"
    assert result["version"] == "Elite"


def test_katakana_kakari_e_kakari_elite_traduzem_pra_nomenclatura_da_marca():
    """Rugby Goods (Japão) só tem o nome do modelo em katakana em alguns
    títulos -- tem que canonizar pro nome romanizado real da adidas."""
    simples = normalize.normalize_title("adidas カカリ SG ラグビー / Kakari Soft Ground Rugby/IE3204")
    assert simples["model"] == "Kakari"

    elite = normalize.normalize_title(
        "adidas カカリエリート SG ラグビー / Kakari ELITE Soft Ground Rugby/IH2756"
    )
    assert elite["model"] == "Kakari"
    assert elite["version"] == "Elite"

    z1 = normalize.normalize_title("adidas Rugby カカリ Z.1 SG コアブラック HP6836")
    assert z1["model"] == "Kakari Z.1"


def test_ultimate_e_elite_low_convergem_pra_categoria_elite():
    """Pedido do usuário: "adidas Adizero RS15 Ultimate" e "adidas Kakari
    ... Lace Up Low Heel" (versão bruta "Elite Low") devem entrar na
    mesma categoria "Elite" das demais chuteiras Elite -- "Ultimate" é o
    mesmo tier de ponta da linha RS15, e "Low" no Kakari é só o corte do
    cano (altura do tornozelo), não um tier à parte."""
    rs15 = normalize.normalize_title("adidas Adizero Rs15 Ultimate Adults Soft Ground Rugby Boots")
    assert rs15 == {"brand": "adidas", "model": "Adizero RS15", "version": "Elite"}

    kakari = normalize.normalize_title("adidas Kakari Elite Rugby Boots Lace Up Low Heel")
    assert kakari == {"brand": "adidas", "model": "Kakari Lace Up Heel", "version": "Elite"}

    # mesmo grupo que a versão Elite "normal" da linha RS15 (sem isso,
    # "Ultimate" virava um group_key separado, fragmentando o histórico).
    elite_normal = normalize.normalize_title("adidas Adizero RS15 Elite SG Rugby Boots White/Red")
    assert normalize.group_key(**rs15) == normalize.group_key(**elite_normal)


def test_katakana_avant_puma():
    result = normalize.normalize_title("PUMA アヴァント SG ラグビースパイク レッド/106715")
    assert result["brand"] == "Puma"
    assert result["model"] == "Avant"


def test_sku_puro_numerico_nao_vira_modelo():
    """"106715" é o código de produto da própria puma.com/uk pro Avant --
    5+ dígitos puros sem letra na frente, não é número de modelo real."""
    result = normalize.normalize_title("PUMA アヴァント SG ラグビースパイク レッド/106715")
    assert "106715" not in result["model"]


def test_sku_com_prefixo_de_letra_nao_vira_modelo():
    result = normalize.normalize_title("adidas  SG ラグビー / Kakari Soft Ground Rugby/IH2758")
    assert "IH2758" not in result["model"]


def test_word_dedup_apos_canonizacao_katakana():
    """Um título que já tem "Kakari" romanizado E "カカリ" (que também vira
    "Kakari") não pode duplicar a palavra no modelo final."""
    result = normalize.normalize_title("adidas Rugby カカリ Z.1 SG コアブラック HP6836")
    words = result["model"].lower().split()
    assert words.count("kakari") == 1


def test_size_context_aware_nao_come_numero_de_versao_de_verdade():
    """_SIZE_RE só derruba número com contexto de tamanho do lado -- não
    pode comer "2.0"/"RS15"/"III" que são versão/modelo de verdade."""
    r1 = normalize.normalize_title("Canterbury Phoenix 2.0 Genesis Pro SG rugby boots size 10")
    assert r1["model"] == "Phoenix 2.0 Genesis"

    r2 = normalize.normalize_title("Canterbury Speed Falcon 2.0 Pro SG Rugby Boots")
    assert "2.0" in r2["model"]


def test_group_key_ignora_maiuscula_minuscula():
    a = normalize.group_key("adidas", "Kakari", "Elite")
    b = normalize.group_key("Adidas", "kakari", "ELITE")
    assert a == b == "adidas|kakari|elite"


def test_is_rugby_boot_aceita_titulo_real_sem_a_palavra_boot():
    """World Rugby Shop não repete "boot" no título -- só marca + modelo +
    cor -- então is_rugby_boot() sozinho não bastava, mas o title real com
    "Rugby Boots" no meio precisa continuar batendo."""
    assert normalize.is_rugby_boot("adidas Kakari Elite SG Rugby Boots UK 9")
    assert normalize.is_rugby_boot("Mizuno Waitangi Pro Rugby Boots Black/Silver")


def test_is_rugby_boot_rejeita_acessorio_explicito():
    assert not normalize.is_rugby_boot("Gift Card - £10.00")
    assert not normalize.is_rugby_boot("Bates RFC Coffee Mug")
    assert not normalize.is_rugby_boot("RUGBY WORLDCUP AUSTRALIA 2027 ブーツキーリング")


def test_is_rugby_boot_rejeita_troca_de_trava_japones():
    """Confirmado real (histórico de data/price_history.csv, commit
    45a03b0, loja rugbygoods_jp -- fonte removida depois por não ter
    filtro de tamanho, mas o título é dado real de quando existia): peça
    de reposição de trava (não chuteira) com "スタッド" no título, pescada
    pela busca "boots" mesmo com trust_category=true."""
    assert not normalize.is_rugby_boot("アディダス ADIPOWER スタッド（アディパワーカカリ用）")
    assert not normalize.is_rugby_boot("アディダス TRX Long スタッド（プレデター、RS7、マライス用）")
