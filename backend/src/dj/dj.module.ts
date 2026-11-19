import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { LibraryModule } from '../library/library.module.js';
import { RecommendationsModule } from '../recommendations/recommendations.module.js';
import { DjSessionEntity } from './dj-session.entity.js';
import { DjController } from './dj.controller.js';
import { DjService } from './dj.service.js';
import { DjInterpreter, OllamaAdapter } from './ollama.adapter.js';
@Module({
  imports: [
    AuthModule,
    LibraryModule,
    RecommendationsModule,
    TypeOrmModule.forFeature([DjSessionEntity]),
  ],
  controllers: [DjController],
  providers: [DjService, { provide: DjInterpreter, useClass: OllamaAdapter }],
})
export class DjModule {}
