// 12. Kurazaro dokumentum: a 11. igazolt kezeles utan A5 zaras az 1/3/5/10 osszehasonlitasokkal, egyeni fenntartasi javaslat, kuldes kesz adat utan
import { h, tolt, oldalCim, toltes, kartya, adatsor, pick, lista, jelveny, futtat, ertesit, figyelmeztetes, megerosites, datumIdo } from './crm-ui.js';
import { allapotJelveny } from './crm-cimkek.js';
import { vendegValaszto } from './crm-vendegvalaszto.js';
import * as N from './crm-normal.js';

export default async function nezet(ctx) {
  const gid = ctx.alfa[0];
  if (!gid) {
    tolt(ctx.root, oldalCim('Kúrazáró dokumentum'), h('p', { class: 'halvany' }, 'A 11. igazolt kezelés után külön A5 záróösszefoglaló készül: kiinduló állapot, személyes cél, az 1/3/5/10. alkalom képei privát linken, tényszerű záróértékelés és egyéni fenntartási javaslat. Nem diagnózis, nem garantált javulás.'), vendegValaszto(ctx, 'Kúrazárás', (id) => `#/kurazaro/${encodeURIComponent(id)}`));
    return;
  }
  const { api, root } = ctx;
  const cel = h('div');
  tolt(root, oldalCim('Kúrazáró dokumentum', h('a', { class: 'gomb', href: '#/kurazaro' }, 'Másik vendég')), cel);
  const p = await toltes(cel, () => api.get(`/vendegek/${encodeURIComponent(gid)}`));
  if (p === undefined) return;
  const kura = N.kura(p.kura) || {};
  const idx = Number(kura.sorszam || 0);
  const kesz = idx >= 11 || kura.allapot === 'completed_11';
  const alkalmak = new Set(lista(p.kepek).map((k) => Number(k.alkalom)));
  const hianyKep = [1, 3, 5, 10].filter((x) => !alkalmak.has(x));
  const zaroDok = lista(p.dokumentumok).find((d) => ['closing', 'kurazaro'].includes(pick(d, 'fajta', 'tipus', 'kind')));
  const zaroAllapot = zaroDok ? pick(zaroDok, 'allapot', 'status') : null;
  const kuldheto = ['therapist_final', 'generated_pdf', 'sent'].includes(zaroAllapot);
  const courseId = kura.id;
  const g = h('button', { type: 'button', class: 'gomb gomb-fo', id: 'kz-general', disabled: !kesz || !courseId || !kuldheto }, zaroAllapot === 'sent' ? 'Kúrazáró újraküldése' : 'Kúrazáró küldése a vendégnek');
  g.addEventListener('click', futtat(g, async () => {
    if (!(await megerosites('Kúrazáró dokumentum', `A záródokumentum A5 PDF-ként és e-mailben megy a vendégnek (üzemmód: ${ctx.uzemmod() === 'eles' ? 'ÉLES – valódi e-mail!' : 'dry-run, valódi küldés nincs'}).`, { megerosit: 'Küldés' }))) return;
    const r = await api.post(`/kurak/${encodeURIComponent(courseId)}/kurazaro`, {});
    ertesit(r && r.mar ? 'A kúrazáró már korábban a küldési sorba került.' : 'A kúrazáró a küldési sorba került.');
    ctx.frissit();
  }));
  const szerk = zaroDok && pick(zaroDok, 'kezeles_id', 'session_id') ? h('a', { class: 'gomb', href: `#/kuraterv/${encodeURIComponent(pick(zaroDok, 'kezeles_id', 'session_id'))}` }, zaroAllapot === 'draft' || zaroAllapot === 'missing' ? 'Kitöltés a szerkesztőben' : 'Megnyitás a szerkesztőben') : null;
  tolt(cel, h('h2', null, (p.vendeg && p.vendeg.nev) || 'Vendég'),
    !kesz ? figyelmeztetes('figyelem', h('strong', null, 'A kúra még nem érte el a 11. igazolt kezelést. '), `Jelenlegi sorszám: ${idx || '–'}. A zárás a 11. kezelés kezelői igazolása után indítható.`) : figyelmeztetes('ok', h('strong', null, 'A kúra elérte a 11. igazolt kezelést.')),
    kartya('Előfeltételek', adatsor([['Kúra állapota', kura.allapot ? allapotJelveny('course', kura.allapot) : '–'], ['1/3/5/10 kamerakép', hianyKep.length ? jelveny(`Hiányzik: ${hianyKep.map((x) => `${x}.`).join(', ')} alkalom`, 'figyelem') : jelveny('Mind megvan', 'ok')], ['Záródokumentum', zaroDok ? allapotJelveny('plan', zaroAllapot) : 'még nincs (a 11. kezelés igazolásakor jön létre)']]),
      kesz && !kuldheto ? h('p', { class: 'halvany kicsi' }, 'A záródokumentumot előbb ki kell tölteni és kezelőként véglegesíteni; csak ezután küldhető el.') : null,
      h('p', { class: 'halvany kicsi' }, 'A 11. alkalmon nincs új kötelező kamerakép; a korábbi képek használhatók. Fenntartó kezelés csak külön szakmai indoklással javasolható.'),
      h('div', { class: 'gombsor' }, szerk, g)));
}
