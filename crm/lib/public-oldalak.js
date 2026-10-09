// Publikus (vendeg) HTML oldalak a tokenes linkekhez: allapotfelmero, kepek (osszehasonlitas), uj link kerese, elegedettseg, leiratkozas.
// MOSAIC arculat (sotetzold #0f3a3c / krem / arany, Jost + Playfair a /assets/fonts-bol, rendszerfont-tartalekkal). Reszponziv, noindex, no-store,
// KULSO script / tracking NINCS (a CSP script-et egyaltalan nem enged). Minden dinamikus ertek esc()-elt; a vendeg altal beirt szoveg sosem nyers HTML.
import { esc } from './http.js';
import { magyarDatum } from './api-dokumentum.js';

const datumIg = (epoch) => `${magyarDatum(epoch).replace(/\.$/, '')}-ig`;

const BETU = `
@font-face{font-family:Jost;font-weight:400;font-display:swap;src:url(/assets/fonts/jost-400-latin.woff2) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:Jost;font-weight:400;font-display:swap;src:url(/assets/fonts/jost-400-latin-ext.woff2) format('woff2');unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1E00-1E9F,U+1EF2-1EFF,U+20A0-20AB,U+20AD-20C0}
@font-face{font-family:'Playfair Display';font-weight:500;font-display:swap;src:url(/assets/fonts/playfair-display-500-latin.woff2) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+FEFF,U+FFFD}
@font-face{font-family:'Playfair Display';font-weight:500;font-display:swap;src:url(/assets/fonts/playfair-display-500-latin-ext.woff2) format('woff2');unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+1E00-1E9F,U+1EF2-1EFF,U+20A0-20AB,U+20AD-20C0}`;

const CSS = `${BETU}
:root{--sotet:#0f3a3c;--krem:#f8f3e8;--arany:#9e7d3f;--szoveg:#232f2f;--halk:#5f6b6a;--vonal:#e0d8c4;--hiba:#8f2d22}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--krem);color:var(--szoveg);font:400 17px/1.6 Jost,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}
header{background:var(--sotet);color:#fff;padding:22px 20px;text-align:center}
header b{display:block;font:500 26px/1.1 'Playfair Display',Georgia,'Times New Roman',serif;letter-spacing:.04em}
header small{display:block;margin-top:6px;color:#d9c48f;font-size:11px;letter-spacing:.28em}
main{max-width:640px;margin:0 auto;padding:28px 20px 56px}
h1{font:500 28px/1.25 'Playfair Display',Georgia,serif;color:var(--sotet);margin:0 0 14px}
h2{font:500 20px/1.3 'Playfair Display',Georgia,serif;color:var(--sotet);margin:28px 0 8px}
p{margin:0 0 14px}
.halk{color:var(--halk);font-size:15px}
fieldset{border:1px solid var(--vonal);border-radius:12px;background:#fff;margin:0 0 18px;padding:14px 16px 6px}
legend{font:500 17px/1.3 'Playfair Display',Georgia,serif;color:var(--sotet);padding:0 8px}
.k{margin:0 0 14px}
.k>span{display:block;margin-bottom:6px}
label.v{display:flex;gap:10px;align-items:flex-start;padding:8px 2px;min-height:44px;cursor:pointer}
input[type=radio],input[type=checkbox]{width:22px;height:22px;margin:2px 0 0;accent-color:var(--sotet);flex:none}
input[type=text],input[type=email],textarea,select{width:100%;font:inherit;padding:12px;border:1px solid #bfb8a4;border-radius:10px;background:#fff;color:inherit;min-height:46px}
textarea{min-height:110px;resize:vertical}
button,.gomb{display:inline-block;background:var(--sotet);color:#fff;border:0;border-radius:999px;padding:14px 28px;font:inherit;font-size:17px;cursor:pointer;text-decoration:none;min-height:48px}
button:hover,.gomb:hover{background:#17504f}
:focus-visible{outline:3px solid var(--arany);outline-offset:2px}
.hiba{background:#fbe9e6;border:1px solid #e6b3ab;color:var(--hiba);border-radius:10px;padding:12px 16px;margin:0 0 18px}
.hiba ul{margin:6px 0 0;padding-left:20px}
.kepek{display:grid;gap:14px;grid-template-columns:1fr}
@media(min-width:560px){.kepek{grid-template-columns:1fr 1fr}}
.kepek figure{margin:0;background:#fff;border:1px solid var(--vonal);border-radius:12px;padding:10px}
.kepek img{display:block;width:100%;height:auto;border-radius:8px;background:#eee}
.kepek figcaption{margin-top:8px;font-size:15px;color:var(--halk)}
.komment{background:#fff;border-left:4px solid var(--arany);padding:14px 18px;border-radius:0 12px 12px 0;margin:20px 0;white-space:pre-wrap}
.pontok{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 18px}
.pontok label{flex:1 1 56px;text-align:center;border:1px solid #bfb8a4;border-radius:12px;background:#fff;padding:12px 4px;cursor:pointer;min-height:48px}
.pontok input{position:absolute;opacity:0}
.pontok label:has(input:checked){background:var(--sotet);color:#fff;border-color:var(--sotet)}
.pontok label:has(input:focus-visible){outline:3px solid var(--arany)}
footer{max-width:640px;margin:0 auto;padding:0 20px 36px;color:var(--halk);font-size:13px}
.hp{position:absolute;left:-9999px;height:0;overflow:hidden}`;

