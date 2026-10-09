// Onallo teszt-szerver a CRM UI Playwright-teszteihez: a valodi crm/lib/api.js (memoria-SQLite) + sajat teszt-adat (a demo-adat modultol fuggetlen).
// Kulso halozat nincs. Hasznalat: import { inditSzerver } from './teszt-szerver.mjs'  vagy  node tools/crm-ui-teszt/teszt-szerver.mjs [--port=4311]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { api } from '../../crm/lib/api.js';
import { CSP_CRM } from '../../crm/lib/http.js';
import { helyiEpoch, helyiNap } from '../../crm/lib/db.js';
import { ujTeszt, foglal, kezelesek, kerdoivBeallit, kerdoivKitolt, jpegBajtok, NAP } from '../../crm/test/fixtures.js';
import * as images from '../../crm/lib/images.js';
import * as berlet from '../../crm/lib/package.js';
import * as panasz from '../../crm/lib/complaint.js';
import * as guestMod from '../../crm/lib/guest.js';
import * as consent from '../../crm/lib/consent.js';
import { sha256 } from '../../crm/lib/db.js';

const GYOKER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TIPUSOK = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.webp': 'image/webp' };

function fajlUt(urlUt, mappa) {
  let ut; try { ut = decodeURIComponent(urlUt); } catch { return null; }
  const teljes = path.resolve(GYOKER, `.${ut}`); const gy = path.resolve(GYOKER, mappa);
  return teljes.startsWith(gy + path.sep) && fs.existsSync(teljes) && fs.statSync(teljes).isFile() ? teljes : null;
}

/** a demo-munkatarsak elore felvetele (a demo-belepes ezeket talalja meg), igy a teszt-adat hozzajuk kotheto */
async function demoMunkatars(db, szerep, now) {
  const email = `demo-${szerep.replace(/_/g, '-')}@demo.invalid`;
  const id = crypto.randomUUID();
  await db.prepare('INSERT INTO staff_user (id, email, name, salonic_name, active, created_at) VALUES (?1, ?2, ?3, ?4, 1, ?5)').bind(id, email, `Demo ${szerep}`, szerep === 'therapist' ? 'Demo Kezelo' : null, now).run();
  await db.prepare('INSERT INTO staff_role (staff_id, role_id, granted_by, granted_at) VALUES (?1, ?2, \'teszt\', ?3)').bind(id, szerep, now).run();
  return id;
}

export async function adatBetolt(t, env) {
  const now = Math.floor(Date.now() / 1000);
  const [y, m, d] = helyiNap(now).split('-').map(Number);
  const ora = (o, p = 0) => helyiEpoch(y, m, d, o, p);
  const ids = {};
  const db = t.db;
  for (const sz of ['therapist', 'clinical_lead', 'reception', 'salon_manager', 'marketing', 'admin']) ids[sz] = await demoMunkatars(db, sz, now - 30 * NAP);
  const kezelo = ids.therapist;
  await kerdoivBeallit(t).catch(() => {});
  const V = (nev, i) => ({ nev, email: `${nev.toLowerCase().replace(/\W+/g, '.')}@example.com`, telefon: `+36 30 555 ${1000 + i}` });
  // mai foglalasok
  const a = await foglal(t, { service: 'first_hair', start: ora(10), vendeg: V('Teszt Anna', 1), kezelo: 'Demo Kezelo', bookedAt: now - 3 * NAP, now: now - 3 * NAP });
  const b = await foglal(t, { service: 'followup_hair', start: ora(11, 30), vendeg: V('Teszt Bela', 2), kezelo: 'Demo Kezelo', bookedAt: now - 3 * NAP, now: now - 3 * NAP });
  const c = await foglal(t, { service: 'camera_assessment', start: ora(13), vendeg: V('Teszt Cili', 3), kezelo: 'Demo Kezelo', bookedAt: now - 3 * NAP, now: now - 3 * NAP });
  const x = await foglal(t, { service: 'followup_hair', start: ora(15), vendeg: { nev: '<img src=x onerror="window.__xss=1">Xss', email: 'xss.teszt@example.com', telefon: '+36 30 555 9999' }, kezelo: 'Demo Kezelo', bookedAt: now - 3 * NAP, now: now - 3 * NAP });
  ids.xss = x.guestId;
  ids.annaBooking = a.bookingId; ids.belaBooking = b.bookingId; ids.ciliBooking = c.bookingId; ids.anna = a.guestId; ids.bela = b.guestId; ids.cili = c.guestId;
  await kerdoivKitolt(t, { guestId: a.guestId, bookingId: a.bookingId, now: now - NAP }).catch((e) => console.warn('kerdoiv A', e.message));
  await kerdoivKitolt(t, { guestId: b.guestId, bookingId: b.bookingId, valaszFelulir: { korabbi_reakcio: true }, now: now - NAP }).catch((e) => console.warn('kerdoiv B', e.message));
  // Dora: 3 igazolt kezeles (1. es 3. alkalom: kamerakep), kovetkezo foglalas
  const ds = await kezelesek(t, { vendeg: V('Teszt Dora', 4), n: 3, kezdet: now - 60 * NAP, staffId: ids.therapist }).catch((e) => { console.warn('kezelesek', e.message); return []; });
  if (ds.length) {
    ids.dora = ds[0].guestId;
    ids.doraSessions = [];
    for (const k of [ds[0], ds[2]].filter(Boolean)) {
      const kepVan = k === ds[0];
      const s = await db.prepare('SELECT id, treatment_index FROM treatment_session WHERE booking_id = ?1').bind(k.bookingId).first();
      if (s) { ids.doraSessions.push(s.id); if (kepVan) await images.kepFeltolt(db, { sessionId: s.id, staffId: ids.therapist, bajtok: jpegBajtok(300), mime: 'image/jpeg', capturePoint: 'fo', tarolo: t.tarolo, now: now - 30 * NAP }).catch((e) => console.warn('kep', e.message)); }
    }
    await foglal(t, { service: 'followup_hair', start: now + 7 * NAP, vendeg: V('Teszt Dora', 4), kezelo: 'Demo Kezelo', now: now - NAP }).catch(() => {});
  }
  // Emese: 10-es berlet
  const e = await foglal(t, { service: 'first_hair', start: now + 3 * NAP, vendeg: V('Teszt Emese', 5), kezelo: 'Demo Kezelo', now: now - NAP });
  ids.emese = e.guestId;
  await berlet.vasarol(db, { guestId: e.guestId, tipus: 'package_10', staffId: ids.reception, fizetesIdeje: now - NAP, now: now - NAP }).catch((er) => console.warn('berlet', er.message));
  // Fanni: nyitott panasz a demo-kezelohoz
  const f = await foglal(t, { service: 'first_hair', start: now - 2 * NAP, vendeg: V('Teszt Fanni', 6), kezelo: 'Demo Kezelo', now: now - 3 * NAP });
  ids.fanni = f.guestId;
  await panasz.panaszNyit(db, { guestId: f.guestId, bookingId: f.bookingId, kezeloId: ids.therapist, leiras: 'Elegedetlen a kezelessel (teszt).', staffId: ids.therapist, now: now - 3600 }).catch((er) => console.warn('panasz', er.message));
  await consent.rogzit(db, { guestId: e.guestId, csatorna: 'email_marketing', szovegVerzio: 'teszt-v1', forras: 'staff', staffId: ids.reception, now: now - NAP }).catch((er) => console.warn('consent', er.message));
  // osszevonasi kerelem: ugyanaz az e-mail, mas telefon, masik fiok
  try {
    await db.prepare('INSERT OR IGNORE INTO salonic_account (id, label, active, status, created_at) VALUES (\'teszt-masodik-fiok\', \'Masodik\', 1, \'INTEGRATION_BLOCKED\', ?1)').bind(now).run();
    await guestMod.vendegAzonosit(db, { account: 'teszt-masodik-fiok', externalGuestId: 'x-1', nev: 'Teszt Anna K.', email: 'teszt.anna@example.com', telefon: '+36 70 999 0000', now });
  } catch (er) { console.warn('osszevonas', er.message); }
  return ids;
}

