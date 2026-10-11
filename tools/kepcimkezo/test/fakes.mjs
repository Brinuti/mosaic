// Kozos hamis kornyezet a tesztekhez: Drive-fa, OpenAI, miniatur-szerver.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { buildFiles } from '../build.mjs';

// A logikat az Apps Script-hez hasonloan egy kozos globalis hatokorbe toltjuk be.
// withGas = true: a 90_gas.js is (az Apps Script szolgaltatasokat a teszt adja meg globalisokent).
export function loadKC(withGas = false) {
  const code = buildFiles()
    .filter((f) => f.type === 'SERVER_JS' && (withGas || !f.name.startsWith('90_')))
    .map((f) => f.source)
    .join('\n');
  vm.runInThisContext(code + '\n;globalThis.KC = KC;');
  return globalThis.KC;
}

export const FOLDER = 'application/vnd.google-apps.folder';

export function file(id, name, parents, extra = {}) {
  return Object.assign({
    id, name, parents, mimeType: 'image/jpeg', md5Checksum: 'md5-' + id, modifiedTime: '2026-01-01T00:00:00Z',
    thumbnailLink: 'https://lh3.googleusercontent.com/' + id + '=s220', imageMediaMetadata: { width: 800, height: 600 }
  }, extra);
}
export function folder(id, name, parents) { return { id, name, parents, mimeType: FOLDER }; }

// A = 1D4Rs..., B = 1QfY-..., C = 1-peL4-... (a KC.CFG.ROOTS sorrendje)
export function sampleTree(KC) {
  const A = KC.CFG.ROOTS[0].id, B = KC.CFG.ROOTS[1].id, C = KC.CFG.ROOTS[2].id;
  return [
    folder('fMosaic', 'MOSAIC Head spa', [A]),
    folder('fMP', 'Medical Piercing', [A]),
    folder('fGyogy', 'Gyógytornászom', [A]),
    folder('fJelsz', 'Jelszavak', ['fMosaic']),
    folder('fSub', 'Kész videók', ['fMosaic']),
    folder('fInf', '2025.02.13 Influencer videók', ['fMosaic']),
    folder('fCinf', 'Influencer szerződés', [C]),
    folder('fCjel', 'Jelszavak', [C]),
    folder('fCsoc', 'Social content', [C]),
    file('m1', 'a.jpg', ['fMosaic']),
    file('m2', 'b.png', ['fMosaic'], { mimeType: 'image/png' }),
    file('v1', 'c.mov', ['fSub'], { mimeType: 'video/quicktime', imageMediaMetadata: undefined, videoMediaMetadata: { width: 720, height: 1280, durationMillis: '15689' } }),
    file('i1', 'inf.jpg', ['fInf']),
    file('pw1', 'jelszo.png', ['fJelsz']),
    file('g1', 'gyogy.jpg', ['fGyogy']),
    file('p1', 'ear.jpg', ['fMP']),
    file('root1', 'gyoker.jpg', [A]),
    file('b1', 'a-masolat.jpg', [B], { md5Checksum: 'md5-m1' }),   // ugyanaz a tartalom, mint m1
    file('b2', 'csak-b.jpg', [B]),
    file('c1', 'social.jpg', ['fCsoc']),
    file('c2', 'szerzodes.jpg', ['fCinf']),
    file('c3', 'jelszo2.jpg', ['fCjel'])
  ];
}

// A Drive files.list hamis valtozata: params -> a Drive valasz-objektuma (files, nextPageToken)
export function makeDriveList(tree, opts, calls) {
  return function driveList(params) {
    calls.drive++;
    const parents = [...params.q.matchAll(/'([^']+)' in parents/g)].map((m) => m[1]);
    // A Drive tobb szulos keresese megosztott mappaknal csendben kihagy elemeket: mindig EGY szulo lehet.
    assert.equal(parents.length, 1, 'egyszerre csak egy szulo kerdezheto le: ' + parents.length);
    const list = tree.filter((f) => (f.parents || []).some((p) => parents.includes(p)) &&
      (f.mimeType === FOLDER || /^(image|video)\//.test(f.mimeType)));
    const off = Number(params.pageToken || 0);
    const size = opts.pageSize || 1000;
    const body = { files: list.slice(off, off + size) };
    if (off + size < list.length) body.nextPageToken = String(off + size);
    return body;
  };
}

// A halozat: req = { url, auth, body, binary } -> { code, text | b64, mime }
export function makeHttp(tree, opts, calls, clock) {
  return function fakeFetch(r) {
    const u = new URL(r.url);
    if (u.host === 'lh3.googleusercontent.com') {
      calls.thumbs++;
      const id = u.pathname.split('/')[1].replace(/=s\d+$/, '');
      if ((opts.noThumb || []).includes(id)) return { code: 404, text: 'nincs' };
      if (opts.thumbNeedsNoAuth && r.auth === 'google') return { code: 403, text: 'auth' };
      assert.match(r.url, /=s384$/);
      return { code: 200, b64: 'R0lGODlhAQABAAAAACw=', mime: 'image/gif' };
    }
    if (u.host === 'api.openai.com') {
      if (u.pathname.startsWith('/v1/models/')) return { code: opts.modelsCode || 200, text: '{}' };
      calls.openai++;
      clock.t += opts.msPerOpenai || 0;
      const body = JSON.parse(r.body);
      const n = body.input[0].content.filter((c) => c.type === 'input_image').length;
      calls.openaiImages += n;
      const hook = opts.openai && opts.openai(calls.openai, body, n);
      if (hook) return hook;
      const texts = body.input[0].content.filter((c) => c.type === 'input_text').slice(1).map((c) => c.text);
      const items = texts.map((t, k) => ({
        i: k, uzletag: /Medical/.test(t) ? 'piercing' : 'headspa', tema: 'egyeb', felirat: 'nincs', szoveg: '=SUM(1,1)',
        nyersitheto: 'mar_nyers', arc: 'nincs', minoseg: 3, leiras: 'teszt ' + t.slice(0, 20)
      }));
      return {
        code: 200,
        text: JSON.stringify({
          status: 'completed',
          output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ items }) }] }],
          usage: { input_tokens: 200 * n + 250, output_tokens: 67 * n }
        })
      };
    }
    throw new Error('ismeretlen host: ' + r.url);
  };
}
