# Oxigen mini CRM + uj landing - architektura (kozos szerzodes a fejlesztokhoz)

Forras: `MASTERPROMPT.md` (ugyanebben a mappaban). A 121 dontes es a "TILOS" lista kotelezo. Ez a fajl csak a TECHNIKAI szerkezetet rogzit,
hogy a parhuzamos munkak osszeilljenek.

## Hol fut

- **Cloudflare Pages + Pages Functions** (a repo mar igy fut: `functions/`, `wrangler.toml`), **D1** (SQLite) az adatnak, **R2** (privat) a kepeknek / PDF-eknek.
- Az uj CRM **kulon** adatbazis (`CRM_DB`, R2: `CRM_FAJLOK`), nem a meglevo `LIFECYCLE_DB`. A meglevo eles lifecycle (`netlify/lib/lifecycle`, `LIFECYCLE_MOD=elo`) **erintetlen**; az uj uzenetmotor
  kulon, alapbol `DRY_RUN` (`CRM_KULDES=dry` | `eles`), az elesre kapcsolas a tulajdonos kulon "GO"-ja.
- Minden uzleti logika `crm/lib/*.js` (tiszta ES modulok, **platformfuggetlen**; nincs `fetch`/`env` beleegetve, minden fuggoseg parameter). A Pages Function (`functions/api/crm/[[ut]].js`) vekony
  burok: auth + `crm/lib/api.js` router. Igy minden `node --test`-tel tesztelheto.
- DB felulet: a Cloudflare D1 API (`db.prepare(sql).bind(...).run()/all()/first()`, `db.batch([...])`). Teszthez/helyi demohoz `crm/lib/testdb.js` (`ujAdatbazis()` = memoria-SQLite az osszes
  `crm/migrations/*.sql`-lel). **Csak ezt a feluletet hasznald** (nincs ORM, nincs raw sqlite specifikus fuggveny, `json_extract` megengedett).
- Idobelyeg: egesz **epoch masodperc** (mint a lifecycle-ban). ID: `crypto.randomUUID()` (UUID v4), a kiolvashato kodokat ne tedd kulcsnak.
- Nyelv: azonositok **angolul** (a spec tablanevei: `guest`, `booking`, `package_purchase`...), kommentek **ekezet nelkuli magyarul**, felhasznaloi szovegek **ekezetesen**. Commit-uzenet ekezet nelkul.
- Penz: egesz forint (`29900`). A konstansok EGY helyen: `crm/lib/constants.js` (arak, idotartamok, bérlet-ervenyesseg, ablakok) - sehol mashol ne legyen beegetett szam.

## Konyvtarszerkezet

```
crm/
  migrations/0001_init.sql ...   sorszamozott, ujrafuttathato (CREATE TABLE IF NOT EXISTS), FK + index + UNIQUE a speckonak megfeleloen
  lib/
    constants.js        arak, szabalyok, allapot-nevek (a spec 2.2 es 3.4)
    testdb.js           (kesz) D1-szeru teszt-adapter
    db.js               kis segedek (tranzakcio-burok, JSON mezok, now())
    audit.js            security_audit + booking_event + merge_audit iras
    rbac.js             szerepkorok -> jogosultsag-matrix (backend-ellenorzes)
    guest.js, merge.js  vendeg + salonic_guest_identity, auto/kezi osszevonas
    booking.js          booking + booking_event, idempotens ingest, status-gep
    course.js           course + treatment_session (csak kezelo-igazolt completed noveli az indexet)
    package.js          package_purchase / redemption / adjustment / gift, lejarat-szabalyok
    credit.js           assessment_credit (4 990 Ft, 30 nap, egyszer)
    assessment.js       digitalis allapotfelmero + kontraindikacio-flag
    plan.js             treatment_plan, A5 tartalom, kuruzaro
    images.js           camera_image, image_comparison, share_grant (token hash, 30 nap, uj link e-mail-ellenorzessel)
    consent.js          consent_event, unsubscribe
    complaint.js        survey_response, complaint, kompenzacio-jovahagyas
    messages/           uzenet-katalogus + motor (lasd lent)
    api.js              router: (request, env, ctx) -> Response, szerepkor-ellenorzes MINDEN vegponton
    pdf.js              A5 HTML -> PDF (lasd lent)
  test/*.test.mjs       node:test; fixture-ok: crm/test/fixtures.js
functions/api/crm/[[ut]].js   Pages Function burok
foglalas/crm.html + assets/js/crm-app.js + assets/css/crm.css   a belso UI (egy oldalas, /crm)
foglalas/oxigenterapia-budapest-uj.html + assets/css/oxigen-uj.css + assets/js/oxigen-uj.js   az uj landing
docs/oxigen-crm/*.md   atadas (CRM_ATVETEL.md = statusz-tabla)
```

