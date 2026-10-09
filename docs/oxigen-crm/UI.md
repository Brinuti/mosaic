# CRM belső felület (/crm) – átadási jegyzet

Egyoldalas, build-lépés nélküli webalkalmazás (vanilla JS, ES modulok). Nincs külső könyvtár, CDN, tracking, `suti.js`, mérőkód: a `/crm` oldal csak saját fájlokat tölt.
Az API-szerződés: `API.md`; a UI kizárólag az ott felsorolt `/api/crm/...` végpontokat hívja.

## Fájlok

| Fájl | Szerep |
|---|---|
| `foglalas/crm.html` | HTML-váz (`noindex, nofollow`, `referrer: no-referrer`); a no-store / CSP fejlécet a Function adja (`CSP_CRM`) |
| `assets/css/crm.css` | arculat (sötétzöld `#0f3a3c`, krém, arany `#c9a96a`; Playfair Display + Jost az `/assets/fonts`-ból), tablet + telefon |
| `assets/js/crm-app.js` | belépés (e-mail → 6 jegyű kód, szerepkörönkénti Demo gombok), keret, hash-router (`#/nézet/azonosító?param`), szerepkör szerinti menü, üzemmód-jelző |
| `assets/js/crm-api.js` | API-kliens: `X-CRM-CSRF` minden írásnál, 401 → vissza a belépéshez, 501/404-JSON-nélkül/nem JSON válasz → „még nem elérhető” |
| `assets/js/crm-ui.js` | elem-építő (`h()`; **soha nem `innerHTML`**), formázók (`29 900 Ft`, Europe/Budapest), tábla, fülek, párbeszéd, toast, kliens-oldali kép-átméretezés |
| `assets/js/crm-normal.js` | a backend-válaszok egységes alakra hozása (több mezőnevet is elfogad) |
| `assets/js/crm-cimkek.js` | állapot-címkék magyarul (booking, kúra, bérlet, dokumentum, panasz, job…) |
| `assets/js/crm-vendegvalaszto.js` | közös vendégválasztó (maszkolt találatok) |
| `assets/js/crm-nezet-*.js` | a 15 képernyő (lazy `import()`) |
| `tools/crm-ui-teszt/` | Playwright-teszt + önálló teszt-szerver (valódi `crm/lib/api.js` + memória-DB + teszt-adat) |

## A 15 képernyő (spec 3.2) és állapotuk

| # | Képernyő (hash) | Állapot | Megjegyzés |
|---|---|---|---|
| 1 | Áttekintés (`#/dashboard`) | PARTIAL | kezelői / menedzsment nézet, számkártyák + listák; a `/dashboard` mezőit általánosan jeleníti meg (a backend modul szerkezete még nincs rögzítve), 501 esetén „még nem elérhető” |
| 2 | Vendégkereső + profil (`#/vendegek[/id]`) | DONE | maszkolt találat, guest_key, Salonic-azonosítók, foglalás, kúra, bérlet, credit, consent, üzenetek, dokumentumok, panasz, képek; recepciónak nincs kép / kérdőív; e-mail módosítás |
| 3 | Napi munkalista (`#/munkalista`) | DONE | kérdőív-állapot, KONTRAINDIKÁCIÓ-jelzés (letiltja az igazolást), „Kezelés igazolása” (megerősítéssel), no-show, kérdőív-link kiadás, következő időpont, kamera-felvétel felajánlás |
| 4 | Állapotfelmérő (`#/felmero`) | DONE | beadott kérdőív átnézése (cleared / consult / postponed / contraindicated), verziók + jóváhagyás (csak clinical_lead); REQUIRES_VERIFICATION végig látható |
| 5 | Kúraterv-szerkesztő (`#/kuraterv[/kezelesId]`) | DONE | A5 mezők (plan / review / closing), piszkozat, véglegesítés, hiányzó mezők listája, A5 PDF **új lapon** (lásd API-hiányok), e-mail küldés állapota |
| 6 | Kameraképek (`#/kepek/vendegId`) | DONE | 1/3/5/10, `<input type=file accept=image/* capture>`, kliens-oldali átméretezés (max 1600 px, JPEG 0,82), két kép összehasonlítása, 2–3 mondatos komment (számlálóval), véglegesítés, link-kiadás |
| 7 | Bérletek és ajándékok (`#/berletek/vendegId`) | DONE | 5/10 vásárlás, lejárat, használt / lefoglalt / szabad, ajándék-átadás, hosszabbítás / refund / korrekció (csak salon_manager) |
| 8 | Hajkamera-beszámítás (`#/credit/vendegId`) | DONE | credit-állapot, határidő, első foglalás bizonyíték, 4 990 Ft levonás egyszer (megerősítéssel) |
| 9 | Küldési vezérlő (`#/kuldes`) | PARTIAL | sablonok, előnézet + kapu-döntés, jobok / okok / újrapróba, sandbox-próba; „Ez a rendszer jelenleg NEM küld éles üzenetet” dry módban. Az előnézet / újrapróba / sandbox a motor-modulra vár (501 → „még nem elérhető”) |
| 10 | Hozzájárulások (`#/hozzajarulas/vendegId`) | DONE | csatornánként (e-mail, SMS, képmarketing külön, adatkezelés), változástörténet, szövegverzió (REQUIRES_VERIFICATION jelzéssel) |
| 11 | Elégedettség és panasz (`#/panasz`) | DONE | nyitott panaszok, 24 órás határidő, saját kezelő, 2 hívás + e-mail napló, lezárás, kompenzáció kérés / döntés (salon_manager), felelős csere, kezelőnkénti 1–5 riport |
| 12 | Kúrazáró dokumentum (`#/kurazaro/vendegId`) | DONE | előfeltételek (11. igazolt kezelés, 1/3/5/10 kép, záródokumentum állapot), küldés |
| 13 | Összevonási sor (`#/osszevonas`) | DONE | e-mail / telefon / név egyezés, jóváhagyás / elutasítás (kezelő, szakmai vezető), visszafordítás |
| 14 | Mutatók (`#/mutatok`) | PARTIAL | `/merok` kártyák, „kohorsz nem ért meg” / „nincs adat” állapotok, kezelő-bontás; a válasz-szerkezetet a mérő-modul még nem rögzítette, ezért általános |
| 15 | Hozzáférés és beállítások (`#/beallitasok`) | DONE | munkatársak (felvétel, szerepkör, deaktiválás – admin), beállítások (JSON-szerkesztő, jogi szövegek REQUIRES_VERIFICATION jelzéssel), Salonic-állapot, audit-napló + CSV export |

