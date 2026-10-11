/*
 * Kepcimkezo - a futas menete: bejaras (Drive) -> osszevetes a tablazattal -> cimkezes (OpenAI) -> iras.
 * Minden kulso dolgot az "env" objektumon at er el, ezert Node-ban hamis env-vel tesztelheto.
 *
 * env:
 *   now() -> ms, nowText() -> 'YYYY-MM-DD HH:mm', sleep(ms), log(msg), hasKey() -> bool
 *   fetchAll(reqs) -> resps     req = {url, method?, body?, auth?: 'google'|'openai'|null, binary?}
 *                               resp = {code, text?, b64?, mime?}
 *   driveList(params) -> {code, data?, text?}   a Drive files.list (Apps Script: a beepitett Drive szolgaltatas)
 *   sheet: settings(), readAll(), append(rows), update(rowIndex, row), setRange(row, col0, block), log(row)
 *   props: getNumber(key), addNumber(key, delta)
 *   triggers: clearContinuation(), armContinuation(minutes)
 */

var KC = KC || {};

KC.OPENAI_URL = 'https://api.openai.com/v1/responses';

KC.LOG_HEADER = ['időpont', 'mód', 'bejárt_fájl', 'új_egyedi', 'címkézett', 'nincs_előnézet', 'hiba',
  'költség_futás_usd', 'költség_hó_usd', 'megállás_oka', 'hátralévő', 'időtartam_mp', 'megjegyzés'];

// ---------- HTTP ujraprobalassal ----------

KC.retryable = function (r) {
  if (!r) return true;
  var c = r.code;
  if (c === 0 || c === 429 || c >= 500) return true;
  return c === 403 && /ratelimit|rate limit/i.test(r.text || '');
};

// Parhuzamosan lekeri a keresek, a atmeneti hibakat (429/5xx/0) ujraprobalja. A valaszok a keresek sorrendjeben jonnek.
KC.fetchRetry = function (env, reqs, tries) {
  tries = tries || 4;
  var out = new Array(reqs.length);
  var pending = reqs.map(function (_, i) { return i; });
  for (var a = 0; a < tries && pending.length; a++) {
    if (a > 0) env.sleep(Math.min(20000, 1500 * Math.pow(2, a)));
    var resps = env.fetchAll(pending.map(function (i) { return reqs[i]; }));
    var next = [];
    pending.forEach(function (i, k) {
      out[i] = resps[k];
      if (KC.retryable(resps[k])) next.push(i);
    });
    pending = next;
  }
  return out;
};

// TÖBB Drive-lista hivas egyszerre (ha az env tud parhuzamosan), az atmeneti hibakat egyesevel ujraprobalja.
KC.listMany = function (env, paramsList) {
  var res = env.driveListMany
    ? env.driveListMany(paramsList)
    : paramsList.map(function (p) { return env.driveList(p); });
  return res.map(function (r, i) { return KC.retryable(r) ? KC.listRetry(env, paramsList[i], 4) : r; });
};

// A Drive-lista egy hivasa ujraprobalassal (atmeneti hibakra: 429 / 5xx / sebessegkorlat).
KC.listRetry = function (env, params, tries) {
  tries = tries || 5;
  var r = null;
  for (var a = 0; a < tries; a++) {
    if (a > 0) env.sleep(Math.min(20000, 1000 * Math.pow(2, a)));
    r = env.driveList(params);
    if (!KC.retryable(r)) return r;
  }
  return r;
};

// ---------- 1. Bejaras ----------

