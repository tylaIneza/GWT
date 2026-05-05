import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuid }         from 'uuid';
import { DatabaseService }    from '../database/database.service';

interface AnalysisInput {
  userId: string; submissionId: string; contestId?: string;
  challengeId: string; code: string; language: string;
  typingStats?: any; preRiskScore: number; status: string; executionTime: number;
}

@Injectable()
export class AntiCheatService {
  private readonly logger = new Logger(AntiCheatService.name);
  constructor(private db: DatabaseService) {}

  async scorePreSubmission(dto: any, userId: string, ip: string): Promise<number> {
    let risk = 0;

    const ipCount = await this.db.queryOne<{ cnt: number }>(
      'SELECT COUNT(DISTINCT user_id) AS cnt FROM user_sessions WHERE ip_address = ?',
      [ip || '0.0.0.0'],
    );
    if ((ipCount?.cnt || 0) > 3) {
      risk += 20;
      await this.flag(userId, null, dto.contest_id, 'shared_ip', 'medium', { ip, accounts: ipCount.cnt });
    }

    if (dto.typing_stats) {
      const { keystrokes, paste_count, time_to_first_char, total_time_ms } = dto.typing_stats;
      if (paste_count > 3) risk += 25;
      if (keystrokes < 10 && dto.code.length > 50) risk += 40;
      if (time_to_first_char < 1000 && dto.code.length > 100) risk += 15;
      const rate = keystrokes / Math.max((total_time_ms || 1) / 1000, 1);
      if (rate > 20) risk += 20;
    }

    return Math.min(risk, 100);
  }

  async analyzeSubmission(input: AnalysisInput): Promise<number> {
    let risk = input.preRiskScore;
    const flags: string[] = [];

    if (input.status === 'accepted' && (input.typingStats?.total_time_ms || 0) < 5000) {
      risk += 30;
      flags.push('instant_perfect_solution');
    }

    const simRisk = await this.checkPlagiarism(input.userId, input.challengeId, input.code, input.contestId);
    risk += simRisk;

    if ((input.typingStats?.paste_count || 0) > 5) {
      risk += 20;
      flags.push('excessive_paste');
    }

    const finalRisk = Math.min(Math.round(risk), 100);
    await this.db.execute(
      'UPDATE users SET risk_score = LEAST(risk_score + ?, 100) WHERE id = ?',
      [Math.round(finalRisk / 10), input.userId],
    );

    if (finalRisk >= 60) {
      await this.flag(
        input.userId, input.submissionId, input.contestId,
        flags.join(',') || 'high_risk_submission',
        finalRisk >= 80 ? 'critical' : 'high',
        { risk: finalRisk, flags },
      );
    }

    return finalRisk;
  }

  async trackDevice(userId: string, fingerprint: string, ip: string, userAgent: string) {
    await this.db.execute(
      `INSERT INTO device_fingerprints (id, user_id, fingerprint_hash, ip_address, user_agent)
       VALUES (?,?,?,?,?)
       ON DUPLICATE KEY UPDATE last_seen_at = NOW()`,
      [uuid(), userId, fingerprint, ip || '0.0.0.0', userAgent],
    );

    const conflict = await this.db.queryOne<{ cnt: number }>(
      'SELECT COUNT(DISTINCT user_id) AS cnt FROM device_fingerprints WHERE fingerprint_hash = ? AND user_id != ?',
      [fingerprint, userId],
    );
    if ((conflict?.cnt || 0) > 0) {
      await this.flag(userId, null, null, 'device_shared_across_accounts', 'high', { fingerprint });
    }
  }

  async getFlagsForAdmin(page = 1, limit = 30) {
    const offset = (page - 1) * limit;
    return this.db.queryMany(
      `SELECT cf.*, u.name AS user_name, u.email AS user_email, u.risk_score
       FROM cheat_flags cf JOIN users u ON u.id = cf.user_id
       WHERE cf.is_reviewed = 0
       ORDER BY cf.created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset],
    );
  }

  async reviewFlag(flagId: string, adminId: string, action: string, notes: string) {
    await this.db.execute(
      'UPDATE cheat_flags SET is_reviewed = 1, reviewed_by = ?, review_action = ?, review_notes = ? WHERE id = ?',
      [adminId, action, notes, flagId],
    );
    if (action === 'ban') {
      const flag = await this.db.queryOne('SELECT user_id FROM cheat_flags WHERE id = ?', [flagId]);
      await this.db.execute(
        'UPDATE users SET is_banned = 1, ban_reason = ? WHERE id = ?',
        [notes || 'Cheating violation', flag.user_id],
      );
    }
  }

  private async checkPlagiarism(userId: string, challengeId: string, code: string, contestId?: string): Promise<number> {
    const others = await this.db.queryMany(
      `SELECT code, user_id FROM submissions
       WHERE challenge_id = ? AND user_id != ? AND status = 'accepted' LIMIT 50`,
      [challengeId, userId],
    );
    let maxSim = 0;
    for (const o of others) {
      const sim = this.similarity(code, o.code);
      if (sim > maxSim) maxSim = sim;
      if (sim > 0.85) {
        await this.flag(userId, null, contestId, 'code_similarity', 'critical', { similar_to_user: o.user_id, similarity: sim });
        return 40;
      }
    }
    return maxSim > 0.70 ? 15 : 0;
  }

  private similarity(a: string, b: string): number {
    const tok = (s: string) => new Set(s.replace(/\s+/g,' ').split(/\W+/).filter(t => t.length > 1));
    const A = tok(a), B = tok(b);
    const inter = new Set([...A].filter(x => B.has(x)));
    const union = new Set([...A, ...B]);
    return union.size === 0 ? 0 : inter.size / union.size;
  }

  private async flag(userId: string, submissionId: string | null, contestId: string | null | undefined, flagType: string, severity: string, details: any) {
    await this.db.execute(
      'INSERT INTO cheat_flags (id, user_id, submission_id, contest_id, flag_type, severity, details) VALUES (?,?,?,?,?,?,?)',
      [uuid(), userId, submissionId, contestId || null, flagType, severity, JSON.stringify(details)],
    ).catch(e => this.logger.warn('Flag insert failed', e.message));
  }
}
