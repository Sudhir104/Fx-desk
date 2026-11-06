# FX Macro Desk

One Next.js app (no separate backend, no database). Deploy = push to GitHub, import in Vercel.

## Deploy
1. New GitHub repo -> push this folder.
2. vercel.com -> Add New Project -> import the repo (framework: Next.js, no root dir change).
3. (Optional) Settings -> Environment Variables: see `.env.example`. The site works with zero keys.
4. Open `/api/health` after deploy: it shows which data source is live, stale or failing.

## Data
- Policy rates: BIS (WS_CBPOL), fallbacks ECB, Bank of Canada, FRED (USD, needs FRED_API_KEY)
- Calendar: Forex Factory weekly JSON (high impact only)
- News: FinancialJuice RSS (best effort) + central-bank press feeds
- Desk note: Anthropic or Groq if a key is set, otherwise rules-based text

Local: `npm install && npm run dev` · tests: `npm test`
