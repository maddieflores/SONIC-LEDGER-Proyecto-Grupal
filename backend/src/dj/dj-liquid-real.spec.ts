import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { AppModule } from '../app.module.js';
import { Usuario } from '../auth/usuario.entity.js';
import { Genero } from '../musica/genero.entity.js';
import { LibraryService } from '../library/library.service.js';
import { Playlist } from '../library/playlist.entity.js';
import type { DjSession } from './dj.types.js';
import { genreKey } from './intent.js';

// Full real path: HTTP -> DJ -> Ollama/CU12 -> catalogue -> PostgreSQL/CU09.
// No provider overrides, no fake interpreter or fake catalogue.
describe.skipIf(process.env.DJ_LIQUID_INTEGRATION !== '1')(
  'CU13/CU14 Liquid AI + PostgreSQL + CU08/CU09 REALES',
  () => {
    let app: INestApplication;
    let ds: DataSource;
    let user: Usuario;
    let token: string;
    let session: DjSession;
    const observations: unknown[] = [];
    const root = '/api/auth/dj';
    beforeEach((context) => {
      if (!context.task.name.startsWith('genera ') && !session) context.skip();
    });
    async function post(path: string, body: object) {
      const start = performance.now();
      const response = await request(app.getHttpServer())
        .post(root + path)
        .auth(token, { type: 'bearer' })
        .send(body);
      observations.push({
        path,
        body,
        elapsedMs: Math.round(performance.now() - start),
        status: response.status,
        result: response.body,
      });
      return response;
    }
    beforeAll(async () => {
      const module = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
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
      const genre = await ds
        .getRepository(Genero)
        .findOneBy({ nombre: 'Electrónica' });
      const tag = randomUUID().slice(0, 8);
      const users = ds.getRepository(Usuario);
      user = await users.save(
        users.create({
          username: 'dj_real_' + tag,
          email: 'dj_real_' + tag + '@example.invalid',
          passwordHash: 'disabled-test-account',
          roles: [],
          musicPreferences: { genreIds: genre ? [genre.id] : [] },
        }),
      );
      token = await app.get(JwtService).signAsync({ sub: user.id, version: 0 });
    }, 30000);
    afterAll(async () => {
      await writeFile(
        '../docs/dj-liquid-integration-observations.json',
        JSON.stringify(observations, null, 2),
      );
      if (user && ds?.isInitialized)
        await ds.getRepository(Usuario).delete({ id: user.id });
      await app?.close();
    });
    it('genera una canción real según petición española', async () => {
      const response = await post('/sessions', {
        prompt: 'Quiero una canción',
      });
      expect(response.status).toBe(201);
      session = response.body;
      expect(session.tracks).toHaveLength(1);
      const resolved = await app.get(LibraryService).resolveTracks(
        session.tracks.map((t) => ({
          trackId: t.id,
          source: t.source || 'LOCAL',
        })),
        true,
      );
      expect(resolved.every((t) => t.playable)).toBe(true);
      expect(resolved.map((t) => t.id)).toEqual(
        session.tracks.map((t) => t.id),
      );
    }, 120000);
    it('agrega una canción con inferencia real y modifica la cola', async () => {
      const before = session.tracks.map((t) => t.id);
      const response = await post('/sessions/' + session.id + '/adjust', {
        version: session.version,
        action: 'instruction',
        prompt: 'Agrega una canción',
      });
      expect(response.status).toBe(201);
      session = response.body;
      expect(session.tracks.length).toBe(before.length + 1);
      expect(session.tracks.map((t) => t.id)).not.toEqual(before);
    }, 120000);
    it('excluye electrónica por instrucción española sin inventar canciones', async () => {
      const response = await post('/sessions/' + session.id + '/adjust', {
        version: session.version,
        action: 'instruction',
        prompt: 'Sin electrónica',
      });
      expect(response.status).toBe(201);
      session = response.body;
      expect(session.constraints.excludedGenres?.map(genreKey)).toContain(
        'electronic',
      );
      expect(session.tracks.length).toBeGreaterThan(0);
      expect(
        session.tracks.every(
          (t) => t.genero && genreKey(t.genero.nombre) !== 'electronic',
        ),
      ).toBe(true);
      const resolved = await app.get(LibraryService).resolveTracks(
        session.tracks.map((t) => ({
          trackId: t.id,
          source: t.source || 'LOCAL',
        })),
        true,
      );
      expect(resolved.every((t) => t.playable)).toBe(true);
    }, 120000);
    it('agregar conserva exclusiones incluso ante escasez', async () => {
      const previous = structuredClone(session);
      const response = await post('/sessions/' + session.id + '/adjust', {
        version: session.version,
        action: 'instruction',
        prompt: 'Agrega cinco canciones',
      });
      if (response.status === 201) session = response.body;
      else {
        expect(response.status).toBe(400);
        expect(response.body.message).toContain('No hay cambios');
      }
      const recovered = await request(app.getHttpServer())
        .get(root + '/sessions/' + session.id)
        .auth(token, { type: 'bearer' })
        .expect(200);
      expect(recovered.body.constraints.excludedGenres).toEqual(
        previous.constraints.excludedGenres,
      );
      expect(
        recovered.body.tracks.every(
          (t: DjSession['tracks'][number]) =>
            t.genero && genreKey(t.genero.nombre) !== 'electronic',
        ),
      ).toBe(true);
    }, 120000);
    it('más tranquilo/energético no inventan metadatos ni cambian la sesión', async () => {
      for (const prompt of ['Más tranquilo', 'Más energético']) {
        const response = await post('/sessions/' + session.id + '/adjust', {
          version: session.version,
          action: 'instruction',
          prompt,
        });
        expect(response.status).toBe(400);
        expect(response.body.message).toContain('metadatos confiables');
      }
      const recovered = await request(app.getHttpServer())
        .get(root + '/sessions/' + session.id)
        .auth(token, { type: 'bearer' })
        .expect(200);
      expect(recovered.body).toEqual(session);
    }, 120000);
    it('cola real sirve audio CU08 y guarda una sola playlist CU09 por reintentos', async () => {
      for (const track of session.tracks) {
        const path =
          track.source === 'AUDIUS'
            ? '/api/auth/integrations/audius/tracks/' +
              encodeURIComponent(track.id) +
              '/audio'
            : '/api/auth/catalog/' + track.id + '/audio';
        const audio = await request(app.getHttpServer())
          .get(path)
          .auth(token, { type: 'bearer' })
          .set('Range', 'bytes=0-43');
        expect([200, 206, 302]).toContain(audio.status);
      }
      const save = () =>
        post('/sessions/' + session.id + '/playlist', {
          version: session.version,
          nombre: 'DJ Liquid AI validación real',
        });
      const [a, b] = await Promise.all([save(), save()]);
      expect(a.status).toBe(201);
      expect(b.status).toBe(201);
      expect(a.body.playlistId).toBe(b.body.playlistId);
      expect(
        await ds.getRepository(Playlist).countBy({ usuarioId: user.id }),
      ).toBe(1);
      const playlist = await app
        .get(LibraryService)
        .getPlaylist(user.id, a.body.playlistId);
      expect(playlist.tracks.map((t) => [t.id, t.source])).toEqual(
        session.tracks.map((t) => [t.id, t.source]),
      );
      token = await app.get(JwtService).signAsync({ sub: user.id, version: 0 });
      const recovered = await request(app.getHttpServer())
        .get(root + '/sessions/' + session.id)
        .auth(token, { type: 'bearer' })
        .expect(200);
      expect(recovered.body.playlistId).toBe(playlist.id);
    }, 120000);
  },
);
