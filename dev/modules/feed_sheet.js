// ══════════════════════════════════════════════════════════
//  DAILY FEED SHEET — the paper Feed Log on screen
// ══════════════════════════════════════════════════════════
// Same layout as the farm's paper log: tanks in sheet order, one column per meal time (meal times per section group),
// pellet size 1/2/3 and dead per tank. One feeding record per tank per day (kg = sum of meals, `meals` keeps the
// breakdown) and one mortality record, with fixed ids so saving again edits instead of duplicating.
// Product (brand) per pellet size is chosen once in the header → stored as `feed` (the inventory name) on each record.
var DA_SHEET_KEY = 'daracqua_plan_v1_sheets';   // synced: {farm: [{from, to, meals:[...]}]}
var DA_SHEET_DEFAULT = [{from:1, to:999, meals:['7', '10', '1', '4']}];
function daSheetCfgAll(){ try{ return JSON.parse(localStorage.getItem(DA_SHEET_KEY) || '{}') || {}; }catch(e){ return {}; } }
function daSheetGroups(farm){ var g = daSheetCfgAll()[farm]; return Array.isArray(g) && g.length ? g : DA_SHEET_DEFAULT; }
function daSheetGroupsText(farm){ return daSheetGroups(farm).map(function(g){ return (g.from === g.to ? g.from : g.from + '-' + (g.to >= 999 ? '' : g.to)) + ' = ' + g.meals.join(', '); }).join('\n'); }
// "1-3 = 8, 10, 12, 2, 4" · "6-16 = 6:30, 9:30" · "4 = 7, 11, 3" · "1- = 7, 10" (open end)
function daParseSheetGroups(text){
  var out = [], bad = [];
  String(text || '').split('\n').forEach(function(line, i){
    line = line.trim(); if(!line) return;
    var p = line.split('='); if(p.length !== 2){ bad.push(i + 1); return; }
    var r = p[0].trim().match(/^(\d+)\s*(?:-\s*(\d*))?$/), meals = p[1].split(/[,،]/).map(function(x){ return x.trim(); }).filter(Boolean);
    if(!r || !meals.length){ bad.push(i + 1); return; }
    out.push({from:+r[1], to:r[2] === undefined ? +r[1] : (r[2] === '' ? 999 : +r[2]), meals:meals});
  });
  return {groups:out, bad:bad};
}
function daTankNo(unit){ var m = /S(\d+)\s*T(\d+)/i.exec(String(unit || '')); return m ? {s:+m[1], t:+m[2], label:(+m[1]) + '.' + (+m[2])} : null; }
function daSizeOf(feed){ var m = /(\d+(?:\.\d+)?)\s*mm/i.exec(String(feed || '')); return m ? m[1] : ''; }
function daSheetProducts(size){
  var all = getFeedTypes(), avail = getAvailableFeedTypes(), seen = {};
  return avail.concat(all).filter(function(f){ if(seen[f]) return false; seen[f] = 1; return daSizeOf(f) === String(size); });
}
// default product for a pellet size on this farm: the last one used, else the first in stock
function daSheetDefaultProduct(farm, size){
  var last = null;
  getTX().forEach(function(t){ if(t.type === 'feeding' && t.feed && daSizeOf(t.feed) === String(size) && String(t.unit).indexOf(farm + '.') === 0 && (!last || t.date > last.date)) last = t; });
  if(last) return last.feed;
  var p = daSheetProducts(size); return p[0] || size + 'mm';
}
function daFsRows(farm, date){
  var units = {}; _txLiveRows().forEach(function(r){ if(r.farm === farm || String(r.unit).indexOf(farm + '.') === 0) units[r.unit] = r; });
  getTX().forEach(function(t){ if(t.unit && String(t.unit).indexOf(farm + '.') === 0 && !units[t.unit] && daTankNo(t.unit)) units[t.unit] = {unit:t.unit, farm:farm}; });
  return Object.keys(units).filter(daTankNo).sort(function(a, b){ var x = daTankNo(a), y = daTankNo(b); return x.s - y.s || x.t - y.t; })
    .map(function(u){ return {unit:u, no:daTankNo(u), fish:(daStateAt(u, date) || {}).fish || 0}; });
}
function daFsLoad(rows, date){
  var by = {}; rows.forEach(function(r){ by[r.unit] = r; r.feedTx = null; r.mortTx = null; r.otherKg = 0; r.otherDead = 0; });
  getTX().forEach(function(t){
    var r = by[t.unit]; if(!r || t.date !== date || t.deleted) return;
    if(t.type === 'feeding'){ if(t.id === 'fs-' + t.unit + '-' + date) r.feedTx = t; else r.otherKg += parseFloat(t.kg) || 0; }
    else if(t.type === 'mortality'){ if(t.id === 'fsm-' + t.unit + '-' + date) r.mortTx = t; else r.otherDead += parseInt(t.count) || 0; }
  });
}
function daFsNum(v){ return v === undefined || v === null || v === '' ? '' : String(+(+v).toFixed(3)); }

