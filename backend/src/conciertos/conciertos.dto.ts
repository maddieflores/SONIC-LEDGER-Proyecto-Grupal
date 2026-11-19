import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateConcertDto {
  @IsString()
  @IsNotEmpty({ message: 'El título del concierto es obligatorio.' })
  @MaxLength(200, { message: 'El título no puede exceder los 200 caracteres.' })
  titulo!: string;

  @IsString()
  @IsOptional()
  @MaxLength(3000, { message: 'La descripción no puede exceder los 3000 caracteres.' })
  descripcion?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100, { message: 'El género no puede exceder los 100 caracteres.' })
  genero?: string;

  @IsDateString({}, { message: 'La fecha de inicio debe ser una fecha ISO válida.' })
  fechaInicio!: string;

  @IsDateString({}, { message: 'La fecha de fin debe ser una fecha ISO válida.' })
  fechaFin!: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  zonaHoraria?: string;

  @IsString()
  @IsNotEmpty({ message: 'El recinto del concierto es obligatorio.' })
  @MaxLength(200, { message: 'El recinto no puede exceder los 200 caracteres.' })
  recinto!: string;

  @IsString()
  @IsNotEmpty({ message: 'La dirección es obligatoria.' })
  @MaxLength(255, { message: 'La dirección no puede exceder los 255 caracteres.' })
  direccion!: string;

  @IsString()
  @IsNotEmpty({ message: 'La ciudad es obligatoria.' })
  @MaxLength(100, { message: 'La ciudad no puede exceder los 100 caracteres.' })
  ciudad!: string;

  @IsString()
  @IsNotEmpty({ message: 'El departamento es obligatorio.' })
  @MaxLength(100, { message: 'El departamento no puede exceder los 100 caracteres.' })
  departamento!: string;

  @IsDateString({}, { message: 'La fecha de inicio de venta debe ser una fecha ISO válida.' })
  @IsOptional()
  inicioVenta?: string | null;

  @IsBoolean()
  @IsOptional()
  destacado?: boolean;
}

export class UpdateConcertDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  titulo?: string;

  @IsString()
  @IsOptional()
  @MaxLength(3000)
  descripcion?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  genero?: string;

  @IsDateString()
  @IsOptional()
  fechaInicio?: string;

  @IsDateString()
  @IsOptional()
  fechaFin?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  zonaHoraria?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  recinto?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  direccion?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  ciudad?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  departamento?: string;

  @IsDateString()
  @IsOptional()
  inicioVenta?: string | null;

  @IsBoolean()
  @IsOptional()
  destacado?: boolean;
}

export class CreateTicketCategoryDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre de la categoría es obligatorio.' })
  @MaxLength(100, { message: 'El nombre no puede exceder los 100 caracteres.' })
  nombre!: string;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El precio debe ser un número con hasta 2 decimales.' })
  @Min(0, { message: 'El precio no puede ser negativo.' })
  precio!: number;

  @IsString()
  @IsOptional()
  @Matches(/^BOB$/, { message: 'La moneda debe ser explícitamente BOB.' })
  moneda?: string;

  @IsInt({ message: 'El cupo debe ser un número entero.' })
  @Min(1, { message: 'El cupo debe ser mayor a 0.' })
  cupoTotal!: number;

  @IsBoolean()
  @IsOptional()
  disponible?: boolean;
}

export class UpdateTicketCategoryDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  nombre?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsOptional()
  @Min(0)
  precio?: number;

  @IsString()
  @IsOptional()
  @Matches(/^BOB$/, { message: 'La moneda debe ser explícitamente BOB.' })
  moneda?: string;

  @IsInt()
  @IsOptional()
  @Min(1)
  cupoTotal?: number;

  @IsBoolean()
  @IsOptional()
  disponible?: boolean;
}

export class AddConcertArtistaDto {
  @IsUUID('4', { message: 'El ID de artista debe ser un UUID válido.' })
  @IsOptional()
  artistaId?: string | null;

  @IsString()
  @IsNotEmpty({ message: 'El nombre del artista es obligatorio.' })
  @MaxLength(100, { message: 'El nombre no puede exceder los 100 caracteres.' })
  nombreArtista!: string;

  @IsInt()
  @IsOptional()
  @Min(1)
  orden?: number;
}

export class ConcertQueryDto {
  @IsString()
  @IsOptional()
  q?: string;

  @IsString()
  @IsOptional()
  ciudad?: string;

  @IsString()
  @IsOptional()
  genero?: string;

  @IsDateString()
  @IsOptional()
  fechaDesde?: string;

  @IsDateString()
  @IsOptional()
  fechaHasta?: string;

  @IsUUID()
  @IsOptional()
  artistaId?: string;

  @IsOptional()
  destacados?: string | boolean;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(1)
  page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(1)
  limit?: number = 12;

  @IsString()
  @IsOptional()
  sort?: 'fecha_asc' | 'fecha_desc' | 'recientes';
}

export class CancelarConciertoDto {
  @IsString()
  @IsNotEmpty({ message: 'El motivo de cancelación es obligatorio.' })
  @MinLength(5, { message: 'El motivo de cancelación debe tener al menos 5 caracteres.' })
  @MaxLength(1000, { message: 'El motivo de cancelación no puede exceder los 1000 caracteres.' })
  motivo!: string;
}

export class RecomendacionesQueryDto {
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(1)
  limit?: number = 6;

  @IsString()
  @IsOptional()
  ciudad?: string;
}
