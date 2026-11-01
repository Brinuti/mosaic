# gclid / gbraid / wbraid átadás: teljes próbanapló (2026-10-18)

A `tools/meres-proba/gclid-atadas-proba.mjs` futásainak összes sora (élő oldal, kimenő mérés és POST tiltva; az új oldalak a PR-ágakból épített helyi dist-tel, az éles hostnév alatt). Az összegzés és az ismert rések: [GCLID_ATADAS_PROBA.md](../docs/booking-engine/GCLID_ATADAS_PROBA.md). Besorolás: ✔ OK · rés = ISMERT_RES · ℹ megfigyelés · ✘ HIBA.

## lezer

| Lépés | | Ellenőrzés | Bizonyíték |
|---|---|---|---|
| a | ✔ | landing: mh_attr (localStorage) tartalmazza a gclid + gbraid + wbraid erteket | {"gclid":"TESZTGCLIDLEZERMVCX67CN","gbraid":"TESZTGBRAIDLEZERMVCX67CN","wbraid":"TESZTWBRAIDLEZERMVCX67CN"} |
| a | ✔ | window.mhAttribucio.pillanatkep().google egyezik | {"gclid":"TESZTGCLIDLEZERMVCX67CN","gbraid":"TESZTGBRAIDLEZERMVCX67CN","wbraid":"TESZTWBRAIDLEZERMVCX67CN"} |
| a | ℹ | sutihozzajarulas allapota | mh_cc=nincs dontes (alapertek: marketing=granted) / mod: nincs-dontes |
| a | ✔ | a Google-cimke _gcl_aw sutije tartalmazza a gclid-et | GCL.1792273180.TESZTGCLIDLEZERMVCX67CN |
| a | ℹ | gbraid / wbraid suti (_gcl_gb / _gcl_ag / _gcl_gs) a Google-cimketol | _gcl_aw,_gcl_au |
| a | ✔ | a Google-cimke fut a landingen (kimeno kerelem naplozva, tiltva) | 11 kerelem |
| b | ✔ | a landingen van olyan foglalo-CTA, amelynek parameterei a brief szerintiek (business=laser&service=konzult) | business=laser&service=konzult |
| b | ✔ | a foglalo-reteg megnyilt a CTA-ra (ugyanazon az oldalon) | /lezeres-szortelenites-budapest?gclid=TESZTGCLIDLEZERMVCX67CN&gbraid=TESZTGBRAIDLEZERMVCX67CN&wbraid=TESZTWBRAIDLEZERMVCX67CN&utm_source=google&utm_medium=cpc&u |
| b | ✔ | a reteg URL-jeben ott van a gclid + gbraid + wbraid (a motor ebbol kapja a kontextust) | /lezeres-szortelenites-budapest?gclid=TESZTGCLIDLEZERMVCX67CN&gbraid=TESZTGBRAIDLEZERMVCX67CN&wbraid=TESZTWBRAIDLEZERMVCX67CN&utm_source=google&utm_medium=cpc&utm_campaign=gclid-atadas-proba |
| b | ✔ | a tracker-esemenyeken (tracking.js: booking_service_selected, booking_slot_viewed ...) a gclid egyezik a beadottal | 2/2 esemeny: booking_service_selected,booking_slot_viewed |
| b | ℹ | a lepes-meres esemenyei (lepes-meres.js: booking_open, booking_business, booking_service, booking_slots_loaded ...) tervbol nem hordoznak kattintas-azonositot (a GA4 az oldal URL-jebol / sutibol veszi) | 4 esemeny, gclid-del: 0 |
| b | rés | R2: a gbraid / wbraid NEM kerul a booking_* dataLayer-esemenyekbe (a flow.js parseContext csak a gclid / fbclid / ttclid / utm_* mezoket veszi at); a koszonooldal URL-jebe a withAttribution fuzi | esemeny-kulcsok: utm_source,utm_medium,utm_campaign,gclid |
| b | ✔ | a stape / GA4 kimeno kerelmekben megjelenik a teszt-azonosito (booking_open ...) | 7 kerelem; stape osszes: 8 |
| c | ✔ | kozvetlen /foglalo-motor belepes: az URL megtartja a gclid + gbraid + wbraid erteket | /foglalo-motor?business=laser&service=konzult&gclid=TESZTGCLIDLEZERMVCX67CN&gbraid=TESZTGBRAIDLEZERMVCX67CN&wbraid=TESZTWBRAIDLEZERMVCX67CN&utm_source=google&utm_medium=cpc&utm_campaign=gclid-atadas-p |
| c | ℹ | kozvetlen belepes: az attribucio.js elmentette (mh_attr) | null |
| c | ✔ | a tracker-esemenyeken a gclid egyezik | 2/2 |
| c | ℹ | R4: a /foglalo-motor oldalon csak az attribucio.js tolt (nincs suti.js / Google-cimke): nincs _gcl_aw suti, es a mh_attr-ot az attribucio.js hozzajarulas-dontes nelkul nem irja (memoriabeli pillanatkep marad); a gclid az URL-ben utazik (withAttribution a koszonooldal URL-jebe, lasd h) | _gcl_aw: nincs / mh_attr: null / pillanatkep: {"gclid":"TESZTGCLIDLEZERMVCX67CN","gbraid":"TESZTGBRAIDLEZERMVCX67CN","wbraid":"TESZTWBRAIDLEZERMVCX67CN"} |
| d | ✔ | a gclid-es landing utan, az azonositok nelkuli oldalbetoltesnel a mh_attr (localStorage) megvan | {"gclid":"TESZTGCLIDLEZERMVCX67CN","gbraid":"TESZTGBRAIDLEZERMVCX67CN","wbraid":"TESZTWBRAIDLEZERMVCX67CN"} |
| d | ✔ | a _gcl_aw suti megvan a masodik oldalbetoltesnel (a Google-cimke ebbol olvassa a gclid-et) | GCL.1792273222.TESZTGCLIDLEZERMVCX67CN |
| d | rés | R1: az azonositok nelkuli oldalon nyitott foglalo-reteg URL-je / motor-kontextusa NEM hordozza a gclid-et (a motor ctx.attribution az URL-bol jon; a mh_attr-ot a motor nem olvassa) | URL: /lezeres-szortelenites-budapest |
| d | rés | R1: a tracker-esemenyeken nincs gclid | 0/2 esemeny gclid-del |
| h | ✔ | kozvetlen belepes: a foglalo vegigjarva a Salonic-lepesig (szimulalt atiranyitas) | booking_service_selected,booking_slot_viewed,booking_slot_selected,booking_details_started |
| h | ✔ | a koszonooldal URL-jeben ott van a gclid + gbraid + wbraid (withAttribution) | URL: /elysion-ok?first_booking=true&service=ARC+-+Teljes+arc&category=V%C3%A9gleges+Sz%C5%91rtelen%C3%ADt%C3%A9s+-+1.+Alkalom&price=27000&location=Mosaic+Elysion&employee=Elysion+Pro+Sz%C5%91rtelen%C3%ADt%C3%A9s&g=g%3ASZIM1793467800&bookingUrl=https%3A%2F%2Fmo |
| h | ✔ | Google Ads konverzios kerelem (pagead/ccm /conversion) a koszonooldalon | 4 kerelem, 2 egyedi cimke: LXcLCJ6ixPsbEPDs9sg-,cPOaCIHr9ogdEPDs9sg- |
| h | ℹ | a konverzios kerelmekben (url / ref / gclaw / body) megjeleno teszt-azonositok | gclid,gbraid,wbraid |
| h | ✔ | a konverzios kerelem `ref` (referrer = a landing gclid-es URL-je) tartalmaz teszt-azonositot | 4/4 kerelem |
| h | ✔ | /api/meres-erkezes POST torzse: attr.google.{gclid,gbraid,wbraid} egyezik a beadottal (tiltott, nem ment ki) | {"gclid":"TESZTGCLIDLEZERMVCX67CN","gbraid":"TESZTGBRAIDLEZERMVCX67CN","wbraid":"TESZTWBRAIDLEZERMVCX67CN"} |
| h | ✔ | a koszonooldalon a Google-cimke az URL-bol _gcl_aw sutit allit a gclid-del | GCL.1792273244.TESZTGCLIDLEZERMVCX67CN |
| h | ✔ | a koszonooldalon az attribucio.js a gclid-et elmentette (mh_attr: a suti.js alapertek-hozzajarulasa utan) | {"gclid":"TESZTGCLIDLEZERMVCX67CN","gbraid":"TESZTGBRAIDLEZERMVCX67CN","wbraid":"TESZTWBRAIDLEZERMVCX67CN"} |
| e | ✔ | a foglalo vegigjarva a Salonic-lepesig (szimulalt atiranyitas) | booking_open,booking_business,booking_service_selected,booking_service,booking_slots_loaded,booking_slot_viewed,booking_slot_selected,booking_slot,booking_details_started,booking_form_start |
| e | ✔ | a koszonooldal URL-jeben ott van a gclid + gbraid + wbraid (withAttribution) | URL: /elysion-ok?first_booking=true&service=ARC+-+Teljes+arc&category=V%C3%A9gleges+Sz%C5%91rtelen%C3%ADt%C3%A9s+-+1.+Alkalom&price=27000&location=Mosaic+Elysion&employee=Elysion+Pro+Sz%C5%91rtelen%C3%ADt%C3%A9s&g=g%3ASZIM1793467800&bookingUrl=https%3A%2F%2Fmo |
| e | ✔ | Google Ads konverzios kerelem (pagead/ccm /conversion) a koszonooldalon | 4 kerelem, 2 egyedi cimke: LXcLCJ6ixPsbEPDs9sg-,cPOaCIHr9ogdEPDs9sg- |
| e | ℹ | a konverzios kerelmekben (url / ref / gclaw / body) megjeleno teszt-azonositok | gclid,gbraid,wbraid |
| e | ✔ | a konverzios kerelem `ref` (referrer = a landing gclid-es URL-je) tartalmaz teszt-azonositot | 4/4 kerelem |
| e | ✔ | /api/meres-erkezes POST torzse: attr.google.{gclid,gbraid,wbraid} egyezik a beadottal (tiltott, nem ment ki) | {"gclid":"TESZTGCLIDLEZERMVCX67CN","gbraid":"TESZTGBRAIDLEZERMVCX67CN","wbraid":"TESZTWBRAIDLEZERMVCX67CN"} |
| e | ✔ | a koszonooldalon a mh_attr (localStorage) megvan | {"gclid":"TESZTGCLIDLEZERMVCX67CN","gbraid":"TESZTGBRAIDLEZERMVCX67CN","wbraid":"TESZTWBRAIDLEZERMVCX67CN"} |
| e | ✔ | a koszonooldalon a _gcl_aw suti megvan a gclid-del | GCL.1792273281.TESZTGCLIDLEZERMVCX67CN |
| g | ✔ | a foglalo vegigjarva a Salonic-lepesig (szimulalt atiranyitas) | booking_open,booking_business,booking_service_selected,booking_service,booking_slots_loaded,booking_slot_viewed,booking_slot_selected,booking_slot,booking_details_started,booking_form_start |
| g | rés | R1: masik oldalrol nyitott foglalonal a koszonooldal URL-jebol hianyzik a gclid / gbraid / wbraid (a withAttribution a motor win.location.search-et fuzi) | megvan az URL-ben: semmi |
| g | ✔ | Google Ads konverzios kerelem (pagead/ccm /conversion) a koszonooldalon | 4 kerelem, 2 egyedi cimke: LXcLCJ6ixPsbEPDs9sg-,cPOaCIHr9ogdEPDs9sg- |
| g | ℹ | a konverzios kerelmekben (url / ref / gclaw / body) megjeleno teszt-azonositok | gclid |
| g | ℹ | a konverzios kerelem `ref` (referrer = a landing gclid-es URL-je) tartalmaz teszt-azonositot | 0/4 kerelem |
| g | ✔ | /api/meres-erkezes POST torzse: attr.google.{gclid,gbraid,wbraid} egyezik a beadottal (tiltott, nem ment ki) | {"gclid":"TESZTGCLIDLEZERMVCX67CN","gbraid":"TESZTGBRAIDLEZERMVCX67CN","wbraid":"TESZTWBRAIDLEZERMVCX67CN"} |
| g | ✔ | a koszonooldalon a mh_attr (localStorage) megvan | {"gclid":"TESZTGCLIDLEZERMVCX67CN","gbraid":"TESZTGBRAIDLEZERMVCX67CN","wbraid":"TESZTWBRAIDLEZERMVCX67CN"} |
| g | ✔ | a koszonooldalon a _gcl_aw suti megvan a gclid-del | GCL.1792273314.TESZTGCLIDLEZERMVCX67CN |

## oxigen1