/** teljes oldal-keret */
export function oldal(cim, torzs) {
  return `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive"><meta name="referrer" content="no-referrer"><meta name="color-scheme" content="light">
<title>${esc(cim)} – MOSAIC Head Spa and Hair</title><style>${CSS}</style></head><body>
<header><b>MOSAIC</b><small>HEAD SPA AND HAIR</small></header><main>${torzs}</main>
<footer>MOSAIC Head Spa and Hair · 1023 Budapest, Becsi ut 2. · Ez az oldal személyes hivatkozással érhető el, kérjük, ne oszd meg.</footer></body></html>`;
}

export const hibaOldal = (cim, uzenet, extra = '') => oldal(cim, `<h1>${esc(cim)}</h1><p>${esc(uzenet)}</p>${extra}`);
export const koszonoOldal = (cim, uzenet) => oldal(cim, `<h1>${esc(cim)}</h1><p>${esc(uzenet)}</p>`);
export const ervenytelenLinkOldal = () => hibaOldal('A hivatkozás nem érvényes', 'Ez a hivatkozás nem érvényes, vagy már felhasználták. Ha szükséged van rá, kérj új hivatkozást a szalontól.');

// ---- allapotfelmero ---------------------------------------------------------------------------------------------------------------------------
function kerdesHtml(k, ertek) {
  const nev = `q_${k.kulcs}`;
  const kot = k.kotelezo ? ' <span class="halk">(kötelező)</span>' : '';
  if (k.kulcs === 'adatkezeles_elfogadva') {
    return `<div class="k"><label class="v"><input type="checkbox" name="${esc(nev)}" value="igen"${ertek === true ? ' checked' : ''} required><span>${esc(k.szoveg)}</span></label></div>`;
  }
  if (k.tipus === 'boolean') {
    return `<div class="k" role="radiogroup" aria-label="${esc(k.szoveg)}"><span>${esc(k.szoveg)}${kot}</span>
      <label class="v"><input type="radio" name="${esc(nev)}" value="igen"${ertek === true ? ' checked' : ''}${k.kotelezo ? ' required' : ''}>Igen</label>
      <label class="v"><input type="radio" name="${esc(nev)}" value="nem"${ertek === false ? ' checked' : ''}>Nem</label></div>`;
  }
  if (k.tipus === 'text') {
    return `<div class="k"><label for="${esc(nev)}"><span>${esc(k.szoveg)}${kot}</span></label><textarea id="${esc(nev)}" name="${esc(nev)}" maxlength="2000" rows="3">${esc(ertek ?? '')}</textarea></div>`;
  }
  if (k.tipus === 'select') {
    return `<div class="k" role="radiogroup" aria-label="${esc(k.szoveg)}"><span>${esc(k.szoveg)}${kot}</span>${(k.opciok || []).map((o) => `<label class="v"><input type="radio" name="${esc(nev)}" value="${esc(o)}"${ertek === o ? ' checked' : ''}${k.kotelezo ? ' required' : ''}>${esc(o)}</label>`).join('')}</div>`;
  }
  const kijelolt = Array.isArray(ertek) ? ertek : [];
  return `<div class="k"><span>${esc(k.szoveg)}${kot}</span>${(k.opciok || []).map((o) => `<label class="v"><input type="checkbox" name="${esc(nev)}" value="${esc(o)}"${kijelolt.includes(o) ? ' checked' : ''}>${esc(o)}</label>`).join('')}</div>`;
}

