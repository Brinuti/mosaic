# MP foglalómotor – időpont-előtöltés + tartalék-kérés (2026-10-23)

**Kérés:** Feri, 2026-10-23 19:24 („javítás, persze, de légy szíves, akkor nagyon tesztelj oda-vissza … ne fussunk arra, hogy nem működik, és beragad valami”).
**Háttér:** a motor lépésnaplója (D1 `mp_motor_stat`, 10-20..22) szerint mobilon az időpont-lépésig 646-an jutnak el, az adatlapig 238-an; technikai hiba / „nincs szabad időpont”
esemény az időpont-lépésen 0. A Salonic-válasz ideje Budapesten ~2,5 mp (+1,6 mp a szolgáltatáslista), vidéken 0,4–0,7 mp.

## Mi változott (`medicalpiercing/assets/js/motor/motor.js`, egyetlen fájl)
1. **Előtöltés:** a piercing-listán 300 ms után az első 2 kártya szabad időpontjai (0–21. és 21–100. nap) betöltődnek, ugyanazzal az `adapter.getAvailability` hívással és
   opciókkal (`IDO_OPCIOK`), mint az időpont-lépésben → a kattintáskor a naptár a 90 mp-es gyorsítótárból jön. A „Részletek” nyitása és az „Időpontot választok” gomb
   lenyomása (`pointerdown`) is előtölt. Motor-megnyitásonként legfeljebb 4 piercing; helyszíncserénél a régire nem.
2. **Tartalék-kérés az időpont-lépésben:** ha az első rész 6 mp alatt nem jön meg, vagy az első kérés hibás, friss (gyorsítótárat megkerülő) kérés indul; amelyik előbb sikeres,
   az rajzol (`Promise.any`). Mindkettő hibája: a régi hiba-képernyő (Salonic-link). Ha közben a vendég már másik lépésen van, nincs hiba-képernyő.

**Nem változott:** a foglalási út és a lépések, a `[data-szolg]` gombok, a mérés (GA4 / pixel / D1-stat hívások), a `salonic-adapter.js`, `booking-id.js`, `mp-meres.js`, `motor-indito.js`, `suti.js`.

## Tesztek (helyi build, valós Salonic GET, foglalás nélkül)
- Új: `node tools/motor-elotoltes-teszt.mjs [--mobil]` – 37/37 asztali, 37/37 mobil (A–J esetek: előtöltött naptár ~20 ms és 0 új kérés; nem előtöltött 1,6–1,8 mp, mint eddig;
  előtöltés 500-as hibával → a kattintáskor újrakér; 4 mp-es lassú előtöltés → megvárja, nem dupláz; 20 mp-re beragadt kérés → 6 mp után tartalék, 7,5–7,7 mp alatt naptár;
  minden kérés hibás → hiba-képernyő Salonic-linkkel; az első kérés hibás, az újra jó → naptár; helyszíncsere; plafon 4; nincs JS-hiba).
- Régi motor- és mérési tesztek: lásd a PR leírását.

## Visszaállítás
A PR revertje (egy fájl). Gyors kikapcsolás: `ELOTOLT_MAX = 0` (előtöltés ki), `TARTALEK_MS` nagyra (tartalék ki).

## Figyelés élesítés után
`mp_motor_stat`: `hiba / idopontok` darabszám (eddig 0), az `ido` → `adatlap` arány mobilon (10-20..22: 238/646 = 37%).
