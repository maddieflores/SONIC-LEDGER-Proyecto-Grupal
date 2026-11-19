import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ListeningHistory } from './listening-history.entity.js';
import { Cancion } from '../musica/cancion.entity.js';
import { LibraryService, type ResolvedTrack } from '../library/library.service.js';
import { determineEventType, isValidPlayback } from './playback-rule.js';
import type { GetHistoryDto, RecordPlaybackEventDto } from './history.dto.js';

export interface HistoryItemResponse {
  id: string;
  trackId: string;
  source: 'LOCAL' | 'AUDIUS';
  eventType: 'PLAYED' | 'SKIPPED';
  listenedSeconds: number;
  trackDurationSeconds: number | null;
  startedAt: Date;
  endedAt: Date;
  createdAt: Date;
  song: ResolvedTrack;
}

export interface PaginatedHistoryResponse {
  items: HistoryItemResponse[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

@Injectable()
export class HistoryService {
  constructor(
    @InjectRepository(ListeningHistory)
    private readonly historyRepo: Repository<ListeningHistory>,
    @InjectRepository(Cancion)
    private readonly songRepo: Repository<Cancion>,
    private readonly libraryService: LibraryService,
  ) {}

  private determineSource(trackId: string, explicitSource?: 'LOCAL' | 'AUDIUS'): 'LOCAL' | 'AUDIUS' {
    if (explicitSource) return explicitSource;
    if (trackId.startsWith('audius:')) return 'AUDIUS';
    return 'LOCAL';
  }

  /**
   * Registra un evento de reproducción o de omisión (skip) con validación centralizada.
   */
  async recordEvent(userId: string, dto: RecordPlaybackEventDto): Promise<ListeningHistory> {
    const source = this.determineSource(dto.trackId, dto.source);

    if (dto.listenedSeconds < 0) {
      throw new BadRequestException('El tiempo de escucha no puede ser negativo.');
    }

    let duration: number | null = dto.trackDurationSeconds ?? null;

    if (source === 'LOCAL') {
      const localSong = await this.songRepo.findOne({
        where: { id: dto.trackId },
      });
      if (!localSong) {
        throw new BadRequestException('La canción local especificada no existe.');
      }
      if (localSong.duracionSegundos) {
        duration = localSong.duracionSegundos;
      }
    }

    // Comprobación de idempotencia por clientEventId
    if (dto.clientEventId) {
      const existing = await this.historyRepo.findOne({
        where: {
          usuarioId: userId,
          clientEventId: dto.clientEventId,
        },
      });
      if (existing) {
        return existing;
      }
    }

    // Regla centralizada: determinar si califica como PLAYED o SKIPPED
    const calculatedEventType = determineEventType(dto.listenedSeconds, duration);
    const finalEventType =
      dto.eventType === 'SKIPPED'
        ? 'SKIPPED'
        : calculatedEventType;

    const started = dto.startedAt ? new Date(dto.startedAt) : new Date();
    const ended = dto.endedAt ? new Date(dto.endedAt) : new Date();

    const entry = this.historyRepo.create({
      usuarioId: userId,
      trackId: dto.trackId,
      source,
      clientEventId: dto.clientEventId || null,
      eventType: finalEventType,
      listenedSeconds: Math.round(dto.listenedSeconds * 10) / 10,
      trackDurationSeconds: duration,
      startedAt: isNaN(started.getTime()) ? new Date() : started,
      endedAt: isNaN(ended.getTime()) ? new Date() : ended,
    });

    return this.historyRepo.save(entry);
  }

  /**
   * Obtiene el historial paginado de un usuario, resolviendo los metadatos de las canciones.
   */
  async getHistory(userId: string, dto: GetHistoryDto): Promise<PaginatedHistoryResponse> {
    const page = Math.max(1, dto.page || 1);
    const pageSize = Math.min(50, Math.max(1, dto.pageSize || 20));

    const query = this.historyRepo
      .createQueryBuilder('h')
      .where('h.usuario_id = :userId', { userId });

    if (dto.eventType && dto.eventType !== 'ALL') {
      query.andWhere('h.event_type = :eventType', { eventType: dto.eventType });
    }

    query
      .orderBy('h.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [entries, total] = await query.getManyAndCount();

    if (entries.length === 0) {
      return {
        items: [],
        total,
        page,
        pageSize,
        totalPages: 0,
      };
    }

    // Resolver metadatos de pistas (LOCAL y AUDIUS)
    const trackRefs = entries.map((e) => ({
      trackId: e.trackId,
      source: e.source,
    }));
    const resolvedTracks = await this.libraryService.resolveTracks(trackRefs);

    const items: HistoryItemResponse[] = entries.map((entry, idx) => {
      const song = resolvedTracks[idx];

      return {
        id: entry.id,
        trackId: entry.trackId,
        source: entry.source,
        eventType: entry.eventType,
        listenedSeconds: entry.listenedSeconds,
        trackDurationSeconds: entry.trackDurationSeconds,
        startedAt: entry.startedAt,
        endedAt: entry.endedAt,
        createdAt: entry.createdAt,
        song,
      };
    });

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Obtiene las canciones escuchadas recientemente (solo PLAYED) para acceso rápido o reanudación.
   */
  async getRecent(userId: string, limit = 20): Promise<ResolvedTrack[]> {
    const entries = await this.historyRepo.find({
      where: {
        usuarioId: userId,
        eventType: 'PLAYED',
      },
      order: {
        createdAt: 'DESC',
      },
      take: Math.min(50, limit),
    });

    if (entries.length === 0) return [];

    // Deduplicar canciones consecutivas o repetidas para la lista de recientes
    const uniqueMap = new Map<string, { trackId: string; source: 'LOCAL' | 'AUDIUS' }>();
    for (const e of entries) {
      if (!uniqueMap.has(e.trackId)) {
        uniqueMap.set(e.trackId, { trackId: e.trackId, source: e.source });
      }
    }

    const resolved = await this.libraryService.resolveTracks(Array.from(uniqueMap.values()));
    return resolved.map((r) => ({
      id: r.id,
      titulo: r.titulo,
      artista: r.artista,
      genero: r.genero,
      duracionSegundos: r.duracionSegundos,
      descripcion: r.descripcion,
      coverUrl: r.coverUrl,
      playable: r.playable,
      source: r.source,
    }));
  }

  /**
   * Elimina un registro específico del historial del usuario autenticado.
   */
  async deleteEntry(userId: string, id: string): Promise<{ deleted: boolean; id: string }> {
    const entry = await this.historyRepo.findOne({
      where: { id, usuarioId: userId },
    });

    if (!entry) {
      throw new NotFoundException('Registro de historial no encontrado.');
    }

    await this.historyRepo.remove(entry);
    return { deleted: true, id };
  }

  /**
   * Limpia todo el historial de reproducción del usuario autenticado.
   */
  async clearHistory(userId: string): Promise<{ cleared: boolean; count: number }> {
    const deleteResult = await this.historyRepo.delete({ usuarioId: userId });
    return {
      cleared: true,
      count: deleteResult.affected || 0,
    };
  }
}
