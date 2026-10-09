// Egy katalogus-uzenet kirajzolasa a vendeg valtozoival: -> { allapot, targy, html, szoveg, sms?, hianyzo, figyelmeztetesek }.
// Az e-mail HTML-t a meglevo lifecycle renderer (netlify/lib/lifecycle/render.js levelKirajzol) adja: logo-fejlec, blokkok, lablec.
// Tiszta fuggveny: nincs I/O; a hianyzo KOTELEZO valtozo -> allapot 'BLOCKED_MISSING_DATA' (nem kuldheto).
import { levelKirajzol, ALAP_URL } from '../../../netlify/lib/lifecycle/render.js';
import { smsSzegmens } from '../../../netlify/lib/lifecycle/telefon.js';
import { feloldas, nemTorhetoSzokoz, BLOCKED_MISSING_DATA } from './valtozok.js';
import { FELTETELEK } from './kapuk.js';

/** Az SMS legfeljebb ennyi karakter lehet kitoltve (a meglevo lifecycle-katalogus szabalya, SEMA.md). */
export const SMS_MAX_KARAKTER = 480;
/** Alapertelmezett figyelmeztetesi kuszob (szegmens). Allithato: opc.max_szegmens. REQUIRES_VERIFICATION: az uzleti kuszobot a tulajdonos hatarozza meg. */
export const SMS_ALAP_MAX_SZEGMENS = 3;

export const REQUIRES_VERIFICATION = 'REQUIRES_VERIFICATION';

// ---------------------------------------------------------------- SMS hossz
// GSM 03.38 alap karakterkeszlet (a magyar ekezetekbol csak e, u, o, u es nagybetus parjuk: e/E, o/O, u/U szerepel; a, i, o, o-dupla, u, u-dupla NEM).
const GSM_ALAP = '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM_BOVITES = '^{}\\[~]|€'; // 2 septet

/**
 * SMS-hossz: kodolas (GSM-7 / UCS-2), egysegek es szegmensszam.
 * Magyar szoveg az á, í, ó, ő, ú, ű betuk miatt UCS-2: 70 karakter / egy szegmens, tobbszegmensnel 67.
 * `szegmens_szolgaltato`: a meglevo lifecycle-szabaly szerinti szam (minden nem-ASCII karakter = UCS-2) - ha eltér, a nagyobb a biztonsagos.
 */
export function smsStatisztika(szoveg) {
  const s = String(szoveg ?? '');
  const karakterek = [...s];
  let septet = 0;
  let gsm = true;
  for (const c of karakterek) {
    if (GSM_ALAP.includes(c)) septet += 1;
    else if (GSM_BOVITES.includes(c)) septet += 2;
    else { gsm = false; break; }
  }
  const egysegek = gsm ? septet : s.length; // UCS-2: UTF-16 kodegyseg
  const [egy, tobb] = gsm ? [160, 153] : [70, 67];
  const szegmens = egysegek === 0 ? 0 : egysegek <= egy ? 1 : Math.ceil(egysegek / tobb);
  const szolgaltato = smsSzegmens(s);
  return {
    karakter: karakterek.length, kodolas: gsm ? 'GSM-7' : 'UCS-2', egysegek, szegmens, egy_szegmens_max: egy, tobbszegmenses_max: tobb,
    szegmens_szolgaltato: szolgaltato, szegmens_biztonsagos: Math.max(szegmens, szolgaltato),
  };
}

function smsFigyelmeztetesek(st, opc = {}) {
  const f = [];
  const max = opc.max_szegmens ?? SMS_ALAP_MAX_SZEGMENS;
  if (st.karakter > SMS_MAX_KARAKTER) f.push({ kod: 'TUL_HOSSZU', uzenet: `Az SMS ${st.karakter} karakter (max ${SMS_MAX_KARAKTER}).` });
  else if (st.szegmens_biztonsagos > max) f.push({ kod: 'TUL_HOSSZU', uzenet: `Az SMS ${st.szegmens_biztonsagos} szegmens (figyelmeztetési küszöb: ${max}).` });
  if (st.szegmens_biztonsagos > 1) f.push({ kod: 'TOBB_SZEGMENS', uzenet: `${st.kodolas}, ${st.szegmens_biztonsagos} szegmens (${st.karakter} karakter).` });
  if (st.szegmens !== st.szegmens_szolgaltato) f.push({ kod: 'SZEGMENS_ELTERES', uzenet: `GSM/UCS-2 szerint ${st.szegmens}, a szolgáltatói (lifecycle) szabály szerint ${st.szegmens_szolgaltato} szegmens.` });
  return f;
}

// ---------------------------------------------------------------- torzs
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function blokkAktiv(b, ertekek, allapot) {
  if (b.ha !== undefined) return !ures(ertekek[b.ha]);
  if (b.ha_nincs !== undefined) return ures(ertekek[b.ha_nincs]);
  if (b.feltetel !== undefined) {
    const f = FELTETELEK[b.feltetel];
    if (!f) throw new Error(`ismeretlen feltetel: ${b.feltetel}`);
    return !!allapot && f(allapot);
  }
  return true;
}
const ures = (v) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

