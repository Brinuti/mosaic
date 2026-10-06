# QA-2 árnyék-mérés – teszteset-összefoglaló (2026-10-06)

**Ez a futás a SAJÁT szállítónkkal ment** (Cloudflare-előnézet → Meta CAPI, TikTok Events API, GA4 Measurement Protocol); a Composio-s Meta-küldés érvénytelenítve (nem hiteles bizonyíték: csak `custom_data`-t vitt, `user_data` nélkül), a régi naplók törölve. A Google a Zapier-webhookon át megy (`GOOGLE_ARNYEK_WEBHOOK_URL`), a Zap még nem létezik: a kérés elkészül, `nincs_hitelesites`.

Nyers naplók: `qa2-<eset>-bongeszo-…json` (böngészős: érkezési adatok, kérések/válaszok), `qa2-<eset>-szerver-…json` (szerveres: párosítás + **a teljes kiküldött payload** + platformválasz). Az IP a naplóban a teszt saját (futtató) IP-je; a naplózás teljes módja csak az előnézeten van bekapcsolva (`MERES_NAPLO_TELJES`).

**Meta:** dataset 28616665324611098 (MOSAIC ARNYEK meres-teszt), `test_event_code` = `TEST83939` (valódi). **TikTok:** ARNYEK pixel `DB2GTTJC77UE4D1NE4MG`; ennek a futásnak a TikTok-küldései még a szintetikus `TEST_MOSAIC_QA2` kóddal mentek, a valódi `TEST83543`-mal a TikTok-rész újrafutott: `qa2-tiktok-ujrafuttatas-2026-10-06.md`. **Darabszámok** (a megszakított első HeadSpa-kísérlettel együtt a platformokon): GA4 7 (a 6 eset 6 + 1), Meta 14 (12 + 2), TikTok 6 (4 + 2): lásd `qa2-kuldesi-egyeztetes-2026-10-06.json` és `QA2_ARNYEK.md` 6/a. **GA4:** teszt-property `G-M5MLRLNQBP` (előbb `/debug/mp/collect` validálás, utána `/mp/collect`). Élő pixelre / property-re / akcióra semmi nem ment.

Állapotok: `elkuldve` = a platform 2xx-szel és a sikeres törzzsel válaszolt; `nincs_hitelesites` = a kérés kész, nincs titok / webhook-cím; `nyitott` = a konzultáció értéke nincs rögzítve, **nem ment ki** (sem 0-val, sem a Salonic árával); `kihagyva` = a modell szerint ide nem megy.

## HeadSpa (páros kezelés, fizetős új vendég)

- source_entity_id: `mb_0muwwfdhhsffnttqjsa8mh3`
- süti-hozzájárulás: statisztika igen, marketing igen (profil `teljes`)
- jelleg: elso, új vendég: true (**szimulált** Salonic-jelzés), Salonic-ár: 53800 Ft, küldött érték: 53800 Ft, élő állapot a küldés előtt: `aktiv`
- Salonic-foglalás: `2aae042b-7acf-30e2-017f-66febe61e2e3` (a szerveres lépés után azonnal lemondva); `back`: `mb_0muwwfdhhsffnttqjsa8mh3`
- érkezési adatok (a szerver tárolta): google: gclid ts=1791304459, wbraid ts=1791304462; meta fbc ts=1791304462; tiktok ttclid ts=1791304462; utm_elso google/qa2_headspa_elso; utm_utolso facebook/qa2_headspa_utolso; fbp igen; ttp igen; GA4 client/session igen

