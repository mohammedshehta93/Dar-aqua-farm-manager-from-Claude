// ══════════════════════════════════════════════════════════
//  WORK ORDERS (owner, 2026-11-11)
// ══════════════════════════════════════════════════════════
// The admin, a manager or an engineer gives a dated order for a site; the workers of that site see it in the app (🔔 with
// a count, a sound and a vibration when a new one arrives) and answer ✔ done / ✖ not done + why. Orders are tied to the
// sheets: "don't feed" marks the tank X on that day (with the reason), "change feed" fills the new daily amount from that
// day on, "transfer" closes itself once the transfer is recorded; free text for everything else. Open orders past their
// day show red on the entry status board. Each order is one record of the transactions table (type "work_order", no
// tank in "unit" so no stock or feed engine counts it; its own status so it never goes to the review queue).
var DA_WO_KINDS = {nofeed:'🚫', feed:'🌾', transfer:'🔄', text:'📝'};
var DA_WO_T = {
  ar:{nofeed:'متتعلفش', feed:'غيّر العلف', transfer:'انقل', text:'أمر', to:'لـ', kgd:'كجم/يوم', from:'من', mine:'أوامري', none:'مفيش أوامر دلوقتي 👍', done:'✔ اتنفذ', not:'✖ متنفذش', why:'ليه متنفذش؟',
    okd:'✅ اتبلّغ إنه اتنفذ', okn:'اتبلّغ إنه متنفذش', fresh:'🔔 أمر شغل جديد', today:'النهارده', late:'متأخر', st_open:'مفتوح', st_done:'اتنفذ', st_not:'متنفذش', by:'من', reason:'السبب', head:'🔔 أوامر الشغل', done_list:'اتعمل'},
  en:{nofeed:"Don't feed", feed:'Change feed', transfer:'Transfer', text:'Order', to:'to', kgd:'kg/day', from:'from', mine:'My orders', none:'No orders now 👍', done:'✔ Done', not:'✖ Not done', why:'Why not done?',
    okd:'✅ Reported as done', okn:'Reported as not done', fresh:'🔔 New work order', today:'Today', late:'Late', st_open:'Open', st_done:'Done', st_not:'Not done', by:'by', reason:'Reason', head:'🔔 Work orders', done_list:'Done'},
  ur:{nofeed:'خوراک نہ دیں', feed:'فیڈ بدلیں', transfer:'منتقل کریں', text:'ہدایت', to:'سے', kgd:'کلو/دن', from:'از', mine:'میری ہدایات', none:'ابھی کوئی ہدایت نہیں 👍', done:'✔ ہو گیا', not:'✖ نہیں ہوا', why:'کیوں نہیں ہوا؟',
    okd:'✅ ہو جانے کی اطلاع دے دی', okn:'نہ ہونے کی اطلاع دے دی', fresh:'🔔 نئی کام کی ہدایت', today:'آج', late:'دیر', st_open:'کھلا', st_done:'ہو گیا', st_not:'نہیں ہوا', by:'از', reason:'وجہ', head:'🔔 کام کی ہدایات', done_list:'مکمل'}};
