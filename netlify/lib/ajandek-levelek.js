// MOSAIC Gift Commerce Engine - a levelek es a szerver altal adott HTML-oldalak szovege.
// Kozos a Netlify- (netlify/functions/ajandek.mjs) es a Cloudflare-fuggvenynek
// (functions/api/ajandek/[[kind]].js); a kezelo: netlify/lib/ajandek.js.
//
// Minden fuggveny kesz, mar feloldott adatot kap (a kezelo szamolja), es MINDEN dinamikus
// szoveget itt escape-elunk. A levelek stilusa a netlify/lib/levelek.js-e (betu, sorok).
// A teljesitesi idore SOHA ne igerjunk konkretumot ("perceken belul", "azonnal"): a kartyat
// a szalon allitja ki, a teljesitesi ido nincs garantalva.

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const betu = 'font:15px/1.6 Arial,Helvetica,sans-serif;color:#222';
const PETROL = '#244A4D';
const PETROL_SOT = '#0f3a3c';
const ARANY = '#B8A278';
const IVORY = '#F7F2E9';
const HONAPOK = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];

// '2027-04-03' -> '2027. április 3.'
export function datumHu(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ymd || ''));
  return m ? `${m[1]}. ${HONAPOK[Number(m[2]) - 1]} ${Number(m[3])}.` : '';
}

// '2027-04-03' -> '2027. április 3-ig' (a nap utan nincs pont, ha rag kovetkezik)
export function datumIg(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ymd || ''));
  return m ? `${m[1]}. ${HONAPOK[Number(m[2]) - 1]} ${Number(m[3])}-ig` : '';
}

// ISO idopont -> '2026. október 3. 14:05' (budapesti ido)
export function idopontHu(iso) {
  if (!iso) return '';
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Budapest', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
    return `${datumHu(`${p.year}-${p.month}-${p.day}`)} ${p.hour}:${p.minute}`;
  } catch {
    return String(iso);
  }
}

const FIZETESI_MODOK = { card: 'bankkártya', apple_pay: 'Apple Pay', google_pay: 'Google Pay', link: 'Link', samsung_pay: 'Samsung Pay' };
export const fizetesiModSzoveg = (m) => (m ? FIZETESI_MODOK[m] || m : '');

// --- levelek: kozos elemek ------------------------------------------------------------------------
const cim = (s) => `<p style="margin:28px 0 8px;font-weight:bold;letter-spacing:.5px;color:${PETROL}">${s}</p>`;
const gomb = (href, felirat) => `<p style="margin:22px 0"><a href="${esc(href)}" style="display:inline-block;background:${PETROL};color:#fff;padding:12px 22px;border-radius:4px;text-decoration:none;font-weight:bold">${esc(felirat)}</a></p>`;
// [cimke, ertek] parok tablazata; az ures ertekek kimaradnak; az ertek escape-elve
const tabla = (sorok) => `<table role="presentation" style="border-collapse:collapse;margin:8px 0 4px">${sorok
  .filter(([, v]) => v !== undefined && v !== null && v !== '')
  .map(([k, v]) => `<tr><td style="padding:3px 16px 3px 0;color:#666;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:3px 0;vertical-align:top">${esc(v)}</td></tr>`)
  .join('')}</table>`;
const kodDoboz = (kod, ervenyesIg) => `<div style="margin:14px 0;padding:14px 18px;background:${IVORY};border:1px solid ${ARANY};display:inline-block">
<div style="font-size:12px;letter-spacing:2px;color:${PETROL};text-transform:uppercase">Kuponkód</div>
<div style="font:bold 24px/1.3 'Courier New',Courier,monospace;letter-spacing:2px;color:${PETROL_SOT}">${esc(kod)}</div>
${ervenyesIg ? `<div style="font-size:13px;color:#555">Érvényes: ${esc(datumIg(ervenyesIg))} (6 hónapig felhasználható)</div>` : ''}
</div>`;
const lablec = (szalon) => `<p style="margin-top:28px;font-size:13px;color:#555"><b>${esc(szalon.nev)}</b><br>
${esc(szalon.cim)}<br>
<b>${esc(szalon.telefon)}</b><br>
<a href="https://www.mosaicheadspa.hu/idpontfoglalas"><b>Időpont foglalás</b></a></p>`;
const szamlazasiCim = (d) => [d.iranyitoszam, d.varos].filter(Boolean).join(' ') + (d.cim ? ', ' + d.cim : '');

