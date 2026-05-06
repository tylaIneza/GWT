import { Module }                from '@nestjs/common';
import { HttpModule }            from '@nestjs/axios';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsService }    from './submissions.service';
import { ChallengesModule }      from '../challenges/challenges.module';
import { AntiCheatModule }       from '../anti-cheat/anti-cheat.module';
import { BetsModule }            from '../bets/bets.module';
import { SessionsModule }        from '../sessions/sessions.module';

@Module({
  imports:     [HttpModule, ChallengesModule, AntiCheatModule, BetsModule, SessionsModule],
  controllers: [SubmissionsController],
  providers:   [SubmissionsService],
  exports:     [SubmissionsService],
})
export class SubmissionsModule {}
