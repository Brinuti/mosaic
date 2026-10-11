# Gyógytornászom.hu – SEO és gyorsítás: végleges állapot

Állapot: 2026-10-11. Forrás: a „Technikai SEO Audit" (2026. 05. 03., gyogytornaszom.hu-site-audit-3.docx) minden pontja + az azóta elvégzett gyorsítási munka. Az élő oldalon ellenőrizve. Jelölések: ✅ kész · 🟡 részben · ⛔ nincs kész · 🚫 szándékosan nem csináljuk.

## 1. Összefoglaló

- **Kész:** 19 audit-pont (Cloudflare, LCP-kép, menü-nevek, URL-struktúra, metaadat, E-E-A-T, kereső, témánként 1 cikk a Panaszok oldalon, 301-ek, stb.).
- **Nincs kész (nagy tartalmi munka vagy Feri döntése kell):** az isiász-kannibalizáció (4 versengő oldal), új információs cikkek (pl. /isiasz/), cikkek rövidítése és kiemelés-csökkentés, URL-ek rövidítése, valódi fotók az AI-képek helyett, a 11–20. pozíciós kulcsszavak optimalizálása.
- **Gyorsítás:** laborban mobil 99, asztali 100 pont. A valódi látogatók (CrUX) 28 napos adata még „Sikertelen" (LCP mobil 2,9 mp, asztali 2,5 mp; INP és CLS jó), mert a javítások csak ma kerültek be; az átfordulás várhatóan 2–4 hét.

## 2. Az eredeti audit pontjai – mi készült el, hogyan, és mi nincs kész

### 2.1 Weblap sebesség, szerver

| Audit-pont | Állapot | Hogyan / miért nem |
|---|---|---|
| Mobil teljesítmény 52 → 80+ | ✅ | Labor: mobil 99, asztali 100 (PageSpeed, 2026-10-11). Lásd a 3. fejezetet. |
| TTFB 1100 ms → 800 alá | 🟡 | Cloudflare-tárolt oldal TTFB ~0,07 s, tárolatlan (szerver) ~0,3–0,6 s + távolság. A valódi látogatóknál a 28 napos átlag még magas (1,0–1,3 s). Intézkedések a 3. fejezetben. |
| Prémium DNS / Cloudflare + Brotli | ✅ | Az oldal a Cloudflare mögött van (proxy), Brotli és HTTP/3 be van kapcsolva. |
| LCP-kép betöltése minél hamarabb (preload, fetchpriority) | ✅ | A főoldali kép `<link rel=preload fetchpriority=high>`-gyel töltődik, WebP változatban (lásd 3. fejezet). |
| `decoding="async"` az LCP-képről | ✅ | Snippet „gyt-lcp-decoding": az LCP-kép nem kap `decoding` attribútumot. |
| Fade-in effekt eltávolítása | ✅ | Oldalbetöltési fade-in nincs; csak a menü almenüinek 0,3 mp-es áttűnése van, az nem számít. |

### 2.2 Kategóriák, menü, URL-ek

| Audit-pont | Állapot | Hogyan / miért nem |
|---|---|---|
| „Rendelők" menü → /rendelo/ | ✅ | A menüpont a /rendelo/ címre mutat. |
| /elerhetosegeink/ ne legyen külön tartalom | ✅ | Redirection-bővítmény: 301 /elerhetosegeink/ → /rendelo/ (szabály #107). A „Kapcsolat" menüpont marad (Feri döntése: nincs SEO-jelentősége). |
| „Panaszkereső" → „Panaszok" menünév | ✅ | A menüpont „Panaszok"; az emojit levettem. |
| „Gyógytornászkereső" → „Szakemberek" menünév | ✅ | A menüpont „Szakemberek"; az emojit levettem. (Az oldalcím: „Gyógytornászkereső: válassza ki, hol fáj".) |
| Profil-URL: /gyogytornaszok/dorina/ (nem /gyogytornasz/dorina/) | ✅ | Snippet „gyt-profil-url": az új URL él, a régi 301-gyel átirányít (/gyogytornasz/ → /gyogytornaszok/). |
| /gyogytornasz-allas-budapest/ link a láblécből | 🟡 | A főoldalon nem találtam rá linket; nem néztem végig minden oldalt. |
| A Panaszok-oldal almenüi (kb. 25–32 pont) | 🚫 | Feri döntése: marad. Tömörítve (13 px, 18 px sorköz, 2 oszlop), így elfér a képernyőn. |
| Panaszok gyűjtőoldal: témánként csak 1 cikk | ✅ | Search Console 90 napos kattintás alapján témánként a legjobban teljesítő cikk maradt; 60 kártyát elrejtettem a 239-ből (a cikkek megmaradnak, elérhetők). Snippet „gyt-panaszok-gyujtooldal"; visszaállítás: snippet kikapcsolása. |
| Panaszok gyűjtőoldal célzása (mozgásszervi betegségek, tünetkereső…) | ⛔ | A cím/leírás szövegének átírása tartalmi döntés (Feri jóváhagyása kell). |
| /rendelo/ indexelése | 🟡 | A /rendelo/ oldal elérhető és a menüből linkelt; az indexelés állapotát (Search Console) nem ellenőriztem. |