| esemény | típus | platform (küldött név) | event_id | érték (forrás) | állapot | kiküldött payload (kivonat) | platformválasz |
|---|---|---|---|---|---|---|---|
| FoglalasElso | alap | meta (HeadSpa_FoglalasElso) | `FoglalasElso:mb_0muwwfdhhsffnt…` | 53800 HUF | elkuldve | em aa1748e224…, ph b212433f23…, fbc igen, fbp igen, ip 160.79.106.128, ua igen, event_id ✓ | HTTP 200, events_received=1, fbtrace_id=ATYwkqAAvGW1suXz-psvRK1 |
| FoglalasElso | alap | tiktok (HeadSpa_FoglalasElso) | `FoglalasElso:mb_0muwwfdhhsffnt…` | 53800 HUF | elkuldve | em aa1748e224…, ph 20267348d6…, ttclid igen, ttp igen, ip 160.79.106.128 | HTTP 200, code 0 OK, request_id=202610061634511B9A040652FDB5CF4FC2 |
| FoglalasElso | alap | google (ARNYEK-7825199989) | `FoglalasElso:mb_0muwwfdhhsffnt…` | 53800 HUF | nincs_hitelesites | akció 7825199989, wbraid, hash igen, jel GRANTED | a kerelem kesz, a kuldeshez hitelesites kell (kulso szallito) |
| FoglalasElso | alap | ga4 (foglalas_elso) | `FoglalasElso:mb_0muwwfdhhsffnt…` | 53800 HUF | elkuldve | client_id igen, session_id igen, consent GRANTED, hash nincs | HTTP 204 (validationMessages: []) |
| Schedule | ernyo | meta (Schedule) | `Schedule:mb_0muwwfdhhsffnttqjs…` | 53800 HUF | elkuldve | em aa1748e224…, ph b212433f23…, fbc igen, fbp igen, ip 160.79.106.128, ua igen, event_id ✓ | HTTP 200, events_received=1, fbtrace_id=Al-uuwLq2dWHl9fcWyWhBQV |
| Schedule | ernyo | tiktok (CompletePayment) | `Schedule:mb_0muwwfdhhsffnttqjs…` | 53800 HUF | elkuldve | em aa1748e224…, ph 20267348d6…, ttclid igen, ttp igen, ip 160.79.106.128 | HTTP 200, code 0 OK, request_id=20261006163453A9C25151C935A209D081 |
| Schedule | ernyo | google (–) | `Schedule:mb_0muwwfdhhsffnttqjs…` | 53800 HUF | kihagyva | – | a Google-be csak alapesemeny megy (a visszajaro es az ernyo nem) |
| Schedule | ernyo | ga4 (–) | `Schedule:mb_0muwwfdhhsffnttqjs…` | 53800 HUF | kihagyva | – | a GA4-be csak alapesemeny megy (az ernyo nem) |

## HeadSpa ajándékkártya (valódi Stripe teszt-módú fizetés)

- source_entity_id: `pi_3UNbMeFv8vc2ArnL1QOIrbHS`
- süti-hozzájárulás: statisztika igen, marketing igen (profil `teljes`)
- Stripe teszt-PI: `pi_3UNbMeFv8vc2ArnL1QOIrbHS`
- érkezési adatok (a szerver tárolta): google: gclid ts=1791304623, wbraid ts=1791304626; meta fbc ts=1791304626; tiktok ttclid ts=1791304626; utm_elso google/qa2_ajandek_elso; utm_utolso facebook/qa2_ajandek_utolso; fbp igen; ttp igen; GA4 client/session igen

