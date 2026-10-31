// ══════════════════════════════════════════════════════════
//  KEYBOARD NAVIGATION IN ENTRY TABLES — like Excel
// ══════════════════════════════════════════════════════════
// In any table of inputs: ↑/↓ and Enter = same column, row above/below (across the group tables of a sheet, skipping
// locked rows); ←/→ = neighbouring cell in the table's visual direction — inside a text being edited the caret moves
// first and the cell changes at the text's edge. Arrows never change a number's value. The reached cell is selected.
function daGridInputs(scope){ return Array.prototype.slice.call(scope.querySelectorAll('td input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=date]):not([type=time]):not([disabled])')); }
function daGridCell(el){ var td = el.closest('td'); return td ? {td:td, tr:td.parentNode, col:td.cellIndex, table:td.closest('table')} : null; }
function daGridGo(el){ if(!el) return false; el.focus(); try{ el.select(); }catch(e){} return true; }
function daGridVertical(el, dir){
  var c = daGridCell(el); if(!c) return false;
  var scope = document.getElementById('content') || document, rows = Array.prototype.slice.call(scope.querySelectorAll('tr'));
  for(var i = rows.indexOf(c.tr) + dir; i >= 0 && i < rows.length; i += dir){
    var r = rows[i]; if(r.closest('thead')) continue;
    var td = r.cells[c.col], pick = td && td.querySelector('input:not([disabled]):not([type=hidden])');
    if(!pick){   // different column layout (another group table): nearest enabled input of that row by position
      var ins = daGridInputs(r); if(!ins.length) continue;
      var x0 = el.getBoundingClientRect().left; pick = ins.sort(function(a, b){ return Math.abs(a.getBoundingClientRect().left - x0) - Math.abs(b.getBoundingClientRect().left - x0); })[0];
    }
    if(pick) return daGridGo(pick);
  }
  return false;
}
function daGridHorizontal(el, key){
  var c = daGridCell(el); if(!c) return false;
  var rtl = getComputedStyle(c.table || el).direction === 'rtl', step = (key === 'ArrowRight') !== rtl ? 1 : -1;
  var ins = daGridInputs(c.tr), i = ins.indexOf(el); if(i < 0) return false;
  return daGridGo(ins[i + step]);
}
document.addEventListener('keydown', function(e){
  var el = e.target; if(!el || el.tagName !== 'INPUT' || e.altKey || e.ctrlKey || e.metaKey || e.isComposing) return;
  var ty = String(el.type || 'text').toLowerCase(); if(['checkbox', 'radio', 'date', 'time', 'file', 'button', 'submit'].indexOf(ty) >= 0) return;
  if(!el.closest('td')) return;
  var k = e.key, moved = false;
  if(k === 'ArrowDown' || (k === 'Enter' && !e.shiftKey)) moved = daGridVertical(el, 1);
  else if(k === 'ArrowUp' || (k === 'Enter' && e.shiftKey)) moved = daGridVertical(el, -1);
  else if(k === 'ArrowLeft' || k === 'ArrowRight'){
    var v = String(el.value || ''), s = null, en = null;
    try{ s = el.selectionStart; en = el.selectionEnd; }catch(x){}
    if(s === null || s === undefined || (s === 0 && en === v.length) || v === ''){ moved = daGridHorizontal(el, k); }
    else {   // caret inside the text: let it move until it reaches the edge in the pressed direction
      var rtlText = getComputedStyle(el).direction === 'rtl', towardEnd = (k === 'ArrowRight') !== rtlText;
      if(s === en && ((towardEnd && en === v.length) || (!towardEnd && s === 0))) moved = daGridHorizontal(el, k);
    }
  }
  if(moved || ((k === 'ArrowUp' || k === 'ArrowDown') && ty === 'number')) e.preventDefault();   // never step a number by arrow
}, true);
