// 9. Kuldesi vezerlo: sablonok, elonezet + a vendeg aktualis allapota (kapu-dontes), jobok, skip/STOP okok, ujraproba, sandbox-proba
import { h, tolt, oldalCim, toltes, tabla, fulek, kartya, mezo, beviteli, valaszto, adatsor, pick, lista, jelveny, rvJelzo, gomb, futtat, ertesit, figyelmeztetes, uresAllapot, megerosites, datumIdo, humanizal } from './crm-ui.js';
import { allapotJelveny } from './crm-cimkek.js';

const CSOPORT = { transactional: 'Tranzakciós', care: 'Kezelési / személyes dokumentum', personal_document: 'Személyes dokumentum', marketing: 'Marketing' };
const SKIP_OK = {
  SKIPPED_CONSENT_OR_STATE: 'Kihagyva: hiányzó hozzájárulás vagy az állapot már nem engedi', BLOCKED_MISSING_DATA: 'Blokkolva: hiányzó adat', SANDBOX_ONLY: 'Csak sandbox (harmadik fél belső QA adata)', WINDOW_DEFERRED: 'Késleltetve: a küldési ablakon kívül',
  complaint_open: 'Nyitott panasz (marketing / visszafoglalás STOP)', clinical_stop: 'Szakmai STOP', consent_missing: 'Nincs csatorna-hozzájárulás', unsubscribed: 'Leiratkozott', next_booking: 'Van már következő foglalás', course_closed: 'Lezárt kúra',
  marketing_consent_email: 'Nincs marketing e-mail hozzájárulás', marketing_consent_sms: 'Nincs marketing SMS hozzájárulás', no_next_booking: 'Már van következő foglalás', no_first_booking: 'Már van első kezelési foglalás',
  no_retroactive_backfill: 'Panasz lezárása előtt esedékes üzenet: nem pótoljuk visszamenőleg', outside_send_window: 'A küldési ablakon kívül (később megy)', sandbox_data: 'Sandbox adat: nem megy valódi címzettnek',
  booking_status_booked: 'A foglalás már nem aktív (booked)', booking_status_cancelled: 'A foglalás nem lemondott állapotú', booking_status_no_show: 'Nem no-show állapotú foglalás', booking_status_completed: 'A foglalás nem igazolt teljesített', no_show: 'Nem hiteles no-show',
};
const kodSzoveg = (k) => SKIP_OK[k] || humanizal(String(k));

export default async function nezet(ctx) {
  const dry = ctx.uzemmod() !== 'eles';
  tolt(ctx.root, oldalCim('Küldési vezérlő'),
    ctx.uzemmod() === 'eles' ? figyelmeztetes('veszely', h('strong', null, 'ÉLES KÜLDÉS: '), 'az üzenetek valódi vendégeknek mennek ki.')
      : figyelmeztetes(ctx.uzemmod() === 'dry' ? 'figyelem' : 'info', h('strong', null, ctx.uzemmod() === 'dry' ? 'Ez a rendszer jelenleg NEM küld éles üzenetet (DRY-RUN). ' : 'Az üzemmód nem állapítható meg – tekintsd úgy, hogy nincs éles küldés. '), 'Az átkapcsolás a tulajdonos külön jóváhagyásával, kód-szinten történik; innen nem módosítható.'),
    fulek([{ cim: 'Sablonok', tolt: (c) => sablonok(c, ctx) }, { cim: 'Előnézet és sandbox-próba', tolt: (c) => elonezet(c, ctx) }, { cim: 'Jobok és okok', tolt: (c) => jobok(c, ctx) }]));
}

async function sablonok(cel, ctx) {
  const v = await toltes(cel, () => ctx.api.get('/uzenetek/sablonok'));
  if (v === undefined) return;
  tolt(cel, h('p', { class: 'halvany kicsi' }, 'A vendégszövegek a forráshű küldési katalógusból származnak; a végleges szövegek jogi / szakmai ellenőrzése folyamatban lehet.'), tabla([
    { cim: 'Azonosító', ertek: (s) => [h('code', null, pick(s, 'azonosito', 'template_key', 'kulcs')), pick(s, 'nev') ? h('div', { class: 'kicsi halvany' }, s.nev) : '', s.szoveg_hianyzik ? h('div', null, rvJelzo('szöveg még nincs')) : ''] },
    { cim: 'Csoport', ertek: (s) => { const g = pick(s, 'csoport', 'group'); return jelveny(CSOPORT[g] || g || '–', g === 'marketing' ? 'figyelem' : 'info'); } },
    { cim: 'Csatorna', ertek: (s) => pick(s, 'csatorna', 'channel') || '–' }, { cim: 'Trigger', ertek: (s) => pick(s, 'trigger') || '–' },
    { cim: 'Kapu / stop', ertek: (s) => { const g = pick(s, 'gate', 'kapu'); return Array.isArray(g) ? g.join(', ') : (g && typeof g === 'object' ? Object.entries(g).map(([k, x]) => `${k}${typeof x === 'boolean' ? '' : `: ${Array.isArray(x) ? x.join('/') : x}`}`).join(', ') : (g || '–')); } },
    { cim: 'Verzió', ertek: (s) => pick(s, 'verzio', 'version') ?? '–' },
  ], lista(v, 'sablonok'), { ures: 'Nincs sablon.', felirat: 'Üzenetsablonok' }));
}

