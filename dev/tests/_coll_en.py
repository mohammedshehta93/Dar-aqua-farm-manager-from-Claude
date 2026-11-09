import os, sys, json, re; os.environ['E2E_PORT'] = '8865'; sys.path.insert(0, 'dev/tests')
from harness import *
JS = """() => { const out = new Set(); const vis = e => e && e.offsetParent !== null; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
  while((n = w.nextNode())){ const t = n.nodeValue.trim(); if(t && /[A-Za-z]{2,}/.test(t) && vis(n.parentElement) && n.parentElement.tagName !== 'SCRIPT' && n.parentElement.tagName !== 'STYLE') out.add(t); }
  document.querySelectorAll('[placeholder],[title]').forEach(e => { if(!vis(e)) return; ['placeholder','title'].forEach(a => { const v = e.getAttribute(a); if(v && /[A-Za-z]{2,}/.test(v)) out.add(v); }); });
  (window.__toasts||[]).forEach(t => out.add(t)); return [...out]; }"""
S = set(); D = set()
with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('w@workers.dar-aqua.app', 'work123', role='worker', perms=['input_feeding','input_mortality','input_sampling','input_wq','input_harvest'])
    ctx, pg = new_page(p, sb); pg.set_viewport_size({'width': 390, 'height': 844})
    pg.on('dialog', lambda d: (D.add(d.message), d.accept()))
    pg.evaluate("localStorage.setItem('da_lang','en')"); pg.reload(); pg.wait_for_timeout(600); S |= set(pg.evaluate(JS))
    pg.fill('#auth-email', 'w'); pg.fill('#auth-pass', 'bad'); pg.click('#auth-btn'); pg.wait_for_timeout(600); S |= set(pg.evaluate(JS))
    login(pg, 'w@workers.dar-aqua.app', 'work123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000); pg.wait_for_timeout(400)
    pg.evaluate("addTX({id:'s0',type:'sampling',unit:'F1.S01T01',date:daAddDays(daToday(),-10),avgWt:100,_skipValidation:true})")
    for v, setup in [('feed-sheet',"window._fs={farm:'F1'}"), ('wq-sheet',"window._wqs={farm:'F1',mode:'daily'}"), ('wq-sheet',"window._wqs={farm:'F1',mode:'weekly'}"), ('tx-sampling',"window._sp={farm:'F1'}"), ('tx-harvesting','0'), ('tx-transfer','0'), ('account','0'), ('help','0')]:
        pg.evaluate(f"{setup}; show('{v}',true)"); pg.wait_for_timeout(400); S |= set(pg.evaluate(JS))
    pg.evaluate("window._fs={farm:'F1'}; show('feed-sheet',true)"); pg.wait_for_timeout(300)
    i = pg.evaluate("window._fs.rows.find(r=>r.i!==undefined).i"); pg.fill(f'#fs-{i}-m0', '2'); pg.fill(f'#fs-{i}-sz', '2'); pg.fill(f'#fs-{i}-d', '1'); pg.click('#fs-save'); pg.wait_for_timeout(500); S |= set(pg.evaluate(JS))
    pg.click('#fs-copy'); pg.wait_for_timeout(300); S |= set(pg.evaluate(JS))
    pg.click('.da-dctl .lbl'); pg.wait_for_timeout(300); S |= set(pg.evaluate(JS))
    pg.evaluate("document.getElementById('da-cal') && document.getElementById('da-cal').remove()")
    pg.evaluate("window._wqs={farm:'F1',mode:'daily'}; show('wq-sheet',true)"); pg.wait_for_timeout(300)
    pg.fill('#wqs-0-temp', '45'); pg.fill('#wqs-0-ph', '7'); pg.fill('#wqs-0-do', '2'); pg.click('#wqs-save'); pg.wait_for_timeout(500); S |= set(pg.evaluate(JS))
    pg.evaluate("window._sp={farm:'F1'}; show('tx-sampling',true)"); pg.wait_for_timeout(300); pg.fill('[id="sp-wt-F1.S01T01"]', '50'); pg.click('#sp-save'); pg.wait_for_timeout(400); S |= set(pg.evaluate(JS))
    pg.evaluate("(()=>{ const o=daUpdateSafe; daUpdateSafe=()=>false; daShowUpdateBanner(); daUpdateSafe=o; })()"); pg.wait_for_timeout(300); S |= set(pg.evaluate(JS))
    pg.evaluate("doLogout()"); pg.wait_for_timeout(500); S |= set(pg.evaluate(JS))
json.dump({'text': sorted(S), 'dialogs': sorted(D)}, open('/tmp/en_seen.json', 'w'), ensure_ascii=False, indent=0)
print(len(S), len(D))
