/*
 * Kepcimkezo - Google Apps Script illesztes (a Drive / Sheets / UrlFetch / Trigger szolgaltatasok).
 * A teljes logika a KC.run-ban van (20_pipeline.js); ez a fajl csak az "env"-et epiti fel, es az inditopontokat adja.
 *
 * Inditopontok (a szerkeszto "Futtatás" menujebol):
 *   setup()       - elso beallitas: lapok + napi inditas + kulcs-ellenorzes + 16 fajlos proba
 *   proba()       - kis minta (16 fajl) - barmikor futtathato
 *   napiFutas()   - a napi inditas (csak ha a "beállítások" lapon ELESITVE = igen)
 *   allapot()     - osszesito a naplo lapra
 *   leallitas()   - minden idozito torlese
 */

function kc_mime_(resp) {
  var h = resp.getHeaders() || {}, ct = '';
  Object.keys(h).forEach(function (k) { if (k.toLowerCase() === 'content-type') ct = String(h[k]); });
  ct = ct.split(';')[0].trim().toLowerCase();
  return /^image\/(jpeg|png|webp|gif)$/.test(ct) ? ct : 'image/jpeg';
}

function kc_buildOne_(r, props, token) {
  var headers = {};
  if (r.auth === 'google') headers['Authorization'] = 'Bearer ' + token();
  else if (r.auth === 'openai') headers['Authorization'] = 'Bearer ' + props.getProperty('OPENAI_API_KEY');
  var o = { url: r.url, method: r.method || 'get', headers: headers, muteHttpExceptions: true, followRedirects: true };
  if (r.body != null) { o.payload = r.body; o.contentType = 'application/json'; }
  return o;
}

// A Drive files.list REST-keresének felepitese (parhuzamos lekereshez)
function kc_listReq_(params, token) {
  var qs = Object.keys(params).map(function (k) { return k + '=' + encodeURIComponent(params[k]); }).join('&');
  return { url: 'https://www.googleapis.com/drive/v3/files?' + qs, method: 'get', headers: { Authorization: 'Bearer ' + token() }, muteHttpExceptions: true };
}

function kc_toResult_(x, binary) {
  var code = x.getResponseCode(), res = { code: code };
  if (binary && code === 200) { res.b64 = Utilities.base64Encode(x.getContent()); res.mime = kc_mime_(x); }
  else res.text = x.getContentText();
  return res;
}

