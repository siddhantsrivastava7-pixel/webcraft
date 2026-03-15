// api/generate.js — Vercel Serverless Function
// Your Gemini API key lives here on the server. Users never see it.

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, type, description, location, phone, email, hours, color, styleHint } = req.body;

  // Basic validation
  if (!name || !type || !description) {
    return res.status(400).json({ error: 'Missing required fields: name, type, description' });
  }

  const colorMap = {
    blue: '#1d4ed8', green: '#15803d', orange: '#c2410c',
    purple: '#6d28d9', pink: '#be185d', slate: '#334155',
    amber: '#b45309', teal: '#0f766e',
  };
  const primaryColor = colorMap[color] || '#1d4ed8';

  const prompt = `You are an expert web designer. Create a complete, beautiful, single-page HTML website for a business.

Business Details:
- Name: ${name}
- Type: ${type}
- Description: ${description}
${location ? `- Location: ${location}` : ''}
${phone ? `- Phone/WhatsApp: ${phone}` : ''}
${email ? `- Email: ${email}` : ''}
${hours ? `- Hours: ${hours}` : ''}
- Design style: ${styleHint || "modern professional sleek design"}

Requirements:
1. Output ONLY valid complete HTML (<!DOCTYPE html> to </html>). No markdown, no backticks, no explanation.
2. Sections: sticky nav, hero with headline + CTA, services (3-4 cards), why choose us (3 benefits), contact with details, footer.
3. Match the design style exactly as described above — colors, fonts, and mood.
4. Import Google Fonts in <head> — choose fonts matching the business personality.
5. All CSS in a <style> tag. No external CSS frameworks.
6. Fully responsive and mobile-friendly with media queries.
7. Modern design: gradients, card shadows, smooth hover effects, subtle animations.
8. Write realistic, compelling copy that fits this specific business type.
9. Professional agency-quality output.

Output ONLY the HTML. Start with <!DOCTYPE html>`;

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 8192, temperature: 0.7 },
        }),
      }
    );

    const geminiData = await geminiRes.json();

    if (!geminiRes.ok) {
      const msg = geminiData.error?.message || 'Gemini API error';
      console.error('Gemini error:', msg);
      return res.status(500).json({ error: 'AI generation failed. Please try again.' });
    }

    const html = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Log the lead to Google Sheets (fire-and-forget, won't block the response)
    if (process.env.GOOGLE_SHEET_URL) {
      fetch(process.env.GOOGLE_SHEET_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          type,
          phone:    phone    || '',
          email:    email    || '',
          location: location || '',
          date:     new Date().toISOString(),
        }),
      }).catch(err => console.error('Sheets logging error (non-fatal):', err));
    }

    return res.status(200).json({ html });

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
}
