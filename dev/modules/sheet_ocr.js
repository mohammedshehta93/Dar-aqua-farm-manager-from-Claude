// ══════════════════════════════════════════════════════════
//  PHOTO READING OF PRINTED SHEETS — on the phone, no AI service, no network
// ══════════════════════════════════════════════════════════
// One layout definition (millimetres on A4) drives both the printed sheet and the reader, so they always agree.
// Printed sheet = the farm's paper form + reading aids: 4 corner squares (perspective), a 16-cell code strip (kind,
// page, layout hash — a copy printed before the tank list / meal times changed is refused), one digit per box
// (kg: [ ][ ].[ ], grams: [ ][ ][ ]), bubbles for pellet size 1/2/3 and "not fed today", two dead boxes (two removals).
// Reader: find squares → homography → read strip → each box → MNIST-style 28×28 → small int8 CNN (DA_OCR_MODEL) →
// values + confidence. Nothing is saved: values fill the on-screen sheet, unsure ones are highlighted for review.
var DA_A4 = {w:210, h:297}, DA_FID = [[14, 14], [196, 14], [14, 283], [196, 283]], DA_FID_S = 8;
var DA_OCR_BOX = {w:6, h:7.5}, DA_OCR_ROW = 9, DA_OCR_TOP = 50, DA_OCR_BOTTOM = 268;
function daOcrHash(s){ var h = 5381; for(var i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0; return h; }
// ── layout ──
function daOcrDateBoxes(){ var o = [], x = 140; for(var i = 0; i < 8; i++){ o.push({x:x, y:29, w:5.5, h:7}); x += 5.5 + (i === 1 || i === 3 ? 2.5 : 0); } return o; }
function daOcrFeedLayout(farm){
  var rows = daFsRows(farm, daToday()), groups = daSheetGroups(farm), used = {}, lines = [];
  groups.forEach(function(g){
    var gr = rows.filter(function(r){ return !used[r.unit] && r.no.s >= g.from && r.no.s <= g.to; }); if(!gr.length) return;
    gr.forEach(function(r){ used[r.unit] = 1; });
    lines.push({kind:'head', g:g}); gr.forEach(function(r){ lines.push({kind:'tank', g:g, unit:r.unit, label:r.no.label}); });
  });
  var pages = [[]], y = DA_OCR_TOP;
  lines.forEach(function(l, i){
    var need = l.kind === 'head' ? DA_OCR_ROW + DA_OCR_ROW : DA_OCR_ROW;      // never leave a group header alone at the bottom
    if(y + need > DA_OCR_BOTTOM){ pages.push([]); y = DA_OCR_TOP; if(l.kind === 'tank') pages[pages.length - 1].push({kind:'head', g:l.g, y:y}), y += DA_OCR_ROW; }
    var c = Object.assign({y:y}, l); pages[pages.length - 1].push(c); y += DA_OCR_ROW;
  });
  var sig = 'feed|' + farm + '|' + lines.map(function(l){ return l.kind === 'head' ? 'H' + l.g.meals.join(',') + (l.g.unit || '') : l.unit; }).join(';');
  return {kind:'feed', farm:farm, hash:daOcrHash(sig) & 255, pages:pages.map(function(ls){ return {lines:ls.map(daOcrFeedCols)}; })};
}
function daOcrFeedCols(l){
  var x = 26, B = DA_OCR_BOX, grams = l.g.unit === 'g', f = {meals:[], size:[], fast:null, dead:[]};
  l.g.meals.forEach(function(m){
    var boxes = [], n = 3;
    for(var k = 0; k < n; k++){ boxes.push({x:x, y:l.y, w:B.w, h:B.h}); x += B.w + (!grams && k === 1 ? 1.6 : 0); }
    f.meals.push({meal:m, boxes:boxes, x0:boxes[0].x, x1:x}); x += 2.6;
  });
  x += 1; for(var s = 1; s <= 3; s++){ f.size.push({v:String(s), cx:x + 3, cy:l.y + B.h / 2, r:2.4}); x += 6; }
  x += 2; f.fast = {cx:x + 3, cy:l.y + B.h / 2, r:2.4}; x += 8;
  for(var d = 0; d < 2; d++){ var bx = []; for(var k2 = 0; k2 < 2; k2++){ bx.push({x:x, y:l.y, w:B.w, h:B.h}); x += B.w; } f.dead.push({boxes:bx, x0:bx[0].x, x1:x}); x += 2.6; }
  return Object.assign({}, l, {cols:f});
}
function daOcrWqLayout(farm){
  var secs = daWqSections(farm), lines = [], y = DA_OCR_TOP, B = DA_OCR_BOX;
  secs.forEach(function(sec){
    var x = 34, mk = function(n, dot){ var b = []; for(var k = 0; k < n; k++){ b.push({x:x, y:y, w:B.w, h:B.h}); x += B.w + (k === dot ? 1.6 : 0); } var o = {boxes:b, x0:b[0].x, x1:x, dot:dot}; x += 8; return o; };
    var row = {kind:'sec', sec:sec, label:'S-' + ('0' + daSecNo(sec)).slice(-2), y:y, temp:mk(3, 1), ph:mk(3, 0), 'do':mk(3, 1)};
    row.notes = {x:x, x1:196 - 6}; lines.push(row); y += DA_OCR_ROW + 1.5;
  });
  return {kind:'wq', farm:farm, hash:daOcrHash('wq|' + farm + '|' + secs.join(';')) & 255, pages:[{lines:lines}]};
}
// sampling: stocked tanks of the farm (as on the sampling screen) — average weight g [ ][ ][ ][ ], fish weighed [ ][ ][ ]
function daOcrSampLayout(farm){
  var B = DA_OCR_BOX, units = _txLiveRows().filter(function(r){ return (r.fishNo || 0) > 0 && (r.farm === farm || String(r.unit).indexOf(farm + '.') === 0) && daTankNo(r.unit); })
    .map(function(r){ return r.unit; }).sort(function(a, b){ var x = daTankNo(a), y = daTankNo(b); return x.s - y.s || x.t - y.t; });
  var pages = [[]], y = DA_OCR_TOP + DA_OCR_ROW;
  units.forEach(function(u){
    if(y + DA_OCR_ROW > DA_OCR_BOTTOM){ pages.push([]); y = DA_OCR_TOP + DA_OCR_ROW; }
    var x = 40, mk = function(n){ var b = []; for(var k = 0; k < n; k++){ b.push({x:x, y:y, w:B.w, h:B.h}); x += B.w; } var o = {boxes:b, x0:b[0].x, x1:x}; x += 12; return o; };
    pages[pages.length - 1].push({kind:'samp', unit:u, label:daTankNo(u).label, y:y, wt:mk(4), n:mk(3), notes:{x:x, x1:190}}); y += DA_OCR_ROW;
  });
  return {kind:'samp', farm:farm, hash:daOcrHash('samp|' + farm + '|' + units.join(';')) & 255, pages:pages.map(function(ls){ return {lines:ls}; })};
}
var DA_OCR_KINDS = ['feed', 'wq', 'samp'];
function daOcrBits(L, page){ var v = DA_OCR_KINDS.indexOf(L.kind) | ((page & 15) << 2) | ((L.hash & 255) << 6), o = [1]; for(var i = 0; i < 14; i++) o.push((v >> i) & 1); o.push(1); return o; }
function daOcrStripCells(){ var o = []; for(var i = 0; i < 16; i++) o.push({x:41 + i * 8, y:280.5, w:5, h:5}); return o; }

// ── printing (SVG in mm) ──
function daOcrSVG(L, pi){
  var P = L.pages[pi], t = [], esc = daEsc, B = DA_OCR_BOX, title = ({wq:'Daily Testing Log', samp:'Sampling Log', feed:'Fish Feed Log'})[L.kind];
  var house = 'Fish House ' + String(L.farm).replace(/^\D+/, ''), rev = (daSheetCfgAll()['rev:' + L.kind] || '');
  var rect = function(b, sw, fill){ t.push('<rect x="' + b.x + '" y="' + b.y + '" width="' + b.w + '" height="' + b.h + '" fill="' + (fill || 'none') + '" stroke="#555" stroke-width="' + (sw || 0.25) + '"/>'); };
  var text = function(x, y, s, sz, anchor, w){ t.push('<text x="' + x + '" y="' + y + '" font-size="' + (sz || 3) + '" text-anchor="' + (anchor || 'start') + '"' + (w ? ' font-weight="700"' : '') + ' font-family="Arial,sans-serif">' + esc(s) + '</text>'); };
  DA_FID.forEach(function(c){ t.push('<rect x="' + (c[0] - DA_FID_S / 2) + '" y="' + (c[1] - DA_FID_S / 2) + '" width="' + DA_FID_S + '" height="' + DA_FID_S + '" fill="#000"/>'); });
  daOcrStripCells().forEach(function(c, i){ if(daOcrBits(L, pi)[i]) t.push('<rect x="' + c.x + '" y="' + c.y + '" width="' + c.w + '" height="' + c.h + '" fill="#000"/>'); });
  text(105, 18, daFarmName(), 3.6, 'middle', true); text(105, 24, house + ' — ' + title, 4.6, 'middle', true);
  text(26, 18, rev ? 'Rev. ' + rev : '', 2.6); text(26, 24, 'Page ' + (pi + 1) + ' / ' + L.pages.length, 2.6);
  text(145.5, 39, 'D D', 2.1, 'middle'); text(156.5, 39, 'M M', 2.1, 'middle'); text(173.5, 39, 'Y Y Y Y', 2.1, 'middle'); text(138, 34, 'Date:', 2.8, 'end');
  daOcrDateBoxes().forEach(function(b){ rect(b, 0.3); });
  text(26, 33, 'Technician: ________________', 2.8);
  text(105, 43, 'One digit per box · fill one circle for Size · leave a meal empty if not fed · dead: two removals in two boxes', 2.3, 'middle');
  t.push('<text x="105" y="46.5" font-size="2.5" text-anchor="middle" direction="rtl" font-family="Arial,sans-serif">رقم واحد في كل مربع · سوّد دايرة واحدة للحجم · الوجبة اللي متأكلتش سيبها فاضية · النافق: كل مرة في خانتها</text>');
  if(L.kind === 'samp'){ text(18, DA_OCR_TOP + 5, 'Tank', 2.8, 'start', true); text(52, DA_OCR_TOP + 5, 'Avg weight (g)', 2.6, 'middle', true); text(83, DA_OCR_TOP + 5, 'Fish weighed', 2.6, 'middle', true); text(140, DA_OCR_TOP + 5, 'Notes', 2.6, 'middle', true);
    t.push('<line x1="10" y1="' + (DA_OCR_TOP + 7.6) + '" x2="200" y2="' + (DA_OCR_TOP + 7.6) + '" stroke="#333" stroke-width="0.35"/>'); }
  P.lines.forEach(function(l){
    if(L.kind === 'samp'){ text(18, l.y + 5.4, l.label, 3.4, 'start', true); l.wt.boxes.concat(l.n.boxes).forEach(function(b){ rect(b); });
      t.push('<line x1="' + l.notes.x + '" y1="' + (l.y + B.h) + '" x2="' + l.notes.x1 + '" y2="' + (l.y + B.h) + '" stroke="#999" stroke-width="0.2"/>'); return; }
    if(L.kind === 'wq'){
      text(18, l.y + 5.3, l.label, 3.4, 'start', true);
      [['temp', 'Temp °C'], ['ph', 'pH'], ['do', 'DO mg/L']].forEach(function(f){ var o = l[f[0]]; if(l === P.lines[0]) text((o.x0 + o.x1) / 2, l.y - 2, f[1], 2.6, 'middle', true);
        o.boxes.forEach(function(b){ rect(b, 0.3); }); var d = o.boxes[o.dot]; t.push('<circle cx="' + (d.x + d.w + 0.8) + '" cy="' + (l.y + B.h - 0.8) + '" r="0.5" fill="#000"/>'); });
      if(l === P.lines[0]) text((l.notes.x + l.notes.x1) / 2, l.y - 2, 'Notes / Corrective Action', 2.6, 'middle', true);
      t.push('<line x1="' + l.notes.x + '" y1="' + (l.y + B.h) + '" x2="' + l.notes.x1 + '" y2="' + (l.y + B.h) + '" stroke="#999" stroke-width="0.2"/>');
      return;
    }
    var c = l.cols;
    if(l.kind === 'head'){
      text(12, l.y + 5, 'Tank', 2.8, 'start', true);
      c.meals.forEach(function(m){ text((m.x0 + m.x1) / 2, l.y + 5, m.meal + (l.g.unit === 'g' ? ' (g)' : ' (kg)'), 2.6, 'middle', true); });
      text((c.size[0].cx + c.size[2].cx) / 2, l.y + 5, 'Size', 2.6, 'middle', true); text(c.fast.cx, l.y + 5, 'Not fed', 2.2, 'middle', true);
      text((c.dead[0].x0 + c.dead[1].x1) / 2, l.y + 5, 'dead (1) + (2)', 2.6, 'middle', true);
      t.push('<line x1="10" y1="' + (l.y + 7.6) + '" x2="200" y2="' + (l.y + 7.6) + '" stroke="#333" stroke-width="0.35"/>');
      return;
    }
    text(12, l.y + 5.4, l.label, 3.4, 'start', true);
    c.meals.forEach(function(m){ m.boxes.forEach(function(b){ rect(b); }); if(l.g.unit !== 'g'){ var d = m.boxes[1]; t.push('<circle cx="' + (d.x + d.w + 0.8) + '" cy="' + (l.y + B.h - 0.8) + '" r="0.5" fill="#000"/>'); } });
    c.size.forEach(function(s){ t.push('<circle cx="' + s.cx + '" cy="' + s.cy + '" r="' + s.r + '" fill="none" stroke="#555" stroke-width="0.3"/>'); t.push('<text x="' + s.cx + '" y="' + (s.cy + 0.9) + '" font-size="2.2" text-anchor="middle" fill="#b0b0b0" font-family="Arial,sans-serif">' + s.v + '</text>'); });
    t.push('<circle cx="' + c.fast.cx + '" cy="' + c.fast.cy + '" r="' + c.fast.r + '" fill="none" stroke="#555" stroke-width="0.3"/>');
    c.dead.forEach(function(d){ d.boxes.forEach(function(b){ rect(b); }); });
  });
  if(L.kind === 'feed' && pi === L.pages.length - 1) text(26, 274, 'Reviewed by: ______________        Approved by: ______________', 2.8);
  if(L.kind !== 'feed') text(26, 274, 'Checked by: ______________        Verified by: ______________', 2.8);
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 210 297" width="210mm" height="297mm" style="background:#fff">' + t.join('') + '</svg>';
}
function daOcrFarm(kind){ return kind === 'wq' ? window._wqs.farm : kind === 'samp' ? (farmFilter && farmFilter !== 'all' ? farmFilter : '') : window._fs.farm; }
function daOcrLayout(kind, farm){ return kind === 'wq' ? daOcrWqLayout(farm) : kind === 'samp' ? daOcrSampLayout(farm) : daOcrFeedLayout(farm); }
function daOcrPrint(kind){
  var farm = daOcrFarm(kind); if(!farm){ toast('⚠️ اختار المزرعة من فوق الأول'); return; }
  var L = daOcrLayout(kind, farm); if(!L.pages[0].lines.length){ toast('مفيش تانكات للمزرعة دي'); return; }
  var html = '<!doctype html><html><head><meta charset="utf-8"><title>' + daEsc(farm) + ' — ' + ({wq:'Testing Log', samp:'Sampling Log', feed:'Feed Log'})[kind] + '</title>'
    + '<style>@page{size:A4;margin:0}body{margin:0}svg{display:block;page-break-after:always;break-after:page}</style></head><body>'
    + L.pages.map(function(p, i){ return daOcrSVG(L, i); }).join('') + '<script>setTimeout(function(){window.print()},300)<\/script></body></html>';
  var w = window.open('', '_blank');
  if(!w){ toast('⚠️ المتصفح منع فتح صفحة الطباعة — اسمح بالنوافذ المنبثقة'); return; }
  w.document.open(); w.document.write(html); w.document.close();
}

// ── CNN inference (int8 weights, float math) ──
var _ocrW = null;
function daOcrWeights(){
  if(_ocrW) return _ocrW; var M = DA_OCR_MODEL, w = {};
  ['c1', 'c2', 'd1', 'd2'].forEach(function(k){
    var b = atob(M[k].q), n = b.length, cols = M[k].shape[M[k].shape.length - 1], f = new Float32Array(n);
    for(var i = 0; i < n; i++){ var q = b.charCodeAt(i); if(q > 127) q -= 256; f[i] = q * M[k].s[i % cols]; }
    w[k] = f;
  });
  ['b1', 'b2', 'e1', 'e2'].forEach(function(k){ w[k] = Float32Array.from(M[k]); });
  return (_ocrW = w);
}
function daOcrConv(x, H, W, C, w, b, O){
  var o = new Float32Array(H * W * O);
  for(var y = 0; y < H; y++) for(var xx = 0; xx < W; xx++){
    var ob = (y * W + xx) * O; for(var q = 0; q < O; q++) o[ob + q] = b[q];
    for(var i = 0; i < 3; i++){ var yy = y + i - 1; if(yy < 0 || yy >= H) continue;
      for(var j = 0; j < 3; j++){ var xj = xx + j - 1; if(xj < 0 || xj >= W) continue;
        var ib = (yy * W + xj) * C, wb = (i * 3 + j) * C * O;
        for(var c = 0; c < C; c++){ var v = x[ib + c]; if(!v) continue; var wc = wb + c * O; for(var q2 = 0; q2 < O; q2++) o[ob + q2] += v * w[wc + q2]; } } }
    for(var q3 = 0; q3 < O; q3++) if(o[ob + q3] < 0) o[ob + q3] = 0;
  }
  return o;
}
function daOcrPool(x, H, W, C){ var h = H / 2, w = W / 2, o = new Float32Array(h * w * C);
  for(var y = 0; y < h; y++) for(var xx = 0; xx < w; xx++) for(var c = 0; c < C; c++){
    var m = -1e9; for(var i = 0; i < 2; i++) for(var j = 0; j < 2; j++){ var v = x[((2 * y + i) * W + 2 * xx + j) * C + c]; if(v > m) m = v; } o[(y * w + xx) * C + c] = m; }
  return o; }
function daOcrLogits(img){   // img: Float32Array(784), ink = 1
  var w = daOcrWeights(), x = daOcrPool(daOcrConv(img, 28, 28, 1, w.c1, w.b1, 16), 28, 28, 16);
  x = daOcrPool(daOcrConv(x, 14, 14, 16, w.c2, w.b2, 32), 14, 14, 32);
  var h = new Float32Array(64); for(var k = 0; k < 64; k++){ var s = w.e1[k]; for(var i = 0; i < 1568; i++) s += x[i] * w.d1[i * 64 + k]; h[k] = s > 0 ? s : 0; }
  var o = []; for(var d = 0; d < 10; d++){ var s2 = w.e2[d]; for(var k2 = 0; k2 < 64; k2++) s2 += h[k2] * w.d2[k2 * 10 + d]; o.push(s2); }
  return o;
}
function daOcrClassify(img){
  var l = daOcrLogits(img), m = Math.max.apply(null, l), e = l.map(function(v){ return Math.exp(v - m); }), s = e.reduce(function(a, b){ return a + b; }, 0);
  var p = e.map(function(v){ return v / s; }), best = 0; for(var i = 1; i < 10; i++) if(p[i] > p[best]) best = i;
  return {d:best, p:p[best]};
}

// ── image → page geometry ──
function daOcrLoad(file){
  return new Promise(function(res, rej){
    var url = URL.createObjectURL(file), im = new Image();
    im.onload = function(){ var s = Math.min(1, 2200 / Math.max(im.width, im.height)), W = Math.round(im.width * s), H = Math.round(im.height * s);
      var cv = document.createElement('canvas'); cv.width = W; cv.height = H; var cx = cv.getContext('2d'); cx.drawImage(im, 0, 0, W, H);
      var d = cx.getImageData(0, 0, W, H).data, g = new Float32Array(W * H);
      for(var i = 0; i < W * H; i++) g[i] = (0.299 * d[4 * i] + 0.587 * d[4 * i + 1] + 0.114 * d[4 * i + 2]) / 255;
      URL.revokeObjectURL(url); res({W:W, H:H, g:g}); };
    im.onerror = function(){ URL.revokeObjectURL(url); rej(new Error('الصورة مش مقروءة')); };
    im.src = url;
  });
}
function daOcrFindSquares(I){
  var f = Math.max(1, Math.round(Math.max(I.W, I.H) / 900)), w = Math.floor(I.W / f), h = Math.floor(I.H / f), s = new Float32Array(w * h), hist = new Array(64).fill(0);
  for(var y = 0; y < h; y++) for(var x = 0; x < w; x++){ var v = 0; for(var i = 0; i < f; i++) for(var j = 0; j < f; j++) v += I.g[(y * f + i) * I.W + x * f + j]; v /= f * f; s[y * w + x] = v; hist[Math.min(63, Math.floor(v * 64))]++; }
  var tot = w * h, sum = 0, sB = 0, wB = 0, best = 0, th = 0.5; for(var k = 0; k < 64; k++) sum += k * hist[k];
  for(var k2 = 0; k2 < 64; k2++){ wB += hist[k2]; if(!wB) continue; var wF = tot - wB; if(!wF) break; sB += k2 * hist[k2]; var mB = sB / wB, mF = (sum - sB) / wF, b = wB * wF * (mB - mF) * (mB - mF); if(b > best){ best = b; th = (k2 + 0.5) / 64; } }
  th = Math.min(th, 0.45);
  var lab = new Int32Array(w * h), comps = [], st = [];
  for(var p0 = 0; p0 < w * h; p0++){
    if(lab[p0] || s[p0] >= th) continue;
    var id = comps.length + 1, c = {n:0, x0:1e9, y0:1e9, x1:-1, y1:-1, sx:0, sy:0, sxx:0, syy:0, sxy:0, edge:false}; lab[p0] = id; st.push(p0);
    while(st.length){ var q = st.pop(), qx = q % w, qy = (q - qx) / w; c.n++; c.sx += qx; c.sy += qy; c.sxx += qx * qx; c.syy += qy * qy; c.sxy += qx * qy;
      if(qx < c.x0) c.x0 = qx; if(qx > c.x1) c.x1 = qx; if(qy < c.y0) c.y0 = qy; if(qy > c.y1) c.y1 = qy; if(!qx || !qy || qx === w - 1 || qy === h - 1) c.edge = true;
      var nb = [q - 1, q + 1, q - w, q + w]; for(var z = 0; z < 4; z++){ var r = nb[z]; if(r < 0 || r >= w * h || lab[r] || s[r] >= th) continue; if((z < 2) && Math.floor(r / w) !== qy) continue; lab[r] = id; st.push(r); } }
    comps.push(c);
  }
  var minS = Math.min(w, h) * 0.012, maxS = Math.min(w, h) * 0.09;
  // solid, compact blob at any rotation: for a filled square area = 12·sqrt(det(cov)) and both axes equal
  var cand = comps.filter(function(c){ var bw = c.x1 - c.x0 + 1, bh = c.y1 - c.y0 + 1; if(c.edge || bw < minS || bh < minS || bw > maxS * 1.3 || bh > maxS * 1.3 || c.n < 12) return false;
      var mx = c.sx / c.n, my = c.sy / c.n, vxx = c.sxx / c.n - mx * mx, vyy = c.syy / c.n - my * my, vxy = c.sxy / c.n - mx * my;
      var tr = vxx + vyy, det = vxx * vyy - vxy * vxy, d = Math.sqrt(Math.max(0, tr * tr / 4 - det)), l1 = tr / 2 + d, l2 = tr / 2 - d;
      var solid = c.n / (12 * Math.sqrt(Math.max(1e-9, det)));
      return l2 > 0 && l1 / l2 < 1.7 && solid > 0.8 && solid < 1.2; })
    .map(function(c){ return {x:(c.sx / c.n + 0.5) * f, y:(c.sy / c.n + 0.5) * f, a:c.n}; });
  return cand;
}
function daOcrHomography(src, dst){   // 4 points src(mm) → dst(px)
  var A = [], b = [];
  for(var i = 0; i < 4; i++){ var x = src[i][0], y = src[i][1], u = dst[i][0], v = dst[i][1];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u); A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v); }
  for(var c = 0; c < 8; c++){ var p = c; for(var r = c + 1; r < 8; r++) if(Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    var tA = A[c]; A[c] = A[p]; A[p] = tA; var tb = b[c]; b[c] = b[p]; b[p] = tb;
    if(Math.abs(A[c][c]) < 1e-12) return null;
    for(var r2 = 0; r2 < 8; r2++){ if(r2 === c) continue; var k = A[r2][c] / A[c][c]; for(var cc = c; cc < 8; cc++) A[r2][cc] -= k * A[c][cc]; b[r2] -= k * b[c]; } }
  var h = []; for(var i2 = 0; i2 < 8; i2++) h.push(b[i2] / A[i2][i2]); h.push(1); return h;
}
function daOcrMap(H, x, y){ var z = H[6] * x + H[7] * y + 1; return [(H[0] * x + H[1] * y + H[2]) / z, (H[3] * x + H[4] * y + H[5]) / z]; }
function daOcrPix(I, x, y){ if(x < 0 || y < 0 || x >= I.W - 1 || y >= I.H - 1) return 1; var x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, i = y0 * I.W + x0;
  return I.g[i] * (1 - fx) * (1 - fy) + I.g[i + 1] * fx * (1 - fy) + I.g[i + I.W] * (1 - fx) * fy + I.g[i + I.W + 1] * fx * fy; }
