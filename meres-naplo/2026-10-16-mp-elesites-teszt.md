# Medical Piercing – az új oldal élesítése a régi helyén – teszt-napló (2026-10-16)

A tulajdonos kérése: „csinálnál egy végső ellenőrzést, végigkattintgatnál, minden működik-e. A mérőkódok benne vannak-e, köszönő oldalak rendben vannak-e. És hogyha
minden rendben van … tedd élesbe ezt az oldalt. Cseréld le az eredeti oldallal. És utána is csinálj egy ellenőrzést.”

Helyben, a végleges buildre (`node tools/build.mjs`, `node tools/serve.mjs`), élesített kapcsolóval (`lib/uj-eles.js`: `UJ_ELES = true`). A mérőtesztek a helyi kiszolgálót
`www.medicalpiercing.hu` néven nyitják meg (a mérőkódok így betöltenek), minden adatküldő kérést elkapnak és eldobnak; a Salonic felé csak olvasó GET megy, foglalás nem indult.

## MÉRÉST ÉRINT – mi változik
- Az eredeti címeken (`/`, `/migren-piercing`, …) az új dizájnú oldal van, **ugyanazzal a mérőkóddal**: `suti.js` (GTM, Consent Mode, GA4, Google Ads, Meta, TikTok, Convertize),
  `mp-meres.js` (köszönőoldali foglalásmérés, gclid-pótlás), `motor-indito.js` (foglalómotor). A mérőkód fájljai **nem változtak** (`suti.js`, `mp-meres.js`, `motor-indito.js`,
  `salonic-adapter.js`, `booking-id.js`).
- A köszönőoldalak (`/foglalas-ok*`, `/fulbevalo-ok*`) a régi címükön, új dizájnnal; a logika a régi: a cím `?mert=1`-re tisztul, a Meta-pixel ki, a foglalómotor ott nem tölt be.
- A foglalásindítás mérése (TikTok InitiateCheckout + GA4 `foglalas_inditasa`): Salonic-linkre kattintáskor (változatlan); az új oldalak gombjai többnyire belső linkek
  (`/idopontfoglalas`), ott a foglaló „Új piercing” választásakor fut ugyanaz az esemény, egyszer (ez a régi oldal `/idopontfoglalas` gombjainak útja is volt).
- A régi (Wix-klón) oldalak a `/regi/...` címen maradnak (noindex), az `/uj/...` címek 301-gyel az eredetire visznek (a paraméterek – utm, gclid, fbclid – maradnak).
- Külső fiókban (GTM, GA, Google Ads, Meta, TikTok, Convertize, Salonic) semmi nem változott. A Convertize-kísérlet a `-b` címeken most a B-dizájnú új oldalt kapja.
- Vendégadat sehova nem került; a tesztek mockolt végpontokkal futnak.

**Visszaállítás:** `UJ_ELES = false` (`lib/uj-eles.js`), push + merge → a régi oldalak vissza az eredeti címekre, az új a `/uj/...` alá, rejtve.

## Eredmények (helyben, élesített állapot)
| Teszt | Eredmény |
|---|---|
| `tools/uj-oldalak-teszt.mjs` (mind, az eredeti címeken, a `/regi/...` régi oldalhoz hasonlítva) | 174 oldal, 5552 ellenőrzés: az első élesített futáson 86 hiba – mind tesztfeltevés (köszönőoldal, „Árak” link, `-b` oldalak, lásd lent); javítva, újrafuttatva 1 egyszeri hiba (lásd lent) |
| `tools/uj-oldalak-teszt.mjs --forras` | 1049 ellenőrzés, 0 hiba |
| `tools/uj-fooldal-teszt.mjs` (SEO-fej: indexelhető, canonical, og, ld+json, domainigazolások) | minden rendben (helyben és a PR-előnézeten is) |
| `tools/meres-teszt.mjs` (mérőkódok az új oldalakon, csak az éles domainen) | Minden rendben |
| `tools/koszono-tisztitas-pw.mjs` (köszönőoldalak: címtisztítás, egyszeri mérés) | MIND PASS |
| `tools/mp-meres-pw.mjs` (köszönőoldali foglalásmérés, mockolt végpont) | OK |
| `tools/gclid-atvitel-pw.mjs` | MIND PASS; 8 pont kihagyva (lásd lent) |
| `tools/sav-teszt.mjs` / `--mobil` (süti-sáv a tesztoldalon, Consent Mode, Meta / TikTok / Convertize csak hozzájárulással) | minden rendben |
| `tools/motor-teszt.mjs` / `--mobil` | minden rendben (az első futáson 1 + 2 tesztfeltevés-hiba, lásd lent) |
| `tools/motor-formazas-teszt.mjs` | minden rendben |
| `tools/motor-tipus-teszt.mjs` / `--mobil` | minden rendben (a J pont igazítva, lásd lent) |
| `tools/funkcio-teszt.mjs` a régi oldalakon (`HELYI=…/regi`) | 3 hiba, mind a `/regi` előtag miatt: a régi lapok szkriptje a menü aktuális pontját és a városlapozót az eredeti címhez méri (az archív régi lapokon nem számít; a vendég az új oldalt kapja) |
| PR-előnézet (`claude-medicalpiercing-cloud.medicalpiercing.pages.dev`) | `uj-fooldal-teszt`: minden rendben; `uj-oldalak-teszt --gyors`: 19 oldal, 666 ellenőrzés, 0 hiba; útvonalak, 404, sitemap (138 cím, `/regi` és `/uj` nélkül) rendben |
| Szemrevételezés (asztali 1440, iPhone 13) | `/foglalas-ok-mi` → `/foglalas-ok?…&mert=1`, új dizájn, köszönő szöveg (HU/DE); `/fulbevalo-ok`; 404; a mérőszkriptek (suti, mp-meres, motor-indito) minden lapon |
| Útvonalak (`curl`) | `/uj/migren-piercing?utm_source=x` → 301 `/migren-piercing?utm_source=x`; `/uj-fooldal`, `/uj` → 301 `/`; `/regi`, `/regi/migren-piercing` 200; nem létező cím 404 (új 404-oldal); sitemap 138 cím, `/regi` és `/uj` nélkül |

