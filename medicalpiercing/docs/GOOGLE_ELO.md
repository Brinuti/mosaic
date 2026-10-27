# MP: csere nélküli pótlás az élő „All – Időpontfoglalás” (7468541217) akción – UJ-63

**MÉRÉST ÉRINTŐ, alapból KI.** Terv: `docs/booking-engine/GOOGLE_CSERE_NELKUL_TERV.md` (PR #502). Kérés: #167 6394447316; Feri: „a lehető legkevesebb helyen cserélünk, mert a kampányok újratanulnak” → az élő akció marad, nincs csere, nincs RETRACT.

## Mit csinál
A böngészős címke (web-GTM) a foglalási kulcsot (`placeId|employeeId|startUnix`) `orderId`-ként viszi (a mérési oldal teszi a címkére – külső fiókos lépés). A szerver a hiányzó (adblock / süti-elutasítás / késő címke) **igazolt** foglalásokat **ugyanerre az akcióra, azonos `orderId`-vel** tölti vissza; a Google az azonos akció + azonos `orderId` párt egy konverziónak számolja. Lemondott foglalás sem kerül levonásra.

## Felépítés
* `medicalpiercing/lib/meres/google-elo.js` – `eloPotlas()` sweep; hívja a Pages Function (`mp-foglalas.js`, `mp-salonic-igazolas.js`) `waitUntil`-lel. A védett `lanc.js` / `google-ads.js` **változatlan** (csak a konstansokat, a `googleIdo`, `maszk`, `kitakar` függvényeket importálja); a meglévő ÁRNYÉK-feltöltés védőhálója (`ENGEDETT_AKCIOK`) érintetlen.
* Kapcsoló: `MP_GADS_ELO = ki` (alap) | `dry` (`validateOnly`) | `eles` (csak `MP_GADS_MOD=eles` + éles host + külön DECISION / Feri mondata); a meglévő `MP_GADS_MOD=off` vészkapcsoló ezt is leállítja. `MP_GADS_ELO_TOL` = a böngészős `orderId`-s címke élesítésének unix-ideje (nélküle nem fut: korábbi foglaláshoz nincs `orderId`-s tag-konverzió).
* Jogosult sor: Salonic-igazolt, nem divat-fül, van Google-kattintásazonosító és hirdetési hozzájárulás, `foglalas_ido ≥ TOL`, legalább 30 perccel régebbi (a címke előbb rögzítse a sajátját). Éles módban csak az éles környezet sorai.
* Szállító: csak a közvetlen Google Ads API (OAuth refresh token) – a Zap az élő akciót nem engedi.
* Napló: `mp_feltoltes_elo` (kulcs, mód, állapot, HTTP-státusz, hibakód, kattintás-**maszk**; nyers azonosító nincs), soronként legfeljebb 3 próbálkozás; a Google „már bent van” válasza (`ORDER_ID_ALREADY_IN_USE`, `CLICK_CONVERSION_ALREADY_EXISTS`) sikernek számít.

## Élesítés előtt (mind külön lépés)
1. A mérési oldal: a címke `orderId` mezője + az élő akció típusa fogad-e kattintás-feltöltést (GAQL, olvasás).
2. `MP_GADS_ELO=dry` + `MP_GADS_ELO_TOL` az előnézeten: a `validateOnly` válaszok hibamentesek.
3. Dupla-mentesség: 3 valós minta, címke-konverzió + pótló feltöltés azonos `orderId`-vel egy konverzióként jelenik meg (GAQL, konverziónap, darab).
4. `MP_GADS_ELO=eles` – csak Feri külön mondatával.

## Rollback
`MP_GADS_ELO` törlése / `ki` (kód nélkül); a böngészős `orderId` visszavétele a GTM-ben a mérési oldal lépése.

## Tesztek
`cd medicalpiercing && node --test tools/test-mp-google-elo.mjs` (8): kapcsoló / fail-closed, kérés-alak (azonos `orderId`, az élő akció), dry / éles feltételek, jogosultság, „már bent van”, újrapróbálások, hibák.
