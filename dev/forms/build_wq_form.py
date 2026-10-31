# Builds the photo-readable revision of the farm's own Daily Testing Log (Word), from the farm's original .docx:
# adds 4 corner marks, digit boxes in Temp/pH/DO for every section row, date boxes in the header, one instruction line.
# Everything else (logo, title, document code, columns, acceptance criteria, signatures) is left exactly as it is.
# usage: python3 build_wq_form.py original.docx out.docx
import re, struct, zlib, sys, os, shutil, subprocess, tempfile
src, dst = sys.argv[1], sys.argv[2]
tmp = tempfile.mkdtemp(); un = os.path.join(tmp, 'un')
subprocess.run(['unzip', '-q', src, '-d', un], check=True)
for root, dirs, files in os.walk(un):
    for f in files:
        if os.path.islink(os.path.join(root, f)): os.remove(os.path.join(root, f))
subprocess.run(['python', '/mnt/skills/public/docx/scripts/merge_runs.py', un], capture_output=True)
X = os.path.join(un, 'word/document.xml'); x = open(X, encoding='utf-8').read()
def png(w, h):
    raw = b''.join(b'\x00' + b'\x00' * w for _ in range(h))
    ch = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + ch(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 0, 0, 0, 0)) + ch(b'IDAT', zlib.compress(raw)) + ch(b'IEND', b'')
open(os.path.join(un, 'word/media/mark.png'), 'wb').write(png(16, 16))
R = os.path.join(un, 'word/_rels/document.xml.rels'); rels = open(R, encoding='utf-8').read()
if 'rIdMark' not in rels:
    rels = rels.replace('</Relationships>', '<Relationship Id="rIdMark" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/mark.png"/></Relationships>')
    open(R, 'w', encoding='utf-8').write(rels)
B = 'w:val="single" w:sz="6" w:space="0" w:color="444444"'
def boxes(spec, bw=300, dw=100, bh=400, jc='center', sep='.'):
    cols = [bw if c == 'b' else dw for c in spec]; cells = ''
    for c, wd in zip(spec, cols):
        if c == 'b':
            cells += f'<w:tc><w:tcPr><w:tcW w:w="{wd}" w:type="dxa"/><w:tcBorders><w:top {B}/><w:left {B}/><w:bottom {B}/><w:right {B}/></w:tcBorders></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr></w:p></w:tc>'
        else:
            cells += (f'<w:tc><w:tcPr><w:tcW w:w="{wd}" w:type="dxa"/><w:tcBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/></w:tcBorders><w:vAlign w:val="bottom"/></w:tcPr>'
                      f'<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="24"/></w:rPr><w:t>{sep}</w:t></w:r></w:p></w:tc>')
    grid = ''.join(f'<w:gridCol w:w="{w}"/>' for w in cols)
    return (f'<w:tbl><w:tblPr><w:tblW w:w="{sum(cols)}" w:type="dxa"/><w:jc w:val="{jc}"/><w:tblLayout w:type="fixed"/>'
            f'<w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar>'
            f'<w:tblLook w:val="0000"/></w:tblPr><w:tblGrid>{grid}</w:tblGrid><w:tr><w:trPr><w:trHeight w:val="{bh}" w:hRule="exact"/><w:jc w:val="{jc}"/></w:trPr>{cells}</w:tr></w:tbl>')
TAIL = '<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="40" w:lineRule="exact"/></w:pPr></w:p>'
# end of the MAIN table, located BEFORE any boxes are inserted (first </w:tbl> after the acceptance row)
main_end_marker = x.find('</w:tbl>', x.find('Acceptance Criteria'))
x = x[:main_end_marker] + '<!--MAINEND-->' + x[main_end_marker:]
specs = ['bb.b', 'b.bb', 'bb.b']   # Temp [ ][ ].[ ] · pH [ ].[ ][ ] · DO [ ][ ].[ ]
rows = sorted(set(re.findall(r'>S-(\d\d)<', x)))
for s in rows:
    i = x.find(f'>S-{s}<'); r0 = x.rfind('<w:tr ', 0, i); r1 = x.find('</w:tr>', i) + 7; row = x[r0:r1]
    tcs = list(re.finditer(r'<w:tc>.*?</w:tc>', row, re.S)); new = row
    for k, spec in enumerate(specs):
        tc = tcs[1 + k].group(0); p0 = tc.find('<w:p '); new = new.replace(tc, tc[:p0] + boxes(spec) + TAIL + '</w:tc>', 1)
    new = re.sub(r'<w:trHeight w:val="(\d+)"/>', r'<w:trHeight w:val="\1" w:hRule="exact"/>', new)
    x = x[:r0] + new + x[r1:]
def anchor(i, xmm, ymm, s=7):
    E = 36000
    return (f'<w:r><w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="{251660000 + i}" behindDoc="0" locked="1" layoutInCell="0" allowOverlap="1">'
            f'<wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="page"><wp:posOffset>{int(xmm * E)}</wp:posOffset></wp:positionH><wp:positionV relativeFrom="page"><wp:posOffset>{int(ymm * E)}</wp:posOffset></wp:positionV>'
            f'<wp:extent cx="{s * E}" cy="{s * E}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/><wp:docPr id="{900 + i}" name="ReadMark{i}"/><wp:cNvGraphicFramePr/>'
            f'<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">'
            f'<pic:nvPicPr><pic:cNvPr id="{900 + i}" name="mark{i}.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdMark"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>'
            f'<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="{s * E}" cy="{s * E}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r>')
marks = ''.join(anchor(i, px, py) for i, (px, py) in enumerate([(8, 8), (195, 8), (8, 282), (195, 282)]))
instr = ('<w:p><w:pPr><w:spacing w:before="100" w:after="20"/><w:jc w:val="center"/></w:pPr>' + marks +
         '<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Arial"/><w:sz w:val="16"/><w:color w:val="444444"/></w:rPr><w:t xml:space="preserve">One digit per box — the decimal point is printed · Leave a box empty if not needed</w:t></w:r></w:p>'
         '<w:p><w:pPr><w:bidi/><w:spacing w:before="0" w:after="60"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Arial"/><w:rtl/><w:sz w:val="17"/><w:szCs w:val="17"/><w:color w:val="444444"/></w:rPr><w:t xml:space="preserve">رقم واحد في كل مربع — العلامة العشرية مطبوعة · سيب المربع فاضي لو مش محتاجه</w:t></w:r></w:p>')
x = x.replace('<!--MAINEND--></w:tbl>', '</w:tbl>' + instr, 1)
open(X, 'w', encoding='utf-8').write(x)
H = os.path.join(un, 'word/header1.xml'); h = open(H, encoding='utf-8').read()
m = re.search(r'Date:\s*_+', h)
if m:
    i = m.start(); p0 = h.rfind('<w:p ', 0, i); p1 = h.find('</w:p>', i) + 6
    para = h[p0:p1].replace(m.group(0), 'Date:  ')
    db = boxes('bb-bb-bbbb', bw=230, dw=110, bh=330, jc='left', sep='-')
    lab = ('<w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:rPr><w:sz w:val="12"/><w:color w:val="666666"/></w:rPr>'
           '<w:t xml:space="preserve">  D   D        M   M        Y    Y    Y    Y</w:t></w:r></w:p>')
    h = h[:p0] + para + db + lab + h[p1:]
    open(H, 'w', encoding='utf-8').write(h)
if os.path.exists(dst): os.remove(dst)
subprocess.run(f'cd "{un}" && zip -Xqr "{os.path.abspath(dst)}" .', shell=True, check=True)
shutil.rmtree(tmp); print('built', dst, 'rows', len(rows))
