# crm/lib - uzleti logika (modul -> publikus API)

Tiszta, platformfuggetlen ES modulok. DB: Cloudflare D1 felulet (`prepare/bind/run/all/first/batch`), teszthez `testdb.js` (`ujAdatbazis()`).
Konvenciok: ido = epoch masodperc, penz = egesz Ft, ID = UUID (kivetel: `salonic_account.id` = fiok-slug, `service_catalog.code`, `role.id`).
Minden fuggveny `(db, {parameterek})` alaku; az `now` opcionalis (alap: `most()`); `staffId` = `staff_user.id`. Hiba: `CrmHiba {kod, status, reszlet}`
(pl. `TILTOTT` 403). Iras = `db.batch` (D1: atomikus) + feltetelek (`WHERE`/`EXISTS`) + UNIQUE; minden iras audit. A `tarolo` (kepek/PDF) parameterkent jon:
`{put(kulcs, bajtok, {mime, meret}), get(kulcs) -> {bajtok, mime}|null, del(kulcs)}`.

Egyetlen Salonic-fiok: `mosaic-oxigen` (`FIOK_ALAP`); tobb fiok a `salonic_account` tablaba vehet fel (teszt: `teszt-masodik-fiok`).

## Migracio
`crm/migrations/0001_init.sql` - a spec 3.3 teljes tablakeszlete + `login_otp`, `session`, `beallitasok`, `rate_limit`, `share_verification`.
Ujrafuttathato. Audit-naplok append-only (trigger). Masolhato magadatok: role, salonic_account, service_catalog.

## Modulok
| modul | fo fuggvenyek |
|---|---|
| `constants.js` | `BERLET`, `CREDIT`, `SZOLGALTATAS_ADAT`, `KAMERA_KOTELEZO_ALKALMAK`, `FOGLALAS_ATMENET`, `DOKUMENTUM_ALKALMANKENT`, hataridok/ablakok, `REQUIRES_VERIFICATION` lista |
| `db.js` | `CrmHiba`, `uuid`, `most`, `elso/mind/futtat/keszit`, `tranzakcio(db, [stmt])`, `beszurHa`, `sha256`, `ujToken`, `normEmail/normTelefon`, `naptariNapHozzaad/naptariNapVege/honapHozzaad/helyiNap` (budapesti naptar) |
| `audit.js` | `auditStmt/naplo({staffId, action, resource, resourceId, guestId, result, detail, ipHash})`, `bookingEventStmt`, `mergeAuditStmt`, `auditLista(filter)` |
| `outbox.js` | `outboxStmt`, `fuggoEsemenyek`, `claim(id)`, `kesz(id)`, `hibas(id)`; esemenytipusok es payload-ok a fajl fejleceben |
| `rbac.js` | `lehet(szerep|[szerepek], muvelet, eroforras)`, `szerepek(db, staffId)`, `megkoveteli(db, staffId, muvelet, eroforras, ctx)` (tiltaskor audit + `TILTOTT`), `MATRIX` |
| `guest.js` | `vendegAzonosit({account, externalGuestId, nev, email, telefon})` -> `{guestId, identityId, eredmeny: meglevo_identity|auto_osszefuzes|uj_vendeg, mergeRequestIds}`, `vendeg`, `vegleges(guestId)`, `kereses`, `emailValtoztat`, `elerhetosegEllenorzott` |
| `merge.js` | `fuggoKeresek`, `fuggoDarab`, `jovahagy({requestId, staffId})`, `elutasit`, `visszafordit({mergeAuditId, staffId})`, `automatikusOsszevon`, `MERGE_TABLAK` |
| `booking.js` | `ingestBookingEvent({account, externalId, service, start, end, status: booked|rescheduled|cancelled|no_show, guest:{externalId,nev,email,telefon}, therapist:{staffId|nev}, eventAt, eventId, bookedAt})` -> `{valtozas: uj|athelyezve|lemondva|no_show|duplikalt|elavult|kihagyva, bookingId, guestId}`; `igazolCompleted({bookingId, staffId})` (az EGYETLEN ut a completed-hez); `foglalas`, `esemenyek`, `szolgaltatasKod` |
| `course.js` | `kuraAllapot(guestId)`, `kuraBiztosit`, `kovetkezoIndex`, `kameraKotelezo(index)`, `szuneteltet/folytat/egyeniLezaras/kuraKorrekcio`, `kezelesek(courseId)` |
| `package.js` | `vasarol({guestId, tipus: package_5|package_10, staffId, fizetesIdeje, idempotencyKey, ajandekAtadva})`, `szabadAlkalmak(purchase|id)`, `foglal/felszabadit`, `autoFoglal(bookingId)`, `athelyezesEngedett`, `hosszabbit`, `korrekcio`, `refund({mod: teljes|egyedi, ajandekAllapot})`, `ajandekAtad/ajandekVisszavesz`, `lejaratFigyelo({napElore: 30|7})`, `vendegBerletei`, `allapotFrissit` |
| `credit.js` | `ellenoriz(guestId)` (jelzes), `jelolLevonas({creditId, bookingId, staffId})` (4 990 Ft, egyszer, DB-szinten), `ujraKapcsol(guestId)` |
| `assessment.js` | `ALAP_KERDOIV` (REQUIRES_VERIFICATION), `letrehozVerzio`, `jovahagyVerzio` (clinical_lead), `kiadhato()`, `kiad({guestId, bookingId})` -> token, `bead({token, valaszok})`, `attekint({submissionId, eredmeny: cleared|consult|postponed|contraindicated})`, `tudomasulVesz`, `stopFeloldas`, `kuraAjanlhato`, `kerdoivAllapot` |
| `plan.js` | `ment`, `veglegesit`, `a5Adat(planId)`, `pdfRogzit({planId, bajtok, tarolo})`, `pdfOlvas`, `kuldhetoE(planId, {cimzett})` -> `{ok, hianyok[]}`, `elkuldve`, `hianyzoDokumentumok`, `dokumentumRiasztasok` (DOC24/DOC48), `kurazaro({courseId})`, `jegyzet`, `mezoHibak`, `mondatSzam` |
| `images.js` | `kepFeltolt({sessionId, bajtok, mime, capturePoint, tarolo})`, `kepOlvas` (munkatars), `osszehasonlit`, `osszehasonlitVeglegesit`, `linkKiad({comparisonId})` -> `{token, to, expiresAt}`, `hozzaferes({token, comparisonId|imageId, tarolo})` -> `{ok, status 200|404|410, fejlecek}`, `ujLinkKeres({token, email, ipHash})` -> `{valasz (publikus, mindig azonos), belso}`, `ujLinkEllenoriz`, `visszavon`, `jogosultsagUjraellenorzes`, `FEJLECEK` |
| `consent.js` | `rogzit({guestId, csatorna: email_marketing|sms_marketing|image_marketing|privacy, szovegVerzio})`, `visszavon`, `leiratkozas`, `lehetMarketing(guestId, csatorna)` (teljes kapu), `marketingAllapot` (ok_kod), `hozzajarulas`, `lehetKepMarketing`, `allapot` |
| `complaint.js` | `surveyKiad({bookingId})` -> token, `surveyBead({token, pont, komment})`, `negativSzoveg`, `kezeloRiport`, `panaszNyit`, `probalkozas`, `lezar`, `felelosCsere`, `keso`, `kompenzacioKeres/kompenzacioDont/kompenzacioKiadhato`, `nyitottPanasz` |

