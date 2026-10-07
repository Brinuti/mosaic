// Uzenet-kirajzolas: helyorzok kitoltese (SMS / e-mail / belso feladat-level) es az e-mail HTML + szoveges valtozata.
import { HELYORZOK } from './katalog/ertekek.js';
import { UZLETAGAK, SZALON, rovidNev, tisztaNev, idotartamPerc, uzletaggal } from './uzletag.js';
import { datumSzoveg, datumRagos, idopontSzoveg, napNev, idotartamSzoveg, napKezdet } from './ido.js';
import { smsSzegmens } from './telefon.js';

export const ALAP_URL = 'https://www.mosaicheadspa.hu';
// nem munkatars-nev: a Salonic "Munkatars" mezoje lehet szoba/kezelo-tipus is
const NEM_NEV = /kezel[oő]|head ?spa|bárki|barki|szőrtelenít|szortelenit|elysion|pmu$/i;

/** "Tegnap nem találkoztunk" / "Ma nem találkoztunk" / "A … időpontodon nem találkoztunk": a küldés napja szerint (most: a küldés ideje, epoch mp). */
export function nemTalalkoztunk(kezdet, most) {
  if (!most) return 'Tegnap nem találkoztunk';
  const kulonbseg = Math.round((napKezdet(most) - napKezdet(kezdet)) / 86400);
  if (kulonbseg <= 0) return 'Ma nem találkoztunk';
  if (kulonbseg === 1) return 'Tegnap nem találkoztunk';
  return `A ${datumSzoveg(kezdet)} ${idopontSzoveg(kezdet)}-ra szóló időpontodon nem találkoztunk`;
}

/**
 * A foglalas helyorzo-ertekei. mod: 'sms' (rovid szolgaltatas-nev) | 'email'. A null ertek = ismeretlen.
 * @param {object} f foglalas-sor (D1)
 * @param {{base?:string, ujKezdet?:number}} [opc]
 */
export function ertekek(f, mod = 'email', opc = {}) {
  const base = opc.base || ALAP_URL;
  const uz = UZLETAGAK[f.uzletag];
  const munkatars = f.munkatars && !NEM_NEV.test(f.munkatars) ? f.munkatars : null;
  const perc = idotartamPerc(f.uzletag, f.szolgaltatas);
  const reszletek = `${base}/f/${f.token}`;
  return {
    'keresztnév': f.keresztnev || null,
    'dátum': datumSzoveg(f.kezdet), 'dátum_ragos': datumRagos(f.kezdet), 'nap': napNev(f.kezdet), 'időpont': idopontSzoveg(f.kezdet),
    'szolgáltatás': mod === 'sms' ? uzletaggal(f.uzletag, rovidNev(f.szolgaltatas)) : uzletaggal(f.uzletag, tisztaNev(f.szolgaltatas), true),
    'munkatárs': munkatars, 'fodrász': munkatars,
    'várható_időtartam': idotartamSzoveg(perc),
    'aktuális_ár': null, 'aktuális_ajánlat': null,
    'foglalás_részletei_link': reszletek, 'módosítás_link': reszletek, 'megerősítés_link': `${base}/m/${f.token}`,
    'foglalás_link': uz.foglalasUrl, 'navigáció_link': SZALON.navigacioUrl, 'eredmények_link': uz.eredmenyekUrl, 'videó_link': uz.videoUrl,
    'új_dátum': opc.ujKezdet ? datumSzoveg(opc.ujKezdet) : datumSzoveg(f.kezdet), 'új_időpont': opc.ujKezdet ? idopontSzoveg(opc.ujKezdet) : idopontSzoveg(f.kezdet),
    'telefon': SZALON.telefon, 'cím': SZALON.cim,
    'nem_találkoztunk': nemTalalkoztunk(f.kezdet, opc.most),
    _uzletag: f.uzletag,
  };
}

