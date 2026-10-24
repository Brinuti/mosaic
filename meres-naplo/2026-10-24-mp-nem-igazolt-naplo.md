# MP: `kihagyva:nem_igazolt` napló az igazolatlan Salonic-forrású foglalásokra – DRAFT

**MÉRÉST ÉRINT** (csak napló: `mp_tiktok_feltoltes`). Kérés: #167 6380428905, „Kérés 1” (nem sürgős, határidő 10-27). **Merge csak DECISION után** (független review PASS a végső SHA-ra, védett hash-ek, rollback).

## Miért
10-18 07:50, 10-21 11:34 és 10-23 16:20 MP Salonic-forrású foglalásnak (nem motoros) nincs TikTok-sora: a TikTok-lépés csak igazoláskor indul, igazolás pedig nem jött, így „kihagyva” sor sem keletkezett (szándékos szabály, de napló nélkül).

## Változás (`medicalpiercing/lib/meres/lanc.js`, +25 sor)
Új `nemIgazoltNaplo(db, env, host, {most, fetchImpl})`, az új foglalás rögzítésekor, a karbantartás (ami az igazolatlanokat `nem_igazolt`-ra állítja) ELŐTT hívva. Jelölt: `kornyezet='eles'`, `forras='salonic'`, ≤ 14 napos, 48 óra után igazolatlan (`igazolas IS NULL`) vagy már `nem_igazolt`, még nincs `mp_tiktok_feltoltes` sora (ez visszamenőleg is bepótolja a 14 napon belülieket). A meglévő `tiktokLepes`-t hívja egy másolaton, `igazolas='nem_igazolt'`-tal → `kihagyva:nem_igazolt` (payload nélkül; fül típusnál a meglévő sorrend szerint `kihagyva:divat_fulpiercing`).
- **Küldés nem változik:** a hívás másolatán `igazolas='nem_igazolt'`, tehát a `jogosult` mindig kihagyja; hálózati hívás nincs (teszt: fetch-számláló 0). A `mp_foglalas` nem módosul, a Google-lánc érintetlen.
- `ki` mód: semmi nem történik. Hiba: elnyelt (`console.error`), a foglalás válasza ugyanaz. Idempotens (NOT EXISTS + a `tiktokLepes` saját védelme).
- Későbbi igazolás: a meglévő `ON CONFLICT … WHERE allapot LIKE 'kihagyva:%'` miatt a `naplozva` sor felülírja (nincs változás).
- Riport (`riport.js`): csak `naplozva` sorokat számol → nem változik.

## Tesztek
`node --test tools/test-mp-tiktok.mjs`: 20/20 (új: 4); a többi MP-teszt (feltoltes 23, forras-v2 22, forras 9, ful-kizaras 3, igazolas 7, kiigazitas 7, lemondas 6, meres 10, meta-arnyek 9, tipus-stat 6) zöld. Fedés: 48 óra után naplóz, idempotens, fetch 0; régi `nem_igazolt` visszamenőleg; nem jelölt: 48 óránál frissebb, motoros, igazolt, előnézet, 14 napnál régebbi; `ki` mód; fül típus; későbbi igazolás felülírja; teljes `foglalasErkezes` út (karbantartás nem_igazolt-ra állít, TikTok-hívás nincs); eltört DB-nél nem dob.

## Védett elemek blob-hash-e
Változatlan: `lib/meres/tiktok.js` `5fc76b1a5c`, `meta.js` `447fa9e81c`, `kiigazitas.js` `f79dbd1167`, `google-ads.js` `27bc0e28aa`, `igazolas.js` `e370d3ff36`. Módosult (dokumentált): `lib/meres/lanc.js` `4d8a657f00` → `98d1a08874`, `tools/test-mp-tiktok.mjs`, `docs/MERES_TIKTOK.md`.

## Rollback
A PR revertje (a naplósorok ártalmatlanok, 90 nap után törlődnek; `DELETE FROM mp_tiktok_feltoltes WHERE allapot = 'kihagyva:nem_igazolt'` opcionális). Nincs konfigurációs váltó; a `tiktok_mod = 'ki'` kikapcsolja.
