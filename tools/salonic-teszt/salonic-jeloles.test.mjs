// A Salonic-naptar jelolese ("Ott leszek") tesztjei (Node beepitett tesztfuttato): a Salonic-admin helyett egy helyi HTTP-szerver (mock), amely a valodi admin
// felulet szerkezetet utanozza (belepes, online foglalasok listaja, szerkeszto urlap). A valodi Salonic-fiokhoz nem nyul.
//   node --test tools/salonic-teszt/salonic-jeloles.test.mjs
import test, { before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { salonicJeloles, urlapOlvas, JELOLES, hasznalhato } from '../../netlify/lib/salonic-jeloles.js';

const JELSZO = 'titkos-jelszo-teszt';
let szerver, ALAP, kerelmek, allapot;
const MOST = new Date('2026-10-08T10:00:00Z');
// 2026-10-27 14:00 Budapest (CET, UTC+1) = 13:00 UTC; 2026-08-12 10:30 Budapest (CEST, UTC+2) = 08:30 UTC
const TS_OKT = Date.UTC(2026, 9, 27, 13, 0) / 1000;
const TS_AUG = Date.UTC(2026, 7, 12, 8, 30) / 1000;
const MOST_AUG = new Date('2026-08-01T10:00:00Z');
const ujAllapot = () => ({
  belepett: new Set(), megjegyzes: { 100: '', 101: '', 102: 'Korábbi megjegyzés' }, mentesek: [], lista404: false, nemMent: false, belepesRossz: false,
  idopontok: {
    100: { vendeg: '3393366', honap: 10, nap: 27, ora: 14, perc: 0, ev: 2026 },
    101: { vendeg: '3399999', honap: 10, nap: 27, ora: 14, perc: 0, ev: 2026 },   // ugyanaz az idopont, MAS vendeg
    102: { vendeg: '3384396', honap: 10, nap: 31, ora: 19, perc: 30, ev: 2026 },
  },
  ertesites: ['0', '1', '2'],
});
const HONAP = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];

