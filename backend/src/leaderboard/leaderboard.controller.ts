import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
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

  @Get('country/:code')
  byCountry(@Param('code') code: string, @Query('limit') limit = 50) {
    return this.svc.getByCountry(code, +limit);
  }

  @Get('countries')
  topCountries() {
    return this.svc.getTopCountries();
  }

  @Get('my-rank')
  myRank(@Req() req: any) {
    return this.svc.getUserRank(req.user.id);
  }

  @Get('contest/:id')
  contest(@Param('id') id: string) {
    return this.svc.getContestLeaderboard(id);
  }
}
