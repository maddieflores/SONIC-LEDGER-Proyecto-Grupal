import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReleasesController } from './releases.controller.js';
import { ReleasesService } from './releases.service.js';
import { Lanzamiento } from '../musica/lanzamiento.entity.js';
import { Cancion } from '../musica/cancion.entity.js';
import { Artista } from '../musica/artista.entity.js';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([Lanzamiento, Cancion, Artista])],
  controllers: [ReleasesController],
  providers: [ReleasesService],
  exports: [ReleasesService],
})
export class ReleasesModule {}