// --- fizetes utan: a szalon levele -----------------------------------------------------------------
// d: { rendeles_id, pi, termek_nev, osszeg_szoveg, fizetesi_mod, fizetve_ekkor, email, nev, iranyitoszam,
//      varos, cim, ceges_nev, ceges_adoszam, kod, ervenyes_ig, kiallit_url, azonnali, attr }
export function szalonFizetveLevel(d) {
  const attr = d.attr || {};
  const forras = [attr.utm_source, attr.utm_medium, attr.utm_campaign].filter(Boolean).join(' / ');
  const teendo = d.azonnali
    ? `<p><b>Figyelem:</b> az automatikus kártyakiállítás be van kapcsolva, ezért a vevő a kártyát a fenti kóddal <b>már megkapta</b>. Kérlek, mielőbb hozd létre a kuponkódot a Salonicban, hogy a foglalásnál beváltható legyen.</p>`
    : `<p>Ha a kupon elkészült, kattints az alábbi gombra, és a megnyíló oldalon erősítsd meg – ekkor a vevő e-mailben megkapja a nyomtatható ajándékkártyát a kóddal:</p>
${gomb(d.kiallit_url, 'Kiállítottam – értesítem a vevőt')}
<p style="font-size:13px;color:#555">Ha a gomb nem működik, ezt a címet nyisd meg: <a href="${esc(d.kiallit_url)}">${esc(d.kiallit_url)}</a></p>`;
  return {
    targy: `Új ajándékkártya-rendelés (fizetve) – ${d.rendeles_id}`,
    html: `<div style="${betu};max-width:640px">
<p><b>Új ajándékkártya-rendelés érkezett, a fizetés sikeres.</b></p>
${tabla([
  ['Rendelés', d.rendeles_id], ['Termék', d.termek_nev], ['Összeg', d.osszeg_szoveg],
  ['Fizetés módja', fizetesiModSzoveg(d.fizetesi_mod)], ['Fizetve', idopontHu(d.fizetve_ekkor)],
])}
${cim('A VEVŐ (SZÁMLÁZÁSI ADATOK)')}
${tabla([
  ['Név', d.nev], ['E-mail', d.email], ['Cím', szamlazasiCim(d)],
  ['Cégnév', d.ceges_nev], ['Adószám', d.ceges_adoszam],
])}
${cim('TEENDŐ: KUPONKÓD A SALONICBAN')}
${kodDoboz(d.kod, d.ervenyes_ig)}
<p>A Salonicban hozd létre a kuponkódot: <b>${esc(d.kod)}</b> – 100% kedvezmény, a(z) <b>${esc(d.termek_nev)}</b> szolgáltatásra, egyszer felhasználható, érvényes ${esc(datumIg(d.ervenyes_ig))} (6 hónap).</p>
${teendo}
<p style="font-size:13px;color:#555">Ha a vevő fizikai kártyát kér, vagy a szalonban venné át, arról külön levelet kapsz.</p>
<p style="color:#888;font-size:12px">Stripe: ${esc(d.pi)}${attr.variant_id ? ` · változat: ${esc(attr.variant_id)}` : ''}${forras ? ` · forrás: ${esc(forras)}` : ''}</p>
</div>`,
  };
}

// --- fizetes utan: a vevo levele -------------------------------------------------------------------
// d: { rendeles_id, termek_nev, kartya_cim, osszeg_szoveg, nev, rendeles_url, kartya_url?, kod?, ervenyes_ig?, szalon }
export function vevoFizetveLevel(d) {
  const kesz = Boolean(d.kartya_url);
  return {
    targy: `Megkaptuk a fizetésed – MOSAIC ajándékkártya (${d.rendeles_id})`,
    html: `<div style="${betu};max-width:600px">
<p>Kedves ${esc(d.nev)}!</p>
<p>Köszönjük a vásárlást! Megkaptuk a fizetésed a(z) „${esc(d.kartya_cim || d.termek_nev)}” ajándékkártyára.</p>
${tabla([['Rendelésazonosító', d.rendeles_id], ['Termék', d.termek_nev], ['Összeg', d.osszeg_szoveg]])}
${kesz
    ? `${cim('ELKÉSZÜLT AZ AJÁNDÉKKÁRTYÁD')}
${kodDoboz(d.kod, d.ervenyes_ig)}
<p>A nyomtatható ajándékkártyát itt nyithatod meg, kinyomtathatod vagy elmentheted PDF-ként:</p>
${gomb(d.kartya_url, 'Ajándékkártya megnyitása')}`
    : `${cim('MI TÖRTÉNIK MOST?')}
<p>Az ajándékkártyád elkészítésén dolgozunk; amint kész, e-mailben küldjük a nyomtatható kártyát a kuponkóddal.</p>
<p>A rendelésed állapotát itt is megnézheted, és ha szeretnéd, személyre szabhatod a kártyát (név, üzenet, alkalom):</p>
${gomb(d.rendeles_url, 'A rendelésem')}`}
${cim('ÍGY LEHET FELHASZNÁLNI')}
<p>Az ajándékkártyán lévő kódot az online időpontfoglalásnál (<a href="https://www.mosaicheadspa.hu/idpontfoglalas">mosaicheadspa.hu/idpontfoglalas</a>) a „kuponkód” mezőbe kell beírni. A kártya a vásárlástól számítva 6 hónapig használható fel.</p>
<p>Ha kérdésed van, csak válaszolj erre a levélre! :)</p>
${lablec(d.szalon)}
</div>`,
  };
}

