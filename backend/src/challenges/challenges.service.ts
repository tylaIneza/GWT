import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService }      from '../database/database.service';
import { CreateChallengeDto }   from './dto/create-challenge.dto';
import { v4 as uuid }           from 'uuid';

@Injectable()
export class ChallengesService {
  constructor(private db: DatabaseService) {}

  async findAll(query: any) {
    const { difficulty, category, search, page = 1, limit = 20 } = query;
    const offset  = (Number(page) - 1) * Number(limit);
    const params: any[] = [];
    const where: string[] = ['c.is_published = TRUE'];

    if (difficulty) { params.push(difficulty); where.push(`c.difficulty = $${params.length}`); }
    if (category)   { params.push(category);   where.push(`c.category = $${params.length}`); }
    if (search)     { params.push(`%${search}%`); where.push(`c.title ILIKE $${params.length}`); }

    const whereClause = where.join(' AND ');
    params.push(Number(limit), offset);

    const challenges = await this.db.queryMany(
      `SELECT c.id, c.title, c.slug, c.difficulty, c.category, c.supported_languages,
              c.time_limit_ms, c.memory_limit_mb, c.max_submissions, c.created_at,
              COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'accepted') AS accepted_count,
              COUNT(DISTINCT s.id) AS total_submissions
       FROM challenges c
       LEFT JOIN submissions s ON s.challenge_id = c.id
       WHERE ${whereClause}
       GROUP BY c.id
       ORDER BY c.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return { challenges };
  }

  async findOne(slugOrId: string, userId?: string) {
    const challenge = await this.db.queryOne(
      `SELECT c.*, u.name AS author_name
       FROM challenges c
       LEFT JOIN users u ON u.id = c.created_by
       WHERE (c.slug = $1 OR c.id::text = $1) AND c.is_published = TRUE`,
      [slugOrId],
    );
    if (!challenge) throw new NotFoundException('Challenge not found');

    // Only return sample test cases
    const test_cases = await this.db.queryMany(
      'SELECT id, input, expected_output, points, explanation FROM test_cases WHERE challenge_id = $1 AND is_sample = TRUE ORDER BY order_index',
      [challenge.id],
    );

    let user_stats = null;
    if (userId) {
      user_stats = await this.db.queryOne(
        `SELECT COUNT(*) AS submissions, MAX(score) AS best_score,
                bool_or(status = 'accepted') AS solved
         FROM submissions WHERE user_id = $1 AND challenge_id = $2`,
        [userId, challenge.id],
      );
    }

    return { ...challenge, test_cases, user_stats };
  }

  async create(dto: CreateChallengeDto, userId: string) {
    const slug = this.toSlug(dto.title);
    const existing = await this.db.queryOne('SELECT id FROM challenges WHERE slug = $1', [slug]);
    if (existing) throw new BadRequestException('A challenge with this title already exists');

    return this.db.transaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO challenges (title, slug, description, difficulty, category,
          supported_languages, time_limit_ms, memory_limit_mb, max_submissions,
          submission_cooldown_seconds, is_published, randomize_inputs, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
        [
          dto.title, slug, dto.description, dto.difficulty,
          dto.category || null, dto.supported_languages || ['javascript','python'],
          dto.time_limit_ms || 5000, dto.memory_limit_mb || 256,
          dto.max_submissions || 10, dto.submission_cooldown_seconds || 30,
          dto.is_published || false, dto.randomize_inputs ?? true, userId,
        ],
      );
      const challenge = rows[0];

      for (let i = 0; i < dto.test_cases.length; i++) {
        const tc = dto.test_cases[i];
        await client.query(
          `INSERT INTO test_cases (challenge_id, input, expected_output, is_sample, is_hidden, points, order_index, explanation)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [challenge.id, tc.input, tc.expected_output,
           tc.is_sample ?? false, tc.is_hidden ?? true,
           tc.points ?? 1, i, tc.explanation || null],
        );
      }

      return challenge;
    });
  }

  async update(id: string, dto: Partial<CreateChallengeDto>) {
    const challenge = await this.db.queryOne('SELECT id FROM challenges WHERE id = $1', [id]);
    if (!challenge) throw new NotFoundException('Challenge not found');

    const fields: string[] = [];
    const params: any[]    = [];

    if (dto.title !== undefined)       { params.push(dto.title);       fields.push(`title = $${params.length}`); }
    if (dto.description !== undefined) { params.push(dto.description); fields.push(`description = $${params.length}`); }
    if (dto.difficulty !== undefined)  { params.push(dto.difficulty);  fields.push(`difficulty = $${params.length}`); }
    if (dto.is_published !== undefined){ params.push(dto.is_published);fields.push(`is_published = $${params.length}`); }
    if (dto.time_limit_ms !== undefined){ params.push(dto.time_limit_ms); fields.push(`time_limit_ms = $${params.length}`); }

    if (!fields.length) return challenge;
    params.push(id);
    await this.db.query(
      `UPDATE challenges SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`,
      params,
    );
    return this.db.queryOne('SELECT * FROM challenges WHERE id = $1', [id]);
  }

  async delete(id: string) {
    await this.db.query('DELETE FROM challenges WHERE id = $1', [id]);
    return { success: true };
  }

  /** Return all test cases (including hidden) — for the code runner */
  async getTestCasesForRunner(challengeId: string) {
    return this.db.queryMany(
      'SELECT * FROM test_cases WHERE challenge_id = $1 ORDER BY order_index',
      [challengeId],
    );
  }

  private toSlug(title: string): string {
    return title.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }
}
