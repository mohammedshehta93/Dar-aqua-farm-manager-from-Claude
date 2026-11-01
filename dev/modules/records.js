// ══════════════════════════════════════════════════════════
//  HARVEST & TRANSFER REGISTERS — AquaManager style, plus
// ══════════════════════════════════════════════════════════
// Date range → every record, totals, filter, Excel. Right-click a row (or ⋮ on phones): new / edit / delete.
// Transfers: one source → several destinations in ONE record (one txGroup: a transfer_out + a transfer_in per
// destination); destinations inherit the source cycle's batch so LTD (lot) figures continue across tanks.
// Harvest: average weight computed, optional count adjustment saved alongside (type 'adjustment').
// Never more fish out than the tank holds on that date.
function daCtxMenu(ev, items){
  ev.preventDefault(); ev.stopPropagation(); var old = document.getElementById('da-ctx'); if(old) old.remove();
  var m = document.createElement('div'); m.id = 'da-ctx'; m.dir = 'rtl';
  m.style.cssText = 'position:fixed;z-index:9999;background:#fff;border:1px solid #cbd5e1;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.18);padding:4px 0;min-width:170px;font-size:13px';
  m.innerHTML = items.map(function(it, i){ return it === '-' ? '<div style="border-top:1px solid #e2e8f0;margin:4px 0"></div>' : '<div class="ctx-i" data-i="' + i + '" style="padding:8px 14px;cursor:' + (it.off ? 'default;color:#94a3b8' : 'pointer') + '">' + it.t + '</div>'; }).join('');
  document.body.appendChild(m);
  var x = ev.clientX || (ev.target.getBoundingClientRect().left), y = ev.clientY || (ev.target.getBoundingClientRect().bottom);
  m.style.left = Math.max(4, Math.min(x, window.innerWidth - m.offsetWidth - 8)) + 'px'; m.style.top = Math.max(4, Math.min(y, window.innerHeight - m.offsetHeight - 8)) + 'px';
  m.addEventListener('click', function(e){ var t = e.target.closest('.ctx-i'); if(!t) return; var it = items[+t.dataset.i]; if(it.off) return; m.remove(); it.f(); });
}
document.addEventListener('mousedown', function(e){ var m = document.getElementById('da-ctx'); if(m && !m.contains(e.target)) m.remove(); }, true);
document.addEventListener('keydown', function(e){ if(e.key === 'Escape'){ var m = document.getElementById('da-ctx'); if(m) m.remove(); } });
function daRegUnits(){ return _txLiveRows().filter(function(r){ return (!farmFilter || farmFilter === 'all' || r.farm === farmFilter || String(r.unit).indexOf(farmFilter + '.') === 0) && daTankNo(r.unit); })
  .map(function(r){ return r.unit; }).sort(function(a, b){ var x = daTankNo(a), y = daTankNo(b); return a.split('.')[0].localeCompare(b.split('.')[0]) || x.s - y.s || x.t - y.t; }); }
