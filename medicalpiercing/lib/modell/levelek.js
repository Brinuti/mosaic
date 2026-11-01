// A modellkereso napok levelei (visszaigazolas, megerosito kerelem, emlekezteto, lemondas, felszabadulas, varolistas ajanlat). Tiszta fuggvenyek: a foglalas sorabol keszul a level
// (a kuldeskor: az aktualis allapot szerint). A kartya sorai egymas alatt (cimke felul, ertek alatta), mint a lifecycle-levelekben: nagy betumeretnel sem esik szet.
import { nap as napKeres, tipus as tipusKeres, erkezesIdo, HELYSZIN } from './beosztas.js';

export const ALAP = 'https://www.medicalpiercing.hu';
const SZIN = { sotet: '#2f3044', szoveg: '#454659', halvany: '#8a8b9c', gomb: '#d7aba8', gombSzoveg: '#ffffff', hatter: '#f6ebe4', vonal: '#ecdcd4', kartya: '#fffaf7', link: '#b0463b' };
const h = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const adatok = (f) => {
  const n = napKeres(f.nap), t = tipusKeres(f.tipus);
  return { nap: n ? n.cim : f.nap, rovid: n ? n.rovid : f.nap, tipus: t ? t.nev : f.tipus, ido: f.ido, erkezes: erkezesIdo(f.ido), kereszt: f.kereszt || f.nev || '' };
};
export const foglalasLink = (f, alap = ALAP) => `${alap}/mf/${f.id}`;

const sor = (cimke, ertek) => `<tr><td style="padding:10px 0 2px;font:700 12px Arial,Helvetica,sans-serif;letter-spacing:.8px;text-transform:uppercase;color:${SZIN.halvany}">${h(cimke)}</td></tr><tr><td style="padding:0 0 10px;font:16px/1.45 Arial,Helvetica,sans-serif;color:${SZIN.szoveg};border-bottom:1px solid #f1e6e0;word-wrap:break-word;overflow-wrap:anywhere">${ertek}</td></tr>`;
const kartya = (sorok) => `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;table-layout:fixed;background:${SZIN.kartya};border:1px solid ${SZIN.vonal};border-radius:14px"><tr><td style="padding:10px 20px 6px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;table-layout:fixed">${sorok.join('')}</table></td></tr></table>`;
const gomb = (szoveg, link, kiemelt = true) => `<a href="${h(link)}" style="display:inline-block;margin:6px 8px 6px 0;padding:14px 26px;border-radius:999px;font:700 15px Arial,Helvetica,sans-serif;text-decoration:none;${kiemelt ? `background:${SZIN.gomb};color:${SZIN.gombSzoveg}` : `border:2px solid #e3c4bf;color:${SZIN.link}`}">${h(szoveg)}</a>`;
const p = (s) => `<p style="margin:12px 0;font:16px/1.6 Arial,Helvetica,sans-serif;color:${SZIN.szoveg}">${s}</p>`;
const cim = (s) => `<h1 style="margin:22px 0 8px;font:800 26px/1.25 Arial,Helvetica,sans-serif;color:${SZIN.sotet}">${h(s)}</h1>`;
const alcim = (s) => `<h2 style="margin:26px 0 6px;font:700 18px/1.35 Arial,Helvetica,sans-serif;color:${SZIN.sotet}">${h(s)}</h2>`;
const lista = (elemek) => `<ul style="margin:8px 0 12px;padding-left:20px;font:16px/1.6 Arial,Helvetica,sans-serif;color:${SZIN.szoveg}">${elemek.map((e) => `<li style="margin:0 0 6px">${e}</li>`).join('')}</ul>`;

function keret(targy, elofej, torzs) {
  return `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${h(targy)}</title></head>
<body style="margin:0;padding:0;background:${SZIN.hatter}">
<div style="display:none;max-height:0;overflow:hidden">${h(elofej)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${SZIN.hatter}"><tr><td align="center" style="padding:0">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#ffffff">
<tr><td style="padding:26px 32px 8px" align="center"><a href="${ALAP}"><img src="${ALAP}/assets/levelek/kep/logo.png" width="240" alt="Medical Piercing" style="width:240px;max-width:70%;height:auto;border:0"></a></td></tr>
<tr><td style="padding:4px 32px 24px">${torzs}</td></tr>
<tr><td style="padding:20px 32px 28px;background:${SZIN.hatter};font:12px/1.55 Arial,Helvetica,sans-serif;color:${SZIN.halvany}">Medical Piercing · ${h(HELYSZIN.cim)} · ${h(HELYSZIN.telefon)} · ${h(HELYSZIN.email)}<br>Erre a levélre nyugodtan válaszolhatsz, kollégáink elolvassák.<br>A piercing közérzetjavító ékszer, nem minősül gyógymódnak vagy orvosi kezelésnek.</td></tr>
</table></td></tr></table></body></html>`;
}

