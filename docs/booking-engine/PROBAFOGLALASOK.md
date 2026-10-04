# Próbafoglalások – éles, rejtett foglaló (2026-10-03)

Négy valódi próbafoglalás a **rejtett `/foglalo-motor` oldalról**, az éles tartományon (`www.mosaicheadspa.hu`), a jóváhagyott feltételekkel. A hirdetési mérés kódján nem változtattunk: a foglaló sikeres foglalás után a **meglévő köszönőoldalt** nyitja meg ugyanazokkal a paraméterekkel, így a mérés úgy fut, mint a Salonic saját átirányításánál.

- Beírt név: vezetéknév „TESZT –”, keresztnév „Claude”. E-mail: `deakfi@grantis.hu` (a Gmail-összekötő ezt a fiókot éri el, ezért ezt a címet választotta a tulajdonos). Telefon: +36 70 942 0090.
- A Salonic-feltételt (adatvédelmi tájékoztató és foglalási szabályzat) bepipáltuk, a hírlevelet **nem**. Süti-sáv: a saját oldalunkon „Elfogadom”.
- reCAPTCHA-kihívás **egyiknél sem** jött.
- **Lemondás:** a tulajdonos jóváhagyásával 2026-10-03 20:05 körül mind a négy foglalást lemondtuk a visszaigazoló e-mail „Lemondom” linkjével (lemondás oka: „Próbafoglalás (TESZT), lemondva”); a Salonic mindegyiknél kiírta: „Az időpont lemondása sikeres volt!”. A vendégkartonokat **nem** töröltük.

**Második kör (mérés-ellenőrzés, 2026-10-03 este):** három további valódi próbafoglalás automatizált böngészővel, a kimenő mérési kérések letiltásával és naplózásával (fodrászat-konzultáció 21:07, oxigén 2. alkalom 21:10, lézer fizetős 21:12; mind lemondva), lásd [MERES_ELLENORZES.md](MERES_ELLENORZES.md).

## Lista

| # | Üzletág | Szolgáltatás | Küldés ideje (perc) | Foglalt időpont | Foglalás-azonosító (Salonic) | Tranzakcióazonosító (köszönőoldal) | Köszönőoldal |
|---|---|---|---|---|---|---|---|
| 1 | HeadSpa | Egyéni „Relax” HeadSpa (26 900 Ft) | 2026-10-03 19:38 | **2026-10-30 (péntek) 17:30–18:50** | `g:2038420` | `hs-2038420-302342-1793377800` | `/success-foglalas-egyeni` |
| 2 | Oxigén | Haj Oxigénterápia, 1. alkalom (29 900 Ft) | 2026-10-03 19:41 | **2026-10-21 (szerda) 17:00–18:20**, Menyhárt Móni | `g:3385031` | `oxigenterapi-3385031-466110-1792594800` | `/oxigenterapia-ok` |
| 3 | Fodrászat | Fodrász konzultáció (ingyenes) | 2026-10-03 19:47 | **2026-10-22 (csütörtök) 15:00–15:30**, Noel | `g:3385039` | `fodraszok-3385039-232804-1792674000` | `/fodrasz-ok` |
| 4 | Lézer | Ingyenes konzultáció (Elysion-fiók) | 2026-10-03 19:48 | **2026-10-23 (péntek) 14:30–15:00** | `g:3353226` | `elysionok-3353226-476477-1792758600` | `/elysion-ok` |

Nem küldött, magától lejárt (5 perces tartás) űrlapok: HeadSpa okt. 30. 19:00 és Fodrászat okt. 22. 15:30. Ezekből **nem lett foglalás**.

## Ellenőrzés próbánként

Minden próbánál: a konverziók egyetlen köszönőoldal-betöltésen (nem újratöltve), a böngésző hálózati naplójából.

