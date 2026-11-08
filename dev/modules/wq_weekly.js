// ══════════════════════════════════════════════════════════
//  TESTING LOG: DAILY + WEEKLY (owner, 2026-11-08)
// ══════════════════════════════════════════════════════════
// Daily = temperature · pH · DO (the existing sheet). Weekly = ammonia (TAN) · nitrite · nitrate · alkalinity, per
// section, on the same screen (toggle at the top). Saved as the section's weekly record of that date (id wn-<sec>-<date>,
// the same record the digital twin reads), so the AquaManager copy of a day carries whatever was measured that day.
var DA_WQW_FIELDS = [['ammonia', 'TAN / NH₃', 'mg/L', 0, 50], ['nitrite', 'NO₂', 'mg/L', 0, 50], ['nitrate', 'NO₃', 'mg/L', 0, 500], ['alkalinity', 'Alkalinity', 'mg/L CaCO₃', 0, 1000]];
function daWqwSecs(farm){ var o = {}; _txLiveRows().forEach(function(r){ if(r.farm !== farm && String(r.unit).indexOf(farm + '.') !== 0) return; var k = r.section || daSecOf(r.unit); if(k && daSecNo(k) !== null) o[k] = 1; });   // same as the daily log: the tank's own farm and section
  return Object.keys(o).sort(function(a, b){ return daSecNo(a) - daSecNo(b); }); }
