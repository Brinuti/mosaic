// API-vegpontok: dashboard, vendegkereso / profil, osszevonas, munkalista, kezeles-igazolas, berlet, credit, hozzajarulas, panasz, elegedettseg.
// Minden vegpont elobb a jogosultsagot ellenorzi (c.kot -> rbac.megkoveteli, tiltaskor audit), csak utana olvas; igy a 403/404 nem szivarogtat.
import { ApiHiba, azonosito, egesz, logikai, napE, szoveges, valasztas } from './http.js';
import { elso, mind, helyiEpoch, helyiNap, naptariNapVege, normEmail } from './db.js';
import { lehet } from './rbac.js';
import { vegleges, emailValtoztat } from './guest.js';
import { foglalas, igazolCompleted, ingestBookingEvent } from './booking.js';
import * as kura from './course.js';
import * as berlet from './package.js';
import * as credit from './credit.js';
import * as hozzajarulas from './consent.js';
import * as panasz from './complaint.js';
import * as merge from './merge.js';
import * as kepek from './images.js';
import * as felmero from './assessment.js';
import { modulFuggveny } from './api-modulok.js';

// ---- maszkolas (a keresolista nem ad ki teljes elerhetoseget) ------------------------------------------------------------------------------
export function emailMaszkolt(e) {
  const s = String(e ?? '');
  const i = s.indexOf('@');
  if (i < 1) return s ? '***' : null;
  return `${s.slice(0, Math.min(2, i))}***${s.slice(i)}`;
}
export function telefonMaszkolt(t) {
  const s = String(t ?? '');
  if (s.length < 6) return s ? '***' : null;
  return `${s.slice(0, 3)}${'*'.repeat(Math.max(3, s.length - 5))}${s.slice(-2)}`;
}
const likeEscape = (s) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

async function mergeKeres(c, id) {
  if (!(await elso(c.db, 'SELECT 1 AS x FROM identity_merge_request WHERE id = ?1', id))) throw new ApiHiba('NINCS_TALALAT', 'Nincs ilyen összevonási kérés.', 404);
}
async function vendegBetolt(c, id) {
  const g = await elso(c.db, 'SELECT * FROM guest WHERE id = ?1', id);
  if (!g) throw new ApiHiba('NINCS_TALALAT', 'Nincs ilyen vendég.', 404);
  return g;
}

/** napi idoszak: ?tol&ig (epoch vagy YYYY-MM-DD); alap: az elmult 90 nap */
export function idoszak(q, now) {
  const olvas = (nev, nap) => {
    const v = q.get(nev);
    if (v === null || v === '') return null;
    if (/^\d{9,11}$/.test(v)) return Number(v);
    if (napE(v)) { const [y, m, d] = v.split('-').map(Number); const kezd = helyiEpoch(y, m, d, 0, 0); return nap === 'vege' ? naptariNapVege(kezd, 0) : kezd; }
    throw new ApiHiba('ERVENYTELEN_IDOSZAK', `A(z) ${nev} paraméter epoch másodperc vagy ÉÉÉÉ-HH-NN.`, 422);
  };
  return { tol: olvas('tol', 'kezdet') ?? now - 90 * 86400, ig: olvas('ig', 'vege') ?? now + 86400 };
}