| Lépés | | Ellenőrzés | Bizonyíték |
|---|---|---|---|
| a | ✔ | landing: mh_attr (localStorage) tartalmazza a gclid + gbraid + wbraid erteket | {"gclid":"TESZTGCLIDOXIGEN1MVCX67WM","gbraid":"TESZTGBRAIDOXIGEN1MVCX67WM","wbraid":"TESZTWBRAIDOXIGEN1MVCX67WM"} |
| a | ✔ | window.mhAttribucio.pillanatkep().google egyezik | {"gclid":"TESZTGCLIDOXIGEN1MVCX67WM","gbraid":"TESZTGBRAIDOXIGEN1MVCX67WM","wbraid":"TESZTWBRAIDOXIGEN1MVCX67WM"} |
| a | ℹ | sutihozzajarulas allapota | mh_cc=nincs dontes (alapertek: marketing=granted) / mod: nincs-dontes |
| a | ✔ | a Google-cimke _gcl_aw sutije tartalmazza a gclid-et | GCL.1792273179.TESZTGCLIDOXIGEN1MVCX67WM |
| a | ℹ | gbraid / wbraid suti (_gcl_gb / _gcl_ag / _gcl_gs) a Google-cimketol | _gcl_au,_gcl_aw |
| a | ✔ | a Google-cimke fut a landingen (kimeno kerelem naplozva, tiltva) | 9 kerelem |
| b | ✔ | a landingen van olyan foglalo-CTA, amelynek parameterei a brief szerintiek (business=oxygen&service=466147) | business=oxygen&service=466147 |
| b | ✔ | a foglalo-reteg megnyilt a CTA-ra (ugyanazon az oldalon) | /oxigenterapia-budapest?gclid=TESZTGCLIDOXIGEN1MVCX67WM&gbraid=TESZTGBRAIDOXIGEN1MVCX67WM&wbraid=TESZTWBRAIDOXIGEN1MVCX67WM&utm_source=google&utm_medium=cpc&utm |
| b | ✔ | a reteg URL-jeben ott van a gclid + gbraid + wbraid (a motor ebbol kapja a kontextust) | /oxigenterapia-budapest?gclid=TESZTGCLIDOXIGEN1MVCX67WM&gbraid=TESZTGBRAIDOXIGEN1MVCX67WM&wbraid=TESZTWBRAIDOXIGEN1MVCX67WM&utm_source=google&utm_medium=cpc&utm_campaign=gclid-atadas-proba |
| b | ✔ | a tracker-esemenyeken (tracking.js: booking_service_selected, booking_slot_viewed ...) a gclid egyezik a beadottal | 2/2 esemeny: booking_service_selected,booking_slot_viewed |
| b | ℹ | a lepes-meres esemenyei (lepes-meres.js: booking_open, booking_business, booking_service, booking_slots_loaded ...) tervbol nem hordoznak kattintas-azonositot (a GA4 az oldal URL-jebol / sutibol veszi) | 4 esemeny, gclid-del: 0 |
| b | rés | R2: a gbraid / wbraid NEM kerul a booking_* dataLayer-esemenyekbe (a flow.js parseContext csak a gclid / fbclid / ttclid / utm_* mezoket veszi at); a koszonooldal URL-jebe a withAttribution fuzi | esemeny-kulcsok: utm_source,utm_medium,utm_campaign,gclid |
| b | ✔ | a stape / GA4 kimeno kerelmekben megjelenik a teszt-azonosito (booking_open ...) | 7 kerelem; stape osszes: 8 |
| c | ✔ | kozvetlen /foglalo-motor belepes: az URL megtartja a gclid + gbraid + wbraid erteket | /foglalo-motor?business=oxygen&service=466147&gclid=TESZTGCLIDOXIGEN1MVCX67WM&gbraid=TESZTGBRAIDOXIGEN1MVCX67WM&wbraid=TESZTWBRAIDOXIGEN1MVCX67WM&utm_source=google&utm_medium=cpc&utm_campaign=gclid-at |
| c | ℹ | kozvetlen belepes: az attribucio.js elmentette (mh_attr) | null |
| c | ✔ | a tracker-esemenyeken a gclid egyezik | 2/2 |
| c | ℹ | R4: a /foglalo-motor oldalon csak az attribucio.js tolt (nincs suti.js / Google-cimke): nincs _gcl_aw suti, es a mh_attr-ot az attribucio.js hozzajarulas-dontes nelkul nem irja (memoriabeli pillanatkep marad); a gclid az URL-ben utazik (withAttribution a koszonooldal URL-jebe, lasd h) | _gcl_aw: nincs / mh_attr: null / pillanatkep: {"gclid":"TESZTGCLIDOXIGEN1MVCX67WM","gbraid":"TESZTGBRAIDOXIGEN1MVCX67WM","wbraid":"TESZTWBRAIDOXIGEN1MVCX67WM"} |
| d | ✔ | a gclid-es landing utan, az azonositok nelkuli oldalbetoltesnel a mh_attr (localStorage) megvan | {"gclid":"TESZTGCLIDOXIGEN1MVCX67WM","gbraid":"TESZTGBRAIDOXIGEN1MVCX67WM","wbraid":"TESZTWBRAIDOXIGEN1MVCX67WM"} |
| d | ✔ | a _gcl_aw suti megvan a masodik oldalbetoltesnel (a Google-cimke ebbol olvassa a gclid-et) | GCL.1792273221.TESZTGCLIDOXIGEN1MVCX67WM |
| d | rés | R1: az azonositok nelkuli oldalon nyitott foglalo-reteg URL-je / motor-kontextusa NEM hordozza a gclid-et (a motor ctx.attribution az URL-bol jon; a mh_attr-ot a motor nem olvassa) | URL: /oxigenterapia-budapest |
| d | rés | R1: a tracker-esemenyeken nincs gclid | 0/2 esemeny gclid-del |
| e | ✔ | a foglalo vegigjarva a Salonic-lepesig (szimulalt atiranyitas) | booking_open,booking_business,booking_service_selected,booking_service,booking_slots_loaded,booking_slot_viewed,booking_slot_selected,booking_slot,booking_details_started,booking_form_start |
| e | ✔ | a koszonooldal URL-jeben ott van a gclid + gbraid + wbraid (withAttribution) | URL: /oxigenterapia-ok?first_booking=true&service=Hajkamer%C3%A1s+vizsg%C3%A1lat&category=Oxig%C3%A9nter%C3%A1pia+-+1.+alkalom&price=4990&location=Mosaic+Oxig%C3%A9n&employee=Menyh%C3%A1rt+M%C3%B3ni&g=g%3ASZIM1793374200&bookingUrl=https%3A%2F%2Fmosaic-oxigen.s |
| e | ✔ | Google Ads konverzios kerelem (pagead/ccm /conversion) a koszonooldalon | 4 kerelem, 2 egyedi cimke: 6oBECMPGs6kcEPDs9sg-,uImLCLLV-YgdEPDs9sg- |
| e | ℹ | a konverzios kerelmekben (url / ref / gclaw / body) megjeleno teszt-azonositok | gclid,gbraid,wbraid |
| e | ✔ | a konverzios kerelem `ref` (referrer = a landing gclid-es URL-je) tartalmaz teszt-azonositot | 4/4 kerelem |
| e | ✔ | /api/meres-erkezes POST torzse: attr.google.{gclid,gbraid,wbraid} egyezik a beadottal (tiltott, nem ment ki) | {"gclid":"TESZTGCLIDOXIGEN1MVCX67WM","gbraid":"TESZTGBRAIDOXIGEN1MVCX67WM","wbraid":"TESZTWBRAIDOXIGEN1MVCX67WM"} |
| e | ✔ | a koszonooldalon a mh_attr (localStorage) megvan | {"gclid":"TESZTGCLIDOXIGEN1MVCX67WM","gbraid":"TESZTGBRAIDOXIGEN1MVCX67WM","wbraid":"TESZTWBRAIDOXIGEN1MVCX67WM"} |
| e | ✔ | a koszonooldalon a _gcl_aw suti megvan a gclid-del | GCL.1792273263.TESZTGCLIDOXIGEN1MVCX67WM |
| g | ✔ | a foglalo vegigjarva a Salonic-lepesig (szimulalt atiranyitas) | booking_open,booking_business,booking_service_selected,booking_service,booking_slots_loaded,booking_slot_viewed,booking_slot_selected,booking_slot,booking_details_started,booking_form_start |
| g | rés | R1: masik oldalrol nyitott foglalonal a koszonooldal URL-jebol hianyzik a gclid / gbraid / wbraid (a withAttribution a motor win.location.search-et fuzi) | megvan az URL-ben: semmi |
| g | ✔ | Google Ads konverzios kerelem (pagead/ccm /conversion) a koszonooldalon | 4 kerelem, 2 egyedi cimke: 6oBECMPGs6kcEPDs9sg-,uImLCLLV-YgdEPDs9sg- |
| g | ℹ | a konverzios kerelmekben (url / ref / gclaw / body) megjeleno teszt-azonositok | gclid |
| g | ℹ | a konverzios kerelem `ref` (referrer = a landing gclid-es URL-je) tartalmaz teszt-azonositot | 0/4 kerelem |
| g | ✔ | /api/meres-erkezes POST torzse: attr.google.{gclid,gbraid,wbraid} egyezik a beadottal (tiltott, nem ment ki) | {"gclid":"TESZTGCLIDOXIGEN1MVCX67WM","gbraid":"TESZTGBRAIDOXIGEN1MVCX67WM","wbraid":"TESZTWBRAIDOXIGEN1MVCX67WM"} |
| g | ✔ | a koszonooldalon a mh_attr (localStorage) megvan | {"gclid":"TESZTGCLIDOXIGEN1MVCX67WM","gbraid":"TESZTGBRAIDOXIGEN1MVCX67WM","wbraid":"TESZTWBRAIDOXIGEN1MVCX67WM"} |
| g | ✔ | a koszonooldalon a _gcl_aw suti megvan a gclid-del | GCL.1792273294.TESZTGCLIDOXIGEN1MVCX67WM |
| h | ✔ | kozvetlen belepes: a foglalo vegigjarva a Salonic-lepesig (szimulalt atiranyitas) | booking_service_selected,booking_slot_viewed,booking_slot_selected,booking_details_started |
| h | ✔ | a koszonooldal URL-jeben ott van a gclid + gbraid + wbraid (withAttribution) | URL: /oxigenterapia-ok?first_booking=true&service=Hajkamer%C3%A1s+vizsg%C3%A1lat&category=Oxig%C3%A9nter%C3%A1pia+-+1.+alkalom&price=4990&location=Mosaic+Oxig%C3%A9n&employee=Menyh%C3%A1rt+M%C3%B3ni&g=g%3ASZIM1793374200&bookingUrl=https%3A%2F%2Fmosaic-oxigen.s |
| h | ✔ | Google Ads konverzios kerelem (pagead/ccm /conversion) a koszonooldalon | 4 kerelem, 2 egyedi cimke: 6oBECMPGs6kcEPDs9sg-,uImLCLLV-YgdEPDs9sg- |
| h | ℹ | a konverzios kerelmekben (url / ref / gclaw / body) megjeleno teszt-azonositok | gclid,gbraid,wbraid |
| h | ✔ | a konverzios kerelem `ref` (referrer = a landing gclid-es URL-je) tartalmaz teszt-azonositot | 4/4 kerelem |
| h | ✔ | /api/meres-erkezes POST torzse: attr.google.{gclid,gbraid,wbraid} egyezik a beadottal (tiltott, nem ment ki) | {"gclid":"TESZTGCLIDOXIGEN1MVCXT77G","gbraid":"TESZTGBRAIDOXIGEN1MVCXT77G","wbraid":"TESZTWBRAIDOXIGEN1MVCXT77G"} |
| h | ✔ | a koszonooldalon a Google-cimke az URL-bol _gcl_aw sutit allit a gclid-del | GCL.1792274254.TESZTGCLIDOXIGEN1MVCXT77G |
| h | ✔ | a koszonooldalon az attribucio.js a gclid-et elmentette (mh_attr: a suti.js alapertek-hozzajarulasa utan) | {"gclid":"TESZTGCLIDOXIGEN1MVCXT77G","gbraid":"TESZTGBRAIDOXIGEN1MVCXT77G","wbraid":"TESZTWBRAIDOXIGEN1MVCXT77G"} |

## oxigen0

