# Régi (Wixes) oldalak újra stílusozása – a tartalom változtatása nélkül

**Szabály (a tulajdonos, 2026-10-07):** most csak azokat az oldalakat cseréljük le az eredeti címükön, ahol **a tartalomhoz nem nyúlunk**, csak a megjelenés (design) új.
A cél: ne maradjon az éles oldalon régi, Wixes kinézetű oldal. A tartalom (szövegek, árak, képek, videók, linkek, GYIK-válaszok) **szó szerint a régiből van** – nincs „javítás”, nincs új állítás.
Ha valami hibásnak tűnik a régi oldalon (elavult ár, ellentmondás, elírás), **hagyd úgy**, és írd a PR-leírás „Észrevételek” részébe; a tulajdonos dönt róla.

Minta (már kész, élő) oldalak: `foglalas/headspa-ferfiaknak.html` (+ `assets/css/headspa-ferfi.css`), `foglalas/headspa-arak-budapest.html`, `foglalas/head-spa-velemenyek.html`,
`foglalas/lezeres-szortelenites-budapest.html`. Szerkezet-leírás: `docs/HEADSPA_OLDALAK.md` (komponensek: `assets/css/headspa-oldal.css`, működés: `assets/js/headspa-oldal.js`).

## Menete oldalanként

1. **Kinyerés a régi oldalról (a csere ELŐTT, az éles címről):**
   `PLAYWRIGHT_UTVONAL=<playwright-core node_modules mappája> node tools/ujrastilus/folyam.mjs https://www.mosaicheadspa.hu/<név> <ki-mappa> <név>`
   → `<név>.json` (a teljes szöveg, képek, linkek, videók) és `<név>.folyam.txt` (a tartalom dokumentum-sorrendben, gazdag szöveggel: `<b>`, `<i>`, `<a href>`, `<br>`, y-pozícióval).
   A ki-mappa legyen a repón KÍVÜL (a session scratchpad-je). A régi oldal telefonos változata (`klon/m/<név>.html`) néha eltér az asztalitól: nézd meg a mobilt is (`folyam.mjs` mobil UA-val nem fut: a `klon/m/<név>.html` fájlt olvasd).
2. **Új oldal:** `foglalas/<név>.html` (a `foglalas/*.html` fájl a buildben felülírja a `klon/<név>.html` + `klon/m/<név>.html` fájlokat, tehát egy fájl szolgálja az asztalit és a mobilt is; reszponzív).
   - Fejléc / lábléc / aktív menüpont jelölők: `<!--mh-fejlec-->`, `<!--mh-menu-aktiv:/<név>-->`, `<!--mh-lablec-->` (a build tölti ki; a fejlécet NE szerkeszd, `assets/fejlec/*.html` és `tools/fejlec-menu.mjs` tilos).
   - Stílus: a meglévő komponensek (`assets/css/headspa-oldal.css`: `.hero`, `.szekcio` (`.feher`, `.zsalya`, `.bezs`), `.szekcio-fej` + `.rombusz`, `.fel-racs`, `.cikk`, `.kep-fig`, `.csomag-racs`, `.video-racs` + `[data-video]`, `.korhinta`, `.helyszin`, `.ti-doboz`, `.sticky-cta` …).
     Ha az oldalnak kell saját kiegészítő stílus, **új, önálló** `assets/css/<név>.css` fájlba (más oldal stílusát ne módosítsd). Betűk: Playfair Display (címek) + Jost (szöveg), saját tárhelyről (lásd a minta oldalak `<head>`-jét); arany gomb, sötétzöld, krém háttér, fehér kártyák.
   - Egyetlen `<h1>` oldalanként; minden képnek `alt`, `width`, `height`; a hero kép előtöltve (`fetchpriority="high"`), a többi `loading="lazy"`; telefonon nincs vízszintes görgetés (390 és 360 px).
   - Linkek, gombok: a régi oldal hivatkozásai változatlanul (a foglalás-gombok `/idpontfoglalas`, `/foglalo-motor?...`, `/headspa-ajandekkartya` stb. linkjeit másold szó szerint: a build a régi Salonic-linkeket a helyben nyíló foglalóra köti át).
   - Videók: a régi oldal videói a saját tárhelyről (`assets/video/...`), kattintásra a közös felugró lejátszóban (`[data-video]`, lásd a minta oldalakat); iframe-ek (térkép, Trustindex) a minták szerint.
   - Mérés: NE adj hozzá mérőkódot, `data-cta`-t, dataLayer-eseményt (a `suti.js` útvonal-alapú: az oldal neve ugyanaz marad, ezért ugyanúgy működik). A GTM éles verziójában (53) nincs a Wixes oldalak elemeire épülő trigger.