function daRegInRange(t, st){ return t.date >= st.from && (!st.to || t.date <= st.to) && !t.deleted && (!farmFilter || farmFilter === 'all' || String(t.unit).indexOf(farmFilter + '.') === 0); }
function daRegBar(kind, st, n){
  var inp = 'padding:6px 9px;border:1.5px solid var(--line);border-radius:7px;font:inherit;font-size:13px', v = kind === 'harv' ? 'tx-harvesting' : 'tx-transfer';
  return '<div class="card" style="margin-bottom:10px;display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">'
    + '<div class="field" style="margin:0"><label>من</label><input type="date" id="rg-from" data-nodirty="1" value="' + st.from + '" style="' + inp + '" onchange="window._rg' + kind + '.from=this.value;show(&quot;' + v + '&quot;,true)"/></div>'
    + '<div class="field" style="margin:0"><label>لحد</label><input type="date" id="rg-to" data-nodirty="1" value="' + (st.to || '') + '" style="' + inp + '" onchange="window._rg' + kind + '.to=this.value;show(&quot;' + v + '&quot;,true)"/></div>'
    + '<div class="field" style="margin:0"><label>فلتر</label><input id="rg-q" data-nodirty="1" value="' + daEsc(st.q || '') + '" placeholder="تانك / دفعة" style="' + inp + ';width:140px" onchange="window._rg' + kind + '.q=this.value;show(&quot;' + v + '&quot;,true)"/></div>'
    + '<button id="rg-new" class="savebtn" style="width:auto;padding:8px 16px" onclick="daRegForm(&quot;' + kind + '&quot;)">➕ جديد</button>'
    + '<button onclick="daRegExcel(&quot;' + kind + '&quot;)" style="' + inp + ';background:#fff;cursor:pointer">⬇️ Excel</button><span style="flex:1"></span><b>' + n + ' سجل</b></div>';
}
// ── harvest register ──
function daHarvRows(st){
  var adj = {}; getTX().forEach(function(t){ if(t.type === 'adjustment' && !t.deleted) adj[t.unit + '|' + t.date] = (adj[t.unit + '|' + t.date] || 0) + (parseInt(t.count) || 0); });
  var q = String(st.q || '').toLowerCase();
  return getTX().filter(function(t){ return t.type === 'harvesting' && daRegInRange(t, st); }).map(function(t){
    var c = daCycleOn(t.unit, t.date) || {}, n = parseInt(t.fishNo) || 0, kg = parseFloat(t.kg) || 0;
    return {id:t.id, date:t.date, unit:t.unit, batch:c.batch || '', fish:n, kg:kg, avg:n ? kg * 1000 / n : 0, adj:adj[t.unit + '|' + t.date] || 0, buyer:t.buyer || '', price:t.price || '', notes:t.notes || '', by:t.byName || t.by || ''}; })
    .filter(function(r){ return !q || (r.unit + ' ' + r.batch).toLowerCase().indexOf(q) >= 0; }).sort(function(a, b){ return a.date < b.date ? -1 : a.date > b.date ? 1 : a.unit.localeCompare(b.unit); });
}
function renderHarvReg(){
  var st = window._rgharv = window._rgharv || {}; if(!st.from) st.from = daAddDays(daToday(), -30);   // last 30 days (start of month hides yesterday on the 1st)
  var rows = st.rows = daHarvRows(st), f2 = function(v, d){ return (+v || 0).toLocaleString('en-US', {minimumFractionDigits:d, maximumFractionDigits:d}); }, th = 'padding:6px 8px;white-space:nowrap;text-align:right';
  var h = '<div class="ph"><div><h2>🎣 الحصاد</h2><p style="font-size:11px;color:var(--muted)">كل الحصاد في الفترة — كليك يمين على أي سطر (أو ⋮) للتعديل والحذف والإضافة</p></div></div>' + daRegBar('harv', st, rows.length);
  h += '<div class="card" style="padding:0;overflow:hidden" oncontextmenu="daRegCtx(event,&quot;harv&quot;,null)"><div style="overflow:auto;max-height:70vh" dir="ltr"><table id="rg-t" style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:#e2e8f0;position:sticky;top:0">'
    + ['Date', 'Unit', 'Batch', 'Fish No', 'Total Weight', 'Av. Wt.', 'Adjustments', 'Buyer', 'Price', 'Comments', 'By', ''].map(function(x){ return '<th style="' + th + '">' + x + '</th>'; }).join('') + '</tr></thead><tbody>';
  var tf = 0, tk = 0;
  rows.forEach(function(r, i){ tf += r.fish; tk += r.kg;
    h += '<tr data-i="' + i + '" oncontextmenu="daRegCtx(event,&quot;harv&quot;,' + i + ')" style="border-bottom:1px solid #e2e8f0">' + [r.date, daEsc(r.unit), daEsc(r.batch), f2(r.fish, 0), f2(r.kg, 2), f2(r.avg, 2), r.adj || '', daEsc(r.buyer), r.price || '', daEsc(r.notes), daEsc(r.by)].map(function(v, k){ return '<td style="padding:5px 8px;white-space:nowrap;text-align:' + (k === 1 || k === 2 || k > 6 ? 'left' : 'right') + '">' + v + '</td>'; }).join('')
      + '<td><button onclick="daRegCtx(event,&quot;harv&quot;,' + i + ')" style="border:0;background:none;cursor:pointer;font-size:16px">⋮</button></td></tr>'; });
  h += '</tbody><tfoot><tr style="background:#f1f5f9;font-weight:700"><td></td><td></td><td></td><td style="padding:6px 8px;text-align:right">' + f2(tf, 0) + '</td><td style="padding:6px 8px;text-align:right">' + f2(tk, 2) + '</td><td style="padding:6px 8px;text-align:right">' + (tf ? 'AVG=' + f2(tk * 1000 / tf, 2) : '') + '</td><td colspan="6"></td></tr></tfoot></table></div></div>';
  if(!rows.length) h += '<div class="card" style="text-align:center;padding:24px;color:var(--muted)">مفيش حصاد في الفترة دي — ➕ جديد أو كليك يمين.</div>';
  return h + '<div id="rg-form"></div>';
}
// ── transfer register ──
function daTransRows(st){
  var groups = {}, q = String(st.q || '').toLowerCase();
  getTX().forEach(function(t){ if((t.type !== 'transfer_out' && t.type !== 'transfer_in') || t.deleted) return; var g = t.txGroup || t.id; (groups[g] = groups[g] || {g:g, out:null, ins:[]}); if(t.type === 'transfer_out') groups[g].out = t; else groups[g].ins.push(t); });
  return Object.keys(groups).map(function(k){ var G = groups[k], o = G.out || G.ins[0]; if(!o || !daRegInRange(o, st)) return null;
    var c = G.out ? daCycleOn(G.out.unit, G.out.date) || {} : {}, fish = G.out ? parseInt(G.out.fishNo) || 0 : G.ins.reduce(function(s, t){ return s + (parseInt(t.fishNo) || 0); }, 0);
    return {g:k, date:o.date, from:G.out ? G.out.unit : '—', batch:c.batch || (G.ins[0] || {}).batch || '', to:G.ins.map(function(t){ return t.unit + '(' + (parseInt(t.fishNo) || 0).toLocaleString('en-US') + '-' + (+t.avgWt || 0).toFixed(2) + ')'; }).join(' '),
      fish:fish, type:o.transferType || '', by:o.byName || o.by || '', ids:[G.out ? G.out.id : null].concat(G.ins.map(function(t){ return t.id; })).filter(Boolean), out:G.out, ins:G.ins}; })
    .filter(function(r){ return r && (!q || (r.from + ' ' + r.to + ' ' + r.batch).toLowerCase().indexOf(q) >= 0); }).sort(function(a, b){ return a.date < b.date ? -1 : a.date > b.date ? 1 : a.from.localeCompare(b.from); });
}
function renderTransReg(){
  var st = window._rgtrans = window._rgtrans || {}; if(!st.from) st.from = daAddDays(daToday(), -30);
  var rows = st.rows = daTransRows(st), th = 'padding:6px 8px;white-space:nowrap;text-align:left';
  var h = '<div class="ph"><div><h2>🔄 النقل</h2><p style="font-size:11px;color:var(--muted)">كل النقل في الفترة — من تانك لتانك أو أكتر في سجل واحد. كليك يمين (أو ⋮) للتعديل والحذف والإضافة</p></div></div>' + daRegBar('trans', st, rows.length);
  h += '<div class="card" style="padding:0;overflow:hidden" oncontextmenu="daRegCtx(event,&quot;trans&quot;,null)"><div style="overflow:auto;max-height:70vh" dir="ltr"><table id="rg-t" style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:#e2e8f0;position:sticky;top:0">'
    + ['Date', 'From Unit/Batch', 'To Units (Unit(Fish No-Av. Weight))', 'Fish No', 'Type', 'By', ''].map(function(x){ return '<th style="' + th + '">' + x + '</th>'; }).join('') + '</tr></thead><tbody>';
  var tf = 0;
  rows.forEach(function(r, i){ tf += r.fish;
    h += '<tr data-i="' + i + '" oncontextmenu="daRegCtx(event,&quot;trans&quot;,' + i + ')" style="border-bottom:1px solid #e2e8f0"><td style="padding:5px 8px;white-space:nowrap">' + r.date + '</td><td style="padding:5px 8px;white-space:nowrap">' + daEsc(r.from) + (r.batch ? '/' + daEsc(r.batch) : '') + '</td>'
      + '<td style="padding:5px 8px">' + daEsc(r.to) + '</td><td style="padding:5px 8px;text-align:right">-' + r.fish.toLocaleString('en-US') + '</td><td style="padding:5px 8px">' + daEsc(r.type) + '</td><td style="padding:5px 8px">' + daEsc(r.by) + '</td>'
      + '<td><button onclick="daRegCtx(event,&quot;trans&quot;,' + i + ')" style="border:0;background:none;cursor:pointer;font-size:16px">⋮</button></td></tr>'; });
  h += '</tbody><tfoot><tr style="background:#f1f5f9;font-weight:700"><td colspan="3"></td><td style="padding:6px 8px;text-align:right">-' + tf.toLocaleString('en-US') + '</td><td colspan="3"></td></tr></tfoot></table></div></div>';
  if(!rows.length) h += '<div class="card" style="text-align:center;padding:24px;color:var(--muted)">مفيش نقل في الفترة دي — ➕ جديد أو كليك يمين.</div>';
  return h + '<div id="rg-form"></div>';
}
function daRegCtx(ev, kind, i){
  var st = kind === 'harv' ? window._rgharv : window._rgtrans, r = i === null || i === undefined ? null : st.rows[i], can = daCanEditUnits();
  var items = [{t:'➕ سجل جديد', f:function(){ daRegForm(kind); }}];
  if(r){ items.push('-', {t:'✏️ تعديل', off:!can, f:function(){ daRegForm(kind, r); }}, {t:'📋 نسخة جديدة منه', f:function(){ daRegForm(kind, r, true); }}, '-',
    {t:'🗑 حذف', off:!can, f:function(){ if(!confirm('تحذف السجل ده؟ (' + r.date + ' · ' + (r.unit || r.from) + ')')) return; (kind === 'harv' ? [r.id] : r.ids).forEach(function(id){ deleteTX(id); }); toast('🗑 اتحذف'); show(currentView, true); }}); }
  daCtxMenu(ev, items);
}
// ── new / edit form (one panel for both kinds) ──
function daRegForm(kind, r, copy){
  var el = document.getElementById('rg-form'); if(!el) return; var units = daRegUnits(), inp = 'padding:7px 9px;border:1.5px solid var(--line);border-radius:7px;font:inherit;font-size:13px';
  var opt = function(sel){ return '<option value="">—</option>' + units.map(function(u){ return '<option' + (u === sel ? ' selected' : '') + '>' + daEsc(u) + '</option>'; }).join(''); };
  var edit = r && !copy, date = r && !copy ? r.date : daToday(), h = '<div class="card" style="margin-top:12px;border:2px solid var(--teal)"><div class="card-title">' + (edit ? '✏️ تعديل' : '➕ جديد') + ' — ' + (kind === 'harv' ? 'حصاد' : 'نقل') + '</div>';
  h += '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end"><div class="field" style="margin:0"><label>التاريخ</label><input type="date" id="rf-date" data-nodirty="1" value="' + date + '" max="' + daToday() + '" style="' + inp + '" oninput="daRegAvail()"/></div>';
  if(kind === 'harv'){
    h += '<div class="field" style="margin:0"><label>التانك</label><select id="rf-unit" style="' + inp + '" onchange="daRegAvail()">' + opt(r && r.unit) + '</select><div id="rf-avail" style="font-size:11px;color:var(--muted)"></div></div>'
      + [['rf-fish', 'العدد', r ? r.fish : ''], ['rf-kg', 'الوزن الكلي (كجم)', r ? r.kg : ''], ['rf-adj', 'تسوية (فرق عد)', r && r.adj ? r.adj : ''], ['rf-price', 'السعر', r ? r.price : '']].map(function(f){ return '<div class="field" style="margin:0"><label>' + f[1] + '</label><input id="' + f[0] + '" type="number" data-nodirty="1" value="' + f[2] + '" style="' + inp + ';width:110px" oninput="daRegAvail()"/></div>'; }).join('')
      + '<div class="field" style="margin:0"><label>المشتري</label><input id="rf-buyer" data-nodirty="1" value="' + daEsc(r ? r.buyer : '') + '" style="' + inp + ';width:130px"/></div><div class="field" style="margin:0"><label>ملاحظات</label><input id="rf-notes" data-nodirty="1" value="' + daEsc(r ? r.notes : '') + '" style="' + inp + ';width:180px"/></div>'
      + '<div style="font-size:13px;padding-bottom:8px">متوسط الوزن: <b id="rf-avg">—</b></div>';
  } else {
    var ins = r ? r.ins.map(function(t){ return {u:t.unit, n:t.fishNo, w:t.avgWt}; }) : [{u:'', n:'', w:''}];
    h += '<div class="field" style="margin:0"><label>من تانك</label><select id="rf-from" style="' + inp + '" onchange="daRegAvail()">' + opt(r && r.out ? r.out.unit : '') + '</select><div id="rf-avail" style="font-size:11px;color:var(--muted)"></div></div>'
      + '<div class="field" style="margin:0"><label>النوع</label><input id="rf-type" data-nodirty="1" value="' + daEsc(r ? r.type : '') + '" placeholder="نقل / فرز" style="' + inp + ';width:110px"/></div></div>'
      + '<div style="margin-top:10px"><b style="font-size:12px">لـ</b><table id="rf-dest" style="border-collapse:collapse;margin-top:4px">' + ins.map(function(d, i){ return daRegDestRow(i, d, opt); }).join('') + '</table>'
      + '<button onclick="daRegAddDest()" style="' + inp + ';background:#fff;cursor:pointer;margin-top:6px">➕ تانك تاني</button> <span style="font-size:12px">الإجمالي: <b id="rf-sum">0</b></span>';
  }
  h += '</div><div style="margin-top:12px;display:flex;gap:8px"><button id="rf-save" class="savebtn" style="width:auto;padding:9px 20px" onclick="daRegSave(&quot;' + kind + '&quot;)">💾 حفظ</button><button onclick="document.getElementById(&quot;rg-form&quot;).innerHTML=&quot;&quot;" style="' + inp + ';background:#fff;cursor:pointer">إلغاء</button></div></div>';
  el.innerHTML = h; window._rgEdit = edit ? (kind === 'harv' ? [r.id] : r.ids) : null; window._rgOpt = opt;
  daRegAvail(); el.scrollIntoView({behavior:'smooth', block:'center'});
}
function daRegDestRow(i, d, opt){ var inp = 'padding:6px 8px;border:1.5px solid var(--line);border-radius:7px;font:inherit;font-size:13px';
  return '<tr><td style="padding:2px"><select id="rf-d' + i + '-u" style="' + inp + '">' + opt(d.u) + '</select></td><td style="padding:2px"><input id="rf-d' + i + '-n" type="number" placeholder="العدد" value="' + (d.n || '') + '" data-nodirty="1" style="' + inp + ';width:90px" oninput="daRegAvail()"/></td><td style="padding:2px"><input id="rf-d' + i + '-w" type="number" placeholder="متوسط الوزن (جم)" value="' + (d.w || '') + '" data-nodirty="1" style="' + inp + ';width:120px"/></td></tr>'; }
