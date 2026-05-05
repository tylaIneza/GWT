import { Module }           from '@nestjs/common';
import { AdminController }  from './admin.controller';
import { AdminService }     from './admin.service';
import { WalletModule }     from '../wallet/wallet.module';
import { ContestsModule }   from '../contests/contests.module';

@Module({
  imports:     [WalletModule, ContestsModule],
  controllers: [AdminController],
  providers:   [AdminService],
})
export class AdminModule {}
