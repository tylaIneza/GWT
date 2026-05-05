import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import * as mysql          from 'mysql2/promise';
import { v4 as uuid }      from 'uuid';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);
  constructor(private db: DatabaseService) {}

  async getWallet(userId: string) {
    const w = await this.db.queryOne(
      'SELECT w.*, u.name FROM wallets w JOIN users u ON u.id = w.user_id WHERE w.user_id = ?', [userId],
    );
    if (!w) throw new NotFoundException('Wallet not found');
    return w;
  }

  async getTransactions(userId: string, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const rows   = await this.db.queryMany(
      'SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [userId, limit, offset],
    );
    return { transactions: rows };
  }

  async credit(
    userId: string, amount: number, type: string,
    ref: string, provider?: string, providerRef?: string, meta?: any,
    conn?: mysql.PoolConnection,
  ) {
    const execute = async (c: mysql.PoolConnection) => {
      const [walRows] = await c.query<mysql.RowDataPacket[]>(
        'SELECT * FROM wallets WHERE user_id = ? FOR UPDATE', [userId],
      );
      const w = walRows[0];
      if (!w) throw new NotFoundException('Wallet not found');

      const newBalance = parseFloat(w.balance) + amount;
      await c.query(
        'UPDATE wallets SET balance = ?, version = version + 1 WHERE user_id = ? AND version = ?',
        [newBalance, userId, w.version],
      );

      await c.query(
        `INSERT INTO transactions
           (id, wallet_id, user_id, type, amount, balance_before, balance_after, status, reference, payment_provider, provider_reference, metadata)
         VALUES (?,?,?,?,?,?,?,'completed',?,?,?,?)`,
        [uuid(), w.id, userId, type, amount, w.balance, newBalance, ref, provider || 'internal', providerRef || null, JSON.stringify(meta || {})],
      );

      return { balance: newBalance };
    };

    return conn ? execute(conn) : this.db.transaction(execute);
  }

  async debit(
    userId: string, amount: number, type: string,
    ref: string, provider?: string, providerRef?: string, meta?: any,
    conn?: mysql.PoolConnection,
  ) {
    const execute = async (c: mysql.PoolConnection) => {
      const [walRows] = await c.query<mysql.RowDataPacket[]>(
        'SELECT * FROM wallets WHERE user_id = ? FOR UPDATE', [userId],
      );
      const w = walRows[0];
      if (!w) throw new NotFoundException('Wallet not found');
      if (parseFloat(w.balance) < amount) throw new BadRequestException('Insufficient balance');

      const newBalance = parseFloat(w.balance) - amount;
      await c.query(
        'UPDATE wallets SET balance = ?, version = version + 1 WHERE user_id = ? AND version = ?',
        [newBalance, userId, w.version],
      );

      const txnId = uuid();
      await c.query(
        `INSERT INTO transactions
           (id, wallet_id, user_id, type, amount, balance_before, balance_after, status, reference, payment_provider, provider_reference, metadata)
         VALUES (?,?,?,?,?,?,?,'completed',?,?,?,?)`,
        [txnId, w.id, userId, type, amount, w.balance, newBalance, ref, provider || 'internal', providerRef || null, JSON.stringify(meta || {})],
      );

      return { balance: newBalance, transaction_id: txnId };
    };

    return conn ? execute(conn) : this.db.transaction(execute);
  }

  async distributePrizes(contestId: string) {
    const contest = await this.db.queryOne('SELECT * FROM contests WHERE id = ?', [contestId]);
    if (!contest) throw new NotFoundException('Contest not found');

    const dist: any[] = typeof contest.prize_distribution === 'string'
      ? JSON.parse(contest.prize_distribution)
      : (contest.prize_distribution || []);

    const participants = await this.db.queryMany(
      'SELECT * FROM contest_participants WHERE contest_id = ? AND rank_position IS NOT NULL ORDER BY rank_position',
      [contestId],
    );

    await this.db.transaction(async (conn) => {
      for (const p of participants) {
        const d = dist.find((x: any) => x.rank === p.rank_position);
        if (!d || p.prize_paid) continue;

        const prizeAmount = (parseFloat(contest.prize_pool) * d.percentage) / 100;
        const ref = `PRIZE-${contestId}-${p.user_id}-${Date.now()}`;

        await this.credit(p.user_id, prizeAmount, 'prize_payout', ref, 'internal', null, { contest_id: contestId, rank: p.rank_position }, conn);
        await conn.query('UPDATE contest_participants SET prize_amount = ?, prize_paid = 1 WHERE id = ?', [prizeAmount, p.id]);
        await conn.query('UPDATE users SET total_earnings = total_earnings + ? WHERE id = ?', [prizeAmount, p.user_id]);
      }
    });
  }
}
