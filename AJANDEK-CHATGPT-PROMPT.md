# ChatGPT-prompt: az ajándékkártya-dizájnok újragyártása (A5, szöveg nélkül, pontos rácsra)

**Mit csatolj hozzá a ChatGPT-nek:**
1. a három eredeti dizájn képét (smaragd/zöld, szalagos/pezsgő, virágos/rózsaszín; mindegyiken az előlap és a hátoldal egymás mellett),
2. a MOSAIC logót átlátszó hátterű PNG-ben (a Canva márka-készletből).

**Mit kapsz vissza tőle:** 6 PNG (`smaragd-elol.png`, `smaragd-hat.png`, `szalag-elol.png`, `szalag-hat.png`, `virag-elol.png`, `virag-hat.png`), egyenként 2480 × 1754 px. Ezeket küldd el nekem.

---

## A PROMPT (másold be egyben)

````
FELADAT

Csatolok három ajándékkártya-dizájnt (zöld "Smaragd", pezsgőszínű "Szalag", rózsaszín "Virág"). Mindegyik képen egymás mellett látszik az ELŐLAP (bal) és a HÁTOLDAL (jobb), és a MOSAIC Head Spa ajándékkártyájához készültek. Csatolom a MOSAIC logót is átlátszó hátterű PNG-ben.

Készítsd el mind a három dizájnt újra: UGYANAZ a hangulat, ugyanazok a motívumok, ugyanazok a színek, de pontosan az alábbi műszaki előírások szerint, mert az eredményt egy automatikus rendszer fogja szövegekkel és fotóval kitölteni. Összesen 6 kép kell: 3 dizájn × (előlap + hátoldal), mindegyik KÜLÖN fájlban.

Miért kell újra: a mostani képeken árnyék, lekerekített sarok és prezentációs háttér van, a képarányuk nem A5, ezért a széleiket le kellett vágni, és torzultak. Az újakon semmit nem szabad levágni vagy nyújtani.

======================================================================
1. KIMENETI FÁJLOK
======================================================================
- 6 db PNG, sRGB, a nevük: smaragd-elol.png, smaragd-hat.png, szalag-elol.png, szalag-hat.png, virag-elol.png, virag-hat.png
- Pontos méret: 2480 x 1754 px (A5 FEKVŐ, 210 x 148,5 mm, 300 dpi), képarány 1,4142 : 1. Ne 16:9, ne 3:2, ne 4:3.
- SÍK, kész grafika: a kép szélétől szélig (full bleed) maga a kártya van. Nincs árnyék, nincs lekerekített sarok, nincs fehér/szürke/átlátszó szegély, nincs asztal/papír/mockup/perspektíva, nincs vízjel.
- Egy fájlban egy lap: az előlapot és a hátoldalt SOHA ne tedd egy képre.

======================================================================
2. HOGYAN KÉSZÍTSD (az ábragenerátor nem tud pontosan A5-ös méretet)
======================================================================
a) Generálj 1536 x 1024 px-es (3:2, fekvő) vásznat. A tényleges kártya a vászon KÖZÉPSŐ 1448 x 1024 px-es sávja (x = 44 ... 1492). A bal és a jobb szélső 44 px-es sáv csak a háttér folytatása (vágási ráhagyás): ide NE kerüljön keret, dísz, logó vagy bármi fontos, csak a háttér folytatása.
b) A kártya keretvonala (ahol az eredeti dizájnon van) a KÁRTYA (középső sáv) szélétől 3,5%-ra legyen (szélesség 3,5%-a vízszintesen, magasság 3,5%-a függőlegesen), MINDEN oldalon. A díszek (levelek, szalagok, virágok) a keret mentén és a sarkokban lehetnek, de a kártya szélét sehol ne vágja el semmi fontos.
c) Generálás után Python-nal (futtasd le a kódot) vágd ki a középső sávot és méretezd 2480 x 1754-re, majd futtasd az ellenőrzést, és írd ki az eredményét:

```python
from PIL import Image
import numpy as np
img = Image.open("INPUT.png").convert("RGB")
W, H = img.size
ujW = round(H * 210 / 148.5)          # A5 fekvő arány a vászon magasságából
x0 = (W - ujW) // 2
img = img.crop((x0, 0, x0 + ujW, H)).resize((2480, 1754), Image.LANCZOS)
img.save("OUTPUT.png", dpi=(300, 300))
a = np.array(img).astype(int)
m = (a[:, :, 0] > 225) & (a[:, :, 1] < 45) & (a[:, :, 2] > 225)   # magenta (#FF00FF) terület
if m.sum() > 0:
    ys, xs = np.where(m)
    print("magenta ablak (a kep %-aban): x %.1f-%.1f  y %.1f-%.1f" % (xs.min()/2480*100, xs.max()/2480*100, ys.min()/1754*100, ys.max()/1754*100))
print("meret:", img.size, " arany:", round(img.size[0]/img.size[1], 4))
```