## A tesztek igazítása (nem a kód hibája)
- **gclid-atvitel-pw:** a jelenlegi éles (main) változaton is ugyanez a 8 pont bukott (2a, 3c, 4a, 4c, 4d, 7a, 7b, 9): ezek a „döntés előtti” állapotra épülnek, ami a süti-sáv
  kikapcsolása (`SAV_KI`, Feri döntése, 2026-10-13) óta nincs – az alapállapot az elfogadott „t0” süti. A teszt most felismeri ezt, és ezeket jelölten kihagyja (a sáv visszakapcsolásakor újra futnak).
- **sav-teszt:** a sáv 2026-10-14 óta csak a tesztoldalon jelenik meg (`/shenmen-piercing-ezt-tedd-ha-begyulladt`); a teszt eddig egy másik oldalon várta (a main-en is bukott).
  Most a `suti.js` tesztoldalán fut; a mobil-ellenőrzés az új fejlécet is ismeri; a nagyobb (első) doboz 8 px-re van az aljától (#280, szándékos).
- **uj-oldalak-teszt:** élesítve a köszönőoldalakon a foglalómotor szándékosan nem tölt be (a régi oldalon is így), ott ezt ellenőrzi; az „Árak” menü az eredeti címre mutat;
  a `-b` címek az eredeti `-b` oldalhoz hasonlítanak.
- **motor-teszt:** kikapcsolt motornál (`?motor=0`) az új oldal belső foglalás-gombja a régi köztes oldalra visz (`/regi-idopontfoglalas`, Salonic-linkekkel) – ez a régi út;
  az új mobil lap eleve eszközszélességű (a régi 320 px-es volt), ott nincs mit átállítani.
- **motor-tipus (J):** az új főoldal foglalás-linkje ugyanabban a lapban nyílik (a régi új lapon nyitotta); kikapcsolt motornál a régi köztes oldalra visz.
- **motor-formazas / motor-tipus (E):** a Salonic-linkes eset a `/migren` lapon fut (a régi és az új dizájnban is van általános Salonic-link; az új blogcikkekben a gomb belső link).
- Egy egyszeri hiba: a teljes futásban a Gabi története oldal 768 px-en vízszintes görgetést mutatott a videósávnál; négyszer újrafuttatva (párhuzamosan más oldalakkal is) nem jött elő.

## Megfigyelés (nem az élesítés okozza, a régi oldalon is így van)
A köszönőoldal paraméterei (`price`, `first_booking`, `mert=1`) a munkamenet-paraméterek közé kerülnek (`savedQueryParams`, `klon.js` 8. – a Wix viselkedésének mása), így a köszönőoldal
után megnyitott lapok címében is ott vannak (pl. `/rolunk?price=…&mert=1`). A main (régi oldalak) ugyanígy viselkedik (helyben ellenőrizve). A következő foglalás mérését nem akadályozza
(a köszönőoldal a saját, eredeti címét olvassa a mérés előtt). Mérést érintő javítás, ezért nem ebben a PR-ben: külön körben, a mérési oldallal egyeztetve.

## Élesítés után (az éles oldalon, könnyű, egyszeri ellenőrzés)
A [Brinuti/mosaic#354](https://github.com/Brinuti/mosaic/pull/354) merge-e (f328319) után, a https://www.medicalpiercing.hu oldalon:
- `curl`, asztali + iPhone UA, 20 cím: mindenhol az új dizájn a régi SEO-fejjel (canonical az eredeti cím; `noindex` csak ahol a régin is volt), mind a 3 mérőszkript betölt;
  köszönőoldalak 200, új dizájn, `noindex`; `/regi`, `/regi/migren-piercing` 200, `noindex,nofollow` + `X-Robots-Tag`; `/uj/migren-piercing?utm_source=teszt` → 301 `/migren-piercing?utm_source=teszt`,
  `/uj-fooldal`, `/uj` → 301 `/`; nem létező cím 404 (új 404-oldal); sitemap 138 cím, `/regi` / `/uj` nélkül; a főoldalon Google- és Facebook-domainigazolás, 3 ld+json, 8 og-címke.
- Böngésző (a mérőkérések blokkolva): `uj-fooldal-teszt` minden rendben; `uj-oldalak-teszt --oldal=/migren-piercing,/elerhetosegek,/blog` 109 ellenőrzés, 0 hiba.
- A köszönőoldalt élesben böngészővel szándékosan nem nyitottuk meg (a `/api/mp-foglalas` valódi konverziót küldene); valódi foglalás nem indult.
