# The live-state replay (_txLiveRows) hard-codes record types: teach it the cycle-close ADJUSTMENT (count) so the current
# stock and the date simulation (daSimulateUnit, via DA_SUB_FIELD) agree.
import sys, re
F = sys.argv[1] if len(sys.argv) > 1 else 'index.html'
h = open(F, encoding='utf-8').read()
i = h.find('function _txLiveRows(){'); j = h.find('\nfunction ', i + 10)
seg = h[i:j]
m = re.search(r"if\(t\.type==='mortality'\)\{\s*r\.fishNo = Math\.max\(0,\(r\.fishNo\|\|0\)-\(t\.count\|\|0\)\);\s*\}", seg)
if not m: sys.exit('PATCH FAILED: mortality block in _txLiveRows')
add = m.group(0) + "\n            if(t.type==='adjustment'){ r.fishNo = Math.max(0,(r.fishNo||0)-(parseInt(t.count)||0)); }"
seg2 = seg[:m.start()] + add + seg[m.end():]
h = h[:i] + seg2 + h[j:]
open(F, 'w', encoding='utf-8').write(h); print('patched', F)
