// /api/gy-kampanyok - a logika: lib/motor-szerver.js (kampanyokVegpont)
import { kampanyokVegpont } from '../../lib/motor-szerver.js';
import { burok } from '../../lib/burok.js';

export const onRequest = burok('gy-kampanyok', kampanyokVegpont);
