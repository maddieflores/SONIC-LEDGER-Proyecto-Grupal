import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtGuard } from '../auth/auth.controller.js';
import { DjService } from './dj.service.js';
import { EditDjDto, GenerateDjDto, SaveDjDto, ManualDjDto } from './dj.dto.js';
type OwnRequest = { user: { id: string } };
@Controller('auth/dj')
@UseGuards(JwtGuard)
export class DjController {
  constructor(private readonly dj: DjService) {}
  @Get('status') status() {
    return this.dj.status();
  }
  @Get('candidates') candidates(@Req() r: OwnRequest) {
    return this.dj.manualCandidates(r.user.id);
  }
  @Post('manual') manual(@Req() r: OwnRequest, @Body() dto: ManualDjDto) {
    return this.dj.manual(r.user.id, dto.trackId);
  }
  @Get('sessions') list(@Req() r: OwnRequest) {
    return this.dj.list(r.user.id);
  }
  @Get('sessions/:id') get(
    @Req() r: OwnRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.dj.get(r.user.id, id);
  }
  @Post('sessions') generate(@Req() r: OwnRequest, @Body() dto: GenerateDjDto) {
    return this.dj.generate(r.user.id, dto.prompt);
  }
  @Post('sessions/:id/adjust') edit(
    @Req() r: OwnRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EditDjDto,
  ) {
    return this.dj.edit(r.user.id, id, dto);
  }
  @Post('sessions/:id/playlist') save(
    @Req() r: OwnRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveDjDto,
  ) {
    return this.dj.save(r.user.id, id, dto);
  }
}
