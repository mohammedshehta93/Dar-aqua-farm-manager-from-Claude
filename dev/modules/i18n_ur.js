// ══════════════════════════════════════════════════════════
//  URDU FOR THE WORKERS' SCREENS (owner, 2026-11-09) — not the whole tool
// ══════════════════════════════════════════════════════════
// Workers (and the login page) choose عربي · English · اردو. Urdu is built on the English layer: the screen is drawn in
// English (isAr false), Arabic texts go Arabic → English (DA_EN), then English → Urdu (DA_UR + DA_UR_RULES), right to
// left. Dates and the calendar use Urdu day / month names; the worker guide has its own Urdu text. Office users keep
// Arabic / English only (a stored "ur" is read as English for them).
var DA_UR_RULES = [
  [/✅ Testing log (\S+) saved/g, '✅ پانی کی جانچ $1 محفوظ ہو گئی'], [/· ✗ (\d+) section\(s\) out of range/g, '· ✗ $1 سیکشن حد سے باہر'],
  [/✅ Sheet (\S+) saved — ([\d.]+) kg feed/g, '✅ شیٹ $1 محفوظ — $2 کلو فیڈ'], [/· (\d+) dead/g, '· $1 مردہ'], [/· (\d+) for review/g, '· $1 جائزے کے لیے'],
  [/✅ Weekly readings saved for (\d+) section\(s\)/g, '✅ $1 سیکشن کی ہفتہ وار ریڈنگ محفوظ'], [/✅ Welcome (.+)/g, '✅ خوش آمدید $1'],
  [/Sections (\d+) – (\d+)/g, 'سیکشن $1 – $2'], [/\bSection (\d+)\b/g, 'سیکشن $1'], [/\((\d+) meals — kg\)/g, '($1 کھانے — کلو)'], [/\((\d+) meals — grams\)/g, '($1 کھانے — گرام)'],
  [/Feed type — size (\d) mm/g, 'فیڈ کی قسم — سائز $1 ملی میٹر'], [/Temperature above ([\d.]+)/g, 'درجہ حرارت $1 سے زیادہ'], [/Temperature below ([\d.]+)/g, 'درجہ حرارت $1 سے کم'],
  [/DO ([\d.]+) \(must be above ([\d.]+)\)/g, 'آکسیجن $1 (کم از کم $2 ہونی چاہیے)'], [/pH above ([\d.]+)/g, 'pH $1 سے زیادہ'], [/pH below ([\d.]+)/g, 'pH $1 سے کم'],
  [/Readings out of range without a written corrective action: (.+?)\.\s*The log asks for the action to be written\. Save without it\?/g, 'حد سے باہر ریڈنگ جن کا اصلاحی اقدام نہیں لکھا: $1۔\nاقدام لکھنا ضروری ہے۔ کیا اس کے بغیر محفوظ کریں؟'],
  [/No feed recorded on (\S+)/g, '$1 کو کوئی فیڈ درج نہیں'], [/There are amounts typed in the sheet — they will be replaced with (\S+)\. Continue\?/g, 'شیٹ میں لکھی مقداریں $1 کی مقدار سے بدل جائیں گی۔ جاری رکھیں؟'],
  [/📋 Copied feed of (\d+) tanks from (\S+) — check, edit and save/g, '📋 $2 سے $1 ٹینک کی فیڈ کاپی ہوئی — چیک کریں، درست کریں اور محفوظ کریں'],
  [/⚠️ Impossible numbers: (.+)/g, '⚠️ ناممکن نمبر: $1'], [/⚠️ Write the size \(1, 2 or 3\) for tanks: (.+)/g, '⚠️ ان ٹینکوں کا سائز لکھیں (1، 2 یا 3): $1'], [/⚠️ Wrong numbers in: (.+)/g, '⚠️ غلط نمبر: $1'],
  [/✅ Samples saved for (\d+) tank\(s\)/g, '✅ $1 ٹینک کے نمونے محفوظ'], [/⚠️ Impossible weights: (.+)/g, '⚠️ ناممکن وزن: $1'],
  [/Lower than the last sample, or more than double, in: (.+?)\s*Are the numbers right\?/g, 'پچھلے نمونے سے کم یا دوگنے سے زیادہ: $1\nکیا نمبر درست ہیں؟'],
  [/Available that day: ([\d,]+) fish · (\d+) g/g, 'اس دن موجود: $1 مچھلی · $2 گرام'], [/^(\d+) records$/g, '$1 ریکارڈ'],
  [/Numbers typed in this sheet are not saved\. Change (.+?)\?/g, 'اس شیٹ میں لکھے نمبر محفوظ نہیں۔ $1 بدلیں؟'], [/Readings typed are not saved\. Change (.+?)\?/g, 'لکھی گئی ریڈنگ محفوظ نہیں۔ $1 بدلیں؟']];
