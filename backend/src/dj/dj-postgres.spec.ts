import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../app.module.js';
import { Usuario } from '../auth/usuario.entity.js';
import { Cancion, CancionEstado } from '../musica/cancion.entity.js';
import { LibraryService } from '../library/library.service.js';
import { Playlist } from '../library/playlist.entity.js';
import { DjSessionEntity } from './dj-session.entity.js';
import { DjInterpreter } from './ollama.adapter.js';
import { AudiusService } from '../integrations/audius/audius.service.js';
import type { DjSession } from './dj.types.js';

// Explicitly opt in; uses real PostgreSQL/auth/CU08/CU09, NEVER real inference.
describe.skipIf(process.env.DJ_DATABASE_TEST !== '1')(
  'CU14 PostgreSQL + HTTP reales, SIN Liquid AI',
  () => {
    let app: INestApplication;
    let ds: DataSource;
    let owner: Usuario;
    let other: Usuario;
    let token: string;
    let otherToken: string;
    let trackId: string;
    let session: DjSession;
    beforeAll(async () => {
      const module = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(DjInterpreter)
        .useValue({
          status: async () => ({
            available: false,
            message: 'Prueba sin modelo',
          }),
          interpret: async () => {
            throw new Error('No se permite inferencia en esta prueba');
          },
        })
        .overrideProvider(AudiusService)
        .useValue({
          getTrending: async () => ({ data: [] }),
          getTrackById: async () => {
            throw new Error('Audius desactivado en esta prueba');
          },
        })
        .compile();
      app = module.createNestApplication();
      app.setGlobalPrefix('api');
      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
        }),
      );
      await app.init();
      ds = app.get(DataSource);
      const users = ds.getRepository(Usuario);
      const tag = randomUUID().slice(0, 8);
      owner = await users.save(
        users.create({
          username: 'dj_test_' + tag,
          email: 'dj_' + tag + '@example.invalid',
          passwordHash: 'test-disabled',
          roles: [],
        }),
      );
      other = await users.save(
        users.create({
          username: 'dj_other_' + tag,
          email: 'dj_other_' + tag + '@example.invalid',
          passwordHash: 'test-disabled',
          roles: [],
        }),
      );
      const jwt = app.get(JwtService);
      token = await jwt.signAsync({ sub: owner.id, version: 0 });
      otherToken = await jwt.signAsync({ sub: other.id, version: 0 });
      const songs = await ds
        .getRepository(Cancion)
        .find({ where: { estado: CancionEstado.PUBLICADO }, take: 100 });
      const tracks = await app.get(LibraryService).resolveTracks(
        songs.map((t) => ({ trackId: t.id, source: 'LOCAL' })),
        true,
      );
      const available = tracks.find((t) => t.playable);
      if (!available)
        throw new Error(
          'La prueba necesita al menos una canción LOCAL publicada con archivo accesible.',
        );
      trackId = available.id;
    }, 30000);
    afterAll(async () => {
      if (ds?.isInitialized) {
        // Delete ONLY the two fixtures created by this suite; owner FKs cascade.
        if (owner) await ds.getRepository(Usuario).delete({ id: owner.id });
        if (other) await ds.getRepository(Usuario).delete({ id: other.id });
      }
      await app?.close();
    });
    it('requiere JWT y rechaza propiedades extra', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/recommendations/select-tracks')
        .auth(token, { type: 'bearer' })
        .send({ candidates: [] })
        .expect(404);
      await request(app.getHttpServer())
        .get('/api/auth/dj/sessions')
        .expect(401);
      await request(app.getHttpServer())
        .post('/api/auth/dj/manual')
        .auth(token, { type: 'bearer' })
        .send({ trackId, usuarioId: other.id })
        .expect(400);
    });
    it('crea sesión manual con canción real y reproduce bytes mediante CU08', async () => {
      const result = await request(app.getHttpServer())
        .post('/api/auth/dj/manual')
        .auth(token, { type: 'bearer' })
        .send({ trackId })
        .expect(201);
      session = result.body;
      expect(session.tracks[0].id).toBe(trackId);
      const audio = await request(app.getHttpServer())
        .get('/api/auth/catalog/' + trackId + '/audio')
        .auth(token, { type: 'bearer' })
        .set('Range', 'bytes=0-43')
        .expect(206);
      expect(audio.headers['content-range']).toMatch(/^bytes 0-43\//);
    });
    it('impide leer, modificar o guardar una sesión ajena', async () => {
      const path = '/api/auth/dj/sessions/' + session.id;
      await request(app.getHttpServer())
        .get(path)
        .auth(otherToken, { type: 'bearer' })
        .expect(404);
      await request(app.getHttpServer())
        .post(path + '/adjust')
        .auth(otherToken, { type: 'bearer' })
        .send({ action: 'remove', index: 0, version: 1 })
        .expect(404);
      await request(app.getHttpServer())
        .post(path + '/playlist')
        .auth(otherToken, { type: 'bearer' })
        .send({ nombre: 'Ajena', version: 1 })
        .expect(404);
    });
    it('reintentos concurrentes crean una sola playlist con propietario y orden', async () => {
      const save = () =>
        request(app.getHttpServer())
          .post('/api/auth/dj/sessions/' + session.id + '/playlist')
          .auth(token, { type: 'bearer' })
          .send({ nombre: 'DJ prueba PostgreSQL', version: 1 })
          .expect(201);
      const [a, b] = await Promise.all([save(), save()]);
      expect(a.body.playlistId).toBe(b.body.playlistId);
      expect(
        await ds.getRepository(Playlist).countBy({ usuarioId: owner.id }),
      ).toBe(1);
      const playlist = await app
        .get(LibraryService)
        .getPlaylist(owner.id, a.body.playlistId);
      expect(playlist.tracks.map((t) => [t.id, t.source, t.position])).toEqual([
        [trackId, 'LOCAL', 1],
      ]);
      await expect(
        app.get(LibraryService).getPlaylist(other.id, a.body.playlistId),
      ).rejects.toThrow('no encontrada');
      // Reload through a fresh repository query, without client session state.
      const persisted = await ds
        .getRepository(DjSessionEntity)
        .findOneByOrFail({ id: session.id, usuarioId: owner.id });
      expect(persisted.state.playlistId).toBe(a.body.playlistId);
      const newToken = await app
        .get(JwtService)
        .signAsync({ sub: owner.id, version: 0 });
      const recovered = await request(app.getHttpServer())
        .get('/api/auth/dj/sessions/' + session.id)
        .auth(newToken, { type: 'bearer' })
        .expect(200);
      expect(recovered.body.playlistId).toBe(a.body.playlistId);
    });
  },
);
