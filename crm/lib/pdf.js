// A5 (148 x 210 mm) nyomtathato PDF a szemelyes kuruterv-hoz es a kuruzaro dokumentumhoz.
// Tiszta JS (pdf-lib + fontkit): Cloudflare Workerben es Node-ban is fut, bongeszo nem kell.
// A betutipusokat (Jost, Playfair Display - TTF, assets/fonts/pdf/) a hivo adja at bajtokkent (Workerben az ASSETS-bol, Node-ban fajlbol),
// igy ez a modul platformfuggetlen. A magyar ekezetek (o, u dupla ekezettel is) a teljes TTF-bol jonnek, nem szubset-bol.
//
//   const bajtok = await a5Pdf({ fontok: { szoveg, felkover, cim }, dok })
//
// dok = {
//   tipus: 'kuruterv' | 'kuruzaro',
//   cim, alcim,                              // fejlec (pl. "Szemelyes fejbor-apolasi tervem", "Nev - 2026. oktober 9.")
//   szakaszok: [ { cim, sorok: [[felirat, ertek], ...] } | { cim, bekezdes } | { cim, lista: [...] } ],
//   lablec: 'MOSAIC Head Spa and Hair - 1023 Budapest, Becsi ut 2.',
//   cimke: 'A5 / 1 / 11'                      // kis felirat a sarokban (nem kotelezo)
// }
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

export const A5 = { szeles: 419.53, magas: 595.28 };   // pont (148 x 210 mm)
const SZIN = { sotet: rgb(0.059, 0.227, 0.235), arany: rgb(0.62, 0.49, 0.25), szoveg: rgb(0.16, 0.2, 0.2), halk: rgb(0.42, 0.46, 0.45), vonal: rgb(0.86, 0.83, 0.76), krem: rgb(0.973, 0.953, 0.91) };
const MARGO = 28;

function tordel(szoveg, font, meret, maxSzeles) {
  const sorok = [];
  for (const bekezdes of String(szoveg ?? '').split('\n')) {
    let sor = '';
    for (const szo of bekezdes.split(/\s+/).filter(Boolean)) {
      const proba = sor ? sor + ' ' + szo : szo;
      if (font.widthOfTextAtSize(proba, meret) <= maxSzeles || !sor) sor = proba;
      else { sorok.push(sor); sor = szo; }
    }
    sorok.push(sor);
  }
  return sorok;
}