// Vegigjarja a forrasmappakat. MINDEN mappa kulon lekerdezes: a "tobb szulo egyszerre" (a or b in parents)
// kereses megosztott mappaknal csendben kihagy elemeket (igy esett ki a Medical Piercing).
// deadlineMs: ha eddig nem er veget, megszakad (aborted = true). -> { files, folders, excluded, errors, aborted }
KC.scan = function (env, deadlineMs) {
  var cfg = KC.CFG;
  var folderInfo = {}, units = [], files = [], seenFile = {}, excluded = [], errors = [], aborted = false;

  cfg.ROOTS.forEach(function (r) {
    folderInfo[r.id] = { path: r.label, fiok: r.fiok, only: r.only || null };
    units.push({ parent: r.id, pageToken: null });
  });

  var guard = 0;
  while (units.length && guard++ < 100000) {
    if (deadlineMs && env.now() > deadlineMs) { aborted = true; break; }
    var round = units.splice(0, cfg.LIST_PARALLEL);
    var results = KC.listMany(env, round.map(function (u) { return KC.listParams([u.parent], u.pageToken); }));
    round.forEach(function (u, k) {
      var r = results[k];
      var data = r && r.code === 200 ? r.data : null;
      if (!data) { errors.push('lista_' + (r ? r.code : 'ures') + (r && r.text ? ': ' + String(r.text).slice(0, 160) : '')); return; }

      (data.files || []).forEach(function (f) {
        var pid = (f.parents || []).filter(function (p) { return folderInfo[p]; })[0];
        if (!pid) return;
        var par = folderInfo[pid];
        if (f.mimeType === 'application/vnd.google-apps.folder') {
          if (folderInfo[f.id]) return;
          if (KC.isExcludedFolder(f.name)) { excluded.push(par.path + '/' + f.name); return; }
          var fiok = par.fiok;
          if (par.only) {
            var want = par.only[KC.norm(f.name)];
            if (!want) return;          // a gyokerben csak a felsorolt almappak tartoznak ide
            fiok = want;
          }
          folderInfo[f.id] = { path: par.path + '/' + f.name, fiok: fiok, only: null };
          units.push({ parent: f.id, pageToken: null });
        } else if (KC.isMedia(f.mimeType)) {
          if (par.only || seenFile[f.id]) return;   // a gyoker kozvetlen fajljai kimaradnak
          seenFile[f.id] = true;
          var meta = f.imageMediaMetadata || f.videoMediaMetadata || {};
          files.push({
            id: f.id, name: f.name || '', path: par.path, fiok: par.fiok, mime: f.mimeType,
            md5: f.md5Checksum || '', modified: f.modifiedTime || '',
            w: meta.width == null ? null : meta.width, h: meta.height == null ? null : meta.height,
            durMs: f.videoMediaMetadata && f.videoMediaMetadata.durationMillis,
            thumb: f.thumbnailLink || ''
          });
        }
      });
      if (data.nextPageToken) units.push({ parent: u.parent, pageToken: data.nextPageToken });
    });
  }

  files.sort(function (a, b) {
    var x = a.path + '\u0000' + a.name + '\u0000' + a.id, y = b.path + '\u0000' + b.name + '\u0000' + b.id;
    return x < y ? -1 : (x > y ? 1 : 0);
  });
  return { files: files, folders: Object.keys(folderInfo).length, excluded: excluded, errors: errors, aborted: aborted };
};

// ---------- 2. Osszevetes ----------

// A tablazatban tarolt idobelyeg (szoveg vagy Date) -> ms; ismeretlen -> NaN
KC.stampMs = function (v) {
  if (v && typeof v.getTime === 'function') return v.getTime();
  var s = String(v || '').trim();
  if (!s) return NaN;
  return new Date(s.replace(' ', 'T')).getTime();
};

KC.staleEnough = function (stamp, nowMs) {
  var t = KC.stampMs(stamp);
  return isNaN(t) || nowMs - t >= KC.CFG.RETRY_AFTER_HOURS * 3600 * 1000;
};

