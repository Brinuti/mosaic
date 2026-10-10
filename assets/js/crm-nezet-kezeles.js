// Kezeles kozben: telefonra szabott, egy oldalas vezetett folyamat (igazolas -> kamerakep -> megfigyeles -> cel -> ritmus -> rutin -> PDF + kuldes).
// Nagy gombok, valaszto-chipek; a vegen egy gombbal veglegesit, A5 PDF-et keszit es (megerosites utan) elkuldi. Ugyanazokat a vegpontokat hasznalja, mint a Kuraterv-szerkeszto.
// REQUIRES_VERIFICATION: a javasolt megfigyelesek / celok szovege szakmai jovahagyasra var (a kezelo szabadon atirhatja).
import { h, tolt, oldalCim, toltes, kartya, gomb, futtat, ertesit, figyelmeztetes, jelveny, megerosites, kepAtmeretez, isoNap, napEltolas, datumIdo, uresAllapot, pick } from './crm-ui.js';

const MEGFIGYELES = [
  'Száraz, feszes fejbőr', 'Zsírosodásra hajlamos fejbőr', 'Pirosas, érzékeny fejbőr', 'Pehelyszerű hámlás látható',
  'Fejbőr-lerakódás látható', 'Vékonyabb hajszálak a feji tetőn', 'Ritkább hajszálak a választékban', 'Egyenetlen hajsűrűség',
];
const CEL = [
  'Nyugodtabb, kiegyensúlyozottabb fejbőr', 'Kevesebb hámlás, kellemesebb fejbőr-érzet', 'Erősebbnek és dúsabbnak látszó haj', 'Egészségesebb fejbőr-környezet a hajnövekedéshez',
];
const RITMUS = [7, 14, 21];
const HASZNALAT = ['Heti 2 alkalommal, hajmosáskor', 'Heti 1 alkalommal, hajmosáskor', 'Naponta egyszer, a fejbőrre'];
const KOVETKEZO = ['1 hét múlva', '2 hét múlva', '3 hét múlva', '1 hónap múlva'];
const kisbetu = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : '');

export default async function nezet(ctx) {
  const fid = ctx.alfa[0];
  if (!fid) return lista(ctx);
  return folyamat(ctx, fid);
}

// ---- 1. a mai vendegek: egy kepernyo (a regi munkalista helyett) -----------------------------------------------------------------------------
// Kezelo: a kartya a vezetett folyamatot nyitja; "Nem jelent meg" es "Kerdoiv-link" is itt van. Recepcio / szalonvezeto: ugyanaz a lista, csak olvashato (a vendeglapra visz).
async function lista(ctx) {
  const nap = ctx.params.get('nap') || isoNap();
  const kezelo = ctx.van(['therapist', 'clinical_lead']);
  const t = h('div');
  const ugras = (d, felirat) => gomb(felirat, () => ctx.navigal(`#/kezeles?nap=${napEltolas(nap, d)}`), { tipus: 'kicsi' });
  tolt(ctx.root, oldalCim(nap === isoNap() ? 'Ma' : `Vendégek: ${nap}`, ugras(-1, '← Előző nap'), nap !== isoNap() ? gomb('Ma', () => ctx.navigal('#/kezeles'), { tipus: 'kicsi' }) : null, ugras(1, 'Következő nap →')), t);
  const v = await toltes(t, () => ctx.api.get('/munkalista', { nap }));
  if (v === undefined) return;
  const sorok = (v.foglalasok || []).filter((s) => s.allapot !== 'cancelled');
  if (!sorok.length) { tolt(t, uresAllapot('Erre a napra nincs foglalás.', 'A nap váltásához használd a fenti gombokat.')); return; }
  tolt(t, sorok.map((s) => kartya_(ctx, s, nap, kezelo)));
}

