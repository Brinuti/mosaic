# Munkatárs-foglaló linkek (`?staff=`)

A foglaló linkjével **egy konkrét munkatársat** is meg lehet nevezni: a vendég a szakember-választó nélkül, rögtön az ő szabad időpontjait látja.

## Hogyan működik

Bármelyik foglaló-linkhez hozzáadható a `staff=<kulcs>`:

```
/foglalo-motor?business=hair&staff=betti
/foglalo-motor?business=oxygen&staff=tundi
/foglalo-motor?business=hair&staff=noel&category=balayage     (munkatárs + kezelés-kategória)
/foglalo-motor?business=oxygen&service=466110&staff=vivien    (munkatárs + konkrét szolgáltatás)
```

- **Kulcs:** a munkatárs nevének egy szava (ékezet- és kisbetű-független: `tundi` = `Tündi`), vagy a teljes név kötőjellel (`bozsoki-harangozo-tundi`), vagy a Salonic-azonosítója. Csak egyértelmű találat számít: ha a kulcs két munkatársra is illik (pl. `moni`, ha két Móni van), a szakember-választó jelenik meg, ezért ilyenkor a lista a hosszabb kulcsot vagy az azonosítót adja.
- **Oldalgombokon / beágyazva:** `<a href="/foglalo-motor?business=hair&staff=betti">` (a gomb ugyanazon az oldalon, a rétegben nyitja a foglalót), `data-booking="business=hair&staff=betti"`, vagy `openBooking({ business: 'hair', staff: 'betti' })`. Alias: `munkatars=` és `szakember=` is jó.
- **Mi történik:** a szakember-választó kimarad, a kezelések a munkatárs kezelései közül választhatók (fodrászat), az időpont-naptár csak az ő szabad idejét mutatja, a fejlécben látszik a neve, az ár a szakemberi kedvezménnyel jelenik meg (pl. Noel 20%). A vendég a naptárban továbbra is válthat „Bármely szakember"-re.
- **Ha a munkatárs nem található** (elírt kulcs, vagy a következő 14 napban nincs szabad ideje): a szakember-választó jelenik meg, egy rövid megjegyzéssel. Hibaüzenet nincs, a foglalás nem akad el.
- **Új munkatárs:** nem kell kódot módosítani. Amint a Salonic-ban foglalható (van szabad időpontja), a neve alapján működik a kulcsa; az alábbi lista a `node tools/munkatars-linkek.mjs --md docs/booking-engine/MUNKATARS_LINKEK.md` paranccsal frissíthető (csak olvas, nem foglal). Fotó nélkül monogram jelenik meg a választóban; fotót a `flows/hair.js` / `flows/oxygen.js` `staffPhotos` listája ad.
- **Egy kezelős üzletágak:** a lézeres szőrtelenítésnél (Zsófi), a Head Spa-nál (a „munkatársak" kezelőhelyek, a vendég nem választ) és a sminktetoválásnál (Melitta, külön foglaló) nincs szakember-választó, ezért a munkatárs-link ugyanaz, mint az üzletági link (`?staff=` megadható, de nem változtat semmit). Ha később ott is több szakember lesz, a választó bekapcsolása után a `?staff=` automatikusan működik.
- **Mérés:** a szakember a linkből választódik: `booking_filter_used` (`filter: staff_link`) a régi mérési szerződésben; a GA4-be menő lépés-események (#88) nem változtak.

## Tesztek

- `node --test tools/test-booking-flow.mjs tools/test-booking-layer.mjs` (a kulcs-keresés, az ajánlott kulcs, a kontextus-átadás),
- `node tools/meres-proba/munkatars-proba.mjs` – böngészőben, a Salonic jelenlegi adataival: minden munkatárs-linkre a választó kimarad, a fejlécben a munkatárs neve látszik, a naptár az ő időpontjait mutatja; ismeretlen kulcsra a választó jelenik meg.

## A munkatársak linkjei (a Salonic aktuális adataiból)

<!-- LISTA -->
_Előállítva: 2026-10-06, a Salonic aktuális adataiból (`node tools/munkatars-linkek.mjs --md …`)._

### Fodrászat (`business=hair`)

| Munkatárs | Kulcs | Link |
|---|---|---|
| Betti | `betti` | `https://www.mosaicheadspa.hu/foglalo-motor?business=hair&staff=betti` |
| Noel (20% kedvezmény) | `noel` | `https://www.mosaicheadspa.hu/foglalo-motor?business=hair&staff=noel` |
| Evelin | `evelin` | `https://www.mosaicheadspa.hu/foglalo-motor?business=hair&staff=evelin` |

### Oxigénterápia (`business=oxygen`)

| Munkatárs | Kulcs | Link |
|---|---|---|
| Bozsoki - Harangozó Tündi | `tundi` | `https://www.mosaicheadspa.hu/foglalo-motor?business=oxygen&staff=tundi` |
| Szűcs Vivien | `vivien` | `https://www.mosaicheadspa.hu/foglalo-motor?business=oxygen&staff=vivien` |
| Menyhárt Móni | `moni` | `https://www.mosaicheadspa.hu/foglalo-motor?business=oxygen&staff=moni` |

