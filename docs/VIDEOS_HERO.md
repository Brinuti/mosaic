# Közös videós hero (főoldal, Head Spa akció oldal, páros Head Spa)

**2026-10-09, a tulajdonos kérésére** a három oldal hero-ja egyetlen közös elemből áll; a mintája a `/head-spa-kedvezmeny` hero (a tulajdonos kedvence):

- **Asztalon** a videó a hero **teljes háttere**, balról sötétzöld átmosással (a szöveg alatt tiszta sötétzöld).
- **Telefonon** felül a videó (284 px; 2026-10-09: összébb húzva – sortávolság, térközök –, hogy kis telefonon (360×640) mindkét hero-gomb látsszon), ami sötétzöldbe (`#10221f`) olvadva átmegy a szövegbe; a három jelvény egy sorban (ikon felül, rövid felirat alatta), a Google-sor egy sorban.
- **Play gomb** (asztalon 62 px, telefonon 52 px): **NAGY ablakban** (felugró `<dialog>`, vezérlőkkel, Esc / X / háttérkattintás zár) nyitja a **hangos** videót.
- **Csökkentett mozgás** (`prefers-reduced-motion`) vagy **adattakarékos / lassú kapcsolat** (saveData, 2g / 3g): egyetlen háttér-klip sem töltődik be, csak a nyitókép látszik (a play gomb ilyenkor is működik).

## Fájlok (egy helyen az igazság)

| Fájl | Szerepe |
|---|---|
| `assets/css/video-hero.css` | a hero **minden** szabálya (`.vh-*` osztályok: hero, háttér, jelvények, ár, gombok, Google-sor, play gomb, felugró ablak); az oldalak saját CSS-ébe hero-szabály **nem** kerül |
| `assets/js/video-hero.js` | a háttér-klipek lusta indulása (`video[data-klip]`: csak a képernyőn lévők játszanak), a hero-klip beúszása, a play gomb + nagy ablak (`[data-nagyvideo]`), a csökkentett mozgás / lassú kapcsolat kezelése |

A build (`tools/netlify-build.mjs`) minden `assets/css/*.css` / `assets/js/*.js` hivatkozásra automatikusan `?v=<hash>` jelet tesz – a két új fájl is megkapja, külön teendő nincs. A „ritkítás” (`tools/css-ritkitas.mjs`) csak a Wixes oldalak beágyazott CSS-ét ritkítja; a `vh-*` osztályok a HTML-ben / a `video-hero.js`-ben szerepelnek (az ablak osztályai a JS-ben), így semmi nem esik ki.

## Használat (új oldalon)

```html
<link rel="stylesheet" href="/assets/css/video-hero.css">
…
<section class="vh-hero" id="hero" aria-labelledby="hero-cim">          <!-- + vh-eltolt: kis felbontású / szűk képarányú forráshoz (lásd lent) -->
  <img class="vh-hatter" src="<nyitókép>" alt="" width=".." height=".." fetchpriority="high">
  <video class="vh-video" data-klip="<hang nélküli klip>.mp4" muted loop playsinline preload="none" aria-hidden="true" tabindex="-1"></video>
  <div class="vh-tart">
    <div class="vh-szoveg">
      <h1 id="hero-cim">…</h1>
      <p class="vh-al">…</p>  <p class="vh-ar"><b>26 900 Ft</b> <s>32 900 Ft</s></p>  <p class="vh-akcio"><b>…</b></p>
      <ul class="vh-jelvenyek">…<li><span class="vh-ikon"><svg/></span><span>50+30 perc</span></li>…</ul>
      <div class="vh-cta"><a class="vh-gomb vh-gomb-arany vh-gomb-nagy">…</a> <a class="vh-gomb vh-gomb-vonal vh-gomb-nagy">…</a></div>
      <a class="vh-google">…</a>  <p class="vh-hely">…</p>
    </div>
    <button type="button" class="vh-lejatszas" data-nagyvideo="<hangos>.mp4" data-cim="…" data-cta="hero-video">
      <span class="vh-play"><svg/></span><span class="vh-lejatszas-szoveg"><b>Nézd meg …</b><small>(0:38)</small></span>
    </button>
  </div>
</section>
…
<script src="/assets/js/video-hero.js" defer></script>
```

- **Árváltozatok:** `.vh-ar` nagy ár (42 px / telefonon 32 px); `.vh-ar.vh-ar-kicsi` kisebb (28 / 24 px; főoldal, páros).
- **`.vh-eltolt`** (csak ≥ 1181 px-en hat): a kép a hero jobb ~72%-án van, a bal széle puhán sötétzöldbe olvad. Kis felbontású vagy szűk képarányú forrásnál (a főoldal 720×720-as klipje, a páros 720×540-es klipje) így kevésbé van felnagyítva, és a szereplők arca nem a szöveg alatt van.
- **Fókuszpont:** `--vh-poz` (asztal) / `--vh-poz-mobil` a `.vh-hero`-n, oldalanként felülírható (főoldal: a ráégetett „Úristen” felirat kimarad a kivágásból).
- **Mérés:** a `video-hero.js` nem ismer oldalspecifikus eseményt: a nagy ablak nyitásakor a `document`-en `vh:video` eseményt küld (`detail: { video, cim }`), az oldal saját JS-e küldi a dataLayer-eseményt (`egyeni_landing_video`, `fooldal_video`, `paros_landing_video`). A gombok `data-cta`-ja a megszokott módon mér.
- A `[data-nagyvideo]` bármelyik gombon használható (az akció oldal vendégvideói is így nyílnak). A `[data-video]` marad a főoldal / páros oldal kártya-lejátszóié (keskeny felugró, `fooldal.js` / `headspa-oldal.js`), ezekhez a közös JS nem nyúl.

## Tesztek

`node --test tools/egyeni-teszt/egyeni.test.mjs tools/fooldal-teszt/fooldal.test.mjs tools/ujrastilus-teszt/paros-regi.test.mjs` – mindhárom oldal tesztjében szerepel a közös hero ellenőrzése (háttér / felül a videó, ár, play gomb mérete, jelvények egy sorban, nagy ablak, csökkentett mozgás). A Playwright-Chromium nem tud H.264-et lejátszani, ezért a klip tényleges lejátszása (`.lejatszik` osztály) csak valódi Chrome-ban ellenőrizhető; a tesztek ilyenkor a klip betöltését (`src`) nézik.

## Telefon: az ár és az akció egy sorban (2026-10-09)

Az ár-sor (`p.vh-ar`: régi ár + új ár) és az akciós sor (`p.vh-akcio`) egy `div.vh-arsor` burkolóban van (főoldal, páros, kedvezmény oldal). Asztalon a két bekezdés alatta-fölötte áll, telefonon **egy sorban**: a burkoló `container-type: inline-size`, a betűméret `min(15px, 100cqw / var(--r))` (az `--r` a sor szövegének szélessége betűméretben, oldalanként mérve + ~4% ráhagyás; az ár 1,55×, a régi ár / akció 1×), így 320–430 px között is elfér és nem lóg ki (`tools/hero-teszt/hero-sorok.test.mjs`). Új szöveg esetén az `--r` újramérendő. A főoldal H1 alcíme („50 perc kezelés + 30 perc hajszárítás”) ugyanígy egy sorban marad telefonon (`--h1-al-arany`, `fooldal.css`).
