import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/auth.controller.js';
import { MusicRecommendationsService } from './music-recommendations.service.js';

type OwnRequest = { user: { id: string } };

export class RecommendationsQueryDto {
  limit?: number;
}

@Controller('auth/recommendations')
@UseGuards(JwtGuard)
export class RecommendationsController {
  constructor(
    private readonly recommendationsService: MusicRecommendationsService,
  ) {}

  /**
   * CU12: Obtener recomendaciones musicales personalizadas.
   */
  @Get('music')
  getMusicRecommendations(
    @Req() req: OwnRequest,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    return this.recommendationsService.getRecommendations(
      req.user.id,
      parsedLimit,
    );
  }

  /**
   * Alias de ruta raíz para conveniencia.
   */
  @Get()
  getRootRecommendations(
    @Req() req: OwnRequest,
    @Query('limit') limit?: string,
  ) {
    return this.getMusicRecommendations(req, limit);
  }

  // Structured candidates are exercised directly in technical tests only.
}
