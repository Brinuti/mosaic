// Hordozhato Stripe REST-mock a Gift Commerce Engine tesztjeihez (node:http, fuggoseg nelkul).
// Csak azt tudja, amit a netlify/lib/ajandek.js hasznal:
//   POST /v1/payment_intents            letrehozas (form-encoded; Idempotency-Key tamogatas)
//   GET  /v1/payment_intents/:id        lekeres (expand[]=latest_charge)
//   POST /v1/payment_intents/:id        frissites (amount, receipt_email, description, metadata osszefesules;
//                                       metadata[kulcs]= ures ertek torli)
//   GET  /v1/charges/:id                terheles (a vita-esemenyhez, ha a vita-objektumban nincs PI)
//   POST /v1/customers                  ugyfel (tax_id_data[0][type]=hu_tin: 12345678-1-23 formatum, kulonben 400)
//   POST /v1/invoiceitems               szamlatetel (amount, description, tax_behavior, tax_code); "pending" a szamlazasig
//   POST /v1/invoices                   szamla (draft): a pending tetelek; automatic_tax: a tetelekhez tax_behavior kell
//   POST /v1/invoices/:id/finalize      veglegesites: Stripe Tax (27% / 0%, brutto arba szamitva), a szamla PaymentIntentje
//   POST /v1/invoices/:id/void          visszavonas (a PI lemondva)
//   GET  /v1/invoices/:id               lekeres
// Vezerlo-segedek a tesztnek (allapot): sikeresIt, bukas, feldolgozas, visszaterites, vita,
// kovetkezoHiba, hibaSzabaly, pi, charge, keresek.
//
//   const mock = await mockStripeInditas();   // { url, bezar(), allapot }
//   env.STRIPE_API_BASE = mock.url;
import http from 'node:http';
import crypto from 'node:crypto';

const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const veletlen = (n) => Array.from(crypto.randomBytes(n), (b) => ABC[b % ABC.length]).join('');
const mp = () => Math.floor(Date.now() / 1000);
const masol = (o) => JSON.parse(JSON.stringify(o));
const FRISSITHETO = new Set(['requires_payment_method', 'requires_confirmation', 'requires_action']);

// 'metadata[a]=1&expand[]=x' -> { metadata: { a: '1' }, expand: ['x'] } (null-prototipusu objektumok)
function bontas(params) {
  const ki = Object.create(null);
  for (const [k, v] of params) {
    const m = /^([^[\]]+)((?:\[[^\]]*\])*)$/.exec(k);
    if (!m) continue;
    const reszek = [m[1], ...Array.from(m[2].matchAll(/\[([^\]]*)\]/g), (x) => x[1])];
    let o = ki;
    for (let i = 0; i < reszek.length - 1; i++) {
      if (o[reszek[i]] === undefined) o[reszek[i]] = reszek[i + 1] === '' ? [] : Object.create(null);
      o = o[reszek[i]];
    }
    const utolso = reszek[reszek.length - 1];
    if (Array.isArray(o) && utolso === '') o.push(v);
    else o[utolso] = v;
  }
  return ki;
}

const hiba = (status, type, message, code, param) => ({ status, json: { error: { type, message, ...(code ? { code } : {}), ...(param ? { param } : {}) } } });

function metaEllenoriz(md) {
  const kulcsok = Object.keys(md);
  if (kulcsok.length > 50) return 'tul sok metadata-kulcs';
  for (const k of kulcsok) {
    if (k.length > 40) return `tul hosszu metadata-kulcs: ${k}`;
    if (String(md[k]).length > 500) return `tul hosszu metadata-ertek: ${k}`;
  }
  return null;
}

