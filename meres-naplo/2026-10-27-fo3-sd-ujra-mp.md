# FO-3: az sd_atvetel varakozas / halasztva valasza ujraprobalhato (ujra_mp)

Datum: 2026-10-27. Ag: `claude/fo3-sd-ujra-mp`. Erintett: `netlify/lib/meres/salonic-direct.js` (nem vedett fajl).

## Valtozas
- Uj mezok az `sd_atvetel` valaszan, ha a kesobbi ujraprobalas ertelmes:
  - `ujra_mp`: mikor probaljon ujra a hivo (60..900 mp, az allapot sajat idejehez igazitva);
  - `ujra_ig_mp`: meddig ismetelhet (a letrehozo level utani 48 oras korig);
  - `ok_kod`: `varakozas_fuggoben` | `varakozas_nem_ellenorizheto` | `halasztva_elo_allapot`.
- Hol: a ket `varakozas` ag, es a `motor_kuldte` ag, ha az esemenykuldes `halasztva` maradt (az elosztas `ujraprobal_mp`-je).
- 48 ora folott csak `ok_kod` jon (nincs mit ismetelni), `lejart` agon valtozatlan.
- Kuldesi logika, identitas, dedup, vedett fajlok: valtozatlan (csak valaszmezo).

## Rollback
A mezok elhagyasa visszafele kompatibilis; a Zap, ha nem olvassa, ugy viselkedik mint eddig. Visszavonas: a PR revertje.

## Teszt
`node --test tools/test-salonic-direct.mjs`: 76/76 (S0-28, S0-38, S0-39 bovitve + FO-3 ujraMezok). Vedett blob-hash (platformok, elosztas, vegpontok): valtozatlan.

## Zap-oldal (nem tartozik ide, a Zapokat mashol kezelik)
A Zap az `ujra_mp` szerint ismetelhet `ujra_ig_mp`-ig; Zap-modositas nem tortent.
