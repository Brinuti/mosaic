# Érintésnapló kiterjesztése: Medical Piercing, Gyógytorna, A76 (terv)

**Csak terv, kód nincs. MÉRÉST ÉRINTŐ (később).** Kérés: Feri 2026-10-31 16:57, feri_dontes 27 („mehet és érintésnapló minden vállalkozás minden üzletágára menjen, ne csak ide; ez része a mérés projektnek és a konverziós térképnek”, #167 6545740946). A Mosaic érintésnapló (#498, UJ-80) él: `docs/booking-engine/ERINTESNAPLO.md`.

## Elv (mindhárom helyen ugyanaz)
Egy látogató több érintését (hirdetési kattintás, organikus/direkt visszatérés) egy **véletlen, első feles azonosító** köti össze; a konverziónál az útvonal látszik, a havi riportban utolsó / első / segítő / lineáris kredit. Csak saját D1 / Store, **platformra nem küld**, élő konverziót nem hoz létre és nem cserél, a foglalási folyamatot nem változtatja. Csak kifejezett marketing-hozzájárulással; elutasításkor a süti törlődik. Vendégadat (név, e-mail, telefon) és egészségügyi adat soha nem kerül bele; a vid csak HMAC-hash-ként (`HMAC-SHA256(<projekt>_VID_KULCS, "vid|" + vid)`) tárolódik. Fail-closed kapcsoló + titok nélkül nincs süti, sor, tábla.

## Medical Piercing (`medicalpiercing/`, Pages `medicalpiercing`, D1 `mp-meres`)
- **Új, MP-saját modul** (az MP nem importál a `netlify/lib`-ből; a `netlify/lib/meres/erintesnaplo.js` tiszta függvényei portolva): `medicalpiercing/lib/meres/erintes.js` + `functions/api/mp-erintes.js` (süti `mp_vid`, 30 nap gördülő, HttpOnly/Secure/Lax) + riport `functions/api/mp-erintes-riport.js` (`x-egyeztetes-kulcs`, csak GET).
- **Táblák** (`CREATE IF NOT EXISTS`, csak kapcsolóval): `mp_erintes` (vid_hash, idő, platform, UTM, kampány/csoport/hirdetés, kattintás-típus + dedup-hash, landing útvonal query nélkül, 90 nap), `mp_vid_foglalas` (foglalási kulcs `placeId|employeeId|startUnix` → vid_hash, az első írás nyer), `mp_utvonal` (konverziónként az útvonal, vid nélkül).
- **Foglalás-páros a védett `lanc.js` módosítása nélkül:** a köszönőoldal külön, additív híváson át küldi a foglalási kulcsot (mint a Mosaic `meres_vid_erkezes`); a `lanc.js` / `lemondas.js` érintetlen.
- Kapcsoló: `MP_VID_BE="1"` + titok `MP_VID_KULCS` (Secret, Production, ≥ 16 karakter). Rollback: a sor törlése + deploy.
- Süti-tájékoztató: az `mp_vid` bejegyzés (a Mosaic szövegének mintájára; a szöveget Feri hagyja jóvá).

## Gyógytorna (`gyogytorna/`, Pages `gyogytorna`, D1 `mp-meres`, `gy_` előtag)
- Ugyanaz a modell, `gy_vid` süti, `gy_erintes` / `gy_vid_foglalas` / `gy_utvonal`, kapcsoló `GY_VID_BE`, titok `GY_VID_KULCS`.
- **Egészségügyi adat tilos** (`gyogytorna/CLAUDE.md`): a landing útvonalból **nem** tároljuk a nyers útvonalat (egy panaszt megnevező oldal egészségközeli); csak **zárt kategória** (pl. `fooldal`, `szolgaltatas`, `blog`, `foglalas`, `egyeb`) és a konverzió típusa (`allapotfelmeres` | `egyeb`, a meglévő Salonic 24666 + 416586 szabály szerint). A kattintás-azonosítónak csak a típusa és egy dedup-hash.
- A foglalás-páros a meglévő HMAC `tranzakcio_id`-n (nem visszafejthető) keresztül, a `gy-koszono` válasza mellett, a `gy-foglalas.js` változtatása nélkül (külön végpont).

## A76 (`a76.hu`, WordPress + web-GTM + Stape szerver; nincs Cloudflare Pages-függvény)
- **Új adatgyűjtés nem kell:** a szerver-GTM már írja a `a76_erintes` Store-kollekciót (tag 73, `client_id` + érintés-típus + oldal, `lpc7-v1` szabály) és az `a76_foglalas_forras` kollekciót (`client_id`, `consent_state`, `a76_src`, `a76_lpc`). A párosítás `client_id` alapján.
- **Csak riport-oldal:** `tools/a76-erintes-riport.mjs` (a meglévő `tools/a76-stape-store-szamlalo.mjs` Store-olvasójára építve, GitHub Actions munkafolyamat): havi útvonal-/kredit-összesítés, csak darabszámok; nincs süti-, GTM- vagy Stape-változtatás.

## Közös riport és a konverziós térkép
- Mindhárom projekt riport-végpontja azonos alakú JSON-t ad (üzletág × konverzió-típus × utolsó/első/segítő/lineáris, top 20 útvonal, csak darabszám). A mérési oldal ezt veszi be a konverziós térképbe és a dashboardba (új sor: „Érintésnapló – <vállalkozás>”).

## Sorrend és kapuk
1. **MP** (legnagyobb hirdetési forgalom, nincs egészségügyi adat-probléma) → PR + teszt + független review → merge → kapcsoló BE (titok előbb).
2. **GYT** (a kategorizálási szabály jóváhagyása után).
3. **A76** riport-eszköz (nincs éles hatás).
Mindegyik lépés: draft PR + SHA a #167-ben, független review PASS az exact SHA-ra, védett hash-ek (`lanc.js`, `elosztas.js` stb.) változatlanok vagy dokumentáltak, rollback-terv, vendégadat sehova.

## Nyitott döntések (07-WEBOLDAL → 01-MERES / Feri)
1. GYT landing: elfogadható-e a **zárt kategória** a nyers útvonal helyett? (javaslat: igen)
2. A süti-tájékoztató MP / GYT szövege (Feri jóváhagyása).
3. D1-sémabővítés (`mp_erintes`, `gy_erintes`, …) külön DECISION-nel (a „D1-sémabővítés” a 2026-10-14-i felhatalmazásban DECISION-hoz kötött).
