# Exact-string edits for the pilot kit. Each asserts exactly one match.
import sys
F = sys.argv[1] if len(sys.argv) > 1 else 'index.html'
h = open(F, encoding='utf-8').read()
def rep(old, new):
    global h
    c = h.count(old)
    if c != 1: sys.exit(f'PATCH FAILED ({c} matches): {old[:90]!r}')
    h = h.replace(old, new)
# 1. login page: terms & privacy link
rep("""  h += '<div style="text-align:center;margin-top:8px;font-size:11px;color:var(--muted)">الحسابات بيضيفها الأدمن فقط</div>';""",
    """  h += '<div style="text-align:center;margin-top:8px;font-size:11px;color:var(--muted)">الحسابات بيضيفها الأدمن فقط</div>';
  h += '<div style="text-align:center;margin-top:10px;font-size:11px;color:var(--muted)">بالدخول أنت موافق على <a id="login-legal" href="#" onclick="show(&quot;legal&quot;);return false">الشروط وسياسة الخصوصية</a></div>';""")
# 2. AI advisor: the signed-in farm, not a hard-coded one
rep("""    var systemPrompt = 'أنت مستشار زراعة مائية خبير متخصص في تربية البلطي الفضي (Silver Tilapia) في أنظمة RAS في البحرين. عندك وصول كامل لبيانات مزرعة دار أكوا الحقيقية. أجب بالعربية بشكل مختصر وعملي ومباشر. استند دائماً للبيانات الفعلية في ردودك.';""",
    """    var systemPrompt = 'أنت مستشار زراعة مائية خبير. المزرعة: ' + daFarmName() + (cfg.species ? ' — النوع: ' + cfg.species : '') + (cfg.location ? ' — الموقع: ' + cfg.location : '') + '. عندك بيانات المزرعة الحقيقية تحت. أجب بالعربية بشكل مختصر وعملي ومباشر. استند دائماً للبيانات الفعلية في ردودك، ولو معلومة مش موجودة قول كده.';""")
rep("""    var farmCtx = '## بيانات مزرعة دار أكوا — ' + today + '\\n\\n';""",
    """    var farmCtx = '## بيانات مزرعة ' + daFarmName() + ' — ' + today + '\\n\\n';""")
open(F, 'w', encoding='utf-8').write(h); print('patched', F)
