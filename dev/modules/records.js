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
    return {id:t.id, date:t.date, unit:t.unit, batch:c.batch || '', fish:n, kg:kg, avg:n ? kg * 1000 / n : 0, adj:adj[t.unit + '|' + t.date] || 0, buyer:t.buyer || '', price:t.price || '', value:t.value || ((parseFloat(t.price) || 0) * kg), pack:t.pack || '', cats:(t.cats || []).map(function(x){ return x.c + ' ' + x.n; }).join(' · '), notes:t.notes || '', by:t.byName || t.by || ''}; })
    .filter(function(r){ return !q || (r.unit + ' ' + r.batch).toLowerCase().indexOf(q) >= 0; }).sort(function(a, b){ return a.date < b.date ? -1 : a.date > b.date ? 1 : a.unit.localeCompare(b.unit); });
}
function renderHarvReg(){
  var st = window._rgharv = window._rgharv || {}; if(!st.from) st.from = daAddDays(daToday(), -30);   // last 30 days (start of month hides yesterday on the 1st)
  var rows = st.rows = daHarvRows(st), f2 = function(v, d){ return (+v || 0).toLocaleString('en-US', {minimumFractionDigits:d, maximumFractionDigits:d}); }, th = 'padding:6px 8px;white-space:nowrap;text-align:right';
  var h = '<div class="ph"><div><h2>🎣 الحصاد</h2><p style="font-size:11px;color:var(--muted)">كل الحصاد في الفترة — كليك يمين على أي سطر (أو ⋮) للتعديل والحذف والإضافة</p></div></div>' + daRegBar('harv', st, rows.length);
  h += '<div class="card" style="padding:0;overflow:hidden" oncontextmenu="daRegCtx(event,&quot;harv&quot;,null)"><div style="overflow:auto;max-height:70vh" dir="ltr"><table id="rg-t" style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:#e2e8f0;position:sticky;top:0">'
    + ['Date', 'Unit', 'Batch', 'Fish No', 'Total Weight', 'Av. Wt.', 'Adjustments', 'Sizes', 'Sale Value', 'Buyer', 'Packaging Code', 'Comments', 'By', ''].map(function(x){ return '<th style="' + th + '">' + x + '</th>'; }).join('') + '</tr></thead><tbody>';
  var tf = 0, tk = 0;
  rows.forEach(function(r, i){ tf += r.fish; tk += r.kg;
    h += '<tr data-i="' + i + '" oncontextmenu="daRegCtx(event,&quot;harv&quot;,' + i + ')" style="border-bottom:1px solid #e2e8f0">' + [r.date, daEsc(r.unit), daEsc(r.batch), f2(r.fish, 0), f2(r.kg, 2), f2(r.avg, 2), r.adj || '', daEsc(r.cats), r.value ? f2(r.value, 2) : '', daEsc(r.buyer), daEsc(r.pack), daEsc(r.notes), daEsc(r.by)].map(function(v, k){ return '<td style="padding:5px 8px;white-space:nowrap;text-align:' + (k === 1 || k === 2 || k === 7 || k > 8 ? 'left' : 'right') + '">' + v + '</td>'; }).join('')
      + '<td><button onclick="daRegCtx(event,&quot;harv&quot;,' + i + ')" style="border:0;background:none;cursor:pointer;font-size:16px">⋮</button></td></tr>'; });
  h += '</tbody><tfoot><tr style="background:#f1f5f9;font-weight:700"><td></td><td></td><td></td><td style="padding:6px 8px;text-align:right">' + f2(tf, 0) + '</td><td style="padding:6px 8px;text-align:right">' + f2(tk, 2) + '</td><td style="padding:6px 8px;text-align:right">' + (tf ? 'AVG=' + f2(tk * 1000 / tf, 2) : '') + '</td><td></td><td></td><td style="padding:6px 8px;text-align:right">' + f2(rows.reduce(function(s, r){ return s + (r.value || 0); }, 0), 2) + '</td><td colspan="5"></td></tr></tfoot></table></div></div>' + daSizeCfgHtml();
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
    {t:'🗑 حذف', off:!can, f:function(){ if(!confirm('تحذف السجل ده؟ (' + r.date + ' · ' + (r.unit || r.from) + ')')) return; var ids = kind === 'harv' ? [r.id] : r.ids; ids.concat(daLinked(ids.concat([r.g || r.id]))).forEach(function(id){ deleteTX(id); }); toast('🗑 اتحذف'); show(currentView, true); }}); }
  daCtxMenu(ev, items);
}
// ── size categories (synced, editable) ──
var DA_SIZE_KEY = 'daracqua_plan_v1_sizes';
var DA_SIZE_DEF = [{n:'غير مصنف', from:0, to:0}, {n:'صغير', from:0, to:450}, {n:'طبيعي', from:450, to:550}, {n:'كبير', from:550, to:750}, {n:'كبير جداً', from:750, to:0}];
function daSizes(){ try{ var a = JSON.parse(localStorage.getItem(DA_SIZE_KEY) || 'null'); if(Array.isArray(a) && a.length) return a; }catch(e){} return DA_SIZE_DEF; }
function daSizeOk(c, avg){ if(!(avg > 0) || (!c.from && !c.to)) return true; return (!c.from || avg >= c.from) && (!c.to || avg < c.to); }
function daLinked(ids){ return getTX().filter(function(t){ return t.link && ids.indexOf(t.link) >= 0 && !t.deleted; }).map(function(t){ return t.id; }); }   // sample / adjustment saved with a record
// ── new / edit form (one panel for both kinds) ──
function daRegForm(kind, r, copy){
  var el = document.getElementById('rg-form'); if(!el) return; var units = daRegUnits(), inp = 'padding:7px 9px;border:1.5px solid var(--line);border-radius:7px;font:inherit;font-size:13px', cin = 'padding:5px 6px;border:1.5px solid var(--line);border-radius:6px;font:inherit;font-size:12px;width:80px;text-align:right';
  var opt = function(sel){ return '<option value="">—</option>' + units.map(function(u){ return '<option' + (u === sel ? ' selected' : '') + '>' + daEsc(u) + '</option>'; }).join(''); };
  var edit = r && !copy, date = r && !copy ? r.date : daToday(), src = r ? getTX().filter(function(t){ return t.id === (r.id || (r.out && r.out.id)); })[0] || {} : {};
  var adjRec = r ? getTX().filter(function(t){ return t.type === 'adjustment' && !t.deleted && t.link && (t.link === r.id || t.link === r.g); })[0] : null;
  var h = '<div class="card" style="margin-top:12px;border:2px solid var(--teal)"><div class="card-title">' + (edit ? '✏️ تعديل' : '➕ جديد') + ' — ' + (kind === 'harv' ? 'حصاد' : 'نقل') + '</div>';
  h += '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end"><div class="field" style="margin:0"><label>التاريخ</label><input type="date" id="rf-date" data-nodirty="1" value="' + date + '" max="' + daToday() + '" style="' + inp + '" oninput="daRegAvail()"/></div>';
  if(kind === 'harv'){
    var cats = src.cats && src.cats.length ? src.cats : (r ? [{c:'غير مصنف', n:r.fish, kg:r.kg, inv:'', price:r.price || ''}] : []);
    h += '<div class="field" style="margin:0"><label>التانك</label><select id="rf-unit" style="' + inp + '" onchange="daRegAvail()">' + opt(r && r.unit) + '</select><div id="rf-avail" style="font-size:11px;color:var(--muted)"></div></div>'
      + '<div class="field" style="margin:0"><label>المشتري</label><input id="rf-buyer" data-nodirty="1" value="' + daEsc(r ? r.buyer : '') + '" style="' + inp + ';width:130px"/></div><div class="field" style="margin:0"><label>Packaging Code</label><input id="rf-pack" data-nodirty="1" value="' + daEsc(src.pack || '') + '" style="' + inp + ';width:110px"/></div>'
      + '<div class="field" style="margin:0"><label>ملاحظات</label><input id="rf-notes" data-nodirty="1" value="' + daEsc(r ? r.notes : '') + '" style="' + inp + ';width:160px"/></div></div>';
    h += '<div style="overflow-x:auto;margin-top:10px" dir="ltr"><table id="rf-cats" style="border-collapse:collapse;font-size:12px"><tr style="background:#f1f5f9">' + ['Category', 'Fish (#)', 'Weight (Kg)', 'Invoiced Weight (Kg)', 'Price / Kg', 'Av. Weight (gr)', 'Total Fish (%)', 'Fish Weight (%)', 'Value'].map(function(x){ return '<th style="padding:5px 6px;white-space:nowrap">' + x + '</th>'; }).join('') + '</tr>'
      + daSizes().map(function(c, i){ var v = cats.filter(function(x){ return x.c === c.n; })[0] || {}; return '<tr><td style="padding:3px 6px;white-space:nowrap" title="' + (c.from || c.to ? (c.from || 0) + '–' + (c.to || '∞') + ' g' : '') + '">' + daEsc(c.n) + (c.from || c.to ? ' <span style="color:var(--muted);font-size:10px">' + (c.from || 0) + '–' + (c.to || '∞') + '</span>' : '') + '</td>'
        + ['n', 'kg', 'inv', 'price'].map(function(k){ return '<td style="padding:2px"><input id="rf-c' + i + '-' + k + '" type="number" data-nodirty="1" value="' + (v[k] || '') + '" style="' + cin + '" oninput="daRegAvail()"/></td>'; }).join('')
        + '<td id="rf-c' + i + '-avg" style="padding:3px 6px;text-align:right"></td><td id="rf-c' + i + '-pf" style="padding:3px 6px;text-align:right;color:var(--muted)"></td><td id="rf-c' + i + '-pw" style="padding:3px 6px;text-align:right;color:var(--muted)"></td><td id="rf-c' + i + '-val" style="padding:3px 6px;text-align:right"></td></tr>'; }).join('')
      + '<tr style="background:#f1f5f9;font-weight:700"><td style="padding:5px 6px">Totals</td><td id="rf-tn" style="padding:5px 6px;text-align:right"></td><td id="rf-tkg" style="padding:5px 6px;text-align:right"></td><td id="rf-tinv" style="padding:5px 6px;text-align:right"></td><td></td><td id="rf-tavg" style="padding:5px 6px;text-align:right"></td><td></td><td></td><td id="rf-tval" style="padding:5px 6px;text-align:right"></td></tr></table></div>';
    h += daRegOptsHtml(inp, adjRec, src, 'الحصاد');
  } else {
    var ins = r ? r.ins.map(function(t){ return {u:t.unit, n:t.fishNo, w:t.avgWt}; }) : [{u:'', n:'', w:''}];
    h += '<div class="field" style="margin:0"><label>من تانك</label><select id="rf-from" style="' + inp + '" onchange="daRegAvail()">' + opt(r && r.out ? r.out.unit : '') + '</select><div id="rf-avail" style="font-size:11px;color:var(--muted)"></div></div>'
      + '<div class="field" style="margin:0"><label>Transfer Type</label><input id="rf-type" data-nodirty="1" value="' + daEsc(r ? r.type : '') + '" placeholder="نقل / فرز" style="' + inp + ';width:110px"/></div><div class="field" style="margin:0"><label>Comments</label><input id="rf-notes" data-nodirty="1" value="' + daEsc(src.notes || '') + '" style="' + inp + ';width:160px"/></div></div>'
      + '<div style="overflow-x:auto;margin-top:10px" dir="ltr"><table id="rf-dest" style="border-collapse:collapse;font-size:12px"><tr style="background:#f1f5f9">' + ['Unit', 'Fish Before', 'Av. Wt. Before', 'Transferred Fish', 'Transfer Av.Wt.', 'New Fish', 'New Av.Wt.'].map(function(x){ return '<th style="padding:5px 6px;white-space:nowrap">' + x + '</th>'; }).join('') + '</tr>'
      + ins.map(function(d, i){ return daRegDestRow(i, d, opt); }).join('') + '</table></div>'
      + '<button onclick="daRegAddDest()" style="' + inp + ';background:#fff;cursor:pointer;margin-top:6px">➕ تانك تاني</button> <span style="font-size:12px">الإجمالي: <b id="rf-sum">0</b></span>';
    h += daRegOptsHtml(inp, adjRec, src, 'النقل');
  }
  h += '<div style="margin-top:12px;display:flex;gap:8px"><button id="rf-save" class="savebtn" style="width:auto;padding:9px 20px" onclick="daRegSave(&quot;' + kind + '&quot;)">💾 حفظ</button><button onclick="document.getElementById(&quot;rg-form&quot;).innerHTML=&quot;&quot;" style="' + inp + ';background:#fff;cursor:pointer">إلغاء</button></div></div>';
  el.innerHTML = h; window._rgEdit = edit ? (kind === 'harv' ? [r.id] : r.ids) : null; window._rgEditKey = edit ? (kind === 'harv' ? r.id : r.g) : null; window._rgOpt = opt;
  daRegAvail(); el.scrollIntoView({behavior:'smooth', block:'center'});
}
var DA_ADJ_TYPES = ['فرق عد', 'هروب', 'سرقة / فقد', 'أخرى'];
function daRegOptsHtml(inp, adjRec, src, what){
  var sampleOn = src.id ? getTX().some(function(t){ return t.type === 'sampling' && t.link && (t.link === src.id || t.link === src.txGroup) && !t.deleted; }) : what === 'الحصاد';   // like AquaManager: on for harvest (every fish weighed), off for transfers (often estimated)
  return '<div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-end;margin-top:12px;padding:10px;background:#f8fafc;border-radius:8px">'
    + '<label style="display:flex;gap:6px;align-items:center;font-size:13px"><input type="checkbox" id="rf-sample"' + (sampleOn ? ' checked' : '') + '/> Is Sampling <span style="font-size:11px;color:var(--muted)">(متوسط وزن ' + what + ' يتحسب عينة)</span></label>'
    + '<label style="display:flex;gap:6px;align-items:center;font-size:13px"><input type="checkbox" id="rf-close" onchange="daRegAvail()"/> Close Unit <span style="font-size:11px;color:var(--muted)">(اقفل الدورة والباقي يبقى تسوية)</span></label>'
    + '<div class="field" style="margin:0"><label>Adjustments (فرق عد)</label><input id="rf-adj" type="number" data-nodirty="1" value="' + (adjRec && adjRec.source !== 'close' ? adjRec.count : '') + '" style="' + inp + ';width:90px" oninput="daRegAvail()"/></div>'
    + '<div class="field" style="margin:0"><label>Adjustment Type</label><select id="rf-adjt" style="' + inp + '">' + DA_ADJ_TYPES.map(function(x){ return '<option' + (adjRec && adjRec.reason === x ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></div>'
    + '<div id="rf-closeinfo" style="font-size:12px;color:var(--amber)"></div></div>';
}
function daRegDestRow(i, d, opt){ var inp = 'padding:5px 6px;border:1.5px solid var(--line);border-radius:6px;font:inherit;font-size:12px';
  return '<tr><td style="padding:2px"><select id="rf-d' + i + '-u" style="' + inp + '" onchange="daRegAvail()">' + opt(d.u) + '</select></td><td id="rf-d' + i + '-fb" style="padding:3px 6px;text-align:right;color:var(--muted)"></td><td id="rf-d' + i + '-wb" style="padding:3px 6px;text-align:right;color:var(--muted)"></td>'
    + '<td style="padding:2px"><input id="rf-d' + i + '-n" type="number" placeholder="العدد" value="' + (d.n || '') + '" data-nodirty="1" style="' + inp + ';width:90px" oninput="daRegAvail()"/></td><td style="padding:2px"><input id="rf-d' + i + '-w" type="number" placeholder="جم" value="' + (d.w || '') + '" data-nodirty="1" style="' + inp + ';width:90px" oninput="daRegAvail()"/></td>'
    + '<td id="rf-d' + i + '-fa" style="padding:3px 6px;text-align:right"></td><td id="rf-d' + i + '-wa" style="padding:3px 6px;text-align:right;font-weight:700"></td></tr>'; }
function daRegAddDest(){ var t = document.getElementById('rf-dest'); if(!t) return; var i = t.rows.length - 1; t.insertAdjacentHTML('beforeend', daRegDestRow(i, {u:'', n:'', w:(document.getElementById('rf-d0-w') || {}).value || ''}, window._rgOpt)); }
function daRegFishAt(unit, date){   // fish available on that date, adding back what the record being edited took out
  var s = daStateEnd(unit, daAddDays(date, -1)).fish || 0, ed = (window._rgEdit || []).concat(daLinked(window._rgEdit || []));
  (daTxByUnit()[unit] || []).forEach(function(t){ if(t.date !== date || t.deleted || ed.indexOf(t.id) >= 0) return; if(t.type === 'stocking' || t.type === 'transfer_in') s += parseInt(t.fishNo) || 0; else if(DA_SUB_FIELD[t.type]) s -= parseInt(t[DA_SUB_FIELD[t.type]]) || 0; });
  return Math.max(0, s);
}
function daRegCats(){ var out = []; daSizes().forEach(function(c, i){ var g = function(k){ return parseFloat((document.getElementById('rf-c' + i + '-' + k) || {}).value) || 0; };
  var n = Math.round(g('n')), kg = g('kg'); if(n || kg) out.push({c:c.n, n:n, kg:kg, inv:g('inv') || 0, price:g('price') || 0, i:i, def:c}); }); return out; }
function daRegAvail(){
  var d = (document.getElementById('rf-date') || {}).value, u = (document.getElementById('rf-unit') || document.getElementById('rf-from') || {}).value, a = document.getElementById('rf-avail'), avail = u && d ? daRegFishAt(u, d) : 0;
  if(a) a.textContent = u && d ? 'متاح يومها: ' + avail.toLocaleString('en-US') + ' سمكة · ' + Math.round(daStateEnd(u, daAddDays(d, -1)).wt || 0) + 'g' : '';
  var f2 = function(v, k){ return (+v || 0).toLocaleString('en-US', {minimumFractionDigits:k, maximumFractionDigits:k}); }, setT = function(id, v){ var e = document.getElementById(id); if(e) e.innerHTML = v; }, out = 0;
  if(document.getElementById('rf-cats')){
    var cs = daRegCats(), tn = cs.reduce(function(s, c){ return s + c.n; }, 0), tk = cs.reduce(function(s, c){ return s + c.kg; }, 0), ti = cs.reduce(function(s, c){ return s + (c.inv || c.kg); }, 0), tv = 0;
    daSizes().forEach(function(c, i){ ['avg', 'pf', 'pw', 'val'].forEach(function(k){ setT('rf-c' + i + '-' + k, ''); }); });
    cs.forEach(function(c){ var avg = c.n ? c.kg * 1000 / c.n : 0, val = (c.inv || c.kg) * c.price; tv += val;
      setT('rf-c' + c.i + '-avg', avg ? '<span style="color:' + (daSizeOk(c.def, avg) ? 'inherit' : 'var(--red)') + '" title="' + (daSizeOk(c.def, avg) ? '' : 'المتوسط برّه حدود الحجم ده') + '">' + f2(avg, 2) + '</span>' : '');
      setT('rf-c' + c.i + '-pf', tn ? f2(c.n / tn * 100, 2) : ''); setT('rf-c' + c.i + '-pw', tk ? f2(c.kg / tk * 100, 2) : ''); setT('rf-c' + c.i + '-val', val ? f2(val, 2) : ''); });
    setT('rf-tn', f2(tn, 0)); setT('rf-tkg', f2(tk, 2)); setT('rf-tinv', f2(ti, 2)); setT('rf-tavg', tn ? f2(tk * 1000 / tn, 2) : ''); setT('rf-tval', tv ? f2(tv, 2) : ''); out = tn;
  }
  var t = document.getElementById('rf-dest');
  if(t){ for(var i = 0; i < t.rows.length - 1; i++){ var du = (document.getElementById('rf-d' + i + '-u') || {}).value, n = +(document.getElementById('rf-d' + i + '-n') || {}).value || 0, w = +(document.getElementById('rf-d' + i + '-w') || {}).value || 0; out += n;
      if(!du || !d){ ['fb', 'wb', 'fa', 'wa'].forEach(function(k){ setT('rf-d' + i + '-' + k, ''); }); continue; }
      var fb = daRegFishAt(du, d), wb = daStateEnd(du, daAddDays(d, -1)).wt || 0, wn = w || (u ? daStateEnd(u, daAddDays(d, -1)).wt : 0), fa = fb + n, wa = fa ? (fb * wb + n * wn) / fa : 0, mix = fb > 0 && wb > 0 && wn > 0 && Math.abs(wn - wb) / wb > 0.3;
      setT('rf-d' + i + '-fb', f2(fb, 0)); setT('rf-d' + i + '-wb', fb ? f2(wb, 2) : ''); setT('rf-d' + i + '-fa', n ? f2(fa, 0) : ''); setT('rf-d' + i + '-wa', n ? '<span style="color:' + (mix ? 'var(--amber)' : 'inherit') + '" title="' + (mix ? 'فرق كبير في الحجم بين السمك اللي في التانك واللي داخل' : '') + '">' + f2(wa, 2) + (mix ? ' ⚠️' : '') + '</span>' : ''); }
    setT('rf-sum', out.toLocaleString('en-US')); }
  var cl = document.getElementById('rf-close'), ci = document.getElementById('rf-closeinfo'), adj = parseInt((document.getElementById('rf-adj') || {}).value) || 0;
  if(ci) ci.textContent = cl && cl.checked && u && d ? 'هيتقفل والباقي (' + Math.max(0, avail - out - adj).toLocaleString('en-US') + ' سمكة) يتسجل تسوية' : '';
}
function daRegSave(kind){
  var g = function(id){ return String((document.getElementById(id) || {}).value || '').trim(); }, date = g('rf-date'), old = window._rgEdit || [];
  var adj = parseInt(g('rf-adj')) || 0, adjT = g('rf-adjt'), close = (document.getElementById('rf-close') || {}).checked, sample = (document.getElementById('rf-sample') || {}).checked;
  if(!date){ toast('⚠️ التاريخ'); return; }
  var drop = function(){ old.concat(daLinked(old.concat(window._rgEditKey ? [window._rgEditKey] : []))).forEach(function(id){ deleteTX(id); }); };
  if(kind === 'harv'){
    var u = g('rf-unit'), cs = daRegCats(), n = cs.reduce(function(s, c){ return s + c.n; }, 0), kg = cs.reduce(function(s, c){ return s + c.kg; }, 0);
    if(!u || !(n > 0) || !(kg > 0)){ toast('⚠️ اختار التانك واكتب العدد والوزن في سطر واحد على الأقل'); return; }
    if(cs.some(function(c){ return !(c.n > 0) || !(c.kg > 0); })){ toast('⚠️ كل سطر محتاج عدد ووزن مع بعض'); return; }
    var av = daRegFishAt(u, date); if(n + Math.max(0, adj) > av){ alert('⛔ التانك يومها فيه ' + av.toLocaleString() + ' سمكة بس — مينفعش تحصد ' + (n + Math.max(0, adj)).toLocaleString()); return; }
    drop();
    var id = 'hv-' + u + '-' + date + '-' + Date.now().toString(36), val = cs.reduce(function(s, c){ return s + (c.inv || c.kg) * c.price; }, 0), avg = +(kg * 1000 / n).toFixed(2);
    addTX({id:id, type:'harvesting', date:date, unit:u, fishNo:n, kg:+kg.toFixed(3), avgWt:avg, cats:cs.map(function(c){ return {c:c.c, n:c.n, kg:c.kg, inv:c.inv, price:c.price}; }), invKg:+cs.reduce(function(s, c){ return s + (c.inv || c.kg); }, 0).toFixed(3),
      price:cs.length === 1 ? cs[0].price : 0, value:+val.toFixed(2), buyer:g('rf-buyer'), pack:g('rf-pack'), notes:g('rf-notes'), _skipValidation:true});
    if(sample) addTX({id:'smp-' + id, type:'sampling', date:date, unit:u, avgWt:avg, sampleN:n, link:id, source:'harvest', notes:'متوسط وزن الحصاد', _skipValidation:true});
    if(adj) addTX({id:'adj-' + id, type:'adjustment', date:date, unit:u, count:adj, reason:adjT, link:id, source:'harvest', _skipValidation:true});
    if(close){ var rest = av - n - adj; if(rest > 0) addTX({id:'cls-' + id, type:'adjustment', date:date, unit:u, count:rest, reason:'قفل الدورة مع الحصاد', link:id, source:'close', _skipValidation:true}); }
    toast('✅ حصاد ' + u + ': ' + n.toLocaleString() + ' سمكة · ' + kg.toFixed(1) + ' كجم' + (close ? ' · الدورة اتقفلت' : ''));
  } else {
    var from = g('rf-from'), t = document.getElementById('rf-dest'), dest = [];
    for(var i = 0; i < t.rows.length - 1; i++){ var du = g('rf-d' + i + '-u'), dn = parseInt(g('rf-d' + i + '-n')) || 0, dw = parseFloat(g('rf-d' + i + '-w')) || 0; if(!du && !dn) continue; dest.push({u:du, n:dn, w:dw}); }
    if(!from || !dest.length){ toast('⚠️ اختار تانك المصدر والتانكات اللي رايحلها'); return; }
    if(dest.some(function(d){ return !d.u || !(d.n > 0) || d.u === from; })){ toast('⚠️ كل سطر محتاج تانك (غير المصدر) وعدد'); return; }
    var tot = dest.reduce(function(s, d){ return s + d.n; }, 0), avl = daRegFishAt(from, date);
    if(tot + Math.max(0, adj) > avl){ alert('⛔ ' + from + ' يومها فيه ' + avl.toLocaleString() + ' سمكة بس — مينفعش تنقل ' + tot.toLocaleString()); return; }
    var srcW = daStateEnd(from, daAddDays(date, -1)).wt || 0, cyc = daCycleOn(from, date) || {}, grp = 'tx_' + Date.now();
    dest.forEach(function(d){ if(!(d.w > 0)) d.w = srcW; });
    var wavg = dest.reduce(function(s, d){ return s + d.n * d.w; }, 0) / tot;
    drop();
    addTX({type:'transfer_out', date:date, unit:from, fishNo:tot, avgWt:+wavg.toFixed(2), transferType:g('rf-type'), notes:g('rf-notes'), txGroup:grp, batch:cyc.batch || '', _skipValidation:true});
    dest.forEach(function(d){ addTX({type:'transfer_in', date:date, unit:d.u, fishNo:d.n, avgWt:d.w, transferType:g('rf-type'), txGroup:grp, batch:cyc.batch || '', _skipValidation:true}); });
    if(sample && dest.some(function(d){ return d.w !== srcW; })) addTX({id:'smp-' + grp, type:'sampling', date:date, unit:from, avgWt:+wavg.toFixed(2), sampleN:tot, link:grp, source:'transfer', notes:'متوسط وزن النقل', _skipValidation:true});
    if(adj) addTX({id:'adj-' + grp, type:'adjustment', date:date, unit:from, count:adj, reason:adjT, link:grp, source:'transfer', _skipValidation:true});
    if(close){ var rest2 = avl - tot - adj; if(rest2 > 0) addTX({id:'cls-' + grp, type:'adjustment', date:date, unit:from, count:rest2, reason:'قفل الدورة مع النقل', link:grp, source:'close', _skipValidation:true}); }
    toast('✅ نقل من ' + from + ' لـ ' + dest.length + ' تانك · ' + tot.toLocaleString() + ' سمكة' + (close ? ' · الدورة اتقفلت' : ''));
  }
  var rs = kind === 'harv' ? window._rgharv : window._rgtrans;   // a record dated before the period would vanish from the list → widen it
  if(rs && date < rs.from) rs.from = date; if(rs && rs.to && date > rs.to) rs.to = date;
  window._rgEdit = null; window._rgEditKey = null; show(currentView, true);
}
function daSizeCfgHtml(){
  if(!daCanEditUnits()) return ''; var inp = 'padding:5px 7px;border:1.5px solid var(--line);border-radius:6px;font:inherit;font-size:12px';
  return '<details class="card" style="margin-top:10px"><summary style="cursor:pointer;font-weight:700;font-size:13px">⚙️ أحجام البيع</summary><table style="border-collapse:collapse;font-size:12px;margin-top:6px"><tr style="background:#f1f5f9"><th style="padding:4px">الاسم</th><th style="padding:4px">من (جم)</th><th style="padding:4px">لحد (جم)</th></tr>'
    + daSizes().concat([{n:'', from:'', to:''}]).map(function(c, i){ return '<tr><td><input id="sz-' + i + '-n" data-nodirty="1" value="' + daEsc(c.n) + '" style="' + inp + ';width:110px"/></td><td><input id="sz-' + i + '-f" type="number" data-nodirty="1" value="' + (c.from || '') + '" style="' + inp + ';width:80px"/></td><td><input id="sz-' + i + '-t" type="number" data-nodirty="1" value="' + (c.to || '') + '" style="' + inp + ';width:80px"/></td></tr>'; }).join('')
    + '</table><div style="font-size:11px;color:var(--muted);margin:4px 0">فاضي = من غير حد · امسح الاسم عشان تشيل الحجم · أي متوسط برّه حدود حجمه بيتعلّم أحمر</div><button class="savebtn" style="width:auto;padding:7px 14px" onclick="daSizeSave()">💾 حفظ الأحجام</button></details>';
}
function daSizeSave(){ var out = []; for(var i = 0; i < 30; i++){ var e = document.getElementById('sz-' + i + '-n'); if(!e) break; var n = e.value.trim(); if(!n) continue;
  out.push({n:n, from:+(document.getElementById('sz-' + i + '-f') || {}).value || 0, to:+(document.getElementById('sz-' + i + '-t') || {}).value || 0}); }
  if(!out.length){ toast('⚠️ لازم حجم واحد على الأقل'); return; } localStorage.setItem(DA_SIZE_KEY, JSON.stringify(out)); toast('✅ اتحفظت الأحجام'); show('tx-harvesting', true); }
function daRegExcel(kind){
  if(typeof XLSX === 'undefined'){ toast('مكتبة Excel مش جاهزة — جرّب تاني'); return; }
  var st = kind === 'harv' ? window._rgharv : window._rgtrans, rows = st.rows || [];
  var aoa = kind === 'harv' ? [['Date', 'Unit', 'Batch', 'Fish No', 'Total Weight', 'Av. Wt.', 'Adjustments', 'Buyer', 'Price', 'Comments', 'By']].concat(rows.map(function(r){ return [r.date, r.unit, r.batch, r.fish, r.kg, +r.avg.toFixed(2), r.adj || '', r.buyer, r.price, r.notes, r.by]; }))
    : [['Date', 'From Unit', 'Batch', 'To Units', 'Fish No', 'Type', 'By']].concat(rows.map(function(r){ return [r.date, r.from, r.batch, r.to, -r.fish, r.type, r.by]; }));
  var wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), kind === 'harv' ? 'Harvest' : 'Transfer');
  XLSX.writeFile(wb, (kind === 'harv' ? 'Harvest_' : 'Transfer_') + st.from + '_' + (st.to || daToday()) + '.xlsx');
}
VIEWS['tx-harvesting'] = renderHarvReg; VIEWS['tx-transfer'] = renderTransReg;