| Lépés | | Ellenőrzés | Bizonyíték |
|---|---|---|---|
| a | ✔ | landing: mh_attr (localStorage) tartalmazza a gclid + gbraid + wbraid erteket | {"gclid":"TESZTGCLIDOXIGEN0MVCX67WM","gbraid":"TESZTGBRAIDOXIGEN0MVCX67WM","wbraid":"TESZTWBRAIDOXIGEN0MVCX67WM"} |
| a | ✔ | window.mhAttribucio.pillanatkep().google egyezik | {"gclid":"TESZTGCLIDOXIGEN0MVCX67WM","gbraid":"TESZTGBRAIDOXIGEN0MVCX67WM","wbraid":"TESZTWBRAIDOXIGEN0MVCX67WM"} |
| a | ℹ | sutihozzajarulas allapota | mh_cc=nincs dontes (alapertek: marketing=granted) / mod: nincs-dontes |
| a | ✔ | a Google-cimke _gcl_aw sutije tartalmazza a gclid-et | GCL.1792273343.TESZTGCLIDOXIGEN0MVCX67WM |
| a | ℹ | gbraid / wbraid suti (_gcl_gb / _gcl_ag / _gcl_gs) a Google-cimketol | _gcl_au,_gcl_aw |
| a | ✔ | a Google-cimke fut a landingen (kimeno kerelem naplozva, tiltva) | 9 kerelem |
| b | ✔ | a landingen van olyan foglalo-CTA, amelynek parameterei a brief szerintiek (business=oxygen&service=466110) | business=oxygen&service=466110 |
| b | ✔ | a foglalo-reteg megnyilt a CTA-ra (ugyanazon az oldalon) | /oxigenterapia-budapest?gclid=TESZTGCLIDOXIGEN0MVCX67WM&gbraid=TESZTGBRAIDOXIGEN0MVCX67WM&wbraid=TESZTWBRAIDOXIGEN0MVCX67WM&utm_source=google&utm_medium=cpc&utm |
| b | ✔ | a reteg URL-jeben ott van a gclid + gbraid + wbraid (a motor ebbol kapja a kontextust) | /oxigenterapia-budapest?gclid=TESZTGCLIDOXIGEN0MVCX67WM&gbraid=TESZTGBRAIDOXIGEN0MVCX67WM&wbraid=TESZTWBRAIDOXIGEN0MVCX67WM&utm_source=google&utm_medium=cpc&utm_campaign=gclid-atadas-proba |
| b | ✔ | a tracker-esemenyeken (tracking.js: booking_service_selected, booking_slot_viewed ...) a gclid egyezik a beadottal | 1/1 esemeny: booking_service_selected |
| b | ℹ | a lepes-meres esemenyei (lepes-meres.js: booking_open, booking_business, booking_service, booking_slots_loaded ...) tervbol nem hordoznak kattintas-azonositot (a GA4 az oldal URL-jebol / sutibol veszi) | 3 esemeny, gclid-del: 0 |
| b | rés | R2: a gbraid / wbraid NEM kerul a booking_* dataLayer-esemenyekbe (a flow.js parseContext csak a gclid / fbclid / ttclid / utm_* mezoket veszi at); a koszonooldal URL-jebe a withAttribution fuzi | esemeny-kulcsok: utm_source,utm_medium,utm_campaign,gclid |
| b | ✔ | a stape / GA4 kimeno kerelmekben megjelenik a teszt-azonosito (booking_open ...) | 6 kerelem; stape osszes: 7 |
| c | ✔ | kozvetlen /foglalo-motor belepes: az URL megtartja a gclid + gbraid + wbraid erteket | /foglalo-motor?business=oxygen&service=466110&gclid=TESZTGCLIDOXIGEN0MVCX67WM&gbraid=TESZTGBRAIDOXIGEN0MVCX67WM&wbraid=TESZTWBRAIDOXIGEN0MVCX67WM&utm_source=google&utm_medium=cpc&utm_campaign=gclid-at |
| c | ℹ | kozvetlen belepes: az attribucio.js elmentette (mh_attr) | null |
| c | ✔ | a tracker-esemenyeken a gclid egyezik | 1/1 |
| c | ℹ | R4: a /foglalo-motor oldalon csak az attribucio.js tolt (nincs suti.js / Google-cimke): nincs _gcl_aw suti, es a mh_attr-ot az attribucio.js hozzajarulas-dontes nelkul nem irja (memoriabeli pillanatkep marad); a gclid az URL-ben utazik (withAttribution a koszonooldal URL-jebe, lasd h) | _gcl_aw: nincs / mh_attr: null / pillanatkep: {"gclid":"TESZTGCLIDOXIGEN0MVCX67WM","gbraid":"TESZTGBRAIDOXIGEN0MVCX67WM","wbraid":"TESZTWBRAIDOXIGEN0MVCX67WM"} |
| d | ✔ | a gclid-es landing utan, az azonositok nelkuli oldalbetoltesnel a mh_attr (localStorage) megvan | {"gclid":"TESZTGCLIDOXIGEN0MVCX67WM","gbraid":"TESZTGBRAIDOXIGEN0MVCX67WM","wbraid":"TESZTWBRAIDOXIGEN0MVCX67WM"} |
| d | ✔ | a _gcl_aw suti megvan a masodik oldalbetoltesnel (a Google-cimke ebbol olvassa a gclid-et) | GCL.1792273400.TESZTGCLIDOXIGEN0MVCX67WM |
| d | rés | R1: az azonositok nelkuli oldalon nyitott foglalo-reteg URL-je / motor-kontextusa NEM hordozza a gclid-et (a motor ctx.attribution az URL-bol jon; a mh_attr-ot a motor nem olvassa) | URL: /oxigenterapia-budapest |
| d | rés | R1: a tracker-esemenyeken nincs gclid | 0/1 esemeny gclid-del |
| h | ✔ | kozvetlen belepes: a foglalo vegigjarva a Salonic-lepesig (szimulalt atiranyitas) | booking_service_selected,booking_filter_used,booking_slot_viewed,booking_slot_selected,booking_details_started |
| h | ✔ | a koszonooldal URL-jeben ott van a gclid + gbraid + wbraid (withAttribution) | URL: /oxigenterapia-ok?first_booking=true&service=Haj+Oxig%C3%A9nter%C3%A1pia+-+1.+alkalom&category=Oxig%C3%A9nter%C3%A1pia+-+1.+alkalom&price=29900&location=Mosaic+Oxig%C3%A9n&employee=Menyh%C3%A1rt+M%C3%B3ni&g=g%3ASZIM1793372400&bookingUrl=https%3A%2F%2Fmosa |
| h | ✔ | Google Ads konverzios kerelem (pagead/ccm /conversion) a koszonooldalon | 4 kerelem, 2 egyedi cimke: 6oBECMPGs6kcEPDs9sg-,tZ7zCLnriqwcEPDs9sg- |
| h | ℹ | a konverzios kerelmekben (url / ref / gclaw / body) megjeleno teszt-azonositok | gclid,gbraid,wbraid |
| h | ✔ | a konverzios kerelem `ref` (referrer = a landing gclid-es URL-je) tartalmaz teszt-azonositot | 4/4 kerelem |
| h | ✔ | /api/meres-erkezes POST torzse: attr.google.{gclid,gbraid,wbraid} egyezik a beadottal (tiltott, nem ment ki) | {"gclid":"TESZTGCLIDOXIGEN0MVCX67WM","gbraid":"TESZTGBRAIDOXIGEN0MVCX67WM","wbraid":"TESZTWBRAIDOXIGEN0MVCX67WM"} |
| h | ✔ | a koszonooldalon a Google-cimke az URL-bol _gcl_aw sutit allit a gclid-del | GCL.1792273423.TESZTGCLIDOXIGEN0MVCX67WM |
| h | ✔ | a koszonooldalon az attribucio.js a gclid-et elmentette (mh_attr: a suti.js alapertek-hozzajarulasa utan) | {"gclid":"TESZTGCLIDOXIGEN0MVCX67WM","gbraid":"TESZTGBRAIDOXIGEN0MVCX67WM","wbraid":"TESZTWBRAIDOXIGEN0MVCX67WM"} |
| e | ✔ | a foglalo vegigjarva a Salonic-lepesig (szimulalt atiranyitas) | booking_open,booking_business,booking_service_selected,booking_service,booking_filter_used,booking_slots_loaded,booking_slot_viewed,booking_slot_selected,booking_slot,booking_details_started,booking_form_start |
| e | ✔ | a koszonooldal URL-jeben ott van a gclid + gbraid + wbraid (withAttribution) | URL: /oxigenterapia-ok?first_booking=true&service=Haj+Oxig%C3%A9nter%C3%A1pia+-+1.+alkalom&category=Oxig%C3%A9nter%C3%A1pia+-+1.+alkalom&price=29900&location=Mosaic+Oxig%C3%A9n&employee=Menyh%C3%A1rt+M%C3%B3ni&g=g%3ASZIM1793372400&bookingUrl=https%3A%2F%2Fmosa |
| e | ✔ | Google Ads konverzios kerelem (pagead/ccm /conversion) a koszonooldalon | 4 kerelem, 2 egyedi cimke: 6oBECMPGs6kcEPDs9sg-,tZ7zCLnriqwcEPDs9sg- |
| e | ℹ | a konverzios kerelmekben (url / ref / gclaw / body) megjeleno teszt-azonositok | gclid,gbraid,wbraid |
| e | ✔ | a konverzios kerelem `ref` (referrer = a landing gclid-es URL-je) tartalmaz teszt-azonositot | 4/4 kerelem |
| e | ✔ | /api/meres-erkezes POST torzse: attr.google.{gclid,gbraid,wbraid} egyezik a beadottal (tiltott, nem ment ki) | {"gclid":"TESZTGCLIDOXIGEN0MVCX67WM","gbraid":"TESZTGBRAIDOXIGEN0MVCX67WM","wbraid":"TESZTWBRAIDOXIGEN0MVCX67WM"} |
| e | ✔ | a koszonooldalon a mh_attr (localStorage) megvan | {"gclid":"TESZTGCLIDOXIGEN0MVCX67WM","gbraid":"TESZTGBRAIDOXIGEN0MVCX67WM","wbraid":"TESZTWBRAIDOXIGEN0MVCX67WM"} |
| e | ✔ | a koszonooldalon a _gcl_aw suti megvan a gclid-del | GCL.1792273455.TESZTGCLIDOXIGEN0MVCX67WM |
| g | ✔ | a foglalo vegigjarva a Salonic-lepesig (szimulalt atiranyitas) | booking_open,booking_business,booking_service_selected,booking_service,booking_filter_used,booking_slots_loaded,booking_slot_viewed,booking_slot_selected,booking_slot,booking_details_started,booking_form_start |
| g | rés | R1: masik oldalrol nyitott foglalonal a koszonooldal URL-jebol hianyzik a gclid / gbraid / wbraid (a withAttribution a motor win.location.search-et fuzi) | megvan az URL-ben: semmi |
| g | ✔ | Google Ads konverzios kerelem (pagead/ccm /conversion) a koszonooldalon | 4 kerelem, 2 egyedi cimke: 6oBECMPGs6kcEPDs9sg-,tZ7zCLnriqwcEPDs9sg- |
| g | ℹ | a konverzios kerelmekben (url / ref / gclaw / body) megjeleno teszt-azonositok | gclid |
| g | ℹ | a konverzios kerelem `ref` (referrer = a landing gclid-es URL-je) tartalmaz teszt-azonositot | 0/4 kerelem |
| g | ✔ | /api/meres-erkezes POST torzse: attr.google.{gclid,gbraid,wbraid} egyezik a beadottal (tiltott, nem ment ki) | {"gclid":"TESZTGCLIDOXIGEN0MVCX67WM","gbraid":"TESZTGBRAIDOXIGEN0MVCX67WM","wbraid":"TESZTWBRAIDOXIGEN0MVCX67WM"} |
| g | ✔ | a koszonooldalon a mh_attr (localStorage) megvan | {"gclid":"TESZTGCLIDOXIGEN0MVCX67WM","gbraid":"TESZTGBRAIDOXIGEN0MVCX67WM","wbraid":"TESZTWBRAIDOXIGEN0MVCX67WM"} |
| g | ✔ | a koszonooldalon a _gcl_aw suti megvan a gclid-del | GCL.1792273477.TESZTGCLIDOXIGEN0MVCX67WM |

## fodrasz-konzult

| Lépés | | Ellenőrzés | Bizonyíték |
|---|---|---|---|
| a | ✔ | landing: mh_attr (localStorage) tartalmazza a gclid + gbraid + wbraid erteket | {"gclid":"TESZTGCLIDFODRASZKONZULTMVCX67M3","gbraid":"TESZTGBRAIDFODRASZKONZULTMVCX67M3","wbraid":"TESZTWBRAIDFODRASZKONZULTMVCX67M3"} |
| a | ✔ | window.mhAttribucio.pillanatkep().google egyezik | {"gclid":"TESZTGCLIDFODRASZKONZULTMVCX67M3","gbraid":"TESZTGBRAIDFODRASZKONZULTMVCX67M3","wbraid":"TESZTWBRAIDFODRASZKONZULTMVCX67M3"} |
| a | ℹ | sutihozzajarulas allapota | mh_cc=nincs dontes (alapertek: marketing=granted) / mod: nincs-dontes |
| a | ✔ | a Google-cimke _gcl_aw sutije tartalmazza a gclid-et | GCL.1792273180.TESZTGCLIDFODRASZKONZULTMVCX67M3 |
| a | ℹ | gbraid / wbraid suti (_gcl_gb / _gcl_ag / _gcl_gs) a Google-cimketol | _gcl_au,_gcl_aw |
| a | ✔ | a Google-cimke fut a landingen (kimeno kerelem naplozva, tiltva) | 9 kerelem |
| b | ✔ | a landingen van olyan foglalo-CTA, amelynek parameterei a brief szerintiek (business=hair&staff=evelin&service=konzultacio) | business=hair&staff=evelin&service=konzultacio |
| b | ✔ | a foglalo-reteg megnyilt a CTA-ra (ugyanazon az oldalon) | /noi-hajfestes-budapest?gclid=TESZTGCLIDFODRASZKONZULTMVCX67M3&gbraid=TESZTGBRAIDFODRASZKONZULTMVCX67M3&wbraid=TESZTWBRAIDFODRASZKONZULTMVCX67M3&utm_source=goog |
| b | ✔ | a reteg URL-jeben ott van a gclid + gbraid + wbraid (a motor ebbol kapja a kontextust) | /noi-hajfestes-budapest?gclid=TESZTGCLIDFODRASZKONZULTMVCX67M3&gbraid=TESZTGBRAIDFODRASZKONZULTMVCX67M3&wbraid=TESZTWBRAIDFODRASZKONZULTMVCX67M3&utm_source=google&utm_medium=cpc&utm_campaign=gclid-ata |
| b | ✔ | a tracker-esemenyeken (tracking.js: booking_service_selected, booking_slot_viewed ...) a gclid egyezik a beadottal | 3/3 esemeny: booking_service_selected,booking_filter_used,booking_slot_viewed |
| b | ℹ | a lepes-meres esemenyei (lepes-meres.js: booking_open, booking_business, booking_service, booking_slots_loaded ...) tervbol nem hordoznak kattintas-azonositot (a GA4 az oldal URL-jebol / sutibol veszi) | 4 esemeny, gclid-del: 0 |
| b | rés | R2: a gbraid / wbraid NEM kerul a booking_* dataLayer-esemenyekbe (a flow.js parseContext csak a gclid / fbclid / ttclid / utm_* mezoket veszi at); a koszonooldal URL-jebe a withAttribution fuzi | esemeny-kulcsok: utm_source,utm_medium,utm_campaign,gclid |
| b | ✔ | a stape / GA4 kimeno kerelmekben megjelenik a teszt-azonosito (booking_open ...) | 7 kerelem; stape osszes: 8 |
| c | ✔ | kozvetlen /foglalo-motor belepes: az URL megtartja a gclid + gbraid + wbraid erteket | /foglalo-motor?business=hair&staff=evelin&service=konzultacio&gclid=TESZTGCLIDFODRASZKONZULTMVCX67M3&gbraid=TESZTGBRAIDFODRASZKONZULTMVCX67M3&wbraid=TESZTWBRAIDFODRASZKONZULTMVCX67M3&utm_source=google |
| c | ℹ | kozvetlen belepes: az attribucio.js elmentette (mh_attr) | null |
| c | ✔ | a tracker-esemenyeken a gclid egyezik | 3/3 |
| c | ℹ | R4: a /foglalo-motor oldalon csak az attribucio.js tolt (nincs suti.js / Google-cimke): nincs _gcl_aw suti, es a mh_attr-ot az attribucio.js hozzajarulas-dontes nelkul nem irja (memoriabeli pillanatkep marad); a gclid az URL-ben utazik (withAttribution a koszonooldal URL-jebe, lasd h) | _gcl_aw: nincs / mh_attr: null / pillanatkep: {"gclid":"TESZTGCLIDFODRASZKONZULTMVCX67M3","gbraid":"TESZTGBRAIDFODRASZKONZULTMVCX67M3","wbraid":"TESZTWBRAIDFODRASZKONZULTMVCX67M3"} |
| d | ✔ | a gclid-es landing utan, az azonositok nelkuli oldalbetoltesnel a mh_attr (localStorage) megvan | {"gclid":"TESZTGCLIDFODRASZKONZULTMVCX67M3","gbraid":"TESZTGBRAIDFODRASZKONZULTMVCX67M3","wbraid":"TESZTWBRAIDFODRASZKONZULTMVCX67M3"} |
| d | ✔ | a _gcl_aw suti megvan a masodik oldalbetoltesnel (a Google-cimke ebbol olvassa a gclid-et) | GCL.1792273225.TESZTGCLIDFODRASZKONZULTMVCX67M3 |
| d | rés | R1: az azonositok nelkuli oldalon nyitott foglalo-reteg URL-je / motor-kontextusa NEM hordozza a gclid-et (a motor ctx.attribution az URL-bol jon; a mh_attr-ot a motor nem olvassa) | URL: /noi-hajfestes-budapest |
| d | rés | R1: a tracker-esemenyeken nincs gclid | 0/3 esemeny gclid-del |
| h | ✔ | kozvetlen belepes: a foglalo vegigjarva a Salonic-lepesig (szimulalt atiranyitas) | booking_service_selected,booking_filter_used,booking_slot_viewed,booking_slot_selected,booking_details_started |
| h | ✔ | a koszonooldal URL-jeben ott van a gclid + gbraid + wbraid (withAttribution) | URL: /fodrasz-ok?first_booking=true&service=Fodr%C3%A1sz+konzult%C3%A1ci%C3%B3&category=Ingyenes+Fodr%C3%A1sz+konzult%C3%A1ci%C3%B3&price=0&location=Mosaic+Hair&employee=Evelin&g=g%3ASZIM1793194200&bookingUrl=https%3A%2F%2Fmosaic-hair.salonic.hu%2FguestData%2F |
| h | ✔ | Google Ads konverzios kerelem (pagead/ccm /conversion) a koszonooldalon | 2 kerelem, 1 egyedi cimke: DnDNCNTRiIkdEPDs9sg- |
| h | ℹ | a konverzios kerelmekben (url / ref / gclaw / body) megjeleno teszt-azonositok | gclid,gbraid,wbraid |
| h | ✔ | a konverzios kerelem `ref` (referrer = a landing gclid-es URL-je) tartalmaz teszt-azonositot | 2/2 kerelem |
| h | ✔ | /api/meres-erkezes POST torzse: attr.google.{gclid,gbraid,wbraid} egyezik a beadottal (tiltott, nem ment ki) | {"gclid":"TESZTGCLIDFODRASZKONZULTMVCX67M3","gbraid":"TESZTGBRAIDFODRASZKONZULTMVCX67M3","wbraid":"TESZTWBRAIDFODRASZKONZULTMVCX67M3"} |
| h | ✔ | a koszonooldalon a Google-cimke az URL-bol _gcl_aw sutit allit a gclid-del | GCL.1792273252.TESZTGCLIDFODRASZKONZULTMVCX67M3 |
| h | ✔ | a koszonooldalon az attribucio.js a gclid-et elmentette (mh_attr: a suti.js alapertek-hozzajarulasa utan) | {"gclid":"TESZTGCLIDFODRASZKONZULTMVCX67M3","gbraid":"TESZTGBRAIDFODRASZKONZULTMVCX67M3","wbraid":"TESZTWBRAIDFODRASZKONZULTMVCX67M3"} |
| e | ✔ | a foglalo vegigjarva a Salonic-lepesig (szimulalt atiranyitas) | booking_open,booking_business,booking_service_selected,booking_service,booking_filter_used,booking_slots_loaded,booking_slot_viewed,booking_slot_selected,booking_slot,booking_details_started,booking_form_start |
| e | ✔ | a koszonooldal URL-jeben ott van a gclid + gbraid + wbraid (withAttribution) | URL: /fodrasz-ok?first_booking=true&service=Fodr%C3%A1sz+konzult%C3%A1ci%C3%B3&category=Ingyenes+Fodr%C3%A1sz+konzult%C3%A1ci%C3%B3&price=0&location=Mosaic+Hair&employee=Evelin&g=g%3ASZIM1793194200&bookingUrl=https%3A%2F%2Fmosaic-hair.salonic.hu%2FguestData%2F |
| e | ✔ | Google Ads konverzios kerelem (pagead/ccm /conversion) a koszonooldalon | 2 kerelem, 1 egyedi cimke: DnDNCNTRiIkdEPDs9sg- |
| e | ℹ | a konverzios kerelmekben (url / ref / gclaw / body) megjeleno teszt-azonositok | gclid,gbraid,wbraid |
| e | ✔ | a konverzios kerelem `ref` (referrer = a landing gclid-es URL-je) tartalmaz teszt-azonositot | 2/2 kerelem |
| e | ✔ | /api/meres-erkezes POST torzse: attr.google.{gclid,gbraid,wbraid} egyezik a beadottal (tiltott, nem ment ki) | {"gclid":"TESZTGCLIDFODRASZKONZULTMVCX67M3","gbraid":"TESZTGBRAIDFODRASZKONZULTMVCX67M3","wbraid":"TESZTWBRAIDFODRASZKONZULTMVCX67M3"} |
| e | ✔ | a koszonooldalon a mh_attr (localStorage) megvan | {"gclid":"TESZTGCLIDFODRASZKONZULTMVCX67M3","gbraid":"TESZTGBRAIDFODRASZKONZULTMVCX67M3","wbraid":"TESZTWBRAIDFODRASZKONZULTMVCX67M3"} |
| e | ✔ | a koszonooldalon a _gcl_aw suti megvan a gclid-del | GCL.1792273287.TESZTGCLIDFODRASZKONZULTMVCX67M3 |
| g | ✔ | a foglalo vegigjarva a Salonic-lepesig (szimulalt atiranyitas) | booking_open,booking_business,booking_service_selected,booking_service,booking_filter_used,booking_slots_loaded,booking_slot_viewed,booking_slot_selected,booking_slot,booking_details_started,booking_form_start,booking_submit |
| g | rés | R1: masik oldalrol nyitott foglalonal a koszonooldal URL-jebol hianyzik a gclid / gbraid / wbraid (a withAttribution a motor win.location.search-et fuzi) | megvan az URL-ben: semmi |
| g | ✔ | Google Ads konverzios kerelem (pagead/ccm /conversion) a koszonooldalon | 2 kerelem, 1 egyedi cimke: DnDNCNTRiIkdEPDs9sg- |
| g | ℹ | a konverzios kerelmekben (url / ref / gclaw / body) megjeleno teszt-azonositok | gclid |
| g | ℹ | a konverzios kerelem `ref` (referrer = a landing gclid-es URL-je) tartalmaz teszt-azonositot | 0/2 kerelem |
| g | ✔ | /api/meres-erkezes POST torzse: attr.google.{gclid,gbraid,wbraid} egyezik a beadottal (tiltott, nem ment ki) | {"gclid":"TESZTGCLIDFODRASZKONZULTMVCX67M3","gbraid":"TESZTGBRAIDFODRASZKONZULTMVCX67M3","wbraid":"TESZTWBRAIDFODRASZKONZULTMVCX67M3"} |
| g | ✔ | a koszonooldalon a mh_attr (localStorage) megvan | {"gclid":"TESZTGCLIDFODRASZKONZULTMVCX67M3","gbraid":"TESZTGBRAIDFODRASZKONZULTMVCX67M3","wbraid":"TESZTWBRAIDFODRASZKONZULTMVCX67M3"} |
| g | ✔ | a koszonooldalon a _gcl_aw suti megvan a gclid-del | GCL.1792273316.TESZTGCLIDFODRASZKONZULTMVCX67M3 |

