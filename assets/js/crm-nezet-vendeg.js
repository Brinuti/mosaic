// 2. Vendegkereso + profil (egy guest_key, Salonic-azonosito, foglalastortenet, kura, berlet, consent, uzenetek, dokumentumok, panasz)
import { h, tolt, oldalCim, toltes, tabla, kartya, adatsor, fulek, datumIdo, datum, ft, lista, pick, uresAllapot, jelveny, figyelmeztetes, gomb, futtat, ertesit, urlapParbeszed, beviteli, szamKartya } from './crm-ui.js';
import { allapotJelveny, szolgNev, cimke, CSATORNA, BERLET } from './crm-cimkek.js';
import * as N from './crm-normal.js';

export default async function nezet(ctx) {
  const id = ctx.alfa[0];
  if (id) return profil(ctx, id);
  return kereso(ctx);
}

async function kereso(ctx) {
  const { root, api } = ctx;
  const q = h('input', { type: 'search', id: 'vk-q', 'aria-label': 'Keresés névre, e-mailre vagy telefonra', placeholder: 'Név, e-mail vagy telefonrészlet', value: ctx.params.get('q') || '', autocomplete: 'off' });
  const talalat = h('div', { 'aria-live': 'polite' });
  const kereses = async () => {
    const szoveg = q.value.trim();
    if (szoveg.length < 2) { tolt(talalat, uresAllapot('Írj be legalább 2 karaktert a kereséshez.')); return; }
    const v = await toltes(talalat, () => api.get('/vendegek', { q: szoveg }));
    if (v === undefined) return;
    const sorok = lista(v, 'vendegek');
    tolt(talalat, tabla([
      { cim: 'Név', ertek: (s) => h('a', { href: `#/vendegek/${encodeURIComponent(s.id)}` }, s.nev || '(név nélkül)') },
      { cim: 'E-mail', ertek: (s) => s.email_maszkolt || '–' },
      { cim: 'Telefon', ertek: (s) => s.telefon_maszkolt || '–' },
      { cim: 'Utolsó foglalás', ertek: (s) => (s.utolso_foglalas ? datum(s.utolso_foglalas) : '–') },
      { cim: 'Kúra', ertek: (s) => (s.kura_allapot ? allapotJelveny('course', s.kura_allapot) : '–') },
    ], sorok, { ures: 'Nincs találat.', felirat: 'Találatok' }));
  };
  tolt(root, oldalCim('Vendégkereső'), h('form', { class: 'kereso', role: 'search', onsubmit: (e) => { e.preventDefault(); kereses(); } }, q, h('button', { type: 'submit', class: 'gomb gomb-fo' }, 'Keresés')),
    h('p', { class: 'halvany kicsi' }, 'Az e-mail és a telefon maszkolva jelenik meg; a teljes adat csak a profilban, a szükséges helyen.'), talalat);
  tolt(talalat, uresAllapot('Keress névre, e-mailre vagy telefonszámra.'));
  if (q.value.trim().length >= 2) kereses();
  q.focus();
}

