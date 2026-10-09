# Foglalás → megjelenés (booking-to-show) emlékeztető-rendszer

Forrás: `MOSAIC_booking_to_show_lifecycle_2026-10-07.pdf` (PLAN-D alapú copy + implementációs szabályok). Épült: 2026-10-07 (Claude, a tulajdonos kérésére).
Cél: a lefoglalt időpontból minél több **megjelenjen**: azonnali visszaigazolás (T0), tartalmi e-mailek, T-72 megerősítés, T-24 végrehajtási SMS, lemondás / áthelyezés kezelése — mind az 5 üzletágra.

## Hogyan működik

```
Salonic (nincs API / webhook)
  └─ szalon-értesítő e-mail (app@salonic.hu → mosaicheadspa@gmail.com): "Új online foglalás érkezett" / "Foglalás módosítva vendég által" / "Foglalás lemondás"
       └─ Zapier: lifecycle-bejovo (Gmail-trigger, ~1-2 perc)  ──POST──►  /api/lifecycle/bejovo   (Cloudflare Pages Function)
                                                                           ├─ értelmezés (netlify/lib/lifecycle/parser.js) → foglalás + küldési sor a D1-ben (LIFECYCLE_DB)
                                                                           └─ az azonnali (T0) SMS / e-mail rögtön kimegy
       └─ Zapier: lifecycle-tick (óránként)  ──POST──►  /api/lifecycle/tick  → az esedékes üzenetek (T-72, T-24, tartalmi levelek) kimennek + napi karbantartás
SMS: SimpleSMS REST (api.simplesms.hu)      E-mail: Gmail SMTP (SMTP_PASS, ugyanaz, mint az űrlap-leveleknél; feladó neve az üzletág)
```

- **Egyedi foglalás-azonosító**: a szalon-értesítő HTML-jében a Salonic foglalás-UUID-ja benne van (`bookingId=`; a lemondás-értesítőben NINCS: ott a vendég + üzletág + időpont alapján keressük meg a foglalást).
- **„A foglalásod” oldal** (`https://www.mosaicheadspa.hu/f/<kód>`, ez van az SMS-ben / e-mailben a „Részletek / módosítás” linkként): a **saját oldalunkon** nyílik meg (`netlify/lib/lifecycle/oldal.js`), és a vendég Salonic-oldala (`https://<fiók>.salonic.hu/booking/bookingDetails/<UUID>`) iframe-ben van benne, mint a foglaló-motorban. **Főszabály: látogatót nem viszünk a Salonic saját oldalára.** A beágyazott oldalt a Salonic-fiókokba töltött egyedi CSS (`salonic/mosaic.css`, PMU: `salonic/pmu.css`; csak a 4 oldal body-id-jára: részletek, időpont-választó, módosítás-siker, törlés-siker) formázza mobilbarátra, és elrejti a Salonic felé mutató részeket (menü, főoldal-link, fiók-reklám, térkép-kártya). Alatta a mi gombjaink: „Új időpontot foglalok”, telefon, útvonalterv. A lemondott / no-show foglalásnál nincs iframe, csak az új időpont-választó. *Megjegyzés: a Salonic egy foglalást csak EGYSZER enged módosítani (utána a „Foglalás módosítása” gomb eltűnik, csak lemondás lehet).* Az iframe a CSS-t a **www.mosaicheadspa.hu**-ról kapja, ezért az előnézeten a régi (éles) CSS látszik; a CSS változásai a `main` élesítésekor lépnek életbe.
- **Megerősítő link**: `https://www.mosaicheadspa.hu/m/<kód>` — egykattintásos (botoknak nem erősít meg); a megerősített vendégnek a T-72 SMS kimarad, a T-24 megy.
- A Salonic **minden foglalásról két levelet** küld (két címzett-lista): a motor az azonosító alapján egynek számít (ismétlődés-szűrő).

## Üzemmódok (`LIFECYCLE_MOD`, wrangler.toml)

**Állapot: ÉLES (`elo`) 2026-10-08 óta** – a tulajdonos kifejezett kérésére az éles (`[vars]`) környezet `elo` módban van, mindkét Zapier-lánc (`lifecycle-bejovo`, `lifecycle-tick`) az éles oldalra (`https://www.mosaicheadspa.hu`) mutat. Az előnézeti környezet (`[env.preview.vars]`) marad `teszt`.

