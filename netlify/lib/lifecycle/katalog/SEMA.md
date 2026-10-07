# Lifecycle-katalógus: formátum

Egy üzletág = egy fájl (`headspa.js`, `hair.js`, `oxygen.js`, `laser.js`, `pmu.js`), amelynek alapértelmezett exportja:

```js
export default { uzletag: 'oxygen', uzenetek: [ /* Uzenet, ... */ ] };
```

**Minta:** `headspa.js` (az összes mezőtípus szerepel benne). Forrás: `MOSAIC_booking_to_show_lifecycle_2026-10-07.pdf`
(a szöveg kinyerve: `_tmp/lifecycle.txt`, az üzletág fejezete). A szöveget **szó szerint** vedd át (csak a nyilvánvaló tördelési hibát javítsd);
az üzenet-azonosítókat is (pl. `OX-SMS-01`).

## Üzenet

| mező | jelentés |
|---|---|
| `id` | a dokumentum azonosítója (`OX-SMS-01`, `OX-EMAIL-03`, `OX-CALL-01`); az üzletágon belül egyedi |
| `csatorna` | `sms` \| `email` \| `feladat` (a telefonos hívás belső e-mail a szalonnak, kit kell hívni) |
| `mikor` | lásd lent |
| `szegmensek` | (nem kötelező) a foglalásnak legalább az egyik megadott szegmens-címkével rendelkeznie kell |
| `nem_szegmensek` | (nem kötelező) ha a foglalásnak bármelyik itt felsorolt címkéje megvan, az üzenet kimarad |
| `sorrend` | `tartalom` e-maileknél a fontossági sorrend (kisebb = fontosabb); a lead-time szabály szerint csak az első N megy ki |
| `szoveg` | **SMS**: a teljes szöveg helyőrzőkkel |
| `targy`, `elotag`, `torzs` | **e-mail** / **feladat**: tárgy, preheader (`elotag`), törzs-blokkok |
| `surgos_kiegeszites` | (nem kötelező, csak `t0` e-mail) blokkok, amelyek a törzs végére kerülnek, ha a foglalás kevesebb mint 30 órával az időpont előtt jött (a kritikus előkészület ilyenkor a T0-ban megy) |

### `mikor`

- `{ tipus: 't0' }` – azonnal a foglalás után (SMS + e-mail).
- `{ tipus: 't72' }` – az időpont előtt 72 órával; csak ha a foglalás legalább 96 órával előtte történt.
- `{ tipus: 't24' }` – az időpont előtt 24 órával; csak ha a foglalás legalább 30 órával előtte történt.
- `{ tipus: 'tartalom', utan_napok: N, min_lead_nap: M }` – tartalmi e-mail N nappal a foglalás után (a "T+1..3 nap" sorokra), VAGY
  `{ tipus: 'tartalom', elott_napok: N, min_lead_nap: M }` – N nappal az időpont előtt (a "T-7..5", "T-10..7" sorokra). `min_lead_nap`: legalább ennyi nap legyen az időpontig
  (a dokumentum "5+ nap lead time", "10+ nap", "21+ nap" megjegyzései). A motor a lead-time szabály szerint (5–9 nap: 1, 10–20 nap: 2, 21+ nap: 3 tartalmi e-mail) a `sorrend` szerint választ.
- `{ tipus: 'feladat', elott_ora: 48 }` – belső feladat-e-mail a szalonnak az időpont előtt N órával ("T-24..48 Telefon" → 48); `{ tipus: 'feladat_t0' }` – azonnal (PMU: "0-24h Telefon").

A **közös** üzenetek (`kozos.js`: lemondás, áthelyezés, no-show) tipusa `lemondva` | `athelyezve` | `nem_jelent_meg`.

### Szegmens-címkék (a motor a szolgáltatás nevéből állapítja meg; `ertekek.js` SZEGMENSEK)

- headspa: `fizetos`, `ajandekkartya`, `paros`, `negykezes`, `egyeni`, `hair`
- hair: `konzultacio`, `festes`, `nagy_valtozas` (balayage / szőkítés / teljes festés / melír), `vagas_kezeles` (vágás, szárítás és minden, ami nem festés/konzultáció)
- oxygen: `konzultacio` (hajkamerás vizsgálat), `elso` (1. alkalom), `visszatero` (2. alkalomtól)
- laser: `konzultacio` (ingyenes konzultáció), `elso` (állapotfelméréssel induló első kezelés), `visszatero`
- pmu: `konzultacio` (ingyenes), `fizetos` (új kezelés), `korrekcio`, `eltavolitas`

