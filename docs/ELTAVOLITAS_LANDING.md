# /sminktetovalas-eltavolitas-budapest – sminktetoválás-eltávolítás (lézer), fotós előszűréssel

Első verzió: 2026-11-01 (Feri kérése: „mehet kiélesre, és nézzük át”). Fájlok: `foglalas/sminktetovalas-eltavolitas-budapest.html`,
`assets/css/eltavolitas-landing.css`, `assets/js/eltavolitas-landing.js`, `assets/img/eltavolitas/`, `assets/video/eltavolitas-kezeles.mp4`,
teszt: `tools/eltavolitas-teszt/eltavolitas.test.mjs`.

## Alapelvek
- **Nem foglalható online** (`docs/booking-engine/DECISIONS.md` 3.): csak fotó alapján indul. Nincs Salonic-szolgáltatás, a foglaló nem érintett.
- **A `suti.js`-hez, a GTM-hez és a külső fiókokhoz nem nyúl.** A foglaló-motorhoz (`assets/js/foglalo-pmu.js`) a 4. körtől két szűk módosítás tartozik (lásd lent: blob-hash, rollback).
- **Eredményígéret nincs** (nincs „teljes eltűnés”, „hegmentes”, „nyom nélkül”, „garantált”); a teszt tiltott kifejezés-listával őrzi.
- **Nem került ki** (nem vállalt / nem igazolt): haladás-kontroll, bérletvédelem, 90 napos ártartás, a lézer típusa, képesítések, eltávolítási esetszám, a szalon Google-értékelése.
- A képek: lézervédő szemüveges vendégek (a hozzájárulást Feri megerősítette, 2026-11-01), EXIF nélkül. A „közvetlenül utána” kép NEM végeredmény, az oldal így is címkézi.

## A fotós lead
Az oldal saját kis űrlapja (név, telefon, e-mail, terület, 1–5 fotó, hozzájárulás) a MEGLÉVŐ `pmu-proba-foto` űrlap-levélre megy (`POST /`, `netlify/lib/levelek.js`),
ugyanúgy, ahogy a `/foglalo-pmu` fotóküldése. A levélben az „Ág”, a „Kezelés / terület” és a „Beküldve innen” mező **eltávolítás-jelölést** kap
(`Eltávolítás – lézeres, fotó alapján`, `Sminktetoválás eltávolítás – <terület> (fotó alapján)`, `sminktetovalas-eltavolitas-budapest`), így Melitta a levélből látja, mi ez.
A fotókat a böngésző 1600 px-re kicsinyíti. Az űrlap `method="post"` (JS nélkül sem kerül személyes adat az URL-be / a GA4 `page_location`-be).

**Mi indul el a levélből (meglévő Zapier-lánc, ezt a PR nem módosítja; csak olvasva ellenőriztem, 2026-11-01):**
`weboldal-pmu-visszahivas-to-sheet-oktober` (Gmail-trigger: `from:mosaicheadspa@gmail.com subject:Sminktetoválás (visszahívást OR fotó)`) →
sor a „Melitta - PMU - Ajánlatkérések” táblázat „Október” munkalapján (Szolgáltatás: „PMU – weboldal, fotót küldött”; az Üzenet oszlopban a „Kezelés: Sminktetoválás eltávolítás – <terület> (fotó alapján)” és az „Oldal: sminktetovalas-eltavolitas-budapest”),
a fotók a Drive „Mosaic PMU – weboldali vendégfotók” mappa vendégenkénti almappájába, majd `melitta-pmu-oktober-sms` → **automatikus SMS a vendég telefonszámára**:
„Szia! Lattam a jelentkezesed, hamarosan hivlak. Mentsd el a szamom, hogy tudd, en kereslek: <Melitta mobilszama> - Melitta”.
Ez eltávolítás-leadnél is megy (a szöveg általános, nem sminktetoválás-specifikus); az űrlap a telefonmezőnél jelzi: „rövid, automatikus visszaigazoló SMS is érkezhet”.
(A Gmail-lekérdezés, az SMS szövege, az „Üzenet” oszlop tartalma és az, hogy a Zap az `Ág`-ot nem dolgozza fel, a két Zap forráskódjának 2026-11-01-i olvasásából származik; a 2026-10-04-i napló csak a lánc felépítését írja le.) A Zap `Ág`-értéket nem dolgoz fel, minden általunk küldött mező (Név, Telefonszám, Kezelés / terület, E-mail, Fotó n, Beküldve innen) a meglévő mezőnevekkel megy.

