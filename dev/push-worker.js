// Farm Manager — phone notifications Worker (farm-push)
// • POST /notify  {farm, audience}  work order → that site's workers; fault / purchase → supervisors; decision → the requester
// • POST /test                  sends a test notification to the caller's own phone(s)
// • every 10 minutes (Cron)     daily-routine items whose time came → the workers of that site get a reminder
// No payload is sent (no encryption needed): the phone shows "new work order / open the app" in its own language.
// Secrets (Settings → Variables and Secrets): VAPID_PUBLIC (text), VAPID_PRIVATE_JWK (the JSON), SUPABASE_SERVICE_KEY.
// Trigger (Settings → Triggers → Cron): */10 * * * *

const ALLOWED_ORIGINS = ['https://mohammedshehta93.github.io'];
const SUPABASE_URL = 'https://mjtxibdxqxrgykuyftsr.supabase.co';
const SUPABASE_PUBLIC_KEY = 'sb_publishable_ewZ1G10CJIIUcZHYaEd22w_ud573IW3'; // public by design
const ROUTINE_KEY = 'daracqua_plan_v1_routine';
const STOCK_KEY = 'daracqua_settings_v2_stock', FEATURES_KEY = 'daracqua_settings_v2_features', REMIND_KEY = 'daracqua_settings_v2_remind';
const TZ_MINUTES = 180; // Bahrain = UTC+3

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = ALLOWED_ORIGINS.includes(origin);
    const cors = { 'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGINS[0], 'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Vary': 'Origin' };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method === 'GET') return reply({ ok: true, service: 'farm-push', secrets: { VAPID_PUBLIC: !!env.VAPID_PUBLIC, VAPID_PRIVATE_JWK: !!env.VAPID_PRIVATE_JWK, SUPABASE_SERVICE_KEY: !!env.SUPABASE_SERVICE_KEY } }, 200, cors);
    if (request.method !== 'POST') return reply({ error: 'POST only' }, 405, cors);
    if (!allowed) return reply({ error: 'origin not allowed' }, 403, cors);
    const auth = request.headers.get('Authorization') || '';
    if (!auth.startsWith('Bearer ') || auth.length < 30) return reply({ error: 'sign in required' }, 401, cors);
    const who = await fetch(SUPABASE_URL + '/auth/v1/user', { headers: { apikey: SUPABASE_PUBLIC_KEY, Authorization: auth } });
    if (!who.ok) return reply({ error: 'session expired' }, 401, cors);
    const user = await who.json();
    const prof = (await db(env, 'profiles?id=eq.' + user.id + '&select=farm_id,role'))[0];
    if (!prof) return reply({ error: 'no profile' }, 403, cors);
    let body = {}; try { body = await request.json(); } catch (e) {}
    const path = new URL(request.url).pathname;
    if (path.endsWith('/test')) {
      const subs = await db(env, 'push_subs?user_id=eq.' + user.id + '&select=id,endpoint');
      return reply(await sendAll(env, subs), 200, cors);
    }
    if (path.endsWith('/notify')) {
      // audience: "workers" (default — a work order, from supervisors only) · "supervisors" (a fault or a purchase request,
      // from anyone signed in) · "user" (a decision on someone's request, from supervisors only)
      // "perm" {perm}: the admin + everyone whose account has that permission (a fault → "fix_maint", a purchase → "approve_purchase")
      const sup = ['admin', 'manager', 'engineer'].indexOf(prof.role) >= 0, aud = body.audience || 'workers', site = String(body.farm || '');
      if (aud !== 'supervisors' && aud !== 'perm' && !sup) return reply({ error: 'supervisors only' }, 403, cors);
      const all = await db(env, 'push_subs?farm_id=eq.' + prof.farm_id + '&select=id,endpoint,role,sites,user_id');
      const siteOk = s => !site || !s.sites || !s.sites.length || s.sites.indexOf(site) >= 0;
      let allowed = null;
      if (aud === 'perm') { const perm = String(body.perm || ''); const ps = await db(env, 'profiles?farm_id=eq.' + prof.farm_id + '&select=id,role,perms');
        allowed = ps.filter(p => p.role === 'admin' || (Array.isArray(p.perms) ? p.perms : String(p.perms || '').split(/[,{}" ]+/)).indexOf(perm) >= 0).map(p => p.id); }
      const subs = all.filter(s => s.user_id !== user.id && (
        aud === 'user' ? s.user_id === body.uid :
        aud === 'users' ? (body.uids || []).indexOf(s.user_id) >= 0 :
        aud === 'perm' ? allowed.indexOf(s.user_id) >= 0 && siteOk(s) :
        aud === 'supervisors' ? ['admin', 'manager', 'engineer'].indexOf(s.role) >= 0 && siteOk(s) :
        s.role === 'worker' && siteOk(s)));
      return reply(await sendAll(env, subs), 200, cors);
    }
    return reply({ error: 'unknown path' }, 404, cors);
  },
  async scheduled(event, env, ctx) { ctx.waitUntil(Promise.all([routineReminders(env), entryReminders(env)])); }
};

async function routineReminders(env) {   // items whose time fell in the last 10 minutes, today's weekday, per site
  const now = new Date(Date.now() + TZ_MINUTES * 60000), mins = now.getUTCHours() * 60 + now.getUTCMinutes(), wd = now.getUTCDay();
  const farms = await db(env, 'farm_settings?select=farm_id,data');
  for (const f of farms) {
    let R = {}; try { R = JSON.parse((f.data || {})[ROUTINE_KEY] || '{}') || {}; } catch (e) { continue; }
    const sites = Object.keys(R).filter(site => (R[site] || []).some(r => {
      if (!r.time || !r.text) return false; const p = r.time.split(':'), m = +p[0] * 60 + +p[1];
      return m <= mins && m > mins - 10 && (!r.days || !r.days.length || r.days.indexOf(wd) >= 0); }));
    if (sites.length) {
      const subs = (await db(env, 'push_subs?farm_id=eq.' + f.farm_id + '&select=id,endpoint,role,sites'))
        .filter(s => s.role === 'worker' && (!s.sites || !s.sites.length || s.sites.some(x => sites.indexOf(x) >= 0)));
      await sendAll(env, subs);
    }
    // the weekly stock count: on its day and time → those who count ("stock_count")
    let S = null; try { S = JSON.parse((f.data || {})[STOCK_KEY] || 'null'); } catch (e) {}
    const feat = (() => { try { return JSON.parse((f.data || {})[FEATURES_KEY] || '{}') || {}; } catch (e) { return {}; } })();
    if (S && feat.stock && +S.day === wd && S.time) { const p = S.time.split(':'), m = +p[0] * 60 + +p[1];
      if (m <= mins && m > mins - 10) {
        const ps = await db(env, 'profiles?farm_id=eq.' + f.farm_id + '&select=id,role,perms');
        const ids = ps.filter(x => (Array.isArray(x.perms) ? x.perms : String(x.perms || '').split(/[,{}" ]+/)).indexOf('stock_count') >= 0).map(x => x.id);
        const subs = (await db(env, 'push_subs?farm_id=eq.' + f.farm_id + '&select=id,endpoint,user_id')).filter(x => ids.indexOf(x.user_id) >= 0);
        await sendAll(env, subs);
      } }
  }
}

// "please record this day": at the set time (default 16:30), a site whose feed (tanks) or readings (sections) today are
// fewer than yesterday gets a reminder order (seen in the app's 🔔, closes itself when complete) + a notification to
// that site's workers allowed to record it.
async function entryReminders(env) {
  const now = new Date(Date.now() + TZ_MINUTES * 60000), mins = now.getUTCHours() * 60 + now.getUTCMinutes();
  const day = d => new Date(d.getTime()).toISOString().slice(0, 10), today = day(now), yest = day(new Date(now.getTime() - 864e5));
  const farms = await db(env, 'farm_settings?select=farm_id,data');
  for (const f of farms) {
    let c = {}; try { c = JSON.parse((f.data || {})[REMIND_KEY] || '{}') || {}; } catch (e) {}
    if (c.on === false) continue; const t = (c.time || '16:30').split(':'), m = +t[0] * 60 + +t[1];
    if (!(m <= mins && m > mins - 10)) continue;
    const units = {}; (await db(env, 'farm_units?farm_id=eq.' + f.farm_id + '&select=unit,data')).forEach(u => { units[u.unit] = (u.data || {}).farm; });
    const site = u => units[u] || String(u || '').split('.')[0];
    const rows = await db(env, 'transactions?farm_id=eq.' + f.farm_id + '&date=in.(' + yest + ',' + today + ')&type=in.(feeding,water_quality)&select=unit,type,date,data');
    const cnt = {}; rows.forEach(r => { if ((r.data || {}).deleted) return; const what = r.type === 'feeding' ? 'feed' : 'wq';
      if (what === 'wq' && (r.data || {}).scope !== 'section') return;
      const k = site(r.unit) + '|' + what + '|' + r.date; (cnt[k] = cnt[k] || {})[r.unit] = 1; });
    const sites = {}; Object.keys(cnt).forEach(k => { sites[k.split('|')[0]] = 1; });
    let ps = null;
    for (const st of Object.keys(sites)) for (const what of ['feed', 'wq']) {
      if (c[what] === false) continue;
      const y = Object.keys(cnt[st + '|' + what + '|' + yest] || {}).length, n = Object.keys(cnt[st + '|' + what + '|' + today] || {}).length;
      if (!(y > 0 && n < y)) continue;
      const id = 'rm-auto-' + st + '-' + today + '-' + what, ts = new Date().toISOString();
      const data = { id: id, type: 'work_order', date: today, unit: '', farm: st, kind: 'remind', what: what, tanks: [], text: (y - n) + (what === 'feed' ? ' تانك' : ' سكشن') + ' ناقصين', status: 'open', auto: true, byName: '⏰', issued: today, ts: ts };
      await fetch(SUPABASE_URL + '/rest/v1/transactions', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates' }, svc(env)),
        body: JSON.stringify([{ id: id, farm_id: f.farm_id, type: 'work_order', date: today, unit: '', data: data, ts: ts }]) });
      ps = ps || await db(env, 'profiles?farm_id=eq.' + f.farm_id + '&select=id,role,perms');
      const perm = what === 'wq' ? 'input_wq' : 'input_feeding';
      const ids = ps.filter(p => p.role === 'worker' && (Array.isArray(p.perms) ? p.perms : String(p.perms || '').split(/[,{}" ]+/)).indexOf(perm) >= 0).map(p => p.id);
      const subs = (await db(env, 'push_subs?farm_id=eq.' + f.farm_id + '&select=id,endpoint,user_id,sites')).filter(x => ids.indexOf(x.user_id) >= 0 && (!x.sites || !x.sites.length || x.sites.indexOf(st) >= 0));
      await sendAll(env, subs);
    }
  }
}

async function sendAll(env, subs) {
  let sent = 0, gone = 0; const codes = [];
  for (const s of subs) {
    let r; try { r = await pushOne(env, s.endpoint); } catch (e) { codes.push('ERR ' + String(e && e.message || e).slice(0, 60)); continue; }
    codes.push(r.status);
    if (r.status === 404 || r.status === 410) { gone++; await fetch(SUPABASE_URL + '/rest/v1/push_subs?id=eq.' + encodeURIComponent(s.id), { method: 'DELETE', headers: svc(env) }); }
    else if (r.ok) sent++;
  }
  return { sent: sent, removed: gone, total: subs.length, codes: codes.slice(0, 5) };
}

async function pushOne(env, endpoint) {   // Web Push with no payload: only the VAPID signature (RFC 8292)
  const aud = new URL(endpoint).origin;
  const jwt = await vapidJwt(env, aud);
  return fetch(endpoint, { method: 'POST', headers: { Authorization: 'vapid t=' + jwt + ', k=' + env.VAPID_PUBLIC, TTL: '86400', Urgency: 'high', 'Content-Length': '0' } });
}

async function vapidJwt(env, aud) {
  const enc = s => b64u(new TextEncoder().encode(s));
  const head = enc(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const claims = enc(JSON.stringify({ aud: aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: 'mailto:farm@dar-aqua.app' }));
  const key = await crypto.subtle.importKey('jwk', JSON.parse(env.VAPID_PRIVATE_JWK), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(head + '.' + claims));
  return head + '.' + claims + '.' + b64u(new Uint8Array(sig));
}

function b64u(bytes) { let s = ''; bytes.forEach(b => { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function svc(env) { return { apikey: env.SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_KEY }; }
async function db(env, q) { const r = await fetch(SUPABASE_URL + '/rest/v1/' + q, { headers: svc(env) }); return r.ok ? r.json() : []; }
function reply(obj, status, headers) { return new Response(JSON.stringify(obj), { status: status, headers: Object.assign({}, headers, { 'Content-Type': 'application/json' }) }); }
