# Telegram Mini App — Watch Ads & Earn

Full-stack Telegram Mini App where users watch rewarded ads (Monetag) and earn coins,
convertible to payouts after a threshold. Growth via referrals + daily streaks.

> ⚠️ **Security:** The bot token currently in `backend/.env` was shared in a chat and
> must be considered compromised. Before launch, rotate it via **@BotFather → API Token →
> Revoke** (`/revoke`), then update `BOT_TOKEN` in `backend/.env`. The token is read from
> env only — it is never in source, and the photo/file proxy keeps it off the client.

## Monorepo layout

```
telegram-earn-app/
├── backend/          # Express + TypeScript API (auth, ledger, postback, withdrawals, admin)
├── frontend/         # React 19 + Vite + Tailwind v4 Mini App (ported dashboard UI)
├── docker-compose.yml# Postgres + Redis for local dev
└── .env.example      # Copy to backend/.env and frontend/.env
```

## The critical security rule

**Coins are NEVER credited from a client-side "ad finished" callback.** Crediting only
happens when Monetag calls the server-to-server (S2S) postback, which the backend
authenticates (shared secret), routes by the `ymid` session id, gates on **valued**
(paid) events only, rate-limits (Redis), and applies inside a DB transaction (idempotent
per session). The frontend only polls for confirmation.

## Quick start (local)

```bash
# 1. Start Postgres + Redis
docker compose up -d

# 2. Backend
cd backend
cp ../.env.example .env        # fill in BOT_TOKEN etc.
npm install
npm run migrate                # creates schema
npm run dev                    # http://localhost:8787

# 3. Frontend
cd frontend
npm install
npm run dev                    # http://localhost:5173 (needs HTTPS for real Telegram — see deploy)
```

## Database (Supabase)

The backend uses **PostgreSQL via `node-postgres`**, so it connects to **Supabase**
(which *is* Postgres) with **no rewrite** — every transaction, row-lock (`FOR UPDATE`)
and idempotency guard in the ledger works unchanged. The only requirement is **TLS**,
which is auto-enabled for Supabase connection strings.

**Setup:**
1. Supabase Dashboard → **Project Settings → Database → Connection string**. Copy the
   **Transaction pooler** URI (port `6543`) and replace `[YOUR-DATABASE-PASSWORD]`.
2. Put it in `backend/.env`:
   ```
   DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
   ```
   (For a local Docker Postgres instead, set `DATABASE_SSL=false`.)
3. Apply the schema + verify connectivity:
   ```bash
   cd backend
   npm run db:setup     # = npm run migrate && npm run check:db
   ```

**Notes:**
- Tables are created in the `public` schema with **Row-Level-Security off** — the backend
  is the sole writer and authenticates every request via Telegram initData. Don't enable
  RLS on these tables unless you also expose them via Supabase's auto-API.
- The **Transaction pooler (6543)** and **Direct (5432)** connections both work (the code
  uses no prepared statements / LISTEN-NOTIFY / advisory locks → PgBouncer-compatible).
- Alternative: paste `backend/src/db/schema.sql` into the Supabase **SQL Editor**.

> ⚠️ The connection string embeds your **database password** — treat it as a secret.
> Your **service_role key** is **not** needed here; never share it (it bypasses all security).

## Env vars

See `.env.example`. Required: `BOT_TOKEN`, `DATABASE_URL`, `REDIS_URL`,
`MONETAG_POSTBACK_SECRET`, `FRONTEND_URL`, `MIN_WITHDRAWAL`.

## Frontend (ported dashboard UI)

The frontend is a polished **React 19 + Vite + Tailwind CSS v4** Mini App (ported from
the reference design), using `lucide-react` icons, `motion` animations, `canvas-confetti`,
and `recharts`. It keeps the reference's look and layout but is driven by **your backend**
(the backend is unchanged).

**Entry / auth:** inside Telegram the app auto-authenticates with initData
(`/api/auth/me`) and goes straight to the dashboard; outside Telegram it shows the
marketing **Landing** page, whose launch buttons open the Telegram Mini App link.
Public **Privacy** / **Terms** pages live at `#/privacy` and `#/terms`.

**Dashboard tabs:** Earn · Missions · Friends · Arena · Wallet, in a responsive
3-column layout (sidebars collapse on mobile) with a live postback-stream console and a
security panel.