## Mérés (a mérési oldal dolga; ez a PR nem kapcsol be konverziót)
- Az oldal nem tölt mérőkódot, nincs `data-cta`. A `suti.js` PIXEL-listái nem változtak.
- Egyetlen **új, semmihez nem kötött** dataLayer-esemény: `eltavolitas_foto_lead` (sikeres fotóküldés után; csak `ana` hozzájárulással, próbajeles böngészőben nem;
  mezők: `business=pmu`, `lead_type=removal_photo`, `source_page`, `event_id`, `foto_db`, `terulet`; név / e-mail / telefon / fotó / URL nincs benne).
  GTM-címke és platform-leképezés **nincs** rá: ez külön mérési DECISION és külső fiók-változtatás (Feri külön kérése).

## Indexelés
Az első verzió `noindex, nofollow`, nincs sitemap-bejegyzés, nincs rá link az oldalról (hirdetésből / közvetlenül linkelhető).
Indexelhetővé tétel: a `<meta name="robots">` sor törlése + bejegyzés a `tools/wix-sitemap/pages-sitemap.xml`-be + (Feri döntésével) belső link a `/sminktetovalas-budapest` oldalról.

## Feri által megerősítendő (az oldalon most a javasolt érték áll)
1. Árak: fotós előszűrés díjmentes; teljes szemöldök 20 000 Ft/alkalom; részleges / korrekció 15 000 Ft-tól; ajak, szájkontúr 20 000 Ft-tól.
2. „1 munkanapon belül válaszolok”: tartható-e, és ki válaszol (a levelet a szokásos `pmu-proba-foto` címzett kapja).
3. Hétfő–péntek nyitvatartás (a szombat megerősítésig nincs kiírva: `<!--mh-nyitvatartas:hetkoznap-->`).
4. A kép-párosítás (2026-11-01, Feri kérésére átrendezve): három valódi, egy vendéghez tartozó „előtte → közvetlenül utána” pár (A, B, C), mind a két kép egy vendégről, 1–2 perc különbséggel, a bőr / a szemöldök állapota alapján sorba téve; a párokon belül a képek az arcok irányát egyeztetve elforgatva, egyforma 4:5 méretben. Feri a két „kezelés közben” képet egy vendégnek vélte; nagyítva két különböző vendég, ezért nem azokból készült pár. Kérlek, Melitta erősítse meg a három pár előtte/utána sorrendjét.
5. A „garancia” szó nincs használva; a három vállalás (előszűrés, átlátható ár, szakmai stop) jogi átnézése javasolt, mielőtt hirdetés indul.
6. A „Mikor nem vállalom?” lista (ellenjavallatok) és a GYIK szakmai tartalmát Melittának jóvá kell hagynia; az adatkezelési hozzájárulás egészségi állapotra utaló adatról szól, és (a meglévő mintát követve) az ÁSZF-re hivatkozik – külön adatkezelési tájékoztató / jogi átnézés javasolt. Az is ellenőrizendő, ki végezhet Magyarországon lézeres tetoválás-eltávolítást.
7. A fejléc „Foglalás” gombja a PMU-foglalóra visz (új sminktetoválás), nem eltávolításra – az eltávolítás online nem foglalható.
8. A meglévő Zapier-lánc az „Október” munkalapra ír (a munkalap neve a hónapváltás után maradt): ezt Feri / a mérési oldal tudja, a PR nem nyúl hozzá.
9. A `suti.js`-ben az `ana` hozzájárulás alapból engedélyezett (DECISION #170), ezért az `eltavolitas_foto_lead` alapértelmezetten bekerül a dataLayerbe; érdemes megnézni, hogy a GTM-ben nincs-e „minden esemény” trigger. (A GTM és a GA4 a `suti.js`-en át ezen az oldalon is betöltődik, mint minden oldalon; Meta-pixel nincs.)

## Visszavonás
Az oldal saját fájljai (új fájlok) törölhetők / a PR-ok visszavonhatók, más oldalt nem érintenek. **A foglaló-motor módosításának visszavonása (4. kör, lásd ott) minden PMU-foglaló oldalt érint**: lásd a „4. kör” rollback-tervét.


## 2026-11-01, 3. kör (Feri): kettős konverzió, a lézer, Melitta
- **Nem fotóval kezdünk.** A két konverzió: (1) **ingyenes konzultáció** foglalása, (2) **eltávolító kezelés** foglalása; a fotó mindkettőnél előre, nem kötelezően küldhető (ha küld, Melitta felhívja, és elmondja, milyen eredmény várható).
- **Naptár:** a `#foglalas` szakasz két választókártyát ad; a konzultáció a MEGLEVŐ `/foglalo-pmu` foglalót nyitja beágyazva (`?beagyazva=1&kezeles=konzultacio`, a Salonic „Ingyenes konzultáció”, 471160, 30 perc, Melitta), a foglalót és a `foglalo-pmu.js`-t NEM módosítottam.
  A kezelés-foglaláshoz jelenleg **nincs Salonic-szolgáltatás** (a 2026-10-03-i döntés: az eltávolítás csak fotó alapján megy). Amíg nincs, a „Eltávolító kezelés” kártya a lenti űrlapra visz (visszahívás). Ha a Salonicban létrejön a szolgáltatás
  (a nevében szerepeljen az „eltávolítás”), elég a `<section id="foglalas" data-kezeles-kulcs="">` attribútumot kitölteni (pl. `eltavolitas`): a kártya a naptárat nyitja abba a szolgáltatásba.
- **Mérés:** a beágyazott foglaló ugyanaz, mint a PMU-oldalakon, így az innen érkező konzultáció-foglalások a meglévő PMU-foglalási eseményeket adják (új esemény nincs). Ez új belépési pont egy élő konverzióhoz: a mérési oldal döntse el, megkülönböztetik-e az eltávolítás-forrást. A foglaló forrás-paramétere (`forras=`) csak a meglévő két oldalt ismeri, ezért a foglaló saját levelei (fotó / visszahívás) az eltávolítás-oldalról nem külön forrást mutatnak.
- **A lézer:** Dermway I Q-kapcsolt Nd:YAG (iSkin Kft. adatlap: 1064 nm + 532 nm, 8 ns, 1000 mJ, 1–10 Hz, levegő- és vízhűtés). A gyártó nincs megnevezve, a CE-jelölés / orvostechnikai besorolás az adatlapon nem szerepel: ezt a szalonnak kell igazolnia, mielőtt a szövegbe biztonsági állítás kerül. A gép képe a forgalmazó (iSkin) termékképe, **ideiglenes**: saját fotóra cserélendő (vagy engedély kell hozzá).
- **A szövegben Feri állításai** (nem én igazoltam): „általában 1–3 alkalom”, „már egy alkalom után is szembetűnő változás”, „kíméletes, steril, minimális kellemetlenséggel jár”, „utána újra tetoválható”.
- Melitta-blokk: a /sminktetovalas-budapest szakember-blokkja (WULOP 2026 1. hely, Milano 2025 3. hely, 5 év), eltávolítás-szöveggel.


## 4. kör (Feri, 2026-11-01): minden foglalás naptárba, a foglaló két szűk módosítása
> **Felülírva az 5. körben (lásd lent és `docs/FOTOS_FOGLALAS.md`):** a `?kerdes=kihagy` / `kerdesKihagy()` megszűnt; a foglaló mindenkitől megkérdezi, volt-e régi sminktetoválása, és a fotósoknak minden szolgáltatásra csak nov. 9-től ad időpontot. A `LEGKORABBI['491949']` marad.
- A Salonicban (Melitta, place 14585) megjelent a **„Tetoválás eltávolítás”** szolgáltatás: **491949**, 20 000 Ft, 30 perc. Az oldal mindkét kártyája (ingyenes konzultáció, eltávolító kezelés) a beágyazott `/foglalo-pmu` naptárba nyílik
  (`?beagyazva=1&kerdes=kihagy&kezeles=konzultacio` / `…&kezeles=491949`); az „eltávolító kezelés → űrlap” ág megszűnt, a fotóküldő űrlap csak nem kötelező, előzetes fotóküldés.
- **`assets/js/foglalo-pmu.js` (foglalási folyamat, Feri kérésére: „az időpontfoglalást javítsd”), két additív, szűk hatókörű módosítás:**
  1. `?kerdes=kihagy`: a „Volt már sminktetoválásod?” kérdés kimarad **csak** az ingyenes konzultációnál és a „…eltávolít…” nevű szolgáltatásnál (`kerdesKihagy()`); minden más szolgáltatásnál (a paraméter mellett is) a kérdés változatlanul megmarad. Időpont után egyenesen az adatok; a vissza gomb az időpont-választásra visz.
     (A korábbi szabály – „a kérdést senki nem ugorhatja át” – az eltávolítás-oldalról érkezőkre nem érvényes: nekik van régi sminktetoválásuk, az „igen” válasz fotófeltöltésre, nem foglalásra vitt volna.)
  2. `LEGKORABBI['491949']`: az eltávolítás **2026-11-09-től (Europe/Budapest 00:00) foglalható**; a szűrés a szabad időpontok betöltésénél történik (`szabadKezdesek`), minden más szolgáltatás változatlan.
     Éles ellenőrzés (Salonic-adatokkal): az eltávolítás első szabad napja nov. 10.; nov. 9. előtt nincs engedélyezett nap. FIGYELEM: ez csak a mi foglalónk szűrése; ha a Salonic saját foglalási oldalán közvetlenül foglalnak, azt a Salonic beállítása korlátozza.
- A kérdés kimaradása a „Kérdés” lépést is érinti a haladás-sávban (a sáv 4 lépést mutat, a 3. kimarad): kozmetikai, nem hiba.
- **Mérés:** a 491949 szolgáltatás új a PMU-leképezésben (`SALONIC_SERVICE_STAFF_MAPPING_CURRENT.json`, ismeretlen PMU-ár → HOLD, DECISION #195/3): a mérési oldalnak fel kell vennie, különben az eltávolítás-foglalás konverziója tartásba kerül.
- Gép-szakasz: „Az egyik piacvezető lézer, amellyel dolgozom” (Feri szövege, a „piacvezető” állítást nem tudtam igazolni: az iSkin-adatlap sem a gyártót, sem piaci pozíciót nem említ), két forgalmazói termékkép (ideiglenes).
- „Hány alkalom kell?”: 1–3 alkalom; **„kb. 1–3 hónap a gyógyulással együtt (alkalmanként nagyjából 4–6 hét)”: a 4–6 hetes köz a piaci gyakorlatból származó becslés, Melittának meg kell erősítenie.**

### 4. kör: védett fájl, blob-hash, rollback (a független review kérésére rögzítve)
- `assets/js/foglalo-pmu.js` blob-hash: **7666da3f7a8ea79a434e8abd6fbf4307bb3b84eb** (a 943224a1-en) → **d5615b71e1573be18bec53eebee95cfd0109588a** (a #584 merge, 8bce1481) → a „4. kör utólagos javítása” (lépésjelző, megjegyzés) után a main aktuális blobja (`git rev-parse origin/main:assets/js/foglalo-pmu.js`).
- Tartalom: (1) `KERDES_KIHAGY` / `kerdesKihagy()` + `slotValaszt` + `ELOZO.adatok` + lépésjelző (nincs „Kérdés” lépés kihagyáskor), (2) `LEGKORABBI['491949']`. Paraméter nélkül (`?kerdes=kihagy` hiányában) és a 491949-től eltérő szolgáltatásnál a viselkedés bitre azonos a korábbival (statikusan és viselkedési tesztekkel őrzött).
- **Rollback-terv:** (a) teljes visszaállítás: a #584 + az utólagos javítás PR visszavonása, vagy `git checkout 943224a1 -- assets/js/foglalo-pmu.js` (a régi blob 7666da3f…); ekkor az eltávolítás-oldal naptára a „Volt már sminktetoválásod?” kérdést is feltenné (az „igen” fotóra visz) és a 491949 nov. 9. előtt is foglalható lenne. (b) szűkebb: csak a két blokk (`KERDES_KIHAGY…`, `LEGKORABBI…`) törlése; az oldal `data-kezeles-kulcs` attribútumának kiürítése nem kapcsolja ki a naptárat, a kártyák kikapcsolásához az oldalt kell visszavonni.
- Vendégadat nem érintett. Mérést érint (új belépési pont, új szolgáltatás-azonosító): jelölve a PR-okban és a mérési ablaknak szóló összefoglalóban.
- Nyitott (Feri / mérési oldal): a 491949 felvétele a leképezésbe (`business-config.js`: a „removal” most nem foglalás, a 491949 `first_treatment`); a 491949 megjelenik az általános PMU-listákban is (`/sminktetovalas-budapest`, önálló `/foglalo-pmu`), ahol a „Volt már sminktetoválásod?” kérdés miatt az „igen” fotóra visz: döntés kell, elrejtsük-e onnan; a Salonic saját foglalási oldalán a nov. 9. előtti időpontot a Salonic beállításával lehet korlátozni (külső fiók).
- A korábbi megjegyzés a lépésjelzőről (kozmetikai) **téves volt**: a „Kérdés ✓” lépés kattintható volt és fotóra vihetett; javítva (kihagyáskor 3 lépés).

- 2. előtte–utána pár (A): az „utána” kép (`utana-a.jpg`) az eredeti fotóból függőlegesen tükrözve és az „előtte” kép szögére forgatva (Feri kérésére; a kép tartalma nem változott, csak tükrözés + forgatás, külső szolgáltatás nélkül): az „előtte” és az „utána” kép a vendég két különböző oldalát mutatta (jobb / bal szemöldök), így a szemöldök és a szemüveg állása (homlok balra, a szemöldök kb. 17–20°-ban dől, szemüveg a szemöldöktől jobbra, szíj függőleges) egyezik az „előtte” képével. A többi pár nem tükrözött.

- **A „Küldj előre fotót” blokk kikerült** (Feri, 2026-11-01): az oldalon nincs fotóküldő űrlap, nincs `eltavolitas_foto_lead` dataLayer-esemény, a `pmu-proba-foto` levelet innen nem küldjük (a fenti Zapier-lánc innen nem indul). Az oldal egyetlen konverziója a naptárba foglalás (ingyenes konzultáció / eltávolító kezelés).
  A fotókérés a foglaló-átalakítás része lesz (fotó + foglalás), lásd a Feri-nek küldött javaslatot; addig az eltávolítás-oldalról fotó nélkül lehet foglalni.


## 5. kör (Feri, 2026-11-01): fotós előszűrés + foglalás, menü, „Hogyan zajlik?”, képek verziózása
- **Foglaló** (minden PMU-belépési pont, nem csak ez az oldal): minden szolgáltatásnál a „Volt már sminktetoválásod?” kérdés az időpont ELŐTT; akinek van: kötelező fotó → időpont csak 2026-11-09-től → elérhetőség + fotó-levél (`FOGLALÁSSAL` jelöléssel) → Salonic. **Aki fotóval foglal, nem konverzió** (külön köszönőoldal `/pmu-foto-ok`, jelölések, mérési teendők): a teljes, pontos leírás a `docs/FOTOS_FOGLALAS.md`-ben van (a mérési ablaknak szánt szöveggel együtt).
- **Menü (közös fejléc, minden oldal):** a FOGLALÁS gomb a menüsor jobb szélén (Árlista · GYIK · Kapcsolat után, asztali + mobil); a Sminktetoválás pont legördülő: „Sminktetoválás” + „Tetoválás eltávolítás” (`tools/fejlec-menu.mjs`: `foglalasJobbra`, `sminkLenyilo`). Az eltávolítás-oldal továbbra is `noindex, nofollow` (a menüből elérhető, a keresők nem indexelik).
- **„Hogyan zajlik?”**: 3 lépés (választás + fotó, időpont, „jössz, és kezdhetjük”); a szöveg: érdemes már az első találkozón eltávolítani, mert a kezelés a konzultációt is magában foglalja; külön konzultációra csak az jöjjön, aki még nem biztos az első alkalmas eltávolításban (Feri szavai).
- **Képek**: a galéria képei `-v2` fájlnevet kaptak. Ok: a Cloudflare a képeket `cache-control: public, max-age=31536000` (1 év) fejléccel adja, ezért az azonos néven cserélt `utana-a.jpg` a korábban már látogatóknak (Feri böngészője is) a régi, tükrözetlen változatot mutatta. A 2. pár „utána” képe (flip + forgatás) a repóban jó volt; a `-v2` név miatt mindenki az újat kapja. **Szabály: kép cseréjekor új fájlnevet kell adni.**

