// ══════════════════════════════════════════════════════════
//  TANKS ALWAYS REACH THE CLOUD · DELETED EVERYWHERE (owner, 2026-11-09)
// ══════════════════════════════════════════════════════════
// Found: saveUnitsToCloud returned SILENTLY when the cloud link was not ready, and a failed upload was never retried —
// worse, the next sync replaced the device's tank list with the cloud's and the new tanks vanished (or, on a device whose
// list matched at start, stayed there only: shown on the computer, never on the phones). Deleting a farm kept its tanks;
// deleting a tank in one list left it in the other. Now: tanks not uploaded are kept in a per-device queue (with their
// data) and retried before every sync; a sync never drops a queued tank; deletions that did not reach the cloud are
// queued too; deleting a tank removes it from every list and the cloud; deleting a farm offers to delete its tanks.
// Farm setup shows each farm's tanks: in the cloud / waiting / old Settings tanks (one click moves them to the main list).
var DA_UPEND = 'daracqua_units_pending', DA_UDEL = 'daracqua_units_pending_del';
function daUPend(){ try{ return JSON.parse(localStorage.getItem(DA_UPEND) || '{}') || {}; }catch(e){ return {}; } }
function daUPendSet(o){ try{ localStorage.setItem(DA_UPEND, JSON.stringify(o)); }catch(e){} }
function daUDel(){ try{ return JSON.parse(localStorage.getItem(DA_UDEL) || '[]') || []; }catch(e){ return []; } }
function daUDelSet(a){ try{ localStorage.setItem(DA_UDEL, JSON.stringify(a)); }catch(e){} }
async function daUnitsFlush(){   // retry what did not reach the cloud (adds, then deletions)
  if(!sbReady || !SB_FARM_ID || !navigator.onLine) return false;
  var p = daUPend(), names = Object.keys(p), ok = true;
  if(names.length){ var list = names.map(function(n){ return RAW.filter(function(u){ return u.unit === n; })[0] || p[n]; });
    try{ await _saveUnitsPreUS(list); daUPendSet({}); }catch(e){ ok = false; } }
  var d = daUDel(), left = [];
  for(var i = 0; i < d.length; i++){ try{ await sbFetch('farm_units?id=eq.' + encodeURIComponent(SB_FARM_ID + ':' + d[i]), {method:'DELETE'}); }catch(e){ left.push(d[i]); ok = false; } }
  daUDelSet(left); return ok;
}
async function daUnitDeleteEverywhere(name){
  var i = RAW.findIndex(function(u){ return u.unit === name; }); if(i >= 0) RAW.splice(i, 1);
  var fu = getFarmUnits(), fu2 = fu.filter(function(u){ return u.name !== name; }); if(fu2.length !== fu.length) saveFarmUnits(fu2);
  var p = daUPend(); if(p[name]){ delete p[name]; daUPendSet(p); }
  _valCache = {t:0, map:{}}; await daPersistUnitsLocal();
  try{ if(!sbReady || !SB_FARM_ID) throw new Error('offline'); await sbFetch('farm_units?id=eq.' + encodeURIComponent(SB_FARM_ID + ':' + name), {method:'DELETE'}); }
  catch(e){ var d = daUDel(); if(d.indexOf(name) < 0){ d.push(name); daUDelSet(d); } }
}
function daFarmTanks(farm){   // every tank of a farm, from both lists
  var o = {}; RAW.forEach(function(u){ if(u.farm === farm || String(u.unit).indexOf(farm + '.') === 0) o[u.unit] = 'main'; });
  getFarmUnits().forEach(function(u){ if(u.name && u.farm === farm && !o[u.name]) o[u.name] = 'old'; }); return o;
}
async function daMoveOldTanks(farm){   // Settings' old tanks → the main list (same names: their records stay linked)
  var fu = getFarmUnits(), moved = [];
  fu.forEach(function(c){ if(!c.name || (farm && c.farm !== farm) || RAW.some(function(r){ return r.unit === c.name; })) return;
    var aw = parseFloat(c.avgWt) || parseFloat(c.startWt) || 0, fish = parseInt(c.fishNo) || 0, vol = parseFloat(c.volume || c.vol) || 0, f = c.farm || String(c.name).split('.')[0];
    var u = {unit:c.name, farm:f, section:daSecFix(c.section || String(c.name).split('.').slice(0, 2).join('.'), f), batch:c.batch || '', species:'Silver Tilapia', hatchery:'', startDate:c.stockDate || c.startDate || daToday(),
      fishNo:fish, startWt:parseFloat(c.startWt) || aw, avgWt:aw, biomass:fish * aw / 1000, density:vol ? fish * aw / 1000 / vol : 0, volume:vol, mortality:0, survival:100, feedKg:0, alarm:false, warn:false};
    RAW.push(u); moved.push(u); });
  if(!moved.length) return 0;
  saveFarmUnits(fu.filter(function(c){ return !moved.some(function(m){ return m.unit === c.name; }); }));
  _valCache = {t:0, map:{}}; await daPersistUnitsLocal(); try{ await saveUnitsToCloud(moved); }catch(e){}
  return moved.length;
}
async function daUnitsStatusCard(){
  var el = document.getElementById('us-card'); if(!el) return;
  var cloud = null; try{ if(sbReady && SB_FARM_ID) cloud = (await sbFetch('farm_units?farm_id=eq.' + encodeURIComponent(SB_FARM_ID) + '&select=unit') || []).map(function(r){ return r.unit; }); }catch(e){}
  var farms = Object.keys(getFarmList()).filter(function(f){ return f !== 'all'; }), p = daUPend(), reg = getFarmsRegistry();
  getFarmUnits().forEach(function(u){ if(u.farm && farms.indexOf(u.farm) < 0) farms.push(u.farm); });
  var rows = farms.map(function(f){ var t = daFarmTanks(f), names = Object.keys(t), main = names.filter(function(n){ return t[n] === 'main'; }), old = names.filter(function(n){ return t[n] === 'old'; });
    var up = cloud ? main.filter(function(n){ return cloud.indexOf(n) >= 0; }).length : null, wait = main.filter(function(n){ return p[n] || (cloud && cloud.indexOf(n) < 0); }).length;
    return '<tr><td style="padding:6px 8px"><b>' + daEsc(f) + '</b>' + (reg[f] && reg[f] !== f ? ' — ' + daEsc(reg[f]) : '') + '</td><td style="text-align:center">' + main.length + '</td>'
      + '<td style="text-align:center;color:var(--green)">' + (up === null ? '—' : '☁️ ' + up) + '</td><td style="text-align:center;color:' + (wait ? 'var(--amber);font-weight:800' : 'var(--muted)') + '">' + (wait ? '⏳ ' + wait : '0') + '</td>'
      + '<td style="text-align:center;color:' + (old.length ? 'var(--amber);font-weight:800' : 'var(--muted)') + '">' + (old.length ? '⚠️ ' + old.length : '0') + '</td></tr>'; }).join('');
  var anyWait = /⏳/.test(rows), anyOld = /⚠️/.test(rows);
  el.innerHTML = '<div class="card-title">📋 حالة التانكات</div><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px"><tr style="background:#f1f5f9"><th style="text-align:start;padding:6px 8px">المزرعة</th><th>التانكات</th><th>على السحابة (بتوصل للموبايلات)</th><th>مستنية تترفع</th><th>قديمة من الإعدادات</th></tr>' + rows + '</table></div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">' + (anyWait ? '<button id="us-flush" class="savebtn" style="width:auto;padding:8px 16px" onclick="daUsFlushNow()">⬆️ ارفع دلوقتي</button>' : '')
    + (anyOld ? '<button id="us-move" class="savebtn" style="width:auto;padding:8px 16px;background:var(--amber)" onclick="daUsMoveNow()">🔄 انقل التانكات القديمة للقايمة الأساسية</button>' : '') + '</div>'
    + (cloud === null ? '<div style="font-size:12px;color:var(--amber);margin-top:6px">مش متصل بالسحابة دلوقتي — الحالة هتبان لما الاتصال يرجع.</div>' : '');
}
async function daUsFlushNow(){ var ok = await daUnitsFlush(); toast(ok ? '✅ اترفعت — هتظهر في الموبايلات بعد 🔄' : '⚠️ لسه مش قادر يرفع — اتأكد من الإنترنت وجرب تاني'); show('farm-setup', true); }
async function daUsMoveNow(){ var n = await daMoveOldTanks(null); toast(n ? '✅ اتنقل ' + n + ' تانك للقايمة الأساسية — نفس الأسماء، والسجلات زي ما هي' : 'مفيش تانكات قديمة'); show('farm-setup', true); }
if(!window._daUsWrapped){
  window._daUsWrapped = true;
  var _saveUnitsPreUS = saveUnitsToCloud;
  saveUnitsToCloud = async function(units){   // never silent: not ready or failed → queued with their data
    var p = daUPend(); (units || []).forEach(function(u){ if(u && u.unit) p[u.unit] = u; }); daUPendSet(p);
    if(!sbReady || !SB_FARM_ID || !navigator.onLine) throw new Error('offline');
    await _saveUnitsPreUS(units);
    var q = daUPend(); (units || []).forEach(function(u){ if(u) delete q[u.unit]; }); daUPendSet(q);
  };
  var _pullUnitsPreUS = daPullUnitsIfChanged;
  daPullUnitsIfChanged = async function(){
    await daUnitsFlush();
    var r = await _pullUnitsPreUS.apply(this, arguments);
    var p = daUPend(), d = daUDel(), add = Object.keys(p).filter(function(n){ return !RAW.some(function(u){ return u.unit === n; }); }), drop = RAW.filter(function(u){ return d.indexOf(u.unit) >= 0; });
    if(add.length || drop.length){ add.forEach(function(n){ RAW.push(p[n]); }); drop.forEach(function(u){ RAW.splice(RAW.indexOf(u), 1); }); _valCache = {t:0, map:{}}; await daPersistUnitsLocal(); r = true; }
    return r;
  };
  daDeleteUnit = async function(unit){
    if(!confirm('حذف التانك ' + unit + '؟ المعاملات بتاعته هتفضل في السجل.')) return;
    await daUnitDeleteEverywhere(unit); toast('🗑 اتحذف ' + unit); show('farm-setup', true);
  };
  unitDeleteFromSetup = function(uid){
    var u = getFarmUnits().filter(function(x){ return x.id === uid; })[0]; if(!u){ return; } if(!confirm('حذف التانك ' + (u.name || '') + '؟')) return;
    var fu = getFarmUnits().filter(function(x){ return x.id !== uid; }); saveFarmUnits(fu); if(u.name) daUnitDeleteEverywhere(u.name);
    _txCache = null; toast('🗑 اتحذف التانك'); show('settings');
  };
  farmRegDelete = async function(fid){
    var t = Object.keys(daFarmTanks(fid));
    if(!confirm('حذف المزرعة ' + fid + '؟' + (t.length ? '\n\nفيها ' + t.length + ' تانك — هيتحذفوا كمان من كل الأجهزة. المعاملات بتفضل في السجل.' : ''))) return;
    for(var i = 0; i < t.length; i++) await daUnitDeleteEverywhere(t[i]);
    var reg = getFarmsRegistry(); delete reg[fid]; saveFarmsRegistry(reg); if(typeof buildFarmDD === 'function') buildFarmDD();
    toast('🗑 اتحذفت المزرعة ' + fid + (t.length ? ' و' + t.length + ' تانك' : '')); show(currentView, true);
  };
  var _showPreUS = show;
  show = function(v){ var r = _showPreUS.apply(this, arguments);
    if(currentView === 'farm-setup' && !document.getElementById('us-card')){ var ta = document.getElementById('ta-card');
      if(ta){ ta.insertAdjacentHTML('beforebegin', '<div class="card" id="us-card" style="margin-bottom:14px"><div class="card-title">📋 حالة التانكات</div><div style="color:var(--muted);font-size:12px">بيحمّل…</div></div>'); daUnitsStatusCard(); } }
    return r; };
}
