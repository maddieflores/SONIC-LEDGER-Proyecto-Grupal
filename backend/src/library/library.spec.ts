import { describe, expect, it, beforeEach, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LibraryService } from './library.service.js';
import { Playlist } from './playlist.entity.js';
import { PlaylistTrack } from './playlist-track.entity.js';
import { FavoriteTrack } from './favorite-track.entity.js';
import { Cancion, CancionEstado } from '../musica/cancion.entity.js';

describe('CU09 y CU10 LibraryService: Playlists y Favoritos', () => {
  let service: LibraryService;
  let mockPlaylistRepo: any;
  let mockTrackRepo: any;
  let mockFavoriteRepo: any;
  let mockSongRepo: any;
  let mockAudiusService: any;

  const userA = 'u0000000-0000-4000-8000-000000000001';
  const userB = 'u0000000-0000-4000-8000-000000000002';

  let playlistsStore: Playlist[];
  let tracksStore: PlaylistTrack[];
  let favoritesStore: FavoriteTrack[];

  const localSong: Cancion = {
    id: 's0000000-0000-4000-8000-000000000001',
    artistaId: 'a0000000-0000-4000-8000-000000000001',
    artista: { nombreArtistico: 'Artista Local' } as any,
    titulo: 'Pista Local 1',
    descripcion: '',
    duracionSegundos: 200,
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

  const audiusTrackMock = {
    id: 'audius:TRACK123',
    source: 'AUDIUS' as const,
    externalId: 'TRACK123',
    title: 'Audius Hit Track',
    artist: {
      id: 'audius:USER123',
      externalId: 'USER123',
      name: 'Audius DJ',
      handle: 'audiusdj',
      profilePictureUrl: null,
    },
    artworkUrl: 'https://audius.co/cover.jpg',
    durationSeconds: 195,
    genre: 'Electronic',
    mood: null,
    releaseDate: null,
    playCount: 1500,
    isPlayable: true,
    isStreamGated: false,
    externalUrl: 'https://audius.co/tracks/123',
  };

  beforeEach(() => {
    playlistsStore = [
      {
        id: 'p0000000-0000-4000-8000-000000000001',
        usuarioId: userA,
        nombre: 'Mis Favoritas de Noche',
        descripcion: 'Para estudiar',
        tracks: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        usuario: null as any,
      },
    ];

    tracksStore = [];
    favoritesStore = [];

    mockPlaylistRepo = {
      find: vi.fn(async ({ where }) =>
        playlistsStore.filter((p) => !where?.usuarioId || p.usuarioId === where.usuarioId),
      ),
      findOne: vi.fn(async ({ where }) => {
        const found = playlistsStore.find(
          (p) =>
            (!where.id || p.id === where.id) &&
            (!where.usuarioId || p.usuarioId === where.usuarioId),
        );
        if (found) {
          found.tracks = tracksStore
            .filter((t) => t.playlistId === found.id)
            .sort((a, b) => a.posicion - b.posicion);
        }
        return found || null;
      }),
      findOneBy: vi.fn(async (conditions: any) =>
        playlistsStore.find(
          (p) =>
            (!conditions.id || p.id === conditions.id) &&
            (!conditions.usuarioId || p.usuarioId === conditions.usuarioId),
        ) || null,
      ),
      create: vi.fn((data) => ({
        id: 'p0000000-0000-4000-8000-000000000002',
        tracks: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      })),
      save: vi.fn(async (entity) => {
        const idx = playlistsStore.findIndex((p) => p.id === entity.id);
        if (idx >= 0) playlistsStore[idx] = entity;
        else playlistsStore.push(entity);
        return entity;
      }),
      remove: vi.fn(async (entity) => {
        playlistsStore = playlistsStore.filter((p) => p.id !== entity.id);
        tracksStore = tracksStore.filter((t) => t.playlistId !== entity.id);
        return entity;
      }),
    };

    mockTrackRepo = {
      create: vi.fn((data) => ({
        id: 'pt000000-0000-4000-8000-000000000001',
        addedAt: new Date(),
        ...data,
      })),
      save: vi.fn(async (track) => {
        const idx = tracksStore.findIndex(
          (t) => t.playlistId === track.playlistId && t.trackId === track.trackId,
        );
        if (idx >= 0) tracksStore[idx] = track;
        else tracksStore.push(track);
        return track;
      }),
      remove: vi.fn(async (track) => {
        tracksStore = tracksStore.filter(
          (t) => !(t.playlistId === track.playlistId && t.trackId === track.trackId),
        );
        return track;
      }),
    };

    mockFavoriteRepo = {
      find: vi.fn(async ({ where }) =>
        favoritesStore.filter((f) => !where?.usuarioId || f.usuarioId === where.usuarioId),
      ),
      findOneBy: vi.fn(async (conditions: any) =>
        favoritesStore.find(
          (f) =>
            (!conditions.usuarioId || f.usuarioId === conditions.usuarioId) &&
            (!conditions.trackId || f.trackId === conditions.trackId),
        ) || null,
      ),
      create: vi.fn((data) => ({
        id: 'f0000000-0000-4000-8000-000000000001',
        createdAt: new Date(),
        ...data,
      })),
      save: vi.fn(async (fav) => {
        favoritesStore.push(fav);
        return fav;
      }),
      delete: vi.fn(async ({ usuarioId, trackId }) => {
        favoritesStore = favoritesStore.filter(
          (f) => !(f.usuarioId === usuarioId && f.trackId === trackId),
        );
        return { affected: 1 };
      }),
    };

    mockSongRepo = {
      find: vi.fn(async () => [localSong]),
    };

    mockAudiusService = {
      getTrackById: vi.fn(async (id: string) => audiusTrackMock),
    };

    service = new LibraryService(
      mockPlaylistRepo,
      mockTrackRepo,
      mockFavoriteRepo,
      mockSongRepo,
      mockAudiusService,
    );
  });

  // ==========================================
  // PRUEBAS CU09: PLAYLISTS
  // ==========================================
  describe('CU09 — Playlists', () => {
    it('1. Crea una playlist con nombre y descripción', async () => {
      const pl = await service.createPlaylist(userA, {
        nombre: 'Chill Beats',
        descripcion: 'Musica relajante',
      });
      expect(pl.nombre).toBe('Chill Beats');
      expect(pl.trackCount).toBe(0);
      expect(mockPlaylistRepo.save).toHaveBeenCalled();
    });

    it('2. Agrega una canción LOCAL y una canción AUDIUS preservando orden', async () => {
      const pId = playlistsStore[0].id;

      // Agregar canción local
      const res1 = await service.addTrackToPlaylist(userA, pId, {
        trackId: localSong.id,
        source: 'LOCAL',
      });
      expect(res1.trackCount).toBe(1);
      expect(res1.tracks[0].titulo).toBe('Pista Local 1');
      expect(res1.tracks[0].source).toBe('LOCAL');

      // Agregar canción Audius
      const res2 = await service.addTrackToPlaylist(userA, pId, {
        trackId: 'audius:TRACK123',
        source: 'AUDIUS',
      });
      expect(res2.trackCount).toBe(2);
      expect(res2.tracks[1].titulo).toBe('Audius Hit Track');
      expect(res2.tracks[1].source).toBe('AUDIUS');
    });

    it('3. Rechaza canciones duplicadas dentro de la misma playlist', async () => {
      const pId = playlistsStore[0].id;
      await service.addTrackToPlaylist(userA, pId, { trackId: localSong.id });

      // Intento de agregar la misma canción de nuevo
      await expect(
        service.addTrackToPlaylist(userA, pId, { trackId: localSong.id }),
      ).rejects.toThrow(BadRequestException);
    });

    it('4. Elimina una canción y reordena posiciones consecutivamente', async () => {
      const pId = playlistsStore[0].id;
      await service.addTrackToPlaylist(userA, pId, { trackId: localSong.id });
      await service.addTrackToPlaylist(userA, pId, { trackId: 'audius:TRACK123' });

      // Quitar la primera canción
      const updated = await service.removeTrackFromPlaylist(userA, pId, localSong.id);
      expect(updated.trackCount).toBe(1);
      expect(updated.tracks[0].id).toBe('audius:TRACK123');
    });

    it('5. Aislamiento entre usuarios: Usuario B no puede ver ni modificar playlist de Usuario A', async () => {
      const pId = playlistsStore[0].id;

      await expect(service.getPlaylist(userB, pId)).rejects.toThrow(NotFoundException);
      await expect(
        service.updatePlaylist(userB, pId, { nombre: 'Hack' }),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.addTrackToPlaylist(userB, pId, { trackId: localSong.id }),
      ).rejects.toThrow(NotFoundException);
      await expect(service.deletePlaylist(userB, pId)).rejects.toThrow(NotFoundException);
    });
  });

  // ==========================================
  // PRUEBAS CU10: FAVORITOS
  // ==========================================
  describe('CU10 — Favoritos', () => {
    it('6. Agrega canciones LOCAL y AUDIUS a favoritos de forma idempotente', async () => {
      const r1 = await service.addFavorite(userA, { trackId: localSong.id, source: 'LOCAL' });
      expect(r1.favorited).toBe(true);

      const r2 = await service.addFavorite(userA, {
        trackId: 'audius:TRACK123',
        source: 'AUDIUS',
      });
      expect(r2.favorited).toBe(true);

      // Duplicado no genera error ni doble entrada
      const dup = await service.addFavorite(userA, { trackId: localSong.id, source: 'LOCAL' });
      expect(dup.favorited).toBe(true);
      expect(favoritesStore.length).toBe(2);
    });

    it('7. Quita canciones de favoritos y consulta el estado', async () => {
      await service.addFavorite(userA, { trackId: localSong.id });

      const checkBefore = await service.checkFavorites(userA, [localSong.id]);
      expect(checkBefore[localSong.id]).toBe(true);

      await service.removeFavorite(userA, localSong.id);

      const checkAfter = await service.checkFavorites(userA, [localSong.id]);
      expect(checkAfter[localSong.id]).toBe(false);
    });

    it('8. Aislamiento de favoritos entre usuarios', async () => {
      await service.addFavorite(userA, { trackId: localSong.id });

      const favsUserA = await service.getFavoriteIds(userA);
      const favsUserB = await service.getFavoriteIds(userB);

      expect(favsUserA).toContain(localSong.id);
      expect(favsUserB).not.toContain(localSong.id);
    });
  });
});