### 2.3 Kulcsszavak és tartalom

| Audit-pont | Állapot | Hogyan / miért nem |
|---|---|---|
| Kannibalizáció: isiász – 4 versengő URL egyre átirányítva | ⛔ | Mind a 4 él (/isiasz-gyogytorna/, /lumbago-ischiasszal…/, /isiasz-gyogytorna-megelozesre-kezelesre/, /isiasz-ezt-tanacsolja…/). Döntés kell, melyik marad; a 301-ek előtt forgalmat és belső linkeket kell nézni. |
| Új, ár nélküli információs cikk (pl. /isiasz/) | ⛔ | Ma a /isiasz/ 301-gyel a hirdetős oldalra visz (az audit szerint fordítva kellene). Új, 1500–2000 szavas cikk kell, a szöveget Feri hagyja jóvá. |
| Az információs oldalakról az árak/kereskedelmi szövegek kivétele | ⛔ | Az isiász-landing 7595 szó, a derékfájás-cikk 13 226 szó, sok ár és CTA. Szövegjóváhagyás kell. A hirdetős oldal marad. |
| Rövid URL-ek (pl. /isiasz/) | 🚫/⛔ | A meglévő cikkek URL-jének átnevezése 301-ekkel nagy forgalomkockázat; csak új cikkeknél alkalmazzuk. |
| Latin nevek (nervus ischiadicus stb.) | ✅ | Az isiász- és derékfájás-cikkekben szerepelnek. |
| E-E-A-T: szerző/lektor doboz, schema | ✅ | Snippet „gyt-szakmai-lektor": minden cikk végén szakmai lektor-doboz, a Yoast schemába is bekerül (Person, Article). |
| 11–20. pozíciós kulcsszavak optimalizálása (Drive-lista) | ⛔ | Nagy, cikkenkénti tartalmi munka; nem kezdtük el. |
| Hiányzó szavak a csípőfájdalom-cikkben (Word2vec-lista) | ⛔ | Szövegírás; nem kezdtük el. |
| „… angolul" típusú keresések | ⛔ | Nem kezdtük el (az angol oldal CSS-e megvan, tartalmilag nincs kidolgozva). |

### 2.4 UX, formázás, képek

