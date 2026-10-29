// ══════════════════════════════════════════════════════════
//  FEEDING FROM ONE SCREEN ONLY — the daily feed sheet
// ══════════════════════════════════════════════════════════
// Owner decision (2026-10-29): feeding entered from several screens caused double counting. The other entry screens
// are retired (menu entries removed; opening one shows a pointer to the sheet), the daily sheet loses its feed tab, and
// addTX refuses feeding that does not come from the sheet or an Excel import. Records made earlier on other screens
// stay valid; the sheet can take them over ("انقلها للشيت"). window.DA_SINGLE_FEED = false re-enables the old screens
// (tests of their legacy code only).
var DA_FEED_RETIRED = {'quick-feed':'التغذية السريعة', 'tx-feeding':'شاشة التغذية', 'feed-week':'تغذية الأسبوع', 'photo-entry':'الإدخال بالصورة'};
function daSingleFeed(){ return window.DA_SINGLE_FEED !== false; }
function renderFeedRetired(v){
  return '<div class="ph"><div><h2>📋 تسجيل العلف بقى من مكان واحد</h2></div></div>'
    + '<div class="card" style="max-width:640px;line-height:1.9;font-size:14px"><p><b>' + daEsc(DA_FEED_RETIRED[v] || v) + '</b> اتقفلت عشان العلف ميتسجلش مرتين من شاشتين مختلفتين.</p>'
    + '<p>كل العلف بيتسجل دلوقتي من <b>شيت العلف اليومي</b> — نفس الشيت الورق، بالوجبات والحجم والنافق.' + (v === 'feed-week' ? ' لتسجيل أيام فاتت، اختار التاريخ فوق الشيت.' : '') + '</p>'
    + '<p style="font-size:12px;color:var(--muted)">السجلات القديمة اللي اتسجلت من هنا موجودة وسليمة، وتقدر تنقلها للشيت من التحذير الأصفر في نفس اليوم.</p>'
    + '<button class="savebtn" style="width:auto;padding:10px 22px" onclick="show(&quot;feed-sheet&quot;)">📋 افتح شيت العلف اليومي</button></div>';
}
function daFeedEntryAllowed(t){ return !daSingleFeed() || !t || t.type !== 'feeding' || t.source === 'sheet' || t.source === 'import' || t._skipValidation; }

// ── registration ──
if(!window._daFeedSingleWrapped){
  window._daFeedSingleWrapped = true;
  window._daFeedOrigViews = {};
  Object.keys(DA_FEED_RETIRED).forEach(function(v){
    var orig = VIEWS[v]; window._daFeedOrigViews[v] = orig;
    VIEWS[v] = function(){ return daSingleFeed() || !orig ? renderFeedRetired(v) : orig.apply(this, arguments); };
  });
  var _dailyPreSingle = VIEWS.daily;
  if(_dailyPreSingle) VIEWS.daily = renderDaily = function(){
    if(!daSingleFeed()) return _dailyPreSingle.apply(this, arguments);
    if(sheetTab === 'feed') sheetTab = 'mortality';
    var h = _dailyPreSingle.apply(this, arguments);
    return h.replace(/<button[^>]*sheetTab=\\?'feed\\?'[^>]*>[\s\S]*?<\/button>/, '');
  };
  var _addTXPreSingle = addTX;
  addTX = function(obj){
    if(!daFeedEntryAllowed(obj)){ toast('📋 العلف بيتسجل من شيت العلف اليومي بس'); return null; }
    return _addTXPreSingle.apply(this, arguments);
  };
  if(typeof sheetTab !== 'undefined' && sheetTab === 'feed') sheetTab = 'mortality';
  DA_NAV.forEach(function(g){ g.items = g.items.filter(function(i){ return !DA_FEED_RETIRED[i[0]]; }); });
}
