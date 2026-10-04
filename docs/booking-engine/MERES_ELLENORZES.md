# Mérés-ellenőrzés: foglaló → köszönőoldal (2026-10-03)

Két kérdés volt: **(1) kétszeresen tüzel-e valami** (a keretben és a teljes ablakban együtt), és **(2) végigérnek-e a kattintás-azonosítók** a hirdetéstől a köszönőoldalig. A méréshez automatizált böngésző készült ([`tools/meres-proba/`](../../tools/meres-proba/README.md)), amely **minden keretben naplózza a kimenő mérési kéréseket, és le is tiltja őket**: a hirdetési fiókokba a teszt nem küld semmit (de lásd a „Hibák” pontot: két korai futásnál ez nem teljesült).

A részletes naplók: [`meres-naplo/valodi-hair.txt`](meres-naplo/valodi-hair.txt), [`valodi-oxigen2.txt`](meres-naplo/valodi-oxigen2.txt), [`valodi-lezer.txt`](meres-naplo/valodi-lezer.txt) (minden letiltott kérés: platform, keret, esemény, címke, érték, azonosító).

## Módszer

- Valódi Chrome (Playwright), friss profil, a süti-hozzájárulás elfogadva (a tulajdonos jóváhagyásával), a méréskódok az éles tartományon (`www.mosaicheadspa.hu`) futnak.
- **Alapból tiltó:** a saját oldalon, a Salonic-oldalakon és a reCAPTCHA-n kívül minden harmadik fél felé csak a szkript- és betűtöltés engedett; minden más naplózva és tiltva (200-as üres válasz). A csak mérésre szolgáló hostok DNS-szinten sem feloldhatók (második védvonal).
- A tesztelt kód az **átkötött + javított build** (`dist/`, minden kapcsoló bekapcsolva), az éles tartományon kiszolgálva (`--overlay`). A köszönőoldalak és a méréskódok ugyanazok, mint az élesben.
- Útvonalak: **A** natív (a mai Salonic-saját útvonal: landing → Salonic → köszönőoldal), **B** hirdetés → landing → motor → köszönőoldal (az átkapcsolás utáni valóság), **C** közvetlenül a motor URL-jéről indulva (kattintás-azonosítókkal), **D** ugyanez a javítással.
- Három üzletág: fodrászat-konzultáció, oxigén 2. alkalom, lézer (új, fizetős). Szimulált (foglalás nélküli) és **valódi** foglalásokkal is; a valódi foglalásokat a „Lemondom” linkkel lemondtuk.

## 1. Kétszeres tüzelés

**Eredmény: nincs.** Mind a három üzletágnál, mindhárom módon (szimulált, valódi, natív alapvonal) azonos a köszönőoldalon elsülő konverziók **sorozata**, és a **Salonic-keretben betöltött köszönőoldal példányból 0 mérési kérés indul** (a `suti.js` a keretben betöltött oldalon korán kilép és csak továbbítja az URL-t: [suti.js:28-35](../../assets/js/suti.js)). A GTM ott nem fut, ezért nincs mit leállítani, és javítás sem kell.

Egy foglalás során elsülő konverziók (a köszönőoldalon; a natív útvonallal azonos):

| Üzletág | Google Ads (egyedi konverzió: címke, érték) | GA4 / stape | Meta (böngésző + CAPI, azonos `event_id`) | TikTok |
|---|---|---|---|---|
| Fodrászat-konzultáció | `DnDNCN…` 13 000 HUF, **1×** | `ads_conversion_Fodrasz_Foglalas_1`, `hair_book_appointment_first`, mindegyik **1×** | `Schedule`, `Fodrasz_Konzultacio` (13 000 HUF), mindegyik **1** (a böngészős és a CAPI párjuk azonos `event_id`-jú: a Meta deduplikálja) | `Purchase` **1×** |
| Oxigén 2. alkalom | `pLhlCI…` 26 000 HUF, **1×** | `oxygen_headspa_second_appointment` **1×** | `Oxigen_Visszajaro` **1** (azonos `event_id`) | `Purchase` **1×** |
| Lézer (új, fizetős) | `LXcLCJ…` és `cPOaCI…`, mindkettő 24 000 HUF, **1-1×** | `Szörtelenités_elysion_ok`, `elysion_ok`, mindegyik **1×** | `Schedule`, `Szor_FoglalasElso` (24 000 HUF), mindegyik **1** (azonos `event_id`) | `CompleteRegistration` **1×**, `Purchase` **1×** |