function kartya_(ctx, s, nap, kezelo) {
  const { api } = ctx;
  const igazolt = !!s.megjelent_igazolt;
  const nincsMeg = s.allapot === 'no_show';
  const href = kezelo ? `#/kezeles/${encodeURIComponent(s.foglalas_id)}?nap=${nap}` : (ctx.van(['reception', 'salon_manager']) ? `#/vendegek/${encodeURIComponent(s.vendeg.id)}` : null);
  const jelek = [
    igazolt ? jelveny('Igazolva', 'ok') : nincsMeg ? jelveny('Nem jelent meg', '') : jelveny('Még nem igazolt', ''),
    s.kontraindikacio_jelzes ? jelveny('Jelzés: ellenőrzés kell', 'veszely') : null,
    s.felmero && !s.felmero.kitoltve && !igazolt && !nincsMeg ? jelveny('Kérdőív hiányzik', '') : null,
  ];
  const fej = h(href ? 'a' : 'div', { class: 'kk-kartya-fej', ...(href ? { href } : {}) }, h('strong', null, s.vendeg.nev), h('span', { class: 'halvany' }, datumIdo(s.kezdes)), h('div', { class: 'kk-jelek' }, jelek));
  const akciok = [];
  if (kezelo && !igazolt && !nincsMeg) {
    if (s.felmero && !s.felmero.kitoltve) {
      const k = gomb('Kérdőív-link', futtatLink(ctx, s), { tipus: 'kicsi' }); akciok.push(k);
    }
    const ns = gomb('Nem jelent meg', null, { tipus: 'kicsi' });
    ns.addEventListener('click', futtat(ns, async () => {
      if (!(await megerosites('Nem jelent meg', 'Hiteles no-show jelölés. Ez nem számít elvégzett kezelésnek, és nem vonja le a bérletet.', { megerosit: 'Jelölés', veszely: true }))) return;
      await api.post(`/foglalasok/${encodeURIComponent(s.foglalas_id)}/no-show`, {}); ertesit('Megjelölve: nem jelent meg.'); ctx.frissit();
    }));
    akciok.push(ns);
  }
  return h('div', { class: 'kk-kartya' }, fej, akciok.length ? h('div', { class: 'gombsor kk-akciok' }, akciok) : null);
}

function futtatLink(ctx, s) {
  return async (ev) => {
    const g = ev && ev.currentTarget; if (g) g.disabled = true;
    try {
      const r = await ctx.api.post(`/foglalasok/${encodeURIComponent(s.foglalas_id)}/felmero-kiad`, {});
      if (r && r.mar) { ertesit('A kérdőív már kiadva (a link csak kiadáskor látható).'); return; }
      const tok = r && (r.link || r.token); const url = tok ? (String(tok).startsWith('http') ? tok : `${location.origin}/api/crm/public/felmero/${tok}`) : '';
      await megerosites('Kérdőív-link a vendégnek', h('div', null, h('p', null, 'Ezt a linket add át a vendégnek (személyes, csak most látható):'), h('input', { type: 'text', readonly: true, value: url, 'aria-label': 'Kérdőív-link', onfocus: (e) => e.target.select() })), { megerosit: 'Kész', megse: 'Bezár' });
    } catch (e) { if (e.status === 401) throw e; ertesit(e.message || 'Hiba történt.', 'hiba'); } finally { if (g) g.disabled = false; }
  };
}

