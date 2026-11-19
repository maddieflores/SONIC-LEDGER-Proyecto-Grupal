import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type EntityManager, In } from 'typeorm';
import { mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Artista } from '../musica/artista.entity.js';
import { Cancion, CancionEstado } from '../musica/cancion.entity.js';
import {
  Lanzamiento,
  LanzamientoEstado,
  LanzamientoTipo,
} from '../musica/lanzamiento.entity.js';
import type {
  CreateReleaseDto,
  ReleasesQueryDto,
  UpdateReleaseDto,
} from './releases.dto.js';
import { validateArtistImage } from '../artist/artist-media.service.js';
import { MAX_COVER_BYTES, type UploadedSongFile } from '../songs/song-files.js';

const mediaPrefix = '/api/auth/artist/releases/';

@Injectable()
export class ReleasesService {
  private readonly directory = resolve(process.cwd(), 'uploads', 'releases');
  private readonly songDirectory = resolve(process.cwd(), 'uploads', 'songs');

  constructor(
    @InjectRepository(Lanzamiento)
    private readonly releases: Repository<Lanzamiento>,
    @InjectRepository(Cancion)
    private readonly songs: Repository<Cancion>,
    @InjectRepository(Artista)
    private readonly artists: Repository<Artista>,
  ) {}

  async artist(userId: string) {
    const artist = await this.artists.findOneBy({ usuarioId: userId });
    if (!artist) {
      throw new ConflictException(
        'Completa primero tu perfil artístico en CU04.',
      );
    }
    return artist;
  }