| mód | jelentés |
|---|---|
| `ki` | semmi nem megy ki (a foglalások rögzülnek) |
| `teszt` | **csak a teszt-vendégeknek** megy üzenet (`deakfi@grantis.hu`, `ferencistvandeak@gmail.com`, `ferraj@gmail.com`, a `+36709420090` telefon, „TESZT …” nevű vendég); a valódi vendégek foglalása rögzül, de nem kap üzenetet |
| `elo` | az `LIFECYCLE_UZLETAGOK`-ban felsorolt üzletágak (headspa, hair, oxygen, laser, pmu) **valódi vendégeinek** is |

Élesítéskor a `teszt` módban rögzített, de még el nem küldött üzenetek közül a T0 12 órán belül, a többi 2 órán belül küldhető ki (a régi, késett üzenet nem megy ki: „késett” → kihagyva).

## Lead-time szabály (dokumentum 1.3)

| időpontig | üzenetek |
|---|---|
| < 30 óra | csak T0 (a kritikus előkészület a T0 e-mailben: `surgos_kiegeszites`) |
| 30–96 óra | T0 + T-24 |
| 5–9 nap | + 1 tartalmi e-mail, T-72 (SMS + prep e-mail), T-24 |
| 10–20 nap | + max. 2 tartalmi e-mail |
| 21+ nap | + max. 3 tartalmi e-mail (az üzletág katalógusának darabszámáig) |

SMS 8:00–20:30, e-mail 7:00–21:00 között (az ablakon kívüli esedékesség a legközelebbi szélre kerül); a T0 azonnali. A tartalmi e-mailek legalább 24 órával a T-72 előtt, és egymástól legalább 24 órára mennek.

## Áthelyezés, lemondás

- **Áthelyezés**: ugyanaz a foglalás új időponttal; a régi időponthoz tartozó függő üzenetek újraszámolódnak (T-72 / T-24 az új időpontra), a már elküldött tartalmi e-mail nem ismétlődik, a T0 nem megy újra; azonnali „megvan az új időpontod” SMS.
- **Lemondás**: minden függő üzenet törlődik; azonnali lemondás-visszaigazolás (SMS + e-mail) átfoglalási linkkel.
  *A Salonic lemondás-értesítője NEM tartalmazza a foglalás azonosítóját* (az új foglalás és az áthelyezés értesítője igen), ezért a lemondott foglalást a **vendég (telefon vagy e-mail) + üzletág + az időpont** alapján keressük meg az aktív foglalások közt; a ketszer érkező lemondás a 15 percen belül lemondottra illeszkedik (nem lesz két lemondás-üzenet). Ha nincs találat, külön „lemondva” sor jön létre (és kimegy a lemondás-visszaigazolás).
