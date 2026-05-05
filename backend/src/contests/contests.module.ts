import { Module }             from '@nestjs/common';
import { ContestsController } from './contests.controller';
import { ContestsService }    from './contests.service';
import { WalletModule }       from '../wallet/wallet.module';

@Module({
  imports:     [WalletModule],
  controllers: [ContestsController],
  providers:   [ContestsService],
  exports:     [ContestsService],
})
export class ContestsModule {}