async function profil(ctx, id) {
  const { root, api } = ctx;
  const cel = h('div');
  tolt(root, oldalCim('Vendégprofil', h('a', { class: 'gomb', href: '#/vendegek' }, '← Vissza a kereséshez')), cel);
  const p = await toltes(cel, () => api.get(`/vendegek/${encodeURIComponent(id)}`));
  if (p === undefined) return;
  const v = p.vendeg || {};
  const vid = v.id || id;
  const kezeloi = ctx.van(['therapist', 'clinical_lead']);
  const kura = N.kura(p.kura);
  const creditek = lista(p.credit).map(N.credit);
  const hj = N.hozzajarulas(p.hozzajarulasok);
  const stop = p.klinikai_stop || v.ertekesites_tiltva;
  const nyitottPanasz = lista(p.panaszok).some((x) => (x.allapot || x.status) === 'open');
  const nincsJog = (adat, ...gy) => (adat === null || adat === undefined ? h('p', { class: 'halvany' }, 'Ez az adat a szerepkörödnek nem érhető el.') : gy);
  const emailGomb = gomb('E-mail módosítása', async () => {
    const e = await urlapParbeszed('E-mail-cím módosítása', [{ kulcs: 'email', felirat: 'Új e-mail-cím', el: beviteli({ type: 'email', required: true, value: v.email || '' }), sugo: 'A módosítás után a képlinkek és hozzáférések jogosultsága újra ellenőrzésre kerül.' }], { megerosit: 'Mentés' });
    if (!e || !e.email.trim()) return;
    await api.post(`/vendegek/${encodeURIComponent(vid)}/email`, { email: e.email.trim() });
    ertesit('E-mail módosítva.'); ctx.frissit();
  }, { tipus: 'kicsi' });
  const fej = [
    h('h2', null, v.nev || '(név nélkül)'),
    stop ? figyelmeztetes('veszely', h('strong', null, 'Szakmai STOP: '), 'a vendégnek nem ajánlható kúra / bérlet, a kezelés csak szakmai ellenőrzés után indulhat.') : null,
    nyitottPanasz ? figyelmeztetes('figyelem', h('strong', null, 'Nyitott panasz: '), 'az értékesítési és visszafoglalási üzenetek le vannak tiltva.') : null,
  ];
  const f = [
    ['Áttekintés', (c) => tolt(c, h('div', { class: 'racs' },
      kartya('Alapadatok', adatsor([['Név', v.nev], ['E-mail', [v.email, v.email_ellenorzott ? jelveny('ellenőrzött', 'ok') : '']], ['Telefon', v.telefon], ['Vendégkulcs (guest_key)', h('code', null, vid)], ['Állapot', v.allapot === 'active' || v.allapot === undefined ? 'Aktív' : v.allapot]]), ctx.van(['reception', 'therapist', 'clinical_lead']) ? h('div', { class: 'gombsor' }, emailGomb) : null),
      kartya('Salonic-azonosítók', lista(p.azonositok).length ? tabla([{ cim: 'Fiók', ertek: (s) => s.fiok || s.account }, { cim: 'Külső azonosító', ertek: (s) => h('code', null, s.kulso_azonosito || s.external_id || '–') }], lista(p.azonositok)) : uresAllapot('Nincs Salonic-azonosító rögzítve.')),
      kartya('Kúra', kuraKartya(p.kura === null ? null : kura, p.kura === null)),
      kartya('Hajkamera-beszámítás', p.credit === null ? nincsJog(null) : creditKartya(creditek[creditek.length - 1])))) ],
    ['Foglalások', (c) => tolt(c, p.foglalasok === null ? nincsJog(null) : tabla([
      { cim: 'Időpont', ertek: (s) => datumIdo(pick(s, 'kezdes', 'start', 'idopont')) }, { cim: 'Szolgáltatás', ertek: (s) => szolgNev(pick(s, 'szolgaltatas', 'service')) },
      { cim: 'Kezelő', ertek: (s) => (typeof s.kezelo === 'object' && s.kezelo ? s.kezelo.nev : s.kezelo) || '–' }, { cim: 'Állapot', ertek: (s) => allapotJelveny('booking', pick(s, 'allapot', 'status')) },
      { cim: 'Igazolva', ertek: (s) => (s.igazolva ? datumIdo(s.igazolva) : '–') },
    ], lista(p.foglalasok), { ures: 'Nincs foglalás.', felirat: 'Foglalástörténet' }))],
    ['Bérlet', (c) => tolt(c, p.berletek === null ? nincsJog(null) : h('div', null, tabla([
      { cim: 'Típus', ertek: (s) => BERLET[s.tipus] || s.tipus }, { cim: 'Vásárlás', ertek: (s) => datum(s.vasarolva) },
      { cim: 'Lejárat', ertek: (s) => datum(s.lejarat) }, { cim: 'Szabad / összes', ertek: (s) => `${s.szabad ?? '–'} / ${s.osszes ?? '–'}` },
      { cim: 'Állapot', ertek: (s) => allapotJelveny('package', s.allapot) },
    ], lista(p.berletek).map(N.berlet), { ures: 'Nincs bérlet.', felirat: 'Bérletek' }), ctx.van(['reception', 'salon_manager', 'therapist', 'clinical_lead']) ? h('p', null, h('a', { href: `#/berletek/${encodeURIComponent(vid)}` }, 'Bérletek és ajándékok kezelése →')) : null))],
    ['Hozzájárulás', (c) => tolt(c, p.hozzajarulasok === null ? nincsJog(null) : h('div', null, hozzajarulasLista(hj), h('p', null, h('a', { href: `#/hozzajarulas/${encodeURIComponent(vid)}` }, 'Hozzájárulások kezelése →'))))],
    ['Üzenetek', (c) => tolt(c, p.uzenetek === null ? nincsJog(null) : tabla([
      { cim: 'Mikor', ertek: (s) => datumIdo(pick(s, 'elkuldve', 'ido', 'at')) }, { cim: 'Sablon', ertek: (s) => pick(s, 'sablon', 'template_key') || '–' },
      { cim: 'Csatorna', ertek: (s) => pick(s, 'csatorna', 'channel') || '–' }, { cim: 'Állapot / ok', ertek: (s) => [allapotJelveny('job', pick(s, 'allapot', 'status')), pick(s, 'ok', 'stop_ok') ? ` ${pick(s, 'ok', 'stop_ok')}` : ''] },
    ], lista(p.uzenetek), { ures: 'Még nem ment ki üzenet.', felirat: 'Üzenetek' }))],
    ['Dokumentumok', (c) => tolt(c, p.dokumentumok === null ? nincsJog(null) : tabla([
      { cim: 'Sorszám', ertek: (s) => (s.kezeles_sorszam ? `${s.kezeles_sorszam}. kezelés` : '–') }, { cim: 'Típus', ertek: (s) => ({ plan: 'A5 kúraterv', review: 'Kontroll-értékelés', closing: 'Kúrazáró' })[pick(s, 'fajta', 'kind')] || pick(s, 'fajta', 'kind') || '–' },
      { cim: 'Állapot', ertek: (s) => allapotJelveny('plan', pick(s, 'allapot', 'status')) }, { cim: 'Határidő', ertek: (s) => datumIdo(s.hatarido) },
      { cim: '', ertek: (s) => (kezeloi && s.kezeles_id ? h('a', { class: 'gomb gomb-kicsi', href: `#/kuraterv/${encodeURIComponent(s.kezeles_id)}` }, 'Megnyitás') : '') },
    ], lista(p.dokumentumok), { ures: 'Nincs dokumentum.', felirat: 'Dokumentumok' }))],
    ['Panasz', (c) => tolt(c, p.panaszok === null ? nincsJog(null) : tabla([
      { cim: 'Megnyitva', ertek: (s) => datumIdo(pick(s, 'megnyitva', 'letrehozva', 'created_at')) }, { cim: 'Állapot', ertek: (s) => allapotJelveny('complaint', pick(s, 'allapot', 'status')) },
      { cim: 'Forrás', ertek: (s) => pick(s, 'forras', 'source') || '–' }, { cim: 'Lezárva', ertek: (s) => (s.lezarva ? datumIdo(s.lezarva) : '–') },
    ], lista(p.panaszok), { ures: 'Nincs panasz.', felirat: 'Panaszok' }))],
  ];
  if (kezeloi) f.push(['Képek', (c) => tolt(c, lista(p.kepek).length
    ? h('div', null, h('p', null, `${lista(p.kepek).length} kamerakép tartozik a vendéghez (megtekintésük naplózott).`), h('div', { class: 'gombsor' }, ...lista(p.kepek).map((k) => h('span', { class: 'jelveny jelveny-info' }, `${k.alkalom}. alkalom`)), h('a', { class: 'gomb', href: `#/kepek/${encodeURIComponent(vid)}` }, 'Megnyitás a Kameraképek nézetben')))
    : h('div', null, uresAllapot('Még nincs feltöltött kamerakép.'), h('p', { class: 'kozep' }, h('a', { class: 'gomb', href: `#/kepek/${encodeURIComponent(vid)}` }, 'Kameraképek megnyitása'))))]);
  tolt(cel, ...fej, fulek(f.map(([cim, tolto]) => ({ cim, tolt: tolto }))));
}

