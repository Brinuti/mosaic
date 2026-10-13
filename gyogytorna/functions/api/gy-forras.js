// /api/gy-forras - a logika: lib/motor-szerver.js (forrasVegpont)
import { forrasVegpont } from '../../lib/motor-szerver.js';
import { burok } from '../../lib/burok.js';

export const onRequest = burok('gy-forras', forrasVegpont);
