# A régi (Wixes) „Páros Head Spa” oldal újrastílusa (`/paros-headspa-budapest`)

Az oldal **tartalma szó szerint a régi (élő) oldalról** van, csak a megjelenés új. A régi oldal hibáit / ellentmondásait nem javítottuk (lásd a PR „Észrevételek” részét).
Az újratervezett `paros-headspa-budapest-uj` oldalhoz nem nyúltunk, az `-uj` címen változatlanul megvan.
**2026-10-09:** az éles oldal kézzel kiegészült az -uj oldal hero-videójával, a szabad időpontokkal és a „Kivel jönnél?” résszel (lásd `docs/PAROS_LANDING.md`): a generátor (`gen.mjs`) ezt nem tudja, az újrafuttatás felülírná – a fájlt kézzel szerkesszük.
**2026-10-09:** a hero a közös videós hero (`docs/VIDEOS_HERO.md`); kikerült a tulajdonosi történet, a fejbőr-blokk, az árlista és az alsó ajándékkártya-doboz; a GYIK kompakt (8 + „További kérdések”); az alsó sablonkép szalon-fotóra cserélve (`docs/PAROS_LANDING.md`). A teszt a kivett blokkok szövegeit / képeit kizárja a tartalom-hűségi ellenőrzésből.

- `gen.mjs`: a `forras/paros.folyam.txt` (a régi oldal kinyert tartalma, `tools/ujrastilus/folyam.mjs`) + a régi oldal HTML-je (`klon/paros-headspa-budapest.html`: a négy csomagkártya
  felsorolása, az árak) alapján építi a `foglalas/paros-headspa-budapest.html` fájlt (`node tools/paros-regi/gen.mjs`). Az újrafuttatás felülírja a kimenetet.
  A közös építőelemek a `tools/lezer-variansok/gen.mjs`-ből jönnek (hero, szalon-galéria, vélemények, GYIK, térkép), a régi oldal HTML-értelmezője a `tools/jogi-oldalak/gen.mjs`-ből.
- Szakaszok: hero, bemutatkozás, folyamat (diavetítés), fejbőr, 4 csomagkártya, OXYGENI, masszőrök, videók (15), szárítás, szalon (galéria), SZÉP-kártya, ajándékkártya, GYIK (18), helyszín.
- Képlisták: a két galéria a régi oldal élő változatának listája (`assets/js/galeriak.js`: `comp-m7pynjwm` = folyamat, 9 kép; `comp-m7pxb9bk` = szalon, 19 kép). A régi oldal statikus HTML-je ezeknek csak az elejét tartalmazza,
  a többit a `klon.js` tölti be – ezért a kinyerő is más képkészletet adhat oldalfrissítésenként.
- GYIK: a régi oldalon a két Common Ninja GYIK egy listában van (`assets/js/gyik.js`, `klon.js`), ugyanebben a sorrendben.
- Stílus: `assets/css/paros-regi.css` (a `headspa-oldal.css` és a `lezer-variansok.css` után töltődik).
- Rejtett régi példány: `/paros-headspa-budapest-regi` (noindex), `node tools/ujrastilus/regi-peldany.mjs paros-headspa-budapest --lcp-torol`. Visszaállás: a `foglalas/paros-headspa-budapest.html` törlése.
- Teszt: `node --test tools/ujrastilus-teszt/paros-regi.test.mjs` (betöltés, meta / canonical / robots, a régi oldal minden sora / képe / linkje, a régi HTML minden szövegcsomópontja, működés, telefon 390 / 360 px).
