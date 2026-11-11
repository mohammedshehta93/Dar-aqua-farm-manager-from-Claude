// ══════════════════════════════════════════════════════════
//  THE DATE OF AN AQUAMANAGER OPENING BALANCE (owner, 2026-11-11)
// ══════════════════════════════════════════════════════════
// Importing today's Site Overview made today the opening date, so yesterday's feed — not yet in AquaManager, hence not
// in the file — was refused ("before the opening balance date"). The file's numbers are really the farm at the START of
// the first day missing in AquaManager. Now: the import preview asks "these numbers stand at the start of day …"
// (default the file's date, earlier allowed), and Farm setup lets an earlier date be set for an import already done.
// Records already in the tool on the days in between then count (they are not in AquaManager's numbers).
function daAqmImports(){   // opening dates of AquaManager imports: {date: [units]}
  var o = {}; RAW.forEach(function(u){ if(u.open && /^AquaManager/.test(u.open.source || '') && u.open.date) (o[u.open.date] = o[u.open.date] || []).push(u.unit); }); return o;
}
function daAqmLaterOpen(farm, date){   // tanks of a farm whose AquaManager balance starts after the day, and that already had fish on it
  return RAW.filter(function(u){ return u.open && /^AquaManager/.test(u.open.source || '') && u.open.date > date && (!farm || u.farm === farm)
    && !(u.open.fish === 0 && /not in the file/.test(u.open.source || '')) && (!u.startDate || u.startDate <= date); });
}
async function daAqmShiftFarm(farm, date){   // the balance starts at the start of that day for those tanks (stocked later: untouched)
  var ch = daAqmLaterOpen(farm, date); ch.forEach(function(u){ u.open.date = date; });
  _valCache = {t:0, map:{}}; _dataVer++; await daPersistUnitsLocal(); try{ await saveUnitsToCloud(ch); }catch(e){}
  return ch.length;
}
async function daFsAqmBack(){
  var st = window._fs; if(!st) return; var L = daAqmLaterOpen(st.farm, st.date), od = L.map(function(u){ return u.open.date; }).sort()[0];
  if(!confirm('رصيد الأكوامانجر لـ ' + L.length + ' تانك هيبدأ من أول يوم ' + st.date + ' بدل ' + od + '.\nاعمل كده بس لو الأيام من ' + st.date + ' لحد ' + daAddDays(od, -1) + ' مش متسجلة في الأكوامانجر وقت ما صدّرت الملف — غير كده هتتحسب مرتين. تكمل؟')) return;
  var n = await daAqmShiftFarm(st.farm, st.date); toast('✅ ' + n + ' تانك — سجّل العلف من ' + st.date); show('feed-sheet', true);
}
async function daAqmShiftOpen(from, to){
  if(!from || !to || to >= from){ toast('⚠️ اختار يوم قبل ' + from); return 0; }
  var ch = RAW.filter(function(u){ return u.open && u.open.date === from && /^AquaManager/.test(u.open.source || ''); });
  ch.forEach(function(u){ u.open.date = to; if(u.startDate > to && u.startDate === from) u.startDate = to; });
  _valCache = {t:0, map:{}}; _dataVer++; await daPersistUnitsLocal(); try{ await saveUnitsToCloud(ch); }catch(e){}
  return ch.length;
}
function daAqmOpenCard(){
  var I = daAqmImports(), ds = Object.keys(I).sort().reverse(); if(!ds.length) return '';
  var d = ds[0], inp = 'padding:6px 9px;border:1.5px solid var(--line);border-radius:7px;font:inherit;font-size:13px';
  return '<div class="card" id="aqo-card" style="margin-bottom:14px"><div class="card-title">📥 رصيد الأكوامانجر</div>'
    + '<div style="font-size:13px;line-height:1.9">آخر استيراد: أرقام <b>' + I[d].length + ' تانك</b> محسوبة لحد أول يوم <b>' + d + '</b> — أي حاجة قبله الأداة بتعتبرها جوه الرصيد.</div>'
    + '<div style="font-size:12px;color:var(--muted);margin:4px 0 8px">لو فيه أيام قبله <b>ما اتسجلتش في الأكوامانجر</b> وقت ما صدّرت الملف (زي علف امبارح)، رجّع التاريخ لأول يوم منهم عشان تقدر تسجلها هنا.</div>'
    + '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span>الأرقام دي لحد أول يوم</span><input type="date" id="aqo-date" data-nodirty="1" value="' + daAddDays(d, -1) + '" max="' + daAddDays(d, -1) + '" style="' + inp + '"/>'
    + '<button id="aqo-go" class="savebtn" style="width:auto;padding:8px 16px" onclick="daAqoApply(&quot;' + d + '&quot;)">↩️ غيّر تاريخ الرصيد</button></div></div>';
}
async function daAqoApply(from){
  var to = daVal('aqo-date'); if(!to || to >= from){ toast('⚠️ اختار يوم قبل ' + from); return; }
  if(!confirm('أرقام الأكوامانجر هتتحسب لحد أول يوم ' + to + ' بدل ' + from + '.\nاستخدمها بس لو الأيام من ' + to + ' لـ ' + daAddDays(from, -1) + ' مش متسجلة في الأكوامانجر وقت ما صدّرت الملف — غير كده هتتحسب مرتين. تكمل؟')) return;
  var n = await daAqmShiftOpen(from, to); toast('✅ ' + n + ' تانك — الرصيد بقى من أول يوم ' + to + '، وتقدر تسجل الأيام دي'); show('farm-setup', true);
}
if(!window._daAqoWrapped){
  window._daAqoWrapped = true;
  var _showPreAqo = show;
  show = function(v){ var r = _showPreAqo.apply(this, arguments);
    if(currentView === 'feed-sheet' && window._fs && typeof currentUserRole !== 'undefined' && currentUserRole !== 'worker' && !document.getElementById('fs-aqmback')){
      var st = window._fs, L = daAqmLaterOpen(st.farm, st.date), box = document.getElementById('fs-copybox');
      if(L.length && box){ var od = L.map(function(u){ return u.open.date; }).sort()[0];
        box.insertAdjacentHTML('beforebegin', '<div class="card" id="fs-aqmback" style="margin-bottom:12px;background:#fef9c3;border:2px solid #eab308"><b>⚠️ اليوم ده قبل رصيد الأكوامانجر (' + od + ')</b> — ' + L.length + ' تانك أرقامهم محسوبة من الأكوامانجر من أول ' + od + '.'
          + '<div style="font-size:12px;margin:6px 0">لو الأيام من ' + st.date + ' لحد ' + daAddDays(od, -1) + ' <b>مش متسجلة في الأكوامانجر</b>، ابدأ الرصيد من ' + st.date + ' عشان تسجلها هنا — والتانكات اللي اتخزنت بعد اليوم ده مش هتتأثر.</div>'
          + '<button id="fs-aqmback-go" class="savebtn" style="width:auto;padding:8px 16px" onclick="daFsAqmBack()">↩️ ابدأ الرصيد من ' + st.date + '</button></div>'); } }
    if(currentView === 'farm-setup' && !document.getElementById('aqo-card')){ var us = document.getElementById('us-card') || document.getElementById('ta-card'); var html = daAqmOpenCard(); if(us && html) us.insertAdjacentHTML('beforebegin', html); }
    return r; };
  var _fsRowsPreAqo = daFsRows;   // a tank on a day before its stock date had no fish (an AquaManager balance from a later day must not fill it)
  daFsRows = function(farm, date){ var rows = _fsRowsPreAqo.apply(this, arguments);
    return rows.map(function(r){ var u = daRawUnit(r.unit); return u && u.open && u.startDate && date < u.startDate && r.fish ? Object.assign({}, r, {fish:0}) : r; }); };
  var _prevPreAqo = daShowAqmPreview;   // the import preview asks for the date the numbers stand at
  daShowAqmPreview = function(p){ var r = _prevPreAqo.apply(this, arguments), od = p && p.stats && p.stats.openDate, el = document.getElementById('imp-preview'), go = el && el.querySelector('#imp-go');
    if(od && go && !document.getElementById('imp-opendate')) go.insertAdjacentHTML('beforebegin', '<div style="margin:10px 0;padding:10px 12px;border-radius:10px;background:#eff6ff;font-size:13px"><b>📅 الأرقام دي لحد أول يوم</b> <input type="date" id="imp-opendate" data-nodirty="1" value="' + od + '" max="' + od + '" style="padding:5px 8px;border:1.5px solid var(--line);border-radius:7px;font:inherit"/>'
      + '<div style="font-size:11px;color:var(--muted);margin-top:4px">سيبه تاريخ الملف لو كل الأيام اللي قبله متسجلة في الأكوامانجر. لو فيه أيام لسه مش متسجلة فيه (زي علف امبارح) اختار أول يوم منهم — عشان تتسجل في الأداة.</div></div>');
    return r; };
  var _runPreAqo = daRunImport;
  daRunImport = async function(){
    var p = window._impParsed, e = document.getElementById('imp-opendate'), od = p && p.stats && p.stats.openDate;
    if(p && p.aqm && e && e.value && od && e.value < od) (p.units || []).concat(p.emptied || []).forEach(function(u){ if(u.open && u.open.date === od){ u.open.date = e.value; if(u.startDate === od) u.startDate = e.value; } });
    return _runPreAqo.apply(this, arguments);
  };
}