// files: a bejaras eredmenye; rows: a tablazat sorai (KC.parseRow). -> { todo, stats }
// A "todo" elemei: { file, row|null, kind: 'uj'|'valtozott'|'ujra' }
KC.plan = function (files, rows, nowMs) {
  var cfg = KC.CFG, S = KC.STATUS;
  var byId = {}, byMd5 = {};
  rows.forEach(function (r) { byId[r.id] = r; if (r.md5 && !byMd5[r.md5]) byMd5[r.md5] = r; });
  var cnt = {};
  files.forEach(function (f) { if (f.md5) cnt[f.md5] = (cnt[f.md5] || 0) + 1; });

  var fresh = [], changed = [], retry = [], newSeen = {};
  var stats = { scanned: files.length, upToDate: 0, fresh: 0, changed: 0, retry: 0, dupSkipped: 0, metaDirty: 0, copiesDirty: 0 };

  files.forEach(function (f) {
    f.copies = f.md5 ? cnt[f.md5] - 1 : 0;
    var row = byId[f.id];
    if (row) {
      if (row.md5 === f.md5) {
        if (row.name !== f.name || row.path !== f.path || row.fiok !== f.fiok) {
          row.name = f.name; row.path = f.path; row.fiok = f.fiok; row.metaDirty = true; stats.metaDirty++;
        }
        if (row.copies !== f.copies) { row.copiesNew = f.copies; stats.copiesDirty++; }
        if ((row.status === S.NO_THUMB || row.status === S.ERROR) && row.attempts < cfg.MAX_ATTEMPTS && KC.staleEnough(row.stamp, nowMs)) {
          retry.push({ file: f, row: row, kind: 'ujra' }); stats.retry++;
        } else {
          stats.upToDate++;
        }
        return;
      }
      changed.push({ file: f, row: row, kind: 'valtozott' }); stats.changed++;
      return;
    }
    if (f.md5 && (byMd5[f.md5] || newSeen[f.md5])) { stats.dupSkipped++; return; }
    if (f.md5) newSeen[f.md5] = true;
    fresh.push({ file: f, row: null, kind: 'uj' }); stats.fresh++;
  });

  return { todo: fresh.concat(changed, retry), stats: stats };
};

// A masolat-szam / athelyezes miatti modositasokat egyben visszaírja a tablazatba.
KC.applyRowUpdates = function (env, values, rows) {
  var C = KC.COL;
  function block(dirty, c0, n, pick) {
    var map = {};
    dirty.forEach(function (r) { map[r.rowIndex] = r; });
    var out = [];
    for (var i = 1; i < values.length; i++) {
      var r = map[i + 1];
      out.push(r ? pick(r) : values[i].slice(c0, c0 + n));
    }
    return out;
  }
  var meta = rows.filter(function (r) { return r.metaDirty; });
  if (meta.length) {
    env.sheet.setRange(2, C['név'], block(meta, C['név'], 3, function (r) { return [r.name, r.path, r.fiok]; }));
  }
  var cp = rows.filter(function (r) { return r.copiesNew != null && r.copiesNew !== r.copies; });
  if (cp.length) {
    env.sheet.setRange(2, C['másolatok'], block(cp, C['másolatok'], 1, function (r) { return [r.copiesNew]; }));
  }
  return { meta: meta.length, copies: cp.length };
};

// ---------- 3. Cimkezes ----------

// OpenAI-hivasok a kotegekre (egyszerre PARALLEL db). Hiba / hianyzo elem eseten a koteget felezi.
// Beallitja: entry.item (siker) vagy entry.fail (vegleges hiba); ctx.cost, ctx.fatal.
KC.callOpenAI = function (env, batches, ctx) {
  var cfg = KC.CFG, pending = batches.slice(), guard = 0;
  while (pending.length && !ctx.fatal && guard++ < 200) {
    var round = pending.splice(0, cfg.PARALLEL);
    var reqs = round.map(function (b) {
      return {
        url: KC.OPENAI_URL, method: 'post', auth: 'openai',
        body: JSON.stringify(KC.buildOpenAIBody(b.map(function (e) { return e.file; }), b.map(function (e) { return e.thumbData; })))
      };
    });
    var resps = KC.fetchRetry(env, reqs, 4);
    round.forEach(function (b, k) {
      var p = KC.parseOpenAI(resps[k]);
      if (p.usage) { var c = KC.costUsd(p.usage); ctx.cost += c; ctx.calls++; }
      if (p.fatal) { ctx.fatal = p.error; b.forEach(function (e) { e.fail = p.error; }); return; }
      var missing = b;
      if (p.ok) {
        var matched = KC.matchItems(b.length, p.items);
        missing = [];
        b.forEach(function (e, idx) { if (matched[idx]) e.item = matched[idx]; else missing.push(e); });
        if (!missing.length) return;
      }
      if (missing.length > 1) {
        if (missing.length === b.length) {
          var h = Math.ceil(b.length / 2);
          pending.push(b.slice(0, h), b.slice(h));
        } else {
          pending.push(missing);
        }
      } else {
        missing[0].fail = p.ok ? 'hianyzo_elem' : p.error;
      }
    });
  }
  // ha a hatarok miatt kimaradt valami
  pending.forEach(function (b) { b.forEach(function (e) { if (!e.item) e.fail = e.fail || 'megszakitva'; }); });
};

