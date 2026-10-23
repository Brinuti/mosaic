// Az idopont-elotoltes probaja (2026-10-23, Feri: "nagyon tesztelj oda-vissza ... ne ragadjon be semmi"). Valodi foglalas NINCS (az adatlapig nem lep),
// a Salonic fele csak olvaso GET megy; a naptar-API kereseit a teszt figyeli, es szandekosan elrontja (hiba, lassu, idotullepes).
//
//   node tools/build.mjs && node tools/serve.mjs     (masik ablakban)
//   node tools/motor-elotoltes-teszt.mjs [--mobil]
//   BASE=https://<elonezet> node tools/motor-elotoltes-teszt.mjs [--mobil]
//
// Esetek:
//   A  alap: a lista utan a ket elso kartya elotoltodik (kartyankent 2 keres), a valasztott elotoltott piercing naptara UJ KERES NELKUL, gyorsan jelenik meg
//   B  nem elotoltott piercing: a kattintaskor ugyanugy betolt (mint eddig); a Reszletek-nyitas elotolt; plafon: legfeljebb 4 elotoltes
//   C  az elotoltes hibat kap (500): a valasztaskor a naptar ujra lekeri es megjelenik, nincs hiba-kepernyo
//   D  lassu elotoltes (4 mp): a valasztas a mar futo kerest varja meg, nem indit ujat, a naptar megjelenik (nem ragad be), kozben latszik a toltes
//   E  az elotoltes valasza 20 mp-ig nem jon: 6 mp utan friss tartalek-keres indul, a naptar ~7-8 mp alatt megjelenik (nem varja ki a 15 mp-es idokorlatot)
//   I  a Salonic minden kerese hibas: a regi hiba-kepernyo (tartalek-link a Salonicra) megjelenik, nem ragad be a "betoltes"
//   J  a valasztaskori (nem elotoltott) keres hibat kap, de az ujraprobalas sikeres: a naptar megjelenik, hiba-kepernyo nincs
//   F  helyszincsere az elotoltes elott: a regi helyszinre nem megy elotoltes, az uj helyszin naptara jo helyszinrol jon
//   G  vissza a listara, masik (elotoltott) piercing: azonnal megjelenik
//   H  a pointerdown (gomb erintese) is elotolt; a kattintas utja valtozatlan
import { chromium, devices } from './pw.mjs';
const BASE = (process.env.BASE || 'http://www.medicalpiercing.hu:4290').replace(/\/$/, '');
const ELES = !!process.env.BASE;
const MOBIL = process.argv.includes('--mobil');
const SZABAD = /^https:\/\/(medicalpiercing\.salonic\.hu\/(selectLocation|selectSpecialization|showServices|selectDate)\/|api\.salonic\.hu\/calendar\/getAvailableTimes)/;
const NAPTAR = /api\.salonic\.hu\/calendar\/getAvailableTimes/;
const b = await chromium.launch(ELES ? {} : { args: ['--host-resolver-rules=MAP www.medicalpiercing.hu 127.0.0.1'] });
let hiba = 0;
const ok = (nev, felt, info = '') => { console.log(`${felt ? 'OK  ' : 'HIBA'} ${MOBIL ? 'mobil' : 'asztali'}: ${nev}${info ? '  ' + info : ''}`); if (!felt) hiba++; return felt; };
const alszik = (ms) => new Promise((r) => setTimeout(r, ms));

