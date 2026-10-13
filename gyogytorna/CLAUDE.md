# gyogytorna/ - a gyogytornaszom.hu foglalomotorja

- A motor a Mosaic + Medical Piercing motor adaptacioja; a foglalast a **Salonic `gyogytornaszomhu`** fiokja rogziti (nincs foglalasi API: csak publikus GET oldalak + `api.salonic.hu` naptar, a beagyazott `guestData` adatlap).
- **Egeszsegugyi adat nem kerulhet** URL-be, dataLayerbe, naplora, a D1-be, a feladatfajlba. A dataLayerbe csak `foglalas_kesz {tipus, ertek, tranzakcio_id}` megy. Reszletek: `docs/ADATTERKEP.md`, `docs/MEZO_CELRENDSZER.md`.
- Az allapotfelmeres = Salonic 24666 + 416586 (Feri dontese); minden mas `egyeb`.
- Meta-merest NEM tartalmaz. A GTM-hez nem nyulunk (a meresi Claude intezi).
- Teszt: `npm run teszt` (szerver, 25) es `npm run teszt:bongeszo` (Playwright, mockolt Salonic). Valodi probafoglalas csak Feri jovahagyasaval.
- Tesztnaplok: `meres-naplo/`. A kozos `netlify/` mappat ne torold.
- **Allando szabaly (Feri, 2026-10-13):** ami NEM erinti az aktiv merest (nem csokkenti a konverziot, nem ront a meresen, nem csokkenti a bevetelt, nem igenyel kampany-modositast), azt a feladatfajlban (`GY-FOGLALOMOTOR-FELADAT.md`) jovahagyasra kell tenni a meresi Claude-nak / ChatGPT-nek, Ferit NEM kerdezzuk; jovahagyas utan mehet. Ami aktiv merest vagy kampanyt erint: Feri dontese. Minden javaslat ELSO kerdese: "erinti-e az aktiv merest?"
