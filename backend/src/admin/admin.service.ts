import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { v4 as uuid }          from 'uuid';
import { DatabaseService }     from '../database/database.service';
import { WalletService }       from '../wallet/wallet.service';
import { ContestsService }     from '../contests/contests.service';

@Injectable()
export class AdminService {
  constructor(
    private db:       DatabaseService,
    private wallet:   WalletService,
    private contests: ContestsService,
  ) {}

  async getDashboard() {
    const [users, submissions, contestData, flags, walletStats, withdrawals] = await Promise.all([
      this.db.queryOne(`
        SELECT COUNT(*) AS total,
               SUM(CASE WHEN created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 ELSE 0 END) AS today,
               SUM(CASE WHEN created_at > DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS this_week,
               SUM(CASE WHEN is_banned = 1 THEN 1 ELSE 0 END) AS banned
        FROM users WHERE role = 'user'`),
      this.db.queryOne(`
        SELECT COUNT(*) AS total,
               SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) AS accepted,
               SUM(CASE WHEN status = 'pending_review' THEN 1 ELSE 0 END) AS pending_review,
               SUM(CASE WHEN status = 'cheating_suspected' THEN 1 ELSE 0 END) AS cheating,
               SUM(CASE WHEN submitted_at > DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 ELSE 0 END) AS today
        FROM submissions`),
      this.db.queryOne(`
        SELECT COUNT(*) AS total,
               SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active
        FROM contests`),
      this.db.queryOne(`SELECT COUNT(*) AS open FROM cheat_flags WHERE is_reviewed = 0`),
      this.db.queryOne(`
        SELECT SUM(w.balance) AS total_balance,
               SUM(CASE WHEN t.type = 'challenge_reward' THEN t.amount ELSE 0 END) AS total_rewards_paid
        FROM wallets w
        LEFT JOIN transactions t ON t.wallet_id = w.id AND t.status = 'completed'`),
      this.db.queryOne(`
        SELECT COUNT(*) AS total,
               SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
               SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS pending_amount
        FROM withdrawal_requests`),
    ]);

    const topUsers = await this.db.queryMany(`
      SELECT u.id, u.name, u.email, u.country_code, u.total_earnings, u.risk_score, u.solved_count,
             COUNT(CASE WHEN s.status = 'accepted' THEN 1 END) AS solved
      FROM users u LEFT JOIN submissions s ON s.user_id = u.id
      WHERE u.role = 'user'
      GROUP BY u.id ORDER BY solved DESC LIMIT 10`);

    const recentActivity = await this.db.queryMany(`
      SELECT s.submitted_at AS time, u.name AS user_name,
             c.title AS challenge_title, s.status, c.difficulty
      FROM submissions s
      JOIN users u ON u.id = s.user_id
      JOIN challenges c ON c.id = s.challenge_id
      ORDER BY s.submitted_at DESC LIMIT 10`);

    const dailyStats = await this.db.queryMany(`
      SELECT DATE(submitted_at) AS date, COUNT(*) AS submissions,
             SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) AS accepted
      FROM submissions
      WHERE submitted_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY DATE(submitted_at)
      ORDER BY date ASC`);

    return { users, submissions, contests: contestData, flags, walletStats, withdrawals, topUsers, recentActivity, dailyStats };
  }

