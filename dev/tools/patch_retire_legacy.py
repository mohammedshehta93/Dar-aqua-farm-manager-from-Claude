# Retired entry screens (feed-sheet-only entry since 2026-10-29): their registrations point to the retired notices,
# the legacy switch (window.DA_SINGLE_FEED = false) is gone, and their code can be removed.
import sys
F = sys.argv[1] if len(sys.argv) > 1 else 'index.html'
h = open(F, encoding='utf-8').read()
def rep(old, new):
    global h
    if h.count(old) != 1: sys.exit(f'PATCH FAILED ({h.count(old)}): {old[:90]!r}')
    h = h.replace(old, new)
rep("'quick-feed':renderQuickFeed,", "'quick-feed':null,")
rep("'tx-feeding':renderTxFeeding,'tx-mortality':renderTxMortality,", "'tx-feeding':null,'tx-mortality':null,")
rep("'photo-entry':renderPhotoEntry,", "'photo-entry':null,")
rep("daily:renderDaily,", "daily:null,")
rep("VIEWS['feed-week'] = renderFeedWeek;", "VIEWS['feed-week'] = null;")
rep("function daSingleFeed(){ return window.DA_SINGLE_FEED !== false; }", "function daSingleFeed(){ return true; }   // the old entry screens were removed (2026-11-08)")
rep("""  var _dailyPreSingle = VIEWS.daily;
  if(_dailyPreSingle) VIEWS.daily = renderDaily = function(){
    if(!daSingleFeed()) return _dailyPreSingle.apply(this, arguments);
    if(sheetTab === 'feed') sheetTab = 'mortality';
    var h = _dailyPreSingle.apply(this, arguments);
    return h.replace(/<button[^>]*sheetTab=\\\\?'feed\\\\?'[^>]*>[\\s\\S]*?<\\/button>/, '');
  };
""", "")
open(F, 'w', encoding='utf-8').write(h); print('patched', F)
