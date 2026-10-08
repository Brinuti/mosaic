// "A foglalásod" oldal (SMS / e-mail link: /f/<kod>): a vendég a SAJÁT oldalunkon látja, módosítja vagy mondja le az időpontját.
// A Salonic vendég-oldala (részletek / módosítás / lemondás) ide van beágyazva (iframe, mint a foglaló-motorban), a Salonic-fiókokba töltött
// egyedi CSS (salonic/mosaic.css, salonic/pmu.css) formázza mobilbarátra, és elrejti a Salonic felé mutató linkeket.
// Főszabály: látogatót nem viszünk a Salonic saját oldalára, csak az űrlapot hívjuk meg a mi oldalunkon belül.
import { UZLETAGAK, SZALON, tisztaNev, uzletaggal } from './uzletag.js';
import { datumSzoveg, idopontSzoveg } from './ido.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const TEL_HREF = 'tel:+36202474444';

const CSS = `
@font-face { font-family: 'Jost'; font-style: normal; font-weight: 400; font-display: swap; src: url(/assets/fonts/jost-400-latin-ext.woff2) format('woff2'); unicode-range: U+0100-024F, U+0259, U+1E00-1EFF, U+2020, U+20A0-20AB, U+20AD-20CF, U+2113, U+2C60-2C7F, U+A720-A7FF; }
@font-face { font-family: 'Jost'; font-style: normal; font-weight: 400; font-display: swap; src: url(/assets/fonts/jost-400-latin.woff2) format('woff2'); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }
:root { --sotet: #183033; --kozep: #44595c; --halvany: #6d8285; --krem: #fbeede; --hatter: #fffaf4; --vonal: #e8ddcd; --arany: #b8955a; --aranyg: linear-gradient(#c6a346, #d9c164); }
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body { margin: 0; background: var(--hatter); color: var(--sotet); font: 400 16px/1.5 'Jost', 'Helvetica Neue', Arial, sans-serif; min-height: 100vh; display: flex; flex-direction: column; }
header.fej { background: var(--sotet); color: var(--krem); text-align: center; padding: 10px 16px 9px; }
header.fej a { color: inherit; text-decoration: none; }
.logo { display: block; font: 400 19px/1 'Jost', Arial, sans-serif; letter-spacing: .38em; padding-left: .38em; }
.uzlet { display: block; margin-top: 4px; font-size: 11px; letter-spacing: .14em; text-transform: uppercase; opacity: .78; }
main { width: 100%; max-width: 560px; margin: 0 auto; padding: 10px 12px calc(28px + env(safe-area-inset-bottom, 0px)); flex: 1 0 auto; }
h1 { margin: 0 0 8px; font: 400 21px/1.2 'Jost', Arial, sans-serif; letter-spacing: .01em; text-align: center; }
.le { margin: -4px 0 10px; text-align: center; color: var(--kozep); font-size: 14px; }
@media (max-width: 600px) { .le { display: none; } }
.keret { position: relative; background: #fff; border: 1px solid var(--vonal); border-radius: 14px; overflow: hidden; }
.keret iframe { display: block; width: 100%; height: clamp(540px, calc(100vh - 150px), 920px); height: clamp(540px, calc(100dvh - 150px), 920px); border: 0; position: relative; z-index: 1; background: transparent; }
.betolt { position: absolute; inset: 0; z-index: 0; margin: 0; display: flex; align-items: center; justify-content: center; color: var(--halvany); font-size: 14px; text-align: center; padding: 0 16px; }
.lassu { display: none; margin: 10px 0 0; text-align: center; font-size: 14px; color: var(--kozep); }
.alul { margin-top: 16px; display: grid; gap: 10px; text-align: center; }
.gomb { display: block; padding: 13px 20px; border-radius: 999px; background: var(--aranyg); color: #fff; text-decoration: none; font-weight: 400; letter-spacing: .08em; text-transform: uppercase; font-size: 14px; text-shadow: 0 1px 2px rgba(80, 60, 10, .35); }
.gomb.halk { background: transparent; color: var(--sotet); border: 1.5px solid var(--sotet); text-shadow: none; }
.kicsi { margin: 0; font-size: 13.5px; color: var(--kozep); }
.kicsi a { color: var(--sotet); }
.uzenet { background: #fff; border: 1px solid var(--vonal); border-radius: 14px; padding: 22px 18px; text-align: center; }
.uzenet h2 { margin: 0 0 8px; font: 400 20px/1.3 'Jost', Arial, sans-serif; }
.uzenet p { margin: 0 0 12px; color: var(--kozep); }
.uzenet .doboz { background: var(--krem); border-radius: 10px; padding: 10px 12px; margin: 0 0 14px; font-size: 15px; }
`;

