import { Artista } from '../musica/artista.entity.js';
import { Lanzamiento } from '../musica/lanzamiento.entity.js';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { Cancion } from '../musica/cancion.entity.js';
import { Genero } from '../musica/genero.entity.js';
import { CatalogController } from './catalog.controller.js';
import { CatalogService } from './catalog.service.js';
@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([Cancion, Genero, Artista, Lanzamiento]),
  ],
  controllers: [CatalogController],
  providers: [CatalogService],
})
export class CatalogModule {}
