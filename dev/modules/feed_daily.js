// ══════════════════════════════════════════════════════════
//  THE DAILY RATION + "WAS ALL THE FEED GIVEN?" (owner, 2026-11-12)
// ══════════════════════════════════════════════════════════
// The feed sheet asks first: all the feed given today? "✅ Full" fills every tank with its daily ration (kg — or grams
// in a grams table; split evenly over the meals when the sheet is per meal); "⚠️ Less" leaves the amounts to the worker
// and asks why — the sheet is not saved without a reason. A tank's daily ration is the newest of: a "🌾 new feed sheet"
// work order, or "📌 pin these amounts as the daily ration" in the sheet (supervisors; synced). Tanks marked X (not fed)
// are left alone. The answer is kept per site and day ("feed_day" record) and shown on the entry status board.
var DA_FRATION_KEY = 'daracqua_plan_v1_fration';   // synced: {unit: {kg, from}}
var DA_FD_T = {
  ar:{q:'خلصتوا العلف كله النهارده؟', full:'✅ كامل — املا الكميات', less:'⚠️ أقل من المطلوب', why:'السبب (ليه أقل؟)', need:'⚠️ اكتب سبب إن العلف أقل الأول', filled:'✅ اتملى العلف اليومي — راجع واحفظ', none:'مفيش علف يومي متحدد لـ', ph:'مثلاً: السمك مكانش بياكل / الأكسجين واطي', pin:'📌 ثبّت الكميات دي كعلف يومي'},
  en:{q:'Was all the feed given today?', full:'✅ Full — fill the amounts', less:'⚠️ Less than planned', why:'Reason (why less?)', need:'⚠️ Write why the feed was less first', filled:'✅ Daily ration filled — check and save', none:'No daily ration set for', ph:'e.g. fish not eating / low oxygen', pin:'📌 Pin these amounts as the daily ration'},
  ur:{q:'کیا آج پوری فیڈ دے دی؟', full:'✅ پوری — مقدار بھریں', less:'⚠️ مقررہ سے کم', why:'وجہ (کم کیوں؟)', need:'⚠️ پہلے کم فیڈ کی وجہ لکھیں', filled:'✅ روزانہ فیڈ بھر دی — چیک کر کے محفوظ کریں', none:'روزانہ فیڈ مقرر نہیں:', ph:'مثلاً: مچھلی نہیں کھا رہی / آکسیجن کم', pin:'📌 یہ مقدار روزانہ فیڈ مقرر کریں'}};
