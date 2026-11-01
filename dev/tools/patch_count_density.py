# Density by COUNT is off unless switched on: the alert page saves the switch; the density page hides the count chip.
import sys
F = sys.argv[1] if len(sys.argv) > 1 else 'index.html'
h = open(F, encoding='utf-8').read()
def rep(old, new):
    global h
    if h.count(old) != 1: sys.exit(f'PATCH FAILED ({h.count(old)}): {old[:80]!r}')
    h = h.replace(old, new)
rep("""  cfg.densAlarm = cfg.alertDensity; cfg.densWarn = cfg.warnDensity; cfg.doCrit = cfg.alertDO; cfg.tempHi = cfg.alertTemp;   // the keys the alerts read""",
    """  cfg.densAlarm = cfg.alertDensity; cfg.densWarn = cfg.warnDensity; cfg.doCrit = cfg.alertDO; cfg.tempHi = cfg.alertTemp;   // the keys the alerts read
  var _co = document.getElementById('als-cnt-on'); if(_co){ cfg.cntOn = !!_co.checked; var _ca = parseFloat((document.getElementById('als-cnt-alarm') || {}).value), _cw = parseFloat((document.getElementById('als-cnt-warn') || {}).value); if(_ca > 0) cfg.cntAlarm = _ca; if(_cw > 0) cfg.cntWarn = _cw; }""")
rep("""var cAlarm=cfg.cntAlarm||120, cWarn=cfg.cntWarn||80;""",
    """var _cntOn = typeof daCntOn === 'function' ? daCntOn(farmFilter && farmFilter !== 'all' ? farmFilter : 'global') : true; var cAlarm=_cntOn?(cfg.cntAlarm||120):Infinity, cWarn=_cntOn?(cfg.cntWarn||80):Infinity;""")
rep("""  h+='<div style="background:#fce7f3;border-radius:8px;padding:8px 14px;font-size:12px">';
  h+='<span style="font-weight:700;color:#be185d">🐟 '+cAlarms+'</span> <span style="color:#9d174d">'+(isAr?'كثافة عدد خطر (>'+cAlarm+' سمكة/م³)':'Count alarm (>'+cAlarm+' fish/m³)')+'</span></div>';""",
    """  if(_cntOn){ h+='<div style="background:#fce7f3;border-radius:8px;padding:8px 14px;font-size:12px">';
  h+='<span style="font-weight:700;color:#be185d">🐟 '+cAlarms+'</span> <span style="color:#9d174d">'+(isAr?'كثافة عدد خطر (>'+cAlarm+' سمكة/م³)':'Count alarm (>'+cAlarm+' fish/m³)')+'</span></div>'; }""")
open(F, 'w', encoding='utf-8').write(h); print('patched', F)
