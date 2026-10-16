# Medical Piercing /uj oldalak, 2. élesítés aznap – teszt-napló (2026-10-16)

Helyben, a végleges buildre (`node tools/build.mjs`, `node tools/serve.mjs`, :4290). A Salonic felé csak olvasó GET megy, a `/api/urlap` kéréseket a tesztek elfogják, foglalás nem indult.

| Teszt | Eredmény |
|---|---|
| `tools/uj-oldalak-teszt.mjs` (mind) | 174 oldal, 5552 ellenőrzés, 0 hiba |
| `tools/uj-oldalak-teszt.mjs --oldal=/kapcsolat,/a-szuras-folyamata,/piercer-kovacs-richard,/elerhetosegek` (utolsó CSS-javítás után) | 0 hiba |
| `tools/uj-fooldal-teszt.mjs` | minden rendben |
| `tools/motor-tipus-teszt.mjs` / `--mobil` | minden rendben |
| `tools/motor-formazas-teszt.mjs` (6 nézet, a helyszín-lépés térképpel) | minden rendben |
| `tools/motor-teszt.mjs` / `--mobil` (foglalási út, booking_id, köszönőoldal-mérés) | minden rendben |

## Mérést érintő pontok
- A helyszín-térkép városai (a kitelepülések oldalán: a meglévő Salonic-helyszínlinkek; a motorban: a meglévő helyszín-választás) új belépési pontok
  ugyanarra a foglalási útra. A `[data-szolg]` gombok, a mérési események és a mérőkód fájljai (`mp-meres.js`, `suti.js`, `motor-indito.js`,
  `salonic-adapter.js`, `booking-id.js`) nem változtak.
- A visszahívó űrlap mezőnevei, sorrendje és végpontja változatlan (a `motor-tipus-teszt` H-része ellenőrzi).
- A főoldal-tesztben engedélyezve: `graph.facebook.com/<id>/picture` (a Trustindex-doboz Facebook-forrású véleményeinek profilképe). A Meta-pixel és a Graph API
  más címei továbbra is hibának számítanak.

## Észrevétel
- A Salonicban 2026-10-16-án új szolgáltatás jelent meg („Kiesett ékszer újraszúrása”, 489001 és 489002). A motor eddig a „1 piercing” sorba, a főoldalról
  elsőként, lenyitva tette. Javítva: a piercerei szerint a „1 piercing” (közérzetjavító piercerek) vagy a „Fülbevaló” sor végére kerül, egyszer.
