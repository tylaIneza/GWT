import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import * as mysql from 'mysql2/promise';

// ─── helpers ────────────────────────────────────────────────────────────────

/** Auto-parse JSON string fields coming back from MySQL TEXT columns */
function hydrate(rows: any[]): any[] {
  return rows.map(row => {
    const out: any = {};
    for (const [k, v] of Object.entries(row)) {
      if (typeof v === 'string' && (v.startsWith('{') || v.startsWith('['))) {
        try { out[k] = JSON.parse(v); } catch { out[k] = v; }
      } else {
        out[k] = v;
      }
    }
    return out;
  });
}

/** Convert SQLite seed syntax to MySQL */
function sqliteToMySQL(sql: string): string {
  return sql
    .replace(/INSERT OR IGNORE/g, 'INSERT IGNORE')
    .replace(/'\s*\|\|\s*CHAR\(10\)\s*\|\|\s*'/g, '\n');
}

// ─── Connection wrapper used inside transaction callbacks ────────────────────
class MySQLConn {
  constructor(private readonly conn: mysql.PoolConnection) {}

  async query<T = any>(sql: string, params?: any[]): Promise<[T[], null]> {
    const [rows] = await this.conn.execute<any>(sql, params || []);
    return [hydrate(Array.isArray(rows) ? rows : []) as T[], null];
  }

  async execute(sql: string, params?: any[]): Promise<any> {
    const [result] = await this.conn.execute(sql, params || []);
    return result;
  }
}

// ─── MySQL schema ────────────────────────────────────────────────────────────
const SCHEMA = `
SET FOREIGN_KEY_CHECKS=0;

CREATE TABLE IF NOT EXISTS users (
  id                 VARCHAR(36)  PRIMARY KEY,
  name               VARCHAR(255) NOT NULL,
  email              VARCHAR(255) UNIQUE NOT NULL,
  password_hash      VARCHAR(255) NOT NULL,
  role               VARCHAR(20)  NOT NULL DEFAULT 'user',
  phone              VARCHAR(50),
  country_code       VARCHAR(10)  DEFAULT 'US',
  language           VARCHAR(10)  DEFAULT 'en',
  timezone           VARCHAR(50)  DEFAULT 'UTC',
  is_banned          TINYINT(1)   DEFAULT 0,
  ban_reason         TEXT,
  risk_score         INT          DEFAULT 0,
  kyc_verified       TINYINT(1)   DEFAULT 0,
  kyc_status         VARCHAR(20)  DEFAULT 'none',
  total_earnings     DOUBLE       DEFAULT 0,
  preferred_currency VARCHAR(10)  DEFAULT 'USD',
  email_verified     TINYINT(1)   DEFAULT 0,
  avatar_url         TEXT,
  bio                TEXT,
  created_at         DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS wallets (
  id             VARCHAR(36) PRIMARY KEY,
  user_id        VARCHAR(36) NOT NULL UNIQUE,
  balance        DOUBLE      NOT NULL DEFAULT 0,
  locked_balance DOUBLE      NOT NULL DEFAULT 0,
  currency       VARCHAR(10) NOT NULL DEFAULT 'USD',
  version        INT         NOT NULL DEFAULT 0,
  updated_at     DATETIME    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS transactions (
  id                 VARCHAR(36)  PRIMARY KEY,
  wallet_id          VARCHAR(36)  NOT NULL,
  user_id            VARCHAR(36)  NOT NULL,
  type               VARCHAR(50)  NOT NULL,
  amount             DOUBLE       NOT NULL,
  currency           VARCHAR(10)  NOT NULL DEFAULT 'USD',
  balance_before     DOUBLE       NOT NULL,
  balance_after      DOUBLE       NOT NULL,
  status             VARCHAR(20)  NOT NULL DEFAULT 'pending',
  reference          VARCHAR(255) UNIQUE,
  payment_provider   VARCHAR(50),
  provider_reference VARCHAR(255),
  metadata           TEXT,
  created_at         DATETIME     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (wallet_id) REFERENCES wallets(id),
  FOREIGN KEY (user_id)   REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS challenges (
  id                          VARCHAR(36)  PRIMARY KEY,
  title                       VARCHAR(255) NOT NULL,
  slug                        VARCHAR(255) UNIQUE NOT NULL,
  description                 TEXT         NOT NULL,
  difficulty                  VARCHAR(20)  NOT NULL DEFAULT 'easy',
  category                    VARCHAR(100),
  supported_languages         TEXT,
  time_limit_ms               INT          DEFAULT 5000,
  memory_limit_mb             INT          DEFAULT 256,
  max_submissions             INT          DEFAULT 10,
  submission_cooldown_seconds INT          DEFAULT 30,
  is_published                TINYINT(1)   DEFAULT 0,
  randomize_inputs            TINYINT(1)   DEFAULT 1,
  solution_template           TEXT,
  prize_usd                   DOUBLE       DEFAULT 0,
  created_by                  VARCHAR(36),
  created_at                  DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_at                  DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS test_cases (
  id              VARCHAR(36) PRIMARY KEY,
  challenge_id    VARCHAR(36) NOT NULL,
  input           TEXT        NOT NULL,
  expected_output TEXT        NOT NULL,
  is_sample       TINYINT(1)  DEFAULT 0,
  is_hidden       TINYINT(1)  DEFAULT 1,
  points          INT         DEFAULT 1,
  order_index     INT         DEFAULT 0,
  explanation     TEXT,
  created_at      DATETIME    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS contests (
  id                 VARCHAR(36)  PRIMARY KEY,
  title              VARCHAR(255) NOT NULL,
  description        TEXT,
  entry_fee          DOUBLE       NOT NULL DEFAULT 0,
  entry_fee_currency VARCHAR(10)  DEFAULT 'USD',
  prize_pool         DOUBLE       NOT NULL DEFAULT 0,
  prize_currency     VARCHAR(10)  DEFAULT 'USD',
  prize_distribution TEXT,
  start_time         DATETIME     NOT NULL,
  end_time           DATETIME     NOT NULL,
  max_participants   INT,
  status             VARCHAR(20)  NOT NULL DEFAULT 'upcoming',
  is_rated           TINYINT(1)   DEFAULT 1,
  region             VARCHAR(50)  DEFAULT 'global',
  created_by         VARCHAR(36),
  created_at         DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS contest_challenges (
  id           VARCHAR(36) PRIMARY KEY,
  contest_id   VARCHAR(36) NOT NULL,
  challenge_id VARCHAR(36) NOT NULL,
  order_index  INT         DEFAULT 0,
  UNIQUE (contest_id, challenge_id),
  FOREIGN KEY (contest_id)   REFERENCES contests(id)   ON DELETE CASCADE,
  FOREIGN KEY (challenge_id) REFERENCES challenges(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS submissions (
  id                 VARCHAR(36) PRIMARY KEY,
  user_id            VARCHAR(36) NOT NULL,
  challenge_id       VARCHAR(36) NOT NULL,
  contest_id         VARCHAR(36),
  language           VARCHAR(50) NOT NULL,
  code               LONGTEXT    NOT NULL,
  status             VARCHAR(20) NOT NULL DEFAULT 'pending',
  score              INT         DEFAULT 0,
  execution_time_ms  INT,
  memory_used_mb     DOUBLE,
  test_results       TEXT,
  risk_score         INT         DEFAULT 0,
  ip_address         VARCHAR(50),
  user_agent         TEXT,
  typing_stats       TEXT,
  paste_count        INT         DEFAULT 0,
  time_to_first_char INT,
  submitted_at       DATETIME    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)      REFERENCES users(id),
  FOREIGN KEY (challenge_id) REFERENCES challenges(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS contest_participants (
  id             VARCHAR(36) PRIMARY KEY,
  contest_id     VARCHAR(36) NOT NULL,
  user_id        VARCHAR(36) NOT NULL,
  transaction_id VARCHAR(36),
  score          INT         DEFAULT 0,
  total_time_ms  INT         DEFAULT 0,
  rank_position  INT,
  prize_amount   DOUBLE,
  prize_paid     TINYINT(1)  DEFAULT 0,
  joined_at      DATETIME    DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (contest_id, user_id),
  FOREIGN KEY (contest_id) REFERENCES contests(id),
  FOREIGN KEY (user_id)    REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS leaderboards (
  id            VARCHAR(36)  PRIMARY KEY,
  contest_id    VARCHAR(36)  NOT NULL,
  user_id       VARCHAR(36)  NOT NULL,
  user_name     VARCHAR(255),
  rank_position INT          NOT NULL,
  score         INT          DEFAULT 0,
  total_time_ms INT          DEFAULT 0,
  updated_at    DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE (contest_id, user_id),
  FOREIGN KEY (contest_id) REFERENCES contests(id),
  FOREIGN KEY (user_id)    REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_sessions (
  id           VARCHAR(36)  PRIMARY KEY,
  user_id      VARCHAR(36)  NOT NULL,
  token_hash   VARCHAR(255) NOT NULL,
  ip_address   VARCHAR(50),
  user_agent   TEXT,
  is_active    TINYINT(1)   DEFAULT 1,
  created_at   DATETIME     DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  expires_at   DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS device_fingerprints (
  id               VARCHAR(36)  PRIMARY KEY,
  user_id          VARCHAR(36)  NOT NULL,
  fingerprint_hash VARCHAR(255) NOT NULL,
  user_agent       TEXT,
  ip_address       VARCHAR(50),
  first_seen_at    DATETIME     DEFAULT CURRENT_TIMESTAMP,
  last_seen_at     DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE (user_id, fingerprint_hash),
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cheat_flags (
  id            VARCHAR(36) PRIMARY KEY,
  user_id       VARCHAR(36) NOT NULL,
  submission_id VARCHAR(36),
  contest_id    VARCHAR(36),
  flag_type     VARCHAR(50) NOT NULL,
  severity      VARCHAR(20) NOT NULL DEFAULT 'low',
  risk_score    INT         DEFAULT 0,
  details       TEXT,
  is_reviewed   TINYINT(1)  DEFAULT 0,
  reviewed_by   VARCHAR(36),
  review_action VARCHAR(50),
  review_notes  TEXT,
  created_at    DATETIME    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS challenge_bets (
  id               VARCHAR(36) PRIMARY KEY,
  user_id          VARCHAR(36) NOT NULL,
  challenge_id     VARCHAR(36) NOT NULL,
  amount           DOUBLE      NOT NULL,
  currency         VARCHAR(10) DEFAULT 'USD',
  multiplier       DOUBLE      NOT NULL,
  potential_payout DOUBLE      NOT NULL,
  status           VARCHAR(20) NOT NULL DEFAULT 'pending',
  submission_id    VARCHAR(36),
  resolved_at      DATETIME,
  created_at       DATETIME    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)      REFERENCES users(id)      ON DELETE CASCADE,
  FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS challenge_sessions (
  id           VARCHAR(36) PRIMARY KEY,
  user_id      VARCHAR(36) NOT NULL,
  challenge_id VARCHAR(36) NOT NULL,
  status       VARCHAR(20) NOT NULL DEFAULT 'active',
  started_at   DATETIME    DEFAULT CURRENT_TIMESTAMP,
  expires_at   DATETIME    NOT NULL,
  FOREIGN KEY (user_id)      REFERENCES users(id)      ON DELETE CASCADE,
  FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS referrals (
  id            VARCHAR(36) PRIMARY KEY,
  referrer_id   VARCHAR(36) NOT NULL,
  referred_id   VARCHAR(36) NOT NULL UNIQUE,
  reward_amount DOUBLE      DEFAULT 5.0,
  currency      VARCHAR(10) DEFAULT 'USD',
  status        VARCHAR(20) DEFAULT 'pending',
  paid_at       DATETIME,
  created_at    DATETIME    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (referrer_id) REFERENCES users(id),
  FOREIGN KEY (referred_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS kyc_documents (
  id           VARCHAR(36) PRIMARY KEY,
  user_id      VARCHAR(36) NOT NULL,
  doc_type     VARCHAR(50) NOT NULL,
  doc_url      TEXT        NOT NULL,
  status       VARCHAR(20) DEFAULT 'pending',
  reviewed_by  VARCHAR(36),
  review_notes TEXT,
  submitted_at DATETIME    DEFAULT CURRENT_TIMESTAMP,
  reviewed_at  DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS email_verifications (
  id         VARCHAR(36)  PRIMARY KEY,
  user_id    VARCHAR(36)  NOT NULL,
  email      VARCHAR(255) NOT NULL,
  otp_code   VARCHAR(10)  NOT NULL,
  expires_at DATETIME     NOT NULL,
  used       TINYINT(1)   DEFAULT 0,
  created_at DATETIME     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS password_resets (
  id         VARCHAR(36)  PRIMARY KEY,
  email      VARCHAR(255) NOT NULL,
  otp_code   VARCHAR(10)  NOT NULL,
  expires_at DATETIME     NOT NULL,
  used       TINYINT(1)   DEFAULT 0,
  created_at DATETIME     DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id              VARCHAR(36)  PRIMARY KEY,
  user_id         VARCHAR(36)  NOT NULL,
  amount          DOUBLE       NOT NULL,
  currency        VARCHAR(10)  NOT NULL DEFAULT 'USD',
  method          VARCHAR(50)  NOT NULL,
  account_details TEXT         NOT NULL,
  status          VARCHAR(20)  NOT NULL DEFAULT 'pending',
  admin_note      TEXT,
  processed_by    VARCHAR(36),
  processed_at    DATETIME,
  created_at      DATETIME     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS badges (
  id          VARCHAR(36)  PRIMARY KEY,
  slug        VARCHAR(100) UNIQUE NOT NULL,
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  icon        VARCHAR(10)  DEFAULT '🏅',
  color       VARCHAR(50)  DEFAULT 'bg-yellow-500',
  rarity      VARCHAR(20)  DEFAULT 'common',
  created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_badges (
  id         VARCHAR(36) PRIMARY KEY,
  user_id    VARCHAR(36) NOT NULL,
  badge_id   VARCHAR(36) NOT NULL,
  awarded_at DATETIME    DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, badge_id),
  FOREIGN KEY (user_id)  REFERENCES users(id)   ON DELETE CASCADE,
  FOREIGN KEY (badge_id) REFERENCES badges(id)  ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS subscription_plans (
  id          VARCHAR(36)  PRIMARY KEY,
  slug        VARCHAR(50)  UNIQUE NOT NULL,
  name        VARCHAR(100) NOT NULL,
  price_usd   DOUBLE       NOT NULL DEFAULT 0,
  duration_days INT        NOT NULL DEFAULT 30,
  features    TEXT,
  is_active   TINYINT(1)   DEFAULT 1,
  created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_subscriptions (
  id          VARCHAR(36) PRIMARY KEY,
  user_id     VARCHAR(36) NOT NULL,
  plan_id     VARCHAR(36) NOT NULL,
  started_at  DATETIME    DEFAULT CURRENT_TIMESTAMP,
  expires_at  DATETIME    NOT NULL,
  status      VARCHAR(20) DEFAULT 'active',
  transaction_id VARCHAR(36),
  FOREIGN KEY (user_id)  REFERENCES users(id)              ON DELETE CASCADE,
  FOREIGN KEY (plan_id)  REFERENCES subscription_plans(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reward_settings (
  id         VARCHAR(36)  PRIMARY KEY,
  difficulty VARCHAR(20)  UNIQUE NOT NULL,
  amount_usd DOUBLE       NOT NULL,
  updated_by VARCHAR(36),
  updated_at DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ai_validation_logs (
  id            VARCHAR(36) PRIMARY KEY,
  submission_id VARCHAR(36) NOT NULL,
  user_id       VARCHAR(36) NOT NULL,
  challenge_id  VARCHAR(36) NOT NULL,
  ai_score      INT,
  ai_confidence INT,
  ai_status     VARCHAR(20),
  ai_response   TEXT,
  model_used    VARCHAR(100),
  latency_ms    INT,
  created_at    DATETIME    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

SET FOREIGN_KEY_CHECKS=1;
`;