function renderFeedSheet(){
  var st = window._fs = window._fs || {}, farms = daFarms();
  if(farmFilter && farmFilter !== 'all') st.farm = farmFilter;
  if(!st.farm || farms.indexOf(st.farm) < 0) st.farm = farms[0] || '';
  if(!st.date) st.date = daToday();
  st.prod = st.prod || {};
  if(st.prodFarm !== st.farm){ st.prod = {}; st.prodFarm = st.farm; }
  ['1', '2', '3'].forEach(function(z){ if(!st.prod[z]) st.prod[z] = daSheetDefaultProduct(st.farm, z); });
  var rows = st.rows = daFsRows(st.farm, st.date); daFsLoad(rows, st.date);
  var groups = daSheetGroups(st.farm), canMort = currentUserRole === 'admin' || hasPerm('input_mortality');
  var canCfg = ['admin', 'manager', 'engineer'].indexOf(currentUserRole) >= 0;
  var inp = 'padding:7px 10px;border:1.5px solid var(--line);border-radius:8px;font:inherit;font-size:13px';
  var h = '<div class="ph"><div><h2>📋 شيت العلف اليومي</h2><p style="font-size:11px;color:var(--muted)">نفس ترتيب الشيت الورق — الكميات بالكيلو لكل وجبة، والأداة بتجمعها</p></div>'
    + '<button id="fs-save" class="savebtn" style="width:auto;padding:10px 22px" onclick="daFsSave()">💾 حفظ الشيت</button></div>';
  h += '<div class="card" style="margin-bottom:12px"><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">'
    + '<div class="field" style="margin:0"><label>التاريخ</label><input type="date" id="fs-date" value="' + st.date + '" max="' + daToday() + '" style="' + inp + '" onchange="daFsSwitch(&quot;date&quot;,this.value)"/></div>';
  if(!(farmFilter && farmFilter !== 'all')) h += '<div class="field" style="margin:0"><label>المزرعة</label><select id="fs-farm" style="' + inp + '" onchange="daFsSwitch(&quot;farm&quot;,this.value)">'
    + farms.map(function(f){ return '<option' + (f === st.farm ? ' selected' : '') + '>' + daEsc(f) + '</option>'; }).join('') + '</select></div>';
  h += '<div class="field" style="margin:0"><label>الفني</label><input id="fs-tech" data-nodirty="1" value="' + daEsc(st.tech || '') + '" placeholder="اسم اللي ملا الشيت" style="' + inp + ';width:150px" oninput="window._fs.tech=this.value"/></div></div>'
    + '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px">' + ['1', '2', '3'].map(function(z){
      var opts = daSheetProducts(z); if(opts.indexOf(st.prod[z]) < 0) opts.unshift(st.prod[z]);
      return '<div class="field" style="margin:0"><label>نوع العلف — حجم ' + z + ' مم</label><select id="fs-prod-' + z + '" style="' + inp + ';min-width:170px" onchange="window._fs.prod[&quot;' + z + '&quot;]=this.value">'
        + opts.map(function(o){ return '<option' + (o === st.prod[z] ? ' selected' : '') + '>' + daEsc(o) + '</option>'; }).join('') + '</select></div>'; }).join('')
    + '</div><div style="font-size:11px;color:var(--muted);margin-top:6px">الحجم بيتكتب في كل سطر (1 أو 2 أو 3)، والشركة بتتاخد من هنا. الأصناف من مخزون العلف.</div></div>';
  if(!rows.length) return h + '<div class="card" style="text-align:center;padding:40px;color:var(--muted)">مفيش تانكات متسجلة للمزرعة دي.</div>';
  var idx = 0, existing = rows.some(function(r){ return r.feedTx || r.mortTx; });
  if(existing) h += '<div class="card" style="margin-bottom:12px;background:#f0fdf4;font-size:13px">✅ الشيت ده متسجل قبل كده — أي تعديل وحفظ بيعدّل نفس السجلات، مش بيكررها.</div>';
  var used = {};
  groups.forEach(function(g, gi){
    var gr = rows.filter(function(r){ return !used[r.unit] && r.no.s >= g.from && r.no.s <= g.to; });
    if(!gr.length) return;
    gr.forEach(function(r){ used[r.unit] = 1; });
    var secs = gr.map(function(r){ return r.no.s; }), lo = Math.min.apply(null, secs), hi = Math.max.apply(null, secs);
    h += '<div class="card fs-group" style="margin-bottom:12px;padding:10px"><div class="card-title">' + (lo === hi ? 'سكشن ' + lo : 'سكاشن ' + lo + ' – ' + hi) + ' <span style="font-weight:400;color:var(--muted);font-size:12px">(' + g.meals.length + ' وجبات)</span></div>'
      + '<div style="overflow-x:auto" dir="ltr"><table class="fs-t" dir="ltr"><thead><tr><th class="fs-tank">Tank</th>' + g.meals.map(function(m){ return '<th>' + daEsc(m) + '</th>'; }).join('')
      + '<th>Size</th><th>dead</th><th class="fs-sumh">الإجمالي</th><th></th></tr></thead><tbody>';
    gr.forEach(function(r){
      var i = idx++, ft = r.feedTx, mt = r.mortTx, meals = (ft && ft.meals) || {}, off = !(r.fish > 0) && !ft && !mt;
      r.i = i; r.meals = g.meals;
      var size = ft ? (ft.size || daSizeOf(ft.feed)) : daSizeOf(daFwDefaultFeed({unit:r.unit, avgWt:(daStateAt(r.unit, st.date) || {}).wt || 0}));
      if(ft && !Object.keys(meals).length && ft.kg) meals[g.meals[0]] = ft.kg;   // old record without breakdown
      h += '<tr' + (off ? ' class="fs-off" title="التانك فاضي في التاريخ ده"' : '') + '><td class="fs-tank">' + r.no.label + '</td>'
        + g.meals.map(function(m, k){ return '<td><input type="number" inputmode="decimal" step="0.1" min="0" id="fs-' + i + '-m' + k + '" value="' + daFsNum(meals[m]) + '"' + (off ? ' disabled' : '') + '/></td>'; }).join('')
        + '<td><input type="number" inputmode="numeric" min="1" max="3" step="1" class="fs-sz" id="fs-' + i + '-sz" value="' + daEsc(size || '') + '"' + (off ? ' disabled' : '') + '/></td>'
        + '<td><input type="number" inputmode="numeric" min="0" step="1" id="fs-' + i + '-d" value="' + (mt ? mt.count : '') + '"' + (off || !canMort ? ' disabled' : '') + '/></td>'
        + '<td class="fs-sum" id="fs-' + i + '-sum"></td>'
        + '<td class="fs-note">' + (r.otherKg ? '⚠️ +' + daFsNum(r.otherKg) + ' كجم من شاشة تانية' : '') + (r.otherDead ? (r.otherKg ? '<br>' : '') + '⚠️ +' + r.otherDead + ' نافق من شاشة تانية' : '') + (off ? 'فاضي' : '') + '</td></tr>';
    });
    h += '</tbody></table></div></div>';
  });
  var left = rows.filter(function(r){ return !used[r.unit]; });
  if(left.length) h += '<div class="card" style="margin-bottom:12px;color:var(--amber);font-size:12px">⚠️ ' + left.length + ' تانك مش داخلين في أي مجموعة وجبات (' + left.slice(0, 8).map(function(r){ return r.no.label; }).join('، ') + ') — عدّل المواعيد تحت.</div>';
  h += '<div class="card" style="margin-bottom:12px;display:flex;gap:24px;flex-wrap:wrap;font-size:14px"><div>🌾 إجمالي العلف: <b id="fs-tot-kg">0</b> كجم</div><div>💀 إجمالي النفوق: <b id="fs-tot-dead">0</b></div></div>';
  if(canCfg) h += '<details class="card" style="margin-bottom:12px"><summary style="cursor:pointer;font-weight:700">⚙️ مواعيد الوجبات لكل مجموعة سكاشن — ' + daEsc(st.farm) + '</summary>'
    + '<div style="font-size:12px;color:var(--muted);margin:8px 0">سطر لكل مجموعة: <code>السكاشن = المواعيد</code> — مثال: <code>1-3 = 8, 10, 12, 2, 4</code></div>'
    + '<textarea id="fs-groups" data-nodirty="1" rows="4" dir="ltr" style="width:100%;' + inp + ';font-family:monospace">' + daEsc(daSheetGroupsText(st.farm)) + '</textarea>'
    + '<button class="savebtn" style="width:auto;padding:8px 16px;margin-top:8px" onclick="daFsSaveGroups()">💾 حفظ المواعيد</button></details>';
  setTimeout(daFsTotals, 0);
  return h;
}
function daFsSwitch(k, v){
  var t = _daActiveTab;
  if(t && t.dirty && !confirm('فيه أرقام اتكتبت ومتحفظتش في الشيت ده. تغيّر ' + (k === 'date' ? 'التاريخ' : 'المزرعة') + ' وتضيعها؟')){
    var el = document.getElementById('fs-' + k); if(el) el.value = window._fs[k]; return;
  }
  window._fs[k] = v; show('feed-sheet', true);
}
function daFsSaveGroups(){
  var r = daParseSheetGroups((document.getElementById('fs-groups') || {}).value);
  if(r.bad.length){ toast('⚠️ السطر ' + r.bad.join('، ') + ' مش مفهوم — اكتبه كده: 1-3 = 8, 10, 12'); return; }
  var all = daSheetCfgAll(); if(r.groups.length) all[window._fs.farm] = r.groups; else delete all[window._fs.farm];
  localStorage.setItem(DA_SHEET_KEY, JSON.stringify(all)); toast('✅ اتحفظت المواعيد'); show('feed-sheet', true);
}
function daFsRead(r){
  var out = {meals:{}, kg:0, bad:false, size:'', dead:null};
  r.meals.forEach(function(m, k){
    var el = document.getElementById('fs-' + r.i + '-m' + k); if(!el) return;
    var raw = String(el.value).trim(); if(raw === '') return;
    var v = parseFloat(raw); if(isNaN(v) || v < 0){ out.bad = true; return; }
    if(v > 0){ out.meals[m] = +v.toFixed(3); out.kg += v; }
  });
  out.kg = +out.kg.toFixed(3);
  var sz = document.getElementById('fs-' + r.i + '-sz'); out.size = sz ? String(sz.value).trim() : '';
  if(out.size && ['1', '2', '3'].indexOf(out.size) < 0) out.bad = true;
  var d = document.getElementById('fs-' + r.i + '-d');
  out.deadLocked = !d || d.disabled;                     // no permission / empty tank: never touch mortality
  if(d && !d.disabled && String(d.value).trim() !== ''){ var n = Number(d.value); if(!(n >= 0) || n % 1) out.bad = true; else out.dead = n; }
  return out;
}
function daFsTotals(){
  var st = window._fs; if(!st || !st.rows) return;
  var kg = 0, dead = 0;
  st.rows.forEach(function(r){ if(r.i === undefined) return; var v = daFsRead(r); kg += v.kg; dead += v.dead || 0;
    var s = document.getElementById('fs-' + r.i + '-sum'); if(s) s.textContent = v.kg ? daFsNum(v.kg) : ''; });
  var a = document.getElementById('fs-tot-kg'), b = document.getElementById('fs-tot-dead');
  if(a) a.textContent = daFsNum(kg) || '0'; if(b) b.textContent = dead;
}
document.addEventListener('input', function(e){ if(e.target && e.target.closest && e.target.closest('.fs-t')) daFsTotals(); });

