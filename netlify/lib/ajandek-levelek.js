// MOSAIC Gift Commerce Engine - a levelek es a szerver altal adott HTML-oldalak szovege.
// Kozos a Netlify- (netlify/functions/ajandek.mjs) es a Cloudflare-fuggvenynek
// (functions/api/ajandek/[[kind]].js); a kezelo: netlify/lib/ajandek.js.
//
// Minden fuggveny kesz, mar feloldott adatot kap (a kezelo szamolja), es MINDEN dinamikus
// szoveget itt escape-elunk. A levelek stilusa a netlify/lib/levelek.js-e (betu, sorok).
// A teljesitesi idore SOHA ne igerjunk konkretumot ("perceken belul", "azonnal"): a kartyat
// a szalon allitja ki, a teljesitesi ido nincs garantalva.

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

import '../../assets/js/ajandek-kartya.js';
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
//      varos, cim, ceges_nev, ceges_adoszam, kod, ervenyes_ig, kiallit_url, azonnali, attr,
//      atvetel_szoveg?, design_szoveg?, idezet_szoveg?, foto_van?, elonezet_url? }
export function szalonFizetveLevel(d) {
  const attr = d.attr || {};
  const forras = [attr.utm_source, attr.utm_medium, attr.utm_campaign].filter(Boolean).join(' / ');
  const teendo = d.azonnali
    ? `<p><b>Figyelem:</b> az automatikus kártyakiállítás be van kapcsolva, ezért a vevő a kártyát a fenti kóddal <b>már megkapta</b>. Kérlek, mielőbb hozd létre a kupont a Salonicban, hogy a foglalásnál beváltható legyen.</p>`
    : `<p>Ha a kupon elkészült, kattints az alábbi gombra, add meg a kupon kódját (alapból a javasolt kód van beírva), és a vevő e-mailben megkapja a nyomtatható ajándékkártyát:</p>
${gomb(d.kiallit_url, 'Kiállítom a kártyát')}
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
${d.atvetel_szoveg ? `${cim('ÁTVÉTEL ÉS SZEMÉLYRE SZABÁS')}${tabla([['Átvétel', d.atvetel_szoveg], ['Kártya-design', d.design_szoveg], ['Idézet', d.idezet_szoveg], ['Saját fotó', d.design_szoveg ? (d.foto_van ? 'van' : 'nincs') : '']])}${d.elonezet_url ? `<p>A vevő személyre szabott kártyájának előnézete (design, fotó, idézet): <a href="${esc(d.elonezet_url)}">megnyitás új lapon</a></p>` : ''}` : ''}
${cim('TEENDŐ: 100%-OS KUPON A SALONICBAN')}
<p>A számlát a szamlabridge már elkészítette, ezért a Salonicban <b>nem utalvány-értékesítést</b>, hanem sima <b>100%-os kupont</b> hozz létre: a(z) <b>${esc(d.termek_nev)}</b> szolgáltatásra, egyszer felhasználható, érvényes ${esc(datumIg(d.ervenyes_ig))} (6 hónap).</p>
${kodDoboz(d.kod, d.ervenyes_ig)}
<p style="font-size:13px;color:#555">A fenti kód csak javaslat: bármilyen kódot használhatsz, a kiállító oldalon azt add meg, amit a Salonicban létrehoztál.</p>
${teendo}
<p style="font-size:13px;color:#555">Ha a vevő fizikai kártyát kér, vagy a szalonban venné át, arról külön levelet kapsz.</p>
<p style="color:#888;font-size:12px">Stripe: ${esc(d.pi)}${attr.variant_id ? ` · változat: ${esc(attr.variant_id)}` : ''}${forras ? ` · forrás: ${esc(forras)}` : ''}</p>
</div>`,
  };
}

