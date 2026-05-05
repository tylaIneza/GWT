import { Controller, Get, Post, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { AntiCheatService } from './anti-cheat.service';
import { JwtAuthGuard }     from '../auth/jwt-auth.guard';
import { RolesGuard }       from '../auth/roles.guard';
import { Roles }            from '../auth/roles.decorator';

@Controller('anti-cheat')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AntiCheatController {
  constructor(private svc: AntiCheatService) {}

  @Post('fingerprint')
  trackDevice(@Body() body: any, @Req() req: any) {
    return this.svc.trackDevice(
      req.user.id, body.fingerprint, req.ip, req.headers['user-agent'],
    );
  }

  @Get('flags')
  @Roles('admin')
  getFlags(@Query('page') page = 1) {
    return this.svc.getFlagsForAdmin(+page);
  }

  @Post('flags/:id/review')
  @Roles('admin')
  reviewFlag(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.svc.reviewFlag(id, req.user.id, body.action, body.notes);
  }
}
