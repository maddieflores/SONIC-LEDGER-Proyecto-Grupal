import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtGuard } from '../auth/auth.controller.js';
import { HistoryService } from './history.service.js';
import { MusicalStatsService, type StatsPeriodo } from './stats.service.js';
import { GetHistoryDto, RecordPlaybackEventDto } from './history.dto.js';

type OwnRequest = { user: { id: string } };

@Controller('auth/history')
@UseGuards(JwtGuard)
export class HistoryController {
  constructor(
    private readonly historyService: HistoryService,
    private readonly statsService: MusicalStatsService,
  ) {}

  @Post('events')
  @HttpCode(200)
  recordEvent(
    @Req() req: OwnRequest,
    @Body() dto: RecordPlaybackEventDto,
  ) {
    return this.historyService.recordEvent(req.user.id, dto);
  }

  @Get()
  getHistory(
    @Req() req: OwnRequest,
    @Query() dto: GetHistoryDto,
  ) {
    return this.historyService.getHistory(req.user.id, dto);
  }

  @Get('recent')
  getRecent(
    @Req() req: OwnRequest,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    return this.historyService.getRecent(req.user.id, isNaN(parsedLimit) ? 20 : parsedLimit);
  }

  // CU23: Consultar estadísticas musicales agregadas
  @Get('estadisticas')
  getMusicalStats(
    @Req() req: OwnRequest,
    @Query('periodo') periodo?: StatsPeriodo,
  ) {
    return this.statsService.getUserMusicalStats(req.user.id, periodo);
  }

  @Delete(':id')
  deleteEntry(
    @Req() req: OwnRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.historyService.deleteEntry(req.user.id, id);
  }

  @Delete()
  clearHistory(@Req() req: OwnRequest) {
    return this.historyService.clearHistory(req.user.id);
  }
}