// ─── Column migrations (add missing columns to pre-existing tables) ──────────
const MIGRATIONS = [
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS language          VARCHAR(10)  DEFAULT 'en'`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone          VARCHAR(50)  DEFAULT 'UTC'`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_status        VARCHAR(20)  DEFAULT 'none'`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_currency VARCHAR(10) DEFAULT 'USD'`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url        TEXT`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS bio               TEXT`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified    TINYINT(1)   DEFAULT 0`,

  // challenges table — add columns missing from older schema versions
  `ALTER TABLE challenges ADD COLUMN IF NOT EXISTS category                    VARCHAR(100)`,
  `ALTER TABLE challenges ADD COLUMN IF NOT EXISTS supported_languages         TEXT`,
  `ALTER TABLE challenges ADD COLUMN IF NOT EXISTS time_limit_ms               INT          DEFAULT 5000`,
  `ALTER TABLE challenges ADD COLUMN IF NOT EXISTS memory_limit_mb             INT          DEFAULT 256`,
  `ALTER TABLE challenges ADD COLUMN IF NOT EXISTS max_submissions             INT          DEFAULT 10`,
  `ALTER TABLE challenges ADD COLUMN IF NOT EXISTS submission_cooldown_seconds INT          DEFAULT 30`,
  `ALTER TABLE challenges ADD COLUMN IF NOT EXISTS randomize_inputs            TINYINT(1)   DEFAULT 1`,
  `ALTER TABLE challenges ADD COLUMN IF NOT EXISTS solution_template           TEXT`,
  `ALTER TABLE challenges ADD COLUMN IF NOT EXISTS prize_usd                  DOUBLE       DEFAULT 0`,
  `ALTER TABLE challenges ADD COLUMN IF NOT EXISTS created_by                 VARCHAR(36)`,
  `ALTER TABLE challenges ADD COLUMN IF NOT EXISTS is_published               TINYINT(1)   DEFAULT 0`,

  // users — streak and subscription fields
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS current_streak      INT          DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS longest_streak      INT          DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_activity_date  DATE`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS solved_count        INT          DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code       VARCHAR(20)`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_plan   VARCHAR(20)  DEFAULT 'free'`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_expires_at DATETIME`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS github_url          VARCHAR(255)`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS twitter_url         VARCHAR(255)`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS website_url         VARCHAR(255)`,
];

// Admin seed — password: Ineza@12
const SEED = `
INSERT IGNORE INTO users (id, name, email, password_hash, role, country_code, language, kyc_verified, kyc_status, email_verified)
VALUES (
  'admin-00000000-0000-0000-0000-000000000001',
  'Platform Admin',
  'inezapaccy4@gmail.com',
  '$2a$12$AQwUuKhAyTb/xfrsj2Sdp.tIccn8c7EYmKkXmsQslyBx0T0/vlAkS',
  'admin', 'RW', 'en', 1, 'approved', 1
);
INSERT IGNORE INTO wallets (id, user_id, currency)
VALUES ('wallet-admin-00000000', 'admin-00000000-0000-0000-0000-000000000001', 'USD');

INSERT IGNORE INTO users (id, name, email, password_hash, role, country_code, language, phone, email_verified)
VALUES (
  'user-test-00000000-0000-0000-000000000001',
  'Test User',
  'testuser@codearena.com',
  '$2a$12$hc3t/TomlI5Cj2dSKNOU3ue2fIDXzPuFV1VjFnn/fUAKvOEpXYEE2',
  'user', 'US', 'en', '+1234567890', 1
);
INSERT IGNORE INTO wallets (id, user_id, balance, currency)
VALUES ('wallet-test-00000000', 'user-test-00000000-0000-0000-000000000001', 50.0, 'USD');

INSERT IGNORE INTO reward_settings (id, difficulty, amount_usd) VALUES
('rs-easy',   'easy',   5.00),
('rs-medium', 'medium', 15.00),
('rs-hard',   'hard',   40.00);

INSERT IGNORE INTO subscription_plans (id, slug, name, price_usd, duration_days, features) VALUES
('plan-free', 'free', 'Free', 0, 36500, '["Unlimited easy challenges","5 medium challenges/day","Community support"]'),
('plan-pro',  'pro',  'Pro',  9.99, 30, '["Unlimited all challenges","AI hints","Priority support","Ad-free","Bonus rewards x1.5","Download solutions"]'),
('plan-elite','elite','Elite',29.99,30, '["Everything in Pro","Unlimited contests","1-on-1 mentoring","Custom badges","Rewards x2.0","Early access"]');

INSERT IGNORE INTO badges (id, slug, name, description, icon, color, rarity) VALUES
('badge-001','first_blood',   'First Blood',      'Solve your first challenge',           '🩸','bg-red-600',    'common'),
('badge-002','quick_solver',  'Quick Solver',     'Solve a challenge in under 60 seconds','⚡','bg-yellow-500', 'rare'),
('badge-003','streak_3',      '3-Day Streak',     'Solve challenges 3 days in a row',     '🔥','bg-orange-500', 'common'),
('badge-004','streak_7',      'Week Warrior',     'Solve challenges 7 days in a row',     '💪','bg-orange-600', 'uncommon'),
('badge-005','streak_30',     'Month Champion',   'Solve challenges 30 days in a row',    '🏆','bg-purple-600', 'legendary'),
('badge-006','solved_10',     'Problem Solver',   'Solve 10 challenges',                  '🎯','bg-blue-500',   'common'),
('badge-007','solved_50',     'Expert Coder',     'Solve 50 challenges',                  '💎','bg-cyan-500',   'uncommon'),
('badge-008','solved_100',    'Code Master',      'Solve 100 challenges',                 '👑','bg-purple-500', 'rare'),
('badge-009','solved_500',    'Legendary',        'Solve 500 challenges',                 '🌟','bg-yellow-400', 'legendary'),
('badge-010','first_hard',    'Hard Mode',        'Solve your first hard challenge',      '🔴','bg-red-700',    'uncommon'),
('badge-011','top_10',        'Top 10',           'Reach top 10 on global leaderboard',   '🏅','bg-gold-500',   'rare'),
('badge-012','contest_winner','Contest Winner',   'Win a coding contest',                 '🥇','bg-yellow-600', 'legendary'),
('badge-013','referral_5',    'Community Builder','Refer 5 friends to the platform',      '👥','bg-green-500',  'uncommon'),
('badge-014','perfect_score', 'Perfectionist',    'Get 100% score 10 times in a row',     '💯','bg-emerald-500','rare'),
('badge-015','night_owl',     'Night Owl',        'Solve a challenge after midnight',     '🦉','bg-indigo-600', 'common');
`;

