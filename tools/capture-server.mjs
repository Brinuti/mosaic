// Meresi adatok fogadasa a bongeszobol: node tools/capture-server.mjs
// A POST /capture torzset a tools/spec/<name>.json fajlba irja.
import { createServer } from 'node:http';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'tools/spec');
const PORT = process.env.CAPTURE_PORT || 4199;
await mkdir(OUT, { recursive: true });

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-allow-private-network': 'true',
  'access-control-max-age': '86400',
};

createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS).end(); return; }
  if (req.method !== 'POST') { res.writeHead(405, CORS).end('POST only'); return; }
  try {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString('utf8');
    const name = (new URL(req.url, 'http://x').searchParams.get('name') || 'capture')
      .replace(/[^a-z0-9_.-]/gi, '_');
    const file = path.join(OUT, name + '.json');
    await writeFile(file, raw);
    console.log(`${name}.json  ${(raw.length / 1024).toFixed(1)} KB`);
    res.writeHead(200, { ...CORS, 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, bytes: raw.length, file: path.relative(ROOT, file) }));
  } catch (e) {
    res.writeHead(500, CORS).end(String(e));
  }
}).listen(PORT, () => console.log(`capture: http://localhost:${PORT}/capture?name=...`));
