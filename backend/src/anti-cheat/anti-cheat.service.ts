import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

interface AnalysisInput {
  userId:        string;
  submissionId:  string;
  contestId?:    string;
  challengeId:   string;
  code:          string;
  language:      string;
  typingStats?:  any;
  preRiskScore:  number;
  status:        string;
  executionTime: number;
}

@Injectable()
export class AntiCheatService {
  private readonly logger = new Logger(AntiCheatService.name);

  constructor(private db: DatabaseService) {}

  /** Pre-submission checks (before code runs) */
  async scorePreSubmission(dto: any, userId: string, ip: string): Promise<number> {
    let risk = 0;

    // 1. Check if IP is shared with many accounts
    const ipCount = await this.db.queryOne<{ count: string }>(
      `SELECT COUNT(DISTINCT user_id) FROM user_sessions WHERE ip_address = $1::inet`,
      [ip || '0.0.0.0'],
    );
    if (parseInt(ipCount?.count || '0') > 3) {
      risk += 20;
      await this.flag(userId, null, dto.contest_id, 'shared_ip', 'medium', {
        ip, accounts: ipCount.count,
      });
    }

    // 2. Check typing stats — no keystrokes is suspicious
    if (dto.typing_stats) {
      const { keystrokes, paste_count, time_to_first_char, total_time_ms } = dto.typing_stats;
      if (paste_count > 3) { risk += 25; }
      if (keystrokes < 10 && dto.code.length > 50) { risk += 40; }
      if (time_to_first_char < 1000 && dto.code.length > 100) { risk += 15; }
      const typingRate = keystrokes / Math.max(total_time_ms / 1000, 1);
      if (typingRate > 20) { risk += 20; } // > 20 chars/sec is machine-like
    }

    return Math.min(risk, 100);
  }

  /** Full post-execution analysis */
  async analyzeSubmission(input: AnalysisInput): Promise<number> {
    let risk = input.preRiskScore;
    const flags: string[] = [];

    // 3. Instant perfect submission
    if (input.status === 'accepted' && (input.typingStats?.total_time_ms || 0) < 5000) {
      risk += 30;
      flags.push('instant_perfect_solution');
    }

    // 4. Code similarity check against other submissions
    const similarityRisk = await this.checkPlagiarism(
      input.userId, input.challengeId, input.code, input.contestId,
    );
    risk += similarityRisk;

    // 5. Check for code that looks copy-pasted from online (known patterns)
    if (this.hasBoilerplatePatterns(input.code)) { risk += 10; }

    // 6. Excessive paste count
    if ((input.typingStats?.paste_count || 0) > 5) {
      risk += 20;
      flags.push('excessive_paste');
    }

    const finalRisk = Math.min(Math.round(risk), 100);

    // Update user risk score
    await this.db.query(
      `UPDATE users SET risk_score = LEAST(risk_score + $1, 100) WHERE id = $2`,
      [Math.round(finalRisk / 10), input.userId],
    );

    // Auto-flag if high risk
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

  /** Track device fingerprint */
  async trackDevice(userId: string, fingerprint: string, ip: string, userAgent: string) {
    await this.db.query(
      `INSERT INTO device_fingerprints (user_id, fingerprint_hash, ip_address, user_agent)
       VALUES ($1, $2, $3::inet, $4)
       ON CONFLICT (user_id, fingerprint_hash)
       DO UPDATE SET last_seen_at = NOW()`,
      [userId, fingerprint, ip || '0.0.0.0', userAgent],
    );

    // Check if fingerprint belongs to another user
    const conflict = await this.db.queryOne(
      `SELECT COUNT(DISTINCT user_id) AS cnt
       FROM device_fingerprints
       WHERE fingerprint_hash = $1 AND user_id != $2`,
      [fingerprint, userId],
    );
    if (parseInt(conflict?.cnt || '0') > 0) {
      await this.flag(userId, null, null, 'device_shared_across_accounts', 'high', { fingerprint });
    }
  }

  /** Return flagged users for admin review */
  async getFlagsForAdmin(page = 1, limit = 30) {
    const offset = (page - 1) * limit;
    return this.db.queryMany(
      `SELECT cf.*, u.name AS user_name, u.email AS user_email, u.risk_score
       FROM cheat_flags cf
       JOIN users u ON u.id = cf.user_id
       WHERE cf.is_reviewed = FALSE
       ORDER BY cf.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
  }

  async reviewFlag(flagId: string, adminId: string, action: string, notes: string) {
    await this.db.query(
      `UPDATE cheat_flags
       SET is_reviewed = TRUE, reviewed_by = $1, review_action = $2, review_notes = $3
       WHERE id = $4`,
      [adminId, action, notes, flagId],
    );

    if (action === 'ban') {
      const flag = await this.db.queryOne('SELECT user_id FROM cheat_flags WHERE id = $1', [flagId]);
      await this.db.query(
        `UPDATE users SET is_banned = TRUE, ban_reason = $1 WHERE id = $2`,
        [notes || 'Cheating violation', flag.user_id],
      );
    }
  }

  private async checkPlagiarism(userId: string, challengeId: string, code: string, contestId?: string): Promise<number> {
    const others = await this.db.queryMany(
      `SELECT code, user_id FROM submissions
       WHERE challenge_id = $1 AND user_id != $2
         AND status = 'accepted'
         AND (contest_id = $3 OR $3 IS NULL)
       LIMIT 50`,
      [challengeId, userId, contestId || null],
    );

    let maxSim = 0;
    for (const other of others) {
      const sim = this.similarity(code, other.code);
      if (sim > maxSim) maxSim = sim;
      if (sim > 0.85) {
        await this.flag(userId, null, contestId, 'code_similarity', 'critical', {
          similar_to_user: other.user_id, similarity: sim,
        });
        return 40;
      }
    }
    if (maxSim > 0.70) return 15;
    return 0;
  }

  /** Jaccard-based token similarity */
  private similarity(a: string, b: string): number {
    const tokenize = (s: string) => new Set(
      s.replace(/\s+/g, ' ').trim().split(/\W+/).filter(t => t.length > 1),
    );
    const setA = tokenize(a);
    const setB = tokenize(b);
    const inter = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return union.size === 0 ? 0 : inter.size / union.size;
  }

  private hasBoilerplatePatterns(code: string): boolean {
    const patterns = [
      /solution\s*=\s*lambda/i,
      /# this is my solution/i,
      /\/\/ solution from leetcode/i,
    ];
    return patterns.some(p => p.test(code));
  }

  private async flag(
    userId: string, submissionId: string | null, contestId: string | null | undefined,
    flagType: string, severity: string, details: any,
  ) {
    await this.db.query(
      `INSERT INTO cheat_flags (user_id, submission_id, contest_id, flag_type, severity, details)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [userId, submissionId, contestId || null, flagType, severity, JSON.stringify(details)],
    ).catch(e => this.logger.warn('Flag insert failed', e.message));
  }
}
