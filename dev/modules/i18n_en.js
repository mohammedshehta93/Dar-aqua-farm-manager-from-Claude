// ══════════════════════════════════════════════════════════
//  ENGLISH FOR THE WORKERS' SCREENS (owner, 2026-11-08)
// ══════════════════════════════════════════════════════════
// Most screens are written in Arabic. When the language is English, a translation layer rewrites what is on screen
// (text, placeholders, titles, toasts, alert / confirm) from a phrase list covering everything a worker sees: login,
// header, menus, tabs, daily feed sheet, testing log (daily + weekly), their messages. The worker guide has its own
// English text. The language choice is remembered on the device. Office pages may still show Arabic.
var DA_LANG_KEY = 'da_lang';
var DA_EN_RULES = [
  [/✅ اتحفظ شيت القياسات (\S+)/g, '✅ Testing log $1 saved'], [/· ✗ (\d+) سكشن برّه الحدود/g, '· ✗ $1 section(s) out of range'],
  [/✅ اتحفظ شيت (\S+) — ([\d.]+) كجم علف/g, '✅ Sheet $1 saved — $2 kg feed'], [/· (\d+) نافق/g, '· $1 dead'], [/· (\d+) للمراجعة/g, '· $1 for review'],
  [/✅ اتحفظت القياسات الأسبوعية لـ (\d+) سكشن/g, '✅ Weekly readings saved for $1 section(s)'], [/✅ أهلاً (.+)/g, '✅ Welcome $1'],
  [/سكاشن (\d+) – (\d+)/g, 'Sections $1 – $2'], [/سكشن (\d+)/g, 'Section $1'], [/\((\d+) وجبات — بالكيلو\)/g, '($1 meals — kg)'], [/\((\d+) وجبات — بالجرام\)/g, '($1 meals — grams)'],
  [/نوع العلف — حجم (\d) مم/g, 'Feed type — size $1 mm'], [/الحرارة أعلى من ([\d.]+)/g, 'Temperature above $1'], [/الحرارة أقل من ([\d.]+)/g, 'Temperature below $1'],
  [/الأكسجين ([\d.]+) \(لازم أكبر من ([\d.]+)\)/g, 'DO $1 (must be above $2)'], [/pH أعلى من ([\d.]+)/g, 'pH above $1'], [/pH أقل من ([\d.]+)/g, 'pH below $1'],
  [/قرايات برّه الحدود من غير إجراء تصحيحي مكتوب: (.+?)\.\s*الشيت بيطلب الإجراء يتكتب\. تحفظ من غيره؟/g, 'Readings out of range without a written corrective action: $1.\nThe log asks for the action to be written. Save without it?'],
  [/مفيش علف متسجل يوم (\S+)/g, 'No feed recorded on $1'], [/فيه كميات مكتوبة في الشيت — هتتبدل بكميات يوم (\S+)\. تكمل؟/g, 'There are amounts typed in the sheet — they will be replaced with $1. Continue?'],
  [/📋 اتنسخ علف (\d+) تانك من (\S+) — راجع وعدّل واحفظ/g, '📋 Copied feed of $1 tanks from $2 — check, edit and save'], [/⚠️ أرقام مش منطقية: (.+)/g, '⚠️ Impossible numbers: $1'],
  [/⚠️ اكتب الحجم \(1 أو 2 أو 3\) للتانكات: (.+)/g, '⚠️ Write the size (1, 2 or 3) for tanks: $1'], [/⚠️ أرقام مش صحيحة في: (.+)/g, '⚠️ Wrong numbers in: $1'],
  [/فيه بيانات اتكتبت في "(.+?)" ومتحفظتش\. (.+)/g, 'Unsaved input in "$1". $2'], [/(\d+) تاب فيهم بيانات متحفظتش\. تقفلهم برضه؟/g, '$1 tabs have unsaved input. Close them anyway?'],
  [/✅ اتحفظت عينات (\d+) تانك/g, '✅ Samples saved for $1 tank(s)'], [/⚠️ أوزان مش منطقية: (.+)/g, '⚠️ Impossible weights: $1'],
  [/الوزن نازل عن العينة اللي فاتت أو زاد أكتر من الضعف في: (.+?)\s*متأكد من الأرقام؟/g, 'Lower than the last sample, or more than double, in: $1\nAre the numbers right?'],
  [/متاح يومها: ([\d,]+) سمكة · (\d+)g/g, 'Available that day: $1 fish · $2 g'], [/^(\d+) سجل$/g, '$1 records'], [/حصاد ([^\s]{1,40}): ([\d,]+) سمكة · ([\d.]+) كجم/g, 'Harvest $1: $2 fish · $3 kg'],
  [/نقل من ([^\s]{1,40}) لـ (\d+) تانك · ([\d,]+) سمكة/g, 'Transfer from $1 to $2 tank(s) · $3 fish'], [/([^\s]{1,40}) يومها فيه ([\d,]+) سمكة بس — مينفعش تنقل ([\d,]+)/g, '$1 had only $2 fish that day — cannot transfer $3'],
  [/التانك يومها فيه ([\d,]+) سمكة بس — مينفعش تحصد ([\d,]+)/g, 'The tank had only $1 fish that day — cannot harvest $2'],
  [/فيه أرقام اتكتبت ومتحفظتش في الشيت ده\. تغيّر (.+?)؟/g, 'Numbers typed in this sheet are not saved. Change $1?'], [/فيه قرايات اتكتبت ومتحفظتش\. تغيّر (.+?)؟/g, 'Readings typed are not saved. Change $1?']];
