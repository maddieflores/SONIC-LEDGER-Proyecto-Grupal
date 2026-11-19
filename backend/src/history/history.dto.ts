import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class RecordPlaybackEventDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  trackId!: string;

  @IsOptional()
  @IsIn(['LOCAL', 'AUDIUS'])
  source?: 'LOCAL' | 'AUDIUS';

  @IsNumber()
  @Min(0)
  @Max(86400)
  listenedSeconds!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(86400)
  trackDurationSeconds?: number;

  @IsOptional()
  @IsString()
  startedAt?: string;

  @IsOptional()
  @IsString()
  endedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  clientEventId?: string;

  @IsOptional()
  @IsIn(['PLAYED', 'SKIPPED'])
  eventType?: 'PLAYED' | 'SKIPPED';
}

export class GetHistoryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number = 20;

  @IsOptional()
  @IsIn(['PLAYED', 'SKIPPED', 'ALL'])
  eventType?: 'PLAYED' | 'SKIPPED' | 'ALL' = 'ALL';
}
