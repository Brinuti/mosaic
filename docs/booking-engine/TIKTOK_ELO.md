# Kódos ÉLŐ TikTok-esemény (UJ-67 / 69 / 71 / 73) – URL-szabály helyett, csere nélkül

**MÉRÉST ÉRINTŐ, alapból KI.** Kérés / döntés: #167 (6394779023 UJ-67, 6395139479 UJ-69, 6395410560 UJ-71 + UJ-73; Feri DECISION #232 és #234; „UJ-82” körben 6434558379, 6435507939). A PR **nem kapcsol be semmit**: sem a szerveres, sem a böngészős esemény nem megy ki, amíg a `TIKTOK_ELO_BE` és a `TIKTOK_ELO_TOKEN` nincs beállítva. Élő konverziót nem cserél: ugyanaz a pixel, ugyanaz a (TikTok oldali) esemény, csak a **forrása** kód lesz URL-szabály helyett.

## Mi változik üzletáganként

| üzletág | TikTok-esemény (ELŐ pixel `CTDGK5BC77U0PIODKP30` / 7447555233548451858) | mikor megy | ma |
|---|---|---|---|
| HeadSpa | `Schedule` | új vendég foglalása; ajándékkártya-vásárlás (csak szerverről) | URL-szabály: `mosaicheadspa.hu/success` tartalmaz (minden oldalbetöltés) |
| Szőr | `CompleteRegistration` | első foglalás + konzultáció (`/elysion-ok`) | URL-szabály `/elysion-ok` |
| Oxigén | `SubmitForm` | első foglalás + konzultáció (`oxigenterapia-ok`) | URL-szabály `/payment/success` VAGY `oxigenterapia-ok` |
| Fodrász | `Contact` | első foglalás + konzultáció | nincs (UJ-73, előre elkészítve) |
| PMU | `Consult` | első foglalás + konzultáció | nincs (UJ-73, előre elkészítve) |

A feltétel pontosan az ÁRNYÉK-lánc ernyőeseményéé (`esemeny-modell.js` `esemenyek()`): **visszajáró és kupon soha**, a jelleg a Salonic-levélből + a köszönőoldalból (UJ-68, DECISION #238). Érték, szolgáltatásnév, ár **nem** megy. A user-adat: hash-elt e-mail / telefon / external_id + `ttclid`, `ttp`, IP, user agent (DECISION #202); explicit marketing-elutasításnál (`adv === false`) semmi sem megy.

## Felépítés

```
koszonooldal ──► attribucio.js kuld() ──► POST /api/meres-erkezes ──► (kezelErkezes változatlan) + erkezesForrassal
                                               └► VÁLASZ: { …, tiktok_elo: { esemeny, event_id, pixel } }   ← csak bekapcsolt üzletágnál
                  └► ttq.track(esemeny, {}, { event_id })   (engedély kell; a pixel betöltődését max. 10 mp-ig várja; event_id-nként egyszer)
Salonic-levél ──► foglalasEsemenyKuldes / sd / ajandekEsemenyKuldes ──► elosztas() (ÁRNYÉK, változatlan) ──► tiktokEloKuld() ──► TikTok Events API (ugyanaz az event_id)
```

* **Közös event_id:** a Meta ÁRNYÉK böngészős kulcsa (`meta-bongeszo-kulcs.js`: köszönőoldal-útvonal + `g` + `serviceId` + `startDate`). Ha nem képezhető (hiányzó `g` / `bookingUrl`), a böngésző **nem** küld, a szerver az `esemeny_id`-t használja (nincs páros, nincs dupla).
* **Egy kapcsoló, két oldal:** a böngészős esemény csak akkor indul, ha a szerver a válaszban jelzi. Így a szerveres és a böngészős küldés **egyszerre** kapcsol be, átfedés nélkül; a mérési oldal a TikTok Events Managerben az URL-szabályt ugyanabban a lépésben kapcsolja ki.
* **Külön modul, külön tábla:** `netlify/lib/meres/tiktok-elo.js`, napló: `meres_tiktok_elo` (esemény-azonosító PK, állapot, HTTP-státusz, a válasz kódja; token és user-adat nincs). Az ÁRNYÉK-lánc védett fájljai (`platformok.js`, `elosztas.js`, `esemeny-modell.js`, `meta-bongeszo-kulcs.js`, `qa-nap.js`, `vegpontok.js`) **változatlanok**, csak importáljuk őket; az ÁRNYÉK-lánc tiltólistája (`ELO_CELOK`) és a `qa-nap` „nem ÁRNYÉK cél = 0” ellenőrzése érintetlen (az élő küldések nem a `meres_kuldes`-ben vannak).
* **Idempotens:** egy `esemeny_id` egyszer megy ki; egy Salonic-foglalás (azonos `uuid`) a motoron és az sd-n át is csak egyszer; hiba után legfeljebb 3 próbálkozás; a foglalás élő állapotát küldés előtt újra ellenőrizzük (lemondottra nincs pozitív konverzió; nem ellenőrizhető → halasztva).

## Beállítás és átállás (üzletáganként, a mérési oldal / Feri lépéseivel)

1. **Titok:** `TIKTOK_ELO_TOKEN` (Cloudflare Pages, `mosaic`, Secret, Production; az élő pixel Events API tokenje). *Külső fiókos lépés – Feri / a mérési oldal.*
2. **Igazolás éles hatás nélkül:** `TIKTOK_ELO_TESZT_KOD` (TikTok Test Events kód) + `TIKTOK_ELO_BE="headspa"` az **előnézeten**: 3 valós minta, a böngészős + szerveres példány egy eseménynek látszik-e (UJ-67 2. pont). Az URL-szabály ekkor még él, a Test Events esemény nem számít konverziónak.
3. **Átállás egy lépésben:** `TIKTOK_ELO_BE` az élesen (teszt-kód nélkül) + a TikTok URL-szabály kikapcsolása. *A szabály kikapcsolása külső fiókos lépés – a mérési oldal, Feri „mehet”-je után.*
4. **Visszamérés:** napi TikTok-esemény ↔ saját foglalás (3–7 nap); az újratöltések / téves oldalak kiesnek, valós foglalás nem.
5. **Rollback:** a `TIKTOK_ELO_BE` sor törlése + deploy, az URL-szabály visszakapcsolása.

## Ismert korlátok / döntési pontok

* A böngészős jelzés a köszönőoldal adataiból (`first_booking`, oldal, szolgáltatásnév) számolja a jogosultságot; a szerver később a Salonic-levélből pontosít. Ritka eltérésnél lehet böngésző-only példány (a riportban látszik).
* HeadSpa ajándékkártya: az URL-szabály eddig azt is számolta; itt **csak szerverről** megy (a böngészős kártya-eseményt az `ajandek.js` külön küldi).
* A Fodrász `Contact` és a PMU `Consult` esemény a mérési oldal javaslata (UJ-73); más standard esemény egysoros csere (`ELO_ESEMENY`).
* Sd (Salonic-direct) foglalásnál nincs böngésző: az event_id az `esemeny_id`, a szerver egyedül küld.

## Tesztek

`node --test tools/test-tiktok-elo.mjs` (13): kapcsoló / fail-closed, jogosultság üzletáganként, kérés-alak (nincs nyers adat), idempotencia, hibakezelés, a válasz additív mezője, a kliens (`ttq.track`).
