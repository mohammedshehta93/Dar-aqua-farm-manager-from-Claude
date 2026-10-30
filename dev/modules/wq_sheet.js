// ══════════════════════════════════════════════════════════
//  DAILY TESTING LOG — water quality per SECTION (paper AQU-LG-25-01-01)
// ══════════════════════════════════════════════════════════
// Tanks of one RAS section share water and biofilter, and the farm measures once per section, so a reading is ONE
// water_quality record with unit = the section id (e.g. "F2.S01") and scope:'section' — not copied to every tank.
// id ws-<section>-<date>: saving again edits it. ✓/✗ is computed from the farm's acceptance limits (editable here,
// stored in that farm's settings: tempLo, tempHi, phMin, phMax, doCrit) — the same limits the alerts use.
var DA_WQ_DEF = {tempLo:21, tempHi:32, phMin:6.5, phMax:9, doCrit:4};
function daWqLimits(farm){   // the farm's own limit → else the all-farms limit → else the default
  var c = typeof daRawSettings === 'function' ? daRawSettings(farm) : (getSettings(farm) || {}), g = typeof daRawSettings === 'function' ? daRawSettings('global') : {}, o = {};
  Object.keys(DA_WQ_DEF).forEach(function(k){ var v = parseFloat(c[k]); if(isNaN(v)) v = parseFloat(g[k]); o[k] = isNaN(v) ? DA_WQ_DEF[k] : v; });
  return o;
}
function daSecOf(unit){ var r = daRawUnit(unit); if(r && r.section) return r.section; var m = /^(.*?\.?S\d+)T\d+$/i.exec(String(unit || '')); return m ? m[1] : ''; }
function daSecNo(sec){ var m = /S(\d+)$/i.exec(String(sec || '')); return m ? +m[1] : null; }
function daWqSections(farm){
  var s = {};
  _txLiveRows().forEach(function(r){ if(r.farm !== farm && String(r.unit).indexOf(farm + '.') !== 0) return; var k = r.section || daSecOf(r.unit); if(k && daSecNo(k) !== null) s[k] = 1; });
  return Object.keys(s).sort(function(a, b){ return daSecNo(a) - daSecNo(b); });
}
// which limits a reading breaks (empty = within range)
function daWqIssues(v, lim){
  var o = [];
  if(v.temp != null){ if(v.temp < lim.tempLo) o.push('الحرارة أقل من ' + lim.tempLo); else if(v.temp > lim.tempHi) o.push('الحرارة أعلى من ' + lim.tempHi); }
  if(v.ph != null){ if(v.ph < lim.phMin) o.push('pH أقل من ' + lim.phMin); else if(v.ph > lim.phMax) o.push('pH أعلى من ' + lim.phMax); }
  if(v['do'] != null && v['do'] <= lim.doCrit) o.push('الأكسجين ' + v['do'] + ' (لازم أكبر من ' + lim.doCrit + ')');
  return o;
}
function daWqNum(id){ var el = document.getElementById(id); if(!el) return {v:null}; var raw = String(el.value).trim(); if(raw === '') return {v:null}; var n = parseFloat(raw); return isNaN(n) ? {bad:true} : {v:n}; }