async function daFsSave(){
  var st = window._fs; if(!st || !st.rows) return;
  var who = currentUser ? {by:currentUser.email, byName:(getSession() || {}).name || '', byRole:currentUserRole} : {};
  var now = new Date().toISOString(), adds = [], edits = [], dels = [], blocked = [], flagged = 0, bad = [], noSize = [], dup = [];
  st.rows.forEach(function(r){
    if(r.i === undefined) return;
    var v = daFsRead(r); if(v.bad){ bad.push(r.no.label); return; }
    var fid = 'fs-' + r.unit + '-' + st.date, mid = 'fsm-' + r.unit + '-' + st.date;
    // feeding
    if(v.kg > 0){
      if(!v.size){ noSize.push(r.no.label); return; }
      var feed = st.prod[v.size] || (v.size + 'mm');
      if(r.otherKg > 0 && !r.feedTx) dup.push(r.no.label);
      if(r.feedTx){
        var ft = r.feedTx;
        if(ft.kg !== v.kg || ft.feed !== feed || JSON.stringify(ft.meals || {}) !== JSON.stringify(v.meals) || String(ft.size || '') !== v.size)
          edits.push({id:fid, ch:{kg:v.kg, feed:feed, meals:v.meals, size:v.size, tech:st.tech || ft.tech || ''}});
      } else {
        var t = Object.assign({id:fid, type:'feeding', date:st.date, unit:r.unit, kg:v.kg, feed:feed, meal:'شيت', meals:v.meals, size:v.size,
          tech:st.tech || '', source:'sheet', at:now, ts:now}, who);
        if(t.byRole === 'worker') t.status = 'pending';
        var x = validateTX(t);
        if(x.level === 'block'){ blocked.push(r.no.label + ': ' + x.msgs.join(' ')); }
        else { if(x.level === 'warn'){ t.flagged = true; t.flagMsg = x.msgs.join(' · '); if(!t.status) t.status = 'pending'; flagged++; } adds.push(t); }
      }
    } else if(r.feedTx) dels.push(fid);
    // mortality
    if(v.deadLocked){ /* leave mortality as it is */ }
    else if(v.dead > 0){
      if(r.mortTx){ if(r.mortTx.count !== v.dead) edits.push({id:mid, ch:{count:v.dead}}); }
      else {
        var m = Object.assign({id:mid, type:'mortality', date:st.date, unit:r.unit, count:v.dead, cause:'', tech:st.tech || '', source:'sheet', at:now, ts:now}, who);
        if(m.byRole === 'worker') m.status = 'pending';
        var y = validateTX(m);
        if(y.level === 'block'){ blocked.push(r.no.label + ' (نافق): ' + y.msgs.join(' ')); }
        else { if(y.level === 'warn'){ m.flagged = true; m.flagMsg = y.msgs.join(' · '); if(!m.status) m.status = 'pending'; flagged++; } adds.push(m); }
      }
    } else if(r.mortTx) dels.push(mid);                  // cleared to 0 / empty → remove the sheet's record
  });
  if(bad.length){ toast('⚠️ أرقام مش صحيحة في: ' + bad.slice(0, 8).join('، ') + ' (الحجم 1 أو 2 أو 3، والنافق رقم صحيح)'); return; }
  if(noSize.length){ toast('⚠️ اكتب الحجم (1 أو 2 أو 3) للتانكات: ' + noSize.slice(0, 10).join('، ')); return; }
  if(!adds.length && !edits.length && !dels.length && !blocked.length){ toast('مفيش تغيير'); return; }
  if(dup.length && !confirm(dup.length + ' تانك عندهم علف متسجل لنفس اليوم من شاشة تانية (' + dup.slice(0, 6).join('، ') + ').\nلو ده نفس العلف، هيتحسب مرتين. تحفظ برضه؟')) return;
  var btn = document.getElementById('fs-save'); if(btn){ btn.disabled = true; btn.textContent = '⏳ جاري الحفظ...'; }
  try{
    if(adds.length){
      var arr = getTX(), ix = {}; arr.forEach(function(t, i){ ix[t.id] = i; });
      adds.forEach(function(t){ daUnmarkDead(t.id); if(ix[t.id] !== undefined) arr[ix[t.id]] = t; else arr.push(t); });
      saveTX(arr); await idbFlush();
      var failed = adds;
      if(sbReady && SB_FARM_ID && navigator.onLine) failed = await daUploadTxBatch(adds);
      failed.forEach(function(t){ addToOfflineQueue('upsert_tx', t); });
    }
    edits.forEach(function(e){ updateTX(e.id, e.ch); });
    dels.forEach(function(id){ deleteTX(id); });
    _invMemo = {k:'', v:null};
  }finally{ if(btn){ btn.disabled = false; btn.textContent = '💾 حفظ الشيت'; } }
  var kg = 0, dead = 0; st.rows.forEach(function(r){ if(r.i !== undefined){ var v = daFsRead(r); kg += v.bad ? 0 : v.kg; dead += v.dead || 0; } });
  toast('✅ اتحفظ شيت ' + st.date + ' — ' + daFsNum(kg) + ' كجم علف · ' + dead + ' نافق' + (flagged ? ' · ' + flagged + ' للمراجعة' : '') + (blocked.length ? ' · ⛔ ' + blocked.length + ' اترفضوا' : ''));
  if(blocked.length) setTimeout(function(){ alert('⛔ اترفضوا ومتحفظوش:\n' + blocked.join('\n')); }, 50);
  show('feed-sheet', true);
}