## fodrasz-festes

| Lépés | | Ellenőrzés | Bizonyíték |
|---|---|---|---|
| a | ✔ | landing: mh_attr (localStorage) tartalmazza a gclid + gbraid + wbraid erteket | {"gclid":"TESZTGCLIDFODRASZFESTESMVCX67M3","gbraid":"TESZTGBRAIDFODRASZFESTESMVCX67M3","wbraid":"TESZTWBRAIDFODRASZFESTESMVCX67M3"} |
| a | ✔ | window.mhAttribucio.pillanatkep().google egyezik | {"gclid":"TESZTGCLIDFODRASZFESTESMVCX67M3","gbraid":"TESZTGBRAIDFODRASZFESTESMVCX67M3","wbraid":"TESZTWBRAIDFODRASZFESTESMVCX67M3"} |
| a | ℹ | sutihozzajarulas allapota | mh_cc=nincs dontes (alapertek: marketing=granted) / mod: nincs-dontes |
| a | ✔ | a Google-cimke _gcl_aw sutije tartalmazza a gclid-et | GCL.1792273370.TESZTGCLIDFODRASZFESTESMVCX67M3 |
| a | ℹ | gbraid / wbraid suti (_gcl_gb / _gcl_ag / _gcl_gs) a Google-cimketol | _gcl_au,_gcl_aw |
| a | ✔ | a Google-cimke fut a landingen (kimeno kerelem naplozva, tiltva) | 9 kerelem |
| b | ✔ | a landingen van olyan foglalo-CTA, amelynek parameterei a brief szerintiek (business=hair&staff=evelin&category=color) | business=hair&staff=evelin&category=color |
| b | ✔ | a foglalo-reteg megnyilt a CTA-ra (ugyanazon az oldalon) | /noi-hajfestes-budapest?gclid=TESZTGCLIDFODRASZFESTESMVCX67M3&gbraid=TESZTGBRAIDFODRASZFESTESMVCX67M3&wbraid=TESZTWBRAIDFODRASZFESTESMVCX67M3&utm_source=google& |
| b | ✔ | a reteg URL-jeben ott van a gclid + gbraid + wbraid (a motor ebbol kapja a kontextust) | /noi-hajfestes-budapest?gclid=TESZTGCLIDFODRASZFESTESMVCX67M3&gbraid=TESZTGBRAIDFODRASZFESTESMVCX67M3&wbraid=TESZTWBRAIDFODRASZFESTESMVCX67M3&utm_source=google&utm_medium=cpc&utm_campaign=gclid-atadas |
| b | ✔ | a tracker-esemenyeken (tracking.js: booking_service_selected, booking_slot_viewed ...) a gclid egyezik a beadottal | 2/2 esemeny: booking_intent_selected,booking_filter_used |
| b | ℹ | a lepes-meres esemenyei (lepes-meres.js: booking_open, booking_business, booking_service, booking_slots_loaded ...) tervbol nem hordoznak kattintas-azonositot (a GA4 az oldal URL-jebol / sutibol veszi) | 2 esemeny, gclid-del: 0 |
| b | rés | R2: a gbraid / wbraid NEM kerul a booking_* dataLayer-esemenyekbe (a flow.js parseContext csak a gclid / fbclid / ttclid / utm_* mezoket veszi at); a koszonooldal URL-jebe a withAttribution fuzi | esemeny-kulcsok: utm_source,utm_medium,utm_campaign,gclid |
| b | ✔ | a stape / GA4 kimeno kerelmekben megjelenik a teszt-azonosito (booking_open ...) | 5 kerelem; stape osszes: 6 |
| c | ✔ | kozvetlen /foglalo-motor belepes: az URL megtartja a gclid + gbraid + wbraid erteket | /foglalo-motor?business=hair&staff=evelin&category=color&gclid=TESZTGCLIDFODRASZFESTESMVCX67M3&gbraid=TESZTGBRAIDFODRASZFESTESMVCX67M3&wbraid=TESZTWBRAIDFODRASZFESTESMVCX67M3&utm_source=google&utm_med |
| c | ℹ | kozvetlen belepes: az attribucio.js elmentette (mh_attr) | null |
| c | ✔ | a tracker-esemenyeken a gclid egyezik | 2/2 |
| c | ℹ | R4: a /foglalo-motor oldalon csak az attribucio.js tolt (nincs suti.js / Google-cimke): nincs _gcl_aw suti, es a mh_attr-ot az attribucio.js hozzajarulas-dontes nelkul nem irja (memoriabeli pillanatkep marad); a gclid az URL-ben utazik (withAttribution a koszonooldal URL-jebe, lasd h) | _gcl_aw: nincs / mh_attr: null / pillanatkep: {"gclid":"TESZTGCLIDFODRASZFESTESMVCX67M3","gbraid":"TESZTGBRAIDFODRASZFESTESMVCX67M3","wbraid":"TESZTWBRAIDFODRASZFESTESMVCX67M3"} |
| d | ✔ | a gclid-es landing utan, az azonositok nelkuli oldalbetoltesnel a mh_attr (localStorage) megvan | {"gclid":"TESZTGCLIDFODRASZFESTESMVCX67M3","gbraid":"TESZTGBRAIDFODRASZFESTESMVCX67M3","wbraid":"TESZTWBRAIDFODRASZFESTESMVCX67M3"} |
| d | ✔ | a _gcl_aw suti megvan a masodik oldalbetoltesnel (a Google-cimke ebbol olvassa a gclid-et) | GCL.1792273420.TESZTGCLIDFODRASZFESTESMVCX67M3 |
| d | rés | R1: az azonositok nelkuli oldalon nyitott foglalo-reteg URL-je / motor-kontextusa NEM hordozza a gclid-et (a motor ctx.attribution az URL-bol jon; a mh_attr-ot a motor nem olvassa) | URL: /noi-hajfestes-budapest |
| d | rés | R1: a tracker-esemenyeken nincs gclid | 0/2 esemeny gclid-del |
| h | ✔ | kozvetlen belepes: a foglalo vegigjarva a Salonic-lepesig (szimulalt atiranyitas) | booking_intent_selected,booking_filter_used,booking_service_selected,booking_slot_viewed,booking_slot_selected,booking_details_started |
| h | ✔ | a koszonooldal URL-jeben ott van a gclid + gbraid + wbraid (withAttribution) | URL: /fodrasz-ok?first_booking=true&service=Fodr%C3%A1sz+konzult%C3%A1ci%C3%B3&category=Ingyenes+Fodr%C3%A1sz+konzult%C3%A1ci%C3%B3&price=0&location=Mosaic+Hair&employee=Evelin&g=g%3ASZIM1793376000&bookingUrl=https%3A%2F%2Fmosaic-hair.salonic.hu%2FguestData%2F |
| h | ✔ | Google Ads konverzios kerelem (pagead/ccm /conversion) a koszonooldalon | 2 kerelem, 1 egyedi cimke: DnDNCNTRiIkdEPDs9sg- |
| h | ℹ | a konverzios kerelmekben (url / ref / gclaw / body) megjeleno teszt-azonositok | gclid,gbraid,wbraid |
| h | ✔ | a konverzios kerelem `ref` (referrer = a landing gclid-es URL-je) tartalmaz teszt-azonositot | 2/2 kerelem |
| h | ✔ | /api/meres-erkezes POST torzse: attr.google.{gclid,gbraid,wbraid} egyezik a beadottal (tiltott, nem ment ki) | {"gclid":"TESZTGCLIDFODRASZFESTESMVCXT775","gbraid":"TESZTGBRAIDFODRASZFESTESMVCXT775","wbraid":"TESZTWBRAIDFODRASZFESTESMVCXT775"} |
| h | ✔ | a koszonooldalon a Google-cimke az URL-bol _gcl_aw sutit allit a gclid-del | GCL.1792274259.TESZTGCLIDFODRASZFESTESMVCXT775 |
| h | ✔ | a koszonooldalon az attribucio.js a gclid-et elmentette (mh_attr: a suti.js alapertek-hozzajarulasa utan) | {"gclid":"TESZTGCLIDFODRASZFESTESMVCXT775","gbraid":"TESZTGBRAIDFODRASZFESTESMVCXT775","wbraid":"TESZTWBRAIDFODRASZFESTESMVCXT775"} |
| e | ✔ | a foglalo vegigjarva a Salonic-lepesig (szimulalt atiranyitas) | booking_open,booking_business,booking_intent_selected,booking_filter_used,booking_service_selected,booking_service,booking_slots_loaded,booking_slot_viewed,booking_slot_selected,booking_slot,booking_details_started,booking_form_start |
| e | ✔ | a koszonooldal URL-jeben ott van a gclid + gbraid + wbraid (withAttribution) | URL: /fodrasz-ok?first_booking=true&service=Fodr%C3%A1sz+konzult%C3%A1ci%C3%B3&category=Ingyenes+Fodr%C3%A1sz+konzult%C3%A1ci%C3%B3&price=0&location=Mosaic+Hair&employee=Evelin&g=g%3ASZIM1793376000&bookingUrl=https%3A%2F%2Fmosaic-hair.salonic.hu%2FguestData%2F |
| e | ✔ | Google Ads konverzios kerelem (pagead/ccm /conversion) a koszonooldalon | 2 kerelem, 1 egyedi cimke: DnDNCNTRiIkdEPDs9sg- |
| e | ℹ | a konverzios kerelmekben (url / ref / gclaw / body) megjeleno teszt-azonositok | gclid,gbraid,wbraid |
| e | ✔ | a konverzios kerelem `ref` (referrer = a landing gclid-es URL-je) tartalmaz teszt-azonositot | 2/2 kerelem |
| e | ✔ | /api/meres-erkezes POST torzse: attr.google.{gclid,gbraid,wbraid} egyezik a beadottal (tiltott, nem ment ki) | {"gclid":"TESZTGCLIDFODRASZFESTESMVCXT775","gbraid":"TESZTGBRAIDFODRASZFESTESMVCXT775","wbraid":"TESZTWBRAIDFODRASZFESTESMVCXT775"} |
| e | ✔ | a koszonooldalon a mh_attr (localStorage) megvan | {"gclid":"TESZTGCLIDFODRASZFESTESMVCXT775","gbraid":"TESZTGBRAIDFODRASZFESTESMVCXT775","wbraid":"TESZTWBRAIDFODRASZFESTESMVCXT775"} |
| e | ✔ | a koszonooldalon a _gcl_aw suti megvan a gclid-del | GCL.1792274290.TESZTGCLIDFODRASZFESTESMVCXT775 |
| g | ✔ | a foglalo vegigjarva a Salonic-lepesig (szimulalt atiranyitas) | booking_open,booking_business,booking_intent_selected,booking_filter_used,booking_service_selected,booking_service,booking_slots_loaded,booking_slot_viewed,booking_slot_selected,booking_slot,booking_details_started,booking_form_start |
| g | rés | R1: masik oldalrol nyitott foglalonal a koszonooldal URL-jebol hianyzik a gclid / gbraid / wbraid (a withAttribution a motor win.location.search-et fuzi) | megvan az URL-ben: semmi |
| g | ✔ | Google Ads konverzios kerelem (pagead/ccm /conversion) a koszonooldalon | 2 kerelem, 1 egyedi cimke: DnDNCNTRiIkdEPDs9sg- |
| g | ℹ | a konverzios kerelmekben (url / ref / gclaw / body) megjeleno teszt-azonositok | gclid |
| g | ℹ | a konverzios kerelem `ref` (referrer = a landing gclid-es URL-je) tartalmaz teszt-azonositot | 0/2 kerelem |
| g | ✔ | /api/meres-erkezes POST torzse: attr.google.{gclid,gbraid,wbraid} egyezik a beadottal (tiltott, nem ment ki) | {"gclid":"TESZTGCLIDFODRASZFESTESMVCXT775","gbraid":"TESZTGBRAIDFODRASZFESTESMVCXT775","wbraid":"TESZTWBRAIDFODRASZFESTESMVCXT775"} |
| g | ✔ | a koszonooldalon a mh_attr (localStorage) megvan | {"gclid":"TESZTGCLIDFODRASZFESTESMVCXT775","gbraid":"TESZTGBRAIDFODRASZFESTESMVCXT775","wbraid":"TESZTWBRAIDFODRASZFESTESMVCXT775"} |
| g | ✔ | a koszonooldalon a _gcl_aw suti megvan a gclid-del | GCL.1792274311.TESZTGCLIDFODRASZFESTESMVCXT775 |

