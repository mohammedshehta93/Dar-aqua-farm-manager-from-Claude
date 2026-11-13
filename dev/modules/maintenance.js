// ══════════════════════════════════════════════════════════
//  MAINTENANCE · PURCHASE REQUESTS · TODAY ON THE DASHBOARD (owner, 2026-11-13)
// ══════════════════════════════════════════════════════════
// The standalone maintenance tool is merged: the SAME Supabase table (maintenance_requests) and photo bucket
// (maintenance-images), so every old request is here and the old tool works alongside during the move. Anyone signed in
// reports a fault (area, common fault, urgency, type, target date, photos); those who may fix (technicians: the
// "fix_maint" permission; engineers, managers, admin) move it open → in progress → closed with cause / action / parts /
// technician; a supervisor confirms. Urgent faults notify the supervisors' phones. Parts needed → a purchase request in
// one tap. Purchase requests (transactions records "purchase"): requested → approved / rejected (with why) → ordered →
// received; approvers hold "approve_purchase" (managers, admin). The dashboard shows "📰 today": every entry, order,
// routine, fault and purchase of the day, newest first.
var DA_MT_AREAS = [['FH1', 'F1', 'Fish House 1'], ['FH2', 'F2', 'Fish House 2'], ['NURSERY', 'F3', 'Nursery'], ['OUTSIDE', '', 'Outside']];
var DA_MT_FAULTS = {
  FH1:['Water circulation pump stopped', 'Water circulation pump tripped', 'Blower stopped', 'Blower tripped', 'Blower loud noise', 'Submersible pump stopped', 'Oxygen solenoid valve faulty', 'Lights not working', 'AC / cooling unit not working', 'Pipe leak', 'Pipe broken'],
  FH2:['Paddlewheel aerator stopped', 'Paddlewheel aerator tripped', 'Paddlewheel shaft broken', 'Paddlewheel socket needs replacement', 'Generator stopped', 'Generator power cut', 'Generator drive belt broken', 'Blower stopped', 'Blower tripped', 'Blower loud noise', 'Submersible pump stopped', 'Drum filter pump stopped', 'Drum filter pump leak', 'Drum filter pump low pressure', 'Drum filter screen torn / needs replacement', 'Drum filter iron frame needs replacement', 'Transfer pump stopped', 'Transfer pump loud noise', 'Transfer pump low pressure', 'Auto float switch faulty', 'Pressure washer stopped', 'Pressure washer low pressure', 'Net damaged / needs repair', 'Pipe leak', 'Pipe broken'],
  NURSERY:['Water circulation pump stopped', 'Water circulation pump tripped', 'Blower stopped', 'Blower tripped', 'Blower loud noise', 'Submersible pump stopped', 'Oxygen solenoid valve faulty', 'Lights not working', 'Pipe leak', 'Pipe broken'],
  OUTSIDE:['Blower stopped', 'Blower tripped', 'Blower loud noise', 'Net damaged / needs repair', 'Pipe leak', 'Pipe broken', 'Generator stopped', 'Generator power cut', 'Generator drive belt broken', 'Pressure washer stopped', 'Pressure washer low pressure']};
var DA_MT_T = {
  ar:{head:'🔧 الصيانة', report:'➕ بلّغ عن عطل', area:'المكان', fault:'عطل متكرر (اختياري)', summary:'العطل *', details:'التفاصيل', prio:'الأولوية', type:'النوع', target:'مطلوب يخلص يوم', photos:'صور (لحد 4)', send:'📤 ابعت البلاغ',
    high:'عاجل', medium:'متوسط', low:'عادي', corrective:'إصلاح', preventive:'وقائية', emergency:'طارئ', open:'مفتوح', in_progress:'شغالين فيه', closed:'اتقفل', overdue:'متأخر', all:'الكل', mine:'بلاغاتي',
    start:'▶ بدأنا', close:'✅ اتصلح', reopen:'↩️ افتحه تاني', cause:'السبب', action:'اللي اتعمل', parts:'قطع الغيار', tech:'الفني', verified:'اتأكد منه', save:'💾 حفظ', buy:'🛒 اطلب قطع غيار', back:'← رجوع',
    sent:'✅ اتبعت البلاغ', need:'⚠️ اختار المكان واكتب العطل والتاريخ', none:'مفيش بلاغات هنا ✅', by:'من', offline:'⚠️ مش متصل — البلاغات بتحتاج إنترنت', uploading:'📷 بيرفع الصور…'},
  en:{head:'🔧 Maintenance', report:'➕ Report a fault', area:'Area', fault:'Common fault (optional)', summary:'Fault *', details:'Details', prio:'Priority', type:'Type', target:'Needed by', photos:'Photos (up to 4)', send:'📤 Send',
    high:'Urgent', medium:'Medium', low:'Low', corrective:'Corrective', preventive:'Preventive', emergency:'Emergency', open:'Open', in_progress:'In progress', closed:'Closed', overdue:'Overdue', all:'All', mine:'Mine',
    start:'▶ Started', close:'✅ Fixed', reopen:'↩️ Reopen', cause:'Root cause', action:'Action taken', parts:'Parts', tech:'Technician', verified:'Verified by', save:'💾 Save', buy:'🛒 Request parts', back:'← Back',
    sent:'✅ Fault reported', need:'⚠️ Choose the area, write the fault and the date', none:'No requests here ✅', by:'by', offline:'⚠️ Offline — faults need the internet', uploading:'📷 Uploading photos…'},
  ur:{head:'🔧 مرمت', report:'➕ خرابی کی اطلاع دیں', area:'جگہ', fault:'عام خرابی (اختیاری)', summary:'خرابی *', details:'تفصیل', prio:'ترجیح', type:'قسم', target:'کب تک ٹھیک ہو', photos:'تصویریں (4 تک)', send:'📤 بھیجیں',
    high:'فوری', medium:'درمیانی', low:'عام', corrective:'مرمت', preventive:'احتیاطی', emergency:'ہنگامی', open:'کھلا', in_progress:'کام جاری', closed:'بند', overdue:'دیر', all:'سب', mine:'میری',
    start:'▶ شروع کیا', close:'✅ ٹھیک ہو گیا', reopen:'↩️ دوبارہ کھولیں', cause:'وجہ', action:'کیا کیا', parts:'پرزے', tech:'ٹیکنیشن', verified:'تصدیق', save:'💾 محفوظ کریں', buy:'🛒 پرزے منگوائیں', back:'← واپس',
    sent:'✅ اطلاع بھیج دی', need:'⚠️ جگہ چنیں، خرابی اور تاریخ لکھیں', none:'یہاں کوئی درخواست نہیں ✅', by:'از', offline:'⚠️ انٹرنیٹ نہیں — اطلاع کے لیے انٹرنیٹ چاہیے', uploading:'📷 تصویریں بھیجی جا رہی ہیں…'}};
