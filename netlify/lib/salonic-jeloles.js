// A Salonic-naptar jelolese ("Ott leszek" gomb): a sminktetovalas koszonooldalan a vendeg megerositi az idopontjat -> az idopont BELSO megjegyzese
// (a vendeg nem latja, a vendeg NEM kap ertesitest) a "✅ Megerositve a weboldalon (datum)" sort kapja a Salonic admin feluleten.
//
// A Salonicnak nincs API-ja / webhookja, ezert a modul azt teszi, amit a salon az admin feluleten kezzel: belep, megkeresi a vendeg idopontjat az online
// foglalasok kozott, megnyitja a szerkeszto urlapot, a belso megjegyzest kiegesziti, es elmenti az urlapot (ertesites nelkul).
//
// Biztonsagi elvek:
//  - belepesi adat CSAK a kornyezeti valtozokbol (SALONIC_PMU_JELSZO titkos; SALONIC_PMU_UGYFEL alapbol "mosaic-pmu"); nincs jelszo = a jelolés ki van kapcsolva;
//  - NEM IR, ha az idopont nem egyertelmu: pontosan EGY idopont kell, amelynek datuma / ideje megegyezik a kapottal ES a vendeg-azonositoja (g) egyezik;
//  - ertesites nelkul ment (notifyEdit = 0); ha az urlapon nincs "Nincs ertesites" (0) opcio, nem ir;
//  - minden mas mezo valtozatlanul visszamegy (ugyanaz, mint a bongeszo urlap-bekuldese); a mentes utan visszaolvassuk, hogy a jelolés tenyleg ott van-e;
//  - nem dob kivetelt, a hiba csak a naploba kerul (azonosito, jelszo / szemelyes adat nelkul): a vendeg e-mailje a szalonnak ettol fuggetlenul elmegy;
//  - ugyanazt az idopontot ketszer nem jeloli (a jelolés szovege alapjan).
// Hasznalat: functions/[[path]].js (form-name = pmu-megerosites), a bongeszo kuldi a kezdetet (unix) es a Salonic-vendegazonositot (g).
export const JELOLES = '✅ Megerősítve a weboldalon';
const HONAPOK = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];
const IDOZONA = 'Europe/Budapest';
const MAX_JELOLT_JELZES = 2000;

function budapesti(ts) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: IDOZONA, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(ts * 1000)).map((x) => [x.type, x.value]));
  return { ev: +p.year, ho: +p.month, nap: +p.day, ora: +p.hour, perc: +p.minute };
}
const ketjegy = (n) => String(n).padStart(2, '0');

// --- kis HTML-segedek (nincs DOM a Workerben) -------------------------------------------------------------------------------------------------
function entitas(s) {
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (m, e) => {
    const k = e.toLowerCase();
    if (k === 'amp') return '&'; if (k === 'lt') return '<'; if (k === 'gt') return '>'; if (k === 'quot') return '"'; if (k === 'apos') return "'"; if (k === 'nbsp') return '\u00a0';
    const kod = k[1] === 'x' ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
    try { return String.fromCodePoint(kod); } catch { return m; }
  });
}
function attributumok(tag) {
  const a = {};
  for (const m of tag.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) {
    const nev = m[1].toLowerCase();
    if (nev === 'input' || nev === 'select' || nev === 'textarea' || nev === 'option') continue;
    a[nev] = m[2] !== undefined ? entitas(m[2]) : m[3] !== undefined ? entitas(m[3]) : m[4] !== undefined ? entitas(m[4]) : '';
  }
  return a;
}

