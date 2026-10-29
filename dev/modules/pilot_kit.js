// ══════════════════════════════════════════════════════════
//  PILOT KIT — user guide (worker / engineer / admin) + terms & privacy
// ══════════════════════════════════════════════════════════
// Fill these before inviting a pilot farm. Empty values fall back to neutral wording (never to invented facts).
var DA_LEGAL = {
  operator: '',            // legal name of whoever runs the platform, e.g. "Dar Aqua W.L.L."
  contact: '',             // support / privacy e-mail
  dataRegion: '',          // Supabase project region, e.g. "Frankfurt (EU)" — Settings → General in Supabase
  deleteDays: 30,          // days to delete a farm's data after the service ends
  updated: '2026-10-28'
};
function daLegalOp(){ return DA_LEGAL.operator ? daEsc(DA_LEGAL.operator) : 'مشغّل المنصة'; }
function daLegalContact(){ return DA_LEGAL.contact ? '<a href="mailto:' + daEsc(DA_LEGAL.contact) + '">' + daEsc(DA_LEGAL.contact) + '</a>' : 'مدير مزرعتك (هو بيتواصل مع ' + daLegalOp() + ')'; }

function daDocCss(){
  return '<style>.da-doc{line-height:1.9;font-size:14px}.da-doc h3{font-size:16px;margin:18px 0 6px;color:var(--deep)}.da-doc ol,.da-doc ul{padding-inline-start:20px;margin:4px 0}'
    + '.da-doc li{margin:3px 0}.da-doc .tip{background:var(--light,#f1f5f9);border-radius:8px;padding:8px 12px;margin:8px 0;font-size:13px}'
    + '.da-doc .path{display:inline-block;background:#e0f2f1;color:#0f766e;border-radius:6px;padding:0 6px;font-weight:700;font-size:13px}'
    + '@media print{.no-print{display:none!important}.da-doc{font-size:12px}}</style>';
}
function daPath(){ return '<span class="path">' + Array.prototype.slice.call(arguments).map(daEsc).join(' ← ') + '</span>'; }
function daTabs(cur, tabs, setter){
  return '<div class="tabs no-print" style="margin-bottom:12px">' + tabs.map(function(t){
    return '<button class="tab' + (t[0] === cur ? ' on' : '') + '" data-t="' + t[0] + '" onclick="' + setter + '=this.dataset.t;show(currentView,true)">' + t[1] + '</button>'; }).join('') + '</div>';
}