function daFdT(){ var l = typeof daLangNow === 'function' ? daLangNow() : (isAr ? 'ar' : 'en'); return DA_FD_T[l] || DA_FD_T.ar; }
function daFration(){ try{ return JSON.parse(localStorage.getItem(DA_FRATION_KEY) || '{}') || {}; }catch(e){ return {}; } }
function daFsRation(unit, date){   // the newest daily ration on or before the day: a pinned one or a "new feed sheet" order
  var best = null, p = daFration()[unit]; if(p && p.from <= date && p.kg > 0) best = {kg:+p.kg, from:p.from, by:'pin'};
  if(typeof daWoAll === 'function') daWoAll().forEach(function(o){ if(o.kind !== 'feed' || o.status === 'notdone' || o.date > date || (o.tanks || []).indexOf(unit) < 0) return;
    var kg = (o.kgs || {})[unit] !== undefined ? +o.kgs[unit] : +o.kg; if(kg >= 0 && (!best || o.date >= best.from)) best = {kg:kg, from:o.date, by:'order'}; });
  return best;
}
function daFdRec(farm, date){ return getTX().filter(function(t){ return t.type === 'feed_day' && !t.deleted && t.farm === farm && t.date === date; })[0] || null; }
function daFdFill(){
  var st = window._fs; if(!st || !st.rows) return; var T = daFdT(), miss = [], n = 0;
  st.rows.forEach(function(r){ if(r.i === undefined || !(r.fish > 0)) return; var meals = (r.meals || []).length || 1, first = document.getElementById('fs-' + r.i + '-m0'); if(!first || first.disabled) return;
    var cur = []; for(var k = 0; k < meals; k++){ var e = document.getElementById('fs-' + r.i + '-m' + k); if(e) cur.push(String(e.value).trim()); }
    if(cur.some(function(v){ return /^[xX×✕]$/.test(v); })) return;   // not fed today (X / an order): leave it
    var R = daFsRation(r.unit, st.date); if(!R){ miss.push(r.no ? r.no.label : r.unit); return; }
    var each = R.kg / meals, g = r.gunit === 'g';
    for(var j = 0; j < meals; j++){ var el = document.getElementById('fs-' + r.i + '-m' + j); if(!el) continue;
      el.value = g ? String(Math.round(each * 1000)) : String(+each.toFixed(3)); el.dispatchEvent(new Event('input', {bubbles:true})); }
    n++; });
  toast(T.filled + (miss.length ? ' · ' + T.none + ' ' + miss.slice(0, 8).join('، ') + (miss.length > 8 ? '…' : '') : ''));
  return {filled:n, missing:miss};
}
function daFdChoose(mode){ var st = window._fs; if(!st) return; st.fdMode = mode; if(mode === 'full'){ st.fdReason = ''; daFdFill(); } daFdCard(); }
function daFdCard(){
  var st = window._fs, box = document.getElementById('fs-copybox'); if(!st || !box) return; var T = daFdT(), old = document.getElementById('fd-card'); if(old) old.remove();
  var rec = daFdRec(st.farm, st.date); if(!st.fdMode && rec) st.fdMode = rec.full ? 'full' : 'less'; if(st.fdReason === undefined && rec) st.fdReason = rec.reason || '';
  var on = function(m){ return st.fdMode === m; }, btn = 'flex:1;min-width:150px;padding:12px;border-radius:12px;font:inherit;font-weight:800;font-size:15px;cursor:pointer;';
  box.insertAdjacentHTML('beforebegin', '<div class="card" id="fd-card" style="margin-bottom:12px;border:2px solid ' + (on('less') ? '#f59e0b' : 'var(--teal)') + '"><div class="card-title">' + T.q + '</div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap"><button id="fd-full" onclick="daFdChoose(&quot;full&quot;)" style="' + btn + 'border:2px solid var(--teal);background:' + (on('full') ? 'var(--teal);color:#fff' : '#fff;color:var(--teal)') + '">' + T.full + '</button>'
    + '<button id="fd-less" onclick="daFdChoose(&quot;less&quot;)" style="' + btn + 'border:2px solid #f59e0b;background:' + (on('less') ? '#f59e0b;color:#fff' : '#fff;color:#b45309') + '">' + T.less + '</button></div>'
    + (on('less') ? '<div class="field" style="margin:10px 0 0"><label>' + T.why + ' *</label><input id="fd-reason" data-nodirty="1" value="' + daEsc(st.fdReason || '') + '" placeholder="' + T.ph + '" oninput="window._fs.fdReason=this.value" style="padding:10px;border:2px solid #f59e0b;border-radius:10px;font:inherit;font-size:15px;width:100%"/></div>' : '') + '</div>');
}
function daFdPin(){   // supervisors: the amounts now in the sheet become each tank's daily ration from the sheet's day
  var st = window._fs; if(!st || !st.rows) return; var P = daFration(), n = 0;
  st.rows.forEach(function(r){ if(r.i === undefined) return; var x = daFsRead(r); if(x.mealLocked || x.bad || x.anyX || !(x.kg > 0)) return; P[r.unit] = {kg:+x.kg.toFixed(3), from:st.date}; n++; });
  if(!n){ toast('⚠️ اكتب الكميات في الشيت الأول'); return; }
  if(!confirm('تثبيت العلف اليومي لـ ' + n + ' تانك من ' + st.date + '؟\nالعمال لما يختاروا "✅ كامل" الشيت هيتملى بالكميات دي.')) return;
  localStorage.setItem(DA_FRATION_KEY, JSON.stringify(P)); toast('📌 اتثبت العلف اليومي لـ ' + n + ' تانك — هيوصل لكل الموبايلات');
}
function daFdSaveDay(){ var st = window._fs; if(!st || !st.fdMode) return; var rec = daFdRec(st.farm, st.date), v = {full:st.fdMode === 'full', reason:st.fdMode === 'less' ? String(st.fdReason || '').trim() : ''};
  if(rec){ if(rec.full !== v.full || (rec.reason || '') !== v.reason) updateTX(rec.id, v); }
  else addTX(Object.assign({id:'fd-' + st.farm + '-' + st.date, type:'feed_day', unit:'', farm:st.farm, date:st.date, status:'ok', _skipValidation:true}, v)); }
function daFdStatusHtml(date){
  var L = getTX().filter(function(t){ return t.type === 'feed_day' && !t.deleted && t.date === date && !t.full; }); if(!L.length) return '';
  return '<div class="card" id="es-fd" style="margin-bottom:12px;border-inline-start:6px solid #f59e0b"><div class="card-title">🌾 العلف مكانش كامل</div>'
    + L.map(function(t){ return '<div style="padding:3px 0;font-size:13px"><b>' + daEsc(t.farm) + '</b> — ' + daEsc(t.reason || 'من غير سبب') + (t.byName ? ' · ' + daEsc(t.byName) : '') + '</div>'; }).join('') + '</div>';
}
if(!window._daFdWrapped){
  window._daFdWrapped = true;
  var _showPreFd = show;
  show = function(v){ var r = _showPreFd.apply(this, arguments);
    try{ if(currentView === 'feed-sheet'){ var st = window._fs; if(st && (st._fdKey !== st.farm + '|' + st.date)){ st._fdKey = st.farm + '|' + st.date; st.fdMode = null; st.fdReason = undefined; } daFdCard();
      if(typeof daFsCanPin === 'function' && daFsCanPin() && !document.getElementById('fd-pin')){ var pin = document.getElementById('fs-pin') || document.getElementById('fs-save');
        if(pin) pin.insertAdjacentHTML('afterend', '<button id="fd-pin" onclick="daFdPin()" style="padding:9px 14px;border:2px solid #f59e0b;background:#fff;color:#b45309;border-radius:10px;font:inherit;font-weight:800;cursor:pointer;margin-inline-start:6px">' + daFdT().pin + '</button>'); } } }catch(e){}
    try{ if(currentView === 'entry-status' && !document.getElementById('es-fd')){ var c = document.getElementById('content'), ph = c && c.querySelector('.ph'), html = daFdStatusHtml((window._es || {}).date || daToday()); if(ph && html) ph.insertAdjacentHTML('afterend', html); } }catch(e){}
    return r; };
  var _fsSavePreFd = daFsSave;
  daFsSave = function(){ var st = window._fs, T = daFdT();
    if(st && st.fdMode === 'less' && !String(st.fdReason || '').trim()){ toast(T.need); var e = document.getElementById('fd-reason'); if(e) e.focus(); return; }
    var r = _fsSavePreFd.apply(this, arguments); try{ daFdSaveDay(); }catch(e){} return r; };
}