| esemény | típus | platform (küldött név) | event_id | érték (forrás) | állapot | kiküldött payload (kivonat) | platformválasz |
|---|---|---|---|---|---|---|---|
| Ajandekkartya | alap | meta (HeadSpa_Ajandekkartya) | `Ajandekkartya:pi_3UNbMeFv8vc2A…` | 26900 HUF | elkuldve | em aa1748e224…, ph –, fbc igen, fbp igen, ip 160.79.106.134, ua igen, event_id ✓ | HTTP 200, events_received=1, fbtrace_id=A_uAXHVlyYz8MC2iwgWEzF_ |
| Ajandekkartya | alap | tiktok (HeadSpa_Ajandekkartya) | `Ajandekkartya:pi_3UNbMeFv8vc2A…` | 26900 HUF | elkuldve | em aa1748e224…, ph –, ttclid igen, ttp igen, ip 160.79.106.134 | HTTP 200, code 0 OK, request_id=202610061638237BDE1FD068625279DD9D |
| Ajandekkartya | alap | google (ARNYEK-7825199992) | `Ajandekkartya:pi_3UNbMeFv8vc2A…` | 26900 HUF | nincs_hitelesites | akció 7825199992, wbraid, hash igen, jel GRANTED | a kerelem kesz, a kuldeshez hitelesites kell (kulso szallito) |
| Ajandekkartya | alap | ga4 (purchase) | `Ajandekkartya:pi_3UNbMeFv8vc2A…` | 26900 HUF | elkuldve | client_id igen, session_id igen, consent GRANTED, hash nincs | HTTP 204 (validationMessages: []) |
| Schedule | ernyo | meta (Schedule) | `Schedule:pi_3UNbMeFv8vc2ArnL1Q…` | 26900 HUF | elkuldve | em aa1748e224…, ph –, fbc igen, fbp igen, ip 160.79.106.134, ua igen, event_id ✓ | HTTP 200, events_received=1, fbtrace_id=AOSHCKoSJa63Q-eWIVZGr2U |
| Schedule | ernyo | tiktok (CompletePayment) | `Schedule:pi_3UNbMeFv8vc2ArnL1Q…` | 26900 HUF | elkuldve | em aa1748e224…, ph –, ttclid igen, ttp igen, ip 160.79.106.134 | HTTP 200, code 0 OK, request_id=20261006163825F8652C404899A98ED561 |
| Schedule | ernyo | google (–) | `Schedule:pi_3UNbMeFv8vc2ArnL1Q…` | 26900 HUF | kihagyva | – | a Google-be csak alapesemeny megy (a visszajaro es az ernyo nem) |
| Schedule | ernyo | ga4 (–) | `Schedule:pi_3UNbMeFv8vc2ArnL1Q…` | 26900 HUF | kihagyva | – | a GA4-be csak alapesemeny megy (az ernyo nem) |

## Fodrász (ingyenes konzultáció)

- source_entity_id: `mb_0muwwfdl3j7j2dtbgvufrq8`
- süti-hozzájárulás: statisztika nem, marketing nem (profil `nincs`)
- jelleg: konzultacio, új vendég: true (**szimulált** Salonic-jelzés), Salonic-ár: 0 Ft, küldött érték: 13000 Ft, élő állapot a küldés előtt: `aktiv`
- Salonic-foglalás: `a6fd2f34-4b2e-c51d-038f-4177b8f98d56` (a szerveres lépés után azonnal lemondva); `back`: `mb_0muwwfdl3j7j2dtbgvufrq8`
- érkezési adatok (a szerver tárolta): google: gclid ts=1791304460, wbraid ts=1791304462; meta fbc ts=1791304462; tiktok ttclid ts=1791304462; utm_elso google/qa2_fodrasz_elso; utm_utolso facebook/qa2_fodrasz_utolso; fbp igen; ttp igen; GA4 client/session igen

