// 13. Vendegprofil-osszevonasi sor: automatikus (e-mail ES telefon egyezes) vs kezi jovahagyas, bizonytalansag, visszafordithato
import { h, tolt, oldalCim, toltes, tabla, fulek, kartya, mezo, beviteli, pick, lista, jelveny, futtat, ertesit, figyelmeztetes, megerosites, urlapParbeszed, datumIdo, uresAllapot, humanizal } from './crm-ui.js';

const JOVAHAGYOTT = []; // ebben a munkamenetben jovahagyott osszevonasok (a visszafordithatosaghoz; a szerver nem listazza az audit-sorokat)
const OK = { email_match: 'E-mail egyezik, telefon nem', phone_match: 'Telefon egyezik, e-mail nem', name_only: 'Csak a név egyezik', uncertain: 'Bizonytalan egyezés' };

export default async function nezet(ctx) {
  const t = h('div', { 'aria-live': 'polite' });
  tolt(ctx.root, oldalCim('Vendégprofil-összevonási sor'),
    figyelmeztetes('info', 'Automatikus összevonás csak ellenőrzött, azonos e-mail ÉS telefonszám mellett történik. Bizonytalan esetben az érintett kezelő hagyja jóvá. Név alapján soha nem vonunk össze. Minden összevonás naplózott és visszafordítható; az eredeti azonosítók megmaradnak.'), t);
  const v = await toltes(t, () => ctx.api.get('/osszevonas'));
  if (v === undefined) return;
  const fuggo = lista(v, 'keresek', 'kerelmek', 'osszevonasok');
  const donthet = ctx.van(['therapist', 'clinical_lead']);   // merge.approve: kezelo / szakmai vezeto (a szalonvezeto csak olvas)
  const p = (x) => x || {};
  const vendegCella = (v_) => (v_ ? h('div', null, h('strong', null, v_.nev || '–'), h('div', { class: 'kicsi halvany' }, v_.id ? h('a', { href: `#/vendegek/${encodeURIComponent(v_.id)}` }, 'profil megnyitása') : '')) : '–');
  const jovahagyG = (s) => { const b = h('button', { type: 'button', class: 'gomb gomb-kicsi gomb-fo', 'data-akcio': 'jovahagy' }, 'Összevonás jóváhagyása'); b.addEventListener('click', futtat(b, async () => {
    if (!(await megerosites('Összevonás jóváhagyása', 'A két profil egy vendéggé olvad (az eredeti azonosítók megmaradnak, a művelet visszafordítható).', { megerosit: 'Jóváhagyom' }))) return;
    const r = await ctx.api.post(`/osszevonas/${encodeURIComponent(s.id)}/jovahagy`, {});
    if (r && r.merge_audit_id) JOVAHAGYOTT.unshift({ auditId: r.merge_audit_id, forras: p(s.forras).nev, cel: p(s.cel).nev, ido: Math.floor(Date.now() / 1000) });
    ertesit('Összevonva.'); ctx.frissit();
  })); return b; };
  const elutasitG = (s) => { const b = h('button', { type: 'button', class: 'gomb gomb-kicsi', 'data-akcio': 'elutasit' }, 'Különálló marad'); b.addEventListener('click', futtat(b, async () => { await ctx.api.post(`/osszevonas/${encodeURIComponent(s.id)}/elutasit`, {}); ertesit('A profilok külön maradnak.'); ctx.frissit(); })); return b; };
  const visszafordit = async (auditId) => {
    const r = await urlapParbeszed('Összevonás visszafordítása', [{ kulcs: 'ok', felirat: 'Ok (kötelező, naplózott)', el: h('textarea') }], { megerosit: 'Visszafordítom', veszely: true });
    if (!r) return; if (r.ok.trim().length < 3) { ertesit('Az indoklás kötelező.', 'hiba'); return; }
    await ctx.api.post(`/osszevonas-audit/${encodeURIComponent(auditId)}/visszafordit`, { ok: r.ok.trim() }); ertesit('Visszafordítva.'); ctx.frissit();
  };
  const egyezes = (s) => [s.email_egyezes ? jelveny('e-mail ✓', 'ok') : jelveny('e-mail eltér', 'veszely'), ' ', s.telefon_egyezes ? jelveny('telefon ✓', 'ok') : jelveny('telefon eltér', 'veszely'), ' ', s.nev_egyezes ? jelveny('név ✓', 'info') : ''];
  const auditId = beviteli({ id: 'ov-audit', placeholder: 'Összevonási audit-azonosító (UUID)' });
  tolt(t, fulek([
    { cim: `Jóváhagyásra vár (${fuggo.length})`, tolt: (c) => tolt(c, tabla([
      { cim: 'Profil A (beolvad)', ertek: (s) => vendegCella(pick(s, 'forras', 'vendeg_a')) }, { cim: 'Profil B (marad)', ertek: (s) => vendegCella(pick(s, 'cel', 'vendeg_b')) },
      { cim: 'Egyezés', ertek: egyezes }, { cim: 'Bizonytalanság oka', ertek: (s) => jelveny(OK[s.ok] || (s.ok ? humanizal(s.ok) : 'bizonytalan egyezés'), 'figyelem') }, { cim: 'Kérve', ertek: (s) => datumIdo(s.kerve) },
      { cim: '', ertek: (s) => (donthet ? h('div', { class: 'gombsor', style: 'margin:0' }, jovahagyG(s), elutasitG(s)) : h('span', { class: 'halvany kicsi' }, 'Jóváhagyás: érintett kezelő / szakmai vezető')) },
    ], fuggo, { ures: 'Nincs jóváhagyásra váró összevonás.', felirat: 'Összevonási kérelmek' })) },
    { cim: 'Visszafordítás', tolt: (c) => tolt(c, ...(!donthet ? [uresAllapot('Az összevonást az érintett kezelő vagy a szakmai vezető fordíthatja vissza.')] : [kartya('Ebben a munkamenetben jóváhagyott összevonások', JOVAHAGYOTT.length ? tabla([{ cim: 'Mikor', ertek: (s) => datumIdo(s.ido) }, { cim: 'Összevont profilok', ertek: (s) => `${s.forras || '?'} → ${s.cel || '?'}` },
      { cim: '', ertek: (s) => { const b = h('button', { type: 'button', class: 'gomb gomb-kicsi gomb-veszely', 'data-akcio': 'visszafordit' }, 'Visszafordítás'); b.addEventListener('click', futtat(b, () => visszafordit(s.auditId))); return b; } }], JOVAHAGYOTT) : uresAllapot('Ebben a munkamenetben még nem volt jóváhagyás.', 'Korábbi összevonás az audit-azonosítóval fordítható vissza.')),
      kartya('Visszafordítás azonosítóval', h('div', { class: 'kereso' }, auditId, (() => { const b = h('button', { type: 'button', class: 'gomb gomb-veszely' }, 'Visszafordítás'); b.addEventListener('click', futtat(b, async () => { if (!auditId.value.trim()) { ertesit('Add meg az azonosítót.', 'hiba'); return; } await visszafordit(auditId.value.trim()); })); return b; })()))])) },
  ]));
}
