import { Transform, Type } from 'class-transformer';
import {
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
import { CancionEstado } from '../musica/cancion.entity.js';
export class SongDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 150)
  titulo!: string;
  @IsString() @MaxLength(2000) descripcion!: string;
  @IsOptional() @IsUUID('4') generoId?: string | null;
  @IsOptional() @IsUUID('4') lanzamientoId?: string | null;
}
export class SongStateDto {
  @IsEnum(CancionEstado) estado!: CancionEstado;
}
export class SongsQueryDto {
  @IsOptional() @IsEnum(CancionEstado) estado?: CancionEstado;
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsUUID('4') generoId?: string;
  @IsOptional()
  @IsEnum({ newest: 'newest', oldest: 'oldest', title: 'title' })
  sort?: 'newest' | 'oldest' | 'title';
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(50) pageSize = 10;
}
