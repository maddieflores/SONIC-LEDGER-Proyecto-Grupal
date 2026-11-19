import { Transform } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreatePlaylistDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'El nombre de la playlist es obligatorio' })
  @MaxLength(150, { message: 'El nombre no puede superar los 150 caracteres' })
  nombre!: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(2000, { message: 'La descripción no puede superar los 2000 caracteres' })
  descripcion?: string;
}

export class UpdatePlaylistDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'El nombre no puede quedar vacío' })
  @MaxLength(150, { message: 'El nombre no puede superar los 150 caracteres' })
  nombre?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(2000, { message: 'La descripción no puede superar los 2000 caracteres' })
  descripcion?: string;
}

export class AddTrackDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'El identificador de la canción es obligatorio' })
  @MaxLength(100)
  trackId!: string;

  @IsOptional()
  @IsIn(['LOCAL', 'AUDIUS'])
  source?: 'LOCAL' | 'AUDIUS';
}

export class ReorderTracksDto {
  @IsArray()
  @IsString({ each: true })
  trackIds!: string[];
}

export class FavoriteDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'El identificador de la canción es obligatorio' })
  @MaxLength(100)
  trackId!: string;

  @IsOptional()
  @IsIn(['LOCAL', 'AUDIUS'])
  source?: 'LOCAL' | 'AUDIUS';
}

export class CheckFavoritesDto {
  @IsArray()
  @IsString({ each: true })
  trackIds!: string[];
}