## Kapcsolat az uzenet-motorral (outbox + friss allapot)
Az uzleti irasok `outbox_event`-et kuldenek (tipusok: `outbox.js` fejlec). A motor kuldeskor olvassa ujra: `consent.marketingAllapot`, `package.szabadAlkalmak`,
`plan.kuldhetoE`, `course.kuraAllapot`, `complaint.nyitottPanasz`, `assessment.kuraAjanlhato`, `booking.foglalas`.
`message_template/job/ledger` tablak a migracioban vannak (a motor tulajdona).

## Dontesek / feltevesek (ellenorizendo)
- A `completed` csak `igazolCompleted`-bol johet; a Salonic "attended" jelzes csak `salonic_attended_hint` naplo-sor.
- Bérletalkalom automatikusan foglalodik a folytato (followup_hair) foglalashoz (legkorabban lejaro, szabad berlet; a foglalas a lejarat elott jott letre).
  A felszabaditas `package.felszabadit`. A Salonic-athelyezes nem blokkolhato: szabalysertes = `policy_violation` + `package.policy_violation` outbox.
- Credit-ablak: a felmeres IDOPONTJATOL +30 naptari nap vege (budapesti); a first foglalas `booked_at` ideje szamit. Lemondas utan az ablakban uj foglalas ujra jogosit
  (`CREDIT.UJRA_JOGOSULT_LEMONDAS_UTAN`, kikapcsolhato).
- Az allapotfelmero kerdesei a protokoll nelkul `REQUIRES_VERIFICATION` vazak; jovahagyatlan verzio vendegnek nem adhato ki.
- Negativ szoveg-felismeres: konzervativ kulcsszavas heurisztika (`negativSzoveg`), `surveyBead({negativ})`-val felulirhato.
- Teszt: a `testdb.js` batch-e egy kapcsolaton fut; parhuzamos batch-hez a `crm/test/fixtures.js` sorba allitja (a D1 sorosan futtatja).
