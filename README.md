# WebCraft AI — Setup & Deploy Guide

A free AI website builder for business owners. Powered by Google Gemini.  
No technical knowledge required to use it. Costs ₹0 to run.

---

## Project Structure

```
webcraft/
├── index.html              ← Frontend (what users see)
├── api/
│   └── generate.js         ← Backend (holds your secret API keys)
├── google-sheets-script.js ← Paste into Google Apps Script for lead tracking
├── vercel.json             ← Routing config
├── package.json
└── README.md
```

---

## Step 1 — Get a free Gemini API key

1. Go to https://aistudio.google.com/apikey
2. Sign in with your Google account
3. Click **"Create API Key"**
4. Copy the key — looks like `AIzaSy...`

Free limits: 15 requests/min, 1 million tokens/day. More than enough.

---

## Step 2 — (Optional) Set up Google Sheets lead tracking

Every time someone builds a website, their details are automatically logged to a Google Sheet.

1. Go to https://sheets.google.com → create a new spreadsheet
2. Click **Extensions → Apps Script**
3. Delete all existing code, paste the entire contents of `google-sheets-script.js`
4. Click **Save**, then **Deploy → New Deployment**
   - Type: Web app | Execute as: Me | Who has access: Anyone
5. Click **Deploy → Authorize → Allow**
6. Copy the **Web App URL** — save it for Step 3

---

## Step 3 — Deploy to Vercel (free, 5 minutes)

1. Create accounts at https://github.com and https://vercel.com
2. Create a new GitHub repo and upload all the project files
3. Go to https://vercel.com/new → Import repo → Deploy
4. In Vercel: **Settings → Environment Variables**, add:

   | Name | Value |
   |------|-------|
   | `GEMINI_API_KEY` | Your key from Step 1 |
   | `GOOGLE_SHEET_URL` | Your Apps Script URL from Step 2 (optional) |

5. Go to **Deployments → Redeploy**
6. Your app is live at `yourproject.vercel.app` 🎉

---

## Step 4 — (Optional) Custom domain

Vercel dashboard → your project → **Settings → Domains** → add `yourdomain.com`  
Domains cost ~₹800–1500/year from GoDaddy or Namecheap.

---

## How it works

```
User fills form
      ↓
Frontend (index.html) — no API key here, safe!
      ↓  POST /api/generate
Backend (api/generate.js) — API key lives here, server only
      ↓
Google Gemini — generates the website HTML
      ↓
Backend logs lead to Google Sheets (if configured)
      ↓
User sees preview + Download + Go Live button
```

---

## Costs

| Service | Cost |
|---------|------|
| Vercel hosting | Free |
| Gemini API | Free (1M tokens/day) |
| Google Sheets logging | Free |
| Custom domain | ~₹800/year (optional) |

**Total: ₹0/month**