| esemény | típus | platform (küldött név) | event_id | érték (forrás) | állapot | kiküldött payload (kivonat) | platformválasz |
|---|---|---|---|---|---|---|---|
| Konzultacio | alap | meta (Fodrasz_Konzultacio) | `Konzultacio:mb_0muwwfdl3j7j2dt…` | 13000 HUF | elkuldve | em aa1748e224…, ph b212433f23…, fbc igen, fbp igen, ip 160.79.106.133, ua igen, event_id ✓ | HTTP 200, events_received=1, fbtrace_id=AithF4Xjw4zSUKN6ThYRZ4R |
| Konzultacio | alap | tiktok (–) | `Konzultacio:mb_0muwwfdl3j7j2dt…` | 13000 HUF | kihagyva | – | a platform erre az uzletagra nem hirdet / nincs arnyek-celpont |
| Konzultacio | alap | google (ARNYEK-7825200898) | `Konzultacio:mb_0muwwfdl3j7j2dt…` | 13000 HUF | nincs_hitelesites | akció 7825200898, wbraid, hash nem, jel DENIED | a kerelem kesz, a kuldeshez hitelesites kell (kulso szallito) |
| Konzultacio | alap | ga4 (konzultacio) | `Konzultacio:mb_0muwwfdl3j7j2dt…` | 13000 HUF | elkuldve | client_id igen, session_id igen, consent DENIED, hash nincs | HTTP 204 (validationMessages: []) |
| Fodrasz_AkviziciosFoglalas | ernyo | meta (Fodrasz_AkviziciosFoglalas) | `Fodrasz_AkviziciosFoglalas:mb_…` | 13000 HUF | elkuldve | em aa1748e224…, ph b212433f23…, fbc igen, fbp igen, ip 160.79.106.133, ua igen, event_id ✓ | HTTP 200, events_received=1, fbtrace_id=AvPypZwhgWCiIdKHIurBE9r |
| Fodrasz_AkviziciosFoglalas | ernyo | tiktok (–) | `Fodrasz_AkviziciosFoglalas:mb_…` | 13000 HUF | kihagyva | – | a platform erre az uzletagra nem hirdet / nincs arnyek-celpont |
| Fodrasz_AkviziciosFoglalas | ernyo | google (–) | `Fodrasz_AkviziciosFoglalas:mb_…` | 13000 HUF | kihagyva | – | a Google-be csak alapesemeny megy (a visszajaro es az ernyo nem) |
| Fodrasz_AkviziciosFoglalas | ernyo | ga4 (–) | `Fodrasz_AkviziciosFoglalas:mb_…` | 13000 HUF | kihagyva | – | a GA4-be csak alapesemeny megy (az ernyo nem) |

## Szőr (lézeres konzultáció)

- source_entity_id: `mb_0muwwfdxtq0ijjk42xift2i`
- süti-hozzájárulás: nincs döntés (profil `dontes_nelkul`)
- jelleg: konzultacio, új vendég: true (**szimulált** Salonic-jelzés), Salonic-ár: 0 Ft, küldött érték: 27000 Ft, élő állapot a küldés előtt: `aktiv`
- Salonic-foglalás: `229d83ee-847d-1837-35ca-0e6846e5cdc2` (a szerveres lépés után azonnal lemondva); `back`: `mb_0muwwfdxtq0ijjk42xift2i`
- érkezési adatok (a szerver tárolta): google: gclid ts=1791304460, wbraid ts=1791304462; meta fbc ts=1791304462; tiktok ttclid ts=1791304462; utm_elso google/qa2_szor_elso; utm_utolso facebook/qa2_szor_utolso; fbp igen; ttp igen; GA4 client/session igen

