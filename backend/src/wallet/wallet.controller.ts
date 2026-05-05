import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { JwtAuthGuard }  from '../auth/jwt-auth.guard';

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private svc: WalletService) {}

  @Get()
  getWallet(@Req() req: any) {
    return this.svc.getWallet(req.user.id);
  }

  @Get('transactions')
  getTransactions(@Req() req: any, @Query('page') page = 1) {
    return this.svc.getTransactions(req.user.id, +page);
  }
}
