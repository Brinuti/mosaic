// "A foglalásod" oldal a Medical Piercing vendégeinek (az e-mailek / SMS-ek linkje: /f/<kód>, megerősítés: /m/<kód>).
// Az adat a foglalás -> megjelenés rendszer közös D1-adatbázisából jön (LIFECYCLE_DB; a rendszer a Mosaic-projektben fut: ../netlify/lib/lifecycle),
// de innen CSAK az uzletag = 'mp' sorok látszanak, és csak a megerősítés (megerositve) íródik. A Mosaic-oldalról NEM importálunk semmit
// (ez a projekt önállóan épül): a pár szükséges segéd (dátum, szolgáltatásnév, munkatárs-fotó, helyszín) itt külön van.
// /f/minta: bemutató oldal mintaadatokkal (adatbázis nélkül), hogy a dizájn foglalás nélkül is látható legyen.

const SITE = 'https://www.medicalpiercing.hu';
const TELEFON = '+36 1 901 7444';
const TEL_HREF = 'tel:+3619017444';
const EMAIL = 'medicalpiercing.hu@gmail.com';
const BP_CIM = '1137 Budapest, Újpesti rakpart 7., 5. emelet 25. (a Jászai Mari térnél)';
const BP_ERKEZES = 'A Jászai Mari térnél vagyunk, a környező utcákban könnyen meg tudsz állni autóval; villamossal a Jászai Mari tér megálló van a legközelebb.';
const BP_TERKEP = 'https://www.google.com/maps/search/?api=1&query=Medical+Piercing+1137+Budapest+%C3%9Ajpesti+rakpart+7';
const SALONIC_FIOK = 'medicalpiercing';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const BOT = /bot|crawl|spider|preview|facebookexternal|whatsapp|telegram|slackbot|inspectiontool|skypeuripreview/i;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const ekezetNelkul = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// ---- segédek (a ../netlify/lib/lifecycle/uzletag.js MP-részének megfelelői) ---------------------------------------------------------------------
const BP_MUNKATARS = [/\bkovacs gabriella\b/, /\bkovacs richard\b/, /\bmarko fanni\b/, /^fanni$/];
const FOTOK = [
  [/\bkovacs gabriella\b/, 'f18724_3ae9dfe53a07477fae1a816f79be5098.jpg'],
  [/\bkovacs richard\b/, 'f18724_934eb02c7f7440a9b97932a3d6a66909.jpg'],
  [/\bkamilli viktoria\b/, 'f18724_82ec0f0190fc482fa2aa112d0fe1e884.jpg'],
  [/\bmarko fanni\b|^fanni$/, 'f18724_f9c0a8fd686f422482c6a443ea951b6d.jpg'],
  [/\bmester brigitta\b/, 'f18724_ceb9d9dee26d47738ddde803fd53e4a4.jpg'],
];
/** Biztosan budapesti-e a foglalás (a munkatárs alapján; Kamilli Viktória két helyszínen dolgozik: nem biztos). */
export const budapesti = (munkatars) => BP_MUNKATARS.some((re) => re.test(ekezetNelkul(munkatars)));
export function fotoUrl(munkatars) {
  const n = ekezetNelkul(munkatars);
  const t = n && FOTOK.find(([re]) => re.test(n));
  return t ? `/assets/img/${t[1]}` : null;
}
/** Olvasható szolgáltatásnév: "🔥 3 PIERCING - A HARMADIK 5.000 Ft!🔥" -> "3 db piercing (csomag)"; emoji és ár nélkül. */
export function szolgNev(nyers) {
  const n = ekezetNelkul(nyers);
  const csomag = /^([23]) piercing\b/.exec(n);
  if (csomag) return `${csomag[1]} db piercing (csomag)`;
  return String(nyers || '').replace(/[\p{Extended_Pictographic}‍️]+/gu, '').replace(/\s*-?\s*\d[\d.\s]*\s?Ft\b.*$/i, '').replace(/\s{2,}/g, ' ').trim();
}
export const munkatarsNev = (m) => String(m || '').replace(/\s+-\s*/g, '-').trim();
const latogatas = (nyers) => (/^[23] piercing\b|\b[2-6] db\b|szemelynek|\b1 1 db\b/.test(ekezetNelkul(nyers)) ? 'kb. 40–50 perc' : 'kb. 30–40 perc');
const HU_DATUM = new Intl.DateTimeFormat('hu-HU', { timeZone: 'Europe/Budapest', year: 'numeric', month: 'long', day: 'numeric', weekday: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
/** epoch mp -> { datum: "2026. október 23., csütörtök", ido: "14:30" } (budapesti idő) */
export function datumIdo(epoch) {
  const r = Object.fromEntries(HU_DATUM.formatToParts(new Date(epoch * 1000)).map((p) => [p.type, p.value]));
  return { datum: `${r.year}. ${r.month} ${r.day}., ${r.weekday}`, ido: `${r.hour}:${r.minute}` };
}

// ---- megjelenés -------------------------------------------------------------------------------------------------------------------------------
const CSS = `
@font-face{font-family:"Plus Jakarta Sans";font-style:normal;font-weight:400 800;font-display:swap;src:url(/assets/fonts/plus-jakarta-sans-latin-ext.woff2) format("woff2");unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C4,U+2113,U+2C60-2C7F,U+A720-A7FF}
@font-face{font-family:"Plus Jakarta Sans";font-style:normal;font-weight:400 800;font-display:swap;src:url(/assets/fonts/plus-jakarta-sans-latin.woff2) format("woff2");unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
:root{--sotet:#2f3044;--szoveg:#454659;--halk:#7a7b8e;--piros:#b0463b;--piros-h:#97392f;--krem:#f6ebe4;--krem-v:#fbf6f2;--vonal:#ecdcd4;--zold:#2f7a55;--zold-h:#e6f3ec}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--krem);color:var(--szoveg);font:400 16px/1.6 "Plus Jakarta Sans",Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;min-height:100vh;display:flex;flex-direction:column}
a{color:var(--piros)}
.fej{padding:18px 16px 6px;text-align:center}.fej img{width:168px;height:auto;display:inline-block}
main{width:100%;max-width:560px;margin:0 auto;padding:8px 16px 28px;flex:1 0 auto}
.cimke{margin:14px 0 4px;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--piros);text-align:center}
h1{margin:0 0 6px;font-size:27px;line-height:1.2;font-weight:800;letter-spacing:-.02em;color:var(--sotet);text-align:center}
.alcim{margin:0 auto 18px;max-width:420px;text-align:center;font-size:15px;color:var(--szoveg)}
.lap{background:#fff;border-radius:20px;box-shadow:0 1px 0 var(--vonal),0 14px 34px -18px rgba(47,48,68,.28);overflow:hidden}
.ido{background:var(--sotet);color:#fff;padding:20px 22px 18px;position:relative}
.ido .nap{font-size:15px;color:#d9d9e3;font-weight:500}
.ido .ora{display:block;margin-top:2px;font-size:40px;line-height:1.05;font-weight:800;letter-spacing:-.03em}
.allapot{position:absolute;top:18px;right:18px;font-size:12px;font-weight:700;padding:5px 10px;border-radius:999px;background:rgba(255,255,255,.12);color:#fff;letter-spacing:.02em}
.allapot.ok{background:var(--zold-h);color:var(--zold)}
.sorok{padding:6px 22px 4px}
.sor{display:flex;gap:14px;align-items:center;padding:13px 0;border-bottom:1px solid #f3e8e2}.sor:last-child{border-bottom:0}
.sor .c{flex:0 0 112px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--halk)}
.sor .e{flex:1;color:var(--sotet);font-weight:600;font-size:15.5px;line-height:1.45}
.sor .e small{display:block;font-weight:400;color:var(--szoveg);font-size:13.5px}
.szemely{display:flex;align-items:center;gap:10px}.szemely img{width:40px;height:40px;border-radius:50%;object-fit:cover;flex:0 0 40px}
.gombok{display:grid;gap:10px;padding:16px 22px 22px}
.gomb{display:flex;align-items:center;justify-content:center;gap:8px;min-height:52px;padding:14px 20px;border-radius:999px;font:700 16px/1.2 "Plus Jakarta Sans",Helvetica,Arial,sans-serif;text-decoration:none;border:0;cursor:pointer;width:100%}
.gomb.fo{background:var(--piros);color:#fff;box-shadow:0 8px 18px -10px rgba(176,70,59,.9)}.gomb.fo:hover{background:var(--piros-h)}
.gomb.masod{background:#fff;color:var(--piros);border:2px solid #e3c4bf}
.gomb.kesz{background:var(--zold-h);color:var(--zold);cursor:default}
details.modosit{margin:0}details.modosit>summary{list-style:none}details.modosit>summary::-webkit-details-marker{display:none}
details.modosit[open]>summary{border-color:var(--piros)}
.keret{margin-top:12px;border:1px solid var(--vonal);border-radius:16px;overflow:hidden;background:#fff;position:relative}
.keret iframe{display:block;width:100%;height:min(720px,calc(100dvh - 120px));min-height:520px;border:0;position:relative;z-index:1;background:transparent}
.keret .betolt{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--halk);font-size:14px}
.megj{margin:10px 2px 0;font-size:13.5px;color:var(--halk);text-align:center}
.info{margin-top:18px;display:grid;gap:12px}
.doboz{background:var(--krem-v);border:1px solid var(--vonal);border-radius:16px;padding:16px 18px;font-size:15px}
.doboz b{color:var(--sotet)}
.linkek{display:flex;flex-wrap:wrap;gap:8px 18px;margin-top:8px}.linkek a{font-weight:700;text-decoration:none}
.uzenet{background:#fff;border-radius:20px;padding:26px 22px;text-align:center;box-shadow:0 14px 34px -18px rgba(47,48,68,.28)}
.uzenet h2{margin:0 0 8px;font-size:22px;line-height:1.25;color:var(--sotet);font-weight:800}
.uzenet p{margin:0 0 14px}
.siker{display:flex;gap:10px;align-items:center;background:var(--zold-h);color:var(--zold);border-radius:14px;padding:12px 16px;margin:0 0 14px;font-weight:700;font-size:15px}
footer{padding:20px 16px 30px;text-align:center;font-size:13px;color:var(--halk);line-height:1.7}footer a{color:var(--halk)}
@media (min-width:700px){main{padding-top:18px}h1{font-size:32px}.ido{padding:24px 28px 22px}.sorok,.gombok{padding-left:28px;padding-right:28px}}
`;

function lap(cim, torzs, status = 200) {
  const html = `<!doctype html>
<html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="robots" content="noindex, nofollow"><meta name="referrer" content="origin">
<title>${esc(cim)} | Medical Piercing</title><meta name="theme-color" content="#f6ebe4"><link rel="preload" href="/assets/fonts/plus-jakarta-sans-latin.woff2" as="font" type="font/woff2" crossorigin><style>${CSS}</style></head>
<body><header class="fej"><a href="/" aria-label="Medical Piercing – főoldal"><img src="/assets/img/uj-logo.webp" width="327" height="97" alt="Medical Piercing"></a></header>
<main>${torzs}</main>
<footer>Medical Piercing · <a href="${TEL_HREF}">${TELEFON}</a> · <a href="mailto:${EMAIL}">${EMAIL}</a><br><a href="${SITE}">medicalpiercing.hu</a></footer></body></html>`;
  return new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow', 'referrer-policy': 'origin' } });
}

const hivas = `<p class="megj">Kérdésed van? Hívj minket: <a href="${TEL_HREF}"><b>${TELEFON}</b></a></p>`;

export function nemTalalhato() {
  return lap('Nem találom a foglalást', `<div class="cimke">A foglalásod</div><div class="uzenet"><h2>Nem találom ezt a foglalást</h2><p>Lehet, hogy a link elírással érkezett, vagy a foglalás már régi. Hívj minket, és segítünk – vagy foglalj új időpontot.</p>
<a class="gomb fo" href="/idopontfoglalas">Időpontot foglalok</a></div>${hivas}`, 404);
}

/**
 * @param {{ token:string, id?:string, allapot:string, kezdet:number, szolgaltatas:string, munkatars?:string, keresztnev?:string, megerositve?:number|null }} f
 * @param {{ friss?:boolean, minta?:boolean }} [opc]  friss: épp most erősítette meg (/m/); minta: a bemutató oldal
 */
export function foglalasOldal(f, opc = {}) {
  const { datum, ido } = datumIdo(f.kezdet);
  const nev = szolgNev(f.szolgaltatas);
  const munkatars = munkatarsNev(f.munkatars);
  const bp = budapesti(f.munkatars);
  const ujFoglalas = `<a class="gomb fo" href="/idopontfoglalas">Új időpontot foglalok</a>`;
  const rovid = `<div class="doboz" style="text-align:left"><b>${esc(nev)}</b><br>${esc(datum)}, ${esc(ido)}</div>`;
  if (f.allapot === 'lemondva') {
    return lap('A foglalásod', `<div class="cimke">A foglalásod</div><div class="uzenet"><h2>Ez az időpont le lett mondva</h2>${rovid}<p style="margin-top:14px">Ha csak az időpont nem volt jó, egy perc alatt választhatsz újat:</p>${ujFoglalas}</div>${hivas}`);
  }
  if (f.allapot === 'nem_jelent_meg') {
    return lap('A foglalásod', `<div class="cimke">A foglalásod</div><div class="uzenet"><h2>Nem találkoztunk ezen az időponton</h2>${rovid}<p style="margin-top:14px">Előfordul. Ha csak az időpont csúszott el, itt választhatsz újat:</p>${ujFoglalas}</div>${hivas}`);
  }
  const megerositve = !!f.megerositve;
  const mult = !opc.minta && f.kezdet * 1000 < Date.now();
  const foto = fotoUrl(f.munkatars);
  const sorok = [
    ['Szolgáltatás', esc(nev)],
    munkatars ? ['Szakember', `<span class="szemely">${foto ? `<img src="${esc(foto)}" alt="" width="40" height="40">` : ''}<span>${esc(munkatars)}</span></span>`] : null,
    bp ? ['Helyszín', `${esc(BP_CIM)}`] : null,
    ['Időtartam', esc(latogatas(f.szolgaltatas))],
  ].filter(Boolean).map(([c, e]) => `<div class="sor"><div class="c">${c}</div><div class="e">${e}</div></div>`).join('');
  const salonicUrl = f.id && UUID_RE.test(f.id) ? `https://${SALONIC_FIOK}.salonic.hu/booking/bookingDetails/${f.id}` : null;
  const ottLeszek = mult ? '' : megerositve
    ? `<span class="gomb kesz" role="status">✓ Megerősítetted – várunk!</span>`
    : `<a class="gomb fo" href="${opc.minta ? '#' : `/m/${esc(f.token)}`}">Ott leszek ✓</a>`;
  const modosit = mult ? '' : salonicUrl || opc.minta
    ? `<details class="modosit" id="modosit"><summary class="gomb masod">Időpont módosítása / lemondása</summary>
<div class="keret">${opc.minta ? '<p class="betolt" style="position:static;padding:40px 16px">Itt jelenik meg a foglalás módosítása / lemondása (a foglalási rendszerből).</p>' : `<p class="betolt">Betöltés…</p><iframe title="A foglalásod módosítása" data-src="${esc(salonicUrl)}"></iframe>`}</div>
<p class="megj">Vidéki helyszíneinken csak meghatározott napokon vagyunk: ha nem tudsz jönni, kérjük, minél előbb módosítsd – így a helyedet másnak is fel tudjuk ajánlani.</p></details>`
    : `<a class="gomb masod" href="${TEL_HREF}">Módosítás / lemondás: ${TELEFON}</a>`;
  const udv = f.keresztnev ? `${esc(f.keresztnev)}, várunk!` : 'Várunk!';
  const torzs = `<div class="cimke">A foglalásod</div>
<h1>${mult ? 'A foglalásod' : udv}</h1>
<p class="alcim">${mult ? 'Ez az időpont már elmúlt. Köszönjük, hogy nálunk jártál!' : 'Minden fontos részlet egy helyen. Ha minden rendben, egy kattintással jelezd, hogy jössz.'}</p>
${opc.friss ? '<div class="siker" role="status">✓ Köszönjük! Megerősítetted az időpontodat.</div>' : ''}
<section class="lap" aria-label="Az időpontod">
<div class="ido"><span class="nap">${esc(datum)}</span><span class="ora">${esc(ido)}</span>${megerositve ? '<span class="allapot ok">✓ Megerősítve</span>' : '<span class="allapot">Visszaigazolva</span>'}</div>
<div class="sorok">${sorok}</div>
<div class="gombok">${ottLeszek}${modosit}</div>
</section>
<div class="info">
${bp ? `<div class="doboz"><b>Hogyan találsz meg minket?</b><br>${esc(BP_ERKEZES)}<div class="linkek"><a href="${BP_TERKEP}" target="_blank" rel="noopener">Útvonaltervezés »</a><a href="${TEL_HREF}">Hívás: ${TELEFON}</a></div></div>` : `<div class="doboz"><b>Kérdésed van?</b><br>Hívj minket nyugodtan, vagy válaszolj a visszaigazoló levelünkre.<div class="linkek"><a href="${TEL_HREF}">Hívás: ${TELEFON}</a><a href="/elerhetosegek">Helyszíneink »</a></div></div>`}
<div class="doboz"><b>Mire figyelj?</b><br>Előtte egyél rendesen, és érkezz kb. 5 perccel korábban. Ha vérhígítót szedsz, várandós vagy, vagy a füled most gyulladt, szólj előre.</div>
</div>
<script>(function(){var d=document.getElementById('modosit');if(!d)return;d.addEventListener('toggle',function(){var f=d.querySelector('iframe[data-src]');if(d.open&&f){f.src=f.getAttribute('data-src');f.removeAttribute('data-src');f.addEventListener('load',function(){var b=d.querySelector('.betolt');if(b)b.style.display='none';});}});if(location.hash==='#modosit')d.open=true;})();</script>`;
  return lap(opc.minta ? 'A foglalásod (minta)' : 'A foglalásod', torzs);
}

/** A bemutató oldal mintaadatai (Feri kérése): adatbázis nélkül. */
export const MINTA = Object.freeze({
  token: 'minta', id: null, allapot: 'aktiv', keresztnev: 'Feri', szolgaltatas: '🔥 3 PIERCING - A HARMADIK 5.000 Ft!🔥', munkatars: 'Kovács Gabriella',
  kezdet: Math.floor(Date.UTC(2026, 9, 23, 12, 30) / 1000), // 2026. október 23., csütörtök 14:30 (budapesti idő)
  megerositve: null,
});

const SOR = 'SELECT id, uzletag, allapot, kezdet, szolgaltatas, munkatars, keresztnev, megerositve, token FROM foglalasok WHERE token = ?1 AND uzletag = ?2';

/** GET /f/<kód> és /m/<kód>. null: nem ez az útvonal (a hívó a statikus oldalakkal folytatja). */
export async function foglalasom(request, env) {
  const url = new URL(request.url);
  const m = /^\/(f|m)\/([^/]+)\/?$/.exec(url.pathname);
  if (!m) return null;
  const [, ut, kod] = m;
  if (ut === 'f' && kod === 'minta') return foglalasOldal(MINTA, { minta: true });
  if (!/^[0-9a-f]{10}$/.test(kod) || !env.LIFECYCLE_DB) return nemTalalhato();
  const db = env.LIFECYCLE_DB;
  let f;
  try { f = await db.prepare(SOR).bind(kod, 'mp').first(); } catch (e) { console.error('foglalasom: D1-hiba', e && e.message); return nemTalalhato(); }
  if (!f) return nemTalalhato();
  if (ut === 'm') {
    // egykattintásos megerősítés; a linkelőnézetet készítő robotok nem erősítenek meg
    if (request.method === 'GET' && !BOT.test(request.headers.get('user-agent') || '') && f.allapot === 'aktiv' && !f.megerositve) {
      const most = Math.floor(Date.now() / 1000);
      try {
        await db.prepare("UPDATE foglalasok SET megerositve = ?2 WHERE token = ?1 AND uzletag = 'mp' AND allapot = 'aktiv' AND megerositve IS NULL").bind(kod, most).run();
        f = { ...f, megerositve: most };
        return foglalasOldal(f, { friss: true });
      } catch (e) { console.error('foglalasom: megerosites D1-hiba', e && e.message); }
    }
    return foglalasOldal(f, { friss: !!f.megerositve && f.allapot === 'aktiv' });
  }
  return foglalasOldal(f);
}
