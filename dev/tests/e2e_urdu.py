# Urdu for the workers' screens: chosen at login, every worker page in Urdu (right to left), dates, messages, guide;
# remembered on the phone; office users keep Arabic / English.
import os, re; os.environ['E2E_PORT'] = '8866'
from harness import *
OK_LATIN = {'pH', 'DO', 'TAN', 'NH', 'NO', 'mg', 'L', 'CaCO', 'C', 'F', 'S', 'T', 'X', 'dead', 'x', 'Add', 'to', 'Home', 'Screen', 'Excel', 'KG', 'g', 'd'}
def latin(pg):
    t = pg.evaluate("(() => { let t=''; const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT); let n; while((n=w.nextNode())) if(n.parentElement && n.parentElement.offsetParent!==null && !/^(SCRIPT|STYLE)$/.test(n.parentElement.tagName)) t+=' '+n.nodeValue; document.querySelectorAll('input[placeholder]').forEach(i=>{ if(i.offsetParent!==null) t+=' '+i.placeholder; }); return t; })()")
    return [w for w in re.findall(r'[A-Za-z]{2,}', t) if w not in OK_LATIN and not re.match(r'^(F\d|S\d|T\d)', w) and w.lower() not in ('sajed', 'shamim', 'w')]
with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('w@workers.dar-aqua.app', 'work123', role='worker', perms=['input_feeding', 'input_mortality', 'input_wq', 'input_sampling'])
    sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin')
    ctx, pg = new_page(p, sb); pg.set_viewport_size({'width': 390, 'height': 844}); pg.wait_for_timeout(400)
    pg.click('#lang-btn'); pg.wait_for_timeout(200)
    check('U1 on the login page the language button offers عربي · English · اردو', pg.evaluate("[...document.querySelectorAll('#da-langmenu button')].map(b=>b.textContent)") == ['عربي', 'English', 'اردو'])
    pg.click('#da-langmenu button[data-l="ur"]'); pg.wait_for_timeout(400)
    check('U2 Urdu: right to left, login page in Urdu', pg.evaluate("document.documentElement.dir") == 'rtl' and 'لاگ ان' in pg.inner_text('body') and not latin(pg), latin(pg)[:10])
    login(pg, 'w@workers.dar-aqua.app', 'work123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000); pg.wait_for_timeout(500)
    pg.evaluate("addTX({id:'s0',type:'sampling',unit:'F1.S01T01',date:daAddDays(daToday(),-10),avgWt:100,_skipValidation:true})")
    bar = pg.inner_text('#da-wbar')
    check('U3 the worker\'s page buttons in Urdu', 'فیڈ' in bar and 'پانی' in bar and 'رہنمائی' in bar, bar)
    for v, setup in [('feed-sheet', "window._fs={farm:'F1'}"), ('wq-sheet', "window._wqs={farm:'F1',mode:'daily'}"), ('wq-sheet', "window._wqs={farm:'F1',mode:'weekly'}"), ('tx-sampling', "window._sp={farm:'F1'}"), ('account', '0'), ('help', '0')]:
        pg.evaluate(f"{setup}; show('{v}',true)"); pg.wait_for_timeout(400); left = latin(pg)
        check(f'U4 {v} {setup[-12:]}: in Urdu (English left: {len(left)})', len(left) <= 2, left[:12])
    pg.evaluate("window._fs={farm:'F1'}; show('feed-sheet',true)"); pg.wait_for_timeout(300)
    lbl = pg.evaluate("document.querySelector('.da-dctl .lbl').textContent")
    check('U5 the date in Urdu (day and month names, "today")', re.search(r'(اتوار|پیر|منگل|بدھ|جمعرات|جمعہ|ہفتہ) \d+ (جنوری|فروری|مارچ|اپریل|مئی|جون|جولائی|اگست|ستمبر|اکتوبر|نومبر|دسمبر) 20\d\d \(آج\)', lbl) is not None, lbl)
    pg.click('.da-dctl .lbl'); pg.wait_for_timeout(200)
    cal = pg.evaluate("document.getElementById('da-cal').innerText")
    check('U6 the calendar in Urdu', re.search(r'(جنوری|فروری|مارچ|اپریل|مئی|جون|جولائی|اگست|ستمبر|اکتوبر|نومبر|دسمبر) 20\d\d', cal) is not None and not re.search(r'[A-Za-z]{2,}', cal), cal[:60])
    pg.evaluate("document.getElementById('da-cal').remove()")
    i = pg.evaluate("window._fs.rows.find(r=>r.i!==undefined).i"); pg.fill(f'#fs-{i}-m0', '2'); pg.fill(f'#fs-{i}-sz', '2'); pg.click('#fs-save'); pg.wait_for_timeout(500)
    toast_ = pg.evaluate("[...document.querySelectorAll('.toast,#toast')].map(e=>e.textContent).join(' ')")
    check('U7 the save message in Urdu', 'محفوظ' in toast_ and not re.search(r'[A-Za-z]{3,}', toast_.replace('kg', '')), toast_)
    msgs = []; pg.once('dialog', lambda d: (msgs.append(d.message), d.dismiss()))
    pg.evaluate("window._sp={farm:'F1'}; show('tx-sampling',true)"); pg.wait_for_timeout(300); pg.fill('[id="sp-wt-F1.S01T01"]', '50'); pg.click('#sp-save'); pg.wait_for_timeout(400)
    check('U8 questions (dialogs) in Urdu', msgs and 'پچھلے نمونے' in msgs[0], msgs)
    pg.reload(); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000); pg.wait_for_timeout(700)
    check('U9 Urdu stays chosen after the app is opened again', pg.evaluate("daLangNow()") == 'ur' and pg.evaluate("document.documentElement.dir") == 'rtl' and 'فیڈ' in pg.inner_text('#da-wbar'))
    pg.evaluate("doLogout(true)"); pg.wait_for_timeout(500)
    login(pg, 'admin@example.com', 'admin123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000); pg.wait_for_timeout(400)
    check('U10 office users: no Urdu (a stored Urdu reads as English for them)', pg.evaluate("daLangNow()") == 'en' and not pg.evaluate("daUrOn()"))
    pg.click('#lang-btn'); pg.wait_for_timeout(300)
    check('U11 office users\' language button switches Arabic / English as before (no three-way menu)', not pg.evaluate("!!document.getElementById('da-langmenu')"))
    check('U12 no page errors', not pg._errs, pg._errs)
    ctx.close()
    fails = [r for r in RESULTS if not r[1]]
    for nm, ok, dt in RESULTS: print(('✅ ' if ok else '❌ ') + nm + ('' if ok else f'  → {str(dt)[:400]}'))
    print(f'\n{len(RESULTS)-len(fails)}/{len(RESULTS)} passed')
