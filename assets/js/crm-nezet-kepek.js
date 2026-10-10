// 6. Kameraképek: 1/3/5/10 sorozat, feltoltes (kliens-oldali atmeretezes), ket kep osszehasonlitasa, 2-3 mondatos komment, link-kiadas
import * as N from './crm-normal.js';
import { h, tolt, urit, oldalCim, toltes, kartya, mezo, beviteli, valaszto, pick, lista, jelveny, gomb, futtat, ertesit, figyelmeztetes, uresAllapot, tabla, kepAtmeretez, datumIdo, megerosites, parbeszed } from './crm-ui.js';

const PONTOK = [1, 3, 5, 10];

export default async function nezet(ctx) {
  const gid = ctx.alfa[0];
  if (!gid) return valasztas(ctx);
  return sorozat(ctx, gid);
}

async function valasztas(ctx) {
  const q = h('input', { type: 'search', id: 'kp-q', 'aria-label': 'Vendég keresése', placeholder: 'Vendég neve, e-mail- vagy telefonrészlet' });
  const t = h('div');
  const keres = async () => {
    if (q.value.trim().length < 2) return;
    const v = await toltes(t, () => ctx.api.get('/vendegek', { q: q.value.trim() }));
    if (v === undefined) return;
    tolt(t, tabla([{ cim: 'Név', ertek: (s) => s.nev }, { cim: 'E-mail', ertek: (s) => s.email_maszkolt || '–' }, { cim: '', ertek: (s) => h('a', { class: 'gomb gomb-kicsi gomb-fo', href: `#/kepek/${encodeURIComponent(s.id)}` }, 'Képek') }], lista(v, 'vendegek'), { ures: 'Nincs találat.' }));
  };
  tolt(ctx.root, oldalCim('Kameraképek'), h('p', { class: 'halvany' }, 'Kötelező hajkamerás felvétel: 1., 3., 5. és 10. alkalom, mindig ugyanabból a rögzítési pontból. A képek egészségi adatnak minősülhetnek: megtekintésük naplózott.'),
    h('form', { class: 'kereso', onsubmit: (e) => { e.preventDefault(); keres(); } }, q, h('button', { class: 'gomb gomb-fo', type: 'submit' }, 'Keresés')), t);
  tolt(t, uresAllapot('Keress rá a vendégre, akinek a képeit kezeled.'));
  q.focus();
}