function renderWqSheet(){
  var st = window._wqs = window._wqs || {}, farms = daFarms();
  if(farmFilter && farmFilter !== 'all') st.farm = farmFilter;
  if(!st.farm || farms.indexOf(st.farm) < 0) st.farm = farms[0] || '';
  if(!st.date) st.date = daToday();
  var secs = st.secs = daWqSections(st.farm), lim = daWqLimits(st.farm), saved = {};
  getTX().forEach(function(t){ if(t.type === 'water_quality' && t.date === st.date && !t.deleted && t.id === 'ws-' + t.unit + '-' + st.date) saved[t.unit] = t; });
  var any = Object.keys(saved).length, first = saved[Object.keys(saved)[0]] || {};
  if(st.loadedFor !== st.farm + '|' + st.date){ st.time = first.time || ''; st.tech = first.tech || ''; st.loadedFor = st.farm + '|' + st.date; }
  var canCfg = ['admin', 'manager', 'engineer'].indexOf(currentUserRole) >= 0;
  var inp = 'padding:7px 10px;border:1.5px solid var(--line);border-radius:8px;font:inherit;font-size:13px';
  var h = '<div class="ph"><div><h2>🧪 شيت القياسات اليومي</h2><p style="font-size:11px;color:var(--muted)">قراية واحدة لكل سكشن — نفس الشيت الورق</p></div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap"><button id="wqs-print" onclick="daOcrPrint(&quot;wq&quot;)" style="padding:9px 14px;border:1.5px solid var(--line);background:#fff;border-radius:8px;font:inherit;cursor:pointer">🖨️ شيت للطباعة</button>'
    + '<button id="wqs-photo" onclick="daOcrPick(&quot;wq&quot;)" style="padding:9px 14px;border:1.5px solid var(--teal);background:#fff;color:var(--teal);border-radius:8px;font:inherit;cursor:pointer;font-weight:700">📷 من صورة</button>'
    + '<button id="wqs-save" class="savebtn" style="width:auto;padding:10px 22px" onclick="daWqsSave()">💾 حفظ الشيت</button></div></div>';
  h += '<div class="card" style="margin-bottom:12px"><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">'
    + '<div class="field" style="margin:0"><label>التاريخ</label><input type="date" id="wqs-date" value="' + st.date + '" max="' + daToday() + '" style="' + inp + '" onchange="daWqsSwitch(&quot;date&quot;,this.value)"/></div>';
  if(!(farmFilter && farmFilter !== 'all')) h += '<div class="field" style="margin:0"><label>المزرعة</label><select id="wqs-farm" style="' + inp + '" onchange="daWqsSwitch(&quot;farm&quot;,this.value)">'
    + farms.map(function(f){ return '<option' + (f === st.farm ? ' selected' : '') + '>' + daEsc(f) + '</option>'; }).join('') + '</select></div>';
  h += '<div class="field" style="margin:0"><label>وقت القياس</label><input type="time" id="wqs-time" data-nodirty="1" value="' + daEsc(st.time || '') + '" style="' + inp + '" oninput="window._wqs.time=this.value"/></div>'
    + '<div class="field" style="margin:0"><label>الفني</label><input id="wqs-tech" data-nodirty="1" value="' + daEsc(st.tech || '') + '" placeholder="اسم اللي قاس" style="' + inp + ';width:150px" oninput="window._wqs.tech=this.value"/></div></div></div>';
  if(!secs.length) return h + '<div class="card" style="text-align:center;padding:40px;color:var(--muted)">مفيش سكاشن متسجلة للمزرعة دي.</div>';
  if(any) h += '<div class="card" style="margin-bottom:12px;background:#f0fdf4;font-size:13px">✅ الشيت ده متسجل قبل كده — أي تعديل وحفظ بيعدّل نفس السجلات.</div>';
  h += '<div class="card" style="margin-bottom:12px;padding:10px"><div style="overflow-x:auto" dir="ltr"><table class="wqs-t" dir="ltr"><thead><tr><th>Section</th><th>Temp (°C)</th><th>pH</th><th>DO (mg/L)</th><th>✓ / ✗</th><th>Notes / Corrective Action</th></tr></thead><tbody>';
  secs.forEach(function(sec, i){
    var t = saved[sec] || {}, f = function(k){ return t[k] === null || t[k] === undefined ? '' : t[k]; };
    h += '<tr><td class="wqs-sec">S-' + ('0' + daSecNo(sec)).slice(-2) + '</td>'
      + '<td><input type="number" inputmode="decimal" step="0.1" id="wqs-' + i + '-temp" value="' + f('temp') + '"/></td>'
      + '<td><input type="number" inputmode="decimal" step="0.01" id="wqs-' + i + '-ph" value="' + f('ph') + '"/></td>'
      + '<td><input type="number" inputmode="decimal" step="0.1" id="wqs-' + i + '-do" value="' + f('do') + '"/></td>'
      + '<td class="wqs-ok" id="wqs-' + i + '-ok"></td>'
      + '<td><input type="text" class="wqs-note" id="wqs-' + i + '-notes" value="' + daEsc(t.notes || '') + '" dir="auto"/></td></tr>';
  });
  h += '</tbody><tfoot><tr><td><b>Acceptance</b></td><td>' + lim.tempLo + '–' + lim.tempHi + ' °C</td><td>' + lim.phMin + '–' + lim.phMax + '</td><td>&gt; ' + lim.doCrit + '</td>'
    + '<td colspan="2" style="text-align:left;font-size:11px;color:var(--muted)">أي قراية برّه الحدود ← لازم إجراء تصحيحي مكتوب</td></tr></tfoot></table></div></div>';
  if(canCfg) h += '<details class="card" style="margin-bottom:12px"><summary style="cursor:pointer;font-weight:700">⚙️ حدود القبول — ' + daEsc(st.farm) + '</summary>'
    + '<div style="font-size:12px;color:var(--muted);margin:8px 0">نفس حدود الشيت الورق. التنبيهات الذكية بتستخدم نفس الأرقام دي للمزرعة دي.</div><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">'
    + [['tempLo', 'الحرارة من'], ['tempHi', 'الحرارة لحد'], ['phMin', 'pH من'], ['phMax', 'pH لحد'], ['doCrit', 'الأكسجين أكبر من']].map(function(x){
      return '<div class="field" style="margin:0"><label>' + x[1] + '</label><input type="number" step="0.1" id="wqs-lim-' + x[0] + '" data-nodirty="1" value="' + lim[x[0]] + '" style="' + inp + ';width:90px"/></div>'; }).join('')
    + '<div class="field" style="margin:0"><label>كود النموذج (Rev)</label><input id="wqs-rev" data-nodirty="1" dir="ltr" value="' + daEsc(daSheetCfgAll()['rev:wq'] || '') + '" placeholder="AQU-LG-25-01-01" style="' + inp + ';width:170px"/></div>'
    + '<button class="savebtn" style="width:auto;padding:8px 16px" onclick="daWqsSaveLimits()">💾 حفظ الحدود</button></div></details>';
  setTimeout(daWqsMarks, 0);
  return h;
}
function daWqsRead(i){
  var o = {}, bad = false;
  ['temp', 'ph', 'do'].forEach(function(k){ var r = daWqNum('wqs-' + i + '-' + k); if(r.bad) bad = true; o[k] = r.bad ? null : r.v; });
  o.notes = String((document.getElementById('wqs-' + i + '-notes') || {}).value || '').trim();
  o.bad = bad; o.empty = o.temp === null && o.ph === null && o['do'] === null && !o.notes;
  return o;
}
function daWqsMarks(){
  var st = window._wqs; if(!st || !st.secs) return; var lim = daWqLimits(st.farm);
  st.secs.forEach(function(sec, i){
    var v = daWqsRead(i), el = document.getElementById('wqs-' + i + '-ok'); if(!el) return;
    var iss = daWqIssues(v, lim);
    el.textContent = v.empty || (v.temp === null && v.ph === null && v['do'] === null) ? '' : iss.length ? '✗' : '✓';
    el.className = 'wqs-ok ' + (iss.length ? 'x' : 'v'); el.title = iss.join(' · ');
    ['temp', 'ph', 'do'].forEach(function(k){ var x = document.getElementById('wqs-' + i + '-' + k); if(x) x.classList.toggle('wqs-out', iss.some(function(s){ return s.indexOf(k === 'temp' ? 'الحرارة' : k === 'ph' ? 'pH' : 'الأكسجين') === 0; })); });
    var n = document.getElementById('wqs-' + i + '-notes'); if(n) n.classList.toggle('wqs-need', iss.length > 0 && !v.notes);
  });
}
document.addEventListener('input', function(e){ if(e.target && e.target.closest && e.target.closest('.wqs-t')) daWqsMarks(); });
function daWqsSwitch(k, v){
  var t = _daActiveTab;
  if(t && t.dirty && !confirm('فيه قرايات اتكتبت ومتحفظتش. تغيّر ' + (k === 'date' ? 'التاريخ' : 'المزرعة') + ' وتضيعها؟')){
    var el = document.getElementById('wqs-' + k); if(el) el.value = window._wqs[k]; return;
  }
  window._wqs[k] = v; show('wq-sheet', true);
}
function daWqsSaveLimits(){
  var st = window._wqs, c = getSettings(st.farm) || {}, ok = true;
  Object.keys(DA_WQ_DEF).forEach(function(k){ var v = parseFloat((document.getElementById('wqs-lim-' + k) || {}).value); if(isNaN(v)) ok = false; else c[k] = v; });
  if(!ok){ toast('⚠️ اكتب كل الحدود أرقام'); return; }
  if(c.tempLo >= c.tempHi || c.phMin >= c.phMax){ toast('⚠️ "من" لازم تبقى أقل من "لحد"'); return; }
  saveSettings(c, st.farm);
  var rv = document.getElementById('wqs-rev'); if(rv){ var all = daSheetCfgAll(); if(rv.value.trim()) all['rev:wq'] = rv.value.trim(); else delete all['rev:wq']; localStorage.setItem(DA_SHEET_KEY, JSON.stringify(all)); }
  toast('✅ اتحفظت حدود ' + st.farm); show('wq-sheet', true);
}
function daWqsSave(){
  var st = window._wqs; if(!st || !st.secs) return;
  var lim = daWqLimits(st.farm), who = currentUser ? {by:currentUser.email, byName:(getSession() || {}).name || '', byRole:currentUserRole} : {};
  var now = new Date().toISOString(), adds = [], edits = [], dels = [], bad = [], blocked = [], noAction = [];
  st.secs.forEach(function(sec, i){
    var v = daWqsRead(i), id = 'ws-' + sec + '-' + st.date, label = 'S-' + ('0' + daSecNo(sec)).slice(-2);
    if(v.bad){ bad.push(label); return; }
    var old = getTX().filter(function(t){ return t.id === id && !t.deleted; })[0];
    if(v.empty){ if(old) dels.push(id); return; }
    var iss = daWqIssues(v, lim); if(iss.length && !v.notes) noAction.push(label);
    var rec = {temp:v.temp, ph:v.ph, 'do':v['do'], notes:v.notes, ok:!iss.length, issues:iss.join(' · '), time:st.time || '', tech:st.tech || ''};
    if(old){
      var ch = {}; Object.keys(rec).forEach(function(k){ if(String(old[k] === undefined ? '' : old[k]) !== String(rec[k] === null ? '' : rec[k])) ch[k] = rec[k]; });
      if(Object.keys(ch).length) edits.push({id:id, ch:ch});
      return;
    }
    var t = Object.assign({id:id, type:'water_quality', date:st.date, unit:sec, scope:'section', section:sec, source:'wsheet', at:now, ts:now}, rec, who);
    if(t.byRole === 'worker') t.status = 'pending';
    var x = validateTX(t);
    if(x.level === 'block') blocked.push(label + ': ' + x.msgs.join(' '));
    else { if(x.level === 'warn'){ t.flagged = true; t.flagMsg = x.msgs.join(' · '); if(!t.status) t.status = 'pending'; } adds.push(t); }
  });
  if(bad.length){ toast('⚠️ أرقام مش صحيحة في: ' + bad.join('، ')); return; }
  if(blocked.length){ alert('⛔ قيم مستحيلة — راجعها:\n' + blocked.join('\n')); return; }
  if(!adds.length && !edits.length && !dels.length){ toast('مفيش تغيير'); return; }
  if(noAction.length && !confirm('قرايات برّه الحدود من غير إجراء تصحيحي مكتوب: ' + noAction.join('، ') + '.\nالشيت بيطلب الإجراء يتكتب. تحفظ من غيره؟')) return;
  adds.forEach(function(t){ addTX(Object.assign({_skipValidation:true}, t)); });
  edits.forEach(function(e){ updateTX(e.id, e.ch); });
  dels.forEach(function(id){ deleteTX(id); });
  var out = adds.concat(edits).length ? st.secs.filter(function(s, i){ var v = daWqsRead(i); return !v.empty && daWqIssues(v, lim).length; }).length : 0;
  toast('✅ اتحفظ شيت القياسات ' + st.date + (out ? ' · ✗ ' + out + ' سكشن برّه الحدود' : ''));
  show('wq-sheet', true);
}

