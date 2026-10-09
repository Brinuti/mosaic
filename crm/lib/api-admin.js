// API-vegpontok: uzenetek (katalogus, jobok, uzemmod; a motor-fuggo reszek vekony kapcsolon at), merok, beallitasok, munkatarsak, audit, Salonic-allapot,
// gepi bejovo (ingest / tick). A motor / ingest / merok / dashboard modulokat masik fejleszto irja: hianyuk 501 (lasd api-modulok.js).
import { ApiHiba, azonosito, csvCella, jsonTorzs, szoveges, logikai, szoveg as szovegValasz } from './http.js';
import { elso, mind, keszit, tranzakcio, jsonOlvas, normEmail, uuid } from './db.js';
import { SZEREPKOROK } from './constants.js';
import { auditLista, auditStmt } from './audit.js';
import { konfigEnvbol } from './messages/kuldo.js';
import KATALOG from './messages/katalog.js';
import { modulFuggveny } from './api-modulok.js';
import { munkamenetekVisszavon } from './auth.js';
import { idoszak } from './api-vendeg.js';
import { fuggoHozzajarulasAlkalmaz, fuggoHozzajarulasSweep } from './api-public.js';
import { kuldoKeszit } from './messages/kuldo.js';
import { leiratkozasLinkSync } from './api-token.js';

const FOGLALT_KULCS = /^(pending_consent[:.]|demo[._]betoltve$)/;       // belso kulcsok: a beallitasok API nem mutatja es nem irja
const JOB_ALLAPOTOK = ['pending', 'claimed', 'sent', 'dry_run', 'skipped', 'blocked', 'failed', 'dead', 'cancelled'];

async function utolsoAdminMarad(c, kivetel) {
  const r = await elso(c.db, `SELECT COUNT(*) AS n FROM staff_user u JOIN staff_role r ON r.staff_id = u.id AND r.role_id = 'admin' WHERE u.active = 1 AND u.id <> ?1`, kivetel);
  return r.n > 0;
}