// ---- 2. a vezetett folyamat ---------------------------------------------------------------------------------------------------------------------
async function folyamat(ctx, fid) {
  const { api, root } = ctx;
  const nap = ctx.params.get('nap') || isoNap();
  const hely = h('div');
  tolt(root, oldalCim('Kezelés közben', h('a', { class: 'gomb', href: `#/kezeles?nap=${nap}` }, '← Vendégek')), hely);
  const lv = await toltes(hely, () => api.get('/munkalista', { nap }));
  if (lv === undefined) return;
  const b = (lv.foglalasok || []).find((s) => s.foglalas_id === fid);
  if (!b) { tolt(hely, figyelmeztetes('figyelem', 'Ez a foglalás nem található ezen a napon.'), h('a', { class: 'gomb', href: `#/kezeles?nap=${nap}` }, 'Vissza a listához')); return; }

  const all = { igazolt: !!b.megjelent_igazolt, sid: null, sorszam: null, kamera: false, kepVan: false, kepId: null, fajta: 'plan' };
  const ertek = { meg: new Set(), cel: '', ritmus: 14, termek: '', hasznalat: '', kovetkezo: '', uzenet: '', uzenetKezi: false, ertekeles: '', rutinKontroll: '', egyeb: '' };
  const lepesek = h('div', { class: 'kk' });
  const kiegeszito = h('div');
  tolt(hely, h('h2', null, b.vendeg.nev), h('p', { class: 'halvany' }, datumIdo(b.kezdes)), lepesek);

  // az aktualis kezeles azonositoja (igazolt foglalasnal a vendeg kurajabol: a legutolso alkalom)
  const sessionBetolt = async () => {
    const p = await api.get(`/vendegek/${encodeURIComponent(b.vendeg.id)}`);
    const k = (p.kura && p.kura.kezelesek) || [];
    const s = k.slice().sort((x, y) => (x.sorszam || 0) - (y.sorszam || 0)).pop();
    if (s) { all.sid = s.id; all.sorszam = s.sorszam; all.kamera = !!s.kamera_kotelezo; }
    const kepek = (p.kepek || []).filter((x) => String(x.alkalom) === String(all.sorszam));
    all.kepVan = kepek.length > 0; all.kepId = kepek.length ? kepek[0].id : null;
  };
  if (all.igazolt) { try { await sessionBetolt(); } catch { /* a vendegprofil nelkul a folyamat az igazolasi lepesnel indul */ } }
  const terv = async () => { const v = await api.get(`/kezelesek/${encodeURIComponent(all.sid)}/terv`); all.fajta = pick(v.terv || v, 'fajta', 'kind') || 'plan'; return v; };

  const chip = (felirat, aktiv, onclick) => { const e = h('button', { type: 'button', class: 'kk-chip', 'aria-pressed': aktiv ? 'true' : 'false' }, felirat); e.addEventListener('click', () => { onclick(e); }); return e; };
  const valaszto = (opciok, aktualis, beallit) => { // egy valaszthato
    const sor = h('div', { class: 'kk-chipek' });
    const rajz = () => tolt(sor, opciok.map((o) => chip(String(o), String(o) === String(aktualis()), () => { beallit(o); rajz(); frissitUzenet(); })));
    rajz(); return sor;
  };

  // ---- 1. lepes: igazolas ----
  const l1 = h('section', { class: 'kk-lepes' });
  const rajzL1 = () => tolt(l1, h('h3', null, h('span', { class: 'kk-szam' }, '1'), 'Kezelés igazolása'),
    all.igazolt ? h('p', null, jelveny('Igazolva', 'ok'), all.sorszam ? ` ${all.sorszam}. alkalom` : '') : (() => {
      const g = h('button', { type: 'button', class: 'gomb gomb-fo kk-nagy', disabled: !!b.kontraindikacio_jelzes }, 'A kezelés megtörtént – igazolom');
      g.addEventListener('click', futtat(g, async () => {
        if (!(await megerosites('Kezelés igazolása', `Igazolod, hogy a kezelés ténylegesen megtörtént (${b.vendeg.nev})? Ez növeli a kúra sorszámát, és nem vonható vissza.`, { megerosit: 'Igen, megtörtént' }))) return;
        const e = await api.post(`/foglalasok/${encodeURIComponent(fid)}/completed`, {});
        all.igazolt = true; all.sid = e.kezeles_id; all.sorszam = e.kezeles_sorszam; all.kamera = !!e.kamera_kotelezo;
        if (!all.sid) await sessionBetolt();
        ertesit(`Igazolva: ${all.sorszam}. kezelés.`); await teljesRajz();
      }));
      return h('div', null, b.kontraindikacio_jelzes ? figyelmeztetes('veszely', 'Kontraindikáció-jelzés: előbb az Állapotfelmérő nézetben át kell nézni.') : null, g);
    })());

  // ---- 2. lepes: kamerakep ----
  // harom forras: (1) mentett kep kivalasztasa (a hajkamera-app / galeria kepe; a tablet fajlvalasztoja a legutobbi kepeket mutatja), (2) fotó a telefon kamerajaval,
  // (3) USB hajkamera elo kepe a bongeszoben (ha a tablet Chrome-ja latja az USB kamerat; a kamerat az app kozben nem foghatja)
  const l2 = h('section', { class: 'kk-lepes' });
  const fej2 = () => h('h3', null, h('span', { class: 'kk-szam' }, '2'), 'Hajkamera-kép');
  const kepFelvesz = async (blob, csere) => {
    await api.feltolt(`/kezelesek/${encodeURIComponent(all.sid)}/kepek`, { pont: all.sorszam, ...(csere ? { csere: '1' } : {}) }, blob);
    await sessionBetolt().catch(() => { all.kepVan = true; });
    ertesit(csere ? 'A kép lecserélve.' : 'A kép feltöltve.'); rajzL2();
  };
  const fajlGomb = (id, felirat, csere, capture) => {
    const fajl = h('input', { type: 'file', accept: 'image/*', ...(capture ? { capture: 'environment' } : {}), class: 'csak-olvaso', id });
    const cimke = h('label', { class: `gomb kk-nagy${capture ? '' : ' gomb-fo'}`, for: id }, felirat);
    fajl.addEventListener('change', async () => {
      const fj = fajl.files && fajl.files[0]; if (!fj) return;
      try { cimke.textContent = 'Feltöltés…'; const { blob } = await kepAtmeretez(fj); await kepFelvesz(blob, csere); } catch (e) {
        if (e.status === 409 && !csere) { await sessionBetolt().catch(() => {}); ertesit('Ehhez az alkalomhoz már van feltöltött kép.'); rajzL2(); return; }
        ertesit(e.message || 'A feltöltés nem sikerült.', 'hiba'); cimke.textContent = felirat;
      }
    });
    return [cimke, fajl];
  };
  const usbPanel = (csere) => {
    const hely = h('div', { class: 'kk-kamera' });
    const nyit = h('button', { type: 'button', class: 'gomb kk-nagy' }, 'USB hajkamera – élő kép');
    let stream = null;
    const leallit = () => { if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; } };
    nyit.addEventListener('click', async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { tolt(hely, figyelmeztetes('figyelem', 'Ez a böngésző nem engedi a kamera használatát.')); return; }
      try {
        const video = h('video', { class: 'kk-video', autoplay: true, playsinline: true, muted: true });
        const valaszto = h('select', { class: 'kk-mezo', 'aria-label': 'Kamera kiválasztása' });
        const info = h('p', { class: 'halvany kicsi' });
        const indit = async (deviceId) => {
          leallit();
          stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: deviceId ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } } : { width: { ideal: 1920 }, height: { ideal: 1080 } } });
          video.srcObject = stream; try { await video.play(); } catch { /* automatikus lejatszas tiltva */ }
          const aktiv = stream.getVideoTracks()[0].getSettings();
          const eszk = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
          tolt(valaszto, eszk.map((d, i) => h('option', { value: d.deviceId, selected: d.deviceId === aktiv.deviceId }, d.label || `Kamera ${i + 1}`)));
          tolt(info, `${eszk.length} kamera található. Aktív felbontás: ${aktiv.width || '?'}×${aktiv.height || '?'}.${eszk.length < 2 ? ' Ha az USB hajkamera nincs a listában, ez a tablet böngészője nem látja; használd a „mentett kép kiválasztása” gombot.' : ''}`);
        };
        valaszto.addEventListener('change', () => indit(valaszto.value).catch((e) => ertesit(e.message, 'hiba')));
        const kesz = h('button', { type: 'button', class: 'gomb gomb-fo kk-nagy' }, 'Kép készítése');
        kesz.addEventListener('click', futtat(kesz, async () => {
          if (!video.videoWidth) { ertesit('A kamera még nem ad képet.', 'hiba'); return; }
          const c = document.createElement('canvas'); const arany = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight));
          c.width = Math.round(video.videoWidth * arany); c.height = Math.round(video.videoHeight * arany);
          c.getContext('2d').drawImage(video, 0, 0, c.width, c.height);
          const blob = await new Promise((ok, nem) => c.toBlob((x) => (x ? ok(x) : nem(new Error('A kép elkészítése nem sikerült.'))), 'image/jpeg', 0.85));
          leallit(); await kepFelvesz(blob, csere);
        }));
        const bezar = h('button', { type: 'button', class: 'gomb' }, 'Bezárás');
        bezar.addEventListener('click', () => { leallit(); tolt(hely, nyit); });
        tolt(hely, valaszto, video, info, kesz, bezar);
        await indit(localStorage.getItem('crm_kamera') || undefined).catch(async () => indit(undefined));
        valaszto.addEventListener('change', () => { try { localStorage.setItem('crm_kamera', valaszto.value); } catch { /* nincs tarhely */ } });
      } catch (e) { leallit(); tolt(hely, figyelmeztetes('figyelem', `A kamera nem indítható (${e && e.name ? e.name : 'hiba'}). Zárd be a hajkamera-appot, engedélyezd a kamera használatát az oldalnak, vagy válaszd a „mentett kép kiválasztása” gombot.`), nyit); }
    });
    tolt(hely, nyit);
    return hely;
  };
  // a tableten (kamera mellett) elkuldott, vendeg nelkuli kepek: a kezelo itt nezi meg es rendeli ehhez a vendeghez / alkalomhoz
  const beerkezoPanel = (csere) => {
    const hely = h('div', { class: 'kk-beerkezo' });
    let idozito = null;
    const rajz = async () => {
      if (!hely.isConnected) { clearInterval(idozito); return; }
      try {
        const v = await api.get('/kep-beerkezo'); const k = v.kepek || [];
        tolt(hely, h('h4', null, 'Beérkezett képek (tablet)'), k.length ? h('div', { class: 'kk-mini-racs' }, k.map((x) => {
          const g = h('button', { type: 'button', class: 'kk-mini', 'aria-label': `Beérkezett kép ${datumIdo(x.created_at)}` },
            h('img', { src: api.url(`/kep-beerkezo/${encodeURIComponent(x.id)}/kep`), alt: 'Beérkezett kép', loading: 'lazy' }), h('span', { class: 'kicsi halvany' }, datumIdo(x.created_at)));
          g.addEventListener('click', async () => {
            const igen = await megerosites('Kép hozzárendelése', h('div', null, h('img', { src: api.url(`/kep-beerkezo/${encodeURIComponent(x.id)}/kep`), alt: 'Kiválasztott kép', style: 'max-width:100%;border-radius:8px' }),
              h('p', null, `Ezt a képet rendeled ide: ${b.vendeg.nev}, ${all.sorszam}. alkalom?${csere ? ' A meglévő kép törlődik.' : ''}`)), { megerosit: 'Igen, ehhez a vendéghez' });
            if (!igen) return;
            try { await api.post(`/kep-beerkezo/${encodeURIComponent(x.id)}/hozzarendel`, { kezeles_id: all.sid, ...(csere ? { csere: true } : {}) }); await sessionBetolt().catch(() => { all.kepVan = true; }); ertesit('A kép hozzárendelve.'); clearInterval(idozito); rajzL2(); } catch (e) { ertesit(e.message || 'A hozzárendelés nem sikerült.', 'hiba'); }
          });
          return g;
        })) : h('p', { class: 'halvany kicsi' }, 'Nincs beérkezett kép. A tableten a „Képküldés (tablet)” menüben küldhetők.'));
      } catch (e) { if (e.status === 401) throw e; tolt(hely, h('p', { class: 'halvany kicsi' }, 'A beérkezett képek most nem tölthetők be.')); }
    };
    rajz(); idozito = setInterval(rajz, 6000);
    return hely;
  };
  const rajzL2 = () => {
    if (!all.sid) { tolt(l2, fej2(), h('p', { class: 'halvany' }, 'Az igazolás után tölthető fel.')); return; }
    if (!all.kamera) { tolt(l2, fej2(), h('p', { class: 'halvany' }, `A(z) ${all.sorszam}. alkalmon nem kötelező a hajkamera-felvétel.`)); return; }
    if (all.kepVan) {
      const torol = h('button', { type: 'button', class: 'gomb gomb-veszely kk-nagy' }, 'Kép törlése');
      torol.addEventListener('click', futtat(torol, async () => {
        if (!all.kepId) return;
        if (!(await megerosites('Kép törlése', 'A kép véglegesen törlődik, és a belőle kiadott vendég-linkek is érvénytelenek lesznek. A kamera-felvétel ehhez az alkalomhoz kötelező marad, utána újat kell feltölteni.', { megerosit: 'Törlés', veszely: true }))) return;
        await api.del(`/kepek/${encodeURIComponent(all.kepId)}`);
        all.kepVan = false; all.kepId = null; ertesit('A kép törölve.'); rajzL2();
      }));
      tolt(l2, fej2(), h('p', null, `A(z) ${all.sorszam}. alkalomhoz van feltöltött kép `, jelveny('Feltöltve', 'ok')),
        ...fajlGomb('kk-kep-csere', 'Kép cseréje: mentett kép kiválasztása', true, false), usbPanel(true), beerkezoPanel(true), torol);
      return;
    }
    tolt(l2, fej2(), h('p', null, `A(z) ${all.sorszam}. alkalmon kötelező, mindig ugyanabból a rögzítési pontból. `, jelveny('Hiányzik', 'figyelem')),
      beerkezoPanel(false), ...fajlGomb('kk-kep', 'Mentett kép kiválasztása (hajkamera-app)', false, false), usbPanel(false), ...fajlGomb('kk-kep-telefon', 'Fotó a készülék kamerájával', false, true));
  };

  // ---- 3-6. lepes: tartalom (a kezeles fajtaja szerint) ----
  const l3 = h('section', { class: 'kk-lepes' });
  const uzenetEl = h('textarea', { class: 'kk-szoveg', rows: '5', 'aria-label': 'Személyes üzenet (2–3 mondat)' });
  uzenetEl.addEventListener('input', () => { ertek.uzenetKezi = true; ertek.uzenet = uzenetEl.value; });
  const frissitUzenet = () => {
    if (ertek.uzenetKezi) return;
    const m = [...ertek.meg];
    const e1 = m.length ? `A hajkamerás vizsgálat alapján ${m.map(kisbetu).join(', ').replace(/ látható/g, '')} figyelhető meg.` : 'A hajkamerás vizsgálatot elvégeztük.';
    const e2 = ertek.cel ? `Célunk: ${kisbetu(ertek.cel)}.` : '';
    const e3 = `Kérjük, tartsa a ${ertek.ritmus} napos ritmust és az otthoni rutint, és jelezzen, ha bármi szokatlant tapasztal.`;
    ertek.uzenet = [e1, e2, e3].filter(Boolean).join(' '); uzenetEl.value = ertek.uzenet;
  };
  const rajzL3 = () => {
    if (!all.sid) { tolt(l3, h('h3', null, h('span', { class: 'kk-szam' }, '3'), 'Megfigyelés, cél, ritmus, rutin'), h('p', { class: 'halvany' }, 'Az igazolás után tölthető ki.')); return; }
    if (all.fajta === 'review') {
      const e = h('textarea', { class: 'kk-szoveg', rows: '5', 'aria-label': 'Értékelés (2–3 mondat)', oninput: (ev) => { ertek.ertekeles = ev.target.value; } });
      const r = h('textarea', { class: 'kk-szoveg', rows: '3', 'aria-label': 'Otthoni rutin kontroll', oninput: (ev) => { ertek.rutinKontroll = ev.target.value; } });
      tolt(l3, h('h3', null, h('span', { class: 'kk-szam' }, '3'), 'Kontroll-értékelés'), h('p', { class: 'halvany' }, '2–3 tényszerű, nem diagnosztikus mondat.'), e, h('h4', null, 'Otthoni rutin kontroll'), r); return;
    }
    if (all.fajta === 'closing') {
      tolt(l3, h('h3', null, h('span', { class: 'kk-szam' }, '3'), 'Kúrazáró dokumentum'), h('p', null, 'A 11. alkalom záró összefoglalóját a „Kúrazáró dokumentum” menüben készítheted el.'), h('a', { class: 'gomb gomb-fo kk-nagy', href: '#/kurazaro' }, 'Megnyitás')); return;
    }
    const megChip = (o) => chip(o, ertek.meg.has(o), (el) => { if (ertek.meg.has(o)) ertek.meg.delete(o); else ertek.meg.add(o); el.setAttribute('aria-pressed', ertek.meg.has(o) ? 'true' : 'false'); frissitUzenet(); });
    const termek = h('input', { type: 'text', class: 'kk-mezo', 'aria-label': 'Oxygeni termék neve', placeholder: 'Oxygeni termék neve', oninput: (ev) => { ertek.termek = ev.target.value; } });
    const hasznalat = h('input', { type: 'text', class: 'kk-mezo', 'aria-label': 'Használat', placeholder: 'Használat (vagy válassz fent)', oninput: (ev) => { ertek.hasznalat = ev.target.value; } });
    const hasznalatChip = h('div'); const rajzH = () => tolt(hasznalatChip, valaszto(HASZNALAT, () => ertek.hasznalat, (o) => { ertek.hasznalat = o; hasznalat.value = o; }));
    rajzH();
    const celMezo = h('input', { type: 'text', class: 'kk-mezo', 'aria-label': 'Egyéb cél', placeholder: 'Vagy saját szavaiddal', oninput: (ev) => { ertek.cel = ev.target.value; frissitUzenet(); } });
    const kovMezo = h('input', { type: 'text', class: 'kk-mezo', 'aria-label': 'Következő időpont', placeholder: 'Vagy saját szavaiddal', oninput: (ev) => { ertek.kovetkezo = ev.target.value; } });
    tolt(l3, h('h3', null, h('span', { class: 'kk-szam' }, '3'), 'Mit látsz a hajkamerán?'), h('p', { class: 'halvany kicsi' }, 'Több is választható. Szakmai, nem diagnosztikus megfogalmazás.'),
      h('div', { class: 'kk-chipek' }, MEGFIGYELES.map(megChip)),
      h('h3', { class: 'kk-alcim' }, h('span', { class: 'kk-szam' }, '4'), 'Személyes cél'), valaszto(CEL, () => ertek.cel, (o) => { ertek.cel = o; celMezo.value = ''; }), celMezo,
      h('h3', { class: 'kk-alcim' }, h('span', { class: 'kk-szam' }, '5'), 'Kezelési ritmus'), h('p', { class: 'halvany kicsi' }, 'Teljes, 11 alkalmas kúra javasolt. Ritmus (nap):'),
      valaszto(RITMUS.map((n) => `${n}`), () => String(ertek.ritmus), (o) => { ertek.ritmus = Number(o); }),
      h('h3', { class: 'kk-alcim' }, h('span', { class: 'kk-szam' }, '6'), 'Otthoni Oxygeni-rutin'), termek, hasznalatChip, hasznalat,
      h('h3', { class: 'kk-alcim' }, h('span', { class: 'kk-szam' }, '7'), 'Következő időpont'), valaszto(KOVETKEZO, () => ertek.kovetkezo, (o) => { ertek.kovetkezo = o; kovMezo.value = ''; }), kovMezo,
      h('h3', { class: 'kk-alcim' }, h('span', { class: 'kk-szam' }, '8'), 'Személyes üzenet'), h('p', { class: 'halvany kicsi' }, 'Magától megírja a választásaid alapján; átírhatod. 2–3 mondat legyen.'), uzenetEl);
    frissitUzenet();
  };

  // ---- vegso gombok ----
  const l9 = h('section', { class: 'kk-lepes kk-vegso' });
  const hiba = h('div', { 'aria-live': 'assertive' });
  const mezokOsszeallit = () => {
    if (all.fajta === 'review') return { ertekeles: ertek.ertekeles.trim(), otthoni_rutin_kontroll: ertek.rutinKontroll.trim() };
    return {
      fo_panasz: ertek.fo_panasz || 'Fejbőr- és hajállapot felmérése', megfigyelesek: [...ertek.meg], cel: ertek.cel.trim(), teljes_kura_11: true, ritmus_nap: ertek.ritmus,
      otthoni_apolas: { termek: ertek.termek.trim(), hasznalat: ertek.hasznalat.trim() }, kezeloi_javaslat: (uzenetEl.value || '').trim(), kovetkezo_idopont: { javasolt_intervallum: ertek.kovetkezo.trim() },
    };
  };
  const hianyok = (e) => { const r = Array.isArray(e.reszlet) ? e.reszlet : []; tolt(hiba, figyelmeztetes('veszely', h('strong', null, e.message), r.length ? h('ul', null, r.map((x) => h('li', null, String(x).replace(/^(MEZO|KEP|ALLAPOT):/, '')))) : null)); };
  const mentVeglegesit = async () => {
    const v = await terv(); const t = v.terv || v; const planId = pick(t, 'id', 'plan_id');
    if (!ertek.fo_panasz) ertek.fo_panasz = (pick(t, 'mezok', 'fields') || {}).fo_panasz || '';
    await api.put(`/kezelesek/${encodeURIComponent(all.sid)}/terv`, { mezok: mezokOsszeallit() });
    await api.post(`/tervek/${encodeURIComponent(planId)}/veglegesit`, {});
    return planId;
  };
  const pdfGomb = h('button', { type: 'button', class: 'gomb kk-nagy' }, 'A5 PDF megtekintése');
  pdfGomb.addEventListener('click', futtat(pdfGomb, async () => {
    try {
      const planId = await mentVeglegesit(); tolt(hiba);
      const blob = await api.blob(`/tervek/${encodeURIComponent(planId)}/a5.pdf`);
      const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      const uj = window.open(url, '_blank', 'noopener');
      if (!uj) tolt(hiba, figyelmeztetes('figyelem', h('a', { href: url, target: '_blank', rel: 'noopener', class: 'gomb' }, 'A PDF megnyitása')));
    } catch (e) { if (e.status === 401) throw e; hianyok(e); }
  }));
  const kuldGomb = h('button', { type: 'button', class: 'gomb gomb-arany kk-nagy' }, 'Véglegesít és küld a vendégnek');
  kuldGomb.addEventListener('click', futtat(kuldGomb, async () => {
    try {
      const mod = ctx.uzemmod() === 'eles' ? 'ÉLES – valódi e-mail megy ki!' : 'dry-run, valódi küldés nincs.';
      if (!(await megerosites('E-mail küldése', `A személyes terv PDF-je e-mailben megy a vendégnek. Üzemmód: ${mod}`, { megerosit: 'Küldés' }))) return;
      const planId = await mentVeglegesit();
      await api.post(`/tervek/${encodeURIComponent(planId)}/kuld`, {});
      tolt(hiba); tolt(l9, h('h3', null, 'Kész'), figyelmeztetes('ok', ctx.uzemmod() === 'eles' ? 'A terv elküldve a vendégnek.' : 'A terv a küldési sorba került (dry-run: valódi e-mail nem ment ki).'),
        h('a', { class: 'gomb gomb-fo kk-nagy', href: `#/kezeles?nap=${nap}` }, 'Következő vendég'));
    } catch (e) { if (e.status === 401) throw e; hianyok(e); }
  }));
  const rajzL9 = () => { if (all.fajta === 'closing') { tolt(l9); return; } tolt(l9, hiba, all.sid ? h('div', { class: 'kk-gombok' }, pdfGomb, kuldGomb) : null); };

  async function teljesRajz() {
    if (all.sid && all.igazolt) { try { await terv(); } catch { /* a tartalom-lepes ujraprobalja */ } }
    rajzL1(); rajzL2(); rajzL3(); rajzL9();
  }
  tolt(lepesek, l1, l2, l3, l9, kiegeszito);
  await teljesRajz();
}
