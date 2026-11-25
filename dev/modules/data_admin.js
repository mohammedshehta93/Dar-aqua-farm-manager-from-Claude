// ══════════════════════════════════════════════════════════
//  DATA MANAGEMENT (owner, 2026-11-25) — backup, restore, archive, reset, handover
// ══════════════════════════════════════════════════════════
// Admin only (Settings → 🧰 إدارة البيانات). Nothing is removed from the tool; these are options for when they are needed:
// • 📦 a COMPLETE backup file (JSON: tanks, every record, settings, feed stock, maintenance, the user list) — and the
//   existing Excel export; ♻️ restore from such a file (cloud first, then every device reloads it).
// • 🗂️ archive = the backup kept in the farm's private cloud folder (bucket farm-archives/<farm_id>/) + a level-1 reset:
//   start fresh, the old season stays downloadable / restorable.
// • ⚠️ reset, three levels: 1 records only · 2 records + tanks · 3 everything (the other accounts are switched off; the
//   admin's own stays). Safeguards: a backup file is downloaded first, the farm's name typed, the admin's password.
//   Every other device wipes its local copy when it sees the reset mark (synced 'daracqua_settings_v2_reset').
// • 🤝 handing the farm over and 🆕 a new farm: the steps (owner wants to be able to leave a farm with its data and
//   start elsewhere without taking anything).
var DA_RESET_KEY = 'daracqua_settings_v2_reset', DA_RESET_SEEN = 'da_reset_seen';   // the "seen" mark is not synced and survives a local wipe
function daDaFarmName(){ return String((getSession() || {}).farm_name || 'المزرعة').trim(); }
async function daDaBackupObj(){
  var settings = {}; for(var i = 0; i < localStorage.length; i++){ var k = localStorage.key(i); if(daIsSyncedKey(k)) settings[k] = localStorage.getItem(k); }
  var maint = [], users = [];
  try{ maint = await sbFetch('maintenance_requests?select=*&limit=5000') || []; }catch(e){}
  try{ users = (await sbFetch('profiles?select=id,name,email,role,perms,active') || []); }catch(e){}
  return {meta:{app:'Farm Manager', kind:'full-backup', version:1, farm_id:SB_FARM_ID, farm_name:daDaFarmName(), at:new Date().toISOString(), by:(getSession() || {}).name || ''},
    units:JSON.parse(JSON.stringify(RAW)), tx:getTX().slice(), settings:settings, feedInv:(typeof getFeedInv === 'function' ? getFeedInv() : []), maintenance:maint, users:users};
}
function daDaFileName(o, tag){ return 'farm-' + (tag || 'backup') + '-' + String(o.meta.farm_name).replace(/[^\w\u0600-\u06FF-]+/g, '_') + '-' + o.meta.at.slice(0, 10) + '.json'; }
function daDaDownload(o, tag){ var b = new Blob([JSON.stringify(o)], {type:'application/json'}), a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = daDaFileName(o, tag); document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 2000); }
async function daDaBackup(){ toast('📦 بيجهّز النسخة…'); var o = await daDaBackupObj(); daDaDownload(o); toast('✅ اتنزلت النسخة الكاملة: ' + o.units.length + ' تانك · ' + o.tx.length + ' سجل'); return o; }
// ── restore: the cloud first, then this device (and every other) reloads from it ──
async function daDaRestoreObj(o, quiet){
  if(!o || !o.meta || o.meta.app !== 'Farm Manager' || !Array.isArray(o.tx) || !Array.isArray(o.units)) throw new Error('الملف ده مش نسخة من الأداة');
  if(!quiet && !confirm('استعادة نسخة "' + o.meta.farm_name + '" من ' + o.meta.at.slice(0, 10) + ':\n' + o.units.length + ' تانك · ' + o.tx.length + ' سجل\n\nهتتضاف للي موجود (السجل اللي ليه نفس الرقم بيتحدث). تكمل؟')) return false;
  toast('♻️ بيستعيد…');
  if(o.units.length) await saveUnitsToCloud(o.units);
  var failed = o.tx.length ? await daUploadTxBatch(o.tx) : []; if(failed.length) throw new Error(failed.length + ' سجل مترفعوش — جرّب تاني');
  if(o.settings) Object.keys(o.settings).forEach(function(k){ if(daIsSyncedKey(k) && k !== DA_RESET_KEY) localStorage.setItem(k, o.settings[k]); });
  if(typeof daPushSettings === 'function') await daPushSettings();
  if((o.feedInv || []).length) try{ await sbFetch('feed_inventory', {method:'POST', headers:{Prefer:'resolution=merge-duplicates'}, body:JSON.stringify(o.feedInv.map(function(r){ return Object.assign({}, r, {farm_id:SB_FARM_ID}); }))}); }catch(e){}
  if((o.maintenance || []).length) try{ await sbFetch('maintenance_requests', {method:'POST', headers:{Prefer:'resolution=merge-duplicates'}, body:JSON.stringify(o.maintenance.map(function(r){ return Object.assign({}, r, {farm_id:SB_FARM_ID}); }))}); }catch(e){}
  return true;
}
function daDaRestorePick(){ var inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
  inp.onchange = function(){ var f = inp.files[0]; if(!f) return; var rd = new FileReader();
    rd.onload = async function(){ try{ var o = JSON.parse(rd.result); if(await daDaRestoreObj(o)){ await daWipeLocalTenant(); localStorage.setItem(DA_RESET_SEEN, new Date().toISOString()); toast('✅ اتستعادت — بيحمّل من جديد'); setTimeout(function(){ location.reload(); }, 900); } }catch(e){ toast('❌ ' + e.message); } };
    rd.readAsText(f); }; inp.click(); }
