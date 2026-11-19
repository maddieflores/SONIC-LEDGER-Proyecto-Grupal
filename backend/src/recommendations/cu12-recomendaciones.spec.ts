import { describe, expect, it, beforeEach } from 'vitest';
import { MusicRecommendationsService } from './music-recommendations.service.js';
import { TrackSelectorService } from './track-selector.service.js';
import { CancionEstado } from '../musica/cancion.entity.js';
import type { CandidateTrack } from './recommendations.types.js';

describe('CU12 — Recomendaciones Musicales Personalizadas (Motor Determinista)', () => {
  let recommendationsService: MusicRecommendationsService;
  let trackSelector: TrackSelectorService;

  // Mock repositories
  let mockCancionesRepo: any;
  let mockUsuariosRepo: any;
  let mockFavoritesRepo: any;
  let mockHistoryRepo: any;
  let mockGenerosRepo: any;
  let mockLibraryService: any;
  let mockAudiusService: any;

  // Generos de prueba
  const generosMock = [
    { id: 'gen-rock', nombre: 'Rock', activo: true },
    { id: 'gen-pop', nombre: 'Pop', activo: true },
    { id: 'gen-jazz', nombre: 'Jazz', activo: true },
    { id: 'gen-folklore', nombre: 'Folklore', activo: true },
  ];

  // Canciones locales de prueba
  const cancionesLocalesMock = [
    {
      id: 'song-rock-1',
      artistaId: 'art-rock-1',
      artista: { id: 'art-rock-1', nombreArtistico: 'Illimani Rock' },
      generoId: 'gen-rock',
      genero: { id: 'gen-rock', nombre: 'Rock' },
      titulo: 'Furia Andina',
      archivoAudioUrl: '/api/auth/artist-songs/song-rock-1/media/audio/11111111-1111-4111-8111-111111111111.wav',
      portadaUrl: '/api/auth/artist-songs/song-rock-1/media/cover/11111111-1111-4111-8111-111111111111.jpg',
      duracionSegundos: 210,
      estado: CancionEstado.PUBLICADO,
      createdAt: new Date('2026-01-01'),
    },
    {
      id: 'song-rock-2',
      artistaId: 'art-rock-2',
      artista: { id: 'art-rock-2', nombreArtistico: 'Cerro Rico' },
      generoId: 'gen-rock',
      genero: { id: 'gen-rock', nombre: 'Rock' },
      titulo: 'Viento Minero',
      archivoAudioUrl: '/api/auth/artist-songs/song-rock-2/media/audio/22222222-2222-4222-8222-222222222222.wav',
      portadaUrl: '/api/auth/artist-songs/song-rock-2/media/cover/22222222-2222-4222-8222-222222222222.jpg',
      duracionSegundos: 195,
      estado: CancionEstado.PUBLICADO,
      createdAt: new Date('2026-01-02'),
    },
    {
      id: 'song-pop-1',
      artistaId: 'art-pop-1',
      artista: { id: 'art-pop-1', nombreArtistico: 'Luna Eléctrica' },
      generoId: 'gen-pop',
      genero: { id: 'gen-pop', nombre: 'Pop' },
      titulo: 'Luces de Noche',
      archivoAudioUrl: '/api/auth/artist-songs/song-pop-1/media/audio/33333333-3333-4333-8333-333333333333.wav',
      portadaUrl: '/api/auth/artist-songs/song-pop-1/media/cover/33333333-3333-4333-8333-333333333333.jpg',
      duracionSegundos: 180,
      estado: CancionEstado.PUBLICADO,
      createdAt: new Date('2026-01-03'),
    },
    {
      id: 'song-unplayable',
      artistaId: 'art-broken',
      artista: { id: 'art-broken', nombreArtistico: 'Inaccesible' },
      generoId: 'gen-rock',
      genero: { id: 'gen-rock', nombre: 'Rock' },
      titulo: 'Pista Sin Audio',
      archivoAudioUrl: null, // No reproducible
      portadaUrl: null,
      duracionSegundos: 120,
      estado: CancionEstado.PUBLICADO,
      createdAt: new Date('2026-01-04'),
    },
  ];

  // Pista de Audius de prueba
  const audiusTrendingMock = {
    data: [
      {
        id: 'audius:track-audius-1',
        title: 'Neon Skyline',
        artist: { id: 'art-aud-1', name: 'Synth Master' },
        genre: 'Electronic',
        durationSeconds: 240,
        artworkUrl: 'https://audius.co/cover1.jpg',
        isPlayable: true,
      },
    ],
  };

  beforeEach(() => {
    trackSelector = new TrackSelectorService();

    mockCancionesRepo = {
      find: async () => cancionesLocalesMock,
    };

    mockUsuariosRepo = {
      findOne: async ({ where }: any) => {
        if (where.id === 'user-rockero') {
          return {
            id: 'user-rockero',
            username: 'rockero99',
            musicPreferences: { genreIds: ['gen-rock'] },
          };
        }
        if (where.id === 'user-popero') {
          return {
            id: 'user-popero',
            username: 'popero21',
            musicPreferences: { genreIds: ['gen-pop'] },
          };
        }
        if (where.id === 'user-cold-start') {
          return {
            id: 'user-cold-start',
            username: 'novato',
            musicPreferences: { genreIds: [] },
          };
        }
        return null;
      },
    };

    mockFavoritesRepo = {
      find: async ({ where }: any) => {
        if (where.usuarioId === 'user-rockero') {
          return [
            {
              id: 'fav-1',
              usuarioId: 'user-rockero',
              trackId: 'song-rock-1',
              source: 'LOCAL',
            },
          ];
        }
        return [];
      },
    };

    mockHistoryRepo = {
      find: async ({ where }: any) => {
        if (where.usuarioId === 'user-rockero') {
          return [
            {
              id: 'hist-1',
              usuarioId: 'user-rockero',
              trackId: 'song-rock-1',
              source: 'LOCAL',
              eventType: 'PLAYED',
              listenedSeconds: 150,
            },
            {
              id: 'hist-2',
              usuarioId: 'user-rockero',
              trackId: 'song-rock-2',
              source: 'LOCAL',
              eventType: 'PLAYED',
              listenedSeconds: 195,
            },
          ];
        }
        return [];
      },
    };

    mockGenerosRepo = {
      find: async () => generosMock,
    };

    mockLibraryService = {
      resolveTracks: async (items: any[]) => {
        return items.map((i) => {
          if (i.trackId === 'song-rock-1') {
            return {
              id: 'song-rock-1',
              source: 'LOCAL',
              titulo: 'Furia Andina',
              artista: { id: 'art-rock-1', nombre: 'Illimani Rock' },
              genero: { id: 'gen-rock', nombre: 'Rock' },
              duracionSegundos: 210,
              playable: true,
            };
          }
          if (i.trackId === 'song-rock-2') {
            return {
              id: 'song-rock-2',
              source: 'LOCAL',
              titulo: 'Viento Minero',
              artista: { id: 'art-rock-2', nombre: 'Cerro Rico' },
              genero: { id: 'gen-rock', nombre: 'Rock' },
              duracionSegundos: 195,
              playable: true,
            };
          }
          if (i.trackId === 'song-pop-1') {
            return {
              id: 'song-pop-1',
              source: 'LOCAL',
              titulo: 'Luces de Noche',
              artista: { id: 'art-pop-1', nombre: 'Luna Eléctrica' },
              genero: { id: 'gen-pop', nombre: 'Pop' },
              duracionSegundos: 180,
              playable: true,
            };
          }
          return {
            id: i.trackId,
            source: i.source,
            titulo: 'Desconocido',
            artista: { id: 'art-x', nombre: 'Artista X' },
            genero: null,
            duracionSegundos: 120,
            playable: true,
          };
        });
      },
    };

    mockAudiusService = {
      getTrending: async () => audiusTrendingMock,
    };

    recommendationsService = new MusicRecommendationsService(
      mockCancionesRepo,
      mockUsuariosRepo,
      mockFavoritesRepo,
      mockHistoryRepo,
      mockGenerosRepo,
      mockLibraryService,
      trackSelector,
      mockAudiusService,
    );
  });

  // 1. Dos usuarios con gustos diferentes obtienen resultados diferentes cuando existen candidatos adecuados
  it('1. dos usuarios con gustos diferentes obtienen rankings diferentes', async () => {
    const resRock = await recommendationsService.getRecommendations('user-rockero');
    const resPop = await recommendationsService.getRecommendations('user-popero');

    expect(resRock.esPersonalizada).toBe(true);
    expect(resPop.esPersonalizada).toBe(true);

    // El primer resultado para el rockero debe ser una pista de Rock con alto score
    expect(resRock.items[0].genero?.nombre).toBe('Rock');
    expect(resRock.items[0].score).toBeGreaterThan(60);

    // El primer resultado para el popero debe ser una pista de Pop
    expect(resPop.items[0].genero?.nombre).toBe('Pop');
    expect(resPop.items[0].titulo).toBe('Luces de Noche');

    // Los primeros IDs recomendados son diferentes
    expect(resRock.items[0].id).not.toBe(resPop.items[0].id);
  });

  // 2. Cambiar favoritos modifica el ranking
  it('2. cambiar favoritos incrementa la afinidad y posiciona la canción más arriba', async () => {
    // Escenario A: sin favoritos
    mockFavoritesRepo.find = async () => [];
    const sinFavs = await recommendationsService.getRecommendations('user-popero');
    const popScoreSinFav = sinFavs.items.find((i) => i.id === 'song-pop-1')?.score || 0;

    // Escenario B: se agrega song-pop-1 a favoritos
    mockFavoritesRepo.find = async () => [
      { id: 'fav-pop', usuarioId: 'user-popero', trackId: 'song-pop-1', source: 'LOCAL' },
    ];
    const conFavs = await recommendationsService.getRecommendations('user-popero');
    const popScoreConFav = conFavs.items.find((i) => i.id === 'song-pop-1')?.score || 0;

    expect(popScoreConFav).toBeGreaterThan(popScoreSinFav);
    const favItem = conFavs.items.find((i) => i.id === 'song-pop-1');
    expect(favItem?.motivosRecomendacion).toContain('Está en tu lista de canciones favoritas');
  });

  // 3. Cambiar preferencias influye en las recomendaciones
  it('3. cambiar preferencias modifica los géneros destacados y los motivos', async () => {
    mockUsuariosRepo.findOne = async () => ({
      id: 'user-cambio',
      musicPreferences: { genreIds: ['gen-rock'] },
    });
    mockFavoritesRepo.find = async () => [];
    mockHistoryRepo.find = async () => [];

    const recRock = await recommendationsService.getRecommendations('user-cambio');
    expect(recRock.items[0].genero?.nombre).toBe('Rock');
    expect(recRock.items[0].motivosRecomendacion.some((m) => m.includes('Rock'))).toBe(true);

    // Cambiar preferencia a Pop
    mockUsuariosRepo.findOne = async () => ({
      id: 'user-cambio',
      musicPreferences: { genreIds: ['gen-pop'] },
    });
    const recPop = await recommendationsService.getRecommendations('user-cambio');
    expect(recPop.items[0].genero?.nombre).toBe('Pop');
    expect(recPop.items[0].motivosRecomendacion.some((m) => m.includes('Pop'))).toBe(true);
  });

  // 4. El historial válido influye en el resultado
  it('4. el historial de reproducciones válidas suma afinidad según reproducciones y tiempo efectivo', async () => {
    mockUsuariosRepo.findOne = async () => ({
      id: 'user-hist',
      musicPreferences: { genreIds: [] },
    });
    mockFavoritesRepo.find = async () => [];

    // Usuario escuchó 3 veces a Illimani Rock por 180 segundos
    mockHistoryRepo.find = async () => [
      { id: 'h1', trackId: 'song-rock-1', eventType: 'PLAYED', listenedSeconds: 180, source: 'LOCAL' },
      { id: 'h2', trackId: 'song-rock-1', eventType: 'PLAYED', listenedSeconds: 180, source: 'LOCAL' },
      { id: 'h3', trackId: 'song-rock-1', eventType: 'PLAYED', listenedSeconds: 180, source: 'LOCAL' },
    ];

    const result = await recommendationsService.getRecommendations('user-hist');
    const rockItem = result.items.find((i) => i.id === 'song-rock-1');

    expect(rockItem).toBeDefined();
    expect(rockItem!.score).toBeGreaterThan(40);
    expect(rockItem!.motivosRecomendacion.some((m) => m.includes('Artista frecuente'))).toBe(true);
    expect(rockItem!.motivosRecomendacion.some((m) => m.includes('Más de'))).toBe(true);
  });

  // 5. SKIPPED no equivale a reproducción completa y penaliza el ranking
  it('5. SKIPPED no suma puntos de reproducción válida y penaliza el score de la canción', async () => {
    mockUsuariosRepo.findOne = async () => ({
      id: 'user-skip',
      musicPreferences: { genreIds: ['gen-rock'] },
    });
    mockFavoritesRepo.find = async () => [];

    // Caso A: Sin omisiones
    mockHistoryRepo.find = async () => [];
    const resSinSkip = await recommendationsService.getRecommendations('user-skip');
    const scoreNormal = resSinSkip.items.find((i) => i.id === 'song-rock-1')?.score || 0;

    // Caso B: Con evento SKIPPED para song-rock-1
    mockHistoryRepo.find = async () => [
      { id: 's1', trackId: 'song-rock-1', eventType: 'SKIPPED', listenedSeconds: 5, source: 'LOCAL' },
    ];
    const resConSkip = await recommendationsService.getRecommendations('user-skip');
    const scoreConSkip = resConSkip.items.find((i) => i.id === 'song-rock-1')?.score || 0;

    // El score con skip debe ser sustancialmente menor que sin skip
    expect(scoreConSkip).toBeLessThan(scoreNormal);
  });

  // 6. Se respetan los identificadores LOCAL y AUDIUS
  it('6. respeta los identificadores y fuentes LOCAL y AUDIUS sin alterarlos', async () => {
    const res = await recommendationsService.getRecommendations('user-rockero');

    const localTrack = res.items.find((i) => i.source === 'LOCAL');
    expect(localTrack).toBeDefined();
    expect(localTrack?.id.startsWith('song-')).toBe(true);

    const audiusTrack = res.items.find((i) => i.source === 'AUDIUS');
    expect(audiusTrack).toBeDefined();
    expect(audiusTrack?.id.startsWith('audius:')).toBe(true);
    expect(audiusTrack?.source).toBe('AUDIUS');
  });

  // 7. No se inventan canciones ni artistas
  it('7. no inventa canciones ni artistas: todos provienen del catálogo verificado', async () => {
    const res = await recommendationsService.getRecommendations('user-rockero');
    const validIds = new Set([
      ...cancionesLocalesMock.map((c) => c.id),
      ...audiusTrendingMock.data.map((t) => t.id),
    ]);

    for (const item of res.items) {
      expect(validIds.has(item.id)).toBe(true);
    }
  });

  // 8. No se recomiendan canciones inaccesibles (no reproducibles)
  it('8. excluye canciones sin archivo de audio o no reproducibles', async () => {
    const res = await recommendationsService.getRecommendations('user-rockero');
    const unplayable = res.items.find((i) => i.id === 'song-unplayable');
    expect(unplayable).toBeUndefined();

    for (const item of res.items) {
      expect(item.playable).toBe(true);
    }
  });

  // 9. Se gestionan correctamente usuarios sin historial (Cold Start)
  it('9. gestiona usuarios sin historial ni preferencias marcando esPersonalizada: false', async () => {
    const res = await recommendationsService.getRecommendations('user-cold-start');
    expect(res.esPersonalizada).toBe(false);
    expect(res.items.length).toBeGreaterThan(0);
    expect(res.items[0].motivosRecomendacion[0]).toContain('Descubrimiento general');
    expect(res.items[0].score).toBe(50);
  });

  // 10. Contrato reutilizable de selección musical para DJ (CU13 y CU14)
  it('10. el selector de canciones del DJ respeta restricciones musicales y exclusiones', () => {
    const candidateTracks: CandidateTrack[] = [
      {
        id: 't1',
        source: 'LOCAL',
        titulo: 'Rock Uno',
        artistaNombre: 'Banda A',
        generoNombre: 'Rock',
        duracionSegundos: 180,
        playable: true,
      },
      {
        id: 't2',
        source: 'LOCAL',
        titulo: 'Rock Dos',
        artistaNombre: 'Banda A',
        generoNombre: 'Rock',
        duracionSegundos: 200,
        playable: true,
      },
      {
        id: 't3',
        source: 'LOCAL',
        titulo: 'Rock Tres (exceso artista)',
        artistaNombre: 'Banda A',
        generoNombre: 'Rock',
        duracionSegundos: 190,
        playable: true,
      },
      {
        id: 't4',
        source: 'LOCAL',
        titulo: 'Pop Uno',
        artistaNombre: 'Solista B',
        generoNombre: 'Pop',
        duracionSegundos: 150,
        playable: true,
      },
      {
        id: 't5',
        source: 'LOCAL',
        titulo: 'Pista Rota',
        artistaNombre: 'Solista C',
        generoNombre: 'Rock',
        duracionSegundos: 210,
        playable: false,
      },
    ];

    // Restricciones: solo Rock, no reproducibles descartadas, max 2 por artista, excluir t1
    const selected = trackSelector.selectTracks(candidateTracks, {
      generos: ['Rock'],
      cancionesExcluidas: ['t1'],
      soloPlayable: true,
      maxPorArtista: 2,
    });

    // t1 está excluida
    expect(selected.find((t) => t.id === 't1')).toBeUndefined();
    // t5 no es reproducible
    expect(selected.find((t) => t.id === 't5')).toBeUndefined();
    // t4 es de Pop (no coincide con el filtro de género)
    expect(selected.find((t) => t.id === 't4')).toBeUndefined();
    // t2 se selecciona
    expect(selected.find((t) => t.id === 't2')).toBeDefined();
    // Banda A solo tiene t2 y t3 en candidatos viables (t3 entra porque maxPorArtista=2 y t1 fue excluida)
    expect(selected.length).toBe(2);
  });
});
