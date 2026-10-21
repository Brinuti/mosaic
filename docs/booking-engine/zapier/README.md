# Zapier: a Google ÁRNYÉK feltöltő workflow és a visszahívás (UJ-11, DRAFT)

Workflow: **„Mosaic ARNYEK - szerver → Google Ads árnyékkonverzió (QA-2)”**, ID `01a1122c-b894-771a-a5e1-c06e6bf9fe54` (durable workflow, kód-alapú, nem klasszikus Zap). Az ÉLŐ (publikált, egyetlen) verzió: `01a1122d-fc48-75d7-b7cf-69f4bf070aeb` (2026-10-06).

- `mosaic-arnyek-google-ads.eredeti-v01a1122d.workflow.ts` – az élő verzió forrása, **ROLLBACK-másolat** (a draft elvetése vagy a publikálás utáni visszaállítás ebből).
- `mosaic-arnyek-google-ads.visszahivas.workflow.ts` – az UJ-11 módosítás (a Zapier-draftban ez van).

## A módosítás lényege
A Google Ads lépés UTÁN a workflow visszahívja a motort (`POST https://www.mosaicheadspa.hu/api/meres-google-valasz`, fejléc `x-meres-google-kulcs`), a `esemeny_id` = a bejövő `order_id` alapján. A hívás a Webhooks by Zapier akción megy (`sdk.runAction` WebHookCLIAPI/custom, mint a `lifecycle-tick` workflow-ban: a sandbox csak engedélyezett hosztokat ér el), a kulcsot a Zapier Storage `mosaic_google_valasz_kulcs` kulcsából olvassa, egy lépésben a hívással (a futásnapló a kulcsot nem őrzi).
- **A visszahívás nem befolyásolja a feltöltést:** külön lépés, külön try/catch, a Google Ads lépés nem újrapróbálódik emiatt, `dryrun` esetén nincs visszahívás. Ha a Storage-kulcs hiányzik vagy a szerver nem válaszol, a feltöltés eredménye ugyanaz marad, a hiba csak a kimenet `visszahivas` mezőjében látszik.
- Kódok (`kod`): `""` = a Zapier Google Ads lépése hiba nélkül lefutott; `ZAP_HIBA` = a lépés 2 próba után hibával állt le; `ZAP_KIHAGYVA` = a kapuk (rossz érték / nem HUF / nincs kattintásazonosító) eldobták (az ok az `uzenet`-ben).
- **Fontos korlát:** a Zapier Google Ads action a Google `partialFailure` objektumát NEM adja vissza (a három utolsó élő futás kimenete: `requestId, googleClickId, conversionName, conversionTime, conversionValue, conversionAction, conversionCurrencyCode`). A `""` tehát azt jelenti: „a Zapier action nem dobott hibát”, nem azt, hogy a Google minden sort elfogadott. A valódi partialFailure-kódokhoz (pl. `UNPARSEABLE_GCLID`) közvetlen Google Ads API-hívás kellene (OAuth-token-kezeléssel), ami a mostani Zapier-hidas architektúrában nincs.
- Kattintásazonosító (gclid/wbraid/gbraid/`googleClickId`), hash, e-mail, IP, user agent a visszahívásba nem kerül.

## Állapot (2026-10-21)
- Zapier-draft létrehozva: draft ID `01a15f66-ef0c-7fa3-8246-4ef15e3eaa10` (slug `uj11-visszahivas-DRAFT-ne-publikald`, revízió 1, **nem publikált**, nem futtatott). Az élő verzió változatlan, a trigger (catch hook) az élő verziót futtatja.
- A draft két kapcsolat-aliast használ: `google_ads_mosaic` (meglévő) és `storage` (a `lifecycle-tick` workflow meglévő Zapier Storage kapcsolata).

## Publikálás előtt (DECISION után; ezek még NEM történtek meg)
1. A motor oldalán: #461 merge + deploy, Cloudflare Pages Production Secret `MERES_GOOGLE_VALASZ_KULCS_HASH`.
2. Zapier Storage: kulcs `mosaic_google_valasz_kulcs` (≥ 32 karakter véletlen kulcs; SHA-256-ja kerül az env-be). A kulcs a repóba/commitba/chatbe nem kerül.
3. `run_workflow_draft` `dryrun:true` mintával (nincs Google-hívás, nincs visszahívás), majd egy élő ARNYÉK esemény ellenőrzése: `meres_kuldes.google_reszleges_hiba` kitöltődik.
4. Független review a draft forrására; `publish_workflow_draft`; rollback = az eredeti forrás visszatöltése (a fájl itt).
