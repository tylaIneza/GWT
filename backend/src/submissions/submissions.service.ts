import {
  Injectable, BadRequestException, NotFoundException,
  ForbiddenException, Logger,
} from '@nestjs/common';
import { HttpService }        from '@nestjs/axios';
import { firstValueFrom }     from 'rxjs';
import { v4 as uuid }         from 'uuid';
import { DatabaseService }    from '../database/database.service';
import { ChallengesService }  from '../challenges/challenges.service';
import { AntiCheatService }   from '../anti-cheat/anti-cheat.service';
import { SubmitDto }          from './dto/submit.dto';
import { BetsService }        from '../bets/bets.service';

@Injectable()
export class SubmissionsService {
  private readonly logger = new Logger(SubmissionsService.name);
  private readonly codeRunnerUrl = process.env.CODE_RUNNER_URL || 'http://localhost:3001';

  constructor(
    private db:         DatabaseService,
    private challenges: ChallengesService,
    private antiCheat:  AntiCheatService,
    private http:       HttpService,
    private bets:       BetsService,
  ) {}

  async submit(dto: SubmitDto, userId: string, ip: string, userAgent: string) {
    const challenge = await this.db.queryOne(
      'SELECT * FROM challenges WHERE id = ? AND is_published = 1', [dto.challenge_id],
    );
    if (!challenge) throw new NotFoundException('Challenge not found');

    const langs: string[] = typeof challenge.supported_languages === 'string'
      ? JSON.parse(challenge.supported_languages)
      : (challenge.supported_languages || ['javascript', 'python']);

    if (!langs.includes(dto.language)) {
      throw new BadRequestException(`Language ${dto.language} not supported`);
    }

    // Block re-solving in practice mode — contest re-submissions are allowed
    if (!dto.contest_id) {
      const already = await this.db.queryOne(
        `SELECT id FROM submissions WHERE user_id = ? AND challenge_id = ? AND status = 'accepted' LIMIT 1`,
        [userId, dto.challenge_id],
      );
      if (already) throw new BadRequestException('already_solved');
    }

    // Submission limit (per hour)
    const recent = await this.db.queryOne<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM submissions
       WHERE user_id = ? AND challenge_id = ?
         AND submitted_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)`,
      [userId, dto.challenge_id],
    );
    if ((recent?.cnt || 0) >= challenge.max_submissions) {
      throw new BadRequestException(`Submission limit reached (${challenge.max_submissions}/hour)`);
    }

    // Cooldown
    const last = await this.db.queryOne(
      'SELECT submitted_at FROM submissions WHERE user_id = ? AND challenge_id = ? ORDER BY submitted_at DESC LIMIT 1',
      [userId, dto.challenge_id],
    );
    if (last) {
      const elapsed = Date.now() - new Date(last.submitted_at).getTime();
      const cooldown = challenge.submission_cooldown_seconds * 1000;
      if (elapsed < cooldown) {
        throw new BadRequestException(`Wait ${Math.ceil((cooldown - elapsed) / 1000)}s before resubmitting`);
      }
    }

    if (dto.contest_id) {
      const p = await this.db.queryOne(
        'SELECT id FROM contest_participants WHERE contest_id = ? AND user_id = ?',
        [dto.contest_id, userId],
      );
      if (!p) throw new ForbiddenException('Not enrolled in this contest');

      const contest = await this.db.queryOne('SELECT * FROM contests WHERE id = ?', [dto.contest_id]);
      if (contest?.status !== 'active') throw new BadRequestException('Contest not active');
    }

    const preRisk = await this.antiCheat.scorePreSubmission(dto, userId, ip);

    const subId = uuid();
    await this.db.execute(
      `INSERT INTO submissions
         (id, user_id, challenge_id, contest_id, language, code, status,
          ip_address, user_agent, typing_stats, paste_count, time_to_first_char)
       VALUES (?,?,?,?,?,?,'pending',?,?,?,?,?)`,
      [
        subId, userId, dto.challenge_id, dto.contest_id || null, dto.language, dto.code,
        ip || '0.0.0.0', userAgent,
        JSON.stringify(dto.typing_stats || {}),
        dto.typing_stats?.paste_count || 0,
        dto.typing_stats?.time_to_first_char || 0,
      ],
    );

    const testCases = await this.challenges.getTestCasesForRunner(dto.challenge_id);
    let execResult: any;

    try {
      const resp = await firstValueFrom(
        this.http.post(`${this.codeRunnerUrl}/execute`, {
          language:  dto.language,
          code:      dto.code,
          testCases: testCases.map(tc => ({
            input:    tc.input,
            expected: tc.expected_output,
          })),
          timeLimit: challenge.time_limit_ms,
          memLimit:  challenge.memory_limit_mb,
        }, { timeout: 35000 }),
      );
      execResult = resp.data;
    } catch (err) {
      this.logger.error('Code runner error', err.message);
      await this.db.execute(`UPDATE submissions SET status = 'runtime_error' WHERE id = ?`, [subId]);
      return { id: subId, status: 'runtime_error', message: 'Execution service unavailable' };
    }

    const passed = execResult.results?.filter((r: any) => r.passed).length || 0;
    const total  = testCases.length;
    const score  = total > 0 ? Math.round((passed / total) * 100) : 0;

    let status: string;
    if (execResult.timedOut)   status = 'time_limit_exceeded';
    else if (execResult.error) status = 'compilation_error';
    else if (score === 100)    status = 'accepted';
    else                       status = 'wrong_answer';

    const riskScore = await this.antiCheat.analyzeSubmission({
      userId, submissionId: subId, contestId: dto.contest_id,
      code: dto.code, language: dto.language, challengeId: dto.challenge_id,
      typingStats: dto.typing_stats, preRiskScore: preRisk, status, executionTime: execResult.timeMs,
    });

    if (riskScore >= 80) status = 'cheating_suspected';

    await this.db.execute(
      `UPDATE submissions
       SET status = ?, score = ?, execution_time_ms = ?, memory_used_mb = ?,
           test_results = ?, risk_score = ?
       WHERE id = ?`,
      [status, score, execResult.timeMs || 0, execResult.memoryMb || 0,
       JSON.stringify(execResult.results || []), riskScore, subId],
    );

    if (dto.contest_id && status === 'accepted') {
      await this.updateLeaderboard(dto.contest_id, userId, score, execResult.timeMs || 0);
    }

    // Resolve any open bet for this challenge
    const betResult = await this.bets.resolveBet(
      userId, dto.challenge_id, subId, status === 'accepted',
    ).catch(() => null);

    const sampleResults = (execResult.results || []).map((r: any, i: number) => ({
      test_case:  i + 1,
      passed:     r.passed,
      is_sample:  testCases[i]?.is_sample,
      stdout:     testCases[i]?.is_sample ? r.stdout : undefined,
      expected:   testCases[i]?.is_sample ? testCases[i].expected_output : undefined,
      time_ms:    r.timeMs,
    }));

    return { id: subId, status, score, passed, total, results: sampleResults, risk_score: riskScore, time_ms: execResult.timeMs, bet: betResult };
  }

  async findByUser(userId: string, challengeId?: string) {
    const where  = challengeId ? 'WHERE s.user_id = ? AND s.challenge_id = ?' : 'WHERE s.user_id = ?';
    const params = challengeId ? [userId, challengeId] : [userId];
    return this.db.queryMany(
      `SELECT s.id, s.challenge_id, c.title AS challenge_title,
              s.language, s.status, s.score, s.execution_time_ms, s.submitted_at
       FROM submissions s JOIN challenges c ON c.id = s.challenge_id
       ${where} ORDER BY s.submitted_at DESC LIMIT 50`,
      params,
    );
  }

  async findOne(id: string, userId: string) {
    const s = await this.db.queryOne('SELECT * FROM submissions WHERE id = ? AND user_id = ?', [id, userId]);
    if (!s) throw new NotFoundException('Submission not found');
    return s;
  }

  private async updateLeaderboard(contestId: string, userId: string, score: number, timeMsAdd: number) {
    const p = await this.db.queryOne(
      'SELECT score, total_time_ms FROM contest_participants WHERE contest_id = ? AND user_id = ?',
      [contestId, userId],
    );
    const newScore  = Math.max(p?.score || 0, score);
    const newTimeMs = (p?.total_time_ms || 0) + timeMsAdd;

    await this.db.execute(
      'UPDATE contest_participants SET score = ?, total_time_ms = ? WHERE contest_id = ? AND user_id = ?',
      [newScore, newTimeMs, contestId, userId],
    );

    // Recompute ranks
    const all = await this.db.queryMany(
      'SELECT user_id FROM contest_participants WHERE contest_id = ? ORDER BY score DESC, total_time_ms ASC',
      [contestId],
    );
    for (let i = 0; i < all.length; i++) {
      await this.db.execute(
        'UPDATE contest_participants SET rank_position = ? WHERE contest_id = ? AND user_id = ?',
        [i + 1, contestId, all[i].user_id],
      );
    }

    const user = await this.db.queryOne('SELECT name FROM users WHERE id = ?', [userId]);
    const rank = all.findIndex(x => x.user_id === userId) + 1;

    await this.db.execute(
      `INSERT INTO leaderboards (id, contest_id, user_id, user_name, rank_position, score, total_time_ms)
       VALUES (?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE score = ?, total_time_ms = ?, user_name = ?, rank_position = ?`,
      [uuid(), contestId, userId, user?.name, rank, newScore, newTimeMs, newScore, newTimeMs, user?.name, rank],
    );
  }
}
