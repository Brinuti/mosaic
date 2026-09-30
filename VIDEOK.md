# Videók a klónban – leltár és teendők

A Wix-oldalon háromféle videó van. A Wix a tartalmukat nem a HTML-ben küldi, hanem utólag,
JavaScripttel tölti be egy külön JSON-ból (oldal-adatok) – ezért voltak üresek a klón dobozai.

| fajta | hol | db | állapot |
|---|---|---|---|
| **magától induló videó** | nyitóoldal, `headspa-budapest-hungary` | 2 | ✅ asztalin magától indul; mobilon – mint az élő oldalon – poszter + lejátszás gomb |
| **kattintásra induló videó** (vendégvélemények, bemutatók) | 13 oldal, lásd lent | 51 doboz (+ a fenti 2 mobilon) | ✅ poszterkép + lejátszás gomb, kattintásra indul |
| **kezelés-galéria** (Wix Video lista) | `index`, `headspa-budapest`, `headspa-budapest-hungary`, `headspa-ferfiaknak`, `paros-headspa-budapest` | 8 videó | ⏳ a lejátszó kész, a 8 fájl hiányzik (Wix-export kell) |

## 1. Kattintásra induló videók

| oldal | dobozok |
|---|---|
| `index` | 10 kicsi (258×472) + 5 nagyobb (280×510); mobilon + a nyitóvideó |
| `head-spa-velemenyek` | 10 kicsi (258×472) + 5 nagyobb (280×510) |
| `headspa-ajandekkartya` | 1 négyzetes + 3 álló |
| `4-kezes-headspa-ajandekkartya` | 3 álló |
| `headspa-budapest-hungary` | 3 álló + 1 négyzetes; mobilon + a nyitóvideó |
| `headspa-budapest` | 1 álló + 1 négyzetes |
| `noi-fodraszat-budapest` | 2 |
| `balayage-haj-festes-budapest`, `noi-fodrasz-budapest-balayage-hajfestes`, `noi-hajfestes-budapest`, `lezeres-szortelenites-budapest`, `oxigenterapia-budapest`, `sminktetovalas-budapest` | 1-1 |

Asztali és mobil nézetben ugyanazok a dobozok vannak, mobilon is látható méretben (a Wix mobil
oldal-adataiban is szerepelnek, vezérlőkkel, kattintásra indulva). **Mind a 28 különböző videó és
mind a 30 poszterkép a repóban van** (`assets/video/`, `assets/img/<id>f00N.jpg`), a legnagyobb
videó 70 MB (a GitHub-korlát fájlonként 100 MB).

### Hogyan készült

```bash
node tools/wix-oldaladatok.mjs   # oldal-adatok -> tools/wix-oldaladatok.json
node tools/videok-letoltese.mjs  # a hiányzó videók és poszterek letöltése
```

1. A `tools/wix-oldaladatok.mjs` minden lementett oldalból kiolvassa az oldal-adatok címét
   (`siteassets.parastorage.com`), letölti mobil és asztali nézetben (nyersen: `tools/wix-json/`,
   ez nincs a repóban), és dobozonként kigyűjti a videót, a posztert, a lejátszó beállításait
   (`lejatszo`: forrás, poszter, automatikus indítás, némítás, ismétlés) és a beágyazások címét.
2. A `tools/videok-letoltese.mjs` a videókat abban a minőségben tölti le, amit az élő lejátszó
   kap (`video.wixstatic.com/video/<id>/<q>/mp4/file.mp4`), a posztereket eredeti méretben.
3. A párosítás az `assets/js/klon.js` `KATTINTOS` táblázatában van: `doboz → '<videó-id>/<poszterkocka>'`
   (a poszter nem mindig az `f000.jpg`, van `f001` és `f002` is – az oldal-adatok mondják meg).

Ha a Wixen egy videót lecserélnek, a fenti két parancs után a `KATTINTOS` táblázatot kell
igazítani (a `tools/wix-oldaladatok.json`-ban a `lejatszo` mezők).

## 2. Kezelés-galéria (8 videó) – ezt Wixből kell exportálni

Ezeket a Wix tokenes védelemmel tölti be, a linkjük kívülről 403-at ad, ezért csak a Wix
felületéről tölthetők le. A galéria kész, a bélyegképre kattintva felugró lejátszóban indul –
amint a fájl a helyén van.

| cím a galériában | hossz | fájlnév a repóban (`assets/video/`) |
|---|---|---|
| Fejmasszázs eszközökkel | 0:36 | `c2eb0f_a772c9222aa949a0888a4aa2298ef0b5.mp4` |
| Kézmasszázs | 0:38 | `c2eb0f_a12ccd3c1d8741698774232c8bee7efd.mp4` |
| Arcmasszázs | 0:36 | `c2eb0f_08e23fa612e846eca8137312513c1fec.mp4` |
| Mélytisztító hajmosás | 0:21 | `c2eb0f_29c8623e64464bdb96b1d61fa5ed6556.mp4` |
| Fejbőr masszírozó fésű | 0:34 | `c2eb0f_225ee4f9b6164d3c858705c394f7d04e.mp4` |
| 20 ujjas fejmasszírozó | 0:11 | `c2eb0f_430fb9fbd2e744b08703615db12f4018.mp4` |
| Arcroller | 0:17 | `c2eb0f_bbb818fad4674d2097775970ca10c3d0.mp4` |
| Fajmasszírozó körkefe | 0:12 | `c2eb0f_4dd11049dc03482e8b6a169484d1b976.mp4` |

### Így exportáld

A Wix felülete néha átrendeződik, ezért a menüpontok neve kicsit eltérhet.

1. **A galéria videói (Wix Video):** a Wix vezérlőpulton (Dashboard) a bal oldali menüben
   *Wix Video* → *Videótár* (Video Library). Keresd meg a fenti címeket. Egy videó melletti
   **⋯** menüben, ha van, válaszd a *Letöltés* (Download) pontot.
2. **Ha ott nincs letöltés:** nyisd meg a szerkesztőt (*Edit Site*), bal oldalt *Média* (Media)
   → *Webhely fájljai* (Site Files) → *Videók* mappa. Itt több fájl is kijelölhető egyszerre, és
   a felső sávban megjelenik a **Letöltés** gomb (ZIP-ben jön le). Egy fájlra kattintva jobb oldalt
   látszik a részletes adatlap; a *Fájl URL* végén lévő `c2eb0f_…` rész a fenti azonosító – ebből
   biztosan kiderül, melyik melyik.
3. **Ne nevezd át őket kézzel.** Elég, ha a fájlnévből vagy a mappából kiderül a galériacím
   (pl. `Kézmasszázs.mp4`), a pontos átnevezést és a feltöltést én intézem.
4. **Átadás:** tedd egy Google Drive-mappába, és küldd el a linkjét.

Ellenőrizve 2026-09-30-án: ezek a címek minden minőségben (1080p–360p) 403-at adnak, a többi
videóval ellentétben kívülről nem tölthetők le.
