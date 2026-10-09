// Demo-adat: demoAdatBetolt(db, {most}) - eletszeru, ELLENORIZHETOEN KITALALT adat a belso UI bemutatasahoz / fejleszteshez.
//  - Nevek: "Demo Anna" stilus; e-mail: ...@example.invalid (RFC 2606, a motor SOSEM kuldi: SANDBOX_ONLY); telefon: 06 1 555 xxxx. Soha nem kerunk valodi adatot.
//  - ~15 vendeg kulonbozo allapotban: uj foglalas, felmeres kesz, elso kezeles kesz, 3. kezeles kamera-osszehasonlitassal, 11. lezart kura, 5-os / 10-es berlet,
//    lejaro berlet, nyitott panasz, kontraindikacio-riasztas, fuggo osszevonasi keres, 4 990 Ft credit jogosultsag, no-show, lemondas.
//  - 3-4 munkatars szerepkoronkent (staff_user: therapist, clinical_lead, reception, salon_manager, marketing, admin), demo-... azonositokkal.
//  - Jovahagyott kerdoiv-verzio MARKER-rel: "DEMO - nem szakmai" (NEM az Oxygeni protokoll; csak demo-rendszerben hasznalhato).
//  - Kepek: a camera_image sorok letrejonnek, de a tarolo-bejegyzes (bajtok) NINCS (demo-kepek helyett); a kepolvasas HIANYZO_FAJL-t ad.
//  - Idempotens: a marker (beallitasok 'demo.betoltve') + determinisztikus kulso azonositok miatt ketszer futtatva nem duplikal.
//  - Biztonsag: valodi (nem demo) vendeg- vagy jovahagyott kerdoiv-adat mellett NEM tolt be (NEM_URES_ADATBAZIS), kiveve engedelyezNemUres.
import { CrmHiba, most as maMost, elso, mind, keszit, helyi, helyiEpoch, naptariNapHozzaad, jsonIr, jsonOlvas } from './db.js';
import { FIOK_ALAP, MASODPERC } from './constants.js';
import { auditStmt } from './audit.js';
import { ingestBookingEvent, igazolCompleted } from './booking.js';
import { ALAP_KERDOIV, letrehozVerzio, jovahagyVerzio, kiad as kerdoivKiad, bead as kerdoivBead, attekint } from './assessment.js';
import * as consent from './consent.js';
import * as plan from './plan.js';
import * as images from './images.js';
import * as pk from './package.js';
import * as cp from './complaint.js';
import { szolgaltatasTerkepFeltolt } from './ingest.js';
import { outboxFeldolgoz } from './motor.js';

const NAP = MASODPERC.NAP;
const ORA = MASODPERC.ORA;
export const DEMO_MARKER = 'DEMO - nem szakmai';
export const DEMO_KERDOIV_VERZIO = `demo-v1 (${DEMO_MARKER})`;
export const DEMO_KULCS = 'demo_betoltve';   // az API (api.js demoAdatBetoltDb) is ezt a kulcsot hasznalja; a /beallitasok API nem mutatja

/** 3-4 munkatars szerepkoronkent: [szerep, [nev...]] */
export const DEMO_MUNKATARSAK = Object.freeze({
  therapist: ['Demo Kata', 'Demo Zita', 'Demo Lilla', 'Demo Nóra'],
  clinical_lead: ['Demo Janka', 'Demo Judit', 'Demo Piroska'],
  reception: ['Demo Réka', 'Demo Rita', 'Demo Rózsa'],
  salon_manager: ['Demo Vilma', 'Demo Vera', 'Demo Viki'],
  marketing: ['Demo Máté', 'Demo Mira', 'Demo Marci'],
  admin: ['Demo Ádor', 'Demo Áron', 'Demo Alex'],
});
const ekezetNelkul = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '');
const staffId = (szerep, i) => `demo-staff-${szerep}-${i + 1}`;

