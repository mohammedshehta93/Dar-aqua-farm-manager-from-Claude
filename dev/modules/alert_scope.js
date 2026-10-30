// ══════════════════════════════════════════════════════════
//  ALERT LIMITS PER FARM, WITH A VISIBLE SCOPE
// ══════════════════════════════════════════════════════════
// Settings are stored per farm (…_F1, …_F2) plus a global set (…_global). The alerts used ONE settings object for all
// tanks, chosen by a hidden "current settings farm", and a farm's settings without a given limit did not fall back to
// the global one → limits saved on the alert page often never applied. Now: each tank is judged by its own farm's
// limit → else the global limit → else the default; and the alert page shows/edits an explicit scope.
var DA_LIM_KEYS = {densAlarm:'densAlarm', densWarn:'densWarn', cntAlarm:'cntAlarm', cntWarn:'cntWarn', frLow:'frLow', frHigh:'frHigh',
  mortCrit:'mortCrit', mortWarn:'mortWarn', doCrit:'doCrit', doWarn:'doWarn', ammCrit:'ammCrit', ammWarn:'ammWarn', phLo:'phMin', phHi:'phMax',
  sgrSlow:'sgrSlow', tempHi:'tempHi', tempLo:'tempLo'};
var DA_LIM_DEF = {densAlarm:25, densWarn:15, cntAlarm:120, cntWarn:80, frLow:60, frHigh:150, mortCrit:1, mortWarn:0.3, doCrit:4, doWarn:5,
  ammCrit:0.5, ammWarn:0.1, phLo:6.5, phHi:9, sgrSlow:0.5, tempHi:32, tempLo:22};
function daRawSettings(scope){ try{ return JSON.parse(localStorage.getItem(_settingsKey(!scope || scope === 'global' ? 'all' : scope)) || '{}') || {}; }catch(e){ return {}; } }
var _limMemo = {v:-1, m:{}};
function daFarmLIM(farm){
  if(_limMemo.v !== _dataVer) _limMemo = {v:_dataVer, m:{}};
  if(_limMemo.m[farm]) return _limMemo.m[farm];
  var f = farm ? daRawSettings(farm) : {}, g = daRawSettings('global'), o = {};
  Object.keys(DA_LIM_KEYS).forEach(function(k){ var c = DA_LIM_KEYS[k], v = parseFloat(f[c]); if(isNaN(v)) v = parseFloat(g[c]); o[k] = isNaN(v) || v <= 0 && k !== 'tempLo' ? DA_LIM_DEF[k] : v; });
  return (_limMemo.m[farm] = o);
}
function daAlsScope(){ var s = window._alsScope; if(!s) s = farmFilter && farmFilter !== 'all' ? farmFilter : 'global'; return s; }
function daAlsScopeBar(){
  var sc = daAlsScope(), inp = 'padding:7px 10px;border:1.5px solid var(--line);border-radius:8px;font:inherit;font-size:13px';
  var own = sc !== 'global' && Object.keys(daRawSettings(sc)).some(function(k){ return ['densAlarm', 'densWarn', 'doCrit', 'tempHi'].indexOf(k) >= 0; });
  return '<div class="card" style="margin-bottom:14px;display:flex;gap:10px;flex-wrap:wrap;align-items:center"><b>الحدود دي لـ:</b>'
    + '<select id="als-scope" style="' + inp + '" onchange="window._alsScope=this.value;show(&quot;alert-settings&quot;,true)"><option value="global"' + (sc === 'global' ? ' selected' : '') + '>كل المزارع</option>'
    + daFarms().map(function(f){ return '<option value="' + daEsc(f) + '"' + (f === sc ? ' selected' : '') + '>' + daEsc(f) + ' بس</option>'; }).join('') + '</select>'
    + '<span style="font-size:12px;color:var(--muted)">' + (sc === 'global' ? 'بتتطبق على أي مزرعة ملهاش حدود خاصة.' : own ? 'المزرعة دي ليها حدود خاصة — بتتقدم على "كل المزارع".' : 'المزرعة دي بتستخدم حدود "كل المزارع" لحد ما تحفظ هنا.') + '</span></div>';
}
