import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtGuard } from '../auth/auth.controller.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolNombre } from '../auth/rol.entity.js';
import { ArtistProfileDto } from './artist.dto.js';
import { ArtistService } from './artist.service.js';
import { ArtistMediaService, MAX_IMAGE_BYTES } from './artist-media.service.js';
type OwnRequest = { user: { id: string; username: string } };
@Controller('auth/artist-profile')
@UseGuards(JwtGuard, RolesGuard)
@Roles(RolNombre.ARTISTA)
export class ArtistController {
  constructor(
    private readonly artists: ArtistService,
    private readonly media: ArtistMediaService,
  ) {}
  @Get() get(@Req() req: OwnRequest) {
    return this.artists.get(req.user.id, req.user.username);
  }
  @Post() create(@Req() req: OwnRequest, @Body() dto: ArtistProfileDto) {
    return this.artists.save(req.user.id, req.user.username, dto, true);
  }
  @Patch() update(@Req() req: OwnRequest, @Body() dto: ArtistProfileDto) {
    return this.artists.save(req.user.id, req.user.username, dto, false);
  }
  @Post('media/:kind')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 0, parts: 1 },
    }),
  )
  upload(
    @Req() req: OwnRequest,
    @Param('kind') kind: string,
    @UploadedFile() file?: { buffer: Buffer; mimetype: string },
  ) {
    if (kind !== 'avatar' && kind !== 'cover')
      throw new BadRequestException('Tipo de imagen inválido.');
    return this.media.upload(req.user.id, kind, file);
  }
  @Get('media/:name') async image(
    @Req() req: OwnRequest,
    @Param('name') name: string,
    @Res() res: Response,
  ) {
    const media = await this.media.read(req.user.id, name);
    res
      .set({
        'Content-Type': media.mime,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
        'Cross-Origin-Resource-Policy': 'cross-origin',
      })
      .send(media.buffer);
  }
}