// --- a szalon kiallitotta: a vevo levele a kartya linkjevel ------------------------------------------
// d: { rendeles_id, kartya_cim, nev, kartya_url, kod, ervenyes_ig, szalon }
export function vevoKartyaKeszLevel(d) {
  return {
    targy: `Elkészült az ajándékkártyád – MOSAIC Head Spa (${d.rendeles_id})`,
    html: `<div style="${betu};max-width:600px">
<p>Kedves ${esc(d.nev)}!</p>
<p>Elkészült a(z) „${esc(d.kartya_cim)}” ajándékkártyád.</p>
${kodDoboz(d.kod, d.ervenyes_ig)}
<p>A nyomtatható ajándékkártyát itt nyithatod meg – kinyomtathatod, vagy a nyomtatási ablakban PDF-ként mentve e-mailben is továbbküldheted:</p>
${gomb(d.kartya_url, 'Ajándékkártya megnyitása')}
<p style="font-size:13px;color:#555">Ha a gomb nem működik, ezt a címet nyisd meg: <a href="${esc(d.kartya_url)}">${esc(d.kartya_url)}</a></p>
${cim('ÍGY LEHET FELHASZNÁLNI')}
<p>Az online időpontfoglalásnál (<a href="https://www.mosaicheadspa.hu/idpontfoglalas">mosaicheadspa.hu/idpontfoglalas</a>) a „kuponkód” mezőbe kell beírni a kódot.</p>
<p>Ha kérdésed van, csak válaszolj erre a levélre! :)</p>
<p style="font-size:12px;color:#888">Rendelésazonosító: ${esc(d.rendeles_id)}</p>
${lablec(d.szalon)}
</div>`,
  };
}

// --- szemelyre szabas: fizikai kartyat kertek (a szalon levele) -------------------------------------
// d: { rendeles_id, pi, termek_nev, kod, ervenyes_ig, email, vevo_nev, nev, uzenet, alkalom_cim, atadas_cim, modositas }
export function szalonFizikaiLevel(d) {
  return {
    targy: `${d.modositas ? 'Módosult: fizikai' : 'Fizikai'} ajándékkártyát kértek – ${d.rendeles_id}`,
    html: `<div style="${betu};max-width:640px">
<p><b>${d.modositas ? 'A vevő módosította a fizikai ajándékkártya adatait.' : 'A vevő fizikai ajándékkártyát kér, illetve a MOSAIC-ban venné át.'}</b></p>
${tabla([
  ['Rendelés', d.rendeles_id], ['Termék', d.termek_nev], ['Kuponkód', d.kod],
  ['Érvényes', d.ervenyes_ig ? datumIg(d.ervenyes_ig) : ''],
  ['Vevő', d.vevo_nev], ['Vevő e-mail', d.email], ['Átadás', d.atadas_cim],
])}
${cim('A KÁRTYÁRA')}
${tabla([['Megajándékozott', d.nev], ['Alkalom', d.alkalom_cim]])}
${d.uzenet ? `<p style="white-space:pre-line;border-left:3px solid ${ARANY};padding:4px 12px;margin:8px 0">${esc(d.uzenet)}</p>` : ''}
<p style="color:#888;font-size:12px">Stripe: ${esc(d.pi)}</p>
</div>`,
  };
}

