// Usage: node dev/tools/merge_module.js <module.js> [index.html]
// Inserts a JS module before the "// ── Init ──" marker of the main inline script,
// removes older duplicate top-level function declarations (the LAST one wins),
// and syntax-checks the result. Requires: npm install acorn
const fs = require('fs'), acorn = require('acorn');
const mod = process.argv[2], F = process.argv[3] || 'index.html';
let h = fs.readFileSync(F, 'utf8');
const i = h.indexOf('// ── Init ──'); if(i < 0) throw new Error('Init marker not found');
h = h.slice(0, i) + fs.readFileSync(mod, 'utf8') + '\n' + h.slice(i);
const re = /<script(\s[^>]*)?>/g; let m, b = null;
while((m = re.exec(h))){ if(m[1] && /src=/.test(m[1])) continue; const s = m.index + m[0].length, e = h.indexOf('</script>', s); if(!b || e - s > b.e - b.s) b = {s, e}; }
let js = h.slice(b.s, b.e); const by = {};
acorn.parse(js, {ecmaVersion:'latest'}).body.filter(n => n.type === 'FunctionDeclaration').forEach(n => (by[n.id.name] = by[n.id.name] || []).push(n));
const rm = []; Object.keys(by).forEach(k => { if(by[k].length > 1) by[k].slice(0, -1).forEach(n => rm.push([n.start, n.end, k])); });
rm.sort((x, y) => y[0] - x[0]).forEach(([s, e]) => { if(js[e] === '\n') e++; js = js.slice(0, s) + js.slice(e); });
acorn.parse(js, {ecmaVersion:'latest'});
fs.writeFileSync(F, h.slice(0, b.s) + js + h.slice(b.e));
console.log('merged', mod, '| replaced:', rm.map(r => r[2]).join(', ') || 'none');
