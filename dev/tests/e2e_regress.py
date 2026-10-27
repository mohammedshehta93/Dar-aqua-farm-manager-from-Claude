import os; os.environ['E2E_PORT'] = '8773'
from harness import *
with sync_playwright() as p:
    harness_browser[0] = p.chromium.launch()
    sb = MockSB(); sb.add_user('admin@example.com','admin123',role='admin',uid='u-admin')
    ctx, pg = new_page(p, sb)
    login(pg,'admin@example.com','admin123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000); pg.wait_for_timeout(600)
    pg.evaluate("() => { for(let i=0;i<300;i++) addTX({id:'r'+i,type:'feeding',date:daToday(),unit:'F1.S01T01',kg:0.1,feed:'x',_skipValidation:true}); }")
    n0 = pg.evaluate('() => getTX().length')
    pg.evaluate("() => { _txCache = null; addTX({id:'after-null',type:'feeding',date:daToday(),unit:'F1.S01T02',kg:0.1,_skipValidation:true}); }")
    check('R1 legacy "_txCache = null" no longer drops data', pg.evaluate('() => getTX().length') == n0 + 1, (n0, pg.evaluate('() => getTX().length')))
    pg.wait_for_timeout(500); pg.reload(); pg.wait_for_timeout(1200)
    check('R1 full dataset persisted after reload', pg.evaluate('() => getTX().length') == n0 + 1)
    pg.wait_for_timeout(1500)
    check('R2 all 300 reached the cloud (none lost, a reload mid-upload may resend a few)', all(1 <= sb.upserts.get('r%d'%i, 0) <= 2 for i in range(300)) and sum(1 for i in range(300) if 'r%d'%i in sb.tx) == 300, sorted(set(sb.upserts.values())))
    check('R2 no duplicate records anywhere', len([k for k in sb.tx if k.startswith('r')]) == 300 and pg.evaluate("() => getTX().filter(t => /^r\\d+$/.test(t.id)).length") == 300)
    ctx.close()
srv.shutdown()
for n,ok,d in RESULTS: print(('✅ ' if ok else '❌ ')+n+('' if ok or not d else f'   → {d}'))