// Az urlap mezoi a bongeszo bekuldesi sorrendjeben: [[nev, ertek], ...] + a belso megjegyzes / ertesites mezok adatai.
export function urlapOlvas(html, azonosito) {
  const kezd = html.search(new RegExp(`<form[^>]*id=["']${azonosito}["']`, 'i'));
  if (kezd < 0) return null;
  const veg = html.indexOf('</form>', kezd);
  const urlap = html.slice(kezd, veg < 0 ? undefined : veg);
  const nyito = /<form[^>]*>/i.exec(urlap)[0];
  const akcio = attributumok(nyito).action || '';
  const mezok = [];
  const select = {};   // nev -> { opciok: [ertekek], kivalasztott }
  const re = /<(input)\b([^>]*)>|<(select)\b([^>]*)>([\s\S]*?)<\/select>|<(textarea)\b([^>]*)>([\s\S]*?)<\/textarea>/gi;
  for (const m of urlap.matchAll(re)) {
    if (m[1]) {
      const a = attributumok(m[2]);
      if (!a.name || 'disabled' in a) continue;
      const tipus = (a.type || 'text').toLowerCase();
      if (['submit', 'button', 'image', 'reset', 'file'].includes(tipus)) continue;
      if ((tipus === 'checkbox' || tipus === 'radio') && !('checked' in a)) continue;
      mezok.push([a.name, a.value !== undefined ? a.value : (tipus === 'checkbox' || tipus === 'radio' ? 'on' : '')]);
    } else if (m[3]) {
      const a = attributumok(m[4]);
      if (!a.name || 'disabled' in a) continue;
      const opciok = [...m[5].matchAll(/<option\b([^>]*)>/gi)].map((o) => attributumok(o[1]));
      if (!opciok.length) continue;
      const kiv = opciok.find((o) => 'selected' in o) || opciok[0];
      mezok.push([a.name, kiv.value !== undefined ? kiv.value : '']);
      select[a.name] = { opciok: opciok.map((o) => o.value), kivalasztott: kiv.value };
    } else if (m[6]) {
      const a = attributumok(m[7]);
      if (!a.name || 'disabled' in a) continue;
      mezok.push([a.name, entitas(m[8].replace(/^\r?\n/, ''))]);
    }
  }
  return { akcio, mezok, select };
}
const mezoErtek = (mezok, nev) => { const x = mezok.find(([n]) => n === nev); return x ? x[1] : undefined; };

// Egyszeru suti-tar (a Salonic PHP-munkamenetet hasznal): a Set-Cookie fejlecek osszegyujtese es visszakuldese.
function sutiTar() {
  const suti = new Map();
  return {
    be(valasz) {
      const lista = typeof valasz.headers.getSetCookie === 'function' ? valasz.headers.getSetCookie() : [];
      for (const s of lista) {
        const [par] = s.split(';');
        const i = par.indexOf('=');
        if (i > 0) suti.set(par.slice(0, i).trim(), par.slice(i + 1).trim());
      }
    },
    fejlec() { return [...suti].map(([k, v]) => `${k}=${v}`).join('; '); },
    van(nev) { return suti.has(nev); },
  };
}

export function hasznalhato(env) {
  return Boolean(env && String(env.SALONIC_PMU_JELSZO || '').trim()) && String(env.SALONIC_JELOLES || '') !== '0';
}

