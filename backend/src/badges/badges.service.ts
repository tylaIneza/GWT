import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuid }        from 'uuid';
import { DatabaseService }   from '../database/database.service';

@Injectable()
export class BadgesService {
  private readonly logger = new Logger(BadgesService.name);

  constructor(private db: DatabaseService) {}

  async getUserBadges(userId: string) {
    return this.db.queryMany(
      `SELECT b.*, ub.awarded_at
       FROM badges b JOIN user_badges ub ON ub.badge_id = b.id
       WHERE ub.user_id = ?
       ORDER BY ub.awarded_at DESC`,
      [userId],
    );
  }

  async awardBadge(userId: string, slug: string) {
    const badge = await this.db.queryOne('SELECT id FROM badges WHERE slug = ?', [slug]);
    if (!badge) return;
    await this.db.execute(
      'INSERT IGNORE INTO user_badges (id, user_id, badge_id) VALUES (?,?,?)',
      [uuid(), userId, badge.id],
    );
  }

  async checkAndAwardBadges(userId: string, context: {
    isFirstSolve?: boolean;
    isHardSolve?: boolean;
    solvedCount?: number;
    currentStreak?: number;
    scoreIs100?: boolean;
    solvedAtHour?: number;
    isContestWin?: boolean;
    timeTakenMs?: number;
    referralCount?: number;
  }) {
    const {
      isFirstSolve, isHardSolve, solvedCount = 0,
      currentStreak = 0, scoreIs100, solvedAtHour,
      isContestWin, timeTakenMs, referralCount = 0,
    } = context;

    const awards: string[] = [];

    if (isFirstSolve)                    awards.push('first_blood');
    if (isHardSolve)                     awards.push('first_hard');
    if (currentStreak >= 3)              awards.push('streak_3');
    if (currentStreak >= 7)              awards.push('streak_7');
    if (currentStreak >= 30)             awards.push('streak_30');
    if (solvedCount >= 10)               awards.push('solved_10');
    if (solvedCount >= 50)               awards.push('solved_50');
    if (solvedCount >= 100)              awards.push('solved_100');
    if (solvedCount >= 500)              awards.push('solved_500');
    if (isContestWin)                    awards.push('contest_winner');
    if (referralCount >= 5)              awards.push('referral_5');
    if (timeTakenMs !== undefined && timeTakenMs < 60000) awards.push('quick_solver');
    if (solvedAtHour !== undefined && (solvedAtHour >= 0 && solvedAtHour < 5)) awards.push('night_owl');

    await Promise.allSettled(awards.map(slug => this.awardBadge(userId, slug)));
    return awards;
  }

  async updateStreak(userId: string): Promise<{ current: number; longest: number }> {
    const user = await this.db.queryOne(
      'SELECT current_streak, longest_streak, last_activity_date FROM users WHERE id = ?',
      [userId],
    );
    if (!user) return { current: 0, longest: 0 };

    const today    = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    const last = user.last_activity_date
      ? new Date(user.last_activity_date)
      : null;

    if (last) {
      last.setHours(0, 0, 0, 0);
      const lastStr  = last.toISOString().split('T')[0];
      const diffDays = Math.round((today.getTime() - last.getTime()) / 86400000);

      if (lastStr === todayStr) {
        return { current: user.current_streak || 1, longest: user.longest_streak || 1 };
      }

      const newStreak = diffDays === 1 ? (user.current_streak || 0) + 1 : 1;
      const longest   = Math.max(newStreak, user.longest_streak || 0);

      await this.db.execute(
        'UPDATE users SET current_streak = ?, longest_streak = ?, last_activity_date = ? WHERE id = ?',
        [newStreak, longest, todayStr, userId],
      );
      return { current: newStreak, longest };
    } else {
      await this.db.execute(
        'UPDATE users SET current_streak = 1, longest_streak = GREATEST(IFNULL(longest_streak,0), 1), last_activity_date = ? WHERE id = ?',
        [todayStr, userId],
      );
      return { current: 1, longest: Math.max(1, user.longest_streak || 0) };
    }
  }

  async getAllBadges() {
    return this.db.queryMany('SELECT * FROM badges ORDER BY rarity DESC, name ASC', []);
  }
}
