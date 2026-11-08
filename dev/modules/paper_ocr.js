// ══════════════════════════════════════════════════════════
//  READ THE FARM'S OWN PAPER (no corner marks, no digit boxes)
// ══════════════════════════════════════════════════════════
// FH1 Fish Feed Log (AQU-FR-25-01-07): one table, 14 columns (two halves: Tank · 4 meals · Size · dead), header + 26
// rows. The printed grid is found from its long straight lines (fitted as lines → rotation / perspective handled),
// matched to the form's column widths; each cell is sampled, line remnants removed, handwriting split into digits and
// decimal points, read by the same digit model. Sanity: meals > 5 kg = a missing point; a meal unlike the rest of its
// row is flagged. Everything uncertain is yellow; nothing is saved until Save.
// pages of each farm's own feed log, read from its Word form (AQU-FR-25-01-07): column widths, rows, and per half the meals
// and the tank numbers printed on it. FH2 has two pages (sections 1–3 in grams; 4–16 in kg with 3 / 4 meals per half).
var DA_PAPER_TPL = {"F1":{"pages":[{"cols":[855,728,714,741,729,756,770,855,761,764,775,761,789,803],"rows":26,"headH":372,"rowH":396,"halves":[{"c0":0,"meals":4,"labels":["1.1","1.2","1.3","1.4","2.1","2.2","2.3","2.4","3.1","3.2","3.3","3.4","4.1","4.2","4.3","4.4","5.1","5.2","5.3","5.4","6.1","6.2","6.3","6.4","6.5","6.6"]},{"c0":7,"meals":4,"labels":["7.1","7.2","7.3","7.4","8.1","8.2","8.3","8.4","9.1","9.2","9.3","9.4","10.1","10.2","10.3","10.4","11.1","11.2","11.3","11.4","12.1","12.2","12.3","12.4","",""]}],"unit":"kg","maxV":5}]},"F2":{"pages":[{"cols":[727,609,677,608,601,601,695,717,726,601,604,604,601,601,695,859],"rows":21,"headH":490,"rowH":522,"halves":[{"c0":0,"meals":5,"labels":["1.1","1.2","1.3","1.4","1.5","1.6","1.7","1.8","1.9","1.10","1.11","1.12","1.13","1.14","2.1","2.2","2.3","2.4","2.5","2.6","2.7"]},{"c0":8,"meals":5,"labels":["2.8","2.9","2.10","2.11","2.12","2.13","2.14","3.1","3.2","3.3","3.4","3.5","3.6","3.7","3.8","3.9","3.10","3.11","3.12","3.13","3.14"]}],"unit":"g","maxV":3000},{"cols":[863,808,807,807,862,840,797,700,700,840,732,775,904],"rows":28,"headH":359,"rowH":382,"halves":[{"c0":0,"meals":3,"labels":["4.1","4.2","4.3","4.4","4.5","4.6","4.7","4.8","4.9","4.10","4.11","4.12","4.13","4.14","5.1","5.2","5.3","5.4","5.5","5.6","5.7","5.8","5.9","5.10","5.11","5.12","5.13","5.14"],"maxV":8},{"c0":6,"meals":4,"labels":["6.1","6.2","7.1","7.2","8.1","8.2","9.1","9.2","10.1","10.2","11.1","11.2","12.1","12.2","13.1","13.2","14.1","14.2","15.1","15.2","16.1","16.2","16.3","16.4","16.5","16.6","16.7",""],"maxV":40}],"unit":"kg","maxV":40}]}};
function daPaperTemplate(farm){ return DA_PAPER_TPL[farm] || null; }
function daPaperDark(I, k, cap){   // k: how much darker than the surrounding paper (lines are light grey on this form)
  k = k || 0.78; cap = cap || 0.62;
  var W = I.W, H = I.H, r = Math.max(8, Math.round(W / 60)), S = new Float64Array((W + 1) * (H + 1)), d = new Uint8Array(W * H);
  for(var y = 0; y < H; y++){ var row = 0; for(var x = 0; x < W; x++){ row += I.g[y * W + x]; S[(y + 1) * (W + 1) + x + 1] = S[y * (W + 1) + x + 1] + row; } }
  for(var y2 = 0; y2 < H; y2++) for(var x2 = 0; x2 < W; x2++){ var xa = Math.max(0, x2 - r), xb = Math.min(W, x2 + r + 1), ya = Math.max(0, y2 - r), yb = Math.min(H, y2 + r + 1);
    var m = (S[yb * (W + 1) + xb] - S[ya * (W + 1) + xb] - S[yb * (W + 1) + xa] + S[ya * (W + 1) + xa]) / ((xb - xa) * (yb - ya)), v = I.g[y2 * W + x2];
    d[y2 * W + x2] = v < m * k && v < cap ? 1 : 0; }
  return d;
}
// long straight runs → grouped segments → fitted lines. horiz: y = a·x + b (top & bottom edge); vert: x = a·y + b


