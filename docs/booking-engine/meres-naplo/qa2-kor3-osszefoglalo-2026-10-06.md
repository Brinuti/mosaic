# QA-2 3. kör – 8 eset, mind a négy árnyékcél (2026-10-06)

**Célok** (kódban rögzítve, csak árnyék): Meta dataset 28616665324611098 (`test_event_code` TEST83939) · TikTok ARNYEK pixel DB2GTTJC77UE4D1NE4MG (`test_event_code` TEST83543) · GA4 teszt-property G-M5MLRLNQBP (előbb `/debug/mp/collect`) · Google Ads ARNYEK másodlagos akciók (Zapier-webhookon át, `GOOGLE_ARNYEK_WEBHOOK_URL`). Élő pixelre / property-re / akcióra nem ment semmi. A vészkapcsolók mind be voltak kapcsolva (semmi nem volt kikapcsolva).

Esetenként: a küldött események (név, `event_id`, érték), a platformválasz, és az **életút-napló** (létrehozva → elküldve → lemondva → a Salonic-oldal állapota → a levél ismétlése lemondás után). A foglalások „TESZT – Claude” néven, a szerveres lépés után azonnal lemondva. Az „új vendég” jelzés szimulált (a TESZT-levélben nincs).

## HeadSpa (páros kezelés, fizetős új vendég)

- **source_entity_id:** `mb_0muwyti5cenx3weivwfz0ej` (az alap- és az ernyőesemény ugyanazon forrás-entitásból, **külön event_id-val**)
- süti-hozzájárulás: statisztika igen, marketing igen (profil `teljes`)
- jelleg: elso, Salonic-ár: 53 800 Ft, küldött érték: 53 800 HUF, élő állapot a küldés előtt: `aktiv`
- Salonic-foglalás: `57e7df2a-6d71-286f-a2aa-abf3d79e1d17`
- **Küldött események (Meta):** `HeadSpa_FoglalasElso` (event_id `FoglalasElso:mb_0muwyti5cenx3weivwfz0ej`) 53 800 HUF + `Schedule` (event_id `Schedule:mb_0muwyti5cenx3weivwfz0ej`) 53 800 HUF

| esemény (event_id) | platform → küldött név | érték | állapot | platformválasz |
|---|---|---|---|---|
| FoglalasElso (`FoglalasElso:mb_0muwyti5cenx3weivwfz0ej`) | meta → HeadSpa_FoglalasElso | 53 800 HUF | elkuldve | HTTP 200, events_received=1, fbtrace_id=Ae5tWMv03vrvuKnVnK9dBv0 |
| FoglalasElso (`FoglalasElso:mb_0muwyti5cenx3weivwfz0ej`) | tiktok → HeadSpa_FoglalasElso | 53 800 HUF | elkuldve | HTTP 200, code 0 OK, request_id=20261006174146F8DBABE2F0151CC5B709 |
| FoglalasElso (`FoglalasElso:mb_0muwyti5cenx3weivwfz0ej`) | google → ARNYEK-7825199989 | 53 800 HUF | elkuldve | Zapier HTTP 200 (`success`); Zap-futás: `finished`, sent=true, `ARNYEK - HeadSpa - Elso foglalas`, requestId `e0e108de-2056-47f5-9396-e6c79b756a82`; akció 7825199989, wbraid, ad_user_data GRANTED |
| FoglalasElso (`FoglalasElso:mb_0muwyti5cenx3weivwfz0ej`) | ga4 → foglalas_elso | 53 800 HUF | elkuldve | validáció üres (`/debug/mp/collect`), HTTP 204 |
| Schedule (`Schedule:mb_0muwyti5cenx3weivwfz0ej`) | meta → Schedule | 53 800 HUF | elkuldve | HTTP 200, events_received=1, fbtrace_id=ARYn2AFsBU9upS8BPA5t2-v |
| Schedule (`Schedule:mb_0muwyti5cenx3weivwfz0ej`) | tiktok → CompletePayment | 53 800 HUF | elkuldve | HTTP 200, code 0 OK, request_id=20261006174149B284FD36A7588AC3791C |
| Schedule (`Schedule:mb_0muwyti5cenx3weivwfz0ej`) | google | 53 800 HUF | kihagyva | a Google-be csak alapesemeny megy (a visszajaro es az ernyo nem) |
| Schedule (`Schedule:mb_0muwyti5cenx3weivwfz0ej`) | ga4 | 53 800 HUF | kihagyva | a GA4-be csak alapesemeny megy (az ernyo nem) |

