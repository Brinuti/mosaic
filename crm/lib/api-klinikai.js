// API-vegpontok: allapotfelmero (munkatars-oldal), kuraterv / A5 PDF, hajkamera-kepek, osszehasonlitas es megosztas.
// A feltoltes: meret-limit, MIME + magic byte ellenorzes, a storage_key SZERVER-oldali UUID (a modul adja, soha nem a felhasznalo adata).
import { ApiHiba, azonosito, bajtokOlvas, fajl, mediaTipus, szoveges, valasztas } from './http.js';
import { elso, mind, jsonOlvas } from './db.js';
import { KEP_MIME } from './constants.js';
import { a5Pdf } from './pdf.js';
import * as felmero from './assessment.js';
import * as plan from './plan.js';
import * as kepek from './images.js';
import { konfigEnvbol } from './messages/kuldo.js';
import { foglalas } from './booking.js';
import { pdfDokumentum, fontokBetolt } from './api-dokumentum.js';

export const KEP_API_MAX = 6 * 1024 * 1024;     // API.md: max 6 MB
const KITERJESZTES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const TERV_MEZO_MAX = 20000;                   // a kezeloi urlap osszmerete (JSON)

/** a kerdoiv-definicio szerkezeti ellenorzese (a tartalmi jovahagyas a szakmai vezeto feladata) */
function definicioEllenoriz(d) {
  if (!d || typeof d !== 'object' || !Array.isArray(d.csoportok) || !d.csoportok.length || d.csoportok.length > 20) throw new ApiHiba('ERVENYTELEN_DEFINICIO', 'A definíció csoportok listáját tartalmazza.', 422);
  if (JSON.stringify(d).length > 40000) throw new ApiHiba('ERVENYTELEN_DEFINICIO', 'A definíció túl nagy.', 413);
  const kulcsok = new Set();
  for (const cs of d.csoportok) {
    if (typeof cs?.kulcs !== 'string' || typeof cs?.cim !== 'string' || !Array.isArray(cs.kerdesek) || !cs.kerdesek.length || cs.kerdesek.length > 40) throw new ApiHiba('ERVENYTELEN_DEFINICIO', 'Minden csoportnak kulcs, cím és kérdéslista kell.', 422);
    for (const k of cs.kerdesek) {
      if (typeof k?.kulcs !== 'string' || !/^[a-z0-9_]{1,60}$/.test(k.kulcs) || kulcsok.has(k.kulcs)) throw new ApiHiba('ERVENYTELEN_DEFINICIO', 'A kérdés kulcsa egyedi, kisbetűs azonosító legyen.', 422);
      kulcsok.add(k.kulcs);
      if (typeof k.szoveg !== 'string' || !k.szoveg.trim() || k.szoveg.length > 500) throw new ApiHiba('ERVENYTELEN_DEFINICIO', 'A kérdés szövege kötelező (max 500 karakter).', 422);
      if (!['boolean', 'text', 'select', 'multi'].includes(k.tipus)) throw new ApiHiba('ERVENYTELEN_DEFINICIO', 'A kérdés típusa: boolean | text | select | multi.', 422);
      if (['select', 'multi'].includes(k.tipus) && !(Array.isArray(k.opciok) && k.opciok.length && k.opciok.every((o) => typeof o === 'string' && o.length <= 100))) throw new ApiHiba('ERVENYTELEN_DEFINICIO', 'A válaszlehetőségek hiányoznak.', 422);
    }
  }
}

