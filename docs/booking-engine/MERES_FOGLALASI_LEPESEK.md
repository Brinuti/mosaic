# Mérés a foglalási lépések mentén: mit küld a Salonic, mit küldene a motor

Készült: 2026-10-03, éles oldalon és a Salonic nyilvános oldalain, **kimenő mérés nélkül** (alapból tiltó szűrő + DNS-zár, `tools/meres-proba/`). A Salonic-oldalakon csak oldalakat töltöttem be és kattintottam, foglalás nem jött létre. **Semmi nem épült be**, ez a leírás csak azt rögzíti, mi hiányzik és mi kellene hozzá.

> **Döntés (2026-10-03, a tulajdonostól): a C opció.** A köztes eseményeket (`view_item`, `select_employee`, `ViewContent`) nem pótoljuk, mert semmi nem épül rájuk. A 3. pont (A/B opció) csak háttér, nem épül meg.

## 1. Eredmény röviden

A Salonic **a saját oldalain** küldi ezeket az eseményeket (a mi GA4-tulajdonunkba, `G-H4206SQ0Q7`, és a mi TikTok-pixelünkre, `CTDGK5BC77U0PIODKP30`). A motor útján a vendég az adatlap előtti Salonic-oldalakat nem látja, ezért ezek közül a legtöbb nem indul el.

| Esemény | Natív Salonic-út (felső szinten) | Motor útja (az adatlap a motor oldalába ágyazva) |
|---|---|---|
| TikTok **ViewContent** („View item") | igen: a szolgáltatás kiválasztása után betöltődő `selectEmployee` oldalon | **nem** (az oldal nem töltődik be) |
| GA4 **view_item** | igen: ugyanott, a `selectEmployee` oldalon | **nem** |
| GA4 **select_employee** | igen: az adatlap (`guestData`) betöltésekor | **nem**: a Salonic-keretből egyetlen GA4-kérés sem indul (0 darab a két valódi próbán és a kontrollban sem) |
| TikTok **InitiateCheckout** („Begin checkout") | igen: az adatlap betöltésekor | **igen**: mindkét valódi próbán 1× a keretből, ~1,3 mp-cel az adatlap betöltése után (a Salonic saját pixele) |

A motor oldalán (`/foglalo-motor`) **nincs mérőkód**: se GTM, se `suti.js`, se pixel. A motor `tracking.js` modulja a `dataLayer`-be ír (`booking_service_selected`, `booking_slot_selected`, `booking_details_started`, …), de ezt senki nem olvassa, mert azon az oldalon nincs GTM. A GA4-munkamenet a motor útján a köszönőoldalon indul.

A TikTok-InitiateCheckout megléte törékeny: egy leegyszerűsített kontrollban (az adatlap egy üres oldal iframe-jében) a TikTok-pixel csak `LandingPageView` / `Pageview` eseményt küldött, `InitiateCheckout`-ot nem. A valódi motor-oldalon mindkétszer elindult, de az okát nem tudom; élesítés előtt érdemes még néhány futással megerősíteni.

## 2. Mit küld pontosan a Salonic (natív úton, fodrász-fiók, konzultáció)

- **ViewContent** (TikTok): `{ currency: HUF, value: 0, contents: [{ content_name: "Fodrász konzultáció (9.900 Ft helyett most 0 Ft!)", quantity: 1, content_type: "product" }] }`, `event_trigger_source: GoogleTagManagerClient`.
- **view_item** (GA4, stape `g/collect`): csak az esemény neve és `ep.action_source=website`; elemlista nincs; `dl` = a Salonic oldal címe.
- **select_employee** (GA4): ugyanígy csak név + `action_source`; `dl` = az adatlap címe.
- **InitiateCheckout** (TikTok): `{ currency: HUF, value: "0", contents: [{ content_name, price: 0, quantity: 1, content_type: "product" }] }`.

A GA4-események a Salonic saját tartományán (`*.salonic.hu`) futnak, így külön GA4-ügyfél és munkamenet tartozik hozzájuk, hacsak nincs tartományközi összekötés. Ha a motor ezeket a `www.mosaicheadspa.hu` oldalról küldené, a lépések ugyanabban a munkamenetben jelennének meg, mint a köszönőoldal: a tölcsér-adat alakja megváltozna (jobb lenne az attribúció, de a régi és az új adat nem hasonlítható közvetlenül).

## 3. Mi kellene ahhoz, hogy a motor küldje őket (nem épült meg)

Két dolog kell mindenképp: (1) a motor oldalán fusson a mérőkészlet, (2) a motor a megfelelő lépésnél jelezze az eseményt.

**A. Ajánlott: a meglévő mérőkészlet a motor oldalára + GTM-szabályok.**
1. A `/foglalo-motor` oldal töltse be a `suti.js`-t (GTM-PST2HB22, hozzájárulás-kezelés, süti-sáv). Ma ez nincs rajta. Következmény: a motor oldalán is lesz süti-sáv, GA4 `page_view`, és a GA4-munkamenet a motor oldalán indul, nem a köszönőoldalon (ez önmagában javítaná az attribúciót is).
2. A motor `dataLayer`-be már írja az eseményeket (`booking_service_selected` ~ a natív `selectEmployee` oldal, `booking_details_started` ~ a natív adatlap-betöltés). Ezek a név- és paraméterkészlete a MASTER SPEC 10. pontja szerinti; a Salonic-eseményekhez illő nevek és paraméterek (pl. `view_item`, `select_employee`, tárgy-azonosító, név, ár) vagy új `dataLayer`-bejegyzések, vagy a meglévők kiegészítése kellene.
3. **GTM (web) és stape (szerver) változtatás**: új eseményindítók a motor eseményeire; GA4-eseménycimkék (`view_item`, `select_employee`); TikTok `ViewContent` cimke a fenti tartalommal. Az `InitiateCheckout`-ot **nem** szabad a motorból is küldeni, mert a Salonic-keret már elküldi: dupla lenne. Ez külső fiókok módosítása, ezért csak a tulajdonos kifejezett kérésére és jóváhagyásával.
4. Hozzájárulás: a GA4 és a TikTok csak a hozzájárulás-kezelőn át mehet (ma a Salonic-oldalakon ez nem a mi süti-sávunk szerint fut).

**B. Közvetlen küldés a motor kódjából** (`gtag('event', …)`, `ttq.track(…)`): ehhez a motor oldalán be kellene tölteni a gtag-ot és a TikTok alapkódot, a stape-átvitellel, a hozzájárulás-logikával, a `ttp` süti és a `x-ttk-ck-ttp` paraméter kezelésével. Gyakorlatilag a mérőkészlet másodszori felépítése; nem javasolt.

**C. Nem pótolni.** Ha nincs olyan GA4-jelentés, hirdetési célközönség vagy TikTok-szabály, amelyik a `view_item` / `select_employee` / `ViewContent` eseményre épül, a hiány nem okoz kárt, csak a tölcsér korábbi lépései hiányoznak a motor útján. Ezt csak a tulajdonos tudja ellenőrizni (GA4 felfedezés / hirdetési célközönségek / TikTok eseménykezelő); én a fiókokhoz nem nyúltam.

**Eldöntve:** semmi nem épül ezekre az eseményekre, ezért a C pont érvényes (nem pótoljuk).
