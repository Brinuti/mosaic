// Számlázz.hu "Számla Agent" kapcsolat: egy számla kiállítása a vásárláskor (az ajándékkártya-motor lézeres kereskedője).
// Platformfüggetlen, csak Web-szabványos API-t használ (fetch, FormData, Blob): Cloudflare Pages-függvényben és Node-ban is fut.
//
// A KÉRÉS: multipart/form-data POST a https://www.szamlazz.hu/szamla/ címre, az `action-xmlagentxmlfile` mezőben a számla XML-je
// (xmlns http://www.szamlazz.hu/xmlszamla; a sorrend az XSD-é: https://www.szamlazz.hu/szamla/docs/xsds/agent/xmlszamla.xsd).
// A VÁLASZ: valaszVerzio=2 mellett XML (xmlszamlavalasz: sikeres, hibakod, hibauzenet, szamlaszam, ...); a HTTP-fejlécek
// (szlahu_szamlaszam, szlahu_error, szlahu_error_code) tartaléknak vannak kezelve.
//
// ÚJ KATA + AAM: az Agent a vállalkozásnak (adószámos vevőnek) szóló számlát TILTJA ("hibaüzenetet küldünk"), ezért a lézeres kártya csak
// magánszemélynek szól (a motor nem is kér adószámot), a tételek ÁFA-kulcsa AAM (alanyi adómentes).
// ELŐNÉZET MÓD (elonezet: true): a számla NEM kerül kiállításra, csak PDF-előnézet készül (a Számlázz.hu ellenőrzi az XML-t): ezzel
// próbálható az élő kapcsolat éles számla nélkül (az előnézeti Cloudflare-környezet ezt használja).

export const SZAMLAZZ_URL = 'https://www.szamlazz.hu/szamla/';

const xmlEsc = (v) => String(v ?? '')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const elem = (nev, ertek) => (ertek === undefined || ertek === null || ertek === '' ? '' : `<${nev}>${xmlEsc(ertek)}</${nev}>`);
const logikai = (b) => (b ? 'true' : 'false');
// a forint egész szám; a Számlázz.hu pontot használ tizedeselválasztónak
const szam = (n) => String(Math.round(Number(n) * 100) / 100);

// Budapest-i nap (YYYY-MM-DD): a számla kelte / teljesítése a vásárlás magyarországi napja
export function budapestiNap(d) {
  const t = d instanceof Date ? d : new Date(d);
  const resz = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Budapest', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(t);
  const o = Object.fromEntries(resz.map((p) => [p.type, p.value]));
  return `${o.year}-${o.month}-${o.day}`;
}

/**
 * A számla XML-je. adat:
 *  { kulcs, elonezet?, nap (YYYY-MM-DD), fizmod, rendelesSzam, kulsoAzon?, megjegyzes?, emailReplyto?,
 *    vevo: { nev, irsz, telepules, cim, email, sendEmail? },
 *    tetelek: [{ nev, ft, afa? ('AAM' alapból) }] }
 * Minden tétel mennyisége 1 db; az ÁFA-kulcs AAM esetén nettó = bruttó, ÁFA 0.
 */
export function szamlaXml(adat) {
  if (!adat || !adat.kulcs) throw new Error('szamlazz: hianyzo agent kulcs');
  const t = Array.isArray(adat.tetelek) ? adat.tetelek : [];
  if (!t.length) throw new Error('szamlazz: nincs szamlatetel');
  const v = adat.vevo || {};
  const tetelXml = t.map((x) => {
    const ft = Number(x.ft);
    if (!Number.isFinite(ft) || ft <= 0) throw new Error('szamlazz: ervenytelen tetel-osszeg');
    const afa = String(x.afa || 'AAM');
    // AAM / TAM / 0: nincs ÁFA; 27 (stb.): az összeg bruttó, az ÁFA a bruttóból számolt
    const szazalek = /^\d+(\.\d+)?$/.test(afa) ? Number(afa) : 0;
    const netto = szazalek ? Math.round(ft / (1 + szazalek / 100)) : ft;
    const afaErtek = ft - netto;
    return `<tetel>${elem('megnevezes', x.nev)}${elem('mennyiseg', 1)}${elem('mennyisegiEgyseg', 'db')}${elem('nettoEgysegar', szam(netto))}`
      + `${elem('afakulcs', afa)}${elem('nettoErtek', szam(netto))}${elem('afaErtek', szam(afaErtek))}${elem('bruttoErtek', szam(ft))}</tetel>`;
  }).join('');
  const nap = adat.nap;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(nap || ''))) throw new Error('szamlazz: ervenytelen datum');
  return '<?xml version="1.0" encoding="UTF-8"?>'
    + '<xmlszamla xmlns="http://www.szamlazz.hu/xmlszamla" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.szamlazz.hu/xmlszamla https://www.szamlazz.hu/szamla/docs/xsds/agent/xmlszamla.xsd">'
    + '<beallitasok>'
    + `${elem('szamlaagentkulcs', adat.kulcs)}<eszamla>true</eszamla><szamlaLetoltes>false</szamlaLetoltes><valaszVerzio>2</valaszVerzio>${elem('szamlaKulsoAzon', adat.kulsoAzon)}`
    + '</beallitasok>'
    + '<fejlec>'
    + `<keltDatum>${xmlEsc(nap)}</keltDatum><teljesitesDatum>${xmlEsc(nap)}</teljesitesDatum><fizetesiHataridoDatum>${xmlEsc(nap)}</fizetesiHataridoDatum>`
    + `${elem('fizmod', adat.fizmod || 'Stripe')}<penznem>Ft</penznem><szamlaNyelve>hu</szamlaNyelve>${elem('megjegyzes', adat.megjegyzes)}${elem('rendelesSzam', adat.rendelesSzam)}`
    + `<fizetve>true</fizetve>${adat.elonezet ? '<elonezetpdf>true</elonezetpdf>' : ''}`
    + '</fejlec>'
    + `<elado>${elem('emailReplyto', adat.emailReplyto)}</elado>`
    + `<vevo>${elem('nev', v.nev)}<orszag>Magyarország</orszag>${elem('irsz', v.irsz)}${elem('telepules', v.telepules)}${elem('cim', v.cim)}${elem('email', v.email)}`
    + `<sendEmail>${logikai(v.sendEmail !== false && Boolean(v.email))}</sendEmail></vevo>`
    + `<tetelek>${tetelXml}</tetelek>`
    + '</xmlszamla>';
}