  async getUsers(page = 1, search?: string) {
    const offset  = (page - 1) * 30;
    const where   = search ? 'WHERE (u.name LIKE ? OR u.email LIKE ?)' : '';
    const params  = search ? [`%${search}%`, `%${search}%`, 30, offset] : [30, offset];
    return this.db.queryMany(
      `SELECT u.id, u.name, u.email, u.role, u.is_banned, u.email_verified, u.risk_score,
              u.total_earnings, u.created_at, w.balance
       FROM users u LEFT JOIN wallets w ON w.user_id = u.id
       ${where} ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
      params,
    );
  }

  async banUser(userId: string, reason: string) {
    await this.db.execute('UPDATE users SET is_banned = 1, ban_reason = ? WHERE id = ?', [reason, userId]);
    return { success: true };
  }

  async unbanUser(userId: string) {
    await this.db.execute('UPDATE users SET is_banned = 0, ban_reason = NULL, risk_score = 0 WHERE id = ?', [userId]);
    return { success: true };
  }

  async activateUser(userId: string) {
    await this.db.execute('UPDATE users SET email_verified = 1 WHERE id = ?', [userId]);
    return { success: true };
  }

  async deleteUser(userId: string) {
    await this.db.execute('DELETE FROM users WHERE id = ? AND role != ?', [userId, 'admin']);
    return { success: true };
  }

  async getSubmissions(page = 1, suspicious = false) {
    const offset = (page - 1) * 30;
    const where  = suspicious ? "WHERE s.status = 'cheating_suspected' OR s.risk_score >= 60" : '';
    return this.db.queryMany(
      `SELECT s.id, s.status, s.score, s.language, s.risk_score,
              s.paste_count, s.submitted_at,
              u.name AS user_name, c.title AS challenge_title, c.difficulty
       FROM submissions s
       JOIN users u ON u.id = s.user_id
       JOIN challenges c ON c.id = s.challenge_id
       ${where}
       ORDER BY s.submitted_at DESC LIMIT 30 OFFSET ?`,
      [offset],
    );
  }

  async getPendingReviews(page = 1) {
    const offset = (page - 1) * 30;
    return this.db.queryMany(
      `SELECT s.id, s.language, s.code, s.submitted_at,
              u.name AS user_name, u.email AS user_email,
              c.title AS challenge_title, c.difficulty, c.category
       FROM submissions s
       JOIN users u ON u.id = s.user_id
       JOIN challenges c ON c.id = s.challenge_id
       WHERE s.status = 'pending_review'
       ORDER BY s.submitted_at ASC LIMIT 30 OFFSET ?`,
      [offset],
    );
  }

  async approveSubmission(submissionId: string) {
    const sub = await this.db.queryOne(
      'SELECT * FROM submissions WHERE id = ?', [submissionId],
    );
    if (!sub) throw new NotFoundException('Submission not found');

    const challenge = await this.db.queryOne(
      'SELECT id, title, difficulty FROM challenges WHERE id = ?', [sub.challenge_id],
    );
    if (!challenge) throw new NotFoundException('Challenge not found');

    const rewardRow = await this.db.queryOne('SELECT amount_usd FROM reward_settings WHERE difficulty = ?', [challenge.difficulty]);
    const reward = rewardRow?.amount_usd ?? (challenge.difficulty === 'hard' ? 40 : challenge.difficulty === 'medium' ? 15 : 5);
    const ref    = `REWARD-${submissionId}-${Date.now()}`;

    await this.db.execute(
      `UPDATE submissions SET status = 'accepted', score = 100 WHERE id = ?`, [submissionId],
    );
    await this.wallet.credit(sub.user_id, reward, 'challenge_reward', ref, 'internal', null, {
      challenge_id:  sub.challenge_id,
      submission_id: submissionId,
      difficulty:    challenge.difficulty,
    });
    await this.db.execute(
      'UPDATE users SET total_earnings = total_earnings + ? WHERE id = ?', [reward, sub.user_id],
    );

    return { success: true, reward, difficulty: challenge.difficulty };
  }

  async rejectSubmission(submissionId: string, reason?: string) {
    await this.db.execute(
      `UPDATE submissions SET status = 'wrong_answer' WHERE id = ?`, [submissionId],
    );
    return { success: true };
  }

  async finalizeContest(contestId: string) {
    await this.contests.updateStatus(contestId);
    await this.wallet.distributePrizes(contestId);
    return { success: true };
  }

  async getAdminWallet() {
    const wallet = await this.db.queryOne(
      `SELECT w.balance, w.currency, w.locked_balance
       FROM wallets w
       JOIN users u ON u.id = w.user_id
       WHERE u.role = 'admin' LIMIT 1`,
      [],
    );
    return wallet || { balance: 0, currency: 'USD', locked_balance: 0 };
  }

  async adminDeposit(amount: number, note: string) {
    const admin = await this.db.queryOne(
      `SELECT id FROM users WHERE role = 'admin' LIMIT 1`, [],
    );
    if (!admin) throw new NotFoundException('Admin user not found');
    const ref = `ADMIN-DEPOSIT-${Date.now()}`;
    return this.wallet.credit(admin.id, amount, 'deposit', ref, 'internal', null, { note });
  }

  async adjustBalance(userId: string, amount: number, reason: string) {
    const ref = `ADJ-${userId}-${Date.now()}`;
    if (amount > 0) {
      return this.wallet.credit(userId, amount, 'adjustment', ref, 'internal', null, { reason });
    }
    return this.wallet.debit(userId, Math.abs(amount), 'adjustment', ref, 'internal', null, { reason });
  }

  async exportUsers() {
    return this.db.queryMany(
      `SELECT u.id, u.name, u.email, u.role, u.is_banned, u.email_verified, u.risk_score,
              u.total_earnings, u.kyc_verified, u.created_at, w.balance
       FROM users u LEFT JOIN wallets w ON w.user_id = u.id
       WHERE u.role = 'user' ORDER BY u.created_at DESC`,
      [],
    );
  }

  async bulkDismissLowRiskFlags(adminId: string) {
    const flags = await this.db.queryMany(
      `SELECT id FROM cheat_flags WHERE is_reviewed = 0 AND (severity = 'low' OR risk_score < 30)`,
      [],
    );
    for (const f of flags) {
      await this.db.execute(
        `UPDATE cheat_flags SET is_reviewed = 1, reviewed_by = ?, review_action = 'dismissed',
         review_notes = 'Bulk auto-dismissed (low risk)' WHERE id = ?`,
        [adminId, f.id],
      );
    }
    return { dismissed: flags.length };
  }

  async refreshLeaderboard() {
    await this.db.execute(
      `DELETE FROM leaderboards WHERE contest_id NOT IN (SELECT id FROM contests)`, [],
    );
    return { refreshed: true };
  }

  // ── Withdrawal management ─────────────────────────────────────────────────

  async getWithdrawalRequests(page = 1, status?: string) {
    const offset = (page - 1) * 30;
    const where  = status ? 'WHERE wr.status = ?' : '';
    const params = status ? [status, 30, offset] : [30, offset];
    return this.db.queryMany(
      `SELECT wr.*, u.name AS user_name, u.email AS user_email, w.balance AS user_balance
       FROM withdrawal_requests wr
       JOIN users u ON u.id = wr.user_id
       JOIN wallets w ON w.user_id = wr.user_id
       ${where}
       ORDER BY wr.created_at DESC LIMIT ? OFFSET ?`,
      params,
    );
  }

  async approveWithdrawal(requestId: string, adminId: string, note?: string) {
    const req = await this.db.queryOne(
      `SELECT * FROM withdrawal_requests WHERE id = ? AND status = 'pending'`, [requestId],
    );
    if (!req) throw new NotFoundException('Pending withdrawal request not found');

    await this.db.execute(
      `UPDATE withdrawal_requests SET status = 'approved', admin_note = ?, processed_by = ?, processed_at = NOW() WHERE id = ?`,
      [note || null, adminId, requestId],
    );
    // Release locked balance
    await this.db.execute(
      'UPDATE wallets SET locked_balance = locked_balance - ? WHERE user_id = ?',
      [req.amount, req.user_id],
    );
    // Record transaction
    const ref = `WITHDRAW-${requestId}-${Date.now()}`;
    await this.wallet.debit(req.user_id, 0, 'withdrawal', ref, 'admin', null, {
      withdrawal_request_id: requestId, note,
    }).catch(() => {});

    return { success: true, amount: req.amount };
  }

  async rejectWithdrawal(requestId: string, adminId: string, reason: string) {
    const req = await this.db.queryOne(
      `SELECT * FROM withdrawal_requests WHERE id = ? AND status = 'pending'`, [requestId],
    );
    if (!req) throw new NotFoundException('Pending withdrawal request not found');

    // Unlock balance
    await this.db.execute(
      'UPDATE wallets SET balance = balance + ?, locked_balance = locked_balance - ? WHERE user_id = ?',
      [req.amount, req.amount, req.user_id],
    );
    await this.db.execute(
      `UPDATE withdrawal_requests SET status = 'rejected', admin_note = ?, processed_by = ?, processed_at = NOW() WHERE id = ?`,
      [reason, adminId, requestId],
    );
    return { success: true };
  }

  // ── Reward settings ───────────────────────────────────────────────────────

  async getRewardSettings() {
    return this.db.queryMany('SELECT * FROM reward_settings ORDER BY FIELD(difficulty,"easy","medium","hard")', []);
  }

  async updateRewardSettings(difficulty: string, amountUsd: number, adminId: string) {
    await this.db.execute(
      `INSERT INTO reward_settings (id, difficulty, amount_usd, updated_by)
       VALUES (?,?,?,?)
       ON DUPLICATE KEY UPDATE amount_usd = ?, updated_by = ?, updated_at = NOW()`,
      [uuid(), difficulty, amountUsd, adminId, amountUsd, adminId],
    );
    return { success: true, difficulty, amount_usd: amountUsd };
  }

  // ── CSV/Excel import ──────────────────────────────────────────────────────

  async importChallenges(rows: any[], adminId: string) {
    const results = { inserted: 0, skipped: 0, errors: [] as string[] };

    for (const row of rows) {
      try {
        const title = String(row.title || row.Title || '').trim();
        if (!title) { results.skipped++; continue; }

        const slug = title.toLowerCase().replace(/[^a-z0-9\s-]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-').trim();
        const existing = await this.db.queryOne('SELECT id FROM challenges WHERE slug = ?', [slug]);
        if (existing) { results.skipped++; continue; }

        const difficulty = String(row.difficulty || row.Difficulty || 'medium').toLowerCase();
        const category   = String(row.category   || row.Category   || '').trim() || null;
        const desc       = String(row.description || row.Description || title).trim();
        const langs      = row.languages ? String(row.languages).split(',').map((l: string) => l.trim()) : ['javascript','python'];

        const challengeId = uuid();
        await this.db.execute(
          `INSERT INTO challenges (id, title, slug, description, difficulty, category, supported_languages,
            time_limit_ms, memory_limit_mb, max_submissions, submission_cooldown_seconds, is_published, created_by)
           VALUES (?,?,?,?,?,?,?,5000,256,10,30,1,?)`,
          [challengeId, title, slug, desc, difficulty, category, JSON.stringify(langs), adminId],
        );

        const input    = String(row.sample_input   || row.input   || '').trim();
        const expected = String(row.sample_output  || row.output  || '').trim();
        if (input && expected) {
          await this.db.execute(
            `INSERT INTO test_cases (id, challenge_id, input, expected_output, is_sample, is_hidden, points, order_index)
             VALUES (?,?,?,?,1,0,1,0)`,
            [uuid(), challengeId, input, expected],
          );
        }

        results.inserted++;
      } catch (e: any) {
        results.errors.push(`Row error: ${e.message}`);
      }
    }
    return results;
  }

  // ── AI Validation Logs ────────────────────────────────────────────────────

  async getAiLogs(page = 1) {
    const offset = (page - 1) * 30;
    return this.db.queryMany(
      `SELECT l.*, u.name AS user_name, c.title AS challenge_title, c.difficulty
       FROM ai_validation_logs l
       JOIN users u ON u.id = l.user_id
       JOIN challenges c ON c.id = l.challenge_id
       ORDER BY l.created_at DESC LIMIT 30 OFFSET ?`,
      [offset],
    );
  }

  // ── Analytics ─────────────────────────────────────────────────────────────

  async getAnalytics() {
    const [topCountries, categoryBreakdown, difficultyBreakdown, revenueByDay] = await Promise.all([
      this.db.queryMany(`
        SELECT country_code, COUNT(*) AS users,
               SUM(total_earnings) AS total_earnings
        FROM users WHERE role = 'user'
        GROUP BY country_code ORDER BY users DESC LIMIT 15`),
      this.db.queryMany(`
        SELECT category, COUNT(*) AS challenges,
               SUM(CASE WHEN s.status = 'accepted' THEN 1 ELSE 0 END) AS accepted_submissions
        FROM challenges c LEFT JOIN submissions s ON s.challenge_id = c.id
        GROUP BY category ORDER BY challenges DESC`),
      this.db.queryMany(`
        SELECT difficulty, COUNT(*) AS challenges,
               AVG(CASE WHEN s.status = 'accepted' THEN 100 ELSE 0 END) AS success_rate
        FROM challenges c LEFT JOIN submissions s ON s.challenge_id = c.id
        GROUP BY difficulty`),
      this.db.queryMany(`
        SELECT DATE(created_at) AS date, SUM(amount) AS revenue
        FROM transactions
        WHERE type = 'challenge_reward' AND created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY DATE(created_at) ORDER BY date ASC`),
    ]);
    return { topCountries, categoryBreakdown, difficultyBreakdown, revenueByDay };
  }
}
