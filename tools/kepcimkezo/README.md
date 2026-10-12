# Képtár-címkéző (Mosaic + Medical Piercing)

A megadott Google Drive mappák összes képét és videóját címkézi az OpenAI `gpt-5.4-mini` modelljével, az eredményt egy Google Sheetbe írja.
Egyszer végigmegy mindenen (kb. 9 700 egyedi fájl), utána naponta csak az újakat és a módosultakat címkézi.

- **Táblázat:** a Drive-on a „Képtár-címkéző (Mosaic + Medical Piercing)” mappában: „Képtár-címkék (Mosaic + Medical Piercing)” – lapok: `képek` (az eredmény), `napló` (futásonként egy sor), `beállítások` (élesítés, időkeret, vészfék).
- **Hol fut:** Google Apps Script önálló projekt („Képtár-címkéző (Mosaic + Medical Piercing)”), a `deakfi@grantis.hu` fiók Drive-ján: <https://script.google.com/d/16fBf2TfF0o7Y9oxdyMtUUc9aopeFqTBnoqp53S-bv90rsDIrWnIcr7jT/edit>. A forráskód ebben a mappában van, innen töltjük fel (`clasp`).
- **Titok:** az OpenAI-kulcs a szkript „Szkripttulajdonságok” (Script Properties) között van `OPENAI_API_KEY` néven. Nincs a kódban, nincs a repóban.

## Miért Apps Script (és nem Cloudflare Worker / GitHub Actions / n8n)?

A három gyökérmappa tartalmát **több különböző Google-fiók** birtokolja (mosaicheadspa, karolinmedical, prenatocontent, gyarmat.hermina …), és a mappák többségét csak olvasásra osztották meg a `deakfi@grantis.hu` fiókkal (a megosztás nem adható tovább). Egy külön „szerviz-fiók” vagy szerveroldali futtató ezeket nem érné el; csak az a fiók látja mindet, amelyik a megosztásokat kapta. Az Apps Script ezen a fiókon fut, ezért pontosan azt látja, amit a tulajdonos is lát – külön megosztás, szerviz-fiók, Google Cloud projekt nélkül. Az időzítés (napi futás) és a titkos változó (Script Properties) is beépített.

## Mit csinál egy futás

1. **Bejárás:** a gyökérmappákat rekurzívan végigjárja (A: csak a „MOSAIC Head spa” és „Medical Piercing” almappa; B, C: minden). Kihagyja a „Jelszavak” és az „Influencer szerződés” nevű mappákat (bármilyen mélységben). Az útvonal elejét a leltárral egyezően `A/…`, `B/…`, `C/…` jelöli. **Minden mappa külön Drive-lekérdezés**: a „több szülő egyszerre” (`'a' in parents or 'b' in parents`) keresés megosztott mappáknál csendben kihagy elemeket (így esett ki elsőre a teljes Medical Piercing ág: 7 635 fájl / 5 781 egyedi helyett 11 947 / 9 661). A lekérdezések párhuzamosan mennek (Drive REST, `UrlFetchApp.fetchAll`); ha a projektben a REST nincs bekapcsolva, a szkript ezt egyszer megjegyzi (`DRIVE_REST = off`) és sorban, a beépített Drive-szolgáltatással megy tovább. Ellenőrző szám (2026-10-11): 952 mappa, 11 947 fájl, 9 661 egyedi md5, 2 kihagyott mappa – egyezik az elemző leltárával.
2. **Összevetés a táblázattal:** csak az új (és a tartalmában módosult, azaz más `md5Checksum`-ú) fájlokat címkézi. Azonos tartalmú (azonos md5) fájlból **egy** sor van; a további példányok számát a `másolatok` oszlop mutatja.
3. **Előnézet:** a Drive `thumbnailLink` képét (`=s384`) tölti le, a teljes fájlt soha. Videónál ugyanez az előnézeti kocka.
4. **OpenAI Responses API:** `gpt-5.4-mini`, `detail: low`, `store: false`, 8 kép / hívás, 4 hívás párhuzamosan, `json_schema` strict kimenet. A kérés formája megegyezik az elemző kipróbált `tag_batch` függvényével (prompt + képenként `#k mappa: …`).
5. **Hibakezelés:** átmeneti hiba (429/5xx) esetén újrapróbál; ha egy köteg elbukik, felezi, így egy rossz kép nem viszi magával a többit. Előnézet nélküli fájl `nincs_előnézet`, elbukó fájl `hiba` állapotot kap (legfeljebb 3 próbálkozás, 20 óránként). A hiba oka ilyenkor a `leírás` oszlopban áll `HIBA: …` előtaggal (pl. `HIBA: elonezet HTTP 404`, `HIBA: http_400 …`), sikeres soroknál ott a modell leírása van. (Az első teljes futás – 2026-10-11 – 9 661 sorából 9 369 `kész`, 206 `hiba`, 86 `nincs_előnézet`; ez utóbbi 85 PSD + 1 JPEG. A hibaokok a következő napi újrapróbálásnál kerülnek a táblázatba.)
6. **Költség:** a válasz `usage` mezőjéből számolja (0,75 / 4,5 USD per millió token), havi összeget vezet, és a havi keret 90%-ánál (alapból 27 USD) megáll.

