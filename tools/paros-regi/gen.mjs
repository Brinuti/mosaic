// A regi (Wixes) "Paros Head Spa" oldal (paros-headspa-budapest) ujrastilusa, a TARTALOM valtoztatasa nelkul. A tulajdonos dontese (2026-10-08): a regi oldal megy az eredeti cimen,
// amig az ujratervezett (paros-headspa-budapest-uj) nincs kesz; az -uj cim valtozatlan marad.
//
//   node tools/paros-regi/gen.mjs      ->  foglalas/paros-headspa-budapest.html
//
// Forras: forras/paros.folyam.txt (a regi oldal kinyert tartalma, tools/ujrastilus/folyam.mjs; az eles oldalrol, a csere ELOTT) + a regi oldal HTML-je (klon/paros-headspa-budapest.html):
// a csomagkartyak (Wix-ismetlo: cim, felsorolas, ar, idotartam, kedvezmeny) a HTML-bol keruelnek ki, mert a kinyero a felsorolas elemeit egy sorba olvasztja. A kozos kepek allando
// listabol jonnek (a kinyero a Wix lusta kepeit nem mindig latja). A kezi szerkesztes megengedett, de az ujrafuttatas felulirja a kimeneti fajlt.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { GYOKER, BAZIS, IKON, attr, sorok, szoveg, cim, kep, img, gomb, gombSor, aranyok, linkek, paragrafusok, rendez, CSILLAG_KEP, TI_EMBED, szalonHtml, velemenyHtml, meta } from '../lezer-variansok/gen.mjs';
import { elemez, keres, szoveg as htmlSzoveg, tisztSzoveg, blokkok, belso } from '../jogi-oldalak/gen.mjs';

const NEV = 'paros-headspa-budapest';
const FORRAS = path.join(import.meta.dirname, 'forras', 'paros.folyam.txt');
const GYIK_KULCSOK = ['c2eb0f_e2a637ece2437154df156d36cae403f4', 'c2eb0f_dab261d3e84629df7798238e716f0266'];   // "MOSAIC GYIK 1" + "MOSAIC GYIK 2": a regi oldalon egy listaban (klon.js)

const SZAKASZOK = [
  ['bemutat', 'H1', /Az öröm megduplázódik/],
  ['folyamat', 'H1', /Így néz ki egy 50/],
  ['fejbor', 'H2', /A fejbőrötök azt kapja/],
  ['csomagok', 'H2', /Csomagok és Árak/],
  ['oxygeni', 'H2', /100%-ban organikus/],
  ['masszorok', 'H2', /Tapasztalt gyógymasszőrök/],
  ['videok', 'H2', /Lapozzátok végig/],
  ['szaritas', 'H2', /Csak tökéletes szárítással/],
  ['szalon', 'H2', /gyönyörűen felújított/],
  ['szep', 'H1', /SZÉP Kártyát/],
  ['ajandek', 'H2', /Ajándékkártya 1 perc alatt/],
  ['gyik', 'H2', /Gyakori Head Spa Kérdések/],
  ['hely', 'H2', /Itt találtok meg minket/],
];
function szeletek(rs) {
  const kezd = [['hero', 0]];
  let from = 1;
  for (const [nev, tipus, minta] of SZAKASZOK) {
    let i = -1;
    for (let k = from; k < rs.length; k++) if (rs[k].t === tipus && minta.test(szoveg(rs[k].html || ''))) { i = k; break; }
    if (i < 0) throw new Error(`nincs "${nev}" szakasz-kezdet (${tipus} ${minta})`);
    kezd.push([nev, i]); from = i + 1;
  }
  const ki = {};
  kezd.forEach(([nev, i], n) => { ki[nev] = rs.slice(i, n + 1 < kezd.length ? kezd[n + 1][1] : rs.length); });
  return ki;
}

