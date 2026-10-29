// Usage: node dev/tools/update_functions.js dev/modules/x.js index.html
// Re-applies an ALREADY-MERGED module after editing it: every top-level `function NAME` of the module replaces the
// same-named function in index.html IN PLACE (exact AST ranges, so braces inside strings are safe). Non-function
// statements are not touched (re-merging would duplicate them) — change those with exact edits. A function that is new
// in the module is inserted right after the module function that precedes it (which must already be in index.html).
const fs = require('fs'), acorn = require('acorn');
const [modPath, appPath] = process.argv.slice(2);
const mod = fs.readFileSync(modPath, 'utf8'), html = fs.readFileSync(appPath, 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/); if(!m) throw new Error('main script not found');
const sStart = m.index + m[0].indexOf(m[1]), js = m[1];
const fns = src => { const out = {}; acorn.parse(src, {ecmaVersion:2022}).body.forEach(n => { if(n.type === 'FunctionDeclaration') (out[n.id.name] = out[n.id.name] || []).push([n.start, n.end]); }); return out; };
const mf = fns(mod), af = fns(js), reps = [], order = Object.keys(mf);
order.forEach((name, i) => {
  const [ms, me] = mf[name][mf[name].length - 1], txt = mod.slice(ms, me), a = af[name];
  if(a){ if(a.length !== 1) throw new Error(name + ' defined ' + a.length + 'x in app'); reps.push([a[0][0], a[0][1], txt, name]); return; }
  let j = i - 1; while(j >= 0 && !af[order[j]]) j--;
  if(j < 0) throw new Error('not in app and no earlier module function to anchor it: ' + name + ' (merge the module first)');
  const at = af[order[j]][0][1]; reps.push([at, at, '\n' + txt, name + ' (new)']);
});
reps.sort((x, y) => y[0] - x[0] || y[1] - x[1]);
let out = js; const changed = [];
for(const [s, e, txt, name] of reps){ if(out.slice(s, e) !== txt){ out = out.slice(0, s) + txt + out.slice(e); changed.push(name); } }
fs.writeFileSync(appPath, html.slice(0, sStart) + out + html.slice(sStart + js.length));
console.log('updated: ' + (changed.length ? changed.reverse().join(', ') : 'none'));