// --- fizetes utan: a vevo levele -------------------------------------------------------------------
// d: { rendeles_id, termek_nev, kartya_cim, osszeg_szoveg, nev, rendeles_url, kartya_url?, kod?, ervenyes_ig?, szalon }
// A rendeles_url csak olvaso tokent visz (rt), client_secret-et nem: a levelbol a rendeles
// megnezheto, de nem modosithato (a szemelyre szabas a fizetes utani oldalon tortenik).
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
<p>A rendelésed állapotát itt is megnézheted:</p>
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
// A vevo levele SZANDEKOSAN nem tartalmaz a kitolto altal beirt szabad szoveget (nev, megajandekozott):
// az /atutalas barki altal hivhato, es tetszoleges cimre kuld - igy nem lehet vele idegen tartalmu
// levelet kuldeni a MOSAIC nevében. Csak a sajat adatunk van benne (termek, ar, bank, ATU-azonosito).
// d: { rendeles_ref, termek_nev, kartya_cim, osszeg_szoveg, kedvezmenyezett, szamlaszam, kozlemeny, szalon }
export function vevoAtutalasLevel(d) {
  return {
    targy: `MOSAIC ajándékkártya – utalási adatok (${d.rendeles_ref})`,
    html: `<div style="${betu};max-width:600px">
<p>Kedves Vásárló!</p>
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
<p>Az utalás beérkezése után az ajándékkártyát elküldjük az e-mail-címedre: egy linkről megnyithatod, kinyomtathatod vagy PDF-ként elmentheted, és már mehet is a borítékba :)</p>
${cim('SZEMÉLYESEN IS ÁTVEHETED SZALONUNKBAN')}
<p>Ha nincs nyomtatód, vagy papír alapon szeretnéd átvenni, azt pedig megteheted nálunk, a MOSAIC Head Spa-ban (${esc(d.szalon.cim)}). Csak mondd be a közleményben szereplő azonosítót (${esc(d.rendeles_ref)}), és a recepción odaadjuk neked a kártyát.</p>
${cim('ÍGY TUDOD FELHASZNÁLNI')}
<p>Az ajándékkártyán találsz egy kódot, amit az online foglalásnál tudsz majd érvényesíteni a „kuponkód” mezőbe történő beírással.</p>
<p>Ha kérdésed van, csak írj nekünk! :)</p>
${lablec(d.szalon)}
</div>`,
  };
}

// d: { rendeles_ref, termek_nev, osszeg_szoveg, kozlemeny, email, nev, telefon, iranyitoszam, varos, cim, ceges_nev, ceges_adoszam,
//      megajandekozott, uzenet, oldal, kiallit_url, salonic_url, salonic_nev, szalon_email }
export function szalonAtutalasLevel(d) {
  return {
    targy: `Új ajándékkártya-igény (átutalás, még nincs kifizetve) – ${d.rendeles_ref}`,
    html: `<div style="${betu};max-width:640px">
<p><b>Új ajándékkártya-igény érkezett átutalással. Ez még NEM vásárlás: a kártyát csak az utalás beérkezése után kell kiállítani.</b></p>
${tabla([
  ['Azonosító (közlemény)', d.rendeles_ref], ['Termék', d.termek_nev], ['Összeg', d.osszeg_szoveg],
])}
${cim('A VEVŐ (SZÁMLÁZÁSI ADATOK)')}
${tabla([
  ['Név', d.nev], ['E-mail', d.email], ['Telefon', d.telefon], ['Cím', szamlazasiCim(d)],
  ['Cégnév', d.ceges_nev], ['Adószám', d.ceges_adoszam],
])}
${cim('A KÁRTYÁRA KERÜLŐ ADATOK')}
${tabla([['Megajándékozott', d.megajandekozott]])}
${d.uzenet ? `<p style="white-space:pre-line;border-left:3px solid ${ARANY};padding:4px 12px;margin:8px 0">${esc(d.uzenet)}</p>` : ''}
${d.atvetel_szoveg ? `${cim('ÁTVÉTEL ÉS SZEMÉLYRE SZABÁS')}${tabla([['Átvétel', d.atvetel_szoveg], ['Kártya-design', d.design_szoveg], ['Idézet', d.idezet_szoveg], ['Saját fotó', d.design_szoveg ? (d.foto_van ? 'van' : 'nincs') : '']])}${d.elonezet_url ? `<p>A vevő személyre szabott kártyájának előnézete (design, fotó, idézet): <a href="${esc(d.elonezet_url)}">megnyitás új lapon</a></p>` : ''}` : ''}
${cim('TEENDŐ, HA AZ UTALÁS BEÉRKEZETT')}
<ol style="margin:0 0 12px 18px;padding:0">
<li><b>Salonic:</b> utalvány-értékesítés (a számla miatt): ${d.salonic_url ? `<a href="${esc(d.salonic_url)}">Utalvány értékesítés megnyitása az adatokkal</a> – ${esc(d.salonic_nev || d.termek_nev)}` : esc(d.termek_nev)}. A megnyílt űrlapot a <b>MOSAIC kitöltő</b> könyvjelző egy kattintással kitölti (beállítása egyszeri, a lenti gombbal megnyíló oldalon van). Kézzel: Ajándékozó = a vevő; az <b>Ajándékozó e-mail címe</b> mezőbe a <b>szalon címét</b> (${esc(d.szalon_email || '')}) írd, hogy a Salonic ne küldjön saját levelet a vevőnek; fizetési mód: <b>Átutalás</b>; az „Ajándékozott e-mail címe” és a másolat-küldés jelölőnégyzet maradjon üresen. Az üzenetet a Salonicba nem kell beírni, a kártyára a MOSAIC írja.</li>
<li>A Salonic által adott <b>utalványkódot</b> másold ki.</li>
<li>Kattints az alábbi gombra, írd be a kódot, és a vevő e-mailben megkapja a kártyát:</li>
</ol>
${gomb(d.kiallit_url, 'Az utalás beérkezett – kiállítom a kártyát')}
<p style="font-size:13px;color:#555">Ha a gomb nem működik, ezt a címet nyisd meg: <a href="${esc(d.kiallit_url)}">${esc(d.kiallit_url)}</a></p>
<p style="font-size:13px;color:#555">Keresés: a bankszámlakivonaton a közleményben látható <b>${esc(d.rendeles_ref)}</b> kódot keresd ebben a postafiókban.</p>
${d.oldal ? `<p style="color:#888;font-size:12px">Beküldve innen: ${esc(d.oldal)}</p>` : ''}
</div>`,
  };
}

