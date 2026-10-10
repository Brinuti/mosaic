// Kepkuldes (tablet): a hajkamerahoz csatlakoztatott keszuleken ide kuldod a kepeket, vendeg megadasa nelkul.
// A kezelo (masik eszkozon is) a "Kezeles kozben" nezetben nezi meg a beerkezo kepet, es o rendeli a vendeghez / alkalomhoz.
import { h, tolt, oldalCim, kartya, futtat, ertesit, figyelmeztetes, kepAtmeretez, megerosites, datumIdo } from './crm-ui.js';
import { varakozoMegosztasok, megosztottBlob, megosztottTorol } from './crm-megosztas.js';

export default async function nezet(ctx) {
  const { api, root } = ctx;
  const naplo = h('ul', { class: 'kk-naplo' });
  const varakozo = h('div');
  const rajzVarakozo = async () => {
    try {
      const v = await api.get('/kep-beerkezo');
      const k = v.kepek || [];
      tolt(varakozo, k.length ? h('div', { class: 'kk-mini-racs' }, k.map((x) => {
        const g = h('button', { type: 'button', class: 'gomb gomb-kicsi', 'aria-label': 'Kép elvetése' }, 'Elvetés');
        g.addEventListener('click', futtat(g, async () => {
          if (!(await megerosites('Kép elvetése', 'A kép törlődik a beérkezőből.', { megerosit: 'Elvetés', veszely: true }))) return;
          await api.del(`/kep-beerkezo/${encodeURIComponent(x.id)}`); rajzVarakozo();
        }));
        return h('figure', { class: 'kk-mini' }, h('img', { src: api.url(`/kep-beerkezo/${encodeURIComponent(x.id)}/kep`), alt: 'Beérkezett kép', loading: 'lazy' }), h('figcaption', { class: 'kicsi halvany' }, datumIdo(x.created_at)), g);
      })) : h('p', { class: 'halvany' }, 'Nincs beérkezett, hozzá nem rendelt kép.'));
    } catch (e) { if (e.status === 401) throw e; tolt(varakozo, figyelmeztetes('figyelem', e.message)); }
  };
  const fajl = h('input', { type: 'file', accept: 'image/*', multiple: true, class: 'csak-olvaso', id: 'kk-kuldo-fajl' });
  const cimke = h('label', { class: 'gomb gomb-fo kk-nagy', for: 'kk-kuldo-fajl' }, 'Képek kiválasztása és küldése');
  const kuld = async (lista) => {
    cimke.setAttribute('aria-busy', 'true');
    for (const { nev, fj, utana } of lista) {
      const sor = h('li', null, `${nev}: küldés…`); naplo.prepend(sor);
      try { const { blob } = await kepAtmeretez(fj); await api.feltolt('/kep-beerkezo', null, blob); sor.textContent = `${nev}: elküldve ✓`; if (utana) await utana(); } catch (e) { sor.textContent = `${nev}: nem sikerült – ${e.message || 'hiba'}`; }
    }
    cimke.removeAttribute('aria-busy'); ertesit('Kész. A kezelő a „Kezelés közben” nézetben rendelheti a vendéghez.'); rajzVarakozo();
  };
  fajl.addEventListener('change', async () => {
    const lista = [...(fajl.files || [])].map((fj) => ({ nev: fj.name || 'kép', fj })); if (!lista.length) return;
    await kuld(lista); fajl.value = '';
  });
  tolt(root, oldalCim('Képküldés (tablet)'),
    h('p', null, 'Ezen a készüléken, amelyhez a hajkamera csatlakozik, küldd el a képeket. Vendéget itt nem kell megadni: a kezelő a telefonján vagy gépén nézi meg a képet, és ő rendeli a vendéghez.'),
    kartya('Küldés', cimke, fajl, h('p', { class: 'halvany kicsi' }, 'Több képet is kiválaszthatsz egyszerre. Feltöltéshez internetkapcsolat kell (ha a tablet a kamera Wi-Fi-jén van, kapcsold be a mobiladatot, vagy csatlakozz vissza a szalon Wi-Fi-jére).'), naplo),
    kartya('Beérkezett, még hozzá nem rendelt képek', varakozo, h('p', { class: 'halvany kicsi' }, 'A hozzá nem rendelt képek 6 óra múlva automatikusan törlődnek.')));
  await rajzVarakozo();
  // a Galeria "Megosztas" -> MOSAIC CRM utjan erkezett kepek (crm-sw.js) automatikus feltoltese
  const megosztott = await varakozoMegosztasok();
  if (megosztott.length) {
    tolt(naplo, h('li', null, `A Megosztás útján ${megosztott.length} kép érkezett, küldöm…`));
    const lista = [];
    for (const k of megosztott) { const blob = await megosztottBlob(k); if (blob) lista.push({ nev: 'Megosztott kép', fj: blob, utana: () => megosztottTorol(k) }); }
    await kuld(lista);
  }
}
