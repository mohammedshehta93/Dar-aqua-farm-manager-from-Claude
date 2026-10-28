# Exact-string edits wiring the tabs module (dev/modules/tabs.js) into the core show() and the background re-renders.
import sys
F = sys.argv[1] if len(sys.argv) > 1 else 'index.html'
h = open(F, encoding='utf-8').read()
def rep(old, new, n=1):
    global h
    c = h.count(old)
    if c != n: sys.exit(f'PATCH FAILED ({c} matches, expected {n}): {old[:90]!r}')
    h = h.replace(old, new)
rep("""  var el = document.getElementById('content');
  var html = canAccessView(v) ? (VIEWS[v] || renderDashboard)() : renderNoAccess();
  if(el) el.innerHTML = html;
  applyNavPerms();
  try{ updateBackBtn(); }catch(e){}
  if(el) el.scrollTop = 0;
  try{ window.scrollTo(0, 0); }catch(e){}""",
"""  var el = document.getElementById('content');
  var keep = typeof daTabsActivate === 'function' ? daTabsActivate(v) : false;   // tab kept as-is (unsaved input)
  if(!keep){
    var html = canAccessView(v) ? (VIEWS[v] || renderDashboard)() : renderNoAccess();
    if(typeof daTabsSetHtml === 'function') daTabsSetHtml(el, html); else if(el) el.innerHTML = html;
  }
  applyNavPerms();
  try{ updateBackBtn(); }catch(e){}
  if(!keep){ if(el) el.scrollTop = 0; try{ window.scrollTo(0, 0); }catch(e){} }""")
rep("      show(currentView); // re-render with fresh data", "      daBgRefresh(currentView); // re-render with fresh data (never wipes unsaved input)")
rep("'farm-setup'].indexOf(currentView) >= 0) show(currentView, true);", "'farm-setup'].indexOf(currentView) >= 0) daBgRefresh(currentView);", 2)
rep("    btn.querySelector('#back-lbl').textContent = labels[prev] || prev;",
    "    btn.querySelector('#back-lbl').textContent = labels[prev] || (typeof daNavItem === 'function' && daNavItem(prev) ? daNavItem(prev)[2] : prev);")
open(F, 'w', encoding='utf-8').write(h); print('patched', F)