| esemény | típus | platform (küldött név) | event_id | érték (forrás) | állapot | kiküldött payload (kivonat) | platformválasz |
|---|---|---|---|---|---|---|---|
| Konzultacio | alap | meta (Szor_Konzultacio) | `Konzultacio:mb_0muwwfdxtq0ijjk…` | 27000 HUF | elkuldve | em aa1748e224…, ph b212433f23…, fbc igen, fbp igen, ip 160.79.106.21, ua igen, event_id ✓ | HTTP 200, events_received=1, fbtrace_id=ATV0m_whCqizZ_Z2_amdfPE |
| Konzultacio | alap | tiktok (–) | `Konzultacio:mb_0muwwfdxtq0ijjk…` | 27000 HUF | kihagyva | – | a platform erre az uzletagra nem hirdet / nincs arnyek-celpont |
| Konzultacio | alap | google (ARNYEK-7825200910) | `Konzultacio:mb_0muwwfdxtq0ijjk…` | 27000 HUF | nincs_hitelesites | akció 7825200910, wbraid, hash nem, jel UNSPECIFIED | a kerelem kesz, a kuldeshez hitelesites kell (kulso szallito) |
| Konzultacio | alap | ga4 (konzultacio) | `Konzultacio:mb_0muwwfdxtq0ijjk…` | 27000 HUF | elkuldve | client_id igen, session_id igen, consent nincs, hash nincs | HTTP 204 (validationMessages: []) |
| Schedule | ernyo | meta (Schedule) | `Schedule:mb_0muwwfdxtq0ijjk42x…` | 27000 HUF | elkuldve | em aa1748e224…, ph b212433f23…, fbc igen, fbp igen, ip 160.79.106.21, ua igen, event_id ✓ | HTTP 200, events_received=1, fbtrace_id=AHPpdO_MAMmZLirH2iZigTh |
| Schedule | ernyo | tiktok (–) | `Schedule:mb_0muwwfdxtq0ijjk42x…` | 27000 HUF | kihagyva | – | a platform erre az uzletagra nem hirdet / nincs arnyek-celpont |
| Schedule | ernyo | google (–) | `Schedule:mb_0muwwfdxtq0ijjk42x…` | 27000 HUF | kihagyva | – | a Google-be csak alapesemeny megy (a visszajaro es az ernyo nem) |
| Schedule | ernyo | ga4 (–) | `Schedule:mb_0muwwfdxtq0ijjk42x…` | 27000 HUF | kihagyva | – | a GA4-be csak alapesemeny megy (az ernyo nem) |

## Oxigén (fizetős első oxigénterápiás kezelés)

- source_entity_id: `mb_0muwwfe8qpioj7cf5nz1dyl`
- süti-hozzájárulás: statisztika igen, marketing nem (profil `ana`)
- jelleg: elso, új vendég: true (**szimulált** Salonic-jelzés), Salonic-ár: 29900 Ft, küldött érték: 29900 Ft, élő állapot a küldés előtt: `aktiv`
- Salonic-foglalás: `df06e6dc-53f3-548b-1a98-873cdd61573c` (a szerveres lépés után azonnal lemondva); `back`: `mb_0muwwfe8qpioj7cf5nz1dyl`
- érkezési adatok (a szerver tárolta): google: gclid ts=1791304460, wbraid ts=1791304463; meta fbc ts=1791304463; tiktok ttclid ts=1791304463; utm_elso google/qa2_oxigen-elso_elso; utm_utolso facebook/qa2_oxigen-elso_utolso; fbp igen; ttp igen; GA4 client/session igen