function fej(uzletag) {
  const uz = UZLETAGAK[uzletag];
  return `<header class="fej"><a class="logo" href="https://www.mosaicheadspa.hu/" aria-label="MOSAIC">MOSAIC</a>${uz ? `<span class="uzlet">${esc(uz.nev.replace(/^MOSAIC\s+/, ''))}</span>` : ''}</header>`;
}

function oldal(cim, torzs, uzletag, status = 200, extraFej = '') {
  const html = `<!doctype html>
<html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="robots" content="noindex, nofollow"><meta name="referrer" content="origin">
<title>${esc(cim)} | MOSAIC</title><link rel="icon" href="/assets/img/c2eb0f_b001e2c55098446da3e38ff055e20354.png" type="image/png"><style>${CSS}</style>${extraFej}</head>
<body>${fej(uzletag)}<main>${torzs}</main></body></html>`;
  return new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex', 'referrer-policy': 'origin' } });
}

const hivas = `<p class="kicsi">Kérdésed van? Hívj minket: <a href="${TEL_HREF}">${esc(SZALON.telefon)}</a></p>`;

/** Ismeretlen / hibás kód. */
export function nemTalalhato() {
  return oldal('Nem találom a foglalást', `<div class="uzenet"><h2>Nem találom ezt a foglalást</h2><p>Ha módosítani szeretnéd az időpontodat, hívj minket, és segítünk.</p>${hivas.replace('class="kicsi"', 'class="kicsi" style="font-size:16px"')}</div>`, null, 404);
}

/**
 * @param {{ token:string, uzletag:string, allapot:string, fiok:string, id:string, kezdet:number, szolgaltatas:string, salonicUrl:string|null }} f
 */
export function foglalasOldal(f) {
  const uz = UZLETAGAK[f.uzletag];
  const ujIdopont = `<a class="gomb" href="${esc(uz.foglalasUrl)}">Új időpontot foglalok</a>`;
  const nev = uzletaggal(f.uzletag, tisztaNev(f.szolgaltatas), true);
  const doboz = `<div class="doboz"><b>${esc(nev)}</b><br>${esc(datumSzoveg(f.kezdet))}, ${esc(idopontSzoveg(f.kezdet))}</div>`;
  if (f.allapot === 'lemondva') {
    return oldal('A foglalásod', `<div class="uzenet"><h2>Ez az időpont le lett mondva</h2>${doboz}<p>Ha szeretnél újat, itt választhatsz:</p>${ujIdopont}</div>${hivas}`, f.uzletag);
  }
  if (f.allapot === 'nem_jelent_meg') {
    return oldal('A foglalásod', `<div class="uzenet"><h2>Nem találkoztunk ezen az időponton</h2>${doboz}<p>Előfordul. Ha csak az időpont csúszott el, itt választhatsz újat:</p>${ujIdopont}</div>${hivas}`, f.uzletag);
  }
  if (!f.salonicUrl) { // szintetikus azonosítójú foglalás: nincs egyedi Salonic-oldala
    return oldal('A foglalásod', `<div class="uzenet"><h2>A foglalásod</h2>${doboz}<p>Az időpont módosításához vagy lemondásához hívj minket, és segítünk.</p>${hivas}</div>`, f.uzletag);
  }
  const torzs = `<h1>A foglalásod</h1>
<p class="le">Itt nézheted meg, módosíthatod vagy mondhatod le az időpontodat.</p>
<div class="keret"><p class="betolt" id="betolt">Betöltés…</p><iframe id="foglalas" title="A foglalásod" src="${esc(f.salonicUrl)}"></iframe></div>
<p class="lassu" id="lassu">Nem jelenik meg az oldal? Hívj minket: <a href="${TEL_HREF}">${esc(SZALON.telefon)}</a>, és segítünk.</p>
<div class="alul">${ujIdopont.replace('class="gomb"', 'class="gomb halk"')}${hivas}<p class="kicsi">${esc(SZALON.cim)} · <a href="${esc(SZALON.navigacioUrl)}" target="_blank" rel="noopener">Útvonalterv</a></p></div>
<script>(function(){var k=document.getElementById('foglalas'),b=document.getElementById('betolt'),l=document.getElementById('lassu'),t=setTimeout(function(){l.style.display='block'},8000);k.addEventListener('load',function(){clearTimeout(t);b.style.display='none';l.style.display='none';});})();</script>`;
  return oldal('A foglalásod', torzs, f.uzletag);
}
