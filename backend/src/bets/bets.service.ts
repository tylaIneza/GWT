import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { v4 as uuid }       from 'uuid';
import { DatabaseService }  from '../database/database.service';
import { WalletService }    from '../wallet/wallet.service';

const MULTIPLIERS: Record<string, number> = { easy: 2, medium: 3, hard: 5 };

@Injectable()
export class BetsService {
  constructor(
    private db:     DatabaseService,
    private wallet: WalletService,
  ) {}

  private async adminId(): Promise<string> {
    const a = await this.db.queryOne<{ id: string }>(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`);
    if (!a) throw new Error('Admin account not found');
    return a.id;
  }

  async placeBet(userId: string, challengeId: string, amount: number) {
    const challenge = await this.db.queryOne<any>('SELECT id, difficulty FROM challenges WHERE id = ? AND is_published = 1', [challengeId]);
    if (!challenge) throw new NotFoundException('Challenge not found');

    const multiplier     = MULTIPLIERS[challenge.difficulty] || 2;
    const potentialPayout = amount * multiplier;
    const adminId        = await this.adminId();

    // Only one pending bet per challenge per user
    const existing = await this.db.queryOne(
      `SELECT id FROM challenge_bets WHERE user_id = ? AND challenge_id = ? AND status = 'pending'`,
      [userId, challengeId],
    );
    if (existing) throw new BadRequestException('You already have an active bet on this challenge');

    const betId = uuid();

    await this.db.transaction(async (conn) => {
      await this.wallet.debit(userId,  amount, 'bet_placed',   `BET-D-${betId}`, 'internal', null, { challenge_id: challengeId }, conn);
      await this.wallet.credit(adminId, amount, 'bet_received', `BET-C-${betId}`, 'internal', null, { bettor_id: userId, challenge_id: challengeId }, conn);
      await conn.query(
        `INSERT INTO challenge_bets (id, user_id, challenge_id, amount, multiplier, potential_payout)
         VALUES (?,?,?,?,?,?)`,
        [betId, userId, challengeId, amount, multiplier, potentialPayout],
      );
    });

    return { bet_id: betId, amount, multiplier, potential_payout: potentialPayout, status: 'pending' };
  }

  async resolveBet(userId: string, challengeId: string, submissionId: string, won: boolean): Promise<{ resolved: boolean; won: boolean; payout: number } | null> {
    const bet = await this.db.queryOne<any>(
      `SELECT * FROM challenge_bets WHERE user_id = ? AND challenge_id = ? AND status = 'pending'`,
      [userId, challengeId],
    );
    if (!bet) return null;

    if (won) {
      const payout  = parseFloat(bet.potential_payout);
      const adminId = await this.adminId();

      await this.db.transaction(async (conn) => {
        await this.wallet.debit(adminId, payout, 'bet_payout', `PAY-D-${bet.id}`, 'internal', null, { bet_id: bet.id }, conn);
        await this.wallet.credit(userId,  payout, 'bet_won',   `PAY-C-${bet.id}`, 'internal', null, { bet_id: bet.id, challenge_id: challengeId }, conn);
        await conn.query(
          `UPDATE challenge_bets SET status = 'won', submission_id = ?, resolved_at = NOW() WHERE id = ?`,
          [submissionId, bet.id],
        );
      });

      return { resolved: true, won: true, payout };
    }

    await this.db.execute(
      `UPDATE challenge_bets SET status = 'lost', submission_id = ?, resolved_at = NOW() WHERE id = ?`,
      [submissionId, bet.id],
    );
    return { resolved: true, won: false, payout: 0 };
  }

  async getActiveBet(userId: string, challengeId: string) {
    return this.db.queryOne(
      `SELECT * FROM challenge_bets WHERE user_id = ? AND challenge_id = ? AND status = 'pending'`,
      [userId, challengeId],
    );
  }

  async getBetHistory(userId: string) {
    return this.db.queryMany(
      `SELECT b.id, b.amount, b.multiplier, b.potential_payout, b.status, b.created_at, b.resolved_at,
              c.title AS challenge_title, c.difficulty
       FROM challenge_bets b JOIN challenges c ON c.id = b.challenge_id
       WHERE b.user_id = ?
       ORDER BY b.created_at DESC LIMIT 30`,
      [userId],
    );
  }

  // Admin: deposit funds into admin wallet
  async adminDeposit(amount: number, note: string) {
    const adminId = await this.adminId();
    const ref     = `ADMIN-DEP-${Date.now()}`;
    await this.wallet.credit(adminId, amount, 'admin_deposit', ref, 'internal', null, { note });
    return { success: true, amount };
  }

  async adminWalletInfo() {
    const adminId = await this.adminId();
    const wallet  = await this.db.queryOne<any>(
      'SELECT balance FROM wallets WHERE user_id = ?', [adminId],
    );
    const stats = await this.db.queryOne<any>(
      `SELECT
         SUM(CASE WHEN status = 'won'  THEN potential_payout ELSE 0 END) AS total_paid_out,
         SUM(CASE WHEN status = 'lost' THEN amount           ELSE 0 END) AS total_collected,
         COUNT(CASE WHEN status = 'pending' THEN 1 END)                  AS active_bets,
         COUNT(*)                                                          AS total_bets
       FROM challenge_bets`,
    );
    const recent = await this.db.queryMany(
      `SELECT b.status, b.amount, b.multiplier, b.potential_payout, b.created_at, b.resolved_at,
              u.name AS user_name, c.title AS challenge_title
       FROM challenge_bets b
       JOIN users u ON u.id = b.user_id
       JOIN challenges c ON c.id = b.challenge_id
       ORDER BY b.created_at DESC LIMIT 20`,
    );
    return { balance: parseFloat(wallet?.balance || '0'), stats, recent };
  }
}
