import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { validateIntent, mergeConstraints, genreKey } from './intent.js';
import { selectDjTracks } from './dj-selector.js';
import { groundIntent } from './ground-intent.js';
import { emptyConstraints } from './dj.types.js';
import type { DjIntent } from './dj.types.js';
import { OllamaAdapter, DjInterpreter } from './ollama.adapter.js';
import { DjService } from './dj.service.js';
import { DjSessionEntity } from './dj-session.entity.js';
import type { Repository } from 'typeorm';
import type { MusicRecommendationsService } from '../recommendations/music-recommendations.service.js';
import type {
  LibraryService,
  ResolvedTrack,
} from '../library/library.service.js';
const patch = (p: Partial<DjIntent> = {}): DjIntent => ({
  genres: null,
  excludedGenres: null,
  removeExcludedGenres: null,
  activity: null,
  mood: null,
  favorites: null,
  count: null,
  action: 'select',
  unsupported: [],
  ...p,
});
const song = (
  id: string,
  genre: string | null = 'Rock',
  source: 'LOCAL' | 'AUDIUS' = 'LOCAL',
): ResolvedTrack => ({
  id,
  source,
  titulo: id,
  artista: { id: 'artist-' + id, nombre: 'Artista' },
  genero: genre ? { id: genre, nombre: genre } : null,
  duracionSegundos: 180,
  descripcion: '',
  coverUrl: null,
  playable: true,
});
describe('CU13/CU14 — adaptador FALSO y selección técnica (no valida Liquid AI)', () => {
  let rows: Map<string, DjSessionEntity>;
  let service: DjService;
  let pool: ResolvedTrack[];
  let interpreter: {
    interpret: Mock<DjInterpreter['interpret']>;
    status: Mock<DjInterpreter['status']>;
  };
  let library: {
    resolveTracks: ReturnType<typeof vi.fn>;
    listFavorites: ReturnType<typeof vi.fn>;
    createDjPlaylist: ReturnType<typeof vi.fn>;
  };
  beforeEach(() => {
    rows = new Map();
    pool = [
      song('r1'),
      song('r2'),
      song('r3'),
      song('p1', 'Pop'),
      song('audius:e1', 'Electronic', 'AUDIUS'),
      song('unknown', null),
      { ...song('broken'), playable: false },
    ];
    const manager = {
      findOne: vi.fn(async (_entity, opts) => {
        const row = rows.get(opts.where.id);
        return row?.usuarioId === opts.where.usuarioId
          ? structuredClone(row)
          : null;
      }),
      save: vi.fn(async (row: DjSessionEntity) => {
        rows.set(row.id, structuredClone(row));
        return row;
      }),
    };
    const repository = {
      create: (r: DjSessionEntity) => r,
      save: manager.save,
      findOneBy: (where: { id: string; usuarioId: string }) =>
        manager.findOne(DjSessionEntity, { where }),
      find: async ({ where }: { where: { usuarioId: string } }) =>
        [...rows.values()].filter((r) => r.usuarioId === where.usuarioId),
      manager: {
        transaction: async (fn: (m: typeof manager) => unknown) => fn(manager),
      },
    };
    interpreter = {
      interpret: vi.fn(async () => patch({ count: 2 })),
      status: vi.fn(async () => ({ available: false, message: 'Falso' })),
    };
    library = {
      resolveTracks: vi.fn(async (items: { trackId: string }[]) =>
        items.map(
          (i) =>
            pool.find((t) => t.id === i.trackId) || {
              ...song(i.trackId),
              playable: false,
            },
        ),
      ),
      listFavorites: vi.fn(async () => [song('favorite')]),
      createDjPlaylist: vi.fn(async () => 'playlist-one'),
    };
    service = new DjService(
      repository as unknown as Repository<DjSessionEntity>,
      interpreter,
      {
        getRecommendations: async () => ({ items: pool }),
      } as unknown as MusicRecommendationsService,
      library as unknown as LibraryService,
    );
  });
  it('genera solo canciones existentes, reproducibles y con contrato CU08', async () => {
    interpreter.interpret.mockResolvedValue(
      patch({ genres: ['Rock'], count: 2 }),
    );
    const state = await service.generate('alice', 'Rock');
    expect(state.tracks.map((t) => t.id)).toEqual(['r1', 'r2']);
    expect(
      state.tracks.every((t) => t.playable && t.artista.id && t.source),
    ).toBe(true);
    expect(await service.get('alice', state.id)).toEqual(state);
  });
  it('excluye electrónica en español y metadatos desconocidos', () => {
    const selected = selectDjTracks(pool, {
      ...emptyConstraints,
      excludedGenres: ['Electrónica'],
    });
    expect(selected.map((t) => t.id)).not.toContain('audius:e1');
    expect(selected.map((t) => t.id)).not.toContain('unknown');
  });
  it('conserva restricciones y acumula exclusiones', () => {
    const c = mergeConstraints(
      { ...emptyConstraints, genres: ['Rock'], excludedGenres: ['Jazz'] },
      patch({ excludedGenres: ['Electrónica'] }),
    );
    expect(c.genres).toEqual(['Rock']);
    expect(c.excludedGenres).toEqual(['Jazz', 'Electrónica']);
    expect(
      mergeConstraints(c, patch({ excludedGenres: [] })).excludedGenres,
    ).toEqual([]);
    expect(
      mergeConstraints(c, patch({ removeExcludedGenres: ['Electrónica'] }))
        .excludedGenres,
    ).toEqual(['Jazz']);
  });
  it.each(['calm', 'energetic'] as const)(
    'rechaza %s sin inventar metadatos',
    (mood) => {
      expect(() => selectDjTracks(pool, { ...emptyConstraints, mood })).toThrow(
        'metadatos confiables',
      );
    },
  );
  it('afinidad con favoritas usa únicamente artistas o géneros reales', () => {
    expect(
      selectDjTracks(pool, { ...emptyConstraints, favorites: true }, [
        song('favorite'),
      ]).map((t) => t.id),
    ).toEqual(['r1', 'r2', 'r3']);
    expect(
      selectDjTracks(pool, { ...emptyConstraints, favorites: true }, []),
    ).toEqual([]);
  });
  it('indica escasez sin relajar filtros', async () => {
    interpreter.interpret.mockResolvedValue(
      patch({ genres: ['Jazz'], count: 10 }),
    );
    const state = await service.generate('alice', 'Jazz');
    expect(state.tracks).toEqual([]);
    expect(state.warnings.join()).toContain('suficientes');
  });
  it.each([
    {},
    { ...patch(), surprise: 1 },
    patch({ count: 99 }),
    patch({ genres: [''] }),
    patch({ action: 'hack' as 'select' }),
  ])('rechaza interpretación con esquema inválido %#', (value) => {
    expect(() => validateIntent(value)).toThrow('inválida');
  });
  it('no persiste restricciones no representables', async () => {
    interpreter.interpret.mockResolvedValue(
      patch({ unsupported: ['sin letras explícitas'] }),
    );
    await expect(
      service.generate('alice', 'sin letras explícitas'),
    ).rejects.toThrow('Restricciones');
    expect(rows.size).toBe(0);
  });
  it('quitar, reordenar y sustituir modifican la cola sin usar modelo', async () => {
    const s = await service.generate('alice', 'música');
    interpreter.interpret.mockRejectedValue(new Error('offline'));
    const moved = await service.edit('alice', s.id, {
      action: 'move',
      version: 1,
      index: 0,
      to: 1,
    });
    expect(moved.tracks.map((t) => t.id)).toEqual(['r2', 'r1']);
    const replaced = await service.edit('alice', s.id, {
      action: 'replace',
      version: 2,
      index: 0,
    });
    expect(replaced.tracks.map((t) => t.id)).toEqual(['r3', 'r1']);
    const removed = await service.edit('alice', s.id, {
      action: 'remove',
      version: 3,
      index: 1,
    });
    expect(removed.tracks.map((t) => t.id)).toEqual(['r3']);
  });
  it('agrega canciones con instrucción falsa y conserva exclusiones', async () => {
    interpreter.interpret.mockResolvedValue(
      patch({ genres: ['Rock'], excludedGenres: ['Electrónica'], count: 1 }),
    );
    const s = await service.generate('alice', 'Rock sin electrónica');
    interpreter.interpret.mockResolvedValue(patch({ action: 'add', count: 2 }));
    const next = await service.edit('alice', s.id, {
      action: 'instruction',
      prompt: 'Agrega dos',
      version: 1,
    });
    expect(next.tracks.map((t) => t.id)).toEqual(['r1', 'r2', 'r3']);
    expect(next.constraints.excludedGenres).toEqual(['Electrónica']);
  });
  it('elimina repetidas y rechaza ajustes sin cambio real', async () => {
    const s = await service.generate('alice', 'música');
    rows.get(s.id)!.state.tracks.push(s.tracks[0]);
    const next = await service.edit('alice', s.id, {
      action: 'deduplicate',
      version: 1,
    });
    expect(next.tracks).toHaveLength(2);
    await expect(
      service.edit('alice', s.id, { action: 'deduplicate', version: 2 }),
    ).rejects.toThrow('No hay cambios');
  });
  it('sesiones manuales funcionan offline y validan disponibilidad', async () => {
    interpreter.interpret.mockRejectedValue(new Error('offline'));
    const s = await service.manual('alice', 'r1');
    const next = await service.edit('alice', s.id, {
      action: 'append',
      trackId: 'audius:e1',
      version: 1,
    });
    expect(next.tracks.map((t) => t.source)).toEqual(['LOCAL', 'AUDIUS']);
    await expect(service.manual('alice', 'invento')).rejects.toThrow(
      'no disponible',
    );
  });
  it('append manual no permite evadir las restricciones', async () => {
    interpreter.interpret.mockResolvedValue(
      patch({ genres: ['Rock'], count: 1 }),
    );
    const s = await service.generate('alice', 'rock');
    await expect(
      service.edit('alice', s.id, {
        action: 'append',
        trackId: 'p1',
        version: 1,
      }),
    ).rejects.toThrow('incompatible');
    expect((await service.get('alice', s.id)).tracks).toHaveLength(1);
  });
  it('reintentos de guardado reutilizan CU09 una sola vez y conservan orden/fuentes', async () => {
    const s = await service.manual('alice', 'audius:e1');
    const next = await service.edit('alice', s.id, {
      action: 'append',
      trackId: 'r1',
      version: 1,
    });
    const saved = await service.save('alice', s.id, {
      version: next.version,
      nombre: 'Entreno',
    });
    await service.save('alice', s.id, {
      version: next.version,
      nombre: 'Entreno',
    });
    expect(saved.playlistId).toBe('playlist-one');
    expect(library.createDjPlaylist).toHaveBeenCalledTimes(1);
    expect(library.createDjPlaylist.mock.calls[0].slice(1)).toEqual([
      'alice',
      'Entreno',
      next.tracks,
    ]);
  });
  it('rechaza lectura, ajuste y guardado de otro usuario', async () => {
    const s = await service.generate('alice', 'música');
    await expect(service.get('bob', s.id)).rejects.toThrow('no encontrada');
    await expect(
      service.edit('bob', s.id, { action: 'remove', index: 0, version: 1 }),
    ).rejects.toThrow('no encontrada');
    await expect(
      service.save('bob', s.id, { nombre: 'Ajena', version: 1 }),
    ).rejects.toThrow('no encontrada');
    expect(await service.list('bob')).toEqual([]);
  });
  it('rechaza versiones obsoletas e índices inválidos', async () => {
    const s = await service.generate('alice', 'música');
    await expect(
      service.edit('alice', s.id, { action: 'remove', index: 8, version: 1 }),
    ).rejects.toThrow('válida');
    await service.edit('alice', s.id, {
      action: 'remove',
      index: 0,
      version: 1,
    });
    await expect(
      service.edit('alice', s.id, { action: 'remove', index: 0, version: 1 }),
    ).rejects.toThrow('cambió');
  });
  it('error de inferencia conserva la sesión y rechazo de audio impide guardar', async () => {
    const s = await service.generate('alice', 'música');
    interpreter.interpret.mockRejectedValue(new Error('timeout'));
    await expect(
      service.edit('alice', s.id, {
        action: 'instruction',
        prompt: 'sin rock',
        version: 1,
      }),
    ).rejects.toThrow('timeout');
    expect(await service.get('alice', s.id)).toEqual(s);
    pool = pool.map((t) => ({ ...t, playable: false }));
    await expect(
      service.save('alice', s.id, { nombre: 'Test', version: 1 }),
    ).rejects.toThrow('no disponibles');
    expect(library.createDjPlaylist).not.toHaveBeenCalled();
  });
});
describe('Ollama HTTP simulado — NO inferencia real', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });
  beforeEach(() => {
    vi.spyOn(OllamaAdapter.prototype, 'verifyLocalModel').mockResolvedValue();
    vi.stubEnv('OLLAMA_MODEL', 'lfm-test');
    vi.stubEnv('OLLAMA_URL', 'http://127.0.0.1:11434');
  });
  it('envía esquema, contexto limitado y parche español', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            message: { content: JSON.stringify(patch({ genres: ['Rock'] })) },
          }),
        ),
    );
    vi.stubGlobal('fetch', fetcher);
    const result = await new OllamaAdapter().interpret(
      'Rock para entrenar',
      emptyConstraints,
    );
    expect(result.genres).toEqual(['Rock']);
    const body = JSON.parse(
      (fetcher.mock.calls as unknown as [string, RequestInit][])[0][1]
        .body as string,
    );
    expect(body.stream).toBe(false);
    expect(body.format.additionalProperties).toBe(false);
    expect(body.options.num_ctx).toBeLessThanOrEqual(4096);
    expect(body.messages[1].content).toContain('Rock para entrenar');
  });
  it.each([404, 500])('HTTP %s no genera inferencia falsa', async (status) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status })),
    );
    await expect(
      new OllamaAdapter().interpret('Rock', emptyConstraints),
    ).rejects.toThrow('no disponible');
  });
  it('rechaza JSON malformado', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ message: { content: '```no-json' } })),
      ),
    );
    await expect(
      new OllamaAdapter().interpret('Rock', emptyConstraints),
    ).rejects.toThrow('no disponible');
  });
  it('modelo ausente y URL externa desactivan el DJ sin hacer peticiones', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    vi.stubEnv('OLLAMA_MODEL', '');
    expect((await new OllamaAdapter().status()).available).toBe(false);
    vi.stubEnv('OLLAMA_MODEL', 'lfm-test');
    vi.stubEnv('OLLAMA_URL', 'https://example.com');
    await expect(
      new OllamaAdapter().interpret('Rock', emptyConstraints),
    ).rejects.toThrow('no disponible');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('modelo no instalado se comunica claramente', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ models: [] }))),
    );
    expect((await new OllamaAdapter().status()).available).toBe(false);
  });
  it('comprueba identidad y cuantización del único modelo permitido', async () => {
    vi.restoreAllMocks();
    const metadata = {
      details: { family: 'lfm2', quantization_level: 'Q4_K_M' },
      model_info: { 'general.name': 'LFM2.5-1.2B-Instruct' },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(metadata))),
    );
    await expect(
      new OllamaAdapter().verifyLocalModel(),
    ).resolves.toBeUndefined();
  });
  it('admite los metadatos reales de la etiqueta oficial sin general.name', async () => {
    vi.restoreAllMocks();
    vi.stubEnv('OLLAMA_MODEL', 'LiquidAI/lfm2.5-1.2b-instruct:q4_k_m');
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              details: {
                family: 'lfm2',
                parameter_size: '1.2B',
                quantization_level: 'Q4_K_M',
              },
              model_info: {
                'general.tags': ['liquid', 'lfm2.5'],
                'general.parameter_count': 1170340608,
              },
            }),
          ),
      ),
    );
    await expect(
      new OllamaAdapter().verifyLocalModel(),
    ).resolves.toBeUndefined();
  });
  it.each([
    { details: { family: 'llama', quantization_level: 'Q4_K_M' } },
    { details: { family: 'lfm2', quantization_level: 'Q8_0' } },
    {
      remote_model: 'remote',
      remote_host: 'https://ollama.com',
      details: { family: 'lfm2', quantization_level: 'Q4_K_M' },
    },
  ])('no carga modelos adicionales ni remotos %#', async (metadata) => {
    vi.restoreAllMocks();
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            ...metadata,
            model_info: { 'general.name': 'LFM2.5-1.2B-Instruct' },
          }),
        ),
    );
    vi.stubGlobal('fetch', fetcher);
    await expect(
      new OllamaAdapter().interpret('Rock', emptyConstraints),
    ).rejects.toThrow('no disponible');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect((fetcher.mock.calls as unknown as [string][])[0][0]).toContain(
      '/api/show',
    );
  });
  it('timeout aborta la petición y libera el turno', async () => {
    vi.stubEnv('OLLAMA_TIMEOUT_MS', '100');
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url, opts: RequestInit) =>
          new Promise((_resolve, reject) => {
            opts.signal?.addEventListener(
              'abort',
              () => reject(new Error('abort')),
              { once: true },
            );
          }),
      ),
    );
    const adapter = new OllamaAdapter();
    await expect(adapter.interpret('Rock', emptyConstraints)).rejects.toThrow(
      'no disponible',
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ message: { content: JSON.stringify(patch()) } }),
          ),
      ),
    );
    await expect(adapter.interpret('Pop', emptyConstraints)).resolves.toEqual(
      patch({ genres: ['Pop'] }),
    );
  });
});

