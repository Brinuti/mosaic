/*
 * Kepcimkezo - tiszta (platformfuggetlen) segedfuggvenyek. Nincs benne Apps Script szolgaltatas,
 * ezert Node-ban is tesztelheto (tools/kepcimkezo/test).
 */

var KC = KC || {};

// A kimeneti tablazat oszlopai. A megrendelt oszlopok sorrendje (+ a "szoveg" a "felirat" utan, az elemzo kerese);
// utana a technikai oszlopok.
KC.COLS = [
  'file_id', 'név', 'mappa_útvonal', 'fiók', 'mime', 'szélesség', 'magasság',
  'üzletág', 'téma', 'felirat', 'szoveg', 'nyersíthető', 'arc', 'minőség', 'leírás', 'címkézés_dátuma',
  'md5', 'drive_módosítva', 'állapot', 'másolatok', 'próbálkozás', 'videó_hossz_mp'
];
KC.COL = {};
KC.COLS.forEach(function (n, i) { KC.COL[n] = i; });

// A JSON-sema kulcsa -> tablazat-oszlop
KC.TAG_KEYS = {
  uzletag: 'üzletág', tema: 'téma', felirat: 'felirat', szoveg: 'szoveg',
  nyersitheto: 'nyersíthető', arc: 'arc', minoseg: 'minőség', leiras: 'leírás'
};

KC.STATUS = { OK: 'kész', NO_THUMB: 'nincs_előnézet', ERROR: 'hiba' };

