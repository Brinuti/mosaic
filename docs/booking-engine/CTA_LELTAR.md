# CTA-leltár: mit kell a helyben nyíló foglalóra cserélni

Készült: 2026-10-04, a `klon/` oldalakból (asztali). Cél: a meglévő foglaló-gombok és a foglaló oldalak megszüntetéséhez a javasolt `openBooking({…})` kontextus oldalanként. **Ez javaslat, döntést kér** (lent a nyitott kérdések); a kapcsolók és a gombok ma érintetlenek.

## 1. Hova mutatnak ma a foglaló-gombok?

| Cél | Hány oldalon | Megjegyzés |
|---|---|---|
| `/idpontfoglalas` (az „időpontfoglalás” hub) | **89** | a közös fejléc „FOGLALÁS” menüpontja (minden oldalon), plusz a HeadSpa-oldalak saját gombjai („IDŐPONTFOGLALÁS”, „FOGLALOK!”, „PÁROS HEAD SPA IDŐPONTOK”, „SZABAD IDŐPONTOK”) |
| `/mosaic-hair-idopontfoglalas` | 7 | fodrász- és oxigén-oldalak gombjai („INGYENES KONZULTÁCIÓ”, „SZABAD IDŐPONTOK”, „ÁRLISTA + SZABAD IDŐPONTOK”, „IDŐPONT FOGLALÁS”, „FOGLALOK!”, „BEJELENTKEZEK!”) |
| `/szortelenites-foglalas` | 9 | a lézer-oldalak gombjai („IDŐPONTFOGLALÁS”, „FOGLALOK!”, „IDŐPONTOK >>”) |
| `/pmu-foglalas` | 2 | „IDŐPONTOT SZERETNÉK”, „VISSZAHÍVÁST KÉREK” (a PMU-landingen és a hubon) |
| Salonic-link közvetlenül | 24 | a meglévő linktérkép már átköti a motorra (HeadSpa 43, oxigén 8, fodrász 26, lézer 158 link) |
| Stripe (ajándékkártya-vásárlás) | 12 | **marad** (nem foglalás) |
| `tel:` | 89 | marad |

Külön, link nélküli belépők (hirdetés / kereső érkezik rájuk): `/fodraszat-foglalas`, `/kupon-utan-foglalas`, `/smink-foglalas`, valamint maguk a fenti foglaló-oldalak.

## 2. Javasolt leképezés (szabályok)

| # | Hol | Felirat | Javasolt `openBooking` |
|---|---|---|---|
| R1 | közös fejléc, minden oldal | FOGLALÁS | `{}` (szolgáltatás-első kezdőállapot), JS nélkül `/foglalas` |
| R2 | HeadSpa-oldalak (`headspa-*`, `head-spa-*`, `paros-headspa-budapest`, nyitóoldal, ajándékkártya-oldalak) | IDŐPONTFOGLALÁS / FOGLALOK! / IDŐPONT FOGLALÁS / SZABAD IDŐPONTOK | `{business:'headspa'}` |
| R3 | `home`, `index`, `headspa-ferfiaknak` | PÁROS HEAD SPA IDŐPONTOK | `{business:'headspa', service:'paros'}` |
| R4 | ajándékkártya-landingek | „Inkább időpontot foglalok >>” | `{business:'headspa'}` (a beváltás: `voucher:true`, ha az oldal ajándékkártya-beváltóként hív) |
| R5 | fodrász-oldalak (`noi-*`, `balayage-*`, `30szazalek`, `noi-hajfestes-*`) | INGYENES KONZULTÁCIÓ | `{business:'hair', service:'konzult'}` |
| R6 | ugyanott | SZABAD IDŐPONTOK / IDŐPONT FOGLALÁS / ÁRLISTA + SZABAD IDŐPONTOK / FOGLALOK! | `{business:'hair'}`; a Balayage-oldalon `service_category:'balayage'`, a hajfestés-oldalon `service_category:'color'` |
| R7 | oxigén-oldalak (`oxigenterapia-*`) | IDŐPONTFOGLALÁS / FOGLALOK! / BEJELENTKEZEK! | `{business:'oxygen'}` (az 1. és 2. alkalom a szolgáltatás-kérdésből) |
| R8 | lézer-oldalak (`lezeres-*`, `szortelenites-*`, `szőrtelenítés-*`, `vegleges-*`) | IDŐPONTFOGLALÁS / FOGLALOK! | `{business:'laser'}`; konzultációs CTA: `service:'konzult'` |
| R9 | PMU-landing, hub | IDŐPONTOT SZERETNÉK / VISSZAHÍVÁST KÉREK | `{business:'pmu'}` (a PMU saját folyamata; a visszahívás a PMU-folyamat „visszahívás” lépése) |
| R10 | Salonic-linkek | – | a meglévő linktérkép (kapcsolónként), a motor kontextusával |

A leképezést a build végezné (a linktérkép kiterjesztése belső linkekre és oldal-/felirat-kontextusra), a launcher a `/foglalo-motor?…` hivatkozásokat már most a rétegben nyitja; JS nélkül ezek a `/foglalo-motor` oldalra visznek.

## 3. Nyitott kérdések (a tulajdonos döntése)

1. **A megszűnő foglaló-oldalak sorsa.** Az `/idpontfoglalas` és a `/mosaic-hair-idopontfoglalas` **hirdetési landing** is (ma a Meta-pixel listán vannak). Ha megszűnnek, hova irányítsunk? Javaslat: `/idpontfoglalas` → `/foglalas` (301, a query marad), `/mosaic-hair-idopontfoglalas` → `/foglalas?business=hair`, `/szortelenites-foglalas` → `/foglalas?business=laser`, `/pmu-foglalas` → `/foglalo-pmu`.
2. **Mérés az oldal-módú motoron.** A `/foglalas` és a `/foglalo-motor` oldalon ma **nincs mérőkód** (se Meta-pixel, se GTM, se süti-sáv). Ha hirdetés érkezik rájuk (átirányítás után az `/idpontfoglalas` és társai), pixel / `_fbc` nélkül jönnének be (ugyanaz a hiány, amit a pixel-listával pótoltunk). Kell a `suti.js` az oldalra, és a pixel az üzletághoz tartozzon (`?business=…`-ból), a H0-ra pedig döntés kell: melyik pixel (vagy mindegyik) fusson. Az oldal-módú motor lépései ekkor is URL-változás nélkül menjenek (GTM History Change).
3. **Főmenü „FOGLALÁS”.** Réteg (szolgáltatás-első kezdőállapot a jelenlegi oldalon) vagy navigáció a `/foglalas` oldalra? Javaslat: réteg (mini-app érzés), JS nélkül és közvetlen belépésnél a `/foglalas` oldal.
4. **Oxigén és lézer „általános” belépés.** A gomb az üzletág első kérdésére vigyen (oxigén: „Mit szeretnél foglalni?”, lézer: „Melyik út illik rád?”), vagy az oldal ismer konkrétabb szándékot (pl. a lézer-oldalakon konzultáció)? Az R8 szerinti konzultációs CTA-t oldalanként meg kell nézni.
5. **Ajándékkártya-oldalakon** a „Inkább időpontot foglalok” gomb a rendes foglalásra vigyen, vagy a beváltásra (`voucher:true`)?
