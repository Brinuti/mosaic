// Uzenetmotor-tesztek: node --test crm/test/uzenetek.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import KATALOG from '../lib/messages/katalog.js';
import { renderel, smsStatisztika, SMS_MAX_KARAKTER } from '../lib/messages/render.js';
import { feloldas, helyorzokKigyujt, penz, nemTorhetoSzokoz, valtozokEpit, NBSP } from '../lib/messages/valtozok.js';
import { kapuErtekel, EREDMENY, ISMERT_GATEK, kovetkezoAblak, ablakban, FELTETELEK } from '../lib/messages/kapuk.js';
import { jobokAzEsemenybol, idempotencyKulcs } from '../lib/messages/utemezo.js';
import { dryRunAdapter, elesAdapterKeszit, kuldoKeszit, konfigEnvbol } from '../lib/messages/kuldo.js';
import { ep, MOST, ORA, NAP, teljesErtekek, allapot, allapotAzonosithoz } from './uzenet-fixture.js';

const AZONOSITOK = ['T0-F', 'T0-C', 'T-72', 'T-24', 'S0', 'G0', 'P0', 'R1', 'R2', 'A1', 'A2', 'C0', 'C1', 'C2', 'N0', 'E2', 'E3', 'E5', 'E6', 'E7', 'E8', 'E9', 'E10', 'B30', 'B7', 'DOC24', 'DOC48', 'NEG', 'COMPLAINT'];
const kulcs = (id) => KATALOG.find((u) => u.id === id);
const vendegSzoveg = (u) => JSON.stringify([u.targy, u.torzs, u.szoveg]);

// ------------------------------------------------------------------ katalogus
test('K01 a katalogus pontosan a 29 elvart azonositot tartalmazza, egyediek', () => {
  assert.deepEqual(KATALOG.map((u) => u.id).sort(), [...AZONOSITOK].sort());
  assert.equal(new Set(KATALOG.map((u) => u.id)).size, KATALOG.length);
});

test('K02 kotelezo mezok, enumok, verzio=1', () => {
  for (const u of KATALOG) {
    assert.ok(['transactional', 'care', 'marketing', 'internal'].includes(u.csoport), u.id);
    assert.ok(['email', 'sms', 'internal'].includes(u.csatorna), u.id);
    assert.equal(u.verzio, 1, u.id);
    assert.ok(u.trigger && u.trigger.esemeny && Number.isFinite(u.trigger.keses_mp), `${u.id} trigger`);
    assert.ok(Array.isArray(u.gate) && Array.isArray(u.stop) && Array.isArray(u.valtozok), u.id);
    for (const g of u.gate) assert.ok(ISMERT_GATEK.includes(g), `${u.id}: ismeretlen kapu ${g}`);
    if (u.csatorna === 'sms') assert.ok(u.szoveg && !u.torzs, u.id);
    if (u.csatorna === 'email') assert.ok(u.targy && Array.isArray(u.torzs) && 'elotag' in u, u.id);
    if (u.csoport === 'internal') assert.equal(u.csatorna, 'internal');
  }
});

test('K03 a valtozok lista egyezik a szovegben szereplo helyorzokkal', () => {
  for (const u of KATALOG) {
    const szovegek = [u.targy, u.szoveg];
    const gyujt = (torzs) => {
      for (const b of torzs || []) {
        if (typeof b === 'string') szovegek.push(b);
        else if (b.szoveg) szovegek.push(b.szoveg);
      }
    };
    gyujt(u.torzs);
    const talalt = [...new Set(szovegek.flatMap((s) => helyorzokKigyujt(s || '')))].sort();
    assert.deepEqual([...u.valtozok].sort(), talalt, u.id);
    for (const o of u.valtozok_opcionalis) assert.ok(u.valtozok.includes(o), `${u.id}: opcionalis ${o} nincs a valtozok kozott`);
  }
});

test('K04 csoportok: R/A/C1/C2/N0/E8/E9/B marketing; T0/T-72/T-24/C0 tranzakcios; DOC/NEG/COMPLAINT belso', () => {
  for (const id of ['R1', 'R2', 'A1', 'A2', 'C1', 'C2', 'N0', 'E8', 'E9', 'B30', 'B7']) assert.equal(kulcs(id).csoport, 'marketing', id);
  for (const id of ['T0-F', 'T0-C', 'T-72', 'T-24', 'C0']) assert.equal(kulcs(id).csoport, 'transactional', id);
  for (const id of ['DOC24', 'DOC48', 'NEG', 'COMPLAINT']) assert.equal(kulcs(id).csoport, 'internal', id);
  for (const id of ['T-24', 'R2', 'A2', 'C2', 'N0', 'B7']) assert.equal(kulcs(id).csatorna, 'sms', id);
});

test('K05 nincs fiktiv kedvezmeny / szazalek / "-X%" a vendegszovegben; az arak csak a forras 29 900 / 4 990 Ft-ja', () => {
  for (const u of KATALOG) {
    const s = vendegSzoveg(u);
    assert.ok(!/-\s?\d+\s?%/.test(s), `${u.id}: -X%`);
    assert.ok(!/\d\s?%/.test(s), `${u.id}: szazalek`);
    assert.ok(!/kedvezm[eé]ny|(^|[^a-zéáíóöőúüű])akci[oó]|ingyen/i.test(s), `${u.id}: kedvezmeny/akcio`);
    for (const m of s.matchAll(/(\d[\d ]*) Ft/g)) assert.ok(['29 900', '4 990'].includes(m[1].trim()), `${u.id}: ar ${m[1]}`);
  }
});

test('K06 a T-24 SMS NEM igeri ujra a 48 oras lemondasi ablakot', () => {
  const t24 = kulcs('T-24');
  assert.ok(!/48/.test(t24.szoveg));
  assert.ok(!/lemond/i.test(t24.szoveg));
  const r = renderel(t24, teljesErtekek());
  assert.ok(!/48|lemond/i.test(r.szoveg));
});

test('K07 a szoveg szo szerinti atvetele: kulcsmondatok a forrasbol', () => {
  assert.match(kulcs('T0-F').torzs[2], /^Az első kezelés állapotfelméréssel együtt 80 perc, díja 29 900 Ft/);
  assert.equal(kulcs('N0').szoveg, 'Szia {{keresztnev}}! Tegnap nem találkoztunk a MOSAIC-ban. Reméljük, minden rendben. Ha szeretnél új Oxygeni időpontot egyeztetni, itt találsz szabad helyeket: {{foglalas_link}}. Kérdés esetén hívhatsz minket. MOSAIC');
  assert.equal(kulcs('G0').targy, 'Elmondod, milyen volt a MOSAIC-ban?');
  assert.equal(kulcs('E7').targy, 'Öt alkalom után: hol tartunk?');
});