**Életút-napló:**

| lépés | részlet |
|---|---|
| foglalas letrehozva (Salonic, TESZT - Claude) | salonic_uuid: 57e7df2a-6d71-286f-a2aa-abf3d79e1d17 |
| level -> /api/foglalas-egyeztetes: parositas + elo allapot ellenorzes + esemenyek | hivas_ideje: 2026-10-06T17:41:39.993Z; allapot: parositott; elo_allapot: aktiv; kikuldott_cellak: 6 |
| lemondas (lemondo link) | ido: 2026-10-06T17:41:50.840Z; eredmeny: SIKERES: lemondás visszaigazolva |
| a Salonic reszletek-oldal a lemondas utan | allapot: LEMONDVA |
| a level ISMETLESE a lemondas utan | hivas_ideje: 2026-10-06T17:42:04.424Z; allapot: parositott; duplikalt: true; kuldheto: false; esemeny_kuldes: mar_kuldve; uj_esemeny: 0; sorok_szama_elotte_utana: [8,8] |

## HeadSpa ajándékkártya (valódi Stripe teszt-módú fizetés)

- **source_entity_id:** `pi_3UNcSHFv8vc2ArnL1yMYj1YC` (az alap- és az ernyőesemény ugyanazon forrás-entitásból, **külön event_id-val**)
- süti-hozzájárulás: statisztika igen, marketing igen (profil `teljes`)
- Stripe teszt-PI: `pi_3UNcSHFv8vc2ArnL1yMYj1YC`
- **Küldött események (Meta):** `HeadSpa_Ajandekkartya` (event_id `Ajandekkartya:pi_3UNcSHFv8vc2ArnL1yMYj1YC`) 26 900 HUF + `Schedule` (event_id `Schedule:pi_3UNcSHFv8vc2ArnL1yMYj1YC`) 26 900 HUF

| esemény (event_id) | platform → küldött név | érték | állapot | platformválasz |
|---|---|---|---|---|
| Ajandekkartya (`Ajandekkartya:pi_3UNcSHFv8vc2ArnL1yMYj1YC`) | meta → HeadSpa_Ajandekkartya | 26 900 HUF | elkuldve | HTTP 200, events_received=1, fbtrace_id=AnG8xfG-Yjl6wXHhJ6KRLLp |
| Ajandekkartya (`Ajandekkartya:pi_3UNcSHFv8vc2ArnL1yMYj1YC`) | tiktok → HeadSpa_Ajandekkartya | 26 900 HUF | elkuldve | HTTP 200, code 0 OK, request_id=20261006174816DB541CCC1E6962B3B932 |
| Ajandekkartya (`Ajandekkartya:pi_3UNcSHFv8vc2ArnL1yMYj1YC`) | google → ARNYEK-7825199992 | 26 900 HUF | elkuldve | Zapier HTTP 200 (`success`); Zap-futás: `finished`, sent=true, `ARNYEK - HeadSpa - Ajandekkartya`, requestId `b47246d4-d352-4e96-a22b-f95193ef45e6`; akció 7825199992, wbraid, ad_user_data GRANTED |
| Ajandekkartya (`Ajandekkartya:pi_3UNcSHFv8vc2ArnL1yMYj1YC`) | ga4 → purchase | 26 900 HUF | elkuldve | validáció üres (`/debug/mp/collect`), HTTP 204 |
| Schedule (`Schedule:pi_3UNcSHFv8vc2ArnL1yMYj1YC`) | meta → Schedule | 26 900 HUF | elkuldve | HTTP 200, events_received=1, fbtrace_id=AJBSHMGwhLFaTRg7YXrtXee |
| Schedule (`Schedule:pi_3UNcSHFv8vc2ArnL1yMYj1YC`) | tiktok → CompletePayment | 26 900 HUF | elkuldve | HTTP 200, code 0 OK, request_id=20261006174818A47E296C894A3A9F616F |
| Schedule (`Schedule:pi_3UNcSHFv8vc2ArnL1yMYj1YC`) | google | 26 900 HUF | kihagyva | a Google-be csak alapesemeny megy (a visszajaro es az ernyo nem) |
| Schedule (`Schedule:pi_3UNcSHFv8vc2ArnL1yMYj1YC`) | ga4 | 26 900 HUF | kihagyva | a GA4-be csak alapesemeny megy (az ernyo nem) |

