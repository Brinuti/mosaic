// A tulajdonosi attekinto oldal (SMS-lista) legyartasa: _tmp/sms-adat.json + ket kepernyokep -> egyetlen HTML
import fs from 'node:fs';
const KIMENET = process.argv[2];
const sorok = JSON.parse(fs.readFileSync('_tmp/sms-adat.json', 'utf8'));
const kep = (f, tipus = 'jpeg') => `data:image/${tipus};base64,` + fs.readFileSync(f).toString('base64');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const linkesit = (s) => esc(s).replace(/(https?:\/\/[^\s<]+?)(?=[.,]?(?:\s|$))/g, '<span class="link">$1</span>');
const sablonSzin = (s) => esc(s).replace(/\{([^{}]+)\}/g, '<span class="hely">{$1}</span>').replace(/(https?:\/\/[^\s<{]+)/g, '<span class="link">$1</span>');
const FT = 17;
const CIMKE = { t0: ['Azonnal', 'azonnal'], t72: ['72 óra előtt', 'ido'], t24: ['24 óra előtt', 'ido'], lemondva: ['Lemondáskor', 'azonnal'], athelyezve: ['Áthelyezéskor', 'azonnal'], nem_jelent_meg: ['Nem jelent meg', 'idoz'] };
const SORREND = ['headspa', 'hair', 'oxygen', 'laser', 'pmu', 'kozos'];
const NEV = { headspa: 'Head Spa', hair: 'Fodrász (MOSAIC Hair)', oxygen: 'Oxigénterápia', laser: 'Lézeres szőrtelenítés', pmu: 'PMU (sminktetoválás)', kozos: 'Minden üzletágra közös' };

const szekciok = SORREND.map((u) => {
  const lista = sorok.filter((s) => s.uzletag === u);
  const sorokHtml = lista.map((s) => {
    const [cimke, osztaly] = CIMKE[s.tipus] || [s.tipus, 'ido'];
    const rovid = s.mikor.split('. ')[0].replace(/\.$/, '');
    const reszlet = s.mikor.includes('. ') ? s.mikor.slice(s.mikor.indexOf('. ') + 2) : '';
    return `<tr id="${esc(s.id)}">
  <th scope="row" class="c-id"><code>${esc(s.id)}</code></th>
  <td class="c-mikor"><span class="cimke ${osztaly}">${esc(cimke)}</span><span class="kicsi">${esc(s.tipus === 't0' ? rovid : s.tipus === 'nem_jelent_meg' ? s.mikor : (rovid + (reszlet ? '. ' + reszlet : '')))}</span></td>
  <td class="c-kinek"><span class="kicsi tag">Kinek</span>${esc(s.kinek)}</td>
  <td class="c-szoveg"><div class="sms"><span class="pelda">${linkesit(s.pelda)}</span><span class="sablon">${sablonSzin(s.sablon)}</span></div></td>
  <td class="c-hossz"><span class="szam">${s.karakter}</span> karakter<br><span class="szam">${s.szegmens}</span> szegmens<br><span class="kicsi">≈ ${s.szegmens * FT} Ft</span></td>
</tr>`;
  }).join('\n');
  return `<section class="uzlet" id="u-${u}">
<h2>${NEV[u]} <span class="db">${lista.length} SMS</span></h2>
<div class="tabla"><table>
<thead><tr><th>Azonosító</th><th>Mikor megy ki</th><th>Kinek</th><th>Szöveg</th><th>Hossz</th></tr></thead>
<tbody>
${sorokHtml}
</tbody></table></div>
</section>`;
}).join('\n');

const html = `<title>MOSAIC SMS-lista</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,500;6..72,600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
/* Elrendezes: egy hosszu, gorgetheto attekinto lap; felul a szabalyok es a modositas-link oldala, alatta uzletagonkent egy tabla (azonosito, mikor, kinek, szoveg, hossz). */
:root {
  --bg: #f3f6f5; --panel: #ffffff; --fg: #17302f; --muted: #5d7170; --line: #d6e0de;
  --teal: #0f3a3c; --teal-soft: #dcebe8; --gold: #9a7a1f; --gold-soft: #f3e9c8;
  --sms-bg: #e6f1ee; --link: #0b5c8a; --hely: #8a4b00; --hely-bg: #fbeed8; --off-bg: #eceeee; --warn: #8a2f1b; --warn-bg: #fbe6e1;
  --display: 'Newsreader', Georgia, 'Times New Roman', serif; --body: 'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif; --mono: 'IBM Plex Mono', ui-monospace, Consolas, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #0e1717; --panel: #152322; --fg: #e3eeec; --muted: #9db3b0; --line: #284240;
  --teal: #7ec3b8; --teal-soft: #1b3836; --gold: #d9b84f; --gold-soft: #3a3115;
  --sms-bg: #1d3a37; --link: #7cc4ee; --hely: #f1b866; --hely-bg: #3d2d12; --off-bg: #1c2828; --warn: #f0a190; --warn-bg: #3b1d17; color-scheme: dark; } }
:root[data-theme="dark"] {
  --bg: #0e1717; --panel: #152322; --fg: #e3eeec; --muted: #9db3b0; --line: #284240;
  --teal: #7ec3b8; --teal-soft: #1b3836; --gold: #d9b84f; --gold-soft: #3a3115;
  --sms-bg: #1d3a37; --link: #7cc4ee; --hely: #f1b866; --hely-bg: #3d2d12; --off-bg: #1c2828; --warn: #f0a190; --warn-bg: #3b1d17; color-scheme: dark; }
* { box-sizing: border-box; }
body { background: var(--bg); color: var(--fg); font: 15px/1.55 var(--body); padding-inline: max(16px, 4vw); padding-block: 28px 64px; }
.lap { max-width: 1120px; margin-inline: auto; display: grid; gap: 36px; min-width: 0; }
h1 { font: 600 clamp(28px, 5vw, 40px)/1.1 var(--display); color: var(--teal); margin: 0 0 8px; text-wrap: balance; }
h2 { font: 600 24px/1.2 var(--display); color: var(--teal); margin: 0 0 12px; display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: baseline; text-wrap: balance; }
h3 { font: 600 16px/1.3 var(--body); margin: 0 0 6px; }
p { margin: 0 0 10px; max-width: 68ch; }
.db { font: 500 12px/1 var(--body); letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
.bevezeto { color: var(--muted); }
code, .link, .hely { font-family: var(--mono); }
.rend { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
.kapcsolo { display: inline-flex; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; background: var(--panel); }
.kapcsolo button { font: 500 14px var(--body); padding: 9px 14px; border: 0; background: transparent; color: var(--fg); cursor: pointer; }
.kapcsolo button[aria-pressed="true"] { background: var(--teal); color: var(--bg); }
.kapcsolo button:focus-visible, a:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
.dobozok { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; }
.doboz { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 16px 18px; min-width: 0; }
.doboz ul { margin: 0; padding-left: 18px; } .doboz li { margin-bottom: 4px; }
.figyelem { background: var(--gold-soft); border: 1px solid var(--gold); border-radius: 10px; padding: 14px 18px; }
.hibas { background: var(--warn-bg); border-color: var(--warn); }
.modositas { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 20px; align-items: start; }
.modositas figure { margin: 0; background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 14px; display: grid; gap: 10px; min-width: 0; }
.modositas img { width: 100%; max-width: 360px; height: auto; margin-inline: auto; display: block; border: 1px solid var(--line); border-radius: 8px; }
figcaption { font-size: 14px; } figcaption b { display: block; margin-bottom: 2px; }
.lanc { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; font-size: 14px; margin-bottom: 14px; }
.lanc .lepes { background: var(--teal-soft); border-radius: 6px; padding: 6px 10px; } .lanc .nyil { color: var(--muted); }
.link { color: var(--link); overflow-wrap: anywhere; } .hely { color: var(--hely); background: var(--hely-bg); border-radius: 3px; padding: 0 3px; }
a { color: var(--link); }
.tabla { overflow-x: auto; border: 1px solid var(--line); border-radius: 10px; background: var(--panel); }
table { border-collapse: collapse; width: 100%; min-width: 860px; }
th, td { text-align: left; vertical-align: top; padding: 12px 14px; border-bottom: 1px solid var(--line); font-weight: 400; }
thead th { font: 600 12px/1.2 var(--body); letter-spacing: .06em; text-transform: uppercase; color: var(--muted); background: var(--teal-soft); position: sticky; top: 0; }
tbody tr:last-child > * { border-bottom: 0; }
.c-id { width: 112px; } .c-id code { font-size: 13px; font-weight: 500; }
.c-mikor { width: 230px; } .c-kinek { width: 150px; } .c-hossz { width: 110px; font-size: 14px; white-space: nowrap; }
.tag { display: none; }
.kicsi { display: block; font-size: 13px; color: var(--muted); margin-top: 4px; }
.cimke { display: inline-block; font: 600 13px/1 var(--body); padding: 5px 9px; border-radius: 999px; background: var(--teal-soft); color: var(--teal); }
.cimke.azonnal { background: var(--gold-soft); color: var(--gold); } .cimke.idoz { background: var(--warn-bg); color: var(--warn); }
.sms { background: var(--sms-bg); border-radius: 14px 14px 14px 4px; padding: 10px 14px; max-width: 62ch; overflow-wrap: anywhere; }
.sms.ki { background: var(--off-bg); opacity: .8; }
.szam { font-variant-numeric: tabular-nums; font-weight: 600; }
.sablon { display: none; } .mod-sablon .sablon { display: inline; } .mod-sablon .pelda { display: none; }
.jegyzet { color: var(--muted); font-size: 14px; }
@media (max-width: 760px) {
  .modositas { grid-template-columns: 1fr; }
  table, tbody, tr, th, td { display: block; min-width: 0; width: auto; }
  .tabla { overflow-x: visible; } thead { display: none; }
  tbody tr { padding: 14px; border-bottom: 1px solid var(--line); display: grid; gap: 8px; }
  th, td { padding: 0; border: 0; } .c-id, .c-mikor, .c-kinek, .c-hossz { width: auto; }
  .tag { display: inline; margin-right: 6px; } .c-kinek .tag { display: inline; } .c-hossz { white-space: normal; }
}
@media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto !important; } }
</style>
<main class="lap" id="lap">
<header>
  <h1>MOSAIC SMS-lista</h1>
  <p class="bevezeto">Az összes SMS, ami a foglalás utáni láncban kimehet: ${sorok.length} szövegváltozat, 5 üzletágra és a közös üzenetekre. A szövegek a rendszerből vannak kigyűjtve, egy mintavendéggel kitöltve (Réka, 2026. november 25., szerda, 16:00). Árat vagy akciót egyik SMS sem tartalmaz.</p>
  <div class="rend">
    <div class="kapcsolo" role="group" aria-label="Szöveg nézete">
      <button type="button" id="gomb-pelda" aria-pressed="true">Kitöltött példa</button>
      <button type="button" id="gomb-sablon" aria-pressed="false">Sablon helyőrzőkkel</button>
    </div>
    <span class="jegyzet">A <span class="hely">{helyőrző}</span> a vendég adataival töltődik ki.</span>
  </div>
</header>

<section aria-labelledby="mikor-h">
  <h2 id="mikor-h">Mikor megy ki egy SMS?</h2>
  <div class="dobozok">
    <div class="doboz"><h3>Mennyi idő van az időpontig a foglaláskor?</h3>
      <ul><li><b>Kevesebb mint 30 órával az időpont előtt:</b> csak az azonnali SMS (T0).</li>
      <li><b>30–96 óra:</b> azonnali SMS + a másnapi (T-24).</li>
      <li><b>96 óra vagy több:</b> azonnali + T-72 (megerősítés) + T-24.</li></ul></div>
    <div class="doboz"><h3>Napszak</h3>
      <p>SMS csak <b>8:00 és 20:30 között</b> megy. Ami éjjelre esne, a legközelebbi ablak szélére kerül (a T-24 például reggel 8-kor).</p>
      <p>Az azonnali SMS (T0) rögtön megy. Ha valamiért 12 óránál többet késne, már nem küldjük ki.</p></div>
    <div class="doboz"><h3>Megerősítés, lemondás, áthelyezés</h3>
      <ul><li>Ha a vendég a T-72 SMS linkjén megerősíti az időpontot, a T-72 SMS nem megy, a T-24 igen.</li>
      <li>Lemondáskor minden függő SMS törlődik, és azonnal kimegy a lemondás-visszaigazolás.</li>
      <li>Áthelyezéskor az új időponthoz újraszámolódnak a T-72 / T-24 SMS-ek, és kimegy az „új időpontod” SMS.</li></ul></div>
    <div class="doboz"><h3>Költség</h3>
      <p>Az ékezetes SMS 70 karakterenként (összefűzve 67) egy szegmens, szegmensenként kb. <b>${FT} Ft</b>. A hosszú szövegek 3–5 szegmensesek, egy teljes lánc vendégenként nagyjából 200–250 Ft.</p></div>
  </div>
</section>

<section aria-labelledby="mod-h">
  <h2 id="mod-h">Hová visz a „Részletek / módosítás” link?</h2>
  <p>A saját oldalunkra: <b>„A foglalásod”</b>. Ebbe van beágyazva a Salonic oldala (mint a foglaló-motorban), a mi arculatunkkal, mobilra formázva. A vendég nem kerül ki a Salonicra.</p>
  <div class="lanc" aria-label="A link útja"><span class="lepes">SMS: <span class="link">mosaicheadspa.hu/f/&lt;kód&gt;</span></span><span class="nyil">→</span><span class="lepes">A foglalásod (a mi oldalunk)</span><span class="nyil">→</span><span class="lepes">benne a vendég foglalása: módosítás / lemondás</span><span class="nyil">→</span><span class="lepes">alatta: Új időpontot foglalok, telefon</span></div>
  <div class="modositas">
    <figure><img src="${kep('_tmp/hs2-1-reszletek.png', 'png')}" alt="A Salonic Időpont részletek oldala telefonon: Visszaigazolt, az időpont adatai, Foglalás módosítása és Lemondom gombok" width="585" height="1530">
      <figcaption><b>1. Az SMS-linkre ez az oldal nyílik meg</b>A mi fejlécünk, alatta a vendég foglalása két gombbal: „Foglalás módosítása” és „Lemondom”, végül „Új időpontot foglalok”. A Salonic menüje, főoldal-linkje és fiók-reklámja nem látszik.</figcaption></figure>
    <figure><img src="${kep('_tmp/hs2-2-modositas.png', 'png')}" alt="A Salonic időpont-választó oldala: naptár és szabad időpontok" width="585" height="1266">
      <figcaption><b>2. A „Foglalás módosítása” gomb után</b>Ugyanazon az oldalunkon belül az új időpont-választó nyílik. A foglalás addig érvényben marad, amíg a vendég új időpontot nem választ és meg nem erősíti. A Salonic egy foglalást csak egyszer enged módosítani, utána csak lemondás marad.</figcaption></figure>
  </div>
  <p class="jegyzet">Élő próbafoglalásokon kipróbálható (az előnézeten a Salonic-oldal még a régi, nem mobilra formázott kinézetű, mert a formázó CSS az élesítéssel áll át): <a href="https://claude-lifecycle-motor.mosaic-d77.pages.dev/f/91d1c12cfa" target="_blank" rel="noopener">HeadSpa, október 21., 17:30</a> · <a href="https://claude-lifecycle-motor.mosaic-d77.pages.dev/f/9890ca21a7" target="_blank" rel="noopener">PMU, október 31., 19:30</a>. Éles üzemben a link <span class="link">https://www.mosaicheadspa.hu/f/&lt;kód&gt;</span> alakú lesz. A próbafoglalásokat a végén lemondom.</p>
  <div class="figyelem hibas" style="margin-top:12px"><b>Miért írta korábban, hogy „Időpont törölve”?</b> A korábbi próba-SMS-ek linkjei olyan próbafoglalásokra mutattak, amelyeket a próbák végén én mondtam le. Egy lemondott foglalás linkjén a Salonic mindig az „Időpont törölve!” oldalt mutatja. A „Foglalás módosítása” gomb nem töröl: élő foglaláson ezt mobilon és gépen is kipróbáltam.</div>
</section>

${szekciok}

<p class="jegyzet">A no-show SMS-t a rendszer a Salonic lemondás-értesítőjéből ismeri fel: ha a szalon az időpont után kitörli a foglalást, vagy a lemondás okaként azt írja, hogy „nem jelent meg”. Az SMS mellett az e-mailek és a belső hívási feladatok (a szalonnak szóló levelek, kit érdemes hívni) külön listán vannak.</p>
</main>
<script>
(function () {
  var lap = document.getElementById('lap'), a = document.getElementById('gomb-pelda'), b = document.getElementById('gomb-sablon');
  function mod(sablon) { lap.classList.toggle('mod-sablon', sablon); a.setAttribute('aria-pressed', String(!sablon)); b.setAttribute('aria-pressed', String(sablon)); }
  a.addEventListener('click', function () { mod(false); }); b.addEventListener('click', function () { mod(true); });
})();
</script>`;
fs.writeFileSync(KIMENET, html);
console.log('kesz', KIMENET, (html.length / 1024).toFixed(0) + ' KB');