======================================================================
3. MI NEM LEHET RAJTA (ezeket az automatikus rendszer írja rá, a saját betűtípusával)
======================================================================
A MOSAIC logón kívül EGYETLEN betű, szám vagy felirat sem lehet a képeken. Konkrétan NE legyen rajta:
- minta-idézet ("Ide kerül az idézeted...") és "NEKI" és név ("a megajándékozott neve"),
- "AJÁNDÉKKÁRTYA" felirat (a Virág előlapján sem),
- termék-szöveg ("50+30 perces ... kezelés"), "ÉRTÉKE", ár ("53.800 Ft"), "UTALVÁNYKÓD", a kód ("XXXX-XXXX"), "Érvényes: ...",
- a lábléc ("Szeretettel várunk! · 1023 Budapest ... · mosaicheadspa.hu"),
- "Ide kerülhet a fotó" és bármilyen helyőrző szöveg, kamera-ikon, mintafotó.
Ezek helye legyen ÜRES, tiszta háttér (lásd az elrendezési rácsot).

======================================================================
4. LOGÓ
======================================================================
A csatolt MOSAIC logót használd PONTOSAN: ne rajzold újra, ne torzítsd, ne színezd át, az arányait tartsd. (Ha a csatolt tervek valamelyik oldalán logó van, ott legyen, ahol az elrendezési rács mondja.)

