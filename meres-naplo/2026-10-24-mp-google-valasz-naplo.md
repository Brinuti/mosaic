# MP Google ARNYEK feltöltés válasz-napló (UJ-61, draft)

Kérés: #167 6384194904 (UJ-61) és 6384788538 (4. pont): a callback rögzítse a Google `requestId`-t és a partialFailure-hibakódot soronként; az „elkuldve" ne legyen azonos a „Google elfogadta"-val.
**Merge és élesítés csak DECISION után** (D1-sémabővítés + új végpont); a Zap-lépés külön Zapier-draft, publikálás Feri külön mondatával. Mérést érint: igen (MP Google-feltöltés naplózása, riport).

## Miért kell
Az `MP ARNYEK` Zap (`send_offline_conversion_v2`, try/catch) a Google partialFailure-jét nem kezeli, a Worker pedig a webhook 200-ra `elkuldve`-t ír a `mp_feltoltes` sorba. Az `elkuldve` tehát nem azt jelenti, hogy a Google elfogadta (a Zap ezenkívül több okból `skipped`-del tér vissza: nem GRANTED hozzájárulás, rossz kattintás-azonosító, hiányzó order_id). A Zapier-futásnapló nem tartós. Ez a változtatás tartós, PII-mentes naplót ad.

## Mi változik (csak új fájlok)
1. **Új tábla** `mp_google_valasz` (kulcs, akcio_id, kod, request_id, elfogadva, elutasitva, uzenet, ido; PK: kulcs + akcio_id). Csak a saját végpont kéréseiben jön létre (`CREATE TABLE IF NOT EXISTS`), ezért a foglalás-kérés útja (`lanc.js`, ~41/46 D1-lekérdezés, a Cloudflare ingyenes korlátja 50) **egy lekérdezéssel sem lesz több**. A `mp_feltoltes.allapot` jelentése változatlan.
2. **Új végpont** `POST /api/mp-google-valasz` (`functions/api/mp-google-valasz.js`, `lib/meres/google-valasz.js`). Fejléc: `x-mp-google-kulcs` (SHA-256-ja = `MP_GOOGLE_VALASZ_KULCS_HASH`; kulcs nélkül / rossz kulccsal / beállítás nélkül 404, query-kulcs nem fogadható el). Törzs: `{ order_id (= mp_feltoltes.kulcs), conversion_action_id, kod, request_id?, uzenet?, elfogadva?, elutasitva? }`. `kod`: `''` = a Google elfogadta, egyébként `NAGYBETUS_KOD` (UNPARSEABLE_GCLID, EXPIRED_EVENT, ZAP_HIBA, ZAP_KIHAGYVA …). Csak MP ARNYEK akcióra és csak egy meglévő, élesben elküldött (`mod='eles'`, `allapot='elkuldve'`) `mp_feltoltes` sorra fogad; új feltöltés-sort nem hoz létre; az első visszajelzés marad. Egy hívás ≤ 3 D1-lekérdezés (tesztelve).
3. **Riport** `GET /api/mp-google-valasz?riport=1[&nap=7]` (admin: `x-mp-kulcs` = `MP_MERES_ADMIN_KULCS`): akciónként `elkuldve` / `google_elfogadta` / `reszleges_hiba` / `nincs_visszajelzes` + hibakódok darabszáma. Nyers azonosító, foglalási kulcs, kattintás-azonosító nincs benne.
4. **Adatvédelem:** az `uzenet` maszkolt (gclid/gbraid/wbraid minden alakban, e-mail, hash, telefonszám, hosszú token), max. 300 karakter; a Google-kattintás-azonosító, e-mail, hash, vendégadat nem kerül a naplóba.

## Védett fájlok
`lanc.js` `4d8a657f00`, `google-ads.js` `27bc0e28aa`, `tiktok.js` `5fc76b1a5c` (a main-en) — **egyik sem módosul**. Csak új fájlok: `lib/meres/google-valasz.js`, `functions/api/mp-google-valasz.js`, `tools/test-mp-google-valasz.mjs`, ez a napló.

## Élesítéskor (DECISION után; ezek még NEM történtek meg)
1. Merge + deploy (a végpont kulcs nélkül 404).
2. Cloudflare Pages `medicalpiercing`, Production, **Secret**: `MP_GOOGLE_VALASZ_KULCS_HASH` = a Zapnek adott kulcs SHA-256-ja. A kulcs a Zapier-ben él (a repóba / commitba / chatbe nem kerül).
3. **Zapier-draft** (külön, a jelenlegi `MP ARNYEK` workflow `01a12a08…` élő verziója változatlan): a Google Ads lépés után egy külön lépés, külön try/catch-ben hívja a végpontot (`kod`: `''` siker, `ZAP_HIBA`, `ZAP_KIHAGYVA`; a partialFailure-kód csak akkor, ha a Zapier-akció visszaadja — a Zapier Google Ads akció a `partialFailure` objektumot jelenleg nem adja vissza, ezt a #461 README is rögzíti; ha így marad, a valódi partialFailure-kódokhoz közvetlen Google Ads API-hívás kell, ami külön döntés). A visszahívás nem befolyásolhatja a feltöltést. Publikálás: Feri külön mondata.

## Tesztek
`node --test tools/test-mp-google-valasz.mjs` (7 teszt): rögzítés (OK / részleges hiba / első marad / requestId), hibás bemenetek (nem MP akció, ismeretlen sor, dryrun-sor), maszkolás (11 alak), végpont (kulcs csak fejlécben, 404/405/400/413/503), D1-keret ≤ 3, riport (+ admin-kulcs, `sema_hianyzik`), a foglalás-út érintetlensége (nincs import `lanc.js`-ből, nem ír `mp_feltoltes` / `mp_foglalas` táblába). A többi 11 MP-tesztfájl zöld.

## Rollback
A PR visszavonása; a `mp_google_valasz` tábla maradhat (a foglalási út nem olvassa). A végpont kulcs nélkül 404.
