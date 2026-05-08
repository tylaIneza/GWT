import {
  Injectable, ConflictException, UnauthorizedException,
  BadRequestException, NotFoundException,
} from '@nestjs/common';
import { JwtService }      from '@nestjs/jwt';
import * as bcrypt         from 'bcryptjs';
import * as crypto         from 'crypto';
import { v4 as uuid }      from 'uuid';
import { DatabaseService } from '../database/database.service';
import { EmailService }    from './email.service';
import { RegisterDto }     from './dto/register.dto';
import { LoginDto }        from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private db: DatabaseService,
    private jwt: JwtService,
    private email: EmailService,
  ) {}

  async register(dto: RegisterDto, _ip: string, _userAgent: string) {
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
      await conn.execute(
        'INSERT INTO users (id, name, email, password_hash, phone, country_code, language, preferred_currency, email_verified) VALUES (?,?,?,?,?,?,?,?,0)',
        [userId, dto.name, dto.email.toLowerCase(), hash, dto.phone || null, countryCode, language, currency],
      );
      await conn.execute(
        'INSERT INTO wallets (id, user_id, currency) VALUES (?,?,?)', [walId, userId, currency],
      );
    });

    const otp = this.generateOtp();
    await this.saveOtp(userId, dto.email.toLowerCase(), otp);
    await this.email.sendVerificationOtp(dto.email.toLowerCase(), dto.name, otp);

    return { requiresVerification: true, email: dto.email.toLowerCase() };
  }

  async login(dto: LoginDto, ip: string, userAgent: string) {
    const user = await this.db.queryOne(
      'SELECT id, name, email, role, password_hash, is_banned, email_verified FROM users WHERE email = ?',
      [dto.email.toLowerCase()],
    );
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (user.is_banned) throw new UnauthorizedException('Account suspended');

    const valid = await bcrypt.compare(dto.password, user.password_hash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    if (!user.email_verified) {
      const otp = this.generateOtp();
      await this.saveOtp(user.id, user.email, otp);
      await this.email.sendVerificationOtp(user.email, user.name, otp);
      throw new UnauthorizedException({
        message: 'Email not verified. A new OTP has been sent to your email.',
        requiresVerification: true,
        email: user.email,
      });
    }

    const token = this.sign(user);
    await this.recordSession(user.id, token, ip, userAgent);
    const { password_hash, email_verified, ...safe } = user;
    return { token, user: safe };
  }

  async verifyEmail(email: string, otp: string, ip: string, userAgent: string) {
    const user = await this.db.queryOne(
      'SELECT id, name, email, role FROM users WHERE email = ?', [email.toLowerCase()],
    );
    if (!user) throw new NotFoundException('User not found');

    const record = await this.db.queryOne(
      `SELECT id, otp_code, expires_at, used FROM email_verifications
       WHERE user_id = ? AND used = 0 ORDER BY created_at DESC LIMIT 1`,
      [user.id],
    );
    if (!record) throw new BadRequestException('No pending verification found');
    if (record.used) throw new BadRequestException('OTP already used');
    if (new Date(record.expires_at + 'Z') < new Date()) throw new BadRequestException('OTP expired');
    if (record.otp_code !== otp.trim()) throw new BadRequestException('Invalid OTP');

    await this.db.execute('UPDATE email_verifications SET used = 1 WHERE id = ?', [record.id]);
    await this.db.execute('UPDATE users SET email_verified = 1 WHERE id = ?', [user.id]);

    const token = this.sign(user);
    await this.recordSession(user.id, token, ip, userAgent);
    return { token, user };
  }

  async resendOtp(email: string) {
    const user = await this.db.queryOne(
      'SELECT id, name, email, email_verified FROM users WHERE email = ?', [email.toLowerCase()],
    );
    if (!user) throw new NotFoundException('User not found');
    if (user.email_verified) throw new BadRequestException('Email already verified');

    const otp = this.generateOtp();
    await this.saveOtp(user.id, user.email, otp);
    await this.email.sendVerificationOtp(user.email, user.name, otp);
    return { message: 'OTP sent' };
  }

  async forgotPassword(email: string) {
    const user = await this.db.queryOne(
      'SELECT id, name, email FROM users WHERE email = ?', [email.toLowerCase()],
    );
    if (!user) {
      // Don't reveal whether email exists
      return { message: 'If that email is registered, you will receive a reset code.' };
    }

    const otp = this.generateOtp();
    const exp = this.toMySQLDate(new Date(Date.now() + 10 * 60 * 1000));
    await this.db.execute(
      'INSERT INTO password_resets (id, email, otp_code, expires_at) VALUES (?,?,?,?)',
      [uuid(), user.email, otp, exp],
    );
    await this.email.sendPasswordResetOtp(user.email, otp);
    return { message: 'If that email is registered, you will receive a reset code.' };
  }

  async resetPassword(email: string, otp: string, newPassword: string) {
    const record = await this.db.queryOne(
      `SELECT id, otp_code, expires_at, used FROM password_resets
       WHERE email = ? AND used = 0 ORDER BY created_at DESC LIMIT 1`,
      [email.toLowerCase()],
    );
    if (!record) throw new BadRequestException('No pending reset found');
    if (record.used) throw new BadRequestException('OTP already used');
    if (new Date(record.expires_at + 'Z') < new Date()) throw new BadRequestException('OTP expired');
    if (record.otp_code !== otp.trim()) throw new BadRequestException('Invalid OTP');

    const hash = await bcrypt.hash(newPassword, 12);
    await this.db.execute('UPDATE password_resets SET used = 1 WHERE id = ?', [record.id]);
    await this.db.execute(
      'UPDATE users SET password_hash = ?, email_verified = 1 WHERE email = ?',
      [hash, email.toLowerCase()],
    );
    return { message: 'Password reset successful' };
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

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private toMySQLDate(d: Date): string {
    return d.toISOString().replace('T', ' ').slice(0, 19);
  }

  private async saveOtp(userId: string, email: string, otp: string) {
    const exp = this.toMySQLDate(new Date(Date.now() + 10 * 60 * 1000));
    // Invalidate previous OTPs
    await this.db.execute(
      'UPDATE email_verifications SET used = 1 WHERE user_id = ? AND used = 0',
      [userId],
    );
    await this.db.execute(
      'INSERT INTO email_verifications (id, user_id, email, otp_code, expires_at) VALUES (?,?,?,?,?)',
      [uuid(), userId, email, otp, exp],
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
    const exp  = this.toMySQLDate(new Date(Date.now() + 7 * 24 * 3600 * 1000));
    await this.db.execute(
      `INSERT IGNORE INTO user_sessions (id, user_id, token_hash, ip_address, user_agent, expires_at)
       VALUES (?,?,?,?,?,?)`,
      [uuid(), userId, hash, ip || '0.0.0.0', ua, exp],
    );
  }
}
