# Salonic-direct (sd) smoke ellenorzolista (2026-10-13; a meresi oldal / GPT DECISION #166, 6. pont)

**Cel:** az elso VALODI sd-atvetel (pmu / oxigen) ellenorzese, es ha termeszetes ilyen foglalas nem jon, ugyanez egy kontrollalt TESZTFOGLALASRA. **Csak olvaso:** a lista egyetlen utasitasa sem ir; nem kuld; PII-mentes (nev / e-mail / telefon / hash nincs, uuid csak 8 karakteres elotag).

**Hatarido:** ha **2026-10-15 12:30 UTC-ig** nem jon termeszetes kozvetlen pmu / oxigen foglalas, **1 kontrollalt tesztfoglalas** jon, utana lemondjuk, es **nem szamit a T2-mintaba**.

> A tesztfoglalas leadasa es lemondasa a Salonic eles naptaraban tortenik (kulso rendszer, a szalon valodi naptara): ehhez a **tulajdonos kulon, kifejezett jovahagyasa** kell. Az ellenorzolista ezutan ugyanaz.

## Menete
1. **Jeloltek** (termeszetes foglalasnal): `node tools/sd-smoke-ellenorzes.mjs jeloltek --tol <unix>` -> egy SQL (JSON: `sql`, `params`); a D1-en (csak olvasas) futtatva a pmu / oxigen letrehozo leveleket adja (`u8` = 8 karakteres uuid-elotag, `allapot`, `sd_allapot`). A tesztfoglalasnal az `u8` a letrehozo level (Zap-futas) uuid-jenak elso 8 karaktere.
2. **Idoablak:** letrehozo level T0 -> a motoros parositas lezar (~14-15 perc, `parositatlan`) -> az sd 5. lepese **T0 + >= 20 perc** (`SD_MIN_KOR_MP`) utan veszi at. Az ellenorzest T0 + ~25 perckor erdemes futtatni; korabban a verdikt `FOLYAMATBAN`.
3. **SQL-ek:** `node tools/sd-smoke-ellenorzes.mjs sql <u8>` -> 8 `SELECT` (`level`, `index`, `cellak`, `motor_cellak`, `dupla`, `elo_id`, `reschedule`, `kapcsolok`), `?1` = az `u8`. Futtatas a D1-en (csak olvasas), az eredmenyek egy JSON-ba: `{ "level": [...], "index": [...], ... }`.
4. **Ertekeles:** `node tools/sd-smoke-ellenorzes.mjs ertekel <u8> <eredmenyek.json>` -> kriterium-tabla + `VERDIKT: PASS | FAIL | FOLYAMATBAN` (a FAIL kilepesi kodja 2). A tabla a #167-be kerul rovid PASS / eszkalacio komment formajaban (eszkalacional az elso mondat a `be:false` javaslat).
5. **Tesztfoglalas utan:** lemondas a Salonicban; a napi QA-hivasokban `&proba=<u8>` (a tesztfoglalas ne szamitson a `valos`-ba); a lemondas a `foglalas_lemondas`-ban latszik.

## Kriteriumok

| # | Nev | PASS | FAIL / WARN |
|---|---|---|---|
| C1 | `level_latva` | a letrehozo level megvan, uzletag pmu / oxigen (kulcs, hash-index vagy az sd cellak uzletagabol) | FAIL: nincs sor / az elotag nem egyertelmu; WARN: nem pmu / oxigen |
| C2 | `hash_index` | `foglalas_vendeg` sor `email_h`-val | WARN: nincs sor, vagy jelolo sor (`*_nincs_email`): e-mail nelkul a csere-felismeres nem lehetseges |
| C3 | `sd_atvetel` | `sd_allapot = kesz` | FOLYAMATBAN: nincs sd-atvetel, de a level fiatalabb 30 percnel / `atveve`; FAIL: elmaradt (`sd_hianyzik`), `halasztva` / `tartva` / `lejart`; NA: a motor parositott es kuldott (az sd nem vett at) |
| C4 | `kor_ido` | az atvetel >= 20 perccel a letrehozo level utan | FAIL: korabban |
| C5 | `esemeny_sorok` | mind a 4 platformon van alap esemeny-sor az sd azonositoja alatt | FAIL: hianyzo platform |
| C6 | `forras` | minden sor `forras = salonic_direct` | FAIL: mas forras |
| C7 | `cel_arnyek` | minden kiment kerelem ARNYEK cel (Meta dataset + tesztkod, TikTok pixel + tesztkod, GA4 teszt property, Google ARNYEK akciok) | FAIL: nem ARNYEK cel (a QA-vegpont `arnyekCel()`-je) |
| C8 | `allapotok` | nincs `hiba`; Meta + TikTok alap esemeny `elkuldve` | FAIL: `hiba`; WARN: `tiltva` vagy hianyzo Meta / TikTok kuldes |
| C9 | `elo_id` | 0 elo azonosito (`ELO_CELOK`) a kerelmekben | FAIL: barmelyik |
| C10 | `dupla` | nincs duplikalt (`esemeny_nev`, `platform`) kimeno esemeny; az sd ES a motor nem kuldott is | FAIL: duplikacio / mindketto kuldott |
| C11 | `reschedule` | nincs `foglalas_reschedule` sor (normal ut) | WARN: van (csak valodi csere eseten varhato) |
| C12 | `kapcsolok` | a fo kuldesi kapcsolo nincs 0-n (`mind`), es az sd kapcsolo be van (`salonic_direct:<uzletag>` = 1, vagy globalis `salonic_direct` = 1 es az uzletag-sor nem 0) | WARN: ki |

**Verdikt:** FAIL, ha barmelyik kriterium FAIL; FOLYAMATBAN, ha van FOLYAMATBAN (vagy nincs sd-atvetel); egyebkent PASS (a WARN-ok kiirva, nem buktatnak). **A smoke csak sd-atvetellel teljesulhet:** ha a motor parositotta a foglalast, az a motoros ut sikere, nem az sd smoke.

## Tesztek
`node --test tools/test-sd-smoke.mjs` (SM1-SM9): a szimulalt sd-vilagon (valodi SQLite) termeszetes pmu foglalas -> mind a 12 kriterium PASS; tesztfoglalas (oxigen) ugyanaz + a `proba` kizaras a QA-hivasban; FOLYAMATBAN / FAIL idoablakok; 20 percnel korabbi atvetel; HOLD (csere-gyanu, `halasztva`); a motor parositott; szintetikus hibak (nem ARNYEK cel, elo ID, duplikacio, sd ES motor kuldott, `hiba`, hianyzo platform, mas forras); PII-mentesseg; CLI. A lekerdezesek az eles D1-en is lefutottak csak olvasasra (2026-10-13).
