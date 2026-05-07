-- ============================================================
-- CODE ARENA — MYSQL / MARIADB SCHEMA
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id            VARCHAR(36)   PRIMARY KEY,
  name          VARCHAR(255)  NOT NULL,
  email         VARCHAR(255)  UNIQUE NOT NULL,
  password_hash VARCHAR(255)  NOT NULL,
  role          VARCHAR(20)   NOT NULL DEFAULT 'user',
  phone         VARCHAR(30),
  country_code  VARCHAR(5)    DEFAULT 'RW',
  is_banned     TINYINT(1)    DEFAULT 0,
  ban_reason    TEXT,
  risk_score    INT           DEFAULT 0,
  kyc_verified  TINYINT(1)    DEFAULT 0,
  total_earnings DECIMAL(15,2) DEFAULT 0.00,
  created_at    DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wallets (
  id             VARCHAR(36)   PRIMARY KEY,
  user_id        VARCHAR(36)   NOT NULL UNIQUE,
  balance        DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  locked_balance DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  currency       VARCHAR(3)    NOT NULL DEFAULT 'RWF',
  version        INT           NOT NULL DEFAULT 0,
  updated_at     DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS transactions (
  id                 VARCHAR(36)   PRIMARY KEY,
  wallet_id          VARCHAR(36)   NOT NULL,
  user_id            VARCHAR(36)   NOT NULL,
  type               VARCHAR(50)   NOT NULL,
  amount             DECIMAL(15,2) NOT NULL,
  balance_before     DECIMAL(15,2) NOT NULL,
  balance_after      DECIMAL(15,2) NOT NULL,
  status             VARCHAR(20)   NOT NULL DEFAULT 'pending',
  reference          VARCHAR(255)  UNIQUE,
  payment_provider   VARCHAR(50),
  provider_reference VARCHAR(255),
  metadata           JSON,
  created_at         DATETIME      DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (wallet_id) REFERENCES wallets(id),
  FOREIGN KEY (user_id)   REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS challenges (
  id                          VARCHAR(36)   PRIMARY KEY,
  title                       VARCHAR(255)  NOT NULL,
  slug                        VARCHAR(255)  UNIQUE NOT NULL,
  description                 TEXT          NOT NULL,
  difficulty                  VARCHAR(20)   NOT NULL DEFAULT 'easy',
  category                    VARCHAR(100),
  supported_languages         JSON,
  time_limit_ms               INT           DEFAULT 5000,
  memory_limit_mb             INT           DEFAULT 256,
  max_submissions             INT           DEFAULT 10,
  submission_cooldown_seconds INT           DEFAULT 30,
  is_published                TINYINT(1)    DEFAULT 0,
  randomize_inputs            TINYINT(1)    DEFAULT 1,
  solution_template           JSON,
  created_by                  VARCHAR(36),
  created_at                  DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at                  DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS test_cases (
  id               VARCHAR(36)  PRIMARY KEY,
  challenge_id     VARCHAR(36)  NOT NULL,
  input            TEXT         NOT NULL,
  expected_output  TEXT         NOT NULL,
  is_sample        TINYINT(1)   DEFAULT 0,
  is_hidden        TINYINT(1)   DEFAULT 1,
  points           INT          DEFAULT 1,
  order_index      INT          DEFAULT 0,
  explanation      TEXT,
  created_at       DATETIME     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS contests (
  id                 VARCHAR(36)   PRIMARY KEY,
  title              VARCHAR(255)  NOT NULL,
  description        TEXT,
  entry_fee          DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  prize_pool         DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  prize_distribution JSON,
  start_time         DATETIME      NOT NULL,
  end_time           DATETIME      NOT NULL,
  max_participants   INT,
  status             VARCHAR(20)   NOT NULL DEFAULT 'upcoming',
  is_rated           TINYINT(1)    DEFAULT 1,
  created_by         VARCHAR(36),
  created_at         DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS contest_challenges (
  id           VARCHAR(36) PRIMARY KEY,
  contest_id   VARCHAR(36) NOT NULL,
  challenge_id VARCHAR(36) NOT NULL,
  order_index  INT         DEFAULT 0,
  UNIQUE KEY ux_cc (contest_id, challenge_id),
  FOREIGN KEY (contest_id)   REFERENCES contests(id)   ON DELETE CASCADE,
  FOREIGN KEY (challenge_id) REFERENCES challenges(id)
);

CREATE TABLE IF NOT EXISTS submissions (
  id                 VARCHAR(36)   PRIMARY KEY,
  user_id            VARCHAR(36)   NOT NULL,
  challenge_id       VARCHAR(36)   NOT NULL,
  contest_id         VARCHAR(36),
  language           VARCHAR(50)   NOT NULL,
  code               TEXT          NOT NULL,
  status             VARCHAR(50)   NOT NULL DEFAULT 'pending',
  score              INT           DEFAULT 0,
  execution_time_ms  INT,
  memory_used_mb     DECIMAL(10,2),
  test_results       JSON,
  risk_score         INT           DEFAULT 0,
  ip_address         VARCHAR(45),
  user_agent         TEXT,
  typing_stats       JSON,
  paste_count        INT           DEFAULT 0,
  time_to_first_char INT,
  submitted_at       DATETIME      DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)      REFERENCES users(id),
  FOREIGN KEY (challenge_id) REFERENCES challenges(id)
);

CREATE TABLE IF NOT EXISTS contest_participants (
  id             VARCHAR(36)   PRIMARY KEY,
  contest_id     VARCHAR(36)   NOT NULL,
  user_id        VARCHAR(36)   NOT NULL,
  transaction_id VARCHAR(36),
  score          INT           DEFAULT 0,
  total_time_ms  BIGINT        DEFAULT 0,
  rank_position  INT,
  prize_amount   DECIMAL(15,2),
  prize_paid     TINYINT(1)    DEFAULT 0,
  joined_at      DATETIME      DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY ux_cp (contest_id, user_id),
  FOREIGN KEY (contest_id) REFERENCES contests(id),
  FOREIGN KEY (user_id)    REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS leaderboards (
  id            VARCHAR(36)  PRIMARY KEY,
  contest_id    VARCHAR(36)  NOT NULL,
  user_id       VARCHAR(36)  NOT NULL,
  user_name     VARCHAR(255),
  rank_position INT          NOT NULL,
  score         INT          DEFAULT 0,
  total_time_ms BIGINT       DEFAULT 0,
  updated_at    DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY ux_lb (contest_id, user_id),
  FOREIGN KEY (contest_id) REFERENCES contests(id),
  FOREIGN KEY (user_id)    REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id           VARCHAR(36)  PRIMARY KEY,
  user_id      VARCHAR(36)  NOT NULL,
  token_hash   VARCHAR(255) NOT NULL,
  ip_address   VARCHAR(45),
  user_agent   TEXT,
  is_active    TINYINT(1)   DEFAULT 1,
  created_at   DATETIME     DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  expires_at   DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS device_fingerprints (
  id               VARCHAR(36)  PRIMARY KEY,
  user_id          VARCHAR(36)  NOT NULL,
  fingerprint_hash VARCHAR(255) NOT NULL,
  user_agent       TEXT,
  ip_address       VARCHAR(45),
  first_seen_at    DATETIME     DEFAULT CURRENT_TIMESTAMP,
  last_seen_at     DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY ux_df (user_id, fingerprint_hash),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS cheat_flags (
  id            VARCHAR(36)  PRIMARY KEY,
  user_id       VARCHAR(36)  NOT NULL,
  submission_id VARCHAR(36),
  contest_id    VARCHAR(36),
  flag_type     VARCHAR(100) NOT NULL,
  severity      VARCHAR(20)  NOT NULL DEFAULT 'low',
  risk_score    INT          DEFAULT 0,
  details       JSON,
  is_reviewed   TINYINT(1)   DEFAULT 0,
  reviewed_by   VARCHAR(36),
  review_action VARCHAR(50),
  review_notes  TEXT,
  created_at    DATETIME     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_submissions_user       ON submissions(user_id);
CREATE INDEX idx_submissions_challenge  ON submissions(challenge_id);
CREATE INDEX idx_submissions_contest    ON submissions(contest_id);
CREATE INDEX idx_submissions_time       ON submissions(submitted_at DESC);
CREATE INDEX idx_transactions_user      ON transactions(user_id);
CREATE INDEX idx_transactions_status    ON transactions(status);
CREATE INDEX idx_leaderboard_contest    ON leaderboards(contest_id, rank_position);
CREATE INDEX idx_sessions_ip            ON user_sessions(ip_address);
CREATE INDEX idx_flags_user             ON cheat_flags(user_id);
CREATE INDEX idx_flags_reviewed         ON cheat_flags(is_reviewed);

CREATE TABLE IF NOT EXISTS challenge_bets (
  id                VARCHAR(36)   PRIMARY KEY,
  user_id           VARCHAR(36)   NOT NULL,
  challenge_id      VARCHAR(36)   NOT NULL,
  amount            DECIMAL(15,2) NOT NULL,
  multiplier        DECIMAL(5,2)  NOT NULL,
  potential_payout  DECIMAL(15,2) NOT NULL,
  status            ENUM('pending','won','lost','refunded') NOT NULL DEFAULT 'pending',
  submission_id     VARCHAR(36),
  resolved_at       DATETIME,
  created_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)      REFERENCES users(id)      ON DELETE CASCADE,
  FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE,
  INDEX idx_bet_user_challenge (user_id, challenge_id)
);

-- Seed admin user  (password: Ineza@12)
INSERT IGNORE INTO users (id, name, email, password_hash, role)
VALUES (
  'admin-00000000-0000-0000-0000-000000000001',
  'Platform Admin',
  'inezapaccy4@gmail.com',
  '$2a$12$xKCO2yWIuiQNoJtsDGtXcuSyJQDyre2H3Ixnsi80QFvJQbdNLwQj.',
  'admin'
);

INSERT IGNORE INTO wallets (id, user_id)
VALUES ('wallet-admin-00000000', 'admin-00000000-0000-0000-0000-000000000001');
