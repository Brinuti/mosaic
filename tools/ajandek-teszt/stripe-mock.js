// Bongeszos Stripe.js MOCK - CSAK a helyi tesztkiszolgalo (tools/ajandek-teszt/szerver.mjs) teszi az oldalba.
// Eles oldalon nincs ilyen fajl: ott a motor a valodi https://js.stripe.com/v3/ szkriptet tolti be.
//
// A mock kartyaszam-mezoje (teszt):
//   4242 4242 4242 4242   sikeres fizetes
//   4000 0000 0000 0002   elutasitott kartya (card_error)
//   4000 0025 0000 3155   atiranyitas (3DS-szeru): a lap uj URL-lel toltodik, mint a valodi visszateresnel
//   barmi mas / ures      validacios hiba (nem fizetes)
(function () {
  'use strict';
  function teszt(vezerles, pi, mod) {
    return fetch('/__teszt/mock/' + vezerles + '?pi=' + encodeURIComponent(pi) + (mod ? '&mod=' + mod : ''), { method: 'POST' });
  }
  window.Stripe = function (kulcs) {
    if (!/^pk_test_/.test(kulcs || '')) throw new Error('mock: csak pk_test_ kulcs');
    return {
      elements: function (opciok) {
        var allapot = { opciok: opciok, input: null, valtozas: [] };
        var elem = {
          mount: function (node) {
            node.innerHTML = '';
            var d = document.createElement('div');
            d.setAttribute('data-mock-stripe', '1');
            d.style.cssText = 'display:grid;gap:8px;font:14px sans-serif';
            var cimke = document.createElement('label');
            cimke.textContent = 'Kártyaszám (MOCK Stripe Payment Element)';
            var input = document.createElement('input');
            input.id = 'mock-kartya'; input.placeholder = '4242 4242 4242 4242'; input.autocomplete = 'off';
            input.style.cssText = 'padding:12px;border:1px solid #ccc;border-radius:10px;font-size:16px';
            var tipus = document.createElement('select');
            tipus.id = 'mock-tipus';
            [['card', 'Bankkártya'], ['apple_pay', 'Apple Pay'], ['google_pay', 'Google Pay']].forEach(function (x) { var o = document.createElement('option'); o.value = x[0]; o.textContent = x[1]; tipus.appendChild(o); });
            d.appendChild(cimke); d.appendChild(input); d.appendChild(tipus); node.appendChild(d);
            allapot.input = input; allapot.tipus = tipus;
            function jelez() {
              var kesz = input.value.replace(/\s/g, '').length >= 16;
              allapot.valtozas.forEach(function (fn) { fn({ complete: kesz, value: { type: tipus.value === 'card' ? 'card' : tipus.value }, error: null }); });
            }
            input.addEventListener('input', jelez); tipus.addEventListener('change', jelez);
          },
          on: function (nev, fn) { if (nev === 'change') allapot.valtozas.push(fn); },
          focus: function () { if (allapot.input) allapot.input.focus(); },
          destroy: function () {}
        };
        return {
          _allapot: allapot,
          create: function (tipus, o) { allapot.mezok = (o && o.fields && o.fields.billingDetails) || null; return elem; },
          submit: function () {
            var szam = allapot.input ? allapot.input.value.replace(/\s/g, '') : '';
            if (szam.length < 16) return Promise.resolve({ error: { type: 'validation_error', message: 'A kártyaszám hiányos.' } });
            return Promise.resolve({});
          },
          update: function (o) { allapot.opciok = Object.assign({}, allapot.opciok, o); window.__mockElementsFrissites = allapot.opciok; }
        };
      },
      confirmPayment: function (p) {
        var cs = p.clientSecret, pi = cs.split('_secret_')[0];
        // a valodi Stripe.js IntegrationErrort dob, ha a fields.billingDetails 'never' mezoit nem adjuk at (a cim MINDEN
        // reszletet kéri, line2 es state is; ures szoveg elfogadott) - igy a hiba a helyi tesztben is latszik
        var mezok = p.elements && p.elements._allapot && p.elements._allapot.mezok;
        var bd = (p.confirmParams && p.confirmParams.payment_method_data && p.confirmParams.payment_method_data.billing_details) || {};
        if (mezok) {
          var hianyzo = '';
          if (mezok.name === 'never' && bd.name === undefined) hianyzo = 'name';
          else if (mezok.email === 'never' && bd.email === undefined) hianyzo = 'email';
          else if (mezok.address === 'never') {
            ['line1', 'line2', 'city', 'state', 'country', 'postal_code'].some(function (k) {
              if (!bd.address || bd.address[k] === undefined) { hianyzo = 'address.' + k; return true; }
              return false;
            });
          }
          if (hianyzo) {
            var hiba = new Error('You specified "never" for fields.billing_details when creating the payment Element, but did not pass confirmParams.payment_method_data.billing_details.' + hianyzo + ' when calling stripe.confirmPayment().');
            hiba.name = 'IntegrationError';
            return Promise.reject(hiba);
          }
        }
        var szamEl = document.getElementById('mock-kartya');
        var szam = szamEl ? szamEl.value.replace(/\s/g, '') : '';
        var mod = (document.getElementById('mock-tipus') || {}).value || 'card';
        window.__mockConfirm = { pi: pi, billing: p.confirmParams && p.confirmParams.payment_method_data && p.confirmParams.payment_method_data.billing_details, return_url: p.confirmParams && p.confirmParams.return_url };
        return new Promise(function (ok) {
          setTimeout(function () {
            if (szam === '4000000000000002') {
              teszt('bukas', pi).then(function () { ok({ error: { type: 'card_error', code: 'card_declined', message: 'A kártyádat elutasították.' } }); });
            } else if (szam === '4000002500003155') {
              teszt('siker', pi, mod).then(function () {
                var u = new URL(p.confirmParams.return_url);
                u.searchParams.set('payment_intent', pi);
                u.searchParams.set('payment_intent_client_secret', cs);
                u.searchParams.set('redirect_status', 'succeeded');
                location.href = u.toString();
              });
            } else {
              teszt('siker', pi, mod).then(function () { ok({ paymentIntent: { id: pi, status: 'succeeded' } }); });
            }
          }, 400);
        });
      }
    };
  };
})();
