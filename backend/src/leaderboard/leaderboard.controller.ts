import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service';
import { JwtAuthGuard }       from '../auth/jwt-auth.guard';

@Controller('leaderboard')
@UseGuards(JwtAuthGuard)
export class LeaderboardController {
  constructor(private svc: LeaderboardService) {}

  @Get('global')
  global(@Query('limit') limit = 50) {
    return this.svc.getGlobal(+limit);
  }

  @Get('contest/:id')
  contest(@Param('id') id: string) {
    return this.svc.getContestLeaderboard(id);
  }
}
