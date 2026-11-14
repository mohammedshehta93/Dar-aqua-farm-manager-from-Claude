# Every module's functions, top-level vars and wrapper blocks must be in index.html (run before every push).
# Written after a hand edit that removed functions also cut the NEXT module's header vars (2026-11-09).
import re, glob, sys
h = open(sys.argv[1] if len(sys.argv) > 1 else 'index.html', encoding='utf-8').read(); bad = []
for f in sorted(glob.glob('dev/modules/*.js')):
    s = open(f, encoding='utf-8').read(); n = f.split('/')[-1]
    for v in re.findall(r'^(?:async )?function (\w+)\(', s, re.M):
        if not re.search(r'function ' + v + r'\(', h): bad.append((n, 'function ' + v))
    for v in re.findall(r'^var (\w+)', s, re.M):
        if not re.search(r'\bvar ' + v + r'\b', h): bad.append((n, 'var ' + v))
    for w in re.findall(r'^if\(!window\.(_da\w+)\)', s, re.M):
        if w not in h: bad.append((n, 'block ' + w)); continue
        # the block's CONTENT must match too (2026-11-14: a stale block passed the name check and hid a fix)
        m0 = re.search(r'^if\(!window\.' + w + r'\)\s*\{', s, re.M); a = m0.start(); e = (s + '\n').find('\n}\n', a); body = s[a:e if e >= 0 else len(s)]
        ia = h.find(body)
        if ia < 0: bad.append((n, 'block ' + w + ' differs from the module'))
print('modules complete in the app' if not bad else 'MISSING: ' + str(bad)); sys.exit(1 if bad else 0)
