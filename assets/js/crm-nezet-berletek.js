// 7. Berletek es ajandekok: 5/10 vasarlas, lejarat, felhasznalas, ajandek-atadas, hosszabbitas / refund / korrekcio (csak jogosultnak)
import { h, tolt, oldalCim, toltes, tabla, kartya, mezo, beviteli, valaszto, ft, datum, datumIdo, pick, lista, jelveny, gomb, futtat, ertesit, figyelmeztetes, uresAllapot, urlapParbeszed, megerosites, isoNap, adatsor } from './crm-ui.js';
import { allapotJelveny, BERLET } from './crm-cimkek.js';
import { vendegValaszto } from './crm-vendegvalaszto.js';
import * as N from './crm-normal.js';

// Arak a spec szerint (a backend a hiteles forras: crm/lib/constants.js; itt csak tajekoztato felirat)
const CSOMAG = {
  package_5: { nev: '5 alkalmas bérlet', ar: 130000, ajandek: '1 l sampon', ervenyesseg: '6 hónap' },
  package_10: { nev: '10 alkalmas bérlet', ar: 260000, ajandek: '1 l sampon + 1 l balzsam', ervenyesseg: '12 hónap' },
};

export default async function nezet(ctx) {
  const gid = ctx.alfa[0];
  if (!gid) {
    tolt(ctx.root, oldalCim('Bérletek és ajándékok'), h('p', { class: 'halvany' }, 'Bérletet csak személyesen, teljes összeg előre fizetésével lehet vásárolni. A bérlet nem átruházható. Az első kezelés nem fogyaszt bérletalkalmat.'), vendegValaszto(ctx, 'Bérletek', (id) => `#/berletek/${encodeURIComponent(id)}`));
    return;
  }
  const { api, root } = ctx;
  const iras = ctx.van(['reception', 'salon_manager']);
  const vezeto = ctx.van(['salon_manager']);
  const cel = h('div');
  tolt(root, oldalCim('Bérletek és ajándékok', h('a', { class: 'gomb', href: '#/berletek' }, 'Másik vendég'), h('a', { class: 'gomb', href: `#/vendegek/${encodeURIComponent(gid)}` }, 'Vendégprofil')), cel);
  const v = await toltes(cel, () => api.get(`/vendegek/${encodeURIComponent(gid)}/berletek`));
  if (v === undefined) return;
  const sorok = lista(v, 'berletek').map(N.berlet);
  const muvelet = (b, nev, cim, mezok, ut, torzsEpit) => {
    const g = h('button', { type: 'button', class: 'gomb gomb-kicsi', 'data-akcio': nev }, cim);
    g.addEventListener('click', futtat(g, async () => {
      const r = await urlapParbeszed(cim, mezok(b), { megerosit: 'Rögzítés', veszely: nev === 'refund' });
      if (!r) return;
      if (!r.ok || !r.ok.trim()) { ertesit('Az indoklás kötelező (naplózott művelet).', 'hiba'); return; }
      await api.post(`/berletek/${encodeURIComponent(b.id)}/${ut}`, torzsEpit(r, b)); ertesit('Rögzítve.'); ctx.frissit();
    }));
    return g;
  };
  const okMezo = () => ({ kulcs: 'ok', felirat: 'Indoklás (kötelező, naplózott)', el: h('textarea') });
  const ajandekLista = (b) => (b.ajandekok.length ? h('ul', { class: 'kerdes-lista' }, b.ajandekok.map((a) => h('li', null, N.AJANDEK_NEV[a.fajta] || a.fajta, ' – ', jelveny(N.AJANDEK_ALLAPOT[a.allapot] || a.allapot, a.allapot === 'handed_over' ? 'ok' : (a.allapot === 'due' ? 'figyelem' : '')), ' ',
    iras && a.allapot === 'due' ? (() => { const g = h('button', { type: 'button', class: 'gomb gomb-kicsi gomb-arany', 'data-akcio': 'ajandek-atad' }, 'Átadva'); g.addEventListener('click', futtat(g, async () => { if (!(await megerosites('Ajándék átadása', `${N.AJANDEK_NEV[a.fajta] || 'Ajándék'}: a teljes vételár kifizetésekor átadtad a vendégnek?`, { megerosit: 'Átadva' }))) return; await api.post(`/ajandekok/${encodeURIComponent(a.id)}/atad`, {}); ertesit('Ajándék átadása rögzítve.'); ctx.frissit(); })); return g; })() : null))) : h('span', { class: 'halvany' }, '–'));
  tolt(cel,
    iras ? figyelmeztetes('info', 'Ajándékok: 5-ös = 1 l sampon, 10-es = 1 l sampon + 1 l balzsam. Első kezelés előtt vagy aznap vásárolva mindkettőhöz jár egy kis kiszerelésű Oxygeni termék (készletfüggő). Az ajándékot a teljes vételár kifizetésekor adjuk át.') : null,
    tabla([
      { cim: 'Típus', ertek: (b) => [BERLET[b.tipus] || b.tipus, b.korai ? [' ', jelveny('korai vásárlás', 'info')] : ''] },
      { cim: 'Vásárlás', ertek: (b) => datum(b.vasarolva) },
      { cim: 'Lejárat', ertek: (b) => datum(b.lejarat) },
      { cim: 'Használt', ertek: (b) => b.hasznalt ?? '–', osztaly: 'jobbra' },
      { cim: 'Lefoglalt', ertek: (b) => b.foglalt ?? '–', osztaly: 'jobbra' },
      { cim: 'Szabad', ertek: (b) => h('strong', null, b.szabad ?? '–'), osztaly: 'jobbra' },
      { cim: 'Ajándékok', ertek: ajandekLista },
      { cim: 'Állapot', ertek: (b) => allapotJelveny('package', b.allapot) },
      { cim: 'Műveletek', ertek: (b) => {
        const d = h('div', { class: 'gombsor', style: 'margin:0' });
        if (vezeto && b.allapot !== 'refunded') d.append(
          muvelet(b, 'hosszabbit', 'Hosszabbítás', () => [{ kulcs: 'honap', felirat: 'Hosszabbítás (hónap, 1–24)', el: h('input', { type: 'number', min: '1', max: '24', value: '1' }) }, okMezo()], 'hosszabbit', (r) => ({ honap: Number(r.honap), ok: r.ok.trim() })),
          muvelet(b, 'refund', 'Refund', (bb) => [{ kulcs: 'mod', felirat: 'Mód', el: valaszto([['teljes', 'Teljes (0 felhasznált alkalom, ellenjavallat)'], ['egyedi', 'Egyedi elbírálás (összeg megadásával)']], 'egyedi') }, { kulcs: 'osszeg', felirat: 'Egyedi összeg (Ft, csak egyedi módnál)', el: h('input', { type: 'number', min: '1' }) }, { kulcs: 'ajandek', felirat: 'Az ajándékok állapota', el: valaszto([['bontatlan', 'Bontatlan, visszakérve'], ['felbontott', 'Felbontott, nem vonjuk le']], 'bontatlan') }, okMezo()], 'refund', (r, bb) => ({ mod: r.mod, ...(r.osszeg ? { osszeg: Number(r.osszeg) } : {}), ajandek_allapot: Object.fromEntries(bb.ajandekok.map((a) => [a.id, r.ajandek])), ok: r.ok.trim() })),
          muvelet(b, 'korrekcio', 'Kézi korrekció', () => [{ kulcs: 'delta', felirat: 'Alkalmak változása (+/−)', el: h('input', { type: 'number', value: '1' }) }, okMezo()], 'korrekcio', (r) => ({ delta: Number(r.delta), ok: r.ok.trim() })));
        return d;
      } },
    ], sorok, { ures: 'A vendégnek még nincs bérlete.', felirat: 'Bérletek' }),
    iras ? vasarlas(ctx, gid) : h('p', { class: 'halvany kicsi' }, 'Bérletet vásárolni és ajándékot átadni a recepció és a szalonvezető tud.'));
}

