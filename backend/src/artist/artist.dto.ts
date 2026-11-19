import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsDefined,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  MaxLength,
  ValidateNested,
} from 'class-validator';
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
export class ArtistLinksDto {
  @IsOptional()
  @IsUrl({
    protocols: ['https'],
    require_protocol: true,
    require_valid_protocol: true,
  })
  @MaxLength(500)
  instagram?: string;
  @IsOptional()
  @IsUrl({
    protocols: ['https'],
    require_protocol: true,
    require_valid_protocol: true,
  })
  @MaxLength(500)
  tiktok?: string;
  @IsOptional()
  @IsUrl({
    protocols: ['https'],
    require_protocol: true,
    require_valid_protocol: true,
  })
  @MaxLength(500)
  youtube?: string;
  @IsOptional()
  @IsUrl({
    protocols: ['https'],
    require_protocol: true,
    require_valid_protocol: true,
  })
  @MaxLength(500)
  spotify?: string;
  @IsOptional()
  @IsUrl({
    protocols: ['https'],
    require_protocol: true,
    require_valid_protocol: true,
  })
  @MaxLength(500)
  website?: string;
}
export class ArtistProfileDto {
  @Transform(trim) @IsString() @Length(2, 100) nombreArtistico!: string;
  @IsString() @MaxLength(500) biografia!: string;
  @Transform(trim) @IsString() @MaxLength(80) ciudad!: string;
  @Transform(trim) @IsString() @MaxLength(80) pais!: string;
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  genreIds!: string[];
  @IsArray()
  @ArrayMaxSize(8)
  @ArrayUnique()
  @IsIn(
    [
      'Enérgico',
      'Nocturno',
      'Experimental',
      'Emotivo',
      'Acústico',
      'Urbano',
      'Alternativo',
      'Bailable',
    ],
    { each: true },
  )
  identidad!: string[];
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => ArtistLinksDto)
  redes!: ArtistLinksDto;
}
