# Google ARNYEK proba: celhoz kotott, lejarato proba-kulcs (DECISION #199 / #200) - merési napló, 2026-10-19

Vendegadat, kulcs, gclid nincs benne. Az elozo (PR #409) naplo: `meres-naplo/2026-10-18-google-proba.md` (a repo gyokereben).

## 1. Mi ez
A `google_proba` / `google_proba_visszavon` muveleteket (PR #409) a fo `EGYEZTETES_KULCS` hivhatja; az a Zapier Storage-ban van, a fejleszto nem kaphatja meg. A fejleszto sajat, `openssl rand -hex 32` kimenetu (256 bites) kulcsot general; a repoba CSAK a SHA-256-ja kerul (`wrangler.toml` Production [vars]: `GOOGLE_PROBA_KULCS_HASH`, `GOOGLE_PROBA_KULCS_LEJAR = 2026-10-20T12:00:00Z`). A hash (7ed75d0e8c21...) a szintetikus tesztkulcs hash-etol kulonbozik (ellenorizve).

## 2. Tulajdonsagok (tesztelve: `node --test tools/test-proba-kulcs.mjs`, 6/6)
- KIZAROLAG a POST `google_proba` / `google_proba_visszavon`; minden mas muvelet, minden GET, a `?kulcs=` query, rossz / hianyzo kulcs: 404; a `?qa=nap` / `?qa=t2start` ag GET-re a sajat fo-kulcs ellenorzesen 403, POST-ra 405; ervenyes proba-kulccsal a nem-JSON torzs 400, a 20000 karakternel nagyobb 413 (nem futnak, nem naplozodnak).
- Lejar: `GOOGLE_PROBA_KULCS_LEJAR` utan, de legkesobb a kodban rogzitett 2026-10-21 00:00Z plafonig (<= 48 ora a 10-19-i kiadastol); hianyzo / ervenytelen valtozo = nincs belepes.
- Minden hasznalat naplozva a `proba_kulcs_naplo` D1-tablaba (ido, muvelet, kuld, eles; kulcs / gclid / vendegadat nelkul) a muvelet ELOTT; naplozhatatlan = 404, es semmi nem fut (0 kimeno hivas, 0 iras: tesztelve).
- A kuldesi kapuk a `google-proba.js`-ben valtozatlanok (`kuld:true` + megerosit + webhook-env + `MERES_ELOSZTO=1` + iras-kapcsolo; elo RETRACTION csak `eles:true` + `GOOGLE_KORREKCIO_ELES=1`).
- Mutacio-ellenorzes: a lejarat-vizsgalat, a muvelet-szuro es a naplozas eltavolitasa megbuktatja a teszteket.

## 3. Vedett elemek (blob-hash), main -> PR
- `netlify/lib/meres/google-proba.js` f6e5bf9d13 -> f6e5bf9d13 (valtozatlan)
- `netlify/lib/meres/qa-nap.js` 2334390be3 -> 2334390be3 (valtozatlan)
- `netlify/lib/meres/esemeny-modell.js` 4342e6f09b -> 4342e6f09b (valtozatlan)
- `netlify/lib/foglalas-kulcs.js` e1448b4d13 -> e1448b4d13 (valtozatlan)
- `netlify/lib/meres/vegpontok.js` b5e3881fc7 -> 085bed6aad (VALTOZIK: a `kezelAdmin` belepesi aga; dokumentalt, ez a PR tárgya)
- Uj: `netlify/lib/meres/proba-kulcs.js`, `tools/test-proba-kulcs.mjs`; `wrangler.toml` (ket valtozo a Production [vars]-ban), futtatokonyv.

## 3b. Tovabbi fajlok (main -> PR)
- `wrangler.toml` ce5e69f0 -> 50c93708 (ket uj Production [vars] sor); `docs/booking-engine/MERES_GOOGLE_E2E_FUTTATOKONYV.md` c3c1f8e4 -> fdd055c3.

## 4. Regresszio
`test-google-proba` 25/25, `test-meres` 48/48, `test-qa-nap` 43/43, `test-salonic-direct` 75/75 zold.

## 5. Rollback es takaritas
- Rollback: a merge-commit revertje (a proba-kulcsos ag kikerul, a fo kulcsos mukodes valtozatlan); a `proba_kulcs_naplo` tabla megmarad (audit-nyom, PII nelkul).
- Deploy nelkuli azonnali leallitas a fo kulcs birtokosanal: `iras` `be:false` (a kuldes 503), vagy `kapcsolo` google off (kihagyva).
- A futas utan: a ket `wrangler.toml` sor (+ az elhalt `proba-kulcs.js` ag) torlendo kulon kis PR-ben; 2026-10-21 00:00Z utan a kulcs magatol hatastalan; a kulcs fajlja a fejleszto munkafajljabol torlendo.
