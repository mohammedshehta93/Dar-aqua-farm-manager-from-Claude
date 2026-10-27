import os; os.environ['E2E_PORT'] = '8794'
from harness import *
def wait_sync(pg): pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000); pg.wait_for_timeout(300)
with sync_playwright() as p:
    harness_browser[0] = p.chromium.launch()
    sb = MockSB(); sb.add_user('owner@example.com','admin123',role='admin',uid='u-admin')
    sb.settings['farm-main'] = {'daracqua_settings_v2': json.dumps({'farmName':'Dar Aqua','cfToken':'cfut_SECRET123','cfAccount':'2453','anthropicKey':'sk-ant-XYZ'})}
    ctx, pg = new_page(p, sb)
    pg.evaluate("localStorage.setItem('daracqua_tenant','farm-main'); localStorage.setItem('daracqua_settings_v2', JSON.stringify({farmName:'x', cfToken:'cfut_LOCAL', geminiKey:'AIzaLOCAL'}))")
    pg.reload(); pg.wait_for_timeout(500)
    login(pg,'owner@example.com','admin123'); wait_sync(pg); pg.wait_for_timeout(2200)
    local = pg.evaluate("() => { let s=''; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k.startsWith('daracqua_settings')) s+=localStorage.getItem(k); } return s; }")
    check('S1 old keys scrubbed from this device', 'cfut_' not in local and 'sk-ant' not in local and 'AIza' not in local, local[:120])
    check('S1 old keys scrubbed from the farm cloud copy', 'cfut_' not in json.dumps(sb.settings.get('farm-main', {})) and 'sk-ant' not in json.dumps(sb.settings.get('farm-main', {})))
    pg.evaluate("show('settings')"); pg.wait_for_timeout(300)
    check('S2 no token / key fields in settings anymore', not pg.query_selector('#st-cf-token') and 'st-cf-token' not in pg.content() and pg.evaluate("() => renderSettings.toString().indexOf('مفيش مفاتيح') >= 0"))
    pg.evaluate("show('ai')"); pg.wait_for_timeout(300)
    pg.evaluate("window.DA_AI_URL=''"); 
    hook_toasts(pg)
    pg.evaluate("window.DA_AI_URL='https://farm-ai.test.workers.dev/'")
    sb.ai_answer = 'تمام <img src=x onerror="window._xss=1">'
    q = pg.query_selector('#ai-input') or pg.query_selector('textarea')
    q.fill('كم علف؟'); pg.evaluate('aiSendQuestion()'); pg.wait_for_timeout(1200)
    call = (getattr(sb, 'ai_calls', []) or [{}])[-1]
    check('S3 question goes with the signed-in session (no token)', call.get('auth','').startswith('Bearer at-u-admin') and not call.get('cf'), {k: call.get(k) for k in ('auth','cf')})
    check('S4 AI answer shown as text — no code runs', not pg.evaluate('!!window._xss') and '&lt;img' in pg.inner_html('#content'))
    pg.evaluate("show('photo-entry')"); pg.wait_for_timeout(300); n0 = len(getattr(sb,'ai_calls',[]))
    pg.evaluate('photoSendToAI()'); pg.wait_for_timeout(300)
    check('S5 photo reading: clear message, nothing sent anywhere', 'مش متاحة' in toasts(pg) and len(getattr(sb,'ai_calls',[])) == n0)
    check('S6 no secrets left in the page code', all(x not in pg.content() for x in ('api.anthropic.com','X-CF-Token','245302f87be8752301a52cc8f9942e9f')))
    check('S7 no JS errors', not pg._errs, pg._errs[:3])
    ctx.close()
srv.shutdown()
for n, ok, d in RESULTS: print(('✅ ' if ok else '❌ ') + n + ('' if ok or not d else f'   → {d}'))
print(f"\n{sum(1 for _, o, _ in RESULTS if o)}/{len(RESULTS)} passed")
