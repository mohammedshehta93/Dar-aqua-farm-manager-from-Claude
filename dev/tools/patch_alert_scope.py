# Alerts: each tank judged by its own farm's limits (→ global → default). Alert page: explicit scope (all farms / one farm).
import sys
F = sys.argv[1] if len(sys.argv) > 1 else 'index.html'
h = open(F, encoding='utf-8').read()
def rep(old, new):
    global h
    if h.count(old) != 1: sys.exit(f'PATCH FAILED ({h.count(old)}): {old[:80]!r}')
    h = h.replace(old, new)
rep("  rs.forEach(function(r){\n    // 1. DENSITY ALARM", "  var LIMBASE = LIM;\n  rs.forEach(function(r){\n    var LIM = typeof daFarmLIM === 'function' ? daFarmLIM(r.farm || String(r.unit).split('.')[0]) : LIMBASE;   // this tank's farm limits\n    // 1. DENSITY ALARM")
rep("""h += '<p style="font-size:11px;color:var(--muted)">تنبيهات تلقائية للأحداث الحرجة</p></div></div>';""",
    """h += '<p style="font-size:11px;color:var(--muted)">تنبيهات تلقائية للأحداث الحرجة</p></div></div>';
  if(typeof daAlsScopeBar === 'function'){ h += daAlsScopeBar(); var _sc = daAlsScope(); cfg = Object.assign({}, daRawSettings('global'), _sc === 'global' ? {} : daRawSettings(_sc)); }""")
rep("""  var cfg = getSettings(_settingsFarm);
  var g = function(id,def){ var el=document.getElementById(id); return el?parseFloat(el.value)||def:def; };
  cfg.alertDensity = g('st-alert-dens',25);""",
    """  var _sc = typeof daAlsScope === 'function' ? daAlsScope() : _settingsFarm, cfg = typeof daRawSettings === 'function' ? daRawSettings(_sc) : getSettings(_settingsFarm);
  var g = function(id,def){ var el=document.getElementById(id); return el?parseFloat(el.value)||def:def; };
  cfg.alertDensity = g('st-alert-dens',25);""")
rep("""  cfg.densAlarm = cfg.alertDensity; cfg.densWarn = cfg.warnDensity; cfg.doCrit = cfg.alertDO; cfg.tempHi = cfg.alertTemp;   // the keys the alerts read
  saveSettings(cfg, _settingsFarm);
  toast('✅ تم حفظ إعدادات التنبيه');""",
    """  cfg.densAlarm = cfg.alertDensity; cfg.densWarn = cfg.warnDensity; cfg.doCrit = cfg.alertDO; cfg.tempHi = cfg.alertTemp;   // the keys the alerts read
  saveSettings(cfg, _sc === 'global' ? 'all' : _sc);
  toast('✅ تم حفظ حدود التنبيه — ' + (_sc === 'global' ? 'كل المزارع' : _sc));""")
open(F, 'w', encoding='utf-8').write(h); print('patched', F)
