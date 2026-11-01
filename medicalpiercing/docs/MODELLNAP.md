# Modellkereső napok (ingyenes piercing, oktatási gyakorlónap) – saját foglaló

A tulajdonos kérése (2026-11-01): **2026. nov. 25. (szerda, 2 piercer)** és **nov. 30. (hétfő, 3 piercer)**, budapesti szalon (1137 Budapest, Újpesti rakpart 7., 5. em. 25.).
A modell ingyen kap piercinget és ékszert (az ékszert megtartja). Ez **oktatási gyakorlónap (workshop), nem vizsga**: vidéki piercerek gyakorolnak **Kovács Richárd felügyelete mellett**.
Öt típus: szemöldök, orr, ajak, köldök, rook. A gyakorlás 10:00-kor indul. Rólunk nem készül fotó / videó. Az ingyenes kontroll a megszokott módon online foglalható.

## Mi van benne
| Mi | Hol |
|---|---|
| Nyitóoldal + foglaló (rejtett: noindex, nincs a sitemapben, semmi nem linkel rá) | `/modellnap` (`uj-oldalak/sajat/modellnap.html`, `assets/css/uj-modell.css`, `assets/js/uj-modell.js`) |
| „A foglalásod” oldal (megerősítés, lemondás, várólistás ajánlat elfogadása) | `/mf/<kód>` (`lib/modell/vegpont.js` `foglalasOldal`) |
| JSON API | `/api/modell/szabad`, `foglal`, `varolista`, `foglalas`, `muvelet`, kulcsos: `admin`, `tick` (`functions/api/modell/[[akcio]].js` → `lib/modell/vegpont.js`) |
| Beosztás (napok, idősávok) | `lib/modell/beosztas.js` |
| Tárolás + szabályok (D1) | `lib/modell/tarolo.js` (táblák: `modell_foglalas`, `modell_uzenet`, `modell_varolista`, `modell_beallitas`; az első használatkor jönnek létre) |
| Levelek (visszaigazoló, megerősítő kérés, emlékeztető, lemondó, felszabadult, várólistás ajánlat) | `lib/modell/levelek.js` |
| Teszt | `node tools/modell-teszt.mjs` (D1 helyett `node:sqlite`: `tools/modell-d1.mjs`) |

## Idősávok
Egy piercer 120 perc alatt 5 szúrást végez (mind az 5 típusból egyet), 24 perc / szúrás, 10:00-tól: 10:00, 10:24, 10:48, 11:12, 11:36. A piercerek eltolva kezdenek (az i. szúrásnál a (i + k) % 5. típus), így ugyanabban az időben nem ugyanazt a típust szúrják.
Minden szúráshoz **két foglalás** tartozik: elsődleges (a szúrás kezdete) és **tartalék** (+12 perc). A tartalék csak akkor foglalható / látszik, ha az elsődleges már foglalt, és külön tudomásulvételt kér (várhat). Valós hely: nov. 25.: 10, nov. 30.: 15.
**Érkezés = a foglalt időpont – 30 perc** (a tulajdonos döntése, 2026-11-01).
Ha az elsődleges és a tartalék vendég is megjelenik, **mindkettőt megszúrjuk** (a tartalék várhat; ezt a foglaláskor külön tudomásul veszi).
Egy sávot az adatbázis részleges egyedi indexe (`modell_hely`) véd: két egyidejű foglalásból csak az egyik sikerül.

## Kapcsolók és környezetek
- `MODELL_FOGLALAS` (`wrangler.toml` `[vars]`): `"be"` = az **éles** (`www.medicalpiercing.hu`) foglalás nyitva (**2026-11-01 óta, a tulajdonos kifejezett kérésére**; valódi vendégeknek mennek a levelek); `"ki"` = zárva („hamarosan indul”). A nap után (nov. 30.) állítsd `"ki"`-re.
- `MODELL_FELSZABADITAS`: `"be"` esetén a szúrás előtt 12 órával sem megerősített foglalás felszabadul (és a várólistás kapja). Alap: `"ki"`.
- Előnézeten (`*.pages.dev`) és helyben a foglalás mindig megy, de a sorok `kornyezet = 'elonezet'` jelűek: nem foglalnak helyet az éles sávokból, és **levél soha nem megy ki** róluk. Az éles és az előnézet ugyanazt az adatbázist használja (`MP_MERES_DB`, `mp-meres`; a fiók D1-kerete betelt).
- Levélküldés: a projekt Gmail-fiókja (`SMTP_USER` / titkos `SMTP_PASS`), mint a többi MP-levél.

## Időzített teendők (nincs cron)
A projektben nincs ütemező, ezért a `tick` (lejárt várólistás ajánlatok, kapcsolható felszabadítás, esedékes levelek kiküldése, adattörlés) **a látogatók kéréséből** fut (legfeljebb 5 percenként, csak az éles környezetben és SMTP-vel), illetve kulcsosan:
`POST /api/modell/tick` fejléc: `x-mp-kulcs: <MP_MERES_ADMIN_KULCS>`. Pontosabb időzítéshez órás Zapier-hívás is köthető (a tulajdonos jóváhagyásával).
Admin összesítés (személyes adat nélkül): `GET /api/modell/admin` ugyanazzal a kulccsal.

## Várólista
Betelt típusra a vendég feliratkozhat (nap szerint vagy bármelyik napra). Ha hely szabadul fel (lemondás, felszabadítás, lejárt ajánlat), az első megfelelő várólistás **30 percig tartott helyet** kap e-mailben (`/mf/<kód>` → „Elfogadom”). Ha nem fogadja el, a hely a következőé.

## Adatok
Név, e-mail, telefon: csak a foglaláshoz. A `tick` az utolsó nap (nov. 30.) után **30 nappal** minden `modell_*` sort töröl (`adatTorles`); az űrlap is ezt ígéri. A `tick`-et addig is érdemes kézzel lefuttatni (admin kulcs), ha nem jár látogató.

## Élesítés előtt (ellenőrzőlista)
1. ~~A tulajdonos jóváhagyja a szövegeket és a feltételezéseket.~~ Megtörtént (2026-11-01).
2. Ékszerfotók és az ajak / orr típusa (a tulajdonos később adja meg): a „Fotókat hamarosan” sorok frissülnek.
3. ~~`MODELL_FOGLALAS = "be"`, merge, éles próbafoglalás és lemondás.~~ Megtörtént (2026-11-01).
4. A nap után: `MODELL_FOGLALAS = "ki"`, és a személyes adatok törlése (`/api/modell/tick`, 30 nap után automatikus).

## Döntések és nyitott pontok
- Érkezés a saját idősáv előtt 30 perccel (döntés, 2026-11-01). Ha az elsődleges és a tartalék vendég is megjelenik, mindkettőt megszúrjuk (döntés).
- Személyi igazolványt nem kérünk. A nyilatkozatot a szalon e-mailben küldi (nem része a foglalónak; a levelek és az oldal ezt jelzik).
- **Nyitott:** az ajak- és orrpiercing pontos típusa, a rook füle és az ékszerfotók (a tulajdonos később adja meg); késés szabálya nincs rögzítve; nincs SMS; nincs mérőkód / eseménykövetés a foglalón (külön jóváhagyás kell).
