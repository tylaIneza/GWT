import { Module } from '@nestjs/common';
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

@Module({
  imports: [
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
  ],
})
export class AppModule {}
