import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ListeningHistory } from './listening-history.entity.js';
import { Cancion } from '../musica/cancion.entity.js';
import { LibraryModule } from '../library/library.module.js';
import { HistoryController } from './history.controller.js';
import { HistoryService } from './history.service.js';
import { MusicalStatsService } from './stats.service.js';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([ListeningHistory, Cancion]),
    LibraryModule,
  ],
  controllers: [HistoryController],
  providers: [HistoryService, MusicalStatsService],
  exports: [HistoryService, MusicalStatsService],
})
export class HistoryModule {}
