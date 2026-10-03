// Hordozhato Stripe REST-mock a Gift Commerce Engine tesztjeihez (node:http, fuggoseg nelkul).
// Csak azt tudja, amit a netlify/lib/ajandek.js hasznal:
//   POST /v1/payment_intents            letrehozas (form-encoded; Idempotency-Key tamogatas)
//   GET  /v1/payment_intents/:id        lekeres (expand[]=latest_charge)
//   POST /v1/payment_intents/:id        frissites (amount, receipt_email, description, metadata osszefesules;
//                                       metadata[kulcs]= ures ertek torli)
// Vezerlo-segedek a tesztnek (allapot): sikeresIt, bukas, feldolgozas, kovetkezoHiba, pi, keresek.
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
      latest_charge: null, last_payment_error: null, livemode: false,
    };
    pik.set(id, pi);
    return { status: 200, json: kifejt(pi, p.expand) };
  }

  function frissit(pi, p) {
    if ((p.amount !== undefined || p.currency !== undefined) && !FRISSITHETO.has(pi.status)) {
      return hiba(400, 'invalid_request_error', `This PaymentIntent's amount could not be updated because it has a status of ${pi.status}.`, 'payment_intent_unexpected_state');
    }
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

  function kezel(req, torzsSzoveg) {
    const u = new URL(req.url, 'http://mock');
    const auth = String(req.headers.authorization || '');
    const kulcs = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const idemKulcs = req.headers['idempotency-key'] || null;
    const parameterek = req.method === 'GET' ? bontas(u.searchParams) : bontas(new URLSearchParams(torzsSzoveg));
    keresek.push({ method: req.method, path: u.pathname, params: masol(parameterek), idem: idemKulcs, verzio: req.headers['stripe-version'] || null });
    if (!kulcs.startsWith(kulcsElotag)) return hiba(401, 'invalid_request_error', 'Invalid API Key provided.');
    if (hibaSor.length) {
      const st = hibaSor.shift();
      return hiba(st, 'api_error', 'Mock: szimulalt Stripe-hiba.');
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
      };
      chargek.set(ch.id, ch);
      Object.assign(pi, { status: 'succeeded', amount_received: pi.amount, latest_charge: ch.id, last_payment_error: null });
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
