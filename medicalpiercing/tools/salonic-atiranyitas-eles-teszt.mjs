// Eles ellenorzes: a Salonic-oldalak atiranyitasa a valodi GTM-KMNT72W6-tal. Valodi foglalas NELKUL, merokeresek eldobva.
import { chromium, webkit, devices } from './pw.mjs';
import { MERES } from './meres-tiltas.mjs';

const SAL = 'https://medicalpiercing.salonic.hu';
const MP = 'https://www.medicalpiercing.hu';
const GTM_OK = /googletagmanager\.com\/gtm\.js\?id=GTM-KMNT72W6/;
let hiba = 0;
const ok = (nev, felt, info = '') => { console.log(`${felt ? 'OK  ' : 'HIBA'} ${nev}${info ? '  ' + info : ''}`); if (!felt) hiba++; };

async function futas(tipus, nev, opts) {
  const b = await tipus.launch();
  const ctx = await b.newContext(opts);
  const nyom = { meres: [], gtm: 0, atir: 0, salNemGet: [], post: [] };
  await ctx.route('**/*', async (r) => {
    const u = r.request().url(), m = r.request().method();
    if (GTM_OK.test(u)) { nyom.gtm++; return r.continue(); }
    if (MERES.test(u)) { nyom.meres.push(u.slice(0, 80)); return r.abort(); }
    if (u.startsWith(SAL) && m !== 'GET') { nyom.salNemGet.push(m + ' ' + u.slice(0, 80)); return r.abort(); }
    if (u.startsWith(MP + '/api/') && m !== 'GET') { nyom.post.push(m + ' ' + u.slice(0, 80)); return r.fulfill({ status: 204, body: '' }); }
    if (u.includes('/assets/salonic/atiranyitas.js')) nyom.atir++;
    return r.continue();
  });
  const p = await ctx.newPage();
  const vegCim = async (cim) => { await p.goto(cim, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(6000); return p.url(); };
  const qs = (u) => Object.fromEntries(new URL(u).searchParams);

  let u = await vegCim(SAL + '/selectLocation?fbclid=test&utm_source=test');
  let q = qs(u);
  ok(`${nev}: /selectLocation -> /idopontfoglalas, fbclid+utm megmarad`, u.startsWith(MP + '/idopontfoglalas') && q.fbclid === 'test' && q.utm_source === 'test' && q.mp_honnan === 'salonic', u);

  u = await vegCim(SAL + '/showServices/?employeeId=13509&placeId=6029&serviceId=0&fbclid=test&utm_source=test');
  q = qs(u);
  ok(`${nev}: /showServices/ -> motor, placeId/employeeId + fbclid/utm megmarad`, u.startsWith(MP + '/idopontfoglalas') && q.placeId === '6029' && q.employeeId === '13509' && q.fbclid === 'test' && q.utm_source === 'test', u);
  const motor = await p.evaluate(() => !!document.querySelector('iframe, [class*="motor"], #motor, [data-motor]'));
  ok(`${nev}: a motor-oldal betolt (nincs hurok)`, motor && p.url().startsWith(MP), p.url());

  u = await vegCim(SAL + '/selectLocation?mp_nincs_atiranyitas=1&fbclid=test');
  ok(`${nev}: kikerulo parameter: marad a Salonicon`, u.startsWith(SAL + '/selectLocation'), u);

  u = await vegCim(SAL + '/booking/cancelBooking/?id=1');
  ok(`${nev}: /booking/cancelBooking/ (foglalas-kezelo): nem iranyit at`, u.startsWith(SAL), u);
  u = await vegCim(SAL + '/guestData/?placeId=6029&serviceId=1&employeeId=-1&startDate=1792300000&lang=hu');
  ok(`${nev}: /guestData/ (adatlap) legfelso ablakban: nem iranyit at`, u.startsWith(SAL), u);

  // keret: a sajat oldalunkon (www.medicalpiercing.hu) iframe-ben a Salonic-oldalak nem iranyitanak at
  await p.goto(MP + '/idopontfoglalas', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(3000);
  ok(`${nev}: www.medicalpiercing.hu/idopontfoglalas: marad (nincs atiranyitas)`, p.url().startsWith(MP + '/idopontfoglalas'), p.url());
  await p.evaluate(({ SAL }) => { for (const [id, h] of [['t1', '/selectLocation?fbclid=test'], ['t2', '/guestData/?placeId=6029&serviceId=1&employeeId=-1&startDate=1792300000&lang=hu']]) { const f = document.createElement('iframe'); f.name = id; f.src = SAL + h; f.style.cssText = 'width:400px;height:400px'; document.body.appendChild(f); } }, { SAL });
  await p.waitForTimeout(8000);
  for (const id of ['t1', 't2']) {
    const fr = p.frames().find((f) => f.name() === id);
    ok(`${nev}: keretben (${id === 't1' ? '/selectLocation' : '/guestData/'}) a Salonic marad`, !!fr && fr.url().startsWith(SAL), fr?.url());
  }
  ok(`${nev}: a GTM-KMNT72W6 betoltott a Salonicon`, nyom.gtm > 0, `gtm.js: ${nyom.gtm}, atiranyitas.js: ${nyom.atir}`);
  ok(`${nev}: Salonic fele csak GET`, nyom.salNemGet.length === 0, nyom.salNemGet.join(', '));
  console.log(`  ${nev}: eldobott merokeresek: ${nyom.meres.length}; helyben valaszolt /api/ nem-GET: ${nyom.post.length}`);
  await b.close();
}

await futas(chromium, 'chromium/asztali', {});
await futas(webkit, 'webkit/iPhone 13', { ...devices['iPhone 13'] });
console.log(hiba ? `\nHIBA: ${hiba}` : '\nMinden OK');
process.exit(hiba ? 1 : 0);