**Életút-napló:** a vásárlás Stripe teszt-módú fizetés (lemondás nincs); a webhook-ág kulcsos újrajátszása: 1. hívás `{"ok":true,"allapot":"kesz"}`, **2. hívás (ismétlés)** `{"ok":true,"allapot":"mar_kuldve"}` → nincs új küldés.

## Fodrász – ingyenes konzultáció

- **source_entity_id:** `mb_0muwyuk3dcam8klnlivxivr` (az alap- és az ernyőesemény ugyanazon forrás-entitásból, **külön event_id-val**)
- süti-hozzájárulás: statisztika nem, marketing nem (profil `nincs`)
- jelleg: konzultacio, Salonic-ár: 0 Ft, küldött érték: 13 000 HUF, élő állapot a küldés előtt: `aktiv`
- Salonic-foglalás: `70f847c3-1bf1-c078-3128-e8395c5243fd`
- **Küldött események (Meta):** `Fodrasz_Konzultacio` (event_id `Konzultacio:mb_0muwyuk3dcam8klnlivxivr`) 13 000 HUF + `Fodrasz_AkviziciosFoglalas` (event_id `Fodrasz_AkviziciosFoglalas:mb_0muwyuk3dcam8klnlivxivr`) 13 000 HUF

| esemény (event_id) | platform → küldött név | érték | állapot | platformválasz |
|---|---|---|---|---|
| Konzultacio (`Konzultacio:mb_0muwyuk3dcam8klnlivxivr`) | meta → Fodrasz_Konzultacio | 13 000 HUF | elkuldve | HTTP 200, events_received=1, fbtrace_id=AUt5-nYxDE9ivJS-iWz6Av5 |
| Konzultacio (`Konzultacio:mb_0muwyuk3dcam8klnlivxivr`) | tiktok → Fodrasz_Konzultacio | 13 000 HUF | elkuldve | HTTP 200, code 0 OK, request_id=2026100617423423E93292881D825C7114 |
| Konzultacio (`Konzultacio:mb_0muwyuk3dcam8klnlivxivr`) | google → ARNYEK-7825200898 | 13 000 HUF | elkuldve | Zapier HTTP 200 (`success`); Zap-futás: `finished`, sent=true, `ARNYEK - Fodrasz - Konzultacio`, requestId `baf16188-cec3-4a46-a273-4b8787341e8e`; akció 7825200898, wbraid, ad_user_data DENIED |
| Konzultacio (`Konzultacio:mb_0muwyuk3dcam8klnlivxivr`) | ga4 → konzultacio | 13 000 HUF | elkuldve | validáció üres (`/debug/mp/collect`), HTTP 204 |
| Fodrasz_AkviziciosFoglalas (`Fodrasz_AkviziciosFoglalas:mb_0muwyuk3dcam8k…`) | meta → Fodrasz_AkviziciosFoglalas | 13 000 HUF | elkuldve | HTTP 200, events_received=1, fbtrace_id=ASVcchp7L7u8piFMVPlkjU3 |
| Fodrasz_AkviziciosFoglalas (`Fodrasz_AkviziciosFoglalas:mb_0muwyuk3dcam8k…`) | tiktok → Schedule | 13 000 HUF | elkuldve | HTTP 200, code 0 OK, request_id=2026100617423603BAFCE8E28854880670 |
| Fodrasz_AkviziciosFoglalas (`Fodrasz_AkviziciosFoglalas:mb_0muwyuk3dcam8k…`) | google | 13 000 HUF | kihagyva | a Google-be csak alapesemeny megy (a visszajaro es az ernyo nem) |
| Fodrasz_AkviziciosFoglalas (`Fodrasz_AkviziciosFoglalas:mb_0muwyuk3dcam8k…`) | ga4 | 13 000 HUF | kihagyva | a GA4-be csak alapesemeny megy (az ernyo nem) |

**Életút-napló:**

| lépés | részlet |
|---|---|
| foglalas letrehozva (Salonic, TESZT - Claude) | salonic_uuid: 70f847c3-1bf1-c078-3128-e8395c5243fd |
| level -> /api/foglalas-egyeztetes: parositas + elo allapot ellenorzes + esemenyek | hivas_ideje: 2026-10-06T17:42:28.103Z; allapot: parositott; elo_allapot: aktiv; kikuldott_cellak: 6 |
| lemondas (lemondo link) | ido: 2026-10-06T17:42:37.849Z; eredmeny: SIKERES: lemondás visszaigazolva |
| a Salonic reszletek-oldal a lemondas utan | allapot: LEMONDVA |
| a level ISMETLESE a lemondas utan | hivas_ideje: 2026-10-06T17:42:51.297Z; allapot: parositott; duplikalt: true; kuldheto: false; esemeny_kuldes: mar_kuldve; uj_esemeny: 0; sorok_szama_elotte_utana: [8,8] |

