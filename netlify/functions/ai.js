exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST,OPTIONS'}, body: '' };
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) return { statusCode: 500, headers:{'Access-Control-Allow-Origin':'*'}, body: JSON.stringify({error:'ANTHROPIC_API_KEY not set'}) };
  try {
    const body = JSON.parse(event.body);
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {'Content-Type':'application/json','anthropic-version':'2023-06-01','x-api-key':API_KEY},
      body: JSON.stringify({model:body.model||'claude-sonnet-4-6',max_tokens:body.max_tokens||4000,messages:body.messages})
    });
    const data = await response.json();
    return { statusCode: response.status, headers: {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}, body: JSON.stringify(data) };
  } catch(err) {
    return { statusCode: 500, headers:{'Access-Control-Allow-Origin':'*'}, body: JSON.stringify({error:err.message}) };
  }
};
