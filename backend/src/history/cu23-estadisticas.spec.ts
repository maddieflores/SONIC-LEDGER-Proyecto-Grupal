import { describe, expect, it, beforeEach, vi } from 'vitest';
import { MusicalStatsService } from './stats.service.js';

describe('CU23 — Estadísticas Musicales Personales', () => {
  let service: MusicalStatsService;
  let mockHistoryRepo: any;
  let mockLibraryService: any;

  const now = new Date();
  const yesterday = new Date(now.getTime() - 86400000);
  const fiveDaysAgo = new Date(now.getTime() - 5 * 86400000);
  const twentyDaysAgo = new Date(now.getTime() - 20 * 86400000);
  const fortyDaysAgo = new Date(now.getTime() - 40 * 86400000);

  beforeEach(() => {
    mockHistoryRepo = {
      createQueryBuilder: vi.fn(),
    };
    mockLibraryService = {
      resolveTracks: vi.fn().mockResolvedValue([]),
    };
    service = new MusicalStatsService(mockHistoryRepo, mockLibraryService);
  });

  it('1. Usuario con historial vacío recibe todas las métricas en cero y mensaje motivador', async () => {
    const qbMock = {
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue([]),
    };
    mockHistoryRepo.createQueryBuilder.mockReturnValue(qbMock);

    const stats = await service.getUserMusicalStats('user-empty', '30d');

    expect(stats.totalReproduccionesValidas).toBe(0);
    expect(stats.segundosEscuchados).toBe(0);
    expect(stats.minutosEscuchados).toBe(0);
    expect(stats.cancionesUnicas).toBe(0);
    expect(stats.artistasUnicos).toBe(0);
    expect(stats.generoMasEscuchado).toBeNull();
    expect(stats.topCanciones).toEqual([]);
    expect(stats.topArtistas).toEqual([]);
    expect(stats.topGeneros).toEqual([]);
    expect(stats.actividadDiaria.length).toBe(30);
    expect(stats.mensaje).toContain('Aún no tienes actividad registrada');
  });

  it('2. SKIPPED no se incluye en la consulta: solo se filtran eventos PLAYED con listened_seconds > 0', async () => {
    const qbMock = {
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue([]),
    };
    mockHistoryRepo.createQueryBuilder.mockReturnValue(qbMock);

    await service.getUserMusicalStats('user-1', '7d');

    expect(qbMock.where).toHaveBeenCalledWith('h.usuario_id = :userId', { userId: 'user-1' });
    expect(qbMock.andWhere).toHaveBeenCalledWith('h.event_type = :eventType', { eventType: 'PLAYED' });
    expect(qbMock.andWhere).toHaveBeenCalledWith('h.listened_seconds > 0');
  });

  it('3. Tiempo total se calcula con segundos efectivos y reproduce rankings correctos', async () => {
    const mockEntries = [
      {
        id: 'h-1',
        trackId: 'track-metal',
        source: 'LOCAL',
        eventType: 'PLAYED',
        listenedSeconds: 120, // 2 min
        createdAt: yesterday,
      },
      {
        id: 'h-2',
        trackId: 'track-metal',
        source: 'LOCAL',
        eventType: 'PLAYED',
        listenedSeconds: 180, // 3 min
        createdAt: now,
      },
      {
        id: 'h-3',
        trackId: 'audius:999',
        source: 'AUDIUS',
        eventType: 'PLAYED',
        listenedSeconds: 60, // 1 min
        createdAt: fiveDaysAgo,
      },
    ];

    const qbMock = {
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue(mockEntries),
    };
    mockHistoryRepo.createQueryBuilder.mockReturnValue(qbMock);

    mockLibraryService.resolveTracks.mockResolvedValue([
      {
        id: 'track-metal',
        source: 'LOCAL',
        titulo: 'Master of Metal',
        artista: { id: 'art-1', nombre: 'Iron Forge' },
        genero: { id: 'gen-1', nombre: 'Heavy Metal' },
        coverUrl: '/covers/metal.jpg',
      },
      {
        id: 'audius:999',
        source: 'AUDIUS',
        titulo: 'Electronic Dream',
        artista: { id: 'art-2', nombre: 'DJ Synth' },
        genero: { id: 'gen-2', nombre: 'Electronic' },
        coverUrl: '/covers/audius.jpg',
      },
    ]);

    const stats = await service.getUserMusicalStats('user-1', '7d');

    // Total de reproducciones = 3
    expect(stats.totalReproduccionesValidas).toBe(3);
    // Total segundos = 120 + 180 + 60 = 360 segundos (6 minutos)
    expect(stats.segundosEscuchados).toBe(360);
    expect(stats.minutosEscuchados).toBe(6);
    expect(stats.cancionesUnicas).toBe(2);
    expect(stats.artistasUnicos).toBe(2);
    expect(stats.generoMasEscuchado).toBe('Heavy Metal');

    // Top canciones: track-metal tiene 2 reproducciones, audius:999 tiene 1
    expect(stats.topCanciones.length).toBe(2);
    expect(stats.topCanciones[0].trackId).toBe('track-metal');
    expect(stats.topCanciones[0].reproducciones).toBe(2);
    expect(stats.topCanciones[0].segundosEscuchados).toBe(300);

    // Top artistas: Iron Forge (2 plays), DJ Synth (1 play)
    expect(stats.topArtistas[0].nombre).toBe('Iron Forge');
    expect(stats.topArtistas[0].reproducciones).toBe(2);

    // Top géneros: Heavy Metal (67%), Electronic (33%)
    expect(stats.topGeneros[0].nombre).toBe('Heavy Metal');
    expect(stats.topGeneros[0].reproducciones).toBe(2);
    expect(stats.topGeneros[0].porcentaje).toBe(67);
  });

  it('4. Filtros de periodo aplican correctamente las fechas límite (7d, 30d, all)', async () => {
    const qbMock = {
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue([]),
    };
    mockHistoryRepo.createQueryBuilder.mockReturnValue(qbMock);

    // 7d
    await service.getUserMusicalStats('user-1', '7d');
    expect(qbMock.andWhere).toHaveBeenCalledWith(
      'h.createdAt >= :fechaDesde',
      expect.objectContaining({ fechaDesde: expect.any(Date) }),
    );

    // all: no debe filtrar fechaDesde
    const qbMockAll = {
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue([]),
    };
    mockHistoryRepo.createQueryBuilder.mockReturnValue(qbMockAll);
    await service.getUserMusicalStats('user-1', 'all');
    // andWhere con fechaDesde NO debe llamarse
    const callsWithFechaDesde = qbMockAll.andWhere.mock.calls.filter(
      (call: any[]) => typeof call[0] === 'string' && call[0].includes('fechaDesde'),
    );
    expect(callsWithFechaDesde.length).toBe(0);
  });

  it('5. Actividad diaria contiene serie cronológica continua de días sin saltos', async () => {
    const qbMock = {
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue([]),
    };
    mockHistoryRepo.createQueryBuilder.mockReturnValue(qbMock);

    const stats7 = await service.getUserMusicalStats('user-1', '7d');
    expect(stats7.actividadDiaria.length).toBe(7);

    const stats30 = await service.getUserMusicalStats('user-1', '30d');
    expect(stats30.actividadDiaria.length).toBe(30);
  });
});
