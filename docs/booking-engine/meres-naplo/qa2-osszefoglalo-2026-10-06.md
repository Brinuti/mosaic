# QA-2 árnyék-mérés – teszteset-összefoglaló (2026-10-06)

Nyers naplók: `qa2-<eset>-bongeszo-…json` (böngészős), `qa2-<eset>-szerver-…json` (szerveres: párosítás + kérés + platformválasz), `qa2-<eset>-composio-meta-…json` (a Meta-tesztküldés nyers válasza). Ez az összefoglaló ezekből készült.

**Minden küldés ARNYÉK-célpontra ment** (Meta: „MOSAIC ARNYEK meres-teszt” dataset 28616665324611098 + test_event_code; Google: másodlagos „ARNYEK – …” akciók, csak `validateOnly`; TikTok: ARNYEK pixel; GA4: teszt-property – még nincs). Élő pixelre / property-re / konverziós akcióra semmi nem ment.

Állapotok: `elkuldve` = a platform válaszolt (HTTP 200 + `events_received`); `nincs_hitelesites` = a kérés kész és naplózott, a küldéshez hitelesítés (token) kell; `tiltva` = védelem fogta meg (pl. nincs GA4 teszt-property); `kihagyva` = a modell szerint ide nem megy (ernyő a Google/GA4-be; TikTok nem HeadSpa-nál).

## HeadSpa (páros kezelés)

- source_entity_id (event_id alap): `mb_0muwuh6ca29y120gpx6aziw`
- hozzájárulás a böngészőben: statisztika: igen, marketing: igen (profil: `teljes`)
- Salonic-foglalás: `e6554169-73cd-c1dd-60cd-08858ad7e71f` (a teszt után azonnal lemondva); a `back` azonosító a Salonic-adatlap címén: `mb_0muwuh6ca29y120gpx6aziw`; kulcs: `10427|24354|1793469600`
- érkezési adatok (a szerver által tárolt): google: gclid=Cj0KCQjw_TESZT_HEADSPA… ts=1791301184, wbraid=CoMKCQ_TESZT_HEADSPA_M… ts=1791301187; meta: fbc ts=1791301187; tiktok: ttclid ts=1791301187; utm_elso: google / qa2_headspa_elso; utm_utolso: facebook / qa2_headspa_utolso; fbp: igen; ttp: igen; GA4 client_id/session_id: igen

| esemény | típus | platform (küldött név) | event_id | érték | állapot | kattintás-azonosító / hash a kérésben | platformválasz |
|---|---|---|---|---|---|---|---|
| FoglalasElso | alap | meta (HeadSpa_FoglalasElso) | `FoglalasElso:mb_0muwuh6ca29y120gpx…` | 53800 HUF | elkuldve | em aa1748e224…, ph b212433f23…, fbc igen, fbp igen | HTTP 200, events_received=2, fbtrace_id=AO5LU2Jm9HCTiqVQre9sD26 |
| FoglalasElso | alap | tiktok (HeadSpa_FoglalasElso) | `FoglalasElso:mb_0muwuh6ca29y120gpx…` | 53800 HUF | nincs_hitelesites | em aa1748e224…, ph 20267348d6…, ttclid igen, ttp igen | a kerelem kesz, a kuldeshez hitelesites kell (kulso szallito) |
| FoglalasElso | alap | google (ARNYEK-7825199989) | `FoglalasElso:mb_0muwuh6ca29y120gpx…` | 53800 HUF | nincs_hitelesites | wbraid, hash: hashedEmail, hashedPhoneNumber, jel: GRANTED | a kerelem kesz, a kuldeshez hitelesites kell (kulso szallito) |
| FoglalasElso | alap | ga4 (–) | `FoglalasElso:mb_0muwuh6ca29y120gpx…` | 53800 HUF | tiltva | – | nincs GA4_TESZT_MEASUREMENT_ID (teszt-property): a GA4-be csak teszt-p |
| Schedule | ernyo | meta (Schedule) | `Schedule:mb_0muwuh6ca29y120gpx6azi…` | 53800 HUF | elkuldve | em aa1748e224…, ph b212433f23…, fbc igen, fbp igen | HTTP 200, events_received=2, fbtrace_id=AO5LU2Jm9HCTiqVQre9sD26 |
| Schedule | ernyo | tiktok (CompletePayment) | `Schedule:mb_0muwuh6ca29y120gpx6azi…` | 53800 HUF | nincs_hitelesites | em aa1748e224…, ph 20267348d6…, ttclid igen, ttp igen | a kerelem kesz, a kuldeshez hitelesites kell (kulso szallito) |
| Schedule | ernyo | google (–) | `Schedule:mb_0muwuh6ca29y120gpx6azi…` | 53800 HUF | kihagyva | – | a Google-be csak alapesemeny megy (a visszajaro es az ernyo nem) |
| Schedule | ernyo | ga4 (–) | `Schedule:mb_0muwuh6ca29y120gpx6azi…` | 53800 HUF | kihagyva | – | a GA4-be csak alapesemeny megy (az ernyo nem) |