// ─── Challenges seed (50 Medium + 50 Hard) ──────────────────────────────────
const CHALLENGES_SEED = `
INSERT OR IGNORE INTO challenges (id,title,slug,description,difficulty,category,supported_languages,time_limit_ms,memory_limit_mb,is_published,prize_usd,created_by)
VALUES
('ch-m-001','Two Sum','two-sum','Read an array of integers from line 1 (space-separated) and a target integer from line 2. Print two 0-based indices (smaller index first, space-separated) of the two numbers that add up to the target. Exactly one solution is guaranteed.','medium','arrays','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',5000,256,1,0,NULL),
('ch-m-002','Longest Substring Without Repeating Characters','longest-substring-without-repeating-characters','Read a single string from stdin. Print the length of the longest substring without repeating characters.','medium','strings','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',5000,256,1,0,NULL),
('ch-m-003','Container With Most Water','container-with-most-water','Read n heights from stdin as space-separated integers on one line. Print the maximum amount of water a container can store (integer).','medium','arrays','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',5000,256,1,0,NULL),
('ch-m-004','Three Sum','three-sum','Read space-separated integers from stdin. Print all unique triplets that sum to zero, one triplet per line with numbers space-separated and each triplet sorted ascending, and triplets sorted lexicographically. If no triplets exist print "none".','medium','arrays','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',5000,256,1,0,NULL),
('ch-m-005','Merge Intervals','merge-intervals','Read intervals one per line as "start end" until EOF. Print merged non-overlapping intervals one per line as "start end".','medium','arrays','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',5000,256,1,0,NULL),
('ch-m-006','Jump Game','jump-game','Read space-separated non-negative integers from stdin representing max jump lengths. Print "true" if you can reach the last index from index 0, otherwise "false".','medium','arrays','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',5000,256,1,0,NULL),
('ch-m-007','House Robber','house-robber','Read space-separated non-negative integers from stdin representing house values. Print the maximum amount you can rob without robbing two adjacent houses.','medium','dynamic-programming','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',5000,256,1,0,NULL),
('ch-m-008','Unique Paths','unique-paths','Read two integers m and n space-separated from stdin (grid dimensions). Print the number of unique paths from top-left to bottom-right moving only right or down.','medium','dynamic-programming','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',5000,256,1,0,NULL),
('ch-m-009','Coin Change','coin-change','Read coin denominations space-separated on line 1 and the target amount on line 2. Print the fewest number of coins needed to make the amount, or -1 if impossible.','medium','dynamic-programming','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',5000,256,1,0,NULL),
('ch-m-010','Decode Ways','decode-ways','Read a string of digits from stdin. Print the number of ways to decode it where ''1''-''26'' map to letters A-Z.','medium','dynamic-programming','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',5000,256,1,0,NULL),
('ch-m-011','Product of Array Except Self','product-of-array-except-self','Read space-separated integers from stdin. Print an array where each element is the product of all other elements, space-separated. Do not use division.','medium','arrays','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',5000,256,1,0,NULL),
('ch-m-012','Find Peak Element','find-peak-element','Read space-separated integers from stdin. Print the index (0-based) of any peak element (greater than its neighbors). Print the smallest valid index.','medium','binary-search','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',5000,256,1,0,NULL),
('ch-m-013','Search in Rotated Sorted Array','search-in-rotated-sorted-array','Read a rotated sorted array of distinct integers space-separated on line 1 and a target integer on line 2. Print the 0-based index of the target or -1 if not found.','medium','binary-search','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',5000,256,1,0,NULL),
('ch-m-014','Top K Frequent Elements','top-k-frequent-elements','Read space-separated integers on line 1 and integer k on line 2. Print the k most frequent elements sorted in ascending order, space-separated.','medium','hash-map','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',5000,256,1,0,NULL),
('ch-m-015','Sort Colors','sort-colors','Read space-separated integers (0, 1, 2 only) from stdin. Print them sorted in-place order (all 0s then 1s then 2s), space-separated.','medium','arrays','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',5000,256,1,0,NULL),
('ch-m-016','Minimum Size Subarray Sum','minimum-size-subarray-sum','Read target integer on line 1 and space-separated positive integers on line 2. Print the minimal length of a contiguous subarray whose sum >= target, or 0 if none.','medium','sliding-window','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',5000,256,1,0,NULL),
('ch-m-017','Daily Temperatures','daily-temperatures','Read space-separated daily temperatures from stdin. Print space-separated counts of how many days until a warmer temperature for each day (0 if none).','medium','stack','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',5000,256,1,0,NULL),
('ch-m-018','Evaluate Reverse Polish Notation','evaluate-reverse-polish-notation','Read space-separated tokens from stdin representing a Reverse Polish Notation expression (operators: +, -, *, /). Print the integer result (truncate toward zero).','medium','stack','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',5000,256,1,0,NULL),
('ch-m-019','Climbing Stairs','climbing-stairs','Read a single integer n from stdin. Print the number of distinct ways to climb n stairs taking 1 or 2 steps at a time.','medium','dynamic-programming','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',5000,256,1,0,NULL),
('ch-m-020','Longest Increasing Subsequence','longest-increasing-subsequence','Read space-separated integers from stdin. Print the length of the longest strictly increasing subsequence.','medium','dynamic-programming','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',5000,256,1,0,NULL),
('ch-m-021','Longest Palindromic Substring','longest-palindromic-substring','Read a single string from stdin. Print the longest palindromic substring. If there is a tie, print the first occurrence.','medium','strings','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',5000,256,1,0,NULL),
('ch-m-022','Word Break','word-break','Read a word on line 1 and space-separated dictionary words on line 2. Print "true" if the word can be segmented into dictionary words, otherwise "false".','medium','dynamic-programming','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',5000,256,1,0,NULL),
('ch-m-023','Partition Equal Subset Sum','partition-equal-subset-sum','Read space-separated positive integers from stdin. Print "true" if the array can be partitioned into two subsets with equal sum, otherwise "false".','medium','dynamic-programming','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',5000,256,1,0,NULL),
('ch-m-024','Combination Sum','combination-sum','Read candidate integers space-separated on line 1 and a target integer on line 2. Print all unique combinations that sum to target (each combination sorted ascending, combinations sorted lexicographically, one per line). Print "none" if no combinations exist.','medium','backtracking','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',5000,256,1,0,NULL),
('ch-m-025','Permutations','permutations','Read space-separated distinct integers from stdin. Print all permutations sorted lexicographically, one per line with numbers space-separated.','medium','backtracking','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',5000,256,1,0,NULL),
('ch-m-026','Subsets','subsets','Read space-separated distinct integers from stdin. Print all subsets sorted lexicographically one per line (numbers space-separated). The empty subset prints as an empty line.','medium','backtracking','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',5000,256,1,0,NULL),
('ch-m-027','Letter Combinations of Phone Number','letter-combinations-of-phone-number','Read a digit string (2-9) from stdin. Print all letter combinations sorted lexicographically space-separated on one line. Print "none" for empty input.','medium','backtracking','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',5000,256,1,0,NULL),
('ch-m-028','Generate Parentheses','generate-parentheses','Read a single integer n from stdin. Print all combinations of n pairs of valid parentheses, sorted lexicographically, one per line.','medium','backtracking','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',5000,256,1,0,NULL),
('ch-m-029','Group Anagrams','group-anagrams','Read space-separated words from stdin. Group anagrams together. Within each group sort words alphabetically. Sort groups lexicographically by their first word. Print one group per line, words space-separated.','medium','hash-map','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',5000,256,1,0,NULL),
('ch-m-030','Spiral Matrix','spiral-matrix','Read an n x m matrix: first line has n and m space-separated, then n lines each with m space-separated integers. Print the spiral order as space-separated integers on one line.','medium','matrices','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',5000,256,1,0,NULL),
('ch-m-031','Rotate Image','rotate-image','Read an n x n matrix: first line has n, then n lines each with n space-separated integers. Print the matrix rotated 90 degrees clockwise, n lines each with n space-separated integers.','medium','matrices','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',5000,256,1,0,NULL),
('ch-m-032','Set Matrix Zeroes','set-matrix-zeroes','Read an n x m matrix: first line has n and m space-separated, then n lines each with m space-separated integers. If an element is 0, set its entire row and column to 0. Print the resulting matrix.','medium','matrices','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',5000,256,1,0,NULL),
('ch-m-033','Validate Binary Search Tree','validate-bst','Read a binary tree as BFS-level-order array on one line (space-separated, use "null" for missing nodes). Print "true" if it is a valid BST, otherwise "false".','medium','trees','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',5000,256,1,0,NULL),
('ch-m-034','Binary Tree Level Order Traversal','binary-tree-level-order-traversal','Read a binary tree as BFS-level-order array on one line (space-separated, use "null" for missing nodes). Print each level on a separate line with values space-separated.','medium','trees','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',5000,256,1,0,NULL),
('ch-m-035','Lowest Common Ancestor of BST','lowest-common-ancestor-bst','Read a BST as BFS-level-order array on line 1, value p on line 2, value q on line 3. Print the value of the lowest common ancestor node.','medium','trees','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',5000,256,1,0,NULL),
('ch-m-036','Number of Islands','number-of-islands','Read n and m space-separated on line 1, then n lines of the grid where each line contains m characters (0 or 1, no spaces). Print the number of islands (connected groups of 1s).','medium','graphs','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',5000,256,1,0,NULL),
('ch-m-037','Course Schedule','course-schedule','Read n (number of courses 0..n-1) on line 1, then prerequisite pairs one per line as "a b" (a requires b) until EOF. Print "true" if all courses can be finished (no cycle), otherwise "false".','medium','graphs','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',5000,256,1,0,NULL),
('ch-m-038','Pacific Atlantic Water Flow','pacific-atlantic-water-flow','Read n and m space-separated on line 1, then n lines each with m space-separated heights. Print cells (row col) that can flow to both Pacific and Atlantic oceans, sorted by row then col, one per line as "r c".','medium','graphs','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',5000,256,1,0,NULL),
('ch-m-039','Network Delay Time','network-delay-time','Read n (nodes) and k (source) space-separated on line 1, then edges as "u v w" per line until "done". Print the time for all nodes to receive signal or -1 if impossible.','medium','graphs','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',5000,256,1,0,NULL),
('ch-m-040','K Closest Points to Origin','k-closest-points-to-origin','Read k on line 1, then points as "x y" per line until EOF. Print the k closest points to the origin sorted by distance then by x then by y, one per line as "x y".','medium','sorting','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',5000,256,1,0,NULL),
('ch-m-041','Min Stack','min-stack','Read operations one per line: "push x", "pop", "top", "getMin". Print the result for each "top" and "getMin" operation, one per line.','medium','stack','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',5000,256,1,0,NULL),
('ch-m-042','Reorder List','reorder-list','Read space-separated integers representing a linked list. Reorder as L0->Ln->L1->Ln-1->... Print the reordered list space-separated.','medium','linked-list','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',5000,256,1,0,NULL),
('ch-m-043','Remove Nth Node From End','remove-nth-node-from-end','Read space-separated integers representing a linked list on line 1, integer n on line 2. Remove the nth node from the end. Print the resulting list space-separated.','medium','linked-list','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',5000,256,1,0,NULL),
('ch-m-044','Linked List Cycle II','linked-list-cycle-ii','Read space-separated integers on line 1 (list values) and pos on line 2 (0-based index where tail connects, -1 if no cycle). Print the 0-based index of the cycle start node, or -1 if no cycle.','medium','linked-list','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',5000,256,1,0,NULL),
('ch-m-045','Reverse Linked List','reverse-linked-list','Read space-separated integers representing a linked list. Print the reversed list space-separated.','medium','linked-list','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',5000,256,1,0,NULL),
('ch-m-046','Palindrome Partitioning','palindrome-partitioning','Read a single string from stdin. Print all partitions where every substring is a palindrome, sorted lexicographically, one per line (substrings space-separated).','medium','backtracking','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',5000,256,1,0,NULL),
('ch-m-047','Kth Smallest Element in BST','kth-smallest-element-in-bst','Read a BST as BFS-level-order array space-separated on line 1, integer k on line 2. Print the kth smallest value in the BST.','medium','trees','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',5000,256,1,0,NULL),
('ch-m-048','Maximum Product Subarray','maximum-product-subarray','Read space-separated integers from stdin. Print the maximum product of any contiguous subarray.','medium','dynamic-programming','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',5000,256,1,0,NULL),
('ch-m-049','Trapping Rain Water','trapping-rain-water','Read space-separated non-negative integers representing heights of bars. Print the total amount of trapped rain water.','medium','arrays','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',5000,256,1,0,NULL),
('ch-m-050','Jump Game II','jump-game-ii','Read space-separated non-negative integers from stdin. Print the minimum number of jumps to reach the last index from index 0. It is guaranteed you can reach the last index.','medium','greedy','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',5000,256,1,0,NULL);

INSERT OR IGNORE INTO challenges (id,title,slug,description,difficulty,category,supported_languages,time_limit_ms,memory_limit_mb,is_published,prize_usd,created_by)
VALUES
('ch-h-001','Median of Two Sorted Arrays','median-of-two-sorted-arrays','Read two sorted arrays: nums1 space-separated on line 1, nums2 space-separated on line 2. Print the median. If the median is a whole number print it as an integer, otherwise print with one decimal place (e.g. 2.5).','hard','binary-search','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',10000,256,1,0,NULL),
('ch-h-002','Regular Expression Matching','regular-expression-matching','Read a string s on line 1 and a pattern p on line 2. The pattern supports ''.'' (any char) and ''*'' (zero or more of preceding). Print "true" if s matches p entirely, otherwise "false".','hard','dynamic-programming','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',10000,256,1,0,NULL),
('ch-h-003','Wildcard Matching','wildcard-matching','Read a string s on line 1 and a pattern p on line 2. The pattern supports ''?'' (any single char) and ''*'' (any sequence). Print "true" if s matches p entirely, otherwise "false".','hard','dynamic-programming','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',10000,256,1,0,NULL),
('ch-h-004','N-Queens','n-queens','Read a single integer n from stdin. Print the number of distinct solutions to place n queens on an n x n chessboard.','hard','backtracking','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',10000,256,1,0,NULL),
('ch-h-005','Merge K Sorted Arrays','merge-k-sorted-arrays','Read k on line 1, then k lines each containing space-separated sorted integers. Print the merged sorted array space-separated.','hard','sorting','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',10000,256,1,0,NULL),
('ch-h-006','Word Ladder','word-ladder','Read beginWord on line 1, endWord on line 2, space-separated wordList on line 3. Print the length of the shortest transformation sequence from beginWord to endWord (changing one letter at a time, each intermediate word in wordList). Print 0 if no path exists.','hard','graphs','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',10000,256,1,0,NULL),
('ch-h-007','Sliding Window Maximum','sliding-window-maximum','Read space-separated integers on line 1 and window size k on line 2. Print the maximum of each sliding window of size k, space-separated.','hard','sliding-window','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',10000,256,1,0,NULL),
('ch-h-008','Edit Distance','edit-distance','Read word1 on line 1 and word2 on line 2. Print the minimum number of single-character edits (insert, delete, replace) to transform word1 into word2.','hard','dynamic-programming','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',10000,256,1,0,NULL),
('ch-h-009','Largest Rectangle in Histogram','largest-rectangle-in-histogram','Read space-separated non-negative integers representing bar heights from stdin. Print the area of the largest rectangle in the histogram.','hard','stack','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',10000,256,1,0,NULL),
('ch-h-010','Maximal Rectangle','maximal-rectangle','Read n and m space-separated on line 1, then n lines each with m space-separated binary digits (0 or 1). Print the area of the maximal rectangle containing only 1s.','hard','dynamic-programming','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',10000,256,1,0,NULL),
('ch-h-011','Burst Balloons','burst-balloons','Read space-separated integers representing balloon values from stdin. Bursting balloon i earns nums[i-1]*nums[i]*nums[i+1] coins (boundaries treated as 1). Print the maximum coins obtainable.','hard','dynamic-programming','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',10000,256,1,0,NULL),
('ch-h-012','Palindrome Partitioning II','palindrome-partitioning-ii','Read a single string from stdin. Print the minimum number of cuts needed to partition it so that every part is a palindrome.','hard','dynamic-programming','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',10000,256,1,0,NULL),
('ch-h-013','Distinct Subsequences','distinct-subsequences','Read string s on line 1 and string t on line 2. Print the number of distinct subsequences of s which equal t.','hard','dynamic-programming','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',10000,256,1,0,NULL),
('ch-h-014','Minimum Window Substring','minimum-window-substring','Read string s on line 1 and string t on line 2. Print the minimum window substring of s that contains all characters of t. Print empty string if none exists.','hard','sliding-window','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',10000,256,1,0,NULL),
('ch-h-015','Candy','candy','Read space-separated integer ratings from stdin. Print the minimum number of candies to distribute (each child gets at least 1; children with higher rating than a neighbor get more than that neighbor).','hard','greedy','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',10000,256,1,0,NULL),
('ch-h-016','Dungeon Game','dungeon-game','Read n and m space-separated on line 1, then n lines each with m space-separated integers (dungeon grid). Print the minimum initial health needed for the knight to reach the bottom-right room (health must stay >= 1).','hard','dynamic-programming','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',10000,256,1,0,NULL),
('ch-h-017','Reverse Nodes in k-Group','reverse-nodes-in-k-group','Read space-separated integers on line 1 (linked list) and k on line 2. Reverse nodes in groups of k. Print the resulting list space-separated.','hard','linked-list','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',10000,256,1,0,NULL),
('ch-h-018','Binary Tree Maximum Path Sum','binary-tree-maximum-path-sum','Read a binary tree as BFS-level-order array space-separated (use "null" for missing nodes). Print the maximum path sum (path can start and end at any node).','hard','trees','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',10000,256,1,0,NULL),
('ch-h-019','Serialize Deserialize Binary Tree','serialize-deserialize-binary-tree','Read a binary tree as BFS-level-order array space-separated (use "null" for missing nodes). Serialize and deserialize it, then print the resulting BFS-level-order array.','hard','trees','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',10000,256,1,0,NULL),
('ch-h-020','Word Search II','word-search-ii','Read n and m space-separated on line 1, then n lines of the grid (each line m letters no spaces), then space-separated words on the last line. Print found words sorted lexicographically, one per line.','hard','backtracking','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',10000,256,1,0,NULL),
('ch-h-021','Remove Invalid Parentheses','remove-invalid-parentheses','Read a string containing letters and parentheses from stdin. Print all minimum-removal results that produce valid parentheses, sorted lexicographically, one per line.','hard','backtracking','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',10000,256,1,0,NULL),
('ch-h-022','Expression Add Operators','expression-add-operators','Read a digit string on line 1 and a target integer on line 2. Print all expressions formed by inserting +, -, * between digits that evaluate to target, sorted lexicographically, one per line.','hard','backtracking','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',10000,256,1,0,NULL),
('ch-h-023','Count of Smaller Numbers After Self','count-of-smaller-numbers-after-self','Read space-separated integers from stdin. Print the count of smaller numbers to the right of each element, space-separated.','hard','divide-and-conquer','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',10000,256,1,0,NULL),
('ch-h-024','Maximum Profit in Job Scheduling','maximum-profit-in-job-scheduling','Read n on line 1, then n lines each with "start end profit". Print the maximum profit from non-overlapping jobs.','hard','dynamic-programming','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',10000,256,1,0,NULL),
('ch-h-025','Super Egg Drop','super-egg-drop','Read k (number of eggs) on line 1 and n (number of floors) on line 2. Print the minimum number of moves to determine the critical floor.','hard','dynamic-programming','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',10000,256,1,0,NULL),
('ch-h-026','Race Car','race-car','Read a single target integer from stdin. Print the minimum number of instructions (A=accelerate, R=reverse) to reach exactly the target position.','hard','dynamic-programming','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',10000,256,1,0,NULL),
('ch-h-027','Minimum Number of Refueling Stops','minimum-refueling-stops','Read target on line 1, startFuel on line 2, then station pairs "pos fuel" per line until EOF. Print the minimum number of refueling stops to reach target, or -1 if impossible.','hard','greedy','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',10000,256,1,0,NULL),
('ch-h-028','Strange Printer','strange-printer','Read a single string from stdin. Print the minimum number of turns for the strange printer to print the string (each turn prints a sequence of the same character).','hard','dynamic-programming','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',10000,256,1,0,NULL),
('ch-h-029','Cherry Pickup','cherry-pickup','Read n on line 1, then n lines each with n space-separated integers (-1=thorn, 0=empty, 1=cherry). Print the max cherries collected on down-right then up-left trip combined, or 0 if impossible.','hard','dynamic-programming','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',10000,256,1,0,NULL),
('ch-h-030','Tallest Billboard','tallest-billboard','Read space-separated rod lengths from stdin. Print the largest height of two equal steel supports you can make, or 0 if impossible.','hard','dynamic-programming','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',10000,256,1,0,NULL),
('ch-h-031','Data Stream as Disjoint Intervals','data-stream-as-disjoint-intervals','Read operations one per line: "addNum x" or "getIntervals". For each "getIntervals" print the current disjoint intervals sorted, one per line as "a b".','hard','design','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',10000,256,1,0,NULL),
('ch-h-032','Basic Calculator','basic-calculator','Read a valid arithmetic expression string (integers, +, -, (, ), spaces) from stdin. Print the integer result.','hard','stack','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',10000,256,1,0,NULL),
('ch-h-033','Jump Game II','jump-game-ii-hard','Read space-separated non-negative integers from stdin. Print the minimum number of jumps to reach the last index. Guaranteed reachable.','hard','greedy','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',10000,256,1,0,NULL),
('ch-h-034','Text Justification','text-justification','Read space-separated words on line 1 and maxWidth on line 2. Print the fully justified text, one line per output line.','hard','strings','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',10000,256,1,0,NULL),
('ch-h-035','Alien Dictionary','alien-dictionary','Read n on line 1, then n words in alien order. Print the characters in alien alphabet order (space-separated). Print "" if the ordering is invalid.','hard','graphs','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',10000,256,1,0,NULL),
('ch-h-036','LRU Cache','lru-cache','Read capacity on line 1, then operations: "get x" or "put x y". For each "get" print the value or -1 if not present.','hard','design','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',10000,256,1,0,NULL),
('ch-h-037','LFU Cache','lfu-cache','Read capacity on line 1, then operations: "get x" or "put x y". For each "get" print the value or -1. Evict the least-frequently-used key (break ties by LRU).','hard','design','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',10000,256,1,0,NULL),
('ch-h-038','Find Median from Data Stream','find-median-from-data-stream','Read operations one per line: "addNum x" or "findMedian". For each "findMedian" print the median. If median is whole print as integer, else one decimal.','hard','design','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',10000,256,1,0,NULL),
('ch-h-039','Shortest Path Visiting All Nodes','shortest-path-visiting-all-nodes','Read n on line 1, then n lines each listing space-separated neighbors of node i (0-indexed). Print the minimum steps to visit all nodes (can revisit).','hard','graphs','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',10000,256,1,0,NULL),
('ch-h-040','Minimum Cost to Connect All Points','minimum-cost-to-connect-all-points','Read n points, one per line as "x y". Print the minimum cost to connect all points (Manhattan distance MST).','hard','graphs','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',10000,256,1,0,NULL),
('ch-h-041','Bus Routes','bus-routes','Read n (number of routes) on line 1, then n lines of stops space-separated, then source on the next line, then target on the next line. Print the minimum number of buses to take from source to target, or -1 if impossible.','hard','graphs','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',10000,256,1,0,NULL),
('ch-h-042','Recover Binary Search Tree','recover-binary-search-tree','Read a BST with exactly two swapped nodes as BFS-level-order array (use "null" for missing). Print the corrected BST as BFS-level-order array.','hard','trees','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',10000,256,1,0,NULL),
('ch-h-043','Redundant Connection II','redundant-connection-ii','Read n (nodes 1..n) on line 1, then n edges each as "u v". Print the redundant directed edge "u v" that can be removed to make the graph a valid rooted tree.','hard','graphs','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',10000,256,1,0,NULL),
('ch-h-044','Minimum Genetic Mutation','minimum-genetic-mutation','Read start string on line 1, end string on line 2, space-separated bank on line 3. Print the minimum mutations to reach end from start using only bank strings (change one char at a time), or -1 if impossible.','hard','graphs','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',10000,256,1,0,NULL),
('ch-h-045','Kth Smallest in Multiplication Table','kth-smallest-in-multiplication-table','Read m on line 1, n on line 2, k on line 3. Print the kth smallest element in the m x n multiplication table.','hard','binary-search','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',10000,256,1,0,NULL),
('ch-h-046','Critical Connections in Network','critical-connections-in-network','Read n (nodes 0..n-1) on line 1, then edges "u v" per line until EOF. Print critical connections (bridges) sorted: each edge with smaller node first, edges sorted lexicographically, one per line.','hard','graphs','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',10000,256,1,0,NULL),
('ch-h-047','Sudoku Solver','sudoku-solver','Read 9 lines of the sudoku board (9 chars each, digits 1-9 and ''.'' for empty). Print the solved sudoku as 9 lines.','hard','backtracking','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',10000,256,1,0,NULL),
('ch-h-048','Trapping Rain Water II','trapping-rain-water-ii','Read n and m space-separated on line 1, then n lines each with m space-separated heights. Print the total trapped rain water in 3D.','hard','heap','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',10000,256,1,0,NULL),
('ch-h-049','Maximum Gap','maximum-gap','Read space-separated integers from stdin. Print the maximum difference between successive elements in the sorted form.','hard','sorting','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',10000,256,1,0,NULL),
('ch-h-050','Find K Pairs with Smallest Sums','find-k-pairs-with-smallest-sums','Read nums1 space-separated on line 1, nums2 space-separated on line 2, k on line 3. Print the k pairs (u,v) with smallest sums, one per line as "u v", sorted by sum then u then v.','hard','heap','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',10000,256,1,0,NULL);

-- ── Medium test cases ────────────────────────────────────────────────────────
-- ch-m-001 Two Sum
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-m-001-1','ch-m-001','2 7 11 15' || CHAR(10) || '9','0 1',1,0,1),
('tc-m-001-2','ch-m-001','3 2 4' || CHAR(10) || '6','1 2',1,0,2),
('tc-m-001-3','ch-m-001','1 5 3 8 2' || CHAR(10) || '10','1 3',0,1,3);

-- ch-m-002 Longest Substring Without Repeating Characters
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-m-002-1','ch-m-002','abcabcbb','3',1,0,1),
('tc-m-002-2','ch-m-002','bbbbb','1',1,0,2),
('tc-m-002-3','ch-m-002','pwwkew','3',0,1,3);

-- ch-m-003 Container With Most Water
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-m-003-1','ch-m-003','1 8 6 2 5 4 8 3 7','49',1,0,1),
('tc-m-003-2','ch-m-003','1 1','1',1,0,2),
('tc-m-003-3','ch-m-003','4 3 2 1 4','16',0,1,3);

-- ch-m-004 Three Sum
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-m-004-1','ch-m-004','-1 0 1 2 -1 -4','-1 -1 2' || CHAR(10) || '-1 0 1',1,0,1),
('tc-m-004-2','ch-m-004','0 1 1','none',1,0,2),
('tc-m-004-3','ch-m-004','0 0 0','0 0 0',0,1,3);

-- ch-m-005 Merge Intervals
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-m-005-1','ch-m-005','1 3' || CHAR(10) || '2 6' || CHAR(10) || '8 10' || CHAR(10) || '15 18','1 6' || CHAR(10) || '8 10' || CHAR(10) || '15 18',1,0,1),
('tc-m-005-2','ch-m-005','1 4' || CHAR(10) || '4 5','1 5',1,0,2),
('tc-m-005-3','ch-m-005','1 4' || CHAR(10) || '0 2' || CHAR(10) || '3 5','0 5',0,1,3);

-- ch-m-006 Jump Game
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-m-006-1','ch-m-006','2 3 1 1 4','true',1,0,1),
('tc-m-006-2','ch-m-006','3 2 1 0 4','false',1,0,2),
('tc-m-006-3','ch-m-006','0','true',0,1,3);

-- ch-m-007 House Robber
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-m-007-1','ch-m-007','1 2 3 1','4',1,0,1),
('tc-m-007-2','ch-m-007','2 7 9 3 1','12',1,0,2),
('tc-m-007-3','ch-m-007','5 3 4 11 2','16',0,1,3);

-- ch-m-008 Unique Paths
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-m-008-1','ch-m-008','3 7','28',1,0,1),
('tc-m-008-2','ch-m-008','3 2','3',1,0,2),
('tc-m-008-3','ch-m-008','4 4','20',0,1,3);

-- ch-m-009 Coin Change
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-m-009-1','ch-m-009','1 5 6 9' || CHAR(10) || '11','2',1,0,1),
('tc-m-009-2','ch-m-009','2' || CHAR(10) || '3','-1',1,0,2),
('tc-m-009-3','ch-m-009','1 2 5' || CHAR(10) || '11','3',0,1,3);

-- ch-m-010 Decode Ways
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-m-010-1','ch-m-010','12','2',1,0,1),
('tc-m-010-2','ch-m-010','226','3',1,0,2),
('tc-m-010-3','ch-m-010','06','0',0,1,3);

-- ch-m-011 Product of Array Except Self
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-m-011-1','ch-m-011','1 2 3 4','24 12 8 6',1,0,1),
('tc-m-011-2','ch-m-011','-1 1 0 -3 3','0 0 9 0 0',1,0,2),
('tc-m-011-3','ch-m-011','2 3 4 5','60 40 30 24',0,1,3);

-- ch-m-012 Find Peak Element
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-m-012-1','ch-m-012','1 2 3 1','2',1,0,1),
('tc-m-012-2','ch-m-012','1 2 1 3 5 6 4','1',1,0,2),
('tc-m-012-3','ch-m-012','3 1 2','0',0,1,3);

-- ch-m-013 Search in Rotated Sorted Array
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-m-013-1','ch-m-013','4 5 6 7 0 1 2' || CHAR(10) || '0','4',1,0,1),
('tc-m-013-2','ch-m-013','4 5 6 7 0 1 2' || CHAR(10) || '3','-1',1,0,2),
('tc-m-013-3','ch-m-013','1' || CHAR(10) || '0','-1',0,1,3);

-- ch-m-014 Top K Frequent Elements
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-m-014-1','ch-m-014','1 1 1 2 2 3' || CHAR(10) || '2','1 2',1,0,1),
('tc-m-014-2','ch-m-014','1' || CHAR(10) || '1','1',1,0,2),
('tc-m-014-3','ch-m-014','4 1 1 2 2 3 3' || CHAR(10) || '3','1 2 3',0,1,3);

-- ch-m-015 Sort Colors
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-m-015-1','ch-m-015','2 0 2 1 1 0','0 0 1 1 2 2',1,0,1),
('tc-m-015-2','ch-m-015','2 0 1','0 1 2',1,0,2),
('tc-m-015-3','ch-m-015','1 0 0 2 1','0 0 1 1 2',0,1,3);

-- ch-m-016 Minimum Size Subarray Sum
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-m-016-1','ch-m-016','7' || CHAR(10) || '2 3 1 2 4 3','2',1,0,1),
('tc-m-016-2','ch-m-016','4' || CHAR(10) || '1 4 4','1',1,0,2),
('tc-m-016-3','ch-m-016','11' || CHAR(10) || '1 1 1 1 1 1 1 1','0',0,1,3);

-- ch-m-017 Daily Temperatures
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-m-017-1','ch-m-017','73 74 75 71 69 72 76 73','1 1 4 2 1 1 0 0',1,0,1),
('tc-m-017-2','ch-m-017','30 40 50 60','1 1 1 0',1,0,2),
('tc-m-017-3','ch-m-017','30 60 90','1 1 0',0,1,3);

-- ch-m-018 Evaluate Reverse Polish Notation
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-m-018-1','ch-m-018','2 1 + 3 *','9',1,0,1),
('tc-m-018-2','ch-m-018','4 13 5 / +','6',1,0,2),
('tc-m-018-3','ch-m-018','10 6 9 3 + -11 * / * 17 + 5 +','22',0,1,3);

-- ch-m-019 Climbing Stairs
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-m-019-1','ch-m-019','2','2',1,0,1),
('tc-m-019-2','ch-m-019','3','3',1,0,2),
('tc-m-019-3','ch-m-019','10','89',0,1,3);

-- ch-m-020 Longest Increasing Subsequence
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-m-020-1','ch-m-020','10 9 2 5 3 7 101 18','4',1,0,1),
('tc-m-020-2','ch-m-020','0 1 0 3 2 3','4',1,0,2),
('tc-m-020-3','ch-m-020','7 7 7 7 7 7 7','1',0,1,3);

-- ch-m-021 Longest Palindromic Substring
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-m-021-1','ch-m-021','babad','bab',1,0,1),
('tc-m-021-2','ch-m-021','cbbd','bb',1,0,2),
('tc-m-021-3','ch-m-021','racecar','racecar',0,1,3);

-- ch-m-022 Word Break
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-m-022-1','ch-m-022','leetcode' || CHAR(10) || 'leet code','true',1,0,1),
('tc-m-022-2','ch-m-022','applepenapple' || CHAR(10) || 'apple pen','true',1,0,2),
('tc-m-022-3','ch-m-022','catsandog' || CHAR(10) || 'cats dog sand and cat','false',0,1,3);

-- ch-m-023 Partition Equal Subset Sum
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-m-023-1','ch-m-023','1 5 11 5','true',1,0,1),
('tc-m-023-2','ch-m-023','1 2 3 5','false',1,0,2),
('tc-m-023-3','ch-m-023','2 2 1 1','true',0,1,3);

-- ch-m-024 Combination Sum
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-m-024-1','ch-m-024','2 3 6 7' || CHAR(10) || '7','2 2 3' || CHAR(10) || '7',1,0,1),
('tc-m-024-2','ch-m-024','2 3 5' || CHAR(10) || '8','2 2 2 2' || CHAR(10) || '2 3 3' || CHAR(10) || '3 5',1,0,2),
('tc-m-024-3','ch-m-024','2' || CHAR(10) || '1','none',0,1,3);

-- ch-m-025 Permutations
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-m-025-1','ch-m-025','1 2 3','1 2 3' || CHAR(10) || '1 3 2' || CHAR(10) || '2 1 3' || CHAR(10) || '2 3 1' || CHAR(10) || '3 1 2' || CHAR(10) || '3 2 1',1,0,1),
('tc-m-025-2','ch-m-025','0 1','0 1' || CHAR(10) || '1 0',1,0,2),
('tc-m-025-3','ch-m-025','1','1',0,1,3);

-- ch-m-026 Subsets
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-m-026-1','ch-m-026','1 2 3','' || CHAR(10) || '1' || CHAR(10) || '1 2' || CHAR(10) || '1 2 3' || CHAR(10) || '1 3' || CHAR(10) || '2' || CHAR(10) || '2 3' || CHAR(10) || '3',1,0,1),
('tc-m-026-2','ch-m-026','0','' || CHAR(10) || '0',1,0,2),
('tc-m-026-3','ch-m-026','1 2','' || CHAR(10) || '1' || CHAR(10) || '1 2' || CHAR(10) || '2',0,1,3);

-- ch-m-027 Letter Combinations of Phone Number
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-m-027-1','ch-m-027','23','ad ae af bd be bf cd ce cf',1,0,1),
('tc-m-027-2','ch-m-027','','none',1,0,2),
('tc-m-027-3','ch-m-027','2','a b c',0,1,3);

-- ch-m-028 Generate Parentheses
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-m-028-1','ch-m-028','3','((()))' || CHAR(10) || '(()())' || CHAR(10) || '(())()' || CHAR(10) || '()(())' || CHAR(10) || '()()()',1,0,1),
('tc-m-028-2','ch-m-028','1','()',1,0,2),
('tc-m-028-3','ch-m-028','2','(())' || CHAR(10) || '()()',0,1,3);

-- ch-m-029 Group Anagrams
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-m-029-1','ch-m-029','eat tea tan ate nat bat','ate eat tea' || CHAR(10) || 'bat' || CHAR(10) || 'ant nat tan',1,0,1),
('tc-m-029-2','ch-m-029','','',1,0,2),
('tc-m-029-3','ch-m-029','a','a',0,1,3);

-- ch-m-030 Spiral Matrix
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-m-030-1','ch-m-030','3 3' || CHAR(10) || '1 2 3' || CHAR(10) || '4 5 6' || CHAR(10) || '7 8 9','1 2 3 6 9 8 7 4 5',1,0,1),
('tc-m-030-2','ch-m-030','3 4' || CHAR(10) || '1 2 3 4' || CHAR(10) || '5 6 7 8' || CHAR(10) || '9 10 11 12','1 2 3 4 8 12 11 10 9 5 6 7',1,0,2),
('tc-m-030-3','ch-m-030','1 4' || CHAR(10) || '1 2 3 4','1 2 3 4',0,1,3);

-- ch-m-031 Rotate Image
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-m-031-1','ch-m-031','3' || CHAR(10) || '1 2 3' || CHAR(10) || '4 5 6' || CHAR(10) || '7 8 9','7 4 1' || CHAR(10) || '8 5 2' || CHAR(10) || '9 6 3',1,0,1),
('tc-m-031-2','ch-m-031','2' || CHAR(10) || '1 2' || CHAR(10) || '3 4','3 1' || CHAR(10) || '4 2',1,0,2),
('tc-m-031-3','ch-m-031','1' || CHAR(10) || '5','5',0,1,3);

-- ch-m-032 Set Matrix Zeroes
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-m-032-1','ch-m-032','3 3' || CHAR(10) || '1 1 1' || CHAR(10) || '1 0 1' || CHAR(10) || '1 1 1','1 0 1' || CHAR(10) || '0 0 0' || CHAR(10) || '1 0 1',1,0,1),
('tc-m-032-2','ch-m-032','3 4' || CHAR(10) || '0 1 2 0' || CHAR(10) || '3 4 5 2' || CHAR(10) || '1 3 1 5','0 0 0 0' || CHAR(10) || '0 4 5 0' || CHAR(10) || '0 3 1 0',1,0,2),
('tc-m-032-3','ch-m-032','2 2' || CHAR(10) || '1 1' || CHAR(10) || '1 1','1 1' || CHAR(10) || '1 1',0,1,3);

-- ch-m-033 Validate BST
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-m-033-1','ch-m-033','2 1 3','true',1,0,1),
('tc-m-033-2','ch-m-033','5 1 4 null null 3 6','false',1,0,2),
('tc-m-033-3','ch-m-033','10 5 15 null null 6 20','false',0,1,3);

-- ch-m-034 Binary Tree Level Order Traversal
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-m-034-1','ch-m-034','3 9 20 null null 15 7','3' || CHAR(10) || '9 20' || CHAR(10) || '15 7',1,0,1),
('tc-m-034-2','ch-m-034','1','1',1,0,2),
('tc-m-034-3','ch-m-034','1 2 3 4 5','1' || CHAR(10) || '2 3' || CHAR(10) || '4 5',0,1,3);

-- ch-m-035 Lowest Common Ancestor BST
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-m-035-1','ch-m-035','6 2 8 0 4 7 9 null null 3 5' || CHAR(10) || '2' || CHAR(10) || '8','6',1,0,1),
('tc-m-035-2','ch-m-035','6 2 8 0 4 7 9 null null 3 5' || CHAR(10) || '2' || CHAR(10) || '4','2',1,0,2),
('tc-m-035-3','ch-m-035','2 1' || CHAR(10) || '2' || CHAR(10) || '1','2',0,1,3);

-- ch-m-036 Number of Islands
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-m-036-1','ch-m-036','4 5' || CHAR(10) || '11110' || CHAR(10) || '11010' || CHAR(10) || '11000' || CHAR(10) || '00000','1',1,0,1),
('tc-m-036-2','ch-m-036','4 5' || CHAR(10) || '11000' || CHAR(10) || '11000' || CHAR(10) || '00100' || CHAR(10) || '00011','3',1,0,2),
('tc-m-036-3','ch-m-036','1 1' || CHAR(10) || '1','1',0,1,3);

-- ch-m-037 Course Schedule
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-m-037-1','ch-m-037','2' || CHAR(10) || '1 0','true',1,0,1),
('tc-m-037-2','ch-m-037','2' || CHAR(10) || '1 0' || CHAR(10) || '0 1','false',1,0,2),
('tc-m-037-3','ch-m-037','3' || CHAR(10) || '0 1' || CHAR(10) || '1 2','true',0,1,3);

-- ch-m-038 Pacific Atlantic Water Flow
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-m-038-1','ch-m-038','5 5' || CHAR(10) || '1 2 2 3 5' || CHAR(10) || '3 2 3 4 4' || CHAR(10) || '2 4 5 3 1' || CHAR(10) || '6 7 1 4 5' || CHAR(10) || '5 1 1 2 4','0 4' || CHAR(10) || '1 3' || CHAR(10) || '1 4' || CHAR(10) || '2 2' || CHAR(10) || '3 0' || CHAR(10) || '3 1' || CHAR(10) || '4 0',1,0,1),
('tc-m-038-2','ch-m-038','1 1' || CHAR(10) || '1','0 0',1,0,2),
('tc-m-038-3','ch-m-038','2 2' || CHAR(10) || '1 2' || CHAR(10) || '4 3','0 1' || CHAR(10) || '1 0' || CHAR(10) || '1 1',0,1,3);

-- ch-m-039 Network Delay Time
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-m-039-1','ch-m-039','4 2' || CHAR(10) || '2 1 1' || CHAR(10) || '2 3 1' || CHAR(10) || '3 4 1' || CHAR(10) || 'done','2',1,0,1),
('tc-m-039-2','ch-m-039','2 2' || CHAR(10) || '2 1 1' || CHAR(10) || 'done','1',1,0,2),
('tc-m-039-3','ch-m-039','2 1' || CHAR(10) || 'done','-1',0,1,3);

-- ch-m-040 K Closest Points to Origin
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-m-040-1','ch-m-040','2' || CHAR(10) || '1 3' || CHAR(10) || '-2 2','-2 2' || CHAR(10) || '1 3',1,0,1),
('tc-m-040-2','ch-m-040','1' || CHAR(10) || '3 3' || CHAR(10) || '-2 4','3 3',1,0,2),
('tc-m-040-3','ch-m-040','2' || CHAR(10) || '0 1' || CHAR(10) || '1 0' || CHAR(10) || '2 2','0 1' || CHAR(10) || '1 0',0,1,3);

-- ch-m-041 Min Stack
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-m-041-1','ch-m-041','push -2' || CHAR(10) || 'push 0' || CHAR(10) || 'push -3' || CHAR(10) || 'getMin' || CHAR(10) || 'pop' || CHAR(10) || 'top' || CHAR(10) || 'getMin','-3' || CHAR(10) || '0' || CHAR(10) || '-2',1,0,1),
('tc-m-041-2','ch-m-041','push 5' || CHAR(10) || 'push 3' || CHAR(10) || 'push 7' || CHAR(10) || 'getMin' || CHAR(10) || 'top','3' || CHAR(10) || '7',1,0,2),
('tc-m-041-3','ch-m-041','push 1' || CHAR(10) || 'getMin' || CHAR(10) || 'push 0' || CHAR(10) || 'getMin','1' || CHAR(10) || '0',0,1,3);

-- ch-m-042 Reorder List
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-m-042-1','ch-m-042','1 2 3 4','1 4 2 3',1,0,1),
('tc-m-042-2','ch-m-042','1 2 3 4 5','1 5 2 4 3',1,0,2),
('tc-m-042-3','ch-m-042','1 2','1 2',0,1,3);

-- ch-m-043 Remove Nth Node From End
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-m-043-1','ch-m-043','1 2 3 4 5' || CHAR(10) || '2','1 2 3 5',1,0,1),
('tc-m-043-2','ch-m-043','1' || CHAR(10) || '1','',1,0,2),
('tc-m-043-3','ch-m-043','1 2' || CHAR(10) || '1','1',0,1,3);

-- ch-m-044 Linked List Cycle II
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-m-044-1','ch-m-044','3 1 0 -4' || CHAR(10) || '1','1',1,0,1),
('tc-m-044-2','ch-m-044','1 2' || CHAR(10) || '0','0',1,0,2),
('tc-m-044-3','ch-m-044','1' || CHAR(10) || '-1','-1',0,1,3);

-- ch-m-045 Reverse Linked List
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-m-045-1','ch-m-045','1 2 3 4 5','5 4 3 2 1',1,0,1),
('tc-m-045-2','ch-m-045','1 2','2 1',1,0,2),
('tc-m-045-3','ch-m-045','1','1',0,1,3);

-- ch-m-046 Palindrome Partitioning
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-m-046-1','ch-m-046','aab','a a b' || CHAR(10) || 'aa b',1,0,1),
('tc-m-046-2','ch-m-046','a','a',1,0,2),
('tc-m-046-3','ch-m-046','aba','a b a' || CHAR(10) || 'aba',0,1,3);

-- ch-m-047 Kth Smallest in BST
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-m-047-1','ch-m-047','3 1 4 null 2' || CHAR(10) || '1','1',1,0,1),
('tc-m-047-2','ch-m-047','5 3 6 2 4 null null 1' || CHAR(10) || '3','3',1,0,2),
('tc-m-047-3','ch-m-047','4 2 6 1 3' || CHAR(10) || '4','4',0,1,3);

-- ch-m-048 Maximum Product Subarray
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-m-048-1','ch-m-048','2 3 -2 4','6',1,0,1),
('tc-m-048-2','ch-m-048','-2 0 -1','0',1,0,2),
('tc-m-048-3','ch-m-048','-2 3 -4','24',0,1,3);

-- ch-m-049 Trapping Rain Water
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-m-049-1','ch-m-049','0 1 0 2 1 0 1 3 2 1 2 1','6',1,0,1),
('tc-m-049-2','ch-m-049','4 2 0 3 2 5','9',1,0,2),
('tc-m-049-3','ch-m-049','3 0 2 0 4','7',0,1,3);

-- ch-m-050 Jump Game II
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-m-050-1','ch-m-050','2 3 1 1 4','2',1,0,1),
('tc-m-050-2','ch-m-050','2 3 0 1 4','2',1,0,2),
('tc-m-050-3','ch-m-050','1 1 1 1','3',0,1,3);

-- ── Hard test cases ──────────────────────────────────────────────────────────
-- ch-h-001 Median of Two Sorted Arrays
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-h-001-1','ch-h-001','1 3' || CHAR(10) || '2','2',1,0,1),
('tc-h-001-2','ch-h-001','1 2' || CHAR(10) || '3 4','2.5',1,0,2),
('tc-h-001-3','ch-h-001','0 0' || CHAR(10) || '0 0','0',0,1,3);

-- ch-h-002 Regular Expression Matching
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-h-002-1','ch-h-002','aa' || CHAR(10) || 'a','false',1,0,1),
('tc-h-002-2','ch-h-002','aa' || CHAR(10) || 'a*','true',1,0,2),
('tc-h-002-3','ch-h-002','ab' || CHAR(10) || '.*','true',0,1,3);

-- ch-h-003 Wildcard Matching
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-h-003-1','ch-h-003','aa' || CHAR(10) || 'a','false',1,0,1),
('tc-h-003-2','ch-h-003','aa' || CHAR(10) || '*','true',1,0,2),
('tc-h-003-3','ch-h-003','adceb' || CHAR(10) || '*a*b','true',0,1,3);

-- ch-h-004 N-Queens
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-h-004-1','ch-h-004','4','2',1,0,1),
('tc-h-004-2','ch-h-004','1','1',1,0,2),
('tc-h-004-3','ch-h-004','5','10',0,1,3);

-- ch-h-005 Merge K Sorted Arrays
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-h-005-1','ch-h-005','3' || CHAR(10) || '1 4 5' || CHAR(10) || '1 3 4' || CHAR(10) || '2 6','1 1 2 3 4 4 5 6',1,0,1),
('tc-h-005-2','ch-h-005','1' || CHAR(10) || '1 2 3','1 2 3',1,0,2),
('tc-h-005-3','ch-h-005','2' || CHAR(10) || '1 3 5' || CHAR(10) || '2 4 6','1 2 3 4 5 6',0,1,3);

-- ch-h-006 Word Ladder
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-h-006-1','ch-h-006','hit' || CHAR(10) || 'cog' || CHAR(10) || 'hot dot dog lot log cog','5',1,0,1),
('tc-h-006-2','ch-h-006','hit' || CHAR(10) || 'cog' || CHAR(10) || 'hot dot dog lot log','0',1,0,2),
('tc-h-006-3','ch-h-006','a' || CHAR(10) || 'c' || CHAR(10) || 'a b c','2',0,1,3);

-- ch-h-007 Sliding Window Maximum
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-h-007-1','ch-h-007','1 3 -1 -3 5 3 6 7' || CHAR(10) || '3','3 3 5 5 6 7',1,0,1),
('tc-h-007-2','ch-h-007','1' || CHAR(10) || '1','1',1,0,2),
('tc-h-007-3','ch-h-007','9 11 8 5 7 10 2 13 6' || CHAR(10) || '4','11 11 8 10 10 13 13',0,1,3);

-- ch-h-008 Edit Distance
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-h-008-1','ch-h-008','horse' || CHAR(10) || 'ros','3',1,0,1),
('tc-h-008-2','ch-h-008','intention' || CHAR(10) || 'execution','5',1,0,2),
('tc-h-008-3','ch-h-008','' || CHAR(10) || 'abc','3',0,1,3);

-- ch-h-009 Largest Rectangle in Histogram
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-h-009-1','ch-h-009','2 1 5 6 2 3','10',1,0,1),
('tc-h-009-2','ch-h-009','2 4','4',1,0,2),
('tc-h-009-3','ch-h-009','6 7 5 2 4 5 9 3','16',0,1,3);

-- ch-h-010 Maximal Rectangle
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-h-010-1','ch-h-010','4 5' || CHAR(10) || '1 0 1 0 0' || CHAR(10) || '1 0 1 1 1' || CHAR(10) || '1 1 1 1 1' || CHAR(10) || '1 0 0 1 0','6',1,0,1),
('tc-h-010-2','ch-h-010','1 1' || CHAR(10) || '0','0',1,0,2),
('tc-h-010-3','ch-h-010','2 2' || CHAR(10) || '1 1' || CHAR(10) || '1 1','4',0,1,3);

-- ch-h-011 Burst Balloons
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-h-011-1','ch-h-011','3 1 5 8','167',1,0,1),
('tc-h-011-2','ch-h-011','1 5','10',1,0,2),
('tc-h-011-3','ch-h-011','7 9 8 0 7 1 3 5 5 2 6 3','1654',0,1,3);

-- ch-h-012 Palindrome Partitioning II
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-h-012-1','ch-h-012','aab','1',1,0,1),
('tc-h-012-2','ch-h-012','a','0',1,0,2),
('tc-h-012-3','ch-h-012','abcbc','2',0,1,3);

-- ch-h-013 Distinct Subsequences
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-h-013-1','ch-h-013','rabbbit' || CHAR(10) || 'rabbit','3',1,0,1),
('tc-h-013-2','ch-h-013','babgbag' || CHAR(10) || 'bag','5',1,0,2),
('tc-h-013-3','ch-h-013','abc' || CHAR(10) || 'abc','1',0,1,3);

-- ch-h-014 Minimum Window Substring
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-h-014-1','ch-h-014','ADOBECODEBANC' || CHAR(10) || 'ABC','BANC',1,0,1),
('tc-h-014-2','ch-h-014','a' || CHAR(10) || 'a','a',1,0,2),
('tc-h-014-3','ch-h-014','a' || CHAR(10) || 'b','',0,1,3);

-- ch-h-015 Candy
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-h-015-1','ch-h-015','1 0 2','5',1,0,1),
('tc-h-015-2','ch-h-015','1 2 2','4',1,0,2),
('tc-h-015-3','ch-h-015','1 3 2 2 1','7',0,1,3);

-- ch-h-016 Dungeon Game
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-h-016-1','ch-h-016','3 3' || CHAR(10) || '-2 -3 3' || CHAR(10) || '-5 -10 1' || CHAR(10) || '10 30 -5','7',1,0,1),
('tc-h-016-2','ch-h-016','1 1' || CHAR(10) || '0','1',1,0,2),
('tc-h-016-3','ch-h-016','1 2' || CHAR(10) || '1 -1','1',0,1,3);

-- ch-h-017 Reverse Nodes in k-Group
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-h-017-1','ch-h-017','1 2 3 4 5' || CHAR(10) || '2','2 1 4 3 5',1,0,1),
('tc-h-017-2','ch-h-017','1 2 3 4 5' || CHAR(10) || '3','3 2 1 4 5',1,0,2),
('tc-h-017-3','ch-h-017','1 2 3 4' || CHAR(10) || '4','4 3 2 1',0,1,3);

-- ch-h-018 Binary Tree Maximum Path Sum
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-h-018-1','ch-h-018','1 2 3','6',1,0,1),
('tc-h-018-2','ch-h-018','-10 9 20 null null 15 7','42',1,0,2),
('tc-h-018-3','ch-h-018','-3','-3',0,1,3);

-- ch-h-019 Serialize Deserialize Binary Tree
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-h-019-1','ch-h-019','1 2 3 null null 4 5','1 2 3 null null 4 5',1,0,1),
('tc-h-019-2','ch-h-019','1','1',1,0,2),
('tc-h-019-3','ch-h-019','1 2 3 4 null null 5','1 2 3 4 null null 5',0,1,3);

-- ch-h-020 Word Search II
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-h-020-1','ch-h-020','4 4' || CHAR(10) || 'oaan' || CHAR(10) || 'etae' || CHAR(10) || 'ihsr' || CHAR(10) || 'iflv' || CHAR(10) || 'oath eat','eat' || CHAR(10) || 'oath',1,0,1),
('tc-h-020-2','ch-h-020','2 2' || CHAR(10) || 'ab' || CHAR(10) || 'cd' || CHAR(10) || 'abcb','',1,0,2),
('tc-h-020-3','ch-h-020','1 3' || CHAR(10) || 'abc' || CHAR(10) || 'abc','abc',0,1,3);

-- ch-h-021 Remove Invalid Parentheses
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-h-021-1','ch-h-021','()())()','(())()' || CHAR(10) || '()()()',1,0,1),
('tc-h-021-2','ch-h-021','(a)())()','(a())()' || CHAR(10) || '(a)()()',1,0,2),
('tc-h-021-3','ch-h-021',')))','',0,1,3);

-- ch-h-022 Expression Add Operators
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-h-022-1','ch-h-022','123' || CHAR(10) || '6','1*2*3' || CHAR(10) || '1+2+3',1,0,1),
('tc-h-022-2','ch-h-022','232' || CHAR(10) || '8','2*3+2' || CHAR(10) || '2+3*2',1,0,2),
('tc-h-022-3','ch-h-022','3456237490' || CHAR(10) || '9191','',0,1,3);

-- ch-h-023 Count of Smaller Numbers After Self
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-h-023-1','ch-h-023','5 2 6 1','2 1 1 0',1,0,1),
('tc-h-023-2','ch-h-023','-1','0',1,0,2),
('tc-h-023-3','ch-h-023','-1 -1','0 0',0,1,3);

-- ch-h-024 Maximum Profit in Job Scheduling
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-h-024-1','ch-h-024','3' || CHAR(10) || '1 2 50' || CHAR(10) || '3 5 20' || CHAR(10) || '6 19 100','120',1,0,1),
('tc-h-024-2','ch-h-024','4' || CHAR(10) || '1 3 20' || CHAR(10) || '2 5 20' || CHAR(10) || '3 10 100' || CHAR(10) || '4 6 70','150',1,0,2),
('tc-h-024-3','ch-h-024','1' || CHAR(10) || '1 2 10','10',0,1,3);

-- ch-h-025 Super Egg Drop
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-h-025-1','ch-h-025','1' || CHAR(10) || '2','2',1,0,1),
('tc-h-025-2','ch-h-025','2' || CHAR(10) || '6','3',1,0,2),
('tc-h-025-3','ch-h-025','3' || CHAR(10) || '14','4',0,1,3);

-- ch-h-026 Race Car
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-h-026-1','ch-h-026','3','2',1,0,1),
('tc-h-026-2','ch-h-026','6','5',1,0,2),
('tc-h-026-3','ch-h-026','5','7',0,1,3);

-- ch-h-027 Minimum Number of Refueling Stops
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-h-027-1','ch-h-027','100' || CHAR(10) || '10' || CHAR(10) || '10 60' || CHAR(10) || '20 30' || CHAR(10) || '30 30' || CHAR(10) || '60 40','-1',1,0,1),
('tc-h-027-2','ch-h-027','100' || CHAR(10) || '1' || CHAR(10) || '10 100','1',1,0,2),
('tc-h-027-3','ch-h-027','100' || CHAR(10) || '100','0',0,1,3);

-- ch-h-028 Strange Printer
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-h-028-1','ch-h-028','aaabbb','2',1,0,1),
('tc-h-028-2','ch-h-028','aba','2',1,0,2),
('tc-h-028-3','ch-h-028','abcd','4',0,1,3);

-- ch-h-029 Cherry Pickup
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-h-029-1','ch-h-029','3' || CHAR(10) || '0 1 -1' || CHAR(10) || '1 0 -1' || CHAR(10) || '1 1 1','5',1,0,1),
('tc-h-029-2','ch-h-029','1' || CHAR(10) || '0','0',1,0,2),
('tc-h-029-3','ch-h-029','3' || CHAR(10) || '1 1 1' || CHAR(10) || '1 -1 1' || CHAR(10) || '1 1 1','8',0,1,3);

-- ch-h-030 Tallest Billboard
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-h-030-1','ch-h-030','1 2 3 6','6',1,0,1),
('tc-h-030-2','ch-h-030','1 2 3 4 5 6','10',1,0,2),
('tc-h-030-3','ch-h-030','1 2','0',0,1,3);

-- ch-h-031 Data Stream as Disjoint Intervals
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-h-031-1','ch-h-031','addNum 1' || CHAR(10) || 'addNum 3' || CHAR(10) || 'addNum 7' || CHAR(10) || 'addNum 2' || CHAR(10) || 'addNum 6' || CHAR(10) || 'getIntervals','1 3' || CHAR(10) || '6 7',1,0,1),
('tc-h-031-2','ch-h-031','addNum 5' || CHAR(10) || 'getIntervals','5 5',1,0,2),
('tc-h-031-3','ch-h-031','addNum 1' || CHAR(10) || 'addNum 2' || CHAR(10) || 'addNum 3' || CHAR(10) || 'getIntervals','1 3',0,1,3);

-- ch-h-032 Basic Calculator
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-h-032-1','ch-h-032','1 + 1','2',1,0,1),
('tc-h-032-2','ch-h-032',' 2-1 + 2 ','3',1,0,2),
('tc-h-032-3','ch-h-032','(1+(4+5+2)-3)+(6+8)','23',0,1,3);

-- ch-h-033 Jump Game II (hard variant)
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-h-033-1','ch-h-033','2 3 1 1 4','2',1,0,1),
('tc-h-033-2','ch-h-033','2 3 0 1 4','2',1,0,2),
('tc-h-033-3','ch-h-033','7 0 0 0 0 0 0 0','1',0,1,3);

-- ch-h-034 Text Justification
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-h-034-1','ch-h-034','What must be acknowledged' || CHAR(10) || '16','What    must    be' || CHAR(10) || 'acknowledged    ',1,0,1),
('tc-h-034-2','ch-h-034','This is an example of text justification.' || CHAR(10) || '16','This    is    an' || CHAR(10) || 'example  of text' || CHAR(10) || 'justification.  ',1,0,2),
('tc-h-034-3','ch-h-034','a' || CHAR(10) || '5','a    ',0,1,3);

-- ch-h-035 Alien Dictionary
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-h-035-1','ch-h-035','4' || CHAR(10) || 'wrt' || CHAR(10) || 'wrf' || CHAR(10) || 'er' || CHAR(10) || 'ett','w r t f e',1,0,1),
('tc-h-035-2','ch-h-035','1' || CHAR(10) || 'z','z',1,0,2),
('tc-h-035-3','ch-h-035','2' || CHAR(10) || 'abc' || CHAR(10) || 'ab','',0,1,3);

-- ch-h-036 LRU Cache
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-h-036-1','ch-h-036','2' || CHAR(10) || 'put 1 1' || CHAR(10) || 'put 2 2' || CHAR(10) || 'get 1' || CHAR(10) || 'put 3 3' || CHAR(10) || 'get 2' || CHAR(10) || 'put 4 4' || CHAR(10) || 'get 1' || CHAR(10) || 'get 3' || CHAR(10) || 'get 4','1' || CHAR(10) || '-1' || CHAR(10) || '-1' || CHAR(10) || '3' || CHAR(10) || '4',1,0,1),
('tc-h-036-2','ch-h-036','1' || CHAR(10) || 'put 2 1' || CHAR(10) || 'get 2' || CHAR(10) || 'put 3 2' || CHAR(10) || 'get 2' || CHAR(10) || 'get 3','1' || CHAR(10) || '-1' || CHAR(10) || '2',1,0,2),
('tc-h-036-3','ch-h-036','2' || CHAR(10) || 'put 1 10' || CHAR(10) || 'get 1' || CHAR(10) || 'get 2','10' || CHAR(10) || '-1',0,1,3);

-- ch-h-037 LFU Cache
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-h-037-1','ch-h-037','2' || CHAR(10) || 'put 1 1' || CHAR(10) || 'put 2 2' || CHAR(10) || 'get 1' || CHAR(10) || 'put 3 3' || CHAR(10) || 'get 2' || CHAR(10) || 'get 3','1' || CHAR(10) || '-1' || CHAR(10) || '3',1,0,1),
('tc-h-037-2','ch-h-037','1' || CHAR(10) || 'put 1 1' || CHAR(10) || 'get 1' || CHAR(10) || 'put 2 2' || CHAR(10) || 'get 1','1' || CHAR(10) || '-1',1,0,2),
('tc-h-037-3','ch-h-037','2' || CHAR(10) || 'put 1 10' || CHAR(10) || 'put 2 20' || CHAR(10) || 'get 1' || CHAR(10) || 'get 2','10' || CHAR(10) || '20',0,1,3);

-- ch-h-038 Find Median from Data Stream
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-h-038-1','ch-h-038','addNum 1' || CHAR(10) || 'addNum 2' || CHAR(10) || 'findMedian' || CHAR(10) || 'addNum 3' || CHAR(10) || 'findMedian','1.5' || CHAR(10) || '2',1,0,1),
('tc-h-038-2','ch-h-038','addNum 5' || CHAR(10) || 'findMedian','5',1,0,2),
('tc-h-038-3','ch-h-038','addNum 2' || CHAR(10) || 'addNum 3' || CHAR(10) || 'addNum 4' || CHAR(10) || 'findMedian','3',0,1,3);

-- ch-h-039 Shortest Path Visiting All Nodes
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-h-039-1','ch-h-039','4' || CHAR(10) || '1 2 3' || CHAR(10) || '0' || CHAR(10) || '0' || CHAR(10) || '0','4',1,0,1),
('tc-h-039-2','ch-h-039','2' || CHAR(10) || '1' || CHAR(10) || '0','1',1,0,2),
('tc-h-039-3','ch-h-039','3' || CHAR(10) || '1 2' || CHAR(10) || '0 2' || CHAR(10) || '0 1','2',0,1,3);

-- ch-h-040 Minimum Cost to Connect All Points
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-h-040-1','ch-h-040','0 0' || CHAR(10) || '2 2' || CHAR(10) || '3 10' || CHAR(10) || '5 2' || CHAR(10) || '7 0','20',1,0,1),
('tc-h-040-2','ch-h-040','3 12' || CHAR(10) || '-2 5' || CHAR(10) || '-4 1','18',1,0,2),
('tc-h-040-3','ch-h-040','0 0' || CHAR(10) || '1 1','2',0,1,3);

-- ch-h-041 Bus Routes
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-h-041-1','ch-h-041','2' || CHAR(10) || '1 2 7' || CHAR(10) || '3 6 7' || CHAR(10) || '1' || CHAR(10) || '6','2',1,0,1),
('tc-h-041-2','ch-h-041','1' || CHAR(10) || '1 2 3' || CHAR(10) || '1' || CHAR(10) || '3','1',1,0,2),
('tc-h-041-3','ch-h-041','1' || CHAR(10) || '1 2 3' || CHAR(10) || '1' || CHAR(10) || '4','-1',0,1,3);

-- ch-h-042 Recover Binary Search Tree
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-h-042-1','ch-h-042','1 3 null null 2','3 1 null null 2',1,0,1),
('tc-h-042-2','ch-h-042','3 1 4 null null 2','2 1 4 null null 3',1,0,2),
('tc-h-042-3','ch-h-042','5 3 8 1 4','5 4 8 1 3',0,1,3);

-- ch-h-043 Redundant Connection II
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-h-043-1','ch-h-043','3' || CHAR(10) || '1 2' || CHAR(10) || '1 3' || CHAR(10) || '2 3','2 3',1,0,1),
('tc-h-043-2','ch-h-043','4' || CHAR(10) || '1 2' || CHAR(10) || '2 3' || CHAR(10) || '3 4' || CHAR(10) || '4 1','4 1',1,0,2),
('tc-h-043-3','ch-h-043','3' || CHAR(10) || '2 1' || CHAR(10) || '3 1' || CHAR(10) || '1 3','1 3',0,1,3);

-- ch-h-044 Minimum Genetic Mutation
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-h-044-1','ch-h-044','AACCGGTT' || CHAR(10) || 'AACCGGTA' || CHAR(10) || 'AACCGGTA','1',1,0,1),
('tc-h-044-2','ch-h-044','AACCGGTT' || CHAR(10) || 'AAACGGTA' || CHAR(10) || 'AACCGGTA AACCGCTA AAACGGTA','2',1,0,2),
('tc-h-044-3','ch-h-044','AAAAACCC' || CHAR(10) || 'AACCCCCC' || CHAR(10) || 'AAAACCCC AAACCCCC AACCCCCC','3',0,1,3);

-- ch-h-045 Kth Smallest in Multiplication Table
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-h-045-1','ch-h-045','3' || CHAR(10) || '3' || CHAR(10) || '5','3',1,0,1),
('tc-h-045-2','ch-h-045','2' || CHAR(10) || '3' || CHAR(10) || '6','6',1,0,2),
('tc-h-045-3','ch-h-045','3' || CHAR(10) || '3' || CHAR(10) || '9','9',0,1,3);

-- ch-h-046 Critical Connections in Network
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-h-046-1','ch-h-046','4' || CHAR(10) || '0 1' || CHAR(10) || '1 2' || CHAR(10) || '2 0' || CHAR(10) || '1 3','1 3',1,0,1),
('tc-h-046-2','ch-h-046','2' || CHAR(10) || '0 1','0 1',1,0,2),
('tc-h-046-3','ch-h-046','5' || CHAR(10) || '0 1' || CHAR(10) || '0 2' || CHAR(10) || '1 2' || CHAR(10) || '2 3' || CHAR(10) || '3 4','2 3' || CHAR(10) || '3 4',0,1,3);

-- ch-h-047 Sudoku Solver
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-h-047-1','ch-h-047','53..7....' || CHAR(10) || '6..195...' || CHAR(10) || '.98....6.' || CHAR(10) || '8...6...3' || CHAR(10) || '4..8.3..1' || CHAR(10) || '7...2...6' || CHAR(10) || '.6....28.' || CHAR(10) || '...419..5' || CHAR(10) || '....8..79','534678912' || CHAR(10) || '672195348' || CHAR(10) || '198342567' || CHAR(10) || '859761423' || CHAR(10) || '426853791' || CHAR(10) || '713924856' || CHAR(10) || '961537284' || CHAR(10) || '287419635' || CHAR(10) || '345286179',1,0,1),
('tc-h-047-2','ch-h-047','.........' || CHAR(10) || '.........' || CHAR(10) || '.........' || CHAR(10) || '.........' || CHAR(10) || '.........' || CHAR(10) || '.........' || CHAR(10) || '.........' || CHAR(10) || '.........' || CHAR(10) || '.......12','123456789' || CHAR(10) || '456789123' || CHAR(10) || '789123456' || CHAR(10) || '214365897' || CHAR(10) || '365897214' || CHAR(10) || '897214365' || CHAR(10) || '531642978' || CHAR(10) || '642978531' || CHAR(10) || '978531642',1,0,2),
('tc-h-047-3','ch-h-047','..9748...' || CHAR(10) || '7........' || CHAR(10) || '.2.1.9...' || CHAR(10) || '..7...24.' || CHAR(10) || '.64.1.59.' || CHAR(10) || '.98...3..' || CHAR(10) || '...8.3.2.' || CHAR(10) || '........6' || CHAR(10) || '...2759..','519748632' || CHAR(10) || '783652419' || CHAR(10) || '426139875' || CHAR(10) || '357986241' || CHAR(10) || '264317598' || CHAR(10) || '198524367' || CHAR(10) || '975863124' || CHAR(10) || '832491756' || CHAR(10) || '641275983',0,1,3);

-- ch-h-048 Trapping Rain Water II
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-h-048-1','ch-h-048','3 6' || CHAR(10) || '1 4 3 1 3 2' || CHAR(10) || '3 2 1 3 2 4' || CHAR(10) || '2 3 3 2 3 1','4',1,0,1),
('tc-h-048-2','ch-h-048','1 1' || CHAR(10) || '5','0',1,0,2),
('tc-h-048-3','ch-h-048','4 4' || CHAR(10) || '12 13 1 12' || CHAR(10) || '13 4 13 12' || CHAR(10) || '13 8 10 12' || CHAR(10) || '12 13 12 12','14',0,1,3);

-- ch-h-049 Maximum Gap
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-h-049-1','ch-h-049','3 6 9 1','3',1,0,1),
('tc-h-049-2','ch-h-049','10','0',1,0,2),
('tc-h-049-3','ch-h-049','1 1000000','999999',0,1,3);

-- ch-h-050 Find K Pairs with Smallest Sums
INSERT OR IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-h-050-1','ch-h-050','1 7 11' || CHAR(10) || '2 4 6' || CHAR(10) || '3','1 2' || CHAR(10) || '1 4' || CHAR(10) || '1 6',1,0,1),
('tc-h-050-2','ch-h-050','1 1 2' || CHAR(10) || '1 2 3' || CHAR(10) || '2','1 1' || CHAR(10) || '1 1',1,0,2),
('tc-h-050-3','ch-h-050','1 2' || CHAR(10) || '3' || CHAR(10) || '1','1 3',0,1,3);
`;

