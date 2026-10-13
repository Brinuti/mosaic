// /api/gy-foglalas - a logika: lib/motor-szerver.js (foglalasVegpont)
import { foglalasVegpont } from '../../lib/motor-szerver.js';
import { burok } from '../../lib/burok.js';

export const onRequest = burok('gy-foglalas', foglalasVegpont);
