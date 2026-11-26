# Shared settings from two devices: each device edits a DIFFERENT setting within the pull interval (~2 min).
# Neither change may undo the other (the cloud row is one blob of every synced key).
import os, json; os.environ['E2E_PORT'] = '8905'
from harness import *
with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin'); sb.add_user('eng@example.com', 'eng123', role='engineer', uid='u-eng')
    c1, pa = new_page(p, sb); login(pa, 'admin@example.com', 'admin123'); pa.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    c2, pb = new_page(p, sb); login(pb, 'eng@example.com', 'eng123'); pb.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    pa.wait_for_timeout(2500); pb.wait_for_timeout(500)
    cloud = lambda: sb.settings.get('farm-main') or {}
    A = json.dumps({'F1': [{'id': 'r1', 'time': '07:00', 'text': 'routine from the office', 'days': None}]})
    B = json.dumps({'F1.S01T01': {'size': '3', 'from': '2026-11-26'}})
    # device A (office PC) edits the routine; device B (phone) has not pulled since
    pa.evaluate(f"localStorage.setItem('daracqua_plan_v1_routine', {json.dumps(A)})"); pa.wait_for_timeout(2500)
    check('S1 device A\'s routine reached the cloud', cloud().get('daracqua_plan_v1_routine') == A)
    # device B pins a feed size a moment later (a different setting)
    pb.evaluate(f"localStorage.setItem('daracqua_plan_v1_fsize', {json.dumps(B)})"); pb.wait_for_timeout(2500)
    check('S2 device B\'s pinned size reached the cloud', cloud().get('daracqua_plan_v1_fsize') == B)
    check('S3 device A\'s routine is still in the cloud after B saved', cloud().get('daracqua_plan_v1_routine') == A, cloud().get('daracqua_plan_v1_routine'))
    # both devices pull: each must end with BOTH changes
    pa.evaluate("daPullSettings()"); pb.evaluate("daPullSettings()"); pa.wait_for_timeout(1200)
    check('S4 device A keeps its routine and gets B\'s size', pa.evaluate("localStorage.getItem('daracqua_plan_v1_routine')") == A and pa.evaluate("localStorage.getItem('daracqua_plan_v1_fsize')") == B)
    check('S5 device B gets A\'s routine and keeps its size', pb.evaluate("localStorage.getItem('daracqua_plan_v1_routine')") == A and pb.evaluate("localStorage.getItem('daracqua_plan_v1_fsize')") == B)
    # the SAME setting edited on both: the later edit wins (expected), and nothing else is touched
    pa.evaluate("localStorage.setItem('daracqua_plan_v1_fsize', JSON.stringify({x:'A'}))"); pa.wait_for_timeout(300)
    pb.evaluate("localStorage.setItem('daracqua_plan_v1_fsize', JSON.stringify({x:'B'}))"); pb.wait_for_timeout(2800)
    check('S6 same setting from two devices: the later edit wins, the other settings untouched', cloud().get('daracqua_plan_v1_fsize') == '{"x":"B"}' and cloud().get('daracqua_plan_v1_routine') == A)
    # the dangerous case: B holds an OLD value of A's setting (not missing) and saves something else
    OLD = json.dumps({'F1': [{'id': 'r0', 'time': '06:00', 'text': 'old routine', 'days': None}]})
    NEW = json.dumps({'F1': [{'id': 'r2', 'time': '08:00', 'text': 'new routine', 'days': None}]})
    pa.evaluate(f"localStorage.setItem('daracqua_plan_v1_routine', {json.dumps(OLD)})"); pa.wait_for_timeout(2500)
    pb.evaluate("daPullSettings()"); pb.wait_for_timeout(800)
    check('S8 setup: both devices hold the old routine', pb.evaluate("localStorage.getItem('daracqua_plan_v1_routine')") == OLD)
    pa.evaluate(f"localStorage.setItem('daracqua_plan_v1_routine', {json.dumps(NEW)})"); pa.wait_for_timeout(2500)
    pb.evaluate("localStorage.setItem('daracqua_settings_v2_remind', JSON.stringify({on:true,time:'17:00'}))"); pb.wait_for_timeout(2500)
    pa.evaluate("daPullSettings()"); pa.wait_for_timeout(800)
    check('S9 B\'s stale copy does not bring the old routine back: the cloud and A keep the new one', cloud().get('daracqua_plan_v1_routine') == NEW and pa.evaluate("localStorage.getItem('daracqua_plan_v1_routine')") == NEW, cloud().get('daracqua_plan_v1_routine'))
    # a setting changed on a device and not uploaded yet is not overwritten by a pull
    pb.evaluate("localStorage.setItem('daracqua_plan_v1_fsize', JSON.stringify({x:'local'})); daPullSettings()"); pb.wait_for_timeout(600)
    check('S10 a pull right after a local change keeps the local change (then it uploads)', pb.evaluate("localStorage.getItem('daracqua_plan_v1_fsize')") == '{"x":"local"}')
    pb.wait_for_timeout(2500)
    check('S11 … and it reaches the cloud', cloud().get('daracqua_plan_v1_fsize') == '{"x":"local"}')
    # a NEW device that writes a default BEFORE its first pull (start-up) must not overwrite the farm's real setting
    c3, pc = new_page(p, sb)
    pc.evaluate("localStorage.setItem('daracqua_plan_v1_routine', JSON.stringify({F1:[]}))")
    login(pc, 'eng@example.com', 'eng123'); pc.wait_for_function('() => !!window._cloudSyncDone', timeout=10000); pc.wait_for_timeout(2500)
    check('S12 a new device\'s start-up default does not overwrite the real routine (cloud and device have the real one)', cloud().get('daracqua_plan_v1_routine') == NEW and pc.evaluate("localStorage.getItem('daracqua_plan_v1_routine')") == NEW, cloud().get('daracqua_plan_v1_routine'))
    c3.close()
    # the guard itself: a write BEFORE this session's first pull is not counted as a change of this device
    pb.evaluate("window._daSetReady = false; localStorage.setItem('daracqua_plan_v1_routine', JSON.stringify({F1:[]}))"); pb.wait_for_timeout(2500)
    pb.evaluate("daPullSettings()"); pb.wait_for_timeout(600)
    check('S13 a write before the first pull is not uploaded and the pull replaces it with the real routine', cloud().get('daracqua_plan_v1_routine') == NEW and pb.evaluate("localStorage.getItem('daracqua_plan_v1_routine')") == NEW)
    check('S7 no page errors', not pa._errs and not pb._errs, (pa._errs + pb._errs)[:3])
    for c in (c1, c2): c.close()
    fails = [r for r in RESULTS if not r[1]]
    for nm, ok, dt in RESULTS: print(('✅ ' if ok else '❌ ') + nm + ('' if ok else f'  → {str(dt)[:300]}'))
    print(f'\n{len(RESULTS)-len(fails)}/{len(RESULTS)} passed')