async function sorozat(ctx, gid) {
  const { api, root } = ctx;
  const cel = h('div');
  tolt(root, oldalCim('Kameraképek', h('a', { class: 'gomb', href: `#/vendegek/${encodeURIComponent(gid)}` }, 'Vendégprofil'), h('a', { class: 'gomb', href: '#/kepek' }, 'Másik vendég')), cel);
  const p = await toltes(cel, () => api.get(`/vendegek/${encodeURIComponent(gid)}`));
  if (p === undefined) return;
  const kepek = lista(p.kepek);
  const kura = N.kura(p.kura);
  const kezelesek = ((kura && kura.kezelesek) || []).filter((x) => PONTOK.includes(Number(x.sorszam)));
  const kijelolt = []; // max 2 kep azonosito
  const urlek = new Map();
  const nagyit = h('div', { 'aria-live': 'polite' });
  const osszeHely = h('div');

  const betoltKep = async (id) => { if (urlek.has(id)) return urlek.get(id); const b = await api.blob(`/kepek/${encodeURIComponent(id)}`); const u = URL.createObjectURL(b); urlek.set(id, u); return u; };

  // ---- feltoltes ----
  const elore = ctx.params.get('kezeles');
  const sidSel = valaszto([['', kezelesek.length ? '– válaszd ki az alkalmat –' : 'Még nincs 1/3/5/10. igazolt kezelés'], ...kezelesek.map((x) => [x.id, `${x.sorszam}. alkalom${kepek.some((k) => String(k.kezeles_id) === String(x.id)) ? ' (van már kép)' : ''}`])], elore && kezelesek.some((x) => x.id === elore) ? elore : '', { id: 'kp-sid' });
  const fajl = h('input', { type: 'file', id: 'kp-fajl', accept: 'image/*', capture: 'environment', 'aria-label': 'Fénykép készítése vagy kiválasztása' });
  const allapot = h('div', { 'aria-live': 'polite', class: 'sugo' });
  const feltolt = h('button', { type: 'button', class: 'gomb gomb-fo', id: 'kp-feltolt', disabled: !kezelesek.length }, 'Feltöltés');
  feltolt.addEventListener('click', futtat(feltolt, async () => {
    const fj = fajl.files && fajl.files[0];
    if (!fj) { ertesit('Előbb készíts vagy válassz egy képet.', 'hiba'); return; }
    if (!sidSel.value) { ertesit('Válaszd ki, melyik alkalomhoz tartozik a kép.', 'hiba'); return; }
    const pont = kezelesek.find((x) => x.id === sidSel.value)?.sorszam;
    tolt(allapot, 'Kép előkészítése…');
    const { blob, szelesseg, magassag } = await kepAtmeretez(fj);
    tolt(allapot, `Feltöltés (${szelesseg}×${magassag}, ${(blob.size / 1024).toFixed(0)} kB)…`);
    const ut = `/kezelesek/${encodeURIComponent(sidSel.value)}/kepek`;
    try { await api.feltolt(ut, { pont }, blob); } catch (e) {
      if (e.status !== 409) throw e;
      if (!(await megerosites('Kép cseréje', `A(z) ${pont}. alkalomhoz már van kép. Lecseréled az újra? A régi kép véglegesen törlődik.`, { megerosit: 'Csere', veszely: true }))) { tolt(allapot, ''); return; }
      await api.feltolt(ut, { pont, csere: '1' }, blob);
    }
    ertesit('A kép feltöltve.'); ctx.frissit();
  }));

  // ---- galeria ----
  const galeria = kepek.length ? h('div', { class: 'kep-racs', role: 'group', 'aria-label': 'Feltöltött képek' }, ...kepek.map((k) => {
    const kid = String(k.id);
    const doboz = h('button', { type: 'button', class: 'kep-doboz', 'aria-pressed': 'false', 'data-kep': kid, 'aria-label': `${k.alkalom}. alkalom képe – kiválasztás az összehasonlításhoz` },
      h('div', { style: 'aspect-ratio:4/3;display:grid;place-items:center;background:var(--krem2);border-radius:4px;color:var(--halk)' }, 'Megtekintés'), h('div', { class: 'kicsi' }, `${k.alkalom}. alkalom`, k.ido ? ` · ${datumIdo(k.ido)}` : ''));
    doboz.addEventListener('click', async () => {
      const ki = kijelolt.indexOf(kid);
      if (ki >= 0) { kijelolt.splice(ki, 1); doboz.setAttribute('aria-pressed', 'false'); } else { if (kijelolt.length >= 2) { const regi = kijelolt.shift(); const rd = galeria.querySelector(`[data-kep="${CSS.escape(regi)}"]`); if (rd) rd.setAttribute('aria-pressed', 'false'); } kijelolt.push(kid); doboz.setAttribute('aria-pressed', 'true'); }
      try {
        const u = await betoltKep(kid);
        if (!doboz.querySelector('img')) { const img = h('img', { src: u, alt: `${k.alkalom}. alkalom hajkamera-képe` }); doboz.firstChild.replaceWith(img); }
      } catch (e) { if (e.status === 401) throw e; ertesit(e.message, 'hiba'); }
      osszehasonlitRajz();
    });
    const torolG = h('button', { type: 'button', class: 'gomb gomb-kicsi gomb-veszely', 'data-torol': kid, 'aria-label': `${k.alkalom}. alkalom képének törlése`, style: 'width:100%;margin-top:6px' }, 'Kép törlése');
    torolG.addEventListener('click', futtat(torolG, async () => {
      if (!(await megerosites('Kép törlése', `A(z) ${k.alkalom}. alkalom képe véglegesen törlődik, és a belőle kiadott vendég-linkek is érvénytelenek lesznek. Új képet utána a fenti feltöltéssel tudsz felvenni.`, { megerosit: 'Törlés', veszely: true }))) return;
      await api.del(`/kepek/${encodeURIComponent(kid)}`); ertesit('A kép törölve.'); ctx.frissit();
    }));
    return h('div', { class: 'kep-cella' }, doboz, torolG);
  })) : uresAllapot('Még nincs feltöltött kép.', 'Az 1., 3., 5. és 10. alkalmon kötelező a hajkamera-felvétel.');

  // ---- osszehasonlitas ----
  const komment = h('textarea', { id: 'kp-komment', 'aria-label': 'Kezelői komment (2–3 mondat)', placeholder: 'Kezelői megfigyelés: 2–3 mondat, tényszerűen, nem diagnosztikusan.' });
  const mondatSz = h('div', { class: 'sugo', 'aria-live': 'polite' });
  const mondatok = () => String(komment.value).split(/[.!?]+(?:\s+|$)/).map((x) => x.trim()).filter((x) => x.length >= 2).length;
  komment.addEventListener('input', () => { const n = mondatok(); tolt(mondatSz, `Mondatok száma: ${n} `, n >= 2 && n <= 3 ? jelveny('rendben', 'ok') : jelveny('2–3 mondat kell', 'figyelem')); });
  let osszeId = null;
  const kimenet = h('div', { 'aria-live': 'polite' });
  function osszehasonlitRajz() {
    if (kijelolt.length < 2) { tolt(osszeHely, h('p', { class: 'halvany' }, `Válassz ki két képet az összehasonlításhoz (${kijelolt.length}/2).`)); return; }
    const alk = (id) => Number((kepek.find((x) => String(x.id) === id) || {}).alkalom || 0);
    const [kepA, kepB] = kijelolt.slice().sort((x, y) => alk(x) - alk(y));   // A = korabbi alkalom, B = kesobbi
    const mentG = h('button', { type: 'button', class: 'gomb gomb-fo', id: 'kp-ossze-ment' }, 'Összehasonlítás mentése');
    mentG.addEventListener('click', futtat(mentG, async () => {
      const n = mondatok(); if (n < 2 || n > 3) { ertesit('A kommentnek 2–3 mondatosnak kell lennie.', 'hiba'); return; }
      const r = await api.post('/osszehasonlitas', { kep_a: kepA, kep_b: kepB, komment: komment.value.trim() }); osszeId = pick(r, 'id', 'osszehasonlitas_id'); ertesit('Összehasonlítás mentve.');
      const lg = linkG(); lg.disabled = true; const vg = vegG(); tolt(kimenet, h('div', { class: 'gombsor' }, vg, lg), h('p', { class: 'halvany kicsi' }, 'A link csak véglegesített összehasonlításhoz adható ki, kész kezelői dokumentációval és ellenőrzött vendég-e-mail-címmel.'));
    }));
    const vegG = () => { const b = h('button', { type: 'button', class: 'gomb', id: 'kp-veglegesit' }, 'Véglegesítés'); b.addEventListener('click', futtat(b, async () => { await api.post(`/osszehasonlitas/${encodeURIComponent(osszeId)}/veglegesit`, {}); b.dataset.kesz = '1'; b.disabled = true; ertesit('Véglegesítve.'); const lk = kimenet.querySelector('#kp-link'); if (lk) lk.disabled = false; })); return b; };
    const linkG = () => {
      const b = h('button', { type: 'button', class: 'gomb gomb-arany', id: 'kp-link' }, 'Vendég-link kiadása (30 nap)');
      b.addEventListener('click', futtat(b, async () => {
        if (!(await megerosites('Link kiadása', `A vendég 30 napig érvényes privát linket kap e-mailben (a küldési soron át; üzemmód: ${ctx.uzemmod() === 'eles' ? 'ÉLES' : 'dry-run, nincs valódi küldés'}).`, { megerosit: 'Link kiadása' }))) return;
        const r = await api.post(`/osszehasonlitas/${encodeURIComponent(osszeId)}/link`, {});
        tolt(kimenet, figyelmeztetes('ok', h('strong', null, 'A link kiadva'), pick(r, 'lejar', 'expiresAt', 'expires_at') ? ` (lejár: ${datumIdo(pick(r, 'lejar', 'expiresAt', 'expires_at'))})` : '', '. A vendégnek az e-mail a küldési soron át megy; a link kézzel is átadható, de csak most látható:', h('input', { type: 'text', readonly: true, value: r.link || '', 'aria-label': 'Vendég-link', onfocus: (e) => e.target.select() })));
      }));
      return b;
    };
    tolt(osszeHely, h('div', { class: 'ossze' }, ...[kepA, kepB].map((id) => { const k = kepek.find((x) => String(x.id) === id); return h('figure', { style: 'margin:0' }, urlek.has(id) ? h('img', { src: urlek.get(id), alt: `${k ? k.alkalom : ''}. alkalom` }) : h('div', { class: 'allapot' }, 'Betöltés…'), h('figcaption', { class: 'kicsi halvany' }, `${k ? k.alkalom : '?'}. alkalom`)); })),
      mezo('Kezelői komment (2–3 mondat)', komment), mondatSz, h('div', { class: 'gombsor' }, mentG), kimenet);
  }
  tolt(cel, h('h2', null, p.vendeg && p.vendeg.nev ? p.vendeg.nev : 'Vendég'),
    kartya('Új felvétel feltöltése', h('div', { class: 'mezok-sor' }, mezo('Alkalom (1 / 3 / 5 / 10)', sidSel), mezo('Fénykép', fajl, 'Telefonon a kamera nyílik meg. A kép feltöltés előtt legfeljebb 1600 px-esre, tömörített JPEG-re kicsinyítve.')), h('div', { class: 'gombsor' }, feltolt), allapot),
    kartya('Képek (1/3/5/10)', galeria, nagyit), kartya('Összehasonlítás', osszeHely));
  osszehasonlitRajz();
}
