// Kozos dobozok, amelyeket a kategoria-epito (kategoria.mjs) es a tukor-sablon (sablon.mjs) is ugyanugy rajzol (a tulajdonos kerese, 2026-10-16:
// ugyanaz a doboz mindenhol ugyanugy nezzen ki). A stilus: assets/css/uj-egyseges.css.

// a 93%-os statisztika: nagy kep + a szam, a mondat es a foglalas gomb; a lablec-jegyzet ("* Az osszes szuras szama ...") teljes szelessegben alul
export function statDoboz({ kep, alt = '', szam, mondat, lab = [], gomb = { szoveg: 'Időpontot foglalok', href: '/idopontfoglalas' } }) {
  return `<article class="stat-doboz">
    <img class="stat-kep" src="${kep}" alt="${alt}" loading="lazy" decoding="async">
    <div class="stat-szoveg">
      <p class="stat-szam">${szam}</p>
      ${mondat ? `<p class="stat-mondat">${mondat}</p>` : ''}
      <a class="gomb gomb-tomor" href="${gomb.href}">${gomb.szoveg}<svg class="ik ik-nyil" aria-hidden="true"><use href="#i-chev"/></svg></a>
    </div>
    ${lab.length ? `<div class="stat-lab">${lab.map((x) => `<p>${x}</p>`).join('')}</div>` : ''}
  </article>`;
}

// az "Így néz ki egy ... behelyezés" videok melle (2026-10-16, 5. kor: a video melletti ures hasab helyett a behelyezes lepesei - a videoban elhangzottak szerint, a szuras folyamata oldallal egyezoen)
export const BEVIDEO_LEPESEK = `<ol class="bevideo-lepesek">${[['Fertőtlenítés', 'alapos tisztítás, steril, egyszer használatos eszközök'], ['Gépi bemérés', 'hajszálpontosan megkeressük az ingerpontot a füledben'], ['Érzéstelenítés és szúrás', 'fagyasztó spray, a szúrás csak egy pillanat'], ['Titán ékszer', 'anatómiailag illeszkedő G23 titánium']].map(([c, t]) => `<li><b>${c}</b><span>${t}</span></li>`).join('')}</ol>
      <a class="szoveg-link bevideo-link" href="/a-szuras-folyamata">A szúrás folyamata lépésről lépésre »</a>`;
