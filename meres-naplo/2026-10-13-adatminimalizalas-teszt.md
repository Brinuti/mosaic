# Adatminimalizalas – tesztnapló (2026-10-13)

Forras: a meresi oldal SPEC-je (#167, 120. komment, GPT atnezte). A Salonic-szolgaltatas teljes neve
(PMU / oxigen / laser = egeszsegugyhoz kozeli) NEM mehet a Meta / TikTok / GA4 fele, es NEM kerulhet a
`meres_kuldes.kerelem` naplosorba; csak a `platformKod` megy.

## Valtozas
- `netlify/lib/meres/platformok.js`: uj `platformKod(e, ctx)` = `ajandekkartya` (ajandekkartya tipusnal), kulonben
  `${uzletag}_${esemeny.nev}` kisbetuvel (pl. `pmu_foglalaselso`).
  - Meta `custom_data.content_name` = platformKod (volt: teljes szolgaltatasnev)
  - TikTok `contents[].content_id` = `content_name` = platformKod (volt: teljes nev, nev nelkul "fallback")
  - GA4 ajandekkartya `items[].item_id` = `item_name` = platformKod (volt: teljes nev)
  - Google: valtozatlan (soha nem kuldott szolgaltatasnevet; a Zap mezoi: ad_user_data, conversion_action_id,
    conversion_date_time, currency, gclid, order_id, value).
- `tools/fixtures/golden-motor-kerelem.json` ujragenerálva (`node tools/meres-proba/golden-motor.mjs --ir`).
  Utvonal-szintu diff: CSAK Meta `custom_data.content_name`, TikTok `properties.contents[].content_name`,
  GA4 `items[].item_id/item_name` (+ az ezeknek megfelelo `sorok[].kerelem` naplo-szoveg). 236/468 kerestorzs valtozott;
  URL, esemenynev, ertek, event_id, order_id valtozatlan.
- `tools/meres-proba/golden-motor.mjs`: a segedek `export`-altak (a teszt ujrahasznositja).
- Uj teszt: `tools/test-adatminimalizalas.mjs` (A1–A8).

## Eredmenyek (helyi futtatas, node --test)
| fajl | pass | fail |
|---|---|---|
| test-adatminimalizalas | 8 | 0 |
| test-salonic-direct (S0-13 golden is) | 71 | 0 |
| test-meres | 48 | 0 |
| test-validation-replay | 2 | 0 |
| test-salonic-adapter | 34 | 0 |
| test-foglalas-kulcs | 42 | 0 |
| test-booking-flow / -id / -layer | 40 / 11 / 10 | 0 |
| test-lepes-meres, test-qa4-smoke, tobbi | zold | 0 |
| test-foglalo-atkotes | 18 | **1** (korabbi, ettol fuggetlen: oxigen-uj.js:134, 19. eset) |

A2 elso futasa elhasalt: a teszt elvart platformlistaja kihagyta a `google`-t (a Google-epito is ad torzset). Teszt-feltevesi hiba,
az epito nem volt hibas; javitva (`['ga4','google','meta','tiktok']`), A6 kulon a Google-torzs mezoit ellenorzi.

## Mit bizonyit A1–A8
- A1 platformKod tablazat (uzletag × esemeny, ajandekkartya, ures/null szolgaltatas).
- A2 5 uzletag × 3 jelleg × kupon × (motor, salonic_direct) × 4 platform: a kulonleges `SZOLG` (kisbetu / NAGYBETU /
  URI-kodolt valtozatok is) SEHOL nincs a torzsben / URL-ben.
- A3 ertek, event_id, order_id valtozatlan (optimalizalasra nincs hatas).
- A4 TikTok: nincs nyers nev fallback (null, '', valodi nev esetben sem).
- A5 ajandekkartya: GA4 items[] = `ajandekkartya`, Meta / TikTok sem kap nevet.
- A6 Google-torzs mezoi pontosan a Zap mezoi, nev nelkul.
- A7 motoros vegpontig: `elosztas()` HTTP-hivasai ES a `meres_kuldes.kerelem` naplo nem tartalmazza a nevet; a kodot igen.
- A8 salonic_direct vegpontig (`vilag/level/lezar/v.sd`): ugyanez az sd kimeno hivasokra es a naplora.

## Meresi hatas
Ez a valtozas MERES-erinto (platform-torzsek: Meta / TikTok / GA4 mezok). Elo konverziós celra nem megy (T2 alatt csak arnyek-celok);
az optimalizalasi mezok (ertek, event_id, order_id, esemenynev) nem valtoznak. Merge csak a go-live befagyasztas feloldasa utan.