async function elonezet(cel, ctx) {
  const { api } = ctx;
  const sab = await api.get('/uzenetek/sablonok').then((v) => lista(v, 'sablonok')).catch(() => []);
  const kulcsok = sab.map((s) => pick(s, 'azonosito', 'template_key', 'kulcs'));
  const kulcsEl = kulcsok.length ? valaszto(kulcsok.map((k) => [k, k]), kulcsok[0], { id: 'kd-sablon' }) : beviteli({ id: 'kd-sablon', placeholder: 'pl. T0-F' });
  const q = beviteli({ id: 'kd-q', placeholder: 'Vendég neve vagy e-mail-részlet' });
  const vendegSel = valaszto([['', '– előbb keress vendéget –']], '', { id: 'kd-vendeg' });
  const bookId = beviteli({ id: 'kd-booking', placeholder: 'Foglalás-azonosító (nem kötelező)' });
  const keresG = h('button', { type: 'button', class: 'gomb' }, 'Vendég keresése');
  keresG.addEventListener('click', futtat(keresG, async () => {
    if (q.value.trim().length < 2) return;
    const r = lista(await api.get('/vendegek', { q: q.value.trim() }), 'vendegek');
    tolt(vendegSel, ...[h('option', { value: '' }, r.length ? '– válassz vendéget –' : 'Nincs találat'), ...r.map((x) => h('option', { value: x.id }, `${x.nev} (${x.email_maszkolt || ''})`))]);
  }));
  const kimenet = h('div', { 'aria-live': 'polite' });
  const kerSzamit = (ut) => {
    if (!vendegSel.value) { ertesit('Válassz vendéget.', 'hiba'); return null; }
    return { template_key: kulcsEl.value, guest_id: vendegSel.value, ...(ut === 'elonezet' && bookId.value.trim() ? { booking_id: bookId.value.trim() } : {}) };
  };
  const elo = h('button', { type: 'button', class: 'gomb gomb-fo', id: 'kd-elonezet' }, 'Előnézet');
  elo.addEventListener('click', futtat(elo, async () => {
    const b = kerSzamit('elonezet'); if (!b) return;
    const r = await api.post('/uzenetek/elonezet', b);
    const kapu = r.kapu || {};
    const dontes = kapu.dontes;
    const hianyzo = lista(pick(r, 'hianyzo') || []);
    const figy = lista(pick(r, 'figyelmeztetesek') || []);
    const kodok = lista(kapu.kodok);
    const ok = kapu.ok && kapu.ok !== 'ok' ? kodSzoveg(kapu.ok) : '';
    const hang = dontes === 'mehet' ? 'ok' : (dontes === 'kesleltet' ? 'info' : 'figyelem');
    tolt(kimenet,
      dontes ? figyelmeztetes(hang, h('strong', null, dontes === 'mehet' ? 'A vendég jelenlegi állapota szerint a kapu: MEHET. ' : dontes === 'kesleltet' ? 'A kapu: KÉSLELTETVE. ' : 'A vendég jelenlegi állapota szerint: NEM MEGY (kihagyva / blokkolva). '), ok, kapu.legkorabban ? ` Legkorábban: ${datumIdo(kapu.legkorabban)}.` : '', kodok.length > 1 ? h('div', { class: 'kicsi' }, 'Okok: ', kodok.map(kodSzoveg).join('; ')) : null, h('div', { class: 'kicsi' }, ctx.uzemmod() === 'eles' ? 'ÉLES üzemmód: ha a kapu engedi, valódi üzenet megy ki.' : 'Dry-run: valódi küldés nincs.')) : null,
      r.redacted ? figyelmeztetes('info', 'Személyes / egészségi tartalmú sablon: a szöveg csak a dokumentációt olvasni jogosult munkatársnak jelenik meg.') : null,
      hianyzo.length ? figyelmeztetes('veszely', h('strong', null, 'Hiányzó adat (BLOCKED_MISSING_DATA): '), hianyzo.join(', ')) : null,
      figy.length ? figyelmeztetes('figyelem', figy.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join('; ')) : null,
      r.redacted ? null : kartya('Előnézet', adatsor([['Állapot', r.allapot || '–'], ['Tárgy', pick(r, 'targy', 'subject')], ['SMS', pick(r, 'sms')]]),
        pick(r, 'html') ? h('iframe', { sandbox: '', title: 'E-mail előnézet', srcdoc: r.html, style: 'width:100%;height:420px;border:1px solid var(--vonal);border-radius:8px;background:#fff', 'data-elonezet': 'html' }) : (pick(r, 'szoveg') ? h('pre', { class: 'sor-szoveg' }, r.szoveg) : null)));
  }));
  const sand = h('button', { type: 'button', class: 'gomb gomb-arany', id: 'kd-sandbox' }, 'Sandbox-próba (soha nem valódi küldés)');
  sand.addEventListener('click', futtat(sand, async () => {
    const b = kerSzamit('sandbox'); if (!b) return;
    const r = await api.post('/uzenetek/sandbox-proba', b);
    const nem = r && r.eredmeny === 'NEM_KULDHETO';
    tolt(kimenet, figyelmeztetes(nem ? 'figyelem' : 'ok', h('strong', null, nem ? 'A sandbox-próba nem futhatott: ' : 'Sandbox-próba lefutott. '), nem ? kodSzoveg(r.allapot) : 'Valódi üzenet nem ment ki (a próba a saját címedre, dry-run adapterrel fut).', pick(r, 'eredmeny') && !nem ? ` Eredmény: ${r.eredmeny}.` : '', r && r.kapu && r.kapu.dontes ? ` Kapu: ${r.kapu.dontes}.` : ''));
  }));
  tolt(cel, kartya('Vendég és sablon', h('div', { class: 'mezok-sor' }, mezo('Sablon', kulcsEl), mezo('Vendég keresése', q), mezo('Vendég', vendegSel), mezo('Foglalás (opcionális, csak előnézethez)', bookId)),
    h('div', { class: 'gombsor' }, keresG, elo, sand)), kimenet);
}

