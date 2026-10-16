// A GYIK oldal (/uj/akupunkturas-piercing-tudastar-video, a menuben "GYIK"): a 33 leggyakoribb kerdes temak szerint csoportositva, lenyithato
// kerdesekkel (a tulajdonos kerese, 2026-10-16: "a GYIK-et behanytad szovegkent, ez vicc"). A kerdesek es valaszok az eredeti oldalrol
// (uj-oldalak/tartalom/akupunkturas-piercing-tudastar-video.json); az ekszer anyagarol szolo ket valasz a mostani kinalat szerint (G23 titanium).
//
//   node tools/uj-gyik.mjs   ->  uj-oldalak/sajat/akupunkturas-piercing-tudastar-video.html
import fs from 'node:fs';
import path from 'node:path';
const ROOT = new URL('..', import.meta.url).pathname;
const IK = (n, o = '') => `<svg class="ik${o ? ' ' + o : ''}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const adat = JSON.parse(fs.readFileSync(path.join(ROOT, 'uj-oldalak/tartalom/akupunkturas-piercing-tudastar-video.json'), 'utf8'));

// a bekezdesek (a fa sorrendjeben)
const ps = [];
const jar = (n) => { if (n.t === 'p') ps.push(n.html); (n.k || []).forEach(jar); };
jar(adat.szekciok[0].fa);
// a kerdes-valasz parok: "<strong>N. kerdes</strong><br>valasz"; ha a valasz ures, a kovetkezo bekezdes a valasz; egy bekezdesben tobb kerdes is lehet
const kerdesek = new Map();
const tisztit = (h) => h.replace(/<br>\s*\n?\s*<br>/g, '</p><p>').replace(/<br>\s*\n?/g, ' ').replace(/\s{2,}/g, ' ').trim();
for (let i = 0; i < ps.length; i++) {
  const reszek = ps[i].split(/(?:<br>\s*\n?)?(?=<strong>\s*\d+\.\s*)/);
  for (const r of reszek) {
    const m = /^<strong>\s*(\d+)\.\s*([\s\S]*?)<\/strong>(?:<br>\s*\n?)?([\s\S]*)$/.exec(r.trim());
    if (!m) continue;
    let valasz = m[3].trim();
    if (!valasz && ps[i + 1] && !/^<strong>\s*\d+\./.test(ps[i + 1])) valasz = ps[++i];
    kerdesek.set(+m[1], { k: m[2].replace(/\s+/g, ' ').trim(), v: tisztit(valasz) });
  }
}
// a mostani kinalat (a tulajdonos szabalya: arany / 14 karatos bevonat sehol; G23 titanium)
kerdesek.set(15, { k: 'Milyen anyagból vannak az ékszerek?', v: 'Minden ékszerünk <b>G23 titániumból</b> készül: ez a legmagasabb minőségű, antiallergén orvosi fém.' });
kerdesek.set(16, { k: 'Fémallergia esetén melyiket lehet használni?', v: 'Fémallergia esetén is a G23 titánium ékszert javasoljuk, mert ez a legkevésbé allergizáló orvosi fém. Ha nagyon ritkán erre is érzékenység lép fel, az állapotfelmérésen egyeztetjük a megoldást (hozott ékszer esetén pontos paraméterekkel). Fémallergia esetén más orvosi fém nem használható, mert ötvözet, és keresztszennyeződés állhat fenn.' });
if (kerdesek.size !== 33) throw new Error(`33 kerdes helyett ${kerdesek.size}`);

const TEMAK = [
  ['elotte', 'A szúrás előtt', 'calendar', [1, 2, 4, 10, 11, 28]],
  ['hatas', 'Hatás és garancia', 'shield', [7, 8, 12, 13, 14]],
  ['ekszer', 'Ékszerek', 'gem', [15, 16, 3, 5, 17, 21, 22]],
  ['gyogyulas', 'Gyógyulás és utóápolás', 'heart', [23, 9, 29, 30, 24, 19, 20, 32, 33]],
  ['mindennap', 'A mindennapokban', 'sparkles', [6, 25, 26, 27, 31, 18]],
];
const hasznalt = TEMAK.flatMap((t) => t[3]).sort((a, b) => a - b);
if (hasznalt.join() !== [...kerdesek.keys()].sort((a, b) => a - b).join()) throw new Error('minden kerdes pontosan egy temaban');

const elem = (n) => { const { k, v } = kerdesek.get(n); return `<details class="kat-elem"><summary>${k}<span class="kat-elem-nyil">${IK('chev')}</span></summary><div class="kat-elem-torzs"><p>${v}</p></div></details>`; };
const html = `<!--oldal ${JSON.stringify({ cim: 'Gyakori kérdések – a 33 leggyakoribb kérdés a közérzetjavító piercingekről | Medical Piercing', leiras: 'Fáj? Mikor hat? Lehet vele sportolni, úszni? Mi a garancia? A 33 leggyakoribb kérdés és válasz a közérzetjavító piercingekről, témák szerint.' })} -->
  <!-- a GYIK oldal: tools/uj-gyik.mjs (ne kezzel szerkeszd) -->
  <section class="hos">
    <div class="tarto hos-racs">
      <h1 class="hos-cim">Gyakori kérdések: <em>a 33 leggyakoribb kérdés</em></h1>
      <div class="hos-szoveg">
        <p class="hos-bevezeto">Fáj? Mikor kezd hatni? Lehet vele sportolni, úszni, fodrászhoz menni? Összegyűjtöttük, amit vendégeink a leggyakrabban kérdeznek – témák szerint, röviden. A 20 perces videóban Kovács Richárd piercer válaszol, és egy behelyezést is megmutatunk.</p>
        <div class="gombsor">
          <a class="gomb gomb-tomor" href="/idopontfoglalas">${IK('calendar')}Időpontot foglalok${IK('chev', 'ik-nyil')}</a>
          <a class="gomb gomb-ures" href="#kerdesek">A kérdések${IK('chev', 'ik-nyil')}</a>
        </div>
        <div class="hos-ertek-sav">
