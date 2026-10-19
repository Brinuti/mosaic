# 7 napos utolsó fizetett kattintás – forrásmérés mind az 5 üzletágban

**MÉRÉST ÉRINTŐ változás.** Döntés: Feri (a tulajdonos) kifejezett kérése, 2026-10-19 (#167, 6275958914. komment; közös szabály: Drive `FORRASMERES-KOZOS-SZABALY-4-PROJEKT-2026-10-13.md`, „FERI DÖNTÉSE (2026-10-14 21:30)”). A Mosaic ugyanazt kapja, ami a Medical Piercingen (MP) már él (`medicalpiercing/lib/meres/cimke.js`, `mp_lpt`, `bizonyitek_forras='suti'`). Az 1–2. pont (süti, címkézés a saját D1-ben) és a 3. pont (a sütiből visszanyert azonosító az élő eseményekbe) a CLAUDE.md „Állandó felhatalmazás” 4/a szabálya szerint **csak több adatot** juttat a már élő konverziókhoz: új konverziót nem hoz létre, hirdetési fiókhoz, GTM-hez, pixelhez nem nyúl. Napló: [meres-naplo/2026-10-19-lpt-7nap.md](meres-naplo/2026-10-19-lpt-7nap.md).

## Mi ez, és miért kell

A foglalás forrását eddig a böngésző JavaScript-tárolója (`mh_attr`, `localStorage`) vitte. A Safari (ITP) a script által írt tárolót 7 nap után törli, így aki hétfőn rákattint egy hirdetésre és csütörtökön, direktben foglal, az „ismeretlen” vagy „direkt” lett. Megoldás: a **szerver** írja a sütit (`Set-Cookie`, HttpOnly, saját domain), amelyet az ITP nem vág 7 napra, és a foglaláskor ebből olvassuk vissza az utolsó fizetett kattintást.

```
hirdetés → landing (?gclid / fbclid / ttclid / utm…) ──► attribucio.js: erintes (sessionStorage + 2 oras tarolo)
                                                       └► POST /api/mosaic-forras  ──► Set-Cookie: mh_lpt (HttpOnly, 30 nap)
… napok mulva, direktben ──► foglalo megnyilik ──► GET /api/mosaic-forras ──► { klikk: { gclid | fbclid | ttclid } } (memoriaban)
                         └► sikeres foglalas: a foglalo-atadas a koszonooldal URL-jere fuzi a hianyzo azonositot
                            (→ a bongeszobol indulo GTM / pixel ELO esemenyei az URL-bol megkapjak)
koszonooldal (foglalas-kulcs.js → mhAttribucio.kuld) ──► POST /api/meres-erkezes (valtozatlan) + additiv: forras / forras_tarolo / lpt_potlas
   szerver: kezelErkezes (valtozatlan) → meres_forras sor (cimke + bizonyitek_forras) + attr-potlas a sutibol + valasz.forras
```

## A süti: `mh_lpt`

* `Set-Cookie: mh_lpt=<base64url>; Max-Age=2592000; Path=/; HttpOnly; Secure; SameSite=Lax` (30 nap, host-only; JS-ből nem olvasható).
* Tartalom (kompakt JSON, base64url, legfeljebb 1200 karakter): `{v:1, p, us, um, uc, ut, uco, gc, ag, ad, kp, kv, t}`
  * `p` platform (`google|meta|tiktok`; a szerver számolja), `us/um/uc/ut/uco` tisztított `utm_source/medium/campaign/term/content` (nem engedett karakter `_`-ra cserélve, max 100 karakter; a Meta kötelező UTM-je a kampány *nevét* adja szóközökkel), `gc` kampány-azonosító (`gad_campaignid` | `campaignid` | Metánál `utm_id`; csak számjegy, max 20), `ag` hirdetéscsoport (`adgroupid`), `ad` hirdetés (`adid` | Metánál `ad_id`), `kp` kattintási paraméter **típusa** (`gclid|gbraid|wbraid|fbclid|ttclid`), `kv` a **nyers** kattintásazonosító (az `netlify/lib/meres/erkezes.js` mintája szerint: gclid/gbraid/wbraid `[A-Za-z0-9_-]{10,200}`, fbclid `{8,200}`, ttclid `[A-Za-z0-9_.-]{8,200}`), `t` az érkezés ideje (unix mp, **a szerver ideje**, nem a kliensé).
  * A hosszkorlat miatt, ha kell, előbb `ut`, `uco`, `us`, `um` marad el; a kattintásazonosító mindig megmarad.
* **Csak a legutóbbi FIZETETT kattintás** kerül bele (kattintási paraméter vagy fizetett `utm_medium`: `cpc, ppc, paid, paid_social, paidsocial, paid_search, cpm`). Újabb fizetett kattintás felülírja; **nem fizetett érkezés (organikus, direkt, hírlevél) nem ír és nem töröl**. Ugyanannak a kattintásnak (azonos azonosító) az újratöltése nem frissíti az időt.
* Marketing-hozzájárulás: **kifejezett elutasítás** (`hozz.adv === false`) esetén sütit nem írunk, a meglévőt töröljük (`Max-Age=0`). Döntés nélkül az alapérték (granted, DECISION #170) érvényes; a tárolt elutasítás marad érvényes.
* A süti nincs aláírva (egy látogató a saját böngészőjében átírhatja, ami csak a saját attribúcióját érinti); a szerver minden mezőt újra tisztít, ismeretlen mezőt eldob, hamis / sérült / lejárt / jövőbeli értéket nem fogad el.

## Végpont: `/api/mosaic-forras` (`functions/api/mosaic-forras.js` → `netlify/lib/meres/forras-lpt.js`)

| Kérés | Mit csinál |
|---|---|
| `POST {forras, hozz}` | fizetett érintés → `Set-Cookie` (a szerver idejével) · nem fizetett → nincs teendő · `hozz.adv === false` → törlés |
| `GET` | `{ok, suti, platform, kor_nap, klikk:{gclid?\|gbraid?\|wbraid?\|fbclid?\|ttclid?}}` a 30 napon belüli sütiből; nincs / lejárt / hamis süti vagy `?adv=0` → `{ok:true, suti:false, klikk:{}}`. Utm nem megy ki. |

Védelem: csak azonos eredet (Origin / `Sec-Fetch-Site: same-origin`, különben 403), csak a Mosaic hostok (`www.mosaicheadspa.hu`, `mosaicheadspa.hu`, `*.pages.dev`, `localhost` / `127.0.0.1`; más 404), `Cache-Control: no-store`, a POST törzse legfeljebb 4000 karakter (413), nem JSON / nem objektum 400, más metódus 405, `MOSAIC_LPT_KI=1` → 503.

## Címkézés (zárt lista) és bizonyíték-választás

`forras_cimke`: `meta | tiktok | google_nem_markas | google_markas | organikus_direkt | ismeretlen` (az MP `cimkez()` portja). Fizetett = kattintási paraméter vagy fizetett `utm_medium`; a platform a kattintási paraméterből, utána az `utm_source`-ból (`meta/facebook/fb/instagram/ig`, `tiktok`, `google/adwords/googleads`). Google márkás / nem márkás: a kampány-azonosító (`utm_campaign` vagy `gc`) szerepel-e a D1 `meres_beallitas` tábla `google_markas_kampanyok` kulcsában (vesszővel elválasztott számjegyek). **A lista jelenleg üres / nincs beállítva** → `google_nem_markas` + `cimke_megjegyzes = markas_lista_hianyzik` (ahogy az MP-nél). Feltöltése: `INSERT INTO meres_beallitas (kulcs, ertek, ido) VALUES ('google_markas_kampanyok', '111,222', strftime('%s','now'))`.

A bizonyíték sorrendje (`bizonyitekValaszt`):

1. a **látogatás fizetett érintése** (kliens: `sessionStorage` → `bizonyitek_forras = 'munkamenet'`; a 2 órás `localStorage` látogatás-tárolóból visszaállítva → `'latogatas'`; a kliens `forras_tarolo` jelzése);
2. ha a látogatásban **nincs fizetett érintés**: az `mh_lpt` süti, ha a kattintása **legfeljebb 7 napos** → `'suti'`, a címke a sütiből (6 nap 23 óra = süti; pontosan 7 nap is süti; 7 nap 1 óra már nem);
3. különben a munkamenet nem fizetett érintése (organikus / direkt / ismeretlen).

A **késői fizetett kattintás** (a süti kattintása 8–30 napos, és a címke nem a sütiből jött): a címke **nem változik**, csak `kesei_fizetett = 1`, `kesei_fizetett_platform`, `kesei_kor_nap`. 31 napos süti = nincs semmi. Kifejezett elutasításnál (`hozz.adv === false`) a süti sem bizonyíték, sem késői jelzés, sem pótlás.

## D1 (`KULCS_DB`, a kódból jön létre: `CREATE TABLE IF NOT EXISTS`, additív oszlop: `oszlopokBiztosit`)

`meres_forras` (egy `source_id`-hoz egy sor; **az első írás nyer**, csak az `ismeretlen` javulhat egy későbbi, jobb bizonyítékkal):

| Oszlop | Jelentés |
|---|---|
| `source_id, uzletag, tipus, ido` | foglalás-azonosító (`mb_…`; ajándékkártyánál `pi_…` / `ATU-…`), `headspa\|fodrasz\|oxigen\|szor\|pmu`, `foglalas\|ajandekkartya`, a jelzés ideje |
| `forras_cimke, ismeretlen_ok, cimke_megjegyzes` | a címke és az indok (`nincs_jel`, `hianyos_utm`, `markas_lista_hianyzik`, `nincs_kampany_id`, `fbclid_utm_nelkul`, `organikus_kereso`, …) |
| `bizonyitek_forras` | `munkamenet \| latogatas \| suti` (NULL = nincs bizonyíték) |
| `platform`, `utm_*`, `gad_campaignid`, `adgroupid`, `adid` | a bizonyíték fizetett platformja és tisztított mezői (Metánál a `gad_campaignid` = `utm_id`, az `adid` = `ad_id`) |
| `kattintas_param`, `kattintas_ido`, `kattintas_kor_nap` | a bizonyíték kattintási paraméterének **típusa**, ideje; `suti` esetén a kattintás kora egész napokban |
| `kesei_fizetett, kesei_fizetett_platform, kesei_kor_nap` | késői fizetett kattintás jelzés |
| `klikk_potolt` | melyik azonosító(ka)t pótolta a süti (pl. `fbclid,gclid`) vagy NULL: a foglaló-átadás jelzése (csak ha a sütiben ugyanilyen azonosító van) + a shadow-lánc szerver-oldali pótlása |
| `referrer_kat` | `search\|social\|egyeb\|nincs` (sütis bizonyítéknál NULL) |

**Nyers kattintásazonosítót, IP-t, user agentet, vendégadatot a `meres_forras` nem tárol.** Megőrzés: 30 nap (mint a `meres_erkezes`; minden íráskor törli a régebbi sorokat; `MOSAIC_LPT_MEGORZES_NAP` 7–3650 között felülírja). `meres_beallitas (kulcs, ertek, ido)`: üresen jön létre, csak a márkás listát tárolja.

## Az élő események: a visszanyert azonosító a köszönőoldalon

A Mosaicnál az élő Meta / Google / TikTok események a böngészőből indulnak (GTM / pixel a köszönőoldalon), az azonosítót az oldal URL-jéből veszik. Ezért a pótlás az URL-be megy, a már működő R1–R3 (DECISION #196/1) általánosításaként:

* **Foglaló** (`assets/js/booking-engine/engine.js`, `flow.js`): induláskor `mhAttribucio.lptKlikk()` elindítja a GET-et (egyszer, memóriában); az átadás (`HANDOFF`) a **már megjött** eredményt használja, nem várakoztat. `lptPotlas` → `fillClickIds` (csak a HIÁNYZÓ kulcsokat; az URL-ben lévő elsőbbséget élvez; a Google egy azonosítót fogad el; típusonkénti minta) → `handoffSearch` mind az 5 kulcsot fűzi a köszönőoldal URL-jéhez.
* **PMU** (`assets/js/foglalo-pmu.js`): az R3 `googleAzonositokHozzaad` mind az 5 azonosítóra általánosítva; a PMU indulásakor szintén elindul a lekérés.
* Az azonosítók forrása az `attribucio.js` `klikkReszletes()`: **a böngészőből jövő elsőbbséget élvez** (Google: URL / `mh_attr` / `_gcl_aw` / `_gcl_gb`; Meta: URL / `mh_attr` / `_fbc`; TikTok: URL / `mh_attr`), a sütiből (`lptKlikk`) csak az a platform pótlódik, amelyikhez a böngészőből nem jött azonosító.
* A sütiből pótolt kulcsok **típusát** a foglaló `sessionStorage['mh_lpt_potlas']`-ba jelöli; a köszönőoldali jelzés `lpt_potlas` mezőben viszi, a szerver csak akkor fogadja el, ha a süti ugyanilyen azonosítót hordoz → `meres_forras.klikk_potolt`.
* **Shadow-lánc** (`meres_erkezes.attr`): ha a böngészőből nem jött az adott platform azonosítója, a szerver a sütiből pótolja (`MOSAIC_LPT_ATTR_POTLAS=0` kikapcsolja); a böngészőből jövő soha nem íródik felül.
* **Hozzájárulás nélkül / kifejezett elutasítás után semmi nem szivárog át**: ugyanaz a kapu (`engedely()`), mint a `googleAzonositok()`-nál: ilyenkor a koszonooldal URL-je bajtra azonos a `main`-nel (tesztelve).

## Kliens (`assets/js/attribucio.js`, minden oldal `<head>`-jében)

* Érkezés-érzékelés **csak a felső ablakban, csak engedéllyel**; nem érkezés a köszönőoldal (`bookingUrl` paraméter vagy ismert köszönőoldal-útvonal), a belső hivatkozó (saját domain, `salonic.hu`), az újratöltés / vissza gomb (nincs új POST).
* `sessionStorage['mh_forras']` + `localStorage['mh_forras_l']` (2 órás látogatás-tároló, minden oldalmegtekintés megújítja): csak tisztított érintés (utm, a kattintási paraméter **típusa**, a hivatkozó **kategóriája**, idő); azonosító-**érték** nem.
* Fizetett érkezéskor `POST /api/mosaic-forras` (`fetch keepalive`, azonos eredet): az azonosító értékét **csak ez** viszi.
* Kifejezett elutasításkor a tárolt érintés törlődik, és a szerver sütit töröl (munkamenetenként egyszer; hozzájárulás-változáskor azonnal). Döntés / `suti.js` nélküli oldalon (pl. `/foglalo-motor`) nincs engedély, de **nem** elutasítás: ott semmi nem íródik és semmi nem törlődik.
* `mhAttribucio`: `lptKlikk()`, `lptKlikkVar()` (Promise, tesztekhez), `klikkAzonositok()`, `klikkReszletes()`, `lptJelol()`; a `googleAzonositok()` visszafelé kompatibilis. A kliens hibája sosem akadályozza az oldalt / a foglalást; az `attribucio.js` továbbra sem állít sütit JavaScriptből.

## Üzletág-ellenőrző lista

Az `attribucio.js` a build (`tools/netlify-build.mjs`) révén **minden oldal `<head>`-jébe** kerül (nincs oldal- vagy üzletág-szűrés), a köszönőoldalakra a `foglalas-kulcs.js` is (`FOGLALAS_KOSZONO`), amely a Salonic-host szerint azonosítja az üzletágat. A foglaló-átadás minden üzletágnál a motoron (`engine.js`), a sminktetoválásnál a PMU foglalón (`foglalo-pmu.js`) megy.

| Üzletág (`uzletag`) | Hirdetési oldal (példa) | Foglaló → átadás | Köszönőoldal | Salonic-host |
|---|---|---|---|---|
| headspa | `/headspa-budapest` | motor (`business=headspa`) | `/foglalas-ok`, `/success-foglalas*` | `mosaicheadspa.salonic.hu` |
| fodrasz | `/noi-fodraszat-budapest` | motor (`business=hair`) | `/fodrasz-ok` | `mosaic-hair.salonic.hu` |
| szor (lézeres szőrtelenítés) | `/lezeres-szortelenites-budapest` | motor (`business=laser`) | `/elysion-ok`, `/szortelenites-ok`, `/szor-konzi-ok` | `mosaic-elysion.salonic.hu` |
| oxigen | `/oxigenterapia-budapest` | motor (`business=oxygen`) | `/oxigenterapia-ok`, `/oxigenterapia-masodik` | `mosaic-oxigen.salonic.hu` |
| pmu (sminktetoválás) | `/sminktetovalas-budapest` | PMU foglaló (`foglalo-pmu.js`) | `/pmu-ok`, `/eltavolitas-ok`, `/korrekcio-ok` | `mosaic-pmu.salonic.hu` |

Böngészős bizonyíték: `node tools/meres-proba/lpt-e2e.mjs --bazis https://<ág>.mosaic-d77.pages.dev [--uzletag …] [--platform …]` (szintetikus azonosítók, valódi foglalás nélkül; a Safari-vágást a tárolók törlése szimulálja; 5 üzletág × Google / Meta / TikTok: érkezés → süti → tárolótörlés → direkt visszatérés → átadás-URL → köszönőoldali jelzés `forras = {cimke, bizonyitek_forras:'suti', klikk_potolt}`; + organikus nem ír felül / újabb felülír / elutasítás töröl). Helyben: `… --lokalis` (a `dist/`-et és a valódi vég­pont-kódot szolgálja ki memória-D1-gyel).

**Ismert korlátok (nem hibák):**
1. A **Salonic közvetlen linkje** (Google-profil, Instagram-bio, e-mail → `*.salonic.hu`, a Mosaic oldalát megkerülve) nem érint minket az átadás előtt: ott a köszönőoldal URL-je nem kaphat pótolt azonosítót. A shadow-lánc (attr) és a `meres_forras` címke ilyenkor is a sütiből dolgozik, ha a vendég a köszönőoldalra érkezik.
2. A **`/foglalo-motor` önálló oldalon nincs `suti.js`**, így engedély csak tárolt döntésből van (R4, lásd GCLID_R1_R3.md): ott a pótlás és a süti-írás döntés nélkül nem fut (a tárolt elutasítás ettől függetlenül is érvényes). A landing-oldalakon (rétegben nyíló foglaló) és a PMU-oldalakon működik.
3. **Safari / ITP:** a szerver által írt, első feles `Set-Cookie`-t az ITP nem vágja 7 napra (csak a JavaScripttel írt sütit és tárolót); kivétel a harmadik féltől (más IP / CNAME) érkező sütiválasz. Itt ugyanaz a Cloudflare Pages-domain szolgál, ezért a 30 napos élettartam várható. Éles Safari / iOS-ellenőrzés a bevezetés után javasolt (lásd lent).
4. A régi (8–30 napos) kattintás az élő eseménybe is bekerülhet (a hirdetési platform maga dönt az attribúciós ablakáról); a **címke** csak a 7 napos ablakot használja.

## Vészkapcsolók, rollback

* `MOSAIC_LPT_KI=1` (a `wrangler.toml` `[vars]`-ban, mert a felületen megadott nem titkos változót a `wrangler.toml` törli): a `/api/mosaic-forras` 503-at ad (a kliens ezt elnyeli), a köszönőoldali jelzés burka teljesen kimarad (a `meres-erkezes` válasza bajtra a régi, nincs `forras` mező, nincs `meres_forras` írás, nincs attr-pótlás). A kliens GET-je 503-at kap → üres visszanyerés, az átadás URL-je a régi.
* `MOSAIC_LPT_ATTR_POTLAS=0`: csak a shadow-lánc szerver-oldali pótlása áll le.
* Teljes visszavonás: a PR revertje (`git revert -m 1 <merge>`). A D1-tábla (`meres_forras`, `meres_beallitas`) érintetlenül marad (additív); a böngészőkben maradt `mh_lpt` süti 30 napon belül lejár, a szerver nem olvassa tovább. A meglévő `meres_erkezes` mentés és a foglalás egyik esetben sem érintett.
* Védett fájlok (`netlify/lib/meres/vegpontok.js`, `qa-nap.js`, `esemeny-modell.js`, `google-proba.js`, `netlify/lib/foglalas-kulcs.js`) **nem változtak** (blob-hash: lásd a naplót; a teszt ellenőrzi).

## Riport

`tools/lpt-riport-sql.mjs`: SQL-előállító / JSON-formázó (a D1-et nem éri el). „Megtalált foglalások (később visszatérők)” = `bizonyitek_forras = 'suti'` és fizetett címke, csoportosítva üzletág → platform → kampány (`utm_campaign`, ennek hiányában `gad_campaignid`) → hirdetés (`utm_content`, ennek hiányában `adid`), darab + a kattintás kora (átlag / min / max); kis cellák (< 3) összevonása. Segédlekérdezések: a bizonyíték-források megoszlása (mennyit hoz a süti), késői jelzések, pótolt azonosítók, címkék.

```
node tools/lpt-riport-sql.mjs sql --tol 2026-10-01 --ig 2026-11-01 [--uzletag headspa] [--lekerdezes megtalalt|megoszlas|kesei|potolt|cimkek|mind]
node tools/lpt-riport-sql.mjs formaz --bemenet eredmeny.json [--min 3] [--formatum json|tsv|md]
```

## Tesztek

* `node --test tools/test-lpt-forras.mjs` – tiszta függvények (tisztítás, süti kódolás / dekódolás / hamis süti / lejárat, a 7 napos ablak határai, címke-mátrix), a végpont (Set-Cookie pontos alakja, törlés, GET, cross-site, host, méret, ismeretlen mezők, vészkapcsolo), a D1-integráció (a három `bizonyitek_forras`, nem ír felül / újabb felülír, késői jelzés, nincs nyers azonosító, attr-pótlás, a hiba nem töri el a `meres_erkezes` mentést), a kliens (vm-harness), a foglaló-oldali pótlás (`flow.js`, `engine.js`, `foglalo-pmu.js`), a védett fájlok hash-e, a riport-eszköz.
* A meglévő érintett tesztek zöldek: `test-meres`, `test-gclid-r1r3` (az exportlista / a PMU forráskód-ellenőrzés új elemekre frissítve), `test-qa-nap`, `test-salonic-direct`, `test-adatminimalizalas`, `test-foglalas-kulcs`, `test-booking-flow`, `test-booking-layer`, `test-fuggetlenseg` (a `ket kotes ugyanarra az adatbazis-azonositora mutat` hiba az `origin/main`-en is megvan: a `HOS_DB` éles és előnézeti kötése azonos).

## Nyitott kérdések

1. **Márkás Google-kampányok listája**: ki adja meg a kampány-azonosítókat (a `google_markas_kampanyok` kulcs)? Addig minden Google-kattintás `google_nem_markas`.
2. **Megőrzés**: a `meres_forras` 30 napot tart (mint a `meres_erkezes`), de a havi platformriporthoz ennél hosszabb kellhet; mivel nincs benne személyes adat, érdemes lehet a `MOSAIC_LPT_MEGORZES_NAP`-ot emelni (Feri döntése).
3. **Hozzájárulás nélküli érintés** (mint az MP-n, Feri 2026-10-13-i döntése): itt a feladat szerint az érzékelés `engedely()`-hez kötött; ha a kifejezett elutasítók érintése is kell (tisztított, azonosító nélkül), az egy kapu-módosítás (`erkezesFeldolgoz`).
4. **Éles Safari/iOS-ellenőrzés** a bevezetés után: egy valódi iPhone-os hirdetési kattintás, 8 nap múlva direkt visszatérés; a `meres_forras` `bizonyitek_forras='suti'` / `kesei_fizetett` soraiban látszik.
