// 11. Elegedettseg es panasz: 1-5 riport, Janka-riasztas, SAJAT kezelo 24 ora, 2 hivas + e-mail naplo, kompenzacio-jovahagyas
import { h, tolt, oldalCim, toltes, tabla, fulek, kartya, mezo, beviteli, valaszto, adatsor, ft, isoNap, napEltolas, pick, lista, jelveny, futtat, ertesit, figyelmeztetes, uresAllapot, megerosites, urlapParbeszed, datumIdo, szamKartya } from './crm-ui.js';
import { allapotJelveny } from './crm-cimkek.js';
import * as N from './crm-normal.js';

export default async function nezet(ctx) {
  tolt(ctx.root, oldalCim('Elégedettség és panasz'),
    figyelmeztetes('info', 'A panaszt a vendég SAJÁT kezelője intézi 24 órán belül (lehetőleg telefonon): két hívási kísérlet, majd személyes e-mail. A szakmai vezető értesül, de nem ő intézi. Kompenzációhoz szalonvezetői jóváhagyás kell.'),
    fulek([{ cim: 'Nyitott panaszok', tolt: (c) => panaszok(c, ctx) }, { cim: 'Elégedettségi riport (1–5)', tolt: (c) => riport(c, ctx) }]));
}

async function panaszok(cel, ctx) {
  const { api } = ctx;
  const lista_ = h('div'); const reszlet = h('div', { 'aria-live': 'polite' });
  tolt(cel, lista_, reszlet);
  const v = await toltes(lista_, () => api.get('/panaszok', { allapot: 'open' }));
  if (v === undefined) return;
  const sorok = lista(v, 'panaszok').map(N.panasz);
  tolt(lista_, tabla([
    { cim: 'Vendég', ertek: (p) => (p.vendegId ? h('a', { href: `#/vendegek/${encodeURIComponent(p.vendegId)}` }, p.vendegNev || 'Vendég') : (p.vendegNev || '–')) },
    { cim: 'Felelős kezelő', ertek: (p) => [p.felelosNev || '–', p.sajat ? [' ', jelveny('te vagy', 'info')] : ''] },
    { cim: 'Állapot', ertek: (p) => allapotJelveny('complaint', p.allapot) },
    { cim: '24 órás határidő', ertek: (p) => (p.hatarido ? [datumIdo(p.hatarido), ' ', p.keso ? jelveny('LEJÁRT', 'veszely') : (p.elsoKapcsolat ? jelveny('kapcsolat volt', 'ok') : '')] : '–') },
    { cim: 'Pont', ertek: (p) => (p.pont ? [String(p.pont), p.pont <= 3 ? jelveny(' Janka-riasztás', 'veszely') : ''] : '–') },
    { cim: '', ertek: (p) => h('button', { type: 'button', class: 'gomb gomb-kicsi gomb-fo', 'data-panasz': p.id, onclick: () => reszletRajz(p) }, 'Megnyitás') },
  ], sorok, { ures: 'Nincs nyitott panasz.', felirat: 'Nyitott panaszok' }));
  function reszletRajz(p) {
    const sajat = p.sajat;
    const hivasok = p.probalkozasok.filter((k) => k.tipus === 'call').length;
    const nap = (fn) => { const b = h('button', { type: 'button', class: 'gomb gomb-kicsi', 'data-akcio': fn.nev }, fn.cim); b.addEventListener('click', futtat(b, fn.fut)); return b; };
    const akciok = [];
    if (ctx.van(['therapist'])) {
      akciok.push(nap({ nev: 'hivas', cim: 'Hívás naplózása', fut: async () => {
        const r = await urlapParbeszed('Hívási kísérlet (legfeljebb 2)', [{ kulcs: 'eredmeny', felirat: 'Eredmény', el: valaszto([['no_answer', 'Nem vette fel'], ['reached', 'Elértem a vendéget']], 'no_answer') }, { kulcs: 'megjegyzes', felirat: 'Megjegyzés', el: h('textarea') }], { megerosit: 'Naplózás' });
        if (!r) return; await api.post(`/panaszok/${encodeURIComponent(p.id)}/probalkozas`, { tipus: 'call', eredmeny: r.eredmeny, megjegyzes: r.megjegyzes.trim() || null }); ertesit('Hívás naplózva.'); ctx.frissit();
      } }),
      nap({ nev: 'email', cim: 'Személyes e-mail naplózása', fut: async () => {
        const r = await urlapParbeszed('Személyes e-mail (két sikertelen hívás után, vagy ha a vendég telefonon elérhető volt)', [{ kulcs: 'megjegyzes', felirat: 'Megjegyzés (mit írtál)', el: h('textarea') }], { megerosit: 'Naplózás' });
        if (!r) return; await api.post(`/panaszok/${encodeURIComponent(p.id)}/probalkozas`, { tipus: 'email', eredmeny: 'sent', megjegyzes: r.megjegyzes.trim() || null }); ertesit('E-mail naplózva.'); ctx.frissit();
      } }),
      nap({ nev: 'komp', cim: 'Kompenzáció kérése', fut: async () => {
        const r = await urlapParbeszed('Kompenzáció kérése (szalonvezetői jóváhagyással lép érvénybe)', [{ kulcs: 'tipus', felirat: 'Fajta', el: valaszto([['refund', 'Pénzvisszatérítés'], ['free_replacement', 'Ingyenes pótló kezelés'], ['discount', 'Kedvezmény']], 'discount') }, { kulcs: 'osszeg', felirat: 'Összeg (Ft, pénzvisszatérítéshez / kedvezményhez)', el: beviteli({ type: 'number', min: '1' }) }], { megerosit: 'Kérés beküldése' });
        if (!r) return; await api.post(`/panaszok/${encodeURIComponent(p.id)}/kompenzacio`, { tipus: r.tipus, ...(r.osszeg ? { osszeg: Number(r.osszeg) } : {}) }); ertesit('A kérés jóváhagyásra került.'); ctx.frissit();
      } }),
      nap({ nev: 'lezar', cim: 'Panasz lezárása', fut: async () => {
        const r = await urlapParbeszed('Panasz lezárása', [{ kulcs: 'megoldas', felirat: 'A megoldás dokumentálása (kötelező)', el: h('textarea') }, { kulcs: 'elegedett', felirat: 'A vendég már nem elégedetlen', el: h('input', { type: 'checkbox' }) }], { megerosit: 'Lezárás' });
        if (!r) return; if (r.megoldas.trim().length < 3) { ertesit('A megoldás leírása kötelező.', 'hiba'); return; }
        const e = await api.post(`/panaszok/${encodeURIComponent(p.id)}/lezar`, { megoldas: r.megoldas.trim(), vendeg_elegedett: !!r.elegedett });
        ertesit(e && e.lezarva === false ? 'A panasz nyitva maradt (feltétel nem teljesült).' : 'Panasz lezárva.'); ctx.frissit();
      } }));
    }
    if (ctx.van(['salon_manager'])) akciok.push(nap({ nev: 'felelos', cim: 'Felelős kezelő cseréje', fut: async () => {
      const r = await urlapParbeszed('Felelős kezelő cseréje', [{ kulcs: 'uj', felirat: 'Új kezelő azonosítója', el: beviteli({}) }, { kulcs: 'ok', felirat: 'Ok (kötelező)', el: h('textarea') }], { megerosit: 'Csere' });
      if (!r || !r.uj.trim() || !r.ok.trim()) return; await api.post(`/panaszok/${encodeURIComponent(p.id)}/felelos`, { uj_kezelo_id: r.uj.trim(), ok: r.ok.trim() }); ertesit('A felelős cserélve.'); ctx.frissit();
    } }));
    const dontG = (k, d) => { const b = h('button', { type: 'button', class: `gomb gomb-kicsi ${d === 'approved' ? 'gomb-fo' : ''}`, 'data-dontes': d }, d === 'approved' ? 'Jóváhagyás' : 'Elutasítás'); b.addEventListener('click', futtat(b, async () => { if (!(await megerosites('Kompenzáció-döntés', d === 'approved' ? 'Jóváhagyod a kompenzációt? Pénzügyi hatása van, a döntés külön naplóba kerül.' : 'Elutasítod a kérést?', { megerosit: d === 'approved' ? 'Jóváhagyom' : 'Elutasítom', veszely: d === 'rejected' }))) return; await api.post(`/kompenzaciok/${encodeURIComponent(k.id)}/dontes`, { dontes: d }); ertesit('Döntés rögzítve.'); ctx.frissit(); })); return b; };
    tolt(reszlet, kartya('Panasz részletei',
      !sajat && ctx.van(['therapist', 'clinical_lead']) && !ctx.van(['salon_manager']) ? figyelmeztetes('info', 'Ezt a panaszt a vendég saját kezelője intézi; te csak megtekintheted.') : null,
      p.keso ? figyelmeztetes('veszely', h('strong', null, 'A 24 órás kapcsolatfelvételi határidő lejárt. ')) : null,
      adatsor([['Vendég', p.vendegNev || '–'], ['Leírás', p.leiras || '–'], ['Forrás', p.forras || '–'], ['Megnyitva', p.megnyitva ? datumIdo(p.megnyitva) : '–'], ['Első kapcsolat', p.elsoKapcsolat ? datumIdo(p.elsoKapcsolat) : 'még nem volt']]),
      p.probalkozasok.length ? [h('h4', null, `Kapcsolatfelvételek (${hivasok} hívás)`), tabla([{ cim: 'Mikor', ertek: (k) => datumIdo(k.ido) }, { cim: 'Típus', ertek: (k) => (k.tipus === 'call' ? 'Hívás' : 'E-mail') }, { cim: 'Eredmény', ertek: (k) => k.eredmeny || '–' }, { cim: 'Megjegyzés', ertek: (k) => k.megjegyzes || '', osztaly: 'sor-szoveg' }], p.probalkozasok)] : h('p', { class: 'halvany kicsi' }, 'A korábbi kapcsolatfelvételek listáját a szerver ennél a nézetnél még nem adja ki; az új naplóbejegyzések mentődnek.'),
      p.kompenzaciok.length ? [h('h4', null, 'Kompenzáció'), tabla([{ cim: 'Fajta', ertek: (k) => k.tipus }, { cim: 'Összeg', ertek: (k) => (k.osszeg ? ft(k.osszeg) : '–') }, { cim: 'Állapot', ertek: (k) => allapotJelveny('kompenzacio', k.allapot) },
        { cim: '', ertek: (k) => (ctx.van(['salon_manager']) && k.allapot === 'pending' ? h('div', { class: 'gombsor', style: 'margin:0' }, dontG(k, 'approved'), dontG(k, 'rejected')) : '') }], p.kompenzaciok)] : null,
      h('div', { class: 'gombsor' }, ...akciok)));
    reszlet.scrollIntoView({ block: 'nearest' });
  }
}

