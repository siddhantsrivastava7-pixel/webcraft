// api/generate.js — Vercel Serverless Function
// Primary: Groq (free, fast, Llama 3.3 70B)
// Fallback: Gemini

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const hasGroq   = !!process.env.GROQ_API_KEY;
  const hasGemini = !!process.env.GEMINI_API_KEY;

  if (!hasGroq && !hasGemini) {
    return res.status(500).json({
      error: 'No API key configured. Add GROQ_API_KEY in Vercel Environment Variables (free key at console.groq.com).'
    });
  }

  const { name, type, description, location, phone, email, hours, styleHint } = req.body;

  if (!name || !type || !description) {
    return res.status(400).json({ error: 'Missing required fields: name, type, description' });
  }

  // Pre-build exact image URLs — AI must copy these verbatim, no URL construction
  const imgs = getImages(type);

  const prompt = `You are a world-class web designer and copywriter. Create a complete, stunning, single-page HTML website.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BUSINESS DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Name: ${name}
Type: ${type}
Description: ${description}
${location ? `Location: ${location}` : ''}
${phone   ? `Phone/WhatsApp: ${phone}` : ''}
${email   ? `Email: ${email}` : ''}
${hours   ? `Hours: ${hours}` : ''}
Design style: ${styleHint || 'modern professional'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IMAGE URLS — COPY THESE EXACTLY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You MUST use these exact URLs. Do NOT modify them. Do NOT invent new URLs.

Hero background:  ${imgs.hero}
Service card 1:   ${imgs.card1}
Service card 2:   ${imgs.card2}
Service card 3:   ${imgs.card3}

Hero CSS: background-image: url('${imgs.hero}'); background-size: cover; background-position: center;

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONTENT — CRITICAL RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ NEVER write "Lorem ipsum", "Service 1", "Service 2", "placeholder", or any dummy text.
✅ Write REAL, compelling content tailored to this exact business: "${name}" (${type})
✅ Invent realistic service names based on the business type (e.g. for a gym: "Personal Training", "Group Classes", "Nutrition Coaching")
✅ Write real benefit statements in "Why Choose Us" (e.g. "Expert Certified Trainers", "Flexible Membership Plans")
✅ Every word must feel like it was written by a professional copywriter for this specific business

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PAGE SECTIONS (in this order)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

① STICKY NAV
  - Business name as logo on left
  - Links on right: Home · Services · About · Contact (smooth scroll anchors)
  - Solid background, z-index: 1000, height: ~70px

② HERO (id="home", min-height: 100vh)
  - Background: use the hero URL above with background-size:cover
  - Dark overlay: <div style="position:absolute;inset:0;background:rgba(0,0,0,0.55)"></div>
  - Content div: position:relative; z-index:2; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; min-height:100vh; padding-top:70px
  - H1: bold, clamp(2.8rem,6vw,5rem), white, punchy tagline (max 6 words)
  - Subtext: 1.1rem, rgba(255,255,255,0.85), max-width:560px, centered
  - ONE centered CTA button (no floating elements)

③ SERVICES (id="services", padding: 80px 20px)
  - H2 section title, short subtitle
  - 3 cards in a CSS grid (grid-template-columns: repeat(3,1fr); gap:28px)
  - Each card structure:
    <div class="card">
      <img src="CARD_URL" alt="..." style="width:100%;height:220px;object-fit:cover;border-radius:12px 12px 0 0">
      <div style="padding:24px">
        <h3>REAL SERVICE NAME</h3>
        <p>REAL 2-sentence description</p>
      </div>
    </div>
  - Cards: background white, border-radius:12px, box-shadow, hover: translateY(-6px)

④ WHY CHOOSE US (id="about", padding: 80px 20px)
  - Light background (#f8f9fa or similar)
  - 3 benefit blocks with a relevant Unicode icon (🏆 ⚡ 🎯 or similar), bold title, 1-2 sentence description
  - Real benefit titles, not generic checkmarks

⑤ CONTACT (id="contact", padding: 80px 20px)
  - Show all provided contact details with icons
  - Clean contact info card layout

⑥ FOOTER
  - Dark background, business name, short tagline, copyright

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DESIGN SYSTEM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CSS variables (choose colors matching "${styleHint}"):
  --primary: (main brand color)
  --primary-dark: (darker shade for hover)
  --accent: (highlight color)
  --bg: #ffffff
  --bg-alt: #f8f9fa
  --text: #1a1a2e
  --text-muted: #666

Google Fonts: import 2 fonts matching the style
  - Display font for headings
  - Body font for paragraphs

Responsive: mobile-first, breakpoint at 768px
  - Cards stack to 1 column on mobile
  - Nav collapses or hides links on mobile

html { scroll-behavior: smooth }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Single HTML file with all CSS in <style> tag
- No <base> tag
- No external CSS frameworks
- No markdown, no backticks, no explanation
- First character of output: <
- Last characters: </html>`;

  let html = null;
  let lastError = '';

  // ── 1. Groq ──────────────────────────────────────────────────────────────
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
              content: 'You are an expert web designer. Output ONLY raw HTML starting with <!DOCTYPE html>. No markdown. No code fences. No explanation. The very first character you output must be < and the last must be >.'
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

  // ── 2. Gemini fallback ───────────────────────────────────────────────────
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
          lastError = geminiData.error?.message || `Gemini ${model} failed`;
          console.error(`Gemini error (${model}):`, lastError);
        }
      } catch (err) {
        lastError = err.message;
      }
    }
  }

  if (!html) {
    return res.status(500).json({ error: `AI generation failed: ${lastError}` });
  }

  // ── Sanitise output ──────────────────────────────────────────────────────
  html = html.replace(/^```html\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();
  const doctypeIdx = html.indexOf('<!DOCTYPE');
  const htmlTagIdx = html.indexOf('<html');
  const startIdx   = doctypeIdx >= 0 ? doctypeIdx : htmlTagIdx;
  if (startIdx > 0) html = html.slice(startIdx);
  if (startIdx < 0) return res.status(500).json({ error: 'AI returned invalid output. Please try again.' });
  html = html.replace(/<base[^>]*>/gi, '');

  // ── Google Sheets logging ────────────────────────────────────────────────
  if (process.env.GOOGLE_SHEET_URL) {
    fetch(process.env.GOOGLE_SHEET_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type, phone: phone||'', email: email||'', location: location||'', date: new Date().toISOString() }),
    }).catch(() => {});
  }

  return res.status(200).json({ html });
}

// ── Pre-built image URLs by business type ─────────────────────────────────
// Using loremflickr with specific, locked seeds that produce good results
function getImages(type) {
  const t = (type || '').toLowerCase();

  if (t.includes('restaurant') || t.includes('café') || t.includes('cafe') || t.includes('food')) {
    return {
      hero:  'https://loremflickr.com/1400/900/restaurant,dining?lock=11',
      card1: 'https://loremflickr.com/600/380/food,pasta?lock=31',
      card2: 'https://loremflickr.com/600/380/food,grill?lock=32',
      card3: 'https://loremflickr.com/600/380/food,dessert?lock=33',
    };
  }
  if (t.includes('salon') || t.includes('spa') || t.includes('beauty')) {
    return {
      hero:  'https://loremflickr.com/1400/900/salon,beauty?lock=11',
      card1: 'https://loremflickr.com/600/380/haircut,salon?lock=41',
      card2: 'https://loremflickr.com/600/380/spa,massage?lock=42',
      card3: 'https://loremflickr.com/600/380/skincare,beauty?lock=43',
    };
  }
  if (t.includes('fitness') || t.includes('gym') || t.includes('wellness')) {
    return {
      hero:  'https://loremflickr.com/1400/900/gym,fitness?lock=11',
      card1: 'https://loremflickr.com/600/380/weights,gym?lock=51',
      card2: 'https://loremflickr.com/600/380/running,sport?lock=52',
      card3: 'https://loremflickr.com/600/380/yoga,exercise?lock=53',
    };
  }
  if (t.includes('real estate') || t.includes('property')) {
    return {
      hero:  'https://loremflickr.com/1400/900/house,architecture?lock=11',
      card1: 'https://loremflickr.com/600/380/interior,living?lock=61',
      card2: 'https://loremflickr.com/600/380/house,garden?lock=62',
      card3: 'https://loremflickr.com/600/380/apartment,modern?lock=63',
    };
  }
  if (t.includes('photography') || t.includes('creative') || t.includes('studio')) {
    return {
      hero:  'https://loremflickr.com/1400/900/photography,camera?lock=11',
      card1: 'https://loremflickr.com/600/380/portrait,photo?lock=71',
      card2: 'https://loremflickr.com/600/380/wedding,photography?lock=72',
      card3: 'https://loremflickr.com/600/380/studio,lens?lock=73',
    };
  }
  if (t.includes('construction') || t.includes('home services') || t.includes('contractor')) {
    return {
      hero:  'https://loremflickr.com/1400/900/construction,building?lock=11',
      card1: 'https://loremflickr.com/600/380/renovation,tools?lock=81',
      card2: 'https://loremflickr.com/600/380/architecture,house?lock=82',
      card3: 'https://loremflickr.com/600/380/plumbing,repair?lock=83',
    };
  }
  if (t.includes('healthcare') || t.includes('medical') || t.includes('clinic') || t.includes('doctor')) {
    return {
      hero:  'https://loremflickr.com/1400/900/hospital,medical?lock=11',
      card1: 'https://loremflickr.com/600/380/doctor,clinic?lock=91',
      card2: 'https://loremflickr.com/600/380/medicine,health?lock=92',
      card3: 'https://loremflickr.com/600/380/healthcare,nurse?lock=93',
    };
  }
  if (t.includes('education') || t.includes('tutoring') || t.includes('school')) {
    return {
      hero:  'https://loremflickr.com/1400/900/education,classroom?lock=11',
      card1: 'https://loremflickr.com/600/380/books,study?lock=14',
      card2: 'https://loremflickr.com/600/380/school,learning?lock=15',
      card3: 'https://loremflickr.com/600/380/student,writing?lock=16',
    };
  }
  if (t.includes('tech') || t.includes('software') || t.includes('it')) {
    return {
      hero:  'https://loremflickr.com/1400/900/technology,computer?lock=11',
      card1: 'https://loremflickr.com/600/380/coding,software?lock=17',
      card2: 'https://loremflickr.com/600/380/server,network?lock=18',
      card3: 'https://loremflickr.com/600/380/digital,innovation?lock=19',
    };
  }
  if (t.includes('retail') || t.includes('shop') || t.includes('store')) {
    return {
      hero:  'https://loremflickr.com/1400/900/shop,retail?lock=11',
      card1: 'https://loremflickr.com/600/380/shopping,store?lock=20',
      card2: 'https://loremflickr.com/600/380/boutique,fashion?lock=21',
      card3: 'https://loremflickr.com/600/380/products,market?lock=22',
    };
  }
  if (t.includes('law') || t.includes('legal') || t.includes('lawyer') || t.includes('professional')) {
    return {
      hero:  'https://loremflickr.com/1400/900/office,business?lock=11',
      card1: 'https://loremflickr.com/600/380/law,justice?lock=23',
      card2: 'https://loremflickr.com/600/380/meeting,corporate?lock=24',
      card3: 'https://loremflickr.com/600/380/consulting,professional?lock=25',
    };
  }

  // Fallback
  return {
    hero:  'https://loremflickr.com/1400/900/business,office?lock=11',
    card1: 'https://loremflickr.com/600/380/work,team?lock=26',
    card2: 'https://loremflickr.com/600/380/meeting,professional?lock=27',
    card3: 'https://loremflickr.com/600/380/success,corporate?lock=28',
  };
}