// --- visszaterites / vita (chargeback): a szalon torolje a kuponkodot ------------------------------------
// d: { oka: 'visszaterites' | 'vita', rendeles_id, pi, termek_nev, osszeg_szoveg, visszaterites_szoveg,
//      email, nev, kod, kiallitva, fizikai }
export function szalonVisszavonasLevel(d) {
  const vita = d.oka === 'vita';
  return {
    targy: `Visszatérítés / vita – töröld a kuponkódot: ${d.kod}`,
    html: `<div style="${betu};max-width:640px">
<p><b>${vita
    ? 'Egy ajándékkártya-fizetésre a kártyabirtokos vitát (chargeback) nyitott.'
    : 'Egy ajándékkártya-fizetést visszatérítettek.'} Az ajándékkártya ezért nem használható.</b></p>
${kodDoboz(d.kod, null)}
<p><b>Teendő:</b> töröld (vagy tiltsd le) a Salonicban a(z) <b>${esc(d.kod)}</b> kuponkódot, ha már létrehoztad.${d.kiallitva ? ' A kártyát a vevő már megkapta – ha foglalt vele időpontot, vedd fel vele a kapcsolatot.' : ''}${d.fizikai ? ' A vevő fizikai kártyát kért: ha már elkészült, ne add át.' : ''}</p>
${tabla([
  ['Ok', vita ? 'vita (chargeback)' : 'visszatérítés'], ['Rendelés', d.rendeles_id], ['Termék', d.termek_nev],
  ['Összeg', d.osszeg_szoveg], ['Visszatérítve', d.visszaterites_szoveg],
  ['Kártya kiállítva', d.kiallitva ? 'igen' : 'nem'], ['Vevő', d.nev], ['Vevő e-mail', d.email],
])}
${vita ? '<p style="font-size:13px;color:#555">A vita részleteit és a válaszadási határidőt a Stripe-fiókban találod.</p>' : ''}
<p style="color:#888;font-size:12px">Stripe: ${esc(d.pi)}</p>
</div>`,
  };
}