async function riport(cel, ctx) {
  const ig = isoNap(); const tol = napEltolas(ig, -90);
  const tolEl = h('input', { type: 'date', id: 'el-tol', value: tol }); const igEl = h('input', { type: 'date', id: 'el-ig', value: ig });
  const t = h('div', { 'aria-live': 'polite' });
  const betolt = async () => {
    const v = await toltes(t, () => ctx.api.get('/elegedettseg', { tol: tolEl.value, ig: igEl.value }));
    if (v === undefined) return;
    const sorok = lista(v, 'kezelok', 'riport');
    tolt(t, tabla([
      { cim: 'Kezelő', ertek: (s) => pick(s, 'kezelo_nev', 'kezelo', 'nev') || '–' }, { cim: 'Beérkezett', ertek: (s) => pick(s, 'kitoltes', 'db', 'darab', 'valasz') ?? '–', osztaly: 'jobbra' },
      { cim: 'Átlag (1–5)', ertek: (s) => { const a = pick(s, 'atlag', 'avg'); return a == null ? '–' : String(Number(a).toFixed(2)).replace('.', ','); }, osztaly: 'jobbra' },
      { cim: '1–3 pont (Janka-riasztás)', ertek: (s) => { const n = pick(s, 'negativ', 'alacsony', 'low'); return n ? jelveny(String(n), 'veszely') : (n === 0 ? '0' : '–'); }, osztaly: 'jobbra' },
    ], sorok, { ures: 'Ebben az időszakban nincs beérkezett értékelés.', felirat: 'Kezelőnkénti elégedettség' }));
  };
  tolt(cel, h('div', { class: 'kereso' }, mezo('Mettől', tolEl), mezo('Meddig', igEl), h('button', { type: 'button', class: 'gomb gomb-fo', style: 'align-self:flex-end', onclick: betolt }, 'Frissítés')), t);
  betolt();
}