function daPaperX(h, v){ // intersection of horizontal y = a x + b and vertical x = c y + d
  var x = (v.a * h.b + v.b) / (1 - v.a * h.a); return {x:x, y:h.a * x + h.b};
}
// masks of straight strokes: horizontal / vertical runs of "slightly darker than the paper" pixels
function daPaperRunMask(D, W, H, horiz, minRun){
  var M = new Uint8Array(W * H), L = horiz ? W : H, N = horiz ? H : W;
  for(var n = 0; n < N; n++){ var s = -1; for(var l = 0; l <= L; l++){ var on = l < L && (horiz ? D[n * W + l] : D[l * W + n]);
    if(on && s < 0) s = l; else if(!on && s >= 0){ if(l - s >= minRun) for(var t = s; t < l; t++) M[horiz ? n * W + t : t * W + n] = 1; s = -1; } } }
  return M;
}
// best skew angle for one band of the page + the projection profile at that angle
function daPaperProfile(M, W, H, horiz, a0, a1, fixedT){   // horiz: rows (project along x over x∈[a0,a1)); else columns (along y over y∈[a0,a1))
  var best = null;
  var angles = []; if(fixedT !== undefined) angles.push(fixedT); else for(var deg = -8; deg <= 8.001; deg += 0.2) angles.push(Math.tan(deg * Math.PI / 180));
  angles.forEach(function(t){ var P = new Float64Array((horiz ? H : W) + 400), sc = 0;
    for(var u = a0; u < a1; u += 2) for(var v = 0; v < (horiz ? H : W); v++){ var z = horiz ? v * W + u : u * W + v; if(!M[z]) continue; var k = Math.round(v - u * t) + 200; if(k >= 0 && k < P.length) P[k]++; }
    for(var q = 0; q < P.length; q++) sc += P[q] * P[q];
    if(!best || sc > best.sc) best = {sc:sc, t:t, P:P}; });
  return best;   // line through the band: v = k − 200 + u·t
}
function daPaperPeaks(P, minFrac){
  var sm = new Float64Array(P.length), mx = 0; for(var i = 2; i < P.length - 2; i++){ sm[i] = (P[i - 2] + 2 * P[i - 1] + 3 * P[i] + 2 * P[i + 1] + P[i + 2]) / 9; if(sm[i] > mx) mx = sm[i]; }
  var out = []; for(var j = 3; j < P.length - 3; j++) if(sm[j] >= mx * minFrac && sm[j] >= sm[j - 1] && sm[j] > sm[j + 1] && sm[j] >= sm[j - 2] && sm[j] >= sm[j + 2]) out.push({k:j, s:sm[j]});
  return out;
}
function daPaperGrid(I, tpl){
  var W = I.W, H = I.H, D1 = daPaperDark(I), D2 = daPaperDark(I, 0.9, 0.86);
  var HM = daPaperRunMask(D2, W, H, true, Math.round(W * 0.02)), VM = daPaperRunMask(D2, W, H, false, Math.round(H * 0.012));
  // ── rows: two half-page strips, each with its own skew (perspective) ──
  var strips = [[Math.round(W * 0.08), Math.round(W * 0.48)], [Math.round(W * 0.52), Math.round(W * 0.92)]], rowPts = [], rowHits = 0, colScore = 0;
  for(var si = 0; si < 2; si++){
    var a0 = strips[si][0], a1 = strips[si][1], xc = (a0 + a1) / 2, pr = daPaperProfile(HM, W, H, true, a0, a1), t = pr.t;
    // header band = the darkest block of rows in the strong mask at the same skew
    var B = new Float64Array(H + 400); for(var u = a0; u < a1; u += 2) for(var v = 0; v < H; v++) if(D1[v * W + u]){ var k = Math.round(v - u * t) + 200; if(k >= 0 && k < B.length) B[k]++; }
    var cols = (a1 - a0) / 2, bandEnd = -1, bandStart = -1, run = 0;
    var blocks = []; for(var k2 = 0; k2 < B.length; k2++){ if(B[k2] > cols * 0.45){ if(!run) bandStart = k2; run++; } else { if(run >= 4) blocks.push([bandStart, k2]); run = 0; } }
    for(var bi = 0; bi < blocks.length && bandEnd < 0; bi++){   // the FIRST dark band (not the signature boxes below); white header text can split it into pieces
      var b0 = blocks[bi][0], b1 = blocks[bi][1];
      while(bi + 1 < blocks.length && blocks[bi + 1][0] - b1 <= Math.max(12, (b1 - b0) * 2.2)){ bi++; b1 = blocks[bi][1]; }
      if(b1 - b0 >= 12){ bandStart = b0; bandEnd = b1; } }
    if(bandEnd < 0) return {err:'مش لاقي صف العناوين الأسود'};
    var peaks = daPaperPeaks(pr.P, 0.12).filter(function(p){ return p.k > bandEnd + 4; }), s = (bandEnd - bandStart) * (tpl.rowH || 396) / (tpl.headH || 372), cur = bandEnd, ys = [bandEnd];
    for(var r = 0; r < tpl.rows; r++){ var target = cur + s, best = null;
      peaks.forEach(function(p){ if(Math.abs(p.k - target) < s * 0.3 && (!best || Math.abs(p.k - target) < Math.abs(best.k - target))) best = p; });
      var nk = best ? best.k : target; if(best){ s = 0.7 * s + 0.3 * (nk - cur); rowHits++; } ys.push(nk); cur = nk; }
    rowPts.push(ys.map(function(k){ return {x:xc, y:k - 200 + xc * t}; })); }
  var rows = rowPts[0].map(function(p, i){ var q = rowPts[1][i], a = (q.y - p.y) / (q.x - p.x); return {a:a, b:p.y - a * p.x}; });
  // ── columns: top and bottom halves of the table, matched to the form's column widths ──
  var yA = rows[0].a * W / 2 + rows[0].b, yZ = rows[rows.length - 1].a * W / 2 + rows[rows.length - 1].b, ym = (yA + yZ) / 2;
  var tot = tpl.cols.reduce(function(a, b){ return a + b; }, 0), cum = [0]; tpl.cols.forEach(function(w){ cum.push(cum[cum.length - 1] + w / tot); });
  var colPts = [];
  [[yA, ym], [ym, yZ]].forEach(function(yr){
    var rowT = rows.reduce(function(a, f){ return a + f.a; }, 0) / rows.length;   // vertical lines are perpendicular to the rows: dx/dy = −dy/dx
    var pr = daPaperProfile(VM, W, H, false, Math.round(yr[0]), Math.round(yr[1]), -rowT), yc = (yr[0] + yr[1]) / 2, pk = daPaperPeaks(pr.P, 0.08);
    // borders: the pair of strong peaks whose template prediction fits the most peaks
    var strong = pk.slice().sort(function(a, b){ return b.s - a.s; }).slice(0, 30), best = null;
    strong.forEach(function(L){ strong.forEach(function(R){ var span = R.k - L.k; if(span < W * 0.5) return; var sc = 0;
      cum.forEach(function(c){ var ex = L.k + span * c, nb = null; pk.forEach(function(p){ if(Math.abs(p.k - ex) < span * 0.012 && (!nb || p.s > nb.s)) nb = p; }); if(nb) sc += 1 + nb.s / strong[0].s; });
      if(!best || sc > best.sc) best = {sc:sc, L:L.k, R:R.k}; }); });
    if(!best){ colPts.push(null); return; } colScore += best.sc;
    // walk left → right: each line predicted from the REAL previous line (the printout is not exactly the Word widths)
    var span = best.R - best.L, prev = best.L, ks = [best.L];
    for(var j = 1; j < cum.length - 1; j++){ var w = span * (cum[j] - cum[j - 1]), ex = prev + w, nb = null;
      pk.forEach(function(p){ if(Math.abs(p.k - ex) < w * 0.35 && (!nb || Math.abs(p.k - ex) < Math.abs(nb.k - ex))) nb = p; });
      prev = nb ? nb.k : ex; ks.push(prev); }
    ks.push(best.R);
    colPts.push(ks.map(function(k){ return {y:yc, x:k - 200 + yc * pr.t}; }));
  });
  if(!colPts[0] || !colPts[1]) return {err:'مش لاقي أعمدة الجدول', dbg:[yA, ym, yZ, rows.length]};
  var colsV = colPts[0].map(function(p, i){ var q = colPts[1][i], a = (q.x - p.x) / (q.y - p.y); return {a:a, b:p.x - a * p.y}; });
  return {rows:rows, cols:colsV, score:colScore / cum.length + rowHits / (2 * tpl.rows), rowFit:rowHits / (2 * tpl.rows)};   // how well this page's form fits the photo
}
// sample one cell (quad between two horizontals and two verticals) → grey patch
function daPaperCell(I, G, r, c, CW, CH){
  var p00 = daPaperX(G.rows[r], G.cols[c]), p10 = daPaperX(G.rows[r], G.cols[c + 1]), p01 = daPaperX(G.rows[r + 1], G.cols[c]), p11 = daPaperX(G.rows[r + 1], G.cols[c + 1]);
  var out = new Float32Array(CW * CH), ix = -0.04, iy = -0.04;
  for(var y = 0; y < CH; y++) for(var x = 0; x < CW; x++){ var u = ix + (1 - 2 * ix) * (x + 0.5) / CW, v = iy + (1 - 2 * iy) * (y + 0.5) / CH;
    var px = (1 - u) * (1 - v) * p00.x + u * (1 - v) * p10.x + (1 - u) * v * p01.x + u * v * p11.x, py = (1 - u) * (1 - v) * p00.y + u * (1 - v) * p10.y + (1 - u) * v * p01.y + u * v * p11.y;
    var X = Math.max(0, Math.min(I.W - 2, px)), Y = Math.max(0, Math.min(I.H - 2, py)), x0 = Math.floor(X), y0 = Math.floor(Y), fx = X - x0, fy = Y - y0, g = I.g, W = I.W;
    out[y * CW + x] = g[y0 * W + x0] * (1 - fx) * (1 - fy) + g[y0 * W + x0 + 1] * fx * (1 - fy) + g[(y0 + 1) * W + x0] * (1 - fx) * fy + g[(y0 + 1) * W + x0 + 1] * fx * fy;
    if(Math.abs(u) < 0.035 || Math.abs(u - 1) < 0.035 || Math.abs(v) < 0.075 || Math.abs(v - 1) < 0.075) out[y * CW + x] = -1; }   // printed grid line: blanked (marked −1 = paper)
  var bgv = []; for(var q = 0; q < CW * CH; q += 7) if(out[q] >= 0) bgv.push(out[q]); bgv.sort(function(a, b){ return a - b; }); var paper = bgv[Math.floor(bgv.length * 0.85)] || 1;
  for(var q2 = 0; q2 < CW * CH; q2++) if(out[q2] < 0) out[q2] = paper;
  return out;
}
// handwriting in a cell → pieces sorted left→right: {dot} or {d, p}
function daPaperPieces(patch, CW, CH){
  var vals = Array.prototype.slice.call(patch).sort(function(a, b){ return a - b; }), bg = vals[Math.floor(vals.length * 0.85)], ink = new Float32Array(CW * CH);
  for(var i = 0; i < CW * CH; i++){ var t = (bg - patch[i]) / Math.max(0.08, bg * 0.5); ink[i] = t > 0.35 ? Math.min(1, t) : 0; }
  // printed lines cut the whole cell: a pixel column (row) dark over ≥ 82 % of the height (width) without a break is a line
  for(var sl = -0.3; sl <= 0.301; sl += 0.05) for(var x = -Math.ceil(CH * 0.3); x < CW + Math.ceil(CH * 0.3); x++){   // slanted too (perspective)
    var hit = 0, run = 0, mx = 0, top = false, bot = false; for(var y = 0; y < CH; y++){ var px = Math.round(x + sl * (y - CH / 2)); var on = px >= 0 && px < CW && (ink[y * CW + px] || (px + 1 < CW && ink[y * CW + px + 1]));
      if(on){ hit++; run++; if(run > mx) mx = run; if(y < CH * 0.15) top = true; if(y > CH * 0.85) bot = true; } else run = 0; }
    // a printed line crosses the whole cell (even dotted); a written 1 doesn't reach both edges
    var nearEdge = x < CW * 0.18 || x > CW * 0.82;   // printed lines sit at the cell borders; written 1s are inside
    if(mx >= CH * 0.82 || (nearEdge && hit >= CH * 0.6 && top && bot)) for(var y2 = 0; y2 < CH; y2++){ var p2 = Math.round(x + sl * (y2 - CH / 2)); for(var dx = -1; dx <= 2; dx++){ var xx = p2 + dx; if(xx >= 0 && xx < CW) ink[y2 * CW + xx] = 0; } } }
  for(var y3 = 0; y3 < CH; y3++){ var run2 = 0, mx2 = 0; for(var x3 = 0; x3 < CW; x3++){ if(ink[y3 * CW + x3]) { run2++; if(run2 > mx2) mx2 = run2; } else run2 = 0; }
    if(mx2 >= CW * 0.8) for(var dy2 = -1; dy2 <= 1; dy2++){ var yy = y3 + dy2; if(yy >= 0 && yy < CH) for(var x4 = 0; x4 < CW; x4++) ink[yy * CW + x4] = 0; } }
  var lab = new Int32Array(CW * CH), comps = [];
  for(var q = 0; q < CW * CH; q++){ if(lab[q] || !ink[q]) continue; var cm = {n:0, x0:CW, x1:-1, y0:CH, y1:-1, px:[]}, st = [q]; lab[q] = comps.length + 1;
    while(st.length){ var z = st.pop(), zx = z % CW, zy = (z - zx) / CW; cm.n++; cm.px.push(z); if(zx < cm.x0) cm.x0 = zx; if(zx > cm.x1) cm.x1 = zx; if(zy < cm.y0) cm.y0 = zy; if(zy > cm.y1) cm.y1 = zy;
      for(var dy = -1; dy <= 1; dy++) for(var dx = -1; dx <= 1; dx++){ var nx = zx + dx, ny = zy + dy; if(nx < 0 || ny < 0 || nx >= CW || ny >= CH) continue; var nz = ny * CW + nx; if(!lab[nz] && ink[nz]){ lab[nz] = lab[q]; st.push(nz); } } }
    comps.push(cm); }
  // drop printed-line remnants and specks
  comps = comps.filter(function(c){ var w = c.x1 - c.x0 + 1, h = c.y1 - c.y0 + 1, edge = c.x0 <= 1 || c.y0 <= 1 || c.x1 >= CW - 2 || c.y1 >= CH - 2;
    if(edge && ((w > CW * 0.75 && h < CH * 0.18) || (h > CH * 0.9 && w < CW * 0.07))) return false;
    if((c.x1 < CW * 0.12 || c.x0 > CW * 0.88) && w < CW * 0.06 && h > CH * 0.5) return false;   // a sliver of the column line right at the edge
    return c.n >= 5; });
  // merge pieces of one stroke (large x-overlap)
  comps.sort(function(a, b){ return a.x0 - b.x0; });
  for(var a = 0; a < comps.length; a++) for(var b = a + 1; b < comps.length; b++){ var A = comps[a], B = comps[b]; if(!A || !B) continue;
    var ov = Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0), mw = Math.min(A.x1 - A.x0, B.x1 - B.x0) + 1;
    if(ov > mw * 0.6 && A.n > 12 && B.n > 12){ A.n += B.n; A.px = A.px.concat(B.px); A.x0 = Math.min(A.x0, B.x0); A.x1 = Math.max(A.x1, B.x1); A.y0 = Math.min(A.y0, B.y0); A.y1 = Math.max(A.y1, B.y1); comps[b] = null; } }
  comps = comps.filter(Boolean); if(!comps.length) return [];
  var ref = Math.max.apply(null, comps.map(function(c){ return c.y1 - c.y0 + 1; }));
  if(ref < CH * 0.22) return [];
  return comps.filter(function(c){ return c.y1 - c.y0 + 1 >= ref * 0.12; }).map(function(c){
    var w = c.x1 - c.x0 + 1, h = c.y1 - c.y0 + 1;
    if(h <= ref * 0.38 && w <= ref * 0.45) return {dot:true, x:c.x0};
    var left = null;
    if(w > h * 1.15){ var lim = c.x0 + h * 0.85, sub = {x0:c.x0, x1:c.x0, y0:CH, y1:-1, px:[]};   // a digit joined to a letter ("3m"): its left part
      c.px.forEach(function(z){ var zx = z % CW, zy = (z - zx) / CW; if(zx <= lim){ sub.px.push(z); if(zx > sub.x1) sub.x1 = zx; if(zy < sub.y0) sub.y0 = zy; if(zy > sub.y1) sub.y1 = zy; } });
      if(sub.px.length > 8){ var Ls = daOcrLogits(daPaperDigit(ink, sub, CW)), ms = Math.max.apply(null, Ls), es = Ls.map(function(v){ return Math.exp(v - ms); }), ss = es.reduce(function(a2, b2){ return a2 + b2; }, 0); left = {P:es.map(function(v){ return v / ss; })}; } }
    var img = daPaperDigit(ink, c, CW), L = daOcrLogits(img), mx = Math.max.apply(null, L), e = L.map(function(v){ return Math.exp(v - mx); }), s = e.reduce(function(p, q){ return p + q; }, 0), P = e.map(function(v){ return v / s; }), d = 0;
    for(var k = 1; k < 10; k++) if(P[k] > P[d]) d = k;
    return {d:d, p:P[d], P:P, x:c.x0, w:w, h:h, left:left, edge:c.x0 <= 1 || c.x1 >= CW - 2 || c.y0 <= 1 || c.y1 >= CH - 2};
  });
}
function daPaperDigit(ink, c, CW){   // component → MNIST-style 28×28 (20×20 box, centred by mass)
  var set = {}; c.px.forEach(function(z){ set[z] = 1; });
  var bw = c.x1 - c.x0 + 1, bh = c.y1 - c.y0 + 1, sc = 20 / Math.max(bw, bh), ox = (28 - bw * sc) / 2, oy = (28 - bh * sc) / 2, tmp = new Float32Array(784), img = new Float32Array(784), mx = 0, my = 0, ms = 0;
  var g = function(u, v){ var z = v * CW + u; return set[z] ? ink[z] : 0; };
  for(var ty = 0; ty < 28; ty++) for(var tx = 0; tx < 28; tx++){ var sx = (tx + 0.5 - ox) / sc + c.x0 - 0.5, sy = (ty + 0.5 - oy) / sc + c.y0 - 0.5;
    if(sx < c.x0 - 1 || sy < c.y0 - 1 || sx > c.x1 + 1 || sy > c.y1 + 1) continue; var ix = Math.floor(sx), iy = Math.floor(sy), fx = sx - ix, fy = sy - iy;
    var val = g(ix, iy) * (1 - fx) * (1 - fy) + g(ix + 1, iy) * fx * (1 - fy) + g(ix, iy + 1) * (1 - fx) * fy + g(ix + 1, iy + 1) * fx * fy; tmp[ty * 28 + tx] = val; mx += tx * val; my += ty * val; ms += val; }
  if(ms <= 0) return img; var dx = Math.round(14 - mx / ms - 0.5), dy = Math.round(14 - my / ms - 0.5);
  for(var yy = 0; yy < 28; yy++) for(var xx = 0; xx < 28; xx++){ var u2 = xx - dx, v2 = yy - dy; if(u2 >= 0 && v2 >= 0 && u2 < 28 && v2 < 28) img[yy * 28 + xx] = tmp[v2 * 28 + u2]; }
  return img;
}
function daPaperMeal(pcs, maxKg, unit){   // pieces → {v, text, conf}
  if(!pcs.length) return null; var t = '', conf = 1, digits = 0, ink = pcs.some(function(p){ return !p.dot; });
  pcs.forEach(function(p){ if(p.dot){ if(t.indexOf('.') < 0) t += '.'; } else { t += p.d; conf = Math.min(conf, p.p); digits++; } });
  if(!digits) return ink ? {v:null, text:'', conf:0} : null;
  var dp = t.indexOf('.'); if(dp >= 0 && t.length - dp > 2){ t = t.slice(0, dp + 2); conf = Math.min(conf, 0.7); }   // trimmed → always checked   // the farm writes one decimal: more = a line sliver
  var v = parseFloat(t.charAt(0) === '.' ? '0' + t : t);
  if(isNaN(v)) return {v:null, text:t, conf:0};
  if(unit !== 'g' && v > maxKg && t.indexOf('.') < 0 && t.length === 2){ v = +(t.charAt(0) + '.' + t.charAt(1)); conf = Math.min(conf, 0.6); }   // kg pages only   // "12" → 1.2 (point not seen)
  if(v > maxKg) conf = Math.min(conf, 0.3);
  return {v:v, text:String(v), conf:conf};
}
function daPaperSize(pcs){ var p = pcs.filter(function(x){ return !x.dot; })[0]; if(!p) return null; if(p.left) p = p.left;
  var best = 1; [2, 3].forEach(function(k){ if(p.P[k] > p.P[best]) best = k; }); var s = p.P[1] + p.P[2] + p.P[3]; return {v:String(best), conf:s > 0 ? p.P[best] / s * Math.min(1, s * 1.3) : 0}; }