| # | Google Ads | GA4 / stape (Google) | Meta | TikTok | E-mail | Köszönőoldal |
|---|---|---|---|---|---|---|
| 1 HeadSpa | 2 konverziós címke, mindegyik 1×, 26 900 HUF | `ads_conversion_Egy_b_Oldalbet_lt_s_www_1` 1×, `ads_conversion_Id_pont_foglal_sa_Oldal_2` 1×, `foglalas_ajikartya_ga4` 1× | `CompleteRegistration` 1×, `Schedule` 1×, `PageView` 1× (+ CAPI) | pixel 1× betöltött, 1 esemény-köteg | megjött 19:38, de a megszólítás „**Deák Ferenc István**” | betöltött |
| 2 Oxigén | 1 címke 1×, 29 900 HUF | `Oxigén_foglalás` 1×, `oxygen_headspa_first_appointment` 1× | `SubmitApplication` 1×, `Oxigen_FoglalasElso` 1×, `PageView` 1× (+ CAPI) | pixel 1×, 1 esemény-köteg | megjött 19:41, „TESZT – Claude” | betöltött |
| 3 Fodrászat | 1 címke 1×, **13 000 HUF** (a konzultáció ára 0) | `ads_conversion_Fodrasz_Foglalas_1` 1×, `hair_book_appointment_first` 1× | `Schedule` 1×, `Fodrasz_Konzultacio` 1×, `PageView` 1× (+ CAPI) | pixel 1×, 1 esemény-köteg | megjött 19:47, „TESZT – Claude” | betöltött |
| 4 Lézer | 2 címke, mindegyik 1× (0 és 27 000 HUF) | `Szörtelenités_elysion_ok` 1×, `elysion_ok` 1× | `Schedule` 1×, `Szor_Konzultacio` 1×, `PageView` 1× (+ CAPI) | pixel 1×, 1 esemény-köteg | megjött 19:48, „**teszt teszt**” | betöltött |

A Google-címkék a böngészőben három csatornán (`pagead/conversion`, `ccm/conversion`, `viewthroughconversion`) mennek ki, ugyanazzal az esemény-azonosítóval; ez a Google-címke szokásos működése, nem dupla konverzió.

## Eltérések és megfigyelések

1. **A vendégnév nem mindenhol „TESZT – Claude”.** A Salonic a foglalást a meglévő vendégkartonhoz köti, ha az e-mail vagy a telefonszám egyezik: a HeadSpa-fiókban „Deák Ferenc István”, a lézeres Elysion-fiókban „teszt teszt” karton volt. Oxigénnél és Fodrászatnál új, „TESZT – Claude” nevű vendég jött létre. A foglalások lemondva, de a Salonic-adminban a négy időpontot az időpont alapján lehet megtalálni (lásd a listát), nem a név alapján.
2. **TikTok:** az esemény neve a pixel kérésének törzsében utazik, ezért kívülről nem látszik. Mért tény: a pixel egyszer töltött be, és egyetlen esemény-köteg (`/api/v2/pixel/act`) ment el. A pontos eseménynév a TikTok Events Managerben ellenőrizhető.
3. **Fodrászat, Google-érték:** a 0 Ft-os konzultáció 13 000 HUF értékkel megy a Google Adsbe. Ez a mostani (meglévő) mérés beállítása, nem a foglalóé; érdemes átnézni, szándékos-e.
4. **Kósza konverzió a mérésben:** a deploy utáni ellenőrzés során a `/success-foglalas` köszönőoldalt paraméterek nélkül töltöttem be. Kiderült, hogy ez az oldal süti-hozzájárulás nélkül is elsüti a Meta- és a stape-eseményeket (`CompleteRegistration`, `Schedule`, `ads_conversion_*`, `foglalas_ajikartya_ga4`, Google-hozzájárulás „denied” módban). Ez a mostani éles működés, nem a változtatásunk, de az én betöltésem egy paraméter nélküli, kósza konverziót küldött.
5. **Salonic „Egyedi CSS URL”:** a beágyazott űrlap a próbák idején még a Salonic alapkinézetében látszott (Facebook-belépő gombbal). A `mosaic.css` beállítása a fiókokban még a tulajdonos teendője; a foglaló mindkét kinézettel működik.

## Teendők a próbák után

- A négy próbaidőpont lemondva (lásd fent); a szalon, ha tisztán akarja tartani, a Salonic-adminban a lemondott „Deák Ferenc István” (HeadSpa), „TESZT – Claude” (Oxigén, Fodrászat) és „teszt teszt” (Elysion) bejegyzéseket megtalálja; a vendégkartonok maradtak.
- A próbaszám (tisztázva 2026-10-03): a próbafoglalásokhoz a tulajdonos saját telefonszámát (+36 70 942 0090) adtuk meg; az átkapcsolás után a próbákhoz (és minden további teszthez) a **szalon** számát kell megadni: 06 20 247 4444. A vendégeknek szóló helyeken (motor, hibaüzenetek, levelek, PMU-foglaló) a kódban már most a szalon száma áll; a tulajdonos száma csak a mérő-szkript próbaadataiban és ezekben a naplókban szerepel. A `meres-proba.mjs` alapértelmezett próbaszáma ezért a szalon száma (`MERES_TELEFON` környezeti változóval felülírható). A már létrejött Salonic-vendégkartonokon (TESZT – Claude, teszt teszt, a HeadSpa-nál a meglévő karton) a régi szám marad, amíg valaki a Salonic adminban át nem írja.

