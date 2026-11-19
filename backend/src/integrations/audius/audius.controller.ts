import { JwtGuard } from '../../auth/auth.controller.js';
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Query,
  UsePipes,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import {
  GetArtistTracksDto,
  GetTrendingTracksDto,
  SearchAudiusDto,
} from './audius.dto.js';
import { AudiusService } from './audius.service.js';
import {
  NormalizedArtist,
  NormalizedTrack,
  PaginatedResult,
  StreamResolution,
} from './audius.types.js';

@Controller('auth/integrations/audius')
@UseGuards(JwtGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class AudiusController {
  constructor(private readonly audiusService: AudiusService) {}

  /**
   * GET /api/integrations/audius/trending
   * Consulta pistas populares o en tendencia en la red Audius.
   */
  @Get('trending')
  @HttpCode(HttpStatus.OK)
  async getTrending(
    @Query() dto: GetTrendingTracksDto,
  ): Promise<PaginatedResult<NormalizedTrack>> {
    return this.audiusService.getTrending(dto);
  }

  /**
   * GET /api/integrations/audius/search
   * Búsqueda por palabras clave para pistas y artistas.
   */
  @Get('search')
  @HttpCode(HttpStatus.OK)
  async search(@Query() dto: SearchAudiusDto) {
    return this.audiusService.search(dto);
  }

  /**
   * GET /api/integrations/audius/tracks/:id
   * Consulta el detalle y metadatos de una pista por ID.
   */
  @Get('tracks/:id')
  @HttpCode(HttpStatus.OK)
  async getTrack(@Param('id') id: string): Promise<NormalizedTrack> {
    return this.audiusService.getTrackById(id);
  }

  /**
   * GET /api/integrations/audius/tracks/:id/stream
   * Obtiene la resolución de streaming y disponibilidad de reproducción.
   * No descarga el audio y respeta las condiciones de acceso del proveedor.
   */
  @Get('tracks/:id/stream')
  @HttpCode(HttpStatus.OK)
  async getTrackStream(@Param('id') id: string): Promise<StreamResolution> {
    return this.audiusService.resolveStream(id);
  }

  /**
   * GET /api/integrations/audius/artists/:id
   * Consulta el detalle del perfil de un artista por ID.
   */
  @Get('artists/:id')
  @HttpCode(HttpStatus.OK)
  async getArtist(@Param('id') id: string): Promise<NormalizedArtist> {
    return this.audiusService.getArtistById(id);
  }

  /**
   * GET /api/integrations/audius/artists/:id/tracks
   * Consulta las pistas publicadas por un artista.
   */
  @Get('artists/:id/tracks')
  @HttpCode(HttpStatus.OK)
  async getArtistTracks(
    @Param('id') id: string,
    @Query() dto: GetArtistTracksDto,
  ): Promise<PaginatedResult<NormalizedTrack>> {
    return this.audiusService.getArtistTracks(id, dto);
  }
}
