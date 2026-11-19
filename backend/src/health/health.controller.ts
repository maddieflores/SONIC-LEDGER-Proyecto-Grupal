import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller('health')
export class HealthController {
  constructor(private readonly database: DataSource) {}

  @Get()
  async check() {
    try {
      await this.database.query('SELECT 1');
      const response = await fetch(`${process.env.AI_URL ?? 'http://127.0.0.1:8010'}/health`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) throw new Error('IA unavailable');
      return { status: 'ok', database: 'connected', ai: 'connected', project: 'Sonic Ledger' };
    } catch {
      throw new ServiceUnavailableException('Base de datos o servicio IA no disponible');
    }
  }
}

