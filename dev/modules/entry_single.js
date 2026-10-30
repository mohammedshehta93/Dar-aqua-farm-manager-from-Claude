// ══════════════════════════════════════════════════════════
//  ONE ENTRY SCREEN PER KIND — mortality and sampling too (owner, 2026-10-30)
// ══════════════════════════════════════════════════════════
// Feeding + dead counts → the daily feed sheet; water → the testing log; sampling → the sampling screen.
// The old "daily sheet" saved into a separate logs store that never reached stock / FCR / reports, so it is retired
// as an entry screen. The mortality screen becomes "أسباب النفوق": it adds causes to recorded mortality, never counts.
// addTX refuses mortality that does not come from the feed sheet (or an import). Same switch as feeding:
// window.DA_SINGLE_FEED = false → legacy screens (tests of their own code only).
function renderDailyRetired(){
  var it = function(v, ic, t, d){ return canAccessView(v) ? '<li style="margin:6px 0"><a href="#" onclick="show(&quot;' + v + '&quot;);return false">' + ic + ' <b>' + t + '</b></a> — ' + d + '</li>' : ''; };
  return '<div class="ph"><div><h2>📋 الإدخال بقى كل حاجة من مكان واحد</h2></div></div><div class="card" style="max-width:680px;line-height:1.9;font-size:14px">'
    + '<p>الشيت اليومي اتقفل: كان بيحفظ في مكان منفصل مش بيوصل للأرصدة ولا الـ FCR ولا التقارير.</p><ul style="padding-inline-start:20px">'
    + it('feed-sheet', '📋', 'شيت العلف اليومي', 'العلف والنافق (عمود dead)')
    + it('wq-sheet', '🧪', 'شيت القياسات اليومي', 'الحرارة والـ pH والأكسجين لكل سكشن')
    + it('tx-sampling', '⚖️', 'العينات', 'متوسط الوزن')
    + it('tx-mortality', '💀', 'أسباب النفوق', 'تضيف سبب للنافق المتسجل') + '</ul>'
    + '<p style="font-size:12px;color:var(--muted)">اللي اتسجل قبل كده في الشيت اليومي موجود في <a href="#" onclick="show(&quot;logbook&quot;);return false">السجل</a>.</p></div>';
}
// ── causes for recorded mortality ──
function renderMortCauses(){
  var st = window._mc = window._mc || {}; if(!st.date) st.date = daToday();
  var farms = daFarms(); if(farmFilter && farmFilter !== 'all') st.farm = farmFilter; if(!st.farm || farms.indexOf(st.farm) < 0) st.farm = farms[0] || '';
  var inp = 'padding:7px 10px;border:1.5px solid var(--line);border-radius:8px;font:inherit;font-size:13px';
  var list = getTX().filter(function(t){ return t.type === 'mortality' && t.date === st.date && !t.deleted && String(t.unit).indexOf(st.farm + '.') === 0; })
    .sort(function(a, b){ var x = daTankNo(a.unit) || {s:0, t:0}, y = daTankNo(b.unit) || {s:0, t:0}; return x.s - y.s || x.t - y.t; });
  st.ids = list.map(function(t){ return t.id; });
  var h = '<div class="ph"><div><h2>💀 أسباب النفوق</h2><p style="font-size:11px;color:var(--muted)">عدد النافق بيتسجل من شيت العلف (عمود dead) — هنا بتضيف السبب بس. السبب اختياري.</p></div>'
    + (list.length ? '<button id="mc-save" class="savebtn" style="width:auto;padding:10px 22px" onclick="daMcSave()">💾 حفظ الأسباب</button>' : '') + '</div>';
  h += '<div class="card" style="margin-bottom:12px;display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">'
    + '<div class="field" style="margin:0"><label>التاريخ</label><input type="date" id="mc-date" value="' + st.date + '" max="' + daToday() + '" style="' + inp + '" onchange="window._mc.date=this.value;show(&quot;tx-mortality&quot;,true)"/></div>'
    + (farmFilter && farmFilter !== 'all' ? '' : '<div class="field" style="margin:0"><label>المزرعة</label><select id="mc-farm" style="' + inp + '" onchange="window._mc.farm=this.value;show(&quot;tx-mortality&quot;,true)">' + farms.map(function(f){ return '<option' + (f === st.farm ? ' selected' : '') + '>' + daEsc(f) + '</option>'; }).join('') + '</select></div>')
    + '<button onclick="window._fs={farm:window._mc.farm,date:window._mc.date};show(&quot;feed-sheet&quot;)" style="' + inp + ';cursor:pointer;background:#fff">📋 سجّل النافق في شيت العلف</button></div>';
  if(!list.length) return h + '<div class="card" style="text-align:center;padding:30px;color:var(--muted)">مفيش نفوق متسجل للمزرعة دي في اليوم ده.</div>';
  h += '<div class="card"><div style="overflow-x:auto"><table class="wqs-t" style="width:100%"><thead><tr><th>Tank</th><th>العدد</th><th>السبب</th><th>ملاحظة</th></tr></thead><tbody>';
  list.forEach(function(t, i){
    h += '<tr><td class="wqs-sec">' + daEsc((daTankNo(t.unit) || {}).label || t.unit) + '</td><td style="font-weight:700">' + daEsc(t.countRaw || t.count) + '</td>'
      + '<td><select id="mc-cause-' + i + '" style="' + inp + '">' + daCauseOptions(t.cause) + '</select></td>'
      + '<td><input type="text" id="mc-notes-' + i + '" value="' + daEsc(t.notes || '') + '" dir="auto" style="' + inp + ';width:220px"/></td></tr>';
  });
  return h + '</tbody></table></div></div>';
}
function daMcSave(){
  var st = window._mc, n = 0;
  (st.ids || []).forEach(function(id, i){
    var t = getTX().filter(function(x){ return x.id === id; })[0]; if(!t) return;
    var c = (document.getElementById('mc-cause-' + i) || {}).value || '', no = String((document.getElementById('mc-notes-' + i) || {}).value || '').trim();
    if((t.cause || '') !== c || (t.notes || '') !== no){ updateTX(id, {cause:c, notes:no}); n++; }
  });
  toast(n ? '✅ اتحفظت أسباب ' + n + ' سجل' : 'مفيش تغيير'); show('tx-mortality', true);
}
// dashboard charts read the real records (they read the old logs store)
function daDashLogs(){
  var out = []; getTX().forEach(function(t){
    if(t.deleted || (farmFilter && farmFilter !== 'all' && String(t.unit).indexOf(farmFilter + '.') !== 0)) return;
    if(t.type === 'feeding') out.push({type:'feed', date:t.date, unit:t.unit, kg:parseFloat(t.kg) || 0});
    else if(t.type === 'mortality') out.push({type:'mortality', date:t.date, unit:t.unit, count:parseInt(t.count) || 0});
  });
  return out;
}
function daMortEntryAllowed(t){ return !daSingleFeed() || !t || t.type !== 'mortality' || t.source === 'sheet' || t.source === 'import' || t._skipValidation; }
function daSampBar(){
  return '<div class="card" style="margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center"><span style="font-size:12px;color:var(--muted);flex:1">العينات بتتسجل من هنا بس. ممكن من الشيت المطبوع: </span>'
    + '<button id="sp-print" onclick="daOcrPrint(&quot;samp&quot;)" style="padding:8px 14px;border:1.5px solid var(--line);background:#fff;border-radius:8px;font:inherit;cursor:pointer">🖨️ شيت للطباعة</button>'
    + '<button id="sp-photo" onclick="daOcrPick(&quot;samp&quot;)" style="padding:8px 14px;border:1.5px solid var(--teal);background:#fff;color:var(--teal);border-radius:8px;font:inherit;cursor:pointer;font-weight:700">📷 من صورة</button></div>';
}