// ── safeguards ──
async function daDaConfirm(what){
  var name = daDaFarmName(), typed = prompt('⚠️ ' + what + '\n\nللتأكيد اكتب اسم المزرعة بالظبط: ' + name);
  if(typed === null) return false; if(String(typed).trim() !== name){ toast('❌ الاسم مش مطابق — اتلغى'); return false; }
  var pw = prompt('🔒 اكتب الباسورد بتاعك للتأكيد'); if(!pw) return false;
  try{ var email = (currentUser && currentUser.email) || (getSession() || {}).email, base = (SB_URL || '').replace(/\/+$/, '');
    var r = await fetch(base + '/auth/v1/token?grant_type=password', {method:'POST', headers:{apikey:SB_KEY, 'Content-Type':'application/json'}, body:JSON.stringify({email:email, password:pw})});
    if(!r.ok){ toast('❌ الباسورد غلط — اتلغى'); return false; } }catch(e){ toast('❌ مقدرتش أتأكد من الباسورد — اتلغى'); return false; }
  return true;
}
var DA_RESET_LEVELS = {1:'السجلات بس (علف، نفوق، عينات، قياسات، نقل، حصاد، أوامر، صيانة، شرا، جرد) — التانكات والإعدادات والحسابات فاضلين',
  2:'السجلات + التانكات والسكاشن — الإعدادات والحسابات فاضلين', 3:'كل حاجة: السجلات والتانكات والإعدادات، وكل الحسابات بتتوقف ما عدا حسابك'};
