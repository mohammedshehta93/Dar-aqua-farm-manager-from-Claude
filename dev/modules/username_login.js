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
  adminLoadUsers = async function(){ var r = await _loadUsersPreUser.apply(this, arguments); daHideWorkerEmails(document.getElementById('content')); return r; };
  var _addUserPreUser = adminAddUser;
  adminAddUser = async function(){
    var el = document.getElementById('um-email'), typed = el ? el.value : '';
    if(el && typed.trim() && typed.indexOf('@') < 0){ if(!daIsUsername(typed)){ toast('⚠️ اسم المستخدم: حروف إنجليزي صغيرة وأرقام (و . _ -)، من 3 لـ 30 حرف — مثلاً irfan أو ahmed2'); return; } el.value = daLoginEmail(typed); }
    try{ return await _addUserPreUser.apply(this, arguments); } finally { if(el && document.body.contains(el) && typed.indexOf('@') < 0) el.value = typed; }
  };
  var _recoverPreUser = sendRecoveryEmail;
  sendRecoveryEmail = async function(email){
    if(email && (String(email).indexOf('@') < 0 || daIsWorkerEmail(email))){ toast('🔑 حسابات العمال من غير إيميل — كلّم المدير يغيّر كلمة السر'); return; }
    return _recoverPreUser.apply(this, arguments);
  };
}
