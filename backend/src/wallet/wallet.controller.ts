import { Controller, Get, Post, Delete, Query, Req, Body, Param, UseGuards } from '@nestjs/common';
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

  @Post('withdraw-request')
  requestWithdrawal(@Req() req: any, @Body() body: { amount: number; method: string; account_details: any }) {
    return this.svc.requestWithdrawal(req.user.id, body.amount, body.method, body.account_details);
  }

  @Get('withdrawals')
  getUserWithdrawals(@Req() req: any) {
    return this.svc.getUserWithdrawals(req.user.id);
  }

  @Delete('withdrawals/:id')
  cancelWithdrawal(@Req() req: any, @Param('id') id: string) {
    return this.svc.cancelWithdrawal(req.user.id, id);
  }
}
