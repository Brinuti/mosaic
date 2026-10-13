// /api/gy-koszono - a logika: lib/motor-szerver.js (koszonoVegpont)
import { koszonoVegpont } from '../../lib/motor-szerver.js';
import { burok } from '../../lib/burok.js';

export const onRequest = burok('gy-koszono', koszonoVegpont);