function daWqwModeBar(mode){
  var b = function(m, t){ var on = m === mode; return '<button id="wqs-mode-' + m + '" onclick="window._wqs.mode=&quot;' + m + '&quot;;show(&quot;wq-sheet&quot;,true)" style="padding:9px 16px;border-radius:8px;font:inherit;cursor:pointer;font-weight:' + (on ? '800' : '500') + ';border:2px solid ' + (on ? 'var(--teal)' : 'var(--line)') + ';background:' + (on ? 'var(--teal)' : '#fff') + ';color:' + (on ? '#fff' : 'inherit') + '">' + t + '</button>'; };
  return '<div class="card" style="margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">' + b('daily', '📅 يومي — حرارة · pH · أكسجين') + b('weekly', '🧪 أسبوعي — أمونيا · نيتريت · نترات · قلوية') + '</div>';
}
function renderWqWeekly(){
  var st = window._wqs, farms = daFarms(); if(!st.date) st.date = daToday(); if(!st.farm || farms.indexOf(st.farm) < 0) st.farm = farmFilter && farmFilter !== 'all' ? farmFilter : farms[0];
  var secs = daWqwSecs(st.farm), inp = 'padding:7px 9px;border:1.5px solid var(--line);border-radius:7px;font:inherit;font-size:13px', cin = inp + ';width:90px;text-align:center';
  var rec = {}; getTX().forEach(function(t){ if(t.type === 'water_quality' && !t.deleted && t.date === st.date && t.scope === 'section' && /^wn-/.test(t.id)) rec[t.unit] = t; });
  var h = '<div class="ph"><div><h2>🧪 شيت القياسات الأسبوعي</h2><p style="font-size:11px;color:var(--muted)">قراية واحدة لكل سكشن — الأمونيا بتتسجل مع علف الأسبوع في التوأم الرقمي لوحدها</p></div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap"><button id="wqs-aqx" onclick="daAqwOpen()" style="padding:9px 14px;border:1.5px solid var(--line);background:#fff;border-radius:8px;font:inherit;cursor:pointer">📤 للأكوامانجر</button>'
    + '<button id="wqw-save" class="savebtn" style="width:auto;padding:10px 22px" onclick="daWqwSave()">💾 حفظ الشيت</button></div></div><div id="wqs-aqbox"></div>' + daWqwModeBar('weekly');
  h += '<div class="card" style="margin-bottom:12px;display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end"><div class="field" style="margin:0"><label>التاريخ</label><input type="date" id="wqw-date" data-nodirty="1" value="' + st.date + '" max="' + daToday() + '" style="' + inp + '" onchange="window._wqs.date=this.value;show(&quot;wq-sheet&quot;,true)"/></div>'
    + '<div class="field" style="margin:0"><label>المزرعة</label><select id="wqw-farm" style="' + inp + '" onchange="window._wqs.farm=this.value;show(&quot;wq-sheet&quot;,true)">' + farms.map(function(f){ return '<option' + (f === st.farm ? ' selected' : '') + '>' + daEsc(f) + '</option>'; }).join('') + '</select></div></div>';
  h += '<div class="card"><div style="overflow-x:auto"><table class="wqs-t" dir="ltr"><thead><tr><th>Section</th>' + DA_WQW_FIELDS.map(function(f){ return '<th>' + f[1] + ' <span style="font-weight:400;font-size:10px">(' + f[2] + ')</span></th>'; }).join('') + '</tr></thead><tbody>';
  secs.forEach(function(sec, i){ var r = rec[sec] || {};
    h += '<tr><td class="wqs-sec">S-' + ('0' + daSecNo(sec)).slice(-2) + '</td>' + DA_WQW_FIELDS.map(function(f){ var v = r[f[0]]; return '<td><input id="wqw-' + i + '-' + f[0] + '" inputmode="decimal" value="' + (v === undefined || v === null ? '' : v) + '" style="' + cin + '"/></td>'; }).join('') + '</tr>'; });
  if(!secs.length) h += '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--muted)">مفيش سكاشن في المزرعة دي</td></tr>';
  return h + '</tbody></table></div><div style="font-size:11px;color:var(--muted);margin-top:6px">سيب الخانة فاضية لو القياس ده متعملش النهارده. الأرقام بتتحفظ مع قراية السكشن الأسبوعية لنفس اليوم.</div></div>';
}
function daWqwSave(){
  var st = window._wqs, secs = daWqwSecs(st.farm), n = 0, bad = [];
  secs.forEach(function(sec, i){
    var vals = {}, any = false;
    DA_WQW_FIELDS.forEach(function(f){ var e = document.getElementById('wqw-' + i + '-' + f[0]), raw = e ? String(e.value).trim() : '';
      if(raw === ''){ vals[f[0]] = null; return; } var v = parseFloat(raw.replace(',', '.'));
      if(isNaN(v) || v < f[3] || v > f[4]){ bad.push('S-' + daSecNo(sec) + ' ' + f[1]); return; } vals[f[0]] = v; any = true; });
    var id = 'wn-' + sec + '-' + st.date, old = getTX().filter(function(t){ return t.id === id && !t.deleted; })[0];
    if(old){ var ch = DA_WQW_FIELDS.some(function(f){ return (old[f[0]] === undefined ? null : old[f[0]]) !== vals[f[0]]; }); if(ch){ updateTX(id, vals); n++; } }
    else if(any){ addTX(Object.assign({id:id, type:'water_quality', date:st.date, unit:sec, scope:'section', section:sec, source:'weekly-n', _skipValidation:true}, vals)); n++; } });
  if(bad.length){ toast('⚠️ أرقام مش منطقية: ' + bad.join('، ')); return; }
  if(window._daActiveTab) window._daActiveTab.dirty = false;
  toast(n ? '✅ اتحفظت القياسات الأسبوعية لـ ' + n + ' سكشن' : 'مفيش تغيير'); show('wq-sheet', true);
}
if(!window._daWqwWrapped){
  window._daWqwWrapped = true;
  var _wqSheetPreW = VIEWS['wq-sheet'];
  VIEWS['wq-sheet'] = function(){
    window._wqs = window._wqs || {}; if(window._wqs.mode === 'weekly') return renderWqWeekly();
    var h = _wqSheetPreW.apply(this, arguments); if(typeof h !== 'string') return h;
    return h.replace('<div id="wqs-aqbox"></div>', '<div id="wqs-aqbox"></div>' + daWqwModeBar('daily'));
  };
}