var DA_UR = {
  'Same order as the paper sheet — amounts in kg per meal; the app adds them up':'کاغذ والی شیٹ کی ترتیب — ہر کھانے کی مقدار کلو میں؛ ایپ خود جمع کرتی ہے',
  'Write the size on every line (1, 2 or 3).':'ہر لائن پر سائز لکھیں (1، 2 یا 3)۔',
  '= not fed this meal (or ✕ at the end of the line for the whole day) · dead written like on paper':'= اس کھانے میں خوراک نہیں دی (پورے دن کے لیے لائن کے آخر میں ✕) · مردہ مچھلیاں کاغذ کی طرح لکھیں',
  'and is added up · groups marked "grams" are written in grams.':'جو جمع ہو جاتی ہیں · جن گروپوں پر "گرام" لکھا ہے وہ گرام میں لکھیں۔',
  'Fills the screen only — check, edit, then Save. Dead is not copied.':'صرف اسکرین بھرتا ہے — چیک کریں، درست کریں، پھر محفوظ کریں۔ مردہ کاپی نہیں ہوتے۔',
  'Leave a box empty if that test was not done today.':'اگر آج یہ جانچ نہیں ہوئی تو خانہ خالی چھوڑ دیں۔',
  'One reading per section':'ہر سیکشن کی ایک ریڈنگ', 'One reading per section — same as the paper log':'ہر سیکشن کی ایک ریڈنگ — کاغذ والے لاگ کی طرح',
  'Any reading out of range → a corrective action must be written':'حد سے باہر ریڈنگ ← اصلاحی اقدام لکھنا ضروری ہے',
  '✅ This sheet is already saved — editing and saving updates the same records, never duplicates them.':'✅ یہ شیٹ پہلے سے محفوظ ہے — تبدیلی کر کے محفوظ کرنے سے وہی ریکارڈ اپڈیٹ ہوتے ہیں، دوبارہ نہیں بنتے۔',
  '✅ This sheet is already saved — editing and saving updates the same records.':'✅ یہ شیٹ پہلے سے محفوظ ہے — تبدیلی کر کے محفوظ کرنے سے وہی ریکارڈ اپڈیٹ ہوتے ہیں۔',
  '📋 Dead counts are entered in the feed sheet only (dead column)':'📋 مردہ مچھلیاں صرف فیڈ شیٹ میں درج ہوتی ہیں (dead کالم)',
  'Numbers typed in the sheet are not saved and will be lost. Continue?':'شیٹ میں لکھے نمبر محفوظ نہیں اور ضائع ہو جائیں گے۔ جاری رکھیں؟',
  '🔄 A new version is ready — save your work, then press':'🔄 نیا ورژن تیار ہے — اپنا کام محفوظ کریں، پھر دبائیں',
  '⚠️ Choose a day other than the one you are entering':'⚠️ جس دن کا اندراج کر رہے ہیں اس کے علاوہ کوئی دن چنیں',
  '❌ Wrong username / email or password':'❌ غلط یوزر نیم / ای میل یا پاس ورڈ',
  '🔑 Worker accounts have no email — ask your manager to change the password':'🔑 ورکر اکاؤنٹ میں ای میل نہیں — پاس ورڈ بدلنے کے لیے اپنے مینیجر سے کہیں',
  '⚠️ Username: English letters and numbers only':'⚠️ یوزر نیم: صرف انگریزی حروف اور نمبر', 'Refresh — get the latest data':'ریفریش — تازہ ترین ڈیٹا لیں',
  '🧪 Weekly — ammonia · nitrite · nitrate · alkalinity':'🧪 ہفتہ وار — امونیا · نائٹرائٹ · نائٹریٹ · الکلینیٹی', '📅 Daily — temperature · pH · DO':'📅 روزانہ — درجہ حرارت · pH · آکسیجن',
  'Feed is entered in one place':'فیڈ ایک ہی جگہ درج ہوتی ہے', 'Daily total → show meals':'دن کا کل ← کھانے دکھائیں', 'By meal → daily total':'کھانے کے حساب سے ← دن کا کل',
  'Not fed today':'آج خوراک نہیں دی', 'Username or email':'یوزر نیم یا ای میل', 'Accounts are added by the admin only':'اکاؤنٹ صرف ایڈمن بناتا ہے',
  'By logging in you agree to the':'لاگ ان کر کے آپ متفق ہیں', 'Terms & Privacy':'شرائط اور پرائیویسی', 'Fish farm management':'فش فارم مینجمنٹ', 'Farm Manager':'فارم مینیجر',
  '🧪 Weekly testing log':'🧪 ہفتہ وار پانی کی جانچ', '🧪 Daily testing log':'🧪 روزانہ پانی کی جانچ', '📋 Daily feed sheet':'📋 روزانہ فیڈ شیٹ', 'Daily testing log':'روزانہ پانی کی جانچ', 'Daily feed sheet':'روزانہ فیڈ شیٹ',
  'Copy amounts and sizes of day':'اس دن کی مقدار اور سائز کاپی کریں', '🔑 Login':'🔑 لاگ ان', 'Login':'لاگ ان', 'Forgot password?':'پاس ورڈ بھول گئے؟', '👋 Logged out':'👋 لاگ آؤٹ ہو گئے',
  '🔄 Updating to the latest version...':'🔄 نئے ورژن پر اپڈیٹ ہو رہا ہے...', '🌾 Total feed:':'🌾 کل فیڈ:', '💀 Total dead:':'💀 کل مردہ:', 'Who filled the sheet':'شیٹ کس نے بھری', 'Who tested':'جانچ کس نے کی',
  'Log out?':'لاگ آؤٹ کریں؟', '📋 Copy from a day':'📋 کسی دن سے کاپی', '💾 Save sheet':'💾 شیٹ محفوظ کریں', '🔄 Refreshed':'🔄 ریفریش ہو گیا', 'No change':'کوئی تبدیلی نہیں',
  'Test time':'جانچ کا وقت', 'Password':'پاس ورڈ', '🔄 Refresh':'🔄 ریفریش', 'Refresh':'ریفریش', '💾 Save':'💾 محفوظ کریں', 'Save':'محفوظ کریں', '📋 Copy':'📋 کاپی', 'Total':'کل', 'Entry:':'اندراج:',
  'Date':'تاریخ', 'Farm':'فارم', 'Technician':'ٹیکنیشن', 'Guide':'رہنمائی', 'Later':'بعد میں', 'Update':'اپڈیٹ', 'Cancel':'منسوخ', 'Back':'واپس', 'Close':'بند کریں', 'Notes':'نوٹس',
  '🟢 Online':'🟢 آن لائن', '☁️ Online':'☁️ آن لائن', 'Online':'آن لائن', 'Worker':'ورکر', 'kg':'کلو', 'section(s) out of range':'سیکشن حد سے باہر',
  '👤 My account':'👤 میرا اکاؤنٹ', 'My account':'میرا اکاؤنٹ', 'Your permissions:':'آپ کی اجازتیں:', '🌾 Feeding':'🌾 فیڈنگ', '💀 Mortality':'💀 مردہ مچھلیاں', '🔬 Sampling':'🔬 نمونے',
  '💧 Water quality':'💧 پانی کا معیار', '🎣 Harvest & transfer':'🎣 ہارویسٹ اور منتقلی', '🚪 Log out':'🚪 لاگ آؤٹ',
  'All harvests in the period — tap ⋮ on a row to edit, delete or add':'اس مدت کی تمام ہارویسٹ — ترمیم، حذف یا اضافے کے لیے لائن پر ⋮ دبائیں',
  'All transfers in the period — one tank to one or more tanks in one record. Tap ⋮ to edit, delete or add':'اس مدت کی تمام منتقلیاں — ایک ٹینک سے ایک یا زیادہ ٹینک، ایک ریکارڈ میں۔ ترمیم، حذف یا اضافے کے لیے ⋮ دبائیں',
  'No harvest in this period — press ➕ New.':'اس مدت میں کوئی ہارویسٹ نہیں — ➕ نیا دبائیں۔', 'No transfer in this period — press ➕ New.':'اس مدت میں کوئی منتقلی نہیں — ➕ نیا دبائیں۔',
  '➕ New':'➕ نیا', '➕ New record':'➕ نیا ریکارڈ', '✏️ Edit':'✏️ ترمیم', '🗑 Delete':'🗑 حذف', '🎣 Harvest':'🎣 ہارویسٹ', '🔄 Transfer':'🔄 منتقلی', 'Harvest':'ہارویسٹ', 'Transfer':'منتقلی',
  'Sampling':'نمونے', 'Tank':'ٹینک', 'Tank / batch':'ٹینک / بیچ', 'Buyer':'خریدار', 'Batch':'بیچ', 'Sizes':'سائز', 'Size':'سائز', 'Total Weight':'کل وزن', 'Sale Value':'فروخت کی قیمت',
  'Fish No':'مچھلیوں کی تعداد', 'Av. Wt.':'اوسط وزن', 'Type':'قسم', 'Unit':'یونٹ', 'Comments':'تبصرے', 'Packaging Code':'پیکنگ کوڈ', 'From Unit/Batch':'یونٹ/بیچ سے', 'Adjustments':'ایڈجسٹمنٹ',
  'To Units (Unit(Fish No-Av. Weight))':'یونٹس کی طرف (یونٹ (تعداد - اوسط وزن))', 'Filter':'فلٹر', 'From':'سے', 'To':'تک', 'By':'از', '⬇️ Excel':'⬇️ ایکسل',
  'No tanks recorded for this farm.':'اس فارم میں کوئی ٹینک درج نہیں۔', 'No sections in this farm':'اس فارم میں کوئی سیکشن نہیں', '🔬 Sampling sheet':'🔬 نمونوں کی شیٹ',
  'Average weight per tank — the last sample is shown to compare':'ہر ٹینک کا اوسط وزن — موازنے کے لیے پچھلا نمونہ دکھایا گیا ہے', 'No tanks with fish on this day.':'اس دن کسی ٹینک میں مچھلی نہیں۔',
  'Leave a tank empty if it was not weighed. Yellow = lower than last time or more than double — check it.':'جو ٹینک نہیں تولا گیا اسے خالی چھوڑیں۔ پیلا = پچھلی بار سے کم یا دوگنے سے زیادہ — چیک کریں۔',
  'Last':'پچھلا', 'Avg wt (g)':'اوسط وزن (گرام)', 'Fish weighed':'تولی گئی مچھلیاں', 'Change':'فرق', 'Quantity (kg)':'مقدار (کلو)', 'dead':'مردہ', 'Section':'سیکشن',
  'Temp (°C)':'درجہ حرارت (°C)', 'DO (mg/L)':'آکسیجن DO (mg/L)', 'Notes / Corrective Action':'نوٹس / اصلاحی اقدام', 'Acceptance':'قابلِ قبول حد', 'Alkalinity':'الکلینیٹی',
  'TAN / NH₃':'امونیا TAN / NH₃', 'NO₂':'نائٹرائٹ NO₂', 'NO₃':'نائٹریٹ NO₃', '(mg/L)':'(mg/L)', '📅 Daily':'📅 روزانہ', '🧪 Weekly':'🧪 ہفتہ وار',
  'Previous day':'پچھلا دن', 'Next day':'اگلا دن', 'Today':'آج',
  '📋 Feed':'📋 فیڈ', '🧪 Water':'🧪 پانی', '🔬 Samples':'🔬 نمونے', '✔️ Review':'✔️ جائزہ', '❓ Guide':'❓ رہنمائی', 'Feed':'فیڈ', 'Water':'پانی', 'Samples':'نمونے', 'Review':'جائزہ'};
