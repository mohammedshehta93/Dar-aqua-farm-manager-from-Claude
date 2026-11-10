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
function daAqxTSV(rows, cols){ return [cols || DA_AQX_COLS].concat(rows).map(function(r){ return r.join('\t'); }).join('\r\n'); }
// mortality: AquaManager's Mortality paste wants Unit / Batch / Mortality No / Cause (its own message, 2026-11-07)
var DA_AQX_MCOLS = ['Unit', 'Batch', 'Mortality No', 'Cause'];
function daAqxMortRows(farm, date){
  var c = daAqxCfg(), out = [];
  _txLiveRows().filter(function(r){ return (r.farm === farm || String(r.unit).indexOf(farm + '.') === 0) && daTankNo(r.unit); })
    .sort(function(a, b){ var x = daTankNo(a.unit), y = daTankNo(b.unit); return x.s - y.s || x.t - y.t; })
    .forEach(function(r){ var n = 0; (daTxByUnit()[r.unit] || []).forEach(function(t){ if(t.type === 'mortality' && !t.deleted && t.date === date) n += parseInt(t.count) || 0; });
      if(n > 0) out.push([(c.units || {})[r.unit] || r.unit, '', n, daAqxCause(n)]); });   // Cause: AquaManager refuses a blank one on paste → the default cause chosen in the panel
  return out;
}
function daAqxCause(n){   // like AquaManager does by hand: the cause follows the count (up to the limit = the usual one)
  var c = daAqxCfg(), lim = parseFloat(c.mthr) || 100; return n > lim && c.mcause2 ? c.mcause2 : (c.mcause || 'Normal');   // AquaManager picks "Normal" by itself (owner's screenshot)
}
function daAqxSaveCause2(){ var c = daAqxCfg(); c.mcause2 = String(daVal('aqx-mcause2') || '').trim(); c.mthr = parseFloat(daVal('aqx-mthr')) || 100; daAqxSave(c); toast('✅ اتحفظ'); }
function daAqxSaveCause(v){ var c = daAqxCfg(); c.mcause = String(v || '').trim(); daAqxSave(c); toast(c.mcause ? '✅ النفوق هيتنسخ بالسبب: ' + c.mcause : 'السبب هيتنسخ فاضي'); }
async function daAqxCopyMort(){
  var st = window._fs, rows = daAqxMortAll(st.date), txt = daAqxTSV(rows, DA_AQX_MCOLS); window._aqxLast = txt;
  if(!rows.length){ toast('مفيش نفوق متسجل في اليوم ده'); return; }
  try{ await navigator.clipboard.writeText(txt); daAqxMark('mort', rows); daAqxOpen(); toast('📋 اتنسخ نفوق ' + rows.length + ' تانك — الزق في الأكوامانجر (Mortality ← ' + st.date + ' ← Paste From Clipboard)'); }
  catch(e){ toast('⚠️ المتصفح منعني أنسخ — استخدم ⬇️ Excel وانسخ منه'); }
}
function daAqxExcelMort(){
  if(typeof XLSX === 'undefined'){ toast('مكتبة Excel مش جاهزة — جرّب تاني'); return; }
  var st = window._fs, wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([DA_AQX_MCOLS].concat(daAqxMortAll(st.date))), 'Mortality');
  XLSX.writeFile(wb, 'AquaManager_Mortality_' + st.date + '.xlsx');
}
var DA_AQX_LOG = 'daaqx_copied';   // local: {farm|date|kind: {at, n, sig}}
function daAqxLog(){ try{ return JSON.parse(localStorage.getItem(DA_AQX_LOG) || '{}') || {}; }catch(e){ return {}; } }
function daAqxSig(rows){ return rows.map(function(r){ return r.join('|'); }).join(';'); }
function daAqxMark(kind, rows){ var L = daAqxLog(), st = window._fs; L['ALL|' + st.date + '|' + kind] = {at:new Date().toISOString(), n:rows.length, sig:daAqxSig(rows)}; localStorage.setItem(DA_AQX_LOG, JSON.stringify(L)); }
function daAqxStatus(kind, rows, label, screen){
  var st = window._fs, e = daAqxLog()['ALL|' + st.date + '|' + kind]; if(!e) return '';
  var t = new Date(e.at), hh = ('0' + t.getHours()).slice(-2) + ':' + ('0' + t.getMinutes()).slice(-2);
  if(e.sig === daAqxSig(rows)) return '<div style="font-size:12px;color:var(--green);margin-top:4px">✅ ' + label + ' اتنسخ الساعة ' + hh + ' (' + e.n + ' تانك) — الزقه في الأكوامانجر: ' + screen + ' ← ' + st.date + ' ← Paste From Clipboard ← Save.</div>';
  return '<div style="font-size:12px;color:var(--amber);font-weight:700;margin-top:4px">⚠️ ' + label + ' اتعدّل بعد ما اتنسخ الساعة ' + hh + ' — انسخه تاني والزقه في الأكوامانجر عشان يتحدّث.</div>';
}

