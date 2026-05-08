import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService }      from '@nestjs/jwt';
import * as bcrypt         from 'bcryptjs';
import * as crypto         from 'crypto';
import { v4 as uuid }      from 'uuid';
import { DatabaseService } from '../database/database.service';
import { RegisterDto }     from './dto/register.dto';
import { LoginDto }        from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(private db: DatabaseService, private jwt: JwtService) {}

  async register(dto: RegisterDto, ip: string, userAgent: string) {
    const existing = await this.db.queryOne(
      'SELECT id FROM users WHERE email = ?', [dto.email.toLowerCase()],
    );
    if (existing) throw new ConflictException('Email already registered');

    const hash        = await bcrypt.hash(dto.password, 12);
    const userId      = uuid();
    const walId       = uuid();
    const countryCode = dto.country_code || 'US';
    const language    = dto.language    || 'en';
    const currency    = this.currencyForCountry(countryCode);

    await this.db.transaction(async (conn) => {
      await conn.query(
        'INSERT INTO users (id, name, email, password_hash, phone, country_code, language, preferred_currency) VALUES (?,?,?,?,?,?,?,?)',
        [userId, dto.name, dto.email.toLowerCase(), hash, dto.phone || null, countryCode, language, currency],
      );
      await conn.query(
        'INSERT INTO wallets (id, user_id, currency) VALUES (?,?,?)', [walId, userId, currency],
      );
    });

    const user  = { id: userId, name: dto.name, email: dto.email.toLowerCase(), role: 'user' };
    const token = this.sign(user);
    await this.recordSession(userId, token, ip, userAgent);
    return { token, user };
  }

  async login(dto: LoginDto, ip: string, userAgent: string) {
    const user = await this.db.queryOne(
      'SELECT id, name, email, role, password_hash, is_banned FROM users WHERE email = ?',
      [dto.email.toLowerCase()],
    );
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (user.is_banned) throw new UnauthorizedException('Account suspended');

    const valid = await bcrypt.compare(dto.password, user.password_hash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const token = this.sign(user);
    await this.recordSession(user.id, token, ip, userAgent);
    const { password_hash, ...safe } = user;
    return { token, user: safe };
  }

  async logout(userId: string, token: string) {
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    await this.db.execute(
      'UPDATE user_sessions SET is_active = 0 WHERE user_id = ? AND token_hash = ?',
      [userId, hash],
    );
  }

  async me(userId: string) {
    return this.db.queryOne(
      `SELECT u.id, u.name, u.email, u.role, u.phone, u.country_code,
              u.language, u.preferred_currency, u.risk_score,
              u.total_earnings, u.kyc_verified, u.created_at,
              w.balance, w.currency, w.locked_balance
       FROM users u LEFT JOIN wallets w ON w.user_id = u.id
       WHERE u.id = ?`,
      [userId],
    );
  }

  private currencyForCountry(code: string): string {
    const map: Record<string, string> = {
      RW: 'RWF', KE: 'KES', NG: 'NGN', GH: 'GHS', TZ: 'TZS', UG: 'UGX',
      GB: 'GBP', EU: 'EUR', FR: 'EUR', DE: 'EUR', ES: 'EUR', IT: 'EUR', PT: 'EUR', NL: 'EUR',
      JP: 'JPY', CN: 'CNY', KR: 'KRW', IN: 'INR', BR: 'BRL', AU: 'AUD', CA: 'CAD',
      ZA: 'ZAR', EG: 'EGP', MA: 'MAD', SA: 'SAR', AE: 'AED', SG: 'SGD', MY: 'MYR',
    };
    return map[code] || 'USD';
  }

  private sign(user: any) {
    return this.jwt.sign({ sub: user.id, email: user.email, role: user.role });
  }

  private async recordSession(userId: string, token: string, ip: string, ua: string) {
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const exp  = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    await this.db.execute(
      `INSERT IGNORE INTO user_sessions (id, user_id, token_hash, ip_address, user_agent, expires_at)
       VALUES (?,?,?,?,?,?)`,
      [uuid(), userId, hash, ip || '0.0.0.0', ua, exp],
    );
  }
}