var DA_UR_KEYS = Object.keys(DA_UR).filter(function(k){ return k.length >= 4; }).sort(function(a, b){ return b.length - a.length; });
DA_DAYS.ur = ['اتوار', 'پیر', 'منگل', 'بدھ', 'جمعرات', 'جمعہ', 'ہفتہ'];
DA_MONTHS.ur = ['جنوری', 'فروری', 'مارچ', 'اپریل', 'مئی', 'جون', 'جولائی', 'اگست', 'ستمبر', 'اکتوبر', 'نومبر', 'دسمبر'];
function daLangNow(){ var l = 'ar'; try{ l = localStorage.getItem(DA_LANG_KEY) || (isAr ? 'ar' : 'en'); }catch(e){} if(l === 'ur' && currentUser && currentUserRole !== 'worker') l = 'en'; return l; }
function daUrOn(){ return !isAr && daLangNow() === 'ur'; }
var DA_UR_DONE = /[ٹڈڑںےۓہیکگ۔]/;   // letters Urdu has and Arabic does not: the text is already Urdu
var _daUrMemo = {}, _daUrMemoN = 0, _daUrRuleKeys = null, _daUrKeyRe = null;
function daUrText(s){
  if(!s || DA_UR_DONE.test(s)) return s;   // never translate twice (some translations keep a Latin symbol such as "DO (mg/L)")
  if(_daUrMemo.hasOwnProperty(s)) return _daUrMemo[s];
  if(_daUrMemoN > 5000){ _daUrMemo = {}; _daUrMemoN = 0; }
  var r0 = daUrCore(s); _daUrMemo[s] = r0; _daUrMemoN++; return r0;
}
function daUrCore(s){
  var t = _daEnPreUr(s); if(!t || !/[A-Za-z]/.test(t)) return t;
  var trimmed = t.trim(); if(DA_UR[trimmed] !== undefined) return t.replace(trimmed, DA_UR[trimmed]);
  if(!_daUrRuleKeys){ _daUrRuleKeys = DA_UR_RULES.map(function(r){ return daRuleKey(r[0]); });
    _daUrKeyRe = DA_UR_KEYS.map(function(k){ return new RegExp('(^|[^A-Za-z])' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![A-Za-z])', 'g'); }); }
  DA_UR_RULES.forEach(function(r, i){ if(_daUrRuleKeys[i] && t.indexOf(_daUrRuleKeys[i]) < 0) return; r[0].lastIndex = 0; t = t.replace(r[0], r[1]); });
  DA_UR_KEYS.forEach(function(k, i){ if(t.indexOf(k) < 0) return; _daUrKeyRe[i].lastIndex = 0; t = t.replace(_daUrKeyRe[i], function(m, pre){ return pre + DA_UR[k]; }); });
  return t;
}
function daWorkerGuideUr(){
  return '<div class="ph"><div><h2>❓ رہنمائی</h2><p style="font-size:11px;color:var(--muted)">روزانہ کام کے لیے جو چاہیے</p></div></div><div class="card da-doc" style="line-height:2;font-size:15px" dir="rtl">'
    + '<h3>1. لاگ ان</h3><p>مینیجر کا بھیجا ہوا لنک کھولیں، اپنا <b>یوزر نیم</b> اور <b>پاس ورڈ</b> لکھیں، <b>لاگ ان</b> دبائیں۔ براؤزر کے مینو سے <b>Add to Home Screen</b> چنیں تاکہ یہ ایپ کی طرح کھلے۔ اپنا اکاؤنٹ کسی کو نہ دیں۔</p>'
    + '<h3>2. روزانہ فیڈ شیٹ</h3><ul><li>ہر ٹینک کے لیے آج دی گئی <b>مقدار</b> لکھیں (کلو — یا جہاں گروپ پر گرام لکھا ہو وہاں گرام) اور دانے کا <b>سائز</b> (1، 2 یا 3)۔</li>'
    + '<li><b>dead</b>: مردہ مچھلیاں، کاغذ کی طرح — <b>2+1</b> خود 3 بن جاتا ہے۔</li><li><b>X</b> = خوراک نہیں دی۔ خالی ٹینک بند ہوتے ہیں۔</li>'
    + '<li><b>📋 کسی دن سے کاپی</b> کسی اور دن کی مقدار اور سائز بھر دیتا ہے؛ جو مختلف ہو وہ بدلیں اور <b>💾 شیٹ محفوظ کریں</b> دبائیں۔</li></ul>'
    + '<h3>3. پانی کی جانچ</h3><ul><li><b>📅 روزانہ</b>: ہر سیکشن کا درجہ حرارت، pH اور آکسیجن، پھر <b>محفوظ کریں</b>۔ حد سے باہر ریڈنگ سرخ ہو جاتی ہے — نوٹس میں اصلاحی اقدام لکھیں۔</li>'
    + '<li><b>🧪 ہفتہ وار</b>: ہر سیکشن کی امونیا، نائٹرائٹ، نائٹریٹ، الکلینیٹی۔ جو جانچ نہیں ہوئی اس کا خانہ خالی چھوڑیں۔</li></ul>'
    + '<h3>4. نمونے</h3><p>ہر ٹینک کا <b>اوسط وزن</b> (گرام) اور <b>تولی گئی مچھلیوں</b> کی تعداد۔ پیلا رنگ = پچھلی بار سے کم یا دوگنے سے زیادہ — دوبارہ چیک کریں۔</p>'
    + '<h3>5. غلطی ہو جائے</h3><p>نمبر دوبارہ نہ لکھیں (دو بار گنا جائے گا)۔ اسی شیٹ میں درست کر کے دوبارہ محفوظ کریں، یا انجینئر کو بتائیں۔</p>'
    + '<h3>6. انٹرنیٹ نہ ہو</h3><p>کام جاری رکھیں — ڈیٹا فون میں محفوظ رہتا ہے اور انٹرنیٹ آنے پر بھیج دیا جاتا ہے۔ جب تک کچھ بھیجنا باقی ہو <b>لاگ آؤٹ نہ کریں</b>۔</p>'
    + '<h3>7. اپڈیٹ</h3><p>ایپ خود اپڈیٹ ہوتی ہے۔ اگر پہلے محفوظ کرنے کو کہے تو محفوظ کریں، پھر اپڈیٹ ہو جائے گی۔</p></div>';
}
function daLangPick(l){
  var m = document.getElementById('da-langmenu'); if(m) m.remove();
  var wantAr = l === 'ar'; if(isAr !== wantAr) _tlPreUr();   // the original switch (draws the page again; it stores ar / en)
  try{ localStorage.setItem(DA_LANG_KEY, l); }catch(e){}   // … so the choice is stored after it
  daLangApply(); show(currentView, true); if(typeof daWorkerBar === 'function') daWorkerBar(); if(typeof updateUserUI === 'function') updateUserUI();
  if(!isAr && typeof daEnNode === 'function') daEnNode(document.body);
}
function daLangApply(){   // direction + button label for the chosen language
  var l = daLangNow(); if(l === 'ur'){ document.documentElement.dir = 'rtl'; document.documentElement.lang = 'ur'; }
  var b = document.getElementById('lang-btn'); if(b) b.textContent = l === 'ur' ? 'اردو' : l === 'en' ? 'EN' : 'عربي';
}
if(!window._daUrWrapped){
  window._daUrWrapped = true;
  var _daEnPreUr = daEn;
  daEn = function(s){ return daUrOn() ? daUrText(s) : _daEnPreUr(s); };
  var _enNodePreUr = daEnNode;
  daEnNode = function(root){
    if(!daUrOn()) return _enNodePreUr.apply(this, arguments); if(!root) return;
    if(root.nodeType === 3){ if(root.parentElement && /^(SCRIPT|STYLE|TEXTAREA|NOSCRIPT)$/.test(root.parentElement.tagName)) return; var v = daUrText(root.nodeValue); if(v !== root.nodeValue) root.nodeValue = v; return; }
    if(root.nodeType !== 1 || /^(SCRIPT|STYLE|TEXTAREA|NOSCRIPT)$/.test(root.tagName)) return;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), n, list = []; while((n = w.nextNode())) if(/[A-Za-z\u0600-\u06FF]/.test(n.nodeValue) && n.parentElement && !/^(SCRIPT|STYLE|TEXTAREA|NOSCRIPT)$/.test(n.parentElement.tagName)) list.push(n);
    list.forEach(function(t){ var v = daUrText(t.nodeValue); if(v !== t.nodeValue) t.nodeValue = v; });
    var els = root.querySelectorAll ? [root].concat(Array.prototype.slice.call(root.querySelectorAll('[placeholder],[title]'))) : [];
    els.forEach(function(e){ ['placeholder', 'title'].forEach(function(a){ var x = e.getAttribute && e.getAttribute(a); if(x) e.setAttribute(a, daUrText(x)); }); });
  };
  var _fmtPreUr = daFmtDate;
  daFmtDate = function(v){ if(!daUrOn()) return _fmtPreUr.apply(this, arguments); var p = String(v || '').split('-'); if(p.length !== 3) return v || '—';
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); return DA_DAYS.ur[d.getUTCDay()] + ' ' + (+p[2]) + ' ' + DA_MONTHS.ur[+p[1] - 1] + ' ' + p[0] + (v === daToday() ? ' (آج)' : ''); };
  var _calPreUr = daCalOpen;   // the calendar in Urdu: drawn as Arabic-script, then the names swapped
  daCalOpen = function(inp, anchor, set){ var was = isAr; if(daUrOn()){ isAr = true; DA_DAYS._ar = DA_DAYS.ar; DA_MONTHS._ar = DA_MONTHS.ar; DA_DAYS.ar = DA_DAYS.ur; DA_MONTHS.ar = DA_MONTHS.ur; }
    try{ return _calPreUr.apply(this, arguments); } finally { if(DA_DAYS._ar){ DA_DAYS.ar = DA_DAYS._ar; DA_MONTHS.ar = DA_MONTHS._ar; delete DA_DAYS._ar; delete DA_MONTHS._ar; } isAr = was; } };
  var _tlPreUr = toggleLang;
  toggleLang = function(direct){   // workers and the login page: a choice of three; office users: Arabic / English as before
    if(direct === true) return _tlPreUr.apply(this, arguments);   // the app itself switching (at start-up), not the button
    if(currentUser && currentUserRole !== 'worker'){ try{ if(localStorage.getItem(DA_LANG_KEY) === 'ur') localStorage.setItem(DA_LANG_KEY, isAr ? 'en' : 'ar'); }catch(e){} return _tlPreUr.apply(this, arguments); }
    var old = document.getElementById('da-langmenu'); if(old){ old.remove(); return; }
    var b = document.getElementById('lang-btn'), r = b ? b.getBoundingClientRect() : {bottom:60, left:10}, m = document.createElement('div'); m.id = 'da-langmenu';
    m.style.cssText = 'position:fixed;z-index:9999;top:' + (r.bottom + 6) + 'px;left:' + Math.max(6, Math.min(r.left, window.innerWidth - 170)) + 'px;background:#fff;border:1px solid #cbd5e1;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.2);padding:6px;display:flex;flex-direction:column;gap:4px;min-width:150px';
    m.innerHTML = [['ar', 'عربي'], ['en', 'English'], ['ur', 'اردو']].map(function(x){ var on = daLangNow() === x[0];
      return '<button data-l="' + x[0] + '" style="padding:12px 14px;border:0;border-radius:8px;font:inherit;font-size:16px;font-weight:700;cursor:pointer;text-align:center;background:' + (on ? 'var(--teal)' : '#f1f5f9') + ';color:' + (on ? '#fff' : 'inherit') + '">' + x[1] + '</button>'; }).join('');
    document.body.appendChild(m); m.querySelectorAll('button').forEach(function(x){ x.onclick = function(){ daLangPick(x.dataset.l); }; }); };
  if(VIEWS.help){ var _vhUr = VIEWS.help; VIEWS.help = function(){ if(daUrOn()) return daWorkerGuideUr(); return _vhUr.apply(this, arguments); }; }
  var _uuiPreUr = updateUserUI;
  updateUserUI = function(){ var r = _uuiPreUr.apply(this, arguments); daLangApply(); return r; };
  try{ if(localStorage.getItem(DA_LANG_KEY) === 'ur' && isAr) setTimeout(function(){ _tlPreUr(); try{ localStorage.setItem(DA_LANG_KEY, 'ur'); }catch(e){} daLangApply(); show(currentView, true); }, 0); }catch(e){}
  setTimeout(daLangApply, 0);
}
