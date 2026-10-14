// /api/gy-suti-config - a logika: lib/motor-szerver.js (sutiConfigVegpont)
import { sutiConfigVegpont } from '../../lib/motor-szerver.js';
import { burok } from '../../lib/burok.js';

export const onRequest = burok('gy-suti-config', sutiConfigVegpont);
