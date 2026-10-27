import json, re, threading, http.server, socketserver, functools, time, itertools
from urllib.parse import urlparse, parse_qs, unquote
from playwright.sync_api import sync_playwright

ROOT = os.environ.get('APP_ROOT', '/mnt/user-data/outputs/DarAqua_Fresh')
import os
PORT = int(os.environ.get('E2E_PORT', '8771'))
BASE = f'http://localhost:{PORT}/index.html'
SB = 'https://mjtxibdxqxrgykuyftsr.supabase.co'

# ── static server ──
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(('127.0.0.1', PORT), functools.partial(Quiet, directory=ROOT))
srv.allow_reuse_address = True
threading.Thread(target=srv.serve_forever, daemon=True).start()

# ── mock Supabase (multi-farm, with RLS-equivalent isolation) ──
DEFAULT_UNITS = [('F1.S01T01',791,275),('F1.S01T02',835,160),('F1.S01T03',987,110),('F1.S02T01',881,75),('F1.S02T02',704,395),('F2.S01T01',1000,40)]
ALL_SB = []
class MockSB:
    def __init__(self, profiles_table=True):
        ALL_SB.append(self)
        self.seq = itertools.count(1)
        self.users, self.tokens, self.refresh, self.expired = {}, {}, {}, set()
        self.profiles_table = profiles_table
        self.profiles, self.tx, self.upserts = {}, {}, {}
        self.farms = [{'id':'farm-main','owner_id':'u-admin','name':'Dar Aqua','active':True,'max_users':10,'expires_at':None}]
        self.units, self.settings, self.inv, self.snaps = {}, {}, [], []
        self.platform = set(); self.log = []; self.offline = False; self.ts_rows = []
        for u, n, w in DEFAULT_UNITS:
            self.units['farm-main:'+u] = {'id':'farm-main:'+u,'farm_id':'farm-main','unit':u,'data':{'unit':u,'farm':u.split('.')[0],'section':u[:6],
                'batch':'B1','species':'Silver Tilapia','startDate':'2026-08-10','fishNo':n,'startWt':w,'avgWt':w,'biomass':n*w/1000,'density':n*w/1000/10,'volume':10}}
    def add_user(self, email, pw, role=None, active=True, perms=None, profile=True, uid=None, farm='farm-main'):
        uid = uid or 'u-' + email.split('@')[0]
        self.users[email] = {'id':uid, 'password':pw, 'meta':{'full_name':email.split('@')[0]}}
        if profile:
            self.profiles[uid] = {'id':uid,'email':email,'name':email.split('@')[0],'role':role or 'worker','perms':perms or [],
                'farm_id':farm,'active':active,'created_at':f'2026-01-{len(self.profiles)+1:02d}T00:00:00','last_login':None}
        return uid
    def issue(self, uid):
        n = next(self.seq); a, r = f'at-{uid}-{n}', f'rt-{uid}-{n}'
        self.tokens[a] = uid; self.refresh[r] = uid; return a, r
    def user_of(self, headers):
        tok = headers.get('authorization', '').replace('Bearer ', '')
        return 'EXPIRED' if tok in self.expired else self.tokens.get(tok)
    def farm(self, fid): return next((f for f in self.farms if f['id'] == fid), None)
    def my_farm(self, uid):
        p = self.profiles.get(uid)
        if not p or not p.get('active', True): return None
        f = self.farm(p['farm_id'])
        if not f or not f['active'] or (f.get('expires_at') and f['expires_at'] < time.strftime('%Y-%m-%d')): return None
        return f['id']
    def my_role(self, uid): return self.profiles[uid]['role'] if self.my_farm(uid) else None
    def can_write(self, uid): return self.my_role(uid) in ('admin','manager','engineer','worker')

def j(route, status, body):
    route.fulfill(status=status, content_type='application/json', headers={'Access-Control-Allow-Origin':'*'},
                  body=json.dumps(body) if body is not None else '')