function lista(a) {
  const kartyak = Object.entries(a.idopontok).map(([id, x]) => `<a class="appointment-link" data-service="calendar" data-action="show" data-id="${id}" data-bookingid="uuid-${id}">
\t\t\t\t<div class="card cursor-pointer booking-card booking-card-confirmed border-confirmed">
\t\t\t\t\t<div class="card-header text-left"><div class="card-title service-title">Ingyenes konzultáció</div>
\t\t\t\t\t\t<div><i class="fa fa-calendar"></i> ${HONAP[x.honap - 1]} ${x.nap}. (kedd) ${x.ora}:${String(x.perc).padStart(2, '0')}</div>
\t\t\t\t\t\t<small><i class="fa fa-clock-o"></i> Érkezett: okt. 7. (szerda) 16:10</small></div>
\t\t\t\t\t<div class="card-content"><h3 class="guest-name" title="Vendég ${id}">Vendég ${id}</h3><label class="badge badge-info"><i class="fa fa-calendar"></i> Időpontok: 1</label></div>
\t\t\t\t</div>
\t\t\t</a>`).join('\n');
  return `<!DOCTYPE html><html><body><div class="bookings">${kartyak}</div></body></html>`;
}
function urlap(a, id) {
  const x = a.idopontok[id];
  const opcio = (ertek, felirat, kiv) => `<option value="${ertek}"${kiv ? ' selected="selected"' : ''}>${felirat}</option>`;
  return `<!DOCTYPE html><html><body>
<form role="form" action="/calendar/edit/${id}/" id="appointmentManagementForm" method="post">
<input type="hidden" name="Appointment[isWalkin]" value="0">
<input type="hidden" name="Appointment[guestId]" value="${x.vendeg}">
<input type="hidden" name="Appointment[guestName]" value="Teszt &amp; Vendég ${id}">
<input type="hidden" name="Appointment[guestPhone]" value="+36201234567">
<input type="hidden" name="Appointment[guestEmail]" value="v${id}@example.com">
<input type="hidden" name="Appointment[forced]" value="0">
<input type="hidden" name="Appointment[placeId]" value="14585">
<input type="hidden" name="Appointment[employeeId]" value="32428">
<input type="hidden" name="Appointment[rootAppointmentId]" value="${id}">
<input type="hidden" name="Appointment[changeAllRepeated]" value="1">
<input type="text" class="form-control" name="Appointment[guestName]" value="Teszt &amp; Vendég ${id}" disabled="disabled">
<input type="text" class="form-control" name="Appointment[guestName]" value="Teszt &amp; Vendég ${id}">
<input type="hidden" name="Appointment[services][1][id]" value="${id}">
<input type="hidden" name="Appointment[services][1][membershipId]">
<input type="hidden" name="Appointment[services][1][originalServicePrice]" value="0">
<select name="Appointment[services][1][serviceId]">${opcio(471160, 'Ingyenes konzultáció', true)}${opcio(471161, 'Más')}</select>
<select name="Appointment[services][1][servicePeriodMinutes]">${opcio(15, '15')}${opcio(30, '30', true)}</select>
<input type="number" name="Appointment[services][1][finalServicePrice]" value="0">
<input type="number" name="Appointment[services][1][discount]">
<textarea name="Appointment[services][1][appointmentCommentInternal]" rows="2">${a.megjegyzes[id].replace(/&/g, '&amp;').replace(/</g, '&lt;')}</textarea>
<textarea name="Appointment[services][1][appointmentComment]" rows="2"></textarea>
<select name="Appointment[services][1][employeeId]">${opcio(32428, 'Melitta', true)}</select>
<select name="Appointment[services][1][year]">${opcio(2026, '2026', x.ev === 2026)}</select>
<select name="Appointment[services][1][month]">${[...Array(12)].map((_, i) => opcio(i + 1, i + 1, i + 1 === x.honap)).join('')}</select>
<select name="Appointment[services][1][day]">${[...Array(31)].map((_, i) => opcio(i + 1, i + 1, i + 1 === x.nap)).join('')}</select>
<select name="Appointment[services][1][hour]">${[...Array(24)].map((_, i) => opcio(i, i, i === x.ora)).join('')}</select>
<select name="Appointment[services][1][minute]">${[0, 15, 30, 45].map((m) => opcio(String(m).padStart(2, '0'), String(m).padStart(2, '0'), m === x.perc)).join('')}</select>
<input type="hidden" name="Appointment[isRepeated]" value="0"><input type="checkbox" name="Appointment[isRepeated]" value="1">
<select name="Appointment[repeatInterval]">${opcio(1, 'napi')}${opcio(2, 'heti', true)}</select>
<input type="text" name="Appointment[repeatEndValueDate]">
<select name="Appointment[notifyEdit]">${a.ertesites.map((v, i) => opcio(v, 'ertesites ' + v, i === 0)).join('')}</select>
<input type="hidden" name="Appointment[forced]" value="0"><input type="checkbox" name="Appointment[forced]" value="1">
<button type="submit" class="btn">Mentés</button>
</form></body></html>`;
}