// --- atutalasos igeny (nem vasarlas) ------------------------------------------------------------------
// d: { rendeles_ref, termek_nev, kartya_cim, osszeg_szoveg, kedvezmenyezett, szamlaszam, kozlemeny, nev, szalon }
export function vevoAtutalasLevel(d) {
  return {
    targy: `MOSAIC ajándékkártya – utalási adatok (${d.rendeles_ref})`,
    html: `<div style="${betu};max-width:600px">
<p>Kedves ${esc(d.nev)}!</p>
<p>Köszönjük, hogy a(z) „${esc(d.kartya_cim || d.termek_nev)}” ajándékkártyát választottad! :)</p>
<p>A vásárlás véglegesítéséhez a banki utalást ide várjuk:</p>
${cim('BANKI UTALÁSI ADATOK')}
${tabla([
  ['Kedvezményezett', d.kedvezmenyezett], ['Számlaszám', d.szamlaszam],
  ['Összeg', d.osszeg_szoveg], ['Közlemény', d.kozlemeny],
])}
${cim('IDE KÜLDD A BIZONYLATOT')}
<p>Kérlek, hogy amint teljesítetted az utalást, az alábbi e-mail-címre küldd meg számunkra az utalási bizonylatot (vagy egyszerűen válaszolj erre a levélre):</p>
<p><a href="mailto:${esc(d.szalon.email)}">${esc(d.szalon.email)}</a></p>
${cim('NYOMTATHATÓ FORMÁTUMBAN ELKÜLDJÜK AZ E-MAIL-CÍMEDRE')}
<p>Az utalás beérkezése után az ajándékkártyát elküldjük az e-mail-címedre digitális formátumban is, amit könnyen ki tudsz nyomtatni akár otthon is, és már mehet is a borítékba :)</p>
${cim('SZEMÉLYESEN IS ÁTVEHETED SZALONUNKBAN')}
<p>Ha nincs nyomtatód, vagy papír alapon szeretnéd átvenni, azt pedig megteheted nálunk, a MOSAIC Head Spa-ban (${esc(d.szalon.cim)}). Csak mondd be a közleményben szereplő azonosítót, és a recepción odaadjuk neked a kártyát.</p>
${cim('ÍGY TUDOD FELHASZNÁLNI')}
<p>Az ajándékkártyán találsz egy kódot, amit az online foglalásnál tudsz majd érvényesíteni a „kuponkód” mezőbe történő beírással.</p>
<p>Ha kérdésed van, csak írj nekünk! :)</p>
${lablec(d.szalon)}
</div>`,
  };
}

// d: { rendeles_ref, termek_nev, osszeg_szoveg, kozlemeny, email, nev, iranyitoszam, varos, cim, ceges_nev, ceges_adoszam, megajandekozott, oldal }
export function szalonAtutalasLevel(d) {
  return {
    targy: `Új ajándékkártya-igény (átutalás, még nincs kifizetve) – ${d.rendeles_ref}`,
    html: `<div style="${betu};max-width:640px">
<p><b>Új ajándékkártya-igény érkezett átutalással. Ez még NEM vásárlás: a kártyát csak az utalás beérkezése után kell kiállítani.</b></p>
${tabla([
  ['Azonosító', d.rendeles_ref], ['Termék', d.termek_nev], ['Összeg', d.osszeg_szoveg], ['Várt közlemény', d.kozlemeny],
  ['Megajándékozott', d.megajandekozott],
])}
${cim('A VEVŐ (SZÁMLÁZÁSI ADATOK)')}
${tabla([
  ['Név', d.nev], ['E-mail', d.email], ['Cím', szamlazasiCim(d)],
  ['Cégnév', d.ceges_nev], ['Adószám', d.ceges_adoszam],
])}
<p>A vevő megkapta az utalási adatokat. Ha az utalás beérkezett, a megszokott módon hozd létre a kuponkódot a Salonicban, és küldd el neki az ajándékkártyát.</p>
${d.oldal ? `<p style="color:#888;font-size:12px">Beküldve innen: ${esc(d.oldal)}</p>` : ''}
</div>`,
  };
}

// --- HTML-oldalak --------------------------------------------------------------------------------------
// A nyomtatogomb szkriptje: a kezelo ennek a hash-et teszi a Content-Security-Policy-ba.
export const NYOMTAT_JS = "document.getElementById('nyomtat').addEventListener('click',function(){window.print()});";

