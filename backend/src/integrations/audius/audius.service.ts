import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AudiusClient } from './audius.client.js';
import {
  GetArtistTracksDto,
  GetTrendingTracksDto,
  SearchAudiusDto,
  AudiusSearchType,
} from './audius.dto.js';
import { AudiusMapper } from './audius.mapper.js';
import {
  NormalizedArtist,
  NormalizedTrack,
  PaginatedResult,
  StreamResolution,
} from './audius.types.js';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

@Injectable()
export class AudiusService {
  private readonly logger = new Logger(AudiusService.name);
  private readonly cache = new Map<string, CacheEntry<unknown>>();

  // Tiempos de vida de caché en milisegundos
  private readonly TTL_TRENDING = 5 * 60 * 1000; // 5 minutos
  private readonly TTL_SEARCH = 2 * 60 * 1000;   // 2 minutos
  private readonly TTL_DETAIL = 10 * 60 * 1000;  // 10 minutos
  private readonly TTL_STREAM = 15 * 60 * 1000;  // 15 minutos

  constructor(private readonly client: AudiusClient) {
    // Limpieza periódica de caché cada 10 minutos para evitar fuga de memoria
    setInterval(() => this.cleanupCache(), 10 * 60 * 1000).unref?.();
  }

  /**
   * Obtiene un elemento de la caché si no ha expirado.
   */
  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  /**
   * Guarda un elemento en la caché con su TTL.
   */
  private setInCache<T>(key: string, data: T, ttlMs: number): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  /**
   * Limpia entradas expiradas de la memoria.
   */
  public cleanupCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Limpia toda la caché (útil para pruebas).
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Consulta canciones en tendencia de Audius.
   */
  async getTrending(dto: GetTrendingTracksDto): Promise<PaginatedResult<NormalizedTrack>> {
    const limit = dto.limit ?? 20;
    const offset = dto.offset ?? 0;
    const genre = dto.genre;
    const time = dto.time;

    const cacheKey = `trending:${limit}:${offset}:${genre || 'all'}:${time || 'week'}`;
    const cached = this.getFromCache<PaginatedResult<NormalizedTrack>>(cacheKey);
    if (cached) {
      return cached;
    }

    const rawTracks = await this.client.getTrendingTracks({
      limit,
      offset,
      genre,
      time,
    });

    const normalized = (rawTracks || []).map((t) => AudiusMapper.toNormalizedTrack(t));
    const result: PaginatedResult<NormalizedTrack> = {
      data: normalized,
      limit,
      offset,
      source: 'AUDIUS',
    };

    this.setInCache(cacheKey, result, this.TTL_TRENDING);
    return result;
  }

  /**
   * Búsqueda unificada en Audius (canciones y/o artistas).
   */
  async search(dto: SearchAudiusDto): Promise<{
    tracks?: NormalizedTrack[];
    artists?: NormalizedArtist[];
    query: string;
    source: 'AUDIUS';
  }> {
    const query = dto.query.trim();
    if (query.length < 2) {
      throw new BadRequestException('El término de búsqueda debe tener al menos 2 caracteres');
    }

    const limit = dto.limit ?? 20;
    const offset = dto.offset ?? 0;
    const searchType = dto.type ?? AudiusSearchType.ALL;

    const cacheKey = `search:${searchType}:${encodeURIComponent(query)}:${limit}:${offset}`;
    const cached = this.getFromCache<{
      tracks?: NormalizedTrack[];
      artists?: NormalizedArtist[];
      query: string;
      source: 'AUDIUS';
    }>(cacheKey);
    if (cached) {
      return cached;
    }

    let tracks: NormalizedTrack[] | undefined;
    let artists: NormalizedArtist[] | undefined;

    if (searchType === AudiusSearchType.TRACKS || searchType === AudiusSearchType.ALL) {
      const rawTracks = await this.client.searchTracks({ query, limit, offset });
      tracks = (rawTracks || []).map((t) => AudiusMapper.toNormalizedTrack(t));
    }

    if (searchType === AudiusSearchType.ARTISTS || searchType === AudiusSearchType.ALL) {
      const rawUsers = await this.client.searchUsers({ query, limit, offset });
      artists = (rawUsers || []).map((u) => AudiusMapper.toNormalizedArtist(u));
    }

    const result = {
      query,
      source: 'AUDIUS' as const,
      ...(tracks !== undefined ? { tracks } : {}),
      ...(artists !== undefined ? { artists } : {}),
    };

    this.setInCache(cacheKey, result, this.TTL_SEARCH);
    return result;
  }

