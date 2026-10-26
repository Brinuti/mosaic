---
name: oxigen-crm
description: A MOSAIC Oxigénterápia mini CRM-jének és az új oxigénterápia landingnek (/oxigenterapia-budapest-uj) teljes átadási tudása – hol tart, mi él, mi nem éles, hogyan kell tesztelni, mik a tulajdonosi döntések és szabályok. Használd MINDEN alkalommal, amikor a /crm felületről, a CRM API-járól (functions/api/crm, crm/lib), az Oxigen kezelői folyamatról (Ma képernyő, Kezelés közben, A5 kúraterv PDF, hajkamerás képek, tablet-képküldés), az állapotfelmérő kérdőívről, a CRM üzenetmotorjáról (dry-run, 29 sablon, marketing-kapcsoló), a Salonic → Zapier → CRM adatáramlásról vagy az oxigén landing hozzájárulás-blokkjáról van szó, vagy ha a felhasználó azt mondja: „oxigén CRM", „folytasd a CRM-et", „kezelők", „hajkamera", „Ma képernyő", akkor is, ha a CRM szót nem mondja ki. Olvasd el, mielőtt a CRM-hez vagy az oxigén landinghez nyúlsz.
---

# MOSAIC Oxigén CRM + új landing – átadás (2026-10-26 állapot)

Ezt a skillt a CRM-et építő munkamenet írta, hogy egy új ablak onnan folytathassa, ahol az abbahagyta. **Kezdd azzal, hogy ellenőrzöd, mi változott azóta**: `git fetch && git log origin/main --oneline -20 -- crm functions/api/crm assets/js/crm-* foglalas/crm.html foglalas/oxigenterapia-budapest-uj.html`. A skill a 2026-10-26-i állapotot rögzíti; ha a repó ennél újabb, a repó az igaz.

## 1. A tulajdonossal való együttműködés (kötelező szabályok, a repo CLAUDE.md-jéből és a munkamenetből)
- **Magyarul** beszélj, érthetően, szakszó nélkül (a tulajdonos, Feri, nem fejlesztő). Állapotjelzés is magyarul.
- **Mindent te csinálsz meg**: ne adj feladatot a tulajdonosnak, ha van rá út (Composio, Gmail, Zapier, Drive, D1 MCP, Playwright). Csak azt kérd tőle, amit csak ő tud (egy kattintásos bejelentkezés, valódi foglalás reCAPTCHA mögött, döntés).
- **Minden változtatás után**: teszt → commit → push a saját ágra → PR a `main`-re → (a tulajdonos döntése szerint) azonnal merge teljes 40 karakteres SHA-val, és ellenőrzés az éles oldalon. Commit-üzenet magyarul, **ékezet nélkül**, a harness által megadott lábléccel. Modellnevet SOHA ne írj commitba / PR-be.
- **Takarékos build**: a Cloudflare Pages havi 500 buildet enged; apró javításért ne merge-elj külön.
- **NEM terjed ki az azonnali élesítés** a visszafordíthatatlan / külső hatású lépésekre: a **CRM_KULDES=eles** (valódi levél/SMS a vendégeknek), a meglévő éles oxigén lifecycle-sorozat kikapcsolása, a régi `/oxigenterapia-budapest` oldal lecserélése, külső fiókok (Meta, GTM, GA, Google Ads, TikTok) módosítása – ezekhez a tulajdonos **külön, kifejezett „GO"-ja** kell.
- A repo privát (`Brinuti/mosaic`). **Ne tedd publikussá** a repót vagy a tárhelyet; az átadás a `main`-en + a Drive „Mosaic-weboldal-claude-atadas" mappán át megy.
- Másik ablak: ne a `claude/mosaic-repo-review-h58awk` ágon dolgozz, hanem új ágon `origin/main`-ről (másik munkamenet is használhatja azt az ágat; push előtt `git fetch` + merge).

## 2. Mi ez az egész, és hol tart
Két dolog készült:
1. **Új oxigénterápia landing**: `/oxigenterapia-budapest-uj` (noindex, rejtett cím). A régi élő `/oxigenterapia-budapest` érintetlen; csere csak „GO"-ra. Fájlok: `foglalas/oxigenterapia-budapest-uj.html`, `assets/css/oxigen-uj.css`, `assets/js/oxigen-uj.js`, `assets/js/booking-engine/beagyazott.js`, tesztek: `tools/oxigen-uj-teszt/`. A marketing-hozzájárulás blokk **el van rejtve** (`hidden`), lásd a döntéseket.
2. **Mini CRM** (`/crm`, belépés e-mailes 6 jegyű kóddal, élesen fent van, de üres/valós foglalásra vár): vendégek, foglalások (a Salonic értesítőkből), 11 alkalmas kúra, bérlet (5/10), 4 990 Ft hajkamera-beszámítás, digitális állapotfelmérő, kezelői A5 kúraterv + PDF, hajkamerás képek (1/3/5/10. alkalom), hozzájárulás, panasz/elégedettség, üzenetmotor (**dry-run**), mutatók, szerepkörök, napló.

