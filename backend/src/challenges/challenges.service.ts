import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { v4 as uuid }           from 'uuid';
import { DatabaseService }      from '../database/database.service';
import { CreateChallengeDto }   from './dto/create-challenge.dto';

@Injectable()
export class ChallengesService {
  constructor(private db: DatabaseService) {}

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
