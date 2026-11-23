// ══════════════════════════════════════════════════════════
//  "PLEASE RECORD THIS DAY" REMINDERS (owner, 2026-11-18)
// ══════════════════════════════════════════════════════════
// A reminder is a work order of kind "remind" {what: feed | wq, farm, date (the day to record), targets: uids or none}.
// Manual: on the entry status board, "📨 remind" next to what is missing → the site's workers who may record it
// (names to untick, a note) → their phones are notified. Automatic: every day at the set time (default 16:30, half an
// hour before the shift ends) the farm-push Worker creates the same reminder for every site whose feed / readings are
// fewer than the day before, and notifies those workers. The worker gets it in 🔔 with "📋 open the sheet" on that site
// and day; it closes by itself once the day is complete. The board shows who it went to, when, and when it was done.
var DA_REMIND_KEY = 'daracqua_settings_v2_remind';   // synced: {on, time:'HH:MM', feed, wq}
var DA_RM_T = {
  ar:{feed:'العلف', wq:'القياسات', rec:'سجّل', day:'يوم', open:'📋 افتح الشيت', auto:'⏰ تذكير تلقائي'},
  en:{feed:'feed', wq:'readings', rec:'Record', day:'for', open:'📋 Open the sheet', auto:'⏰ Automatic reminder'},
  ur:{feed:'فیڈ', wq:'پانی کی جانچ', rec:'درج کریں', day:'دن', open:'📋 شیٹ کھولیں', auto:'⏰ خودکار یاد دہانی'}};
