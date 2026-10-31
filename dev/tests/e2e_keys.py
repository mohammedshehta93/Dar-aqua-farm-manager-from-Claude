# Excel-like keyboard navigation in entry tables (owner request 2026-10-31).
import os; os.environ['E2E_PORT'] = '8814'
from harness import *
def at(pg): return pg.evaluate("document.activeElement && document.activeElement.id")

with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin')
    ctx, pg = new_page(p, sb)
    login(pg, 'admin@example.com', 'admin123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    pg.evaluate("""() => { addTX({id:'hv',type:'harvesting',unit:'F1.S02T01',date:daAddDays(daToday(),-1),fishNo:881,kg:100,_skipValidation:true});
      localStorage.setItem(DA_SHEET_KEY, JSON.stringify({F1:[{from:1,to:1,meals:['7','10','1']},{from:2,to:9,meals:['8','12']}]})); window._fs={farm:'F1'}; show('feed-sheet'); }""")
    pg.wait_for_timeout(400)
    ix = pg.evaluate("Object.fromEntries(window._fs.rows.map(r=>[r.no.label,r.i]))")
    pg.focus(f"#fs-{ix['1.1']}-m1"); pg.keyboard.press('ArrowDown')
    check('K1 ↓ = same column, next row', at(pg) == f"fs-{ix['1.2']}-m1", at(pg))
    pg.keyboard.press('Enter')
    check('K2 Enter = down like Excel', at(pg) == f"fs-{ix['1.3']}-m1", at(pg))
    pg.keyboard.press('ArrowDown')
    check('K3 ↓ continues into the next group table, skipping the locked (empty) tank', at(pg) == f"fs-{ix['2.2']}-m1", at(pg))
    pg.keyboard.press('ArrowUp'); pg.keyboard.press('ArrowUp')
    check('K4 ↑ goes back up across tables (skips locked rows)', at(pg) == f"fs-{ix['1.2']}-m1", at(pg))
    pg.keyboard.press('ArrowRight')
    check('K5 → = next cell to the right (sheet tables run left-to-right like the paper)', at(pg) == f"fs-{ix['1.2']}-m2", at(pg))
    pg.keyboard.press('ArrowLeft'); pg.keyboard.press('ArrowLeft')
    check('K5 ← = cell to the left', at(pg) == f"fs-{ix['1.2']}-m0", at(pg))
    pg.keyboard.type('12.5'); pg.keyboard.press('ArrowLeft')
    check('K6 inside a number being typed, ← moves the caret first (stays in the cell)', at(pg) == f"fs-{ix['1.2']}-m0", at(pg))
    pg.keyboard.press('End'); pg.keyboard.press('ArrowRight')
    check('K6 …and at the end of the text → moves to the next cell', at(pg) == f"fs-{ix['1.2']}-m1", at(pg))
    check('K7 the reached cell is selected (type over it)', pg.evaluate("(() => { const e=document.activeElement; return e.selectionStart===0 && e.selectionEnd===e.value.length; })()"))
    # water sheet: number inputs — arrows never change the value
    pg.evaluate("window._wqs={farm:'F1'}; show('wq-sheet')"); pg.wait_for_timeout(300)
    pg.fill('#wqs-0-temp', '28.5'); pg.focus('#wqs-0-temp'); pg.keyboard.press('ArrowDown')
    check('K8 testing log: ↓ to the next section; the number was not changed by the arrow', at(pg) == 'wqs-1-temp' and pg.input_value('#wqs-0-temp') == '28.5', (at(pg), pg.input_value('#wqs-0-temp')))
    pg.keyboard.press('ArrowRight')
    check('K8 → to pH', at(pg) == 'wqs-1-ph', at(pg))
    # weekly NH3/NO2 table in the twin page
    pg.evaluate("window._tw={farm:'F1',days:60,feedPct:100,dT:0}; show('twin')"); pg.wait_for_timeout(400)
    if pg.evaluate("!!document.getElementById('tw-nh-0') && !!document.getElementById('tw-nh-1')"):
        pg.focus('#tw-nh-0'); pg.keyboard.press('ArrowDown'); a = at(pg); pg.keyboard.press('ArrowRight')
        check('K9 weekly ammonia table: ↓ next section, → nitrite', a == 'tw-nh-1' and at(pg) == 'tw-no-1', (a, at(pg)))
    check('K10 no page errors', not pg._errs, pg._errs)
    ctx.close()
    fails = [r for r in RESULTS if not r[1]]
    for nm, ok, dt in RESULTS: print(('✅ ' if ok else '❌ ') + nm + ('' if ok else f'  → {str(dt)[:300]}'))
    print(f'\n{len(RESULTS)-len(fails)}/{len(RESULTS)} passed')