export const utak = [
  // ---- uzenetek ------------------------------------------------------------------------------------------------------------------------------
  ['GET', '/uzenetek/sablonok', async (c) => {
    if (!c.lehet('read', 'message') && !c.lehet('read', 'message_template')) await c.kot('read', 'message');
    return { sablonok: KATALOG.map((m) => ({ azonosito: m.id, nev: m.nev, csoport: m.csoport, csatorna: m.csatorna, trigger: m.trigger?.szabaly ?? null, gate: m.gate ?? null, verzio: m.verzio, szoveg_hianyzik: !!m.szovegHianyzik })) };
  }],
  ['POST', '/uzenetek/elonezet', async (c) => {
    await c.kot('read', 'message');
    const t = await c.torzs();
    const sablon = szoveges(t, 'template_key', { kotelezo: true, max: 40 });
    if (!KATALOG.some((m) => m.id === sablon)) throw new ApiHiba('ISMERETLEN_SABLON', 'Ismeretlen sablon.', 422);
    const guestId = azonosito(t, 'guest_id');
    const bookingId = azonosito(t, 'booking_id', { kotelezo: false });
    if (!(await elso(c.db, 'SELECT 1 AS x FROM guest WHERE id = ?1', guestId))) throw new ApiHiba('NINCS_TALALAT', 'Nincs ilyen vendég.', 404);
    const f = await modulFuggveny('motor', ['elonezet', 'elonezetKeszit']);   // (a motor.js jelenleg nem exportal ilyet -> 501)
    await c.audit({ action: 'message.preview', resource: 'message_template', resourceId: sablon, guestId });
    return f(c.db, { templateKey: sablon, guestId, bookingId, most: c.now, konfig: motorKonfig(c) });
  }],
  ['GET', '/uzenetek/jobok', async (c) => {
    await c.kot('read', 'message');
    const allapot = c.q.get('allapot');
    if (allapot && !JOB_ALLAPOTOK.includes(allapot)) throw new ApiHiba('ERVENYTELEN_SZURO', `Az allapot: ${JOB_ALLAPOTOK.join(' | ')}.`, 422);
    const guestId = azonosito({ g: c.q.get('guest_id') || null }, 'g', { kotelezo: false });
    const f = await modulFuggveny('motor', ['jobLista']);
    const jobok = await f(c.db, { allapot: allapot || null, guestId, limit: 200 });
    return {
      jobok: jobok.map((j) => ({
        id: j.id, vendeg_id: j.guest_id, sablon: j.template_key, csatorna: j.channel, allapot: j.status, ok: j.stop_reason, ido: j.run_at, probalkozas: j.attempts, hiba: j.last_error ? String(j.last_error).slice(0, 200) : null, elkuldve: j.sent_at,
        naplo: (j.ledger || []).map((l) => ({ id: l.id, eredmeny: l.outcome, ok: l.stop_reason, ido: l.at })),
      })),
    };
  }],
  ['POST', '/uzenetek/jobok/:id/ujra', async (c) => {
    const id = c.uuid('id');
    await c.kot('write', 'message_template', { resourceId: id });
    const f = await modulFuggveny('motor', ['ujrafuttat']);
    return motorKimenet(await f(c.db, id, { most: c.now, staffId: c.staffId, tarolo: c.tarolo, konfig: motorKonfig(c) }));
  }],
  ['POST', '/uzenetek/sandbox-proba', async (c) => {
    await c.kot('write', 'message_template');
    const t = await c.torzs();
    const sablon = szoveges(t, 'template_key', { kotelezo: true, max: 40 });
    if (!KATALOG.some((m) => m.id === sablon)) throw new ApiHiba('ISMERETLEN_SABLON', 'Ismeretlen sablon.', 422);
    const guestId = azonosito(t, 'guest_id');
    const f = await modulFuggveny('motor', ['sandboxProba', 'sandbox', 'proba']);   // (a motor.js jelenleg nem exportal ilyet -> 501)
    await c.audit({ action: 'message.sandbox_trial', resource: 'message_template', resourceId: sablon, guestId });
    return f(c.db, { templateKey: sablon, guestId, staffId: c.staffId, most: c.now, konfig: { ...motorKonfig(c), kuldes: 'dry' } });   // SOHA valodi kuldes
  }],
  ['GET', '/uzenetek/uzemmod', async (c) => {
    await c.kot('read', 'message');
    const k = konfigEnvbol(c.env);
    return { kuldes: k.kuldes, vendegnek_valodi_kuldes: k.kuldes === 'eles', megjegyzes: 'Csak olvasható: az élesre kapcsolás a tulajdonos külön jóváhagyása, kód-szinten.' };
  }],

  // ---- merok -----------------------------------------------------------------------------------------------------------------------------------
  ['GET', '/merok', async (c) => {
    await c.kot('read', 'stats_aggregate');
    const { tol, ig } = idoszak(c.q, c.now);
    const kezelo = azonosito({ k: c.q.get('kezelo') || null }, 'k', { kotelezo: false });
    const f = await modulFuggveny('merok', ['merok', 'szamol', 'osszes', 'default']);
    return f(c.db, { tol, ig, kezeloId: kezelo, most: c.now });
  }],

  // ---- beallitasok ---------------------------------------------------------------------------------------------------------------------------
  ['GET', '/beallitasok', async (c) => {
    await c.kot('read', 'settings');
    const sorok = await mind(c.db, 'SELECT kulcs, ertek, frissitve, frissitette FROM beallitasok ORDER BY kulcs');
    return { beallitasok: sorok.filter((s) => !FOGLALT_KULCS.test(s.kulcs)).map((s) => ({ kulcs: s.kulcs, ertek: jsonOlvas(s.ertek, s.ertek), frissitve: s.frissitve, frissitette: s.frissitette })) };
  }],
  ['PUT', '/beallitasok/:kulcs', async (c) => {
    await c.kot('write', 'settings');
    const kulcs = c.params.kulcs;
    if (!/^[a-z][a-z0-9_.-]{0,63}$/.test(kulcs) || FOGLALT_KULCS.test(kulcs)) throw new ApiHiba('ERVENYTELEN_KULCS', 'A kulcs: kisbetűvel kezdődő, a-z 0-9 _ . - (max 64).', 422);
    const t = await c.torzs();
    if (!('ertek' in t)) throw new ApiHiba('HIANYZO_MEZO', 'Az ertek mező kötelező.', 422);
    const ertek = JSON.stringify(t.ertek);
    if (ertek === undefined || ertek.length > 20000) throw new ApiHiba('ERVENYTELEN_MEZO', 'Az érték JSON, legfeljebb 20 000 karakter.', 422);
    await tranzakcio(c.db, [
      keszit(c.db, 'INSERT INTO beallitasok (kulcs, ertek, frissitve, frissitette) VALUES (?1, ?2, ?3, ?4) ON CONFLICT (kulcs) DO UPDATE SET ertek = excluded.ertek, frissitve = excluded.frissitve, frissitette = excluded.frissitette', kulcs, ertek, c.now, c.staffId),
      auditStmt(c.db, { staffId: c.staffId, action: 'settings.update', resource: 'beallitasok', resourceId: kulcs, detail: { kulcs }, ipHash: c.ipHash, now: c.now }),
    ]);
    return { kulcs, ok: true };
  }],

  // ---- munkatarsak -----------------------------------------------------------------------------------------------------------------------------
  ['GET', '/munkatarsak', async (c) => {
    await c.kot('read', 'staff_admin');
    const u = await mind(c.db, 'SELECT id, email, name, salonic_name, active, created_at, last_login_at FROM staff_user ORDER BY name');
    const r = await mind(c.db, 'SELECT staff_id, role_id FROM staff_role ORDER BY role_id');
    return { munkatarsak: u.map((x) => ({ id: x.id, email: x.email, nev: x.name, salonic_nev: x.salonic_name, aktiv: !!x.active, letrehozva: x.created_at, utolso_belepes: x.last_login_at, szerepek: r.filter((y) => y.staff_id === x.id).map((y) => y.role_id) })) };
  }],
  ['POST', '/munkatarsak', async (c) => {
    await c.kot('write', 'staff_admin');
    const t = await c.torzs();
    const email = normEmail(szoveges(t, 'email', { kotelezo: true, max: 200 }));
    if (!email) throw new ApiHiba('ERVENYTELEN_EMAIL', 'Érvénytelen e-mail-cím.', 422);
    const nev = szoveges(t, 'nev', { kotelezo: true, max: 100, min: 2 });
    const szerepek = szerepLista(t.szerepek);
    const id = uuid();
    try {
      await tranzakcio(c.db, [
        keszit(c.db, 'INSERT INTO staff_user (id, email, name, salonic_name, active, created_at) VALUES (?1, ?2, ?3, ?4, 1, ?5)', id, email, nev, szoveges(t, 'salonic_nev', { max: 100 }), c.now),
        ...szerepek.map((r) => keszit(c.db, 'INSERT INTO staff_role (staff_id, role_id, granted_by, granted_at) VALUES (?1, ?2, ?3, ?4)', id, r, c.staffId, c.now)),
        auditStmt(c.db, { staffId: c.staffId, action: 'staff.create', resource: 'staff_user', resourceId: id, detail: { szerepek }, ipHash: c.ipHash, now: c.now }),
      ]);
    } catch (e) {
      if (/UNIQUE|constraint/i.test(String(e?.message))) throw new ApiHiba('MAR_LETEZIK', 'Ezzel az e-mail-címmel már van munkatárs.', 409);
      throw e;
    }
    return { id, szerepek };
  }],
  ['PATCH', '/munkatarsak/:id', async (c) => {
    const id = c.uuid('id');
    await c.kot('write', 'staff_admin', { resourceId: id });
    const t = await c.torzs();
    const cel = await elso(c.db, 'SELECT * FROM staff_user WHERE id = ?1', id);
    if (!cel) throw new ApiHiba('NINCS_TALALAT', 'Nincs ilyen munkatárs.', 404);
    const aktiv = logikai(t, 'aktiv');
    const ujSzerepek = t.szerepek === undefined ? null : szerepLista(t.szerepek);
    const nev = szoveges(t, 'nev', { max: 100, min: 2 });
    const salonicNev = t.salonic_nev === undefined ? undefined : szoveges(t, 'salonic_nev', { max: 100 });
    const regiSzerepek = (await mind(c.db, 'SELECT role_id FROM staff_role WHERE staff_id = ?1', id)).map((r) => r.role_id);
    const adminVeszik = (ujSzerepek && regiSzerepek.includes('admin') && !ujSzerepek.includes('admin')) || (aktiv === false && cel.active === 1 && regiSzerepek.includes('admin'));
    if (id === c.staffId && (aktiv === false || (ujSzerepek && adminVeszik))) throw new ApiHiba('SAJAT_MAGAT', 'A saját hozzáférésedet nem csökkentheted.', 409);
    if (adminVeszik && !(await utolsoAdminMarad(c, id))) throw new ApiHiba('UTOLSO_ADMIN', 'Legalább egy aktív admin kell.', 409);
    const ut = [];
    if (nev) ut.push(keszit(c.db, 'UPDATE staff_user SET name = ?2 WHERE id = ?1', id, nev));
    if (salonicNev !== undefined) ut.push(keszit(c.db, 'UPDATE staff_user SET salonic_name = ?2 WHERE id = ?1', id, salonicNev));
    if (aktiv !== null) ut.push(keszit(c.db, 'UPDATE staff_user SET active = ?2 WHERE id = ?1', id, aktiv ? 1 : 0));
    if (ujSzerepek) {
      ut.push(keszit(c.db, 'DELETE FROM staff_role WHERE staff_id = ?1 AND role_id NOT IN (SELECT value FROM json_each(?2))', id, JSON.stringify(ujSzerepek)));
      for (const r of ujSzerepek) ut.push(keszit(c.db, 'INSERT OR IGNORE INTO staff_role (staff_id, role_id, granted_by, granted_at) VALUES (?1, ?2, ?3, ?4)', id, r, c.staffId, c.now));
    }
    if (aktiv === false) ut.push(munkamenetekVisszavon(c.db, id, c.now));
    if (!ut.length) throw new ApiHiba('URES_VALTOZTATAS', 'Nincs megadott változtatás.', 422);
    ut.push(auditStmt(c.db, { staffId: c.staffId, action: 'staff.update', resource: 'staff_user', resourceId: id, detail: { szerepek: ujSzerepek, aktiv, nev: !!nev }, ipHash: c.ipHash, now: c.now }));
    await tranzakcio(c.db, ut);
    return { ok: true };
  }],

  // ---- audit -------------------------------------------------------------------------------------------------------------------------------------
  ['GET', '/audit', async (c) => {
    await c.kot('read', 'audit');
    const { tol, ig } = idoszak(c.q, c.now);
    const sorok = await auditLista(c.db, auditSzuro(c, tol, ig));
    return { audit: sorok.map((s) => ({ id: s.id, ido: s.at, munkatars_id: s.staff_id, muvelet: s.action, eroforras: s.resource, eroforras_id: s.resource_id, vendeg_id: s.guest_id, eredmeny: s.result, reszlet: jsonOlvas(s.detail, null), ip_hash: s.ip_hash ? s.ip_hash.slice(0, 12) : null })) };
  }],
  ['GET', '/audit/export.csv', async (c) => {
    await c.kot('export', 'audit');
    const { tol, ig } = idoszak(c.q, c.now);
    const sorok = await auditLista(c.db, { ...auditSzuro(c, tol, ig), limit: 1000 });
    await c.audit({ action: 'audit.export', resource: 'security_audit', detail: { sorok: sorok.length, tol, ig } });
    const fejlec = ['ido', 'munkatars_id', 'muvelet', 'eroforras', 'eroforras_id', 'vendeg_id', 'eredmeny', 'reszlet'];
    const csv = `\uFEFF${[fejlec.map(csvCella).join(','), ...sorok.map((s) => [s.at, s.staff_id, s.action, s.resource, s.resource_id, s.guest_id, s.result, s.detail].map(csvCella).join(','))].join('\r\n')}\r\n`;
    return szovegValasz(csv, 'text/csv; charset=utf-8', 200, { 'Content-Disposition': 'attachment; filename="audit-export.csv"', 'Cache-Control': 'no-store' });
  }],

  ['GET', '/salonic-allapot', async (c) => {
    await c.kot('read', 'settings');
    const fiokok = await mind(c.db, 'SELECT * FROM salonic_account ORDER BY id');
    const utolso = await elso(c.db, `SELECT MAX(created_at) AS t FROM booking_event WHERE actor = 'system'`);
    return {
      fiokok: fiokok.map((f) => ({ id: f.id, cimke: f.label, aktiv: !!f.active, allapot: f.status, utolso_szinkron: f.last_sync_at, szinkron_keses_mp: f.last_sync_at ? Math.max(0, c.now - f.last_sync_at) : null })),
      utolso_bejovo_esemeny: utolso?.t ?? null, bejovo_keses_mp: utolso?.t ? Math.max(0, c.now - utolso.t) : null,
    };
  }],

  // ---- gepi bejovo (X-CRM-KULCS) ---------------------------------------------------------------------------------------------------------------------
  ['POST', '/ingest', async (c) => {
    const esemeny = await jsonTorzs(c.request, { kotelezo: true });
    const f = await modulFuggveny('ingest', ['ingestLifecycleEsemeny']);
    const r = await f(c.db, esemeny, { most: c.now });
    // a landing foglalo-blokkjabol erkezett marketing-hozzajarulas hozzakapcsolasa (e-mail / telefon alapjan), ha mar van ilyen vendeg
    let guestId = r?.guestId ?? null;
    if (!guestId && r?.bookingId) guestId = (await elso(c.db, 'SELECT guest_id FROM booking WHERE id = ?1', r.bookingId))?.guest_id ?? null;
    if (guestId) await fuggoHozzajarulasAlkalmaz(c.db, { guestId, now: c.now, ipHash: null });
    return r ?? { ok: true };
  }, { auth: 'kulcs' }],
  ['POST', '/tick', async (c) => {
    const f = await modulFuggveny('motor', ['tick']);
    const konfig = motorKonfig(c);
    await fuggoHozzajarulasSweep(c.db, { now: c.now });   // a landing-hozzajarulasok a frissen beerkezett foglalasok vendegeihez kapcsolodnak (a marketing-uzenetek elott)
    const kuldo = kuldoKeszit({ env: c.env, konfig });
    try { return (await f(c.db, { most: c.now, kuldo, tarolo: c.tarolo, konfig })) ?? { ok: true }; } finally { await kuldo.lezar?.(); }
  }, { auth: 'kulcs' }],
];

