// api/generate.js
// Vercel serverless function — keeps your Gemini API key secret on the server.
// The frontend calls POST /api/generate and gets back { html: "..." }

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Missing prompt' });
  }

  // GEMINI_API_KEY is set in Vercel dashboard → Environment Variables
  // Never hardcode your key here!
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server is missing API key. Please contact support.' });
  }

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 8192,
            temperature: 0.7,
          },
        }),
      }
    );

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      const msg = data.error?.message || 'Gemini API error';
      console.error('Gemini error:', msg);
      return res.status(502).json({ error: 'AI service error. Please try again.' });
    }

    const html = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!html) {
      return res.status(502).json({ error: 'AI returned empty response. Please try again.' });
    }

    return res.status(200).json({ html });

  } catch (err) {
    console.error('generate error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