// ── user guide ──
function renderHelp(){
  var role = typeof currentUserRole !== 'undefined' ? currentUserRole : '';
  if(!window._helpTab) window._helpTab = role === 'worker' ? 'worker' : (role === 'admin' ? 'admin' : 'engineer');
  var t = window._helpTab;
  var h = daDocCss() + '<div class="ph"><div><h2>❓ دليل الاستخدام</h2><p style="font-size:11px;color:var(--muted)">مختصر — اللي محتاجه كل يوم</p></div>'
    + '<button class="no-print" onclick="window.print()" style="padding:8px 14px;border:1.5px solid var(--line);background:#fff;border-radius:8px;font:inherit;cursor:pointer">🖨️ طباعة</button></div>';
  h += daTabs(t, [['worker', '👷 العامل'], ['engineer', '🧑‍🔬 المهندس'], ['admin', '🛠️ الأدمن والمدير']], 'window._helpTab');
  h += '<div class="card da-doc" id="help-' + t + '">';
  if(t === 'worker') h += ''
    + '<h3>1. أول مرة</h3><ol><li>ادخل بالإيميل وكلمة السر اللي الأدمن اداهملك. متديش حسابك لحد.</li>'
    + '<li><b>ثبّت الأداة على الشاشة الرئيسية:</b> آيفون: من Safari ← زرار المشاركة ← "إضافة إلى الشاشة الرئيسية". أندرويد: من Chrome ← ⋮ ← "تثبيت التطبيق". ده بيحمي البيانات اللي على الموبايل من المسح.</li></ol>'
    + '<h3>2. العلف</h3><ul><li>العلف بيتسجل من مكان واحد بس: ' + daPath('الإدخال', 'شيت العلف اليومي') + ' — نفس ترتيب الشيت الورق: الكمية في كل وجبة (كيلو، أو جرام في الجداول المكتوب عليها "بالجرام")، والحجم (1 أو 2 أو 3)، والنافق زي الورق (2+1 بيتجمع). <b>X</b> = متأكلش الوجبة، و✕ آخر السطر = متأكلش اليوم كله. نوع العلف بيتختار مرة واحدة فوق.</li>'
    + '<li>لأيام فاتت (مثلاً آخر الأسبوع): اختار التاريخ فوق الشيت وسجّل كل يوم من ورقته.</li></ul>'
    + '<h3>3. النفوق والعينات والمياه</h3><ul><li>' + daPath('الإدخال', 'النفوق') + ': العدد لكل تانك. السبب اختياري — اختاره لو عارفه.</li>'
    + '<li>' + daPath('الإدخال', 'العينات') + ': متوسط الوزن بالجرام.</li><li>' + daPath('الإدخال', 'شيت القياسات اليومي') + ': قراية واحدة لكل سكشن زي الشيت الورق. ✓/✗ بتطلع لوحدها، ولو فيه ✗ اكتب الإجراء التصحيحي.</li></ul>'
    + '<h3>4. لو ظهرت رسالة مراجعة</h3><ul><li>⛔ <b>مرفوض:</b> مش هيتحفظ — صحح الرقم أو التاريخ وادخله تاني.</li><li>⚠️ <b>تحذير:</b> الرقم غريب. لو متأكد اضغط احفظ، وهيروح للمهندس يراجعه.</li></ul>'
    + '<h3>5. لو غلطت</h3><p>متدخلش الرقم تاني (هيتحسب مرتين). قول للمهندس يعدّل الإدخال الغلط.</p>'
    + '<h3>6. من غير نت</h3><p>سجّل عادي — بيتحفظ على الموبايل ويترفع لوحده لما النت يرجع. <b>لو ظهرلك تحذير إن فيه عمليات لسه متزامنتش، متعملش تسجيل خروج</b> لحد ما النت يرجع.</p>'
    + '<h3>7. التابات</h3><p>كل صفحة بتفتحها بتظهر كتاب تحت القايمة. تقدر تسيب إدخال في النص، تروح لصفحة تانية، وترجعله تكمّل — اللي كتبته بيفضل لحد ما تحفظ أو تقفل التاب من ×. النقطة البرتقالي ● معناها فيه بيانات لسه متحفظتش.</p>'
    + '<div class="tip">💡 تقدر تسجل بتاريخ قديم (مثلاً آخر الأسبوع)، بس مش بتاريخ بكرة.</div>';
  else if(t === 'engineer') h += ''
    + '<div class="tip">🗂️ كل صفحة بتتفتح في تاب، واللي اتكتب فيها بيفضل لحد الحفظ أو قفل التاب (● = مش محفوظ). التحديث التلقائي وإدخالات المستخدمين التانيين مش بيمسحوا تاب فيه بيانات متحفظتش.</div>'
    + '<h3>كل يوم</h3><ol><li>' + daPath('الرئيسية', 'التنبيهات الذكية') + ': الكثافة، العلف، النفوق، المياه، الفلتر، الحصاد القريب، FCR.</li>'
    + '<li>' + daPath('الرئيسية', 'مراجعة البيانات') + ': اعتمد إدخالات العمال (الرقم على تبويب الرئيسية = اللي مستني).</li>'
    + '<li>' + daPath('الإنتاج والعلف', 'شيت التغذية للطباعة') + ': الكميات والوجبات حسب الحرارة — اطبعه للعمال.</li></ol>'
    + '<h3>تصحيح إدخال</h3><p>' + daPath('التقارير والتتبع', 'تتبع الوحدة والدفعة') + ' ← اختار التانك ← ✏️ جنب الإدخال. لازم تكتب سبب التعديل، وبيتسجل في ' + daPath('سجل التعديلات') + '.</p>'
    + '<h3>العينات = أساس كل الحسابات</h3><ul><li>SGR وFCR وتوقع الحصاد كلهم بيتحسبوا من عينتين بينهم <b>7 أيام على الأقل</b> وعلف متسجل في النص.</li>'
    + '<li>الأفضل: عينة لكل تانك كل 1–2 أسبوع، ويُفضّل السكشن كله في نفس اليوم.</li></ul>'
    + '<h3>التحليل</h3><ul><li>' + daPath('التحليل', 'FCR حسب المرحلة') + ': بيولوجي واقتصادي لكل حجم علف ولكل سكشن. الفترات اللي علفها ناقص مش بتدخل، وبتظهر في "فترات محتاجة مراجعة". عدّل FCR المتوقع من آخر الصفحة.</li>'
    + '<li>' + daPath('التحليل', 'تخطيط الحصاد') + ': حدد الوزن المستهدف واضغط حفظ — بعدها بيطلع تنبيه قبل الحصاد بأسبوعين لكل سكشن.</li>'
    + '<li>تانكات الأمهات والعزل: ' + daPath('تتبع الوحدة والدفعة') + ' ← ✏️ تعديل ← الغرض. بتتشال من FCR وتنبيه الحصاد.</li>'
    + '<li>' + daPath('الإنتاج والعلف', 'حمل الفلتر الحيوي') + ' و' + daPath('توقع العلف والشراء') + '.</li></ul>'
    + '<h3>التقرير الأسبوعي</h3><p>' + daPath('التقارير والتتبع', 'التقرير الأسبوعي') + ' — بيطلع كارت على لوحة التحكم لما الأسبوع يخلص. <b>ابعته لما اكتمال العلف يوصل 95%</b>؛ لو أقل، التانكات الناقصة مكتوبة.</p>';
  else h += ''
    + '<h3>المستخدمين</h3><ul><li>' + daPath('الإعداد', 'المستخدمين والصلاحيات') + ': ضيف كل شخص بإيميله ودوره (عامل / مهندس / مدير / مشاهد). تقدر تعدّل الصلاحيات لكل شخص أو توقفه.</li>'
    + '<li>حساب لكل شخص — ده اللي بيخلي سجل "مين أدخل إيه" مظبوط.</li></ul>'
    + '<h3>المزرعة</h3><ul><li>' + daPath('الإعداد', 'إعداد المزرعة') + ': البيوت والسكاشن والتانكات وأحجامها.</li>'
    + '<li>' + daPath('الإعداد', 'الإعدادات العامة', 'المعايير') + ': حدود التنبيهات وقايمة أسباب النفوق.</li></ul>'
    + '<h3>⚠️ النسخ الاحتياطي</h3><p>الخادم الحالي <b>مفيهوش نسخ احتياطية يومية تلقائية</b>. اعمل ' + daPath('إعداد المزرعة', '⬇️ نسخة احتياطية Excel') + ' مرة في الأسبوع على الأقل واحفظها برّه الموبايل.</p>'
    + '<h3>الدعم</h3><p>أي مشكلة أو طلب: ' + daLegalContact() + '. الأعطال التقنية بتتسجل لوحدها عند مشغّل المنصة.</p>';
  h += '</div><div class="no-print" style="text-align:center;margin:14px 0;font-size:12px"><a href="#" onclick="show(&quot;legal&quot;);return false">الشروط وسياسة الخصوصية</a></div>';
  return h;
}

