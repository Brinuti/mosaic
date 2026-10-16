// "A foglalásod" oldal: időpont módosítása / lemondása a saját felületünkön (lib/foglalasom.js), a Salonic-oldal megmutatása nélkül.
// A Cloudflare-függvény a szerver oldalán kéri le a Salonic nyilvános foglalás-oldalait (a vendég böngészője nem látja a Salonic-címeket és a foglalás-azonosítót):
//   - szabad időpontok: GET /selectDate/?startDate=<epoch>&bookingId=<id>  -> a nap linkjei: /editBooking/?bookingId=<id>&startDate=<epoch>
//   - módosítás:        GET /editBooking/?bookingId=<id>&startDate=<epoch> -> átirányít a /success-edit/<id> címre
//   - lemondás:         /booking/cancelBooking/<id> -> vagy azonnal lemond, vagy űrlapot ad (rejtett mezők, CSRF), azt küldjük be
// A D1-be NEM írunk: a Salonic "Foglalás módosítva" / "lemondva" értesítője a motoron (../netlify/lib/lifecycle/engine.js) át frissíti a sort;
// ha mi írnánk át a kezdetet, a motor a második (azonos kezdetű) levelet duplikátumnak vehetné, és elmaradna az újratervezés.
// A naplóba nem kerül személyes adat (csak a művelet, HTTP-kód, darabszám).

export const SALONIC_HOST = 'https://medicalpiercing.salonic.hu';
const ZONA = 'Europe/Budapest';
const NAP_MP = 86400;
const MAX_NAP_ELORE = 120;
const UA = 'Mozilla/5.0 (compatible; MedicalPiercing-foglalasom/1.0; +https://www.medicalpiercing.hu)';

// ---- dátum (budapesti idő) ------------------------------------------------------------------------------------------------------------------
const RESZEK = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
function helyiReszek(epoch) {
  const r = Object.fromEntries(RESZEK.formatToParts(new Date(epoch * 1000)).map((p) => [p.type, p.value]));
  return { nap: `${r.year}-${r.month}-${r.day}`, ido: `${r.hour}:${r.minute}` };
}
/** epoch mp -> "YYYY-MM-DD" (budapesti nap) */
export const napKulcs = (epoch) => helyiReszek(epoch).nap;
/** "YYYY-MM-DD" + óra/perc budapesti idő szerint -> epoch mp */
export function helyiEpoch(nap, ora = 0, perc = 0) {
  const [y, m, d] = nap.split('-').map(Number);
  const utc = Date.UTC(y, m - 1, d, ora, perc) / 1000;
  // a budapesti eltolás (CET/CEST) az adott pillanatban; kétszer igazítunk az átállás körüli napok miatt
  let t = utc;
  for (let i = 0; i < 2; i++) {
    const h = helyiReszek(t);
    const [hy, hm, hd] = h.nap.split('-').map(Number); const [hh, hp] = h.ido.split(':').map(Number);
    t += utc - Date.UTC(hy, hm - 1, hd, hh, hp) / 1000;
  }
  return t;
}
export const napEltol = (nap, n) => new Date(Date.UTC(...nap.split('-').map((x, i) => Number(x) - (i === 1 ? 1 : 0))) + n * NAP_MP * 1000).toISOString().slice(0, 10);
const CIMKE = new Intl.DateTimeFormat('hu-HU', { timeZone: 'UTC', month: 'long', day: 'numeric', weekday: 'long' });
/** "2026-10-27" -> "október 27., kedd" */
export function napCimke(nap) {
  const r = Object.fromEntries(CIMKE.formatToParts(new Date(nap + 'T12:00:00Z')).map((p) => [p.type, p.value]));
  return `${r.month} ${r.day}., ${r.weekday}`;
}
const NAP_RE = /^\d{4}-\d{2}-\d{2}$/;