// --- HTML-oldalak --------------------------------------------------------------------------------------
// A kiallito oldal szkriptjei: a kezelo ezek hash-et teszi a Content-Security-Policy-ba.
// A "Masolas" gomb szkriptje (a kartyas rendeles javasolt kuponkodjanal): vagolapra masol, regi bongeszoben textarea-tartalekkal.
export const MASOL_JS = `document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('button[data-masol]');if(!b)return;var t=b.getAttribute('data-masol'),r=b.getAttribute('data-eredeti'),ok=function(){b.textContent=b.getAttribute('data-ok');b.classList.add('kesz');setTimeout(function(){b.textContent=r;b.classList.remove('kesz')},1800)},tart=function(){var a=document.createElement('textarea');a.value=t;a.setAttribute('readonly','');a.style.cssText='position:fixed;opacity:0';document.body.appendChild(a);a.select();var s=false;try{s=document.execCommand('copy')}catch(x){}document.body.removeChild(a);if(s)ok()};if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(ok,tart)}else{tart()}});`;
// A nyomtatogomb szkriptje (a kartya-oldalon).
export const NYOMTAT_JS = "document.getElementById('nyomtat').addEventListener('click',function(){window.print()});";

// A "MOSAIC kitoltő" konyvjelzo (bookmarklet) szkriptje: a Salonic utalvany-ertekesitesi urlapjan a link #mosaic=<JSON> reszebol
// kitolti a GiftCardBuyForm_<kulcs> mezoket (szoveg: value, jelolonegyzet: checked), majd jelzi, hany mezo lett kitoltve.
// SOHA nem kuld el semmit: az Elonezet / ertekesites gombot a szalon nyomja meg. Csak az app.salonic.hu oldalon fut.
// Szabaly (javascript: URL-kent az href-be kerul): nincs benne %, ", <, >, sortores, es csak ASCII (a magyar betuk \u-escape-pel).
export const SALONIC_KITOLTO_JS = String.raw`(function(){var m=/[#&]mosaic=([^&]+)/.exec(location.hash);if(location.hostname!=='app.salonic.hu'||!m){alert('MOSAIC kit\u00f6lt\u0151: ezt a k\u00f6nyvjelz\u0151t a MOSAIC oldalr\u00f3l megnyitott Salonic-\u0171rlapon kell megnyomni (a ki\u00e1ll\u00edt\u00f3 oldal Salonic-linkj\u00e9vel nyisd meg az \u0171rlapot).');return;}var d;try{d=JSON.parse(decodeURIComponent(m[1]));}catch(x){alert('MOSAIC kit\u00f6lt\u0151: hib\u00e1s adat a linkben, nyisd meg \u00fajra a ki\u00e1ll\u00edt\u00f3 oldal linkj\u00e9t.');return;}var n=0,h=[];Object.keys(d).forEach(function(k){var e=document.getElementById('GiftCardBuyForm_'+k);if(!e){h.push(k);return;}if(e.type==='checkbox'){e.checked=!!d[k];}else{e.value=String(d[k]);}['input','change'].forEach(function(t){e.dispatchEvent(new Event(t,{bubbles:true}));});n++;});var b=document.createElement('div');b.textContent='MOSAIC: '+n+' mez\u0151 kit\u00f6ltve'+(h.length?' (nem tal\u00e1lom: '+h.join(', ')+')':'')+'. Ellen\u0151rizd, majd kattints az El\u0151n\u00e9zetre.';b.style.cssText='position:fixed;top:0;left:0;right:0;z-index:99999;background:#17403f;color:#fff;padding:14px;text-align:center;font:16px sans-serif';document.body.appendChild(b);setTimeout(function(){b.remove();},9000);})();`;

