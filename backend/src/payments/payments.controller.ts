import { Controller, Post, Get, Body, Query, Req, UseGuards } from '@nestjs/common';
import { IsString, IsNumber, IsIn, Min, IsObject } from 'class-validator';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard }    from '../auth/jwt-auth.guard';

class MobileDepositDto {
  @IsNumber() @Min(500) amount: number;
  @IsString() phone: string;
  @IsIn(['mtn', 'airtel']) provider: 'mtn' | 'airtel';
}

class MobileWithdrawDto {
  @IsNumber() @Min(1000) amount: number;
  @IsString() phone: string;
  @IsIn(['mtn', 'airtel']) provider: 'mtn' | 'airtel';
}

class CardDepositDto {
  @IsNumber() @Min(5) amount: number;
  @IsString() currency: string;
  @IsObject() card: { number: string; expiry: string; cvv: string; name: string };
}

class PayPalDepositDto {
  @IsNumber() @Min(5) amount: number;
  @IsString() currency: string;
}

class PayPalCaptureDto {
  @IsString() order_id: string;
}

class StripeConfirmDto {
  @IsString() payment_intent_id: string;
}

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private svc: PaymentsService) {}

  // ─── Mobile Money ────────────────────────────────────────────
  @Post('deposit')
  deposit(@Body() dto: MobileDepositDto, @Req() req: any) {
    return this.svc.initiateDeposit(req.user.id, dto.amount, dto.phone, dto.provider);
  }

  @Get('deposit/verify')
  verifyDeposit(@Query('reference') ref: string, @Req() req: any) {
    return this.svc.checkAndCreditDeposit(ref, req.user.id);
  }

  @Post('withdraw')
  withdraw(@Body() dto: MobileWithdrawDto, @Req() req: any) {
    return this.svc.initiateWithdrawal(req.user.id, dto.amount, dto.phone, dto.provider);
  }

  // ─── Stripe ─────────────────────────────────────────────────
  @Post('card/deposit')
  cardDeposit(@Body() dto: CardDepositDto, @Req() req: any) {
    return this.svc.createStripeDeposit(req.user.id, dto.amount, dto.currency, dto.card);
  }

  @Post('card/confirm')
  cardConfirm(@Body() dto: StripeConfirmDto, @Req() req: any) {
    return this.svc.confirmStripeDeposit(req.user.id, dto.payment_intent_id);
  }

  // ─── PayPal ──────────────────────────────────────────────────
  @Post('paypal/create')
  paypalCreate(@Body() dto: PayPalDepositDto, @Req() req: any) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return this.svc.createPayPalDeposit(req.user.id, dto.amount, dto.currency, frontendUrl);
  }

  @Post('paypal/capture')
  paypalCapture(@Body() dto: PayPalCaptureDto, @Req() req: any) {
    return this.svc.capturePayPalDeposit(req.user.id, dto.order_id);
  }
}
