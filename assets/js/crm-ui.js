// CRM UI-segedek: elem-epito (SOHA innerHTML), formazok, allapot-megjelenitok, parbeszed, ertesites.
// A vendeg altal beirt szoveg kizarolag textContent / createTextNode utjan kerul az oldalra.

/** h('div', {class:'x', onclick: fn, dataset:{a:1}}, 'szoveg', elem, [lista]) */
export function h(tag, attrs, ...gyerekek) {
  const e = document.createElement(tag);
  if (attrs && typeof attrs === 'object' && !(attrs instanceof Node) && !Array.isArray(attrs)) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'dataset') Object.assign(e.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if (k === 'value') e.value = v;
      else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'hidden' || k === 'required' || k === 'multiple') { if (v) e[k] = true; }
      else if (v === true) e.setAttribute(k, '');
      else e.setAttribute(k, String(v));
    }
  } else if (attrs !== undefined && attrs !== null) gyerekek.unshift(attrs);
  hozzafuz(e, gyerekek);
  return e;
}
function hozzafuz(e, lista) {
  for (const g of lista.flat(Infinity)) {
    if (g === null || g === undefined || g === false) continue;
    e.append(g instanceof Node ? g : document.createTextNode(String(g)));
  }
}
export function urit(e) { while (e.firstChild) e.removeChild(e.firstChild); return e; }
export function tolt(e, ...gyerekek) { urit(e); hozzafuz(e, gyerekek); return e; }

// ---- formazok -----------------------------------------------------------------------------------------------------------------------------
const NBSP = ' ';
/** 29900 -> "29 900 Ft" (nem torheto szokozzel) */
export function ft(n) {
  if (n === null || n === undefined || n === '' || Number.isNaN(Number(n))) return '–';
  const s = String(Math.round(Math.abs(Number(n)))).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return `${Number(n) < 0 ? '−' : ''}${s}${NBSP}Ft`;
}
const TZ = 'Europe/Budapest';
const fmtDatum = new Intl.DateTimeFormat('hu-HU', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const fmtIdo = new Intl.DateTimeFormat('hu-HU', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });
const fmtISO = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const msOf = (t) => (t === null || t === undefined || t === '' ? null : (typeof t === 'number' ? (t < 1e11 ? t * 1000 : t) : Date.parse(t)));
export function datum(t) { const m = msOf(t); return m === null || Number.isNaN(m) ? '–' : fmtDatum.format(new Date(m)); }
export function ido(t) { const m = msOf(t); return m === null || Number.isNaN(m) ? '–' : fmtIdo.format(new Date(m)); }
export function datumIdo(t) { const m = msOf(t); return m === null || Number.isNaN(m) ? '–' : `${fmtDatum.format(new Date(m))} ${fmtIdo.format(new Date(m))}`; }
/** budapesti naptari nap YYYY-MM-DD */
export function isoNap(t = Date.now()) { const m = msOf(t); return fmtISO.format(new Date(m)); }
export function napEltolas(iso, nap) { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + nap); return d.toISOString().slice(0, 10); }
export function szazalek(x) { if (x === null || x === undefined || Number.isNaN(Number(x))) return '–'; const v = Number(x) * 100; return `${(Math.round(v * 10) / 10).toString().replace('.', ',')}${NBSP}%`; }

/** objektumbol az elso letezo mezo */
export function pick(o, ...kulcsok) { if (!o) return undefined; for (const k of kulcsok) if (o[k] !== undefined && o[k] !== null) return o[k]; return undefined; }
/** valaszbol lista: tomb vagy valasz[kulcs] vagy az elso tomb-mezo */
export function lista(v, ...kulcsok) {
  if (Array.isArray(v)) return v;
  if (!v || typeof v !== 'object') return [];
  for (const k of kulcsok) if (Array.isArray(v[k])) return v[k];
  for (const x of Object.values(v)) if (Array.isArray(x)) return x;
  return [];
}
export function humanizal(k) { const s = String(k).replace(/_/g, ' ').trim(); return s.charAt(0).toUpperCase() + s.slice(1); }

// ---- allapotok ----------------------------------------------------------------------------------------------------------------------------
export function betoltAllapot(szoveg = 'Betöltés…') { return h('div', { class: 'allapot allapot-betolt', role: 'status' }, h('span', { class: 'forgo', 'aria-hidden': 'true' }), szoveg); }
export function uresAllapot(szoveg, tipp) { return h('div', { class: 'allapot allapot-ures' }, h('p', null, szoveg), tipp ? h('p', { class: 'halvany' }, tipp) : null); }
export function hibaAllapot(hiba, ujra) {
  const nemElerheto = hiba && hiba.nemElerheto;
  return h('div', { class: `allapot allapot-hiba${nemElerheto ? ' allapot-nincs' : ''}`, role: 'alert' },
    h('strong', null, nemElerheto ? 'Ez a funkció még nem érhető el' : (hiba && hiba.status === 403 ? 'Nincs jogosultság' : 'Hiba történt')),
    h('p', null, nemElerheto ? 'A szerver ezt a végpontot még nem szolgálja ki. Az adatok később jelennek meg itt.' : (hiba && hiba.message) || 'Ismeretlen hiba.'),
    ujra ? h('button', { type: 'button', class: 'gomb', onclick: ujra }, 'Újrapróbálás') : null);
}
/** async muvelet futtatasa betoltes-/hiba-allapottal a celelemben */
export async function toltes(cel, fn) {
  tolt(cel, betoltAllapot());
  try { const ered = await fn(); urit(cel); return ered; } catch (e) {
    if (e && e.status === 401) throw e;
    tolt(cel, hibaAllapot(e, () => toltes(cel, fn)));
    return undefined;
  }
}

