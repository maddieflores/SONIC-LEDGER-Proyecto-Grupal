import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Artista } from './artista.entity.js';
import { Genero } from './genero.entity.js';
import { Lanzamiento } from './lanzamiento.entity.js';
import { Cancion } from './cancion.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Artista, Genero, Lanzamiento, Cancion])],
  exports: [TypeOrmModule],
})
export class MusicaModule {}