function kc_env_() {
  var props = PropertiesService.getScriptProperties();
  var ss = SpreadsheetApp.openById(KC.CFG.SHEET_ID);
  var tz = Session.getScriptTimeZone() || 'Europe/Budapest';
  var N = KC.COLS.length;
  var _token = null;
  function token() { if (!_token) _token = ScriptApp.getOAuthToken(); return _token; }

  function tab(name) { return ss.getSheetByName(name) || ss.insertSheet(name); }
  function mainSheet() {
    var sh = ss.getSheetByName(KC.CFG.SHEET_NAME);
    if (sh) return sh;
    var first = ss.getSheets()[0];
    if (ss.getSheets().length === 1 && first.getLastRow() === 0) { first.setName(KC.CFG.SHEET_NAME); return first; }
    return ss.insertSheet(KC.CFG.SHEET_NAME, 0);
  }
  function grow(sh, needRows) {
    if (needRows > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), needRows - sh.getMaxRows() + 2000);
  }

  return {
    now: function () { return Date.now(); },
    nowText: function () { return Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm'); },
    sleep: function (ms) { Utilities.sleep(ms); },
    log: function (m) { console.log(m); },
    hasKey: function () { return !!props.getProperty('OPENAI_API_KEY'); },

    // Drive files.list: a beepitett "Drive" (v3) szolgaltatas. A kozvetlen REST-hivashoz (UrlFetchApp) az Apps Script
    // alapertelmezett Cloud-projektjeben a Drive API nincs bekapcsolva, a beepitett szolgaltatas ezt maga intezi.
    driveList: function (params) {
      try {
        return { code: 200, data: Drive.Files.list(params) };
      } catch (e) {
        var m = String((e && e.message) || e);
        var code = /rate limit|ratelimit|quota|too many/i.test(m) ? 429
          : (/backend error|internal error|timed? ?out|unavailable|try again/i.test(m) ? 503 : (/not found/i.test(m) ? 404 : 403));
        return { code: code, text: m.slice(0, 300) };
      }
    },

    // Tobb mappa-lista PARHUZAMOSAN (REST, UrlFetchApp.fetchAll). Ha a Drive REST ebben a projektben nincs bekapcsolva
    // (403 "has not been used ... or it is disabled"), megjegyzi (DRIVE_REST = off) es sorban, a beepitett szolgaltatassal megy.
    driveListMany: function (paramsList) {
      var self = this;
      if (paramsList.length > 1 && props.getProperty('DRIVE_REST') !== 'off') {
        try {
          var rs = UrlFetchApp.fetchAll(paramsList.map(function (p) { return kc_listReq_(p, token); }));
          var results = rs.map(function (x) {
            var code = x.getResponseCode(), text = x.getContentText();
            if (code === 200) { try { return { code: 200, data: JSON.parse(text) }; } catch (e) { return { code: 0, text: 'json' }; } }
            return { code: code, text: text.slice(0, 300) };
          });
          var disabled = results.every(function (r) {
            return r.code === 403 && /has not been used|accessNotConfigured|SERVICE_DISABLED|is disabled/i.test(r.text || '');
          });
          if (!disabled) return results;
          props.setProperty('DRIVE_REST', 'off');
          console.log('A Drive REST nem elerheto ebben a projektben: a beepitett Drive szolgaltatassal megyek, sorban.');
        } catch (e) { console.log('fetchAll hiba, sorban folytatom: ' + e); }
      }
      return paramsList.map(function (p) { return self.driveList(p); });
    },

    fetchAll: function (reqs) {
      var built = reqs.map(function (r) { return kc_buildOne_(r, props, token); });
      var out;
      try {
        var rs = UrlFetchApp.fetchAll(built);
        out = rs.map(function (x, i) { return kc_toResult_(x, reqs[i].binary); });
      } catch (e) {
        // ha a parhuzamos hivas elbukik (pl. idotullepes), egyesevel probaljuk
        out = built.map(function (b, i) {
          try { return kc_toResult_(UrlFetchApp.fetch(b.url, b), reqs[i].binary); }
          catch (e2) { return { code: 0, text: String(e2).slice(0, 200) }; }
        });
      }
      return out;
    },

    sheet: {
      ensure: function () {
        var sh = mainSheet();
        var hdr = sh.getRange(1, 1, 1, N).getValues()[0];
        var same = KC.COLS.every(function (c, i) { return String(hdr[i]) === c; });
        if (!same) {
          if (sh.getLastRow() > 1) {
            throw new Error('A "' + KC.CFG.SHEET_NAME + '" lap fejlece eltér a vártól, de a lap nem üres. Mentsd el és told ki az adatsorokat, vagy migráld a lapot.');
          }
          sh.getRange(1, 1, 1, N).setValues([KC.COLS]);
        }
        sh.getRange(1, 1, 1, N).setFontWeight('bold').setBackground('#e8eaed');
        var techFrom = KC.COL['md5'] + 1;
        sh.getRange(1, techFrom, 1, N - techFrom + 1).setBackground('#f1f3f4').setFontColor('#5f6368');
        sh.setFrozenRows(1);
        // szoveg-formatum: az azonositok / md5 / datum ne alakuljanak szamma vagy datumma, a kepekrol leolvasott szoveg
        // pedig soha ne ertelmezodjon kepletkent (pl. "=...", "+36..."). A formatum a jovobeli soroknal is megmarad.
        ['file_id', 'név', 'mappa_útvonal', 'szoveg', 'leírás', 'címkézés_dátuma', 'md5', 'drive_módosítva'].forEach(function (name) {
          sh.getRange(1, KC.COL[name] + 1, sh.getMaxRows(), 1).setNumberFormat('@');
        });

        var lg = tab(KC.CFG.LOG_NAME);
        if (lg.getLastRow() === 0) {
          lg.getRange(1, 1, 1, KC.LOG_HEADER.length).setValues([KC.LOG_HEADER]).setFontWeight('bold').setBackground('#e8eaed');
          lg.setFrozenRows(1);
        }
        var se = tab(KC.CFG.SETTINGS_NAME);
        if (se.getLastRow() === 0) {
          se.getRange(1, 1, 1, 3).setValues([['kulcs', 'érték', 'megjegyzés']]).setFontWeight('bold').setBackground('#e8eaed');
          se.setColumnWidth(3, 520);
        }
        // a hianyzo alapbeallitasokat potolja (a meglevo ertekeket nem bantja)
        var have = {};
        if (se.getLastRow() > 1) se.getRange(2, 1, se.getLastRow() - 1, 1).getValues().forEach(function (r) { have[String(r[0]).trim()] = true; });
        var missing = KC.defaultSettings().filter(function (d) { return !have[d[0]]; });
        if (missing.length) {
          var at = Math.max(2, se.getLastRow() + 1);
          se.getRange(at, 1, missing.length, 3).setValues(missing);
          se.getRange(at, 2, missing.length, 1).setNumberFormat('@');
        }
      },
      settings: function () {
        var se = ss.getSheetByName(KC.CFG.SETTINGS_NAME), kv = {};
        if (!se || se.getLastRow() < 2) return kv;
        se.getRange(2, 1, se.getLastRow() - 1, 2).getValues().forEach(function (r) { if (r[0]) kv[String(r[0]).trim()] = r[1]; });
        return kv;
      },
      readAll: function () {
        var sh = mainSheet(), lr = sh.getLastRow();
        return lr < 1 ? [] : sh.getRange(1, 1, lr, N).getValues();
      },
      append: function (rows) {
        var sh = mainSheet(), start = sh.getLastRow() + 1;
        grow(sh, start + rows.length);
        sh.getRange(start, 1, rows.length, N).setValues(rows);
      },
      update: function (rowIndex, row) { mainSheet().getRange(rowIndex, 1, 1, N).setValues([row]); },
      setRange: function (row, col0, block) {
        if (!block.length) return;
        mainSheet().getRange(row, col0 + 1, block.length, block[0].length).setValues(block);
      },
      log: function (row) { tab(KC.CFG.LOG_NAME).appendRow(row); }
    },

    props: {
      getNumber: function (k) { return Number(props.getProperty(k) || 0); },
      addNumber: function (k, d) { props.setProperty(k, String(Number(props.getProperty(k) || 0) + d)); }
    },

    triggers: {
      clearContinuation: function () {
        ScriptApp.getProjectTriggers().forEach(function (t) {
          if (t.getHandlerFunction() === 'napiFolytatas') ScriptApp.deleteTrigger(t);
        });
      },
      armContinuation: function (minutes) {
        ScriptApp.getProjectTriggers().forEach(function (t) {
          if (t.getHandlerFunction() === 'napiFolytatas') ScriptApp.deleteTrigger(t);
        });
        ScriptApp.newTrigger('napiFolytatas').timeBased().after(Math.max(1, minutes) * 60 * 1000).create();
      }
    }
  };
}

