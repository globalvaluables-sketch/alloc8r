// Alloc8r AI Chat — Netlify Serverless Function
// This keeps your Anthropic API key secret on the server side.
// Deploy this file to: netlify/functions/chat.js
//
// In your Netlify dashboard → Site settings → Environment variables, add:
//   ANTHROPIC_API_KEY = sk-ant-xxxxxxxxxxxxxxxx

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
- They can secure rare allocations like Lexus GX 550, TRD Pro trucks, etc. in 4–12 weeks
- Based in Vancouver, BC — serve all of Canada
- Free 30-minute consultation with zero pressure

When a visitor gives you their contact info, end your message with this exact JSON on its own line (the system will parse it, the user won't see it):
LEAD_CAPTURED:{"name":"[their name]","contact":"[their email or phone]","vehicle":"[vehicle they mentioned or 'not specified']","timeline":"[their timeline or 'not specified']"}

Keep responses concise — 2-4 sentences max unless they ask something that needs more detail. No bullet points or headers, just natural conversation.`;

exports.handler = async function(event, context) {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { messages } = JSON.parse(event.body);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages: messages
      })
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    const rawText = data.content[0].text;

    // Parse lead capture signal
    let leadData = null;
    let displayText = rawText;
    const leadMatch = rawText.match(/LEAD_CAPTURED:(\{.*?\})/);
    if (leadMatch) {
      try {
        leadData = JSON.parse(leadMatch[1]);
        displayText = rawText.replace(/LEAD_CAPTURED:\{.*?\}/, '').trim();
      } catch(e) {}
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ text: displayText, lead: leadData })
    };

  } catch (err) {
    console.error('Chat function error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Something went wrong. Please try again.' })
    };
  }
};
