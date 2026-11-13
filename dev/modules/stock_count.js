// ══════════════════════════════════════════════════════════
//  WEEKLY STOCK COUNT (owner, 2026-11-13) — feed and chemicals
// ══════════════════════════════════════════════════════════
// An add-on (🧩, off until the admin turns it on). The admin lists the items (feed sizes, calcium carbonate, sodium
// bicarbonate …) with a unit and a minimum, and the count day / time (default Thursday 14:00). Workers holding
// "stock_count" get a phone reminder that day (farm-push cron) and "📦 count of the week"; they type what is there and
// save (transactions record "stock_count", one per site and day). Those holding "manage_inventory" (and the admin) are
// notified. The balance tab shows the last count, weekly use (from the drop between counts), days left, and red when
// under the minimum or out within a week — with "🛒 order" filling a purchase request.
var DA_STOCK_KEY = 'daracqua_settings_v2_stock';   // synced: {day:0-6, time:'HH:MM', items:[{id,name,unit,cat,min}]}
var DA_SC_T = {
  ar:{head:'📦 جرد المخزن', count:'📦 الجرد', bal:'📊 الرصيد', items:'⚙️ الأصناف', site:'المكان', date:'اليوم', item:'الصنف', last:'آخر جرد', qty:'الموجود', save:'💾 حفظ الجرد', saved:'✅ اتسجل الجرد',
    none:'مفيش أصناف لسه — المدير يضيفها من ⚙️ الأصناف', due:'📦 النهارده يوم الجرد — سجّل الموجود في المخزن', done:'✅ جرد الأسبوع اتسجل', need:'⚠️ اكتب العدد لصنف واحد على الأقل', low:'قرب يخلص', ok:'كويس', use:'الاستهلاك/أسبوع', left:'يكفي', days:'يوم', order:'🛒 اطلب', feed:'علف', chem:'كيماويات', other:'تاني'},
  en:{head:'📦 Stock count', count:'📦 Count', bal:'📊 Balance', items:'⚙️ Items', site:'Site', date:'Day', item:'Item', last:'Last count', qty:'In stock', save:'💾 Save count', saved:'✅ Count saved',
    none:'No items yet — the manager adds them in ⚙️ Items', due:'📦 Today is count day — record what is in the store', done:'✅ This week\'s count is saved', need:'⚠️ Write the quantity of at least one item', low:'Running low', ok:'OK', use:'Use/week', left:'Lasts', days:'days', order:'🛒 Order', feed:'Feed', chem:'Chemicals', other:'Other'},
  ur:{head:'📦 اسٹاک گنتی', count:'📦 گنتی', bal:'📊 بیلنس', items:'⚙️ اشیاء', site:'جگہ', date:'دن', item:'چیز', last:'پچھلی گنتی', qty:'موجود', save:'💾 گنتی محفوظ کریں', saved:'✅ گنتی محفوظ ہو گئی',
    none:'ابھی کوئی چیز نہیں — مینیجر ⚙️ اشیاء میں ڈالے گا', due:'📦 آج گنتی کا دن ہے — اسٹور میں جو ہے لکھیں', done:'✅ اس ہفتے کی گنتی محفوظ ہے', need:'⚠️ کم از کم ایک چیز کی مقدار لکھیں', low:'ختم ہونے والا', ok:'ٹھیک', use:'خرچ/ہفتہ', left:'چلے گا', days:'دن', order:'🛒 منگوائیں', feed:'فیڈ', chem:'کیمیکل', other:'دیگر'}};