/** a kezeloi urlap mezoi: csak egyszeru JSON-ertekek, nem tul nagy, nincs veszelyes kulcs */
function mezokEllenoriz(m) {
  if (!m || typeof m !== 'object' || Array.isArray(m)) throw new ApiHiba('ERVENYTELEN_MEZOK', 'A mezok objektum legyen.', 422);
  const szoveg = JSON.stringify(m);
  if (szoveg.length > TERV_MEZO_MAX) throw new ApiHiba('ERVENYTELEN_MEZOK', 'Az űrlap túl nagy.', 413);
  const bejar = (o, mely) => {
    if (mely > 4) throw new ApiHiba('ERVENYTELEN_MEZOK', 'Az űrlap túl mélyen beágyazott.', 422);
    for (const [k, v] of Object.entries(o)) {
      if (!/^[a-z0-9][a-z0-9_]{0,59}$/.test(k)) throw new ApiHiba('ERVENYTELEN_MEZOK', 'Érvénytelen mezőnév.', 422);
      if (v && typeof v === 'object') bejar(Array.isArray(v) ? Object.fromEntries(v.map((x, i) => [`e${i}`, x])) : v, mely + 1);
      else if (typeof v === 'string' && v.length > 4000) throw new ApiHiba('ERVENYTELEN_MEZOK', 'Egy szöveges mező legfeljebb 4000 karakter.', 422);
    }
  };
  bejar(m, 0);
  return m;
}

async function tervBetolt(c, tervId, muvelet) {
  const p = await plan.terv(c.db, tervId);
  await c.kot(muvelet, 'plan', { guestId: p?.guest_id ?? null, resourceId: tervId });   // jog elobb: letezo es nemletezo azonosito azonosan 403 jogosulatlannak
  if (!p) throw new ApiHiba('NINCS_TALALAT', 'Nincs ilyen dokumentum.', 404);
  return p;
}

/** PDF bajtok: a tarolt (generated_pdf / sent), vagy therapist_final-bol generalt + tarolt; draft -> megjelolt vazlat-elonezet (nem tarolodik) */
async function pdfKeszit(c, p) {
  if (['generated_pdf', 'sent'].includes(p.status)) {
    const f = await plan.pdfOlvas(c.db, { planId: p.id, staffId: c.staffId, tarolo: c.tarolo, now: c.now }).catch((e) => { if (e.kod === 'NINCS_PDF') return null; throw e; });
    if (f?.bajtok) return { bajtok: f.bajtok, vazlat: false };
  }
  const fontok = await fontokBetolt(c.env, c.request);
  const a5 = await plan.a5Adat(c.db, p.id);
  const vegleges = ['therapist_final', 'generated_pdf', 'sent'].includes(p.status);
  const bajtok = await a5Pdf({ fontok, dok: pdfDokumentum(a5, { vazlat: !vegleges }) });
  if (p.status === 'therapist_final') await plan.pdfRogzit(c.db, { planId: p.id, bajtok, tarolo: c.tarolo, staffId: c.staffId, now: c.now });
  if (!vegleges) await c.audit({ action: 'plan.pdf_preview', resource: 'treatment_plan', resourceId: p.id, guestId: p.guest_id });
  return { bajtok, vazlat: !vegleges };
}

/** kuldes: kuldhetoE -> PDF (ha kell) -> elkuldve (outbox); a tenyleges levelet a motor kuldi (alap: DRY) */
async function tervKuldes(c, p, cimzett) {
  if (p.status === 'sent') return { elkuldve: true, mar: true, kuldes_mod: konfigEnvbol(c.env).kuldes };
  const k = await plan.kuldhetoE(c.db, p.id, { cimzett });
  if (!k.ok) throw new ApiHiba('NEM_KULDHETO', 'A dokumentum még nem küldhető el.', 409, k.hianyok);
  if (p.status === 'therapist_final') await pdfKeszit(c, p);
  const r = await plan.elkuldve(c.db, { planId: p.id, cimzett, now: c.now });
  return { elkuldve: true, mar: !!r.mar, kuldes_mod: konfigEnvbol(c.env).kuldes };
}

