# Megszakadt küldések: `folyamatban` plafon, `megszakadt` állapot, láthatóság, fetch-timeout (DECISION #250)

Kérés és döntés: 01-MERES #167 6463412395 / 6464351642 (DECISION #250 (a), (b), (c) + a #249 szerint a timeout), a `meres_kuldes` id 2461 beragadt sora (szőr, Meta, Schedule, `folyamatban` 2026-10-28 05:30:41 Z óta) nyomán. **Mérést érint, az éles küldést nem változtatja** (csak a beragadó sorok sorsa és a láthatóság); alapból-KI modulok (`meta-elo`, `tiktok-elo`) csak védőhálót kapnak.

## Mit csinál
- **(b) plafon:** a `folyamatban` sor ELAKADAS_MP (120 s) után csak `probalkozas < 3` esetén próbálható újra (eddig korlátlanul); a 3-szor megkezdett, de be nem fejezett sor a következő híváskor `megszakadt` lesz (`indok: megszakadt: a kuldes 3 probalkozas utan sem fejezodott be`). Hol: `elosztas.js` (ARNYÉK-lánc, `meres_kuldes`; a conversion egy `UPDATE ... WHERE source_id = ? AND allapot = 'folyamatban' AND probalkozas >= 3 AND frissitve <= now-120` minden hívás elején), `meta-elo.js` (`meres_meta_elo`), `tiktok-elo.js` (`meres_tiktok_elo`). A `megszakadt` sor végleges; **utólag nem küldhető újra** (a hash-elt e-mail/telefon csak a kimenő kérésben van meg, a D1 maszkolt naplót tárol).
- **(c) `ujraprobal_mp`:** ha a hívás friss (ELAKADAS_MP-n belüli) `folyamatban` cellát talál (egy másik hívás még dolgozik / megszakadt), a válasz `ujraprobal_mp` mezőt kap (hátralévő idő + 5 s), így a hívó (Zap) újrapróbája nem esik az ablak alá. `foglalas-egyeztetes` válaszában: `esemeny_kuldes.ujraprobal_mp`; a modulok saját eredményében is. A Zap-oldali újrapróba beállítása külön (Zapier = külső fiók, Feri).
- **(a) `qa-nap`:** új `folyamatban_regi` blokk (üzletág × platform): 10 percnél régebben `folyamatban` cellák (`db`, `max_perc`, platformonként) és a 7 napon belül `megszakadt`-tá vált cellák (`megszakadt_7nap`); sárga lámpa, ha bármelyik > 0; az `osszes.folyamatban_regi` összesít. A 7 napos ablak a `letrehozva`-ra vonatkozik; a `forras = google_proba` sorok kimaradnak. Csak olvas (SELECT).
- **Timeout:** `meta-elo` / `tiktok-elo` a platform-hívásra `AbortSignal.timeout(4000)` (megszakítás → `hiba`, újrapróbálható, max 3). Az ARNYÉK `kuldes()` (`platformok.js`, védett) már eddig is 8 s-os időkorlátos – ahhoz nem nyúltunk.

## Védett fájlok (dokumentált hash-változás)
`elosztas.js` f8a78f8430 → **2d5929b4ff**; `qa-nap.js` de6205f0eb → **1083e94a27**. Változatlan: platformok 67911aace4, esemeny-modell 4342e6f09b, meta-bongeszo-kulcs 62143dda2b, vegpontok 085bed6aad. (A #521 ugyanezt a két fájlt is érinti: a 11-02-i merge előtt a `main`-nel összefésülés + hash-újraszámolás kell.)

## Tesztek
`node --test tools/test-folyamatban-plafon.mjs` (5): 5 hívásos forgatókönyv (megszakad ×3 → `megszakadt`, a plafonos cellára nem megy küldés, `ujraprobal_mp` a friss cellánál), `meta-elo` és `tiktok-elo` (timeout-signal, plafon, `ujraprobal_mp`), `qa-nap` (`folyamatban_regi`, `megszakadt_7nap`, lámpa, kizárások, csak olvas). Zöld: test-meres 51, test-qa-nap 45, test-meta-elo 9, test-tiktok-elo 15, test-salonic-direct 75, test-foglalas-esemeny 15, test-adatgazdagitas 21, test-google-proba 26, test-lpt-forras 58, test-foglalas-kulcs 46.

## Rollback
Merge-commit revert (séma nincs; a már `megszakadt`-ra váltott sorok maradhatnak, a `megszakadt` az `ALLAPOTOK`-on kívüli állapot: a `qa-nap` „mas”-ként számolja).
