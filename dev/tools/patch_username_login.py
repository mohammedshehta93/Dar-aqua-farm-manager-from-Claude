# Username accounts: clearer messages in the original login / add-user code.
import sys
F = sys.argv[1] if len(sys.argv) > 1 else 'index.html'
h = open(F, encoding='utf-8').read()
def rep(old, new, n=1):
    global h
    if h.count(old) != n: sys.exit(f'PATCH FAILED ({h.count(old)}): {old[:90]!r}')
    h = h.replace(old, new)
rep("if(/invalid login|invalid_grant|credentials/i.test(msg)) msg = 'الإيميل أو كلمة السر غلط';", "if(/invalid login|invalid_grant|credentials/i.test(msg)) msg = 'اسم المستخدم / الإيميل أو كلمة السر غلط';")
rep("""    var needsConfirm = !(d.access_token || d.session);""", """    var needsConfirm = !(d.access_token || d.session);
    if(needsConfirm && typeof daIsWorkerEmail === 'function' && daIsWorkerEmail(email)) setTimeout(function(){ alert('⚠️ الحساب اتعمل بس مش هيقدر يدخل لسه: Supabase مستني تأكيد إيميل، والعمال مالهمش إيميل.\\n\\nفي Supabase: Authentication ← Sign In / Providers ← Email ← اقفل "Confirm email" ← Save.\\nبعدها امسح الحساب ده من القايمة واعمله تاني.'); }, 50);""")
rep("""      if(/already|registered|exists/i.test(m)) m = 'البريد ده مسجل قبل كده';""", """      if(/already|registered|exists/i.test(m)) m = (typeof daIsWorkerEmail === 'function' && daIsWorkerEmail(email)) ? 'اسم المستخدم ده مستخدم قبل كده — اختار اسم تاني' : 'البريد ده مسجل قبل كده';""")
open(F, 'w', encoding='utf-8').write(h); print('patched', F)
