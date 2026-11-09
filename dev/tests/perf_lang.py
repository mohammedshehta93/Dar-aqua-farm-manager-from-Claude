# Worker on a phone (4× slower CPU): time to switch language and to open each page, Arabic vs English vs Urdu.
import os, sys, json, time; os.environ['E2E_PORT'] = os.environ.get('E2E_PORT', '8871')
sys.path.insert(0, os.path.dirname(__file__))
import harness
harness.DEFAULT_UNITS[:] = [(f'F2.S{s:02d}T{t:02d}', 1500, 50) for s in range(1, 6) for t in range(1, 15)] + [(f'F1.S{s:02d}T{t:02d}', 500, 100) for s in range(1, 13) for t in range(1, 5)]
from harness import *
with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('w@workers.dar-aqua.app', 'work123', role='worker', perms=['input_feeding', 'input_mortality', 'input_wq', 'input_sampling'])
    ctx, pg = new_page(p, sb); pg.set_viewport_size({'width': 390, 'height': 844})
    login(pg, 'w@workers.dar-aqua.app', 'work123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000); pg.wait_for_timeout(500)
    ctx.new_cdp_session(pg).send('Emulation.setCPUThrottlingRate', {'rate': 4})
    res = {}
    def t(js):
        return pg.evaluate("(async () => { const t0=performance.now(); " + js + "; await new Promise(r=>setTimeout(r,50)); return Math.round(performance.now()-t0-50); })()")
    for lang in ['ar', 'en', 'ur', 'ar']:
        res['switch to ' + lang] = t(f"daLangPick ? daLangPick('{lang}') : 0")
        for v, setup in [('feed-sheet', "window._fs={farm:'F2'}"), ('wq-sheet', "window._wqs={farm:'F2',mode:'daily'}"), ('tx-sampling', "window._sp={farm:'F2'}")]:
            res[f'{lang}: {v}'] = t(f"{setup}; show('{v}',true)")
        res[f'{lang}: type one number'] = t("const e=document.querySelector('#content input[inputmode=decimal]:not([disabled])'); if(e){ e.value='3'; e.dispatchEvent(new Event('input',{bubbles:true})); }")
    print(json.dumps(res, ensure_ascii=False, indent=0)); json.dump(res, open('/tmp/perf_lang_' + os.environ.get('TAG', 'before') + '.json', 'w'))
