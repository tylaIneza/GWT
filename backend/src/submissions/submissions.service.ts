import {
  Injectable, BadRequestException, NotFoundException,
  ForbiddenException, Logger,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { DatabaseService }    from '../database/database.service';
import { ChallengesService }  from '../challenges/challenges.service';
import { AntiCheatService }   from '../anti-cheat/anti-cheat.service';
import { SubmitDto }          from './dto/submit.dto';
import { firstValueFrom }     from 'rxjs';

@Injectable()
export class SubmissionsService {
  private readonly logger = new Logger(SubmissionsService.name);
  private readonly codeRunnerUrl = process.env.CODE_RUNNER_URL || 'http://localhost:3001';

  constructor(
    private db:         DatabaseService,
    private challenges: ChallengesService,
    private antiCheat:  AntiCheatService,
    private http:       HttpService,
  ) {}

  async submit(dto: SubmitDto, userId: string, ip: string, userAgent: string) {
    const challenge = await this.db.queryOne(
      'SELECT * FROM challenges WHERE id = $1 AND is_published = TRUE', [dto.challenge_id],
    );
    if (!challenge) throw new NotFoundException('Challenge not found');

    if (!challenge.supported_languages.includes(dto.language)) {
      throw new BadRequestException(`Language ${dto.language} not supported`);
    }

    // Enforce submission limit
    const recentCount = await this.db.queryOne<{ count: string }>(
      `SELECT COUNT(*) FROM submissions
       WHERE user_id = $1 AND challenge_id = $2
         AND submitted_at > NOW() - INTERVAL '1 hour'`,
      [userId, dto.challenge_id],
    );
    if (parseInt(recentCount.count) >= challenge.max_submissions) {
      throw new BadRequestException(`Submission limit reached (${challenge.max_submissions}/hour)`);
    }

    // Cooldown check
    const lastSub = await this.db.queryOne(
      `SELECT submitted_at FROM submissions
       WHERE user_id = $1 AND challenge_id = $2
       ORDER BY submitted_at DESC LIMIT 1`,
      [userId, dto.challenge_id],
    );
    if (lastSub) {
      const elapsed = Date.now() - new Date(lastSub.submitted_at).getTime();
      const cooldown = challenge.submission_cooldown_seconds * 1000;
      if (elapsed < cooldown) {
        throw new BadRequestException(
          `Please wait ${Math.ceil((cooldown - elapsed) / 1000)}s before resubmitting`,
        );
      }
    }

    // Check contest participation if contest_id provided
    if (dto.contest_id) {
      const participant = await this.db.queryOne(
        'SELECT id FROM contest_participants WHERE contest_id = $1 AND user_id = $2',
        [dto.contest_id, userId],
      );
      if (!participant) throw new ForbiddenException('You are not enrolled in this contest');

      const contest = await this.db.queryOne(
        'SELECT * FROM contests WHERE id = $1', [dto.contest_id],
      );
      if (contest?.status !== 'active') throw new BadRequestException('Contest is not active');
      if (new Date() > new Date(contest.end_time)) throw new BadRequestException('Contest has ended');
    }

    // Anti-cheat: pre-run checks
    const preRiskScore = await this.antiCheat.scorePreSubmission(dto, userId, ip);

    // Save submission as pending
    const submission = await this.db.queryOne(
      `INSERT INTO submissions
         (user_id, challenge_id, contest_id, language, code, status,
          ip_address, user_agent, typing_stats, paste_count, time_to_first_char)
       VALUES ($1,$2,$3,$4,$5,'pending',$6::inet,$7,$8,$9,$10)
       RETURNING *`,
      [
        userId, dto.challenge_id, dto.contest_id || null, dto.language, dto.code,
        ip || '0.0.0.0', userAgent,
        JSON.stringify(dto.typing_stats || {}),
        dto.typing_stats?.paste_count || 0,
        dto.typing_stats?.time_to_first_char || 0,
      ],
    );

    // Get all test cases (hidden + visible)
    const testCases = await this.challenges.getTestCasesForRunner(dto.challenge_id);

    // Execute code
    let execResult: any;
    try {
      const response = await firstValueFrom(
        this.http.post(`${this.codeRunnerUrl}/execute`, {
          language:  dto.language,
          code:      dto.code,
          testCases: testCases.map(tc => ({ input: tc.input, expected: tc.expected_output })),
          timeLimit: challenge.time_limit_ms,
          memLimit:  challenge.memory_limit_mb,
        }, { timeout: 30000 }),
      );
      execResult = response.data;
    } catch (err) {
      this.logger.error('Code runner error', err.message);
      await this.db.query(
        `UPDATE submissions SET status = 'runtime_error' WHERE id = $1`, [submission.id],
      );
      return { id: submission.id, status: 'runtime_error', message: 'Execution service unavailable' };
    }

    // Calculate score
    const passed = execResult.results?.filter((r: any) => r.passed).length || 0;
    const total  = testCases.length;
    const score  = total > 0 ? Math.round((passed / total) * 100) : 0;

    let status: string;
    if (execResult.timedOut)       status = 'time_limit_exceeded';
    else if (execResult.error)     status = 'compilation_error';
    else if (score === 100)        status = 'accepted';
    else                           status = 'wrong_answer';

    // Anti-cheat: post-run analysis
    const riskScore = await this.antiCheat.analyzeSubmission({
      userId, submissionId: submission.id, contestId: dto.contest_id,
      code: dto.code, language: dto.language, challengeId: dto.challenge_id,
      typingStats: dto.typing_stats, preRiskScore, status, executionTime: execResult.timeMs,
    });

    if (riskScore >= 80) status = 'cheating_suspected';

    // Persist result
    await this.db.query(
      `UPDATE submissions
       SET status = $1, score = $2, execution_time_ms = $3,
           memory_used_mb = $4, test_results = $5, risk_score = $6
       WHERE id = $7`,
      [
        status, score, execResult.timeMs || 0, execResult.memoryMb || 0,
        JSON.stringify(execResult.results || []),
        riskScore, submission.id,
      ],
    );

    // Update contest leaderboard
    if (dto.contest_id && status === 'accepted') {
      await this.updateLeaderboard(dto.contest_id, userId, score, execResult.timeMs || 0);
    }

    const sampleResults = (execResult.results || []).map((r: any, i: number) => ({
      test_case:  i + 1,
      passed:     r.passed,
      is_sample:  testCases[i]?.is_sample || false,
      stdout:     testCases[i]?.is_sample ? r.stdout : undefined,
      expected:   testCases[i]?.is_sample ? testCases[i].expected_output : undefined,
      time_ms:    r.timeMs,
    }));

    return {
      id:         submission.id,
      status,
      score,
      passed,
      total,
      results:    sampleResults,
      risk_score: riskScore,
      time_ms:    execResult.timeMs,
    };
  }

  async findByUser(userId: string, challengeId?: string) {
    const where = challengeId
      ? 'WHERE s.user_id = $1 AND s.challenge_id = $2'
      : 'WHERE s.user_id = $1';
    const params = challengeId ? [userId, challengeId] : [userId];

    return this.db.queryMany(
      `SELECT s.id, s.challenge_id, c.title AS challenge_title,
              s.language, s.status, s.score, s.execution_time_ms,
              s.submitted_at
       FROM submissions s
       JOIN challenges c ON c.id = s.challenge_id
       ${where}
       ORDER BY s.submitted_at DESC LIMIT 50`,
      params,
    );
  }

  async findOne(id: string, userId: string) {
    const sub = await this.db.queryOne(
      'SELECT * FROM submissions WHERE id = $1 AND user_id = $2', [id, userId],
    );
    if (!sub) throw new NotFoundException('Submission not found');
    return sub;
  }

  private async updateLeaderboard(contestId: string, userId: string, score: number, timeMsAdd: number) {
    // Accumulate best score + total time per user
    const participant = await this.db.queryOne(
      'SELECT score, total_time_ms FROM contest_participants WHERE contest_id = $1 AND user_id = $2',
      [contestId, userId],
    );
    const newScore   = Math.max(participant?.score || 0, score);
    const newTimeMs  = (participant?.total_time_ms || 0) + timeMsAdd;

    await this.db.query(
      `UPDATE contest_participants SET score = $1, total_time_ms = $2 WHERE contest_id = $3 AND user_id = $4`,
      [newScore, newTimeMs, contestId, userId],
    );

    // Recompute ranks
    await this.db.query(`
      WITH ranked AS (
        SELECT user_id, RANK() OVER (ORDER BY score DESC, total_time_ms ASC) AS r
        FROM contest_participants WHERE contest_id = $1
      )
      UPDATE contest_participants cp SET rank = ranked.r
      FROM ranked WHERE cp.user_id = ranked.user_id AND cp.contest_id = $1
    `, [contestId]);

    const user = await this.db.queryOne('SELECT name FROM users WHERE id = $1', [userId]);
    await this.db.query(
      `INSERT INTO leaderboards (contest_id, user_id, user_name, rank, score, total_time_ms)
       VALUES ($1,$2,$3,
         (SELECT rank FROM contest_participants WHERE contest_id = $1 AND user_id = $2),
         $4,$5)
       ON CONFLICT (contest_id, user_id) DO UPDATE
         SET score = $4, total_time_ms = $5, user_name = $3,
             rank = (SELECT rank FROM contest_participants WHERE contest_id = $1 AND user_id = $2),
             updated_at = NOW()`,
      [contestId, userId, user?.name, newScore, newTimeMs],
    );
  }
}
