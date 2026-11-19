import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
export class ManualDjDto {
  @IsString()
  @Matches(
    /^(?:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|audius:[a-zA-Z0-9]+)$/,
  )
  trackId!: string;
}
export class GenerateDjDto {
  @IsString() @MinLength(2) @MaxLength(800) prompt!: string;
}
export class EditDjDto {
  @IsInt() @Min(1) version!: number;
  @IsIn(['instruction', 'remove', 'move', 'replace', 'deduplicate', 'append'])
  action!: string;
  @IsOptional()
  @IsString()
  @Matches(
    /^(?:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|audius:[a-zA-Z0-9]+)$/,
  )
  trackId?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(800) prompt?: string;
  @IsOptional() @IsInt() @Min(0) @Max(29) index?: number;
  @IsOptional() @IsInt() @Min(0) @Max(29) to?: number;
}
export class SaveDjDto {
  @IsInt() @Min(1) version!: number;
  @IsString() @MinLength(1) @MaxLength(150) nombre!: string;
}
