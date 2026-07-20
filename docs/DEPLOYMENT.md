# Deployment Guide — Vercel (with best practices)

This app is a monorepo. It deploys as **two Vercel projects** from the same GitHub repo,
plus an **optional bot** on a persistent host (Vercel can't run long-running bots).

```
┌─────────────────────────┐        ┌──────────────────────────────┐
│  acearn-web (Vercel)     │  HTTPS │  acearn-api (Vercel)          │
│  React/Vite static SPA   │───────▶│  Express as serverless fn      │
│  root: frontend/         │        │  root: backend/                │
└─────────────────────────┘        └───────────────┬──────────────┘
          ▲                                         │ S2S postback (HTTPS)
          │ opens in Telegram                       ▼
   ┌──────┴───────┐                       ┌──────────────────┐
   │ Telegram      │                      │ Monetag           │
   │ Mini App      │                      │ (rewarded ads)    │
   └──────────────┘                       └──────────────────┘
                                                    │
                                          ┌─────────▼─────────┐
                                          │ Supabase Postgres  │
                                          │ (pooler :6543)     │
                                          └────────────────────┘
   Optional: Telegraf bot on Railway/Render (notifications + /start menu)
```

---

## Part 1 — Deploy the BACKEND (`acearn-api`)

Deploy this **first** (the frontend needs its URL).

1. **vercel.com → Add New → Project → Import** your `Monzersideeg/Telegram-Ad` repo.
2. When asked which project, choose to configure manually and set:
   - **Project name:** `acearn-api`
   - **Framework Preset:** `Other`
   - **Root Directory:** `backend`
   - **Build Command:** `npm run build`
   - **Install Command:** `npm install`
   - **Output Directory:** *(leave blank — Vercel auto-detects the `api/` serverless function)*
3. **Environment Variables** (Project Settings → Environment Variables):

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | your Supabase **pooler** string (`postgresql://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:6543/postgres`) |
   | `BOT_TOKEN` | from @BotFather |
   | `MONETAG_POSTBACK_SECRET` | the long random secret (same one used in the postback URL) |
   | `MONETAG_ZONE_ID` | `3415700` |
   | `FRONTEND_URL` | the frontend's Vercel URL (set after Part 2, e.g. `https://acearn-web.vercel.app`) |
   | `ADMIN_TELEGRAM_IDS` | your numeric Telegram id |
   | `ADMIN_SECRET` | a random string |
   | `NODE_ENV` | `production` |
   | `REWARD_PER_AD`, `MIN_WITHDRAWAL`, `COINS_PER_USD`, etc. | optional tuning (defaults are fine) |
   | `REDIS_URL` | *optional* — the API degrades gracefully without it |

4. **Deploy.** You'll get a URL like `https://acearn-api.vercel.app`.
5. **Verify:** `https://acearn-api.vercel.app/health` → should return `{"ok":true,...}`.

> The Monetag postback endpoint is `https://acearn-api.vercel.app/api/postback/monetag`.

## Part 2 — Deploy the FRONTEND (`acearn-web`)

1. **vercel.com → Add New → Project → Import** the same repo **again** (second project).
2. Configure:
   - **Project name:** `acearn-web`
   - **Framework Preset:** `Vite`
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
3. **Environment Variables:**

   | Key | Value |
   |---|---|
   | `VITE_API_URL` | `https://acearn-api.vercel.app` (your backend URL from Part 1) |

4. **Deploy.** You'll get a URL like `https://acearn-web.vercel.app`.
5. Go back to **acearn-api** settings and set `FRONTEND_URL=https://acearn-web.vercel.app`
   (for CORS), then **redeploy** the backend.

## Part 3 — Wire up Monetag + Telegram

1. **Monetag postback** — in your Monetag zone (3415700) → Postback/S2S settings, set:
   ```
   https://acearn-api.vercel.app/api/postback/monetag?secret=YOUR_MONETAG_POSTBACK_SECRET&ymid={ymid}&event={event_type}&value={reward_event_type}&price={estimated_price}&telegram_id={telegram_id}&zone={zone_id}&sub={sub_zone_id}&source={request_var}
   ```
2. **Telegram Mini App** — @BotFather → your bot → **Bot Settings → Menu Button** (or your
   Mini App) → set the URL to `https://acearn-web.vercel.app`.
3. Open the bot in Telegram and tap the menu button → the Mini App loads → tap **Watch Ad**.

## Part 4 — (Optional) Deploy the BOT to Railway

The Telegraf bot is long-running, so it can't run on Vercel. Railway is the easiest host:

1. **railway.app → New Project → Deploy from GitHub repo** (`Monzersideeg/Telegram-Ad`).
2. Set **Root Directory:** `backend`.
3. **Start Command:** `npm run bot`  (and a separate service or `npm start` for the API if
   you'd rather run the API here too — but the API is already on Vercel, so just run the bot).
4. Add the same env vars (`BOT_TOKEN`, `DATABASE_URL`, etc.).

The bot adds the `/start` welcome + "Open App" button and withdrawal notifications. The
app works without it.

---

## Deploy via Vercel CLI (alternative to the dashboard)

If you prefer the terminal / want it done for you, create a Vercel token
(Account Settings → Tokens) and run, from the repo root:

```bash
npm i -g vercel

# backend
cd backend && vercel --prod --token YOUR_VERCEL_TOKEN --yes \
  -e DATABASE_URL=... -e BOT_TOKEN=... -e MONETAG_POSTBACK_SECRET=... -e MONETAG_ZONE_ID=3415700

# frontend
cd ../frontend && vercel --prod --token YOUR_VERCEL_TOKEN --yes \
  -e VITE_API_URL=https://acearn-api.vercel.app
```
(Then set `FRONTEND_URL` on the backend and redeploy.) The dashboard method is recommended
for new setups because it links Git → **auto-deploys on every push**.

---

## Pre-launch checklist

- [ ] Backend `/health` returns ok
- [ ] Frontend loads in a browser and shows the Landing page
- [ ] Opened in Telegram → auto-logs in → dashboard appears
- [ ] Watch an ad → coins credited (check `ad_views` → `confirmed` in Supabase)
- [ ] Withdrawal request creates a `pending` row
- [ ] Monetag postback URL configured; postbacks arrive (backend logs `Ad reward credited`)
- [ ] **Rotated** the bot token & Supabase password that were shared in chat
- [ ] No secrets in the repo (only `.env.example` templates are committed)
