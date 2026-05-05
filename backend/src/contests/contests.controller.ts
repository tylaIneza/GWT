import { Controller, Get, Post, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ContestsService }   from './contests.service';
import { CreateContestDto }  from './dto/create-contest.dto';
import { JwtAuthGuard }      from '../auth/jwt-auth.guard';
import { RolesGuard }        from '../auth/roles.guard';
import { Roles }             from '../auth/roles.decorator';

@Controller('contests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContestsController {
  constructor(private svc: ContestsService) {}

  @Get()
  findAll(@Query('status') status?: string) {
    return this.svc.findAll(status);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.svc.findOne(id, req.user?.id);
  }

  @Get(':id/leaderboard')
  getLeaderboard(@Param('id') id: string) {
    return this.svc.getLeaderboard(id);
  }

  @Post()
  @Roles('admin')
  create(@Body() dto: CreateContestDto, @Req() req: any) {
    return this.svc.create(dto, req.user.id);
  }

  @Post(':id/join')
  join(@Param('id') id: string, @Req() req: any) {
    return this.svc.join(id, req.user.id);
  }
}
