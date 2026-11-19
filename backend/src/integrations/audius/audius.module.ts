import { AuthModule } from '../../auth/auth.module.js';
import { AudiusAudioController } from './audio.controller.js';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AudiusClient } from './audius.client.js';
import { AudiusController } from './audius.controller.js';
import { AudiusMapper } from './audius.mapper.js';
import { AudiusService } from './audius.service.js';

@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [AudiusController, AudiusAudioController],
  providers: [AudiusClient, AudiusService, AudiusMapper],
  exports: [AudiusService, AudiusClient, AudiusMapper],
})
export class AudiusModule {}
