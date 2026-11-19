import { DjModule } from './dj/dj.module.js';
import { AudiusModule } from './integrations/audius/audius.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { SongsModule } from './songs/songs.module.js';
import { ReleasesModule } from './releases/releases.module.js';
import { LibraryModule } from './library/library.module.js';
import { HistoryModule } from './history/history.module.js';
import { ArtistModule } from './artist/artist.module.js';
import { AuthModule } from './auth/auth.module.js';
import { MusicaModule } from './musica/musica.module.js';
import { ConciertosModule } from './conciertos/conciertos.module.js';
import { TicketingModule } from './ticketing/ticketing.module.js';
import { SandboxGatewayModule } from './sandbox-gateway/sandbox-gateway.module.js';
import { RecommendationsModule } from './recommendations/recommendations.module.js';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health/health.controller.js';

@Module({
  imports: [
    DjModule,
    AuthModule,
    ArtistModule,
    SongsModule,
    ReleasesModule,
    LibraryModule,
    HistoryModule,
    CatalogModule,
    AudiusModule,
    MusicaModule,
    ConciertosModule,
    TicketingModule,
    SandboxGatewayModule,
    RecommendationsModule,
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({ useFactory: () => ({
      type: 'postgres' as const,
      url: process.env.DATABASE_URL,
      autoLoadEntities: true,
      synchronize: false,
      retryAttempts: 3,
    }) }),
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
