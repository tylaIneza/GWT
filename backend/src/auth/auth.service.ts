import { Injectable, ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../database/database.service';
import { RegisterDto }     from './dto/register.dto';
import { LoginDto }        from './dto/login.dto';
import { v4 as uuid }      from 'uuid';
import * as crypto         from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private db:  DatabaseService,
    private jwt: JwtService,
  ) {}

  async register(dto: RegisterDto, ip: string, userAgent: string) {
    const existing = await this.db.queryOne(
      'SELECT id FROM users WHERE email = $1', [dto.email.toLowerCase()],
    );
    if (existing) throw new ConflictException('Email already registered');

    const hash = await bcrypt.hash(dto.password, 12);

    const user = await this.db.transaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO users (name, email, password_hash, phone, country_code)
         VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role`,
        [dto.name, dto.email.toLowerCase(), hash, dto.phone || null, dto.country_code || 'RW'],
      );
      const newUser = rows[0];

      // Create wallet
      await client.query(
        'INSERT INTO wallets (user_id) VALUES ($1)', [newUser.id],
      );

      return newUser;
    });

    await this.recordSession(user.id, this.sign(user), ip, userAgent);

    return { token: this.sign(user), user: this.sanitize(user) };
  }

  async login(dto: LoginDto, ip: string, userAgent: string) {
    const user = await this.db.queryOne(
      'SELECT id, name, email, role, password_hash, is_banned FROM users WHERE email = $1',
      [dto.email.toLowerCase()],
    );
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (user.is_banned) throw new UnauthorizedException('Account suspended');

    const valid = await bcrypt.compare(dto.password, user.password_hash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const token = this.sign(user);
    await this.recordSession(user.id, token, ip, userAgent);

    return { token, user: this.sanitize(user) };
  }

  async logout(userId: string, token: string) {
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    await this.db.query(
      'UPDATE user_sessions SET is_active = FALSE WHERE user_id = $1 AND token_hash = $2',
      [userId, hash],
    );
  }

  async me(userId: string) {
    const user = await this.db.queryOne(
      `SELECT u.id, u.name, u.email, u.role, u.phone, u.country_code,
              u.risk_score, u.total_earnings, u.kyc_verified, u.created_at,
              w.balance, w.currency
       FROM users u LEFT JOIN wallets w ON w.user_id = u.id
       WHERE u.id = $1`,
      [userId],
    );
    return user;
  }

  private sign(user: any) {
    return this.jwt.sign({ sub: user.id, email: user.email, role: user.role });
  }

  private sanitize(u: any) {
    const { password_hash, ...safe } = u;
    return safe;
  }

  private async recordSession(userId: string, token: string, ip: string, ua: string) {
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const exp  = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.db.query(
      `INSERT INTO user_sessions (user_id, token_hash, ip_address, user_agent, expires_at)
       VALUES ($1, $2, $3::inet, $4, $5)
       ON CONFLICT DO NOTHING`,
      [userId, hash, ip || '0.0.0.0', ua, exp],
    );
  }
}
