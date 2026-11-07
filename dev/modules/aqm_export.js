// ══════════════════════════════════════════════════════════
//  FEEDING → AQUAMANAGER (Paste From Clipboard)
// ══════════════════════════════════════════════════════════
// AquaManager's Feeding screen pastes an Excel range with the columns
// Unit / Batch / Store / Feed / Feed Batch Code / Qty / Feeder / Feeding Method (its own error message says so).
// The names it uses are learned once from the farm's own AquaManager feeding Excel (unit names such as F2.S16.T01,
// store per farm, feed product names per pellet size); all editable. Then each day: one click copies the sheet's day.
var DA_AQX_KEY = 'daracqua_plan_v1_aqmexport';   // synced: {units:{norm:aqm}, store:{farm}, feed:{farm:{1,2,3}}, feeds:[...]}
var DA_AQX_COLS = ['Unit', 'Batch', 'Store', 'Feed', 'Feed Batch Code', 'Qty', 'Feeder', 'Feeding Method'];
function daAqxCfg(){ try{ return JSON.parse(localStorage.getItem(DA_AQX_KEY) || '{}') || {}; }catch(e){ return {}; } }
function daAqxSave(c){ localStorage.setItem(DA_AQX_KEY, JSON.stringify(c)); }
function daAqxSizeOfName(n){ var m = String(n || '').match(/(\d+(?:\.\d+)?)\s*mm\b/i); return m && ['1', '2', '3'].indexOf(m[1]) >= 0 ? m[1] : ''; }
// learn names from the farm's AquaManager feeding Excel (columns Unit, Store, Feed … ; a second sheet may list all feeds)
async function daAqxLearn(file){
  if(typeof XLSX === 'undefined'){ toast('مكتبة Excel مش جاهزة — جرّب تاني'); return; }
  var wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), {type:'array'}), c = daAqxCfg(), units = {}, store = {}, feedUse = {}, feeds = {};
  wb.SheetNames.forEach(function(sn, si){ var aoa = XLSX.utils.sheet_to_json(wb.Sheets[sn], {header:1, raw:true, defval:''}); if(!aoa.length) return;
    var hd = aoa[0].map(function(x){ return String(x).trim().toLowerCase(); }), iu = hd.indexOf('unit'), is = hd.indexOf('store'), iff = hd.indexOf('feed');
    if(iu >= 0){ aoa.slice(1).forEach(function(r){ var nm = String(r[iu] || '').trim(); if(!nm || !/\d/.test(nm)) return; var u = daNormUnit(nm), farm = u.split('.')[0]; units[u] = nm;
      if(is >= 0 && r[is]) store[farm] = String(r[is]).trim();
      if(iff >= 0 && r[iff]){ var f = String(r[iff]).trim(), z = daAqxSizeOfName(f); feeds[f] = 1; if(z){ var k = farm + '|' + z; (feedUse[k] = feedUse[k] || {})[f] = (feedUse[k][f] || 0) + 1; } } }); }
    else aoa.forEach(function(r){ r.forEach(function(v){ var s = String(v || '').trim(); if(/\d\s*mm|powder|cp/i.test(s)) feeds[s] = 1; }); });   // the list sheet
  });
  if(!Object.keys(units).length){ alert('⚠️ الملف ده مش فيه عمود Unit — ارفع ملف علف الأكوامانجر (Unit / Store / Feed / Quantity).'); return; }
  c.units = Object.assign(c.units || {}, units); c.store = Object.assign(c.store || {}, store); c.feeds = Object.keys(Object.assign({}, (c.feeds || []).reduce(function(o, f){ o[f] = 1; return o; }, {}), feeds)).sort();
  c.feed = c.feed || {}; Object.keys(feedUse).forEach(function(k){ var p = k.split('|'), best = Object.keys(feedUse[k]).sort(function(a, b){ return feedUse[k][b] - feedUse[k][a]; })[0]; (c.feed[p[0]] = c.feed[p[0]] || {})[p[1]] = best; });
  daAqxSave(c); toast('✅ اتعلمت ' + Object.keys(units).length + ' تانك و' + c.feeds.length + ' نوع علف من ملف الأكوامانجر'); daAqxOpen();
}
// the day's rows in AquaManager's format (tanks with feed only; "not fed" = no row)
function daAqxRows(farm, date){
  var c = daAqxCfg(), out = [], miss = {};
  _txLiveRows().filter(function(r){ return (r.farm === farm || String(r.unit).indexOf(farm + '.') === 0) && daTankNo(r.unit); })
    .sort(function(a, b){ var x = daTankNo(a.unit), y = daTankNo(b.unit); return x.s - y.s || x.t - y.t; })
    .forEach(function(r){ var kg = 0, size = '', fname = '';
      (daTxByUnit()[r.unit] || []).forEach(function(t){ if(t.type !== 'feeding' || t.deleted || t.date !== date) return; kg += parseFloat(t.kg) || 0; if(!size) size = String(t.size || daSizeOf(t.feed) || ''); if(!fname) fname = t.feed || ''; });
      if(!(kg > 0)) return;
      var feed = (c.feeds || []).indexOf(fname) >= 0 ? fname : ((c.feed || {})[farm] || {})[size] || '';
      if(!feed) miss['حجم ' + (size || '؟')] = 1;
      out.push([(c.units || {})[r.unit] || r.unit, '', (c.store || {})[farm] || '', feed, '', +kg.toFixed(3), '', '']); });
  return {rows:out, miss:Object.keys(miss)};
}
function daAqxTSV(rows){ return [DA_AQX_COLS].concat(rows).map(function(r){ return r.join('\t'); }).join('\r\n'); }
function daAqxOpen(){
  var st = window._fs; if(!st) return; var box = document.getElementById('fs-copybox'); if(!box) return;
  var c = daAqxCfg(), farm = st.farm, R = daAqxRows(farm, st.date), inp = 'padding:6px 9px;border:1.5px solid var(--line);border-radius:7px;font:inherit;font-size:13px', tot = R.rows.reduce(function(a, r){ return a + r[5]; }, 0);
  var h = '<div class="card" id="aqx-card" style="margin-bottom:12px;border:2px solid var(--teal)"><div class="card-title">📋 علف يوم ' + st.date + ' للأكوامانجر <button onclick="document.getElementById(&quot;fs-copybox&quot;).innerHTML=&quot;&quot;" style="border:0;background:none;cursor:pointer;color:var(--muted)">✕</button></div>';
  if(!c.units) h += '<div style="font-size:13px;margin-bottom:8px">أول مرة: ارفع ملف علف الأكوامانجر (زي اللي بتلزقوا منه — فيه Unit و Store و Feed) عشان الأداة تتعلم أسماء التانكات والمخازن والعلف زي ما هي في الأكوامانجر.</div>';
  h += '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px"><button id="aqx-learn" onclick="daAqxPickLearn()" style="' + inp + ';background:#fff;cursor:pointer">📥 ' + (c.units ? 'حدّث الأسماء من ملف الأكوامانجر' : 'ارفع ملف الأكوامانجر') + '</button>';
  if(c.units) h += '<button id="aqx-copy" class="savebtn" style="width:auto;padding:8px 16px" onclick="daAqxCopy()">📋 انسخ (' + R.rows.length + ' تانك · ' + tot.toFixed(1) + ' كجم)</button><button onclick="daAqxExcel()" style="' + inp + ';background:#fff;cursor:pointer">⬇️ Excel</button>';
  h += '</div>';
  if(c.units){
    h += '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;font-size:12px;margin-bottom:8px"><div class="field" style="margin:0"><label>Store لـ ' + daEsc(farm) + '</label><input id="aqx-store" data-nodirty="1" value="' + daEsc((c.store || {})[farm] || '') + '" style="' + inp + ';width:130px"/></div>'
      + ['1', '2', '3'].map(function(z){ return '<div class="field" style="margin:0"><label>Feed — حجم ' + z + ' مم</label><select id="aqx-f' + z + '" style="' + inp + ';max-width:190px"><option value="">—</option>' + (c.feeds || []).map(function(f){ return '<option' + (((c.feed || {})[farm] || {})[z] === f ? ' selected' : '') + '>' + daEsc(f) + '</option>'; }).join('') + '</select></div>'; }).join('')
      + '<button onclick="daAqxSaveNames()" style="' + inp + ';background:#fff;cursor:pointer">💾 حفظ الأسماء</button></div>';
    if(R.miss.length) h += '<div style="color:var(--amber);font-size:12px;margin-bottom:6px">⚠️ مفيش اسم علف في الأكوامانجر لـ: ' + R.miss.join('، ') + ' — اختاره فوق.</div>';
    if(!R.rows.length) h += '<div style="color:var(--muted);font-size:13px">مفيش علف متسجل في اليوم ده — احفظ الشيت الأول.</div>';
    else h += '<div style="overflow:auto;max-height:30vh" dir="ltr"><table id="aqx-t" style="border-collapse:collapse;font-size:11px"><tr style="background:#f1f5f9">' + DA_AQX_COLS.map(function(x){ return '<th style="padding:3px 6px;text-align:left">' + x + '</th>'; }).join('') + '</tr>'
      + R.rows.map(function(r){ return '<tr>' + r.map(function(v){ return '<td style="padding:2px 6px;border-top:1px solid #e2e8f0">' + daEsc(String(v)) + '</td>'; }).join('') + '</tr>'; }).join('') + '</table></div>'
      + '<div style="font-size:11px;color:var(--muted);margin-top:6px">في الأكوامانجر: Feeding ← نفس التاريخ (' + st.date + ') ← Paste From Clipboard. التانكات اللي متأكلتش مش في القايمة.</div>';
  }
  box.innerHTML = h + '</div>';
}
function daAqxPickLearn(){ var i = document.createElement('input'); i.type = 'file'; i.accept = '.xls,.xlsx'; i.id = 'aqx-file'; i.onchange = function(){ if(i.files[0]) daAqxLearn(i.files[0]); }; document.body.appendChild(i); i.click(); setTimeout(function(){ i.remove(); }, 60000); }
function daAqxSaveNames(){ var c = daAqxCfg(), farm = window._fs.farm; c.store = c.store || {}; c.feed = c.feed || {}; c.feed[farm] = c.feed[farm] || {};
  c.store[farm] = String((document.getElementById('aqx-store') || {}).value || '').trim(); ['1', '2', '3'].forEach(function(z){ c.feed[farm][z] = (document.getElementById('aqx-f' + z) || {}).value || ''; });
  daAqxSave(c); toast('✅ اتحفظت الأسماء'); daAqxOpen(); }
async function daAqxCopy(){
  var st = window._fs, R = daAqxRows(st.farm, st.date), txt = daAqxTSV(R.rows); window._aqxLast = txt;
  if(R.miss.length && !confirm('فيه تانكات من غير اسم علف في الأكوامانجر (' + R.miss.join('، ') + '). أنسخ برضه؟')) return;
  try{ await navigator.clipboard.writeText(txt); toast('📋 اتنسخ ' + R.rows.length + ' تانك — الزق في الأكوامانجر (Feeding ← ' + st.date + ' ← Paste From Clipboard)'); }
  catch(e){ toast('⚠️ المتصفح منعني أنسخ — استخدم ⬇️ Excel وانسخ منه'); }
}
function daAqxExcel(){
  if(typeof XLSX === 'undefined'){ toast('مكتبة Excel مش جاهزة — جرّب تاني'); return; }
  var st = window._fs, R = daAqxRows(st.farm, st.date), wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([DA_AQX_COLS].concat(R.rows)), 'Feeding'); XLSX.writeFile(wb, 'AquaManager_Feeding_' + st.farm + '_' + st.date + '.xlsx');
}
