# Sajat suti-sav es hozzajarulas-allapot (gyogytornaszom.hu)

Feri dontese (2026-10-13): **CookieYes nincs, es nem is lesz**; sajat sav, az MP #280/#296 mintajara, gyogytornahoz igazitva (csak Google; Meta / TikTok nincs).
A sav es a Consent Mode v2 a foglalomotorral EGYUTT elesedik (Feri jovahagyasaval); addig az elo oldalon semmi nem valtozik, az elonezeten mehet.

## 1. A consent-allapot semaja (verzio: v1)
| Kategoria | Ertek | Google Consent Mode jel |
|---|---|---|
| szukseges | mindig igen | functionality_storage / security_storage: granted (a GTM Consent Initialization adja) |
| statisztika (`s`) | 0 / 1 | analytics_storage |
| marketing (`m`) | 0 / 1 | ad_storage, ad_user_data |
| szemelyre szabas | mindig tiltva | ad_personalization: denied |
Hianyzo, ertelmezhetetlen, jovobeli vagy 400 napnal regebbi allapot = **nincs hozzajarulas** (a sav ujra kerdez; a szerver `hozzajarulas()` is "nincs_dontes"-nek veszi). A foglalas mukodese nem fugg a hozzajarulastol.

## 2. Tarolas
Suti `gy_suti=v1-s<0|1>-m<0|1>-t<unix mp>`: elso feles, `Path=/`, `Domain=gyogytornaszom.hu` (elesben; elonezeten feles host), `SameSite=Lax; Secure`, 365 nap. Nem HttpOnly (a sav JS-bol irja, a GTM / szerver olvassa). A szerver (`lib/hozzajarulas.js`) a `Cookie` fejlecbol olvassa; az `/gy-foglalas/api/*` hivasok a `www.gyogytornaszom.hu` hoston mennek, igy a suti elmegy.

## 3. dataLayer
- Minden oldalbetoltesen: `{ event: 'gy_suti_allapot', gy_suti_dontott: bool, gy_suti_stat: bool, gy_suti_mark: bool, gy_suti_verzio: 'v1' }` (dontes elott: dontott=false, stat=false, mark=false).
- Dontes / modositas / visszavonas utan: `{ event: 'gy_suti_valtozas', ...ugyanezek }` es `gtag('consent','update', { ad_storage, ad_user_data, ad_personalization:'denied', analytics_storage })` (mentett dontesnel mar oldalbetoltesen is a `consent update`).
- A Consent Mode DEFAULT-ot (mind denied) a GTM Consent Initialization adja (mereso felelos); a sav nem allit default-ot, es mero-kodot nem tolt be.

## 4. Visszavonas es modositas
- Lablec: a WordPress-lablec `adatvedelmi-nyilatkozat` linkje utan automatikusan "Suti beallitasok" link (a sav illeszti be), `#suti-beallitasok` cimresz, `window.gySuti.beallitasok()`.
- Az **Elutasitom** ugyanolyan meretu, szinu es sulyu gomb, mint az Elfogadom (a tesztben meresre ellenorizve); a szoveg nem megteveszto (leirja, mit merunk, hogy a dontes onkentes, es hogy a foglalast nem befolyasolja).
- Visszavonaskor: `consent update` (denied), `gy_suti` ujrairva; a szerver a kovetkezo hivasnal torli a 30 napos `gy_lpt` sutit es rekordot.
- Lejarat: 365 nap utan (vagy ervenytelen suti eseten) a sav ujra kerdez.

## 5. Elfogadasi arany javitasa es nevtelen statisztika (az MP v3 atvetele)
Munkamenetenkent az elso oldalon nagyobb doboz ("Segitesz nekunk egy kattintassal?"), utana vekony sav; ket egyforma suly gomb. A nevtelen statisztika: `POST /api/gy-suti-stat` (`navigator.sendBeacon`), csak napi darabszam (megjelent / elfogad / elutasit / reszleges / beall; nezet; eszkoz; verzio), suti / IP / URL / azonosito nelkul, 13 honapig. Az adatkezeleset Feri kulon ellenorzi (JOGALAP_KERDESEK.md 3/b).

## 6. Tesztek
`node tools/test-gy-suti-pw.mjs desktop|mobil` (dontes elott, Elutasitom, reszleges mentes, Elfogadom + szerver-allapot, visszavonas, ervenytelen suti, iframe, statisztika, 0 kulso kerelem) es a `lib/hozzajarulas.js` egysegtesztjei (`npm run teszt`).
