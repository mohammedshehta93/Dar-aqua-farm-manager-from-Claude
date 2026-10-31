// ══════════════════════════════════════════════════════════
//  TANK CYCLES + THE FARM ON ANY DATE
// ══════════════════════════════════════════════════════════
// Cycles are derived from the records, nothing to enter: a cycle opens when an EMPTY tank receives fish (stocking,
// transfer in, or the opening balance) and closes when the tank reaches 0 (harvest, transfer out, mortality, or a
// cycle-close adjustment). Stocking after that opens the next cycle. "Close cycle" records an ADJUSTMENT (its own
// type, like AquaManager's Adjustments — not mortality) for the fish left on paper (count difference).
DA_SUB_FIELD.adjustment = 'count'; DA_TX_PHASE.adjustment = 3; if(typeof DA_TYPE_SHORT !== 'undefined') DA_TYPE_SHORT.adjustment = 'تسوية';
function daUnitCycles(unit){
  var raw = daRawUnit(unit) || {}, base = raw.open ? raw.open.date : (raw.startDate || ''), fish = 0, wt = raw.avgWt || 0, cyc = [], cur = null;
  var open = function(d, n, w, how, batch){ cur = {no:cyc.length + 1, start:d, how:how, batch:batch || raw.batch || '', fish0:n, wt0:w, feed:0, dead:0, adj:0, outKg:0, outFish:0, harvKg:0, inKg:0, end:null, endBy:''}; cyc.push(cur); };
  if((raw.fishNo || 0) > 0 && base){   // opening balance (AquaManager import): the cycle began at the unit start date, with its totals so far
    fish = raw.fishNo; var o = raw.open || {};
    open(raw.startDate && raw.startDate <= base ? raw.startDate : base, raw.stockFish || fish, raw.startWt || wt, 'رصيد افتتاحي');
    cur.opening = {date:base, feed:+o.feed || 0, dead:+o.mort || 0, gain:o.gain > 0 ? +o.gain : null, bio:+o.bio || fish * wt / 1000};
    cur.feed = cur.opening.feed; cur.dead = cur.opening.dead; }
  var byDate = {}; ((daTxByUnit()[unit]) || []).forEach(function(t){ var d = String(t.date || '').slice(0, 10); if(d && !t.deleted && (!base || d >= base)) (byDate[d] = byDate[d] || []).push(t); });
  Object.keys(byDate).sort().forEach(function(d){
    var ev = byDate[d].slice().sort(daTxOrder), subs = 0, adds = 0;
    ev.forEach(function(t){ var f = DA_SUB_FIELD[t.type]; if(f) subs += parseInt(t[f]) || 0; if(t.type === 'stocking' || t.type === 'transfer_in') adds += parseInt(t.fishNo) || 0; });
    // emptied and restocked the same day (harvest / close, then new fish): the old cycle closes FIRST, then the new one opens
    if(cur && fish > 0 && adds > 0 && subs >= fish){
      var by0 = ''; ev.forEach(function(t){ var f = DA_SUB_FIELD[t.type]; if(!f) return; var n = parseInt(t[f]) || 0; if(n <= 0) return;
        if(t.type === 'mortality') cur.dead += n; else if(t.type === 'adjustment') cur.adj += n;
        else { var kg = parseFloat(t.kg) || 0, w2 = parseFloat(t.avgWt) || (kg > 0 ? kg * 1000 / n : wt); cur.outFish += n; cur.outKg += n * w2 / 1000; if(t.type === 'harvesting') cur.harvKg += kg || n * w2 / 1000; }
        by0 = t.type; });
      cur.end = d; cur.endBy = {harvesting:'حصاد', transfer_out:'نقل خارج', mortality:'نفوق', adjustment:'قفل يدوي'}[by0] || by0; cur.fish1 = 0; cur.wt1 = wt; cur = null; fish = 0;
      ev = ev.filter(function(t){ return !DA_SUB_FIELD[t.type]; });
    }
    ev.forEach(function(t){ if(t.type !== 'stocking' && t.type !== 'transfer_in') return; var n = parseInt(t.fishNo) || 0, w = parseFloat(t.avgWt) || wt; if(n <= 0) return;
      if(fish <= 0 || !cur){ open(d, n, w, t.type === 'stocking' ? 'تخزين' : 'نقل داخل', t.batch); } else { cur.inKg += n * w / 1000; }
      wt = fish + n > 0 ? (fish * wt + n * w) / (fish + n) : w; fish += n; });
    ev.forEach(function(t){
      if(t.type === 'sampling' && parseFloat(t.avgWt) > 0) wt = parseFloat(t.avgWt);
      else if(t.type === 'feeding' && cur) cur.feed += parseFloat(t.kg) || 0; });
    var by = '';
    ev.forEach(function(t){ var f = DA_SUB_FIELD[t.type]; if(!f || !cur) return; var n = parseInt(t[f]) || 0; if(n <= 0) return;
      if(t.type === 'mortality') cur.dead += n; else if(t.type === 'adjustment') cur.adj += n;
      else { var kg = parseFloat(t.kg) || 0, w2 = parseFloat(t.avgWt) || (kg > 0 ? kg * 1000 / n : wt); cur.outFish += n; cur.outKg += n * w2 / 1000; if(t.type === 'harvesting') cur.harvKg += kg || n * w2 / 1000; }
      fish = Math.max(0, fish - n); by = t.type; });
    if(cur && fish <= 0 && by){ cur.end = d; cur.endBy = {harvesting:'حصاد', transfer_out:'نقل خارج', mortality:'نفوق', adjustment:'قفل يدوي'}[by] || by; cur.fish1 = 0; cur.wt1 = wt; cur = null; }
  });
  if(cur){ cur.fish1 = fish; cur.wt1 = wt; }
  cyc.forEach(function(c){ c.days = daDaysBetween(c.start, c.end || daToday()); var gain = c.outKg + (c.end ? 0 : c.fish1 * c.wt1 / 1000) - c.fish0 * c.wt0 / 1000 - c.inKg; c.efcr = c.feed > 0 && gain > 0 ? c.feed / gain : null; });
  return cyc;
}
function daCycleOn(unit, date){ var c = daUnitCycles(unit); for(var i = c.length - 1; i >= 0; i--) if(c[i].start <= date && (!c[i].end || c[i].end >= date)) return c[i]; return null; }
function renderTankCycles(){
  var st = window._tc = window._tc || {}; if(!st.date) st.date = daToday();
  var can = ['admin', 'manager', 'engineer'].indexOf(currentUserRole) >= 0, inp = 'padding:7px 10px;border:1.5px solid var(--line);border-radius:8px;font:inherit;font-size:13px', th = 'padding:7px 6px;white-space:nowrap';
  var rows = _txLiveRows().filter(function(r){ return (farmFilter === 'all' || !farmFilter || r.farm === farmFilter || String(r.unit).indexOf(farmFilter + '.') === 0) && daTankNo(r.unit); })
    .sort(function(a, b){ var x = daTankNo(a.unit), y = daTankNo(b.unit); return (a.farm || '').localeCompare(b.farm || '') || x.s - y.s || x.t - y.t; });
  var past = st.date < daToday(), tot = {fish:0, bio:0, tanks:0};
  var h = '<div class="ph"><div><h2>📅 التانكات في تاريخ</h2><p style="font-size:11px;color:var(--muted)">حالة كل تانك في أي يوم — حتى لو فاضي النهارده — ودورات كل تانك من البداية</p></div></div>';
  h += '<div class="card" style="margin-bottom:12px;display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end"><div class="field" style="margin:0"><label>عرض المزرعة يوم</label><input type="date" id="tc-date" data-nodirty="1" value="' + st.date + '" max="' + daToday() + '" style="' + inp + '" onchange="window._tc.date=this.value;show(&quot;tank-cycles&quot;,true)"/></div>'
    + (past ? '<button onclick="window._tc.date=daToday();show(&quot;tank-cycles&quot;,true)" style="' + inp + ';background:#fff;cursor:pointer">↩ النهارده</button><span style="font-size:12px;color:var(--amber);font-weight:700">⏪ بتعرض المزرعة زي ما كانت يوم ' + st.date + '</span>' : '') + '</div>';
  var body = '';
  rows.forEach(function(r){
    var s = daStateAt(r.unit, st.date), c = daCycleOn(r.unit, st.date), raw = daRawUnit(r.unit) || {}, vol = raw.volume || r.volume || 0, bio = (s.fish || 0) * (s.wt || 0) / 1000, has = (s.fish || 0) > 0 && c;
    if(has){ tot.fish += s.fish; tot.bio += bio; tot.tanks++; }
    body += '<tr style="border-bottom:1px solid var(--line);' + (has ? '' : 'opacity:.5') + '"><td style="' + th + ';font-weight:800">' + daEsc(r.unit) + '</td>'
      + '<td style="' + th + '">' + (has ? Math.round(s.fish).toLocaleString() : 'فاضي') + '</td><td style="' + th + '">' + (has ? Math.round(s.wt) + 'g' : '') + '</td><td style="' + th + '">' + (has ? Math.round(bio).toLocaleString() : '') + '</td>'
      + '<td style="' + th + '">' + (has && vol ? (bio / vol).toFixed(1) : '') + '</td><td style="' + th + '">' + (has ? '#' + c.no + ' · من ' + c.start + ' (' + daDaysBetween(c.start, st.date) + 'ي)' : '') + '</td><td style="' + th + '">' + daEsc(has ? c.batch || '' : '') + '</td>'
      + '<td style="' + th + '">' + (past ? ((r.fishNo || 0) > 0 ? 'فيه ' + Math.round(r.fishNo).toLocaleString() : 'فاضي') : '') + '</td>'
      + '<td style="' + th + '"><button data-u="' + daEsc(r.unit) + '" onclick="window._tc.unit=this.dataset.u;show(&quot;tank-cycles&quot;,true)" style="border:1px solid var(--line);background:#fff;border-radius:6px;cursor:pointer;padding:2px 8px">🔁 الدورات</button></td></tr>';
  });
  h += '<div class="card" style="margin-bottom:12px;font-size:13px">يوم <b>' + st.date + '</b>: <b>' + tot.tanks + '</b> تانك فيهم سمك · <b>' + Math.round(tot.fish).toLocaleString() + '</b> سمكة · <b>' + Math.round(tot.bio).toLocaleString() + '</b> كجم</div>';
  if(st.unit) h += daCyclesCard(st.unit, can);
  h += '<div class="card"><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:var(--deep);color:#fff">'
    + ['التانك', 'العدد', 'الوزن', 'الكتلة (كجم)', 'الكثافة', 'الدورة', 'الدفعة', past ? 'النهارده' : '', ''].map(function(x){ return '<th style="' + th + '">' + x + '</th>'; }).join('') + '</tr></thead><tbody>' + body + '</tbody></table></div></div>';
  return h;
}
function daCyclesCard(unit, can){
  var cs = daUnitCycles(unit), th = 'padding:6px 6px;white-space:nowrap', cur = cs.filter(function(c){ return !c.end; })[0];
  var h = '<div class="card" style="margin-bottom:12px" id="tc-card"><div class="card-title">🔁 دورات ' + daEsc(unit) + ' <button onclick="window._tc.unit=null;show(currentView,true)" style="border:0;background:none;cursor:pointer;color:var(--muted)">✕</button></div>';
  if(!cs.length) return h + '<div style="color:var(--muted);font-size:13px">التانك ده متخزنش قبل كده.</div></div>';
  h += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:#f1f5f9">'
    + ['#', 'البداية', 'النهاية', 'الأيام', 'بدأ بـ', 'العدد/الوزن أول', 'العلف (كجم)', 'نفوق', 'تسوية', 'خرج (كجم)', 'آخر عدد/وزن', 'FCR اقتصادي'].map(function(x){ return '<th style="' + th + '">' + x + '</th>'; }).join('') + '</tr></thead><tbody>';
  cs.slice().reverse().forEach(function(c){
    h += '<tr style="border-bottom:1px solid var(--line)"><td style="' + th + ';font-weight:800">' + c.no + '</td><td style="' + th + '">' + c.start + '</td><td style="' + th + '">' + (c.end ? c.end + ' (' + c.endBy + ')' : '<b style="color:var(--green)">مفتوحة</b>') + '</td><td style="' + th + '">' + c.days + '</td>'
      + '<td style="' + th + '">' + daEsc(c.how) + (c.batch ? ' · ' + daEsc(c.batch) : '') + '</td><td style="' + th + '">' + Math.round(c.fish0).toLocaleString() + ' · ' + Math.round(c.wt0) + 'g</td><td style="' + th + '">' + Math.round(c.feed).toLocaleString() + '</td>'
      + '<td style="' + th + '">' + c.dead.toLocaleString() + '</td><td style="' + th + '">' + (c.adj ? c.adj.toLocaleString() : '') + '</td><td style="' + th + '">' + Math.round(c.outKg).toLocaleString() + '</td>'
      + '<td style="' + th + '">' + Math.round(c.fish1 || 0).toLocaleString() + ' · ' + Math.round(c.wt1 || 0) + 'g</td><td style="' + th + '">' + (c.efcr ? c.efcr.toFixed(2) : '—') + '</td></tr>'; });
  h += '</tbody></table></div>';
  if(cur && can) h += '<div style="margin-top:10px;padding:10px;background:#fffbeb;border-radius:8px;font-size:12px">الدورة #' + cur.no + ' لسه مفتوحة وفيها <b>' + Math.round(cur.fish1).toLocaleString() + '</b> سمكة على الورق. لو التانك فضي فعلاً (فرق عد)، اقفلها: هيتسجل <b>تسوية</b> بالعدد ده — مش نفوق.'
    + '<div style="display:flex;gap:8px;align-items:flex-end;margin-top:6px"><div class="field" style="margin:0"><label>تاريخ القفل</label><input type="date" id="tc-close-date" data-nodirty="1" value="' + daToday() + '" min="' + cur.start + '" max="' + daToday() + '" style="padding:6px 8px;border:1.5px solid var(--line);border-radius:7px;font:inherit"/></div>'
    + '<button id="tc-close" class="savebtn" style="width:auto;padding:7px 14px;background:var(--amber)" data-u="' + daEsc(unit) + '" onclick="daCycleClose(this.dataset.u)">🔒 اقفل الدورة</button></div></div>';
  return h + '</div>';
}
function daCycleClose(unit){
  var d = (document.getElementById('tc-close-date') || {}).value || daToday(), s = daStateAt(unit, d), n = Math.round(s.fish || 0);
  if(!(n > 0)){ toast('التانك فاضي في التاريخ ده'); return; }
  if(!confirm('قفل دورة ' + unit + ' يوم ' + d + ':\nهيتسجل تسوية ' + n.toLocaleString() + ' سمكة (فرق عد) والتانك يبقى فاضي.\nأي تخزين بعد كده يبدأ دورة جديدة. تكمل؟')) return;
  addTX({id:'adj-' + unit + '-' + d, type:'adjustment', unit:unit, date:d, count:n, reason:'قفل الدورة — فرق عد', source:'cycle-close', _skipValidation:true});
  toast('🔒 اتقفلت الدورة — تسوية ' + n.toLocaleString() + ' سمكة'); show(currentView, true);
}
// ── registration ──
VIEWS['tank-cycles'] = renderTankCycles; VIEW_PERMS['tank-cycles'] = 'view_dashboard';
(function(){ var g = DA_NAV.filter(function(x){ return x.id === 'home'; })[0]; if(!g || g.items.some(function(i){ return i[0] === 'tank-cycles'; })) return;
  var at = g.items.map(function(i){ return i[0]; }).indexOf('site-overview'); g.items.splice(at >= 0 ? at + 1 : g.items.length, 0, ['tank-cycles', '📅', 'التانكات في تاريخ', 'Tanks on a date']); })();