describe('Validación de evidencia del DJ, separada del modelo', () => {
  it('conserva propuestas fundamentadas del modelo fuera del vocabulario local', () => {
    const checked = groundIntent('Bossa nova para conducir', patch({ genres: ['Bossa nova'], activity: 'conducir' }));
    expect(checked.intent.genres).toEqual(['Bossa nova']);
    expect(checked.intent.activity).toBe('conducir');
    expect(() => groundIntent('Bossa nova para conducir', patch())).toThrow('no está respaldada');
  });
  it('rechaza campos inventados y conserva la exclusión explícita', () => {
    const checked = groundIntent(
      'Pop sin electrónica',
      patch({
        genres: ['Pop', 'Sin Electrónica'],
        excludedGenres: [],
        activity: 'Pop sin electrónica',
        mood: 'calm',
        favorites: true,
        count: 10,
      }),
    );
    expect(checked.intent).toEqual(
      patch({ genres: ['Pop'], excludedGenres: ['Electrónica'] }),
    );
    expect(checked.correctedFields).toContain('excludedGenres');
  });
  it('agregar solo cambia acción/cantidad y el merge conserva filtros', () => {
    const checked = groundIntent(
      'Agrega cinco canciones',
      patch({
        action: 'add',
        count: 5,
        genres: ['Rock'],
        excludedGenres: [],
        mood: 'calm',
      }),
    );
    const next = mergeConstraints(
      { ...emptyConstraints, genres: ['Rock'], excludedGenres: ['Jazz'] },
      checked.intent,
    );
    expect(next.genres).toEqual(['Rock']);
    expect(next.excludedGenres).toEqual(['Jazz']);
    expect(checked.intent.genres).toBeNull();
    expect(checked.intent.excludedGenres).toBeNull();
  });
  it('solo una modificación expresa permite levantar exclusiones', () => {
    expect(
      groundIntent('Permite electrónica', patch()).intent.removeExcludedGenres,
    ).toEqual(['Electrónica']);
    expect(
      groundIntent('Rock', patch({ removeExcludedGenres: ['Jazz'] })).intent
        .removeExcludedGenres,
    ).toBeNull();
  });
  it('distingue actividad de estado/intensidad y respeta cantidades singulares', () => {
    expect(
      groundIntent('Rock para entrenar', patch({ mood: 'energetic' })).intent
        .mood,
    ).toBeNull();
    expect(groundIntent('Más tranquilo', patch()).intent.mood).toBe('calm');
    expect(groundIntent('Más tranquilo', patch()).intent.intensityChange).toBe(
      'lower',
    );
    expect(groundIntent('Más energético', patch()).intent.mood).toBe(
      'energetic',
    );
    expect(groundIntent('Más energético', patch()).intent.intensityChange).toBe(
      'higher',
    );
    expect(
      groundIntent('Quiero una canción', patch({ count: 10 })).intent.count,
    ).toBe(1);
  });
  it('no acepta JSON inválido ni interpreta sin modelo', () => {
    expect(() => groundIntent('Rock', {})).toThrow('inválida');
  });

  describe('Pruebas requeridas — Generación, Audius, streaming, autenticación y restricciones', () => {
    it('interpreta solicitud combinada con género, exclusión, actividad y mood', () => {
      const res = groundIntent(
        'Quiero rock energético para entrenar, sin música electrónica',
        patch({ action: 'select' }),
      );
      expect(res.intent.genres?.map(genreKey)).toContain('rock');
      expect(res.intent.excludedGenres?.map(genreKey)).toContain('electronic');
      expect(res.intent.activity).toBe('entrenar');
      expect(res.intent.mood).toBe('energetic');
    });

    it('selectDjTracks admite estado de ánimo cuando existen géneros concretos en restricciones', () => {
      const poolWithGenres = [
        song('s1', 'Rock'),
        song('s2', 'Electrónica'),
        song('s3', 'Pop'),
      ];
      const selected = selectDjTracks(poolWithGenres, {
        ...emptyConstraints,
        genres: ['Rock'],
        excludedGenres: ['Electrónica'],
        mood: 'energetic',
      });
      expect(selected.map((s) => s.id)).toEqual(['s1']);
    });

    it('rechaza pistas no reproducibles (error de streaming/playable)', () => {
      const unplayableSong: ResolvedTrack = {
        ...song('broken', 'Rock'),
        playable: false,
      };
      const selected = selectDjTracks([unplayableSong], {
        ...emptyConstraints,
        genres: ['Rock'],
      });
      expect(selected).toHaveLength(0);
    });

    it('maneja ausencia total de candidatos sin romper el flujo', () => {
      const selected = selectDjTracks([], {
        ...emptyConstraints,
        genres: ['Rock'],
      });
      expect(selected).toEqual([]);
    });

    it('integra candidatos externos de Audius identificados con prefijo o source', () => {
      const audiusTrack = song('audius:track123', 'Rock', 'AUDIUS');
      const selected = selectDjTracks([audiusTrack], {
        ...emptyConstraints,
        genres: ['Rock'],
      });
      expect(selected).toHaveLength(1);
      expect(selected[0].source).toBe('AUDIUS');
      expect(selected[0].id).toBe('audius:track123');
    });
  });
});
