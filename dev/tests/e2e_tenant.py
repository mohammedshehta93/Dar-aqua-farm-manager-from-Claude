import os; os.environ['E2E_PORT'] = '8774'
from harness import *

def wait_sync(pg): pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000); pg.wait_for_timeout(300)

with sync_playwright() as p:
    harness_browser[0] = p.chromium.launch()
    sb = MockSB()
    sb.add_user('owner@example.com', 'admin123', role='admin', uid='u-admin'); sb.platform.add('u-admin')
    sb.add_user('worker@example.com', 'work123', role='worker')
    sb.tx['dar-1'] = {'id':'dar-1','farm_id':'farm-main','data':{'id':'dar-1','type':'feeding','date':'2026-10-20','unit':'F1.S01T01','kg':3,'ts':'2026-10-20T08:00:00Z'}}

    ctx, pg = new_page(p, sb)
    check('U1 no farm data embedded in the page', pg.evaluate('() => RAW.length') == 0)
    # U2/U3 platform owner creates a farm
    login(pg, 'owner@example.com', 'admin123'); wait_sync(pg)
    check('U2 platform owner sees platform page', 'platform' in visible_views(pg))
    pg.evaluate("show('platform')"); pg.wait_for_timeout(400)
    for k, v in {'pf-name':'Nile Farm','pf-loc':'Egypt','pf-aname':'Hassan','pf-aemail':'nile@x.com','pf-apass':'nile1234','pf-max':'3'}.items(): pg.fill('#'+k, v)
    pg.click('#pf-create-btn'); pg.wait_for_timeout(900)
    nile = next((f for f in sb.farms if f['name'] == 'Nile Farm'), None)
    check('U3 farm + admin account created', nile and any(pr['email'] == 'nile@x.com' and pr['farm_id'] == nile['id'] and pr['role'] == 'admin' for pr in sb.profiles.values()))
    check('U3 credentials shown once to send', 'nile1234' in pg.inner_text('#pf-cred') and 'nile1234' not in pg.evaluate('() => JSON.stringify(Object.assign({},localStorage))'))
    check('U3 farm listed with user count', 'Nile Farm' in pg.inner_text('#pf-list'))
    pg.evaluate('doLogout(true)'); pg.wait_for_timeout(500)

    # U4 new farm starts empty, every page works with zero data
    login(pg, 'nile@x.com', 'nile1234'); wait_sync(pg)
    check('U4 new farm is empty', pg.evaluate('() => RAW.length') == 0 and not pg.evaluate("() => getTX().some(t=>t.id==='dar-1')"))
    check('U4 dashboard shows onboarding', 'المزرعة لسه فاضية' in content(pg))
    check('U2 farm admin cannot see platform page', 'platform' not in visible_views(pg))
    check('U4 header shows farm name', 'Nile Farm' in pg.inner_text('#brand-title'))
    pg._errs.clear()
    bad = pg.evaluate("() => { const o=[]; Object.keys(VIEWS).forEach(v=>{ try{ show(v); }catch(e){ o.push(v+': '+e.message); } }); return o; }")
    pg.wait_for_timeout(600)
    check('U4 all pages render on an empty farm', not bad, bad[:6])
    check('U4 no JS errors on empty farm', not pg._errs, pg._errs[:6])

    # U5 Excel import round-trip (real .xlsx bytes through SheetJS)
    imp = pg.evaluate("""() => {
      const wb = daBuildTemplate();
      const put = (name, rows) => { const n = wb.SheetNames.find(s => s.startsWith(name)); const ws = wb.Sheets[n];
        XLSX.utils.sheet_add_aoa(ws, rows, {origin: 1}); ws['!ref'] = XLSX.utils.encode_range({s:{r:0,c:0}, e:{r:rows.length, c:12}}); };
      put('Units', [['N.A1','N','N.A','B1','Silver Tilapia','H','2026-09-01',1000,10,10],['N.A2','N','','','','','01/09/2026',500,20,5],['N.A3','N','','','','',46000,800,5,'']]);
      put('Feeding', [['2026-09-02','N.A1',1.5,'Starter','صباح'],['2026-09-03','N.A2',2,'','']]);
      put('Mortality', [['2026-09-05','N.A1',20,'stress'],['2026-09-05','GHOST',5,'']]);
      put('Sampling', [['2026-09-15','N.A1',18,30],['2026-10-01','N.A1',30,30]]);
      put('Water', [['2026-09-02','N.A1',28,6.5,7.4,0.2],['2026-09-03','N.A1',28,70,7,0]]);
      const bytes = XLSX.write(wb, {type:'array', bookType:'xlsx'});
      const p = daParseImport(XLSX.read(new Uint8Array(bytes), {type:'array'}));
      window._impParsed = p;
      return {units:p.units.length, tx:p.tx.length, errors:p.errors, dates:p.units.map(u=>u.startDate)};
    }""")
    check('U5 parsed units + all date formats', imp['units'] == 3 and imp['dates'] == ['2026-09-01','2026-09-01','2025-12-09'], imp['dates'])
    check('U5 bad rows reported, not imported', len(imp['errors']) == 2 and any('GHOST' in e for e in imp['errors']) and imp['tx'] == 6, (imp['tx'], imp['errors']))
    pg.evaluate('daRunImport()'); pg.wait_for_timeout(1500)
    a1 = pg.evaluate("() => _txLiveRows().find(r=>r.unit==='N.A1')")
    check('U5 live state computed from history', a1['fishNo'] == 980 and a1['avgWt'] == 30, (a1['fishNo'], a1['avgWt']))
    sg = pg.evaluate("() => getTX().filter(t=>t.type==='sampling').map(t=>t.sgr)")
    check('U5 SGR computed for imported samples', len(sg) == 2 and all(x and x > 0 for x in sg), sg)
    nid = nile['id']
    check('U5 units + history saved to cloud under the new farm', sum(1 for r in sb.units.values() if r['farm_id'] == nid) == 3 and sum(1 for r in sb.tx.values() if r['farm_id'] == nid) == 6)
    pg.evaluate("() => { const p = daParseImport(XLSX.read(new Uint8Array(XLSX.write((()=>{ const wb=daBuildTemplate(); const n=wb.SheetNames.find(s=>s.startsWith('Mortality')); XLSX.utils.sheet_add_aoa(wb.Sheets[n], [['2026-09-05','N.A1',20,'stress']], {origin:1}); const u=wb.SheetNames.find(s=>s.startsWith('Units')); XLSX.utils.sheet_add_aoa(wb.Sheets[u], [['N.A1','N','N.A','B1','Silver Tilapia','H','2026-09-01',1000,10,10]], {origin:1}); return wb; })(), {type:'array',bookType:'xlsx'})), {type:'array'})); window._impParsed = p; return daRunImport(); }")
    pg.wait_for_timeout(1200)
    check('U5 re-import updates instead of duplicating', pg.evaluate("() => getTX().filter(t=>t.type==='mortality').length") == 1 and pg.evaluate("() => _txLiveRows().find(r=>r.unit==='N.A1').fishNo") == 980)
    # U12 backup
    with pg.expect_download() as dl: pg.evaluate('daExportBackup()')
    path = dl.value.path()
    check('U12 backup Excel downloads', path and os.path.getsize(path) > 3000)
    # U8 settings shared across devices
    pg.evaluate("localStorage.setItem('daracqua_ras_v1', JSON.stringify({protein:35,o2:0.5,capacity:{N:800}}))"); pg.wait_for_timeout(2200)
    check('U8 farm settings pushed to cloud', 'daracqua_ras_v1' in sb.settings.get(nid, {}))
    ctx2, pg2 = new_page(p, sb); login(pg2, 'nile@x.com', 'nile1234'); wait_sync(pg2)
    check('U8 settings appear on another device', '"protein":35' in (pg2.evaluate("() => localStorage.getItem('daracqua_ras_v1')") or ''))
    check('U8 units appear on another device', pg2.evaluate('() => RAW.length') == 3)
    ctx2.close()
    # U11 licence user limit (3): admin + 2 more allowed
    pg.evaluate("show('user-management')"); pg.wait_for_timeout(500)
    for i in range(3):
        pg.fill('#um-email', f'w{i}@nile.com'); pg.fill('#um-pass', 'pass1234'); pg.click('#um-add-btn'); pg.wait_for_timeout(700)
    n_nile = sum(1 for pr in sb.profiles.values() if pr['farm_id'] == nid)
    check('U11 user limit enforced (max 3)', n_nile == 3, n_nile)
    check('U7 farm admin sees only own users', 'owner@example.com' not in pg.inner_text('#um-users-list') and 'w0@nile.com' in pg.inner_text('#um-users-list'))
    pg.evaluate('doLogout(true)'); pg.wait_for_timeout(500)

    # U6 same device, other farm: nothing leaks either way
    login(pg, 'owner@example.com', 'admin123'); wait_sync(pg)
    check('U6 other farm sees only its own units', sorted(pg.evaluate('() => RAW.map(u=>u.unit)')) == sorted(u for u, _, _ in DEFAULT_UNITS))
    check('U6 no imported records leak into other farm (device)', not pg.evaluate("() => getTX().some(t=>String(t.id).startsWith('imp-'))"))
    check('U6 no imported records leak into other farm (cloud)', not any(r['farm_id'] == 'farm-main' and r['id'].startswith('imp-') for r in sb.tx.values()))
    pg.evaluate("show('user-management')"); pg.wait_for_timeout(500)
    check('U7 other farm admin cannot see Nile users', 'nile@x.com' not in pg.inner_text('#um-users-list'))
    # U10 suspend licence
    pg.evaluate("show('platform')"); pg.wait_for_timeout(500)
    i_n = pg.evaluate("() => _pfFarms.findIndex(f=>f.name==='Nile Farm')")
    pg.on('dialog', lambda d: d.accept()); pg.evaluate(f'platformToggle({i_n})'); pg.wait_for_timeout(600)
    pg.evaluate('doLogout(true)'); pg.wait_for_timeout(500); hook_toasts(pg)
    login(pg, 'nile@x.com', 'nile1234')
    check('U10 suspended farm cannot log in', 'اشتراك' in toasts(pg) and 'تسجيل الدخول' in content(pg), toasts(pg))
    nile['active'] = True

    # U9 wipe only own farm
    login(pg, 'nile@x.com', 'nile1234'); wait_sync(pg)
    ok = pg.evaluate("() => daWipeFarm('Nile Farm')"); pg.wait_for_timeout(600)
    check('U9 wipe cleared this farm (cloud + device)', ok and not any(r['farm_id'] == nid for r in sb.tx.values()) and not any(r['farm_id'] == nid for r in sb.units.values()) and pg.evaluate('() => RAW.length === 0 && getTX().length === 0'))
    check('U9 other farm untouched', 'dar-1' in sb.tx and sum(1 for r in sb.units.values() if r['farm_id'] == 'farm-main') == 6)
    check('U9 users kept after wipe', sum(1 for pr in sb.profiles.values() if pr['farm_id'] == nid) == 3)
    pg.evaluate("show('dashboard')"); check('U9 back to onboarding', 'المزرعة لسه فاضية' in content(pg))
    wrong = pg.evaluate("() => daWipeFarm('wrong name')")
    check('U9 wrong confirmation name refuses', wrong is False)
    ctx.close()

srv.shutdown()
passed = sum(1 for _, ok, _ in RESULTS if ok)
for n, ok, d in RESULTS: print(('✅ ' if ok else '❌ ') + n + ('' if ok or not d else f'   → {d}'))
print(f'\n{passed}/{len(RESULTS)} passed')
