# Optional farm production plan: batches through stages, goal mode, capacity, plan vs actual, advisory alerts.
import os, sys, math; os.environ['E2E_PORT'] = '8815'
sys.path.insert(0, os.path.dirname(__file__))
import harness
harness.DEFAULT_UNITS[:] = [(f'F2.S0{s}T0{t}', 0, 0) for s in (1, 4) for t in (1, 2)] + [('F2.S06T01', 0, 0), ('F2.S06T02', 0, 0)]
from harness import *

def sim(w, n, target, tgc=1.8, T=28, until=(50, 150), days=400):
    st, ev = 0, []
    for d in range(days + 1):
        if d > 0: w = (w ** (1/3) + tgc * T / 1000) ** 3
        while st < len(until) and w >= until[st]: st += 1; ev.append(('move', d))
        if w >= target: ev.append(('harvest', d, n * w / 1000)); break
    return ev

with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin')
    ctx, pg = new_page(p, sb)
    login(pg, 'admin@example.com', 'admin123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    pg.evaluate("RAW.forEach(r=>{ r.volume = /S0[14]/.test(r.unit) ? 10 : 117; }); _dataVer++; window._pl={farm:'F2'}; show('farm-plan')"); pg.wait_for_timeout(400)
    items = pg.evaluate("() => DA_NAV.find(g=>g.id==='prod').items.map(i=>i[0])")
    check('P1 "خطة المزرعة" first in the production menu', items[0] == 'farm-plan', items)
    check('P1 empty plan explains itself, nothing required', 'ضيف دفعة' in content(pg) and not pg._errs)
    pg.evaluate("document.querySelector('#content details').open=true")
    pg.fill('#pl-stages', '1-3 = تحضين | 50\n4-5 = وسط | 150\n6- = تسمين'); pg.evaluate("daPlanSaveStages()"); pg.wait_for_timeout(300)
    caps = pg.evaluate("daPlanRun('F2').caps")
    check('P2 path saved; capacity per stage = volume × density warning limit (15)', [c['kg'] for c in caps] == [300, 300, 3510], caps)
    d0 = pg.evaluate("daAddDays(daToday(),10)")
    pg.fill('#pl-name', 'B-11'); pg.fill('#pl-date', d0); pg.fill('#pl-count', '10000'); pg.fill('#pl-wt', '5'); pg.fill('#pl-target', '450'); pg.evaluate("daPlanAdd()"); pg.wait_for_timeout(300)
    S = pg.evaluate("(() => { const S=daPlanRun('F2').sims[0]; return {ev:S.ev.map(e=>[e.type,e.d,e.kg||0]), B:daPlanRun('F2').B}; })()")
    exp = sim(5, 10000, 450)
    got = [(e[0], e[1]) for e in S['ev']]; expd = [(e[0], e[1]) for e in exp]
    check(f'P3 transfer + harvest days match an independent calculation {expd}', got == expd and abs(S['ev'][-1][2] - exp[-1][2]) < 1e-6, (got, expd, S['B']))
    over = pg.evaluate("daPlanRun('F2').over")
    check('P4 10,000 fish outgrow the nursery capacity → flagged with a date', any(o['st'] in (0, 1) for o in over), over)
    pg.evaluate("show('farm-plan',true)"); pg.wait_for_timeout(300)
    check('P4 shown in "upcoming" on the page', 'مش هتكفي' in content(pg))
    # goal mode
    pg.fill('#pl-gkg', '5000'); pg.fill('#pl-gwt', '5'); pg.fill('#pl-gtarget', '450'); pg.evaluate("daPlanSaveGoal()"); pg.wait_for_timeout(300)
    G = pg.evaluate("(() => { const p=daPlanOf('F2'); return daPlanGoal('F2',p.goal,daPlanBasis('F2'),p); })()")
    check('P5 goal: 5,000 kg/month at 450 g → stock ceil(5000/0.45/survival) fish per month', G['perMonth'] == math.ceil(5000 / 0.45 / 1 / 100) * 100 and G['days'] == exp[-1][1], G)
    n0 = pg.evaluate("daPlanOf('F2').batches.length"); pg.click('#pl-gadd-0'); pg.wait_for_timeout(300)
    check('P5 a suggested stocking can be added to the plan with one click', pg.evaluate("daPlanOf('F2').batches.length") == n0 + 1)
    # plan vs actual — automatic, never required
    pg.evaluate(f"addTX({{id:'stk1',type:'stocking',unit:'F2.S01T01',date:daAddDays('{d0}',3),fishNo:4500,avgWt:5.2,batch:'B-11',_skipValidation:true}}); addTX({{id:'stk2',type:'stocking',unit:'F2.S01T02',date:daAddDays('{d0}',2),fishNo:4600,avgWt:4.8,batch:'B-11',_skipValidation:true}}); show('farm-plan',true)"); pg.wait_for_timeout(300)
    A = pg.evaluate("daPlanActual('F2', daPlanOf('F2').batches.find(b=>b.name==='B-11'))")
    check('P6 real stocking linked to the batch by its name (no manual linking)', A and A['by'] == 'name' and A['n'] == 9100, A)
    check('P6 difference from plan shown (−9%)', '✔ 9,100' in content(pg))
    # advisory alerts
    pg.evaluate("(() => { const p=daPlanOf('F2'); p.batches.push({name:'B-soon',date:daAddDays(daToday(),-200),count:1000,wt:5,target:450}); daPlanSave('F2',p); })()")
    al = pg.evaluate("generateAlerts().filter(a=>a.icon==='🗓️').map(a=>[a.level,a.title])")
    check('P7 plan alerts are advisory (info / warn), never critical', al and all(a[0] in ('info', 'warn') for a in al), al)
    feed = pg.evaluate("daPlanRun('F2').feed")
    check('P8 weekly feed of the plan by pellet size', any(any(k in f for k in ('1', '2', '3')) for f in feed), feed[:2])
    # optional: no plan → everything still works; deleting a batch never touches real records
    pg.once('dialog', lambda d: d.accept()); pg.evaluate("show('farm-plan',true)"); pg.wait_for_timeout(200)
    nt = pg.evaluate("getTX().length"); pg.evaluate("localStorage.removeItem(DA_PLAN_FKEY); _dataVer++")
    check('P9 without a plan: no plan alerts, records untouched', not [a for a in pg.evaluate("generateAlerts()") if a.get('icon') == '🗓️'] and pg.evaluate("getTX().length") == nt)
    check('P9 stocking without any plan is accepted as always', pg.evaluate("(() => { const n=getTX().length; addTX({id:'stk9',type:'stocking',unit:'F2.S06T01',date:daToday(),fishNo:100,avgWt:200,_skipValidation:true}); return getTX().length===n+1; })()"))
    check('P10 plan stored in a synced key', pg.evaluate("daIsSyncedKey(DA_PLAN_FKEY)"))
    check('P11 no page errors', not pg._errs, pg._errs)
    ctx.close()
    fails = [r for r in RESULTS if not r[1]]
    for nm, ok, dt in RESULTS: print(('✅ ' if ok else '❌ ') + nm + ('' if ok else f'  → {str(dt)[:300]}'))
    print(f'\n{len(RESULTS)-len(fails)}/{len(RESULTS)} passed')
