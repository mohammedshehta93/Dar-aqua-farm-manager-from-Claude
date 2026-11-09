// ══════════════════════════════════════════════════════════
//  ADDING TANKS — one clear place, the section is required (owner, 2026-11-09)
// ══════════════════════════════════════════════════════════
// Tanks were added in two places with free-text names: Farm setup ("add a unit by hand", section optional, empty tanks
// not allowed) and Settings ("new tank", NO section at all — the nursery's tanks came from there and the sheets could not
// place them). Now: one "➕ Add tanks" card in Farm setup — farm (or a new farm: code + name), section (required, the
// farm's sections shown, next one suggested), how many tanks + first number, volume, with fish or empty — names are made
// in the standard form (F3.S01T01 …) and shown before saving; existing names are skipped. Settings' "new tank" opens it.
// Tanks already added without a section are listed with a one-click "put them in section …" (names kept, records stay).
function daTaSecs(farm){ var o = {}; _txLiveRows().forEach(function(r){ if(r.farm !== farm) return; var n = daSecNo(r.section || ''); if(n !== null) o[n] = (o[n] || 0) + 1; }); return o; }
function daTaPad(n){ return ('0' + n).slice(-2); }
function daTaNames(){
  var f = daTaFarm(), sec = parseInt(daVal('ta-sec'), 10), n = parseInt(daVal('ta-n'), 10), t0 = parseInt(daVal('ta-t0'), 10);
  if(!f || !(sec > 0) || !(n > 0) || !(t0 > 0)) return [];
  var out = []; for(var i = 0; i < Math.min(n, 60); i++) out.push(f + '.S' + daTaPad(sec) + 'T' + daTaPad(t0 + i)); return out;
}
function daTaFarm(){ var v = daVal('ta-farm'); return v === '__new' ? daVal('ta-newcode').trim().toUpperCase().replace(/[^A-Z0-9]/g, '') : v; }
function daTaNextTank(farm, sec){ var mx = 0; _txLiveRows().forEach(function(r){ if(r.farm === farm && daSecNo(r.section || '') === sec){ var t = daTankNo(r.unit); if(t && t.t > mx) mx = t.t; } }); return mx + 1; }
function daTaExisting(){ var e = {}; RAW.forEach(function(u){ e[u.unit] = 1; }); getFarmUnits().forEach(function(u){ if(u.name) e[u.name] = 1; }); return e; }
function daTaRefresh(changed){
  var f = daTaFarm(), box = document.getElementById('ta-new'); if(box) box.style.display = daVal('ta-farm') === '__new' ? 'flex' : 'none';
  var secs = f ? daTaSecs(f) : {}, keys = Object.keys(secs).map(Number).sort(function(a, b){ return a - b; });
  var info = document.getElementById('ta-secinfo'); if(info) info.textContent = keys.length ? 'السكاشن الموجودة: ' + keys.map(function(k){ return 'S' + daTaPad(k) + ' (' + secs[k] + ')'; }).join('، ') : 'مفيش سكاشن لسه في المزرعة دي';
  var secEl = document.getElementById('ta-sec'), t0El = document.getElementById('ta-t0');
  if(changed === 'farm' && secEl){ secEl.value = keys.length ? keys[keys.length - 1] + 1 : 1; }
  if((changed === 'farm' || changed === 'sec') && t0El){ var sv = parseInt(daVal('ta-sec'), 10); t0El.value = sv > 0 && f ? daTaNextTank(f, sv) : 1; }
  var fishOn = document.getElementById('ta-hasfish') && document.getElementById('ta-hasfish').checked, fb = document.getElementById('ta-fishbox'); if(fb) fb.style.display = fishOn ? 'grid' : 'none';
  var names = daTaNames(), ex = daTaExisting(), pv = document.getElementById('ta-preview');
  if(pv){ if(!names.length){ pv.innerHTML = '<span style="color:var(--muted)">اختار المزرعة والسكشن والعدد.</span>'; }
    else { var dup = names.filter(function(n){ return ex[n]; }), add = names.filter(function(n){ return !ex[n]; });
      pv.innerHTML = '<b>هيتضاف ' + add.length + ' تانك:</b> <span dir="ltr">' + (add.length > 4 ? add[0] + ' … ' + add[add.length - 1] : add.join('، ')) + '</span>' + (dup.length ? '<div style="color:var(--amber);margin-top:4px">⚠️ موجودين قبل كده وهيتسابوا: ' + dup.join('، ') + '</div>' : ''); } }
}
function daTaCard(){
  var farms = Object.keys(getFarmList()).filter(function(f){ return f !== 'all'; }), reg = getFarmsRegistry(), inp = 'padding:8px 10px;border:1.5px solid var(--line);border-radius:8px;font:inherit;font-size:14px;width:100%';
  var fld = function(label, ctl){ return '<div class="field" style="margin:0"><label>' + label + '</label>' + ctl + '</div>'; };
  return '<div class="card-title">➕ إضافة تانكات</div><div style="font-size:12px;color:var(--muted);margin-bottom:10px">كل تانك لازم يبقى في سكشن — الأسماء بتتعمل لوحدها بالشكل الموحد (زي F3.S01T01).</div>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;align-items:end">'
    + fld('المزرعة *', '<select id="ta-farm" style="' + inp + '" onchange="daTaRefresh(\'farm\')"><option value="">— اختار —</option>' + farms.map(function(f){ return '<option value="' + daEsc(f) + '">' + daEsc(f) + (reg[f] && reg[f] !== f ? ' — ' + daEsc(reg[f]) : '') + '</option>'; }).join('') + '<option value="__new">➕ مزرعة جديدة…</option></select>')
    + '<div id="ta-new" style="display:none;gap:8px;grid-column:1/-1">' + fld('كود المزرعة الجديدة *', '<input id="ta-newcode" placeholder="مثلاً F3" style="' + inp + '" oninput="daTaRefresh(\'farm\')"/>') + fld('اسمها', '<input id="ta-newname" placeholder="مثلاً Nursery" style="' + inp + '"/>') + '</div>'
    + fld('السكشن *', '<input id="ta-sec" type="number" min="1" step="1" style="' + inp + '" oninput="daTaRefresh(\'sec\')"/>')
    + fld('عدد التانكات *', '<input id="ta-n" type="number" min="1" max="60" value="1" style="' + inp + '" oninput="daTaRefresh()"/>')
    + fld('أول رقم تانك', '<input id="ta-t0" type="number" min="1" value="1" style="' + inp + '" oninput="daTaRefresh()"/>')
    + fld('حجم التانك م³', '<input id="ta-vol" type="number" step="any" value="10" style="' + inp + '"/>') + '</div>'
    + '<div id="ta-secinfo" style="font-size:12px;color:var(--muted);margin-top:6px"></div>'
    + '<label style="display:flex;align-items:center;gap:8px;margin:12px 0 6px;font-weight:700;cursor:pointer"><input type="checkbox" id="ta-hasfish" onchange="daTaRefresh()" style="width:18px;height:18px"/> فيها سمك دلوقتي؟ <span style="font-weight:400;font-size:12px;color:var(--muted)">(من غير علامة = تانكات فاضية، بتتخزن بعدين)</span></label>'
    + '<div id="ta-fishbox" style="display:none;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px">'
    + fld('عدد السمك في كل تانك *', '<input id="ta-fish" type="number" style="' + inp + '"/>') + fld('متوسط الوزن جم *', '<input id="ta-wt" type="number" step="any" style="' + inp + '"/>')
    + fld('تاريخ التخزين *', '<input id="ta-date" type="date" value="' + daToday() + '" max="' + daToday() + '" style="' + inp + '"/>') + fld('الدفعة', '<input id="ta-batch" style="' + inp + '"/>') + '</div>'
    + '<div id="ta-preview" style="margin:12px 0;padding:10px 12px;background:#f0fdfa;border-radius:8px;font-size:13px"></div>'
    + '<button id="ta-save" class="savebtn" style="width:auto;padding:10px 22px" onclick="daTaSave()">➕ أضف التانكات</button>';
}
async function daTaSave(){
  var f = daTaFarm(), sec = parseInt(daVal('ta-sec'), 10), names = daTaNames(), ex = daTaExisting(), add = names.filter(function(n){ return !ex[n]; });
  if(!f){ toast('⚠️ اختار المزرعة (أو اكتب كود المزرعة الجديدة)'); return; }
  if(!(sec > 0)){ toast('⚠️ رقم السكشن مطلوب'); return; }
  if(!add.length){ toast(names.length ? '⚠️ كل التانكات دي موجودة قبل كده' : '⚠️ اكتب عدد التانكات'); return; }
  var hasFish = document.getElementById('ta-hasfish').checked, fish = 0, wt = 0, d = daToday(), vol = parseFloat(daVal('ta-vol')) || 10;
  if(hasFish){ fish = parseInt(daVal('ta-fish'), 10); wt = parseFloat(daVal('ta-wt')); d = daParseDate(daVal('ta-date') || daToday());
    if(!(fish > 0) || !(wt > 0) || !d){ toast('⚠️ عدد السمك والوزن والتاريخ مطلوبين لو فيها سمك'); return; } }
  if(daVal('ta-farm') === '__new'){ var reg = getFarmsRegistry(); reg[f] = daVal('ta-newname').trim() || f; saveFarmsRegistry(reg); }
  var secId = f + '.S' + daTaPad(sec), list = add.map(function(nm){ var bio = fish * wt / 1000;
    return {unit:nm, farm:f, section:secId, batch:hasFish ? daVal('ta-batch').trim() : '', species:'Silver Tilapia', hatchery:'', startDate:d, fishNo:fish, startWt:wt, avgWt:wt,
      biomass:bio, density:vol ? bio / vol : 0, volume:vol, mortality:0, survival:100, feedKg:0, alarm:false, warn:false}; });
  list.forEach(function(u){ RAW.push(u); }); _valCache = {t:0, map:{}};
  await daPersistUnitsLocal();
  try{ await saveUnitsToCloud(list); }catch(e){ toast('⚠️ اتحفظت على الجهاز — هتترفع لما الاتصال يرجع'); }
  toast('✅ اتضاف ' + list.length + ' تانك في ' + secId); show('farm-setup', true);
}
// tanks already added without a section: put them in one, names unchanged (their records stay linked)
function daTaNoSec(){
  var out = {}; RAW.forEach(function(u){ if(u.unit && daSecNo(u.section || '') === null) (out[u.farm || '?'] = out[u.farm || '?'] || []).push({name:u.unit, src:'raw'}); });
  getFarmUnits().forEach(function(u){ if(u.name && daSecNo(u.section || '') === null && !RAW.some(function(r){ return r.unit === u.name; })) (out[u.farm || '?'] = out[u.farm || '?'] || []).push({name:u.name, src:'set'}); });
  return out;
}
function daTaFixCard(){
  var ns = daTaNoSec(), farms = Object.keys(ns); if(!farms.length) return '';
  return '<div class="card" id="ta-fix" style="margin-bottom:14px;border:2px solid var(--amber)"><div class="card-title">⚠️ تانكات من غير سكشن</div><div style="font-size:12px;color:var(--muted);margin-bottom:8px">الشيتات بتعتبرهم سكشن 1 مؤقتاً. حدد السكشن بتاعهم — الأسماء والسجلات زي ما هي.</div>'
    + farms.map(function(f){ var l = ns[f]; return '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px"><b>' + daEsc(f) + '</b>: <span dir="ltr">' + daEsc(l.map(function(x){ return x.name; }).slice(0, 8).join('، ') + (l.length > 8 ? ' …' : '')) + '</span> (' + l.length + ')'
      + ' ← سكشن <input id="ta-fix-' + daEsc(f) + '" type="number" min="1" value="1" style="width:70px;padding:6px;border:1.5px solid var(--line);border-radius:7px"/> <button class="savebtn" style="width:auto;padding:6px 14px" onclick="daTaFix(&quot;' + daEsc(f) + '&quot;)">✔ تطبيق</button></div>'; }).join('') + '</div>';
}
async function daTaFix(farm){
  var n = parseInt(daVal('ta-fix-' + farm), 10); if(!(n > 0)){ toast('⚠️ رقم السكشن'); return; }
  var secId = farm + '.S' + daTaPad(n), l = daTaNoSec()[farm] || [], changed = [], fu = getFarmUnits(), fuChanged = false;
  l.forEach(function(x){ if(x.src === 'raw'){ var u = RAW.filter(function(r){ return r.unit === x.name; })[0]; if(u){ u.section = secId; changed.push(u); } }
    else fu.forEach(function(u){ if(u.name === x.name){ u.section = secId; fuChanged = true; } }); });
  if(fuChanged) saveFarmUnits(fu);
  if(changed.length){ _valCache = {t:0, map:{}}; await daPersistUnitsLocal(); try{ await saveUnitsToCloud(changed); }catch(e){} }
  _dataVer++; toast('✅ ' + l.length + ' تانك بقوا في ' + secId); show('farm-setup', true);
}
if(!window._daTaWrapped){
  window._daTaWrapped = true;
  var _showPreTa = show;
  show = function(v){ var r = _showPreTa.apply(this, arguments);
    if(currentView === 'farm-setup'){ var mu = document.getElementById('mu-unit'), card = mu && mu.closest('.card');
      if(card && !document.getElementById('ta-save')){ card.id = 'ta-card'; card.innerHTML = daTaCard(); daTaRefresh(); var fx = daTaFixCard(); if(fx) card.insertAdjacentHTML('beforebegin', fx);
        if(window._daTaFocus){ window._daTaFocus = false; card.scrollIntoView({behavior:'smooth', block:'start'}); } } }
    return r; };
  settingsAddUnitRow = function(){ window._daTaFocus = true; toast('➕ التانكات بتتضاف من هنا — بالسكشن'); show('farm-setup'); };   // Settings' "new tank" → the one place
}
