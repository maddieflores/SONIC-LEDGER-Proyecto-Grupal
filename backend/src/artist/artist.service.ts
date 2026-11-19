import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Artista } from '../musica/artista.entity.js';
import { Genero } from '../musica/genero.entity.js';
import type { ArtistProfileDto } from './artist.dto.js';
const mediaPrefix = '/api/auth/artist-profile/media/';
@Injectable()
export class ArtistService {
  constructor(
    @InjectRepository(Artista) private readonly artists: Repository<Artista>,
    @InjectRepository(Genero) private readonly genres: Repository<Genero>,
  ) {}
  async own(userId: string) {
    return this.artists.findOne({
      where: { usuarioId: userId },
      relations: { generos: true },
    });
  }
  async get(userId: string, username: string) {
    const a = await this.own(userId);
    return {
      profile: a
        ? {
            id: a.id,
            nombreArtistico: a.nombreArtistico,
            biografia: a.biografia ?? '',
            ciudad: a.ciudad,
            pais: a.pais,
            genreIds: a.generos.map((g) => g.id),
            identidad: a.identidad,
            redes: a.redes,
            avatarUrl: a.avatarUrl?.startsWith(mediaPrefix)
              ? a.avatarUrl
              : null,
            coverUrl: a.coverUrl?.startsWith(mediaPrefix) ? a.coverUrl : null,
          }
        : null,
      username,
      statistics: null,
      mediaUploadAvailable: process.env.NODE_ENV !== 'production',
    };
  }
  async save(
    userId: string,
    username: string,
    dto: ArtistProfileDto,
    create: boolean,
  ) {
    const current = await this.own(userId);
    if (create && current)
      throw new ConflictException('Ya tienes un perfil artístico.');
    if (!create && !current)
      throw new NotFoundException('Crea primero tu perfil artístico.');
    const genres = dto.genreIds.length
      ? await this.genres.findBy({ id: In(dto.genreIds), activo: true })
      : [];
    if (genres.length !== dto.genreIds.length)
      throw new BadRequestException('Selecciona géneros activos del catálogo.');
    const allowedHosts: Record<string, string[]> = {
      instagram: ['instagram.com'],
      tiktok: ['tiktok.com'],
      youtube: ['youtube.com', 'youtu.be'],
      spotify: ['open.spotify.com'],
      website: [],
    };
    const redes: Record<string, string> = {};
    for (const [key, value] of Object.entries(dto.redes)) {
      if (value == null) continue;
      let url: URL;
      try {
        url = new URL(value);
      } catch {
        throw new BadRequestException('Introduce enlaces HTTPS válidos.');
      }
      const hosts = allowedHosts[key];
      if (
        !hosts ||
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        (url.port && url.port !== '443') ||
        (hosts.length &&
          !hosts.some(
            (host) =>
              url.hostname === host || url.hostname.endsWith('.' + host),
          ))
      )
        throw new BadRequestException(
          'El enlace no corresponde a la red social indicada.',
        );
      redes[key] = url.href;
    }
    try {
      const artist = current ?? this.artists.create({ usuarioId: userId });
      Object.assign(artist, {
        nombreArtistico: dto.nombreArtistico,
        biografia: dto.biografia,
        ciudad: dto.ciudad,
        pais: dto.pais,
        identidad: dto.identidad,
        redes,
        generos: genres,
      });
      await this.artists.save(artist);
    } catch (e) {
      if ((e as { code?: string }).code === '23505')
        throw new ConflictException(
          'El nombre artístico ya está en uso o la cuenta ya tiene perfil.',
        );
      throw e;
    }
    return this.get(userId, username);
  }
  async setMedia(userId: string, kind: 'avatar' | 'cover', reference: string) {
    const result = await this.artists.update(
      { usuarioId: userId },
      kind === 'avatar' ? { avatarUrl: reference } : { coverUrl: reference },
    );
    if (!result.affected)
      throw new NotFoundException('Crea primero tu perfil artístico.');
  }
}
