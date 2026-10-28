// ══════════════════════════════════════════════════════════
//  FCR PER GROWTH STAGE  +  WEEKLY REPORT
// ══════════════════════════════════════════════════════════
// Period = between two weight observations of one tank (stocking/opening balance, sampling, or a full harvest/transfer
// with weight). gain = B_end − B_start + dead kg + out kg − added kg (fish removed between samples valued at a weight
// interpolated by date). Biological FCR credits the dead fish, economic FCR does not. Stage = period mid-weight in the
// feed-size bands (daPlanCfg().bands). Aggregates are Σfeed / Σgain. Broodstock/quarantine excluded.
var DA_FCR_KEY = 'daracqua_plan_v1_fcr';        // synced (prefix daracqua_plan_v1)
var DA_WEEK_KEY = 'daracqua_plan_v1_weekend';   // synced: weekday the week ends on (0=Sun … 6=Sat)
var DA_FCR_DEFAULT = [1.2, 1.4, 1.7];
function daFcrExpected(){ try{ var a = JSON.parse(localStorage.getItem(DA_FCR_KEY) || 'null'); if(Array.isArray(a)) return a; }catch(e){} return []; }
function daFcrStages(){
  var ex = daFcrExpected();
  return daPlanCfg().bands.map(function(b, i){
    var e = parseFloat(ex[i]);
    return {i:i, max:b.max, label:b.label, exp:e > 0 ? e : DA_FCR_DEFAULT[Math.min(i, DA_FCR_DEFAULT.length - 1)]};
  });
}
function daStageOf(w, st){ st = st || daFcrStages(); for(var i = 0; i < st.length; i++) if(w < st[i].max || i === st.length - 1) return i; return 0; }
function daStageRange(st, i){ var lo = i ? st[i - 1].max : 0; return i === st.length - 1 ? '≥' + lo + 'g' : lo + '–' + st[i].max + 'g'; }