## pmu-smink

| Lépés | | Ellenőrzés | Bizonyíték |
|---|---|---|---|
| a | ✔ | landing: mh_attr (localStorage) tartalmazza a gclid + gbraid + wbraid erteket | {"gclid":"TESZTGCLIDPMUSMINKMVCX67XN","gbraid":"TESZTGBRAIDPMUSMINKMVCX67XN","wbraid":"TESZTWBRAIDPMUSMINKMVCX67XN"} |
| a | ✔ | window.mhAttribucio.pillanatkep().google egyezik | {"gclid":"TESZTGCLIDPMUSMINKMVCX67XN","gbraid":"TESZTGBRAIDPMUSMINKMVCX67XN","wbraid":"TESZTWBRAIDPMUSMINKMVCX67XN"} |
| a | ℹ | sutihozzajarulas allapota | mh_cc=nincs dontes (alapertek: marketing=granted) / mod: nincs-dontes |
| a | ✔ | a Google-cimke _gcl_aw sutije tartalmazza a gclid-et | GCL.1792273179.TESZTGCLIDPMUSMINKMVCX67XN |
| a | ℹ | gbraid / wbraid suti (_gcl_gb / _gcl_ag / _gcl_gs) a Google-cimketol | _gcl_au,_gcl_aw |
| a | ✔ | a Google-cimke fut a landingen (kimeno kerelem naplozva, tiltva) | 9 kerelem |
| b | ✔ | a beagyazott PMU-foglalo (foglalo-pmu keret) az oldalon | /foglalo-pmu?beagyazva=1 |
| b | rés | R3: a PMU beagyazott foglalo kereteben (iframe src) nincs gclid; a foglalo-pmu.js nem kezel kattintas-azonositot (PMU_LIVE_ADAPTER_FINDINGS.md), az attribucio.js keretben nem gyujt (w.top !== w.self) | a szulo oldalon a mh_attr megvan (a): a localStorage kozos a keretekkel |
| e | ℹ | PMU: a koszonooldal szimulalt top-navigacioja (a foglalo-pmu.js mhKeretbenOldal ezt teszi: a Salonic URL-je + mh_proba=pmu) | /pmu-ok?first_booking=true&service=Sz%C3%A1jtetov%C3%A1l%C3%A1s&category=PMU&price=99000&location=Mosaic+PMU&employee=T%C3%B6reki+Melitta&g=g%3ASZIM1&bookingUrl |
| e | rés | R3: PMU beagyazott ut: a koszonooldal URL-jeben nincs gclid / gbraid / wbraid (a foglalo-pmu.js a Salonic altal adott URL-re navigalja a top ablakot + mh_proba=pmu; nincs withAttribution); a mh_attr / _gcl_aw / referrer megvan | megvan az URL-ben: semmi |
| e | ✔ | Google Ads konverzios kerelem (pagead/ccm /conversion) a koszonooldalon | 4 kerelem, 2 egyedi cimke: LUiYCNWY-tocEPDs9sg-,LNuBCOKivIkdEPDs9sg- |
| e | ℹ | a konverzios kerelmekben (url / ref / gclaw / body) megjeleno teszt-azonositok | gclid,gbraid,wbraid |
| e | ✔ | a konverzios kerelem `ref` (referrer = a landing gclid-es URL-je) tartalmaz teszt-azonositot | 4/4 kerelem |
| e | ✔ | /api/meres-erkezes POST torzse: attr.google.{gclid,gbraid,wbraid} egyezik a beadottal (tiltott, nem ment ki) | {"gclid":"TESZTGCLIDPMUSMINKMVCX67XN","gbraid":"TESZTGBRAIDPMUSMINKMVCX67XN","wbraid":"TESZTWBRAIDPMUSMINKMVCX67XN"} |
| e | ✔ | PMU koszonooldal: a mh_attr (localStorage) megvan | {"gclid":"TESZTGCLIDPMUSMINKMVCX67XN","gbraid":"TESZTGBRAIDPMUSMINKMVCX67XN","wbraid":"TESZTWBRAIDPMUSMINKMVCX67XN"} |
| e | ✔ | PMU koszonooldal: _gcl_aw suti a gclid-del | GCL.1792273205.TESZTGCLIDPMUSMINKMVCX67XN |

## pmu-szaj

| Lépés | | Ellenőrzés | Bizonyíték |
|---|---|---|---|
| a | ✔ | landing: mh_attr (localStorage) tartalmazza a gclid + gbraid + wbraid erteket | {"gclid":"TESZTGCLIDPMUSZAJMVCX67XN","gbraid":"TESZTGBRAIDPMUSZAJMVCX67XN","wbraid":"TESZTWBRAIDPMUSZAJMVCX67XN"} |
| a | ✔ | window.mhAttribucio.pillanatkep().google egyezik | {"gclid":"TESZTGCLIDPMUSZAJMVCX67XN","gbraid":"TESZTGBRAIDPMUSZAJMVCX67XN","wbraid":"TESZTWBRAIDPMUSZAJMVCX67XN"} |
| a | ℹ | sutihozzajarulas allapota | mh_cc=nincs dontes (alapertek: marketing=granted) / mod: nincs-dontes |
| a | ✔ | a Google-cimke _gcl_aw sutije tartalmazza a gclid-et | GCL.1792273223.TESZTGCLIDPMUSZAJMVCX67XN |
| a | ℹ | gbraid / wbraid suti (_gcl_gb / _gcl_ag / _gcl_gs) a Google-cimketol | _gcl_aw,_gcl_au |
| a | ✔ | a Google-cimke fut a landingen (kimeno kerelem naplozva, tiltva) | 11 kerelem |
| b | ✔ | a beagyazott PMU-foglalo (foglalo-pmu keret) az oldalon | /foglalo-pmu?beagyazva=1&terulet=ajak&forras=szajtetovalas-budapest |
| b | rés | R3: a PMU beagyazott foglalo kereteben (iframe src) nincs gclid; a foglalo-pmu.js nem kezel kattintas-azonositot (PMU_LIVE_ADAPTER_FINDINGS.md), az attribucio.js keretben nem gyujt (w.top !== w.self) | a szulo oldalon a mh_attr megvan (a): a localStorage kozos a keretekkel |
| e | ℹ | PMU: a koszonooldal szimulalt top-navigacioja (a foglalo-pmu.js mhKeretbenOldal ezt teszi: a Salonic URL-je + mh_proba=pmu) | /pmu-ok?first_booking=true&service=Sz%C3%A1jtetov%C3%A1l%C3%A1s&category=PMU&price=99000&location=Mosaic+PMU&employee=T%C3%B6reki+Melitta&g=g%3ASZIM1&bookingUrl |
| e | rés | R3: PMU beagyazott ut: a koszonooldal URL-jeben nincs gclid / gbraid / wbraid (a foglalo-pmu.js a Salonic altal adott URL-re navigalja a top ablakot + mh_proba=pmu; nincs withAttribution); a mh_attr / _gcl_aw / referrer megvan | megvan az URL-ben: semmi |
| e | ✔ | Google Ads konverzios kerelem (pagead/ccm /conversion) a koszonooldalon | 4 kerelem, 2 egyedi cimke: LUiYCNWY-tocEPDs9sg-,LNuBCOKivIkdEPDs9sg- |
| e | ℹ | a konverzios kerelmekben (url / ref / gclaw / body) megjeleno teszt-azonositok | gclid,gbraid,wbraid |
| e | ✔ | a konverzios kerelem `ref` (referrer = a landing gclid-es URL-je) tartalmaz teszt-azonositot | 4/4 kerelem |
| e | ✔ | /api/meres-erkezes POST torzse: attr.google.{gclid,gbraid,wbraid} egyezik a beadottal (tiltott, nem ment ki) | {"gclid":"TESZTGCLIDPMUSZAJMVCX67XN","gbraid":"TESZTGBRAIDPMUSZAJMVCX67XN","wbraid":"TESZTWBRAIDPMUSZAJMVCX67XN"} |
| e | ✔ | PMU koszonooldal: a mh_attr (localStorage) megvan | {"gclid":"TESZTGCLIDPMUSZAJMVCX67XN","gbraid":"TESZTGBRAIDPMUSZAJMVCX67XN","wbraid":"TESZTWBRAIDPMUSZAJMVCX67XN"} |
| e | ✔ | PMU koszonooldal: _gcl_aw suti a gclid-del | GCL.1792273252.TESZTGCLIDPMUSZAJMVCX67XN |

## redirect

| Lépés | | Ellenőrzés | Bizonyíték |
|---|---|---|---|
| f | ℹ | /idpontfoglalas nem atiranyit (a sajat oldala) | allapot: 200 |
| f | ℹ | /mosaic-hair-idopontfoglalas nem atiranyit (a sajat oldala) | allapot: 200 |
| f | ✔ | /noi-hajfestes-budapest-uj -> a Location megtartja a gclid + gbraid + wbraid erteket | /noi-hajfestes-budapest?gclid=TESZTGCLIDREDIRMVCX67XN&gbraid=TESZTGBRAIDREDIRMVCX67XN&wbraid=TESZTWBRAIDREDIRMVCX67XN&utm_source=google&utm_medium=cpc&utm_campaign=gclid-atadas-proba |
| f | ✔ | /lezeres-szortelenites-budapest-uj -> a Location megtartja a gclid + gbraid + wbraid erteket | /lezeres-szortelenites-budapest?gclid=TESZTGCLIDREDIRMVCX67XN&gbraid=TESZTGBRAIDREDIRMVCX67XN&wbraid=TESZTWBRAIDREDIRMVCX67XN&utm_source=google&utm_medium=cpc&utm_campaign=gclid-atadas-proba |
| f | ✔ | /contact -> a Location megtartja a gclid + gbraid + wbraid erteket | /?gclid=TESZTGCLIDREDIRMVCX67XN&gbraid=TESZTGBRAIDREDIRMVCX67XN&wbraid=TESZTWBRAIDREDIRMVCX67XN&utm_source=google&utm_medium=cpc&utm_campaign=gclid-atadas-proba |
| f | ✔ | /headspa-budapest/ -> a Location megtartja a gclid + gbraid + wbraid erteket | /headspa-budapest?gclid=TESZTGCLIDREDIRMVCX67XN&gbraid=TESZTGBRAIDREDIRMVCX67XN&wbraid=TESZTWBRAIDREDIRMVCX67XN&utm_source=google&utm_medium=cpc&utm_campaign=gclid-atadas-proba |
| f | ✔ | /lezeres-szortelenites-budapest.html -> a Location megtartja a gclid + gbraid + wbraid erteket | /lezeres-szortelenites-budapest?gclid=TESZTGCLIDREDIRMVCX67XN&gbraid=TESZTGBRAIDREDIRMVCX67XN&wbraid=TESZTWBRAIDREDIRMVCX67XN&utm_source=google&utm_medium=cpc&utm_campaign=gclid-atadas-proba |
| f | ✔ | /fodraszat-foglalas -> a Location megtartja a gclid + gbraid + wbraid erteket | /?gclid=TESZTGCLIDREDIRMVCX67XN&gbraid=TESZTGBRAIDREDIRMVCX67XN&wbraid=TESZTWBRAIDREDIRMVCX67XN&utm_source=google&utm_medium=cpc&utm_campaign=gclid-atadas-proba |

## intim