**Wired to the real backend:**
- Balance, lifetime earnings, ads-watched count, referral stats → `/api/ledger/*`, `/api/referrals`
- Watch history → `/api/ledger/transactions`; withdrawal history + requests → `/api/withdrawals`
- **Ad rewards** → real Monetag Rewarded Interstitial + S2S postback crediting (below).
  In the Earn tab, picking a campaign runs its interactive player + anti-bot captcha, and
  the **Claim** step triggers the real Monetag ad; coins are credited only on the verified
  `valued` postback, then the balance is refreshed from the backend.
- Coin ↔ USD display uses `config.coinsPerUsd` (coins = USD × rate).

**Client-side simulations (no backend support, by design):** Lucky Spin, the Missions
(join channel / watch-10 / invite-3), the Arena leaderboard, and the daily check-in are
visual-only — they animate and log to the console but do not change the real balance,
which is always refreshed from the backend on ad watches and withdrawals.

**Frontend env:** set `VITE_API_URL` to your backend URL (defaults to
`http://localhost:8787`). Build with `npm run build`; type-check with `npm run typecheck`.

## Admin dashboard

Set `ADMIN_TELEGRAM_IDS` to your Telegram user id (comma-separated for multiple).
Open the app at `https://your-app/#/admin` from that Telegram account (or tap the
logo 5× in the dashboard). Access is enforced twice: client-side by `profile.isAdmin`
and server-side by `requireAdmin` (id allow-list) on every `/api/admin/*` call, so a
non-admin cannot reach the endpoints even if they forge the route.

Admin features:
- **Overview** — users, coins in circulation, pending withdrawals (count + coins), confirmed ads today, flagged users
- **Withdrawals** — pending queue with user context + shadow-ban warning; approve, or reject (refunds escrow), then mark paid
- **Users** — look up by telegram id, adjust balances (audit-logged as `admin_adjust`), ban / shadow-ban

## Telegram integration (bot, photo, notifications)

The bot is **@AcEarn_bot**. Token is verified and the command menu is registered
(`scripts/setup-bot.ts` runs `getMe` + `setMyCommands`).

**Run the bot** (separate long-running process, shares the same DB):
```bash
cd backend
npm run bot        # dev (tsx watch)
npm run start:bot  # prod (after npm run build)
```
- `/start [ref_<id>]` → welcome message + a **"🪙 Open Earn App"** button (`web_app`).
  The `ref_<id>` payload captures the referral. *Note: `web_app` buttons require
  `FRONTEND_URL` to be HTTPS and the Mini App configured in BotFather.*
- `/balance`, `/invite`, `/help`.

**Profile photo** — `GET /api/users/photo` (authed) fetches the user's Telegram photo
server-side via the Bot API (`getUserProfilePhotos` → `getFile` → download) and proxies
the bytes to the client. The token-bearing file URL never reaches the browser. The
frontend shows it as an avatar (initials fallback). Cached in-memory for 1h.

**Notifications** — Telegram DMs are sent (fire-and-forget) on withdrawal events:
request received, approved, rejected (with refund), and paid.

**One-time setup / smoke test:**
```bash
cd backend && npx tsx scripts/setup-bot.ts
```

## Monetag ad integration (Rewarded Interstitial)

> 📘 **Full go-live steps:** see [`docs/SETUP-MONETAG.md`](docs/SETUP-MONETAG.md)
> (create zone → set `MONETAG_ZONE_ID` → configure the S2S postback URL → deploy → test).
> The crediting flow is verified by `npm run test:monetag` (6/6 vs the live DB).

The real Monetag SDK (`monetag-tg-sdk`) is wired into `frontend/src/lib/monetag.ts`:
`createAdHandler(zoneId)` → preload on mount → `show({ type:'end', ymid, requestVar,
catchIfNoFeed:true })`, which returns a Promise that resolves after the user closes
the ad.

**How rewards flow (security + economics):**
1. Frontend calls `POST /api/ads/start` → gets a `sessionId` (and the zone id).
2. Frontend shows the ad with `ymid = sessionId`. Monetag echoes `ymid` in its postback.
3. Monetag fires the **S2S postback** to the backend when the event is confirmed.
4. Backend credits coins **only if `reward_event_type === 'valued'`** (a paid event).
   `not_valued` / `non_valued` (unpaid/fallback traffic) is recorded as `unrewarded`
   but **not** paid — paying for unpaid traffic would lose money. (Monetag's docs use
   both spellings; anything not exactly `valued` is treated as unpaid.)
