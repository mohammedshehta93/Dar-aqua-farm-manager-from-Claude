// ══════════════════════════════════════════════════════════
//  WORK ORDERS v2 + DAILY ROUTINE (owner, 2026-11-12)
// ══════════════════════════════════════════════════════════
// v1 lost the ticks (the page is redrawn by the background sync) and was too narrow. Now every choice is kept in
// window._wo as it is made, and the page is three tabs: ➕ new order (big buttons per kind) · 📋 orders · 📅 daily routine.
// Kinds: don't feed (tanks, a day) · new feed sheet (an amount per tank from a day) · transfer (many → one or one → many)
// · grading · harvest · cleaning (sections + filters / tanks / whole place) · visit (shown from today until its day) ·
// free text. Routine: per site, timed tasks on chosen weekdays; workers tick them each day (records "routine").
var DA_WO_KINDS = {nofeed:'🚫', feed:'🌾', transfer:'🔄', grade:'⚖️', harvest:'🎣', clean:'🧽', visit:'👥', text:'📝'};
var DA_WO_KIND_AR = [['nofeed', 'متتعلفش', 'تانك أو أكتر — يوم معين'], ['feed', 'شيت علف جديد', 'كمية لكل تانك من يوم'], ['transfer', 'نقل', 'تانكات ← تانك، أو العكس'],
  ['grade', 'فرز', 'تانك أو أكتر'], ['harvest', 'حصاد', 'تانك أو أكتر'], ['clean', 'نظافة', 'فلاتر / تانكات سكشن'], ['visit', 'زيارة', 'تنبيه مقدّم للمكان'], ['text', 'أمر بنص', 'أي حاجة تانية']];
var DA_WO_CLEAN = {filters:['فلاتر', 'filters', 'فلٹر'], tanks:['تانكات', 'tanks', 'ٹینک'], both:['فلاتر وتانكات', 'filters and tanks', 'فلٹر اور ٹینک'], place:['المكان كله', 'the whole place', 'پوری جگہ']};
var DA_WO_DAYS = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'];
var DA_WO_T = {
  ar:{nofeed:'متتعلفش', feed:'علف جديد', transfer:'انقل', grade:'فرز', harvest:'حصاد', clean:'نضّف', visit:'زيارة', text:'أمر', to:'لـ', kgd:'كجم/يوم', sec:'سكشن', mine:'أوامري', none:'مفيش أوامر النهارده 👍',
    done:'✔ اتنفذ', not:'✖ متنفذش', why:'ليه متنفذش؟', okd:'✅ اتبلّغ إنه اتنفذ', okn:'اتبلّغ إنه متنفذش', fresh:'🔔 أمر شغل جديد', late:'متأخر', st_open:'مفتوح', st_done:'اتنفذ', st_not:'متنفذش', by:'من',
    reason:'السبب', head:'🔔 أوامر الشغل', done_list:'اتعمل', today:'النهارده', upcoming:'جاية', routine:'📅 روتين النهارده', visit_on:'يوم الزيارة', prep:'خلّوا بالكم ونضّفوا المكان كويس', seen:'✔ تمام'},
  en:{nofeed:"Don't feed", feed:'New feed', transfer:'Transfer', grade:'Grade', harvest:'Harvest', clean:'Clean', visit:'Visit', text:'Order', to:'to', kgd:'kg/day', sec:'section', mine:'My orders', none:'No orders today 👍',
    done:'✔ Done', not:'✖ Not done', why:'Why not done?', okd:'✅ Reported as done', okn:'Reported as not done', fresh:'🔔 New work order', late:'Late', st_open:'Open', st_done:'Done', st_not:'Not done', by:'by',
    reason:'Reason', head:'🔔 Work orders', done_list:'Done', today:'Today', upcoming:'Coming', routine:"📅 Today's routine", visit_on:'Visit day', prep:'Take care and clean the place well', seen:'✔ OK'},
  ur:{nofeed:'خوراک نہ دیں', feed:'نئی فیڈ', transfer:'منتقل کریں', grade:'چھانٹی', harvest:'ہارویسٹ', clean:'صفائی کریں', visit:'دورہ', text:'ہدایت', to:'میں', kgd:'کلو/دن', sec:'سیکشن', mine:'میری ہدایات', none:'آج کوئی ہدایت نہیں 👍',
    done:'✔ ہو گیا', not:'✖ نہیں ہوا', why:'کیوں نہیں ہوا؟', okd:'✅ ہو جانے کی اطلاع دے دی', okn:'نہ ہونے کی اطلاع دے دی', fresh:'🔔 نئی کام کی ہدایت', late:'دیر', st_open:'کھلا', st_done:'ہو گیا', st_not:'نہیں ہوا', by:'از',
    reason:'وجہ', head:'🔔 کام کی ہدایات', done_list:'مکمل', today:'آج', upcoming:'آنے والی', routine:'📅 آج کا روزانہ کام', visit_on:'دورے کا دن', prep:'دھیان رکھیں اور جگہ اچھی طرح صاف کریں', seen:'✔ ٹھیک ہے'}};
