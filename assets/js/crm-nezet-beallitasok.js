// 15. Hozzaferes es beallitasok: munkatarsak / szerepkor, fiok-allapot (Salonic), beszamitas, adatmegorzes, jogi szovegverziok, audit-naplo + export
import { h, tolt, oldalCim, toltes, tabla, fulek, kartya, mezo, beviteli, valaszto, adatsor, isoNap, napEltolas, pick, lista, jelveny, rvJelzo, futtat, ertesit, figyelmeztetes, uresAllapot, megerosites, urlapParbeszed, datumIdo, humanizal } from './crm-ui.js';
import { SZEREPEK } from './crm-cimkek.js';

const SZEREP_LISTA = Object.entries(SZEREPEK);

export default async function nezet(ctx) {
  const admin = ctx.van(['admin']);
  const f = [];
  if (admin) f.push({ cim: 'Munkatársak és szerepkörök', tolt: (c) => munkatarsak(c, ctx) });
  f.push({ cim: 'Beállítások', tolt: (c) => beallitasok(c, ctx) }, { cim: 'Salonic-fiók állapota', tolt: (c) => salonic(c, ctx) }, { cim: 'Audit-napló', tolt: (c) => audit(c, ctx) });
  tolt(ctx.root, oldalCim('Hozzáférés és beállítások'), fulek(f));
}

async function munkatarsak(cel, ctx) {
  const { api } = ctx;
  const t = h('div');
  const uj = h('button', { type: 'button', class: 'gomb gomb-fo', id: 'mt-uj' }, 'Új munkatárs');
  uj.addEventListener('click', futtat(uj, async () => {
    const szerepSel = h('select', { multiple: true, size: '6', 'aria-label': 'Szerepkörök' }, SZEREP_LISTA.map(([k, n]) => h('option', { value: k }, n)));
    const r = await urlapParbeszed('Új munkatárs felvétele', [{ kulcs: 'nev', felirat: 'Név', el: beviteli({ required: true }) }, { kulcs: 'email', felirat: 'E-mail-cím (innen kap belépőkódot)', el: beviteli({ type: 'email' }) }, { kulcs: 'szerep', felirat: 'Szerepkör(ök) – Ctrl/Cmd+kattintás több kijelöléséhez', el: szerepSel }], { megerosit: 'Felvétel' });
    if (!r || !r.nev.trim() || !r.email.trim()) return;
    const szerepek = [...szerepSel.selectedOptions].map((o) => o.value);
    if (!szerepek.length) { ertesit('Legalább egy szerepkör kell.', 'hiba'); return; }
    await api.post('/munkatarsak', { nev: r.nev.trim(), email: r.email.trim(), szerepek }); ertesit('Munkatárs felvéve.'); munkatarsak(cel, ctx);
  }));
  tolt(cel, h('div', { class: 'gombsor', style: 'margin:0 0 12px' }, uj), t);
  const v = await toltes(t, () => api.get('/munkatarsak'));
  if (v === undefined) return;
  tolt(t, tabla([
    { cim: 'Név', ertek: (s) => s.nev || '–' }, { cim: 'E-mail', ertek: (s) => s.email || '–' },
    { cim: 'Szerepkörök', ertek: (s) => lista(s.szerepek).map((x) => jelveny(SZEREPEK[x] || x, 'info')).flatMap((x) => [x, ' ']) },
    { cim: 'Fiók', ertek: (s) => (pick(s, 'aktiv', 'active') === false || pick(s, 'aktiv', 'active') === 0 ? jelveny('Deaktiválva', 'veszely') : jelveny('Aktív', 'ok')) },
    { cim: 'Utolsó belépés', ertek: (s) => (s.utolso_belepes ? datumIdo(s.utolso_belepes) : '–') },
    { cim: '', ertek: (s) => {
      const d = h('div', { class: 'gombsor', style: 'margin:0' });
      const sz = h('button', { type: 'button', class: 'gomb gomb-kicsi', 'data-akcio': 'szerep' }, 'Szerepkör');
      sz.addEventListener('click', futtat(sz, async () => {
        const sel = h('select', { multiple: true, size: '6' }, SZEREP_LISTA.map(([k, n]) => h('option', { value: k, selected: lista(s.szerepek).includes(k) }, n)));
        const r = await urlapParbeszed(`Szerepkör: ${s.nev}`, [{ kulcs: 's', felirat: 'Szerepkörök', el: sel }], { megerosit: 'Mentés' }); if (!r) return;
        await api.patch(`/munkatarsak/${encodeURIComponent(s.id)}`, { szerepek: [...sel.selectedOptions].map((o) => o.value) }); ertesit('Szerepkör módosítva (naplózva).'); munkatarsak(cel, ctx);
      }));
      const aktiv = !(pick(s, 'aktiv', 'active') === false || pick(s, 'aktiv', 'active') === 0);
      const de = h('button', { type: 'button', class: `gomb gomb-kicsi ${aktiv ? 'gomb-veszely' : ''}`, 'data-akcio': 'aktiv' }, aktiv ? 'Deaktiválás' : 'Aktiválás');
      de.addEventListener('click', futtat(de, async () => { if (!(await megerosites(aktiv ? 'Fiók deaktiválása' : 'Fiók aktiválása', aktiv ? `${s.nev} nem tud többé belépni.` : `${s.nev} újra beléphet.`, { megerosit: aktiv ? 'Deaktiválom' : 'Aktiválom', veszely: aktiv }))) return; await api.patch(`/munkatarsak/${encodeURIComponent(s.id)}`, { aktiv: !aktiv }); ertesit('Fiók-állapot módosítva (naplózva).'); munkatarsak(cel, ctx); }));
      d.append(sz, de); return d;
    } },
  ], lista(v, 'munkatarsak'), { ures: 'Nincs munkatárs.', felirat: 'Munkatársak' }));
}

