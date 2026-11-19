import { describe, expect, it, vi } from 'vitest';
import { ValidationPipe } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { CatalogQuery } from './catalog.dto.js';
import { CatalogService } from './catalog.service.js';
import { Cancion, CancionEstado } from '../musica/cancion.entity.js';
import type { Genero } from '../musica/genero.entity.js';
describe('CU07 contrato de lectura publicado', () => {
  it('valida paginación y rechaza filtros ajenos al contrato', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
    await expect(
      pipe.transform(
        { page: '2', q: 'rock' },
        { type: 'query', metatype: CatalogQuery },
      ),
    ).resolves.toMatchObject({ page: 2, q: 'rock' });
    for (const body of [
      { page: 0 },
      { pageSize: 51 },
      { generoId: 'inventado' },
      { estado: 'borrador' },
      { artistaId: 'otro' },
    ])
      await expect(
        pipe.transform(body, { type: 'query', metatype: CatalogQuery }),
      ).rejects.toThrow();
  });
  it('consulta detalle y relacionadas solo publicadas, sin revelar rutas privadas ni cuentas', async () => {
    const song = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      titulo: 'Canción',
      artistaId: 'artist',
      artista: { nombreArtistico: 'Artista', usuarioId: 'private-user' },
      genero: null,
      duracionSegundos: null,
      descripcion: '',
      portadaUrl: 'https://untrusted.example/image.png',
      archivoAudioUrl: '/private/file.wav',
    };
    const findOne = vi.fn(() => song),
      find = vi.fn(() => []);
    const service = new CatalogService(
      { findOne, find } as unknown as Repository<Cancion>,
      {} as Repository<Genero>,
    );
    const result = await service.detail(song.id);
    expect(findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: song.id, estado: CancionEstado.PUBLICADO },
      }),
    );
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          estado: CancionEstado.PUBLICADO,
          artistaId: 'artist',
        }),
      }),
    );
    expect(result.song.coverUrl).toBeNull();
    expect(result.song).not.toHaveProperty('archivoAudioUrl');
    expect(result.song.artista).not.toHaveProperty('usuarioId');
    expect(result.song.duracionSegundos).toBeNull();
    await expect(service.cover(song.id)).rejects.toThrow('Portada');
  });
  it('rechaza una canción no disponible incluso al solicitar portada', async () => {
    const service = new CatalogService(
      { findOne: vi.fn(() => null) } as unknown as Repository<Cancion>,
      {} as Repository<Genero>,
    );
    await expect(service.detail('draft')).rejects.toThrow('no está disponible');
    await expect(service.cover('draft')).rejects.toThrow('no está disponible');
  });
});
