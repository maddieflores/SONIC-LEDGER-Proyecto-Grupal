import { describe, expect, it, beforeEach, vi } from 'vitest';
import { RecomendacionesService } from './recomendaciones.service.js';
import { ConciertoEstado } from './concierto.entity.js';

describe('CU19 — Recomendaciones de Conciertos (Algoritmo de Afinidad Basado en Contenido)', () => {
  let service: RecomendacionesService;

  // Mock repos
  let mockConciertosRepo: any;
  let mockUsuariosRepo: any;
  let mockFavoritesRepo: any;
  let mockHistoryRepo: any;
  let mockGenerosRepo: any;
  let mockLibraryService: any;

  const now = new Date();
  const futureDate1 = new Date(now.getTime() + 5 * 86400000); // 5 días
  const futureDate2 = new Date(now.getTime() + 15 * 86400000); // 15 días
  const pastDate = new Date(now.getTime() - 2 * 86400000); // pasado

  const sampleRockConcert = {
    id: 'c-rock-1',
    organizadorId: 'org-1',
    titulo: 'Illimani Rock Fest 2026',
    descripcion: 'El mejor festival de rock en La Paz',
    portadaUrl: '/images/rock.jpg',
    genero: 'Rock',
    fechaInicio: futureDate1,
    fechaFin: new Date(futureDate1.getTime() + 14400000),
    zonaHoraria: 'America/La_Paz',
    recinto: 'Teatro al Aire Libre',
    direccion: 'Av. del Ejército',
    ciudad: 'La Paz',
    departamento: 'La Paz',
    estado: ConciertoEstado.PUBLICADO,
    inicioVenta: null,
    destacado: true,
    artistas: [
      {
        id: 'rel-1',
        conciertoId: 'c-rock-1',
        artistaId: 'art-rockero',
        nombreArtista: 'Illimani Rock Band',
        orden: 1,
        artista: { avatarUrl: '/avatar/rock.jpg' },
      },
    ],
    categorias: [
      {
        id: 'cat-1',
        conciertoId: 'c-rock-1',
        nombre: 'General',
        precio: 100,
        moneda: 'BOB',
        cupoTotal: 200,
        cupoDisponible: 150,
        disponible: true,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };

  const samplePopConcert = {
    id: 'c-pop-2',
    organizadorId: 'org-2',
    titulo: 'Santa Cruz Pop Night',
    descripcion: 'Noche de pop y electrónica',
    portadaUrl: '/images/pop.jpg',
    genero: 'Pop',
    fechaInicio: futureDate2,
    fechaFin: new Date(futureDate2.getTime() + 14400000),
    zonaHoraria: 'America/La_Paz',
    recinto: 'Arena Santa Cruz',
    direccion: '4to Anillo',
    ciudad: 'Santa Cruz',
    departamento: 'Santa Cruz',
    estado: ConciertoEstado.PUBLICADO,
    inicioVenta: null,
    destacado: false,
    artistas: [
      {
        id: 'rel-2',
        conciertoId: 'c-pop-2',
        artistaId: 'art-pop',
        nombreArtista: 'Diva Pop',
        orden: 1,
        artista: { avatarUrl: '/avatar/pop.jpg' },
      },
    ],
    categorias: [
      {
        id: 'cat-2',
        conciertoId: 'c-pop-2',
        nombre: 'VIP',
        precio: 250,
        moneda: 'BOB',
        cupoTotal: 100,
        cupoDisponible: 80,
        disponible: true,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };

  const sampleCancelledConcert = {
    ...sampleRockConcert,
    id: 'c-cancelled',
    estado: ConciertoEstado.CANCELADO,
  };

  const sampleDraftConcert = {
    ...samplePopConcert,
    id: 'c-draft',
    estado: ConciertoEstado.BORRADOR,
  };

  beforeEach(() => {
    mockConciertosRepo = {
      find: vi.fn().mockImplementation((query) => {
        // Simular filtro de base de datos: solo PUBLICADO
        const estadoFilter = query?.where?.estado;
        const all = [sampleRockConcert, samplePopConcert];
        if (estadoFilter === ConciertoEstado.PUBLICADO) {
          return Promise.resolve(all.filter((c) => c.estado === ConciertoEstado.PUBLICADO));
        }
        return Promise.resolve(all);
      }),
    };

    mockUsuariosRepo = {
      findOne: vi.fn().mockResolvedValue(null),
    };

    mockFavoritesRepo = {
      find: vi.fn().mockResolvedValue([]),
    };

    mockHistoryRepo = {
      find: vi.fn().mockResolvedValue([]),
    };

    mockGenerosRepo = {
      find: vi.fn().mockResolvedValue([
        { id: 'gen-rock-uuid', nombre: 'Rock' },
        { id: 'gen-pop-uuid', nombre: 'Pop' },
      ]),
    };

    mockLibraryService = {
      resolveTracks: vi.fn().mockResolvedValue([]),
    };

    service = new RecomendacionesService(
      mockConciertosRepo,
      mockUsuariosRepo,
      mockFavoritesRepo,
      mockHistoryRepo,
      mockGenerosRepo,
      mockLibraryService,
    );
  });

  it('1. Usuario nuevo sin preferencias recibe descubrimiento general (cold-start) ordenado por fecha', async () => {
    mockUsuariosRepo.findOne.mockResolvedValue({
      id: 'user-new',
      musicPreferences: {},
    });

    const res = await service.getRecommendations('user-new', 5);

    expect(res.esPersonalizada).toBe(false);
    expect(res.items.length).toBe(2);
    expect(res.items[0].id).toBe('c-rock-1'); // fechaInicio más próxima (5 días vs 15 días)
    expect(res.items[0].score).toBe(0);
    expect(res.items[0].motivosRecomendacion[0]).toContain('Descubre los próximos eventos');
  });

  it('2. Coincidencia con artista escuchado o favorito otorga alta puntuación (35 pts)', async () => {
    mockUsuariosRepo.findOne.mockResolvedValue({
      id: 'user-rocker',
      musicPreferences: {},
    });

    mockFavoritesRepo.find.mockResolvedValue([
      { trackId: 'trk-1', source: 'LOCAL', usuarioId: 'user-rocker' },
    ]);

    mockLibraryService.resolveTracks.mockResolvedValue([
      {
        id: 'trk-1',
        source: 'LOCAL',
        titulo: 'Canción Illimani',
        artista: { id: 'art-rockero', nombre: 'Illimani Rock Band' },
        genero: null,
      },
    ]);

    const res = await service.getRecommendations('user-rocker', 5);

    expect(res.esPersonalizada).toBe(true);
    const top = res.items[0];
    expect(top.id).toBe('c-rock-1');
    expect(top.score).toBeGreaterThanOrEqual(35);
    expect(top.motivosRecomendacion.some((m) => m.includes('Illimani Rock Band'))).toBe(true);
  });

  it('3. Dos usuarios con gustos distintos reciben rankings opuestos', async () => {
    // Usuario A escucha Rock
    mockUsuariosRepo.findOne.mockResolvedValueOnce({
      id: 'user-rock',
      musicPreferences: { genreIds: ['Rock'] },
    });
    const resA = await service.getRecommendations('user-rock', 5);
    expect(resA.items[0].id).toBe('c-rock-1');

    // Usuario B escucha Pop
    mockUsuariosRepo.findOne.mockResolvedValueOnce({
      id: 'user-pop',
      musicPreferences: { genreIds: ['Pop'] },
    });
    const resB = await service.getRecommendations('user-pop', 5);
    expect(resB.items[0].id).toBe('c-pop-2');
  });

  it('4. Coincidencia con ciudad seleccionada suma puntos adicionales', async () => {
    mockUsuariosRepo.findOne.mockResolvedValue({
      id: 'user-scz',
      musicPreferences: {},
    });

    // Sin ciudad: el de Rock va primero por fecha
    const resSinCiudad = await service.getRecommendations('user-scz', 5);
    expect(resSinCiudad.items[0].id).toBe('c-rock-1');

    // Con filtro de ciudad Santa Cruz: el concierto Pop de Santa Cruz escala posiciones
    const resConCiudad = await service.getRecommendations('user-scz', 5, 'Santa Cruz');
    expect(resConCiudad.items[0].id).toBe('c-pop-2');
    expect(resConCiudad.items[0].motivosRecomendacion.some((m) => m.includes('Santa Cruz'))).toBe(true);
  });

  it('5. Conciertos cancelados y borradores nunca son devueltos por el algoritmo', async () => {
    // Verificamos que la query solo busque estado PUBLICADO
    await service.getRecommendations('user-1', 5);
    expect(mockConciertosRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          estado: ConciertoEstado.PUBLICADO,
        }),
      }),
    );
  });

  it('6. Eventos con venta no iniciada pueden recomendarse con estado de venta coherente', async () => {
    const futureSaleConcert = {
      ...sampleRockConcert,
      id: 'c-sale-pending',
      inicioVenta: new Date(now.getTime() + 2 * 86400000), // Venta empieza en 2 días
    };
    mockConciertosRepo.find.mockResolvedValue([futureSaleConcert]);

    const res = await service.getRecommendations('user-1', 5);
    expect(res.items.length).toBe(1);
    expect(res.items[0].estadoVenta).toBe('VENTA_PENDIENTE');
  });

  it('7. Explicaciones de recomendación se fundamentan únicamente en señales reales verificadas', async () => {
    mockUsuariosRepo.findOne.mockResolvedValue({
      id: 'user-signals',
      musicPreferences: { genreIds: ['Rock'] },
    });
    mockHistoryRepo.find.mockResolvedValue([
      { trackId: 't-1', usuarioId: 'user-signals', eventType: 'PLAYED', listenedSeconds: 45, source: 'LOCAL' },
      { trackId: 't-1', usuarioId: 'user-signals', eventType: 'PLAYED', listenedSeconds: 50, source: 'LOCAL' },
      { trackId: 't-1', usuarioId: 'user-signals', eventType: 'PLAYED', listenedSeconds: 60, source: 'LOCAL' },
    ]);
    mockLibraryService.resolveTracks.mockResolvedValue([
      {
        id: 't-1',
        source: 'LOCAL',
        titulo: 'Rock Puro',
        artista: { id: 'art-rockero', nombre: 'Illimani Rock Band' },
        genero: { id: 'gen-rock', nombre: 'Rock' },
      },
    ]);

    const res = await service.getRecommendations('user-signals', 5, 'La Paz');
    const concert = res.items[0];

    expect(concert.id).toBe('c-rock-1');
    expect(concert.score).toBeGreaterThan(50);
    // Verificar que incluye motivos de artista, género y ciudad
    expect(concert.motivosRecomendacion.some((m) => m.includes('Illimani Rock Band'))).toBe(true);
    expect(concert.motivosRecomendacion.some((m) => m.includes('Rock'))).toBe(true);
    expect(concert.motivosRecomendacion.some((m) => m.includes('La Paz'))).toBe(true);
  });
});
