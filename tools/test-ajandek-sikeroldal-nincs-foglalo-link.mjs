// DECISION #194 / 1. pont (Feri jovahagyta, #167 6240295578): a /success-ajandekkartya-stripe oldal (asztali + mobil) TORZSEBEN nincs semmilyen foglalo link:
// se a kozvetlen Salonic-link (showServices ... specId=41471), se a foglalo-motor, se a regi /idpontfoglalas / /mosaic-hair-idopontfoglalas. A kozos fejlec es lablec
// (minden oldalon kozos FOGLALAS / Idopontfoglalas gomb, az Info-ablak gombja) NEM tartozik ide: azok a kozos darabokban vannak.
//   node --test tools/test-ajandek-sikeroldal-nincs-foglalo-link.mjs
// A forrasfajlokat (klon/, klon/m/) mindig ellenorzi; a build kimenetet (dist/_a, dist/_m) csak akkor, ha a `node tools/netlify-build.mjs` mar lefutott.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FORRAS = [['asztali', 'klon/success-ajandekkartya-stripe.html'], ['mobil', 'klon/m/success-ajandekkartya-stripe.html']];
const BUILD = [['asztali', 'dist/_a/success-ajandekkartya-stripe.html'], ['mobil', 'dist/_m/success-ajandekkartya-stripe.html']];

// a torzs: a dokumentum a kozos darabok nelkul: fejlec (<header id="SITE_HEADER">), lablec (<footer id="SITE_FOOTER">), az Info-ablak sablonja (<template id="mh-popup-rk7x7">,
// a fejlec "i" gombja nyitja; a build a fejlec utan teszi) es a <style> / <script> blokkok (a kozos fejlec-CSS `a[href="/idpontfoglalas"]` szelektorai nem linkek)
function torzs(html) {
  const kivag = (h, nyit, zar) => { const a = h.indexOf(nyit); if (a < 0) return h; const b = h.indexOf(zar, a); return b < 0 ? h : h.slice(0, a) + h.slice(b + zar.length); };
  let h = kivag(html, '<header id="SITE_HEADER"', '</header>');
  h = kivag(h, '<footer id="SITE_FOOTER"', '</footer>');
  h = kivag(h, '<template id="mh-popup-rk7x7">', '</template>');
  return h.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '');
}
const hrefek = (h) => [...h.matchAll(/\bhref\s*=\s*"([^"]*)"/gi)].map((m) => m[1].replace(/&amp;/g, '&'));
const ENTITAS = { aacute: 'á', Aacute: 'Á', eacute: 'é', Eacute: 'É', iacute: 'í', Iacute: 'Í', oacute: 'ó', Oacute: 'Ó', ouml: 'ö', Ouml: 'Ö', odblac: 'ő', Odblac: 'Ő', uacute: 'ú', Uacute: 'Ú', uuml: 'ü', Uuml: 'Ü', udblac: 'ű', Udblac: 'Ű', nbsp: ' ', amp: '&' };
const szoveg = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, '\n').replace(/&([A-Za-z]+);/g, (m, n) => ENTITAS[n] ?? m).replace(/\u200b/g, '')
  .split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
const TILTOTT_HREF = /salonic\.hu|showServices|foglalo|idpontfoglalas|idopontfoglalas|booking/i;

function ellenoriz(nev, html) {
  assert.ok(html.includes('<header id="SITE_HEADER"') && html.includes('<footer id="SITE_FOOTER"'), nev + ': a kozos fejlec / lablec megvan (a torzs-szuro ezekre epul)');
  const t = torzs(html);
  const rossz = hrefek(t).filter((h) => TILTOTT_HREF.test(h));
  assert.deepEqual(rossz, [], nev + ': a torzsben nincs foglalo link');
  assert.ok(!/data-booking|openBooking/.test(t), nev + ': a torzsben nincs foglalo-gomb (data-booking / openBooking)');
  assert.ok(!/salonic\.hu/i.test(t), nev + ': a torzsben a Salonic hosztnev sem szerepel');
}

for (const [nev, fajl] of FORRAS) {
  test(`${fajl} (forras, ${nev}): a torzsben nincs foglalo link, a tobbi tartalom (kuponkod, e-mail, papir, kapcsolat) megvan`, () => {
    const html = fs.readFileSync(path.join(ROOT, fajl), 'utf8');
    ellenoriz(nev, html);
    const sorok = szoveg(torzs(html));
    // a foglalasra buzdito lepes teljesen kikerult (nem marad arva "itt tudsz majd idopontot foglalni:" mondat)
    for (const s of sorok) assert.ok(!/ID[ÖŐO]PONT FOGLAL|id[őo]pontot foglalni|Id[őo]pontfoglal[áa]s kuponk|F[őo]men[üu]ben a Foglal/i.test(s), nev + ': nem maradt foglalasra buzdito sor: ' + s);
    // a maradek lepesek folyamatosan szamozottak: 1. KUPONKOD, 2. E-MAILBEN, 3. VAGY PAPIR, 4. KERDESED VAN?
    const lepesek = sorok.filter((s) => /^\d\. [A-ZÁÉÍÓÖŐÚÜŰ]/.test(s));
    assert.deepEqual(lepesek.map((s) => s.slice(0, 2)), ['1.', '2.', '3.', '4.'], nev + ': a lepesek szamozasa folyamatos: ' + lepesek.join(' | '));
    assert.match(lepesek[0], /KUPONK[ÓO]D/);
    assert.match(lepesek[1], /E-MAILBEN/);
    assert.match(lepesek[2], /PAP[ÍI]R/);
    assert.match(lepesek[3], /K[ÉE]RD[ÉE]SED VAN/);
    const egy = sorok.join('\n');
    for (const kell of ['Köszönjük a vásárlást', 'A számla automatikusan kiment', '100% kedvezményre jogosító egyedi kuponkódot', 'mosaicheadspa@gmail.com', '06 20 247 4444', '1023 Budapest Bécsi út 2.', 'A MOSAIC Headspa csapata']) assert.ok(egy.includes(kell), nev + ': megvan: ' + kell);
  });
}

for (const [nev, fajl] of BUILD) {
  const ut = path.join(ROOT, fajl);
  test(`${fajl} (build kimenet, ${nev}): a torzsben nincs foglalo link`, { skip: fs.existsSync(ut) ? false : 'nincs dist (futtasd: CF_PAGES=1 CF_PAGES_BRANCH=main node tools/netlify-build.mjs)' }, () => {
    ellenoriz(nev, fs.readFileSync(ut, 'utf8'));
  });
}