var DA_PR_T = {
  ar:{head:'🛒 طلبات الشرا', add:'➕ طلب شرا', item:'الصنف *', qty:'الكمية *', unit:'الوحدة', reason:'السبب', urg:'الاستعجال', site:'المكان', link:'مرتبط بعطل', send:'📤 ابعت الطلب', requested:'مستني الاعتماد', approved:'اتعتمد', rejected:'اترفض', ordered:'اتطلب', received:'اتستلم',
    approve:'✔ اعتماد', reject:'✖ رفض', order:'🚚 اتطلب', receive:'📦 اتستلم', why:'سبب الرفض؟', cost:'التكلفة', sent:'✅ اتبعت الطلب', need:'⚠️ اكتب الصنف والكمية', none:'مفيش طلبات هنا', waiting:'مستنية', all:'الكل', month:'الشهر ده'},
  en:{head:'🛒 Purchase requests', add:'➕ Request', item:'Item *', qty:'Qty *', unit:'Unit', reason:'Reason', urg:'Urgency', site:'Site', link:'For fault', send:'📤 Send request', requested:'Waiting approval', approved:'Approved', rejected:'Rejected', ordered:'Ordered', received:'Received',
    approve:'✔ Approve', reject:'✖ Reject', order:'🚚 Ordered', receive:'📦 Received', why:'Why rejected?', cost:'Cost', sent:'✅ Request sent', need:'⚠️ Write the item and quantity', none:'No requests here', waiting:'Waiting', all:'All', month:'This month'},
  ur:{head:'🛒 خریداری کی درخواستیں', add:'➕ درخواست', item:'چیز *', qty:'مقدار *', unit:'اکائی', reason:'وجہ', urg:'فوری پن', site:'جگہ', link:'خرابی کے لیے', send:'📤 درخواست بھیجیں', requested:'منظوری کا انتظار', approved:'منظور', rejected:'نامنظور', ordered:'آرڈر ہو گیا', received:'وصول',
    approve:'✔ منظور', reject:'✖ نامنظور', order:'🚚 آرڈر', receive:'📦 وصول', why:'نامنظوری کی وجہ؟', cost:'قیمت', sent:'✅ درخواست بھیج دی', need:'⚠️ چیز اور مقدار لکھیں', none:'کوئی درخواست نہیں', waiting:'انتظار', all:'سب', month:'اس مہینے'}};
function daMtL(){ return typeof daLangNow === 'function' ? daLangNow() : (isAr ? 'ar' : 'en'); }
function daMtT(){ return DA_MT_T[daMtL()] || DA_MT_T.ar; }
function daPrT(){ return DA_PR_T[daMtL()] || DA_PR_T.ar; }
function daCanFix(){ return ['admin', 'manager', 'engineer'].indexOf(currentUserRole) >= 0 || (typeof hasPerm === 'function' && hasPerm('fix_maint')); }
function daCanApprovePR(){ return ['admin', 'manager'].indexOf(currentUserRole) >= 0 || (typeof hasPerm === 'function' && hasPerm('approve_purchase')); }
function daIsSupervisor(){ return ['admin', 'manager', 'engineer'].indexOf(currentUserRole) >= 0; }
function daMeName(){ return (getSession() || {}).name || (currentUser && currentUser.email) || ''; }
// ── maintenance data (online: the shared table) ──
function daMtState(){ var s = window._mt = window._mt || {}; s.list = s.list || []; if(!s.filter) s.filter = 'open'; if(!s.form) s.form = {area:'', fault:'', summary:'', details:'', prio:'medium', type:'corrective', target:daAddDays(daToday(), 1)}; return s; }
async function daMtLoad(force){
  var s = daMtState(); if(s.loading || (!force && s.at && Date.now() - s.at < 20000)) return s.list;
  s.loading = true;
  try{ var rows = await sbFetch('maintenance_requests?select=*&order=created_at.desc&limit=500'); s.list = rows || []; s.at = Date.now(); s.err = '';
    try{ localStorage.setItem('da_mt_cache', JSON.stringify(s.list.slice(0, 200))); }catch(e){}
    if(daCanFix() && s.list.some(function(r){ return !r.farm_id; })) sbFetch('maintenance_requests?farm_id=is.null', {method:'PATCH', body:JSON.stringify({farm_id:SB_FARM_ID})}).catch(function(){});   // the old tool's rows join this farm
  }catch(e){ s.err = String(e && e.message || e); if(!s.list.length){ try{ s.list = JSON.parse(localStorage.getItem('da_mt_cache') || '[]'); }catch(x){} } }
  s.loading = false; return s.list;
}
function daMtOverdue(r){ return r.target_date && r.status !== 'closed' && r.target_date < daToday(); }
function daMtArea(code){ var a = DA_MT_AREAS.filter(function(x){ return x[0] === code; })[0]; return a ? a[2] : (code || ''); }
function daMtChip(txt, bg, fg){ return '<span style="padding:3px 9px;border-radius:99px;background:' + bg + ';color:' + fg + ';font-weight:800;font-size:12px;white-space:nowrap">' + txt + '</span>'; }
function daMtStatusChip(r, T){ var od = daMtOverdue(r);
  return r.status === 'closed' ? daMtChip(T.closed, '#dcfce7', '#166534') : r.status === 'in_progress' ? daMtChip(T.in_progress + (od ? ' · ' + T.overdue : ''), '#dbeafe', '#1e40af') : daMtChip(T.open + (od ? ' · ' + T.overdue : ''), od ? '#fee2e2' : '#fef9c3', od ? '#991b1b' : '#854d0e'); }
