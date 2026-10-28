import os; os.environ['E2E_PORT'] = '8798'
from harness import *

def wq(pg): return pg.evaluate("() => getTX().filter(t=>t.type==='water_quality' && t.date===window._wqs.date && !t.deleted)")
def put(pg, i, temp=None, ph=None, do=None, notes=None):
    for k, v in (('temp', temp), ('ph', ph), ('do', do), ('notes', notes)):
        if v is not None: pg.fill(f'#wqs-{i}-{k}', str(v))
def wq_alerts(pg): return [a for a in pg.evaluate("generateAlerts()") if a.get('icon') == '💧']

with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin'); sb.add_user('worker@example.com', 'work123', role='worker')
    ctx, pg = new_page(p, sb)
    login(pg, 'admin@example.com', 'admin123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    items = pg.evaluate("() => DA_NAV.find(g=>g.id==='entry').items.map(i=>i[0])")
    check('W1 "شيت القياسات اليومي" right after the feed sheet', items[:2] == ['feed-sheet', 'wq-sheet'], items[:3])
    pg.evaluate("window._wqs={farm:'F1'}; show('wq-sheet')"); pg.wait_for_timeout(400)
    secs = pg.evaluate("() => [...document.querySelectorAll('.wqs-t .wqs-sec')].map(x=>x.textContent)")
    check('W2 one row per section, in order (like the paper)', secs == ['S-01', 'S-02'], secs)
    pg.evaluate("document.querySelector('details.card').open=true")
    for k, v in (('tempLo', 21), ('tempHi', 32), ('phMin', 6), ('phMax', 7.5), ('doCrit', 4)): pg.fill(f'#wqs-lim-{k}', str(v))
    pg.evaluate("daWqsSaveLimits()"); pg.wait_for_timeout(300)
    check('W3 acceptance limits saved per farm', pg.evaluate("daWqLimits('F1')") == {'tempLo': 21, 'tempHi': 32, 'phMin': 6, 'phMax': 7.5, 'doCrit': 4} and pg.evaluate("daWqLimits('F2').phMax") == 9)
    check('W3 limits shown in the acceptance row', '6–7.5' in content(pg))
    put(pg, 0, 28, 7.2, 6.5); put(pg, 1, 27, 7.9, 3.8); pg.wait_for_timeout(100)
    m = pg.evaluate("() => ({ok0:document.getElementById('wqs-0-ok').textContent, ok1:document.getElementById('wqs-1-ok').textContent, phRed:document.getElementById('wqs-1-ph').classList.contains('wqs-out'), doRed:document.getElementById('wqs-1-do').classList.contains('wqs-out'), tempRed:document.getElementById('wqs-1-temp').classList.contains('wqs-out'), need:document.getElementById('wqs-1-notes').classList.contains('wqs-need')})")
    check('W4 ✓/✗ computed from the limits, out-of-range cells marked', m['ok0'] == '✓' and m['ok1'] == '✗' and m['phRed'] and m['doRed'] and not m['tempRed'] and m['need'], m)
    msg = []; pg.once('dialog', lambda d: (msg.append(d.message), d.dismiss())); pg.click('#wqs-save'); pg.wait_for_timeout(300)
    check('W5 out of range without corrective action → asks; cancel saves nothing', msg and 'إجراء تصحيحي' in msg[0] and not wq(pg), msg)
    put(pg, 1, notes='تشغيل بلاور إضافي + تغيير 10% مية'); pg.click('#wqs-save'); pg.wait_for_timeout(500)
    recs = {t['unit']: t for t in wq(pg)}
    check('W6 ONE record per section (not copied to every tank)', sorted(recs) == ['F1.S01', 'F1.S02'], sorted(recs))
    r2 = recs.get('F1.S02', {})
    check('W6 record keeps values, scope, result and action', r2.get('scope') == 'section' and r2.get('ph') == 7.9 and r2.get('ok') is False and 'pH' in r2.get('issues', '') and 'بلاور' in r2.get('notes', ''), r2)
    a = [x for x in wq_alerts(pg) if 'F1.S02' in x.get('title', '')]
    check('W7 alert uses the farm\'s limits (pH 7.9 is out for F1, was silent at 6.5–9)', a and 'pH=7.9' in a[0].get('detail', '') and 'DO=3.8' in a[0].get('detail', ''), a)
    check('W7 in-range section has no alert', not [x for x in wq_alerts(pg) if 'F1.S01' in x.get('title', '')])
    pg.evaluate("addTX({id:'ws-F2.S01-'+daToday(),type:'water_quality',unit:'F2.S01',scope:'section',date:daToday(),temp:20,ph:7.9,do:6,_skipValidation:true}); var c=getSettings('F2')||{}; c.phMax=8; c.tempLo=21; saveSettings(c,'F2');")
    a2 = [x for x in wq_alerts(pg) if 'F2.S01' in x.get('title', '')]
    check('W8 per farm: pH 7.9 fine in F2 (limit 8); low temperature now alerts', a2 and 'pH' not in a2[0].get('detail', '') and 'Temp=20' in a2[0].get('detail', ''), a2)
    pg.evaluate("show('wq-sheet',true)"); pg.wait_for_timeout(300)
    check('W9 re-opening the date shows the saved readings', pg.input_value('#wqs-1-ph') == '7.9' and 'متسجل قبل كده' in content(pg))
    put(pg, 1, ph=7.4); pg.click('#wqs-save'); pg.wait_for_timeout(400)
    recs = {t['unit']: t for t in wq(pg)}
    check('W9 saving again edits the same record', len([t for t in wq(pg) if t['unit'] == 'F1.S02']) == 1 and recs['F1.S02']['ph'] == 7.4 and recs['F1.S02']['ok'] is False, recs.get('F1.S02'))
    for k in ('temp', 'ph', 'do', 'notes'): pg.fill(f'#wqs-0-{k}', '')
    pg.click('#wqs-save'); pg.wait_for_timeout(400)
    check('W9 clearing a row removes its record', 'F1.S01' not in {t['unit'] for t in wq(pg)})
    put(pg, 0, ph=15); msg = []; pg.once('dialog', lambda d: (msg.append(d.message), d.accept())); pg.click('#wqs-save'); pg.wait_for_timeout(300)
    check('W10 impossible value refused (typo guard)', msg and 'مستحيلة' in msg[0] and 'F1.S01' not in {t['unit'] for t in wq(pg)}, msg)
    tv = pg.evaluate("Object.keys(VIEWS).find(k=>VIEWS[k]===renderWQTrends)")
    pg.evaluate(f"_wqTrendUnit='F1.S02T01'; show('{tv}')"); pg.wait_for_timeout(300)
    pg.evaluate(f"_wqTrendUnit='F1.S01T01'; show('{tv}',true)"); pg.wait_for_timeout(300); other = content(pg)
    pg.evaluate(f"_wqTrendUnit='F1.S02T01'; show('{tv}',true)"); pg.wait_for_timeout(300); mine = content(pg)
    check('W11 a tank\'s trend page shows its section\'s reading (and not another section\'s)', '7.4' in mine and '7.4' not in other and not pg._errs, (mine[:300], pg._errs))
    pg.evaluate("show('tx-water-quality')"); pg.wait_for_timeout(300)
    check('W12 the per-tank water page still works', not pg._errs, pg._errs)
    pg.evaluate("doLogout(true)"); pg.wait_for_timeout(600)
    login(pg, 'worker@example.com', 'work123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    pg.evaluate("window._wqs={farm:'F1',date:daAddDays(daToday(),-1)}; show('wq-sheet')"); pg.wait_for_timeout(300)
    put(pg, 0, 28, 7, 6); pg.click('#wqs-save'); pg.wait_for_timeout(400)
    w = wq(pg)
    check('W13 worker readings (back-dated) go to review', w and all(t.get('status') == 'pending' for t in w), w)
    check('W13 worker cannot change the limits', pg.evaluate("!document.getElementById('wqs-lim-phMax')"))
    check('W14 no page errors', not pg._errs, pg._errs)
    ctx.close()
    ctx = BROWSER.new_context(viewport={'width': 390, 'height': 800}); ctx.route('**/*', make_handler(sb)); pg = ctx.new_page(); pg._errs = []
    pg.on('pageerror', lambda e: pg._errs.append(str(e)))
    pg.goto(BASE); pg.wait_for_timeout(500); login(pg, 'admin@example.com', 'admin123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    pg.evaluate("window._wqs={farm:'F1'}; show('wq-sheet')"); pg.wait_for_timeout(400)
    check('W15 phone: page does not overflow sideways', not pg.evaluate("document.documentElement.scrollWidth>window.innerWidth+1") and not pg._errs, pg._errs)
    ctx.close()
    fails = [r for r in RESULTS if not r[1]]
    for nm, ok, dt in RESULTS: print(('✅ ' if ok else '❌ ') + nm + ('' if ok else f'  → {str(dt)[:300]}'))
    print(f'\n{len(RESULTS)-len(fails)}/{len(RESULTS)} passed')