function daAqxPickLearn(){ var i = document.createElement('input'); i.type = 'file'; i.accept = '.xls,.xlsx'; i.id = 'aqx-file'; i.onchange = function(){ if(i.files[0]) daAqxLearn(i.files[0]); }; document.body.appendChild(i); i.click(); setTimeout(function(){ i.remove(); }, 60000); }

// ── every farm in one copy: AquaManager keeps the whole site in one Feeding / Mortality screen (owner, 2026-11-09) ──
function daAqxFarms(){   // farms AquaManager knows (its tank names were learned); the others cannot be pasted there
  var c = daAqxCfg(), known = Object.keys(c.units || {}), all = daFarms();
  if(!known.length) return {inAqm:window._fs ? [window._fs.farm] : all, notIn:[]};
  var inA = all.filter(function(f){ return known.some(function(u){ return u.indexOf(f + '.') === 0; }); });
  return {inAqm:inA, notIn:all.filter(function(f){ return inA.indexOf(f) < 0; })};
}
function daAqxAll(date){ var F = daAqxFarms(), rows = [], miss = [], per = [];
  F.inAqm.forEach(function(f){ var R = daAqxRows(f, date), M = daAqxMortRows(f, date); rows = rows.concat(R.rows); R.miss.forEach(function(m){ miss.push(f + ' ' + m); });
    per.push({farm:f, tanks:R.rows.length, kg:R.rows.reduce(function(a, r){ return a + r[5]; }, 0), dead:M.reduce(function(a, r){ return a + r[2]; }, 0)}); });
  return {rows:rows, miss:miss, per:per, notIn:F.notIn};
}
function daAqxMortAll(date){ var out = []; daAqxFarms().inAqm.forEach(function(f){ out = out.concat(daAqxMortRows(f, date)); }); return out; }
function daAqxOpen(){
  var st = window._fs; if(!st) return; var box = document.getElementById('fs-copybox'); if(!box) return;
  var c = daAqxCfg(), A = daAqxAll(st.date), M = c.units ? daAqxMortAll(st.date) : [], md = M.reduce(function(a, r){ return a + r[2]; }, 0), tot = A.rows.reduce(function(a, r){ return a + r[5]; }, 0);
  var inp = 'padding:6px 9px;border:1.5px solid var(--line);border-radius:7px;font:inherit;font-size:13px', dirty = (window._daActiveTab && window._daActiveTab.dirty);
  var h = '<div class="card" id="aqx-card" style="margin-bottom:12px;border:2px solid var(--teal)"><div class="card-title">📋 علف ونفوق يوم ' + st.date + ' للأكوامانجر — المزرعة كلها <button onclick="document.getElementById(&quot;fs-copybox&quot;).innerHTML=&quot;&quot;" style="border:0;background:none;cursor:pointer;color:var(--muted)">✕</button></div>';
  h += '<div style="font-size:12px;background:#f8fafc;border-radius:8px;padding:8px 10px;margin-bottom:8px;line-height:1.8">1️⃣ سجّل علف ونافق كل المزارع و<b>احفظ</b> · 2️⃣ <b>انسخ</b> من هنا (المزارع كلها في نسخة واحدة) · 3️⃣ في الأكوامانجر على نفس اليوم: <b>Paste From Clipboard</b> ثم <b>Save</b>. '
    + '<span style="color:var(--muted)">الأداة مش بتبعت حاجة لوحدها.</span></div>';
  if(dirty) h += '<div style="color:var(--amber);font-weight:700;font-size:13px;margin-bottom:8px">⚠️ فيه كميات مكتوبة في الشيت ومتحفظتش — احفظ الأول، النسخ بياخد المحفوظ بس.</div>';
  if(!c.units) h += '<div style="font-size:13px;margin-bottom:8px">أول مرة: ارفع ملف علف الأكوامانجر (فيه Unit و Store و Feed) عشان الأداة تتعلم أسماء التانكات والمخازن والعلف زي ما هي في الأكوامانجر.</div>';
  else h += '<div id="aqx-per" style="display:flex;gap:8px;flex-wrap:wrap;font-size:12px;margin-bottom:8px">' + A.per.map(function(p){
      return '<span id="aqx-per-' + daEsc(p.farm) + '" style="padding:5px 10px;border-radius:8px;background:' + (p.tanks ? '#dcfce7' : '#fef9c3') + '"><b>' + daEsc(p.farm) + '</b>: ' + (p.tanks ? p.tanks + ' تانك · ' + p.kg.toFixed(1) + ' كجم' : '<b>العلف لسه ما اتحفظش</b>') + (p.dead ? ' · 💀 ' + p.dead : '') + '</span>'; }).join('')
    + A.notIn.map(function(f){ return '<span style="padding:5px 10px;border-radius:8px;background:#f1f5f9;color:var(--muted)"><b>' + daEsc(f) + '</b>: مش في الأكوامانجر — مش بيتنسخ</span>'; }).join('') + '</div>';
  h += '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin-bottom:8px"><button id="aqx-learn" onclick="daAqxPickLearn()" style="' + inp + ';background:#fff;cursor:pointer">📥 ' + (c.units ? 'حدّث الأسماء من ملف الأكوامانجر' : 'ارفع ملف الأكوامانجر') + '</button>';
  if(c.units) h += '<button id="aqx-copy" class="savebtn" style="width:auto;padding:8px 16px"' + (A.rows.length ? '' : ' disabled title="مفيش علف محفوظ في اليوم ده"') + ' onclick="daAqxCopy()">📋 انسخ العلف (' + A.rows.length + ' تانك · ' + tot.toFixed(1) + ' كجم)</button><button onclick="daAqxExcel()" style="' + inp + ';background:#fff;cursor:pointer">⬇️ Excel</button>'
    + '<span style="width:12px"></span><div class="field" style="margin:0"><label style="font-size:11px">سبب النفوق — لحد <input id="aqx-mthr" value="' + daEsc(String(c.mthr || 100)) + '" style="width:44px;padding:1px 4px;border:1px solid var(--line);border-radius:5px;font-size:11px" onchange="daAqxSaveCause2()"/> سمكة (مرة واحدة)</label><input id="aqx-mcause" value="' + daEsc(c.mcause || '') + '" placeholder="Normal" style="' + inp + ';width:140px" onchange="daAqxSaveCause(this.value)"/></div>'
    + '<div class="field" style="margin:0"><label style="font-size:11px">أكتر من كده (اختياري)</label><input id="aqx-mcause2" value="' + daEsc(c.mcause2 || '') + '" placeholder="سبب تاني" style="' + inp + ';width:120px" onchange="daAqxSaveCause2()"/></div>'
    + '<button id="aqx-copy-m" class="savebtn" style="width:auto;padding:8px 16px;background:#7c2d12"' + (M.length ? '' : ' disabled') + ' onclick="daAqxCopyMort()">📋 انسخ النفوق (' + M.length + ' تانك · ' + md + ' سمكة)</button><button onclick="daAqxExcelMort()" style="' + inp + ';background:#fff;cursor:pointer"' + (M.length ? '' : ' disabled') + '>⬇️ Excel</button>';
  h += '</div>';
  if(c.units){
    h += '<details style="margin-bottom:8px"' + (A.miss.length ? ' open' : '') + '><summary style="cursor:pointer;font-size:12px;font-weight:700">⚙️ أسماء المخازن والعلف في الأكوامانجر (لكل مزرعة)</summary><div style="overflow-x:auto;margin-top:6px"><table style="border-collapse:collapse;font-size:12px">'
      + daAqxFarms().inAqm.map(function(f){ return '<tr><td style="padding:4px 8px"><b>' + daEsc(f) + '</b></td><td style="padding:4px"><input id="aqx-store-' + daEsc(f) + '" data-nodirty="1" value="' + daEsc((c.store || {})[f] || '') + '" placeholder="Store" style="' + inp + ';width:120px"/></td>'
        + ['1', '2', '3'].map(function(z){ return '<td style="padding:4px"><select id="aqx-f' + z + '-' + daEsc(f) + '" title="Feed — حجم ' + z + ' مم" style="' + inp + ';max-width:170px"><option value="">' + z + ' مم —</option>' + (c.feeds || []).map(function(o){ return '<option' + (((c.feed || {})[f] || {})[z] === o ? ' selected' : '') + '>' + daEsc(o) + '</option>'; }).join('') + '</select></td>'; }).join('') + '</tr>'; }).join('')
      + '</table></div><button onclick="daAqxSaveNames()" style="' + inp + ';background:#fff;cursor:pointer;margin-top:6px">💾 حفظ الأسماء</button></details>';
    if(A.miss.length) h += '<div style="color:var(--amber);font-size:12px;margin-bottom:6px">⚠️ مفيش اسم علف في الأكوامانجر لـ: ' + A.miss.join('، ') + ' — اختاره في الإعدادات فوق.</div>';
    h += daAqxStatus('feed', A.rows, 'العلف', 'Feeding') + daAqxStatus('mort', M, 'النفوق', 'Mortality');
    if(!A.rows.length) h += '<div style="color:var(--amber);font-size:14px;font-weight:700;margin-top:6px">مفيش علف محفوظ يوم ' + st.date + ' لسه في أي مزرعة.</div>';
    else h += '<div style="overflow:auto;max-height:30vh" dir="ltr"><table id="aqx-t" style="border-collapse:collapse;font-size:11px"><tr style="background:#f1f5f9">' + DA_AQX_COLS.map(function(x){ return '<th style="padding:3px 6px;text-align:left">' + x + '</th>'; }).join('') + '</tr>'
      + A.rows.map(function(r){ return '<tr>' + r.map(function(v){ return '<td style="padding:2px 6px;border-top:1px solid #e2e8f0">' + daEsc(String(v)) + '</td>'; }).join('') + '</tr>'; }).join('') + '</table></div>'
      + '<div style="font-size:11px;color:var(--muted);margin-top:6px">في الأكوامانجر على نفس التاريخ (' + st.date + '): العلف ← <b>Feeding</b>، والنفوق ← <b>Mortality</b> ← Paste From Clipboard. التانكات اللي متأكلتش مش في القايمة.</div>';
  }
  box.innerHTML = h + '</div>';
}
function daAqxSaveNames(){ var c = daAqxCfg(); c.store = c.store || {}; c.feed = c.feed || {};
  daAqxFarms().inAqm.forEach(function(f){ var se = document.getElementById('aqx-store-' + f); if(se) c.store[f] = String(se.value || '').trim(); c.feed[f] = c.feed[f] || {};
    ['1', '2', '3'].forEach(function(z){ var e = document.getElementById('aqx-f' + z + '-' + f); if(e) c.feed[f][z] = e.value || ''; }); });
  daAqxSave(c); toast('✅ اتحفظت الأسماء'); daAqxOpen(); }
