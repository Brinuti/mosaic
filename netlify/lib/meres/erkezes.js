// QA-2 erkezesi adatok (3. pont): PLATFORMONKENT KULON utolso kattintas + idobelyeg (Google: gclid / gbraid / wbraid; Meta: fbc; TikTok: ttclid), az ELSO es az UTOLSO erintes UTM-je,
// _fbp, _ttp, GA4 client_id + session_id. A bongeszo (assets/js/attribucio.js) allitja ossze es kuldi (/api/meres-erkezes); a szerver ITT tisztitja: csak ervenyes alakot fogad el.
// Szemelyes adat nincs benne (a kattintasazonositok es a sutik pszeudonim technikai azonositok).

const MA = (now) => Math.floor(now / 1000);
const MINTA = {
  gclid: /^[A-Za-z0-9_-]{10,200}$/, gbraid: /^[A-Za-z0-9_-]{10,200}$/, wbraid: /^[A-Za-z0-9_-]{10,200}$/,
  fbclid: /^[A-Za-z0-9_-]{8,200}$/, ttclid: /^[A-Za-z0-9_.-]{8,200}$/,
  fbc: /^fb\.[0-2]\.\d{10,13}\.[A-Za-z0-9_-]{8,200}$/, fbp: /^fb\.[0-2]\.\d{10,13}\.\d{5,20}$/, ttp: /^[A-Za-z0-9._-]{10,120}$/,
  ga_client: /^\d{4,12}\.\d{9,11}$/, ga_session: /^\d{9,11}$/, ga_mid: /^G-[A-Z0-9]{6,12}$/,
};
const UTM_KULCSOK = ['source', 'medium', 'campaign', 'term', 'content'];
const szoveg = (v, max = 120) => { const s = String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim(); return s ? s.slice(0, max) : null; };
function ido(v, now) { const n = Number(v); return Number.isFinite(n) && n > 1_500_000_000 && n <= MA(now) + 300 && n >= MA(now) - 120 * 86400 ? Math.floor(n) : null; }
const kattintas = (be, kulcs, now) => { const o = be && be[kulcs]; return o && typeof o.ertek === 'string' && MINTA[kulcs].test(o.ertek) ? { ertek: o.ertek, ts: ido(o.ts, now) } : null; };
function utmTisztit(u, now) {
  if (!u || typeof u !== 'object') return null;
  const o = {}; for (const k of UTM_KULCSOK) { const v = szoveg(u[k]); if (v) o[k] = v; }
  if (!Object.keys(o).length) return null; o.ts = ido(u.ts, now); return o;
}

/** A bongeszo "mhAttr" objektuma -> tisztitott, szerver-oldali alak. Ismeretlen / hibas mezot eldob (hibak: a naplohoz). */
export function erkezesTisztit(be, now = Date.now()) {
  const hibak = [];
  if (!be || typeof be !== 'object') return { adat: {}, hibak: ['nincs erkezesi adat'] };
  const g = {}; for (const k of ['gclid', 'gbraid', 'wbraid']) { const v = kattintas(be.google, k, now); if (v) g[k] = v; else if (be.google && be.google[k]) hibak.push('ervenytelen ' + k); }
  const meta = {};
  if (be.meta && typeof be.meta.fbc === 'string' && MINTA.fbc.test(be.meta.fbc)) meta.fbc = be.meta.fbc; else if (be.meta && be.meta.fbc) hibak.push('ervenytelen fbc');
  if (be.meta && typeof be.meta.fbclid === 'string' && MINTA.fbclid.test(be.meta.fbclid)) meta.fbclid = be.meta.fbclid;
  if (meta.fbc || meta.fbclid) meta.ts = ido(be.meta.ts, now);
  const tt = {}; const ttc = kattintas(be.tiktok, 'ttclid', now); if (ttc) tt.ttclid = ttc; else if (be.tiktok && be.tiktok.ttclid) hibak.push('ervenytelen ttclid');
  const adat = {};
  if (Object.keys(g).length) adat.google = g;
  if (Object.keys(meta).length) adat.meta = meta;
  if (Object.keys(tt).length) adat.tiktok = tt;
  const elso = utmTisztit(be.utm_elso, now), utolso = utmTisztit(be.utm_utolso, now);
  if (elso) adat.utm_elso = elso; if (utolso) adat.utm_utolso = utolso;
  if (typeof be.fbp === 'string') { if (MINTA.fbp.test(be.fbp)) adat.fbp = be.fbp; else hibak.push('ervenytelen fbp'); }
  if (typeof be.ttp === 'string') { if (MINTA.ttp.test(be.ttp)) adat.ttp = be.ttp; else hibak.push('ervenytelen ttp'); }
  const ga = be.ga4;
  if (ga && typeof ga === 'object') {
    const o = {}; if (MINTA.ga_client.test(String(ga.client_id || ''))) o.client_id = ga.client_id; if (MINTA.ga_session.test(String(ga.session_id || ''))) o.session_id = String(ga.session_id); if (MINTA.ga_mid.test(String(ga.measurement_id || ''))) o.measurement_id = ga.measurement_id;
    if (Object.keys(o).length) adat.ga4 = o;
  }
  return { adat, hibak };
}

/** A Google-kattintas: a legfrissebb a gclid / wbraid / gbraid kozul (a Google csak egyet fogad el egy konverziohoz). -> { tipus, ertek, ts } | null */
export function googleKattintas(erk) {
  const g = (erk && erk.google) || {};
  const lista = ['gclid', 'wbraid', 'gbraid'].filter((k) => g[k]).map((k) => ({ tipus: k, ertek: g[k].ertek, ts: g[k].ts || 0 }));
  return lista.sort((a, b) => b.ts - a.ts)[0] || null;
}
/** Meta fbc: a bongeszo sutijabol (fbc), tartalekban az fbclid-bol: fb.1.<ido ms>.<fbclid>. */
export function metaFbc(erk) {
  const m = (erk && erk.meta) || {};
  if (m.fbc) return m.fbc;
  return m.fbclid && m.ts ? `fb.1.${m.ts * 1000}.${m.fbclid}` : null;
}
