# DECISION #251 (b): qa-nap `level_lanc_kimaradt` (Mosaic, 2026-10-28)

**Mérést érint** (csak olvasó riport). Nem küld, nem ír, nem jelölt újraküldésre.

- `qa-nap.js`: új üzletágankénti és összesített számláló `level_lanc_kimaradt: { db, max_ora }`: bongeszos `foglalas` érkezés (`meres_erkezes`), amelyhez **6 óránál régebben sincs** `foglalas_egyeztetes` sor (`booking_id = source_id`), és nem kuponos (`meres_jelleg.kupon <> 1`). A küldéssel rendelkező érkezés is számít (a kérdés a levél-lánc, nem a küldés). Sárga lámpa, ha `db > 0` (a piros marad piros).
- Az MP párja külön PR-ben: `igazolas_nelkul_regi` (#522, `riport.js`; az `mp_foglalas` az `mp-meres` DB-ben van, nem a qa-nap KULCS_DB-jében).
- Védett fájl: `netlify/lib/meres/qa-nap.js` b1a0e2c177 → **3e7dbad173** (dokumentált); `elosztas.js` 2d5929b4ff változatlan ebben a commitban.
- Rollback: a commit revertje (a #512 többi része nem érintett).
- Tesztek: `test-folyamatban-plafon` 6/6 (P5 bővítve), qa-nap 45, meres 51, meta-elo 9, tiktok-elo 15, qa4-smoke 7 – zöld. Vendégadat nincs.
