import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Concierto } from './concierto.entity.js';
import { ConciertoArtista } from './concierto-artista.entity.js';
import { ConciertoCategoria } from './concierto-categoria.entity.js';
import { Artista } from '../musica/artista.entity.js';
import { Usuario } from '../auth/usuario.entity.js';
import { FavoriteTrack } from '../library/favorite-track.entity.js';
import { ListeningHistory } from '../history/listening-history.entity.js';
import { Genero } from '../musica/genero.entity.js';
import { Reembolso } from '../ticketing/reembolso.entity.js';
import { ConciertosController } from './conciertos.controller.js';
import { ConciertosService } from './conciertos.service.js';
import { RecomendacionesService } from './recomendaciones.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { LibraryModule } from '../library/library.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Concierto,
      ConciertoArtista,
      ConciertoCategoria,
      Artista,
      Usuario,
      FavoriteTrack,
      ListeningHistory,
      Genero,
      Reembolso,
    ]),
    AuthModule,
    LibraryModule,
  ],
  controllers: [ConciertosController],
  providers: [ConciertosService, RecomendacionesService],
  exports: [ConciertosService, RecomendacionesService],
})
export class ConciertosModule {}