export async function inditSzerver({ port = 0, adat = true } = {}) {
  const t = await ujTeszt({ masodikFiok: false });
  const ASSETS = { async fetch(keres) { const f = fajlUt(new URL(typeof keres === 'string' ? keres : (keres.url || keres.href)).pathname, 'assets'); return f ? new Response(fs.readFileSync(f), { headers: { 'Content-Type': TIPUSOK[path.extname(f)] || 'application/octet-stream' } }) : new Response('nincs', { status: 404 }); } };
  const env = { CRM_DB: t.db, CRM_TAROLO: t.tarolo, ASSETS, CRM_DEMO: '1', CRM_DEV: '1', CRM_ADMIN_EMAILS: 'admin@dev.local', CRM_TITOK: 'teszt-titok-teszt-titok-teszt-titok', CRM_KULCS_HASH: await sha256('teszt-kulcs'), CRM_SO: 'teszt', CRM_KULDES: 'dry' };
  const ids = adat ? await adatBetolt(t, env) : {};
  const naplo = [];
  const szerver = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    try {
      if (url.pathname === '/crm' || url.pathname === '/crm/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': CSP_CRM, 'Referrer-Policy': 'no-referrer' });
        return res.end(fs.readFileSync(path.join(GYOKER, 'foglalas/crm.html')));
      }
      if (url.pathname.startsWith('/assets/')) {
        const f = fajlUt(url.pathname, 'assets');
        if (!f) { res.writeHead(404); return res.end('nincs'); }
        res.writeHead(200, { 'Content-Type': TIPUSOK[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        return res.end(fs.readFileSync(f));
      }
      if (url.pathname.startsWith('/api/crm')) {
        const fejlecek = new Headers();
        for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) fejlecek.set(k, Array.isArray(v) ? v.join(', ') : v);
        const iro = !['GET', 'HEAD'].includes(req.method);
        const valasz = await api(new Request(url, { method: req.method, headers: fejlecek, body: iro ? Readable.toWeb(req) : undefined, duplex: iro ? 'half' : undefined }), env, { waitUntil: (p) => Promise.resolve(p).catch(() => {}) });
        naplo.push(`${req.method} ${url.pathname} ${valasz.status}`);
        const ki = [...valasz.headers].filter(([k]) => k !== 'set-cookie');
        const sutik = valasz.headers.getSetCookie?.() || [];
        res.writeHead(valasz.status, [...ki, ...sutik.map((s) => ['set-cookie', s])].flat());
        return res.end(Buffer.from(await valasz.arrayBuffer()));
      }
      res.writeHead(404); res.end('nincs');
    } catch (er) { console.error('teszt-szerver hiba', er); res.writeHead(500); res.end('hiba'); }
  });
  await new Promise((ok) => szerver.listen(port, '127.0.0.1', ok));
  const cim = `http://127.0.0.1:${szerver.address().port}`;
  return { url: cim, ids, db: t.db, naplo, env, zar: () => new Promise((ok) => { szerver.close(ok); szerver.closeAllConnections?.(); }) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number((process.argv.find((x) => x.startsWith('--port=')) || '').split('=')[1] || 4311);
  const s = await inditSzerver({ port });
  console.log(`[crm-ui-teszt] ${s.url}/crm`);
}