/** A katalogus torzs-blokkjai -> a lifecycle renderer egyszerusitett blokkjai ({t:'p'|'ul'|'ol'|'box'|'btn'|'cim'}); hianyzo kotelezo valtozok gyujtese. */
export function torzsKitolt(torzs, ertekek, opc = {}) {
  const hianyzo = [];
  const kit = (sor) => {
    const r = feloldas(sor, ertekek, { opcionalis: opc.opcionalis });
    for (const h of r.hianyzo) if (!hianyzo.includes(h)) hianyzo.push(h);
    return nemTorhetoSzokoz(r.szoveg).trim();
  };
  const blokkok = [];
  for (const b of torzs) {
    if (typeof b === 'string') {
      const sorok = b.split('\n').map(kit).filter(Boolean);
      if (sorok.length) blokkok.push({ t: 'p', sorok });
      continue;
    }
    if (!blokkAktiv(b, ertekek, opc.allapot)) continue;
    if (b.szoveg !== undefined) { const s = kit(b.szoveg); if (s) blokkok.push({ t: 'p', sorok: s.split('\n').filter(Boolean) }); }
    else if (b.lista || b.szamozott || b.doboz) {
      const elemek = (b.lista || b.szamozott || b.doboz).map(kit).filter(Boolean);
      if (elemek.length) blokkok.push({ t: b.lista ? 'ul' : b.szamozott ? 'ol' : 'box', elemek });
    } else if (b.gomb) blokkok.push({ t: 'btn', felirat: kit(b.gomb.felirat), link: kit(b.gomb.link) });
    else if (b.cim) blokkok.push({ t: 'cim', szoveg: kit(b.cim) });
    else throw new Error(`ismeretlen torzs-blokk: ${JSON.stringify(b).slice(0, 60)}`);
  }
  return { blokkok, hianyzo };
}

/** A nyers URL-ek kattinthatova tetele a HTML SZOVEG-csomopontjaiban (a vegso irasjel nem resze a linknek). */
function linkesit(html) {
  return html.replace(/>([^<>]+)</g, (m, t) => `>${t.replace(/(https?:\/\/[^\s<>"']+?)((?:&amp;|[.,;:!?)])*)(?=\s|$)/g, (mm, url, veg) => `<a href="${url}" style="color:#a07f4b">${url}</a>${veg}`)}<`);
}

const LABLEC_JEL = '@@LABLEC@@';

// ---------------------------------------------------------------- fo belepesi pont
/**
 * @param {object} uzenet  katalogus-elem (katalog.js)
 * @param {Record<string, any>} ertekek  helyorzo-ertekek (valtozok.js valtozokEpit)
 * @param {{allapot?: object, base?: string, leiratkozas_link?: string, max_szegmens?: number}} [opc]
 *   allapot: a vendeg-allapot (a { feltetel } blokkokhoz: pl. E3 foglalasi CTA); nelkule a feltetelhez kotott blokkok kimaradnak.
 *   leiratkozas_link: marketing e-mailek lableceben "Leiratkozas" link (REQUIRES_VERIFICATION: a forras nem ad leiratkozasi szoveget).
 * @returns {{allapot: 'OK'|'BLOCKED_MISSING_DATA'|'REQUIRES_VERIFICATION', id: string, csatorna: string, hianyzo: string[], targy: string|null, html: string|null, szoveg: string|null, sms: object|null, figyelmeztetesek: object[]}}
 */
export function renderel(uzenet, ertekek, opc = {}) {
  const alap = { id: uzenet.id, csatorna: uzenet.csatorna, hianyzo: [], targy: null, html: null, szoveg: null, sms: null, figyelmeztetesek: [] };
  const opcionalis = uzenet.valtozok_opcionalis || [];

  // szoveg nelkuli (csak szabaly) uzenet: nem talalunk ki szoveget
  if (uzenet.szovegHianyzik) return { ...alap, allapot: REQUIRES_VERIFICATION, figyelmeztetesek: [{ kod: 'NINCS_SZOVEG', uzenet: `${uzenet.id}: a mesteranyag nem ad szöveget (REQUIRES_VERIFICATION).` }] };

  if (uzenet.csatorna === 'sms') {
    const r = feloldas(uzenet.szoveg, ertekek, { opcionalis });
    if (r.hianyzo.length) return { ...alap, allapot: BLOCKED_MISSING_DATA, hianyzo: r.hianyzo };
    const szoveg = r.szoveg.replace(/\s+([,.!?])/g, '$1').replace(/[ \t]{2,}/g, ' ').trim();
    const sms = smsStatisztika(szoveg);
    return { ...alap, allapot: 'OK', szoveg, sms, figyelmeztetesek: smsFigyelmeztetesek(sms, opc) };
  }

  // e-mail (vagy belso e-mail)
  const t = feloldas(uzenet.targy, ertekek, { opcionalis });
  const { blokkok, hianyzo } = torzsKitolt(uzenet.torzs, ertekek, { opcionalis, allapot: opc.allapot });
  const mind = [...new Set([...t.hianyzo, ...hianyzo])];
  if (mind.length) return { ...alap, allapot: BLOCKED_MISSING_DATA, hianyzo: mind };
  const targy = t.szoveg.replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim(); // fejlec-injekcio ellen egy sor

  const lev = levelKirajzol({
    elotag: uzenet.elotag || '', blokkok, base: opc.base || ALAP_URL,
    lablecMegjegyzes: uzenet.csoport === 'transactional' ? undefined : LABLEC_JEL,
  });
  let html = linkesit(lev.html);
  let szoveg = lev.szoveg;
  if (uzenet.csoport !== 'transactional') {
    const leir = uzenet.csoport === 'marketing' && opc.leiratkozas_link
      ? `<a href="${esc(opc.leiratkozas_link)}" style="color:#6b7776">Leiratkozás</a>` : '';
    html = html.replace(LABLEC_JEL, leir);
    if (leir) szoveg += `\n\nLeiratkozás: ${opc.leiratkozas_link}`;
  }
  return { ...alap, allapot: 'OK', targy, html, szoveg };
}
