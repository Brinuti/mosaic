# A Salonic adatlapon csak egy pipa: az adatkezelési / foglalási szabályzat elfogadása

**Mi volt:** a Salonic foglalási űrlapjának alján (az adatlapon) **két** jelölőnégyzet volt:
1. **kötelező:** „Megismertem és elfogadom az adatvédelmi tájékoztatót, a foglalási szabályzatot, és kifejezett hozzájárulásomat adom, hogy a megadott adataimat a(z) Mosaic Headspa saját célra kezelje, munkatársai kapcsolatba lépjenek velem a megadott elérhetőségeim egyikén. *"
2. **nem kötelező (hírlevél):** „Szeretnék e-mailben értesítést kapni az akciókról és friss információkról."

**Mit csináltunk (Feri kérésére, 2026-10-13):** a második, hírlevél-pipát a Salonic-fiókokba már betöltött egyedi CSS-ünkben ([salonic/mosaic.css](../../salonic/mosaic.css), a sminktetoválás-fiókéban [salonic/pmu.css](../../salonic/pmu.css)) elrejtettük (`.newsletter-container { display: none }`). Így **egyetlen pipa** marad: a kötelező elfogadás. A vendég nem kap külön „hírlevél"-kérdést.

**Mit jelent ez:**
- A hírlevél-hozzájárulás alapból üres volt (a vendégnek kellett bepipálnia), a rejtett `newsletter` mező értéke 0 marad: **senki nem iratkozik fel véletlenül.** Jogilag rendben van: nem gyűjtünk hozzájárulást.
- **Cserébe a foglalási űrlapon keresztül nem épül hírlevél-lista.** Ha később szeretnénk a vendégeket hírlevélre feliratkoztatni, azt máshol (pl. a köszönő oldalon, külön, szándékos feliratkozással) érdemes megoldani. Ha mégis vissza kell hozni a második pipát: az utolsó „Egy pipa" blokk törlése a két CSS-fájlból.
- A kötelező hozzájárulást **nem vonhatjuk össze** a hírlevéllel: marketing-hozzájárulás csak külön, önkéntes, előre nem bepipált jelölőnégyzettel kérhető (GDPR). Ezért a megoldás a hírlevél-pipa elhagyása, nem az „egybe vonás".
- A Salonic saját beállításai között is lehet ilyen kapcsoló (app.salonic.hu); az ottani beállítást a tulajdonos tudja átállítani. A CSS-es elrejtés addig is egységesen érvényes mind az öt fiókra (fodrászat, oxigén, Head Spa, lézer, sminktetoválás), ahol az űrlap a mi CSS-ünket tölti.

**Teszt:** `node tools/meres-proba/egy-pipa-proba.mjs [--mobil 1] [--uzletag hair|oxygen|headspa] [--css salonic/mosaic.css] [--kep mappa]` – a valódi Salonic adatlapon (a legtávolabbi szabad időpont, nem küld be semmit): csak egy pipa látszik, az a kötelező adatkezelési elfogadás, a hírlevél-pipa nem látszik és a rejtett értéke 0, a „Foglalás elküldése" gomb látszik, a kötelező pipa bepipálható. A kontroll (a régi CSS-sel) 2 látható pipát mutat. A sminktetoválás-adatlapon külön ellenőrizve.
