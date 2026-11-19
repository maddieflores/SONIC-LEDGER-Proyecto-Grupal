import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtGuard } from '../auth/auth.controller.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolNombre } from '../auth/rol.entity.js';
import {
  CreateReleaseDto,
  ReleasesQueryDto,
  SetTracksDto,
  UpdateReleaseDto,
} from './releases.dto.js';
import { ReleasesService } from './releases.service.js';
import { MAX_COVER_BYTES, type UploadedSongFile } from '../songs/song-files.js';

type OwnRequest = { user: { id: string } };

@Controller(['auth/artist/releases', 'auth/artist-releases'])
@UseGuards(JwtGuard, RolesGuard)
@Roles(RolNombre.ARTISTA)
export class ReleasesController {
  constructor(private readonly releases: ReleasesService) {}

  @Get()
  list(@Req() req: OwnRequest, @Query() q: ReleasesQueryDto) {
    return this.releases.list(req.user.id, q);
  }

  @Get('available-songs')
  availableSongs(@Req() req: OwnRequest) {
    return this.releases.availableSongs(req.user.id);
  }

  @Post()
  create(@Req() req: OwnRequest, @Body() dto: CreateReleaseDto) {
    return this.releases.create(req.user.id, dto);
  }

  @Get(':id')
  detail(
    @Req() req: OwnRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.releases.detail(req.user.id, id);
  }

  @Patch(':id')
  update(
    @Req() req: OwnRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateReleaseDto,
  ) {
    return this.releases.update(req.user.id, id, dto);
  }

  @Delete(':id')
  delete(
    @Req() req: OwnRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.releases.delete(req.user.id, id);
  }

  @Put(':id/tracks')
  setTracks(
    @Req() req: OwnRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: SetTracksDto,
  ) {
    return this.releases.setTracks(req.user.id, id, dto.trackIds);
  }

  @Post(':id/publish')
  @HttpCode(200)
  publish(
    @Req() req: OwnRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.releases.publish(req.user.id, id);
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
    return this.releases.uploadCover(req.user.id, id, file);
  }

  @Get(':id/media/cover/:name')
  async media(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('name') name: string,
    @Res() res: Response,
  ) {
    const file = await this.releases.readCover(id, name);
    res
      .set({
        'Content-Type': file.mime,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Cross-Origin-Resource-Policy': 'cross-origin',
      })
      .send(file.buffer);
  }
}