// ------------------------------------------------------------------ renderelo
test('R01 minden katalogus-elem rendereleheto a fixture-vendeggel, nincs feloldatlan {{helyorzo}}', () => {
  const ert = teljesErtekek();
  for (const u of KATALOG) {
    const r = renderel(u, ert, { allapot: allapotAzonosithoz(u) });
    if (u.szovegHianyzik) { assert.equal(r.allapot, 'REQUIRES_VERIFICATION', u.id); assert.equal(r.szoveg, null); continue; }
    assert.equal(r.allapot, 'OK', `${u.id}: ${r.hianyzo}`);
    for (const mezo of [r.targy, r.html, r.szoveg]) if (mezo) assert.ok(!/\{\{|\}\}/.test(mezo), `${u.id}: feloldatlan helyorzo`);
    if (u.csatorna === 'sms') { assert.ok(r.sms.szegmens >= 1); assert.equal(r.html, null); }
    else { assert.ok(r.html.startsWith('<!doctype html>')); assert.ok(r.targy.length > 0); }
  }
});

test('R02 hianyzo kotelezo valtozo -> BLOCKED_MISSING_DATA, nem kuldheto', () => {
  for (const u of KATALOG.filter((x) => !x.szovegHianyzik)) {
    const kotelezo = u.valtozok.filter((v) => !u.valtozok_opcionalis.includes(v));
    for (const v of kotelezo) {
      if (u.id === 'P0' && v === 'javasolt_idoszak') continue; // csak akkor kotelezo, ha nincs kov_datum_ido (lasd R06)
      const ert = teljesErtekek(); delete ert[v]; ert[v] = null;
      const r = renderel(u, ert, { allapot: allapotAzonosithoz(u) });
      assert.equal(r.allapot, 'BLOCKED_MISSING_DATA', `${u.id}/${v}`);
      assert.ok(r.hianyzo.includes(v), `${u.id}/${v}`);
      assert.equal(r.html, null); assert.equal(r.szoveg, null);
    }
  }
});

test('R03 keresztnev nelkul "Szia!" (rossz nevet nem mondunk)', () => {
  const ert = teljesErtekek({ keresztnev: null }); ert.keresztnev = null;
  const sms = renderel(kulcs('C2'), ert);
  assert.match(sms.szoveg, /^Szia! Ha továbbra is/);
  const mail = renderel(kulcs('C1'), ert);
  assert.match(mail.szoveg, /^Szia!\n/);
  assert.equal(valtozokEpit({ nev: 'Fűrész Ágnes' }).keresztnev, 'Ágnes');
  assert.equal(valtozokEpit({ nev: 'Xyzzy Qwerty' }).keresztnev, null);
});

test('R04 T-72: a datum ragozott (nem "-án" a datum utan), az ido "-kor"', () => {
  const r = renderel(kulcs('T-72'), teljesErtekek());
  assert.match(r.szoveg, /október 20-án 16:00-kor várunk a MOSAIC-ban/);
});

test('R05 B30/B7: a lejarat ragozott datum, penz/szamok a szovegben', () => {
  const r = renderel(kulcs('B7'), teljesErtekek());
  assert.match(r.szoveg, /bérleted november 30-án lejár, 3 alkalom maradt rajta/);
});

test('R06 P0 feltételes sorok: kovetkezo idopont VAGY javasolt idoszak', () => {
  const van = renderel(kulcs('P0'), teljesErtekek({ kov_datum_ido: 'október 27. (kedd) 16:00' }));
  assert.match(van.szoveg, /A következő időpontod: október 27/);
  assert.ok(!/javasolt időszaka/.test(van.szoveg));
  const nincs = renderel(kulcs('P0'), teljesErtekek({ kov_datum_ido: null, javasolt_idoszak: 'két hét múlva' }));
  assert.match(nincs.szoveg, /A következő kezelés javasolt időszaka: két hét múlva\./);
  assert.ok(!/A következő időpontod/.test(nincs.szoveg));
  const semmi = teljesErtekek({ kov_datum_ido: null }); semmi.javasolt_idoszak = null;
  assert.equal(renderel(kulcs('P0'), semmi).allapot, 'BLOCKED_MISSING_DATA');
});

test('R07 E3 foglalasi CTA csak marketing opt-innel + nincs foglalas; E2 termek-bekezdes csak consenttel', () => {
  const ert = teljesErtekek();
  const nelkul = renderel(kulcs('E3'), ert); // allapot nelkul: CTA kimarad
  assert.ok(!/itt megteheted/.test(nelkul.szoveg));
  assert.ok(!/itt megteheted/.test(renderel(kulcs('E3'), ert, { allapot: allapot({ consent_email: false }) }).szoveg));
  assert.ok(!/itt megteheted/.test(renderel(kulcs('E3'), ert, { allapot: allapot({ next_active_booking: { service_type: 'followup_hair' } }) }).szoveg));
  assert.ok(!/itt megteheted/.test(renderel(kulcs('E3'), ert, { allapot: allapot({ complaint_open: true }) }).szoveg));
  assert.match(renderel(kulcs('E3'), ert, { allapot: allapot() }).szoveg, /Ha még nem foglaltad a következő alkalmat, itt megteheted: https:\/\/teszt\.example\/foglalas_link\./);
  assert.ok(!/megvásárolni/.test(renderel(kulcs('E2'), ert, { allapot: allapot({ consent_email: false }) }).szoveg));
  assert.match(renderel(kulcs('E2'), ert, { allapot: allapot() }).szoveg, /megvásárolni/);
  assert.ok(FELTETELEK.booking_cta_ok(allapot()));
});

