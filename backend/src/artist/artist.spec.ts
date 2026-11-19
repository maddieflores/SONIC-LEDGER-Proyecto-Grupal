import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import {
  ValidationPipe,
  UnauthorizedException,
  type INestApplication,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { ArtistController } from './artist.controller.js';
import { ArtistService } from './artist.service.js';
import {
  ArtistMediaService,
  validateArtistImage,
} from './artist-media.service.js';
import { AuthService } from '../auth/auth.service.js';
import { JwtGuard } from '../auth/auth.controller.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Artista } from '../musica/artista.entity.js';
import { Genero } from '../musica/genero.entity.js';
const genre = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  nombre: 'Rock',
  activo: true,
};
const valid = {
  nombreArtistico: 'Mi artista',
  biografia: 'Mi identidad musical',
  ciudad: 'La Paz',
  pais: 'Bolivia',
  genreIds: [genre.id],
  identidad: ['Experimental'],
  redes: { instagram: 'https://instagram.com/miartista' },
};
describe('CU04 HTTP: roles, propiedad y validación', () => {
  let app: INestApplication;
  let stored: Record<string, Artista>;
  beforeEach(async () => {
    stored = {};
    const artists = {
      findOne: vi.fn(
        ({ where }: { where: { usuarioId: string } }) =>
          stored[where.usuarioId] ?? null,
      ),
      create: (v: Partial<Artista>) => Object.assign(new Artista(), v),
      save: vi.fn((v: Artista) => {
        if (v.nombreArtistico === 'Duplicado')
          throw Object.assign(new Error(), { code: '23505' });
        v.id ??= '550e8400-e29b-41d4-a716-446655440001';
        stored[v.usuarioId] = v;
        return v;
      }),
    };
    const module = await Test.createTestingModule({
      controllers: [ArtistController],
      providers: [
        ArtistService,
        JwtGuard,
        RolesGuard,
        {
          provide: ArtistMediaService,
          useValue: { upload: vi.fn(), read: vi.fn() },
        },
        { provide: getRepositoryToken(Artista), useValue: artists },
        {
          provide: getRepositoryToken(Genero),
          useValue: {
            findBy: vi.fn(({ id }) =>
              id._value.every((v: string) => v === genre.id) ? [genre] : [],
            ),
          },
        },
        {
          provide: AuthService,
          useValue: {
            authenticate: (token: string) => {
              if (!['artist-a', 'artist-b', 'client', 'admin'].includes(token))
                throw new UnauthorizedException();
              return {
                id: token,
                username: token,
                roles: token.startsWith('artist')
                  ? ['CLIENTE', 'ARTISTA']
                  : token === 'admin'
                    ? ['ADMIN', 'CLIENTE']
                    : ['CLIENTE'],
              };
            },
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });
  afterEach(async () => {
    await app.close();
  });
  const auth = (token: string) => ({ Authorization: 'Bearer ' + token });
  it('rechaza lectura, creación, edición y cargas sin rol ARTISTA incluso con cuenta ADMIN', async () => {
    for (const token of ['client', 'admin']) {
      await request(app.getHttpServer())
        .get('/auth/artist-profile')
        .set(auth(token))
        .expect(403);
      await request(app.getHttpServer())
        .post('/auth/artist-profile')
        .set(auth(token))
        .send(valid)
        .expect(403);
      await request(app.getHttpServer())
        .patch('/auth/artist-profile')
        .set(auth(token))
        .send(valid)
        .expect(403);
      await request(app.getHttpServer())
        .post('/auth/artist-profile/media/avatar')
        .set(auth(token))
        .expect(403);
    }
    await request(app.getHttpServer())
      .post('/auth/artist-profile')
      .send(valid)
      .expect(401);
    await request(app.getHttpServer())
      .patch('/auth/artist-profile')
      .send(valid)
      .expect(401);
  });
  it('crea y edita solo el perfil propio; estadísticas vacías y otra cuenta intacta', async () => {
    const empty = await request(app.getHttpServer())
      .get('/auth/artist-profile')
      .set(auth('artist-a'))
      .expect(200);
    expect(empty.body.profile).toBeNull();
    await request(app.getHttpServer())
      .patch('/auth/artist-profile')
      .set(auth('artist-a'))
      .send(valid)
      .expect(404);
    await request(app.getHttpServer())
      .post('/auth/artist-profile')
      .set(auth('artist-a'))
      .send(valid)
      .expect(201);
    await request(app.getHttpServer())
      .post('/auth/artist-profile')
      .set(auth('artist-a'))
      .send(valid)
      .expect(409);
    const edited = await request(app.getHttpServer())
      .patch('/auth/artist-profile')
      .set(auth('artist-a'))
      .send({ ...valid, ciudad: 'Cochabamba' })
      .expect(200);
    expect(edited.body.profile.ciudad).toBe('Cochabamba');
    expect(edited.body.statistics).toBeNull();
    await request(app.getHttpServer())
      .patch('/auth/artist-profile')
      .set(auth('artist-b'))
      .send({ ...valid, usuarioId: 'artist-a' })
      .expect(400);
    await request(app.getHttpServer())
      .patch('/auth/artist-profile/' + stored['artist-a'].id)
      .set(auth('artist-b'))
      .send(valid)
      .expect(404);
    expect(stored['artist-a'].ciudad).toBe('Cochabamba');
    expect(stored['artist-b']).toBeUndefined();
  });
  it('rechaza nombres duplicados, URLs inseguras, campos protegidos y géneros desconocidos', async () => {
    await request(app.getHttpServer())
      .post('/auth/artist-profile')
      .set(auth('artist-a'))
      .send({ ...valid, nombreArtistico: 'Duplicado' })
      .expect(409);
    for (const extra of [
      { nombreArtistico: ' ' },
      { biografia: 'a'.repeat(501) },
      { ciudad: 'a'.repeat(81) },
      { genreIds: ['550e8400-e29b-41d4-a716-446655440002'] },
      { identidad: ['inventada'] },
      { redes: { instagram: 'https://evil.example/x' } },
      { redes: { instagram: 'javascript:alert(1)' } },
      { redes: { website: 'http://example.com' } },
      { redes: { website: 'https://user:pass@example.com' } },
      { redes: { roles: ['ARTISTA'] } },
      { roles: ['ARTISTA'] },
      { avatarUrl: '../../file' },
      { usuarioId: 'otro' },
    ])
      await request(app.getHttpServer())
        .post('/auth/artist-profile')
        .set(auth('artist-a'))
        .send({ ...valid, ...extra })
        .expect(400);
  });
});
describe('CU04 imágenes locales', () => {
  it('valida un PNG real y rechaza tipo falsificado, SVG, archivos corruptos y tamaño excesivo', () => {
    const png = readFileSync(
      new URL('../../../mobile/assets/icon.png', import.meta.url),
    );
    expect(validateArtistImage(png, 'image/png')).toBe('png');
    const damaged = Buffer.from(png);
    damaged[damaged.length - 1] ^= 1;
    expect(() => validateArtistImage(damaged, 'image/png')).toThrow();
    expect(() =>
      validateArtistImage(Buffer.from('<svg/>'), 'image/svg+xml'),
    ).toThrow();
    expect(() =>
      validateArtistImage(Buffer.from('not a png'), 'image/png'),
    ).toThrow();
    expect(() =>
      validateArtistImage(Buffer.alloc(2097153), 'image/png'),
    ).toThrow();
    expect(() => validateArtistImage(png, 'image/jpeg')).toThrow();
  });
});
