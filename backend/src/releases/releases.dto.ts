import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  LanzamientoEstado,
  LanzamientoTipo,
} from '../musica/lanzamiento.entity.js';

export class CreateReleaseDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 150)
  titulo!: string;

  @IsEnum(LanzamientoTipo)
  tipo!: LanzamientoTipo;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descripcion?: string;
}

export class UpdateReleaseDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 150)
  titulo?: string;

  @IsOptional()
  @IsEnum(LanzamientoTipo)
  tipo?: LanzamientoTipo;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descripcion?: string;
}

export class SetTracksDto {
  @Transform(({ value, obj }) => {
    if (Array.isArray(value)) return value;
    if (Array.isArray(obj.songIds)) return obj.songIds;
    if (Array.isArray(obj.canciones)) return obj.canciones;
    return value;
  })
  @IsArray()
  @IsUUID('4', { each: true })
  trackIds!: string[];
}

export class ReleasesQueryDto {
  @IsOptional()
  @IsEnum(LanzamientoTipo)
  tipo?: LanzamientoTipo;

  @IsOptional()
  @IsEnum(LanzamientoEstado)
  estado?: LanzamientoEstado;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize = 12;
}
