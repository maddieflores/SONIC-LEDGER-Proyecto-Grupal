import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { readFile, open } from 'node:fs/promises';
import { Artista } from '../musica/artista.entity.js';
import {
  Lanzamiento,
  LanzamientoEstado,
} from '../musica/lanzamiento.entity.js';
import { join, resolve } from 'node:path';
import { Cancion, CancionEstado } from '../musica/cancion.entity.js';
import { Genero } from '../musica/genero.entity.js';
import type { CatalogQuery } from './catalog.dto.js';
@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(Cancion) private readonly songs: Repository<Cancion>,
    @InjectRepository(Genero) private readonly genres: Repository<Genero>,
    @InjectRepository(Artista) private readonly artists?: Repository<Artista>,
    @InjectRepository(Lanzamiento)
    private readonly releases?: Repository<Lanzamiento>,
  ) {}
  private coverName(song: Cancion) {
    const prefix = '/api/auth/artist-songs/' + song.id + '/media/cover/';
    if (!song.portadaUrl?.startsWith(prefix)) return null;
    const name = song.portadaUrl.slice(prefix.length);
    return /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.(png|jpg)$/.test(
      name,
    )
      ? name
      : null;
  }
  private dto(song: Cancion) {
    return {
      id: song.id,
      source: 'LOCAL',
      titulo: song.titulo,
      artista: { id: song.artistaId, nombre: song.artista?.nombreArtistico || '' },
      genero: song.genero
        ? { id: song.genero.id, nombre: song.genero.nombre }
        : null,
      duracionSegundos: song.duracionSegundos,
      descripcion: song.descripcion,
      playable: Boolean(this.audioName(song)),
      coverUrl: this.coverName(song)
        ? '/api/auth/catalog/' + song.id + '/cover'
        : null,
    };
  }
  async list(q: CatalogQuery) {
    const query = this.songs
      .createQueryBuilder('song')
      .innerJoinAndSelect('song.artista', 'artist')
      .leftJoinAndSelect('song.genero', 'genre')
      .where('song.estado = :state', { state: CancionEstado.PUBLICADO });
    if (q.generoId)
      query.andWhere('song.generoId = :genre', { genre: q.generoId });
    if (q.q?.trim())
      query.andWhere(
        '(song.titulo ILIKE :q OR artist.nombreArtistico ILIKE :q OR genre.nombre ILIKE :q)',
        { q: '%' + q.q.trim().replace(/[\\%_]/g, '\\$&') + '%' },
      );
    const [songs, total] = await query
      .orderBy('song.createdAt', 'DESC')
      .addOrderBy('song.id', 'ASC')
      .skip((q.page - 1) * q.pageSize)
      .take(q.pageSize)
      .getManyAndCount();
    return {
      items: songs.map((s) => this.dto(s)),
      total,
      page: q.page,
      pageSize: q.pageSize,
      totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
    };
  }
  genresList() {
    return this.genres
      .createQueryBuilder('genre')
      .innerJoin('genre.canciones', 'song', 'song.estado = :state', {
        state: CancionEstado.PUBLICADO,
      })
      .where('genre.activo = true')
      .select(['genre.id', 'genre.nombre'])
      .distinct(true)
      .orderBy('genre.nombre', 'ASC')
      .getMany();
  }
  private async published(id: string) {
    const song = await this.songs.findOne({
      where: { id, estado: CancionEstado.PUBLICADO },
      relations: { artista: true, genero: true },
    });
    if (!song) throw new NotFoundException('La canción no está disponible.');
    return song;
  }
  async detail(id: string) {
    const song = await this.published(id);
    const more = await this.songs.find({
      where: {
        artistaId: song.artistaId,
        estado: CancionEstado.PUBLICADO,
        id: Not(id),
      },
      relations: { artista: true, genero: true },
      order: { createdAt: 'DESC', id: 'ASC' },
      take: 4,
    });
    return { song: this.dto(song), moreByArtist: more.map((s) => this.dto(s)) };
  }
  private audioName(song: Cancion) {
    const prefix = '/api/auth/artist-songs/' + song.id + '/media/audio/';
    if (!song.archivoAudioUrl?.startsWith(prefix)) return null;
    const name = song.archivoAudioUrl.slice(prefix.length);
    return /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.wav$/.test(
      name,
    )
      ? name
      : null;
  }
  async audio(id: string) {
    const song = await this.published(id),
      name = this.audioName(song);
    if (!name)
      throw new NotFoundException('El audio publicado no está disponible.');
    let file: Awaited<ReturnType<typeof open>> | undefined;
    try {
      file = await open(
        join(resolve(process.cwd(), 'uploads', 'songs'), name),
        'r',
      );
      const info = await file.stat();
      if (!info.isFile() || !info.size) throw new Error();
      return { file, size: info.size };
    } catch {
      await file?.close().catch(() => {});
      throw new NotFoundException('El archivo de audio no está disponible.');
    }
  }
  private artistMediaName(reference: string | null) {
    const prefix = '/api/auth/artist-profile/media/';
    if (!reference?.startsWith(prefix)) return null;
    const name = reference.slice(prefix.length);
    return /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.(png|jpg)$/.test(
      name,
    )
      ? name
      : null;
  }
  async publicArtist(id: string, page = 1, pageSize = 20) {
    const artist = await this.artists!.findOneBy({ id });
    if (!artist) throw new NotFoundException('Artista no encontrado.');
    const [songs, total] = await this.songs.findAndCount({
      where: { artistaId: id, estado: CancionEstado.PUBLICADO },
      relations: { artista: true, genero: true },
      order: { createdAt: 'DESC', id: 'ASC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    const release = await this.releases!.createQueryBuilder('release')
      .innerJoin(
        'release.canciones',
        'song',
        'song.estado = :state AND song.artistaId = :artistId',
        { state: CancionEstado.PUBLICADO, artistId: id },
      )
      .where('release.artistaId = :id AND release.estado = :published', {
        id,
        published: LanzamientoEstado.PUBLICADO,
      })
      .orderBy('release.fechaLanzamiento', 'DESC', 'NULLS LAST')
      .addOrderBy('release.createdAt', 'DESC')
      .getOne();
    const count = release
      ? await this.songs.countBy({
          artistaId: id,
          lanzamientoId: release.id,
          estado: CancionEstado.PUBLICADO,
        })
      : 0;
    const artistReleases = await this.releases!.find({
      where: { artistaId: id, estado: LanzamientoEstado.PUBLICADO },
      relations: { artista: true, canciones: true },
      order: { fechaLanzamiento: 'DESC', createdAt: 'DESC' },
    });
    return {
      artist: {
        id: artist.id,
        nombre: artist.nombreArtistico,
        biografia: artist.biografia ?? '',
        ciudad: artist.ciudad,
        pais: artist.pais,
        identidad: artist.identidad,
        avatarUrl: this.artistMediaName(artist.avatarUrl)
          ? '/api/auth/catalog/artists/' + id + '/media/avatar'
          : null,
        coverUrl: this.artistMediaName(artist.coverUrl)
          ? '/api/auth/catalog/artists/' + id + '/media/cover'
          : null,
      },
      songs: songs.map((song) => this.dto(song)),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      latestRelease: release
        ? {
            id: release.id,
            titulo: release.titulo,
            tipo: release.tipo,
            fecha: release.fechaLanzamiento,
            songCount: count,
          }
        : null,
      releases: artistReleases.map((r) => this.publicReleaseDto(r)),
    };
  }
  async publicArtistMedia(id: string, kind: string) {
    if (kind !== 'avatar' && kind !== 'cover') throw new NotFoundException();
    const artist = await this.artists!.findOneBy({ id });
    if (!artist) throw new NotFoundException();
    const name = this.artistMediaName(
      kind === 'avatar' ? artist.avatarUrl : artist.coverUrl,
    );
    if (!name) throw new NotFoundException();
    try {
      return {
        buffer: await readFile(
          join(resolve(process.cwd(), 'uploads', 'artists'), name),
        ),
        mime: name.endsWith('.png') ? 'image/png' : 'image/jpeg',
      };
    } catch {
      throw new NotFoundException('Imagen no disponible.');
    }
  }
  private releaseCoverName(release: Lanzamiento) {
    const prefix = `/api/auth/artist/releases/${release.id}/media/cover/`;
    if (!release.portadaUrl?.startsWith(prefix)) return null;
    const name = release.portadaUrl.slice(prefix.length);
    return /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.(png|jpg)$/.test(
      name,
    )
      ? name
      : null;
  }

  publicReleaseDto(release: Lanzamiento) {
    const sortedTracks = (release.canciones ?? [])
      .filter((s) => s.estado === CancionEstado.PUBLICADO)
      .slice()
      .sort((a, b) => (a.numeroPista ?? 9999) - (b.numeroPista ?? 9999));

    return {
      id: release.id,
      titulo: release.titulo,
      descripcion: release.descripcion,
      tipo: release.tipo,
      artista: {
        id: release.artistaId,
        nombre: release.artista?.nombreArtistico ?? '',
      },
      fechaLanzamiento: release.fechaLanzamiento,
      coverUrl: this.releaseCoverName(release)
        ? `/api/auth/catalog/releases/${release.id}/cover`
        : null,
      duracionTotalSegundos: sortedTracks.reduce(
        (acc, s) => acc + (s.duracionSegundos || 0),
        0,
      ),
      songCount: sortedTracks.length,
      canciones: sortedTracks.map((s) => ({
        ...this.dto(s),
        numeroPista: s.numeroPista,
      })),
    };
  }

  async publicReleases(q: CatalogQuery) {
    const query = this.releases!
      .createQueryBuilder('release')
      .innerJoinAndSelect('release.artista', 'artist')
      .leftJoinAndSelect(
        'release.canciones',
        'song',
        'song.estado = :songState',
        { songState: CancionEstado.PUBLICADO },
      )
      .leftJoinAndSelect('song.artista', 'songArtist')
      .leftJoinAndSelect('song.genero', 'genre')
      .where('release.estado = :releaseState', {
        releaseState: LanzamientoEstado.PUBLICADO,
      });

    if (q.q?.trim()) {
      query.andWhere(
        '(release.titulo ILIKE :q OR artist.nombreArtistico ILIKE :q)',
        { q: '%' + q.q.trim().replace(/[\\%_]/g, '\\$&') + '%' },
      );
    }

    const [items, total] = await query
      .orderBy('release.fechaLanzamiento', 'DESC', 'NULLS LAST')
      .addOrderBy('release.createdAt', 'DESC')
      .skip((q.page - 1) * q.pageSize)
      .take(q.pageSize)
      .getManyAndCount();

    return {
      items: items.map((r) => this.publicReleaseDto(r)),
      total,
      page: q.page,
      pageSize: q.pageSize,
      totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
    };
  }

  async publicReleaseDetail(id: string) {
    const release = await this.releases!.findOne({
      where: { id, estado: LanzamientoEstado.PUBLICADO },
      relations: {
        artista: true,
        canciones: { artista: true, genero: true },
      },
    });

    if (!release) {
      throw new NotFoundException('Lanzamiento no disponible.');
    }

    return this.publicReleaseDto(release);
  }

  async publicReleaseCover(id: string) {
    const release = await this.releases!.findOne({
      where: { id, estado: LanzamientoEstado.PUBLICADO },
    });
    if (!release) throw new NotFoundException('Lanzamiento no disponible.');

    const name = this.releaseCoverName(release);
    if (!name) throw new NotFoundException('Portada no disponible.');

    try {
      return {
        buffer: await readFile(
          join(resolve(process.cwd(), 'uploads', 'releases'), name),
        ),
        mime: name.endsWith('.png') ? 'image/png' : 'image/jpeg',
      };
    } catch {
      throw new NotFoundException('Portada no disponible.');
    }
  }

  async cover(id: string) {
    const song = await this.published(id),
      name = this.coverName(song);
    if (!name) throw new NotFoundException('Portada no disponible.');
    try {
      return {
        buffer: await readFile(
          join(resolve(process.cwd(), 'uploads', 'songs'), name),
        ),
        mime: name.endsWith('.png') ? 'image/png' : 'image/jpeg',
      };
    } catch {
      throw new NotFoundException('Portada no disponible.');
    }
  }
}
