# int8 per-output-channel quantization → base64, plus a float reference on 200 test digits for JS parity checks
import pickle, gzip, base64, json, numpy as np
S = pickle.load(open('state.pkl', 'rb')); p = {k: np.asarray(v, np.float32) for k, v in S['p'].items()}
out = {}
for k in ['c1', 'c2', 'd1', 'd2']:
    w = p[k]; flat = w.reshape(-1, w.shape[-1]); sc = np.abs(flat).max(0) / 127 + 1e-12
    q = np.clip(np.round(flat / sc), -127, 127).astype(np.int8)
    out[k] = {'shape': list(w.shape), 'q': base64.b64encode(q.tobytes()).decode(), 's': [float(x) for x in sc]}
for k in ['b1', 'b2', 'e1', 'e2']: out[k] = [round(float(x), 6) for x in p[k]]
json.dump(out, open('model.json', 'w'), separators=(',', ':'))
# dequantized reference predictions in numpy (same math as the JS)
deq = {k: (np.frombuffer(base64.b64decode(out[k]['q']), np.int8).reshape(-1, out[k]['shape'][-1]).astype(np.float32) * np.array(out[k]['s'], np.float32)).reshape(out[k]['shape']) for k in ['c1', 'c2', 'd1', 'd2']}
def conv(x, w, b):
    H, W, C = x.shape; xp = np.pad(x, ((1, 1), (1, 1), (0, 0))); o = np.zeros((H, W, w.shape[3]), np.float32)
    for i in range(3):
        for j in range(3): o += xp[i:i + H, j:j + W, :] @ w[i, j]
    return o + b
def pool(x): H, W, C = x.shape; return x.reshape(H // 2, 2, W // 2, 2, C).max((1, 3))
def fwd(x):
    x = pool(np.maximum(conv(x[..., None], deq['c1'], np.array(out['b1'])), 0)); x = pool(np.maximum(conv(x, deq['c2'], np.array(out['b2'])), 0))
    x = np.maximum(x.reshape(-1) @ deq['d1'] + np.array(out['e1']), 0); return x @ deq['d2'] + np.array(out['e2'])
(_, _), (_, _), (te_x, te_y) = pickle.load(gzip.open('/tmp/mnist.pkl.gz'), encoding='latin1')
TX = te_x.reshape(-1, 28, 28).astype(np.float32)
acc = np.mean([np.argmax(fwd(TX[i])) == te_y[i] for i in range(2000)])
ref = [{'x': base64.b64encode((TX[i] * 255).round().astype(np.uint8).tobytes()).decode(), 'y': int(te_y[i]), 'logits': [round(float(v), 4) for v in fwd(TX[i])]} for i in range(200)]
json.dump(ref, open('ref.json', 'w'))
import os; print('int8 accuracy on 2000 test digits:', acc, '· model.json', os.path.getsize('model.json'), 'bytes')
