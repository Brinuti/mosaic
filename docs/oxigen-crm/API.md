# CRM HTTP API (szerzodes az API-t es a UI-t epito fejlesztoknek)

Alap: `/api/crm/...`, JSON (kivetel: fajl- es HTML-valaszok). Auth: `crm_sess` cookie (HttpOnly, Secure, SameSite=Strict, a sessiont a DB `session` tablaja adja, tokenje hash-elve), minden
irasi kerest (`POST/PUT/PATCH/DELETE`) `X-CRM-CSRF` fejlec kiser (a belepeskor kapott `csrf` ertek). Minden valasz: `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`.
Hiba: `{ "hiba": { "kod": "TILTOTT", "uzenet": "..." } }` + megfelelo HTTP statusz (401 nincs belepve, 403 tiltott, 404, 409 allapot-utkozes, 422 validacio, 429 rate limit). A jogosultsagot MINDEN vegponton a backend ellenorzi (`crm/lib/rbac.js`),
a UI csak elrejt. Idok: epoch masodperc. Penz: egesz Ft. ID: UUID.

## Auth
| metodus ut | torzs -> valasz |
|---|---|
| `POST /auth/kod-keres` | `{email}` -> mindig `200 {ok:true}` (nem arulja el, letezik-e); csak a `staff_user`-ben aktivkent szereplo (vagy `CRM_ADMIN_EMAILS`-beli) cimre kuld 6 jegyu, 10 percig ervenyes, egyszer hasznalhato kodot (SMTP, DRY modban csak naplo); rate limit |
| `POST /auth/kod-ellenoriz` | `{email, kod}` -> `{csrf, felhasznalo:{id,nev,email,szerepek[]}}` + cookie; hibas probak szamlalva / zarolas |
| `POST /auth/demo` | `{szerep}` -> mint fent; CSAK ha `env.CRM_DEMO==='1'` ES a host nem `www.mosaicheadspa.hu`/`mosaicheadspa.hu` (kulonben 404); demo-adatot is betolti (egyszer) |
| `GET /auth/en` | -> `{felhasznalo, csrf}` vagy 401 |
| `POST /auth/kilep` | session torles |

## Dashboard, kereses, vendeg
| `GET /dashboard?nezet=kezelo|menedzsment` | -> a spec 3.2/1. pont szamai: ma/holnap foglalasok, uj elso kezelesek, felmeresek, teljesitett alkalmak, keszulo A5, lejaro berletek, STOP-ok, kuldesi hibak (a kezelo-nezet sajat vendegek; a menedzsment aggregalt, nyers egeszsegi adat nelkul) |
| `GET /vendegek?q=` | kereses (nev/e-mail/telefon reszlet), `{vendegek:[{id, nev, email_maszkolt, telefon_maszkolt, utolso_foglalas, kura_allapot}]}` |
| `GET /vendegek/:id` | profil: `{vendeg, azonositok[], foglalasok[], kura, berletek[], credit, hozzajarulasok, uzenetek[], dokumentumok[], panaszok[], kepek:[{id,alkalom}]}`; szerepkor szerinti szures (recepcio: nincs kep/kerdoiv/egeszsegi mezo) |
| `POST /vendegek/:id/email` | `{email}` -> emailvaltozas + jogosultsag-ujraellenorzes |
| `GET /osszevonas` ; `POST /osszevonas/:id/jovahagy` / `elutasit` ; `POST /osszevonas-audit/:id/visszafordit` | `crm/lib/merge.js` |

## Munkalista, kezeles-igazolas, felmero
| `GET /munkalista?nap=YYYY-MM-DD` | a nap foglalasai: vendeg, szolgaltatas, kezelo, felmero-allapot, kontraindikacio-jelzes, megjelent/igazolt allapot, kovetkezo foglalas |
| `POST /foglalasok/:id/completed` | kezelo igazolja a teljesiteset (csak jogosult kezelo; `igazolCompleted`); -> `{kezeles_sorszam, kamera_kotelezo}` |
| `POST /foglalasok/:id/no-show` | hiteles no_show jeloles (jogosult) |
| `GET /felmero/verziok` ; `POST /felmero/verziok` ; `POST /felmero/verziok/:id/jovahagy` | clinical_lead jovahagyas; jovahagyatlan verzio nem adhato ki |
| `POST /foglalasok/:id/felmero-kiad` | kerdoiv-token (a vendeg linkhez) |
| `GET /foglalasok/:id/felmero` ; `POST /felmero/:submissionId/attekint` | kezelo/clinical_lead attekintes, kontraindikacio kezeles |

## Kuraterv, A5
| `GET /kezelesek/:sessionId/terv` ; `PUT /kezelesek/:sessionId/terv` | A5 mezok (spec 1151-1165), piszkozat mentes |
| `POST /tervek/:id/veglegesit` | therapist_final |
| `GET /tervek/:id/a5.pdf` | A5 PDF (`crm/lib/pdf.js`, a betutipusok az `ASSETS` bindingbol / fajlbol), `Content-Disposition: inline`, no-store |
| `POST /tervek/:id/kuld` | e-mail kuldes (outboxon at; `kuldhetoE` feltetelek, DRY mod) |
| `POST /kurak/:id/kurazaro` | 11. alkalom zaro-dokumentum (A5 + e-mail) |
| `GET /dokumentumok/hianyzo` | 24h/48h hianyzo dokumentumok |

