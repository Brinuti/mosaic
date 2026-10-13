# Gyogytornaszom.hu foglalomotor

Reteg: `public/assets/js/launcher.js` (kapcsolo, linkek elfogasa, koszonooldal) -> `motor/motor.js` (Shadow DOM-os foglalo) -> Salonic (olvasas) -> beagyazott Salonic adatlap -> `/allapot-ok/` | `/foglalas-ok/`.
Szerver (Cloudflare Pages Functions + D1): `functions/api/gy-forras|gy-foglalas|gy-koszono|gy-kampanyok|gy-admin`, logika: `lib/`.

## Folyamat
1. A latogato egy `gyogytornaszomhu.salonic.hu` linkre vagy `data-gy-foglalas` attributumu elemre kattint -> a launcher a motort nyitja (kapcsolo + latogatoi vodor: `motor-kapcsolo.json` `arany` 0..100; `?motor=1/0` proba).
2. Szolgaltatas -> (valtozat) -> helyszin -> szakember ("Mindegy" a legkorabbi) -> idopont (havi naptar) -> Salonic adatlap (iframe `gy-adatlap`).
3. Sikeres foglalas: a Salonic az iframe-et a koszonooldalra iranyitja; ott a launcher `postMessage`-szel jelez, a motor `POST /api/gy-foglalas`-szal ellenoriztet (elo Salonic-adatok), egyszeri tokent kap (sessionStorage `gy_tk`), majd a parameter-mentes koszonooldalra navigal.
4. A koszonooldalon a token `POST /api/gy-koszono` -> `dataLayer.push({event:'foglalas_kesz', tipus, ertek, tranzakcio_id})`. Token nelkul / hasznalt tokennel nincs esemeny.

## Parancsok
`npm run build` · `npm run serve` (http://localhost:4291/booking-test/?motor=1) · `npm run teszt` · `npm run teszt:bongeszo`

## Eles uzem (lepesek)
Pages projekt `gyogytorna` (gyoker `gyogytorna`, build `node tools/build.mjs`, kimenet `dist`), D1 `gy-meres` (kotes `GY_DB`), titkok: `GY_HMAC_KULCS`, `GY_ADMIN_KULCS_HASH`; proxy Worker: `www.gyogytornaszom.hu/gy-foglalas/*` -> Pages. A WordPress-snippet a launcher-t tolti (`<script src="/gy-foglalas/assets/js/launcher.js" defer>`), a GTM-et a `gy-adatlap` keretben a koszonooldalakon kihagyja.
Nyitott: a Salonic e-mail -> Zapier -> `/api/gy-salonic-igazolas` kemeny visszaigazolas es a lemondas-egyeztetes (Feri jovahagyasa kell a Zap letrehozasahoz); a Google Ads kampanylista napi szinkronja.