// a Wix athuzott szovege: minden karakter utan U+0336 ("6̶5̶.̶9̶0̶0̶ ̶F̶t̶") -> <s>65.900 Ft</s>
const athuz = (h) => h.replace(/((?:[^<>\u0336]\u0336)+)/g, (m) => `<s>${m.replace(/\u0336/g, '').trim()}</s>`);
// az extrakcios szoveg-hiba: a szomszedos Wix-szovegelemek koze tett szokoz ("68 .000")
const szokozJavit = (h) => h.replace(/(\d) \.(\d{3})/g, '$1.$2');

// ---------------------------------------------------------------------------------------------------------------------------------------------
function heroHtml(rs) {
  const h = rs.find((r) => r.t === 'H1' || r.t === 'H2');
  const sz = rs.filter((r) => r.t === 'SZ');
  const gombok = rs.filter((r) => r.t === 'GOMB');
  const lead = sz[0];
  const cimSor = sz.find((r) => /Bécsi út 2/.test(r.html));
  const ertekeles = sz.find((r) => /^Google/.test(r.html));
  const tobbi = sz.filter((r) => r !== lead && r !== cimSor && r !== ertekeles);
  return `<section class="hero lv-hero">
  <div class="tartalom hero-racs">
    <div class="hero-szoveg">
      <h1>${cim(h.html)}</h1>
      <p class="hero-al">${lead.html}</p>
      <p class="lv-sor">${cimSor.html}</p>
      <div class="cta-sor">
        ${gombok.map((g, i) => gomb(g, i ? 'gomb gomb-korvonal' : 'gomb gomb-arany')).join('\n        ')}
      </div>
${tobbi.map((r) => `      <p class="lv-sor">${athuz(r.html)}</p>`).join('\n')}
      <p class="lv-ertekeles">${img(CSILLAG_KEP, '5 csillag', ' loading="eager"')}<span>${ertekeles.html}</span></p>
    </div>
    <figure class="hero-kep lv-hero-kep">${img(kep('c2eb0f_2c17645e97d9'), 'Páros Head Spa kezelés a MOSAIC-ban', ' fetchpriority="high"')}</figure>
  </div>
</section>`;
}

// bemutatkozas: a szalon alapitoja, bevezeto szoveg
function bemutatHtml(rs) {
  const h = rs.find((r) => r.t === 'H1');
  const sz = rs.filter((r) => r.t === 'SZ');
  const alairas = sz.find((r) => /^<i>/.test(r.html));
  const alcim = sz[0];
  const tobbi = sz.filter((r) => r !== alcim && r !== alairas);
  return `<section class="szekcio feher" id="bemutatkozas" aria-labelledby="bemutatkozas-cim">
  <div class="tartalom">
    <div class="fel-racs felul">
      <figure class="kep-fig lv-kicsi">${img(kep('c2eb0f_68d6961f322c'), 'Deák Ferenc István, a MOSAIC Head Spa alapítója', ' loading="lazy"')}</figure>
      <div class="cikk">
        <h2 id="bemutatkozas-cim">${cim(h.html)}</h2>
        <p class="lv-alcim">${alcim.html}</p>
${paragrafusok(tobbi)}
        <p class="lv-alairas">${alairas.html}</p>
      </div>
    </div>
  </div>
</section>`;
}