/** a jovahagyott kerdoiv-verzio kerdeseinek urlapja. ertekek: a korabban beirt valaszok (hibas bekuldes utan), hibak: szoveges lista */
export function felmeroOldal({ definicio, ertekek = {}, hibak = [], action }) {
  const hibaHtml = hibak.length ? `<div class="hiba" role="alert"><b>Kérjük, javítsd az alábbiakat:</b><ul>${hibak.map((h) => `<li>${esc(h)}</li>`).join('')}</ul></div>` : '';
  const csoportok = (definicio?.csoportok || []).map((cs) => `<fieldset><legend>${esc(cs.cim)}</legend>${(cs.kerdesek || []).map((k) => kerdesHtml(k, ertekek[k.kulcs])).join('')}</fieldset>`).join('');
  return oldal('Állapotfelmérő', `<h1>Állapotfelmérő</h1>
<p>Kérjük, a kezelésed előtt töltsd ki ezt a rövid kérdőívet. A válaszaidat bizalmasan kezeljük, csak a kezelő szakemberek látják.</p>
<p class="halk">A kitöltés nem jelent marketing-hozzájárulást, és nem feltétele semmilyen hírlevélre való feliratkozásnak.</p>${hibaHtml}
<form method="post" action="${esc(action)}" autocomplete="off">${csoportok}<button type="submit">Beküldöm</button></form>`);
}

/** a bekuldott urlap (x-www-form-urlencoded) -> valaszok a kerdoiv-definicio szerint */
export function felmeroValaszok(definicio, urlap) {
  const v = {};
  for (const cs of definicio?.csoportok || []) {
    for (const k of cs.kerdesek || []) {
      const nyers = urlap[`q_${k.kulcs}`];
      if (k.kulcs === 'adatkezeles_elfogadva') { v[k.kulcs] = nyers === 'igen'; continue; }
      if (nyers === undefined || nyers === '') continue;
      if (k.tipus === 'boolean') { if (nyers === 'igen') v[k.kulcs] = true; else if (nyers === 'nem') v[k.kulcs] = false; else v[k.kulcs] = nyers; }
      else if (k.tipus === 'multi') v[k.kulcs] = Array.isArray(nyers) ? nyers : [nyers];
      else v[k.kulcs] = typeof nyers === 'string' ? nyers.trim() : nyers;
    }
  }
  return v;
}

// ---- kepek: osszehasonlito nezet -------------------------------------------------------------------------------------------------------------
export function osszehasonlitasOldal({ token, osszehasonlitas, lejar }) {
  const t = encodeURIComponent(token);
  const kepek = (osszehasonlitas.kepek || []).map((k, i) => `<figure><img src="/api/crm/public/kep/${t}/${encodeURIComponent(k.id)}" alt="${i === 0 ? 'Korábbi állapot' : 'Későbbi állapot'}: ${esc(k.treatment_index)}. kezelés" loading="lazy"><figcaption>${esc(k.treatment_index)}. kezelés${i === 0 ? ' – kiindulás' : ''}</figcaption></figure>`).join('');
  const komment = osszehasonlitas.ertekeles ? `<h2>A kezelőd értékelése</h2><div class="komment">${esc(osszehasonlitas.ertekeles)}</div>` : '';
  return oldal('A hajkamera-képeid', `<h1>A hajkamera-képeid</h1><p>Az alábbi képek a kezeléseid során készültek, ugyanarról a pontról.</p><div class="kepek">${kepek}</div>${komment}
<p class="halk">Ez a hivatkozás ${esc(datumIg(lejar))} érvényes. Ezek a képek egészségi jellegű adatnak minősülnek, kérjük, ne oszd meg őket.</p>`);
}