3. **Rejtett régi példány:** `node tools/ujrastilus/regi-peldany.mjs <név> --lcp-torol` → `klon/<név>-regi.html` + `klon/m/<név>-regi.html` (noindex, saját canonical); az eredeti `klon/<név>.html` marad (visszaállítás: a `foglalas/<név>.html` törlése).
   Az új oldal `canonical` + `og:url` az eredeti cím; indexelhető (nincs robots meta) – KIVÉVE ha a régi oldal `noindex` volt (akkor az új is marad `noindex, nofollow`).
4. **Ellenőrzés:** `PLAYWRIGHT_UTVONAL=... node tools/ujrastilus/ellenor.mjs <ki-mappa>/<név>.json <új-url>` (helyi: `tools/headspa-teszt/szerver.mjs` könnyű szerver, vagy a PR Cloudflare-előnézete) – a régi oldal minden sora, képe, linkje megvan-e; törött kép, 404, konzol-hiba, vízszintes görgetés, H1.
   Képernyőképek asztalon (1440) ÉS telefonon (390), a teljes oldalról, szakaszonként (a teljes oldal-kép túl nagy: darabold) – nézd meg őket! A kinézet legyen a minta oldalakéval azonos színvilágú, ne legyen „üres” vagy szétesett szakasz.
5. **Teszt:** `tools/ujrastilus-teszt/<név>.test.mjs` (a `tools/headspa-teszt/ferfi.test.mjs` mintájára, a könnyű szerverrel, dist nélkül): betöltés hibák nélkül, 1 H1, canonical / robots, a régi oldal kulcsmondatai (a tartalom-hűség), fejléc / lábléc, linkek, mobilon nincs vízszintes görgetés, a `-regi` fájlok (noindex, canonical). Futtatás: `node --test tools/ujrastilus-teszt/<név>.test.mjs` (fájlonként, egymás után, nem párhuzamosan).
6. **PR** a `main`-re: címe magyarul, ékezet nélkül; a leírás tartalmazza: mit cseréltél (címek), hogy a tartalom nem változott, a **„Mérést érint: nem”** sort, az **„Észrevételek”** listát (a régi oldal hibái / ellentmondásai, amiket NEM javítottál), a tesztek eredményét, és a végén: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Commit-üzenet: magyarul, ékezet nélkül, a végén `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
   A PR-előnézet (`https://claude-<ág-neve>.mosaic-d77.pages.dev/<név>`) ingyenes: ott is ellenőrizd (asztali + mobil, `ellenor.mjs` az előnézeti URL-lel). A mergelést a fő munkamenet végzi.

## Szabályok / csapdák

- Más oldalak, a közös fejléc / lábléc, `tools/netlify-build.mjs`, `tools/fejlec-menu.mjs`, `netlify/lib/utvonal.js`, a foglaló-motor, a `suti.js` **nem** a te feladatod – ne módosítsd őket (az `-uj` → eredeti átirányításhoz nincs szükség, mert itt nincs `-uj` cím).
- A `git config`-hoz nem nyúlsz (a közös `.git/config` korábban megsérült). Commit: `GIT_AUTHOR_NAME="Brinuti" GIT_AUTHOR_EMAIL="ferencistvandeak@gmail.com" GIT_COMMITTER_NAME="Brinuti" GIT_COMMITTER_EMAIL="ferencistvandeak@gmail.com" git commit ...` (környezeti változókkal).
- Az ágat az `origin/main`-ről nyisd; a munkamappát a worktree-izoláció adja (más session mappájához ne nyúlj).
- `heredoc` / `node -e` szkriptben a `\` és `$` elromlik: fájlba írj (Write eszköz), úgy futtasd.
- A Wix-oldalak képei `assets/img/c2eb0f_<azonosító>.jpg` stb. néven vannak a repóban (a `folyam.txt` kép-sorai ezeket adják); új képet ne tölts le, csak a meglévőket használd (kisebb mobil változat: `assets/img/m/` – a build a mobil oldalakon automatikusan átírja).
- `rm -rf` / `rm -f *` jellegű törlés tiltott a biztonsági ellenőrzésen: konkrét fájlokat töröld.
- Ha egy szakasz a régi oldalon csak a Wix rugalmas elrendezése miatt van (pl. üres térköz, dekoratív csík), nem kell megőrizni; a szöveg / kép / videó / link / gomb / GYIK viszont igen.
- A régi oldalon a „Foglalás”, „Ajándékkártya” gombok és az árak lehetnek elavultak (pl. régi 29.900 Ft vagy lejárt akció): hagyd, és jelezd az „Észrevételek” közt.
