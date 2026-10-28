import os; os.environ['E2E_PORT'] = '8793'
from harness import *

def first_num(pg):  # first numeric data field on the active page
    return pg.evaluate("() => { const i=[...document.querySelectorAll('#content input[type=number]')].find(x=>x.offsetParent!==null&&!x.disabled); if(!i) return null; i.id=i.id||'__t'+Math.random().toString(36).slice(2); return '#'+CSS.escape(i.id); }")
def tabs(pg): return pg.evaluate("() => DA_TABS.map(t=>({v:t.v,dirty:t.dirty}))")
def bar(pg): return pg.evaluate("() => [...document.querySelectorAll('#da-tabbar .dt')].map(d=>({v:d.dataset.tab,on:d.classList.contains('on'),dot:!!d.querySelector('.dt-dot'),x:!!d.querySelector('.dt-x')}))")

with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin'); sb.add_user('worker@example.com', 'work123', role='worker')
    ctx, pg = new_page(p, sb)
    login(pg, 'admin@example.com', 'admin123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    home = pg.evaluate("homeView()")
    pg.evaluate("show('quick-feed')"); pg.wait_for_timeout(300)
    b = bar(pg)
    check('T1 opening a page adds a tab; home tab pinned (no ×)', any(x['v'] == 'quick-feed' and x['on'] and x['x'] for x in b) and any(x['v'] == home and not x['x'] for x in b), b)
    sel = first_num(pg); pg.fill(sel, '37'); pg.wait_for_timeout(100)
    check('T2 typing marks the tab dirty (●)', any(x['v'] == 'quick-feed' and x['dot'] for x in bar(pg)), bar(pg))
    pg.evaluate("show('tx-mortality')"); pg.wait_for_timeout(300)
    sel2 = first_num(pg); pg.fill(sel2, '4')
    check('T3 only the active page is in the document (no duplicate ids)', pg.evaluate("document.querySelectorAll('#content .da-pane').length") == 1)
    pg.click('#da-tabbar .dt[data-tab="quick-feed"]'); pg.wait_for_timeout(300)
    check('T4 back to the first tab: typed value still there', pg.input_value(sel) == '37')
    pg.click('#da-tabbar .dt[data-tab="tx-mortality"]'); pg.wait_for_timeout(300)
    check('T4 second tab kept its value too', pg.input_value(sel2) == '4')
    pg.evaluate("show('dashboard')"); pg.wait_for_timeout(200); pg.evaluate("show('quick-feed')"); pg.wait_for_timeout(300)
    check('T5 re-opening an unsaved page from the menu keeps the input', pg.input_value(sel) == '37')
    # background refreshes must not wipe unsaved input
    pg.evaluate("show('feed-week')"); pg.wait_for_timeout(400)
    fw = first_num(pg); pg.fill(fw, '12.5')
    pg.evaluate("_dataVer++; daBgRefresh('feed-week')"); pg.wait_for_timeout(300)
    check('T6 auto-refresh / other user\'s entry does not wipe unsaved grid', pg.input_value(fw) == '12.5')
    pg.evaluate("addTX({id:'tb-1',type:'feeding',unit:'F1.S01T01',date:daToday(),kg:5,_skipValidation:true})"); pg.wait_for_timeout(200)
    check('T7 a real save clears the dirty mark', not [t for t in tabs(pg) if t['v'] == 'feed-week' and t['dirty']], tabs(pg))
    pg.evaluate("daBgRefresh('feed-week')"); pg.wait_for_timeout(300)
    check('T7 saved page refreshes normally again', pg.evaluate("document.querySelectorAll('#content .da-pane').length") == 1 and not pg._errs)
    # non-dirty tab re-opened from the menu shows fresh data
    pg.evaluate("show('traceability')"); pg.wait_for_timeout(200)
    pg.evaluate("window._trUnit='F1.S01T02'; show('dashboard'); show('traceability')"); pg.wait_for_timeout(300)
    check('T8 clean tab re-opened from the menu is re-rendered (parameters/data fresh)', 'F1.S01T02' in content(pg))
    # typing in search/date/select does not count as unsaved data
    pg.evaluate("show('audit-log')"); pg.wait_for_timeout(300)
    pg.evaluate("() => { const d=document.querySelector('#content input[type=date]'); if(d){ d.value='2026-01-01'; d.dispatchEvent(new Event('input',{bubbles:true})); } const s=document.createElement('input'); s.type='text'; s.placeholder='بحث'; document.querySelector('#content .da-pane').appendChild(s); s.value='x'; s.dispatchEvent(new Event('input',{bubbles:true})); }")
    check('T9 date / search boxes do not mark a tab dirty', not [t for t in tabs(pg) if t['v'] == 'audit-log' and t['dirty']])
    # closing
    pg.click('#da-tabbar .dt[data-tab="quick-feed"]'); pg.wait_for_timeout(200)
    pg.once('dialog', lambda d: d.dismiss()); pg.click('#da-tabbar .dt[data-tab="quick-feed"] .dt-x'); pg.wait_for_timeout(200)
    check('T10 closing an unsaved tab asks; "cancel" keeps it', any(t['v'] == 'quick-feed' for t in tabs(pg)) and pg.input_value(sel) == '37')
    msg = []
    pg.once('dialog', lambda d: (msg.append(d.message), d.accept())); pg.click('#da-tabbar .dt[data-tab="quick-feed"] .dt-x'); pg.wait_for_timeout(300)
    check('T10 confirm names the page; "ok" closes it and moves to another tab', msg and 'متحفظتش' in msg[0] and not any(t['v'] == 'quick-feed' for t in tabs(pg)) and pg.evaluate("currentView") != 'quick-feed', (msg, pg.evaluate("currentView")))
    pg.click('#da-tabbar .dt[data-tab="audit-log"] .dt-x'); pg.wait_for_timeout(200)
    check('T11 a clean tab closes without asking', not any(t['v'] == 'audit-log' for t in tabs(pg)))
    check('T12 leaving the site with unsaved tabs triggers the browser warning', pg.evaluate("(() => { const e=new Event('beforeunload',{cancelable:true}); window.dispatchEvent(e); return e.defaultPrevented; })()"))
    # tab limit
    for v in ['site-overview', 'daily', 'tx-sampling', 'tx-feeding', 'tx-water-quality', 'mortality-analysis', 'harvest-planner', 'fcr-stage', 'weekly-report', 'smart', 'alarms', 'help']:
        pg.evaluate(f"show('{v}')"); pg.wait_for_timeout(60)
    tt = tabs(pg)
    check('T13 at most 10 tabs; tabs with unsaved input are never dropped', len(tt) <= 10 and any(t['v'] == 'tx-mortality' and t['dirty'] for t in tt), [t['v'] for t in tt])
    # logout: warns, then nothing carries over to the next user
    pg.once('dialog', lambda d: d.dismiss()); pg.evaluate("doLogout()"); pg.wait_for_timeout(400)
    check('T14 logout with unsaved tabs asks first; cancel stays logged in', pg.evaluate("!!currentUser"))
    pg.evaluate("doLogout(true)"); pg.wait_for_timeout(800)
    check('T15 logout clears all tabs', pg.evaluate("DA_TABS.length") == 0 and pg.evaluate("document.getElementById('da-tabbar').style.display") == 'none')
    check('T16 back button shows the page name, not its code', pg.evaluate("(document.getElementById('back-lbl')||{}).textContent||''") not in ('', 'fcr-stage', 'help', 'alarms') and not __import__('re').search(r'^[a-z-]+$', pg.evaluate("(document.getElementById('back-lbl')||{}).textContent||''")), pg.evaluate("(document.getElementById('back-lbl')||{}).textContent"))
    check('T16 no page errors (admin)', not pg._errs, pg._errs)
    login(pg, 'worker@example.com', 'work123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000); pg.wait_for_timeout(300)
    check('T15 next user sees none of the previous user\'s tabs', all(t['v'] != 'tx-mortality' for t in tabs(pg)) and '4' not in [pg.evaluate("(document.querySelector('#content input[type=number]')||{}).value||''")])
    ctx.close()

    # phone
    ctx = BROWSER.new_context(viewport={'width': 390, 'height': 800}); ctx.route('**/*', make_handler(sb)); pg = ctx.new_page(); pg._errs = []
    pg.on('pageerror', lambda e: pg._errs.append(str(e)))
    pg.goto(BASE); pg.wait_for_timeout(500); login(pg, 'worker@example.com', 'work123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    for v in ['quick-feed', 'tx-mortality', 'tx-sampling', 'feed-week']: pg.evaluate(f"show('{v}')"); pg.wait_for_timeout(100)
    m = pg.evaluate("(() => { const b=document.getElementById('da-tabbar'), r=b.querySelector('.dt-row'); return {vis:b.offsetHeight>0, scroll:r.scrollWidth>r.clientWidth, overflow:document.documentElement.scrollWidth>window.innerWidth+1}; })()")
    check('T17 phone: tab bar visible, scrolls sideways, page does not overflow', m['vis'] and m['scroll'] and not m['overflow'], m)
    pg.screenshot(path='/tmp/tabs_phone.png')
    check('T18 no page errors (phone)', not pg._errs, pg._errs)
    ctx.close()

    fails = [r for r in RESULTS if not r[1]]
    for nm, ok, dt in RESULTS: print(('✅ ' if ok else '❌ ') + nm + ('' if ok else f'  → {str(dt)[:300]}'))
    print(f'\n{len(RESULTS)-len(fails)}/{len(RESULTS)} passed')
