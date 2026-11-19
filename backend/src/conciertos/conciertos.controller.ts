import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConciertosService, type UploadedConcertCover } from './conciertos.service.js';
import { RecomendacionesService } from './recomendaciones.service.js';
import {
  AddConcertArtistaDto,
  CancelarConciertoDto,
  ConcertQueryDto,
  CreateConcertDto,
  CreateTicketCategoryDto,
  RecomendacionesQueryDto,
  UpdateConcertDto,
  UpdateTicketCategoryDto,
} from './conciertos.dto.js';
import { JwtGuard } from '../auth/auth.controller.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolNombre } from '../auth/rol.entity.js';
import { AuthService } from '../auth/auth.service.js';

type AuthRequest = Request & {
  user?: { id: string; username: string; email: string; roles: string[] };
};

@Controller('conciertos')
export class ConciertosController {
  constructor(
    private readonly service: ConciertosService,
    private readonly authService: AuthService,
    private readonly recomendacionesService: RecomendacionesService,
  ) {}

  // 1. Catálogo público (CU18) - Sin autenticación requerida
  @Get()
  async getPublicConcerts(@Query() query: ConcertQueryDto) {
    return this.service.findPublicConcerts(query);
  }

  @Get('artistas-plataforma')
  async getPlatformArtists() {
    return this.service.getPlatformArtists();
  }

  // CU19 — Recomendaciones personalizadas de conciertos para el usuario autenticado
  @Get('recomendados')
  @UseGuards(JwtGuard)
  async getRecommendedConcerts(
    @Req() req: AuthRequest,
    @Query() query: RecomendacionesQueryDto,
  ) {
    return this.recomendacionesService.getRecommendations(
      req.user!.id,
      query.limit,
      query.ciudad,
    );
  }

  // 2. Panel organizador (CU15 / CU16)
  @Get('mis-conciertos')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(RolNombre.ORGANIZADOR)
  async getMyConcerts(@Req() req: AuthRequest) {
    return this.service.getOrganizerConcerts(req.user!.id);
  }

  @Get('organizador/:id')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(RolNombre.ORGANIZADOR)
  async getOrganizerConcertDetail(
    @Req() req: AuthRequest,
    @Param('id') id: string,
  ) {
    return this.service.getOrganizerConcertDetail(req.user!.id, id);
  }

  @Post()
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(RolNombre.ORGANIZADOR)
  async createDraft(
    @Req() req: AuthRequest,
    @Body() dto: CreateConcertDto,
  ) {
    return this.service.createDraft(req.user!.id, dto);
  }

  @Put(':id')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(RolNombre.ORGANIZADOR)
  async updateConcert(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateConcertDto,
  ) {
    return this.service.updateConcert(req.user!.id, id, dto);
  }

  @Post(':id/cover')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(RolNombre.ORGANIZADOR)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    }),
  )
  async uploadCover(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @UploadedFile() file?: UploadedConcertCover,
  ) {
    return this.service.uploadCover(req.user!.id, id, file);
  }

  @Get(':id/cover/:filename')
  async getCover(
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    const file = await this.service.getCoverFile(filename);
    res.setHeader('Content-Type', file.mimetype);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(file.buffer);
  }

  @Post(':id/categorias')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(RolNombre.ORGANIZADOR)
  async addCategory(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: CreateTicketCategoryDto,
  ) {
    return this.service.addCategory(req.user!.id, id, dto);
  }

  @Put(':id/categorias/:catId')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(RolNombre.ORGANIZADOR)
  async updateCategory(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Param('catId') catId: string,
    @Body() dto: UpdateTicketCategoryDto,
  ) {
    return this.service.updateCategory(req.user!.id, id, catId, dto);
  }

  @Delete(':id/categorias/:catId')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(RolNombre.ORGANIZADOR)
  async deleteCategory(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Param('catId') catId: string,
  ) {
    return this.service.deleteCategory(req.user!.id, id, catId);
  }

  @Post(':id/artistas')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(RolNombre.ORGANIZADOR)
  async addArtist(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: AddConcertArtistaDto,
  ) {
    return this.service.addArtist(req.user!.id, id, dto);
  }

  @Delete(':id/artistas/:relId')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(RolNombre.ORGANIZADOR)
  async deleteArtist(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Param('relId') relId: string,
  ) {
    return this.service.deleteArtist(req.user!.id, id, relId);
  }

  @Post(':id/publicar')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(RolNombre.ORGANIZADOR)
  @HttpCode(HttpStatus.OK)
  async publish(
    @Req() req: AuthRequest,
    @Param('id') id: string,
  ) {
    return this.service.publish(req.user!.id, id);
  }

  // CU17 — Cancelar concierto (Organizador / Admin)
  @Post(':id/cancelar')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(RolNombre.ORGANIZADOR)
  @HttpCode(HttpStatus.OK)
  async cancelar(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: CancelarConciertoDto,
  ) {
    return this.service.cancelarConcierto(
      req.user!.id,
      id,
      dto,
      req.user!.roles,
    );
  }

  @Get(':id/cancelacion')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(RolNombre.ORGANIZADOR)
  async getCancelacionInfo(
    @Req() req: AuthRequest,
    @Param('id') id: string,
  ) {
    return this.service.obtenerInformacionCancelacion(
      req.user!.id,
      id,
      req.user!.roles,
    );
  }

  // 3. Detalle público (CU18) - Sin requerir token, pero reconoce si el usuario está autenticado
  @Get(':id')
  async getPublicDetail(
    @Req() req: Request,
    @Param('id') id: string,
  ) {
    let user: { id: string; roles: string[] } | undefined = undefined;
    const [scheme, bearer] = req.headers.authorization?.split(' ') ?? [];
    const cookie = req.headers.cookie
      ?.split(';')
      .map((v) => v.trim())
      .find((v) => v.startsWith('sonic_session='))
      ?.slice('sonic_session='.length);
    const token = scheme === 'Bearer' ? bearer : cookie;
    if (token) {
      try {
        const authUser = await this.authService.authenticate(token);
        user = { id: authUser.id, roles: authUser.roles };
      } catch {
        // Ignorar token inválido para endpoints públicos
      }
    }

    return this.service.getPublicConcertDetail(id, user);
  }
}
