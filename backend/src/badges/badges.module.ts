import { Module }          from '@nestjs/common';
import { BadgesService }   from './badges.service';
import { DatabaseModule }  from '../database/database.module';

@Module({
  imports:   [DatabaseModule],
  providers: [BadgesService],
  exports:   [BadgesService],
})
export class BadgesModule {}
