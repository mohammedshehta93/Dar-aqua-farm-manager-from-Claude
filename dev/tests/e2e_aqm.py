import os; os.environ['E2E_PORT'] = '8779'
from harness import *
import pandas as pd
FILE = '/mnt/user-data/uploads/2510.xls'
df = pd.read_excel(FILE, engine='xlrd'); df = df[df.iloc[:,0].astype(str).str.match(r'^F\d')]
EXP_FISH, EXP_BIO, EXP_FEED = int(df['Fish No'].sum()), float(df['Biomass'].sum()), float(df['UTD Feed Kg'].sum())
def wait_sync(pg): pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000); pg.wait_for_timeout(300)
with sync_playwright() as p:
    harness_browser[0] = p.chromium.launch()
    sb = MockSB(); sb.units.clear()
    sb.add_user('owner@example.com','admin123',role='admin',uid='u-admin')
    ctx, pg = new_page(p, sb); login(pg,'owner@example.com','admin123'); wait_sync(pg)
    # 1) layout exactly as described
    pg.evaluate("""() => { window._layRows = [
      {site:'F1',from:1,to:12,tanks:4,start:1,vol:10,type:'فايبر'}, {site:'F1',from:6,to:6,tanks:6,start:1,vol:10,type:'فايبر'},
      {site:'F2',from:1,to:5,tanks:14,start:1,vol:10,type:'فايبر'}, {site:'F2',from:6,to:15,tanks:2,start:1,vol:117,type:'خرسانة'},
      {site:'F2',from:16,to:16,tanks:1,start:1,vol:117,type:'خرسانة'}, {site:'F2',from:16,to:16,tanks:6,start:2,vol:10,type:'فايبر'}]; show('farm-setup'); }""")
    pg.wait_for_timeout(300); pg.evaluate('daLayoutBuild()'); pg.wait_for_timeout(900)
    n = pg.evaluate("() => ({all:RAW.length, f1:RAW.filter(u=>u.farm==='F1').length, f2:RAW.filter(u=>u.farm==='F2').length})")
    check('A1 layout: 147 tanks (F1 50, F2 97)', n == {'all':147,'f1':50,'f2':97}, n)
    v = pg.evaluate("() => ['F1.S06T06','F2.S01T14','F2.S06T01','F2.S16T01','F2.S16T07'].map(u => { const x=RAW.find(r=>r.unit===u); return x ? x.volume+' '+x.tankType : 'missing'; })")
    check('A1 volumes/types per your description', v == ['10 فايبر','10 فايبر','117 خرسانة','117 خرسانة','10 فايبر'], v)
    pg.select_option('#st-sys-F1', 'aquaponics'); pg.fill('#st-name-F1', 'أكوابونيك'); pg.select_option('#st-sys-F2', 'ras'); pg.fill('#st-name-F2', 'RAS')
    pg.evaluate('daSaveSitesUI()'); pg.wait_for_timeout(400)
    # 2) upload the real AquaManager export through the file input
    pg.set_input_files('#imp-file', FILE); pg.wait_for_timeout(1500)
    prev = pg.inner_text('#imp-preview')
    check('A2 file recognised as AquaManager', 'AquaManager' in prev and '136' in prev, prev[:160])
    check('A2 transfer/grading difference explained', 'اتنقل' in prev)
    pg.click('#imp-go'); pg.wait_for_timeout(2500)
    st = pg.evaluate("() => { const L=_txLiveRows(); return {occ:L.filter(r=>r.fishNo>0).length, empty:L.filter(r=>!(r.fishNo>0)).length, fish:L.reduce((s,r)=>s+(r.fishNo||0),0), bio:L.reduce((s,r)=>s+(r.biomass||0),0), feed:RAW.reduce((s,u)=>s+(u.feedKg||0),0)}; }")
    check('A3 136 tanks with fish + 11 empty', st['occ'] == 136 and st['empty'] == 11, st)
    check(f'A3 totals match the file (fish {EXP_FISH:,}, biomass {EXP_BIO:,.0f} kg, feed {EXP_FEED:,.0f} kg)', st['fish'] == EXP_FISH and abs(st['bio'] - EXP_BIO) < 0.5 and abs(st['feed'] - EXP_FEED) < 0.5, st)
    u1 = pg.evaluate("() => RAW.find(u=>u.unit==='F1.S01T01')")
    check('A4 F1.S01T01: stocked 791+19=810, 220g→275g, 2026-08-10', u1['stockFish'] == 810 and u1['startWt'] == 220 and u1['avgWt'] == 275 and u1['startDate'] == '2026-08-10' and u1['open']['feed'] == 124.3, {k: u1.get(k) for k in ['stockFish','startWt','avgWt','startDate']})
    u16 = pg.evaluate("() => RAW.find(u=>u.unit==='F2.S16T01')")
    check('A4 F2.S16.T01 → F2.S16T01, keeps 117 m³ concrete from layout', u16 and u16['aqmName'] == 'F2.S16.T01' and u16['volume'] == 117 and u16['tankType'] == 'خرسانة' and u16['fishNo'] > 0, u16 and {k: u16.get(k) for k in ['volume','tankType','aqmName']})
    sv = pg.evaluate("() => getSurvivalData().find(r=>r.unit==='F1.S01T01')")
    check('A5 survival = (810−19)/810 = 97.7%', sv['survRate'] == 97.7 and sv['startFish'] == 810, sv)
    pg.evaluate("window._trUnit='F1.S01T01'; show('traceability')"); pg.wait_for_timeout(300)
    tr = content(pg)
    check('A6 traceability: opening line + AquaManager FCR 2.81', 'رصيد افتتاحي' in tr and '2.81' in tr and '810' in tr, tr[:300])
    pg.evaluate("addTX({id:'nf1',type:'feeding',date:daToday(),unit:'F1.S01T01',kg:2,feed:'x',_skipValidation:true}); show('site-overview')"); pg.wait_for_timeout(400)
    check('A7 cumulative feed = opening 124.3 + new 2 = 126.3', '126.3' in content(pg))
    pg.evaluate("show('ras-load')"); pg.wait_for_timeout(400)
    ras = pg.evaluate("() => daRasCompute(14).map(f=>f.farm)")
    check('A8 biofilter load for RAS (F2) only, F1 noted', ras == ['F2'] and 'F1' in content(pg) and 'أكوابونيك' in content(pg), ras)
    pg.evaluate("window._fpState={date:daToday(),temp:27,doVal:6.5}; show('feeding-print')"); pg.wait_for_timeout(500)
    rows = pg.evaluate("() => daFpCompute(window._fpState).sites.map(s=>s.site+':'+s.rows.length)")
    check('A9 feeding sheet: F1 50 + F2 86 tanks with fish', rows == ['F1:50','F2:86'], rows)
    check('A10 layout + data saved to cloud', sum(1 for r in sb.units.values() if r['farm_id'] == 'farm-main') == 147)
    # Site Overview must show AquaManager's own numbers for an imported tank nobody touched since (F1.S01T02 in 2510.xls)
    pg.evaluate("window._ov={date:daToday()}; farmFilter='all'; show('site-overview')"); pg.wait_for_timeout(500)
    r2 = pg.evaluate("(() => { const tr=document.querySelector('#ov-t tr[data-u=\"F1.S01T02\"]'); return tr && [...tr.cells].map(c=>c.textContent); })()")
    check('A12 Site Overview = AquaManager for an imported tank (start 2026-09-05, 835 fish, 90→160 g, feed 89.6, mortality 5, UTD FCR 1.51)',
          r2 and r2[1] == '2026-09-05' and r2[2] == '835' and r2[3] == '90.00' and r2[4] == '160.00' and r2[7] == '5' and r2[8] == '89.60' and r2[9] == '1.51', r2)
    pg._errs.clear()
    bad = pg.evaluate("() => { const o=[]; Object.keys(VIEWS).forEach(v=>{ try{ show(v); }catch(e){ o.push(v+': '+e.message); } }); return o; }"); pg.wait_for_timeout(800)
    check('A11 every page works with real farm data + empty tanks', not bad and not pg._errs, (bad + pg._errs)[:5])
    ctx.close()
srv.shutdown()
for n_, ok, d in RESULTS: print(('✅ ' if ok else '❌ ') + n_ + ('' if ok or not d else f'   → {d}'))
print(f"\n{sum(1 for _, o, _ in RESULTS if o)}/{len(RESULTS)} passed")