before(async () => {
  szerver = http.createServer((req, res) => {
    const reszek = [];
    req.on('data', (c) => reszek.push(c));
    req.on('end', () => {
      const torzs = Buffer.concat(reszek).toString('utf8');
      const u = new URL(req.url, 'http://x');
      kerelmek.push({ method: req.method, ut: u.pathname + u.search, torzs, suti: req.headers.cookie || '', xhr: req.headers['x-requested-with'] || '' });
      const a = allapot;
      const be = /PHPSESSID=([a-z0-9]+)/.exec(req.headers.cookie || '');
      const belepve = be && a.belepett.has(be[1]);
      if (u.pathname === '/backend/signin/') {
        const p = new URLSearchParams(torzs);
        if (req.method === 'POST' && p.get('LoginForm[customer]') === 'mosaic-pmu' && p.get('LoginForm[password]') === JELSZO && !a.belepesRossz) {
          const sid = 'sess' + Math.random().toString(36).slice(2, 10);
          a.belepett.add(sid);
          res.writeHead(302, { 'set-cookie': [`PHPSESSID=${sid}; path=/; HttpOnly`, 'customer=mosaic-pmu; path=/'], location: '/calendar/index' });
          return res.end();
        }
        res.writeHead(200, { 'content-type': 'text/html' });
        return res.end('<form><input name="LoginForm[customer]"><input name="LoginForm[password]" type="password"></form>');
      }
      if (!belepve) { res.writeHead(302, { location: '/backend/signin/?customer=mosaic-pmu' }); return res.end(); }
      if (u.pathname === '/calendar/index') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end('<html>naptar</html>'); }
      if (u.pathname === '/onlineBookings/index') {
        res.writeHead(200, { 'content-type': 'text/html' });
        return res.end(u.searchParams.get('page') === '2' ? '<html></html>' : lista(a));
      }
      const m = /^\/calendar\/edit\/(\d+)\/$/.exec(u.pathname);
      if (m && a.idopontok[m[1]]) {
        if (req.method === 'POST') {
          const p = new URLSearchParams(torzs);
          a.mentesek.push({ id: m[1], mezok: [...p.entries()] });
          if (!a.nemMent) a.megjegyzes[m[1]] = p.get('Appointment[services][1][appointmentCommentInternal]');
          res.writeHead(200, { 'content-type': 'application/json' });
          return res.end('{"status":"success"}');
        }
        res.writeHead(200, { 'content-type': 'text/html' });
        return res.end(urlap(a, m[1]));
      }
      res.writeHead(302, { location: '/calendar/index' });
      res.end();
    });
  });
  await new Promise((ok) => szerver.listen(0, '127.0.0.1', ok));
  ALAP = `http://127.0.0.1:${szerver.address().port}`;
});
after(async () => { await new Promise((ok) => szerver.close(ok)); });
beforeEach(() => { kerelmek = []; allapot = ujAllapot(); });

const env = (extra = {}) => ({ SALONIC_PMU_JELSZO: JELSZO, SALONIC_PMU_URL: ALAP, ...extra });
const jeloles = (opc = {}) => salonicJeloles({ env: env(), kezdet: TS_OKT, vendegId: 'g:3393366', most: MOST, ...opc });

