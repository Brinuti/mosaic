# QA-3 kontrollált tesztek – terv, eszköz, ismert zaj

Állapot: 2026-10-06 (terv). Futtatás: **2026-10-07, 10:00–18:00 (Budapest)** a **PR #128 előnézetén** (`https://claude-mosaic-meres-qa-1-rrb.mosaic-d77.pages.dev`), **kód- és ág-módosítás nélkül** (nincs push a `claude/mosaic-meres-qa-1-rrbwkk` ágra, nincs deploy; a tesztek csak HTTP-hívások és böngészős foglalások). Az eszköz és a terv a `claude/mosaic-meres-eletut` ágon (PR #138) van, a #128-at nem érinti.

## Elfogadási mérce (egyeztetve Ferivel, 2026-10-06)
**Háttér:** a #128 árnyékmérésben a párosítás a köszönőoldali **böngészős írásra** épül, ami csak az előnézeten fut; az éles oldalon ki van kapcsolva. Ezért a 24 órás ablakban minden **valódi** Salonic-foglalás `parositatlan` + riasztás állapotban zárul, kiküldött esemény nélkül (igazolva: a 2026-10-06 20:43-as valódi fodrász-foglalás, `f6e5962c-ebc8-a129-0a75-7cc985f63ee0`, 5 próba, 0 küldés).

