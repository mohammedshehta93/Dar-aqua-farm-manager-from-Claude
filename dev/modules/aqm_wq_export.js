// ══════════════════════════════════════════════════════════
//  TESTING LOG → AQUAMANAGER (Site Measurements)
// ══════════════════════════════════════════════════════════
// AquaManager keeps water readings as Site Measurements: Parameter / Site / Time / Zone / Value, with the SECTION inside
// the parameter's name ("Oxygen FH1.S01", "PH F1.S01", "TOTAL AMMONIA FH2 .S16" — spelled inconsistently) and ONE
// temperature per house ("Temperature FH1"). The exact names are learned once from the farm's Site Measurements Excel.
// Temperature sent = the average of the sections' readings that day (shown before copying).
var DA_AQW_KEY = 'daracqua_plan_v1_aqmwq';   // synced: {site, names:{farm:{sec:{do,ph,tan,no2,no3}}}, temp:{farm:name}}
var DA_AQW_COLS = ['Parameter', 'Site', 'Time', 'Zone', 'Value'];
var DA_AQW_KIND = [[/oxygen|\bdo\b/i, 'do'], [/^\s*ph\b/i, 'ph'], [/ammonia|\btan\b|nh3|nh4/i, 'tan'], [/nitrite|no2/i, 'no2'], [/nitrate|no3/i, 'no3']];
var DA_AQW_FIELD = {do:'do', ph:'ph', tan:'ammonia', no2:'nitrite', no3:'nitrate'};
function daAqwCfg(){ try{ return JSON.parse(localStorage.getItem(DA_AQW_KEY) || '{}') || {}; }catch(e){ return {}; } }
function daAqwParse(name){   // "Oxygen FH2. S01" → {kind:'do', farm:'F2', sec:1}; "Temperature FH1" → {kind:'temp', farm:'F1'}
  var s = String(name || '').trim(), t = s.match(/^temperature\s+f\s*h?\s*(\d)\s*$/i); if(t) return {kind:'temp', farm:'F' + t[1]};
  var m = s.match(/^(.*?)\s*f\s*h?\s*(\d)\s*\.?\s*s\s*0*(\d+)\s*$/i); if(!m) return null;
  var k = null; DA_AQW_KIND.forEach(function(x){ if(!k && x[0].test(m[1])) k = x[1]; }); return k ? {kind:k, farm:'F' + m[2], sec:+m[3]} : null;
}
async function daAqwLearn(file){
  if(typeof XLSX === 'undefined'){ toast('مكتبة Excel مش جاهزة — جرّب تاني'); return; }
  var wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), {type:'array'}), aoa = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {header:1, raw:true, defval:''});
  var hd = (aoa[0] || []).map(function(x){ return String(x).trim().toLowerCase(); }), ip = hd.indexOf('parameter'), is = hd.indexOf('site');
  if(ip < 0){ alert('⚠️ الملف ده مش Site Measurements من الأكوامانجر (مش لاقي عمود Parameter).'); return; }
  var c = daAqwCfg(), names = c.names || {}, temp = c.temp || {}, n = 0;
  aoa.slice(1).forEach(function(r){ var nm = String(r[ip] || '').trim(), p = daAqwParse(nm); if(is >= 0 && r[is]) c.site = String(r[is]).trim(); if(!p) return; n++;
    if(p.kind === 'temp') temp[p.farm] = nm; else { ((names[p.farm] = names[p.farm] || {})[p.sec] = names[p.farm][p.sec] || {})[p.kind] = nm; } });
  c.names = names; c.temp = temp; localStorage.setItem(DA_AQW_KEY, JSON.stringify(c));
  toast('✅ اتعلمت أسماء ' + n + ' قياس من الأكوامانجر'); daAqwOpen();
}
function daAqwDate(d){ var p = String(d).split('-'); return (+p[1]) + '/' + (+p[2]) + '/' + p[0]; }   // AquaManager shows M/D/YYYY
function daAqwRows(farm, date){
  var c = daAqwCfg(), map = (c.names || {})[farm] || {}, out = [], temps = [], miss = {}, site = c.site || '';
  getTX().forEach(function(t){
    if(t.type !== 'water_quality' || t.deleted || t.date !== date || t.scope !== 'section' || String(t.unit).indexOf(farm + '.') !== 0) return;
    var sec = daSecNo(t.unit); if(parseFloat(t.temp) > 0) temps.push(parseFloat(t.temp));
    Object.keys(DA_AQW_FIELD).forEach(function(k){ var v = t[DA_AQW_FIELD[k]]; if(v === undefined || v === null || v === '' || isNaN(parseFloat(v))) return;
      var nm = (map[sec] || {})[k]; if(!nm){ miss[k + ' S' + sec] = 1; return; } out.push([nm, site, daAqwDate(date), '', +parseFloat(v)]); }); });
  out.sort(function(a, b){ return a[0].localeCompare(b[0]); });
  var avg = temps.length ? +(temps.reduce(function(a, b){ return a + b; }, 0) / temps.length).toFixed(1) : null;
  if(avg !== null){ var tn = (c.temp || {})[farm]; if(tn) out.unshift([tn, site, daAqwDate(date), '', avg]); else miss['temp'] = 1; }
  return {rows:out, avgTemp:avg, nTemp:temps.length, miss:Object.keys(miss)};
}
function daAqwOpen(){
  var st = window._wqs; if(!st) return; var box = document.getElementById('wqs-aqbox'); if(!box) return;
  var c = daAqwCfg(), R = daAqwRows(st.farm, st.date), inp = 'padding:6px 9px;border:1.5px solid var(--line);border-radius:7px;font:inherit;font-size:13px', dirty = window._daActiveTab && window._daActiveTab.dirty;
  var h = '<div class="card" id="aqw-card" style="margin-bottom:12px;border:2px solid var(--teal)"><div class="card-title">📤 قياسات يوم ' + st.date + ' للأكوامانجر <button onclick="document.getElementById(&quot;wqs-aqbox&quot;).innerHTML=&quot;&quot;" style="border:0;background:none;cursor:pointer;color:var(--muted)">✕</button></div>'
    + '<div style="font-size:12px;background:#f8fafc;border-radius:8px;padding:8px 10px;margin-bottom:8px;line-height:1.8">1️⃣ سجّل القياسات و<b>احفظ</b> · 2️⃣ <b>انسخ</b> · 3️⃣ في الأكوامانجر: <b>Site Measurements</b> ← Paste From Clipboard ← <b>Save</b>. <span style="color:var(--muted)">الأداة مش بتبعت حاجة لوحدها.</span></div>';
  if(dirty) h += '<div style="color:var(--amber);font-weight:700;font-size:13px;margin-bottom:8px">⚠️ فيه قياسات متحفظتش — احفظ الأول، النسخ بياخد المحفوظ بس.</div>';
  h += '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px"><button id="aqw-learn" onclick="daAqwPick()" style="' + inp + ';background:#fff;cursor:pointer">📥 ' + (c.names ? 'حدّث الأسماء من ملف الأكوامانجر' : 'ارفع ملف Site Measurements من الأكوامانجر') + '</button>';
  if(c.names) h += '<button id="aqw-copy" class="savebtn" style="width:auto;padding:8px 16px"' + (R.rows.length ? '' : ' disabled') + ' onclick="daAqwCopy()">📋 انسخ (' + R.rows.length + ' قياس)</button><button onclick="daAqwExcel()" style="' + inp + ';background:#fff;cursor:pointer"' + (R.rows.length ? '' : ' disabled') + '>⬇️ Excel</button>';
  h += '</div>';
  if(!c.names) h += '<div style="font-size:13px">أول مرة: صدّر Site Measurements من الأكوامانجر (أي يوم) وارفعه — الأداة بتتعلم منه أسماء القياسات لكل سكشن زي ما هي عندكم.</div>';
  else {
    if(R.avgTemp !== null) h += '<div style="font-size:12px;margin-bottom:6px">🌡️ الأكوامانجر بياخد حرارة واحدة للعنبر: هيتبعت <b>' + R.avgTemp + '°</b> (متوسط ' + R.nTemp + ' سكشن).</div>';
    if(R.miss.length) h += '<div style="color:var(--amber);font-size:12px;margin-bottom:6px">⚠️ مش لاقي اسم في الأكوامانجر لـ: ' + R.miss.join('، ') + ' — مش هيتنسخوا (ارفع ملف فيه القياسات دي).</div>';
    if(!R.rows.length) h += '<div style="color:var(--amber);font-size:14px;font-weight:700">مفيش قياسات محفوظة يوم ' + st.date + ' لسه.</div>';
    else h += '<div style="overflow:auto;max-height:30vh" dir="ltr"><table id="aqw-t" style="border-collapse:collapse;font-size:11px"><tr style="background:#f1f5f9">' + DA_AQW_COLS.map(function(x){ return '<th style="padding:3px 6px;text-align:left">' + x + '</th>'; }).join('') + '</tr>'
      + R.rows.map(function(r){ return '<tr>' + r.map(function(v){ return '<td style="padding:2px 6px;border-top:1px solid #e2e8f0">' + daEsc(String(v)) + '</td>'; }).join('') + '</tr>'; }).join('') + '</table></div>';
  }
  box.innerHTML = h + '</div>';
}
function daAqwPick(){ var i = document.createElement('input'); i.type = 'file'; i.accept = '.xls,.xlsx'; i.id = 'aqw-file'; i.onchange = function(){ if(i.files[0]) daAqwLearn(i.files[0]); }; document.body.appendChild(i); i.click(); setTimeout(function(){ i.remove(); }, 60000); }
async function daAqwCopy(){
  var st = window._wqs, R = daAqwRows(st.farm, st.date), txt = [DA_AQW_COLS].concat(R.rows).map(function(r){ return r.join('\t'); }).join('\r\n');
  try{ await navigator.clipboard.writeText(txt); toast('📋 اتنسخ ' + R.rows.length + ' قياس — الزق في الأكوامانجر: Site Measurements ← Paste From Clipboard'); }
  catch(e){ toast('⚠️ المتصفح منعني أنسخ — استخدم ⬇️ Excel وانسخ منه'); }
}
function daAqwExcel(){
  if(typeof XLSX === 'undefined'){ toast('مكتبة Excel مش جاهزة — جرّب تاني'); return; }
  var st = window._wqs, R = daAqwRows(st.farm, st.date), p = st.date.split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
  var ws = XLSX.utils.aoa_to_sheet([DA_AQW_COLS].concat(R.rows.map(function(r){ return [r[0], r[1], d, r[3], r[4]]; })), {cellDates:true});
  var wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Sheet'); XLSX.writeFile(wb, 'AquaManager_SiteMeasurements_' + st.farm + '_' + st.date + '.xlsx');
}