test('R08 e-mail HTML: logo, kattinthato link, vegso irasjel nem resze a linknek, HTML-escape', () => {
  const ert = teljesErtekek(); ert.regi_datum = '<b>x</b>';
  const r = renderel(kulcs('C0'), ert);
  assert.match(r.html, /<img src="https:\/\/www\.mosaicheadspa\.hu\/assets\/img\/logo/);
  assert.match(r.html, /<a href="https:\/\/teszt\.example\/foglalas_link" style="color:#a07f4b">https:\/\/teszt\.example\/foglalas_link<\/a>\./);
  assert.ok(!r.html.includes('<b>x</b>'));
  assert.ok(r.html.includes('&lt;b&gt;x&lt;/b&gt;'));
});

test('R09 a targy egy sor (fejlec-injekcio ellen)', () => {
  const r = renderel(kulcs('DOC24'), teljesErtekek({ guest_id: 'G1\r\nBcc: x@y.hu' }));
  assert.ok(!/[\r\n]/.test(r.targy));
});

test('R10 marketing e-mail lableceben a leiratkozas-link (ha adott), tranzakcios levelben nincs', () => {
  const m = renderel(kulcs('R1'), teljesErtekek(), { leiratkozas_link: 'https://teszt.example/leir' });
  assert.match(m.html, /Leiratkozás/);
  assert.match(m.szoveg, /Leiratkozás: https:\/\/teszt\.example\/leir/);
  assert.ok(!/Leiratkozás/.test(renderel(kulcs('C0'), teljesErtekek(), { leiratkozas_link: 'https://teszt.example/leir' }).html));
  assert.ok(!/@@LABLEC@@/.test(renderel(kulcs('R1'), teljesErtekek()).html));
});

test('R11 az 29 900 Ft / telefonszam nem torheto szokozzel az e-mailben, SMS-ben nem', () => {
  const r = renderel(kulcs('T0-F'), teljesErtekek());
  assert.ok(r.szoveg.includes(`29${NBSP}900${NBSP}Ft`));
  const c = renderel(kulcs('T0-C'), teljesErtekek());
  assert.ok(c.szoveg.includes(`06${NBSP}20${NBSP}247${NBSP}4444`));
  assert.ok(renderel(kulcs('A2'), teljesErtekek()).szoveg.includes('4 990 Ft'));
});

// ------------------------------------------------------------------ SMS hossz
test('S01 SMS-szegmensek: GSM-7 160/153, UCS-2 70/67, magyar ekezetek', () => {
  assert.deepEqual([smsStatisztika('Szia!').kodolas, smsStatisztika('Szia!').szegmens], ['GSM-7', 1]);
  assert.equal(smsStatisztika('a'.repeat(160)).szegmens, 1);
  assert.equal(smsStatisztika('a'.repeat(161)).szegmens, 2);
  assert.equal(smsStatisztika('a'.repeat(306)).szegmens, 2);
  assert.equal(smsStatisztika('a'.repeat(307)).szegmens, 3);
  // e, o, u szerepel a GSM-ben, a, i, o-dupla, u-dupla nem
  assert.equal(smsStatisztika('éöü').kodolas, 'GSM-7');
  for (const c of ['á', 'í', 'ó', 'ő', 'ú', 'ű']) assert.equal(smsStatisztika(`a${c}`).kodolas, 'UCS-2', c);
  assert.equal(smsStatisztika('á'.repeat(70)).szegmens, 1);
  assert.equal(smsStatisztika('á'.repeat(71)).szegmens, 2);
  assert.equal(smsStatisztika('á'.repeat(134)).szegmens, 2);
  assert.equal(smsStatisztika('á'.repeat(135)).szegmens, 3);
  assert.equal(smsStatisztika('{'.repeat(80)).szegmens, 1); // 160 septet
  assert.equal(smsStatisztika('{'.repeat(81)).szegmens, 2);
});

test('S02 minden SMS magyar ekezettel UCS-2; a szegmensszam es figyelmeztetes szamolt', () => {
  for (const u of KATALOG.filter((x) => x.csatorna === 'sms')) {
    const r = renderel(u, teljesErtekek());
    assert.equal(r.allapot, 'OK', u.id);
    assert.equal(r.sms.kodolas, 'UCS-2', u.id);
    assert.equal(r.sms.szegmens, Math.ceil(r.sms.karakter / 67) || 1, u.id);
    assert.ok(r.sms.karakter <= SMS_MAX_KARAKTER, `${u.id}: ${r.sms.karakter} karakter`);
    assert.ok(r.figyelmeztetesek.some((f) => f.kod === 'TOBB_SZEGMENS') || r.sms.szegmens === 1, u.id);
  }
  const hosszu = renderel(kulcs('R2'), teljesErtekek({ kezelo: 'x'.repeat(500) }));
  assert.ok(hosszu.figyelmeztetesek.some((f) => f.kod === 'TUL_HOSSZU'));
});

test('S03 SMS-ben a szegmenskuszob allithato (max_szegmens)', () => {
  const r = renderel(kulcs('T-24'), teljesErtekek(), { max_szegmens: 1 });
  assert.ok(r.figyelmeztetesek.some((f) => f.kod === 'TUL_HOSSZU'));
});

// ------------------------------------------------------------------ valtozok
test('V01 feloldas es penzformatum', () => {
  assert.deepEqual(feloldas('Szia {{keresztnev}}! {{a}} {{b}}', { keresztnev: 'Réka', a: 'x' }), { szoveg: 'Szia Réka! x ', hianyzo: ['b'] });
  assert.equal(feloldas('Szia {{keresztnev}}!', {}).szoveg, 'Szia!');
  assert.equal(penz(29900), `29${NBSP}900${NBSP}Ft`);
  assert.equal(penz(4990), `4${NBSP}990${NBSP}Ft`);
  assert.equal(penz(130000), `130${NBSP}000${NBSP}Ft`);
  assert.equal(nemTorhetoSzokoz('29 900 Ft, 5 alkalom'), `29${NBSP}900${NBSP}Ft, 5 alkalom`);
  assert.equal(feloldas('{{x}}', { x: '{{y}}', y: 'Z' }).szoveg, 'y'); // az ertek nem hozhat letre uj helyorzot
});

test('V02 magyar datum es ido (Europe/Budapest, nyari es teli ido)', () => {
  const nyar = valtozokEpit({ booking_start: ep(2026, 7, 1, 9, 5) });
  assert.equal(nyar.datum, 'július 1. (szerda)'); assert.equal(nyar.ido, '09:05'); assert.equal(nyar.datum_ragos, 'július 1-jén');
  const tel = valtozokEpit({ booking_start: ep(2026, 12, 2, 16, 0) });
  assert.equal(tel.ido, '16:00'); assert.equal(tel.datum_ragos, 'december 2-án');
  assert.equal(valtozokEpit({ lejarat: ep(2026, 11, 30, 12) }).lejarat_datum_ragos, 'november 30-án');
});

test('V03 kerdoiv_link <-> allapotfelmero_link alias', () => {
  assert.equal(valtozokEpit({ allapotfelmero_link: 'https://x/y' }).kerdoiv_link, 'https://x/y');
  assert.equal(valtozokEpit({ kerdoiv_link: 'https://x/z' }).allapotfelmero_link, 'https://x/z');
});

// ------------------------------------------------------------------ kapuk
test('M10 marketing-uzenet consent nelkul SOHA (minden marketing sablon, mindket csatorna)', () => {
  for (const u of KATALOG.filter((x) => x.csoport === 'marketing')) {
    const kulcsNev = u.csatorna === 'sms' ? 'consent_sms' : 'consent_email';
    for (const consent of [false, undefined, null, 'igen', 1]) {
      const a = allapotAzonosithoz(u); a[kulcsNev] = consent;
      assert.equal(kapuErtekel(u, a).eredmeny, EREDMENY.KIHAGY, `${u.id} consent=${consent}`);
    }
    const kikapcsolt = allapotAzonosithoz(u, u.csatorna === 'sms' ? { sms_optout: true } : { email_unsubscribe: true });
    assert.equal(kapuErtekel(u, kikapcsolt).eredmeny, EREDMENY.KIHAGY, `${u.id} leiratkozva`);
    // csak a masik csatorna consentje nem eleg
    const masik = allapotAzonosithoz(u, { [kulcsNev]: false });
    assert.equal(kapuErtekel(u, masik).eredmeny, EREDMENY.KIHAGY);
    // consenttel (es megfelelo allapottal) mehet
    const jo = kapuErtekel(u, allapotAzonosithoz(u, u.id === 'B30' || u.id === 'B7' ? { unused_appointments: 2 } : {}));
    assert.equal(jo.eredmeny, EREDMENY.KULDHETO, `${u.id}: ${jo.ok}`);
  }
});

test('S02b a katalogus-gate-lista hibaja ellen is: marketing consent nelkul kihagy (hard szabaly)', () => {
  const rossz = { ...kulcs('R1'), gate: [] };
  assert.equal(kapuErtekel(rossz, allapotAzonosithoz(rossz, { consent_email: false })).eredmeny, EREDMENY.KIHAGY);
});

test('M07 nyitott panasz: marketing / rebook STOP, a tranzakcios marad', () => {
  for (const u of KATALOG.filter((x) => x.csoport === 'marketing')) {
    const r = kapuErtekel(u, allapotAzonosithoz(u, { complaint_open: true, unused_appointments: 2 }));
    assert.equal(r.eredmeny, EREDMENY.KIHAGY, u.id);
    assert.equal(r.ok, 'complaint_open', u.id);
  }
  for (const id of ['T-72', 'T-24', 'C0', 'T0-F', 'T0-C']) {
    const u = kulcs(id);
    assert.equal(kapuErtekel(u, allapotAzonosithoz(u, { complaint_open: true })).eredmeny, EREDMENY.KULDHETO, id);
  }
  // a Google-ertekeleskeres (G0) mindenkinek marad
  assert.equal(kapuErtekel(kulcs('G0'), allapotAzonosithoz(kulcs('G0'), { complaint_open: true })).eredmeny, EREDMENY.KULDHETO);
});

test('M08 panasz lezarasa utan nincs visszamenoleges potlas', () => {
  const r1 = kulcs('R1');
  const resolved = ep(2026, 10, 14, 9, 0);
  const a = allapotAzonosithoz(r1, { complaint_open: false, complaint_resolved_at: resolved });
  assert.equal(kapuErtekel(r1, a, { esedekes: resolved - 3600 }).ok, 'no_retroactive_backfill');
  assert.equal(kapuErtekel(r1, a, { esedekes: resolved + 3600 }).eredmeny, EREDMENY.KULDHETO);
  assert.deepEqual(jobokAzEsemenybol({ tipus: 'complaint_resolved', guest_key: 'g1', context_id: 'p1', esemeny_ido: MOST }), []);
});

test('M09 clinical_stop / lezart kurzus / masik foglalas: marketing STOP', () => {
  const r1 = kulcs('R1');
  assert.equal(kapuErtekel(r1, allapotAzonosithoz(r1, { clinical_stop: 'contraindication' })).ok, 'clinical_stop');
  assert.equal(kapuErtekel(r1, allapotAzonosithoz(r1, { course_status: 'paused_clinical' })).eredmeny, EREDMENY.KIHAGY);
  assert.equal(kapuErtekel(r1, allapotAzonosithoz(r1, { course_status: 'completed_11' })).ok, 'course_closed');
  assert.equal(kapuErtekel(r1, allapotAzonosithoz(r1, { course_status: 'closed_individual' })).ok, 'course_closed');
  assert.equal(kapuErtekel(r1, allapotAzonosithoz(r1, { next_active_booking: { service_type: 'followup_hair' } })).ok, 'next_active_booking');
});

test('G01 hianyzo adat -> BLOCKED_MISSING_DATA (ujraprobalhato), a SKIPPED elsobbseget elvez', () => {
  const t = kulcs('T-72');
  const a = allapotAzonosithoz(t, { recipient_verified: false });
  const r = kapuErtekel(t, a);
  assert.equal(r.eredmeny, EREDMENY.HIANYZO_ADAT); assert.equal(r.ujraprobalhato, true); assert.equal(r.dontes, 'kihagy');
  const e5 = kulcs('E5');
  assert.equal(kapuErtekel(e5, allapotAzonosithoz(e5, { content_ready: false })).ok, 'content_not_ready');
  const r1 = kulcs('R1');
  const kevert = allapotAzonosithoz(r1, { consent_email: false, recipient_verified: false });
  assert.equal(kapuErtekel(r1, kevert).eredmeny, EREDMENY.KIHAGY);
  const nincsPanaszAdat = allapotAzonosithoz(r1); delete nincsPanaszAdat.complaint_open;
  assert.equal(kapuErtekel(r1, nincsPanaszAdat).eredmeny, EREDMENY.HIANYZO_ADAT);
  assert.equal(kapuErtekel(r1, nincsPanaszAdat).terminalis, false);
});

test('G02 SANDBOX_ONLY: harmadik fel belso QA adata', () => {
  const t = kulcs('T-72');
  const r = kapuErtekel(t, allapotAzonosithoz(t, { sandbox: true }));
  assert.equal(r.eredmeny, EREDMENY.SANDBOX); assert.equal(r.terminalis, true);
});

test('G03 tranzakcios allapot-gate-ek: lemondott foglalasra nincs T-72/T-24; elmozdult idopontra elavult job', () => {
  for (const id of ['T-72', 'T-24']) {
    const u = kulcs(id);
    assert.equal(kapuErtekel(u, allapotAzonosithoz(u, { booking_status: 'cancelled' })).eredmeny, EREDMENY.KIHAGY, id);
    assert.equal(kapuErtekel(u, allapotAzonosithoz(u, { booking_status: 'rescheduled' })).eredmeny, EREDMENY.KIHAGY, id);
    const elmozdult = kapuErtekel(u, allapotAzonosithoz(u, { booking_start: ep(2026, 10, 22, 16) }), { booking_start: ep(2026, 10, 20, 16) });
    assert.equal(elmozdult.ok, 'booking_start_changed', id);
    assert.equal(kapuErtekel(u, allapotAzonosithoz(u), { booking_start: ep(2026, 10, 20, 16) }).eredmeny, EREDMENY.KULDHETO, id);
  }
  // T0-F csak first_hair, T0-C csak camera_assessment
  assert.equal(kapuErtekel(kulcs('T0-F'), allapot({ service_type: 'camera_assessment' })).eredmeny, EREDMENY.KIHAGY);
  assert.equal(kapuErtekel(kulcs('T0-C'), allapot({ service_type: 'first_hair' })).eredmeny, EREDMENY.KIHAGY);
  // N0 csak no_show; C0 csak cancelled
  assert.equal(kapuErtekel(kulcs('N0'), allapot({ booking_status: 'cancelled' })).eredmeny, EREDMENY.KIHAGY);
  assert.equal(kapuErtekel(kulcs('N0'), allapot({ booking_status: 'completed' })).eredmeny, EREDMENY.KIHAGY);
  assert.equal(kapuErtekel(kulcs('C0'), allapot({ booking_status: 'rescheduled' })).eredmeny, EREDMENY.KIHAGY);
});

test('G04 A1/A2: a 30 napos beszamitasi ablak; elso kezeles foglalasa -> STOP; R1: bejovo masik foglalas -> STOP', () => {
  const a1 = kulcs('A1');
  assert.equal(kapuErtekel(a1, allapotAzonosithoz(a1, { assessment_credit_window_ok: false })).ok, 'credit_window_expired');
  const nincs = allapotAzonosithoz(a1); delete nincs.assessment_credit_window_ok;
  assert.equal(kapuErtekel(a1, nincs).eredmeny, EREDMENY.HIANYZO_ADAT);
  assert.equal(kapuErtekel(a1, allapotAzonosithoz(a1, { next_active_booking: { service_type: 'first_hair' } })).ok, 'first_booking_exists');
});

test('G05 B30/B7: csak ha maradt fel nem hasznalt alkalom; E8 nem megy R1/R2-vel egy napon; belso doc-riasztas csak hianyzo dokunal', () => {
  const b = kulcs('B30');
  assert.equal(kapuErtekel(b, allapotAzonosithoz(b, { unused_appointments: 0 })).ok, 'no_unused_appointments');
  const e8 = kulcs('E8');
  assert.equal(kapuErtekel(e8, allapotAzonosithoz(e8, { ma_kuldott: ['R1'] })).ok, 'same_day_R1_R2');
  assert.equal(kapuErtekel(e8, allapotAzonosithoz(e8, { ma_kuldott: [] })).eredmeny, EREDMENY.KULDHETO);
  const d24 = kulcs('DOC24');
  assert.equal(kapuErtekel(d24, allapotAzonosithoz(d24, { dokumentacio_hianyzik: false })).ok, 'documentation_complete');
  assert.equal(kapuErtekel(d24, allapotAzonosithoz(d24, { dokumentacio_hianyzik: true })).eredmeny, EREDMENY.KULDHETO);
});

test('W01 kuldesi ablakok: SMS 8:00-20:30, e-mail 7:00-21:00 (Europe/Budapest)', () => {
  const nap = (h, mi) => ep(2026, 10, 14, h, mi);
  const kov = (h, mi) => ep(2026, 10, 15, h, mi);
  // SMS
  assert.equal(kovetkezoAblak('sms', nap(7, 59)), nap(8, 0));
  assert.equal(ablakban('sms', nap(8, 0)), true);
  assert.equal(ablakban('sms', nap(20, 30)), true);
  assert.equal(kovetkezoAblak('sms', nap(20, 31)), kov(8, 0));
  assert.equal(kovetkezoAblak('sms', nap(3, 0)), nap(8, 0));
  // e-mail
  assert.equal(kovetkezoAblak('email', nap(6, 59)), nap(7, 0));
  assert.equal(ablakban('email', nap(7, 0)), true);
  assert.equal(ablakban('email', nap(21, 0)), true);
  assert.equal(kovetkezoAblak('email', nap(21, 1)), kov(7, 0));
  assert.equal(ablakban('email', nap(13, 0)), true);
});

test('W02 kapuErtekel: ablakon kivul kesleltet (nem kihagy); T0/C0 azonnali; belso nincs ablak', () => {
  const r2 = kulcs('R2');
  const ejjel = ep(2026, 10, 14, 22, 0);
  const k = kapuErtekel(r2, allapotAzonosithoz(r2), { most: ejjel });
  assert.equal(k.dontes, 'kesleltet'); assert.equal(k.legkorabban, ep(2026, 10, 15, 8, 0)); assert.equal(k.terminalis, false);
  assert.equal(kapuErtekel(r2, allapotAzonosithoz(r2), { most: ep(2026, 10, 14, 9, 0) }).eredmeny, EREDMENY.KULDHETO);
  const hajnal = ep(2026, 10, 14, 3, 0);
  for (const id of ['T0-F', 'T0-C', 'C0']) {
    const u = kulcs(id);
    assert.equal(kapuErtekel(u, allapotAzonosithoz(u), { most: hajnal }).eredmeny, EREDMENY.KULDHETO, id);
  }
  assert.equal(kapuErtekel(kulcs('T-72'), allapotAzonosithoz(kulcs('T-72')), { most: hajnal }).dontes, 'kesleltet');
  assert.equal(kapuErtekel(kulcs('DOC24'), allapotAzonosithoz(kulcs('DOC24')), { most: hajnal }).eredmeny, EREDMENY.KULDHETO);
});

// ------------------------------------------------------------------ utemezo
const ESEMENY = (tipus, extra = {}) => ({ tipus, guest_key: 'g-teszt-1', context_id: 'bk-1', esemeny_ido: MOST, ...extra });
const MARKETING_ALLAPOT = { consent_email: true, consent_sms: true, email_unsubscribe: false, sms_optout: false, next_active_booking: null, complaint_open: false };
const kulcsok = (jobok) => jobok.filter((j) => j.muvelet === 'utemez').map((j) => j.template_key);
const jobOf = (jobok, id) => jobok.find((j) => j.template_key === id && j.muvelet === 'utemez');

test('U01 booking_confirmed (first_hair): T0-F azonnal, T-72, T-24', () => {
  const start = ep(2026, 10, 24, 16, 0);
  const jobok = jobokAzEsemenybol(ESEMENY('booking_confirmed', { booking_start: start, service_type: 'first_hair' }));
  assert.deepEqual(kulcsok(jobok).sort(), ['T-24', 'T-72', 'T0-F']);
  assert.equal(jobOf(jobok, 'T0-F').esedekes, MOST);
  assert.equal(jobOf(jobok, 'T-72').esedekes, start - 72 * ORA);
  assert.equal(jobOf(jobok, 'T-24').esedekes, start - 24 * ORA);
  assert.equal(jobOf(jobok, 'T-72').context_id, `bk-1:${start}`);
});

test('U02 camera_assessment: T0-C (nem T0-F)', () => {
  const jobok = jobokAzEsemenybol(ESEMENY('booking_confirmed', { booking_start: ep(2026, 10, 30, 10), service_type: 'camera_assessment' }));
  assert.ok(kulcsok(jobok).includes('T0-C')); assert.ok(!kulcsok(jobok).includes('T0-F'));
  const kovetes = jobokAzEsemenybol(ESEMENY('booking_confirmed', { booking_start: ep(2026, 10, 30, 10), service_type: 'followup_hair' }));
  assert.ok(!kulcsok(kovetes).includes('T0-F') && !kulcsok(kovetes).includes('T0-C'));
});

test('U03 mar elmult T-72/T-24 nem utemezodik (kesei foglalas)', () => {
  const start = MOST + 30 * ORA; // 30 oraval az idopont elott foglalt
  const jobok = jobokAzEsemenybol(ESEMENY('booking_confirmed', { booking_start: start, service_type: 'first_hair' }));
  assert.deepEqual(kulcsok(jobok).sort(), ['T-24', 'T0-F']);
  const nagyonKesei = jobokAzEsemenybol(ESEMENY('booking_confirmed', { booking_start: MOST + 10 * ORA, service_type: 'first_hair' }));
  assert.deepEqual(kulcsok(nagyonKesei), ['T0-F']);
});

test('U04 reschedule: az eredeti T-72/T-24 torlese + ujraütemezes az uj idopontra, T0 nem ismetlodik', () => {
  const regi = ep(2026, 10, 24, 16), uj = ep(2026, 10, 28, 11);
  const jobok = jobokAzEsemenybol(ESEMENY('booking_rescheduled', { eredeti_start: regi, uj_start: uj, service_type: 'first_hair' }));
  const torol = jobok.filter((j) => j.muvelet === 'torol');
  assert.deepEqual(torol.map((j) => j.template_key).sort(), ['T-24', 'T-72']);
  assert.ok(torol.every((j) => j.context_id === `bk-1:${regi}` && j.esedekes === null));
  assert.equal(jobOf(jobok, 'T-72').esedekes, uj - 72 * ORA);
  assert.equal(jobOf(jobok, 'T-24').context_id, `bk-1:${uj}`);
  assert.ok(!kulcsok(jobok).includes('T0-F'));
  // a torolt kulcs egyezik az eredetileg utemezettel
  const eredeti = jobokAzEsemenybol(ESEMENY('booking_confirmed', { booking_start: regi, service_type: 'first_hair' }));
  assert.equal(torol.find((j) => j.template_key === 'T-72').idempotency_key, jobOf(eredeti, 'T-72').idempotency_key);
  assert.notEqual(jobOf(jobok, 'T-72').idempotency_key, jobOf(eredeti, 'T-72').idempotency_key);
});

test('U05 cancelled: nincs emlekezteto (T-72/T-24 torlese), C0 azonnal, C1 +24h, C2 +3 nap (csak consenttel)', () => {
  const start = ep(2026, 10, 24, 16);
  const jobok = jobokAzEsemenybol(ESEMENY('booking_cancelled', { booking_start: start, service_type: 'first_hair', allapot: MARKETING_ALLAPOT }));
  assert.deepEqual(jobok.filter((j) => j.muvelet === 'torol').map((j) => j.template_key).sort(), ['T-24', 'T-72']);
  assert.ok(!kulcsok(jobok).includes('T-72') && !kulcsok(jobok).includes('T-24'));
  assert.equal(jobOf(jobok, 'C0').esedekes, MOST);
  assert.equal(jobOf(jobok, 'C1').esedekes, MOST + NAP);
  assert.equal(jobOf(jobok, 'C2').esedekes, MOST + 3 * NAP);
  const consentNelkul = jobokAzEsemenybol(ESEMENY('booking_cancelled', { booking_start: start, service_type: 'first_hair', allapot: { ...MARKETING_ALLAPOT, consent_email: false, consent_sms: false } }));
  assert.deepEqual(kulcsok(consentNelkul), ['C0']);
});

test('U06 R1 +48h csak e-mail marketing consenttel es ha nincs kovetkezo foglalas; R2 +5 nap SMS consenttel', () => {
  const ev = (allap) => ESEMENY('booking_completed', { booking_start: MOST - 2 * ORA, service_type: 'followup_hair', treatment_index: 4, allapot: allap });
  const jo = jobokAzEsemenybol(ev(MARKETING_ALLAPOT));
  assert.equal(jobOf(jo, 'R1').esedekes, MOST + 48 * ORA);
  assert.equal(jobOf(jo, 'R2').esedekes, MOST + 5 * NAP);
  assert.ok(!jobOf(jobokAzEsemenybol(ev({ ...MARKETING_ALLAPOT, consent_email: false })), 'R1'));
  assert.ok(jobOf(jobokAzEsemenybol(ev({ ...MARKETING_ALLAPOT, consent_email: false })), 'R2'));
  assert.ok(!jobOf(jobokAzEsemenybol(ev({ ...MARKETING_ALLAPOT, consent_sms: false })), 'R2'));
  assert.ok(!jobOf(jobokAzEsemenybol(ev({ ...MARKETING_ALLAPOT, next_active_booking: { uuid: 'x' } })), 'R1'));
  assert.ok(!jobOf(jobokAzEsemenybol(ev({ ...MARKETING_ALLAPOT, complaint_open: true })), 'R1'));
  assert.ok(!jobOf(jobokAzEsemenybol(ev(undefined)), 'R1'));
  assert.ok(!jobOf(jobokAzEsemenybol(ev({ ...MARKETING_ALLAPOT, email_unsubscribe: true })), 'R1'));
});

test('U07 elso completed: S0 +3h, G0 +24h, E2 +3 nap, E3 +7 nap, DOC24/DOC48; a masodiknal nem', () => {
  const elso = jobokAzEsemenybol(ESEMENY('booking_completed', { service_type: 'first_hair', treatment_index: 1, allapot: MARKETING_ALLAPOT }));
  assert.equal(jobOf(elso, 'S0').esedekes, MOST + 3 * ORA);
  assert.equal(jobOf(elso, 'G0').esedekes, MOST + 24 * ORA);
  assert.equal(jobOf(elso, 'E2').esedekes, MOST + 3 * NAP);
  assert.equal(jobOf(elso, 'E3').esedekes, MOST + 7 * NAP);
  assert.equal(jobOf(elso, 'DOC24').esedekes, MOST + 24 * ORA);
  assert.equal(jobOf(elso, 'DOC48').esedekes, MOST + 48 * ORA);
  const masodik = jobokAzEsemenybol(ESEMENY('booking_completed', { service_type: 'followup_hair', treatment_index: 2, allapot: MARKETING_ALLAPOT }));
  for (const id of ['S0', 'G0', 'E2', 'E3']) assert.ok(!jobOf(masodik, id), id);
});

test('U08 P0 az elso kezelés dokumentacio-kesz esemenyere', () => {
  const p0 = jobokAzEsemenybol(ESEMENY('documentation_final', { service_type: 'first_hair', treatment_index: 1 }));
  assert.deepEqual(kulcsok(p0), ['P0']);
  assert.deepEqual(kulcsok(jobokAzEsemenybol(ESEMENY('documentation_final', { service_type: 'followup_hair', treatment_index: 4 }))), []);
});

test('U09 A1 +48h / A2 +5 nap onallo kamera-felmeres utan (consenttel, elso foglalas nelkul); nincs R1', () => {
  const jobok = jobokAzEsemenybol(ESEMENY('booking_completed', { service_type: 'camera_assessment', allapot: MARKETING_ALLAPOT }));
  assert.equal(jobOf(jobok, 'A1').esedekes, MOST + 48 * ORA);
  assert.equal(jobOf(jobok, 'A2').esedekes, MOST + 5 * NAP);
  assert.ok(!jobOf(jobok, 'R1') && !jobOf(jobok, 'R2') && !jobOf(jobok, 'S0') && !jobOf(jobok, 'DOC24'));
  const foglalt = jobokAzEsemenybol(ESEMENY('booking_completed', { service_type: 'camera_assessment', allapot: { ...MARKETING_ALLAPOT, next_active_booking: { service_type: 'first_hair' } } }));
  assert.ok(!jobOf(foglalt, 'A1') && !jobOf(foglalt, 'A2'));
  assert.ok(!jobOf(jobokAzEsemenybol(ESEMENY('booking_completed', { service_type: 'camera_assessment', allapot: { ...MARKETING_ALLAPOT, consent_email: false } })), 'A1'));
});

test('U10 N0: a no-show masnapja; nincs consent -> nincs job', () => {
  const jobok = jobokAzEsemenybol(ESEMENY('booking_no_show', { service_type: 'first_hair', allapot: MARKETING_ALLAPOT }));
  assert.deepEqual(kulcsok(jobok), ['N0']);
  assert.equal(jobOf(jobok, 'N0').esedekes, MOST + NAP);
  assert.deepEqual(kulcsok(jobokAzEsemenybol(ESEMENY('booking_no_show', { service_type: 'first_hair', allapot: { ...MARKETING_ALLAPOT, consent_sms: false } }))), []);
});

test('U11 E-sorozat sorszamai: E5 a 2., E6 a 3., E7 az 5., E10 a 11. completed utan', () => {
  const E_KULCSOK = ['E5', 'E6', 'E7', 'E10'];
  const mapping = { 1: [], 2: ['E5'], 3: ['E6'], 4: [], 5: ['E7'], 6: [], 10: [], 11: ['E10'] };
  for (const [idx, vart] of Object.entries(mapping)) {
    for (const tipus of ['booking_completed', 'documentation_final']) {
      const jobok = jobokAzEsemenybol(ESEMENY(tipus, { service_type: 'followup_hair', treatment_index: Number(idx), allapot: MARKETING_ALLAPOT }));
      assert.deepEqual(kulcsok(jobok).filter((k) => E_KULCSOK.includes(k)), vart, `${tipus} #${idx}`);
    }
  }
  // kamera-felmeres sosem szamit az E-sorozatba
  assert.deepEqual(kulcsok(jobokAzEsemenybol(ESEMENY('booking_completed', { service_type: 'camera_assessment', treatment_index: 2, allapot: MARKETING_ALLAPOT }))).filter((k) => E_KULCSOK.includes(k)), []);
  // ugyanaz az idempotency_key a ket esemenyre (nincs duplikacio)
  const c = jobokAzEsemenybol(ESEMENY('booking_completed', { service_type: 'followup_hair', treatment_index: 2 }));
  const d = jobokAzEsemenybol(ESEMENY('documentation_final', { service_type: 'followup_hair', treatment_index: 2 }));
  assert.equal(jobOf(c, 'E5').idempotency_key, jobOf(d, 'E5').idempotency_key);
});

test('U12 E8 a kontroll-datumon (consenttel), E9 az E8 elkuldese utan +7 nap', () => {
  const kontroll = ep(2026, 11, 3, 10);
  const e8 = jobokAzEsemenybol(ESEMENY('control_due_passed', { kontroll_datum: kontroll, allapot: MARKETING_ALLAPOT }));
  assert.equal(jobOf(e8, 'E8').esedekes, kontroll);
  assert.deepEqual(kulcsok(jobokAzEsemenybol(ESEMENY('control_due_passed', { kontroll_datum: kontroll, allapot: { ...MARKETING_ALLAPOT, consent_email: false } }))), []);
  const e9 = jobokAzEsemenybol(ESEMENY('message_sent', { template_key: 'E8', allapot: MARKETING_ALLAPOT }));
  assert.equal(jobOf(e9, 'E9').esedekes, MOST + 7 * NAP);
  assert.deepEqual(kulcsok(jobokAzEsemenybol(ESEMENY('message_sent', { template_key: 'R1', allapot: MARKETING_ALLAPOT }))), []);
});

test('U13 B30 / B7: a lejarat elott 30 / 7 nappal; lejarat-modositasnal a regi torlese', () => {
  const lejarat = ep(2027, 3, 31, 12);
  const jobok = jobokAzEsemenybol(ESEMENY('package_activated', { context_id: 'pkg-1', lejarat, allapot: MARKETING_ALLAPOT }));
  assert.equal(jobOf(jobok, 'B30').esedekes, lejarat - 30 * NAP);
  assert.equal(jobOf(jobok, 'B7').esedekes, lejarat - 7 * NAP);
  const uj = ep(2027, 5, 31, 12);
  const mod = jobokAzEsemenybol(ESEMENY('package_expiry_changed', { context_id: 'pkg-1', eredeti_lejarat: lejarat, lejarat: uj, allapot: MARKETING_ALLAPOT }));
  assert.deepEqual(mod.filter((j) => j.muvelet === 'torol').map((j) => j.template_key).sort(), ['B30', 'B7']);
  assert.equal(mod.find((j) => j.muvelet === 'torol' && j.template_key === 'B30').context_id, `pkg-1:${lejarat}`);
  assert.equal(jobOf(mod, 'B30').esedekes, uj - 30 * NAP);
  assert.deepEqual(kulcsok(jobokAzEsemenybol(ESEMENY('package_activated', { context_id: 'pkg-1', lejarat, allapot: { ...MARKETING_ALLAPOT, consent_sms: false } }))), ['B30']);
});

test('U14 belso: negativ survey -> NEG; panasz -> COMPLAINT; pozitiv survey semmi', () => {
  assert.deepEqual(kulcsok(jobokAzEsemenybol(ESEMENY('survey_submitted', { pont: 3 }))), ['NEG']);
  assert.deepEqual(kulcsok(jobokAzEsemenybol(ESEMENY('survey_submitted', { pont: 5, negativ: true }))), ['NEG']);
  assert.deepEqual(kulcsok(jobokAzEsemenybol(ESEMENY('survey_submitted', { pont: 4 }))), []);
  assert.deepEqual(kulcsok(jobokAzEsemenybol(ESEMENY('complaint_created', { context_id: 'pn-1' }))), ['COMPLAINT']);
});

test('U15 idempotency_key stabil es a guest_key + template_key + context_id + verzio kombinacio', () => {
  const ev = ESEMENY('booking_confirmed', { booking_start: ep(2026, 10, 24, 16), service_type: 'first_hair' });
  const a = jobokAzEsemenybol(ev), b = jobokAzEsemenybol({ ...ev });
  assert.deepEqual(a.map((j) => j.idempotency_key), b.map((j) => j.idempotency_key));
  assert.equal(jobOf(a, 'T0-F').idempotency_key, idempotencyKulcs('g-teszt-1', 'T0-F', 'bk-1', 1));
  assert.equal(new Set(a.map((j) => j.idempotency_key)).size, a.length);
  // mas vendeg / mas context / mas esemeny_ido (T0) nem valtoztatja a kulcsot a nevtol fuggetlenul
  assert.notEqual(jobOf(jobokAzEsemenybol({ ...ev, guest_key: 'g-2' }), 'T0-F').idempotency_key, jobOf(a, 'T0-F').idempotency_key);
  assert.notEqual(jobOf(jobokAzEsemenybol({ ...ev, context_id: 'bk-2' }), 'T0-F').idempotency_key, jobOf(a, 'T0-F').idempotency_key);
  assert.equal(jobOf(jobokAzEsemenybol({ ...ev, esemeny_ido: MOST + 5 }), 'T0-F').idempotency_key, jobOf(a, 'T0-F').idempotency_key);
  assert.throws(() => jobokAzEsemenybol({ tipus: 'booking_confirmed' }), /guest_key/);
});

test('U16 legkorabbi_kuldes: ablakba igazitva (SMS 8:00 elott -> 8:00), T0 azonnali', () => {
  const jobok = jobokAzEsemenybol(ESEMENY('booking_confirmed', { booking_start: ep(2026, 10, 21, 7, 30), service_type: 'first_hair' }));
  const t24 = jobOf(jobok, 'T-24');
  assert.equal(t24.esedekes, ep(2026, 10, 20, 7, 30));
  assert.equal(t24.legkorabbi_kuldes, ep(2026, 10, 20, 8, 0));
  assert.equal(jobOf(jobok, 'T0-F').legkorabbi_kuldes, jobOf(jobok, 'T0-F').esedekes);
});

// ------------------------------------------------------------------ kuldo
const UZENET = { csatorna: 'email', cimzett: { email: 'teszt@example.com' }, targy: 'Tárgy', html: '<p>x</p>', szoveg: 'x' };

test('D01 DRY_RUN adapter alapertelmezett: naploz, nem kuld', async () => {
  const k = kuldoKeszit({ env: {} });
  assert.equal(k.nev, 'dry_run');
  const r = await k.kuld(UZENET);
  assert.equal(r.allapot, 'DRY_RUN'); assert.match(r.szolgaltato_id, /^dry-/);
  assert.equal(k.naplo.length, 1);
  assert.equal((await k.kuld({ csatorna: 'sms', cimzett: '+36301234567', szoveg: 'Szia' })).allapot, 'DRY_RUN');
  assert.equal((await k.kuld({ csatorna: 'sms', cimzett: 'nem-szam', szoveg: 'Szia' })).allapot, 'FAILED');
  assert.equal((await k.kuld({ ...UZENET, cimzett: 'nem-email' })).allapot, 'FAILED');
});

test('D02 eles adapter: csak kuldes=eles ES nem teszt_only cimzettnek kuld; alapbol soha', async () => {
  const hivasok = [];
  const gyar = () => ({
    async email(a) { hivasok.push(['email', a]); return { id: 'smtp' }; },
    async sms(a) { hivasok.push(['sms', a]); return { id: 'sms-1' }; },
    async lezar() {},
  });
  // kuldes != eles -> dry
  const dry = elesAdapterKeszit({ env: {}, konfig: { kuldes: 'dry' }, kuldokGyar: gyar });
  assert.equal((await dry.kuld(UZENET)).allapot, 'DRY_RUN');
  assert.equal(hivasok.length, 0);
  // konfig nelkul / hibas ertek -> dry
  assert.equal((await elesAdapterKeszit({ env: {}, konfig: undefined, kuldokGyar: gyar }).kuld(UZENET)).allapot, 'DRY_RUN');
  assert.equal((await elesAdapterKeszit({ env: {}, konfig: { kuldes: 'ELES' }, kuldokGyar: gyar }).kuld(UZENET)).allapot, 'DRY_RUN');
  assert.equal(konfigEnvbol({}).kuldes, 'dry'); assert.equal(konfigEnvbol({ CRM_KULDES: 'igen' }).kuldes, 'dry'); assert.equal(konfigEnvbol({ CRM_KULDES: 'eles' }).kuldes, 'eles');
  assert.equal(kuldoKeszit({ env: {} }).nev, 'dry_run');
  assert.equal(hivasok.length, 0);
  // eles, de teszt_only cimzett -> nem kuld
  const eles = elesAdapterKeszit({ env: {}, konfig: { kuldes: 'eles' }, kuldokGyar: gyar });
  const t = await eles.kuld({ ...UZENET, cimzett: { email: 'teszt@example.com', teszt_only: true } });
  assert.equal(t.allapot, 'DRY_RUN'); assert.equal(t.ok, 'teszt_only');
  assert.equal(hivasok.length, 0);
  // eles + valodi cimzett -> kuld (a hamis kuldovel)
  const ok = await eles.kuld(UZENET);
  assert.equal(ok.allapot, 'SENT'); assert.equal(hivasok[0][0], 'email'); assert.equal(hivasok[0][1].to, 'teszt@example.com');
  const sms = await eles.kuld({ csatorna: 'sms', cimzett: { telefon: '06 30 123 4567' }, szoveg: 'Szia' });
  assert.equal(sms.allapot, 'SENT'); assert.equal(hivasok[1][1].telefon, '+36301234567');
  const belso = await eles.kuld({ ...UZENET, csatorna: 'internal' });
  assert.equal(belso.allapot, 'SENT');
  // szolgaltato-hiba -> FAILED, nem dob
  const hibas = elesAdapterKeszit({ env: {}, konfig: { kuldes: 'eles' }, kuldokGyar: () => ({ async email() { throw new Error('smtp down'); }, async lezar() {} }) });
  const f = await hibas.kuld(UZENET);
  assert.equal(f.allapot, 'FAILED'); assert.match(f.hiba, /smtp down/);
});
