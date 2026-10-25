// DECISION #205: az engine-meter-diff statikus ellenorzo (tools/meres-proba/engine-meter-diff.mjs) onellenorzese: a szigoru alak-ellenorzes a tipikus "folyamatot megvaltoztato" mutaciokat fogja.
//   node --test tools/test-engine-meter-diff.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { hivasHiba, meterNelkul } from './meres-proba/engine-meter-diff.mjs';

const hivasok = (src) => { const l = []; meterNelkul(src, l); return l; };
const hibak = (src) => hivasok(src).flatMap(hivasHiba);

test('meterNelkul: a meter-hivasok es a megjegyzesek kitorlese utan a szoveg azonos a kiindulassal', () => {
  const regi = 'function f(S) { if (a) { x(); } go("A2"); }';
  assert.equal(meterNelkul('function f(S) { if (a) { x(); } meter.a2Ok("taken"); go("A2"); } // megjegyzes'), meterNelkul(regi));
  assert.notEqual(meterNelkul('function f(S) { if (a) { x(); } meter.a2Ok("taken"); go("A2"); go("A3"); }'), meterNelkul(regi), 'nem-meter kod valtozas kimutatva');
});

test('hivasHiba: engedelyezett alakok (utasitas-hatar, azonosito / tagolvasas / literal / osszehasonlitas / nowUnix())', () => {
  for (const src of [
    'a(); meter.c1(S.slots, S.staff, nowUnix());', 'if (x) { meter.a2Ok("taken"); go("A2"); }', 'S.a2Reason = "taken"; meter.a2Ok(\'taken\'); go("A2");',
    'meter.a2Ok(kind === "slot_lost" ? "redirect" : null);', 'else_(); meter.unverified(v, S.slot && S.slot.slot_id);', 'meter.open(); meter.business(b);', 'x(); meter.error("verify_failed", "C5"); meter.unverified(v, S.slot && S.slot.slot_id);',
  ]) assert.deepEqual(hibak(src), [], src);
});

test('hivasHiba: tiltott alakok kimutatva (nem utasitas-hataron: if-torzs / else-torzs / kifejezes; mellekhatasos argumentum: ertekadas, hivas, await, new, ++)', () => {
  const nem = (src) => assert.ok(hibak(src).length > 0, src);
  nem('if (c) meter.x(); stmt();'); nem('if (!S.slots.length) meter.c1(1); { track("x"); go("A1"); return null; }'); nem('else meter.a2Ok("taken"); go("A2");'); nem('x && meter.a2Ok("taken");'); nem('const m_ = 1; y = meter.a2Ok("taken");'); nem('f(meter.a2Ok("x"));');
  nem('a(); meter.c1(S.slots.reverse(), S.staff, nowUnix());'); nem('a(); meter.a2Ok((S.state = "C1"));'); nem('a(); meter.c1(go("A2"), 1, 2);'); nem('a(); meter.c1(await x(), 1, 2);'); nem('a(); meter.c1(new Date(), 1, 2);'); nem('a(); meter.c1(S.n++, 1, 2);'); nem('a(); meter.c1(() => 1, 1, 2);'); nem('a(); meter.c1(S.slots.length += 1, 1, 2);'); nem('a(); meter.c1(`${go(1)}`, 2);'); nem('a(); meter.c1(`${S.x = 1}`, 2);'); nem('a(); meter.c1(S.n >>= 1, 2);'); nem('a(); meter.c1(S.n <<= 1, 2);'); nem('a(); meter.c1(S.n ||= 1, 2);');
});

test('a masik meter-hivas utan allo meter-hivas az elozo hivas lezaro jelet kapja (nem az `else`-t, amit a torles hagyott maga utan)', () => {
  const l = hivasok('if (x) {} else meter.error("verify_failed", "C5"); // m\n meter.unverified(v, S.slot);');
  assert.deepEqual(l.map((h) => [h.nev, h.elozo]), [['error', 'else'], ['unverified', ';']]);
});
