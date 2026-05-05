import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { WalletService }   from '../wallet/wallet.service';
import { ContestsService } from '../contests/contests.service';

@Injectable()
export class AdminService {
  constructor(
    private db:       DatabaseService,
    private wallet:   WalletService,
    private contests: ContestsService,
  ) {}

  async getDashboard() {
    const [users, submissions, contests, flags, revenue] = await Promise.all([
      this.db.queryOne(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24h') AS today FROM users WHERE role = 'user'`),
      this.db.queryOne(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'accepted') AS accepted, COUNT(*) FILTER (WHERE status = 'cheating_suspected') AS cheating FROM submissions`),
      this.db.queryOne(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'active') AS active FROM contests`),
      this.db.queryOne(`SELECT COUNT(*) AS open FROM cheat_flags WHERE is_reviewed = FALSE`),
      this.db.queryOne(`SELECT COALESCE(SUM(amount),0) AS total FROM transactions WHERE type = 'deposit' AND status = 'completed'`),
    ]);

    const topUsers = await this.db.queryMany(
      `SELECT u.name, u.email, u.total_earnings, u.risk_score,
              COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'accepted') AS solved
       FROM users u LEFT JOIN submissions s ON s.user_id = u.id
       WHERE u.role = 'user' GROUP BY u.id ORDER BY solved DESC LIMIT 10`,
    );

    return { users, submissions, contests, flags, revenue, topUsers };
  }

  async getUsers(page = 1, search?: string) {
    const offset = (page - 1) * 30;
    const where  = search ? `WHERE (u.name ILIKE $3 OR u.email ILIKE $3)` : '';
    const params = search ? [30, offset, `%${search}%`] : [30, offset];
    return this.db.queryMany(
      `SELECT u.id, u.name, u.email, u.role, u.is_banned, u.risk_score,
              u.total_earnings, u.created_at, w.balance
       FROM users u LEFT JOIN wallets w ON w.user_id = u.id
       ${where} ORDER BY u.created_at DESC LIMIT $1 OFFSET $2`,
      params,
    );
  }

  async banUser(userId: string, reason: string) {
    await this.db.query(
      'UPDATE users SET is_banned = TRUE, ban_reason = $1 WHERE id = $2', [reason, userId],
    );
    return { success: true };
  }

  async unbanUser(userId: string) {
    await this.db.query(
      'UPDATE users SET is_banned = FALSE, ban_reason = NULL, risk_score = 0 WHERE id = $1', [userId],
    );
    return { success: true };
  }

  async getSubmissions(page = 1, suspicious = false) {
    const offset = (page - 1) * 30;
    const where  = suspicious ? `WHERE s.status = 'cheating_suspected' OR s.risk_score >= 60` : '';
    return this.db.queryMany(
      `SELECT s.id, s.status, s.score, s.language, s.risk_score,
              s.paste_count, s.submitted_at,
              u.name AS user_name, c.title AS challenge_title
       FROM submissions s
       JOIN users u ON u.id = s.user_id
       JOIN challenges c ON c.id = s.challenge_id
       ${where}
       ORDER BY s.submitted_at DESC LIMIT 30 OFFSET $1`,
      [offset],
    );
  }

  async finalizeContest(contestId: string) {
    await this.contests.updateStatus(contestId);
    await this.wallet.distributePrizes(contestId);
    return { success: true };
  }

  async adjustBalance(userId: string, amount: number, reason: string) {
    const ref = `ADJ-${userId}-${Date.now()}`;
    if (amount > 0) {
      return this.wallet.credit(userId, amount, 'adjustment', ref, 'internal', null, { reason });
    } else {
      return this.wallet.debit(userId, Math.abs(amount), 'adjustment', ref, 'internal', null, { reason });
    }
  }
}