// "Igy neznek ki egy 50 + 30 perces Paros Head Spa": diavetites (9 kep, az elo oldal galeriak.js-beli comp-m7pynjwm listaja) + 4 szovegresz + zaro mondat
const FOLYAMAT_KEPEK = ['c2eb0f_3655b2f7e196', 'c2eb0f_c6d1cba9f393', 'c2eb0f_886697b56ef8', 'c2eb0f_559e4a7f5f49', 'c2eb0f_f54862bfccb8', 'c2eb0f_f493947b2eb1', 'c2eb0f_3ab7fc858730', 'c2eb0f_926d2091d5e0', 'c2eb0f_0ad78e2b2f4d'];
function folyamatHtml(rs) {
  const h = rs.find((r) => r.t === 'H1');
  const sz = rs.filter((r) => r.t === 'SZ');
  const felirat = sz.find((r) => r.x < 400);
  const szovegek = sz.filter((r) => r !== felirat);
  return `<section class="szekcio lv-sotet" id="folyamat" aria-labelledby="folyamat-cim">
  <div class="tartalom">
    <div class="szekcio-fej">
      <h2 id="folyamat-cim">${cim(h.html)}</h2>
      <span class="rombusz" aria-hidden="true"></span>
    </div>
    <div class="fel-racs felul cikk lv-folyamat">
      <div>
        <div class="korhinta nagy-elem">
          <button type="button" class="korhinta-gomb elozo" aria-label="Előző kép" disabled>${IKON.elozo}</button>
          <div class="korhinta-sav">
${FOLYAMAT_KEPEK.map((e, i) => `            <figure>${img(kep(e), 'Páros Head Spa kezelés a MOSAIC-ban (' + (i + 1) + '. kép)', ' loading="lazy"')}</figure>`).join('\n')}
          </div>
          <button type="button" class="korhinta-gomb kovetkezo" aria-label="Következő kép">${IKON.kovetkezo}</button>
        </div>
        <p class="lv-felirat">${felirat.html}</p>
      </div>
      <div>
${paragrafusok(szovegek)}
      </div>
    </div>
  </div>
</section>`;
}

// fejbor: mikrokamera + leggyakoribb problemak
function fejborHtml(rs) {
  const h = rs.find((r) => r.t === 'H2');
  const sz = rs.filter((r) => r.t === 'SZ');
  const lista = sz.filter((r) => r.x > 140 && r.x < 170 && r.w < 470);
  const elo = sz.slice(0, sz.indexOf(lista[0]));
  const utan = sz.slice(sz.indexOf(lista[lista.length - 1]) + 1);
  return `<section class="szekcio zsalya" id="fejbor" aria-labelledby="fejbor-cim">
  <div class="tartalom">
    <div class="fel-racs fordit felul">
      <div class="cikk">
        <h2 id="fejbor-cim">${cim(h.html)}</h2>
${paragrafusok(elo)}
        <ul class="lv-lista">
${lista.map((r) => `          <li>${r.html}</li>`).join('\n')}
        </ul>
${paragrafusok(utan)}
      </div>
      <figure class="kep-fig lv-valt-kep">${img(kep('c2eb0f_aab3792d7e02'), 'Mikrokamerás fejbőrvizsgálat a MOSAIC-ban', ' loading="lazy"')}</figure>
    </div>
  </div>
</section>`;
}