// ---- HTML-feldolgozás ---------------------------------------------------------------------------------------------------------------------------
const dekodol = (s) => String(s || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

/** A selectDate-oldal szabad időpontjai: [{ ido:"13:00", start:<epoch> }] (csak ehhez a foglaláshoz tartozó linkek, idő szerint rendezve). */
export function idopontokHtmlbol(html, bookingId) {
  const lista = new Map();
  const re = /<a\b[^>]*href\s*=\s*["']([^"']*\/editBooking\/?\?[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(String(html || '')))) {
    const href = dekodol(m[1]);
    const q = href.slice(href.indexOf('?') + 1);
    const p = new URLSearchParams(q);
    if (bookingId && p.get('bookingId') !== bookingId) continue;
    const start = Number(p.get('startDate'));
    if (!Number.isInteger(start) || start <= 0) continue;
    const felirat = /(\d{1,2}):(\d{2})/.exec(m[2].replace(/<[^>]+>/g, ' '));
    const ido = felirat ? `${felirat[1].padStart(2, '0')}:${felirat[2]}` : helyiReszek(start).ido;
    lista.set(start, { ido, start });
  }
  return [...lista.values()].sort((a, b) => a.start - b.start);
}

/** "A foglalást legkésőbb <dátum> <idő>-ig van lehetőséged lemondani." mondat (ha az oldalon szerepel). */
export function lemondasiHatarido(html) {
  const sz = dekodol(String(html || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
  const m = /A foglalást legkésőbb [^<]{3,60}?-ig van lehetőséged lemondani\./i.exec(sz);
  return m ? m[0] : null;
}

/** Az első <form> a beküldéshez szükséges mezőkkel (rejtett mezők, legördülő: első nem üres lehetőség, szövegmező: az indoklás). */
export function urlapHtmlbol(html, alapUrl) {
  const fm = /<form\b([^>]*)>([\s\S]*?)<\/form>/i.exec(String(html || ''));
  if (!fm) return null;
  const attr = (s, nev) => { const a = new RegExp(`\\b${nev}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i').exec(s); return a ? dekodol(a[2]) : null; };
  const action = new URL(attr(fm[1], 'action') || alapUrl, alapUrl).toString();
  const method = (attr(fm[1], 'method') || 'GET').toUpperCase();
  const torzs = fm[2];
  const mezok = new URLSearchParams();
  const radioVolt = new Set();
  for (const im of torzs.matchAll(/<input\b([^>]*)>/gi)) {
    const nev = attr(im[1], 'name'); if (!nev) continue;
    const tipus = (attr(im[1], 'type') || 'text').toLowerCase();
    const ertek = attr(im[1], 'value') ?? '';
    if (tipus === 'submit' || tipus === 'button' || tipus === 'image' || tipus === 'file' || tipus === 'reset') continue;
    if (tipus === 'checkbox') { if (/\bchecked\b|\brequired\b/i.test(im[1])) mezok.append(nev, ertek || 'on'); continue; }
    if (tipus === 'radio') { if (!radioVolt.has(nev)) { radioVolt.add(nev); mezok.append(nev, ertek); } continue; }
    if (tipus === 'hidden') { mezok.append(nev, ertek); continue; }
    mezok.append(nev, ertek || INDOK);
  }
  for (const sm of torzs.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/gi)) {
    const nev = attr(sm[1], 'name'); if (!nev) continue;
    const opciok = [...sm[2].matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)].map((o) => ({ ertek: attr(o[1], 'value') ?? dekodol(o[2]).trim(), jelolt: /\bselected\b/i.test(o[1]) }));
    const v = opciok.find((o) => o.jelolt && o.ertek) || opciok.find((o) => o.ertek);
    if (v) mezok.append(nev, v.ertek);
  }
  for (const tm of torzs.matchAll(/<textarea\b([^>]*)>([\s\S]*?)<\/textarea>/gi)) {
    const nev = attr(tm[1], 'name'); if (nev) mezok.append(nev, dekodol(tm[2]).trim() || INDOK);
  }
  // a beküldő gomb neve/értéke (egyes szerverek ebből tudják, melyik gomb volt)
  const gomb = /<button\b([^>]*\btype\s*=\s*["']submit["'][^>]*)>/i.exec(torzs) || /<input\b([^>]*\btype\s*=\s*["']submit["'][^>]*)>/i.exec(torzs);
  if (gomb && attr(gomb[1], 'name')) mezok.append(attr(gomb[1], 'name'), attr(gomb[1], 'value') ?? '');
  return { action, method, mezok };
}
export const INDOK = 'A vendég lemondta az oldalunkon';
const LEMONDVA_JEL = /success-cancel|sikeresen lemond|sikeres lemond|lemondtad|lemondásra került|le lett mondva|lemondva|törölve|torolve|cancelled|canceled/i;

// ---- HTTP (sütik megtartásával, kézi átirányítással) ---------------------------------------------------------------------------------------------
function sutikFrissit(tar, valasz) {
  const sorok = typeof valasz.headers.getSetCookie === 'function' ? valasz.headers.getSetCookie() : (valasz.headers.get('set-cookie') ? [valasz.headers.get('set-cookie')] : []);
  for (const s of sorok) { const m = /^\s*([^=;\s]+)=([^;]*)/.exec(s); if (m) tar.set(m[1], m[2]); }
}
async function keres(fetchFn, url, { method = 'GET', torzs = null, tar = new Map(), maxUgras = 5 } = {}) {
  let cel = url; let mod = method; let body = torzs; const ut = [];
  for (let i = 0; i <= maxUgras; i++) {
    const fej = { 'user-agent': UA, accept: 'text/html,application/xhtml+xml', 'accept-language': 'hu-HU,hu;q=0.9' };
    if (tar.size) fej.cookie = [...tar].map(([k, v]) => `${k}=${v}`).join('; ');
    if (body != null) { fej['content-type'] = 'application/x-www-form-urlencoded'; fej.referer = ut[ut.length - 1] || cel; fej.origin = SALONIC_HOST; }
    const v = await fetchFn(cel, { method: mod, headers: fej, body, redirect: 'manual' });
    sutikFrissit(tar, v);
    ut.push(cel);
    const hova = v.headers.get('location');
    if (v.status >= 300 && v.status < 400 && hova) {
      cel = new URL(hova, cel).toString();
      if (v.status !== 307 && v.status !== 308) { mod = 'GET'; body = null; }
      continue;
    }
    return { status: v.status, url: cel, ut, html: await v.text(), tar };
  }
  return { status: 0, url: cel, ut, html: '', tar };
}
const rovidUt = (u) => { try { const x = new URL(u); return x.pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '<id>'); } catch { return '?'; } };

// ---- műveletek ----------------------------------------------------------------------------------------------------------------------------------
/**
 * Egy nap szabad időpontjai. kertNap: "YYYY-MM-DD" (üres: a mai nap). A Salonic a kért nap helyett a következő szabad napot is adhatja: a nap a valódi nap.
 * @returns {Promise<{nap:string, napCimke:string, kert:string, idopontok:{ido:string,start:number}[], elozo:string|null, kovetkezo:string|null, hatarido:string|null}>}
 */
export async function szabadIdopontok(fetchFn, bookingId, kertNap, most = Math.floor(Date.now() / 1000)) {
  const ma = napKulcs(most);
  const utolso = napEltol(ma, MAX_NAP_ELORE);
  let kert = NAP_RE.test(kertNap || '') ? kertNap : ma;
  if (kert < ma) kert = ma;
  if (kert > utolso) kert = utolso;
  const kezd = Math.max(helyiEpoch(kert, 0, 0), most);
  const url = `${SALONIC_HOST}/selectDate/?startDate=${kezd}&bookingId=${encodeURIComponent(bookingId)}`;
  const v = await keres(fetchFn, url);
  if (v.status !== 200) { console.log('foglalasom: selectDate HTTP', v.status, rovidUt(v.url)); throw new Error('salonic_selectdate'); }
  const osszes = idopontokHtmlbol(v.html, bookingId).filter((x) => x.start > most);
  // a lista egy napé; ha több nap linkje is van, a legelső napot vesszük
  const nap = osszes.length ? napKulcs(osszes[0].start) : kert;
  const idopontok = osszes.filter((x) => napKulcs(x.start) === nap);
  const elozo = kert > ma ? napEltol(kert, -1) : null;
  const kovetkezo = nap < utolso ? napEltol(nap, 1) : null;
  console.log('foglalasom: idopontok', JSON.stringify({ kert, nap, db: idopontok.length }));
  return { nap, napCimke: napCimke(nap), kert, idopontok, elozo, kovetkezo, hatarido: lemondasiHatarido(v.html) };
}

/** Módosítás: csak a Salonic friss listájában szereplő időpontra. -> { ok:true, uj } | { ok:false, hiba } */
export async function modosit(fetchFn, bookingId, start, most = Math.floor(Date.now() / 1000)) {
  if (!Number.isInteger(start) || start <= most) return { ok: false, hiba: 'ervenytelen_idopont' };
  const lista = await szabadIdopontok(fetchFn, bookingId, napKulcs(start), most);
  if (!lista.idopontok.some((x) => x.start === start)) { console.log('foglalasom: modosit - az idopont nem szabad'); return { ok: false, hiba: 'nem_szabad' }; }
  const v = await keres(fetchFn, `${SALONIC_HOST}/editBooking/?bookingId=${encodeURIComponent(bookingId)}&startDate=${start}`);
  const siker = v.ut.concat(v.url).some((u) => /\/success-edit\//.test(u)) || /success-edit/.test(v.html) || /sikeresen módosít|módosítás sikeres/i.test(v.html);
  console.log('foglalasom: modosit', JSON.stringify({ status: v.status, vegso: rovidUt(v.url), siker }));
  return siker ? { ok: true, uj: start } : { ok: false, hiba: 'salonic_modosit' };
}

/** Lemondás: GET a lemondó oldalra; ha űrlap jön, beküldjük (a GET sütijeivel). -> { ok:true } | { ok:false, hiba } */
export async function lemond(fetchFn, bookingId) {
  const tar = new Map();
  const url = `${SALONIC_HOST}/booking/cancelBooking/${encodeURIComponent(bookingId)}`;
  const elso = await keres(fetchFn, url, { tar });
  const sikerUrl = (v) => v.ut.concat(v.url).some((u) => /success-cancel/i.test(u));
  const sikerSzoveg = (v) => LEMONDVA_JEL.test(v.html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ''));
  if (sikerUrl(elso)) { console.log('foglalasom: lemond GET - azonnal lemondva'); return { ok: true }; }
  const urlap = elso.status === 200 ? urlapHtmlbol(elso.html, elso.url) : null;
  console.log('foglalasom: lemond GET', JSON.stringify({ status: elso.status, vegso: rovidUt(elso.url), urlap: !!urlap, mezok: urlap ? [...urlap.mezok.keys()] : [] }));
  if (!urlap) return elso.status === 200 && sikerSzoveg(elso) ? { ok: true } : { ok: false, hiba: 'salonic_lemond' };
  const masodik = urlap.method === 'POST'
    ? await keres(fetchFn, urlap.action, { method: 'POST', torzs: urlap.mezok.toString(), tar })
    : await keres(fetchFn, `${urlap.action}${urlap.action.includes('?') ? '&' : '?'}${urlap.mezok}`, { tar });
  const siker = masodik.status < 400 && (sikerUrl(masodik) || (sikerSzoveg(masodik) && !sikerSzoveg(elso)));
  console.log('foglalasom: lemond urlap', JSON.stringify({ status: masodik.status, vegso: rovidUt(masodik.url), siker }));
  return siker ? { ok: true } : { ok: false, hiba: 'salonic_lemond' };
}