function daPaperDead(pcs){ var ds = pcs.filter(function(x){ return !x.dot && x.h >= 16 && !x.edge; }); if(!ds.length) return null;   // specks / pieces poking in from the next cell are not counts
  if(ds.length === 3) ds = [ds[0], ds[2]];   // "2+1": the middle mark is the plus
  var good = ds.filter(function(x){ return x.p >= 0.6; }), sum = good.reduce(function(a, x){ return a + x.d; }, 0), conf = good.length ? Math.min.apply(null, good.map(function(x){ return x.p; })) : 0;
  // dead counts are few per sheet and matter: from the old paper they are always confirmed by a person (yellow)
  return {v:sum, text:good.map(function(x){ return x.d; }).join('+'), conf:Math.min(0.8, good.length === ds.length ? conf : 0.5)}; }
// whole page → [{label, meals:[{v,conf}], size, dead, total}]
function daPaperPrev(unit, date){   // the tank's latest feed record in the week before (size + amount)
  var best = null; (daTxByUnit()[unit] || []).forEach(function(t){ if(t.type !== 'feeding' || t.deleted || t.date >= date || daDaysBetween(t.date, date) > 7) return; if(!best || t.date > best.date) best = t; });
  return best ? {size:String(best.size || daSizeOf(best.feed) || ''), kg:parseFloat(best.kg) || 0} : null;
}
function daPaperRead(I, farm, date){
  var tpl = daPaperTemplate(farm); if(!tpl) return {err:'الورقة العادية متعرّفة لـ ' + Object.keys(DA_PAPER_TPL).join(' و ') + ' بس'};
  var best = null;   // which page of the form is this? the one whose columns and rows fit best
  tpl.pages.forEach(function(pg, k){ var G = daPaperGrid(I, pg); if(!G.err && (!best || G.score > best.G.score)) best = {G:G, pg:pg, k:k}; });
  if(!best) return daPaperGrid(I, tpl.pages[0]);
  var G = best.G, page = best.pg, CW = 96, CH = 40, out = [], byLabel = {}, fac = page.unit === 'g' ? 1000 : 1;
  daSheetRowsFor(farm).forEach(function(x){ byLabel[x.label] = x; });
  page.halves.forEach(function(half){ half.labels.forEach(function(label, r){
    var lab = label && byLabel[label]; if(!lab) return; var c0 = half.c0, row = {unit:lab.unit, label:lab.label, meals:[]};
    for(var m = 0; m < half.meals; m++) row.meals.push(daPaperMeal(daPaperPieces(daPaperCell(I, G, r, c0 + 1 + m, CW, CH), CW, CH), half.maxV || page.maxV, page.unit));
    row.size = daPaperSize(daPaperPieces(daPaperCell(I, G, r, c0 + 1 + half.meals, CW, CH), CW, CH));
    var prev = date ? daPaperPrev(lab.unit, date) : null;   // pellet size rarely changes: yesterday's wins unless the paper clearly says otherwise
    if(prev && prev.size) row.size = {v:prev.size, conf:!row.size || row.size.v === prev.size ? 0.95 : 0.6, prior:true, read:row.size ? row.size.v : ''};
    row.dead = daPaperDead(daPaperPieces(daPaperCell(I, G, r, c0 + 2 + half.meals, CW, CH), CW, CH));
  var cnt = {}; row.meals.forEach(function(x){ if(x && x.v !== null && x.conf >= 0.85) cnt[x.v] = (cnt[x.v] || 0) + 1; });
    var ks = Object.keys(cnt).sort(function(a, b){ return cnt[b] - cnt[a]; }), maj = ks[0];
    if(ks.length > 1 && cnt[ks[1]] === cnt[ks[0]]){ row.meals.forEach(function(x){ if(x) x.conf = Math.min(x.conf, 0.5); }); maj = undefined; }   // a tie: no majority, check them all
    if(maj !== undefined && cnt[maj] >= 2) row.meals.forEach(function(x, k){   // the farm feeds the same amount each meal: unclear meals take the row's value, in yellow
      if(x && String(x.v) !== String(+maj)){ if(x.conf < 0.85) row.meals[k] = {v:+maj, text:String(+maj), conf:0.6, guess:true}; else x.conf = Math.min(x.conf, 0.5); } });
    var got = row.meals.filter(Boolean); row.total = got.length ? {v:+got.reduce(function(a, x){ return a + (x.v || 0); }, 0).toFixed(3), conf:Math.min.apply(null, got.map(function(x){ return x.conf; }))} : null;
    if(prev && prev.kg > 0 && row.total && row.total.v > 0 && (row.total.v > prev.kg * fac * 1.6 || row.total.v < prev.kg * fac / 1.6)) row.total.conf = Math.min(row.total.conf, 0.5);   // same unit as the page   // far from yesterday → check
    // read EXACTLY yesterday's amount: misreads don't land on the same number by chance → trusted (amounts rarely change day to day)
    if(prev && prev.kg > 0 && row.total && Math.abs(row.total.v - prev.kg * fac) < 1e-6 * fac && row.meals.every(function(m){ return !m || m.v !== null; })){
      row.total.conf = 0.95; row.total.sameAsYesterday = true; row.meals.forEach(function(m){ if(m) m.conf = Math.max(m.conf, 0.9); }); }
    out.push(row); }); });
  // safety: if most row lines were not seen in the photo (the grid is mostly guessed), nothing is trusted — every cell yellow
  var weak = G.rowFit !== undefined && G.rowFit < 0.45;
  // an "empty" cell may just be a misplaced grid: check it too
  if(weak) out.forEach(function(r){ r.meals = r.meals.map(function(m){ return m ? Object.assign(m, {conf:Math.min(m.conf, 0.5)}) : {v:null, text:'', conf:0}; }); if(r.total) r.total.conf = Math.min(r.total.conf, 0.5); if(r.size) r.size.conf = Math.min(r.size.conf, 0.6); });
  return {rows:out, grid:G, page:best.k, unit:page.unit, weak:weak};
}
function daSheetRowsFor(farm){   // the paper lists the farm's tanks in order (1.1, 1.2 … 12.4)
  return _txLiveRows().concat([]).filter(function(r){ return (r.farm === farm || String(r.unit).indexOf(farm + '.') === 0) && daTankNo(r.unit); })
    .map(function(r){ return {unit:r.unit, label:daTankNo(r.unit).label, no:daTankNo(r.unit)}; }).sort(function(a, b){ return a.no.s - b.no.s || a.no.t - b.no.t; });
}
function daPaperAsPage(P){   // same shape as a printed-sheet page, so the screen is filled the same way
  return {paper:true, weak:!!P.weak, date:null, rows:P.rows.map(function(r){ return {unit:r.unit, fast:false,
    meals:r.meals.map(function(m){ return !m ? null : {text:m.v === null ? '' : String(m.v), conf:m.v === null ? 0 : m.conf}; }),
    size:r.size ? {v:r.size.v, conf:r.size.conf} : null, dead:r.dead && r.dead.v ? [{text:r.dead.text || String(r.dead.v), conf:r.dead.conf}] : []}; })};
}