// csomagok: a regi HTML Wix-ismetloje (4 kartya) - cim, felsorolas, ar, idotartam, kedvezmeny
const CSOMAG_KEPEK = ['c2eb0f_b4524614b454', 'c2eb0f_457a5f5c69ce', 'c2eb0f_40d2a033721a', 'c2eb0f_9ea9d95c658e'];
function csomagKartyak() {
  const fa = elemez(fs.readFileSync(path.join(GYOKER, 'klon', NEV + '.html'), 'utf8'));
  const rt = keres(fa, (n) => n.attrs['data-testid'] === 'richTextElement' && /__item/.test(n.attrs.id || ''));
  const elemek = new Map();   // item-kulcs -> { cim, torzs, promo }
  for (const n of rt) {
    const m = /^comp-(mm6b7ys41|mm6b7ys6|mm6b7ysh)__(.+)$/.exec(n.attrs.id);
    if (!m) continue;
    const e = elemek.get(m[2]) || {}; elemek.set(m[2], e);
    e[{ mm6b7ys41: 'cim', mm6b7ys6: 'torzs', mm6b7ysh: 'promo' }[m[1]]] = blokkok(n);
  }
  const gombok = keres(fa, (n) => n.tag === 'a' && /FOGLALOK/.test(htmlSzoveg(n)) && n.attrs.href);
  const lista = [...elemek.values()];
  if (lista.length !== 4 || gombok.length < 4) throw new Error('csomagok: 4 kartya + 4 gomb kellene (' + lista.length + ' / ' + gombok.length + ')');
  return lista.map((e, i) => {
    const inl = (b) => athuz(b.html);
    const ar = e.torzs.filter((b) => b.t === 'p' && /^Ár:/.test(b.szoveg))[0];
    const helyett = e.torzs.filter((b) => b.t === 'p' && /^helyett/.test(b.szoveg))[0];
    const ido = e.torzs.filter((b) => b.t === 'p' && /^Időtartam/.test(b.szoveg))[0];
    const hajszaritas = e.torzs.filter((b) => b.t === 'p' && /^\+ 30 perc/.test(b.szoveg))[0];
    const felsorolas = e.torzs.filter((b) => b.t === 'ul')[0];
    const leiras = e.torzs.filter((b) => b.t === 'p' && !/^(Ár:|helyett|Időtartam|\+ 30 perc)/.test(b.szoveg));
    if (!ar || !helyett || !ido || !hajszaritas || !felsorolas) throw new Error('csomagkartya ' + (i + 1) + ': hianyzo resz');
    return { cim: e.cim, leiras, felsorolas, hajszaritas, ar, helyett, ido, promo: e.promo[0], href: gombok[i].attrs.href, felirat: tisztSzoveg(htmlSzoveg(gombok[i])), kep: CSOMAG_KEPEK[i] };
  });
}
function csomagokHtml(rs) {
  const h = rs.find((r) => r.t === 'H2');
  const alcim = rs.find((r) => r.t === 'SZ' && r.w < 400);
  const kk = csomagKartyak();
  return `<section class="szekcio feher" id="csomagok" aria-labelledby="csomagok-cim">
  <div class="tartalom">
    <div class="szekcio-fej">
      <h2 id="csomagok-cim">${cim(h.html)}</h2>
      <span class="rombusz" aria-hidden="true"></span>
      <p class="lead lv-dolt">${alcim.html}</p>
    </div>
    <div class="lv-csomagok lv-negy">
${kk.map((k) => `      <article class="lv-csomag lv-paros-csomag">
        <figure class="lv-kartya-kep">${img(kep(k.kep), tisztSzoveg(k.cim.map((b) => b.szoveg).join(' ')) + ' – csomag', ' loading="lazy"')}</figure>
        <h3>${k.cim.map((b) => b.html).join('<br>')}</h3>
${k.leiras.map((b) => `        <p class="lv-csomag-leiras">${b.html}</p>`).join('\n')}
        <ul class="pipak lv-csomag-felsorolas">
${k.felsorolas.li.map((l) => `          <li>${l.html}</li>`).join('\n')}
        </ul>
        <p class="lv-csomag-plusz">${k.hajszaritas.html}</p>
        <p class="lv-csomag-ar"><span>${athuz(k.ar.html)}</span> <b>${k.helyett.html}</b></p>
        <p class="lv-csomag-ido">${k.ido.html}</p>
        <a class="gomb gomb-arany" href="${attr(k.href)}">${k.felirat} <span class="nyil" aria-hidden="true">→</span></a>
        <p class="lv-promo">${k.promo.html}</p>
      </article>`).join('\n')}
    </div>
  </div>
</section>`;
}

// OXYGENI termekek: kep + cim + szovegek + felsorolas
function oxygeniHtml(rs) {
  const h = rs.find((r) => r.t === 'H2');
  const sz = rs.filter((r) => r.t === 'SZ');
  const lista = sz.filter((r) => r.x > 850 && r.x < 870);
  const elo = sz.slice(0, sz.indexOf(lista[0]));
  return `<section class="szekcio bezs" id="oxygeni" aria-labelledby="oxygeni-cim">
  <div class="tartalom">
    <div class="fel-racs">
      <figure class="kep-fig lv-kicsi">${img(kep('c2eb0f_f9a4ce4bf90b'), 'OXYGENI hajápoló termékek', ' loading="lazy"')}</figure>
      <div class="cikk">
        <h2 id="oxygeni-cim">${cim(h.html)}</h2>
${paragrafusok(elo)}
        <ul class="pipak">
${lista.map((r) => `          <li>${r.html}</li>`).join('\n')}
        </ul>
      </div>
    </div>
  </div>
</section>`;
}

