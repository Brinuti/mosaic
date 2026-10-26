# Tulajdonosi döntések és szabályok

- **Marketing KI**: `MARKETING.be=false` (`crm/lib/constants.js`), kikényszerítve `messages/utemezo.js` és `kapuk.js`-ben. Bekapcsolás csak a tulajdonos kifejezett kérésére + jogi szövegek jóváhagyása után. (2026-10-10, „2. opció")
- **Hozzájárulás-blokk a landingen elrejtve**: a Salonicban a vendég már tölt ki hozzájárulást; a landing JS-logikája megmaradt későbbre.
- **29 üzenetsablon marad változatlan** („ne változtassunk, messze vagyunk az élesítéstől").
- **Küldés DRY-RUN** (`CRM_KULDES="dry"`); `eles` csak külön „GO"-ra (valódi vendégeknek menne levél/SMS).
- **Régi `/oxigenterapia-budapest` marad**; az új `-uj` noindex; csere csak „GO"-ra. Az élő oxigén lifecycle-üzenetek érintetlenek.
- **Azonnali élesítés** mérges nélküli változtatásra (CLAUDE.md), de nem külső/visszafordíthatatlan lépésre.
- **Éles CRM nem lehet belépés nélküli** (egészségügyi adat). Demó belépés csak előnézeten.
- **Napló append-only** (`booking_event`, audit): nem kerüljük meg; teszt-vendéget anonimizálunk.
- **Salonic reCAPTCHA-t nem kerüljük meg**; valódi teszt-foglalást a tulajdonos csinál.
- **Külső fiókok (Meta, GTM, GA, Google Ads, TikTok)**: kérés nélkül semmit se hozz létre/módosíts.
- **Fizetős külső szolgáltatás helyett saját kód.**
- **TILOS-lista** és 121 döntés: `docs/oxigen-crm/MASTERPROMPT.md` – tervezés előtt olvasd el.
- **Klinikai szövegek** (kérdőív, megfigyelés/cél chipek) a klinikai vezető (Janka) jóváhagyására várnak; jogi szövegek (hozzájárulás, adatkezelés) még „tervezet".
