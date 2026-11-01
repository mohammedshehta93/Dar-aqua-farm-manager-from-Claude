# Weights the farm WEIGHED after a transfer win over the computed ones: transfer_out.remainWt (the fish that stay in the
# source) and transfer_in.newWt (the destination after mixing). Both engines.
import sys
F = sys.argv[1] if len(sys.argv) > 1 else 'index.html'
h = open(F, encoding='utf-8').read()
def rep(old, new):
    global h
    if h.count(old) != 1: sys.exit(f'PATCH FAILED ({h.count(old)}): {old[:90]!r}')
    h = h.replace(old, new)
rep("""      var n = parseInt(t.fishNo) || 0, w = parseFloat(t.avgWt) || wt;
      if(fish + n > 0) wt = (fish * wt + n * w) / (fish + n);
      fish += n; if(n > 0) emptiedBy = null; } });""",
"""      var n = parseInt(t.fishNo) || 0, w = parseFloat(t.avgWt) || wt;
      if(fish + n > 0) wt = (fish * wt + n * w) / (fish + n);
      if(parseFloat(t.newWt) > 0) wt = parseFloat(t.newWt);   // weighed after mixing
      fish += n; if(n > 0) emptiedBy = null; } });""")
rep("""      if(t.type === 'transfer_out' || t.type === 'harvesting') wt = daRemainWt(cur, wt, n, daOutWt(t)); cur = Math.max(0, cur - n); } });""",
    """      if(t.type === 'transfer_out' || t.type === 'harvesting') wt = parseFloat(t.remainWt) > 0 && cur - n > 0 ? parseFloat(t.remainWt) : daRemainWt(cur, wt, n, daOutWt(t)); cur = Math.max(0, cur - n); } });""")
rep("""             var _n=parseInt(t.fishNo)||0; r.avgWt = daRemainWt(r.fishNo||0, r.avgWt||0, _n, daOutWt(t));""",
    """             var _n=parseInt(t.fishNo)||0; r.avgWt = parseFloat(t.remainWt)>0 && (r.fishNo||0)-_n>0 ? parseFloat(t.remainWt) : daRemainWt(r.fishNo||0, r.avgWt||0, _n, daOutWt(t));""")
rep("""             if(r.fishNo>0) r.avgWt=(prevBio+inBio)/r.fishNo;
           }""", """             if(r.fishNo>0) r.avgWt=(prevBio+inBio)/r.fishNo;
             if(parseFloat(t.newWt)>0) r.avgWt=parseFloat(t.newWt);
           }""")
open(F, 'w', encoding='utf-8').write(h); print('patched', F)