// ─── HTML easy challenge ─────────────────────────────────────────────────────
const HTML_CHALLENGE_SEED = `
INSERT IGNORE INTO challenges (id,title,slug,description,difficulty,category,supported_languages,time_limit_ms,memory_limit_mb,is_published,prize_usd,created_by)
VALUES ('ch-e-001','HTML List Builder','html-list-builder','Read a page title on line 1, then read items one per line until EOF. Output a complete HTML page using exactly this format:\n<!DOCTYPE html>\n<html>\n<head><title>TITLE</title></head>\n<body>\n<h1>TITLE</h1>\n<ul>\n<li>ITEM</li>\n</ul>\n</body>\n</html>','easy','html','["javascript","typescript","python","java","cpp","csharp","php","go","rust","swift","kotlin","ruby"]',5000,256,1,0,NULL);

INSERT IGNORE INTO test_cases(id,challenge_id,input,expected_output,is_sample,is_hidden,order_index) VALUES
('tc-e-001-1','ch-e-001','My Page\nItem 1\nItem 2','<!DOCTYPE html>\n<html>\n<head><title>My Page</title></head>\n<body>\n<h1>My Page</h1>\n<ul>\n<li>Item 1</li>\n<li>Item 2</li>\n</ul>\n</body>\n</html>',1,0,1),
('tc-e-001-2','ch-e-001','Shopping List\nApples\nBananas\nMilk','<!DOCTYPE html>\n<html>\n<head><title>Shopping List</title></head>\n<body>\n<h1>Shopping List</h1>\n<ul>\n<li>Apples</li>\n<li>Bananas</li>\n<li>Milk</li>\n</ul>\n</body>\n</html>',1,0,2),
('tc-e-001-3','ch-e-001','Colors\nRed\nGreen\nBlue','<!DOCTYPE html>\n<html>\n<head><title>Colors</title></head>\n<body>\n<h1>Colors</h1>\n<ul>\n<li>Red</li>\n<li>Green</li>\n<li>Blue</li>\n</ul>\n</body>\n</html>',0,1,3);
`;