// gyogymasszorok: kep + szovegek, alatta a szeles szalonkep-szalag
function masszorokHtml(rs) {
  const h = rs.find((r) => r.t === 'H2');
  const sz = rs.filter((r) => r.t === 'SZ');
  return `<section class="szekcio feher" id="gyogymasszorok" aria-labelledby="masszorok-cim">
  <div class="tartalom">
    <div class="fel-racs felul fordit">
      <div class="cikk">
        <h2 id="masszorok-cim">${cim(h.html)}</h2>
${paragrafusok(sz)}
      </div>
      <figure class="kep-fig lv-valt-kep">${img(kep('c2eb0f_28b6a0e799ce'), 'Gyógymasszőr dolgozik a MOSAIC-ban', ' loading="lazy"')}</figure>
    </div>
  </div>
  <div class="lv-hely-kep lv-szalag">${img(kep('c2eb0f_8e2372842a08'), 'A MOSAIC szalon', ' loading="lazy"')}</div>
</section>`;
}

// a 15 videos lapozo: poszter + idotartam + cim (a videofajl a poszter azonositojabol: assets/video/<azon>.mp4)
function videokHtml(rs) {
  const h = rs.find((r) => r.t === 'H2');
  const al = rs.find((r) => r.t === 'SZ' && /szeánsz elemei/.test(r.html));
  const posterek = rendez(rs, 'KEP').filter((r) => /f002\.jpg/.test(r.src));
  const idok = rs.filter((r) => r.t === 'SZ' && /^\d\d:\d\d$/.test(szoveg(r.html)));
  const cimek = rs.filter((r) => r.t === 'H3');
  if (posterek.length !== 15 || idok.length !== 15 || cimek.length !== 15) throw new Error(`videok: 15 poszter / ido / cim kellene (${posterek.length} / ${idok.length} / ${cimek.length})`);
  const kartya = (p, ido, c) => {
    const poszter = p.src.replace(/%20\d+x$/, '').replace(/\s+\d+x$/, '');
    const azon = /\/([^/]+?)f00\d\.jpg$/.exec(poszter)[1];
    const fajl = `/assets/video/${azon}.mp4`;
    if (!fs.existsSync(path.join(GYOKER, fajl.slice(1)))) throw new Error('hianyzik a videofajl: ' + fajl);
    return `        <div class="lv-videoelem">
          <button type="button" class="video-kartya" data-video="${fajl}" data-poster="${attr(poszter)}" data-fekvo aria-label="Videó lejátszása: ${attr(szoveg(c.html))}">
            ${img(poszter, '', ' loading="lazy"')}<span class="video-play">${IKON.lejatszas}</span><span class="video-ido">${ido.html}</span>
          </button>
          <h3>${c.html}</h3>
        </div>`;
  };
  return `<section class="szekcio zsalya" id="videok" aria-labelledby="videok-cim">
  <div class="tartalom">
    <div class="szekcio-fej">
      <h2 id="videok-cim">${cim(h.html)}</h2>
      <span class="rombusz" aria-hidden="true"></span>
      <p class="lead">${al.html}</p>
    </div>
    <div class="korhinta lv-videok">
      <button type="button" class="korhinta-gomb elozo" aria-label="Előző videó" disabled>${IKON.elozo}</button>
      <div class="korhinta-sav">
${posterek.map((p, i) => kartya(p, idok[i], cimek[i])).join('\n')}
      </div>
      <button type="button" class="korhinta-gomb kovetkezo" aria-label="Következő videó">${IKON.kovetkezo}</button>
    </div>
  </div>
</section>`;
}