## Harmadik kör – az élesítés (PR #114) végigfutó tesztjei (2026-10-04 késő este – 2026-10-05 éjfél után)

Nyolc valódi próbafoglalás az **új úton** (hirdetés-kattintás utánzata → tartalmi oldal → gomb → felugró foglaló → Salonic → köszönőoldal; az „oxigén régi oldal” sorok: a régi `/mosaic-hair-idopontfoglalas` oldal, ahol a foglaló magától, bezárhatatlanul nyílik). Kimenő böngésző-mérés letiltva. **Mind a nyolc lemondva és ellenőrizve** (a Salonic „Foglalás részletei” oldala: „Időpont törölve!”). A mérési eredmény és az összevetés: [meres-naplo/eles-popup-valodi-osszefoglalo-2026-10-04.txt](meres-naplo/eles-popup-valodi-osszefoglalo-2026-10-04.txt); a szerveroldali (Zapier) események: [meres-naplo/eles-popup-probafoglalasok-es-szerveroldali-meres-2026-10-05.txt](meres-naplo/eles-popup-probafoglalasok-es-szerveroldali-meres-2026-10-05.txt).

| # | Foglalás ideje (helyi) | Üzletág – szolgáltatás (vendégnév) | Foglalt időpont | Salonic foglalás-azonosító | Tranzakcióazonosító |
|---|---|---|---|---|---|
| 1 | 10-04 23:43 | HeadSpa Egyéni „Relax” (**kartonról: Deák Ferenc István**) | 2026-10-31 (szo) 17:30–18:50 | `85ebd7de-61c6-79fa-d1c5-c9303082fb23` | `hs-2038420-302342-1793464200` |
| 2 | 10-04 23:43 | Fodrász konzultáció (TESZT – Claude) | 2026-10-30 (pé) 11:00–11:30 | `49afb32c-58e3-df95-c712-5303deaa6f3d` | `fodraszok-3385039-232804-1793354400` |
| 3 | 10-04 23:44 | Lézer ingyenes konzultáció, régi tartalmi oldalról (teszt teszt) | 2026-10-31 (szo) 18:00–18:30 | `c1d5fd84-2643-9bc1-a1c1-fdf406f54cbe` | `elysionok-3353226-476477-1793466000` |
| 4 | 10-04 23:45 | Oxigén „2. alkalomtól” (TESZT – Claude) | 2026-10-30 (pé) 12:30–13:50 | `5493c6bf-1792-1639-068e-c75f5ef7438a` | `oxigenterapi-3385031-466158-1793359800` |
| 5 | 10-04 23:45 | Oxigén „2. alkalomtól”, a régi hirdetési oldalról (TESZT – Claude) | 2026-10-23 (pé) 12:30–13:50 | `758cbcee-1353-eca9-4e86-2dcfb22a7ae6` | `oxigenterapi-3385031-466158-1792751400` |
| 6 | 10-05 00:06 | Oxigén „2. alkalomtól”, régi oldal, kontroll (TESZT – Claude) | 2026-10-30 (pé) 16:00–17:20 | `d9931433-da31-e2c6-9b36-5a0fb6d5c632` | `oxigenterapi-3385031-466158-1793372400` |
| 7 | 10-05 00:23 | Oxigén AKCIÓS Hajkamerás vizsgálat (4 990 Ft), új landingről (TESZT – Claude) | 2026-10-30 (pé) 16:30–17:00 | `5b5030e5-7f87-3bd3-8adb-908ff0dfcd94` | `oxigenterapi-3385031-466147-1793374200` |
| 8 | 10-05 00:24 | Lézer ingyenes konzultáció, új landingről (teszt teszt) | 2026-10-31 (szo) 18:30–19:00 | `4ac2550e-df13-8620-6f70-b360620ec331` | `elysionok-3353226-476477-1793467800` (azonos a 10-04-i #117 lista 14. sorával: a tranzakcióazonosító az időpontból képződik) |

**Szerveroldali szivárgás:** a #1 HeadSpa-foglalás (valódi karton, a név nem „teszt”) **kiküldött 1 Meta „Contact” (event_id = a fenti foglalás-azonosító) és 1 TikTok szerveres eseményt (event_id `mail-85ebd7de-…`, érték 0)**; Google Ads: semmi. A többi hét foglalásnál a Zapier „teszt” név-védelme működött. Részletek, Zapier-futás-azonosítók: a fenti szerveroldali napló.