Egy Google-konverzió a böngészőből három csatornán megy ki (`pagead/conversion`, `ccm/conversion`, `viewthroughconversion`) ugyanazzal az azonosítóval: ez a Google-címke szokásos működése, nem dupla konverzió. A Zapier-webhook mindhárom esetben **1×** fut.

**„Platformonként pontosan 1”:** minden egyes **címke / esemény** pontosan egyszer süllyed el. A mai mérés viszont foglalásonként **több különböző** címkét / eseményt küld (a lézernél 2 Google-címke és 2 TikTok-esemény, minden üzletágnál 2 GA4-esemény vagy több Meta-esemény). Ez a mostani, Salonic-saját útvonalon is így van, tehát nem a foglaló eredménye; a kiértékelés a tulajdonosé.

A **Salonic-keretben** (az adatlap) a Salonic-fiók saját nyomkövetői futnak: a TikTok-pixel (`LandingPageView`, `Pageview`, `InitiateCheckout`, `EnrichAM`) és a Google-címke (`page_view`, `form-data`). Ezek natívan is ugyanígy futnak (a vendég a Salonic-oldalon tölti ki az űrlapot), a foglaló nem ad hozzá és nem von el belőlük. Konverzió ezek közül a TikTok `InitiateCheckout` (a Salonic oldaláról).

## 2. Kattintás-azonosítók

A hirdetési kattintást `?gclid=TESZT123&fbclid=TESZT456&ttclid=TESZT789&utm_source=teszt&utm_medium=cpc` utánozta.

| Útvonal | Google Ads `gclid` | Meta `fbc` (böngésző + CAPI) | TikTok `ttclid` | GA4 forrás (`teszt / cpc`) |
|---|---|---|---|---|
| A: natív (landing → köszönőoldal) | igen | igen | igen | **igen** (a munkamenet a landingen indul, a köszönőoldal ugyanabban) |
| B: landing → motor → köszönőoldal | igen | igen | igen | **igen** (ugyanaz a munkamenet-azonosító) |
| C: közvetlenül a motor URL-jéről, javítás nélkül | igen* | igen* | igen* | **nem** |
| D: közvetlenül a motor URL-jéről, a javítással | igen | igen | igen | **igen** |

\* Közvetlen belépésnél a három platform a kattintás-azonosítót **a `document.referrer`-ből** olvassa ki (a hand-off a motor oldaláról indul, a referrer a motor teljes URL-je). Ez működik, de törékeny: a referrer-szabályok változására érzékeny. A **GA4 munkamenet-forrása elvész**, mert a motor oldalán nem fut mérés: a munkamenet a köszönőoldalon indul, a `page_location` utm nélküli, a `document_referrer` pedig a saját domain.