// egy uj bongeszo-kontextus a naptar-keresek naplojaval es allithato "zavarral"
async function kontextus() {
  const ctx = await b.newContext(MOBIL ? { ...devices['Pixel 5'], locale: 'hu-HU' } : { viewport: { width: 1440, height: 900 }, locale: 'hu-HU' });
  const naplo = []; // { sid, place, days, t, mod }
  const zavar = { mod: 'normal', db: Infinity }; // mod: normal | hiba | lassu:<ms> ; db: ennyi naptar-keresre ervenyes
  await ctx.route((u) => !u.toString().startsWith(BASE), async (r) => {
    const req = r.request(), url = req.url();
    if (!(req.method() === 'GET' && SZABAD.test(url))) return r.abort();
    if (!NAPTAR.test(url)) return r.continue();
    const q = new URL(url).searchParams;
    const mod = zavar.db > 0 ? zavar.mod : 'normal';
    if (zavar.db > 0 && zavar.mod !== 'normal') zavar.db--;
    naplo.push({ sid: q.get('serviceId'), place: q.get('placeId'), days: +q.get('days'), t: Date.now(), mod });
    if (mod === 'hiba') return r.fulfill({ status: 500, body: 'teszt-hiba' });
    if (mod.startsWith('lassu:')) { await alszik(+mod.slice(6)); try { return await r.continue(); } catch (e) { return; } }
    return r.continue();
  });
  const p = await ctx.newPage();
  const jsHiba = []; p.on('pageerror', (e) => jsHiba.push(e.message));
  const sr = (fn, a) => p.evaluate(([fn, a]) => { const x = document.querySelector('[data-mp-motor]'); return x ? new Function('r', 'a', fn)(x.shadowRoot, a) : null; }, [fn, a]);
  const varj = async (felt, a, ms = 40000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await sr(felt, a)) return Date.now() - t0; await alszik(100); } return -1; };
  return { ctx, p, sr, varj, naplo, zavar, jsHiba };
}
// motor megnyitasa, uj vendeg, helyszin -> a piercing-lista
async function listaig(k, placeId = 6029) {
  await k.p.goto(BASE + '/idopontfoglalas?motor=1', { waitUntil: 'load' });
  if (await k.varj('return !!r.querySelector("[data-tipus=uj]")') < 0) return false;
  await k.sr('r.querySelector("[data-tipus=uj]").click()');
  if (await k.varj('return !!r.querySelector(`[data-hely="${a}"]`)', placeId) < 0) return false;
  await k.sr('r.querySelector(`[data-hely="${a}"]`).click()', placeId);
  return (await k.varj('return r.querySelectorAll("[data-szolg]").length > 3')) >= 0;
}
const SZOLGOK = 'return [...r.querySelectorAll("[data-szolg]")].map(x => x.dataset.szolg)';
const NAPTAR_KESZ = 'return !!r.querySelector("[data-slot]") && !r.querySelector(".toltes")';
const HIBA_KEP = 'return !!r.querySelector(".hiba, [data-ujra]") || /hiba|nem sikerült/i.test((r.querySelector(".uzenet")||{}).textContent||"")';
const kattint = (k, id) => k.sr('const x = r.querySelector(`[data-szolg="${a}"]`); if (x) { x.click(); return true; } return false', id);
const keresek = (k, sid, utan = 0) => k.naplo.filter((x) => x.sid === sid && x.t >= utan);
const elotoltott = (k) => [...new Set(k.naplo.map((x) => x.sid))];

// A + G + H
{
  const k = await kontextus();
  ok('A: a piercing-lista megnyilik (Budapest)', await listaig(k));
  const lista = await k.sr(SZOLGOK);
  await alszik(2500);
  const elo = elotoltott(k);
  ok('A: pontosan a ket elso kartya toltodott elo', elo.length === 2 && elo.includes(lista[0]) && elo.includes(lista[1]), `elotoltve: ${elo.join(',')} | elso ketto: ${lista.slice(0, 2).join(',')}`);
  ok('A: kartyankent 2 keres (0-21. es 21-100. nap)', elo.every((s) => keresek(k, s).length === 2) && elo.every((s) => keresek(k, s).map((x) => x.days).sort((a, c) => a - c).join() === '21,79'),
    k.naplo.map((x) => `${x.sid}/${x.days}`).join(' '));
  const t0 = Date.now();
  ok('A: az elotoltott elso piercing gombja mukodik', await kattint(k, lista[0]));
  const ido = await k.varj(NAPTAR_KESZ, null, 20000);
  ok('A: a naptar megjelenik, szabad idopontokkal', ido >= 0, `${ido} ms`);
  ok('A: a naptar gyorsan jon (< 1,5 mp)', ido >= 0 && ido < 1500, `${ido} ms`);
  await alszik(1500);
  ok('A: a valasztaskor NEM ment uj naptar-keres (a gyorsitotarbol jott)', keresek(k, lista[0], t0).length === 0, `${keresek(k, lista[0], t0).length} uj keres`);
  // G: vissza a listara, a masodik (elotoltott) piercing
  await k.sr('const x = r.querySelector("[data-vissza]") || r.querySelector(`[data-lepes="szolg"]`); if (x) x.click()');
  ok('G: vissza a piercing-listara', (await k.varj('return r.querySelectorAll("[data-szolg]").length > 3', null, 10000)) >= 0);
  const t1 = Date.now();
  await kattint(k, lista[1]);
  const ido2 = await k.varj(NAPTAR_KESZ, null, 20000);
  ok('G: a masodik (elotoltott) piercing naptara is gyorsan, uj keres nelkul', ido2 >= 0 && ido2 < 1500 && keresek(k, lista[1], t1).length === 0, `${ido2} ms, ${keresek(k, lista[1], t1).length} uj keres`);
  // H: pointerdown egy harmadik kartya gombjan elotolt, a kattintas utja valtozatlan
  await k.sr('const x = r.querySelector("[data-vissza]") || r.querySelector(`[data-lepes="szolg"]`); if (x) x.click()');
  await k.varj('return r.querySelectorAll("[data-szolg]").length > 3', null, 10000);
  const harmadik = lista[2];
  const tH = Date.now();
  await k.sr('const x = r.querySelector(`[data-szolg="${a}"]`); x.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true }));', harmadik);
  await alszik(2500);
  ok('H: a gomb lenyomasa (pointerdown) elotolt', keresek(k, harmadik, tH).length === 2, `${keresek(k, harmadik, tH).length} keres`);
  const tH2 = Date.now();
  await kattint(k, harmadik);
  const ido3 = await k.varj(NAPTAR_KESZ, null, 20000);
  ok('H: utana a kattintas a naptarat nyitja, uj keres nelkul', ido3 >= 0 && keresek(k, harmadik, tH2).length === 0, `${ido3} ms`);
  ok('A-H: nincs JS-hiba', k.jsHiba.length === 0, k.jsHiba.join(' | '));
  await k.ctx.close();
}