export function lejartOldal({ token }) {
  return oldal('A hivatkozás lejárt', `<h1>A hivatkozás lejárt</h1>
<p>A képekhez tartozó hivatkozás érvényességi ideje lejárt. Új hivatkozást kérhetsz: add meg az e-mail-címedet, amellyel nálunk regisztráltál. Ha a cím szerepel a nyilvántartásunkban, elküldünk egy egyszer használható megerősítő hivatkozást.</p>
<form method="post" action="/api/crm/public/uj-link"><input type="hidden" name="token" value="${esc(token)}">
<p class="k"><label for="email"><span>E-mail-cím</span></label><input id="email" type="email" name="email" autocomplete="email" required maxlength="200"></p>
<button type="submit">Kérek új hivatkozást</button></form>`);
}
export const ujLinkValaszOldal = () => koszonoOldal('Köszönjük', 'Ha az e-mail-cím nálunk regisztrált, elküldtük a megerősítő hivatkozást. A levél néhány percen belül megérkezik, a hivatkozás 30 percig érvényes.');
export function ujHozzaferesOldal({ token, lejar }) {
  return oldal('Új hozzáférés', `<h1>Új hozzáférés kiadva</h1><p>Megerősítettük az e-mail-címedet. Az új hivatkozás ${esc(datumIg(lejar))} érvényes.</p>
<p><a class="gomb" href="/api/crm/public/kep/${encodeURIComponent(token)}">Megnézem a képeimet</a></p>`);
}

// ---- elegedettseg -------------------------------------------------------------------------------------------------------------------------------
export function elegedettsegOldal({ action, hibak = [], pont = null, komment = '' }) {
  const hibaHtml = hibak.length ? `<div class="hiba" role="alert">${hibak.map((h) => esc(h)).join('<br>')}</div>` : '';
  const gombok = [1, 2, 3, 4, 5].map((n) => `<label><input type="radio" name="pont" value="${n}"${Number(pont) === n ? ' checked' : ''} required>${n}</label>`).join('');
  return oldal('Elégedettség', `<h1>Hogy érezted magad nálunk?</h1><p>Kérjük, értékeld a mai élményedet 1-től (nem voltam elégedett) 5-ig (nagyon elégedett voltam).</p>${hibaHtml}
<form method="post" action="${esc(action)}"><div class="pontok" role="radiogroup" aria-label="Pontszám">${gombok}</div>
<p class="k"><label for="komment"><span>Szeretnél hozzáfűzni valamit? (nem kötelező)</span></label><textarea id="komment" name="komment" maxlength="2000">${esc(komment)}</textarea></p>
<button type="submit">Elküldöm</button></form>`);
}

// ---- leiratkozas ---------------------------------------------------------------------------------------------------------------------------------
const CSATORNA_NEV = { email_marketing: 'E-mailes hírlevelek és ajánlatok', sms_marketing: 'SMS-es ajánlatok', image_marketing: 'Képeim marketing célú felhasználása' };
export function leiratkozasOldal({ action, allapotok }) {
  const sorok = Object.entries(CSATORNA_NEV).map(([cs, nev]) => `<label class="v"><input type="checkbox" name="csatorna" value="${esc(cs)}"${allapotok?.[cs] ? ' checked' : ''}><span>${esc(nev)}${allapotok?.[cs] ? '' : ' <span class="halk">(jelenleg nincs hozzájárulásod)</span>'}</span></label>`).join('');
  return oldal('Leiratkozás', `<h1>Leiratkozás</h1><p>Jelöld be, melyik csatornákról szeretnél leiratkozni. A foglalásaiddal kapcsolatos tájékoztató üzeneteket (pl. időpont-emlékeztető) továbbra is megkaphatod.</p>
<form method="post" action="${esc(action)}"><fieldset><legend>Csatornák</legend>${sorok}</fieldset><button type="submit">Leiratkozom</button></form>`);
}
export const leiratkozasKeszOldal = (csatornak) => koszonoOldal('Sikeres leiratkozás', csatornak.length ? `Leiratkoztál a következőkről: ${csatornak.map((c) => CSATORNA_NEV[c] || c).join(', ')}. A módosítás azonnal érvénybe lépett.` : 'Nem jelöltél meg csatornát, ezért nem történt módosítás.');