**Javítás (a PR #68-ban):** a motor a hand-off URL **végére fűzi** a saját URL-jén kapott hirdetési azonosítókat (`gclid`, `gbraid`, `wbraid`, `fbclid`, `ttclid`, `msclkid`, `utm_*`), ha a Salonic URL-je nem tartalmazza őket. A Salonic paraméterei bájtra érintetlenek (nincs újraszerializálás, teszt: `withAttribution`), és ha a motor URL-jén nincs ilyen paraméter (a landingről érkező vendégnél), az URL pontosan a Salonic URL-je. A javítással (D) minden azonosító és a GA4 `teszt / cpc` is végigér, a konverziók sorozata változatlan.

**Megjegyzés a landingekről:** az `/idpontfoglalas` kapuoldalon **nem fut a Meta-pixel**, ezért ott nincs `_fbc` süti (a natív útvonalon sem). A hirdetési landingeken (`/headspa-budapest`, a lézeres, fodrászos, oxigénes oldalak) fut mind a három, és megkapják a kattintás-azonosítót. Ha hirdetés közvetlenül az `/idpontfoglalas`-ra mutat, a Meta-azonosító már ma sem jut át.

## 3. Valódi próbafoglalások (a mérés mellett)

Név „TESZT – Claude”, e-mail `deakfi@grantis.hu`, telefon +36 70 942 0090, a feltétel bepipálva, a hírlevél nem; a motor-URL kattintás-azonosítókkal; a kimenő mérési kérések tiltva. A visszaigazoló e-mail mindháromnál megérkezett.

| Üzletág | Küldés (perc) | Foglalt időpont | Köszönőoldal | Vendég (`g`) / tranzakcióazonosító | Lemondva |
|---|---|---|---|---|---|
| Fodrászat-konzultáció | 21:07 | 2026-10-22 (csütörtök) 15:00 | `/fodrasz-ok` | `g:3385039` / `fodraszok-3385039-232804-1792674000` | 21:10 |
| Oxigén 2. alkalom | 21:10 | 2026-10-21 (szerda) 17:00 | **`/oxigenterapia-masodik`** (`first_booking=true`) | `g:3385031` / `oxigenterapi-3385031-466158-1792594800` | 21:11 |
| Lézer, ARC Teljes arc + állapotfelmérés −20% (24 000 Ft) | 21:12 | 2026-10-26 (hétfő) 14:00 | `/elysion-ok` | `g:3353226` / `elysionok-3353226-476485-1793019600` | 21:13 |

A `g` a Salonic **vendég**azonosítója (ugyanaz marad az azonos vendég minden foglalásánál), a tranzakcióazonosítót a mérés rakja össze belőle, a szolgáltatás- és az időpont-azonosítóból. Az oxigén 2. alkalomnál a Salonic `first_booking=true`-t jelzett, mert a „TESZT – Claude” vendégnek korábbi *teljesített* foglalása nincs (csak a ma lemondott próba).

## 4. Hibák és korlátok (őszintén)

1. **Két korai, szimulált futásnál a Meta szerveroldali (CAPI) kérései kimentek.** A teszt első tiltólistája a `capig.stape.*` hostot nem ismerte fel, ezért a két futás (2026-10-03 20:39:27 és 20:41:14) mindegyike elküldte a stape-en át a Meta felé a `Schedule`, a `PageView` és a `Fodrasz_Konzultacio` (13 000 HUF) eseményt (CAPI-pixel `1361403694872594`; a custom esemény `event_id`-ja mindkét futásnál `fodraszok-SZIM1792675800-232804-1792675800`, a másik kettő futásonként más), és egy-egy TikTok IPv6-dúsító kérést. A kattintás-azonosító a próbaérték (`TESZT456` / `TESZT789`), így hirdetéshez nem rendelhetők, de az eseménylistában ott vannak. Szűrhetők: az esemény forrás-URL-je `…/fodrasz-ok?…g=g%3ASZIM…`. A Meta nem enged eseményt törölni. A hiba javítva: a teszt azóta alapból tiltó (ismeretlen host vagy POST nem megy ki), és DNS-szinten is védett.
2. **Egy kósza konverzió a mérésben** a deploy utáni ellenőrzésnél: a `/success-foglalas` köszönőoldalt paraméter nélkül töltöttem be (lásd [PROBAFOGLALASOK.md](PROBAFOGLALASOK.md)).
3. A stape felé a GA4-esemény a böngészőben service workeren át megy; a teszt-böngészőben a service workert tiltottuk, ezért a GA4-esemény futásonként a stape `g/collect` vagy közvetlenül a Google felé látszik. Az események **darabszáma** ettől azonos; a stape szerveroldali továbbításait (a böngészőből induló `capig` kéréseken túl) a teszt nem látja.
4. A TikTok esemény neve a kérés törzsében van; ezt most olvassuk ki (`Purchase`, `CompleteRegistration`, `InitiateCheckout`, `EnrichAM`).
5. Az első valódi küldési kísérlet (21:05) nem hozott létre foglalást (a telefonmező `fill`-lel kitöltve nem frissítette a rejtett mezőit); a teszt azóta valódi billentyűleütésekkel gépel. A reCAPTCHA-kihívás egyik valódi futásnál sem jött.
6. A szimulált mód csak a Salonic-űrlapot váltja ki (annak átirányításával); a Salonic valódi átirányítása és az űrlap saját nyomkövetői a valódi futásoknál is mérve vannak.

## 5. Összegzés

- A köszönőoldal konverziói foglalásonként a mai mérés szerint, **egyszer** sülnek el, és a motoron át **azonosak a natív útvonallal**; a keretben betöltött köszönőoldal nem küld semmit.
- Az átkapcsolás (linkek a motorra) után a vendég a landingről érkezik: a kattintás-azonosítók és a GA4-forrás végigérnek (B).
- A közvetlen belépés (hirdetés a motor URL-jére) egy hiányt mutatott (GA4-forrás); a javítás a #68-ban van, és működik (D).
- Nyitott, tulajdonosi: a mai mérés foglalásonként több címkét küld (lásd fent), és a Fodrászat 0 Ft-os konzultációja 13 000 HUF értékkel megy a Google Adsbe, a TikTok-ba és a Metába is.