async function beallitasok(cel, ctx) {
  const { api } = ctx;
  const v = await toltes(cel, () => api.get('/beallitasok'));
  if (v === undefined) return;
  let sorok = lista(v, 'beallitasok');
  if (!sorok.length && v && typeof v === 'object' && !Array.isArray(v)) sorok = Object.entries(v.beallitasok || v).filter(([, x]) => !Array.isArray(x)).map(([kulcs, ertek]) => ({ kulcs, ertek }));
  if (!sorok.length) { tolt(cel, uresAllapot('Nincs beállítás.')); return; }
  tolt(cel, figyelmeztetes('figyelem', rvJelzo(), ' A jogi szövegverziók (adatkezelés, marketing-hozzájárulás) jogi ellenőrzésre várnak; a kód nem tekinti őket véglegesnek.'),
    ...sorok.map((s) => {
      const kulcs = pick(s, 'kulcs', 'key'); const ertek = pick(s, 'ertek', 'value');
      const szoveg = typeof ertek === 'string' ? ertek : JSON.stringify(ertek, null, 2);
      const ta = h('textarea', { 'aria-label': humanizal(kulcs), 'data-beallitas': kulcs, rows: String(Math.min(10, Math.max(2, szoveg.split('\n').length + 1))) }); ta.value = szoveg;
      const b = h('button', { type: 'button', class: 'gomb gomb-fo gomb-kicsi' }, 'Mentés');
      b.addEventListener('click', futtat(b, async () => {
        let uj = ta.value; if (typeof ertek !== 'string') { try { uj = JSON.parse(ta.value); } catch { ertesit('Érvénytelen JSON-érték.', 'hiba'); return; } }
        await api.put(`/beallitasok/${encodeURIComponent(kulcs)}`, { ertek: uj }); ertesit(`${humanizal(kulcs)} mentve.`);
      }));
      return kartya(humanizal(kulcs), /jogi|szoveg|consent|hozzajarulas/i.test(kulcs) ? h('div', { style: 'margin-bottom:8px' }, rvJelzo()) : null, pick(s, 'leiras') ? h('p', { class: 'halvany kicsi' }, s.leiras) : null, ta, h('div', { class: 'gombsor' }, b));
    }));
}