// ---- kis komponensek ----------------------------------------------------------------------------------------------------------------------
export function jelveny(szoveg, hang = '') { return h('span', { class: `jelveny${hang ? ` jelveny-${hang}` : ''}` }, szoveg); }
export function rvJelzo(szoveg = 'REQUIRES_VERIFICATION') { return h('span', { class: 'jelveny jelveny-rv', title: 'Szakmai / jogi ellenőrzésre vár: nem végleges tartalom.' }, szoveg); }
export function figyelmeztetes(hang, ...gyerekek) { return h('div', { class: `figyelem figyelem-${hang}`, role: hang === 'veszely' ? 'alert' : 'note' }, gyerekek); }
export function kartya(cim, ...gyerekek) { return h('section', { class: 'kartya' }, cim ? h('h3', null, cim) : null, gyerekek); }
export function oldalCim(cim, ...jobb) { return h('div', { class: 'oldalcim' }, h('h1', { tabindex: '-1', id: 'oldalcim' }, cim), h('div', { class: 'oldalcim-jobb' }, jobb)); }
export function adatsor(par) { // [[felirat, ertek], ...]
  return h('dl', { class: 'adatsor' }, par.filter(Boolean).map(([k, v]) => [h('dt', null, k), h('dd', null, v === undefined || v === null || v === '' ? '–' : v)]));
}
export function szamKartya(felirat, ertek, megjegyzes, hang) {
  return h('div', { class: `szamkartya${hang ? ` szamkartya-${hang}` : ''}` }, h('div', { class: `szam${typeof ertek === 'string' && ertek.length > 7 ? ' szam-hosszu' : ''}` }, ertek ?? '–'), h('div', { class: 'felirat' }, felirat), megjegyzes ? h('div', { class: 'halvany kicsi' }, megjegyzes) : null);
}

/** tabla: oszlopok [{cim, ertek:(sor)=>node|string, osztaly}] ; mobilon kartyak (data-label) */
export function tabla(oszlopok, sorok, { ures = 'Nincs megjeleníthető sor.', felirat = '' } = {}) {
  if (!sorok.length) return uresAllapot(ures);
  const t = h('table', { class: 'tabla' },
    felirat ? h('caption', { class: 'csak-olvaso' }, felirat) : null,
    h('thead', null, h('tr', null, oszlopok.map((o) => h('th', { scope: 'col' }, o.cim)))),
    h('tbody', null, sorok.map((s) => h('tr', null, oszlopok.map((o) => h('td', { 'data-label': o.cim, class: o.osztaly || '' }, o.ertek(s)))))));
  return h('div', { class: 'tabla-keret' }, t);
}

// ---- urlap-segedek ------------------------------------------------------------------------------------------------------------------------
let mezoSzam = 0;
export function mezo(felirat, input, sugo) {
  const id = input.id || `m${++mezoSzam}`;
  input.id = id;
  const lab = h('label', { for: id }, felirat);
  return h('div', { class: 'mezo' }, lab, input, sugo ? h('div', { class: 'sugo' }, sugo) : null);
}
export function beviteli(attrs) { return h('input', { type: 'text', ...attrs }); }
export function valaszto(opciok, ertek, attrs) { // opciok: [[ertek, felirat]]
  const s = h('select', attrs, opciok.map(([v, f]) => h('option', { value: v, selected: v === ertek }, f)));
  if (ertek !== undefined) s.value = ertek;
  return s;
}
export function gomb(felirat, onclick, { tipus = '', ...attrs } = {}) { return h('button', { type: 'button', class: `gomb${tipus ? ` gomb-${tipus}` : ''}`, onclick, ...attrs }, felirat); }
/** futtat egy async muveletet a gombon: letiltas kozben, hibat ertesitesben mutat */
export function futtat(gombEl, fn) {
  return async (ev) => {
    if (ev && ev.preventDefault) ev.preventDefault();
    if (gombEl.disabled) return;
    gombEl.disabled = true; gombEl.setAttribute('aria-busy', 'true');
    try { await fn(); } catch (e) { if (!(e && e.status === 401)) ertesit(e.message || 'Hiba történt.', 'hiba'); else throw e; } finally { gombEl.disabled = false; gombEl.removeAttribute('aria-busy'); }
  };
}

