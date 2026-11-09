# Worker on a phone, in English: big page buttons, calm header, own name, English account page, clear date control.
import os, re; os.environ['E2E_PORT'] = '8834'
from harness import *
AR = re.compile(r'[\u0600-\u06FF]+')
def arabic(pg): return [w for w in AR.findall(pg.evaluate("(() => { const ok=e=>e.offsetParent!==null; let t=''; const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT); let n; while((n=w.nextNode())) if(n.parentElement && ok(n.parentElement)) t+=' '+n.nodeValue; document.querySelectorAll('input[placeholder]').forEach(i=>{ if(i.offsetParent!==null) t+=' '+i.placeholder; }); return t; })()")) if w != 'عربي']
with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('shamim@workers.dar-aqua.app', 'work123', role='worker', perms=['input_feeding', 'input_mortality', 'input_sampling', 'input_wq', 'input_harvest'])
    ctx, pg = new_page(p, sb); pg.set_viewport_size({'width': 390, 'height': 844})
    pg.evaluate("localStorage.setItem('da_lang','en')"); pg.reload(); pg.wait_for_timeout(500)
    login(pg, 'shamim@workers.dar-aqua.app', 'work123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000); pg.wait_for_timeout(400)
    bar = pg.evaluate("[...document.querySelectorAll('#da-wbar button')].map(b=>b.textContent.trim())")
    check('W1 big buttons for the worker\'s own pages (+ 🔄), in English', bar[:2] == ['📋 Feed', '🧪 Water'] and '❓ Guide' in bar and bar[-1] == '🔄' and '🎣 Harvest' in bar, bar)
    check('W1b the first page opened at login fills in by itself once the tanks arrive (farm chosen, tanks listed)', pg.evaluate("window._fs && window._fs.farm") in ('F1', 'F2') and pg.evaluate("(window._fs.rows||[]).length") > 0, pg.evaluate("[(window._fs||{}).farm, ((window._fs||{}).rows||[]).length]"))
    hid = pg.evaluate("['topnav','da-tabbar','farm-dd-wrap','back-btn'].map(id=>{const e=document.getElementById(id); return !e || e.offsetParent===null;})")
    check('W2 no menu / tab strip / farm picker / back button for the worker', all(hid), hid)
    check('W3 the user chip shows the worker\'s name', pg.inner_text('#user-badge').strip() == '👤 shamim', pg.inner_text('#user-badge'))
    check('W1c 🔄 always on screen (pinned) even when 6 page buttons scroll sideways', pg.evaluate("(() => { const r=document.querySelector('#da-wbar .rf').getBoundingClientRect(); return r.left>=0 && r.right<=392; })()"))
    check('W1d daily-total sheet: no repeated total column, the ✕ (not fed) button on screen', pg.evaluate("(() => { const s=document.querySelector('.fs-t.fs-tot .fs-sumh'); const x=document.querySelector('.fs-t .fs-x, .fs-t td:last-child button'); return (!s || s.offsetParent===null) && (!x || x.getBoundingClientRect().right<=392); })()"))
    hh = pg.evaluate("document.querySelector('header.top').getBoundingClientRect().height"); chips = pg.evaluate("[...document.querySelectorAll('header.top .top-right > *')].filter(e=>e.offsetParent!==null).map(e=>e.scrollWidth<=e.clientWidth+1)")
    check('W4 header: one row, nothing cut off', hh < 70 and all(chips), (hh, chips))
    pg.evaluate("show('account')"); pg.wait_for_timeout(400)
    check('W5 account page in English, no internal address, no password change (the admin handles passwords)', not arabic(pg) and 'workers.dar-aqua.app' not in content(pg) and 'Your permissions' in content(pg) and not pg.evaluate("[...document.querySelectorAll('#content input[type=password]')].some(i=>i.offsetParent!==null)"), arabic(pg)[:10])
    pg.click('#da-wbar button[data-v="feed-sheet"]'); pg.wait_for_timeout(400)
    lbl = pg.evaluate("document.querySelector('.da-dctl .lbl').textContent")
    check('W6 date in the app\'s language with (today)', re.match(r'^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) \d+ [A-Z][a-z]{2} 20\d\d \(today\)$', lbl) is not None, lbl)
    d0 = pg.evaluate("window._fs.date"); pg.click('.da-dctl button >> nth=0'); pg.wait_for_timeout(500)
    check('W7 ◀ goes to the previous day (sheet reloads for it); ▶ blocked after today', pg.evaluate("window._fs.date") == pg.evaluate(f"daAddDays('{d0}',-1)") and 'today' not in pg.evaluate("document.querySelector('.da-dctl .lbl').textContent"), pg.evaluate("window._fs.date"))
    pg.click('.da-dctl .today'); pg.wait_for_timeout(500)
    check('W8 Today brings it back', pg.evaluate("window._fs.date") == d0 and pg.evaluate("document.querySelector('.da-dctl button:nth-of-type(2)').disabled"))
    check('W9 feed sheet still all English', not arabic(pg), arabic(pg)[:10])
    for v in ['wq-sheet', 'tx-harvesting', 'tx-transfer', 'help']:
        pg.click(f'#da-wbar button[data-v="{v}"]'); pg.wait_for_timeout(400); left = arabic(pg)
        check(f'W10 {v}: English (left: {len(left)})', len(left) <= 2, left[:12])
    pg.click('#lang-btn'); pg.wait_for_timeout(150); pg.click('#da-langmenu button[data-l="ar"]'); pg.wait_for_timeout(400); pg.click('#da-wbar button[data-v="feed-sheet"]'); pg.wait_for_timeout(300)
    check('W11 Arabic mode: buttons and date in Arabic', 'العلف' in pg.inner_text('#da-wbar') and 'النهارده' in pg.evaluate("document.querySelector('.da-dctl .lbl').textContent"))
    check('W12 no page errors', not pg._errs, pg._errs)
    ctx.close()
    fails = [r for r in RESULTS if not r[1]]
    for nm, ok, dt in RESULTS: print(('✅ ' if ok else '❌ ') + nm + ('' if ok else f'  → {str(dt)[:400]}'))
    print(f'\n{len(RESULTS)-len(fails)}/{len(RESULTS)} passed')