async function jobok(cel, ctx) {
  const { api } = ctx;
  const allapot = valaszto([['', 'Minden állapot'], ['pending', 'Várakozik'], ['dry_run', 'Dry-run'], ['sent', 'Elküldve'], ['skipped', 'Kihagyva'], ['blocked', 'Blokkolva'], ['failed', 'Hibás'], ['dead', 'Elakadt'], ['cancelled', 'Törölve']], '', { id: 'kd-allapot', onchange: () => betolt() });
  const t = h('div', { 'aria-live': 'polite' });
  tolt(cel, h('div', { class: 'kereso' }, mezo('Állapot', allapot)), t);
  async function betolt() {
    const v = await toltes(t, () => api.get('/uzenetek/jobok', { allapot: allapot.value }));
    if (v === undefined) return;
    tolt(t, tabla([
      { cim: 'Sablon', ertek: (s) => h('code', null, pick(s, 'sablon', 'template_key')) }, { cim: 'Vendég', ertek: (s) => (s.vendeg_id ? h('a', { href: `#/vendegek/${encodeURIComponent(s.vendeg_id)}` }, String(s.vendeg_id).slice(0, 8)) : '–') },
      { cim: 'Csatorna', ertek: (s) => pick(s, 'csatorna', 'channel') || '–' }, { cim: 'Ütemezve', ertek: (s) => datumIdo(pick(s, 'ido', 'run_at')) },
      { cim: 'Állapot', ertek: (s) => allapotJelveny('job', pick(s, 'allapot', 'status')) },
      { cim: 'Ok / hiba', ertek: (s) => { const o = pick(s, 'ok', 'stop_ok', 'hiba'); return o ? kodSzoveg(o) : '–'; } },
      { cim: 'Próbák', ertek: (s) => pick(s, 'probalkozas', 'probak', 'attempts') ?? '–', osztaly: 'jobbra' },
      { cim: '', ertek: (s) => { if (!['failed', 'dead', 'blocked'].includes(pick(s, 'allapot', 'status'))) return ''; const b = h('button', { type: 'button', class: 'gomb gomb-kicsi', 'data-ujra': s.id }, 'Újrapróba'); b.addEventListener('click', futtat(b, async () => { if (!(await megerosites('Kézi újrapróba', ctx.uzemmod() === 'eles' ? 'ÉLES üzemmód: az üzenet valóban kimehet, ha a vendég állapota engedi.' : 'Dry-run: valódi küldés nincs.', { megerosit: 'Újrapróba' }))) return; await api.post(`/uzenetek/jobok/${encodeURIComponent(s.id)}/ujra`, {}); ertesit('Újrafuttatás kérve.'); betolt(); })); return b; } },
    ], lista(v, 'jobok'), { ures: 'Nincs job ebben az állapotban.', felirat: 'Üzenet-jobok' }));
  }
  betolt();
}
