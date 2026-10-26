# UJ-68: a foglalas jellege a koszonooldalbol / a szolgaltatas nevebol (2026-10-26, draft)

**MERESI VALTOZTATAS (jelolve).** Csak az ARNYEK (shadow) esemenylanc `jelleg` (FoglalasElso / Konzultacio / Visszajaro) meghatarozasa valtozik; elo konverzio, futo hirdetes, foglalasi folyamat, bongeszos cimkek (GTM 213-as) nem.

**Miert:** a Salonic-level "uj vendeg" jelzese egy mar korabban foglalt vendegnel `false`, ezert a szor / oxigen / fodrasz uj szolgaltatasra szolo elso foglalasa vagy konzultacioja `Visszajaro`-kent ment ki (a meresi oldal szerint 10-12..25: szor 2/4, oxigen 4/18, fodrasz 4/13). Ez blokkolja a szor / oxigen / fodrasz szerveres Meta-rakotest, a Google ARNYEK-feltoltest es a TikTok-csaladot.

**Szabaly (Feri / meresi oldal, #167 6421188683):**

| uzletag | koszonooldal / szolgaltatas | jelleg |
|---|---|---|
| szor | `/elysion-ok` | mindig uj: `konzultacio` ha a szolgaltatas konzultacio, egyebkent `elso` |
| szor | `/szortelenites-ok` | mindig `visszajaro` |
| oxigen | `/oxigenterapia-ok` | mindig uj: `konzultacio` (konzultacio / hajkamera nev) vagy `elso` |
| oxigen | `/oxigenterapia-masodik` | mindig `visszajaro` |
| fodrasz, PMU | "konzultacio" nevu szolgaltatas | mindig `konzultacio` (a Salonic "nem uj vendeg" jelzese ellenere is) |
| HeadSpa, minden mas | – | valtozatlan (`foglalasJelleg`; HeadSpa-nak nincs konzultacio-aga, #101) |

A kupon-jelzes (DECISION #194 / #195) valtozatlan: a kuponos foglalas tovabbra sem konverzio. A kupon a `foglalasJelleg`-bol marad.

**Kod:** uj `netlify/lib/meres/jelleg-oldal.js` (tiszta fuggveny: `jellegSzabaly`, `oldalUtvonal`); beallitas: a motor-ut (`foglalas-esemeny.js`: az oldal a `meres_erkezes.oldal`-bol, a szolgaltatas a levelbol) es az sd-ut (`salonic-direct.js`: oldal nincs, csak a nev-szabaly). Az `esemeny-modell.js` (vedett) NEM valtozik. A valasz `jelleg_rogzites` mezoi kiegeszultek: `oldal_szabaly` (melyik szabaly illett: `oldal_uj` / `oldal_visszajaro` / `konzultacio_nev` / null) es `modell_jelleg` (mit adott volna a regi logika).

**A rogzites (X1) valtozatlan:** az elso level (elso kiertekeles) jellege rogzul a `meres_jelleg`-ben; a kesobbi level csak naplozodik. Fontos kovetkezmeny: ha a koszonooldali erkezes (`meres_erkezes`) az elso level feldolgozasakor MEG nincs meg, az elso level az oldal-szabaly nelkul (regi logika, a nev-szabalyal) rogziti a jellegt. Az oldal a koszonooldal betoltesekor ment, a level kesobb jon: a gyakorlatban az erkezes megvan.

**Nincs visszamenoleges javitas:** a mar kiment (shadow) esemenyek es a mar rogzitett `meres_jelleg` sorok nem valtoznak. Csak az uj foglalasok.

**Adat (D1 `mosaic-foglalas-kulcs`, 2026-10-10 ota, jelleg a `meres_jelleg`-bol, oldal a `meres_erkezes`-bol; csak darabszam):**
szor `/elysion-ok`: elso 1 / konzultacio 2 / visszajaro 5 (a szabaly szerint a 5 visszajaro hibas); szor `/szortelenites-ok`: visszajaro 6 (rendben);
oxigen `/oxigenterapia-ok`: elso 13 / konzultacio 2 / visszajaro 3 (a 3 hibas); oxigen `/oxigenterapia-masodik`: visszajaro 9 (rendben);
fodrasz `/fodrasz-ok`: elso 20 / konzultacio 10 / visszajaro 62 (a konzultacio nevuek kozul a visszajaro-ba esok hibasak; a szolgaltatasnev a D1-ben nem tarolt, ezert a pontos szam a levelekbol szamolhato);
PMU `/pmu-ok`: elso 5 / konzultacio 3 / visszajaro 4 (a meresi oldal szerint nincs hiba).

**Teszt:** `tools/test-jelleg-oldal.mjs` (35 teszt: tiszta fuggveny tablaja 5 uzletagra, motor-ut valodi SQLite-tal, vesz-kapcsolo, X1 rogzites). A `tools/test-meres.mjs` harom X1-tesztje (fodrasz "konzultacio" `uj_vendeg: false`-szal) az uj szabalyhoz igazodott: a szolgaltatas ott mar Konzultacio marad (nem Visszajaro), a rogzites-elteres agat a `test-jelleg-oldal.mjs` fedi.

**Vedett fajlok (blob-hash, valtozatlan):** `platformok.js` `67911aace4`, `elosztas.js` `f8a78f8430`, `meta-bongeszo-kulcs.js` `62143dda2b`, `esemeny-modell.js` `4342e6f09b`, `qa-nap.js` `de6205f0eb`, `vegpontok.js` `085bed6aad`, `gyogytorna/lib/gfeltoltes.js` `6f5deb2070`, `gkiigazitas.js` `016ad1c4cc`. A `salonic-direct.js` es a `foglalas-esemeny.js` NEM vedett (ket-ket sor).

**Rollback:** `MERES_JELLEG_OLDAL=0` (Cloudflare Pages valtozo, kodvaltoztatas nelkul: a regi jelleg-logika), vagy a PR merge-commit revertje. A mar kiment esemenyeket egyik sem vonja vissza.

**Nem erinti (kulon dontes, nem ez a PR):** a bongeszos GTM 213-as cimke (`first_booking` alapu `Szor_Visszajaro` / `Oxigen_Visszajaro` / `Fodrasz_Visszajaro` stb. nevek) ugyanezt a hibat hordozza a bongeszos oldalon; a parhuzamos javitas web-GTM-modositas (kulso fiok, elo konverzio) → csak kulon dontessel.

**Vendegadat / click-ID:** nincs a diffben, a naploban es a tesztekben (a tesztek `example.com` cimet es a mentett Salonic-fixture-oket hasznaljak).
