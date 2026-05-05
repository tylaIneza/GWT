-- ============================================================
-- CODE CHALLENGE PLATFORM — POSTGRESQL SCHEMA
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20)  NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  phone         VARCHAR(30),
  country_code  VARCHAR(5)   DEFAULT 'RW',
  is_banned     BOOLEAN      DEFAULT FALSE,
  ban_reason    TEXT,
  risk_score    INTEGER      DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  kyc_verified  BOOLEAN      DEFAULT FALSE,
  total_earnings DECIMAL(15,2) DEFAULT 0.00,
  created_at    TIMESTAMPTZ  DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX idx_users_email    ON users(email);
CREATE INDEX idx_users_role     ON users(role);
CREATE INDEX idx_users_risk     ON users(risk_score DESC);

-- ============================================================
-- WALLETS (optimistic locking with version)
-- ============================================================
CREATE TABLE IF NOT EXISTS wallets (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  balance         DECIMAL(15,2) NOT NULL DEFAULT 0.00 CHECK (balance >= 0),
  locked_balance  DECIMAL(15,2) NOT NULL DEFAULT 0.00 CHECK (locked_balance >= 0),
  currency        VARCHAR(3)  NOT NULL DEFAULT 'RWF',
  version         INTEGER     NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wallets_user ON wallets(user_id);

-- ============================================================
-- TRANSACTIONS (immutable ledger)
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id           UUID        NOT NULL REFERENCES wallets(id),
  user_id             UUID        NOT NULL REFERENCES users(id),
  type                VARCHAR(50) NOT NULL CHECK (type IN (
    'deposit', 'withdrawal', 'contest_entry', 'prize_payout', 'refund', 'adjustment'
  )),
  amount              DECIMAL(15,2) NOT NULL CHECK (amount > 0),
  balance_before      DECIMAL(15,2) NOT NULL,
  balance_after       DECIMAL(15,2) NOT NULL,
  status              VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'completed', 'failed', 'reversed'
  )),
  reference           VARCHAR(255) UNIQUE,
  payment_provider    VARCHAR(50),
  provider_reference  VARCHAR(255),
  metadata            JSONB,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_user      ON transactions(user_id);
CREATE INDEX idx_transactions_wallet    ON transactions(wallet_id);
CREATE INDEX idx_transactions_status    ON transactions(status);
CREATE INDEX idx_transactions_type      ON transactions(type);
CREATE INDEX idx_transactions_created   ON transactions(created_at DESC);

-- ============================================================
-- CHALLENGES
-- ============================================================
CREATE TABLE IF NOT EXISTS challenges (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title                       VARCHAR(255) NOT NULL,
  slug                        VARCHAR(255) UNIQUE NOT NULL,
  description                 TEXT        NOT NULL,
  difficulty                  VARCHAR(20) NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  category                    VARCHAR(100),
  supported_languages         TEXT[]      DEFAULT ARRAY['javascript', 'python'],
  time_limit_ms               INTEGER     DEFAULT 5000,
  memory_limit_mb             INTEGER     DEFAULT 256,
  max_submissions             INTEGER     DEFAULT 10,
  submission_cooldown_seconds INTEGER     DEFAULT 30,
  is_published                BOOLEAN     DEFAULT FALSE,
  randomize_inputs            BOOLEAN     DEFAULT TRUE,
  solution_template           JSONB,       -- {javascript: '...', python: '...'}
  created_by                  UUID        REFERENCES users(id),
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_challenges_slug        ON challenges(slug);
CREATE INDEX idx_challenges_difficulty  ON challenges(difficulty);
CREATE INDEX idx_challenges_published   ON challenges(is_published);

-- ============================================================
-- TEST CASES
-- ============================================================
CREATE TABLE IF NOT EXISTS test_cases (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id    UUID        NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  input           TEXT        NOT NULL,
  expected_output TEXT        NOT NULL,
  is_sample       BOOLEAN     DEFAULT FALSE,
  is_hidden       BOOLEAN     DEFAULT TRUE,
  points          INTEGER     DEFAULT 1,
  order_index     INTEGER     DEFAULT 0,
  explanation     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_test_cases_challenge   ON test_cases(challenge_id);
CREATE INDEX idx_test_cases_sample      ON test_cases(challenge_id, is_sample);

-- ============================================================
-- SUBMISSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS submissions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES users(id),
  challenge_id        UUID        NOT NULL REFERENCES challenges(id),
  contest_id          UUID,
  language            VARCHAR(50) NOT NULL,
  code                TEXT        NOT NULL,
  status              VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'running', 'accepted', 'wrong_answer',
    'time_limit_exceeded', 'runtime_error', 'compilation_error', 'cheating_suspected'
  )),
  score               INTEGER     DEFAULT 0,
  execution_time_ms   INTEGER,
  memory_used_mb      DECIMAL(10,2),
  test_results        JSONB,
  risk_score          INTEGER     DEFAULT 0,
  ip_address          INET,
  user_agent          TEXT,
  typing_stats        JSONB,
  paste_count         INTEGER     DEFAULT 0,
  time_to_first_char  INTEGER,
  submitted_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_submissions_user       ON submissions(user_id);
CREATE INDEX idx_submissions_challenge  ON submissions(challenge_id);
CREATE INDEX idx_submissions_contest    ON submissions(contest_id);
CREATE INDEX idx_submissions_status     ON submissions(status);
CREATE INDEX idx_submissions_time       ON submissions(submitted_at DESC);

