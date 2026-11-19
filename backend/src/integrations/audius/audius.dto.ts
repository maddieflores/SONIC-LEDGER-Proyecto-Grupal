import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export enum AudiusTrendingTimeRange {
  WEEK = 'week',
  MONTH = 'month',
  ALL_TIME = 'allTime',
}

export enum AudiusSearchType {
  TRACKS = 'tracks',
  ARTISTS = 'artists',
  ALL = 'all',
}

/**
 * DTO para consultar canciones en tendencia.
 */
export class GetTrendingTracksDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  genre?: string;

  @IsOptional()
  @IsEnum(AudiusTrendingTimeRange)
  time?: AudiusTrendingTimeRange = AudiusTrendingTimeRange.WEEK;
}

/**
 * DTO para búsqueda en Audius (canciones y/o artistas).
 */
export class SearchAudiusDto {
  @IsNotEmpty({ message: 'El término de búsqueda no puede estar vacío' })
  @IsString()
  @MinLength(2, { message: 'El término de búsqueda debe tener al menos 2 caracteres' })
  @MaxLength(100, { message: 'El término de búsqueda no puede exceder 100 caracteres' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  query!: string;

  @IsOptional()
  @IsEnum(AudiusSearchType)
  type?: AudiusSearchType = AudiusSearchType.ALL;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}

/**
 * DTO para consultar canciones de un artista.
 */
export class GetArtistTracksDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;

  @IsOptional()
  @IsString()
  @IsIn(['date', 'plays'])
  sort?: 'date' | 'plays' = 'date';
}
