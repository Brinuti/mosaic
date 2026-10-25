// /api/gy-gads-kiigazitas - a logika: lib/motor-szerver.js (gadsKiigazitasVegpont)
import { burok } from '../../lib/burok.js';
import { gadsKiigazitasVegpont } from '../../lib/motor-szerver.js';

export const onRequest = burok('gy-gads-kiigazitas', gadsKiigazitasVegpont);
