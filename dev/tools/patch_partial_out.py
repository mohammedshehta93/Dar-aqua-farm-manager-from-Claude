# Partial harvest / transfer with a MEASURED weight (grading): the remaining fish's average = (biomass before − biomass
# out) ÷ fish remaining, in BOTH engines. Samples saved with a harvest/transfer (t.link) describe the fish that LEFT, not
# the tank, so they never set the tank's weight.
import sys
F = sys.argv[1] if len(sys.argv) > 1 else 'index.html'
h = open(F, encoding='utf-8').read()
def rep(old, new):
    global h
    if h.count(old) != 1: sys.exit(f'PATCH FAILED ({h.count(old)}): {old[:90]!r}')
    h = h.replace(old, new)
# live engine
rep("""          if(t.type==='sampling'){
             r.avgWt = t.avgWt||r.avgWt;
           }
           if(t.type==='transfer_out'){
             r.fishNo = Math.max(0,(r.fishNo||0)-(t.fishNo||0));
           }
           if(t.type==='harvesting'){
             r.fishNo = Math.max(0,(r.fishNo||0)-(parseInt(t.fishNo)||0));
           }""",
"""          if(t.type==='sampling' && !t.link){
             r.avgWt = t.avgWt||r.avgWt;
           }
           if(t.type==='transfer_out'||t.type==='harvesting'){
             var _n=parseInt(t.fishNo)||0; r.avgWt = daRemainWt(r.fishNo||0, r.avgWt||0, _n, daOutWt(t));
             r.fishNo = Math.max(0,(r.fishNo||0)-_n);
           }""")
# date engine
rep("""      if(t.type === 'sampling' && parseFloat(t.avgWt) > 0) wt = parseFloat(t.avgWt);
    });
    var sub = 0, subEv = null;
    ev.forEach(function(t){ var f = DA_SUB_FIELD[t.type]; if(f){ sub += parseInt(t[f]) || 0; subEv = t; } });""",
"""      if(t.type === 'sampling' && parseFloat(t.avgWt) > 0 && !t.link) wt = parseFloat(t.avgWt);
    });
    var sub = 0, subEv = null, cur = start;
    ev.forEach(function(t){ var f = DA_SUB_FIELD[t.type]; if(f){ var n = parseInt(t[f]) || 0; sub += n; subEv = t;
      if(t.type === 'transfer_out' || t.type === 'harvesting') wt = daRemainWt(cur, wt, n, daOutWt(t)); cur = Math.max(0, cur - n); } });""")
open(F, 'w', encoding='utf-8').write(h); print('patched', F)
