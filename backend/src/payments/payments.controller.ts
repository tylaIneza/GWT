import { Controller, Post, Get, Body, Query, Req, UseGuards } from '@nestjs/common';
import { IsString, IsNumber, IsIn, Min } from 'class-validator';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard }    from '../auth/jwt-auth.guard';

class DepositDto {
  @IsNumber() @Min(500) amount: number;
  @IsString() phone: string;
  @IsIn(['mtn', 'airtel']) provider: 'mtn' | 'airtel';
}

class WithdrawDto {
  @IsNumber() @Min(1000) amount: number;
  @IsString() phone: string;
  @IsIn(['mtn', 'airtel']) provider: 'mtn' | 'airtel';
}

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private svc: PaymentsService) {}

  @Post('deposit')
  deposit(@Body() dto: DepositDto, @Req() req: any) {
    return this.svc.initiateDeposit(req.user.id, dto.amount, dto.phone, dto.provider);
  }

  @Get('deposit/verify')
  verifyDeposit(@Query('reference') ref: string, @Req() req: any) {
    return this.svc.checkAndCreditDeposit(ref, req.user.id);
  }

  @Post('withdraw')
  withdraw(@Body() dto: WithdrawDto, @Req() req: any) {
    return this.svc.initiateWithdrawal(req.user.id, dto.amount, dto.phone, dto.provider);
  }
}