const OLDAL_CSS = `*{box-sizing:border-box}html,body{margin:0}
.logo-sav{display:block;box-sizing:content-box;background:#183033;padding:10px 22px;border-radius:10px;margin:0 0 18px}
body{background:#ece6da;color:#2b2b2b;font:16px/1.6 "Helvetica Neue",Arial,Helvetica,sans-serif;padding:8vh 18px 40px;text-align:center}
.doboz{max-width:560px;margin:0 auto;background:${IVORY};border:1px solid ${PETROL};padding:34px 26px;position:relative}
.doboz::before{content:"";position:absolute;inset:6px;border:1px solid ${ARANY};pointer-events:none}
h1{font:400 26px/1.3 "Playfair Display",Georgia,"Times New Roman",serif;color:${PETROL_SOT};margin:18px 0 12px}
p{margin:0 0 12px}a{color:${PETROL}}
table{margin:14px auto 0!important;text-align:left;font-size:14px}
form{margin:22px 0 4px}
label{display:block;margin:0 0 6px;font-size:14px;text-align:left;color:#41585a}
input[type=text]{width:100%;font:16px/1.4 "Courier New",Courier,monospace;letter-spacing:1px;padding:12px 14px;border:1px solid #bbb;border-radius:4px;margin:0 0 6px}
.seg{font-size:13px;color:#666;text-align:left;margin:0 0 16px}
.hiba{color:#8f3b2e;font-size:14px;text-align:left;margin:0 0 10px}
.mezo{margin:0 0 4px}
.linksor{margin:6px 0 2px}
.masol{margin:20px 0 4px;text-align:left}
.masol h2{font:600 15px/1.3 "Helvetica Neue",Arial,sans-serif;color:${PETROL_SOT};margin:0 0 8px}
.masol-sor{display:flex;gap:12px;align-items:flex-start;justify-content:space-between;border-top:1px solid #e1d9c8;padding:9px 0}
.masol-sor:last-of-type{border-bottom:1px solid #e1d9c8}
.masol-adat{flex:1;min-width:0}
.masol-cimke{display:block;font-size:12px;color:#5d7576;margin:0 0 2px}
.masol-ertek{display:block;font-size:15px;white-space:pre-line;overflow-wrap:anywhere}
button.masol-gomb{flex:none;font-size:13px;padding:8px 14px;background:#fff;color:${PETROL};border:1px solid ${PETROL}}
button.masol-gomb:hover{background:#eef3f2}
button.masol-gomb.kesz{background:${PETROL};color:#fff}
.kitolto{margin:20px 0 4px;text-align:left;border:1px dashed #b9ab8a;background:#fbf8f1;padding:14px 16px}
.kitolto h2{font:600 15px/1.3 "Helvetica Neue",Arial,sans-serif;color:${PETROL_SOT};margin:0 0 8px}
.kitolto p{font-size:14px;margin:0 0 10px}
.kitolto p:last-child{margin:0}
a.kitolto-gomb{display:inline-block;background:${PETROL};color:#fff;font:600 15px/1.2 "Helvetica Neue",Arial,sans-serif;padding:9px 16px;border-radius:4px;text-decoration:none;cursor:grab;vertical-align:middle}
button{font:600 16px/1.35 "Helvetica Neue",Arial,sans-serif;background:${PETROL};color:#fff;border:0;border-radius:4px;padding:14px 22px;cursor:pointer;max-width:100%}
button:hover{background:${PETROL_SOT}}`;

