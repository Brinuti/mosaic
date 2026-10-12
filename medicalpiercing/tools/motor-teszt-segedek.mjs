// A foglalomotor piercing-lepese ket kerdesre szurt (Kinek? + Milyen szolgaltatas?): a tesztek ezekkel a Shadow DOM-ban futo kodreszletekkel
// (sr(kod, arg): a "r" a motor shadowRoot-ja, az "a" az argumentum) keresik meg / gyujtik ossze a szolgaltatasokat.

// az osszes szolgaltatas (az osszes szuro-kombinaciobol): [{ id, nev (a teljes Salonic-nev), megjelenik (a lista soraban latszo rovid nev), ar (csak szamjegyek) }]
export const MINDEN_SZOLG = `
  const ki = [], lat = new Set();
  for (const k of ['magamnak', 'ketto']) {
    const kb = r.querySelector('[data-kinek="' + k + '"]'); if (!kb || kb.disabled) continue; kb.click();
    for (const m of ['egy', 'tobb', 'fulbevalo']) {
      const mb = r.querySelector('[data-mit="' + m + '"]'); if (!mb || mb.disabled) continue; mb.click();
      for (const x of r.querySelectorAll('[data-szolg]')) {
        if (lat.has(x.dataset.szolg)) continue; lat.add(x.dataset.szolg);
        const ar = [...x.querySelector('.ar').childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').replace(/\\D/g, '');
        ki.push({ id: x.dataset.szolg, nev: x.title, megjelenik: x.querySelector('.nev').textContent.trim(), ar, kat: k + '/' + m });
      }
    }
  }
  r.querySelector('[data-kinek="magamnak"]').click(); r.querySelector('[data-mit="egy"]').click();
  return ki;`;

// a megadott azonositoju szolgaltatas megkeresese a szurok kozott, es kattintas ra (true, ha megvolt)
export const SZOLG_KATTINT = `
  for (const k of ['magamnak', 'ketto']) {
    const kb = r.querySelector('[data-kinek="' + k + '"]'); if (!kb || kb.disabled) continue; kb.click();
    for (const m of ['egy', 'tobb', 'fulbevalo']) {
      const mb = r.querySelector('[data-mit="' + m + '"]'); if (!mb || mb.disabled) continue; mb.click();
      const x = r.querySelector('[data-szolg="' + a + '"]'); if (x) { x.click(); return true; }
    }
  }
  return false;`;
