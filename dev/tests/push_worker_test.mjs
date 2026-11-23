// Worker logic test: node dev/tests/push_worker_test.mjs (fake Supabase + fake push servers; throwaway keys)
import fs from 'fs'; import path from 'path'; import url from 'url';
const here = path.dirname(url.fileURLToPath(import.meta.url));
fs.copyFileSync(path.join(here, '..', 'push-worker.js'), '/tmp/push-worker-under-test.mjs');
const W = (await import('/tmp/push-worker-under-test.mjs')).default;
const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const raw = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
const V = { public: Buffer.from(raw).toString('base64url'), jwk: await crypto.subtle.exportKey('jwk', kp.privateKey) };
const env = { VAPID_PUBLIC: V.public, VAPID_PRIVATE_JWK: JSON.stringify(V.jwk), SUPABASE_SERVICE_KEY: 'svc' };
const SUBS = [
  { id: 'a', endpoint: 'https://push.example/a', role: 'worker', sites: ['F3'], user_id: 'w1' },
  { id: 'b', endpoint: 'https://push.example/b', role: 'worker', sites: ['F1'], user_id: 'w2' },
  { id: 'c', endpoint: 'https://push.example/gone', role: 'worker', sites: null, user_id: 'w3' },
  { id: 'd', endpoint: 'https://push.example/d', role: 'engineer', sites: null, user_id: 'e1' }];