## Szőr – lézeres konzultáció

- **source_entity_id:** `mb_0muwyvjt3fsxa31ll7ujicb` (az alap- és az ernyőesemény ugyanazon forrás-entitásból, **külön event_id-val**)
- süti-hozzájárulás: nincs döntés (profil `dontes_nelkul`)
- jelleg: konzultacio, Salonic-ár: 0 Ft, küldött érték: 27 000 HUF, élő állapot a küldés előtt: `aktiv`
- Salonic-foglalás: `f0eaa775-e80a-81a1-9ee5-01108bf73a57`
- **Küldött események (Meta):** `Szor_Konzultacio` (event_id `Konzultacio:mb_0muwyvjt3fsxa31ll7ujicb`) 27 000 HUF + `Schedule` (event_id `Schedule:mb_0muwyvjt3fsxa31ll7ujicb`) 27 000 HUF

| esemény (event_id) | platform → küldött név | érték | állapot | platformválasz |
|---|---|---|---|---|
| Konzultacio (`Konzultacio:mb_0muwyvjt3fsxa31ll7ujicb`) | meta → Szor_Konzultacio | 27 000 HUF | elkuldve | HTTP 200, events_received=1, fbtrace_id=Alpaicv1FlV-4cQRMf7w_Sa |
| Konzultacio (`Konzultacio:mb_0muwyvjt3fsxa31ll7ujicb`) | tiktok → Szor_Konzultacio | 27 000 HUF | elkuldve | HTTP 200, code 0 OK, request_id=202610061743200A95ADA5D470F1EE1082 |
| Konzultacio (`Konzultacio:mb_0muwyvjt3fsxa31ll7ujicb`) | google → ARNYEK-7825200910 | 27 000 HUF | elkuldve | Zapier HTTP 200 (`success`); Zap-futás: `finished`, sent=true, `ARNYEK - Szor - Konzultacio`, requestId `01665595-739a-4a76-9893-16ee742eddf7`; akció 7825200910, wbraid, ad_user_data DENIED |
| Konzultacio (`Konzultacio:mb_0muwyvjt3fsxa31ll7ujicb`) | ga4 → konzultacio | 27 000 HUF | elkuldve | validáció üres (`/debug/mp/collect`), HTTP 204 |
| Schedule (`Schedule:mb_0muwyvjt3fsxa31ll7ujicb`) | meta → Schedule | 27 000 HUF | elkuldve | HTTP 200, events_received=1, fbtrace_id=AENvyAxjT764Kvw_MvgPr7u |
| Schedule (`Schedule:mb_0muwyvjt3fsxa31ll7ujicb`) | tiktok → Schedule | 27 000 HUF | elkuldve | HTTP 200, code 0 OK, request_id=20261006174322060779842B0F3C9AE5B7 |
| Schedule (`Schedule:mb_0muwyvjt3fsxa31ll7ujicb`) | google | 27 000 HUF | kihagyva | a Google-be csak alapesemeny megy (a visszajaro es az ernyo nem) |
| Schedule (`Schedule:mb_0muwyvjt3fsxa31ll7ujicb`) | ga4 | 27 000 HUF | kihagyva | a GA4-be csak alapesemeny megy (az ernyo nem) |

**Életút-napló:**

| lépés | részlet |
|---|---|
| foglalas letrehozva (Salonic, TESZT - Claude) | salonic_uuid: f0eaa775-e80a-81a1-9ee5-01108bf73a57 |
| level -> /api/foglalas-egyeztetes: parositas + elo allapot ellenorzes + esemenyek | hivas_ideje: 2026-10-06T17:43:14.965Z; allapot: parositott; elo_allapot: aktiv; kikuldott_cellak: 6 |
| lemondas (lemondo link) | ido: 2026-10-06T17:43:24.172Z; eredmeny: SIKERES: lemondás visszaigazolva |
| a Salonic reszletek-oldal a lemondas utan | allapot: LEMONDVA |
| a level ISMETLESE a lemondas utan | hivas_ideje: 2026-10-06T17:43:37.455Z; allapot: parositott; duplikalt: true; kuldheto: false; esemeny_kuldes: mar_kuldve; uj_esemeny: 0; sorok_szama_elotte_utana: [8,8] |

## Oxigén – fizetős első oxigénterápiás kezelés