  async own(artistId: string, id: string, manager?: EntityManager) {
    const release = await (
      manager ? manager.getRepository(Lanzamiento) : this.releases
    ).findOne({
      where: { id, artistaId: artistId },
      relations: {
        canciones: { genero: true },
        artista: true,
      },
      ...(manager ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
    if (!release) {
      throw new NotFoundException('Lanzamiento no encontrado.');
    }
    return release;
  }

  coverFileName(release: Lanzamiento): string | null {
    if (!release.portadaUrl) return null;
    const prefix = `${mediaPrefix}${release.id}/media/cover/`;
    if (!release.portadaUrl.startsWith(prefix)) return null;
    const name = release.portadaUrl.slice(prefix.length);
    return /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.(png|jpg)$/.test(
      name,
    )
      ? name
      : null;
  }

  private songAudioFileName(song: Cancion): string | null {
    const prefix = `/api/auth/artist-songs/${song.id}/media/audio/`;
    if (!song.archivoAudioUrl?.startsWith(prefix)) return null;
    const name = song.archivoAudioUrl.slice(prefix.length);
    return /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.wav$/.test(
      name,
    )
      ? name
      : null;
  }

  dto(release: Lanzamiento, artist: Artista) {
    const sortedTracks = (release.canciones ?? []).slice().sort((a, b) => {
      if (a.numeroPista != null && b.numeroPista != null) {
        return a.numeroPista - b.numeroPista;
      }
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    const duracionTotalSegundos = sortedTracks.reduce(
      (acc, s) => acc + (s.duracionSegundos || 0),
      0,
    );

    return {
      id: release.id,
      titulo: release.titulo,
      descripcion: release.descripcion,
      tipo: release.tipo,
      estado: release.estado,
      artistaId: artist.id,
      artista: artist.nombreArtistico,
      fechaLanzamiento: release.fechaLanzamiento,
      createdAt: release.createdAt,
      updatedAt: release.updatedAt,
      portadaUrl: this.coverFileName(release) ? release.portadaUrl : null,
      cancionCount: sortedTracks.length,
      duracionTotalSegundos,
      canciones: sortedTracks.map((s, index) => ({
        id: s.id,
        numeroPista: s.numeroPista ?? index + 1,
        titulo: s.titulo,
        descripcion: s.descripcion,
        duracionSegundos: s.duracionSegundos,
        estado: s.estado,
        generoId: s.generoId,
        genero: s.genero?.nombre ?? null,
        audioUrl: s.archivoAudioUrl,
        coverUrl: s.portadaUrl,
      })),
    };
  }

  validateTypeTrackCount(tipo: LanzamientoTipo, count: number) {
    if (tipo === LanzamientoTipo.SINGLE && count !== 1) {
      throw new BadRequestException(
        'Un sencillo (SINGLE) debe tener exactamente 1 canción.',
      );
    }
    if (tipo === LanzamientoTipo.EP && (count < 2 || count > 6)) {
      throw new BadRequestException('Un EP debe tener entre 2 y 6 canciones.');
    }
    if (tipo === LanzamientoTipo.ALBUM && count < 7) {
      throw new BadRequestException(
        'Un álbum (ALBUM) debe tener 7 o más canciones.',
      );
    }
  }

  async list(userId: string, q: ReleasesQueryDto) {
    const artist = await this.artist(userId);
    const query = this.releases
      .createQueryBuilder('release')
      .leftJoinAndSelect('release.canciones', 'song')
      .leftJoinAndSelect('song.genero', 'genre')
      .where('release.artistaId = :artistId', { artistId: artist.id });

    if (q.tipo) {
      query.andWhere('release.tipo = :tipo', { tipo: q.tipo });
    }
    if (q.estado) {
      query.andWhere('release.estado = :estado', { estado: q.estado });
    }
    if (q.q?.trim()) {
      query.andWhere('release.titulo ILIKE :search', {
        search: '%' + q.q.trim().replace(/[\\%_]/g, '\\$&') + '%',
      });
    }

    query
      .orderBy('release.createdAt', 'DESC')
      .addOrderBy('release.id', 'ASC')
      .skip((q.page - 1) * q.pageSize)
      .take(q.pageSize);

    const [items, total] = await query.getManyAndCount();

    return {
      items: items.map((r) => this.dto(r, artist)),
      total,
      page: q.page,
      pageSize: q.pageSize,
      totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
    };
  }

  async detail(userId: string, id: string) {
    const artist = await this.artist(userId);
    const release = await this.own(artist.id, id);
    return this.dto(release, artist);
  }

  async availableSongs(userId: string) {
    const artist = await this.artist(userId);
    const songs = await this.songs.find({
      where: {
        artistaId: artist.id,
      },
      relations: { genero: true },
      order: { createdAt: 'DESC' },
    });

    return songs.map((s) => ({
      id: s.id,
      titulo: s.titulo,
      duracionSegundos: s.duracionSegundos,
      estado: s.estado,
      generoId: s.generoId,
      genero: s.genero?.nombre ?? null,
      lanzamientoId: s.lanzamientoId,
      audioUrl: s.archivoAudioUrl,
      coverUrl: s.portadaUrl,
      createdAt: s.createdAt,
    }));
  }

  async create(userId: string, dto: CreateReleaseDto) {
    const artist = await this.artist(userId);
    const release = await this.releases.save(
      this.releases.create({
        artistaId: artist.id,
        titulo: dto.titulo,
        tipo: dto.tipo,
        descripcion: dto.descripcion ?? '',
        estado: LanzamientoEstado.BORRADOR,
        portadaUrl: null,
        fechaLanzamiento: null,
      }),
    );
    return this.detail(userId, release.id);
  }

  async update(userId: string, id: string, dto: UpdateReleaseDto) {
    const artist = await this.artist(userId);
    await this.releases.manager.transaction(async (manager) => {
      const release = await this.own(artist.id, id, manager);

      if (dto.titulo !== undefined) release.titulo = dto.titulo;
      if (dto.descripcion !== undefined) release.descripcion = dto.descripcion;

      if (dto.tipo !== undefined && dto.tipo !== release.tipo) {
        if (release.estado === LanzamientoEstado.PUBLICADO) {
          const currentCount = release.canciones?.length ?? 0;
          this.validateTypeTrackCount(dto.tipo, currentCount);
        }
        release.tipo = dto.tipo;
      }

      await manager.getRepository(Lanzamiento).save(release);
    });

    return this.detail(userId, id);
  }

  async setTracks(userId: string, id: string, trackIds: string[]) {
    const artist = await this.artist(userId);

    // Validar duplicados
    const uniqueIds = new Set(trackIds);
    if (uniqueIds.size !== trackIds.length) {
      throw new BadRequestException(
        'No se permiten canciones duplicadas dentro del mismo lanzamiento.',
      );
    }

    await this.releases.manager.transaction(async (manager) => {
      const release = await this.own(artist.id, id, manager);

      // Si trackIds no está vacío, validar que todas pertenezcan al artista y existan
      let songsToAdd: Cancion[] = [];
      if (trackIds.length > 0) {
        songsToAdd = await manager.getRepository(Cancion).findBy({
          id: In(trackIds),
          artistaId: artist.id,
        });

        if (songsToAdd.length !== trackIds.length) {
          throw new BadRequestException(
            'Una o más canciones no existen o no pertenecen a tu perfil.',
          );
        }
      }

      // Si el lanzamiento ya está publicado, validar reglas estrictas
      if (release.estado === LanzamientoEstado.PUBLICADO) {
        this.validateTypeTrackCount(release.tipo, trackIds.length);

        for (const song of songsToAdd) {
          if (song.estado !== CancionEstado.PUBLICADO) {
            throw new BadRequestException(
              `La canción "${song.titulo}" no está publicada. Solo canciones publicadas pueden formar parte de un lanzamiento publicado.`,
            );
          }
          const audioName = this.songAudioFileName(song);
          if (!audioName) {
            throw new BadRequestException(
              `La canción "${song.titulo}" no cuenta con archivo de audio válido.`,
            );
          }
          try {
            const file = await stat(join(this.songDirectory, audioName));
            if (!file.isFile() || file.size === 0) throw new Error();
          } catch {
            throw new BadRequestException(
              `El archivo de audio de "${song.titulo}" no está disponible en almacenamiento.`,
            );
          }
        }
      }

      // Desvincular pistas que pertenecían a este lanzamiento y ya no están
      const existingInRelease = await manager.getRepository(Cancion).find({
        where: { lanzamientoId: release.id },
      });

      for (const song of existingInRelease) {
        if (!uniqueIds.has(song.id)) {
          song.lanzamientoId = null;
          song.numeroPista = null;
          await manager.getRepository(Cancion).save(song);
        }
      }

      // Asignar nuevas canciones con su orden consecutivo (1, 2, ...)
      const songMap = new Map(songsToAdd.map((s) => [s.id, s]));
      for (let i = 0; i < trackIds.length; i++) {
        const song = songMap.get(trackIds[i])!;
        song.lanzamientoId = release.id;
        song.numeroPista = i + 1;
        await manager.getRepository(Cancion).save(song);
      }
    });

    return this.detail(userId, id);
  }

  async publish(userId: string, id: string) {
    const artist = await this.artist(userId);

    await this.releases.manager.transaction(async (manager) => {
      const release = await this.own(artist.id, id, manager);

      if (release.titulo.trim().length < 2) {
        throw new BadRequestException(
          'El lanzamiento requiere un título de al menos 2 caracteres.',
        );
      }

      if (!this.coverFileName(release)) {
        throw new BadRequestException(
          'Para publicar el lanzamiento es obligatorio cargar una portada válida.',
        );
      }

      const coverFile = join(this.directory, this.coverFileName(release)!);
      try {
        const info = await stat(coverFile);
        if (!info.isFile() || info.size === 0) throw new Error();
      } catch {
        throw new BadRequestException(
          'La portada no se encuentra disponible en almacenamiento. Vuelve a cargarla.',
        );
      }

      const tracks = await manager.getRepository(Cancion).find({
        where: { lanzamientoId: release.id },
        order: { numeroPista: 'ASC', createdAt: 'ASC' },
      });

      if (!tracks.length) {
        throw new BadRequestException(
          'No se puede publicar un lanzamiento sin canciones.',
        );
      }

      this.validateTypeTrackCount(release.tipo, tracks.length);

      for (const song of tracks) {
        if (song.estado !== CancionEstado.PUBLICADO) {
          throw new BadRequestException(
            `La canción "${song.titulo}" no está publicada. Publica todas las canciones antes de publicar el lanzamiento.`,
          );
        }
        const audioName = this.songAudioFileName(song);
        if (!audioName) {
          throw new BadRequestException(
            `La canción "${song.titulo}" no tiene un archivo de audio válido.`,
          );
        }
        try {
          const file = await stat(join(this.songDirectory, audioName));
          if (!file.isFile() || file.size === 0) throw new Error();
        } catch {
          throw new BadRequestException(
            `El audio de "${song.titulo}" no está disponible en almacenamiento.`,
          );
        }
      }

      release.estado = LanzamientoEstado.PUBLICADO;
      release.fechaLanzamiento = new Date();
      await manager.getRepository(Lanzamiento).save(release);
    });

    return this.detail(userId, id);
  }

  async delete(userId: string, id: string) {
    const artist = await this.artist(userId);
    let coverToDelete: string | null = null;

    await this.releases.manager.transaction(async (manager) => {
      const release = await this.own(artist.id, id, manager);
      coverToDelete = this.coverFileName(release);

      // Desvincular todas las canciones sin eliminarlas ni tocar sus audios
      await manager
        .createQueryBuilder()
        .update(Cancion)
        .set({ lanzamientoId: null, numeroPista: null })
        .where('lanzamientoId = :id', { id: release.id })
        .execute();

      await manager.getRepository(Lanzamiento).remove(release);
    });

    // Eliminar portada del lanzamiento si existe
    if (coverToDelete) {
      await unlink(join(this.directory, coverToDelete)).catch(() => {});
    }

    return { deleted: true, id };
  }

  async uploadCover(userId: string, id: string, file?: UploadedSongFile) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException(
        'Las cargas locales solo están habilitadas en desarrollo.',
      );
    }
    const artist = await this.artist(userId);
    const release = await this.own(artist.id, id);

    if (!file) {
      throw new BadRequestException('Selecciona un archivo en el campo file.');
    }
    if (file.buffer.length > MAX_COVER_BYTES) {
      throw new BadRequestException('La portada no puede superar los 2 MB.');
    }

    const extension = validateArtistImage(file.buffer, file.mimetype);
    const name = `${randomUUID()}.${extension}`;
    const filePath = join(this.directory, name);

    await mkdir(this.directory, { recursive: true });
    await writeFile(filePath, file.buffer, { flag: 'wx', mode: 0o600 });

    try {
      await this.releases.manager.transaction(async (manager) => {
        const current = await this.own(artist.id, id, manager);
        const oldCover = this.coverFileName(current);

        current.portadaUrl = `${mediaPrefix}${id}/media/cover/${name}`;
        await manager.getRepository(Lanzamiento).save(current);

        if (oldCover && oldCover !== name) {
          await unlink(join(this.directory, oldCover)).catch(() => {});
        }
      });
    } catch (e) {
      await unlink(filePath).catch(() => {});
      throw e;
    }

    return this.detail(userId, id);
  }

  async readCover(id: string, name: string) {
    if (
      !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.(png|jpg)$/.test(
        name,
      )
    ) {
      throw new NotFoundException('Archivo de portada no válido.');
    }

    try {
      const buffer = await readFile(join(this.directory, name));
      return {
        buffer,
        mime: name.endsWith('.png') ? 'image/png' : 'image/jpeg',
      };
    } catch {
      throw new NotFoundException('Archivo de portada no disponible.');
    }
  }
}
