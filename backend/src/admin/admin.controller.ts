import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, Req, UseGuards,
  UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminService }  from './admin.service';
import { JwtAuthGuard }  from '../auth/jwt-auth.guard';
import { RolesGuard }    from '../auth/roles.guard';
import { Roles }         from '../auth/roles.decorator';
import * as xlsx         from 'xlsx';

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

  @Post('users/:id/activate')
  activate(@Param('id') id: string) {
    return this.svc.activateUser(id);
  }

  @Delete('users/:id')
  deleteUser(@Param('id') id: string) {
    return this.svc.deleteUser(id);
  }

  @Get('submissions')
  getSubmissions(@Query('page') page = 1, @Query('suspicious') sus?: string) {
    return this.svc.getSubmissions(+page, sus === 'true');
  }

  @Get('submissions/pending-review')
  getPendingReviews(@Query('page') page = 1) {
    return this.svc.getPendingReviews(+page);
  }

  @Post('submissions/:id/approve')
  approveSubmission(@Param('id') id: string) {
    return this.svc.approveSubmission(id);
  }

  @Post('submissions/:id/reject')
  rejectSubmission(@Param('id') id: string, @Body() body: any) {
    return this.svc.rejectSubmission(id, body?.reason);
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

  @Get('users/export')
  exportUsers() { return this.svc.exportUsers(); }

  @Post('flags/bulk-dismiss')
  bulkDismissFlags(@Req() req: any) { return this.svc.bulkDismissLowRiskFlags(req.user.id); }

  @Post('leaderboard/refresh')
  refreshLeaderboard() { return this.svc.refreshLeaderboard(); }

  // ── Withdrawals ────────────────────────────────────────────────────────────
  @Get('withdrawals')
  getWithdrawals(@Query('page') page = 1, @Query('status') status?: string) {
    return this.svc.getWithdrawalRequests(+page, status);
  }

  @Post('withdrawals/:id/approve')
  approveWithdrawal(@Param('id') id: string, @Req() req: any, @Body() body: any) {
    return this.svc.approveWithdrawal(id, req.user.id, body?.note);
  }

  @Post('withdrawals/:id/reject')
  rejectWithdrawal(@Param('id') id: string, @Req() req: any, @Body() body: any) {
    return this.svc.rejectWithdrawal(id, req.user.id, body?.reason || 'Rejected by admin');
  }

  // ── Reward settings ────────────────────────────────────────────────────────
  @Get('rewards')
  getRewards() { return this.svc.getRewardSettings(); }

  @Put('rewards/:difficulty')
  updateReward(@Param('difficulty') diff: string, @Body() body: { amount: number }, @Req() req: any) {
    return this.svc.updateRewardSettings(diff, body.amount, req.user.id);
  }

  // ── Import challenges ──────────────────────────────────────────────────────
  @Post('challenges/import')
  @UseInterceptors(FileInterceptor('file'))
  async importChallenges(@UploadedFile() file: any, @Req() req: any) {
    if (!file) return { error: 'No file uploaded' };
    let rows: any[] = [];
    try {
      if (file.originalname.endsWith('.json')) {
        rows = JSON.parse(file.buffer.toString('utf8'));
      } else {
        const wb = xlsx.read(file.buffer, { type: 'buffer' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        rows = xlsx.utils.sheet_to_json(ws);
      }
    } catch (e: any) {
      return { error: `Failed to parse file: ${e.message}` };
    }
    return this.svc.importChallenges(rows, req.user.id);
  }

  // ── AI Logs ────────────────────────────────────────────────────────────────
  @Get('ai-logs')
  getAiLogs(@Query('page') page = 1) { return this.svc.getAiLogs(+page); }

  // ── Analytics ─────────────────────────────────────────────────────────────
  @Get('analytics')
  getAnalytics() { return this.svc.getAnalytics(); }
}
