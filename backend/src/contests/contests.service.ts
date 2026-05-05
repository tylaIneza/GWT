import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { v4 as uuid }         from 'uuid';
import { DatabaseService }    from '../database/database.service';
import { WalletService }      from '../wallet/wallet.service';
import { CreateContestDto }   from './dto/create-contest.dto';

@Injectable()
export class ContestsService {
  constructor(private db: DatabaseService, private wallet: WalletService) {}

  async findAll(status?: string) {
    const where  = status ? 'WHERE c.status = ?' : '';
    const params = status ? [status] : [];
    return this.db.queryMany(
      `SELECT c.*, COUNT(DISTINCT cp.user_id) AS participant_count, u.name AS creator_name
       FROM contests c
       LEFT JOIN contest_participants cp ON cp.contest_id = c.id
       LEFT JOIN users u ON u.id = c.created_by
       ${where}
       GROUP BY c.id
       ORDER BY c.start_time DESC`,
      params,
    );
  }

  async findOne(id: string, userId?: string) {
    const contest = await this.db.queryOne(
      `SELECT c.*, COUNT(DISTINCT cp.user_id) AS participant_count
       FROM contests c
       LEFT JOIN contest_participants cp ON cp.contest_id = c.id
       WHERE c.id = ? GROUP BY c.id`,
      [id],
    );
    if (!contest) throw new NotFoundException('Contest not found');

    const challenges = await this.db.queryMany(
      `SELECT ch.id, ch.title, ch.slug, ch.difficulty, ch.category, cc.order_index
       FROM contest_challenges cc JOIN challenges ch ON ch.id = cc.challenge_id
       WHERE cc.contest_id = ? ORDER BY cc.order_index`,
      [id],
    );

    let is_joined = false;
    if (userId) {
      const p = await this.db.queryOne(
        'SELECT id FROM contest_participants WHERE contest_id = ? AND user_id = ?', [id, userId],
      );
      is_joined = !!p;
    }

    return { ...contest, challenges, is_joined };
  }

  async join(contestId: string, userId: string) {
    const contest = await this.db.queryOne('SELECT * FROM contests WHERE id = ?', [contestId]);
    if (!contest) throw new NotFoundException('Contest not found');
    if (['completed','cancelled'].includes(contest.status)) throw new BadRequestException('Contest not open');

    const existing = await this.db.queryOne(
      'SELECT id FROM contest_participants WHERE contest_id = ? AND user_id = ?', [contestId, userId],
    );
    if (existing) throw new BadRequestException('Already joined');

    if (contest.max_participants) {
      const cnt = await this.db.queryOne<{ c: number }>(
        'SELECT COUNT(*) AS c FROM contest_participants WHERE contest_id = ?', [contestId],
      );
      if ((cnt?.c || 0) >= contest.max_participants) throw new BadRequestException('Contest is full');
    }

    return this.db.transaction(async (conn) => {
      let txnId: string | null = null;
      if (parseFloat(contest.entry_fee) > 0) {
        const ref = `CE-${contestId}-${userId}-${Date.now()}`;
        const res = await this.wallet.debit(userId, parseFloat(contest.entry_fee), 'contest_entry', ref, 'internal', null, { contest_id: contestId }, conn);
        txnId = res.transaction_id;
        await conn.query('UPDATE contests SET prize_pool = prize_pool + ? WHERE id = ?', [contest.entry_fee, contestId]);
      }
      await conn.query(
        'INSERT INTO contest_participants (id, contest_id, user_id, transaction_id) VALUES (?,?,?,?)',
        [uuid(), contestId, userId, txnId],
      );
      return { success: true, message: 'Joined successfully' };
    });
  }

  async create(dto: CreateContestDto, adminId: string) {
    if (new Date(dto.end_time) <= new Date(dto.start_time)) {
      throw new BadRequestException('End must be after start');
    }
    const contestId = uuid();

    await this.db.transaction(async (conn) => {
      await conn.query(
        `INSERT INTO contests
           (id, title, description, entry_fee, start_time, end_time,
            max_participants, is_rated, created_by,
            prize_distribution)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [
          contestId, dto.title, dto.description || null, dto.entry_fee,
          dto.start_time, dto.end_time, dto.max_participants || null,
          dto.is_rated !== false ? 1 : 0, adminId,
          JSON.stringify([{rank:1,percentage:60},{rank:2,percentage:30},{rank:3,percentage:10}]),
        ],
      );
      for (let i = 0; i < dto.challenge_ids.length; i++) {
        await conn.query(
          'INSERT INTO contest_challenges (id, contest_id, challenge_id, order_index) VALUES (?,?,?,?)',
          [uuid(), contestId, dto.challenge_ids[i], i],
        );
      }
    });

    return this.db.queryOne('SELECT * FROM contests WHERE id = ?', [contestId]);
  }

  async updateStatus(id: string) {
    const contest = await this.db.queryOne('SELECT * FROM contests WHERE id = ?', [id]);
    if (!contest) throw new NotFoundException();
    const now = new Date();
    let status = contest.status;
    if (now >= new Date(contest.start_time) && now < new Date(contest.end_time)) status = 'active';
    if (now >= new Date(contest.end_time)) status = 'completed';
    await this.db.execute('UPDATE contests SET status = ? WHERE id = ?', [status, id]);
    return { status };
  }

  async getLeaderboard(contestId: string) {
    return this.db.queryMany(
      `SELECT lb.rank_position AS rank, lb.score, lb.total_time_ms, u.name AS user_name
       FROM leaderboards lb JOIN users u ON u.id = lb.user_id
       WHERE lb.contest_id = ? ORDER BY lb.rank_position ASC LIMIT 50`,
      [contestId],
    );
  }
}
