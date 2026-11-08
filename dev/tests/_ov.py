import os, sys, json, base64; os.environ['E2E_PORT'] = '8848'; sys.path.insert(0, 'dev/tests')
src = open('dev/tests/e2e_paper_f2.py').read(); exec(src.split("with sync_playwright() as p:")[0].replace("os.environ['E2E_PORT'] = '8847'", ""))
PAGE = int(os.environ.get('PG', '1'))
with sync_playwright() as p:
    BROWSER = p.chromium.launch(); harness_browser[0] = BROWSER
    sb = MockSB(); sb.add_user('admin@example.com', 'admin123', role='admin', uid='u-admin')
    ctx, pg = new_page(p, sb); login(pg, 'admin@example.com', 'admin123'); pg.wait_for_function('() => !!window._cloudSyncDone', timeout=10000)
    pg.evaluate("() => { const i=document.createElement('input'); i.type='file'; i.id='t-p'; document.body.appendChild(i); }"); pg.set_input_files('#t-p', [os.path.join(D, f'fh2_page{PAGE}_synthetic.jpg')])
    png = pg.evaluate("""async (k) => { const I = await daOcrLoad(document.getElementById('t-p').files[0]); const G = daPaperGrid(I, DA_PAPER_TPL.F2.pages[k-1]);
      const cv=document.createElement('canvas'); cv.width=I.W; cv.height=I.H; const cx=cv.getContext('2d'); const id=cx.createImageData(I.W,I.H);
      for(let k=0;k<I.W*I.H;k++){ const v=I.g[k]*255; id.data[4*k]=v; id.data[4*k+1]=v; id.data[4*k+2]=v; id.data[4*k+3]=255; } cx.putImageData(id,0,0); cx.lineWidth=2;
      if(G.err) return G.err; cx.strokeStyle='red'; G.rows.forEach(f=>{ cx.beginPath(); cx.moveTo(0,f.b); cx.lineTo(I.W,f.a*I.W+f.b); cx.stroke(); });
      cx.strokeStyle='lime'; G.cols.forEach(f=>{ cx.beginPath(); cx.moveTo(f.b,0); cx.lineTo(f.a*I.H+f.b,I.H); cx.stroke(); }); return [I.W,I.H,cv.toDataURL('image/jpeg',0.7)]; }""", PAGE)
    if isinstance(png, str): print('ERR', png)
    else: open('/tmp/ov.jpg','wb').write(base64.b64decode(png[2].split(',')[1]))