// ---- ertesites (toast) es parbeszed ---------------------------------------------------------------------------------------------------------
let toastHely = null;
export function ertesit(szoveg, hang = 'ok') {
  if (!toastHely) { toastHely = h('div', { class: 'toastok', 'aria-live': 'polite', role: 'status' }); document.body.append(toastHely); }
  const t = h('div', { class: `toast toast-${hang}` }, szoveg);
  toastHely.append(t);
  setTimeout(() => t.remove(), hang === 'hiba' ? 8000 : 4000);
}
/** modalis parbeszed (dialog); visszaad: Promise<bool|ertek> */
export function parbeszed({ cim, torzs, megerosit = 'Rendben', megse = 'Mégse', veszely = false, ellenoriz }) {
  return new Promise((kesz) => {
    const dlg = h('dialog', { class: 'parbeszed', 'aria-labelledby': 'parbeszed-cim' });
    const hiba = h('div', { class: 'hiba-sor', role: 'alert' });
    const ok = h('button', { type: 'submit', value: 'ok', class: `gomb ${veszely ? 'gomb-veszely' : 'gomb-fo'}` }, megerosit);
    const m = h('button', { type: 'button', class: 'gomb', onclick: () => dlg.close('megse') }, megse);
    const urlap = h('form', { method: 'dialog', onsubmit: (ev) => { if (ev.submitter !== ok) return; if (ellenoriz) { const r = ellenoriz(); if (r) { ev.preventDefault(); hiba.textContent = r; return; } } } },
      h('h2', { id: 'parbeszed-cim' }, cim), torzs, hiba, h('div', { class: 'gombsor' }, m, ok));
    dlg.append(urlap);
    dlg.addEventListener('close', () => { const igen = dlg.returnValue !== 'megse' && dlg.returnValue !== ''; dlg.remove(); kesz(igen); });
    document.body.append(dlg);
    dlg.showModal();
    const elso = dlg.querySelector('input,textarea,select');
    (elso || ok).focus();
  });
}
export const megerosites = (cim, szoveg, opc = {}) => parbeszed({ cim, torzs: h('p', null, szoveg), ...opc });

/** kis szoveges ablak mezokkel -> {mezo:ertek} vagy null */
export async function urlapParbeszed(cim, mezok, opc = {}) {
  const els = {};
  const torzs = h('div', { class: 'mezok' }, mezok.map((m) => {
    const el = m.el; els[m.kulcs] = el; return mezo(m.felirat, el, m.sugo);
  }));
  const igen = await parbeszed({ cim, torzs, ...opc });
  if (!igen) return null;
  const ered = {}; for (const [k, el] of Object.entries(els)) ered[k] = el.type === 'checkbox' ? el.checked : el.value;
  return ered;
}

/** fulek (tablist) billentyuzet-kezelessel */
export function fulek(defs, kezdo = 0) { // defs: [{cim, tolt:(cel)=>void}]
  const sav = h('div', { class: 'fulek', role: 'tablist' });
  const tartalom = h('div', { class: 'ful-tartalom', role: 'tabpanel', tabindex: '0' });
  const gombok = defs.map((d, i) => h('button', { type: 'button', role: 'tab', class: 'ful', id: `ful-${i}`, onclick: () => valt(i) }, d.cim));
  const valt = (i) => {
    gombok.forEach((g, j) => { g.setAttribute('aria-selected', String(i === j)); g.tabIndex = i === j ? 0 : -1; });
    tartalom.setAttribute('aria-labelledby', `ful-${i}`);
    tolt(tartalom); defs[i].tolt(tartalom);
  };
  sav.addEventListener('keydown', (ev) => {
    const i = gombok.indexOf(document.activeElement); if (i < 0) return;
    let j = i; if (ev.key === 'ArrowRight') j = (i + 1) % gombok.length; else if (ev.key === 'ArrowLeft') j = (i - 1 + gombok.length) % gombok.length; else return;
    ev.preventDefault(); gombok[j].focus(); valt(j);
  });
  sav.append(...gombok);
  const keret = h('div', null, sav, tartalom);
  queueMicrotask(() => valt(kezdo));
  return keret;
}

/** kliens-oldali kep-atmeretezes: max 1600 px hosszabbik oldal, JPEG ~0.82 */
export async function kepAtmeretez(fajl, max = 1600, minoseg = 0.82) {
  let bmp;
  try { bmp = await createImageBitmap(fajl, { imageOrientation: 'from-image' }); } catch { bmp = await kepBetolt(fajl); }
  const arany = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * arany)); const hh = Math.max(1, Math.round(bmp.height * arany));
  const c = document.createElement('canvas'); c.width = w; c.height = hh;
  c.getContext('2d').drawImage(bmp, 0, 0, w, hh);
  if (bmp.close) bmp.close();
  const blob = await new Promise((ok, nem) => c.toBlob((b) => (b ? ok(b) : nem(new Error('A kép átalakítása nem sikerült.'))), 'image/jpeg', minoseg));
  return { blob, szelesseg: w, magassag: hh };
}
function kepBetolt(fajl) {
  return new Promise((ok, nem) => { const url = URL.createObjectURL(fajl); const i = new Image(); i.onload = () => { URL.revokeObjectURL(url); ok(i); }; i.onerror = () => nem(new Error('A fájl nem olvasható képként.')); i.src = url; });
}