## Az eredmény-lap oszlopai

A megrendelt oszlopok: `file_id, név, mappa_útvonal, fiók (Mosaic/MP), mime, szélesség, magasság, üzletág, téma, felirat, szoveg, nyersíthető, arc, minőség, leírás, címkézés_dátuma` (a `szoveg` az elemző kérésére került a `felirat` után).
Utána technikai oszlopok: `md5`, `drive_módosítva`, `állapot` (kész / nincs_előnézet / hiba), `másolatok`, `próbálkozás`, `videó_hossz_mp`.
A `fiók`: a „MOSAIC Head spa” mappa → `Mosaic`, minden más → `MP`.
**Szabály (az elemző kérése, 2026-10-11):** `fiók = MP` esetén az `üzletág` mindig `piercing`, a modell válaszától függetlenül (a kódban, a válasz feldolgozásakor). A szabad szöveges oszlopok (`név`, `mappa_útvonal`, `szoveg`, `leírás`) szöveg-formátumúak, hogy a képről leolvasott szöveg (pl. „=…”, „+36…”) ne értelmeződjön képletként vagy számként.

## Működtetés

| Mit | Hogyan |
|---|---|
| Első beállítás | Szkript-szerkesztő → `OPENAI_API_KEY` felvétele (Projektbeállítások → Szkripttulajdonságok) → a `setup` függvény futtatása → engedélyek megadása. A `setup` lapokat és napi időzítőt (03:00) hoz létre, ellenőrzi a kulcsot, majd lefuttat egy **16 fájlos próbát**. |
| Próba újra | `proba` függvény. A `beállítások` lap `PROBA_ID_LISTA` értékével (file_id-k vesszővel) pontosan ezeket a fájlokat címkézi – **akkor is, ha már van soruk** (helyben frissíti): prompt-változtatás utáni újra-próbához. Üresen egyenletesen szórt mintát vesz. |
| Teljes futás élesítése | a `beállítások` lapon `ELESITVE` = `igen`. Addig a napi időzítő nem csinál semmit. |
| Vészfék | `beállítások` → `LEALLITAS` = `igen`, vagy a `leallitas` függvény (minden időzítő törlődik) |
| Egy futás hossza | `IDOKERET_PERC` (Workspace-fiók: legfeljebb 30, privát gmail: 6). Ha nem fér bele minden, 1 perc múlva magától folytatja. |
| Állapot | `allapot` függvény, és a `napló` lap |

## Fejlesztés

```
node tools/kepcimkezo/build.mjs <mappa>                          # az Apps Script projekt összeállítása
node --test tools/kepcimkezo/test/kepcimkezo.test.mjs            # a logika tesztjei (hamis Drive / OpenAI / Sheet)
node --test tools/kepcimkezo/test/gas.test.mjs                   # az Apps Script-illesztés füstpróbája
```

- `prompt.txt`, `schema.json`: az elemző által átadott prompt és JSON-séma. A `build.mjs` ebből generálja a `05_prompt.js`-t. Csere: a két fájl átírása, build, `clasp push`.
- `src/00_config.js`: mappa-azonosítók, kizárt mappa-nevek, modell, ár, korlátok.
- `src/10_core.js`: tiszta függvények · `src/20_pipeline.js`: bejárás → összevetés → címkézés · `src/90_gas.js`: az Apps Script szolgáltatások és a belépési pontok.
- Feltöltés: a build kimenetét tartalmazó mappából `npx @google/clasp push` (egyszeri `clasp login` után).

## Adatvédelem

A címkézéshez a fájlok 384 px-es előnézete (vendégfotók, arcok is lehetnek) az OpenAI-hoz kerül (`store: false`, vagyis az OpenAI nem tárolja a válaszokat; az API-adatokat az OpenAI alapértelmezésben nem tanításra használja). Az OpenAI adatfeldolgozási szerződése (DPA), az adatkezelési tájékoztató és a vendégfotós hozzájárulás a tulajdonos teendője.
