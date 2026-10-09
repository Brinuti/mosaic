// Fajltarolo felulet: put(kulcs, bajtok, {mime}) / get(kulcs) / del(kulcs).
// D1-es megvalositas (base64 darabok a crm_fajl tablaban); R2-re valtaskor csak ezt a fajlt kell kicserelni (r2Tarolo).
const DARAB = 600 * 1024;   // bajt / darab (a D1 sormerete max. ~2 MB, a base64 +33%)

const b64 = (bajtok) => { let s = ''; for (let i = 0; i < bajtok.length; i += 0x8000) s += String.fromCharCode(...bajtok.subarray(i, i + 0x8000)); return btoa(s); };
const bajtokB64bol = (s) => { const b = atob(s); const ki = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) ki[i] = b.charCodeAt(i); return ki; };

export function d1Tarolo(db, { most = () => Math.floor(Date.now() / 1000) } = {}) {
  return {
    async put(kulcs, bajtok, { mime = 'application/octet-stream' } = {}) {
      const b = bajtok instanceof Uint8Array ? bajtok : new Uint8Array(bajtok);
      const allitasok = [db.prepare('DELETE FROM crm_fajl WHERE storage_key = ?').bind(kulcs)];
      for (let i = 0, seq = 0; i < b.length || seq === 0; i += DARAB, seq++) {
        allitasok.push(db.prepare('INSERT INTO crm_fajl (storage_key, seq, mime, meret, adat, letrehozva) VALUES (?, ?, ?, ?, ?, ?)')
          .bind(kulcs, seq, mime, b.length, b64(b.subarray(i, i + DARAB)), most()));
      }
      await db.batch(allitasok);
    },
    async get(kulcs) {
      const { results } = await db.prepare('SELECT mime, meret, adat FROM crm_fajl WHERE storage_key = ? ORDER BY seq').bind(kulcs).all();
      if (!results.length) return null;
      const ki = new Uint8Array(results[0].meret);
      let poz = 0;
      for (const r of results) { const d = bajtokB64bol(r.adat); ki.set(d, poz); poz += d.length; }
      return { bajtok: ki, mime: results[0].mime };
    },
    async del(kulcs) { await db.prepare('DELETE FROM crm_fajl WHERE storage_key = ?').bind(kulcs).run(); },
  };
}

/** memoria-tarolo teszthez */
export function memoriaTarolo() {
  const m = new Map();
  return {
    async put(k, b, { mime } = {}) { m.set(k, { bajtok: new Uint8Array(b), mime }); },
    async get(k) { return m.get(k) || null; },
    async del(k) { m.delete(k); },
    _m: m,
  };
}
