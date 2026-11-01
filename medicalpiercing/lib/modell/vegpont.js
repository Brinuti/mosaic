// A modellkereso napok (ingyenes piercing, oktatasi gyakorlonap) vegpontjai: JSON API (/api/modell/*), a foglalas oldala (/mf/<kod>), a level-kuldes es az idozitett teendok.
// Kapcsolo: MODELL_FOGLALAS ("be" = eles foglalas; alapbol KI a vegleges inditasig). Az elonezeti cimeken (*.pages.dev) a foglalas mindig megy, de a sorok "elonezet" kornyezetuek,
// nem foglalnak helyet az eles savokbol, es level SOHA nem megy ki. MODELL_FELSZABADITAS = "be": a 12 oraval a szuras elott sem megerositett foglalas felszabadul (alapbol ki).
import { nevTisztit, emailTisztit, telefonTisztit, szabad, foglal, foglalasLekerdez, megerosit, lemond, ajanlatElfogad, varolistaFelvesz, lejartAjanlatok, megerositetlenek, beallitas, osszesites, sema, adatTorles, MAX_PROBA, szolitas } from './tarolo.js';
import { level } from './levelek.js';
import { NAPOK, TIPUSOK, nap as napKeres, tipus as tipusKeres, sav as savKeres, erkezesIdo, HELYSZIN } from './beosztas.js';

const ELES_HOST = /^(www\.)?medicalpiercing\.hu$/;
export const kornyezet = (url) => (ELES_HOST.test(new URL(url).hostname) ? 'eles' : 'elonezet');
export const nyitva = (env, korny) => korny === 'elonezet' || String(env.MODELL_FOGLALAS || '').toLowerCase() === 'be';
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });
const sha256 = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s))))].map((x) => x.toString(16).padStart(2, '0')).join('');
const maiSo = (env) => String(env.MODELL_SO || env.MP_MERES_ADMIN_KULCS || 'modell');
const ipHash = async (request, env) => { const ip = request.headers.get('cf-connecting-ip'); return ip ? (await sha256(`${maiSo(env)}|${ip}`)).slice(0, 24) : null; };

/** Az urlap kulon vezeteknev / keresztnev mezoibol a teljes nev (magyar sorrend: vezetek kereszt) es a megszolitas; regi `nev` mezo is elfogadott. */
function nevMezok(t) {
  const v = String(t.vezeteknev || '').trim(), k = String(t.keresztnev || '').trim();
  return v || k ? { nev: `${v} ${k}`.trim(), kereszt: k || null } : { nev: t.nev, kereszt: null };
}

async function torzOlvas(request, max = 4096) {
  const hossz = Number(request.headers.get('content-length') || 0);
  if (hossz > max) return null;
  try { const t = await request.text(); return t.length <= max ? JSON.parse(t) : null; } catch { return null; }
}

// ---- level-kuldes -------------------------------------------------------------------------------------------------------------------------------------
/** SMTP-kuldo (a projekt Gmail-fiokja, mint a tobbi MP-level). Tesztben kicserelheto. */
export async function smtpKuldo(env) {
  const { WorkerMailer } = await import('worker-mailer');
  const user = env.SMTP_USER || 'medicalpiercing.hu@gmail.com';
  const port = Number(env.SMTP_PORT || 465);
  let posta = null;
  const kuld = async ({ to, subject, html, text }) => {
    if (!posta) posta = await WorkerMailer.connect({ host: env.SMTP_HOST || 'smtp.gmail.com', port, secure: port === 465, startTls: port !== 465, credentials: { username: user, password: String(env.SMTP_PASS).replace(/\s+/g, '') }, authType: 'plain' });
    try { await posta.send({ from: { name: 'Medical Piercing', email: user }, to, reply: user, subject, html, ...(text ? { text } : {}) }); } catch (e) { try { await posta.close(); } catch { /* mar lezarult */ } posta = null; throw e; }
  };
  kuld.zar = async () => { if (posta) { try { await posta.close(); } catch { /* mar lezarult */ } posta = null; } };
  return kuld;
}