function daMtPrioChip(r, T){ return r.priority === 'high' ? daMtChip('🔴 ' + T.high, '#fee2e2', '#991b1b') : r.priority === 'low' ? daMtChip(T.low, '#f1f5f9', '#475569') : daMtChip(T.medium, '#ffedd5', '#9a3412'); }
function renderMaint(){
  var s = daMtState(), T = daMtT(), inp = 'padding:9px 10px;border:1.5px solid var(--line);border-radius:8px;font:inherit;font-size:14px;width:100%';
  if(!s.at && !s.loading) daMtLoad().then(function(){ if(currentView === 'maint') show('maint', true); });
  if(s.open) return daMtDetail(s, T, inp);
  var L = s.list, cnt = function(f){ return L.filter(f).length; }, my = daMeName();
  var flt = {open:function(r){ return r.status !== 'closed'; }, high:function(r){ return r.priority === 'high' && r.status !== 'closed'; }, overdue:daMtOverdue, in_progress:function(r){ return r.status === 'in_progress'; }, closed:function(r){ return r.status === 'closed'; }, mine:function(r){ return r.requested_by === my; }, all:function(){ return true; }}[s.filter] || function(){ return true; };
  var h = '<div class="ph"><div><h2>' + T.head + '</h2></div><button id="mt-new" class="savebtn" style="width:auto;padding:10px 18px" onclick="window._mt.formOpen=!window._mt.formOpen;show(&quot;maint&quot;,true)">' + T.report + '</button></div>';
  if(s.err && !navigator.onLine) h += '<div class="card" style="background:#fef9c3">' + T.offline + '</div>';
  if(s.formOpen){ var f = s.form, faults = DA_MT_FAULTS[f.area] || [];
    h += '<div class="card" id="mt-form" style="margin-bottom:12px;border:2px solid var(--teal)"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px">'
      + '<div class="field" style="margin:0"><label>' + T.area + ' *</label><select id="mt-area" style="' + inp + '" onchange="daMtF(&quot;area&quot;,this.value,true)"><option value="">—</option>' + DA_MT_AREAS.map(function(a){ return '<option value="' + a[0] + '"' + (f.area === a[0] ? ' selected' : '') + '>' + a[2] + (a[1] ? ' (' + a[1] + ')' : '') + '</option>'; }).join('') + '</select></div>'
      + (faults.length ? '<div class="field" style="margin:0"><label>' + T.fault + '</label><select id="mt-fault" style="' + inp + '" onchange="daMtF(&quot;summary&quot;,this.value,true)"><option value="">—</option>' + faults.map(function(x){ return '<option' + (f.summary === x ? ' selected' : '') + '>' + daEsc(x) + '</option>'; }).join('') + '</select></div>' : '')
      + '<div class="field" style="margin:0"><label>' + T.prio + '</label><select id="mt-prio" style="' + inp + '" onchange="daMtF(&quot;prio&quot;,this.value)">' + ['high', 'medium', 'low'].map(function(p){ return '<option value="' + p + '"' + (f.prio === p ? ' selected' : '') + '>' + T[p] + '</option>'; }).join('') + '</select></div>'
      + '<div class="field" style="margin:0"><label>' + T.type + '</label><select id="mt-type" style="' + inp + '" onchange="daMtF(&quot;type&quot;,this.value)">' + ['corrective', 'preventive', 'emergency'].map(function(p){ return '<option value="' + p + '"' + (f.type === p ? ' selected' : '') + '>' + T[p] + '</option>'; }).join('') + '</select></div>'
      + '<div class="field" style="margin:0"><label>' + T.target + ' *</label><input type="date" id="mt-target" data-nodirty="1" value="' + f.target + '" style="' + inp + '" onchange="daMtF(&quot;target&quot;,this.value)"/></div></div>'
      + '<div class="field" style="margin:10px 0 0"><label>' + T.summary + '</label><input id="mt-summary" value="' + daEsc(f.summary) + '" style="' + inp + '" oninput="daMtF(&quot;summary&quot;,this.value)"/></div>'
      + '<div class="field" style="margin:10px 0 0"><label>' + T.details + '</label><textarea id="mt-details" rows="2" style="' + inp + '" oninput="daMtF(&quot;details&quot;,this.value)">' + daEsc(f.details) + '</textarea></div>'
      + '<div class="field" style="margin:10px 0 0"><label>' + T.photos + '</label><input type="file" id="mt-photos" accept="image/*" multiple capture="environment" style="font-size:14px"/></div>'
      + '<button id="mt-send" class="savebtn" style="width:auto;padding:12px 24px;margin-top:12px;font-size:16px" onclick="daMtSubmit()">' + T.send + '</button></div>'; }
  h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">' + [['open', T.open + ' (' + cnt(function(r){ return r.status !== 'closed'; }) + ')'], ['high', '🔴 ' + T.high + ' (' + cnt(function(r){ return r.priority === 'high' && r.status !== 'closed'; }) + ')'], ['overdue', T.overdue + ' (' + cnt(daMtOverdue) + ')'], ['in_progress', T.in_progress], ['closed', T.closed], ['mine', T.mine], ['all', T.all]].map(function(t){
    return '<button class="mt-flt" data-f="' + t[0] + '" onclick="window._mt.filter=&quot;' + t[0] + '&quot;;show(&quot;maint&quot;,true)" style="padding:6px 13px;border-radius:99px;border:1.5px solid var(--line);font:inherit;cursor:pointer;background:' + (s.filter === t[0] ? 'var(--teal);color:#fff' : '#fff') + '">' + t[1] + '</button>'; }).join('') + '</div>';
  var list = L.filter(flt);
  h += list.length ? list.map(function(r){ return '<div class="card mt-item" data-id="' + daEsc(r.id) + '" onclick="window._mt.open=&quot;' + daEsc(r.id) + '&quot;;show(&quot;maint&quot;,true)" style="margin-bottom:8px;cursor:pointer;border-inline-start:6px solid ' + (r.priority === 'high' && r.status !== 'closed' ? '#ef4444' : r.status === 'closed' ? '#22c55e' : '#f59e0b') + '">'
      + '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><b style="font-size:15px">' + daEsc(r.summary || '') + '</b><span style="display:flex;gap:5px">' + daMtPrioChip(r, T) + daMtStatusChip(r, T) + '</span></div>'
      + '<div style="font-size:12px;color:var(--muted);margin-top:4px">' + daEsc(r.ref || '') + ' · ' + daEsc(daMtArea(r.area)) + ' · ' + T[r.type || 'corrective'] + ' · ' + T.by + ' ' + daEsc(r.requested_by || '') + ' · ' + daEsc((r.created_at || '').slice(0, 10)) + (r.target_date ? ' → ' + daEsc(r.target_date) : '') + ((r.photo_urls || []).length ? ' · 📷 ' + r.photo_urls.length : '') + '</div></div>'; }).join('')
    : '<div class="card" style="text-align:center;color:var(--muted);padding:24px">' + (s.loading && !s.at ? '…' : T.none) + '</div>';
  return h;
}
function daMtF(k, v, redraw){ var s = daMtState(); s.form[k] = v; if(k === 'area') s.form.summary = ''; if(redraw) show('maint', true); }
async function daMtUpload(id, files){
  var urls = [], key = SB_KEY || (getSettings() || {}).sbKey, base = (SB_URL || (getSettings() || {}).sbUrl || '').replace(/\/+$/, '');
  for(var i = 0; i < Math.min(files.length, 4); i++){ var f = files[i], ext = (f.name.split('.').pop() || 'jpg').toLowerCase(), path = id + '/' + Date.now() + '_' + Math.random().toString(36).slice(2) + '.' + ext;
    try{ var r = await fetch(base + '/storage/v1/object/maintenance-images/' + path, {method:'POST', headers:{apikey:key, Authorization:'Bearer ' + (SB_TOKEN || key), 'Content-Type':f.type || 'image/jpeg'}, body:f});
      if(r.ok) urls.push(base + '/storage/v1/object/public/maintenance-images/' + path); }catch(e){} }
  return urls;
}
async function daMtSubmit(){
  var s = daMtState(), f = s.form, T = daMtT(); f.summary = String(daVal('mt-summary') || f.summary || '').trim(); f.details = String(daVal('mt-details') || f.details || '').trim();
  if(!f.area || !f.summary || !f.target){ toast(T.need); return; }
  var a = DA_MT_AREAS.filter(function(x){ return x[0] === f.area; })[0] || [], ref = 'AQUA-' + String(new Date().getFullYear()).slice(2) + '-' + String(Date.now()).slice(-4) + Math.floor(Math.random() * 90 + 10);
  var btn = document.getElementById('mt-send'); if(btn) btn.disabled = true;
  try{
    var ins = await sbFetch('maintenance_requests', {method:'POST', body:JSON.stringify({ref:ref, requested_by:daMeName(), area:f.area, summary:f.summary, details:f.details, priority:f.prio, type:f.type, status:'open', target_date:f.target,
      root_cause:'', corrective_action:'', parts:'', technician:'', verified_by:'', photo_urls:[], farm_id:SB_FARM_ID, site:a[1] || '', reported_by_uid:(typeof daPushUid === 'function' ? daPushUid() : null)})});
    var row = ins && ins[0], fe = document.getElementById('mt-photos'), files = fe && fe.files ? Array.prototype.slice.call(fe.files) : [];
    if(row && files.length){ toast(T.uploading); var urls = await daMtUpload(row.id, files); if(urls.length) await sbFetch('maintenance_requests?id=eq.' + encodeURIComponent(row.id), {method:'PATCH', body:JSON.stringify({photo_urls:urls})}); }
    if(f.prio === 'high' && typeof daPushCall === 'function') daPushCall('/notify', {farm:a[1] || '', audience:'supervisors'});
    s.form = null; s.formOpen = false; toast(T.sent); await daMtLoad(true); show('maint', true);
  }catch(e){ if(btn) btn.disabled = false; toast((navigator.onLine ? '⚠️ ' + String(e && e.message || e).slice(0, 80) : T.offline)); }
}
function daMtDetail(s, T, inp){
  var r = s.list.filter(function(x){ return String(x.id) === String(s.open); })[0]; if(!r){ s.open = null; return renderMaint(); }
  var fix = daCanFix(), sup = daIsSupervisor(), ro = fix ? '' : ' disabled';
  var fld = function(k, label, big){ return '<div class="field" style="margin:8px 0 0"><label>' + label + '</label>' + (big ? '<textarea id="mtd-' + k + '" rows="2" style="' + inp + '"' + ro + '>' + daEsc(r[k] || '') + '</textarea>' : '<input id="mtd-' + k + '" value="' + daEsc(r[k] || '') + '" style="' + inp + '"' + (k === 'verified_by' && !sup ? ' disabled' : ro) + '/>') + '</div>'; };
  return '<div class="ph"><div><h2>🔧 ' + daEsc(r.ref || '') + '</h2></div><button onclick="window._mt.open=null;show(&quot;maint&quot;,true)" style="padding:8px 14px;border:1.5px solid var(--line);background:#fff;border-radius:8px;font:inherit;cursor:pointer">' + T.back + '</button></div>'
    + '<div class="card" id="mt-detail" style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><b style="font-size:17px">' + daEsc(r.summary || '') + '</b><span style="display:flex;gap:5px">' + daMtPrioChip(r, T) + daMtStatusChip(r, T) + '</span></div>'
    + '<div style="font-size:13px;color:var(--muted);margin:6px 0">' + daEsc(daMtArea(r.area)) + ' · ' + T[r.type || 'corrective'] + ' · ' + T.by + ' ' + daEsc(r.requested_by || '') + ' · ' + daEsc((r.created_at || '').slice(0, 16).replace('T', ' ')) + (r.target_date ? ' · ' + T.target + ': ' + daEsc(r.target_date) : '') + (r.closed_at ? ' · ✅ ' + daEsc(r.closed_at.slice(0, 10)) : '') + '</div>'
    + (r.details ? '<div style="font-size:14px;white-space:pre-wrap;margin:6px 0">' + daEsc(r.details) + '</div>' : '')
    + ((r.photo_urls || []).length ? '<div style="display:flex;gap:6px;flex-wrap:wrap;margin:8px 0">' + r.photo_urls.map(function(u){ return '<a href="' + daEsc(u) + '" target="_blank" rel="noopener"><img src="' + daEsc(u) + '" style="width:90px;height:90px;object-fit:cover;border-radius:8px;border:1px solid var(--line)"/></a>'; }).join('') + '</div>' : '')
    + fld('root_cause', T.cause, true) + fld('corrective_action', T.action, true) + fld('parts', T.parts) + fld('technician', T.tech) + fld('verified_by', T.verified)
    + (fix ? '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button id="mtd-save" onclick="daMtSave(null)" style="padding:10px 16px;border:1.5px solid var(--line);background:#fff;border-radius:10px;font:inherit;font-weight:700;cursor:pointer">' + T.save + '</button>'
      + (r.status === 'open' ? '<button id="mtd-start" class="savebtn" style="width:auto;padding:10px 18px;background:#2563eb" onclick="daMtSave(&quot;in_progress&quot;)">' + T.start + '</button>' : '')
      + (r.status !== 'closed' ? '<button id="mtd-close" class="savebtn" style="width:auto;padding:10px 18px" onclick="daMtSave(&quot;closed&quot;)">' + T.close + '</button>' : '<button id="mtd-reopen" onclick="daMtSave(&quot;open&quot;)" style="padding:10px 16px;border:1.5px solid var(--line);background:#fff;border-radius:10px;font:inherit;cursor:pointer">' + T.reopen + '</button>')
      + '<button id="mtd-buy" onclick="daPrFromFault(&quot;' + daEsc(r.id) + '&quot;)" style="padding:10px 16px;border:2px solid #f59e0b;background:#fff;color:#b45309;border-radius:10px;font:inherit;font-weight:800;cursor:pointer">' + T.buy + '</button></div>' : '') + '</div>';
}
async function daMtSave(status){
  var s = daMtState(), T = daMtT(), id = s.open, v = {}; ['root_cause', 'corrective_action', 'parts', 'technician', 'verified_by'].forEach(function(k){ var e = document.getElementById('mtd-' + k); if(e && !e.disabled) v[k] = String(e.value || '').trim(); });
  if(status){ v.status = status; v.closed_at = status === 'closed' ? new Date().toISOString() : null; if(status === 'closed' && !v.technician) v.technician = daMeName(); }
  try{ await sbFetch('maintenance_requests?id=eq.' + encodeURIComponent(id), {method:'PATCH', body:JSON.stringify(v)}); toast('✅'); await daMtLoad(true); show('maint', true); }
  catch(e){ toast(navigator.onLine ? '⚠️ ' + String(e && e.message || e).slice(0, 80) : T.offline); }
}
// ── purchase requests (transactions records: synced, work offline) ──
function daPrAll(){ return getTX().filter(function(t){ return t.type === 'purchase' && !t.deleted; }); }
function daPrState(){ var s = window._pr = window._pr || {}; if(!s.filter) s.filter = 'waiting'; if(!s.form) s.form = {item:'', qty:'', unit:'pcs', reason:'', urg:'medium', site:'', maint:''}; return s; }
function daPrFromFault(id){ var m = daMtState().list.filter(function(x){ return String(x.id) === String(id); })[0] || {}, a = DA_MT_AREAS.filter(function(x){ return x[0] === m.area; })[0] || [];
  var s = daPrState(); s.form = {item:m.parts || '', qty:'1', unit:'pcs', reason:(m.summary || '') + (m.ref ? ' — ' + m.ref : ''), urg:m.priority === 'high' ? 'high' : 'medium', site:a[1] || '', maint:m.ref || ''}; s.formOpen = true; show('purchases'); }
