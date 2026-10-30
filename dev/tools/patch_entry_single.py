# Dashboard charts (feed / mortality, last 7 days) read the real records instead of the retired daily-sheet logs store.
import sys
F = sys.argv[1] if len(sys.argv) > 1 else 'index.html'
h = open(F, encoding='utf-8').read()
old = "var f2=st(RAW.filter(function(r){return r.farm==='F2';}));\n  var logs=getLogs();"
if h.count(old) != 1: sys.exit('PATCH FAILED: dashboard logs line')
h = h.replace(old, "var f2=st(RAW.filter(function(r){return r.farm==='F2';}));\n  var logs=typeof daDashLogs==='function'?daDashLogs():getLogs();")
open(F, 'w', encoding='utf-8').write(h); print('patched', F)