async function daAqxCopy(){
  var st = window._fs, A = daAqxAll(st.date), txt = daAqxTSV(A.rows); window._aqxLast = txt;
  var none = A.per.filter(function(p){ return !p.tanks; }).map(function(p){ return p.farm; });
  if(none.length && !confirm('علف ' + none.join(' و') + ' لسه ما اتحفظش يوم ' + st.date + '. تنسخ الباقي برضه؟')) return;
  if(A.miss.length && !confirm('فيه تانكات من غير اسم علف في الأكوامانجر (' + A.miss.join('، ') + '). أنسخ برضه؟')) return;
  try{ await navigator.clipboard.writeText(txt); daAqxMark('feed', A.rows); daAqxOpen(); toast('📋 اتنسخ علف ' + A.rows.length + ' تانك (' + A.per.map(function(p){ return p.farm; }).join(' + ') + ') — الزق في الأكوامانجر: Feeding ← ' + st.date + ' ← Paste From Clipboard'); }
  catch(e){ toast('⚠️ المتصفح منعني أنسخ — استخدم ⬇️ Excel وانسخ منه'); }
}
function daAqxExcel(){
  if(typeof XLSX === 'undefined'){ toast('مكتبة Excel مش جاهزة — جرّب تاني'); return; }
  var st = window._fs, A = daAqxAll(st.date), wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([DA_AQX_COLS].concat(A.rows)), 'Feeding'); XLSX.writeFile(wb, 'AquaManager_Feeding_' + st.date + '.xlsx');
}