async function salonic(cel, ctx) {
  const v = await toltes(cel, () => ctx.api.get('/salonic-allapot'));
  if (v === undefined) return;
  const fiokok = lista(v, 'fiokok');
  const ke = v.bejovo_keses_mp;
  const mp = (x) => (x == null ? '–' : x > 7200 ? `${Math.round(x / 3600)} óra` : x > 120 ? `${Math.round(x / 60)} perc` : `${Math.round(x)} mp`);
  tolt(cel, kartya('Salonic-fiók', adatsor([['Utolsó bejövő esemény', v.utolso_bejovo_esemeny ? datumIdo(v.utolso_bejovo_esemeny) : 'még nem érkezett'], ['Késés az utolsó eseményig', mp(ke)], ['Állapot', ke != null && ke > 86400 ? jelveny('Régóta nem jött esemény', 'figyelem') : (v.utolso_bejovo_esemeny ? jelveny('Rendben', 'ok') : jelveny('Nincs adat', ''))]]),
    tabla([{ cim: 'Fiók', ertek: (f) => f.cimke || f.id }, { cim: 'Aktív', ertek: (f) => (f.aktiv ? jelveny('Aktív', 'ok') : jelveny('Inaktív', '')) }, { cim: 'Állapot', ertek: (f) => f.allapot || '–' }, { cim: 'Utolsó szinkron', ertek: (f) => (f.utolso_szinkron ? datumIdo(f.utolso_szinkron) : '–') }, { cim: 'Szinkron-késés', ertek: (f) => mp(f.szinkron_keses_mp) }], fiokok, { ures: 'Nincs Salonic-fiók rögzítve.' }),
    h('p', { class: 'halvany kicsi' }, 'A Salonic nem ad API-t vagy webhookot: az adat az értesítő e-mailekből érkezik, ezért az állapot az utolsó beérkezett eseményből számolt.')));
}

async function audit(cel, ctx) {
  const ig = isoNap(); const tol = napEltolas(ig, -7);
  const tolEl = h('input', { type: 'date', id: 'au-tol', value: tol }); const igEl = h('input', { type: 'date', id: 'au-ig', value: ig });
  const muv = beviteli({ id: 'au-muvelet', placeholder: 'pl. plan.save' });
  const t = h('div', { 'aria-live': 'polite' });
  const betolt = async () => {
    const v = await toltes(t, () => ctx.api.get('/audit', { tol: tolEl.value, ig: igEl.value, muvelet: muv.value.trim() }));
    if (v === undefined) return;
    tolt(t, tabla([
      { cim: 'Mikor', ertek: (s) => datumIdo(pick(s, 'ido', 'at', 'created_at')) }, { cim: 'Ki', ertek: (s) => String(pick(s, 'munkatars_id', 'munkatars', 'staff_id') || '–').slice(0, 8) },
      { cim: 'Művelet', ertek: (s) => h('code', null, pick(s, 'muvelet', 'action')) }, { cim: 'Erőforrás', ertek: (s) => pick(s, 'eroforras', 'resource') || '–' },
      { cim: 'Eredmény', ertek: (s) => { const e = pick(s, 'eredmeny', 'result'); return e === 'denied' || e === 'tiltva' ? jelveny('Elutasítva', 'veszely') : jelveny(e || 'ok', 'ok'); } },
    ], lista(v, 'audit', 'bejegyzesek', 'naplo'), { ures: 'Ebben az időszakban nincs naplóbejegyzés.', felirat: 'Audit-napló' }));
  };
  const exp = h('button', { type: 'button', class: 'gomb', id: 'au-export' }, 'Exportálás (CSV)');
  exp.addEventListener('click', futtat(exp, async () => {
    const blob = await ctx.api.blob('/audit/export.csv', { tol: tolEl.value, ig: igEl.value, muvelet: muv.value.trim() });
    const url = URL.createObjectURL(blob); const a = h('a', { href: url, download: `audit-${tolEl.value}_${igEl.value}.csv` }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000); ertesit('Az export letöltődik (az exportálás naplózott).');
  }));
  tolt(cel, h('form', { class: 'kereso', onsubmit: (e) => { e.preventDefault(); betolt(); } }, mezo('Mettől', tolEl), mezo('Meddig', igEl), mezo('Művelet', muv), h('div', { class: 'gombsor', style: 'align-self:flex-end;margin:0 0 12px' }, h('button', { type: 'submit', class: 'gomb gomb-fo' }, 'Szűrés'), exp)), t);
  betolt();
}
