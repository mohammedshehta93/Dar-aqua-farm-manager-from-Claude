// ══════════════════════════════════════════════════════════
//  FEED SIZE PER TANK — what the tank is on, not a formula (owner, 2026-11-10)
// ══════════════════════════════════════════════════════════
// The sheet used to suggest the pellet size from the fish weight (daFwDefaultFeed) — not what the farm uses, and the
// right size may be out of stock. Now the size shown for a tank is: the size it was last fed with, unless a supervisor
// pinned a newer one (📌, synced to every phone) — pinned from a date on, it wins until someone feeds another size after
// that date. No formula: a tank with neither stays empty until its size is written once. Supervisors get "size of the
// section: 1 · 2 · 3" per group and "📌 pin these sizes"; workers just see the size they are on and may change it.
var DA_FSIZE_KEY = 'daracqua_plan_v1_fsize';   // synced: {unit: {size:'2', from:'2026-11-10'}}
function daFsStd(){ try{ return JSON.parse(localStorage.getItem(DA_FSIZE_KEY) || '{}') || {}; }catch(e){ return {}; } }
function daFsLastSize(unit, date){   // the size this tank was last fed with before the day
  var best = null, list = typeof daTxByUnit === 'function' ? (daTxByUnit()[unit] || []) : getTX().filter(function(t){ return t.unit === unit; });   // the index of every tank's records
  (list || []).forEach(function(t){ if(t.type !== 'feeding' || t.deleted || t.fasted || !t.date || t.date >= date) return; var z = t.size || daSizeOf(t.feed); if(!z) return; if(!best || t.date > best.date) best = {size:String(z), date:t.date}; });
  return best;
}
function daFsDefSize(unit, date){
  var std = daFsStd()[unit], last = daFsLastSize(unit, date);
  if(std && std.size && std.from <= date && (!last || std.from >= last.date)) return {size:String(std.size), pinned:true};
  return last ? {size:last.size, pinned:false} : {size:'', pinned:false};
}
function daFsCanPin(){ return currentUserRole !== 'worker' && (typeof hasPerm !== 'function' || hasPerm('approve_data') || currentUserRole === 'admin'); }
function daFsGroupSize(btn, z){   // fill every tank of this group (not saved until "save" / "pin")
  var card = btn.closest('.fs-group'); if(!card) return;
  card.querySelectorAll('input.fs-sz:not([disabled])').forEach(function(e){ e.value = z; e.dispatchEvent(new Event('input', {bubbles:true})); });
}
function daFsPin(){
  var st = window._fs; if(!st || !st.rows) return; var std = daFsStd(), n = 0;
  st.rows.forEach(function(r){ if(r.i === undefined) return; var e = document.getElementById('fs-' + r.i + '-sz'); if(!e || e.disabled) return; var z = String(e.value || '').trim(); if(!/^[123]$/.test(z)) return;
    std[r.unit] = {size:z, from:st.date}; n++; });
  if(!n){ toast('⚠️ اكتب الأحجام في الشيت الأول'); return; }
  if(!confirm('تثبيت حجم ' + n + ' تانك من ' + st.date + '؟\nالعمال هيلاقوه مكتوب لوحده، وأي حد يغيّره ويحفظ بيبقى هو الطبيعي بعد كده.')) return;
  localStorage.setItem(DA_FSIZE_KEY, JSON.stringify(std)); toast('📌 اتثبتت أحجام ' + n + ' تانك — هتوصل لكل الموبايلات');
}
if(!window._daFsizeWrapped){
  window._daFsizeWrapped = true;
  var _showPreFsz = show;
  show = function(v){ var r = _showPreFsz.apply(this, arguments);
    if(currentView === 'feed-sheet' && daFsCanPin() && !document.getElementById('fs-pin')){
      var sv = document.getElementById('fs-save'); if(sv) sv.insertAdjacentHTML('afterend', '<button id="fs-pin" onclick="daFsPin()" style="padding:9px 14px;border:2px solid var(--teal);background:#fff;color:var(--teal);border-radius:10px;font:inherit;font-weight:800;cursor:pointer;margin-inline-start:6px" title="الأحجام اللي في الشيت تبقى ثابتة لكل تانك من اليوم ده">📌 ثبّت الأحجام دي</button>');
      document.querySelectorAll('.fs-group .card-title').forEach(function(t){ if(t.querySelector('.fs-gsz')) return;
        t.insertAdjacentHTML('beforeend', '<span class="fs-gsz" style="font-size:12px;font-weight:400;margin-inline-start:10px">حجم السكشن: ' + ['1', '2', '3'].map(function(z){ return '<button type="button" onclick="daFsGroupSize(this,&quot;' + z + '&quot;)" style="padding:2px 9px;margin:0 2px;border:1px solid var(--line);background:#fff;border-radius:6px;cursor:pointer;font:inherit;font-weight:700">' + z + '</button>'; }).join('') + '</span>'); }); }
    return r; };
}
