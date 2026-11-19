import { describe, expect, it, beforeEach, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { HistoryService } from './history.service.js';
import { ListeningHistory } from './listening-history.entity.js';
import { Cancion, CancionEstado } from '../musica/cancion.entity.js';
import { isValidPlayback, determineEventType } from './playback-rule.js';

describe('CU11 HistoryService: Registrar y consultar historial', () => {
  let service: HistoryService;
  let mockHistoryRepo: any;
  let mockSongRepo: any;
  let mockLibraryService: any;

  const userA = 'u0000000-0000-4000-8000-000000000001';
  const userB = 'u0000000-0000-4000-8000-000000000002';

  let historyStore: ListeningHistory[];

  const localSong: Cancion = {
    id: 's0000000-0000-4000-8000-000000000001',
    artistaId: 'a0000000-0000-4000-8000-000000000001',
    artista: { nombreArtistico: 'Artista Local' } as any,
    titulo: 'Pista Local 1',
    descripcion: '',
    duracionSegundos: 210,
    portadaUrl: '/api/auth/artist-songs/s1/media/cover/c1.jpg',
    archivoAudioUrl: '/api/auth/artist-songs/s1/media/audio/a1.wav',
    estado: CancionEstado.PUBLICADO,
    generoId: null,
    genero: null,
    lanzamientoId: null,
    lanzamiento: null,
    numeroPista: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const shortSong: Cancion = {
    ...localSong,
    id: 's0000000-0000-4000-8000-000000000020',
    titulo: 'Interludio Corto',
    duracionSegundos: 20,
  };

  beforeEach(() => {
    historyStore = [];

    mockHistoryRepo = {
      create: vi.fn((data: Partial<ListeningHistory>) => ({
        id: `h-${Math.random().toString(36).substring(2, 9)}`,
        createdAt: new Date(),
        ...data,
      })),
      save: vi.fn(async (entity: ListeningHistory) => {
        historyStore.push(entity);
        return entity;
      }),
      findOne: vi.fn(async ({ where }: any) => {
        return historyStore.find((h) => {
          if (where.id && h.id !== where.id) return false;
          if (where.usuarioId && h.usuarioId !== where.usuarioId) return false;
          if (where.clientEventId && h.clientEventId !== where.clientEventId) return false;
          return true;
        }) || null;
      }),
      find: vi.fn(async ({ where, take }: any) => {
        return historyStore
          .filter((h) => {
            if (where?.usuarioId && h.usuarioId !== where.usuarioId) return false;
            if (where?.eventType && h.eventType !== where.eventType) return false;
            return true;
          })
          .slice(0, take || 50);
      }),
      remove: vi.fn(async (entity: ListeningHistory) => {
        historyStore = historyStore.filter((h) => h.id !== entity.id);
        return entity;
      }),
      delete: vi.fn(async (where: any) => {
        const initialCount = historyStore.length;
        historyStore = historyStore.filter((h) => {
          if (where.usuarioId && h.usuarioId === where.usuarioId) return false;
          return true;
        });
        return { affected: initialCount - historyStore.length };
      }),
      createQueryBuilder: vi.fn(() => {
        let filtered = [...historyStore];
        const qb: any = {
          where: vi.fn((clause: string, params: any) => {
            if (params.userId) {
              filtered = filtered.filter((h) => h.usuarioId === params.userId);
            }
            return qb;
          }),
          andWhere: vi.fn((clause: string, params: any) => {
            if (params.eventType) {
              filtered = filtered.filter((h) => h.eventType === params.eventType);
            }
            return qb;
          }),
          orderBy: vi.fn(() => qb),
          skip: vi.fn((skipVal: number) => {
            filtered = filtered.slice(skipVal);
            return qb;
          }),
          take: vi.fn((takeVal: number) => {
            filtered = filtered.slice(0, takeVal);
            return qb;
          }),
          getManyAndCount: vi.fn(async () => [filtered, historyStore.length]),
        };
        return qb;
      }),
    };

    mockSongRepo = {
      findOne: vi.fn(async ({ where }: any) => {
        if (where.id === localSong.id) return localSong;
        if (where.id === shortSong.id) return shortSong;
        return null;
      }),
    };

    mockLibraryService = {
      resolveTracks: vi.fn(async (items: any[]) => {
        return items.map((item) => ({
          id: item.trackId,
          source: item.source,
          titulo: item.source === 'LOCAL' ? 'Pista Local 1' : 'Pista Audius',
          artista: { id: 'a1', nombre: 'Artista' },
          genero: null,
          duracionSegundos: 200,
          descripcion: '',
          coverUrl: null,
          playable: true,
        }));
      }),
    };

    service = new HistoryService(mockHistoryRepo, mockSongRepo, mockLibraryService);
  });

  // 1. Reglas centralizadas
  it('aplica correctamente la regla centralizada de reproducción válida (PLAYED vs SKIPPED)', () => {
    // Normal track (duración 210s)
    expect(isValidPlayback(29, 210)).toBe(false);
    expect(determineEventType(29, 210)).toBe('SKIPPED');
    expect(isValidPlayback(30, 210)).toBe(true);
    expect(determineEventType(30, 210)).toBe('PLAYED');

    // Short track (duración 20s < 30s): umbral 50% = 10s
    expect(isValidPlayback(9, 20)).toBe(false);
    expect(determineEventType(9, 20)).toBe('SKIPPED');
    expect(isValidPlayback(10, 20)).toBe(true);
    expect(determineEventType(10, 20)).toBe('PLAYED');
  });

  // 2. Registro de reproducción válida
  it('registra una reproducción válida (PLAYED) para una canción local tras cumplir el umbral', async () => {
    const res = await service.recordEvent(userA, {
      trackId: localSong.id,
      source: 'LOCAL',
      listenedSeconds: 35,
      trackDurationSeconds: 210,
    });

    expect(res).toBeDefined();
    expect(res.usuarioId).toBe(userA);
    expect(res.eventType).toBe('PLAYED');
    expect(res.listenedSeconds).toBe(35);
    expect(res.source).toBe('LOCAL');
  });

  // 3. Registro de omisión (SKIPPED)
  it('registra una omisión (SKIPPED) si se cambia la canción antes de alcanzar 30 segundos', async () => {
    const res = await service.recordEvent(userA, {
      trackId: localSong.id,
      source: 'LOCAL',
      listenedSeconds: 12,
    });

    expect(res.eventType).toBe('SKIPPED');
    expect(res.listenedSeconds).toBe(12);
  });

  // 4. Soporte para Audius
  it('registra evento para pista de Audius identificada por prefijo o source', async () => {
    const res = await service.recordEvent(userA, {
      trackId: 'audius:TRACK999',
      source: 'AUDIUS',
      listenedSeconds: 45,
      trackDurationSeconds: 180,
    });

    expect(res.source).toBe('AUDIUS');
    expect(res.eventType).toBe('PLAYED');
  });

  // 5. Idempotencia y deduplicación con clientEventId
  it('respeta la idempotencia: mismo clientEventId no genera eventos duplicados', async () => {
    const eventId = 'evt-session-123';
    const first = await service.recordEvent(userA, {
      trackId: localSong.id,
      listenedSeconds: 32,
      clientEventId: eventId,
    });

    const second = await service.recordEvent(userA, {
      trackId: localSong.id,
      listenedSeconds: 32,
      clientEventId: eventId,
    });

    expect(second.id).toBe(first.id);
    expect(historyStore.length).toBe(1);
  });

  // 6. Rechazo de canción local inexistente
  it('rechaza el registro si la canción local no existe', async () => {
    await expect(
      service.recordEvent(userA, {
        trackId: 's0000000-0000-4000-8000-000000000999',
        source: 'LOCAL',
        listenedSeconds: 40,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // 7. Aislamiento estricto entre usuarios y eliminación individual
  it('aísla el historial entre usuarios y permite eliminar un registro propio', async () => {
    const entryA = await service.recordEvent(userA, {
      trackId: localSong.id,
      listenedSeconds: 40,
    });
    const entryB = await service.recordEvent(userB, {
      trackId: localSong.id,
      listenedSeconds: 50,
    });

    // Usuario B no puede borrar el registro del usuario A
    await expect(service.deleteEntry(userB, entryA.id)).rejects.toThrow(NotFoundException);

    // Usuario A puede borrar su propio registro
    const delRes = await service.deleteEntry(userA, entryA.id);
    expect(delRes.deleted).toBe(true);
    expect(delRes.id).toBe(entryA.id);
  });

  // 8. Limpieza completa del historial
  it('permite limpiar todo el historial de un usuario sin afectar a otros usuarios', async () => {
    await service.recordEvent(userA, { trackId: localSong.id, listenedSeconds: 40 });
    await service.recordEvent(userA, { trackId: 'audius:AUD1', listenedSeconds: 50 });
    await service.recordEvent(userB, { trackId: localSong.id, listenedSeconds: 35 });

    const clearRes = await service.clearHistory(userA);
    expect(clearRes.cleared).toBe(true);
    expect(clearRes.count).toBe(2);

    // El registro de User B sigue intacto
    expect(historyStore.length).toBe(1);
    expect(historyStore[0].usuarioId).toBe(userB);
  });
});