async function daDaWipeCloud(level){
  // the records and tanks must go (an error stops here, before this device is touched); the side tables never stop a reset
  var f = encodeURIComponent(SB_FARM_ID), del = function(q){ return sbFetch(q, {method:'DELETE'}).catch(function(e){ if(!/404|42P01|does not exist/i.test(String(e && e.message))) throw e; }); };
  var side = function(q){ return sbFetch(q, {method:'DELETE'}).catch(function(e){ console.warn('reset: ' + q.split('?')[0] + ' — ' + (e && e.message)); }); };
  if(level >= 3){ await sbFetch('rpc/wipe_my_farm_data', {method:'POST', body:'{}'}); }
  else{ await del('transactions?farm_id=eq.' + f); if(level >= 2) await del('farm_units?farm_id=eq.' + f); await side('feed_inventory?farm_id=eq.' + f); await side('snapshots?farm_id=eq.' + f); }
  await side('maintenance_requests?farm_id=eq.' + f);
  if(level >= 3){ var me = typeof daPushUid === 'function' ? daPushUid() : ''; if(me) await sbFetch('profiles?farm_id=eq.' + f + '&id=neq.' + encodeURIComponent(me), {method:'PATCH', body:JSON.stringify({active:false})}); }
}
async function daDaMarkReset(level){   // every device that sees this mark wipes its local copy once
  var at = new Date().toISOString(); localStorage.setItem(DA_RESET_KEY, JSON.stringify({at:at, level:level, by:(getSession() || {}).name || ''})); localStorage.setItem(DA_RESET_SEEN, at);
  if(typeof daPushSettings === 'function') await daPushSettings(); return at;
}
async function daDaReset(level, skipBackup){
  if(currentUserRole !== 'admin') return;
  if(!skipBackup){ if(!confirm('⚠️ إعادة ضبط — المستوى ' + level + ':\n' + DA_RESET_LEVELS[level] + '\n\nهتنزل نسخة كاملة على جهازك الأول. تكمل؟')) return; await daDaBackup(); }
  if(!(await daDaConfirm('إعادة الضبط — المستوى ' + level + ': ' + DA_RESET_LEVELS[level]))) return;
  try{ toast('⏳ بيمسح…'); await daDaWipeCloud(level); }
  catch(e){ toast('❌ ' + (e && e.message || e) + ' — ماتمسحش حاجة من الجهاز، والنسخة اللي نزلت فيها كل حاجة'); return; }
  // levels 1-2 keep the settings: the device's copy is wiped, so put them back before the reset mark is pushed (the push
  // sends every synced key — without this the cloud settings would be replaced by an empty set)
  var keep = {}; if(level < 3) for(var i = 0; i < localStorage.length; i++){ var k = localStorage.key(i); if(daIsSyncedKey(k) && k !== DA_RESET_KEY) keep[k] = localStorage.getItem(k); }
  try{ await daWipeLocalTenant(); Object.keys(keep).forEach(function(k){ localStorage.setItem(k, keep[k]); }); await daDaMarkReset(level);
    toast('✅ اتعملت إعادة الضبط — الأجهزة التانية هتتمسح أول ما تفتح'); setTimeout(function(){ location.reload(); }, 1200); }
  catch(e){ toast('❌ ' + (e && e.message || e) + ' — النسخة اللي نزلت فيها كل حاجة'); }
}
// ── archive: the backup in the farm's private cloud folder, then a fresh start (level 1) ──
async function daDaGz(text){ if(typeof CompressionStream === 'undefined') return new Blob([text], {type:'application/json'}); return new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))).blob(); }
async function daDaGunzip(blob){ if(typeof DecompressionStream === 'undefined') return blob.text(); try{ return await new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).text(); }catch(e){ return blob.text(); } }
function daDaStore(path){ return (SB_URL || '').replace(/\/+$/, '') + '/storage/v1/object/' + path; }
function daDaAuthH(x){ return Object.assign({apikey:SB_KEY, Authorization:'Bearer ' + (SB_TOKEN || SB_KEY)}, x || {}); }
async function daDaArchive(){
  if(currentUserRole !== 'admin') return;
  var label = prompt('🗂️ اسم الأرشيف (مثلاً: موسم 2026)', 'موسم ' + daToday().slice(0, 4)); if(label === null) return;
  if(!confirm('🗂️ أرشفة وبداية جديدة:\n• كل البيانات الحالية هتتحفظ في أرشيف "' + label + '" على السحابة (تقدر تنزّله أو ترجّعه)\n• وبعدها السجلات بتتمسح (التانكات والإعدادات والحسابات فاضلين)\n\nتكمل؟')) return;
  var o = await daDaBackupObj(); o.meta.kind = 'archive'; o.meta.label = label;
  try{ var gz = await daDaGz(JSON.stringify(o)), path = 'farm-archives/' + SB_FARM_ID + '/' + o.meta.at.replace(/[:.]/g, '-') + '__' + encodeURIComponent(label.replace(/[\/\\]/g, '-')) + '.json.gz';
    var r = await fetch(daDaStore(path), {method:'POST', headers:daDaAuthH({'Content-Type':'application/gzip'}), body:gz}); if(!r.ok) throw new Error('الأرشيف ما اترفعش (' + r.status + ') — اتأكد إن ملف farm_archives.sql اتشغّل');
  }catch(e){ toast('❌ ' + e.message); return; }
  toast('✅ اتحفظ الأرشيف "' + label + '"'); await daDaReset(1, true);
}
async function daDaArchives(){
  var r = await fetch((SB_URL || '').replace(/\/+$/, '') + '/storage/v1/object/list/farm-archives', {method:'POST', headers:daDaAuthH({'Content-Type':'application/json'}), body:JSON.stringify({prefix:SB_FARM_ID + '/', limit:100, sortBy:{column:'name', order:'desc'}})});
  if(!r.ok) return null; var L = await r.json(); return (L || []).filter(function(x){ return /\.json(\.gz)?$/.test(x.name); });
}
async function daDaArchiveGet(name){ var r = await fetch(daDaStore('farm-archives/' + SB_FARM_ID + '/' + name), {headers:daDaAuthH()}); if(!r.ok) throw new Error('مقدرتش أنزّل الأرشيف'); return JSON.parse(await daDaGunzip(await r.blob())); }
async function daDaArchiveDl(name){ try{ var o = await daDaArchiveGet(name); daDaDownload(o, 'archive'); }catch(e){ toast('❌ ' + e.message); } }
async function daDaArchiveRestore(name){ try{ var o = await daDaArchiveGet(name); if(await daDaRestoreObj(o)){ await daWipeLocalTenant(); localStorage.setItem(DA_RESET_SEEN, new Date().toISOString()); toast('✅ اترجع الأرشيف — بيحمّل من جديد'); setTimeout(function(){ location.reload(); }, 900); } }catch(e){ toast('❌ ' + e.message); } }
async function daDaLoadArchives(){ var el = document.getElementById('da-arch-list'); if(!el) return; var L = null; try{ L = await daDaArchives(); }catch(e){}
  if(!document.getElementById('da-arch-list')) return;
  el.innerHTML = L === null ? '<div style="font-size:12px;color:var(--muted)">الأرشيف مش متاح لسه — شغّل ملف farm_archives.sql في Supabase مرة واحدة.</div>'
    : !L.length ? '<div style="font-size:12px;color:var(--muted)">مفيش أرشيف لسه.</div>'
    : L.map(function(x){ var p = x.name.split('__'), lbl = decodeURIComponent((p[1] || '').replace(/\.json(\.gz)?$/, '')), d = p[0].slice(0, 10);
      return '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #f1f5f9;flex-wrap:wrap"><span>🗂️ <b>' + daEsc(lbl || x.name) + '</b> <span style="color:var(--muted);font-size:12px">' + daEsc(d) + '</span></span><span style="display:flex;gap:6px">'
        + '<button onclick="daDaArchiveDl(&quot;' + daEsc(x.name) + '&quot;)" style="padding:5px 10px;border:1px solid var(--line);background:#fff;border-radius:7px;cursor:pointer;font:inherit;font-size:12px">⬇️ نزّل</button>'
        + '<button onclick="daDaArchiveRestore(&quot;' + daEsc(x.name) + '&quot;)" style="padding:5px 10px;border:1px solid var(--line);background:#fff;border-radius:7px;cursor:pointer;font:inherit;font-size:12px">♻️ رجّعه</button></span></div>'; }).join(''); }
