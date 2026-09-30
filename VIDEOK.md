# Videók a klónban – leltár és teendők

A Wix-oldalon háromféle videó van. A klónban eddig csak kettő játszott le; a többi doboz
üres volt, mert a Wix a tartalmukat nem a HTML-ben küldi, hanem utólag, JavaScripttel tölti be.

| fajta | hol | db | állapot |
|---|---|---|---|
| **magától induló háttérvideó** | nyitóoldal, `headspa-budapest-hungary` | 2 | ✅ működik (csak asztali nézetben, ahogy az élő oldalon is) |
| **kattintásra induló videó** (vendégvélemények, bemutatók) | 13 oldal, lásd lent | 52 doboz | ⏳ a lejátszó kész, a doboz → videó párosítás hiányzik |
| **kezelés-galéria** (Wix Video lista) | `index`, `headspa-budapest`, `headspa-budapest-hungary`, `headspa-ferfiaknak`, `paros-headspa-budapest` | 8 videó | ⏳ a lejátszó kész, a 8 fájl hiányzik |

## 1. Kattintásra induló videók (52 doboz)

| oldal | dobozok |
|---|---|
| `index` | 10 kicsi (258×472) + 5 nagyobb (280×510) |
| `head-spa-velemenyek` | 10 kicsi (258×472) + 5 nagyobb (280×510) |
| `headspa-ajandekkartya` | 1 négyzetes + 3 álló |
| `4-kezes-headspa-ajandekkartya` | 3 álló |
| `headspa-budapest-hungary` | 3 álló + 1 négyzetes |
| `headspa-budapest` | 1 álló + 1 négyzetes |
| `noi-fodraszat-budapest` | 2 |
| `balayage-haj-festes-budapest`, `noi-fodrasz-budapest-balayage-hajfestes`, `noi-hajfestes-budapest`, `lezeres-szortelenites-budapest`, `oxigenterapia-budapest`, `sminktetovalas-budapest` | 1-1 |

A mentett HTML-ben ezek a dobozok teljesen üresek: nincs bennük se poszterkép, se videócím.
Hogy melyik dobozba melyik videó kell, az a Wix **oldal-adataiban** (page JSON) van. Ezt a
`tools/wix-oldaladatok.mjs` tölti le és gyűjti ki dobozonként:

```bash
node tools/wix-oldaladatok.mjs      # -> tools/wix-oldaladatok.json
```

Ehhez hálózati hozzáférés kell a `siteassets.parastorage.com` felé. A felhős munkakörnyezetből
ez jelenleg tiltva van. A környezet beállításaiban engedélyezendő tartományok:

```
siteassets.parastorage.com   (oldal-adatok)
static.wixstatic.com         (poszterképek)
video.wixstatic.com          (a nyilvános videók letöltése)
www-mosaicheadspa-hu.filesusr.com   (a HTML-beágyazások tartalma)
```

Ha a párosítás megvan, a videók nagy része **exportálás nélkül** letölthető (a 14 már meglévő
fájl is így jött le). A párosítás a `assets/js/klon.js` `KATTINTOS` táblázatába kerül, a
lejátszó (poszterkép + lejátszás gomb, kattintásra indul) már kész.

Már letöltött, de még egyik dobozhoz sem rendelt videók (`assets/video/`):
`3b9f1c40…`, `40c49eeb…`, `4a41bc38…`, `7c74e304…`, `9ede44a0…`, `9fb46d0b…`, `a257ba46…`,
`ae591f49…`, `b14d6ca6…`, `c03c84ff…`, `c49cecf6…`, `ecca71a0…` – ezek a korábbi, kézzel
épített változatban vendégvéleményként szerepelnek.

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
4. **Átadás:** tedd egy Google Drive-mappába, és küldd el a linkjét. (Ha a többi videót is
   exportálod – vélemények, bemutatók –, azokat is ugyanide; a párosítás után kiderül, melyik kell.)

### Ha az összes videót exportálod

Ha egyszerűbb mindent egyben letölteni a *Webhely fájljai → Videók* mappából, az is jó: a
párosítás a Wix oldal-adatai alapján megy, a fölösleges fájlok nem kerülnek fel.
Csak arra figyelj, hogy egy fájl 100 MB alatt maradjon (a GitHub korlátja); a mostaniak 1–45 MB
közöttiek.
