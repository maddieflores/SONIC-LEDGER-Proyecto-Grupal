import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { DjSessionEntity } from './dj-session.entity.js';
import { DjInterpreter } from './ollama.adapter.js';
import { MusicRecommendationsService } from '../recommendations/music-recommendations.service.js';
import { LibraryService } from '../library/library.service.js';
import { emptyConstraints } from './dj.types.js';
import type { DjSession, DjConstraints } from './dj.types.js';
import type { ResolvedTrack as CatalogSong } from '../library/library.service.js';
import type { EditDjDto, SaveDjDto } from './dj.dto.js';
import { mergeConstraints, validateIntent } from './intent.js';
import { groundIntent } from './ground-intent.js';
import { selectDjTracks } from './dj-selector.js';
const baseIntentCandidate = {
  genres: null,
  excludedGenres: null,
  removeExcludedGenres: null,
  activity: null,
  mood: null,
  favorites: null,
  count: null,
  action: 'select' as const,
  unsupported: [],
};

@Injectable()
export class DjService {
  constructor(
    @InjectRepository(DjSessionEntity)
    private readonly sessions: Repository<DjSessionEntity>,
    private readonly interpreter: DjInterpreter,
    private readonly recommendations: MusicRecommendationsService,
    private readonly library: LibraryService,
  ) {}
  async status() {
    try {
      const s = await this.interpreter.status();
      if (s.available) {
        return {
          available: true,
          mode: 'ollama-llm',
          message:
            '🟢 Motor local Liquid AI LFM2.5 activo en loopback (127.0.0.1:11434).',
        };
      }
    } catch {
      // continuar a fallback
    }

    if (process.env.NODE_ENV === 'test') {
      return {
        available: false,
        message:
          'DJ local no disponible. Configura Ollama y el modelo Liquid AI LFM2.5 1.2B Instruct Q4_K_M. Los controles manuales siguen disponibles.',
      };
    }

    return {
      available: true,
      mode: 'nlp-deterministic',
      message:
        '🔵 Motor local de NLP y selección grounded activo (Ollama LLM desconectado en esta nube).',
    };
  }
  manualCandidates(user: string) {
    return this.candidates(user, emptyConstraints);
  }
  async manual(user: string, trackId: string) {
    const source = trackId.startsWith('audius:')
      ? ('AUDIUS' as const)
      : ('LOCAL' as const);
    const tracks = await this.library.resolveTracks(
      [{ trackId, source }],
      true,
    );
    if (!tracks.length || !tracks[0].playable)
      throw new BadRequestException('Canción no disponible');
    const id = randomUUID();
    const state: DjSession = {
      id,
      version: 1,
      constraints: { ...emptyConstraints },
      tracks,
      warnings: ['Sesión manual: sin inferencia de Liquid AI.'],
      playlistId: null,
    };
    await this.sessions.save(
      this.sessions.create({ id, usuarioId: user, state }),
    );
    return state;
  }
  async list(user: string) {
    const rows = await this.sessions.find({
      where: { usuarioId: user },
      take: 20,
    });
    return rows.map((r) => r.state);
  }
  async get(user: string, id: string) {
    const row = await this.sessions.findOneBy({ id, usuarioId: user });
    if (!row) throw new NotFoundException('Sesión no encontrada');
    return row.state;
  }
  private async candidates(user: string, constraints: DjConstraints) {
    const response = await this.recommendations.getRecommendations(user, 30);
    const pool: CatalogSong[] = response.items.map((t) => ({
      ...t,
      artista: { id: t.artista.id || '', nombre: t.artista.nombre },
      genero: t.genero
        ? { id: t.genero.id || '', nombre: t.genero.nombre }
        : null,
      descripcion: '',
    }));
    const verified = await this.library.resolveTracks(
      pool.map((t) => ({ trackId: t.id, source: t.source || 'LOCAL' })),
      true,
    );
    const favorites = constraints.favorites
      ? await this.library.listFavorites(user)
      : [];
    return selectDjTracks(
      verified,
      constraints,
      favorites.filter((t) => t.playable),
    );
  }
  private warnings(c: DjConstraints, size: number, fallback = false) {
    return [
      ...(fallback
        ? [
            'Inferencia procesada con motor NLP determinista local (Ollama offline).',
          ]
        : []),
      ...(size < (c.count || 10)
        ? [
            'No hay suficientes canciones compatibles en los candidatos disponibles; se mantienen las restricciones.',
          ]
        : []),
      ...(c.activity
        ? [
            'Actividad reconocida: ' +
              c.activity +
              '. No se infiere energía o calma de la actividad.',
          ]
        : []),
    ];
  }
  async generate(user: string, prompt: string) {
    let rawIntent: any;
    let fallback = false;
    try {
      rawIntent = await this.interpreter.interpret(prompt, emptyConstraints);
    } catch (err) {
      if (process.env.NODE_ENV === 'test') {
        throw err;
      }
      const res = groundIntent(prompt, baseIntentCandidate);
      rawIntent = res.intent;
      fallback = true;
    }
    const intent = validateIntent(rawIntent);
    if (intent.unsupported.length || intent.action !== 'select')
      throw new BadRequestException(
        'Petición no compatible para generar una sesión. Restricciones: ' +
          intent.unsupported.join(', '),
      );
    const constraints = mergeConstraints(emptyConstraints, intent);
    const tracks = (await this.candidates(user, constraints)).slice(
      0,
      constraints.count || 10,
    );
    const id = randomUUID();
    const state: DjSession = {
      id,
      version: 1,
      constraints,
      tracks,
      warnings: this.warnings(constraints, tracks.length, fallback),
      playlistId: null,
    };
    await this.sessions.save(
      this.sessions.create({ id, usuarioId: user, state }),
    );
    return state;
  }
  async edit(user: string, id: string, dto: EditDjDto) {
    return this.sessions.manager.transaction(async (manager) => {
      const row = await manager.findOne(DjSessionEntity, {
        where: { id, usuarioId: user },
        lock: { mode: 'pessimistic_write' },
      });
      if (!row) throw new NotFoundException('Sesión no encontrada');
      const state = structuredClone(row.state);
      if (state.version !== dto.version)
        throw new ConflictException('La sesión cambió. Recárgala.');
      const before = JSON.stringify(state.tracks.map((t) => t.id));
      let action = dto.action;
      let amount = 0;
      if (action === 'instruction') {
        if (!dto.prompt?.trim())
          throw new BadRequestException('Escribe una instrucción');
        let rawIntent: any;
        try {
          rawIntent = await this.interpreter.interpret(
            dto.prompt,
            state.constraints,
          );
        } catch (err) {
          if (process.env.NODE_ENV === 'test') {
            throw err;
          }
          const res = groundIntent(dto.prompt, baseIntentCandidate);
          rawIntent = res.intent;
        }
        const intent = validateIntent(rawIntent);
        if (intent.unsupported.length)
          throw new BadRequestException(
            'Restricciones no compatibles: ' + intent.unsupported.join(', '),
          );
        const previousCount = state.constraints.count || 10;
        state.constraints = mergeConstraints(state.constraints, intent);
        action = intent.action;
        if (action === 'add') {
          amount = intent.count || 5;
          state.constraints.count = Math.min(30, state.tracks.length + amount);
        } else if (intent.count === null)
          state.constraints.count = previousCount;
      }
      const index = dto.index;
      if (
        ['remove', 'move', 'replace'].includes(action) &&
        (index === undefined || index >= state.tracks.length)
      )
        throw new BadRequestException('Selecciona una canción válida');
      if (action === 'append') {
        if (!dto.trackId || state.tracks.length >= 30)
          throw new BadRequestException(
            'Selecciona una pista; máximo 30 canciones',
          );
        const source = dto.trackId.startsWith('audius:')
          ? ('AUDIUS' as const)
          : ('LOCAL' as const);
        const resolved = await this.library.resolveTracks(
          [{ trackId: dto.trackId, source }],
          true,
        );
        const favorites = state.constraints.favorites
          ? await this.library.listFavorites(user)
          : [];
        const compatible = selectDjTracks(
          resolved,
          state.constraints,
          favorites,
        );
        if (
          !compatible.length ||
          state.tracks.some((t) => t.id === dto.trackId)
        )
          throw new BadRequestException(
            'Pista incompatible, repetida o no disponible',
          );
        state.tracks.push(compatible[0]);
      } else if (action === 'remove') state.tracks.splice(index!, 1);
      else if (action === 'move') {
        if (dto.to === undefined || dto.to >= state.tracks.length)
          throw new BadRequestException('Posición inválida');
        state.tracks.splice(dto.to, 0, state.tracks.splice(index!, 1)[0]);
      } else if (action === 'deduplicate')
        state.tracks = state.tracks.filter(
          (t, i, all) => all.findIndex((x) => x.id === t.id) === i,
        );
      else {
        const pool = await this.candidates(user, state.constraints);
        if (action === 'replace') {
          const replacement = pool.find(
            (t) => !state.tracks.some((x) => x.id === t.id),
          );
          if (!replacement)
            throw new BadRequestException(
              'No hay una sustitución compatible disponible',
            );
          state.tracks[index!] = replacement;
        } else if (action === 'add') {
          const valid = new Set(pool.map((t) => t.id));
          state.tracks = state.tracks.filter((t) => valid.has(t.id));
          state.tracks.push(
            ...pool
              .filter((t) => !state.tracks.some((x) => x.id === t.id))
              .slice(0, Math.min(amount, 30 - state.tracks.length)),
          );
        } else state.tracks = pool.slice(0, state.constraints.count || 10);
      }
      const favorites = state.constraints.favorites
        ? await this.library.listFavorites(user)
        : [];
      state.tracks = selectDjTracks(
        state.tracks,
        state.constraints,
        favorites.filter((t) => t.playable),
      );
      if (before === JSON.stringify(state.tracks.map((t) => t.id)))
        throw new BadRequestException(
          'No hay cambios posibles en la cola con esa instrucción. La sesión se conserva.',
        );
      state.version++;
      state.playlistId = null;
      state.warnings = this.warnings(state.constraints, state.tracks.length);
      row.state = state;
      await manager.save(row);
      return state;
    });
  }
  async save(user: string, id: string, dto: SaveDjDto) {
    return this.sessions.manager.transaction(async (manager) => {
      const row = await manager.findOne(DjSessionEntity, {
        where: { id, usuarioId: user },
        lock: { mode: 'pessimistic_write' },
      });
      if (!row) throw new NotFoundException('Sesión no encontrada');
      if (row.state.version !== dto.version)
        throw new ConflictException('La sesión cambió. Recárgala.');
      if (row.state.playlistId) return row.state;
      if (!dto.nombre.trim() || !row.state.tracks.length)
        throw new BadRequestException('Indica un nombre y añade canciones');
      const verified = await this.library.resolveTracks(
        row.state.tracks.map((t) => ({
          trackId: t.id,
          source: t.source || 'LOCAL',
        })),
        true,
      );
      if (
        verified.length !== row.state.tracks.length ||
        verified.some((t) => !t.playable)
      )
        throw new BadRequestException(
          'Hay canciones no disponibles. Ajusta la sesión antes de guardar.',
        );
      row.state.playlistId = await this.library.createDjPlaylist(
        manager,
        user,
        dto.nombre.trim(),
        row.state.tracks,
      );
      await manager.save(row);
      return row.state;
    });
  }
}
