import { Module }           from '@nestjs/common';
import { AdminController }  from './admin.controller';
import { AdminService }     from './admin.service';
import { WalletModule }     from '../wallet/wallet.module';
import { ContestsModule }   from '../contests/contests.module';
import { BetsModule }       from '../bets/bets.module';

@Module({
  imports:     [WalletModule, ContestsModule, BetsModule],
  controllers: [AdminController],
  providers:   [AdminService],
})
export class AdminModule {}
