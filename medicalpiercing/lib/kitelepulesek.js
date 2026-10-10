// Kitelepulesek: a videki helyszinek idopontjai a "MP - KITELEPÜLÉSEK" tablazatbol
// (Google Drive, a lanyok toltik). Tiszta fuggvenyek: a build (tools/build.mjs), a
// Cloudflare-fuggveny (/api/kitelepulesek), a helyi kiszolgalo es a tesztek is ezt hasznaljak.
//
// A tablazat elso lapja ("Időpontok"): soronkent egy helyszin (Város, Piercer, Cím), utana
// honaponkent egy oszlop ("2026. október" vagy regebben csak "október"), a cellaban a napok
// vesszovel: "4,11,18". Az oldalon helyszinenkent az aktualis es a kovetkezo ket honap
// hatralevo napjai latszanak, pl. "Október 15,22" / "November 5,12,19,26".
//
// A cellakat hibaturoen olvassuk, mert a Google Tablazatok a "7,21"-et tizedes tortnek, a
// "2,9,30"-at datumnak veszi, ezert a lanyok neha betuvel irtak a szamot ("Négy,11,18",
// "6,húsz"). Ami igy sem ertelmezheto, az a hibak koze kerul (az /api/kitelepulesek mutatja).

export const TABLAZAT_ID = '1BgIiGJkvQga-VNlPuFQ7xneevogubfya';
// az elso munkalap CSV-ben, ugy, ahogy a cellakban latszik (a link alapjan barki olvashatja)
export const TABLAZAT_CSV = `https://docs.google.com/spreadsheets/d/${TABLAZAT_ID}/export?format=csv`;

const HONAPOK = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];
export const honapNev = (ho) => HONAPOK[ho - 1][0].toUpperCase() + HONAPOK[ho - 1].slice(1);

const ekezetNelkul = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// A helyszinek (a tablazat "Város" oszlopa es az oldal cimei ezek alapjan parosodnak).
export const VAROSOK = ['budapest', 'miskolc', 'nyiregyhaza', 'debrecen', 'sopron', 'zalaegerszeg', 'nagykanizsa',
  'keszthely', 'pecs', 'szeged', 'kecskemet', 'bekescsaba', 'kaposvar', 'szekesfehervar', 'szombathely', 'szolnok'];
// egy szovegben (cim, lapcim, varosnev) eloszor elofordulo helyszin; a tablazat cimeiben elgepeles is van ("Msikolc")
export function varosKulcs(szoveg) {
  const t = ekezetNelkul(szoveg).replace(/msikolc/g, 'miskolc');
  let legjobb = null, hely = Infinity;
  for (const v of VAROSOK) { const i = t.indexOf(v); if (i >= 0 && i < hely) { legjobb = v; hely = i; } }
  return legjobb;
}

// Budapesti naptari nap (a Cloudflare UTC-ben fut)
export function budapestiNap(d = new Date()) {
  const r = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Budapest', year: 'numeric', month: 'numeric', day: 'numeric' })
    .formatToParts(d).filter((x) => x.type !== 'literal').map((x) => [x.type, +x.value]));
  return { ev: r.year, ho: r.month, nap: r.day };
}
const napokSzama = (ev, ho) => new Date(Date.UTC(ev, ho, 0)).getUTCDate();

// egyszeru CSV-olvaso (idezojelek, vesszo es sortores az idezojelen belul)
export function csvSorok(csv) {
  const sorok = [];
  let sor = [], mezo = '', idezet = false;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (idezet) {
      if (c === '"') { if (csv[i + 1] === '"') { mezo += '"'; i++; } else idezet = false; } else mezo += c;
    } else if (c === '"') idezet = true;
    else if (c === ',') { sor.push(mezo); mezo = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && csv[i + 1] === '\n') i++; sor.push(mezo); sorok.push(sor); sor = []; mezo = ''; }
    else mezo += c;
  }
  if (mezo || sor.length) { sor.push(mezo); sorok.push(sor); }
  return sorok;
}

// betuvel irt szamok (a hosszabbak elol, hogy a "harmincegy" ne "harminc" + "egy" legyen)
const SZAVAK = [];
{
  const egyes = ['', 'egy', 'kettő', 'három', 'négy', 'öt', 'hat', 'hét', 'nyolc', 'kilenc'];
  for (let n = 1; n <= 31; n++) {
    const t = Math.floor(n / 10), e = n % 10;
    const alak = [];
    if (n < 10) alak.push(egyes[n]);
    else if (n === 10) alak.push('tíz');
    else if (n < 20) alak.push('tizen' + egyes[e]);
    else if (n === 20) alak.push('húsz');
    else if (n < 30) alak.push('huszon' + egyes[e]);
    else if (n === 30) alak.push('harminc');
    else alak.push('harminc' + egyes[e]);
    if (e === 2) alak.push(alak[0].replace(/kettő$/, 'két'));
    for (const a of alak) SZAVAK.push([ekezetNelkul(a), n]);
  }
  SZAVAK.sort((a, b) => b[0].length - a[0].length);
}

