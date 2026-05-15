import { Module }            from '@nestjs/common';
import { APP_GUARD }         from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { DatabaseModule }   from './database/database.module';
import { AuthModule }       from './auth/auth.module';
import { ChallengesModule } from './challenges/challenges.module';
import { SubmissionsModule }from './submissions/submissions.module';
import { ContestsModule }   from './contests/contests.module';
import { WalletModule }     from './wallet/wallet.module';
import { PaymentsModule }   from './payments/payments.module';
import { AntiCheatModule }  from './anti-cheat/anti-cheat.module';
import { LeaderboardModule }from './leaderboard/leaderboard.module';
import { AdminModule }      from './admin/admin.module';
import { SessionsModule }   from './sessions/sessions.module';
import { BadgesModule }     from './badges/badges.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([{
      name:   'global',
      ttl:    60000,  // 1 minute window
      limit:  120,    // max 120 requests per minute per IP
    }]),
    DatabaseModule,
    AuthModule,
    ChallengesModule,
    SubmissionsModule,
    ContestsModule,
    WalletModule,
    PaymentsModule,
    AntiCheatModule,
    LeaderboardModule,
    AdminModule,
    SessionsModule,
    BadgesModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
