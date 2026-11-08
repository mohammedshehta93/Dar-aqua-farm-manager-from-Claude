// ══════════════════════════════════════════════════════════
//  SAMPLING SHEET — one sheet per farm, like the feed sheet (owner, 2026-11-08)
// ══════════════════════════════════════════════════════════
// Every tank with fish on the chosen day, grouped by section: previous sample (reference), average weight (g), fish
// weighed, change since the previous sample (shown while typing). A day already sampled is edited in place (no second
// record). Same input ids as before (sp-date, sp-wt-<unit>, sp-n-<unit>) so the printed-sheet photo still fills it.
function daSpLast(unit, date){ var b = null; getTX().forEach(function(t){ if(t.type === 'sampling' && t.unit === unit && !t.deleted && !t.link && t.date < date && parseFloat(t.avgWt) > 0 && (!b || t.date > b.date)) b = t; }); return b; }
function daSpOn(unit, date){ return getTX().filter(function(t){ return t.type === 'sampling' && t.unit === unit && t.date === date && !t.deleted && !t.link; })[0] || null; }
function renderSampSheet(){
  var st = window._sp = window._sp || {}, farms = daFarms(); if(!st.date) st.date = (typeof _sampSheetDate !== 'undefined' && _sampSheetDate) || daToday();
  if(farmFilter && farmFilter !== 'all') st.farm = farmFilter; if(!st.farm || farms.indexOf(st.farm) < 0) st.farm = farms[0] || '';
  _sampSheetDate = st.date;
  var inp = 'padding:7px 9px;border:1.5px solid var(--line);border-radius:7px;font:inherit;font-size:13px', cin = inp + ';width:84px;text-align:center';
  var units = _txLiveRows().filter(function(r){ return (r.farm === st.farm || String(r.unit).indexOf(st.farm + '.') === 0) && daTankNo(r.unit); }).map(function(r){ return r.unit; })
    .filter(function(u){ return (daStateEnd(u, st.date).fish || 0) > 0; }).sort(function(a, b){ var x = daTankNo(a), y = daTankNo(b); return x.s - y.s || x.t - y.t; });
  var bySec = {}; units.forEach(function(u){ var s = daTankNo(u).s; (bySec[s] = bySec[s] || []).push(u); });
  var h = '<div class="ph"><div><h2>🔬 شيت العينات</h2><p style="font-size:11px;color:var(--muted)">متوسط الوزن لكل تانك — العينة اللي فاتت قدامك للمقارنة</p></div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap"><button id="sp-print" onclick="daOcrPrint(&quot;samp&quot;)" style="padding:9px 14px;border:1.5px solid var(--line);background:#fff;border-radius:8px;font:inherit;cursor:pointer">🖨️ شيت للطباعة</button>'
    + '<button id="sp-photo" onclick="daOcrPick(&quot;samp&quot;)" style="padding:9px 14px;border:1.5px solid var(--teal);background:#fff;color:var(--teal);border-radius:8px;font:inherit;cursor:pointer;font-weight:700">📷 من صورة</button>'
    + '<button id="sp-save" class="savebtn" style="width:auto;padding:10px 22px" onclick="daSpSave()">💾 حفظ الشيت</button></div></div>';
  h += '<div class="card" style="margin-bottom:12px;display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end"><div class="field" style="margin:0"><label>التاريخ</label><input type="date" id="sp-date" data-nodirty="1" value="' + st.date + '" max="' + daToday() + '" style="' + inp + '" onchange="window._sp.date=this.value;_sampSheetDate=this.value;show(&quot;tx-sampling&quot;,true)"/></div>'
    + '<div class="field" style="margin:0"><label>المزرعة</label><select id="sp-farm" style="' + inp + '" onchange="window._sp.farm=this.value;show(&quot;tx-sampling&quot;,true)">' + farms.map(function(f){ return '<option' + (f === st.farm ? ' selected' : '') + '>' + daEsc(f) + '</option>'; }).join('') + '</select></div></div>';
  if(!units.length) return h + '<div class="card" style="text-align:center;padding:30px;color:var(--muted)">مفيش تانكات فيها سمك في اليوم ده.</div>';
  Object.keys(bySec).sort(function(a, b){ return a - b; }).forEach(function(s){
    h += '<div class="card" style="margin-bottom:12px;padding:10px"><div class="card-title">سكشن ' + s + '</div><div style="overflow-x:auto" dir="ltr"><table class="fs-t sp-t" dir="ltr"><thead><tr><th class="fs-tank">Tank</th><th>Last</th><th>Avg wt (g)</th><th>Fish weighed</th><th>Change</th></tr></thead><tbody>';
    bySec[s].forEach(function(u){ var L = daSpLast(u, st.date), cur = daSpOn(u, st.date);
      h += '<tr data-u="' + daEsc(u) + '"><td class="fs-tank">' + daEsc(daTankNo(u).label) + '</td><td style="font-size:11px;color:var(--muted);white-space:nowrap;text-align:center">' + (L ? Math.round(L.avgWt) + ' g<br>' + L.date.slice(5) : '—') + '</td>'
        + '<td><input id="sp-wt-' + daEsc(u) + '" inputmode="decimal" value="' + (cur ? cur.avgWt : '') + '" style="' + cin + '" oninput="daSpCheck(this)" data-last="' + (L ? L.avgWt : '') + '" data-lastd="' + (L ? L.date : '') + '"/></td>'
        + '<td><input id="sp-n-' + daEsc(u) + '" inputmode="numeric" value="' + (cur && cur.sampleN ? cur.sampleN : '') + '" style="' + cin + ';width:70px"/></td><td class="sp-chg" style="font-size:12px;text-align:center;white-space:nowrap"></td></tr>'; });
    h += '</tbody></table></div></div>'; });
  return h + '<div style="font-size:11px;color:var(--muted);margin:0 4px 12px">سيب التانك فاضي لو متوزنش. الأصفر = الوزن نازل عن اللي فات أو أكتر من الضعف — اتأكد منه.</div>';
}
function daSpCheck(el){   // change since the last sample, while typing
  var tr = el.closest('tr'), c = tr && tr.querySelector('.sp-chg'), v = parseFloat(el.value), last = parseFloat(el.dataset.last); if(!c) return;
  el.classList.remove('ocr-low'); if(!(v > 0)){ c.textContent = ''; return; }
  if(!(last > 0)){ c.textContent = ''; return; }
  var d = v - last, days = Math.max(1, daDaysBetween(el.dataset.lastd, window._sp.date)), odd = v < last * 0.97 || v > last * 2;
  c.innerHTML = '<span style="color:' + (odd ? 'var(--amber)' : 'var(--green)') + ';font-weight:700">' + (d >= 0 ? '+' : '') + Math.round(d) + ' g</span><br><span style="color:var(--muted)">' + (d / days).toFixed(1) + ' g/d</span>';
  if(odd) el.classList.add('ocr-low');
}
function daSpSave(){
  var st = window._sp, date = st.date, n = 0, upd = 0, bad = [], odd = [];
  var rows = Array.prototype.slice.call(document.querySelectorAll('.sp-t tbody tr'));
  rows.forEach(function(tr){ var u = tr.dataset.u, w = String((document.getElementById('sp-wt-' + u) || {}).value || '').trim(); if(!w) return; var v = parseFloat(w.replace(',', '.'));
    if(!(v > 0 && v < 5000)) bad.push(daTankNo(u).label); else { var L = daSpLast(u, date); if(L && (v < L.avgWt * 0.97 || v > L.avgWt * 2)) odd.push(daTankNo(u).label); } });
  if(bad.length){ toast('⚠️ أوزان مش منطقية: ' + bad.join('، ')); return; }
  if(odd.length && !confirm('الوزن نازل عن العينة اللي فاتت أو زاد أكتر من الضعف في: ' + odd.join('، ') + '\nمتأكد من الأرقام؟')) return;
  rows.forEach(function(tr){
    var u = tr.dataset.u, w = String((document.getElementById('sp-wt-' + u) || {}).value || '').trim(), cur = daSpOn(u, date);
    if(!w){ return; } var avg = parseFloat(w.replace(',', '.')), N = parseInt((document.getElementById('sp-n-' + u) || {}).value) || 0, s = daStateEnd(u, date), L = daSpLast(u, date);
    var rec = {avgWt:avg, sampleN:N, biomass:(s.fish || 0) * avg / 1000, sgr:0, fcr:0, daysSinceLast:0, feedSinceLast:0};
    if(L){ rec.daysSinceLast = Math.max(1, daDaysBetween(L.date, date)); rec.sgr = computeSGR(L.avgWt, avg, rec.daysSinceLast);
      rec.feedSinceLast = getTX().filter(function(t){ return t.unit === u && t.type === 'feeding' && !t.deleted && t.date >= L.date && t.date <= date; }).reduce(function(a, t){ return a + (parseFloat(t.kg) || 0); }, 0);
      var wg = (avg - L.avgWt) / 1000 * (s.fish || 0); if(wg > 0 && rec.feedSinceLast > 0) rec.fcr = rec.feedSinceLast / wg; }
    if(cur){ if(+cur.avgWt !== avg || (+cur.sampleN || 0) !== N){ updateTX(cur.id, rec); upd++; } }
    else { addTX(Object.assign({id:'sp-' + u + '-' + date, type:'sampling', date:date, unit:u, source:'sheet', _skipValidation:true}, rec)); n++; } });
  if(window._daActiveTab) window._daActiveTab.dirty = false;
  toast(n + upd ? '✅ اتحفظت عينات ' + (n + upd) + ' تانك' : 'مفيش تغيير'); show('tx-sampling', true);
}
if(!window._daSpWrapped){ window._daSpWrapped = true; VIEWS['tx-sampling'] = renderSampSheet; }