- **source_entity_id:** `mb_0muwywjgsvskn3ddz58k11j` (az alap- és az ernyőesemény ugyanazon forrás-entitásból, **külön event_id-val**)
- süti-hozzájárulás: statisztika igen, marketing nem (profil `ana`)
- jelleg: elso, Salonic-ár: 29 900 Ft, küldött érték: 29 900 HUF, élő állapot a küldés előtt: `aktiv`
- Salonic-foglalás: `798eb274-45bb-ac75-06a7-8cef7c3807ea`
- **Küldött események (Meta):** `Oxigen_FoglalasElso` (event_id `FoglalasElso:mb_0muwywjgsvskn3ddz58k11j`) 29 900 HUF + `Oxigen_AkviziciosFoglalas` (event_id `Oxigen_AkviziciosFoglalas:mb_0muwywjgsvskn3ddz58k11j`) 29 900 HUF

| esemény (event_id) | platform → küldött név | érték | állapot | platformválasz |
|---|---|---|---|---|
| FoglalasElso (`FoglalasElso:mb_0muwywjgsvskn3ddz58k11j`) | meta → Oxigen_FoglalasElso | 29 900 HUF | elkuldve | HTTP 200, events_received=1, fbtrace_id=A9Cd-YYoDYOe81bgUV2lrVK |
| FoglalasElso (`FoglalasElso:mb_0muwywjgsvskn3ddz58k11j`) | tiktok → Oxigen_FoglalasElso | 29 900 HUF | elkuldve | HTTP 200, code 0 OK, request_id=202610061744088ED314491DF327F91FC3 |
| FoglalasElso (`FoglalasElso:mb_0muwywjgsvskn3ddz58k11j`) | google → ARNYEK-7825200901 | 29 900 HUF | elkuldve | Zapier HTTP 200 (`success`); Zap-futás: `finished`, sent=true, `ARNYEK - Oxigen - Elso foglalas`, requestId `724302d7-9fba-4764-9a8b-32ba6b8f9ba3`; akció 7825200901, wbraid, ad_user_data DENIED |
| FoglalasElso (`FoglalasElso:mb_0muwywjgsvskn3ddz58k11j`) | ga4 → foglalas_elso | 29 900 HUF | elkuldve | validáció üres (`/debug/mp/collect`), HTTP 204 |
| Oxigen_AkviziciosFoglalas (`Oxigen_AkviziciosFoglalas:mb_0muwywjgsvskn3d…`) | meta → Oxigen_AkviziciosFoglalas | 29 900 HUF | elkuldve | HTTP 200, events_received=1, fbtrace_id=A1sI8hN4Jdo2lXPmNDdq2lx |
| Oxigen_AkviziciosFoglalas (`Oxigen_AkviziciosFoglalas:mb_0muwywjgsvskn3d…`) | tiktok → Schedule | 29 900 HUF | elkuldve | HTTP 200, code 0 OK, request_id=20261006174410ACC88CFDEBCD02F1F05F |
| Oxigen_AkviziciosFoglalas (`Oxigen_AkviziciosFoglalas:mb_0muwywjgsvskn3d…`) | google | 29 900 HUF | kihagyva | a Google-be csak alapesemeny megy (a visszajaro es az ernyo nem) |
| Oxigen_AkviziciosFoglalas (`Oxigen_AkviziciosFoglalas:mb_0muwywjgsvskn3d…`) | ga4 | 29 900 HUF | kihagyva | a GA4-be csak alapesemeny megy (az ernyo nem) |

**Életút-napló:**

| lépés | részlet |
|---|---|
| foglalas letrehozva (Salonic, TESZT - Claude) | salonic_uuid: 798eb274-45bb-ac75-06a7-8cef7c3807ea |
| level -> /api/foglalas-egyeztetes: parositas + elo allapot ellenorzes + esemenyek | hivas_ideje: 2026-10-06T17:44:01.416Z; allapot: parositott; elo_allapot: aktiv; kikuldott_cellak: 6 |
| lemondas (lemondo link) | ido: 2026-10-06T17:44:12.281Z; eredmeny: SIKERES: lemondás visszaigazolva |
| a Salonic reszletek-oldal a lemondas utan | allapot: LEMONDVA |
| a level ISMETLESE a lemondas utan | hivas_ideje: 2026-10-06T17:44:25.592Z; allapot: parositott; duplikalt: true; kuldheto: false; esemeny_kuldes: mar_kuldve; uj_esemeny: 0; sorok_szama_elotte_utana: [8,8] |

