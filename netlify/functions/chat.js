const https = require('https');

const SYSTEM_PROMPT = `You are Kai, a sharp and friendly assistant for Alloc8r — Vancouver's premium car broker service. Alloc8r helps Canadian buyers skip dealership games, avoid hidden markup, and secure hard-to-find vehicle allocations (like the Lexus GX 550).

Your personality: Confident, warm, and knowledgeable. You sound like a sharp friend who happens to know everything about the car industry — not a pushy salesperson, and not a generic chatbot.

Your job is to:
1. Welcome the visitor and genuinely help them figure out if Alloc8r is the right fit
2. Have a natural conversation — don't interrogate, just chat
3. Gently uncover three things through conversation (don't ask all at once):
   - TIMELINE: Are they looking to buy within the next 3 months?
   - VEHICLE: Do they have a specific car or trim in mind?
   - FEE OPENNESS: Are they open to a flat broker fee (ranging from free to $2,500 CAD depending on the service tier) in exchange for saving thousands?
4. Once you have a good read on all three AND they seem like a real buyer, ask for their name and best contact method (email or phone)
5. Reassure them: their info only goes to the Alloc8r team, no dealer ever sees it

Key knowledge:
- Alloc8r's services range from free (deal audit, split savings 50/50) to $2,500 flat fee (full concierge)
- They save clients $3,500+ on average per vehicle
- They can secure rare allocations like Lexus GX 550, TRD Pro trucks, Land Cruiser, Porsche 911 etc. in 4-12 weeks
- Based in Vancouver, BC — serve all of Canada
- Free 30-minute consultation with zero pressure

When a visitor gives you their contact info, end your message with this exact JSON on its own line:
LEAD_CAPTURED:{"name":"[their name]","contact":"[their email or phone]","vehicle":"[vehicle they mentioned or not specified]","timeline":"[their timeline or not specified]"}

Keep responses concise — 2-4 sentences max unless they ask something that needs more detail. No bullet points or headers, just natural conversation.`;

function callAnthropic(apiKey, messages) {
  return new Promise(function(resolve, reject) {
    var body = JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
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
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch(e) {
          reject(new Error('Failed to parse response: ' + data));
        }
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

  try {
    var parsed = JSON.parse(event.body);
    var messages = parsed.messages;

    if (!process.env.ANTHROPIC_API_KEY) {
      return { statusCode: 500, headers: headers, body: JSON.stringify({ error: 'API key not configured' }) };
    }

    var result = await callAnthropic(process.env.ANTHROPIC_API_KEY, messages);

    if (result.status !== 200) {
      console.error('Anthropic API error:', result.status, JSON.stringify(result.body));
      return { statusCode: 500, headers: headers, body: JSON.stringify({ error: 'AI service error: ' + result.status }) };
    }

    var rawText = result.body.content[0].text;

    // Parse lead capture signal
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

  } catch(err) {
    console.error('Function error:', err.message);
    return {
      statusCode: 500,
      headers: headers,
      body: JSON.stringify({ error: 'Server error: ' + err.message })
    };
  }
};