======================================================================
5. FOTÓABLAK (CSAK AZ ELŐLAPON)
======================================================================
- Az ablak BELSEJE tiszta, egyszínű MAGENTA (#FF00FF): nincs benne színátmenet, textúra, árnyék, ikon, szöveg. A magenta terület PONTOSAN az ablak alakja és mérete, éles szélekkel.
- Az ablak keretét (arany vonal, díszítés) a magenta területen KÍVÜL rajzold meg; a magenta közvetlenül a keretvonal belső széléig érjen, de a keretvonalat ne fedje.
- Alak és hely (a KÁRTYA, azaz a középső A5-sáv %-ában; x balról, y felülről):
  * SMARAGD: ív alakú (felül félkör, alul egyenes), x 8,5 - 44%, y 9 - 91%. A félkör sugara az ablak szélességének fele.
  * SZALAG: kör, középpont (24%, 51%), átmérő = a kártya magasságának 52%-a (ez a szélesség kb. 36,8%-a).
  * VIRÁG: lekerekített téglalap, x 7,5 - 40%, y 12 - 88%, a sarkok lekerekítése a kártya szélességének 1,3%-a.
- Az ablak mellett semmilyen dísz nem lóghat az ablak fölé; a szalagok, levelek az ablak keretvonala MÖGÖTT vagy mellett legyenek.

======================================================================
6. ELRENDEZÉSI RÁCS (a KÁRTYA, azaz a középső A5-sáv %-ában; x balról, y felülről) - MIND A HÁROM DIZÁJNRA UGYANAZ
======================================================================
Az "ÜRES ZÓNA" tiszta háttér legyen: nincs benne dísz, szalag, virág, levél, csillag, pont, textúra-kiemelés (csak a háttér finom, egyenletes árnyalata). A díszek a két szélen és a sarkokban maradjanak (x < 13% és x > 88%), valamint az előlapon a fotóablak körül.

ELŐLAP:
- Logó: vízszintes közép x = 70%, felső széle y = 5%, szélessége 26% (a logó arányát megtartva, a magassága kb. 28%).
- Fotóablak: lásd az 5. pontot.
- IDÉZET ÜRES ZÓNA: x 47 - 93%, y 40 - 70%.
- NÉV ÜRES ZÓNA ("NEKI" felirat + név): x 47 - 93%, y 74 - 92%.
- Opcionális díszvonal (ha az eredeti dizájnon van): vékony arany vonal középen kis gyémánttal, x 52 - 88%, y = 38% és y = 73% (az idézet-zóna alatt és fölött).

HÁTOLDAL:
- Logó: CSAK a SZALAG hátoldalán (ott az eredetin is van): vízszintes közép x = 50%, felső széle y = 5%, szélessége 25%. A Smaragd és a Virág hátoldalán NINCS logó.
- TERMÉK-SZÖVEG ÜRES ZÓNA (2 sor): x 15 - 85%, y 20 - 35% (a SZALAG hátoldalán a logó alatt: y 33 - 45%, ott minden lejjebb csúszik 10%-kal, lásd lent).
- ÉRTÉK ÜRES ZÓNA: x 25 - 75%, y 40 - 51%.
- KÓDKERET: vékony arany téglalap-KÖRVONAL (a vonal vastagsága kb. 3 px a 2480 px-es képen), x 27 - 73%, y 54 - 68%, a belseje ÜRES, a háttérnél egy árnyalattal világosabb vagy sötétebb sima kitöltés (nincs benne felirat!).
- ÉRVÉNYESSÉG ÜRES ZÓNA: x 25 - 75%, y 71 - 77%.
- LÁBLÉC ÜRES ZÓNA: x 15 - 85%, y 89 - 94%.
- Opcionális díszvonalak (ha az eredeti dizájnon vannak): vékony arany vonal gyémánttal, x 30 - 70%, y = 38%, y = 70% és y = 80%.
- A SZALAG hátoldalán a logó miatt a termék-szöveg, az érték és az érvényesség zónái ugyanott maradnak, mint fent (a logó y 5 - 28%, azaz fölöttük van): ne csússzon el semmi.

======================================================================
7. DIZÁJNONKÉNTI LEÍRÁS (a csatolt képek alapján; a hangulatot, a motívumokat és a színeket tartsd meg)
======================================================================
SMARAGD (sötét, elegáns): mély smaragdzöld márvány-hatású háttér (kb. #0B1F1B ... #143A31), vékony arany dupla keretvonal (arany kb. #D9B866), arany erezetű olajzöld-szürkés levelek és ágak a bal szélen és a jobb alsó sarokban, finom arany pöttyök. Előlap: bal oldalon ív alakú ablak (arany keretvonallal, belül egy vékony belső arany vonal), jobb oldalon a logó. Hátoldal: levél-díszek a bal oldalon, a jobb alsó és a jobb felső sarokban; a közepe üres.
SZALAG (pezsgő, ünnepi): meleg pezsgő/krém háttér (kb. #F3E3C4 ... #ECDAB4), rózsaarany szalagok (kb. #D7A692 ... #C98F7B) a sarkokban és a bal alsó szélen, arany csillag- és szív-díszek és pöttyök a két szélen, vékony barna-arany (kb. #8A6A36) keretvonal. Előlap: bal oldalon kör alakú ablak vékony arany gyűrűvel, a gyűrű mellett a szalag el-eltűnik. Hátoldal: felül középen a logó, a szélein csillag/szív/pötty díszek és szalag-sarkok.
VIRÁG (romantikus, rózsaszín): halvány rózsaszín akvarell háttér (kb. #FBE2DA ... #F7D0CA), cseresznyevirág-ágak és levelek a bal és a jobb szélen, rózsaszín szatén szalag a bal felső és jobb felső sarokban, vékony arany keretvonal (kb. #B88A44). Előlap: bal oldalon lekerekített téglalap ablak vékony arany körvonallal, jobb oldalon a logó alatt az idézet-zónában halvány rózsaszín akvarell ecsetfolt (ez a háttér része, szöveg nélkül). Hátoldal: virágágak a bal oldalon, a bal alsó és a jobb alsó sarokban; a közepe üres.

======================================================================
8. SZIGORÚ SZABÁLYOK ÉS ELLENŐRZŐLISTA (minden kép leadása előtt pipáld végig, és írd le az eredményt)
======================================================================
[ ] 2480 x 1754 px, PNG, a képarány 1,4142 (a Python-ellenőrzés kiírta)
[ ] a kép MINDEN szélén a kártya háttere van: nincs fehér/szürke sáv, nincs árnyék, nincs lekerekített sarok
[ ] a keretvonal (ha van) a kártya szélétől ~3,5%-ra van, sehol nincs elvágva; a díszek sehol nincsenek a kép szélén elvágva fontos részükkel
[ ] a logón kívül nincs semmilyen betű, szám, felirat, ikon, mintafotó
[ ] az ÜRES ZÓNÁKBAN nincs dísz, csak tiszta háttér
[ ] az előlapon a fotóablak belseje tiszta #FF00FF, a keret rajta kívül van; a magenta terület helyét a Python kiírta, és megfelel az 5. pontnak
[ ] a hátoldalon a kódkeret üres, vékony arany körvonal, a megadott helyen
[ ] a logó pontosan a csatolt logó (nem rajzoltad újra), a megadott helyen és méretben
[ ] ugyanaz a dizájn-nyelv (szín, motívum) mint az eredeti képen
Ha valamelyik pontot nem tudod teljesíteni, ÍRD LE, hogy melyiket és miért, és ne rögtönözz.

======================================================================
9. MUNKAMENET
======================================================================
Egyszerre EGY képet készíts el (sorrend: smaragd-elol, smaragd-hat, szalag-elol, szalag-hat, virag-elol, virag-hat). Mindegyik után add oda a kész PNG-t letölthető fájlként, és írd mellé az ellenőrzőlista kitöltött eredményét. A következő képet csak akkor kezdd el, ha azt írom: "mehet".
````
