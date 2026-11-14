// ══════════════════════════════════════════════════════════
//  MORE FISH THAN RECORDED (owner, 2026-11-14) — a count surplus, not a refusal
// ══════════════════════════════════════════════════════════
// Transferring or harvesting more fish than the tool holds for the tank was refused ("had only 1,589 — cannot transfer
// 1,850"). Counts are estimates: a surplus is as normal as a shortage (the shortage already had "count difference").
// Now the form asks (up to double the recorded count; an empty tank or more is still refused), and the surplus is recorded on that day as fish that came IN (type transfer_in, gain:true, no
// source, "زيادة في العد"), then the transfer / harvest is saved. Every engine already treats an incoming batch right
// (count, biomass at the day's weight, cycles, lots) and it is not growth, so FCR is unaffected. Linked to its record
// (link): deleting / editing the transfer or harvest takes it along; hidden from the transfer register.
var DA_GAIN_T = {
  ar:{q:function(u, a, w, x){ return u + ' متسجل فيه ' + a.toLocaleString() + ' سمكة، وانت بتنقل/بتحصد ' + w.toLocaleString() + '.\nيعني فيه زيادة ' + x.toLocaleString() + ' سمكة عن المتسجل (العدّ كان أقل).\n\nتسجّل الزيادة دي وتكمل؟'; }, done:'➕ اتسجلت زيادة في العد: ', why:'زيادة في العد'},
  en:{q:function(u, a, w, x){ return u + ' holds ' + a.toLocaleString() + ' fish in the tool, you are moving ' + w.toLocaleString() + '.\nThat is ' + x.toLocaleString() + ' more than recorded (the count was low).\n\nRecord the surplus and continue?'; }, done:'➕ Count surplus recorded: ', why:'count surplus'},
  ur:{q:function(u, a, w, x){ return u + ' میں ' + a.toLocaleString() + ' مچھلیاں درج ہیں، آپ ' + w.toLocaleString() + ' منتقل/ہارویسٹ کر رہے ہیں۔\nیعنی درج سے ' + x.toLocaleString() + ' زیادہ (گنتی کم تھی)۔\n\nزیادتی درج کر کے جاری رکھیں؟'; }, done:'➕ گنتی کی زیادتی درج: ', why:'گنتی کی زیادتی'}};
function daGainT(){ var l = typeof daLangNow === 'function' ? daLangNow() : (isAr ? 'ar' : 'en'); return DA_GAIN_T[l] || DA_GAIN_T.ar; }
function daGainsLinked(unit, date, keys){ return getTX().filter(function(t){ return t.gain && !t.deleted && t.unit === unit && t.date === date && keys.indexOf(t.link) >= 0; }); }
if(!window._daGainWrapped){
  window._daGainWrapped = true;
  var _fishAtPreGain = daRegFishAt;
  daRegFishAt = function(unit, date){   // while editing, a surplus saved with the edited record does not count (it is replaced)
    var av = _fishAtPreGain.apply(this, arguments), keys = (window._rgEdit || []).concat(window._rgEditKey ? [window._rgEditKey] : []);
    if(keys.length) daGainsLinked(unit, date, keys).forEach(function(t){ av -= parseInt(t.fishNo) || 0; });
    return av; };
  var _transRowsPreGain = daTransRows;
  daTransRows = function(){ var real = getTX; getTX = function(){ return real.apply(this, arguments).filter(function(t){ return !t.gain; }); };
    try{ return _transRowsPreGain.apply(this, arguments); }finally{ getTX = real; } };
  var _regSavePreGain = daRegSave;
  daRegSave = function(kind){
    var caught = null, A = window.alert;
    window.alert = function(m){ var s = String(m), mt = s.match(/(?:⛔\s*)?(\S+)?\s*يومها فيه ([\d,]+) سمكة بس — مينفعش (تنقل|تحصد) ([\d,]+)/);
      if(mt && !caught){ caught = {msg:s, unit:mt[3] === 'تحصد' ? String((document.getElementById('rf-unit') || {}).value || '').trim() : mt[1], avl:+mt[2].replace(/,/g, ''), want:+mt[4].replace(/,/g, '')}; return; }
      return A.apply(this, arguments); };
    var r; try{ r = _regSavePreGain.apply(this, arguments); }finally{ window.alert = A; }
    if(!caught || !caught.unit || !(caught.want > caught.avl)) return r;
    if(caught.avl <= 0 || caught.want > caught.avl * 2){ A.call(window, caught.msg); return r; }   // an empty tank needs stocking; more than double is a wrong number
    var T = daGainT(), x = caught.want - caught.avl, date = String((document.getElementById('rf-date') || {}).value || '').trim();
    if(!date || !confirm(T.q(caught.unit, caught.avl, caught.want, x))) return r;
    var before = {}; getTX().forEach(function(t){ before[t.id] = 1; });
    var gid = 'gain-' + caught.unit + '-' + date + '-' + Date.now().toString(36), w = typeof daRegWtAt === 'function' ? daRegWtAt(caught.unit, date) : 0;
    addTX({id:gid, type:'transfer_in', unit:caught.unit, date:date, fishNo:x, avgWt:w > 0 ? w : undefined, gain:true, reason:DA_GAIN_T.ar.why, source:'count-gain', _skipValidation:true});
    var r2 = _regSavePreGain.apply(this, arguments);
    var made = getTX().filter(function(t){ return !before[t.id] && t.id !== gid && !t.deleted && t.unit === caught.unit && (t.type === 'transfer_out' || t.type === 'harvesting'); })[0];
    if(made){ updateTX(gid, {link:made.txGroup || made.id}); toast(T.done + caught.unit + ' +' + x.toLocaleString()); }
    else deleteTX(gid);   // the save stopped for another reason: no orphan surplus
    return r2;
  };
}