function daRmT(){ var l = typeof daLangNow === 'function' ? daLangNow() : (isAr ? 'ar' : 'en'); return DA_RM_T[l] || DA_RM_T.ar; }
function daRmCfg(){ var c = {}; try{ c = JSON.parse(localStorage.getItem(DA_REMIND_KEY) || '{}') || {}; }catch(e){} if(c.on === undefined) c.on = true; if(!c.time) c.time = '16:30'; if(c.feed === undefined) c.feed = true; if(c.wq === undefined) c.wq = true; return c; }
function daRmLabel(o, T){ T = T || daRmT(); return '📝 ' + T.rec + ' ' + (T[o.what] || o.what) + ' ' + o.farm + ' ' + T.day + ' ' + o.date; }
function daRmPerm(what){ return what === 'wq' ? 'input_wq' : 'input_feeding'; }
function daRmDone(o){ if(typeof daEsFarm !== 'function') return false; var s = daEsFarm(o.farm, o.date); return o.what === 'wq' ? s.secs > 0 && s.wq >= s.secs : s.tanks > 0 && s.fed >= s.tanks; }
function daRmFor(farm, date, what){ return (typeof daWoAll === 'function' ? daWoAll() : []).filter(function(o){ return o.kind === 'remind' && o.farm === farm && o.date === date && o.what === what; }); }
async function daRmPeople(farm, what){   // the site's active workers who may record that (names come from the farm's profiles)
  var rows = []; try{ rows = await sbFetch('profiles?select=id,name,email,role,perms,active') || []; }catch(e){ return null; }
  var perm = daRmPerm(what);
  return rows.filter(function(p){ var ps = Array.isArray(p.perms) ? p.perms : []; var sites = ps.filter(function(x){ return /^farm:/.test(x); }).map(function(x){ return x.slice(5); });
    return p.role === 'worker' && p.active !== false && ps.indexOf(perm) >= 0 && (!sites.length || sites.indexOf(farm) >= 0); })
    .map(function(p){ return {uid:p.id, name:p.name || String(p.email || '').split('@')[0]}; });
}
async function daRmOpen(farm, date, what){
  var old = document.getElementById('rm-panel'); if(old) old.remove();
  var host = document.querySelector('.es-farm[data-farm="' + farm + '"]'); if(!host) return;
  host.insertAdjacentHTML('beforeend', '<div id="rm-panel" style="margin-top:10px;padding:10px;border:2px solid var(--teal);border-radius:10px;background:#f0fdfa">…</div>');
  var ppl = await daRmPeople(farm, what), el = document.getElementById('rm-panel'); if(!el) return;
  window._rm = {farm:farm, date:date, what:what, ppl:ppl};
  el.innerHTML = '<b>📨 تذكير: ' + DA_RM_T.ar[what] + ' ' + daEsc(farm) + ' يوم ' + daEsc(date) + '</b>'
    + (ppl === null ? '<div style="font-size:12px;color:var(--muted);margin:6px 0">هيوصل لكل عمال ' + daEsc(farm) + ' اللي معاهم صلاحية تسجيل ' + DA_RM_T.ar[what] + '.</div>'
      : ppl.length ? '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0">' + ppl.map(function(p){ return '<label style="display:flex;gap:5px;align-items:center;padding:5px 10px;background:#fff;border:1px solid var(--line);border-radius:8px;cursor:pointer"><input type="checkbox" class="rm-who" value="' + daEsc(p.uid) + '" checked/> ' + daEsc(p.name) + '</label>'; }).join('') + '</div>'
      : '<div style="font-size:12px;color:#b45309;margin:6px 0">مفيش عامل في ' + daEsc(farm) + ' معاه صلاحية تسجيل ' + DA_RM_T.ar[what] + ' — ادّيها لحد من إدارة المستخدمين.</div>')
    + '<input id="rm-note" placeholder="ملاحظة (اختياري) — مثلاً: ناقص سكشن 4 و5" style="width:100%;padding:8px;border:1.5px solid var(--line);border-radius:8px;font:inherit;margin-bottom:8px"/>'
    + '<button id="rm-send" class="savebtn" style="width:auto;padding:9px 20px" onclick="daRmSend()"' + (ppl && !ppl.length ? ' disabled' : '') + '>📨 ابعت</button> <button onclick="document.getElementById(&quot;rm-panel&quot;).remove()" style="padding:9px 14px;border:1.5px solid var(--line);background:#fff;border-radius:8px;font:inherit;cursor:pointer">إلغاء</button>';
}
function daRmSend(){
  var r = window._rm; if(!r) return; var uids = Array.prototype.slice.call(document.querySelectorAll('.rm-who:checked')).map(function(e){ return e.value; });
  if(r.ppl && r.ppl.length && !uids.length){ toast('⚠️ اختار عامل واحد على الأقل'); return; }
  var names = (r.ppl || []).filter(function(p){ return uids.indexOf(p.uid) >= 0; }).map(function(p){ return p.name; });
  addTX({id:'rm-' + r.farm + '-' + r.date + '-' + r.what + '-' + Date.now().toString(36), type:'work_order', date:r.date, unit:'', farm:r.farm, kind:'remind', what:r.what, tanks:[], text:String(daVal('rm-note') || '').trim(),
    targets:uids.length ? uids : null, targetNames:names, status:'open', issued:daToday(), _skipValidation:true});
  var note = String(daVal('rm-note') || '').trim(), rec = {farm:r.farm, date:r.date, what:r.what};
  var msg = typeof daPushMsg === 'function' ? daPushMsg(function(l){ return {t:{ar:'📝 تذكير بالتسجيل', en:'📝 Please record', ur:'📝 درج کرنے کی یاد دہانی'}[l], b:daRmLabel(rec, DA_RM_T[l]) + (note ? ' — ' + note : '')}; }) : null;
  if(typeof daPushCall === 'function') daPushCall('/notify', uids.length ? {audience:'users', uids:uids, msg:msg} : {farm:r.farm, audience:'perm', perm:daRmPerm(r.what), msg:msg});
  toast('📨 اتبعت التذكير' + (names.length ? ' لـ ' + names.join('، ') : '')); window._rm = null; show('entry-status', true);
}
function daRmStatusHtml(farm, date, what){
  var L = daRmFor(farm, date, what); if(!L.length) return '';
  var hm = function(x){ var d = x ? new Date(x) : null; return d && !isNaN(d) ? ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) : ''; };
  return L.map(function(o){ return '<div class="rm-status" style="font-size:11px;margin-top:3px;color:' + (o.status === 'done' ? 'var(--green)' : '#b45309') + '">' + (o.auto ? '⏰ تلقائي' : '📨 اتبعت') + (o.targetNames && o.targetNames.length ? ' لـ ' + daEsc(o.targetNames.join('، ')) : '') + ' ' + hm(o.ts)
    + (o.status === 'done' ? ' · ✅ اتسجل ' + hm(o.doneAt) : '') + '</div>'; }).join('');
}
function daRmCfgHtml(){ var c = daRmCfg(), on = c.on;
  return '<div class="card" id="rm-cfg" style="margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><div><b>⏰ التذكير التلقائي</b> <span style="font-size:12px;color:var(--muted)">كل يوم الساعة <input type="time" id="rm-time" value="' + daEsc(c.time) + '" style="padding:3px 6px;border:1px solid var(--line);border-radius:6px" onchange="daRmCfgSet(&quot;time&quot;,this.value)"/> — للمواقع اللي علفها أو قياساتها ناقصة عن امبارح</span></div>'
    + '<button id="rm-auto" onclick="daRmCfgSet(&quot;on&quot;,' + (!on) + ')" style="min-width:90px;padding:8px 14px;border-radius:99px;border:2px solid ' + (on ? 'var(--teal)' : 'var(--line)') + ';background:' + (on ? 'var(--teal);color:#fff' : '#fff;color:var(--muted)') + ';font:inherit;font-weight:800;cursor:pointer">' + (on ? '✅ شغّال' : '⏸ مقفول') + '</button></div>'; }
