// ══════════════════════════════════════════════════════════
//  SECTIONS OF A FARM'S TANKS — rearrange in one step (owner, 2026-11-09)
// ══════════════════════════════════════════════════════════
// The nursery's 7 tanks are 7 sections; they were added as one section. "🔀 Sections" (status card, per farm): all tanks
// in one section · each tank its own section · N tanks per section — the new names are shown next to the old ones, one
// confirmation, then the tanks are renamed to the standard form (F3.S02T01 …) and their records move with them
// (daRenameUnit, two steps through temporary names so no two tanks ever share a name; old names queued for deletion).
// Settings → Tanks now shows the farm's real tanks (the main list) instead of "no tanks added".
function daLayTanks(farm){
  return RAW.filter(function(u){ return u.farm === farm; }).map(function(u){ return u.unit; })
    .sort(function(a, b){ var x = daTankNo(a) || {s:0, t:0}, y = daTankNo(b) || {s:0, t:0}; return x.s - y.s || x.t - y.t || a.localeCompare(b, undefined, {numeric:true}); });
}
function daLayPlan(farm, mode, per){
  var list = daLayTanks(farm), p2 = function(n){ return ('0' + n).slice(-2); };
  per = mode === 'one' ? list.length : mode === 'each' ? 1 : Math.max(1, parseInt(per, 10) || 1);
  return list.map(function(u, i){ return {from:u, to:farm + '.S' + p2(Math.floor(i / per) + 1) + 'T' + p2(i % per + 1)}; });
}
function daLayOpen(farm){
  var el = document.getElementById('lay-panel'); if(!el){ var us = document.getElementById('us-card'); if(!us) return; us.insertAdjacentHTML('afterend', '<div class="card" id="lay-panel" style="margin-bottom:14px;border:2px solid var(--teal)"></div>'); el = document.getElementById('lay-panel'); }
  window._layFarm = farm; var n = daLayTanks(farm).length;
  el.innerHTML = '<div class="card-title">🔀 ترتيب سكاشن ' + daEsc(farm) + ' (' + n + ' تانك) <button onclick="document.getElementById(&quot;lay-panel&quot;).remove()" style="border:0;background:none;cursor:pointer;color:var(--muted)">✕</button></div>'
    + '<div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center;margin-bottom:10px">'
    + '<label style="display:flex;gap:6px;align-items:center;cursor:pointer"><input type="radio" name="lay-m" value="one" onchange="daLayPreview()"/> كلها في سكشن واحد</label>'
    + '<label style="display:flex;gap:6px;align-items:center;cursor:pointer"><input type="radio" name="lay-m" value="each" checked onchange="daLayPreview()"/> كل تانك في سكشن لوحده</label>'
    + '<label style="display:flex;gap:6px;align-items:center;cursor:pointer"><input type="radio" name="lay-m" value="n" onchange="daLayPreview()"/> <input id="lay-n" type="number" min="1" value="2" style="width:60px;padding:5px;border:1.5px solid var(--line);border-radius:6px" oninput="daLayPreview()"/> تانك في كل سكشن</label></div>'
    + '<div id="lay-prev" style="font-size:13px;max-height:220px;overflow:auto;background:#f8fafc;border-radius:8px;padding:8px 10px" dir="ltr"></div>'
    + '<div style="font-size:12px;color:var(--muted);margin:8px 0">الأسماء بتتغير للشكل الموحد، وكل السجلات (العلف والنفوق والعينات) بتنتقل مع كل تانك.</div>'
    + '<button id="lay-apply" class="savebtn" style="width:auto;padding:9px 20px" onclick="daLayApply()">✔ طبّق الترتيب</button>';
  daLayPreview(); el.scrollIntoView({behavior:'smooth', block:'start'});
}
function daLayMode(){ var r = document.querySelector('input[name="lay-m"]:checked'); return r ? r.value : 'each'; }
function daLayPreview(){
  var el = document.getElementById('lay-prev'); if(!el) return; var plan = daLayPlan(window._layFarm, daLayMode(), daVal('lay-n')), ch = plan.filter(function(x){ return x.from !== x.to; });
  var secs = {}; plan.forEach(function(x){ secs[x.to.split('T')[0]] = 1; });
  el.innerHTML = '<b>' + Object.keys(secs).length + ' سكشن · ' + ch.length + ' تانك هيتغير اسمه</b><br>' + plan.map(function(x){ return x.from === x.to ? x.from + ' (زي ما هو)' : x.from + ' → <b>' + x.to + '</b>'; }).join('<br>');
}
async function daLayApply(){
  var farm = window._layFarm, plan = daLayPlan(farm, daLayMode(), daVal('lay-n')).filter(function(x){ return x.from !== x.to; });
  if(!plan.length){ toast('الترتيب ده هو الحالي'); return; }
  if(!confirm('هيتغير اسم ' + plan.length + ' تانك في ' + farm + ' وكل سجلاتهم هتنتقل معاهم. تكمل؟')) return;
  var _cf = window.confirm; window.confirm = function(){ return true; };   // one confirmation for the whole layout
  daUnitsBusySet(true);   // no sync touches the tank list until this is done (any tab)
  try{
    var tmp = plan.map(function(x, i){ return {from:x.from, mid:farm + '.TMP' + Date.now() + '_' + i, to:x.to}; });
    for(var i = 0; i < tmp.length; i++) await daRenameUnit(tmp[i].from, tmp[i].mid);
    for(var j = 0; j < tmp.length; j++){ await daRenameUnit(tmp[j].mid, tmp[j].to); var u = daRawUnit(tmp[j].to); if(u){ u.farm = farm; u.section = tmp[j].to.split('T')[0]; } }
    var del = daUDel(); tmp.forEach(function(x){ [x.from, x.mid].forEach(function(n){ if(del.indexOf(n) < 0 && !tmp.some(function(y){ return y.to === n; })) del.push(n); }); });
    del = del.filter(function(n){ return !tmp.some(function(y){ return y.to === n; }); }); daUDelSet(del);
    await daPersistUnitsLocal(); try{ await saveUnitsToCloud(tmp.map(function(x){ return daRawUnit(x.to); }).filter(Boolean)); }catch(e){}
  } finally { window.confirm = _cf; daUnitsBusySet(false); }
  await daTmpCleanup(); await daUnitsFlush();
  _dataVer++; toast('✅ اتظبطت سكاشن ' + farm + ' — ' + plan.length + ' تانك'); show('farm-setup', true);
}
function daSettingsTanksCard(){   // Settings → Tanks: the farm's real tanks
  var farms = Object.keys(getFarmList()).filter(function(f){ return f !== 'all'; }), reg = getFarmsRegistry();
  var rows = farms.map(function(f){ var l = daLayTanks(f); if(!l.length) return '';
    var bySec = {}; l.forEach(function(u){ var t = daTankNo(u); var k = t ? t.s : 0; (bySec[k] = bySec[k] || []).push(t ? t.label : u); });
    return '<tr><td style="padding:6px 8px;vertical-align:top"><b>' + daEsc(f) + '</b>' + (reg[f] && reg[f] !== f ? '<br><span style="font-size:11px;color:var(--muted)">' + daEsc(reg[f]) + '</span>' : '') + '</td><td style="text-align:center;vertical-align:top">' + l.length + '</td><td style="text-align:center;vertical-align:top">' + Object.keys(bySec).length + '</td>'
      + '<td style="font-size:12px" dir="ltr">' + Object.keys(bySec).sort(function(a, b){ return a - b; }).map(function(k){ return '<b>S' + ('0' + k).slice(-2) + ':</b> ' + bySec[k].map(daEsc).join(', '); }).join('<br>') + '</td></tr>'; }).join('');
  return '<div class="card" id="st-tanks" style="margin-bottom:14px"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px"><div class="card-title" style="margin:0">🐠 تانكات المزارع</div>'
    + '<div style="display:flex;gap:8px"><button class="savebtn" style="width:auto;padding:8px 16px" onclick="window._daTaFocus=true;show(&quot;farm-setup&quot;)">➕ إضافة تانكات</button><button style="padding:8px 14px;border:1.5px solid var(--line);background:#fff;border-radius:8px;font:inherit;cursor:pointer" onclick="show(&quot;farm-setup&quot;)">🔧 إدارة التانكات والسكاشن</button></div></div>'
    + (rows ? '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px"><tr style="background:#f1f5f9"><th style="text-align:start;padding:6px 8px">المزرعة</th><th>التانكات</th><th>السكاشن</th><th style="text-align:start">حسب السكشن</th></tr>' + rows + '</table></div>'
      : '<div style="text-align:center;padding:24px;color:var(--muted)">مفيش تانكات لسه — اضغط ➕ إضافة تانكات.</div>') + '</div>';
}
if(!window._daLayWrapped){
  window._daLayWrapped = true;
  var _statusPreLay = daUnitsStatusCard;
  daUnitsStatusCard = async function(){ await _statusPreLay.apply(this, arguments);   // a "🔀 Sections" button per farm
    var el = document.getElementById('us-card'); if(!el) return;
    el.querySelectorAll('table tr').forEach(function(tr, i){ if(i === 0){ tr.insertAdjacentHTML('beforeend', '<th>السكاشن</th>'); return; }
      var f = (tr.querySelector('b') || {}).textContent; if(!f || !daLayTanks(f).length){ tr.insertAdjacentHTML('beforeend', '<td></td>'); return; }
      var secs = {}; daLayTanks(f).forEach(function(u){ var t = daTankNo(u); secs[t ? t.s : 0] = 1; });
      tr.insertAdjacentHTML('beforeend', '<td style="text-align:center">' + Object.keys(secs).length + ' <button class="lay-btn" data-farm="' + daEsc(f) + '" style="padding:3px 10px;border:1.5px solid var(--teal);color:var(--teal);background:#fff;border-radius:7px;font:inherit;font-size:12px;cursor:pointer" onclick="daLayOpen(this.dataset.farm)">🔀 ترتيب</button></td>'); }); };
  var _showPreLay = show;
  show = function(v){ var r = _showPreLay.apply(this, arguments);
    if(currentView === 'settings' && typeof settingsTab !== 'undefined' && settingsTab === 'units' && !document.getElementById('st-tanks')){
      var btn = Array.prototype.slice.call(document.querySelectorAll('#content button')).filter(function(b){ return /settingsAddUnitRow/.test(b.getAttribute('onclick') || ''); })[0], card = btn && btn.closest('.card');
      if(card){ card.insertAdjacentHTML('beforebegin', daSettingsTanksCard());
        if(!getFarmUnits().length) card.style.display = 'none';   // the old list: only while it still holds tanks
        else { var t = card.querySelector('.card-title'); if(t) t.textContent = '🗂️ تانكات قديمة (من الإعدادات) — انقلها من إعداد المزرعة ← حالة التانكات'; btn.style.display = 'none'; } } }
    return r; };
}
