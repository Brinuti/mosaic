import { defineDurable } from '@zapier/zapier-durable';
import { createZapierSdk } from '@zapier/zapier-sdk';

// Drive -> MOSAIC repo atviteli cso (Zapier "draft" futas, NEM publikalt workflow). Leiras: tools/email-kepek/README.md
// A Zapier workflow-sandbox csak a kapcsolat (connection) altal engedelyezett hosztokat eri el, ezert minden hivas sdk.fetch-csel megy:
//   alias "drive"  = a Google Drive-kapcsolat (a MOSAIC Drive-mappa megosztva van ezzel a fiokkal),
//   alias "github" = a GitHub-kapcsolat (a Brinuti/mosaic repo).
// A Drive-bol a thumbnailLink (=s<meret>) adja a kicsinyitett, JPEG-re alakitott kepet (a HEIC-et is), a GitHub-blob ~600 KB-ig fogad el.
//  mod 'bel':   { gyoker:[{id,ut}], cel, ag, uzenet, meret?, minSzel?, maxMappankent? } - mappak kepeinek kis elonezete CSOMAGOLVA (pack-*.bin: 48 karakter azonosito + 8 jegyu hossz + JPEG) + manifest-*.tsv
//  mod 'masol': { ag, uzenet, fajlok:[{id,ut,meret?}] vagy lista_ut (repo-beli JSON) } - kicsinyitett kepek kulon fajlokban, EGY commitban
//  mod 'lista': { gyoker:[{id,ut}] } - a Drive-fa bejarasa, mappankenti kep/video darabszam
const sdk = createZapierSdk();
const API = 'https://api.github.com/repos/Brinuti/mosaic';
const DRIVE = 'https://www.googleapis.com/drive/v3/files';
const MAX_BAJT = 560_000;
const CSOMAG_BAJT = 480_000;

function b64(buf: Uint8Array): string {
  let s = '';
  const darab = 0x8000;
  for (let i = 0; i < buf.length; i += darab) s += String.fromCharCode(...buf.subarray(i, i + darab));
  return btoa(s);
}
function szoveg2b64(t: string): string { return b64(new TextEncoder().encode(t)); }
const varj = (ms: number) => new Promise((res) => setTimeout(res, ms));

