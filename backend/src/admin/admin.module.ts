import { Module }           from '@nestjs/common';
import { MulterModule }     from '@nestjs/platform-express';
import { AdminController }  from './admin.controller';
import { AdminService }     from './admin.service';
import { WalletModule }     from '../wallet/wallet.module';
import { ContestsModule }   from '../contests/contests.module';

@Module({
  imports:     [WalletModule, ContestsModule, MulterModule.register({ storage: undefined })],
  controllers: [AdminController],
  providers:   [AdminService],
})
export class AdminModule {}
