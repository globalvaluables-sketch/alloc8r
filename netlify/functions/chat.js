const https = require('https');

const SYSTEM_PROMPT = `You are Kai, a sharp and friendly assistant for Alloc8r — Vancouver's premium car broker service. Alloc8r helps Canadian buyers skip dealership games, avoid hidden markup, and secure hard-to-find vehicle allocations like the Lexus GX 550.

Your personality: Confident, warm, knowledgeable. Like a sharp friend who knows everything about the car industry.

Your job:
1. Have a natural conversation to find out if Alloc8r is a good fit
2. Gently uncover: their timeline (buying within 3 months?), their target vehicle, and if they're open to a broker fee
3. Once you have all three, ask for their name and contact info (email or phone)

Key facts about Alloc8r:
- Services from free (deal audit) to $2,500 (full concierge)
- Average client savings: $3,500+ per vehicle
- Secure rare allocations like Lexus GX 550, Land Cruiser, Porsche 911 in 4-12 weeks
- Based in Vancouver, BC, serve all of Canada
- Free 30-minute consultation, no pressure

When a visitor gives contact info, end your message with this on its own line:
LEAD_CAPTURED:{"name":"NAME","contact":"CONTACT","vehicle":"VEHICLE","timeline":"TIMELINE"}

Keep replies to 2-4 sentences. Be conversational, not salesy.`;

function callAnthropic(apiKey, messages) {
  return new Promise(function(resolve, reject) {
    var body = JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: messages
    });

    var options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    var req = https.request(options, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        resolve({ status: res.statusCode, raw: data });
      });
    });

    req.on('error', function(e) { reject(e); });
    req.write(body);
    req.end();
  });
}

exports.handler = async function(event, context) {
  var headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('MISSING: ANTHROPIC_API_KEY not set');
    return { statusCode: 500, headers: headers, body: JSON.stringify({ error: 'API key not configured' }) };
  }

  var messages;
  try {
    messages = JSON.parse(event.body).messages;
  } catch(e) {
    return { statusCode: 400, headers: headers, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  var result;
  try {
    result = await callAnthropic(process.env.ANTHROPIC_API_KEY, messages);
  } catch(e) {
    console.error('Network error:', e.message);
    return { statusCode: 500, headers: headers, body: JSON.stringify({ error: 'Network error: ' + e.message }) };
  }

  console.log('Anthropic status:', result.status);
  console.log('Anthropic raw:', result.raw.substring(0, 300));

  var parsed;
  try {
    parsed = JSON.parse(result.raw);
  } catch(e) {
    console.error('Parse error:', result.raw);
    return { statusCode: 500, headers: headers, body: JSON.stringify({ error: 'Could not parse AI response' }) };
  }

  if (result.status !== 200) {
    var errMsg = parsed.error && parsed.error.message || 'unknown error';
    console.error('Anthropic error:', result.status, errMsg);
    return { statusCode: 500, headers: headers, body: JSON.stringify({ error: errMsg }) };
  }

  var rawText = parsed.content[0].text;
  var leadData = null;
  var displayText = rawText;
  var leadMatch = rawText.match(/LEAD_CAPTURED:(\{[^}]+\})/);
  if (leadMatch) {
    try {
      leadData = JSON.parse(leadMatch[1]);
      displayText = rawText.replace(/LEAD_CAPTURED:\{[^}]+\}/, '').trim();
    } catch(e) {}
  }

  return {
    statusCode: 200,
    headers: headers,
    body: JSON.stringify({ text: displayText, lead: leadData })
  };
};
