import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class LeaderboardService {
  constructor(private db: DatabaseService) {}

  async getGlobal(limit = 50) {
    return this.db.queryMany(
      `SELECT u.id, u.name, u.country_code,
              COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'accepted') AS problems_solved,
              u.total_earnings,
              COUNT(DISTINCT cp.contest_id) AS contests_joined,
              COUNT(DISTINCT cp.contest_id) FILTER (WHERE cp.rank = 1) AS wins
       FROM users u
       LEFT JOIN submissions s  ON s.user_id = u.id
       LEFT JOIN contest_participants cp ON cp.user_id = u.id
       WHERE u.role = 'user' AND u.is_banned = FALSE
       GROUP BY u.id
       ORDER BY problems_solved DESC, u.total_earnings DESC
       LIMIT $1`,
      [limit],
    );
  }

  async getContestLeaderboard(contestId: string) {
    return this.db.queryMany(
      `SELECT lb.rank, lb.score, lb.total_time_ms, lb.updated_at,
              u.id AS user_id, u.name AS user_name, u.country_code
       FROM leaderboards lb
       JOIN users u ON u.id = lb.user_id
       WHERE lb.contest_id = $1
       ORDER BY lb.rank ASC`,
      [contestId],
    );
  }
}