5. Frontend polls `GET /api/ads/status/:sessionId` → `confirmed` (+coins),
   `unrewarded` (watched, no reward), or `pending`.

> The npm package types the handler as `Promise<void>`, but the SDK actually resolves
> with `{ reward_event_type, estimated_price, … }`. We capture that best-effort for
> optimistic UI only — **crediting is driven entirely by the verified S2S postback**,
> never by the client callback (which Monetag warns does not guarantee monetization).

**Setup (you do this in the Monetag dashboard):**
1. Create a **Rewarded Interstitial** zone; copy the **main zone id** → set
   `MONETAG_ZONE_ID` in `backend/.env`.
2. In the zone's **Postback** settings, set the URL template (Monetag fills the macros):
   ```
   https://YOURDOMAIN/api/postback/monetag?secret=<MONETAG_POSTBACK_SECRET>
     &ymid={ymid}&event={event_type}&value={reward_event_type}
     &price={estimated_price}&telegram_id={telegram_id}
     &zone={zone_id}&sub={sub_zone_id}&source={request_var}
   ```
   Replace `YOURDOMAIN` with your deployed (HTTPS) backend domain and the secret with
   your `MONETAG_POSTBACK_SECRET`.
3. The backend must be publicly reachable over HTTPS for the postback to arrive.

In **development** (no zone / `MONETAG_ZONE_ID=0000000`) the app simulates the ad and
the postback via `/api/dev/simulate-postback` (dev-only, never mounted in production),
so you can test the full earn loop locally.

## Game features (Lucky Spin · Missions · Leaderboard · Daily check-in)

These are fully **backend-driven** — the client never credits itself; the server
decides every reward and writes it to the audited ledger.

| Feature | Endpoints | Behavior |
|---|---|---|
| Daily check-in | `GET /api/streak`, `POST /api/streak/checkin` | Once per day (`UNIQUE(user_id, day)`). Reward = `CHECKIN_REWARD` + `min(streak,7) × CHECKIN_STREAK_STEP`. Maintains the check-in streak. |
| Missions | `GET /api/missions`, `POST /api/missions/claim` | One-time, server-verified: `join_telegram`, `watch_10_ads` (≥10 ad rewards), `invite_3_friends` (≥3 referrals). Idempotent via `UNIQUE(user_id, mission_id)`. |
| Leaderboard | `GET /api/leaderboard` | Top earners by lifetime credits (withdrawals excluded) + your rank + referral/active-referral counts. |
| Lucky Spin | `GET /api/spin`, `POST /api/spin` | **Server picks the prize** (weighted, matches the wheel), enforces `SPIN_COOLDOWN_SECONDS` (24h), credits the balance. |

Rewards post as `streak_bonus` / `mission_reward` / `spin_reward` ledger entries and
show up in the history. The frontend's Lucky Spin, Missions, check-in card, and Arena
are wired to these endpoints (the spin prize and all rewards are decided server-side;
the client only animates/displays).

**Tune rewards** in `backend/.env`: `CHECKIN_REWARD`, `CHECKIN_STREAK_STEP`,
`MISSION_JOIN_TELEGRAM_REWARD`, `MISSION_WATCH10_REWARD`, `MISSION_INVITE3_REWARD`,
`SPIN_COOLDOWN_SECONDS`.

**Tests:** `cd backend && npm run test:games` validates the game SQL (via pg-mem);
`npm run test:initdata` validates the Telegram initData HMAC verification;
`npm run test:integration` exercises the **full service layer against the live database**
(check-in, spin, missions, ledger, withdrawal, leaderboard) using a throwaway test user
that it deletes afterward.

## Build order implemented

1. ✅ React + Telegram SDK frontend with initData capture + Watch Ad UI
2. ✅ Express backend with initData verification middleware
3. ✅ PostgreSQL schema + migrations
4. ✅ Monetag S2S postback endpoint (idempotency + Redis cooldown)
5. ✅ Referral capture (start_param) + referral bonus logic
6. ✅ Withdrawal request + admin approval endpoints
7. ✅ Ported dashboard UI (React 19 + Tailwind v4: Earn / Missions / Friends / Arena / Wallet + Landing & legal pages) wired to the backend
8. ✅ Admin dashboard UI (Overview / withdrawal queue / user moderation at `#/admin`)
9. 🔲 Deployment hardening (HTTPS tunnel for local Telegram testing, Dockerfiles)
