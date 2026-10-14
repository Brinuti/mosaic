# Suti-sav levetele (DECISION #170) - tesztnaplo, 2026-10-14

Ag: `claude/mosaic-suti-sav-le-rrbwkk` (a `main` 9ec2b6b-rol). Doksi: `docs/booking-engine/SUTI_SAV_LE.md`. MERES ERINTO. Nincs merge / elesites.

## Futtatasok

| Teszt | Eredmeny | Nyers naplo |
|---|---|---|
| `ELES=1 FOGLALO_ATKOTES=all node tools/netlify-build.mjs` | dist/ kesz: 144 asztali + 144 mobil oldal | - |
| `node --check assets/js/suti.js` | SYNTAX_OK | - |
| `PLAYWRIGHT_UTVONAL=<repo-gyoker> node tools/meres-proba/suti-alapertek-bongeszo.mjs --ki meres-naplo/suti-sav-le-bongeszo-2026-10-14.json` | **PASS 84/84** (asztali 1280 px + mobil 390 px + vedett Meta-pixel + keret) | `suti-sav-le-bongeszo-2026-10-14.json` |
| `node tools/meres-proba/attribucio-hozzajarulas-bongeszo.mjs --ki meres-naplo/attribucio-hozzajarulas-suti-sav-le-2026-10-14.json` (frissitve az uj rezsimre) | **PASS** (A, A2-A4, B, B2, C, D, E) | `attribucio-hozzajarulas-suti-sav-le-2026-10-14.json` |
| `node --test tools/test-meres.mjs tools/test-lepes-meres.mjs` | **68/68** | - |
| negativ kontroll: a suti-alapertek teszt a MODOSITATLAN (`main`) `suti.js` ellen | elbukik: `TypeError: window.mhSuti.mod is not a function` | - |

A bongeszo-tesztek a `www.mosaicheadspa.hu` oldalait a helyi `dist/`-bol szolgaljak ki (Playwright route), hogy a `suti.js` "eles" agai (GTM, GA4, Meta) is lefussanak; MINDEN mas kulso host (googletagmanager, connect.facebook.net, trustindex, ...) a kereseskor megszakad (`blockedbyclient`), az `/api/*` 204-et kap. Semmi nem jutott el semmilyen hirdetesi / mero rendszerhez.

## Megfigyeles (nem hiba, nyitott pont - lasd a doksi 1. pontja)

Uj latogato (nincs tarolt dontes): az `attribucio.js` `hozzajarulas()` a foglalaskor `{}`-t kuld a szervernek (asztali es mobil nezet is) -> szerveroldalon Google / GA4 jel `UNSPECIFIED`, nincs hash-elt azonosito a Google fele; a bongeszoben a Consent Mode granted. A foglalasi folyamat kodjat ez a PR nem modositja (DECISION #170).

## Vedett blob-hash-ek (a worktree-ben)

`koszono.js 547d0e05fc`, `klon/oxigenterapia-ok.html 157c141e5d`, `klon/fodrasz-ok.html 1ef408bcbb`, `klon/m/oxigenterapia-ok.html 88c2d866ae`, `klon/m/fodrasz-ok.html ae96e4ae97`: azonosak a `main`-nel. `git diff 9ec2b6b -- assets/js/booking-engine _redirects _headers`: ures. `assets/js/suti.js` `1c96df5fa7` -> `327cad9d7c` (szandekos); a `PIXEL_*` sorok nem szerepelnek a diffben.
