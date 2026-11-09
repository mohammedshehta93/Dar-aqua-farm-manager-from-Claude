// ══════════════════════════════════════════════════════════
//  ONE FCR RULE FOR THE WHOLE TOOL (owner, 2026-11-09)
// ══════════════════════════════════════════════════════════
// Feed ÷ weight gained — but only when the gain is REAL: a tank stocked today, never sampled since, has a "gain" that is
// rounding left over from same-day dead fish (e.g. 0.0000000000028 kg) and gave FCR = 317,901,150,167,329. Below 1 % of
// the starting biomass (and at least 0.1 kg) there is no FCR yet ("—"); above 50 it is not a feed conversion either.
function daFcrSafe(feed, gain, base){
  if(!(feed > 0) || !(gain > 0)) return null;
  if(gain < Math.max(0.1, (base || 0) * 0.01)) return null;
  var f = feed / gain; return f > 50 ? null : f;
}
