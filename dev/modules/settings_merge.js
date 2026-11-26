// ══════════════════════════════════════════════════════════
//  SHARED SETTINGS: MERGE, NOT REPLACE (2026-11-26, test e2e_setrace)
//  The cloud row farm_settings.data is ONE blob of every synced key. Each push used to send the device's WHOLE local
//  copy → a device that had not pulled for ~2 min put back old values of settings other devices had just changed
//  (and the next pull spread the old value to them too). Now:
//  - every synced key written AFTER this session's first pull is marked as changed here (DA_SET_DIRTY, per device);
//  - a push reads the cloud copy first and writes only the changed keys onto it (deleted ones removed);
//  - a pull never overwrites a key changed here that has not reached the cloud yet;
//  - writes before the first pull (start-up defaults) are NOT marked, so a new device cannot overwrite real settings.
//  Same key edited on two devices: the later upload wins (as before). No SQL needed.
// ══════════════════════════════════════════════════════════
var DA_SET_DIRTY = 'daracqua_set_dirty_v1';   // not a synced key; wiped with the tenant
var _daSetSeq = 0, _settingsPushing = false;
function daSetDirtyMap(){ try{ return JSON.parse(localStorage.getItem(DA_SET_DIRTY) || '{}') || {}; }catch(e){ return {}; } }
function daSetDirtySave(m){ try{ _lsSetRaw.call(localStorage, DA_SET_DIRTY, JSON.stringify(m)); }catch(e){} }
function daScheduleSettingsPush(k, op){
  if(k && window._daSetReady){ var m = daSetDirtyMap(); m[k] = {op: op || 'set', n: Date.now() + '.' + (++_daSetSeq)}; daSetDirtySave(m); }
  if(_settingsPushTimer) clearTimeout(_settingsPushTimer);
  _settingsPushTimer = setTimeout(daPushSettings, 1500);
}
async function daPushSettings(){
  _settingsPushTimer = null;
  if(!sbReady || !SB_FARM_ID || !currentUser) return;
  if(_settingsPushing){ daScheduleSettingsPush(); return; }
  _settingsPushing = true;
  var dirty = daSetDirtyMap(), keys = Object.keys(dirty);
  try{
    var rows = await sbFetch('farm_settings?farm_id=eq.' + encodeURIComponent(SB_FARM_ID) + '&select=data');
    var base = rows && rows.length ? (rows[0].data || {}) : null, data;
    if(!base){   // no cloud copy yet (first device of the farm): seed it with everything here
      data = {};
      for(var i = 0; i < localStorage.length; i++){ var k = localStorage.key(i); if(daIsSyncedKey(k)) data[k] = localStorage.getItem(k); }
    } else {
      if(!keys.length) return;
      data = Object.assign({}, base);
      keys.forEach(function(k){ var v = localStorage.getItem(k); if(dirty[k].op === 'del' || v === null) delete data[k]; else data[k] = v; });
    }
    await sbFetch('farm_settings', {method:'POST', headers:{'Prefer':'resolution=merge-duplicates'}, body: JSON.stringify({farm_id:SB_FARM_ID, data:data, ts:new Date().toISOString()})});
    var now = daSetDirtyMap();   // a key changed again during the upload stays marked
    keys.forEach(function(k){ if(now[k] && now[k].n === dirty[k].n) delete now[k]; });
    daSetDirtySave(now);
  }catch(e){
    console.warn('settings push:', e.message);
    if(keys.length) setTimeout(function(){ daScheduleSettingsPush(); }, 30000);   // retry; the changes stay marked
  }finally{ _settingsPushing = false; }
}
async function daPullSettings(){
  if(!SB_FARM_ID) return;
  var rows = await sbFetch('farm_settings?farm_id=eq.' + encodeURIComponent(SB_FARM_ID) + '&select=data');
  window._daSetReady = true;
  if(!rows.length){ daScheduleSettingsPush(); return; }
  var d = rows[0].data || {}, dirty = daSetDirtyMap();
  _settingsPulling = true;
  try{ Object.keys(d).forEach(function(k){ if(daIsSyncedKey(k) && !dirty[k]) localStorage.setItem(k, d[k]); }); }
  finally{ _settingsPulling = false; }
  _unitsCache = null;
  if(Object.keys(dirty).length) daScheduleSettingsPush();   // changes from an earlier session (offline) still to upload
}
if(!window._daSetMergeWrapped){
  window._daSetMergeWrapped = true;
  var _flSetMerge = forceLogout;
  forceLogout = function(){ window._daSetReady = false; return _flSetMerge.apply(this, arguments); };
}