| esemény | típus | platform (küldött név) | event_id | érték (forrás) | állapot | kiküldött payload (kivonat) | platformválasz |
|---|---|---|---|---|---|---|---|
| FoglalasElso | alap | meta (Oxigen_FoglalasElso) | `FoglalasElso:mb_0muwwfe8qpioj7…` | 29900 HUF | elkuldve | em aa1748e224…, ph b212433f23…, fbc igen, fbp igen, ip 160.79.106.135, ua igen, event_id ✓ | HTTP 200, events_received=1, fbtrace_id=ALP5cYddl9VcxeeEREoXmv_ |
| FoglalasElso | alap | tiktok (–) | `FoglalasElso:mb_0muwwfe8qpioj7…` | 29900 HUF | kihagyva | – | a platform erre az uzletagra nem hirdet / nincs arnyek-celpont |
| FoglalasElso | alap | google (ARNYEK-7825200901) | `FoglalasElso:mb_0muwwfe8qpioj7…` | 29900 HUF | nincs_hitelesites | akció 7825200901, wbraid, hash nem, jel DENIED | a kerelem kesz, a kuldeshez hitelesites kell (kulso szallito) |
| FoglalasElso | alap | ga4 (foglalas_elso) | `FoglalasElso:mb_0muwwfe8qpioj7…` | 29900 HUF | elkuldve | client_id igen, session_id igen, consent DENIED, hash nincs | HTTP 204 (validationMessages: []) |
| Oxigen_AkviziciosFoglalas | ernyo | meta (Oxigen_AkviziciosFoglalas) | `Oxigen_AkviziciosFoglalas:mb_0…` | 29900 HUF | elkuldve | em aa1748e224…, ph b212433f23…, fbc igen, fbp igen, ip 160.79.106.135, ua igen, event_id ✓ | HTTP 200, events_received=1, fbtrace_id=A64rYlBCNGOJNfC-x1PdAO3 |
| Oxigen_AkviziciosFoglalas | ernyo | tiktok (–) | `Oxigen_AkviziciosFoglalas:mb_0…` | 29900 HUF | kihagyva | – | a platform erre az uzletagra nem hirdet / nincs arnyek-celpont |
| Oxigen_AkviziciosFoglalas | ernyo | google (–) | `Oxigen_AkviziciosFoglalas:mb_0…` | 29900 HUF | kihagyva | – | a Google-be csak alapesemeny megy (a visszajaro es az ernyo nem) |
| Oxigen_AkviziciosFoglalas | ernyo | ga4 (–) | `Oxigen_AkviziciosFoglalas:mb_0…` | 29900 HUF | kihagyva | – | a GA4-be csak alapesemeny megy (az ernyo nem) |

## PMU (fizetős kezelés)

- source_entity_id: `mb_0muwwfhg4dvbshd76re7zq6`
- süti-hozzájárulás: statisztika igen, marketing igen (profil `teljes`)
- jelleg: elso, új vendég: true (**szimulált** Salonic-jelzés), Salonic-ár: 99000 Ft, küldött érték: 99000 Ft, élő állapot a küldés előtt: `aktiv`
- Salonic-foglalás: `a6eb41d2-4bb6-bd99-ead6-dff8c518a87b` (a szerveres lépés után azonnal lemondva); `back`: `mb_0muwwfhg4dvbshd76re7zq6`
- érkezési adatok (a szerver tárolta): google: gclid ts=1791304460, wbraid ts=1791304463; meta fbc ts=1791304463; tiktok ttclid ts=1791304463; utm_elso google/qa2_pmu-kezeles_elso; utm_utolso facebook/qa2_pmu-kezeles_utolso; fbp igen; ttp igen; GA4 client/session igen

| esemény | típus | platform (küldött név) | event_id | érték (forrás) | állapot | kiküldött payload (kivonat) | platformválasz |
|---|---|---|---|---|---|---|---|
| FoglalasElso | alap | meta (PMU_FoglalasElso) | `FoglalasElso:mb_0muwwfhg4dvbsh…` | 99000 HUF | elkuldve | em aa1748e224…, ph b212433f23…, fbc igen, fbp igen, ip 160.79.106.131, ua igen, event_id ✓ | HTTP 200, events_received=1, fbtrace_id=Apwq3PrK4vIi_pukZoLtvBr |
| FoglalasElso | alap | tiktok (–) | `FoglalasElso:mb_0muwwfhg4dvbsh…` | 99000 HUF | kihagyva | – | a platform erre az uzletagra nem hirdet / nincs arnyek-celpont |
| FoglalasElso | alap | google (ARNYEK-7825200913) | `FoglalasElso:mb_0muwwfhg4dvbsh…` | 99000 HUF | nincs_hitelesites | akció 7825200913, wbraid, hash igen, jel GRANTED | a kerelem kesz, a kuldeshez hitelesites kell (kulso szallito) |
| FoglalasElso | alap | ga4 (foglalas_elso) | `FoglalasElso:mb_0muwwfhg4dvbsh…` | 99000 HUF | elkuldve | client_id igen, session_id igen, consent GRANTED, hash nincs | HTTP 204 (validationMessages: []) |
| Schedule | ernyo | meta (Schedule) | `Schedule:mb_0muwwfhg4dvbshd76r…` | 99000 HUF | elkuldve | em aa1748e224…, ph b212433f23…, fbc igen, fbp igen, ip 160.79.106.131, ua igen, event_id ✓ | HTTP 200, events_received=1, fbtrace_id=Al6gquGokke_LX6tJ7sBZ6F |
| Schedule | ernyo | tiktok (–) | `Schedule:mb_0muwwfhg4dvbshd76r…` | 99000 HUF | kihagyva | – | a platform erre az uzletagra nem hirdet / nincs arnyek-celpont |
| Schedule | ernyo | google (–) | `Schedule:mb_0muwwfhg4dvbshd76r…` | 99000 HUF | kihagyva | – | a Google-be csak alapesemeny megy (a visszajaro es az ernyo nem) |
| Schedule | ernyo | ga4 (–) | `Schedule:mb_0muwwfhg4dvbshd76r…` | 99000 HUF | kihagyva | – | a GA4-be csak alapesemeny megy (az ernyo nem) |