-- ============================================================
-- CONTESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS contests (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title               VARCHAR(255) NOT NULL,
  description         TEXT,
  entry_fee           DECIMAL(15,2) NOT NULL DEFAULT 0.00 CHECK (entry_fee >= 0),
  prize_pool          DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  prize_distribution  JSONB        DEFAULT '[{"rank":1,"percentage":60},{"rank":2,"percentage":30},{"rank":3,"percentage":10}]',
  start_time          TIMESTAMPTZ  NOT NULL,
  end_time            TIMESTAMPTZ  NOT NULL,
  max_participants    INTEGER,
  status              VARCHAR(20)  NOT NULL DEFAULT 'upcoming' CHECK (status IN (
    'upcoming', 'active', 'completed', 'cancelled'
  )),
  is_rated            BOOLEAN      DEFAULT TRUE,
  created_by          UUID         REFERENCES users(id),
  created_at          TIMESTAMPTZ  DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  DEFAULT NOW(),
  CONSTRAINT valid_contest_times CHECK (end_time > start_time)
);

CREATE INDEX idx_contests_status    ON contests(status);
CREATE INDEX idx_contests_start     ON contests(start_time);

-- ============================================================
-- CONTEST CHALLENGES (many-to-many)
-- ============================================================
CREATE TABLE IF NOT EXISTS contest_challenges (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id      UUID    NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  challenge_id    UUID    NOT NULL REFERENCES challenges(id),
  order_index     INTEGER DEFAULT 0,
  UNIQUE(contest_id, challenge_id)
);

-- ============================================================
-- CONTEST PARTICIPANTS
-- ============================================================
CREATE TABLE IF NOT EXISTS contest_participants (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id      UUID        NOT NULL REFERENCES contests(id),
  user_id         UUID        NOT NULL REFERENCES users(id),
  transaction_id  UUID        REFERENCES transactions(id),
  score           INTEGER     DEFAULT 0,
  total_time_ms   BIGINT      DEFAULT 0,
  rank            INTEGER,
  prize_amount    DECIMAL(15,2),
  prize_paid      BOOLEAN     DEFAULT FALSE,
  joined_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(contest_id, user_id)
);

CREATE INDEX idx_participants_contest   ON contest_participants(contest_id);
CREATE INDEX idx_participants_user      ON contest_participants(user_id);
CREATE INDEX idx_participants_rank      ON contest_participants(contest_id, rank);

-- ============================================================
-- LEADERBOARDS
-- ============================================================
CREATE TABLE IF NOT EXISTS leaderboards (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id      UUID        NOT NULL REFERENCES contests(id),
  user_id         UUID        NOT NULL REFERENCES users(id),
  user_name       VARCHAR(255),
  rank            INTEGER     NOT NULL,
  score           INTEGER     DEFAULT 0,
  total_time_ms   BIGINT      DEFAULT 0,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(contest_id, user_id)
);

CREATE INDEX idx_leaderboard_contest    ON leaderboards(contest_id, rank);

-- ============================================================
-- USER SESSIONS (anti-cheat: multi-account detection)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_sessions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash      VARCHAR(255) NOT NULL,
  ip_address      INET,
  user_agent      TEXT,
  is_active       BOOLEAN     DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at    TIMESTAMPTZ DEFAULT NOW(),
  expires_at      TIMESTAMPTZ
);

CREATE INDEX idx_sessions_user          ON user_sessions(user_id);
CREATE INDEX idx_sessions_ip            ON user_sessions(ip_address);
CREATE INDEX idx_sessions_active        ON user_sessions(user_id, is_active);

-- ============================================================
-- DEVICE FINGERPRINTS (anti-cheat)
-- ============================================================
CREATE TABLE IF NOT EXISTS device_fingerprints (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES users(id),
  fingerprint_hash  VARCHAR(255) NOT NULL,
  user_agent        TEXT,
  ip_address        INET,
  screen_res        VARCHAR(20),
  timezone          VARCHAR(100),
  first_seen_at     TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, fingerprint_hash)
);

CREATE INDEX idx_fingerprints_user  ON device_fingerprints(user_id);
CREATE INDEX idx_fingerprints_hash  ON device_fingerprints(fingerprint_hash);
CREATE INDEX idx_fingerprints_ip    ON device_fingerprints(ip_address);

-- ============================================================
-- CHEAT FLAGS (anti-cheat review queue)
-- ============================================================
CREATE TABLE IF NOT EXISTS cheat_flags (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id),
  submission_id   UUID        REFERENCES submissions(id),
  contest_id      UUID        REFERENCES contests(id),
  flag_type       VARCHAR(100) NOT NULL,
  severity        VARCHAR(20) NOT NULL DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  risk_score      INTEGER     DEFAULT 0,
  details         JSONB,
  is_reviewed     BOOLEAN     DEFAULT FALSE,
  reviewed_by     UUID        REFERENCES users(id),
  review_action   VARCHAR(50),
  review_notes    TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_flags_user         ON cheat_flags(user_id);
CREATE INDEX idx_flags_reviewed     ON cheat_flags(is_reviewed);
CREATE INDEX idx_flags_severity     ON cheat_flags(severity);

-- ============================================================
-- SEED: Admin user (password: Admin@1234)
-- bcrypt hash of 'Admin@1234' with cost 12
-- ============================================================
INSERT INTO users (name, email, password_hash, role) VALUES
  ('Platform Admin', 'admin@codeplatform.rw',
   '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TqwnlfX1CLSKg1/GvMSrPRVGdFli', 'admin')
ON CONFLICT (email) DO NOTHING;
