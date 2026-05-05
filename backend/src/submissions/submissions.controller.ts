import { Controller, Post, Get, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { SubmissionsService } from './submissions.service';
import { SubmitDto }          from './dto/submit.dto';
import { JwtAuthGuard }       from '../auth/jwt-auth.guard';

@Controller('submissions')
@UseGuards(JwtAuthGuard)
export class SubmissionsController {
  constructor(private svc: SubmissionsService) {}

  @Post()
  submit(@Body() dto: SubmitDto, @Req() req: any) {
    return this.svc.submit(dto, req.user.id, req.ip, req.headers['user-agent']);
  }

  @Get()
  findByUser(@Req() req: any, @Query('challenge_id') challengeId?: string) {
    return this.svc.findByUser(req.user.id, challengeId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.svc.findOne(id, req.user.id);
  }
}
