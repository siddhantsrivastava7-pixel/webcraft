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

  // Pick tightly relevant image keywords based on business type
  const imageKeywords = getImageKeywords(type);

  const prompt = `You are a world-class web designer. Create a stunning, complete, single-page HTML website.

BUSINESS INFO:
- Name: ${name}
- Type: ${type}
- Description: ${description}
${location ? `- Location: ${location}` : ''}
${phone ? `- Phone/WhatsApp: ${phone}` : ''}
${email ? `- Email: ${email}` : ''}
${hours ? `- Business Hours: ${hours}` : ''}
- Visual style: ${styleHint || 'sleek modern professional'}

════════════════════════════════════════
SECTION STRUCTURE (in this exact order)
════════════════════════════════════════

1. STICKY NAV
   - Logo (business name) on the left
   - Nav links on the right: Home, Services, About, Contact
   - Smooth scroll to anchor IDs
   - Solid background color (not transparent), subtle bottom border
   - z-index: 1000

2. HERO SECTION  ← READ CAREFULLY
   - Full-viewport-height (min-height: 100vh)
   - Background: a loremflickr image using this exact format:
     background-image: url('https://loremflickr.com/1400/900/${imageKeywords.hero}?lock=10')
   - ALWAYS add a dark overlay using a child div with:
     position:absolute; inset:0; background:rgba(0,0,0,0.55);
   - Hero content sits ABOVE the overlay using position:relative; z-index:2
   - Layout: centered vertically and horizontally using flexbox (flex-direction:column; align-items:center; justify-content:center; text-align:center)
   - NEVER position the headline and paragraph side-by-side — stack them vertically
   - Headline: large (clamp(2.5rem, 6vw, 4.5rem)), bold, white, max 6 words
   - Subheadline: 1.1rem, white/80%, max-width:560px, centered
   - ONE centered CTA button below the subheadline — no floating buttons
   - Add a subtle scroll indicator arrow at the bottom

3. SERVICES SECTION (id="services")
   - Section title + short subtitle centered at the top
   - 3-column card grid (responsive: 1 col on mobile)
   - Each card: image on top, title, short description, subtle hover lift
   - Card images: https://loremflickr.com/600/380/${imageKeywords.card}?lock=N
     Use lock=21, lock=22, lock=23 for the three cards
   - Cards have rounded corners, box-shadow, clean white/light background

4. WHY CHOOSE US (id="about")
   - Alternating layout OR 3-column icon grid
   - 3 strong benefit points with icons (use Unicode or simple SVG icons)
   - Clean light background (slightly off-white or tinted)

5. CONTACT SECTION (id="contact")
   - Display: phone, email, location, hours — each with an icon
   - Optional: simple HTML/CSS contact form (name, email, message, send button)
   - Map placeholder or a stylish address card

6. FOOTER
   - Business name, tagline, nav links, copyright
   - Dark background

════════════════════════════════════════
DESIGN RULES
════════════════════════════════════════

TYPOGRAPHY:
- Import 2 Google Fonts that match the style: ${styleHint}
  * One display font for headings (e.g. Playfair Display, Montserrat, Space Grotesk)
  * One body font (e.g. Inter, DM Sans, Nunito)
- Heading sizes: h1 clamp(2.5rem,6vw,4.5rem) / h2 2rem / h3 1.25rem
- Body: 1rem, line-height 1.7, color #444

COLORS — based on style "${styleHint}":
- Define --primary, --primary-dark, --accent, --bg, --bg-alt as CSS variables
- Use them consistently throughout

IMAGES — CRITICAL RULES:
- ONLY use loremflickr.com. Format: https://loremflickr.com/WIDTH/HEIGHT/KEYWORD?lock=N
- Keywords MUST be specific to this business type. Use ONLY these pre-selected keywords:
  Hero keyword:  "${imageKeywords.hero}"
  Card keyword:  "${imageKeywords.card}"
  Extra keyword: "${imageKeywords.extra}"
- NEVER substitute generic keywords like "business", "woman", "drink", "people", "laptop"
- Use a unique lock number (1–99) for EVERY image so they all look different
- All card images must use the same dimensions: 600x380
- Hero image must be: 1400x900

LAYOUT & SPACING:
- Section padding: 80px top/bottom (40px mobile)
- Max content width: 1100px, centered with margin:auto
- Card grid gap: 28px
- Use CSS custom properties for all repeated values

INTERACTIONS:
- Smooth scroll: html { scroll-behavior: smooth }
- Nav link hover: color change + underline animation
- Card hover: translateY(-6px) + deeper shadow (transition 0.3s ease)
- CTA button hover: scale(1.03) + shadow
- Fade-in animation on sections using @keyframes fadeInUp

TECHNICAL:
- Single HTML file, all CSS in <style>, no external frameworks
- Do NOT include any <base> tag anywhere
- Fully responsive — mobile-first, breakpoints at 768px and 480px
- Sticky nav height ~70px — add padding-top:70px to the hero so content is not hidden under nav
- All section anchor id attributes must match nav href values exactly

OUTPUT FORMAT:
Output ONLY the HTML. Start with <!DOCTYPE html> on the very first line. End with </html> on the last line. No markdown. No backticks. No commentary before or after.`;

  let html = null;
  let lastError = '';

  // ── 1. Try Groq first ────────────────────────────────────────────────────
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
          messages: [
            {
              role: 'system',
              content: 'You are an expert web designer. Output only complete valid HTML files. Never use markdown fences. Never add any text before <!DOCTYPE html> or after </html>.'
            },
            { role: 'user', content: prompt }
          ],
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

  // ── 2. Fallback to Gemini ────────────────────────────────────────────────
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

  // ── Clean up response ────────────────────────────────────────────────────
  html = html.replace(/^```html\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();

  const doctypeIdx = html.indexOf('<!DOCTYPE');
  const htmlTagIdx = html.indexOf('<html');
  const startIdx   = doctypeIdx >= 0 ? doctypeIdx : htmlTagIdx;
  if (startIdx > 0)  html = html.slice(startIdx);
  if (startIdx < 0)  return res.status(500).json({ error: 'Invalid response from AI. Please try again.' });

  // Remove any <base> tag — breaks blob:// preview
  html = html.replace(/<base[^>]*>/gi, '');

  // ── Log to Google Sheets ─────────────────────────────────────────────────
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

// ── Image keyword map by business type ──────────────────────────────────────
function getImageKeywords(type) {
  const t = (type || '').toLowerCase();

  if (t.includes('restaurant') || t.includes('café') || t.includes('cafe') || t.includes('food')) {
    return { hero: 'restaurant,dining,food', card: 'food,dish,cuisine', extra: 'chef,cooking,kitchen' };
  }
  if (t.includes('salon') || t.includes('spa') || t.includes('beauty')) {
    return { hero: 'salon,beauty,hair', card: 'haircut,beauty,skincare', extra: 'makeup,spa,treatment' };
  }
  if (t.includes('fitness') || t.includes('gym') || t.includes('wellness')) {
    return { hero: 'gym,fitness,workout', card: 'exercise,training,weights', extra: 'athlete,running,sport' };
  }
  if (t.includes('real estate') || t.includes('property')) {
    return { hero: 'house,architecture,home', card: 'interior,living,room', extra: 'property,building,estate' };
  }
  if (t.includes('photography') || t.includes('creative') || t.includes('studio')) {
    return { hero: 'photography,camera,studio', card: 'portrait,photo,lens', extra: 'creative,art,shoot' };
  }
  if (t.includes('construction') || t.includes('home services') || t.includes('contractor')) {
    return { hero: 'construction,building,architecture', card: 'tools,renovation,work', extra: 'house,repair,contractor' };
  }
  if (t.includes('healthcare') || t.includes('medical') || t.includes('clinic') || t.includes('doctor')) {
    return { hero: 'hospital,medical,healthcare', card: 'doctor,clinic,health', extra: 'medicine,care,patient' };
  }
  if (t.includes('education') || t.includes('tutoring') || t.includes('school')) {
    return { hero: 'education,classroom,learning', card: 'study,books,school', extra: 'student,teaching,knowledge' };
  }
  if (t.includes('tech') || t.includes('software') || t.includes('it')) {
    return { hero: 'technology,computer,digital', card: 'software,coding,tech', extra: 'innovation,data,network' };
  }
  if (t.includes('retail') || t.includes('shop') || t.includes('store')) {
    return { hero: 'retail,shop,store', card: 'shopping,products,market', extra: 'boutique,fashion,display' };
  }
  if (t.includes('law') || t.includes('legal') || t.includes('lawyer') || t.includes('professional')) {
    return { hero: 'office,professional,business', card: 'law,legal,justice', extra: 'consulting,meeting,corporate' };
  }

  // Generic fallback
  return { hero: 'business,professional,office', card: 'work,team,service', extra: 'success,corporate,meeting' };
}