## PMU – fizetős kezelés

- **source_entity_id:** `mb_0muwyxn4qj2bslab24fxgw5` (az alap- és az ernyőesemény ugyanazon forrás-entitásból, **külön event_id-val**)
- süti-hozzájárulás: statisztika igen, marketing igen (profil `teljes`)
- jelleg: elso, Salonic-ár: 99 000 Ft, küldött érték: 99 000 HUF, élő állapot a küldés előtt: `aktiv`
- Salonic-foglalás: `031d60e0-9bf0-06cf-de25-94ee741a4605`
- **Küldött események (Meta):** `PMU_FoglalasElso` (event_id `FoglalasElso:mb_0muwyxn4qj2bslab24fxgw5`) 99 000 HUF + `Schedule` (event_id `Schedule:mb_0muwyxn4qj2bslab24fxgw5`) 99 000 HUF

| esemény (event_id) | platform → küldött név | érték | állapot | platformválasz |
|---|---|---|---|---|
| FoglalasElso (`FoglalasElso:mb_0muwyxn4qj2bslab24fxgw5`) | meta → PMU_FoglalasElso | 99 000 HUF | elkuldve | HTTP 200, events_received=1, fbtrace_id=AZ-7FrrqNC4HyOUHxyEluUr |
| FoglalasElso (`FoglalasElso:mb_0muwyxn4qj2bslab24fxgw5`) | tiktok → PMU_FoglalasElso | 99 000 HUF | elkuldve | HTTP 200, code 0 OK, request_id=2026100617445946B1E0F0617C27A1CDFC |
| FoglalasElso (`FoglalasElso:mb_0muwyxn4qj2bslab24fxgw5`) | google → ARNYEK-7825200913 | 99 000 HUF | elkuldve | Zapier HTTP 200 (`success`); Zap-futás: `finished`, sent=true, `ARNYEK - PMU - Foglalas`, requestId `919c0aa9-4ded-4236-9507-8fcf840447a2`; akció 7825200913, wbraid, ad_user_data GRANTED |
| FoglalasElso (`FoglalasElso:mb_0muwyxn4qj2bslab24fxgw5`) | ga4 → foglalas_elso | 99 000 HUF | elkuldve | validáció üres (`/debug/mp/collect`), HTTP 204 |
| Schedule (`Schedule:mb_0muwyxn4qj2bslab24fxgw5`) | meta → Schedule | 99 000 HUF | elkuldve | HTTP 200, events_received=1, fbtrace_id=A95gd42FGycjvAjLnSgaAYs |
| Schedule (`Schedule:mb_0muwyxn4qj2bslab24fxgw5`) | tiktok → Schedule | 99 000 HUF | elkuldve | HTTP 200, code 0 OK, request_id=202610061745013907F11C4899F7D5BFEB |
| Schedule (`Schedule:mb_0muwyxn4qj2bslab24fxgw5`) | google | 99 000 HUF | kihagyva | a Google-be csak alapesemeny megy (a visszajaro es az ernyo nem) |
| Schedule (`Schedule:mb_0muwyxn4qj2bslab24fxgw5`) | ga4 | 99 000 HUF | kihagyva | a GA4-be csak alapesemeny megy (az ernyo nem) |

**Életút-napló:**

| lépés | részlet |
|---|---|
| foglalas letrehozva (Salonic, TESZT - Claude) | salonic_uuid: 031d60e0-9bf0-06cf-de25-94ee741a4605 |
| level -> /api/foglalas-egyeztetes: parositas + elo allapot ellenorzes + esemenyek | hivas_ideje: 2026-10-06T17:44:52.591Z; allapot: parositott; elo_allapot: aktiv; kikuldott_cellak: 6 |
| lemondas (lemondo link) | ido: 2026-10-06T17:45:03.109Z; eredmeny: SIKERES: lemondás visszaigazolva |
| a Salonic reszletek-oldal a lemondas utan | allapot: LEMONDVA |
| a level ISMETLESE a lemondas utan | hivas_ideje: 2026-10-06T17:45:16.619Z; allapot: parositott; duplikalt: true; kuldheto: false; esemeny_kuldes: mar_kuldve; uj_esemeny: 0; sorok_szama_elotte_utana: [8,8] |

## PMU – ingyenes konzultáció

