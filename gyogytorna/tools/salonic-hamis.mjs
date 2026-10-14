// A Salonic nyilvanos felueletenek helyi hamisitasa a tesztekhez (a rogzitett valodi oldalakbol, tools/fixtures/salonic). Foglalast nem hoz letre.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const F = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'salonic');
const olvas = (n) => fs.readFileSync(path.join(F, n), 'utf8');

/** opts.szabad: { 'placeId:serviceId:staffId': [startUnix, ...] } a naptar-API szabad idopontjai; opts.naplo: tomb a kerelmek URL-jeivel; opts.lassu: ms */
export function salonicHamis(opts = {}) {
  const naplo = opts.naplo || [];
  const szabad = opts.szabad || {};
  const foglalasok = opts.foglalasok || {}; // uuid -> { startUnix, torolve }
  return async (url, init = {}) => {
    const u = new URL(String(url));
    naplo.push(u.href);
    if (opts.lassu) await new Promise((r) => setTimeout(r, opts.lassu));
    if (opts.hiba) throw new Error('halozati hiba');
    const ok = (body, type = 'text/html', status = 200, vegso = u.href) => { const r = new Response(body, { status, headers: { 'content-type': type } }); Object.defineProperty(r, 'url', { value: vegso }); return r; };
    if (u.hostname === 'gyogytornaszomhu.salonic.hu') {
      const p = u.searchParams;
      if (u.pathname === '/selectSpecialization/') return ok(olvas(`spec_${p.get('placeId')}.html`));
      if (u.pathname === '/showServices/') return ok(olvas(`svc_${p.get('placeId')}_${p.get('specId')}.html`));
      if (u.pathname === '/employees') return ok(olvas('employees.html'));
      if (u.pathname.startsWith('/guestData')) { // a foglalo adatlapja: elutasitott idopont (opts.guestElutasit) -> atiranyitas a Salonic naptarara (mint az eloben)
        if ((opts.guestElutasit || []).includes(+p.get('startDate'))) { const r = new Response(null, { status: 302, headers: { location: `https://gyogytornaszomhu.salonic.hu/selectDate/?employeeId=${p.get('employeeId')}&placeId=${p.get('placeId')}&serviceId=${p.get('serviceId')}&startDate=${p.get('startDate')}` } }); Object.defineProperty(r, 'url', { value: u.href }); return r; }
        return ok('<html><body>adatlap</body></html>');
      }
      if (u.pathname === '/selectLocation/') return ok('<html><head></head><body>helyszinek</body></html>');
      if (u.pathname.startsWith('/selectDate/')) return ok(olvas('selectDate_8439.html'));
      const m = /^\/booking\/bookingDetails\/([0-9a-f-]{36})$/.exec(u.pathname);
      if (m) {
        const b = foglalasok[m[1]];
        if (!b) return ok('nincs', 'text/html', 404);
        if (b.torolve) return ok('torolve', 'text/html', 200, `https://gyogytornaszomhu.salonic.hu/booking/deleteSuccess/${m[1]}`);
        return ok(`<a href="/selectDate/?startDate=${b.startUnix}&amp;bookingId=${m[1]}">Foglalas modositasa</a>`);
      }
    }
    if (u.hostname === 'api.salonic.hu') {
      const p = u.searchParams;
      const kulcs = (s) => `${p.get('placeId')}:${p.get('serviceId')}:${s}`;
      const start = +p.get('startDate'), nap = +p.get('days');
      const blocks = {};
      const dolgozok = p.get('employeeId') === '-1' ? Object.keys(szabad).filter((k) => k.startsWith(`${p.get('placeId')}:${p.get('serviceId')}:`)).map((k) => k.split(':')[2]) : [p.get('employeeId')];
      for (const d of dolgozok) {
        for (const t of szabad[kulcs(d)] || []) {
          if (t < start || t >= start + nap * 86400) continue;
          const napKulcs = String(Math.floor(t / 86400) * 86400);
          blocks[napKulcs] = blocks[napKulcs] || {};
          blocks[napKulcs][d] = blocks[napKulcs][d] || { employeeName: `Munkatars ${d}`, slots: {} };
          blocks[napKulcs][d].slots[String(t)] = { timestamp: t, formatted: '', formattedFull: '' };
        }
      }
      return ok(JSON.stringify({ status: 'success', data: { placeName: 'Gyogytornaszom.hu', placeAddress: '', placePhone: '', blocks } }), 'application/json');
    }
    return ok('nincs', 'text/plain', 404);
  };
}
