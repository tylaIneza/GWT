import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, Req, UseGuards,
} from '@nestjs/common';
import { ChallengesService } from './challenges.service';
import { SessionsService }   from '../sessions/sessions.service';
import { CreateChallengeDto }from './dto/create-challenge.dto';
import { JwtAuthGuard }      from '../auth/jwt-auth.guard';
import { RolesGuard }        from '../auth/roles.guard';
import { Roles }             from '../auth/roles.decorator';

@Controller('challenges')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ChallengesController {
  constructor(
    private svc:      ChallengesService,
    private sessions: SessionsService,
  ) {}

  // ── Random challenge (must be before /:slugOrId) ──────────────
  @Get('random')
  getRandom(@Req() req: any) {
    return this.svc.getRandomChallenge(req.user.id);
  }

  // ── List & CRUD ───────────────────────────────────────────────
  @Get()
  findAll(@Query() query: any, @Req() req: any) {
    return this.svc.findAll(query, req.user?.id);
  }

  @Get(':slugOrId')
  findOne(@Param('slugOrId') id: string, @Req() req: any) {
    return this.svc.findOne(id, req.user?.id);
  }

  @Post()
  @Roles('admin')
  create(@Body() dto: CreateChallengeDto, @Req() req: any) {
    return this.svc.create(dto, req.user.id);
  }

  @Put(':id')
  @Roles('admin')
  update(@Param('id') id: string, @Body() dto: Partial<CreateChallengeDto>) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  delete(@Param('id') id: string) {
    return this.svc.delete(id);
  }

  // ── Session management ────────────────────────────────────────
  @Post(':id/start')
  startSession(@Param('id') id: string, @Req() req: any) {
    return this.sessions.start(req.user.id, id);
  }

  @Post(':id/forfeit')
  forfeitSession(@Param('id') id: string, @Req() req: any) {
    return this.sessions.forfeit(req.user.id, id);
  }

  @Get(':id/session')
  getSession(@Param('id') id: string, @Req() req: any) {
    return this.sessions.getActive(req.user.id, id);
  }
}