// ── registration ──
VIEWS['wq-sheet'] = renderWqSheet; VIEW_PERMS['wq-sheet'] = 'input_wq';
(function(){
  var g = DA_NAV.filter(function(x){ return x.id === 'entry'; })[0];
  if(g && !g.items.some(function(i){ return i[0] === 'wq-sheet'; })){
    var at = g.items.map(function(i){ return i[0]; }).indexOf('feed-sheet');
    g.items.splice(at + 1, 0, ['wq-sheet', '🧪', 'شيت القياسات اليومي', 'Daily Testing Log']);
  }
  if(document.getElementById('da-wqs-css')) return;
  var c = document.createElement('style'); c.id = 'da-wqs-css';
  c.textContent = '.wqs-t{border-collapse:collapse;font-size:13px}.wqs-t th{background:var(--deep);color:#fff;padding:7px 8px;white-space:nowrap}'
    + '.wqs-t td{border-bottom:1px solid var(--line);padding:4px 4px;text-align:center}.wqs-t .wqs-sec{font-weight:800;text-align:left;padding-left:8px;position:sticky;left:0;background:#fff}'
    + '.wqs-t input{width:76px;padding:7px 4px;border:1.5px solid var(--line);border-radius:6px;font:inherit;text-align:center}.wqs-t input.wqs-note{width:260px;text-align:right}'
    + '.wqs-t input.wqs-out{border-color:var(--red);background:#fef2f2}.wqs-t input.wqs-need{border-color:var(--amber);background:#fffbeb}'
    + '.wqs-t .wqs-ok{font-size:18px;font-weight:800;min-width:44px}.wqs-t .wqs-ok.v{color:var(--green)}.wqs-t .wqs-ok.x{color:var(--red)}'
    + '.wqs-t tfoot td{background:#f1f5f9;font-size:12px;font-weight:700}'
    + '@media(max-width:700px){.wqs-t input{width:62px}.wqs-t input.wqs-note{width:170px}}';
  document.head.appendChild(c);
})();
