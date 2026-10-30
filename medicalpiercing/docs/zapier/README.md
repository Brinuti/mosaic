# Zapier: az MP ARNYEK Google-feltöltő workflow és a visszahívás (UJ-61, DRAFT)

Workflow: **„MP ARNYEK - szerver → Google Ads árnyékkonverzió (2626380837)"**, ID `01a12a08-5df1-7363-bc01-de984b594c09` (durable workflow, kód-alapú). Az ÉLŐ (publikált, egyetlen) verzió: `01a12a09-2b6c-7faf-9ecf-2ece360fa789` (2026-10-11).

- `mp-arnyek-google-ads.eredeti-v01a12a09.workflow.ts` – az élő verzió forrása, **ROLLBACK-másolat** (a draft elvetése vagy a publikálás utáni visszaállítás ebből).
- `mp-arnyek-google-ads.visszahivas.workflow.ts` – az UJ-61 módosítás (a Zapier-draftban ez van).

## A módosítás lényege
A Google Ads lépés UTÁN (és minden kapu-kihagyásnál is) a workflow visszahívja a Workert: `POST https://www.medicalpiercing.hu/api/mp-google-valasz`, fejléc `x-mp-google-kulcs`; törzs `{ order_id, conversion_action_id, kod, request_id?, uzenet?, elfogadva?, elutasitva? }`. A hívás a Webhooks by Zapier akción megy, a kulcsot a Zapier Storage `mp_google_valasz_kulcs` kulcsából olvassa, egy lépésben a hívással (a futásnapló a kulcsot nem őrzi).
- **A visszahívás nem befolyásolja a feltöltést:** külön lépés, külön try/catch, a Google Ads lépés nem újrapróbálódik emiatt, `dryrun` esetén nincs visszahívás. Ha a Storage-kulcs hiányzik vagy a Worker nem válaszol, a feltöltés eredménye ugyanaz, a hiba csak a kimenet `visszahivas` mezőjében látszik.
- Kódok (`kod`): `""` = a Zapier Google Ads lépése hiba nélkül lefutott (+ `request_id`); `ZAP_HIBA` = a lépés 2 próba után hibával állt le; `ZAP_KIHAGYVA` = a kapuk (nincs hirdetési hozzájárulás, nincs / rossz kattintás-azonosító, rossz érték, nem HUF) eldobták (az ok az `uzenet`-ben). A kapu-kihagyás is visszajelzést kap, hogy a Worker `elkuldve` sora ne tűnjön elfogadottnak.
- **Fontos korlát:** a Zapier Google Ads action a Google `partialFailure` objektumát NEM adja vissza; a `""` tehát „a Zapier action nem dobott hibát" + a Google `requestId`, nem azt, hogy a Google minden sort elfogadott. A valódi partialFailure-kódokhoz közvetlen Google Ads API-hívás kellene (OAuth-tokennel), ami a mostani Zapier-hidas architektúrában nincs — külön döntés.
- Kattintás-azonosító (gclid/wbraid/gbraid/`googleClickId`), hash, e-mail, IP, user agent a visszahívásba nem kerül.

## Állapot (2026-10-24)
- Zapier-draft létrehozva: draft ID `01a16e4c-94f9-7cf1-8582-85bc31b9a8e3` (slug `uj61-visszahivas-DRAFT-ne-publikald`, revízió 1, **nem publikált**, **nem futtatott**). Az élő verzió és a trigger (catch hook) változatlan. A draft kapcsolatai: `google_ads_mp` (meglévő) és `storage` (a Mosaic-draft / lifecycle-tick meglévő Zapier Storage kapcsolata).

## Publikálás előtt (DECISION + Feri külön mondata után; ezek még NEM történtek meg)
1. A Worker oldalán: #484 merge + deploy, Cloudflare Pages `medicalpiercing` Production Secret `MP_GOOGLE_VALASZ_KULCS_HASH`.
2. Zapier Storage: kulcs `mp_google_valasz_kulcs` (≥ 32 karakter véletlen kulcs; SHA-256-ja kerül az env-be). A kulcs a repóba/commitba/chatbe/issue-ba nem kerül; előállítása és beírása úgy, hogy az ne kerüljön MCP-paraméterként a munkamenet-naplóba (módszer: külön döntés).
3. `run_workflow_draft` CSAK `dryrun:true` mintával (nincs Google-hívás, nincs visszahívás) — élő mintával nem, az élő Worker-végpontot hívná; utána egy élő eset ellenőrzése: `mp_google_valasz` sor megjelenik, a riport `google_elfogadta` nő.
4. Független review a draft forrására; `publish_workflow_draft`; **rollback** = az eredeti forrás visszatöltése (a fájl itt) vagy az előző verzió visszaállítása.