var DA_ROUTINE_KEY = 'daracqua_plan_v1_routine';   // synced: {farm: [{id, time, text, days:[0..6] | null = every day}]}
function daWoLang(){ return typeof daLangNow === 'function' ? daLangNow() : (isAr ? 'ar' : 'en'); }
function daWoT(){ return DA_WO_T[daWoLang()] || DA_WO_T.ar; }
function daWoAll(){ return getTX().filter(function(t){ return t.type === 'work_order' && !t.deleted; }); }
function daWoCanIssue(){ return !!currentUser && ['admin', 'manager', 'engineer'].indexOf(currentUserRole) >= 0; }
function daWoMine(){ var uf = typeof daUserFarms === 'function' ? daUserFarms() : null; return daWoAll().filter(function(o){ return !uf || uf.indexOf(o.farm) >= 0; }); }
function daWoTank(u){ var n = typeof daTankNo === 'function' ? daTankNo(u) : null; return n ? n.label : u; }
function daWoSecLbl(s){ var n = daSecNo(s); return n === null ? s : 'S-' + ('0' + n).slice(-2); }
function daWoLabel(o, T){
  T = T || daWoT(); var li = T === DA_WO_T.en ? 1 : T === DA_WO_T.ur ? 2 : 0, tk = (o.tanks || []).map(daWoTank).join('، ');
  if(o.kind === 'transfer') return '🔄 ' + T.transfer + ' ' + tk + ' ← ' + (o.to || []).map(daWoTank).join('، ');
  if(o.kind === 'feed'){ var ks = o.kgs || {}; return '🌾 ' + T.feed + ': ' + (o.tanks || []).map(function(u){ return daWoTank(u) + ' = ' + (ks[u] !== undefined ? ks[u] : o.kg); }).join('، ') + ' ' + T.kgd; }
  if(o.kind === 'clean') return '🧽 ' + T.clean + ' ' + ((DA_WO_CLEAN[o.what] || DA_WO_CLEAN.filters)[li]) + ((o.secs || []).length ? ' — ' + T.sec + ' ' + o.secs.map(daWoSecLbl).join('، ') : '');
  if(o.kind === 'visit') return '👥 ' + T.visit + ' — ' + T.visit_on + ' ' + o.date;
  if(o.kind === 'text') return '📝 ' + (tk ? tk + ': ' : '');
  return (DA_WO_KINDS[o.kind] || '•') + ' ' + (T[o.kind] || o.kind) + ' ' + tk;
}
function daWoDue(){ var d = daToday(); return daWoMine().filter(function(o){ return o.status === 'open' && (o.date <= d || o.kind === 'visit'); }); }
function daWoUpcoming(){ var d = daToday(); return daWoMine().filter(function(o){ return o.status === 'open' && o.date > d && o.kind !== 'visit'; }); }
// ── routine ──
function daRoutine(){ try{ return JSON.parse(localStorage.getItem(DA_ROUTINE_KEY) || '{}') || {}; }catch(e){ return {}; } }
function daRoutineToday(farm, date){ var wd = new Date(date + 'T12:00:00').getDay();
  return (daRoutine()[farm] || []).filter(function(r){ return r.text && (!r.days || !r.days.length || r.days.indexOf(wd) >= 0); }).sort(function(a, b){ return (a.time || '99').localeCompare(b.time || '99'); }); }
function daRoutineDone(farm, date){ var m = {}; getTX().forEach(function(t){ if(t.type === 'routine' && !t.deleted && t.farm === farm && t.date === date) m[t.task] = t; }); return m; }
function daRoutineTick(farm, taskId, text){
  addTX({id:'rt-' + farm + '-' + taskId + '-' + daToday(), type:'routine', unit:'', farm:farm, date:daToday(), task:taskId, text:text, status:'done', doneByName:(getSession() || {}).name || '', doneAt:new Date().toISOString(), _skipValidation:true});
  _dataVer++; show(currentView, true); daWoBell();
}
function daMyFarms(){ var uf = typeof daUserFarms === 'function' ? daUserFarms() : null; return uf || daFarms(); }
// ── the issuer's page ──
function daWoState(){ var st = window._wo = window._wo || {}; if(!st.tab) st.tab = 'new'; if(!st.kind) st.kind = 'nofeed'; if(!st.farm) st.farm = daFarms()[0] || ''; if(!st.date) st.date = daToday();
  st.from = st.from || []; st.to = st.to || []; st.kgs = st.kgs || {}; st.secs = st.secs || []; if(!st.what) st.what = 'filters'; if(st.text === undefined) st.text = ''; if(!st.list) st.list = 'open'; return st; }
function daWoSet(k, v, redraw){ var st = daWoState(); st[k] = v; if(k === 'farm' || k === 'kind'){ st.from = []; st.to = []; st.kgs = {}; st.secs = []; } if(redraw) show('work-orders', true); }
function daWoToggle(list, v){ var st = daWoState(), a = st[list], i = a.indexOf(v); if(i >= 0) a.splice(i, 1); else a.push(v); if(list === 'from' && st.kind === 'feed') show('work-orders', true); else daWoPaint(); }
function daWoToggleSec(list, sec, units){ var st = daWoState(), a = st[list], all = units.every(function(u){ return a.indexOf(u) >= 0; });
  units.forEach(function(u){ var i = a.indexOf(u); if(all && i >= 0) a.splice(i, 1); if(!all && i < 0) a.push(u); }); if(list === 'from' && st.kind === 'feed') show('work-orders', true); else daWoPaint(); }
function daWoPaint(){ var st = daWoState(); document.querySelectorAll('.wo-chip').forEach(function(b){ var on = (st[b.dataset.list] || []).indexOf(b.dataset.v) >= 0; b.style.background = on ? 'var(--teal)' : (b.dataset.empty ? '#f8fafc' : '#f0fdfa'); b.style.color = on ? '#fff' : ''; b.style.borderColor = on ? 'var(--teal)' : 'var(--line)'; });
  var c = document.getElementById('wo-count'); if(c) c.textContent = st.from.length + (st.to.length ? ' ← ' + st.to.length : ''); }