- **No-show** (a legfontosabb visszahozó üzenet; **2026-10-09 óta alapból KI, DECISION #117**: törlésből nem lesz automatikus no-show, csak napló + riasztás; a `LIFECYCLE_NOSHOW_AUTO=1` kapcsoló visszakapcsolja; a lenti leírás a kapcsolóval bekapcsolt működés): ha a szalon kitörli (lemondja) a naptárból a vendég időpontját, a Salonic erről is küld „Foglalás lemondás” értesítőt. A motor no-show-nak veszi, ha az értesítő **az időpont kezdete UTÁN** érkezik (a vendég már nem mondhatja le), vagy a **„Lemondás oka” tartalmazza: „nem jelent meg” / „nem jött el” / „no show”** (és az időpont legfeljebb 3 napos). Ilyenkor a „töröltük az időpontodat” helyett **SMS (`COMMON-NOSHOW-SMS`) + e-mail (`COMMON-NOSHOW-EMAIL`)** megy „Tegnap nem találkoztunk… itt egyből tudsz újat választani” szöveggel, új foglalási linkkel: ha a jelzés az időpont napján jött, **másnap 10:00-kor**; később: nappal fél óra múlva, reggel 10:00-kor, este másnap 10:00-kor. (A szöveg a küldés napja szerint „Ma / Tegnap / A … időpontodon nem találkoztunk”.) A 3 napnál régebbi, már elmúlt időpont törlése csendes (semmi nem megy). Kétszer érkező levélre nem megy kétszer.
- **Szolgáltatás-név**: az általános nevek elé („Ingyenes konzultáció”, „Korrekció”) az üzletág szava kerül SMS-ben és e-mailben is („szőrtelenítés ingyenes konzultáció”, „sminktetoválás korrekció”), a „zsófihoz” végződés lekerül.

## Munkatársi törlés / módosítás (DECISION #117, APPROVE_WITH_GUARDRAILS; issue #167)

A **munkatársi** törlések és módosítások (a szalon a Salonic naptárában töröl / áthelyez egy időpontot) NEM a `Foglalás lemondás` / `Foglalás módosítva` levelet küldik, hanem a `❌ Időpont törölve: <szolgáltatás>` / `🗓️ Időpont módosítva: <szolgáltatás>` levelet, és nem a `mosaicheadspa@`-ra, hanem a munkatársi értesítő-címre (2026-10-09 10:10 óta a `salonicfoglalas@gmail.com`-ra is; az 5 Salonic-fiók `internalChangeCCEmails` beállítása). A levélben: **vendégnév** (`Neve:`), szolgáltatás, dátum (**évszám nélkül**), helyszín (= a szalon neve = az üzletág), munkatárs (promóciós szöveggel, pl. „Noel - 20% kedvezmény!”). **Nincs** benne foglalás-azonosító, link, törlési ok, telefon vagy e-mail; módosításnál **csak az új időpont** szerepel. Naponta kb. 7 törlés és 30 módosítás érkezik, a módosítások nagy része belső blokk (ebédszünet stb.). A `Új időpont létrehozva` levél nem tartozik ide (kihagyva).

**Alapelv: a levél csak jelzés, a bizonyíték a foglalás élő Salonic-oldala.** Feldolgozó: `munkatars.js` (értelmező, belső blokk), `elo.js` (élő oldal), `engine.js` (`munkatarsIngest`); a `/api/lifecycle/bejovo` ugyanazon a törzsön fogadja, mint a többi értesítőt (`{uzenetId, targy, kuldo, szoveg, html, kuldve}`).

| eset | mi történik |
|---|---|
| **Törlés az időpont előtt** (D2/D5) | a foglalás megtalálva + a név egyezik + az élő oldal is „törölt” → az állapot `lemondva` (= „cancelled”), **minden függő emlékeztető törlődik** (`ok = szalon_torolte`), **vendégüzenet nincs** (se lemondás-visszaigazolás, se no-show) |
| **Törlés az időpont után** (D3/D5) | **nincs állapotváltás, nincs üzenet**: csak napló + riasztás (`utolagos_torles`). Automatikus no-show nincs |
| **Módosítás** (D4) | csak bizonyítottan: a foglalás megtalálva (üzletág + munkatárs + szolgáltatás + név, egyértelműen), és az élő oldal **az új kezdést** mutatja → az időpont és a terv újraszámolva. „Megvan az új időpontod” SMS **csak ha az új időpont 72 órán belül van**; különben csendes újraszámolás. Nem bizonyítható → riasztás, SMS nélkül |
| **Belső blokk** | csak egyértelmű szabállyal dobjuk el (`ignored_internal`): `Ebédszünet`, `Szünet`, vagy a szolgáltatás maga a munkatárs neve; továbbá (a 192 valódi levél visszajátszása alapján, **jóváhagyásra vár**) ha **nincs jelölt** és a vendégnév a Salonic helykitöltő vendége, a **„Beeső”** (`szabaly: beeso_nev`): a valós levelekben ez a név áll a megbeszélés / szolgáltatási szünet / workshop blokkokon és a bejáró vendégeken, a csomag 72 „Beeső” levele közül egy sem volt valódi online foglalás. Egy „Beeső” nevű valódi online foglalás (van jelölt) a rendes úton megy. Nem egyértelmű, és nem ismert vendég-szolgáltatás (a Salonic-pillanatkép szerint): `ignored_uncertain` + riasztás, állapotváltás nélkül |
| **Ismert szolgáltatás, nincs ilyen online foglalás** | telefonon / kézzel felvett vendégidőpont: csak számláló (`nincs_online_foglalas`), nem hiba |

**Párosítás:** üzletág + kezdés + munkatárs + szolgáltatás (törlésnél); a **normalizált vendégnév kötelező megerősítő jel, de nem önálló kulcs**. Módosításnál a régi kezdés ismeretlen, ezért a vendégnév is szűkít, és az élő oldal bizonyít. Pontos egyezés (kisbetű, ékezet és írásjel nélkül; a munkatárs neve a promóciós „ - …” toldalék nélkül) – **közelítő (fuzzy) egyeztetés nincs**. Több találat vagy név-eltérés: **0 állapotváltás, 0 SMS, riasztás**.

**Élő oldal** (`elo.js`): `GET https://<fiók>.salonic.hu/booking/bookingDetails/<UUID>` (csak olvasás, 4 mp időkorlát, a host csak a fiók-névből). *Törölt* = a Salonic a `/booking/deleteSuccess/<UUID>` oldalra irányít (a felirat önmagában nem dönt); *élő* = a „Foglalás módosítása” link (`/selectDate/?startDate=<unix>&bookingId=<UUID>`) hordozza a kezdést. Minden más (hálózati hiba, időtúllépés, ismeretlen oldal) = `ismeretlen`: **ilyenkor soha nem változtatunk semmit**.

**Kiküldés előtti ellenőrzés** (D6, **azonnal éles**): a `tick` a T-72 / T-24 / tartalmi üzenetek előtt (UUID-s foglalásra, tickenként legfeljebb 10 oldalt, párhuzamosan) megnézi az oldalt: *törölt* → semmi nem megy ki, a függő üzenetek törlődnek, az állapot `lemondva`, vendégüzenet nincs; *a kezdés eltér* → egyelőre **csak napló** (`elo:kezdes_eltero`), döntési feltétel csak bizonyított teszt után lehet; *nem ellenőrizhető* → a mostani működés. Kikapcsolás: `LIFECYCLE_ELO_ELLENORZES = ki`.

**Riasztás:** az `esemenyek` táblában `ingest:riasztas:<kód>` sor (személyes adat nélkül: üzletág, időpont, szolgáltatás, munkatárs; **vendégnév nincs**), a napi karbantartás **egy összesítő e-mailt** küld a szalon címére (`LIFECYCLE_SZALON_EMAIL`), ha van új riasztás. Kódok: `ignored_uncertain`, `tobbertelmu`, `nev_elteres`, `oldal_ellentmond`, `nem_ellenorizheto`, `nem_bizonyithato`, `utolagos_torles`, `multbeli_modositas`, `nem_jelent_meg_jelzes`, `ertelmezhetetlen`. Az `/api/lifecycle/allapot` személyes adat nélküli számlálókat ad (`munkatarsEsemenyek`).

**Üzemmód** (`LIFECYCLE_MUNKATARS_MOD`): `ki` (semmi nem regisztrálódik, a levél később újraküldhető) | `figyel` (**alap**: ugyanaz a párosítás és élő ellenőrzés, de csak napló + riasztás, **állapotváltás és üzenet nincs**) | `be` (a fenti szabályok szerint változtat). A `main` éles értéke `figyel`; a `be` a kontrollált teszt (elfogadási kapu) után kapcsolható. **Kiadási sorrend:** a feldolgozó élesítése és kontrollált tesztje előbb, a **Zap csak utána** (a `lifecycle-bejovo` mintájára, `salonicfoglalas@` kapcsolattal, szűrő: `from:app@salonic.hu deliveredto:salonicfoglalas@gmail.com subject:("Időpont törölve" OR "Időpont módosítva")`; a „létrehozva” kimarad). Értelmezhetetlen levél azonosítója (`ingest:kihagyva`) egyszer elmentődik, és a későbbi újraküldés ismétlésnek számítana – ezért nem szabad a Zapet a feldolgozó előtt bekapcsolni.

**Elfogadási kapu** (mindegyikből egy eset, mindegyiknél 0 téves SMS, 0 téves állapotváltás, 0 dupla feldolgozás): munkatársi törlés időpont előtt; törlés időpont után; bizonyított valódi módosítás; belső blokk; többértelmű párosítás; név-eltérés. Automatikus tesztek: `tools/lifecycle-teszt/munkatars.test.mjs` (szintetikus levelek és 5 valódi, kitakart levél a `tools/lifecycle-teszt/fixtures/munkatarsi-levelek.json`-ból, vendégadat nélkül), a valódi esetek a kontrollált próbán (TESZT – Claude foglalások).

**Offline visszajátszás** (kitakart, valódi levelek csomagja, pl. `SALONIC-MUNKATARSI-LEVELEK-VISSZAJATSZAS-2026-10-09.json`): `node tools/lifecycle-teszt/visszajatszas.mjs <csomag.json> [--reszletek]`. Üres in-memory D1-en, `figyel` és `be` módban lefuttatja az értelmezőt és a teljes feldolgozót; kimenet: levéltípus / üzletág / belső-blokk szabály statisztika, a feldolgozó kimenetei, és hogy a foglalások és küldések száma 0 maradt-e. Vendégadatot nem ír ki, hálózathoz és az éles D1-hez nem nyúl.

## Üzenet-katalógus

`netlify/lib/lifecycle/katalog/` (`SEMA.md` a formátum; üzletáganként egy fájl + `kozos.js`). A szöveg a dokumentum szerint; **fix ár / százalék / hónapnév nincs a szövegben** (a dokumentum szabálya; a katalógus-teszt ellenőrzi); az `{aktuális_ár}` / `{aktuális_ajánlat}` soraiból jelenleg semmi nem jelenik meg (nincs garantáltan aktuális ár-forrás). A „48 órás lemondási szabály” **nincs** sehol (tulajdonosi döntés).
**Belső „hívandó vendég” feladat-levelek nincsenek** (a tulajdonos kérése, 2026-10-08: a szalonnak szóló belső értesítőt nem kell kiküldeni): a katalógusból kikerültek a `*-CALL-01` üzenetek. (A motor `feladat` csatorna-kódja megmaradt, de nincs mit kiküldenie; a katalógus-teszt tiltja új feladat-üzenet felvételét.)

### Levél-szabályok (a tulajdonos kérései, 2026-10-08)

- **Nincs külön aláírás** a levél törzsében („MOSAIC Head Spa and Hair”): a lábléc mutatja a nevet (a katalógusban nincs `alairas` blokk; a teszt ellenőrzi).
- **Gombok középen**, a weboldal arany gombjának kinézetével (arany átmenet, fehér felirat, lekerekített, nyíllal: „… →”).
- **Az időpont kiemelve** a lemondás-levélhez hasonló bézs dobozban (`doboz`: szolgáltatás félkövéren, a dátum + óra félkövéren, nagyobb betűvel); minden levélben, ahol időpont szerepel.
- **Minden kép linkelt** (alapból az üzletág eredmények-szekciójára), így a levelező (pl. Gmail) nem kínál „Letöltés” gombot a képen; a teszt ellenőrzi.
- **A linkek közvetlenül a szekcióhoz visznek** (`#horgony`): HeadSpa vendégvideók `/head-spa-velemenyek#vendegek`, teljes élmény videók `#videok`; oxigén kezelés-videó `/oxigenterapia-budapest#video`; lézer Zsófi-videó `/lezeres-szortelenites-budapest#zsofi`; PMU Melitta `/sminktetovalas-budapest#melitta`; **fodrásznál a lefoglalt fodrász saját oldala**: a munkái szekciónál (`{eredmények_link}`) és a konzultációs videójánál (`{videó_link}`) – `uzletag.js` `HAIR_FODRASZOK`.
- **Videó a levélben:** a leveleken a videó előkép-képe (lejátszás jellel) látszik, rákattintva a videóhoz / szekcióhoz visz (a levelezők nem játszanak videót). Állóképes (portré) videóknál a blokk `szelesseg` mezője a megjelenítési szélesség (kb. 240–260 px, középre igazítva).
- **Google-vélemény:** az `ertekeles` blokk (csillagok + „4,9 / 5 a Google-on”) a MOSAIC Google-adatlapjára (`GOOGLE_VELEMENYEK_URL`, `render.js`) mutat.
- HeadSpa: egyféle időpont foglalható, ezért nincs „Hair HeadSpa / mikrokamera” szöveg és kép; a T0 levél a „legfontosabb tudnivalók” videót tartalmazza (ugyanaz, mint a régi `/success-foglalas*` köszönőoldalon, és most az új foglaló végképernyőjén is: `engine.js`, `.be-tudnivalok-video`).
- A fodrász-T0 levélben a lefoglalt fodrász képe, a +2 napos levélben a konzultációs videója van.
Ékezetes SMS-nél (UCS-2) **70 karakter / szegmens (összefűzve 67)**: a hosszú SMS-ek 3–5 szegmensnek számítanak a SimpleSMS-ben (a tényleges szegmensszám a `kuldesek.szegmens_db`-ben van). **Költség: kb. 17 Ft / szegmens** (a próbáknál mért: 4–5 szegmenses SMS ≈ 70–85 Ft, a T-24 SMS 3 szegmens ≈ 51 Ft), azaz egy teljes lánc (T0 + T-72 + T-24) vendégenként kb. 200–250 Ft SMS-díj.

## Konfiguráció

`wrangler.toml` (nem titkos): `LIFECYCLE_MOD`, `LIFECYCLE_UZLETAGOK`, `LIFECYCLE_KULCS_HASH` (a belépő kulcs SHA-256-ja; **több hash is megadható** vesszővel/szóközzel elválasztva, ilyenkor mindegyik érvényes: lásd „Kulcscsere”), `SIMPLESMS_FELHASZNALO` (`ferraj@gmail.com`: a SimpleSMS „Felhasználó” oszlopa, NEM a „Felhasználó neve”), `SIMPLESMS_DOMAIN` (`mosaicheadspa.hu`), D1: `LIFECYCLE_DB` (eles: `mosaic-lifecycle`, előnézet: `mosaic-lifecycle-elonezet`).
Titkok (Cloudflare, Secret, **Production és Preview külön**): `SIMPLESMS_JELSZO` (a SimpleSMS API-jelszó), `SMTP_PASS` (meglévő). A belépő kulcs a két Zapier-láncban van beágyazva (a repóban csak a hash-e).
Munkatársi értesítők (DECISION #117): `LIFECYCLE_MUNKATARS_MOD` (`ki` | `figyel` alap | `be`), `LIFECYCLE_ELO_ELLENORZES` (`ki` kikapcsolja a kiküldés előtti Salonic-oldal ellenőrzést; alapból be), `LIFECYCLE_NOSHOW_AUTO` (`1` = a régi, törlésből induló automatikus no-show; alapból ki).

**Kulcscsere leállás nélkül** (a kulcs értékét sehová nem írjuk le, csak a SHA-256-ját):
1. Az új kulcsot a tulajdonos oldala a Zapier Storage-ba teszi (`lifecycle_kulcs`), a SHA-256-ját megadja.
2. A `wrangler.toml`-ban (`[vars]` és `[env.preview.vars]`) a régi hash mellé kerül az új: `LIFECYCLE_KULCS_HASH = "<régi>,<új>"`; telepítés (merge).
3. A `lifecycle-bejovo` és a `lifecycle-tick` Zap átáll az új kulcsra (olvasás a Storage-ból), és egy tick-futás igazolja.
4. A régi hash kikerül a `wrangler.toml`-ból; telepítés. Ettől a régi kulcs érvénytelen.
Opcionális: `LIFECYCLE_SZALON_EMAIL` (alap: mosaicheadspa@gmail.com), `LIFECYCLE_TESZT_EMAIL`, `LIFECYCLE_TESZT_TELEFON`, `LIFECYCLE_NAPI_PLAFON` (alap 300 befogadott levél / nap; egy foglalás 2 levél), `LIFECYCLE_SMS_KUSZOB` (alacsony egyenleg-riasztás, alap 3000), `LIFECYCLE_BASE_URL`.
Zapier: `lifecycle-bejovo` (id `01a1168a-afbf-7ee9-94c3-6e5be524b6be`) és `lifecycle-tick` (id `01a1169c-7353-708d-8801-912e783e8424`); a **cél-cím** (`CEL`) a kódjukban van: előnézet → éles átállásnál új verzióban `https://www.mosaicheadspa.hu`-ra kell átírni. A sandbox csak engedélyezett hosztokat ér el, ezért a hívás a „Webhooks by Zapier” (custom request) akción megy.

## Üzem

- Állapot (személyes adat nélkül): `GET /api/lifecycle/allapot` + `x-lifecycle-kulcs` fejléc.
- SMS-egyenleg: naponta egyszer ellenőrzi; a küszöb alatt e-mail megy a szalonnak.
- SimpleSMS-kapcsolat ellenőrzése (jelszó nem látszik): `POST /api/lifecycle/sms-proba` (kulcsos) → `{eredmeny:[{ok, uzenet}], egyenleg}`. Hiba esetén a `felhasznalok: ["…"]` tömbbel több felhasználónév-jelölt is kipróbálható.
- Időszimuláció (csak `teszt` / `ki` módban): a `tick` / `bejovo` kérés törzsében `{"most": <epoch mp>}` a „mostot” felülírja (a T-72 / T-24 / tartalmi üzenetek próbájához). Élesben mindig a valódi idő számít.
- Adatvédelem: a foglalás személyes adatai (név, telefon, e-mail) az időpont után **60 nappal törlődnek** (napi karbantartás); a tranzakciós üzenetekhez nem kell marketing-hozzájárulás.
- Régi, generikus Salonic T-48 e-mail emlékeztetők: élesítéskor a Salonicban ki kell kapcsolni (különben az új T-72 / T-24 lánccal párhuzamosan mennek).
- Napi 300 befogadott levélnél (és a napi SimpleSMS-egyenleg-riasztásnál) kisebb a visszaélés kockázata is: a belépő kulcs ismerete nélkül nincs hívható végpont.

## Tesztek

```
node --test tools/lifecycle-teszt/motor.test.mjs tools/lifecycle-teszt/katalog.test.mjs
```
Értelmező (3 értesítő-típus, összeragadt cimkék, HTML), időkezelés (nyári/téli idő, magyar dátum, ragozás), ütemező (lead-time), kirajzolás (minden üzenet minden szegmensre), motor (befogadás, küldés, ismétlődés / egyidejű levelek, áthelyezés, lemondás, T-72/T-24, hibák), HTTP.
Valódi próba: `tools/meres-proba/reteg-foglalas.mjs` (valódi próbafoglalás, „TESZT – Claude”), lemondás: `lemond.mjs`.

## Minta-levelek (az e-mailek formázásához)

`tools/lifecycle-teszt/minta-levelek.mjs` az összes e-mail-sablonból (20 tartalmi / T0 / T-72 e-mail, lemondás, no-show = 22 db) egy-egy mintafoglalást készít a `deakfi@grantis.hu` címre (`MINTA_EMAIL` környezeti változóval átírható).
A levél a **valódi úton** megy ki (SMTP, az üzletág neve a feladó), ugyanazzal a HTML-lel, mint a vendégeknek – a Gmail-eszközzel (MCP) **nem** szabad küldeni: az a háttérszíneket kiszedi, a fejléc és a gomb láthatatlan lesz.

1. `node tools/lifecycle-teszt/minta-levelek.mjs [AZONOSÍTÓ,AZONOSÍTÓ] > minta.sql` (lista nélkül mind a 22; pl. `PMU-EMAIL-01,COMMON-NOSHOW-EMAIL`)
2. A kimenet két SQL-utasítás (a `-- ketto` sor választja el): futtasd az **előnézeti** D1-en (`mosaic-lifecycle-elonezet`).
3. Indítsd el a Zapier `lifecycle-tick` folyamatot (vagy várd az órás futást): kiviszi a leveleket. Figyelem: a tick az előnézeti adatbázis **minden** esedékes teszt-vendég üzenetét kiküldi.
4. Takarítás: `DELETE FROM kuldesek WHERE foglalas_id LIKE 'MINTA-%'; DELETE FROM foglalasok WHERE id LIKE 'MINTA-%';`

A mintában a foglalás dátuma 2026-10-28 16:00, a vendég „Ferenc”; a „Foglalás megtekintése” gomb link-je minta-azonosítóra mutat (nem létező foglalás).
