// CRM API-kliens: /api/crm/..., session cookie (HttpOnly), X-CRM-CSRF minden irasnal, 401 -> vissza a belepeshez.
const ALAP = '/api/crm';

export class ApiHiba extends Error {
  constructor(status, kod, uzenet, nemElerheto = false) {
    super(uzenet || 'Hiba történt.');
    this.status = status; this.kod = kod; this.nemElerheto = nemElerheto;
  }
}

const allapot = { csrf: null, onLejart: null };
export function csrfBeallit(t) { allapot.csrf = t; }
export function lejaratFigyelo(fn) { allapot.onLejart = fn; }

function qs(p) {
  if (!p) return '';
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== null && v !== '') u.set(k, String(v));
  const s = u.toString();
  return s ? `?${s}` : '';
}

async function keres(metodus, ut, { params, body, nyers, fejlec, csendes401 = false } = {}) {
  const fej = { Accept: 'application/json', ...(fejlec || {}) };
  const opc = { method: metodus, credentials: 'same-origin', headers: fej, cache: 'no-store' };
  if (metodus !== 'GET') {
    if (allapot.csrf) fej['X-CRM-CSRF'] = allapot.csrf;
    if (nyers !== undefined) opc.body = nyers;
    else if (body !== undefined) { fej['Content-Type'] = 'application/json'; opc.body = JSON.stringify(body); }
  }
  let v;
  try { v = await fetch(`${ALAP}${ut}${qs(params)}`, opc); } catch {
    throw new ApiHiba(0, 'HALOZAT', 'A szerver nem érhető el. Ellenőrizd a kapcsolatot.');
  }
  if (v.status === 401 && !csendes401) { if (allapot.onLejart) allapot.onLejart(); throw new ApiHiba(401, 'NINCS_BELEPVE', 'A munkamenet lejárt, jelentkezz be újra.'); }
  const tipus = v.headers.get('content-type') || '';
  if (!v.ok) {
    let hiba = null;
    if (tipus.includes('json')) { try { hiba = (await v.json()).hiba; } catch { hiba = null; } }
    const nincs = v.status === 501 || v.status === 404 && !hiba || v.status === 405 || (v.status === 404 && hiba && hiba.kod === 'NINCS_VEGPONT');
    const e = new ApiHiba(v.status, hiba && hiba.kod, (hiba && hiba.uzenet) || (nincs ? 'Ez a végpont még nem érhető el.' : `Hiba (${v.status}).`), nincs);
    e.reszlet = hiba && (hiba.reszletek || hiba.reszlet || hiba.hianyok);
    throw e;
  }
  if (nyers === 'blob' || (fejlec && fejlec.__blob)) return v.blob();
  if (v.status === 204) return null;
  if (tipus.includes('json')) return v.json();
  // nem JSON valasz (pl. SPA-fallback HTML) = a vegpont nincs
  throw new ApiHiba(v.status, 'NEM_JSON', 'Ez a végpont még nem érhető el.', true);
}

export const api = {
  get: (ut, params, o) => keres('GET', ut, { params, ...o }),
  post: (ut, body, o) => keres('POST', ut, { body, ...o }),
  put: (ut, body, o) => keres('PUT', ut, { body, ...o }),
  patch: (ut, body, o) => keres('PATCH', ut, { body, ...o }),
  del: (ut, o) => keres('DELETE', ut, o),
  /** nyers bajtok feltoltese (kep) */
  feltolt: (ut, params, blob) => keres('POST', `${ut}${qs(params)}`, { nyers: blob, fejlec: { 'Content-Type': blob.type || 'application/octet-stream' } }),
  /** fajl letoltese blobkent (pl. A5 PDF, kep) */
  blob: async (ut, params) => {
    let v;
    try { v = await fetch(`${ALAP}${ut}${qs(params)}`, { credentials: 'same-origin', cache: 'no-store' }); } catch { throw new ApiHiba(0, 'HALOZAT', 'A szerver nem érhető el.'); }
    if (v.status === 401) { if (allapot.onLejart) allapot.onLejart(); throw new ApiHiba(401, 'NINCS_BELEPVE', 'A munkamenet lejárt.'); }
    if (!v.ok) throw new ApiHiba(v.status, 'HIBA', v.status === 404 || v.status === 501 ? 'Ez a fájl még nem érhető el.' : `Hiba (${v.status}).`, v.status === 501);
    return v.blob();
  },
  url: (ut, params) => `${ALAP}${ut}${qs(params)}`,
  /** belepes elotti hivasok: a 401 nem dob ki */
  elo: {
    get: (ut, params) => keres('GET', ut, { params, csendes401: true }),
    post: (ut, body) => keres('POST', ut, { body, csendes401: true }),
  },
};
