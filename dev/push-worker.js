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
      const subs = await db(env, 'push_subs?user_id=eq.' + user.id + '&select=id,endpoint,p256dh,auth,lang');
      return reply(await sendAll(env, subs, { ar: { t: '🔔 Dar Aqua', b: '✅ الإشعارات شغالة على الموبايل ده' }, en: { t: '🔔 Dar Aqua', b: '✅ Notifications work on this phone' }, ur: { t: '🔔 Dar Aqua', b: '✅ اس فون پر اطلاعات کام کر رہی ہیں' }, url: '?' }), 200, cors);
    }
    if (path.endsWith('/notify')) {
      // audience: "workers" (default — a work order, from supervisors only) · "supervisors" (a fault or a purchase request,
      // from anyone signed in) · "user" (a decision on someone's request, from supervisors only)
      // "perm" {perm}: the admin + everyone whose account has that permission (a fault → "fix_maint", a purchase → "approve_purchase")
      const sup = ['admin', 'manager', 'engineer'].indexOf(prof.role) >= 0, aud = body.audience || 'workers', site = String(body.farm || '');
      if (aud !== 'supervisors' && aud !== 'perm' && !sup) return reply({ error: 'supervisors only' }, 403, cors);
      const all = await db(env, 'push_subs?farm_id=eq.' + prof.farm_id + '&select=id,endpoint,role,sites,user_id,p256dh,auth,lang');
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
      return reply(await sendAll(env, subs, body.msg || null), 200, cors);
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
      const subs = (await db(env, 'push_subs?farm_id=eq.' + f.farm_id + '&select=id,endpoint,role,sites,p256dh,auth,lang'))
        .filter(s => s.role === 'worker' && (!s.sites || !s.sites.length || s.sites.some(x => sites.indexOf(x) >= 0)));
      const due = {}; sites.forEach(site => { due[site] = (R[site] || []).filter(r => { if (!r.time || !r.text) return false; const p = r.time.split(':'), m = +p[0] * 60 + +p[1]; return m <= mins && m > mins - 10 && (!r.days || !r.days.length || r.days.indexOf(wd) >= 0); }).map(r => r.text); });
      await sendAll(env, subs, sub => { const L = [].concat.apply([], sites.filter(x => !sub.sites || !sub.sites.length || sub.sites.indexOf(x) >= 0).map(x => due[x])), b = L.slice(0, 4).join(' · ');
        return { ar: { t: '⏰ الروتين', b: b }, en: { t: '⏰ Routine', b: b }, ur: { t: '⏰ روزانہ کام', b: b }, url: '?wo=1' }; });
    }
    // the weekly stock count: on its day and time → those who count ("stock_count")
    let S = null; try { S = JSON.parse((f.data || {})[STOCK_KEY] || 'null'); } catch (e) {}
    const feat = (() => { try { return JSON.parse((f.data || {})[FEATURES_KEY] || '{}') || {}; } catch (e) { return {}; } })();
    if (S && feat.stock && +S.day === wd && S.time) { const p = S.time.split(':'), m = +p[0] * 60 + +p[1];
      if (m <= mins && m > mins - 10) {
        const ps = await db(env, 'profiles?farm_id=eq.' + f.farm_id + '&select=id,role,perms');
        const ids = ps.filter(x => (Array.isArray(x.perms) ? x.perms : String(x.perms || '').split(/[,{}" ]+/)).indexOf('stock_count') >= 0).map(x => x.id);
        const subs = (await db(env, 'push_subs?farm_id=eq.' + f.farm_id + '&select=id,endpoint,user_id,p256dh,auth,lang')).filter(x => ids.indexOf(x.user_id) >= 0);
        await sendAll(env, subs, { ar: { t: '📦 جرد المخزن', b: 'النهارده يوم الجرد — سجّل الموجود في المخزن' }, en: { t: '📦 Stock count', b: 'Today is count day — record what is in the store' }, ur: { t: '📦 اسٹاک گنتی', b: 'آج گنتی کا دن ہے — اسٹور میں جو ہے درج کریں' }, url: '?' });
      } }
  }
}

// "please record this day": at the set time (default 16:30), a site whose feed (tanks) or readings (sections) today are
// fewer than yesterday gets a reminder order (seen in the app's 🔔, closes itself when complete) + a notification to
// that site's workers allowed to record it.
async function entryReminders(env) {   // today and the 7 days before: a day with fewer tanks / sections than the day before → remind (every day until done)
  const now = new Date(Date.now() + TZ_MINUTES * 60000), mins = now.getUTCHours() * 60 + now.getUTCMinutes();
  const dayStr = n => new Date(now.getTime() - n * 864e5).toISOString().slice(0, 10), today = dayStr(0), DAYS = 7;
  const farms = await db(env, 'farm_settings?select=farm_id,data');
  for (const f of farms) {
    let c = {}; try { c = JSON.parse((f.data || {})[REMIND_KEY] || '{}') || {}; } catch (e) {}
    if (c.on === false) continue; const t = (c.time || '16:30').split(':'), m = +t[0] * 60 + +t[1];
    if (!(m <= mins && m > mins - 10)) continue;
    const units = {}; (await db(env, 'farm_units?farm_id=eq.' + f.farm_id + '&select=unit,data')).forEach(u => { units[u.unit] = (u.data || {}).farm; });
    const site = u => units[u] || String(u || '').split('.')[0];
    const rows = await db(env, 'transactions?farm_id=eq.' + f.farm_id + '&date=gte.' + dayStr(DAYS + 1) + '&type=in.(feeding,water_quality)&select=unit,type,date,data&limit=20000');
    const cnt = {}; rows.forEach(r => { if ((r.data || {}).deleted) return; const what = r.type === 'feeding' ? 'feed' : 'wq';
      if (what === 'wq' && (r.data || {}).scope !== 'section') return;
      const k = site(r.unit) + '|' + what + '|' + r.date; (cnt[k] = cnt[k] || {})[r.unit] = 1; });
    const sites = {}; Object.keys(cnt).forEach(k => { sites[k.split('|')[0]] = 1; });
    const miss = [];
    for (const st of Object.keys(sites)) for (const what of ['feed', 'wq']) { if (c[what] === false) continue;
      for (let k = 0; k <= DAYS; k++) { const d = dayStr(k), prev = dayStr(k + 1);
        const y = Object.keys(cnt[st + '|' + what + '|' + prev] || {}).length, n = Object.keys(cnt[st + '|' + what + '|' + d] || {}).length;
        if (y > 0 && n < y) miss.push({ site: st, what: what, day: d, n: y - n }); } }
    if (!miss.length) continue;
    for (const x of miss) {   // the reminder order, once per site, day and kind (the app closes it when that day is complete)
      const id = 'rm-auto-' + x.site + '-' + x.day + '-' + x.what, ts = new Date().toISOString();
      const data = { id: id, type: 'work_order', date: x.day, unit: '', farm: x.site, kind: 'remind', what: x.what, tanks: [], text: x.n + (x.what === 'feed' ? ' تانك' : ' سكشن') + ' ناقصين', status: 'open', auto: true, byName: '⏰', issued: today, ts: ts };
      await fetch(SUPABASE_URL + '/rest/v1/transactions', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates' }, svc(env)),
        body: JSON.stringify([{ id: id, farm_id: f.farm_id, type: 'work_order', date: x.day, unit: '', data: data, ts: ts }]) });
    }
    const ps = await db(env, 'profiles?farm_id=eq.' + f.farm_id + '&select=id,role,perms');
    const permsOf = {}; ps.forEach(p => { permsOf[p.id] = p.role === 'worker' ? (Array.isArray(p.perms) ? p.perms : String(p.perms || '').split(/[,{}" ]+/)) : null; });
    const subs = (await db(env, 'push_subs?farm_id=eq.' + f.farm_id + '&select=id,endpoint,user_id,sites,p256dh,auth,lang'))
      .map(s => { const pr = permsOf[s.user_id]; if (!pr) return null;
        const mine = miss.filter(x => pr.indexOf(x.what === 'wq' ? 'input_wq' : 'input_feeding') >= 0 && (!s.sites || !s.sites.length || s.sites.indexOf(x.site) >= 0));
        return mine.length ? Object.assign({}, s, { _mine: mine }) : null; }).filter(Boolean);
    const W = { ar: { feed: 'علف', wq: 'قياسات', today: 'النهارده', day: 'يوم', u: { feed: 'تانك', wq: 'سكشن' }, t: '📝 فاضلك تسجيل' },
      en: { feed: 'Feed', wq: 'Readings', today: 'today', day: '', u: { feed: 'tanks', wq: 'sections' }, t: '📝 Still to record' },
      ur: { feed: 'فیڈ', wq: 'پانی کی جانچ', today: 'آج', day: 'دن', u: { feed: 'ٹینک', wq: 'سیکشن' }, t: '📝 ابھی درج کرنا ہے' } };
    await sendAll(env, subs, sub => { const o = { url: '?wo=1', tag: 'da-remind' }, L = sub._mine.slice().sort((a, b) => b.day.localeCompare(a.day));
      ['ar', 'en', 'ur'].forEach(l => { const w = W[l];
        o[l] = { t: w.t, b: L.slice(0, 4).map(x => w[x.what] + ' ' + x.site + ' ' + (x.day === today ? w.today : (w.day ? w.day + ' ' : '') + x.day.slice(8) + '-' + x.day.slice(5, 7)) + ' (' + x.n + ' ' + w.u[x.what] + ')').join(' · ') + (L.length > 4 ? ' …+' + (L.length - 4) : '') }; });
      return o; });
  }
}

function pick(msg, sub) { if (!msg) return null; const m = typeof msg === 'function' ? msg(sub) : msg; if (!m) return null; const l = m[sub.lang] || m.ar || m.en; return l ? { t: l.t, b: l.b, url: m.url || '?wo=1', tag: m.tag } : null; }
async function sendAll(env, subs, msg) {
  let sent = 0, gone = 0; const codes = [];
  for (const s of subs) {
    let r; try { r = await pushOne(env, s.endpoint, s, pick(msg, s)); } catch (e) { codes.push('ERR ' + String(e && e.message || e).slice(0, 60)); continue; }
    codes.push(r.status);
    if (r.status === 404 || r.status === 410) { gone++; await fetch(SUPABASE_URL + '/rest/v1/push_subs?id=eq.' + encodeURIComponent(s.id), { method: 'DELETE', headers: svc(env) }); }
    else if (r.ok) sent++;
  }
  return { sent: sent, removed: gone, total: subs.length, codes: codes.slice(0, 5) };
}

async function pushOne(env, endpoint, sub, payload) {   // VAPID (RFC 8292); with the phone's keys the message itself is sent, encrypted (RFC 8291)
  const aud = new URL(endpoint).origin;
  const jwt = await vapidJwt(env, aud);
  const h = { Authorization: 'vapid t=' + jwt + ', k=' + env.VAPID_PUBLIC, TTL: '86400', Urgency: 'high' };
  if (payload && sub && sub.p256dh && sub.auth) {
    const body = await encryptPayload(sub.p256dh, sub.auth, new TextEncoder().encode(JSON.stringify(payload)));
    return fetch(endpoint, { method: 'POST', headers: Object.assign(h, { 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream' }), body: body });
  }
  return fetch(endpoint, { method: 'POST', headers: Object.assign(h, { 'Content-Length': '0' }) });
}

// ── message encryption for Web Push (RFC 8291, aes128gcm) with WebCrypto only ──
function b64uDec(s) { s = String(s).replace(/-/g, '+').replace(/_/g, '/'); s += '==='.slice((s.length + 3) % 4); const r = atob(s), a = new Uint8Array(r.length); for (let i = 0; i < r.length; i++) a[i] = r.charCodeAt(i); return a; }
function cat(...arrs) { const n = arrs.reduce((t, a) => t + a.length, 0), out = new Uint8Array(n); let o = 0; arrs.forEach(a => { out.set(a, o); o += a.length; }); return out; }
async function hmac(key, data) { const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return new Uint8Array(await crypto.subtle.sign('HMAC', k, data)); }
async function hkdf(salt, ikm, info, len) { const prk = await hmac(salt, ikm); return (await hmac(prk, cat(info, new Uint8Array([1])))).slice(0, len); }
async function encryptPayload(p256dhB64, authB64, plain) {
  const uaPub = b64uDec(p256dhB64), authSecret = b64uDec(authB64), te = new TextEncoder();
  const as = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, as.privateKey, 256));
  const ikm = await hkdf(authSecret, shared, cat(te.encode('WebPush: info'), new Uint8Array([0]), uaPub, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, cat(te.encode('Content-Encoding: aes128gcm'), new Uint8Array([0])), 16);
  const nonce = await hkdf(salt, ikm, cat(te.encode('Content-Encoding: nonce'), new Uint8Array([0])), 12);
  const key = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, key, cat(plain, new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]);   // record size 4096
  return cat(salt, rs, new Uint8Array([asPub.length]), asPub, ct);
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