Ha a dokumentum egy üzenetet "új vendégnek" / "első alkalomra" ír, azt a `szegmensek` szűrővel add meg (pl. oxigén: `['konzultacio', 'elso']`).
Ha a dokumentumban nincs szegmens-megkötés, ne adj meg `szegmensek`-et (minden foglalásra érvényes).

## Törzs-blokkok (`torzs`)

- sima szöveg (`'Szia {keresztnév}!'`) = bekezdés; `\n` = sortörés a bekezdésen belül
- `{ lista: ['...', '...'] }` pontozott lista; `{ szamozott: ['...'] }` számozott lista
- `{ doboz: ['sor', 'sor'] }` kiemelt foglalás-doboz (a doc "A foglalásod:" blokkja); a helyőrzős sor kimarad, ha nem ismert
- `{ gomb: { felirat: '...', link: '{foglalás_részletei_link}' } }` gomb – ha a dokumentumban egy link önálló sorban áll egy bevezető mondat után ("Foglalás részletei / módosítás: {link}")
  → a bevezető mondat külön bekezdés, a link gomb; a felirat rövid ige ("Foglalás megtekintése", "Megnézem a videót", "Itt tudom áttenni")
- `{ alairas: 'MOSAIC' }` záró aláírás-sor (a dokumentum szerinti: `MOSAIC`, `MOSAIC Hair`, `MOSAIC Oxigénterápia`, `MOSAIC Lézeres szőrtelenítés`, `MOSAIC PMU`); a "Várunk," stb. egy előző bekezdés

SMS-ben a linkek sima helyőrzők a szövegben.

## Helyőrzők (`ertekek.js` HELYORZOK)

`{keresztnév}` `{dátum}` (november 25. (szerda)) `{dátum_ragos}` (november 25-én) `{nap}` `{időpont}` `{szolgáltatás}` `{munkatárs}` `{fodrász}` `{várható_időtartam}`
`{aktuális_ár}` `{aktuális_ajánlat}` `{foglalás_részletei_link}` `{módosítás_link}` `{megerősítés_link}` `{foglalás_link}` `{navigáció_link}` `{eredmények_link}` `{videó_link}`
`{új_dátum}` `{új_időpont}` `{telefon}` `{cím}`

- A dokumentum `Találkozunk {dátum}-án.` mondatai így kerülnek át: `Találkozunk {dátum_ragos}.` (a ragozást a motor végzi; a `{dátum}-án` hibás lenne).
- Az opcionális helyőrzőket (`{munkatárs}`, `{fodrász}`, `{várható_időtartam}`, `{aktuális_ár}`, `{aktuális_ajánlat}`) tartalmazó sor/bekezdés kimarad, ha az érték nem ismert. A `{aktuális_ár}` és `{aktuális_ajánlat}` jelenleg SOHA nem ismert
  (nincs garantáltan aktuális ár-forrás): a dokumentum szerint ilyenkor ne legyen benne ár. **Ezeket a sorokat is tedd át a katalógusba** (a motor elhagyja őket); az ár/akció fixen SOHA ne legyen a szövegben
  (pl. "20% kedvezmény", hónapnév, forint összeg) – ahol a dokumentum fix összeget/százalékot ír, azt a sort **hagyd ki**, és jegyezd fel a `megjegyzesek` mezőbe (lásd lent).
- Az SMS legfeljebb 480 karakter lehet kitöltve; az SMS-ben ne legyen `{aktuális_ár}` / `{aktuális_ajánlat}`.

## `megjegyzesek`

Az export tartalmazhat `megjegyzesek: ['...']` tömböt: minden eltérés a dokumentumtól (kihagyott fix ár, javított hiba, értelmezett szegmens) ide kerüljön, 1 sor/megjegyzés.

## Ellenőrzés

`node --test tools/lifecycle-teszt/katalog.test.mjs` – szerkezet, helyőrzők, SMS-hossz, egyedi azonosítók, kötelező mezők.
