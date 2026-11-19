import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { Artista } from '../musica/artista.entity.js';
import { Cancion } from '../musica/cancion.entity.js';
import { Genero } from '../musica/genero.entity.js';
import { Lanzamiento } from '../musica/lanzamiento.entity.js';
import { SongsController } from './songs.controller.js';
import { SongsService } from './songs.service.js';
@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([Artista, Cancion, Genero, Lanzamiento]),
  ],
  controllers: [SongsController],
  providers: [SongsService],
})
export class SongsModule {}