/** a motor konfigja a kornyezetbol: DRY alapertelmezes, a vendeg-linkek alapja a kerelem eredete, a leiratkozasi link alairt (CRM_TITOK) */
function motorKonfig(c) {
  const alap = c.url.origin;
  return {
    ...konfigEnvbol(c.env), alapUrl: alap, publikusAlap: `${alap}/api/crm`,
    linkek: { leiratkozas: ({ guest }) => (guest && (guest.guest_key || guest.id) ? leiratkozasLinkSync(c.env, alap, guest.guest_key || guest.id) : null) },
  };
}
/** a motor eredmenyebol a job-sor nyers mezoi nem mennek ki (payload / hiba-reszletek) */
function motorKimenet(r) {
  if (!r || typeof r !== 'object') return r ?? { ok: true };
  const { job, ...tobbi } = r;
  return { ...tobbi, job: job ? { id: job.id, allapot: job.status, ok: job.stop_reason, probalkozas: job.attempts } : null };
}
function szerepLista(v) {
  if (!Array.isArray(v) || !v.length || v.length > SZEREPKOROK.length || !v.every((x) => SZEREPKOROK.includes(x))) throw new ApiHiba('ERVENYTELEN_SZEREP', `A szerepek nem üres lista: ${SZEREPKOROK.join(' | ')}.`, 422);
  return [...new Set(v)];
}
function auditSzuro(c, tol, ig) {
  const muvelet = c.q.get('muvelet');
  if (muvelet && !/^[a-z0-9_.:-]{1,80}$/i.test(muvelet)) throw new ApiHiba('ERVENYTELEN_SZURO', 'A művelet szűrő érvénytelen.', 422);
  const eredmeny = c.q.get('eredmeny');
  if (eredmeny && !['ok', 'denied', 'error'].includes(eredmeny)) throw new ApiHiba('ERVENYTELEN_SZURO', 'Az eredmény: ok | denied | error.', 422);
  return {
    tol, ig, action: muvelet || undefined, result: eredmeny || undefined,
    guestId: azonosito({ g: c.q.get('vendeg_id') || null }, 'g', { kotelezo: false }) || undefined, staffId: azonosito({ s: c.q.get('munkatars_id') || null }, 's', { kotelezo: false }) || undefined,
    limit: Math.min(Number(c.q.get('limit')) || 200, 1000),
  };
}
