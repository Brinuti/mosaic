# Állapot és teendők (2026-10-26)

## Kész és tesztelt
CRM váz + RBAC + napló; vendég/foglalás/kúra/bérlet/beszámítás; állapotfelmérő; kezelői „Ma" és „Kezelés közben" vezetett folyamat; A5 kúraterv PDF; kép feltöltés/csere/törlés; kép-beérkező + PWA megosztás; üzenetmotor dry-run; marketing-kapcsoló; Salonic→Zapier→CRM lánc (valódi tesztfoglalással, lemondással); használati leírás + prospektus PDF; új landing.
Éles `/crm` védett; az éles DB-ben 0 valódi vendég (teszt-vendég anonimizálva, 1 lemondott foglalás + 2 booking_event marad – törölhetetlen).

## Hiányzik / következő lépések (sorrendben javasolt)
1. **Valódi tablet-teszt** (Samsung + hajkamera-app → Megosztás → MOSAIC CRM; USB élő kamera getUserMedia). Ez a legnagyobb kockázat, még sosem próbálták.
2. **Személyzet felvétele** (nevek, e-mailek, szerepkörök) – a tulajdonostól kell.
3. **CRM ütemező**: óránkénti `/api/crm/tick` (Zapier workflow) + `CRM_KULCS_HASH` / `CRM_TITOK` titkok a Cloudflare felületén (tulajdonosi kattintás a titkokhoz).
4. **`CRM_ATVETEL.md` státusztábla** – a tulajdonos szerint „még nem", előbb tesztelni akar.
5. **Jogi szövegek** végleges jóváhagyása; klinikai szövegek Janka általi jóváhagyása; otthoni ápolási termékek nevei.
6. **Google Naptár takarítás** a tesztfoglalásról (tulajdonos naptárában; a Composio-kapcsolathoz tulajdonosi kattintás kell).
7. Csak kifejezett „GO"-ra: `CRM_KULDES=eles`, marketing bekapcsolás, régi oxigén oldal cseréje.

## Figyelem
- A `main` 16 napot ment előre a CRM-es munka óta (más munkamenetek: MP/lifecycle); mindig `git fetch` + `git log` először.
- Új munkamenetben új ág `origin/main`-ről.
