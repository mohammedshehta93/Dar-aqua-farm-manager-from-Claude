# Water-quality alerts use each reading's own farm limits (set in the daily testing log page) instead of a
# hard-coded pH 6.5–9, no low-temperature check and one farm's settings for all farms. Trends show section readings.
import sys
F = sys.argv[1] if len(sys.argv) > 1 else 'index.html'
h = open(F, encoding='utf-8').read()
def rep(old, new):
    global h
    c = h.count(old)
    if c != 1: sys.exit(f'PATCH FAILED ({c} matches): {old[:90]!r}')
    h = h.replace(old, new)
rep("""    var wq = lastWQByUnit[uid];
    var issues = [];
    if(wq.do!==null&&wq.do!==''&&parseFloat(wq.do)<(cfg.doCrit||4))  issues.push('DO='+(wq.do)+' mg/L 🔴');""",
"""    var wq = lastWQByUnit[uid];
    var issues = [];
    var wl = typeof daWqLimits === 'function' ? daWqLimits(String(uid).split('.')[0]) : {tempLo:-99, tempHi:cfg.tempHi||35, phMin:6.5, phMax:9, doCrit:cfg.doCrit||4};
    if(wq.do!==null&&wq.do!==''&&parseFloat(wq.do)<=wl.doCrit)  issues.push('DO='+(wq.do)+' mg/L 🔴');""")
rep("""    if(wq.ph!==null&&wq.ph!==''){ var ph=parseFloat(wq.ph); if(ph<6.5||ph>9) issues.push('pH='+ph+' 🔴'); }
    if(wq.temp!==null&&wq.temp!==''&&parseFloat(wq.temp)>(cfg.tempHi||35)) issues.push('Temp='+wq.temp+'°C 🔴');""",
"""    if(wq.ph!==null&&wq.ph!==''){ var ph=parseFloat(wq.ph); if(ph<wl.phMin||ph>wl.phMax) issues.push('pH='+ph+' 🔴'); }
    if(wq.temp!==null&&wq.temp!==''&&(parseFloat(wq.temp)>wl.tempHi||parseFloat(wq.temp)<wl.tempLo)) issues.push('Temp='+wq.temp+'°C 🔴');""")
rep("""&&t.unit===_wqTrendUnit;}).sort(""", """&&(t.unit===_wqTrendUnit||(t.scope==='section'&&typeof daSecOf==='function'&&t.unit===daSecOf(_wqTrendUnit)));}).sort(""")
open(F, 'w', encoding='utf-8').write(h); print('patched', F)