// ── registration ──
if(!window._daEntrySingleWrapped){
  window._daEntrySingleWrapped = true;
  var _dailyPreEntry = VIEWS.daily, _mortPreEntry = VIEWS['tx-mortality'], _sampPreEntry = VIEWS['tx-sampling'];
  VIEWS.daily = function(){ return daSingleFeed() ? renderDailyRetired() : _dailyPreEntry.apply(this, arguments); };
  VIEWS['tx-mortality'] = function(){ return daSingleFeed() ? renderMortCauses() : _mortPreEntry.apply(this, arguments); };
  VIEWS['tx-sampling'] = function(){ var h = _sampPreEntry.apply(this, arguments); return daSingleFeed() ? daSampBar() + h : h; };
  var _addTXPreEntry = addTX;
  addTX = function(obj){
    if(!daMortEntryAllowed(obj)){ toast('📋 عدد النافق بيتسجل من شيت العلف بس (عمود dead)'); return null; }
    return _addTXPreEntry.apply(this, arguments);
  };
  var _canAccessPreEntry = canAccessView;
  canAccessView = function(v){   // the feed sheet also carries the dead column → open to mortality-only users
    if(v === 'feed-sheet' && currentUser && (currentUserRole === 'admin' || hasPerm('input_feeding') || hasPerm('input_mortality'))) return true;
    return _canAccessPreEntry.apply(this, arguments);
  };
  DA_NAV.forEach(function(g){
    g.items = g.items.filter(function(i){ return i[0] !== 'daily'; });
    g.items.forEach(function(i){ if(i[0] === 'tx-mortality'){ i[1] = '💀'; i[2] = 'أسباب النفوق'; i[3] = 'Mortality causes'; } });
  });
}