function szaritasHtml(rs) {
  const h = rs.find((r) => r.t === 'H2');
  const sz = rs.filter((r) => r.t === 'SZ');
  return `<section class="szekcio bezs" id="szaritas" aria-labelledby="szaritas-cim">
  <div class="tartalom">
    <div class="fel-racs">
      <figure class="kep-fig lv-kicsi">${img(kep('c2eb0f_296cd274d873'), 'Profi, szalon szintű hajszárítás a MOSAIC-ban', ' loading="lazy"')}</figure>
      <div class="cikk">
        <h2 id="szaritas-cim">${cim(h.html)}</h2>
${paragrafusok(sz)}
      </div>
    </div>
  </div>
</section>`;
}

function szepHtml(rs) {
  const h = rs.find((r) => r.t === 'H1');
  const sz = rs.filter((r) => r.t === 'SZ');
  const g = rs.filter((r) => r.t === 'GOMB');
  return `<section class="szekcio feher" id="szep-kartya" aria-labelledby="szep-cim">
  <div class="tartalom">
    <div class="fel-racs">
      <figure class="kep-fig">${img(kep('c2eb0f_3603018cb350'), 'SZÉP Kártya elfogadóhely', ' loading="lazy"')}</figure>
      <div class="cikk">
        <h2 id="szep-cim">${cim(h.html)}</h2>
${paragrafusok(sz)}
        <div class="cta-sor">
          ${g.map((x) => gomb(x)).join('\n          ')}
        </div>
      </div>
    </div>
  </div>
</section>`;
}

function ajandekHtml(rs) {
  const h = rs.find((r) => r.t === 'H2');
  const sz = rs.filter((r) => r.t === 'SZ');
  const g = rs.filter((r) => r.t === 'GOMB');
  return `<section class="szekcio zsalya" id="ajandekkartya" aria-labelledby="ajandek-cim">
  <div class="tartalom">
    <div class="fel-racs fordit">
      <div class="cikk">
        <h2 id="ajandek-cim">${cim(h.html)}</h2>
${paragrafusok(sz)}
        <div class="cta-sor">
          ${g.map((x) => gomb(x, 'gomb gomb-arany')).join('\n          ')}
        </div>
      </div>
      <figure class="kep-fig lv-kicsi">${img(kep('c2eb0f_5fad37708d0d'), 'MOSAIC Head Spa ajándékkártya', ' loading="lazy"')}</figure>
    </div>
  </div>
</section>`;
}

let gyikAdat = null;
function gyikValaszok() {
  if (gyikAdat) return gyikAdat;
  const s = fs.readFileSync(path.join(GYOKER, 'assets/js/gyik.js'), 'utf8');
  const m = /window\.MH_GYIK = (\{[\s\S]*\});?\s*$/.exec(s);
  const mind = JSON.parse(m[1]);
  gyikAdat = GYIK_KULCSOK.flatMap((k) => { if (!mind[k]) throw new Error('nincs a GYIK a gyik.js-ben: ' + k); return mind[k]; });
  return gyikAdat;
}
function gyikHtml(rs) {
  const h = rs.find((r) => r.t === 'H2');
  const v = gyikValaszok();
  return `<section class="szekcio lv-hatterkepes" id="gyik" aria-labelledby="gyik-cim">
  ${img(kep('nsplsh_38734f5a4a384a46305338-1280'), '', ' class="lv-hatterkep" loading="lazy" decoding="async"')}
  <div class="tartalom lv-szuk">
    <div class="szekcio-fej">
      <h2 id="gyik-cim">${cim(h.html)}</h2>
      <span class="rombusz" aria-hidden="true"></span>
    </div>
    <div class="gyik">
${v.map(([k, a]) => `      <details><summary>${k}</summary><div class="gy-valasz">${a}</div></details>`).join('\n')}
    </div>
  </div>
</section>`;
}