function daWoT(){ var l = typeof daLangNow === 'function' ? daLangNow() : (isAr ? 'ar' : 'en'); return DA_WO_T[l] || DA_WO_T.ar; }
function daWoAll(){ return getTX().filter(function(t){ return t.type === 'work_order' && !t.deleted; }); }
function daWoCanIssue(){ return !!currentUser && ['admin', 'manager', 'engineer'].indexOf(currentUserRole) >= 0; }
function daWoMine(){ var uf = typeof daUserFarms === 'function' ? daUserFarms() : null; return daWoAll().filter(function(o){ return !uf || uf.indexOf(o.farm) >= 0; }); }
function daWoTank(u){ var n = typeof daTankNo === 'function' ? daTankNo(u) : null; return n ? n.label : u; }
function daWoLabel(o, T){
  T = T || daWoT(); var tk = (o.tanks || []).map(daWoTank).join('، ');
  if(o.kind === 'transfer') return DA_WO_KINDS.transfer + ' ' + T.transfer + ' ' + tk + ' ' + T.to + ' ' + (o.to || []).map(daWoTank).join('، ');
  if(o.kind === 'feed') return DA_WO_KINDS.feed + ' ' + T.feed + ' ' + tk + ': ' + o.kg + ' ' + T.kgd;
  if(o.kind === 'nofeed') return DA_WO_KINDS.nofeed + ' ' + T.nofeed + ' ' + tk;
  return DA_WO_KINDS.text + ' ' + (tk ? tk + ': ' : '');
}
function daWoDue(){ var d = daToday(); return daWoMine().filter(function(o){ return o.status === 'open' && o.date <= d; }); }
// ── the issuer's page ──
function renderWorkOrders(){
  var st = window._wo = window._wo || {kind:'nofeed', farm:(daFarms()[0] || ''), date:daToday(), tab:'open'};
  var inp = 'padding:7px 9px;border:1.5px solid var(--line);border-radius:7px;font:inherit;font-size:13px', reg = getFarmsRegistry();
  var rows = st.farm ? daFsRows(st.farm, st.date).filter(function(r){ return r.unit; }) : [];
  var tankBox = function(id, multi){ return '<div id="' + id + '" style="display:flex;flex-wrap:wrap;gap:5px;max-height:180px;overflow:auto;padding:6px;border:1px solid var(--line);border-radius:8px">'
    + rows.map(function(r){ return '<label style="display:flex;gap:4px;align-items:center;padding:3px 8px;border-radius:6px;background:' + (r.fish > 0 ? '#f0fdfa' : '#f8fafc') + ';font-size:13px;cursor:pointer"><input type="' + (multi ? 'checkbox' : 'radio') + '" name="' + id + '" value="' + daEsc(r.unit) + '"/> ' + daEsc(r.no ? r.no.label : r.unit) + (r.fish > 0 ? '' : ' <span style="color:var(--muted);font-size:11px">فاضي</span>') + '</label>'; }).join('') + '</div>'; };
  var h = '<div class="ph"><div><h2>📋 أوامر الشغل</h2><p style="font-size:11px;color:var(--muted)">أمر بتاريخ لمكان — بيوصل لعمال المكان ده بس في التطبيق، ويردّوا اتنفذ أو لأ</p></div></div>';
  h += '<div class="card" style="margin-bottom:12px"><div class="card-title">➕ أمر جديد</div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;align-items:end">'
    + '<div class="field" style="margin:0"><label>نوع الأمر</label><select id="wo-kind" style="' + inp + '" onchange="window._wo.kind=this.value;show(&quot;work-orders&quot;,true)">'
    + [['nofeed', '🚫 متتعلفش (يوم معين)'], ['feed', '🌾 غيّر العلف (من يوم معين)'], ['transfer', '🔄 نقل من تانك لتانك'], ['text', '📝 أمر بنص']].map(function(k){ return '<option value="' + k[0] + '"' + (st.kind === k[0] ? ' selected' : '') + '>' + k[1] + '</option>'; }).join('') + '</select></div>'
    + '<div class="field" style="margin:0"><label>المكان</label><select id="wo-farm" style="' + inp + '" onchange="window._wo.farm=this.value;show(&quot;work-orders&quot;,true)">' + daFarms().map(function(f){ return '<option value="' + daEsc(f) + '"' + (st.farm === f ? ' selected' : '') + '>' + daEsc(f) + (reg[f] && reg[f] !== f ? ' — ' + daEsc(reg[f]) : '') + '</option>'; }).join('') + '</select></div>'
    + '<div class="field" style="margin:0"><label>' + (st.kind === 'feed' ? 'من يوم' : 'اليوم') + '</label><input type="date" id="wo-date" data-nodirty="1" value="' + st.date + '" style="' + inp + '" onchange="window._wo.date=this.value;show(&quot;work-orders&quot;,true)"/></div>'
    + (st.kind === 'feed' ? '<div class="field" style="margin:0"><label>الكمية الجديدة (كجم في اليوم لكل تانك)</label><input id="wo-kg" type="number" step="any" min="0" style="' + inp + '"/></div>' : '') + '</div>'
    + '<div class="field" style="margin:10px 0 0"><label>' + (st.kind === 'transfer' ? 'من تانك' : 'التانكات' + (st.kind === 'text' ? ' (اختياري)' : '')) + '</label>' + tankBox('wo-tanks', st.kind !== 'transfer') + '</div>'
    + (st.kind === 'transfer' ? '<div class="field" style="margin:10px 0 0"><label>لتانك (أو أكتر)</label>' + tankBox('wo-to', true) + '</div>' : '')
    + '<div class="field" style="margin:10px 0 0"><label>' + (st.kind === 'text' ? 'الأمر *' : 'ملاحظة / السبب (بتظهر للعامل)') + '</label><input id="wo-text" style="' + inp + ';width:100%" placeholder="' + (st.kind === 'nofeed' ? 'مثلاً: هننقله بكره الصبح' : '') + '"/></div>'
    + '<button id="wo-save" class="savebtn" style="width:auto;padding:10px 22px;margin-top:12px" onclick="daWoSave()">📤 ابعت الأمر</button></div>';
  var all = daWoAll().filter(function(o){ return st.tab === 'all' || (st.tab === 'open' ? o.status === 'open' : o.date === daToday()); }).sort(function(a, b){ return (b.date || '').localeCompare(a.date || '') || (b.at || '').localeCompare(a.at || ''); });
  h += '<div class="card"><div style="display:flex;gap:6px;margin-bottom:10px">' + [['open', 'المفتوحة'], ['today', 'النهارده'], ['all', 'الكل']].map(function(t){ return '<button onclick="window._wo.tab=&quot;' + t[0] + '&quot;;show(&quot;work-orders&quot;,true)" style="padding:6px 14px;border-radius:99px;border:1.5px solid var(--line);font:inherit;cursor:pointer;background:' + (st.tab === t[0] ? 'var(--teal);color:#fff' : '#fff') + '">' + t[1] + '</button>'; }).join('') + '</div>'
    + (all.length ? all.map(daWoCardIssuer).join('') : '<div style="text-align:center;color:var(--muted);padding:20px">مفيش أوامر هنا.</div>') + '</div>';
  return h;
}
function daWoStatusChip(o, T){ T = T || daWoT(); var late = o.status === 'open' && o.date < daToday();
  var c = o.status === 'done' ? ['#dcfce7', '#166534', T.st_done] : o.status === 'notdone' ? ['#fee2e2', '#991b1b', T.st_not] : late ? ['#fee2e2', '#991b1b', T.st_open + ' · ' + T.late] : ['#fef9c3', '#854d0e', T.st_open];
  return '<span style="padding:3px 10px;border-radius:99px;background:' + c[0] + ';color:' + c[1] + ';font-weight:800;font-size:12px">' + c[2] + '</span>'; }
