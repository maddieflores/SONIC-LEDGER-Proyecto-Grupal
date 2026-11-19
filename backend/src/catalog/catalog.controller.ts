import { pipeline } from 'node:stream/promises';
import { audioRange } from './audio-range.js';
import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtGuard } from '../auth/auth.controller.js';
import { CatalogService } from './catalog.service.js';
import { CatalogQuery } from './catalog.dto.js';
@Controller('auth/catalog')
@UseGuards(JwtGuard)
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}
  @Get() list(@Query() q: CatalogQuery) {
    return this.catalog.list(q);
  }
  @Get('genres') genres() {
    return this.catalog.genresList();
  }
  @Get('artists/:id') artist(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query() q: CatalogQuery,
  ) {
    return this.catalog.publicArtist(id, q.page, q.pageSize);
  }
  @Get('artists/:id/media/:kind') async artistMedia(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('kind') kind: string,
    @Res() res: Response,
  ) {
    const file = await this.catalog.publicArtistMedia(id, kind);
    res
      .set({
        'Content-Type': file.mime,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Cross-Origin-Resource-Policy': 'cross-origin',
      })
      .send(file.buffer);
  }
  @Get('releases') releases(@Query() q: CatalogQuery) {
    return this.catalog.publicReleases(q);
  }
  @Get('releases/:id') release(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.catalog.publicReleaseDetail(id);
  }
  @Get('releases/:id/cover') async releaseCover(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Res() res: Response,
  ) {
    const file = await this.catalog.publicReleaseCover(id);
    res
      .set({
        'Content-Type': file.mime,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Cross-Origin-Resource-Policy': 'cross-origin',
      })
      .send(file.buffer);
  }
  @Get(':id/audio') async audio(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const { file, size } = await this.catalog.audio(id);
    const range = audioRange(req.headers.range, size);
    res.set({
      'Accept-Ranges': 'bytes',
      'Content-Type': 'audio/wav',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    });
    if (range === false) {
      await file.close();
      res
        .status(416)
        .set('Content-Range', 'bytes */' + size)
        .end();
      return;
    }
    const start = range ? range.start : 0,
      end = range ? range.end : size - 1;
    res
      .status(range ? 206 : 200)
      .set('Content-Length', String(end - start + 1));
    if (range) res.set('Content-Range', `bytes ${start}-${end}/${size}`);
    if (req.method === 'HEAD') {
      await file.close();
      res.end();
      return;
    }
    const stream = file.createReadStream({ start, end, autoClose: true });
    try {
      await pipeline(stream, res);
    } catch {
      stream.destroy();
      if (!res.destroyed) res.destroy();
    }
  }
  @Get(':id') detail(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.catalog.detail(id);
  }
  @Get(':id/cover') async cover(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Res() res: Response,
  ) {
    const file = await this.catalog.cover(id);
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

