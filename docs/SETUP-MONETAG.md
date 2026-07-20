# Monetag Integration — Go-Live Guide

Watch rewarded ads (Monetag **Rewarded Interstitial**) → earn coins → withdraw.
This guide takes you from "code done" to "earning in production."

## What's already built & verified ✅

The integration is complete and **tested end-to-end against the live database**
(`npm run test:monetag` — 6/6 passing):

- **Frontend** (`frontend/src/lib/monetag.ts`): loads `monetag-tg-sdk`, shows the
  Rewarded Interstitial, passes `ymid = sessionId` so the postback routes back.
- **Backend** (`backend/src/routes/postback.ts`): the S2S postback endpoint verifies
  the secret, credits coins **only on `valued` events**, is idempotent, rejects
  `not_valued` (unpaid) and bad secrets.
- The reward flow below is proven working.

## How the reward flow works

```
User taps "Watch Ad"
   │
   ├─ Frontend: POST /api/ads/start  ───────────────► backend creates a session, returns sessionId
   │
   ├─ Frontend: show Monetag Rewarded Interstitial with ymid = sessionId
   │            (the real ad plays full-screen)
   │
   ├─ Monetag (server) ── S2S postback ─────────────► GET /api/postback/monetag?secret=…&ymid=sessionId&value=valued&price=…
   │                                                    • verifies secret
   │                                                    • value=valued  → credit +REWARD_PER_AD
   │                                                    • value=not_valued → no credit
   │                                                    • idempotent (no double credit)
   │
   └─ Frontend: polls GET /api/ads/status/:sessionId → "confirmed" → balance updates 🎉
```

> **Security:** coins are credited **only** by the server-to-server postback (never by
> the client). The postback is authenticated by a shared `secret` in the URL.

---

## Step 1 — Create a Monetag Rewarded Interstitial zone

1. Sign in at **https://monetag.com** (publisher account).
2. **Add your app/site**: enter your Telegram Mini App URL (the HTTPS frontend URL).
3. Create a new ad unit → choose **Rewarded Interstitial** (the format designed for
   "watch-to-earn").
4. Copy the **Zone ID** (a number, e.g. `8593847`).

## Step 2 — Set the Zone ID

In `backend/.env`:
```
MONETAG_ZONE_ID=8593847        # ← your zone id
```
The frontend reads this from `/api/auth/me` and uses it to load the ad.

## Step 3 — Configure the S2S postback URL in Monetag

In your zone's **Postback / S2S** settings, set this URL (replace `YOURDOMAIN` with your
deployed backend host, and the secret with your `MONETAG_POSTBACK_SECRET` from `.env`):

```
https://YOURDOMAIN/api/postback/monetag?secret=YOUR_MONETAG_POSTBACK_SECRET&ymid={ymid}&event={event_type}&value={reward_event_type}&price={estimated_price}&telegram_id={telegram_id}&zone={zone_id}&sub={sub_zone_id}&source={request_var}
```

Monetag replaces the `{macros}` with real values on each confirmed event. The two that
matter:
- `{ymid}` → the `sessionId` we sent (routes the reward to the right watch session)
- `{reward_event_type}` → `valued` (paid) or `not_valued` (unpaid)

## Step 4 — Deploy the backend over HTTPS

The postback is a server-to-server HTTPS call, so your backend must be publicly reachable.

- **Railway / Render / Fly.io**: push the `backend/` folder; set the env vars from `.env`.
- **VPS**: `npm run build && npm start` behind Nginx/Caddy with TLS.

Required env vars on the host: `DATABASE_URL` (your Supabase pooler string),
`BOT_TOKEN`, `MONETAG_POSTBACK_SECRET`, `MONETAG_ZONE_ID`, `REDIS_URL` (optional — the app
degrades gracefully without it).

## Step 5 — Deploy the frontend over HTTPS + link it in BotFather

Telegram Mini Apps **require HTTPS**.

1. Deploy `frontend/` to **Vercel / Netlify** (`npm run build`, publish `dist/`).
2. Set `VITE_API_URL` to your backend's HTTPS URL before building.
3. In **@BotFather** → your bot → **Bot Settings → Menu Button** (or your Mini App), set the
   URL to your deployed frontend (e.g. `https://acearn.vercel.app`).

## Step 6 — Test it for real

**Quick local test in Telegram (no deploy):** expose your local machines with a tunnel:
```bash
# terminal 1 — backend
cd backend && npm run dev                      # http://localhost:8787
# terminal 2 — tunnel the backend
cloudflared tunnel --url http://localhost:8787  # gives https://xxxx.trycloudflare.com
# terminal 3 — frontend
cd frontend && VITE_API_URL=https://xxxx.trycloudflare.com npm run dev   # http://localhost:5173
# terminal 4 — tunnel the frontend
cloudflared tunnel --url http://localhost:5173  # gives https://yyyy.trycloudflare.com
```
Set the Mini App URL in BotFather to `https://yyyy.trycloudflare.com`, set
`MONETAG_ZONE_ID`, open the bot in Telegram, and tap **Watch Ad**.

**Verify a reward lands:** after watching an ad, check the `ad_views` table in Supabase
(a row should go `pending → confirmed` with a `reward_amount`) and the `transactions`
table (an `ad_reward` entry). You can also watch the backend logs for
`"Ad reward credited (valued postback)"`.

---

## Tuning the economics ⚠️

`REWARD_PER_AD` is in **coins** (`COINS_PER_USD` coins = $1; default 1000 coins = $1).
Monetag pays you per *valued* impression (`price` in the postback ≈ your revenue for that
view). **Set `REWARD_PER_AD` below your average revenue per valued view**, or you'll pay
out more than you earn. Example: if your eCPM is ~$4 (≈ $0.004 per valued view = 4 coins
at 1000/$), reward ≤ 2–3 coins per ad to keep margin. Start conservative and adjust from
real data in the Monetag dashboard.

## Troubleshooting

| Symptom | Check |
|---|---|
| Ad never credits | Postback URL wrong/unreachable, or `secret` mismatch, or events are `not_valued` (check `ad_views.status` + `value` in logs) |
| `bad_secret` in logs | `MONETAG_POSTBACK_SECRET` in `.env` ≠ the `secret=` in the postback URL |
| `not_found` postback | `ymid`/session mismatch — make sure the frontend sends `ymid = sessionId` (it does) |
| Postback 500 | Backend not reachable over HTTPS / crashed — check hosting logs |
| Ad doesn't show | Wrong/empty `MONETAG_ZONE_ID`, or testing outside a real browser/Telegram |

## Test scripts

```bash
cd backend
npm run test:monetag      # live end-to-end crediting flow vs your DB (no real ad needed)
npm run test:games        # game features (check-in, spin, missions, leaderboard)
npm run test:initdata     # Telegram initData HMAC verification
```
