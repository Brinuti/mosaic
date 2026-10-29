# DECISION #259: GYT `igazolas_tobb_par` (UJ-86) – jelölt-életkor korlát + 15 perces szabály (2026-10-29)

**Mérést csak közvetve érint** (GYT Salonic-igazolás párosítása; a 4 érintett sor `tipus='egyeb'`, a Google-feltöltés csak `allapotfelmeres`-re megy). Nincs kapcsoló (DECISION #259: nem konverziós ág). Védett `gfeltoltes.js` / `gkiigazitas.js` érintetlen.

## Probléma
`igazolasJeloltek` (`db.js`) korlát nélkül minden `salonic_id IS NULL`, `fuggo/aktiv/bizonytalan` sort jelöltnek vett ugyanarra a hely+időpontra. A régi, soha nem igazolt („szellem”, a Salonicban lemondott, de a D1 nem tudott róla – UJ-75) sor 2. jelöltet csinált → 409 `igazolas_tobb_par` (10-15 db=2; 10-28 db=2; 10-29 db=3). Egy kulcsnak 4 sora volt (10-20 igazolt, 10-23 szellem, 10-28, 10-29).

## Változás
1. **Jelölt-életkor (DECISION #259 (1)):** csak az igazolás D1-be érkezése (`most`, unix mp, UTC; nem a Zap újrapróbájáé) előtt **≤ 48 órával** (`<= 48*3600`, egyenlőségig) létrejött igazolatlan sor jelölt (`igazolasJeloltekKorral`, `JELOLT_ABLAK_MP`). A régebbi sor nem módosul (nincs `lejart`-ra zárás, nincs D1-írás – a #259 ezt csak „ha a kód is zárja” esetre engedte; itt nem zárunk).
2. **Meglévő szűrők változatlanok (2):** oldal-munkatárs (HMAC) → `munkatars_nev`.
3. **15 perces szabály (3):** ha a szűrések után is >1 jelölt van: az nyer, amelyik az igazolás érkezése előtt **≤ 15 perccel** jött létre, és a következő legfrissebb jelölt **≥ 15 perccel régebbi nála** (egyenlőségig). Különben **409 marad** (nem találgatunk). (Szigorúbb olvasat: a „régebbi” a nyertes sorhoz viszonyít; ha a mérési oldal a beérkezéshez viszonyított olvasatot akarta, jelezze.)
4. **Napló (`gy_riasztas`, csak technikai adat):** `igazolas_tobb_par` adata kiegészül `;kizart48=K;friss15=0|1`-gyel; új típus `igazolas_jelolt_szures` (`kizart48=K;friss15=0|1`) minden olyan sikeres igazolásnál, ahol a 48 órás korlát kizárt jelöltet vagy a 15 perces szabály döntött. (`lejart`-ra zárt sor: 0, mert nem zárunk.)

## Tesztek (`gyogytorna/tools/test-gy-szerver.mjs`, új 4 teszt: 81–84)
- 10-28 eset (szellem 5 napos + friss 2 perces) → a friss igazolódik, a szellem változatlan; 10-29 eset (60 óra, 3 óra, 2 perc) → kizárt 1, a 15 perces szabály dönt; 10-15 eset (két közeli jelölt) és azonos pillanatban létrehozottak → 409, napló `kizart48=0;friss15=0`; határértékek: pont 48 óra = jelölt, 48 óra + 1 mp = kizárt (`nincs_motoros_jelolt`), pont 15 perc / pont 15 perc különbség = nyer, 14:59 különbség és 15:01 kor = 409.
- **Piros → zöld:** a 4 új teszt a main kódján pirosat ad, az újon zöld. A 17. teszt (`bizonytalan esetek…`) a mainen is piros (ismert, a #510 javítja; nem ennek a PR-nak a hibája). Összesen: 83 pass / 1 fail (a 17.).
- **A 10 napos adat:** a 11 kettős (hely, időpont) csoport mindegyike igazolt (`salonic_id` van) – a szabály csak igazolatlan sort érint, ezek eredménye változatlan.

## Védett hash
`gfeltoltes.js` 6f5deb2070, `gkiigazitas.js` 016ad1c4cc – változatlan.

## Rollback
PR revert (a korábbi, korlát nélküli jelöltkör tér vissza). D1-séma nem változik.

## A két elakadt sor (10-28 16:54, 10-29 13:32)
A merge + 24 óra hibamentes futás után, egyszer, Zap-újrajátszással (01-MERES, DECISION #259 (c)); `egyeb` típus → platformküldés nincs.
