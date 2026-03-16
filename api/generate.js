// api/generate.js — Vercel Serverless Function
// Primary: Groq (free, fast, Llama 3.3 70B)
// Fallback: Gemini (free tier, if GEMINI_API_KEY is set)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const hasGroq   = !!process.env.GROQ_API_KEY;
  const hasGemini = !!process.env.GEMINI_API_KEY;

  if (!hasGroq && !hasGemini) {
    return res.status(500).json({
      error: 'No API key configured. In Vercel: Settings → Environment Variables → add GROQ_API_KEY (get free key at console.groq.com) → Redeploy.'
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
1. Output ONLY valid complete HTML from <!DOCTYPE html> to </html>. No markdown, no backticks, no explanation.
2. Sections: sticky nav, hero with headline + CTA, services (3-4 cards), why choose us (3 benefits), contact with all details, footer.
3. Match the design style exactly: ${styleHint || 'modern professional'}
4. Import Google Fonts in <head> — fonts matching the style and business personality.
5. All CSS in one <style> tag. No external CSS frameworks.
6. Fully responsive with mobile-friendly media queries.
7. USE REAL IMAGES from loremflickr.com — it searches by keyword so images match the business:
   - Format: https://loremflickr.com/WIDTH/HEIGHT/KEYWORD1,KEYWORD2?lock=NUMBER
   - The lock number (1-99) ensures different images per card. Change it for each image.
   - Hero background: style="background-image:url('https://loremflickr.com/1600/900/BUSINESS_KEYWORD?lock=1');background-size:cover;background-position:center;" with a dark rgba(0,0,0,0.55) overlay div for text readability
   - Service card images: <img src="https://loremflickr.com/600/400/RELEVANT_KEYWORD?lock=N" style="width:100%;height:220px;object-fit:cover;border-radius:8px 8px 0 0">
   - Match keywords tightly to the business type: ${type}
     * Restaurant/Cafe → food, restaurant, dining, chef, cuisine
     * Salon/Beauty → salon, hair, beauty, makeup, skincare
     * Gym/Fitness → gym, fitness, workout, exercise, training
     * Real Estate → house, interior, property, architecture, home
     * Photography → camera, photography, portrait, studio, photo
     * Construction → construction, building, architecture, tools, work
   - Use at least 5-6 images with different keywords AND different lock numbers (1-20)
   - ALWAYS wrap hero text in a container with background:rgba(0,0,0,0.55) overlay so text is readable
8. Nav links MUST use smooth scroll anchor links (#section-id) that stay within the page — NOT href to external pages.
9. Modern design: card shadows, hover effects, smooth animations, image overlays with rgba backgrounds.
10. Compelling realistic copy tailored to this exact business — no generic filler.
11. Professional agency-quality result that looks like a real handcrafted website.
12. Do NOT include any <base> tag.

Start your response immediately with <!DOCTYPE html> and nothing else.`;

  let html = null;
  let lastError = '';

  // ── 1. Try Groq first (free, fast) ──────────────────────────────────────
  if (hasGroq) {
    try {
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 8192,
          temperature: 0.7,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      const groqData = await groqRes.json();

      if (groqRes.ok) {
        html = groqData.choices?.[0]?.message?.content || '';
      } else {
        lastError = groqData.error?.message || 'Groq request failed';
        console.error('Groq error:', lastError);
      }
    } catch (err) {
      lastError = err.message;
      console.error('Groq fetch error:', err);
    }
  }

  // ── 2. Fallback to Gemini if Groq failed or not configured ──────────────
  if (!html && hasGemini) {
    const models = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash'];

    for (const model of models) {
      try {
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

        const geminiData = await geminiRes.json();

        if (geminiRes.ok) {
          const parts = geminiData.candidates?.[0]?.content?.parts || [];
          html = parts.map(p => p.text || '').join('');
          if (html) break;
        } else {
          lastError = geminiData.error?.message || `Gemini model ${model} failed`;
          console.error(`Gemini error (${model}):`, lastError);
        }
      } catch (err) {
        lastError = err.message;
        console.error(`Gemini fetch error (${model}):`, err);
      }
    }
  }

  if (!html) {
    return res.status(500).json({ error: `AI generation failed: ${lastError}` });
  }

  // ── Clean up the response ────────────────────────────────────────────────
  // Strip markdown fences if the model wrapped output
  html = html.replace(/^```html\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();

  // Extract from <!DOCTYPE if there's preamble text
  const doctypeIdx = html.indexOf('<!DOCTYPE');
  const htmlTagIdx = html.indexOf('<html');
  const startIdx   = doctypeIdx >= 0 ? doctypeIdx : htmlTagIdx;
  if (startIdx > 0)  html = html.slice(startIdx);
  if (startIdx < 0)  return res.status(500).json({ error: 'Invalid response from AI. Please try again.' });

  // Remove any <base> tag the model may have added (breaks blob preview)
  html = html.replace(/<base[^>]*>/gi, '');

  // ── Log lead to Google Sheets (fire-and-forget) ──────────────────────────
  if (process.env.GOOGLE_SHEET_URL) {
    fetch(process.env.GOOGLE_SHEET_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name, type,
        phone:    phone    || '',
        email:    email    || '',
        location: location || '',
        date:     new Date().toISOString(),
      }),
    }).catch(err => console.error('Sheets logging error (non-fatal):', err));
  }

  return res.status(200).json({ html });
}
