-- Telegram Mini App "Watch Ads & Earn" schema.
-- Balances are integers (coins) stored as BIGINT to avoid floating point issues.
-- 1 coin is the smallest unit; COINS_PER_USD controls display conversion.

CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL PRIMARY KEY,
  telegram_id   BIGINT UNIQUE NOT NULL,
  username      TEXT,
  first_name    TEXT,
  balance       BIGINT NOT NULL DEFAULT 0,
  referred_by   BIGINT REFERENCES users(id) ON DELETE SET NULL,
  streak_days   INT NOT NULL DEFAULT 0,
  last_active_day DATE,
  shadow_banned BOOLEAN NOT NULL DEFAULT FALSE,  -- earns but withdrawals frozen pending review
  banned        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by);

-- One row per ad watch attempt. Crediting happens only when status -> confirmed via postback.
CREATE TABLE IF NOT EXISTS ad_views (
  id               BIGSERIAL PRIMARY KEY,
  user_id          BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ad_network       TEXT NOT NULL DEFAULT 'monetag',
  session_id       TEXT NOT NULL UNIQUE,          -- client-generated watch session (sent to Monetag as ymid)
  network_click_id TEXT UNIQUE,                   -- reserved; dedupe key if a network supplies one
  reward_amount    BIGINT NOT NULL DEFAULT 0,     -- credited coins (0 until a valued postback)
  estimated_price  NUMERIC(12,6),                 -- Monetag estimated revenue (USD) for this view
  status           TEXT NOT NULL DEFAULT 'pending', -- pending / confirmed / unrewarded / rejected / expired
  ip               INET,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ad_views_user_created ON ad_views(user_id, created_at DESC);

-- Immutable ledger. Every balance change is a row here; balance on users is a cached aggregate.
CREATE TABLE IF NOT EXISTS transactions (
  id            BIGSERIAL PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,   -- ad_reward / referral_bonus / withdrawal / withdrawal_refund / streak_bonus / admin_adjust
  amount        BIGINT NOT NULL, -- signed: positive credits, negative debits
  balance_after BIGINT NOT NULL,
  meta          JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tx_user_created ON transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tx_type ON transactions(type);

CREATE TABLE IF NOT EXISTS withdrawals (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount       BIGINT NOT NULL,
  method       TEXT NOT NULL,          -- e.g. USDT-TRC20, mobile-credit, gift-card
  destination  TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending', -- pending / approved / paid / rejected
  reject_reason TEXT,
  reviewed_by  BIGINT,                 -- admin telegram_id
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON withdrawals(user_id, created_at DESC);

-- Per-referrer daily referral-bonus accumulator (also mirrored in Redis for speed).
CREATE TABLE IF NOT EXISTS referral_daily (
  referrer_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day          DATE NOT NULL,
  earned       BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (referrer_id, day)
);

-- ===== Game features =====

-- One-time mission claims (join_telegram / watch_10_ads / invite_3_friends).
CREATE TABLE IF NOT EXISTS missions (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mission_id  TEXT NOT NULL,
  reward      BIGINT NOT NULL,
  claimed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, mission_id)
);

-- Daily check-ins (one per user per day). Drives the check-in streak.
CREATE TABLE IF NOT EXISTS checkins (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day         DATE NOT NULL DEFAULT CURRENT_DATE,
  streak      INT NOT NULL DEFAULT 1,
  reward      BIGINT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, day)
);

-- Lucky Spin history (used for the cooldown + last reward).
CREATE TABLE IF NOT EXISTS spins (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reward      BIGINT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_spins_user_created ON spins(user_id, created_at DESC);

-- Profile photo bytes, persisted so we don't re-hit the Telegram Bot API on every load.
-- Applied idempotently (also self-applied at runtime via /api/users/photo, since the
-- Vercel serverless build does not run migrate.ts on boot).
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_data BYTEA;
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_content_type TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_fetched_at TIMESTAMPTZ;
