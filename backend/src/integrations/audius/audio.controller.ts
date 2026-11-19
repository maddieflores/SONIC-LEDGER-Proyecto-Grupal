import { Controller, Get, Param, Req, Res, UseGuards, BadGatewayException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { JwtGuard } from '../../auth/auth.controller.js';
import { AudiusService } from './audius.service.js';
import { assertAudiusDestination } from './destination.js';
@Controller('auth/integrations/audius')
@UseGuards(JwtGuard)
export class AudiusAudioController {
  constructor(private readonly service: AudiusService) {}
  @Get('tracks/:id/audio')
  async audio(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    const resolution = await this.service.resolveStream(id);
    if (!resolution.isPlayable || !resolution.streamUrl) throw new BadGatewayException('Pista no reproducible');
    let url = resolution.streamUrl;
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 20000);
    const disconnected = () => abort.abort();
    res.on('close', disconnected);
    try {
      for (let hop = 0; hop < 5; hop++) {
        assertAudiusDestination(url);
        const headers: Record<string,string> = {};
        if (req.headers.range && /^bytes=\d*-\d*$/.test(req.headers.range)) headers.Range = req.headers.range;
        const response = await fetch(url, { headers, redirect: 'manual', signal: abort.signal });
        if ([301,302,303,307,308].includes(response.status)) {
          const location = response.headers.get('location');
          await response.body?.cancel();
          if (!location) break;
          url = new URL(location, url).href;
          continue;
        }
        if (![200,206,416].includes(response.status)) { await response.body?.cancel(); break; }
        const mime = response.headers.get('content-type') || '';
        if (response.status !== 416 && !/^(audio\/|application\/octet-stream)/i.test(mime)) { await response.body?.cancel(); break; }
        res.status(response.status).set('Cache-Control','private, no-store').set('X-Content-Type-Options','nosniff');
        for (const key of ['content-type','content-length','content-range','accept-ranges']) {
          const value = response.headers.get(key); if (value) res.set(key,value);
        }
        clearTimeout(timer);
        if (req.method === 'HEAD' || !response.body) { await response.body?.cancel(); res.end(); return; }
        await pipeline(Readable.fromWeb(response.body as never), res);
        return;
      }
      throw new BadGatewayException('Streaming Audius no disponible');
    } catch {
      if (res.headersSent) res.destroy();
      else throw new BadGatewayException('No se pudo conectar al audio Audius');
    } finally { clearTimeout(timer); res.off('close', disconnected); }
  }
}