function kuraKartya(k, tiltott) {
  if (tiltott) return h('p', { class: 'halvany' }, 'Ez az adat a szerepkörödnek nem érhető el.');
  if (!k || !k.allapot) return uresAllapot('Még nincs kúra.');
  return adatsor([['Állapot', allapotJelveny('course', k.allapot)], ['Igazolt kezelések', `${k.sorszam} / 11`], ['Következő alkalom', k.kovetkezo ? `${k.kovetkezo}.${k.kameraKotelezo ? ' (kötelező hajkamera-felvétel)' : ''}` : 'a kúra teljes'], ['Új kúra / bérlet ajánlható', k.ajanlhato === false ? jelveny('Nem (szakmai ok)', 'veszely') : 'Igen']]);
}
function creditKartya(c) {
  if (!c) return uresAllapot('Nincs hajkamerás felmérés beszámítással.');
  return adatsor([['Állapot', jelveny(N.CREDIT_ALLAPOT[c.allapot] || c.allapot || '–', c.jogosult ? 'ok' : '')], ['Összeg', ft(c.osszeg ?? 4990)], ['Határidő', c.hatarido ? datum(c.hatarido) : '–'], ['Felhasználva', c.felhasznalva ? datumIdo(c.felhasznalva) : 'még nem']]);
}
function hozzajarulasLista(hj) {
  const sorok = Object.entries(hj.csatornak).map(([k, e]) => ({ csatorna: k, ...e }));
  return tabla([{ cim: 'Csatorna', ertek: (s) => CSATORNA[s.csatorna] || s.csatorna }, { cim: 'Állapot', ertek: (s) => (N.aktivHozzajarulas(s.allapot) ? jelveny('Megadva', 'ok') : jelveny(s.allapot === 'withdrawn' ? 'Visszavonva' : 'Nincs', s.allapot === 'withdrawn' ? 'veszely' : '')) }, { cim: 'Szövegverzió', ertek: (s) => s.verzio || '–' }, { cim: 'Mikor', ertek: (s) => datumIdo(s.ido) }], sorok, { ures: 'Nincs hozzájárulási adat.' });
}