function helyHtml(rs) {
  const h = rs.find((r) => r.t === 'H2');
  const sz = rs.filter((r) => r.t === 'SZ');
  const telefon = sz.find((r) => /^06 20/.test(r.html));
  const cimSor = sz.find((r) => /Bécsi út/.test(r.html) && r.w < 300);
  const email = sz.find((r) => /@/.test(r.html));
  const idx = (re) => sz.findIndex((r) => re.test(r.html));
  const nyit = (nap) => { const i = idx(new RegExp('^' + nap)); return `${sz[i].html}: ${sz[i + 1].html}`; };
  const gombok = rs.filter((r) => r.t === 'GOMB');
  const h3k = rs.filter((r) => r.t === 'H3');
  return `<section class="helyszin" id="helyszin" aria-labelledby="hely-cim">
  <div class="lv-hely-kep">${img(kep('11062b_c676302884b3'), 'MOSAIC Head Spa – a szalon', ' loading="lazy"')}</div>
  <div class="tartalom helyszin-racs">
    <div class="hely-szoveg">
      <h2 id="hely-cim">${cim(h.html)}</h2>
      <div class="hely-sor"><span class="ikon-kor">${IKON.hely}</span><p><b>${h3k[0].html}</b><br>${cimSor.html}</p></div>
      <div class="hely-sor"><span class="ikon-kor">${IKON.tel}</span><p><b>${h3k[1].html}</b><br><a href="tel:+36202474444">${telefon.html}</a><br><a href="mailto:${szoveg(email.html)}">${email.html}</a></p></div>
      <div class="hely-sor"><span class="ikon-kor">${IKON.ora}</span><p><b>${h3k[2].html}</b><br>${nyit('Hétfő')}<br>${nyit('Szombat')}<br>${nyit('Vasárnap')}</p></div>
      <div class="hely-gombok">
        ${gombok.map((g, i) => gomb(g, i ? 'gomb gomb-korvonal' : 'gomb gomb-arany')).join('\n        ')}
      </div>
    </div>
    <div class="lv-hely-jobb">
      <div class="terkep" id="terkep">
        <!-- a Google-terkep a funkcionalis sutik engedelyezese utan (vagy a gombra kattintva) toltodik be -->
        <div class="terkep-hely" id="terkep-hely">
          <span class="ikon-kor">${IKON.hely}</span>
          <p><b>MOSAIC</b><br>1023 Budapest, Bécsi út 2.</p>
          <button type="button" class="gomb gomb-korvonal gomb-kicsi" id="terkep-gomb">Google térkép megjelenítése</button>
        </div>
      </div>
    </div>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
function oldal() {
  const rs = sorok(FORRAS);
  const sz = szeletek(rs);
  const m = meta(NEV);
  const html = { bemutat: bemutatHtml, folyamat: folyamatHtml, fejbor: fejborHtml, csomagok: csomagokHtml, oxygeni: oxygeniHtml, masszorok: masszorokHtml, videok: videokHtml, szaritas: szaritasHtml,
    szalon: (r) => szalonHtml(r, SZALON_GALERIA), szep: szepHtml, ajandek: ajandekHtml, gyik: gyikHtml, hely: helyHtml };
  const torzs = [heroHtml(sz.hero), ...SZAKASZOK.map(([n]) => html[n](sz[n]))].join('\n\n');
  const ut = '/' + decodeURIComponent(m.canonical.replace(BAZIS + '/', ''));
  const heroKep = kep('c2eb0f_2c17645e97d9');
  return `<!DOCTYPE html>
<html lang="hu">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${m.title}</title>
<meta name="description" content="${m.desc}">
${m.robots ? `<meta name="robots" content="${m.robots}">\n` : ''}<link rel="canonical" href="${m.canonical}">
<meta property="og:title" content="${m.title}">
<meta property="og:description" content="${m.desc}">
<meta property="og:image" content="${m.ogkep}">
<meta property="og:url" content="${m.canonical}">
<meta property="og:site_name" content="MOSAIC Headspa">
<meta property="og:type" content="website">
<link rel="icon" href="/assets/img/c2eb0f_b001e2c55098446da3e38ff055e20354.png" type="image/png">
<link rel="preload" href="${heroKep}" as="image" fetchpriority="high">
<link rel="preload" href="/assets/fonts/playfair-display-500-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/css/wix-google-fonts.css">
<link rel="stylesheet" href="/assets/css/wix-fonts.css">
<link rel="stylesheet" href="/assets/css/headspa-oldal.css">
<link rel="stylesheet" href="/assets/css/lezer-variansok.css">
<link rel="stylesheet" href="/assets/css/paros-regi.css">
<script src="/assets/js/suti.js"></script>
</head>
<body>
<!--
  MOSAIC Paros Head Spa (${NEV}) - a REGI (Wixes) oldal UJ szerkezettel (a Head Spa oldalak stilusaban). A tartalom a regi oldal tartalma: a szovegek, arak (a regi 20% oktoberi kedvezmennyel),
  kepek, videok, linkek es a GYIK valtozatlanok; a regi oldal hibait / elavult adatait NEM javitottuk (lasd a PR "Eszrevetelek"). A tulajdonos dontese szerint ez az oldal megy az eredeti
  cimen, amig az ujratervezett (paros-headspa-budapest-uj) nincs kesz. A regi, Wixes valtozat rejtett cimen: /${NEV}-regi (noindex). A fajl a tools/paros-regi/gen.mjs kimenete
  (forras: forras/paros.folyam.txt + klon/${NEV}.html); kezi szerkesztes megengedett, de az ujrafuttatas felulirja. Egyetlen H1: a regi H2 hero-cim lett H1, a regi H1-ek H2-k.
-->

<!--mh-fejlec-->
<!--mh-menu-aktiv:${ut}-->

<main id="top">
${torzs}
</main>

<!--mh-lablec-->

<script src="/assets/js/klon.js" defer></script>
<script src="/assets/js/headspa-oldal.js" defer></script>
</body>
</html>
`;
}
// az elo oldal szalon-galeriaja (assets/js/galeriak.js, comp-m7pxb9bk): 19 kep, ebben a sorrendben (a regi oldal statikus HTML-je csak az elso 9-et tartalmazza, a tobbit a klon.js tolti be)
const SZALON_GALERIA = [
  ['c2eb0f_ac85eea74409', 'A MOSAIC váró- és recepciós tere'], ['c2eb0f_aa3b2f8ec756', 'A váró zöld bársonyfotelekkel'], ['c2eb0f_00a2f4bd0e9b', 'A bejárat a MOSAIC emblémával és a macska-szoborral'],
  ['c2eb0f_de82baa48487', 'A szalon bejárata'], ['c2eb0f_0afd6583c982', 'A kezelőhelyiség növényekkel'], ['c2eb0f_7b41e9e53cc2', 'A kezelőhelyiség esti fényekben'],
  ['c2eb0f_2117f850ffa2', 'Folyosó a szalonban'], ['c2eb0f_954c13b62f8c', 'A váró fekete bútorokkal'], ['c2eb0f_df20aa423fff', 'A váró és a recepció'],
  ['c2eb0f_4b168900f018', 'A kezelőtér fa padlóval, függőlámpával és kezelőággyal'], ['c2eb0f_125eecc88189', 'A kezelőtér esti, meleg megvilágításban'], ['c2eb0f_35fb28ead079', 'A szalon hajápoló termékei a polcon'],
  ['c2eb0f_8c347f764efd', 'Mécsesek a falpolcon'], ['c2eb0f_96f1f6b3f1d3', 'A szalon díszes függőlámpája'], ['c2eb0f_5167d7e5a970', 'Bekeretezett grafikák a falon'],
  ['c2eb0f_8d2d182c8386', 'Fekete szobor a mintás fal előtt'], ['c2eb0f_8e2372842a08', 'Aranyszínű macska-szobor és bekeretezett üzenet a falon'], ['c2eb0f_d56c002c8f6f', 'Mécsesek a sötét falpolcon'],
  ['c2eb0f_e9339a3f8c78', 'A hajmosó a kezelőtérben'],
];

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const ki = path.join(GYOKER, 'foglalas', NEV + '.html');
  fs.writeFileSync(ki, szokozJavit(oldal()));
  console.log('kesz:', path.relative(GYOKER, ki), fs.statSync(ki).size, 'bajt');
}