var DA_EN = [
  ['📌 ثبّت الأحجام دي','📌 Pin these sizes'], ['حجم السكشن:','Section size:'], ['📌 الحجم الثابت','📌 Pinned size'],
  ['نفس ترتيب الشيت الورق — الكميات بالكيلو لكل وجبة، والأداة بتجمعها', 'Same order as the paper sheet — amounts in kg per meal; the app adds them up'],
  ['الحجم بيتكتب في كل سطر (1 أو 2 أو 3)، والشركة بتتاخد من هنا. الأصناف من مخزون العلف.', 'Write the size on every line (1, 2 or 3).'],
  ['= متأكلش الوجبة (أو ✕ آخر السطر لليوم كله) · النافق يتكتب زي الورق', '= not fed this meal (or ✕ at the end of the line for the whole day) · dead written like on paper'],
  ['وبيتجمع · المجموعات المكتوب جنبها "بالجرام" بتتكتب جرام.', 'and is added up · groups marked "grams" are written in grams.'],
  ['بيملا الشاشة بس — راجع وعدّل وبعدين حفظ. النافق مش بيتنسخ.', 'Fills the screen only — check, edit, then Save. Dead is not copied.'],
  ['سيب الخانة فاضية لو القياس ده متعملش النهارده. الأرقام بتتحفظ مع قراية السكشن الأسبوعية لنفس اليوم.', 'Leave a box empty if that test was not done today.'],
  ['قراية واحدة لكل سكشن — الأمونيا بتتسجل مع علف الأسبوع في التوأم الرقمي لوحدها', 'One reading per section'],
  ['قراية واحدة لكل سكشن — نفس الشيت الورق', 'One reading per section — same as the paper log'],
  ['أي قراية برّه الحدود ← لازم إجراء تصحيحي مكتوب', 'Any reading out of range → a corrective action must be written'],
  ['✅ الشيت ده متسجل قبل كده — أي تعديل وحفظ بيعدّل نفس السجلات، مش بيكررها.', '✅ This sheet is already saved — editing and saving updates the same records, never duplicates them.'],
  ['✅ الشيت ده متسجل قبل كده — أي تعديل وحفظ بيعدّل نفس السجلات.', '✅ This sheet is already saved — editing and saving updates the same records.'],
  ['📋 عدد النافق بيتسجل من شيت العلف بس (عمود dead)', '📋 Dead counts are entered in the feed sheet only (dead column)'],
  ['فيه أرقام اتكتبت في الشيت ومتحفظتش وهتضيع. تكمل؟', 'Numbers typed in the sheet are not saved and will be lost. Continue?'],
  ['🔄 فيه نسخة جديدة — احفظ شغلك وبعدين اضغط', '🔄 A new version is ready — save your work, then press'],
  ['⚠️ اختار يوم غير اليوم اللي بتسجله', '⚠️ Choose a day other than the one you are entering'],
  ['❌ اسم المستخدم / الإيميل أو كلمة السر غلط', '❌ Wrong username / email or password'],
  ['🔑 حسابات العمال من غير إيميل — كلّم المدير يغيّر كلمة السر', '🔑 Worker accounts have no email — ask your manager to change the password'],
  ['⚠️ اسم المستخدم حروف إنجليزي وأرقام بس', '⚠️ Username: English letters and numbers only'],
  ['تحديث الصفحة — يجيب آخر بيانات ويعرضها', 'Refresh — get the latest data'],
  ['🧪 أسبوعي — أمونيا · نيتريت · نترات · قلوية', '🧪 Weekly — ammonia · nitrite · nitrate · alkalinity'],
  ['📅 يومي — حرارة · pH · أكسجين', '📅 Daily — temperature · pH · DO'],
  ['🔴 1 تنبيه حرج — افتح التنبيهات الذكية', ''], ['تسجيل العلف بقى من مكان واحد', 'Feed is entered in one place'],
  ['إجمالي اليوم ← اعرض بالوجبات', 'Daily total → show meals'], ['بالوجبات ← خليه إجمالي اليوم', 'By meal → daily total'],
  ['متأكلش النهارده (صايم)', 'Not fed today'], ['اسم المستخدم أو الإيميل', 'Username or email'], ['الحسابات بيضيفها الأدمن فقط', 'Accounts are added by the admin only'],
  ['بالدخول أنت موافق على', 'By logging in you agree to the'], ['الشروط وسياسة الخصوصية', 'Terms & Privacy'], ['إدارة مزارع الأسماك', 'Fish farm management'],
  ['🧪 شيت القياسات الأسبوعي', '🧪 Weekly testing log'], ['🧪 شيت القياسات اليومي', '🧪 Daily testing log'], ['📋 شيت العلف اليومي', '📋 Daily feed sheet'],
  ['شيت القياسات اليومي', 'Daily testing log'], ['شيت العلف اليومي', 'Daily feed sheet'], ['قفل كل التابات التانية', 'Close all other tabs'],
  ['انسخ كميات وأحجام يوم', 'Copy amounts and sizes of day'], ['🔑 تسجيل الدخول', '🔑 Login'], ['نسيت كلمة السر؟', 'Forgot password?'], ['👋 تم تسجيل الخروج', '👋 Logged out'],
  ['🔄 بيتحدث لآخر نسخة...', '🔄 Updating to the latest version...'], ['🌾 إجمالي العلف:', '🌾 Total feed:'], ['💀 إجمالي النفوق:', '💀 Total dead:'],
  ['اسم اللي ملا الشيت', 'Who filled the sheet'], ['اسم اللي قاس', 'Who tested'], ['تسجيل خروج؟', 'Log out?'], ['📋 نسخ من يوم', '📋 Copy from a day'], ['💾 حفظ الشيت', '💾 Save sheet'],
  ['✏️ الإدخال اليومي', '✏️ Daily entry'], ['الإنتاج والعلف', 'Production & feed'], ['التقارير والتتبع', 'Reports'], ['🔄 اتحدثت', '🔄 Refreshed'], ['مفيش تغيير', 'No change'],
  ['وقت القياس', 'Test time'], ['كلمة السر', 'Password'], ['🔑 دخول', '🔑 Login'], ['🔄 تحديث', '🔄 Refresh'], ['💾 حفظ', '💾 Save'], ['📋 نسخ', '📋 Copy'],
  ['الإجمالي', 'Total'], ['الإدخال:', 'Entry:'], ['الإدخال', 'Entry'], ['الإعداد', 'Setup'], ['الرئيسية', 'Home'], ['التاريخ', 'Date'], ['المزرعة', 'Farm'], ['الفني', 'Technician'],
  ['دليل الاستخدام', 'Guide'], ['المزيد', 'More'], ['الكل', 'All'], ['بعدين', 'Later'], ['تحديث', 'Update'], ['إلغاء', 'Cancel'], ['رجوع', 'Back'], ['قفل', 'Close'], ['ملاحظات', 'Notes'],
  ['🟢 متصل', '🟢 Online'], ['☁️ متصل', '☁️ Online'], ['متصل', 'Online'], ['أدمن', 'Admin'], ['عامل', 'Worker'], ['مهندس', 'Engineer'], ['مدير', 'Manager'], ['كجم', 'kg'],
  ['سكشن برّه الحدود', 'section(s) out of range'],
  // account
  ['👤 حسابي', '👤 My account'], ['حسابي', 'My account'], ['صلاحياتك:', 'Your permissions:'], ['🌾 إدخال التغذية', '🌾 Feeding'], ['💀 إدخال النفوق', '💀 Mortality'],
  ['🔬 إدخال العينات', '🔬 Sampling'], ['💧 جودة المياه', '💧 Water quality'], ['🎣 الحصاد والنقل', '🎣 Harvest & transfer'], ['💊 الصحة والعلاجات', '💊 Health'], ['✔️ مراجعة واعتماد البيانات', '✔️ Review data'],
  ['🔐 تغيير كلمة السر', '🔐 Change password'], ['كلمة السر الجديدة', 'New password'], ['أكد كلمة السر', 'Confirm password'], ['💾 تغيير', '💾 Change'], ['🚪 تسجيل خروج', '🚪 Log out'],
  ['✅ اتغيرت كلمة السر', '✅ Password changed'], ['⚠️ كلمتين السر مش زي بعض', '⚠️ The passwords do not match'], ['⚠️ كلمة السر 6 حروف على الأقل', '⚠️ Password: at least 6 characters'],
  // harvest / transfer / sampling registers
  ['كل الحصاد في الفترة — كليك يمين على أي سطر (أو ⋮) للتعديل والحذف والإضافة', 'All harvests in the period — tap ⋮ on a row to edit, delete or add'],
  ['كل النقل في الفترة — من تانك لتانك أو أكتر في سجل واحد. كليك يمين (أو ⋮) للتعديل والحذف والإضافة', 'All transfers in the period — one tank to one or more tanks in one record. Tap ⋮ to edit, delete or add'],
  ['مفيش حصاد في الفترة دي — ➕ جديد أو كليك يمين.', 'No harvest in this period — press ➕ New.'], ['مفيش نقل في الفترة دي — ➕ جديد أو كليك يمين.', 'No transfer in this period — press ➕ New.'],
  ['العينات بتتسجل من هنا بس. ممكن من الشيت المطبوع:', 'Samples are entered here only.'],
  ['متوسط وزن السمك اللي فاضل بيتحسب لوحده من وزن اللي طلع، والعلف اللي اتاكل بيتقسم بنسبة الكتلة.', 'The average weight of the fish left is calculated from the weight of those taken out.'],
  ['(اقفل الدورة والباقي يبقى تسوية)', '(close the cycle; the rest becomes an adjustment)'], ['(لو الحصاد فضّى التانك)', '(if the harvest emptied the tank)'], ['Adjustments (فرق عد)', 'Adjustments (count difference)'],
  ['➕ جديد — حصاد', '➕ New — harvest'], ['✏️ تعديل — حصاد', '✏️ Edit — harvest'], ['➕ جديد — نقل', '➕ New — transfer'], ['✏️ تعديل — نقل', '✏️ Edit — transfer'], ['➕ جديد', '➕ New'],
  ['➕ سجل جديد', '➕ New record'], ['✏️ تعديل', '✏️ Edit'], ['📋 نسخة جديدة منه', '📋 Copy as new'], ['🗑 حذف', '🗑 Delete'], ['➕ تانك تاني', '➕ Another tank'],
  ['وزن الباقي بعد النقل (جم)', 'Weight of fish left (g)'], ['فاضي = محسوب', 'empty = calculated'], ['الإجمالي:', 'Total:'], ['تانك / دفعة', 'Tank / batch'], ['من تانك', 'From tank'],
  ['🎣 الحصاد', '🎣 Harvest'], ['🔄 النقل', '🔄 Transfer'], ['الحصاد', 'Harvest'], ['النقل', 'Transfer'], ['العينات', 'Sampling'], ['التانك', 'Tank'], ['المشتري', 'Buyer'], ['السعر', 'Price'],
  ['صغير', 'Small'], ['طبيعي', 'Normal'], ['كبير جداً', 'X-large'], ['كبير', 'Large'], ['غير مصنف', 'Unsorted'], ['فلتر', 'Filter'], ['لحد', 'To'], ['من', 'From'], ['فرق عد', 'Count difference'],
  ['مفيش تانكات متسجلة للمزرعة دي.', 'No tanks recorded for this farm.'], ['مفيش سكاشن في المزرعة دي', 'No sections in this farm'],
  ['🔬 شيت العينات', '🔬 Sampling sheet'], ['متوسط الوزن لكل تانك — العينة اللي فاتت قدامك للمقارنة', 'Average weight per tank — the last sample is shown to compare'],
  ['مفيش تانكات فيها سمك في اليوم ده.', 'No tanks with fish on this day.'],
  ['سيب التانك فاضي لو متوزنش. الأصفر = الوزن نازل عن اللي فات أو أكتر من الضعف — اتأكد منه.', 'Leave a tank empty if it was not weighed. Yellow = lower than last time or more than double — check it.'],
  ['هروب', 'Escape'], ['سرقة / فقد', 'Theft / loss'], ['أخرى', 'Other'], ['نقل / فرز', 'Transfer / grading'], ['ملاحظات', 'Notes'], ['المدة', 'Period']];