const DEMO_TERV = Object.freeze({
  fo_panasz: 'DEMO: ritkulo hajszal (kitalalt adat)', megfigyelesek: ['DEMO megfigyeles: enyhe zsirosodas (kitalalt)', 'DEMO megfigyeles: ritkulo fejtetoi resz (kitalalt)'], cel: 'DEMO cel: a fejbor egyensulya',
  teljes_kura_11: true, ritmus_nap: 14, otthoni_apolas: { termek: 'DEMO sampon', hasznalat: 'hetente 2-3 alkalommal' },
  kezeloi_javaslat: 'DEMO szoveg, nem szakmai. Ket hetente javaslom a kezelest. Ez kitalalt demo-tartalom.',
  kovetkezo_idopont: { javasolt_intervallum: 'kb. 2 het mulva' },
});
const DEMO_ELLENORZES = Object.freeze({ ertekeles: 'DEMO ertekeles, nem szakmai. Kitalalt demo-tartalom.', otthoni_rutin_kontroll: 'DEMO: a rutin megfelelo (kitalalt).' });
const DEMO_ZARAS = Object.freeze({ kiindulo_panasz: 'DEMO: ritkulo hajszal', cel: 'DEMO cel', zaro_ertekeles: 'DEMO zaro ertekeles (kitalalt, nem szakmai)', fenntartasi_javaslat: 'DEMO: egyeni fenntartas (kitalalt)', otthoni_rutin: 'DEMO otthoni rutin' });
const VALASZ_JO = Object.freeze({ adatkezeles_elfogadva: true, panasz_tipus: ['hajhullas'], korabbi_reakcio: false, termek_allergia: false, aktualis_fejbor_tunet: false, hajmosasi_szunet_tudomasul: true, sulyosbodo_tunet: false });

// ---------------------------------------------------------------------------------------------------------------------------------
const hibatur = async (fn) => { try { return await fn(); } catch (e) { if (e instanceof CrmHiba) return null; throw e; } };

/** a "most" budapesti napjanak 10:00-ja, n naptari nappal eltolva */
function napPont(most, napok, ora = 10) {
  const l = helyi(most);
  return naptariNapHozzaad(helyiEpoch(l.y, l.m, l.d, ora, 0), napok);
}

async function munkatarsakBetolt(db, most) {
  let db_ = 0;
  for (const [szerep, nevek] of Object.entries(DEMO_MUNKATARSAK)) {
    for (const [i, nev] of nevek.entries()) {
      // szerepkoronkent az ELSO munkatars a demo-belepes (auth.demoBelep) munkatarsa: demo-<szerep>@demo.invalid -> az o vendegei / foglalasai latszanak a belepes utan
      const email = i === 0 ? `demo-${szerep.replace(/_/g, '-')}@demo.invalid` : `demo.${ekezetNelkul(nev.replace('Demo ', ''))}@example.invalid`;
      const r = await keszit(db, 'INSERT OR IGNORE INTO staff_user (id, email, name, salonic_name, active, created_at) VALUES (?1, ?2, ?3, ?4, 1, ?5)', staffId(szerep, i), email, nev, szerep === 'therapist' ? nev : null, most).run();
      await keszit(db, 'INSERT OR IGNORE INTO staff_role (staff_id, role_id, granted_by, granted_at) VALUES (?1, ?2, \'demo\', ?3)', staffId(szerep, i), szerep, most).run();
      db_ += r.meta.changes;
    }
  }
  return db_;
}

async function kerdoivBetolt(db, most) {
  const janka = staffId('clinical_lead', 0);
  await hibatur(() => letrehozVerzio(db, { version: DEMO_KERDOIV_VERZIO, definicio: { marker: DEMO_MARKER, megjegyzes: 'Kitalalt demo-kerdoiv, NEM az Oxygeni szakmai protokoll; vendegnek nem adhato ki.', csoportok: ALAP_KERDOIV.csoportok }, staffId: janka, now: most }));
  await hibatur(() => jovahagyVerzio(db, { version: DEMO_KERDOIV_VERZIO, staffId: janka, now: most }));
}

async function hozzajarulas(db, guestId, csatorna, most, { visszavon = false } = {}) {
  const volt = await elso(db, 'SELECT 1 AS x FROM consent_event WHERE guest_id = ?1 AND channel = ?2 LIMIT 1', guestId, csatorna);
  if (volt) return;
  await consent.rogzit(db, { guestId, csatorna, szovegVerzio: 'demo-v1', forras: 'admin', now: most - 20 * NAP });
  if (visszavon) await consent.visszavon(db, { guestId, csatorna, forras: 'sms_stop', now: most - 2 * NAP });
}

/** egy foglalas beerkeztetese a vendeghez (determinisztikus kulso azonosito -> idempotens) */
async function foglal(db, g, { kod, szolgaltatas, start, allapot = 'booked', kezelo, foglalvaEzelott = 3 * NAP, most, eventAt = null }) {
  const bookedAt = Math.min(start - foglalvaEzelott, most - 60);
  return ingestBookingEvent(db, {
    account: FIOK_ALAP, externalId: `demo-${g.kod}-${kod}`, service: szolgaltatas, start, status: allapot,
    therapist: kezelo ? { staffId: kezelo } : null, guest: { externalId: g.ext, nev: g.nev, email: g.email, telefon: g.telefon },
    eventAt: eventAt ?? bookedAt, bookedAt, now: eventAt ?? bookedAt,
  });
}

