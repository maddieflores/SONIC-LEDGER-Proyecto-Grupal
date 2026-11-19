import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cancion } from '../musica/cancion.entity.js';
import { Usuario } from '../auth/usuario.entity.js';
import { FavoriteTrack } from '../library/favorite-track.entity.js';
import { ListeningHistory } from '../history/listening-history.entity.js';
import { Genero } from '../musica/genero.entity.js';
import { LibraryModule } from '../library/library.module.js';
import { AudiusModule } from '../integrations/audius/audius.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { MusicRecommendationsService } from './music-recommendations.service.js';
import { TrackSelectorService } from './track-selector.service.js';
import { RecommendationsController } from './recommendations.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Cancion,
      Usuario,
      FavoriteTrack,
      ListeningHistory,
      Genero,
    ]),
    LibraryModule,
    AudiusModule,
    AuthModule,
  ],
  controllers: [RecommendationsController],
  providers: [MusicRecommendationsService, TrackSelectorService],
  exports: [MusicRecommendationsService, TrackSelectorService],
})
export class RecommendationsModule {}