- **source_entity_id:** `mb_0muwyyq3k2ilfkdahj2hd2q` (az alap- és az ernyőesemény ugyanazon forrás-entitásból, **külön event_id-val**)
- süti-hozzájárulás: statisztika igen, marketing igen (profil `teljes`)
- jelleg: konzultacio, Salonic-ár: 0 Ft, küldött érték: 13 800 HUF, élő állapot a küldés előtt: `aktiv`
- Salonic-foglalás: `b66a5e19-7d85-fcaf-06d0-f9a263cedf4d`
- **Küldött események (Meta):** `PMU_Konzultacio` (event_id `Konzultacio:mb_0muwyyq3k2ilfkdahj2hd2q`) 13 800 HUF + `Schedule` (event_id `Schedule:mb_0muwyyq3k2ilfkdahj2hd2q`) 13 800 HUF

| esemény (event_id) | platform → küldött név | érték | állapot | platformválasz |
|---|---|---|---|---|
| Konzultacio (`Konzultacio:mb_0muwyyq3k2ilfkdahj2hd2q`) | meta → PMU_Konzultacio | 13 800 HUF | elkuldve | HTTP 200, events_received=1, fbtrace_id=AFBAl56Xec_M3PXtR2K5x3p |
| Konzultacio (`Konzultacio:mb_0muwyyq3k2ilfkdahj2hd2q`) | tiktok → PMU_Konzultacio | 13 800 HUF | elkuldve | HTTP 200, code 0 OK, request_id=202610061745489051103298EF83D0EC71 |
| Konzultacio (`Konzultacio:mb_0muwyyq3k2ilfkdahj2hd2q`) | google → ARNYEK-7825200916 | 13 800 HUF | elkuldve | Zapier HTTP 200 (`success`); Zap-futás: `finished`, sent=true, `ARNYEK - PMU - Konzultacio`, requestId `f3a5c5ae-fed2-45d3-be1e-95cbf3d0ec3d`; akció 7825200916, wbraid, ad_user_data GRANTED |
| Konzultacio (`Konzultacio:mb_0muwyyq3k2ilfkdahj2hd2q`) | ga4 → konzultacio | 13 800 HUF | elkuldve | validáció üres (`/debug/mp/collect`), HTTP 204 |
| Schedule (`Schedule:mb_0muwyyq3k2ilfkdahj2hd2q`) | meta → Schedule | 13 800 HUF | elkuldve | HTTP 200, events_received=1, fbtrace_id=AMM6DA8HgqiBjPNYnQBit51 |
| Schedule (`Schedule:mb_0muwyyq3k2ilfkdahj2hd2q`) | tiktok → Schedule | 13 800 HUF | elkuldve | HTTP 200, code 0 OK, request_id=20261006174551AD5CAE8D26CB1C9F6D7F |
| Schedule (`Schedule:mb_0muwyyq3k2ilfkdahj2hd2q`) | google | 13 800 HUF | kihagyva | a Google-be csak alapesemeny megy (a visszajaro es az ernyo nem) |
| Schedule (`Schedule:mb_0muwyyq3k2ilfkdahj2hd2q`) | ga4 | 13 800 HUF | kihagyva | a GA4-be csak alapesemeny megy (az ernyo nem) |

**Életút-napló:**

| lépés | részlet |
|---|---|
| foglalas letrehozva (Salonic, TESZT - Claude) | salonic_uuid: b66a5e19-7d85-fcaf-06d0-f9a263cedf4d |
| level -> /api/foglalas-egyeztetes: parositas + elo allapot ellenorzes + esemenyek | hivas_ideje: 2026-10-06T17:45:42.816Z; allapot: parositott; elo_allapot: aktiv; kikuldott_cellak: 6 |
| lemondas (lemondo link) | ido: 2026-10-06T17:45:52.885Z; eredmeny: SIKERES: lemondás visszaigazolva |
| a Salonic reszletek-oldal a lemondas utan | allapot: LEMONDVA |
| a level ISMETLESE a lemondas utan | hivas_ideje: 2026-10-06T17:46:05.993Z; allapot: parositott; duplikalt: true; kuldheto: false; esemeny_kuldes: mar_kuldve; uj_esemeny: 0; sorok_szama_elotte_utana: [8,8] |

## Oxigén – AKCIÓS hajkamerás vizsgálat és konzultáció

