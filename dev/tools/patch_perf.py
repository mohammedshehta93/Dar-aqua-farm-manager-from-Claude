# Opening: rewrite the device database only when old browser-storage records were merged into it.
import sys
F = sys.argv[1] if len(sys.argv) > 1 else 'index.html'
h = open(F, encoding='utf-8').read()
old = """  _txCache = arr; _txMem = arr;
  var saved = await idbPutNow('tx', arr);
  if(saved){ try{ localStorage.removeItem(TX_KEY); }catch(e){} }"""
new = """  _txCache = arr; _txMem = arr;
  if(!(Array.isArray(ls) && ls.length) && Array.isArray(stored)) return;   // nothing new to merge: no full rewrite at every opening
  var saved = await idbPutNow('tx', arr);
  if(saved){ try{ localStorage.removeItem(TX_KEY); }catch(e){} }"""
if h.count(old) != 1: sys.exit('PATCH FAILED: txStoreInit')
open(F, 'w', encoding='utf-8').write(h.replace(old, new)); print('patched', F)
