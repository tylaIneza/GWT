import { Module }                from '@nestjs/common';
import { HttpModule }            from '@nestjs/axios';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsService }    from './submissions.service';
import { ChallengesModule }      from '../challenges/challenges.module';
import { AntiCheatModule }       from '../anti-cheat/anti-cheat.module';

@Module({
  imports:     [HttpModule, ChallengesModule, AntiCheatModule],
  controllers: [SubmissionsController],
  providers:   [SubmissionsService],
  exports:     [SubmissionsService],
})
export class SubmissionsModule {}