| Lépés | | Ellenőrzés | Bizonyíték |
|---|---|---|---|
| a | ✔ | landing: mh_attr (localStorage) tartalmazza a gclid + gbraid + wbraid erteket | {"gclid":"TESZTGCLIDINTIMMVCXGHGU","gbraid":"TESZTGBRAIDINTIMMVCXGHGU","wbraid":"TESZTWBRAIDINTIMMVCXGHGU"} |
| a | ✔ | window.mhAttribucio.pillanatkep().google egyezik | {"gclid":"TESZTGCLIDINTIMMVCXGHGU","gbraid":"TESZTGBRAIDINTIMMVCXGHGU","wbraid":"TESZTWBRAIDINTIMMVCXGHGU"} |
| a | ℹ | sutihozzajarulas allapota | mh_cc=nincs dontes (alapertek: marketing=granted) / mod: nincs-dontes |
| a | ✔ | a Google-cimke _gcl_aw sutije tartalmazza a gclid-et | GCL.1792273656.TESZTGCLIDINTIMMVCXGHGU |
| a | ℹ | gbraid / wbraid suti (_gcl_gb / _gcl_ag / _gcl_gs) a Google-cimketol | _gcl_au,_gcl_aw |
| a | ✔ | a Google-cimke fut a landingen (kimeno kerelem naplozva, tiltva) | 11 kerelem |
| b | ✔ | a landingen van olyan foglalo-CTA, amelynek parameterei a brief szerintiek (business=laser&service=konzult) | business=laser&service=konzult |
| b | ✔ | a foglalo-reteg megnyilt a CTA-ra (ugyanazon az oldalon) | /intim-lezeres-szortelenites-budapest?gclid=TESZTGCLIDINTIMMVCXGHGU&gbraid=TESZTGBRAIDINTIMMVCXGHGU&wbraid=TESZTWBRAIDINTIMMVCXGHGU&utm_source=google&utm_medium |
| b | ✔ | a reteg URL-jeben ott van a gclid + gbraid + wbraid (a motor ebbol kapja a kontextust) | /intim-lezeres-szortelenites-budapest?gclid=TESZTGCLIDINTIMMVCXGHGU&gbraid=TESZTGBRAIDINTIMMVCXGHGU&wbraid=TESZTWBRAIDINTIMMVCXGHGU&utm_source=google&utm_medium=cpc&utm_campaign=gclid-atadas-proba |
| b | ✔ | a tracker-esemenyeken (tracking.js: booking_service_selected, booking_slot_viewed ...) a gclid egyezik a beadottal | 2/2 esemeny: booking_service_selected,booking_slot_viewed |
| b | ℹ | a lepes-meres esemenyei (lepes-meres.js: booking_open, booking_business, booking_service, booking_slots_loaded ...) tervbol nem hordoznak kattintas-azonositot (a GA4 az oldal URL-jebol / sutibol veszi) | 4 esemeny, gclid-del: 0 |
| b | rés | R2: a gbraid / wbraid NEM kerul a booking_* dataLayer-esemenyekbe (a flow.js parseContext csak a gclid / fbclid / ttclid / utm_* mezoket veszi at); a koszonooldal URL-jebe a withAttribution fuzi | esemeny-kulcsok: utm_source,utm_medium,utm_campaign,gclid |
| b | ✔ | a stape / GA4 kimeno kerelmekben megjelenik a teszt-azonosito (booking_open ...) | 6 kerelem; stape osszes: 7 |
| c | ✔ | kozvetlen /foglalo-motor belepes: az URL megtartja a gclid + gbraid + wbraid erteket | /foglalo-motor?business=laser&service=konzult&gclid=TESZTGCLIDINTIMMVCXGHGU&gbraid=TESZTGBRAIDINTIMMVCXGHGU&wbraid=TESZTWBRAIDINTIMMVCXGHGU&utm_source=google&utm_medium=cpc&utm_campaign=gclid-atadas-p |
| c | ℹ | kozvetlen belepes: az attribucio.js elmentette (mh_attr) | null |
| c | ✔ | a tracker-esemenyeken a gclid egyezik | 2/2 |
| c | ℹ | R4: a /foglalo-motor oldalon csak az attribucio.js tolt (nincs suti.js / Google-cimke): nincs _gcl_aw suti, es a mh_attr-ot az attribucio.js hozzajarulas-dontes nelkul nem irja (memoriabeli pillanatkep marad); a gclid az URL-ben utazik (withAttribution a koszonooldal URL-jebe, lasd h) | _gcl_aw: nincs / mh_attr: null / pillanatkep: {"gclid":"TESZTGCLIDINTIMMVCXGHGU","gbraid":"TESZTGBRAIDINTIMMVCXGHGU","wbraid":"TESZTWBRAIDINTIMMVCXGHGU"} |
| d | ✔ | a gclid-es landing utan, az azonositok nelkuli oldalbetoltesnel a mh_attr (localStorage) megvan | {"gclid":"TESZTGCLIDINTIMMVCXGHGU","gbraid":"TESZTGBRAIDINTIMMVCXGHGU","wbraid":"TESZTWBRAIDINTIMMVCXGHGU"} |
| d | ✔ | a _gcl_aw suti megvan a masodik oldalbetoltesnel (a Google-cimke ebbol olvassa a gclid-et) | GCL.1792273692.TESZTGCLIDINTIMMVCXGHGU |
| d | rés | R1: az azonositok nelkuli oldalon nyitott foglalo-reteg URL-je / motor-kontextusa NEM hordozza a gclid-et (a motor ctx.attribution az URL-bol jon; a mh_attr-ot a motor nem olvassa) | URL: /intim-lezeres-szortelenites-budapest |
| d | rés | R1: a tracker-esemenyeken nincs gclid | 0/2 esemeny gclid-del |
| h | ✔ | kozvetlen belepes: a foglalo vegigjarva a Salonic-lepesig (szimulalt atiranyitas) | booking_service_selected,booking_slot_viewed,booking_slot_selected,booking_details_started |
| h | ✔ | a koszonooldal URL-jeben ott van a gclid + gbraid + wbraid (withAttribution) | URL: /elysion-ok?first_booking=true&service=ARC+-+Teljes+arc&category=V%C3%A9gleges+Sz%C5%91rtelen%C3%ADt%C3%A9s+-+1.+Alkalom&price=27000&location=Mosaic+Elysion&employee=Elysion+Pro+Sz%C5%91rtelen%C3%ADt%C3%A9s&g=g%3ASZIM1793467800&bookingUrl=https%3A%2F%2Fmo |
| h | ✔ | Google Ads konverzios kerelem (pagead/ccm /conversion) a koszonooldalon | 4 kerelem, 2 egyedi cimke: LXcLCJ6ixPsbEPDs9sg-,cPOaCIHr9ogdEPDs9sg- |
| h | ℹ | a konverzios kerelmekben (url / ref / gclaw / body) megjeleno teszt-azonositok | gclid,gbraid,wbraid |
| h | ✔ | a konverzios kerelem `ref` (referrer = a landing gclid-es URL-je) tartalmaz teszt-azonositot | 4/4 kerelem |
| h | ✔ | /api/meres-erkezes POST torzse: attr.google.{gclid,gbraid,wbraid} egyezik a beadottal (tiltott, nem ment ki) | {"gclid":"TESZTGCLIDINTIMMVCXGHGU","gbraid":"TESZTGBRAIDINTIMMVCXGHGU","wbraid":"TESZTWBRAIDINTIMMVCXGHGU"} |
| h | ✔ | a koszonooldalon a Google-cimke az URL-bol _gcl_aw sutit allit a gclid-del | GCL.1792273706.TESZTGCLIDINTIMMVCXGHGU |
| h | ✔ | a koszonooldalon az attribucio.js a gclid-et elmentette (mh_attr: a suti.js alapertek-hozzajarulasa utan) | {"gclid":"TESZTGCLIDINTIMMVCXGHGU","gbraid":"TESZTGBRAIDINTIMMVCXGHGU","wbraid":"TESZTWBRAIDINTIMMVCXGHGU"} |
| e | ✔ | a foglalo vegigjarva a Salonic-lepesig (szimulalt atiranyitas) | booking_open,booking_business,booking_service_selected,booking_service,booking_slots_loaded,booking_slot_viewed,booking_slot_selected,booking_slot,booking_details_started,booking_form_start |
| e | ✔ | a koszonooldal URL-jeben ott van a gclid + gbraid + wbraid (withAttribution) | URL: /elysion-ok?first_booking=true&service=ARC+-+Teljes+arc&category=V%C3%A9gleges+Sz%C5%91rtelen%C3%ADt%C3%A9s+-+1.+Alkalom&price=27000&location=Mosaic+Elysion&employee=Elysion+Pro+Sz%C5%91rtelen%C3%ADt%C3%A9s&g=g%3ASZIM1793467800&bookingUrl=https%3A%2F%2Fmo |
| e | ✔ | Google Ads konverzios kerelem (pagead/ccm /conversion) a koszonooldalon | 4 kerelem, 2 egyedi cimke: LXcLCJ6ixPsbEPDs9sg-,cPOaCIHr9ogdEPDs9sg- |
| e | ℹ | a konverzios kerelmekben (url / ref / gclaw / body) megjeleno teszt-azonositok | gclid,gbraid,wbraid |
| e | ✔ | a konverzios kerelem `ref` (referrer = a landing gclid-es URL-je) tartalmaz teszt-azonositot | 4/4 kerelem |
| e | ✔ | /api/meres-erkezes POST torzse: attr.google.{gclid,gbraid,wbraid} egyezik a beadottal (tiltott, nem ment ki) | {"gclid":"TESZTGCLIDINTIMMVCXGHGU","gbraid":"TESZTGBRAIDINTIMMVCXGHGU","wbraid":"TESZTWBRAIDINTIMMVCXGHGU"} |
| e | ✔ | a koszonooldalon a mh_attr (localStorage) megvan | {"gclid":"TESZTGCLIDINTIMMVCXGHGU","gbraid":"TESZTGBRAIDINTIMMVCXGHGU","wbraid":"TESZTWBRAIDINTIMMVCXGHGU"} |
| e | ✔ | a koszonooldalon a _gcl_aw suti megvan a gclid-del | GCL.1792273732.TESZTGCLIDINTIMMVCXGHGU |
| g | ✔ | a foglalo vegigjarva a Salonic-lepesig (szimulalt atiranyitas) | booking_open,booking_business,booking_service_selected,booking_service,booking_slots_loaded,booking_slot_viewed,booking_slot_selected,booking_slot,booking_details_started,booking_form_start |
| g | rés | R1: masik oldalrol nyitott foglalonal a koszonooldal URL-jebol hianyzik a gclid / gbraid / wbraid (a withAttribution a motor win.location.search-et fuzi) | megvan az URL-ben: semmi |
| g | ✔ | Google Ads konverzios kerelem (pagead/ccm /conversion) a koszonooldalon | 4 kerelem, 2 egyedi cimke: LXcLCJ6ixPsbEPDs9sg-,cPOaCIHr9ogdEPDs9sg- |
| g | ℹ | a konverzios kerelmekben (url / ref / gclaw / body) megjeleno teszt-azonositok | gclid |
| g | ℹ | a konverzios kerelem `ref` (referrer = a landing gclid-es URL-je) tartalmaz teszt-azonositot | 0/4 kerelem |
| g | ✔ | /api/meres-erkezes POST torzse: attr.google.{gclid,gbraid,wbraid} egyezik a beadottal (tiltott, nem ment ki) | {"gclid":"TESZTGCLIDINTIMMVCXGHGU","gbraid":"TESZTGBRAIDINTIMMVCXGHGU","wbraid":"TESZTWBRAIDINTIMMVCXGHGU"} |
| g | ✔ | a koszonooldalon a mh_attr (localStorage) megvan | {"gclid":"TESZTGCLIDINTIMMVCXGHGU","gbraid":"TESZTGBRAIDINTIMMVCXGHGU","wbraid":"TESZTWBRAIDINTIMMVCXGHGU"} |
| g | ✔ | a koszonooldalon a _gcl_aw suti megvan a gclid-del | GCL.1792273753.TESZTGCLIDINTIMMVCXGHGU |

## hajvizsgalat

