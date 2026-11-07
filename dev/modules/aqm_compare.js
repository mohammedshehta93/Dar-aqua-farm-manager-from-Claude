// ══════════════════════════════════════════════════════════
//  COMPARE WITH AQUAMANAGER (parallel run, owner 2026-11-02)
// ══════════════════════════════════════════════════════════
// In Site Overview: upload AquaManager's Site Overview export, compared tank by tank with this page on the SAME date
// (the date picked above). Differences are flagged with the likely cause; every comparison is logged so the weeks
// without differences are visible before AquaManager is switched off.
var DA_CMP_KEY = 'daracqua_plan_v1_aqmcmp';   // synced: [{date, at, tanks, same, diff, onlyA, onlyT}]
var DA_CMP_RULES = [
  ['fish', 'Fish No', 0, 0, 'ناقص سجل نفوق أو نقل أو حصاد'],
  ['dead', 'UTD Mortality No', 0, 0, 'نفوق متسجل في واحد بس'],
  ['wt', 'Av. Wt.', 0, 0.01, 'عينة مختلفة أو مش متسجلة'],
  ['bio', 'Biomass', 0, 0.01, 'من فرق العدد أو الوزن'],
  ['feed', 'UTD Feed Kg', 0.5, 0.01, 'يوم علف ناقص أو مختلف'],
  ['fcr', 'UTD Biol. FCR', 0.05, 0, 'من فرق العلف أو الوزن']];
