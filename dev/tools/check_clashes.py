# Usage: python3 dev/tools/check_clashes.py dev/modules/x.js [index.html]
# Lists top-level names in a NEW module that already exist in index.html. The merge tool silently replaces same-name
# functions ("replaced: …"), which is only right when the module is an intended new version of that function.
import re, sys
mod = open(sys.argv[1], encoding='utf-8').read()
app = open(sys.argv[2] if len(sys.argv) > 2 else 'index.html', encoding='utf-8').read()
app = app.replace(mod, '')   # ignore the module itself if it was merged before
names = set(re.findall(r'^(?:async\s+)?function (\w+)\(', mod, re.M)) | set(re.findall(r'^var (\w+)\s*=', mod, re.M))
clash = sorted(n for n in names if re.search(r'(?:^|\n)\s*(?:async\s+)?function ' + n + r'\(|(?:^|\n)var ' + n + r'\s*=', app))
print('clashes: ' + (', '.join(clash) if clash else 'none')); sys.exit(1 if clash else 0)