XLSX_JS = open(os.environ.get('XLSX_JS', '/tmp/jstools/node_modules/xlsx/dist/xlsx.full.min.js')).read()
def make_handler(sb):
    def handler(route, request):
        url = request.url
        if url.startswith(f'http://localhost:{PORT}'): return route.continue_()
        if 'xlsx' in url and 'cdnjs' in url: return route.fulfill(status=200, body=XLSX_JS, content_type='application/javascript')
        if not url.startswith(SB):
            if 'workers.dev' in url:
                if not hasattr(sb, 'ai_calls'): sb.ai_calls = []
                hd = {k.lower(): v for k, v in request.headers.items()}
                sb.ai_calls.append({'url':url, 'auth':hd.get('authorization',''), 'cf':hd.get('x-cf-token'), 'body':request.post_data or ''})
                return j(route, 200, {'result':{'response': getattr(sb, 'ai_answer', 'ok')}})
            return route.fulfill(status=200, body='', content_type='application/javascript')
        if sb.offline: return route.abort()
        u = urlparse(url); path = u.path; q = parse_qs(u.query)
        h = {k.lower(): v for k, v in request.headers.items()}; m = request.method
        if m == 'OPTIONS': return route.fulfill(status=200, headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'*'})
        sb.log.append((m, path + ('?' + u.query if u.query else ''), h))
        try: body = json.loads(request.post_data or '{}')
        except Exception: body = {}
        if path == '/auth/v1/token':
            gt = q.get('grant_type', [''])[0]
            if gt == 'password':
                usr = sb.users.get(body.get('email', ''))
                if not usr or usr['password'] != body.get('password'): return j(route, 400, {'error':'invalid_grant','error_description':'Invalid login credentials'})
                a, r = sb.issue(usr['id'])
                return j(route, 200, {'access_token':a,'refresh_token':r,'expires_in':3600,'user':{'id':usr['id'],'email':body['email'],'user_metadata':usr['meta']}})
            if gt == 'refresh_token':
                uid = sb.refresh.pop(body.get('refresh_token'), None)
                if not uid: return j(route, 400, {'error':'invalid_grant'})
                a, r = sb.issue(uid); return j(route, 200, {'access_token':a,'refresh_token':r,'expires_in':3600,'user':{'id':uid}})
        if path == '/auth/v1/signup':
            if body['email'] in sb.users: return j(route, 422, {'msg':'User already registered'})
            uid = 'u-new-' + str(next(sb.seq))
            sb.users[body['email']] = {'id':uid,'password':body['password'],'meta':body.get('data', {})}
            a, r = sb.issue(uid); return j(route, 200, {'access_token':a,'refresh_token':r,'user':{'id':uid,'email':body['email'],'identities':[{}]}})
        if path == '/auth/v1/recover': return j(route, 200, {})
        if path == '/auth/v1/logout': return route.fulfill(status=204, body='')
        if path == '/auth/v1/user' and m == 'PUT':
            tok = h.get('authorization', '').replace('Bearer ', '')
            if not (sb.tokens.get(tok) or tok == 'rec-token'): return j(route, 401, {'msg':'invalid token'})
            sb.last_password_set = body.get('password'); return j(route, 200, {'id':'x'})
        if not path.startswith('/rest/v1/'): return j(route, 404, {})
        if not h.get('apikey'): return j(route, 401, {'message':'No API key found in request'})
        uid = sb.user_of(h)
        if uid == 'EXPIRED': return j(route, 401, {'message':'JWT expired'})
        if not uid: return j(route, 401, {'message':'anon not allowed (RLS)'})
        table = path[len('/rest/v1/'):]; mf = sb.my_farm(uid); role = sb.my_role(uid)
        def eq(name):
            v = q.get(name, [None])[0]; return v[3:] if v and v.startswith('eq.') else None
        deny = lambda: j(route, 403, {'message':'new row violates row-level security policy'})
        # ── RPC ──
        if table == 'rpc/touch_login':
            if uid in sb.profiles: sb.profiles[uid]['last_login'] = '2026-10-25T10:00:00'
            return route.fulfill(status=204, body='')
        if table == 'rpc/am_platform_admin': return j(route, 200, uid in sb.platform)
        if table.startswith('rpc/platform_'):
            if uid not in sb.platform: return j(route, 400, {'message':'not allowed'})
            if table == 'rpc/platform_list_farms':
                return j(route, 200, [dict(f, location=f.get('location',''), created_at='2026-01-01', users=sum(1 for p in sb.profiles.values() if p['farm_id']==f['id']),
                    admin_email=next((p['email'] for p in sb.profiles.values() if p['farm_id']==f['id'] and p['role']=='admin'), None),
                    tx_count=sum(1 for r in sb.tx.values() if r['farm_id']==f['id']), last_activity=None) for f in sb.farms])
            if table == 'rpc/platform_create_farm':
                aid = body['p_admin_id']
                if aid in sb.profiles: return j(route, 400, {'message':'this account already belongs to a farm'})
                fid = 'farm-' + str(next(sb.seq))
                sb.farms.append({'id':fid,'owner_id':aid,'name':body['p_name'],'location':body.get('p_location'),'active':True,'max_users':body.get('p_max_users') or 10,'expires_at':body.get('p_expires')})
                sb.profiles[aid] = {'id':aid,'email':body['p_admin_email'],'name':body['p_admin_name'],'role':'admin','perms':[],'farm_id':fid,'active':True,'created_at':'2026-10-25T00:00:00','last_login':None}
                return j(route, 200, fid)
            if table == 'rpc/platform_update_farm':
                f = sb.farm(body['p_id']); f['active'] = body['p_active']; f['max_users'] = body['p_max_users']; f['expires_at'] = body['p_expires']
                return route.fulfill(status=204, body='')
        if table == 'rpc/wipe_my_farm_data':
            if not mf or role != 'admin': return j(route, 400, {'message':'not allowed'})
            for k in [k for k, r in sb.tx.items() if r['farm_id'] == mf]: del sb.tx[k]
            for k in [k for k, r in sb.units.items() if r['farm_id'] == mf]: del sb.units[k]
            sb.settings.pop(mf, None); sb.inv = [r for r in sb.inv if r.get('farm_id') != mf]; sb.snaps = [r for r in sb.snaps if r.get('farm_id') != mf]
            return route.fulfill(status=204, body='')
        if table == 'rpc/delete_farm_user':
            tid = body.get('p_user_id')
            if not mf or role != 'admin': return j(route, 400, {'message':'not allowed'})
            if tid == uid: return j(route, 400, {'message':'cannot delete yourself'})
            t = sb.profiles.get(tid)
            if not t or t['farm_id'] != mf: return j(route, 400, {'message':'user is not in your farm'})
            if tid in sb.platform: return j(route, 400, {'message':'cannot delete the platform owner'})
            del sb.profiles[tid]
            for e in [e for e, u in sb.users.items() if u['id'] == tid]: del sb.users[e]
            return route.fulfill(status=204, body='')
        if table == 'rpc/platform_list_errors':
            if uid not in sb.platform: return j(route, 400, {'message':'not allowed'})
            groups = {}
            for e in getattr(sb, 'errors', []):
                if e['resolved'] and not body.get('p_include_resolved'): continue
                g = groups.setdefault(e['fingerprint'], dict(e, occurrences=0, users=set(), farms=set(), last_seen=e['created_at'], last_stack=e.get('stack'), last_agent=e.get('user_agent')))
                g['occurrences'] += 1; g['users'].add(e['user_id']); g['farms'].add((sb.farm(e['farm_id']) or {}).get('name', '—'))
                g['resolved'] = g['resolved'] and e['resolved']
            return j(route, 200, [dict(g, users=len(g['users']), farms=', '.join(sorted(g['farms']))) for g in groups.values()])
        if table == 'rpc/platform_resolve_error':
            if uid not in sb.platform: return j(route, 400, {'message':'not allowed'})
            for e in getattr(sb, 'errors', []):
                if e['fingerprint'] == body['p_fingerprint']: e['resolved'] = True
            return route.fulfill(status=204, body='')
        if table == 'rpc/platform_prune_errors':
            return j(route, 200, 0) if uid in sb.platform else j(route, 400, {'message':'not allowed'})
        if table == 'client_errors':
            if m != 'POST': return deny()
            rows = body if isinstance(body, list) else [body]
            if any(r.get('user_id') != uid or (r.get('farm_id') and r.get('farm_id') != mf) for r in rows): return deny()
            if not hasattr(sb, 'errors'): sb.errors = []
            for r in rows: sb.errors.append(dict(r, created_at=time.strftime('%Y-%m-%dT%H:%M:%S'), resolved=False))
            return route.fulfill(status=201, body='')
        if table == 'rpc/update_my_farm':
            if role != 'admin': return j(route, 400, {'message':'not allowed'})
            sb.farm(mf)['name'] = body['p_name']; return route.fulfill(status=204, body='')
        # ── tables (every read/write scoped to caller's farm, like the SQL policies) ──
        if table == 'profiles':
            if not sb.profiles_table: return j(route, 404, {'code':'PGRST205','message':"Could not find the table 'public.profiles' in the schema cache"})
            if m == 'GET':
                pid = eq('id')
                vis = [p for p in sb.profiles.values() if p['id'] == uid or (mf and p['farm_id'] == mf)]
                return j(route, 200, [p for p in vis if not pid or p['id'] == pid])
            if role != 'admin': return deny()
            if m == 'POST':
                if body.get('farm_id') != mf: return deny()
                f = sb.farm(mf)
                if sum(1 for p in sb.profiles.values() if p['farm_id'] == mf) >= f['max_users']: return deny()
                sb.profiles[body['id']] = dict(body, created_at='2026-10-25T00:00:00', last_login=None); return j(route, 201, [sb.profiles[body['id']]])
            if m == 'PATCH':
                t = sb.profiles.get(eq('id'))
                if not t or t['farm_id'] != mf: return deny()
                t.update(body); return j(route, 200, [t])
        if table == 'farms':
            if m == 'GET':
                fid = eq('id'); own = eq('owner_id')
                return j(route, 200, [f for f in sb.farms if f['id'] == mf and (not fid or f['id'] == fid) and (not own or f['owner_id'] == own)])
            return deny()
        if table == 'farm_units':
            if m == 'GET': return j(route, 200, [r for r in sb.units.values() if r['farm_id'] == mf])
            if role not in ('admin','manager','engineer'): return deny()
            if m == 'POST':
                rows = body if isinstance(body, list) else [body]
                if any(r['farm_id'] != mf for r in rows): return deny()
                for r in rows: sb.units[r['id']] = r
                return j(route, 201, rows)
            if m == 'DELETE':
                r = sb.units.get(eq('id'))
                if r and r['farm_id'] == mf: del sb.units[eq('id')]
                return j(route, 200, [])
        if table == 'farm_settings':
            if m == 'GET': return j(route, 200, [{'data':sb.settings[mf]}] if mf in sb.settings else [])
            if not sb.can_write(uid) or body.get('farm_id') != mf: return deny()
            sb.settings[mf] = body['data']; return j(route, 201, [body])
        if table == 'transactions':
            if m == 'GET' and (q.get('synced_at') or 'synced_at' in q.get('select', [''])[0] or q.get('select', [''])[0] == 'id' or q.get('id', [''])[0].startswith('in.')):
                if getattr(sb, 'no_synced_at', False) and 'synced_at' in (q.get('select', [''])[0] + ''.join(q.get('synced_at', []))):
                    return j(route, 400, {'code':'42703','message':'column transactions.synced_at does not exist'})
                rows = [r for r in sb.tx.values() if r['farm_id'] == mf]
                ids = q.get('id', [''])[0]
                if ids.startswith('in.('): want = set(x.strip('"') for x in ids[4:-1].split(',')); rows = [r for r in rows if r['id'] in want]
                since = q.get('synced_at', [''])[0]
                if since.startswith('gt.'): rows = [r for r in rows if r.get('synced_at', '1970') > since[3:]]
                key = 'id' if q.get('select', [''])[0] == 'id' else 'synced_at'
                rows.sort(key=lambda r: str(r.get(key, '1970')))
                lim = int(q.get('limit', ['100000'])[0]); off = int(q.get('offset', ['0'])[0]); rows = rows[off:off + lim]
                sb.sync_rows_served = getattr(sb, 'sync_rows_served', 0) + len(rows)
                if q.get('select', [''])[0] == 'id': return j(route, 200, [{'id': r['id']} for r in rows])
                return j(route, 200, [{'data': r['data'], 'synced_at': r.get('synced_at', '1970-01-01T00:00:00Z')} for r in rows])
            if m == 'GET':
                if q.get('ts'):
                    if sb.ts_rows: return j(route, 200, sb.ts_rows)
                    since = q['ts'][0][3:]
                    rr = sorted([{'data':r['data']} for r in sb.tx.values() if r['farm_id'] == mf and str(r['data'].get('ts','')) > since], key=lambda x: str(x['data'].get('ts','')))
                    lim = int(q.get('limit', ['1000'])[0]); off = int(q.get('offset', ['0'])[0])
                    return j(route, 200, rr[off:off + lim])
                rows_all = [{'data':r['data']} for r in sb.tx.values() if r['farm_id'] == mf]
                lim = int(q.get('limit', ['100000'])[0]); off = int(q.get('offset', ['0'])[0])
                return j(route, 200, rows_all[off:off + lim])
            if m == 'POST':
                if not sb.can_write(uid): return deny()
                rows = body if isinstance(body, list) else [body]
                if any(r.get('farm_id') != mf for r in rows): return deny()
                for r in rows:
                    sb.clock = getattr(sb, 'clock', 0) + 1
                    r = dict(r, synced_at=time.strftime('%Y-%m-%dT%H:%M:%S', time.gmtime()) + '.%06dZ' % (sb.clock % 1000000))
                    sb.tx[r['id']] = r; sb.upserts[r['id']] = sb.upserts.get(r['id'], 0) + 1
                return j(route, 201, rows)
            if m == 'DELETE':
                did = eq('id')
                if did and did in sb.tx and sb.tx[did]['farm_id'] == mf: del sb.tx[did]
                return j(route, 200, [])
        if table in ('feed_inventory', 'snapshots'):
            store = sb.inv if table == 'feed_inventory' else sb.snaps
            if m == 'GET': return j(route, 200, [r for r in store if r.get('farm_id') == mf])
            rows = body if isinstance(body, list) else [body]
            if any(r.get('farm_id') != mf for r in rows): return deny()
            store.extend(rows); return j(route, 201, rows)
        return j(route, 404, {'code':'PGRST205','message':f"Could not find the table 'public.{table}'"})
    return handler