function daWoCardIssuer(o){
  return '<div class="wo-item" data-id="' + daEsc(o.id) + '" style="border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin-bottom:8px;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">'
    + '<div><b>' + daEsc(daWoLabel(o, DA_WO_T.ar)) + '</b>' + (o.text ? ' <span>' + daEsc(o.text) + '</span>' : '') + '<div style="font-size:12px;color:var(--muted);margin-top:3px">' + daEsc(o.farm) + ' · ' + daEsc(o.date) + ' · من ' + daEsc(o.byName || o.by || '') + (o.reply ? ' · <b style="color:var(--text)">الرد: ' + daEsc(o.reply) + '</b>' : '') + (o.doneByName ? ' · ' + daEsc(o.doneByName) : '') + '</div></div>'
    + '<div style="display:flex;gap:6px;align-items:center">' + daWoStatusChip(o, DA_WO_T.ar) + (o.status === 'open' ? '<button onclick="daWoCancel(&quot;' + daEsc(o.id) + '&quot;)" title="إلغاء" style="border:1px solid var(--line);background:#fff;border-radius:7px;cursor:pointer;padding:3px 8px">🗑</button>' : '') + '</div></div>';
}
function daWoChecked(name){ return Array.prototype.slice.call(document.querySelectorAll('input[name="' + name + '"]:checked')).map(function(e){ return e.value; }); }
function daWoSave(){
  var st = window._wo, tanks = daWoChecked('wo-tanks'), to = daWoChecked('wo-to'), text = String(daVal('wo-text') || '').trim(), kg = parseFloat(daVal('wo-kg'));
  if(!st.farm || !st.date){ toast('⚠️ اختار المكان واليوم'); return; }
  if(st.kind !== 'text' && !tanks.length){ toast('⚠️ اختار التانكات'); return; }
  if(st.kind === 'transfer' && !to.length){ toast('⚠️ اختار التانك اللي هيتنقل له'); return; }
  if(st.kind === 'feed' && !(kg >= 0 && daVal('wo-kg') !== '')){ toast('⚠️ اكتب الكمية الجديدة'); return; }
  if(st.kind === 'text' && !text){ toast('⚠️ اكتب الأمر'); return; }
  var o = {id:'wo-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), type:'work_order', date:st.date, unit:'', farm:st.farm, kind:st.kind, tanks:tanks, text:text, status:'open', _skipValidation:true};
  if(st.kind === 'transfer') o.to = to; if(st.kind === 'feed') o.kg = +kg;
  addTX(o); toast('📤 الأمر اتبعت لعمال ' + st.farm); show('work-orders', true);
}
function daWoCancel(id){ if(!confirm('إلغاء الأمر ده؟')) return; updateTX(id, {deleted:true}); _dataVer++; show(currentView, true); }
// ── the worker's side ──
function renderWoMine(){
  var T = daWoT(), due = daWoDue(), done = daWoMine().filter(function(o){ return o.status !== 'open' && o.date >= daAddDays(daToday(), -2); });
  var card = function(o, act){ var late = o.date < daToday();
    return '<div class="wo-mine" data-id="' + daEsc(o.id) + '" style="border:2px solid ' + (act ? (late ? '#ef4444' : 'var(--teal)') : 'var(--line)') + ';border-radius:12px;padding:12px;margin-bottom:10px;background:#fff">'
      + '<div style="font-size:16px;font-weight:800;line-height:1.6">' + daEsc(daWoLabel(o, T)) + '</div>' + (o.text ? '<div style="font-size:15px;margin-top:4px">' + daEsc(o.text) + '</div>' : '')
      + '<div style="font-size:12px;color:var(--muted);margin-top:4px">' + daEsc(o.farm) + ' · ' + daEsc(daFmtDate(o.date)) + ' · ' + T.by + ' ' + daEsc(o.byName || '') + ' ' + (act ? '' : daWoStatusChip(o, T)) + (o.reply ? ' · ' + T.reason + ': ' + daEsc(o.reply) : '') + '</div>'
      + (act ? '<div style="display:flex;gap:8px;margin-top:10px"><button class="wo-ok" onclick="daWoAnswer(&quot;' + daEsc(o.id) + '&quot;,true)" style="flex:1;padding:12px;border:0;border-radius:10px;background:var(--teal);color:#fff;font:inherit;font-weight:800;font-size:16px;cursor:pointer">' + T.done + '</button>'
        + '<button class="wo-no" onclick="daWoAnswer(&quot;' + daEsc(o.id) + '&quot;,false)" style="flex:1;padding:12px;border:2px solid #ef4444;border-radius:10px;background:#fff;color:#b91c1c;font:inherit;font-weight:800;font-size:16px;cursor:pointer">' + T.not + '</button></div>' : '') + '</div>'; };
  return '<div class="ph"><div><h2>' + T.head + '</h2></div></div>' + (due.length ? due.map(function(o){ return card(o, true); }).join('') : '<div class="card" style="text-align:center;padding:30px;font-size:16px">' + T.none + '</div>')
    + (done.length ? '<div style="font-weight:800;margin:14px 0 6px;color:var(--muted)">' + T.done_list + '</div>' + done.map(function(o){ return card(o, false); }).join('') : '');
}
function daWoAnswer(id, ok){
  var T = daWoT(), why = '';
  if(!ok){ why = prompt(T.why, ''); if(why === null) return; }
  updateTX(id, {status:ok ? 'done' : 'notdone', reply:why || '', doneBy:currentUser ? currentUser.email : '', doneByName:(getSession() || {}).name || '', doneAt:new Date().toISOString()});
  _dataVer++; toast(ok ? T.okd : T.okn); show(currentView, true); daWoBell();
}
function daWoBell(){   // 🔔 with the count in the worker's bar; a sound + vibration when a new order arrives
  var bar = document.getElementById('da-wbar'); if(!bar || !currentUser || currentUserRole !== 'worker') return;
  var due = daWoDue(), b = document.getElementById('wo-bell'), rf = bar.querySelector('.rf');
  if(!b && rf){ rf.insertAdjacentHTML('beforebegin', '<button id="wo-bell" data-v="wo-mine" onclick="show(&quot;wo-mine&quot;)"></button>'); b = document.getElementById('wo-bell'); }
  if(b){ b.textContent = '🔔' + (due.length ? ' ' + due.length : ''); b.className = (currentView === 'wo-mine' ? 'on' : '') + (due.length ? ' wo-has' : ''); b.style.cssText = due.length ? 'background:#fee2e2;color:#991b1b;font-weight:800' : ''; }
  var seen = {}; try{ seen = JSON.parse(localStorage.getItem('da_wo_seen') || '{}'); }catch(e){}
  var fresh = due.filter(function(o){ return !seen[o.id]; });
  if(fresh.length){ fresh.forEach(function(o){ seen[o.id] = 1; }); try{ localStorage.setItem('da_wo_seen', JSON.stringify(seen)); }catch(e){}
    toast(daWoT().fresh + ' (' + fresh.length + ')'); try{ if(navigator.vibrate) navigator.vibrate([200, 100, 200]); }catch(e){}
    try{ var A = window.AudioContext || window.webkitAudioContext; if(A){ var c = new A(), g = c.createGain(), o2 = c.createOscillator(); o2.frequency.value = 880; o2.connect(g); g.connect(c.destination); g.gain.value = 0.15; o2.start(); o2.stop(c.currentTime + 0.35); } }catch(e){} }
}
// ── tied to the feed sheet ──
function daWoForSheet(farm, date){   // {unit: {nofeed:order} | {feed:order}} — the latest feed change on or before the day
  var m = {}; daWoAll().filter(function(o){ return o.farm === farm && o.status !== 'notdone'; }).sort(function(a, b){ return (a.date || '').localeCompare(b.date || '') || (a.at || '').localeCompare(b.at || ''); }).forEach(function(o){
    (o.tanks || []).forEach(function(u){ m[u] = m[u] || {};
      if(o.kind === 'nofeed' && o.date === date) m[u].nofeed = o;
      if(o.kind === 'feed' && o.date <= date) m[u].feed = o; }); });
  return m;
}
function daWoSheetApply(){
  var st = window._fs; if(!st || !st.rows) return; var T = daWoT(), M = daWoForSheet(st.farm, st.date), any = [];
  st.rows.forEach(function(r){ if(r.i === undefined || !M[r.unit]) return; var x = M[r.unit], e = document.getElementById('fs-' + r.i + '-m0'), multi = !!document.getElementById('fs-' + r.i + '-m1'); if(!e || e.disabled) return;
    var tr = e.closest('tr'), cell = tr && tr.querySelector('td'), tag = function(t){ if(cell && !cell.querySelector('.wo-tag')) cell.insertAdjacentHTML('beforeend', '<div class="wo-tag" style="font-size:11px;font-weight:700;color:#b45309;white-space:normal">' + daEsc(t) + '</div>'); };
    if(x.nofeed){ if(!e.value) e.value = 'X'; tag('🚫 ' + T.nofeed + (x.nofeed.text ? ' — ' + x.nofeed.text : '')); any.push(x.nofeed); }
    else if(x.feed){ if(!e.value && !multi) e.value = String(x.feed.kg); tag('🌾 ' + x.feed.kg + ' ' + T.kgd); } });
  var box = document.getElementById('fs-copybox');
  if(any.length && box && !document.getElementById('wo-sheet-note')) box.insertAdjacentHTML('beforebegin', '<div class="card" id="wo-sheet-note" style="margin-bottom:12px;background:#fef9c3;border:2px solid #eab308;font-weight:700">🚫 ' + daEsc(T.nofeed) + ': ' + any.map(function(o){ return (o.tanks || []).map(daWoTank).join('، ') + (o.text ? ' (' + o.text + ')' : ''); }).join(' · ') + '</div>');
}
function daWoAutoClose(t){   // a transfer recorded / the tanks saved as not fed → the order closes by itself
  if(!t || !t.unit) return;
  daWoAll().forEach(function(o){ if(o.status !== 'open' || (o.tanks || []).indexOf(t.unit) < 0) return;
    if(o.kind === 'transfer' && t.type === 'transfer_out' && t.date >= o.date) updateTX(o.id, {status:'done', reply:'اتسجل النقل', doneAt:new Date().toISOString(), doneByName:t.byName || ''});
    if(o.kind === 'nofeed' && t.type === 'feeding' && t.fasted && t.date === o.date){
      var all = (o.tanks || []).every(function(u){ return u === t.unit || getTX().some(function(f){ return f.type === 'feeding' && !f.deleted && f.unit === u && f.date === o.date && f.fasted; }); });
      if(all) updateTX(o.id, {status:'done', reply:'اتسجل في شيت العلف', doneAt:new Date().toISOString(), doneByName:t.byName || ''}); } });
}
function daWoSweep(){   // close every open order whose condition is met (sheet saved with X, transfer recorded) — however it was saved
  var tx = null, n = 0;
  daWoAll().forEach(function(o){ if(o.status !== 'open' || !(o.tanks || []).length) return; tx = tx || getTX();
    if(o.kind === 'nofeed' && o.tanks.every(function(u){ return tx.some(function(f){ return f.type === 'feeding' && !f.deleted && f.unit === u && f.date === o.date && f.fasted; }); })){
      updateTX(o.id, {status:'done', reply:'اتسجل في شيت العلف', doneAt:new Date().toISOString()}); n++; }
    if(o.kind === 'transfer' && tx.some(function(f){ return f.type === 'transfer_out' && !f.deleted && f.unit === o.tanks[0] && f.date >= o.date; })){
      updateTX(o.id, {status:'done', reply:'اتسجل النقل', doneAt:new Date().toISOString()}); n++; } });
  if(n) _dataVer++; return n;
}
function daWoStatusCard(date){   // on the entry status board
  var open = daWoMine().filter(function(o){ return o.status === 'open' && o.date <= date; }), not = daWoMine().filter(function(o){ return o.status === 'notdone' && o.date === date; });
  if(!open.length && !not.length) return '';
  return '<div class="card" id="es-wo" style="margin-bottom:12px;border-inline-start:6px solid #ef4444"><div class="card-title">📋 أوامر الشغل</div>'
    + open.concat(not).map(function(o){ return '<div style="padding:4px 0;font-size:13px">' + daWoStatusChip(o, DA_WO_T.ar) + ' <b>' + daEsc(o.farm) + '</b> · ' + daEsc(daWoLabel(o, DA_WO_T.ar)) + (o.text ? ' ' + daEsc(o.text) : '') + ' · ' + daEsc(o.date) + (o.reply ? ' · الرد: ' + daEsc(o.reply) : '') + '</div>'; }).join('')
    + (daWoCanIssue() ? '<button onclick="show(&quot;work-orders&quot;)" style="margin-top:6px;padding:5px 12px;border:1.5px solid var(--line);background:#fff;border-radius:7px;font:inherit;cursor:pointer">📋 أوامر الشغل</button>' : '') + '</div>';
}
if(!window._daWoWrapped){
  window._daWoWrapped = true;
  VIEWS['work-orders'] = renderWorkOrders; VIEW_PERMS['work-orders'] = 'approve_data';
  VIEWS['wo-mine'] = renderWoMine;
  var homeWo = DA_NAV.filter(function(g){ return g.id === 'home'; })[0];
  if(homeWo && !homeWo.items.some(function(i){ return i[0] === 'work-orders'; })) homeWo.items.splice(2, 0, ['work-orders', '📋', 'أوامر الشغل', 'Work orders']);
  var _cavPreWo = canAccessView;
  canAccessView = function(v){ if(v === 'wo-mine') return !!currentUser; if(v === 'work-orders') return daWoCanIssue(); return _cavPreWo.apply(this, arguments); };
  var _addPreWo = addTX;
  addTX = function(t){ var r = _addPreWo.apply(this, arguments); try{ if(t && t.type !== 'work_order') daWoAutoClose(t); }catch(e){} return r; };
  var _showPreWo = show;
  show = function(v){ var r = _showPreWo.apply(this, arguments);
    try{ if(currentView === 'feed-sheet') daWoSheetApply(); }catch(e){}
    try{ if(currentView === 'entry-status' && !document.getElementById('es-wo')){ var c = document.getElementById('content'), ph = c && c.querySelector('.ph'), html = daWoStatusCard((window._es || {}).date || daToday()); if(ph && html) ph.insertAdjacentHTML('afterend', html); } }catch(e){}
    daWoBell(); return r; };
  if(typeof daWorkerBar === 'function'){ var _wbPreWo = daWorkerBar; daWorkerBar = function(){ var r = _wbPreWo.apply(this, arguments); daWoBell(); return r; }; }
  if(typeof daFsSave === 'function'){ var _fsSavePreWo = daFsSave; daFsSave = function(){ var r = _fsSavePreWo.apply(this, arguments); var done = function(){ try{ if(daWoSweep()) daWoBell(); }catch(e){} };
    if(r && typeof r.then === 'function') r.then(done, done); else setTimeout(done, 0); return r; }; }
  if(typeof daRealtimePull === 'function'){ var _pullPreWo = daRealtimePull; daRealtimePull = function(){ var r = _pullPreWo.apply(this, arguments); var after = function(){ try{ daWoBell(); }catch(e){} };
    if(r && typeof r.then === 'function') r.then(after, after); else setTimeout(after, 0); return r; }; }
  setInterval(function(){ try{ if(currentUser){ daWoSweep(); daWoBell(); } }catch(e){} }, 10000);
}
