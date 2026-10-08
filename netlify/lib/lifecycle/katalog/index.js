// A teljes uzenet-katalogus (a motor ezt olvassa). Szerkezet: SEMA.md; ellenorzes: tools/lifecycle-teszt/katalog.test.mjs
import headspa from './headspa.js';
import hair from './hair.js';
import oxygen from './oxygen.js';
import laser from './laser.js';
import pmu from './pmu.js';
import kozos from './kozos.js';

export const KATALOG = Object.freeze({ headspa, hair, oxygen, laser, pmu });
export const KOZOS = kozos;
