// Validates the game-feature SQL executes correctly using pg-mem (in-memory Postgres).
// Run: npx tsx scripts/test-games-pgmem.ts
import { newDb } from "pg-mem";

const db = newDb();

db.public.none(`
  CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    username TEXT,
    first_name TEXT,
    balance BIGINT NOT NULL DEFAULT 0,
    referred_by BIGINT,
    streak_days INT NOT NULL DEFAULT 0,
    banned BOOLEAN NOT NULL DEFAULT false
  );
  CREATE TABLE transactions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    type TEXT NOT NULL,
    amount BIGINT NOT NULL,
    balance_after BIGINT NOT NULL
  );
  CREATE TABLE missions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    mission_id TEXT NOT NULL,
    reward BIGINT NOT NULL,
    UNIQUE (user_id, mission_id)
  );
  CREATE TABLE checkins (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    day DATE NOT NULL DEFAULT CURRENT_DATE,
    streak INT NOT NULL DEFAULT 1,
    reward BIGINT NOT NULL,
    UNIQUE (user_id, day)
  );
  CREATE TABLE spins (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    reward BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`);

db.public.none(`
  INSERT INTO users (telegram_id, username, first_name, balance) VALUES
    (111, 'alice', 'Alice', 500),
    (222, 'bob', 'Bob', 200),
    (333, 'carol', 'Carol', 900);
  INSERT INTO transactions (user_id, type, amount, balance_after) VALUES
    (1, 'ad_reward', 100, 100),
    (1, 'ad_reward', 100, 200),
    (1, 'referral_bonus', 50, 250),
    (1, 'withdrawal', -300, -50),
    (2, 'ad_reward', 200, 200),
    (3, 'ad_reward', 900, 900);
  UPDATE users SET referred_by = 1 WHERE id IN (2,3);
`);

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("❌ FAIL:", msg);
    process.exit(1);
  }
  console.log("✅", msg);
}

// 1. Leaderboard (CTE + SUM FILTER + JOINs) — earnings exclude negative (withdrawals)
const leaders: any[] = db.public.many(`
  WITH totals AS (
    SELECT user_id, COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS earned
    FROM transactions GROUP BY user_id
  ),
  refs AS (
    SELECT referred_by AS user_id,
           COUNT(*) AS referral_count,
           COALESCE(SUM(CASE WHEN balance > 0 THEN 1 ELSE 0 END), 0) AS active_referral_count
    FROM users WHERE referred_by IS NOT NULL GROUP BY referred_by
  )
  SELECT u.telegram_id, u.username, u.first_name,
         COALESCE(t.earned, 0)::text AS earned,
         COALESCE(rf.referral_count, 0)::int AS referral_count,
         COALESCE(rf.active_referral_count, 0)::int AS active_referral_count
  FROM users u
  LEFT JOIN totals t ON t.user_id = u.id
  LEFT JOIN refs rf ON rf.user_id = u.id
  WHERE u.banned = false
  ORDER BY COALESCE(t.earned, 0) DESC, u.id ASC
  LIMIT 50
`);
assert(leaders[0].username === "carol" && Number(leaders[0].earned) === 900, "leaderboard #1 = carol (900, positive-only sum)");
assert(Number(leaders[1].earned) === 250, "leaderboard #2 = alice earned 250 (100+100+50, withdrawal excluded)");
assert(Number(leaders[0].referral_count) === 0 && leaders[1] && Number(leaders.find((l) => l.username === "alice").referral_count) === 2, "alice has 2 referrals");
assert(Number(leaders.find((l) => l.username === "alice").active_referral_count) === 2, "alice has 2 active referrals (both refs have balance>0)");

// 2. getMyRank logic for user 1 (alice): earned 250, one user above (carol 900) → rank 2
const earnedRes: any[] = db.public.many("SELECT COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0)::text AS earned FROM transactions WHERE user_id = 1");
const myEarned = Number(earnedRes[0].earned);
const rankRes: any[] = db.public.many(`SELECT COUNT(*)::int AS n FROM (SELECT COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS earned FROM transactions GROUP BY user_id) t WHERE t.earned > ${myEarned}`);
const rank = Number(rankRes[0].n) + 1;
assert(myEarned === 250, "myRank: alice earned = 250");
assert(rank === 2, "myRank: alice rank = 2 (carol above)");

// 3. Mission claim idempotency (UNIQUE + ON CONFLICT DO NOTHING keeps a single row).
// (pg-mem's RETURNING-on-conflict is buggy, so we verify dedup via COUNT; the service
//  relies on rowCount===0 for a DO NOTHING conflict, a documented Postgres guarantee,
//  with the UNIQUE(user_id, mission_id) constraint as the atomic backstop.)
db.public.none(`INSERT INTO missions (user_id, mission_id, reward) VALUES (1, 'watch_10_ads', 150) ON CONFLICT (user_id, mission_id) DO NOTHING`);
db.public.none(`INSERT INTO missions (user_id, mission_id, reward) VALUES (1, 'watch_10_ads', 150) ON CONFLICT (user_id, mission_id) DO NOTHING`);
const missionCount: any[] = db.public.many(`SELECT COUNT(*)::int AS n FROM missions WHERE user_id = 1 AND mission_id = 'watch_10_ads'`);
assert(Number(missionCount[0].n) === 1, "mission claim is idempotent (single row after two attempts)");

// 4. Check-in once-per-day dedup + yesterday streak lookup.
// (pg-mem mishandles CURRENT_DATE as a time-precise timestamp, so we use explicit
//  date literals — equivalent to CURRENT_DATE / CURRENT_DATE - 1 in real Postgres.)
db.public.none(`INSERT INTO checkins (user_id, day, streak, reward) VALUES (1, '2026-07-18', 3, 25) ON CONFLICT (user_id, day) DO NOTHING`);
db.public.none(`INSERT INTO checkins (user_id, day, streak, reward) VALUES (1, '2026-07-19', 4, 30) ON CONFLICT (user_id, day) DO NOTHING`);
db.public.none(`INSERT INTO checkins (user_id, day, streak, reward) VALUES (1, '2026-07-19', 99, 99) ON CONFLICT (user_id, day) DO NOTHING`);
const todayCount: any[] = db.public.many(`SELECT COUNT(*)::int AS n FROM checkins WHERE user_id = 1 AND day = '2026-07-19'`);
assert(Number(todayCount[0].n) === 1, "check-in dedup: one row for today despite two attempts");
const yday: any[] = db.public.many(`SELECT streak FROM checkins WHERE user_id = 1 AND day = '2026-07-18'`);
assert(yday.length === 1 && Number(yday[0].streak) === 3, "yesterday's check-in found (streak 3 → today becomes 4)");

// 5. Spin insert + last-spin lookup
db.public.none(`INSERT INTO spins (user_id, reward) VALUES (1, 100)`);
const lastSpin: any[] = db.public.many(`SELECT created_at, reward FROM spins WHERE user_id = 1 ORDER BY created_at DESC LIMIT 1`);
assert(Number(lastSpin[0].reward) === 100, "spin recorded + last-spin lookup works");

console.log("\n🎉 ALL GAME-FEATURE QUERIES VALIDATED");