## HeadSpa ajándékkártya (Stripe teszt-vásárlás)

- source_entity_id (event_id alap): `pi_3UNadVFv8vc2ArnL1qqzRaOH`
- hozzájárulás a böngészőben: statisztika: igen, marketing: igen (profil: `teljes`)
- Stripe teszt-PI: `pi_3UNadVFv8vc2ArnL1qqzRaOH` (valódi teszt-módú kártyás fizetés)
- érkezési adatok (a szerver által tárolt): google: gclid=Cj0KCQjw_TESZT_AJANDEK… ts=1791301824, wbraid=CoMKCQ_TESZT_AJANDEK_M… ts=1791301827; meta: fbc ts=1791301827; tiktok: ttclid ts=1791301827; utm_elso: google / qa2_ajandek_elso; utm_utolso: facebook / qa2_ajandek_utolso; fbp: igen; ttp: igen; GA4 client_id/session_id: igen

| esemény | típus | platform (küldött név) | event_id | érték | állapot | kattintás-azonosító / hash a kérésben | platformválasz |
|---|---|---|---|---|---|---|---|
| Ajandekkartya | alap | meta (HeadSpa_Ajandekkartya) | `Ajandekkartya:pi_3UNadVFv8vc2ArnL1…` | 26900 HUF | elkuldve | em aa1748e224…, ph –, fbc igen, fbp igen | HTTP 200, events_received=2, fbtrace_id=AKLF3KBA4SlMEHYkCqApzlv |
| Ajandekkartya | alap | tiktok (HeadSpa_Ajandekkartya) | `Ajandekkartya:pi_3UNadVFv8vc2ArnL1…` | 26900 HUF | nincs_hitelesites | em aa1748e224…, ph –, ttclid igen, ttp igen | a kerelem kesz, a kuldeshez hitelesites kell (kulso szallito) |
| Ajandekkartya | alap | google (ARNYEK-7825199992) | `Ajandekkartya:pi_3UNadVFv8vc2ArnL1…` | 26900 HUF | nincs_hitelesites | wbraid, hash: hashedEmail, jel: GRANTED | a kerelem kesz, a kuldeshez hitelesites kell (kulso szallito) |
| Ajandekkartya | alap | ga4 (–) | `Ajandekkartya:pi_3UNadVFv8vc2ArnL1…` | 26900 HUF | tiltva | – | nincs GA4_TESZT_MEASUREMENT_ID (teszt-property): a GA4-be csak teszt-p |
| Schedule | ernyo | meta (Schedule) | `Schedule:pi_3UNadVFv8vc2ArnL1qqzRa…` | 26900 HUF | elkuldve | em aa1748e224…, ph –, fbc igen, fbp igen | HTTP 200, events_received=2, fbtrace_id=AKLF3KBA4SlMEHYkCqApzlv |
| Schedule | ernyo | tiktok (CompletePayment) | `Schedule:pi_3UNadVFv8vc2ArnL1qqzRa…` | 26900 HUF | nincs_hitelesites | em aa1748e224…, ph –, ttclid igen, ttp igen | a kerelem kesz, a kuldeshez hitelesites kell (kulso szallito) |
| Schedule | ernyo | google (–) | `Schedule:pi_3UNadVFv8vc2ArnL1qqzRa…` | 26900 HUF | kihagyva | – | a Google-be csak alapesemeny megy (a visszajaro es az ernyo nem) |
| Schedule | ernyo | ga4 (–) | `Schedule:pi_3UNadVFv8vc2ArnL1qqzRa…` | 26900 HUF | kihagyva | – | a GA4-be csak alapesemeny megy (az ernyo nem) |

## Fodrász (ingyenes konzultáció)