// B: nem elotoltott piercing + Reszletek + plafon
{
  const k = await kontextus();
  await listaig(k);
  const lista = await k.sr(SZOLGOK);
  await alszik(2000);
  // 6 kartya Reszletek-nyitasa -> a plafon miatt osszesen legfeljebb 4 elotoltott piercing
  for (const id of lista.slice(2, 8)) { await k.sr('const x = r.querySelector(`[data-nyit="${a}"]`); if (x) x.click()', id); await alszik(150); }
  await alszik(2500);
  ok('B: a Reszletek-nyitas elotolt (3. kartya)', keresek(k, lista[2]).length === 2);
  ok('B: plafon: legfeljebb 4 elotoltott piercing egy megnyitasban', elotoltott(k).length <= 4, `${elotoltott(k).length}`);
  const nemElo = lista.find((s) => !elotoltott(k).includes(s));
  const t0 = Date.now();
  await kattint(k, nemElo);
  const ido = await k.varj(NAPTAR_KESZ, null, 25000);
  ok('B: a nem elotoltott piercing naptara a kattintaskor betolt (mint eddig)', ido >= 0 && keresek(k, nemElo, t0).length === 2, `${ido} ms, ${keresek(k, nemElo, t0).length} keres`);
  ok('B: nincs JS-hiba', k.jsHiba.length === 0, k.jsHiba.join(' | '));
  await k.ctx.close();
}

// C: az elotoltes hibat kap
{
  const k = await kontextus();
  k.zavar.mod = 'hiba'; k.zavar.db = 1000;
  await listaig(k);
  const lista = await k.sr(SZOLGOK);
  await alszik(3000);
  ok('C: az elotoltes kereset elrontottuk (500)', k.naplo.some((x) => x.mod === 'hiba'), `${k.naplo.length} keres`);
  k.zavar.mod = 'normal'; k.zavar.db = 0;
  ok('C: a lista hiba utan is hasznalhato (nincs hiba-kepernyo)', !(await k.sr(HIBA_KEP)) && (await k.sr(SZOLGOK)).length === lista.length);
  const t0 = Date.now();
  await kattint(k, lista[0]);
  const ido = await k.varj(NAPTAR_KESZ, null, 25000);
  ok('C: a valasztaskor a naptar ujra lekerve megjelenik', ido >= 0 && keresek(k, lista[0], t0).length >= 1, `${ido} ms, ${keresek(k, lista[0], t0).length} uj keres`);
  ok('C: nincs JS-hiba', k.jsHiba.length === 0, k.jsHiba.join(' | '));
  await k.ctx.close();
}

// D: lassu elotoltes (4 mp)
{
  const k = await kontextus();
  k.zavar.mod = 'lassu:4000'; k.zavar.db = 4; // a 2 elotoltott kartya 2-2 kerese lassu
  await listaig(k);
  const lista = await k.sr(SZOLGOK);
  await alszik(800); // az elotoltes mar fut (300 ms utan indul), de meg nem jott valasz
  const t0 = Date.now();
  await kattint(k, lista[0]);
  ok('D: kozben a "betoltes" latszik', !!(await k.sr('return !!r.querySelector(".toltes")')));
  const ido = await k.varj(NAPTAR_KESZ, null, 25000);
  ok('D: a naptar megjelenik (nem ragad be)', ido >= 0, `${ido} ms`);
  ok('D: a valasztas a futo kerest varta meg, nem inditott ujat', keresek(k, lista[0], t0).length === 0, `${keresek(k, lista[0], t0).length} uj keres`);
  ok('D: nem lassabb, mint a lassu keres maga (4 mp kesleltetes + a Salonic valaszideje, < 7 mp)', ido >= 0 && ido < 7000, `${ido} ms`);
  ok('D: nincs JS-hiba', k.jsHiba.length === 0, k.jsHiba.join(' | '));
  await k.ctx.close();
}

