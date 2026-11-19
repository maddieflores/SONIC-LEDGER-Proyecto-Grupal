import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
export class UpdateProfileDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 60)
  displayName!: string;
  @IsString() @MaxLength(300) biography!: string;
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  genreIds!: string[];
  @IsArray()
  @ArrayMaxSize(4)
  @ArrayUnique()
  @IsIn(['Entrenar', 'Relajarme', 'Fiesta', 'Concentración'], { each: true })
  moods!: string[];
  @IsInt() @Min(0) @Max(100) intensity!: number;
  @IsInt() @Min(0) @Max(100) discovery!: number;
  @IsInt() @Min(0) @Max(100) energy!: number;
}
