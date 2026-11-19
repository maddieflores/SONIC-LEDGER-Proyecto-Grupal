import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { EntityManager } from 'typeorm';
import { stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Playlist } from './playlist.entity.js';
import { PlaylistTrack } from './playlist-track.entity.js';
import { FavoriteTrack } from './favorite-track.entity.js';
import { Cancion, CancionEstado } from '../musica/cancion.entity.js';
import { AudiusService } from '../integrations/audius/audius.service.js';
import type {
  AddTrackDto,
  CreatePlaylistDto,
  FavoriteDto,
  UpdatePlaylistDto,
} from './library.dto.js';

export interface ResolvedTrack {
  id: string;
  source: 'LOCAL' | 'AUDIUS';
  titulo: string;
  artista: { id: string; nombre: string };
  genero: { id: string; nombre: string } | null;
  duracionSegundos: number | null;
  descripcion: string;
  coverUrl: string | null;
  playable: boolean;
  position?: number;
  addedAt?: Date;
}

@Injectable()
export class LibraryService {
  private async djLocalPlayable(song: Cancion) {
    if (song.estado !== CancionEstado.PUBLICADO) return false;
    const prefix = '/api/auth/artist-songs/' + song.id + '/media/audio/';
    if (!song.archivoAudioUrl?.startsWith(prefix)) return false;
    const name = song.archivoAudioUrl.slice(prefix.length);
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.wav$/.test(name)) return false;
    try { const info = await stat(join(resolve(process.cwd(), 'uploads', 'songs'), name)); return info.isFile() && info.size > 0; }
    catch { return false; }
  }
  constructor(
    @InjectRepository(Playlist)
    private readonly playlistRepo: Repository<Playlist>,
    @InjectRepository(PlaylistTrack)
    private readonly trackRepo: Repository<PlaylistTrack>,
    @InjectRepository(FavoriteTrack)
    private readonly favoriteRepo: Repository<FavoriteTrack>,
    @InjectRepository(Cancion)
    private readonly songRepo: Repository<Cancion>,
    private readonly audiusService: AudiusService,
  ) {}

  private determineSource(trackId: string, explicitSource?: 'LOCAL' | 'AUDIUS'): 'LOCAL' | 'AUDIUS' {
    if (explicitSource) return explicitSource;
    if (trackId.startsWith('audius:')) return 'AUDIUS';
    return 'LOCAL';
  }

  /**
   * Resuelve metadatos para una lista de pistas heterogéneas (LOCAL y AUDIUS).
   */
  async resolveTracks(
    items: { trackId: string; source: 'LOCAL' | 'AUDIUS'; position?: number; addedAt?: Date }[],
    strict = false,
  ): Promise<ResolvedTrack[]> {
    const localIds = items.filter((i) => i.source === 'LOCAL').map((i) => i.trackId);

    // Cargar canciones locales en lote
    const localSongs = localIds.length
      ? await this.songRepo.find({
          where: { id: In(localIds) },
          relations: { artista: true, genero: true },
        })
      : [];
    const localMap = new Map(localSongs.map((s) => [s.id, s]));

    // Resolver cada pista manteniendo el orden original
    const resolved: ResolvedTrack[] = [];
    for (const item of items) {
      if (item.source === 'LOCAL') {
        const song = localMap.get(item.trackId);
        if (song) {
          resolved.push({
            id: song.id,
            source: 'LOCAL',
            titulo: song.titulo,
            artista: {
              id: song.artistaId,
              nombre: song.artista?.nombreArtistico || 'Artista',
            },
            genero: song.genero ? { id: song.genero.id, nombre: song.genero.nombre } : null,
            duracionSegundos: song.duracionSegundos,
            descripcion: song.descripcion || '',
            coverUrl: song.portadaUrl ? `/api/auth/catalog/${song.id}/cover` : null,
            playable: strict ? await this.djLocalPlayable(song) : song.estado === CancionEstado.PUBLICADO && Boolean(song.archivoAudioUrl),
            position: item.position,
            addedAt: item.addedAt,
          });
        } else {
          // Pista eliminada o no encontrada
          resolved.push({
            id: item.trackId,
            source: 'LOCAL',
            titulo: 'Canción no disponible',
            artista: { id: '', nombre: 'Desconocido' },
            genero: null,
            duracionSegundos: 0,
            descripcion: '',
            coverUrl: null,
            playable: false,
            position: item.position,
            addedAt: item.addedAt,
          });
        }
      } else {
        // Pista de Audius
        try {
          const rawId = item.trackId.replace(/^audius:/, '');
          const audiusTrack = await this.audiusService.getTrackById(rawId);
          resolved.push({
            id: audiusTrack.id,
            source: 'AUDIUS',
            titulo: audiusTrack.title || 'Pista de Audius',
            artista: {
              id: audiusTrack.artist.id,
              nombre: audiusTrack.artist.name || 'Artista Audius',
            },
            genero: audiusTrack.genre ? { id: audiusTrack.genre, nombre: audiusTrack.genre } : null,
            duracionSegundos: audiusTrack.durationSeconds || 0,
            descripcion: '',
            coverUrl: audiusTrack.artworkUrl,
            playable: audiusTrack.isPlayable,
            position: item.position,
            addedAt: item.addedAt,
          });
        } catch {
          // Fallback resiliente si Audius no responde
          resolved.push({
            id: item.trackId.startsWith('audius:') ? item.trackId : `audius:${item.trackId}`,
            source: 'AUDIUS',
            titulo: 'Pista de Audius',
            artista: { id: '', nombre: 'Audius' },
            genero: null,
            duracionSegundos: 0,
            descripcion: '',
            coverUrl: null,
            playable: !strict,
            position: item.position,
            addedAt: item.addedAt,
          });
        }
      }
    }

    return resolved;
  }

  // ==========================================
  // PLAYLISTS (CU09)
  // ==========================================

  async listPlaylists(userId: string) {
    const playlists = await this.playlistRepo.find({
      where: { usuarioId: userId },
      order: { updatedAt: 'DESC' },
      relations: { tracks: true },
    });

    return playlists.map((p) => {
      const sorted = (p.tracks || []).slice().sort((a, b) => a.posicion - b.posicion);
      return {
        id: p.id,
        nombre: p.nombre,
        descripcion: p.descripcion,
        trackCount: p.tracks?.length || 0,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        firstTrackId: sorted[0]?.trackId || null,
        firstTrackSource: sorted[0]?.source || null,
      };
    });
  }

  async getPlaylist(userId: string, playlistId: string) {
    const playlist = await this.playlistRepo.findOne({
      where: { id: playlistId, usuarioId: userId },
      relations: { tracks: true },
    });

    if (!playlist) {
      throw new NotFoundException('Playlist no encontrada o no pertenece a tu cuenta');
    }

    const sortedTracks = (playlist.tracks || []).slice().sort((a, b) => a.posicion - b.posicion);
    const resolved = await this.resolveTracks(
      sortedTracks.map((t) => ({
        trackId: t.trackId,
        source: t.source,
        position: t.posicion,
        addedAt: t.addedAt,
      })),
    );

    return {
      id: playlist.id,
      nombre: playlist.nombre,
      descripcion: playlist.descripcion,
      trackCount: resolved.length,
      createdAt: playlist.createdAt,
      updatedAt: playlist.updatedAt,
      tracks: resolved,
    };
  }

  async createPlaylist(userId: string, dto: CreatePlaylistDto) {
    const playlist = this.playlistRepo.create({
      usuarioId: userId,
      nombre: dto.nombre,
      descripcion: dto.descripcion ?? '',
    });
    const saved = await this.playlistRepo.save(playlist);
    return this.getPlaylist(userId, saved.id);
  }

  /** CU09: atomic snapshot used by DJ inside its locked session transaction. */
  async createDjPlaylist(manager: EntityManager, userId: string, nombre: string, tracks: { id: string; source?: 'LOCAL' | 'AUDIUS' }[]) {
    const playlist = await manager.save(Playlist, manager.create(Playlist, { usuarioId: userId, nombre, descripcion: 'Sesión DJ Sonic Ledger' }));
    await manager.save(PlaylistTrack, tracks.map((track, i) => manager.create(PlaylistTrack, {
      playlistId: playlist.id, trackId: track.id, source: track.source || 'LOCAL', posicion: i + 1,
    })));
    return playlist.id;
  }

  async updatePlaylist(userId: string, playlistId: string, dto: UpdatePlaylistDto) {
    const playlist = await this.playlistRepo.findOneBy({ id: playlistId, usuarioId: userId });
    if (!playlist) {
      throw new NotFoundException('Playlist no encontrada');
    }

    if (dto.nombre !== undefined) playlist.nombre = dto.nombre;
    if (dto.descripcion !== undefined) playlist.descripcion = dto.descripcion;

    await this.playlistRepo.save(playlist);
    return this.getPlaylist(userId, playlistId);
  }

  async deletePlaylist(userId: string, playlistId: string) {
    const playlist = await this.playlistRepo.findOneBy({ id: playlistId, usuarioId: userId });
    if (!playlist) {
      throw new NotFoundException('Playlist no encontrada');
    }

    await this.playlistRepo.remove(playlist);
    return { deleted: true, id: playlistId };
  }

  async addTrackToPlaylist(userId: string, playlistId: string, dto: AddTrackDto) {
    const playlist = await this.playlistRepo.findOne({
      where: { id: playlistId, usuarioId: userId },
      relations: { tracks: true },
    });
    if (!playlist) {
      throw new NotFoundException('Playlist no encontrada');
    }

    const source = this.determineSource(dto.trackId, dto.source);
    const exists = playlist.tracks.some((t) => t.trackId === dto.trackId);
    if (exists) {
      throw new BadRequestException('La canción ya se encuentra en la playlist');
    }

    const nextPos = playlist.tracks.reduce((max, t) => Math.max(max, t.posicion), 0) + 1;

    const newTrack = this.trackRepo.create({
      playlistId: playlist.id,
      trackId: dto.trackId,
      source,
      posicion: nextPos,
    });
    await this.trackRepo.save(newTrack);

    playlist.updatedAt = new Date();
    await this.playlistRepo.save(playlist);

    return this.getPlaylist(userId, playlistId);
  }

  async removeTrackFromPlaylist(userId: string, playlistId: string, trackId: string) {
    const playlist = await this.playlistRepo.findOne({
      where: { id: playlistId, usuarioId: userId },
      relations: { tracks: true },
    });
    if (!playlist) {
      throw new NotFoundException('Playlist no encontrada');
    }

    const track = playlist.tracks.find((t) => t.trackId === trackId);
    if (!track) {
      throw new NotFoundException('La canción no se encuentra en esta playlist');
    }

    await this.trackRepo.remove(track);

    // Reordenar posiciones consecutivas
    const remaining = playlist.tracks
      .filter((t) => t.trackId !== trackId)
      .sort((a, b) => a.posicion - b.posicion);

    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].posicion !== i + 1) {
        remaining[i].posicion = i + 1;
        await this.trackRepo.save(remaining[i]);
      }
    }

    playlist.updatedAt = new Date();
    await this.playlistRepo.save(playlist);

    return this.getPlaylist(userId, playlistId);
  }

  async reorderPlaylistTracks(userId: string, playlistId: string, trackIds: string[]) {
    const playlist = await this.playlistRepo.findOne({
      where: { id: playlistId, usuarioId: userId },
      relations: { tracks: true },
    });
    if (!playlist) {
      throw new NotFoundException('Playlist no encontrada');
    }

    const trackMap = new Map(playlist.tracks.map((t) => [t.trackId, t]));
    for (let i = 0; i < trackIds.length; i++) {
      const track = trackMap.get(trackIds[i]);
      if (track) {
        track.posicion = i + 1;
        await this.trackRepo.save(track);
      }
    }

    playlist.updatedAt = new Date();
    await this.playlistRepo.save(playlist);

    return this.getPlaylist(userId, playlistId);
  }

  // ==========================================
  // FAVORITOS (CU10)
  // ==========================================

  async listFavorites(userId: string) {
    const favorites = await this.favoriteRepo.find({
      where: { usuarioId: userId },
      order: { createdAt: 'DESC' },
    });

    return this.resolveTracks(
      favorites.map((f) => ({
        trackId: f.trackId,
        source: f.source,
        addedAt: f.createdAt,
      })),
    );
  }

  async addFavorite(userId: string, dto: FavoriteDto) {
    const source = this.determineSource(dto.trackId, dto.source);

    // Comprobar existencia para idempotencia
    let fav = await this.favoriteRepo.findOneBy({
      usuarioId: userId,
      trackId: dto.trackId,
    });

    if (!fav) {
      fav = this.favoriteRepo.create({
        usuarioId: userId,
        trackId: dto.trackId,
        source,
      });
      await this.favoriteRepo.save(fav);
    }

    return { favorited: true, trackId: dto.trackId };
  }

  async removeFavorite(userId: string, trackId: string) {
    await this.favoriteRepo.delete({ usuarioId: userId, trackId });
    return { favorited: false, trackId };
  }

  async getFavoriteIds(userId: string): Promise<string[]> {
    const favs = await this.favoriteRepo.find({
      where: { usuarioId: userId },
      select: { trackId: true },
    });
    return favs.map((f) => f.trackId);
  }

  async checkFavorites(userId: string, trackIds: string[]): Promise<Record<string, boolean>> {
    if (!trackIds.length) return {};
    const favs = await this.favoriteRepo.find({
      where: { usuarioId: userId, trackId: In(trackIds) },
      select: { trackId: true },
    });
    const set = new Set(favs.map((f) => f.trackId));
    const result: Record<string, boolean> = {};
    for (const id of trackIds) {
      result[id] = set.has(id);
    }
    return result;
  }
}