function vasarlas(ctx, gid) {
  const tipus = valaszto(Object.entries(CSOMAG).map(([k, c]) => [k, `${c.nev} – ${ft(c.ar)}`]), 'package_10', { id: 'bv-tipus' });
  const fiz = h('input', { type: 'date', id: 'bv-fiz', value: isoNap() });
  const ajandek = h('input', { type: 'checkbox', id: 'bv-ajandek' });
  const info = h('div', { class: 'halvany kicsi', 'aria-live': 'polite' });
  const frissit = () => { const c = CSOMAG[tipus.value]; tolt(info, `Ajándék: ${c.ajandek} · érvényesség: ${c.ervenyesseg} · ${c.nev.startsWith('5') ? '5' : '10'} további alkalom.`); };
  tipus.addEventListener('change', frissit); frissit();
  const gombEl = h('button', { type: 'button', class: 'gomb gomb-fo', id: 'bv-vasarlas' }, 'Vásárlás rögzítése');
  gombEl.addEventListener('click', futtat(gombEl, async () => {
    const c = CSOMAG[tipus.value];
    if (!(await megerosites('Bérletvásárlás rögzítése', `${c.nev}: a teljes ${ft(c.ar)} befizetésre került a helyszínen?`, { megerosit: 'Igen, befizetve' }))) return;
    await ctx.api.post('/berletek', { guest_id: gid, tipus: tipus.value, fizetes_ideje: fiz.value, ajandek_atadva: ajandek.checked });
    ertesit('Bérlet rögzítve.'); ctx.frissit();
  }));
  return kartya('Új bérlet rögzítése', h('div', { class: 'mezok-sor' }, mezo('Típus', tipus), mezo('Fizetés ideje', fiz)), info,
    h('label', { class: 'jelolo' }, ajandek, 'Az ajándékot a fizetéskor átadtuk'), h('div', { class: 'gombsor' }, gombEl));
}
