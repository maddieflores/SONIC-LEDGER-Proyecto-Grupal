import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { Artista } from '../musica/artista.entity.js';
import { Genero } from '../musica/genero.entity.js';
import { ArtistController } from './artist.controller.js';
import { ArtistService } from './artist.service.js';
import { ArtistMediaService } from './artist-media.service.js';
@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([Artista, Genero])],
  controllers: [ArtistController],
  providers: [ArtistService, ArtistMediaService],
})
export class ArtistModule {}