// ── registration ──
VIEWS['feed-sheet'] = renderFeedSheet; VIEW_PERMS['feed-sheet'] = 'input_feeding';
(function(){
  var g = DA_NAV.filter(function(x){ return x.id === 'entry'; })[0];
  if(g && !g.items.some(function(i){ return i[0] === 'feed-sheet'; })) g.items.splice(0, 0, ['feed-sheet', '📋', 'شيت العلف اليومي', 'Daily Feed Sheet']);
  if(document.getElementById('da-fs-css')) return;
  var c = document.createElement('style'); c.id = 'da-fs-css';
  c.textContent = '.fs-t{border-collapse:collapse;font-size:13px;width:auto}.fs-t th{background:var(--deep);color:#fff;padding:6px 4px;font-weight:700;white-space:nowrap}'
    + '.fs-t td{border-bottom:1px solid var(--line);padding:3px 3px;text-align:center}.fs-t .fs-tank{font-weight:800;position:sticky;left:0;background:#fff;min-width:48px;text-align:left;padding-left:6px}.fs-t th.fs-tank{background:var(--deep)}'
    + '.fs-t input{width:64px;padding:6px 4px;border:1.5px solid var(--line);border-radius:6px;font:inherit;text-align:center}.fs-t input.fs-sz{width:44px}'
    + '.fs-t input:focus{border-color:var(--teal);outline:none;background:#f0fdfa}.fs-t .fs-sum{font-weight:700;color:var(--deep);min-width:56px;border-left:2px solid var(--line)}.fs-t th.fs-sumh{background:#335c67}'
    + '.fs-t .fs-note{font-size:11px;color:var(--amber);text-align:left;white-space:nowrap;direction:rtl}.fs-t tr.fs-off td{opacity:.45}'
    + '@media(max-width:700px){.fs-t input{width:52px;padding:7px 2px}.fs-t input.fs-sz{width:38px}}';
  document.head.appendChild(c);
})();