/** Az esedekes levelek kikuldese. Elonezeti sorokat nem kuld ki (csak "teszt"-nek jeloli). Visszaad: { elkuldve, kihagyva, hiba }. */
export async function kuldEsedekes(db, korny, kuld, most = Math.floor(Date.now() / 1000)) {
  await sema(db);
  const { results: sorok } = await db.prepare(`UPDATE modell_uzenet SET allapot = 'kuldes', probak = probak + 1 WHERE id IN (SELECT id FROM modell_uzenet WHERE kornyezet = ?1 AND allapot = 'varakozik' AND kuldes_ido <= ?2 AND probak < ?3 ORDER BY kuldes_ido LIMIT 20) AND allapot = 'varakozik' RETURNING *`).bind(korny, most, MAX_PROBA).all();
  let elkuldve = 0, kihagyva = 0, hiba = 0;
  for (const u of [...(sorok || [])].sort((a, b) => a.kuldes_ido - b.kuldes_ido)) {
    const lezar = (allapot, h = null) => db.prepare('UPDATE modell_uzenet SET allapot = ?2, elkuldve = ?3, hiba = ?4 WHERE id = ?1').bind(u.id, allapot, allapot === 'elkuldve' ? most : null, h).run();
    try {
      const f = await foglalasLekerdez(db, u.foglalas_id);
      const aktiv = f && ['aktiv', 'tartva'].includes(f.allapot);
      // allapotfuggo kihagyas: lemondott / felszabadult foglalasnak nincs emlekezteto; a megerosito kerelem csak a meg nem erositettnek kell; az ajanlat csak tartott helyre
      const kihagy = !f
        || (['t0', 'm48', 'm24'].includes(u.tipus) && f.allapot !== 'aktiv')
        || (u.tipus === 'm48' && f.megerositve)
        || (u.tipus === 'felajanlas' && f.allapot !== 'tartva')
        || (['lemondas', 'felszabadult'].includes(u.tipus) && aktiv);
      if (kihagy) { await lezar('kihagyva'); kihagyva += 1; continue; }
      if (korny !== 'eles') { await lezar('teszt'); kihagyva += 1; continue; }
      if (!kuld) { await db.prepare(`UPDATE modell_uzenet SET allapot = 'varakozik', probak = MAX(probak - 1, 0), hiba = 'nincs kuldo' WHERE id = ?1`).bind(u.id).run(); continue; }
      const l = level(u.tipus, f);
      await kuld({ to: f.email, subject: l.targy, html: l.html, text: l.szoveg });
      await lezar('elkuldve'); elkuldve += 1;
    } catch (e) {
      const veg = u.probak >= MAX_PROBA;
      await db.prepare('UPDATE modell_uzenet SET allapot = ?2, hiba = ?3 WHERE id = ?1').bind(u.id, veg ? 'hiba' : 'varakozik', String((e && e.message) || e).slice(0, 300)).run();
      hiba += 1;
    }
  }
  return { elkuldve, kihagyva, hiba };
}

/** Idozitett teendok: lejart ajanlatok, (kapcsolhato) felszabaditas, esedekes levelek. */
export async function tick(db, env, korny, kuld, most = Math.floor(Date.now() / 1000)) {
  await sema(db);
  const lejart = await lejartAjanlatok(db, korny, most);
  const felszabaditva = String(env.MODELL_FELSZABADITAS || '').toLowerCase() === 'be' ? await megerositetlenek(db, korny, most, 12) : 0;
  const torolve = await adatTorles(db, most);   // 30 nappal a rendezveny utan: minden szemelyes adat torlese
  return { lejart, felszabaditva, torolve, ...(await kuldEsedekes(db, korny, kuld, most)) };
}

