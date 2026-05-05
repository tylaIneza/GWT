import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private db: DatabaseService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'fallback-secret',
    });
  }

  async validate(payload: any) {
    const user = await this.db.queryOne(
      'SELECT id, email, name, role, is_banned FROM users WHERE id = $1',
      [payload.sub],
    );
    if (!user) throw new UnauthorizedException();
    if (user.is_banned) throw new UnauthorizedException('Account suspended');
    return user;
  }
}
