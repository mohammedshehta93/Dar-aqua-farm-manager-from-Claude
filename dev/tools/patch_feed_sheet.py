# daStateAt(unit, date) for a date AFTER the last event day must return the END of that day (after mortality/harvest/
# transfers). It returned the start of that day, so a tank emptied yesterday still showed its fish today — the feed
# sheet, the weekly report and validateTX all relied on it. Same-day queries keep the start-of-day state.
import sys
F = sys.argv[1] if len(sys.argv) > 1 else 'index.html'
h = open(F, encoding='utf-8').read()
def rep(old, new):
    global h
    c = h.count(old)
    if c != 1: sys.exit(f'PATCH FAILED ({c} matches): {old[:90]!r}')
    h = h.replace(old, new)
rep("""    fish = Math.max(0, start - sub);
    if(start > 0 && fish === 0 && subEv) emptiedBy = subEv;""",
    """    fish = Math.max(0, start - sub);
    states[d].endFish = fish; states[d].endWt = wt;
    if(start > 0 && fish === 0 && subEv) emptiedBy = subEv;""")
rep("""  return ds.length ? s.states[ds[ds.length - 1]] : {fish:raw.fishNo || 0, wt:raw.avgWt || 0};""",
    """  if(!ds.length) return {fish:raw.fishNo || 0, wt:raw.avgWt || 0};
  var last = ds[ds.length - 1], st = s.states[last];
  return last < date ? {fish:st.endFish, wt:st.endWt} : st;""")
open(F, 'w', encoding='utf-8').write(h); print('patched', F)
