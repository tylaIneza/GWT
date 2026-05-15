import { Injectable, ForbiddenException } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { DatabaseService } from '../database/database.service';

const SESSION_MS = 5 * 60 * 1000;

@Injectable()
export class SessionsService {
  constructor(private db: DatabaseService) {}

  async start(userId: string, challengeId: string) {
    const existing = await this.db.queryOne<any>(
      `SELECT id, expires_at, (expires_at > NOW()) AS still_valid FROM challenge_sessions
       WHERE user_id=? AND challenge_id=? AND status='active'
       ORDER BY started_at DESC LIMIT 1`,
      [userId, challengeId],
    );

    if (existing) {
      if (existing.still_valid) {
        return { session_id: existing.id, expires_at: existing.expires_at, resumed: true };
      }
      await this.db.execute(
        `UPDATE challenge_sessions SET status='timed_out' WHERE id=?`, [existing.id],
      );
    }

    const sessionId = uuid();
    await this.db.execute(
      `INSERT INTO challenge_sessions (id, user_id, challenge_id, expires_at)
       VALUES (?,?,?, DATE_ADD(NOW(), INTERVAL 300 SECOND))`,
      [sessionId, userId, challengeId],
    );
    const created = await this.db.queryOne<any>(
      `SELECT expires_at FROM challenge_sessions WHERE id=?`, [sessionId],
    );
    return { session_id: sessionId, expires_at: created?.expires_at, resumed: false };
  }

  async getActive(userId: string, challengeId: string) {
    return this.db.queryOne<any>(
      `SELECT id, status, expires_at, started_at FROM challenge_sessions
       WHERE user_id=? AND challenge_id=? AND status='active'
       ORDER BY started_at DESC LIMIT 1`,
      [userId, challengeId],
    );
  }

  async validateOrThrow(userId: string, challengeId: string) {
    const row = await this.db.queryOne<any>(
      `SELECT id, (expires_at > NOW()) AS still_valid
       FROM challenge_sessions
       WHERE user_id=? AND challenge_id=? AND status='active'
       ORDER BY started_at DESC LIMIT 1`,
      [userId, challengeId],
    );
    if (!row) return;
    if (!row.still_valid) {
      await this.db.execute(`UPDATE challenge_sessions SET status='timed_out' WHERE id=?`, [row.id]);
      throw new ForbiddenException('time_limit_exceeded');
    }
  }

  async complete(userId: string, challengeId: string) {
    await this.db.execute(
      `UPDATE challenge_sessions SET status='completed'
       WHERE user_id=? AND challenge_id=? AND status='active'`,
      [userId, challengeId],
    );
  }

  async forfeit(userId: string, challengeId: string) {
    await this.db.execute(
      `UPDATE challenge_sessions SET status='timed_out'
       WHERE user_id=? AND challenge_id=? AND status='active'`,
      [userId, challengeId],
    );
    return { forfeited: true };
  }
}
