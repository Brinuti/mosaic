# Medical Piercing – a két akció-oldal összevonása (/3-piercing-2-araert) – teszt-napló (2026-10-17)

## A tulajdonos kérése
„most élesben van ez a két oldal [/3-piercing-2-araert-regi, /3-piercing-2-araert], ez legyen egy, tehát a három piercing két áráért maradjon meg, a … régi link az 301-jel
irányítson át … a régi oldalt klónozd le az új élesre, az új dizájnnal … itt csak a szekciók sorrendje és a szöveges tartalom, és ez a fontos … és utána linkeld be mind a kettőt”.
A „régi oldal” a Wix-es eredeti `/3-piercing-2-araert-regi` (a tulajdonos ennek a webarchív mentését küldte); a klónja a `/regi/3-piercing-2-araert-regi` címen él.

## Mi változott
- `/3-piercing-2-araert-regi` → **301** → `/3-piercing-2-araert`, a paraméterekkel (`lib/utvonal.js` `SAJAT_ATIRANYITASOK`; a Cloudflare-függvény, a build és a helyi
  kiszolgáló ugyanezt használja). A `/regi/3-piercing-2-araert-regi` (a Wix-es eredeti) marad.
- `/3-piercing-2-araert`: kézzel írt oldal (`uj-oldalak/sajat/3-piercing-2-araert.html`), a Wix-es `-regi` oldal szakasz-sorrendjével és szövegével, a mostani dobozokkal:
  hős → Több piercing = Erősebb hatás (+ ékszer-lapozó) → 9 ok (mind a 9; a kinyert tartalomban csak az 1. volt, a Wix-klónból pótolva) → Legnépszerűbb piercingeink 👇
  (10 típus) → Tudtad, hogy...? → 93% → Olvasd el a visszajelzéseket! → Már 15 városban várunk! → Ismerd meg csapatunkat!
- A menü „Akció” pontja, az akciós sávok és a régi „3 piercing 2 áráért! - AKCIÓ!” linkek közvetlenül az új címre mutatnak.
- Lapcím: „Őszi akció: 3 piercing 44 900 Ft | Medical Piercing” (a Wix-es cím régi árral szólt), saját leírás; canonical: `/3-piercing-2-araert`.
- A hős plakátja asztalon és mobilon is egészben (négyzetes keret) – a feliratos képek szabálya.
- Az eddigi két változat (a „Páros kedvezmény” a B-építővel, és a `-regi` címen a PDF 03-as terve szerinti kézzel írt oldal) helyett ez az egy; a páros akció rejtett
  B-változata (`/b/3-piercing-2-araert`) marad.

## Szándékos eltérés az eredeti szövegtől
- a vélemény-szám a Google mostani száma (az eredetin „4.107”);
- „Már 15 városban várunk!” (az eredetin 12, a felsorolt városok száma 15; ugyanígy, mint a TikTok-landolón, a tulajdonos 2026-10-16-i döntése);
- a város-csempe maga a foglaló-link (nincs külön „Időpontfoglalás” gomb), a kitelepülési napok a táblázatból (nem az eredeti, elavult dátumok);
- a „higiánia” elírás javítva („higiénia”).
A „9 ok” 8. pontja az eredeti szöveget hozza („Több mint 3.400 értékelés alapján…”) – a mostani szám 5000+; a tulajdonos dönthet a frissítéséről.

## Mérés – MÉRÉST ÉRINT (céloldal-cím)
A mérőkód fájljai nem változtak. A 2026-10-16-i hirdetés-lista szerint **46 aktív Meta-hirdetés** visz a `/3-piercing-2-araert-regi` címre (8-nak van `utm_content={{ad.id}}`
paramétere); ezek a 301 után a `/3-piercing-2-araert` címen landolnak, minden paraméterrel (fbclid, utm_*): a GA / Meta-pixel oldalmegtekintése ezentúl ezen a címen jelenik meg.
A hirdetéseket nem módosítottam.

## Tesztek
- helyben: `/3-piercing-2-araert-regi?utm_source=proba&fbclid=IwAR1` → 301 → `/3-piercing-2-araert?utm_source=proba&fbclid=IwAR1`; `/regi/3-piercing-2-araert-regi` 200
- `uj-oldalak-teszt`: 174 oldal, 5730 ellenőrzés, 0 hiba – benne a `-regi` cím (az átirányítással az új oldal) **összevetése a Wix-es eredeti szövegével** (a fenti négy
  szándékos eltérés a `SZANDEKOS_LAP` sorban; minden más eredeti sort számon kér)
- `uj-b-teszt` 1042 / 0, `uj-fooldal-teszt` rendben, `meres-teszt` rendben, `csuszas-teszt` (206 + 206 lap, késleltetett képekkel): nincs csúszás
- szemrevételezés: asztali 1440 px és mobil (iPhone 13) teljes oldal; a plakát mindkettőn egészben