DA_EN.sort(function(a, b){ return b[0].length - a[0].length; });
var _daArRe = /[\u0600-\u06FF]/;
var _daEnMemo = {}, _daEnMemoN = 0, _daEnKeys = null, _daEnPhraseRe = null;
function daEn(s){
  if(isAr || !s || !_daArRe.test(s)) return s;
  if(_daEnMemo.hasOwnProperty(s)) return _daEnMemo[s];
  if(_daEnMemoN > 5000){ _daEnMemo = {}; _daEnMemoN = 0; }
  var r0 = daEnCore(s); _daEnMemo[s] = r0; _daEnMemoN++; return r0;
}
function daRuleKey(re){   // the longest fixed piece of a rule's pattern: the rule is tried only if the text contains it
  var parts = re.source.replace(/\\./g, ' ').split(/[\^$.*+?()[\]{}|]+/).map(function(x){ return x.trim(); }).filter(Boolean);
  return parts.sort(function(a, b){ return b.length - a.length; })[0] || '';
}
function daEnCore(s){
  var t = String(s); if(!_daEnKeys) _daEnKeys = DA_EN_RULES.map(function(r){ return daRuleKey(r[0]); });
  DA_EN_RULES.forEach(function(r, i){ if(_daEnKeys[i] && t.indexOf(_daEnKeys[i]) < 0) return; r[0].lastIndex = 0; t = t.replace(r[0], r[1]); });
  if(!_daArRe.test(t)) return t; var trimmed = t.trim();
  for(var i = 0; i < DA_EN.length; i++){ if(trimmed === DA_EN[i][0]) return t.replace(trimmed, DA_EN[i][1]); }
  // whole phrases inside a longer text, only at word boundaries; if Arabic is still left, keep the original (never mixed)
  if(!_daEnPhraseRe) _daEnPhraseRe = DA_EN.map(function(x){ return x[0].length < 4 ? null : new RegExp('(^|[^\\u0600-\\u06FF])' + x[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\u0600-\\u06FF])', 'g'); });   // built once
  var u = t; for(var j = 0; j < DA_EN.length; j++){ var re = _daEnPhraseRe[j]; if(!re || u.indexOf(DA_EN[j][0]) < 0) continue; re.lastIndex = 0; var rep = DA_EN[j][1]; u = u.replace(re, function(m, pre){ return pre + rep; }); }
  return _daArRe.test(u) ? s : u;
}
function daEnNode(root){
  if(isAr || !root) return;
  if(root.nodeType === 3){ if(root.parentElement && /^(SCRIPT|STYLE|TEXTAREA|NOSCRIPT)$/.test(root.parentElement.tagName)) return; var v = daEn(root.nodeValue); if(v !== root.nodeValue) root.nodeValue = v; return; }
  if(/^(SCRIPT|STYLE|TEXTAREA|NOSCRIPT)$/.test(root.tagName || '')) return;
  if(root.nodeType !== 1) return;
  var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), n, list = [];   // never the page's own code / styles (1.3 MB of script text)
  while((n = w.nextNode())) if(n.parentElement && !/^(SCRIPT|STYLE|TEXTAREA|NOSCRIPT)$/.test(n.parentElement.tagName) && _daArRe.test(n.nodeValue)) list.push(n);
  list.forEach(function(t){ var v = daEn(t.nodeValue); if(v !== t.nodeValue) t.nodeValue = v; });
  var els = root.querySelectorAll ? [root].concat(Array.prototype.slice.call(root.querySelectorAll('[placeholder],[title]'))) : [];
  els.forEach(function(e){ ['placeholder', 'title'].forEach(function(a){ var x = e.getAttribute && e.getAttribute(a); if(x && _daArRe.test(x)) e.setAttribute(a, daEn(x)); }); });
}
// the worker guide in English
function daWorkerGuideEn(){
  return '<div class="ph"><div><h2>❓ Guide</h2><p style="font-size:11px;color:var(--muted)">What you need every day</p></div></div><div class="card da-doc" style="line-height:1.8;font-size:14px" dir="ltr">'
    + '<h3>1. Login</h3><p>Open the link your manager sent you, type your <b>username</b> and <b>password</b>, press <b>Login</b>. From the browser menu choose <b>Add to Home Screen</b> to open it like an app. Never give your account to anyone.</p>'
    + '<h3>2. Daily feed sheet</h3><ul><li>For each tank write the <b>quantity</b> fed today (kg — or grams where the group says grams) and the pellet <b>size</b> (1, 2 or 3).</li>'
    + '<li><b>dead</b>: the dead fish, like on paper — <b>2+1</b> is added up to 3.</li><li><b>X</b> = not fed. Empty tanks are locked.</li>'
    + '<li><b>📋 Copy from a day</b> fills the amounts and sizes of another day; change what is different and press <b>💾 Save sheet</b>.</li></ul>'
    + '<h3>3. Testing log</h3><ul><li><b>📅 Daily</b>: temperature, pH and DO for each section, then <b>Save</b>. A reading out of range turns red — write the corrective action in Notes.</li>'
    + '<li><b>🧪 Weekly</b>: ammonia, nitrite, nitrate, alkalinity for each section. Leave a box empty if that test was not done.</li></ul>'
    + '<h3>4. Moving around</h3><p>Use the arrow keys or <b>Enter</b> to go to the next box. Each page opens as a tab; an orange dot ● means something is typed and not saved yet.</p>'
    + '<h3>5. If you made a mistake</h3><p>Do not enter the number again (it would count twice). Fix it in the same sheet and save again, or tell your engineer.</p>'
    + '<h3>6. No internet</h3><p>Keep working — it is kept on the phone and sent when the internet is back. <b>Do not log out</b> while it says something is waiting to sync.</p>'
    + '<h3>7. Updates</h3><p>The app updates itself. If it asks you to save first, press Save, and it updates.</p></div>';
}
if(!window._daEnWrapped){
  window._daEnWrapped = true;
  try{ if(localStorage.getItem(DA_LANG_KEY) === 'en' && isAr) setTimeout(function(){ toggleLang(true); }, 0); }catch(e){}
  var _tlPreEn = toggleLang;
  toggleLang = function(){ var r = _tlPreEn.apply(this, arguments); try{ localStorage.setItem(DA_LANG_KEY, isAr ? 'ar' : 'en'); }catch(e){}
    if(typeof renderNav === 'function') try{ renderNav(); }catch(e){} daEnNode(document.body); return r; };
  new MutationObserver(function(ms){ if(isAr) return; ms.forEach(function(m){
    if(m.type === 'characterData') daEnNode(m.target); else m.addedNodes.forEach(function(n){ daEnNode(n); }); }); })
    .observe(document.documentElement, {childList:true, subtree:true, characterData:true});
  var _al = window.alert, _cf = window.confirm;
  window.alert = function(m){ return _al.call(window, daEn(String(m))); };
  window.confirm = function(m){ return _cf.call(window, daEn(String(m))); };
  if(VIEWS.help){ var _vhEn = VIEWS.help; VIEWS.help = function(){ if(!isAr && (window._helpTab === 'worker' || (currentUser && currentUserRole === 'worker'))) return daWorkerGuideEn(); return _vhEn.apply(this, arguments); }; }
}
