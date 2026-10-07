# Head Spa oldalak – új szerkezet (2026-10-07, ÉLESBEN az eredeti címeken)

A korábbi, Wixes kinézetű Head Spa oldalak a lézeres / sminktetováló / oxigénterápia landingek szerkezetében, betűivel és színeivel (Playfair Display + Jost, arany gombok,
krém háttér, sötétzöld, fehér kártyák, rombusz-elválasztó). **A tartalom (szövegek, árak, képek, videók, linkek) szó szerint a régiből van** – a régi oldal minden sora
megvan az újban (a kinyert tartalom és az új oldal összevetése: 0 hiányzó mondat; az egyetlen eltérés a videók hosszának írása: `00:36` helyett `0:36`, a gombfeliratok kisbetűssé tétele és a
lásd alább felsorolt szándékos eltérések).

**Cím (2026-10-07 óta, a tulajdonos kifejezett kérésére: „mehet az élesítés”):** az új oldalak az **eredeti címeken élnek** (a `foglalas/*.html` felülírja a `klon/*.html` azonos nevű fájlját).
- A régi, Wixes változat **rejtett `-regi` címen** megmaradt (`klon/<név>-regi.html` + `klon/m/<név>-regi.html`; `noindex`, saját canonical, nincs rá link, nincs a sitemapben) – összehasonlításhoz és visszaállításhoz.
- Az ideiglenes `-uj` címek 301-gyel az eredeti címre irányítanak (`netlify/lib/utvonal.js`, `ATIRANYITASOK`).
- A `head-spa-kedvezmeny` oldal a régihez hasonlóan `noindex` maradt; a többi indexelhető.

| Cím | Forrás | Rejtett régi változat |
|---|---|---|
| `/headspa-budapest` (a hosszú cikk) | `foglalas/headspa-budapest.html` | `/headspa-budapest-regi` |
| `/headspa-arak-budapest` | `foglalas/headspa-arak-budapest.html` | `/headspa-arak-budapest-regi` |
| `/head-spa-kedvezmeny` | `foglalas/head-spa-kedvezmeny.html` | `/head-spa-kedvezmeny-regi` |
| `/headspa-termekek-oxygeni` | `foglalas/headspa-termekek-oxygeni.html` | `/headspa-termekek-oxygeni-regi` |
| `/head-spa-velemenyek` | `foglalas/head-spa-velemenyek.html` | `/head-spa-velemenyek-regi` |

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

## Az angol oldal (`/headspa-budapest-hungary-uj`, 2026-10-07, még nem éles)
A founder-hangú angol oldal ("I'm Ferenc István Deák, the founder…") ugyanebben a szerkezetben: `foglalas/headspa-budapest-hungary-uj.html` (`lang="en"`, `noindex, nofollow`, saját `-uj` canonical, nincs rá link, nincs a sitemapben;
a régi Wixes oldal az eredeti címen, a `klon/` mappában változatlanul él). Saját fájlok: `assets/css/headspa-en.css` (ár-sáv a hero-ban, „röviden” sáv, Google-értékelés kártya, kép-páros, EUR-sor) és `assets/js/headspa-en.js`
(a közös `headspa-oldal.js` magyar feliratait – videó-lejátszó, térkép – angolra cseréli); a közös fájlok változatlanok. A fejléc után a `<!--mh-nyelv:en-->` jelölő jelzi a közös fejlécnek az angol menüfeliratokat.
Adatfrissítések a régi angol oldalhoz képest: ár 29,900 HUF / 75 EUR → 26,900 HUF (≈ €67; 32,900 helyett, 20% októberi kedvezmény, visszavonásig), „4 Hands” 39,900 (49,900 helyett), páros 53,800 (65,900 helyett), minden kezelés 50+30 perc;
egyetlen 50 perces kezelés (a hajkamerás diagnosztika kérdés alapján, opcionális); Google 4,8 → 4.9/5, 1,262 vélemény (statikus jelvény, mert a Trustindex-widget magyar véleményeket mutat); telefon `+36 20 247 4444`; fodrász Betti (18 év) → Evelin (4 év, `/noi-hajfestes-budapest`);
ajándékkártya: a régi Salonic bankkártyás link és az utalás-gomb helyett `/headspa-ajandekkartya`. A régi „Egy MOSAIC Headspa szeánsz elemei” felirat, a magyar videócímek / alt szövegek angolra cserélve; a dekoratív recepciós fotó (magyar táblával) és a két nagy háttérkép kimaradt.
Élesítés (a tulajdonos kérésére): a fájl átnevezése `foglalas/headspa-budapest-hungary.html`-re, `noindex` ki, canonical / og:url az eredeti cím, `-uj` → 301 a `netlify/lib/utvonal.js`-ben; a régi Wixes változat rejtett `-regi` címen megtartható, ahogy a többi Head Spa oldalnál.
Teszt: `node --test tools/headspa-teszt/angol.test.mjs` (15 teszt).

## Visszaállítás a régi oldalra (ha kellene)
Oldalanként: a `foglalas/<név>.html` törlése (a `klon/<név>.html` változatlanul megvan, ezt szolgálja ki újra a build), a `tools/lcp-elofeltoltes.json` régi sorainak visszaírása (git előzmény), az `-uj` átirányítás kivétele a `netlify/lib/utvonal.js`-ből.
Az oldal mérése útvonal-alapú (`suti.js` pixel-lista), az eredeti címen változatlanul működik; a GTM-ben (mind a 71 trigger átnézve) nincs Wix-elemhez kötött kattintás-trigger az öt oldalon: a kattintás-triggerek csak a Salonic oldalain futnak, a többi köszönőoldal / dataLayer-esemény alapú.

## Tesztek
`node --test tools/headspa-teszt/headspa.test.mjs` (50 teszt, nincs `dist/`, nincs külső hálózat): cím / H1 / egy H1; noindex + canonical; a régi tartalom kulcsmondatai és árai; foglalás-linkek a foglalóra, belső linkek létező oldalakra;
a vélemények mindig azonnal megjelennek, a térkép hozzájárulás előtt nem; a csomagok képei; nincs vízszintes görgetés telefonon / tableten / asztalon; videó-lejátszó; képsor; sticky CTA; a 4 csomag ára.