export async function mockStripeInditas({ port = 0, kulcsElotag = 'sk_test_mock' } = {}) {
  const pik = new Map();
  const chargek = new Map();
  const idem = new Map();
  const keresek = [];
  const hibaSor = [];
  let hibaSzabaly = null; // (keres) => HTTP-statusz | 0
  const vitak = new Map();
  // Stripe-szamla (customers / invoiceitems / invoices): a mock a Stripe Tax-ot a tax_code alapjan szamolja (txcd_20040009: 27%, txcd_00000000: 0%)
  const ugyfelek = new Map();
  const szamlaTetelek = new Map();
  const szamlak = new Map();
  const ADO_SZAZALEK = { txcd_20040009: 27, txcd_00000000: 0 };
  const FIZMOD_JO = new Set(['card', 'link', 'revolut_pay', 'google_pay', 'apple_pay']);

  function kifejt(pi, expand) {
    const o = masol(pi);
    if ((expand || []).includes('latest_charge') && o.latest_charge && chargek.has(o.latest_charge)) o.latest_charge = masol(chargek.get(o.latest_charge));
    return o;
  }

  function letrehoz(p) {
    if (!/^\d+$/.test(String(p.amount ?? '')) || Number(p.amount) <= 0) return hiba(400, 'invalid_request_error', 'Invalid integer: amount', 'parameter_invalid_integer', 'amount');
    if (!p.currency) return hiba(400, 'invalid_request_error', 'Missing required param: currency.', 'parameter_missing', 'currency');
    const amount = Number(p.amount);
    if (String(p.currency).toLowerCase() === 'huf' && amount % 100 !== 0) return hiba(400, 'invalid_request_error', 'HUF amounts must be divisible by 100.', 'amount_invalid', 'amount');
    const md = Object.assign(Object.create(null), p.metadata || {});
    for (const k of Object.keys(md)) if (md[k] === '') delete md[k];
    const mh = metaEllenoriz(md);
    if (mh) return hiba(400, 'invalid_request_error', mh, 'parameter_invalid', 'metadata');
    const id = 'pi_' + veletlen(24);
    const pi = {
      id, object: 'payment_intent', amount, amount_received: 0, currency: String(p.currency).toLowerCase(),
      status: 'requires_payment_method', client_secret: `${id}_secret_${veletlen(25)}`, created: mp(),
      description: p.description ?? null, receipt_email: p.receipt_email ?? null, metadata: { ...md },
      automatic_payment_methods: p.automatic_payment_methods ? { enabled: String(p.automatic_payment_methods.enabled) === 'true' } : null,
      // mint a Stripe: automatikus modnal a feloldott lista, explicit modnal a megadott lista
      payment_method_types: p.payment_method_types ? Object.values(p.payment_method_types) : ['card'],
      latest_charge: null, last_payment_error: null, livemode: false,
    };
    pik.set(id, pi);
    return { status: 200, json: kifejt(pi, p.expand) };
  }

  function frissit(pi, p) {
    if ((p.amount !== undefined || p.currency !== undefined) && !FRISSITHETO.has(pi.status)) {
      return hiba(400, 'invalid_request_error', `This PaymentIntent's amount could not be updated because it has a status of ${pi.status}.`, 'payment_intent_unexpected_state');
    }
    if (pi.invoice && p.amount !== undefined) return hiba(400, 'invalid_request_error', "You cannot modify the amount of a PaymentIntent that is associated with an invoice.", 'payment_intent_invoice_amount');
    if (p.amount !== undefined) {
      if (!/^\d+$/.test(String(p.amount)) || Number(p.amount) <= 0) return hiba(400, 'invalid_request_error', 'Invalid integer: amount', 'parameter_invalid_integer', 'amount');
      if (pi.currency === 'huf' && Number(p.amount) % 100 !== 0) return hiba(400, 'invalid_request_error', 'HUF amounts must be divisible by 100.', 'amount_invalid', 'amount');
    }
    const md = { ...pi.metadata };
    for (const [k, v] of Object.entries(p.metadata || {})) {
      if (v === '') delete md[k];
      else md[k] = v;
    }
    const mh = metaEllenoriz(md);
    if (mh) return hiba(400, 'invalid_request_error', mh, 'parameter_invalid', 'metadata');
    if (p.amount !== undefined) pi.amount = Number(p.amount);
    if (p.receipt_email !== undefined) pi.receipt_email = p.receipt_email || null;
    if (p.description !== undefined) pi.description = p.description || null;
    pi.metadata = md;
    return { status: 200, json: kifejt(pi, p.expand) };
  }

  function idemVagy(idemKulcs, path, torzs, fn) {
    if (idemKulcs) {
      const regi = idem.get(idemKulcs);
      if (regi) {
        if (regi.path !== path || regi.torzs !== torzs) return hiba(400, 'idempotency_error', 'Keys for idempotent requests can only be used with the same parameters they were first used with.');
        return masol(regi.valasz);
      }
    }
    const v = fn();
    if (idemKulcs && v.status < 500) idem.set(idemKulcs, { path, torzs, valasz: masol(v) });
    return v;
  }

  function ugyfelLetrehoz(p) {
    const taxIds = [];
    for (const t of Object.values(p.tax_id_data || {})) {
      if (t.type === 'hu_tin' && !/^\d{8}-\d-\d{2}$/.test(String(t.value || ''))) return hiba(400, 'invalid_request_error', `Invalid value for hu_tin: ${t.value}`, 'tax_id_invalid', 'tax_id_data');
      taxIds.push({ type: t.type, value: t.value });
    }
    const u = {
      id: 'cus_' + veletlen(14), object: 'customer', name: p.name ?? null, email: p.email ?? null,
      address: p.address ? { ...p.address } : null, tax_ids: taxIds, metadata: { ...(p.metadata || {}) }, created: mp(), livemode: false,
    };
    ugyfelek.set(u.id, u);
    return { status: 200, json: masol(u) };
  }

  function tetelLetrehoz(p) {
    if (!ugyfelek.has(p.customer)) return hiba(400, 'invalid_request_error', `No such customer: '${p.customer}'`, 'resource_missing', 'customer');
    if (!/^\d+$/.test(String(p.amount ?? '')) || Number(p.amount) <= 0) return hiba(400, 'invalid_request_error', 'Invalid integer: amount', 'parameter_invalid_integer', 'amount');
    if (String(p.currency || '').toLowerCase() !== 'huf') return hiba(400, 'invalid_request_error', 'Missing or wrong currency.', 'parameter_invalid', 'currency');
    if (Number(p.amount) % 100 !== 0) return hiba(400, 'invalid_request_error', 'HUF amounts must be divisible by 100.', 'amount_invalid', 'amount');
    if (!['inclusive', 'exclusive', 'unspecified'].includes(String(p.tax_behavior || 'unspecified'))) return hiba(400, 'invalid_request_error', 'Invalid tax_behavior', 'parameter_invalid_enum', 'tax_behavior');
    if (p.tax_code !== undefined && !/^txcd_\d{8}$/.test(String(p.tax_code))) return hiba(400, 'invalid_request_error', 'Invalid tax code', 'parameter_invalid', 'tax_code');
    const t = {
      id: 'ii_' + veletlen(14), object: 'invoiceitem', customer: p.customer, currency: 'huf', amount: Number(p.amount), description: p.description ?? null,
      tax_behavior: p.tax_behavior || 'unspecified', tax_code: p.tax_code || null, invoice: p.invoice || null, metadata: { ...(p.metadata || {}) },
    };
    szamlaTetelek.set(t.id, t);
    return { status: 200, json: masol(t) };
  }

  function szamlaLetrehoz(p) {
    const u = ugyfelek.get(p.customer);
    if (!u) return hiba(400, 'invalid_request_error', `No such customer: '${p.customer}'`, 'resource_missing', 'customer');
    const pm = Object.values((p.payment_settings && p.payment_settings.payment_method_types) || []);
    for (const m of pm) if (!FIZMOD_JO.has(m)) return hiba(400, 'invalid_request_error', `The payment method type provided: ${m} is invalid.`, 'payment_method_unactivated', 'payment_settings[payment_method_types]');
    const sorok = [...szamlaTetelek.values()].filter((t) => t.customer === p.customer && !t.invoice);
    const autoAdo = p.automatic_tax && String(p.automatic_tax.enabled) === 'true';
    if (autoAdo) {
      for (const t of sorok) {
        if (t.tax_behavior === 'unspecified') return hiba(400, 'invalid_request_error', 'Invoice items with tax_behavior=unspecified cannot be added to automatic tax invoices.', 'invoice_no_tax_behavior', 'automatic_tax');
      }
    }
    const sz = {
      id: 'in_' + veletlen(18), object: 'invoice', customer: p.customer, status: 'draft', currency: 'huf', collection_method: p.collection_method || 'charge_automatically',
      auto_advance: String(p.auto_advance) === 'true', metadata: { ...(p.metadata || {}) }, payment_settings: { payment_method_types: pm.length ? pm : null },
      automatic_tax: { enabled: !!autoAdo, status: null }, lines: { object: 'list', data: sorok.map(masol) }, payment_intent: null,
      total: 0, tax: 0, amount_due: 0, created: mp(), livemode: false,
    };
    for (const t of sorok) t.invoice = sz.id;
    szamlak.set(sz.id, sz);
    return { status: 200, json: masol(sz) };
  }

  function szamlaVeglegesit(sz, p) {
    if (sz.status !== 'draft') return hiba(400, 'invalid_request_error', `This invoice is already finalized (status ${sz.status}).`, 'invoice_not_editable');
    const u = ugyfelek.get(sz.customer);
    const helyJo = !!(u && u.address && u.address.country && u.address.postal_code);
    let ossz = 0;
    let ado = 0;
    const sorok = sz.lines.data.map((t) => {
      const szazalek = sz.automatic_tax.enabled ? (ADO_SZAZALEK[t.tax_code] ?? 0) : 0;
      const sorAdo = helyJo && t.tax_behavior === 'inclusive' ? Math.round((t.amount * szazalek) / (100 + szazalek)) : 0;
      ossz += t.amount;
      ado += sorAdo;
      return { ...t, tax_amounts: [{ amount: sorAdo, tax_rate_percentage: szazalek }] };
    });
    sz.lines.data = sorok;
    sz.total = ossz;
    sz.tax = ado;
    sz.total_tax_amounts = ado ? [{ amount: ado, inclusive: true, tax_rate: 'txr_mock' }] : [];
    sz.amount_due = ossz;
    sz.automatic_tax.status = sz.automatic_tax.enabled ? (helyJo ? 'complete' : 'requires_location_inputs') : null;
    sz.status = 'open';
    const id = 'pi_' + veletlen(24);
    const pi = {
      id, object: 'payment_intent', amount: ossz, amount_received: 0, currency: 'huf', status: 'requires_payment_method',
      client_secret: `${id}_secret_${veletlen(25)}`, created: mp(), description: `Payment for Invoice`, receipt_email: null, metadata: {},
      // a szamla PI-je MINDIG explicit listas (alapbol a szamla-sablon: card, revolut_pay), nem automatikus
      payment_method_types: sz.payment_settings.payment_method_types || ['card', 'revolut_pay'],
      customer: sz.customer, invoice: sz.id, automatic_payment_methods: null, latest_charge: null, last_payment_error: null, livemode: false,
    };
    pik.set(id, pi);
    sz.payment_intent = id;
    const ki = masol(sz);
    if ((p.expand || []).includes('payment_intent')) ki.payment_intent = masol(pi);
    return { status: 200, json: ki };
  }

  function szamlaVoid(sz) {
    if (sz.status !== 'open') return hiba(400, 'invalid_request_error', `You can only pass in open invoices. This invoice isn't open (${sz.status}).`, 'invoice_not_open');
    sz.status = 'void';
    const pi = pik.get(sz.payment_intent);
    if (pi && pi.status !== 'succeeded') pi.status = 'canceled';
    return { status: 200, json: masol(sz) };
  }

  function kezel(req, torzsSzoveg) {
    const u = new URL(req.url, 'http://mock');
    const auth = String(req.headers.authorization || '');
    const kulcs = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const idemKulcs = req.headers['idempotency-key'] || null;
    const parameterek = req.method === 'GET' ? bontas(u.searchParams) : bontas(new URLSearchParams(torzsSzoveg));
    const keres = { method: req.method, path: u.pathname, params: masol(parameterek), idem: idemKulcs, verzio: req.headers['stripe-version'] || null };
    keresek.push(keres);
    if (!kulcs.startsWith(kulcsElotag)) return hiba(401, 'invalid_request_error', 'Invalid API Key provided.');
    if (hibaSor.length) {
      const st = hibaSor.shift();
      return hiba(st, 'api_error', 'Mock: szimulalt Stripe-hiba.');
    }
    const szabalyStatusz = hibaSzabaly ? Number(hibaSzabaly(keres)) || 0 : 0;
    if (szabalyStatusz) return hiba(szabalyStatusz, 'api_error', 'Mock: szabaly szerinti Stripe-hiba.');
    const chm = /^\/v1\/charges\/([A-Za-z0-9_]+)$/.exec(u.pathname);
    if (chm && req.method === 'GET') {
      const ch = chargek.get(chm[1]);
      return ch ? { status: 200, json: masol(ch) } : hiba(404, 'invalid_request_error', `No such charge: '${chm[1]}'`, 'resource_missing', 'charge');
    }

    if (u.pathname === '/v1/payment_intents' && req.method === 'POST') {
      if (idemKulcs) {
        const regi = idem.get(idemKulcs);
        if (regi) {
          if (regi.path !== u.pathname || regi.torzs !== torzsSzoveg) {
            return hiba(400, 'idempotency_error', 'Keys for idempotent requests can only be used with the same parameters they were first used with.');
          }
          return masol(regi.valasz); // ugyanaz a (pillanatkep-)valasz, mint elsore - mint a Stripe-nal
        }
      }
      const v = letrehoz(parameterek);
      if (idemKulcs && v.status < 500) idem.set(idemKulcs, { path: u.pathname, torzs: torzsSzoveg, valasz: masol(v) });
      return v;
    }
    const m = /^\/v1\/payment_intents\/([A-Za-z0-9_]+)$/.exec(u.pathname);
    if (m) {
      const pi = pik.get(m[1]);
      if (!pi) return hiba(404, 'invalid_request_error', `No such payment_intent: '${m[1]}'`, 'resource_missing', 'intent');
      if (req.method === 'GET') return { status: 200, json: kifejt(pi, parameterek.expand) };
      if (req.method === 'POST') return frissit(pi, parameterek);
    }
    // Stripe-szamla
    if (u.pathname === '/v1/customers' && req.method === 'POST') return idemVagy(idemKulcs, u.pathname, torzsSzoveg, () => ugyfelLetrehoz(parameterek));
    if (u.pathname === '/v1/invoiceitems' && req.method === 'POST') return idemVagy(idemKulcs, u.pathname, torzsSzoveg, () => tetelLetrehoz(parameterek));
    if (u.pathname === '/v1/invoices' && req.method === 'POST') return idemVagy(idemKulcs, u.pathname, torzsSzoveg, () => szamlaLetrehoz(parameterek));
    const szm = /^\/v1\/invoices\/(in_[A-Za-z0-9]+)(?:\/(finalize|void))?$/.exec(u.pathname);
    if (szm) {
      const sz = szamlak.get(szm[1]);
      if (!sz) return hiba(404, 'invalid_request_error', `No such invoice: '${szm[1]}'`, 'resource_missing', 'invoice');
      if (req.method === 'GET' && !szm[2]) return { status: 200, json: masol(sz) };
      if (req.method === 'POST' && szm[2] === 'finalize') return idemVagy(idemKulcs, u.pathname, torzsSzoveg, () => szamlaVeglegesit(sz, parameterek));
      if (req.method === 'POST' && szm[2] === 'void') return szamlaVoid(sz);
    }
    return hiba(404, 'invalid_request_error', `Unrecognized request URL (${req.method}: ${u.pathname}).`);
  }

  const szerver = http.createServer((req, res) => {
    let torzs = '';
    req.setEncoding('utf8');
    req.on('data', (d) => { torzs += d; });
    req.on('end', () => {
      let v;
      try {
        v = kezel(req, torzs);
      } catch (e) {
        v = hiba(500, 'api_error', 'Mock: belso hiba: ' + (e && e.message));
      }
      res.writeHead(v.status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(v.json));
    });
  });

  await new Promise((ok, hibas) => {
    szerver.once('error', hibas);
    szerver.listen(port, '127.0.0.1', ok);
  });

  const nemLetezo = (id) => { throw new Error(`mock: nincs ilyen PaymentIntent: ${id}`); };
  const allapot = {
    // vezerlok
    // mod: 'card' | 'apple_pay' | 'google_pay' | 'link'; created: a terheles ideje (unix mp), alapbol most
    sikeresIt(piId, { mod = 'card', created = mp() } = {}) {
      const pi = pik.get(piId) || nemLetezo(piId);
      const ch = {
        id: 'ch_' + veletlen(24), object: 'charge', amount: pi.amount, currency: pi.currency, created, paid: true,
        status: 'succeeded', payment_intent: pi.id,
        payment_method_details: mod === 'link'
          ? { type: 'link', link: {} }
          : { type: 'card', card: { brand: 'visa', last4: '4242', wallet: mod === 'card' ? null : { type: mod } } },
        billing_details: { name: pi.metadata.nev || null, email: pi.receipt_email },
        refunded: false, amount_refunded: 0, disputed: false,
      };
      chargek.set(ch.id, ch);
      Object.assign(pi, { status: 'succeeded', amount_received: pi.amount, latest_charge: ch.id, last_payment_error: null });
      if (pi.invoice && szamlak.has(pi.invoice)) szamlak.get(pi.invoice).status = 'paid';
      return masol(pi);
    },
    bukas(piId) {
      const pi = pik.get(piId) || nemLetezo(piId);
      Object.assign(pi, { status: 'requires_payment_method', last_payment_error: { type: 'card_error', code: 'card_declined', message: 'Your card was declined.' } });
      return masol(pi);
    },
    feldolgozas(piId) {
      const pi = pik.get(piId) || nemLetezo(piId);
      pi.status = 'processing';
      return masol(pi);
    },
    // a kovetkezo n keres ezzel a HTTP-statusszal bukik (pl. 500: Stripe-kiesés)
    kovetkezoHiba(status = 500, n = 1) {
      for (let i = 0; i < n; i++) hibaSor.push(status);
    },
    // tartos hibaszabaly: fn({ method, path, params, idem }) -> HTTP-statusz (bukik) | 0 (mehet); null: ki
    hibaSzabaly(fn) {
      hibaSzabaly = typeof fn === 'function' ? fn : null;
    },
    // visszaterites a PI terhelesen (osszeg: a Stripe-egysegben, alapbol a teljes osszeg)
    visszaterites(piId, { osszeg } = {}) {
      const pi = pik.get(piId) || nemLetezo(piId);
      const ch = chargek.get(pi.latest_charge) || nemLetezo(pi.latest_charge);
      ch.amount_refunded = Math.min(ch.amount, (ch.amount_refunded || 0) + (osszeg ?? ch.amount));
      ch.refunded = ch.amount_refunded >= ch.amount;
      return masol(ch);
    },
    // vita (chargeback) a PI terhelesen -> a vita-objektum (dp_...)
    vita(piId) {
      const pi = pik.get(piId) || nemLetezo(piId);
      const ch = chargek.get(pi.latest_charge) || nemLetezo(pi.latest_charge);
      ch.disputed = true;
      const dp = { id: 'dp_' + veletlen(24), object: 'dispute', amount: ch.amount, charge: ch.id, payment_intent: pi.id, status: 'needs_response', reason: 'fraudulent' };
      vitak.set(dp.id, dp);
      return masol(dp);
    },
    charge: (id) => (chargek.has(id) ? masol(chargek.get(id)) : null),
    // a Stripe Tax szazalekai tax_code szerint (a teszt eltero / hibas adot szimulalhat): { txcd_20040009: 0 }
    adoSzazalek(o) { Object.assign(ADO_SZAZALEK, o); },
    szamla: (id) => (szamlak.has(id) ? masol(szamlak.get(id)) : null),
    get szamlak() { return szamlak; },
    get ugyfelek() { return ugyfelek; },
    get szamlaTetelek() { return szamlaTetelek; },
    // lekerdezok
    pi: (id) => (pik.has(id) ? masol(pik.get(id)) : null),
    get pik() { return pik; },
    get keresek() { return keresek; },
    letrehozasokSzama: () => keresek.filter((k) => k.method === 'POST' && k.path === '/v1/payment_intents').length,
  };

  const { port: valodiPort } = szerver.address();
  return {
    url: `http://127.0.0.1:${valodiPort}`,
    allapot,
    bezar: () => new Promise((ok) => {
      if (typeof szerver.closeAllConnections === 'function') szerver.closeAllConnections();
      szerver.close(() => ok());
    }),
  };
}