function daRmCfgSet(k, v){ var c = daRmCfg(); c[k] = v; localStorage.setItem(DA_REMIND_KEY, JSON.stringify(c)); toast('✅ اتحفظ'); show('entry-status', true); }
if(!window._daRmWrapped){
  window._daRmWrapped = true;
  if(typeof daWoLabel === 'function'){ var _lblPreRm = daWoLabel; daWoLabel = function(o, T){ return o && o.kind === 'remind' ? daRmLabel(o, (T === DA_WO_T.en ? DA_RM_T.en : T === DA_WO_T.ur ? DA_RM_T.ur : T === DA_WO_T.ar ? DA_RM_T.ar : null)) : _lblPreRm.apply(this, arguments); }; }
  if(typeof daWoMine === 'function'){ var _minePreRm = daWoMine; daWoMine = function(){ var me = typeof daPushUid === 'function' ? daPushUid() : ''; return _minePreRm.apply(this, arguments).filter(function(o){ return !(o.targets && o.targets.length) || currentUserRole !== 'worker' || o.targets.indexOf(me) >= 0; }); }; }
  if(typeof daWoSweep === 'function'){ var _swPreRm = daWoSweep; daWoSweep = function(){ var n = _swPreRm.apply(this, arguments);
    daWoAll().forEach(function(o){ if(o.kind === 'remind' && o.status === 'open' && daRmDone(o)){ updateTX(o.id, {status:'done', reply:'اتسجل', doneAt:new Date().toISOString()}); n++; } });
    if(n) _dataVer++; return n; }; }
  if(typeof renderWoMine === 'function'){ var _womPreRm = renderWoMine; renderWoMine = function(){ var h = _womPreRm.apply(this, arguments), T = daRmT();
    daWoMine().filter(function(o){ return o.kind === 'remind' && o.status === 'open'; }).forEach(function(o){
      var btn = '<button class="rm-open" onclick="' + (o.what === 'wq' ? 'window._wqs={farm:&quot;' + o.farm + '&quot;,date:&quot;' + o.date + '&quot;,mode:&quot;daily&quot;};show(&quot;wq-sheet&quot;)' : 'window._fs={farm:&quot;' + o.farm + '&quot;,date:&quot;' + o.date + '&quot;};show(&quot;feed-sheet&quot;)') + '" style="width:100%;margin-top:8px;padding:12px;border:0;border-radius:10px;background:#0369a1;color:#fff;font:inherit;font-weight:800;font-size:16px;cursor:pointer">' + T.open + '</button>';
      h = h.replace('data-id="' + o.id + '" style="', 'data-id="' + o.id + '" data-rm="1" style="').replace(new RegExp('(data-id="' + o.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '" data-rm="1"[\\s\\S]*?)(<div style="display:flex;gap:8px;margin-top:10px">)'), '$1' + btn + '$2'); });
    return h; }; VIEWS['wo-mine'] = renderWoMine; }
  var _showPreRm = show;
  show = function(v){ var r = _showPreRm.apply(this, arguments);
    try{ if(currentView === 'entry-status' && typeof daWoCanIssue === 'function' && daWoCanIssue()){ var d = (window._es || {}).date || daToday();
      if(currentUserRole === 'admin' && !document.getElementById('rm-cfg')){ var ph = document.querySelector('#content .ph'); if(ph) ph.insertAdjacentHTML('afterend', daRmCfgHtml()); }
      document.querySelectorAll('.es-farm').forEach(function(card){ var f = card.dataset.farm;
        [['feed', '.es-miss-feed', '.es-open-feed'], ['wq', '.es-miss-wq', '.es-open-wq']].forEach(function(x){
          var miss = card.querySelector(x[1]), anchor = miss || card.querySelector(x[2]); if(!anchor || card.querySelector('.rm-btn[data-w="' + x[0] + '"]')) return;
          var st = daRmStatusHtml(f, d, x[0]);
          anchor.insertAdjacentHTML('afterend', (miss ? '<button class="rm-btn" data-w="' + x[0] + '" onclick="daRmOpen(&quot;' + daEsc(f) + '&quot;,&quot;' + d + '&quot;,&quot;' + x[0] + '&quot;)" style="margin-top:6px;margin-inline-start:6px;padding:5px 12px;border:1.5px solid #0369a1;color:#0369a1;background:#fff;border-radius:7px;font:inherit;font-size:12px;font-weight:800;cursor:pointer">📨 ذكّره</button>' : '') + st); }); }); } }catch(e){}
    return r; };
}
