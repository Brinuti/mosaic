# QA-3 kontrollált tesztek – terv, eszköz, ismert zaj

Állapot: 2026-10-06 (terv). Futtatás: **2026-10-07, 10:00–18:00 (Budapest)** a **PR #128 előnézetén** (`https://claude-mosaic-meres-qa-1-rrb.mosaic-d77.pages.dev`), **kód- és ág-módosítás nélkül** (nincs push a `claude/mosaic-meres-qa-1-rrbwkk` ágra, nincs deploy; a tesztek csak HTTP-hívások és böngészős foglalások). Az eszköz és a terv a `claude/mosaic-meres-eletut` ágon (PR #138) van, a #128-at nem érinti.

## Szabályok
- Minden tesztfoglalás neve **„TESZT – Claude”** (így kiszűrhető a valódi 24 órás listából; e-mail `deakfi@grantis.hu`), és a futtató a foglalást a vizsgálat végén lemondja (hibával megszakadt esetnél is).
- **Csak árnyék-célok:** Meta dataset `28616665324611098` (`test_event_code` `TEST83939`), TikTok ARNYEK pixel `DB2GTTJC77UE4D1NE4MG` (`TEST83543`), GA4 teszt-property `G-M5MLRLNQBP`, Google Ads `ARNYEK` másodlagos akciók (Zapier-webhookon át). Az éles pixelekre / property-re / akciókra a kód nem tud küldeni (a célok kódban rögzítettek). A vészkapcsolókhoz (`meres_kapcsolo`) nem nyúlunk.
- Eredmény olvasása: `GET /api/meres-admin?source_id=<booking_id | pi_…>` (kulcsos) és a #128 D1 **csak olvasás**.

## Futtatás
```bash
EGYEZTETES_KULCS=<kulcs> node tools/meres-proba/qa3-futtat.mjs --bazis https://claude-mosaic-meres-qa-1-rrb.mosaic-d77.pages.dev --eset <nev>
node tools/meres-proba/qa3-futtat.mjs ... --eset ajandek-visszaterites --refund-bazis https://claude-mosaic-meres-eletut.mosaic-d77.pages.dev
node tools/meres-proba/qa3-osszefoglalo.mjs --nap 2026-10-07     # -> docs/booking-engine/meres-naplo/qa3-osszefoglalo-2026-10-07.md
```
Az esetenkénti nyers napló: `docs/booking-engine/meres-naplo/qa3-<eset>-2026-10-07.json` (lépések, kiment `esemeny_id`-k platformonként, ellenőrzések: **elvárt / tényleges / PASS-FAIL**). A kulcs sehol nem kerül a kimenetbe.

## Esetek (13 Salonic-foglalás + 1 ajándékkártya-vásárlás)

| # | eset (`--eset`) | lépések | elvárt (a dokumentált szabályból: `QA2_ARNYEK.md`) |
|---|---|---|---|
| 1 | `ujratoltes` | HeadSpa foglalás → köszönőoldal → F5 ×2 → vissza → előre → a levél feldolgozása → F5 + vissza → a levél ismét | az érkezési adat egyszer tárolódik; **8 eseménysor** (4 alap + 4 ernyő) a levél után, az F5 / vissza után és a levél ismétlése után is; a kiment esemény után az érkezési adat nem módosul; 2. levél = `mar_kuldve`; 0 dupla |
| 2 | `dupla-level` | HeadSpa foglalás → **ugyanaz a Salonic-levél kétszer** a `/api/foglalas-egyeztetes`-re | a 2. válasz `esemeny_kuldes.allapot = mar_kuldve`, `duplikalt: true`; 8 sor; 0 dupla |
| 3a | `lemondas-elotte` | Fodrász foglalás → **lemondás** → a levél feldolgozása | az élő ellenőrzés `torolve`: **minden cella `kihagyva` (lemondva)**, semmi nem megy ki |
| 3b | `lemondas-utana` | PMU foglalás → levél (kiment) → lemondás → **lemondási értesítő** → a levél ismét | az események lemondás előtt kimentek (Meta 2, TikTok 2, Google 1, GA4 1); az értesítő felismeri a lemondást; a sorok változatlanok, nincs hamis esemény; **#128-on nincs Google-visszavonás** (az életút-ág az #138-ban) |
| 4 | `visszajaro` | HeadSpa foglalás, a levélben „nem új vendég” (**szimulált jelzés**) | csak `Visszajaro` alapesemény (nincs ernyő); Meta + TikTok + GA4 kiment, **Google nem** (nincs visszajáró-akció); Meta-név `HeadSpa_Visszajaro` |
| 5 | `kupon` | HeadSpa foglalás, a levélben `KUPONKÓDDAL – …` szolgáltatásnév + 0 Ft (**szimulált**: valódi kuponkódhoz érvényes Salonic-kód kell) | **nincs ernyő**; az alapesemény kimegy a levélbeli értékkel (0) |
| 6a–d | `konz-szor` `konz-fodrasz` `konz-pmu` `konz-oxigen` | konzultációs foglalás üzletáganként | érték: szőr **27 000**, fodrász **13 000**, PMU **13 800**, oxigén (akciós hajkamerás vizsgálat) **8 900** HUF (az ernyő ugyanennyi); Meta + TikTok alap + ernyő, Google + GA4 csak az alap; Meta-nevek az üzletág szerint |
| 7 | `suti-elutasitas` | HeadSpa foglalás, minden süti elutasítva | hozzájárulás a naplóban: stat. nem, marketing nem; **Meta + TikTok küld** (hash-elt e-mail + telefon); **Google** küldés `ad_user_data: DENIED`, **GA4** `consent.ad_user_data / ad_personalization: DENIED`; Google / GA4 felé hash-elt azonosító nem megy |
| 8a | `kattintas-tiktok-meta` | 1. látogatás TikTok (`ttclid`), 2. látogatás Meta (`fbclid`), foglalás | Meta `fbc` van; TikTok `ttclid` van; **Google `kihagyva`** (nincs kattintásazonosító); egyik kérésben sincs másik platform kattintásazonosítója |
| 8b | `kattintas-meta-google` | 1. látogatás Meta, 2. látogatás Google (`gclid`), foglalás | Meta `fbc` van; TikTok `ttclid` **nincs** (az esemény hash-elt adattal megy); Google `gclid`-del kiment; GA4 kiment; első UTM `facebook`, utolsó `google` |
| 9 | `ajandek-visszaterites` | ajándékkártya Stripe **teszt-módú** vásárlása → események → részleges, majd teljes **Stripe teszt-visszatérítés** → újrajátszás | **semmilyen hamis esemény nem megy ki**: a visszatérítések után változatlan a sorok száma, nincs `Visszavonas` / `Korrekcio` / `Visszaterites` / új `purchase` sor; az újrajátszás `mar_kuldve`; 0 dupla |