<!--#ertekeles-->
          <ul class="hos-linkek"><li><a href="/migren-es-shenmen-piercing-garancia">Garancia »</a></li><li><a href="/elerhetosegek">Helyszíneink »</a></li><li><a href="/a-migren-es-shenmen-piercing-utoapolasa">Utóápolás »</a></li></ul>
        </div>
<!--#bizalom-->
      </div>
      <figure class="hos-kep">
        <a class="video" href="https://www.youtube.com/watch?v=5Gs8oYgKdQI" target="_blank" rel="noopener" data-embed="https://www.youtube-nocookie.com/embed/5Gs8oYgKdQI?autoplay=1&amp;rel=0" data-cim="Közérzetjavító piercingek: minden, amit tudni szeretnél – interjú Kovács Richárd piercerrel" aria-label="Videó lejátszása: interjú Kovács Richárd piercerrel"><span class="video-kep"><img src="https://i.ytimg.com/vi/5Gs8oYgKdQI/hqdefault.jpg" width="480" height="360" alt="" fetchpriority="high"><span class="lejatszo">${IK('play')}</span></span></a>
      </figure>
    </div>
  </section>

  <!-- A KÉRDÉSEK TÉMÁK SZERINT -->
  <section class="tarto" id="kerdesek">
    <div class="szakasz-fej">
      <h2>Válaszok témák szerint</h2>
      <p>Kattints egy kérdésre a válaszért.</p>
    </div>
    <ul class="lepes-csik">
      ${TEMAK.map(([id, cim, ik, l]) => `<li><a href="#${id}"><b>${l.length}</b>${cim}</a></li>`).join('\n      ')}
    </ul>
    <div class="gyik-temak">
      ${TEMAK.map(([id, cim, ik, l]) => `<div class="gyik-tema" id="${id}">
        <h3 class="gyik-tema-cim"><span class="info-ik">${IK(ik)}</span>${cim}</h3>
        <div class="kat-harmonika">${l.map(elem).join('')}</div>
      </div>`).join('\n      ')}
    </div>
  </section>

  <!-- NEM TALÁLTAD? -->
  <section class="tarto">
    <div class="zaro-doboz">
      <h2>Nem találtad a választ?</h2>
      <p>Írj nekünk a <a href="mailto:medicalpiercing.hu@gmail.com">medicalpiercing.hu@gmail.com</a> címre, vagy hívj minket hétköznap 9 és 17 óra között a <a href="tel:+3619017444">+36 1 901 7444</a> számon. Ha már van piercinged, és gond van vele, foglalj ingyenes kontroll időpontot.</p>
      <div class="gombsor">
        <a class="gomb gomb-tomor" href="/idopontfoglalas">Időpontot foglalok${IK('chev', 'ik-nyil')}</a>
        <a class="gomb gomb-ures" href="/kontroll">Kontroll időpontok${IK('chev', 'ik-nyil')}</a>
      </div>
    </div>
  </section>

<!--#velemenyek-->
<!--#video-velemeny-mind-->

<!--#helyszinek-->
`;
fs.writeFileSync(path.join(ROOT, 'uj-oldalak/sajat/akupunkturas-piercing-tudastar-video.html'), html);
console.log(`GYIK: ${kerdesek.size} kerdes, ${TEMAK.length} tema`);