export const utak = [
  // ---- kerdoiv-verziok (szakmai vezeto) --------------------------------------------------------------------------------------------------------
  ['GET', '/felmero/verziok', async (c) => {
    await c.kot('read', 'assessment_version');
    const sorok = await mind(c.db, 'SELECT * FROM assessment ORDER BY created_at DESC, rowid DESC');
    return {
      verziok: sorok.map((v) => ({ id: v.id, verzio: v.question_version, jovahagyva: !!v.approved_by_clinical_lead, jovahagyta: v.approved_by, jovahagyva_ekkor: v.approved_at, visszavonva: v.retired_at, letrehozva: v.created_at, definicio: jsonOlvas(v.questions, null) })),
      kiadhato: await felmero.kiadhato(c.db),
    };
  }],
  ['POST', '/felmero/verziok', async (c) => {
    await c.kot('write', 'assessment_version');
    const t = await c.torzs();
    const verzio = szoveges(t, 'verzio', { kotelezo: true, max: 60, min: 1 });
    if (!/^[A-Za-z0-9._-]{1,60}$/.test(verzio)) throw new ApiHiba('ERVENYTELEN_MEZO', 'A verzió: betű, szám, ._- (max 60).', 422);
    if (t.definicio !== undefined) definicioEllenoriz(t.definicio);
    return felmero.letrehozVerzio(c.db, { version: verzio, definicio: t.definicio ?? felmero.ALAP_KERDOIV, staffId: c.staffId, now: c.now });
  }],
  ['POST', '/felmero/verziok/:id/jovahagy', async (c) => {
    const id = c.uuid('id');
    await c.kot('approve', 'assessment_version', { resourceId: id });
    const v = await elso(c.db, 'SELECT question_version FROM assessment WHERE id = ?1', id);
    if (!v) throw new ApiHiba('NINCS_TALALAT', 'Nincs ilyen verzió.', 404);
    await felmero.jovahagyVerzio(c.db, { version: v.question_version, staffId: c.staffId, now: c.now });
    return { ok: true, verzio: v.question_version };
  }],

  // ---- felmero a foglalashoz ---------------------------------------------------------------------------------------------------------------------
  ['POST', '/foglalasok/:id/felmero-kiad', async (c) => {
    const id = c.uuid('id');
    await c.kot('review', 'assessment', { resourceId: id });
    const b = await foglalas(c.db, id);
    if (!b) throw new ApiHiba('NINCS_TALALAT', 'Nincs ilyen foglalás.', 404);
    const k = await felmero.kiad(c.db, { guestId: b.guest_id, bookingId: id, now: c.now });
    await c.audit({ action: 'assessment.link_issued', resource: 'assessment_submission', resourceId: k.submissionId, guestId: b.guest_id });
    if (k.mar) return { mar: true, beadas_id: k.submissionId };
    return { mar: false, beadas_id: k.submissionId, verzio: k.version, token: k.token, link: `${c.url.origin}/api/crm/public/felmero/${k.token}` };
  }],
  ['GET', '/foglalasok/:id/felmero', async (c) => {
    const id = c.uuid('id');
    const b = await foglalas(c.db, id);
    await c.kot('read', 'assessment', { guestId: b?.guest_id ?? null, resourceId: id });
    if (!b) throw new ApiHiba('NINCS_TALALAT', 'Nincs ilyen foglalás.', 404);
    const s = await elso(c.db, 'SELECT s.*, a.question_version, a.questions FROM assessment_submission s JOIN assessment a ON a.id = s.assessment_id WHERE s.booking_id = ?1 ORDER BY s.issued_at DESC LIMIT 1', id);
    if (!s) return { allapot: 'missing', kitoltve: false };
    const alert = await elso(c.db, 'SELECT id, status, flagged FROM contraindication_alert WHERE submission_id = ?1', s.id);
    await c.audit({ action: 'assessment.read', resource: 'assessment_submission', resourceId: s.id, guestId: s.guest_id });   // egeszsegi adat olvasasa: naplozott
    return {
      beadas_id: s.id, allapot: s.status, kitoltve: s.status !== 'issued', verzio: s.question_version, kiadva: s.issued_at, beadva: s.submitted_at,
      jelzes: s.safety_flag === 1, jelzett_kerdesek: jsonOlvas(s.flagged_questions, []),
      valaszok: s.status === 'issued' ? null : jsonOlvas(s.answers, {}), kerdoiv: jsonOlvas(s.questions, null),
      attekintes: s.reviewed_at ? { kezelo_id: s.reviewed_by, ido: s.reviewed_at, eredmeny: s.review_outcome, megjegyzes: s.review_note } : null,
      riasztas: alert ? { id: alert.id, allapot: alert.status } : null,
    };
  }],
  ['POST', '/felmero/:id/attekint', async (c) => {
    const id = c.uuid('id');
    const s = await elso(c.db, 'SELECT guest_id FROM assessment_submission WHERE id = ?1', id);
    await c.kot('review', 'assessment', { guestId: s?.guest_id ?? null, resourceId: id });
    if (!s) throw new ApiHiba('NINCS_TALALAT', 'Nincs ilyen kitöltés.', 404);
    const t = await c.torzs();
    return felmero.attekint(c.db, { submissionId: id, staffId: c.staffId, eredmeny: valasztas(t, 'eredmeny', ['cleared', 'consult', 'postponed', 'contraindicated']), megjegyzes: szoveges(t, 'megjegyzes', { max: 1000 }), now: c.now });
  }],

  // ---- kuraterv, A5 ----------------------------------------------------------------------------------------------------------------------------
  ['GET', '/kezelesek/:sessionId/terv', async (c) => {
    const sid = c.uuid('sessionId');
    const s = await elso(c.db, 'SELECT * FROM treatment_session WHERE id = ?1', sid);
    await c.kot('read', 'plan', { guestId: s?.guest_id ?? null, resourceId: sid });
    if (!s) throw new ApiHiba('NINCS_TALALAT', 'Nincs ilyen kezelés.', 404);
    const p = await plan.tervSession(c.db, sid);
    if (!p) throw new ApiHiba('NINCS_TERV', 'Ehhez a kezeléshez nem tartozik kötelező dokumentum.', 404);
    const a5 = await plan.a5Adat(c.db, p.id);
    const k = await plan.kuldhetoE(c.db, p.id);
    return {
      terv: { id: p.id, fajta: p.kind, allapot: p.status, verzio: p.version, hatarido: p.due_at, vegleges: p.final_at, elkuldve: p.sent_at, mezok: a5.mezok },
      kezeles: { id: sid, sorszam: s.treatment_index, vendeg_id: s.guest_id, kamera_kotelezo: !!s.camera_required },
      levezetett: { vendeg_nev: a5.levezetett.vendeg_nev, datum: a5.levezetett.datum, kezelo_nev: a5.levezetett.kezelo_nev, foglalas_azonosito: a5.levezetett.salonic_booking_id },
      hianyzo_mezok: plan.mezoHibak(p.kind, a5.mezok), kuldheto: { ok: k.ok, hianyok: k.hianyok },
    };
  }],
  ['PUT', '/kezelesek/:sessionId/terv', async (c) => {
    const sid = c.uuid('sessionId');
    const s = await elso(c.db, 'SELECT guest_id FROM treatment_session WHERE id = ?1', sid);
    await c.kot('write', 'plan', { guestId: s?.guest_id ?? null, resourceId: sid });
    if (!s) throw new ApiHiba('NINCS_TALALAT', 'Nincs ilyen kezelés.', 404);
    const t = await c.torzs();
    const mezok = mezokEllenoriz(t.mezok);
    const p = await plan.tervSession(c.db, sid);
    if (!p) throw new ApiHiba('NINCS_TERV', 'Ehhez a kezeléshez nem tartozik kötelező dokumentum.', 404);
    return plan.ment(c.db, { planId: p.id, mezok, staffId: c.staffId, now: c.now });
  }],
  ['POST', '/tervek/:id/veglegesit', async (c) => {
    const p = await tervBetolt(c, c.uuid('id'), 'write');
    return plan.veglegesit(c.db, { planId: p.id, staffId: c.staffId, now: c.now });
  }],
  ['GET', '/tervek/:id/a5.pdf', async (c) => {
    const p = await tervBetolt(c, c.uuid('id'), 'read');
    const { bajtok, vazlat } = await pdfKeszit(c, p);
    return fajl(bajtok, 'application/pdf', `a5-${p.id}${vazlat ? '-vazlat' : ''}.pdf`, { inline: true });
  }],
  ['POST', '/tervek/:id/kuld', async (c) => {
    const p = await tervBetolt(c, c.uuid('id'), 'write');
    const t = await c.torzs();
    return tervKuldes(c, p, szoveges(t, 'cimzett', { max: 200 }));
  }],
  ['POST', '/kurak/:id/kurazaro', async (c) => {
    const id = c.uuid('id');
    const k = await elso(c.db, 'SELECT guest_id FROM course WHERE id = ?1', id);
    await c.kot('write', 'plan', { guestId: k?.guest_id ?? null, resourceId: id });
    if (!k) throw new ApiHiba('NINCS_TALALAT', 'Nincs ilyen kúra.', 404);
    const z = await plan.kurazaro(c.db, { courseId: id });
    if (!z.kesz) throw new ApiHiba('NINCS_11_ALKALOM', 'A kúrazáráshoz a 11. alkalom igazolása kell.', 409);
    if (!z.zaroDokumentum) throw new ApiHiba('NINCS_ZARODOKUMENTUM', 'A záró dokumentum még nem készült el.', 409);
    const p = await plan.terv(c.db, z.zaroDokumentum.planId);
    if (p.status === 'missing' || p.status === 'draft') throw new ApiHiba('DOKUMENTUM_NEM_VEGLEGES', 'A záró dokumentumot előbb véglegesíteni kell.', 409);
    const t = await c.torzs();
    const r = await tervKuldes(c, p, szoveges(t, 'cimzett', { max: 200 }));
    return { ...r, terv_id: p.id, hianyzo_kepek: z.hianyzoKepek };
  }],
  ['GET', '/dokumentumok/hianyzo', async (c) => {
    await c.kot('read', 'plan');
    const lista = await plan.hianyzoDokumentumok(c.db, { now: c.now });
    const kezelok = new Map((await mind(c.db, 'SELECT id, name FROM staff_user')).map((u) => [u.id, u.name]));
    const vendegek = new Map((await mind(c.db, `SELECT id, name FROM guest WHERE id IN (SELECT guest_id FROM treatment_plan WHERE status IN ('missing', 'draft'))`)).map((g) => [g.id, g.name]));
    return { dokumentumok: lista.map((d) => ({ terv_id: d.planId, kezeles_id: d.sessionId, vendeg: { id: d.guestId, nev: vendegek.get(d.guestId) ?? null }, fajta: d.kind, allapot: d.status, kezelo: { id: d.therapistId, nev: kezelok.get(d.therapistId) ?? null }, kezeles_ideje: d.completedAt, szint: d.level })) };
  }],

  // ---- hajkamera-kepek -----------------------------------------------------------------------------------------------------------------------------
  ['POST', '/kezelesek/:sessionId/kepek', async (c) => {
    const sid = c.uuid('sessionId');
    const s = await elso(c.db, 'SELECT guest_id, treatment_index FROM treatment_session WHERE id = ?1', sid);
    await c.kot('write', 'camera_image', { guestId: s?.guest_id ?? null, resourceId: sid });
    if (!s) throw new ApiHiba('NINCS_TALALAT', 'Nincs ilyen kezelés.', 404);
    const pont = c.q.get('pont');
    if (pont !== null && (!['1', '3', '5', '10'].includes(pont) || Number(pont) !== s.treatment_index)) throw new ApiHiba('ERVENYTELEN_PONT', 'A pont: a kezelés sorszáma (1 | 3 | 5 | 10), és egyezzen a kezelésével.', 422);
    const mime = mediaTipus(c.request);
    if (!KEP_MIME.includes(mime)) throw new ApiHiba('ERVENYTELEN_MIME', 'Csak jpeg, png vagy webp kép tölthető fel.', 422);
    const rogzites = c.q.get('rogzitesi_pont') || 'fo';
    if (!/^[a-z0-9_-]{1,40}$/.test(rogzites)) throw new ApiHiba('ERVENYTELEN_PONT', 'A rögzítési pont: a-z, 0-9, _ és -.', 422);
    const bajtok = await bajtokOlvas(c.request, KEP_API_MAX);   // tul nagy: 413
    if (!bajtok.length) throw new ApiHiba('URES_FAJL', 'Üres fájl.', 422);
    const r = await kepek.kepFeltolt(c.db, { sessionId: sid, staffId: c.staffId, bajtok, mime, capturePoint: rogzites, tarolo: c.tarolo, csere: c.q.get('csere') === '1', now: c.now });
    return { id: r.imageId, alkalom: r.treatmentIndex, felulirt: r.felulirt };
  }],
  ['DELETE', '/kepek/:id', async (c) => {
    const id = c.uuid('id');
    const k = await elso(c.db, 'SELECT guest_id FROM camera_image WHERE id = ?1 AND deleted_at IS NULL', id);
    await c.kot('write', 'camera_image', { guestId: k?.guest_id ?? null, resourceId: id });
    if (!k) throw new ApiHiba('NINCS_TALALAT', 'Nincs ilyen kép.', 404);
    await kepek.kepTorol(c.db, { imageId: id, staffId: c.staffId, tarolo: c.tarolo, now: c.now });
    return { torolve: true };
  }],
  ['GET', '/kepek/:id', async (c) => {
    const id = c.uuid('id');
    const k = await elso(c.db, 'SELECT guest_id, mime FROM camera_image WHERE id = ?1 AND deleted_at IS NULL', id);
    await c.kot('read', 'camera_image', { guestId: k?.guest_id ?? null, resourceId: id });   // S01: recepcio / marketing / admin -> 403 + audit
    if (!k) throw new ApiHiba('NINCS_TALALAT', 'Nincs ilyen kép.', 404);
    const f = await kepek.kepOlvas(c.db, { imageId: id, staffId: c.staffId, tarolo: c.tarolo, ipHash: c.ipHash, now: c.now });
    const mime = KEP_MIME.includes(f.mime) ? f.mime : 'application/octet-stream';
    return fajl(f.bajtok, mime, `kep-${id}.${KITERJESZTES[mime] || 'bin'}`, { inline: true });
  }],

  // ---- osszehasonlitas, megosztas ---------------------------------------------------------------------------------------------------------------------
  ['POST', '/osszehasonlitas', async (c) => {
    await c.kot('write', 'image_comparison');
    const t = await c.torzs();
    const r = await kepek.osszehasonlit(c.db, { imageAId: azonosito(t, 'kep_a'), imageBId: azonosito(t, 'kep_b'), staffId: c.staffId, note: szoveges(t, 'komment', { max: 1500 }), now: c.now });
    return { id: r.comparisonId };
  }],
  ['POST', '/osszehasonlitas/:id/veglegesit', async (c) => {
    const id = c.uuid('id');
    await c.kot('write', 'image_comparison', { resourceId: id });
    const t = await c.torzs();
    await kepek.osszehasonlitVeglegesit(c.db, { comparisonId: id, staffId: c.staffId, note: szoveges(t, 'komment', { max: 1500 }), now: c.now });
    return { ok: true };
  }],
  ['POST', '/osszehasonlitas/:id/link', async (c) => {
    const id = c.uuid('id');
    const o = await elso(c.db, 'SELECT guest_id FROM image_comparison WHERE id = ?1', id);
    await c.kot('write', 'share_grant', { guestId: o?.guest_id ?? null, resourceId: id });
    if (!o) throw new ApiHiba('NINCS_TALALAT', 'Nincs ilyen összehasonlítás.', 404);
    const g = await kepek.linkKiad(c.db, { comparisonId: id, kiadta: c.staffId, now: c.now });
    // A plaintext token csak ebben a valaszban van (az adatbazisban a hash); a vendeg e-mailjet az outbox share.link_issued esemenye inditja.
    return { grant_id: g.grantId, lejar: g.expiresAt, link: `${c.url.origin}/api/crm/public/kep/${g.token}`, kuldes: 'outbox' };
  }],
];
