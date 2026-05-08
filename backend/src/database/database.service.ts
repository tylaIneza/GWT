import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs   from 'fs';

// ─── helpers ────────────────────────────────────────────────────────────────

/** Strip MySQL-only clauses so the SQL runs on SQLite */
function toSQLite(sql: string): string {
  return sql
    .replace(/\s+FOR\s+UPDATE/gi, '')
    .replace(/\bINSERT\s+IGNORE\b/gi, 'INSERT OR IGNORE');
}

/** Convert params to SQLite-safe types (no Date, no undefined) */
function sanitize(params: any[]): any[] {
  return params.map(v => {
    if (v === undefined)    return null;
    if (v instanceof Date)  return v.toISOString();
    if (typeof v === 'boolean') return v ? 1 : 0;
    return v;
  });
}

/** Auto-parse JSON string fields coming back from SQLite TEXT columns */
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

// ─── fake "PoolConnection" used inside transaction callbacks ─────────────────
class SQLiteConn {
  constructor(private readonly db: Database.Database) {}

  /** Returns [rows, null] — matches mysql2 destructuring pattern */
  query<T = any>(sql: string, params?: any[]): Promise<[T[], null]> {
    const rows = hydrate(this.db.prepare(toSQLite(sql)).all(...sanitize(params || []))) as T[];
    return Promise.resolve([rows, null]);
  }

  execute(sql: string, params?: any[]): Promise<any> {
    const r = this.db.prepare(toSQLite(sql)).run(...sanitize(params || []));
    return Promise.resolve({ affectedRows: r.changes, insertId: r.lastInsertRowid });
  }
}

