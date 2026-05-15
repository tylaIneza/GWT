import { Module }                from '@nestjs/common';
import { HttpModule }            from '@nestjs/axios';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsService }    from './submissions.service';
import { ChallengesModule }      from '../challenges/challenges.module';
import { AntiCheatModule }       from '../anti-cheat/anti-cheat.module';
import { SessionsModule }        from '../sessions/sessions.module';
import { WalletModule }          from '../wallet/wallet.module';
import { AiModule }              from '../ai/ai.module';
import { BadgesModule }          from '../badges/badges.module';

@Module({
  imports:     [HttpModule, ChallengesModule, AntiCheatModule, SessionsModule, WalletModule, AiModule, BadgesModule],
  controllers: [SubmissionsController],
  providers:   [SubmissionsService],
  exports:     [SubmissionsService],
})
export class SubmissionsModule {}