function kc_withLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) { console.log('Másik futás dolgozik, kilépek.'); return null; }
  try { return fn(); } finally { lock.releaseLock(); }
}

// ---------- Inditopontok ----------

function napiFutas() {
  return kc_withLock_(function () { return KC.run(kc_env_(), 'napi'); });
}

function napiFolytatas() { return napiFutas(); }

function proba() {
  return kc_withLock_(function () { return KC.run(kc_env_(), 'proba'); });
}

function setup() {
  var env = kc_env_();
  env.sheet.ensure();

  // napi inditas (a regit torli, ne legyen dupla)
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'napiFutas') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('napiFutas').timeBased().everyDays(1).atHour(KC.CFG.DAILY_HOUR).create();

  if (!env.hasKey()) {
    env.sheet.log([env.nowText(), 'setup', '', '', '', '', '', '', '', 'nincs_kulcs', '', '', 'Add meg az OPENAI_API_KEY-t: Projektbeállítások → Script Properties, aztán futtasd újra a setup-ot.']);
    console.log('Hiányzik az OPENAI_API_KEY. Projektbeállítások (fogaskerék) → Szkripttulajdonságok → Add meg, majd futtasd újra a setup-ot.');
    return 'nincs_kulcs';
  }

  // a kulcs ellenorzese (modell lekerdezese, nem kerul pénzbe)
  var r = env.fetchAll([{ url: 'https://api.openai.com/v1/models/' + KC.CFG.MODEL, auth: 'openai' }])[0];
  if (r.code !== 200) {
    var why = 'OpenAI-kulcs ellenőrzés: HTTP ' + r.code + (r.code === 401 ? ' (érvénytelen kulcs)' : (r.code === 404 ? ' (a kulcs nem éri el a ' + KC.CFG.MODEL + ' modellt)' : ''));
    env.sheet.log([env.nowText(), 'setup', '', '', '', '', '', '', '', 'kulcs_hiba', '', '', why]);
    console.log(why);
    return 'kulcs_hiba';
  }
  console.log('Kulcs rendben, indul a ' + KC.CFG.PROBA_DB + ' fájlos próba.');
  return proba();
}

function allapot() {
  var env = kc_env_(), v = env.sheet.readAll(), C = KC.COL;
  var cnt = { osszes: 0 };
  for (var i = 1; i < v.length; i++) {
    if (!v[i][0]) continue;
    cnt.osszes++;
    ['állapot', 'fiók', 'üzletág'].forEach(function (c) {
      var k = c + ':' + (v[i][C[c]] || '-');
      cnt[k] = (cnt[k] || 0) + 1;
    });
  }
  var mk = KC.monthKey(new Date());
  cnt.honap_koltseg_usd = Math.round(env.props.getNumber(mk) * 10000) / 10000;
  env.sheet.log([env.nowText(), 'allapot', '', '', '', '', '', '', cnt.honap_koltseg_usd, '', '', '', JSON.stringify(cnt)]);
  console.log(JSON.stringify(cnt));
  return cnt;
}

function leallitas() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  console.log('Minden időzítő törölve.');
}
