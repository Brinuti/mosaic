# Head Spa oldalak – új szerkezet (2026-10-07)

A régi, Wixes kinézetű Head Spa oldalak a lézeres / sminktetováló / oxigénterápia landingek szerkezetében, betűivel és színeivel (Playfair Display + Jost, arany gombok,
krém háttér, sötétzöld, fehér kártyák, rombusz-elválasztó). **A tartalom (szövegek, árak, képek, videók, linkek) szó szerint a régiből van** – a régi oldal minden sora
megvan az újban (a kinyert tartalom és az új oldal összevetése: 0 hiányzó mondat; az egyetlen eltérés a videók hosszának írása: `00:36` helyett `0:36`, a gombfeliratok kisbetűssé tétele és a
lásd alább felsorolt szándékos eltérések).

**Cím:** a szabály szerint (meglévő linket csak kifejezett kérésre cserélünk) az új oldalak ideiglenesen **`-uj` címen** élnek, `noindex, nofollow`, saját canonical-lal, sehonnan nincs rájuk link, nincsenek a sitemapben.
A régi oldalak a `klon/` mappában változatlanul megvannak és élesek.

| Új (ideiglenes) cím | Forrás | Régi (éles) oldal |
|---|---|---|
| `/headspa-budapest-uj` | `foglalas/headspa-budapest-uj.html` | `/headspa-budapest` (a hosszú cikk) |
| `/headspa-arak-budapest-uj` | `foglalas/headspa-arak-budapest-uj.html` | `/headspa-arak-budapest` |
| `/head-spa-kedvezmeny-uj` | `foglalas/head-spa-kedvezmeny-uj.html` | `/head-spa-kedvezmeny` (a régi `noindex` volt: ez is az marad) |
| `/headspa-termekek-oxygeni-uj` | `foglalas/headspa-termekek-oxygeni-uj.html` | `/headspa-termekek-oxygeni` |
| `/head-spa-velemenyek-uj` | `foglalas/head-spa-velemenyek-uj.html` | `/head-spa-velemenyek` |

Közös fájlok: `assets/css/headspa-oldal.css` (a komponensek), `assets/js/headspa-oldal.js` (videó-lejátszó, képsorozat, Trustindex / térkép, mobil sticky CTA),
`tools/headspa-teszt/` (tesztek + könnyű szerver). A fejlécet / láblécet a build szúrja be (`<!--mh-fejlec-->`, `<!--mh-lablec-->`), a foglalás-gombok `/foglalo-motor?business=headspa`
linkek: a launcher a helyben nyíló foglalóban (rétegben) nyitja őket, mint az összes többi oldalon.

## Komponensek (`headspa-oldal.css`)
- `.akcio-sav`, `.hero` / `.oldal-fej`, `.szekcio` (`.feher`, `.zsalya`, `.bezs`), `.szekcio-fej` (+ `.rombusz`), `.fel-racs` (szöveg + kép), `.cikk` (hosszú, olvasható szöveg; a kulcsszavak halvány arany kiemeléssel).
- `.kep-fig` (kép + felirat), `.pont-szam` (a „Mitől más” 5 pontja), `.cimke-sor`, `.pipak` (a régi ✔ emojik helyett), `.csomag-racs` / `.csomag` (a 4 Head Spa csomag), `.ar-racs`, `.hatas-racs`, `.hu-racs`, `.level`, `.sajto-racs`.
- `.video-racs` / `.video-kartya` + a `[data-video]` gombok: a videó a saját tárhelyről (`assets/video/c2eb0f_<azonosító>.mp4`) **csak kattintásra** töltődik, felugró `<dialog>` lejátszóban (Esc / háttér / × zár).
- `.korhinta` (gördíthető képsor, előző / következő gomb), `.helyszin` + `.terkep` (a Google-térkép csak a „funkcionális” sütik elfogadása után / gombra), `.ti-doboz` (Trustindex, ugyanaz az embed, mint a lézeres oldalon), `.sticky-cta` (mobilon, a hero után).