function daCmpLog(){ try{ return JSON.parse(localStorage.getItem(DA_CMP_KEY) || '[]') || []; }catch(e){ return []; } }
function daCmpPick(){
  var i = document.createElement('input'); i.type = 'file'; i.accept = '.xls,.xlsx,.csv'; i.id = 'cmp-file';
  i.onchange = function(){ if(i.files && i.files[0]) daCmpFile(i.files[0]); }; document.body.appendChild(i); i.click(); setTimeout(function(){ i.remove(); }, 60000);
}
async function daCmpFile(file){
  if(typeof XLSX === 'undefined'){ toast('مكتبة Excel مش جاهزة — جرّب تاني'); return; }
  var wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), {type:'array', cellDates:false}), hdr = daAqmHeader(wb);
  if(!hdr){ alert('⚠️ الملف ده مش تصدير Site Overview من الأكوامانجر (مش لاقي أعمدة Unit Start Date و Mortality).'); return; }
  var M = hdr.map, num = function(row, k){ var v = M[k] === undefined ? '' : row[M[k]]; var x = parseFloat(String(v).replace(/,/g, '')); return isNaN(x) ? null : x; }, A = {};
  for(var r = hdr.row + 1; r < hdr.aoa.length; r++){ var row = hdr.aoa[r], nm = String(row[M.unit] || '').trim(); if(!nm || !/\d/.test(nm)) continue;
    var u = daNormUnit(nm); if(farmFilter && farmFilter !== 'all' && u.indexOf(farmFilter + '.') !== 0) continue;
    if((num(row, 'fish') || 0) <= 0) continue;
    A[u] = {fish:num(row, 'fish'), wt:num(row, 'wt'), bio:num(row, 'bio'), dead:num(row, 'mort'), feed:num(row, 'feed'), fcr:num(row, 'fcr')}; }
  window._cmp = {date:(window._ov || {}).date || daToday(), file:file.name, A:A}; daCmpRun(true);
}
function daCmpRun(log){
  var C = window._cmp; if(!C) return; var A = C.A, T = {}; daOverviewRows(C.date, farmFilter).forEach(function(r){ T[r.unit] = r; });
  var res = [], same = 0, diff = 0, onlyA = [], onlyT = [];
  Object.keys(A).forEach(function(u){ var a = A[u], t = T[u];
    if(!t){ onlyA.push(u); return; }
    var ds = []; DA_CMP_RULES.forEach(function(R){ var av = a[R[0]], tv = t[R[0]]; if(av === null || av === undefined || tv === null || tv === undefined) return;
      var d = tv - av, bad = R[2] === 0 && R[3] === 0 ? Math.round(Math.abs(d)) > 0 : (Math.abs(d) > R[2] && (R[3] === 0 || Math.abs(d) > Math.abs(av) * R[3]));
      if(bad) ds.push({k:R[0], name:R[1], a:av, t:tv, d:d, why:R[4]}); });
    if(ds.length){ diff++; res.push({unit:u, ds:ds}); } else same++; });
  Object.keys(T).forEach(function(u){ if(!A[u]) onlyT.push(u); });
  res.sort(function(x, y){ return x.unit.localeCompare(y.unit); });
  C.res = res; C.same = same; C.diff = diff; C.onlyA = onlyA.sort(); C.onlyT = onlyT.sort();
  if(log){ var L = daCmpLog().filter(function(x){ return !(x.date === C.date && x.farm === (farmFilter || 'all')); });
    L.push({date:C.date, farm:farmFilter || 'all', at:new Date().toISOString(), tanks:same + diff, same:same, diff:diff, onlyA:onlyA.length, onlyT:onlyT.length});
    L.sort(function(x, y){ return x.date < y.date ? -1 : 1; }); localStorage.setItem(DA_CMP_KEY, JSON.stringify(L.slice(-60))); }
  show('site-overview', true);
}
function daCmpCard(){
  var C = window._cmp, L = daCmpLog().filter(function(x){ return x.farm === (farmFilter || 'all'); }).slice(-8), f = function(v, k){ return v === null || v === undefined ? '' : (+v).toLocaleString('en-US', {minimumFractionDigits:k, maximumFractionDigits:k}); };
  if(!C && !L.length) return '';
  var h = '<div class="card" id="cmp-card" style="margin-bottom:10px;border:2px solid ' + (C && !C.diff && !C.onlyA.length && !C.onlyT.length ? 'var(--green)' : 'var(--amber)') + '">';
  if(C){
    var ok = !C.diff && !C.onlyA.length && !C.onlyT.length, k = function(v){ return {fish:0, dead:0, wt:2, bio:2, feed:2, fcr:2}[v]; };
    h += '<div class="card-title">⚖️ المقارنة مع الأكوامانجر — يوم ' + C.date + ' <span style="font-size:11px;color:var(--muted)">(' + daEsc(C.file) + ')</span> <button onclick="window._cmp=null;show(&quot;site-overview&quot;,true)" style="border:0;background:none;cursor:pointer;color:var(--muted)">✕</button></div>'
      + '<div style="display:flex;gap:10px;flex-wrap:wrap;font-size:13px;margin-bottom:8px">' + [['✅ متطابق', C.same, 'var(--green)'], ['⚠️ فيه فرق', C.diff, 'var(--amber)'], ['في الأكوامانجر بس', C.onlyA.length, 'var(--red)'], ['في الأداة بس', C.onlyT.length, 'var(--red)']].map(function(x){ return '<span style="padding:5px 10px;border-radius:8px;background:#f8fafc"><b style="color:' + (x[1] ? x[2] : 'var(--muted)') + '">' + x[1] + '</b> ' + x[0] + '</span>'; }).join('') + '</div>';
    if(ok) h += '<div style="color:var(--green);font-weight:700">كل التانكات متطابقة في اليوم ده 👌</div>';
    if(C.onlyA.length) h += '<div style="font-size:12px;margin:4px 0"><b>فيها سمك في الأكوامانجر ومش في الأداة:</b> ' + C.onlyA.map(daEsc).join('، ') + ' <span style="color:var(--muted)">— غالباً تخزين أو نقل مش متسجل</span></div>';
    if(C.onlyT.length) h += '<div style="font-size:12px;margin:4px 0"><b>فيها سمك في الأداة ومش في الأكوامانجر:</b> ' + C.onlyT.map(daEsc).join('، ') + ' <span style="color:var(--muted)">— غالباً حصاد أو نقل مش متسجل</span></div>';
    if(C.res.length) h += '<div style="overflow-x:auto;max-height:40vh;margin-top:6px" dir="ltr"><table id="cmp-t" style="border-collapse:collapse;font-size:12px;width:100%"><tr style="background:#f1f5f9">' + ['Unit', 'Column', 'AquaManager', 'This tool', 'Difference', ''].map(function(x){ return '<th style="padding:5px 8px;text-align:left">' + x + '</th>'; }).join('') + '</tr>'
      + C.res.map(function(r){ return r.ds.map(function(d, i){ return '<tr style="border-top:' + (i ? '0' : '1px solid #e2e8f0') + '"><td style="padding:4px 8px;font-weight:700">' + (i ? '' : daEsc(r.unit)) + '</td><td style="padding:4px 8px">' + d.name + '</td><td style="padding:4px 8px;text-align:right">' + f(d.a, k(d.k)) + '</td><td style="padding:4px 8px;text-align:right">' + f(d.t, k(d.k)) + '</td><td style="padding:4px 8px;text-align:right;color:var(--amber);font-weight:700">' + (d.d > 0 ? '+' : '') + f(d.d, k(d.k)) + '</td><td style="padding:4px 8px;color:var(--muted)" dir="rtl">' + d.why + '</td></tr>'; }).join(''); }).join('') + '</table></div>';
  }
  if(L.length) h += '<div style="font-size:12px;margin-top:10px;color:var(--muted)">📈 آخر المقارنات: ' + L.map(function(x){ return '<span style="margin-inline-end:10px">' + x.date + ' ' + (x.diff || x.onlyA || x.onlyT ? '⚠️ ' + (x.diff + x.onlyA + x.onlyT) : '✅') + '</span>'; }).join('') + '</div>';
  return h + '</div>';
}