## Szabalyok, amiket minden modul betart

1. **Backend dont**, a bongeszo nem. Minden iras tranzakcioban/batch-ben, idempotens (UNIQUE kulcsok), konkurencia ellen UNIQUE + `INSERT OR IGNORE` + ellenorzott `changes`.
2. **Audit**: minden allapotvaltas, jovahagyas, kepelerés, export, jogosultsag-elutasitas audit-sort kap (`security_audit`: ki, mit, mikor, eredmeny, ip-hash).
3. **Nincs PII a mérésben**: web/CRM esemenyekben `event_id`, `booking_uuid`, `service_type` - nev, e-mail, telefon, egeszsegi adat SOHA.
4. **Kuldes csak outboxon at** (`message_job` -> claim -> kuldo-adapter), `DRY_RUN` alapertelmezes. A job a kuldes pillanataban ujra olvassa a vendeg allapotat (spec 3.8).
5. **Nincs vendegportal**, kepek/PDF csak privat storage-bol, token hash-elve, `Cache-Control: no-store`, `Referrer-Policy: no-referrer`.
6. **Nincs kitalalt adat**: ami a speckben "REQUIRES_VERIFICATION" (Salonic-API, gyartoi kerdesek, 95% / 2 millio, jogi szovegek), azt jelolt konstansba / `// REQUIRES_VERIFICATION:` megjegyzesbe tedd, a UI-ban pedig lathato jelzessel.
7. **Salonic**: nincs API / webhook / foglalasi azonosito. A bejovo adat a meglevo Zapier-lancbol jon (ertesito e-mail -> `netlify/lib/lifecycle/parser.js` -> `/api/lifecycle/bejovo`); az uj CRM ugyanabbol az elemzett esemenybol kap masolatot
   (`crm/lib/ingest.js`). A booking azonositoja a Salonic bookingId (ha az ertesitoben van), egyebkent a lifecycle szintetikus hash-e. A "completed" CSAK kezelo-igazolassal jon letre.
8. **Teszt**: minden modulhoz `node --test` (futtatas: `node --test crm/test/`), a spec QA-azonositoival (B/C/P/M/S) a teszt nevében: `test('P03 ...')`.

## Szerepkorok

`therapist` (Oxygeni-kezelo), `clinical_lead` (Janka: szakmai vezeto), `reception`, `salon_manager` (szalonvezeto: penzugyi jovahagyas), `marketing` (aggregalt), `admin`.
Jogosultsag-matrix: `crm/lib/rbac.js` (a spec 3.10: recepcio minimalis kereskedelmi adat; egeszsegi kepek / kerdoiv csak kezelo + clinical_lead; marketing csak aggregalt).

## Allapotok es konstansok (a spec 3.4 / 2.2 szerint)

`booking.status`: booked -> rescheduled | cancelled | no_show | completed. `course`: not_started -> active -> completed_11 | paused_clinical | closed_individual.
`package`: paid_active -> exhausted | expired | extended_by_manager | refunded. `complaint`: open -> resolved. `document`: missing -> draft -> therapist_final -> generated_pdf -> sent.
Arak: first 29900 (80 perc), camera 4990 (30 perc), followup 26000, package_5 130000 (6 ho), package_10 260000 (12 ho), kurazaras: 11 kezeles.
