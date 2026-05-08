import { Module }             from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService }    from './payments.service';
import { MtnMomoService }     from './mtn-momo.service';
import { AirtelMoneyService } from './airtel-money.service';
import { StripeService }      from './stripe.service';
import { PayPalService }      from './paypal.service';
import { WalletModule }       from '../wallet/wallet.module';

@Module({
  imports:     [WalletModule],
  controllers: [PaymentsController],
  providers:   [PaymentsService, MtnMomoService, AirtelMoneyService, StripeService, PayPalService],
  exports:     [PaymentsService],
})
export class PaymentsModule {}
