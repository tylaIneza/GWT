import { Injectable, ForbiddenException } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { DatabaseService } from '../database/database.service';
import { BetsService }    from '../bets/bets.service';

const SESSION_MS = 3 * 60 * 1000; // 3 minutes

@Injectable()
export class SessionsService {
  constructor(
    private db:   DatabaseService,
    private bets: BetsService,
  ) {}

  async start(userId: string, challengeId: string) {
    const existing = await this.db.queryOne<any>(
      `SELECT id, expires_at FROM challenge_sessions
       WHERE user_id=? AND challenge_id=? AND status='active'
       ORDER BY started_at DESC LIMIT 1`,
      [userId, challengeId],
    );

    if (existing) {
      if (new Date(existing.expires_at) > new Date()) {
        return { session_id: existing.id, expires_at: new Date(existing.expires_at).toISOString(), resumed: true };
      }
      // Expired — forfeit bet and mark timed_out
      await this.db.execute(
        `UPDATE challenge_sessions SET status='timed_out' WHERE id=?`, [existing.id],
      );
      await this.bets.resolveBet(userId, challengeId, `timeout-${existing.id}`, false).catch(() => null);
    }

    const sessionId = uuid();
    const expiresAt = new Date(Date.now() + SESSION_MS);
    await this.db.execute(
      `INSERT INTO challenge_sessions (id, user_id, challenge_id, expires_at)
       VALUES (?,?,?,?)`,
      [sessionId, userId, challengeId, expiresAt.toISOString()],
    );
    return { session_id: sessionId, expires_at: expiresAt.toISOString(), resumed: false };
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
    const session = await this.getActive(userId, challengeId);
    if (!session) return; // no session = no time limit
    if (new Date(session.expires_at) <= new Date()) {
      await this.db.execute(`UPDATE challenge_sessions SET status='timed_out' WHERE id=?`, [session.id]);
      await this.bets.resolveBet(userId, challengeId, `timeout-${session.id}`, false).catch(() => null);
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
    await this.bets.resolveBet(userId, challengeId, `forfeit-${userId}-${Date.now()}`, false).catch(() => null);
    return { forfeited: true };
  }
}