/** A latogatok kerese nyitja meg: legfeljebb 5 percenkent lefuttatja a tick-et (az eles kornyezetben, ha van SMTP). Nincs kulso utemezo: a kampany forgalma hajtja. */
async function tickHaKell(db, env, korny, waitUntil, most = Math.floor(Date.now() / 1000)) {
  if (korny !== 'eles' || !env.SMTP_PASS) return;
  const r = await db.prepare(`INSERT INTO modell_beallitas (kulcs, ertek) VALUES ('utolso_tick', ?1) ON CONFLICT(kulcs) DO UPDATE SET ertek = excluded.ertek WHERE CAST(modell_beallitas.ertek AS INTEGER) <= ?2`).bind(String(most), most - 300).run();
  if (!Number(r?.meta?.changes || 0)) return;
  const munka = (async () => { const kuld = await smtpKuldo(env); try { await tick(db, env, korny, kuld, most); } finally { await kuld.zar(); } })().catch((e) => console.error('modell tick', e && e.message));
  if (waitUntil) waitUntil(munka); else await munka;
}

// ---- JSON API -----------------------------------------------------------------------------------------------------------------------------------------
export async function api(request, env, { waitUntil, most = Math.floor(Date.now() / 1000) } = {}) {
  const url = new URL(request.url);
  const akcio = url.pathname.replace(/^\/api\/modell\/?/, '').replace(/\/$/, '');
  const korny = kornyezet(request.url);
  const db = env.MP_MERES_DB;
  if (!db) return json({ ok: false, hiba: 'nincs_adatbazis' }, 503);
  await sema(db);
  const ki = nyitva(env, korny);
  const kuldesre = async () => { if (korny !== 'eles' || !env.SMTP_PASS) return; const kuld = await smtpKuldo(env); try { await kuldEsedekes(db, korny, kuld, Math.floor(Date.now() / 1000)); } finally { await kuld.zar(); } };
  const hatterben = (p) => { const m = p.catch((e) => console.error('modell kuldes', e && e.message)); if (waitUntil) waitUntil(m); return m; };

  if (akcio === 'szabad' && request.method === 'GET') {
    const sz = await szabad(db, korny);
    hatterben(tickHaKell(db, env, korny, waitUntil, most));
    return json({ ok: true, nyitva: ki, kornyezet: korny, ...sz });
  }
  if (akcio === 'foglal' && request.method === 'POST') {
    if (!ki) return json({ ok: false, hiba: 'zarva' }, 403);
    const t = await torzOlvas(request);
    if (!t) return json({ ok: false, hiba: 'hibas_keres' }, 400);
    if (t.csapda) return json({ ok: true, id: 'x'.repeat(20) });   // robot: csendben elnyeljuk
    if (t.elfogad !== true || t.elmult18 !== true) return json({ ok: false, hiba: 'hianyzo_hozzajarulas' }, 400);
    if (savKeres(String(t.nap || ''), String(t.tipus || ''), String(t.ido || ''))?.szerep === 'tartalek' && t.tartalek !== true) return json({ ok: false, hiba: 'hianyzo_tartalek_tudomas' }, 400);   // a tartalek helyet csak a kockazat tudomasulvetelevel lehet foglalni
    const r = await foglal(db, { korny, nap: String(t.nap || ''), tipus: String(t.tipus || ''), ido: String(t.ido || ''), ...nevMezok(t), email: t.email, telefon: t.telefon, ipHash: await ipHash(request, env), forras: String(t.forras || '').slice(0, 60) || null, most });
    if (!r.ok) return json(r, r.hiba === 'foglalt' || r.hiba === 'nincs_elsodleges' || r.hiba === 'mar_van' ? 409 : r.hiba === 'tul_sok' ? 429 : 400);
    hatterben(kuldesre());
    return json({ ok: true, id: r.id, link: `/mf/${r.id}` });
  }
  if (akcio === 'varolista' && request.method === 'POST') {
    if (!ki) return json({ ok: false, hiba: 'zarva' }, 403);
    const t = await torzOlvas(request);
    if (!t) return json({ ok: false, hiba: 'hibas_keres' }, 400);
    if (t.csapda) return json({ ok: true });
    if (t.elfogad !== true) return json({ ok: false, hiba: 'hianyzo_hozzajarulas' }, 400);
    const r = await varolistaFelvesz(db, { korny, tipus: String(t.tipus || ''), nap: t.nap ? String(t.nap) : null, ...nevMezok(t), email: t.email, telefon: t.telefon, most });
    if (r.ok) hatterben(kuldesre());
    return json(r.ok ? { ok: true, mar: !!r.mar } : r, r.ok ? 200 : 400);
  }
  if (akcio === 'foglalas' && request.method === 'GET') {
    const f = await foglalasLekerdez(db, url.searchParams.get('id'));
    return f ? json({ ok: true, foglalas: nyilvanos(f) }) : json({ ok: false, hiba: 'nincs' }, 404);
  }
  if (akcio === 'muvelet' && request.method === 'POST') {
    const t = await torzOlvas(request);
    if (!t) return json({ ok: false, hiba: 'hibas_keres' }, 400);
    const id = String(t.id || '');
    const r = t.akcio === 'megerosit' ? await megerosit(db, id, most) : t.akcio === 'lemond' ? await lemond(db, id, most) : t.akcio === 'elfogad' ? await ajanlatElfogad(db, id, most) : { ok: false, hiba: 'ismeretlen_akcio' };
    if (r.ok) hatterben(kuldesre());
    return json(r.ok ? { ok: true, foglalas: nyilvanos(r.foglalas) } : { ok: false, hiba: r.hiba, foglalas: r.foglalas ? nyilvanos(r.foglalas) : undefined }, r.ok ? 200 : r.hiba === 'nincs' ? 404 : 409);
  }
  // kulcsos: tick, admin, level-minta
  if (['tick', 'admin', 'level-minta'].includes(akcio)) {
    if (akcio === 'level-minta' && korny === 'elonezet') {   // elonezeten kulcs nelkul is: a levelek kinezetenek ellenorzesehez (mintaadat, nincs szemelyes adat)
      const tipus = url.searchParams.get('tipus') || 't0';
      const minta = { id: 'mintaazonosito00000001', nap: '2026-11-25', tipus: 'orr', ido: '10:12', nev: 'Minta Anna', kereszt: 'Anna', megerositve: url.searchParams.get('megerositve') === '1' ? 1 : null };
      try { const l = level(tipus, minta, { alap: '' }); return new Response(url.searchParams.get('szoveg') ? l.szoveg : l.html, { headers: { 'content-type': url.searchParams.get('szoveg') ? 'text/plain; charset=utf-8' : 'text/html; charset=utf-8', 'x-robots-tag': 'noindex' } }); } catch { return json({ ok: false, hiba: 'ismeretlen_level' }, 400); }
    }
    if (!env.MP_MERES_ADMIN_KULCS) return json({ ok: false }, 404);
    if (request.headers.get('x-mp-kulcs') !== env.MP_MERES_ADMIN_KULCS) return json({ ok: false }, 403);
    if (akcio === 'admin') return json({ ok: true, kornyezet: korny, nyitva: ki, ...(await osszesites(db, korny)) });
    if (request.method !== 'POST') return json({ ok: false }, 405);
    if (!env.SMTP_PASS && korny === 'eles') return json({ ok: false, hiba: 'nincs_smtp' }, 503);
    const kuld = korny === 'eles' ? await smtpKuldo(env) : null;
    try { return json({ ok: true, ...(await tick(db, env, korny, kuld, most)) }); } finally { if (kuld) await kuld.zar(); }
  }
  return json({ ok: false, hiba: 'nincs_ilyen_vegpont' }, 404);
}

