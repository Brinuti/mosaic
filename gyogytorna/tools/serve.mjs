// Helyi kiszolgalo: dist/ + a functions/api vegpontok (D1-szimulatorral). Teszteleshez: import { indit }.
//   node tools/build.mjs && node tools/serve.mjs   -> http://localhost:4291/
import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ujD1 } from './d1-szim.mjs';
const gyoker = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const TIPUS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.txt': 'text/plain', '.css': 'text/css' };

export async function indit({ port = 0, env = {}, dist = path.join(gyoker, 'dist') } = {}) {
  const vegpontok = {};
  for (const f of fs.readdirSync(path.join(gyoker, 'functions/api'))) vegpontok['/api/' + f.replace(/\.js$/, '')] = (await import(pathToFileURL(path.join(gyoker, 'functions/api', f)).href)).onRequest;
  const kornyezet = { GY_DB: ujD1(), ...env };
  const szerver = createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x');
    if (vegpontok[u.pathname]) {
      const chunks = []; for await (const c of req) chunks.push(c);
      const host = req.headers.host;
      const r = await vegpontok[u.pathname]({ request: new Request(`http://${host}${req.url}`, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) }), env: kornyezet });
      const fejlec = {}; for (const [k, v] of r.headers) if (k !== 'set-cookie') fejlec[k] = v;
      const sc = r.headers.getSetCookie(); if (sc.length) fejlec['set-cookie'] = sc.map((c) => c.replace(/;\s*Secure/i, '')); // http-n a Secure suti nem menne el
      res.writeHead(r.status, fejlec); return res.end(Buffer.from(await r.arrayBuffer()));
    }
    let ut = decodeURIComponent(u.pathname);
    let f = path.join(dist, ut);
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    if (f.startsWith(dist) && fs.existsSync(f) && fs.statSync(f).isFile()) { res.writeHead(200, { 'content-type': TIPUS[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); return fs.createReadStream(f).pipe(res); }
    res.writeHead(404); res.end('404');
  });
  await new Promise((ok) => szerver.listen(port, '127.0.0.1', ok));
  return { szerver, port: szerver.address().port, env: kornyezet, leall: () => new Promise((ok) => szerver.close(ok)) };
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const s = await indit({ port: +process.env.PORT || 4291, env: { GY_HMAC_KULCS: 'helyi-proba-kulcs-0123456789' } });
  console.log(`http://localhost:${s.port}/`);
}
