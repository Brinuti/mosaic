// "A foglalásod" oldal a Medical Piercing vendégeinek (az e-mailek / SMS-ek linkje: /f/<kód>, megerősítés: /m/<kód>).
// Az adat a foglalás -> megjelenés rendszer közös D1-adatbázisából jön (LIFECYCLE_DB; a rendszer a Mosaic-projektben fut: ../netlify/lib/lifecycle),
// de innen CSAK az uzletag = 'mp' sorok látszanak, és csak a megerősítés (megerositve) íródik. A Mosaic-oldalról NEM importálunk semmit
// (ez a projekt önállóan épül): a pár szükséges segéd (dátum, szolgáltatásnév, munkatárs-fotó, helyszín) itt külön van.
// /f/minta: bemutató oldal mintaadatokkal (adatbázis nélkül), hogy a dizájn foglalás nélkül is látható legyen.

import { szabadIdopontok, modosit as salonicModosit, lemond as salonicLemond } from './salonic-modosit.js';

const SITE = 'https://www.medicalpiercing.hu';
const TELEFON = '+36 1 901 7444';
const TEL_HREF = 'tel:+3619017444';
const EMAIL = 'medicalpiercing.hu@gmail.com';
const BP_CIM = '1137 Budapest, Újpesti rakpart 7., 5. emelet 25. (a Jászai Mari térnél)';
const BP_ERKEZES = 'A Jászai Mari térnél vagyunk, a környező utcákban könnyen meg tudsz állni autóval; villamossal a Jászai Mari tér megálló van a legközelebb.';
const BP_TERKEP = 'https://www.google.com/maps/search/?api=1&query=Medical+Piercing+1137+Budapest+%C3%9Ajpesti+rakpart+7';
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
.modosit{margin:0}
.gomb.masod{text-align:center}.gomb.masod[aria-expanded="true"]{border-color:var(--piros)}
.panel{margin-top:12px;border:1px solid var(--vonal);border-radius:16px;background:var(--krem-v);padding:14px}
.fulek{display:grid;grid-template-columns:1fr 1fr;gap:6px;background:#fff;border:1px solid var(--vonal);border-radius:999px;padding:4px}
.ful{min-height:44px;border:0;border-radius:999px;background:transparent;color:var(--szoveg);font:700 14px/1.2 "Plus Jakarta Sans",Helvetica,Arial,sans-serif;cursor:pointer;padding:8px 10px;text-align:center}
.ful[aria-selected="true"]{background:var(--sotet);color:#fff}
.resz{padding-top:14px}
.napsor{display:flex;align-items:center;gap:8px}
.nyil{flex:0 0 44px;height:44px;border-radius:50%;border:1px solid var(--vonal);background:#fff;color:var(--sotet);font:700 20px/1 "Plus Jakarta Sans",Helvetica,Arial,sans-serif;cursor:pointer}
.nyil:disabled{opacity:.35;cursor:default}
.napcim{flex:1;text-align:center;font-weight:800;color:var(--sotet);font-size:16px;line-height:1.3;min-width:0}
.napcim small{display:block;font-weight:500;color:var(--halk);font-size:12.5px}
.chipek{display:grid;grid-template-columns:repeat(auto-fill,minmax(76px,1fr));gap:8px;margin-top:12px}
.chip{min-height:44px;border-radius:12px;border:1px solid #e3c4bf;background:#fff;color:var(--sotet);font:700 15px/1 "Plus Jakarta Sans",Helvetica,Arial,sans-serif;cursor:pointer}
.chip:hover,.chip[aria-pressed="true"]{border-color:var(--piros);background:#fff3ef;color:var(--piros)}
.ures{margin:12px 0 0;text-align:center;color:var(--halk);font-size:14.5px}
.kerdes{margin-top:12px;background:#fff;border:1px solid var(--vonal);border-radius:14px;padding:14px;text-align:center}
.kerdes p{margin:0 0 12px;color:var(--sotet);font-weight:700}
.ketgomb{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.ketgomb .gomb{min-height:46px;padding:10px 12px;font-size:15px}
.gomb.halk{background:#fff;color:var(--szoveg);border:1px solid var(--vonal)}
.gomb.veszely{background:var(--piros);color:#fff}
.gomb[disabled]{opacity:.6;cursor:progress}
.hatarido{margin:10px 0 0;font-size:13px;color:var(--halk);text-align:center}
.visszajelzes{margin-top:12px;border-radius:14px;padding:12px 14px;font-weight:700;font-size:15px;text-align:center}
.visszajelzes.jo{background:var(--zold-h);color:var(--zold)}.visszajelzes.rossz{background:#fbe9e6;color:var(--piros-h)}
.visszajelzes a{font-weight:800}
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

// A módosítás / lemondás panel (böngésző). A /f/minta oldalon mintaadatokkal, szerverhívás nélkül.
const PANEL_JS = String.raw`(function(){
var d=document.getElementById('modosit');if(!d)return;
var $=function(i){return document.getElementById(i);};
var alap=d.getAttribute('data-alap'),minta=d.getAttribute('data-minta')==='1',tel=d.getAttribute('data-tel');
var gomb=$('mod-gomb'),panel=$('mod-panel'),fUj=$('ful-uj'),fLe=$('ful-le'),rUj=$('resz-uj'),rLe=$('resz-le'),cim=$('nap-cim'),elozo=$('nap-elozo'),kov=$('nap-kov'),chipek=$('chipek'),kerdes=$('mod-kerdes'),kSz=$('mod-kerdes-szoveg'),uzenet=$('mod-uzenet'),hatarido=$('hatarido');
var adat=null,valasztott=null,betoltve=false,fut=false;
var HIBA='Ez most nem sikerült. Kérjük, hívj minket: <a href="'+tel+'">+36 1 901 7444</a>';
function napDatum(nap){return new Date(nap+'T12:00:00Z');}
function fmt(nap,o){o.timeZone='UTC';return new Intl.DateTimeFormat('hu-HU',o).format(napDatum(nap));}
function rovid(nap,ido){return fmt(nap,{month:'short',day:'numeric'})+', '+ido;}
function hosszu(nap){var r={};new Intl.DateTimeFormat('hu-HU',{timeZone:'UTC',year:'numeric',month:'long',day:'numeric',weekday:'long'}).formatToParts(napDatum(nap)).forEach(function(x){r[x.type]=x.value;});return r.year+'. '+r.month+' '+r.day+'., '+r.weekday;}
function napCimke(nap){var t=fmt(nap,{month:'long',day:'numeric',weekday:'long'});return t;}
function plusz(nap,n){var x=napDatum(nap);x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10);}
function ma(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Budapest',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
function uz(html,jo){uzenet.innerHTML=html?'<div class="visszajelzes '+(jo?'jo':'rossz')+'">'+html+'</div>':'';}
// ---- mintaadatok (csak /f/minta) ----
function mintaNap(kert){var m=ma();if(!kert||kert<m)kert=m;var nap=kert;while(napDatum(nap).getUTCDay()===0)nap=plusz(nap,1);
 var l=[],o=['10:00','10:30','11:00','12:30','13:00','14:00','15:30','16:00','17:30','18:00'];for(var i=0;i<o.length;i++){if((i+napDatum(nap).getUTCDate())%3!==0)l.push({ido:o[i],start:Date.parse(nap+'T'+o[i]+':00Z')/1000});}
 return {nap:nap,napCimke:napCimke(nap),kert:kert,idopontok:l,elozo:kert>m?plusz(kert,-1):null,kovetkezo:plusz(nap,1),hatarido:'A foglalást legkésőbb 2026. október 22. 14:30-ig van lehetőséged lemondani.'};}
function kuld(ut,test){
 if(minta)return new Promise(function(ok){setTimeout(function(){ok(ut==='modosit'?{ok:true,uj:test.start}:{ok:true});},500);});
 return fetch(alap+'/'+ut,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(test),credentials:'same-origin'}).then(function(r){return r.json().catch(function(){return {ok:false};});});}
function tolt(nap){
 kerdes.hidden=true;valasztott=null;cim.textContent='Betöltés…';chipek.innerHTML='';elozo.disabled=kov.disabled=true;
 var p=minta?Promise.resolve(mintaNap(nap)):fetch(alap+'/idopontok'+(nap?'?nap='+nap:''),{credentials:'same-origin'}).then(function(r){if(!r.ok)throw 0;return r.json();});
 p.then(function(a){adat=a;rajzol();}).catch(function(){cim.textContent='';uz(HIBA,false);});}
function rajzol(){
 var a=adat;cim.innerHTML=a.napCimke+(a.kert&&a.kert!==a.nap?'<small>'+napCimke(a.kert)+' nincs szabad időpont</small>':'');
 elozo.disabled=!a.elozo;kov.disabled=!a.kovetkezo;chipek.innerHTML='';
 if(a.hatarido){hatarido.textContent=a.hatarido;hatarido.hidden=false;}
 if(!a.idopontok.length){chipek.innerHTML='<p class="ures" style="grid-column:1/-1">Erre a napra nincs szabad időpont. Lapozz a következő napra.</p>';return;}
 a.idopontok.forEach(function(x){var b=document.createElement('button');b.type='button';b.className='chip';b.textContent=x.ido;b.setAttribute('aria-pressed','false');b.setAttribute('aria-label',a.napCimke+', '+x.ido);
  b.onclick=function(){var r=chipek.querySelectorAll('.chip');for(var i=0;i<r.length;i++)r[i].setAttribute('aria-pressed','false');b.setAttribute('aria-pressed','true');valasztott={nap:a.nap,ido:x.ido,start:x.start};kSz.textContent='Biztosan erre módosítod: '+rovid(a.nap,x.ido)+'?';kerdes.hidden=false;uz('');$('mod-igen').focus();};
  chipek.appendChild(b);});}
function fulre(uj){fUj.setAttribute('aria-selected',uj?'true':'false');fLe.setAttribute('aria-selected',uj?'false':'true');fUj.tabIndex=uj?0:-1;fLe.tabIndex=uj?-1:0;rUj.hidden=!uj;rLe.hidden=uj;uz('');}
gomb.onclick=function(){var nyit=panel.hidden;panel.hidden=!nyit;gomb.setAttribute('aria-expanded',nyit?'true':'false');if(nyit&&!betoltve){betoltve=true;tolt('');}};
fUj.onclick=function(){fulre(true);};fLe.onclick=function(){fulre(false);};
fUj.onkeydown=fLe.onkeydown=function(e){if(e.key==='ArrowRight'||e.key==='ArrowLeft'){var uj=this===fLe;fulre(uj);(uj?fUj:fLe).focus();}};
elozo.onclick=function(){if(adat&&adat.elozo)tolt(adat.elozo);};kov.onclick=function(){if(adat&&adat.kovetkezo)tolt(adat.kovetkezo);};
$('mod-megse').onclick=function(){kerdes.hidden=true;var r=chipek.querySelectorAll('.chip');for(var i=0;i<r.length;i++)r[i].setAttribute('aria-pressed','false');};
$('mod-igen').onclick=function(){if(fut||!valasztott)return;fut=true;var b=this,v=valasztott;b.disabled=true;b.textContent='Módosítás…';
 kuld('modosit',{start:v.start}).then(function(r){fut=false;b.disabled=false;b.textContent='Igen';
  if(r&&r.ok){$('kartya-nap').textContent=hosszu(v.nap);$('kartya-ora').textContent=v.ido;kerdes.hidden=true;chipek.innerHTML='';rUj.querySelector('.napsor').hidden=true;
   uz('✓ Módosítottuk: '+hosszu(v.nap)+', '+v.ido+'. A visszaigazolást e-mailben is megkapod.',true);}
  else uz(r&&r.hiba==='nem_szabad'?'Ezt az időpontot közben már lefoglalták. Kérjük, válassz másikat.':HIBA,false);
  if(r&&r.hiba==='nem_szabad')tolt(v.nap);
 }).catch(function(){fut=false;b.disabled=false;b.textContent='Igen';uz(HIBA,false);});};
$('le-megse').onclick=function(){fulre(true);};
$('le-igen').onclick=function(){if(fut)return;fut=true;var b=this;b.disabled=true;b.textContent='Lemondás…';
 kuld('lemond',{biztos:true}).then(function(r){fut=false;b.disabled=false;b.textContent='Igen, lemondom';
  if(r&&r.ok){panel.innerHTML='<div class="visszajelzes jo">✓ Lemondtuk az időpontodat.</div><p class="megj">Ha mégis jönnél, egy perc alatt foglalhatsz újat: <a href="https://www.medicalpiercing.hu/idopontfoglalas"><b>Új időpontot foglalok</b></a></p>';gomb.hidden=true;var o=$('ottleszek');if(o)o.hidden=true;}
  else uz(HIBA,false);
 }).catch(function(){fut=false;b.disabled=false;b.textContent='Igen, lemondom';uz(HIBA,false);});};
if(location.hash==='#modosit')gomb.click();
})();`;

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
  const lehetModosit = opc.minta || (f.id && UUID_RE.test(f.id) && f.allapot === 'aktiv');
  const ottLeszek = mult ? '' : megerositve
    ? `<span class="gomb kesz" role="status">✓ Megerősítetted – várunk!</span>`
    : `<a class="gomb fo" id="ottleszek" href="${opc.minta ? '#' : `/m/${esc(f.token)}`}">Ott leszek ✓</a>`;
  const modosit = mult ? '' : lehetModosit
    ? `<div class="modosit" id="modosit" data-alap="/f/${esc(f.token)}"${opc.minta ? ' data-minta="1"' : ''} data-tel="${TEL_HREF}">
<button type="button" class="gomb masod" id="mod-gomb" aria-expanded="false" aria-controls="mod-panel">Időpont módosítása / lemondása</button>
<div class="panel" id="mod-panel" hidden>
<div class="fulek" role="tablist" aria-label="Mit szeretnél?"><button type="button" class="ful" role="tab" id="ful-uj" aria-controls="resz-uj" aria-selected="true">Másik időpontot választok</button><button type="button" class="ful" role="tab" id="ful-le" aria-controls="resz-le" aria-selected="false" tabindex="-1">Lemondom</button></div>
<div class="resz" id="resz-uj" role="tabpanel" aria-labelledby="ful-uj">
<div class="napsor"><button type="button" class="nyil" id="nap-elozo" aria-label="Előző nap">‹</button><div class="napcim" id="nap-cim" aria-live="polite">Betöltés…</div><button type="button" class="nyil" id="nap-kov" aria-label="Következő nap">›</button></div>
<div class="chipek" id="chipek" role="group" aria-label="Szabad időpontok"></div>
<div class="kerdes" id="mod-kerdes" hidden><p id="mod-kerdes-szoveg"></p><div class="ketgomb"><button type="button" class="gomb fo" id="mod-igen">Igen</button><button type="button" class="gomb halk" id="mod-megse">Mégse</button></div></div>
</div>
<div class="resz" id="resz-le" role="tabpanel" aria-labelledby="ful-le" hidden>
<div class="kerdes" style="margin-top:0"><p>Biztosan lemondod? Ha csak az időpont nem jó, inkább válassz másikat.</p><div class="ketgomb"><button type="button" class="gomb veszely" id="le-igen">Igen, lemondom</button><button type="button" class="gomb halk" id="le-megse">Mégse</button></div></div>
</div>
<p class="hatarido" id="hatarido" hidden></p>
<div id="mod-uzenet" role="status" aria-live="polite"></div>
</div>
<p class="megj">Vidéki helyszíneinken csak meghatározott napokon vagyunk: ha nem tudsz jönni, kérjük, minél előbb módosítsd – így a helyedet másnak is fel tudjuk ajánlani.</p></div>`
    : `<a class="gomb masod" href="${TEL_HREF}">Módosítás / lemondás: ${TELEFON}</a>`;
  const udv = f.keresztnev ? `${esc(f.keresztnev)}, várunk!` : 'Várunk!';
  const torzs = `<div class="cimke">A foglalásod</div>
<h1>${mult ? 'A foglalásod' : udv}</h1>
<p class="alcim">${mult ? 'Ez az időpont már elmúlt. Köszönjük, hogy nálunk jártál!' : 'Minden fontos részlet egy helyen. Ha minden rendben, egy kattintással jelezd, hogy jössz.'}</p>
${opc.friss ? '<div class="siker" role="status">✓ Köszönjük! Megerősítetted az időpontodat.</div>' : ''}
<section class="lap" aria-label="Az időpontod">
<div class="ido"><span class="nap" id="kartya-nap">${esc(datum)}</span><span class="ora" id="kartya-ora">${esc(ido)}</span>${megerositve ? '<span class="allapot ok">✓ Megerősítve</span>' : '<span class="allapot">Visszaigazolva</span>'}</div>
<div class="sorok">${sorok}</div>
<div class="gombok">${ottLeszek}${modosit}</div>
</section>
<div class="info">
${bp ? `<div class="doboz"><b>Hogyan találsz meg minket?</b><br>${esc(BP_ERKEZES)}<div class="linkek"><a href="${BP_TERKEP}" target="_blank" rel="noopener">Útvonaltervezés »</a><a href="${TEL_HREF}">Hívás: ${TELEFON}</a></div></div>` : `<div class="doboz"><b>Kérdésed van?</b><br>Hívj minket nyugodtan, vagy válaszolj a visszaigazoló levelünkre.<div class="linkek"><a href="${TEL_HREF}">Hívás: ${TELEFON}</a><a href="/elerhetosegek">Helyszíneink »</a></div></div>`}
<div class="doboz"><b>Mire figyelj?</b><br>Előtte egyél rendesen, és érkezz kb. 5 perccel korábban. Ha vérhígítót szedsz, várandós vagy, vagy a füled most gyulladt, szólj előre.</div>
</div>
${!mult && lehetModosit ? `<script>${PANEL_JS}</script>` : ''}`;
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

// ---- módosítás / lemondás (a panel hívásai) --------------------------------------------------------------------------------------------------
// GET  /f/<kód>/idopontok?nap=YYYY-MM-DD -> { nap, napCimke, kert, idopontok:[{ido,start}], elozo, kovetkezo, hatarido }
// POST /f/<kód>/modosit {start}          -> { ok:true, uj } | { ok:false, hiba }
// POST /f/<kód>/lemond  {biztos:true}    -> { ok:true }     | { ok:false, hiba }
// A Salonic-címek és a foglalás-azonosító nem jutnak ki a böngészőbe. A D1-be nem írunk (lásd lib/salonic-modosit.js).
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' } });
const ENGEDETT_HOST = /^(www\.medicalpiercing\.hu|[a-z0-9-]+\.medicalpiercing(-[a-z0-9]+)?\.pages\.dev|medicalpiercing(-[a-z0-9]+)?\.pages\.dev|localhost|127\.0\.0\.1)$/;
const UTOLSO = new Map(); // kód -> utolsó művelet ideje (ms); izolátumonként, legjobb igyekezettel
const VARAKOZAS_MS = 10000;
/** Azonos webhelyről jön-e a POST (Origin, ennek hiányában Referer). */
export function sajatOldalrol(request) {
  const sajat = new URL(request.url).hostname;
  if (!ENGEDETT_HOST.test(sajat)) return false;
  const forras = request.headers.get('origin') || request.headers.get('referer');
  if (!forras) return false;
  try { return new URL(forras).hostname === sajat; } catch { return false; }
}

/** null: nem ez az útvonal. */
export async function foglalasMuvelet(request, env, fetchFn = fetch, most = Math.floor(Date.now() / 1000)) {
  const url = new URL(request.url);
  const m = /^\/f\/([0-9a-f]{10})\/(idopontok|modosit|lemond)\/?$/.exec(url.pathname);
  if (!m) return null;
  const [, kod, muvelet] = m;
  const post = muvelet !== 'idopontok';
  if (request.method !== (post ? 'POST' : 'GET')) return json({ ok: false, hiba: 'metodus' }, 405);
  const ua = request.headers.get('user-agent') || '';
  if (post && (!ua || BOT.test(ua))) return json({ ok: false, hiba: 'robot' }, 403);
  if (post && !sajatOldalrol(request)) { console.log('foglalasom: idegen oldalrol jott POST'); return json({ ok: false, hiba: 'forras' }, 403); }
  if (!env.LIFECYCLE_DB) return json({ ok: false, hiba: 'nincs_db' }, 503);
  let f;
  try { f = await env.LIFECYCLE_DB.prepare('SELECT id, allapot, kezdet FROM foglalasok WHERE token = ?1 AND uzletag = ?2').bind(kod, 'mp').first(); } catch (e) { console.error('foglalasom: D1-hiba', e && e.message); return json({ ok: false, hiba: 'db' }, 503); }
  if (!f || !UUID_RE.test(f.id || '')) return json({ ok: false, hiba: 'nincs' }, 404);
  if (f.allapot !== 'aktiv' || !(f.kezdet > most)) return json({ ok: false, hiba: 'nem_modosithato' }, 409);
  try {
    if (!post) return json(await szabadIdopontok(fetchFn, f.id, url.searchParams.get('nap') || '', most));
    const ido = Date.now();
    if (ido - (UTOLSO.get(kod) || 0) < VARAKOZAS_MS) return json({ ok: false, hiba: 'tul_gyors' }, 429);
    UTOLSO.set(kod, ido);
    if (UTOLSO.size > 5000) UTOLSO.clear();
    let test = {};
    try { test = await request.json(); } catch { /* üres test */ }
    if (muvelet === 'modosit') {
      const start = Number(test && test.start);
      if (start === f.kezdet) return json({ ok: false, hiba: 'ugyanaz' }, 400);
      const v = await salonicModosit(fetchFn, f.id, start, most);
      return json(v, v.ok ? 200 : v.hiba === 'nem_szabad' || v.hiba === 'ervenytelen_idopont' ? 409 : 502);
    }
    if (!test || test.biztos !== true) return json({ ok: false, hiba: 'megerosites_kell' }, 400);
    const v = await salonicLemond(fetchFn, f.id);
    return json(v, v.ok ? 200 : 502);
  } catch (e) {
    console.error('foglalasom: Salonic-hiba', muvelet, e && e.message);
    return json({ ok: false, hiba: 'salonic' }, 502);
  }
}