- source_entity_id (event_id alap): `mb_0muwuk8x04a47mummxji596`
- hozzájárulás a böngészőben: statisztika: nem, marketing: nem (profil: `nincs`)
- Salonic-foglalás: `05cee0c2-bb66-94a6-8251-4751bdd8ae54` (a teszt után azonnal lemondva); a `back` azonosító a Salonic-adatlap címén: `mb_0muwuk8x04a47mummxji596`; kulcs: `10823|25095|1792512000`
- érkezési adatok (a szerver által tárolt): google: gclid=Cj0KCQjw_TESZT_FODRASZ… ts=1791301328, wbraid=CoMKCQ_TESZT_FODRASZ_M… ts=1791301330; meta: fbc ts=1791301330; tiktok: ttclid ts=1791301330; utm_elso: google / qa2_fodrasz_elso; utm_utolso: facebook / qa2_fodrasz_utolso; fbp: igen; ttp: igen; GA4 client_id/session_id: igen

| esemény | típus | platform (küldött név) | event_id | érték | állapot | kattintás-azonosító / hash a kérésben | platformválasz |
|---|---|---|---|---|---|---|---|
| Konzultacio | alap | meta (Fodrasz_Konzultacio) | `Konzultacio:mb_0muwuk8x04a47mummxj…` | 0 HUF | elkuldve | em aa1748e224…, ph b212433f23…, fbc igen, fbp igen | HTTP 200, events_received=4, fbtrace_id=A1g7gUPBo4pTL-2A_1-G2xP |
| Konzultacio | alap | tiktok (–) | `Konzultacio:mb_0muwuk8x04a47mummxj…` | 0 HUF | kihagyva | – | a platform erre az uzletagra nem hirdet / nincs arnyek-celpont |
| Konzultacio | alap | google (ARNYEK-7825200898) | `Konzultacio:mb_0muwuk8x04a47mummxj…` | 0 HUF | nincs_hitelesites | wbraid, hash: nincs, jel: DENIED | a kerelem kesz, a kuldeshez hitelesites kell (kulso szallito) |
| Konzultacio | alap | ga4 (–) | `Konzultacio:mb_0muwuk8x04a47mummxj…` | 0 HUF | tiltva | – | nincs GA4_TESZT_MEASUREMENT_ID (teszt-property): a GA4-be csak teszt-p |
| Fodrasz_AkviziciosFoglalas | ernyo | meta (Fodrasz_AkviziciosFoglalas) | `Fodrasz_AkviziciosFoglalas:mb_0muw…` | 0 HUF | elkuldve | em aa1748e224…, ph b212433f23…, fbc igen, fbp igen | HTTP 200, events_received=4, fbtrace_id=A1g7gUPBo4pTL-2A_1-G2xP |
| Fodrasz_AkviziciosFoglalas | ernyo | tiktok (–) | `Fodrasz_AkviziciosFoglalas:mb_0muw…` | 0 HUF | kihagyva | – | a platform erre az uzletagra nem hirdet / nincs arnyek-celpont |
| Fodrasz_AkviziciosFoglalas | ernyo | google (–) | `Fodrasz_AkviziciosFoglalas:mb_0muw…` | 0 HUF | kihagyva | – | a Google-be csak alapesemeny megy (a visszajaro es az ernyo nem) |
| Fodrasz_AkviziciosFoglalas | ernyo | ga4 (–) | `Fodrasz_AkviziciosFoglalas:mb_0muw…` | 0 HUF | kihagyva | – | a GA4-be csak alapesemeny megy (az ernyo nem) |

## Oxigén (akciós hajkamera-vizsgálat)

- source_entity_id (event_id alap): `mb_0muwup2sryn8d506h0zgyio`
- hozzájárulás a böngészőben: statisztika: igen, marketing: nem (profil: `ana`)
- Salonic-foglalás: `5fef6760-9954-6883-2049-1bfdeaea0a15` (a teszt után azonnal lemondva); a `back` azonosító a Salonic-adatlap címén: `mb_0muwup2sryn8d506h0zgyio`; kulcs: `14409|32009|1792513800`
- érkezési adatok (a szerver által tárolt): google: gclid=Cj0KCQjw_TESZT_OXIGEN_… ts=1791301553, wbraid=CoMKCQ_TESZT_OXIGEN_MU… ts=1791301556; meta: fbc ts=1791301556; tiktok: ttclid ts=1791301556; utm_elso: google / qa2_oxigen_elso; utm_utolso: facebook / qa2_oxigen_utolso; fbp: igen; ttp: igen; GA4 client_id/session_id: igen

