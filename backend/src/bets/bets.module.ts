import { Module }        from '@nestjs/common';
import { BetsService }   from './bets.service';
import { BetsController }from './bets.controller';
import { WalletModule }  from '../wallet/wallet.module';

@Module({
  imports:     [WalletModule],
  controllers: [BetsController],
  providers:   [BetsService],
  exports:     [BetsService],
})
export class BetsModule {}
