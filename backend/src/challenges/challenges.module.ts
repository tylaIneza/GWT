import { Module }               from '@nestjs/common';
import { ChallengesController } from './challenges.controller';
import { ChallengesService }    from './challenges.service';
import { SessionsModule }       from '../sessions/sessions.module';

@Module({
  imports:     [SessionsModule],
  controllers: [ChallengesController],
  providers:   [ChallengesService],
  exports:     [ChallengesService],
})
export class ChallengesModule {}
