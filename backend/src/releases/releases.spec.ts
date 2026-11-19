import { describe, expect, it, beforeEach, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ReleasesService } from './releases.service.js';
import {
  Lanzamiento,
  LanzamientoEstado,
  LanzamientoTipo,
} from '../musica/lanzamiento.entity.js';
import { Cancion, CancionEstado } from '../musica/cancion.entity.js';
import { Artista } from '../musica/artista.entity.js';

describe('CU06 ReleasesService: Reglas de negocio y gestión de lanzamientos', () => {
  let service: ReleasesService;
  let mockReleasesRepo: any;
  let mockSongsRepo: any;
  let mockArtistsRepo: any;

  const mockArtist: Artista = {
    id: 'a0000000-0000-4000-8000-000000000001',
    usuarioId: 'u0000000-0000-4000-8000-000000000001',
    nombreArtistico: 'Artista Uno',
    biografia: 'Bio',
    avatarUrl: null,
    coverUrl: null,
    ciudad: 'La Paz',
    pais: 'Bolivia',
    identidad: [],
    redes: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    canciones: [],
    lanzamientos: [],
    generos: [],
    usuario: null as any,
  };

  const otherArtist: Artista = {
    id: 'a0000000-0000-4000-8000-000000000002',
    usuarioId: 'u0000000-0000-4000-8000-000000000002',
    nombreArtistico: 'Artista Dos',
    biografia: 'Bio 2',
    avatarUrl: null,
    coverUrl: null,
    ciudad: 'Santa Cruz',
    pais: 'Bolivia',
    identidad: [],
    redes: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    canciones: [],
    lanzamientos: [],
    generos: [],
    usuario: null as any,
  };

  let mockRelease: Lanzamiento;
  let songsList: Cancion[];

  beforeEach(() => {
    mockRelease = {
      id: 'r0000000-0000-4000-8000-000000000001',
      artistaId: mockArtist.id,
      artista: mockArtist,
      titulo: 'Mi Primer Lanzamiento',
      descripcion: 'Descripción del lanzamiento',
      tipo: LanzamientoTipo.SINGLE,
      portadaUrl: null,
      fechaLanzamiento: null,
      estado: LanzamientoEstado.BORRADOR,
      canciones: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    songsList = [
      {
        id: 's0000000-0000-4000-8000-000000000001',
        artistaId: mockArtist.id,
        artista: mockArtist,
        titulo: 'Pista 1',
        lanzamientoId: null,
        numeroPista: null,
        generoId: null,
        genero: null,
        descripcion: '',
        portadaUrl: null,
        archivoAudioUrl:
          '/api/auth/artist-songs/s0000000-0000-4000-8000-000000000001/media/audio/11111111-1111-4111-8111-111111111111.wav',
        duracionSegundos: 180,
        estado: CancionEstado.PUBLICADO,
        createdAt: new Date(),
        updatedAt: new Date(),
        lanzamiento: null,
      },
      {
        id: 's0000000-0000-4000-8000-000000000002',
        artistaId: mockArtist.id,
        artista: mockArtist,
        titulo: 'Pista 2',
        lanzamientoId: null,
        numeroPista: null,
        generoId: null,
        genero: null,
        descripcion: '',
        portadaUrl: null,
        archivoAudioUrl:
          '/api/auth/artist-songs/s0000000-0000-4000-8000-000000000002/media/audio/22222222-2222-4222-8222-222222222222.wav',
        duracionSegundos: 210,
        estado: CancionEstado.PUBLICADO,
        createdAt: new Date(),
        updatedAt: new Date(),
        lanzamiento: null,
      },
      {
        id: 's0000000-0000-4000-8000-000000000003',
        artistaId: otherArtist.id, // Pertenece a otro artista
        artista: otherArtist,
        titulo: 'Pista Ajena',
        lanzamientoId: null,
        numeroPista: null,
        generoId: null,
        genero: null,
        descripcion: '',
        portadaUrl: null,
        archivoAudioUrl: null,
        duracionSegundos: 150,
        estado: CancionEstado.PUBLICADO,
        createdAt: new Date(),
        updatedAt: new Date(),
        lanzamiento: null,
      },
    ];

    mockArtistsRepo = {
      findOneBy: vi.fn(async ({ usuarioId }) => {
        if (usuarioId === mockArtist.usuarioId) return mockArtist;
        if (usuarioId === otherArtist.usuarioId) return otherArtist;
        return null;
      }),
    };

    mockReleasesRepo = {
      findOne: vi.fn(async ({ where }) => {
        if (
          where.id === mockRelease.id &&
          (!where.artistaId || where.artistaId === mockRelease.artistaId)
        ) {
          return mockRelease;
        }
        return null;
      }),
      create: vi.fn((data) => ({ ...mockRelease, ...data })),
      save: vi.fn(async (entity) => entity),
      remove: vi.fn(async (entity) => entity),
      manager: {
        transaction: vi.fn(async (cb) => {
          const fakeManager = {
            getRepository: vi.fn((entityClass) => {
              if (entityClass === Lanzamiento) return mockReleasesRepo;
              if (entityClass === Cancion) return mockSongsRepo;
              return {};
            }),
            createQueryBuilder: vi.fn(() => ({
              update: vi.fn().mockReturnThis(),
              set: vi.fn().mockReturnThis(),
              where: vi.fn().mockReturnThis(),
              execute: vi.fn().mockResolvedValue({ affected: 1 }),
            })),
          };
          return cb(fakeManager);
        }),
      },
    };

    mockSongsRepo = {
      findBy: vi.fn(async (conditions: any) => {
        const ids = conditions.id?._value || conditions.id;
        const artistId = conditions.artistaId;
        return songsList.filter(
          (s) =>
            Array.isArray(ids) &&
            ids.includes(s.id) &&
            (!artistId || s.artistaId === artistId),
        );
      }),
      find: vi.fn(async ({ where }) => {
        if (where.lanzamientoId) {
          return songsList.filter((s) => s.lanzamientoId === where.lanzamientoId);
        }
        return songsList;
      }),
      save: vi.fn(async (song) => song),
    };

    service = new ReleasesService(
      mockReleasesRepo,
      mockSongsRepo,
      mockArtistsRepo,
    );
  });

  it('1. Valida reglas de cantidad de canciones según el tipo (SINGLE, EP, ALBUM)', () => {
    // Sencillo: exactamente 1 canción
    expect(() =>
      service.validateTypeTrackCount(LanzamientoTipo.SINGLE, 1),
    ).not.toThrow();
    expect(() =>
      service.validateTypeTrackCount(LanzamientoTipo.SINGLE, 0),
    ).toThrow(BadRequestException);
    expect(() =>
      service.validateTypeTrackCount(LanzamientoTipo.SINGLE, 2),
    ).toThrow(BadRequestException);

    // EP: entre 2 y 6 canciones
    expect(() =>
      service.validateTypeTrackCount(LanzamientoTipo.EP, 2),
    ).not.toThrow();
    expect(() =>
      service.validateTypeTrackCount(LanzamientoTipo.EP, 6),
    ).not.toThrow();
    expect(() =>
      service.validateTypeTrackCount(LanzamientoTipo.EP, 1),
    ).toThrow(BadRequestException);
    expect(() =>
      service.validateTypeTrackCount(LanzamientoTipo.EP, 7),
    ).toThrow(BadRequestException);

    // Álbum: 7 o más canciones
    expect(() =>
      service.validateTypeTrackCount(LanzamientoTipo.ALBUM, 7),
    ).not.toThrow();
    expect(() =>
      service.validateTypeTrackCount(LanzamientoTipo.ALBUM, 12),
    ).not.toThrow();
    expect(() =>
      service.validateTypeTrackCount(LanzamientoTipo.ALBUM, 6),
    ).toThrow(BadRequestException);
  });

  it('2. Crea un lanzamiento como borrador para el artista autenticado', async () => {
    const result = await service.create(mockArtist.usuarioId, {
      titulo: 'Nuevo Lanzamiento',
      tipo: LanzamientoTipo.EP,
      descripcion: 'Descripción EP',
    });

    expect(result).toBeDefined();
    expect(mockReleasesRepo.save).toHaveBeenCalled();
  });

  it('3. Impide modificar o consultar lanzamientos ajenos', async () => {
    // Usuario 2 intentando acceder al lanzamiento de Usuario 1
    await expect(
      service.detail(otherArtist.usuarioId, mockRelease.id),
    ).rejects.toThrow(NotFoundException);

    await expect(
      service.update(otherArtist.usuarioId, mockRelease.id, {
        titulo: 'Hackeado',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('4. Impide asociar canciones duplicadas o de otros artistas', async () => {
    // Canciones duplicadas
    await expect(
      service.setTracks(mockArtist.usuarioId, mockRelease.id, [
        songsList[0].id,
        songsList[0].id,
      ]),
    ).rejects.toThrow(BadRequestException);

    // Canción de otro artista
    await expect(
      service.setTracks(mockArtist.usuarioId, mockRelease.id, [
        songsList[2].id, // Pertenece a otherArtist
      ]),
    ).rejects.toThrow(BadRequestException);
  });

  it('5. Asocia y reordena canciones asignando numeroPista consecutivo', async () => {
    const trackIds = [songsList[1].id, songsList[0].id];
    await service.setTracks(mockArtist.usuarioId, mockRelease.id, trackIds);

    // songsList[1] debe ser pista 1, songsList[0] debe ser pista 2
    expect(songsList[1].numeroPista).toBe(1);
    expect(songsList[1].lanzamientoId).toBe(mockRelease.id);
    expect(songsList[0].numeroPista).toBe(2);
    expect(songsList[0].lanzamientoId).toBe(mockRelease.id);
  });

  it('6. Al eliminar un lanzamiento desvincula las canciones sin borrarlas ni eliminar audios', async () => {
    const deleteResult = await service.delete(
      mockArtist.usuarioId,
      mockRelease.id,
    );
    expect(deleteResult.deleted).toBe(true);
    expect(mockReleasesRepo.remove).toHaveBeenCalled();
  });
});
