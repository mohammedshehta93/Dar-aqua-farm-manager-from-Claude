# Small CNN for handwritten digits in printed boxes (on-device sheet reading). Trained on MNIST with augmentation that
# mimics phone photos of boxed digits: rotation/shear/scale/shift, thin/thick pens, blur, noise, box-border remnants.
import gzip, pickle, sys, time, numpy as np, jax, jax.numpy as jnp
from scipy import ndimage as ndi
rng = np.random.default_rng(int(sys.argv[2]) if len(sys.argv) > 2 else 0)
(tr_x, tr_y), (va_x, va_y), (te_x, te_y) = pickle.load(gzip.open('/tmp/mnist.pkl.gz'), encoding='latin1')
X = np.concatenate([tr_x, va_x]).reshape(-1, 28, 28).astype(np.float32); Y = np.concatenate([tr_y, va_y])
TX = te_x.reshape(-1, 28, 28).astype(np.float32); TY = te_y

def augment(img):
    a = np.deg2rad(rng.uniform(-14, 14)); sh = rng.uniform(-0.25, 0.25); s = rng.uniform(0.82, 1.12)
    M = np.array([[np.cos(a), -np.sin(a) + sh], [np.sin(a), np.cos(a)]]) / s
    c = np.array([14, 14]); off = c - M @ c + rng.uniform(-2, 2, 2)
    o = ndi.affine_transform(img, M, offset=off, order=1, mode='constant')
    r = rng.random()
    if r < 0.25: o = ndi.grey_erosion(o, size=(2, 2))           # thin pen
    elif r < 0.5: o = ndi.grey_dilation(o, size=(2, 2))         # thick pen
    if rng.random() < 0.3: o = ndi.gaussian_filter(o, rng.uniform(0.3, 0.9))
    if rng.random() < 0.35:                                      # box border remnant on an edge
        e = rng.integers(4); w = rng.integers(1, 3); v = rng.uniform(0.4, 1)
        if e == 0: o[:w, :] = np.maximum(o[:w, :], v)
        elif e == 1: o[-w:, :] = np.maximum(o[-w:, :], v)
        elif e == 2: o[:, :w] = np.maximum(o[:, :w], v)
        else: o[:, -w:] = np.maximum(o[:, -w:], v)
    o = o + rng.normal(0, rng.uniform(0, 0.08), o.shape)
    return np.clip(o, 0, 1).astype(np.float32)

def init(key):
    k = jax.random.split(key, 4); he = lambda k, s, fan: jax.random.normal(k, s) * np.sqrt(2 / fan)
    return {'c1': he(k[0], (3, 3, 1, 16), 9), 'b1': jnp.zeros(16), 'c2': he(k[1], (3, 3, 16, 32), 144), 'b2': jnp.zeros(32),
            'd1': he(k[2], (7 * 7 * 32, 64), 1568), 'e1': jnp.zeros(64), 'd2': he(k[3], (64, 10), 64), 'e2': jnp.zeros(10)}
def conv(x, w, b): return jax.lax.conv_general_dilated(x, w, (1, 1), 'SAME', dimension_numbers=('NHWC', 'HWIO', 'NHWC')) + b
def pool(x): return jax.lax.reduce_window(x, -jnp.inf, jax.lax.max, (1, 2, 2, 1), (1, 2, 2, 1), 'VALID')
def fwd(p, x, drop=None):
    x = pool(jax.nn.relu(conv(x[..., None], p['c1'], p['b1'])))
    x = pool(jax.nn.relu(conv(x, p['c2'], p['b2'])))
    x = jax.nn.relu(x.reshape(x.shape[0], -1) @ p['d1'] + p['e1'])
    if drop is not None: x = x * drop
    return x @ p['d2'] + p['e2']
def loss(p, x, y, drop): return -jnp.mean(jnp.sum(jax.nn.log_softmax(fwd(p, x, drop)) * jax.nn.one_hot(y, 10), -1))
@jax.jit
def step(p, m, v, t, x, y, drop, lr):
    g = jax.grad(loss)(p, x, y, drop)
    m = jax.tree.map(lambda a, b: 0.9 * a + 0.1 * b, m, g); v = jax.tree.map(lambda a, b: 0.999 * a + 0.001 * b * b, v, g)
    p = jax.tree.map(lambda w, a, b: w - lr * (a / (1 - 0.9 ** t)) / (jnp.sqrt(b / (1 - 0.999 ** t)) + 1e-8), p, m, v)
    return p, m, v
pred = jax.jit(lambda p, x: jnp.argmax(fwd(p, x), -1))

state_f = '/home/claude/ocr/state.pkl'
try: S = pickle.load(open(state_f, 'rb'))
except FileNotFoundError: S = {'p': init(jax.random.PRNGKey(0)), 'epoch': 0, 't': 0}; S['m'] = jax.tree.map(jnp.zeros_like, S['p']); S['v'] = jax.tree.map(jnp.zeros_like, S['p'])
budget = float(sys.argv[1]) if len(sys.argv) > 1 else 200; t0 = time.time()
while time.time() - t0 < budget:
    e = S['epoch']; lr = 1e-3 if e < 6 else (4e-4 if e < 10 else 1.5e-4)
    idx = rng.permutation(len(X))[:20000]                        # 20k fresh augmented samples per "epoch"
    xa = np.stack([augment(X[i]) for i in idx]); ya = Y[idx]
    for b in range(0, len(idx), 128):
        S['t'] += 1; drop = (rng.random((len(xa[b:b + 128]), 64)) > 0.3).astype(np.float32) / 0.7
        S['p'], S['m'], S['v'] = step(S['p'], S['m'], S['v'], S['t'], xa[b:b + 128], ya[b:b + 128], drop, lr)
    S['epoch'] += 1
    clean = float(np.mean(np.concatenate([np.asarray(pred(S['p'], TX[i:i + 2000])) for i in range(0, 10000, 2000)]) == TY))
    taug = np.stack([augment(x) for x in TX[:3000]])
    hard = float(np.mean(np.asarray(pred(S['p'], taug)) == TY[:3000]))
    print(f"epoch {S['epoch']}: test clean {clean:.4f} · test photo-like {hard:.4f} · {time.time() - t0:.0f}s", flush=True)
    pickle.dump(jax.tree.map(np.asarray, S), open(state_f, 'wb'))
