import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { v4 as uuid }           from 'uuid';
import { DatabaseService }      from '../database/database.service';
import { CreateChallengeDto }   from './dto/create-challenge.dto';
import { AiService }            from '../ai/ai.service';

@Injectable()
export class ChallengesService {
  constructor(private db: DatabaseService, private ai: AiService) {}

  async findAll(query: any, userId?: string) {
    const { difficulty, category, search, page = 1, limit = 20 } = query;
    const offset = (Number(page) - 1) * Number(limit);
    const where: string[] = ['c.is_published = 1'];
    const filterParams: any[] = [];

    if (difficulty) { filterParams.push(difficulty);    where.push('c.difficulty = ?'); }
    if (category)   { filterParams.push(category);      where.push('c.category = ?'); }
    if (search)     { filterParams.push(`%${search}%`); where.push('c.title LIKE ?'); }

    // Subquery params come first (they appear in SELECT before WHERE)
    const subqueryParams = userId ? [userId, userId] : [];
    const params = [...subqueryParams, ...filterParams, Number(limit), offset];

    const userSubqueries = userId
      ? `, (SELECT MAX(CASE WHEN su.status='accepted' THEN 1 ELSE 0 END)
             FROM submissions su WHERE su.user_id=? AND su.challenge_id=c.id) AS user_solved,
           (SELECT COUNT(*)
             FROM submissions su WHERE su.user_id=? AND su.challenge_id=c.id) AS user_attempts`
      : `, 0 AS user_solved, 0 AS user_attempts`;

    const challenges = await this.db.queryMany(
      `SELECT c.id, c.title, c.slug, c.difficulty, c.category, c.supported_languages,
              c.time_limit_ms, c.memory_limit_mb, c.max_submissions, c.created_at,
              COUNT(CASE WHEN s.status = 'accepted' THEN 1 END) AS accepted_count,
              COUNT(s.id) AS total_submissions
              ${userSubqueries}
       FROM challenges c
       LEFT JOIN submissions s ON s.challenge_id = c.id
       WHERE ${where.join(' AND ')}
       GROUP BY c.id
       ORDER BY c.created_at DESC
       LIMIT ? OFFSET ?`,
      params,
    );

    return { challenges: challenges.map(this.parseChallenge) };
  }

  async findOne(slugOrId: string, userId?: string) {
    const challenge = await this.db.queryOne(
      `SELECT c.*, u.name AS author_name
       FROM challenges c LEFT JOIN users u ON u.id = c.created_by
       WHERE (c.slug = ? OR c.id = ?) AND c.is_published = 1`,
      [slugOrId, slugOrId],
    );
    if (!challenge) throw new NotFoundException('Challenge not found');

    const test_cases = await this.db.queryMany(
      'SELECT id, input, expected_output, points, explanation FROM test_cases WHERE challenge_id = ? AND is_sample = 1 ORDER BY order_index',
      [challenge.id],
    );

    let user_stats = null;
    if (userId) {
      user_stats = await this.db.queryOne(
        `SELECT COUNT(*) AS submissions, MAX(score) AS best_score,
                MAX(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) AS solved
         FROM submissions WHERE user_id = ? AND challenge_id = ?`,
        [userId, challenge.id],
      );
    }

    return { ...this.parseChallenge(challenge), test_cases, user_stats };
  }

