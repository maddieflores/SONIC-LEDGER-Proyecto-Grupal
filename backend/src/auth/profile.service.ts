import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Usuario } from './usuario.entity.js';
import { Genero } from '../musica/genero.entity.js';
import type { UpdateProfileDto } from './profile.dto.js';
@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(Usuario) private readonly users: Repository<Usuario>,
    @InjectRepository(Genero) private readonly genres: Repository<Genero>,
  ) {}
  genresList() {
    return this.genres.find({
      where: { activo: true },
      order: { nombre: 'ASC' },
      select: { id: true, nombre: true },
    });
  }
  async get(id: string) {
    const user = await this.users.findOneBy({ id });
    if (!user) throw new NotFoundException('Usuario no encontrado.');
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName ?? user.username,
      biography: user.biography ?? '',
      genreIds: [],
      moods: [],
      intensity: 50,
      discovery: 50,
      energy: 50,
      ...user.musicPreferences,
      avatarUrl: null,
      avatarUploadAvailable: false,
      favoriteArtistsAvailable: false,
    };
  }
  async update(id: string, dto: UpdateProfileDto) {
    if (
      dto.genreIds.length &&
      (await this.genres.countBy({ id: In(dto.genreIds), activo: true })) !==
        dto.genreIds.length
    )
      throw new BadRequestException('Selecciona géneros activos del catálogo.');
    const {
      displayName,
      biography,
      genreIds,
      moods,
      intensity,
      discovery,
      energy,
    } = dto;
    const result = await this.users.update(id, {
      displayName,
      biography,
      musicPreferences: { genreIds, moods, intensity, discovery, energy },
    });
    if (!result.affected) throw new NotFoundException('Usuario no encontrado.');
    return this.get(id);
  }
}