| Lépés | | Ellenőrzés | Bizonyíték |
|---|---|---|---|
| a | ✔ | landing: mh_attr (localStorage) tartalmazza a gclid + gbraid + wbraid erteket | {"gclid":"TESZTGCLIDHAJVIZSGALATMVCXQTXV","gbraid":"TESZTGBRAIDHAJVIZSGALATMVCXQTXV","wbraid":"TESZTWBRAIDHAJVIZSGALATMVCXQTXV"} |
| a | ✔ | window.mhAttribucio.pillanatkep().google egyezik | {"gclid":"TESZTGCLIDHAJVIZSGALATMVCXQTXV","gbraid":"TESZTGBRAIDHAJVIZSGALATMVCXQTXV","wbraid":"TESZTWBRAIDHAJVIZSGALATMVCXQTXV"} |
| a | ℹ | sutihozzajarulas allapota | mh_cc=nincs dontes (alapertek: marketing=granted) / mod: nincs-dontes |
| a | ✔ | a Google-cimke _gcl_aw sutije tartalmazza a gclid-et | GCL.1792274139.TESZTGCLIDHAJVIZSGALATMVCXQTXV |
| a | ℹ | gbraid / wbraid suti (_gcl_gb / _gcl_ag / _gcl_gs) a Google-cimketol | _gcl_au,_gcl_aw |
| a | ✔ | a Google-cimke fut a landingen (kimeno kerelem naplozva, tiltva) | 11 kerelem |
| b | ✔ | a landingen van olyan foglalo-CTA, amelynek parameterei a brief szerintiek (business=oxygen&service=466147) | business=oxygen&service=466147 |
| b | ✔ | a foglalo-reteg megnyilt a CTA-ra (ugyanazon az oldalon) | /hajvizsgalat-budapest?gclid=TESZTGCLIDHAJVIZSGALATMVCXQTXV&gbraid=TESZTGBRAIDHAJVIZSGALATMVCXQTXV&wbraid=TESZTWBRAIDHAJVIZSGALATMVCXQTXV&utm_source=google&utm_ |
| b | ✔ | a reteg URL-jeben ott van a gclid + gbraid + wbraid (a motor ebbol kapja a kontextust) | /hajvizsgalat-budapest?gclid=TESZTGCLIDHAJVIZSGALATMVCXQTXV&gbraid=TESZTGBRAIDHAJVIZSGALATMVCXQTXV&wbraid=TESZTWBRAIDHAJVIZSGALATMVCXQTXV&utm_source=google&utm_medium=cpc&utm_campaign=gclid-atadas-pro |
| b | ✔ | a tracker-esemenyeken (tracking.js: booking_service_selected, booking_slot_viewed ...) a gclid egyezik a beadottal | 2/2 esemeny: booking_service_selected,booking_slot_viewed |
| b | ℹ | a lepes-meres esemenyei (lepes-meres.js: booking_open, booking_business, booking_service, booking_slots_loaded ...) tervbol nem hordoznak kattintas-azonositot (a GA4 az oldal URL-jebol / sutibol veszi) | 4 esemeny, gclid-del: 0 |
| b | rés | R2: a gbraid / wbraid NEM kerul a booking_* dataLayer-esemenyekbe (a flow.js parseContext csak a gclid / fbclid / ttclid / utm_* mezoket veszi at); a koszonooldal URL-jebe a withAttribution fuzi | esemeny-kulcsok: utm_source,utm_medium,utm_campaign,gclid |
| b | ✔ | a stape / GA4 kimeno kerelmekben megjelenik a teszt-azonosito (booking_open ...) | 6 kerelem; stape osszes: 7 |
| c | ✔ | kozvetlen /foglalo-motor belepes: az URL megtartja a gclid + gbraid + wbraid erteket | /foglalo-motor?business=oxygen&service=466147&gclid=TESZTGCLIDHAJVIZSGALATMVCXQTXV&gbraid=TESZTGBRAIDHAJVIZSGALATMVCXQTXV&wbraid=TESZTWBRAIDHAJVIZSGALATMVCXQTXV&utm_source=google&utm_medium=cpc&utm_ca |
| c | ℹ | kozvetlen belepes: az attribucio.js elmentette (mh_attr) | null |
| c | ✔ | a tracker-esemenyeken a gclid egyezik | 2/2 |
| c | ℹ | R4: a /foglalo-motor oldalon csak az attribucio.js tolt (nincs suti.js / Google-cimke): nincs _gcl_aw suti, es a mh_attr-ot az attribucio.js hozzajarulas-dontes nelkul nem irja (memoriabeli pillanatkep marad); a gclid az URL-ben utazik (withAttribution a koszonooldal URL-jebe, lasd h) | _gcl_aw: nincs / mh_attr: null / pillanatkep: {"gclid":"TESZTGCLIDHAJVIZSGALATMVCXQTXV","gbraid":"TESZTGBRAIDHAJVIZSGALATMVCXQTXV","wbraid":"TESZTWBRAIDHAJVIZSGALATMVCXQTXV"} |
| d | ✔ | a gclid-es landing utan, az azonositok nelkuli oldalbetoltesnel a mh_attr (localStorage) megvan | {"gclid":"TESZTGCLIDHAJVIZSGALATMVCXQTXV","gbraid":"TESZTGBRAIDHAJVIZSGALATMVCXQTXV","wbraid":"TESZTWBRAIDHAJVIZSGALATMVCXQTXV"} |
| d | ✔ | a _gcl_aw suti megvan a masodik oldalbetoltesnel (a Google-cimke ebbol olvassa a gclid-et) | GCL.1792274176.TESZTGCLIDHAJVIZSGALATMVCXQTXV |
| d | rés | R1: az azonositok nelkuli oldalon nyitott foglalo-reteg URL-je / motor-kontextusa NEM hordozza a gclid-et (a motor ctx.attribution az URL-bol jon; a mh_attr-ot a motor nem olvassa) | URL: /hajvizsgalat-budapest |
| d | rés | R1: a tracker-esemenyeken nincs gclid | 0/2 esemeny gclid-del |
| h | ✔ | kozvetlen belepes: a foglalo vegigjarva a Salonic-lepesig (szimulalt atiranyitas) | booking_service_selected,booking_slot_viewed,booking_slot_selected,booking_details_started |
| h | ✔ | a koszonooldal URL-jeben ott van a gclid + gbraid + wbraid (withAttribution) | URL: /oxigenterapia-ok?first_booking=true&service=Hajkamer%C3%A1s+vizsg%C3%A1lat&category=Oxig%C3%A9nter%C3%A1pia+-+1.+alkalom&price=4990&location=Mosaic+Oxig%C3%A9n&employee=Menyh%C3%A1rt+M%C3%B3ni&g=g%3ASZIM1793374200&bookingUrl=https%3A%2F%2Fmosaic-oxigen.s |
| h | ✔ | Google Ads konverzios kerelem (pagead/ccm /conversion) a koszonooldalon | 4 kerelem, 2 egyedi cimke: 6oBECMPGs6kcEPDs9sg-,uImLCLLV-YgdEPDs9sg- |
| h | ℹ | a konverzios kerelmekben (url / ref / gclaw / body) megjeleno teszt-azonositok | gclid,gbraid,wbraid |
| h | ✔ | a konverzios kerelem `ref` (referrer = a landing gclid-es URL-je) tartalmaz teszt-azonositot | 4/4 kerelem |
| h | ✔ | /api/meres-erkezes POST torzse: attr.google.{gclid,gbraid,wbraid} egyezik a beadottal (tiltott, nem ment ki) | {"gclid":"TESZTGCLIDHAJVIZSGALATMVCXQTXV","gbraid":"TESZTGBRAIDHAJVIZSGALATMVCXQTXV","wbraid":"TESZTWBRAIDHAJVIZSGALATMVCXQTXV"} |
| h | ✔ | a koszonooldalon a Google-cimke az URL-bol _gcl_aw sutit allit a gclid-del | GCL.1792274189.TESZTGCLIDHAJVIZSGALATMVCXQTXV |
| h | ✔ | a koszonooldalon az attribucio.js a gclid-et elmentette (mh_attr: a suti.js alapertek-hozzajarulasa utan) | {"gclid":"TESZTGCLIDHAJVIZSGALATMVCXQTXV","gbraid":"TESZTGBRAIDHAJVIZSGALATMVCXQTXV","wbraid":"TESZTWBRAIDHAJVIZSGALATMVCXQTXV"} |
| e | ✔ | a foglalo vegigjarva a Salonic-lepesig (szimulalt atiranyitas) | booking_open,booking_business,booking_service_selected,booking_service,booking_slots_loaded,booking_slot_viewed,booking_slot_selected,booking_slot,booking_details_started,booking_form_start |
| e | ✔ | a koszonooldal URL-jeben ott van a gclid + gbraid + wbraid (withAttribution) | URL: /oxigenterapia-ok?first_booking=true&service=Hajkamer%C3%A1s+vizsg%C3%A1lat&category=Oxig%C3%A9nter%C3%A1pia+-+1.+alkalom&price=4990&location=Mosaic+Oxig%C3%A9n&employee=Menyh%C3%A1rt+M%C3%B3ni&g=g%3ASZIM1793374200&bookingUrl=https%3A%2F%2Fmosaic-oxigen.s |
| e | ✔ | Google Ads konverzios kerelem (pagead/ccm /conversion) a koszonooldalon | 4 kerelem, 2 egyedi cimke: 6oBECMPGs6kcEPDs9sg-,uImLCLLV-YgdEPDs9sg- |
| e | ℹ | a konverzios kerelmekben (url / ref / gclaw / body) megjeleno teszt-azonositok | gclid,gbraid,wbraid |
| e | ✔ | a konverzios kerelem `ref` (referrer = a landing gclid-es URL-je) tartalmaz teszt-azonositot | 4/4 kerelem |
| e | ✔ | /api/meres-erkezes POST torzse: attr.google.{gclid,gbraid,wbraid} egyezik a beadottal (tiltott, nem ment ki) | {"gclid":"TESZTGCLIDHAJVIZSGALATMVCXQTXV","gbraid":"TESZTGBRAIDHAJVIZSGALATMVCXQTXV","wbraid":"TESZTWBRAIDHAJVIZSGALATMVCXQTXV"} |
| e | ✔ | a koszonooldalon a mh_attr (localStorage) megvan | {"gclid":"TESZTGCLIDHAJVIZSGALATMVCXQTXV","gbraid":"TESZTGBRAIDHAJVIZSGALATMVCXQTXV","wbraid":"TESZTWBRAIDHAJVIZSGALATMVCXQTXV"} |
| e | ✔ | a koszonooldalon a _gcl_aw suti megvan a gclid-del | GCL.1792274215.TESZTGCLIDHAJVIZSGALATMVCXQTXV |
| g | ✔ | a foglalo vegigjarva a Salonic-lepesig (szimulalt atiranyitas) | booking_open,booking_business,booking_service_selected,booking_service,booking_slots_loaded,booking_slot_viewed,booking_slot_selected,booking_slot,booking_details_started,booking_form_start |
| g | rés | R1: masik oldalrol nyitott foglalonal a koszonooldal URL-jebol hianyzik a gclid / gbraid / wbraid (a withAttribution a motor win.location.search-et fuzi) | megvan az URL-ben: semmi |
| g | ✔ | Google Ads konverzios kerelem (pagead/ccm /conversion) a koszonooldalon | 4 kerelem, 2 egyedi cimke: 6oBECMPGs6kcEPDs9sg-,uImLCLLV-YgdEPDs9sg- |
| g | ℹ | a konverzios kerelmekben (url / ref / gclaw / body) megjeleno teszt-azonositok | gclid |
| g | ℹ | a konverzios kerelem `ref` (referrer = a landing gclid-es URL-je) tartalmaz teszt-azonositot | 0/4 kerelem |
| g | ✔ | /api/meres-erkezes POST torzse: attr.google.{gclid,gbraid,wbraid} egyezik a beadottal (tiltott, nem ment ki) | {"gclid":"TESZTGCLIDHAJVIZSGALATMVCXQTXV","gbraid":"TESZTGBRAIDHAJVIZSGALATMVCXQTXV","wbraid":"TESZTWBRAIDHAJVIZSGALATMVCXQTXV"} |
| g | ✔ | a koszonooldalon a mh_attr (localStorage) megvan | {"gclid":"TESZTGCLIDHAJVIZSGALATMVCXQTXV","gbraid":"TESZTGBRAIDHAJVIZSGALATMVCXQTXV","wbraid":"TESZTWBRAIDHAJVIZSGALATMVCXQTXV"} |
| g | ✔ | a koszonooldalon a _gcl_aw suti megvan a gclid-del | GCL.1792274236.TESZTGCLIDHAJVIZSGALATMVCXQTXV |

## evelin-uj

| Lépés | | Ellenőrzés | Bizonyíték |
|---|---|---|---|
| a | ✔ | landing: mh_attr (localStorage) tartalmazza a gclid + gbraid + wbraid erteket | {"gclid":"TESZTGCLIDEVELINUJMVCXQTXY","gbraid":"TESZTGBRAIDEVELINUJMVCXQTXY","wbraid":"TESZTWBRAIDEVELINUJMVCXQTXY"} |
| a | ✔ | window.mhAttribucio.pillanatkep().google egyezik | {"gclid":"TESZTGCLIDEVELINUJMVCXQTXY","gbraid":"TESZTGBRAIDEVELINUJMVCXQTXY","wbraid":"TESZTWBRAIDEVELINUJMVCXQTXY"} |
| a | ℹ | sutihozzajarulas allapota | mh_cc=nincs dontes (alapertek: marketing=granted) / mod: nincs-dontes |
| a | ✔ | a Google-cimke _gcl_aw sutije tartalmazza a gclid-et | GCL.1792274141.TESZTGCLIDEVELINUJMVCXQTXY |
| a | ℹ | gbraid / wbraid suti (_gcl_gb / _gcl_ag / _gcl_gs) a Google-cimketol | _gcl_au,_gcl_aw |
| a | ✔ | a Google-cimke fut a landingen (kimeno kerelem naplozva, tiltva) | 11 kerelem |
| b | ✔ | a landingen van olyan foglalo-CTA, amelynek parameterei a brief szerintiek (business=hair&staff=evelin&service=konzultacio) | business=hair&staff=evelin&service=konzultacio |
| b | ✔ | a foglalo-reteg megnyilt a CTA-ra (ugyanazon az oldalon) | /noi-hajfestes-evelin-uj?gclid=TESZTGCLIDEVELINUJMVCXQTXY&gbraid=TESZTGBRAIDEVELINUJMVCXQTXY&wbraid=TESZTWBRAIDEVELINUJMVCXQTXY&utm_source=google&utm_medium=cpc |
| b | ✔ | a reteg URL-jeben ott van a gclid + gbraid + wbraid (a motor ebbol kapja a kontextust) | /noi-hajfestes-evelin-uj?gclid=TESZTGCLIDEVELINUJMVCXQTXY&gbraid=TESZTGBRAIDEVELINUJMVCXQTXY&wbraid=TESZTWBRAIDEVELINUJMVCXQTXY&utm_source=google&utm_medium=cpc&utm_campaign=gclid-atadas-proba |
| b | ✔ | a tracker-esemenyeken (tracking.js: booking_service_selected, booking_slot_viewed ...) a gclid egyezik a beadottal | 3/3 esemeny: booking_service_selected,booking_filter_used,booking_slot_viewed |
| b | ℹ | a lepes-meres esemenyei (lepes-meres.js: booking_open, booking_business, booking_service, booking_slots_loaded ...) tervbol nem hordoznak kattintas-azonositot (a GA4 az oldal URL-jebol / sutibol veszi) | 4 esemeny, gclid-del: 0 |
| b | rés | R2: a gbraid / wbraid NEM kerul a booking_* dataLayer-esemenyekbe (a flow.js parseContext csak a gclid / fbclid / ttclid / utm_* mezoket veszi at); a koszonooldal URL-jebe a withAttribution fuzi | esemeny-kulcsok: utm_source,utm_medium,utm_campaign,gclid |
| b | ✔ | a stape / GA4 kimeno kerelmekben megjelenik a teszt-azonosito (booking_open ...) | 6 kerelem; stape osszes: 7 |
| c | ✔ | kozvetlen /foglalo-motor belepes: az URL megtartja a gclid + gbraid + wbraid erteket | /foglalo-motor?business=hair&staff=evelin&service=konzultacio&gclid=TESZTGCLIDEVELINUJMVCXQTXY&gbraid=TESZTGBRAIDEVELINUJMVCXQTXY&wbraid=TESZTWBRAIDEVELINUJMVCXQTXY&utm_source=google&utm_medium=cpc&ut |
| c | ℹ | kozvetlen belepes: az attribucio.js elmentette (mh_attr) | null |
| c | ✔ | a tracker-esemenyeken a gclid egyezik | 3/3 |
| c | ℹ | R4: a /foglalo-motor oldalon csak az attribucio.js tolt (nincs suti.js / Google-cimke): nincs _gcl_aw suti, es a mh_attr-ot az attribucio.js hozzajarulas-dontes nelkul nem irja (memoriabeli pillanatkep marad); a gclid az URL-ben utazik (withAttribution a koszonooldal URL-jebe, lasd h) | _gcl_aw: nincs / mh_attr: null / pillanatkep: {"gclid":"TESZTGCLIDEVELINUJMVCXQTXY","gbraid":"TESZTGBRAIDEVELINUJMVCXQTXY","wbraid":"TESZTWBRAIDEVELINUJMVCXQTXY"} |
| d | ✔ | a gclid-es landing utan, az azonositok nelkuli oldalbetoltesnel a mh_attr (localStorage) megvan | {"gclid":"TESZTGCLIDEVELINUJMVCXQTXY","gbraid":"TESZTGBRAIDEVELINUJMVCXQTXY","wbraid":"TESZTWBRAIDEVELINUJMVCXQTXY"} |
| d | ✔ | a _gcl_aw suti megvan a masodik oldalbetoltesnel (a Google-cimke ebbol olvassa a gclid-et) | GCL.1792274180.TESZTGCLIDEVELINUJMVCXQTXY |
| d | rés | R1: az azonositok nelkuli oldalon nyitott foglalo-reteg URL-je / motor-kontextusa NEM hordozza a gclid-et (a motor ctx.attribution az URL-bol jon; a mh_attr-ot a motor nem olvassa) | URL: /noi-hajfestes-evelin-uj |
| d | rés | R1: a tracker-esemenyeken nincs gclid | 0/3 esemeny gclid-del |
| h | ✔ | kozvetlen belepes: a foglalo vegigjarva a Salonic-lepesig (szimulalt atiranyitas) | booking_service_selected,booking_filter_used,booking_slot_viewed,booking_slot_selected,booking_details_started |
| h | ✔ | a koszonooldal URL-jeben ott van a gclid + gbraid + wbraid (withAttribution) | URL: /fodrasz-ok?first_booking=true&service=Fodr%C3%A1sz+konzult%C3%A1ci%C3%B3&category=Ingyenes+Fodr%C3%A1sz+konzult%C3%A1ci%C3%B3&price=0&location=Mosaic+Hair&employee=Evelin&g=g%3ASZIM1793194200&bookingUrl=https%3A%2F%2Fmosaic-hair.salonic.hu%2FguestData%2F |
| h | ✔ | Google Ads konverzios kerelem (pagead/ccm /conversion) a koszonooldalon | 2 kerelem, 1 egyedi cimke: DnDNCNTRiIkdEPDs9sg- |
| h | ℹ | a konverzios kerelmekben (url / ref / gclaw / body) megjeleno teszt-azonositok | gclid,gbraid,wbraid |
| h | ✔ | a konverzios kerelem `ref` (referrer = a landing gclid-es URL-je) tartalmaz teszt-azonositot | 2/2 kerelem |
| h | ✔ | /api/meres-erkezes POST torzse: attr.google.{gclid,gbraid,wbraid} egyezik a beadottal (tiltott, nem ment ki) | {"gclid":"TESZTGCLIDEVELINUJMVCXQTXY","gbraid":"TESZTGBRAIDEVELINUJMVCXQTXY","wbraid":"TESZTWBRAIDEVELINUJMVCXQTXY"} |
| h | ✔ | a koszonooldalon a Google-cimke az URL-bol _gcl_aw sutit allit a gclid-del | GCL.1792274197.TESZTGCLIDEVELINUJMVCXQTXY |
| h | ✔ | a koszonooldalon az attribucio.js a gclid-et elmentette (mh_attr: a suti.js alapertek-hozzajarulasa utan) | {"gclid":"TESZTGCLIDEVELINUJMVCXQTXY","gbraid":"TESZTGBRAIDEVELINUJMVCXQTXY","wbraid":"TESZTWBRAIDEVELINUJMVCXQTXY"} |
| e | ✔ | a foglalo vegigjarva a Salonic-lepesig (szimulalt atiranyitas) | booking_open,booking_business,booking_service_selected,booking_service,booking_filter_used,booking_slots_loaded,booking_slot_viewed,booking_slot_selected,booking_slot,booking_details_started,booking_form_start |
| e | ✔ | a koszonooldal URL-jeben ott van a gclid + gbraid + wbraid (withAttribution) | URL: /fodrasz-ok?first_booking=true&service=Fodr%C3%A1sz+konzult%C3%A1ci%C3%B3&category=Ingyenes+Fodr%C3%A1sz+konzult%C3%A1ci%C3%B3&price=0&location=Mosaic+Hair&employee=Evelin&g=g%3ASZIM1793194200&bookingUrl=https%3A%2F%2Fmosaic-hair.salonic.hu%2FguestData%2F |
| e | ✔ | Google Ads konverzios kerelem (pagead/ccm /conversion) a koszonooldalon | 2 kerelem, 1 egyedi cimke: DnDNCNTRiIkdEPDs9sg- |
| e | ℹ | a konverzios kerelmekben (url / ref / gclaw / body) megjeleno teszt-azonositok | gclid,gbraid,wbraid |
| e | ✔ | a konverzios kerelem `ref` (referrer = a landing gclid-es URL-je) tartalmaz teszt-azonositot | 2/2 kerelem |
| e | ✔ | /api/meres-erkezes POST torzse: attr.google.{gclid,gbraid,wbraid} egyezik a beadottal (tiltott, nem ment ki) | {"gclid":"TESZTGCLIDEVELINUJMVCXQTXY","gbraid":"TESZTGBRAIDEVELINUJMVCXQTXY","wbraid":"TESZTWBRAIDEVELINUJMVCXQTXY"} |
| e | ✔ | a koszonooldalon a mh_attr (localStorage) megvan | {"gclid":"TESZTGCLIDEVELINUJMVCXQTXY","gbraid":"TESZTGBRAIDEVELINUJMVCXQTXY","wbraid":"TESZTWBRAIDEVELINUJMVCXQTXY"} |
| e | ✔ | a koszonooldalon a _gcl_aw suti megvan a gclid-del | GCL.1792274229.TESZTGCLIDEVELINUJMVCXQTXY |
| g | ✔ | a foglalo vegigjarva a Salonic-lepesig (szimulalt atiranyitas) | booking_open,booking_business,booking_service_selected,booking_service,booking_filter_used,booking_slots_loaded,booking_slot_viewed,booking_slot_selected,booking_slot,booking_details_started,booking_form_start |
| g | rés | R1: masik oldalrol nyitott foglalonal a koszonooldal URL-jebol hianyzik a gclid / gbraid / wbraid (a withAttribution a motor win.location.search-et fuzi) | megvan az URL-ben: semmi |
| g | ✔ | Google Ads konverzios kerelem (pagead/ccm /conversion) a koszonooldalon | 2 kerelem, 1 egyedi cimke: DnDNCNTRiIkdEPDs9sg- |
| g | ℹ | a konverzios kerelmekben (url / ref / gclaw / body) megjeleno teszt-azonositok | gclid |
| g | ℹ | a konverzios kerelem `ref` (referrer = a landing gclid-es URL-je) tartalmaz teszt-azonositot | 0/2 kerelem |
| g | ✔ | /api/meres-erkezes POST torzse: attr.google.{gclid,gbraid,wbraid} egyezik a beadottal (tiltott, nem ment ki) | {"gclid":"TESZTGCLIDEVELINUJMVCXQTXY","gbraid":"TESZTGBRAIDEVELINUJMVCXQTXY","wbraid":"TESZTWBRAIDEVELINUJMVCXQTXY"} |
| g | ✔ | a koszonooldalon a mh_attr (localStorage) megvan | {"gclid":"TESZTGCLIDEVELINUJMVCXQTXY","gbraid":"TESZTGBRAIDEVELINUJMVCXQTXY","wbraid":"TESZTWBRAIDEVELINUJMVCXQTXY"} |
| g | ✔ | a koszonooldalon a _gcl_aw suti megvan a gclid-del | GCL.1792274250.TESZTGCLIDEVELINUJMVCXQTXY |

