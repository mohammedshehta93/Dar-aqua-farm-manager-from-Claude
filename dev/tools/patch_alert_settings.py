# The alert-settings page saved alertDensity / warnDensity / alertDO / alertTemp, which nothing reads; the alerts read
# densAlarm / densWarn / doCrit / tempHi (same keys as Settings → المعايير and the testing log). Page now reads/writes those.
import sys
F = sys.argv[1] if len(sys.argv) > 1 else 'index.html'
h = open(F, encoding='utf-8').read()
def rep(old, new):
    global h
    if h.count(old) != 1: sys.exit(f'PATCH FAILED ({h.count(old)}): {old[:80]!r}')
    h = h.replace(old, new)
rep("val:cfg.alertDensity||25,", "val:cfg.densAlarm||cfg.alertDensity||25,")
rep("val:cfg.warnDensity||20,", "val:cfg.densWarn||cfg.warnDensity||15,")
rep("val:cfg.alertDO||2,", "val:cfg.doCrit||cfg.alertDO||4,")
rep("val:cfg.alertTemp||33,", "val:cfg.tempHi||cfg.alertTemp||32,")
rep("""  cfg.alertTemp    = g('st-alert-temp',33);
  saveSettings(cfg, _settingsFarm);""", """  cfg.alertTemp    = g('st-alert-temp',33);
  cfg.densAlarm = cfg.alertDensity; cfg.densWarn = cfg.warnDensity; cfg.doCrit = cfg.alertDO; cfg.tempHi = cfg.alertTemp;   // the keys the alerts read
  saveSettings(cfg, _settingsFarm);""")
open(F, 'w', encoding='utf-8').write(h); print('patched', F)