| esemény | típus | platform (küldött név) | event_id | érték | állapot | kattintás-azonosító / hash a kérésben | platformválasz |
|---|---|---|---|---|---|---|---|
| Konzultacio | alap | meta (Oxigen_Konzultacio) | `Konzultacio:mb_0muwup2sryn8d506h0z…` | 4990 HUF | elkuldve | em aa1748e224…, ph b212433f23…, fbc igen, fbp igen | HTTP 200, events_received=4, fbtrace_id=AlmOq7eH0a8XV3CONaO22SA |
| Konzultacio | alap | tiktok (–) | `Konzultacio:mb_0muwup2sryn8d506h0z…` | 4990 HUF | kihagyva | – | a platform erre az uzletagra nem hirdet / nincs arnyek-celpont |
| Konzultacio | alap | google (ARNYEK-7825200904) | `Konzultacio:mb_0muwup2sryn8d506h0z…` | 4990 HUF | nincs_hitelesites | wbraid, hash: nincs, jel: DENIED | a kerelem kesz, a kuldeshez hitelesites kell (kulso szallito) |
| Konzultacio | alap | ga4 (–) | `Konzultacio:mb_0muwup2sryn8d506h0z…` | 4990 HUF | tiltva | – | nincs GA4_TESZT_MEASUREMENT_ID (teszt-property): a GA4-be csak teszt-p |
| Oxigen_AkviziciosFoglalas | ernyo | meta (Oxigen_AkviziciosFoglalas) | `Oxigen_AkviziciosFoglalas:mb_0muwu…` | 4990 HUF | elkuldve | em aa1748e224…, ph b212433f23…, fbc igen, fbp igen | HTTP 200, events_received=4, fbtrace_id=AlmOq7eH0a8XV3CONaO22SA |
| Oxigen_AkviziciosFoglalas | ernyo | tiktok (–) | `Oxigen_AkviziciosFoglalas:mb_0muwu…` | 4990 HUF | kihagyva | – | a platform erre az uzletagra nem hirdet / nincs arnyek-celpont |
| Oxigen_AkviziciosFoglalas | ernyo | google (–) | `Oxigen_AkviziciosFoglalas:mb_0muwu…` | 4990 HUF | kihagyva | – | a Google-be csak alapesemeny megy (a visszajaro es az ernyo nem) |
| Oxigen_AkviziciosFoglalas | ernyo | ga4 (–) | `Oxigen_AkviziciosFoglalas:mb_0muwu…` | 4990 HUF | kihagyva | – | a GA4-be csak alapesemeny megy (az ernyo nem) |

## Szőr (lézeres konzultáció)

- source_entity_id (event_id alap): `mb_0muwuk9736tt0wdd7begbrj`
- hozzájárulás a böngészőben: nincs döntés (profil: `dontes_nelkul`)
- Salonic-foglalás: `b7209fe2-d061-b3cb-9a05-26f18ccf5c37` (a teszt után azonnal lemondva); a `back` azonosító a Salonic-adatlap címén: `mb_0muwuk9736tt0wdd7begbrj`; kulcs: `14586|32417|1792499400`
- érkezési adatok (a szerver által tárolt): google: gclid=Cj0KCQjw_TESZT_SZOR_MU… ts=1791301328, wbraid=CoMKCQ_TESZT_SZOR_MUWU… ts=1791301330; meta: fbc ts=1791301330; tiktok: ttclid ts=1791301330; utm_elso: google / qa2_szor_elso; utm_utolso: facebook / qa2_szor_utolso; fbp: igen; ttp: igen; GA4 client_id/session_id: igen

| esemény | típus | platform (küldött név) | event_id | érték | állapot | kattintás-azonosító / hash a kérésben | platformválasz |
|---|---|---|---|---|---|---|---|
| Konzultacio | alap | meta (Szor_Konzultacio) | `Konzultacio:mb_0muwuk9736tt0wdd7be…` | 0 HUF | elkuldve | em aa1748e224…, ph b212433f23…, fbc igen, fbp igen | HTTP 200, events_received=4, fbtrace_id=A1g7gUPBo4pTL-2A_1-G2xP |
| Konzultacio | alap | tiktok (–) | `Konzultacio:mb_0muwuk9736tt0wdd7be…` | 0 HUF | kihagyva | – | a platform erre az uzletagra nem hirdet / nincs arnyek-celpont |
| Konzultacio | alap | google (ARNYEK-7825200910) | `Konzultacio:mb_0muwuk9736tt0wdd7be…` | 0 HUF | nincs_hitelesites | wbraid, hash: nincs, jel: UNSPECIFIED | a kerelem kesz, a kuldeshez hitelesites kell (kulso szallito) |
| Konzultacio | alap | ga4 (–) | `Konzultacio:mb_0muwuk9736tt0wdd7be…` | 0 HUF | tiltva | – | nincs GA4_TESZT_MEASUREMENT_ID (teszt-property): a GA4-be csak teszt-p |
| Schedule | ernyo | meta (Schedule) | `Schedule:mb_0muwuk9736tt0wdd7begbr…` | 0 HUF | elkuldve | em aa1748e224…, ph b212433f23…, fbc igen, fbp igen | HTTP 200, events_received=4, fbtrace_id=A1g7gUPBo4pTL-2A_1-G2xP |
| Schedule | ernyo | tiktok (–) | `Schedule:mb_0muwuk9736tt0wdd7begbr…` | 0 HUF | kihagyva | – | a platform erre az uzletagra nem hirdet / nincs arnyek-celpont |
| Schedule | ernyo | google (–) | `Schedule:mb_0muwuk9736tt0wdd7begbr…` | 0 HUF | kihagyva | – | a Google-be csak alapesemeny megy (a visszajaro es az ernyo nem) |
| Schedule | ernyo | ga4 (–) | `Schedule:mb_0muwuk9736tt0wdd7begbr…` | 0 HUF | kihagyva | – | a GA4-be csak alapesemeny megy (az ernyo nem) |