function daPrChip(st, P){ var c = {requested:['#fef9c3', '#854d0e'], approved:['#dbeafe', '#1e40af'], rejected:['#fee2e2', '#991b1b'], ordered:['#ede9fe', '#5b21b6'], received:['#dcfce7', '#166534']}[st] || ['#f1f5f9', '#475569']; return daMtChip(P[st] || st, c[0], c[1]); }
function renderPurchases(){
  var s = daPrState(), P = daPrT(), T = daMtT(), inp = 'padding:9px 10px;border:1.5px solid var(--line);border-radius:8px;font:inherit;font-size:14px;width:100%', reg = getFarmsRegistry(), mo = daToday().slice(0, 7);
  var L = daPrAll().sort(function(a, b){ return (b.ts || '').localeCompare(a.ts || '') || (b.date || '').localeCompare(a.date || ''); });
  var flt = {waiting:function(r){ return r.status === 'requested'; }, approved:function(r){ return r.status === 'approved'; }, ordered:function(r){ return r.status === 'ordered'; }, received:function(r){ return r.status === 'received'; }, rejected:function(r){ return r.status === 'rejected'; }, month:function(r){ return (r.date || '').slice(0, 7) === mo; }, all:function(){ return true; }}[s.filter] || function(){ return true; };
  var h = '<div class="ph"><div><h2>' + P.head + '</h2></div><button id="pr-new" class="savebtn" style="width:auto;padding:10px 18px" onclick="window._pr.formOpen=!window._pr.formOpen;show(&quot;purchases&quot;,true)">' + P.add + '</button></div>';
  if(s.formOpen){ var f = s.form;
    h += '<div class="card" id="pr-form" style="margin-bottom:12px;border:2px solid #f59e0b"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px">'
      + '<div class="field" style="margin:0;grid-column:span 2"><label>' + P.item + '</label><input id="pr-item" value="' + daEsc(f.item) + '" style="' + inp + '" oninput="window._pr.form.item=this.value"/></div>'
      + '<div class="field" style="margin:0"><label>' + P.qty + '</label><input id="pr-qty" type="number" step="any" min="0" value="' + daEsc(f.qty) + '" style="' + inp + '" oninput="window._pr.form.qty=this.value"/></div>'
      + '<div class="field" style="margin:0"><label>' + P.unit + '</label><input id="pr-unit" value="' + daEsc(f.unit) + '" list="pr-units" style="' + inp + '" oninput="window._pr.form.unit=this.value"/><datalist id="pr-units"><option>pcs</option><option>kg</option><option>m</option><option>L</option><option>bag</option><option>box</option></datalist></div>'
      + '<div class="field" style="margin:0"><label>' + P.urg + '</label><select id="pr-urg" style="' + inp + '" onchange="window._pr.form.urg=this.value">' + ['high', 'medium', 'low'].map(function(p){ return '<option value="' + p + '"' + (f.urg === p ? ' selected' : '') + '>' + T[p] + '</option>'; }).join('') + '</select></div>'
      + '<div class="field" style="margin:0"><label>' + P.site + '</label><select id="pr-site" style="' + inp + '" onchange="window._pr.form.site=this.value"><option value="">—</option>' + daFarms().map(function(x){ return '<option value="' + daEsc(x) + '"' + (f.site === x ? ' selected' : '') + '>' + daEsc(x) + (reg[x] && reg[x] !== x ? ' — ' + daEsc(reg[x]) : '') + '</option>'; }).join('') + '</select></div></div>'
      + '<div class="field" style="margin:10px 0 0"><label>' + P.reason + '</label><input id="pr-reason" value="' + daEsc(f.reason) + '" style="' + inp + '" oninput="window._pr.form.reason=this.value"/></div>'
      + (f.maint ? '<div style="font-size:12px;color:var(--muted);margin-top:6px">🔧 ' + P.link + ': ' + daEsc(f.maint) + '</div>' : '')
      + '<button id="pr-send" class="savebtn" style="width:auto;padding:12px 24px;margin-top:12px;font-size:16px;background:#d97706" onclick="daPrSubmit()">' + P.send + '</button></div>'; }
  h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">' + [['waiting', P.waiting + ' (' + L.filter(function(r){ return r.status === 'requested'; }).length + ')'], ['approved', P.approved], ['ordered', P.ordered], ['received', P.received], ['rejected', P.rejected], ['month', P.month], ['all', P.all]].map(function(t){
    return '<button class="pr-flt" data-f="' + t[0] + '" onclick="window._pr.filter=&quot;' + t[0] + '&quot;;show(&quot;purchases&quot;,true)" style="padding:6px 13px;border-radius:99px;border:1.5px solid var(--line);font:inherit;cursor:pointer;background:' + (s.filter === t[0] ? '#d97706;color:#fff' : '#fff') + '">' + t[1] + '</button>'; }).join('') + '</div>';
  var list = L.filter(flt), ap = daCanApprovePR(), sup = daIsSupervisor() || ap;
  h += list.length ? list.map(function(r){ var act = '';
      if(r.status === 'requested' && ap) act = '<button class="pr-ok" onclick="daPrSet(&quot;' + r.id + '&quot;,&quot;approved&quot;)" style="padding:8px 14px;border:0;border-radius:8px;background:var(--teal);color:#fff;font:inherit;font-weight:800;cursor:pointer">' + P.approve + '</button><button class="pr-no" onclick="daPrSet(&quot;' + r.id + '&quot;,&quot;rejected&quot;)" style="padding:8px 14px;border:2px solid #ef4444;border-radius:8px;background:#fff;color:#b91c1c;font:inherit;font-weight:800;cursor:pointer">' + P.reject + '</button>';
      else if(r.status === 'approved' && sup) act = '<button class="pr-ord" onclick="daPrSet(&quot;' + r.id + '&quot;,&quot;ordered&quot;)" style="padding:8px 14px;border:0;border-radius:8px;background:#7c3aed;color:#fff;font:inherit;font-weight:800;cursor:pointer">' + P.order + '</button>';
      else if(r.status === 'ordered' && (sup || daCanFix())) act = '<button class="pr-rcv" onclick="daPrSet(&quot;' + r.id + '&quot;,&quot;received&quot;)" style="padding:8px 14px;border:0;border-radius:8px;background:#16a34a;color:#fff;font:inherit;font-weight:800;cursor:pointer">' + P.receive + '</button>';
      return '<div class="card pr-item" data-id="' + daEsc(r.id) + '" style="margin-bottom:8px;border-inline-start:6px solid ' + (r.urg === 'high' && r.status === 'requested' ? '#ef4444' : '#f59e0b') + '"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><b style="font-size:15px">' + daEsc(r.item) + ' — ' + daEsc(String(r.qty)) + ' ' + daEsc(r.unitName || '') + '</b><span style="display:flex;gap:5px">' + (r.urg === 'high' ? daMtChip('🔴 ' + T.high, '#fee2e2', '#991b1b') : '') + daPrChip(r.status, P) + '</span></div>'
        + '<div style="font-size:12px;color:var(--muted);margin-top:4px">' + daEsc(r.ref || '') + (r.farm ? ' · ' + daEsc(r.farm) : '') + ' · ' + T.by + ' ' + daEsc(r.byName || '') + ' · ' + daEsc(r.date || '') + (r.maint ? ' · 🔧 ' + daEsc(r.maint) : '') + (r.decidedByName ? ' · ' + daEsc(r.decidedByName) : '') + '</div>'
        + (r.reason ? '<div style="font-size:13px;margin-top:4px">' + daEsc(r.reason) + '</div>' : '') + (r.rejectReason ? '<div style="font-size:13px;margin-top:4px;color:#991b1b">✖ ' + daEsc(r.rejectReason) + '</div>' : '')
        + (act ? '<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">' + act + '</div>' : '') + '</div>'; }).join('')
    : '<div class="card" style="text-align:center;color:var(--muted);padding:24px">' + P.none + '</div>';
  return h;
}
function daPrSubmit(){
  var s = daPrState(), f = s.form, P = daPrT(); f.item = String(daVal('pr-item') || f.item || '').trim(); f.qty = daVal('pr-qty') || f.qty;
  if(!f.item || !(parseFloat(f.qty) > 0)){ toast(P.need); return; }
  var ref = 'PR-' + String(new Date().getFullYear()).slice(2) + '-' + String(Date.now()).slice(-5);
  addTX({id:'pr-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5), type:'purchase', unit:'', date:daToday(), ref:ref, item:f.item, qty:+parseFloat(f.qty), unitName:f.unit || '', reason:String(f.reason || '').trim(), urg:f.urg, farm:f.site || '', maint:f.maint || '',
    status:'requested', requesterUid:(typeof daPushUid === 'function' ? daPushUid() : ''), _skipValidation:true});
  if(f.maint) daMtLink(f.maint, ref);
  if(typeof daPushCall === 'function') daPushCall('/notify', {farm:f.site || '', audience:'supervisors'});
  s.form = null; s.formOpen = false; toast(P.sent); show('purchases', true);
}
function daMtLink(mref, pref){ var m = daMtState().list.filter(function(x){ return x.ref === mref; })[0]; if(!m) return; var a = (m.purchase_refs || []).concat([pref]);
  sbFetch('maintenance_requests?id=eq.' + encodeURIComponent(m.id), {method:'PATCH', body:JSON.stringify({purchase_refs:a})}).catch(function(){}); }