/** n igazolt kezeles (14 naponkent), az elso `napokOta` napja volt */
async function kezelesek(db, g, { n, napokOta, kezelo, most, lepes = 14 }) {
  const ki = [];
  for (let i = 1; i <= n; i++) {
    const start = napPont(most, -(napokOta - (i - 1) * lepes));
    const f = await foglal(db, g, { kod: `k${i}`, szolgaltatas: i === 1 ? 'first_hair' : 'followup_hair', start, kezelo, most });
    const c = await igazolCompleted(db, { bookingId: f.bookingId, staffId: kezelo, now: start + 2 * ORA });
    ki.push({ ...f, ...c, start });
  }
  return ki;
}

/** a vendeg osszes hianyzo dokumentumanak kitoltese + veglegesitese (a kezelo nevében) */
async function dokumentumKesz(db, guestId, kezelo, most) {
  const tervek = await mind(db, 'SELECT p.*, s.confirmed_at FROM treatment_plan p JOIN treatment_session s ON s.id = p.session_id WHERE p.guest_id = ?1 AND p.status IN (\'missing\', \'draft\') ORDER BY s.treatment_index', guestId);
  for (const p of tervek) {
    const mezok = p.kind === 'plan' ? DEMO_TERV : p.kind === 'review' ? DEMO_ELLENORZES : DEMO_ZARAS;
    const mikor = Math.min(p.confirmed_at + 6 * ORA, most - 60);
    await plan.ment(db, { planId: p.id, mezok, staffId: kezelo, now: mikor });
    await plan.veglegesit(db, { planId: p.id, staffId: kezelo, now: mikor });
  }
}

/** demo-kep sor (tarolo-bejegyzes NELKUL) a kamerakotelezo alkalmakhoz */
async function demoKep(db, guestId, sessionId, index, kezelo, mikor) {
  const id = `demo-kep-${sessionId}-${index}`;
  await keszit(db, `INSERT OR IGNORE INTO camera_image (id, guest_id, session_id, treatment_index, capture_point, storage_key, mime, size_bytes, sha256, taken_by, taken_at)
    VALUES (?1, ?2, ?3, ?4, 'fo', ?5, 'image/jpeg', 0, NULL, ?6, ?7)`, id, guestId, sessionId, index, `demo/nincs-kep/${id}`, kezelo, mikor).run();
  return id;
}

// ---------------------------------------------------------------------------------------------------------------------------------
/**
 * @param {object} db
 * @param {{most?: number, engedelyezNemUres?: boolean}} [p]
 * @returns {Promise<{mar: boolean, munkatarsak?: number, vendegek?: number, ...}>}
 */