// Egy cella napjai. Visszaad: { napok: [..], hiba: null | 'leiras' }.
export function cellaNapjai(cella, ev, ho) {
  let t = ekezetNelkul(cella).trim();
  if (!t || /^[-–—x]+$/.test(t)) return { napok: [], hiba: null };
  const max = napokSzama(ev, ho);
  // honapnev-elotag ("Szept.3,10,17"), pontok, szokozok
  t = t.replace(/\b(jan|feb|marc|apr|maj|jun|jul|aug|szept?|okt|nov|dec)[a-z]*\.?/g, ',');
  for (const [szo, n] of SZAVAK) t = t.split(szo).join(`,${n},`);
  const darabok = t.split(/[^0-9]+/).filter(Boolean);
  const maradek = t.replace(/[0-9,.;\s/]+/g, '');
  const napok = new Set();
  const rossz = [];
  for (const d of darabok) {
    const n = parseInt(d, 10);
    if (n >= 1 && n <= max) napok.add(n); else rossz.push(d);
  }
  const hiba = rossz.length || maradek ? `nem ertelmezheto resz: "${String(cella).trim()}"` : null;
  return { napok: [...napok].sort((a, b) => a - b), hiba };
}

// A fejlec honapjai: "2026. október" -> {ev:2026, ho:10}; regi fejlec ("október") eseten az evet
// a sorrendbol szamoljuk: az oszlopok egymast koveto honapok, es az aktualis honap legutolso
// elofordulasa a mai ev.
export function fejlecHonapjai(fejlec, ma) {
  const oszlopok = [];
  fejlec.forEach((f, i) => {
    const t = ekezetNelkul(f);
    const ho = HONAPOK.findIndex((h) => t.includes(ekezetNelkul(h))) + 1;
    if (!ho) return;
    const ev = (t.match(/\b(20\d\d)\b/) || [])[1];
    oszlopok.push({ i, ho, ev: ev ? +ev : null });
  });
  if (oszlopok.length && oszlopok.some((o) => o.ev === null)) {
    // folyamatos sorszam (honapok a sorrend szerint), majd horgony a mai honap utolso elofordulasa
    let sorszam = 0;
    oszlopok.forEach((o, k) => { if (k) { let d = o.ho - oszlopok[k - 1].ho; if (d <= 0) d += 12; sorszam += d; } o.sorszam = sorszam; });
    const horgony = [...oszlopok].reverse().find((o) => o.ho === ma.ho) || oszlopok[oszlopok.length - 1];
    const horgonyEv = horgony.ho === ma.ho ? ma.ev : (oszlopok.find((o) => o.ev) || { ev: ma.ev }).ev;
    for (const o of oszlopok) if (o.ev === null) {
      const elteres = o.sorszam - horgony.sorszam;
      const abszolut = horgonyEv * 12 + (horgony.ho - 1) + elteres;
      o.ev = Math.floor(abszolut / 12);
    }
  }
  return oszlopok.map(({ i, ho, ev }) => ({ i, ho, ev }));
}

// A teljes tablazat: { helyszinek: { kulcs: { nev, napok: { 'YYYY-MM': [..] } } }, hibak: [..] }
export function tablazatbol(csv, ma = budapestiNap()) {
  const sorok = csvSorok(csv);
  const fi = sorok.findIndex((s) => s.some((c) => ekezetNelkul(c).trim() === 'varos'));
  if (fi < 0) throw new Error('a tablazat elso soraban nincs "Város" oszlop');
  const fejlec = sorok[fi];
  const vi = fejlec.findIndex((c) => ekezetNelkul(c).trim() === 'varos');
  const oszlopok = fejlecHonapjai(fejlec, ma);
  const helyszinek = {}, hibak = [];
  for (const sor of sorok.slice(fi + 1)) {
    const nev = (sor[vi] || '').trim();
    const kulcs = varosKulcs(nev);
    if (!nev) continue;
    if (!kulcs) { hibak.push(`ismeretlen helyszin a tablazatban: "${nev}"`); continue; }
    const h = helyszinek[kulcs] || (helyszinek[kulcs] = { nev, napok: {} });
    for (const o of oszlopok) {
      const { napok, hiba } = cellaNapjai(sor[o.i], o.ev, o.ho);
      const k = `${o.ev}-${String(o.ho).padStart(2, '0')}`;
      // csak a mai honaptol kezdve szamit (a regi oszlopokban szamok helyett "11 nap" stb. is van)
      const jovo = o.ev * 12 + o.ho >= ma.ev * 12 + ma.ho;
      if (hiba && jovo) hibak.push(`${nev}, ${o.ev}. ${HONAPOK[o.ho - 1]}: ${hiba}`);
      // a nem egyertelmu cellabol semmi nem kerul ki (inkabb hianyozzon, mint hogy rossz nap latsszon)
      if (napok.length && !hiba) h.napok[k] = napok;
    }
  }
  return { helyszinek, hibak };
}

