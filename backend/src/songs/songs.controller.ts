import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtGuard } from '../auth/auth.controller.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolNombre } from '../auth/rol.entity.js';
import { SongDto, SongsQueryDto, SongStateDto } from './songs.dto.js';
import { SongsService } from './songs.service.js';
import { MAX_AUDIO_BYTES, MAX_COVER_BYTES } from './song-files.js';
import type { UploadedSongFile } from './song-files.js';
type OwnRequest = { user: { id: string } };
@Controller('auth/artist-songs')
@UseGuards(JwtGuard, RolesGuard)
@Roles(RolNombre.ARTISTA)
export class SongsController {
  constructor(private readonly songs: SongsService) {}
  @Get('dashboard') dashboard(@Req() req: OwnRequest) {
    return this.songs.dashboard(req.user.id);
  }
  @Get('options') options(@Req() req: OwnRequest) {
    return this.songs.options(req.user.id);
  }
  @Get() list(@Req() req: OwnRequest, @Query() q: SongsQueryDto) {
    return this.songs.list(req.user.id, q);
  }
  @Post() create(@Req() req: OwnRequest, @Body() dto: SongDto) {
    return this.songs.create(req.user.id, dto);
  }
  @Get(':id') detail(
    @Req() req: OwnRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.songs.detail(req.user.id, id);
  }
  @Patch(':id') update(
    @Req() req: OwnRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: SongDto,
  ) {
    return this.songs.update(req.user.id, id, dto);
  }
  @Patch(':id/state') state(
    @Req() req: OwnRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: SongStateDto,
  ) {
    return this.songs.state(req.user.id, id, dto.estado);
  }
  @Post(':id/audio')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_AUDIO_BYTES, files: 1, fields: 0, parts: 1 },
    }),
  )
  audio(
    @Req() req: OwnRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @UploadedFile() file?: UploadedSongFile,
  ) {
    return this.songs.upload(req.user.id, id, 'audio', file);
  }
  @Post(':id/cover')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_COVER_BYTES, files: 1, fields: 0, parts: 1 },
    }),
  )
  cover(
    @Req() req: OwnRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @UploadedFile() file?: UploadedSongFile,
  ) {
    return this.songs.upload(req.user.id, id, 'cover', file);
  }
  @Get(':id/media/:kind/:name') async media(
    @Req() req: OwnRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('kind') kind: string,
    @Param('name') name: string,
    @Res() res: Response,
  ) {
    if (kind !== 'audio' && kind !== 'cover') {
      res.sendStatus(404);
      return;
    }
    const media = await this.songs.read(req.user.id, id, kind, name);
    res
      .set({
        'Content-Type': media.mime,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
        'Cross-Origin-Resource-Policy': 'cross-origin',
        ...(kind === 'audio'
          ? { 'Content-Disposition': 'attachment; filename="song.wav"' }
          : {}),
      })
      .send(media.buffer);
  }
}
