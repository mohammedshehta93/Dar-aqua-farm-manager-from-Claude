import os; os.environ['E2E_PORT'] = '8789'
from harness import *

def close(a, b, tol=0.01): return a is not None and abs(a - b) <= tol

with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin')
    sb.add_user('worker@example.com', 'work123', role='worker')
    ctx, pg = new_page(p, sb)
    login(pg, 'admin@example.com', 'admin123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    # D1 = today-35, D2 = today-21 (14-day period)
    pg.evaluate("""() => { const D1 = daAddDays(daToday(), -35), D2 = daAddDays(D1, 14), A = o => addTX(Object.assign({_skipValidation:true}, o));
      // F1.S02T01: 881 fish, 80g → 160g, 9 kg/day, 81 dead mid-period
      A({id:'a-s1',type:'sampling',unit:'F1.S02T01',date:D1,avgWt:80}); A({id:'a-s2',type:'sampling',unit:'F1.S02T01',date:D2,avgWt:160});
      for(let i=1;i<=14;i++) A({id:'a-f'+i,type:'feeding',unit:'F1.S02T01',date:daAddDays(D1,i),kg:9,feed:'2mm'});
      A({id:'a-m',type:'mortality',unit:'F1.S02T01',date:daAddDays(D1,7),count:81,cause:'مرض'});
      // F1.S02T02: 704 fish, 400g → 460g, 4.5 kg/day, partial harvest 200 fish / 90 kg
      A({id:'b-s1',type:'sampling',unit:'F1.S02T02',date:D1,avgWt:400}); A({id:'b-s2',type:'sampling',unit:'F1.S02T02',date:D2,avgWt:460});
      for(let i=1;i<=14;i++) A({id:'b-f'+i,type:'feeding',unit:'F1.S02T02',date:daAddDays(D1,i),kg:4.5,feed:'3mm'});
      A({id:'b-h',type:'harvesting',unit:'F1.S02T02',date:daAddDays(D1,10),fishNo:200,kg:90});
      // F1.S01T03: feed on only 3 of 14 days → must be excluded
      A({id:'c-s1',type:'sampling',unit:'F1.S01T03',date:D1,avgWt:110}); A({id:'c-s2',type:'sampling',unit:'F1.S01T03',date:D2,avgWt:140});
      for(let i=1;i<=3;i++) A({id:'c-f'+i,type:'feeding',unit:'F1.S01T03',date:daAddDays(D1,i),kg:5});
      window.__D2 = D2; }""")
    pg.wait_for_timeout(500)
    per = pg.evaluate("() => daAllPeriods().filter(p => p.feed > 0).map(p => ({unit:p.unit, feed:p.feed, gain:p.gain, gainE:p.gainE, fcr:p.fcr, efcr:p.efcr, stage:p.stage, days:p.days}))")
    a = next((x for x in per if x['unit'] == 'F1.S02T01'), None)
    b = next((x for x in per if x['unit'] == 'F1.S02T02'), None)
    c = next((x for x in per if x['unit'] == 'F1.S01T03'), None)
    # hand calc A: B1=881*.08=70.48, B2=800*.16=128, dead valued at 120g → 9.72 kg
    gA = 128 - 70.48 + 9.72; check('F1 mortality-credited gain (dead fish at interpolated weight)', a and close(a['gain'], gA), a)
    check('F1 biological FCR = 126 / 67.24', a and close(a['fcr'], 126 / gA), a)
    check('F1 economic FCR excludes dead fish', a and close(a['efcr'], 126 / (128 - 70.48)), a)
    check('F1 stage from mid-weight 120g → 2mm band', a and a['stage'] == 1, a)
    gB = 504 * .46 - 704 * .4 + 90; check('F2 partial harvest counted at its real weight', b and close(b['gain'], gB) and close(b['fcr'], 63 / gB), b)
    check('F2 mid-weight 430g → 3mm band', b and b['stage'] == 2, b)
    iss = pg.evaluate("() => { const st=daFcrStages(); const p=daAllPeriods().find(p=>p.unit==='F1.S01T03'&&p.feed>0); return daPeriodIssue(p, st); }")
    check('F3 period with feed on 3/14 days is excluded', c and iss and iss.get('drop') is True, iss)
    first = pg.evaluate("() => daAllPeriods().filter(p=>p.unit==='F1.S02T01'&&p.feed===0).length")
    check('F3 stocking→first sample with no feed logged is excluded', first >= 1 and pg.evaluate("() => { const st=daFcrStages(); return daAllPeriods().filter(p=>p.feed===0).every(p=>daPeriodIssue(p,st).drop); }"))
    tot = pg.evaluate("() => daFcrSum(daFcrFilter({farm:'F1'}), daFcrStages())")
    check('F4 totals are Σfeed/Σgain (not average of ratios)', close(tot['fcr'], (126 + 63) / (gA + gB)), tot)
    check('F5 broodstock excluded', pg.evaluate("() => { RAW.find(r=>r.unit==='F1.S02T02').purpose='brood'; _dataVer++; const ok=!daAllPeriods().some(p=>p.unit==='F1.S02T02'); RAW.find(r=>r.unit==='F1.S02T02').purpose=''; _dataVer++; return ok; }"))
    # page
    pg.evaluate("show('fcr-stage')"); pg.wait_for_timeout(400)
    txt = content(pg)
    check('F6 FCR page renders stage + section tables', 'حسب المرحلة' in txt and 'F1.S02' in txt and '2mm' in txt, txt[:200])
    check('F6 review list explains the excluded period', 'ناقص' in txt and 'F1.S01T03' in txt)
    pg.fill('#fcr-exp-0', '1.0'); pg.fill('#fcr-exp-1', '1.0'); pg.fill('#fcr-exp-2', '1.0'); pg.evaluate("daSaveFcrExp()"); pg.wait_for_timeout(200)
    check('F7 expected FCR saved in a synced key', pg.evaluate("daFcrStages().map(s=>s.exp)") == [1, 1, 1] and pg.evaluate("daIsSyncedKey(DA_FCR_KEY)"))
    al = [x for x in pg.evaluate("generateAlerts()") if x.get('title', '').startswith('FCR أعلى')]
    check('F8 section FCR alert when well above expected', len(al) == 1 and 'F1.S02' in al[0]['msg'], al)
    pg.evaluate("localStorage.removeItem(DA_FCR_KEY); _dataVer++")
    check('F8 no FCR alert at default expectations', not [x for x in pg.evaluate("generateAlerts()") if x.get('title', '').startswith('FCR أعلى')])

    # weekly report
    pg.evaluate("localStorage.removeItem('daracqua_wr_seen'); show('dashboard')"); pg.wait_for_timeout(400)
    check('W1 dashboard shows "weekly report ready" card', pg.evaluate("!!document.getElementById('wr-card')"))
    check('W1 last closed week ends on the set weekday, before today', pg.evaluate("(() => { const e=daLastClosedWeekEnd(); return daDow(e)===daWeekEndDay() && e<daToday() && daAddDays(e,7)>=daToday(); })()"))
    d = pg.evaluate("daWeeklyData(window.__D2, 'F1')")
    check('W2 week feed = 7 days of both tanks (94.5 kg)', close(d['feed'], 7 * 9 + 7 * 4.5), d['feed'])
    check('W2 harvest in week counted', close(d['harvKg'], 90) and d['harvFish'] == 200)
    check('W2 FCR of periods closed this week', close(d['fcrWeek']['fcr'], (126 + 63) / (gA + gB)), d['fcrWeek'])
    check('W3 completeness flags tanks with no feed', d['completeness'] < 0.95 and any(m['unit'] == 'F1.S01T01' for m in d['missing']), d['completeness'])
    pg.evaluate("window._wr={end:window.__D2,farm:'F1'}; show('weekly-report')"); pg.wait_for_timeout(400)
    t = pg.inner_text('#wr-text')
    check('W4 report text has feed, mortality, FCR, completeness warning', '95 كجم' in t and 'FCR الأسبوع' in t and 'مكتملة' in t, t[:300])
    pg.evaluate("show('dashboard')"); pg.wait_for_timeout(300)
    check('W5 card hidden once that week was opened', pg.evaluate("localStorage.setItem('daracqua_wr_seen', daLastClosedWeekEnd()); show('dashboard'); !document.getElementById('wr-card')"))
    pg.evaluate("window._wr={}; localStorage.setItem(DA_WEEK_KEY,'4'); show('weekly-report')"); pg.wait_for_timeout(300)
    check('W6 week end day is configurable (Thursday)', pg.evaluate("daDow(window._wr.end)") == 4 and pg.evaluate("daIsSyncedKey(DA_WEEK_KEY)"))

    # navigation
    items = pg.evaluate("() => DA_NAV.reduce((a,g)=>a.concat(g.items.map(i=>i[0])),[])")
    check('N1 "التنبيهات الذكية" now opens the real alerts page', 'smart' in items and pg.evaluate("DA_NAV[0].items.find(i=>i[0]==='smart')[2]") == 'التنبيهات الذكية')
    check('N1 density page still reachable', 'alarms' in items)
    check('N2 FCR + weekly report in the menu', 'fcr-stage' in items and 'weekly-report' in items)
    check('N3 no page errors (admin)', not pg._errs, pg._errs)
    ctx.close()

    ctx, pg = new_page(p, sb)
    login(pg, 'worker@example.com', 'work123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    pg.evaluate("show('weekly-report')"); pg.wait_for_timeout(300)
    check('P1 worker cannot open weekly report', 'مش مسموحلك' in content(pg))
    pg.evaluate("show('dashboard')"); pg.wait_for_timeout(300)
    check('P1 worker gets no weekly card', pg.evaluate("!document.getElementById('wr-card')"))
    check('P2 no page errors (worker)', not pg._errs, pg._errs)
    ctx.close()

    fails = [r for r in RESULTS if not r[1]]
    for nm, ok, dt in RESULTS: print(('✅ ' if ok else '❌ ') + nm + ('' if ok else f'  → {str(dt)[:300]}'))
    print(f'\n{len(RESULTS)-len(fails)}/{len(RESULTS)} passed')