**A mérce:**
- **Valódi foglalások (24 órás ablak):** minden valódi Salonic-foglalás levele **1:1** beérkezik és rögzül (a Salonic valódi foglalás-listájához képest, UUID-nként a `foglalas_egyeztetes` soraiban); **0 élő küldés**, és a valódi foglalásokra egyáltalán **0 küldés** (az elvárt végállapot a tervezett `parositatlan` + riasztás). A **párosítás a valódi foglalásokon nem mérhető** (nincs böngészős írás), ezért a „0 téves párosítás” itt üres állítás, és nem is ezen mérjük.
- **TESZT-esetek (a #128 előnézetén):** a teljes lánc – párosítás → platformküldés – `booking_id`-szinten **1:1** (lásd az esetek táblázatát).

**Pontosítások a mérce értelmezéséhez:**
1. **Nevező:** a valódi foglalások számlálásához a **Salonic aktív foglalásai + a törölt foglalások exportja ugyanarra a 24 órás ablakra** kell (a sima export a lemondottakat nem tartalmazza, pedig a lemondott foglalás levele is beérkezik), **ellenőrző forrásként a Gmail Salonic-levelei UUID-nként**. Ezt a listát **a mérési munkamenet adja a QA-3 csomagban 2026-10-07 20:00 után**, vendég-adat nélkül (UUID, üzletág, létrehozás és lemondás időpontja); Feritől nem kell elkérni, és én sem olvasom a Gmailt / a Salonicot ehhez. **Az én számlálóm a #128 `foglalas_egyeztetes` sorai UUID-nként** (lásd lent); az összevetést a csomagban együtt csináljuk. A vendégnév nincs a csomagban, ezért a **TESZT-foglalásokat** a saját futtatásaim UUID-listája szűri ki (a `qa3-*-2026-10-07.json` naplók `salonic_uuid` mezői + az „Ismert zaj” fejezet UUID-i), nem a név.
2. **Lemondási értesítők:** a valódi lemondási értesítő időpont + szakember alapján párosít, a TESZT-eszközök pedig mindig ugyanazt az utolsó szabad időpontot foglalják, ezért egy valódi lemondás egy régi TESZT-kulcsot is felszabadíthat (2026-10-06 estéjéig 9 `felszabadult` sor a `foglalas_lemondas`-ban, a nap folyamán nőtt). Ez naplózási zaj, nem küldés: a lemondásnál felszabadult TESZT-kulcsokat a kimeneti táblázatban **külön sorban** számoljuk, **nem** a téves párosítások között.
3. **Riasztás:** a valódi foglalások miatt a riasztási lista (`GET ?riasztas=1`) a #128-on tartósan nem üres; ez a **várt állapot**, a riasztás-darabszám itt nem egészségjelző.
4. **A PASS nem jelent éles készenlétet:** a teljes lánc csak az előnézeten bizonyított; a valódi forgalomra vonatkozó, még nem mért feltételek az **ÉLES-KAPU feltételei** között vannak (lásd alább).

### Kimeneti táblázat a valódi foglalásokhoz (24 órás ablak)
| sor | forrás | elvárt |
|---|---|---|
| Salonic aktív foglalások (valódi) | mérési munkamenet csomagja (Salonic) | – (nevező része) |
| Salonic törölt foglalások (valódi, export) | mérési munkamenet csomagja (Salonic törölt-export) | – (nevező része) |
| Gmail Salonic-levelek, UUID-nként (valódi) | mérési munkamenet csomagja (Gmail) | egyezik a Salonic-listával |
| beérkezett és rögzült (`foglalas_egyeztetes` sor UUID-nként) | #128 D1, csak olvasás | = nevező (1:1); hiányzó / többlet külön felsorolva |
| `parositatlan` + riasztás | #128 D1 | a valódi foglalások (az elvárt végállapot) |
| kiment esemény a valódi foglalásokra (bármely platform, árnyék is) | `meres_kuldes` | **0** |
| élő küldés | – | **0** |
| téves párosítás (valódi foglalás párosult) | `foglalas_egyeztetes.booking_id` | **0** (üres állítás, lásd fent) |
| lemondásnál felszabadult TESZT-kulcsok (**külön sor**) | `foglalas_lemondas` | csak tájékoztató darabszám |

### Az én számlálóm (a #128 `foglalas_egyeztetes` sorai UUID-nként; csak olvasás)
A csomagban az összevetéshez UUID-listát adok át (vendég-adat nélkül): `uuid`, `allapot`, `probalkozas`, `riasztas`, `booking_id` megléte, létrehozás ideje, valamint hogy van-e `meres_kuldes` sora. A lekérdezés (a 24 órás ablak határait a csomag adja; a TESZT-UUID-ket a fenti lista szűri ki):
```sql
SELECT e.uuid, e.allapot, e.probalkozas, e.riasztas, (e.booking_id IS NOT NULL) AS parositott,
       datetime(e.letrehozva,'unixepoch') AS letrehozva,
       (SELECT count(*) FROM meres_kuldes k WHERE e.booking_id IS NOT NULL AND k.source_id = e.booking_id) AS kuldesi_sorok
FROM foglalas_egyeztetes e
WHERE e.letrehozva >= strftime('%s', :ablak_kezdete) AND e.letrehozva < strftime('%s', :ablak_vege)
ORDER BY e.letrehozva;
```
A lemondásnál felszabadult TESZT-kulcsok külön sora: `SELECT count(*) FROM foglalas_lemondas WHERE eredmeny = 'felszabadult' AND ido >= … AND ido < …` (tájékoztató darabszám, nem téves párosítás).

## ÉLES-KAPU feltételei (a mérés élesítése előtt)
*Ez a lista a **fejlesztői forrás**. A Drive-on a DECISION-LOG #105 rögzíti ugyanezt; azt a mérési munkamenet vezeti, az átvezetés nem a fejlesztő dolga.*

**Éles indulás előtt a valódi foglalásokra külön kapuként meg kell ismételni a mérést** – a QA-3 PASS ezt nem helyettesíti. A kapu csak azután mérhető, hogy az éles köszönőoldal böngészős írása be van kapcsolva (addig a valódi foglalások nem párosodnak). A kapu mérendő feltételei, valódi foglalásokon:
1. **párosítási arány** (a valódi foglalások hány százaléka párosodik helyesen, `booking_id`-szinten);
2. **`uj_vendeg`** helyes kinyerése a valódi levelekből (a Salonic jelzése szerint);
3. **ár** helyes kinyerése a valódi levelekből (a tényleges ár, vs. a Salonic);
4. **szolgáltatásnév** helyes kinyerése a valódi levelekből (a kupon- és konzultáció-felismerés alapja).

A küszöbértékeket (pl. párosítási arány) a QA-3 eredménye után, a mérési munkamenettel és Ferivel kell rögzíteni; itt számot nem állítunk be.

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
- **ÁLLAPOT: „a Zap látja a TESZT-leveleket” (tény, a Zap beállításából; Feri közlése 2026-10-07).** Az árnyék-Zap (01a1125b) Gmail-keresése a **teljes postafiókban** keres, címke- vagy mappaszűrés nélkül. A „TESZT-levelek” mappa csak elrakja a levelet a beérkezettek közül; a Zap továbbra is látja és továbbküldi a #128 végpontjára. Az ismert zaj és a Zap-versenyhelyzet ezért **marad**. A Zaphoz a #128 24 órás ablaka alatt (2026-10-07 20:00-ig) nem nyúlunk. A jelentésben ezt az állapotot rögzítjük.
- **A TESZT-mappa szűrője** a levél **szövegére** épül (nem az e-mail-címre; a `deakfi@grantis.hu` nem feltétel): a levél az `app@salonic.hu` címről jött, és a szövegében (gyakorlatilag a vendégnévben) szerepel: „TESZT – Claude”, „TESZT Claude”, „Feri teszt”, „teszt teszt” vagy „Próbafoglalás (TESZT)”. A mappa csak postafiók-rendezés, a számlálást **nem** befolyásolja. **A TESZT-esetek kiszűrése a nevezőből a megbeszélt módon, az én (a futtató) UUID-listám alapján történik (DECISION-LOG #105); erre a mappát NEM használjuk.**
- **Az élő Zap a Salonic-leveleket a #128 végpontjára is továbbítja.** Ezért a 2026-10-06-i életút-E2E (a #138 saját előnézetén, saját adatbázissal) TESZT-foglalásainak levelei is megjelentek a #128 adatbázisában: `foglalas_egyeztetes` sorok `fuggoben` állapotban (a böngésző köszönőoldali írása a másik előnézet adatbázisába ment, ezért nincs páros; 3–4 próba után `parositatlan` + riasztás lesz belőlük), és `foglalas_lemondas` sorok a lemondási értesítőkből. A Salonic-UUID-k: `b10a9aa2-91f1-8e8d-1672-bad1a9b456ae`, `a4f63cdf-b163-5310-e68a-fd1241590604`, `74c76e6b-fc51-7684-e188-887a5d28a4b0`, `8daa568f-d564-15b8-758a-7171603886b5`, `177b9d88-d6a6-694c-1953-db48e00de5d1`, `d579f9a8-9e96-6f5d-4641-470fd3eec28b` (mind „TESZT – Claude”; a #128 adatbázisához nem nyúltunk). **2026-10-07 reggeli diagnosztikai reprodukció** (szőr / oxigén köszönőoldal-lánc, 06:37–06:44 UTC, „TESZT – Claude”, valódi Salonic, tiltott kimenő méréssel, azonnal lemondva) további 4 levelet küldött a #128 végpontjára: `b3b43d18-3be8-de23-a701-1005f708ecf9` (szőr, a motorban), `c72368ea-cdaf-375f-cbdf-aff391a294dc` (szőr, közvetlen Salonic-adatlap), `9a201674-83cf-8a1c-1e4b-e7d932b88e3b` (oxigén-konzultáció), `c51a3121-3490-4421-ac3e-89ea5a8a63c1` (szőr, `start=` átadással) – ezek is zajnak számítanak. (A `f9f10dc7-f652-dea6-d267-91de4f1b446e` HeadSpa-sor, 06:18 UTC, nem az én futtatásomból való; mivel a Zap minden levelet továbbít, más TESZT-levél is lehet – a TESZT-UUID-lista véglegesítéséhez a mérési munkamenet jelezze.) Egy további, `f6e5962c-ebc8-a129-0a75-7cc985f63ee0` UUID-jú `fuggoben` sor (2026-10-06 18:43 UTC) **nincs** a #138 tesztfoglalásai között (eredetét nem ismerjük; személyes adatot nem olvastunk ki). A QA-3 vizsgálat az itt felsorolt sorokat zajként kezelje.
- **Verseny az élő Zappal:** ha a Zap a saját levelét hamarabb küldi a végpontra, mint a futtató szimulált levele, az 1. saját hívás `mar_kuldve`-t kap (a cellák végesek). A futtató ezt elfogadja és jelzi (`megjegyzes`), az esemény-sorok így is ugyanazok.
- **Szimulált elemek** (a napló `szimulalt` mezője jelzi): az „új vendég” / „nem új vendég” jelzés (a levélben a hívó adja; a TESZT-vendég a Salonicban valóban nem új), a kuponos eset levélbeli szolgáltatás-neve és ára. A foglalások, a lemondások, a Stripe-vásárlás és -visszatérítés valódiak.
- **Lemondási értesítő (3b):** a név-párosítás a szolgáltatás- és munkatárs-névtáblán múlik; ha az értesítő `ismeretlen`-t ad, az a megfigyelés része (nem tesztelési hiba), és a kulcs nem szabadul fel.
- A Meta / TikTok / GA4 oldali megjelenést (Tesztesemények, DebugView) a platformok felületén kell nézni; ez az eszköz a kiküldött kérést és a platform HTTP-válaszát naplózza.

## 2026-10-07 futtatás – nyers megjegyzések (értelmezés nélkül)
- **A 9 eset, 14 futás:** `meres-naplo/qa3-osszefoglalo-2026-10-07.md` és `qa3-<eset>-2026-10-07.json` (esetenként booking_id / PI, platformonkénti `esemeny_id`-k, elvárt / tényleges). A kiment sorok a #128 D1-ben (csak olvasás) is ellenőrizve: 14 forrás, 0 dupla `(esemeny_id, platform)`, a kiment sorok Meta 24 (HTTP 200, `events_received: 1`, `TEST83939`), TikTok 24 (200, `code 0`, `TEST83543`), GA4 13 (204, előzetes validáció tiszta), Google 11 (Zapier `success`).
- **3a, első futás (`qa3-lemondas-elotte-elso-futas-munkatars-nelkul-*`):** a futtató szimulált levele nem tartalmazta a munkatárs nevét, ezért a törölt foglalás levele nem párosodott (`fuggoben`; a Salonic a törölt foglalás oldalát a `deleteSuccess` oldalra irányítja, kulcs nem olvasható, a név-tartalék ág `ismeretlen munkatárs`), 0 küldés, nincs cella-sor. **Eszköz-hiba**, a #138 ágon javítva (`qa2-szerver.mjs`: a levél a munkatárs nevét is viszi, mint a valódi); az újrafuttatás: párosult, `elo_allapot: torolve`, minden cella `kihagyva` (lemondva), 0 küldés.
- **A Zap saját levele (versenyhelyzet, „a Zap látja a TESZT-leveleket”):** 12 foglalásnál a Zap levele 26–110 másodperccel a futtató levele után érkezett, és mivel a TESZT-vendég a Salonicban nem új, `uj_vendeg=false`-szal `Visszajaro:<booking_id>` alapesemény-sorokat hozott létre (foglalásonként 4, mind `kihagyva`: „a foglalás az esemény elküldése előtt lemondva”, mert a futtató addigra lemondta). Új kiküldés ebből nem lett.
- **EXTRA eset (nem a 9 eset), `dupla-level-eltero-jelzes`: FAIL (3/5).** Két levél ugyanarra az **élő** foglalásra, az elsőben `uj_vendeg: igen`, a másodikban `nem` (a Zap levele ezt adja): az 1. levél után 6 esemény ment ki (FoglalasElso + Schedule), a 2. levél után **9** — a 2. levél `Visszajaro:<booking_id>` alapeseményt is kiküldte Metára, TikTokra és GA4-re (`allapot: kesz`, nem `mar_kuldve`). Vagyis a deduplikáció az esemény-névre (`esemeny_id`) kulcsol, nem a foglalásra: eltérő „új vendég” jelzésű két levél egy foglalásra két alapesemény-típust küldhet ki. Mérés (árnyék-célok, TESZT-foglalás); a #128 kódja nem változott. A döntés a mérési munkamenetre / Ferire vár.
- **9. eset:** a két Stripe teszt-visszatérítést (3 000 Ft, majd a maradék 23 900 Ft) a #138 előnézete hozta létre a megosztott teszt-kulccsal; a #128-on a visszatérítések után nem lett új sor, az újrajátszás `mar_kuldve`.


## QA-3 állapota és a lezárás szabálya (2026-10-07 este; a GPT döntése szerint)

**Állapot: IN_PROGRESS, 1 BLOCKER – X1.** A 9 eset 14 futása PASS, de az X1 (két levél, eltérő „új vendég” jelzéssel: egy foglalásból két alapesemény-típus) blokkoló. A QA-3 ezért **nem** zárható le a mai futással.

**Teendők sorrendben:**
1. Az X1-javítás (az alapesemény típusa foglalásonként az első levélnél rögzül: `netlify/lib/meres/jelleg-rogzites.js`, lásd `QA2_ARNYEK.md`) a #128 ágra **2026-10-07 20:15 (Budapest) után**, a QA-3 nyers számainak átadása után megy; addig a #128-hoz nem nyúlunk.
2. **Célzott regressziós újrateszt a #128 előnézetén, 6 eset** (a futtató: `tools/meres-proba/qa3-futtat.mjs`, kimenet: `meres-naplo/qa3-<eset>-2026-10-07-javitas-utan.json`; az eredeti X1 FAIL naplók érintetlenek maradnak):

   | # | eset | futtató `--eset` | elvárt (Meta, TikTok, GA4, Google) |
   |---|---|---|---|
   | R1 | X1: két levél, eltérő jelzéssel – **KÉT sorrend, mindkettő kötelező**: (a) új → nem új, (b) nem új → új. A Zap és a futtató levele bármelyik sorrendben megérkezhet, ezért a javításnak mindkét irányban jónak kell lennie. **Az R1 csak akkor PASS, ha mindkét futás PASS** (a 6 eset száma ettől nem nő) | `dupla-level-eltero-jelzes` (a) + `dupla-level-eltero-jelzes-forditva` (b) | (a) 2, 2, 1, 1; (b) 1, 1, 1, 0; mindkettőben a 2. levél nem küld semmit |
   | R2 | páros HeadSpa, a **valódi minta** szerint (TÉNY a Gmail-ben megnézett mai 10 levélpár alapján: mindkét levél ugyanazt az „új vendég” jelzést hordozza, a foglalási azonosító ugyanaz, a 2. levél csak a `mosaicheadspa@` címre megy): két levél, azonos booking_id, azonos jelzés. A páros foglalás élesben tehát nem hoz ellentmondó jelzést; az X1 a Zap és a futtató versenyéből ered, és akkor fordulhat elő élesben, ha két forrás eltérő jelzést ad ugyanarra a foglalásra | `paros-headspa` | az 1. levél után 2, 2, 1, 1; **a 2. levél semmit nem küld** (`mar_kuldve`, eltérés-jelzés nincs) |
   | R3 | normál (fizetős) első foglalás, nem konzultáció | `elso-foglalas` (oxigénterápiás első kezelés) | 2, 2, 1, 1; `FoglalasElso`, nem `Konzultacio` |
   | R4 | valódi visszajáró: **nincs szimulált levél**, az élő Zap valódi Salonic-levelét várjuk | `valodi-visszajaro` | 1, 1, 1, 0; csak `Visszajaro`, ernyő nincs |
   | R5 | ugyanaz a levél kétszer | `dupla-level` | 2, 2, 1, 1; a 2. hívás `mar_kuldve` |
   | R6 | platformonkénti darabszám és `esemeny_id` duplázás-ellenőrzés az R1–R5 foglalásain, a késő Zap-levelek után is | `darabszam-ellenorzes` (utoljára, késleltetéssel) | az összeg = az elvárt összeg; 0 dupla `(esemeny_id, platform)`; foglalásonként egy alapesemény-típus |

   Az R2 korlátja (a naplóban is szerepel): a `/api/foglalas-egyeztetes` bemenetnek nincs címzett-mezője, ezért a „2. levél csak a `mosaicheadspa@` címre megy” a szimulációban nem fejezhető ki; a szerver számára a 2. levél azonos azonosítójú, azonos jelzésű levél. TÉNY (a Gmail-ben megnézve, két mai pár): a két valódi páros levél törzse karakterre azonos (19 493 és 19 634 karakter, 0 eltérés), csak a címzett más, hiányzó mező nincs – így a szimuláció pontos, az R2 ebben a formában marad.
   Az eltérést (elvárt ≠ tényleges) a futtató minden ellenőrzésnél naplózza; a Zap-versenyhelyzet (ha a Zap levele hamarabb ér oda, az ő jellege rögzül az adott TESZT-foglalásnál) a naplóban külön látszik.
3. **Ha mind a 6 eset PASS**, indul az **új, tiszta 24 órás QA-3 ablak** (az ablak kezdete: az újrateszt zöld lezárása után, javítási kódváltozás nélkül, a rögzített dátum-idővel). A valódi foglalások számlálása (a fenti mérce) erre az új ablakra történik.
4. **QA-3 FINAL PASS csak ennek az új 24 órás ablaknak a hibamentes lezárása után adható.** A mai 14 futás és az újrateszt nem elég hozzá. A QA-3 PASS továbbra sem élesítési készség: az ÉLES-KAPU feltételei külön állnak.

## DÖNTÉS #108 (GPT + Feri, 2026-10-07 ~18:35 UTC): R7, tesztszűrés négy osztályban, háromutas egyeztetés
1. **A `fuggoben` végállapot hiba.** Az utolsó próba után a rekord **automatikusan `parositatlan`-ba megy, egyszeri riasztással, 0 küldéssel, és a későbbi próba sem küldhet semmit** (a `parositatlan` lezárt állapot; a „késői párosítás” – `keses` – már nem küld). Háttér (mért): a #128-on a Zap 4 próbát tesz (0, ~1, ~4, ~14,5 perc), a végpont ütemezése viszont 5 próbát várt (az 5. ~44 perc), ezért az ablak 23 nem-TESZT sora `fuggoben` (4 próba, riasztás nélkül) maradt. **Új regressziós eset: R7** (a javítás a #128-ra az R1–R6 újrateszt után megy).
   - **R7** (`--eset fuggoben-lezaras`, futtató): **valódi** foglalás a #128 előnézetén **köszönőoldali kulcs-írás nélkül** (a böngésző `/api/foglalas-kulcs` kérése blokkolva → a foglalás soha nem párosítható, mint az éles oldalon); az élő Zap valódi levele + próbái; elvárt: a lezárás után `parositatlan`, `riasztas = 1` (a riasztás-listában pontosan egyszer), **0 `meres_kuldes` sor**, majd egy saját szimulált későbbi levél is `parositatlan`, `kuldheto: false`, 0 küldés.
2. **Az új 24 órás QA-3 kör csak akkor indul, ha R1–R7 mind zöld** (az R7-javítást tartalmazó kódon, azaz az R1–R6-ot az új kódon újra kell futtatni). A kiértékelés az ablak **vége után 45–60 perccel** jön.
3. **Tesztszűrés négy osztályban** (a számlálóban és az egyeztetésben):
   - `CONTROLLED_TEST`: a futtató UUID-listája (`meres-naplo/qa3-teszt-uuid-lista-*.txt` és az adott kör futtatásainak `salonic_uuid` mezői);
   - `OTHER_TEST`: korábbi QA-UUID vagy tesztnév (pl. „TESZT – Claude”, „Feri teszt”, „teszt teszt”, „Próbafoglalás (TESZT)”). **A 2026-10-07-i 7 eltérő UUID és Feri 3 saját nevű foglalása `OTHER_TEST`** (a 7 + 3 UUID-t a mérési munkamenet csomagja adja; kapja meg a listát egy `meres-naplo/qa3-other-test-uuid-lista-*.txt` fájl);
   - `REAL`: a valódi vendég-foglalások;
   - `UNKNOWN`: ami egyik osztályba sem sorolható – a csomagban külön sor, nem találgatjuk.
4. **A kör végén háromutas egyeztetés (Claude): Salonic online foglalás = Gmail UUID = #128 `foglalas_egyeztetes` sor.** UUID-nként: van-e mindhárom helyen (hiányzó láb külön lista); vendégadat nélkül (UUID, üzletág, létrehozás / lemondás ideje, állapot, párosított, küldési sorok); a TESZT-osztályok szerint bontva. Az 1. és 2. forrás (Salonic aktív + törölt export, Gmail UUID-lista) a mérési munkamenet csomagjából jön; Claude nem kéri Feritől és nem olvassa a Gmailt / Salonicot.

## Az új, tiszta 24 órás QA-3 ablak (R1–R7 mind PASS) – rögzítve 2026-10-07 22:19 Budapest (20:19 UTC)
**Az R1–R7 újrateszt az R7-javítást tartalmazó kódon (#128 `ca2ff64`, élesedés 2026-10-07 20:45:53 Budapest / 18:45:53 UTC): 7 / 7 eset PASS** (futás: 21:50:33 → 22:18:14 Budapest; `--nap 2026-10-07-r7-utan`; nyers naplók és összefoglaló: `meres-naplo/qa3-*-2026-10-07-r7-utan.json`, `qa3-osszefoglalo-2026-10-07-r7-utan.md`):

| eset | booking_id | eredmény |
|---|---|---|
| R1a (új → nem új) | `mb_0muyjg8cxm5jhu0se5dt3bc` | PASS |
| R1b (nem új → új) | `mb_0muyjh8mtg7mp4jlzzwhpge` | PASS |
| R2 páros HeadSpa (valódi minta) | `mb_0muyji8447cpxnjj2gtmbqk` | PASS |
| R3 fizetős első foglalás | `mb_0muyjj838g82bj12rmyeq98` | PASS |
| R4 valódi visszajáró (a Zap valódi levele) | `mb_0muyjk7f4pp91jaz21pxc2m` | PASS |
| R5 ugyanaz a levél kétszer | `mb_0muyjoz9mtufugd58fwq41a` | PASS |
| R6 darabszám + duplázás (R1–R5) | – | PASS: Meta 10, TikTok 10, GA4 6, Google 4 = elvárt, 0 dupla |
| R7 `fuggoben` lezárása (a köszönőoldali kulcs-írás blokkolva, az élő Zap próbái) | `mb_0muyivlh3cdjvdf0e8tk2te` (UUID `ab2e46ff-4039-4d0e-b570-bc97bd56348e`) | PASS: `nincs sor → fuggoben/1 → /2 → /3 → parositatlan/4` (a 4. próbánál, 22:06:18 Budapest), `riasztas = 1` (a listában egyszer), 0 `meres_kuldes`, a késői szimulált level `parositatlan` / `kuldheto: false` / `lezart: true`, az állapot változatlan |

(Az R7 előzetes, megszakadt futása – a konténer újraindult – a D1-ből ugyanezt mutatta: `011d67f0-…`, `parositatlan`, 4 próba, riasztás 1, 0 küldés; lásd `qa3-fuggoben-lezaras-megszakadt-futas-2026-10-07-r7-utan.md`.)

**Az ablak (pontos):**
- **Kezdete: 2026-10-07 22:20:00 Budapest = 2026-10-07 20:20:00 UTC**
- **Zárása: 2026-10-08 22:20:00 Budapest = 2026-10-08 20:20:00 UTC**
- A kiértékelés az ablak vége után **45–60 perccel** jön (2026-10-08 23:05–23:20 Budapest, 21:05–21:20 UTC); a zárásnál Feri belép az 5 Salonic-fiókba (aktív + törölt export). **QA-3 FINAL PASS csak ennek az ablaknak a hibamentes lezárása után adható** (a GPT-től).

**Az ablak alatt (tiszta kör szabályai):**
- A #128 ága és előnézete **változatlan** (fej: `ca2ff64`); nincs push, nincs deploy rá.
- A kill switchekhez (`meres_kapcsolo`) és a Zaphoz (01a1125b) nem nyúlunk.
- Claude **nem hoz létre TESZT-foglalást** az ablak alatt (a Zap a Feri-féle / más tesztleveleket úgyis továbbítja: azok `OTHER_TEST`). Az ablakba eső, a retest foglalásaihoz tartozó késői Zap-levelek `CONTROLLED_TEST` (a lista: `meres-naplo/qa3-teszt-uuid-lista-2026-10-08-ablak.txt`).
- A #138 ág változhat (nem a mért kód).

**A zárás utáni teendő (Claude) – a számláló és a háromutas egyeztetés:**
1. A #128 D1-ből (csak olvasás, vendégadat nélkül) a `foglalas_egyeztetes` sorok az ablakra (`letrehozva` ≥ 20:20:00 UTC és < 2026-10-08 20:20:00 UTC), négy osztályban: `CONTROLLED_TEST` (a fenti lista), `OTHER_TEST` (tesztnév / korábbi QA-UUID – a mérési munkamenet listája), `REAL`, `UNKNOWN`. A felszabadult kulcsok (`foglalas_lemondas.eredmeny = 'felszabadult'`) külön sorban.
2. **Háromutas egyeztetés:** Salonic online foglalás = Gmail UUID = #128 sor, UUID-nként; a hiányzó lábak külön listán. A Salonic-export és a Gmail UUID-lista a mérési munkamenet csomagjából jön.
3. Az állapotok: a lezárás utáni elvárás szerint a valódi foglalások `parositatlan` + riasztás (nem `fuggoben`), 0 küldés; a lusta lezárás a számlálás előtt lefut (egy kulcsos GET elég).
4. A nyers számok értelmezés nélkül, előbb Ferinek.