// ─── Service ────────────────────────────────────────────────────────────────

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool!: mysql.Pool;
  private readonly logger = new Logger(DatabaseService.name);

  async onModuleInit() {
    const host     = process.env.DB_HOST     || 'localhost';
    const port     = parseInt(process.env.DB_PORT || '3306');
    const user     = process.env.DB_USER     || 'root';
    const password = process.env.DB_PASSWORD || '';
    const database = process.env.DB_NAME     || 'codearena';

    // Create database if it doesn't exist, then run schema + seeds
    const init = await mysql.createConnection({ host, port, user, password, multipleStatements: true });
    try {
      await init.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      await init.query(`USE \`${database}\``);

      // Execute each DDL statement individually so SET FOREIGN_KEY_CHECKS=0 persists
      const schemaStmts = SCHEMA.split(/;[ \t]*\n/).map(s => s.trim()).filter(Boolean);
      for (const stmt of schemaStmts) {
        await init.query(stmt);
      }

      // Add missing columns to pre-existing tables
      for (const stmt of MIGRATIONS) {
        try { await init.query(stmt); } catch {}
      }

      await init.query(SEED);
      await init.query(sqliteToMySQL(CHALLENGES_SEED));
      await init.query(HTML_CHALLENGE_SEED);
    } finally {
      await init.end();
    }

    this.pool = mysql.createPool({
      host, port, user, password, database,
      waitForConnections: true,
      connectionLimit: 10,
      dateStrings: true,
    });

    this.logger.log(`MySQL ready: ${host}:${port}/${database}`);
  }

  async onModuleDestroy() {
    await this.pool?.end();
  }

  // ─── Public query API ───────────────────────────────────────────────────

  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    const [rows] = await (params?.length
      ? this.pool.execute<any>(sql, params)
      : this.pool.query<any>(sql));
    return hydrate(rows as any[]) as T[];
  }

  async queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows[0] ?? null;
  }

  async queryMany<T = any>(sql: string, params?: any[]): Promise<T[]> {
    return this.query<T>(sql, params);
  }

  async execute(sql: string, params?: any[]): Promise<any> {
    const [result] = await this.pool.execute(sql, params || []);
    return result;
  }

  // ─── Transactions ───────────────────────────────────────────────────────

  async transaction<T>(fn: (conn: MySQLConn) => Promise<T>): Promise<T> {
    const raw  = await this.pool.getConnection();
    const conn = new MySQLConn(raw);
    await raw.beginTransaction();
    try {
      const result = await fn(conn);
      await raw.commit();
      return result;
    } catch (err) {
      await raw.rollback();
      throw err;
    } finally {
      raw.release();
    }
  }

  async txQuery<T = any>(conn: MySQLConn, sql: string, params?: any[]): Promise<T[]> {
    const [rows] = await conn.query<T>(sql, params);
    return rows;
  }

  async txQueryOne<T = any>(conn: MySQLConn, sql: string, params?: any[]): Promise<T | null> {
    const [rows] = await conn.query<T>(sql, params);
    return rows[0] ?? null;
  }
}
