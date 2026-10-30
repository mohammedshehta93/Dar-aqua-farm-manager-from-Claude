import os; os.environ['E2E_PORT'] = '8788'
from harness import *

def samp(pg, unit, wt, days_ago, tag):
    pg.evaluate(f"addTX({{id:'sm-{tag}',type:'sampling',unit:'{unit}',avgWt:{wt},date:daAddDays(daToday(),-{days_ago}),_skipValidation:true}})")

with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin')
    ctx, pg = new_page(p, sb)
    login(pg, 'admin@example.com', 'admin123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000); pg.evaluate('window.DA_SINGLE_FEED=false')  # legacy screens' cause lists under test (retired 2026-10-30)

    # ── M: optional mortality causes ──
    pg.evaluate("sheetTab='mortality'; show('daily')"); pg.wait_for_timeout(300)
    opts = pg.evaluate("() => Array.from(document.querySelectorAll('#m_cause_F1_S01T01 option')).map(o=>o.value)")
    check('M1 daily sheet: first option is blank (cause optional)', opts[:1] == [''], opts)
    check('M1 daily sheet: default list shown', 'مرض' in opts and 'نقص أكسجين' in opts, opts)
    pg.evaluate("settingsTab='standards'; show('settings')"); pg.wait_for_timeout(300)
    check('M2 editor shown in settings/standards', pg.evaluate("!!document.getElementById('da-causes')"))
    pg.fill('#da-causes', 'مرض\nنقص أكسجين\nقفز من التانك\n\nمرض')
    pg.evaluate("applySettings()"); pg.wait_for_timeout(200)
    check('M2 list saved (blank lines + duplicates dropped)', pg.evaluate("daCauseList()") == ['مرض', 'نقص أكسجين', 'قفز من التانك'], pg.evaluate("daCauseList()"))
    check('M2 list stored in a synced (farm-wide) key', pg.evaluate("daIsSyncedKey(DA_CAUSE_KEY)"))
    pg.evaluate("sheetTab='mortality'; show('daily')"); pg.wait_for_timeout(300)
    opts = pg.evaluate("() => Array.from(document.querySelectorAll('#m_cause_F1_S01T01 option')).map(o=>o.value)")
    check('M3 custom cause appears in daily sheet', 'قفز من التانك' in opts, opts)
    pg.evaluate("show('tx-mortality')"); pg.wait_for_timeout(300)
    sel = pg.evaluate("() => { const s=document.getElementById('mt-cause-F1.S01T01'); return s && {v:s.value, o:Array.from(s.options).map(o=>o.value)}; }")
    check('M4 tx-mortality uses same list, blank by default', sel and sel['v'] == '' and 'قفز من التانك' in sel['o'], sel)
    check('M5 old saved value not in list is kept as an option', 'سبب قديم' in pg.evaluate("daCauseOptions('سبب قديم')"))
    check('M5 legacy key shown as Arabic label', pg.evaluate("daCauseLabel('disease')") == 'مرض' and pg.evaluate("daCauseLabel('')") == 'غير محدد')
    pg.evaluate("""() => { addTX({id:'m-a',type:'mortality',date:daToday(),unit:'F1.S01T01',count:3,cause:'disease',_skipValidation:true});
                         addTX({id:'m-b',type:'mortality',date:daToday(),unit:'F1.S01T02',count:2,cause:'مرض',_skipValidation:true});
                         addTX({id:'m-c',type:'mortality',date:daToday(),unit:'F1.S01T03',count:1,_skipValidation:true}); }""")
    pg.wait_for_timeout(300)
    pg.evaluate("show('mortality-analysis')"); pg.wait_for_timeout(300)
    txt = content(pg)
    check('M6 analysis merges "disease" + "مرض"', 'disease' not in txt and 'مرض' in txt, txt[:300])
    check('M6 mortality without cause accepted (counted as غير محدد)', 'غير محدد' in txt and pg.evaluate("getTX().some(t=>t.id==='m-c')"))

    # ── H: harvest-soon alert ──
    check('H0 no alert while no harvest target set', pg.evaluate("daHarvestSoonAlerts()") == [])
    pg.evaluate("() => { var s=getSettings('all')||{}; s.harvestTargetWt=500; saveSettings(s,'all'); }")
    samp(pg, 'F1.S01T01', 420, 29, 'a1'); samp(pg, 'F1.S01T01', 488, 1, 'a2')   # ~4 days left
    samp(pg, 'F1.S01T02', 410, 29, 'b1'); samp(pg, 'F1.S01T02', 486, 1, 'b2')   # ~4 days left
    samp(pg, 'F1.S02T01', 380, 29, 'c1'); samp(pg, 'F1.S02T01', 470, 1, 'c2')   # ~8 days left
    samp(pg, 'F1.S02T02', 420, 29, 'd1'); samp(pg, 'F1.S02T02', 488, 1, 'd2')   # close, but broodstock
    pg.evaluate("RAW.find(r=>r.unit==='F1.S02T02').purpose='brood'; _dataVer++")
    pg.wait_for_timeout(300)
    al = pg.evaluate("daHarvestSoonAlerts()")
    s1 = [a for a in al if a['section'] == 'F1.S01']; s2 = [a for a in al if a['section'] == 'F1.S02']
    check('H1 one grouped alert per section', len(s1) == 1 and len(s2) == 1, al)
    check('H1 S01 alert lists both tanks', s1 and 'F1.S01T01' in s1[0]['msg'] and 'F1.S01T02' in s1[0]['msg'], s1)
    check('H2 broodstock tank excluded', all('F1.S02T02' not in a['msg'] for a in al), al)
    check('H3 ≤7 days → warn, 8–14 → info', s1 and s1[0]['level'] == 'warn' and s2 and s2[0]['level'] == 'info', [(a['section'], a['level']) for a in al])
    check('H4 slow / unsampled tanks not alerted', all('F1.S01T03' not in a['msg'] and 'F2.' not in a['section'] for a in al), al)
    check('H5 alerts appear in generateAlerts()', sum(1 for a in pg.evaluate("generateAlerts()") if a.get('title', '').startswith('حصاد قريب')) == 2)
    pg.evaluate("show('smart')"); pg.wait_for_timeout(300)
    check('H5 alerts shown on the smart-alerts page', 'حصاد قريب' in content(pg))
    # back-dated: last sample 20 days ago — projection runs from the sample date, not from today
    pr = pg.evaluate("""() => daHarvestProjection({unit:'F1.S01T03',farm:'F1',fishNo:900},
          [{avgWt:400,date:daAddDays(daToday(),-40)},{avgWt:470,date:daAddDays(daToday(),-20)}], daToday())""")
    check('H6 back-dated sample projected from its own date', pr and pr['days'] <= 0 and pr['sampleAge'] == 20, pr)
    pr2 = pg.evaluate("""() => daHarvestProjection({unit:'F1.S01T03',farm:'F1',fishNo:900},
          [{avgWt:400,date:daAddDays(daToday(),-12)},{avgWt:470,date:daAddDays(daToday(),-10)}], daToday())""")
    check('H7 samples <7 days apart not used for SGR (falls back to stocking weight)', pr2 is None or pr2['sgr'] < 3, pr2)
    pg.evaluate("() => { var s=getSettings('F1')||{}; s.harvestTargetWt=700; saveSettings(s,'F1'); }")
    check('H8 per-farm target overrides the global one', pg.evaluate("daHarvestSoonAlerts()") == [], pg.evaluate("daHarvestSoonAlerts()"))
    check('H9 no page errors', not pg._errs, pg._errs)
    ctx.close()

    fails = [r for r in RESULTS if not r[1]]
    for n, ok, d in RESULTS: print(('✅ ' if ok else '❌ ') + n + ('' if ok else f'  → {str(d)[:300]}'))
    print(f'\n{len(RESULTS)-len(fails)}/{len(RESULTS)} passed')