export default defineDurable('drive-kep-atmasolas', async (ctx, rawInput: unknown) => {
  const be: any = typeof rawInput === 'string' ? JSON.parse(rawInput) : (rawInput as any);

  const gh = async (method: string, ut: string, body?: unknown) => {
    for (let proba = 0; ; proba++) {
      const r = await sdk.fetch(`${API}${ut}`, {
        connection: 'github', method,
        headers: { 'content-type': 'application/json', accept: 'application/vnd.github+json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const szoveg = await r.text();
      if (r.ok) return JSON.parse(szoveg);
      if ((r.status === 403 || r.status === 429) && proba < 6) {
        const v = Number(r.headers.get('retry-after') ?? 0);
        await varj(Math.max(v, 10 + proba * 10) * 1000);
        continue;
      }
      throw new Error(`GitHub ${method} ${ut}: ${r.status} ${szoveg.slice(0, 200)}`);
    }
  };
  const fejOlvas = () => ctx.step('read-branch-head', async () => {
    const ref = await gh('GET', `/git/ref/heads/${be.ag}`);
    const commit = await gh('GET', `/git/commits/${ref.object.sha}`);
    return { sha: ref.object.sha as string, fa: commit.tree.sha as string };
  });
  const commitol = (fej: { sha: string; fa: string }, elemek: { ut: string; sha: string }[]) => ctx.step('commit-files', async () => {
    const fa = await gh('POST', '/git/trees', { base_tree: fej.fa, tree: elemek.map((x) => ({ path: x.ut, mode: '100644', type: 'blob', sha: x.sha })) });
    const commit = await gh('POST', '/git/commits', { message: be.uzenet, tree: fa.sha, parents: [fej.sha] });
    await gh('PATCH', `/git/refs/heads/${be.ag}`, { sha: commit.sha, force: false });
    return commit.sha as string;
  });
  const driveLista = async (mappaId: string) => {
    const kimenet: any[] = [];
    let token = '';
    do {
      const q = encodeURIComponent(`'${mappaId}' in parents and trashed=false`);
      const fields = encodeURIComponent('nextPageToken,files(id,name,mimeType,size,thumbnailLink,imageMediaMetadata(width,height))');
      const r = await sdk.fetch(`${DRIVE}?q=${q}&fields=${fields}&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true${token ? '&pageToken=' + encodeURIComponent(token) : ''}`, { connection: 'drive', method: 'GET' });
      const j: any = await r.json();
      kimenet.push(...(j.files ?? []));
      token = j.nextPageToken ?? '';
    } while (token);
    return kimenet;
  };
  const kepLetolt = async (thumbnailLink: string, meret: number) => {
    let m = meret;
    for (let proba = 0; proba < 4; proba++) {
      const r = await sdk.fetch(String(thumbnailLink).replace(/=s\d+$/, `=s${m}`), { connection: 'drive', method: 'GET' });
      if (!r.ok) throw new Error(`bélyegkép ${r.status}`);
      const adat = new Uint8Array(await r.arrayBuffer());
      if (adat.length <= MAX_BAJT) return { adat, meret: m };
      m = Math.round(m * 0.8);
    }
    throw new Error('tul nagy');
  };

  // ---------- elonezetek mappakbol, csomagolva ----------
  if (be.mod === 'bel') {
    const fej = await fejOlvas();
    const meret = be.meret ?? 240;
    const minSzel = be.minSzel ?? 0;
    const elemek: { ut: string; sha: string }[] = [];
    let szint: { id: string; ut: string }[] = be.gyoker;
    let kepDb = 0, mappaDb = 0, hibaDb = 0;
    for (let sz = 0; szint.length && sz < 6; sz++) {
      const kovetkezo: { id: string; ut: string }[] = [];
      for (let k = 0; k < szint.length; k += 4) {
        const resz = szint.slice(k, k + 4);
        const eredm = await Promise.all(resz.map((m, j) => ctx.step(`bel-${sz}-${k + j}`, async () => {
          const almappak: { id: string; ut: string }[] = [];
          const e2: { ut: string; sha: string }[] = [];
          const sorok: string[] = [];
          let hiba = 0;
          const lista = await driveLista(m.id);
          let kepek: any[] = [];
          for (const f of lista) {
            if (f.mimeType === 'application/vnd.google-apps.folder') almappak.push({ id: f.id, ut: `${m.ut}/${f.name}` });
            else if (String(f.mimeType).startsWith('image/') && f.thumbnailLink && Number(f.imageMediaMetadata?.width ?? 99999) >= minSzel) kepek.push(f);
          }
          if (be.maxMappankent) kepek = kepek.slice(0, be.maxMappankent);
          let csomagAdat: Uint8Array[] = []; let csomagMeret = 0; let p = 0;
          const kiir = async () => {
            if (!csomagAdat.length) return;
            const ossz = new Uint8Array(csomagMeret); let o = 0;
            for (const d of csomagAdat) { ossz.set(d, o); o += d.length; }
            const blob = await gh('POST', '/git/blobs', { content: b64(ossz), encoding: 'base64' });
            e2.push({ ut: `${be.cel}/pack-${sz}-${k + j}-${p++}.bin`, sha: blob.sha });
            csomagAdat = []; csomagMeret = 0;
          };
          for (let q = 0; q < kepek.length; q += 8) {
            const rr = await Promise.all(kepek.slice(q, q + 8).map(async (f) => {
              try { return { f, ...(await kepLetolt(f.thumbnailLink, meret)) }; } catch { hiba++; return null; }
            }));
            for (const x of rr) {
              if (!x) continue;
              const fejlec = new TextEncoder().encode(x.f.id.padEnd(48, ' ') + String(x.adat.length).padStart(8, '0'));
              csomagAdat.push(fejlec, x.adat); csomagMeret += fejlec.length + x.adat.length;
              sorok.push([m.ut, x.f.id, x.f.name, x.f.imageMediaMetadata?.width ?? '', x.f.imageMediaMetadata?.height ?? '', x.f.size ?? ''].join('\t'));
              if (csomagMeret > CSOMAG_BAJT) await kiir();
            }
          }
          await kiir();
          if (sorok.length) {
            const blob = await gh('POST', '/git/blobs', { content: szoveg2b64(sorok.join('\n') + '\n'), encoding: 'base64' });
            e2.push({ ut: `${be.cel}/manifest-${sz}-${k + j}.tsv`, sha: blob.sha });
          }
          return { almappak, e2, kep: sorok.length, hiba };
        })));
        for (const e of eredm) { kovetkezo.push(...e.almappak); elemek.push(...e.e2); kepDb += e.kep; hibaDb += e.hiba; }
        mappaDb += resz.length;
      }
      szint = kovetkezo;
    }
    const commit = elemek.length ? await commitol(fej, elemek) : null;
    return { commit, mappa: mappaDb, kep: kepDb, hiba: hibaDb, fajl: elemek.length };
  }

  // ---------- Drive-fa szamolasa ----------
  if (be.mod === 'lista') {
    let szint: { id: string; ut: string }[] = be.gyoker;
    const szamok: Record<string, number[]> = {};
    for (let sz = 0; szint.length && sz < 10; sz++) {
      const kovetkezo: { id: string; ut: string }[] = [];
      for (let k = 0; k < szint.length; k += 8) {
        const resz = szint.slice(k, k + 8);
        const eredm = await Promise.all(resz.map((m, j) => ctx.step(`lista-${sz}-${k + j}`, async () => {
          const lista = await driveLista(m.id);
          const almappak = lista.filter((f) => f.mimeType === 'application/vnd.google-apps.folder').map((f) => ({ id: f.id, ut: `${m.ut}/${f.name}` }));
          const kep = lista.filter((f) => String(f.mimeType).startsWith('image/')).length;
          const video = lista.filter((f) => String(f.mimeType).startsWith('video/')).length;
          return { almappak, ut: m.ut, kep, video };
        })));
        for (const e of eredm) { kovetkezo.push(...e.almappak); if (e.kep || e.video) szamok[e.ut] = [e.kep, e.video]; }
      }
      szint = kovetkezo;
    }
    return { szamok };
  }

  // ---------- kepek kulon fajlokban ----------
  let fajlok: { id: string; ut: string; meret?: number }[] = be.fajlok;
  if (!fajlok && be.lista_ut) {
    fajlok = await ctx.step('read-list', async () => {
      const t = await gh('GET', `/contents/${be.lista_ut}?ref=${encodeURIComponent(be.ag)}`);
      const szoveg = new TextDecoder().decode(Uint8Array.from(atob(String(t.content).replace(/\s/g, '')), (c) => c.charCodeAt(0)));
      return JSON.parse(szoveg);
    });
  }
  const fej = await fejOlvas();
  const jelentes: any[] = [];
  const csomag = be.csomag ?? 4;
  for (let k = 0; k < fajlok.length; k += csomag) {
    const resz = fajlok.slice(k, k + csomag);
    const eredmeny = await Promise.all(resz.map((f, j) => ctx.step(`copy-file-${k + j}`, async () => {
      try {
        const meta: any = await (await sdk.fetch(`${DRIVE}/${f.id}?fields=name,mimeType,size,thumbnailLink,imageMediaMetadata(width,height)&supportsAllDrives=true`, { connection: 'drive', method: 'GET' })).json();
        if (!meta.thumbnailLink) return { ut: f.ut, hiba: 'nincs bélyegkép', forras: meta.name };
        const { adat, meret } = await kepLetolt(meta.thumbnailLink, f.meret ?? 1600);
        const blob = await gh('POST', '/git/blobs', { content: b64(adat), encoding: 'base64' });
        return { ut: f.ut, sha: blob.sha as string, bajt: adat.length, meret, forras: meta.name, tipus: meta.mimeType, eredeti: meta.imageMediaMetadata ? `${meta.imageMediaMetadata.width}x${meta.imageMediaMetadata.height}` : undefined };
      } catch (e: any) {
        return { ut: f.ut, hiba: String(e?.message ?? e).slice(0, 200) };
      }
    })));
    jelentes.push(...eredmeny);
  }
  const jok = jelentes.filter((x) => x.sha);
  if (!jok.length) return { commit: null, jelentes };
  const commitSha = await commitol(fej, jok.map((x) => ({ ut: x.ut, sha: x.sha })));
  return { commit: commitSha, atmasolt: jok.length, hibas: jelentes.filter((x) => x.hiba).length, jelentes: jelentes.filter((x) => x.hiba).map((x) => ({ ut: x.ut, hiba: x.hiba })) };
});