// -> { ok: boolean, mi: string }; soha nem dob
export async function salonicJeloles({ env = {}, kezdet, vendegId, most = new Date(), fetchFv = fetch } = {}) {
  const naplo = (uzenet) => { try { console.error('salonic-jeloles: ' + uzenet); } catch { /* nem baj */ } };
  try {
    if (!hasznalhato(env)) return { ok: false, mi: 'nincs_beallitva' };
    const ts = Number(kezdet);
    const nyers = most.getTime() / 1000;
    // csak mai-jovobeli, ertelmes idopont (a gomb a foglalas utan kozvetlenul jelenik meg)
    if (!Number.isFinite(ts) || ts < nyers - 3 * 3600 || ts > nyers + 400 * 86400) return { ok: false, mi: 'ervenytelen_idopont' };
    const g = String(vendegId == null ? '' : vendegId).replace(/^g:/i, '').trim();
    if (!/^\d{3,12}$/.test(g)) return { ok: false, mi: 'ervenytelen_vendeg' };
    // a cim CSAK a tesztekhez feluliarhato (loopback); eles kornyezetben mindig a valodi Salonic-admin
    const alap = /^http:\/\/(127\.0\.0\.1|localhost):\d+/.test(String(env.SALONIC_PMU_URL || '')) ? String(env.SALONIC_PMU_URL).replace(/\/+$/, '') : 'https://app.salonic.hu';
    const ugyfel = String(env.SALONIC_PMU_UGYFEL || 'mosaic-pmu').trim();
    const sut = sutiTar();

    // gyors kerelem-segedek: kezi atiranyitas-kovetes (a suti minden lepesben megy)
    async function kerel(ut, opciok = {}, korlat = 6) {
      let url = ut.startsWith('http') ? ut : alap + ut;
      let met = opciok.method || 'GET';
      let torzs = opciok.body;
      for (let i = 0; i <= korlat; i++) {
        const fejlec = { 'user-agent': 'Mozilla/5.0 (compatible; MosaicWeb/1.0)', cookie: sut.fejlec(), ...(opciok.fejlec || {}) };
        const v = await fetchFv(url, { method: met, headers: fejlec, body: torzs, redirect: 'manual', signal: AbortSignal.timeout(12000) });
        sut.be(v);
        if (v.status >= 300 && v.status < 400 && v.headers.get('location')) {
          url = new URL(v.headers.get('location'), url).href;
          met = 'GET'; torzs = undefined;
          continue;
        }
        return { status: v.status, url, text: await v.text() };
      }
      throw new Error('tul_sok_atiranyitas');
    }

    // 1) belepes
    const be = await kerel(`/backend/signin/?customer=${encodeURIComponent(ugyfel)}`, {
      method: 'POST', fejlec: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ 'LoginForm[customer]': ugyfel, 'LoginForm[password]': String(env.SALONIC_PMU_JELSZO).trim(), 'LoginForm[remember]': '0' }).toString(),
    });
    if (be.status !== 200 || /LoginForm\[password\]/.test(be.text) || /\/signin/.test(be.url)) { naplo('a belepes nem sikerult'); return { ok: false, mi: 'belepes' }; }

    // 2) az idopont megkeresese az online foglalasok kozott (a legfrissebb elol; a vendeg most foglalt, ezert az 1. oldalon van)
    const hely = budapesti(ts);
    const hoNev = HONAPOK[hely.ho - 1];
    const jeloltek = [];
    for (const oldal of ['', '?page=2']) {
      const l = await kerel('/onlineBookings/index' + oldal);
      if (l.status !== 200) break;
      for (const m of l.text.matchAll(/data-id="(\d+)"\s+data-bookingid="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
        const d = /fa-calendar"><\/i>\s*([a-záéíóöőúüű]+)\s+(\d{1,2})\.\s*\([^)]*\)\s*(\d{1,2}):(\d{2})/i.exec(m[3]);
        if (d && d[1].toLowerCase() === hoNev && +d[2] === hely.nap && +d[3] === hely.ora && +d[4] === hely.perc) jeloltek.push(m[1]);
      }
      if (jeloltek.length) break;
    }
    if (!jeloltek.length) { naplo('nincs ilyen idopont az online foglalasok kozott'); return { ok: false, mi: 'nincs_idopont' }; }
    if (jeloltek.length > 8) return { ok: false, mi: 'tul_sok_jelolt' };

    // 3) a szerkeszto urlap: a vendeg-azonosito es az idopont egyezese dont (nem a lista szovege)
    let talalt = null;
    for (const id of [...new Set(jeloltek)]) {
      const sz = await kerel(`/calendar/edit/${id}/`);
      if (sz.status !== 200) continue;
      const u = urlapOlvas(sz.text, 'appointmentManagementForm');
      if (!u) continue;
      const mz = u.mezok;
      const egyezik = mezoErtek(mz, 'Appointment[guestId]') === g
        && +mezoErtek(mz, 'Appointment[services][1][year]') === hely.ev && +mezoErtek(mz, 'Appointment[services][1][month]') === hely.ho
        && +mezoErtek(mz, 'Appointment[services][1][day]') === hely.nap && +mezoErtek(mz, 'Appointment[services][1][hour]') === hely.ora
        && +mezoErtek(mz, 'Appointment[services][1][minute]') === hely.perc
        && mezoErtek(mz, 'Appointment[services][2][id]') === undefined;   // csak egyetlen szolgaltatasos idopontot jelolunk
      if (egyezik) { if (talalt) { naplo('tobb egyezo idopont: nem irunk'); return { ok: false, mi: 'nem_egyertelmu' }; } talalt = { id, u, szoveg: sz.text }; }
    }
    if (!talalt) { naplo('nincs egyezo vendeg + idopont'); return { ok: false, mi: 'nincs_egyezes' }; }

    // 4) a belso megjegyzes kiegeszitese, ertesites nelkul
    const MEGJ = 'Appointment[services][1][appointmentCommentInternal]';
    const ERT = 'Appointment[notifyEdit]';
    const { u } = talalt;
    if (!u.mezok.some(([n]) => n === MEGJ)) { naplo('nincs belso megjegyzes mezo'); return { ok: false, mi: 'nincs_mezo' }; }
    const regi = String(mezoErtek(u.mezok, MEGJ) || '');
    if (regi.includes(JELOLES)) return { ok: true, mi: 'mar_jelolve' };
    if (!u.select[ERT] || !u.select[ERT].opciok.includes('0')) { naplo('nincs "nincs ertesites" opcio: nem irunk'); return { ok: false, mi: 'nincs_nem_ertesit' }; }
    const maiNap = budapesti(Math.floor(most.getTime() / 1000));
    const jel = `${JELOLES} (${maiNap.ev}. ${ketjegy(maiNap.ho)}. ${ketjegy(maiNap.nap)}. ${ketjegy(maiNap.ora)}:${ketjegy(maiNap.perc)})`;
    const uj = regi.trim() ? `${regi.replace(/\s+$/, '')}\n${jel}` : jel;
    if (uj.length > MAX_JELOLT_JELZES) return { ok: false, mi: 'tul_hosszu' };
    const torzs = new URLSearchParams();
    for (const [n, v] of u.mezok) torzs.append(n, n === MEGJ ? uj : n === ERT ? '0' : v);
    const akcio = u.akcio ? new URL(u.akcio, alap + '/').href : `${alap}/calendar/edit/${talalt.id}/`;
    if (new URL(akcio).origin !== new URL(alap).origin) return { ok: false, mi: 'idegen_akcio' };

    const mentes = await kerel(akcio, {
      method: 'POST', body: torzs.toString(),
      fejlec: { 'content-type': 'application/x-www-form-urlencoded', 'x-requested-with': 'XMLHttpRequest', referer: `${alap}/calendar/edit/${talalt.id}/` },
    });
    if (mentes.status >= 400) { naplo(`a mentes hibakodot adott (${mentes.status})`); return { ok: false, mi: 'mentes' }; }

    // 5) ellenorzes: tenyleg ott van-e a jelolés (a valasz formajatol fuggetlenul)
    const ell = await kerel(`/calendar/edit/${talalt.id}/`);
    const u2 = ell.status === 200 ? urlapOlvas(ell.text, 'appointmentManagementForm') : null;
    if (!u2 || !String(mezoErtek(u2.mezok, MEGJ) || '').includes(JELOLES)) { naplo('a mentes utan a jelolés nem latszik'); return { ok: false, mi: 'nem_mentodott' }; }
    return { ok: true, mi: 'jelolve' };
  } catch (e) {
    try { console.error('salonic-jeloles: hiba', e && e.message); } catch { /* nem baj */ }
    return { ok: false, mi: 'hiba' };
  }
}