### A 9. eset korlátja (előre rögzítve)
A visszatérítést a Stripe teszt-módú kulcsával kell létrehozni. A vizsgált előnézeten (#128) nincs ilyen segéd, és kódot nem módosíthatunk; a segéd (`ajandek_teszt_visszateritese`, csak `sk_test_` / `rk_test_` kulccsal) a **#138 előnézetén** van, ugyanazzal a megosztott Preview-titokkal, ugyanabban a Stripe teszt-fiókban, ezért ő hozza létre a visszatérítést a #128 vásárlásán (`--refund-bazis`). A Stripe teszt-módú webhook-végpontja a #128 előnézetét valószínűleg **nem** éri el (a QA-2-ben is kulcsos újrajátszás kellett), így a `charge.refunded` ág a #128-on nem fut le magától: az eset azt bizonyítja, hogy a visszatérítés **önmagában** nem generál eseményt, és hogy az újrajátszás utána sem küld újat. Ha a webhook mégis célba ér, az a #89-es meglévő viselkedést (a szalon levelet kap a kupon törléséről) is kiváltja – ezt a napló jelzi.

## Ismert zaj és versenyhelyzetek
- **Az élő Zap a Salonic-leveleket a #128 végpontjára is továbbítja.** Ezért a 2026-10-06-i életút-E2E (a #138 saját előnézetén, saját adatbázissal) TESZT-foglalásainak levelei is megjelentek a #128 adatbázisában: `foglalas_egyeztetes` sorok `fuggoben` állapotban (a böngésző köszönőoldali írása a másik előnézet adatbázisába ment, ezért nincs páros; 3–4 próba után `parositatlan` + riasztás lesz belőlük), és `foglalas_lemondas` sorok a lemondási értesítőkből. A Salonic-UUID-k: `b10a9aa2-91f1-8e8d-1672-bad1a9b456ae`, `a4f63cdf-b163-5310-e68a-fd1241590604`, `74c76e6b-fc51-7684-e188-887a5d28a4b0`, `8daa568f-d564-15b8-758a-7171603886b5`, `177b9d88-d6a6-694c-1953-db48e00de5d1`, `d579f9a8-9e96-6f5d-4641-470fd3eec28b` (mind „TESZT – Claude”; a #128 adatbázisához nem nyúltunk). Egy további, `f6e5962c-ebc8-a129-0a75-7cc985f63ee0` UUID-jú `fuggoben` sor (2026-10-06 18:43 UTC) **nincs** a #138 tesztfoglalásai között (eredetét nem ismerjük; személyes adatot nem olvastunk ki). A QA-3 vizsgálat az itt felsorolt sorokat zajként kezelje.
- **Verseny az élő Zappal:** ha a Zap a saját levelét hamarabb küldi a végpontra, mint a futtató szimulált levele, az 1. saját hívás `mar_kuldve`-t kap (a cellák végesek). A futtató ezt elfogadja és jelzi (`megjegyzes`), az esemény-sorok így is ugyanazok.
- **Szimulált elemek** (a napló `szimulalt` mezője jelzi): az „új vendég” / „nem új vendég” jelzés (a levélben a hívó adja; a TESZT-vendég a Salonicban valóban nem új), a kuponos eset levélbeli szolgáltatás-neve és ára. A foglalások, a lemondások, a Stripe-vásárlás és -visszatérítés valódiak.
- **Lemondási értesítő (3b):** a név-párosítás a szolgáltatás- és munkatárs-névtáblán múlik; ha az értesítő `ismeretlen`-t ad, az a megfigyelés része (nem tesztelési hiba), és a kulcs nem szabadul fel.
- A Meta / TikTok / GA4 oldali megjelenést (Tesztesemények, DebugView) a platformok felületén kell nézni; ez az eszköz a kiküldött kérést és a platform HTTP-válaszát naplózza.