function daScT(){ var l = typeof daLangNow === 'function' ? daLangNow() : (isAr ? 'ar' : 'en'); return DA_SC_T[l] || DA_SC_T.ar; }
function daScCfg(){ var c = {}; try{ c = JSON.parse(localStorage.getItem(DA_STOCK_KEY) || '{}') || {}; }catch(e){}
  if(c.day === undefined) c.day = 4; if(!c.time) c.time = '14:00';
  if(!Array.isArray(c.items)){ var feeds = (typeof daAqxCfg === 'function' && (daAqxCfg().feeds || []).length) ? daAqxCfg().feeds : ['Maram 40% cp 1mm', 'Maram 36% cp 2mm', 'Maram 36% cp 3mm'];
    c.items = feeds.map(function(f, i){ return {id:'f' + i, name:f, unit:'كيس', cat:'feed', min:0}; }).concat([{id:'c1', name:'كربونات الكالسيوم CaCO₃', unit:'كيس', cat:'chem', min:0}, {id:'c2', name:'بيكربونات الصوديوم NaHCO₃', unit:'كيس', cat:'chem', min:0}]); }
  return c; }
function daScCanCount(){ return typeof daHas === 'function' ? (daHas('stock_count') || daHas('manage_inventory')) : true; }
function daScCanManage(){ return typeof daHas === 'function' ? daHas('manage_inventory') : currentUserRole === 'admin'; }
function daScAll(){ return getTX().filter(function(t){ return t.type === 'stock_count' && !t.deleted; }).sort(function(a, b){ return (a.date || '').localeCompare(b.date || ''); }); }
function daScSites(){ var uf = typeof daUserFarms === 'function' ? daUserFarms() : null; return uf && uf.length ? uf : daFarms(); }
function daScWeekStart(d){ var dt = new Date(d + 'T12:00:00'), back = (dt.getDay() - (daScCfg().day + 1) + 7) % 7; return daAddDays(d, -back); }   // the week ends on count day
function daScDue(){ var c = daScCfg(), d = daToday(), wd = new Date(d + 'T12:00:00').getDay(); if(wd !== c.day || !daScCanCount()) return false;
  var ws = daScWeekStart(d); return !daScAll().some(function(t){ return t.date >= ws && daScSites().indexOf(t.farm) >= 0; }); }
