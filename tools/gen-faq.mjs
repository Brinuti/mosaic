// GYIK reszleg generalasa a tools/content/faq.json-bol.
import { readFile, writeFile } from 'node:fs/promises';
const faq = JSON.parse(await readFile('tools/content/faq.json', 'utf8'));

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function render(items) {
  return items.map((it) => {
    const lista = it.lista
      ? '\n          <ul>' + it.lista.map((l) => `\n            <li>${esc(l)}</li>`).join('') + '\n          </ul>'
      : '';
    return `      <div class="faq-item">
        <button class="faq-q" type="button">${esc(it.q)}</button>
        <div class="faq-a">
          <p>${esc(it.a)}</p>${lista}
        </div>
      </div>`;
  }).join('\n\n');
}

for (const [key, items] of Object.entries(faq)) {
  const out = `    <div class="faq mt-24">\n\n${render(items)}\n\n    </div>\n`;
  await writeFile(`src/partials/faq-${key}.html`, out);
  console.log(`faq-${key}.html:`, items.length, 'kerdes');
}
