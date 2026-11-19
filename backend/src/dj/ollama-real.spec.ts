import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { writeFile } from 'node:fs/promises';
import { OllamaAdapter } from './ollama.adapter.js';
import { emptyConstraints } from './dj.types.js';
import { genreKey } from './intent.js';
// Only enable after verifying /api/show identifies LFM2.5 1.2B Instruct Q4_K_M.
// These tests are deliberately separate from fake-adapter and PostgreSQL tests.
describe.skipIf(process.env.DJ_OLLAMA_TEST !== '1')(
  'CU13 inferencia REAL Liquid AI local',
  () => {
    const adapter = new OllamaAdapter();
    const originalFetch = globalThis.fetch;
    const observations: unknown[] = [];
    beforeAll(() => {
      globalThis.fetch = async (input, init) => {
        const start = performance.now();
        const response = await originalFetch(input, init);
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        if (url.endsWith('/api/chat')) {
          const data = await response.clone().json();
          const body = JSON.parse(
            typeof init?.body === 'string' ? init.body : '{}',
          );
          observations.push({
            request: body.messages.at(-1).content,
            elapsedMs: Math.round(performance.now() - start),
            content: data.message?.content,
            promptTokens: data.prompt_eval_count,
            outputTokens: data.eval_count,
            loadMs: data.load_duration / 1e6,
          });
        }
        return response;
      };
    });
    afterAll(async () => {
      globalThis.fetch = originalFetch;
      await writeFile(
        '../docs/dj-ollama-inference-observations.json',
        JSON.stringify(observations, null, 2),
      );
    });
    it('modelo configurado está disponible localmente', async () => {
      expect((await adapter.status()).available).toBe(true);
    });
    it.each([
      ['Rock para entrenar', 'Rock', null],
      ['Pop sin electrónica', 'Pop', 'electronic'],
    ])(
      'interpreta español: %s',
      async (prompt, genre, excluded) => {
        const intent = await adapter.interpret(prompt, emptyConstraints);
        expect(intent.genres?.map(genreKey)).toContain(genreKey(genre!));
        if (excluded)
          expect(intent.excludedGenres?.map(genreKey)).toContain(excluded);
        expect(intent.unsupported).toEqual([]);
        expect(intent.action).toBe('select');
        expect(intent.mood).toBeNull();
        expect(intent.favorites).toBeNull();
        expect(intent.count).toBeNull();
      },
      95000,
    );
    it('interpreta relajante sin inventar canciones ni metadatos', async () => {
      const intent = await adapter.interpret(
        'Quiero algo relajante',
        emptyConstraints,
      );
      expect(intent.mood).toBe('calm');
      expect(intent.genres).toBeNull();
      expect(intent.favorites).toBeNull();
    }, 95000);
    it('solicita afinidad con favoritas', async () => {
      const intent = await adapter.interpret(
        'Canciones parecidas a mis favoritas',
        emptyConstraints,
      );
      expect(intent.favorites).toBe(true);
      expect(intent.genres).toBeNull();
      expect(intent.mood).toBeNull();
    }, 95000);
    it('agregar no borra exclusiones previas', async () => {
      const intent = await adapter.interpret('Agrega cinco canciones', {
        ...emptyConstraints,
        genres: ['Rock'],
        excludedGenres: ['Electrónica'],
      });
      expect(intent.action).toBe('add');
      expect(intent.count).toBe(5);
      expect(intent.excludedGenres).toBeNull();
      expect(intent.removeExcludedGenres).toBeNull();
      expect(intent.genres).toBeNull();
      expect(intent.mood).toBeNull();
      expect(intent.favorites).toBeNull();
    }, 95000);
  },
);
