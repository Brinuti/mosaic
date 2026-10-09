// 3. Napi kezeloi munkalista: mai idopontok, kerdoiv-allapot, kontraindikacio-jelzes, kezeles igazolasa, kovetkezo idopont
import { h, tolt, oldalCim, toltes, tabla, datumIdo, ido, isoNap, napEltolas, pick, lista, jelveny, gomb, futtat, ertesit, megerosites, figyelmeztetes, uresAllapot, szamKartya, parbeszed } from './crm-ui.js';
import { allapotJelveny, szolgNev } from './crm-cimkek.js';
import * as N from './crm-normal.js';

export default async function nezet(ctx) {
  const { root, api } = ctx;
  const ma = isoNap();
  const nap = /^\d{4}-\d{2}-\d{2}$/.test(ctx.params.get('nap') || '') ? ctx.params.get('nap') : ma;
  const lehetIgazolni = ctx.van(['therapist', 'clinical_lead']);
  const naptar = h('input', { type: 'date', id: 'ml-nap', value: nap, 'aria-label': 'Nap', onchange: (e) => e.target.value && ctx.navigal(`#/munkalista?nap=${e.target.value}`) });
  const ugras = (d) => gomb(d < 0 ? '← Előző nap' : 'Következő nap →', () => ctx.navigal(`#/munkalista?nap=${napEltolas(nap, d)}`), { tipus: 'kicsi' });
  const lista_ = h('div', { 'aria-live': 'polite' });
  tolt(root, oldalCim(nap === ma ? 'Mai munkalista' : `Munkalista: ${nap}`, ugras(-1), naptar, ugras(1), nap !== ma ? gomb('Ma', () => ctx.navigal('#/munkalista'), { tipus: 'kicsi' }) : null),
    lehetIgazolni ? null : figyelmeztetes('info', 'Recepciós nézet: a kezelés igazolását csak a kezelő végezheti.'), lista_);
  const v = await toltes(lista_, () => api.get('/munkalista', { nap }));
  if (v === undefined) return;
  const sorok = lista(v, 'foglalasok').map(N.munkalistaSor);
  const kontra = sorok.filter((s) => s.jelzes);
  tolt(lista_, kontra.length ? figyelmeztetes('veszely', h('strong', null, `${kontra.length} vendégnél kontraindikáció-jelzés! `), 'A kezelés csak szakmai ellenőrzés után indulhat.') : null,
    h('div', { class: 'racs-szam' }, szamKartya('Időpont ma', sorok.length), szamKartya('Igazolt', sorok.filter(igazolt).length), szamKartya('Kérdőív hiányzik', sorok.filter((s) => felmeroHianyzik(s)).length, null, sorok.some(felmeroHianyzik) ? 'figyelem' : '')),
    tabla([
      { cim: 'Idő', ertek: (s) => h('strong', null, ido(s.kezdes)) },
      { cim: 'Vendég', ertek: (s) => (s.vendegId ? h('a', { href: `#/vendegek/${encodeURIComponent(s.vendegId)}` }, s.vendegNev) : s.vendegNev) },
      { cim: 'Szolgáltatás', ertek: (s) => szolgNev(s.szolgaltatas) },
      { cim: 'Kezelő', ertek: (s) => s.kezelo || '–' },
      { cim: 'Kérdőív', ertek: (s) => felmeroJelveny(s) },
      { cim: 'Kontraindikáció', ertek: (s) => (!s.felmeroLathato ? jelveny('nem látható', '') : s.jelzes ? jelveny('JELZÉS: ellenőrzés kell', 'veszely') : jelveny('Nincs jelzés', 'ok')) },
      { cim: 'Következő időpont', ertek: (s) => (s.kovetkezo ? datumIdo(typeof s.kovetkezo === 'object' ? pick(s.kovetkezo, 'kezdes', 'start') : s.kovetkezo) : jelveny('nincs foglalva', 'figyelem')) },
      { cim: 'Állapot', ertek: (s) => (s.igazolt ? jelveny('Igazolva', 'ok') : (s.allapot === 'no_show' ? allapotJelveny('booking', 'no_show') : (s.allapot === 'cancelled' ? allapotJelveny('booking', 'cancelled') : jelveny('Igazolásra vár', 'figyelem')))) },
      { cim: 'Teendő', ertek: (s) => muveletek(s, ctx, lehetIgazolni) },
    ], sorok, { ures: 'Erre a napra nincs foglalás.', felirat: 'Napi foglalások' }));
}