  /**
   * Consulta el detalle de una pista de Audius.
   */
  async getTrackById(id: string): Promise<NormalizedTrack> {
    if (!id || !id.trim()) {
      throw new BadRequestException('El ID de la pista no puede estar vacío');
    }

    const externalId = AudiusMapper.extractExternalId(id.trim());
    if (!/^[a-zA-Z0-9]+$/.test(externalId)) throw new BadRequestException("Identificador Audius inválido");
    const cacheKey = `track:${externalId}`;
    const cached = this.getFromCache<NormalizedTrack>(cacheKey);
    if (cached) {
      return cached;
    }

    const rawTrack = await this.client.getTrackById(externalId);
    if (!rawTrack) {
      throw new NotFoundException(`Pista con ID ${id} no encontrada en Audius`);
    }

    const normalized = AudiusMapper.toNormalizedTrack(rawTrack);
    this.setInCache(cacheKey, normalized, this.TTL_DETAIL);
    return normalized;
  }

  /**
   * Consulta el detalle de un artista de Audius.
   */
  async getArtistById(id: string): Promise<NormalizedArtist> {
    if (!id || !id.trim()) {
      throw new BadRequestException('El ID del artista no puede estar vacío');
    }

    const externalId = AudiusMapper.extractExternalId(id.trim());
    if (!/^[a-zA-Z0-9]+$/.test(externalId)) throw new BadRequestException("Identificador Audius inválido");
    const cacheKey = `artist:${externalId}`;
    const cached = this.getFromCache<NormalizedArtist>(cacheKey);
    if (cached) {
      return cached;
    }

    const rawUser = await this.client.getUserById(externalId);
    if (!rawUser) {
      throw new NotFoundException(`Artista con ID ${id} no encontrado en Audius`);
    }

    const normalized = AudiusMapper.toNormalizedArtist(rawUser);
    this.setInCache(cacheKey, normalized, this.TTL_DETAIL);
    return normalized;
  }

  /**
   * Consulta las pistas publicadas por un artista de Audius.
   */
  async getArtistTracks(
    artistId: string,
    dto: GetArtistTracksDto,
  ): Promise<PaginatedResult<NormalizedTrack>> {
    if (!artistId || !artistId.trim()) {
      throw new BadRequestException('El ID del artista no puede estar vacío');
    }

    const externalId = AudiusMapper.extractExternalId(artistId.trim());
    if (!/^[a-zA-Z0-9]+$/.test(externalId)) throw new BadRequestException("Identificador Audius inválido");
    const limit = dto.limit ?? 20;
    const offset = dto.offset ?? 0;
    const sort = dto.sort ?? 'date';

    const cacheKey = `artist-tracks:${externalId}:${limit}:${offset}:${sort}`;
    const cached = this.getFromCache<PaginatedResult<NormalizedTrack>>(cacheKey);
    if (cached) {
      return cached;
    }

    const rawTracks = await this.client.getUserTracks(externalId, {
      limit,
      offset,
      sort,
    });

    const normalized = (rawTracks || []).map((t) => AudiusMapper.toNormalizedTrack(t));
    const result: PaginatedResult<NormalizedTrack> = {
      data: normalized,
      limit,
      offset,
      source: 'AUDIUS',
    };

    this.setInCache(cacheKey, result, this.TTL_DETAIL);
    return result;
  }

  /**
   * Obtiene la información de disponibilidad y resolución de streaming de una pista.
   * Respeta restricciones de acceso y no descarga el archivo de audio.
   */
  async resolveStream(id: string): Promise<StreamResolution> {
    if (!id || !id.trim()) {
      throw new BadRequestException('El ID de la pista no puede estar vacío');
    }

    const externalId = AudiusMapper.extractExternalId(id.trim());
    if (!/^[a-zA-Z0-9]+$/.test(externalId)) throw new BadRequestException("Identificador Audius inválido");
    const cached: StreamResolution | null = null;
    if (cached) {
      return cached;
    }

    const rawTrack = await this.client.getTrackById(externalId);
    if (!rawTrack) {
      throw new NotFoundException(`Pista con ID ${id} no encontrada en Audius`);
    }

    // Verificar si la pista está bloqueada o gated
    if (rawTrack.is_stream_gated || rawTrack.access?.stream === false || rawTrack.is_delete) {
      throw new ForbiddenException(
        'Esta pista tiene restricciones de streaming y no está disponible públicamente en la API',
      );
    }

    if (rawTrack.is_streamable === false || rawTrack.is_available === false) {
      throw new ForbiddenException(
        'El streaming de esta pista no está autorizado por el artista o proveedor',
      );
    }

    // Resolver URL de streaming
    const resolvedStreamUrl = await this.client.resolveTrackStreamUrl(externalId);
    const resolution = AudiusMapper.toStreamResolution(
      rawTrack,
      resolvedStreamUrl || undefined,
    );

    // Las firmas se resuelven de nuevo en cada inicio; no se conservan en caché.
    return resolution;
  }
}
