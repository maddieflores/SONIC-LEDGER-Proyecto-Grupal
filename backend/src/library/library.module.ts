import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Playlist } from './playlist.entity.js';
import { PlaylistTrack } from './playlist-track.entity.js';
import { FavoriteTrack } from './favorite-track.entity.js';
import { Cancion } from '../musica/cancion.entity.js';
import { AudiusModule } from '../integrations/audius/audius.module.js';
import { LibraryController } from './library.controller.js';
import { LibraryService } from './library.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([Playlist, PlaylistTrack, FavoriteTrack, Cancion]),
    AudiusModule,
  ],
  controllers: [LibraryController],
  providers: [LibraryService],
  exports: [LibraryService],
})
export class LibraryModule {}