/** A foglalas nyilvanos adatai (a kod a kulcs): keresztnev, a sav, az allapot; e-mail / telefon nem megy ki. */
function nyilvanos(f) {
  return { id: f.id, keresztnev: szolitas(f), nap: f.nap, tipus: f.tipus, ido: f.ido, erkezes: erkezesIdo(f.ido), allapot: f.allapot, megerositve: !!f.megerositve, tartva_eddig: f.tartva_eddig || null };
}

// ---- "A foglalasod" oldal (/mf/<kod>) ----------------------------------------------------------------------------------------------------------------------
const h = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export async function foglalasOldal(request, env, { most = Math.floor(Date.now() / 1000) } = {}) {
  const url = new URL(request.url);
  const m = /^\/mf\/([a-z0-9]{12,40})\/?$/.exec(url.pathname);
  const fejlec = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' };
  if (!m || !env.MP_MERES_DB) return new Response(oldalKeret('Nem találjuk', '<h1>Nem találjuk ezt a foglalást</h1><p>Ellenőrizd a levélben kapott linket, vagy hívj minket: <a href="tel:+3619017444">+36 1 901 7444</a>.</p>'), { status: 404, headers: fejlec });
  const db = env.MP_MERES_DB;
  const f = await foglalasLekerdez(db, m[1]);
  if (!f) return new Response(oldalKeret('Nem találjuk', '<h1>Nem találjuk ezt a foglalást</h1><p>Ellenőrizd a levélben kapott linket, vagy hívj minket: <a href="tel:+3619017444">+36 1 901 7444</a>.</p>'), { status: 404, headers: fejlec });
  const n = napKeres(f.nap), t = tipusKeres(f.tipus);
  const adat = `<dl class="adat"><div><dt>Nap</dt><dd><b>${h(n ? n.cim : f.nap)}</b></dd></div><div><dt>Piercing</dt><dd>${h(t ? t.nev : f.tipus)}</dd></div><div><dt>Érkezés</dt><dd><b>${h(erkezesIdo(f.ido))}</b></dd></div><div><dt>A szúrás időpontja</dt><dd>kb. ${h(f.ido)}</dd></div><div><dt>Helyszín</dt><dd>${h(HELYSZIN.cim)} (${h(HELYSZIN.megjegyzes)})</dd></div><div><dt>Ár</dt><dd>0 Ft – az ékszert megtartod</dd></div></dl>`;
  const kod = h(f.id);
  let torzs;
  if (f.allapot === 'aktiv') {
    torzs = `<h1>${h(szolitas(f))}, a foglalásod rendben van</h1>${f.megerositve ? '<p class="jo">✓ Megerősítetted, hogy jössz. Köszönjük!</p>' : '<p>Kérjük, egy kattintással jelezd, hogy biztosan jössz.</p>'}${adat}
<div class="gombok">${f.megerositve ? '' : `<button class="gomb" data-akcio="megerosit"${url.searchParams.get('ott') ? ' data-elso="1"' : ''}>Ott leszek ✓</button>`}<button class="gomb ures" data-akcio="lemond">Lemondom</button></div>`;
  } else if (f.allapot === 'tartva' && f.tartva_eddig > most) {
    const perc = Math.max(1, Math.ceil((f.tartva_eddig - most) / 60));
    torzs = `<h1>Felszabadult egy hely!</h1><p>A várólistán voltál. Ez a hely <b>még kb. ${perc} percig a tiéd</b>: ha el tudsz jönni, fogadd el.</p>${adat}<div class="gombok"><button class="gomb" data-akcio="elfogad">Elfogadom a helyet ✓</button><button class="gomb ures" data-akcio="lemond">Nem kérem</button></div>`;
  } else if (f.allapot === 'tartva') {
    torzs = '<h1>Az ajánlat lejárt</h1><p>A hely mára másé lett. Maradsz a várólistán, ha új hely szabadul fel, jelezzük. Új foglalást <a href="/modellnap">itt</a> kezdhetsz.</p>';
  } else {
    torzs = `<h1>Ez a foglalás már nem él</h1><p>${f.allapot === 'felszabadult' ? 'A foglalás felszabadult, mert nem érkezett megerősítés.' : 'A foglalást lemondták.'} Ha még van szabad hely, <a href="/modellnap">itt</a> újra foglalhatsz.</p>`;
  }
  const script = !torzs.includes('data-akcio="') ? '' : `<script>(function(){var kod=${JSON.stringify(f.id)};var u=document.getElementById('uzenet');function uz(t,jo){u.className=jo?'jo':'rossz';u.textContent=t;}
document.querySelectorAll('[data-akcio]').forEach(function(b){b.addEventListener('click',function(){var a=b.getAttribute('data-akcio');if(a==='lemond'&&!confirm('Biztosan lemondod a helyed?'))return;b.disabled=true;
fetch('/api/modell/muvelet',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:kod,akcio:a})}).then(function(r){return r.json()}).then(function(j){if(j.ok){location.reload();}else{b.disabled=false;uz(j.hiba==='lejart'?'Az ajánlat lejárt.':'Nem sikerült. Hívj minket: +36 1 901 7444.',false);}}).catch(function(){b.disabled=false;uz('Nincs kapcsolat. Próbáld újra, vagy hívj minket: +36 1 901 7444.',false);});});});
var e=document.querySelector('[data-elso]');if(e){e.focus();}})();</script>`;
  return new Response(oldalKeret('A foglalásod – Medical Piercing', `${torzs}<p id="uzenet" role="status"></p><p class="lab">Kérdésed van? Hívj: <a href="tel:+3619017444">+36 1 901 7444</a> vagy írj: <a href="mailto:${HELYSZIN.email}">${HELYSZIN.email}</a></p>${script}`), { headers: fejlec });
}
function oldalKeret(cim, torzs) {
  return `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${h(cim)}</title>
<link rel="preload" as="font" type="font/woff2" crossorigin href="/assets/fonts/plus-jakarta-sans-latin.woff2">
<style>@font-face{font-family:"Plus Jakarta Sans";font-weight:400 800;font-display:swap;src:url(/assets/fonts/plus-jakarta-sans-latin-ext.woff2) format("woff2");unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C4,U+2113,U+2C60-2C7F,U+A720-A7FF}@font-face{font-family:"Plus Jakarta Sans";font-weight:400 800;font-display:swap;src:url(/assets/fonts/plus-jakarta-sans-latin.woff2) format("woff2");unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}body{margin:0;background:#f6ebe4;font:16px/1.6 "Plus Jakarta Sans",system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#454659}main{max-width:620px;margin:0 auto;padding:22px 16px 40px}.logo{display:block;margin:6px auto 14px;width:220px;max-width:70%}
.doboz{background:#fff;border-radius:22px;padding:24px 22px;box-shadow:0 12px 34px rgba(90,70,66,.10)}h1{margin:0 0 10px;font-size:1.5rem;line-height:1.25;color:#2f3044}p{margin:10px 0}a{color:#b0463b}.jo{color:#2f7a4d;font-weight:700}.rossz{color:#b0463b;font-weight:700}
.adat{margin:16px 0;padding:6px 16px;border:1px solid #ecdcd4;border-radius:14px;background:#fffaf7}.adat div{padding:8px 0;border-bottom:1px solid #f1e6e0}.adat div:last-child{border-bottom:0}.adat dt{font:700 .72rem/1.2 inherit;letter-spacing:.08em;text-transform:uppercase;color:#8a8b9c}.adat dd{margin:3px 0 0;overflow-wrap:anywhere}
.gombok{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}.gomb{font:700 1rem/1.2 inherit;padding:.9em 1.6em;border:2px solid #d7aba8;border-radius:999px;background:#d7aba8;color:#fff;cursor:pointer}.gomb.ures{background:#fff;color:#b0463b;border-color:#e3c4bf}.gomb:disabled{opacity:.5}.lab{margin-top:18px;font-size:.88rem;color:#8a8b9c;text-align:center}</style></head>
<body><main><a href="/"><img class="logo" src="/assets/img/uj-logo.webp" width="327" height="97" alt="Medical Piercing"></a><div class="doboz">${torzs}</div></main></body></html>`;
}

export { NAPOK, TIPUSOK };
