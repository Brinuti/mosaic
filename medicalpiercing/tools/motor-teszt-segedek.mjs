// A foglalomotor piercing-lepese (2026-10-20 ota szurosor nelkul: MINDEN lehetoseg egy listaban): a tesztek ezekkel a Shadow DOM-ban futo kodreszletekkel
// (sr(kod, arg): a "r" a motor shadowRoot-ja, az "a" az argumentum) keresik meg / gyujtik ossze a szolgaltatasokat.

// az osszes szolgaltatas: [{ id, nev (a teljes Salonic-nev), megjelenik (a lista soraban latszo rovid nev), ar (csak szamjegyek) }]
export const MINDEN_SZOLG = `
  const ki = [];
  for (const x of r.querySelectorAll('[data-szolg]')) {
    const ar = [...x.querySelector('.ar').childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').replace(/\\D/g, '');
    ki.push({ id: x.dataset.szolg, nev: x.title, megjelenik: x.querySelector('.nev').textContent.trim(), ar, kat: '' });
  }
  return ki;`;

// a megadott azonositoju szolgaltatas megkeresese a listaban, es kattintas ra (true, ha megvolt)
export const SZOLG_KATTINT = `
  const x = r.querySelector('[data-szolg="' + a + '"]'); if (x) { x.click(); return true; }
  return false;`;