## Oxigén – konzultáció (a konzultáció értéke NYITOTT: nem megy ki)

- source_entity_id: `mb_0muwwivgz2jeknk9k4xklei`
- süti-hozzájárulás: statisztika igen, marketing igen (profil `teljes`)
- jelleg: konzultacio, új vendég: true (**szimulált** Salonic-jelzés), Salonic-ár: 4990 Ft, küldött érték: nyitott, élő állapot a küldés előtt: `aktiv`
- Salonic-foglalás: `017aca46-492c-cc60-6b1c-4bb189ad266a` (a szerveres lépés után azonnal lemondva); `back`: `mb_0muwwivgz2jeknk9k4xklei`
- érkezési adatok (a szerver tárolta): google: gclid ts=1791304623, wbraid ts=1791304625; meta fbc ts=1791304625; tiktok ttclid ts=1791304625; utm_elso google/qa2_oxigen_elso; utm_utolso facebook/qa2_oxigen_utolso; fbp igen; ttp igen; GA4 client/session igen

| esemény | típus | platform (küldött név) | event_id | érték (forrás) | állapot | kiküldött payload (kivonat) | platformválasz |
|---|---|---|---|---|---|---|---|
| Konzultacio | alap | meta (–) | `Konzultacio:mb_0muwwivgz2jeknk…` | nyitott | nyitott | – | a konzultacio erteke nincs rogzitve (oxigen): nem kuldjuk sem 0-val, sem a Salon |
| Konzultacio | alap | tiktok (–) | `Konzultacio:mb_0muwwivgz2jeknk…` | nyitott | kihagyva | – | a platform erre az uzletagra nem hirdet / nincs arnyek-celpont |
| Konzultacio | alap | google (–) | `Konzultacio:mb_0muwwivgz2jeknk…` | nyitott | nyitott | – | a konzultacio erteke nincs rogzitve (oxigen): nem kuldjuk sem 0-val, sem a Salon |
| Konzultacio | alap | ga4 (–) | `Konzultacio:mb_0muwwivgz2jeknk…` | nyitott | nyitott | – | a konzultacio erteke nincs rogzitve (oxigen): nem kuldjuk sem 0-val, sem a Salon |
| Oxigen_AkviziciosFoglalas | ernyo | meta (–) | `Oxigen_AkviziciosFoglalas:mb_0…` | nyitott | nyitott | – | a konzultacio erteke nincs rogzitve (oxigen): nem kuldjuk sem 0-val, sem a Salon |
| Oxigen_AkviziciosFoglalas | ernyo | tiktok (–) | `Oxigen_AkviziciosFoglalas:mb_0…` | nyitott | kihagyva | – | a platform erre az uzletagra nem hirdet / nincs arnyek-celpont |
| Oxigen_AkviziciosFoglalas | ernyo | google (–) | `Oxigen_AkviziciosFoglalas:mb_0…` | nyitott | kihagyva | – | a Google-be csak alapesemeny megy (a visszajaro es az ernyo nem) |
| Oxigen_AkviziciosFoglalas | ernyo | ga4 (–) | `Oxigen_AkviziciosFoglalas:mb_0…` | nyitott | kihagyva | – | a GA4-be csak alapesemeny megy (az ernyo nem) |

