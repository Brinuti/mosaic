// a "A foglalasod" oldal HTML-je egy konkret foglalashoz (lokalis proba): node _tmp/oldal-html.mjs <uzletag> <fiok> <uuid> <ki.html> [allapot]
import fs from 'node:fs';
import { foglalasOldal } from '../../../netlify/lib/lifecycle/oldal.js';
import { helyiEpoch } from '../../../netlify/lib/lifecycle/ido.js';
const [uzletag, fiok, id, ki, allapot] = process.argv.slice(2);
const r = foglalasOldal({ token: 'abc', uzletag, allapot: allapot || 'aktiv', fiok, id, kezdet: helyiEpoch(2026, 10, 21, 11, 0), szolgaltatas: uzletag === 'hair' ? 'Fodrász konzultáció (9.900 Ft helyett most 0 Ft!)' : 'EGYÉNI 50 perces MOSAIC "Relax" Head Spa kezelés + 30 perc hajszárítás', salonicUrl: `https://${fiok}.salonic.hu/booking/bookingDetails/${id}` });
fs.writeFileSync(ki, await r.text());
console.log('ok', ki);
