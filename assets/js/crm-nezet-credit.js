// 8. Hajkamera-beszamitas: credit_eligible, hatarido, first-booking proof, manualis 4 990 Ft levonas (egyszer)
import { h, tolt, oldalCim, toltes, kartya, adatsor, valaszto, mezo, ft, datum, datumIdo, pick, lista, jelveny, futtat, ertesit, figyelmeztetes, uresAllapot, megerosites } from './crm-ui.js';
import { szolgNev } from './crm-cimkek.js';
import { vendegValaszto } from './crm-vendegvalaszto.js';
import { CREDIT_ALLAPOT } from './crm-normal.js';
import * as N from './crm-normal.js';

export default async function nezet(ctx) {
  const gid = ctx.alfa[0];
  if (!gid) {
    tolt(ctx.root, oldalCim('Hajkamera-beszámítás'), h('p', { class: 'halvany' }, 'A 4 990 Ft-os hajkamerás felmérés összege egyszer, manuálisan levonható az első (29 900 Ft-os) kezelésből, ha a felmérést követő 30 napon belül első kezelési foglalás keletkezik. A rendszer csak figyelmeztet; a levonást a helyszínen jelöli a kezelő vagy a recepció.'), vendegValaszto(ctx, 'Beszámítás', (id) => `#/credit/${encodeURIComponent(id)}`));
    return;
  }
  const { api, root } = ctx;
  const cel = h('div');
  tolt(root, oldalCim('Hajkamera-beszámítás', h('a', { class: 'gomb', href: '#/credit' }, 'Másik vendég'), h('a', { class: 'gomb', href: `#/vendegek/${encodeURIComponent(gid)}` }, 'Vendégprofil')), cel);
  const c = await toltes(cel, () => api.get(`/vendegek/${encodeURIComponent(gid)}/credit`));
  if (c === undefined) return;
  const lista_ = lista(c, 'creditek').map(N.credit);
  const lehet = ctx.van(['reception', 'therapist', 'clinical_lead']);
  if (!lista_.length) { tolt(cel, uresAllapot('A vendégnek nincs hajkamerás felmérése beszámítással.', 'Felmérés (4 990 Ft) után, 30 napos ablakkal jelenik meg.')); return; }
  const kartyak = lista_.slice().reverse().map((cr) => {
    const felh = !!cr.felhasznalva;
    const g = h('button', { type: 'button', class: 'gomb gomb-fo', 'data-akcio': 'levonas', disabled: !cr.jogosult || felh || !cr.elsoFoglalas }, `${ft(cr.osszeg ?? 4990)} levonása`);
    g.addEventListener('click', futtat(g, async () => {
      if (!(await megerosites('Beszámítás levonása', `${ft(cr.osszeg ?? 4990)} levonása az első kezelés árából${cr.fizetendo ? ` (fizetendő: ${ft(cr.fizetendo)})` : ''}. Ez a credit egyszer használható fel, a művelet nem vonható vissza.`, { megerosit: 'Levonás rögzítése', veszely: true }))) return;
      await api.post(`/credit/${encodeURIComponent(cr.id)}/levonas`, { booking_id: cr.elsoFoglalas }); ertesit('A beszámítás rögzítve.'); ctx.frissit();
    }));
    return kartya(`Felmérés-credit (${CREDIT_ALLAPOT[cr.allapot] || cr.allapot})`,
      felh ? figyelmeztetes('info', h('strong', null, 'Már felhasznált credit. '), `Levonva: ${datumIdo(cr.felhasznalva)}. Ugyanaz a credit kétszer nem használható fel.`)
        : cr.jogosult ? figyelmeztetes('ok', h('strong', null, 'Jogosult a beszámításra. '), cr.hatarido ? `Határidő: ${datum(cr.hatarido)}${cr.maradekNap != null ? ` (${cr.maradekNap} nap)` : ''}.` : '')
          : figyelmeztetes('figyelem', cr.allapot === 'open' ? 'Még nincs első kezelési foglalás: a jogosultság a foglalással jön létre (a határidőn belül).' : 'Ez a credit nem beszámítható (lejárt vagy megszűnt).'),
      adatsor([['Állapot', jelveny(CREDIT_ALLAPOT[cr.allapot] || cr.allapot || '–', cr.jogosult ? 'ok' : '')], ['Összeg', ft(cr.osszeg ?? 4990)], ['Határidő (30 nap)', cr.hatarido ? datum(cr.hatarido) : '–'], ['Első kezelési foglalás (bizonyíték)', cr.elsoFoglalas ? h('code', null, String(cr.elsoFoglalas)) : 'még nincs'], ['Fizetendő az első kezelésre', cr.fizetendo != null ? ft(cr.fizetendo) : '–'], ['Felhasználva', felh ? datumIdo(cr.felhasznalva) : 'még nem']]),
      lehet && !felh ? h('div', { class: 'gombsor' }, g) : null);
  });
  tolt(cel, ...kartyak);
}
