// Kepcimkezo - osszeallitja az Apps Script projektet: src/*.js + a promptbol / semabol generalt fajl + manifest.
// Hasznalat:  node tools/kepcimkezo/build.mjs <kimeneti-mappa>      (clasp push ebbol a mappabol megy)
// A tesztek a buildFiles()-t hasznaljak (nincs lemezre iras).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

export function buildFiles() {
  const src = path.join(ROOT, 'src');
  const prompt = fs.readFileSync(path.join(ROOT, 'prompt.txt'), 'utf8').trim();
  const schema = JSON.parse(fs.readFileSync(path.join(ROOT, 'schema.json'), 'utf8'));
  const generated =
    '/* Generalt fajl (build.mjs): a prompt.txt es a schema.json tartalma. Ne szerkeszd kozvetlenul. */\n' +
    'var KC = KC || {};\n' +
    'KC.PROMPT = ' + JSON.stringify(prompt) + ';\n' +
    'KC.SCHEMA = ' + JSON.stringify(schema) + ';\n';

  const files = fs.readdirSync(src)
    .filter((n) => n.endsWith('.js'))
    .map((n) => ({ name: n.replace(/\.js$/, ''), type: 'SERVER_JS', source: fs.readFileSync(path.join(src, n), 'utf8') }));
  files.push({ name: '05_prompt', type: 'SERVER_JS', source: generated });
  files.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  files.push({ name: 'appsscript', type: 'JSON', source: fs.readFileSync(path.join(src, 'appsscript.json'), 'utf8') });
  return files;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = process.argv[2];
  if (!out) { console.error('Hasznalat: node build.mjs <kimeneti-mappa>'); process.exit(1); }
  fs.mkdirSync(out, { recursive: true });
  for (const f of buildFiles()) {
    const file = path.join(out, f.name + (f.type === 'JSON' ? '.json' : '.js'));
    fs.writeFileSync(file, f.source);
    console.log(file, f.source.length + ' bajt');
  }
}
