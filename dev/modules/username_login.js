// ══════════════════════════════════════════════════════════
//  WORKERS LOG IN WITH A USERNAME (no email needed)
// ══════════════════════════════════════════════════════════
// Supabase Auth needs an email, so a worker's username becomes an internal address the worker never sees:
// "irfan" → irfan@workers.dar-aqua.app. Admins / engineers keep logging in with their real email. Usernames are latin
// letters / digits / . _ - (3–30), unique. No mail is ever sent to these addresses (recovery is blocked: the admin
// sets a new password). Requires "Confirm email" OFF in Supabase Auth, otherwise new accounts wait for a confirmation.
var DA_USER_DOMAIN = 'workers.dar-aqua.app';
function daLoginEmail(v){ v = String(v || '').trim().toLowerCase(); return v && v.indexOf('@') < 0 ? v + '@' + DA_USER_DOMAIN : v; }
function daIsUsername(v){ return /^[a-z0-9][a-z0-9._-]{2,29}$/.test(String(v || '').trim().toLowerCase()); }
function daIsWorkerEmail(e){ return String(e || '').toLowerCase().slice(-(DA_USER_DOMAIN.length + 1)) === '@' + DA_USER_DOMAIN; }
function daHideWorkerEmails(root){   // "irfan@workers.dar-aqua.app" → "👤 irfan" in whatever is on screen
  if(!root) return; var re = new RegExp('([a-z0-9._-]+)@' + DA_USER_DOMAIN.replace(/\./g, '\\.'), 'g'), w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), n, list = [];
  while((n = w.nextNode())) if(n.nodeValue.indexOf('@' + DA_USER_DOMAIN) >= 0) list.push(n);
  list.forEach(function(t){ t.nodeValue = t.nodeValue.replace(re, '👤 $1'); });
}
// ── share the login on WhatsApp ──
function daAppUrl(){ return location.origin + location.pathname; }
function daLoginMsg(name, user, pass){
  return 'أهلاً ' + name + ' 👋\nده رابط أداة مزرعة ' + daFarmName() + ':\n' + daAppUrl() + '\n\n👤 اسم المستخدم: ' + daShowLogin(user) + (pass ? '\n🔑 كلمة السر: ' + pass : '\n🔑 كلمة السر: اللي المدير ادهالك')
    + '\n\nافتح الرابط ← اكتب اسم المستخدم وكلمة السر ← دخول.\nومن قايمة المتصفح اختار «إضافة إلى الشاشة الرئيسية» عشان تفتحها زي الأبلكيشن.';
}
function daWhatsApp(text){ window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank'); }
async function daCopyText(text){ try{ await navigator.clipboard.writeText(text); toast('📋 اتنسخت الرسالة'); }catch(e){ toast('⚠️ مقدرتش أنسخ'); } }
function daShareCard(name, user, pass){
  var c = document.getElementById('content'); if(!c) return; var old = document.getElementById('um-share'); if(old) old.remove();
  var msg = daLoginMsg(name, user, pass), d = document.createElement('div'); d.id = 'um-share'; d.className = 'card'; d.style.cssText = 'margin-bottom:12px;border:2px solid #25d366';
  d.innerHTML = '<div class="card-title">📲 ابعت بيانات الدخول لـ ' + daEsc(name) + ' <button onclick="this.closest(&quot;#um-share&quot;).remove()" style="border:0;background:none;cursor:pointer;color:var(--muted)">✕</button></div>'
    + '<pre style="white-space:pre-wrap;font:inherit;font-size:13px;background:#f8fafc;border-radius:8px;padding:10px;margin:0 0 8px">' + daEsc(msg) + '</pre>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap"><button id="um-share-wa" class="savebtn" style="width:auto;padding:9px 18px;background:#25d366">📲 ابعت على واتساب</button><button id="um-share-copy" style="padding:9px 14px;border:1.5px solid var(--line);background:#fff;border-radius:8px;font:inherit;cursor:pointer">📋 انسخ الرسالة</button></div>'
    + '<div style="font-size:11px;color:var(--amber);margin-top:6px">كلمة السر بتظهر هنا مرة واحدة بس — ابعتها دلوقتي.</div>';
  c.insertBefore(d, c.firstChild.nextSibling);
  d.querySelector('#um-share-wa').onclick = function(){ daWhatsApp(msg); };
  d.querySelector('#um-share-copy').onclick = function(){ daCopyText(msg); };
}
function daShareButtons(){   // 📲 next to each user in the list: link + username (no password — it is not kept)
  if(typeof _umProfiles === 'undefined') return; var rows = document.querySelectorAll('#content table tbody tr'), k = 0;
  _umProfiles.forEach(function(p, i){ var tr = rows[i]; if(!tr || tr.querySelector('.um-wa')) return; var td = tr.cells[tr.cells.length - 1]; if(!td) return;
    var b = document.createElement('button'); b.className = 'um-wa'; b.title = 'ابعت الرابط واسم المستخدم على واتساب'; b.textContent = '📲';
    b.style.cssText = 'padding:4px 8px;border:0;border-radius:6px;font:inherit;font-size:12px;cursor:pointer;background:#25d366;color:#fff;margin-inline-start:4px';
    b.onclick = function(){ daWhatsApp(daLoginMsg(p.name || daShowLogin(p.email), p.email, '')); }; td.appendChild(b); k++; });
}
function daShowLogin(e){ return daIsWorkerEmail(e) ? String(e).split('@')[0] : e; }
if(!window._daUserLoginWrapped){
  window._daUserLoginWrapped = true;
  var _loginPagePreUser = renderLoginPage;
  renderLoginPage = function(){ var h = _loginPagePreUser.apply(this, arguments); if(typeof h !== 'string') return h;
    return h.replace('id="auth-email" type="email" autocomplete="username" placeholder="name@company.com"', 'id="auth-email" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="اسم المستخدم أو الإيميل"')
      .replace(/>(البريد الإلكتروني|الإيميل|البريد)</, '>اسم المستخدم أو الإيميل<'); };
  var _doLoginPreUser = doLogin;
  doLogin = async function(){
    var el = document.getElementById('auth-email'), typed = el ? el.value : '';
    if(el && typed.trim() && typed.indexOf('@') < 0){ if(!daIsUsername(typed)){ toast('⚠️ اسم المستخدم حروف إنجليزي وأرقام بس'); return; } el.value = daLoginEmail(typed); }
    try{ return await _doLoginPreUser.apply(this, arguments); } finally { if(el && document.body.contains(el) && typed.indexOf('@') < 0) el.value = typed; }
  };
  var _umPreUser = renderUserManagement;
  renderUserManagement = function(){ var h = _umPreUser.apply(this, arguments); if(typeof h !== 'string') return h;
    return h.replace('<label>البريد الإلكتروني</label><input id="um-email" type="email" placeholder="email@example.com"', '<label>اسم المستخدم (للعمال) أو الإيميل</label><input id="um-email" type="text" autocapitalize="none" spellcheck="false" placeholder="مثلاً irfan — أو email@example.com"')
      .replace(new RegExp('([a-z0-9._-]+)@' + DA_USER_DOMAIN.replace(/\./g, '\\.'), 'g'), '👤 $1'); };
  VIEWS['user-management'] = renderUserManagement;   // the views table kept the original function
  var _loadUsersPreUser = adminLoadUsers;   // the list is filled after the page opens
  adminLoadUsers = async function(){ var r = await _loadUsersPreUser.apply(this, arguments); daHideWorkerEmails(document.getElementById('content')); daShareButtons(); return r; };
  var _addUserPreUser = adminAddUser;
  adminAddUser = async function(){
    var el = document.getElementById('um-email'), typed = el ? el.value : '', pass = (document.getElementById('um-pass') || {}).value || '', name = (document.getElementById('um-name') || {}).value || '';
    if(el && typed.trim() && typed.indexOf('@') < 0){ if(!daIsUsername(typed)){ toast('⚠️ اسم المستخدم: حروف إنجليزي صغيرة وأرقام (و . _ -)، من 3 لـ 30 حرف — مثلاً irfan أو ahmed2'); return; } el.value = daLoginEmail(typed); }
    var ok = false;
    try{ var r = await _addUserPreUser.apply(this, arguments); ok = !((document.getElementById('um-pass') || {}).value); return r; }   // success clears the form
    finally {
      if(!ok && el && document.body.contains(el) && typed.indexOf('@') < 0) el.value = typed;
      if(ok && typed.trim()) daShareCard(name.trim() || typed.trim(), typed.trim().toLowerCase(), pass);   // the only moment the password is known
    }
  };
  var _recoverPreUser = sendRecoveryEmail;
  sendRecoveryEmail = async function(email){
    if(email && (String(email).indexOf('@') < 0 || daIsWorkerEmail(email))){ toast('🔑 حسابات العمال من غير إيميل — كلّم المدير يغيّر كلمة السر'); return; }
    return _recoverPreUser.apply(this, arguments);
  };
}