## Kepek
| `POST /kezelesek/:sessionId/kepek?pont=1|3|5|10` | nyers kep-bajtok (Content-Type: image/jpeg|png|webp; max 6 MB; tartalom-ellenorzes magic byte-tal) -> `{id}`; csak 1/3/5/10. alkalmon |
| `GET /kepek/:id` | munkatars-megtekintes (csak kezelo/clinical_lead; audit) |
| `POST /osszehasonlitas` `{kep_a, kep_b, komment}` ; `POST /osszehasonlitas/:id/veglegesit` ; `POST /osszehasonlitas/:id/link` | 2-3 mondatos komment, 30 napos link kiadasa (e-mail az outboxon at) |

## Berlet, credit
| `GET /vendegek/:id/berletek` ; `POST /berletek` `{guest_id, tipus, fizetes_ideje, ajandek_atadva}` (recepcio/salon_manager) ; `POST /berletek/:id/hosszabbit` / `refund` / `korrekcio` (salon_manager) |
| `GET /vendegek/:id/credit` ; `POST /credit/:id/levonas` `{booking_id}` (recepcio/kezelo; egyszer) |

## Hozzajarulas, elegedettseg, panasz
| `GET /vendegek/:id/hozzajarulasok` ; `POST /vendegek/:id/hozzajarulasok` `{csatorna, allapot, szoveg_verzio}` ; visszavonas | `crm/lib/consent.js` |
| `GET /panaszok?allapot=open` ; `POST /panaszok/:id/probalkozas` / `lezar` / `felelos` ; `POST /panaszok/:id/kompenzacio` (kerelem) ; `POST /kompenzaciok/:id/dontes` (salon_manager) | `crm/lib/complaint.js` |
| `GET /elegedettseg?tol&ig` | kezelonkenti 1-5 riport |

## Uzenetek
| `GET /uzenetek/sablonok` | katalogus (azonosito, csoport, csatorna, trigger, gate, verzio) |
| `POST /uzenetek/elonezet` `{template_key, guest_id, booking_id?}` | `{targy, html, szoveg, sms, hianyzo[]}` + a vendeg AKTUALIS allapota szerinti kapu-dontes (mehet / kihagy + ok) |
| `GET /uzenetek/jobok?allapot=&guest_id=` | `message_job` + `message_ledger` |
| `POST /uzenetek/jobok/:id/ujra` | kezi ujrafuttatas (dead-letter) |
| `POST /uzenetek/sandbox-proba` `{template_key, guest_id}` | kezi sandbox proba (SOHA valodi kuldes) |
| `GET /uzenetek/uzemmod` | `{kuldes:'dry'|'eles', ...}` (csak olvashato; az atkapcsolas a tulajdonos GO-ja, kod-szinten) |

## Mutatok, beallitasok, hozzaferes
| `GET /merok?tol&ig&kezelo=` | SHOW1, SHOW_RATE, R2/R5/R10/R11, NEXT_BOOKED_ON_SITE, PACKAGE_RATE_5/10, ASSESS_TO_FIRST, CREDIT_REDEEM, CONSENT_EMAIL/SMS, MESSAGE_DELIVERY, COMPLAINT_RESOLUTION_24H, DOC_COMPLETION_24H, SALONIC_SYNC_LATENCY, MERGE_REVIEW_PENDING (a spec 3.11 definicioi; kohorsz-ervenyesites; nincs becsult retencio) |
| `GET /beallitasok` ; `PUT /beallitasok/:kulcs` | szolgaltatas-map, beszamitas, adatmegorzes, jogi szovegverziok (admin/salon_manager) |
| `GET /munkatarsak` ; `POST /munkatarsak` ; `PATCH /munkatarsak/:id` | felvetel / szerepkor / deaktivalas (admin, salon_manager); minden valtozas audit |
| `GET /audit?tol&ig&muvelet=` ; `GET /audit/export.csv` | security_audit (admin, salon_manager) |
| `GET /salonic-allapot` | az 1 fiok (mosaic-oxigen) allapota: utolso bejovo esemeny ideje, szinkron-keses |

## Bejovo (gepi)
| `POST /ingest` | fejlec `X-CRM-KULCS` (a kulcs SHA-256-ja a `CRM_KULCS_HASH` valtozoban); torzs a lifecycle `parser.js` elemzett esemenye -> `booking.ingestBookingEvent` + outbox; idempotens |
| `POST /tick` | ugyanaz a kulcs; esedekes uzenet-jobok feldolgozasa (motor), napi karbantartas |

## Publikus (vendeg), CSAK token / egyszer hasznalhato link, minden oldal no-store + no-referrer + noindex
| `GET /public/felmero/:token` -> HTML urlap ; `POST /public/felmero/:token` | digitalis allapotfelmero (a kerdoiv-verzio jovahagyott) |
| `GET /public/kep/:token` -> HTML nezet (osszehasonlitas) ; `GET /public/kep/:token/:imageId` -> kep | 30 napos token, rate limit, hozzaferesi naplo; mas vendeg kepere 404 |
| `POST /public/uj-link` `{email}` | MINDIG ugyanaz a valasz; ha az e-mail regisztralt, egyszer hasznalhato verifikacios linket kuld |
| `GET /public/uj-link/:verifikacios-token` | uj 30 napos hozzaferes kiadasa |
| `GET /public/elegedettseg/:token` -> HTML ; `POST /public/elegedettseg/:token` `{pont, komment}` | 1-5 pont |
| `GET /public/leiratkozas/:token` ; `POST ...` | csatornankent leiratkozas |
| `POST /public/hozzajarulas` | az uj landing foglalo-blokkjabol: `{selected_service, email_marketing:boolean, sms_marketing:boolean, szoveg_verzio, kapcsolat:{email, telefon}}` -> a `consent_event` a foglalas beerkezese utan hozzakapcsolodik (az ingest az e-mail/telefon alapjan); marketing-hozzajarulas SOHA nem elofeltetel |
