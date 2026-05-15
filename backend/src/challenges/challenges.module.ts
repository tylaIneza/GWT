import { Module }               from '@nestjs/common';
import { ChallengesController } from './challenges.controller';
import { ChallengesService }    from './challenges.service';
import { SessionsModule }       from '../sessions/sessions.module';
import { AiModule }             from '../ai/ai.module';

@Module({
  imports:     [SessionsModule, AiModule],
  controllers: [ChallengesController],
  providers:   [ChallengesService],
  exports:     [ChallengesService],
})
export class ChallengesModule {}