const reszletek = (f, d) => kartya([
  sor('Nap', `<b>${h(d.nap)}</b>`),
  sor('Piercing', h(d.tipus)),
  sor('Érkezés', `<b>${h(d.erkezes)}</b> (a papírok és a rövid megbeszélés miatt)`),
  sor('A szúrás időpontja', `kb. ${h(d.ido)}`),
  sor('Helyszín', `${h(HELYSZIN.cim)} (${h(HELYSZIN.megjegyzes)})`),
  sor('Ár', '0 Ft – a piercing és az ékszer is ingyenes, az ékszert megtartod'),
]);

const mitErdemesTudni = () => alcim('Mit érdemes tudnod?') + lista([
  'Ez egy <b>oktatási gyakorlónap (workshop)</b>: vidéki piercereink Kovács Richárd felügyelete mellett gyakorolnak, te vagy a modell. A szúrás a szokásos steril eszközökkel és G23 titánium ékszerrel történik.',
  'A gyakorlónapra 18 év feletti jelentkezőket várunk. A szúrásról fotó- és videófelvétel készül.',
  'A <b>nyilatkozatot e-mailben küldjük el</b> neked, külön levélben. Ha bizonytalan vagy abban, hogy a piercing neked való-e, előtte írj vagy hívj minket.',
  'Gyakorlónapon előfordulhat, hogy néhány percet várnod kell. Köszönjük a türelmedet!',
  'A szúrás után az ingyenes kontroll időpontját az oldalunkon online is lefoglalhatod.',
]);