## PMU (ingyenes konzultáció)

- source_entity_id (event_id alap): `mb_0muwup5ext3ny5b7gqlswik`
- hozzájárulás a böngészőben: statisztika: igen, marketing: igen (profil: `teljes`)
- Salonic-foglalás: `c8a75129-f148-79df-b610-8fb53f0101b2` (a teszt után azonnal lemondva); a `back` azonosító a Salonic-adatlap címén: `mb_0muwup5ext3ny5b7gqlswik`; kulcs: `14585|32428|1793471400`
- érkezési adatok (a szerver által tárolt): google: gclid=Cj0KCQjw_TESZT_PMU_MUW… ts=1791301553, wbraid=CoMKCQ_TESZT_PMU_MUWUO… ts=1791301555; meta: fbc ts=1791301555; tiktok: ttclid ts=1791301555; utm_elso: google / qa2_pmu_elso; utm_utolso: facebook / qa2_pmu_utolso; fbp: igen; ttp: igen; GA4 client_id/session_id: igen

| esemény | típus | platform (küldött név) | event_id | érték | állapot | kattintás-azonosító / hash a kérésben | platformválasz |
|---|---|---|---|---|---|---|---|
| Konzultacio | alap | meta (PMU_Konzultacio) | `Konzultacio:mb_0muwup5ext3ny5b7gql…` | 0 HUF | elkuldve | em aa1748e224…, ph b212433f23…, fbc igen, fbp igen | HTTP 200, events_received=4, fbtrace_id=AlmOq7eH0a8XV3CONaO22SA |
| Konzultacio | alap | tiktok (–) | `Konzultacio:mb_0muwup5ext3ny5b7gql…` | 0 HUF | kihagyva | – | a platform erre az uzletagra nem hirdet / nincs arnyek-celpont |
| Konzultacio | alap | google (ARNYEK-7825200916) | `Konzultacio:mb_0muwup5ext3ny5b7gql…` | 0 HUF | nincs_hitelesites | wbraid, hash: hashedEmail, hashedPhoneNumber, jel: GRANTED | a kerelem kesz, a kuldeshez hitelesites kell (kulso szallito) |
| Konzultacio | alap | ga4 (–) | `Konzultacio:mb_0muwup5ext3ny5b7gql…` | 0 HUF | tiltva | – | nincs GA4_TESZT_MEASUREMENT_ID (teszt-property): a GA4-be csak teszt-p |
| Schedule | ernyo | meta (Schedule) | `Schedule:mb_0muwup5ext3ny5b7gqlswi…` | 0 HUF | elkuldve | em aa1748e224…, ph b212433f23…, fbc igen, fbp igen | HTTP 200, events_received=4, fbtrace_id=AlmOq7eH0a8XV3CONaO22SA |
| Schedule | ernyo | tiktok (–) | `Schedule:mb_0muwup5ext3ny5b7gqlswi…` | 0 HUF | kihagyva | – | a platform erre az uzletagra nem hirdet / nincs arnyek-celpont |
| Schedule | ernyo | google (–) | `Schedule:mb_0muwup5ext3ny5b7gqlswi…` | 0 HUF | kihagyva | – | a Google-be csak alapesemeny megy (a visszajaro es az ernyo nem) |
| Schedule | ernyo | ga4 (–) | `Schedule:mb_0muwup5ext3ny5b7gqlswi…` | 0 HUF | kihagyva | – | a GA4-be csak alapesemeny megy (az ernyo nem) |