describe('salonicJeloles', () => {
  test('belep, megkeresi az idopontot (datum + ido + vendeg-azonosito), a belso megjegyzest kiegesziti, ertesites nelkul ment, es visszaolvassa', async () => {
    const r = await jeloles();
    assert.deepEqual(r, { ok: true, mi: 'jelolve' });
    assert.equal(allapot.mentesek.length, 1);
    assert.equal(allapot.mentesek[0].id, '100');
    assert.equal(allapot.megjegyzes[100], `${JELOLES} (2026. 10. 08. 12:00)`);   // 10:00 UTC = 12:00 CEST
    // a belepes ures munkamenettel indult, minden kesobbi keres a munkamenet-sutivel ment
    const poszt = kerelmek.filter((k) => k.method === 'POST');
    assert.equal(poszt[0].ut, '/backend/signin/?customer=mosaic-pmu');
    assert.ok(poszt[1].xhr === 'XMLHttpRequest');
    assert.ok(kerelmek.filter((k) => k.ut.startsWith('/onlineBookings') || k.ut.startsWith('/calendar/edit')).every((k) => /PHPSESSID=sess/.test(k.suti)));
  });

  test('a mentett urlap pontosan a bongeszo bekuldese: minden mezo (a sorrend, az ismetlodo / hidden + checkbox parok, a kijelolt opciok) valtozatlan, CSAK a belso megjegyzes es az ertesites valtozik', async () => {
    const elotte = urlapOlvas(urlap(allapot, 100), 'appointmentManagementForm').mezok;
    await jeloles();
    const kuldott = allapot.mentesek[0].mezok;
    assert.equal(kuldott.length, elotte.length);
    elotte.forEach(([n, v], i) => {
      assert.equal(kuldott[i][0], n, 'sorrend: ' + n);
      if (n === 'Appointment[services][1][appointmentCommentInternal]') assert.match(kuldott[i][1], /Megerősítve a weboldalon/);
      else assert.equal(kuldott[i][1], v, n);
    });
    const dict = Object.fromEntries(kuldott);
    assert.equal(dict['Appointment[notifyEdit]'], '0', 'nincs ertesites');
    assert.equal(dict['Appointment[guestId]'], '3393366');
    assert.equal(dict['Appointment[guestName]'], 'Teszt & Vendég 100', 'az entitasok visszaalakitva');
    assert.equal(kuldott.filter(([n]) => n === 'Appointment[isRepeated]').length, 1, 'a nem kijelolt checkbox nem megy');
    assert.equal(kuldott.filter(([n]) => n === 'Appointment[guestName]').length, 2, 'a letiltott (disabled) mezo nem megy: 1 hidden + 1 szoveg');
    assert.equal(dict['Appointment[services][1][month]'], '10');
    assert.equal(dict['Appointment[services][1][minute]'], '00');
  });

  test('ketszer ugyanazt nem jeloli (mar_jelolve), nincs masodik mentes', async () => {
    assert.equal((await jeloles()).mi, 'jelolve');
    kerelmek = [];
    assert.deepEqual(await jeloles(), { ok: true, mi: 'mar_jelolve' });
    assert.equal(allapot.mentesek.length, 1);
    assert.equal(kerelmek.filter((k) => k.method === 'POST' && k.ut.startsWith('/calendar/edit')).length, 0);
  });

  test('a meglevo belso megjegyzes megmarad, az uj sor alatta', async () => {
    const r = await jeloles({ kezdet: Date.UTC(2026, 9, 31, 18, 30) / 1000, vendegId: '3384396' });   // 19:30 CET
    assert.equal(r.mi, 'jelolve');
    assert.equal(allapot.megjegyzes[102], `Korábbi megjegyzés\n${JELOLES} (2026. 10. 08. 12:00)`);
  });

  test('ugyanarra az idopontra TOBB vendeg: a vendeg-azonosito dont (a masiknak az idopontjahoz nem nyul)', async () => {
    const r = await jeloles({ vendegId: 'g:3399999' });
    assert.equal(r.mi, 'jelolve');
    assert.equal(allapot.mentesek[0].id, '101');
    assert.equal(allapot.megjegyzes[100], '');
  });

  test('nincs ilyen vendeg az idopontnal -> nem ir (nincs_egyezes); ismeretlen idopont -> nincs_idopont', async () => {
    let r = await jeloles({ vendegId: '5555555' });
    assert.deepEqual(r, { ok: false, mi: 'nincs_egyezes' });
    r = await jeloles({ kezdet: Date.UTC(2026, 10, 2, 9, 0) / 1000 });
    assert.deepEqual(r, { ok: false, mi: 'nincs_idopont' });
    assert.equal(allapot.mentesek.length, 0);
  });

  test('nem egyertelmu (ugyanaz a vendeg ketszer ugyanarra az idopontra) -> nem ir', async () => {
    allapot.idopontok[101].vendeg = '3393366';
    const r = await jeloles();
    assert.deepEqual(r, { ok: false, mi: 'nem_egyertelmu' });
    assert.equal(allapot.mentesek.length, 0);
  });

  test('nyari idoszamitas (CEST): 10:30 budapesti ido a helyes jeloltet adja', async () => {
    allapot.idopontok[100] = { vendeg: '3393366', honap: 8, nap: 12, ora: 10, perc: 30, ev: 2026 };
    const r = await salonicJeloles({ env: env(), kezdet: TS_AUG, vendegId: '3393366', most: MOST_AUG });
    assert.equal(r.mi, 'jelolve');
    assert.match(allapot.megjegyzes[100], /\(2026\. 08\. 01\. 12:00\)/);
  });

  test('nincs jelszo / kikapcsolva (SALONIC_JELOLES=0) -> nincs halozati forgalom', async () => {
    assert.equal(hasznalhato({}), false);
    assert.deepEqual(await salonicJeloles({ env: { SALONIC_PMU_URL: ALAP }, kezdet: TS_OKT, vendegId: '3393366', most: MOST }), { ok: false, mi: 'nincs_beallitva' });
    assert.deepEqual(await jeloles({ env: env({ SALONIC_JELOLES: '0' }) }), { ok: false, mi: 'nincs_beallitva' });
    assert.equal(kerelmek.length, 0);
  });

  test('ervenytelen bemenet (multbeli / tavoli idopont, hibas vendeg-azonosito) -> nincs halozati forgalom', async () => {
    for (const x of [{ kezdet: Date.UTC(2026, 0, 1) / 1000 }, { kezdet: Date.UTC(2030, 0, 1) / 1000 }, { kezdet: 'x' }, { vendegId: 'abc' }, { vendegId: '' }, { vendegId: '12' }, { vendegId: '1; DROP' }]) {
      const r = await jeloles(x);
      assert.equal(r.ok, false, JSON.stringify(x));
    }
    assert.equal(kerelmek.length, 0);
  });

  test('rossz jelszo / sikertelen belepes -> belepes, semmi nem tortenik; a jelszo nem kerul a naploba', async () => {
    const naplo = [];
    const eredeti = console.error; console.error = (...a) => naplo.push(a.join(' '));
    try {
      allapot.belepesRossz = true;
      assert.deepEqual(await jeloles(), { ok: false, mi: 'belepes' });
    } finally { console.error = eredeti; }
    assert.ok(!kerelmek.some((k) => k.ut.startsWith('/onlineBookings')));
    assert.ok(naplo.length > 0);
    assert.ok(!naplo.join('\n').includes(JELSZO));
  });

  test('ha az urlapon nincs "nincs ertesites" (0) opcio, NEM ir (a vendeg ertesitest kaphatna)', async () => {
    allapot.ertesites = ['1', '2'];
    const r = await jeloles();
    assert.deepEqual(r, { ok: false, mi: 'nincs_nem_ertesit' });
    assert.equal(allapot.mentesek.length, 0);
  });

  test('ha a mentes nem tart (a szerver nem irja at), a visszaolvasas jelzi: nem_mentodott', async () => {
    allapot.nemMent = true;
    assert.deepEqual(await jeloles(), { ok: false, mi: 'nem_mentodott' });
  });

  test('a Salonic nem valaszol / hibat ad -> nem dob kivetelt, hiba / belepes', async () => {
    const r = await salonicJeloles({ env: env(), kezdet: TS_OKT, vendegId: '3393366', most: MOST, fetchFv: async () => { throw new Error('halozati hiba'); } });
    assert.deepEqual(r, { ok: false, mi: 'hiba' });
  });

  test('a SALONIC_PMU_URL csak loopback lehet (eles kornyezetben nem iranyithato at idegen hostra)', async () => {
    const hivott = [];
    await salonicJeloles({ env: { SALONIC_PMU_JELSZO: JELSZO, SALONIC_PMU_URL: 'https://rossz.example' }, kezdet: TS_OKT, vendegId: '3393366', most: MOST, fetchFv: async (url) => { hivott.push(String(url)); return new Response('', { status: 500 }); } });
    assert.ok(hivott.length && hivott.every((u) => u.startsWith('https://app.salonic.hu/')), hivott.join(','));
  });
});