## PMU – konzultáció (a konzultáció értéke NYITOTT: nem megy ki)

- source_entity_id: `mb_0muwwiy1li4lte4etv1anqg`
- süti-hozzájárulás: statisztika igen, marketing igen (profil `teljes`)
- jelleg: konzultacio, új vendég: true (**szimulált** Salonic-jelzés), Salonic-ár: 0 Ft, küldött érték: nyitott, élő állapot a küldés előtt: `aktiv`
- Salonic-foglalás: `7e6ee1ee-3f86-1f03-01a7-ec26545e6905` (a szerveres lépés után azonnal lemondva); `back`: `mb_0muwwiy1li4lte4etv1anqg`
- érkezési adatok (a szerver tárolta): google: gclid ts=1791304623, wbraid ts=1791304625; meta fbc ts=1791304625; tiktok ttclid ts=1791304625; utm_elso google/qa2_pmu_elso; utm_utolso facebook/qa2_pmu_utolso; fbp igen; ttp igen; GA4 client/session igen

| esemény | típus | platform (küldött név) | event_id | érték (forrás) | állapot | kiküldött payload (kivonat) | platformválasz |
|---|---|---|---|---|---|---|---|
| Konzultacio | alap | meta (–) | `Konzultacio:mb_0muwwiy1li4lte4…` | nyitott | nyitott | – | a konzultacio erteke nincs rogzitve (pmu): nem kuldjuk sem 0-val, sem a Salonic  |
| Konzultacio | alap | tiktok (–) | `Konzultacio:mb_0muwwiy1li4lte4…` | nyitott | kihagyva | – | a platform erre az uzletagra nem hirdet / nincs arnyek-celpont |
| Konzultacio | alap | google (–) | `Konzultacio:mb_0muwwiy1li4lte4…` | nyitott | nyitott | – | a konzultacio erteke nincs rogzitve (pmu): nem kuldjuk sem 0-val, sem a Salonic  |
| Konzultacio | alap | ga4 (–) | `Konzultacio:mb_0muwwiy1li4lte4…` | nyitott | nyitott | – | a konzultacio erteke nincs rogzitve (pmu): nem kuldjuk sem 0-val, sem a Salonic  |
| Schedule | ernyo | meta (–) | `Schedule:mb_0muwwiy1li4lte4etv…` | nyitott | nyitott | – | a konzultacio erteke nincs rogzitve (pmu): nem kuldjuk sem 0-val, sem a Salonic  |
| Schedule | ernyo | tiktok (–) | `Schedule:mb_0muwwiy1li4lte4etv…` | nyitott | kihagyva | – | a platform erre az uzletagra nem hirdet / nincs arnyek-celpont |
| Schedule | ernyo | google (–) | `Schedule:mb_0muwwiy1li4lte4etv…` | nyitott | kihagyva | – | a Google-be csak alapesemeny megy (a visszajaro es az ernyo nem) |
| Schedule | ernyo | ga4 (–) | `Schedule:mb_0muwwiy1li4lte4etv…` | nyitott | kihagyva | – | a GA4-be csak alapesemeny megy (az ernyo nem) |

## Összesítés

A hat valódi eset (HeadSpa, HeadSpa-kártya, fodrász, szőr, oxigén, PMU): **12 Meta-esemény** (esetenként 2: alap + ernyő, esetenként külön kérés), TikTok és GA4 a fentiek szerint. Elküldött sorok az összes eset naplójában: Meta 12, TikTok 4, GA4 6. A két „nyitott” eset 0 küldést okozott, ahogy kell.