  async create(dto: CreateChallengeDto, userId: string) {
    const slug     = this.toSlug(dto.title);
    const existing = await this.db.queryOne('SELECT id FROM challenges WHERE slug = ?', [slug]);
    if (existing) throw new BadRequestException('A challenge with this title already exists');

    const challengeId = uuid();

    await this.db.transaction(async (conn) => {
      await conn.query(
        `INSERT INTO challenges
           (id, title, slug, description, difficulty, category, supported_languages,
            time_limit_ms, memory_limit_mb, max_submissions, submission_cooldown_seconds,
            is_published, randomize_inputs, created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          challengeId, dto.title, slug, dto.description, dto.difficulty,
          dto.category || null,
          JSON.stringify(dto.supported_languages || ['javascript','python']),
          dto.time_limit_ms || 5000, dto.memory_limit_mb || 256,
          dto.max_submissions || 10, dto.submission_cooldown_seconds || 30,
          dto.is_published ? 1 : 0, dto.randomize_inputs !== false ? 1 : 0,
          userId,
        ],
      );

      for (let i = 0; i < dto.test_cases.length; i++) {
        const tc = dto.test_cases[i];
        await conn.query(
          `INSERT INTO test_cases
             (id, challenge_id, input, expected_output, is_sample, is_hidden, points, order_index, explanation)
           VALUES (?,?,?,?,?,?,?,?,?)`,
          [
            uuid(), challengeId, tc.input, tc.expected_output,
            tc.is_sample ? 1 : 0, tc.is_hidden !== false ? 1 : 0,
            tc.points || 1, i, tc.explanation || null,
          ],
        );
      }
    });

    const created = await this.db.queryOne('SELECT * FROM challenges WHERE id = ?', [challengeId]);
    return this.parseChallenge(created);
  }

  async update(id: string, dto: Partial<CreateChallengeDto>) {
    const challenge = await this.db.queryOne('SELECT id FROM challenges WHERE id = ?', [id]);
    if (!challenge) throw new NotFoundException('Challenge not found');

    const fields: string[] = [];
    const params: any[]    = [];

    if (dto.title       !== undefined) { params.push(dto.title);       fields.push('title = ?'); }
    if (dto.description !== undefined) { params.push(dto.description); fields.push('description = ?'); }
    if (dto.difficulty  !== undefined) { params.push(dto.difficulty);  fields.push('difficulty = ?'); }
    if (dto.is_published!== undefined) { params.push(dto.is_published ? 1 : 0); fields.push('is_published = ?'); }

    if (!fields.length) return challenge;
    params.push(id);
    await this.db.execute(`UPDATE challenges SET ${fields.join(', ')} WHERE id = ?`, params);
    const updated = await this.db.queryOne('SELECT * FROM challenges WHERE id = ?', [id]);
    return this.parseChallenge(updated);
  }

  async getRandomChallenge(userId: string, difficulty?: string, category?: string) {
    const extra: string[] = [];
    const params: any[] = [userId, userId];
    if (difficulty) { extra.push('AND c.difficulty = ?'); params.push(difficulty); }
    if (category)   { extra.push('AND c.category = ?');   params.push(category); }

    const challenge = await this.db.queryOne<any>(
      `SELECT c.id, c.title, c.difficulty, c.category, c.slug
       FROM challenges c
       WHERE c.is_published = 1
         AND c.id NOT IN (
           SELECT s.challenge_id FROM submissions s
           WHERE s.user_id = ? AND s.status = 'accepted'
         )
         AND c.id NOT IN (
           SELECT cs.challenge_id FROM challenge_sessions cs
           WHERE cs.status = 'active' AND cs.user_id != ? AND cs.expires_at > NOW()
         )
         ${extra.join(' ')}
       ORDER BY RAND()
       LIMIT 1`,
      params,
    );
    if (!challenge) return { id: null, message: 'No more challenges available with those filters!' };
    return challenge;
  }

  async getRecommendations(userId: string) {
    // Get user's solved categories and difficulties
    const history = await this.db.queryMany(
      `SELECT c.category, c.difficulty, COUNT(*) AS count
       FROM submissions s JOIN challenges c ON c.id = s.challenge_id
       WHERE s.user_id = ? AND s.status = 'accepted'
       GROUP BY c.category, c.difficulty`,
      [userId],
    );

    // Get user's total solved
    const totalSolved = history.reduce((sum, r) => sum + (r.count || 0), 0);

    // Determine recommended difficulty
    const hardCount   = history.filter(h => h.difficulty === 'hard').reduce((s, r) => s + r.count, 0);
    const mediumCount = history.filter(h => h.difficulty === 'medium').reduce((s, r) => s + r.count, 0);
    let recDifficulty = 'easy';
    if (totalSolved > 50 || hardCount > 10)   recDifficulty = 'hard';
    else if (totalSolved > 20 || mediumCount > 5) recDifficulty = 'medium';

    // Get unsolved challenges sorted by matching category then difficulty
    const topCategories = history
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(h => h.category);

    const recommended = await this.db.queryMany(
      `SELECT c.id, c.title, c.slug, c.difficulty, c.category,
              COUNT(CASE WHEN s.status = 'accepted' THEN 1 END) AS accepted_count
       FROM challenges c
       LEFT JOIN submissions s ON s.challenge_id = c.id
       WHERE c.is_published = 1
         AND c.id NOT IN (
           SELECT s2.challenge_id FROM submissions s2
           WHERE s2.user_id = ? AND s2.status = 'accepted'
         )
       GROUP BY c.id
       ORDER BY
         CASE WHEN c.difficulty = ? THEN 0 ELSE 1 END,
         CASE WHEN c.category IN (${topCategories.length ? topCategories.map(() => '?').join(',') : 'NULL'}) THEN 0 ELSE 1 END,
         RAND()
       LIMIT 10`,
      [userId, recDifficulty, ...topCategories],
    );

    return {
      recommendations: recommended.map(this.parseChallenge),
      user_level: totalSolved > 50 ? 'advanced' : totalSolved > 20 ? 'intermediate' : 'beginner',
      recommended_difficulty: recDifficulty,
      total_solved: totalSolved,
    };
  }

  async getUserProfile(userId: string) {
    const user = await this.db.queryOne(
      `SELECT u.id, u.name, u.email, u.country_code, u.avatar_url, u.bio,
              u.total_earnings, u.solved_count, u.current_streak, u.longest_streak,
              u.subscription_plan, u.created_at, u.github_url, u.twitter_url, u.website_url,
              w.balance
       FROM users u LEFT JOIN wallets w ON w.user_id = u.id
       WHERE u.id = ? AND u.role = 'user' AND u.is_banned = 0`,
      [userId],
    );
    if (!user) return null;

    const [badges, recentSolves, stats] = await Promise.all([
      this.db.queryMany(
        `SELECT b.*, ub.awarded_at FROM badges b
         JOIN user_badges ub ON ub.badge_id = b.id
         WHERE ub.user_id = ? ORDER BY ub.awarded_at DESC`,
        [userId],
      ),
      this.db.queryMany(
        `SELECT c.title, c.difficulty, c.category, s.submitted_at
         FROM submissions s JOIN challenges c ON c.id = s.challenge_id
         WHERE s.user_id = ? AND s.status = 'accepted'
         ORDER BY s.submitted_at DESC LIMIT 10`,
        [userId],
      ),
      this.db.queryOne(
        `SELECT
           SUM(CASE WHEN c.difficulty = 'easy'   AND s.status = 'accepted' THEN 1 ELSE 0 END) AS easy_solved,
           SUM(CASE WHEN c.difficulty = 'medium' AND s.status = 'accepted' THEN 1 ELSE 0 END) AS medium_solved,
           SUM(CASE WHEN c.difficulty = 'hard'   AND s.status = 'accepted' THEN 1 ELSE 0 END) AS hard_solved,
           COUNT(DISTINCT cp.contest_id) AS contests_joined,
           SUM(CASE WHEN cp.rank_position = 1 THEN 1 ELSE 0 END) AS contest_wins
         FROM submissions s
         JOIN challenges c ON c.id = s.challenge_id
         LEFT JOIN contest_participants cp ON cp.user_id = s.user_id
         WHERE s.user_id = ?`,
        [userId],
      ),
    ]);

    return { ...user, badges, recent_solves: recentSolves, stats };
  }

  async generateAiChallenge(difficulty: 'easy' | 'medium' | 'hard', category?: string, userId?: string) {
    const generated = await this.ai.generateChallenge(difficulty, category);
    if (!generated) {
      // Fallback: return a random unsolved challenge
      return this.getRandomChallenge(userId || '', difficulty, category);
    }

    const challengeId = `ai-${uuid().slice(0, 8)}`;
    const slug = `ai-${this.toSlug(generated.title)}-${Date.now()}`;
    const langs = JSON.stringify(['javascript','typescript','python','java','cpp','csharp','php','go','rust','swift','kotlin','ruby']);
    const timeLimit = difficulty === 'easy' ? 5000 : difficulty === 'medium' ? 5000 : 5000;

    await this.db.execute(
      `INSERT INTO challenges (id, title, slug, description, difficulty, category, supported_languages,
       time_limit_ms, memory_limit_mb, max_submissions, is_published, randomize_inputs, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,1,0,?)`,
      [challengeId, generated.title, slug, generated.description, difficulty,
       generated.category || category || 'ai-generated', langs, timeLimit, 256, 10, 'ai'],
    );

    let order = 0;
    for (const tc of generated.test_cases) {
      const tcId = uuid();
      await this.db.execute(
        `INSERT INTO test_cases (id, challenge_id, input, expected_output, is_sample, explanation, order_index)
         VALUES (?,?,?,?,?,?,?)`,
        [tcId, challengeId, tc.input, tc.expected_output, tc.is_sample ? 1 : 0, tc.explanation || null, order++],
      );
    }

    return { id: challengeId, ai_generated: true };
  }

  async delete(id: string) {
    await this.db.execute('DELETE FROM challenges WHERE id = ?', [id]);
    return { success: true };
  }

  async getTestCasesForRunner(challengeId: string) {
    return this.db.queryMany(
      'SELECT * FROM test_cases WHERE challenge_id = ? ORDER BY order_index', [challengeId],
    );
  }

  private parseChallenge(c: any) {
    if (!c) return c;
    if (typeof c.supported_languages === 'string') {
      try { c.supported_languages = JSON.parse(c.supported_languages); } catch { c.supported_languages = []; }
    }
    return c;
  }

  private toSlug(title: string) {
    return title.toLowerCase().replace(/[^a-z0-9\s-]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-').trim();
  }
}