// ── terms & privacy (readable before login) ──
function renderLegal(){
  var t = window._legalTab || 'privacy', op = daLegalOp();
  var h = daDocCss() + '<div class="ph"><div><h2>📜 الشروط والخصوصية</h2><p style="font-size:11px;color:var(--muted)">آخر تحديث: ' + DA_LEGAL.updated + '</p></div>'
    + (typeof currentUser !== 'undefined' && currentUser ? '' : '<button class="no-print" onclick="show(&quot;login-page&quot;)" style="padding:8px 14px;border:1.5px solid var(--line);background:#fff;border-radius:8px;font:inherit;cursor:pointer">← الدخول</button>') + '</div>';
  h += daTabs(t, [['privacy', '🔒 سياسة الخصوصية'], ['terms', '📄 شروط الاستخدام']], 'window._legalTab');
  h += '<div class="card da-doc" id="legal-' + t + '">';
  if(t === 'privacy') h += ''
    + '<p>الصفحة دي بتشرح البيانات اللي Farm Manager بيتعامل معاها. المسؤول عن المنصة: <b>' + op + '</b>. المسؤول عن بيانات كل مزرعة وعن مستخدميها: المزرعة نفسها.</p>'
    + '<h3>البيانات اللي بنحفظها</h3><ul>'
    + '<li><b>الحساب:</b> الاسم، الإيميل، الدور والصلاحيات، وآخر دخول. كلمة السر بتتحفظ مشفّرة عند مزود الدخول ومحدش يقدر يقراها.</li>'
    + '<li><b>بيانات الإنتاج:</b> التانكات والعلف والنفوق والعينات والمياه والحصاد والعلاجات والمخزون والإعدادات — ومع كل إدخال مين أدخله وإمتى.</li>'
    + '<li><b>تقارير الأعطال:</b> لما حاجة تقع في الأداة بيتبعت وصف الخطأ، الصفحة، نوع المتصفح، وإيميل المستخدم ودوره. بيشوفها مشغّل المنصة بس، وبتتحذف بعد 90 يوم.</li></ul>'
    + '<h3>اللي مش بنعمله</h3><ul><li>مفيش إعلانات، ولا أدوات تتبع أو تحليلات، ولا بيع أو مشاركة للبيانات لأغراض تسويقية.</li><li>مش بنجمع الموقع الجغرافي.</li></ul>'
    + '<h3>البيانات بتتحفظ فين</h3><ul>'
    + '<li><b>قاعدة البيانات والدخول:</b> عند مزود الخدمة Supabase' + (DA_LEGAL.dataRegion ? ' (' + daEsc(DA_LEGAL.dataRegion) + ')' : '') + '. كل مزرعة معزولة: مستخدمي مزرعة مش بيقدروا يشوفوا مزرعة تانية.</li>'
    + '<li><b>على الجهاز:</b> نسخة من بيانات المزرعة عشان الأداة تشتغل من غير نت. بتتمسح عند تسجيل الخروج.</li>'
    + '<li><b>الاستضافة:</b> الصفحة متقدمة من GitHub Pages، ومكتبة Excel من شبكة Cloudflare؛ الخدمتين دول بيشوفوا عنوان الـ IP زي أي موقع.</li></ul>'
    + '<h3>المستشار الذكي</h3><p>لو استخدمته بس: سؤالك وملخص بأرقام المزرعة (أسماء التانكات، عدد السمك، الكتلة، العلف، النفوق، التنبيهات) بيتبعتوا لخدمة Cloudflare Workers AI عشان يتولّد الرد. الملخص ده مفيهوش أسماء أشخاص ولا إيميلات، وخادمنا مش بيحفظ الأسئلة. الردود آلية وممكن تغلط.</p>'
    + '<h3>مين يقدر يشوف البيانات</h3><ul><li>مستخدمي المزرعة، كل واحد حسب صلاحياته اللي الأدمن حددها.</li>'
    + '<li>' + op + ' عنده صلاحية إدارية تقنية على الخادم، ومش بيطّلع على بيانات الإنتاج إلا بطلب منكم للدعم الفني أو لو القانون طلب كده.</li></ul>'
    + '<h3>مدة الاحتفاظ والحذف</h3><ul><li>بيانات المزرعة بتفضل طول ما الخدمة شغالة.</li><li>لما الخدمة تنتهي: تقدروا تصدّروا بياناتكم، وبعدها بتتحذف خلال ' + (DA_LEGAL.deleteDays || 30) + ' يوم.</li>'
    + '<li>المستخدم اللي بيتشال من المزرعة بيتحذف حسابه، وإدخالاته القديمة بتفضل في سجل المزرعة باسمه وإيميله (عشان سجل مين أدخل إيه يفضل كامل).</li></ul>'
    + '<h3>حقوقك</h3><p>تقدر تطلب نسخة من بياناتك أو تصحيحها أو حذفها عن طريق ' + daLegalContact() + '. بنتعامل مع البيانات الشخصية وفق قانون حماية البيانات الشخصية في مملكة البحرين (القانون رقم 30 لسنة 2018).</p>';
  else h += ''
    + '<h3>1. الخدمة</h3><p>Farm Manager أداة لإدارة إنتاج مزارع الأسماك يقدمها ' + op + '. خلال الفترة التجريبية بتتقدم كما هي، وممكن تتغير أو تتحدث؛ التحديثات بتظهر كإشعار "نسخة جديدة".</p>'
    + '<h3>2. الحسابات</h3><ul><li>أدمن المزرعة بيضيف المستخدمين ومسؤول عن صلاحياتهم وعن شيل اللي ساب الشغل.</li><li>كل مستخدم مسؤول عن كلمة سره. ممنوع مشاركة الحساب.</li></ul>'
    + '<h3>3. ملكية البيانات</h3><p>بيانات المزرعة ملك المزرعة. تقدروا تصدّروها في أي وقت (' + daPath('إعداد المزرعة', 'نسخة احتياطية Excel') + ') أو تطلبوا حذفها.</p>'
    + '<h3>4. الحسابات والتوصيات</h3><p>كميات العلف وFCR وتوقعات الحصاد والتنبيهات وردود المستشار الذكي <b>استرشادية</b> ومبنية على البيانات المتسجلة وعلى جداول افتراضية للبلطي. القرار الفني والبيطري وسلامة السمك مسؤولية المزرعة.</p>'
    + '<h3>5. التوفر والنسخ الاحتياطي</h3><p>خلال الفترة التجريبية مفيش ضمان لاستمرار الخدمة بدون انقطاع، والخادم الحالي مفيهوش نسخ احتياطية يومية تلقائية. على المزرعة تعمل نسخة احتياطية دورية (مرة في الأسبوع على الأقل).</p>'
    + '<h3>6. الاستخدام المقبول</h3><p>ممنوع محاولة الوصول لبيانات مزرعة تانية، أو تعطيل الخدمة، أو استخدامها في حاجة مخالفة للقانون.</p>'
    + '<h3>7. إنهاء الخدمة</h3><p>أي طرف يقدر ينهي الاستخدام بإخطار الطرف التاني. بعد الإنهاء تقدروا تصدّروا بياناتكم، وبعدها بتتحذف خلال ' + (DA_LEGAL.deleteDays || 30) + ' يوم.</p>'
    + '<h3>8. التواصل</h3><p>' + daLegalContact() + '.</p>';
  return h + '</div>';
}

// ── registration ──
VIEWS['help'] = renderHelp; VIEWS['legal'] = renderLegal;
PUBLIC_VIEWS['legal'] = 1;                      // readable before login (linked from the login page)
PUBLIC_VIEWS['help'] = 1;                       // every role, no permission needed
(function(){
  var home = DA_NAV.filter(function(g){ return g.id === 'home'; })[0];
  if(home && !home.items.some(function(it){ return it[0] === 'help'; })) home.items.push(['help', '❓', 'دليل الاستخدام', 'User Guide']);
})();
// error reports: keep the privacy promise (deleted after 90 days) without anyone having to press a button
if(!window._daPruneWrapped && typeof platformLoadErrors === 'function'){
  window._daPruneWrapped = true;
  var _pfLoadErrorsCore = platformLoadErrors;
  platformLoadErrors = async function(){
    try{
      var k = 'daracqua_prune_day';
      if(localStorage.getItem(k) !== daToday()){ await sbFetch('rpc/platform_prune_errors', {method:'POST', body:'{}'}); _lsSetRaw.call(localStorage, k, daToday()); }
    }catch(e){}
    return _pfLoadErrorsCore.apply(this, arguments);
  };
}