Az eredeti terv (ChatGPT-s spec, a tulajdonos feltöltése): `docs/oxigen-crm/MASTERPROMPT.md` (121 döntés, TILOS-lista, adatmodell, üzenetkatalógus). Technikai szerződések: `docs/oxigen-crm/ARCHITEKTURA.md`, `API.md`, `UI.md`, `crm/lib/README.md`. Használati leírás a kezelőknek: `docs/oxigen-crm/HASZNALAT.md`; prospektus: `docs/oxigen-crm/MOSAIC_CRM_BEMUTATO.pdf`; tablet: `docs/oxigen-crm/TABLET_KEPKULDES.md`.

Részletek a `references/` mappában (olvasd el a feladat szerint):
- `references/felepites.md` – fájltérkép, adatáramlás, környezetek, azonosítók, tesztparancsok.
- `references/dontesek-es-szabalyok.md` – tulajdonosi döntések, TILOS-lista, mi van kikapcsolva és miért.
- `references/allapot-es-teendok.md` – mi kész, mi tesztelve, mi hiányzik, a javasolt következő lépések.
- `references/tanulsagok.md` – csapdák a környezetben (böngésző, Salonic, shell, jogosultságok).

## 3. A legfontosabb tudnivalók egy oldalon
- **Adatáramlás**: Salonic értesítő e-mail → Zapier `lifecycle-bejovo` (01a1168a-afbf-7ee9-94c3-6e5be524b6be) → `/api/lifecycle/bejovo` → a meglévő lifecycle ÉS `crm/lib/lifecycle-kapocs.js` → CRM D1. Csak az **oxigén** üzletág foglalásait veszi át; a többit `figyelmen_kivul`-ként naplózza. **2026-10-10-én valódi tesztfoglalással igazolva** (foglalás + lemondás végigment).
- **A Salonicnak nincs API-ja, a foglalóűrlap reCAPTCHA mögött van.** Automatikus foglalás nem lehetséges, és a védelmet nem szabad megkerülni: a valódi teszt-foglalást a tulajdonos csinálja, te ellenőrzöd és takarítod.
- **Üzenetküldés: DRY-RUN** (`CRM_KULDES="dry"`). **Marketing üzenet nem megy ki** (`MARKETING.be=false` a `crm/lib/constants.js`-ben, tulajdonosi döntés 2026-10-10). A 29 sablon marad változatlanul (a tulajdonos: „ne változtassunk, messze vagyunk az élesítéstől").
- **Kezelői felület** (telefonra tervezve): főmenü = Ma, Vendégek, Üzenetek, Képküldés (tablet); a többi az „Egyebek" alatt. A kezelés a „Ma" → vendég → vezetett folyamat (igazolás, kamerakép, megfigyelés/cél/ritmus/rutin választógombokkal, személyes üzenet, A5 PDF, küldés).
- **Hajkamera-kép útja**: tablet (Samsung/Android, a kamerához csatlakozik) → Galéria → Megosztás → „MOSAIC CRM" (telepített web-app, Web Share Target) → kép-beérkező (vendég nélkül, 6 óra után törlődik) → a kezelő a telefonján a vendéghez rendeli. **Valódi tableten még nem próbálta ki senki** (a tulajdonosnak nem volt tabletje).
- **Demó belépés csak az előnézeten** (`CRM_DEMO=1`, az éles hoszton a kód elutasítja). Az éles CRM-et nem szabad belépés nélkülivé tenni (egészségügyi adat lesz benne).
- **Napló append-only**: a `booking_event` és az audit táblák törlése trigger miatt tiltott; a védelmet nem kerüljük meg. Teszt-vendéget anonimizálni lehet (`guest.status='deleted'`, név/e-mail/telefon null).

## 4. Hogyan dolgozz (munkafolyamat)
1. `git fetch`, új ág `origin/main`-ről; olvasd el ezt a skillt és a feladathoz tartozó `references/` fájlt.
2. Változtatás → `node --test crm/test/*.test.mjs` (290 teszt), UI: `node --test tools/crm-ui-teszt/crm-ui.test.mjs` (26 teszt, ~4 perc; **ne** `*.mjs`-t futtass a mappában: a `teszt-szerver.mjs` akadna), lifecycle: `node --test tools/lifecycle-teszt/*.test.mjs` (69), landing: `node tools/netlify-build.mjs && node --test tools/oxigen-uj-teszt/oxigen-uj.test.mjs` (23).
3. Commit → push → PR → várj a Cloudflare előnézetre (a PR-ben a bot kommentje adja a címet) → API-ellenőrzés curl-lel (demo belépés: `POST /api/crm/auth/demo {"szerep":"therapist"}`) → merge → éles ellenőrzés (`curl`, a fájlok `?v=` hash-ével).
4. Valódi (éles) adatot ne módosíts a D1-ben a tulajdonos kérése nélkül; teszt után takaríts, és számolj be róla.