// Egyszeru, barati oldal (allapot, hiba, a szalon visszaigazolasa / megerosito urlapja)
// d: { cim, bekezdesek: [szoveg], reszletek?: [[cimke, ertek]], frissit?: masodperc, bazis,
//      linkek?: [{ url, szoveg }],
//      masol?: { cim, sorok: [{ cimke, ertek }] }  (soronkent "Masolas" gomb a vagolapra; a szkript hash-e a CSP-ben)
//      kitolto?: { cim, szoveg, beallitas, href, nev }  (egy kattintasos Salonic-kitolto: a draggable konyvjelzo-link, javascript: href)
//      urlap?: { action, rejtett: { nev: ertek }, mezok?: [{ nev, cimke, ertek, max, kotelezo, megjegyzes }], hiba?, gomb } }
//      (az urlap POST-tal kuld)
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
${(d.linkek || []).map((l) => `<p class="linksor"><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.szoveg)}</a></p>`).join('\n')}
${d.kitolto ? `<section class="kitolto"><h2>${esc(d.kitolto.cim)}</h2>
<p>${esc(d.kitolto.szoveg)}</p>
<p>${esc(d.kitolto.beallitas)} <a class="kitolto-gomb" href="${esc(d.kitolto.href)}" draggable="true" title="Húzd a könyvjelzősávba">${esc(d.kitolto.nev)}</a></p>
</section>` : ''}
${d.masol && d.masol.sorok && d.masol.sorok.length ? `<section class="masol"><h2>${esc(d.masol.cim)}</h2>
${d.masol.sorok.map((m) => `<div class="masol-sor"><div class="masol-adat"><span class="masol-cimke">${esc(m.cimke)}</span><span class="masol-ertek">${esc(m.ertek)}</span></div><button type="button" class="masol-gomb" data-masol="${esc(m.ertek)}" data-eredeti="Másolás" data-ok="Másolva ✓">Másolás</button></div>`).join('\n')}
</section>
<script>${MASOL_JS}</script>` : ''}
${d.urlap ? `<form method="post" action="${esc(d.urlap.action)}">
${Object.entries(d.urlap.rejtett || {}).map(([n, v]) => `<input type="hidden" name="${esc(n)}" value="${esc(v)}">`).join('\n')}
${(d.urlap.mezok || []).map((m) => `<div class="mezo"><label for="m-${esc(m.nev)}">${esc(m.cimke)}</label>
<input type="text" id="m-${esc(m.nev)}" name="${esc(m.nev)}" value="${esc(m.ertek || '')}" maxlength="${Number(m.max) || 40}" autocomplete="off" autocapitalize="off" spellcheck="false"${m.kotelezo ? ' required' : ''}>
${m.megjegyzes ? `<p class="seg">${esc(m.megjegyzes)}</p>` : ''}</div>`).join('\n')}
${d.urlap.hiba ? `<p class="hiba">${esc(d.urlap.hiba)}</p>` : ''}
<button type="submit">${esc(d.urlap.gomb)}</button>
</form>` : ''}
</main></body></html>`;
}

// A nyomtathato ajandekkartya (onallo oldal): a MOSAIC sajat (Canva-ban keszult) A4-es kartyaterve hatterkent
// (assets/img/ajandek/kartya-hatter.jpg, a valtozo szovegek nelkul), a valtozo reszeket (nev, termek, ertek,
// kod, ervenyesseg, uzenet) a rendszer irja ra - ugyanazokra a helyekre, ahova eddig kezzel kerultek.
// A pozicio / meret a terv 794 x 1123 px-es koordinatainak szazalekos atszamitasa; a betumeret a kartya
// szelessegehez kepest (cqw), igy a kepernyon es nyomtatasban (210 mm) is aranyos.
// d: { bazis, kod, kartya_felirat: [sor1, sor2], ar_szoveg, nev, uzenet, ervenyes_ig, szalon }
const KP = (x, y, w, h) => `left:${(x / 7.94).toFixed(3)}%;top:${(y / 11.23).toFixed(3)}%;width:${(w / 7.94).toFixed(3)}%;height:${(h / 11.23).toFixed(3)}%`;
const CQ = (px) => `${(px / 7.94).toFixed(3)}cqw`;
const meretSor = (szoveg, lepcsok) => {
  const n = String(szoveg || '').length;
  for (const [max, px] of lepcsok) if (n <= max) return px;
  return lepcsok[lepcsok.length - 1][1];
};
// A SZEMELYRE SZABOTT (otthon nyomtatott) kartya onallo oldala: a mini szemelyre szabo elonezetevel azonos sablon
// (assets/js/ajandek-kartya.js), igy a nyomtatas = az, amit a vevo a fizetes elott latott.
// d: { bazis, tema, idezet, nev, foto_src, foto_poz, kartya_felirat, ar_szoveg, kod, ervenyes_ig, ervenyes_szoveg, elonezet }
export function szemelyreSzabottKartyaOldal(d) {
  const K = globalThis.AJANDEK_KARTYA;
  const kartya = K.html({
    tema: d.tema, idezet: d.idezet, nev: d.nev, fotoSrc: d.foto_src || null, fotoPoz: K.pozOlvas(d.foto_poz),
    felirat: d.kartya_felirat, ertek: d.ar_szoveg, kod: d.kod, ervenyes: d.ervenyes_ig ? datumIg(d.ervenyes_ig) : (d.ervenyes_szoveg || null), minta: false,
  });
  return `<!doctype html>