const xmlErtek = (xml, nev) => {
  const m = new RegExp(`<(?:\\w+:)?${nev}>([\\s\\S]*?)</(?:\\w+:)?${nev}>`).exec(xml);
  return m ? m[1].trim().replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&') : '';
};
const fejlecDekod = (v) => { try { return decodeURIComponent(String(v || '').replace(/\+/g, ' ')); } catch { return String(v || ''); } };

/**
 * A válasz értelmezése -> { ok, szamlaszam?, hibakod?, hibauzenet?, elonezet? }
 *  - XML-válasz (valaszVerzio=2): sikeres / hibakod / hibauzenet / szamlaszam
 *  - fejlécek (tartalék): szlahu_error / szlahu_error_code / szlahu_szamlaszam
 * Az ismeretlen formátum NEM siker (inkább kézzel kiállítás, mint feltételezett számla).
 */
export function valaszErtelmez(status, fejlec, torzs) {
  const f = (n) => (fejlec && typeof fejlec.get === 'function' ? fejlec.get(n) : fejlec && fejlec[n]) || '';
  const szoveg = typeof torzs === 'string' ? torzs : '';
  const fejlecHiba = fejlecDekod(f('szlahu_error'));
  const fejlecKod = String(f('szlahu_error_code') || '');
  if (fejlecHiba || fejlecKod) return { ok: false, hibakod: fejlecKod, hibauzenet: fejlecHiba || xmlErtek(szoveg, 'hibauzenet') };
  if (/<(?:\w+:)?xmlszamlavalasz[\s>]/.test(szoveg)) {
    const sikeres = xmlErtek(szoveg, 'sikeres').toLowerCase() === 'true';
    if (!sikeres) return { ok: false, hibakod: xmlErtek(szoveg, 'hibakod'), hibauzenet: xmlErtek(szoveg, 'hibauzenet') };
    const szamlaszam = xmlErtek(szoveg, 'szamlaszam') || String(f('szlahu_szamlaszam') || '');
    return { ok: true, szamlaszam, ...(szamlaszam ? {} : { elonezet: true }) };
  }
  // XML nélkül: a fejléces (régi) válasz
  const szamlaszam = String(f('szlahu_szamlaszam') || '');
  if (status >= 200 && status < 300 && szamlaszam) return { ok: true, szamlaszam };
  return { ok: false, hibakod: String(status), hibauzenet: szoveg.slice(0, 160) || 'ismeretlen valasz' };
}

/**
 * A számla kiállítása. -> { ok, szamlaszam? } | { ok: false, hibakod, hibauzenet, ujraproba? }
 * ujraproba: true = átmeneti hiba (hálózat / időtúllépés / 5xx): a hívó újra próbálhatja; false = végleges (pl. érvénytelen kulcs / adat).
 * A rendelésszám ismétlődése ("rendelésszám ismétlődés tiltása" a fiókban) = a számla már megvan: duplikalt: true.
 */
export async function szamlaKiallit(adat, { fetchFn = globalThis.fetch, url = SZAMLAZZ_URL, idokorlatMs = 20000 } = {}) {
  const xml = szamlaXml(adat);
  const urlap = new FormData();
  urlap.append('action-xmlagentxmlfile', new Blob([xml], { type: 'text/xml' }), 'szamla.xml');
  let v;
  try {
    const jel = typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(idokorlatMs) : undefined;
    v = await fetchFn(url, { method: 'POST', body: urlap, signal: jel });
  } catch (e) {
    return { ok: false, hibakod: 'halozat', hibauzenet: String((e && e.message) || e).slice(0, 160), ujraproba: true };
  }
  let torzs = '';
  try { torzs = await v.text(); } catch { torzs = ''; }
  const r = valaszErtelmez(v.status, v.headers, torzs);
  if (r.ok) return r;
  // a rendelésszám már szerepel egy számlán: a webhook ismétlése / dupla kattintás, a számla megvan (a szám nem ismert)
  const duplikalt = /rendel[ée]ssz[áa]m/i.test(String(r.hibauzenet || '')) && /(ism[ée]tl|m[áa]r|szerepel|tiltott)/i.test(String(r.hibauzenet || ''));
  return { ...r, ...(duplikalt ? { duplikalt: true } : {}), ujraproba: v.status >= 500 };
}
