# Paper habits seen on the farm's real sheets: grams in nursery sections, dead written "2+1", X = not fed.
import os; os.environ['E2E_PORT'] = '8799'
from harness import *

def ri(pg, label): return pg.evaluate(f"() => (window._fs.rows.find(r=>r.no.label==='{label}')||{{}}).i")
def rec(pg, prefix, unit, date="daToday()"): return pg.evaluate(f"() => getTX().find(t=>t.id==='{prefix}-{unit}-'+{date}) || null")

with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin')
    ctx, pg = new_page(p, sb)
    login(pg, 'admin@example.com', 'admin123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    pg.evaluate("window._fs={farm:'F1'}; show('feed-sheet')"); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('details.card').open=true")
    pg.fill('#fs-groups', '1 = 7, 9:30, 12:30 | g\n2- = 7, 9:30, 12:30, 3:30'); pg.evaluate("daFsSaveGroups()"); pg.wait_for_timeout(300)
    t = pg.evaluate("() => [...document.querySelectorAll('.fs-group .card-title')].map(x=>x.textContent)")
    check('G1 a group can be entered in grams (marked on the table)', 'بالجرام' in t[0] and 'بالكيلو' in t[1], t)
    check('G1 grams setting survives save/reload of the meal times', '| g' in pg.input_value('#fs-groups'))
    i = ri(pg, '1.1'); pg.fill(f'#fs-{i}-m0', '500'); pg.fill(f'#fs-{i}-m1', '500'); pg.fill(f'#fs-{i}-m2', '200'); pg.fill(f'#fs-{i}-sz', '2')
    pg.fill(f'#fs-{i}-d', '6+1')
    j = ri(pg, '2.1'); pg.fill(f'#fs-{j}-m0', '1.2'); pg.fill(f'#fs-{j}-m1', 'X'); pg.fill(f'#fs-{j}-m2', '.8'); pg.fill(f'#fs-{j}-sz', '3'); pg.fill(f'#fs-{j}-d', '٢+١')
    check('G2 totals: grams converted (1.2 kg) + kg row (2.0) + dead summed (7+3)', pg.inner_text('#fs-tot-kg') == '3.2' and pg.inner_text('#fs-tot-dead') == '10', (pg.inner_text('#fs-tot-kg'), pg.inner_text('#fs-tot-dead')))
    k = ri(pg, '1.2'); pg.click(f'#fs-{k}-m0 >> xpath=ancestor::tr//button[contains(@class,"fs-fast")]'); pg.wait_for_timeout(100)
    check('G3 ✕ at the end of a row marks every meal X', [pg.input_value(f'#fs-{k}-m{n}') for n in range(3)] == ['X', 'X', 'X'])
    pg.click('#fs-save'); pg.wait_for_timeout(600)
    a = rec(pg, 'fs', 'F1.S01T01')
    check('G4 grams stored as kg (1.2 kg, meals 0.5/0.5/0.2)', a and a['kg'] == 1.2 and a['meals'] == {'7': 0.5, '9:30': 0.5, '12:30': 0.2}, a)
    m = rec(pg, 'fsm', 'F1.S01T01'); m2 = rec(pg, 'fsm', 'F1.S02T01')
    check('G5 dead "6+1" saved as 7, as written', m and m['count'] == 7 and m['countRaw'] == '6+1', m)
    check('G5 Arabic digits "٢+١" understood (3)', m2 and m2['count'] == 3, m2)
    b = rec(pg, 'fs', 'F1.S02T01')
    check('G6 X in one meal: that meal skipped, others summed (2.0 kg)', b and b['kg'] == 2 and b['meals'].get('9:30') == 'x', b)
    c = rec(pg, 'fs', 'F1.S01T02')
    check('G7 whole day X → a "not fed" record (kg 0, fasted), no size needed', c and c['kg'] == 0 and c.get('fasted') is True, c)
    check('G7 not-fed day does not touch feed stock or totals', pg.evaluate("getTX().filter(t=>t.type==='feeding'&&t.date===daToday()).reduce((s,t)=>s+(+t.kg||0),0)") == 3.2)
    pg.evaluate("show('feed-sheet',true)"); pg.wait_for_timeout(300)
    i = ri(pg, '1.1'); k = ri(pg, '1.2')
    check('G8 re-opened sheet shows it as written: grams, 6+1, X', pg.input_value(f'#fs-{i}-m0') == '500' and pg.input_value(f'#fs-{i}-d') == '6+1' and pg.input_value(f'#fs-{k}-m1') == 'X')
    for bad in ['abc', '2+', '1..2']:
        pg.fill(f'#fs-{i}-d' if '+' in bad else f'#fs-{i}-m0', bad); pg.click('#fs-save'); pg.wait_for_timeout(200)
        pg.fill(f'#fs-{i}-d', '6+1'); pg.fill(f'#fs-{i}-m0', '500')
    check('G9 unreadable values are refused (abc, 2+, 1..2)', rec(pg, 'fs', 'F1.S01T01')['kg'] == 1.2 and rec(pg, 'fsm', 'F1.S01T01')['count'] == 7)
    pg.fill(f'#fs-{k}-m0', '0.4'); pg.fill(f'#fs-{k}-m1', ''); pg.fill(f'#fs-{k}-m2', ''); pg.fill(f'#fs-{k}-sz', '2'); pg.click('#fs-save'); pg.wait_for_timeout(300)
    c0 = rec(pg, 'fs', 'F1.S01T02')
    check('G10 "0.4" in a grams table is refused (typed kilos by mistake), record kept', c0 and c0.get('fasted') and 'بالجرام' in pg.evaluate("(window.__toasts||[]).slice(-1)[0]||''"), c0)
    pg.fill(f'#fs-{k}-m0', '400'); pg.click('#fs-save'); pg.wait_for_timeout(500)
    c = rec(pg, 'fs', 'F1.S01T02')
    check('G10 not-fed day later corrected to fed → same record, fasted cleared', c and c['kg'] == 0.4 and not c.get('fasted') and len(pg.evaluate("getTX().filter(t=>t.id.indexOf('fs-F1.S01T02')===0)")) == 1, c)
    # weekly report: a recorded not-fed day is not "missing"
    pg.evaluate("() => { for(let n=1;n<=6;n++){ addTX({id:'fz'+n,type:'feeding',unit:'F1.S01T03',date:daAddDays(daToday(),-n),kg:0,fasted:true,meals:{'7':'x'},source:'sheet',_skipValidation:true}); } addTX({id:'fz0',type:'feeding',unit:'F1.S01T03',date:daToday(),kg:0,fasted:true,source:'sheet',_skipValidation:true}); }")
    d = pg.evaluate("daWeeklyData(daToday(),'F1')")
    check('G11 weekly report: not-fed days count as recorded, and are listed', all(x['unit'] != 'F1.S01T03' for x in d['missing']) and d['fasted'] >= 7 and 'من غير علف' in pg.evaluate("daWeeklyText(daWeeklyData(daToday(),'F1'))"), (d['missing'], d['fasted']))
    # FCR: a period half not-fed / half fed is still valid data
    pg.evaluate("""() => { const u='F1.S02T02', D1=daAddDays(daToday(),-30);
      addTX({id:'q1',type:'sampling',unit:u,date:D1,avgWt:400,_skipValidation:true}); addTX({id:'q2',type:'sampling',unit:u,date:daAddDays(D1,10),avgWt:430,_skipValidation:true});
      for(let n=1;n<=10;n++) addTX(n<=5 ? {id:'qf'+n,type:'feeding',unit:u,date:daAddDays(D1,n),kg:6,feed:'Grower 3mm',_skipValidation:true}
                                       : {id:'qf'+n,type:'feeding',unit:u,date:daAddDays(D1,n),kg:0,fasted:true,_skipValidation:true}); }""")
    iss = pg.evaluate("() => { const st=daFcrStages(); const p=daAllPeriods().find(p=>p.unit==='F1.S02T02'&&p.feed>0); return p && {fd:p.feedDays, days:p.days, issue:daPeriodIssue(p,st)}; }")
    check('G12 FCR: not-fed days count as recorded (period kept, not dropped as "missing feed")', iss and iss['fd'] == 10 and not (iss['issue'] or {}).get('drop'), iss)
    check('G13 no page errors', not pg._errs, pg._errs)
    ctx.close()
    fails = [r for r in RESULTS if not r[1]]
    for nm, ok, dt in RESULTS: print(('✅ ' if ok else '❌ ') + nm + ('' if ok else f'  → {str(dt)[:300]}'))
    print(f'\n{len(RESULTS)-len(fails)}/{len(RESULTS)} passed')