// ── the page ──
function renderDataAdmin(){
  if(currentUserRole !== 'admin') return renderNoAccess();
  var card = function(id, title, body, border){ return '<div class="card" id="' + id + '" style="margin-bottom:14px' + (border ? ';border:2px solid ' + border : '') + '"><div class="card-title">' + title + '</div>' + body + '</div>'; };
  var btn = function(id, txt, on, style){ return '<button id="' + id + '" onclick="' + on + '" style="padding:10px 16px;border-radius:10px;font:inherit;font-weight:800;cursor:pointer;margin:4px 0;' + (style || 'border:2px solid var(--teal);background:#fff;color:var(--teal)') + '">' + txt + '</button> '; };
  var step = function(L){ return '<ol style="margin:6px 0 0;padding-inline-start:20px;font-size:14px;line-height:1.8">' + L.map(function(x){ return '<li>' + x + '</li>'; }).join('') + '</ol>'; };
  setTimeout(daDaLoadArchives, 0);
  return '<div class="ph"><div><h2>🧰 إدارة البيانات</h2><div style="font-size:13px;color:var(--muted)">' + daEsc(daDaFarmName()) + ' — للأدمن بس</div></div></div>'
    + card('da-bk', '📦 نسخة كاملة واستعادة', '<div style="font-size:13px;color:var(--muted);margin-bottom:6px">ملف فيه كل حاجة: التانكات، وكل السجلات، والإعدادات، ومخزون العلف، والصيانة، وقايمة الحسابات. تقدر ترجّعه في أي وقت.</div>'
      + btn('da-backup', '📦 نزّل نسخة كاملة (JSON)', 'daDaBackup()', 'border:0;background:var(--teal);color:#fff') + btn('da-excel', '📊 نسخة Excel', 'daExportBackup()') + btn('da-restore', '♻️ استعادة من ملف', 'daDaRestorePick()'))
    + card('da-arch', '🗂️ أرشفة وبداية جديدة', '<div style="font-size:13px;color:var(--muted);margin-bottom:6px">البيانات الحالية بتتحفظ في أرشيف خاص بالمزرعة على السحابة، وبعدها السجلات بتتمسح وتبدأ من جديد (التانكات والإعدادات والحسابات فاضلين). الأرشيف تقدر تنزّله أو ترجّعه.</div>'
      + btn('da-archive', '🗂️ أرشف وابدأ من جديد', 'daDaArchive()') + '<div id="da-arch-list" style="margin-top:8px;font-size:14px">…</div>')
    + card('da-reset', '⚠️ إعادة الضبط', '<div style="font-size:13px;color:var(--muted);margin-bottom:8px">قبل أي مسح: نسخة كاملة بتنزل على جهازك، وبتكتب اسم المزرعة، والباسورد بتاعك. وكل الأجهزة التانية بتمسح نسختها أول ما تفتح.</div>'
      + [1, 2, 3].map(function(l){ return '<div style="padding:8px 0;border-top:1px solid #f1f5f9"><div style="font-size:13px;margin-bottom:4px"><b>المستوى ' + l + ':</b> ' + DA_RESET_LEVELS[l] + '</div>' + btn('da-reset-' + l, '⚠️ إعادة ضبط — المستوى ' + l, 'daDaReset(' + l + ')', 'border:2px solid #dc2626;background:#fff;color:#b91c1c') + '</div>'; }).join(''), '#fecaca')
    + card('da-handover', '🤝 تسليم المزرعة (لو هتسيبها)', '<div style="font-size:13px;color:var(--muted)">البيانات ملك المزرعة: تفضل عندهم وتحت إيدهم، وانت تخرج منها تماماً.</div>' + step([
        'نزّل <b>نسخة كاملة</b> (JSON + Excel) وسلّمها لهم رسمياً.',
        'من <b>إدارة المستخدمين</b> اعمل حساب <b>أدمن</b> لشخص منهم، وخليه يدخل ويتأكد إنه شايف كل حاجة.',
        '<b>Supabase:</b> Project Settings ← General ← <b>Transfer project</b> لحساب (Organization) باسم المزرعة. بعدها انت مش هتقدر توصل لقاعدة البيانات.',
        '<b>GitHub:</b> انقل الـ repo بتاع الأداة والـ repo بتاع النسخ الاحتياطية لحسابهم (Settings ← Transfer)، أو ادّيهم نسخة وامسح نسختك من الـ backups.',
        '<b>Cloudflare:</b> يعملوا حساب ويعملوا Worker باسم farm-push بنفس الكود والأسرار (أو تنقلهولهم)، وبعدها امسح بتاعك.',
        'هم يمسحوا حسابك من الأداة (أو يوقفوه).',
        'ورقة تسليم بسيطة: اللي اتسلم، وإنك ما احتفظتش بأي نسخة من بياناتهم.']))
    + card('da-newfarm', '🆕 الأداة في مزرعة جديدة', '<div style="font-size:13px;color:var(--muted)">نسخة منفصلة تماماً تبدأ فاضية — مفيش فيها أي بيانات من المزرعة دي.</div>' + step([
        '<b>Supabase:</b> مشروع جديد ← شغّل ملفات SQL اللي في <code>dev/sql</code> بالترتيب (multi_farm_setup الأول).',
        '<b>GitHub:</b> نسخة جديدة من كود الأداة (Fork أو Use this template) على GitHub Pages، وغيّر فيها عنوان ومفتاح Supabase الجديدين.',
        '<b>Cloudflare:</b> Worker جديد (farm-push) بمفاتيح إشعارات جديدة.',
        'افتح الأداة، اعمل حساب الأدمن، ومن <b>إعداد المزرعة</b> حط اسمها ومواقعها وتانكاتها وأعلافها.',
        'لو جربت عليها قبل التشغيل: <b>إعادة ضبط — المستوى 1</b> وابدأ نظيف.']));
}
async function daDaCheckReset(){   // a device that still holds data from before a reset wipes it once
  try{ var r = JSON.parse(localStorage.getItem(DA_RESET_KEY) || 'null'); if(!r || !r.at) return false; var seen = localStorage.getItem(DA_RESET_SEEN) || '';
    if(seen >= r.at) return false;
    var old = getTX().some(function(t){ return (t.ts || '') && t.ts < r.at; }) || (r.level >= 2 && RAW.length && !seen);
    localStorage.setItem(DA_RESET_SEEN, r.at);
    if(!old) return false;
    await daWipeLocalTenant(); toast('🧹 المزرعة اتعملها إعادة ضبط — بيحمّل البيانات الجديدة'); setTimeout(function(){ location.reload(); }, 900); return true;
  }catch(e){ return false; }
}
if(!window._daDataAdminWrapped){
  window._daDataAdminWrapped = true;
  VIEWS['data-admin'] = renderDataAdmin;
  var gDa = DA_NAV.filter(function(x){ return x.id === 'setup'; })[0] || DA_NAV[DA_NAV.length - 1];
  if(gDa && !gDa.items.some(function(i){ return i[0] === 'data-admin'; })) gDa.items.push(['data-admin', '🧰', 'إدارة البيانات', 'Data management']);
  var _cavPreDa = canAccessView; canAccessView = function(v){ if(v === 'data-admin') return !!currentUser && currentUserRole === 'admin'; return _cavPreDa.apply(this, arguments); };
  var _rcDa = setInterval(function(){ if(currentUser && window._cloudSyncDone){ daDaCheckReset(); } }, 20000);
  var _rc0 = setInterval(function(){ if(currentUser && window._cloudSyncDone){ clearInterval(_rc0); daDaCheckReset(); } }, 1500);
}