export const utak = [
  // ---- dashboard -------------------------------------------------------------------------------------------------------------------------
  ['GET', '/dashboard', async (c) => {
    const nezet = valasztas({ nezet: c.q.get('nezet') || 'kezelo' }, 'nezet', ['kezelo', 'menedzsment']);
    if (nezet === 'kezelo') await c.kot('read', 'booking'); else await c.kot('read', 'stats_aggregate');
    const f = await modulFuggveny('dashboard', ['dashboard']);
    return f(c.db, { nezet, staffId: c.staffId, most: c.now });
  }],

  // ---- vendegkereso -----------------------------------------------------------------------------------------------------------------------
  ['GET', '/vendegek', async (c) => {
    await c.kot('read', 'guest_basic');
    const q = (c.q.get('q') || '').trim();
    if (q.length < 2 || q.length > 100) throw new ApiHiba('ERVENYTELEN_KERES', 'A keresés 2–100 karakter legyen.', 422);
    const szam = q.replace(/\D/g, '');
    const like = `%${likeEscape(q.toLowerCase())}%`;
    const telLike = szam.length >= 4 ? `%${szam}%` : '';
    const sorok = await mind(c.db,
      `SELECT g.id, g.name, g.email, g.phone,
        (SELECT MAX(b.start_at) FROM booking b WHERE b.guest_id = g.id AND b.duplicate_of IS NULL AND b.status <> 'cancelled') AS utolso_foglalas,
        (SELECT k.status FROM course k WHERE k.guest_id = g.id ORDER BY k.created_at DESC LIMIT 1) AS kura_allapot
       FROM guest g WHERE g.status = 'active' AND (lower(g.name) LIKE ?1 ESCAPE '\\' OR g.email LIKE ?1 ESCAPE '\\' OR (?2 <> '' AND g.phone LIKE ?2 ESCAPE '\\'))
       ORDER BY g.name LIMIT 25`, like, telLike);
    await c.audit({ action: 'guest.search', resource: 'guest', detail: { talalat: sorok.length } });   // a keresett szoveg NEM kerul a naploba
    return { vendegek: sorok.map((s) => ({ id: s.id, nev: s.name, email_maszkolt: emailMaszkolt(s.email), telefon_maszkolt: telefonMaszkolt(s.phone), utolso_foglalas: s.utolso_foglalas, kura_allapot: s.kura_allapot || 'not_started' })) };
  }],

  // ---- vendeg-profil ----------------------------------------------------------------------------------------------------------------------
  ['GET', '/vendegek/:id', async (c) => {
    const azon = c.uuid('id');
    await c.kot('read', 'guest_basic', { guestId: azon });
    let g = await vendegBetolt(c, azon);
    if (g.status === 'merged') { const v = await vegleges(c.db, azon); g = await vendegBetolt(c, v); }
    const id = g.id;
    const l = (m, e) => lehet(c.szerepek, m, e);
    const ki = {
      vendeg: { id, nev: g.name, email: g.email, email_ellenorzott: !!g.email_verified, telefon: g.phone, telefon_ellenorzott: !!g.phone_verified, allapot: g.status, ertekesites_tiltva: !!g.clinical_stop, letrehozva: g.created_at },
      azonositok: (await mind(c.db, 'SELECT id, account, external_id, created_at FROM salonic_guest_identity WHERE guest_id = ?1 ORDER BY created_at', id)).map((x) => ({ id: x.id, fiok: x.account, kulso_azonosito: x.external_id, letrehozva: x.created_at })),
      foglalasok: l('read', 'booking') ? (await mind(c.db, `SELECT id, service_code, start_at, end_at, status, therapist_name, completed_at FROM booking WHERE guest_id = ?1 AND duplicate_of IS NULL ORDER BY start_at DESC LIMIT 100`, id))
        .map((b) => ({ id: b.id, szolgaltatas: b.service_code, kezdes: b.start_at, vege: b.end_at, allapot: b.status, kezelo: b.therapist_name, igazolva: b.completed_at })) : null,
      kura: null, berletek: null, credit: null, hozzajarulasok: null, uzenetek: null, dokumentumok: null, panaszok: null, kepek: null,
    };
    if (l('read', 'course')) {
      const k = await kura.kuraAllapot(c.db, id);
      ki.kura = { ...k, kezelesek: k.courseId ? (await kura.kezelesek(c.db, k.courseId)).map((s) => ({ id: s.id, sorszam: s.treatment_index, igazolva: s.confirmed_at, kamera_kotelezo: !!s.camera_required })) : [] };
    }
    if (l('read', 'package')) ki.berletek = await berlet.vendegBerletei(c.db, id, { now: c.now });
    if (l('read', 'credit')) ki.credit = await credit.ellenoriz(c.db, id, { now: c.now });
    if (l('read', 'consent')) {
      ki.hozzajarulasok = await hozzajarulas.allapot(c.db, id);
      ki.hozzajarulasok.marketing = { email: await hozzajarulas.marketingAllapot(c.db, id, 'email_marketing'), sms: await hozzajarulas.marketingAllapot(c.db, id, 'sms_marketing') };
    }
    if (l('read', 'message')) {
      ki.uzenetek = (await mind(c.db, 'SELECT id, template_key, channel, status, stop_reason, run_at, sent_at FROM message_job WHERE guest_id = ?1 ORDER BY run_at DESC LIMIT 50', id))
        .map((j) => ({ id: j.id, sablon: j.template_key, csatorna: j.channel, allapot: j.status, ok: j.stop_reason, ido: j.run_at, elkuldve: j.sent_at }));
    }
    if (l('read', 'plan')) {
      ki.dokumentumok = (await mind(c.db, `SELECT p.id, p.kind, p.status, p.due_at, p.final_at, p.sent_at, p.session_id, s.treatment_index FROM treatment_plan p JOIN treatment_session s ON s.id = p.session_id WHERE p.guest_id = ?1 ORDER BY s.treatment_index`, id))
        .map((p) => ({ id: p.id, fajta: p.kind, allapot: p.status, hatarido: p.due_at, vegleges: p.final_at, elkuldve: p.sent_at, kezeles_id: p.session_id, kezeles_sorszam: p.treatment_index }));
    }
    if (l('read', 'complaint')) {
      ki.panaszok = (await mind(c.db, 'SELECT id, status, source, opened_at, due_at, first_contact_at, resolved_at, therapist_id FROM complaint WHERE guest_id = ?1 ORDER BY opened_at DESC', id))
        .map((p) => ({ id: p.id, allapot: p.status, forras: p.source, megnyitva: p.opened_at, hatarido: p.due_at, elso_kapcsolat: p.first_contact_at, lezarva: p.resolved_at, felelos_id: p.therapist_id }));
    }
    if (l('read', 'camera_image')) {
      ki.kepek = (await kepek.kepek(c.db, id)).map((k) => ({ id: k.id, alkalom: k.treatment_index, rogzitesi_pont: k.capture_point, kezeles_id: k.session_id, ido: k.taken_at }));
      ki.klinikai_stop = g.clinical_stop || null;
    }
    await c.audit({ action: 'guest.profile_view', resource: 'guest', resourceId: id, guestId: id });
    return ki;
  }],

  ['POST', '/vendegek/:id/email', async (c) => {
    const id = c.uuid('id');
    await c.kot('write', 'guest_basic', { guestId: id });
    const t = await c.torzs();
    const email = szoveges(t, 'email', { kotelezo: true, max: 200 });
    if (!normEmail(email)) throw new ApiHiba('ERVENYTELEN_EMAIL', 'Érvénytelen e-mail-cím.', 422);
    await vendegBetolt(c, id);
    return emailValtoztat(c.db, { guestId: id, ujEmail: email, staffId: c.staffId, now: c.now });
  }],

  // ---- osszevonas -----------------------------------------------------------------------------------------------------------------------------
  ['GET', '/osszevonas', async (c) => {
    await c.kot('read', 'merge');
    return { keresek: (await merge.fuggoKeresek(c.db)).map((r) => ({ id: r.id, forras: { id: r.source_guest_id, nev: r.source_name }, cel: { id: r.target_guest_id, nev: r.target_name }, email_egyezes: !!r.email_match, telefon_egyezes: !!r.phone_match, nev_egyezes: !!r.name_match, ok: r.reason, kerve: r.requested_at })), fuggo_darab: await merge.fuggoDarab(c.db) };
  }],
  ['POST', '/osszevonas/:id/jovahagy', async (c) => {
    const id = c.uuid('id');
    await c.kot('approve', 'merge', { resourceId: id });
    await mergeKeres(c, id);
    const t = await c.torzs();
    const e = await merge.jovahagy(c.db, { requestId: id, staffId: c.staffId, megjegyzes: szoveges(t, 'megjegyzes', { max: 500 }), now: c.now });
    await kepek.jogosultsagUjraellenorzes(c.db, { guestId: e.forrasId, now: c.now });   // a kep-linkek jogosultsaga az osszevonas utan ujraellenorzodik
    return { merge_audit_id: e.mergeAuditId, forras_id: e.forrasId, cel_id: e.celId };
  }],
  ['POST', '/osszevonas/:id/elutasit', async (c) => {
    const id = c.uuid('id');
    await c.kot('approve', 'merge', { resourceId: id });
    await mergeKeres(c, id);
    const t = await c.torzs();
    return merge.elutasit(c.db, { requestId: id, staffId: c.staffId, megjegyzes: szoveges(t, 'megjegyzes', { max: 500 }), now: c.now });
  }],
  ['POST', '/osszevonas-audit/:id/visszafordit', async (c) => {
    const id = c.uuid('id');
    await c.kot('approve', 'merge', { resourceId: id });
    const t = await c.torzs();
    const ok = szoveges(t, 'ok', { kotelezo: true, max: 500, min: 3 });
    const e = await merge.visszafordit(c.db, { mergeAuditId: id, staffId: c.staffId, ok, now: c.now });
    await kepek.jogosultsagUjraellenorzes(c.db, { guestId: e.celId, now: c.now });
    return e;
  }],

  // ---- munkalista, kezeles-igazolas ------------------------------------------------------------------------------------------------------------
  ['GET', '/munkalista', async (c) => {
    await c.kot('read', 'booking');
    const nap = c.q.get('nap') || helyiNap(c.now);
    if (!napE(nap)) throw new ApiHiba('ERVENYTELEN_NAP', 'A nap formátuma ÉÉÉÉ-HH-NN.', 422);
    const [y, m, d] = nap.split('-').map(Number);
    const kezd = helyiEpoch(y, m, d, 0, 0), vege = naptariNapVege(kezd, 0);
    const klinikai = lehet(c.szerepek, 'read', 'assessment');
    const sorok = await mind(c.db,
      `SELECT b.id, b.service_code, b.start_at, b.end_at, b.status, b.therapist_id, b.therapist_name, b.completed_at, b.completed_by, b.guest_id, g.name AS vendeg_nev
       FROM booking b JOIN guest g ON g.id = b.guest_id WHERE b.start_at >= ?1 AND b.start_at <= ?2 AND b.duplicate_of IS NULL ORDER BY b.start_at, b.rowid`, kezd, vege);
    const lista = [];
    for (const b of sorok) {
      const kovetkezo = await elso(c.db, `SELECT MIN(start_at) AS t FROM booking WHERE guest_id = ?1 AND start_at > ?2 AND status IN ('booked', 'rescheduled') AND duplicate_of IS NULL`, b.guest_id, b.start_at);
      const sor = {
        foglalas_id: b.id, vendeg: { id: b.guest_id, nev: b.vendeg_nev }, szolgaltatas: b.service_code, kezdes: b.start_at, vege: b.end_at, allapot: b.status,
        kezelo: { id: b.therapist_id, nev: b.therapist_name }, megjelent_igazolt: b.status === 'completed', igazolta: b.completed_by, kovetkezo_foglalas: kovetkezo?.t ?? null,
        felmero: null, kontraindikacio_jelzes: null,
      };
      if (klinikai) {
        const f = await felmero.kerdoivAllapot(c.db, b.id);
        sor.felmero = { allapot: f.status, kitoltve: f.kitoltve };
        sor.kontraindikacio_jelzes = f.jelzes || !!(await elso(c.db, `SELECT 1 AS x FROM contraindication_alert WHERE guest_id = ?1 AND status IN ('open', 'acknowledged', 'clinical_stop') LIMIT 1`, b.guest_id));
      }
      lista.push(sor);
    }
    return { nap, foglalasok: lista };
  }],
  ['POST', '/foglalasok/:id/completed', async (c) => {
    const id = c.uuid('id');
    await c.kot('confirm', 'booking', { resourceId: id });
    if (!(await foglalas(c.db, id))) throw new ApiHiba('NINCS_TALALAT', 'Nincs ilyen foglalás.', 404);
    const r = await igazolCompleted(c.db, { bookingId: id, staffId: c.staffId, now: c.now, ipHash: c.ipHash });
    return { mar: !!r.mar, kezeles_sorszam: r.treatmentIndex ?? null, kamera_kotelezo: r.cameraRequired ?? (r.treatmentIndex ? kura.kameraKotelezo(r.treatmentIndex) : false), kezeles_id: r.sessionId ?? null, dokumentum: r.dokumentum ?? null, kezeles_alkalom: r.kezelesAlkalom ?? null };
  }],
  ['POST', '/foglalasok/:id/no-show', async (c) => {
    const id = c.uuid('id');
    await c.kot('confirm', 'booking', { resourceId: id });
    const b = await foglalas(c.db, id);
    if (!b) throw new ApiHiba('NINCS_TALALAT', 'Nincs ilyen foglalás.', 404);
    if (b.status === 'no_show') return { mar: true, allapot: 'no_show' };
    if (!['booked', 'rescheduled'].includes(b.status)) throw new ApiHiba('NEM_JELOLHETO', `A(z) ${b.status} állapotú foglalás nem jelölhető meg meg nem jelentként.`, 409);
    if (c.now < b.start_at) throw new ApiHiba('MEG_NEM_VOLT', 'Az időpont előtt nem jelölhető meg meg nem jelentként.', 409);
    // a hiteles no_show a foglalas allapotgepen megy at (berlet / credit kovetes inclusive); az esemeny-azonosito a foglalasra egyedi
    const e = await ingestBookingEvent(c.db, { account: b.account, externalId: b.external_id, service: b.service_code, start: b.start_at, status: 'no_show', eventAt: Math.max(c.now, b.last_event_at), eventId: `staff-no-show:${id}`, now: c.now });
    await c.audit({ action: 'booking.no_show_marked', resource: 'booking', resourceId: id, guestId: b.guest_id, detail: { valtozas: e.valtozas } });
    return { mar: false, allapot: (await foglalas(c.db, id)).status, valtozas: e.valtozas };
  }],

  // ---- berlet, ajandek, credit ---------------------------------------------------------------------------------------------------------------------
  ['GET', '/vendegek/:id/berletek', async (c) => {
    const id = c.uuid('id');
    await c.kot('read', 'package', { guestId: id });
    await vendegBetolt(c, id);
    return { berletek: await berlet.vendegBerletei(c.db, id, { now: c.now }) };
  }],
  ['POST', '/berletek', async (c) => {
    await c.kot('write', 'package');
    const t = await c.torzs();
    const guestId = azonosito(t, 'guest_id');
    const tipus = valasztas(t, 'tipus', ['package_5', 'package_10']);
    let fizetes = null;
    if (t.fizetes_ideje !== undefined && t.fizetes_ideje !== null && t.fizetes_ideje !== '') {
      if (Number.isInteger(t.fizetes_ideje)) fizetes = t.fizetes_ideje;
      else if (napE(t.fizetes_ideje)) { const [y, m, d] = t.fizetes_ideje.split('-').map(Number); fizetes = helyiEpoch(y, m, d, 12, 0); } else throw new ApiHiba('ERVENYTELEN_MEZO', 'A fizetes_ideje epoch másodperc vagy ÉÉÉÉ-HH-NN.', 422);
      if (fizetes < 1577836800 || fizetes > c.now + 86400) throw new ApiHiba('ERVENYTELEN_MEZO', 'A fizetés ideje nem lehet 2020 előtti vagy jövőbeli.', 422);
    }
    const atadva = logikai(t, 'ajandek_atadva') === true;
    const kulcs = c.request.headers.get('idempotency-key');
    if (kulcs && !/^[A-Za-z0-9._:-]{8,100}$/.test(kulcs)) throw new ApiHiba('ERVENYTELEN_KULCS', 'Az Idempotency-Key 8–100 karakter (betű, szám, ._:-).', 422);
    await vendegBetolt(c, guestId);
    const r = await berlet.vasarol(c.db, { guestId, tipus, staffId: c.staffId, fizetesIdeje: fizetes, idempotencyKey: kulcs, ajandekAtadva: atadva, now: c.now });
    return { berlet_id: r.purchaseId, mar: !!r.mar, korai: r.korai ?? !!r.purchase?.early_purchase, ajandekok: r.ajandekok ?? null, lejarat: r.lejarat ?? r.purchase?.expires_at };
  }],
  ['POST', '/berletek/:id/hosszabbit', async (c) => {
    const id = c.uuid('id');
    await c.kot('approve', 'package', { resourceId: id });
    const t = await c.torzs();
    const ok = szoveges(t, 'ok', { kotelezo: true, max: 500, min: 3 });
    const honap = egesz(t, 'honap', { min: 1, max: 24 });
    const uj = egesz(t, 'uj_lejarat', { min: 1577836800, max: 4102444800 });
    if (!honap && !uj) throw new ApiHiba('HIANYZO_MEZO', 'Add meg a honap vagy az uj_lejarat mezőt.', 422);
    return berlet.hosszabbit(c.db, { purchaseId: id, staffId: c.staffId, ujLejarat: uj, honap, ok, now: c.now });
  }],
  ['POST', '/berletek/:id/refund', async (c) => {
    const id = c.uuid('id');
    await c.kot('approve', 'package', { resourceId: id });
    const t = await c.torzs();
    const ok = szoveges(t, 'ok', { kotelezo: true, max: 500, min: 3 });
    const mod = valasztas(t, 'mod', ['teljes', 'egyedi'], { kotelezo: false }) || 'teljes';
    const allapot = t.ajandek_allapot ?? {};
    if (typeof allapot !== 'object' || Array.isArray(allapot)) throw new ApiHiba('ERVENYTELEN_MEZO', 'Az ajandek_allapot objektum (ajándék-azonosító → bontatlan | felbontott).', 422);
    return berlet.refund(c.db, { purchaseId: id, staffId: c.staffId, mod, osszeg: egesz(t, 'osszeg', { min: 1, max: 10000000 }), ok, ajandekAllapot: allapot, now: c.now });
  }],
  ['POST', '/berletek/:id/korrekcio', async (c) => {
    const id = c.uuid('id');
    await c.kot('approve', 'package', { resourceId: id });
    const t = await c.torzs();
    const delta = egesz(t, 'delta', { kotelezo: true, min: -20, max: 20 });
    if (delta === 0) throw new ApiHiba('ERVENYTELEN_MEZO', 'A delta nem lehet nulla.', 422);
    await berlet.korrekcio(c.db, { purchaseId: id, deltaUnits: delta, staffId: c.staffId, ok: szoveges(t, 'ok', { kotelezo: true, max: 500, min: 3 }), now: c.now });
    return { ok: true };
  }],
  ['POST', '/ajandekok/:id/atad', async (c) => {
    const id = c.uuid('id');
    await c.kot('write', 'gift', { resourceId: id });
    await berlet.ajandekAtad(c.db, { giftId: id, staffId: c.staffId, now: c.now });
    return { ok: true };
  }],
  ['POST', '/ajandekok/:id/visszavesz', async (c) => {
    const id = c.uuid('id');
    await c.kot('write', 'gift', { resourceId: id });
    await berlet.ajandekVisszavesz(c.db, { giftId: id, staffId: c.staffId, now: c.now });
    return { ok: true };
  }],
  ['GET', '/vendegek/:id/credit', async (c) => {
    const id = c.uuid('id');
    await c.kot('read', 'credit', { guestId: id });
    await vendegBetolt(c, id);
    return { creditek: await credit.ellenoriz(c.db, id, { now: c.now }) };
  }],
  ['POST', '/credit/:id/levonas', async (c) => {
    const id = c.uuid('id');
    await c.kot('mark', 'credit', { resourceId: id });
    const t = await c.torzs();
    return credit.jelolLevonas(c.db, { creditId: id, bookingId: azonosito(t, 'booking_id', { kotelezo: true }), staffId: c.staffId, now: c.now });
  }],

  // ---- hozzajarulas ------------------------------------------------------------------------------------------------------------------------------
  ['GET', '/vendegek/:id/hozzajarulasok', async (c) => {
    const id = c.uuid('id');
    await c.kot('read', 'consent', { guestId: id });
    await vendegBetolt(c, id);
    return { ...(await hozzajarulas.allapot(c.db, id)), marketing: { email: await hozzajarulas.marketingAllapot(c.db, id, 'email_marketing'), sms: await hozzajarulas.marketingAllapot(c.db, id, 'sms_marketing') } };
  }],
  ['POST', '/vendegek/:id/hozzajarulasok', async (c) => {
    const id = c.uuid('id');
    await c.kot('write', 'consent', { guestId: id });
    const t = await c.torzs();
    const csatorna = valasztas(t, 'csatorna', ['email_marketing', 'sms_marketing', 'image_marketing', 'privacy']);
    const allapot = valasztas(t, 'allapot', ['granted', 'withdrawn']);
    const g = await vendegBetolt(c, id);
    if (g.status !== 'active') throw new ApiHiba('NEM_AKTIV_VENDEG', 'Csak aktív vendéghez rögzíthető hozzájárulás.', 409);
    let e;
    if (allapot === 'granted') {
      e = await hozzajarulas.rogzit(c.db, { guestId: id, csatorna, szovegVerzio: szoveges(t, 'szoveg_verzio', { kotelezo: true, max: 60, min: 1 }), forras: 'staff', staffId: c.staffId, ipHash: c.ipHash, now: c.now });
    } else {
      e = await hozzajarulas.visszavon(c.db, { guestId: id, csatorna, forras: 'staff', staffId: c.staffId, ipHash: c.ipHash, now: c.now });
    }
    return { esemeny_id: e.eventId, marketing: { email: await hozzajarulas.marketingAllapot(c.db, id, 'email_marketing'), sms: await hozzajarulas.marketingAllapot(c.db, id, 'sms_marketing') } };
  }],

  // ---- panasz, kompenzacio, elegedettseg --------------------------------------------------------------------------------------------------------
  ['GET', '/panaszok', async (c) => {
    await c.kot('read', 'complaint');
    const allapot = valasztas({ allapot: c.q.get('allapot') || 'open' }, 'allapot', ['open', 'resolved', 'mind']);
    const sorok = await mind(c.db, `SELECT p.*, g.name AS vendeg_nev, u.name AS kezelo_nev FROM complaint p JOIN guest g ON g.id = p.guest_id LEFT JOIN staff_user u ON u.id = p.therapist_id
      WHERE (?1 = 'mind' OR p.status = ?1) ORDER BY CASE p.status WHEN 'open' THEN 0 ELSE 1 END, p.due_at LIMIT 200`, allapot);
    return { panaszok: sorok.map((p) => ({
      id: p.id, vendeg: { id: p.guest_id, nev: p.vendeg_nev }, foglalas_id: p.booking_id, allapot: p.status, forras: p.source, leiras: p.description, megnyitva: p.opened_at, hatarido: p.due_at, elso_kapcsolat: p.first_contact_at,
      felelos: { id: p.therapist_id, nev: p.kezelo_nev }, sajat: p.therapist_id === c.staffId, keso: p.status === 'open' && !p.first_contact_at && p.due_at < c.now, megoldas: p.resolution, lezarva: p.resolved_at,
    })) };
  }],
  ['POST', '/vendegek/:id/panaszok', async (c) => {
    const id = c.uuid('id');
    await c.kot('write', 'complaint', { guestId: id });
    const t = await c.torzs();
    await vendegBetolt(c, id);
    return panasz.panaszNyit(c.db, { guestId: id, bookingId: azonosito(t, 'booking_id', { kotelezo: false }), kezeloId: azonosito(t, 'kezelo_id', { kotelezo: false }), forras: valasztas(t, 'forras', ['staff', 'email', 'phone'], { kotelezo: false }) || 'staff', leiras: szoveges(t, 'leiras', { max: 2000 }), staffId: c.staffId, now: c.now });
  }],
  ['POST', '/panaszok/:id/probalkozas', async (c) => {
    const id = c.uuid('id');
    await c.kot('write', 'complaint', { resourceId: id });
    const t = await c.torzs();
    return panasz.probalkozas(c.db, { complaintId: id, staffId: c.staffId, tipus: valasztas(t, 'tipus', ['call', 'email']), eredmeny: valasztas(t, 'eredmeny', ['reached', 'no_answer', 'sent', 'bounced']), megjegyzes: szoveges(t, 'megjegyzes', { max: 1000 }), now: c.now });
  }],
  ['POST', '/panaszok/:id/lezar', async (c) => {
    const id = c.uuid('id');
    await c.kot('write', 'complaint', { resourceId: id });
    const t = await c.torzs();
    return panasz.lezar(c.db, { complaintId: id, staffId: c.staffId, megoldas: szoveges(t, 'megoldas', { kotelezo: true, max: 2000, min: 3 }), vendegElegedett: logikai(t, 'vendeg_elegedett', { kotelezo: true }), now: c.now });
  }],
  ['POST', '/panaszok/:id/felelos', async (c) => {
    const id = c.uuid('id');
    await c.kot('reassign', 'complaint', { resourceId: id });
    const t = await c.torzs();
    await panasz.felelosCsere(c.db, { complaintId: id, ujKezeloId: azonosito(t, 'uj_kezelo_id'), staffId: c.staffId, ok: szoveges(t, 'ok', { kotelezo: true, max: 500, min: 3 }), now: c.now });
    return { ok: true };
  }],
  ['POST', '/panaszok/:id/kompenzacio', async (c) => {
    const id = c.uuid('id');
    await c.kot('request', 'compensation', { resourceId: id });
    const t = await c.torzs();
    return panasz.kompenzacioKeres(c.db, { complaintId: id, tipus: valasztas(t, 'tipus', ['refund', 'free_replacement', 'discount']), osszeg: egesz(t, 'osszeg', { min: 1, max: 10000000 }), staffId: c.staffId, now: c.now });
  }],
  ['POST', '/kompenzaciok/:id/dontes', async (c) => {
    const id = c.uuid('id');
    await c.kot('approve', 'compensation', { resourceId: id });
    const t = await c.torzs();
    await panasz.kompenzacioDont(c.db, { approvalId: id, staffId: c.staffId, dontes: valasztas(t, 'dontes', ['approved', 'rejected']), megjegyzes: szoveges(t, 'megjegyzes', { max: 500 }), now: c.now });
    return { ok: true };
  }],
  ['GET', '/elegedettseg', async (c) => {
    if (!c.lehet('read', 'stats_aggregate') && !c.lehet('read', 'complaint')) await c.kot('read', 'stats_aggregate');
    const { tol, ig } = idoszak(c.q, c.now);
    const sorok = await panasz.kezeloRiport(c.db, { tol, ig });
    return { tol, ig, kezelok: sorok.map((s) => ({ kezelo_id: s.therapist_id, nev: s.name, kitoltes: s.db, atlag: s.atlag, negativ: s.negativ })) };
  }],
];