/**
 * Magyar rag a kitoltott ertek utan (-ra/-re, -hoz/-hez/-höz, -nak/-nek, -ba/-be, -ban/-ben): magánhangzó-harmónia az utolsó szó utolsó
 * magánhangzója szerint; a név végi a/e megnyúlik (Melitta -> Melittához). Ha az érték nem betűre végződik (szám, zárójel): kötőjellel
 * ("16:00-ra", "(50 perc + Szárítás)-ra").
 */
export function ragoz(ertek, rag) {
  const szoveg = String(ertek);
  const veg = /[^\p{L}]$/u.test(szoveg);
  const utolso = szoveg.replace(/[^\p{L}]+$/u, '').split(/[^\p{L}]+/u).pop() || '';
  const v = [...utolso.toLowerCase()].filter((c) => /[aáeéiíoóöőuúüű]/.test(c)).pop() || 'a';
  const forma = /[aáoóuú]/.test(v) ? 0 : /[eéií]/.test(v) ? 1 : 2;
  const toldalek = { ra: ['ra', 're', 're'], hoz: ['hoz', 'hez', 'höz'], nak: ['nak', 'nek', 'nek'], ba: ['ba', 'be', 'be'], ban: ['ban', 'ben', 'ben'] }[rag][forma];
  if (veg) return `${szoveg}-${utolso ? toldalek : rag}`;
  const utolsoBetu = szoveg.slice(-1).toLowerCase();
  const to = utolsoBetu === 'a' ? `${szoveg.slice(0, -1)}á` : utolsoBetu === 'e' ? `${szoveg.slice(0, -1)}é` : szoveg;
  return to + toldalek;
}

/** Egy sor kitoltese. { szoveg, eldob }: eldob = opcionalis, ismeretlen ertek miatt a sor kimarad. */
export function sorKitolt(sor, ert) {
  let eldob = false;
  let s = String(sor);
  if (!ert['keresztnév']) s = s.replace(/\s*\{keresztnév\}/g, ''); // "Szia {keresztnév}!" -> "Szia!"
  s = s.replace(/\{([^{}]+)\}(?:-(ra|hoz|nak|ba|ban)(?![a-záéíóöőúüű]))?/g, (_, h, rag) => {
    if (!(h in HELYORZOK)) throw new Error(`ismeretlen helyorzo: {${h}}`);
    const v = ert[h];
    if (v === null || v === undefined || v === '') {
      if (HELYORZOK[h].opcionalis) { eldob = true; return ''; }
      throw new Error(`hianyzo helyorzo-ertek: {${h}}`);
    }
    return rag ? ragoz(v, rag) : v;
  });
  return { szoveg: s.replace(/[ \t]{2,}/g, ' ').trim(), eldob };
}

/** Tobbsoros bekezdes: az eldobott sorok kimaradnak; ures marad = null. */
function bekezdesKitolt(blokk, ert) {
  const sorok = String(blokk).split('\n').map((l) => sorKitolt(l, ert)).filter((x) => !x.eldob && x.szoveg);
  return sorok.length ? sorok.map((x) => x.szoveg) : null;
}

/** A torzs-blokkok (SEMA.md) -> egyszerusitett lista: p | ul | ol | box | btn | sign */
export function blokkokKitolt(torzs, ert) {
  const ki = [];
  for (const b of torzs) {
    if (typeof b === 'string') { const s = bekezdesKitolt(b, ert); if (s) ki.push({ t: 'p', sorok: s }); continue; }
    if (b.lista || b.szamozott || b.doboz) {
      const forras = b.lista || b.szamozott || b.doboz;
      const elemek = forras.map((x) => sorKitolt(x, ert)).filter((x) => !x.eldob && x.szoveg).map((x) => x.szoveg);
      if (elemek.length) ki.push({ t: b.lista ? 'ul' : b.szamozott ? 'ol' : 'box', elemek });
    } else if (b.gomb) {
      const l = sorKitolt(b.gomb.link, ert); const f = sorKitolt(b.gomb.felirat, ert);
      if (!l.eldob && !f.eldob) ki.push({ t: 'btn', felirat: f.szoveg, link: l.szoveg });
    } else if (b.alairas) ki.push({ t: 'sign', szoveg: sorKitolt(b.alairas, ert).szoveg });
  }
  return ki;
}

