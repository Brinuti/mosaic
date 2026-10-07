// Az osszes SMS (uzletagonkent + kozos) adatai a tulajdonosi attekinto tablahoz: sablon, kitoltott pelda, mikor megy, kinek, hossz.
import fs from 'node:fs';
import { KATALOG, KOZOS } from '../../../netlify/lib/lifecycle/katalog/index.js';
import { ertekek, smsKirajzol } from '../../../netlify/lib/lifecycle/render.js';
import { helyiEpoch } from '../../../netlify/lib/lifecycle/ido.js';

const BAZIS = 'https://www.mosaicheadspa.hu';
const MINTA_SZOLG = {
  headspa: { fizetos: 'EGYÉNI 50 perces MOSAIC "Relax" Head Spa kezelés + 30 perc hajszárítás', ajandekkartya: 'Ajándékkártyás Head Spa kezelés', paros: '💆‍♀️💆‍♀️ PÁROS MOSAIC Head Spa kezelés (50 perc + Szárítás)', negykezes: 'Négykezes Head Spa kezelés', egyeni: 'EGYÉNI 50 perces MOSAIC "Relax" Head Spa kezelés + 30 perc hajszárítás', hair: 'EGYÉNI 50 perces MOSAIC "Hair" Head Spa kezelés + 30 perc hajszárítás' },
  hair: { konzultacio: 'Fodrász konzultáció', festes: 'Tőfestés + Szárítás - Hosszú haj', nagy_valtozas: 'Balayage + Szárítás - Hosszú haj', vagas_kezeles: 'Női hajvágás + Szárítás - Hosszú haj' },
  oxygen: { konzultacio: 'Hajkamerás vizsgálat (konzultáció)', elso: 'Haj Oxigénterápia - 1. alkalom', visszatero: 'Haj Oxigénterápia - 2. alkalomtól' },
  laser: { konzultacio: 'Ingyenes konzultáció', elso: 'Szőrtelenítés - első kezelés', visszatero: 'Szőrtelenítés - visszatérő kezelés' },
  pmu: { konzultacio: 'Ingyenes konzultáció', fizetos: 'Ajaktetoválás - Aquarell', korrekcio: 'Korrekció', eltavolitas: 'Sminktetoválás eltávolítás' },
};
const ALAP_SZEGMENS = { headspa: 'fizetos', hair: 'konzultacio', oxygen: 'elso', laser: 'konzultacio', pmu: 'konzultacio' };
const MUNKATARS = { headspa: 'Sole', hair: 'Evelin', oxygen: 'Vivien', laser: 'Zsófi', pmu: 'Melitta' };
const SZEG_NEV = {
  headspa: { fizetos: 'fizetős foglalás', ajandekkartya: 'ajándékkártyás', paros: 'páros', negykezes: 'négykezes', egyeni: 'egyéni', hair: 'Hair HeadSpa' },
  hair: { konzultacio: 'konzultáció', festes: 'festés', nagy_valtozas: 'nagy változás (balayage, szőkítés, teljes festés, melír)', vagas_kezeles: 'vágás, szárítás, kezelés' },
  oxygen: { konzultacio: 'konzultáció (hajkamerás vizsgálat)', elso: 'első alkalom', visszatero: '2. alkalomtól' },
  laser: { konzultacio: 'ingyenes konzultáció', elso: 'első kezelés', visszatero: 'visszatérő vendég' },
  pmu: { konzultacio: 'ingyenes konzultáció', fizetos: 'fizetős kezelés', korrekcio: 'korrekció', eltavolitas: 'eltávolítás' },
};
const UZLET_NEV = { headspa: 'Head Spa', hair: 'Fodrász (MOSAIC Hair)', oxygen: 'Oxigénterápia', laser: 'Lézeres szőrtelenítés', pmu: 'PMU (sminktetoválás)', kozos: 'Minden üzletág (közös)' };
const mikor = (m) => ({
  t0: 'Azonnal a foglalás után (a Salonic-értesítő beérkezése után 1–2 perccel)',
  t72: '72 órával az időpont előtt. Csak ha a foglalás legalább 96 órával az időpont előtt történt. Ha a vendég már megerősítette az időpontot, kimarad.',
  t24: '24 órával az időpont előtt. Csak ha a foglalás legalább 30 órával az időpont előtt történt.',
  lemondva: 'Azonnal, ha a vendég lemondja az időpontot',
  athelyezve: 'Azonnal, ha a vendég áthelyezi az időpontot',
  nem_jelent_meg: 'Ha a szalon kitörli az időpontot az időpont után (vagy a lemondás okaként ezt írja: „nem jelent meg”). Az időpont napján jelzett no-show-ra másnap 10:00-kor megy; későbbi jelzésre nappal fél óra múlva, reggel 10:00-kor, este másnap 10:00-kor. Ugyanekkor e-mail is megy.',
}[m.tipus] || m.tipus);

const kezdet = helyiEpoch(2026, 11, 25, 16, 0);
const ujKezdet = helyiEpoch(2026, 11, 26, 17, 30);
const sorok = [];
function felvesz(uzletag, uz, sablonUzletag) {
  const szeg = (uz.szegmensek && uz.szegmensek[0]) || ALAP_SZEGMENS[sablonUzletag] || null;
  const szolg = (MINTA_SZOLG[sablonUzletag] || {})[szeg] || 'Kezelés';
  const f = { id: 'minta', uzletag: sablonUzletag, fiok: 'minta', nev: 'Minta Réka', keresztnev: 'Réka', telefon: '+36201234567', email: 'minta@example.com', szolgaltatas: szolg, szegmens: [szeg], munkatars: MUNKATARS[sablonUzletag], kezdet, letrehozva: kezdet - 20 * 86400, allapot: 'aktiv', token: 'a1b2c3d4e5' };
  const ert = ertekek(f, 'sms', { base: BAZIS, ujKezdet });
  const ki = smsKirajzol(uz, ert);
  const nev = SZEG_NEV[uzletag] || {};
  const kinek = uz.szegmensek ? `csak: ${uz.szegmensek.map((s) => nev[s] || s).join(' / ')}` : uz.nem_szegmensek ? `kivéve: ${uz.nem_szegmensek.map((s) => nev[s] || s).join(' / ')}` : 'mindenkinek';
  sorok.push({ uzletag, uzletNev: UZLET_NEV[uzletag], id: uz.id, mikor: mikor(uz.mikor), tipus: uz.mikor.tipus, kinek, sablon: uz.szoveg, pelda: ki.szoveg, karakter: [...ki.szoveg].length, szegmens: ki.szegmens });
}
for (const [uzletag, kat] of Object.entries(KATALOG)) for (const uz of kat.uzenetek) if (uz.csatorna === 'sms') felvesz(uzletag, uz, uzletag);
for (const uz of KOZOS.uzenetek) if (uz.csatorna === 'sms') felvesz('kozos', uz, 'hair');
fs.writeFileSync('_tmp/sms-adat.json', JSON.stringify(sorok, null, 1));
const db = {}; for (const s of sorok) db[s.uzletag] = (db[s.uzletag] || 0) + 1;
console.log(sorok.length, 'SMS', JSON.stringify(db));
for (const s of sorok.slice(0, 3)) console.log(s.id, '|', s.kinek, '|', s.szegmens, 'szegmens |', s.pelda.slice(0, 140));
