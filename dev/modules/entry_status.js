// ══════════════════════════════════════════════════════════
//  DAILY ENTRY STATUS (owner, 2026-11-09) — is everything entered today?
// ══════════════════════════════════════════════════════════
// One card per farm for a chosen day: feed (stocked tanks entered — "not fed" X counts — and which are missing, with a
// button that opens the sheet on them), mortality recorded, daily testing (sections entered / missing), weekly tests in
// the last 7 days, who entered, how many wait for review. Colours: green complete · amber partial · red missing (today
// after DA_ES_CUTOFF, or any past day) · grey not started yet (today, before the cut-off). A strip on the dashboard
// points to it when something is missing.
var DA_ES_CUTOFF = 16;   // hour of the day after which "not entered" is red
function daEsFarm(farm, date){
  var rows = daFsRows(farm, date).filter(function(r){ return r.fish > 0; }), units = {}, fed = {}, who = {}, dead = 0, pend = 0, wqDone = {}, wk = {};
  rows.forEach(function(r){ units[r.unit] = r; });
  var secs = daWqSections(farm), inFarm = function(t){ return units[t.unit] || (t.unit && daRawUnit(t.unit) && daRawUnit(t.unit).farm === farm) || String(t.unit).indexOf(farm + '.') === 0; };
  var wkFrom = daAddDays(date, -6);
  getTX().forEach(function(t){
    if(t.deleted || !t.date || t.date > date) return;
    if(t.type === 'water_quality' && t.scope === 'section' && secs.indexOf(t.unit) >= 0){
      if(t.date === date && ['temp', 'ph', 'do'].some(function(k){ return t[k] !== undefined && t[k] !== null && t[k] !== ''; })){ wqDone[t.unit] = 1; if(t.byName) who[t.byName] = 1; if(t.status === 'pending') pend++; }
      if(t.date >= wkFrom && ['ammonia', 'nitrite', 'nitrate', 'alkalinity'].some(function(k){ return t[k] !== undefined && t[k] !== null && t[k] !== ''; })) wk[t.unit] = t.date > (wk[t.unit] || '') ? t.date : wk[t.unit];
      return; }
    if(t.date !== date || !inFarm(t)) return;
    if(t.type === 'feeding'){ fed[t.unit] = 1; if(t.byName) who[t.byName] = 1; if(t.status === 'pending') pend++; }
    else if(t.type === 'mortality'){ dead += parseInt(t.count) || 0; if(t.byName) who[t.byName] = 1; if(t.status === 'pending') pend++; }
  });
  var missFeed = rows.filter(function(r){ return !fed[r.unit]; }), missWq = secs.filter(function(s){ return !wqDone[s]; });
  return {farm:farm, tanks:rows.length, fed:rows.length - missFeed.length, missFeed:missFeed, dead:dead, secs:secs.length, wq:secs.length - missWq.length, missWq:missWq,
    weekly:Object.keys(wk).length, who:Object.keys(who), pend:pend};
}
function daEsLate(date){ return date < daToday() || new Date().getHours() >= DA_ES_CUTOFF; }
function daEsColor(done, total, date){ if(!total) return 'grey'; if(done >= total) return 'green'; if(done > 0) return 'amber'; return daEsLate(date) ? 'red' : 'grey'; }
var DA_ES_BG = {green:'#dcfce7', amber:'#fef9c3', red:'#fee2e2', grey:'#f1f5f9'}, DA_ES_FG = {green:'#166534', amber:'#854d0e', red:'#991b1b', grey:'#475569'};
function daEsChip(c, txt){ return '<span style="display:inline-block;padding:4px 10px;border-radius:99px;background:' + DA_ES_BG[c] + ';color:' + DA_ES_FG[c] + ';font-weight:800;font-size:13px">' + txt + '</span>'; }
function renderEntryStatus(){
  var st = window._es = window._es || {}; if(!st.date) st.date = daToday();
  var reg = getFarmsRegistry(), farms = daFarms(), inp = 'padding:7px 9px;border:1.5px solid var(--line);border-radius:7px;font:inherit;font-size:13px';
  var h = '<div class="ph"><div><h2>📋 متابعة الإدخال اليومي</h2><p style="font-size:11px;color:var(--muted)">كل اللي اتسجل في اليوم — والناقص — لكل مزرعة. الأحمر بعد الساعة ' + (DA_ES_CUTOFF > 12 ? DA_ES_CUTOFF - 12 : DA_ES_CUTOFF) + ' العصر.</p></div></div>';
  h += '<div class="card" style="margin-bottom:12px"><div class="field" style="margin:0"><label>اليوم</label><input type="date" id="es-date" data-nodirty="1" value="' + st.date + '" max="' + daToday() + '" style="' + inp + '" onchange="window._es.date=this.value;show(&quot;entry-status&quot;,true)"/></div></div>';
  var allPend = getTX().filter(function(t){ return !t.deleted && t.status === 'pending'; }).length;
  if(allPend && canAccessView('review-queue')) h += '<div class="card" style="margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><b>✔️ ' + allPend + ' سجل مستني مراجعتك</b><button class="savebtn" style="width:auto;padding:8px 16px" onclick="show(&quot;review-queue&quot;)">افتح المراجعة</button></div>';
  if(!farms.length) return h + '<div class="card" style="text-align:center;color:var(--muted);padding:30px">مفيش مزارع فيها تانكات.</div>';
  farms.forEach(function(f){
    var s = daEsFarm(f, st.date), cf = daEsColor(s.fed, s.tanks, st.date), cw = daEsColor(s.wq, s.secs, st.date), name = reg[f] && reg[f] !== f ? f + ' — ' + reg[f] : f;
    h += '<div class="card es-farm" data-farm="' + daEsc(f) + '" style="margin-bottom:12px;border-inline-start:6px solid ' + DA_ES_FG[cf === 'green' && cw === 'green' ? 'green' : (cf === 'red' || cw === 'red') ? 'red' : (cf === 'amber' || cw === 'amber') ? 'amber' : 'grey'] + '">'
      + '<div class="card-title" style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px"><span>🏠 ' + daEsc(name) + '</span><span style="font-size:12px;font-weight:400;color:var(--muted)">' + (s.who.length ? '👤 ' + s.who.map(daEsc).join('، ') : 'محدش سجّل لسه') + (s.pend ? ' · ✔️ ' + s.pend + ' للمراجعة' : '') + '</span></div>'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">'
      // feed
      + '<div><div style="font-size:12px;color:var(--muted);margin-bottom:4px">🌾 العلف</div>' + daEsChip(cf, s.tanks ? s.fed + ' من ' + s.tanks + ' تانك' : 'مفيش تانكات فيها سمك')
      + (s.missFeed.length && s.fed < s.tanks ? '<div class="es-miss-feed" style="font-size:12px;margin-top:6px;color:' + DA_ES_FG[cf] + '">ناقص: <span dir="ltr">' + s.missFeed.slice(0, 12).map(function(r){ return daEsc(r.no.label); }).join('، ') + (s.missFeed.length > 12 ? ' …' : '') + '</span></div>' : '')
      + (s.tanks ? '<button class="es-open-feed" style="margin-top:6px;padding:5px 12px;border:1.5px solid var(--line);background:#fff;border-radius:7px;font:inherit;font-size:12px;cursor:pointer" onclick="window._fs={farm:&quot;' + daEsc(f) + '&quot;,date:&quot;' + st.date + '&quot;};show(&quot;feed-sheet&quot;)">📋 افتح شيت العلف</button>' : '') + '</div>'
      // mortality
      + '<div><div style="font-size:12px;color:var(--muted);margin-bottom:4px">💀 النفوق</div>' + daEsChip(s.fed ? 'green' : 'grey', s.dead + ' سمكة') + '<div style="font-size:11px;color:var(--muted);margin-top:4px">بيتسجل مع شيت العلف</div></div>'
      // testing
      + '<div><div style="font-size:12px;color:var(--muted);margin-bottom:4px">🧪 القياسات اليومية</div>' + daEsChip(cw, s.secs ? s.wq + ' من ' + s.secs + ' سكشن' : 'مفيش سكاشن')
      + (s.missWq.length && s.wq < s.secs ? '<div class="es-miss-wq" style="font-size:12px;margin-top:6px;color:' + DA_ES_FG[cw] + '">ناقص: ' + s.missWq.slice(0, 16).map(function(x){ return 'S-' + ('0' + daSecNo(x)).slice(-2); }).join('، ') + '</div>' : '')
      + (s.secs ? '<button class="es-open-wq" style="margin-top:6px;padding:5px 12px;border:1.5px solid var(--line);background:#fff;border-radius:7px;font:inherit;font-size:12px;cursor:pointer" onclick="window._wqs={farm:&quot;' + daEsc(f) + '&quot;,date:&quot;' + st.date + '&quot;,mode:&quot;daily&quot;};show(&quot;wq-sheet&quot;)">🧪 افتح شيت القياسات</button>' : '') + '</div>'
      // weekly
      + '<div><div style="font-size:12px;color:var(--muted);margin-bottom:4px">🧪 الأسبوعي (آخر 7 أيام)</div>' + daEsChip(s.secs && s.weekly >= s.secs ? 'green' : s.weekly ? 'amber' : 'grey', s.weekly + ' من ' + s.secs + ' سكشن') + '</div>'
      + '</div></div>';
  });
  return h;
}
function daEsDashStrip(){   // the dashboard tells when today has something missing
  var d = daToday(), late = daEsLate(d), bits = [];
  daFarms().forEach(function(f){ var s = daEsFarm(f, d);
    if(s.tanks && s.fed < s.tanks && (late || s.fed > 0)) bits.push(f + ' ناقص ' + (s.tanks - s.fed) + ' تانك علف');
    if(s.secs && s.wq < s.secs && (late || s.wq > 0)) bits.push(f + ' ناقص ' + (s.secs - s.wq) + ' سكشن قياسات'); });
  return '<div class="card" id="es-strip" style="margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;background:' + (bits.length ? (late ? '#fee2e2' : '#fef9c3') : '#dcfce7') + '">'
    + '<b>📋 النهارده: ' + (bits.length ? bits.join(' · ') : 'كل اللي اتطلب اتسجل ✅') + '</b><button style="padding:6px 14px;border:1.5px solid var(--line);background:#fff;border-radius:8px;font:inherit;cursor:pointer" onclick="show(&quot;entry-status&quot;)">متابعة الإدخال</button></div>';
}
if(!window._daEsWrapped){
  window._daEsWrapped = true;
  VIEWS['entry-status'] = renderEntryStatus; VIEW_PERMS['entry-status'] = 'approve_data';   // for whoever supervises the entries
  var homeG = DA_NAV.filter(function(g){ return g.id === 'home'; })[0];
  if(homeG && !homeG.items.some(function(i){ return i[0] === 'entry-status'; })) homeG.items.splice(1, 0, ['entry-status', '📋', 'متابعة الإدخال', 'Entry status']);
  if(typeof DA_DCTL_IDS !== 'undefined' && DA_DCTL_IDS.indexOf('es-date') < 0) DA_DCTL_IDS.push('es-date');
  var _showPreEs = show;
  show = function(v){ var r = _showPreEs.apply(this, arguments);
    if(currentView === 'dashboard' && canAccessView('entry-status') && !document.getElementById('es-strip')){ var c = document.getElementById('content'), ph = c && c.querySelector('.ph');
      if(ph) ph.insertAdjacentHTML('afterend', daEsDashStrip()); }
    return r; };
}