- **source_entity_id:** `mb_0muwyzpyo43v6l6gmynvha3` (az alap- és az ernyőesemény ugyanazon forrás-entitásból, **külön event_id-val**)
- süti-hozzájárulás: statisztika igen, marketing igen (profil `teljes`)
- jelleg: konzultacio, Salonic-ár: 4990 Ft, küldött érték: 8900 HUF, élő állapot a küldés előtt: `aktiv`
- Salonic-foglalás: `591c230e-7061-8c30-01d3-3c9fc8fa85d7`
- **Küldött események (Meta):** `Oxigen_Konzultacio` (event_id `Konzultacio:mb_0muwyzpyo43v6l6gmynvha3`) 8900 HUF + `Oxigen_AkviziciosFoglalas` (event_id `Oxigen_AkviziciosFoglalas:mb_0muwyzpyo43v6l6gmynvha3`) 8900 HUF

| esemény (event_id) | platform → küldött név | érték | állapot | platformválasz |
|---|---|---|---|---|
| Konzultacio (`Konzultacio:mb_0muwyzpyo43v6l6gmynvha3`) | meta → Oxigen_Konzultacio | 8900 HUF | elkuldve | HTTP 200, events_received=1, fbtrace_id=AvfJ6re5_62WOdhPPZzks47 |
| Konzultacio (`Konzultacio:mb_0muwyzpyo43v6l6gmynvha3`) | tiktok → Oxigen_Konzultacio | 8900 HUF | elkuldve | HTTP 200, code 0 OK, request_id=202610061746356987C81C6FC92FB58AAD |
| Konzultacio (`Konzultacio:mb_0muwyzpyo43v6l6gmynvha3`) | google → ARNYEK-7825200904 | 8900 HUF | elkuldve | Zapier HTTP 200 (`success`); Zap-futás: `finished`, sent=true, `ARNYEK - Oxigen - Konzultacio`, requestId `ee091321-40cf-4885-9c57-1e4f76a507c3`; akció 7825200904, wbraid, ad_user_data GRANTED |
| Konzultacio (`Konzultacio:mb_0muwyzpyo43v6l6gmynvha3`) | ga4 → konzultacio | 8900 HUF | elkuldve | validáció üres (`/debug/mp/collect`), HTTP 204 |
| Oxigen_AkviziciosFoglalas (`Oxigen_AkviziciosFoglalas:mb_0muwyzpyo43v6l6…`) | meta → Oxigen_AkviziciosFoglalas | 8900 HUF | elkuldve | HTTP 200, events_received=1, fbtrace_id=AgrDoWP9oD5kzv7yvOznTM7 |
| Oxigen_AkviziciosFoglalas (`Oxigen_AkviziciosFoglalas:mb_0muwyzpyo43v6l6…`) | tiktok → Schedule | 8900 HUF | elkuldve | HTTP 200, code 0 OK, request_id=202610061746386987C81C6FC92FB58BFD |
| Oxigen_AkviziciosFoglalas (`Oxigen_AkviziciosFoglalas:mb_0muwyzpyo43v6l6…`) | google | 8900 HUF | kihagyva | a Google-be csak alapesemeny megy (a visszajaro es az ernyo nem) |
| Oxigen_AkviziciosFoglalas (`Oxigen_AkviziciosFoglalas:mb_0muwyzpyo43v6l6…`) | ga4 | 8900 HUF | kihagyva | a GA4-be csak alapesemeny megy (az ernyo nem) |

**Életút-napló:**

| lépés | részlet |
|---|---|
| foglalas letrehozva (Salonic, TESZT - Claude) | salonic_uuid: 591c230e-7061-8c30-01d3-3c9fc8fa85d7 |
| level -> /api/foglalas-egyeztetes: parositas + elo allapot ellenorzes + esemenyek | hivas_ideje: 2026-10-06T17:46:30.078Z; allapot: parositott; elo_allapot: aktiv; kikuldott_cellak: 6 |
| lemondas (lemondo link) | ido: 2026-10-06T17:46:39.947Z; eredmeny: SIKERES: lemondás visszaigazolva |
| a Salonic reszletek-oldal a lemondas utan | allapot: LEMONDVA |
| a level ISMETLESE a lemondas utan | hivas_ideje: 2026-10-06T17:46:53.774Z; allapot: parositott; duplikalt: true; kuldheto: false; esemeny_kuldes: mar_kuldve; uj_esemeny: 0; sorok_szama_elotte_utana: [8,8] |

## Összesítés

Elküldött (`elkuldve`) sorok a nyolc eset naplójában: **Meta 16, TikTok 16, GA4 8, Google 8** (esetenként: Meta 2 + TikTok 2 + GA4 1 + Google 1 = 6, a nyolc esetre 48). A GA4-be és a Google-be csak az alapesemény megy (az ernyő nem). Egyeztetés (D1, soronként): `qa2-kor3-egyeztetes-2026-10-06.json`.