// Egy csoport (BATCH*PARALLEL fajl): elonezetek letoltese, OpenAI, sorok osszerakasa.
// -> { rows: [{ entry, row, status }], ctx }
KC.processGroup = function (env, group, ctx) {
  var cfg = KC.CFG, S = KC.STATUS;

  // elonezetek (hitelesitve; ha nem megy, hitelesites nelkul meg egyszer)
  var withLink = group.filter(function (e) { return e.file.thumb; });
  if (withLink.length) {
    var reqs = withLink.map(function (e) { return { url: KC.thumbUrl(e.file.thumb, cfg.THUMB_PX), auth: 'google', binary: true }; });
    var resps = KC.fetchRetry(env, reqs, 3);
    var redo = [];
    resps.forEach(function (r, i) { if (!r || r.code !== 200 || !r.b64) redo.push(i); });
    if (redo.length) {
      var r2 = KC.fetchRetry(env, redo.map(function (i) { return { url: reqs[i].url, auth: null, binary: true }; }), 2);
      redo.forEach(function (i, k) { resps[i] = r2[k]; });
    }
    withLink.forEach(function (e, i) {
      var r = resps[i];
      if (r && r.code === 200 && r.b64) e.thumbData = { mime: r.mime || 'image/jpeg', b64: r.b64 };
    });
  }

  var ready = group.filter(function (e) { return e.thumbData; });
  var batches = [];
  for (var i = 0; i < ready.length; i += cfg.BATCH) batches.push(ready.slice(i, i + cfg.BATCH));
  if (batches.length) KC.callOpenAI(env, batches, ctx);

  var nowText = env.nowText();
  var rows = group.map(function (e) {
    var status = !e.thumbData ? S.NO_THUMB : (e.item ? S.OK : S.ERROR);
    return { entry: e, status: status, row: KC.buildRow(e.file, status === S.OK ? e.item : null, status, nowText, e.row) };
  });
  return { rows: rows };
};

// ---------- 4. Teljes futas ----------

