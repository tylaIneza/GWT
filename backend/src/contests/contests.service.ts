import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { DatabaseService }   from '../database/database.service';
import { WalletService }     from '../wallet/wallet.service';
import { CreateContestDto }  from './dto/create-contest.dto';
import { v4 as uuid }        from 'uuid';

@Injectable()
export class ContestsService {
  constructor(
    private db:     DatabaseService,
    private wallet: WalletService,
  ) {}

  async findAll(status?: string) {
    const where = status ? `WHERE c.status = $1` : '';
    const params = status ? [status] : [];
    return this.db.queryMany(
      `SELECT c.*,
              COUNT(DISTINCT cp.user_id) AS participant_count,
              u.name AS creator_name
       FROM contests c
       LEFT JOIN contest_participants cp ON cp.contest_id = c.id
       LEFT JOIN users u ON u.id = c.created_by
       ${where}
       GROUP BY c.id, u.name
       ORDER BY c.start_time DESC`,
      params,
    );
  }

  async findOne(id: string, userId?: string) {
    const contest = await this.db.queryOne(
      `SELECT c.*,
              COUNT(DISTINCT cp.user_id) AS participant_count
       FROM contests c
       LEFT JOIN contest_participants cp ON cp.contest_id = c.id
       WHERE c.id = $1
       GROUP BY c.id`,
      [id],
    );
    if (!contest) throw new NotFoundException('Contest not found');

    const challenges = await this.db.queryMany(
      `SELECT ch.id, ch.title, ch.slug, ch.difficulty, ch.category, cc.order_index
       FROM contest_challenges cc
       JOIN challenges ch ON ch.id = cc.challenge_id
       WHERE cc.contest_id = $1
       ORDER BY cc.order_index`,
      [id],
    );

    let is_joined = false;
    if (userId) {
      const p = await this.db.queryOne(
        'SELECT id FROM contest_participants WHERE contest_id = $1 AND user_id = $2',
        [id, userId],
      );
      is_joined = !!p;
    }

    return { ...contest, challenges, is_joined };
  }

  async join(contestId: string, userId: string) {
    const contest = await this.db.queryOne('SELECT * FROM contests WHERE id = $1', [contestId]);
    if (!contest) throw new NotFoundException('Contest not found');
    if (contest.status === 'completed' || contest.status === 'cancelled') {
      throw new BadRequestException('Contest is not open for registration');
    }

    const existing = await this.db.queryOne(
      'SELECT id FROM contest_participants WHERE contest_id = $1 AND user_id = $2',
      [contestId, userId],
    );
    if (existing) throw new BadRequestException('Already joined this contest');

    if (contest.max_participants) {
      const count = await this.db.queryOne<{ count: string }>(
        'SELECT COUNT(*) FROM contest_participants WHERE contest_id = $1', [contestId],
      );
      if (parseInt(count.count) >= contest.max_participants) {
        throw new BadRequestException('Contest is full');
      }
    }

    return this.db.transaction(async (client) => {
      let txnId: string | null = null;

      if (parseFloat(contest.entry_fee) > 0) {
        const ref = `CE-${contestId}-${userId}-${Date.now()}`;
        const result = await this.wallet.debit(
          userId, parseFloat(contest.entry_fee), 'contest_entry', ref,
          'internal', null, { contest_id: contestId }, client,
        );
        txnId = result.transaction_id;

        // Add entry fee to prize pool
        await client.query(
          'UPDATE contests SET prize_pool = prize_pool + $1 WHERE id = $2',
          [contest.entry_fee, contestId],
        );
      }

      await client.query(
        `INSERT INTO contest_participants (contest_id, user_id, transaction_id)
         VALUES ($1,$2,$3)`,
        [contestId, userId, txnId],
      );

      return { success: true, message: 'Successfully joined contest' };
    });
  }

  async create(dto: CreateContestDto, adminId: string) {
    if (new Date(dto.end_time) <= new Date(dto.start_time)) {
      throw new BadRequestException('End time must be after start time');
    }

    return this.db.transaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO contests
           (title, description, entry_fee, start_time, end_time, max_participants, is_rated, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [
          dto.title, dto.description || null, dto.entry_fee,
          dto.start_time, dto.end_time, dto.max_participants || null,
          dto.is_rated ?? true, adminId,
        ],
      );
      const contest = rows[0];

      for (let i = 0; i < dto.challenge_ids.length; i++) {
        await client.query(
          'INSERT INTO contest_challenges (contest_id, challenge_id, order_index) VALUES ($1,$2,$3)',
          [contest.id, dto.challenge_ids[i], i],
        );
      }

      return contest;
    });
  }

  async updateStatus(id: string) {
    const contest = await this.db.queryOne('SELECT * FROM contests WHERE id = $1', [id]);
    if (!contest) throw new NotFoundException();

    const now = new Date();
    let status = contest.status;
    if (now >= new Date(contest.start_time) && now < new Date(contest.end_time)) status = 'active';
    if (now >= new Date(contest.end_time) && status !== 'completed') status = 'completed';

    await this.db.query('UPDATE contests SET status = $1 WHERE id = $2', [status, id]);
    return { status };
  }

  async getLeaderboard(contestId: string) {
    return this.db.queryMany(
      `SELECT lb.rank, lb.score, lb.total_time_ms, u.name AS user_name
       FROM leaderboards lb
       JOIN users u ON u.id = lb.user_id
       WHERE lb.contest_id = $1
       ORDER BY lb.rank ASC LIMIT 50`,
      [contestId],
    );
  }
}