// ─── SQLite schema (replaces schema.sql for local dev) ──────────────────────
const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  email            TEXT UNIQUE NOT NULL,
  password_hash    TEXT NOT NULL,
  role             TEXT NOT NULL DEFAULT 'user',
  phone            TEXT,
  country_code     TEXT DEFAULT 'US',
  language         TEXT DEFAULT 'en',
  timezone         TEXT DEFAULT 'UTC',
  is_banned        INTEGER DEFAULT 0,
  ban_reason       TEXT,
  risk_score       INTEGER DEFAULT 0,
  kyc_verified     INTEGER DEFAULT 0,
  kyc_status       TEXT DEFAULT 'none',
  total_earnings   REAL DEFAULT 0,
  preferred_currency TEXT DEFAULT 'USD',
  avatar_url       TEXT,
  bio              TEXT,
  created_at       TEXT DEFAULT (datetime('now')),
  updated_at       TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS wallets (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL UNIQUE,
  balance        REAL NOT NULL DEFAULT 0,
  locked_balance REAL NOT NULL DEFAULT 0,
  currency       TEXT NOT NULL DEFAULT 'USD',
  version        INTEGER NOT NULL DEFAULT 0,
  updated_at     TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS transactions (
  id                 TEXT PRIMARY KEY,
  wallet_id          TEXT NOT NULL,
  user_id            TEXT NOT NULL,
  type               TEXT NOT NULL,
  amount             REAL NOT NULL,
  currency           TEXT NOT NULL DEFAULT 'USD',
  balance_before     REAL NOT NULL,
  balance_after      REAL NOT NULL,
  status             TEXT NOT NULL DEFAULT 'pending',
  reference          TEXT UNIQUE,
  payment_provider   TEXT,
  provider_reference TEXT,
  metadata           TEXT,
  created_at         TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (wallet_id) REFERENCES wallets(id),
  FOREIGN KEY (user_id)   REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS challenges (
  id                          TEXT PRIMARY KEY,
  title                       TEXT NOT NULL,
  slug                        TEXT UNIQUE NOT NULL,
  description                 TEXT NOT NULL,
  difficulty                  TEXT NOT NULL DEFAULT 'easy',
  category                    TEXT,
  supported_languages         TEXT,
  time_limit_ms               INTEGER DEFAULT 5000,
  memory_limit_mb             INTEGER DEFAULT 256,
  max_submissions             INTEGER DEFAULT 10,
  submission_cooldown_seconds INTEGER DEFAULT 30,
  is_published                INTEGER DEFAULT 0,
  randomize_inputs            INTEGER DEFAULT 1,
  solution_template           TEXT,
  prize_usd                   REAL DEFAULT 0,
  created_by                  TEXT,
  created_at                  TEXT DEFAULT (datetime('now')),
  updated_at                  TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS test_cases (
  id               TEXT PRIMARY KEY,
  challenge_id     TEXT NOT NULL,
  input            TEXT NOT NULL,
  expected_output  TEXT NOT NULL,
  is_sample        INTEGER DEFAULT 0,
  is_hidden        INTEGER DEFAULT 1,
  points           INTEGER DEFAULT 1,
  order_index      INTEGER DEFAULT 0,
  explanation      TEXT,
  created_at       TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS contests (
  id                 TEXT PRIMARY KEY,
  title              TEXT NOT NULL,
  description        TEXT,
  entry_fee          REAL NOT NULL DEFAULT 0,
  entry_fee_currency TEXT DEFAULT 'USD',
  prize_pool         REAL NOT NULL DEFAULT 0,
  prize_currency     TEXT DEFAULT 'USD',
  prize_distribution TEXT,
  start_time         TEXT NOT NULL,
  end_time           TEXT NOT NULL,
  max_participants   INTEGER,
  status             TEXT NOT NULL DEFAULT 'upcoming',
  is_rated           INTEGER DEFAULT 1,
  region             TEXT DEFAULT 'global',
  created_by         TEXT,
  created_at         TEXT DEFAULT (datetime('now')),
  updated_at         TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS contest_challenges (
  id           TEXT PRIMARY KEY,
  contest_id   TEXT NOT NULL,
  challenge_id TEXT NOT NULL,
  order_index  INTEGER DEFAULT 0,
  UNIQUE (contest_id, challenge_id),
  FOREIGN KEY (contest_id)   REFERENCES contests(id)   ON DELETE CASCADE,
  FOREIGN KEY (challenge_id) REFERENCES challenges(id)
);

CREATE TABLE IF NOT EXISTS submissions (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT NOT NULL,
  challenge_id       TEXT NOT NULL,
  contest_id         TEXT,
  language           TEXT NOT NULL,
  code               TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'pending',
  score              INTEGER DEFAULT 0,
  execution_time_ms  INTEGER,
  memory_used_mb     REAL,
  test_results       TEXT,
  risk_score         INTEGER DEFAULT 0,
  ip_address         TEXT,
  user_agent         TEXT,
  typing_stats       TEXT,
  paste_count        INTEGER DEFAULT 0,
  time_to_first_char INTEGER,
  submitted_at       TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id)      REFERENCES users(id),
  FOREIGN KEY (challenge_id) REFERENCES challenges(id)
);

CREATE TABLE IF NOT EXISTS contest_participants (
  id             TEXT PRIMARY KEY,
  contest_id     TEXT NOT NULL,
  user_id        TEXT NOT NULL,
  transaction_id TEXT,
  score          INTEGER DEFAULT 0,
  total_time_ms  INTEGER DEFAULT 0,
  rank_position  INTEGER,
  prize_amount   REAL,
  prize_paid     INTEGER DEFAULT 0,
  joined_at      TEXT DEFAULT (datetime('now')),
  UNIQUE (contest_id, user_id),
  FOREIGN KEY (contest_id) REFERENCES contests(id),
  FOREIGN KEY (user_id)    REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS leaderboards (
  id            TEXT PRIMARY KEY,
  contest_id    TEXT NOT NULL,
  user_id       TEXT NOT NULL,
  user_name     TEXT,
  rank_position INTEGER NOT NULL,
  score         INTEGER DEFAULT 0,
  total_time_ms INTEGER DEFAULT 0,
  updated_at    TEXT DEFAULT (datetime('now')),
  UNIQUE (contest_id, user_id),
  FOREIGN KEY (contest_id) REFERENCES contests(id),
  FOREIGN KEY (user_id)    REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  token_hash   TEXT NOT NULL,
  ip_address   TEXT,
  user_agent   TEXT,
  is_active    INTEGER DEFAULT 1,
  created_at   TEXT DEFAULT (datetime('now')),
  last_seen_at TEXT DEFAULT (datetime('now')),
  expires_at   TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS device_fingerprints (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL,
  fingerprint_hash TEXT NOT NULL,
  user_agent       TEXT,
  ip_address       TEXT,
  first_seen_at    TEXT DEFAULT (datetime('now')),
  last_seen_at     TEXT DEFAULT (datetime('now')),
  UNIQUE (user_id, fingerprint_hash),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS cheat_flags (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  submission_id TEXT,
  contest_id    TEXT,
  flag_type     TEXT NOT NULL,
  severity      TEXT NOT NULL DEFAULT 'low',
  risk_score    INTEGER DEFAULT 0,
  details       TEXT,
  is_reviewed   INTEGER DEFAULT 0,
  reviewed_by   TEXT,
  review_action TEXT,
  review_notes  TEXT,
  created_at    TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS challenge_bets (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL,
  challenge_id     TEXT NOT NULL,
  amount           REAL NOT NULL,
  currency         TEXT DEFAULT 'USD',
  multiplier       REAL NOT NULL,
  potential_payout REAL NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending',
  submission_id    TEXT,
  resolved_at      TEXT,
  created_at       TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id)      REFERENCES users(id)      ON DELETE CASCADE,
  FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS challenge_sessions (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  challenge_id TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'active',
  started_at   TEXT DEFAULT (datetime('now')),
  expires_at   TEXT NOT NULL,
  FOREIGN KEY (user_id)      REFERENCES users(id)      ON DELETE CASCADE,
  FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS referrals (
  id            TEXT PRIMARY KEY,
  referrer_id   TEXT NOT NULL,
  referred_id   TEXT NOT NULL UNIQUE,
  reward_amount REAL DEFAULT 5.0,
  currency      TEXT DEFAULT 'USD',
  status        TEXT DEFAULT 'pending',
  paid_at       TEXT,
  created_at    TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (referrer_id) REFERENCES users(id),
  FOREIGN KEY (referred_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS kyc_documents (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  doc_type      TEXT NOT NULL,
  doc_url       TEXT NOT NULL,
  status        TEXT DEFAULT 'pending',
  reviewed_by   TEXT,
  review_notes  TEXT,
  submitted_at  TEXT DEFAULT (datetime('now')),
  reviewed_at   TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_submissions_user      ON submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_challenge ON submissions(challenge_id);
CREATE INDEX IF NOT EXISTS idx_submissions_time      ON submissions(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user     ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status   ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_leaderboard_contest   ON leaderboards(contest_id, rank_position);
CREATE INDEX IF NOT EXISTS idx_sessions_ip           ON user_sessions(ip_address);
CREATE INDEX IF NOT EXISTS idx_flags_user            ON cheat_flags(user_id);
CREATE INDEX IF NOT EXISTS idx_users_country         ON users(country_code);
`;

// Admin seed — password: Ineza@12
const SEED = `
INSERT OR IGNORE INTO users (id, name, email, password_hash, role, country_code, language, kyc_verified, kyc_status)
VALUES (
  'admin-00000000-0000-0000-0000-000000000001',
  'Platform Admin',
  'inezapaccy4@gmail.com',
  '$2a$12$AQwUuKhAyTb/xfrsj2Sdp.tIccn8c7EYmKkXmsQslyBx0T0/vlAkS',
  'admin', 'RW', 'en', 1, 'approved'
);
INSERT OR IGNORE INTO wallets (id, user_id, currency)
VALUES ('wallet-admin-00000000', 'admin-00000000-0000-0000-0000-000000000001', 'USD');

INSERT OR IGNORE INTO users (id, name, email, password_hash, role, country_code, language, phone)
VALUES (
  'user-test-00000000-0000-0000-000000000001',
  'Test User',
  'testuser@codearena.com',
  '$2a$12$hc3t/TomlI5Cj2dSKNOU3ue2fIDXzPuFV1VjFnn/fUAKvOEpXYEE2',
  'user', 'US', 'en', '+1234567890'
);
INSERT OR IGNORE INTO wallets (id, user_id, balance, currency)
VALUES ('wallet-test-00000000', 'user-test-00000000-0000-0000-000000000001', 50.0, 'USD');
`;

// ─── Service ────────────────────────────────────────────────────────────────

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private db!: Database.Database;
  private readonly logger = new Logger(DatabaseService.name);

  async onModuleInit() {
    const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'data', 'codearena.db');
    const dir    = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    this.db = new Database(dbPath);
    this.db.exec(SCHEMA);
    this.db.exec(SEED);
    this.logger.log(`SQLite ready: ${dbPath}`);
  }

  async onModuleDestroy() {
    this.db?.close();
  }

  // ─── Public query API (mirrors mysql2 surface) ──────────────────────────

  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    return hydrate(this.db.prepare(toSQLite(sql)).all(...sanitize(params || []))) as T[];
  }

  async queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
    const row = this.db.prepare(toSQLite(sql)).get(...sanitize(params || []));
    if (!row) return null;
    return hydrate([row as any])[0] as T;
  }

  async queryMany<T = any>(sql: string, params?: any[]): Promise<T[]> {
    return hydrate(this.db.prepare(toSQLite(sql)).all(...sanitize(params || []))) as T[];
  }

  async execute(sql: string, params?: any[]): Promise<any> {
    const r = this.db.prepare(toSQLite(sql)).run(...sanitize(params || []));
    return { affectedRows: r.changes, insertId: r.lastInsertRowid };
  }

  // ─── Transactions ───────────────────────────────────────────────────────

  async transaction<T>(fn: (conn: SQLiteConn) => Promise<T>): Promise<T> {
    this.db.prepare('BEGIN IMMEDIATE').run();
    const conn = new SQLiteConn(this.db);
    try {
      const result = await fn(conn);
      this.db.prepare('COMMIT').run();
      return result;
    } catch (err) {
      try { this.db.prepare('ROLLBACK').run(); } catch {}
      throw err;
    }
  }

  async txQuery<T = any>(conn: SQLiteConn, sql: string, params?: any[]): Promise<T[]> {
    const [rows] = await conn.query<T>(sql, params);
    return rows;
  }

  async txQueryOne<T = any>(conn: SQLiteConn, sql: string, params?: any[]): Promise<T | null> {
    const [rows] = await conn.query<T>(sql, params);
    return rows[0] ?? null;
  }
}
