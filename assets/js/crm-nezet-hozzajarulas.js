// 10. Hozzajarulasok: csatornankent (e-mail, SMS, kep-marketing kulon), valtozastortenet, szovegverzio
import { h, tolt, oldalCim, toltes, tabla, kartya, mezo, beviteli, pick, lista, jelveny, rvJelzo, futtat, ertesit, figyelmeztetes, megerosites, datumIdo } from './crm-ui.js';
import { CSATORNA } from './crm-cimkek.js';
import * as N from './crm-normal.js';
import { vendegValaszto } from './crm-vendegvalaszto.js';

const MARKETING = ['email_marketing', 'sms_marketing', 'image_marketing'];
const igen = N.aktivHozzajarulas;

export default async function nezet(ctx) {
  const gid = ctx.alfa[0];
  if (!gid) {
    tolt(ctx.root, oldalCim('Hozzájárulások'), h('p', { class: 'halvany' }, 'A marketing e-mail, a marketing SMS és a képmarketing külön, önkéntes, visszavonható hozzájárulás. Semmilyen hozzájárulás nem előfeltétele a kezelésnek vagy a felmérőnek.'), vendegValaszto(ctx, 'Hozzájárulások', (id) => `#/hozzajarulas/${encodeURIComponent(id)}`));
    return;
  }
  const { api, root } = ctx;
  const cel = h('div');
  tolt(root, oldalCim('Hozzájárulások', h('a', { class: 'gomb', href: '#/hozzajarulas' }, 'Másik vendég'), h('a', { class: 'gomb', href: `#/vendegek/${encodeURIComponent(gid)}` }, 'Vendégprofil')), cel);
  const v = await toltes(cel, () => api.get(`/vendegek/${encodeURIComponent(gid)}/hozzajarulasok`));
  if (v === undefined) return;
  const hj = N.hozzajarulas(v);
  const esemenyek = hj.tortenet.slice().reverse();
  const allapotTerkep = hj.csatornak;
  const verzioEl = beviteli({ id: 'hj-verzio', value: 'REQUIRES_VERIFICATION', 'aria-label': 'Szövegverzió' });
  const csatornak = [...MARKETING, 'privacy'];
  const kartyak = csatornak.map((k) => {
    const a = allapotTerkep[k] || {}; const aktiv = igen(a.allapot);
    const g = h('button', { type: 'button', class: `gomb gomb-kicsi ${aktiv ? 'gomb-veszely' : 'gomb-fo'}`, 'data-csatorna': k, 'data-allapot': aktiv ? 'withdrawn' : 'granted' }, aktiv ? 'Visszavonás' : 'Hozzájárulás rögzítése');
    g.addEventListener('click', futtat(g, async () => {
      const uj = aktiv ? 'withdrawn' : 'granted';
      if (!(await megerosites(aktiv ? 'Hozzájárulás visszavonása' : 'Hozzájárulás rögzítése', aktiv ? `${CSATORNA[k]}: visszavonod a hozzájárulást? Ezután ilyen üzenet nem megy a vendégnek.` : `${CSATORNA[k]}: a vendég önkéntesen, kifejezetten hozzájárult (a szövegverzió: ${verzioEl.value})?`, { megerosit: aktiv ? 'Visszavonás' : 'Rögzítés', veszely: aktiv }))) return;
      await api.post(`/vendegek/${encodeURIComponent(gid)}/hozzajarulasok`, { csatorna: k, allapot: uj, szoveg_verzio: verzioEl.value.trim() || 'REQUIRES_VERIFICATION' });
      ertesit('Rögzítve.'); ctx.frissit();
    }));
    return kartya(CSATORNA[k], h('div', null, aktiv ? jelveny('Megadva', 'ok') : jelveny(a.allapot ? 'Visszavonva / nincs' : 'Nincs hozzájárulás', a.allapot ? 'veszely' : ''), a.ido ? h('span', { class: 'halvany kicsi' }, ` · ${datumIdo(a.ido)}`) : null, a.verzio ? h('div', { class: 'halvany kicsi' }, `Szövegverzió: ${a.verzio}`) : null), k === 'image_marketing' ? h('p', { class: 'halvany kicsi' }, 'A képmarketing önálló, kifejezett hozzájárulás; a kezelési képek megosztása ettől független.') : null, ctx.van(['reception', 'therapist', 'clinical_lead']) ? h('div', { class: 'gombsor' }, g) : null);
  });
  tolt(cel, figyelmeztetes('figyelem', rvJelzo(), ' A hozzájárulási szövegek jogi verziója ellenőrzésre vár; a szövegverzió mezőben a használt verzió azonosítóját add meg.'),
    h('div', { class: 'kartya' }, mezo('Hozzájárulási szöveg verziója', verzioEl)),
    h('div', { class: 'racs' }, ...kartyak),
    kartya('Változástörténet', tabla([
      { cim: 'Mikor', ertek: (e) => datumIdo(e.ido) }, { cim: 'Csatorna', ertek: (e) => CSATORNA[e.csatorna] || e.csatorna },
      { cim: 'Esemény', ertek: (e) => (igen(e.allapot) ? jelveny('Megadva', 'ok') : jelveny('Visszavonva', 'veszely')) },
      { cim: 'Szövegverzió', ertek: (e) => e.verzio || '–' }, { cim: 'Forrás', ertek: (e) => e.forras || '–' },
    ], esemenyek, { ures: 'Még nincs rögzített változás.', felirat: 'Hozzájárulás-események' })));
}
