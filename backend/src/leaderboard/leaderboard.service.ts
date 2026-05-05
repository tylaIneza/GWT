import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class LeaderboardService {
  constructor(private db: DatabaseService) {}

  async getGlobal(limit = 50) {
    return this.db.queryMany(
      `SELECT u.id, u.name, u.country_code, u.total_earnings,
              COUNT(CASE WHEN s.status = 'accepted' THEN 1 END) AS problems_solved,
              COUNT(DISTINCT cp.contest_id) AS contests_joined,
              COUNT(CASE WHEN cp.rank_position = 1 THEN 1 END) AS wins
       FROM users u
       LEFT JOIN submissions s ON s.user_id = u.id
       LEFT JOIN contest_participants cp ON cp.user_id = u.id
       WHERE u.role = 'user' AND u.is_banned = 0
       GROUP BY u.id
       ORDER BY problems_solved DESC, u.total_earnings DESC
       LIMIT ?`,
      [limit],
    );
  }

  async getContestLeaderboard(contestId: string) {
    return this.db.queryMany(
      `SELECT lb.rank_position AS rank, lb.score, lb.total_time_ms, lb.updated_at,
              u.id AS user_id, u.name AS user_name, u.country_code
       FROM leaderboards lb JOIN users u ON u.id = lb.user_id
       WHERE lb.contest_id = ? ORDER BY lb.rank_position ASC`,
      [contestId],
    );
  }
}
