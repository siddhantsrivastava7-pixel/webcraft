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
     * Energy Drink → energy, sports, athlete, neon, drink
     * Photography → camera, photography, portrait, studio, photo
     * Construction → construction, building, architecture, tools, work
   - Use at least 5-6 images with different keywords AND different lock numbers (1-20)
   - ALWAYS wrap hero text in a container with background:rgba(0,0,0,0.55) overlay so text is readable
8. Nav links MUST use smooth scroll anchor links (#section-id) that stay within the page — NOT href to external pages.
9. Modern design: card shadows, hover effects, smooth animations, image overlays with rgba backgrounds.
10. Compelling realistic copy tailored to this exact business — no generic filler.
11. Professional agency-quality result that looks like a real handcrafted website.

Start your response immediately with <!DOCTYPE html> and nothing else.`;

  try {
    // Try gemini-2.0-flash first, fall back to gemini-1.5-flash
    const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];
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

    // gemini-2.5-flash returns thinking + response as multiple parts — join them all
    const parts = geminiData.candidates?.[0]?.content?.parts || [];
    let html = parts.map(p => p.text || '').join('');
    
    // Inject <base target="_self"> so nav links scroll within iframe, not escape to parent
    html = html.replace('<head>', '<head><base target="_self">');

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