/**
 * SMS: ha egy OPCIONALIS helyorzo ismeretlen (pl. {varhato_idotartam}), nem dobjuk el az egesz SMS-t: csak az o mondatreszet
 * (a legkozelebbi vesszotol / "es"-tol a kovetkezo vesszo-ig / mondatvegig). Kotelezo helyorzo hianyaban hibat dob.
 */
export function smsKirajzol(uz, ert) {
  let s = uz.szoveg;
  if (!ert['keresztnév']) s = s.replace(/\s*\{keresztnév\}/g, '');
  const ismeretlen = (h) => HELYORZOK[h]?.opcionalis && (ert[h] === null || ert[h] === undefined || ert[h] === '');
  for (let kor = 0; kor < 6; kor += 1) {
    const m = [...s.matchAll(/\{([^{}]+)\}/g)].find((x) => ismeretlen(x[1]));
    if (!m) break;
    const elotte = s.slice(0, m.index);
    const mondatKezdet = Math.max(elotte.lastIndexOf('. '), elotte.lastIndexOf('! '), elotte.lastIndexOf('? '), -2) + 2;
    const tagolo = Math.max(elotte.lastIndexOf(', '), elotte.search(/\sés\s(?!.*\sés\s)/));
    const kezd = tagolo >= mondatKezdet ? tagolo : mondatKezdet;
    const utana = s.slice(m.index);
    const vegRel = utana.search(/[,.!?]/);
    const veg = vegRel === -1 ? s.length : m.index + vegRel;
    // vessző/ "és" előtti rész marad; a záró írásjel megmarad
    s = (s.slice(0, kezd) + s.slice(veg)).replace(/\s{2,}/g, ' ');
  }
  const { szoveg } = sorKitolt(s, ert);
  return { szoveg: szoveg.replace(/\s+([,.!?])/g, '$1'), szegmens: smsSzegmens(szoveg) };
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const SZIN = { sotet: '#0f3a3c', arany: '#a07f4b', aranyHatter: '#c6a346', krem: '#f6f1e7', lap: '#f8f4ec', szoveg: '#26302f', halk: '#6b7776' };

function blokkHtml(b) {
  switch (b.t) {
    case 'p': return `<p style="margin:0 0 16px;font:16px/1.65 Georgia,'Times New Roman',serif;color:${SZIN.szoveg}">${b.sorok.map(esc).join('<br>')}</p>`;
    case 'ul': return `<ul style="margin:0 0 16px;padding:0 0 0 22px;font:16px/1.65 Georgia,serif;color:${SZIN.szoveg}">${b.elemek.map((e) => `<li style="margin:0 0 6px">${esc(e)}</li>`).join('')}</ul>`;
    case 'ol': return `<ol style="margin:0 0 16px;padding:0 0 0 22px;font:16px/1.65 Georgia,serif;color:${SZIN.szoveg}">${b.elemek.map((e) => `<li style="margin:0 0 8px">${esc(e)}</li>`).join('')}</ol>`;
    case 'box': return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px"><tr><td style="background:${SZIN.lap};border-left:3px solid ${SZIN.aranyHatter};padding:14px 18px;font:16px/1.6 Georgia,serif;color:${SZIN.sotet}">${b.elemek.map((e, i) => (i === 0 ? `<strong>${esc(e)}</strong>` : esc(e))).join('<br>')}</td></tr></table>`;
    case 'btn': return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 20px"><tr><td style="border-radius:999px;background:${SZIN.aranyHatter}"><a href="${esc(b.link)}" style="display:inline-block;padding:13px 28px;font:600 15px Arial,Helvetica,sans-serif;color:#ffffff;text-decoration:none;border-radius:999px">${esc(b.felirat)}</a></td></tr></table>`;
    case 'sign': return `<p style="margin:22px 0 0;font:600 16px Georgia,serif;color:${SZIN.sotet}">${esc(b.szoveg)}</p>`;
    default: return '';
  }
}

/** Teljes e-mail (HTML + szoveg): fejlec-sav, blokkok, lablec. */
export function levelKirajzol({ uzletagNev, elotag, blokkok, lablecMegjegyzes }) {
  const torzs = blokkok.map(blokkHtml).join('\n');
  const html = `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${SZIN.krem}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(elotag || '')}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${SZIN.krem}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:6px;overflow:hidden">
<tr><td style="background:${SZIN.sotet};padding:22px 28px;text-align:center"><div style="font:500 24px Georgia,serif;letter-spacing:.32em;color:#e9dcc0">MOSAIC</div><div style="font:600 11px Arial,sans-serif;letter-spacing:.22em;color:${SZIN.aranyHatter};margin-top:6px;text-transform:uppercase">${esc(uzletagNev)}</div></td></tr>
<tr><td style="padding:30px 28px 10px">${torzs}</td></tr>
<tr><td style="padding:18px 28px 26px;border-top:1px solid #eee6d5;font:13px/1.6 Arial,Helvetica,sans-serif;color:${SZIN.halk}">${esc(SZALON.cim)} &middot; ${esc(SZALON.telefon)}<br>${esc(lablecMegjegyzes || 'Ezt az üzenetet a foglalásod miatt küldjük.')}</td></tr>
</table></td></tr></table></body></html>`;
  const sz = [];
  for (const b of blokkok) {
    if (b.t === 'p') sz.push(b.sorok.join('\n'));
    else if (b.t === 'ul') sz.push(b.elemek.map((e) => `- ${e}`).join('\n'));
    else if (b.t === 'ol') sz.push(b.elemek.map((e, i) => `${i + 1}. ${e}`).join('\n'));
    else if (b.t === 'box') sz.push(b.elemek.join('\n'));
    else if (b.t === 'btn') sz.push(`${b.felirat}: ${b.link}`);
    else if (b.t === 'sign') sz.push(b.szoveg);
  }
  sz.push(`${SZALON.cim} · ${SZALON.telefon}`);
  return { html, szoveg: sz.join('\n\n') };
}

/** Az e-mail uzenet kirajzolasa a katalogus-bejegyzesbol. surgos: a T0 e-mail a "surgos_kiegeszites"-t is tartalmazza. */
export function emailKirajzol(uz, ert, { surgos = false } = {}) {
  const uzletag = UZLETAGAK[ert._uzletag] || null;
  const torzs = [...uz.torzs, ...(surgos && uz.surgos_kiegeszites ? uz.surgos_kiegeszites : [])];
  const blokkok = blokkokKitolt(torzs, ert);
  const targy = sorKitolt(uz.targy, ert).szoveg;
  const elotag = uz.elotag ? sorKitolt(uz.elotag, ert).szoveg : '';
  const lev = levelKirajzol({ uzletagNev: uzletag ? uzletag.nev : 'MOSAIC', elotag, blokkok });
  return { targy, elotag, ...lev };
}

/** Belso feladat-level (telefonos hivas) a szalonnak: vendeg-adatok + a hivasi szkript. */
export function feladatKirajzol(uz, ert, f) {
  const blokkok = [
    { t: 'p', sorok: ['Telefonos feladat: a motor nem hív, csak jelzi, kit érdemes hívni. A szkript ajánlott irányvonal, nem kötelező szöveg.'] },
    { t: 'box', elemek: [`${f.nev || 'vendég'}`, `Telefon: ${f.telefon || '-'}`, `E-mail: ${f.email || '-'}`, `${ert['szolgáltatás']}`, `${ert['dátum']}, ${ert['időpont']}${ert['munkatárs'] ? ` (${ert['munkatárs']})` : ''}`] },
    ...blokkokKitolt(uz.torzs, ert),
  ];
  const lev = levelKirajzol({ uzletagNev: `${UZLETAGAK[f.uzletag].nev} · feladat`, elotag: 'Hívandó vendég', blokkok, lablecMegjegyzes: 'Belső jelzés a szalonnak (MOSAIC foglalás-emlékeztető rendszer).' });
  return { targy: `${sorKitolt(uz.targy, ert).szoveg}: ${f.nev || 'vendég'}, ${ert['dátum']} ${ert['időpont']}`, ...lev };
}
