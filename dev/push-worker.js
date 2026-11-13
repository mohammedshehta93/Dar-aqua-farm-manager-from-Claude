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
      const sup = ['admin', 'manager', 'engineer'].indexOf(prof.role) >= 0, aud = body.audience || 'workers', site = String(body.farm || '');
      if (aud !== 'supervisors' && !sup) return reply({ error: 'supervisors only' }, 403, cors);
      const all = await db(env, 'push_subs?farm_id=eq.' + prof.farm_id + '&select=id,endpoint,role,sites,user_id');
      const siteOk = s => !site || !s.sites || !s.sites.length || s.sites.indexOf(site) >= 0;
      const subs = all.filter(s => s.user_id !== user.id && (
        aud === 'user' ? s.user_id === body.uid :
        aud === 'supervisors' ? ['admin', 'manager', 'engineer'].indexOf(s.role) >= 0 && siteOk(s) :
        s.role === 'worker' && siteOk(s)));
      return reply(await sendAll(env, subs), 200, cors);
    }
    return reply({ error: 'unknown path' }, 404, cors);
  },
  async scheduled(event, env, ctx) { ctx.waitUntil(routineReminders(env)); }
};

async function routineReminders(env) {   // items whose time fell in the last 10 minutes, today's weekday, per site
  const now = new Date(Date.now() + TZ_MINUTES * 60000), mins = now.getUTCHours() * 60 + now.getUTCMinutes(), wd = now.getUTCDay();
  const farms = await db(env, 'farm_settings?select=farm_id,data');
  for (const f of farms) {
    let R = {}; try { R = JSON.parse((f.data || {})[ROUTINE_KEY] || '{}') || {}; } catch (e) { continue; }
    const sites = Object.keys(R).filter(site => (R[site] || []).some(r => {
      if (!r.time || !r.text) return false; const p = r.time.split(':'), m = +p[0] * 60 + +p[1];
      return m <= mins && m > mins - 10 && (!r.days || !r.days.length || r.days.indexOf(wd) >= 0); }));
    if (!sites.length) continue;
    const subs = (await db(env, 'push_subs?farm_id=eq.' + f.farm_id + '&select=id,endpoint,role,sites'))
      .filter(s => s.role === 'worker' && (!s.sites || !s.sites.length || s.sites.some(x => sites.indexOf(x) >= 0)));
    await sendAll(env, subs);
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