function daPrSet(id, status){
  var P = daPrT(), r = daPrAll().filter(function(x){ return x.id === id; })[0]; if(!r) return; var v = {status:status}, now = new Date().toISOString(), me = daMeName();
  if(status === 'rejected'){ var why = prompt(P.why, ''); if(why === null) return; v.rejectReason = why; }
  if(status === 'approved' || status === 'rejected'){ v.decidedByName = me; v.decidedAt = now; }
  if(status === 'ordered') v.orderedAt = now; if(status === 'received'){ v.receivedAt = now; v.receivedByName = me; }
  updateTX(id, v); _dataVer++;
  if(r.requesterUid && typeof daPushCall === 'function' && status !== 'ordered') daPushCall('/notify', {audience:'user', uid:r.requesterUid});
  toast('✅ ' + (P[status] || status)); show('purchases', true);
}
// ── 📰 today on the dashboard ──
function daTodayEvents(date){
  var ev = [], g = {}, reg = getFarmsRegistry(), farmOf = function(t){ var u = t.unit && daRawUnit(t.unit); return t.farm || (u && u.farm) || String(t.unit || '').split('.')[0]; };
  var hm = function(t){ var x = t.ts || t.doneAt || t.at || ''; var d = x ? new Date(x) : null; return d && !isNaN(d) ? ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) : ''; };
  var LBL = {feeding:['🌾', 'علف'], mortality:['💀', 'نفوق'], water_quality:['🧪', 'قياسات'], sampling:['🔬', 'عينات'], harvesting:['🎣', 'حصاد'], harvest:['🎣', 'حصاد'], transfer_out:['🔄', 'نقل'], routine:['📅', 'روتين']};
  getTX().forEach(function(t){ if(t.deleted || t.date !== date) return;
    if(LBL[t.type]){ var k = t.type + '|' + farmOf(t) + '|' + (t.byName || ''), x = g[k] = g[k] || {icon:LBL[t.type][0], what:LBL[t.type][1], farm:farmOf(t), who:t.byName || '', n:0, kg:0, dead:0, time:''}; x.n++; x.kg += +t.kg || 0; x.dead += parseInt(t.count) || 0; var tm = hm(t); if(tm > x.time) x.time = tm; return; }
    if(t.type === 'work_order') ev.push({time:hm(t), icon:'📋', text:(typeof daWoLabel === 'function' ? daWoLabel(t, DA_WO_T.ar) : 'أمر') + (t.text ? ' ' + t.text : ''), farm:t.farm, who:t.byName || '', st:t.status === 'done' ? '✅' : t.status === 'notdone' ? '✖' : ''});
    if(t.type === 'feed_day' && !t.full) ev.push({time:hm(t), icon:'⚠️', text:'العلف مكانش كامل — ' + (t.reason || ''), farm:t.farm, who:t.byName || ''}); });
  Object.keys(g).forEach(function(k){ var x = g[k]; ev.push({time:x.time, icon:x.icon, text:x.what + (x.what === 'علف' ? ' ' + x.n + ' تانك · ' + x.kg.toFixed(1) + ' كجم' : x.what === 'نفوق' ? ' ' + x.dead + ' سمكة' : x.what === 'روتين' ? ' ' + x.n + ' بند' : ' (' + x.n + ')'), farm:x.farm, who:x.who}); });
  daPrAll().forEach(function(r){ if(r.date === date) ev.push({time:hm(r), icon:'🛒', text:'طلب شرا: ' + r.item + ' — ' + r.qty + ' ' + (r.unitName || ''), farm:r.farm, who:r.byName || '', st:r.status === 'approved' ? '✔' : r.status === 'rejected' ? '✖' : ''});
    if(r.decidedAt && r.decidedAt.slice(0, 10) === date && r.date !== date) ev.push({time:hm({ts:r.decidedAt}), icon:'🛒', text:(r.status === 'rejected' ? 'اترفض: ' : 'اتعتمد: ') + r.item, farm:r.farm, who:r.decidedByName || ''});
    if(r.receivedAt && r.receivedAt.slice(0, 10) === date) ev.push({time:hm({ts:r.receivedAt}), icon:'📦', text:'اتستلم: ' + r.item, farm:r.farm, who:r.receivedByName || ''}); });
  daMtState().list.forEach(function(m){ if((m.created_at || '').slice(0, 10) === date) ev.push({time:hm({ts:m.created_at}), icon:m.priority === 'high' ? '🚨' : '🔧', text:'عطل: ' + (m.summary || ''), farm:m.site || m.area, who:m.requested_by || ''});
    if((m.closed_at || '').slice(0, 10) === date) ev.push({time:hm({ts:m.closed_at}), icon:'✅', text:'اتصلح: ' + (m.summary || ''), farm:m.site || m.area, who:m.technician || ''}); });
  return ev.sort(function(a, b){ return (b.time || '').localeCompare(a.time || ''); });
}
function daTodayCard(){
  var d = daToday(), ev = daTodayEvents(d), M = daMtState().list, P = daPrAll();
  var openM = M.filter(function(r){ return r.status !== 'closed'; }), urg = openM.filter(function(r){ return r.priority === 'high'; }), od = M.filter(daMtOverdue), wait = P.filter(function(r){ return r.status === 'requested'; });
  var sheets = typeof daFarms === 'function' ? daFarms().map(function(f){ var n = getTX().some(function(t){ return t.type === 'feeding' && !t.deleted && t.date === d && (t.farm === f || String(t.unit || '').indexOf(f + '.') === 0); }); return n; }) : [];
  var box = function(icon, n, label, bad, go){ return '<div onclick="show(&quot;' + go + '&quot;)" style="cursor:pointer;flex:1;min-width:110px;padding:10px;border-radius:12px;background:' + (bad ? '#fee2e2' : '#f0fdfa') + ';text-align:center"><div style="font-size:22px;font-weight:900">' + icon + ' ' + n + '</div><div style="font-size:12px;color:var(--muted)">' + label + '</div></div>'; };
  return '<div class="card" id="da-today" style="margin-bottom:14px"><div class="card-title">📰 النهارده في المزرعة</div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">' + box('🌾', sheets.filter(Boolean).length + '/' + sheets.length, 'شيتات العلف', sheets.length && sheets.filter(Boolean).length < sheets.length, 'entry-status')
    + box('🔧', openM.length, 'أعطال مفتوحة' + (urg.length ? ' · ' + urg.length + ' عاجل' : ''), urg.length || od.length, 'maint') + box('🛒', wait.length, 'طلبات شرا مستنية', wait.length, 'purchases') + '</div>'
    + (ev.length ? '<div style="max-height:340px;overflow:auto">' + ev.map(function(e){ return '<div style="display:flex;gap:10px;align-items:baseline;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:13px"><span style="min-width:42px;color:var(--muted)" dir="ltr">' + daEsc(e.time || '') + '</span><span>' + e.icon + '</span><span style="flex:1">' + (e.farm ? '<b>' + daEsc(e.farm) + '</b> · ' : '') + daEsc(e.text) + (e.st ? ' ' + e.st : '') + '</span><span style="color:var(--muted);font-size:12px">' + daEsc(e.who || '') + '</span></div>'; }).join('') + '</div>'
      : '<div style="text-align:center;color:var(--muted);padding:12px">لسه محدش سجّل حاجة النهارده</div>') + '</div>';
}
if(!window._daMtWrapped){
  window._daMtWrapped = true;
  var _permsPreMt = getPermsList;
  getPermsList = function(){ var L = _permsPreMt.apply(this, arguments); if(!L.some(function(p){ return p.id === 'fix_maint'; })) L.push({id:'fix_maint', icon:'🔧', label:'إصلاح الأعطال (فني صيانة)'}, {id:'approve_purchase', icon:'🛒', label:'اعتماد طلبات الشرا'}); return L; };
  VIEWS['maint'] = renderMaint; VIEWS['purchases'] = renderPurchases;
  var _cavPreMt = canAccessView;
  canAccessView = function(v){ if(v === 'maint' || v === 'purchases') return !!currentUser; return _cavPreMt.apply(this, arguments); };
  var g = DA_NAV.filter(function(x){ return x.id === 'home'; })[0];
  if(g){ if(!g.items.some(function(i){ return i[0] === 'maint'; })) g.items.push(['maint', '🔧', 'الصيانة', 'Maintenance']); if(!g.items.some(function(i){ return i[0] === 'purchases'; })) g.items.push(['purchases', '🛒', 'طلبات الشرا', 'Purchases']); }
  var _showPreMt = show;
  show = function(v){ var r = _showPreMt.apply(this, arguments);
    try{ if(currentView === 'dashboard' && !document.getElementById('da-today')){ var c = document.getElementById('content'), ph = c && c.querySelector('.ph'); if(ph){ var es = document.getElementById('es-strip'); (es || ph).insertAdjacentHTML('afterend', daTodayCard());
          if(!daMtState().at) daMtLoad().then(function(){ var o = document.getElementById('da-today'); if(o && currentView === 'dashboard'){ o.outerHTML = daTodayCard(); } }); } } }catch(e){}
    try{ var bar = document.getElementById('da-wbar'); if(bar && currentUserRole === 'worker' && !document.getElementById('wb-maint')){ var rf = bar.querySelector('#wo-bell') || bar.querySelector('.rf');
        if(rf) rf.insertAdjacentHTML('beforebegin', '<button id="wb-maint" data-v="maint" onclick="show(&quot;maint&quot;)" class="' + (currentView === 'maint' ? 'on' : '') + '">🔧</button>' + (daCanFix() ? '<button id="wb-pr" data-v="purchases" onclick="show(&quot;purchases&quot;)" class="' + (currentView === 'purchases' ? 'on' : '') + '">🛒</button>' : '')); } }catch(e){}
    return r; };
}
