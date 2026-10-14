# Suti-sav levetele (meresi oldal DECISION #170) - draft, MERES ERINTO, NE MERGELD / ELESITSD Feri kozvetlen mondata nelkul

Forras: Brinuti/mosaic #167, 150. komment (DECISION #170, a tulajdonos dontese: a Mosaicon levesszuk a sutisavot, es vallalja a Google-, GA4- es TikTok-platformkockazatot; tudatos elteres a kozos tanulsag-dokumentum 6. pontjatol).
Ag: `claude/mosaic-suti-sav-le-rrbwkk` (a `main` 9ec2b6b-rol). Csak az `assets/js/suti.js` valtozik (+ teszt, doksi, naplo). A foglalasi folyamathoz, a `PIXEL_OLDALAK` / `PIXEL_FODRASZ` listakhoz, a Meta-pixel logikahoz, a `koszono.js`-hez es a vedett oldalakhoz nem nyul.

## Viselkedes

| Latogato | Sav | Consent Mode default (a GTM / a pixelek betoltese ELOTT) | `mhSuti.mod().forras` |
|---|---|---|---|
| uj (nincs tarolt dontes) | nem jelenik meg | `analytics_storage`, `ad_storage`, `ad_user_data`, `ad_personalization` = **granted**; `functionality_storage` = denied | `uj_alapertek` |
| korabban tarolt dontes (sajat tarolo `mh_cc` vagy Wix `consent-policy` suti): elutasitas, reszleges tiltas | nem jelenik meg | a tarolt dontes (a tiltott mezo **denied** marad) | `korabbi_dontes` |
| "reszleges" tarolt bejegyzes (csak a funkcionalis lett engedve, pl. a terkepnel; a savban sosem dontott) | nem jelenik meg | statisztika + marketing = alapertek (granted), funkcionalis = a bejegyzes szerint | `uj_alapertek` |
| a beallitasokban (lablec "Suti beallitasok" link) mentett dontes | a beallitasok nyilnak meg | a mentett dontes (`consent update`) | `modositott` |

* A lablec "Suti beallitasok" link marad (a kozos lablec-sablon mar tartalmazza: `assets/fejlec/lablec-*.html`); megnyitja a beallito dobozt, ahol a bepipalas a **hatalyos** allapotot mutatja. A beallitasokban uj magyarazo sor: "A statisztikai es a marketing sutik alapertelmezetten be vannak kapcsolva, itt kikapcsolhatok."
* **Visszavonas** (statisztika vagy marketing kikapcsolasa a beallitasokban): a `consent update` azonnal `denied`-et kuld, a `mh_cc` + a Wix `consent-policy` suti megirodik, az `attribucio.js` torli a tarolt `mh_attr`-t; a doboz ertesitest mutat: "A beallitas mentve. A kikapcsolt sutik teljes leallitasahoz toltse ujra az oldalt." (Ujratoltes / Bezar). Ujratolteskor a tarolt elutasitas a GTM betoltese ELOTT ervenyes.
* **Terkep / velemenyek** (`mhSuti.enged('fun')`): nem vonja vissza a granted alapertekeket; dontes nelkul "reszleges" bejegyzes keletkezik, amelyben `ana` / `adv` false marad (igy egy visszaallitas / revert utan sem szamit kifejezett engedelynek).
* **Lejart bejegyzes:** a tarolt elutasitas (statisztika / marketing) a lejarat utan is kotelezo marad (a granted alapertek nem tamad fel egy regi elutasitasra); csak a funkcionalis engedely jar le a megszokott ideje utan.
* **Visszavonas utan a doboz nem tunik el magatol** (`role="status"`, a fokusz az "Ujratoltes" gombra kerul); a doboz-idozito a beallitasok / ertesites nezeten all.
* A sav kodja (kompakt sav, "Elfogadom" gomb) megmaradt, de `SAV_AUTO = false` miatt dontes nelkuli latogatonak soha nem jelenik meg magatol. Visszaallitas: ennek a commitnak a revertje (egy commit).

## Technikai

* `hatalyos()`: a tarolt dontes, ennek hianyaban az alapertek (`ALAP = { fun: false, ana: true, adv: true }`). Mindenhol ez ervenyes: `jelek()` (Consent Mode), `mhSuti.engedely()`, a figyelok (`mhSuti.figyel`) es a beallitasok bepipalasa.
* `mhSuti.mod()` -> `{ mod: 'alapertek_granted_v1', forras, fun, ana, adv }`. A dataLayerbe: `mh_consent_init` (betolteskor, a `consent default` utan, a GTM elott) es `mh_consent_valtozas` (dontes utan): `mh_consent_mod`, `mh_consent_forras`, `mh_consent_fun|ana|adv` (0/1). Szemelyes adat nincs bennuk; a GTM-ben nincs ra cimke (kulso fiokhoz nem nyultunk).
* A `wait_for_update` megszunt (nincs mire varni).
* `mhSuti.enged('fun')` (terkep / velemenyek) kozvetett iras: a `forras` nem lesz `modositott`, a granted alapertekeket nem vonja vissza.
* Az `attribucio.js` (valtozatlan) a `mhSuti.engedely('adv')`-t kerdezi: uj latogatonal igen -> a kattintas-azonositok / UTM a `mh_attr`-ba kerulnek. A `lepes-meres.js` (booking-engine, valtozatlan) a `mhSuti.engedely('ana')`-t kerdezi: uj latogatonal igen -> a GA4 lepes-esemenyek mennek.

