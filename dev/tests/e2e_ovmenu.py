# Site Overview header right-click menu: sort asc / desc / clear, hide a column, column chooser.
import os; os.environ['E2E_PORT'] = '8818'
from harness import *
def heads(pg): return pg.evaluate("[...document.querySelectorAll('#ov-t thead th')].map(t=>t.dataset.k)")
def col(pg, k): return pg.evaluate(f"(() => {{ const i=[...document.querySelectorAll('#ov-t thead th')].findIndex(t=>t.dataset.k==='{k}'); return [...document.querySelectorAll('#ov-t tbody tr')].map(r=>r.cells[i].textContent); }})()")
def menu(pg, k, action):
    pg.click(f'#ov-t thead th[data-k="{k}"]', button='right'); pg.wait_for_timeout(100)
    pg.click(f'#ov-menu .ov-mi[data-a="{action}"]'); pg.wait_for_timeout(250)

with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin')
    ctx, pg = new_page(p, sb)
    login(pg, 'admin@example.com', 'admin123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    pg.evaluate("localStorage.removeItem('daov_hidden_cols'); window._ov={}; show('site-overview')"); pg.wait_for_timeout(300)
    natural = col(pg, 'unit')
    pg.click('#ov-t thead th[data-k="wt"]', button='right'); pg.wait_for_timeout(100)
    check('M1 right-click on a header opens the menu', pg.evaluate("!!document.getElementById('ov-menu')") and 'إلغاء الترتيب' in pg.inner_text('#ov-menu'))
    pg.keyboard.press('Escape'); check('M1 Escape closes it', not pg.evaluate("!!document.getElementById('ov-menu')"))
    menu(pg, 'wt', 'desc'); w = [float(x.replace(',', '')) for x in col(pg, 'wt')]
    check('M2 sort descending', w == sorted(w, reverse=True) and '▼' in pg.inner_text('#ov-t thead th[data-k="wt"]'), w)
    menu(pg, 'wt', 'asc'); w = [float(x.replace(',', '')) for x in col(pg, 'wt')]
    check('M3 sort ascending', w == sorted(w) and '▲' in pg.inner_text('#ov-t thead th[data-k="wt"]'), w)
    menu(pg, 'wt', 'clear')
    check('M4 clear sort → natural tank order, no arrow on any column', col(pg, 'unit') == natural and not pg.evaluate("[...document.querySelectorAll('#ov-t thead th')].some(t=>/[▲▼]/.test(t.textContent))"))
    menu(pg, 'bio', 'hide')
    h = heads(pg); fc = pg.evaluate("document.querySelector('#ov-t tfoot').rows[0].cells.length"); bc = pg.evaluate("document.querySelector('#ov-t tbody tr').cells.length")
    check('M5 hide a column: header, rows and totals stay aligned', 'bio' not in h and fc == len(h) == bc, (h, fc, bc))
    check('M5 hidden columns remembered on this device', pg.evaluate("JSON.parse(localStorage.getItem('daov_hidden_cols'))") == ['bio'])
    pg.click('#ov-t thead th[data-k="wt"]', button='right'); pg.wait_for_timeout(100)
    check('M6 chooser shows Biomass unticked', '☐ Biomass' in pg.inner_text('#ov-menu'))
    pg.click('#ov-menu .ov-mi[data-a="tog:bio"]'); pg.wait_for_timeout(250)
    check('M6 ticking it in the chooser shows it again', 'bio' in heads(pg))
    menu(pg, 'fcr', 'hide'); menu(pg, 'dens', 'hide')
    pg.click('text=Show all columns'); pg.wait_for_timeout(250)
    check('M7 "Show all columns" restores every column', len(heads(pg)) == pg.evaluate("DA_OV_COLS.length"))
    pg.click('#ov-t thead th[data-k="unit"]', button='right'); pg.wait_for_timeout(100); pg.click('#ov-menu .ov-mi[data-a="hide"]'); pg.wait_for_timeout(200)
    check('M8 the Unit column cannot be hidden', 'unit' in heads(pg))
    check('M9 no page errors', not pg._errs, pg._errs)
    ctx.close()
    fails = [r for r in RESULTS if not r[1]]
    for nm, ok, dt in RESULTS: print(('✅ ' if ok else '❌ ') + nm + ('' if ok else f'  → {str(dt)[:300]}'))
    print(f'\n{len(RESULTS)-len(fails)}/{len(RESULTS)} passed')
