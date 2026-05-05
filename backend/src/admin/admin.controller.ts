import { Controller, Get, Post, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { AdminService }  from './admin.service';
import { JwtAuthGuard }  from '../auth/jwt-auth.guard';
import { RolesGuard }    from '../auth/roles.guard';
import { Roles }         from '../auth/roles.decorator';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(private svc: AdminService) {}

  @Get('dashboard')
  dashboard() { return this.svc.getDashboard(); }

  @Get('users')
  getUsers(@Query('page') page = 1, @Query('search') search?: string) {
    return this.svc.getUsers(+page, search);
  }

  @Post('users/:id/ban')
  ban(@Param('id') id: string, @Body() body: any) {
    return this.svc.banUser(id, body.reason);
  }

  @Post('users/:id/unban')
  unban(@Param('id') id: string) {
    return this.svc.unbanUser(id);
  }

  @Get('submissions')
  getSubmissions(@Query('page') page = 1, @Query('suspicious') sus?: string) {
    return this.svc.getSubmissions(+page, sus === 'true');
  }

  @Post('contests/:id/finalize')
  finalizeContest(@Param('id') id: string) {
    return this.svc.finalizeContest(id);
  }

  @Post('users/:id/adjust-balance')
  adjustBalance(@Param('id') id: string, @Body() body: any) {
    return this.svc.adjustBalance(id, body.amount, body.reason);
  }

  @Get('wallet')
  getWallet() { return this.svc.getAdminWallet(); }

  @Post('wallet/deposit')
  depositToWallet(@Body() body: { amount: number; note?: string }) {
    return this.svc.adminDeposit(body.amount, body.note || 'Manual top-up');
  }
}
