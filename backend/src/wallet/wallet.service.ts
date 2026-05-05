import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { PoolClient }      from 'pg';
import { DatabaseService } from '../database/database.service';
import { v4 as uuid }      from 'uuid';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(private db: DatabaseService) {}

  async getWallet(userId: string) {
    const wallet = await this.db.queryOne(
      'SELECT w.*, u.name FROM wallets w JOIN users u ON u.id = w.user_id WHERE w.user_id = $1',
      [userId],
    );
    if (!wallet) throw new NotFoundException('Wallet not found');
    return wallet;
  }

  async getTransactions(userId: string, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const rows = await this.db.queryMany(
      `SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
    );
    return { transactions: rows };
  }

  /**
   * Atomic credit — used for deposits, prize payouts, refunds.
   * Raises balance_before / balance_after, prevents race conditions via FOR UPDATE.
   */
  async credit(
    userId: string, amount: number, type: string,
    ref: string, provider?: string, providerRef?: string, meta?: any,
    client?: PoolClient,
  ) {
    const execute = async (c: PoolClient) => {
      const wallet = await c.query(
        'SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE', [userId],
      );
      if (!wallet.rows[0]) throw new NotFoundException('Wallet not found');
      const w = wallet.rows[0];

      const newBalance = parseFloat(w.balance) + amount;
      await c.query(
        `UPDATE wallets SET balance = $1, version = version + 1, updated_at = NOW()
         WHERE user_id = $2 AND version = $3`,
        [newBalance, userId, w.version],
      );

      await c.query(
        `INSERT INTO transactions
           (wallet_id, user_id, type, amount, balance_before, balance_after, status, reference, payment_provider, provider_reference, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,'completed',$7,$8,$9,$10)`,
        [w.id, userId, type, amount, w.balance, newBalance, ref, provider || 'internal', providerRef || null, JSON.stringify(meta || {})],
      );

      return { balance: newBalance };
    };

    return client
      ? execute(client)
      : this.db.transaction(execute);
  }

  /**
   * Atomic debit — used for contest entry fees, withdrawals.
   * Prevents double spend via optimistic locking + balance check.
   */
  async debit(
    userId: string, amount: number, type: string,
    ref: string, provider?: string, providerRef?: string, meta?: any,
    client?: PoolClient,
  ) {
    const execute = async (c: PoolClient) => {
      const wallet = await c.query(
        'SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE', [userId],
      );
      if (!wallet.rows[0]) throw new NotFoundException('Wallet not found');
      const w = wallet.rows[0];

      if (parseFloat(w.balance) < amount) {
        throw new BadRequestException('Insufficient balance');
      }

      const newBalance = parseFloat(w.balance) - amount;
      await c.query(
        `UPDATE wallets SET balance = $1, version = version + 1, updated_at = NOW()
         WHERE user_id = $2 AND version = $3`,
        [newBalance, userId, w.version],
      );

      const { rows } = await c.query(
        `INSERT INTO transactions
           (wallet_id, user_id, type, amount, balance_before, balance_after, status, reference, payment_provider, provider_reference, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,'completed',$7,$8,$9,$10) RETURNING id`,
        [w.id, userId, type, amount, w.balance, newBalance, ref, provider || 'internal', providerRef || null, JSON.stringify(meta || {})],
      );

      return { balance: newBalance, transaction_id: rows[0].id };
    };

    return client
      ? execute(client)
      : this.db.transaction(execute);
  }

  /** Distribute prizes after a contest ends */
  async distributePrizes(contestId: string) {
    const contest = await this.db.queryOne('SELECT * FROM contests WHERE id = $1', [contestId]);
    if (!contest) throw new NotFoundException('Contest not found');
    if (contest.status !== 'completed') throw new BadRequestException('Contest not completed');

    const distribution: Array<{ rank: number; percentage: number }> = contest.prize_distribution;
    const participants = await this.db.queryMany(
      'SELECT * FROM contest_participants WHERE contest_id = $1 AND rank IS NOT NULL ORDER BY rank',
      [contestId],
    );

    return this.db.transaction(async (client) => {
      for (const p of participants) {
        const distEntry = distribution.find(d => d.rank === p.rank);
        if (!distEntry || p.prize_paid) continue;

        const prizeAmount = (parseFloat(contest.prize_pool) * distEntry.percentage) / 100;
        const ref = `PRIZE-${contestId}-${p.user_id}-${Date.now()}`;

        await this.credit(
          p.user_id, prizeAmount, 'prize_payout', ref,
          'internal', null, { contest_id: contestId, rank: p.rank }, client,
        );

        await client.query(
          'UPDATE contest_participants SET prize_amount = $1, prize_paid = TRUE WHERE id = $2',
          [prizeAmount, p.id],
        );

        await client.query(
          'UPDATE users SET total_earnings = total_earnings + $1 WHERE id = $2',
          [prizeAmount, p.user_id],
        );
      }
    });
  }
}
