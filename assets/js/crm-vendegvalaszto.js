// Kozos vendegvalaszto (kereses -> kivalasztas). A talalatban csak maszkolt elerhetoseg jelenik meg.
import { h, tolt, toltes, tabla, uresAllapot, lista, gomb } from './crm-ui.js';

export function vendegValaszto(ctx, aktualisCim, hash) {
  const q = h('input', { type: 'search', id: 'vv-q', 'aria-label': 'Vendég keresése', placeholder: 'Vendég neve, e-mail- vagy telefonrészlet', autocomplete: 'off' });
  const t = h('div', { 'aria-live': 'polite' });
  const keres = async () => {
    if (q.value.trim().length < 2) { tolt(t, uresAllapot('Írj be legalább 2 karaktert.')); return; }
    const v = await toltes(t, () => ctx.api.get('/vendegek', { q: q.value.trim() }));
    if (v === undefined) return;
    tolt(t, tabla([{ cim: 'Név', ertek: (s) => s.nev || '–' }, { cim: 'E-mail', ertek: (s) => s.email_maszkolt || '–' }, { cim: 'Telefon', ertek: (s) => s.telefon_maszkolt || '–' },
      { cim: '', ertek: (s) => h('a', { class: 'gomb gomb-kicsi gomb-fo', href: hash(s.id) }, aktualisCim) }], lista(v, 'vendegek'), { ures: 'Nincs találat.' }));
  };
  tolt(t, uresAllapot('Keress rá a vendégre.'));
  return h('div', null, h('form', { class: 'kereso', role: 'search', onsubmit: (e) => { e.preventDefault(); keres(); } }, q, h('button', { type: 'submit', class: 'gomb gomb-fo' }, 'Keresés')), t);
}
