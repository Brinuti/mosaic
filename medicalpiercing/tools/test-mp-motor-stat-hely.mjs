// A /api/mp-motor-stat helyszines bovitese (2026-10-25): melyik tablaba ir, ervenytelen helyszin elutasitva.  node tools/test-mp-motor-stat-hely.mjs
import { onRequest } from '../functions/api/mp-motor-stat.js';
const futas = async (body, host = 'www.medicalpiercing.hu') => {
  const sql = []; const db = { prepare: (q) => ({ bind: (...a) => ({ run: async () => sql.push([q.trim().slice(0, 40), a]) }), run: async () => sql.push([q.trim().slice(0, 40), []]) }) };
  const r = await onRequest({ request: new Request(`https://${host}/api/mp-motor-stat`, { method: 'POST', body: JSON.stringify(body) }), env: { MP_MERES_DB: db } });
  return { st: r.status, ins: sql.filter((x) => x[0].startsWith('INSERT')).map((x) => x[0].includes('_hely') ? 'hely:' + x[1].join('|') : 'regi:' + x[1].join('|')) };
};
let h = 0; const ok = (n, f, i) => { console.log((f ? 'OK   ' : 'HIBA ') + n + (i ? '  ' + JSON.stringify(i) : '')); if (!f) h++; };
let r = await futas({ e: 'lepes', l: 'szolg', m: 1 }); ok('helyszin nelkul: csak a regi tabla', r.st === 204 && r.ins.length === 1 && r.ins[0].startsWith('regi:'), r);
r = await futas({ e: 'lepes', l: 'ido', m: 1, h: 6029 }); ok('helyszinnel: regi + helyszines', r.ins.length === 2 && r.ins[1].endsWith('|6029'), r);
r = await futas({ e: 'lepes', l: 'ido', m: 0, h: 11424, x: 1 }); ok('x=1: csak a helyszines', r.ins.length === 1 && r.ins[0].startsWith('hely:'), r);
r = await futas({ e: 'lepes', l: 'ido', m: 0, x: 1 }); ok('x=1 helyszin nelkul: a regi tabla szamol (nem vesz el adat)', r.ins.length === 1 && r.ins[0].startsWith('regi:'), r);
r = await futas({ e: 'lepes', l: 'ido', h: '6029; DROP' }); ok('rossz helyszin (szoveg): figyelmen kivul', r.ins.length === 1 && r.ins[0].startsWith('regi:'), r);
r = await futas({ e: 'lepes', l: 'ido', h: -5 }); ok('negativ helyszin: figyelmen kivul', r.ins.length === 1, r);
r = await futas({ e: 'rossz' }); ok('rossz esemeny: 400', r.st === 400, r);
console.log(h ? h + ' HIBA' : 'MINDEN RENDBEN'); process.exit(h ? 1 : 0);