function daOcrDark(I, H, x, y, w, h){ var s = 0, n = 0; for(var i = 1; i <= 3; i++) for(var j = 1; j <= 3; j++){ var p = daOcrMap(H, x + w * i / 4, y + h * j / 4); s += daOcrPix(I, p[0], p[1]); n++; } return 1 - s / n; }
// try the 4 orientations; the code strip (guards + kind + hash) decides
function daOcrRegister(I, layouts){
  var c = daOcrFindSquares(I); if(c.length < 4) return {err:'مش لاقي المربعات السودا في أركان الشيت.\n\n• لو دي الورقة القديمة: القراية بتشتغل على الشيت المطبوع من زرار 🖨️ شيت للطباعة بس (فيه مربعات في الأركان ومربع لكل رقم).\n• لو مطبوع من الأداة: صوّر الورقة كلها من فوق، والأربع مربعات السودا باينين.'};
  var big = c.slice().sort(function(a, b){ return b.a - a.a; }).slice(0, 4);
  if(big[3].a < big[0].a / 2.6) return {err:'مش لاقي الأربع أركان — قرّب أو صوّر من فوق والأركان الأربعة باينة'};
  var cx = big.reduce(function(s, q){ return s + q.x; }, 0) / 4, cy = big.reduce(function(s, q){ return s + q.y; }, 0) / 4;
  var ang = function(q){ return Math.atan2(q.y - cy, q.x - cx); }, ring = big.slice().sort(function(a, b){ return ang(a) - ang(b); });   // clockwise from the left
  var tl = 0, bestS = 1e18; ring.forEach(function(q, i){ if(q.x + q.y < bestS){ bestS = q.x + q.y; tl = i; } });
  var R4 = [0, 1, 2, 3].map(function(k){ return ring[(tl + k) % 4]; });   // TL, TR, BR, BL in the image
  var pick = [R4[0], R4[1], R4[3], R4[2]];                                  // order of DA_FID: TL, TR, BL, BR
  var orders = [[0, 1, 2, 3], [3, 2, 1, 0], [2, 0, 3, 1], [1, 3, 0, 2]];
  for(var oi = 0; oi < orders.length; oi++){
    var dst = orders[oi].map(function(i){ return [pick[i].x, pick[i].y]; }), H = daOcrHomography(DA_FID, dst); if(!H) continue;
    var white = daOcrDark(I, H, 100, 8, 10, 2), black = daOcrDark(I, H, DA_FID[0][0] - 2, DA_FID[0][1] - 2, 4, 4), mid = (white + black) / 2;
    var bits = daOcrStripCells().map(function(cl){ return daOcrDark(I, H, cl.x, cl.y, cl.w, cl.h) > mid ? 1 : 0; });
    if(!bits[0] || !bits[15]) continue;
    var v = 0; for(var i = 0; i < 14; i++) v |= bits[i + 1] << i;
    var kind = DA_OCR_KINDS[v & 3], page = (v >> 2) & 15, hash = (v >> 6) & 255; if(!kind) continue;
    var L = layouts[kind]; if(!L) return {err:'دي صورة ' + ({feed:'شيت العلف', wq:'شيت القياسات', samp:'شيت العينات'})[kind] + ' — افتح الشاشة بتاعته'};
    if(L.hash !== hash) return {err:'الشيت ده اتطبع قبل ما التانكات أو مواعيد الوجبات تتغير — اطبع نسخة جديدة', stale:true};
    if(page >= L.pages.length) return {err:'رقم الصفحة مش مظبوط'};
    return {H:H, kind:kind, page:page, L:L, ink:{white:white, black:black}};
  }
  return {err:'مش قادر أتعرف على الشيت — اتأكد إنه مطبوع من الأداة والصورة واضحة'};
}
// ── box / bubble reading ──
function daOcrBox(I, H, b){
  // sample (almost) the whole box: people write up to the edges. Then remove the printed border (long straight runs
  // along the edges) and ink pieces that come in from the neighbouring box (small parts touching the edge).
  var PW = 40, PH = 48, inset = 0.12, a = new Float32Array(PW * PH), vals = [];
  for(var y = 0; y < PH; y++) for(var x = 0; x < PW; x++){ var p = daOcrMap(H, b.x + inset + (b.w - 2 * inset) * (x + 0.5) / PW, b.y + inset + (b.h - 2 * inset) * (y + 0.5) / PH); var v = daOcrPix(I, p[0], p[1]); a[y * PW + x] = v; vals.push(v); }
  vals.sort(function(m, n){ return m - n; }); var bg = vals[Math.floor(vals.length * 0.85)], ink = new Float32Array(PW * PH);
  for(var i = 0; i < a.length; i++){ var k = Math.max(0, (bg - a[i]) / Math.max(0.15, bg)); ink[i] = k < 0.22 ? 0 : Math.min(1, (k - 0.22) / 0.4); }
  // the printed border sits on the outermost pixels (±small registration error): only there, and only a straight run
  // covering most of the side, so the sides of a "0" written near the edge are kept
  var EP = 4;
  for(var ry = 0; ry < PH; ry++){ if(ry >= EP && ry < PH - EP) continue; var c = 0; for(var rx = 0; rx < PW; rx++) if(ink[ry * PW + rx] > 0.3) c++; if(c > PW * 0.7) for(var rx2 = 0; rx2 < PW; rx2++) ink[ry * PW + rx2] = 0; }
  for(var cx = 0; cx < PW; cx++){ if(cx >= EP && cx < PW - EP) continue; var c2 = 0; for(var cy = 0; cy < PH; cy++) if(ink[cy * PW + cx] > 0.3) c2++; if(c2 > PH * 0.7) for(var cy2 = 0; cy2 < PH; cy2++) ink[cy2 * PW + cx] = 0; }
  var lab = new Int32Array(PW * PH), comps = [], st = [], total = 0;
  for(var q0 = 0; q0 < PW * PH; q0++){ if(lab[q0] || ink[q0] <= 0.3) continue; var id = comps.length + 1, cm = {n:0, edge:false, x0:PW, x1:-1, y0:PH, y1:-1}; lab[q0] = id; st.push(q0);
    while(st.length){ var q = st.pop(), qx = q % PW, qy = (q - qx) / PW; cm.n++; if(qx < 2 || qy < 2 || qx > PW - 3 || qy > PH - 3) cm.edge = true;
      if(qx < cm.x0) cm.x0 = qx; if(qx > cm.x1) cm.x1 = qx; if(qy < cm.y0) cm.y0 = qy; if(qy > cm.y1) cm.y1 = qy;
      for(var dy = -1; dy <= 1; dy++) for(var dx = -1; dx <= 1; dx++){ var nx = qx + dx, ny = qy + dy; if(nx < 0 || ny < 0 || nx >= PW || ny >= PH) continue; var r = ny * PW + nx; if(!lab[r] && ink[r] > 0.3){ lab[r] = id; st.push(r); } } }
    comps.push(cm); total += cm.n; }
  if(total < PW * PH * 0.02) return null;
  // a thin straight line hugging a side = what is left of the printed border after a slightly off registration
  // (it would read as "1" and turn 0.7 into 10.7). A real "1" is written away from the box sides.
  comps.forEach(function(c){ var w = c.x1 - c.x0 + 1, h = c.y1 - c.y0 + 1;
    if((w <= 4 && h >= PH * 0.4 && (c.x1 < 7 || c.x0 > PW - 8)) || (h <= 4 && w >= PW * 0.4 && (c.y1 < 7 || c.y0 > PH - 8))) c.border = true; });
  comps = comps.map(function(c){ if(c.border){ total -= c.n; c.n = 0; } return c; });
  if(total < PW * PH * 0.02) return null;
  var big = Math.max.apply(null, comps.map(function(c){ return c.n; }));
  comps.forEach(function(c, ci){ c.keep = !c.border && (c.n === big || (!c.edge && c.n >= 6) || c.n >= total * 0.25); });
  for(var z = 0; z < PW * PH; z++){ if(lab[z] && !comps[lab[z] - 1].keep) ink[z] = 0; else if(!lab[z] && ink[z] > 0) { var near = false; for(var dz = -1; dz <= 1 && !near; dz++) for(var dw = -1; dw <= 1; dw++){ var zz = z + dz * PW + dw; if(zz >= 0 && zz < PW * PH && lab[zz] && comps[lab[zz] - 1].keep){ near = true; break; } } if(!near) ink[z] = 0; } }
  var on = 0, cxs = 0; for(var o2 = 0; o2 < PW * PH; o2++) if(ink[o2] > 0.3){ on++; cxs += o2 % PW; }
  if(on < PW * PH * 0.02) return null;
  var inkCx = cxs / on / PW;   // 0 = left side, 1 = right side of the box
  var x0 = PW, y0 = PH, x1 = -1, y1 = -1;
  for(var y2 = 0; y2 < PH; y2++) for(var x2 = 0; x2 < PW; x2++) if(ink[y2 * PW + x2] > 0.3){ if(x2 < x0) x0 = x2; if(x2 > x1) x1 = x2; if(y2 < y0) y0 = y2; if(y2 > y1) y1 = y2; }
  var bw = x1 - x0 + 1, bh = y1 - y0 + 1, sc = 20 / Math.max(bw, bh), img = new Float32Array(784), tmp = new Float32Array(784), mx = 0, my = 0, ms = 0;
  var ox = (28 - bw * sc) / 2, oy = (28 - bh * sc) / 2;
  for(var ty = 0; ty < 28; ty++) for(var tx = 0; tx < 28; tx++){ var sx = (tx + 0.5 - ox) / sc + x0 - 0.5, sy = (ty + 0.5 - oy) / sc + y0 - 0.5;
    if(sx < x0 - 1 || sy < y0 - 1 || sx > x1 + 1 || sy > y1 + 1) continue;
    var ix = Math.floor(sx), iy = Math.floor(sy), fx = sx - ix, fy = sy - iy, g = function(u, v){ return u < 0 || v < 0 || u >= PW || v >= PH ? 0 : ink[v * PW + u]; };
    var val = g(ix, iy) * (1 - fx) * (1 - fy) + g(ix + 1, iy) * fx * (1 - fy) + g(ix, iy + 1) * (1 - fx) * fy + g(ix + 1, iy + 1) * fx * fy;
    tmp[ty * 28 + tx] = val; mx += tx * val; my += ty * val; ms += val; }
  if(ms <= 0) return null;
  var dx = Math.round(14 - mx / ms - 0.5), dy = Math.round(14 - my / ms - 0.5);
  for(var yy = 0; yy < 28; yy++) for(var xx = 0; xx < 28; xx++){ var u2 = xx - dx, v2 = yy - dy; if(u2 >= 0 && v2 >= 0 && u2 < 28 && v2 < 28) img[yy * 28 + xx] = tmp[v2 * 28 + u2]; }
  var res = daOcrClassify(img); res.cx = inkCx; return res;
}
function daOcrBubble(I, H, c){ var s = 0, n = 0;
  for(var i = -2; i <= 2; i++) for(var j = -2; j <= 2; j++){ if(i * i + j * j > 5) continue; var p = daOcrMap(H, c.cx + i * c.r * 0.28, c.cy + j * c.r * 0.28); s += daOcrPix(I, p[0], p[1]); n++; }
  return 1 - s / n; }
