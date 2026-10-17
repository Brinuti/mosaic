# Intim lézeres szőrtelenítés landing (`/intim-lezeres-szortelenites-budapest`)

**Állapot (2026-10-18): DRAFT, nem élő.** Új oldal a Google Ads indulásához (hirdetés: SZ-2), a brief 1. szakasza szerint
(`MOSAIC-GOOGLE-4UZLETAG-LANDING-BRIEF-WEBES-ABLAKNAK-2026-10-17.md`, Drive: 1GFM70dymseOnkmUp4zuk4fzpaRaDyNsd). Feri kérése: új oldalakat építünk, a meglévő (élő) oldalakhoz nem nyúlunk; élesítés előtt átbeszéljük.
Az oldal **noindex** és nincs a sitemapben; egyetlen meglévő oldalt, CSS-t, JS-t sem módosít.

| Mi | Hol |
|---|---|
| oldal (egy fájl asztalira és mobilra) | `foglalas/intim-lezeres-szortelenites-budapest.html` |
| kiegészítő stílus (a `lezer-landing.css` UTÁN töltődik; a mintaoldalt nem érinti) | `assets/css/lezer-intim.css` |
| működés: mobil sticky CTA, orvosi videó kattintásra | `assets/js/lezer-intim.js` (nem mérőkód) |
| Trustindex-keret, Google-térkép | `assets/js/headspa-oldal.js` (a meglévő) |
| teszt | `tools/ujrastilus-teszt/lezer-intim.test.mjs` (14 teszt; a dist-es rész a build után fut) |

## Szerkezet (a brief szerint)
Hős (H1, alcím, ár-sáv, fő + másodlagos CTA, értékelés, hely + Térkép-link) → **A)** „Miért kérdeznek tőlünk ennyien intim kezelésről?” (3 pont + kezelőhelyiség-képek) → **B)** Árak (táblázat + 6 feltétel-sor) →
**C)** „Így zajlik az első alkalom” (4 lépés) → **D)** Felkészülés → **E)** GYIK (6 kérdés) → **F)** Bizalom (Google-értékelés, Trustindex, dr. Máté Kinga ajánlása, nem intim területű eredmények) → **G)** Férfiaknak (1 sor + link) → helyszín + záró CTA.

## Tartalom
- A hős-szöveg, az árak, a CTA-feliratok a brief szövegei. A 3 pont (A), a felkészülés (D), a GYIK-válaszok (E), az árak feltételei (B) a `/lezeres-szortelenites-budapest` oldal **szó szerinti mondatai** (a teszt mondatonként ellenőrzi); a 4 lépés (C) a férfi oldal konzultáció-leírásából és a fő oldal GYIK-jából áll össze (a teszt ellenőrzi a forrás-mondatokat).
- Az új GYIK-kérdés („Mennyire fáj intim területen?”): a fő oldal „Fáj a kezelés?” válasza + a fő oldal intim-mondata.
- **Árak:** Bikini vonal 19 000 / 114 000 Ft, Teljes intim 36 000 / 216 000 Ft, Hónalj + intim csomag 45 500 / 273 000 Ft (alkalmanként / 8 alkalmas program = 6×): **egyezik** a `/lezeres-szortelenites-budapest` árlistájával (a teszt a fő oldal `data-ar` értékeiből ellenőriz).
- **Nincs rajta (a briefben `[MEGERŐSÍTENDŐ]`):** női kezelő minden intim kezelésnél; zárt, külön kezelőszoba; az első alkalom időtartama; a szombati nyitvatartás (a lábléc / Infó-ablak is csak H–P: `<!--mh-nyitvatartas:hetkoznap-->`).
- **Képek:** intim fotó nincs, a testrészt ábrázoló illusztrációk (`lezer-ikon/*`) sincsenek. Csak: a gép + Zsófi (a fő oldal hero-ja, lábkezelés), Zsófi portré, a kezelőhelyiség, a váró, a lábszár- és arc-eredmény, az orvosi ajánló videó (a fő oldalról).

## Foglalás
Csak `/foglalo-motor` linkek: fő CTA `?business=laser&service=konzult` („Ingyenes konzultációt foglalok”), másodlagos `?business=laser` („Szabad kezelési időpontok”). A fejléc FOGLALÁS gombja, az Infó-ablak és a lábléc gombja is `business=laser`
(`<!--mh-foglalas:business=laser-->`, lásd `docs/FEJLEC_LABLEC.md`). Mérőkód / `data-cta` / `dataLayer` az oldalon nincs; a foglalót a build által feltett `booking-launcher.js` nyitja a helyben nyíló rétegben.

## Élesítés (ha Feri jóváhagyja)
1. `<meta name="robots" content="noindex, nofollow">` sor törlése az oldalból (és a fejléc-komment igazítása).
2. Sitemap: `tools/wix-sitemap/pages-sitemap.xml` bővítése az új címmel (a build ezt másolja a `dist/`-be).
3. Meta-pixel: az oldal neve (`intim-lezeres-szortelenites-budapest`) a `assets/js/suti.js` `PIXEL_SZOR` listájára (védett mérési fájl: a mérési oldal döntése) – lásd lent.
4. Élesítés után: tesztfoglalás teszt-gclid-del (`?gclid=TESZT…`), a konverzió ellenőrzése.

## Mérés-lefedettség (a helyi dist az éles hostnév alatt, kimenő mérés tiltva; foglalás nélkül)
A `?gclid=…&gbraid=…&wbraid=…&fbclid=…&ttclid=…&utm_*` paraméterekkel betöltve az oldalt (asztali + mobil, süti-döntés nélkül is):
- A **Google-címke** (GTM + gtag) betöltődik; a `_gcl_aw` süti létrejön a gclid-del (`GCL.<idő>.TESZT123gclid`); a Google Ads felé menő (tiltott) kérések tartalmazzák a gclid-et.
- Az `assets/js/attribucio.js` a `mh_attr`-ba menti a `gclid`, `gbraid`, `wbraid` értékeket (és a többit).
- A **TikTok-pixel** betöltődik. A **Meta-pixel NEM töltődik be**: a `suti.js` a pixelt oldal-listához köti (`PIXEL_OLDALAK`), az új cím nincs rajta (3. lépés fent).
- A CTA-ra kattintva a foglaló-réteg megnyílik, az oldal URL-je megtartja a kattintás-azonosítókat; a köszönőoldal-átadás (`withAttribution`) az URL-ben lévő azonosítókat a köszönőoldal URL-jének végére fűzi. Ha a látogató közben másik oldalra navigált (az URL-ből eltűnt a gclid), az átadás nem fűz hozzá semmit (a `_gcl_aw` süti és a `mh_attr` ilyenkor is megvan).