const OLDAL_CSS = `*{box-sizing:border-box}html,body{margin:0}
.logo-sav{display:block;box-sizing:content-box;background:#183033;padding:10px 22px;border-radius:10px;margin:0 0 18px}
body{background:#ece6da;color:#2b2b2b;font:16px/1.6 "Helvetica Neue",Arial,Helvetica,sans-serif;padding:8vh 18px 40px;text-align:center}
.doboz{max-width:560px;margin:0 auto;background:${IVORY};border:1px solid ${PETROL};padding:34px 26px;position:relative}
.doboz::before{content:"";position:absolute;inset:6px;border:1px solid ${ARANY};pointer-events:none}
h1{font:400 26px/1.3 "Playfair Display",Georgia,"Times New Roman",serif;color:${PETROL_SOT};margin:18px 0 12px}
p{margin:0 0 12px}a{color:${PETROL}}
table{margin:14px auto 0!important;text-align:left;font-size:14px}
form{margin:22px 0 4px}
button{font:600 16px/1.35 "Helvetica Neue",Arial,sans-serif;background:${PETROL};color:#fff;border:0;border-radius:4px;padding:14px 22px;cursor:pointer;max-width:100%}
button:hover{background:${PETROL_SOT}}`;

// Egyszeru, barati oldal (allapot, hiba, a szalon visszaigazolasa / megerosito urlapja)
// d: { cim, bekezdesek: [szoveg], reszletek?: [[cimke, ertek]], frissit?: masodperc, bazis,
//      urlap?: { action, rejtett: { nev: ertek }, gomb } }  (az urlap POST-tal kuld)
export function egyszeruOldal(d) {
  return `<!doctype html>
<html lang="hu"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
${d.frissit ? `<meta http-equiv="refresh" content="${Number(d.frissit) | 0}">` : ''}
<title>${esc(d.cim)} | MOSAIC Head Spa</title>
<style>${OLDAL_CSS}</style></head>
<body><main class="doboz">
<img class="logo-sav" src="${esc(d.bazis)}/assets/img/logo-143x54@2x.png" width="143" height="54" alt="MOSAIC Head Spa">
<h1>${esc(d.cim)}</h1>
${(d.bekezdesek || []).map((b) => `<p>${esc(b)}</p>`).join('\n')}
${d.reszletek && d.reszletek.length ? tabla(d.reszletek) : ''}
${d.urlap ? `<form method="post" action="${esc(d.urlap.action)}">
${Object.entries(d.urlap.rejtett || {}).map(([n, v]) => `<input type="hidden" name="${esc(n)}" value="${esc(v)}">`).join('\n')}
<button type="submit">${esc(d.urlap.gomb)}</button>
</form>` : ''}
</main></body></html>`;
}