const log = { pushed: [], deleted: [], vapidOk: true };
const now = new Date(Date.now() + 180 * 60000), hm = n => { const m = now.getUTCHours() * 60 + now.getUTCMinutes() - n; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
globalThis.fetch = async (url, o = {}) => {
  url = String(url);
  if (url.endsWith('/auth/v1/user')) return new Response(JSON.stringify({ id: 'e1' }));
  if (url.includes('/rest/v1/profiles?id=eq.')) return new Response(JSON.stringify([{ farm_id: 'farm-1', role: 'engineer' }]));
  if (url.includes('/rest/v1/profiles?farm_id=eq.')) return new Response(JSON.stringify([{ id: 'w2', role: 'worker', perms: ['fix_maint', 'stock_count'] }, { id: 'w1', role: 'worker', perms: ['input_feeding'] }, { id: 'e1', role: 'engineer', perms: [] }]));
  if (url.includes('/rest/v1/push_subs') && o.method === 'DELETE') { log.deleted.push(url.split('id=eq.')[1]); return new Response(null, { status: 204 }); }
  if (url.includes('/rest/v1/push_subs')) return new Response(JSON.stringify(url.includes('user_id=eq.e1') ? SUBS.filter(s => s.user_id === 'e1') : SUBS));
  if (url.includes('/rest/v1/farm_settings')) return new Response(JSON.stringify([{ farm_id: 'farm-1', data: { daracqua_plan_v1_routine: JSON.stringify({ F3: [{ id: 'r1', time: hm(3), text: 'O2', days: null }], F1: [{ id: 'r2', time: hm(30), text: 'late', days: null }] }), daracqua_settings_v2_features: JSON.stringify({ stock: true }), daracqua_settings_v2_stock: JSON.stringify({ day: now.getUTCDay(), time: hm(2), items: [] }) } }]));
  if (url.startsWith('https://push.example/')) { if (!/^vapid t=.+\..+\..+, k=/.test(o.headers.Authorization)) log.vapidOk = false; log.pushed.push(url.split('/').pop()); return new Response('', { status: url.endsWith('gone') ? 410 : 201 }); }
  return new Response('?', { status: 404 });
};
const req = (path, body) => new Request('https://farm-push.x.workers.dev' + path, { method: 'POST', headers: { Origin: 'https://mohammedshehta93.github.io', Authorization: 'Bearer ' + 'x'.repeat(40), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
let r = await (await W.fetch(req('/notify', { farm: 'F3' }), env)).json();
console.log('notify F3 →', r, '| pushed', log.pushed.join(','), '| removed', log.deleted.join(','));
console.log('  ✔ only F3 workers + all-site workers, not F1, not the sender:', log.pushed.join(',') === 'a,gone' && log.deleted.join(',') === 'c');
log.pushed = []; log.deleted = [];
r = await (await W.fetch(req('/test', {}), env)).json(); console.log('test → own phone only:', log.pushed.join(',') === 'd', r);
log.pushed = [];
let p = []; await W.scheduled({}, env, { waitUntil: x => p.push(x) }); await Promise.all(p);
console.log('cron → routine due (F3 workers) + the stock count reminder (only the counter w2):', log.pushed.join(',') === 'a,gone,b', log.pushed.join(','));
console.log('VAPID header on every push:', log.vapidOk);
log.pushed = []; r = await (await W.fetch(req('/notify', { farm: 'F3', audience: 'supervisors' }), env)).json();
console.log('audience supervisors → engineers / admins only (the sender e1 excluded):', log.pushed.join(',') === '', r);
log.pushed = []; r = await (await W.fetch(req('/notify', { audience: 'user', uid: 'w2' }), env)).json();
console.log('audience user → that person only:', log.pushed.join(',') === 'b', r);
log.pushed = []; r = await (await W.fetch(req('/notify', { audience: 'perm', perm: 'fix_maint' }), env)).json();
console.log('audience perm fix_maint → only the technician (w2):', log.pushed.join(',') === 'b', r);
r = await W.fetch(new Request('https://x/notify', { method: 'POST', headers: { Origin: 'https://evil.example' } }), env); console.log('other sites refused:', r.status === 403);

// ── automatic "please record" reminders: today and missed days, one encrypted message per person, in their language ──
{ const { createRequire } = await import('module'); const require = createRequire('/tmp/jstools/'); let ece = null; try { ece = require('http_ece'); } catch (e) {}
  const nodeCrypto = await import('crypto');
  const now2 = new Date(Date.now() + 180 * 60000), D = n => new Date(now2.getTime() - n * 864e5).toISOString().slice(0, 10), today = D(0);
  const hm2 = n => { const m = now2.getUTCHours() * 60 + now2.getUTCMinutes() - n; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
  const phone = nodeCrypto.createECDH('prime256v1'); phone.generateKeys(); const authS = nodeCrypto.randomBytes(16), b64u = x => Buffer.from(x).toString('base64url');
  const inserted = [], bodies = [];
  const rows = [], feed = (u, d) => rows.push({ unit: u, type: 'feeding', date: d, data: {} });
  for (let i = 1; i <= 14; i++) feed('F2.S01T' + String(i).padStart(2, '0'), D(1));      // yesterday 14
  for (let i = 1; i <= 9; i++) feed('F2.S01T' + String(i).padStart(2, '0'), D(0));       // today 9 → 5 missing
  for (let i = 1; i <= 10; i++) feed('F2.S01T' + String(i).padStart(2, '0'), D(4));      // 4 days ago 10
  for (let i = 1; i <= 6; i++) feed('F2.S01T' + String(i).padStart(2, '0'), D(3));       // 3 days ago 6 → 4 missing (a missed day)
  for (let i = 1; i <= 3; i++) { feed('F1.S01T0' + i, D(1)); feed('F1.S01T0' + i, D(0)); }
  globalThis.fetch = async (url, o = {}) => { url = String(url);
    if (url.includes('/rest/v1/farm_settings')) return new Response(JSON.stringify([{ farm_id: 'farm-1', data: { daracqua_settings_v2_remind: JSON.stringify({ on: true, time: hm2(3) }) } }]));
    if (url.includes('/rest/v1/farm_units')) return new Response('[]');
    if (url.includes('/rest/v1/transactions') && o.method === 'POST') { inserted.push(JSON.parse(o.body)[0]); return new Response(null, { status: 201 }); }
    if (url.includes('/rest/v1/transactions')) return new Response(JSON.stringify(rows));
    if (url.includes('/rest/v1/profiles')) return new Response(JSON.stringify([{ id: 'w1', role: 'worker', perms: ['input_feeding', 'farm:F2'] }, { id: 'w2', role: 'worker', perms: ['input_wq'] }]));
    if (url.includes('/rest/v1/push_subs')) return new Response(JSON.stringify([{ id: 'a', endpoint: 'https://push.example/a', user_id: 'w1', sites: ['F2'], lang: 'ur', p256dh: b64u(phone.getPublicKey()), auth: b64u(authS) }, { id: 'b', endpoint: 'https://push.example/b', user_id: 'w2', sites: ['F2'] }]));
    if (url.startsWith('https://push.example/')) { bodies.push({ to: url.split('/').pop(), enc: o.headers['Content-Encoding'], body: o.body }); return new Response('', { status: 201 }); }
    return new Response('[]'); };
  const p2 = []; await W.scheduled({}, env, { waitUntil: x => p2.push(x) }); await Promise.all(p2);
  const ids = inserted.map(x => x.id).sort();
  console.log('16:30 → today (5), a day nobody recorded (2 days ago, 6) and a half-done day (3 days ago, 4); F1 complete:', JSON.stringify(ids) === JSON.stringify(['rm-auto-F2-' + D(2) + '-feed', 'rm-auto-F2-' + D(3) + '-feed', 'rm-auto-F2-' + today + '-feed'].sort()), ids);
  console.log('  … one notification, only to the F2 feed worker, encrypted:', bodies.length === 1 && bodies[0].to === 'a' && bodies[0].enc === 'aes128gcm');
  if (ece && bodies[0]) { const msg = JSON.parse(ece.decrypt(Buffer.from(bodies[0].body), { version: 'aes128gcm', privateKey: phone, authSecret: authS }).toString('utf8'));
    console.log('  … decrypted on the "phone", in his language (Urdu), listing both days:', msg.t.includes('درج') && msg.b.includes('آج') && msg.b.includes('(5 ٹینک)') && msg.b.includes('(6 ٹینک)') && msg.b.includes('(4 ٹینک)'), msg); }
}
