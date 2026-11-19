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
export class DjController {
  constructor(private readonly dj: DjService) {}
  @Get('status') status() {
    return this.dj.status();
  }
  @Get('candidates') @UseGuards(JwtGuard) candidates(@Req() r: OwnRequest) {
    return this.dj.manualCandidates(r.user.id);
  }
  @Post('manual') @UseGuards(JwtGuard) manual(@Req() r: OwnRequest, @Body() dto: ManualDjDto) {
    return this.dj.manual(r.user.id, dto.trackId);
  }
  @Get('sessions') @UseGuards(JwtGuard) list(@Req() r: OwnRequest) {
    return this.dj.list(r.user.id);
  }
  @Get('sessions/:id') @UseGuards(JwtGuard) get(
    @Req() r: OwnRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.dj.get(r.user.id, id);
  }
  @Post('sessions') @UseGuards(JwtGuard) generate(@Req() r: OwnRequest, @Body() dto: GenerateDjDto) {
    return this.dj.generate(r.user.id, dto.prompt);
  }
  @Post('sessions/:id/adjust') @UseGuards(JwtGuard) edit(
    @Req() r: OwnRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EditDjDto,
  ) {
    return this.dj.edit(r.user.id, id, dto);
  }
  @Post('sessions/:id/playlist') @UseGuards(JwtGuard) save(
    @Req() r: OwnRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveDjDto,
  ) {
    return this.dj.save(r.user.id, id, dto);
  }
}
