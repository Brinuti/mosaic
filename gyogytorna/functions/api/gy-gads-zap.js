// /api/gy-gads-zap - a logika: lib/motor-szerver.js (gadsZapVegpont)
import { burok } from '../../lib/burok.js';
import { gadsZapVegpont } from '../../lib/motor-szerver.js';

export const onRequest = burok('gy-gads-zap', gadsZapVegpont);
