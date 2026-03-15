// api/generate.js — Vercel Serverless Function
// Gemini API key lives here on the server — never exposed to users.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Clear error if key isn't configured yet
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({
      error: 'GEMINI_API_KEY is not configured. In Vercel: Settings → Environment Variables → add GEMINI_API_KEY → Redeploy.'
    });
  }

  const { name, type, description, location, phone, email, hours, styleHint } = req.body;

  if (!name || !type || !description) {
    return res.status(400).json({ error: 'Missing required fields: name, type, description' });
  }

  const prompt = `You are an expert web designer. Create a complete, beautiful, single-page HTML website for a business.

Business Details:
- Name: ${name}
- Type: ${type}
- Description: ${description}
${location ? `- Location: ${location}` : ''}
${phone ? `- Phone/WhatsApp: ${phone}` : ''}
${email ? `- Email: ${email}` : ''}
${hours ? `- Hours: ${hours}` : ''}
- Design style: ${styleHint || 'sleek modern professional design'}

Requirements:
1. Output ONLY valid complete HTML from <!DOCTYPE html> to </html>. No markdown, no backticks, no explanation before or after.
2. Sections: sticky nav, hero with headline + CTA button, services (3-4 cards), why choose us (3 benefits), contact with all provided details, footer.
3. Match the design style exactly: ${styleHint || 'modern professional'}
4. Import Google Fonts in <head> — choose fonts that match the style and business personality.
5. All CSS in one <style> tag. No external CSS frameworks.
6. Fully responsive with mobile-friendly media queries.
7. Modern design: gradients, shadows, hover effects, smooth animations.
8. Write realistic compelling copy specific to this business — no generic filler.
9. Professional agency-quality output.

Start your response immediately with <!DOCTYPE html> and nothing else.`;

  try {
    // Try gemini-2.0-flash first, fall back to gemini-1.5-flash
    const models = ['gemini-2.5-flash-preview-04-17', 'gemini-2.0-flash', 'gemini-1.5-flash'];
    let geminiData = null;
    let lastError = '';

    for (const model of models) {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 8192, temperature: 0.7 },
          }),
        }
      );

      const data = await geminiRes.json();

      if (geminiRes.ok) {
        geminiData = data;
        break;
      } else {
        lastError = data.error?.message || `Model ${model} failed`;
        console.error(`Gemini error (${model}):`, lastError);
      }
    }

    if (!geminiData) {
      return res.status(500).json({ error: `Gemini API error: ${lastError}` });
    }

    const html = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!html) {
      return res.status(500).json({ error: 'Gemini returned an empty response. Please try again.' });
    }

    // Log lead to Google Sheets (fire-and-forget)
    if (process.env.GOOGLE_SHEET_URL) {
      fetch(process.env.GOOGLE_SHEET_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type, phone: phone || '', email: email || '', location: location || '', date: new Date().toISOString() }),
      }).catch(err => console.error('Sheets logging error (non-fatal):', err));
    }

    return res.status(200).json({ html });

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: `Server error: ${err.message}` });
  }
}