## NYITOTT PONTOK (dontes a mereso oldale / a tulajdonose; ezeket ez a PR NEM dont el)

1. **Szerveroldali hozzajarulas-pillanatkep (`hozz`) - a DECISION #170 "nincs kodvaltozas a foglalasi folyamatban" feltevese ELTER a valosagtol.** Az `attribucio.js` `hozzajarulas()` csak a `localStorage` `mh_cc`-bol olvas; uj latogatonal (nincs tarolt dontes) a szervernek `hozz = {}` megy (ellenorizve: a `megfigyelesek` mezo a bongeszo-naploban). A szerver (`netlify/lib/meres/hozzajarulas.js`) ezt `ana/adv = null, dontes = false`-nak veszi: **Google / GA4 jel `UNSPECIFIED`, Google fele nincs hash-elt azonosito**; a Meta / TikTok (SZ-38) hozzajarulas nelkul is kuldve. Vagyis a bongeszoben (GTM) a granted alapertek ervenyes, a szerveroldali Google / GA4 konverzio viszont nem profital belole. Javaslat (kb. 5 sor, kulon commit, kulon jovahagyas): az `attribucio.js` `hozzajarulas()` elsodlegesen a `mhSuti.engedely()`-bol (hatalyos allapot) olvasson, tartaleknak az `mh_cc`. **Nem csinaltam meg**, mert a foglalasi adat tartalmat valtoztatja, es a Google fele hash-elt azonositok kuldeset is erinti.
2. **Meta-pixel (vedett).** A `PIXEL_OLDALAK` / `PIXEL_FODRASZ` es a Meta-pixel logika valtozatlan, azaz a pixel (a Wix "szukseges" kategoriaja szerint) tovabbra is hozzajarulastol fuggetlenul betolt. A DECISION #170 4. pontja ("visszavonas utan a tovabbi tracking esemenyek ne fussanak") ezert a Consent Mode-hoz kotott cimkekre (GTM, GA4, a GTM-ben levo TikTok) ervenyes; a Meta-pixel visszavonas utan is fut, mint eddig is az elutasito latogatonal.
3. **Suti-tajekoztato (`/suti-tajekoztato`) szovege.** Az oldal szovege (jogi szoveg, nem nyultam hozza) jelenleg valoszinuleg hozzajarulashoz kotott sutihasznalatot ir le; a granted alapertek utan frissitendo (tulajdonos / jogasz).
4. **Jogi / platform-kockazat.** A statisztikai es marketing sutik elozetes hozzajarulas nelkuli bekapcsolasa EU-ban a GDPR / ePrivacy (elozetes, kifejezett hozzajarulas) es a Google EU user consent policy szerint kockazatos; a DECISION #170 szerint a tulajdonos vallalja. Rollback: egy commit revert; ha Google Ads-, GA4- vagy TikTok-policy figyelmeztetes erkezik, azonnal vissza a savos allapotra.
5. **`#309` (sutisav-statisztika) null-logika.** A #309 `suti.js`-e a `mutat('main')` utan kuld "megjelent" esemenyt; ennek a PR-nek `SAV_AUTO` guardja ugyanazt a sort modositja -> a ket PR kozott **szoveges utkozes** lesz (azonos sor); feloldas: `if (SAV_AUTO && (!dontes || dontes.reszleges) && !rejtveMunkamenetben()) { mutat('main'); statKuld('megjelent'); }`. Igy sav nelkul nem keletkezik "megjelent" esemeny (null), a beallitasokban hozott dontesek ("elfogad_minden" / "elutasit" / "reszleges") tovabbra is szamolodnak. Az admin-olvasas (`osszes.megjelent = 0`) aranyt nem szamol, tehat nullaval osztas nincs; a dokumentacioban jelezni kell, hogy sav nelkul a dontes / megjelent arany ertelmezhetetlen (null). A #309 modositasa a ket PR sorrendjetol fugg - merge-kor kell elvegezni.
6. **T2_START consent-mod rogzites.** A bongeszoben a `mhSuti.mod()` es a `mh_consent_*` dataLayer-esemenyek adjak a mod + forras parost (uj_alapertek / korabbi_dontes / modositott). A #310 `?qa=t2start` szerveroldali vegpontja ezt nem latja; a statikus mod (`alapertek_granted_v1`) hivoi parameterkent (`&consent_mod=`) rogzitheto - ez a #310 egy kis, kulon commitja lenne; a mereso oldal jovahagyasa utan.
7. **Reszleges bejegyzes** (lasd a tablazatot): a statisztikarol / marketingrol nem dont (alapertek). A szigorubb olvasat (a tarolt bejegyzes mindig kotelezo) egy sor (`hatalyos()`), de a terkep-engedelyezes ekkor visszavonna a granted alapertekeket.
8. **Ajandekkartya mero-keret** (`MERO_KERET`, lathatatlan iframe a regi konverzio lejatszasahoz): uj latogatonal itt is granted az alapertek (a keretben sav eddig sem volt).
9. A testver-oldalak (`gyogytorna`, `medicalpiercing`) sajat `suti.js`-t hasznalnak; ez a PR csak a Mosaic `assets/js/suti.js`-t erinti.
10. **`attribucio.js` olyan oldalakon, ahol nincs `suti.js`** (kozvetlen `/foglalo-pmu`, `/foglalo-motor`, `/foglalas`, `/oxigenterapia-budapest-uj`, `/pmu-sminktetovalas`): a `mhSuti` hianyaban az `attribucio.js` tiltottnak veszi a marketinget, es **torli a tarolt `mh_attr`-t**, tehat az ide erkezo uj latogato kattintas-azonositoi elvesznek. Javaslat (kb. 1 sor, kulon commit): `mhSuti` hianyaban `adv !== false` (az `mh_cc` hianya = alapertek granted). Nem csinaltam meg (attribucio.js = foglalasi folyamat).
11. **A `/foglalo-pmu` oldalaknak nincs lablec-linkjuk** a "Suti beallitasok"-hoz (a lablec-sablon nincs rajtuk): ott a visszavonas nem erheto el; a tobbi oldalon igen.
12. **`reszleges` bejegyzes tovabbi hatasa:** a `ajandek.js` `mhSuti.engedely()`-t olvas, igy uj latogatonal (es "reszleges" bejegyzesnel) a megjelenito `granted`-et kuld; a "reszleges" bejegyzes `{fun: true, ana: false, adv: false}` marad a tarolt formaban, de a hatalyos ertek `ana/adv = granted` (lasd 7. pont).
13. **Korlatok:** (a) ha a `localStorage` blokkolt, az elutasitas nem tarolodik (az oldal betoltesenkent alapertek granted); (b) mas, mar nyitott lapok a visszavonas utan az ujratoltesig `granted`-en maradnak; (c) a `_ga` / `_fbp` sutiket a mero kod a hozzajarulas tole fuggetlenul olvassa; (d) a beallitasokban az elore bepipalt "Kivalasztottak mentese" kifejezett dontesnek szamit (a bepipalas a hatalyos allapot, ami granted).

