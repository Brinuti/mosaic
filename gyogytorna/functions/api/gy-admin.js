// /api/gy-admin - a logika: lib/motor-szerver.js (adminVegpont)
import { adminVegpont } from '../../lib/motor-szerver.js';
import { burok } from '../../lib/burok.js';

export const onRequest = burok('gy-admin', adminVegpont);
