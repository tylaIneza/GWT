import { Controller, Post, Get, Body, Query, Req, UseGuards } from '@nestjs/common';
import { BetsService }   from './bets.service';
import { PlaceBetDto }   from './dto/place-bet.dto';
import { JwtAuthGuard }  from '../auth/jwt-auth.guard';

@Controller('bets')
@UseGuards(JwtAuthGuard)
export class BetsController {
  constructor(private svc: BetsService) {}

  @Post()
  place(@Body() dto: PlaceBetDto, @Req() req: any) {
    return this.svc.placeBet(req.user.id, dto.challenge_id, dto.amount);
  }

  @Get('active')
  active(@Query('challenge_id') challengeId: string, @Req() req: any) {
    return this.svc.getActiveBet(req.user.id, challengeId);
  }

  @Get('history')
  history(@Req() req: any) {
    return this.svc.getBetHistory(req.user.id);
  }
}