// mode: 'proba' (kis minta, barmikor) | 'napi' (csak ha a "beállítások" lapon ELESITVE = igen)
KC.run = function (env, mode) {
  var cfg = KC.CFG, S = KC.STATUS, t0 = env.now();
  var summary = { mode: mode, scanned: 0, fresh: 0, labeled: 0, noThumb: 0, errors: 0, cost: 0, monthCost: 0, stop: '', remaining: 0, note: '' };

  env.sheet.ensure && env.sheet.ensure();
  env.triggers.clearContinuation();
  var st = KC.settingsFrom(env.sheet.settings());

  function finish(note) {
    summary.note = note || summary.note;
    summary.seconds = Math.round((env.now() - t0) / 1000);
    env.sheet.log([env.nowText(), mode, summary.scanned, summary.fresh, summary.labeled, summary.noThumb, summary.errors,
      Math.round(summary.cost * 10000) / 10000, Math.round(summary.monthCost * 10000) / 10000,
      summary.stop, summary.remaining, summary.seconds, summary.note]);
    env.log(JSON.stringify(summary));
    return summary;
  }

  if (st.leallitas) { summary.stop = 'leallitas'; return finish('LEALLITAS = igen'); }
  if (mode === 'napi' && !st.elesitve) { summary.stop = 'nincs_elesitve'; return finish('ELESITVE != igen: csak a proba() fut'); }
  if (!env.hasKey()) { summary.stop = 'nincs_kulcs'; return finish('Hiányzik az OPENAI_API_KEY (Script Properties)'); }

  var deadline = t0 + st.idokeretPerc * 60 * 1000;
  var monthKey = KC.monthKey(new Date(env.now()));
  var spentBefore = env.props.getNumber(monthKey);
  summary.monthCost = spentBefore;
  var limit = st.haviKeret * cfg.STOP_AT_FRACTION;
  if (spentBefore >= limit) { summary.stop = 'koltseg'; return finish('A havi keret ' + Math.round(cfg.STOP_AT_FRACTION * 100) + '%-a elfogyott'); }

  // 1) bejaras
  var sc = KC.scan(env, t0 + st.idokeretPerc * 60 * 1000 * cfg.SCAN_MAX_FRACTION);
  summary.scanned = sc.files.length;
  if (sc.aborted) {
    summary.stop = 'scan_ido';
    return finish('A mappa-bejaras nem fert bele az idokeretbe (' + sc.folders + ' mappa). Noveld az IDOKERET_PERC-et (Workspace: max 30).');
  }
  var notes = ['mappa: ' + sc.folders];
  if (sc.excluded.length) notes.push('kihagyott mappa: ' + sc.excluded.length);
  if (sc.errors.length) notes.push('lista-hiba: ' + sc.errors.length + ' (elso: ' + sc.errors[0] + ')');
  if (!sc.files.length && sc.errors.length) { summary.stop = 'lista_hiba'; return finish(notes.join('; ')); }

  // 2) osszevetes
  var values = env.sheet.readAll();
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var pr = KC.parseRow(values[i], i + 1);
    if (pr.id) rows.push(pr);
  }
  var pl = KC.plan(sc.files, rows, env.now());
  var upd = KC.applyRowUpdates(env, values, rows);
  if (upd.meta || upd.copies) notes.push('frissitve: nev/utvonal ' + upd.meta + ', masolat ' + upd.copies);
  notes.push('duplikatum kihagyva: ' + pl.stats.dupSkipped);

  var todo = pl.todo;
  summary.fresh = pl.stats.fresh;
  if (mode === 'proba') {
    if (st.probaIds.length) {
      var wanted = {};
      st.probaIds.forEach(function (id) { wanted[id] = true; });
      todo = todo.filter(function (e) { return wanted[e.file.id]; });
      notes.push('proba: ' + todo.length + ' / ' + st.probaIds.length + ' megadott fajl');
    } else {
      todo = KC.pickSample(todo.filter(function (e) { return e.kind === 'uj'; }), cfg.PROBA_DB);
    }
  } else if (st.maxFajl > 0) {
    todo = todo.slice(0, st.maxFajl);
  }

  // biztonsagi folytatas: ha ez a futas megszakadna, ez ujraindit
  if (mode === 'napi' && todo.length) env.triggers.armContinuation(Math.ceil(st.idokeretPerc) + 4);

  // 3) cimkezes csoportonkent
  var ctx = { cost: 0, calls: 0, fatal: '' };
  var step = cfg.BATCH * cfg.PARALLEL, done = 0;
  for (var pos = 0; pos < todo.length; pos += step) {
    if (env.now() + cfg.GROUP_SAFETY_SEC * 1000 > deadline) { summary.stop = 'ido'; break; }
    if (spentBefore + ctx.cost >= limit) { summary.stop = 'koltseg'; break; }

    var group = todo.slice(pos, pos + step);
    var before = ctx.cost;
    var res = KC.processGroup(env, group, ctx);
    var appendRows = [];
    res.rows.forEach(function (x) {
      if (x.status === S.OK) summary.labeled++;
      else if (x.status === S.NO_THUMB) summary.noThumb++;
      else summary.errors++;
      if (x.entry.row) env.sheet.update(x.entry.row.rowIndex, x.row);
      else appendRows.push(x.row);
    });
    if (appendRows.length) env.sheet.append(appendRows);
    env.props.addNumber(monthKey, ctx.cost - before);
    done += group.length;
    if (ctx.fatal) { summary.stop = 'openai_' + ctx.fatal; break; }
  }
  summary.cost = ctx.cost;
  summary.monthCost = spentBefore + ctx.cost;
  summary.remaining = Math.max(0, pl.todo.length - done);
  if (!summary.stop && mode === 'napi' && st.maxFajl > 0 && pl.todo.length > todo.length) summary.stop = 'limit';
  if (!summary.stop && mode === 'proba') summary.stop = 'proba_kesz';

  // 4) folytatas
  env.triggers.clearContinuation();
  if (mode === 'napi' && summary.stop === 'ido') env.triggers.armContinuation(cfg.CONTINUE_AFTER_MIN);
  if (mode === 'napi' && !summary.stop && !summary.remaining) summary.stop = 'kesz';

  return finish(notes.join('; '));
};
