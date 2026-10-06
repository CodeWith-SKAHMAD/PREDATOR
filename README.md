# PREDATOR

PREDATOR is a PC-first, mobile-responsive crypto screener UI foundation.

## Deploy
1. Upload this project to GitHub.
2. Import the repository into Vercel.
3. In Vercel Environment Variables add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Redeploy.

The application currently provides the PREDATOR shell, navigation, theme switching, responsive layout, session bar, dashboard, signal cards, volume spike view, BTC report placeholder, portfolio UI, calculator, and settings/profile UI. Live data/auth integrations are added in the next project updates.

## Local environment
Copy `.env.example` to `.env.local` and fill the Supabase values if running locally.