## Szándékos eltérések a régi oldaltól
- **Akciósáv** (a fejléc `#comp-mpv0ganp` eleme, a Wix rózsaszín csíkja): a MOSAIC színvilágában (halvány arany háttér, sötétzöld felirat) látszik, ugyanazzal a szöveggel és linkkel. A stílus a közös `assets/css/fejlec-lablec.css`-ben van, ezért **minden oldalon egységes**, ahol a sáv látszik (a többi, még Wixes Head Spa jellegű oldalon is); a lézeres / oxigén / sminktetováló / ajándékkártya landingeken a saját CSS rejti, ott nem látszik. (A korábbi, külön `.akcio-sav` csík megszűnt.)
- **Az árlista (csomagok) képes** (2026-10-07, a tulajdonos kérése): mind a 4 csomag tetején egy kép (4 Kezes: `assets/img/ajandek/negy-kezes.jpg`, Relax: `kezeles-egyeni.jpg`, Hair: hajkamerás fejbőrvizsgálat, Páros: két vendég egymás mellett) – az árak és a kedvezmény oldalon is.
- **A vendégértékelések (Trustindex) mindig azonnal megjelennek**, süti-hozzájárulás és gomb nélkül – a Head Spa oldalakon és minden más oldalon is (lézeres, oxigén, ajándékkártya oldalak, a Wixes oldalak beágyazásai). A Google térkép továbbra is csak hozzájárulás után (vagy gombra) töltődik. Jogi döntés a tulajdonosé: a Trustindex így a hozzájárulás előtt is kap kérést, a süti-tájékoztató „funkcionális” besorolása ezzel nem egyezik, érdemes frissíteni.
- A vélemények oldalról a négy cikk alatti nagy, gyertyás kép (`DSC05687.jpg`) kikerült.
- A régi `✔️` emojik és a mutató emojik (👇 💓 🌿 👆) elmaradtak (ikon-lista, illetve nincs rájuk szükség); a hangulatjelek (🙂 :)) maradtak.
- Egyetlen H1 oldalanként (a régi oldalakon több volt, az árak oldalon a H1 „SZÉP Kártyát is elfogadunk” volt): az árak oldalon „Head Spa Csomagok és Árak” a H1; a kedvezmény oldalon az „AZ AKCIÓ RÉSZLETEI” H2.
- A vélemények oldal egyik címéből hiányzott az első betű („lyen lesz a hajad…”): javítva („Milyen lesz a hajad a kezelés után?”); a „Kinek ajánlott” idézetnek nem volt záró idézőjele: pótolva.
- Gombfeliratok kisbetűsek (`IDŐPONTFOGLALÁS` → „Időpontfoglalás”, `FOGLALOK!` → „Foglalok!”, `BŐVEBBEN >>` → „Bővebben”).
- A „4 Kezes” csomag („Csak ajándékkártya készült”) „Foglalok!” gombja a régi oldal szerint a foglalóra mutat – ezt változatlanul hagytam.
- A Trustindex a vélemények oldalon a többi oldallal azonos 3 kártyás csúszka (a régi oldalon egyetlen lebegő kártya volt). Hozzájárulás előtt gombos helykitöltő áll.
- A hosszú cikkhez új „Itt találsz meg minket” szekció (cím, elérhetőség, nyitvatartás, térkép) készült az árak oldal azonos blokkjából; a cikk végén a kapcsolódó szöveg és gombok változatlanok.
- A cikk videóinak keresőmotoros leírása (JSON-LD `VideoObject`) mind a 15 videóra a saját tárhelyes fájlokra mutat (a régi oldal 8 videója Wix-CDN-es, lejáró hivatkozásokkal szerepelt).

## Csere az eredeti címre (csak kifejezett kérésre)
Mint a lézeres / oxigén oldalnál (`docs/LEZERES_LANDING.md`, `OXIGEN-LANDING.md`):
1. `git mv foglalas/<név>-uj.html foglalas/<név>.html` (a `foglalas/*.html` felülírja a `klon/<név>.html` fájlt); a `canonical` és `og:url` az eredeti címre; a `noindex, nofollow` kivétele (**a `head-spa-kedvezmeny` oldalon marad `noindex`**, mint a régin).
2. A régi Wixes változat rejtett címre: `klon/<név>.html` + `klon/m/<név>.html` → `<név>-regi.html` (noindex, saját canonical, mint `klon/lezeres-szortelenites-budapest-regi.html`); az `-uj` cím 301-gyel az eredetire (`netlify/lib/utvonal.js`, `ATIRANYITASOK`).
3. `tools/lcp-elofeltoltes.json`: az öt oldal régi LCP-sorainak (mobil + asztali) kivétele.
4. A `<!--mh-menu-aktiv:…-->` jelölők már az eredeti utakat nevezik meg; a mérés (suti.js pixel-lista) útvonal-alapú, az eredeti címen változatlanul működik.
5. A teszt (`tools/headspa-teszt/headspa.test.mjs`) a `-uj` címekre épül: csere után a `nyit()` és az elvárt `canonical` / `robots` igazítandó.

## Tesztek
`node --test tools/headspa-teszt/headspa.test.mjs` (47 teszt, nincs `dist/`, nincs külső hálózat): cím / H1 / egy H1; noindex + canonical; a régi tartalom kulcsmondatai és árai; foglalás-linkek a foglalóra, belső linkek létező oldalakra;
a vélemények mindig azonnal megjelennek, a térkép hozzájárulás előtt nem; a csomagok képei; nincs vízszintes görgetés telefonon / tableten / asztalon; videó-lejátszó; képsor; sticky CTA; a 4 csomag ára.