| Audit-pont | Állapot | Hogyan / miért nem |
|---|---|---|
| Címek (h1/h2) rövidítése, kevesebb kereskedelmi szöveg | ⛔ | Az isiász-oldal h1-e hosszú, a title kereskedelmi („…Garanciával! ✅"). Szövegjóváhagyás kell. |
| `<strong>` túlhasználata | ⛔ | Az isiász-oldalon kb. 240, a derékfájás-cikkben kb. 400 kiemelés. Csökkenthető, de cikkenként át kell nézni. |
| Oldalon belüli kereső | ✅ | Két helyen: a főmenüben (a Blog után, mobilon a menü tetején) és a Panaszok oldal tetején; azonnal szűr. A menükereső az összes cikkben és oldalon keres (kb. 358 db; cím + URL-szöveg alapján, ékezet nélkül is), szinonimákat is ért (isiász ↔ ülőideg ↔ ischias), találat-sorrend: címben elöl találat > címben > URL-ben. A Panaszok oldal keresője csak az ott látható (témánként 1) kártyákat szűri. |
| Valódi fotók az AI-képek helyett | 🚫 | Feri döntése: túl nagy munka, a jelentősége kérdéses. |

### 2.5 Metaadatok

| Audit-pont | Állapot | Hogyan / miért nem |
|---|---|---|
| Főoldal title (≤ 60 karakter) | ✅ | „Gyógytorna Budapest \| Batthyány, Nyugati tér, Oktogon" (54 karakter). |
| Főoldal meta description (≤ 150 karakter) | ✅ | „Mozgásszervi fájdalom? 30 tapasztalt gyógytornász segít isiász, derékfájás, gerincsérv, lumbágó esetén. Részletes állapotfelmérés garanciával." (142 karakter) |
| Panasz-oldalak title/description (isiász stb.) | ⛔ | Az isiász-oldal title-je kereskedelmi; az átírás az információs cikk elkészítésével együtt érdemes. |

## 3. Gyorsítás (új, az auditon felül)

### 3.1 Mit csináltunk és hogyan

| Intézkedés | Hogyan |
|---|---|
| Hero kép (az LCP-elem) 60%-kal kisebb | Snippet „gyt-hero-webp": WebP változatok (480/768/1000 px: 22/40/67 KB, a JPG 42/105/150 KB volt); a preload és az `<img>` srcset/sizes cserélve. Telefonon a 768 px-es változat töltődik (~40 KB a 105 KB helyett). |
| Tárolt HTML a hirdetési kattintásoknak is | Cloudflare Transform Rule: a hirdetési követő paraméterek (gclid, fbclid, utm_*, ttclid, msclkid …) a gyorsítótár-kulcsból levágva; a böngészőben az URL változatlan, a mérés nem sérül. Mért TTFB: 0,88 s → 0,06–0,09 s. |
| HTML gyorsítótár a Cloudflare-ben | Cache Rule: anonim látogatóknak, edge TTL 12 óra (4 órától emelve), a bejelentkezett/admin forgalom kizárva. |
| Tiered Cache | Be: ritkábban fordul a kérés a szerverhez. |
| Statikus fájlok böngésző-gyorsítótára | Cloudflare Browser Cache TTL 4 óra → 1 év (csak kép/CSS/JS/betűtípus; a HTML nem érintett). |
| Early Hints | Be. |
| Szerveroldali oldal-gyorsítótár | W3 Total Cache (Disk Enhanced). Automatikus ürítés: snippet „gyt-cache-auto-urites" (snippet-, menü-, blokk-, Customizer-változáskor). |
| Harmadik fél szkriptek késleltetése | Snippet „gyt-teljesitmeny" (GTM/Trustindex késleltetés). |
| LCP-kép `decoding` | Snippet „gyt-lcp-decoding". |
| Saját valódi-látogatós mérés (RUM) | Snippet „gyt-rum": névtelenül méri az LCP/FCP/TTFB/CLS/INP-t, a legnagyobb elemet és az eszköz-típust; összesítő: /wp-json/gyt/v1/rum-summary (csak admin). |

### 3.2 Mértékek

| Mutató | Mobil | Asztali |
|---|---|---|
| Labor teljesítmény (Lighthouse) | 99 | 100 |
| Valódi látogatók (CrUX, 28 nap) – LCP | 2,9 mp (határ 2,5) | 2,5 mp (határ 2,5) |
| INP / CLS | jó | jó |
| TTFB (CrUX) | 1,3 mp | 1,0 mp |

### 3.3 Ami nincs kész a gyorsításban és miért

| Pont | Állapot | Miért |
|---|---|---|
| Valódi látogatók „Sikertelen" jelzése | ⛔ | A CrUX 28 napos gördülő átlag, naponta frissül. A javítások 2026-10-11-én kerültek be; az átfordulás 2–4 hét. Ha 2 hét múlva az LCP még 2,7 mp fölött van, további lépések kellenek. |
| 283 KB beágyazott CSS (Autoptimize) szétszedése kritikus/nem kritikus részre | ⛔ | Az Autoptimize kritikus-CSS szolgáltatása fizetős; kézi megoldás nagy kockázatú (az oldal kinézete eltörhet). |
| „Nem használt CSS, 39 KiB" (`.wp-block-button`) | 🚫 | Az oldalon használt gombok CSS-éhez tartozik; nem érdemes kiszedni. |
| YouTube-indexkép (72 KiB, maxresdefault) | 🚫 | A hajtás alatt van és lusta betöltésű; az LCP-t nem érinti. |
| Origin (szerver) válaszideje | 🟡 | ~0,3–0,6 s tárolt oldalnál; a tárhely-csere (ha lesz) javítana. |

## 4. Üzemeltetési szabályok (Feri döntései)

1. Minden változtatás kész állapot után azonnal élesedik (nincs külön jóváhagyási kör).
2. Minden frissítés után a WordPress (W3TC) és a Cloudflare gyorsítótárat is üríteni kell; az ellenőrzést a tiszta URL-en (query nélkül) kell nézni. A WP-ürítés automatikus, a Cloudflare-ürítés kézi (cloudflare_mcp, purge_cache).
3. A menüt mindig képernyőképen, több szélességen (1192, 1341, 1536, 1920 px, mobilon) kell ellenőrizni.
4. A Salonic-időtartamokhoz nem nyúlunk.
5. A régi oldal témája és a `gyogytornasz-member-filter` bővítmény kódja nincs a repóban; ha a fejlesztő új oldalra visz át, külön ki kell menteni.

## 5. Javasolt következő lépések (prioritás szerint)

1. Isiász-kannibalizáció: a 3 gyengébb oldal 301-e a legjobbra + új ismertető cikk (Feri dönt a szövegről).
2. 11–20. pozíciós kulcsszavak: az első 10 cikk szövegbővítése.
3. Az információs cikkek rövidítése és a kiemelések (`<strong>`) csökkentése, cikkenként jóváhagyással.
4. 2 hét múlva: RUM-riport (valódi LCP/TTFB) és a PageSpeed „Valódi felhasználók" újraellenőrzése.