// A nyomtathato ajandekkartya (onallo oldal; A4 lapon egy A5-arany fekvo kartya)
// d: { bazis, kod, kartya_cim, tartalom: [..], nev, uzenet, alkalom_cim, ervenyes_ig, szalon }
export function kartyaOldal(d) {
  const tartalom = (d.tartalom || []).filter((t) => !/hónapig/.test(t));
  return `<!doctype html>
<html lang="hu"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<title>MOSAIC Head Spa ajándékkártya – ${esc(d.kod)}</title>
<style>
@page{size:A4 portrait;margin:12mm}
*{box-sizing:border-box}
html,body{margin:0}
body{background:#e9e3d7;color:#2b2b2b;font:15px/1.55 "Helvetica Neue",Arial,Helvetica,sans-serif;padding:28px 14px 40px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.lap{max-width:186mm;margin:0 auto}
.kartya{position:relative;background:${IVORY};border:1.5px solid ${PETROL};padding:11mm 12mm 8mm;min-height:131.5mm;display:flex;flex-direction:column;align-items:center;text-align:center;box-shadow:0 10px 30px rgba(15,58,60,.15)}
.kartya::before{content:"";position:absolute;inset:3.2mm;border:1px solid ${ARANY};pointer-events:none}
.logo{display:block;box-sizing:content-box;width:143px;height:auto;margin:0 auto 4mm;background:#183033;padding:10px 24px;border-radius:10px}
.eyebrow{margin:0;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${PETROL}}
h1{font:400 27px/1.25 "Playfair Display",Georgia,"Times New Roman",serif;color:${PETROL_SOT};margin:3mm 0 1.5mm}
.tartalom{margin:0;font-size:13px;color:#5b5b5b}
.vonal{width:60mm;height:1px;background:${ARANY};margin:4.5mm auto}
.neki{margin:0 0 2mm;font:italic 21px/1.3 "Playfair Display",Georgia,"Times New Roman",serif;color:${PETROL_SOT}}
.neki .cimke{display:block;font:11px/1.6 "Helvetica Neue",Arial,sans-serif;font-style:normal;letter-spacing:3px;text-transform:uppercase;color:${PETROL}}
.uzenet{margin:0 auto 2mm;max-width:140mm;font:italic 15px/1.5 Georgia,"Times New Roman",serif;color:#3a3a3a;white-space:pre-line;overflow-wrap:anywhere}
.alkalom{margin:0 0 2mm;font-size:13px;color:#5b5b5b}
.kod-doboz{margin:3mm auto 2mm;padding:3mm 8mm;border:1px solid ${ARANY};background:#fffdf8}
.kod-cimke{display:block;font-size:10.5px;letter-spacing:3px;text-transform:uppercase;color:${PETROL}}
.kod{display:block;font:700 28px/1.25 "Courier New",Courier,monospace;letter-spacing:3px;color:${PETROL_SOT}}
.ervenyes{margin:0 0 3mm;font-size:13.5px;color:#2b2b2b}
.bevaltas{margin:auto 0 2mm;font-size:12.5px;color:#4a4a4a;max-width:150mm}
.bevaltas a{color:${PETROL};text-decoration:none;font-weight:bold}
.lab{margin:0;font-size:11.5px;letter-spacing:.3px;color:${PETROL}}
.gombsor{text-align:center;margin:22px 0 0}
#nyomtat{font:600 16px/1 "Helvetica Neue",Arial,sans-serif;background:${PETROL};color:#fff;border:0;border-radius:4px;padding:14px 26px;cursor:pointer}
#nyomtat:hover{background:${PETROL_SOT}}
.tipp{font-size:13px;color:#555;margin:12px auto 0;max-width:150mm}
@media (max-width:560px){h1{font-size:22px}.kod{font-size:22px;letter-spacing:2px}.kartya{padding:9mm 7mm 7mm}}
@media print{body{background:#fff;padding:0}.kartya{box-shadow:none;width:186mm;min-height:131.5mm;break-inside:avoid}.nem-nyomtat{display:none!important}}
</style></head>
<body><main class="lap">
<section class="kartya" aria-label="Ajándékkártya">
<img class="logo" src="${esc(d.bazis)}/assets/img/logo-143x54@2x.png" width="143" alt="MOSAIC Head Spa">
<p class="eyebrow">MOSAIC Head Spa ajándékkártya</p>
<h1>${esc(d.kartya_cim)}</h1>
${tartalom.length ? `<p class="tartalom">${tartalom.map(esc).join(' · ')}</p>` : ''}
<div class="vonal"></div>
${d.nev ? `<p class="neki"><span class="cimke">Neki</span>${esc(d.nev)}</p>` : ''}
${d.uzenet ? `<p class="uzenet">${esc(d.uzenet)}</p>` : ''}
${d.alkalom_cim ? `<p class="alkalom">Alkalom: ${esc(d.alkalom_cim)}</p>` : ''}
<div class="kod-doboz"><span class="kod-cimke">Kuponkód</span><span class="kod">${esc(d.kod)}</span></div>
<p class="ervenyes">Érvényes: <strong>${esc(datumIg(d.ervenyes_ig))}</strong> · 6 hónapig felhasználható</p>
<p class="bevaltas">Beváltás: az online időpontfoglalásnál (<a href="https://www.mosaicheadspa.hu/idpontfoglalas">https://www.mosaicheadspa.hu/idpontfoglalas</a>) a kuponkód mezőbe írhatod be a kódot.</p>
<p class="lab">${esc(d.szalon.nev)} · ${esc(d.szalon.cim)} · ${esc(d.szalon.telefon)} · www.mosaicheadspa.hu</p>
</section>
<div class="gombsor nem-nyomtat">
<button type="button" id="nyomtat">Nyomtatás / Mentés PDF-ként</button>
<p class="tipp">Tipp: a nyomtatási ablakban a „Mentés PDF-ként” célt választva PDF-et kapsz, amit e-mailben is továbbküldhetsz.</p>
</div>
</main>
<script>${NYOMTAT_JS}</script>
</body></html>`;
}
