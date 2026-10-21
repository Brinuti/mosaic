# Meta ARNYEK eseménynév = böngészős tag 213 neve (PMU) – kapcsoló mögött (UJ-2 előfeltétel, draft)

Kérés: #167 6319738112 és a #458 review (6319731358). **A #458-ra épül** (alap ág: `claude/meta-arnyek-event-id-kulcs`); merge csak a #458 után, DECISION kell. Csak ÁRNYÉK, élő pixelre nem megy semmi.

## A mérés (D1 SELECT, 10-15..21, 89 `mb_` Meta alapesemény, a 213-as tag élő szabályával — GTM v54 — összevetve)
- Egyezik a szerveres és a böngészős név: **70** sor.
- Eltérés: **19** sor:
  - **12 – HeadSpa `/ajikartya-ok`**: a böngésző nem küld semmit (a 212-es trigger nem illeszkedik az útvonalra), a szerver `HeadSpa_FoglalasElso`-t küldött. MIND 10-15..10-17-i (a #194 kuponszabály előtt); 10-18 óta 0, tehát ma nincs eltérés.
  - **PMU 3**: névleképezési eltérés (lásd lent).
  - **4 – besorolási eltérés** (nem névleképezés): fodrász 2 (szerver `Visszajaro`, böngésző `Konzultacio`: `first_booking=true` és `price=0`, de a Salonic „új vendég” jelzése szerint visszatérő); HeadSpa 1 (szerver `Visszajaro`, böngésző `FoglalasElso`); oxigén 1 (szerver `Visszajaro`, böngésző `Konzultacio`: ár 4990). Ezeken a Meta-dedup nem lesz páros, mert a két oldal más eseménynevet ad ugyanarra a foglalásra; ez nem kódhiba, hanem a két forrás (Salonic vs URL) különbsége, itt nem javítom.
- Oxigén, fodrász, szőr, HeadSpa (nem kupon): a nevek egyeznek.

## PMU
A böngésző első foglalásra ÉS konzultációra is `PMU_Foglalas`-t küld (a visszajárót `PMU_Visszajaro`-ként); a szerver `PMU_FoglalasElso` / `PMU_Konzultacio`. Egy foglaláshoz egy alapesemény tartozik, ezért a kettő azonos nevre képzése nem ütközik; a különbség a `custom_data.esemeny_tipus`-ban megmarad.

## Változtatás
- `meta-bongeszo-kulcs.js`: `bongeszoMetaNev(e, uzletag, env)` – csak `META_PMU_BONGESZOS_NEV=1` esetén, csak PMU alap `FoglalasElso`/`Konzultacio` → `PMU_Foglalas`; különben null (marad `metaNev`).
- `platformok.js` (VÉDETT): a Meta-kérés `nev`-ét ez írja felül; TikTok/Google/GA4 és a `meres_kuldes` `esemeny_nev`/`esemeny_id` nem változik. Hash: `67911aace4` (#458) → `20617018fb`.
- **Kapcsoló alapból KI**, ezért a `MERES_GAZDAGITAS=0` golden kép (test-adatgazdagitas) bajtra azonos marad. Bekapcsolás: `wrangler.toml` `META_PMU_BONGESZOS_NEV = "1"` (DECISION után). Rollback: a változó törlése.
- Teszt: `tools/test-meta-pmu-nev.mjs` (7 eset: kapcsolóval PMU_Foglalas, kapcsoló nélkül változatlan, más üzletág/TikTok/esemeny_id változatlan).

## Tesztek
test-meta-pmu-nev 7, test-meta-bongeszo-kulcs 22, test-adatgazdagitas 21 (golden érintetlen), test-meres 51, test-qa-nap 45, test-booking-flow 41, test-lepes-meres 29: mind zöld. Az első változat (kapcsoló nélkül) a golden tesztet elbuktatta (1 hiba) – ezért lett kapcsoló mögötti.

## Mérést érint
Igen (Meta ÁRNYÉK eseménynév, PMU) – kapcsoló mögött, alapból nincs hatás.