/** @returns {{targy:string, html:string, szoveg:string}} */
export function level(tipus, f, { alap = ALAP } = {}) {
  const d = adatok(f);
  const link = foglalasLink(f, alap);
  const ottLink = `${link}?ott=1`;
  const szoveg = (sorok) => sorok.filter(Boolean).join('\n');
  const reszSzoveg = [`Nap: ${d.nap}`, `Piercing: ${d.tipus}`, `Érkezés: ${d.erkezes}`, `A szúrás időpontja: kb. ${d.ido}`, `Helyszín: ${HELYSZIN.cim}`, 'Ár: 0 Ft (az ékszert megtartod)'];
  switch (tipus) {
    case 't0': {
      const targy = `Megvan a helyed: ingyenes piercing, ${d.rovid}, ${d.ido}`;
      return {
        targy,
        html: keret(targy, `Érkezés: ${d.erkezes}. ${d.tipus} piercing, ingyen, az ékszerrel együtt.`,
          cim(`Megvan a helyed${d.kereszt ? ', ' + d.kereszt : ''}!`)
          + p('Köszönjük, hogy modellként részt veszel a gyakorlónapunkon. A piercing és az ékszer is ingyenes, az ékszert megtartod.')
          + reszletek(f, d)
          + `<p style="margin:18px 0 6px">${gomb('Ott leszek ✓', ottLink)}${gomb('Lemondom', link, false)}</p>`
          + p('Kérjük, a megerősítő gombbal jelezd, hogy biztosan jössz – ha mégsem tudsz, a lemondás egy kattintás, és más megkaphatja a helyed.')
          + mitErdemesTudni()),
        szoveg: szoveg([`Megvan a helyed${d.kereszt ? ', ' + d.kereszt : ''}!`, ...reszSzoveg, '', `Megerősítés (Ott leszek): ${ottLink}`, `Lemondás / részletek: ${link}`]),
      };
    }
    case 'm48': {
      const targy = `Erősítsd meg: jössz a piercing gyakorlónapra? (${d.rovid}, ${d.ido})`;
      return {
        targy,
        html: keret(targy, 'Egy kattintás, hogy tudjuk, számíthatunk rád.',
          cim('Számíthatunk rád?')
          + p(`Két nap múlva (${h(d.nap)}) várunk a piercing gyakorlónapon. Kérjük, egy kattintással jelezd, hogy jössz – így a helyed biztos, és ha mégsem tudsz, más kaphat esélyt.`)
          + reszletek(f, d)
          + `<p style="margin:18px 0 6px">${gomb('Ott leszek ✓', ottLink)}${gomb('Lemondom', link, false)}</p>`),
        szoveg: szoveg(['Számíthatunk rád?', ...reszSzoveg, '', `Ott leszek: ${ottLink}`, `Lemondás: ${link}`]),
      };
    }
    case 'm24': {
      const megerositett = !!f.megerositve;
      const targy = megerositett ? `Holnap találkozunk! Ingyenes piercing, ${d.rovid}, ${d.ido}` : `Utolsó kérés: erősítsd meg a holnapi időpontodat (${d.ido})`;
      return {
        targy,
        html: keret(targy, megerositett ? `Érkezés: ${d.erkezes}.` : 'Egy kattintás, hogy számíthassunk rád.',
          cim(megerositett ? 'Holnap találkozunk!' : 'Holnap várunk: jössz?')
          + p(megerositett ? `Holnap ${h(d.nap)}: érkezz <b>${h(d.erkezes)}-re</b>.` : 'Holnapra szól az időpontod, de még nem erősítetted meg. Kérjük, jelezd egy kattintással, hogy jössz – ha mégsem tudsz, a lemondás is egy kattintás.')
          + reszletek(f, d)
          + `<p style="margin:18px 0 6px">${megerositett ? gomb('Részletek / lemondás', link, false) : gomb('Ott leszek ✓', ottLink) + gomb('Lemondom', link, false)}</p>`),
        szoveg: szoveg([megerositett ? 'Holnap találkozunk!' : 'Holnap várunk: jössz?', ...reszSzoveg, '', megerositett ? `Részletek / lemondás: ${link}` : `Ott leszek: ${ottLink}`]),
      };
    }
    case 'lemondas': {
      const targy = 'Lemondtuk a foglalásodat';
      return {
        targy,
        html: keret(targy, 'Köszönjük, hogy jelezted.',
          cim('Lemondtuk a foglalásodat')
          + p(`A(z) ${h(d.nap)}, ${h(d.ido)}-ra szóló ${h(d.tipus)} piercing foglalásodat lemondtuk, a helyet másnak ajánljuk fel. Köszönjük, hogy időben jelezted!`)
          + p('Ha meggondolod magad, és még van szabad hely, itt újra foglalhatsz:')
          + `<p style="margin:12px 0">${gomb('Új időpontot választok', `${alap}/modellnap`)}</p>`),
        szoveg: szoveg(['Lemondtuk a foglalásodat.', `Új foglalás: ${alap}/modellnap`]),
      };
    }
    case 'felszabadult': {
      const targy = 'A foglalásod felszabadult';
      return {
        targy,
        html: keret(targy, 'Mivel nem erősítetted meg, a helyet másnak ajánljuk.',
          cim('A foglalásod felszabadult')
          + p(`A(z) ${h(d.nap)}, ${h(d.ido)}-ra szóló ${h(d.tipus)} piercing foglalásodat – mivel nem érkezett megerősítés – felszabadítottuk, a helyet másnak ajánljuk fel.`)
          + p('Ha mégis jönnél, és még van szabad hely, itt újra foglalhatsz:')
          + `<p style="margin:12px 0">${gomb('Új időpontot választok', `${alap}/modellnap`)}</p>`),
        szoveg: szoveg(['A foglalásod felszabadult, mert nem érkezett megerősítés.', `Új foglalás: ${alap}/modellnap`]),
      };
    }
    case 'felajanlas': {
      const targy = `Felszabadult egy hely: ${d.tipus} piercing, ${d.rovid}, ${d.ido}`;
      return {
        targy,
        html: keret(targy, '30 percig a tiéd a hely: egy kattintással elfogadhatod.',
          cim('Felszabadult egy hely!')
          + p('A várólistán voltál, és felszabadult egy hely. <b>30 percig a tiéd</b>: ha el tudsz jönni, fogadd el egy kattintással.')
          + reszletek(f, d)
          + `<p style="margin:18px 0 6px">${gomb('Elfogadom a helyet ✓', link)}</p>`
          + p('Ha lejár az idő, a helyet a következő várakozónak ajánljuk fel.')),
        szoveg: szoveg(['Felszabadult egy hely! 30 percig a tiéd.', ...reszSzoveg, '', `Elfogadás: ${link}`]),
      };
    }
    default:
      throw new Error(`ismeretlen level: ${tipus}`);
  }
}