RESULTS = []
harness_browser = [None]
def check(name, cond, detail=''):
    RESULTS.append((name, bool(cond), detail)); return cond

def new_page(p, sb, url=BASE):
    ctx = harness_browser[0].new_context()
    ctx.route('**/*', make_handler(sb))
    pg = ctx.new_page()
    pg._errs = []
    pg.on('pageerror', lambda e: pg._errs.append(str(e)))
    pg.goto(url); pg.wait_for_timeout(600)
    hook_toasts(pg)
    return ctx, pg

def hook_toasts(pg):
    pg.evaluate("""() => { window.__toasts = []; const o = window.toast;
      window.toast = function(m){ window.__toasts.push(String(m)); return o.apply(this, arguments); }; }""")

def toasts(pg): return pg.evaluate('() => (window.__toasts||[]).join(" | ")')
def content(pg): return pg.inner_text('#content')
def visible_views(pg):
    return pg.evaluate("""() => Array.from(document.querySelectorAll('.sidebar [data-v]'))
       .filter(b => b.style.display !== 'none').map(b => b.getAttribute('data-v'))""")
def login(pg, email, pw):
    pg.fill('#auth-email', email); pg.fill('#auth-pass', pw); pg.click('#auth-btn'); pg.wait_for_timeout(1200)


import atexit
@atexit.register
def _report_app_errors():
    seen = {}
    for s in ALL_SB:
        for e in getattr(s, 'errors', []):
            if e.get('kind') == 'test' or 'boom' in e['message'] or 'uncaught 7' in e['message'] or 'rejected 9' in e['message'] or 'while offline' in e['message'] or 'permission denied for table transactions' in e['message']: continue
            k = (e['kind'], e['message'][:140], e.get('view'))
            seen[k] = seen.get(k, 0) + 1
    print('APP-REPORTED ERRORS during normal use:', sum(seen.values()))
    for (kind, msg, view), n in sorted(seen.items(), key=lambda x: -x[1])[:12]: print(f'   [{kind}] view={view} x{n}: {msg}')