## Vedett elemek (ellenorizve)

| Fajl | blob (rovid) | Megjegyzes |
|---|---|---|
| `assets/js/suti.js` | `1c96df5fa7` -> **szandekosan valtozik** | a `PIXEL_*` / `PIXEL_OLDALAK` sorok, a `merokodok()` (GTM / dataLayer / GA4 / Meta) torzse valtozatlan |
| `assets/js/booking-engine/koszono.js` | `547d0e05fc` | valtozatlan |
| `klon/oxigenterapia-ok.html`, `klon/fodrasz-ok.html` | `157c141e5d`, `1ef408bcbb` | valtozatlan |
| `klon/m/oxigenterapia-ok.html`, `klon/m/fodrasz-ok.html` | `88c2d866ae`, `ae96e4ae97` | valtozatlan |
| `assets/js/booking-engine/` (egesz), gyoker `_redirects` / `_headers` | - | valtozatlan (`git diff 9ec2b6b` ures) |

## Tesztek

* `tools/meres-proba/suti-alapertek-bongeszo.mjs` (valodi Chromium, valodi `suti.js`, helyi `dist`, MINDEN kulso host tiltva): 94/94 PASS asztali (1280 px) es mobil (390 px) nezetben - uj latogato, korabbi elutasitas, reszleges tiltas, Wix-suti, "reszleges" bejegyzes, terkep-engedelyezes, lablec-link, visszavonas + ertesites (nem tunik el, fokusz) + ujratoltes, kivalasztottak mentese, mindet elfogadom, Meta-pixel valtozatlansag, kulso iframe, MERO_KERET, lejart elutasitas / lejart engedely, reszleges Wix-suti, blokkolt localStorage, `enged('fun')` tarolt elutasitassal. Negativ kontroll: a modositatlan (main) `suti.js`-en elbukik (a `.mh-bev` magyarazo sor hianya miatt idotullepes; `mhSuti.mod` is hianyzik). Naplo: `meres-naplo/suti-sav-le-bongeszo-2026-10-14.json`.
* `tools/meres-proba/attribucio-hozzajarulas-bongeszo.mjs` frissitve az uj rezsimre (a "dontes nelkul" mostantol alapertek: az iras megtortenik; a tiltas tarolt elutasitassal / a beallitasokban): PASS (naplo: `meres-naplo/attribucio-hozzajarulas-suti-sav-le-2026-10-14.json`).
* `node --test tools/test-meres.mjs tools/test-lepes-meres.mjs`: 68/68.
* Szintaxis: `node --check assets/js/suti.js`.
