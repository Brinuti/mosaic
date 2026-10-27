# 2026-10-27 – UJ-67/69/71/73 kódos élő TikTok-esemény (DRAFT, alapból KI)

MÉRÉST ÉRINTŐ. Részletek: [docs/booking-engine/TIKTOK_ELO.md](../docs/booking-engine/TIKTOK_ELO.md).

* Új: `netlify/lib/meres/tiktok-elo.js`, `tools/test-tiktok-elo.mjs` (13 teszt), doc.
* Módosítva (nem védett): `netlify/lib/meres/forras-lpt.js` (additív `tiktok_elo` a köszönőoldali válaszban), `foglalas-esemeny.js`, `salonic-direct.js`, `ajandek-esemeny.js` (az `elosztas()` után `tiktokEloKuld`, egy közös élő-állapot lekérés), `assets/js/attribucio.js` (ttq.track a válasz jelzésére), `wrangler.toml` (csak megjegyzés).
* Védett fájlok (platformok / elosztas / meta-bongeszo-kulcs / esemeny-modell / qa-nap / vegpontok): érintetlenek (blob-hash lent a PR-ben).
* Tesztek: test-tiktok-elo 13/13, test-meres 51/51, test-salonic-direct 75/75, test-lpt-forras 58/58, test-qa-nap 45/45, test-foglalas-kulcs 46/46, test-jelleg-oldal 35/35.
* Nincs vendégadat; token és user-adat a naplóban nincs.
