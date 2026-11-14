# Audit: every page × account type × language — page errors, "could not show this page" screens, sideways overflow
# on a phone, slow pages. Run: APP_ROOT=. python3 dev/tests/audit_crawl.py   (writes /tmp/crawl.json)
import os, sys, json, time; os.environ['E2E_PORT'] = os.environ.get('E2E_PORT', '8889')
sys.path.insert(0, os.path.dirname(__file__))
import harness
harness.DEFAULT_UNITS[:] = [(f'F1.S{s:02d}T{t:02d}', 500, 100) for s in (1, 2) for t in range(1, 5)] + [(f'F2.S{s:02d}T{t:02d}', 1500, 50) for s in (1, 4) for t in range(1, 4)]
from harness import *
SEED = """() => { const T=daToday(), Y=daAddDays(T,-1), W=daAddDays(T,-7);
  localStorage.setItem(DA_FEATURES_KEY, JSON.stringify({maint:true, purchases:true, stock:true}));
  const us=_txLiveRows().map(r=>r.unit).slice(0,6);
  us.forEach((u,i)=>{ addTX({id:'af'+i,type:'feeding',unit:u,date:Y,kg:2,size:'2',source:'sheet',_skipValidation:true}); addTX({id:'am'+i,type:'mortality',unit:u,date:Y,count:1,source:'sheet',_skipValidation:true}); });
  addTX({id:'as1',type:'sampling',unit:us[0],date:W,avgWt:90,sampleN:20,_skipValidation:true});
  addTX({id:'aw1',type:'water_quality',unit:'F1.S01',scope:'section',date:Y,temp:28,ph:7.2,do:6,_skipValidation:true});
  addTX({id:'wo1',type:'work_order',date:T,unit:'',farm:'F1',kind:'nofeed',tanks:[us[1]],text:'x',status:'open',_skipValidation:true});
  addTX({id:'pr1',type:'purchase',unit:'',date:T,ref:'PR-1',item:'Net',qty:2,unitName:'pcs',status:'requested',_skipValidation:true});
  addTX({id:'sc1',type:'stock_count',unit:'',farm:'F1',date:W,items:{c1:10},status:'ok',_skipValidation:true});
  setTxUnit && setTxUnit(us[0]); _dataVer++; }"""
OUT = []
with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin'); sb.add_user('eng@example.com', 'eng123', role='engineer')
    sb.add_user('w@workers.dar-aqua.app', 'work123', role='worker', perms=['input_feeding', 'input_mortality', 'input_wq', 'input_sampling', 'input_harvest', 'report_fault', 'stock_count', 'farm:F1'])
    sb.add_user('tech@workers.dar-aqua.app', 'tech123', role='worker', perms=['fix_maint'])
    for who, pw_, langs, vp in [('admin@example.com', 'admin123', ['ar', 'en'], (1280, 900)), ('eng@example.com', 'eng123', ['ar'], (1280, 900)),
                                ('w@workers.dar-aqua.app', 'work123', ['ar', 'en', 'ur'], (390, 844)), ('tech@workers.dar-aqua.app', 'tech123', ['ur'], (390, 844))]:
        ctx, pg = new_page(p, sb); pg.set_viewport_size({'width': vp[0], 'height': vp[1]})
        pg.route('**/rest/v1/maintenance_requests*', lambda r: r.fulfill(status=200, body='[]', headers={'Content-Type': 'application/json'}))
        pg.route('**/farm-push.mohammedshehta86.workers.dev/**', lambda r: r.fulfill(status=200, body='{}', headers={'Access-Control-Allow-Origin': '*'}))
        pg.on('dialog', lambda d: d.dismiss())
        login(pg, who, pw_); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=15000); pg.evaluate(SEED); pg.wait_for_timeout(300)
        views = pg.evaluate("Object.keys(VIEWS).filter(v => typeof VIEWS[v] === 'function' && canAccessView(v))")
        for lang in langs:
            if lang != 'ar': pg.evaluate(f"(typeof daLangPick==='function' && currentUserRole==='worker') ? daLangPick('{lang}') : (isAr !== ({'true' if lang=='ar' else 'false'}) && toggleLang(true))"); pg.wait_for_timeout(300)
            for v in views:
                e0 = len(pg._errs); t0 = time.time()
                try: pg.evaluate(f"show('{v}', true)"); pg.wait_for_timeout(120)
                except Exception as ex: OUT.append({'who': who, 'lang': lang, 'view': v, 'issue': 'exception ' + str(ex)[:120]}); continue
                ms = int((time.time() - t0) * 1000) - 120
                r = pg.evaluate("""() => { const c=document.getElementById('content'); const t=c?c.innerText:''; return {broken:/حصلت مشكلة في عرض|could not show this page|Something went wrong/i.test(t),
                  overflow: document.documentElement.scrollWidth - window.innerWidth, empty: t.trim().length < 15}; }""")
                errs = pg._errs[e0:]
                if errs or r['broken'] or (vp[0] < 500 and r['overflow'] > 8) or r['empty'] or ms > 1500:
                    OUT.append({'who': who.split('@')[0], 'lang': lang, 'view': v, 'broken': r['broken'], 'overflow': r['overflow'], 'empty': r['empty'], 'ms': ms, 'errs': [str(x)[:160] for x in errs[:2]]})
            OUT.append({'who': who.split('@')[0], 'lang': lang, 'checked': len(views)})
        ctx.close()
json.dump(OUT, open('/tmp/crawl.json', 'w'), ensure_ascii=False, indent=0)
print('checked:', [(o['who'], o['lang'], o['checked']) for o in OUT if 'checked' in o]); print('issues:', len([o for o in OUT if 'checked' not in o]))
for o in [o for o in OUT if 'checked' not in o][:40]: print(o)