function daUnitPeriods(unit, list){
  var raw = daRawUnit(unit) || {}, base = raw.open ? raw.open.date : (raw.startDate || '');
  var fish = raw.fishNo || 0, wt = raw.avgWt || 0, out = [];
  var anchor = (fish > 0 && wt > 0 && base) ? {date:base, fish:fish, wt:wt} : null, pend = null;
  function reset(){ pend = {feed:0, add:0, rem:[], kgOut:0, feedDays:{}}; }
  reset();
  var byDate = {};
  (list || []).slice().sort(daTxOrder).forEach(function(t){ var d = String(t.date || '').slice(0, 10); if(d && (!base || d >= base)) (byDate[d] = byDate[d] || []).push(t); });
  function close(d, fishEnd, w2){
    if(!anchor) return;
    var span = Math.max(1, daDaysBetween(anchor.date, d)), w1 = anchor.wt, dead = 0, outKg = pend.kgOut;
    pend.rem.forEach(function(x){ var w = w1 + (w2 - w1) * Math.min(1, Math.max(0, daDaysBetween(anchor.date, x.d) / span)); if(x.dead) dead += x.n * w / 1000; else outKg += x.n * w / 1000; });
    var b1 = anchor.fish * w1 / 1000, b2 = fishEnd * w2 / 1000, gB = b2 - b1 + dead + outKg - pend.add, gE = b2 - b1 + outKg - pend.add;
    out.push({unit:unit, from:anchor.date, to:d, days:daDaysBetween(anchor.date, d), w1:w1, w2:w2, mid:(w1 + w2) / 2, feed:pend.feed,
      feedDays:Object.keys(pend.feedDays).length, gain:gB, gainE:gE, deadKg:dead, fcr:pend.feed > 0 && gB > 0 ? pend.feed / gB : null, efcr:pend.feed > 0 && gE > 0 ? pend.feed / gE : null});
  }
  Object.keys(byDate).sort().forEach(function(d){
    var ev = byDate[d], sampleW = 0, sub = 0, outW = 0;
    ev.forEach(function(t){ if(t.type === 'stocking' || t.type === 'transfer_in'){
      var n = parseInt(t.fishNo) || 0, w = parseFloat(t.avgWt) || wt; if(n <= 0) return;
      if(anchor) pend.add += n * w / 1000;
      wt = fish + n > 0 ? (fish * wt + n * w) / (fish + n) : w; fish += n;
      if(!anchor && wt > 0){ anchor = {date:d, fish:fish, wt:wt}; reset(); }   // first stocking starts the record
    }});
    ev.forEach(function(t){
      if(t.type === 'feeding'){ var kg = parseFloat(t.kg) || 0; if(kg > 0){ pend.feed += kg; pend.feedDays[d] = 1; } }
      else if(t.type === 'sampling' && parseFloat(t.avgWt) > 0) sampleW = parseFloat(t.avgWt);
    });
    ev.forEach(function(t){
      var f = DA_SUB_FIELD[t.type]; if(!f) return;
      var n = parseInt(t[f]) || 0; if(n <= 0) return; sub += n;
      if(t.type === 'mortality') pend.rem.push({d:d, n:n, dead:true});
      else{
        var kg = parseFloat(t.kg) || 0, w = parseFloat(t.avgWt) || (kg > 0 ? kg * 1000 / n : 0);
        if(w > 0){ pend.kgOut += n * w / 1000; outW = w; } else pend.rem.push({d:d, n:n, dead:false});
      }
    });
    fish = Math.max(0, fish - sub);
    if(sampleW > 0){ close(d, fish, sampleW); wt = sampleW; }
    else if(fish === 0 && sub > 0 && outW > 0){ close(d, 0, outW); }        // emptied by harvest/transfer with a known weight
    if(sampleW > 0 || (fish === 0 && sub > 0)){ anchor = fish > 0 && wt > 0 ? {date:d, fish:fish, wt:wt} : null; reset(); }
  });
  return out;
}
var _fcrMemo = {v:-1, list:[]};
function daAllPeriods(){
  if(_fcrMemo.v === _dataVer) return _fcrMemo.list;
  var by = daTxByUnit(), st = daFcrStages(), list = [];
  _txLiveRows().forEach(function(r){
    if(daIsBrood(r.unit)) return;
    daUnitPeriods(r.unit, by[r.unit] || []).forEach(function(p){
      p.farm = r.farm || ''; p.section = r.section || (daRawUnit(r.unit) || {}).section || p.farm; p.stage = daStageOf(p.mid, st); list.push(p);
    });
  });
  _fcrMemo = {v:_dataVer, list:list};
  return list;
}
// Why a period is not trusted (excluded from totals when `drop`)
function daPeriodIssue(p, st){
  var e = st[p.stage].exp;
  if(p.feed <= 0) return {drop:true, msg:'مفيش علف متسجل في الفترة'};
  if(p.days >= 3 && p.feedDays < p.days * 0.6) return {drop:true, msg:'العلف متسجل ' + p.feedDays + ' يوم من ' + p.days + ' — ناقص'};
  if(p.gain <= 0) return {drop:false, msg:'الوزن ثابت أو نزل — راجع العينة'};
  if(p.days < 5) return {drop:false, msg:'فترة قصيرة (' + p.days + ' يوم)'};
  if(p.fcr > e * 1.6) return {drop:false, msg:'أعلى بكتير من المتوقع — راجع العلف/العينة/النفوق'};
  if(p.fcr < e * 0.5) return {drop:false, msg:'أقل بكتير من المتوقع — غالباً العينة أعلى من الحقيقي'};
  return null;
}
function daFcrSum(periods, st){
  var s = {feed:0, gain:0, gainE:0, n:0, units:{}, expW:0};
  periods.forEach(function(p){ if((daPeriodIssue(p, st) || {}).drop) return;
    s.feed += p.feed; s.gain += p.gain; s.gainE += p.gainE; s.n++; s.units[p.unit] = 1; s.expW += st[p.stage].exp * Math.max(0, p.gain); });
  s.tanks = Object.keys(s.units).length;
  s.fcr = s.gain > 0 ? s.feed / s.gain : null; s.efcr = s.gainE > 0 ? s.feed / s.gainE : null;
  var gp = periods.filter(function(p){ return !(daPeriodIssue(p, st) || {}).drop; }).reduce(function(a, p){ return a + Math.max(0, p.gain); }, 0);
  s.exp = gp > 0 ? s.expW / gp : null;
  return s;
}
function daFcrFilter(o){
  return daAllPeriods().filter(function(p){ return (!o.farm || o.farm === 'all' || p.farm === o.farm) && (!o.from || p.to >= o.from) && (!o.to || p.to <= o.to); });
}
function daFcrColor(v, e){ if(v == null || !e) return 'var(--muted)'; return v <= e * 1.1 ? 'var(--green)' : v <= e * 1.25 ? 'var(--amber)' : 'var(--red)'; }
function daFcrCell(v, e){ return v == null ? '—' : '<b style="color:' + daFcrColor(v, e) + '">' + v.toFixed(2) + '</b>' + (e ? ' <span style="font-size:10px;color:var(--muted)">(' + (v >= e ? '+' : '') + Math.round((v / e - 1) * 100) + '%)</span>' : ''); }

