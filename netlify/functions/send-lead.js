exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { transcript, leadSummary } = JSON.parse(event.body);

    // Format the email HTML
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; padding: 0; border-radius: 12px; overflow: hidden;">
        
        <div style="background: #0f172a; padding: 28px 32px;">
          <h1 style="color: #ffffff; font-size: 22px; margin: 0; font-weight: 700;">
            🚗 New Lead from Karley
          </h1>
          <p style="color: rgba(255,255,255,0.5); margin: 6px 0 0; font-size: 13px;">
            Alloc8r chatbot qualification — ${new Date().toLocaleString('en-CA', { timeZone: 'America/Vancouver' })} PT
          </p>
        </div>

        <div style="padding: 28px 32px; background: #ffffff;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 13px; width: 35%;">Name</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #0f172a; font-size: 14px; font-weight: 600;">${leadSummary.name || '—'}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 13px;">Phone</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #0f172a; font-size: 14px; font-weight: 600;">${leadSummary.phone || '—'}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 13px;">Vehicle Interested In</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #0f172a; font-size: 14px; font-weight: 600;">${leadSummary.car || '—'}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 13px;">Trade-In</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #0f172a; font-size: 14px;">${leadSummary.tradein || 'None'}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #64748b; font-size: 13px;">Timeline</td>
              <td style="padding: 10px 0; color: #0f172a; font-size: 14px;">${leadSummary.timeline || '—'}</td>
            </tr>
          </table>
        </div>

        <div style="padding: 0 32px 28px; background: #ffffff;">
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px;">
            <p style="color: #64748b; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 12px;">Full Chat Transcript</p>
            <div style="color: #374151; font-size: 13px; line-height: 1.7; white-space: pre-wrap;">${transcript || 'No transcript available.'}</div>
          </div>
        </div>

        <div style="background: #f8fafc; padding: 18px 32px; border-top: 1px solid #e2e8f0;">
          <p style="color: #94a3b8; font-size: 11px; margin: 0; text-align: center;">Sent automatically by Karley · Alloc8r · alloc8r.ca</p>
        </div>

      </div>
    `;

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Karley at Alloc8r <karley@alloc8r.ca>',
        to: [process.env.LEAD_EMAIL || 'jerick@alloc8r.ca'],
        subject: `New Lead: ${leadSummary.name || 'Unknown'} — ${leadSummary.car || 'Vehicle TBD'}`,
        html,
      }),
    });

    if (!emailRes.ok) {
      const err = await emailRes.text();
      console.error('Resend error:', err);
      return { statusCode: 500, body: JSON.stringify({ error: 'Email failed to send.' }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: true }),
    };
  } catch (err) {
    console.error('send-lead error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