function daScBalance(site){   // per item: last count, weekly use (from the drop between the last two counts), days left
  var L = daScAll().filter(function(t){ return !site || t.farm === site; }), out = {};
  daScCfg().items.forEach(function(it){ var pts = L.filter(function(t){ return t.items && t.items[it.id] !== undefined && t.items[it.id] !== ''; }).map(function(t){ return {date:t.date, q:+t.items[it.id]}; });
    var last = pts[pts.length - 1] || null, prev = pts[pts.length - 2] || null, use = null;
    if(last && prev){ var days = Math.max(1, (new Date(last.date) - new Date(prev.date)) / 864e5), drop = prev.q - last.q; if(drop > 0) use = drop / days * 7; }
    var left = last && use ? last.q / (use / 7) : null, low = !!last && ((it.min > 0 && last.q <= it.min) || (left !== null && left <= 7));
    out[it.id] = {item:it, last:last, use:use, left:left, low:low}; });
  return out;
}
function renderStock(){
  var st = window._sc = window._sc || {}, T = daScT(), c = daScCfg(), sites = daScSites(); if(!st.tab) st.tab = 'count'; if(!st.site || sites.indexOf(st.site) < 0) st.site = sites[0] || ''; if(!st.date) st.date = daToday(); st.q = st.q || {};
  var inp = 'padding:9px 10px;border:1.5px solid var(--line);border-radius:8px;font:inherit;font-size:15px', tb = function(k, t){ return '<button class="sc-tab" data-t="' + k + '" onclick="window._sc.tab=&quot;' + k + '&quot;;show(&quot;stock&quot;,true)" style="padding:9px 16px;border-radius:10px;border:2px solid ' + (st.tab === k ? 'var(--teal)' : 'var(--line)') + ';font:inherit;font-weight:800;cursor:pointer;background:' + (st.tab === k ? 'var(--teal);color:#fff' : '#fff') + '">' + t + '</button>'; };
  var h = '<div class="ph"><div><h2>' + T.head + '</h2></div></div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">' + tb('count', T.count) + (daScCanManage() ? tb('bal', T.bal) + tb('items', T.items) : '') + '</div>';
  if(st.tab === 'items' && daScCanManage()) return h + daScItemsHtml(c, inp);
  if(st.tab === 'bal' && daScCanManage()) return h + daScBalHtml(T, sites);
  if(!c.items.length) return h + '<div class="card" style="text-align:center;padding:24px;color:var(--muted)">' + T.none + '</div>';
  var B = daScBalance(st.site), rec = daScAll().filter(function(t){ return t.farm === st.site && t.date === st.date; })[0];
  if(rec && !st.loaded){ st.loaded = st.site + st.date; Object.keys(rec.items || {}).forEach(function(k){ if(st.q[k] === undefined) st.q[k] = rec.items[k]; }); }
  if(daScDue()) h += '<div class="card" style="margin-bottom:12px;background:#fef9c3;border:2px solid #eab308;font-weight:800">' + T.due + '</div>';
  h += '<div class="card"><div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px"><div class="field" style="margin:0"><label>' + T.site + '</label><select id="sc-site" style="' + inp + '" onchange="window._sc.site=this.value;window._sc.q={};window._sc.loaded=null;show(&quot;stock&quot;,true)">' + sites.map(function(x){ return '<option value="' + daEsc(x) + '"' + (st.site === x ? ' selected' : '') + '>' + daEsc(x) + '</option>'; }).join('') + '</select></div>'
    + '<div class="field" style="margin:0"><label>' + T.date + '</label><input type="date" id="sc-date" data-nodirty="1" value="' + st.date + '" max="' + daToday() + '" style="' + inp + '" onchange="window._sc.date=this.value;window._sc.q={};window._sc.loaded=null;show(&quot;stock&quot;,true)"/></div></div>'
    + '<table style="border-collapse:collapse;width:100%;font-size:15px"><tr style="background:#f1f5f9"><th style="padding:8px;text-align:start">' + T.item + '</th><th style="padding:8px">' + T.last + '</th><th style="padding:8px">' + T.qty + '</th></tr>'
    + c.items.map(function(it){ var b = B[it.id] || {}; return '<tr style="border-bottom:1px solid #f1f5f9"><td style="padding:8px"><b>' + daEsc(it.name) + '</b><div style="font-size:11px;color:var(--muted)">' + (T[it.cat] || '') + (b.low ? ' · <span style="color:#b91c1c;font-weight:800">⚠️ ' + T.low + '</span>' : '') + '</div></td>'
      + '<td style="padding:8px;text-align:center;color:var(--muted);font-size:13px">' + (b.last ? b.last.q + ' ' + daEsc(it.unit) + '<div style="font-size:11px">' + daEsc(b.last.date) + '</div>' : '—') + '</td>'
      + '<td style="padding:8px;text-align:center;white-space:nowrap"><input class="sc-q" data-id="' + daEsc(it.id) + '" type="number" inputmode="decimal" step="any" min="0" value="' + daEsc(st.q[it.id] !== undefined ? String(st.q[it.id]) : '') + '" style="' + inp + ';width:90px;text-align:center" oninput="window._sc.q[this.dataset.id]=this.value"/> <span style="font-size:13px;color:var(--muted)">' + daEsc(it.unit) + '</span></td></tr>'; }).join('')
    + '</table><button id="sc-save" class="savebtn" style="width:auto;padding:12px 26px;margin-top:12px;font-size:16px" onclick="daScSave()">' + T.save + '</button></div>';
  return h;
}
function daScSave(){
  var st = window._sc, T = daScT(), items = {}; Object.keys(st.q || {}).forEach(function(k){ var v = String(st.q[k]).trim(); if(v !== '' && parseFloat(v) >= 0) items[k] = +parseFloat(v); });
  if(!Object.keys(items).length){ toast(T.need); return; }
  var id = 'sc-' + st.site + '-' + st.date, rec = daScAll().filter(function(t){ return t.id === id; })[0];
  if(rec) updateTX(id, {items:items}); else addTX({id:id, type:'stock_count', unit:'', farm:st.site, date:st.date, items:items, status:'ok', _skipValidation:true});
  _dataVer++; var low = Object.keys(daScBalance(st.site)).filter(function(k){ return daScBalance(st.site)[k].low; }).length;
  if(typeof daPushCall === 'function') daPushCall('/notify', {farm:st.site, audience:'perm', perm:'manage_inventory'});
  toast(T.saved + (low ? ' · ⚠️ ' + low + ' ' + T.low : '')); st.loaded = null; show('stock', true);
}
function daScBalHtml(T, sites){
  var canBuy = typeof daFeat === 'function' && daFeat('purchases') && typeof daCanRequestPR === 'function' && daCanRequestPR();
  return sites.map(function(site){ var B = daScBalance(site), ks = Object.keys(B); if(!ks.some(function(k){ return B[k].last; })) return '';
    return '<div class="card sc-bal" data-site="' + daEsc(site) + '" style="margin-bottom:12px"><div class="card-title">' + daEsc(site) + '</div><table style="border-collapse:collapse;width:100%;font-size:14px"><tr style="background:#f1f5f9"><th style="padding:6px;text-align:start">' + T.item + '</th><th>' + T.qty + '</th><th>' + T.use + '</th><th>' + T.left + '</th><th></th></tr>'
      + ks.map(function(k){ var b = B[k], it = b.item; if(!b.last) return '';
        return '<tr style="background:' + (b.low ? '#fee2e2' : '') + '"><td style="padding:6px"><b>' + daEsc(it.name) + '</b>' + (it.min ? '<div style="font-size:11px;color:var(--muted)">min ' + it.min + '</div>' : '') + '</td><td style="text-align:center">' + b.last.q + ' ' + daEsc(it.unit) + '<div style="font-size:11px;color:var(--muted)">' + daEsc(b.last.date) + '</div></td>'
          + '<td style="text-align:center">' + (b.use !== null ? b.use.toFixed(1) + ' ' + daEsc(it.unit) : '—') + '</td><td style="text-align:center;font-weight:800;color:' + (b.low ? '#b91c1c' : 'var(--green)') + '">' + (b.left !== null ? Math.floor(b.left) + ' ' + T.days : (b.low ? '⚠️' : '—')) + '</td>'
          + '<td>' + (b.low && canBuy ? '<button class="sc-order" onclick="daScOrder(&quot;' + daEsc(site) + '&quot;,&quot;' + daEsc(k) + '&quot;)" style="padding:6px 12px;border:2px solid #f59e0b;background:#fff;color:#b45309;border-radius:8px;font:inherit;font-weight:800;cursor:pointer">' + T.order + '</button>' : '') + '</td></tr>'; }).join('') + '</table></div>'; }).join('') || '<div class="card" style="text-align:center;padding:24px;color:var(--muted)">—</div>';
}
function daScOrder(site, id){   // a purchase request for an item running low: enough for about two weeks (or twice the minimum)
  var b = daScBalance(site)[id]; if(!b) return; var it = b.item, need = Math.max(it.min ? it.min * 2 - b.last.q : 0, b.use ? b.use * 2 - b.last.q : 0, 1);
  var s = daPrState(); s.form = {item:it.name, qty:String(Math.ceil(need)), unit:it.unit, reason:'المخزون قرب يخلص — جرد ' + b.last.date + ': ' + b.last.q + ' ' + it.unit + (b.left !== null ? ' (يكفي ~' + Math.floor(b.left) + ' يوم)' : ''), urg:b.left !== null && b.left <= 3 ? 'high' : 'medium', site:site, maint:''}; s.formOpen = true; show('purchases');
}
function daScItemsHtml(c, inp){
  var E = window._scEdit = window._scEdit || JSON.parse(JSON.stringify(c)), dn = ['الأحد', 'الاتنين', 'التلات', 'الأربع', 'الخميس', 'الجمعة', 'السبت'];
  return '<div class="card"><div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px"><div class="field" style="margin:0"><label>يوم الجرد</label><select id="sc-day" style="' + inp + '" onchange="window._scEdit.day=+this.value">' + dn.map(function(n, i){ return '<option value="' + i + '"' + (E.day === i ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></div>'
    + '<div class="field" style="margin:0"><label>الساعة (للتذكير)</label><input type="time" id="sc-time" value="' + daEsc(E.time) + '" style="' + inp + '" oninput="window._scEdit.time=this.value"/></div></div>'
    + '<table id="sc-items" style="border-collapse:collapse;width:100%;font-size:14px"><tr style="background:#f1f5f9"><th style="padding:6px;text-align:start">الصنف</th><th>النوع</th><th>الوحدة</th><th>الحد الأدنى</th><th></th></tr>'
    + E.items.map(function(it, i){ return '<tr><td style="padding:4px"><input class="sc-name" value="' + daEsc(it.name) + '" style="' + inp + ';width:100%" oninput="window._scEdit.items[' + i + '].name=this.value"/></td>'
      + '<td style="padding:4px"><select style="' + inp + '" onchange="window._scEdit.items[' + i + '].cat=this.value">' + [['feed', 'علف'], ['chem', 'كيماويات'], ['other', 'تاني']].map(function(o){ return '<option value="' + o[0] + '"' + (it.cat === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></td>'
      + '<td style="padding:4px"><input value="' + daEsc(it.unit) + '" list="sc-units" style="' + inp + ';width:80px" oninput="window._scEdit.items[' + i + '].unit=this.value"/></td>'
      + '<td style="padding:4px"><input class="sc-min" type="number" step="any" min="0" value="' + (it.min || '') + '" style="' + inp + ';width:80px" oninput="window._scEdit.items[' + i + '].min=+this.value||0"/></td>'
      + '<td style="padding:4px"><button onclick="window._scEdit.items.splice(' + i + ',1);show(&quot;stock&quot;,true)" style="border:1px solid var(--line);background:#fff;border-radius:7px;cursor:pointer;padding:4px 8px">🗑</button></td></tr>'; }).join('')
    + '</table><datalist id="sc-units"><option>كيس</option><option>كجم</option><option>جركن</option><option>لتر</option><option>علبة</option></datalist>'
    + '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button id="sc-add" onclick="window._scEdit.items.push({id:&quot;i&quot;+Date.now(),name:&quot;&quot;,unit:&quot;كيس&quot;,cat:&quot;chem&quot;,min:0});show(&quot;stock&quot;,true)" style="' + inp + ';background:#fff;cursor:pointer">➕ صنف</button>'
    + '<button id="sc-cfg-save" class="savebtn" style="width:auto;padding:9px 20px" onclick="daScCfgSave()">💾 حفظ</button></div>'
    + '<div style="font-size:12px;color:var(--muted);margin-top:8px">الحد الأدنى: لو الموجود وصله أو أقل، الصنف يبان أحمر "قرب يخلص". وكمان أي صنف هيخلص خلال أسبوع حسب استهلاكه.</div></div>';
}
function daScCfgSave(){ var E = window._scEdit; E.items = E.items.filter(function(it){ return String(it.name || '').trim(); }); localStorage.setItem(DA_STOCK_KEY, JSON.stringify(E)); window._scEdit = null; toast('✅ اتحفظت الأصناف ويوم الجرد'); show('stock', true); }
if(!window._daScWrapped){
  window._daScWrapped = true;
  VIEWS['stock'] = renderStock;
  var _permsPreSc = getPermsList;
  getPermsList = function(){ var L = _permsPreSc.apply(this, arguments); if(!L.some(function(p){ return p.id === 'stock_count'; })) L.push({id:'stock_count', icon:'📦', label:'يسجل جرد المخزن'}); return L; };
  var _cavPreSc = canAccessView;
  canAccessView = function(v){ if(v === 'stock') return !!currentUser && typeof daFeat === 'function' && daFeat('stock') && (daScCanCount() || daScCanManage()); return _cavPreSc.apply(this, arguments); };
  var gSc = DA_NAV.filter(function(x){ return x.id === 'home'; })[0]; if(gSc && !gSc.items.some(function(i){ return i[0] === 'stock'; })) gSc.items.push(['stock', '📦', 'جرد المخزن', 'Stock count']);
  if(typeof daFeatCard === 'function'){ var _fcPreSc = daFeatCard; daFeatCard = function(){ var h = _fcPreSc.apply(this, arguments), on = daFeat('stock');
    var row = '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #f1f5f9"><div><b style="font-size:15px">📦 جرد المخزن</b><div style="font-size:12px;color:var(--muted)">جرد أسبوعي للعلف والكيماويات — بيظهر للي معاهم "يسجل جرد المخزن" أو "مخزون العلف"</div></div>'
      + '<button id="feat-stock" onclick="daFeatSet(&quot;stock&quot;,' + (!on) + ');toast(&quot;' + (on ? '⏸ اتقفلت' : '✅ اتفعلت') + ' — جرد المخزن&quot;);show(&quot;settings&quot;,true)" style="min-width:90px;padding:9px 16px;border-radius:99px;border:2px solid ' + (on ? 'var(--teal)' : 'var(--line)') + ';background:' + (on ? 'var(--teal);color:#fff' : '#fff;color:var(--muted)') + ';font:inherit;font-weight:800;cursor:pointer">' + (on ? '✅ شغّالة' : '⏸ مقفولة') + '</button></div>';
    return h.replace('<div style="font-size:12px;color:var(--muted);margin-top:8px">الصلاحيات', row + '<div style="font-size:12px;color:var(--muted);margin-top:8px">الصلاحيات'); }; }
  if(typeof daWoPending === 'function'){ var _pendPreSc = daWoPending; daWoPending = function(){ var n = _pendPreSc.apply(this, arguments); try{ if(daFeat('stock') && daScDue()) n++; }catch(e){} return n; }; }
  if(typeof renderWoMine === 'function'){ var _womPreSc = renderWoMine; renderWoMine = function(){ var h = _womPreSc.apply(this, arguments); try{ if(daFeat('stock') && daScDue()) h = h.replace('</h2></div></div>', '</h2></div></div><div class="card" id="sc-due" onclick="show(&quot;stock&quot;)" style="cursor:pointer;margin-bottom:12px;background:#fef9c3;border:2px solid #eab308;font-weight:800;font-size:16px">' + daScT().due + ' ←</div>'); }catch(e){} return h; }; VIEWS['wo-mine'] = renderWoMine; }
  if(typeof daTodayEvents === 'function'){ var _tePreSc = daTodayEvents; daTodayEvents = function(date){ var ev = _tePreSc.apply(this, arguments); try{ if(daFeat('stock')) daScAll().forEach(function(t){ if(t.date !== date) return; var B = daScBalance(t.farm), low = Object.keys(B).filter(function(k){ return B[k].low; }).map(function(k){ return B[k].item.name; });
      ev.push({time:'', icon:'📦', text:'جرد المخزن' + (low.length ? ' — ⚠️ قرب يخلص: ' + low.join('، ') : ''), farm:t.farm, who:t.byName || ''}); }); }catch(e){} return ev; }; }
  var _showPreSc = show;
  show = function(v){ var r = _showPreSc.apply(this, arguments);
    try{ var bar = document.getElementById('da-wbar'); if(bar && currentUserRole === 'worker'){ var o = document.getElementById('wb-stock'); if(o) o.remove(); if(canAccessView('stock')){ var rf = bar.querySelector('#wo-bell') || bar.querySelector('.rf'); if(rf) rf.insertAdjacentHTML('beforebegin', '<button id="wb-stock" data-v="stock" onclick="show(&quot;stock&quot;)" class="' + (currentView === 'stock' ? 'on' : '') + '">📦</button>'); } } }catch(e){}
    return r; };
}