## Biztonság és adatkezelés a UI-ban

- Vendég által beírt szöveg csak `textContent` / szövegcsomópontként kerül az oldalra (teszt: `<img onerror>` nevű vendég). Az e-mail-előnézet `sandbox=""` iframe-ben (`srcdoc`) jelenik meg.
- A CSRF-token a belépés válaszából, memóriában; minden írás `X-CRM-CSRF`-fel. 401 → belépő képernyő „A munkamenet lejárt” üzenettel. Nincs token a `localStorage`-ban; csak a demo-jelző van `sessionStorage`-ban.
- A menü a szerepkör-mátrix (`crm/lib/rbac.js`) szerint szűr, de a backend dönt; tiltott képernyő hash-ből „Nincs jogosultság”.
- A recepció nem kap kép / kérdőív képernyőt, és a munkalistán sem látja a kérdőív-állapotot (a backend nem adja ki).
- A kép-megtekintés (`GET /kepek/:id`) csak kattintásra történik (naplózott), nem tömegesen.
- A kérdőív-kérdések, jogi szövegverziók és hozzájárulási szövegek **REQUIRES_VERIFICATION** jelzése mindenhol látható; végleges állapotot a UI nem hirdet.
- Üzemmód-jelző a felső sávban: DRY-RUN / ÉLES; a „Demo” sáv a demo-fiókoknál. A `/auth/demo` gombok csak akkor jelennek meg, ha a végpont elérhető (nem éles domainen).

## API-hiányok / javaslatok (a UI ezek nélkül is működik, de jobb lenne)

1. **CSP (`CSP_CRM`) és PDF-beágyazás**: a `frame-src` nincs megadva (→ `default-src 'self'`), a fájl-válaszok `sandbox` CSP-t kapnak, ezért az A5 PDF nem ágyazható be iframe-be. A UI új lapon nyitja (blob URL) és letöltést kínál. Ha a `CSP_CRM` kap `frame-src blob:` engedélyt, a `PDF_BEAGYAZAS` konstanssal (`crm-nezet-kuraterv.js`) bekapcsolható az inline előnézet.
2. **Panasz-részletek**: `GET /panaszok` nem ad kapcsolatfelvétel-listát és kompenzációs kéréseket, ezért a részletnézet csak az új naplóbejegyzéseket tudja rögzíteni. Javasolt: `probalkozasok[]` és `kompenzaciok[]` a panasz-objektumban (a UI már elfogadja).
3. **Összevonási audit-lista**: nincs végpont a már jóváhagyott összevonások listájára; a visszafordítás csak az adott munkamenetben jóváhagyottakra, vagy kézzel megadott audit-azonosítóra működik. Javasolt: `GET /osszevonas?allapot=jovahagyott` `merge_audit_id`-val.
4. **Dashboard / merok**: a válasz-szerkezet nincs rögzítve (jelenleg 501). A UI minden számmező-kulcsot kártyaként, minden tömb-mezőt listaként jelenít meg; javasolt a kulcsok rögzítése (`API.md`), hogy a feliratok pontosak legyenek.
5. **Üzemmód olvasása**: `GET /uzenetek/uzemmod` `message` olvasási jogot kér, ezért a szalonvezető és a marketing szerepkör nem látja az üzemmódot („nem látható”). Javasolt: a jelzőt minden belépett szerepkör kaphassa (csak olvasható, nem érzékeny).
6. **Kérdőív-kiadás újraolvasása**: a `felmero-kiad` a tokent csak az első kiadáskor adja vissza (`mar: true` esetén nincs link); javasolt újrakiadás vagy „link másolása” művelet.
7. **Kép-lista a munkalistán**: a munkalista sora nem tartalmazza a `kezeles_id`-t (csak az igazolás válasza); a kameraképek nézet a vendégprofil `kura.kezelesek[]` listájából választ alkalmat.

## Tesztelés

```
node --test tools/crm-ui-teszt/crm-ui.test.mjs
```

A teszt saját szervert indít (`tools/crm-ui-teszt/teszt-szerver.mjs`: a valódi `crm/lib/api.js` memória-SQLite-tal és teszt-adattal, külső hálózat nélkül), Playwrighttal (chromium) fut. Képernyőképek: `/tmp/crm-ui-kepek` (`CRM_UI_KEPEK` változóval átírható). A teszt-szerver önállóan is indítható: `node tools/crm-ui-teszt/teszt-szerver.mjs --port=4311`.