## lezer (mobil)

| Lépés | | Ellenőrzés | Bizonyíték |
|---|---|---|---|
| a | ✔ | landing: mh_attr (localStorage) tartalmazza a gclid + gbraid + wbraid erteket | {"gclid":"TESZTGCLIDLEZERMVCXQTYL","gbraid":"TESZTGBRAIDLEZERMVCXQTYL","wbraid":"TESZTWBRAIDLEZERMVCXQTYL"} |
| a | ✔ | window.mhAttribucio.pillanatkep().google egyezik | {"gclid":"TESZTGCLIDLEZERMVCXQTYL","gbraid":"TESZTGBRAIDLEZERMVCXQTYL","wbraid":"TESZTWBRAIDLEZERMVCXQTYL"} |
| a | ℹ | sutihozzajarulas allapota | mh_cc=nincs dontes (alapertek: marketing=granted) / mod: nincs-dontes |
| a | ✔ | a Google-cimke _gcl_aw sutije tartalmazza a gclid-et | GCL.1792274141.TESZTGCLIDLEZERMVCXQTYL |
| a | ℹ | gbraid / wbraid suti (_gcl_gb / _gcl_ag / _gcl_gs) a Google-cimketol | _gcl_au,_gcl_aw |
| a | ✔ | a Google-cimke fut a landingen (kimeno kerelem naplozva, tiltva) | 9 kerelem |
| b | ✔ | a landingen van olyan foglalo-CTA, amelynek parameterei a brief szerintiek (business=laser&service=konzult) | business=laser&service=konzult |
| b | ✔ | a foglalo-reteg megnyilt a CTA-ra (ugyanazon az oldalon) | /lezeres-szortelenites-budapest?gclid=TESZTGCLIDLEZERMVCXQTYL&gbraid=TESZTGBRAIDLEZERMVCXQTYL&wbraid=TESZTWBRAIDLEZERMVCXQTYL&utm_source=google&utm_medium=cpc&u |
| b | ✔ | a reteg URL-jeben ott van a gclid + gbraid + wbraid (a motor ebbol kapja a kontextust) | /lezeres-szortelenites-budapest?gclid=TESZTGCLIDLEZERMVCXQTYL&gbraid=TESZTGBRAIDLEZERMVCXQTYL&wbraid=TESZTWBRAIDLEZERMVCXQTYL&utm_source=google&utm_medium=cpc&utm_campaign=gclid-atadas-proba |
| b | ✔ | a tracker-esemenyeken (tracking.js: booking_service_selected, booking_slot_viewed ...) a gclid egyezik a beadottal | 2/2 esemeny: booking_service_selected,booking_slot_viewed |
| b | ℹ | a lepes-meres esemenyei (lepes-meres.js: booking_open, booking_business, booking_service, booking_slots_loaded ...) tervbol nem hordoznak kattintas-azonositot (a GA4 az oldal URL-jebol / sutibol veszi) | 4 esemeny, gclid-del: 0 |
| b | rés | R2: a gbraid / wbraid NEM kerul a booking_* dataLayer-esemenyekbe (a flow.js parseContext csak a gclid / fbclid / ttclid / utm_* mezoket veszi at); a koszonooldal URL-jebe a withAttribution fuzi | esemeny-kulcsok: utm_source,utm_medium,utm_campaign,gclid |
| b | ✔ | a stape / GA4 kimeno kerelmekben megjelenik a teszt-azonosito (booking_open ...) | 7 kerelem; stape osszes: 8 |
| e | ✔ | a foglalo vegigjarva a Salonic-lepesig (szimulalt atiranyitas) | booking_open,booking_business,booking_service_selected,booking_service,booking_slots_loaded,booking_slot_viewed,booking_slot_selected,booking_slot,booking_details_started,booking_form_start |
| e | ✔ | a koszonooldal URL-jeben ott van a gclid + gbraid + wbraid (withAttribution) | URL: /elysion-ok?first_booking=true&service=ARC+-+Teljes+arc&category=V%C3%A9gleges+Sz%C5%91rtelen%C3%ADt%C3%A9s+-+1.+Alkalom&price=27000&location=Mosaic+Elysion&employee=Elysion+Pro+Sz%C5%91rtelen%C3%ADt%C3%A9s&g=g%3ASZIM1793467800&bookingUrl=https%3A%2F%2Fmo |
| e | ✔ | Google Ads konverzios kerelem (pagead/ccm /conversion) a koszonooldalon | 4 kerelem, 2 egyedi cimke: LXcLCJ6ixPsbEPDs9sg-,cPOaCIHr9ogdEPDs9sg- |
| e | ℹ | a konverzios kerelmekben (url / ref / gclaw / body) megjeleno teszt-azonositok | gclid,gbraid,wbraid |
| e | ✔ | a konverzios kerelem `ref` (referrer = a landing gclid-es URL-je) tartalmaz teszt-azonositot | 4/4 kerelem |
| e | ✔ | /api/meres-erkezes POST torzse: attr.google.{gclid,gbraid,wbraid} egyezik a beadottal (tiltott, nem ment ki) | {"gclid":"TESZTGCLIDLEZERMVCXQTYL","gbraid":"TESZTGBRAIDLEZERMVCXQTYL","wbraid":"TESZTWBRAIDLEZERMVCXQTYL"} |
| e | ✔ | a koszonooldalon a mh_attr (localStorage) megvan | {"gclid":"TESZTGCLIDLEZERMVCXQTYL","gbraid":"TESZTGBRAIDLEZERMVCXQTYL","wbraid":"TESZTWBRAIDLEZERMVCXQTYL"} |
| e | ✔ | a koszonooldalon a _gcl_aw suti megvan a gclid-del | GCL.1792274176.TESZTGCLIDLEZERMVCXQTYL |

## oxigen1 (mobil)

| Lépés | | Ellenőrzés | Bizonyíték |
|---|---|---|---|
| a | ✔ | landing: mh_attr (localStorage) tartalmazza a gclid + gbraid + wbraid erteket | {"gclid":"TESZTGCLIDOXIGEN1MVCXQTYL","gbraid":"TESZTGBRAIDOXIGEN1MVCXQTYL","wbraid":"TESZTWBRAIDOXIGEN1MVCXQTYL"} |
| a | ✔ | window.mhAttribucio.pillanatkep().google egyezik | {"gclid":"TESZTGCLIDOXIGEN1MVCXQTYL","gbraid":"TESZTGBRAIDOXIGEN1MVCXQTYL","wbraid":"TESZTWBRAIDOXIGEN1MVCXQTYL"} |
| a | ℹ | sutihozzajarulas allapota | mh_cc=nincs dontes (alapertek: marketing=granted) / mod: nincs-dontes |
| a | ✔ | a Google-cimke _gcl_aw sutije tartalmazza a gclid-et | GCL.1792274191.TESZTGCLIDOXIGEN1MVCXQTYL |
| a | ℹ | gbraid / wbraid suti (_gcl_gb / _gcl_ag / _gcl_gs) a Google-cimketol | _gcl_au,_gcl_aw |
| a | ✔ | a Google-cimke fut a landingen (kimeno kerelem naplozva, tiltva) | 11 kerelem |
| b | ✔ | a landingen van olyan foglalo-CTA, amelynek parameterei a brief szerintiek (business=oxygen&service=466147) | business=oxygen&service=466147 |
| b | ✔ | a foglalo-reteg megnyilt a CTA-ra (ugyanazon az oldalon) | /oxigenterapia-budapest?gclid=TESZTGCLIDOXIGEN1MVCXQTYL&gbraid=TESZTGBRAIDOXIGEN1MVCXQTYL&wbraid=TESZTWBRAIDOXIGEN1MVCXQTYL&utm_source=google&utm_medium=cpc&utm |
| b | ✔ | a reteg URL-jeben ott van a gclid + gbraid + wbraid (a motor ebbol kapja a kontextust) | /oxigenterapia-budapest?gclid=TESZTGCLIDOXIGEN1MVCXQTYL&gbraid=TESZTGBRAIDOXIGEN1MVCXQTYL&wbraid=TESZTWBRAIDOXIGEN1MVCXQTYL&utm_source=google&utm_medium=cpc&utm_campaign=gclid-atadas-proba |
| b | ✔ | a tracker-esemenyeken (tracking.js: booking_service_selected, booking_slot_viewed ...) a gclid egyezik a beadottal | 2/2 esemeny: booking_service_selected,booking_slot_viewed |
| b | ℹ | a lepes-meres esemenyei (lepes-meres.js: booking_open, booking_business, booking_service, booking_slots_loaded ...) tervbol nem hordoznak kattintas-azonositot (a GA4 az oldal URL-jebol / sutibol veszi) | 4 esemeny, gclid-del: 0 |
| b | rés | R2: a gbraid / wbraid NEM kerul a booking_* dataLayer-esemenyekbe (a flow.js parseContext csak a gclid / fbclid / ttclid / utm_* mezoket veszi at); a koszonooldal URL-jebe a withAttribution fuzi | esemeny-kulcsok: utm_source,utm_medium,utm_campaign,gclid |
| b | ✔ | a stape / GA4 kimeno kerelmekben megjelenik a teszt-azonosito (booking_open ...) | 7 kerelem; stape osszes: 8 |
| e | ✔ | a foglalo vegigjarva a Salonic-lepesig (szimulalt atiranyitas) | booking_open,booking_business,booking_service_selected,booking_service,booking_slots_loaded,booking_slot_viewed,booking_slot_selected,booking_slot,booking_details_started,booking_form_start |
| e | ✔ | a koszonooldal URL-jeben ott van a gclid + gbraid + wbraid (withAttribution) | URL: /oxigenterapia-ok?first_booking=true&service=Hajkamer%C3%A1s+vizsg%C3%A1lat&category=Oxig%C3%A9nter%C3%A1pia+-+1.+alkalom&price=4990&location=Mosaic+Oxig%C3%A9n&employee=Menyh%C3%A1rt+M%C3%B3ni&g=g%3ASZIM1793374200&bookingUrl=https%3A%2F%2Fmosaic-oxigen.s |
| e | ✔ | Google Ads konverzios kerelem (pagead/ccm /conversion) a koszonooldalon | 4 kerelem, 2 egyedi cimke: 6oBECMPGs6kcEPDs9sg-,uImLCLLV-YgdEPDs9sg- |
| e | ℹ | a konverzios kerelmekben (url / ref / gclaw / body) megjeleno teszt-azonositok | gclid,gbraid,wbraid |
| e | ✔ | a konverzios kerelem `ref` (referrer = a landing gclid-es URL-je) tartalmaz teszt-azonositot | 4/4 kerelem |
| e | ✔ | /api/meres-erkezes POST torzse: attr.google.{gclid,gbraid,wbraid} egyezik a beadottal (tiltott, nem ment ki) | {"gclid":"TESZTGCLIDOXIGEN1MVCXQTYL","gbraid":"TESZTGBRAIDOXIGEN1MVCXQTYL","wbraid":"TESZTWBRAIDOXIGEN1MVCXQTYL"} |
| e | ✔ | a koszonooldalon a mh_attr (localStorage) megvan | {"gclid":"TESZTGCLIDOXIGEN1MVCXQTYL","gbraid":"TESZTGBRAIDOXIGEN1MVCXQTYL","wbraid":"TESZTWBRAIDOXIGEN1MVCXQTYL"} |
| e | ✔ | a koszonooldalon a _gcl_aw suti megvan a gclid-del | GCL.1792274224.TESZTGCLIDOXIGEN1MVCXQTYL |