const igazolt = (s) => s.igazolt;
const felmeroHianyzik = (s) => s.felmeroLathato && !s.felmeroKitoltve && !s.igazolt && !['cancelled', 'no_show'].includes(s.allapot);
function felmeroJelveny(s) { if (!s.felmeroLathato) return jelveny('nem látható', ''); return allapotJelveny('felmero', s.felmero === null ? 'missing' : s.felmero); }

function muveletek(s, ctx, lehet) {
  const { api } = ctx;
  const doboz = h('div', { class: 'gombsor', style: 'margin:0' });
  if (!lehet || s.igazolt || ['cancelled', 'no_show'].includes(s.allapot)) return doboz;
  const ig = h('button', { type: 'button', class: 'gomb gomb-fo gomb-kicsi', 'data-akcio': 'igazol', disabled: s.jelzes, title: s.jelzes ? 'Kontraindikáció-jelzés: előbb az Állapotfelmérő nézetben át kell nézni.' : '' }, 'Kezelés igazolása');
  ig.addEventListener('click', futtat(ig, async () => {
    const igen = await megerosites('Kezelés igazolása', `Igazolod, hogy a kezelés ténylegesen megtörtént (${s.vendegNev})? Ez növeli a kúra sorszámát, és nem vonható vissza.`, { megerosit: 'Igen, megtörtént' });
    if (!igen) return;
    const e = await api.post(`/foglalasok/${encodeURIComponent(s.id)}/completed`, {});
    ertesit(`Igazolva${e && e.kezeles_sorszam ? `: ${e.kezeles_sorszam}. kezelés` : ''}.`);
    if (e && e.kamera_kotelezo && s.vendegId) {
      const megnyit = await parbeszed({ cim: 'Hajkamera-felvétel szükséges', torzs: h('p', null, `A(z) ${e.kezeles_sorszam}. alkalmon kötelező a hajkamera-felvétel. Feltöltöd most?`), megerosit: 'Feltöltés', megse: 'Később' });
      if (megnyit) { ctx.navigal(`#/kepek/${encodeURIComponent(s.vendegId)}${e.kezeles_id ? `?kezeles=${encodeURIComponent(e.kezeles_id)}` : ''}`); return; }
    }
    ctx.frissit();
  }));
  const ns = h('button', { type: 'button', class: 'gomb gomb-kicsi', 'data-akcio': 'no-show' }, 'Nem jelent meg');
  ns.addEventListener('click', futtat(ns, async () => {
    if (!(await megerosites('Nem jelent meg', 'Hiteles no-show jelölés. Ez nem completed és nem vonja le a bérletet.', { megerosit: 'Jelölés', veszely: true }))) return;
    await api.post(`/foglalasok/${encodeURIComponent(s.id)}/no-show`, {}); ertesit('Megjelölve: nem jelent meg.'); ctx.frissit();
  }));
  doboz.append(ig, ns);
  if (felmeroHianyzik(s)) {
    const k = h('button', { type: 'button', class: 'gomb gomb-kicsi', 'data-akcio': 'felmero-kiad' }, 'Kérdőív-link');
    k.addEventListener('click', futtat(k, async () => {
      const r = await api.post(`/foglalasok/${encodeURIComponent(s.id)}/felmero-kiad`, {});
      if (r && r.mar) { ertesit('A kérdőív már kiadva (a link csak kiadáskor látható).'); return; }
      const t = r && (r.link || r.token); const url = t ? (String(t).startsWith('http') ? t : `${location.origin}/api/crm/public/felmero/${t}`) : '';
      await parbeszed({ cim: 'Kérdőív-link a vendégnek', torzs: h('div', null, h('p', null, 'Ezt a linket add át a vendégnek (személyes, csak most látható):'), h('input', { type: 'text', readonly: true, value: url, 'aria-label': 'Kérdőív-link', onfocus: (e) => e.target.select() })), megerosit: 'Kész', megse: 'Bezár' });
    }));
    doboz.append(k);
  }
  return doboz;
}