KC.norm = function (s) {
  return String(s == null ? '' : s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
};

KC.isExcludedFolder = function (name) {
  var n = KC.norm(name);
  return KC.CFG.EXCLUDE_FOLDER_PARTS.some(function (p) { return n.indexOf(p) >= 0; });
};

KC.isMedia = function (mime) { return /^(image|video)\//.test(mime || ''); };
KC.isVideo = function (mime) { return /^video\//.test(mime || ''); };

// ---------- Drive ----------

KC.LIST_FIELDS = 'nextPageToken,files(id,name,mimeType,md5Checksum,modifiedTime,parents,thumbnailLink,' +
  'imageMediaMetadata(width,height),videoMediaMetadata(width,height,durationMillis))';

// A Drive "files.list" parameterei. FIGYELEM: egyszerre csak EGY szulo (lasd KC.scan); tobb szulo esetén a Drive
// megosztott mappaknal csendben kihagy elemeket.
KC.listParams = function (parents, pageToken) {
  var q = 'trashed=false and (' +
    parents.map(function (p) { return "'" + p + "' in parents"; }).join(' or ') +
    ") and (mimeType='application/vnd.google-apps.folder' or mimeType contains 'image/' or mimeType contains 'video/')";
  var params = {
    q: q, fields: KC.LIST_FIELDS, pageSize: 1000,
    supportsAllDrives: true, includeItemsFromAllDrives: true
  };
  if (pageToken) params.pageToken = pageToken;
  return params;
};

KC.thumbUrl = function (link, px) {
  return String(link).replace(/=[sw]\d+(-[a-z0-9-]+)?$/i, '') + '=s' + px;
};

// ---------- OpenAI ----------

KC.buildOpenAIBody = function (batch, thumbs) {
  var cfg = KC.CFG;
  var content = [{ type: 'input_text', text: KC.PROMPT }];
  batch.forEach(function (f, k) {
    content.push({
      type: 'input_text',
      text: '#' + k + ' mappa: ' + f.path + (KC.isVideo(f.mime) ? ' (VIDEÓ előnézeti kocka)' : '')
    });
    content.push({
      type: 'input_image',
      image_url: 'data:' + thumbs[k].mime + ';base64,' + thumbs[k].b64,
      detail: cfg.DETAIL
    });
  });
  var body = {
    model: cfg.MODEL,
    input: [{ role: 'user', content: content }],
    text: { format: { type: 'json_schema', name: 'cat', schema: KC.SCHEMA, strict: true } },
    store: false,
    max_output_tokens: cfg.MAX_OUT_TOKENS_PER_IMAGE * batch.length + 200
  };
  if (cfg.REASONING) body.reasoning = { effort: cfg.REASONING };
  return body;
};

// A Responses API valaszabol kinyeri a modell JSON-szoveget.
KC.extractText = function (resp) {
  if (resp && typeof resp.output_text === 'string' && resp.output_text) return resp.output_text;
  var out = (resp && resp.output) || [];
  var txt = '';
  out.forEach(function (it) {
    (it.content || []).forEach(function (c) {
      if (c.type === 'output_text' && typeof c.text === 'string') txt += c.text;
    });
  });
  return txt;
};

// Feldolgozza az OpenAI HTTP-valaszt. -> { ok, items, usage, error, retryable }
KC.parseOpenAI = function (r) {
  if (!r || r.code !== 200) {
    var t = (r && r.text) || '';
    var quota = /insufficient_quota|billing_hard_limit|exceeded your current quota/i.test(t);
    return { ok: false, error: 'http_' + (r ? r.code : 'ures') + (quota ? '_kvota' : ''), fatal: quota || (r && (r.code === 401 || r.code === 403)), text: t.slice(0, 300) };
  }
  var j;
  try { j = JSON.parse(r.text); } catch (e) { return { ok: false, error: 'valasz_nem_json' }; }
  var usage = j.usage || {};
  if (j.status && j.status !== 'completed') return { ok: false, error: 'status_' + j.status, usage: usage };
  var txt = KC.extractText(j);
  if (!txt) return { ok: false, error: 'ures_valasz', usage: usage };
  var parsed;
  try { parsed = JSON.parse(txt); } catch (e2) { return { ok: false, error: 'tartalom_nem_json', usage: usage }; }
  var items = Array.isArray(parsed) ? parsed : (parsed && parsed.items);
  if (!Array.isArray(items)) return { ok: false, error: 'nincs_items', usage: usage };
  return { ok: true, items: items, usage: usage };
};

// A modell elemeit a kotegben levo kepekhez rendeli (az "i" mezo = a #k sorszam). -> tomb (hossz = n), hianyzo = null
KC.matchItems = function (n, items) {
  var out = [];
  for (var k = 0; k < n; k++) out.push(null);
  var withoutIndex = [];
  items.forEach(function (it) {
    var idx = it && (it.i != null ? it.i : (it.index != null ? it.index : it.sorszam));
    var num = typeof idx === 'string' && idx.trim() !== '' ? Number(idx) : idx;
    if (typeof num === 'number' && isFinite(num) && num % 1 === 0 && num >= 0 && num < n && !out[num]) out[num] = it;
    else if (idx == null) withoutIndex.push(it);
  });
  // ha egyik elemnek sincs sorszama, de annyi elem van, ahany kep: sorrend szerint
  if (withoutIndex.length === n && out.every(function (x) { return !x; })) return withoutIndex.slice();
  return out;
};

KC.costUsd = function (usage) {
  usage = usage || {};
  return ((usage.input_tokens || 0) * KC.CFG.PRICE_IN_PER_M + (usage.output_tokens || 0) * KC.CFG.PRICE_OUT_PER_M) / 1e6;
};

// ---------- Tablazat-sorok ----------

KC.emptyRow = function () {
  var r = [];
  for (var i = 0; i < KC.COLS.length; i++) r.push('');
  return r;
};

// f: a bejarasbol jovo fajl; item: a modell sora (vagy null); status: KC.STATUS.*; prev: elozo sor-objektum (ujracimkezeshez);
// reason: a hiba oka (csak nem sikeres sornal) - a "leiras" oszlopba kerul "HIBA: ..." elotaggal
KC.buildRow = function (f, item, status, nowText, prev, reason) {
  var r = KC.emptyRow(), C = KC.COL;
  r[C['file_id']] = f.id;
  r[C['név']] = f.name;
  r[C['mappa_útvonal']] = f.path;
  r[C['fiók']] = f.fiok;
  r[C['mime']] = f.mime;
  r[C['szélesség']] = f.w == null ? '' : f.w;
  r[C['magasság']] = f.h == null ? '' : f.h;
  r[C['címkézés_dátuma']] = nowText;
  r[C['md5']] = f.md5 || '';
  r[C['drive_módosítva']] = f.modified || '';
  r[C['állapot']] = status;
  r[C['másolatok']] = f.copies || 0;
  r[C['videó_hossz_mp']] = f.durMs ? Math.round(Number(f.durMs) / 1000) : '';
  var failed = status !== KC.STATUS.OK;
  var sameContent = prev && prev.md5 === (f.md5 || '');
  r[C['próbálkozás']] = failed ? ((sameContent ? prev.attempts : 0) + 1) : 0;
  if (item) {
    Object.keys(KC.TAG_KEYS).forEach(function (k) {
      var v = item[k];
      r[C[KC.TAG_KEYS[k]]] = v == null ? '' : v;
    });
    // Szabaly (az elemzo kerese, 2026-10-11): a Medical Piercing fiok minden fajlja piercing, a modell valaszatol fuggetlenul.
    if (f.fiok === 'MP') r[C['üzletág']] = 'piercing';
    // Szabaly (elemzo, 2026-10-11): kep (nem video) + felirat = sok -> hirdetes-szeru grafika: tema = kesz_kreativ_grafika.
    // A "nyersitheto" mezot NEM irjuk felul. (A video-elonezeti kockak - pl. feliratos testimonial - valtozatlanok.)
    if (/^image\//.test(f.mime || '') && String(r[C['felirat']]) === 'sok') r[C['téma']] = 'kesz_kreativ_grafika';
  }
  if (failed && reason) r[C['leírás']] = 'HIBA: ' + String(reason).slice(0, 240);
  return r;
};

// A tablazat egy sorat (tomb) objektumma alakitja.
KC.parseRow = function (arr, rowIndex) {
  var C = KC.COL;
  return {
    rowIndex: rowIndex,
    id: String(arr[C['file_id']] || ''),
    name: String(arr[C['név']] || ''),
    path: String(arr[C['mappa_útvonal']] || ''),
    fiok: String(arr[C['fiók']] || ''),
    md5: String(arr[C['md5']] || ''),
    status: String(arr[C['állapot']] || ''),
    copies: Number(arr[C['másolatok']] || 0),
    attempts: Number(arr[C['próbálkozás']] || 0),
    stamp: arr[C['címkézés_dátuma']],
    tags: {
      uzletag: arr[C['üzletág']], tema: arr[C['téma']], felirat: arr[C['felirat']], szoveg: arr[C['szoveg']],
      nyersitheto: arr[C['nyersíthető']], arc: arr[C['arc']], minoseg: arr[C['minőség']], leiras: arr[C['leírás']]
    }
  };
};

// Egyenletesen szort mintat valaszt (a "proba" futashoz).
KC.pickSample = function (list, n) {
  if (list.length <= n) return list.slice();
  var out = [];
  for (var i = 0; i < n; i++) out.push(list[Math.floor(i * list.length / n)]);
  return out;
};

KC.monthKey = function (d) {
  return 'KOLTSEG_' + d.getFullYear() + '_' + ('0' + (d.getMonth() + 1)).slice(-2);
};

// A "beállítások" lap ertekei + alapertekek.
KC.settingsFrom = function (kv) {
  kv = kv || {};
  var cfg = KC.CFG;
  function num(v, d) {
    var s = String(v == null ? '' : v).replace(',', '.').trim();
    var n = Number(s);
    return s !== '' && isFinite(n) ? n : d;
  }
  return {
    elesitve: KC.norm(kv.ELESITVE) === 'igen',
    leallitas: KC.norm(kv.LEALLITAS) === 'igen',
    idokeretPerc: num(kv.IDOKERET_PERC, cfg.TIME_BUDGET_MIN),
    maxFajl: num(kv.MAX_FAJL, 0),
    probaIds: String(kv.PROBA_ID_LISTA == null ? '' : kv.PROBA_ID_LISTA).split(/[\s,;]+/).filter(function (x) { return x; }),
    haviKeret: num(kv.HAVI_KERET_USD, cfg.MONTHLY_BUDGET_USD)
  };
};

KC.defaultSettings = function () {
  return [
  ['ELESITVE', 'nem', 'igen = a napi futas teljes (az osszes fajl); nem = csak a proba() fut'],
  ['LEALLITAS', 'nem', 'igen = minden futas azonnal kilep (vesz-fek)'],
  ['IDOKERET_PERC', String(KC.CFG.TIME_BUDGET_MIN), 'egy futas legfeljebb ennyi percig dolgozik (Workspace: max 30, privat gmail: max 6)'],
  ['MAX_FAJL', '', 'ures = nincs korlat; szam = egy futas legfeljebb ennyi uj fajlt cimkez'],
  ['PROBA_ID_LISTA', '', 'ures = a proba() egyenletesen szort mintat vesz; file_id-k vesszovel = a proba() pontosan ezeket cimkezi'],
  ['HAVI_KERET_USD', String(KC.CFG.MONTHLY_BUDGET_USD), 'havi OpenAI-keret (USD); 90%-nal a szkript megall']
];
};
