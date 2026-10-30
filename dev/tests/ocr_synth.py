# Synthetic "phone photos" of filled printed sheets for e2e_ocr: real handwriting (MNIST TEST set — never used in
# training) written into the printed boxes, bubbles shaded, then perspective, rotation, uneven light, noise, blur, JPEG.
import gzip, pickle, io, numpy as np
from PIL import Image, ImageDraw, ImageFilter
PX = 6.0   # px per mm of the rendered page
(_, _), (_, _), (TX, TY) = pickle.load(gzip.open('/tmp/mnist.pkl.gz'), encoding='latin1')
TX = TX.reshape(-1, 28, 28)
BY = {d: np.where(TY == d)[0] for d in range(10)}

def write_digit(page, rng, d, box, ink):
    im = TX[rng.choice(BY[int(d)])]; ys, xs = np.where(im > 0.2); im = im[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    bw, bh = box['w'] * PX, box['h'] * PX; th = bh * rng.uniform(0.55, 0.78); sc = th / im.shape[0]; tw = max(2, im.shape[1] * sc)
    a = Image.fromarray((im * 255).astype(np.uint8)).resize((int(tw), int(th)), Image.BILINEAR)
    cx = box['x'] * PX + (bw - tw) / 2 + rng.uniform(-0.12, 0.12) * bw; cy = box['y'] * PX + (bh - th) / 2 + rng.uniform(-0.1, 0.1) * bh
    page.paste(Image.new('RGB', a.size, ink), (int(cx), int(cy)), a)

def fill_bubble(page, rng, c, ink):
    d = ImageDraw.Draw(page); r = c['r'] * PX * rng.uniform(0.75, 1.0); x, y = c['cx'] * PX + rng.uniform(-1, 1), c['cy'] * PX + rng.uniform(-1, 1)
    d.ellipse([x - r, y - r, x + r, y + r], fill=ink)

def put(page, rng, boxes, text, ink, dot=None):
    """text e.g. '1.2', '.8', '500', '3' — right-aligned in the integer part, like people write"""
    if dot is None: ip, fp = text, ''
    else: ip, fp = (text.split('.') + [''])[:2]
    n_int = len(boxes) if dot is None else dot + 1
    ib = boxes[:n_int][::-1]; fb = boxes[n_int:]
    for ch, b in zip(ip[::-1], ib): write_digit(page, rng, ch, b, ink)
    for ch, b in zip(fp, fb): write_digit(page, rng, ch, b, ink)

def photo(page, rng, strength=1.0):
    W, H = page.size; bg = Image.new('RGB', (int(W * 1.25), int(H * 1.18)), tuple(int(v) for v in rng.integers(40, 110, 3)))
    ox, oy = int(W * 0.12), int(H * 0.08); bg.paste(page, (ox, oy))
    src = np.array([[ox, oy], [ox + W, oy], [ox + W, oy + H], [ox, oy + H]], float)
    dst = src + rng.uniform(-1, 1, (4, 2)) * np.array([W, H]) * 0.045 * strength
    ang = np.deg2rad(rng.uniform(-6, 6) * strength); c0 = dst.mean(0); R = np.array([[np.cos(ang), -np.sin(ang)], [np.sin(ang), np.cos(ang)]])
    dst = (dst - c0) @ R.T + c0
    A = []; b = []
    for (x, y), (u, v) in zip(dst, src): A += [[x, y, 1, 0, 0, 0, -u * x, -u * y], [0, 0, 0, x, y, 1, -v * x, -v * y]]; b += [u, v]
    coef = np.linalg.solve(np.array(A), np.array(b))
    out = bg.transform(bg.size, Image.PERSPECTIVE, tuple(coef), Image.BILINEAR, fillcolor=(70, 70, 70))
    a = np.asarray(out).astype(np.float32) / 255
    gx = np.linspace(rng.uniform(0.7, 0.9), rng.uniform(0.95, 1.05), a.shape[1])[None, :, None]; gy = np.linspace(rng.uniform(0.85, 1.0), rng.uniform(0.9, 1.05), a.shape[0])[:, None, None]
    a = np.clip(a * gx * gy + rng.normal(0, 0.025, a.shape), 0, 1)
    out = Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(rng.uniform(0.3, 0.9)))
    buf = io.BytesIO(); out.save(buf, 'JPEG', quality=int(rng.integers(70, 88))); return buf.getvalue()
