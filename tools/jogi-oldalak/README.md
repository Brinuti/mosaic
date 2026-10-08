# A 4 régi (Wixes) info-oldal újrastílusa: ÁSZF, impresszum, süti-tájékoztató, blog

Oldalak: `aszf` (noindex, mint a régi), `impresszum` (noindex, mint a régi), `suti-tajekoztato` (indexelhető, a Wix Blog poszt), `blog` (indexelhető, a Wix Blog bejegyzés-lista).
A tartalom **szó szerint a régi oldalról** van; a régi oldalak hibáit / ellentmondásait nem javítottuk (lásd a PR „Észrevételek” részét).

- `gen.mjs`: a **régi oldal HTML-jéből** (`klon/<név>.html`, az eredeti klon-fájl a csere után is megmarad) építi a `foglalas/<név>.html` fájlokat (`node tools/jogi-oldalak/gen.mjs`).
  A folyam-kinyerő (`tools/ujrastilus/folyam.mjs`) helyett a HTML-t olvassa, mert a hosszú jogi szövegeknél a Wix-szöveg inline linkjei (pl. az ÁSZF 6.2 pontja, az impresszum „Weboldal:” / „E-mail cím:” sorai)
  a kinyerőnél kiesnek, a HTML-ben viszont minden megvan. Az újrafuttatás felülírja a kimenetet.
  - ÁSZF / impresszum: az egyetlen rich-text blokk; a számozott rövid sorok („1. Szolgáltatás”, „3.9. Ajándékutalvány használat”) címsorrá, a „- …” sorok felsorolássá alakulnak (a jel nélkül; a szöveg ugyanaz).
  - süti-tájékoztató: a Wix Blog poszt (cím, szerző, idő, szöveg); blog: a bejegyzés-lista (kategória, kártya).
- Stílus: `assets/css/jogi-oldalak.css` (a `headspa-oldal.css` komponenseire épül).
- Rejtett régi példány: `/<név>-regi` (noindex), `node tools/ujrastilus/regi-peldany.mjs <név> --lcp-torol`. Visszaállás: a `foglalas/<név>.html` törlése.
- Teszt: `node --test tools/ujrastilus-teszt/info-oldalak.test.mjs`.