// Az oldalon megjeleno sorok egy helyszinre: a mai naptol a kovetkezo `db` honap napjai
// (az aktualis honapbol csak a hatralevok), az ures honapok nelkul.
export function honapSorok(helyszin, ma = budapestiNap(), db = 3) {
  const sorok = [];
  for (let k = 0; k < db; k++) {
    const abs = ma.ev * 12 + (ma.ho - 1) + k;
    const ev = Math.floor(abs / 12), ho = (abs % 12) + 1;
    let napok = (helyszin.napok[`${ev}-${String(ho).padStart(2, '0')}`] || []);
    if (k === 0) napok = napok.filter((n) => n >= ma.nap);
    if (napok.length) sorok.push(`${honapNev(ho)} ${napok.join(',')}`);
  }
  return sorok;
}

// Minden helyszin sorai (ezt adja az /api/kitelepulesek es ezt irja a build a lapokba)
export function osszesSor(csv, ma = budapestiNap()) {
  const { helyszinek, hibak } = tablazatbol(csv, ma);
  const sorok = {};
  for (const [k, h] of Object.entries(helyszinek)) { const s = honapSorok(h, ma); sorok[k] = s.length ? s : [NINCS_IDOPONT]; }
  return { sorok, hibak, nap: `${ma.ev}-${String(ma.ho).padStart(2, '0')}-${String(ma.nap).padStart(2, '0')}` };
}

// --- a lapokon: a datumblokkok cserje ---------------------------------------------
// Egy datumblokk a Wix-szovegdoboz legbelso <span>-je, amiben csak "Honap napok" sorok
// vannak <br>-rel elvalasztva (pl. "Október 2,9,30<br>November 6,13,20,27").
export const HONAP_SOR = new RegExp(`^\\s*(${HONAPOK.map((h) => h[0].toUpperCase() + h.slice(1)).join('|')})\\s+\\d{1,2}(\\s*,\\s*\\d{1,2})*\\s*,?\\s*$`);
export const datumBlokk = (szoveg) => {
  const sorok = szoveg.split(/\n|<br\s*\/?>/i).map((s) => s.trim()).filter(Boolean);
  return sorok.length > 0 && sorok.every((s) => HONAP_SOR.test(s));
};
// Ha a helyszin a tablazatban van, de a kovetkezo honapokra nincs idopont
export const NINCS_IDOPONT = 'Új időpontok hamarosan';

// Build-kozbeni csere a HTML-ben (a blokk data-mp-kitelepules="<helyszin>" jelolest is kap). A helyszint a varosoldalakon (/varosok/...) a lap cime
// (<title>, pl. "4031 Debrecen, Derék utca 100/B"), mashol a blokkot tartalmazo ismetlo-elem
// (role="listitem") elejen allo cim adja. (A Wix-cimek /varosok/... resze nem megbizhato:
// a /varosok/8800-nagykanizsa-fo-ut-23 ma a szekesfehervari helyszin.)
export function htmlFrissites(html, sorok, ut = '') {
  const varosLap = /^\/varosok\//.test(ut);
  const lapVaros = varosKulcs((html.match(/<title>([^<]*)/) || [])[1] || '');
  let db = 0;
  const kesz = html.replace(/(<span\b[^>]*>)((?:[^<]|<br\s*\/?>)*)(<\/span>)/g, (egesz, nyit, belso, zar, hely) => {
    if (!datumBlokk(belso)) return egesz;
    let kulcs = null;
    if (varosLap) kulcs = lapVaros;
    else {
      // a listaelem eleje es a blokk kozotti szoveg (egy elem kb. 4 kB)
      const elem = html.lastIndexOf('role="listitem"', hely);
      if (elem >= 0 && hely - elem < 20000) kulcs = varosKulcs(html.slice(elem, hely).replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' '));
    }
    if (!kulcs) return egesz;
    // a jeloles alapjan frissiti a lap betolteskor a klon.js (10.) az /api/kitelepulesek-bol
    db++;
    const jelolt = nyit.replace(/^<span\b/, `<span data-mp-kitelepules="${kulcs}"`);
    return jelolt + (sorok[kulcs] ? sorok[kulcs].join('<br>') : belso) + zar;
  });
  return { html: kesz, db };
}