function daOcrCross(I, H, A, B){
  var xb = (A.x + A.w + B.x) / 2, n = 24, L = [], R = [], all = [];
  for(var k = 0; k < n; k++){ var y = A.y + A.h * (0.1 + 0.8 * k / (n - 1)), pl = daOcrMap(H, xb - 0.7, y), pr = daOcrMap(H, xb + 0.7, y);
    var vl = daOcrPix(I, pl[0], pl[1]), vr = daOcrPix(I, pr[0], pr[1]); L.push(vl); R.push(vr); all.push(vl, vr); }
  all.sort(function(a, b){ return a - b; }); var bg = all[Math.floor(all.length * 0.9)], dark = function(v){ return (bg - v) / Math.max(0.15, bg) > 0.3; };
  // ink within 0.7 mm of the line on BOTH sides (any height: a "0" sitting on the line shows its side on one side and
  // its arcs on the other) → one digit may have been split between two boxes
  var dl = 0, dr = 0; for(var k2 = 0; k2 < n; k2++){ if(dark(L[k2])) dl++; if(dark(R[k2])) dr++; }
  return dl >= 2 && dr >= 2;
}
function daOcrField(I, H, boxes, dot){   // digits → {text, conf}
  var r = boxes.map(function(b){ return daOcrBox(I, H, b); }), any = r.some(Boolean); if(!any) return null;
  var conf = Math.min.apply(null, r.filter(Boolean).map(function(x){ return x.p; })), s = '';
  r.forEach(function(x, i){ s += x ? x.d : (dot !== undefined && i <= dot ? '' : ''); if(dot !== undefined && i === dot) s += '.'; });
  if(dot !== undefined){ var parts = s.split('.'); s = (parts[0] || '0') + (parts[1] ? '.' + parts[1] : ''); s = String(+s); }
  else s = String(+s);
  // after the first written box, every box of the integer part must be written ([5][ ].[ ] = 5 or 50? → ask)
  var intEnd = dot === undefined ? r.length - 1 : dot, first = -1; for(var q = 0; q <= intEnd; q++) if(r[q]){ first = q; break; }
  var holes = first >= 0 && r.slice(first, intEnd + 1).some(function(x){ return !x; });
  // one digit written across the line between two boxes → both halves get read as digits: ask
  for(var q2 = 0; q2 < r.length - 1; q2++){ var bA = boxes[q2], bB = boxes[q2 + 1];
    if(r[q2] && r[q2 + 1] && Math.abs(bA.x + bA.w - bB.x) < 0.3 && (daOcrCross(I, H, bA, bB) || r[q2].cx > 0.74 || r[q2 + 1].cx < 0.26)) holes = true; }
  // a lone "digit" pressed against the side of an empty neighbour is usually a piece of the digit next door
  r.forEach(function(x, i){ if(x && ((i > 0 && !r[i - 1] && x.cx < 0.22) || (i < r.length - 1 && !r[i + 1] && x.cx > 0.78))) holes = true; });
  return {text:s, conf:holes ? Math.min(conf, 0.5) : conf};
}
function daOcrReadPage(I, R){
  var P = R.L.pages[R.page], H = R.H, out = {kind:R.kind, page:R.page, rows:[], date:null}, ink = R.ink;
  var db = daOcrDateBoxes().map(function(b){ return daOcrBox(I, H, b); });
  if(db.every(Boolean)){ var ds = db.map(function(x){ return x.d; }).join(''), dd = ds.slice(4) + '-' + ds.slice(2, 4) + '-' + ds.slice(0, 2);
    if(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(dd)) out.date = {v:dd, conf:Math.min.apply(null, db.map(function(x){ return x.p; }))}; }
  var bub = function(c){ var d = daOcrBubble(I, H, c); return (d - ink.white) / Math.max(0.2, ink.black - ink.white); };
  P.lines.forEach(function(l){
    if(R.kind === 'wq'){ out.rows.push({sec:l.sec, temp:daOcrField(I, H, l.temp.boxes, 1), ph:daOcrField(I, H, l.ph.boxes, 0), 'do':daOcrField(I, H, l['do'].boxes, 1)}); return; }
    if(R.kind === 'samp'){ out.rows.push({unit:l.unit, wt:daOcrField(I, H, l.wt.boxes), n:daOcrField(I, H, l.n.boxes)}); return; }
    if(l.kind !== 'tank') return;
    var c = l.cols, grams = l.g.unit === 'g', row = {unit:l.unit, meals:[], size:null, fast:false, dead:[]};
    c.meals.forEach(function(m){ var f = daOcrField(I, H, m.boxes, grams ? undefined : 1); row.meals.push(f); });
    // meals of one tank are usually the same amount (the farm's paper: 500 500 500): one far from the others → check it
    var vs = row.meals.filter(Boolean).map(function(f){ return +f.text; }).filter(function(v){ return v > 0; }).sort(function(a, b){ return a - b; });
    if(vs.length >= 3){ var med = vs[Math.floor(vs.length / 2)];
      row.meals.forEach(function(f){ if(f && +f.text > 0 && (+f.text / med >= 1.6 || med / +f.text >= 1.6)){ f.conf = Math.min(f.conf, 0.5); f.why = 'بعيد عن باقي وجبات التانك'; } }); }
    var sv = c.size.map(bub), mi = sv.indexOf(Math.max.apply(null, sv)), srt = sv.slice().sort(function(a, b){ return b - a; });
    if(srt[0] > 0.3) row.size = {v:c.size[mi].v, conf:srt[0] - srt[1] > 0.2 ? 0.99 : 0.4};
    row.fast = bub(c.fast) > 0.35;
    c.dead.forEach(function(d){ row.dead.push(daOcrField(I, H, d.boxes)); });
    out.rows.push(row);
  });
  return out;
}
async function daOcrReadFiles(files, kind){
  var farm = daOcrFarm(kind), layouts = {}; if(!farm) return {pages:[], errs:['اختار المزرعة من فوق الأول']};
  layouts[kind] = daOcrLayout(kind, farm);
  var pages = [], errs = [];
  for(var i = 0; i < files.length; i++){
    try{ var I = await daOcrLoad(files[i]), R = daOcrRegister(I, layouts); if(R.err){ errs.push((files.length > 1 ? 'صورة ' + (i + 1) + ': ' : '') + R.err); continue; }
      pages.push(daOcrReadPage(I, R)); }catch(e){ errs.push('صورة ' + (i + 1) + ': ' + e.message); }
  }
  return {pages:pages, errs:errs};
}
// ── into the on-screen sheets (nothing is saved here) ──
var DA_OCR_LOW = 0.85;
function daOcrMark(el, v, conf){ if(!el || el.disabled) return; el.value = v; el.classList.toggle('ocr-low', conf < DA_OCR_LOW); el.classList.add('ocr-read'); if(conf < DA_OCR_LOW) el.title = 'مش متأكد من القراية — راجع الرقم'; el.dispatchEvent(new Event('input', {bubbles:true})); }
function daOcrPick(kind){
  var inp = document.getElementById('ocr-file'); if(!inp){ inp = document.createElement('input'); inp.type = 'file'; inp.id = 'ocr-file'; inp.accept = 'image/*'; inp.multiple = true; inp.style.display = 'none'; document.body.appendChild(inp); }
  inp.value = ''; inp.onchange = function(){ if(inp.files && inp.files.length) daOcrRun(Array.prototype.slice.call(inp.files), kind); }; inp.click();
}
async function daOcrRun(files, kind){
  toast('📷 بقرا ' + files.length + ' صورة...');
  var res = await daOcrReadFiles(files, kind), st = kind === 'wq' ? window._wqs : kind === 'samp' ? {date:_sampSheetDate} : window._fs;
  if(!res.pages.length){ alert('⚠️ ' + res.errs.join('\n')); return; }
  var date = res.pages.map(function(p){ return p.date; }).filter(Boolean).sort(function(a, b){ return b.conf - a.conf; })[0];
  if(date && date.v !== st.date){
    if(date.v > daToday()) toast('⚠️ التاريخ المقري ' + date.v + ' في المستقبل — سيبته ' + st.date);
    else if(confirm('التاريخ في الشيت ' + date.v + ' والشاشة على ' + st.date + '. أحوّل الشاشة لـ ' + date.v + '؟')){
      if(kind === 'samp') _sampSheetDate = date.v; else st.date = date.v;
      show(kind === 'wq' ? 'wq-sheet' : kind === 'samp' ? 'tx-sampling' : 'feed-sheet', true); }
  }
  var n = 0, low = 0, cnt = function(f){ if(!f) return; n++; if(f.conf < DA_OCR_LOW) low++; };
  if(kind === 'samp'){
    res.pages.forEach(function(p){ p.rows.forEach(function(r){
      if(r.wt){ cnt(r.wt); daOcrMark(document.getElementById('sp-wt-' + r.unit), r.wt.text, r.wt.conf); }
      if(r.n){ cnt(r.n); daOcrMark(document.getElementById('sp-n-' + r.unit), r.n.text, r.n.conf); } }); });
  } else if(kind === 'wq'){
    res.pages.forEach(function(p){ p.rows.forEach(function(r){ var i = window._wqs.secs.indexOf(r.sec); if(i < 0) return;
      ['temp', 'ph', 'do'].forEach(function(k){ var f = r[k]; if(f){ cnt(f); daOcrMark(document.getElementById('wqs-' + i + '-' + k), f.text, f.conf); } }); }); });
  } else {
    var byUnit = {}; window._fs.rows.forEach(function(r){ byUnit[r.unit] = r; });
    res.pages.forEach(function(p){ p.rows.forEach(function(rr){ var r = byUnit[rr.unit]; if(!r || r.i === undefined) return;
      if(rr.fast){ r.meals.forEach(function(m, k){ daOcrMark(document.getElementById('fs-' + r.i + '-m' + k), 'X', 0.99); }); }
      else rr.meals.forEach(function(f, k){ if(f){ cnt(f); daOcrMark(document.getElementById('fs-' + r.i + '-m' + k), f.text, f.conf); } });
      if(rr.size){ cnt(rr.size); daOcrMark(document.getElementById('fs-' + r.i + '-sz'), rr.size.v, rr.size.conf); }
      var d = rr.dead.filter(Boolean); if(d.length){ d.forEach(cnt); daOcrMark(document.getElementById('fs-' + r.i + '-d'), d.map(function(x){ return x.text; }).join('+'), Math.min.apply(null, d.map(function(x){ return x.conf; }))); }
    }); });
  }
  var msg = '📷 اتقري ' + n + ' خانة من ' + res.pages.length + ' صفحة' + (low ? ' — ' + low + ' متعلّمين بالأصفر راجعهم' : '') + '. راجع وبعدين اضغط حفظ.';
  toast(msg); if(res.errs.length) setTimeout(function(){ alert('⚠️ ' + res.errs.join('\n')); }, 50);
}
document.addEventListener('input', function(e){ var x = e.target; if(x && x.classList && x.classList.contains('ocr-low') && e.isTrusted){ x.classList.remove('ocr-low'); x.title = ''; } }, true);
(function(){
  if(document.getElementById('da-ocr-css')) return;
  var c = document.createElement('style'); c.id = 'da-ocr-css';
  c.textContent = 'input.ocr-read{background:#f0fdfa}input.ocr-low{background:#fef3c7!important;border-color:#f59e0b!important;box-shadow:0 0 0 2px #fde68a}';
  document.head.appendChild(c);
})();
