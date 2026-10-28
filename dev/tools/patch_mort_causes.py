# Wires the optional mortality-cause list (dev/modules/mort_causes_harvest.js) into existing forms/reports.
# Exact-string edits; each asserts its expected match count and fails loudly otherwise.
import sys
F = sys.argv[1] if len(sys.argv) > 1 else 'index.html'
h = open(F, encoding='utf-8').read()

def rep(old, new, n=1):
    global h
    c = h.count(old)
    if c != n: sys.exit(f'PATCH FAILED ({c} matches, expected {n}): {old[:90]!r}')
    h = h.replace(old, new)

# 1. daily sheet: list + options from daCauseList, blank allowed
rep("""    var causes=['unknown','oxygen','disease','stress','handling','other'];
    var causeLabels={unknown:'غير محدد',oxygen:'نقص أكسجين',disease:'مرض',stress:'إجهاد',handling:'تداول',other:'أخرى'};
""", "")
rep("""      causes.forEach(function(c){h+='<option value="'+c+'"'+(row&&row.cause===c?' selected':'')+'>'+causeLabels[c]+'</option>';});""",
    """      h+=daCauseOptions(row&&row.cause);""")
# 2. tx-mortality page: same list, no forced default
rep("""<option>طبيعي</option><option>مرض</option><option>إجهاد</option><option>جودة مياه</option><option>إصابة</option><option>غير محدد</option></select>""",
    """'+daCauseOptions('')+'</select>""")
rep("""var cause=(document.getElementById('mt-cause-'+r.unit)||{}).value||'طبيعي';""",
    """var cause=(document.getElementById('mt-cause-'+r.unit)||{}).value||'';""")
# 3. analyses group old keys and labels together ("disease" + "مرض" → مرض)
rep("t.cause||'غير محدد'", "daCauseLabel(t.cause)", 5)
rep("t.cause || 'غير محدد'", "daCauseLabel(t.cause)", 1)
# 4. displays
rep("""'</strong> سمكة · '+(t.cause||'');""", """'</strong> سمكة · '+(t.cause?daCauseLabel(t.cause):'');""")
rep("""h+='<td>'+(t.cause||'—')+'</td>""", """h+='<td>'+(t.cause?daEsc(daCauseLabel(t.cause)):'—')+'</td>""")
rep("""+'<td style="padding:5px 8px">'+(t.cause||'—')+'</td>'""", """+'<td style="padding:5px 8px">'+(t.cause?daEsc(daCauseLabel(t.cause)):'—')+'</td>'""")
rep("""(t.cause ? ' · '+daEsc(t.cause) : '')""", """(t.cause ? ' · '+daEsc(daCauseLabel(t.cause)) : '')""")
rep("""<strong>'+l.cause+'</strong>""", """<strong>'+daEsc(daCauseLabel(l.cause))+'</strong>""")
# 5. settings → standards tab: editor card, saved with the existing button
rep("""    h+='<button class="savebtn" onclick="applySettings()">💾 حفظ المعايير</button>';""",
    """    h+=daCauseEditorCard();
    h+='<button class="savebtn" onclick="applySettings()">💾 حفظ المعايير</button>';""")
rep("""  saveSettings(s,_settingsFarm);
  toast('✅ تم حفظ إعدادات '""", """  saveSettings(s,_settingsFarm);
  try{ daSaveCauseEditor(); }catch(e){}
  toast('✅ تم حفظ إعدادات '""")

open(F, 'w', encoding='utf-8').write(h)
print('patched', F)
