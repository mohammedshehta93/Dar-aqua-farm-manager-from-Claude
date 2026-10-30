import os; os.environ['E2E_PORT'] = '8772'
from harness import *

def setup(p, extra=None):
    sb = MockSB()
    sb.add_user('admin@example.com','admin123',role='admin',uid='u-admin')
    sb.add_user('eng@example.com','eng12345',role='engineer')
    sb.add_user('worker@example.com','work123',role='worker')
    return sb

with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = setup(p)
    ctx, pg = new_page(p, sb)
    # P1 storage: seed 6000 legacy TX in localStorage, then migrate to IndexedDB
    pg.evaluate("""() => { const a=[]; for(let i=0;i<6000;i++) a.push({id:'seed-'+i,type:'feeding',date:'2025-0'+(1+i%9)+'-1'+(i%9),unit:'F1.S02T01',kg:0.5,feed:'seed'});
                    localStorage.setItem('daracqua_transactions_v1', JSON.stringify(a)); localStorage.setItem('daracqua_tenant','farm-main'); }""")
    pg.reload(); pg.wait_for_timeout(900); hook_toasts(pg)
    login(pg, 'worker@example.com', 'work123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    check('P1 6000 legacy TX migrated (no 5000 cap)', pg.evaluate("() => getTX().filter(t=>t.id.startsWith('seed-')).length") == 6000)
    check('P1 localStorage freed after move to IndexedDB', pg.evaluate("() => localStorage.getItem('daracqua_transactions_v1')") is None)
    # P2 audit stamp + pending
    exp = pg.evaluate("() => daExpectedDailyFeed(daLiveMap()['F1.S01T01'])")
    pg.evaluate(f"addTX({{id:'w-ok',type:'feeding',source:'sheet',date:daToday(),unit:'F1.S01T01',kg:{round(exp/3,2)},meal:'صباح'}})"); pg.wait_for_timeout(300)
    t = pg.evaluate("() => getTX().find(t=>t.id==='w-ok')")
    check('P2 TX stamped with user/role/time', t and t.get('by') == 'worker@example.com' and t.get('byRole') == 'worker' and t.get('at'), t)
    check('P2 worker entry pending review', t and t.get('status') == 'pending')
    pg.reload(); pg.wait_for_timeout(1200)
    check('P1 data survives reload from IndexedDB', pg.evaluate("() => getTX().some(t=>t.id==='w-ok') && getTX().length>=6001"))
    hook_toasts(pg)
    # P3 block impossible mortality
    pg.evaluate("addTX({id:'w-bad',type:'mortality',source:'sheet',date:daToday(),unit:'F1.S01T01',count:999999,cause:'x'})"); pg.wait_for_timeout(400)
    check('P3 impossible mortality blocked with modal', pg.is_visible('#tx-review-modal') and '⛔' in pg.inner_text('#tx-review-modal'))
    check('P3 blocked TX not saved', not pg.evaluate("() => getTX().some(t=>t.id==='w-bad')"))
    pg.click('#txr-cancel')
    # P4 warn on 3x feed, save anyway → flagged
    pg.evaluate(f"addTX({{id:'w-big',type:'feeding',source:'sheet',date:daToday(),unit:'F1.S01T01',kg:{round(exp*3+1,2)},meal:'ظهر'}})"); pg.wait_for_timeout(400)
    check('P4 overfeeding warning shown', pg.is_visible('#txr-save') and 'ضعف المتوقع' in pg.inner_text('#tx-review-modal'))
    pg.click('#txr-save'); pg.wait_for_timeout(300)
    t = pg.evaluate("() => getTX().find(t=>t.id==='w-big')")
    check('P4 saved as flagged after confirmation', t and t.get('flagged') is True and t.get('flagMsg'))
    # P5 future date
    pg.evaluate("addTX({id:'w-fut',type:'sampling',date:daAddDays(daToday(),10),unit:'F1.S01T01',avgWt:280})"); pg.wait_for_timeout(400)
    check('P5 future date blocked', 'المستقبل' in pg.inner_text('#tx-review-modal') and not pg.evaluate("() => getTX().some(t=>t.id==='w-fut')"))
    pg.click('#txr-cancel')
    # P7a worker cannot delete
    pg.evaluate("deleteTX('w-ok')"); pg.wait_for_timeout(200)
    check('P7 worker delete refused', pg.evaluate("() => getTX().some(t=>t.id==='w-ok')") and 'الحذف' in toasts(pg))
    vv = visible_views(pg)
    check('P16 worker cannot see review/RAS/health/planning', not any(x in vv for x in ['review-queue','ras-load','health','feed-forecast','audit-log']), vv)
    pg.evaluate("doLogout(true)"); pg.wait_for_timeout(400)
    # P6 engineer reviews
    login(pg, 'eng@example.com', 'eng12345'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000); pg.wait_for_timeout(500)
    vv = visible_views(pg)
    check('P16 engineer sees review/health/RAS', all(x in vv for x in ['review-queue','health','ras-load']), vv)
    badge = pg.inner_text('.sidebar [data-v="review-queue"]')
    check('P6 review badge shows count', '2' in badge, badge)
    pg.evaluate("show('review-queue')"); pg.wait_for_timeout(300)
    items = pg.evaluate("() => window._rqItems.map(t=>t.id)")
    i_big = items.index('w-big')
    pg.fill(f'#rq-{i_big}', '5.5'); pg.evaluate(f"rqApprove({i_big})"); pg.wait_for_timeout(300)
    t = pg.evaluate("() => getTX().find(t=>t.id==='w-big')")
    check('P6 engineer edit + approve recorded', t['kg'] == 5.5 and t['reviewedBy'] == 'eng@example.com' and t['history'][0]['f'] == 'kg', t.get('history'))
    check('P6 approved item leaves queue', 'w-big' not in pg.evaluate("() => window._rqItems.map(t=>t.id)"))
    # P7b engineer deletes → logged
    pg.evaluate("deleteTX('w-ok')"); pg.wait_for_timeout(200)
    pg.evaluate("show('audit-log')"); pg.wait_for_timeout(300)
    check('P7 engineer delete works + logged', not pg.evaluate("() => getTX().some(t=>t.id==='w-ok')") and 'آخر عمليات الحذف' in content(pg))
    check('P15 audit log shows who entered', 'worker' in content(pg))
    pg.evaluate("doLogout(true)"); pg.wait_for_timeout(300)

    # admin: inventory, RAS, planning, health, traceability, realtime, all views
    login(pg, 'admin@example.com', 'admin123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000); pg.wait_for_timeout(500)
    pg.evaluate("""() => { addFeedInv({id:'inv-g3',feedType:'G3',kg:100,txType:'purchase',date:daAddDays(daToday(),-1)});
                           addFeedInv({id:'inv-old',feedType:'G3',kg:-10,txType:'usage',date:daToday()});
                           addTX({id:'f-g3',type:'feeding',date:daToday(),unit:'F1.S01T01',kg:10,feed:'G3',_skipValidation:true}); }""")
    check('P8 feeding reduces stock (100 − 10 = 90)', abs(pg.evaluate("() => getFeedBalance('G3')") - 90) < 0.01, pg.evaluate("() => getFeedBalance('G3')"))
    pg.evaluate("localStorage.setItem('daracqua_ras_v1', JSON.stringify({protein:32,o2:0.45,capacity:{F1:50}}))")
    pg.evaluate("show('ras-load')"); pg.wait_for_timeout(300)
    ras = pg.evaluate("() => daRasCompute(14).find(f=>f.farm==='F1')")
    check('P9 RAS numbers computed', ras and ras['tan'] > 0 and ras['o2'] > ras['o2fish'] and ras['bicarb'] > 0 and 'TAN' in content(pg), ras and {k: round(ras[k],2) for k in ['feed','tan','o2','bicarb','loadPct']})
    check('P9 filter overload → smart alert', pg.evaluate("() => generateAlerts().some(a=>a.title.includes('الفلتر'))"))
    pg.evaluate("show('feed-forecast')"); pg.wait_for_timeout(400)
    ff = pg.evaluate("() => daFeedForecast().map(b=>({l:b.label,t:Math.round(b.total)}))")
    check('P10 feed forecast per pellet size', sum(b['t'] for b in ff) > 0 and 'أمر' in content(pg), ff)
    pg.evaluate("localStorage.setItem('daracqua_plan_v1', JSON.stringify({weekly:999999}))")
    pg.evaluate("show('supply-plan')"); pg.wait_for_timeout(400)
    sp = pg.evaluate("() => daSupplyPlan(daPlanCfg())")
    check('P11 supply plan: growth days + stocking suggestions', 120 < sp['growDays'] < 500 and len(sp['sugg']) > 0 and ('خزّن' in content(pg) or 'متأخر' in content(pg)), sp['growDays'])
    pg.evaluate("addTX({id:'trt1',type:'treatment',date:daToday(),unit:'F1.S01T01',product:'OTC',withdrawalDays:10})")
    check('P12 withdrawal active', pg.evaluate("() => !!getActiveWithdrawal('F1.S01T01')"))
    pg.evaluate("addTX({id:'hv1',type:'harvesting',date:daToday(),unit:'F1.S01T01',fishNo:10,kg:4})"); pg.wait_for_timeout(400)
    check('P12 harvest blocked during withdrawal', 'سحب' in pg.inner_text('#tx-review-modal') and not pg.evaluate("() => getTX().some(t=>t.id==='hv1')"))
    pg.click('#txr-cancel')
    pg.evaluate("window._trUnit='F1.S01T01'; show('traceability')"); pg.wait_for_timeout(300)
    check('P13 traceability timeline incl. treatment + who', 'الخط الزمني' in content(pg) and 'OTC' in content(pg) and 'فترة سحب' in content(pg))
    # P17 realtime picks up edits from another device
    pg.evaluate("""() => { stopRealtimeSync(); const si=window.setInterval; window.setInterval=function(f){ window.__rt=f; return si(function(){},9e8); };
                           startRealtimeSync(); window.setInterval=si; }""")
    base = pg.evaluate("() => getTX().find(t=>t.id==='f-g3')")
    # another device uploads an edit + a new entry (the server stamps synced_at, like the real database)
    for d in [dict(base, kg=7.0, ts='2099-01-01T00:00:00Z'), {'id':'remote-1','type':'feeding','date':'2026-10-25','unit':'F1.S01T02','kg':2,'ts':'2099-01-01T00:00:00Z'}]:
        sb.tx[d['id']] = {'id':d['id'],'farm_id':'farm-main','type':d['type'],'unit':d['unit'],'data':d,'synced_at':'2099-01-01T00:00:00.000000Z'}
    pg.evaluate("() => window.__rt()"); pg.wait_for_timeout(600)
    check('P17 edits + new TX from other devices merged', pg.evaluate("() => getTX().find(t=>t.id==='f-g3').kg===7 && getTX().some(t=>t.id==='remote-1')"))
    sb.ts_rows = []
    pg._errs.clear()
    bad = pg.evaluate("() => { const o=[]; Object.keys(VIEWS).forEach(v=>{ try{ show(v); }catch(e){ o.push(v+': '+e.message); } }); return o; }")
    pg.wait_for_timeout(600)
    check('P14 all '+str(pg.evaluate('() => Object.keys(VIEWS).length'))+' views render', not bad, bad[:5])
    check('P14 no uncaught JS errors', not pg._errs, pg._errs[:5])
    ctx.close()

srv.shutdown()
passed = sum(1 for _,ok,_ in RESULTS if ok)
for n,ok,d in RESULTS: print(('✅ ' if ok else '❌ ')+n+('' if ok or not d else f'   → {d}'))
print(f'\n{passed}/{len(RESULTS)} passed')