export async function a5Pdf({ fontok, dok }) {
  if (!fontok || !fontok.szoveg || !fontok.felkover || !fontok.cim) throw new Error('a5Pdf: hianyzo betutipus');
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(dok.cim || 'MOSAIC dokumentum');
  pdf.setAuthor('MOSAIC Head Spa and Hair');
  pdf.setCreator('MOSAIC CRM');
  const fSzoveg = await pdf.embedFont(fontok.szoveg, { subset: true });
  const fVastag = await pdf.embedFont(fontok.felkover, { subset: true });
  const fCim = await pdf.embedFont(fontok.cim, { subset: true });
  const szeles = A5.szeles - 2 * MARGO;
  const oldalak = [];
  let oldal; let y;

  const ujOldal = () => {
    oldal = pdf.addPage([A5.szeles, A5.magas]);
    oldalak.push(oldal);
    oldal.drawRectangle({ x: 0, y: A5.magas - 8, width: A5.szeles, height: 8, color: SZIN.sotet });
    y = A5.magas - MARGO - 6;
    if (oldalak.length === 1) {
      oldal.drawText('MOSAIC', { x: MARGO, y: y - 10, size: 13, font: fCim, color: SZIN.sotet });
      oldal.drawText('HEAD SPA AND HAIR', { x: MARGO, y: y - 20, size: 5.2, font: fVastag, color: SZIN.arany });
      if (dok.cimke) oldal.drawText(dok.cimke, { x: A5.szeles - MARGO - fSzoveg.widthOfTextAtSize(dok.cimke, 7), y: y - 10, size: 7, font: fSzoveg, color: SZIN.halk });
      y -= 40;
      for (const sor of tordel(dok.cim, fCim, 17, szeles)) { oldal.drawText(sor, { x: MARGO, y, size: 17, font: fCim, color: SZIN.sotet }); y -= 21; }
      if (dok.alcim) { for (const sor of tordel(dok.alcim, fSzoveg, 9, szeles)) { oldal.drawText(sor, { x: MARGO, y, size: 9, font: fSzoveg, color: SZIN.halk }); y -= 12; } }
      y -= 4;
      oldal.drawLine({ start: { x: MARGO, y }, end: { x: A5.szeles - MARGO, y }, thickness: 0.8, color: SZIN.arany });
      y -= 16;
    } else y -= 8;
  };
  const hely = (mennyi) => { if (y - mennyi < MARGO + 22) ujOldal(); };

  ujOldal();
  for (const sz of dok.szakaszok || []) {
    hely(34);
    if (sz.cim) { oldal.drawText(String(sz.cim).toUpperCase(), { x: MARGO, y, size: 6.8, font: fVastag, color: SZIN.arany }); y -= 12; }
    if (sz.sorok) {
      for (const [felirat, ertek] of sz.sorok) {
        const ertekSorok = tordel(ertek || '-', fSzoveg, 8.6, szeles - 92);
        hely(ertekSorok.length * 11 + 4);
        oldal.drawText(String(felirat), { x: MARGO, y, size: 7.4, font: fVastag, color: SZIN.sotet });
        for (const sor of ertekSorok) { oldal.drawText(sor, { x: MARGO + 92, y, size: 8.6, font: fSzoveg, color: SZIN.szoveg }); y -= 11; }
        y -= 3;
      }
    }
    if (sz.bekezdes) {
      for (const sor of tordel(sz.bekezdes, fSzoveg, 8.8, szeles)) { hely(12); oldal.drawText(sor, { x: MARGO, y, size: 8.8, font: fSzoveg, color: SZIN.szoveg }); y -= 11.5; }
    }
    if (sz.lista) {
      for (const elem of sz.lista) {
        const sorok = tordel(elem, fSzoveg, 8.8, szeles - 12);
        hely(sorok.length * 11.5 + 2);
        oldal.drawCircle({ x: MARGO + 3, y: y + 2.8, size: 1.5, color: SZIN.arany });
        for (const sor of sorok) { oldal.drawText(sor, { x: MARGO + 12, y, size: 8.8, font: fSzoveg, color: SZIN.szoveg }); y -= 11.5; }
        y -= 2;
      }
    }
    y -= 8;
  }
  oldalak.forEach((o, i) => {
    o.drawLine({ start: { x: MARGO, y: MARGO + 8 }, end: { x: A5.szeles - MARGO, y: MARGO + 8 }, thickness: 0.5, color: SZIN.vonal });
    if (dok.lablec) o.drawText(dok.lablec, { x: MARGO, y: MARGO - 2, size: 6.4, font: fSzoveg, color: SZIN.halk });
    if (oldalak.length > 1) { const s = `${i + 1}/${oldalak.length}`; o.drawText(s, { x: A5.szeles - MARGO - fSzoveg.widthOfTextAtSize(s, 6.4), y: MARGO - 2, size: 6.4, font: fSzoveg, color: SZIN.halk }); }
  });
  return pdf.save();
}

/** Node / teszt: a betutipusok beolvasasa az assets/fonts/pdf mappabol */
export async function fontokNodeBol(gyoker) {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const o = (f) => new Uint8Array(fs.readFileSync(path.join(gyoker, 'assets/fonts/pdf', f)));
  return { szoveg: o('Jost_400Regular.ttf'), felkover: o('Jost_600SemiBold.ttf'), cim: o('PlayfairDisplay_500Medium.ttf') };
}
