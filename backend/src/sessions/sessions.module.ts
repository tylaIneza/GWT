import { Module }          from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { BetsModule }      from '../bets/bets.module';

@Module({
  imports:   [BetsModule],
  providers: [SessionsService],
  exports:   [SessionsService],
})
export class SessionsModule {}
