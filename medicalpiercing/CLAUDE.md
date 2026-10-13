# Medical Piercing klón – munkaszabályok (Claude)

A repó gyökerében lévő `CLAUDE.md` szabályai (magyar nyelv, mindent te csinálsz, teszt → commit →
push → PR, commit-üzenet magyarul ékezet nélkül, takarékosság a Cloudflare-buildekkel) itt is érvényesek.
Ezen felül:

- Ez a mappa **külön Cloudflare Pages-projekt** (`medicalpiercing`, Root directory: `medicalpiercing`).
  A MOSAIC oldalához (`../klon`, `../assets`, `../functions`) ne nyúlj, és onnan semmit ne importálj:
  a projekt önállóan épül.
- A `klon/` gépi kimenet (`tools/wix2static.mjs`). Ha a Wix-oldalról frissítesz, a `README.md` 1. pontjának
  láncát futtasd. Kézi javítás a `klon/`-ban akkor maradandó, ha a forrást (`tools/`, `assets/`) is javítod.
- Minden változtatás után: `node tools/build.mjs`, `node tools/serve.mjs`, majd `node tools/funkcio-teszt.mjs`
  és az érintett oldalakra `node tools/elteres.mjs` (asztali és `--mobil`). A cél: 0 eltérő elem.
- A mérőkódok csak a `www.medicalpiercing.hu` domainen futhatnak (`assets/js/suti.js`, `ELES_DOMAINEK`).
- Külső fiókokban (Wix, Google, Meta, CookieYes, Cloudflare DNS) semmit ne módosíts a tulajdonos kifejezett kérése nélkül.
- **Az új, rejtett oldalak (`/uj-fooldal`, `/uj/...`) csiszolása közben nem élesítünk és nem tesztelünk minden körben** (a tulajdonos döntése,
  2026-10-13): a munka a fejlesztői ág Cloudflare-előnézeti linkjén megy (pl. `https://claude-ecstatic-wright-ujp97.medicalpiercing.pages.dev/uj/migren-piercing`,
  az ágnév első 28 karaktere); a változtatást csak commitold és told fel az ágra, a `main`-re **ne** mergelj, teljes tesztet **ne** futtass (elég a build és egy
  gyors szemrevételezés). Az együttes élesítés akkor jön, amikor a tulajdonos jelzi, hogy véglegesek vagyunk: akkor merge a `main`-re, a teljes teszt
  (`tools/uj-oldalak-teszt.mjs`, `tools/uj-fooldal-teszt.mjs`) és az ellenőrzés az éles oldalon. (Ez felülírja a gyökér `CLAUDE.md` „azonnali élesítés”
  szabályát ezekre a rejtett oldalakra.)
