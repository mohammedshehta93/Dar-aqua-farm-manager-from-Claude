// Farm Manager — AI Worker
// • No API token anywhere: uses the Workers AI binding named "AI"
// • Answers only requests coming from the app's site
// • Answers only users who are signed in to the app (checked with Supabase)

const ALLOWED_ORIGINS = ['https://mohammedshehta93.github.io'];
const SUPABASE_URL = 'https://mjtxibdxqxrgykuyftsr.supabase.co';
const SUPABASE_PUBLIC_KEY = 'sb_publishable_ewZ1G10CJIIUcZHYaEd22w_ud573IW3'; // public by design
// Tried in order; a retired model is skipped automatically.
// To force a model without editing code: Settings → Variables → add MODEL = <model name>
const MODELS = [
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  '@cf/meta/llama-3.1-8b-instruct-fast',
  '@cf/meta/llama-3.1-8b-instruct',
  '@cf/mistralai/mistral-small-3.1-24b-instruct',
  '@cf/qwen/qwen2.5-coder-32b-instruct'
];

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = ALLOWED_ORIGINS.includes(origin);
    const cors = {
      'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Vary': 'Origin'
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return reply({ error: 'POST only' }, 405, cors);
    if (!allowed) return reply({ error: 'origin not allowed' }, 403, cors);

    const auth = request.headers.get('Authorization') || '';
    if (!auth.startsWith('Bearer ') || auth.length < 30) return reply({ error: 'sign in required' }, 401, cors);
    const who = await fetch(SUPABASE_URL + '/auth/v1/user', { headers: { apikey: SUPABASE_PUBLIC_KEY, Authorization: auth } });
    if (!who.ok) return reply({ error: 'session expired' }, 401, cors);

    let body;
    try { body = await request.json(); } catch (e) { return reply({ error: 'bad request' }, 400, cors); }
    const messages = (Array.isArray(body.messages) ? body.messages : []).slice(-12).map(function (m) {
      return { role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '').slice(0, 12000) };
    });
    if (!messages.length) return reply({ error: 'no question' }, 400, cors);

    const list = env.MODEL ? [env.MODEL].concat(MODELS) : MODELS;
    const maxTokens = Math.min(parseInt(body.max_tokens, 10) || 800, 1500);
    let lastErr = '';
    for (const model of list) {
      try {
        const out = await env.AI.run(model, { messages: messages, max_tokens: maxTokens });
        const text = out && (out.response || (out.choices && out.choices[0] && out.choices[0].message && out.choices[0].message.content));
        if (text) return reply({ result: { response: String(text) }, model: model }, 200, cors);
        lastErr = 'empty answer from ' + model;
      } catch (e) {
        lastErr = String((e && e.message) || e);   // retired / unknown model → try the next one
      }
    }
    return reply({ error: 'AI unavailable: ' + lastErr.slice(0, 200) }, 502, cors);
  }
};

function reply(obj, status, headers) {
  return new Response(JSON.stringify(obj), { status: status, headers: Object.assign({}, headers, { 'Content-Type': 'application/json' }) });
}