<html lang="hu"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<title>MOSAIC Head Spa ajándékkártya${d.elonezet ? ' – előnézet' : ''}</title>
<style>
${K.betuCss(d.bazis)}
${K.CSS}
@page{size:A4 portrait;margin:0}
/* az A4-es lap fele-fele: a (kepes) dizajnok sajat aranyu lapja a felek kozepen all, a hajtas a ket fel kozott */
.ak-lap{container-type:inline-size;aspect-ratio:794/1123;grid-template-rows:1fr 1fr;align-items:center;background:#fff}
.ak-lap>.ak{width:min(100%,calc(70.71cqw * var(--ak-ar,1.4141)));justify-self:center}
*{box-sizing:border-box}
html,body{margin:0}
body{background:#e9e3d7;color:#2b2b2b;font:15px/1.55 "Helvetica Neue",Arial,Helvetica,sans-serif;padding:24px 12px 40px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.lap{width:min(100%,794px);margin:0 auto;box-shadow:0 10px 30px rgba(15,58,60,.25)}
.jelzes{max-width:794px;margin:0 auto 14px;background:#f7efd9;border:1px solid #e8d9ad;border-radius:6px;padding:10px 14px;font-size:14px;text-align:center}
.gombsor{text-align:center;margin:22px 0 0}
#nyomtat{font:600 16px/1 "Helvetica Neue",Arial,sans-serif;background:#17403f;color:#fff;border:0;border-radius:4px;padding:14px 26px;cursor:pointer}
#nyomtat:hover{background:#0f3130}
.tipp{font-size:13px;color:#555;margin:12px auto 0;max-width:150mm}
@media print{body{background:#fff;padding:0}.lap{width:210mm;height:297mm;overflow:hidden;box-shadow:none}.nem-nyomtat{display:none!important}}
</style></head>
<body><main>
${d.elonezet ? '<p class="jelzes nem-nyomtat">Előnézet a szalonnak: a vevő a kiállítás után kapja meg a végleges kártyát.</p>' : ''}
<section class="lap" aria-label="Ajándékkártya">${kartya}</section>
<div class="gombsor nem-nyomtat">
<button type="button" id="nyomtat">Nyomtatás / Mentés PDF-ként</button>
<p class="tipp">Tipp: a lapot A4-es papírra nyomtasd (álló tájolás), majd hajtsd félbe a szaggatott vonal mentén: elöl a személyre szabott lap, hátul a kártya adatai lesznek. A nyomtatási ablakban a „Mentés PDF-ként” célt választva PDF-et kapsz, amit e-mailben is továbbküldhetsz. A kódot az online időpontfoglalásnál (mosaicheadspa.hu/idpontfoglalas) add meg. Nyomtatáskor kapcsold be a háttérszínek / háttérgrafika nyomtatását.</p>
</div>
</main>
<script>${NYOMTAT_JS}</script>
</body></html>`;
}

export function kartyaOldal(d) {
  const bazis = esc(d.bazis);
  const nev = String(d.nev || '').trim() || 'Neked';
  const uzenet = String(d.uzenet || '').trim() || 'Miképp szeretetem Feléd árad, úgy hozom a pillanat varázsát, s csak Neked ajándékul adom a szép haj és lágy érintés csodáját.';
  const felirat = (d.kartya_felirat && d.kartya_felirat.length ? d.kartya_felirat : ['MOSAIC', 'HEAD SPA KEZELÉS']).map(esc).join('<br>');
  const betu = (suly, tipus) => `@font-face{font-family:"AjandekSans";font-style:normal;font-weight:${suly};font-display:swap;src:url(${bazis}/assets/fonts/${tipus}-latin.woff2) format("woff2");unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:"AjandekSans";font-style:normal;font-weight:${suly};font-display:swap;src:url(${bazis}/assets/fonts/${tipus}-latin-ext.woff2) format("woff2");unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}`;
  return `<!doctype html>
<html lang="hu"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<title>MOSAIC Head Spa ajándékkártya – ${esc(d.kod)}</title>
<style>
${betu(400, 'hanken-grotesk-400')}
${betu(600, 'hanken-grotesk-600')}
@page{size:A4 portrait;margin:0}
*{box-sizing:border-box}
html,body{margin:0}
body{background:#e9e3d7;color:#2b2b2b;font:15px/1.55 "Helvetica Neue",Arial,Helvetica,sans-serif;padding:24px 12px 40px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.lap{position:relative;width:min(100%,794px);margin:0 auto;aspect-ratio:794/1123;container-type:inline-size;background:#0f2727;box-shadow:0 10px 30px rgba(15,58,60,.25);overflow:hidden}
.hatter{position:absolute;inset:0;width:100%;height:100%;display:block}
.k{position:absolute;margin:0;display:flex;align-items:center;justify-content:center;text-align:center;font-family:"AjandekSans","Hanken Grotesk","Helvetica Neue",Arial,sans-serif;overflow:hidden}
.f180{transform:rotate(180deg)}
.nev{${KP(16.79, 179.47, 773.6, 48.03)};font-weight:600;font-size:${CQ(40.1)};line-height:.9;color:#091717;text-transform:uppercase}
.uzenet{${KP(198.16, 42.74, 410.9, 73.5)};font-weight:400;font-size:${CQ(18.6)};line-height:1.4;color:#f4de93;white-space:pre-line;overflow-wrap:anywhere}
.termek{${KP(73.12, 708.1, 647.46, 75.8)};font-weight:600;font-size:${CQ(36.1)};line-height:.9;color:#091717;text-transform:uppercase}
.ertek{${KP(209.86, 855.75, 351.28, 22.2)};font-weight:600;font-size:${CQ(19)};line-height:1.2;color:#091717}
.kod{${KP(209.86, 934.66, 351.28, 22.2)};font-weight:600;font-size:${CQ(19)};line-height:1.2;letter-spacing:.06em;color:#091717}
.ervenyes{${KP(244, 988, 296, 20)};font-weight:400;font-size:${CQ(13.5)};line-height:1.2;color:#f4de93}
.gombsor{text-align:center;margin:22px 0 0}
#nyomtat{font:600 16px/1 "Helvetica Neue",Arial,sans-serif;background:#17403f;color:#fff;border:0;border-radius:4px;padding:14px 26px;cursor:pointer}
#nyomtat:hover{background:#0f3130}
.tipp{font-size:13px;color:#555;margin:12px auto 0;max-width:150mm}
@media print{body{background:#fff;padding:0}.lap{width:210mm;height:297mm;box-shadow:none}.nem-nyomtat{display:none!important}}
</style></head>
<body><main>
<section class="lap" aria-label="Ajándékkártya">
<img class="hatter" src="${bazis}/assets/img/ajandek/kartya-hatter.jpg" alt="" width="2382" height="3369">
<p class="k f180 uzenet" style="font-size:${CQ(meretSor(uzenet, [[120, 18.6], [190, 15.5], [300, 12.5]]))}">${esc(uzenet)}</p>
<p class="k f180 nev" style="font-size:${CQ(meretSor(nev, [[22, 40.1], [30, 32], [60, 24]]))}">${esc(nev)}</p>
<p class="k termek">${felirat}</p>
<p class="k ertek">${esc(d.ar_szoveg || '')}</p>
<p class="k kod" style="font-size:${CQ(meretSor(d.kod, [[16, 19], [28, 15], [60, 11]]))}">${esc(d.kod)}</p>
<p class="k ervenyes">Érvényes: ${esc(datumIg(d.ervenyes_ig))}</p>
</section>
<div class="gombsor nem-nyomtat">
<button type="button" id="nyomtat">Nyomtatás / Mentés PDF-ként</button>
<p class="tipp">Tipp: a nyomtatási ablakban a „Mentés PDF-ként” célt választva PDF-et kapsz, amit e-mailben is továbbküldhetsz. A kódot az online időpontfoglalásnál (mosaicheadspa.hu/idpontfoglalas) add meg.</p>
</div>
</main>
<script>${NYOMTAT_JS}</script>
</body></html>`;
}