export async function demoAdatBetolt(db, { most = null, now = null, engedelyezNemUres = false } = {}) {
  most = most ?? now ?? maMost();
  const marker = await elso(db, 'SELECT ertek FROM beallitasok WHERE kulcs = ?1', DEMO_KULCS);
  if (marker) { const j = jsonOlvas(marker.ertek, {}); return { mar: true, ...(j && typeof j === 'object' ? j : {}) }; }
  if (!engedelyezNemUres) {
    const valodiVendeg = await elso(db, 'SELECT COUNT(*) AS n FROM salonic_guest_identity WHERE external_id NOT LIKE \'demo-%\'');
    const valodiKerdoiv = await elso(db, 'SELECT COUNT(*) AS n FROM assessment WHERE approved_by_clinical_lead = 1 AND question_version NOT LIKE \'demo-%\'');
    if (valodiVendeg.n > 0 || valodiKerdoiv.n > 0) throw new CrmHiba('NEM_URES_ADATBAZIS', 'a demo-adat nem toltheto valodi vendeg- / kerdoiv-adat mellett', 409);
  }
  const munkatarsak = await munkatarsakBetolt(db, most);
  await kerdoivBetolt(db, most);
  await szolgaltatasTerkepFeltolt(db);

  const kata = staffId('therapist', 0), zita = staffId('therapist', 1), lilla = staffId('therapist', 2), janka = staffId('clinical_lead', 0);
  const recepcio = staffId('reception', 0);
  const g = (kod, nev, sorszam, extra = {}) => ({ kod, ext: `demo-${kod}`, nev, email: `demo.${ekezetNelkul(nev.replace('Demo ', ''))}@example.invalid`, telefon: `06 1 555 ${String(100 + sorszam).padStart(4, '0')}`, ...extra });
  const guestId = async (v) => (await elso(db, 'SELECT guest_id FROM salonic_guest_identity WHERE account = ?1 AND external_id = ?2', FIOK_ALAP, v.ext))?.guest_id;
  const stat = { vendegek: 0 };
  const uj = (v) => { stat.vendegek += 1; return v; };

  // 1. Demo Anna: uj foglalas (elso kezeles 3 nap mulva), kerdoiv kiadva, email + SMS hozzajarulas
  const anna = uj(g('g01', 'Demo Anna', 1));
  const annaF = await foglal(db, anna, { kod: 'k1', szolgaltatas: 'first_hair', start: napPont(most, 3), kezelo: kata, foglalvaEzelott: NAP, most });
  await hibatur(() => kerdoivKiad(db, { guestId: annaF.guestId, bookingId: annaF.bookingId, now: most - 3 * ORA }));
  await hozzajarulas(db, annaF.guestId, 'email_marketing', most); await hozzajarulas(db, annaF.guestId, 'sms_marketing', most);

  // 2. Demo Bea: felmeres kesz (hajkamera 5 napja, kerdoiv kitoltve + atnezve), nincs elso kezeles foglalas (credit nyitott)
  const bea = uj(g('g02', 'Demo Bea', 2));
  const beaF = await foglal(db, bea, { kod: 'cam', szolgaltatas: 'camera_assessment', start: napPont(most, -5), kezelo: zita, most });
  await igazolCompleted(db, { bookingId: beaF.bookingId, staffId: zita, now: napPont(most, -5) + ORA });
  const beaK = await hibatur(() => kerdoivKiad(db, { guestId: beaF.guestId, bookingId: beaF.bookingId, now: napPont(most, -6) }));
  if (beaK?.token) {
    const b = await kerdoivBead(db, { token: beaK.token, valaszok: VALASZ_JO, adatkezelesVerzio: 'demo-v1', now: napPont(most, -6) + ORA });
    await hibatur(() => attekint(db, { submissionId: b.submissionId, staffId: zita, eredmeny: 'cleared', now: napPont(most, -5) }));
  }
  await hozzajarulas(db, beaF.guestId, 'email_marketing', most);

  // 3. Demo Cili: elso kezeles kesz (tegnap), a dokumentum vazlat (DOC24 / DOC48 jelleg), elegedettsegi kerdoiv kiadva
  const cili = uj(g('g03', 'Demo Cili', 3));
  const [ciliK] = await kezelesek(db, cili, { n: 1, napokOta: 1, kezelo: kata, most });
  const ciliTerv = await elso(db, 'SELECT id FROM treatment_plan WHERE guest_id = ?1', ciliK.guestId);
  await hibatur(() => plan.ment(db, { planId: ciliTerv.id, mezok: { fo_panasz: DEMO_TERV.fo_panasz }, staffId: kata, now: ciliK.start + 3 * ORA }));
  await hibatur(() => cp.surveyKiad(db, { bookingId: ciliK.bookingId, now: ciliK.start + 5 * ORA }));

  // 4. Demo Dora: 3. kezeles kamera-osszehasonlitassal (1. es 3. alkalom kepe, vegleges ertekeles, kesz dokumentacio)
  const dora = uj(g('g04', 'Demo Dóra', 4));
  const doraK = await kezelesek(db, dora, { n: 3, napokOta: 30, kezelo: kata, most });
  const doraS = await mind(db, 'SELECT id, treatment_index FROM treatment_session WHERE guest_id = ?1 ORDER BY treatment_index', doraK[0].guestId);
  const kep = {};
  for (const idx of [1, 3]) kep[idx] = await demoKep(db, doraK[0].guestId, doraS.find((s) => s.treatment_index === idx).id, idx, kata, doraK[idx - 1].start + ORA);
  const osszeh = await hibatur(() => images.osszehasonlit(db, { imageAId: kep[1], imageBId: kep[3], staffId: kata, note: 'DEMO osszehasonlitas, nem szakmai. Kitalalt demo-tartalom.', now: doraK[2].start + 3 * ORA }));
  if (osszeh) await hibatur(() => images.osszehasonlitVeglegesit(db, { comparisonId: osszeh.comparisonId, staffId: kata, now: doraK[2].start + 4 * ORA }));
  await dokumentumKesz(db, doraK[0].guestId, kata, most);
  await hozzajarulas(db, doraK[0].guestId, 'email_marketing', most);

  // 5. Demo Emma: 11. kezeles utan lezart kura (zaro dokumentum kesz)
  const emma = uj(g('g05', 'Demo Emma', 5));
  const emmaK = await kezelesek(db, emma, { n: 11, napokOta: 150, kezelo: zita, most });
  await dokumentumKesz(db, emmaK[0].guestId, zita, most);
  await hozzajarulas(db, emmaK[0].guestId, 'email_marketing', most);

  // 6. Demo Fanni: 5-os berlet (20 napja vasarolt), a kovetkezo alkalom foglalva
  const fanni = uj(g('g06', 'Demo Fanni', 6));
  const fanniK = await kezelesek(db, fanni, { n: 1, napokOta: 20, kezelo: kata, most });
  await dokumentumKesz(db, fanniK[0].guestId, kata, most);
  await pk.vasarol(db, { guestId: fanniK[0].guestId, tipus: 'package_5', staffId: recepcio, fizetesIdeje: fanniK[0].start + 3 * ORA, idempotencyKey: 'demo-berlet-fanni', ajandekAtadva: true, now: fanniK[0].start + 3 * ORA });
  await foglal(db, fanni, { kod: 'k2', szolgaltatas: 'followup_hair', start: napPont(most, 5), kezelo: kata, most });
  await hozzajarulas(db, fanniK[0].guestId, 'email_marketing', most);

  // 7. Demo Greta: 10-es berlet (40 napja), 3 kezeles utan
  const greta = uj(g('g07', 'Demo Gréta', 7));
  const gretaK = await kezelesek(db, greta, { n: 3, napokOta: 40, kezelo: lilla, most });
  await dokumentumKesz(db, gretaK[0].guestId, lilla, most);
  await pk.vasarol(db, { guestId: gretaK[0].guestId, tipus: 'package_10', staffId: recepcio, fizetesIdeje: gretaK[0].start + 3 * ORA, idempotencyKey: 'demo-berlet-greta', ajandekAtadva: true, now: gretaK[0].start + 3 * ORA });
  await hozzajarulas(db, gretaK[0].guestId, 'email_marketing', most); await hozzajarulas(db, gretaK[0].guestId, 'sms_marketing', most);

  // 8. Demo Hanna: lejaro 5-os berlet (160 napja vasarolt: ~3 het mulva lejar), 3 szabad alkalommal
  const hanna = uj(g('g08', 'Demo Hanna', 8));
  const hannaK = await kezelesek(db, hanna, { n: 3, napokOta: 150, kezelo: kata, most });
  await dokumentumKesz(db, hannaK[0].guestId, kata, most);
  await pk.vasarol(db, { guestId: hannaK[0].guestId, tipus: 'package_5', staffId: recepcio, fizetesIdeje: napPont(most, -160), idempotencyKey: 'demo-berlet-hanna', ajandekAtadva: true, now: napPont(most, -160) });
  await hozzajarulas(db, hannaK[0].guestId, 'email_marketing', most); await hozzajarulas(db, hannaK[0].guestId, 'sms_marketing', most);

  // 9. Demo Ilka: nyitott panasz (az elso kezeles utani 2 pontos visszajelzes -> panasz a sajat kezelonek)
  const ilka = uj(g('g09', 'Demo Ilka', 9));
  const [ilkaK] = await kezelesek(db, ilka, { n: 1, napokOta: 3, kezelo: zita, most });
  await dokumentumKesz(db, ilkaK.guestId, zita, most);
  const sv = await hibatur(() => cp.surveyKiad(db, { bookingId: ilkaK.bookingId, now: ilkaK.start + 3 * ORA }));
  if (sv?.token) await hibatur(() => cp.surveyBead(db, { token: sv.token, pont: 2, komment: 'DEMO visszajelzes: nem voltam elegedett (kitalalt)', now: ilkaK.start + 4 * ORA }));
  await hozzajarulas(db, ilkaK.guestId, 'email_marketing', most);

  // 10. Demo Jolan: kontraindikacio-riasztas (a kitoltott kerdoiv jelzest ad, a kezelo ertesult)
  const jolan = uj(g('g10', 'Demo Jolán', 10));
  const jolanF = await foglal(db, jolan, { kod: 'k1', szolgaltatas: 'first_hair', start: napPont(most, 2), kezelo: lilla, most });
  const jolanK = await hibatur(() => kerdoivKiad(db, { guestId: jolanF.guestId, bookingId: jolanF.bookingId, now: most - 2 * ORA }));
  if (jolanK?.token) await hibatur(() => kerdoivBead(db, { token: jolanK.token, valaszok: { ...VALASZ_JO, korabbi_reakcio: true }, adatkezelesVerzio: 'demo-v1', now: most - ORA }));

  // 11. Demo Kinga: fuggo osszevonasi keres (azonos e-mail, mas telefon, mas Salonic-azonosito)
  const kinga = uj(g('g11', 'Demo Kinga', 11));
  await foglal(db, kinga, { kod: 'k1', szolgaltatas: 'first_hair', start: napPont(most, 4), kezelo: kata, most });
  const kinga2 = uj({ ...g('g12', 'Demo Kinga', 12), email: kinga.email });
  await foglal(db, kinga2, { kod: 'k1', szolgaltatas: 'camera_assessment', start: napPont(most, 6), kezelo: zita, most });

  // 12. Demo Livia: 4 990 Ft credit jogosultsag (felmeres 10 napja, az elso kezeles 30 napon belul foglalva)
  const lillaV = uj(g('g13', 'Demo Lívia', 13));
  const lillaF = await foglal(db, lillaV, { kod: 'cam', szolgaltatas: 'camera_assessment', start: napPont(most, -10), kezelo: zita, most });
  await igazolCompleted(db, { bookingId: lillaF.bookingId, staffId: zita, now: napPont(most, -10) + ORA });
  await foglal(db, lillaV, { kod: 'k1', szolgaltatas: 'first_hair', start: napPont(most, 6), kezelo: kata, foglalvaEzelott: 14 * NAP, most });
  await hozzajarulas(db, lillaF.guestId, 'email_marketing', most);

  // 13. Demo Monika: no-show (tegnap), SMS-marketing visszavonva; 14. Demo Nelli: lemondott foglalas
  const monika = uj(g('g14', 'Demo Mónika', 14));
  const monF = await foglal(db, monika, { kod: 'k1', szolgaltatas: 'first_hair', start: napPont(most, -1), kezelo: kata, most });
  await foglal(db, monika, { kod: 'k1', szolgaltatas: 'first_hair', start: napPont(most, -1), kezelo: kata, most, allapot: 'no_show', eventAt: napPont(most, -1) + 2 * ORA });
  await hozzajarulas(db, monF.guestId, 'sms_marketing', most, { visszavon: true }); await hozzajarulas(db, monF.guestId, 'email_marketing', most);
  const nora = uj(g('g15', 'Demo Nelli', 15));
  const noraF = await foglal(db, nora, { kod: 'k1', szolgaltatas: 'first_hair', start: napPont(most, 5), kezelo: zita, foglalvaEzelott: 7 * NAP, most });
  await foglal(db, nora, { kod: 'k1', szolgaltatas: 'first_hair', start: napPont(most, 5), kezelo: zita, most, allapot: 'cancelled', eventAt: most - 4 * ORA });
  await hozzajarulas(db, noraF.guestId, 'email_marketing', most);

  const vendegekAz = [];
  for (const v of [anna, bea, cili, dora, emma, fanni, greta, hanna, ilka, jolan, kinga, kinga2, lillaV, monika, nora]) vendegekAz.push(await guestId(v));

  // a feldolgozatlan esemenyekbol jobok (a motor tick-je DEMO-ban sandbox: a cimek .invalid / demo- azonositoju vendegek)
  const outbox = await outboxFeldolgoz(db, { most });
  const ered = { munkatarsak, vendegek: stat.vendegek, vendeg_azonositok: vendegekAz.filter(Boolean).length, outbox_feldolgozott: outbox.feldolgozott, kerdoiv_verzio: DEMO_KERDOIV_VERZIO, betoltve: most };
  await keszit(db, 'INSERT OR REPLACE INTO beallitasok (kulcs, ertek, frissitve, frissitette) VALUES (?1, ?2, ?3, \'demo\')', DEMO_KULCS, jsonIr(ered), most).run();
  await auditStmt(db, { action: 'demo.loaded', resource: 'demo', detail: { vendegek: stat.vendegek, munkatarsak }, now: most }).run();
  return { mar: false, ...ered };
}

/** az API (api.js demoAdatBetoltDb) altal keresett nev: demoBetolt(db, {now, env}) */
export const demoBetolt = (db, { now = null, most = null } = {}) => demoAdatBetolt(db, { most: most ?? now ?? undefined });