function daRegAddDest(){ var t = document.getElementById('rf-dest'); if(!t) return; var i = t.rows.length; t.insertAdjacentHTML('beforeend', daRegDestRow(i, {u:'', n:'', w:(document.getElementById('rf-d0-w') || {}).value || ''}, window._rgOpt)); }
function daRegFishAt(unit, date){   // fish available on that date, adding back what the record being edited took out
  var s = daStateEnd(unit, daAddDays(date, -1)).fish || 0, ed = window._rgEdit || [];
  (daTxByUnit()[unit] || []).forEach(function(t){ if(t.date !== date || t.deleted || ed.indexOf(t.id) >= 0) return; if(t.type === 'stocking' || t.type === 'transfer_in') s += parseInt(t.fishNo) || 0; else if(DA_SUB_FIELD[t.type]) s -= parseInt(t[DA_SUB_FIELD[t.type]]) || 0; });
  return Math.max(0, s);
}
function daRegAvail(){
  var d = (document.getElementById('rf-date') || {}).value, u = (document.getElementById('rf-unit') || document.getElementById('rf-from') || {}).value, a = document.getElementById('rf-avail');
  if(a) a.textContent = u && d ? 'متاح يومها: ' + daRegFishAt(u, d).toLocaleString('en-US') + ' سمكة · ' + Math.round(daStateEnd(u, d).wt || 0) + 'g' : '';
  var n = +(document.getElementById('rf-fish') || {}).value, kg = +(document.getElementById('rf-kg') || {}).value, av = document.getElementById('rf-avg'); if(av) av.textContent = n > 0 && kg > 0 ? (kg * 1000 / n).toFixed(2) + ' g' : '—';
  var t = document.getElementById('rf-dest'), sm = 0; if(t) for(var i = 0; i < t.rows.length; i++) sm += +(document.getElementById('rf-d' + i + '-n') || {}).value || 0;
  var se = document.getElementById('rf-sum'); if(se) se.textContent = sm.toLocaleString('en-US');
}
function daRegSave(kind){
  var g = function(id){ return String((document.getElementById(id) || {}).value || '').trim(); }, date = g('rf-date'), old = window._rgEdit || [];
  if(!date){ toast('⚠️ التاريخ'); return; }
  if(kind === 'harv'){
    var u = g('rf-unit'), n = parseInt(g('rf-fish')) || 0, kg = parseFloat(g('rf-kg')) || 0, adj = parseInt(g('rf-adj')) || 0;
    if(!u || !(n > 0) || !(kg > 0)){ toast('⚠️ اختار التانك واكتب العدد والوزن'); return; }
    var av = daRegFishAt(u, date); if(n + Math.max(0, adj) > av){ alert('⛔ التانك يومها فيه ' + av.toLocaleString() + ' سمكة بس — مينفعش تحصد ' + (n + Math.max(0, adj)).toLocaleString()); return; }
    old.forEach(function(id){ deleteTX(id); }); getTX().filter(function(t){ return t.type === 'adjustment' && t.unit === u && t.date === date && t.source === 'harvest' && !t.deleted; }).forEach(function(t){ deleteTX(t.id); });
    var id = 'hv-' + u + '-' + date + '-' + Date.now().toString(36);
    addTX({id:id, type:'harvesting', date:date, unit:u, fishNo:n, kg:kg, avgWt:+(kg * 1000 / n).toFixed(2), price:parseFloat(g('rf-price')) || 0, buyer:g('rf-buyer'), notes:g('rf-notes'), _skipValidation:true});
    if(adj) addTX({id:'adj-hv-' + id, type:'adjustment', date:date, unit:u, count:adj, reason:'تسوية عند الحصاد', source:'harvest', _skipValidation:true});
    toast('✅ حصاد ' + u + ': ' + n.toLocaleString() + ' سمكة · ' + kg + ' كجم');
  } else {
    var from = g('rf-from'), t = document.getElementById('rf-dest'), dest = [];
    for(var i = 0; i < t.rows.length; i++){ var du = g('rf-d' + i + '-u'), dn = parseInt(g('rf-d' + i + '-n')) || 0, dw = parseFloat(g('rf-d' + i + '-w')) || 0; if(!du && !dn) continue; dest.push({u:du, n:dn, w:dw}); }
    if(!from || !dest.length){ toast('⚠️ اختار تانك المصدر والتانكات اللي رايحلها'); return; }
    var bad = dest.filter(function(d){ return !d.u || !(d.n > 0) || d.u === from; }); if(bad.length){ toast('⚠️ كل سطر محتاج تانك (غير المصدر) وعدد'); return; }
    var tot = dest.reduce(function(s, d){ return s + d.n; }, 0), avl = daRegFishAt(from, date);
    if(tot > avl){ alert('⛔ ' + from + ' يومها فيه ' + avl.toLocaleString() + ' سمكة بس — مينفعش تنقل ' + tot.toLocaleString()); return; }
    var srcW = daStateEnd(from, daAddDays(date, -1)).wt || 0, cyc = daCycleOn(from, date) || {}, grp = 'tx_' + Date.now();
    dest.forEach(function(d){ if(!(d.w > 0)) d.w = srcW; });
    var wavg = dest.reduce(function(s, d){ return s + d.n * d.w; }, 0) / tot;
    old.forEach(function(id){ deleteTX(id); });
    addTX({type:'transfer_out', date:date, unit:from, fishNo:tot, avgWt:+wavg.toFixed(2), transferType:g('rf-type'), txGroup:grp, batch:cyc.batch || '', _skipValidation:true});
    dest.forEach(function(d){ addTX({type:'transfer_in', date:date, unit:d.u, fishNo:d.n, avgWt:d.w, transferType:g('rf-type'), txGroup:grp, batch:cyc.batch || '', _skipValidation:true}); });
    toast('✅ نقل من ' + from + ' لـ ' + dest.length + ' تانك · ' + tot.toLocaleString() + ' سمكة');
  }
  var rs = kind === 'harv' ? window._rgharv : window._rgtrans;   // a record dated before the period would vanish from the list → widen it
  if(rs && date < rs.from) rs.from = date; if(rs && rs.to && date > rs.to) rs.to = date;
  window._rgEdit = null; show(currentView, true);
}
function daRegExcel(kind){
  if(typeof XLSX === 'undefined'){ toast('مكتبة Excel مش جاهزة — جرّب تاني'); return; }
  var st = kind === 'harv' ? window._rgharv : window._rgtrans, rows = st.rows || [];
  var aoa = kind === 'harv' ? [['Date', 'Unit', 'Batch', 'Fish No', 'Total Weight', 'Av. Wt.', 'Adjustments', 'Buyer', 'Price', 'Comments', 'By']].concat(rows.map(function(r){ return [r.date, r.unit, r.batch, r.fish, r.kg, +r.avg.toFixed(2), r.adj || '', r.buyer, r.price, r.notes, r.by]; }))
    : [['Date', 'From Unit', 'Batch', 'To Units', 'Fish No', 'Type', 'By']].concat(rows.map(function(r){ return [r.date, r.from, r.batch, r.to, -r.fish, r.type, r.by]; }));
  var wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), kind === 'harv' ? 'Harvest' : 'Transfer');
  XLSX.writeFile(wb, (kind === 'harv' ? 'Harvest_' : 'Transfer_') + st.from + '_' + (st.to || daToday()) + '.xlsx');
}
VIEWS['tx-harvesting'] = renderHarvReg; VIEWS['tx-transfer'] = renderTransReg;