function daWoPicker(list, rows, onlyFish){
  var st = daWoState(), by = {}, order = [];
  rows.forEach(function(r){ if(onlyFish && !(r.fish > 0)) return; var s = r.no ? r.no.s : 0; if(!by[s]){ by[s] = []; order.push(s); } by[s].push(r); });
  if(!order.length) return '<div style="color:var(--muted);font-size:13px;padding:8px">مفيش تانكات فيها سمك في اليوم ده.</div>';
  return '<div style="max-height:260px;overflow:auto;border:1px solid var(--line);border-radius:10px;padding:6px">' + order.map(function(s){ var us = by[s].map(function(r){ return r.unit; });
    return '<div style="display:flex;flex-wrap:wrap;gap:5px;align-items:center;padding:4px 0;border-bottom:1px dashed #e2e8f0"><button type="button" onclick=\'daWoToggleSec("' + list + '",' + s + ',' + JSON.stringify(us).replace(/'/g, '&#39;') + ')\' style="min-width:72px;padding:5px 8px;border:1px solid var(--line);border-radius:7px;background:#fff;font:inherit;font-size:12px;font-weight:800;cursor:pointer" title="علّم السكشن كله">سكشن ' + s + ' ☑</button>'
      + by[s].map(function(r){ var on = st[list].indexOf(r.unit) >= 0, emp = !(r.fish > 0);
        return '<button type="button" class="wo-chip" data-list="' + list + '" data-v="' + daEsc(r.unit) + '"' + (emp ? ' data-empty="1"' : '') + ' onclick=\'daWoToggle("' + list + '","' + daEsc(r.unit) + '")\' style="padding:6px 10px;border:1.5px solid ' + (on ? 'var(--teal)' : 'var(--line)') + ';border-radius:8px;font:inherit;font-size:13px;font-weight:700;cursor:pointer;background:' + (on ? 'var(--teal);color:#fff' : (emp ? '#f8fafc' : '#f0fdfa')) + '">' + daEsc(r.no ? r.no.label : r.unit) + (emp ? ' <span style="font-weight:400;font-size:11px;opacity:.7">فاضي</span>' : '') + '</button>'; }).join('') + '</div>'; }).join('') + '</div>';
}
function daWoLastKg(u, date){ var best = null; (daTxByUnit()[u] || []).forEach(function(t){ if(t.type === 'feeding' && !t.deleted && !t.fasted && t.date < date && (!best || t.date > best.date)) best = t; }); return best ? best.kg : null; }
function renderWorkOrders(){
  var st = daWoState(), inp = 'padding:8px 10px;border:1.5px solid var(--line);border-radius:8px;font:inherit;font-size:14px', reg = getFarmsRegistry();
  var tabBtn = function(k, t){ return '<button onclick="daWoSet(&quot;tab&quot;,&quot;' + k + '&quot;,true)" style="padding:9px 18px;border-radius:10px;border:2px solid ' + (st.tab === k ? 'var(--teal)' : 'var(--line)') + ';font:inherit;font-weight:800;cursor:pointer;background:' + (st.tab === k ? 'var(--teal);color:#fff' : '#fff') + '">' + t + '</button>'; };
  var openN = daWoAll().filter(function(o){ return o.status === 'open'; }).length;
  var h = '<div class="ph"><div><h2>📋 أوامر الشغل</h2><p style="font-size:11px;color:var(--muted)">أوامر بتاريخ لكل مكان، وروتين يومي ثابت — بيوصلوا لعمال المكان ده بس</p></div></div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">' + tabBtn('new', '➕ أمر جديد') + tabBtn('list', '📋 الأوامر' + (openN ? ' (' + openN + ')' : '')) + tabBtn('routine', '📅 الروتين اليومي') + '</div>';
  if(st.tab === 'list') return h + daWoListHtml(st);
  if(st.tab === 'routine') return h + daRoutineHtml(st);
  h += '<div class="card" style="margin-bottom:12px"><div class="card-title">1️⃣ نوع الأمر</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px">'
    + DA_WO_KIND_AR.map(function(k){ var on = st.kind === k[0]; return '<button class="wo-kind" data-k="' + k[0] + '" onclick="daWoSet(&quot;kind&quot;,&quot;' + k[0] + '&quot;,true)" style="padding:10px;border-radius:12px;border:2px solid ' + (on ? 'var(--teal)' : 'var(--line)') + ';background:' + (on ? '#f0fdfa' : '#fff') + ';font:inherit;cursor:pointer;text-align:start"><div style="font-size:16px;font-weight:800">' + DA_WO_KINDS[k[0]] + ' ' + k[1] + '</div><div style="font-size:11px;color:var(--muted)">' + k[2] + '</div></button>'; }).join('') + '</div></div>';
  var rows = st.farm ? daFsRows(st.farm, st.date).filter(function(r){ return r.unit; }) : [];
  h += '<div class="card" style="margin-bottom:12px"><div class="card-title">2️⃣ المكان واليوم</div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px">'
    + '<div class="field" style="margin:0"><label>المكان</label><select id="wo-farm" style="' + inp + '" onchange="daWoSet(&quot;farm&quot;,this.value,true)">' + daFarms().map(function(f){ return '<option value="' + daEsc(f) + '"' + (st.farm === f ? ' selected' : '') + '>' + daEsc(f) + (reg[f] && reg[f] !== f ? ' — ' + daEsc(reg[f]) : '') + '</option>'; }).join('') + '</select></div>'
    + '<div class="field" style="margin:0"><label>' + (st.kind === 'feed' ? 'الشيت الجديد من يوم' : st.kind === 'visit' ? 'يوم الزيارة' : 'اليوم') + '</label><input type="date" id="wo-date" data-nodirty="1" value="' + st.date + '" min="' + daAddDays(daToday(), -7) + '" style="' + inp + '" onchange="daWoSet(&quot;date&quot;,this.value,true)"/></div></div></div>';
  var step3 = '';
  if(st.kind === 'transfer') step3 = '<div class="field" style="margin:0"><label>من تانك (أو أكتر — مثلاً 4 تانكات تحضين)</label>' + daWoPicker('from', rows, true) + '</div><div class="field" style="margin:10px 0 0"><label>لتانك (أو أكتر — مثلاً تانك واحد لكذا تانك)</label>' + daWoPicker('to', rows, false) + '</div>';
  else if(st.kind === 'clean'){ var secs = daWqSections(st.farm);
    step3 = '<div class="field" style="margin:0"><label>نضّف إيه</label><div style="display:flex;gap:6px;flex-wrap:wrap">' + Object.keys(DA_WO_CLEAN).map(function(k){ var on = st.what === k; return '<button type="button" onclick="daWoSet(&quot;what&quot;,&quot;' + k + '&quot;,true)" style="padding:7px 14px;border-radius:8px;border:2px solid ' + (on ? 'var(--teal)' : 'var(--line)') + ';background:' + (on ? 'var(--teal);color:#fff' : '#fff') + ';font:inherit;font-weight:700;cursor:pointer">' + DA_WO_CLEAN[k][0] + '</button>'; }).join('') + '</div></div>'
      + (st.what !== 'place' ? '<div class="field" style="margin:10px 0 0"><label>السكاشن</label><div style="display:flex;flex-wrap:wrap;gap:6px">' + secs.map(function(s){ var on = st.secs.indexOf(s) >= 0; return '<button type="button" class="wo-chip" data-list="secs" data-v="' + daEsc(s) + '" onclick=\'daWoToggle("secs","' + daEsc(s) + '")\' style="padding:7px 12px;border:1.5px solid ' + (on ? 'var(--teal)' : 'var(--line)') + ';border-radius:8px;font:inherit;font-weight:700;cursor:pointer;background:' + (on ? 'var(--teal);color:#fff' : '#f0fdfa') + '">' + daWoSecLbl(s) + '</button>'; }).join('') + '</div></div>' : ''); }
  else if(st.kind === 'visit') step3 = '<div style="font-size:13px;line-height:1.8">بيظهر لعمال ' + daEsc(st.farm) + ' <b>من النهارده لحد يوم الزيارة</b>: "' + DA_WO_T.ar.prep + '" — واكتب أي تفاصيل تحت.</div>';
  else if(st.kind !== 'text' || true){
    step3 = '<div class="field" style="margin:0"><label>التانكات' + (st.kind === 'text' ? ' (اختياري)' : '') + ' — <span id="wo-count">' + st.from.length + '</span> متعلّم</label>' + daWoPicker('from', rows, st.kind !== 'text') + '</div>';
    if(st.kind === 'feed' && st.from.length){
      step3 += '<div style="margin-top:10px;padding:10px;border:1px solid var(--line);border-radius:10px"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px"><b>شيت العلف الجديد (كجم في اليوم)</b><span style="font-size:12px;color:var(--muted)">نفس الكمية للكل:</span><input id="wo-allkg" type="number" step="any" min="0" style="' + inp + ';width:90px" onchange="daWoAllKg(this.value)"/></div>'
        + '<table style="border-collapse:collapse;font-size:14px"><tr style="background:#f1f5f9"><th style="padding:5px 10px;text-align:start">التانك</th><th style="padding:5px 10px">آخر كمية</th><th style="padding:5px 10px">الجديدة</th></tr>'
        + st.from.map(function(u){ var last = daWoLastKg(u, st.date); return '<tr><td style="padding:4px 10px;font-weight:800">' + daEsc(daWoTank(u)) + '</td><td style="padding:4px 10px;text-align:center;color:var(--muted)">' + (last === null ? '—' : last) + '</td><td style="padding:4px 10px"><input class="wo-kg" data-u="' + daEsc(u) + '" type="number" step="any" min="0" value="' + (st.kgs[u] !== undefined ? st.kgs[u] : '') + '" style="' + inp + ';width:100px" oninput="daWoState().kgs[this.dataset.u]=this.value"/></td></tr>'; }).join('') + '</table></div>'; } }
  h += '<div class="card" style="margin-bottom:12px"><div class="card-title">3️⃣ التفاصيل</div>' + step3
    + '<div class="field" style="margin:12px 0 0"><label>' + (st.kind === 'text' ? 'الأمر *' : 'ملاحظة / السبب (بتظهر للعامل)') + '</label><input id="wo-text" value="' + daEsc(st.text) + '" oninput="daWoState().text=this.value" style="' + inp + ';width:100%" placeholder="' + ({nofeed:'مثلاً: هننقله بكره الصبح', visit:'مثلاً: زيارة من الوزارة الساعة 10', clean:'مثلاً: الفلاتر مسدودة', grade:'مثلاً: افرز الكبير لوحده'}[st.kind] || '') + '"/></div>'
    + '<button id="wo-save" class="savebtn" style="width:auto;padding:12px 26px;margin-top:14px;font-size:16px" onclick="daWoSave()">📤 ابعت الأمر لعمال ' + daEsc(st.farm) + '</button></div>';
  return h;
}
function daWoAllKg(v){ var st = daWoState(); st.from.forEach(function(u){ st.kgs[u] = v; }); document.querySelectorAll('.wo-kg').forEach(function(e){ e.value = v; }); }
function daWoSave(){
  var st = daWoState(), t = String(st.text || '').trim(), k = st.kind;
  if(!st.farm || !st.date){ toast('⚠️ اختار المكان واليوم'); return; }
  if(['nofeed', 'feed', 'transfer', 'grade', 'harvest'].indexOf(k) >= 0 && !st.from.length){ toast('⚠️ علّم التانكات'); return; }
  if(k === 'transfer' && !st.to.length){ toast('⚠️ علّم التانك اللي هينقلوا له'); return; }
  if(k === 'transfer' && st.to.some(function(u){ return st.from.indexOf(u) >= 0; })){ toast('⚠️ نفس التانك في "من" و"لـ"'); return; }
  if(k === 'clean' && st.what !== 'place' && !st.secs.length){ toast('⚠️ علّم السكاشن'); return; }
  if(k === 'text' && !t){ toast('⚠️ اكتب الأمر'); return; }
  var kgs = {}; if(k === 'feed'){ var bad = st.from.filter(function(u){ var x = parseFloat(st.kgs[u]); if(x >= 0 && String(st.kgs[u]).trim() !== ''){ kgs[u] = +x; return false; } return true; });
    if(bad.length){ toast('⚠️ اكتب الكمية لـ ' + bad.map(daWoTank).join('، ')); return; } }
  var o = {id:'wo-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), type:'work_order', date:st.date, unit:'', farm:st.farm, kind:k, tanks:st.from.slice(), text:t, status:'open', issued:daToday(), _skipValidation:true};
  if(k === 'transfer') o.to = st.to.slice(); if(k === 'feed') o.kgs = kgs; if(k === 'clean'){ o.what = st.what; o.secs = st.secs.slice(); }
  addTX(o); toast('📤 الأمر اتبعت لعمال ' + st.farm);
  st.from = []; st.to = []; st.kgs = {}; st.secs = []; st.text = ''; show('work-orders', true);
}
function daWoListHtml(st){
  var d = daToday(), f = {open:function(o){ return o.status === 'open' && o.date <= d; }, upcoming:function(o){ return o.status === 'open' && o.date > d; }, today:function(o){ return o.date === d; }, all:function(){ return true; }}[st.list] || function(){ return true; };
  var all = daWoAll().filter(f).sort(function(a, b){ return (b.date || '').localeCompare(a.date || '') || (b.at || '').localeCompare(a.at || ''); });
  return '<div class="card"><div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">' + [['open', 'المفتوحة'], ['upcoming', 'الجاية'], ['today', 'النهارده'], ['all', 'الكل']].map(function(t){ return '<button onclick="daWoSet(&quot;list&quot;,&quot;' + t[0] + '&quot;,true)" style="padding:6px 14px;border-radius:99px;border:1.5px solid var(--line);font:inherit;cursor:pointer;background:' + (st.list === t[0] ? 'var(--teal);color:#fff' : '#fff') + '">' + t[1] + '</button>'; }).join('') + '</div>'
    + (all.length ? all.map(daWoCardIssuer).join('') : '<div style="text-align:center;color:var(--muted);padding:20px">مفيش أوامر هنا.</div>') + '</div>';
}
function daWoStatusChip(o, T){ T = T || daWoT(); var late = o.status === 'open' && o.date < daToday() && o.kind !== 'visit';
  var c = o.status === 'done' ? ['#dcfce7', '#166534', T.st_done] : o.status === 'notdone' ? ['#fee2e2', '#991b1b', T.st_not] : late ? ['#fee2e2', '#991b1b', T.st_open + ' · ' + T.late] : ['#fef9c3', '#854d0e', T.st_open];
  return '<span style="padding:3px 10px;border-radius:99px;background:' + c[0] + ';color:' + c[1] + ';font-weight:800;font-size:12px;white-space:nowrap">' + c[2] + '</span>'; }
function daWoCardIssuer(o){
  return '<div class="wo-item" data-id="' + daEsc(o.id) + '" style="border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin-bottom:8px;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">'
    + '<div><b>' + daEsc(daWoLabel(o, DA_WO_T.ar)) + '</b>' + (o.text ? ' <span>' + daEsc(o.text) + '</span>' : '') + '<div style="font-size:12px;color:var(--muted);margin-top:3px">' + daEsc(o.farm) + ' · ' + daEsc(o.date) + ' · من ' + daEsc(o.byName || o.by || '') + (o.reply ? ' · <b style="color:var(--text)">الرد: ' + daEsc(o.reply) + '</b>' : '') + (o.doneByName ? ' · ' + daEsc(o.doneByName) : '') + '</div></div>'
    + '<div style="display:flex;gap:6px;align-items:center">' + daWoStatusChip(o, DA_WO_T.ar) + (o.status === 'open' ? '<button onclick="daWoCancel(&quot;' + daEsc(o.id) + '&quot;)" title="إلغاء" style="border:1px solid var(--line);background:#fff;border-radius:7px;cursor:pointer;padding:3px 8px">🗑</button>' : '') + '</div></div>';
}
function daWoCancel(id){ if(!confirm('إلغاء الأمر ده؟')) return; updateTX(id, {deleted:true}); _dataVer++; show(currentView, true); }
// ── routine editor ──
function daRoutineHtml(st){
  var R = daRoutine(), f = st.rfarm || st.farm, list = (R[f] || []).slice(), inp = 'padding:7px 9px;border:1.5px solid var(--line);border-radius:7px;font:inherit;font-size:14px', reg = getFarmsRegistry();
  window._rtEdit = window._rtEdit && window._rtEdit.farm === f ? window._rtEdit : {farm:f, list:JSON.parse(JSON.stringify(list))};
  var L = window._rtEdit.list;
  return '<div class="card"><div style="display:flex;gap:10px;align-items:end;flex-wrap:wrap;margin-bottom:10px"><div class="field" style="margin:0"><label>المكان</label><select style="' + inp + '" onchange="daWoState().rfarm=this.value;window._rtEdit=null;show(&quot;work-orders&quot;,true)">' + daFarms().map(function(x){ return '<option value="' + daEsc(x) + '"' + (f === x ? ' selected' : '') + '>' + daEsc(x) + (reg[x] && reg[x] !== x ? ' — ' + daEsc(reg[x]) : '') + '</option>'; }).join('') + '</select></div>'
    + '<div style="font-size:12px;color:var(--muted);flex:1">الشغل الثابت كل يوم في المكان ده — العامل بيعلّم ✔ على كل بند.</div></div>'
    + '<table id="rt-table" style="border-collapse:collapse;width:100%;font-size:14px"><tr style="background:#f1f5f9"><th style="padding:6px;width:110px">الساعة</th><th style="padding:6px;text-align:start">الشغل</th><th style="padding:6px">الأيام</th><th></th></tr>'
    + L.map(function(r, i){ return '<tr><td style="padding:4px"><input type="time" class="rt-time" value="' + daEsc(r.time || '') + '" style="' + inp + '" oninput="window._rtEdit.list[' + i + '].time=this.value"/></td>'
      + '<td style="padding:4px"><input class="rt-text" value="' + daEsc(r.text || '') + '" style="' + inp + ';width:100%" placeholder="مثلاً: قياس أكسجين كل السكاشن" oninput="window._rtEdit.list[' + i + '].text=this.value"/></td>'
      + '<td style="padding:4px;white-space:nowrap">' + DA_WO_DAYS.map(function(dn, wd){ var on = !r.days || !r.days.length || r.days.indexOf(wd) >= 0; return '<button type="button" onclick="daRtDay(' + i + ',' + wd + ')" style="width:28px;height:28px;margin:1px;border-radius:50%;border:1.5px solid ' + (on ? 'var(--teal)' : 'var(--line)') + ';background:' + (on ? 'var(--teal);color:#fff' : '#fff') + ';font:inherit;font-size:12px;cursor:pointer">' + dn + '</button>'; }).join('') + '</td>'
      + '<td style="padding:4px"><button type="button" onclick="window._rtEdit.list.splice(' + i + ',1);show(&quot;work-orders&quot;,true)" style="border:1px solid var(--line);background:#fff;border-radius:7px;cursor:pointer;padding:4px 8px">🗑</button></td></tr>'; }).join('')
    + '</table><div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button id="rt-add" type="button" onclick="window._rtEdit.list.push({id:&quot;r&quot;+Date.now(),time:&quot;&quot;,text:&quot;&quot;,days:null});show(&quot;work-orders&quot;,true)" style="' + inp + ';background:#fff;cursor:pointer">➕ بند</button>'
    + '<button id="rt-save" class="savebtn" style="width:auto;padding:9px 20px" onclick="daRtSave()">💾 حفظ الروتين</button></div>'
    + '<div style="font-size:11px;color:var(--muted);margin-top:6px">الأيام: ح ن ث ر خ ج س = الأحد … السبت. كل الأيام متعلّمة = كل يوم.</div></div>';
}
function daRtDay(i, wd){ var r = window._rtEdit.list[i], all = [0, 1, 2, 3, 4, 5, 6], d = r.days && r.days.length ? r.days.slice() : all.slice(), k = d.indexOf(wd);
  if(k >= 0) d.splice(k, 1); else d.push(wd); r.days = d.length === 7 ? null : d.sort(); show('work-orders', true); }
function daRtSave(){ var R = daRoutine(), e = window._rtEdit; R[e.farm] = e.list.filter(function(r){ return String(r.text || '').trim(); }).map(function(r){ return {id:r.id || 'r' + Date.now(), time:r.time || '', text:String(r.text).trim(), days:r.days || null}; });
  localStorage.setItem(DA_ROUTINE_KEY, JSON.stringify(R)); window._rtEdit = null; toast('✅ اتحفظ روتين ' + e.farm + ' — هيظهر لعمال المكان'); show('work-orders', true); }
// ── the worker's side ──
function renderWoMine(){
  var T = daWoT(), due = daWoDue(), up = daWoUpcoming(), done = daWoMine().filter(function(o){ return o.status !== 'open' && o.date >= daAddDays(daToday(), -2); });
  var card = function(o, act){ var late = o.date < daToday() && o.kind !== 'visit';
    return '<div class="wo-mine" data-id="' + daEsc(o.id) + '" style="border:2px solid ' + (act ? (late ? '#ef4444' : 'var(--teal)') : 'var(--line)') + ';border-radius:12px;padding:12px;margin-bottom:10px;background:#fff">'
      + '<div style="font-size:16px;font-weight:800;line-height:1.6">' + daEsc(daWoLabel(o, T)) + '</div>' + (o.kind === 'visit' ? '<div style="font-size:15px;margin-top:4px;font-weight:700">' + T.prep + '</div>' : '') + (o.text ? '<div style="font-size:15px;margin-top:4px">' + daEsc(o.text) + '</div>' : '')
      + '<div style="font-size:12px;color:var(--muted);margin-top:4px">' + daEsc(o.farm) + ' · ' + daEsc(daFmtDate(o.date)) + ' · ' + T.by + ' ' + daEsc(o.byName || '') + ' ' + (act ? '' : daWoStatusChip(o, T)) + (o.reply ? ' · ' + T.reason + ': ' + daEsc(o.reply) : '') + '</div>'
      + (act ? '<div style="display:flex;gap:8px;margin-top:10px"><button class="wo-ok" onclick="daWoAnswer(&quot;' + daEsc(o.id) + '&quot;,true)" style="flex:1;padding:12px;border:0;border-radius:10px;background:var(--teal);color:#fff;font:inherit;font-weight:800;font-size:16px;cursor:pointer">' + (o.kind === 'visit' ? T.seen : T.done) + '</button>'
        + (o.kind === 'visit' ? '' : '<button class="wo-no" onclick="daWoAnswer(&quot;' + daEsc(o.id) + '&quot;,false)" style="flex:1;padding:12px;border:2px solid #ef4444;border-radius:10px;background:#fff;color:#b91c1c;font:inherit;font-weight:800;font-size:16px;cursor:pointer">' + T.not + '</button>') + '</div>' : '') + '</div>'; };
  var rt = daMyFarms().map(function(f){ var L = daRoutineToday(f, daToday()); if(!L.length) return ''; var D = daRoutineDone(f, daToday());
    return '<div class="card rt-card" data-farm="' + daEsc(f) + '" style="margin-bottom:12px"><div class="card-title">' + T.routine + ' — ' + daEsc(f) + ' <span style="font-weight:400;color:var(--muted)">' + Object.keys(D).length + '/' + L.length + '</span></div>'
      + L.map(function(r){ var x = D[r.id]; return '<div style="display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid #f1f5f9"><span style="min-width:52px;font-weight:800;color:var(--muted)" dir="ltr">' + daEsc(r.time || '') + '</span><span style="flex:1;font-size:15px;' + (x ? 'text-decoration:line-through;color:var(--muted)' : '') + '">' + daEsc(r.text) + '</span>'
        + (x ? '<span style="color:var(--green);font-weight:800">✔ ' + daEsc(x.doneByName || '') + '</span>' : '<button class="rt-ok" onclick=\'daRoutineTick("' + daEsc(f) + '","' + daEsc(r.id) + '",' + JSON.stringify(r.text).replace(/'/g, '&#39;') + ')\' style="padding:9px 16px;border:0;border-radius:10px;background:var(--teal);color:#fff;font:inherit;font-weight:800;cursor:pointer">✔</button>') + '</div>'; }).join('') + '</div>'; }).join('');
  return '<div class="ph"><div><h2>' + T.head + '</h2></div></div>' + '<div style="font-weight:800;margin:0 0 6px">' + T.today + '</div>'
    + (due.length ? due.map(function(o){ return card(o, true); }).join('') : '<div class="card" style="text-align:center;padding:20px;font-size:16px">' + T.none + '</div>') + rt
    + (up.length ? '<div style="font-weight:800;margin:14px 0 6px">' + T.upcoming + '</div>' + up.map(function(o){ return card(o, false); }).join('') : '')
    + (done.length ? '<div style="font-weight:800;margin:14px 0 6px;color:var(--muted)">' + T.done_list + '</div>' + done.map(function(o){ return card(o, false); }).join('') : '');
}
function daWoAnswer(id, ok){
  var T = daWoT(), why = '';
  if(!ok){ why = prompt(T.why, ''); if(why === null) return; }
  updateTX(id, {status:ok ? 'done' : 'notdone', reply:why || '', doneBy:currentUser ? currentUser.email : '', doneByName:(getSession() || {}).name || '', doneAt:new Date().toISOString()});
  _dataVer++; toast(ok ? T.okd : T.okn); show(currentView, true); daWoBell();
}
function daWoPending(){   // what the bell counts: open orders due (and visits ahead) + routine tasks whose time has come and are not ticked
  var n = daWoDue().length, now = new Date(), hm = ('0' + now.getHours()).slice(-2) + ':' + ('0' + now.getMinutes()).slice(-2);
  daMyFarms().forEach(function(f){ var D = daRoutineDone(f, daToday()); daRoutineToday(f, daToday()).forEach(function(r){ if(!D[r.id] && (!r.time || r.time <= hm)) n++; }); });
  return n;
}
function daWoBell(){
  var bar = document.getElementById('da-wbar'); if(!bar || !currentUser || currentUserRole !== 'worker') return;
  var due = daWoDue(), n = daWoPending(), b = document.getElementById('wo-bell'), rf = bar.querySelector('.rf');
  if(!b && rf){ rf.insertAdjacentHTML('beforebegin', '<button id="wo-bell" data-v="wo-mine" onclick="show(&quot;wo-mine&quot;)"></button>'); b = document.getElementById('wo-bell'); }
  if(b){ b.textContent = '🔔' + (n ? ' ' + n : ''); b.className = (currentView === 'wo-mine' ? 'on' : '') + (n ? ' wo-has' : ''); b.style.cssText = n ? 'background:#fee2e2;color:#991b1b;font-weight:800' : ''; }
  var seen = {}; try{ seen = JSON.parse(localStorage.getItem('da_wo_seen') || '{}'); }catch(e){}
  var fresh = due.concat(daWoUpcoming()).filter(function(o){ return !seen[o.id]; });
  if(fresh.length){ fresh.forEach(function(o){ seen[o.id] = 1; }); try{ localStorage.setItem('da_wo_seen', JSON.stringify(seen)); }catch(e){}
    toast(daWoT().fresh + ' (' + fresh.length + ')'); try{ if(navigator.vibrate) navigator.vibrate([200, 100, 200]); }catch(e){}
    try{ var A = window.AudioContext || window.webkitAudioContext; if(A){ var c = new A(), g = c.createGain(), o2 = c.createOscillator(); o2.frequency.value = 880; o2.connect(g); g.connect(c.destination); g.gain.value = 0.15; o2.start(); o2.stop(c.currentTime + 0.35); } }catch(e){} }
}
// ── tied to the feed sheet ──
function daWoForSheet(farm, date){
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
    if(x.nofeed){ if(!e.value) e.value = 'X'; tag('🚫 ' + T.nofeed + (x.nofeed.text ? ' — ' + x.nofeed.text : '')); if(any.indexOf(x.nofeed) < 0) any.push(x.nofeed); }
    else if(x.feed){ var kg = (x.feed.kgs || {})[r.unit] !== undefined ? x.feed.kgs[r.unit] : x.feed.kg; if(kg !== undefined){ if(!e.value && !multi) e.value = String(kg); tag('🌾 ' + kg + ' ' + T.kgd); } } });
  var box = document.getElementById('fs-copybox');
  if(any.length && box && !document.getElementById('wo-sheet-note')) box.insertAdjacentHTML('beforebegin', '<div class="card" id="wo-sheet-note" style="margin-bottom:12px;background:#fef9c3;border:2px solid #eab308;font-weight:700">🚫 ' + daEsc(T.nofeed) + ': ' + any.map(function(o){ return (o.tanks || []).map(daWoTank).join('، ') + (o.text ? ' (' + o.text + ')' : ''); }).join(' · ') + '</div>');
}
function daWoSweep(){   // close open orders whose condition is met, however it was saved
  var tx = null, n = 0, has = function(type, u, from){ return tx.some(function(f){ return type.indexOf(f.type) >= 0 && !f.deleted && f.unit === u && f.date >= from; }); };
  daWoAll().forEach(function(o){ if(o.status !== 'open' || !(o.tanks || []).length) return; tx = tx || getTX(); var why = null;
    if(o.kind === 'nofeed' && o.tanks.every(function(u){ return tx.some(function(f){ return f.type === 'feeding' && !f.deleted && f.unit === u && f.date === o.date && f.fasted; }); })) why = 'اتسجل في شيت العلف';
    if((o.kind === 'transfer' || o.kind === 'grade') && o.tanks.every(function(u){ return has(['transfer_out'], u, o.date); })) why = 'اتسجل النقل';
    if(o.kind === 'harvest' && o.tanks.every(function(u){ return has(['harvesting', 'harvest'], u, o.date); })) why = 'اتسجل الحصاد';
    if(why){ updateTX(o.id, {status:'done', reply:why, doneAt:new Date().toISOString()}); n++; } });
  if(n) _dataVer++; return n;
}
function daWoStatusCard(date){
  var open = daWoMine().filter(function(o){ return o.status === 'open' && o.date <= date && o.kind !== 'visit'; }), not = daWoMine().filter(function(o){ return o.status === 'notdone' && o.date === date; });
  var rts = daMyFarms().map(function(f){ var L = daRoutineToday(f, date); if(!L.length) return ''; var D = daRoutineDone(f, date), k = L.filter(function(r){ return D[r.id]; }).length;
    return '<span style="padding:4px 10px;border-radius:8px;background:' + (k >= L.length ? '#dcfce7' : k ? '#fef9c3' : '#fee2e2') + ';margin-inline-end:6px"><b>' + daEsc(f) + '</b> روتين ' + k + '/' + L.length + '</span>'; }).join('');
  if(!open.length && !not.length && !rts) return '';
  return '<div class="card" id="es-wo" style="margin-bottom:12px;border-inline-start:6px solid ' + (open.length || not.length ? '#ef4444' : '#22c55e') + '"><div class="card-title">📋 أوامر الشغل والروتين</div>' + (rts ? '<div style="margin-bottom:6px;font-size:13px">' + rts + '</div>' : '')
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
  var _addPreWo = addTX;
  addTX = function(t){ var r = _addPreWo.apply(this, arguments); try{ if(t && ['transfer_out', 'harvesting', 'harvest'].indexOf(t.type) >= 0) setTimeout(function(){ if(daWoSweep()) daWoBell(); }, 0); }catch(e){} return r; };
  setInterval(function(){ try{ if(currentUser){ daWoSweep(); daWoBell(); } }catch(e){} }, 10000);
}
