import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type EntityManager } from 'typeorm';
import { mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Artista } from '../musica/artista.entity.js';
import { Cancion, CancionEstado } from '../musica/cancion.entity.js';
import { Genero } from '../musica/genero.entity.js';
import { Lanzamiento } from '../musica/lanzamiento.entity.js';
import type { SongDto, SongsQueryDto } from './songs.dto.js';
import {
  MAX_AUDIO_BYTES,
  validateSongCover,
  validateWav,
  type UploadedSongFile,
} from './song-files.js';
const mediaRoot = '/api/auth/artist-songs/';
@Injectable()
export class SongsService {
  private readonly directory = resolve(process.cwd(), 'uploads', 'songs');
  constructor(
    @InjectRepository(Cancion) private readonly songs: Repository<Cancion>,
    @InjectRepository(Artista) private readonly artists: Repository<Artista>,
    @InjectRepository(Genero) private readonly genres: Repository<Genero>,
    @InjectRepository(Lanzamiento)
    private readonly releases: Repository<Lanzamiento>,
  ) {}
  async artist(userId: string) {
    const artist = await this.artists.findOneBy({ usuarioId: userId });
    if (!artist)
      throw new ConflictException(
        'Completa primero tu perfil artístico en CU04.',
      );
    return artist;
  }
  async own(artistId: string, id: string, manager?: EntityManager) {
    const song = await (
      manager ? manager.getRepository(Cancion) : this.songs
    ).findOne({
      where: { id, artistaId: artistId },
      ...(manager ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
    if (!song) throw new NotFoundException('Canción no encontrada.');
    return song;
  }
  fileName(song: Cancion, kind: 'audio' | 'cover') {
    const reference = kind === 'audio' ? song.archivoAudioUrl : song.portadaUrl;
    const prefix = mediaRoot + song.id + '/media/' + kind + '/';
    if (!reference?.startsWith(prefix)) return null;
    const name = reference.slice(prefix.length);
    return /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.(wav|png|jpg)$/.test(
      name,
    ) && (kind === 'audio' ? name.endsWith('.wav') : !name.endsWith('.wav'))
      ? name
      : null;
  }
  dto(song: Cancion, artist: Artista) {
    return {
      id: song.id,
      titulo: song.titulo,
      descripcion: song.descripcion,
      generoId: song.generoId,
      genero: song.genero?.nombre ?? null,
      lanzamientoId: song.lanzamientoId,
      lanzamiento: song.lanzamiento?.titulo ?? null,
      artista: artist.nombreArtistico,
      duracionSegundos: song.duracionSegundos,
      estado: song.estado,
      createdAt: song.createdAt,
      updatedAt: song.updatedAt,
      audioUrl: this.fileName(song, 'audio') ? song.archivoAudioUrl : null,
      coverUrl: this.fileName(song, 'cover') ? song.portadaUrl : null,
    };
  }
  async detail(userId: string, id: string) {
    const artist = await this.artist(userId);
    const song = await this.songs.findOne({
      where: { id, artistaId: artist.id },
      relations: { genero: true, lanzamiento: true },
    });
    if (!song) throw new NotFoundException('Canción no encontrada.');
    return this.dto(song, artist);
  }
  async options(userId: string) {
    const artist = await this.artist(userId);
    const [genres, releases] = await Promise.all([
      this.genres.find({
        where: { activo: true },
        order: { nombre: 'ASC' },
        select: { id: true, nombre: true },
      }),
      this.releases.find({
        where: { artistaId: artist.id },
        order: { titulo: 'ASC' },
        select: { id: true, titulo: true },
      }),
    ]);
    return {
      artist: { nombreArtistico: artist.nombreArtistico },
      genres,
      releases,
      uploadsEnabled: process.env.NODE_ENV !== 'production',
    };
  }
  async relations(artistId: string, dto: SongDto, manager: EntityManager) {
    if (
      dto.generoId &&
      !(await manager
        .getRepository(Genero)
        .findOneBy({ id: dto.generoId, activo: true }))
    )
      throw new BadRequestException(
        'Selecciona un género activo del catálogo.',
      );
    if (
      dto.lanzamientoId &&
      !(await manager
        .getRepository(Lanzamiento)
        .findOneBy({ id: dto.lanzamientoId, artistaId: artistId }))
    )
      throw new BadRequestException(
        'El lanzamiento no existe o no pertenece a tu perfil.',
      );
  }
  async publication(song: Cancion, manager: EntityManager) {
    if (
      song.titulo.trim().length < 2 ||
      !song.generoId ||
      !(await manager
        .getRepository(Genero)
        .findOneBy({ id: song.generoId, activo: true })) ||
      !song.duracionSegundos ||
      !this.fileName(song, 'audio')
    )
      throw new BadRequestException(
        'Para publicar necesitas título, género activo y un audio WAV válido almacenado.',
      );
    try {
      const file = await stat(
        join(this.directory, this.fileName(song, 'audio')!),
      );
      if (!file.isFile() || file.size === 0 || file.size > MAX_AUDIO_BYTES)
        throw new Error();
    } catch {
      throw new BadRequestException(
        'El audio no está disponible en almacenamiento. Vuelve a cargarlo antes de publicar.',
      );
    }
  }
  async create(userId: string, dto: SongDto) {
    const artist = await this.artist(userId);
    const song = await this.songs.manager.transaction(async (manager) => {
      await this.relations(artist.id, dto, manager);
      return manager
        .getRepository(Cancion)
        .save(
          manager
            .getRepository(Cancion)
            .create({
              artistaId: artist.id,
              titulo: dto.titulo,
              descripcion: dto.descripcion,
              generoId: dto.generoId ?? null,
              lanzamientoId: dto.lanzamientoId ?? null,
              estado: CancionEstado.BORRADOR,
              archivoAudioUrl: null,
            }),
        );
    });
    return this.detail(userId, song.id);
  }
  async update(userId: string, id: string, dto: SongDto) {
    const artist = await this.artist(userId);
    await this.songs.manager.transaction(async (manager) => {
      const song = await this.own(artist.id, id, manager);
      await this.relations(artist.id, dto, manager);
      Object.assign(song, {
        titulo: dto.titulo,
        descripcion: dto.descripcion,
        generoId: dto.generoId ?? null,
        lanzamientoId: dto.lanzamientoId ?? null,
      });
      if (song.estado === CancionEstado.PUBLICADO)
        await this.publication(song, manager);
      await manager.getRepository(Cancion).save(song);
    });
    return this.detail(userId, id);
  }
  async state(userId: string, id: string, estado: CancionEstado) {
    const artist = await this.artist(userId);
    await this.songs.manager.transaction(async (manager) => {
      const song = await this.own(artist.id, id, manager);
      if (estado === CancionEstado.PUBLICADO) {
        if (
          song.lanzamientoId &&
          !(await manager
            .getRepository(Lanzamiento)
            .findOneBy({ id: song.lanzamientoId, artistaId: artist.id }))
        )
          throw new BadRequestException('Lanzamiento no válido.');
        await this.publication(song, manager);
      }
      song.estado = estado;
      await manager.getRepository(Cancion).save(song);
    });
    return this.detail(userId, id);
  }
  async list(userId: string, q: SongsQueryDto) {
    const artist = await this.artist(userId);
    const query = this.songs
      .createQueryBuilder('song')
      .leftJoinAndSelect('song.genero', 'genre')
      .leftJoinAndSelect('song.lanzamiento', 'release')
      .where('song.artistaId = :artistId', { artistId: artist.id });
    if (q.estado) query.andWhere('song.estado = :estado', { estado: q.estado });
    if (q.generoId)
      query.andWhere('song.generoId = :genreId', { genreId: q.generoId });
    if (q.q?.trim())
      query.andWhere('song.titulo ILIKE :search', {
        search: '%' + q.q.trim().replace(/[\\%_]/g, '\\$&') + '%',
      });
    query
      .orderBy(
        q.sort === 'title' ? 'song.titulo' : 'song.createdAt',
        q.sort === 'oldest' || q.sort === 'title' ? 'ASC' : 'DESC',
      )
      .addOrderBy('song.id', 'ASC')
      .skip((q.page - 1) * q.pageSize)
      .take(q.pageSize);
    const [items, total] = await query.getManyAndCount();
    return {
      items: items.map((s) => this.dto(s, artist)),
      total,
      page: q.page,
      pageSize: q.pageSize,
      totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
    };
  }
  async dashboard(userId: string) {
    const artist = await this.artist(userId);
    const [counts, releaseCount, recent] = await Promise.all([
      this.songs
        .createQueryBuilder('song')
        .select('song.estado', 'estado')
        .addSelect('COUNT(*)', 'cantidad')
        .where('song.artistaId=:id', { id: artist.id })
        .groupBy('song.estado')
        .getRawMany<{ estado: string; cantidad: string }>(),
      this.releases.countBy({ artistaId: artist.id }),
      this.songs.find({
        where: { artistaId: artist.id },
        relations: { genero: true, lanzamiento: true },
        order: { updatedAt: 'DESC' },
        take: 5,
      }),
    ]);
    const published = Number(
        counts.find((c) => c.estado === CancionEstado.PUBLICADO)?.cantidad ?? 0,
      ),
      drafts = Number(
        counts.find((c) => c.estado === CancionEstado.BORRADOR)?.cantidad ?? 0,
      );
    const findRecent = (estado: CancionEstado) =>
      this.songs.find({
        where: { artistaId: artist.id, estado },
        relations: { genero: true, lanzamiento: true },
        order: { updatedAt: 'DESC' },
        take: 3,
      });
    const [p, d] = await Promise.all([
      findRecent(CancionEstado.PUBLICADO),
      findRecent(CancionEstado.BORRADOR),
    ]);
    return {
      artist: { nombreArtistico: artist.nombreArtistico },
      totals: {
        total: published + drafts,
        published,
        drafts,
        releases: releaseCount,
      },
      published: p.map((s) => this.dto(s, artist)),
      drafts: d.map((s) => this.dto(s, artist)),
      recentActivity: recent.map((s) => this.dto(s, artist)),
    };
  }
  async upload(
    userId: string,
    id: string,
    kind: 'audio' | 'cover',
    file?: UploadedSongFile,
  ) {
    if (process.env.NODE_ENV === 'production')
      throw new ForbiddenException(
        'Las cargas locales solo están habilitadas en desarrollo.',
      );
    const artist = await this.artist(userId);
    await this.own(artist.id, id);
    if (!file)
      throw new BadRequestException('Selecciona un archivo en el campo file.');
    const duration = kind === 'audio' ? validateWav(file) : null,
      extension = kind === 'audio' ? 'wav' : validateSongCover(file),
      name = randomUUID() + '.' + extension,
      path = join(this.directory, name);
    await mkdir(this.directory, { recursive: true });
    await writeFile(path, file.buffer, { flag: 'wx', mode: 0o600 });
    try {
      await this.songs.manager.transaction(async (manager) => {
        const song = await this.own(artist.id, id, manager);
        const reference = mediaRoot + id + '/media/' + kind + '/' + name;
        if (kind === 'audio') {
          song.archivoAudioUrl = reference;
          song.duracionSegundos = duration;
        } else song.portadaUrl = reference;
        if (song.estado === CancionEstado.PUBLICADO)
          await this.publication(song, manager);
        await manager.getRepository(Cancion).save(song);
      });
    } catch (e) {
      await unlink(path);
      throw e;
    }
    return this.detail(userId, id);
  }
  async read(
    userId: string,
    id: string,
    kind: 'audio' | 'cover',
    name: string,
  ) {
    const artist = await this.artist(userId),
      song = await this.own(artist.id, id);
    if (this.fileName(song, kind) !== name)
      throw new NotFoundException('Archivo no encontrado.');
    try {
      return {
        buffer: await readFile(join(this.directory, name)),
        mime:
          kind === 'audio'
            ? 'audio/wav'
            : name.endsWith('.png')
              ? 'image/png'
              : 'image/jpeg',
      };
    } catch {
      throw new NotFoundException('Archivo no disponible.');
    }
  }
}
