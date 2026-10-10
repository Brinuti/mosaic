// Az urlapokbol kuldott levelek szovege (functions/[[path]].js).
//
//   level('allasjelentkezes', [['oldal', '/allasajanlat'], ['Vezetéknév', 'Kiss'], ...])
//     -> { targy, html, valasz }
//
// A Wix-urlap mezoit a cimkejukkel kapjuk (klon.js 6.), ezert barmelyik oldal
// urlapja kulon beallitas nelkul is olvashato levelet ad.
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const CIMEK = {
  allasjelentkezes: 'Új állásjelentkezés',
  'blog-hozzaszolas': 'Új blog-hozzászólás',
  'kontroll-visszahivas': 'Új visszahívás-kérés (kontroll / garancia)',
};

export function level(nev, mezok) {
  const oldal = (mezok.find(([k]) => k === 'oldal') || [])[1] || '';
  const sorok = mezok.filter(([k]) => k !== 'oldal');
  const email = (sorok.find(([k, v]) => /e-?mail/i.test(k) && /@/.test(v)) || [])[1];
  const nevMezo = ['Vezetéknév', 'Keresztnév', 'Felhasználónév', 'Név'].map((k) => (sorok.find(([m]) => m === k) || [])[1]).filter(Boolean).join(' ');
  const cim = CIMEK[nev] || 'Új üzenet a weboldalról';
  const html = `<div style="font:15px/1.5 Arial,sans-serif;color:#222">
<h2 style="margin:0 0 12px">${esc(cim)}</h2>
<p style="margin:0 0 12px;color:#666">Oldal: <a href="https://www.medicalpiercing.hu${esc(oldal)}">www.medicalpiercing.hu${esc(oldal)}</a></p>
<table cellpadding="6" style="border-collapse:collapse">${sorok.map(([k, v]) => `<tr><td style="border-bottom:1px solid #eee;color:#666;vertical-align:top">${esc(k)}</td><td style="border-bottom:1px solid #eee"><b>${esc(v)}</b></td></tr>`).join('')}</table>
</div>`;
  return { targy: `${cim}${nevMezo ? ' – ' + nevMezo : ''} (${oldal || 'weboldal'})`, html, valasz: email || null };
}