// ── FCR page ──
function renderFcrStage(){
  var st = window._fcrSt = window._fcrSt || {days:60}, stages = daFcrStages(), today = daToday();
  var farm = farmFilter && farmFilter !== 'all' ? farmFilter : (st.farm || 'all');
  var from = st.days ? daAddDays(today, -st.days) : '';
  var ps = daFcrFilter({farm:farm, from:from, to:today});
  var sel = 'padding:7px 10px;border:1.5px solid var(--line);border-radius:8px;font:inherit;font-size:13px';
  var h = '<div class="ph"><div><h2>🎯 FCR حسب مرحلة النمو</h2><p style="font-size:11px;color:var(--muted)">محسوب من فترات العينات لكل تانك (علف ÷ زيادة الكتلة) — الأمهات والعزل مستبعدين</p></div></div>';
  h += '<div class="card" style="margin-bottom:12px"><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">';
  if(!(farmFilter && farmFilter !== 'all')) h += '<div class="field" style="margin:0"><label>المزرعة</label><select id="fcr-farm" style="' + sel + '" onchange="window._fcrSt.farm=this.value;show(&quot;fcr-stage&quot;,true)"><option value="all">الكل</option>'
    + daFarms().map(function(f){ return '<option' + (f === st.farm ? ' selected' : '') + '>' + daEsc(f) + '</option>'; }).join('') + '</select></div>';
  h += '<div class="field" style="margin:0"><label>الفترة</label><select id="fcr-days" style="' + sel + '" onchange="window._fcrSt.days=+this.value;show(&quot;fcr-stage&quot;,true)">'
    + [[30, 'آخر 30 يوم'], [60, 'آخر 60 يوم'], [90, 'آخر 90 يوم'], [180, 'آخر 6 شهور'], [0, 'كل البيانات']].map(function(o){ return '<option value="' + o[0] + '"' + (o[0] === st.days ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>';
  h += '</div></div>';
  if(!ps.length) return h + '<div class="card" style="text-align:center;padding:40px;color:var(--muted)">مفيش فترات بين عينتين في المدة دي.<br><span style="font-size:12px">FCR بيتحسب لما يبقى فيه وزن بداية (تخزين أو عينة) ووزن نهاية (عينة أو حصاد كامل) وعلف متسجل بينهم.</span></div>' + daFcrExpEditor(stages);
  var all = daFcrSum(ps, stages);
  h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:12px">'
    + daKpi('🎯', 'FCR بيولوجي', all.fcr == null ? '—' : all.fcr.toFixed(2), daFcrColor(all.fcr, all.exp), all.exp ? 'المتوقع ' + all.exp.toFixed(2) : '')
    + daKpi('💰', 'FCR اقتصادي (من غير النافق)', all.efcr == null ? '—' : all.efcr.toFixed(2), 'var(--deep)', '')
    + daKpi('🌾', 'علف', Math.round(all.feed).toLocaleString() + ' كجم', 'var(--deep)', all.n + ' فترة · ' + all.tanks + ' تانك')
    + daKpi('📈', 'زيادة الكتلة', Math.round(all.gain).toLocaleString() + ' كجم', 'var(--deep)', '') + '</div>';
  var th = 'padding:8px;text-align:right;white-space:nowrap';
  h += '<div class="card" style="margin-bottom:12px"><div class="card-title">📊 حسب المرحلة</div><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:var(--deep);color:#fff">'
    + ['المرحلة', 'الوزن', 'علف (كجم)', 'زيادة (كجم)', 'FCR بيولوجي', 'FCR اقتصادي', 'المتوقع', 'فترات', 'تانكات'].map(function(c){ return '<th style="' + th + '">' + c + '</th>'; }).join('') + '</tr></thead><tbody>';
  stages.forEach(function(sg){
    var s = daFcrSum(ps.filter(function(p){ return p.stage === sg.i; }), stages);
    h += '<tr style="border-bottom:1px solid var(--line)"><td style="padding:7px 8px;font-weight:700">' + daEsc(sg.label) + '</td><td style="padding:7px 8px">' + daStageRange(stages, sg.i) + '</td>'
      + '<td style="padding:7px 8px">' + Math.round(s.feed).toLocaleString() + '</td><td style="padding:7px 8px">' + Math.round(s.gain).toLocaleString() + '</td>'
      + '<td style="padding:7px 8px" data-fcr-stage="' + sg.i + '">' + daFcrCell(s.fcr, sg.exp) + '</td><td style="padding:7px 8px">' + (s.efcr == null ? '—' : s.efcr.toFixed(2)) + '</td>'
      + '<td style="padding:7px 8px">' + sg.exp.toFixed(2) + '</td><td style="padding:7px 8px">' + s.n + '</td><td style="padding:7px 8px">' + s.tanks + '</td></tr>';
  });
  h += '</tbody></table></div></div>';
  // by section × stage
  var secs = {}; ps.forEach(function(p){ (secs[p.section] = secs[p.section] || []).push(p); });
  h += '<div class="card" style="margin-bottom:12px"><div class="card-title">🏠 حسب السكشن</div><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:var(--deep);color:#fff"><th style="' + th + '">السكشن</th>'
    + stages.map(function(sg){ return '<th style="' + th + '">' + daEsc(sg.label) + '</th>'; }).join('') + '<th style="' + th + '">الإجمالي</th></tr></thead><tbody>';
  Object.keys(secs).sort(function(a, b){ return a.localeCompare(b, undefined, {numeric:true}); }).forEach(function(k){
    var tot = daFcrSum(secs[k], stages); if(!tot.n) return;
    h += '<tr style="border-bottom:1px solid var(--line)"><td style="padding:7px 8px;font-weight:700">' + daEsc(k) + '</td>'
      + stages.map(function(sg){ var s = daFcrSum(secs[k].filter(function(p){ return p.stage === sg.i; }), stages); return '<td style="padding:7px 8px">' + (s.n ? daFcrCell(s.fcr, sg.exp) : '') + '</td>'; }).join('')
      + '<td style="padding:7px 8px">' + daFcrCell(tot.fcr, tot.exp) + '</td></tr>';
  });
  h += '</tbody></table></div></div>';
  // periods needing a look
  var noFeed = ps.filter(function(p){ return p.feed <= 0; }).length;
  var bad = ps.filter(function(p){ return p.feed > 0; }).map(function(p){ return {p:p, is:daPeriodIssue(p, stages)}; }).filter(function(x){ return x.is; })
    .sort(function(a, b){ return a.p.to < b.p.to ? 1 : -1; });
  if(noFeed) h += '<div style="font-size:11px;color:var(--muted);margin:-4px 0 10px">' + noFeed + ' فترة من غير أي علف متسجل مش محسوبة (غالباً قبل ما تبدأوا تسجلوا العلف).</div>';
  if(bad.length){
    h += '<div class="card" style="margin-bottom:12px"><div class="card-title">🔍 فترات محتاجة مراجعة (' + bad.length + ')</div><div style="font-size:11px;color:var(--muted);margin-bottom:6px">اللي عليها 🚫 مش داخلة في الحساب (بيانات ناقصة)، والباقي داخل بس شكله غريب.</div><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:#f1f5f9">'
      + ['التانك', 'من', 'إلى', 'وزن', 'علف', 'زيادة', 'FCR', 'الملاحظة'].map(function(c){ return '<th style="padding:6px 8px;text-align:right">' + c + '</th>'; }).join('') + '</tr></thead><tbody>';
    bad.slice(0, 40).forEach(function(x){ var p = x.p;
      h += '<tr style="border-bottom:1px solid var(--line)"><td style="padding:6px 8px;font-weight:700">' + daEsc(p.unit) + '</td><td style="padding:6px 8px">' + p.from + '</td><td style="padding:6px 8px">' + p.to + '</td>'
        + '<td style="padding:6px 8px">' + Math.round(p.w1) + '→' + Math.round(p.w2) + 'g</td><td style="padding:6px 8px">' + n(p.feed, 1) + '</td><td style="padding:6px 8px">' + n(p.gain, 1) + '</td>'
        + '<td style="padding:6px 8px">' + (p.fcr == null ? '—' : p.fcr.toFixed(2)) + '</td><td style="padding:6px 8px">' + (x.is.drop ? '🚫 ' : '⚠️ ') + daEsc(x.is.msg) + '</td></tr>'; });
    h += '</tbody></table></div></div>';
  }
  return h + daFcrExpEditor(stages);
}
function daFcrExpEditor(stages){
  var can = currentUserRole === 'admin' || currentUserRole === 'manager' || currentUserRole === 'engineer';
  var h = '<div class="card"><div class="card-title">⚙️ FCR المتوقع لكل مرحلة</div><div style="font-size:11px;color:var(--muted);margin-bottom:8px">المراحل هي نفس أحجام العلف في توقع العلف والشراء. القيم الافتراضية تقريبية للبلطي — عدّلها على تجربتكم.</div><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">';
  stages.forEach(function(sg){ h += '<div class="field" style="margin:0"><label>' + daEsc(sg.label) + ' (' + daStageRange(stages, sg.i) + ')</label><input type="number" step="0.05" min="0.5" max="4" id="fcr-exp-' + sg.i + '" value="' + sg.exp + '"' + (can ? '' : ' disabled') + ' style="width:90px;padding:7px 10px;border:1.5px solid var(--line);border-radius:8px;font:inherit"/></div>'; });
  if(can) h += '<button class="savebtn" style="width:auto;padding:9px 18px" onclick="daSaveFcrExp()">💾 حفظ</button>';
  return h + '</div></div>';
}
function daSaveFcrExp(){
  var a = daFcrStages().map(function(sg){ var v = parseFloat((document.getElementById('fcr-exp-' + sg.i) || {}).value); return v > 0 ? v : sg.exp; });
  localStorage.setItem(DA_FCR_KEY, JSON.stringify(a)); toast('✅ اتحفظ FCR المتوقع'); show('fcr-stage', true);
}

// ── FCR alert: a section's last-28-day FCR well above expected (enough data only) ──
function daFcrAlerts(){
  var st = daFcrStages(), today = daToday(), secs = {}, out = [];
  daFcrFilter({farm:farmFilter, from:daAddDays(today, -28), to:today}).forEach(function(p){ (secs[p.section] = secs[p.section] || []).push(p); });
  Object.keys(secs).sort().forEach(function(k){
    var s = daFcrSum(secs[k], st);
    if(s.n < 2 || s.feed < 100 || s.fcr == null || !s.exp || s.fcr <= s.exp * 1.25) return;
    out.push({level:s.fcr > s.exp * 1.5 ? 'warn' : 'info', icon:'🎯', title:'FCR أعلى من المتوقع — ' + k, unit:'', section:k,
      msg:k + ': FCR ' + s.fcr.toFixed(2) + ' والمتوقع ' + s.exp.toFixed(2) + ' (آخر 4 أسابيع، ' + s.n + ' فترة) — راجع كميات العلف والعينات والنفوق', action:'fcr-stage'});
  });
  return out;
}

// ── WEEKLY REPORT ──
function daWeekEndDay(){ var v = parseInt(localStorage.getItem(DA_WEEK_KEY)); return v >= 0 && v <= 6 ? v : 6; }   // default: week Sun → Sat
function daDow(d){ return new Date(d + 'T00:00:00Z').getUTCDay(); }
function daLastClosedWeekEnd(today){ var d = daAddDays(today || daToday(), -1); while(daDow(d) !== daWeekEndDay()) d = daAddDays(d, -1); return d; }
function daWeeklyData(end, farm){
  var start = daAddDays(end, -6), st = daFcrStages(), inFarm = function(u){ var r = (daRawUnit(u) || {}); return !farm || farm === 'all' || r.farm === farm || String(u).indexOf(farm + '.') === 0; };
  var tx = getTX().filter(function(t){ return t.unit && t.date >= start && t.date <= end && inFarm(t.unit); });
  var d = {start:start, end:end, farm:farm || 'all', feed:0, feedBy:{}, dead:0, causes:{}, harvKg:0, harvFish:0, stocked:0, samples:{}, units:{}};
  tx.forEach(function(t){
    if(t.type === 'feeding'){ var kg = parseFloat(t.kg) || 0; d.feed += kg; var k = t.feed || '—'; d.feedBy[k] = (d.feedBy[k] || 0) + kg; d.units[t.unit + '|' + t.date] = 1; }
    else if(t.type === 'mortality'){ var c = parseInt(t.count) || 0; d.dead += c; var cl = daCauseLabel(t.cause); d.causes[cl] = (d.causes[cl] || 0) + c; }
    else if(t.type === 'harvesting'){ d.harvKg += parseFloat(t.kg) || 0; d.harvFish += parseInt(t.fishNo) || 0; }
    else if(t.type === 'stocking'){ d.stocked += parseInt(t.fishNo) || 0; }
    else if(t.type === 'sampling') d.samples[t.unit] = 1;
  });
  // stock at the start of the week (for mortality %), current stock, feeding completeness
  var stockStart = 0, tankDays = 0, fed = 0, missing = [];
  _txLiveRows().forEach(function(r){
    if(!inFarm(r.unit)) return;
    var s0 = daStateAt(r.unit, daAddDays(start, -1)); stockStart += s0.fish || 0;
    var s1 = daStateAt(r.unit, end); if(!(s1.fish > 0)) return;
    var miss = 0; for(var i = 0; i < 7; i++){ var day = daAddDays(start, i); if(day > daToday()) break; tankDays++; if(d.units[r.unit + '|' + day]) fed++; else miss++; }
    if(miss) missing.push({unit:r.unit, days:miss});
  });
  var rows = daRows().filter(function(r){ return inFarm(r.unit); });
  d.fishNow = rows.reduce(function(a, r){ return a + (r.fishNo || 0); }, 0);
  d.bioNow = rows.reduce(function(a, r){ return a + (r.biomass || (r.fishNo || 0) * (r.avgWt || 0) / 1000); }, 0);
  d.stockStart = stockStart; d.mortPct = stockStart > 0 ? d.dead / stockStart * 100 : null;
  d.completeness = tankDays ? fed / tankDays : 1; d.missing = missing.sort(function(a, b){ return b.days - a.days; });
  d.fcrWeek = daFcrSum(daFcrFilter({farm:farm, from:start, to:end}), st);
  d.fcr4w = daFcrSum(daFcrFilter({farm:farm, from:daAddDays(end, -27), to:end}), st);
  d.stages = st.map(function(sg){ var s = daFcrSum(daFcrFilter({farm:farm, from:daAddDays(end, -27), to:end}).filter(function(p){ return p.stage === sg.i; }), st); return {label:sg.label, exp:sg.exp, fcr:s.fcr, n:s.n}; });
  try{ d.harvestSoon = daHarvestSoon(14).filter(function(g){ return !farm || farm === 'all' || g.farm === farm; }); }catch(e){ d.harvestSoon = []; }
  try{ d.critical = generateAlerts().filter(function(a){ var k = String(a.unit || a.section || ''); return a.level === 'critical' && (!farm || farm === 'all' || !k || k === farm || k.indexOf(farm + '.') === 0); }).length; }catch(e){ d.critical = 0; }
  return d;
}
function daWeeklyText(d){
  var L = [], f1 = function(v){ return Math.round(v).toLocaleString(); };
  L.push('📑 *التقرير الأسبوعي — ' + daFarmName() + (d.farm !== 'all' ? ' · ' + d.farm : '') + '*');
  L.push('📅 من ' + d.start + ' إلى ' + d.end);
  if(d.completeness < 0.95) L.push('⚠️ بيانات العلف مكتملة ' + Math.round(d.completeness * 100) + '% بس — الأرقام ممكن تتغير');
  L.push('');
  L.push('🐟 السمك: ' + f1(d.fishNow) + ' · الكتلة ~' + f1(d.bioNow) + ' كجم');
  L.push('🌾 العلف: ' + f1(d.feed) + ' كجم' + (Object.keys(d.feedBy).length > 1 ? ' (' + Object.keys(d.feedBy).sort().map(function(k){ return k + ' ' + f1(d.feedBy[k]); }).join(' · ') + ')' : ''));
  var tc = Object.keys(d.causes).sort(function(a, b){ return d.causes[b] - d.causes[a]; }).slice(0, 3);
  L.push('💀 النفوق: ' + f1(d.dead) + (d.mortPct != null ? ' (' + d.mortPct.toFixed(2) + '%)' : '') + (tc.length ? ' — ' + tc.map(function(k){ return k + ' ' + d.causes[k]; }).join('، ') : ''));
  if(d.harvKg) L.push('🎣 الحصاد: ' + f1(d.harvKg) + ' كجم (' + f1(d.harvFish) + ' سمكة)');
  if(d.stocked) L.push('🐠 تخزين: ' + f1(d.stocked) + ' سمكة');
  L.push('🔬 عينات: ' + Object.keys(d.samples).length + ' تانك');
  var fw = d.fcrWeek, f4 = d.fcr4w;
  L.push('🎯 FCR الأسبوع: ' + (fw.fcr == null ? '— (مفيش عينات مكتملة)' : fw.fcr.toFixed(2) + (fw.exp ? ' / متوقع ' + fw.exp.toFixed(2) : '')));
  L.push('🎯 FCR آخر 4 أسابيع: ' + (f4.fcr == null ? '—' : f4.fcr.toFixed(2) + (f4.exp ? ' / متوقع ' + f4.exp.toFixed(2) : '')));
  d.stages.forEach(function(s){ if(s.n) L.push('   • ' + s.label + ': ' + s.fcr.toFixed(2) + ' (متوقع ' + s.exp.toFixed(2) + ')'); });
  if(d.harvestSoon.length){ L.push(''); L.push('🎣 حصاد خلال أسبوعين:'); d.harvestSoon.forEach(function(g){ L.push('   • ' + g.section + ': ' + g.units.length + ' تانك · ~' + f1(g.kg) + ' كجم · ' + (g.minDays <= 0 ? 'جاهز' : g.minDays + ' يوم')); }); }
  if(d.critical) L.push('🔴 تنبيهات حرجة: ' + d.critical);
  return L.join('\n');
}
function renderWeeklyReport(){
  var st = window._wr = window._wr || {}, farm = farmFilter && farmFilter !== 'all' ? farmFilter : (st.farm || 'all');
  if(!st.end) st.end = daLastClosedWeekEnd();
  var d = daWeeklyData(st.end, farm), txt = daWeeklyText(d);
  try{ localStorage.setItem('daracqua_wr_seen', st.end); }catch(e){}
  var sel = 'padding:7px 10px;border:1.5px solid var(--line);border-radius:8px;font:inherit;font-size:13px';
  var days = ['الأحد', 'الاتنين', 'التلات', 'الأربع', 'الخميس', 'الجمعة', 'السبت'];
  var h = '<div class="ph"><div><h2>📑 التقرير الأسبوعي</h2><p style="font-size:11px;color:var(--muted)">بيتحسب لوحده من البيانات — أي إدخال متأخر بيعدّل الأرقام</p></div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="savebtn" style="width:auto;padding:8px 16px" onclick="daCopyText(daWeeklyText(daWeeklyData(window._wr.end,' + (farm === 'all' ? '&quot;all&quot;' : '&quot;' + daEsc(farm) + '&quot;') + ')))">📋 نسخ</button>'
    + '<a class="savebtn" style="width:auto;padding:8px 16px;text-decoration:none" target="_blank" href="https://wa.me/?text=' + encodeURIComponent(txt) + '">📱 واتساب</a>'
    + '<button onclick="window.print()" style="padding:8px 14px;border:1.5px solid var(--line);background:#fff;border-radius:8px;font:inherit;cursor:pointer">🖨️ طباعة</button></div></div>';
  h += '<div class="card" style="margin-bottom:12px"><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">'
    + '<div class="field" style="margin:0"><label>آخر يوم في الأسبوع</label><input id="wr-end" type="date" value="' + st.end + '" max="' + daToday() + '" style="' + sel + '" onchange="window._wr.end=this.value;show(&quot;weekly-report&quot;,true)"/></div>';
  if(!(farmFilter && farmFilter !== 'all')) h += '<div class="field" style="margin:0"><label>المزرعة</label><select style="' + sel + '" onchange="window._wr.farm=this.value;show(&quot;weekly-report&quot;,true)"><option value="all">الكل</option>'
    + daFarms().map(function(f){ return '<option' + (f === st.farm ? ' selected' : '') + '>' + daEsc(f) + '</option>'; }).join('') + '</select></div>';
  h += '<div class="field" style="margin:0"><label>الأسبوع بيخلص يوم</label><select id="wr-wend" style="' + sel + '" onchange="localStorage.setItem(DA_WEEK_KEY,this.value);window._wr.end=daLastClosedWeekEnd();show(&quot;weekly-report&quot;,true)">'
    + days.map(function(x, i){ return '<option value="' + i + '"' + (i === daWeekEndDay() ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></div></div></div>';
  var pc = Math.round(d.completeness * 100);
  h += '<div class="card" style="margin-bottom:12px;background:' + (pc >= 95 ? '#f0fdf4' : '#fffbeb') + '"><b>' + (pc >= 95 ? '✅ بيانات العلف مكتملة' : '⚠️ بيانات العلف مكتملة ' + pc + '%') + '</b>'
    + (d.missing.length ? '<div style="font-size:12px;color:var(--muted);margin-top:4px">تانكات من غير علف متسجل: ' + d.missing.slice(0, 15).map(function(m){ return daEsc(m.unit) + ' (' + m.days + 'ي)'; }).join('، ') + (d.missing.length > 15 ? ' … و' + (d.missing.length - 15) + ' كمان' : '') + '</div>' : '') + '</div>';
  h += '<div class="card"><div id="wr-text" style="white-space:pre-wrap;line-height:1.9;font-size:13px">' + daEsc(txt.replace(/\*/g, '')) + '</div></div>';
  return h;
}
function daCopyText(text){
  if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function(){ toast('✅ اتنسخ'); }, function(){ daCopyFallback(text); });
  else daCopyFallback(text);
}
function daCopyFallback(text){ var t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try{ document.execCommand('copy'); toast('✅ اتنسخ'); }catch(e){} document.body.removeChild(t); }
// dashboard card: last closed week's report, until it has been opened on this device
function daWeeklyCard(){
  if(!currentUser || !canAccessView('weekly-report')) return '';
  var end = daLastClosedWeekEnd(); if(localStorage.getItem('daracqua_wr_seen') === end) return '';
  return '<div id="wr-card" class="card" style="margin-bottom:12px;display:flex;align-items:center;gap:12px;cursor:pointer;border:1.5px solid var(--teal)" onclick="window._wr={end:&quot;' + end + '&quot;};show(&quot;weekly-report&quot;)">'
    + '<span style="font-size:22px">📑</span><div style="flex:1"><b>تقرير الأسبوع جاهز</b><div style="font-size:12px;color:var(--muted)">' + 'من ' + daAddDays(end, -6) + ' إلى ' + end + ' — اضغط للعرض والإرسال</div></div><span>←</span></div>';
}

// ── registration ──
VIEWS['fcr-stage'] = renderFcrStage; VIEW_PERMS['fcr-stage'] = 'view_growth';
VIEWS['weekly-report'] = renderWeeklyReport; VIEW_PERMS['weekly-report'] = 'view_reports';
if(!window._daFcrWrapped){
  window._daFcrWrapped = true;
  var _genAlertsPreFcr = generateAlerts;
  generateAlerts = function(){
    var a = [];
    try{ a = _genAlertsPreFcr.apply(this, arguments) || []; }catch(e){ a = []; }
    try{ a = a.concat(daFcrAlerts()); }catch(e){ console.warn('fcr alerts:', e); }
    return a;
  };
  var _dashPreWeekly = VIEWS.dashboard;
  VIEWS.dashboard = renderDashboard = function(){ var h = _dashPreWeekly.apply(this, arguments); try{ h = daWeeklyCard() + h; }catch(e){} return h; };
}
(function(){
  var g = function(id){ return DA_NAV.filter(function(x){ return x.id === id; })[0]; };
  var home = g('home'), an = g('analysis'), rep = g('reports');
  if(home) home.items.forEach(function(it){ if(it[0] === 'alarms'){ it[0] = 'smart'; } });          // menu "التنبيهات الذكية" → the real alerts page
  if(home && !home.items.some(function(it){ return it[0] === 'alarms'; })) home.items.splice(4, 0, ['alarms', '🚨', 'تنبيهات الكثافة', 'Density']);
  delete DA_NAV_ALIAS.smart;
  if(an && !an.items.some(function(it){ return it[0] === 'fcr-stage'; })) an.items.splice(1, 0, ['fcr-stage', '🎯', 'FCR حسب المرحلة', 'FCR by Stage']);
  if(rep && !rep.items.some(function(it){ return it[0] === 'weekly-report'; })) rep.items.unshift(['weekly-report', '📑', 'التقرير الأسبوعي', 'Weekly Report']);
})();