// E: az elotoltes valasza 20 mp-ig nem jon
{
  const k = await kontextus();
  k.zavar.mod = 'lassu:20000'; k.zavar.db = 4;
  await listaig(k);
  const lista = await k.sr(SZOLGOK);
  await alszik(800);
  await kattint(k, lista[0]);
  const ido = await k.varj(`${NAPTAR_KESZ.replace('return ', 'return (')}) || (${HIBA_KEP.replace('return ', '')})`, null, 45000);
  const naptar = await k.sr(NAPTAR_KESZ);
  ok('E: nem ragad be: a naptar megjelenik', ido >= 0 && !!naptar, `${ido} ms, ${naptar ? 'naptar' : 'hiba-kepernyo / semmi'}`);
  ok('E: a tartalek-keres miatt 10 mp alatt (nem varja ki a beragadt kerest)', ido >= 0 && ido < 10000, `${ido} ms`);
  ok('E: nincs JS-hiba', k.jsHiba.length === 0, k.jsHiba.join(' | '));
  await k.ctx.close();
}

// I: minden naptar-keres hibas -> hiba-kepernyo
{
  const k = await kontextus();
  await listaig(k);
  const lista = await k.sr(SZOLGOK);
  k.zavar.mod = 'hiba'; k.zavar.db = 100000;
  await kattint(k, lista[5]);
  const ido = await k.varj('return /Most nem siker/.test((r.querySelector(".uzenet") || {}).textContent || "") && !!r.querySelector("a.gomb[href*=salonic]")', null, 30000);
  const szoveg = await k.sr('return ((r.querySelector(".uzenet") || {}).textContent || "") + " | " + ((r.querySelector("a.gomb") || {}).href || "")');
  ok('I: minden hiba eseten 30 mp-en belul a hiba-kepernyo jon, Salonic-linkkel (nem ragad be a betoltes)', ido >= 0 && !(await k.sr('return !!r.querySelector(".toltes")')), `${ido} ms | ${szoveg.slice(0, 160)}`);
  ok('I: nincs JS-hiba', k.jsHiba.length === 0, k.jsHiba.join(' | '));
  await k.ctx.close();
}

// J: a valasztaskori keres hibas, az ujraprobalas jo
{
  const k = await kontextus();
  await listaig(k);
  const lista = await k.sr(SZOLGOK);
  await alszik(2500);
  const nemElo = lista.find((x) => !elotoltott(k).includes(x));
  k.zavar.mod = 'hiba'; k.zavar.db = 2; // az adapter 1 ujraprobalasa is hibas -> az elso keres elbukik; a tartalek mar jo
  const t0 = Date.now();
  await kattint(k, nemElo);
  const ido = await k.varj(NAPTAR_KESZ, null, 25000);
  ok('J: az elso keres hibaja utan a tartalek-keres a naptarat hozza', ido >= 0, `${ido} ms, ${keresek(k, nemElo, t0).length} keres`);
  ok('J: nincs JS-hiba', k.jsHiba.length === 0, k.jsHiba.join(' | '));
  await k.ctx.close();
}

// F: helyszincsere az elotoltes elott
{
  const k = await kontextus();
  await listaig(k, 6029);
  // azonnal (a 300 ms-os elotoltes elott) vissza a helyszinekhez, es Debrecen
  await k.sr('const x = r.querySelector(`[data-lepes="hely"]`) || r.querySelector("[data-vissza]"); if (x) x.click()');
  const vissza = await k.varj('return !!r.querySelector(`[data-hely="11424"]`)', null, 10000);
  ok('F: vissza a helyszinekhez', vissza >= 0);
  await k.sr('r.querySelector(`[data-hely="11424"]`).click()');
  await k.varj('return r.querySelectorAll("[data-szolg]").length > 3', null, 20000);
  await alszik(2500);
  ok('F: a regi helyszinre (Budapest) nem ment elotoltes', !k.naplo.some((x) => x.place === '6029'), k.naplo.map((x) => x.place).join(','));
  ok('F: az uj helyszinre (Debrecen) igen', k.naplo.some((x) => x.place === '11424'));
  const lista = await k.sr(SZOLGOK);
  const t0 = Date.now();
  await kattint(k, lista[0]);
  const ido = await k.varj(`${NAPTAR_KESZ.replace('return ', 'return (')}) || !!r.querySelector(".uzenet")`, null, 20000);
  ok('F: a Debreceni naptar megjelenik, uj keres nelkul', ido >= 0 && keresek(k, lista[0], t0).length === 0, `${ido} ms`);
  ok('F: nincs JS-hiba', k.jsHiba.length === 0, k.jsHiba.join(' | '));
  await k.ctx.close();
}

await b.close();
console.log(hiba ? `\n${hiba} HIBA` : '\nMINDEN RENDBEN');
process.exit(hiba ? 1 : 0);
